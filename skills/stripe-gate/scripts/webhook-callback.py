#!/usr/bin/env python3
"""
Webhook callback handler - processes subscription updates from Vercel webhook.

Can be run as:
1. HTTP server: ./webhook-callback.py serve --port 8765
2. Direct update: ./webhook-callback.py update --json '{"action": "subscription_created", ...}'
3. Stdin pipe: echo '{"action": ...}' | ./webhook-callback.py update --stdin
"""

import argparse
import json
import os
import sqlite3
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

SKILL_DIR = Path(__file__).parent.parent
DB_PATH = SKILL_DIR / "subscriptions.db"
CALLBACK_SECRET = os.environ.get("STRIPE_CALLBACK_SECRET", "")

def get_db():
    """Get database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def process_update(data: dict) -> dict:
    """Process a subscription update."""
    action = data.get("action")
    user_id = data.get("user_id")
    
    if not user_id:
        return {"error": "missing user_id"}
    
    conn = get_db()
    now = int(time.time())
    
    try:
        if action == "subscription_created":
            conn.execute("""
                INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, email, status, current_period_end, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    stripe_customer_id = excluded.stripe_customer_id,
                    stripe_subscription_id = excluded.stripe_subscription_id,
                    email = excluded.email,
                    status = excluded.status,
                    current_period_end = excluded.current_period_end,
                    updated_at = excluded.updated_at
            """, (
                user_id,
                data.get("customer_id"),
                data.get("subscription_id"),
                data.get("email"),
                data.get("status", "active"),
                data.get("period_end"),
                now
            ))
            
        elif action == "subscription_updated":
            conn.execute("""
                UPDATE subscriptions 
                SET status = ?, current_period_end = ?, updated_at = ?
                WHERE user_id = ?
            """, (
                data.get("status", "active"),
                data.get("period_end"),
                now,
                user_id
            ))
            
        elif action == "subscription_canceled":
            conn.execute("""
                UPDATE subscriptions 
                SET status = 'canceled', updated_at = ?
                WHERE user_id = ?
            """, (now, user_id))
        
        else:
            return {"error": f"unknown action: {action}"}
        
        conn.commit()
        return {"success": True, "action": action, "user_id": user_id}
        
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Check secret
        if CALLBACK_SECRET:
            header_secret = self.headers.get("X-Webhook-Secret", "")
            if header_secret != CALLBACK_SECRET:
                self.send_response(401)
                self.end_headers()
                self.wfile.write(b'{"error": "unauthorized"}')
                return
        
        # Read body
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"error": "invalid json"}')
            return
        
        result = process_update(data)
        
        self.send_response(200 if "success" in result else 400)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())
    
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status": "ok"}')
    
    def log_message(self, format, *args):
        print(f"[webhook] {args[0]}")

def cmd_serve(args):
    """Run HTTP server for webhook callbacks."""
    server = HTTPServer(("0.0.0.0", args.port), WebhookHandler)
    print(f"Webhook callback server running on port {args.port}")
    server.serve_forever()

def cmd_update(args):
    """Process a single update."""
    if args.stdin:
        data = json.load(sys.stdin)
    else:
        data = json.loads(args.json)
    
    result = process_update(data)
    print(json.dumps(result))
    
    if "error" in result:
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    serve_parser = subparsers.add_parser("serve", help="Run HTTP server")
    serve_parser.add_argument("--port", type=int, default=8765)
    serve_parser.set_defaults(func=cmd_serve)
    
    update_parser = subparsers.add_parser("update", help="Process single update")
    update_parser.add_argument("--json", help="JSON payload")
    update_parser.add_argument("--stdin", action="store_true", help="Read from stdin")
    update_parser.set_defaults(func=cmd_update)
    
    args = parser.parse_args()
    args.func(args)

if __name__ == "__main__":
    main()
