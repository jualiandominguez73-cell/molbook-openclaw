#!/usr/bin/env python3
"""Manual subscription management commands."""

import argparse
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

try:
    import stripe
except ImportError:
    stripe = None

SKILL_DIR = Path(__file__).parent.parent
DB_PATH = SKILL_DIR / "subscriptions.db"

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

def get_db():
    """Get database connection."""
    if not DB_PATH.exists():
        print("Database not initialized. Run init-db.py first.", file=sys.stderr)
        sys.exit(1)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def cmd_add(args):
    """Add or update a subscription."""
    conn = get_db()
    user_id = normalize_user_id(args.user_id)
    
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
        args.customer,
        args.subscription,
        args.status,
        args.period_end,
        int(time.time())
    ))
    conn.commit()
    conn.close()
    print(f"Added/updated subscription for {user_id}")

def cmd_remove(args):
    """Remove a subscription."""
    conn = get_db()
    user_id = normalize_user_id(args.user_id)
    
    cursor = conn.execute("DELETE FROM subscriptions WHERE user_id = ?", (user_id,))
    conn.commit()
    
    if cursor.rowcount > 0:
        print(f"Removed subscription for {user_id}")
    else:
        print(f"No subscription found for {user_id}")
    conn.close()

def cmd_list(args):
    """List all subscriptions."""
    conn = get_db()
    
    if args.active_only:
        cursor = conn.execute("SELECT * FROM subscriptions WHERE status = 'active' ORDER BY updated_at DESC")
    else:
        cursor = conn.execute("SELECT * FROM subscriptions ORDER BY updated_at DESC")
    
    rows = cursor.fetchall()
    conn.close()
    
    if args.json:
        print(json.dumps([dict(row) for row in rows], indent=2))
    else:
        if not rows:
            print("No subscriptions found.")
            return
        
        print(f"{'User ID':<30} {'Status':<12} {'Customer':<20} {'Subscription':<20}")
        print("-" * 85)
        for row in rows:
            print(f"{row['user_id']:<30} {row['status']:<12} {row['stripe_customer_id'] or 'N/A':<20} {row['stripe_subscription_id'] or 'N/A':<20}")

def cmd_sync(args):
    """Sync subscriptions with Stripe."""
    if not stripe:
        print("stripe package not installed. Run: pip install stripe", file=sys.stderr)
        sys.exit(1)
    
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe.api_key:
        print("STRIPE_SECRET_KEY not set", file=sys.stderr)
        sys.exit(1)
    
    conn = get_db()
    cursor = conn.execute("SELECT * FROM subscriptions WHERE stripe_subscription_id IS NOT NULL")
    rows = cursor.fetchall()
    
    updated = 0
    for row in rows:
        try:
            sub = stripe.Subscription.retrieve(row["stripe_subscription_id"])
            new_status = "active" if sub.status == "active" else sub.status
            
            conn.execute("""
                UPDATE subscriptions 
                SET status = ?, current_period_end = ?, updated_at = ?
                WHERE user_id = ?
            """, (new_status, sub.current_period_end, int(time.time()), row["user_id"]))
            updated += 1
        except stripe.error.StripeError as e:
            print(f"Error syncing {row['user_id']}: {e}", file=sys.stderr)
    
    conn.commit()
    conn.close()
    print(f"Synced {updated} subscriptions")

def cmd_grant(args):
    """Grant manual access (no Stripe, just mark as active)."""
    conn = get_db()
    user_id = normalize_user_id(args.user_id)
    
    # Calculate period end (default 30 days)
    period_end = int(time.time()) + (args.days * 86400)
    
    conn.execute("""
        INSERT INTO subscriptions (user_id, status, current_period_end, updated_at)
        VALUES (?, 'active', ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            status = 'active',
            current_period_end = excluded.current_period_end,
            updated_at = excluded.updated_at
    """, (user_id, period_end, int(time.time())))
    conn.commit()
    conn.close()
    print(f"Granted {args.days}-day access to {user_id}")

def main():
    parser = argparse.ArgumentParser(description="Manage subscriptions")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # add command
    add_parser = subparsers.add_parser("add", help="Add/update subscription")
    add_parser.add_argument("user_id", help="Phone or telegram:id")
    add_parser.add_argument("--customer", help="Stripe customer ID")
    add_parser.add_argument("--subscription", help="Stripe subscription ID")
    add_parser.add_argument("--status", default="active", help="Status (default: active)")
    add_parser.add_argument("--period-end", type=int, help="Period end timestamp")
    add_parser.set_defaults(func=cmd_add)
    
    # remove command
    remove_parser = subparsers.add_parser("remove", help="Remove subscription")
    remove_parser.add_argument("user_id", help="Phone or telegram:id")
    remove_parser.set_defaults(func=cmd_remove)
    
    # list command
    list_parser = subparsers.add_parser("list", help="List subscriptions")
    list_parser.add_argument("--active-only", action="store_true", help="Only show active")
    list_parser.add_argument("--json", action="store_true", help="JSON output")
    list_parser.set_defaults(func=cmd_list)
    
    # sync command
    sync_parser = subparsers.add_parser("sync", help="Sync with Stripe")
    sync_parser.set_defaults(func=cmd_sync)
    
    # grant command
    grant_parser = subparsers.add_parser("grant", help="Grant manual access")
    grant_parser.add_argument("user_id", help="Phone or telegram:id")
    grant_parser.add_argument("--days", type=int, default=30, help="Days of access (default: 30)")
    grant_parser.set_defaults(func=cmd_grant)
    
    args = parser.parse_args()
    args.func(args)

if __name__ == "__main__":
    main()
