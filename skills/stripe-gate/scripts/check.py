#!/usr/bin/env python3
"""Check if a user has an active subscription."""

import os
import sqlite3
import sys
import time
import json
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "subscriptions.db"

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

def check_stripe_directly(user_id: str) -> dict | None:
    """Check Stripe API directly for subscription by metadata."""
    try:
        import stripe
        stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
        if not stripe.api_key:
            return None
        
        # Search for subscriptions with this user_id in metadata
        subscriptions = stripe.Subscription.search(
            query=f'metadata["user_id"]:"{user_id}"',
            limit=1
        )
        
        if subscriptions.data:
            sub = subscriptions.data[0]
            if sub.status == "active":
                return {
                    "status": "active",
                    "user_id": user_id,
                    "customer_id": sub.customer,
                    "subscription_id": sub.id,
                    "period_end": sub.current_period_end,
                    "source": "stripe_api"
                }
            return {
                "status": sub.status,
                "user_id": user_id,
                "customer_id": sub.customer,
                "source": "stripe_api"
            }
        return None
    except Exception as e:
        # Stripe check failed, return None to indicate no result
        return None

def check_local_db(user_id: str) -> dict | None:
    """Check local SQLite database for subscription."""
    if not DB_PATH.exists():
        return None
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT * FROM subscriptions WHERE user_id = ?",
        (user_id,)
    )
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    status = row["status"]
    period_end = row["current_period_end"]
    
    if status == "active":
        if period_end and period_end < int(time.time()):
            return {
                "status": "expired",
                "user_id": user_id,
                "customer_id": row["stripe_customer_id"],
                "subscription_id": row["stripe_subscription_id"],
                "period_end": period_end,
                "source": "local_db"
            }
        return {
            "status": "active",
            "user_id": user_id,
            "customer_id": row["stripe_customer_id"],
            "subscription_id": row["stripe_subscription_id"],
            "period_end": period_end,
            "source": "local_db"
        }
    
    return {
        "status": status,
        "user_id": user_id,
        "customer_id": row["stripe_customer_id"],
        "source": "local_db"
    }

def check_subscription(user_id: str) -> dict:
    """Check subscription status for a user. Checks local DB first, then Stripe API."""
    user_id = normalize_user_id(user_id)
    
    # First check local database (fast)
    result = check_local_db(user_id)
    if result and result.get("status") == "active":
        return result
    
    # If not found or not active locally, check Stripe API (authoritative)
    stripe_result = check_stripe_directly(user_id)
    if stripe_result:
        # If Stripe says active, update local DB for caching
        if stripe_result.get("status") == "active" and DB_PATH.exists():
            try:
                conn = sqlite3.connect(DB_PATH)
                conn.execute("""
                    INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        stripe_customer_id = excluded.stripe_customer_id,
                        stripe_subscription_id = excluded.stripe_subscription_id,
                        status = excluded.status,
                        current_period_end = excluded.current_period_end,
                        updated_at = excluded.updated_at
                """, (
                    user_id,
                    stripe_result.get("customer_id"),
                    stripe_result.get("subscription_id"),
                    stripe_result.get("status"),
                    stripe_result.get("period_end"),
                    int(time.time())
                ))
                conn.commit()
                conn.close()
            except Exception:
                pass  # Cache update failed, not critical
        return stripe_result
    
    # Return local result if we had one, otherwise inactive
    if result:
        return result
    
    return {"status": "inactive", "user_id": user_id}

def main():
    if len(sys.argv) < 2:
        print("Usage: check.py <user_id> [--json]", file=sys.stderr)
        sys.exit(1)
    
    user_id = sys.argv[1]
    as_json = "--json" in sys.argv
    
    result = check_subscription(user_id)
    
    if as_json:
        print(json.dumps(result))
    else:
        print(result["status"].upper())

if __name__ == "__main__":
    main()
