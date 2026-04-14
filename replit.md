<!-- AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag | Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting. | Read docs/no-reply-system.md for the no-reply protocol. -->
# 🔇 NO-REPLY MODE — CHECK FIRST, EVERY TIME

**STATUS FILE: `.local/no-reply-mode.flag`** — Read this file BEFORE generating ANY response.

- **`on`** → NO-REPLY MODE ACTIVE:
  - Do NOT generate conversational text. No greetings, no explanations, no narration, no summaries, no "let me...", no "I'll...", no "here's what I did".
  - Your ONLY outputs are: tool calls and a final structured result.
  - Final result format: `{"done":true,"actions":["file:edited:X","test:passed"],"issues":[]}`
  - Chain all tool calls in parallel when possible. Retry errors 3x silently.
  - ONE clarifying question allowed if truly blocked — no preamble, just the question.
  - **MANDATORY: You MUST still read and follow ALL rules below this section in this file.** No-reply mode only changes your output format — it does NOT exempt you from any operational rules, bridge protocols, coordinate systems, or workflow procedures documented in this file or in `BRIDGE_MAP.md`. Read them. Follow them. Every time.
- **`off`** → Normal conversational mode.
- **Default: `on`**. Flag file ships with `on`. Agent starts silent every session.
- **User toggles**: "no reply mode on" / "silent mode" → write `on`. "no reply mode off" / "talk mode" → write `off`.

---

# Lamby — AI-Powered Autonomous Development Loop

> **🚨 MANDATORY: READ `BRIDGE_MAP.md` (dev reference) or `GROK_BRIDGE_MAP.md` (Grok GET-only reference) BEFORE EVERY ACTION. These are the exhaustive references for every endpoint, coordinate, tool position, and system detail. Do NOT guess at URLs, coordinates, or parameters — look them up first. This is non-negotiable.**
>
> **Two bridge maps exist:**
> - `GROK_BRIDGE_MAP.md` — Clean, GET-only reference for Grok. ALL endpoints are GET requests. This is what gets served via `/api/grok-chat-prompt`. No POST anywhere.
> - `BRIDGE_MAP.md` — Full dev reference for Replit agent. Includes POST variants, internal procedures, chunked upload scripts, etc.

## ⚡ CHROME & WEBSITE CONTROL — EXACT PROCESS (MANDATORY, NO EXCEPTIONS)

### Step 1: Kill any existing Chrome (if needed)
```
curl "$TUNNEL/api/grok-do?confirm=yes" -H "Content-Type: application/json" \
  -d '{"steps":[{"type":"run_command","command":"taskkill /F /IM chrome.exe","project":"__system__"}]}'
```

### Step 2: Launch Chrome (FIRST TIME ONLY — never again after this)
```
curl "$TUNNEL/api/grok-do" -H "Content-Type: application/json" \
  -d '{"steps":[{"type":"run_command","command":"start chrome https://YOURURL.com","project":"__system__"}]}'
```
- This auto-launches with `--remote-debugging-port=9222` + `LambyChromeProfile`
- Dispatcher auto-detects `start chrome`, spawns with CDP, waits for CDP confirmation
- Response includes `_cdpConfirmed: true` and a snapshot when ready
- NEVER use chain format for this — ONLY the steps JSON above

### Step 3: Navigate to new pages (AFTER Chrome is already open)
```
curl "$TUNNEL/api/grok-do" -H "Content-Type: application/json" \
  -d '{"steps":[{"type":"cdp_navigate","url":"https://NEWURL.com","project":"__system__"}]}'
```
- NEVER use `start chrome` again — it relaunches Chrome and breaks CDP

### Step 4: Interact with the page
```
# See what's on the page (buttons, links, text):
{"steps":[{"type":"cdp_eval","code":"(() => { const btns = [...document.querySelectorAll('button, a')].filter(e => e.offsetParent !== null).map(e => ({ tag: e.tagName, text: (e.textContent||e.title||e.ariaLabel||'').trim().slice(0,60) })); return JSON.stringify(btns.slice(0,50)); })()","project":"__system__"}]}

# Click something by finding it with JS:
{"steps":[{"type":"cdp_eval","code":"(() => { const el = [...document.querySelectorAll('a,button')].find(e => e.textContent.trim() === 'Play'); if (el) { el.click(); return 'Clicked'; } return 'Not found'; })()","project":"__system__"}]}

# Click by CSS selector:
{"steps":[{"type":"cdp_click","selector":".my-button","project":"__system__"}]}

# Type text:
{"steps":[{"type":"cdp_type","selector":"input.search","text":"hello world","project":"__system__"}]}

# Take a snapshot (page title + elements):
{"steps":[{"type":"cdp_snapshot","project":"__system__"}]}

# Draw/drag on canvas (page coordinates, no DPI issues):
{"steps":[{"type":"cdp_drag","x1":300,"y1":300,"x2":600,"y2":500,"project":"__system__"}]}
```

### RULES — NEVER BREAK THESE
1. ALL browser commands use `{"steps":[...]}` JSON POST body — NOT chain format
2. `start chrome URL` = LAUNCH (once). `cdp_navigate` = GO TO URL (every time after)
3. NEVER use `start chrome` to navigate — it relaunches Chrome and kills CDP
4. ALWAYS use `project":"__system__"` in every step
5. To find elements: use `cdp_eval` with querySelectorAll, NOT snapshot elements (they can be empty on dynamic sites)
6. To click: use `cdp_eval` with `.click()` or `cdp_click` with CSS selector
7. `confirm=yes` query param needed for destructive commands (taskkill, etc.)

## ⚡ SEEING THE DESKTOP — STREAM + COORDINATE MAPPING (MANDATORY)
**ALWAYS use `/api/desktop-frame` to see the screen. NEVER use screenshot_window or cdp_snapshot.**
```
Get frame:     GET /api/desktop-frame              (JPEG of ENTIRE desktop — VirtualScreen capture)
Get frame:     GET /api/desktop-frame?source=cdp   (JPEG of Chrome tab only)
Screen info:   GET /api/screen-info                (screen dimensions, DPI, monitor layout)
Stream viewer: GET /api/desktop-stream             (HTML viewer with live coord overlay + calibrate button)
```
### CLICK CALIBRATION SYSTEM
Run calibration once after startup to eliminate any coordinate drift:
```
GET /api/calibrate-run       — Auto-calibrate (moves cursor to 5x5 grid, measures offset/scale)
GET /api/calibrate-run?grid=8 — Higher precision (8x8 = 64 points)
GET /api/calibrate-map       — Read saved calibration (scale, offset, formula)
GET /api/calibrate           — Show calibration grid HTML page (visual)
```
After calibration, ALL mouse actions auto-correct coordinates using the saved mapping.
Calibration data is saved to `~/.guardian-ai/click-calibration.json`.
To bypass for a single action, pass `"raw": true`.

### COORDINATE MAPPING — HOW IT WORKS
- Desktop frame captures the **entire screen at full physical resolution** (3840x2160)
- hw.exe is **DPI-aware** and uses **physical coordinates** (3840x2160)
- **Screenshot pixel position = hw.exe coordinate. No conversion needed.**
- Example: if something is at pixel (1920, 1080) in the frame image → `hw.exe click 1920 1080`
- Everything is physical. No logical coordinates anywhere.

## ⚡ QUICK REFERENCE — MS PAINT DRAWING (Physical Coords 3840×2160)

> **All coordinates verified via Action Recorder. hw.exe is DPI-aware. Screenshot pixels = hw.exe coords.**

### Tunnel & hw.exe
| Field | Value |
|-------|-------|
| **Active Tunnel** | Check BRIDGE_MAP.md Section 1 for current URL |
| **hw.exe Path** | `C:\Users\Aiden\Desktop\Lamby\hw.exe` |
| **hw.exe via bridge** | `GET {BRIDGE}/api/grok-run?project=__system__&cmd=C:\Users\Aiden\Desktop\Lamby\hw.exe COMMAND` |
| **Commands** | `click X Y`, `rclick X Y`, `dclick X Y`, `move X Y`, `drag X1 Y1 X2 Y2 [steps]`, `key COMBO`, `type TEXT` |

### Canvas Boundaries (100% zoom, verified)
- **Drawing area**: x=550–2050, y=530–1200
- **Full bounds**: x≈490–2115, y≈490–1240
- **Canvas size**: 2313×1082 Paint pixels

### Tool Selection (click positions OR keyboard shortcuts)
| Tool | Click Position | hw.exe key |
|------|---------------|------------|
| Pencil | `click 1056 461` | `key p` |
| Fill bucket | `click 1109 445` | `key b` |
| Eraser | `click 1118 544` | `key e` |
| Color picker | `click 1233 441` | `key i` |
| Text | — | `key t` |
| Line | — | `key l` |
| Rectangle | — | `key r` |
| Oval | — | `key o` |
| Undo | `click 1020 87` | `key ctrl+z` |
| Redo | `click 1055 87` | `key ctrl+y` |
| Save | — | `key ctrl+s` |
| Save As | — | `key ctrl+shift+s` |

### Color Palette (click positions — Row 1 / Row 2)
| # | Row 1 (x,y) | Row 2 (x,y) | Colors |
|---|-------------|-------------|--------|
| 1 | (2257,440) | (2261,486) | Black / White |
| 2 | (2316,425) | (2316,497) | Gray / Lt Gray |
| 3 | (2379,427) | (2372,499) | Dk Red / Rose |
| 4 | (2441,433) | (2441,488) | Red / Lt Red |
| 5 | (2493,437) | (2493,490) | Orange / Lt Orange |
| 6 | (2552,429) | (2548,493) | Yellow / Lt Yellow |
| 7 | (2619,426) | (2616,493) | Green / Lt Green |
| 8 | (2672,430) | (2662,502) | Turquoise / Lt Turq |
| 9 | (2744,434) | (2726,492) | Indigo / Lavender |
| 10 | (2796,426) | (2803,487) | Purple / Lt Purple |
| Edit | (2924,493) | — | Color dialog |

### Brush Size — CRITICAL
The left panel has a vertical Size slider. When too thick:
- **Drag the size slider to minimum**: drag the handle from top to bottom of the slider track
- The slider is in the left panel alongside the canvas (approximately x=300, track runs y≈500–880)
- **Always verify brush thickness** with a short test stroke + screenshot before drawing

### Focus Lock System (MANDATORY for all GUI work)
Before any multi-step GUI workflow, lock focus to prevent drift:
```
GET {BRIDGE}/api/grok-focus?title=Paint          # Lock focus — all clicks/keys auto-focus Paint
GET {BRIDGE}/api/grok-focus                       # Check current lock
GET {BRIDGE}/api/grok-focus?clear=yes             # Remove lock
```
Focus is also set by `focus:TITLE` in chains or `grok-bring-to-front`. With focus lock active, every `click_at`, `send_keys`, `paste`, `drag`, `mouse_*`, `scroll` auto-calls `bring_window_to_front` first.

### Bridge Throughput
- **500+ concurrent requests at 100% success rate** (tested: 355 req/s at 300 concurrent, 639 req/s burst)
- Global limit: 6000 calls/min (was 60). Per-type cooldowns: 0ms (was 1.5-8s). Click dedup: 500ms (was 30s).
- Nav loop threshold: 20 navs/min (was 4). Launch cooldown: 500ms (was 8s).
- Bridge NEVER returns errors to Grok — all responses are 200 OK with `success:true`

