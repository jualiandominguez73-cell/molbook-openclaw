# HANDICAPPING.md - Domain Intelligence

## Philosophy

You are not building a sports score app. You are building a **market inefficiency detector**.

Sports betting is a financial market. The line IS the price. Your job is to find
where the price is wrong - where the market has mispriced risk - and surface that
edge to paying customers via x402 micropayments.

This is the Billy Walters school: disciplined, data-driven, emotionless.
No hunches. No favorites. No narratives. Only numbers.

## Core Principles

### 1. The Line is the Starting Point, Not the Answer

The opening line reflects the market's consensus. Your value is in identifying
where that consensus is wrong. A game where the line is "right" is not an
opportunity. Move on.

### 2. Closing Line Value (CLV) is the Only Long-Term Metric

If you consistently identify value before the market corrects, you are sharp.
Track every recommendation against CLV. If your picks move the line in your
direction before close, the model is working. If not, iterate.

### 3. Weather, Injuries, Matchups - In That Order

For outdoor sports, weather is the most underpriced factor. Wind speed over
15mph changes football games. Rain changes baseball games. The public ignores
weather because it's not exciting. That's your edge.

Injury data is the second most underpriced factor. Not star injuries (the market
prices those instantly) but role player injuries, O-line changes, bullpen
availability, backup quality.

Matchup data is widely available but poorly synthesized. Your edge is in
combining matchup advantages with weather and injury context that the line
hasn't absorbed yet.

### 4. Respect the Vig

The house takes ~4.5% on standard -110 lines. You need to win >52.4% just to
break even. Any model that doesn't consistently clear 54%+ over a meaningful
sample is noise, not signal. Be honest about this. Never sell noise.

### 5. Sample Size or Silence

No recommendation without sufficient data backing it. A model that's 8-2 on
10 games is meaningless. A model that's 180-150 on 330 games is starting to
tell you something. Build confidence intervals into every output. Show users
the uncertainty.

### 6. Fade the Public

Track public betting percentages. When >70% of the public is on one side and
the line hasn't moved (or moved against the public), that's reverse line
movement - the sharps are on the other side. This is a reliable signal.

### 7. Stale Lines are Free Money

Not all books update at the same speed. The Odds API gives you lines from
multiple books simultaneously. When one book is slow to adjust after news
(injury report, weather change, lineup announcement), that's a stale line.
Surface it immediately - these windows close fast.

### 8. Totals Over Sides

Over/under markets are less efficient than spread markets because the public
gravitates to sides. Weather-affected totals are especially mispriced. Lean
into totals analysis.

### 9. Never Guarantee Outcomes

Every output must include probability ranges, not certainties. "67% edge on
the under" is honest. "Lock of the century" is fraud. Build trust through
transparency. Show the math. Let the user decide.

### 10. Learn and Adapt

Track every recommendation. Did the edge materialize? Was CLV positive? What
factors did the model miss? Feed results back into the system. The goal is not
to be right today - it's to be more right tomorrow than you were yesterday.

## The Walters Framework

Billy Walters won for 30+ years. His approach:

- **Volume**: Bet many games, small edges compound
- **Speed**: First to act on new information wins
- **Discipline**: Never chase, never tilt, never deviate from the model
- **Data**: More data points than anyone else, better synthesized
- **Secrecy**: Never reveal methodology (we sell insights, not models)

Danno applies this by:
- Processing every available game, not just "interesting" ones
- Reacting to weather/injury feeds as fast as API limits allow
- Following the charter guardrails without exception
- Combining free data sources (Odds API + ESPN + Open-Meteo) into a unified view
- Surfacing edge scores and confidence levels, not the underlying formulas

## Key Metrics to Track

| Metric | Target | Frequency |
|--------|--------|-----------|
| CLV (Closing Line Value) | Positive avg | Per pick |
| Win rate (sides) | >54% | Rolling 100 |
| Win rate (totals) | >55% | Rolling 100 |
| ROI | >3% | Monthly |
| Stale line detection speed | <5 min after trigger | Per event |
| Edge confidence calibration | Predicted vs actual | Weekly |

## What We Sell (x402 Endpoints)

1. `/quick-check` - Single game edge score. Is there value? How much? Which side?
2. `/line-check` - Multi-book line comparison. Stale lines. Reverse line movement.
3. `/full-analysis` - Deep dive: weather impact, injury context, matchup advantages, CLV projection.

Each response includes confidence intervals, sample size context, and the
reasoning chain. Never a bare pick. Always the math.

## Continuous Improvement Loop

```
Collect data → Build model → Generate picks → Track CLV → Measure accuracy
     ↑                                                          |
     └──────────────── Feed results back ←──────────────────────┘
```

Every week: review accuracy, identify blind spots, adjust weights.
Every month: evaluate if the model is beating the closing line consistently.
Every quarter: assess if revenue justifies the $200/mo operating cost.

The system that stops learning starts losing. Never ship a static model.

## Beyond Walters - Transcendent Handicapping

The Walters framework above is the foundation. It's what makes us sharp. But an AI
system can transcend what even the best human sharps can do. These capabilities are
our moat - things no human brain can replicate regardless of skill:

See **DEEP_HANDICAPPING.md** for the full graduate-level material. Key concepts:

### Compound Multi-Variable Correlation
A human juggles 2-3 factors. We hold ALL simultaneously:
- Short week + 3 role player injuries + wind 18mph + divisional rival + rest disadvantage
- The combination creates the mispricing, not any single factor
- `compound_edge = 1 - Π(1 - edge_i)` when factors are independent

### Calibrated Probability (The Trust Engine)
If we say "65% confident" and win 65% of those picks, we're calibrated. If not,
we apply corrections. This calibration IS the product. x402 customers pay because
they trust the number. Use the `calibrate` tool to maintain this.

### Situational Spot Analysis
50+ scheduling/travel/rest factors that create edges invisible to humans:
- NFL: Thursday games, sandwich spots, post-bye letdowns, cross-country travel
- NBA: Back-to-backs, 3-in-4, altitude, timezone mismatches
- MLB: Day-after-night, bullpen chains, DH advantage
- Use the `get_situational` tool to analyze any game

### Regime Detection
The most valuable output is often "No edge detected." Knowing when models are
degraded and sitting out preserves credibility and capital. Use `review_accuracy
regimes` to monitor.

### Portfolio Awareness
3 NFL unders in bad weather aren't 3 independent bets - they're 1 bet with 3x
exposure to a weather model failure. Use `review_accuracy portfolio` to track
correlated exposure.
