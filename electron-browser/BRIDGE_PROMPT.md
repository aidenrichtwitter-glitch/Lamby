# Lamby Workspace Bridge Prompt

Paste the section below (between the `---` markers) into the AI chat (Grok, ChatGPT, Claude, etc.) as the **first message** of your conversation, replacing `SNAPSHOT_URL`, `CONSOLE_LOGS_URL`, and `PROXY_URL` with the actual URLs shown in the Lamby bridge panel.

The PROXY_URL is the GET-based proxy endpoint: `https://bridge-relay.replit.app/api/grok-proxy?key=YOUR_KEY`

---

=== LAMBY WORKSPACE API (YOU HAVE FULL READ/WRITE ACCESS — USE IT) ===

You have web browsing capabilities (browse_page). Use them NOW to directly read, modify, and execute code in this project.
DO NOT just suggest code changes. Actually make the changes yourself by browsing these URLs, then tell the user what you did.
All endpoints below are GET-based, live, and publicly accessible via HTTPS. Authentication is via the `key` query parameter.

YOUR WORKFLOW — do this every time:
  1. BROWSE the snapshot URL below to see all project files and their contents
  2. ANALYZE the code to understand what needs to change
  3. BROWSE the proxy URL with base64-encoded actions to write files, run commands, etc.
  4. VERIFY by browsing the snapshot URL again or checking console logs
  5. TELL the user what you did and what changed

READ THE PROJECT (do this first):
  GET SNAPSHOT_URL
  Returns: plain-text snapshot with the complete file tree, package.json, git status, and full contents of every source file.
  This is your primary way to understand the codebase. Browse this URL with browse_page.

CHECK CONSOLE/PREVIEW LOGS:
  GET CONSOLE_LOGS_URL
  Returns: JSON { previews: [{ name, port, stdout, stderr }] } — live output from running dev servers.
  Use this to check for runtime errors, build failures, or confirm your fix worked.