### Painting Procedure (MANDATORY ORDER)
1. Focus Paint: `GET {BRIDGE}/api/grok-focus?title=Paint` (locks focus for entire session)
2. Reduce brush size (drag slider down or click bottom of slider track)
3. Select Pencil: `hw.exe key p`
4. Select Black: `hw.exe click 2257 440`
5. **Draw ALL outlines first** (closed shapes — horizon, mountains, house, trees, sun, river)
6. Select Fill bucket: `hw.exe key b`
7. **Fill each region** by clicking the color, then clicking inside the enclosed area
8. Save: `hw.exe key ctrl+s`
9. Screenshot to verify: `GET {BRIDGE}/api/desktop-frame?source=desktop&cursor=1&nogrid=1&t=TIMESTAMP`

### Efficient Drawing (batch commands)
- Create a `.bat` file with all hw.exe commands, upload via `POST {BRIDGE}/api/remote-update`, execute via `grok-run`
- Each individual `grok-run` call takes ~3s — batch into .bat for speed
- Use 50+ steps for smooth drawing strokes: `hw.exe drag X1 Y1 X2 Y2 60`

### Evidence
- **Evidence dir**: `C:\Users\Aiden\Desktop\godmode-evidence\`
- Save via: `hw.exe key ctrl+s` or Save As dialog

### RULES
- **ALL Paint input via hw.exe ONLY** — SendKeys does NOT work in Paint
- **Never use localhost or port 3000** — always use the tunnel URL from BRIDGE_MAP.md
- **Verify every action** with a desktop-frame screenshot
- **Full reference**: See BRIDGE_MAP.md for complete endpoint docs, keyboard shortcuts (Section 18), and rules

### WORKFLOW FOR EVERY ACTION
1. **CALIBRATE** (once per session): `GET /api/calibrate-run`
2. **BEFORE**: Download `/api/desktop-frame` → read it → see current state
3. **ACT**: Send the command (click, drag, type, etc.)
4. **AFTER**: Download `/api/desktop-frame` → read it → verify it worked
5. **REPEAT** — never skip verification, never guess blindly

## ⚡ HARD RESTART (seamless — returns new tunnel URL)
```
POST /api/hard-restart?confirm=yes
```
- Launches a NEW independent Lamby instance (port 4101) via PowerShell `Start-Process`
- Polls `_new_tunnel_url.txt` until the new instance writes its tunnel URL
- Returns `{ newTunnelUrl: "https://..." }` through the OLD tunnel
- Then kills old cmd window (by PID) and old relay exits
- Without `?confirm=yes`, returns a warning (safety guard)
- Flow: push code → soft-reload (`/api/restart-relay`) → hard restart → use new tunnel URL

## Overview
A self-evolving development environment with AI-powered code evolution (formerly "λ Recursive" / "Guardian AI"). The system autonomously scans, reflects on, and improves its own source code, acquiring capabilities and tracking evolution levels.

## Blender 5.1.0 Python API Reference
- **BRIDGE_MAP.md Section 0D** and **GROK_BRIDGE_MAP.md Section 17** contain the complete, live-queried Blender 5.1.0 Python API reference
- Covers: render engines, sky types, viewport shading, Principled BSDF inputs, object modes, light types, image formats, mesh primitives, all shader nodes, blend modes, particle types, safe Python patterns
- Key gotchas: `NISHITA` sky type removed (use `HOSEK_WILKIE`), `BLENDER_EEVEE_NEXT` invalid (use `BLENDER_EEVEE`), `mat.use_nodes = True` works but deprecated for 6.0
- Crystallized as skill: `blender:api-reference-5.1` (21 total skills in memory, including `blender:anime-cel-shade-scene` 12-step recipe, `blender:sketchfab-glb-import` 8-step pipeline, `blender:landscape-scene-v6` 10-step recipe)

## Architecture
- **Frontend-only SPA**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Hosted Supabase (PostgreSQL database + Edge Functions)
- **No server-side code in this repo** — all backend logic runs on Supabase Edge Functions

## Key Technologies
- React 18, React Router v6, TanStack Query
- Vite 5 (dev server on port 5000)
- Tailwind CSS + shadcn/ui components
- Supabase JS client for database access
- Monaco Editor for code viewing
- Framer Motion for animations
- PWA support via vite-plugin-pwa

## Parallax Mode
- Toggle in header (top-right) enables/disables 3D parallax effect on entire IDE
- Two tracking modes: **Mouse** (cursor position) and **Head** (webcam + MediaPipe face detection)
- Uses CSS3DRenderer with viewport-proportional room walls (back, left, right, top, bottom)
- Head tracking loads MediaPipe Face Detection scripts on-demand from CDN
- State persisted in localStorage (`parallax-enabled`, `parallax-tracking-mode`)
- Files: `src/lib/parallax-context.tsx` (provider), `src/components/ParallaxScene.tsx` (3D layer), `src/components/ParallaxControls.tsx` (UI)

## PROTECTED FILES — DO NOT MODIFY
The following toolbar/button sections are critical and must NOT be removed or altered during parallax/layout changes:
- **GrokBridge top toolbar** (lines ~3540-3640 in `src/pages/GrokBridge.tsx`): Contains AI Bridge, Main App, Browser, API, Auto, Context, Evolve buttons and the AI provider tabs (Grok, X, ChatGPT, Claude, GitHub, Perplexity)
- **GrokBridge bottom bar** (lines ~4140-4185 in `src/pages/GrokBridge.tsx`): Contains CODE EXTRACTOR, Paste Response, Copy Context, Edit buttons
- **AppLayout header** (`src/components/AppLayout.tsx` lines 17-24): Contains SidebarTrigger and ParallaxControls
- When modifying parallax wall sizing or layout, NEVER remove or clip these toolbar sections

## LOCKED — BRIDGE CONNECTION CODE — KEY REQUIRED: "leaveitalone"
The following files and code sections are PERMANENTLY LOCKED. The agent MUST NOT modify, rewrite, refactor, or touch any of these files or their connection logic under ANY circumstances — not even to "fix" or "improve" them — unless the user provides the exact unlock key "leaveitalone" in their message.

**Locked files (do NOT edit):**
- `server/bridge-connector.cjs` — Desktop connector (raw TLS sockets, wsEncodeFrame, wsDecodeFrame, doConnect, send)
- `electron-browser/src/local-server.js` — Desktop local server (HTTP + bridge connector startup, file logging, EADDRINUSE handling)
- `lamby-bridge/index.js` — Relay server source (reference copy)

**Locked code sections (do NOT edit):**
- `connectToBridge()` function in `src/pages/GrokBridge.tsx` — Browser WebSocket connection
- Dev/Production button onClick handlers in `src/pages/GrokBridge.tsx` (the relay mode toggle buttons)
- Relay URL constants in GrokBridge.tsx (legacy WebSocket URLs)
- The `electron:dev` script in `package.json` — three-process concurrently command (vite, electron, bridge)

**What this means:**
- If a task or request would require changing any of the above, STOP and ask the user for the unlock key first.
- Do NOT silently modify these as part of a larger refactor or feature.
- Do NOT replace raw TLS sockets with any WebSocket library (ws, socket.io, etc.) — EVER.
- Do NOT remove or change the third `bridge` process from the `electron:dev` concurrently command.
- Do NOT change the file logging setup in local-server.js (writes to `~/.guardian-ai/local-server.log`).
- The connection code works. Leave it alone.

## Project Structure
```
src/
├── App.tsx                    # Router setup with 4 pages
├── main.tsx                   # Entry point
├── pages/
│   ├── Index.tsx              # Main IDE view with autonomous recursion loop
│   ├── Evolution.tsx          # Evolution visualization
│   ├── PatternAnalysis.tsx    # Pattern analysis / evolution cycle view
│   ├── GrokBridge.tsx         # AI bridge (Grok Desktop launcher + API chat + clipboard extractor)
│   └── NotFound.tsx
├── components/                # UI components (AIChat, CodeViewer, FileTree, etc.)
│   ├── LogsPanel.tsx          # Preview console log capture panel (errors/warnings from iframe)
│   ├── ProjectExplorer.tsx    # Sub-project file tree + GitHub import UI
│   ├── ParallaxScene.tsx      # 3D parallax wrapper with CSS transforms + head/mouse tracking
│   └── ParallaxControls.tsx   # Parallax toggle + mode switch UI
├── integrations/supabase/     # Supabase client + generated types
├── lib/                       # Core logic libraries
│   ├── recursion-engine.ts    # Main recursion loop engine
│   ├── goal-engine.ts         # Self-directed goal system
│   ├── cloud-memory.ts        # Supabase persistence layer
│   ├── safety-engine.ts       # Change validation
│   ├── self-source.ts         # Virtual file system
│   ├── evolution-bridge.ts    # Grok↔Evolution pipeline (context builder, Grok API caller, code applicator, plan manager)
│   ├── autonomy-engine.ts     # Autonomous goal execution (code-gen steps route through Grok evolution)
│   ├── ollama-toaster.ts      # Ollama "toaster" — dumb pre/post-processor for context bundling + response cleaning
│   ├── guardian-config.ts     # Shared GitHub org config (PAT, org name)
│   ├── guardian-publish.ts    # Publish successful builds to shared GitHub org with GUARDIAN-META.json
│   ├── guardian-knowledge.ts  # Knowledge registry — query shared org for past builds, rank matches
│   ├── error-recovery.ts      # Universal error classification engine + auto-fix strategies + rate limiting
│   ├── error-reporter.ts      # Client-side error reporting (window.onerror, unhandledrejection → recovery)
│   └── [50+ capability libs]  # Auto-generated capability modules
├── components/
│   ├── ErrorBoundary.tsx       # React error boundary with auto-recovery UI
electron-browser/              # Grok Desktop Electron app (based on AnRkey/Grok-Desktop)
├── src/main.js                # Electron main process — creates BrowserWindow, registers all IPC handlers, starts local server
├── src/grok-ipc-handlers.js   # Grok DOM monitoring IPC handlers (v26.2) — multi-pattern selector fallback chains
├── src/claw-agent-bridge.js   # Claw autonomous agent loop — runs AI model iteratively with tool calling (up to 20 iterations)
├── src/claw-tools.js          # 23 Claw agent tools — files, shell, desktop control, CDP browser, git, utility
├── src/claw-ipc-handlers.js   # Claw agent IPC handlers — start/abort/status/session management
├── src/preload.js             # Preload script
├── src/renderer.js            # Renderer process
├── src/custom-tabs.js         # Tab management
├── index.html                 # Browser UI with tabs, usage stats
├── styles.css                 # Browser styles
├── about.html                 # About dialog
└── package.json               # Electron deps (run npm install separately)
supabase/
├── functions/                 # Edge Functions (self-recurse, grok-chat, etc.)
├── migrations/                # Database migrations
└── config.toml
```

## Environment Variables
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` — Supabase project ID

## CRITICAL: User Environment
- **The user ALWAYS works in the desktop Electron app, NEVER in the Replit web preview.**
- **Code delivery**: The user uses the **Download Source** button in Replit to get the latest code onto their Windows machine. After any code changes, remind them to re-download.
- **NEVER tell Grok to respond with JSON `{"actions":[...]}` format.** That is a dead format. Grok's output rules: (1) READ files via bridge grok-read endpoints, (2) SMALL edits via grok-write search/replace, (3) LARGE file rewrites via `// file: path\n```tsx\n[COMPLETE content]\n``` ` auto-apply blocks. This rule applies to ALL prompt builders: diagnose-fix, error feedback, vision fix.
- All code changes must be tested and validated for the Electron context.
- `local-server.js` and `vite.config.ts` must ALWAYS be 1:1 mirrors (IPC handlers in `main.js` are Electron-only — exempt from mirror rule).

