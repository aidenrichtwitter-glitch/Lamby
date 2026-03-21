# Lamby Bridge — Lessons Learned

Updated after every significant discovery or failure. Newest entries at the top.

---

## Lesson 23: Windows line endings (\r) cause grok-write search/replace to fail silently
**Date:** 2026-03-21
**Context:** L3 test — grok-write to add `metrics: Metrics` to App.tsx PAGES map returned 0 replacements.
**Root cause:** The desktop project (groks-app) runs on Windows. Files have `\r\n` line endings. When grok-write receives a search string with `\n` line endings, it doesn't match `\r\n` in the file. Result: 0 replacements, no error — just silent failure.
**Evidence:** `JSON.stringify(settingsLine)` showed `"  settings: Settings\r"` — the trailing `\r` was invisible but broke the match.
**Impact:** Any grok-write search/replace that spans multiple lines or matches line endings will fail on Windows projects.
**Fix for prompts:** For App.tsx (small file <2KB), the L3 prompt now says: use grok-create with the full updated content instead of grok-write. Read → modify in memory → grok-create. This bypasses line ending issues entirely.
**Rule:** On Windows desktop projects, prefer grok-create (full file) over grok-write (search/replace) for any edit that involves line-ending-sensitive matching. grok-write is reliable only for single-line replacements where `\r` doesn't interfere.

---

## Lesson 22: grok-create fails silently when content exceeds browse_page URL length limit
**Date:** 2026-03-21
**Context:** Grok repeatedly reports grok-create "not working" for Metrics.tsx (4000+ char component).
**Root cause:** browse_page has an internal URL length limit (~2048-4096 chars). A 4000-char JSX component URL-encodes to ~7000 chars, making the full URL ~7100 chars — far exceeding the limit. The URL gets truncated or rejected before it reaches the relay.
**Evidence:** grok-create works perfectly from curl with any content size. The endpoint itself is fine. The issue is exclusively browse_page's URL handling.
**URL length math:**
- Base URL (relay + endpoint + project + path): ~150 chars
- JSX content expands ~1.74x when URL-encoded (quotes, angle brackets, spaces, newlines all encode)
- 1000 raw chars → ~1890 total URL ✅ (under 2048)
- 1500 raw chars → ~2760 total URL ⚠️ (exceeds 2048)
- 4000 raw chars → ~7110 total URL ❌ (far exceeds all limits)
**Fix:** For components > 1000 chars of content, MUST use grok-create-chunk:
- Split into chunks of ~800 raw chars each (each URL stays under ~1550 chars total)
- chunk=0 creates the file, chunk=1+ appends
- After final chunk, verify with grok-read
**Rule:** NEVER use grok-create for content > 1000 chars. ALWAYS use grok-create-chunk with ~800-char chunks. This is a hard browse_page limitation, not a relay issue.

---

