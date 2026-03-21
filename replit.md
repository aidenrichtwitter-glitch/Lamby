# Lamby — AI-Powered Autonomous Development Loop

## Overview
A self-evolving development environment with AI-powered code evolution (formerly "λ Recursive" / "Guardian AI"). The system autonomously scans, reflects on, and improves its own source code, acquiring capabilities and tracking evolution levels.

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
├── src/main.js                # Electron main process
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
- All code changes must be tested and validated for the Electron context.
- `local-server.js` and `vite.config.ts` must ALWAYS be 1:1 mirrors (IPC handlers in `main.js` are Electron-only — exempt from mirror rule).
- When making changes to browser-mode IPC handlers in `main.js`, always add visible logging so the user can see what's happening in Electron DevTools.
- Include `BROWSER_MODE_VERSION` (currently `v26.1`) in both `main.js` and `GrokBridge.tsx` — version mismatch warnings appear in status bar and console when Electron hasn't been rebuilt with latest code.
- **Browser automation API**: `window.__grokBrowserAutomation.sendAndCapture(prompt, label)` — exposed by GrokBridge, returns `{success, responseText, error}`. Used by evolution-bridge for browser-based evolution cycles.
- **Evolution sandbox**: `ensureEvolutionSandbox()` in `project-manager.ts` creates `evolution-sandbox` project via `duplicateProject()`. Browser-evolve writes to sandbox instead of main project.
- **Grok 4 default**: Evolution cycles default to `grok-4` model. The model selector still lists all Grok models for interactive chat.
- **Evolve button**: Clicking the Evolve button in GrokBridge's toolbar automatically runs a full evolution cycle via xAI API (Grok 4). Streams response into chat, applies code blocks, registers capabilities, saves next plan. No clipboard copy needed.
- Readiness detection uses Grok's own UI signals (copy button, follow-ups, reaction buttons) — NOT message container counting. Stop button transition (was generating → now stopped) is logged but does NOT trigger extraction — only concrete new signals do. This prevents premature extraction during Grok's "Agents thinking" deep search mode (can last 10+ minutes).
- Readiness is scoped per-prompt: `grok-send-prompt` snapshots baseline signal counts (copy buttons, reactions, follow-ups) before sending. `grok-check-response-ready` only triggers "ready" when signal counts INCREASE beyond that baseline — old responses from previous projects are ignored.
- Manual send detection: A background watcher (3s interval) calls `grok-snapshot-baseline` to check if Grok is generating without the app having sent a prompt. If detected, it snapshots the baseline and starts the same polling loop to auto-capture and process the response.

## Lamby Bridge Relay — SEPARATE APPLICATION
The Bridge Relay is a **completely separate Replit application** — it is NOT part of this codebase and does NOT run here. The relay is deployed independently:
- **Dev relay**: `https://35c4f698-dc00-400a-9452-39eaf17279c0-00-31k27xn7snnel.janeway.replit.dev` (separate Repl)
- **Production relay**: `https://bridge-relay.replit.app` (separate deployed Repl)
- **Relay source**: `server/bridge-relay.cjs` is a **reference copy** of the relay code — editing it here does NOT change the running relays. Changes must be deployed to the separate relay Repls.
- **Desktop connector**: `server/bridge-connector.cjs` runs on the user's local machine inside the Electron app. It connects TO the relay via WebSocket.
- **Browser connector**: `connectToBridge()` in `GrokBridge.tsx` connects to the relay via browser WebSocket API. Both desktop and browser use the same relay.
- **Connection URL pattern**: `wss://<relay-host>/bridge-ws?project=<PROJECT_NAME>` — no auth keys, the URL itself is the security boundary.
- **How it works**: Clients (desktop or browser) connect via WebSocket to the relay. The relay forwards snapshot/sandbox requests between Grok (via HTTP API) and the connected client. The client responds with local project data.
- **Key rule**: This app's Vite dev server and the relay are unrelated servers. Never confuse API calls to this app's backend (`/api/...` relative URLs) with API calls to the relay (`https://<relay-host>/api/...` absolute URLs).

## Function Calling (Grok ↔ Bridge Relay)
- **Endpoint**: `POST /api/grok-responses` in `vite.config.ts` — handles full xAI Responses API loop with function calling
- **Flow**: Client sends messages → server calls xAI `/v1/responses` with 10 function tools → when Grok returns `function_call`, server executes it against the bridge relay → feeds result back as `function_call_output` → loops until Grok returns final text
- **Tools registered**: `take_screenshot`, `read_file`, `write_file`, `search_replace`, `run_command`, `list_tree`, `grep_search`, `console_logs`, `read_snapshot`, `browser_interact`
- **Client integration**: `streamGrokFC()` in GrokBridge.tsx — used when bridge is online + active project + API mode. Falls back to `streamGrok()` (Supabase proxy, no tools) otherwise
- **SSE events**: `status`, `function_call`, `function_result`, `text`, `done`, `error` — streamed to client for live progress updates
- **API key resolution**: `process.env.XAI_API` → `process.env.XAI_API_KEY` → `~/.guardian-ai/settings.json` `grokApiKey`
- **Bridge relay endpoints** (`server/bridge-relay.cjs`): `/api/grok-proxy` (GET, base64 payload), `/api/grok-edit` (GET, query params, supports `searchB64`/`replaceB64` for HTML content), `/api/grok-interact` (GET, browser interaction wrapper), `/api/commands` (command discovery), `/api/screenshot/:key/:project` (direct screenshot), `/api/grok` (discovery)
- **`write_file_chunk`** (`server/sandbox-dispatcher.cjs`): Chunked file writes for files > 2KB. `chunk_index=0` creates/overwrites, subsequent chunks append. Required for large files that exceed URL length limits in grok-proxy.
- **production.cjs mirrors bridge-relay.cjs**: All relay endpoints (grok-proxy, grok-edit, grok-interact, screenshot, commands, grok discovery) are mirrored in `server/production.cjs` for deployed environments.
- **Why not browse_page**: Grok's built-in `browse_page` tool HTML-encodes `&` as `&amp;` in URLs (breaking query params) and has ~20s internal timeout (screenshots take 15-25s). Function calling bypasses both issues.

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
1. **Bridge Relay** (`bridge-relay.replit.app`) — SEPARATE deployed app, NOT part of this codebase. It is a publicly accessible relay server that:
   - Accepts GET requests from Grok at `/api/grok-proxy?key=KEY&project=P&payload=BASE64` (primary, for browser-based AI)
   - Also accepts POST requests at `/api/sandbox/execute?key=KEY` (for programmatic clients like batch tests)
   - Forwards those actions via WebSocket to connected "desktop clients"
   - Returns results back to Grok
   - Also serves snapshot/console-log endpoints for project state viewing
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

## Development
- Dev server: `npx vite` (port 5000) — web-only mode
- Desktop dev: `npm run electron:dev` — full desktop experience
- Build: `npm run build`
- Download source: Click "Download Source" in the sidebar to get a zip of all project files (excludes node_modules, .git)
- The app connects to an existing hosted Supabase project for its database and edge functions
