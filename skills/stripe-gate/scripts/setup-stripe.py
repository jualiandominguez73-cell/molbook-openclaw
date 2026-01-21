#!/usr/bin/env python3
"""Setup Stripe products and prices."""

import argparse
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
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {}

def save_config(config: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)

def cmd_create_product(args):
    """Create a Stripe product."""
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe.api_key:
        print("STRIPE_SECRET_KEY not set", file=sys.stderr)
        sys.exit(1)
    
    product = stripe.Product.create(
        name=args.name,
        description=args.description,
    )
    
    print(f"Created product: {product.id}")
    print(f"  Name: {product.name}")
    print(f"  Description: {product.description}")
    
    # Update config
    config = load_config()
    config["product_id"] = product.id
    config["product_name"] = product.name
    save_config(config)
    print(f"\nUpdated config.json with product_id")

def cmd_create_price(args):
    """Create a Stripe price."""
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe.api_key:
        print("STRIPE_SECRET_KEY not set", file=sys.stderr)
        sys.exit(1)
    
    config = load_config()
    product_id = args.product or config.get("product_id")
    
    if not product_id:
        print("No product ID. Run create-product first or use --product", file=sys.stderr)
        sys.exit(1)
    
    price = stripe.Price.create(
        product=product_id,
        unit_amount=args.amount,
        currency=args.currency,
        recurring={"interval": args.interval},
    )
    
    print(f"Created price: {price.id}")
    print(f"  Amount: ${args.amount / 100:.2f}/{args.interval}")
    print(f"  Product: {product_id}")
    
    # Update config
    config["price_id"] = price.id
    config["amount_cents"] = args.amount
    config["interval"] = args.interval
    config["currency"] = args.currency
    save_config(config)
    print(f"\nUpdated config.json with price_id")

def cmd_list_products(args):
    """List Stripe products."""
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe.api_key:
        print("STRIPE_SECRET_KEY not set", file=sys.stderr)
        sys.exit(1)
    
    products = stripe.Product.list(limit=20)
    
    for product in products:
        print(f"{product.id}: {product.name}")

def cmd_list_prices(args):
    """List Stripe prices."""
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe.api_key:
        print("STRIPE_SECRET_KEY not set", file=sys.stderr)
        sys.exit(1)
    
    prices = stripe.Price.list(limit=20, expand=["data.product"])
    
    for price in prices:
        product_name = price.product.name if hasattr(price.product, "name") else price.product
        interval = price.recurring.interval if price.recurring else "one-time"
        print(f"{price.id}: ${price.unit_amount / 100:.2f}/{interval} ({product_name})")

def main():
    parser = argparse.ArgumentParser(description="Setup Stripe products and prices")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # create-product
    prod_parser = subparsers.add_parser("create-product", help="Create product")
    prod_parser.add_argument("--name", required=True, help="Product name")
    prod_parser.add_argument("--description", default="", help="Product description")
    prod_parser.set_defaults(func=cmd_create_product)
    
    # create-price
    price_parser = subparsers.add_parser("create-price", help="Create price")
    price_parser.add_argument("--product", help="Product ID (uses config if not set)")
    price_parser.add_argument("--amount", type=int, required=True, help="Amount in cents")
    price_parser.add_argument("--currency", default="usd", help="Currency (default: usd)")
    price_parser.add_argument("--interval", default="month", choices=["day", "week", "month", "year"])
    price_parser.set_defaults(func=cmd_create_price)
    
    # list-products
    list_prod_parser = subparsers.add_parser("list-products", help="List products")
    list_prod_parser.set_defaults(func=cmd_list_products)
    
    # list-prices
    list_price_parser = subparsers.add_parser("list-prices", help="List prices")
    list_price_parser.set_defaults(func=cmd_list_prices)
    
    args = parser.parse_args()
    args.func(args)

if __name__ == "__main__":
    main()
