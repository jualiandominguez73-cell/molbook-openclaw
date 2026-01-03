import { monitorTelegramProvider } from './src/telegram/monitor.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || process.argv[2];

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN not set");
  process.exit(1);
}

console.log("Starting Telegram bot with web search (editing messages)...");

monitorTelegramProvider({
  token,
  useWebhook: false,
}).then(() => {
  console.log("✅ Bot is running");
}).catch(err => {
  console.error("❌ Failed to start:", err);
  process.exit(1);
});