## Packaged Exe Architecture
- In packaged mode, `main.js` loads `http://localhost:4999` (NOT `file://`) — the local server serves the `dist/` static files AND all `/api/` routes from port 4999.
- `main.js` uses `waitForLocalServer()` to poll the local server's `/health` endpoint before loading the URL, with a `file://` fallback if the server never responds.
- This means `HashRouter` is NOT needed — the app always loads via HTTP, so `BrowserRouter` works everywhere.
- All `fetch('/api/...')` calls in the frontend naturally resolve to `localhost:4999/api/...` without needing URL rewriting.
- The local server has static file serving at the bottom of its route handler, serving `dist/` with proper MIME types and SPA fallback (non-file paths → index.html).
- Missing routes from vite.config.ts that are NOT available in desktop mode: `/api/grok-responses`, `/api/grok-browse`, `/api/grok-fix`, `/api/validate-file`, `/api/programs/install`, `/api/download-source` — these return 501 "Not available in desktop mode".
- When making changes to browser-mode IPC handlers in `main.js`, always add visible logging so the user can see what's happening in Electron DevTools.
- Include `BROWSER_MODE_VERSION` (currently `v26.2`) in both `grok-ipc-handlers.js` and `GrokBridge.tsx` — version mismatch warnings appear in status bar and console when Electron hasn't been rebuilt with latest code.
- `grok-ipc-handlers.js` is a standalone module exporting `registerGrokIpcHandlers(getWebviewContents?)`. If no getter is passed, it auto-finds the Grok webview via `webContents.getAllWebContents()`. User's `main.js` must `require('./grok-ipc-handlers')` and call `registerGrokIpcHandlers()` after app ready.
- **Browser automation API**: `window.__grokBrowserAutomation.sendAndCapture(prompt, label)` — exposed by GrokBridge, returns `{success, responseText, error}`. Used by evolution-bridge for browser-based evolution cycles.
- **Evolution sandbox**: `ensureEvolutionSandbox()` in `project-manager.ts` creates `evolution-sandbox` project via `duplicateProject()`. Browser-evolve writes to sandbox instead of main project.
- **Grok 4 default**: Evolution cycles default to `grok-4` model. The model selector still lists all Grok models for interactive chat.
- **Evolve button**: Clicking the Evolve button in GrokBridge's toolbar automatically runs a full evolution cycle via xAI API (Grok 4). Streams response into chat, applies code blocks, registers capabilities, saves next plan. No clipboard copy needed.
- Readiness detection: `grok-check-response-ready` only checks `__isGenerating()`. The polling loop tracks the generating→stopped transition. Once Grok stops generating, a 500ms delay lets the UI mount, then `grok-copy-last-response` extracts the text (clicks native copy button or falls back to DOM scrape). No signal counting needed.
- Manual send detection: A background watcher (3s interval) calls `grok-check-response-ready` to check if Grok is generating without the app having sent a prompt. If detected, it starts a polling loop that waits for generation to stop, then extracts the response after a 500ms UI mount delay.

## Lamby Bridge Relay — Local + Remote Architecture
The Bridge Relay can now run **locally inside the Electron desktop app** (embedded) or as a remote server:

### Local Relay (Embedded — NEW)
- **File**: `server/bridge-relay-local.cjs` (4305 lines, zero npm dependencies)
- **Port**: `4100` (configurable via `RELAY_PORT` env var)
- **Lifecycle**: Spawned by `main.js` via `startLocalRelay()` on Electron startup. Auto-restarts on crash (3s delay).
- **Cloudflare Tunnel**: Auto-downloads `cloudflared` to `~/.guardian-ai/tools/`, runs `cloudflared tunnel --url http://localhost:4100` to get a public `https://...trycloudflare.com` URL. No Cloudflare account needed.
- **Connector auto-detection**: `local-server.js` probes `http://localhost:4100/health` — if alive, connects to `ws://localhost:4100/bridge-ws` instead of remote relay.
- **UI**: GrokBridge settings panel shows local relay status (running/stopped), port, tunnel URL with copy button, and restart button.
- **IPC handlers**: `local-relay-status` (returns running/port/localUrl/tunnelUrl/tunnelActive), `restart-local-relay` (stops + restarts relay + tunnel)
- **Shutdown**: `stopLocalRelay()` kills both relay and tunnel processes on app quit.

### Remote Relay (Fallback)
- **Active tunnel**: Cloudflare tunnel (changes each session — check BRIDGE_MAP.md for current URL)
- **Relay source**: `server/bridge-relay-local.cjs` runs on the desktop via `node bridge-relay-local.cjs`.
- **Desktop connector**: `server/bridge-connector.cjs` runs on the user's local machine inside the Electron app. It connects TO the relay via WebSocket.
- **Browser connector**: `connectToBridge()` in `GrokBridge.tsx` connects to the relay via browser WebSocket API. Both desktop and browser use the same relay.
- **Connection URL pattern**: `wss://<relay-host>/bridge-ws?project=<PROJECT_NAME>` — no auth keys, the URL itself is the security boundary.
- **How it works**: Clients (desktop or browser) connect via WebSocket to the relay. The relay forwards snapshot/sandbox requests between Grok (via HTTP API) and the connected client. The client responds with local project data.
- **Key rule**: This app's Vite dev server and the relay are unrelated servers. Never confuse API calls to this app's backend (`/api/...` relative URLs) with API calls to the relay (`https://<relay-host>/api/...` absolute URLs).

### Action Recorder v2
- **Source**: `action_recorder.cs` (in repo root, deployed to desktop)
- **Endpoint**: `/api/action-recorder?action=start|stop|status|read|sessions|crystallize`
- **UI**: "Record" button in GrokBridge toolbar (orange, next to Desktop Prompt)
- **Captures**: Mouse moves (sampled), clicks with hold duration, full drag paths (every point + timing), key down/up with combos, scroll, window/process/UI element context
- **Output**: `recordings/session_YYYYMMDD_HHMMSS/actions.json` (machine-parseable) + `actions.log` (human-readable) + crop/full screenshots
- **Crystallize**: Convert any session to a reusable Crystal memory skill via `?action=crystallize&session=latest&name=skill-name`

## Grok Bridge Workflow — THE CORE FLOW
This is the primary way the user works with Grok to make code changes:
1. **User clicks "Copy Context"** in Lamby → prompt is copied to clipboard (contains bridge API instructions + project name + task)
2. **User pastes into Grok** on grok.com
3. **Grok reads the prompt**, sees the bridge endpoint URLs, uses its `browse_page` tool to call them
4. **Bridge relay forwards** requests to user's desktop Lamby app via WebSocket
5. **Changes happen** on the user's local project files

**This app does NOT call Grok's API to make bridge changes.** Grok does the work itself through `browse_page` hitting the bridge URLs. This app just generates the prompt.

