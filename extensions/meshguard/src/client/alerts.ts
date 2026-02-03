/**
 * MeshGuard Alert System
 *
 * Sends alerts for policy violations via Telegram and other channels.
 */

import type { AuditEvent, AlertSeverity } from "../types.js";

export interface AlertOptions {
  telegram?: {
    botToken: string;
    chatId: number;
  };
  webhook?: string;
}

export class AlertManager {
  private options: AlertOptions;
  private agentId: string;

  constructor(agentId: string, options: AlertOptions) {
    this.agentId = agentId;
    this.options = options;
  }

  /**
   * Send an alert for a policy violation
   */
  async alert(event: AuditEvent): Promise<void> {
    const severity = event.decision.alertSeverity || "warning";
    const message = this.formatMessage(event, severity);

    // Send to Telegram
    if (this.options.telegram) {
      await this.sendTelegram(message, severity);
    }

    // Send to webhook
    if (this.options.webhook) {
      await this.sendWebhook(event);
    }
  }

  /**
   * Format alert message
   */
  private formatMessage(event: AuditEvent, severity: AlertSeverity): string {
    const emoji = {
      info: "ℹ️",
      warning: "⚠️",
      critical: "🚨",
    }[severity];

    const effectEmoji = event.decision.effect === "deny" ? "🚫" : "✅";

    let message = `${emoji} **MeshGuard Alert**\n\n`;
    message += `**Agent:** ${event.agentId}\n`;
    message += `**Tool:** ${event.tool}\n`;
    message += `**Decision:** ${effectEmoji} ${event.decision.effect.toUpperCase()}\n`;

    if (event.decision.matchedRule) {
      message += `**Rule:** ${event.decision.matchedRule}\n`;
    }

    if (event.decision.reason) {
      message += `**Reason:** ${event.decision.reason}\n`;
    }

    // Add source context
    if (event.source.username) {
      message += `**Triggered by:** @${event.source.username}\n`;
    }
    if (event.source.chatId) {
      message += `**Chat ID:** ${event.source.chatId}\n`;
    }

    // Add truncated args for context
    const argsStr = JSON.stringify(event.args);
    if (argsStr.length > 200) {
      message += `**Args:** ${argsStr.substring(0, 200)}...\n`;
    } else {
      message += `**Args:** ${argsStr}\n`;
    }

    message += `\n_${new Date(event.timestamp).toISOString()}_`;

    return message;
  }

  /**
   * Send alert via Telegram
   */
  private async sendTelegram(message: string, severity: AlertSeverity): Promise<void> {
    const { botToken, chatId } = this.options.telegram!;

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
          disable_notification: severity === "info",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[meshguard] Telegram alert failed:", error);
      }
    } catch (error) {
      console.error("[meshguard] Telegram alert error:", error);
    }
  }

  /**
   * Send alert via webhook
   */
  private async sendWebhook(event: AuditEvent): Promise<void> {
    try {
      const response = await fetch(this.options.webhook!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "meshguard.alert",
          event,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        console.error("[meshguard] Webhook alert failed:", response.status);
      }
    } catch (error) {
      console.error("[meshguard] Webhook alert error:", error);
    }
  }
}
