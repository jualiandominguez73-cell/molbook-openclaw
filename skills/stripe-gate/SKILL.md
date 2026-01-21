---
name: stripe-gate
description: Payment gating for skills using Stripe subscriptions. Check if user has active subscription before allowing access to gated skills, otherwise send checkout link.
metadata: {"clawdbot":{"requires":{"bins":["python3"],"env":["STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET"]}}}
---

# Stripe Gate

Payment-gated skill access using Stripe subscriptions.

## How It Works

1. User sends message to agent
2. Agent calls `stripe-gate check <phone_or_telegram_id>`
3. If ACTIVE → proceed with gated skill
4. If INACTIVE → return checkout link for user to subscribe

## Setup

### 1. Environment Variables

```bash
export STRIPE_SECRET_KEY="sk_live_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 2. Create Stripe Product & Price

```bash
# Create product
./scripts/setup-stripe.py create-product --name "Tree Amigos Pro" --description "Unlimited tree disease diagnosis"

# Create price ($5/month)
./scripts/setup-stripe.py create-price --product prod_xxx --amount 500 --interval month
```

### 3. Configure Gated Skills

Edit `config.json`:
```json
{
  "price_id": "price_xxxxx",
  "gated_skills": ["tree-doctor"],
  "checkout_success_url": "https://treeamigos.com/thanks",
  "checkout_cancel_url": "https://treeamigos.com/pricing"
}
```

### 4. Deploy Webhook Handler

```bash
cd webhook
vercel deploy --prod
```

Add the deployed URL to Stripe Dashboard → Webhooks:
- `https://your-webhook.vercel.app/api/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### 5. Initialize Database

```bash
./scripts/init-db.py
```

## Commands

```bash
# Check subscription status
./scripts/check.py "+15551234567"
./scripts/check.py "telegram:123456789"

# Create checkout session (returns URL)
./scripts/create-checkout.py "+15551234567"
./scripts/create-checkout.py "telegram:123456789"

# Manual subscription management
./scripts/manage.py add "+15551234567" --customer cus_xxx --subscription sub_xxx
./scripts/manage.py remove "+15551234567"
./scripts/manage.py list
./scripts/manage.py sync  # Sync with Stripe API
```

## Integration

In your agent flow:

```python
# Before running gated skill
result = subprocess.run(["./scripts/check.py", user_id], capture_output=True)
if result.stdout.strip() == "ACTIVE":
    # Run the gated skill
    pass
else:
    # Send checkout link
    checkout_url = subprocess.run(["./scripts/create-checkout.py", user_id], capture_output=True)
    reply(f"Subscribe for $5/mo to unlock tree diagnosis!\n{checkout_url.stdout.strip()}")
```

## Database Schema

SQLite database at `subscriptions.db`:

```sql
CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,      -- phone or "telegram:123456"
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    status TEXT DEFAULT 'inactive',    -- active, inactive, canceled, past_due
    current_period_end INTEGER,        -- Unix timestamp
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_user_id ON subscriptions(user_id);
CREATE INDEX idx_status ON subscriptions(status);
```

## Files

- `config.json` — Price ID, gated skills, URLs
- `subscriptions.db` — SQLite database
- `scripts/check.py` — Check subscription status
- `scripts/create-checkout.py` — Generate Stripe Checkout URL
- `scripts/manage.py` — Manual subscription management
- `scripts/init-db.py` — Initialize database
- `scripts/setup-stripe.py` — Create Stripe products/prices
- `webhook/api/stripe-webhook.py` — Vercel serverless webhook handler
