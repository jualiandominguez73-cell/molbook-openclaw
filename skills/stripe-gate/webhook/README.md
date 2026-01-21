# Stripe Gate Webhook (Vercel)

Serverless webhook handler for Stripe subscription events.

## Deploy to Vercel

```bash
cd webhook
vercel login  # if needed
vercel deploy --prod
```

## Configure Environment Variables

In Vercel project settings, add:

| Variable | Description |
|----------|-------------|
| `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard → Webhooks → Signing secret |
| `CALLBACK_URL` | URL to POST updates to (your Clawdbot callback server) |
| `CALLBACK_SECRET` | Shared secret for authenticating callbacks |

Or use Vercel CLI:
```bash
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add CALLBACK_URL  
vercel env add CALLBACK_SECRET
```

## Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project.vercel.app/api/stripe-webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in Vercel

## Callback Server

Run the callback server on your Clawdbot host:

```bash
# Set the shared secret
export STRIPE_CALLBACK_SECRET="your-secret-here"

# Run server (use screen/tmux for persistence)
./scripts/webhook-callback.py serve --port 8765
```

Then set `CALLBACK_URL` in Vercel to your server's public URL:
- `https://your-domain.com:8765` (if exposed directly)
- Or use a tunnel: `ngrok http 8765`

## Testing

```bash
# Test webhook health
curl https://your-project.vercel.app/api/stripe-webhook

# Test with Stripe CLI
stripe listen --forward-to https://your-project.vercel.app/api/stripe-webhook
stripe trigger checkout.session.completed
```