EXECUTE COMMANDS via GET proxy (write files, run shell, install deps, git, etc.):
  This endpoint lets you execute ANY sandbox command using only GET requests (browse_page).
  You MUST use this endpoint — do NOT attempt POST requests, they will fail.

  HOW IT WORKS:
  1. Build your actions JSON:  { "actions": [ ...action objects... ] }
  2. Base64-encode that JSON string
  3. Browse this URL:  PROXY_URL&project=PROJECT_NAME&payload=BASE64_ENCODED_ACTIONS

  URL FORMAT:
    GET PROXY_URL&project=PROJECT_NAME&payload=<base64>
  where <base64> = base64encode(JSON.stringify({ "actions": [ ... ] }))

  Each action requires "type" and "project": "PROJECT_NAME". Actions execute in order. Max 50 per request.

  IMPORTANT: For large writes (big file content), keep payloads under ~6000 characters of JSON before encoding.
  If a file is very large, split into multiple requests or use search_replace instead of write_file.

  ── FILE OPERATIONS ──
    { type: "list_tree", project: "P" }  → full file tree
    { type: "read_file", project: "P", path: "src/App.tsx" }  → file content
    { type: "read_multiple_files", project: "P", paths: ["src/App.tsx","src/main.ts"] }  → batch read
    { type: "write_file", project: "P", path: "src/App.tsx", content: "..." }  → overwrite file (FULL content required)
    { type: "create_file", project: "P", path: "src/new.ts", content: "..." }  → create new file
    { type: "bulk_write", project: "P", files: [{path:"a.ts",content:"..."},{path:"b.ts",content:"..."}] }  → atomic multi-file write
    { type: "delete_file", project: "P", path: "src/old.ts" }  → delete single file
    { type: "bulk_delete", project: "P", paths: ["src/old.ts","src/tmp/"] }  → delete multiple files/folders
    { type: "move_file", project: "P", source: "old/path.ts", dest: "new/path.ts" }  → move file
    { type: "copy_file", project: "P", source: "src/a.ts", dest: "src/b.ts" }  → copy file
    { type: "copy_folder", project: "P", source: "src/components", dest: "src/components-backup" }  → recursive copy
    { type: "rename_file", project: "P", source: "src/old.ts", dest: "src/new.ts" }  → rename file

  ── FOLDER OPERATIONS ──
    { type: "create_folder", project: "P", path: "src/components/new" }  → create directory recursively
    { type: "delete_folder", project: "P", path: "src/old", recursive: true }  → remove folder
    { type: "move_folder", project: "P", from: "src/old", to: "src/new" }  → move/rename folder
    { type: "rename_folder", project: "P", source: "src/old", newName: "renamed" }  → rename folder in place
    { type: "list_tree_filtered", project: "P", filter: "ts|tsx", depth: 4 }  → filtered file listing by extension

  ── SEARCH & REPLACE ──
    { type: "grep", project: "P", pattern: "TODO" }  → regex search across all files
    { type: "search_files", project: "P", pattern: "Button" }  → filename search
    { type: "search_replace", project: "P", path: "src/App.tsx", search: "oldText", replace: "newText" }  → find & replace
    { type: "search_replace", project: "P", paths: ["src/a.ts","src/b.ts"], search: "old", replace: "new", regex: true }  → multi-file regex replace
    { type: "apply_patch", project: "P", patch: "--- a/file\n+++ b/file\n@@ ...\n-old\n+new" }  → apply unified diff

  ── CODE INTELLIGENCE ──
    { type: "dead_code_detection", project: "P" }  → finds exported modules that are never imported
    { type: "dependency_graph", project: "P" }  → import/require graph of all modules
    { type: "symbol_search", project: "P", query: "Button" }  → search function/class/type definitions
    { type: "grep_advanced", project: "P", pattern: "TODO|FIXME", include: [".ts"], case_sensitive: false }  → regex with file type filters
    { type: "extract_imports", project: "P", file: "src/App.tsx" }  → list all imports from a file (sources + specifiers)

  ── SHELL COMMANDS ──
    { type: "run_command", project: "P", command: "npm run build" }  → execute shell command
    { type: "run_command_advanced", project: "P", command: "npm run build", timeout: 60000, env: { NODE_ENV: "production" } }  → with custom timeout & env
    { type: "install_deps", project: "P" }  → auto-detects npm/yarn/pnpm/bun and installs
    { type: "add_dependency", project: "P", name: "lodash", dev: false }  → add package (optional version, dev flag)

  ── BUILD & CACHE ──
    { type: "build_project", project: "P" }  → runs the project build command
    { type: "build_with_flags", project: "P", flags: ["--mode", "production"] }  → build with custom flags
    { type: "clean_build_cache", project: "P" }  → removes dist, .next, .cache, build, .turbo, etc.
    { type: "get_build_metrics", project: "P" }  → dist/ file sizes and total

  ── CODE QUALITY ──
    { type: "type_check", project: "P" }  → runs tsc --noEmit
    { type: "lint_and_fix", project: "P" }  → eslint --fix or prettier
    { type: "format_files", project: "P", files: "src/" }  → prettier --write
    { type: "validate_change", project: "P" }  → runs type-check + lint, reports pass/fail

  ── DEV SERVER & PROCESS MANAGEMENT ──
    { type: "start_process", project: "P", command: "npm run dev" }  → start background process
    { type: "start_process_named", project: "P", command: "npm run dev", name: "my-server" }  → start with explicit name
    { type: "list_processes", project: "P" }  → list all running sandbox processes
    { type: "kill_process", project: "P", name: "proc-name" }  → kill named process
    { type: "stop_all_processes", project: "P" }  → SIGTERM all sandbox processes
    { type: "monitor_process", project: "P", pid: 1234 }  → check if process is alive
    { type: "get_process_logs", project: "P", name: "dev-server" }  → get stdout/stderr of running process
    { type: "restart_dev_server", project: "P", command: "npm run dev" }  → kills all, optionally restarts
    { type: "list_open_ports", project: "P" }  → shows listening ports
    { type: "switch_port", project: "P", port: 3001 }  → register port preference

  ── GIT ──
    { type: "git_init", project: "P" }  → initialize git repo
    { type: "git_status", project: "P" }  → show working tree status
    { type: "git_add", project: "P", files: "." }  → stage files
    { type: "git_commit", project: "P", message: "fix: description" }  → commit staged changes
    { type: "git_diff", project: "P" }  → show uncommitted changes
    { type: "git_log", project: "P", count: 10 }  → show recent commits
    { type: "git_branch", project: "P", name: "feature-x" }  → create branch (omit name to list)
    { type: "git_checkout", project: "P", ref: "main" }  → switch branch
    { type: "git_stash", project: "P" }  → stash uncommitted changes
    { type: "git_stash_pop", project: "P" }  → pop latest stash
    { type: "git_push", project: "P", remote: "origin", branch: "main" }  → push to remote
    { type: "git_pull", project: "P", remote: "origin" }  → pull from remote
    { type: "git_merge", project: "P", branch: "feature-x" }  → merge branch
    { type: "git_reset", project: "P", mode: "hard", ref: "HEAD~1" }  → reset (soft/hard)
    { type: "git_revert", project: "P", commit: "abc123" }  → revert a specific commit
    { type: "git_tag", project: "P", name: "v1.0.0", message: "Release 1.0" }  → create annotated tag

  ── VISUAL & PREVIEW ──
    { type: "get_preview_url", project: "P" }  → returns running dev server URL/port
    { type: "capture_preview", project: "P" }  → preview URL + screenshot (requires puppeteer/playwright)
    { type: "screenshot_preview", project: "P" }  → take PNG screenshot, uploads to Imgur, returns { imgurUrl: "https://i.imgur.com/xxx.png" }
    { type: "screenshot_preview", project: "P", selector: "#hero", width: 1280, height: 720 }  → screenshot a specific element
    { type: "screenshot_preview", project: "P", fullPage: true, waitMs: 3000 }  → full-page capture with delay
    Screenshots are automatically uploaded to Imgur. Browse the imgurUrl to view/share. Requires IMGUR_CLIENT_ID env var.
    { type: "visual_diff", project: "P", beforeUrl: "...", afterUrl: "..." }  → visual comparison stub
    { type: "capture_component", project: "P", componentName: "Header" }  → component screenshot stub
    { type: "record_video", project: "P", duration: 5 }  → video recording stub (requires puppeteer/playwright)
    { type: "get_dom_snapshot", project: "P" }  → fetch HTML of running preview server
    { type: "get_console_errors", project: "P" }  → extract errors from all running processes

  ── BROWSER INTERACTION (click buttons, type text, run JS in the live preview) ──
    { type: "browser_interact", project: "P", action: "click", selector: "#submit-btn" }  → click an element
    { type: "browser_interact", project: "P", action: "click", selector: "#btn", screenshot: true }  → click + capture screenshot after
    { type: "browser_interact", project: "P", action: "type", selector: "#input", value: "hello" }  → type into input field
    { type: "browser_interact", project: "P", action: "select", selector: "#dropdown", value: "option1" }  → select dropdown value
    { type: "browser_interact", project: "P", action: "evaluate", script: "return document.title" }  → run JS, get return value
    { type: "browser_interact", project: "P", action: "runFunction", functionName: "window.myFunc", args: ["a"] }  → call window function
    { type: "browser_interact", project: "P", action: "waitFor", selector: ".loaded", timeout: 10000 }  → wait for element
    Options: screenshot: true, waitAfter: 2000 (ms), extractText: true + extractSelector: "#result"
    Requires puppeteer or playwright installed in the project.

  ── ANALYSIS ──
    { type: "project_analyze", project: "P" }  → routes, components, deps, file stats, CSS vars
    { type: "tailwind_audit", project: "P" }  → Tailwind config, custom colors, used classes
    { type: "find_usages", project: "P", symbol: "MyComponent" }  → grep symbol with context lines
    { type: "component_tree", project: "P" }  → React import/export/JSX dependency tree
    { type: "extract_theme", project: "P" }  → CSS custom properties + Tailwind color config
    { type: "extract_colors", project: "P" }  → alias for extract_theme
    { type: "detect_structure", project: "P" }  → framework, entry point, package manager

  ── AI GENERATION (requires XAI_API env var) ──
    { type: "generate_component", project: "P", spec: "a dark-themed login form", name: "LoginForm" }  → AI generates component file
    { type: "generate_page", project: "P", spec: "dashboard with charts", name: "Dashboard" }  → AI generates page file
    { type: "refactor_file", project: "P", path: "src/App.tsx", instructions: "add error boundary" }  → AI refactors existing file
    { type: "generate_test", project: "P", file: "src/utils.ts" }  → AI generates unit test file
    { type: "generate_storybook", project: "P", component: "Button" }  → AI generates Storybook stories
    { type: "optimize_code", project: "P", file: "src/App.tsx" }  → AI optimizes file for performance
    { type: "convert_to_typescript", project: "P", file: "src/utils.js" }  → AI converts JavaScript to TypeScript
    { type: "add_feature", project: "P", featureSpec: "add dark mode toggle", path: "src/ThemeToggle.tsx" }  → AI generates feature file
    { type: "migrate_framework", project: "P", target: "vite" }  → migration guide for framework switch

  ── DEBUGGING & PROFILING ──
    { type: "react_profiler", project: "P" }  → static analysis for React performance issues (memo, useEffect, useMemo)
    { type: "memory_leak_detection", project: "P" }  → scan for event listener/timer/connection leaks
    { type: "console_error_analysis", project: "P" }  → categorize errors/warnings from all processes
    { type: "runtime_error_trace", project: "P" }  → find error boundaries, try/catch blocks, unhandled throws
    { type: "bundle_analyzer", project: "P" }  → detailed build output analysis by file type and size
    { type: "network_monitor", project: "P" }  → list active TCP connections
    { type: "accessibility_audit", project: "P" }  → heuristic a11y scan (alt attrs, roles, labels)
    { type: "security_scan", project: "P" }  → npm audit + dangerous patterns + hardcoded secrets
    { type: "profile_performance", project: "P" }  → bundle sizes + lighthouse availability

  ── ENVIRONMENT ──
    { type: "set_env_var", project: "P", key: "API_KEY", value: "..." }  → sets in .env file
    { type: "get_env_vars", project: "P" }  → reads .env key-value pairs
    { type: "rollback_last_change", project: "P", files: "src/App.tsx" }  → git checkout specific files
    { type: "rollback_last_change", project: "P" }  → git stash pop or checkout all

  ── CONFIG & META ──
    { type: "set_tailwind_config", project: "P", config: { content: ["./src/**/*.tsx"] } }  → create/update tailwind config
    { type: "set_next_config", project: "P", config: { reactStrictMode: true } }  → create/update Next.js config
    { type: "update_package_json", project: "P", changes: { scripts: { dev: "vite" } } }  → merge changes into package.json
    { type: "manage_scripts", project: "P", scriptName: "lint", command: "eslint src/" }  → add/update/delete npm scripts
    { type: "switch_package_manager", project: "P", manager: "pnpm" }  → switch between npm/yarn/pnpm
    { type: "run_tests", project: "P" }  → runs the project test suite
    { type: "archive_project", project: "P" }  → create git archive
    { type: "export_project", project: "P", format: "zip" }  → archive project (zip or tar.gz)

  ── SUPER & META ──
    { type: "deploy_preview", project: "P", command: "npm run dev" }  → start preview server
    { type: "export_project_zip", project: "P" }  → alias for export_project with zip format
    { type: "import_project", project: "P", url: "https://github.com/user/repo", name: "my-project" }  → clone git repo as new project
    { type: "super_command", project: "P", description: "add a footer with social links" }  → AI translates natural language to action list

  RESPONSE FORMAT (returned as JSON in the page you browse):
    { "success": true, "results": [ { "actionIndex": 0, "status": "success", "data": {...} }, ... ] }

  EXAMPLE — read a file then write it:
  Step 1: Build the actions JSON:
    {"actions":[{"type":"read_file","project":"P","path":"index.html"}]}
  Step 2: Base64-encode it:
    eyJhY3Rpb25zIjpbeyJ0eXBlIjoicmVhZF9maWxlIiwicHJvamVjdCI6IlAiLCJwYXRoIjoiaW5kZXguaHRtbCJ9XX0=
  Step 3: Browse:
    GET PROXY_URL&project=P&payload=eyJhY3Rpb25zIjpbeyJ0eXBlIjoicmVhZF9maWxlIiwicHJvamVjdCI6IlAiLCJwYXRoIjoiaW5kZXguaHRtbCJ9XX0=

  Then to write the updated file, build a new actions JSON with write_file, base64-encode it, and browse that URL.

IMPORTANT RULES:
  - ALWAYS use browse_page on these URLs to make changes. Do NOT just show code in your response.
  - ALL endpoints are GET-based. Use browse_page to call them. Do NOT attempt POST requests.
  - Browse the snapshot FIRST to understand the current state before making changes.
  - write_file requires COMPLETE file content — not partial snippets or diffs.
  - For large files, prefer search_replace over write_file to keep payloads small.
  - Do the work, verify it, then explain to the user what you changed.
  - If an API call fails, retry once. If it still fails, fall back to showing code blocks.
  - Replace "P" above with the actual project name shown in the snapshot URL.

=== END WORKSPACE API ===

---

After pasting the above, follow up with your actual request (e.g., "Fix the login page styling" or "Add a dark mode toggle").
