/**
 * SHARPS EDGE Builder Edition - OpenClaw Extension Plugin
 *
 * Transforms OpenClaw from a general-purpose assistant into a disciplined
 * autonomous builder agent governed by the Nine Laws.
 *
 * Hooks:
 *  - before_agent_start: Injects project charter + build status + tasks
 *  - before_tool_call: Runs 6 conflict detection checks (can block)
 *  - after_tool_call: Cost tracking + audit logging
 *  - message_received: Audit logging
 *  - session_start/end: Session lifecycle
 *  - gateway_stop: Persist cost state
 *
 * Tools:
 *  - get_odds: Fetch lines from The Odds API (quota-aware, cached)
 *  - get_weather: Game-time weather + impact scoring
 *  - get_injuries: ESPN injury reports with role-player edge signals
 *  - get_social: Locker room / chemistry intel from public sources
 *  - check_edge: Combined edge analysis (8 models)
 *  - track_pick: Record picks for CLV tracking
 *  - review_accuracy: Recursive learning engine (9 analytics actions)
 *  - get_situational: Scheduling spots + travel + rest analysis
 *  - calibrate: Probability calibration engine (trust engine)
 *
 * CLI:
 *  - openclaw sharps status|tasks|costs|logs|conflicts
 *
 * Chat commands:
 *  - /sharps-status (bypasses LLM)
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

import { registerAuditLogger } from "./src/audit-logger.js";
import { registerCharterLoader } from "./src/charter-loader.js";
import { registerSharpsEdgeCli } from "./src/cli/register.js";
import { registerConflictDetector } from "./src/conflict-detector.js";
import { registerCostTracker } from "./src/cost-tracker.js";
import { createSeverityRouter } from "./src/severity-router.js";
import { createCheckEdgeTool } from "./src/tools/check-edge.js";
import { createGetInjuriesTool } from "./src/tools/get-injuries.js";
import { createCalibrateTool } from "./src/tools/calibrate.js";
import { createGetOddsTool } from "./src/tools/get-odds.js";
import { createGetSituationalTool } from "./src/tools/situational.js";
import { createGetSocialTool } from "./src/tools/get-social.js";
import { createGetWeatherTool } from "./src/tools/get-weather.js";
import { createReviewAccuracyTool } from "./src/tools/review-accuracy.js";
import { createTrackPickTool } from "./src/tools/track-pick.js";
import type { SharpsEdgeConfig } from "./src/types.js";

const sharpsEdgePlugin = {
  id: "sharps-edge",
  name: "SHARPS EDGE Builder Edition",
  description:
    "Autonomous sports betting intelligence builder with edge detection tools, " +
    "recursive learning, conflict detection, cost tracking, and audit logging. " +
    "Governed by the Nine Laws.",

  register(api: OpenClawPluginApi) {
    const cfg = (api.pluginConfig ?? {}) as SharpsEdgeConfig;

    api.logger.info?.("sharps-edge: Initializing Builder Edition...");

    // --- Core infrastructure ---

    // 1. Audit logger (foundation - other components depend on it)
    const auditLogger = registerAuditLogger(api, cfg);

    // 2. Cost tracker (needs audit logger for alerts)
    const costTracker = registerCostTracker(api, cfg, auditLogger);

    // 3. Severity router (needs audit logger)
    const _severityRouter = createSeverityRouter(api, cfg, auditLogger);

    // 4. Charter context injection (before_agent_start)
    registerCharterLoader(api, cfg);

    // 5. Conflict detection (before_tool_call, needs audit logger + cost tracker)
    registerConflictDetector(
      api,
      cfg,
      auditLogger,
      () => costTracker.getBudgetRatio(),
    );

    // 6. CLI commands (needs cost tracker for budget display)
    registerSharpsEdgeCli(api, cfg, costTracker);

    // --- Handicapping tools ---

    // 7. Data collection tools
    api.registerTool(createGetOddsTool(costTracker));
    api.registerTool(createGetWeatherTool());
    api.registerTool(createGetInjuriesTool());
    api.registerTool(createGetSocialTool());

    // 8. Analysis engine
    api.registerTool(createCheckEdgeTool(costTracker));

    // 9. Recursive learning system
    api.registerTool(createTrackPickTool(api));
    api.registerTool(createReviewAccuracyTool(api));

    // 10. Transcendent layer (situational spots + probability calibration)
    api.registerTool(createGetSituationalTool());
    api.registerTool(createCalibrateTool(api));

    api.logger.info?.(
      "sharps-edge: Builder Edition ready. Nine Laws active. " +
        "9 handicapping tools registered. 8 edge models. Recursive learning enabled.",
    );
  },
};

export default sharpsEdgePlugin;
