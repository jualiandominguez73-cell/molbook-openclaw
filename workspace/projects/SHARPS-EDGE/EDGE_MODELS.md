# EDGE MODELS - Analytical Framework

## Overview

Each endpoint applies a series of edge detection models to raw data. This
document defines what those models do, what signals they look for, and how
they combine into a final edge score.

## Data Sources → Signal Pipeline

```
The Odds API (500/mo)     → Lines from multiple books → Line comparison engine
ESPN Public Endpoints      → Injuries, lineups, stats  → Context engine
ESPN News/Headlines        → Team drama, coaching, motivation → Social intel engine
Open-Meteo                → Wind, rain, temp, humidity → Weather impact engine
                                    ↓
                          Edge Detection Models (8)
                                    ↓
                     Confidence-weighted edge score
                                    ↓
                          track_pick → CLV tracking
                                    ↓
                     review_accuracy → weight adjustments
                                    ↓
                         ┌──── RECURSIVE LOOP ────┐
                         │  Every pick teaches.    │
                         │  Every review sharpens. │
                         │  System gets smarter.   │
                         └─────────────────────────┘
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

## Model 6: Social / Locker Room Intelligence

**Signal**: Team chemistry, coaching conflicts, player drama, motivation factors.

**Logic**:
- Coaching instability (fired, interim coach) = strong negative signal
- Locker room rifts, player trade requests = moderate negative
- Contract disputes, suspensions, off-field legal = moderate negative
- Revenge games, playoff implications, elimination = positive motivation
- Winning/losing streaks = momentum context
- Key player returns from injury = positive signal

**Categories tracked**:
- `coaching_change` (weight: 8) - New/interim coach disrupts schemes
- `locker_room` (weight: 7) - Team chemistry breakdown
- `player_wants_out` (weight: 7) - Distracted, disengaged star
- `effort_concerns` (weight: 7) - Team quit signals
- `suspension` (weight: 6) - Missing key player, unpriced if role player
- `coaching_frustration` (weight: 5) - Scheme/play-calling conflicts
- `contract_dispute` (weight: 5) - Holdout, unhappy player
- `high_stakes` (weight: 4) - Playoff implications boost effort
- `momentum` (weight: 3) - Streaks matter for confidence

**Data needed**: ESPN team news headlines, scanned for sentiment patterns.

**Weight**: Moderate. The market systematically underprices team dysfunction
because it's "soft" data. That's exactly why it's valuable.

**Edge insight**: A team with 3+ negative social signals trading at a neutral
line is likely overvalued. The public bets names and records, not chemistry.

## Model 7: Situational Spots

**Signal**: Scheduling, travel, rest, and situational factors that create hidden edges.

**Logic**:
- **Rest differential**: Team with 2+ day rest advantage has edge. Back-to-backs are
  significant negative (-7 weight in NBA/NHL).
- **Travel distance**: Cross-country travel (>1500mi) degrades performance. Timezone
  mismatches compound the effect (West→East = circadian disadvantage).
- **Schedule density**: 3 games in 4 nights (NBA/NHL) creates fatigue edges.
- **Spot analysis** (NFL-specific):
  - Thursday games after Sunday = short rest, both teams affected
  - Letdown after blowout win (>17 pts)
  - Sandwich spots (big game before AND after)
  - Post-bye letdown (0.5-1 pt ATS historically)
  - Divisional revenge (team lost first meeting by 10+)
- **Altitude**: Denver home games favor the home team (1 mile elevation adjustment).
- **Compound spots**: Multiple negatives stacking on one team amplify the edge.

**Data needed**: ESPN team schedules, game dates, venue coordinates, timezone map.

**Tool**: `get_situational` - returns spot analysis, compound score, and edge direction.

**Weight**: Moderate (6). High when compound spots detected.

**Edge insight**: No human can simultaneously track rest days, travel distance,
timezone changes, schedule density, and historical spot performance for every team
in every sport. This is pure AI advantage.

## Model 8: Calibration Overlay

**Signal**: Post-processing correction that adjusts raw edge score to match observed accuracy.

**Logic**:
- After aggregating Models 1-7 into a raw edge score, apply calibration correction.
- Load `calibration.json` (populated by `calibrate correct` action).
- Find the confidence bucket matching the raw score (e.g., 60-65%).
- Apply `correction_factor`: `calibrated = raw × correction_factor`.
- If no calibration data exists, raw score passes through unchanged.

**Example**: If picks at 65% confidence actually win 55% of the time, the correction
factor is 0.846. A raw 65% becomes calibrated 55%.

**Data needed**: Historical pick tracking data, `calibrate correct` to compute factors.

**Tool**: `calibrate` - manages the calibration lifecycle (check, report, correct, adjust).

**Weight**: 0 (does not participate in model aggregation - applied as final correction).

**Why this matters**: Calibrated probability IS the product. Every x402 endpoint
returns a confidence number. If customers can't trust that number, we have no
business. The calibration overlay is the trust engine.

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
| `/standard` | Models 1-4 (Lines, RLM, Weather, Injuries) | <4s |
| `/full-analysis` | All 8 models (+ calibration overlay) | <5s |

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

## Recursive Learning System

The system has two dedicated tools for continuous improvement:

### track_pick
Records every recommendation with full context:
- Game, sport, pick type, direction, line at pick
- Edge score, which models fired, reasoning
- Later backfilled: closing line, CLV, outcome

Every pick the system makes is stored. No exceptions. This is the training data.

### review_accuracy
The brain. Analyzes stored picks and generates actionable insights:

- **weekly**: Full review - win rate, CLV, edge calibration, lessons learned
- **model_performance**: Which models contribute to wins vs losses
- **sport_breakdown**: Where are we sharp, where are we leaking
- **lessons**: View accumulated lessons from past reviews
- **weights**: Suggest and apply model weight adjustments (±5% max per cycle)
- **calibration**: Predicted vs actual win rate by confidence bucket
- **regimes**: Detect model degradation (losing streaks, CLV trend, high-confidence misses)
- **compound**: Which model combinations produce best/worst results
- **portfolio**: Correlated pick exposure and diversification analysis

### The Learning Loop

```
1. Danno analyzes game using check_edge (runs models)
2. If edge found → track_pick records the recommendation
3. After game → track_pick result backfills outcome + CLV
4. Sunday → review_accuracy weekly runs full analysis
5. review_accuracy weights adjusts model weights based on performance
6. Lessons stored in data/lessons/ for long-term memory
7. Next check_edge uses updated weights
8. Repeat forever. Each cycle makes the system sharper.
```

### Key Learning Metrics

| Metric | Meaning | Target |
|--------|---------|--------|
| CLV | Are we finding value before the market? | Positive average |
| Edge calibration | Do high scores win more than low scores? | Yes |
| Model contribution | Which models drive wins? | Weight up winners |
| Sport efficiency | Where do we have an actual edge? | Focus resources |

### Anti-Overfitting Safeguards

- Maximum ±5% weight change per review cycle
- Minimum 5 picks per model before adjusting its weight
- High/medium/low confidence labels on weight suggestions
- Sample size warnings when data is insufficient
- Lessons stored with evidence chain for auditability
