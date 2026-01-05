# SDD Flow: Project Context Gathering

Goal: understand the current project landscape (repo, docs, wiki) to align requirements with reality.

## Read First (Required)

- `README.md` - project overview
- `docs/` - any design docs, wiki, or specs
- `package.json` / `Cargo.toml` / `pyproject.toml` - dependencies
- `src/` or `lib/` - code structure and entry points
- `CHANGELOG.md` or release notes (if any)
- Any existing SDD folders under `docs/sdd/`

## Suggested Commands

```bash
# List all files
rg --files

# Find TODOs and technical debt
rg -n "TODO|FIXME|roadmap|tech debt|risk" -S docs src

# Directory structure
tree -L 2 -d
```

## Capture Notes

Summarize findings in a short "Project Context Notes" section:

- What the system already does
- Current architecture/components
- Existing constraints and dependencies
- Areas that are fragile or incomplete
- Conventions to follow (naming, patterns, style)

## Output

A concise context summary used in gap analysis and final SDD docs.
