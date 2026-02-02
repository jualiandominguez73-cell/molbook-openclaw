#!/usr/bin/env node
// Simple SMTP send helper using Nodemailer
import nodemailer from 'nodemailer';
import { argv } from 'node:process';
import dotenv from 'dotenv';
import dns from 'node:dns';
// Prefer IPv4 to avoid IPv6 egress issues
try { dns.setDefaultResultOrder('ipv4first'); } catch {}
dotenv.config();

function parseArgs(args) {
  const out = {};
  for (let i = 2; i < args.length; i++) {
    const [k, ...rest] = args[i].split('=');
    out[k.replace(/^--/, '')] = rest.join('=');
  }
  return out;
}

async function main() {
  const parsed = parseArgs(argv);
  const subject = parsed.subject || '';
  const text = parsed.text || '';
  const html = parsed.html;
  const fallbackTo = process.env.SMTP_USER;
  const to = parsed.to || fallbackTo;
  if (!to) {
    console.error('Usage: node scripts/send-email.js --to=user@example.com --subject="..." --text="..." [--html="..."]');
    process.exit(2);
  }
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!user || !pass) {
    console.error('Missing SMTP_USER/SMTP_PASS in environment.');
    process.exit(3);
  }
  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  const info = await transporter.sendMail({ from, to, subject, text, html });
  console.log('Sent messageId:', info.messageId);
}

main().catch((err) => { console.error(err); process.exit(1); });
