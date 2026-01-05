# SDD Flow: Requirements Normalization and Gap Closure

Goal: transform interview output and context notes into a consistent, complete requirements set.

## Build the Requirements Matrix
Normalize all inputs into these buckets:
- Goals and success criteria
- Scope and non-goals
- Users and roles
- Core flows and edge cases
- Data model and integrations
- Non-functional requirements
- Constraints and dependencies
- Risks and mitigations
- Milestones and sequencing

## Conflict Resolution
If any statements conflict:
- Highlight the conflict clearly
- Ask the user for a decision
- Do not infer or guess for critical behavior

## Assumptions Policy
- Mark assumptions explicitly
- Critical assumptions must be confirmed before output generation
- Minor assumptions can remain if explicitly labeled and approved

## Completion Gate
Proceed only when:
- No open questions remain
- No unresolved conflicts remain
- All required buckets are filled

## Gaps Status
Update `gaps.md` to mark every gap as filled and include the final answers.
Set the document status to "ALL GAPS FILLED" once complete.

## Output Artifact
A finalized requirements brief that will populate the output docs.
