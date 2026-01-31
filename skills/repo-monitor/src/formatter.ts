/**
 * Repo Monitor V2 - Output Formatter
 * Generates Telegram-friendly text and Markdown reports
 */

import type { MonitorReport, InterventionOpportunity } from "./types.js";

const DIVIDER = "══════════════════════════════════════════════════════════════";
const THIN_DIVIDER = "──────────────────────────────────────────────────────────────";

/**
 * Format report for Telegram (plain text, no markdown tables)
 */
export function formatTelegram(report: MonitorReport, reportPath: string): string {
  const lines: string[] = [];
  const time = new Date(report.timestamp).toISOString().slice(11, 16) + " UTC";
  
  lines.push(DIVIDER);
  lines.push(`📊 Repo Monitor V2 - ${time} | ${report.repo}`);
  lines.push(DIVIDER);
  lines.push("");
  
  // === VITAL SIGNS ===
  const vs = report.vitalSigns;
  const healthIcon = vs.health === "healthy" ? "✅" : vs.health === "warning" ? "⚠️" : "🚨";
  const prDelta = vs.prs.netDelta >= 0 ? `+${vs.prs.netDelta}` : `${vs.prs.netDelta}`;
  const issueDelta = vs.issues.netDelta >= 0 ? `+${vs.issues.netDelta}` : `${vs.issues.netDelta}`;
  
  // Format window label (e.g., "30m" or "4.5h")
  const windowLabel = vs.windowHours < 1 
    ? `${Math.round(vs.windowHours * 60)}m` 
    : `${vs.windowHours.toFixed(1).replace(/\.0$/, "")}h`;
  const windowInfo = vs.windowSource === "since last run" 
    ? `last ${windowLabel}` 
    : `${windowLabel} window`;
  
  lines.push(`📈 VITAL SIGNS (${windowInfo})`);
  lines.push(`• PRs: +${vs.prs.created} created | -${vs.prs.closed} closed | ✅${vs.prs.merged} merged`);
  lines.push(`• Issues: +${vs.issues.created} created | -${vs.issues.closed} closed`);
  lines.push(`• Merge Rate: ${vs.mergeRate}% ${vs.mergeRate < 15 ? "⚠️" : ""}`);
  lines.push(`• Net Change: ${prDelta} PRs | ${issueDelta} Issues`);
  lines.push(`• Backlog: ${vs.prs.openNow} PRs | ${vs.issues.openNow} Issues`);
  lines.push(`• Status: ${healthIcon} ${vs.health}`);
  lines.push("");
  
  // === HOT ZONES ===
  if (report.hotZones.length > 0) {
    lines.push(`🔥 HOT ZONES`);
    const zones = report.hotZones.slice(0, 5).map(z => `${z.label} (${z.count})`).join(" • ");
    lines.push(`• ${zones}`);
    lines.push("");
  }
  
  // === CONTRIBUTOR PULSE ===
  const cp = report.contributorPulse;
  if (cp.top.length > 0 || cp.newcomers.length > 0) {
    lines.push(`👥 CONTRIBUTOR PULSE`);
    if (cp.top.length > 0) {
      const topStr = cp.top.slice(0, 3).map(c => `@${c.login} (${c.activity})`).join(" ");
      lines.push(`• Top: ${topStr}`);
    }
    if (cp.newcomers.length > 0) {
      const newStr = cp.newcomers.map(c => `@${c.login}${c.firstPR ? " (first PR!)" : ""}`).join(", ");
      lines.push(`• 🆕 Newcomers: ${newStr}`);
    }
    lines.push("");
  }
  
  // === CONTRIBUTION OPPORTUNITIES ===
  if (report.interventions.length > 0) {
    lines.push(`💬 WAYS TO HELP`);
    for (const int of report.interventions.slice(0, 4)) {
      const icon = getInterventionIcon(int.type);
      lines.push(`${icon} #${int.number} - ${int.title}`);
      lines.push(`   └ ${int.reason} → ${int.suggestedAction}`);
    }
    lines.push("");
  }
  
  // === QUICK WINS ===
  if (report.quickWins.length > 0) {
    lines.push(`🎯 QUICK WINS (auto-detected)`);
    for (const qw of report.quickWins.slice(0, 4)) {
      const signals = qw.signals.slice(0, 3).join(" ");
      lines.push(`• #${qw.number} (${qw.score}pts) - ${qw.title}`);
      lines.push(`   └ ${signals}`);
    }
    lines.push("");
  }
  
  // === ATTENTION NEEDED ===
  if (report.attentionNeeded.length > 0) {
    lines.push(`⚠️ ATTENTION NEEDED`);
    for (const item of report.attentionNeeded.slice(0, 3)) {
      const icon = item.type === "stale-pr" ? "🧟" : "📦";
      lines.push(`${icon} #${item.number} - ${item.title}`);
      lines.push(`   └ ${item.reason} (@${item.author})`);
    }
    lines.push("");
  }
  
  // === HIGHLIGHTS ===
  if (report.highlights.length > 0) {
    lines.push(`🌟 HIGHLIGHTS`);
    for (const h of report.highlights.slice(0, 4)) {
      lines.push(`${h.icon} ${h.message}`);
    }
    lines.push("");
  }
  
  lines.push(THIN_DIVIDER);
  
  // === SUGGESTED ACTION ===
  if (report.suggestedAction) {
    lines.push(`🎯 SUGGESTED ACTION: ${report.suggestedAction.action}`);
    lines.push(`Why: ${report.suggestedAction.reason}`);
    lines.push("");
  }
  
  // === ISSUE PRIORITIZER HINT ===
  lines.push(`💡 For deeper analysis: "run issue-prioritizer on ${report.repo}"`);
  lines.push("");
  
  lines.push(DIVIDER);
  
  return lines.join("\n");
}