### Prompt Template
- **File**: `public/grok-prompt-template.txt` — the editable prompt that gets sent to Grok
- **Placeholders**: `{{PROJECT}}` (project name), `{{RELAY_BASE}}` (relay URL), `{{TASK}}` (user's current task)
- `buildProjectContext()` in GrokBridge.tsx reads this file when bridge is online; falls back to auto-generated context when offline
- **Custom override**: Users can set a custom template via the "Template" button (stored in localStorage as `lamby-prompt-template`)
- **To edit the prompt**: Just edit `public/grok-prompt-template.txt` directly. No code changes needed.

### Smart Bridge Endpoints (16 endpoints, all GET-based, no encoding needed)
These replaced the old base64-encoded `grok-proxy` system. All live on the relay at `{{RELAY_BASE}}/api/`:
- **`grok-read`** — Read files. Params: `project`, `path` (single) or `files` (comma-separated)
- **`grok-write`** — Edit files with auto-verify. Params: `project`, `path`, `search`, `replace` (URL-encoded)
- **`grok-tree`** — File tree. Params: `project`, optional `filter`
- **`grok-git`** — 16 git actions. Params: `project`, `action` (status/add/commit/diff/log/branch/checkout/stash/stash-pop/push/pull/merge/reset/revert/tag/init), plus `files`, `message`, `count`, `branch` as needed
- **`grok-process`** — Process management. Params: `project`, `action` (start/start-named/stop/list/logs/monitor/stop-all/restart), `cmd`, `pid`. NOTE: "ports" and "env" are NOT supported actions.
- **`grok-search`** — Text/regex/symbol search. Params: `project`, `q`, optional `type=symbol`
- **`grok-run`** — Run shell commands. Params: `project`, `command` (NOT `cmd`). Whitelist: npm, node, echo only.
- **`grok-macro/project-status`** — Combo: tree + package.json + git status + preview URL in 1 call
- **`grok-macro/read-context`** — Combo: file content + imports analysis in 1 call
- **`screenshot/:project`** — Fast screenshot. Params: `fullPage`, `waitMs`
- **`grok-interact`** — Browser interaction. Params: `project`, `action` (click/type/select/evaluate/runFunction/waitFor), `selector`, `text`, etc.
- **`coord`** — Agent coordination message board. Params: `note`, `from`, `clear`
- **`diag`** — Self-diagnostic. Returns connection status, latency, endpoint pass/fail, readyUrls
- **`grok-intent`** — Intent-driven action execution. Params: `intent` (20+ built-in: focus-window, click, type-keys, paste, drag, screenshot, launch, run-command, navigate, etc.). Auto-advances active workflows. Supports custom intent registration via POST with `intent=define`.
- **`grok-blitz`** — Batch execution of up to 500 commands. POST JSON array of commands. All-`run_command` batches auto-optimize into .bat files. Mixed types execute sequentially with wait support.
- **`grok-workflow`** — Multi-step workflow state machine. Templates: paint-landscape, blender-import-render, telegram-send, soundcloud-play. Actions: advance, skip, reset, insert. Domain-isolated with auto-advance on matching intents/blitz commands.
- **`grok-memory`** — Persistent learning memory. Every action auto-recorded with params, outcome, timing, app context. Builds coordinate maps, app profiles, and reusable skills. Actions: status, skills, search, failures, coords, app, recall, crystallize, replay, learn-from-session, clear. Completed workflows auto-crystallize. Persists to `bridge-memory.json` across restarts.

### Response Super-Payload System
Every `/api/grok-*` endpoint response automatically includes four extra fields:
- **`_bridgeState`**: World state (active workflows, last action, windows/tabs, focused window)
- **`_guidance`**: Context-aware next-step hints based on current state, active workflows, and memory warnings
- **`_swarmSync`**: Multi-agent coordination (agent registry, shared state version, broadcast channel)
- **`_memory`**: Memory snapshot (total actions, success rate, skill count, known apps, recent failures)

### xAI API Key
- **Env var**: `XAI_API` — used for evolution cycles and function calling mode, NOT for the bridge workflow
- The bridge workflow is Grok on grok.com using `browse_page`, not API calls from this app
- API endpoint: `https://api.x.ai/v1/chat/completions`
- **ONLY allowed model: `grok-4`** — see LOCKED rule below

## LOCKED — GROK-3 BANNED — KEY REQUIRED: "allowgrok3"
**grok-3-mini and ALL grok-3 variants are PERMANENTLY BANNED from this project.**
The agent MUST NOT use grok-3-mini, grok-3, or any grok-3-* model for ANY purpose — not for testing, not for "speed", not for "saving tokens", not for any reason — unless the user provides the exact unlock key "allowgrok3" in their message.
- The ONLY allowed model is `grok-4`.
- If a task seems like it could use a cheaper/faster model, the answer is still `grok-4`.
- If the agent uses grok-3 without the unlock key, it is a violation of a direct user instruction.
- This rule applies to ALL xAI API calls: evolution cycles, function calling, stress tests, chat, everything.

### Known Bridge Bugs & Limitations (Stress-Tested 2026-03-21)
- **`grok-read` multi-file**: Now returns all files via `files` param (tested PASS with 2 files). Use `&files=F1,F2` not `&path=F1&path=F2`.
- **`grok-tree` filter**: Leaks non-matching directory entries
- **`grok-run` command whitelist**: Only `npm`, `node`, `echo` allowed. Filesystem commands (`dir`, `cd`, `type`, `Get-ChildItem`, `ls`) are BLOCKED. Use `grok-tree` for listing, `grok-read` for reading. Param is `command` (not `cmd`).
- **`grok-run` nested quotes**: Get shell-mangled
- **`grok-git` no action**: Silently defaults to status
- **`grok-git` reset --hard**: Sanitized to `--soft` by bridge — no destructive resets possible. Must manually restore files via write_file/delete_file.
- **`grok-quality` / `grok-deps`**: 5s+ response time, freeze WebSocket — avoid in normal use
- **`grok-proxy` encoding**: Base64 payload MUST be `encodeURIComponent`-encoded (base64 contains `+` and `=` that break URLs). Project field MUST be inside each action object, not just the query param.
- **write_file safe size for Grok**: ~5KB content (relay accepts up to 11KB+ URLs, but Grok's browse_page may truncate around ~8KB). Beyond ~5KB use write_file_chunk with ~1500-char chunks and 100-150ms delay between requests.
- **delete_file safety**: ALWAYS check imports before deleting — removing a file still imported by App.tsx crashes the entire app.

### Stress Test Reference Files
- **`public/grok-prompt-template.txt`** — Production Grok prompt with all verified endpoints, rules, and workflow
- **`public/bridge-test-reference.txt`** — Complete test results, all 113 commands, encoding steps, write methods, and failure modes

## Chained Executor — grok-do Universal Command Engine
The `grok-do` endpoint is a sequential chained command executor that lets Grok (or any caller) execute complex multi-step workflows in a single API call. Grok does the planning, the executor runs each step in order.

### Architecture
- **Endpoint**: `GET /api/grok-do?steps=URL_ENCODED_JSON_ARRAY` or `POST /api/grok-do` with `{"steps":[...]}`
- **Single action shorthand**: `GET /api/grok-do?type=ACTION&param=value`
- **Sequential execution**: Steps run one-by-one, results collected, errors stop the chain (unless `stopOnError: false`)
- **Throttle bypass**: Different steps within a chain skip the per-type throttle, but duplicate consecutive steps are still throttled
- **Wait steps**: `{"type":"wait","ms":5000}` for delays between steps (e.g., after launching apps)

### Capabilities (via step types)
- **Desktop**: list_windows, bring_window_to_front, screenshot_window, click_at, double_click, right_click, mouse_down, mouse_up, mouse_move, drag, scroll, hover, send_keys, paste_text, launch_exe, get_window_info
- **Shell**: run_command (also launches Chrome with CDP via `start chrome URL`)
- **CDP Browser**: cdp_click, cdp_type, cdp_eval, cdp_snapshot, cdp_navigate, cdp_tabs, cdp_close, cdp_wait
- **Files**: write_file, read_file, create_file, list_tree, search_replace, grep
- **Git**: git_status, git_diff, git_commit, git_add, git_log
- **Flow**: wait/delay

### Descriptive Element Map (Enhanced CDP Snapshot)
- `cdp_snapshot` in `claw-tools.js` extracts up to 500 visible interactive elements from any web page
- Elements are grouped by UI region (toolbar, navigation, sidebar, form, content, footer, etc.)
- Each element has: `[INDEX] Human-readable description {state} — type — CSS selector`
- `formatSnapshot()` in `bridge-relay-local.cjs` renders the map with region headers for Grok
- Grok MUST read the element map before clicking — never guess selectors

### Task Macros (Universal Desktop Control)
All accessible via `GET /api/grok-do?task=NAME&params...`:
- **website-test**: Opens URL in Chrome, returns descriptive element map (tests CDP on complex sites)
- **app-test**: Launches app, returns control recipe (hotkeys, CDP, scripting API)
- **app-control**: Smart app launcher with auto-detection of control method (CDP, hotkeys, CLI)
- **comms-test**: Opens web version of Telegram/Discord/Gmail/Slack, returns element map
- **blender-scene**: Full 3D scene creation via Python bpy snippets (clear_scene, import_glb, set_transform, add_sun/area/point lights, add_material, setup_camera, render, list_objects, frame_all)
- **overlay**: Launch/stop the desktop coordinate overlay grid. Actions: `start`, `stop`, `status`, `read` (screenshot with overlay), `read&x=N&y=N` (hover then screenshot). Shows green grid with PHYSICAL coordinates + crosshair + live PHYS(x,y) at cursor. Fully click-through. All labels are physical coords (3840x2160) matching hw.exe exactly. Usage: `?task=overlay&action=start`
- **excalidraw-draw**: One-shot Excalidraw drawing macro — launches Chrome → Excalidraw → clears canvas → pastes scene JSON via clipboard → saves evidence screenshot. Params: `scene=landscape` (preset), `json={...}` (custom), `clear=false`, `fullscreen=false`. Usage: `?task=excalidraw-draw&scene=landscape`
- **create-tool**: Self-extending meta-macro — accepts JS code, hot-loads as new task macro, persists to `~/.guardian-ai/custom-tools/`

### Self-Extending Tool System
- `_customTools` registry at module top of `bridge-relay-local.cjs`
- Auto-loads custom tools from `~/.guardian-ai/custom-tools/*.json` on startup
- `create-tool` macro: `?task=create-tool&name=NAME&description=DESC&code=JS_BODY`
- Code receives `(params, bridgeExec, Buffer)` — bridgeExec runs bridge actions
- Custom tools are immediately usable: `?task=NAME&param1=value1`
- `?task=create-tool&action=list` shows all builtin + custom tools

### Action Memory System (Shortest-Path-Wins)
- `_actionMemory` map at module top, auto-loads from `~/.guardian-ai/action-memory/*.json`
- After every successful task macro execution, saves: task name, params, step count, elapsed ms, result summary
- **Shortest-path-wins rule**: Only overwrites a saved route if the new path has fewer steps OR less time. A longer successful path never replaces a known efficient one.
- `?task=memory&action=list` — list all saved routes (most-used first)
- `?task=memory&action=search&q=KEYWORD` — search memory for similar routes
- `?task=memory&action=clear` — clear all memory
- Add `&recall=yes` to any grok-do task to log memory recall before executing

### Self-Debug & Auto-Recovery
- `_recoveryPatterns` array maps error signatures to recovery strategies
- Patterns: selector-not-found → retry_snapshot, timeout → retry_wait, process-crashed → relaunch, connection-refused → retry_delay, file-not-found → check_path, permission-denied → elevate
- On chain step errors, the system classifies the error and adds recovery hints to the response (`recoveryStrategy`, `recoveryDesc`, `_retryable: true`)
- Grok can use recovery hints to auto-retry with adjusted approach

### Parallel Step Orchestration
- Chain syntax: `?chain=....|parallel:snapshot+screenshot:Chrome+list_windows`
- Steps after `parallel:` separated by `+` execute concurrently via Promise.all
- Results collected as `{ type: "_parallel", data: { branches: N, results: [...] } }`
- Use for: simultaneous snapshot+screenshot, multiple independent commands, parallel info gathering

### Safety Rail System
- `classifyRisk(step)` checks every chain step before execution
- High-risk patterns: `taskkill`, `kill`, `del`, `rm -rf`, `Remove-Item`, `Stop-Service`, `reg delete`, `winget uninstall`, `format X:`
- High-risk types: `delete_file`
- Flagged steps return `{ status: "needs_confirmation", risk: "..." }` — chain continues past them
- Add `&confirm=yes` to the grok-do URL to bypass safety rails for all steps
- Low-risk actions (reads, snapshots, navigation, typing) always execute immediately

### God-Mode Test Battery (v2 — Full #137 Spec Proof)
- `?task=god-mode-test` runs 12 comprehensive end-to-end tests with evidence manifests
- Tests: web-control, extreme-website-nav, native-app-control, blender-full-scene, comms-map, smart-home, self-extend, chain-complex, parallel-ops, action-memory, safety-rails, file-system-control
- Run individual tests: `?task=god-mode-test&test=web-control`
- **Evidence system**: Each test collects screenshots (with sizes), element map previews (500-800 chars), and file verification results
- **Progress streaming**: `logProgress(testName, step)` writes to coordBoard ring buffer during test execution, visible at `/api/coord`
- **Key tests**: web-control (800-char element map), extreme-website-nav (14 real sites), native-app-control (6 Windows apps with file/process verification), blender-full-scene (Sketchfab→Blender→render→verify PNG), action-memory (save/recall/increment/SHA-256 hash), safety-rails (classifyRisk + confirm bypass)
- Evidence directory: `C:\Users\Aiden\Desktop\godmode-evidence\`

### Grok Knowledge Base
- `public/grok-lamby-knowledge.txt` — comprehensive prompt teaching Grok how to use grok-do with real-world examples
- `public/grok-desktop-prompt.txt` — desktop control reference (individual endpoints + new macros)
- `public/grok-desktop-playbook.txt` — complete desktop control playbook mapping every app category to optimal control method

### Claw Agent (Ollama-based, secondary)
- `claw-agent-bridge.js` — autonomous AI agent loop with tool calling (up to 20 iterations)
- `claw-tools.js` — 23 tools with IPC fallback for native actions when running in child process
- Uses local Ollama models; default `qwen2.5:32b-instruct-q5_K_M`
- Available via `claw_agent` action type in sandbox-dispatcher but rarely used (Grok + chained executor is faster)

## Function Calling (Grok ↔ Bridge Relay)
- **Endpoint**: `POST /api/grok-responses` in `vite.config.ts` — handles full xAI Responses API loop with function calling
- **Flow**: Client sends messages → server calls xAI `/v1/responses` with 10 function tools → when Grok returns `function_call`, server executes it against the bridge relay → feeds result back as `function_call_output` → loops until Grok returns final text
- **Tools registered**: `take_screenshot`, `read_file`, `write_file`, `search_replace`, `run_command`, `list_tree`, `grep_search`, `console_logs`, `read_snapshot`, `browser_interact`, `sketchfab_search`, `sketchfab_download`
- **Client integration**: `streamGrokFC()` in GrokBridge.tsx — used when bridge is online + active project + API mode. Falls back to `streamGrok()` (Supabase proxy, no tools) otherwise
- **SSE events**: `status`, `function_call`, `function_result`, `text`, `done`, `error` — streamed to client for live progress updates
- **API key resolution**: `process.env.XAI_API` → `process.env.XAI_API_KEY` → `~/.guardian-ai/settings.json` `grokApiKey`
- **Bridge relay endpoints** (`server/bridge-relay.cjs`): `/api/grok-proxy` (GET, base64 payload), `/api/grok-edit` (GET, query params, supports `searchB64`/`replaceB64` for HTML content), `/api/grok-interact` (GET, browser interaction wrapper), `/api/commands` (command discovery), `/api/screenshot/:key/:project` (direct screenshot), `/api/grok` (discovery)
- **`write_file_chunk`** (`server/sandbox-dispatcher.cjs`): Chunked file writes for files > 2KB. `chunk_index=0` creates/overwrites, subsequent chunks append. Required for large files that exceed URL length limits in grok-proxy.
- **production.cjs mirrors bridge-relay.cjs**: All relay endpoints (grok-proxy, grok-edit, grok-interact, screenshot, commands, grok discovery) are mirrored in `server/production.cjs` for deployed environments.
- **Why not browse_page (for function-calling mode)**: Grok's built-in `browse_page` tool HTML-encodes `&` as `&amp;` in URLs (breaking query params) and has ~20s internal timeout (screenshots take 15-25s). Function calling bypasses both issues.

## Browse-Page via API (Responses API + web_search)
- **Endpoint**: `POST /api/grok-browse` in `vite.config.ts`
- **How it works**: Uses xAI Responses API with built-in `web_search` tool (which includes `browse_page` as a server-side sub-tool). Grok-4 uses `browse_page` internally to call bridge endpoints — the same mechanism as when a user pastes the prompt into grok.com.
- **Domain restriction**: Uses `allowed_domains` filter to restrict browsing to only the bridge relay domain
- **Key xAI docs reference**: `browse_page` is under `SERVER_SIDE_TOOL_WEB_SEARCH` category along with `web_search` and `web_search_with_snippets` (see https://docs.x.ai/developers/tools/tool-usage-details)
- **SSE events**: `status`, `tool_call`, `text`, `saved`, `done`, `error`
- **Request body**: `{ prompt, model?, project?, bridgeRelayUrl?, saveToFile? }`
- **UI**: "Run via API" button in the ClipboardExtractor toolbar — sends the prompt template to Grok-4, Grok browses the bridge endpoints server-side, results streamed back via SSE
- **Advantage over function-calling**: No client-side loop needed — xAI handles all browse_page calls internally. Simpler, and matches the grok.com user experience exactly.
- **Trade-off vs function-calling**: browse_page has the `&amp;` encoding issue and ~20s timeout per call. For heavy editing (many search/replace ops), function-calling mode (`/api/grok-responses`) may be more reliable.

## Sketchfab 3D Model Integration
- **API Key**: Stored as `SKETCHFAB_API_KEY` in Replit secrets. Relay also accepts `SKETCHFAB_API_TOKEN`.
- **Three access paths** — all use the same Sketchfab Data API v3:
  1. **Function calling tools** (`sketchfab_search`, `sketchfab_download`): Server-side API calls in `vite.config.ts`. The download tool fetches the GLB URL, then sends PowerShell commands through the bridge to download the file and import into Blender.
  2. **Relay grok-do task macros** (`sketchfab-search`, `sketchfab-download`, `sketchfab-to-blender`, `open-in-blender`): Defined in `bridge-relay-local.cjs`. All use `_serverSideAsync` pattern — Sketchfab API is called server-side, then bridge commands (download, base64-encoded Python script, Blender launch) are sent to the desktop.
  3. **REST endpoints** (`/api/sketchfab/search`, `/api/sketchfab/download-url`): Mirrored in both `vite.config.ts` and `local-server.js`.
- **API key**: Loaded from environment variables (`process.env.sketchfabapi` / `SKETCHFAB_API_TOKEN` / `SKETCHFAB_API_KEY`)
- **Download flow**: Server calls Sketchfab API → gets signed GLB URL → sends PowerShell `Invoke-WebRequest` via bridge to `C:\Users\Aiden\Downloads\` → writes Python import script via base64 `EncodedCommand` → launches Blender with `Start-Process --python`
- **Relay startup**: Workflow runs `node server/bridge-relay-local.cjs & npx vite --host 0.0.0.0 --port 5000` — relay on port 3000, Vite on port 5000
- **Blender import**: Creates `blender_import.py` on Desktop, runs `blender.exe --python blender_import.py`. Script clears scene, imports GLTF, centers viewport.
- **Prompt template**: `public/grok-prompt-template.txt` documents the Sketchfab task macros for Grok.

## Google Home Smart Light Control (CDP)
- **Task macro**: `grok-do?task=google-home` in `bridge-relay-local.cjs` — handles navigation, state detection, and clicking
- **Actions**: `status` (check all), `on`, `off`, `toggle` — with optional `rooms` param (comma-separated room names or `all`)
- **Google Home URL**: `https://home.google.com/u/0/home/1-a180dbc5e1b48c92235ebf4df1255bb394d9110eeaa65b9a0ba240`
- **Tile selector**: `button.mat-mdc-tooltip-trigger` — indices 2-11 are device tiles
- **Room map**: back door(2), bedroom 2(3), bedroom 3(4), dining room(5), garden level dimmer(6), sink light(7), living room(8), master bedroom(9), bathroom fan(10), bathroom light(11)
- **State detection**: `title="Turn off"` = light is ON; `title="Turn on"` = light is OFF
- **Click method**: Must dispatch full PointerEvent sequence — `pointerdown` → `pointerup` → `MouseEvent click` (all with `bubbles:true`). Simple `.click()` does NOT work on Google Home Material tiles
- **CDP response field**: Use `.data.result` (not `.data.value`)
- **Complex JS in GET**: Use `curl -G --data-urlencode 'steps=[...]'` to avoid URL encoding issues with parentheses/braces
- **Documented in**: `public/grok-prompt-template.txt` (concise reference) and `public/grok-lamby-knowledge.txt` (full details + manual CDP fallback)

## Auto-Error-Recovery System
- **Error Detection**: Global `window.onerror` + `unhandledrejection` + React ErrorBoundary catch all browser errors
- **Error Classification**: Universal classifier maps errors to categories (export-missing, dependency-missing, syntax-error, type-error, vite-cache, etc.) with confidence scoring
- **Recovery Strategies**: restart-vite, clear-cache-restart, npm-install, reload-page, retry, code-fix, escalate
- **Rate Limiting**: Max 3 auto-recovery attempts per error signature within 60 seconds — prevents restart loops
- **Process Health Monitor**: Crashed preview servers auto-restart with exponential backoff (2s, 5s, 15s; max 3 attempts)
- **Live Vite Error Monitoring**: Preview process stdout/stderr watched for fatal patterns even after startup
- **API Endpoints**: `/api/errors/report` (POST errors for server-side recovery), `/api/errors/history` (query past errors)
- **Files**: `src/lib/error-recovery.ts` (classifier), `src/lib/error-reporter.ts` (browser reporter), `src/components/ErrorBoundary.tsx` (React boundary)
- **Both local-server.js and vite.config.ts have mirrored error endpoints**

## Desktop App (Electron)
- **Desktop mode**: `npm run electron:dev` — starts Vite + Electron together
  - Vite dev server on port 5000, Electron loads it as the main window
  - GrokBridge embeds Grok/ChatGPT/Claude directly in the page via Electron `<webview>` tag
  - Uses `partition="persist:browser"` for persistent login sessions across reloads (shared across all sites)
  - Clicking site tabs navigates the embedded webview (no separate windows)
- **Desktop build**: `npm run electron:build` — builds Vite then packages Electron
- **Web mode**: Sites open in new browser tabs (fallback when not in Electron)
- Detection: `typeof window.require === 'function'` → Electron; otherwise web mode
- Tauri has been fully removed from the project
- **Code Apply Pipeline** (Electron only):
  - Clipboard extractor detects code blocks + full Grok response context
  - Click "Apply" → reads current file from disk → shows confirmation dialog with diff
  - Safety checks run (balanced brackets, circular imports, infinite loops)
  - On confirm: backs up file → writes to disk → checks TypeScript compilation → auto git commit
  - If compile errors detected: shows errors + offers one-click rollback from backup
  - Rollback restores the pre-write backup; non-fatal git failures shown as warnings
  - Backups stored in `.guardian-backup/` (gitignored)
  - IPC handlers: `read-file`, `write-file`, `rollback-file`, `git-commit`, `check-compile`, `list-project-files`
  - Path traversal protection: all paths validated to be inside project root; node_modules/.git/.env blocked
- **Automated Development Loop** (Electron only — "NEW GEMINI" pattern):
  - **Auto Context**: Two-section format optimized for Grok: (1) `=== ACTIVE PROJECT (BUILD THIS ONLY) ===` with project name, status, framework hint (auto-detected from deps), file tree, package.json, errors, task instructions, and code output rules all inline. (2) `=== GUARDIAN AI HOST ENVIRONMENT (READ-ONLY) ===` explaining the Electron/iframe preview setup with strict "never modify Guardian AI" guardrails. HOST section is always included (non-droppable). File contents fill remaining budget (64k chars). "Copy Context" button in top bar copies to clipboard for pasting into Grok.
  - **Batch Apply All**: "Apply All" button in Code Extractor writes all detected code blocks at once → backup all → write all → compile check → git commit. Progress modal shows stage: Writing → Checking → Committing → Done/Error.
  - **Output Rules**: Context includes `=== OUTPUT RULES ===` section showing Grok exact format examples: `// file:` headers before fenced blocks, `=== DEPENDENCIES ===` blocks, `=== COMMANDS ===` blocks, and Aider-style `<<<<<<< SEARCH / ======= / >>>>>>> REPLACE` blocks for small edits. 8 explicit rules enforce complete file content or exact search/replace, no partial snippets, no narrative wrapping. Parser in `code-parser.ts` handles all formats via multi-pass chain.
  - **Multi-Pass Parser** (Aider-style, `code-parser.ts`): Multi-pass fallback chain: (1) fenced blocks with `// file:` headers, (2) search/replace blocks (`<<<<<<< SEARCH / ======= / >>>>>>> REPLACE` + natural language "replace with" between fences), (3) unified diff parsing (````diff` blocks + inline `--- a/file` format), (4) unfenced `// file:` blocks. Parsers run in parallel with dedupe — search/replace and diff blocks take precedence over fenced blocks for the same file if the fenced content looks like raw diff. `applySearchReplace()` has 3-tier matching: exact → whitespace-normalized → fuzzy first/last line. `applyUnifiedDiff()` preserves hunk line order with fuzzy position matching. Batch apply is fail-safe: skips patches that can't match, never writes raw diff/search text to files. UI shows "S/R" and "DIFF" badges on parsed blocks with "Patch" button label.
  - **Snippet Handling**: Code blocks without file paths use 3-layer auto-detection: (1) preceding text scanning (contextual verbs like "open/in/edit" + bare file paths), (2) content-based inference for well-known configs (vite.config, main.tsx, tsconfig, etc.), (3) manual assignment via inline input as fallback. Unassigned snippets show amber styling with a "Snippet" label.
  - **Preview Loading Overlay**: Preview iframe never shows blank white — dark overlay with spinner shown during load, plus blank-screen detector after 4s that surfaces errors/warnings. Console bridge in injected script detects empty root elements after 5s. LogsPanel console bar always visible so users can access logs immediately.
  - **Undo All**: Prominent red "UNDO ALL" button in toolbar appears whenever there are applied changes. Rolls back all applied files in reverse order (restores previous content). Shows individual file undo chips for the last 2 files. Also works for auto-apply undo (5s window).
  - **Replace Repo**: When Grok suggests a new GitHub repo and there's already an active project, the clone button becomes "Replace Repo" (amber, with swap icon). Clicking it stops the current preview, deletes the old project, then clones the new one. A secondary "Clone Alongside" button keeps both repos.
  - **Error Feedback Loop**: If batch apply produces compile errors, the error dialog offers "Send to Grok" (copies error + project context to clipboard) and "Rollback All" (restores all backups). Mirrors the `ping_pong_fix` pattern: apply → error → send errors → fix → apply again.
  - **Autonomous Fix Loop** (`src/lib/autonomous-loop.ts` + GrokBridge integration):
    - "Loop" toggle in top bar enables autonomous mode. When ON, errors detected after auto-apply trigger automatic fix-retry cycle.
    - State machine: idle → applying → checking → waiting → prompting → loop. Max 4 attempts with exponential backoff (5s → 10s → 20s → 40s).
    - API Mode: Builds fix prompt via `buildDiagnoseFixPrompt` + original goal context, calls `sendMessage` programmatically after backoff.
    - Browser Mode (Electron): Directly injects fix prompt into Grok webview via `executeJavaScript`, clicks Send, polls for response completion (anchored to new message count), clicks Copy button. Falls back to clipboard if webview interaction fails. IPC handlers: `grok-send-prompt`, `grok-check-response-ready`, `grok-copy-last-response` in `electron-browser/src/main.js`.
    - Browser Mode (non-Electron): Copies fix prompt to clipboard with status message for pasting into Grok.
    - Hooks into `startPostApplyMonitoring` — if no new errors after 5s monitoring window, declares success. If new errors found, triggers retry or exhaustion.
    - UI: Purple-themed status panel shows phase (Applying/Checking/Waiting/Prompting), attempt counter (1/4, 2/4...), countdown timer during backoff, terminal states (green "Done!" / red "Needs help"). Stop button always visible during active loop.
    - Auto-enables Auto-apply when Loop is turned on (required for the loop to work).
  - **Auto Restart**: After successful batch apply, waits for Vite HMR (2s). IPC handlers `restart-dev-server` and `run-npm-install` available for full restarts / dependency installs.
  - Batch IPC handlers: `batch-write-files`, `batch-rollback`, `batch-git-commit`, `git-log`, `read-files-for-context`, `restart-dev-server`, `run-npm-install`

## Multi-Panel Preview System
- Multiple preview panels can be open simultaneously, displayed side-by-side in the right wall portal
- State: `previewPanels: PreviewPanel[]` array + `activePanelId` for focused panel
- `PreviewPanel` type: `{ id, projectName: string|null, port, logs, key, loading, widthFraction }`
- Legacy scalars (`previewPort`, `showPreviewEmbed`, `previewLogs`, `previewKey`, `previewLoading`) derived from active panel for backward compat
- Panel helpers: `addPanel`, `removePanel`, `updatePanelById`, `updateActivePanel`, `bumpActivePanelKey`
- Drag-to-resize handles between panels (pointer events, min 10% width)
- Toolbar shows panel indicator dots; clicking switches active panel
- ProjectExplorer shows green dot for projects with open preview panels via `openPanelNames` prop
- `handleSelectProject` focuses existing panel if one exists for the project; otherwise creates new panel
- `startPreview` reuses existing panel for same project or creates new one
- `stopPreview` removes the panel for the active project
- `startMainAppPreview` creates a main app panel with `port=-1` sentinel

## Project Management
- Users can create, select, and delete sub-projects from the AI Bridge page
- Projects are stored under `projects/<name>/` relative to project root
- API endpoints in `vite.config.ts`: `/api/projects/list`, `/api/projects/create`, `/api/projects/delete`, `/api/projects/files`, `/api/projects/read-file`, `/api/projects/write-file`, `/api/projects/preview`, `/api/projects/stop-preview`, `/api/projects/install-deps`, `/api/projects/run-command`
  - `/api/projects/run-command`: Runs whitelisted commands (`npm install`, `npm run`, `npx`, `yarn`, etc.) in a sub-project directory. Auto-appends `--legacy-peer-deps` for `npm install`. Shell metacharacters blocked. 120s timeout.
  - `/api/projects/install-deps`: Detects project's package manager (bun/pnpm/yarn/npm) from lockfiles and uses it for installs. Falls back to npm on failure. 120s timeout per command.
- Client-side store: `src/lib/project-manager.ts` — `listProjects`, `createProject`, `deleteProject`, `getProjectFiles`, `getMainAppFiles`, `readProjectFile`, `writeProjectFile`, `getActiveProject`, `setActiveProject`
- UI component: `src/components/ProjectExplorer.tsx` — file tree browser for active project or main app
- **Main App file tree**: When "Main App" is selected (activeProject=null), shows the main λ Recursive app's file tree via `/api/projects/files-main` endpoint. Files are readable/editable using project name `__main__`. Skips node_modules, .git, projects/, dist/, .cache/, attached_assets/, .local/, .agents/, .upm/, .config/.
- When a project is active in GrokBridge:
  - `applyBlock`/`confirmApply`/`batchApplyAll` write to project directory instead of main app
  - `buildProjectContext` reads project files instead of SELF_SOURCE
  - Copy Context includes the project's file tree and key file contents
  - Preview auto-starts when a project is selected (no manual click needed). Shows as embedded split-view iframe alongside Grok browser.
  - **HMR-first updates**: Normal file writes rely on Vite's Hot Module Replacement (no server kill). Full preview restart only triggered for config file changes (`vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `package.json`, `postcss.config.*`) or after dependency installs.
  - **Windows polling**: Sub-project `vite.config.ts` is scaffolded with `usePolling: true` for reliable file watching on Windows. Existing projects without polling are auto-patched when preview starts.
  - **Auto config patching**: Preview startup auto-cleans any non-root `base:` path from vite configs (GitHub Pages paths, stale `/__preview/` paths, etc.), patches rspack configs with correct port/host, and adds usePolling to vite configs.
  - **Framework detection**: Supports next, vite, react-scripts, webpack (preserves `--config` flags), rspack, nuxt, astro, SvelteKit (`vite dev` not `vite`), Angular, Remix, Gatsby, Parcel, Ember, pnpm monorepos (auto-finds `--filter` dev scripts + pre-builds workspace packages). Also checks alternative script names: `develop`, `dev:app`, `dev:client`, `dev:frontend`, `dev:web`, `watch`.
  - **Subdirectory-aware project detection**: When no root `package.json` exists (common for full-stack repos with `client/`, `frontend/`, `web/`, `app/` dirs), auto-detects subdirectory `package.json`, installs deps there, runs dev server from the subdirectory, and injects console bridge into subdirectory `index.html`. All config patching (vite, postcss, tailwind, tsconfig, env files) also searches subdirectories.
  - **Compound script parsing**: `extractDevServerCmd` handles `tsc && vite`, `concurrently "..." "..."`, `cross-env VAR=val vite`, `dotenv ... -- vite`, `env-cmd -f ... vite`. Extracts the actual dev server command from compound scripts.
  - **Static HTML project support**: If no `package.json` exists but any `.html` file does, auto-bootstraps with a minimal `package.json` + vite, installs, and serves. If only non-`index.html` files exist, creates a redirect `index.html` pointing to the first HTML file found.
  - **Missing entry point auto-scaffold**: If `index.html` references a script (e.g. `src/main.tsx`) that doesn't exist (common in library repos), auto-creates a minimal React/TS placeholder so the preview doesn't 404.
  - **Library-mode vite config auto-fix**: Detects `build.lib` in vite config (library packages, not apps). Auto-rewrites to dev-mode config with the correct framework plugin (React/Vue). Installs missing `@vitejs/plugin-react`, `react`, `react-dom` as needed. Handles repos where React is in peerDependencies only.
  - **Port/host injection**: Before spawning, patches `.env`/`.env.local`/`.env.development` files (PORT/HOST vars) and project's `vite.config.ts/js` (hardcoded `port:`, `host: 'localhost'`, `open: true`).
  - **PostCSS/Tailwind auto-fix**: Detects ESM/CJS config format mismatches and renames files (`.js` → `.cjs` for ESM projects using `module.exports`, `.js` → `.mjs` for CJS projects using `export default`). Auto-installs missing `tailwindcss`/`autoprefixer` deps if referenced in postcss config.
  - **Auto-install missing dependencies on failure**: After process exits with errors, parses output for `Cannot find module`, `Could not resolve`, `Module not found` patterns. Auto-installs up to 5 missing packages and retries once.
  - **OpenSSL legacy provider**: Auto-added for webpack/webpack-dev-server/vue-cli-service/react-scripts projects to fix `ERR_OSSL_EVP_UNSUPPORTED` with older webpack versions.
  - **CHOKIDAR_USEPOLLING**: Enabled for all preview spawns to prevent ENOSPC file watcher exhaustion in large monorepos.
  - **Node 20 iterator compatibility**: Auto-patches `vue-router` (and other libs) that use Node 22+ iterator helpers (`.values().filter()`) by wrapping in `Array.from()`. Runs on preview startup when Node < 22.
  - **Windows desktop parity**: Every single `spawn`/`exec`/`execFile`/`execSync` call in both `vite.config.ts` and `electron-browser/src/main.js` uses `windowsHide: true` to prevent visible cmd.exe windows. Preview spawns use `detached: false` on Windows (only `detached: true` on Unix for process group management). Process kill uses `taskkill /T /F` on Windows instead of `process.kill(-pid)`. Port cleanup uses `netstat -ano | findstr` on Windows instead of `/proc/net/tcp`. GitHub import tar extraction uses forward-slash paths on Windows.
  - **Robust file tree walker**: `/api/projects/files` uses `fs.readdirSync(dir)` + `fs.lstatSync()` instead of `withFileTypes: true` Dirent objects (Dirent.isDirectory() is unreliable on Windows). Paths always use forward slashes regardless of OS. Per-entry try/catch so one bad file never crashes the whole tree. Skips: node_modules, .cache, dist, .git, .next, .nuxt, .turbo, .vercel, .output, .svelte-kit, __pycache__, .parcel-cache.
  - **File tree refresh on import**: `guardian-refresh-files` CustomEvent dispatched after GitHub import. ProjectExplorer listens for it and refreshes project list + file tree using the event payload's `projectName` (not stale React state). Ensures file tree updates even when importing into the already-active project.
  - **tsconfig path alias auto-resolution**: Preview startup detects tsconfig.json `baseUrl`/`paths`. If the project's vite config doesn't already use `vite-tsconfig-paths`, it auto-installs the package (using the project's package manager — npm/pnpm/yarn/bun) and adds `tsconfigPaths()` to the vite plugins array. Fixes the common `Failed to resolve import "components/App"` errors from repos using bare imports with `baseUrl: "./src"`.
  - **Process group kill**: Preview processes spawn with `detached: true`; stop/restart use `process.kill(-pid, SIGKILL)` for full process tree cleanup. Stale port detection uses `/proc/net/tcp` inode matching (since lsof/fuser/ss are unavailable).
  - Preview restart waits for port to be free (up to 3s) before spawning new server, preventing port conflicts.
  - Refresh button in toolbar and preview panel header force-reloads the iframe. Auto-refresh after applying code (500ms for normal files, 2.5s for config changes).
  - Electron IPC `ensure-project-polling` patches sub-project `vite.config.ts` with `usePolling` before starting preview.
- Switching to "Main App" restores all original behavior (no project scoping)
- **GitHub Import**: "Import from GitHub" button in project panel. Paste a repo URL → app downloads via GitHub API → creates project → installs deps → starts preview
  - Auto-detected in Grok responses: `detectAllGitHubUrls` finds all GitHub repo URLs in any AI response (browser or API mode)
  - **Browser mode**: Clone buttons appear in ClipboardExtractor toolbar for each detected repo
  - **API mode**: Banner appears at top with "Clone & Import" button; also auto-clones when auto-apply is ON and the active project is empty (no source files)
  - Endpoint: `/api/projects/import-github` — tarball download (single HTTP request for entire repo), extracted with `tar --strip-components=1`
  - Uses `GITHUB_TOKEN` env var for authenticated API access (private repos + higher rate limits)
  - Auto-cleans extracted repo: removes node_modules, .git, .next, .turbo, dist, .cache, .vercel, .output
  - Smart PM detection: lockfile sniffing (bun.lockb/pnpm-lock.yaml/yarn.lock) → correct install command; monorepo detection via workspaces/pnpm-workspace.yaml/lerna.json
  - Framework detection: next/nuxt/angular/svelte/astro/vue/react from dependencies
  - Install uses `--ignore-scripts` for security on untrusted repos; 180s timeout with npm fallback; post-install `rebuild` step compiles native modules (e.g., better-sqlite3)
  - Vite server watch config excludes `projects/` and `.local/` to prevent ENOSPC file watcher exhaustion from pnpm stores
  - Grok is the single decision-maker for repo selection — Ollama never suggests repos
  - **Context button framework filter**: Both the context prompt (empty project instructions) and the first-message enrichment constrain Grok to only suggest repos using proven frameworks: React+Vite, Vue+Vite, SvelteKit, Next.js, Nuxt, Webpack, Rspack, static HTML/CSS/JS. Explicitly excludes Solid/SolidStart (Node 22 required), Deno, Bun-only, mobile-only (React Native/Flutter), and backend-only repos.
- **Empty project creation**: New projects start with only a `package.json` (name, version, description, framework metadata). No scaffold files — the idea is Grok suggests a repo to clone or generates the initial files

## Preview Log Capture & Auto-Error Feedback
- **LogsPanel** (`src/components/LogsPanel.tsx`): Collapsible console panel below the preview iframe
  - Captures `console.log/warn/error/info` + `window.onerror` + `unhandledrejection` from the preview via `postMessage` bridge
  - Bridge script auto-injected into project's `index.html` when preview starts (idempotent)
  - Color-coded entries: red=error, yellow=warn, blue=info, gray=log
  - "Send Logs to Grok" bundles last 20 error/warning lines + affected file contents into a diagnostic prompt → copies to clipboard
  - Capped at 200 entries with auto-prune
- **Diagnose & Fix** banner: After "Apply All", monitors for new errors for 5 seconds
  - If errors appear, shows a "Diagnose & Fix" button at top of preview
  - One-click generates prompt with: error logs + applied file contents + last Grok response snippet
  - Loop protection: after 3 consecutive failed fix cycles, shows "Stuck" message

## Claw-Dev Agent Bridge (Task #118)
- **Purpose**: Integrates smarter agent intelligence from Claw-Dev as a planning/orchestration layer while keeping Lamby's browser webview as the free execution engine
- **Architecture**: CodingAgent plans + structures prompts → routes through browser webview OR direct API → tool results flow back → agent loop continues
- **Files**:
  - `electron-browser/src/claw-agent-bridge.js` — Main `ClawAgentBridge` class: multi-provider agent loop with tool calling (up to 12 iterations)
  - `electron-browser/src/anthropic-compat.js` — Format translation layer: converts between Anthropic message format and OpenAI/Ollama/etc native formats
  - `electron-browser/src/claw-tools.js` — 5 file/shell tools: `list_files`, `read_file`, `write_file`, `search_text`, `run_shell` (cross-platform)
  - `electron-browser/src/claw-ipc-handlers.js` — Electron IPC handlers: `claw-agent-start`, `claw-agent-abort`, `claw-agent-status`, `claw-agent-session`, `claw-tools-list`, `claw-providers-list`, `claw-agent-test`
  - `electron-browser/src/prompt-formatter.js` — Unified prompt formatting across all providers (browser vs direct API)
  - `electron-browser/tests/claw-agent-e2e.js` — E2E test suite (38 tests, all passing)
  - `claw-dev/src/` — Original Claw-Dev source reference (TypeScript)
- **Providers**: `browser` (Grok webview, zero cost), `xai` (Grok API), `ollama` (local, full agent mode), `openai`, `groq`, `copilot`, `zai`
- **Browser mode**: Formats prompts with JSON tool-call instructions → sends through Grok webview IPC → parses response for JSON tool call blocks → executes tools locally → loops
- **Direct API mode**: Uses OpenAI-compatible chat completions format with native tool calling → automatic tool execution → loops
- **Ollama full agent mode**: Real tool calling through Ollama's OpenAI-compatible API (not just the dumb toaster pre/post-processor)
- **Tool safety**: All file operations sandboxed to project `cwd`; path traversal blocked; shell commands have 60s timeout
- **Session management**: Each agent run gets a UUID session; progress events streamed to renderer via `claw-agent-progress` IPC channel

## Ollama "Toaster" Integration
- **Role**: Dumb, reliable pre/post-processor. Never suggests repos, code, or creative decisions. Temperature = 0.0.
- **Pre-Grok (Context Bundler)**: Takes preview logs + file tree → outputs `{ error_summary, affected_files, missing_files, priority, suggested_context_to_include }` → used to select only relevant files for Grok's context. Ollama-identified files are now actually read and included as priority 3 sections. Token budget: 16k tokens (64k chars). File limit: 30 files.
- **Post-Grok (Response Cleaner)**: Takes raw Grok response → extracts code blocks into structured `{ reasoning, files: [{ path, action, content }], unparsed_text }` → falls back to regex parser if Ollama unavailable
- **Quick Actions Analyzer** (`suggestQuickActions`): Analyzes project state to generate smart context-aware action buttons. Ollama-first with heuristic fallback. Suggests actions like "Fix N errors", "Add dark mode", "Add authentication", "Improve styling".
- **Graceful degradation**: If Ollama not running (`localhost:11434`), falls back to existing behavior (raw file concat + regex parsing + heuristic quick actions)
- **Config**: Endpoint URL + model name stored in localStorage, configurable in settings. Default model is `auto` (picks fastest available model).
- **Auto-detect**: Default model is `auto`. Prefers smallest/fastest models: `qwen2.5-coder:1.5b` > `qwen2.5-coder:3b` > `gemma2:2b` > `phi3:mini` > any installed model. Resolved model is cached for 2 minutes (config-scoped: cache invalidates when endpoint/model changes).
- **Mini Chat Popup**: Click the Toaster button → opens chat popup with text input. Send any message to test Ollama is loaded and working. Shows resolved model name, message history. "Ping" button in popup header for connectivity testing. Auto-retries connection on first message if Ollama was offline.
- **Performance optimizations**: (1) Resolved model cached to avoid repeated `/api/tags` round-trips, (2) `num_predict` scaled by prompt size (512–1024 vs previous 2048), (3) `keep_alive: '5m'` keeps model loaded in memory between requests, (4) prompts shortened/condensed to reduce input token count.
- **Periodic health polling**: Checks connection every 60 seconds. Shows status message when connection state changes (connected/disconnected)
- **Diagnostic errors**: Connection check now returns specific reasons: "Connection refused", "Timeout", "No models found — run ollama pull", etc.
- **GPU acceleration**: Ollama automatically uses GPU when available — no hidden terminal needed. The HTTP API at `localhost:11434` is the standard interface. The main slowness factors were: (1) 7B default model (now prefers 1.5B), (2) `num_predict: 2048` (now 512–1024), (3) model re-resolution on every call (now cached), (4) verbose prompts (now condensed).

## Auto-Apply & Safety Validation
- **Auto-Apply Toggle**: Zap icon button in toolbar, persisted in localStorage
  - When ON: safe changes (no safety errors, <50 line diff per file, no deletions) apply automatically without confirmation dialog
  - Shows "Undo" toast button (5-second window) for rollback
  - Falls back to normal confirm dialog for unsafe changes
- **Enhanced Safety Engine** (`safety-engine.ts`): Validates code before apply
  - Balanced brackets check, circular import detection, infinite loop detection, size reduction check
  - **Import resolution**: Verifies local imports (`./`, `../`) reference existing project files
  - **Duplicate export detection**: Flags multiple `export default` or same-name exports
  - **JSX/TSX balance**: Checks component tag balance for `.tsx`/`.jsx` files
  - **Package reference check**: Flags imports from packages not in `package.json` (info-level)
  - Accepts `ValidationContext` with project file tree and package.json for context-aware checks

## Monaco File Editor
- **FileEditor component** (`src/components/FileEditor.tsx`): Full Monaco editor for hand-editing project files
  - Syntax highlighting auto-detected from file extension
  - Save via button or Ctrl+S → writes via `writeProjectFile` + triggers preview refresh
  - Runs `validateChange` on save with warnings in status bar
  - "Send to Grok" button generates context-rich prompt with file content
- **Three-panel layout**: When editor open: sidebar | editor | preview. Closes to two-panel.
- **Edit buttons** in ProjectExplorer file tree (pencil icon on hover)

## Shared GitHub Org & Knowledge Registry
- **Publish** (`src/lib/guardian-publish.ts`): "Publish to Community" button pushes successful builds to a shared GitHub org
  - Auto-generates `GUARDIAN-META.json` with: original_description, stack, key_patterns_used, tags, build_success_rating, source_repo
  - Anonymizes before push: strips `.env`, redacts API keys/secrets/tokens
  - Sets GitHub repo topics for discoverability
  - Auth: app-owned PAT for shared org (shipped with Electron build), optional user PAT for personal GitHub
  - Config in `src/lib/guardian-config.ts`
- **Knowledge Registry** (`src/lib/guardian-knowledge.ts`): On new project, queries shared org for matching past builds
  - Fetches + caches `GUARDIAN-META.json` from org repos (refreshes every 30 minutes)
  - Keyword search against cached metadata
  - Top 3-5 matches fed to Grok's prompt with correct priority: 1) Public GitHub repo first, 2) Proven builds second, 3) Start fresh last
  - Grok makes the final decision — no conflicting suggestions from multiple sources
  - Shows "Built Before" indicator when matches found

## Sandbox API — Architecture & Flow

### System Architecture (3 separate pieces)
1. **Bridge Relay** (`bridge-relay-local.cjs` on desktop, exposed via Cloudflare tunnel) — Runs locally on the desktop. It:
   - Accepts GET/POST requests from Grok at various `/api/grok-*` endpoints
   - Dispatches actions directly to hw.exe and other desktop tools
   - Returns results back to Grok with super-payload metadata
   - Serves snapshot/console-log/stream endpoints
2. **This Replit Vite Dev Server** (`vite.config.ts`) — Runs here. Connects TO the bridge relay as a "desktop client" via WebSocket (`/bridge-ws`). When it receives a `sandbox-execute-request` message, it calls `sandbox-dispatcher.cjs` locally to execute actions on disk. Results sent back via WebSocket.
3. **Desktop Electron App** (`electron-browser/src/local-server.js`) — Alternative client. Also connects to bridge relay as a "desktop client." Also calls `sandbox-dispatcher.cjs`. Used when running locally on user's machine instead of Replit.

### End-to-End Flow
```
Grok (xAI) → GET /api/grok-proxy?payload=BASE64 → bridge-relay.replit.app → WebSocket → This Vite Server (or Desktop Electron) → sandbox-dispatcher.cjs → fs.writeFileSync (disk) → results flow back the same path
```
(The relay also still accepts POST to `/api/sandbox/execute` for non-browser clients like batch tests.)

### How This Vite Server Connects to the Bridge Relay
- `vite.config.ts` line ~5040: Creates a WebSocket connection to `wss://bridge-relay.replit.app/bridge-ws?key=BRIDGE_KEY&snapshotKey=SNAPSHOT_KEY`
- Reconnects automatically with exponential backoff (every 301s normal reconnect cycle)
- Sends `ping` every 15s for keepalive
- Handles incoming messages: `snapshot-request`, `sandbox-execute-request`, `console-logs-request`, `relay-log`
- The `[Relay INFO/WARN/ERROR]` messages in workflow logs are forwarded from the external relay via `relay-log` WebSocket messages — they show what's happening on the relay side

### Sandbox Dispatcher
- **Core file**: `server/sandbox-dispatcher.cjs` — all sandbox action handlers
- Imported by both `vite.config.ts` (this Replit app) and `electron-browser/src/local-server.js` (desktop Electron app)
- **1:1 Mirror Rule**: Both consumers must support the same set of action types
- **Grok Prompt**: `buildSandboxApiSection()` in `GrokBridge.tsx` documents all commands for the AI
- **Action Types** (~110 total):
  - **File**: `list_tree`, `read_file`, `read_multiple_files`, `write_file`, `create_file`, `bulk_write` (atomic+rollback), `delete_file`, `bulk_delete`, `move_file`, `copy_file`, `copy_folder`, `rename_file`
  - **Folder**: `create_folder`, `delete_folder`, `move_folder`, `rename_folder`, `list_tree_filtered` (by extension, depth, ignore)
  - **Search**: `grep`, `search_files`, `search_replace` (single/multi-file, regex), `apply_patch` (unified diff with context validation)
  - **Code Intelligence**: `dead_code_detection`, `dependency_graph`, `symbol_search`, `grep_advanced` (with include/exclude filters), `extract_imports`
  - **Shell**: `run_command`, `install_deps`, `add_dependency` (pkg mgr auto-detect, version, dev flag), `run_command_advanced` (timeout, env vars)
  - **Build**: `build_with_flags`, `clean_build_cache`
  - **Code Quality**: `type_check` (tsc --noEmit), `lint_and_fix` (eslint/prettier), `format_files` (prettier)
  - **Process**: `start_process`, `kill_process`, `list_processes`, `restart_dev_server`, `list_open_ports`, `start_process_named`, `monitor_process`, `get_process_logs`, `stop_all_processes`, `switch_port`
  - **Git**: `git_init`, `git_status`, `git_add`, `git_commit`, `git_diff`, `git_log`, `git_branch`, `git_checkout`, `git_stash`, `git_push`, `git_pull`, `git_merge`, `git_stash_pop`, `git_reset`, `git_revert`, `git_tag`
  - **Environment**: `set_env_var`, `get_env_vars`, `rollback_last_change`
  - **Project**: `detect_structure`, `build_project`, `run_tests`, `get_build_metrics`, `archive_project`, `export_project` (zip/tar.gz)
  - **Analysis**: `project_analyze`, `tailwind_audit`, `find_usages`, `component_tree`, `extract_theme`/`extract_colors`
  - **Visual/Preview**: `get_preview_url`, `capture_preview`, `screenshot_preview` (captures + uploads to Catbox.moe, returns `screenshotUrl`), `visual_diff`, `capture_component`, `record_video`, `get_dom_snapshot`, `get_console_errors`
  - **Browser Interaction**: `browser_interact` / `interact_preview` — click buttons, type text, select options, evaluate JS, call window functions in the live preview. Actions: `click`, `type`, `select`, `evaluate`, `runFunction`, `waitFor`. Options: `screenshot: true` (capture after action, uploads to Catbox.moe), `waitAfter`, `extractText` + `extractSelector`
  - **AI Generation**: `generate_component`, `generate_page`, `refactor_file`, `generate_test`, `generate_storybook`, `optimize_code`, `convert_to_typescript`, `add_feature`, `migrate_framework`. All require `XAI_API` env var.
  - **Debugging/Profiling**: `react_profiler`, `memory_leak_detection`, `console_error_analysis`, `runtime_error_trace`, `bundle_analyzer`, `network_monitor`, `accessibility_audit`, `security_scan`
  - **Validation**: `validate_change` (type-check + lint pass/fail), `profile_performance` (bundle sizes + lighthouse info)
  - **Config**: `set_tailwind_config`, `set_next_config`, `update_package_json`, `manage_scripts`, `switch_package_manager`
  - **Super/Meta**: `deploy_preview`, `export_project_zip`, `import_project` (git clone), `super_command` (AI natural language → action list)
- **Bridge Prompt Doc**: `electron-browser/BRIDGE_PROMPT.md` — paste-ready prompt for AI chat with all ~110 commands documented.
- **Field names**: `copy_file`/`rename_file`/`move_file` use `source`/`dest` (not `from`/`to`). `move_folder`/`rename_folder` accept `from`/`source` + `to`/`dest`/`newName`. `list_tree` returns `entries`. `search_files` uses `pattern`.

### Puppeteer / Chromium (Global)
- `puppeteer` npm package installed globally (project-level dependency)
- System chromium installed via nix (`chromium` package) — all required libs (glib, nss, gtk3, mesa, libxkbcommon, etc.) are installed
- `sandbox-dispatcher.cjs` uses `getChromiumPath()` helper to find nix chromium and passes it via `PUPPETEER_CHROMIUM_PATH` env var to all subprocess `execSync` calls
- Puppeteer launch args: `['--no-sandbox', '--disable-gpu']` + `executablePath: process.env.PUPPETEER_CHROMIUM_PATH || undefined`
- Works for any project's `screenshot_preview`, `browser_interact`, `visual_diff`, and `capture_component` commands without per-project puppeteer install

### GET Proxy & grok-edit (Grok browsing workaround)
- Grok's `browse_page` tool only supports GET requests — it cannot POST JSON
- **PRIMARY**: `grok-edit` — simple GET with URL params, no base64. URL: `/api/grok-edit?key=KEY&project=P&path=FILE&search=OLD&replace=NEW&replaceAll=true`
- **ADVANCED**: `grok-proxy` — multi-action chains via base64-encoded payloads. URL: `/api/grok-proxy?key=KEY&project=P&payload=BASE64`
- `buildSandboxApiSection()` now takes `editUrl` as 6th parameter; all 6 call sites updated
- Prompt includes retry/backoff instructions (6s pre-wait, 8s/12s backoff on 503), discovery endpoint (`/api/grok`), screenshot workflow
- URL length limit: payloads should stay under ~6000 chars of JSON before encoding; for large files use `search_replace` instead of `write_file`

### Direct API (bypass relay)
- This vite server also exposes `POST /api/sandbox/execute?key=SNAPSHOT_KEY` directly (line ~5348 in `vite.config.ts`)
- When called, if the key matches a connected bridge client's snapshotKey, it relays to that client; otherwise it executes locally via sandbox-dispatcher
- The batch test scripts (`server/batch-cmd-test.cjs`) POST directly to this endpoint, not to the external relay

## Batch Command Testing
- **Test harness**: `server/batch-cmd-test.cjs` — 9 groups covering all 84+ sandbox commands
- **Two phases**: Phase 1 (direct HTTP tests), Phase 2 (Grok-4 autonomous execution via bridge relay)
- **Run**: `node server/batch-cmd-test.cjs <group> [p1|p2]` — group 1-9, p1=direct, p2=Grok
- **All 59 Phase 1 direct tests pass** (9 groups × 100%)
- **All 9 Phase 2 groups pass** — Grok-4 autonomously exercised 65 commands across all groups
- **Key param fixes found during testing**:
  - `extract_imports` uses `file` (not `path`)
  - `generate_test`/`optimize_code` use `file` (not `path`)
  - `generate_component` needs `description` or `spec` (not `props`)
  - `super_command` needs `description` (not `command`)
  - `manage_scripts` now supports read-only mode (omit `command` field to read without writing)
  - `git_tag` always requires `name` — use `run_command` with `git tag` to list tags

## Testing
- `npm test` — runs all Vitest tests
- `npm run test:watch` — watch mode
- Test files:
  - `src/test/safety-engine.test.ts` — safety engine validation
  - `src/test/pipeline.test.ts` — code parser unit tests + live Grok API test (creates `src/lib/greeter.ts` function)
  - `src/test/pipeline-e2e.test.ts` — end-to-end theme change test (sends `index.css` to Grok, asks "green to blue", verifies response)
  - `src/test/fixtures/` — saved JSON fixtures from live API test runs (for reference/debugging)
- Shared module: `src/lib/code-parser.ts` — `parseCodeBlocks()` + `ParsedBlock` + `parseDependencies()` + `parseActionItems()` for comprehensive Grok response parsing (used by GrokBridge + tests)
  - Code blocks: detects filenames from inline comments, preceding prose (backtick/bold/heading-wrapped), and "create/save as" patterns
  - **Unfenced multi-file format**: Handles Grok's copy-button format (`// file: index.htmlhtml`) where files are concatenated with `// file:` headers and no markdown fences. Language tags appended to filenames are stripped (e.g., `src/App.tsxtsx` → `src/App.tsx` + language `tsx`)
  - Dependencies: detects npm/yarn/pnpm/bun install commands in code blocks AND prose text (including backtick-wrapped)
  - Action items: extracts shell commands, env vars, directory creation, renames, deletions, API key requirements, restart instructions, **and program install suggestions** (C++/Python/Node/Rust/Go/Java/Docker/etc.)
  - **Sequential ordering**: All action items are sorted by their position in the source text, preserving Grok's intended execution order
  - Shell-only code blocks (bash with only install/mkdir/cd commands) are excluded from code blocks since they're already captured as deps/actions

## Program Auto-Install
- When Grok mentions installing system-level programs (g++, cmake, python, node, rust, docker, ffmpeg, etc.), the parser emits `install` type action items
- The "Download Programs" button in the Action Required panel triggers `/api/programs/install` (Vite endpoint)
- The endpoint checks if each program is already installed, then runs the platform-appropriate install command (choco on Windows, brew on macOS, apt-get on Linux)
- Supports 35+ common programs with install mappings for all 3 platforms
- Results show per-program status: already installed, newly installed, or error with details

## Dependency Auto-Install
- When Grok's response includes a `=== DEPENDENCIES ===` block or `npm install` commands in bash code blocks, the app auto-detects packages
- `parseDependencies()` in `code-parser.ts` extracts package names with multi-layer sanitization:
  - Validates against npm naming regex (must start with letter/number, no trailing dots)
  - Blocks shell metacharacters
  - Rejects known non-packages via `NOT_A_PACKAGE` blocklist (CLI tools, common English words, npm subcommands like "run"/"dev"/"start")
  - Rejects single-character names (unless scoped like `@x/y`)
  - Prose extraction stops at sentence boundaries (backticks, punctuation, connectives like "then"/"and"/"or")
- Dev server commands (`npm run dev`, `npm start`, `npx vite`) are filtered out at the parser level and rejected by the backend
- On "Apply All" for an active project, detected deps are installed via `/api/projects/install-deps` (Vite) or `install-project-deps` IPC (Electron)
- Both frontend and backend apply the same `NOT_A_PACKAGE` blocklist independently for defense-in-depth
- Backend uses async `exec` (non-blocking) instead of `execSync` to avoid freezing the Vite server thread
- Context instructions and evolution instructions tell Grok to use the structured format

## Blender Scene Building (mega_v3)
- **16 model types**, 50 objects total in scene
- **Aerial-first workflow**: lay models in grid rows for scaling audit, then place hero-first
- **Crystallized skills**: `control:blender:scene:spatial-layout`, `control:blender:scene:aerial-first-layout`
- **Scripts**: `scripts/auto_frame_models.py` (hero-first scene build), `scripts/aerial_survey.py` (top-down inventory)
- **Scale corrections applied**: anime_girl 0.62→1.6m, fungi_stump 17→2m, mossy_boulder 3.8→1.2m
- **Camera**: (0, -25, 3.5), 88° tilt (near horizontal), 35mm lens
- **Scene zones**: foreground Y=-19 to -13, midground Y=-8 to 3, background Y=8 to 25
- **Evidence**: `godmode-evidence/mega_v3_framed.blend`, `mega_v3_BUILT.png`, `mega_v3_AERIAL.png`

## Calibration App
- Route: `/calibrate` — full-screen bubble-popping click calibration
- 5 progressive rounds: 80px → 50px → 30px → 18px → 12px bubbles
- Maps click offsets into an 8×8 grid for per-region accuracy correction
- Saves calibration to `.local/calibration.json` via `POST /api/calibration`
- Crystallizes to bridge memory as `control:calibration` skill
- Retrieval: `GET /api/calibration` returns stored calibration data
- Source: `src/pages/Calibration.tsx`

## Development
- Dev server: `npx vite` (port 5000) — web-only mode
- Desktop dev: `npm run electron:dev` — full desktop experience
- Build: `npm run build` (on Windows — produces `exe/Lamby-Setup.exe`)
  - Step 1: Vite builds web assets
  - Step 2: Copies dist into electron-browser
  - Step 3: npm install in electron-browser (installs `innosetup-compiler` automatically)
  - Step 4: electron-builder packages unpacked app (`exe/win-unpacked/`)
  - Step 5: `innosetup-compiler` npm package compiles `electron-browser/build/installer.iss` → `exe/Lamby-Setup.exe`
  - No manual Inno Setup installation needed — `innosetup-compiler` bundles ISCC.exe
- Download source: Click "Download Source" in the sidebar to get a zip of all project files (excludes node_modules, .git)
- The app connects to an existing hosted Supabase project for its database and edge functions
