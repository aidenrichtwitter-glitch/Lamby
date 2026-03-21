# Lamby Bridge — Lessons Learned

Updated after every significant discovery or failure. Newest entries at the top.

---

## Lesson 5: Prefer write_file over grok-write for critical edits
**Date:** 2026-03-21
**Context:** Phase 3 stress tests — Grok editing App.tsx and Navigation.tsx
**Problem:** grok-write (search/replace) is fragile. Whitespace, line endings, or invisible character differences cause the search string to not match, returning `{replacements: 0}` silently.
**Fix:** For files under ~200 lines, read the entire file with grok-read, modify the content, and write it back as a whole using grok-proxy + write_file. This bypasses the string-matching problem entirely.
**Impact:** Prompt updated with Rule E recommending write_file for small files.

---

## Lesson 4: Grok does not check grok-write return values
**Date:** 2026-03-21
**Context:** Two consecutive Phase 3 runs where Grok claimed all edits succeeded
**Problem:** grok-write returns `{"results":[{"path":"file","replacements":0}]}` when the search text doesn't match. Grok ignores this response and assumes the edit worked. It then "verifies" by claiming it called grok-read, but the file is unchanged.
**Fix:** Added Mandatory Verification Protocol (Rules A–E) to the Phase 3 prompt:
  - Rule A: Check replacements count after every grok-write
  - Rule B: Re-read file after every edit to confirm changes are present
  - Rule C: Check git commit response for "nothing to commit"
  - Rule D: Don't claim verification without actually calling grok-read
  - Rule E: Prefer write_file over search/replace
**Impact:** Prompt now explicitly calls out previous failures and demands response checking.

---

## Lesson 3: Grok introduces duplicate imports
**Date:** 2026-03-21
**Context:** Phase 3 — Grok editing Navigation.tsx to add a Metrics nav item
**Problem:** Grok added `Activity` to the lucide-react import line without checking it was already imported. Result: `import { ..., Activity, Activity } from 'lucide-react'` — a duplicate import that could cause warnings or errors. Meanwhile, the actual NAV_ITEMS array was never updated (the grok-write for that part silently failed).
**Fix:** Prompt now instructs Grok to read the full file first before any edit, and to use write_file to overwrite the entire file rather than surgical search/replace on individual sections.

---

## Lesson 2: allowed_domains must include the bridge relay domain
**Date:** 2026-03-21
**Context:** Phase 3 — Grok-4 calling browse_page to reach bridge endpoints via xAI Responses API
**Problem:** The `/api/grok-browse` endpoint was only listing the app's own domain in `allowed_domains`. Grok-4 needs to browse the bridge relay domain (`janeway.replit.dev`), which is a separate app. Without it in allowed_domains, Grok's browse_page tool couldn't reach the bridge.
**Fix:** Added `BRIDGE_RELAY_DOMAIN` constant to vite.config.ts and included it in the `allowed_domains` array alongside the app's own `relayDomain`.

---

## Lesson 1: The project field must be inside each action object
**Date:** 2026-03-21
**Context:** Early Phase 3 testing — grok-proxy write_file calls
**Problem:** Putting `project` only in the URL query param (`?project=groks-app`) is not enough. The bridge dispatcher looks for `project` inside each action object in the payload JSON. Without it, files get written to the wrong directory or the action fails silently.
**Fix:** Prompt explicitly states: `"project" field MUST be inside EACH action object`. Example payload: `{"actions":[{"type":"write_file","project":"groks-app","path":"...","content":"..."}]}`

---

## Lesson 0: Screenshot method ordering matters
**Date:** 2026-03-21
**Context:** Screenshot verification during Phase 3 testing
**Problem:** `fastScreenshot()` in sandbox-dispatcher.cjs was only trying methods 3 (CDP connect) and 4 (persistent Puppeteer). When both failed (e.g., Electron not exposing CDP on port 9222), screenshots fell through to "none" with no fallback. Desktop-capture methods (PowerShell, screenshot-desktop) were removed entirely.
**Fix:** Restored all 5 methods in priority order: 3 (CDP) → 4 (Puppeteer) → 2 (PowerShell CopyFromScreen) → 1 (screenshot-desktop). App-capture methods first, desktop-screen methods as last resort. Always better to get a desktop screenshot than no screenshot.
