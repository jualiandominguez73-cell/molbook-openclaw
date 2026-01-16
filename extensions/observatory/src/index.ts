/**
 * Observatory Plugin v2
 * Real-time agent event monitoring with rich UI
 * Feature parity with POC but using direct event hooks (no SQLite)
 */

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { WebSocketServer, WebSocket } from "ws";
import { onAgentEvent, getAgentRunContext } from "../../../dist/infra/agent-events.js";
import { CONFIG_DIR } from "../../../dist/utils.js";

// Types
interface AgentEvent {
  id: number;
  ts: number;
  runId: string;
  seq: number;
  stream: string;
  agentId: string;
  sessionKey?: string;
  preview: string;
  data?: Record<string, unknown>;
}

interface SessionMeta {
  id: string;
  agentId: string;
  path: string;
  startTs: number;
  updatedTs: number;
  messageCount: number;
  channel?: string;
  chatType?: string;
  lastTo?: string;
}

interface AgentStats {
  agentId: string;
  sessionCount: number;
  messageCount: number;
  lastActivity: number;
  totalCost: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
}

interface GlobalStats {
  totalAgents: number;
  totalSessions: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  totalToolCalls: number;
}

// State
const recentEvents: AgentEvent[] = [];
const wsClients = new Set<WebSocket>();
let eventId = 0;
let httpServer: http.Server | null = null;
let wsServer: WebSocketServer | null = null;
let subscribed = false;

// In-memory stats (updated from session scans)
let cachedStats: { global: GlobalStats; byAgent: AgentStats[] } | null = null;
let lastStatsScan = 0;
const STATS_CACHE_MS = 30000; // 30 second cache

// Helpers
function extractAgentId(sessionKey?: string): string {
  if (!sessionKey) return "unknown";
  const parts = sessionKey.split(":");
  return parts[1] || "unknown";
}

function extractChannel(sessionKey?: string): string {
  if (!sessionKey) return "other";
  const lower = sessionKey.toLowerCase();
  if (lower.includes("whatsapp")) return "whatsapp";
  if (lower.includes("slack")) return "slack";
  if (lower.includes("discord")) return "discord";
  if (lower.includes("telegram")) return "telegram";
  if (lower.includes("signal")) return "signal";
  return "other";
}

// Detect channel by reading session content
function detectChannelFromContent(filePath: string): { channel: string; chatType: string; lastTo: string } {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim()).slice(0, 20); // First 20 lines
    
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        
        // Check for channel in session init (newer versions)
        if (msg.type === "session" && msg.channel) {
          return { 
            channel: msg.channel, 
            chatType: msg.chatType || "direct",
            lastTo: msg.to || ""
          };
        }
        
        // Check message tool calls for provider hints
        if (msg.message?.content && Array.isArray(msg.message.content)) {
          for (const c of msg.message.content) {
            if (c.type === "toolCall" && c.name === "message" && c.arguments?.provider) {
              return {
                channel: c.arguments.provider,
                chatType: c.arguments.to?.includes("@g.us") ? "group" : "direct",
                lastTo: c.arguments.to || ""
              };
            }
          }
        }
        
        // Check user message content for patterns
        if (msg.message?.role === "user") {
          const text = JSON.stringify(msg.message.content || "");
          
          // WhatsApp patterns
          if (text.includes("@s.whatsapp.net") || text.includes("@g.us")) {
            return {
              channel: "whatsapp",
              chatType: text.includes("@g.us") ? "group" : "direct",
              lastTo: (text.match(/\+\d{10,15}/) || [""])[0]
            };
          }
          if (text.match(/\[WhatsApp\s+\+\d+/i)) {
            const phone = (text.match(/\+\d{10,15}/) || [""])[0];
            return { channel: "whatsapp", chatType: "direct", lastTo: phone };
          }
          
          // Slack patterns
          if (text.match(/\[Slack\s+[CU][A-Z0-9]+/i) || text.includes("slack.com")) {
            const id = (text.match(/[CU][A-Z0-9]{8,}/i) || [""])[0];
            return { 
              channel: "slack", 
              chatType: id.startsWith("C") ? "channel" : "direct",
              lastTo: id
            };
          }
          
          // Discord patterns  
          if (text.match(/\[Discord\s+\d+/i) || text.includes("discord")) {
            const id = (text.match(/\d{17,19}/) || [""])[0];
            return { channel: "discord", chatType: "direct", lastTo: id };
          }
          
          // Telegram patterns
          if (text.match(/\[Telegram/i)) {
            return { channel: "telegram", chatType: "direct", lastTo: "" };
          }
          
          // Signal patterns
          if (text.match(/\[Signal/i)) {
            return { channel: "signal", chatType: "direct", lastTo: "" };
          }
        }
      } catch { /* skip malformed line */ }
    }
  } catch { /* file read error */ }
  
  return { channel: "other", chatType: "direct", lastTo: "" };
}

function extractChatType(sessionKey?: string): string {
  if (!sessionKey) return "direct";
  const lower = sessionKey.toLowerCase();
  if (lower.includes("group") || lower.includes("@g.us")) return "group";
  if (lower.includes("channel") || lower.startsWith("c")) return "channel";
  if (lower.includes("thread")) return "thread";
  return "direct";
}

function extractTarget(sessionKey?: string): string {
  if (!sessionKey) return "";
  const parts = sessionKey.split(":");
  // Try to find the target identifier
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.startsWith("+")) return p; // Phone number
    if (p.includes("@")) return p; // WhatsApp JID
    if (p.match(/^[A-Z0-9]{8,}$/i)) return p; // Slack/Discord ID
  }
  return parts[parts.length - 1] || "";
}

