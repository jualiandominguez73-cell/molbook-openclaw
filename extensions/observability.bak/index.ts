import * as http from "node:http";
import { onAgentEvent } from "../../dist/infra/agent-events.js";

// ============================================
// PURE REALTIME OBSERVABILITY
// No database - events stream directly to browser
// ============================================

type SSEClient = { res: http.ServerResponse; id: number };
const clients = new Set<SSEClient>();
let clientId = 0;
let httpServer: http.Server | null = null;
let eventSeq = 0;

// Keep last 100 events in memory for new clients
const recentEvents: Array<{ id: number; ts: number; runId: string; stream: string; agentId: string; sessionKey?: string; preview: string }> = [];

function extractPreview(data: Record<string, unknown>): string {
  if (data.name && data.phase) {
    if (data.phase === "start") {
      const args = data.args ? JSON.stringify(data.args).slice(0, 60) : "";
      return `🔧 ${data.name}: ${args}`;
    }
    if (data.phase === "result") return `✅ ${data.name}`;
    if (data.phase === "update") {
      const content = (data.partialResult as any)?.content;
      if (content?.[0]?.text) return content[0].text.slice(0, 80);
      return `⏳ ${data.name}`;
    }
  }
  if (typeof data.thinking === "string") return data.thinking.slice(0, 80);
  if (typeof data.text === "string") return data.text.slice(0, 80);
  if (data.role) return `[${data.role}]`;
  return "";
}

function broadcast(event: typeof recentEvents[0]) {
  const payload = `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    try { client.res.write(payload); } catch { clients.delete(client); }
  }
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <title>🔭 Observatory</title>
  <style>
    :root{--bg:#0a0e14;--card:#111827;--border:rgba(255,255,255,0.08);--text:#f0f4ff;--muted:#64748b;--blue:#6387ff;--green:#34d399;--amber:#fbbf24;--red:#ef4444}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;min-height:100dvh}
    .header{padding:12px 16px;background:linear-gradient(180deg,rgba(99,135,255,0.08) 0%,transparent 100%);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:100;backdrop-filter:blur(10px)}
    .logo{font-size:18px;font-weight:700}
    .dot{width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
    .dot.off{background:var(--red);animation:none}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    .stats{margin-left:auto;font-size:12px;color:var(--muted);display:flex;gap:16px}
    .stat b{color:var(--text)}
    .events{padding:8px;padding-bottom:env(safe-area-inset-bottom,8px)}
    .ev{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px}
    .ev.new{animation:pop .3s ease}
    @keyframes pop{from{transform:scale(0.95);opacity:0}}
    .ev-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
    .agent{font-weight:600;font-size:14px}
    .stream{font-size:10px;padding:2px 6px;border-radius:4px;background:var(--border);text-transform:uppercase}
    .stream.tool{background:rgba(251,191,36,0.15);color:var(--amber)}
    .stream.assistant{background:rgba(52,211,153,0.1);color:var(--green)}
    .stream.lifecycle{background:rgba(99,135,255,0.1);color:var(--blue)}
    .stream.error{background:rgba(239,68,68,0.15);color:var(--red)}
    .time{font-size:10px;color:var(--muted);margin-left:auto}
    .preview{font-size:13px;color:var(--muted);line-height:1.5;word-break:break-word}
    .empty{text-align:center;padding:80px 20px;color:var(--muted)}
    .empty-icon{font-size:64px;margin-bottom:16px;opacity:0.3}
    @media(min-width:600px){.events{max-width:700px;margin:0 auto;padding:16px}}
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🔭 Observatory</div>
    <div class="dot" id="dot"></div>
    <div class="stats">
      <div class="stat"><b id="cnt">0</b> events</div>
      <div class="stat"><b id="cli">0</b> clients</div>
    </div>
  </div>
  <div class="events" id="events"><div class="empty"><div class="empty-icon">⚡</div>Waiting for events...</div></div>
  <script>
    const E={kev:'🦈',rex:'🦖',atlas:'🗺️',forge:'🛠️',hawk:'🦅',pixel:'🎨',blaze:'🔥',echo:'🦜',chase:'🎯',ally:'🤝',scout:'🔍',dash:'📊',finn:'💰',dot:'🐝',law:'⚖️'};
    const evts=[];let conn=false;
    const t=ts=>new Date(ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const h=s=>String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    function r(){
      document.getElementById('cnt').textContent=evts.length;
      document.getElementById('dot').className='dot'+(conn?'':' off');
      if(!evts.length){document.getElementById('events').innerHTML='<div class="empty"><div class="empty-icon">⚡</div>Waiting for events...</div>';return}
      document.getElementById('events').innerHTML=evts.slice(0,100).map((e,i)=>\`<div class="ev\${e.n?' new':''}"><div class="ev-head"><span class="agent">\${E[e.agentId]||'🤖'} \${h(e.agentId)}</span><span class="stream \${e.stream}">\${e.stream}</span><span class="time">\${t(e.ts)}</span></div><div class="preview">\${h(e.preview)}</div></div>\`).join('');
    }
    function go(){
      const es=new EventSource('/sse');
      es.onopen=()=>{conn=true;r()};
      es.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.clients!==undefined){document.getElementById('cli').textContent=d.clients;return}if(!evts.find(x=>x.id===d.id)){d.n=1;evts.unshift(d);if(evts.length>500)evts.length=500;r();setTimeout(()=>{d.n=0},300)}}catch{}};
      es.onerror=()=>{conn=false;r();es.close();setTimeout(go,2000)};
    }
    go();r();
  </script>
</body>
</html>`;

function startServer(port: number, logger: { info?: (msg: string) => void }) {
  if (httpServer) return;
  
  httpServer = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(HTML);
      return;
    }
    
    if (url.pathname === "/sse") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      
      const client: SSEClient = { res, id: ++clientId };
      clients.add(client);
      
      // Send recent events
      for (const e of recentEvents) {
        res.write(`id: ${e.id}\ndata: ${JSON.stringify(e)}\n\n`);
      }
      
      // Send client count
      res.write(`data: ${JSON.stringify({ clients: clients.size })}\n\n`);
      
      // Broadcast updated client count to all
      for (const c of clients) {
        if (c !== client) {
          try { c.res.write(`data: ${JSON.stringify({ clients: clients.size })}\n\n`); } catch {}
        }
      }
      
      // Keep alive
      const ping = setInterval(() => {
        try { res.write(`: ping\n\n`); } catch { cleanup(); }
      }, 15000);
      
      const cleanup = () => {
        clearInterval(ping);
        clients.delete(client);
        // Broadcast updated count
        for (const c of clients) {
          try { c.res.write(`data: ${JSON.stringify({ clients: clients.size })}\n\n`); } catch {}
        }
      };
      
      req.on("close", cleanup);
      return;
    }
    
    res.writeHead(404);
    res.end("Not found");
  });
  
  httpServer.listen(port, "0.0.0.0", () => {
    logger.info?.(`observability: live dashboard at http://0.0.0.0:${port}`);
  });
}