## Lesson 21: L3 multi-agent parallel execution causes triple corruption
**Date:** 2026-03-21
**Context:** L3 "passed" per coord notes but post-test inspection revealed 3 critical issues that the multi-agent system missed.
**What went wrong:**
1. **App.tsx truncated to 31 chars** (`import React, { useState } from`) — grok-create for the PAGES map update failed mid-write, truncating the file. The summarizer couldn't detect this because it confused JSON response length with file content length.
2. **Navigation.tsx got 10 duplicate metrics entries** — Grok's multi-agent system (Lucas/Harper) each independently fired grok-write to add the metrics nav item. grok-write search/replace matched once per call, but 10 agents called it in parallel. Result: 10 identical `{ id: 'metrics', label: 'Metrics', icon: Activity }` entries.
3. **Dashboard.tsx committed with L2 comment header** — the L2 retry loop's corruption (406 chars with `// Bridge Test L2:` header) persisted and was included in the L3 commit.
**What I did to make it work (manual reference run):**
1. Reverted to pre-L3 state: `git checkout 7ba0736 -- src/components/App.tsx src/components/Navigation.tsx src/pages/Dashboard.tsx`
2. Created Metrics.tsx via grok-create (3808 chars, 102 lines) — worked first time
3. Updated App.tsx: grok-write for import worked, but grok-write for PAGES map failed (0 replacements — whitespace mismatch). Used grok-create with full updated file instead (948 chars) — worked.
4. Updated Navigation.tsx: grok-write search/replace for NAV_ITEMS worked — added exactly 1 metrics entry (Activity icon already imported)
5. Console check: 0 errors
6. Git add + commit: 125 insertions, 4 files changed — clean
7. Reverted everything back to clean baseline for Grok's next run
**Key findings:**
- **grok-write is unreliable for PAGES map updates** — whitespace/indent matching fails silently (0 replacements). For small files (<2KB), grok-create with full content is more reliable.
- **Multi-agent parallel grok-write causes duplicates** — the same search text matches in parallel calls before any has completed, so all succeed. Must add "DO NOT call grok-write more than ONCE per file" rule.
- **Verification after grok-write is essential** — must read the file back and check for exactly 1 occurrence of the added text.
**Prompt fixes needed:**
1. L3 prompt should say: "If grok-write returns 0 replacements, fall back to grok-create with the full updated file"
2. L3 prompt should say: "After updating Navigation.tsx, verify EXACTLY 1 metrics entry exists. If more than 1, STOP and report."
3. L3 prompt should say: "Check Dashboard.tsx is clean (no comment headers) before committing"

---

## Lesson 20: browse_page summarizer confuses JSON API response with file content
**Date:** 2026-03-21
**Context:** L2 PASSED, but Grok's agents noted unreliable content extraction during grok-read verification.
**Problem:** When Grok calls `browse_page` on a grok-read URL, the summarizer receives the full JSON response (e.g., `{"results":[{"data":{"content":"import React..."}}]}`). The summarizer often confuses the JSON envelope with the file content — reporting CHAR_COUNT: 614 / LINE_COUNT: 3 when the actual file is 97 chars. It extracts metadata from the JSON structure rather than parsing the nested `content` field.
**Impact:** Grok cannot reliably extract exact file content or char counts from grok-read via browse_page. This causes:
- Incorrect char count comparisons (e.g., "614 chars" vs actual "97 chars")
- Verification steps that compare char counts may falsely fail or falsely pass
- Multi-agent confusion when different agents get different summarizer interpretations
**Workarounds applied:**
1. L2 coord notes now use relative terms ("comment present", "original code intact") instead of exact char count comparisons
2. Verification relies on content markers ("starts with import", "has React.FC") not char counts
3. Stop rules prevent infinite retry when summarizer gives inconsistent results
**Future fix options:**
- Add a `?format=plain` param to grok-read that returns raw file content (not JSON) so browse_page summarizer gets clean text
- Add a `?charCount=true` param that returns just the character count as plain text
**Rule:** Never rely on browse_page's summarizer for exact char counts from JSON API responses. Use content markers (first line, key strings) for verification instead.

---

## Lesson 19: Grok multi-agent retries cause infinite loops — must add hard stop rules
**Date:** 2026-03-21
**Context:** L2 test completed but Grok's multi-agent system (Lucas/Harper) continued firing browse_page calls indefinitely, overwriting Dashboard.tsx continuously.
**Problem:** After the L2 test posted "L2 COMPLETE", the multi-agent system kept retrying earlier steps in parallel. Dashboard.tsx was being rewritten every few seconds with different content (96, 138, 309, 427, 551 chars observed in rapid succession). The coord board accumulated 20+ notes per minute. The file was never stable because writes never stopped.
**Root causes:**
- No browse_page call limit in the prompt
- No hard stop after posting the FINAL coord note
- No "do NOT loop back to earlier steps" instruction
- Coord dedup bypassed because Grok varied note text each retry (e.g., "430 chars" vs "551 chars" vs "~400 chars")
**Fix:** Added to shared header:
1. Global STOP RULES section: max 20 browse_page calls per level, max 2 retries per step, no looping back, test is DONE after final note
2. L2 prompt now has "STOP — NO MORE FILE WRITES" after step 7
3. Coord notes use EXACT fixed text (no variable char counts in notes) for dedup compatibility
4. Explicit "DO NOT MAKE ANY MORE BROWSE_PAGE CALLS" after final step
**Rule:** Every level prompt MUST include a browse_page limit, a retry cap, and a hard stop instruction after the final coord note. Without these, Grok's multi-agent system will loop indefinitely.