/**
 * Format full Markdown report for file output
 */
export function formatMarkdown(report: MonitorReport): string {
  const lines: string[] = [];
  const time = new Date(report.timestamp).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  
  lines.push(`# 📊 Repo Monitor Report`);
  lines.push("");
  lines.push(`**Repository:** ${report.repo}`);
  lines.push(`**Generated:** ${time}`);
  lines.push(`**Window:** ${report.vitalSigns.windowHours}h`);
  lines.push("");
  
  // === VITAL SIGNS ===
  lines.push(`## 📈 Vital Signs`);
  lines.push("");
  const vs = report.vitalSigns;
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| PRs Created | ${vs.prs.created} |`);
  lines.push(`| PRs Closed | ${vs.prs.closed} |`);
  lines.push(`| PRs Merged | ${vs.prs.merged} |`);
  lines.push(`| Open PRs | ${vs.prs.openNow} (${vs.prs.netDelta >= 0 ? "+" : ""}${vs.prs.netDelta}) |`);
  lines.push(`| Issues Created | ${vs.issues.created} |`);
  lines.push(`| Issues Closed | ${vs.issues.closed} |`);
  lines.push(`| Open Issues | ${vs.issues.openNow} (${vs.issues.netDelta >= 0 ? "+" : ""}${vs.issues.netDelta}) |`);
  lines.push(`| Merge Rate | ${vs.mergeRate}% |`);
  lines.push(`| Health | ${vs.health} |`);
  lines.push("");
  
  // === HOT ZONES ===
  if (report.hotZones.length > 0) {
    lines.push(`## 🔥 Hot Zones`);
    lines.push("");
    lines.push(`| Label | Count | Trend |`);
    lines.push(`|-------|-------|-------|`);
    for (const z of report.hotZones) {
      lines.push(`| ${z.label} | ${z.count} | ${z.trend} |`);
    }
    lines.push("");
  }
  
  // === CONTRIBUTOR PULSE ===
  lines.push(`## 👥 Contributor Pulse`);
  lines.push("");
  if (report.contributorPulse.top.length > 0) {
    lines.push(`### Top Contributors`);
    for (const c of report.contributorPulse.top) {
      lines.push(`- **@${c.login}** - ${c.activity} activities`);
    }
    lines.push("");
  }
  if (report.contributorPulse.newcomers.length > 0) {
    lines.push(`### 🆕 Newcomers`);
    for (const c of report.contributorPulse.newcomers) {
      lines.push(`- @${c.login}${c.firstPR ? " ⭐ First PR!" : ""}`);
    }
    lines.push("");
  }
  
  // === CONTRIBUTION OPPORTUNITIES ===
  if (report.interventions.length > 0) {
    lines.push(`## 💬 Ways to Help`);
    lines.push("");
    for (const int of report.interventions) {
      const icon = getInterventionIcon(int.type);
      lines.push(`### ${icon} #${int.number} - ${int.title}`);
      lines.push(`- **Type:** ${int.type}`);
      lines.push(`- **Reason:** ${int.reason}`);
      lines.push(`- **Age:** ${int.age}`);
      lines.push(`- **Priority:** ${int.priority}`);
      lines.push(`- **Action:** ${int.suggestedAction}`);
      lines.push(`- **Link:** ${int.url}`);
      lines.push("");
    }
  }
  
  // === QUICK WINS ===
  if (report.quickWins.length > 0) {
    lines.push(`## 🎯 Quick Wins`);
    lines.push("");
    lines.push(`| # | Score | Title | Signals | Level |`);
    lines.push(`|---|-------|-------|---------|-------|`);
    for (const qw of report.quickWins) {
      const signals = qw.signals.slice(0, 3).join(", ");
      lines.push(`| [#${qw.number}](${qw.url}) | ${qw.score} | ${qw.title} | ${signals} | ${qw.suggestedLevel} |`);
    }
    lines.push("");
  }
  
  // === ATTENTION NEEDED ===
  if (report.attentionNeeded.length > 0) {
    lines.push(`## ⚠️ Attention Needed`);
    lines.push("");
    for (const item of report.attentionNeeded) {
      lines.push(`### #${item.number} - ${item.title}`);
      lines.push(`- **Type:** ${item.type}`);
      lines.push(`- **Reason:** ${item.reason}`);
      lines.push(`- **Stale:** ${item.staleDays} days`);
      lines.push(`- **Author:** @${item.author}`);
      lines.push(`- **Link:** ${item.url}`);
      lines.push("");
    }
  }
  
  // === HIGHLIGHTS ===
  if (report.highlights.length > 0) {
    lines.push(`## 🌟 Highlights`);
    lines.push("");
    for (const h of report.highlights) {
      lines.push(`- ${h.icon} ${h.message}`);
    }
    lines.push("");
  }
  
  // === SUGGESTED ACTION ===
  if (report.suggestedAction) {
    lines.push(`## 🎯 Suggested Action`);
    lines.push("");
    lines.push(`**${report.suggestedAction.action}**`);
    lines.push(`- Target: ${report.suggestedAction.target}`);
    lines.push(`- Reason: ${report.suggestedAction.reason}`);
    lines.push("");
  }
  
  // === FOOTER ===
  lines.push(`---`);
  lines.push(`*Generated by Repo Monitor V2*`);
  lines.push(`*For deeper analysis, run: \`bun issue-prioritizer analyze ${report.repo}\`*`);
  
  return lines.join("\n");
}

function getInterventionIcon(type: InterventionOpportunity["type"]): string {
  switch (type) {
    case "needs-response": return "📢";
    case "active-discussion": return "🔥";
    case "awaiting-review": return "⏳";
    case "has-solution": return "💡";
    case "stuck": return "🔒";
    default: return "•";
  }
}
