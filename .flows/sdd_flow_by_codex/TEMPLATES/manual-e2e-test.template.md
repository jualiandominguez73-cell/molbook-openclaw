# Manual E2E Test Checklist

**Prerequisites:**
- [ ] Gateway running: `pnpm dev`
- [ ] Feature enabled: `{ENV_VAR}=true`
- [ ] {OTHER_PREREQUISITE}

**Test Environment:**
- Dry-run mode: {ENABLED}
- Test data: Available

## Test Cases

### Test 1: Basic Flow

Steps:
1. [ ] Send: "{example trigger message}"
2. [ ] Verify: Acknowledgment received with {details}
3. [ ] Verify: {Expected UI element}
4. [ ] Click: Execute button
5. [ ] Verify: Processing message shown
6. [ ] Wait: {TIME} seconds
7. [ ] Verify: Result message received
8. [ ] Verify: Result contains {expected content}
9. [ ] Verify: {Additional verification}

Expected result: ✅ Full flow successful

### Test 2: Error Scenario

Steps:
1. [ ] Send: "{invalid input}"
2. [ ] Verify: Error message received: "{expected error}"
3. [ ] Verify: Retry button visible
4. [ ] Click: Retry button
5. [ ] Verify: Flow restarts

Expected result: ✅ Error handling works

## Regression Tests

- [ ] Existing feature {A} still works
- [ ] Existing feature {B} still works
- [ ] No breaking changes to {C}
