# EDGE MODELS - Analytical Framework

## Overview

Each endpoint applies a series of edge detection models to raw data. This
document defines what those models do, what signals they look for, and how
they combine into a final edge score.

## Data Sources → Signal Pipeline

```
The Odds API (500/mo)     → Lines from multiple books → Line comparison engine
ESPN Public Endpoints      → Injuries, lineups, stats  → Context engine
Open-Meteo                → Wind, rain, temp, humidity → Weather impact engine
                                    ↓
                          Edge Detection Models
                                    ↓
                     Confidence-weighted edge score
```

## Model 1: Reverse Line Movement (RLM)

**Signal**: Public betting % on one side, line moving the other direction.

**Logic**:
- If >70% of public bets are on Team A, but the line moves toward Team B,
  sharp money is on Team B.
- Confidence scales with the gap: 80% public / line moves 1.5 pts = strong signal.

**Data needed**: Public betting % (derived from line movement patterns across books),
opening vs current lines from multiple books.

**Weight**: High for sides, moderate for totals.

## Model 2: Stale Line Detection

**Signal**: One or more books haven't adjusted after a significant event.

**Logic**:
- Monitor injury reports, weather changes, lineup announcements via ESPN.
- Compare current lines across all books from The Odds API.
- If Book A has moved 2+ points but Book B hasn't, Book B is stale.
- Time-decay: staleness confidence drops rapidly (5min = high, 30min = low).

**Data needed**: Multi-book lines (The Odds API), event timeline (ESPN), timestamps.

**Weight**: Very high when detected (short window, high confidence).

## Model 3: Weather Impact

**Signal**: Outdoor games where weather conditions favor under/over or a specific side.

**Logic**:
- **Wind >15mph**: Favors under in football. Impacts passing game.
- **Wind >20mph**: Strong under signal in football. Field goal accuracy drops.
- **Rain/precipitation**: Favors under in baseball. Impacts hitting.
- **Extreme cold (<20F)**: Favors under in football. Impacts grip, speed.
- **Extreme heat (>95F)**: Check for dome/no-dome. Impacts endurance.
- **Altitude (Denver, Mexico City)**: Favors over in baseball.

**Data needed**: Open-Meteo hourly forecast for game location + game time.

**Weight**: High for totals, moderate for sides. Zero for indoor/dome games.

## Model 4: Injury Context

**Signal**: Impact of injured/questionable players beyond what the line has priced in.

**Logic**:
- Star player injuries are priced in immediately. Low edge.
- Role player injuries (O-line, bullpen arms, defensive specialists) are
  underpriced. This is the edge.
- Backup quality matters: losing a starter to a strong backup ≠ losing to a
  weak backup. The market often treats these the same.
- Cumulative injuries: 3 minor injuries on one side may equal one star injury.

**Data needed**: ESPN injury reports, depth charts, historical performance data.

**Weight**: Moderate. High when combined with other signals.

## Model 5: Line Value (Opening → Current)

**Signal**: How far the line has moved from open. Direction and magnitude.

**Logic**:
- Large moves (>2 pts in NFL, >1.5 in NBA) indicate sharp action or news.
- If the line has moved and you're on the opening-line side, you may have value.
- If the line has moved toward you, check WHY before recommending.
- Key numbers in NFL: 3, 7, 10, 14. Moves through these are significant.

**Data needed**: Opening lines + current lines from The Odds API.

**Weight**: Moderate as standalone. High when confirming other signals.

## Combining Models → Edge Score

Each model outputs:
- `signal`: boolean (edge detected or not)
- `direction`: which side/total the edge favors
- `confidence`: 0-100 scale
- `reasoning`: plain English explanation

**Aggregation**:
```
edge_score = Σ (model_confidence × model_weight) / Σ weights_of_active_models
```

- Only models with `signal: true` contribute.
- If models conflict in direction, reduce overall confidence by 30%.
- If zero models fire, edge_score = 0 → "No actionable edge detected."

**Output thresholds**:
- edge_score < 30: "No edge" → still return data, but no recommendation
- edge_score 30-50: "Marginal edge" → include caveats about sample size
- edge_score 50-70: "Moderate edge" → confident recommendation with reasoning
- edge_score 70+: "Strong edge" → high confidence, multiple confirming signals

## Endpoint Mapping

| Endpoint | Models Applied | Response Time Target |
|----------|---------------|---------------------|
| `/quick-check` | Line Value + RLM | <2s |
| `/line-check` | Line Value + RLM + Stale Line | <3s |
| `/full-analysis` | All 5 models | <5s |

## CLV Tracking

Every recommendation is stored with:
- `pick_id`: unique identifier
- `timestamp`: when recommendation was made
- `line_at_pick`: the line when we recommended
- `closing_line`: the line at game start (backfilled)
- `result`: win/loss/push (backfilled)
- `edge_score`: what we predicted
- `models_fired`: which models contributed

Weekly aggregation:
- Average CLV (positive = sharp, negative = need to recalibrate)
- Win rate by edge_score bucket
- Model accuracy by individual model
- ROI by sport/league

## Iteration Protocol

Every Sunday:
1. Pull week's results
2. Calculate CLV for every pick
3. Compare predicted confidence vs actual outcomes
4. Identify which models are over/under-performing
5. Adjust weights (±5% max per week to avoid overcorrection)
6. Log changes to `logs/decisions/`
7. Update this document's weight table if significant shifts occur

This is a living document. It improves as the system learns.
