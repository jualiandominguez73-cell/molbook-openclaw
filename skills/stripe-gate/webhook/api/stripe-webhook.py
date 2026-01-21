"""
Vercel Serverless Function: Stripe Webhook Handler

Receives Stripe webhook events and forwards subscription updates 
to the Clawdbot gateway for local database updates.

Environment Variables (set in Vercel):
- STRIPE_WEBHOOK_SECRET: Webhook signing secret from Stripe
- CALLBACK_URL: URL to POST subscription updates to (Clawdbot endpoint)
- CALLBACK_SECRET: Shared secret for authenticating callbacks
"""

import json
import os
import hmac
import hashlib
import time
from http.server import BaseHTTPRequestHandler
import urllib.request
import urllib.error

# Stripe webhook signature verification
def verify_stripe_signature(payload: bytes, sig_header: str, secret: str) -> bool:
    """Verify Stripe webhook signature."""
    try:
        # Parse signature header
        parts = dict(item.split("=") for item in sig_header.split(","))
        timestamp = parts.get("t")
        signature = parts.get("v1")
        
        if not timestamp or not signature:
            return False
        
        # Check timestamp (reject if older than 5 minutes)
        if abs(time.time() - int(timestamp)) > 300:
            return False
        
        # Compute expected signature
        signed_payload = f"{timestamp}.{payload.decode('utf-8')}"
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            signed_payload.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_sig)
    except Exception:
        return False

def forward_to_callback(data: dict) -> bool:
    """Forward subscription update to Clawdbot callback URL."""
    callback_url = os.environ.get("CALLBACK_URL")
    callback_secret = os.environ.get("CALLBACK_SECRET", "")
    
    if not callback_url:
        print("No CALLBACK_URL configured")
        return False
    
    payload = json.dumps(data).encode("utf-8")
    
    req = urllib.request.Request(
        callback_url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Secret": callback_secret,
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except urllib.error.URLError as e:
        print(f"Callback failed: {e}")
        return False

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Read body
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        
        # Verify signature
        webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
        sig_header = self.headers.get("Stripe-Signature", "")
        
        if webhook_secret and not verify_stripe_signature(body, sig_header, webhook_secret):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"error": "Invalid signature"}')
            return
        
        # Parse event
        try:
            event = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"error": "Invalid JSON"}')
            return
        
        event_type = event.get("type", "")
        data = event.get("data", {}).get("object", {})
        
        # Handle relevant events
        update = None
        
        if event_type == "checkout.session.completed":
            # New subscription via checkout
            user_id = data.get("metadata", {}).get("user_id")
            customer_id = data.get("customer")
            subscription_id = data.get("subscription")
            email = data.get("customer_email")
            
            if user_id and subscription_id:
                update = {
                    "action": "subscription_created",
                    "user_id": user_id,
                    "customer_id": customer_id,
                    "subscription_id": subscription_id,
                    "email": email,
                    "status": "active",
                }
        
        elif event_type == "customer.subscription.updated":
            user_id = data.get("metadata", {}).get("user_id")
            status = data.get("status")  # active, past_due, canceled, etc.
            period_end = data.get("current_period_end")
            
            if user_id:
                update = {
                    "action": "subscription_updated",
                    "user_id": user_id,
                    "subscription_id": data.get("id"),
                    "customer_id": data.get("customer"),
                    "status": "active" if status == "active" else status,
                    "period_end": period_end,
                }
        
        elif event_type == "customer.subscription.deleted":
            user_id = data.get("metadata", {}).get("user_id")
            
            if user_id:
                update = {
                    "action": "subscription_canceled",
                    "user_id": user_id,
                    "subscription_id": data.get("id"),
                    "status": "canceled",
                }
        
        # Forward update if we have one
        if update:
            success = forward_to_callback(update)
            if not success:
                # Log but don't fail - Stripe will retry
                print(f"Warning: callback failed for {event_type}")
        
        # Always return 200 to Stripe (avoid retries for handled events)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"received": True, "type": event_type}).encode())
    
    def do_GET(self):
        """Health check endpoint."""
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status": "ok", "service": "stripe-gate-webhook"}')