---

## Lesson 18: smartDecode on relay fixes double-encoding from browse_page
**Date:** 2026-03-21
**Context:** L2 tests showed grok-create failing because Grok's browse_page tool URL-encodes the entire URL, including content that's already URL-encoded — causing double-encoding (e.g., `/` → `%2F` → `%252F`).
**Problem:** After URLSearchParams parses the URL once, double-encoded values like `%252F` become `%2F` — still encoded, not the original `/`. This corrupts file content with literal `%2F` instead of slashes, `%0A` instead of newlines, etc.
**Fix:** Added `smartDecode()` helper to the bridge relay. It checks if a value still contains `%XX` patterns after normal parsing (using `/%[0-9A-Fa-f]{2}/`), and if so, runs one more `decodeURIComponent()` pass. Applied to content, search, and replace params on grok-create, grok-create-chunk, grok-write, and grok-edit.
**Result:** Normal strings pass through unchanged. Double-encoded strings get auto-fixed. No prompt changes needed.

---

## Lesson 17: Use git checkout for file restore — never re-write manually
**Date:** 2026-03-21
**Context:** L2 read-modify-write test required restoring Dashboard.tsx to its original state after adding test comments.
**Problem:** Grok attempted to "restore" by re-writing the file content via grok-create, but failed both times:
- Run 1: Wrote back only the 2-line comment (120 chars), losing the entire component.
- Run 2: Re-read the file (which already had stale comments from run 1) and wrote that back, accumulating 4 comment lines instead of removing them.
Grok cannot reliably track "original state" across multiple browse_page calls — it loses context or re-reads dirty state.
**Fix:** Changed L2-S7 to use `grok-run?cmd=git%20checkout%20HEAD%20--%20src/pages/Dashboard.tsx` instead of grok-create. Git checkout restores the exact committed version — guaranteed clean, no encoding issues, no content tracking needed.
**Rule:** For any test that modifies existing files and needs to restore them, ALWAYS use `git checkout HEAD -- <path>` via grok-run. Never ask Grok to manually re-write the original content.

---

## Lesson 16: Smart endpoints eliminate encoding failures
**Date:** 2026-03-21
**Context:** After 5 consecutive Phase 3 failures where every grok-proxy write_file call returned "payload must be valid base64-encoded JSON"
**Problem:** Grok could never reliably perform the `JSON.stringify → btoa → encodeURIComponent` encoding chain. Every Phase 3 run failed at the file creation step because the base64 encoding was wrong, truncated, or malformed. The bridge reported "payload must be valid base64-encoded JSON" on every attempt.
**Fix:** Deployed three new smart bridge endpoints that bypass encoding entirely:
  - `grok-create` — `GET /api/grok-create?project=X&path=Y&content=Z` — creates/overwrites a file. Content is URL-encoded (no base64, no JSON payload).
  - `grok-create-chunk` — `GET /api/grok-create-chunk?project=X&path=Y&content=Z&chunk=0&total=3` — chunked file creation for files >5KB.
  - `grok-delete` — `GET /api/grok-delete?project=X&path=Y` — deletes a file.
  Additionally, `grok-proxy` now accepts raw URL-encoded JSON (not just base64) as a fallback.
  All three endpoints confirmed PASS in bridge diag.
**Impact:** All prompt templates, level files, and `buildSandboxApiSection` updated to use `grok-create`/`grok-create-chunk`/`grok-delete` instead of `grok-proxy + write_file/delete_file`. The base64 encoding instructions are removed from file operation docs. grok-proxy is now only needed for `get_console_errors` and batched operations, and even those can use raw JSON instead of base64.

