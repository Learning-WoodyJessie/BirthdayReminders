# BUGS.md — Active Issues & Technical Debt

## Active

| ID | Description | Severity | Status | Notes |
|----|-------------|----------|--------|-------|
| — | No active bugs | — | — | — |

---

## Resolved

| ID | Description | Severity | Resolved | Notes |
|----|-------------|----------|----------|-------|
| B-001 | Login page showed cream (#FDF6E3) background instead of dark (#0A0A18) due to `bg-warmly-cream` class in layout.tsx | High | 2026-04 | Fixed: changed to `bg-[#0A0A18]` in warmly/app/layout.tsx |
| B-002 | Auth removed — Supabase magic link email rate limit blocked testing | High | 2026-04 | Fixed: removed all auth, app is now public |
| B-003 | 3 test failures after adding system/user split to prompts — tests checked messages[0] (system) not messages[1] (user) | High | 2026-04 | Fixed: updated test_prompts.py to check messages[1] and pass examples= param |
| B-004 | dashboard/page.tsx and contacts/page.tsx triggered prerender errors because createAdminClient() reads env vars at runtime | Medium | 2026-04 | Fixed: added `export const dynamic = 'force-dynamic'` to both pages |

---

## Debt / Improvements

| ID | Description | Severity | Status | Notes |
|----|-------------|----------|--------|-------|
| D-001 | Warmly compose page generates message via /api/generate on mount — no caching, hits OpenAI every page load | Low | Open | Consider caching generated messages in Supabase on first generation |
| D-002 | DALL-E 3 image generation route exists (warmly/app/api/generate-image) but is not wired into the main UI | Low | Open | Either integrate into compose page or delete to reduce entropy |
| D-003 | decisions.log has approximate dates (2025-XX-XX) for pre-SDLC decisions | Low | Open | Fill in actual dates from git history if precision is needed |
