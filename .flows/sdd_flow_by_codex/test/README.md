# SDD Flow Test Suite

## Overview

This directory contains the automated testing framework for SDD Flow.

**Purpose:** Ensure SDD Flow generates high-quality, consistent SDDs across different feature complexities.

**Test Coverage:**
- Script validation (execute permissions, syntax)
- Template validation (all required files present)
- Integration tests (full SDD generation workflow)
- Quality gate validation
- Complexity assessment validation

## Running Tests

```bash
cd .

# Run full test suite
./test/test-framework.sh

# Expected output:
# ✓ ALL TESTS PASSED - SDD Flow is READY
# Success Rate: 95-100%
```

## Test Features

Sample features in `test/features/` for integration testing:

1. **simple-notification.md** (3-5 cards expected)
   - Basic Slack integration
   - Proves minimal case works

2. **medium-archive.md** (8-12 cards expected)
   - Auto-archive feature
   - Proves standard complexity works

3. **complex-exam-system.md** (18-25 cards expected)
   - Full exam platform
   - Proves high complexity works

## Adding New Tests

To add a test feature:

1. Create `test/features/your-feature.md`
2. Run generation: `./generate-sdd.sh --requirements test/features/your-feature.md --output test/output/your-feature-sdd/`
3. Add validation check to `test-framework.sh`
4. Ensure it passes all quality gates

## CI/CD Integration

Add to CI pipeline (GitHub Actions, GitLab CI, etc.):

```yaml
- name: Test SDD Flow
  run: |
    cd .
    ./test/test-framework.sh
```

Fails if:
- Any quality gate fails
- Generated SDD doesn't meet 85% quality threshold
- Required files missing
- Structure inconsistent