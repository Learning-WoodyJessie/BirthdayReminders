# Gotchas — Hard-Won Lessons

Failure patterns discovered while building BirthdayReminders. Read this before starting a `/plan` or `/build` session.

*Last updated: 2026-04-28*

---

## WhatsApp / iOS Safari

### `window.open()` after `await` is silently blocked on iOS Safari

**Pattern**: Any `window.open()` called after an `await` is treated as a popup and blocked by iOS Safari. No error message. WhatsApp just never opens.

**Tell**: "Works on desktop, doesn't open WhatsApp on iPhone"

**Wrong**:
```typescript
const handleSend = async () => {
  const url = await generateWarmlyUrl(); // async call
  window.open(`https://wa.me/?text=${url}`); // BLOCKED on iOS
};
```

**Right**:
```typescript
const handleSend = () => {
  const url = preGeneratedUrl; // computed BEFORE the click handler
  window.open(`https://wa.me/?text=${url}`); // synchronous — allowed
  fetch('/api/mark-sent', { method: 'POST' }).catch(() => {}); // fire and forget
};
```

**Rule**: Pre-generate all URLs before the click event. `window.open()` must be the synchronous first action in the click handler.

---

## Twilio WhatsApp Sandbox

### Sandbox doesn't support audio attachments — error 63021

**Pattern**: Sending audio files via Twilio WhatsApp Sandbox fails with error 63021.

**Tell**: Message sending returns success but recipient never receives audio.

**Workaround**: Upload audio to Supabase Storage, share a tap-to-play link in the WhatsApp text message body instead.

**Rule**: Never attempt to send binary attachments via Twilio sandbox. Text + links only.

---

## Supabase Storage

### "Public" bucket in dashboard ≠ publicly accessible

**Pattern**: Setting a bucket to "public" in the Supabase dashboard doesn't automatically make objects accessible. You need an explicit SQL RLS policy too.

**Tell**: `getPublicUrl()` returns a URL, but requests to it return 403.

**Fix**:
```sql
CREATE POLICY "Public read voice-notes" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice-notes');
```

**Rule**: After creating any storage bucket, immediately add the RLS policy in the SQL editor.

---

### `upsert: true` required when pre-generating filenames

**Pattern**: If the client pre-generates a filename and path before upload (for synchronous `window.open()` sharing), the upload must use `upsert: true` to avoid conflicts on retry.

**Wrong**: `supabase.storage.from('voice-notes').upload(path, blob)`
**Right**: `supabase.storage.from('voice-notes').upload(path, blob, { upsert: true })`

---

## Vercel / Next.js

### TypeScript errors fail Vercel deploy silently

**Pattern**: A TypeScript error that `tsc` catches won't show up as a visible failure in many Vercel deploy logs — the build just fails silently or with a vague error.

**Tell**: Deployment status shows "Failed" but no obvious error in the function logs.

**Rule**: Always run `cd warmly && node_modules/.bin/next build` locally before pushing. If it errors locally, it will error on Vercel.

---

### `VERCEL_URL` is a deployment-specific subdomain — never use it for external links

**Pattern**: `VERCEL_URL` changes with every deployment and is protected by Vercel Standard Protection. Using it in Warmly links means links generated in one deployment become inaccessible after the next deploy.

**Tell**: Links work immediately after deploy but break after the next push.

**Rule**: Always use `NEXT_PUBLIC_WARMLY_URL` (hardcoded production URL) for any external link.

---

### `git add warmly/app/send/[token]/page.tsx` fails in zsh

**Pattern**: Bracket characters in file paths are treated as glob patterns by zsh and fail silently or throw an error.

**Wrong**: `git add warmly/app/send/[token]/page.tsx`
**Right**: `git add warmly/` or `git add "warmly/app/send/[token]/page.tsx"`

---

## GitHub Actions Secrets

### Environment secrets are NOT picked up unless `environment:` is set in the workflow YAML

**Pattern**: Adding secrets via GitHub → Settings → Environments → [env name] → Secrets makes them invisible to workflows unless the workflow explicitly declares `environment: <name>`.

**Tell**: Secret shows in the GitHub UI but arrives as empty string in the workflow.

**Rule**: Only use Repository Secrets (Settings → Secrets → Actions), NOT Environment Secrets, for this project. Or: add `environment: production` to the workflow job.

---

## Audio Recording (MediaRecorder API)

### MIME type preference order matters — `audio/webm` is rejected by WhatsApp

**Pattern**: `audio/webm` is widely supported but WhatsApp rejects it. `audio/ogg;codecs=opus` and `audio/mp4` are accepted. iOS Safari only supports `audio/mp4`.

**Right order**:
```typescript
const mimeTypes = ['audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
const mimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
```

**Rule**: Always check `isTypeSupported()` and prefer ogg → mp4 → webm. Never hard-code `audio/webm`.

---

## Python / Testing

### All external API calls must be mocked — no live calls in tests

**Pattern**: Tests that make live calls to OpenAI, Twilio, or Supabase add cost, are non-deterministic, and fail in CI.

**Tell**: Tests pass locally (with real env vars) but fail in CI.

**Rule**: Every test that calls `tools/whatsapp.py`, `prompts/llm.py`, or `tools/warmly.py` must use `@patch` or `unittest.mock.patch` to mock the external client.

---

### `append_sent_log()` idempotency check must never be removed

**Pattern**: `append_sent_log()` checks if a `(person_name, occasion, year)` tuple already exists before appending. Without this check, syncing from Supabase multiple times creates duplicate entries, which breaks deduplication.

**Rule**: Never remove the existence check from `append_sent_log()`. The function is called from both the orchestrator and the sync path.

---

## Warmly Auth (Removed — Historical Reference)

### Supabase magic link email rate limit on free tier

**Pattern**: Supabase free tier limits magic link emails to ~3/hour per email address. Hitting this during testing looks like a broken flow.

**Tell**: "Email rate limit exceeded" error in the browser.

**Decision**: Auth was removed entirely from Warmly — the app is now publicly accessible (no login). This was a deliberate simplification.

---

## Feedback Loop

### Write back on user action (tap), not on load or a timer

**Pattern**: Fire-and-forget fetch calls for mark-sent, skip, etc. should happen immediately on the user's tap action. Tying them to page load or timers makes them unreliable and hard to debug.

**Rule**: `fetch('/api/mark-sent', { method: 'POST' }).catch(() => {})` on the same click handler as `window.open()`. Never await it. Never block the WhatsApp open on it.
