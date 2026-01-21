#!/usr/bin/env python3
"""Create a Stripe Checkout session for a user."""

import json
import os
import sys
from pathlib import Path

try:
    import stripe
except ImportError:
    print("ERROR: stripe package not installed. Run: pip install stripe", file=sys.stderr)
    sys.exit(1)

SKILL_DIR = Path(__file__).parent.parent
CONFIG_PATH = SKILL_DIR / "config.json"

def load_config() -> dict:
    """Load skill configuration."""
    if not CONFIG_PATH.exists():
        return {}
    with open(CONFIG_PATH) as f:
        return json.load(f)

def normalize_user_id(user_id: str) -> str:
    """Normalize user ID format."""
    user_id = user_id.strip()
    if user_id.isdigit():
        return f"telegram:{user_id}"
    if user_id.startswith("+"):
        return user_id
    if ":" in user_id:
        return user_id
    return f"+{user_id}"

def create_checkout_session(user_id: str) -> str:
    """Create a Stripe Checkout session and return the URL."""
    config = load_config()
    
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe.api_key:
        raise ValueError("STRIPE_SECRET_KEY environment variable not set")
    
    price_id = config.get("price_id")
    if not price_id:
        raise ValueError("price_id not configured in config.json")
    
    user_id = normalize_user_id(user_id)
    success_url = config.get("checkout_success_url", "https://example.com/success")
    cancel_url = config.get("checkout_cancel_url", "https://example.com/cancel")
    trial_days = config.get("trial_days", 0)
    
    session_params = {
        "mode": "subscription",
        "payment_method_types": ["card"],
        "line_items": [{
            "price": price_id,
            "quantity": 1,
        }],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {
            "user_id": user_id,
        },
        "subscription_data": {
            "metadata": {
                "user_id": user_id,
            }
        }
    }
    
    if trial_days > 0:
        session_params["subscription_data"]["trial_period_days"] = trial_days
    
    session = stripe.checkout.Session.create(**session_params)
    
    return session.url

def main():
    if len(sys.argv) < 2:
        print("Usage: create-checkout.py <user_id> [--json]", file=sys.stderr)
        sys.exit(1)
    
    user_id = sys.argv[1]
    as_json = "--json" in sys.argv
    
    try:
        url = create_checkout_session(user_id)
        if as_json:
            print(json.dumps({"url": url, "user_id": normalize_user_id(user_id)}))
        else:
            print(url)
    except Exception as e:
        if as_json:
            print(json.dumps({"error": str(e)}))
        else:
            print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