---

## Lesson 15: Phase 1-2 retest confirms write_file is 100% reliable
**Date:** 2026-03-21
**Context:** Phase 1-2 retest — running the exact same workflow Grok should follow, through the bridge
**Problem:** After 4 failed Phase 3 runs, needed to confirm the bridge itself works and that the write_file approach (read → modify → write whole file) is reliable.
**Results:**
  - Phase 1: Created Metrics.tsx (5120 chars, single write_file) — PASS. Updated App.tsx (read + modify + write_file) — PASS. Updated Navigation.tsx (same method) — PASS. Console clean. Git committed with 111 insertions, 3 deletions.
  - Phase 2: Removed Metrics import from App.tsx, removed nav item from Navigation.tsx, deleted Metrics.tsx. Console clean. Git committed. Clean slate.
  - All operations verified via grok-tree + grok-read at each step.
**Conclusion:** The bridge works perfectly. write_file (whole-file overwrite) is 100% reliable for both new files and overwriting existing files. The failures in Phase 3 runs 1–4 are not bridge issues — they're Grok not following the instructions (ignoring verification, hallucinating success, using chunked writes unnecessarily, not posting to coord).

---

## Lesson 14: Run 4 — Grok created Metrics.tsx but failed to update App.tsx, Nav.tsx, or commit
**Date:** 2026-03-21
**Context:** Phase 3 run 4 — had review stage + verification protocol + coord reporting instructions
**Problem:** Grok successfully created Metrics.tsx (6571 chars on disk, verified via grok-read). But App.tsx was UNCHANGED (no Metrics import, no route), Navigation.tsx was UNCHANGED (still has duplicate Activity import, no metrics nav item), and no git commit was made (Metrics.tsx shows as untracked `??`). Grok claimed "REVIEW COMPLETE: PASS" in its response — a complete fabrication. The review stage in the prompt was ignored.
**Fix:** Need to investigate WHY write_file works for new files but not for overwriting existing files. Possible cause: the write_file action may not be overwriting, or the base64 encoding of the full file content is being truncated. May need to test write_file overwrite separately.

---

## Lesson 13: Grok ignores coord reporting despite explicit instructions
**Date:** 2026-03-21
**Context:** Phase 3 run 4 — coord section said "MANDATORY" with specific checkpoint list
**Problem:** Despite a detailed "MANDATORY" section listing exactly when to post coord notes, Grok only posted during the discovery phase (20+ duplicate notes in 1 second) and then NOTHING for the remaining 12+ steps. The user had zero visibility into what happened after discovery.
**Fix:** Rewrote coord section as "NON-NEGOTIABLE — YOU FAILED THIS 4 TIMES" with exact templates for each numbered step (STEP 0 through STEP 15). Each step has a specific coord post format. Added rule: "Post ONCE per step, do NOT batch multiple steps into one post."

---

## Lesson 12: Grok sends oversized chunks (4KB+) causing silent truncation
**Date:** 2026-03-21
**Context:** Phase 3 runs — Grok creating files via write_file_chunk
**Problem:** Grok tries to maximize chunk size, sending 3000–4000+ character chunks. After base64 encoding + URL encoding, these produce URLs that exceed browse_page limits and get truncated. The chunk arrives corrupted or incomplete, and the file assembly silently produces garbage or fails entirely.
**Fix:** Updated write_file_chunk docs to say "MAX 1500 characters per chunk" and "More small chunks is ALWAYS safer than fewer large chunks." Added post-chunk verification requirement.

---