function extractPreview(data: Record<string, unknown>): string {
  // Tool events
  if (data.name && data.phase) {
    const name = String(data.name);
    if (data.phase === "start") {
      const args = data.args ? JSON.stringify(data.args).slice(0, 80) : "";
      return `🔧 ${name}: ${args}`;
    }
    if (data.phase === "result") return `✅ ${name} completed`;
    if (data.phase === "update") {
      const result = data.partialResult as any;
      if (result?.content?.[0]?.text) {
        return result.content[0].text.slice(0, 100);
      }
      return `⏳ ${name} running...`;
    }
  }
  // Content
  if (typeof data.thinking === "string") return `💭 ${data.thinking.slice(0, 100)}`;
  if (typeof data.text === "string") return data.text.slice(0, 100);
  if (data.content) {
    if (typeof data.content === "string") return data.content.slice(0, 100);
    if (Array.isArray(data.content)) {
      for (const c of data.content as any[]) {
        if (c.text) return c.text.slice(0, 100);
        if (c.thinking) return `💭 ${c.thinking.slice(0, 100)}`;
      }
    }
  }
  if (data.role) return `[${data.role}]`;
  if (data.message) return `[message]`;
  return "";
}

function broadcast(event: AgentEvent) {
  const msg = JSON.stringify({ type: "event", event });
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(msg); } catch { /* ignore */ }
    }
  }
}

function broadcastStats() {
  const msg = JSON.stringify({ type: "stats", clients: wsClients.size, events: recentEvents.length });
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(msg); } catch { /* ignore */ }
    }
  }
}

// Scan session files and compute stats
async function scanStats(force = false): Promise<{ global: GlobalStats; byAgent: AgentStats[] }> {
  const now = Date.now();
  if (!force && cachedStats && (now - lastStatsScan) < STATS_CACHE_MS) {
    return cachedStats;
  }

  const agentsDir = path.join(CONFIG_DIR, "agents");
  const byAgent: Map<string, AgentStats> = new Map();
  let totalSessions = 0;
  let totalMessages = 0;
  let totalCost = 0;
  let totalToolCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    const agents = fs.readdirSync(agentsDir).filter(f => {
      const stat = fs.statSync(path.join(agentsDir, f));
      return stat.isDirectory();
    });

    for (const agentId of agents) {
      const sessionsDir = path.join(agentsDir, agentId, "sessions");
      if (!fs.existsSync(sessionsDir)) continue;

      const stats: AgentStats = {
        agentId,
        sessionCount: 0,
        messageCount: 0,
        lastActivity: 0,
        totalCost: 0,
        toolCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
      };

      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith(".jsonl"));
      stats.sessionCount = files.length;
      totalSessions += files.length;

      // Sample a few recent files for detailed stats
      const recentFiles = files
        .map(f => ({ name: f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 10);

      for (const { name, mtime } of recentFiles) {
        if (mtime > stats.lastActivity) stats.lastActivity = mtime;

        const filePath = path.join(sessionsDir, name);
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const lines = content.split("\n").filter(l => l.trim());
          stats.messageCount += lines.length;
          totalMessages += lines.length;

          // Parse each line for cost/tokens/tools
          for (const line of lines.slice(-100)) { // Last 100 messages per session
            try {
              const msg = JSON.parse(line);
              // Usage is nested under msg.message.usage
              const usage = msg.message?.usage;
              if (usage) {
                stats.inputTokens += usage.input || 0;
                stats.outputTokens += usage.output || 0;
                totalInputTokens += usage.input || 0;
                totalOutputTokens += usage.output || 0;
                // Cost is nested under usage.cost.total
                if (usage.cost?.total) {
                  stats.totalCost += usage.cost.total;
                  totalCost += usage.cost.total;
                }
              }
              // Count tool calls
              const content = msg.message?.content;
              if (Array.isArray(content)) {
                for (const c of content) {
                  if (c.type === "toolCall" || c.type === "tool_use") {
                    stats.toolCalls++;
                    totalToolCalls++;
                  }
                }
              }
            } catch { /* skip malformed */ }
          }
        } catch { /* skip unreadable */ }
      }

      byAgent.set(agentId, stats);
    }
  } catch { /* ignore errors */ }

  cachedStats = {
    global: {
      totalAgents: byAgent.size,
      totalSessions,
      totalMessages,
      totalInputTokens,
      totalOutputTokens,
      totalCost,
      totalToolCalls,
    },
    byAgent: Array.from(byAgent.values()).sort((a, b) => b.lastActivity - a.lastActivity),
  };
  lastStatsScan = now;
  return cachedStats;
}

// Load sessions from disk
async function listSessions(agentId?: string, channel?: string): Promise<SessionMeta[]> {
  const agentsDir = path.join(CONFIG_DIR, "agents");
  const sessions: SessionMeta[] = [];

  try {
    const agents = agentId ? [agentId] : fs.readdirSync(agentsDir).filter(f => {
      try { return fs.statSync(path.join(agentsDir, f)).isDirectory(); } catch { return false; }
    });

    for (const agent of agents) {
      const sessionsDir = path.join(agentsDir, agent, "sessions");
      if (!fs.existsSync(sessionsDir)) continue;

      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith(".jsonl"));
      for (const file of files) {
        const filePath = path.join(sessionsDir, file);
        const stat = fs.statSync(filePath);
        const sessionKey = file.replace(".jsonl", "");
        
        // Detect channel from session content
        const detected = detectChannelFromContent(filePath);

        if (channel && detected.channel !== channel) continue;

        sessions.push({
          id: sessionKey,
          agentId: agent,
          path: filePath,
          startTs: stat.birthtimeMs,
          updatedTs: stat.mtimeMs,
          messageCount: 0,
          channel: detected.channel,
          chatType: detected.chatType,
          lastTo: detected.lastTo,
        });
      }
    }
  } catch { /* ignore errors */ }

  return sessions.sort((a, b) => b.updatedTs - a.updatedTs);
}

async function readSession(sessionPath: string, limit = 500): Promise<any[]> {
  const messages: any[] = [];

  try {
    const content = fs.readFileSync(sessionPath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());
    
    for (const line of lines.slice(-limit)) {
      try {
        const parsed = JSON.parse(line);
        messages.push(parsed);
      } catch { /* skip malformed lines */ }
    }
  } catch { /* ignore errors */ }

  return messages;
}

