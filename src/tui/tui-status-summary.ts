import { formatAge } from "../infra/channel-summary.js";
import { formatTokenCount } from "../utils/usage-format.js";
import { formatContextUsageLine } from "./tui-formatters.js";
import type { GatewayStatusSummary } from "./tui-types.js";

export function formatStatusSummary(summary: GatewayStatusSummary) {
  const lines: string[] = [];
  lines.push("网关状态");

  if (!summary.linkChannel) {
    lines.push("链接通道: 未知");
  } else {
    const linkLabel = summary.linkChannel.label ?? "链接通道";
    const linked = summary.linkChannel.linked === true;
    const authAge =
      linked && typeof summary.linkChannel.authAgeMs === "number"
        ? ` (上次刷新 ${formatAge(summary.linkChannel.authAgeMs)})`
        : "";
    lines.push(`${linkLabel}: ${linked ? "已连接" : "未连接"}${authAge}`);
  }

  const providerSummary = Array.isArray(summary.providerSummary) ? summary.providerSummary : [];
  if (providerSummary.length > 0) {
    lines.push("");
    lines.push("系统:");
    for (const line of providerSummary) {
      lines.push(`  ${line}`);
    }
  }

  const heartbeatAgents = summary.heartbeat?.agents ?? [];
  if (heartbeatAgents.length > 0) {
    const heartbeatParts = heartbeatAgents.map((agent) => {
      const agentId = agent.agentId ?? "unknown";
      if (!agent.enabled || !agent.everyMs) return `已禁用 (${agentId})`;
      return `${agent.every ?? "unknown"} (${agentId})`;
    });
    lines.push("");
    lines.push(`心跳: ${heartbeatParts.join(", ")}`);
  }

  const sessionPaths = summary.sessions?.paths ?? [];
  if (sessionPaths.length === 1) {
    lines.push(`会话存储: ${sessionPaths[0]}`);
  } else if (sessionPaths.length > 1) {
    lines.push(`会话存储数量: ${sessionPaths.length}`);
  }

  const defaults = summary.sessions?.defaults;
  const defaultModel = defaults?.model ?? "unknown";
  const defaultCtx =
    typeof defaults?.contextTokens === "number"
      ? ` (${formatTokenCount(defaults.contextTokens)} ctx)`
      : "";
  lines.push(`默认模型: ${defaultModel}${defaultCtx}`);

  const sessionCount = summary.sessions?.count ?? 0;
  lines.push(`活跃会话: ${sessionCount}`);

  const recent = Array.isArray(summary.sessions?.recent) ? summary.sessions?.recent : [];
  if (recent.length > 0) {
    lines.push("最近会话:");
    for (const entry of recent) {
      const ageLabel = typeof entry.age === "number" ? formatAge(entry.age) : "无活动";
      const model = entry.model ?? "unknown";
      const usage = formatContextUsageLine({
        total: entry.totalTokens ?? null,
        context: entry.contextTokens ?? null,
        remaining: entry.remainingTokens ?? null,
        percent: entry.percentUsed ?? null,
      });
      const flags = entry.flags?.length ? ` | flags: ${entry.flags.join(", ")}` : "";
      lines.push(
        `- ${entry.key}${entry.kind ? ` [${entry.kind}]` : ""} | ${ageLabel} | model ${model} | ${usage}${flags}`,
      );
    }
  }

  const queued = Array.isArray(summary.queuedSystemEvents) ? summary.queuedSystemEvents : [];
  if (queued.length > 0) {
    const preview = queued.slice(0, 3).join(" | ");
    lines.push(`队列中的系统事件 (${queued.length}): ${preview}`);
  }

  return lines;
}
