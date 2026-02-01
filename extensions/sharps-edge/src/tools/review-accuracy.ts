/**
 * SHARPS EDGE - Review Accuracy Tool (Recursive Learning Engine)
 *
 * The brain of the system. Analyzes past picks to identify what's working
 * and what isn't. Generates model weight adjustments and stores lessons
 * that feed back into future analysis.
 *
 * Run weekly minimum. Every review makes the system smarter.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { Type } from "@sinclair/typebox";

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

export const ReviewAccuracySchema = Type.Object(
  {
    action: Type.Unsafe<
      | "weekly"
      | "model_performance"
      | "sport_breakdown"
      | "lessons"
      | "weights"
      | "calibration"
      | "regimes"
      | "compound"
      | "portfolio"
    >({
      type: "string",
      enum: [
        "weekly",
        "model_performance",
        "sport_breakdown",
        "lessons",
        "weights",
        "calibration",
        "regimes",
        "compound",
        "portfolio",
      ],
      description:
        "Action: 'weekly' full review, 'model_performance' per-model stats, " +
        "'sport_breakdown' by sport, 'lessons' view learned lessons, " +
        "'weights' view/suggest model weight adjustments, " +
        "'calibration' predicted vs actual by confidence bucket, " +
        "'regimes' detect model degradation signals, " +
        "'compound' analyze which factor combos produce best results, " +
        "'portfolio' correlated pick exposure analysis",
    }),
    period: Type.Optional(
      Type.String({
        description: "Period: 'week', 'month', 'all'. Default: week",
      }),
    ),
  },
  { additionalProperties: false },
);

type Pick = {
  id: string;
  timestamp: string;
  game: string;
  sport: string;
  pick_type: string;
  direction: string;
  line_at_pick: number;
  edge_score: number;
  models_fired: string[];
  reasoning: string;
  closing_line?: number;
  clv?: number;
  outcome?: "win" | "loss" | "push";
  actual_score?: string;
  resolved_at?: string;
};

type Lesson = {
  id: string;
  timestamp: string;
  category: string;
  lesson: string;
  evidence: string;
  suggested_action: string;
};

type WeightAdjustment = {
  model: string;
  current_weight: number;
  suggested_weight: number;
  reason: string;
  confidence: string;
};

export function createReviewAccuracyTool(api: OpenClawPluginApi) {
  const dataDir = api.resolvePath("~/.openclaw/workspace/data");
  const picksDir = path.join(dataDir, "picks");
  const lessonsDir = path.join(dataDir, "lessons");
  const weightsFile = path.join(dataDir, "model-weights.json");

  // Default model weights (Model 8 calibration has weight 0 - it's a post-processing step)
  const DEFAULT_WEIGHTS: Record<string, number> = {
    line_value: 6,
    reverse_line_movement: 8,
    weather_impact: 7,
    injury_context: 5,
    social_signals: 4,
    stale_line_detection: 9,
    situational_spots: 6,
  };

  const calibrationFile = path.join(dataDir, "calibration.json");

  return {
    name: "review_accuracy",
    label: "Review Accuracy",
    description:
      "Recursive learning engine. Analyzes past pick accuracy, CLV performance, " +
      "model effectiveness, probability calibration, regime detection, compound edges, " +
      "and portfolio correlation. Generates lessons learned and suggests model weight " +
      "adjustments. Run 'weekly' every Sunday. The system gets smarter with every review.",
    parameters: ReviewAccuracySchema,

    async execute(
      _toolCallId: string,
      params: Record<string, unknown>,
    ): Promise<{
      content: Array<{ type: string; text: string }>;
      details: unknown;
    }> {
      const action = params.action as string;
      const period = (params.period as string) ?? "week";

      try {
        await fs.mkdir(picksDir, { recursive: true });
        await fs.mkdir(lessonsDir, { recursive: true });

        const allPicks = await loadAllPicks(picksDir);
        const resolved = allPicks.filter((p) => p.outcome);
        const filtered = filterByPeriod(resolved, period);

        switch (action) {
          case "weekly": {
            if (filtered.length === 0) {
              return ok(
                { message: "No resolved picks in this period. Need more data." },
                "Weekly review - insufficient data",
              );
            }

            const wins = filtered.filter((p) => p.outcome === "win").length;
            const losses = filtered.filter((p) => p.outcome === "loss").length;
            const pushes = filtered.filter((p) => p.outcome === "push").length;
            const total = wins + losses; // Exclude pushes from win rate
            const winRate = total > 0 ? wins / total : 0;

            // CLV analysis
            const clvPicks = filtered.filter((p) => p.clv != null);
            const avgClv =
              clvPicks.length > 0
                ? clvPicks.reduce((s, p) => s + (p.clv ?? 0), 0) / clvPicks.length
                : 0;

            // Edge score calibration: did higher scores win more?
            const highEdge = filtered.filter((p) => p.edge_score >= 60);
            const lowEdge = filtered.filter((p) => p.edge_score < 60 && p.edge_score >= 30);
            const highWinRate =
              highEdge.length > 0
                ? highEdge.filter((p) => p.outcome === "win").length /
                  highEdge.filter((p) => p.outcome !== "push").length
                : 0;
            const lowWinRate =
              lowEdge.length > 0
                ? lowEdge.filter((p) => p.outcome === "win").length /
                  lowEdge.filter((p) => p.outcome !== "push").length
                : 0;

            // By pick type
            const byType = groupBy(filtered, "pick_type");
            const typeBreakdown = Object.entries(byType).map(([type, picks]) => {
              const w = picks.filter((p) => p.outcome === "win").length;
              const t = picks.filter((p) => p.outcome !== "push").length;
              return { type, picks: picks.length, win_rate: t > 0 ? (w / t * 100).toFixed(1) + "%" : "N/A" };
            });

            // Generate lessons
            const lessons: string[] = [];
            if (winRate < 0.524) {
              lessons.push("Win rate below breakeven (52.4%). Tighten edge score thresholds or reduce volume.");
            }
            if (winRate > 0.57) {
              lessons.push("Strong win rate. Consider increasing volume on high-confidence picks.");
            }
            if (avgClv < 0) {
              lessons.push("Negative average CLV. The market is correcting against us. Review model inputs.");
            }
            if (avgClv > 0.5) {
              lessons.push("Positive CLV. We're consistently finding value before the market. Keep it up.");
            }
            if (highEdge.length > 0 && highWinRate < lowWinRate) {
              lessons.push("High edge scores performing worse than low edge scores. Edge scoring is miscalibrated.");
            }
            if (filtered.length < 30) {
              lessons.push(`Sample size (${filtered.length}) too small for reliable conclusions. Need 30+ resolved picks.`);
            }

            // Save lessons
            await saveLessons(lessonsDir, lessons, period);

            const review = {
              period,
              total_picks: filtered.length,
              record: `${wins}-${losses}-${pushes}`,
              win_rate: `${(winRate * 100).toFixed(1)}%`,
              breakeven_target: "52.4%",
              above_breakeven: winRate > 0.524,
              avg_clv: avgClv.toFixed(3),
              clv_positive: avgClv > 0,
              edge_calibration: {
                high_edge_win_rate: highEdge.length > 0 ? `${(highWinRate * 100).toFixed(1)}%` : "N/A",
                low_edge_win_rate: lowEdge.length > 0 ? `${(lowWinRate * 100).toFixed(1)}%` : "N/A",
                calibrated: highWinRate >= lowWinRate,
              },
              by_type: typeBreakdown,
              lessons,
              next_actions:
                lessons.length > 0
                  ? "Review lessons above. Run 'weights' to see suggested model adjustments."
                  : "Performance on track. Continue current approach.",
            };

            return ok(review, `Weekly review: ${wins}-${losses}-${pushes}`);
          }

          case "model_performance": {
            // Which models contributed to winning picks?
            const modelStats: Record<
              string,
              { total: number; wins: number; losses: number }
            > = {};

            for (const pick of filtered) {
              for (const model of pick.models_fired) {
                if (!modelStats[model]) {
                  modelStats[model] = { total: 0, wins: 0, losses: 0 };
                }
                modelStats[model].total++;
                if (pick.outcome === "win") modelStats[model].wins++;
                if (pick.outcome === "loss") modelStats[model].losses++;
              }
            }

            const performance = Object.entries(modelStats)
              .map(([model, stats]) => ({
                model,
                ...stats,
                win_rate:
                  stats.total > 0
                    ? `${((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)}%`
                    : "N/A",
              }))
              .sort(
                (a, b) =>
                  b.wins / Math.max(b.wins + b.losses, 1) -
                  a.wins / Math.max(a.wins + a.losses, 1),
              );

            return ok(
              { period, resolved_picks: filtered.length, models: performance },
              "Model performance breakdown",
            );
          }

          case "sport_breakdown": {
            const bySport = groupBy(filtered, "sport");
            const breakdown = Object.entries(bySport).map(([sport, picks]) => {
              const w = picks.filter((p) => p.outcome === "win").length;
              const l = picks.filter((p) => p.outcome === "loss").length;
              const t = w + l;
              const clvPicks = picks.filter((p) => p.clv != null);
              const avgClv =
                clvPicks.length > 0
                  ? clvPicks.reduce((s, p) => s + (p.clv ?? 0), 0) / clvPicks.length
                  : 0;

              return {
                sport,
                picks: picks.length,
                record: `${w}-${l}`,
                win_rate: t > 0 ? `${((w / t) * 100).toFixed(1)}%` : "N/A",
                avg_clv: avgClv.toFixed(3),
              };
            });

            return ok({ period, breakdown }, "Performance by sport");
          }

          case "lessons": {
            const files = await fs.readdir(lessonsDir).catch(() => []);
            const allLessons: Lesson[] = [];

            for (const file of files.sort().reverse()) {
              if (!file.endsWith(".jsonl")) continue;
              const content = await fs.readFile(path.join(lessonsDir, file), "utf-8");
              for (const line of content.trim().split("\n")) {
                if (!line.trim()) continue;
                try {
                  allLessons.push(JSON.parse(line));
                } catch { /* skip */ }
              }
            }

            return ok(
              { total_lessons: allLessons.length, lessons: allLessons.slice(0, 50) },
              "Learned lessons",
            );
          }

          case "weights": {
            // Load current weights or defaults
            let currentWeights: Record<string, number>;
            try {
              const raw = await fs.readFile(weightsFile, "utf-8");
              currentWeights = JSON.parse(raw);
            } catch {
              currentWeights = { ...DEFAULT_WEIGHTS };
            }

            // Suggest adjustments based on model performance
            const adjustments: WeightAdjustment[] = [];
            const modelStats: Record<
              string,
              { wins: number; losses: number }
            > = {};

            for (const pick of filtered) {
              for (const model of pick.models_fired) {
                if (!modelStats[model]) modelStats[model] = { wins: 0, losses: 0 };
                if (pick.outcome === "win") modelStats[model].wins++;
                if (pick.outcome === "loss") modelStats[model].losses++;
              }
            }

            for (const [model, current] of Object.entries(currentWeights)) {
              const stats = modelStats[model];
              if (!stats || stats.wins + stats.losses < 5) {
                adjustments.push({
                  model,
                  current_weight: current,
                  suggested_weight: current,
                  reason: "Insufficient data (<5 picks). No adjustment.",
                  confidence: "low",
                });
                continue;
              }

              const winRate = stats.wins / (stats.wins + stats.losses);
              let suggested = current;
              let reason = "";

              // Max ±5% per review to avoid overcorrection
              if (winRate > 0.6) {
                suggested = Math.min(current + 0.5, 10);
                reason = `Win rate ${(winRate * 100).toFixed(0)}% > 60%. Increase weight.`;
              } else if (winRate < 0.45) {
                suggested = Math.max(current - 0.5, 1);
                reason = `Win rate ${(winRate * 100).toFixed(0)}% < 45%. Decrease weight.`;
              } else {
                reason = `Win rate ${(winRate * 100).toFixed(0)}% is acceptable. No change.`;
              }

              adjustments.push({
                model,
                current_weight: current,
                suggested_weight: suggested,
                reason,
                confidence: stats.wins + stats.losses >= 20 ? "high" : "medium",
              });
            }

            // Save updated weights if any changed
            const hasChanges = adjustments.some(
              (a) => a.current_weight !== a.suggested_weight,
            );

            if (hasChanges) {
              const newWeights: Record<string, number> = {};
              for (const adj of adjustments) {
                newWeights[adj.model] = adj.suggested_weight;
              }
              await fs.writeFile(weightsFile, JSON.stringify(newWeights, null, 2));
            }

            return ok(
              {
                period,
                changes_applied: hasChanges,
                adjustments,
                note: hasChanges
                  ? "Weights updated. Changes take effect on next check_edge call."
                  : "No weight changes needed this review cycle.",
              },
              "Model weight review",
            );
          }

          case "calibration": {
            // Probability calibration: predicted confidence vs actual win rate by bucket
            if (filtered.length < 20) {
              return ok(
                { message: "Need 20+ resolved picks for calibration analysis." },
                "Calibration - insufficient data",
              );
            }

            const BUCKETS = [
              { low: 30, high: 40 },
              { low: 40, high: 50 },
              { low: 50, high: 55 },
              { low: 55, high: 60 },
              { low: 60, high: 65 },
              { low: 65, high: 70 },
              { low: 70, high: 80 },
              { low: 80, high: 100 },
            ];

            const bucketResults = BUCKETS.map((b) => {
              const inBucket = filtered.filter(
                (p) => p.edge_score >= b.low && p.edge_score < b.high,
              );
              const decided = inBucket.filter((p) => p.outcome !== "push");
              const wins = decided.filter((p) => p.outcome === "win").length;
              const total = decided.length;
              const actualRate = total > 0 ? (wins / total) * 100 : 0;
              const midpoint = (b.low + b.high) / 2;
              const error = total >= 5 ? Math.abs(actualRate - midpoint) : 0;

              return {
                bucket: `${b.low}-${b.high}%`,
                picks: inBucket.length,
                decided: total,
                wins,
                predicted: midpoint,
                actual: total > 0 ? Number(actualRate.toFixed(1)) : null,
                error: total >= 5 ? Number(error.toFixed(1)) : null,
                assessment:
                  total < 5
                    ? "insufficient"
                    : error < 3
                      ? "calibrated"
                      : error < 5
                        ? "acceptable"
                        : actualRate > midpoint
                          ? "UNDERCONFIDENT"
                          : "OVERCONFIDENT",
              };
            });

            const withData = bucketResults.filter((b) => b.decided >= 5);
            const overallError =
              withData.length > 0
                ? withData.reduce((s, b) => s + (b.error ?? 0), 0) / withData.length
                : 0;

            const calLessons: string[] = [];
            for (const b of bucketResults) {
              if (b.assessment === "OVERCONFIDENT") {
                calLessons.push(
                  `${b.bucket}: Overconfident. Predicted ${b.predicted}%, actual ${b.actual}%. Customers seeing inflated numbers.`,
                );
              }
              if (b.assessment === "UNDERCONFIDENT") {
                calLessons.push(
                  `${b.bucket}: Underconfident. Predicted ${b.predicted}%, actual ${b.actual}%. Leaving edge on the table.`,
                );
              }
            }

            if (calLessons.length > 0) {
              await saveLessons(lessonsDir, calLessons, "calibration");
            }

            return ok(
              {
                period,
                total_picks: filtered.length,
                overall_error: Number(overallError.toFixed(2)),
                status:
                  overallError < 3
                    ? "calibrated"
                    : overallError < 5
                      ? "acceptable"
                      : overallError < 8
                        ? "needs_work"
                        : "miscalibrated",
                buckets: bucketResults,
                insights: calLessons.length > 0 ? calLessons : ["All buckets with sufficient data are well-calibrated."],
                next_action:
                  "Run `calibrate correct` to update correction factors based on this data.",
              },
              `Calibration analysis (error: ${overallError.toFixed(2)}%)`,
            );
          }

          case "regimes": {
            // Detect if current performance suggests model degradation
            if (filtered.length < 10) {
              return ok(
                { message: "Need 10+ resolved picks for regime analysis." },
                "Regime detection - insufficient data",
              );
            }

            // Sort by timestamp, analyze recent streaks
            const sorted = [...filtered].sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
            );

            // Rolling window: last 10 picks
            const recent10 = sorted.slice(-10);
            const recentWins = recent10.filter((p) => p.outcome === "win").length;
            const recentLosses = recent10.filter((p) => p.outcome === "loss").length;
            const recentWinRate = recentWins / (recentWins + recentLosses) || 0;

            // High-confidence misses (edge >= 60 that lost)
            const highConfMisses = sorted
              .filter((p) => p.edge_score >= 60 && p.outcome === "loss")
              .slice(-5);

            // Consecutive losses
            let maxStreak = 0;
            let currentStreak = 0;
            for (const p of sorted) {
              if (p.outcome === "loss") {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
              } else {
                currentStreak = 0;
              }
            }

            // CLV trend: are we getting worse?
            const clvPicks = sorted.filter((p) => p.clv != null);
            let clvTrend: "improving" | "stable" | "degrading" | "insufficient" = "insufficient";
            if (clvPicks.length >= 10) {
              const firstHalf = clvPicks.slice(0, Math.floor(clvPicks.length / 2));
              const secondHalf = clvPicks.slice(Math.floor(clvPicks.length / 2));
              const avgFirst = firstHalf.reduce((s, p) => s + (p.clv ?? 0), 0) / firstHalf.length;
              const avgSecond = secondHalf.reduce((s, p) => s + (p.clv ?? 0), 0) / secondHalf.length;
              clvTrend =
                avgSecond > avgFirst + 0.2
                  ? "improving"
                  : avgSecond < avgFirst - 0.2
                    ? "degrading"
                    : "stable";
            }

            // Regime signals
            const signals: string[] = [];
            let severity: "green" | "yellow" | "orange" | "red" = "green";

            if (recentWinRate < 0.4) {
              signals.push(`Recent 10: ${recentWins}-${recentLosses} (${(recentWinRate * 100).toFixed(0)}%). Below breakeven.`);
              severity = "yellow";
            }
            if (maxStreak >= 5) {
              signals.push(`Max losing streak: ${maxStreak}. Consider volume reduction.`);
              severity = severity === "green" ? "yellow" : "orange";
            }
            if (highConfMisses.length >= 3) {
              signals.push(
                `${highConfMisses.length} high-confidence (60+) losses recently. Edge scoring may be miscalibrated.`,
              );
              severity = "orange";
            }
            if (clvTrend === "degrading") {
              signals.push("CLV trend is degrading. Market may be adjusting to our patterns.");
              severity = "orange";
            }
            if (recentWinRate < 0.3 && maxStreak >= 5) {
              signals.push("REGIME ALERT: Multiple degradation signals. Recommend reduced volume or model review.");
              severity = "red";
            }

            if (signals.length === 0) {
              signals.push("No regime degradation detected. Models performing within expected parameters.");
            }

            // Save regime lessons
            if (severity !== "green") {
              await saveLessons(lessonsDir, signals, "regime_detection");
            }

            return ok(
              {
                period,
                total_picks: filtered.length,
                regime_status: severity,
                recent_10: `${recentWins}-${recentLosses}`,
                max_losing_streak: maxStreak,
                high_confidence_misses: highConfMisses.length,
                clv_trend: clvTrend,
                signals,
                recommended_action:
                  severity === "red"
                    ? "STOP: Reduce volume to zero until root cause identified."
                    : severity === "orange"
                      ? "CAUTION: Reduce volume 50%. Run calibration analysis."
                      : severity === "yellow"
                        ? "MONITOR: Continue but watch closely. Run weekly review."
                        : "CLEAR: Continue normal operations.",
              },
              `Regime detection: ${severity.toUpperCase()}`,
            );
          }

          case "compound": {
            // Which model combinations produce the best results?
            if (filtered.length < 20) {
              return ok(
                { message: "Need 20+ resolved picks for compound analysis." },
                "Compound analysis - insufficient data",
              );
            }

            // Track performance by model combination
            const combos: Record<string, { wins: number; losses: number; picks: string[] }> = {};

            for (const pick of filtered) {
              if (!pick.models_fired || pick.models_fired.length === 0) continue;
              // Create sorted key from model combination
              const key = [...pick.models_fired].sort().join("+");
              if (!combos[key]) combos[key] = { wins: 0, losses: 0, picks: [] };
              if (pick.outcome === "win") combos[key].wins++;
              if (pick.outcome === "loss") combos[key].losses++;
              combos[key].picks.push(pick.id);
            }

            // Also track pairwise model interactions
            const pairs: Record<string, { wins: number; losses: number }> = {};
            for (const pick of filtered) {
              if (!pick.models_fired || pick.outcome === "push") continue;
              for (let i = 0; i < pick.models_fired.length; i++) {
                for (let j = i + 1; j < pick.models_fired.length; j++) {
                  const key = [pick.models_fired[i], pick.models_fired[j]].sort().join("+");
                  if (!pairs[key]) pairs[key] = { wins: 0, losses: 0 };
                  if (pick.outcome === "win") pairs[key].wins++;
                  if (pick.outcome === "loss") pairs[key].losses++;
                }
              }
            }

            // Sort by win rate (min 3 picks)
            const comboResults = Object.entries(combos)
              .filter(([, v]) => v.wins + v.losses >= 3)
              .map(([combo, stats]) => ({
                models: combo,
                total: stats.wins + stats.losses,
                wins: stats.wins,
                win_rate: `${((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)}%`,
              }))
              .sort((a, b) => b.wins / b.total - a.wins / a.total);

            const pairResults = Object.entries(pairs)
              .filter(([, v]) => v.wins + v.losses >= 5)
              .map(([pair, stats]) => ({
                pair,
                total: stats.wins + stats.losses,
                wins: stats.wins,
                win_rate: `${((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)}%`,
              }))
              .sort((a, b) => b.wins / b.total - a.wins / a.total);

            const compoundLessons: string[] = [];
            if (comboResults.length > 0) {
              const best = comboResults[0];
              compoundLessons.push(
                `Best combo: ${best.models} (${best.win_rate} on ${best.total} picks). Lean into this combination.`,
              );
            }
            if (comboResults.length > 1) {
              const worst = comboResults[comboResults.length - 1];
              if (worst.wins / worst.total < 0.5) {
                compoundLessons.push(
                  `Worst combo: ${worst.models} (${worst.win_rate} on ${worst.total} picks). Reduce confidence when these models fire together.`,
                );
              }
            }

            if (compoundLessons.length > 0) {
              await saveLessons(lessonsDir, compoundLessons, "compound_analysis");
            }

            return ok(
              {
                period,
                total_picks: filtered.length,
                best_combinations: comboResults.slice(0, 10),
                best_pairs: pairResults.slice(0, 10),
                insights: compoundLessons.length > 0 ? compoundLessons : ["Insufficient data for compound insights."],
              },
              "Compound model analysis",
            );
          }

          case "portfolio": {
            // Correlated pick exposure analysis
            if (filtered.length < 10) {
              return ok(
                { message: "Need 10+ picks for portfolio analysis." },
                "Portfolio analysis - insufficient data",
              );
            }

            // Group recent picks by date to find same-day correlated exposure
            const byDate: Record<string, Pick[]> = {};
            for (const pick of filtered) {
              const date = pick.timestamp.slice(0, 10);
              if (!byDate[date]) byDate[date] = [];
              byDate[date].push(pick);
            }

            // Find days with multiple picks
            const multiPickDays = Object.entries(byDate)
              .filter(([, picks]) => picks.length >= 2)
              .map(([date, picks]) => {
                // Check for correlated directions (e.g., all unders = weather correlation)
                const directions = picks.map((p) => p.direction);
                const allUnder = directions.every((d) => d === "under");
                const allOver = directions.every((d) => d === "over");
                const allSameSide = directions.every((d) => d === directions[0]);

                // Check for same sport (sport-specific model failure = correlated risk)
                const sports = new Set(picks.map((p) => p.sport));
                const singleSport = sports.size === 1;

                // Check for common models (same model driving all = single point of failure)
                const modelSets = picks.map((p) => new Set(p.models_fired ?? []));
                const commonModels: string[] = [];
                if (modelSets.length > 0) {
                  for (const model of modelSets[0]) {
                    if (modelSets.every((s) => s.has(model))) {
                      commonModels.push(model);
                    }
                  }
                }

                const outcomes = picks.map((p) => p.outcome).filter(Boolean);
                const allWon = outcomes.every((o) => o === "win");
                const allLost = outcomes.every((o) => o === "loss");

                return {
                  date,
                  picks: picks.length,
                  sports: [...sports],
                  directions: [...new Set(directions)],
                  correlated: allUnder || allOver || allSameSide,
                  correlation_type: allUnder
                    ? "all_under"
                    : allOver
                      ? "all_over"
                      : singleSport
                        ? "single_sport"
                        : allSameSide
                          ? "same_direction"
                          : "diversified",
                  common_models: commonModels,
                  outcome_correlated: allWon || allLost,
                };
              });

            const correlatedDays = multiPickDays.filter((d) => d.correlated);

            // Diversification score
            const sportSet = new Set(filtered.map((p) => p.sport));
            const typeSet = new Set(filtered.map((p) => p.pick_type));
            const dirSet = new Set(filtered.map((p) => p.direction));
            const diversificationScore = Math.min(
              (sportSet.size / 4) * 33 + (typeSet.size / 3) * 33 + (dirSet.size / 4) * 34,
              100,
            );

            const portLessons: string[] = [];
            if (correlatedDays.length > 0) {
              const pct = ((correlatedDays.length / multiPickDays.length) * 100).toFixed(0);
              portLessons.push(
                `${pct}% of multi-pick days had correlated exposure. These aren't independent bets - they're single bets with multiplied risk.`,
              );
            }
            if (diversificationScore < 50) {
              portLessons.push(
                `Diversification score: ${diversificationScore.toFixed(0)}/100. Consider spreading across more sports, bet types, and directions.`,
              );
            }

            if (portLessons.length > 0) {
              await saveLessons(lessonsDir, portLessons, "portfolio_analysis");
            }

            return ok(
              {
                period,
                total_picks: filtered.length,
                sports: [...sportSet],
                pick_types: [...typeSet],
                directions: [...dirSet],
                diversification_score: Number(diversificationScore.toFixed(0)),
                multi_pick_days: multiPickDays.length,
                correlated_days: correlatedDays.length,
                day_details: multiPickDays.slice(0, 20),
                insights: portLessons.length > 0 ? portLessons : ["Portfolio diversification looks healthy."],
              },
              `Portfolio analysis (diversification: ${diversificationScore.toFixed(0)}/100)`,
            );
          }

          default:
            return err(
              `Unknown action '${action}'. Use: weekly, model_performance, sport_breakdown, lessons, weights, calibration, regimes, compound, portfolio`,
            );
        }
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  };
}

