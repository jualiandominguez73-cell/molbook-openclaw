## Summary

Fixes #7687. Cron jobs with `kind: "at"` and `wakeMode: "now"` no longer return `not-due` when their scheduled timestamp has passed, and they fire correctly via both manual `cron run <id>` and the timer.

## Problem

- **Steps:** Create an "at" job with a future `atMs`, wait until that time passes, then run `cron run <id>` or rely on the timer.
- **Result:** `cron run` returns `{ ok: true, ran: false, reason: "not-due" }`; `cron runs` shows `[]`; the job never fires.
- **Cause:** Due-ness and wake time were based only on persisted `job.state.nextRunAtMs`. That value is set in `createJob()` (add) and `recomputeNextRuns()` (only in `start()`). If the store is loaded without `start()` (e.g. CLI `cron run` in a process that only does `ensureLoaded`) or the job has empty `state: {}`, `nextRunAtMs` is missing, so the job is never considered due and the timer never wakes for it.

## Solution

1. **Effective next run**  
   Introduce `getEffectiveNextRunAtMs(job, nowMs)` in `src/cron/service/jobs.ts`: it returns `job.state.nextRunAtMs` when set, otherwise `computeJobNextRunAtMs(job, nowMs)` (schedule-derived). Use this everywhere we decide due-ness or next wake:
   - `isJobDue()` — due when `nowMs >= getEffectiveNextRunAtMs(job, nowMs)`.
   - `nextWakeAtMs()` — minimum of effective next run over enabled jobs (so past-due "at" jobs still set wake time).
   - `runDueJobs()` in `src/cron/service/timer.ts` — filter due jobs using effective next run.

2. **Schedule layer**  
   In `src/cron/schedule.ts`, for `kind: "at"` always return `schedule.atMs` (not `undefined` when past). Past "at" schedules stay visible/due so callers can treat them as due until the job runs.

## Files changed

- `src/cron/schedule.ts` — Return `schedule.atMs` for "at" (keep past timestamps visible).
- `src/cron/service/jobs.ts` — Add `getEffectiveNextRunAtMs`, use it in `isJobDue` and `nextWakeAtMs`.
- `src/cron/service/timer.ts` — Use `getEffectiveNextRunAtMs` in `runDueJobs`.

## Testing

- `pnpm exec vitest run src/cron/service.run-due.test.ts src/cron/schedule.test.ts src/cron/service.runs-one-shot-main-job-disables-it.test.ts src/cron/service.skips-main-jobs-empty-systemevent-text.test.ts src/cron/service.prevents-duplicate-timers.test.ts` — all pass.
