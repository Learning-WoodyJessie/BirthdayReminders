---
description: Execute an approved implementation plan using TDD. Works across Python layer and Warmly Next.js UI.
---

# /build

Use this workflow to execute a structured implementation plan step-by-step.

## Core Principles
- **No Production Code Without a Failing Test**: The Iron Law of TDD.
- **Atomic Execution**: Complete one chunk, verify it, and commit before moving on.
- **Systematic Verification**: Never assume it works because it "looks right". Run the command.
- **Data First**: Verify data availability before building the UI that displays it.

## The Process

### 1. Setup
- Read the implementation plan from `docs/plans/`.
- Confirm you're on the right branch (`git status`).
- Run the full test suite to establish a baseline: `python -m pytest tests/ -v`

### 2. Debugging Protocol

If a task fails more than once (same error or cycling through approaches):
1. **Stop** — do NOT keep retrying
2. **Create a debug log** at `docs/debug-log-<topic>.md` with three columns:
   ```
   | Attempt | What was tried | Why it failed |
   ```
3. Read this log before every subsequent attempt
4. Delete the log once resolved

This prevents re-trying approaches that already failed and surfaces the actual constraint faster.

### 3. Task Execution (RED-GREEN-REFACTOR per chunk)

For each chunk in the plan:

**Python layer:**
```bash
# RED — watch it fail
python -m pytest tests/test_<module>.py::test_<name> -v

# GREEN — minimal code
# REFACTOR — clean up

# COMMIT
git add <files>
git commit -m "[Action] [scope]: <change>"
```

**Warmly UI:**
```bash
# Warmly doesn't have unit tests in most cases — use build verification
cd warmly && node_modules/.bin/next build

# For API routes with tests:
cd warmly && npm test
```

**JSX Integration Check**: When inserting a new component into an existing page, ALWAYS read the full page file first. Verify the JSX tree opens and closes correctly after your edit.

**UI Task Detection**: When implementing Warmly UI components, auto-load `.interface-design/system.md` if it exists. Apply craft principles from the `ui-development` skill.

### 4. Key Architecture Rules (don't break these)

- `days_until` year-boundary wrap in `tools/calendar.py` — handles Dec 31 → Jan 1
- Two-template split in `prompts/messages.py` — reminder vs wish serve different mental states
- `CLOSE_RELATIONSHIPS` set in `router/message_router.py` — add relationships here, never inline
- `reminder_days: [3, 0]` in `config.yaml` — by design
- `NEXT_PUBLIC_WARMLY_URL` in Vercel — must be production URL, not deployment URL
- `append_sent_log()` idempotency check — never remove
- `window.open()` in Warmly — synchronous on user tap, never after `await`

### 5. External Service Mocking

ALL external calls must be mocked in tests. Never make live API calls during test runs:
```python
@patch('tools.whatsapp.Client')
@patch('openai.OpenAI')
@patch('supabase.create_client')
def test_my_feature(mock_supabase, mock_openai, mock_twilio):
    ...
```

### 6. Technical Debt Discovery

As you implement, actively look for:
- Existing technical debt that's now obvious
- Complex code that needs refactoring
- Missing edge case handling

If found and out of scope for the current task, IMMEDIATELY add to `docs/BUGS.md` using `/log`.

### 7. Progress Tracking
- Check off chunks in the plan file as they are completed.
- Update `PROJECT_HISTORY.md` at the end of the session.

**Next Step**: Once all chunks are complete, use `/audit` for the quality check.
