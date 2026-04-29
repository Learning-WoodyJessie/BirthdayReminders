---
description: Perform a combined technical and UX audit of newly built code before closeout.
---

# /audit

Use this workflow to ensure code is production-ready before merging. Required before every `/closeout`.

## 1. Technical Audit (Python Layer)

### Test Verification
```bash
python -m pytest tests/ -v
```
If tests are missing or failing, the audit is **FAILED**.

Current baseline: **138 tests**. Regressions are a hard block.

### Mock Integrity Check
Grep new test files for any live external calls:
```bash
grep -n "openai\|supabase\|twilio\|requests.get" tests/test_*.py | grep -v "@patch\|mock\|Mock"
```
Any unmocked external call = **FAILED**. Live API calls in tests add cost and make CI flaky.

### Config Check
If the feature adds new config keys:
- [ ] Added to `config.yaml` with sensible defaults
- [ ] Documented in `CLAUDE.md` secrets section if it's a secret

### Idempotency Check
If the feature writes to `data/sent_log.yaml` or `data/run_log.yaml`:
- [ ] `append_sent_log()` idempotency check is intact
- [ ] Safe to run the orchestrator twice without duplicate entries

### Clean Code Review (Entropy Check)
Review only the changed files as if seeing them for the first time:
1. Code that solves a problem that doesn't exist yet (YAGNI)
2. Duplicated logic that should be a shared utility (DRY)
3. Functions doing more than one job (Single Responsibility)
4. Anything confusing to the next person reading it

Triage findings:
| Bucket | Definition | Action |
|---|---|---|
| **Blocking** | Violates DRY/YAGNI/SRP in a way that will cause real future pain | Fix before proceeding |
| **Improvement** | Valid point, non-urgent | Log to `docs/BUGS.md` as Low DEBT |
| **Nitpick** | Style preference, minor | Acknowledge, skip |

## 2. Technical Audit (Warmly / Next.js)

### Build Verification (Required)
```bash
cd warmly && node_modules/.bin/next build
```
TypeScript errors fail Vercel silently. This must be clean before any push.

### API Route Checks
For each new API route:
- [ ] No auth check that bypasses the no-auth design
- [ ] Error responses use `NextResponse.json({ error: ... }, { status: 4xx/5xx })`
- [ ] Timeout on all external calls (Supabase, OpenAI): 10s standard, 30s for AI

### Supabase Schema Check
If new columns are referenced:
- [ ] Columns actually exist in the live Supabase project
- [ ] RLS policy allows the operation (public read on `reminders`, no user_id required)

### iOS Safari Safety
For any Warmly feature that opens WhatsApp:
- [ ] `window.open()` fires synchronously on direct user tap
- [ ] No `await` between user click and `window.open()` call

### Dead Component Check
For every new component added:
- [ ] Imported and rendered somewhere (grep for the component name)
- [ ] Not just defined but never used

## 3. UX Audit (Warmly Only)

Manual verification:
1. Run `cd warmly && npm run dev`
2. Open http://localhost:3000
3. Check:
   - [ ] Dark theme consistent (#0A0A18 background)
   - [ ] Mobile-responsive (test at 375px width)
   - [ ] No broken loading states (skeleton or spinner shown while data loads)
   - [ ] Error states handled (what does the user see if the API fails?)
   - [ ] Toast notifications working (success + error)

## 4. Results

- ✅ **PASS**: All tests green, build clean, P0s satisfied, no blocking issues.
- ❌ **FAIL**: Known bugs, P0 violations, test failures, or missing mocks.

Log any Improvement/Debt items to `docs/BUGS.md` using `/log` before closing out.

**Next Step**: Once audit passes, run `/kaizen` then `/closeout`.
