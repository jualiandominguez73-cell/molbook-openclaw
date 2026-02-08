# Bug Note: `/status` and `session_status` can misreport model after fallback

## Problem
When a request is configured with a preferred model (or session/model override) and the provider falls back to a different served model, `/status` and `session_status` may still display the configured/override model rather than the actual served model.

In short: reporting can reflect **intended model** instead of **actual model used**.

## Impact
- Users can make incorrect assumptions about which model actually handled requests.
- Cost, quality, and behavior analysis can be misleading when fallback occurred.
- Debugging provider issues is harder because runtime truth is obscured.

## Reproduction Evidence
Verified behavior observed in a fallback scenario:
1. Configure/use model **A** (directly or via override).
2. Trigger or encounter fallback to model **B** at serve time.
3. Confirm provider/runtime served **B**.
4. Run `/status` and/or `session_status`.
5. Output can still show **A** (configured/override), not **B** (served).

Expected source-of-truth precedence should be actual response metadata from the served request path.

## Proposed Fix Direction
- Track and persist two distinct fields:
  - `configuredModel` (requested/override)
  - `servedModel` (actual provider-returned model)
- Update `/status` and `session_status` to prioritize `servedModel` when present.
- Keep `configuredModel` visible as secondary context (optional label like "requested" vs "served").
- Ensure fallback transitions overwrite/report runtime served model deterministically.

## Acceptance Criteria
- In normal (no-fallback) runs, status outputs match configured model.
- In fallback runs, status outputs show the **actual served model**.
- If both are shown, labels are unambiguous (`requested` vs `served`).
- Regression tests cover at least:
  - no fallback
  - single fallback
  - per-session override + fallback
  - provider metadata absent/partial (graceful behavior)