// Parse message for UI rendering
function parseMessage(msg: any, idx: number): any {
  const usage = msg.message?.usage;
  const result: any = {
    idx,
    ts: msg.timestamp || msg.ts,
    role: msg.message?.role || msg.type || "system",
    model: msg.message?.model || msg.model,
    cost: usage?.cost?.total,
    inputTokens: usage?.input,
    outputTokens: usage?.output,
    preview: "",
    toolName: null,
    toolArgs: null,
    contentType: "text",
  };

  const content = msg.message?.content;
  if (typeof content === "string") {
    result.preview = content;
  } else if (Array.isArray(content)) {
    for (const c of content) {
      if (c.type === "text" && c.text) {
        result.preview = c.text;
        break;
      }
      if (c.type === "thinking" && c.thinking) {
        result.preview = c.thinking;
        result.contentType = "thinking";
        break;
      }
      if (c.type === "toolCall" || c.type === "tool_use") {
        result.toolName = c.name || c.toolName;
        result.toolArgs = JSON.stringify(c.args || c.input || {}, null, 2);
        result.contentType = "tool";
        break;
      }
      if (c.type === "toolResult" || c.type === "tool_result") {
        result.role = "toolResult";
        result.contentType = "toolResult";
        const content = c.content || c.result;
        if (typeof content === "string") result.preview = content.slice(0, 500);
        else if (Array.isArray(content) && content[0]?.text) result.preview = content[0].text.slice(0, 500);
        break;
      }
    }
  }

  return result;
}

