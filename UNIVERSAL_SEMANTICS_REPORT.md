# Luna Universal Semantics Report

PROOF path: /home/dado/PROOF/luna_universal_semantics_20260207T110435Z
Overall: NEEDS_OVERRIDE

## What Changed
- Added semantic resolver + overrides + reliability tracking in homeassistant extension.
- Added universal control tool with capability-aware planning + verification.
- Added inventory report tool and proof harness scripts.

## Semantics + Overrides
- Overrides path: /home/node/.openclaw/homeassistant/semantic_overrides.json
- Stats path: /home/node/.openclaw/homeassistant/semantic_stats.json
- Schema: extensions/homeassistant/semantic_overrides.schema.json

## Proof Results (Semantic Types)
- light: PASS (verified)
- media_player: PASS (verified)
- input_boolean: PASS (verified)
- switch: NEEDS_OVERRIDE (low_confidence)
- fan: NEEDS_CONFIRM (not_safe)
- cover: SKIP (no_entity)
- climate: NEEDS_CONFIRM (not_safe)
- lock: SKIP (no_entity)
- alarm: SKIP (no_entity)
- vacuum: NEEDS_CONFIRM (not_safe)

## Needs Override
- See semantic_map.json and RESULT.json for full list.

## Evidence
- inventory_snapshot.json
- semantic_map.json
- inventory_report.md
- devtools_results.json
- RESULT.json
- smoke.log
- gateway_logs_after_restart.txt
- gateway_logs_after_fix.txt
- container_mounts_after_recreate.json
- container_extension_ls.txt

## Rerun
- PROOF_DIR=/home/dado/PROOF/luna_universal_semantics_20260207T110435Z bash /home/dado/openclaw/scripts/smoke_luna_universal_semantics.sh

## Notes
- SAFE mode skips risky entities unless smoke_test_safe override is set.