## Lesson 11: A review stage after task completion catches false success claims
**Date:** 2026-03-21
**Context:** Phase 3 run 3 — Grok claimed full success but bridge review showed otherwise
**Problem:** Grok reported a successful run (Metrics created, App/Nav updated, git committed). But a post-task review via the bridge revealed: Metrics.tsx was deleted (not created), App.tsx unchanged, Navigation.tsx still had duplicate imports, and the git commit only contained deletions. Without a review stage, the user would have believed Grok's summary.
**Fix:** Added mandatory "Review Stage" (steps 17–22) to the prompt. After completing all work, Grok must re-read every changed file, check the git diff stat, verify console errors, and post a structured pass/fail review to coord. This makes Grok's final self-assessment verifiable.

---

## Lesson 10: git add . commits deletions from earlier cleanup
**Date:** 2026-03-21
**Context:** Phase 3 run 3 — Grok deleted old Metrics.tsx as cleanup, then failed to create a new one
**Problem:** Grok deleted the leftover Metrics.tsx from a prior run as a "cleanup" step. Then attempted to create a new one via write_file_chunk, which silently failed. When Grok later ran `git add .` + `git commit`, the deletion was staged and committed. The commit showed `235 deletions(-)` and `0 insertions(+)` — the opposite of what was intended.
**Fix:** Added "KNOWN ISSUE: git add . COMMITS DELETIONS" section. New rule: Do NOT commit until ALL new files are verified present via grok-tree AND grok-read. Also: do not delete files during cleanup unless certain — deletions get committed if git add runs later.

---

## Lesson 9: write_file_chunk can silently fail to assemble
**Date:** 2026-03-21
**Context:** Phase 3 run 3 — Grok creating Metrics.tsx via 5 chunks
**Problem:** Grok used write_file_chunk with 5 chunks of ~1400 chars each. It claimed the file was 7290 chars and "verified via grok-read." But the file was never actually assembled on disk — grok-tree showed it missing, and the git commit deleted the old version. The chunk assembly silently failed, likely due to encoding issues in the base64 payloads ("proxy encoding issue encountered" per coord notes).
**Fix:** New rule: For files under 5KB, always use a single write_file action (not chunked). After ANY new file creation, verify with BOTH grok-tree (shows filesystem) AND grok-read (shows content). If either shows missing/empty, retry. grok-read alone can return stale cached data.

---

## Lesson 8: Grok posts duplicate coord notes
**Date:** 2026-03-21
**Context:** Phase 3 run 3 — Grok posting final status to /api/coord
**Problem:** Grok called the coord endpoint 12+ times with the exact same message. Likely caused by browse_page retrying or Grok re-calling the URL when the response was slow. The coord endpoint doesn't deduplicate.
**Fix:** Added explicit instruction: "POST ONLY ONCE per milestone — do NOT call the coord endpoint multiple times with the same message."

---

## Lesson 7: Grok should post progress to coord mid-task, not just at the end
**Date:** 2026-03-21
**Context:** Phase 3 — user has no visibility into what Grok is doing during a long autonomous run
**Problem:** Grok only posted to /api/coord at the very end of the task. The user has no way to monitor progress or catch failures early. If something goes wrong mid-run, the user only finds out after Grok finishes and claims success.
**Fix:** Added "Progress Reporting via /api/coord (MANDATORY)" section to the prompt with specific checkpoints: after discovery, after each file edit, after console checks, after screenshot, after git commit. Each note should be concise with specific details (file names, sizes, commit hashes).

---

## Lesson 6: The verification protocol works — Phase 3 succeeded on third attempt
**Date:** 2026-03-21
**Context:** Phase 3 run 3 — first run with the mandatory verification rules
**Problem:** Previous two runs failed because Grok ignored grok-write return values and hallucinated verification. After adding Rules A–E to the prompt, Grok successfully: created Metrics.tsx via write_file_chunk, overwrote App.tsx and Navigation.tsx via write_file (not search/replace), verified each edit via grok-read, committed to git (hash confirmed), and posted to coord.
**Fix:** N/A — this validates that the verification protocol works. Key factor: telling Grok to use write_file (whole-file overwrite) instead of grok-write (search/replace) for critical edits eliminated the whitespace mismatch problem entirely.
**Impact:** Confirms write_file > grok-write for reliability. Prompt structure validated.

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
