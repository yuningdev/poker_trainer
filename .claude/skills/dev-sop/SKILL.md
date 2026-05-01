---
name: dev-sop
description: >
  Development SOP (Standard Operating Procedure) for the poker-trainer project.
  Automates the 4-step workflow: (1) create a git branch named feature/YYYY-MM-DD,
  (2) stage and commit changes, (3) run the full test suite (frontend lint + tsc build
  + backend pytest), (4) append a structured entry to WORKLOG.md.

  Use this skill whenever the user says /dev-sop, "run the dev SOP", "follow the SOP",
  "create a feature branch", "commit and test", or "write the work log". Also trigger
  for any combination like "branch + commit + test + log". When in doubt, trigger it —
  it's better to surface the SOP than to silently skip it.
---

# Development SOP — Poker Trainer

Run all four steps in order unless the user specifies a single step via argument
(`branch`, `commit`, `test`, or `log`). For a single step, run only that step.

## Step 1 — Create Branch (`branch`)

```bash
git checkout -b <feature_name>/$(date +%Y-%m-%d)
```

- Ask the user for `<feature_name>` if not already provided or inferable from context.
- Use kebab-case for the feature name (e.g., `hand-history`, `bet-sizing-ui`).
- If already on a non-main branch, skip creation and confirm the current branch name.
- Example branch name: `rule-of-2-and-4/2026-05-01`

## Step 2 — Commit (`commit`)

Stage and commit the current working changes:

```bash
git add <relevant files>   # prefer specific paths over git add -A
git commit -m "<message>"
```

- Write a commit message that explains *what changed and why* in 1 sentence.
- Use conventional commit style: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`.
- Never use `--no-verify`.
- If there is nothing to commit, report that clearly and skip.

## Step 3 — Run Tests (`test`)

The project has no dedicated e2e runner yet, so the test suite is:

**Frontend** (run from `frontend/` directory):
```bash
npm run lint          # ESLint
npm run build         # TypeScript compile + Vite build
```

**Backend** (run from project root):
```bash
uv run pytest
```

Run frontend checks first, then backend. Capture pass/fail for each. If either fails,
report the errors clearly and do NOT proceed to Step 4 — let the user fix the issues first.

## Step 4 — Work Log (`log`)

Append a structured entry to `WORKLOG.md` in the project root. Create the file with a
header if it doesn't exist yet.

### Entry format

```markdown
## YYYY-MM-DD — <feature_name>

**Branch:** `<branch-name>`
**Status:** ✅ All tests passed  (or ❌ Tests failed — <brief reason>)

### What was done
<1-3 bullet points describing the changes made this session>

### Test results
- Frontend lint: ✅ / ❌
- Frontend build (tsc): ✅ / ❌
- Backend pytest: ✅ / ❌ (<N> passed, <M> failed)

---
```

- Pull the branch name from git (`git branch --show-current`).
- Pull the date from `date +%Y-%m-%d`.
- Summarize what was done from the current conversation context and the git diff/commit message.
- Keep bullet points concise — a future reader should understand the work in 30 seconds.