// ============================================
// EMBEDDED WEB UI
// ============================================
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#06080f">
  <title>🔭 Observatory</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    :root{--bg:#06080f;--bg2:#0c1018;--card:#111827;--card2:#1a2332;--elevated:#1e293b;--border:rgba(255,255,255,0.06);--border-active:rgba(99,135,255,0.4);--text:#f8fafc;--text2:#94a3b8;--muted:#64748b;--blue:#6387ff;--green:#34d399;--amber:#fbbf24;--rose:#f472b6;--purple:#a78bfa}
    *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
    html{height:100%}
    body{font-family:-apple-system,SF Pro Text,system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;line-height:1.5;overflow:hidden}
    
    .app{display:grid;grid-template-rows:auto auto 1fr;height:100vh}
    
    .header{background:linear-gradient(180deg,rgba(99,135,255,0.06) 0%,transparent 100%);border-bottom:1px solid var(--border);padding:12px 20px;display:flex;justify-content:space-between;align-items:center}
    .logo{font-size:18px;font-weight:700;background:linear-gradient(135deg,var(--blue),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:flex;align-items:center;gap:8px}
    .logo-icon{font-size:22px;-webkit-text-fill-color:initial}
    .live-dot{display:inline-block;width:8px;height:8px;background:var(--green);border-radius:50%;margin-left:8px;animation:pulse 2s infinite}
    .live-dot.off{background:var(--rose);animation:none}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    .header-right{display:flex;gap:8px;align-items:center}
    .btn{padding:6px 12px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--card);color:var(--text2);transition:all 0.15s}
    .btn:hover{background:var(--card2);color:var(--text)}
    
    .stats-bar{background:var(--bg2);border-bottom:1px solid var(--border);padding:12px 20px;display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}
    .stats-bar::-webkit-scrollbar{display:none}
    .stat{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 16px;min-width:110px;flex-shrink:0}
    .stat-val{font-size:22px;font-weight:700;letter-spacing:-0.5px}
    .stat-val.blue{color:var(--blue)}.stat-val.green{color:var(--green)}.stat-val.amber{color:var(--amber)}.stat-val.purple{color:var(--purple)}.stat-val.rose{color:var(--rose)}
    .stat-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px}
    .stat-sub{font-size:9px;color:var(--muted);margin-top:2px}
    
    /* Mobile: tabs + single panel */
    .tabs{display:flex;gap:4px;padding:8px 12px;background:var(--bg2);border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none}
    .tabs::-webkit-scrollbar{display:none}
    .tab{padding:8px 14px;border-radius:8px;font-size:12px;font-weight:500;color:var(--muted);background:transparent;border:none;white-space:nowrap;cursor:pointer;transition:all 0.15s}
    .tab.active{background:var(--card);color:var(--text)}
    
    .content{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
    .panel{display:none;height:100%}
    .panel.active{display:flex;flex-direction:column}
    
    /* Desktop: 5-panel grid */
    @media(min-width:1024px){
      .tabs{display:none}
      .content{display:grid;grid-template-columns:180px 200px 260px 1fr 280px;overflow:hidden}
      .panel{display:flex!important;flex-direction:column;border-right:1px solid var(--border);overflow:hidden;background:var(--bg2)}
      .panel:last-child{border-right:none;background:var(--bg)}
      .panel.messages-panel{background:var(--bg)}
    }
    
    .panel-header{padding:12px 14px;border-bottom:1px solid var(--border);font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;display:flex;align-items:center;gap:6px;flex-shrink:0}
    .panel-count{font-size:9px;padding:2px 6px;border-radius:8px;background:var(--card)}
    .panel-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:6px}
    
    .item{padding:10px 12px;border-radius:8px;cursor:pointer;margin-bottom:4px;transition:all 0.12s}
    .item:hover{background:var(--card)}
    .item.active{background:linear-gradient(135deg,rgba(99,135,255,0.15),rgba(99,135,255,0.05));border:1px solid var(--border-active)}
    .item-row{display:flex;align-items:center;gap:8px}
    .item-icon{font-size:18px}
    .item-info{flex:1;min-width:0}
    .item-name{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .item-meta{font-size:10px;color:var(--muted);display:flex;gap:6px}
    .item-time{font-size:10px;color:var(--muted)}
    
    .chat-item{padding:10px 12px;border-radius:8px;cursor:pointer;margin-bottom:4px;background:var(--card);border:1px solid transparent;transition:all 0.12s}
    .chat-item:hover{background:var(--card2)}
    .chat-item.active{border-color:var(--border-active);background:linear-gradient(135deg,rgba(99,135,255,0.15),rgba(99,135,255,0.05))}
    .chat-head{display:flex;justify-content:space-between;align-items:start;margin-bottom:4px}
    .chat-type{font-size:9px;font-weight:600;text-transform:uppercase;padding:2px 6px;border-radius:4px;letter-spacing:0.3px}
    .chat-type.direct,.chat-type.dm{background:rgba(99,135,255,0.15);color:var(--blue)}
    .chat-type.group{background:rgba(52,211,153,0.15);color:var(--green)}
    .chat-type.channel{background:rgba(251,191,36,0.15);color:var(--amber)}
    .chat-type.thread{background:rgba(167,139,250,0.15);color:var(--purple)}
    .chat-name{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    
    .messages-panel .panel-header{background:var(--bg2)}
    .messages-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px}
    
    .filters{display:flex;gap:4px;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid var(--border)}
    .filter{padding:4px 8px;border-radius:5px;font-size:10px;cursor:pointer;border:1px solid var(--border);background:var(--card);color:var(--muted);transition:all 0.12s}
    .filter:hover{background:var(--card2);color:var(--text2)}
    .filter.on{background:var(--blue);border-color:var(--blue);color:#fff}
    .filter.on.green{background:var(--green);border-color:var(--green)}
    .filter.on.amber{background:var(--amber);border-color:var(--amber);color:#000}
    .filter.on.purple{background:var(--purple);border-color:var(--purple)}
    .filter.on.rose{background:var(--rose);border-color:var(--rose)}
    
    .msg{margin-bottom:16px;animation:slideIn 0.2s ease}
    @keyframes slideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    .msg-head{display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap}
    .msg-role{font-size:10px;font-weight:600;padding:3px 8px;border-radius:5px}
    .msg-role.user{background:rgba(99,135,255,0.12);color:var(--blue)}
    .msg-role.assistant{background:rgba(52,211,153,0.1);color:var(--green)}
    .msg-role.toolResult{background:rgba(251,191,36,0.1);color:var(--amber)}
    .msg-role.system{background:var(--card);color:var(--muted)}
    .msg-time{font-size:9px;color:var(--muted)}
    .msg-model{font-size:8px;padding:2px 5px;border-radius:3px;background:var(--card);color:var(--muted)}
    .msg-cost{font-size:9px;color:var(--green)}
    
    .msg-content{padding:12px 14px;border-radius:10px;font-size:12px;line-height:1.6}
    .msg-content.user{background:rgba(99,135,255,0.06);border-left:3px solid var(--blue)}
    .msg-content.assistant{background:rgba(52,211,153,0.04);border-left:3px solid var(--green)}
    .msg-content.toolResult{background:rgba(251,191,36,0.04);border-left:3px solid var(--amber)}
    
    .tool-card{background:var(--card);border:1px solid var(--border);border-radius:8px;margin-top:6px;overflow:hidden}
    .tool-head{padding:8px 12px;background:var(--elevated);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px}
    .tool-name{font-family:SF Mono,Monaco,monospace;font-size:11px;color:var(--amber);font-weight:600}
    .tool-args{padding:10px 12px;font-family:SF Mono,Monaco,monospace;font-size:10px;white-space:pre-wrap;word-break:break-all;max-height:150px;overflow:auto;color:var(--text2);background:rgba(0,0,0,0.2)}
    
    .thinking-card{background:rgba(167,139,250,0.06);border:1px solid rgba(167,139,250,0.12);border-radius:8px;padding:12px;margin:6px 0}
    .thinking-label{font-size:9px;font-weight:600;text-transform:uppercase;color:var(--purple);margin-bottom:6px;display:flex;align-items:center;gap:4px}
    
    .file-card{background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.12);border-radius:6px;padding:8px 12px;margin:6px 0;font-family:SF Mono,Monaco,monospace}
    .file-action{font-size:9px;color:var(--muted);margin-bottom:2px;display:flex;align-items:center;gap:4px}
    .file-path{font-size:11px;color:var(--green);font-weight:500;word-break:break-all}
    
    .handoff-card{background:linear-gradient(135deg,rgba(52,211,153,0.12),rgba(52,211,153,0.04));border:1px solid rgba(52,211,153,0.2);border-radius:8px;padding:12px;margin:8px 0;cursor:pointer;transition:all 0.15s}
    .handoff-card:hover{border-color:rgba(52,211,153,0.4);transform:translateY(-1px)}
    .handoff-label{font-size:9px;font-weight:600;text-transform:uppercase;color:var(--green);margin-bottom:4px;letter-spacing:0.5px}
    .handoff-target{font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px}
    .handoff-task{font-size:11px;color:var(--muted);margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    
    .md{font-size:12px;line-height:1.6}
    .md p{margin:4px 0}
    .md code{background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:3px;font-family:SF Mono,Monaco,monospace;font-size:11px}
    .md pre{background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;overflow-x:auto;margin:8px 0}
    .md pre code{background:none;padding:0}
    .md ul,.md ol{margin:4px 0;padding-left:18px}
    .md li{margin:2px 0}
    
    .collapsed{max-height:100px;overflow:hidden;position:relative}
    .collapsed::after{content:'';position:absolute;bottom:0;left:0;right:0;height:30px;background:linear-gradient(transparent,var(--bg));pointer-events:none}
    .expand-btn{background:var(--card);border:1px solid var(--border);color:var(--muted);padding:3px 10px;border-radius:5px;font-size:10px;cursor:pointer;margin-top:6px}
    .expand-btn:hover{color:var(--text2)}
    
    .empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--muted);text-align:center;padding:30px}
    .empty-icon{font-size:40px;margin-bottom:12px;opacity:0.3}
    .empty-text{font-size:13px}
    
    .event{padding:10px 12px;margin-bottom:4px;background:var(--card);border-radius:8px;cursor:pointer;transition:all 0.15s;border:1px solid transparent}
    .event:hover{background:var(--card2);border-color:var(--border)}
    .event.new{animation:highlight 2s ease-out}
    @keyframes highlight{from{background:rgba(99,135,255,0.2)}to{background:var(--card)}}
    
    .modal{position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:200;display:none;flex-direction:column;align-items:center;justify-content:center;padding:20px}
    .modal.open{display:flex}
    .modal-box{background:var(--card);border:1px solid var(--border);border-radius:14px;width:100%;max-width:700px;max-height:85vh;display:flex;flex-direction:column}
    .modal-head{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
    .modal-title{font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}
    .modal-close{background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;padding:4px}
    .modal-close:hover{color:var(--text)}
    .modal-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px}
    
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.12)}
  </style>
