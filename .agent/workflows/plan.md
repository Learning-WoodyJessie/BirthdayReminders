---
description: Create a detailed, TDD-first implementation plan from an approved design.
---

# /plan

Use this workflow once a design has been approved to create a bite-sized, executable path forward.

## Core Principles
- **TDD-First**: Every chunk must start with a failing test.
- **Architectural Rigor**: Apply Clean Architecture and Single Responsibility Principle.
- **Bite-sized Granularity**: Each chunk should take 2-5 minutes to implement.
- **Zero Ambiguity**: Use exact file paths and specify line ranges when modifying.
- **Goals & Success Criteria**: Every block must have measurable outcomes.

## Terminology
- **Block**: A logical grouping of related work (e.g., "Python tools layer", "Router logic", "Warmly UI"). Do NOT use the word "phase" inside the plan.
- **Chunk**: A single bite-sized unit of work inside a block. Each chunk = one RED-GREEN-REFACTOR-COMMIT cycle.

## Process (Before Generating Plan)

### For Python Layer Changes (`tools/`, `router/`, `prompts/`, `scripts/`):
1. **Test Framework Check**: We use `pytest` with mocking via `unittest.mock`. All tests in `tests/`. All 138 tests must stay green.
2. **Mock Strategy**: All external calls (OpenAI, Anthropic, Twilio, Supabase) MUST be mocked. Never rely on live API calls in tests.
3. **Config Check**: Does this change need new keys in `config.yaml` or `.env`?
4. **Conventions Check**: Read 1-2 existing files in the category you'll be creating (e.g., `tools/calendar.py`, `tests/test_calendar.py`). Document key patterns as constraints in the plan:
   - What mock patterns does this codebase use?
   - Named functions or classes? Where do types/constants live?
   - How are imports structured?
   - Reuse Audit: For every new function, search the codebase first. If an existing function covers ≥80% of the need, say "call `X`, don't re-implement."

### For Warmly UI Changes (`warmly/`):
1. **Mockup First**: Create `warmly/public/prototype_<feature>.html` to mimic functionality.
   - Use standard HTML/CSS/JS (no build step required)
   - Match the dark theme (#0A0A18 background, existing Tailwind config)
2. **User Validation**: Present the mockup for approval before planning.
3. **Data First Check**: WHERE does the data come from? (Supabase? local API route? YAML?)
   - If the source doesn't exist, create a task to build it first.
4. **Infrastructure Safety**:
   - Verify every Supabase column referenced actually exists in the live project
   - Check `warmly/.env.local` has the same secrets as Vercel
   - TypeScript errors fail Vercel silently — always build locally first: `cd warmly && node_modules/.bin/next build`
5. **Reliability Pre-flight**:
   - Timeout mapping: every `fetch` or Supabase call → assign timeout (10s standard, 30s AI)
   - Error handling: every `catch` → `toast.error` for user + `console.error` for debug
   - Live service tests: gated behind env flag so CI passes without the service

## Plan Structure (MUST include these sections)

1. **Header**
   - **Goal**: One sentence describing what this builds.
   - **Architecture**: 2-3 sentences about the approach.
   - **Layer**: Which layer(s) this touches (Python tools/router/prompts, Warmly UI, GitHub Actions)
   - **Tech Stack**: Libraries or frameworks involved.

2. **Blocks**
   - Break work into logical blocks.
   - For each block, list **Success Criteria** using checkboxes.

3. **Chunks** (inside each Block)
   For each chunk:
   - **Files**: Create: `path/to/new.py`, Modify: `path/to/old.py:L10-20`
   - **Step 1: Write failing test**: Provide the minimal test code
   - **Step 2: Verify failure**: Specify the command and expected error
   - **Step 3: Implement minimal code**: Provide the smallest implementation
   - **Step 4: Verify pass**: Specify command and expected output
   - **Step 5: Commit**: Provide the bash command and atomic message

   **Python test command**: `python -m pytest tests/test_<module>.py -v`
   **Full suite**: `python -m pytest tests/ -v`
   **Warmly test**: `cd warmly && npm test` (if applicable)
   **Warmly build**: `cd warmly && node_modules/.bin/next build`

4. **Technical Debt Strategy**
   - Identify any known shortcuts being introduced.
   - List them for `docs/BUGS.md` if the plan is approved without addressing them.

5. **Production Standards (P0)**
   - **Error Handling**: Plan for graceful degradation on every async path.
   - **Timeout Mapping**: For every external call (OpenAI, Supabase, Twilio), assign a timeout.
   - **Loading States** (Warmly only): Every new route MUST include a loading skeleton.
   - **iOS Safari Safety** (Warmly only): `window.open()` must fire synchronously on user tap — never after `await`.

## Persistence
Save the plan to `docs/plans/YYYY-MM-DD-<feature-name>.md`.

Ask: "Ready to start building? Use `/build`."

## Completion Requirements

A plan phase is NOT complete until:
1. **`/build`** — Execute the implementation plan
2. **`/audit`** — Perform technical and UX verification
3. **`/closeout`** — Document and commit

Skipping `/audit` is not permitted.
