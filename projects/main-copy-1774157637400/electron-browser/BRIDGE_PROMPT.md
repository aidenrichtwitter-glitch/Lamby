# Lamby Workspace Bridge Prompt

## Method 1: xAI Responses API (Programmatic — RECOMMENDED)

Use `POST https://api.x.ai/v1/responses` with **grok-4** and function tools.
Grok calls your functions → you execute them via the bridge relay → return results to Grok.

### Setup

```
MODEL: grok-4-0709
API: POST https://api.x.ai/v1/responses
RELAY: https://bridge-relay.replit.app
KEY: (from /api/snapshot-key)
PROJECT: (your project name)
```

### Function Tools to Register

```json
[
  {
    "type": "function",
    "name": "read_snapshot",
    "description": "Read the full project snapshot including file tree, package.json, git status, and all source file contents",
    "parameters": {
      "type": "object",
      "properties": {
        "project": { "type": "string", "description": "Project name" }
      },
      "required": ["project"]
    }
  },
  {
    "type": "function",
    "name": "read_file",
    "description": "Read a single file from the project",
    "parameters": {
      "type": "object",
      "properties": {
        "project": { "type": "string" },
        "path": { "type": "string", "description": "File path relative to project root" }
      },
      "required": ["project", "path"]
    }
  },
  {
    "type": "function",
    "name": "write_file",
    "description": "Write complete content to a file (overwrites existing)",
    "parameters": {
      "type": "object",
      "properties": {
        "project": { "type": "string" },
        "path": { "type": "string" },
        "content": { "type": "string", "description": "Full file content" }
      },
      "required": ["project", "path", "content"]
    }
  },
  {
    "type": "function",
    "name": "search_replace",
    "description": "Find and replace text in a file",
    "parameters": {
      "type": "object",
      "properties": {
        "project": { "type": "string" },
        "path": { "type": "string" },
        "search": { "type": "string", "description": "Text to find" },
        "replace": { "type": "string", "description": "Replacement text" },
        "replaceAll": { "type": "boolean", "description": "Replace all occurrences", "default": true }
      },
      "required": ["project", "path", "search", "replace"]
    }
  },
  {
    "type": "function",
    "name": "run_command",
    "description": "Execute a shell command in the project directory",
    "parameters": {
      "type": "object",
      "properties": {
        "project": { "type": "string" },
        "command": { "type": "string", "description": "Shell command to run" }
      },
      "required": ["project", "command"]
    }
  },
  {
    "type": "function",
    "name": "list_tree",
    "description": "List the full file tree of the project",
    "parameters": {
      "type": "object",
      "properties": {
        "project": { "type": "string" }
      },
      "required": ["project"]
    }
  },
  {
    "type": "function",
    "name": "grep_search",
    "description": "Search across all project files using regex",
    "parameters": {
      "type": "object",
      "properties": {
        "project": { "type": "string" },
        "pattern": { "type": "string", "description": "Regex pattern to search for" }
      },
      "required": ["project", "pattern"]
    }
  },
  {
    "type": "function",
    "name": "take_screenshot",
    "description": "Take a PNG screenshot of the running dev server, uploaded to Catbox.moe",
    "parameters": {
      "type": "object",
      "properties": {
        "project": { "type": "string" },
        "selector": { "type": "string", "description": "CSS selector to screenshot (optional)" },
        "fullPage": { "type": "boolean", "description": "Capture full page (optional)" },
        "waitMs": { "type": "integer", "description": "Wait before capture in ms (optional)" }
      },
      "required": ["project"]
    }
  },
  {
    "type": "function",
    "name": "console_logs",
    "description": "Get live console output from running dev servers",
    "parameters": {
      "type": "object",
      "properties": {
        "project": { "type": "string" }
      },
      "required": ["project"]
    }
  },
  {
    "type": "function",
    "name": "execute_actions",
    "description": "Execute multiple sandbox actions in sequence (for advanced operations like git, install deps, bulk writes, browser interaction, etc.)",
    "parameters": {
      "type": "object",
      "properties": {
        "project": { "type": "string" },
        "actions": {
          "type": "array",
          "items": { "type": "object" },
          "description": "Array of action objects, each with 'type' and action-specific fields"
        }
      },
      "required": ["project", "actions"]
    }
  }
]
```

### How to Execute Function Calls

When Grok returns a `function_call` output item, execute it by calling the bridge relay:

**For `read_snapshot`:**
```
GET https://bridge-relay.replit.app/api/snapshot/{project}?key=KEY
```

**For `console_logs`:**
```
GET https://bridge-relay.replit.app/api/console-logs?key=KEY&project=PROJECT
```

**For `search_replace` (via grok-edit — simple GET, no base64):**
```
GET https://bridge-relay.replit.app/api/grok-edit?key=KEY&project=P&path=FILE&search=OLD&replace=NEW&replaceAll=true
```

**For all other functions (via grok-proxy — base64-encoded actions):**
```
GET https://bridge-relay.replit.app/api/grok-proxy?key=KEY&project=P&payload=BASE64
```
Where BASE64 = base64encode(JSON.stringify({ "actions": [ { "type": "...", "project": "P", ... } ] }))

Then send the result back to Grok as a `function_call_output`:
```json
{
  "model": "grok-4-0709",
  "previous_response_id": "<response_id_from_step_1>",
  "input": [{
    "type": "function_call_output",
    "call_id": "<call_id_from_function_call>",
    "output": "<JSON string of the result>"
  }]
}
```

### Complete Working Example (Node.js)

```javascript
const https = require('https');
const API_KEY = process.env.XAI_API;
const BRIDGE_KEY = 'YOUR_BRIDGE_KEY';
const PROJECT = 'landing-page';

function xaiRequest(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.x.ai', path: '/v1/responses', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}`, 'Content-Length': Buffer.byteLength(data) },
      timeout: 120000
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function bridgeProxy(project, actions) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify({ actions })).toString('base64');
    const path = `/api/grok-proxy?key=${BRIDGE_KEY}&project=${project}&payload=${payload}`;
    https.get({ hostname: 'bridge-relay.replit.app', path, timeout: 90000 }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

function bridgeSnapshot(project) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: 'bridge-relay.replit.app', path: `/api/snapshot/${project}?key=${BRIDGE_KEY}`, timeout: 30000 }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function executeFunctionCall(fc) {
  const args = JSON.parse(fc.arguments);
  const project = args.project || PROJECT;

  switch (fc.name) {
    case 'read_snapshot':
      return await bridgeSnapshot(project);
    case 'read_file':
      return await bridgeProxy(project, [{ type: 'read_file', project, path: args.path }]);
    case 'write_file':
      return await bridgeProxy(project, [{ type: 'write_file', project, path: args.path, content: args.content }]);
    case 'search_replace': {
      const url = `/api/grok-edit?key=${BRIDGE_KEY}&project=${project}&path=${encodeURIComponent(args.path)}&search=${encodeURIComponent(args.search)}&replace=${encodeURIComponent(args.replace)}&replaceAll=${args.replaceAll !== false}`;
      return new Promise((resolve, reject) => {
        https.get({ hostname: 'bridge-relay.replit.app', path: url, timeout: 30000 }, res => {
          let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
      });
    }
    case 'run_command':
      return await bridgeProxy(project, [{ type: 'run_command', project, command: args.command }]);
    case 'list_tree':
      return await bridgeProxy(project, [{ type: 'list_tree', project }]);
    case 'grep_search':
      return await bridgeProxy(project, [{ type: 'grep', project, pattern: args.pattern }]);
    case 'take_screenshot':
      return await bridgeProxy(project, [{ type: 'screenshot_preview', project, ...args }]);
    case 'console_logs':
      return new Promise((resolve, reject) => {
        https.get({ hostname: 'bridge-relay.replit.app', path: `/api/console-logs?key=${BRIDGE_KEY}&project=${project}`, timeout: 15000 }, res => {
          let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
      });
    case 'execute_actions':
      return await bridgeProxy(project, args.actions.map(a => ({ ...a, project })));
    default:
      return { error: `Unknown function: ${fc.name}` };
  }
}

(async () => {
  // Step 1: Send user request to Grok-4 with function tools
  const r1 = await xaiRequest({
    model: 'grok-4-0709',
    tools: TOOLS,  // the array from above
    input: 'Read the project files, then change the hero heading to "Welcome to Lamby"',
    temperature: 0
  });

  // Step 2: Process function calls in a loop
  let response = r1;
  while (true) {
    const functionCalls = (response.output || []).filter(o => o.type === 'function_call');
    if (functionCalls.length === 0) break;

    const outputs = [];
    for (const fc of functionCalls) {
      const result = await executeFunctionCall(fc);
      outputs.push({
        type: 'function_call_output',
        call_id: fc.call_id || fc.id,
        output: typeof result === 'string' ? result : JSON.stringify(result)
      });
    }

    response = await xaiRequest({
      model: 'grok-4-0709',
      previous_response_id: response.id,
      input: outputs
    });
  }

  // Step 3: Print final message
  for (const item of (response.output || [])) {
    if (item.type === 'message') {
      item.content?.forEach(c => console.log(c.text));
    }
  }
})();
```

### All Available Action Types (for execute_actions)

See the full list in Method 2 below. Any action listed there can be passed in the `actions` array.

---

## Method 2: Manual Browse (Paste into Grok Chat)

Paste the section below into Grok's chat, replacing placeholders with your actual URLs.

```
SNAPSHOT_URL = https://bridge-relay.replit.app/api/snapshot/PROJECT_NAME?key=YOUR_KEY
CONSOLE_LOGS_URL = https://bridge-relay.replit.app/api/console-logs?key=YOUR_KEY&project=PROJECT_NAME
PROXY_URL = https://bridge-relay.replit.app/api/grok-proxy?key=YOUR_KEY
EDIT_URL = https://bridge-relay.replit.app/api/grok-edit?key=YOUR_KEY
```

---

=== LAMBY WORKSPACE API (YOU HAVE FULL READ/WRITE ACCESS — USE IT) ===

You have web browsing capabilities (browse_page). Use them NOW to directly read, modify, and execute code in this project.
DO NOT just suggest code changes. Actually make the changes yourself by browsing these URLs, then tell the user what you did.
All endpoints below are GET-based, live, and publicly accessible via HTTPS. Authentication is via the `key` query parameter.

YOUR WORKFLOW — do this every time:
  1. BROWSE the snapshot URL below to see all project files and their contents
  2. ANALYZE the code to understand what needs to change
  3. USE grok-edit (PRIMARY) for simple text replacements or grok-proxy for multi-action chains
  4. VERIFY by browsing the snapshot URL again or checking console logs
  5. USE screenshot_preview to capture the result and share the Catbox URL
  6. TELL the user what you did and what changed

READ THE PROJECT (do this first):
  GET SNAPSHOT_URL
  Returns: plain-text snapshot with the complete file tree, package.json, git status, and full contents of every source file.
  This is your primary way to understand the codebase. Browse this URL with browse_page.

CHECK CONSOLE/PREVIEW LOGS:
  GET CONSOLE_LOGS_URL
  Returns: JSON { previews: [{ name, port, stdout, stderr }] } — live output from running dev servers.
  Use this to check for runtime errors, build failures, or confirm your fix worked.

PRIMARY EDIT METHOD — grok-edit (simple GET, no base64):
  EDIT_URL&project=PROJECT_NAME&path=FILE_PATH&search=OLD_TEXT&replace=NEW_TEXT&replaceAll=true

  This is the fastest way to edit files. URL-encode the search and replace values.
  Returns: { "success": true, "results": [{ "data": { "replacements": N } }] }

  EXAMPLE:
  EDIT_URL&project=PROJECT_NAME&path=index.html&search=text-white&replace=text-purple-300&replaceAll=true

RETRY & ERROR HANDLING (follow strictly):
  1. Before any grok-edit call, wait at least 6 seconds.
  2. On 503 (or timeout):
     - Wait 8 seconds, retry (attempt 2)
     - Wait 12 seconds, retry (attempt 3)
     - On 3rd failure, report honestly with retry count and pause.
  3. Always tell the user:
     - Exact URL called
     - Success / 503 + retries used
     - Current page status from snapshot
  Never claim a change happened unless you saw {"success":true}.

ADVANCED: GET proxy for multi-action chains (read + edit + run in one call):
  Use this when you need multiple actions in one request (read files, run commands, git, install deps, etc.).
  1. Build actions JSON:  { "actions": [ ...action objects... ] }
  2. Base64-encode that JSON string
  3. Browse:  PROXY_URL&project=PROJECT_NAME&payload=BASE64_ENCODED_ACTIONS

  Each action needs "type" and "project": "PROJECT_NAME". Max 50 per request.
  Keep payloads under ~6000 chars of JSON before encoding. Use search_replace over write_file for large files.

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
    { type: "capture_preview", project: "P" }  → preview URL + screenshot
    { type: "screenshot_preview", project: "P" }  → take PNG screenshot, uploads to Catbox.moe, returns { screenshotUrl: "https://files.catbox.moe/abc123.png" }
    { type: "screenshot_preview", project: "P", selector: "#hero", width: 1280, height: 720 }  → screenshot a specific element
    { type: "screenshot_preview", project: "P", fullPage: true, waitMs: 3000 }  → full-page capture with delay
    Screenshots auto-upload to Catbox.moe (anonymous, no account needed). Browse the screenshotUrl to view/share.
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
    Options: screenshot: true (capture + upload after action), waitAfter: 2000 (ms), extractText: true + extractSelector: "#result"

  ── ANALYSIS ──
    { type: "project_analyze", project: "P" }  → routes, components, deps, file stats, CSS vars
    { type: "tailwind_audit", project: "P" }  → Tailwind config, custom colors, used classes
    { type: "find_usages", project: "P", symbol: "MyComponent" }  → grep symbol with context lines
    { type: "component_tree", project: "P" }  → React import/export/JSX dependency tree
    { type: "extract_theme", project: "P" }  → CSS custom properties + Tailwind color config
    { type: "detect_structure", project: "P" }  → framework, entry point, package manager

  ── AI GENERATION (requires XAI_API env var) ──
    { type: "generate_component", project: "P", spec: "a dark-themed login form", name: "LoginForm" }  → AI generates component file
    { type: "generate_page", project: "P", spec: "dashboard with charts", name: "Dashboard" }  → AI generates page file
    { type: "refactor_file", project: "P", path: "src/App.tsx", instructions: "add error boundary" }  → AI refactors existing file
    { type: "generate_test", project: "P", file: "src/utils.ts" }  → AI generates unit test file
    { type: "optimize_code", project: "P", file: "src/App.tsx" }  → AI optimizes file for performance
    { type: "convert_to_typescript", project: "P", file: "src/utils.js" }  → AI converts JavaScript to TypeScript
    { type: "add_feature", project: "P", featureSpec: "add dark mode toggle", path: "src/ThemeToggle.tsx" }  → AI generates feature file

  ── DEBUGGING & PROFILING ──
    { type: "react_profiler", project: "P" }  → static analysis for React performance issues
    { type: "memory_leak_detection", project: "P" }  → scan for event listener/timer/connection leaks
    { type: "console_error_analysis", project: "P" }  → categorize errors/warnings from all processes
    { type: "bundle_analyzer", project: "P" }  → detailed build output analysis by file type and size
    { type: "accessibility_audit", project: "P" }  → heuristic a11y scan
    { type: "security_scan", project: "P" }  → npm audit + dangerous patterns + hardcoded secrets

  ── ENVIRONMENT ──
    { type: "set_env_var", project: "P", key: "API_KEY", value: "..." }  → sets in .env file
    { type: "get_env_vars", project: "P" }  → reads .env key-value pairs
    { type: "rollback_last_change", project: "P", files: "src/App.tsx" }  → git checkout specific files

  ── CONFIG & META ──
    { type: "set_tailwind_config", project: "P", config: { content: ["./src/**/*.tsx"] } }  → create/update tailwind config
    { type: "update_package_json", project: "P", changes: { scripts: { dev: "vite" } } }  → merge changes into package.json
    { type: "manage_scripts", project: "P", scriptName: "lint", command: "eslint src/" }  → add/update/delete npm scripts
    { type: "run_tests", project: "P" }  → runs the project test suite

  RESPONSE FORMAT (returned as JSON):
    { "success": true, "results": [ { "actionIndex": 0, "status": "success", "data": {...} }, ... ] }

IMPORTANT RULES:
  - ALWAYS use browse_page on these URLs to make changes. Do NOT just show code in your response.
  - ALL endpoints are GET-based. Do NOT attempt POST requests.
  - Browse the snapshot FIRST to understand the current state before making changes.
  - Prefer grok-edit for single-file edits (simpler, faster). Use grok-proxy for multi-step operations.
  - After making visual changes, take a screenshot_preview and share the screenshotUrl with the user.
  - Never claim a change happened unless you saw {"success":true}.
  - If an API call fails 3 times, report honestly and fall back to // file: blocks.

=== END WORKSPACE API ===

---

After pasting the above, follow up with your actual request (e.g., "Fix the login page styling" or "Add a dark mode toggle").
