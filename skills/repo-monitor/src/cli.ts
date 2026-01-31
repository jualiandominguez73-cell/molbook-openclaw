#!/usr/bin/env bun
/**
 * Repo Monitor V2 - CLI Entry Point
 * 
 * Usage:
 *   bun src/cli.ts monitor [repo]           # Run full monitor report
 *   bun src/cli.ts monitor [repo] --json    # Output as JSON
 *   bun src/cli.ts quick-wins [repo]        # Show only quick wins
 *   bun src/cli.ts vitals [repo]            # Show only vital signs
 */

import { parseArgs } from "util";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

import { getConfig } from "./config.js";
import { loadState, saveState } from "./state.js";
import { getDateHoursAgo } from "./utils.js";
import type { MonitorReport, MonitorState } from "./types.js";

// Modules
import { getVitalSigns } from "./modules/vital-signs.js";
import { getHotZones } from "./modules/hot-zones.js";
import { getContributorPulse, updateKnownContributors } from "./modules/contributor-pulse.js";
import { getInterventionOpportunities } from "./modules/conversations.js";
import { getQuickWins } from "./modules/quick-wins.js";
import { getAttentionItems } from "./modules/attention.js";
import { getHighlights } from "./modules/highlights.js";

// Formatter
import { formatTelegram, formatMarkdown } from "./formatter.js";

// ============================================================================
// Helpers
// ============================================================================

function generateSuggestedAction(report: MonitorReport): MonitorReport["suggestedAction"] {
  // Priority 1: High-score quick win with solution (easiest to contribute)
  const quickWinWithSolution = report.quickWins.find(qw => 
    qw.signals.some(s => s.includes("solution"))
  );
  if (quickWinWithSolution) {
    return {
      action: `Submit PR for #${quickWinWithSolution.number}`,
      target: quickWinWithSolution.url,
      reason: `High ROI (${quickWinWithSolution.score}pts) - solution already proposed`,
    };
  }
  
  // Priority 2: Any quick win (good contribution opportunity)
  if (report.quickWins.length > 0) {
    const qw = report.quickWins[0];
    return {
      action: `Work on #${qw.number}`,
      target: qw.url,
      reason: `Top quick win (${qw.score}pts) - high impact bug with community interest`,
    };
  }
  
  // Priority 3: PRs needing review (help move things forward)
  const awaitingReview = report.interventions.find(i => i.type === "awaiting-review");
  if (awaitingReview) {
    return {
      action: `Review PR #${awaitingReview.number}`,
      target: awaitingReview.url,
      reason: "Help get this merged - " + awaitingReview.reason,
    };
  }
  
  // Priority 4: Issue needing help
  const needsHelp = report.interventions.find(i => i.type === "needs-response");
  if (needsHelp) {
    return {
      action: `Help with #${needsHelp.number}`,
      target: needsHelp.url,
      reason: needsHelp.reason + " - could use reproduction or workaround",
    };
  }
  
  return null;
}

/**
 * Generate a clean timestamp for filenames (YYYYMMDD-HHmmss)
 */
function getFilenameTimestamp(): string {
  const now = new Date();
  return now.toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
}

// ============================================================================
// Commands
// ============================================================================

async function runMonitor(repo: string, options: { json?: boolean; hours?: number }) {
  const config = getConfig({ repo, intervalHours: options.hours });
  const state = loadState(config.stateFile);
  
  const windowHours = config.intervalHours;
  const since = getDateHoursAgo(windowHours);
  const sinceDate = since.split("T")[0];
  
  console.error(`🔍 Analyzing ${repo} (last ${windowHours}h)...`);
  
  // Run all modules in parallel where possible
  const [vitalSigns, hotZones, contributorPulse, interventions, quickWins, attentionNeeded] = 
    await Promise.all([
      getVitalSigns(repo, sinceDate, windowHours, state),
      getHotZones(repo, sinceDate),
      getContributorPulse(repo, sinceDate, state),
      getInterventionOpportunities(repo),
      getQuickWins(repo, 5),
      getAttentionItems(repo),
    ]);
  
  // Highlights depend on other modules
  const highlights = await getHighlights(repo, vitalSigns, contributorPulse, state);
  
  // Build report
  const report: MonitorReport = {
    timestamp: new Date().toISOString(),
    repo,
    vitalSigns,
    hotZones,
    contributorPulse,
    interventions,
    quickWins,
    attentionNeeded,
    highlights,
    suggestedAction: null,
  };
  
  // Generate suggested action
  report.suggestedAction = generateSuggestedAction(report);
  
  // Update and save state
  const newState: MonitorState = {
    lastRunAt: report.timestamp,
    lastOpenPRs: vitalSigns.prs.openNow,
    lastOpenIssues: vitalSigns.issues.openNow,
    totalLinksPosted: state.totalLinksPosted,
    knownContributors: updateKnownContributors(state.knownContributors, contributorPulse),
    lastHighlights: highlights.map(h => h.message),
  };
  saveState(config.stateFile, newState);
  
  // Output
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  
  // Save markdown report
  mkdirSync(config.reportsDir, { recursive: true });
  const reportFilename = `report-${getFilenameTimestamp()}.md`;
  const reportPath = resolve(config.reportsDir, reportFilename);
  const markdownReport = formatMarkdown(report);
  writeFileSync(reportPath, markdownReport);
  
  // Output telegram format
  const telegramOutput = formatTelegram(report, reportPath);
  console.log(telegramOutput);
}