</head>
<body>
  <div class="app">
    <div class="header">
      <div class="logo"><span class="logo-icon">🔭</span>Observatory<span class="live-dot" id="dot"></span></div>
      <div class="header-right">
        <span id="clients" style="font-size:11px;color:var(--muted)">0 connected</span>
        <button class="btn" onclick="refresh()">↻</button>
      </div>
    </div>
    
    <div class="stats-bar" id="statsBar">
      <div class="stat"><div class="stat-val blue" id="sAgents">-</div><div class="stat-label">Agents</div></div>
      <div class="stat"><div class="stat-val" id="sSessions">-</div><div class="stat-label">Sessions</div></div>
      <div class="stat"><div class="stat-val" id="sMessages">-</div><div class="stat-label">Messages</div></div>
      <div class="stat"><div class="stat-val amber" id="sTokens">-</div><div class="stat-label">Tokens</div><div class="stat-sub" id="sTokensSub"></div></div>
      <div class="stat"><div class="stat-val green" id="sCost">-</div><div class="stat-label">Cost</div></div>
      <div class="stat"><div class="stat-val purple" id="sTools">-</div><div class="stat-label">Tool Calls</div></div>
    </div>
    
    <div class="tabs" id="tabs">
      <button class="tab active" data-tab="agents">🤖 Agents</button>
      <button class="tab" data-tab="channels">📡 Channels</button>
      <button class="tab" data-tab="chats">💬 Chats</button>
      <button class="tab" data-tab="messages">📨 Messages</button>
      <button class="tab" data-tab="live">⚡ Live</button>
    </div>
    
    <div class="content" id="content">
      <div class="panel active" id="panelAgents">
        <div class="panel-header">Agents <span class="panel-count" id="agentCount">0</span></div>
        <div class="panel-body" id="agentsList"></div>
      </div>
      <div class="panel" id="panelChannels">
        <div class="panel-header">Channels</div>
        <div class="panel-body" id="channelsList"><div class="empty"><div class="empty-icon">📡</div><div class="empty-text">Select an agent</div></div></div>
      </div>
      <div class="panel" id="panelChats">
        <div class="panel-header">Conversations <span class="panel-count" id="chatCount">0</span></div>
        <div class="panel-body" id="chatsList"><div class="empty"><div class="empty-icon">💬</div><div class="empty-text">Select a channel</div></div></div>
      </div>
      <div class="panel messages-panel" id="panelMessages">
        <div class="panel-header" id="msgHeader" style="display:none;">
          <span id="msgTitle">Messages</span>
        </div>
        <div class="filters" id="msgFilters" style="display:none;"></div>
        <div class="messages-body" id="msgList"><div class="empty"><div class="empty-icon">📨</div><div class="empty-text">Select a conversation</div></div></div>
      </div>
      <div class="panel" id="panelLive" style="background:var(--bg2)">
        <div class="panel-header">⚡ Live <span class="panel-count" id="liveCount">0</span></div>
        <div class="panel-body" id="liveList"></div>
      </div>
    </div>
  </div>
  
  <div class="modal" id="modal" onclick="if(event.target===this)closeModal()">
    <div class="modal-box" onclick="event.stopPropagation()">
      <div class="modal-head">
        <div class="modal-title" id="modalTitle">Details</div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
    </div>
  </div>

  <script>
    const EMOJIS={kev:'🦈',rex:'🦖',atlas:'🗺️',forge:'🛠️',hawk:'🦅',pixel:'🎨',blaze:'🔥',echo:'🦜',chase:'🎯',ally:'🤝',scout:'🔍',dash:'📊',finn:'💰',dot:'🐝',law:'⚖️',main:'🏠'};
    const CHANNELS={whatsapp:'📱',slack:'💼',discord:'🎮',telegram:'✈️',signal:'📶',other:'📋'};
    
    let ws=null,connected=false,activeTab='agents';
    const events=[],agents=[],sessions=[],chats=[];
    let selAgent=null,selChannel=null,selChat=null,allMsgs=[];
    const filters={user:true,assistant:true,tool:true,result:true,thinking:true,file:true,handoff:true};
    
    const $=id=>document.getElementById(id);
    const h=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const fmtNum=n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':String(n||0);
    const fmtCost=n=>'$'+(n||0).toFixed(2);
    const fmtTime=ts=>ts?new Date(ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
    const fmtTs=ts=>{if(!ts)return'';const d=new Date(ts),now=new Date(),diff=now-d;if(diff<60000)return'now';if(diff<3600000)return Math.floor(diff/60000)+'m';if(diff<86400000)return Math.floor(diff/3600000)+'h';return d.toLocaleDateString()};
    const renderMd=t=>{if(!t)return'';try{return marked.parse(t)}catch{return h(t)}};
    const api=async p=>{try{return await(await fetch(p)).json()}catch(e){return{ok:false,error:e.message}}};
    
    // Tabs (mobile)
    document.querySelectorAll('.tab').forEach(el=>{
      el.onclick=()=>{
        document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
        el.classList.add('active');
        activeTab=el.dataset.tab;
        document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
        $('panel'+activeTab.charAt(0).toUpperCase()+activeTab.slice(1)).classList.add('active');
      };
    });
    
    // Stats
    async function loadStats(){
      const d=await api('/api/stats');
      if(!d.ok)return;
      $('sAgents').textContent=d.global.totalAgents;
      $('sSessions').textContent=fmtNum(d.global.totalSessions);
      $('sMessages').textContent=fmtNum(d.global.totalMessages);
      const tokens=(d.global.totalInputTokens||0)+(d.global.totalOutputTokens||0);
      $('sTokens').textContent=fmtNum(tokens);
      $('sTokensSub').textContent=fmtNum(d.global.totalInputTokens||0)+' in / '+fmtNum(d.global.totalOutputTokens||0)+' out';
      $('sCost').textContent=fmtCost(d.global.totalCost);
      $('sTools').textContent=fmtNum(d.global.totalToolCalls);
      
      agents.length=0;
      agents.push(...(d.byAgent||[]));
      $('agentCount').textContent=agents.length;
      renderAgents();
    }
    
    function renderAgents(){
      $('agentsList').innerHTML=agents.map(a=>\`
        <div class="item\${selAgent===a.agentId?' active':''}" onclick="selectAgent('\${a.agentId}')">
          <div class="item-row">
            <span class="item-icon">\${EMOJIS[a.agentId]||'🤖'}</span>
            <div class="item-info">
              <div class="item-name">\${h(a.agentId)}</div>
              <div class="item-meta"><span>\${a.sessionCount} sessions</span><span style="color:var(--green)">\${fmtCost(a.totalCost)}</span></div>
            </div>
          </div>
        </div>
      \`).join('')||'<div class="empty"><div class="empty-icon">🤖</div><div class="empty-text">No agents found</div></div>';
    }
    
    async function selectAgent(agentId){
      selAgent=agentId;selChannel=null;selChat=null;
      renderAgents();
      await loadChannels();
      $('chatsList').innerHTML='<div class="empty"><div class="empty-icon">💬</div><div class="empty-text">Select a channel</div></div>';
      $('chatCount').textContent='0';
      hideMsgs();
      if(window.innerWidth<1024){document.querySelectorAll('.tab')[1].click()}
    }
    
    async function loadChannels(){
      if(!selAgent)return;
      const d=await api('/api/sessions?agentId='+encodeURIComponent(selAgent));
      if(!d.ok)return;
      sessions.length=0;
      sessions.push(...(d.sessions||[]));
      
      const chs={};
      for(const s of sessions){
        const ch=s.channel||'other';
        if(!chs[ch])chs[ch]={count:0};
        chs[ch].count++;
      }
      
      $('channelsList').innerHTML=Object.entries(chs).map(([ch,data])=>\`
        <div class="item\${selChannel===ch?' active':''}" onclick="selectChannel('\${ch}')">
          <div class="item-row">
            <span class="item-icon">\${CHANNELS[ch]||'📋'}</span>
            <div class="item-info">
              <div class="item-name">\${ch}</div>
              <div class="item-meta">\${data.count} conversations</div>
            </div>
          </div>
        </div>
      \`).join('')||'<div class="empty"><div class="empty-icon">📡</div><div class="empty-text">No channels</div></div>';
    }
    
    function selectChannel(ch){
      selChannel=ch;selChat=null;
      loadChannels();
      renderChats();
      hideMsgs();
      if(window.innerWidth<1024){document.querySelectorAll('.tab')[2].click()}
    }
    
    function renderChats(){
      const filtered=sessions.filter(s=>(s.channel||'other')===selChannel);
      $('chatCount').textContent=filtered.length;
      $('chatsList').innerHTML=filtered.slice(0,50).map(c=>\`
        <div class="chat-item\${selChat?.id===c.id?' active':''}" onclick='selectChat(\${JSON.stringify(c).replace(/'/g,"&#39;")})'>
          <div class="chat-head">
            <span class="chat-type \${c.chatType||'direct'}">\${c.chatType||'dm'}</span>
            <span class="item-time">\${fmtTs(c.updatedTs)}</span>
          </div>
          <div class="chat-name">\${h(formatTarget(c))}</div>
        </div>
      \`).join('')||'<div class="empty"><div class="empty-icon">💬</div><div class="empty-text">No conversations</div></div>';
    }
    
    function formatTarget(c){
      const t=c.lastTo||'';
      if(c.channel==='whatsapp'){
        if(t.includes('@g.us'))return'👥 Group '+t.split('@')[0].slice(-6);
        if(t.startsWith('+'))return t;
      }
      if(c.channel==='slack'){
        if(t.startsWith('C'))return'#'+t;
        if(t.includes(':'))return'🧵 Thread';
      }
      return t.slice(0,20)||c.id.slice(0,12);
    }
    
    async function selectChat(chat){
      selChat=chat;
      renderChats();
      await loadMessages();
      if(window.innerWidth<1024){document.querySelectorAll('.tab')[3].click()}
    }
    
    async function loadMessages(){
      if(!selChat?.id)return;
      const d=await api('/api/session?agentId='+encodeURIComponent(selChat.agentId)+'&id='+encodeURIComponent(selChat.id));
      if(!d.ok)return;
      allMsgs=[...(d.messages||[])].reverse();
      $('msgHeader').style.display='flex';
      $('msgTitle').innerHTML=\`\${EMOJIS[selChat.agentId]||'🤖'} \${selChat.agentId} <span style="font-weight:400;color:var(--muted);font-size:11px;">· \${allMsgs.length} events</span>\`;
      $('msgFilters').style.display='flex';
      renderFilters();
      renderMessages();
    }
    
    function hideMsgs(){
      $('msgHeader').style.display='none';
      $('msgFilters').style.display='none';
      $('msgList').innerHTML='<div class="empty"><div class="empty-icon">📨</div><div class="empty-text">Select a conversation</div></div>';
    }
    
    function renderFilters(){
      $('msgFilters').innerHTML=\`
        <button class="filter\${filters.user?' on':''}" onclick="toggleFilter('user')">👤 User</button>
        <button class="filter\${filters.assistant?' on green':''}" onclick="toggleFilter('assistant')">🤖 Asst</button>
        <button class="filter\${filters.tool?' on amber':''}" onclick="toggleFilter('tool')">🔧 Tools</button>
        <button class="filter\${filters.result?' on':''}" onclick="toggleFilter('result')">📋 Results</button>
        <button class="filter\${filters.thinking?' on purple':''}" onclick="toggleFilter('thinking')">💭 Think</button>
        <button class="filter\${filters.file?' on green':''}" onclick="toggleFilter('file')">📝 Files</button>
        <button class="filter\${filters.handoff?' on rose':''}" onclick="toggleFilter('handoff')">🚀 Handoffs</button>
      \`;
    }
    
    function toggleFilter(k){filters[k]=!filters[k];renderFilters();renderMessages()}
    
    function renderMessages(){
      const filtered=allMsgs.filter(m=>{
        if(m.role==='user'&&!filters.user)return false;
        if(m.role==='assistant'&&!m.toolName&&m.contentType!=='thinking'&&!filters.assistant)return false;
        if(m.toolName&&!['sessions_spawn','sessions_send','write','edit','read','Write','Edit','Read'].includes(m.toolName)&&!filters.tool)return false;
        if(m.role==='toolResult'&&!filters.result)return false;
        if(m.contentType==='thinking'&&!filters.thinking)return false;
        if(['write','edit','read','Write','Edit','Read'].includes(m.toolName)&&!filters.file)return false;
        if(['sessions_spawn','sessions_send'].includes(m.toolName)&&!filters.handoff)return false;
        return true;
      });
      
      $('msgList').innerHTML=filtered.map((m,i)=>renderMsg(m,i)).join('')||'<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No events match filters</div></div>';
    }
    
    function renderMsg(m,i){
      const rc=m.role==='toolResult'?'toolResult':m.role;
      let modelBadge=m.model?\`<span class="msg-model">\${m.model}</span>\`:'';
      let costBadge=m.cost?\`<span class="msg-cost">\${fmtCost(m.cost)}</span>\`:'';
      let content='';
      
      if(m.contentType==='thinking'&&m.preview&&!m.toolName){
        content=\`<div class="thinking-card"><div class="thinking-label">💭 Thinking</div><div class="md">\${renderMd(m.preview)}</div></div>\`;
      }else if(m.toolName==='sessions_spawn'||m.toolName==='sessions_send'){
        try{
          const a=JSON.parse(m.toolArgs||'{}');
          const target=a.agentId||a.sessionKey||a.label||'agent';
          content=\`<div class="handoff-card" onclick="openAgent('\${target}')"><div class="handoff-label">\${m.toolName==='sessions_spawn'?'🚀 Spawning Agent':'📨 Sending Message'}</div><div class="handoff-target">\${EMOJIS[target]||'🤖'} \${h(target)}</div>\${a.task||a.message?\`<div class="handoff-task">\${h((a.task||a.message).slice(0,200))}</div>\`:''}</div>\`;
        }catch{content=''}
      }else if(['write','edit','read','Write','Edit','Read'].includes(m.toolName)){
        try{
          const a=JSON.parse(m.toolArgs||'{}');
          const icon=m.toolName.toLowerCase()==='write'?'📝':m.toolName.toLowerCase()==='edit'?'✏️':'📄';
          content=\`<div class="file-card"><div class="file-action">\${icon} \${m.toolName.toUpperCase()}</div><div class="file-path">\${h(a.path||a.file_path||'')}</div></div>\`;
        }catch{content=''}
      }else if(m.toolName){
        let args=m.toolArgs||'';
        try{args=JSON.stringify(JSON.parse(args),null,2)}catch{}
        content=\`<div class="tool-card"><div class="tool-head"><span>🔧</span><span class="tool-name">\${h(m.toolName)}</span></div><div class="tool-args">\${h(args)}</div></div>\`;
      }else if(m.role==='toolResult'){
        const long=(m.preview||'').length>300;
        content=\`<div class="msg-content toolResult"><div class="\${long?'collapsed':''}" id="r-\${i}"><pre style="margin:0;white-space:pre-wrap;font-size:11px;">\${h(m.preview)}</pre></div>\${long?\`<button class="expand-btn" onclick="toggle('r-\${i}',this)">Show more</button>\`:''}</div>\`;
      }else if(m.role==='user'){
        content=\`<div class="msg-content user"><div class="md">\${renderMd(m.preview)}</div></div>\`;
      }else if(m.role==='assistant'){
        const long=(m.preview||'').length>400;
        content=\`<div class="msg-content assistant"><div class="\${long?'collapsed':''}" id="m-\${i}"><div class="md">\${renderMd(m.preview)}</div></div>\${long?\`<button class="expand-btn" onclick="toggle('m-\${i}',this)">Show more</button>\`:''}</div>\`;
      }else{
        content=\`<div class="msg-content" style="background:var(--card);border-left:3px solid var(--border)">\${h(m.preview||m.role)}</div>\`;
      }
      
      return\`<div class="msg"><div class="msg-head"><span class="msg-role \${rc}">\${h(m.role)}</span><span class="msg-time">\${fmtTime(m.ts)}</span>\${modelBadge}\${costBadge}</div>\${content}</div>\`;
    }
    
    function toggle(id,btn){
      const el=$(id);
      if(el.classList.contains('collapsed')){el.classList.remove('collapsed');btn.textContent='Show less'}
      else{el.classList.add('collapsed');btn.textContent='Show more'}
    }
    
    // Live events
    function renderLive(){
      $('liveCount').textContent=events.length;
      const sorted=[...events].sort((a,b)=>b.ts-a.ts);
      $('liveList').innerHTML=sorted.slice(0,50).map(e=>\`
        <div class="event\${e.isNew?' new':''}" onclick="showEvent(\${e.id})">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="font-size:14px">\${EMOJIS[e.agentId]||'🤖'}</span>
            <span style="font-weight:600;font-size:11px">\${h(e.agentId)}</span>
            <span style="font-size:9px;color:var(--muted);margin-left:auto">\${fmtTime(e.ts)}</span>
          </div>
          <div style="font-size:10px;color:var(--text2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">\${h(e.preview)}</div>
        </div>
      \`).join('')||'<div class="empty"><div class="empty-icon">⚡</div><div class="empty-text">Waiting for activity...</div></div>';
    }
    
    function showEvent(id){
      const e=events.find(ev=>ev.id===id);
      if(!e)return;
      $('modalTitle').innerHTML=\`\${EMOJIS[e.agentId]||'🤖'} \${h(e.agentId)} <span style="font-weight:400;color:var(--muted);font-size:12px">· \${fmtTime(e.ts)}</span>\`;
      $('modalBody').innerHTML=\`
        <div style="margin-bottom:12px">
          <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Stream</div>
          <code style="background:var(--elevated);padding:4px 8px;border-radius:4px">\${h(e.stream)}</code>
        </div>
        <div style="margin-bottom:12px">
          <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Preview</div>
          <div style="font-size:13px">\${h(e.preview)}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Data</div>
          <pre style="background:var(--elevated);padding:10px;border-radius:6px;font-size:10px;overflow:auto;max-height:300px">\${h(JSON.stringify(e.data,null,2))}</pre>
        </div>
      \`;
      $('modal').classList.add('open');
    }
    
    async function openAgent(agentId){
      $('modalTitle').innerHTML=\`\${EMOJIS[agentId]||'🤖'} \${agentId} — Recent Sessions\`;
      const d=await api('/api/sessions?agentId='+encodeURIComponent(agentId));
      if(!d.ok){$('modalBody').innerHTML='<p>Failed to load</p>';return}
      $('modalBody').innerHTML=(d.sessions||[]).slice(0,10).map(s=>\`
        <div class="chat-item" style="margin-bottom:8px" onclick="loadModalSession('\${agentId}','\${s.id}')">
          <div class="chat-head">
            <span class="chat-type \${s.chatType||'direct'}">\${s.channel||'other'}</span>
            <span class="item-time">\${fmtTs(s.updatedTs)}</span>
          </div>
          <div class="chat-name">\${h(s.lastTo||s.id.slice(0,20))}</div>
        </div>
      \`).join('')||'<p>No sessions</p>';
      $('modal').classList.add('open');
    }
    
    async function loadModalSession(agentId,id){
      const d=await api('/api/session?agentId='+encodeURIComponent(agentId)+'&id='+encodeURIComponent(id));
      if(!d.ok)return;
      $('modalTitle').innerHTML=\`\${EMOJIS[agentId]||'🤖'} \${agentId}\`;
      $('modalBody').innerHTML=(d.messages||[]).map((m,i)=>renderMsg(m,i)).join('');
    }
    
    function closeModal(){$('modal').classList.remove('open')}
    
    async function refresh(){
      await loadStats();
      if(selAgent)await loadChannels();
      if(selChannel)renderChats();
      if(selChat)await loadMessages();
    }
    
    // WebSocket
    function connect(){
      const proto=location.protocol==='https:'?'wss:':'ws:';
      ws=new WebSocket(proto+'//'+location.host+'/ws');
      
      ws.onopen=()=>{connected=true;$('dot').className='live-dot'};
      ws.onclose=()=>{connected=false;$('dot').className='live-dot off';setTimeout(connect,2000)};
      ws.onerror=()=>{ws.close()};
      
      ws.onmessage=e=>{
        try{
          const msg=JSON.parse(e.data);
          if(msg.type==='event'){
            msg.event.isNew=true;
            events.unshift(msg.event);
            if(events.length>200)events.length=200;
            renderLive();
            setTimeout(()=>{msg.event.isNew=false},2000);
          }else if(msg.type==='stats'){
            $('clients').textContent=msg.clients+' connected';
          }else if(msg.type==='history'){
            events.push(...(msg.events||[]));
            renderLive();
          }
        }catch{}
      };
    }
    
    // Init
    connect();
    loadStats();
    renderLive();
  </script>
</body>
</html>`;

function startServer(port: number, logger: { info?: (msg: string) => void }) {
  if (httpServer) return;

  httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");

    // Serve HTML
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(HTML);
      return;
    }

    // API: Stats
    if (url.pathname === "/api/stats") {
      const stats = await scanStats();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ...stats }));
      return;
    }

    // API: List sessions
    if (url.pathname === "/api/sessions") {
      const agentId = url.searchParams.get("agentId") || undefined;
      const channel = url.searchParams.get("channel") || undefined;
      const sessions = await listSessions(agentId, channel);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, sessions }));
      return;
    }

    // API: Read session
    if (url.pathname === "/api/session") {
      const agentId = url.searchParams.get("agentId");
      const id = url.searchParams.get("id");
      if (!agentId || !id) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "agentId and id required" }));
        return;
      }
      const sessionPath = path.join(CONFIG_DIR, "agents", agentId, "sessions", `${id}.jsonl`);
      const rawMessages = await readSession(sessionPath);
      const messages = rawMessages.map((m, i) => parseMessage(m, i));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, messages }));
      return;
    }

    // API: Recent events
    if (url.pathname === "/api/events") {
      const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50", 10));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, events: recentEvents.slice(0, limit) }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  // WebSocket server
  wsServer = new WebSocketServer({ server: httpServer, path: "/ws" });

  wsServer.on("connection", (ws) => {
    wsClients.add(ws);

    // Send recent events
    ws.send(JSON.stringify({ type: "history", events: recentEvents.slice(0, 50) }));

    // Broadcast stats
    broadcastStats();

    ws.on("close", () => {
      wsClients.delete(ws);
      broadcastStats();
    });

    ws.on("error", () => {
      wsClients.delete(ws);
    });
  });

  httpServer.on('error', (e: any) => {
    // Ignore EADDRINUSE in CLI
  });
  httpServer.listen(port, "0.0.0.0", () => {
    logger.info?.(`observatory: live at http://0.0.0.0:${port}`);
  });
}

