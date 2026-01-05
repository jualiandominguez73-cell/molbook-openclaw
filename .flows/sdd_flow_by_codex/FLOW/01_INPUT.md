# SDD Flow: Input and Interview

Goal: transform raw requirements into a complete, unambiguous requirements set.

## Step 1: Get Raw Requirements
Ask for the initial requirement dump if not already provided. Encourage messy, unstructured input.

Prompt source:
- `./prompts/interview.yaml` -> `raw_requirements_prompt`

## Step 2: Establish Baseline Facts
Confirm the basics before deep interview:
- Problem statement
- Target users and roles
- Desired outcomes (top 3)
- Deadline or timeline
- Known constraints (tech, budget, compliance)

## Step 3: Gap-Filling Interview
Run the interview in short batches (3 to 7 questions at a time). Group by theme.
Do not proceed until all required fields are filled.

Question bank source (pick only what is missing):
- `./prompts/interview.yaml` -> `gap_question_bank`

## Required Data to Proceed
All items below must be present and unambiguous:
- Problem statement
- Goals and success criteria
- Scope and non-goals
- User roles/personas
- Core flows
- Data and integrations
- Non-functional requirements
- Constraints and dependencies
- Risks and mitigations
- Milestones (or "single-phase delivery")

## Interview Output Format
Maintain an "Open Questions" list until empty. Record answers in plain statements.
Assign gap IDs (GAP-001, GAP-002, ...) and track them for `gaps.md`.
Format sources:
- `./prompts/interview.yaml` -> `open_questions_example`
- `./prompts/interview.yaml` -> `gap_tracking_example`

## Completion Gate
Only move to the next phase when all required data is captured and validated.