let subscribed = false;

export default function (api: {
  pluginConfig?: { webPort?: number };
  logger: { info?: (msg: string) => void; warn?: (msg: string) => void };
  registerGatewayMethod: (name: string, handler: (ctx: { params?: Record<string, unknown>; respond: (ok: boolean, data: unknown) => void }) => void) => void;
}) {
  const port = typeof api.pluginConfig?.webPort === "number" ? api.pluginConfig.webPort : 4789;
  
  if (!subscribed) {
    subscribed = true;
    
    onAgentEvent((evt) => {
      const parts = (evt.sessionKey || "").split(":");
      const event = {
        id: ++eventSeq,
        ts: evt.ts,
        runId: evt.runId,
        stream: evt.stream,
        agentId: parts[1] || "unknown",
        sessionKey: evt.sessionKey,
        preview: extractPreview((evt.data ?? {}) as Record<string, unknown>),
      };
      
      // Keep in memory
      recentEvents.unshift(event);
      if (recentEvents.length > 100) recentEvents.pop();
      
      // Broadcast to all clients
      broadcast(event);
    });
    
    api.logger.info?.("observability: subscribed to agent events");
  }
  
  startServer(port, api.logger);
  
  // Simple RPC for stats
  api.registerGatewayMethod("observability.status", ({ respond }) => {
    respond(true, { 
      clients: clients.size, 
      recentEvents: recentEvents.length,
      lastEventId: eventSeq,
    });
  });
}