// Plugin entry
export default function (api: {
  pluginConfig?: { port?: number };
  logger: { info?: (msg: string) => void; warn?: (msg: string) => void };
  registerGatewayMethod: (name: string, handler: (ctx: { params?: Record<string, unknown>; respond: (ok: boolean, data: unknown) => void }) => void) => void;
}) {
  // Only start observatory server if running in gateway mode
  if (!process.argv.includes('gateway')) {
    return;
  }

  const port = typeof api.pluginConfig?.port === "number" ? api.pluginConfig.port : 4789;

  if (!subscribed) {
    subscribed = true;

    onAgentEvent((evt) => {
      // Look up sessionKey from run context if not in event
      const runContext = getAgentRunContext(evt.runId);
      const sessionKey = evt.sessionKey || runContext?.sessionKey;
      
      const event: AgentEvent = {
        id: ++eventId,
        ts: evt.ts,
        runId: evt.runId,
        seq: evt.seq,
        stream: evt.stream,
        agentId: extractAgentId(sessionKey),
        sessionKey: sessionKey,
        preview: extractPreview((evt.data ?? {}) as Record<string, unknown>),
        data: evt.data as Record<string, unknown>,
      };

      recentEvents.unshift(event);
      if (recentEvents.length > 200) recentEvents.pop();

      broadcast(event);
    });

    api.logger.info?.("observatory: subscribed to agent events");
  }

  startServer(port, api.logger);

  // RPC methods
  api.registerGatewayMethod("observatory.status", ({ respond }) => {
    respond(true, { clients: wsClients.size, events: recentEvents.length });
  });

  api.registerGatewayMethod("observatory.stats", async ({ respond }) => {
    const stats = await scanStats();
    respond(true, stats);
  });

  api.registerGatewayMethod("observatory.sessions", async ({ params, respond }) => {
    const sessions = await listSessions(
      params?.agentId as string | undefined,
      params?.channel as string | undefined
    );
    respond(true, { sessions });
  });
}
