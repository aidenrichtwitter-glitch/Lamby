# Lamby Bridge — Lessons Learned

Updated after every significant discovery or failure. Newest entries at the top.

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