async function loadAllPicks(picksDir: string): Promise<Pick[]> {
  const files = await fs.readdir(picksDir).catch(() => []);
  const picks: Pick[] = [];

  for (const file of files.sort()) {
    if (!file.endsWith(".jsonl")) continue;
    const content = await fs.readFile(path.join(picksDir, file), "utf-8");
    for (const line of content.trim().split("\n")) {
      if (!line.trim()) continue;
      try {
        picks.push(JSON.parse(line));
      } catch { /* skip */ }
    }
  }

  return picks;
}

function filterByPeriod(picks: Pick[], period: string): Pick[] {
  const now = Date.now();
  const cutoff: Record<string, number> = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    all: Infinity,
  };

  const ms = cutoff[period] ?? cutoff.week;
  return picks.filter((p) => now - new Date(p.timestamp).getTime() < ms);
}

function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const k = String(item[key]);
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}

async function saveLessons(
  lessonsDir: string,
  lessons: string[],
  period: string,
): Promise<void> {
  if (lessons.length === 0) return;

  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(lessonsDir, `${date}.jsonl`);

  const entries = lessons.map((lesson) => ({
    id: `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    category: "weekly_review",
    lesson,
    evidence: `Based on ${period} performance data`,
    suggested_action: "Review and apply to edge scoring",
  }));

  const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await fs.appendFile(file, lines);
}

function ok(data: unknown, label: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ label, data }, null, 2) }],
    details: { label, data },
  };
}

function err(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    details: { error: message },
  };
}