async function runQuickWins(repo: string) {
  console.error(`🎯 Finding quick wins in ${repo}...`);
  
  const quickWins = await getQuickWins(repo, 10);
  
  console.log(`\n🎯 QUICK WINS - ${repo}\n`);
  console.log("Score | #     | Title                                    | Signals");
  console.log("------+-------+------------------------------------------+------------------");
  
  for (const qw of quickWins) {
    const num = `#${qw.number}`.padEnd(5);
    const title = qw.title.slice(0, 40).padEnd(40);
    const signals = qw.signals.slice(0, 2).join(", ");
    console.log(`  ${qw.score.toString().padStart(2)}  | ${num} | ${title} | ${signals}`);
  }
  
  console.log("");
  console.log(`💡 For deeper analysis: bun issue-prioritizer analyze ${repo}`);
}

async function runVitals(repo: string, hours: number) {
  const config = getConfig({ repo, intervalHours: hours });
  const state = loadState(config.stateFile);
  const since = getDateHoursAgo(hours).split("T")[0];
  
  console.error(`📈 Getting vital signs for ${repo} (last ${hours}h)...`);
  
  const vitals = await getVitalSigns(repo, since, hours, state);
  
  console.log(`\n📈 VITAL SIGNS - ${repo} (${hours}h)\n`);
  console.log(`PRs:    +${vitals.prs.created} created | -${vitals.prs.closed} closed | ✅${vitals.prs.merged} merged`);
  console.log(`        Open: ${vitals.prs.openNow} (${vitals.prs.netDelta >= 0 ? "+" : ""}${vitals.prs.netDelta})`);
  console.log(`Issues: +${vitals.issues.created} created | -${vitals.issues.closed} closed`);
  console.log(`        Open: ${vitals.issues.openNow} (${vitals.issues.netDelta >= 0 ? "+" : ""}${vitals.issues.netDelta})`);
  console.log(`\nMerge Rate: ${vitals.mergeRate}%`);
  console.log(`Health: ${vitals.health}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: "boolean", default: false },
      hours: { type: "string", short: "h", default: "4" },
      help: { type: "boolean", default: false },
    },
  });
  
  if (values.help || positionals.length === 0) {
    console.log(`
Repo Monitor V2 - Intelligent Repository Monitoring

Usage:
  bun src/cli.ts <command> [repo] [options]

Commands:
  monitor [repo]     Full monitor report (default: openclaw/openclaw)
  quick-wins [repo]  Show only quick wins
  vitals [repo]      Show only vital signs

Options:
  --json             Output as JSON (monitor only)
  -h, --hours <n>    Time window in hours (default: 4)
  --help             Show this help

Examples:
  bun src/cli.ts monitor
  bun src/cli.ts monitor anthropics/claude-code --hours 24
  bun src/cli.ts quick-wins facebook/react
  bun src/cli.ts vitals --hours 12
`);
    process.exit(0);
  }
  
  const command = positionals[0];
  const repo = positionals[1] ?? "openclaw/openclaw";
  const hours = parseInt(values.hours ?? "4", 10);
  
  try {
    switch (command) {
      case "monitor":
        await runMonitor(repo, { json: values.json, hours });
        break;
      case "quick-wins":
      case "quickwins":
        await runQuickWins(repo);
        break;
      case "vitals":
      case "vital-signs":
        await runVitals(repo, hours);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
