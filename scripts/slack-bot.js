#!/usr/bin/env node
import { App, LogLevel } from '@slack/bolt';
import dotenv from 'dotenv';
import dns from 'node:dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch {}
dotenv.config();

const botToken = process.env.SLACK_BOT_TOKEN; // xoxb-...
const appToken = process.env.SLACK_APP_TOKEN; // xapp-...
const signingSecret = process.env.SLACK_SIGNING_SECRET; // optional for Socket Mode
const defaultChannel = process.env.SLACK_DEFAULT_CHANNEL; // e.g., C0123456789

if (!botToken || !appToken) {
  console.error('Missing SLACK_BOT_TOKEN and/or SLACK_APP_TOKEN in .env');
  process.exit(2);
}

const app = new App({
  token: botToken,
  appToken,
  socketMode: true,
  signingSecret,
  logLevel: LogLevel.INFO,
});

// Basic health check command
app.command('/moltbot', async ({ ack, say, command }) => {
  await ack();
  const text = command.text?.trim() || 'ok';
  await say(`Moltbot: ${text}`);
});

// Log all events (debug)
app.use(async ({ logger, body, next }) => {
  try { console.log('EVENT', body?.type || body?.event?.type || Object.keys(body||{})); } catch {}
  await next();
});

// Respond to mentions
app.event('app_mention', async ({ event, client }) => {
  const text = (event.text || '').replace(/<@[^>]+>/g, '').trim();
  const reply = text ? `You said: ${text}` : 'Hi!';
  await client.chat.postMessage({ channel: event.channel, thread_ts: event.ts, text: reply });
});

// Basic message listener in channels the bot is in
app.message(/^(ping|test)$/i, async ({ message, say }) => {
  await say({ thread_ts: message.ts, text: 'pong ✅' });
});

async function autoJoinPublicChannels() {
  try {
    let cursor;
    let joined = 0;
    do {
      const res = await app.client.conversations.list({
        types: 'public_channel',
        limit: 200,
        cursor,
      });
      for (const ch of res.channels || []) {
        if (!ch.is_member) {
          try {
            await app.client.conversations.join({ channel: ch.id });
            joined++;
          } catch (e) {
            // Ignore join errors (e.g., already_member, restricted)
          }
        }
      }
      cursor = res.response_metadata?.next_cursor || undefined;
    } while (cursor);
    if (joined > 0) {
      console.log(`Joined ${joined} public channels.`);
    }
  } catch (err) {
    console.warn('Auto-join sweep failed:', err?.data || err?.message || err);
  }
}

async function main() {
  await app.start();
  console.log('⚡️ Moltbot Slack bot running (Socket Mode).');
  // Post startup message if configured
  if (defaultChannel) {
    try {
      await app.client.chat.postMessage({ channel: defaultChannel, text: 'Moltbot Slack bot starting up…' });
    } catch {}
  }
  // Auto-join public channels
  await autoJoinPublicChannels();
}

main().catch((err) => { console.error(err); process.exit(1); });
