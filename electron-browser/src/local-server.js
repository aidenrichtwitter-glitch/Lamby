const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, execSync } = require("child_process");
const os = require("os");

const _USER_DATA = path.join(os.homedir(), ".guardian-ai");
if (!fs.existsSync(_USER_DATA)) fs.mkdirSync(_USER_DATA, { recursive: true });
const LOG_FILE = path.join(_USER_DATA, "local-server.log");
const _logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
const _origLog = console.log;
const _origErr = console.error;
const _origWarn = console.warn;
function _ts() { return new Date().toISOString().slice(11, 23); }
console.log = function (...args) {
  const line = `${_ts()} ${args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ")}`;
  _logStream.write(line + "\n");
  _origLog.apply(console, args);
};
console.error = function (...args) {
  const line = `${_ts()} ERROR ${args.map(a => typeof a === "string" ? a : (a && a.stack ? a.stack : JSON.stringify(a))).join(" ")}`;
  _logStream.write(line + "\n");
  _origErr.apply(console, args);
};
console.warn = function (...args) {
  const line = `${_ts()} WARN ${args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ")}`;
  _logStream.write(line + "\n");
  _origWarn.apply(console, args);
};

console.log(`[Lamby Local] ====== STARTING ======`);
console.log(`[Lamby Local] Node ${process.version} | PID ${process.pid} | ${process.platform}`);
console.log(`[Lamby Local] CWD: ${process.cwd()}`);
console.log(`[Lamby Local] Log file: ${LOG_FILE}`);

function _fallbackDetectPmForDir(projDir) {
  if (fs.existsSync(path.join(projDir, "bun.lockb")) || fs.existsSync(path.join(projDir, "bun.lock"))) return "bun";
  if (fs.existsSync(path.join(projDir, "pnpm-lock.yaml")) || fs.existsSync(path.join(projDir, "pnpm-workspace.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projDir, "yarn.lock"))) return "yarn";
  return "npm";
}

function _fallbackBuildPmCommand(pm, action, args = "") {
  const a = args ? ` ${args}` : "";
  if (action === "install") {
    if (pm === "bun") return `npx bun install${a}`;
    if (pm === "pnpm") return `npx pnpm install --no-frozen-lockfile${a}`;
    if (pm === "yarn") return `npx yarn install --ignore-engines${a}`;
    return `npm install --legacy-peer-deps${a}`;
  }
  if (action === "run") return `${pm} run${a}`;
  return `${pm} ${action}${a}`;
}

function _fallbackBuildInstallCascade(pm) {
  if (pm === "bun") return ["npx bun install", "npm install --legacy-peer-deps"];
  if (pm === "pnpm") return ["npx pnpm install --no-frozen-lockfile", "npm install --legacy-peer-deps"];
  if (pm === "yarn") return ["npx yarn install --ignore-engines", "npm install --legacy-peer-deps"];
  return ["npm install --legacy-peer-deps", "npm install --legacy-peer-deps --force", "npm install --force --ignore-scripts"];
}

function _fallbackValidateProjectPath(projectName, filePath, projectsDir) {
  if (!projectName || /[\/\\]|\.\./.test(projectName) || projectName === '.' || projectName.startsWith('.')) {
    return { valid: false, resolved: "", error: "Invalid project name" };
  }
  const projectDir = path.resolve(projectsDir, projectName);
  if (!projectDir.startsWith(projectsDir + path.sep) && projectDir !== projectsDir) {
    return { valid: false, resolved: "", error: "Path traversal blocked" };
  }
  if (filePath) {
    const resolved = path.resolve(projectDir, filePath);
    if (!resolved.startsWith(projectDir + path.sep) && resolved !== projectDir) {
      return { valid: false, resolved: "", error: "File path traversal blocked" };
    }
    return { valid: true, resolved };
  }
  return { valid: true, resolved: projectDir };
}

function _fallbackGatherProjectSnapshot(projectName, projectsDir) {
  const projectDir = path.resolve(projectsDir, projectName);
  if (!fs.existsSync(projectDir)) return `Error: Project "${projectName}" not found.`;
  const SKIP = new Set(["node_modules", ".cache", "dist", ".git", ".next", ".nuxt", "build"]);
  const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".py", ".md"]);
  const files = [];
  function walk(dir, base) {
    try {
      for (const name of fs.readdirSync(dir)) {
        if (name.startsWith(".") || SKIP.has(name)) continue;
        const full = path.join(dir, name);
        const rel = base ? base + "/" + name : name;
        try {
          const s = fs.lstatSync(full);
          if (s.isDirectory()) walk(full, rel);
          else files.push(rel);
        } catch {}
      }
    } catch {}
  }
  walk(projectDir, "");
  let out = `=== LAMBY PROJECT SNAPSHOT ===\nProject: ${projectName}\n\n=== FILE TREE ===\n`;
  for (const f of files) out += `- ${f}\n`;
  out += `\nTotal files: ${files.length}\n\n=== SOURCE FILES ===\n`;
  let budget = out.length;
  for (const f of files) {
    if (budget > 80000) break;
    const ext = path.extname(f).toLowerCase();
    if (!CODE_EXTS.has(ext)) continue;
    try {
      let content = fs.readFileSync(path.join(projectDir, f), "utf-8");
      if (content.length > 12000) content = content.substring(0, 12000) + "\n... (truncated)";
      const block = `\n--- ${f} ---\n${content}\n`;
      budget += block.length;
      out += block;
    } catch {}
  }
  out += `\n=== END SNAPSHOT ===\n`;
  return out;
}

let executeSandboxActions, gatherProjectSnapshot, validateProjectPath, detectPmForDir, buildPmCommand, buildInstallCascade;
try {
  const sandbox = require("../../server/sandbox-dispatcher.cjs");
  executeSandboxActions = sandbox.executeSandboxActions;
  gatherProjectSnapshot = sandbox.gatherProjectSnapshot;
  validateProjectPath = sandbox.validateProjectPath;
  detectPmForDir = sandbox.detectPmForDir;
  buildPmCommand = sandbox.buildPmCommand;
  buildInstallCascade = sandbox.buildInstallCascade;
  console.log(`[Lamby Local] Loaded sandbox-dispatcher.cjs OK`);
} catch (e) {
  console.warn(`[Lamby Local] sandbox-dispatcher.cjs not found — using built-in fallbacks: ${e.message}`);
  detectPmForDir = _fallbackDetectPmForDir;
  buildPmCommand = _fallbackBuildPmCommand;
  buildInstallCascade = _fallbackBuildInstallCascade;
  validateProjectPath = _fallbackValidateProjectPath;
  gatherProjectSnapshot = _fallbackGatherProjectSnapshot;
  executeSandboxActions = async () => ({ error: "sandbox-dispatcher not available" });
}


const USER_DATA_DIR = _USER_DATA;
const PROJECTS_DIR = path.resolve(process.env.PROJECT_DIR || path.join(USER_DATA_DIR, "projects"));
const BRIDGE_CONFIG_PATH = path.join(USER_DATA_DIR, "bridge-config.json");
const PORT = parseInt(process.env.LAMBY_PORT || "4999", 10);
let _activePreviewPort = null;

if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

const CANONICAL_RELAY_URL = "wss://bridge-relay.replit.app";

function isLocalhostUrl(url) {
  return /^(wss?|https?):\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(url || "");
}

function loadBridgeConfig() {
  try {
    if (fs.existsSync(BRIDGE_CONFIG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(BRIDGE_CONFIG_PATH, "utf-8"));
      if (!cfg.relayUrl || isLocalhostUrl(cfg.relayUrl)) {
        cfg.relayUrl = CANONICAL_RELAY_URL;
        try { fs.writeFileSync(BRIDGE_CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8"); } catch {}
      }
      return cfg;
    }
  } catch {}
  const cfg = { relayUrl: CANONICAL_RELAY_URL };
  try {
    fs.mkdirSync(path.dirname(BRIDGE_CONFIG_PATH), { recursive: true });
    fs.writeFileSync(BRIDGE_CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
  } catch {}
  return cfg;
}

function saveBridgeConfig(config) {
  try {
    fs.writeFileSync(BRIDGE_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    console.error(`[Bridge] Failed to save config: ${e.message}`);
  }
}

let bridgeConfig = loadBridgeConfig();
console.log(`[Lamby Local] Bridge config: relay=${bridgeConfig.relayUrl || '(none)'} project=${bridgeConfig.projectName || '(none)'}`);

let createConnector;
try {
  const mod = require("../../server/bridge-connector.cjs");
  createConnector = mod.createConnector;
  console.log(`[Lamby Local] Loaded bridge-connector.cjs OK`);
} catch (e) {
  console.error(`[Lamby Local] FATAL: Failed to load bridge-connector.cjs: ${e.message}`);
  console.error(`[Lamby Local] Make sure you have the latest bridge-connector.cjs (raw TLS sockets, NOT ws library)`);
  console.error(e.stack);
  createConnector = null;
}

function gatherConsoleLogs(projectName) {
  const result = { previews: [] };
  if (projectName) {
    const entry = previewProcesses.get(projectName);
    if (entry && entry.logs) {
      result.previews.push({ name: projectName, port: entry.port, stdout: entry.logs.stdout, stderr: entry.logs.stderr });
    } else {
      result.previews.push({ name: projectName, error: "No preview running for this project" });
    }
  } else {
    for (const [name, entry] of previewProcesses) {
      result.previews.push({ name, port: entry.port, stdout: entry.logs ? entry.logs.stdout : "", stderr: entry.logs ? entry.logs.stderr : "" });
    }
    if (result.previews.length === 0) {
      result.message = "No preview processes running";
    }
  }
  return result;
}

let bridgeConnector = null;

function createBridgeConnector() {
  if (!createConnector) {
    console.error(`[Bridge] Cannot create connector — bridge-connector.cjs failed to load`);
    return null;
  }
  const relayUrl = bridgeConfig.relayUrl || CANONICAL_RELAY_URL;
  const projectName = bridgeConfig.projectName || "";
  console.log(`[Bridge] Creating connector: relay=${relayUrl} project=${projectName}`);

  bridgeConnector = createConnector({
    relayUrl,
    projectName,
    projectDir: PROJECTS_DIR,
    onMessage: async (msg, send) => {
      if (msg.type === "snapshot-request" && msg.requestId) {
        console.log(`[Bridge] Received snapshot-request for "${msg.projectName || ""}" (reqId: ${msg.requestId.slice(0, 8)})`);
        try {
          const snapshot = gatherProjectSnapshot(msg.projectName || "", PROJECTS_DIR);
          send({ type: "snapshot-response", requestId: msg.requestId, snapshot });
          console.log(`[Bridge] Sent snapshot-response (reqId: ${msg.requestId.slice(0, 8)}, len: ${typeof snapshot === 'string' ? snapshot.length : JSON.stringify(snapshot).length})`);
        } catch (err) {
          console.error(`[Bridge] snapshot error: ${err.message}`);
          send({ type: "snapshot-response", requestId: msg.requestId, snapshot: `Error gathering snapshot: ${err.message}` });
        }
        return true;
      }
      if (msg.type === "sandbox-execute-request" && msg.requestId) {
        console.log(`[Bridge] Received sandbox-execute-request (reqId: ${msg.requestId.slice(0, 8)}, actions: ${(msg.actions || []).length})`);
        try {
          const result = await executeSandboxActions(msg.actions || [], PROJECTS_DIR, { auditLog: sandboxAuditLog, previewProcesses });
          send({ type: "sandbox-execute-response", requestId: msg.requestId, result });
          console.log(`[Bridge] Sent sandbox-execute-response (reqId: ${msg.requestId.slice(0, 8)})`);
        } catch (err) {
          console.error(`[Bridge] sandbox-execute error: ${err.message}`);
          send({ type: "sandbox-execute-response", requestId: msg.requestId, result: { error: err.message } });
        }
        return true;
      }
      if (msg.type === "console-logs-request" && msg.requestId) {
        console.log(`[Bridge] Received console-logs-request for "${msg.projectName || ""}" (reqId: ${msg.requestId.slice(0, 8)})`);
        try {
          const logs = gatherConsoleLogs(msg.projectName || "");
          send({ type: "console-logs-response", requestId: msg.requestId, logs });
          console.log(`[Bridge] Sent console-logs-response (reqId: ${msg.requestId.slice(0, 8)})`);
        } catch (err) {
          console.error(`[Bridge] console-logs error: ${err.message}`);
          send({ type: "console-logs-response", requestId: msg.requestId, logs: { error: `Error gathering console logs: ${err.message}` } });
        }
        return true;
      }
      return false;
    },
  });

  bridgeConnector.onStatusChange = (status) => {
    console.log(`[Bridge] Status changed: ${status}`);
  };

  return bridgeConnector;
}

function connectToBridgeRelay() {
  if (bridgeConnector) {
    bridgeConnector.disconnect();
  }
  createBridgeConnector();
  if (bridgeConnector) {
    bridgeConnector.connect();
    console.log(`[Bridge] connect() called — waiting for relay handshake...`);
  }
}

const previewProcesses = new Map();
const previewStoppedManually = new Set();
const recentExitedPreviews = new Map();
setInterval(() => {
  const cutoff = Date.now() - 120000;
  for (const [k, v] of recentExitedPreviews) {
    if (v.exitedAt < cutoff) recentExitedPreviews.delete(k);
  }
}, 60000);
const sandboxAuditLog = [];

const projectPort = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return 5100 + (((hash % 100) + 100) % 100);
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function sendJson(res, obj, status) {
  res.writeHead(status || 200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}



function patchNextConfig(dir) {
  const candidates = ["next.config.ts", "next.config.mjs", "next.config.js"];
  let configPath = null;
  for (const c of candidates) {
    const p = path.join(dir, c);
    if (fs.existsSync(p)) { configPath = p; break; }
  }
  if (!configPath) return;

  try {
    let content = fs.readFileSync(configPath, "utf-8");
    let modified = false;

    if (!/allowedDevOrigins/.test(content)) {
      const origins = ["localhost", "127.0.0.1", "0.0.0.0"];
      const originsStr = JSON.stringify(origins);
      const snippet = `allowedDevOrigins: ${originsStr},`;
      content = content.replace(
        /const\s+nextConfig[\s:=\w<>{}]*=\s*\{/,
        (match) => match + "\n  " + snippet
      );
      if (!/allowedDevOrigins/.test(content)) {
        content = content.replace(
          /export\s+default\s*\{/,
          "export default {\n  " + snippet
        );
      }
      modified = true;
    }

    const parentRefPattern = /["']@[^"']+["']\s*:\s*["']\.\.\/[^"']+["']\s*,?\s*/g;
    if (parentRefPattern.test(content)) {
      content = content.replace(parentRefPattern, '');
      modified = true;
    }

    if (/root\s*:\s*path\.resolve\s*\([^)]*__dirname[^)]*"\.\."[^)]*\)/.test(content)) {
      content = content.replace(/,?\s*root\s*:\s*path\.resolve\s*\([^)]*__dirname[^)]*"\.\."[^)]*\)\s*,?/, '');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(configPath, content);
      console.log(`[Preview] Patched ${path.basename(configPath)} in ${dir}`);
    }
  } catch (e) {
    console.log(`[Preview] Failed to patch next config in ${dir}: ${e.message}`);
  }

  const lockfiles = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock"];
  const dirsToClean = [dir];
  const parentDir = path.dirname(dir);
  if (parentDir !== dir && parentDir.includes("projects")) dirsToClean.push(parentDir);
  for (const d of dirsToClean) {
    for (const lf of lockfiles) {
      const lfPath = path.join(d, lf);
      try { if (fs.existsSync(lfPath)) { fs.unlinkSync(lfPath); console.log(`[Preview] Removed ${lf} from ${d}`); } } catch {}
    }
  }
}

function stripPackageManagerField(dir) {
  const pkgJsonPath = path.join(dir, "package.json");
  try {
    const raw = fs.readFileSync(pkgJsonPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.packageManager) {
      delete parsed.packageManager;
      fs.writeFileSync(pkgJsonPath, JSON.stringify(parsed, null, 2) + "\n");
      console.log(`[Preview] Stripped packageManager field from ${pkgJsonPath}`);
    }
  } catch {}
}

function resolveLocalBin(devCmd, projectDir) {
  if (devCmd.cmd === "npx" && devCmd.args.length > 0) {
    const binName = devCmd.args[0];
    const ext = process.platform === "win32" ? ".cmd" : "";
    const localBin = path.join(projectDir, "node_modules", ".bin", binName + ext);
    if (fs.existsSync(localBin)) {
      return { cmd: localBin, args: devCmd.args.slice(1) };
    }
  }
  return devCmd;
}

const server = http.createServer(async (req, res) => {
  let rawUrl = req.url || "/";
  const ampIdx = rawUrl.indexOf("&");
  if (ampIdx > 0 && !rawUrl.includes("?")) {
    rawUrl = rawUrl.substring(0, ampIdx) + "?" + rawUrl.substring(ampIdx + 1);
  }
  const url = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (pathname === "/" || pathname === "/index.html") {
    _activePreviewPort = null;
  }

  if (pathname === "/api/snapshot-key") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const baseUrl = `${protocol}://${host}`;
    const requestedProject = url.searchParams.get("project") || "";
    sendJson(res, {
      project: requestedProject || null,
      baseUrl,
      exampleUrl: `${baseUrl}/api/snapshot/${requestedProject || "PROJECT_NAME"}`,
      commandEndpoint: `${baseUrl}/api/sandbox/execute`,
      commandProtocol: "POST JSON {actions: [{type, project, ...}]}. Action types: list_tree, read_file, read_multiple_files, write_file, create_file, delete_file, bulk_delete, move_file, copy_file, copy_folder, rename_file, grep, search_files, search_replace, apply_patch, bulk_write, run_command, install_deps, add_dependency, type_check, lint_and_fix, format_files, get_build_metrics, restart_dev_server, list_open_ports, git_status, git_add, git_commit, git_diff, git_log, git_branch, git_checkout, git_stash, git_init, git_push, git_pull, git_merge, detect_structure, start_process, kill_process, list_processes, build_project, run_tests, archive_project, export_project, set_env_var, get_env_vars, rollback_last_change, project_analyze, tailwind_audit, find_usages, component_tree, extract_theme, extract_colors, capture_preview, get_preview_url, generate_component, generate_page, refactor_file, validate_change, profile_performance, create_folder, delete_folder, move_folder, rename_folder, list_tree_filtered, dead_code_detection, dependency_graph, symbol_search, grep_advanced, extract_imports, run_command_advanced, build_with_flags, clean_build_cache, start_process_named, monitor_process, get_process_logs, stop_all_processes, switch_port, git_stash_pop, git_reset, git_revert, git_tag, visual_diff, capture_component, record_video, get_dom_snapshot, get_console_errors, generate_test, generate_storybook, optimize_code, convert_to_typescript, add_feature, migrate_framework, react_profiler, memory_leak_detection, console_error_analysis, runtime_error_trace, bundle_analyzer, network_monitor, accessibility_audit, security_scan, set_tailwind_config, set_next_config, update_package_json, manage_scripts, switch_package_manager, deploy_preview, export_project_zip, import_project, super_command",
    });
    return;
  }

  if (pathname.startsWith("/api/snapshot/")) {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const pathParts = pathname.replace("/api/snapshot/", "").split("/").filter(Boolean);
    const projectName = pathParts[0] || "";
    if (!projectName) {
      let projectList = [];
      if (fs.existsSync(PROJECTS_DIR)) {
        projectList = fs.readdirSync(PROJECTS_DIR).filter(n => {
          try { return fs.statSync(path.join(PROJECTS_DIR, n)).isDirectory(); } catch { return false; }
        });
      }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(`Lamby Snapshot API\n\nAvailable projects:\n${projectList.map(p => `- ${p}`).join("\n") || "(none)"}\n\nUsage: /api/snapshot/PROJECT_NAME`);
      return;
    }
    const snapshot = gatherProjectSnapshot(projectName, PROJECTS_DIR);
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(snapshot);
    return;
  }

  if (pathname === "/api/sandbox/execute") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const body = JSON.parse(await readBody(req));
      const actions = body.actions;
      if (!Array.isArray(actions) || actions.length === 0) {
        sendJson(res, { error: "actions array required" }, 400);
        return;
      }
      if (actions.length > 50) {
        sendJson(res, { error: "Max 50 actions per request" }, 400);
        return;
      }
      const result = await executeSandboxActions(actions, PROJECTS_DIR, { auditLog: sandboxAuditLog, previewProcesses });
      sendJson(res, result);
    } catch (err) {
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/sandbox/audit-log") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    sendJson(res, { entries: sandboxAuditLog.slice(-100) });
    return;
  }

  if (pathname === "/api/projects/list") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
      const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
      const projects = entries
        .filter(e => e.isDirectory())
        .map(e => {
          const projPath = path.join(PROJECTS_DIR, e.name);
          const pkgPath = path.join(projPath, "package.json");
          let description = "";
          let framework = "react";
          if (fs.existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
              description = pkg.description || "";
              framework = pkg._framework || "react";
            } catch {}
          }
          const stat = fs.statSync(projPath);
          let bridgeKey = "";
          const metaFilePath = path.join(projPath, ".lamby-meta.json");
          try {
            if (fs.existsSync(metaFilePath)) {
              const meta = JSON.parse(fs.readFileSync(metaFilePath, "utf-8"));
              bridgeKey = meta.bridgeKey || "";
            }
            if (!bridgeKey) {
              bridgeKey = require("crypto").randomBytes(16).toString("hex");
              const existingMeta = {};
              try { if (fs.existsSync(metaFilePath)) Object.assign(existingMeta, JSON.parse(fs.readFileSync(metaFilePath, "utf-8"))); } catch {}
              existingMeta.bridgeKey = bridgeKey;
              fs.writeFileSync(metaFilePath, JSON.stringify(existingMeta, null, 2));
            }
          } catch {}
          return { name: e.name, path: `projects/${e.name}`, createdAt: stat.birthtime.toISOString(), framework, description, bridgeKey };
        });
      sendJson(res, { success: true, projects });
    } catch (err) {
      sendJson(res, { success: false, error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/create") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const body = JSON.parse(await readBody(req));
      const { name, framework = "react", description = "" } = body;
      if (!name || typeof name !== "string") { sendJson(res, { success: false, error: "Missing project name" }, 400); return; }
      const check = validateProjectPath(name, null, PROJECTS_DIR);
      if (!check.valid) { sendJson(res, { success: false, error: check.error }, 403); return; }
      if (fs.existsSync(check.resolved)) { sendJson(res, { success: false, error: "Project already exists" }, 409); return; }
      fs.mkdirSync(check.resolved, { recursive: true });
      const pkgJson = JSON.stringify({ name, version: "0.0.1", private: true, description, _framework: framework }, null, 2);
      fs.writeFileSync(path.join(check.resolved, "package.json"), pkgJson, "utf-8");
      const projectBridgeKey = require("crypto").randomBytes(16).toString("hex");
      try { fs.writeFileSync(path.join(check.resolved, ".lamby-meta.json"), JSON.stringify({ bridgeKey: projectBridgeKey, createdAt: new Date().toISOString() }, null, 2)); } catch {}
      sendJson(res, { success: true, name, framework, description, path: `projects/${name}`, bridgeKey: projectBridgeKey });
    } catch (err) {
      sendJson(res, { success: false, error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/delete") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const { name } = JSON.parse(await readBody(req));
      if (!name) { sendJson(res, { success: false, error: "Missing project name" }, 400); return; }
      const check = validateProjectPath(name, null, PROJECTS_DIR);
      if (!check.valid) { sendJson(res, { success: false, error: check.error }, 403); return; }
      if (!fs.existsSync(check.resolved)) { sendJson(res, { success: false, error: "Project not found" }, 404); return; }
      const tmpDest = check.resolved + `.__deleting_${Date.now()}`;
      try { fs.renameSync(check.resolved, tmpDest); } catch { fs.rmSync(check.resolved, { recursive: true, force: true }); }
      sendJson(res, { success: true, name });
      if (fs.existsSync(tmpDest)) {
        fs.rm(tmpDest, { recursive: true, force: true }, () => {});
      }
    } catch (err) {
      sendJson(res, { success: false, error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/duplicate") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const { name, newName } = JSON.parse(await readBody(req));
      if (!name) { sendJson(res, { success: false, error: "Missing project name" }, 400); return; }
      const check = validateProjectPath(name, null, PROJECTS_DIR);
      if (!check.valid) { sendJson(res, { success: false, error: check.error }, 403); return; }
      if (!fs.existsSync(check.resolved)) { sendJson(res, { success: false, error: "Project not found" }, 404); return; }

      let destName = newName;
      if (!destName) {
        let suffix = 1;
        do { destName = `${name}-copy${suffix > 1 ? `-${suffix}` : ''}`; suffix++; }
        while (fs.existsSync(path.join(PROJECTS_DIR, destName)));
      }
      if (/[\/\\]|\.\./.test(destName) || destName === "." || destName.startsWith(".")) {
        sendJson(res, { success: false, error: "Invalid destination name" }, 400); return;
      }
      const destCheck = validateProjectPath(destName, null, PROJECTS_DIR);
      if (!destCheck.valid) { sendJson(res, { success: false, error: destCheck.error }, 403); return; }
      if (fs.existsSync(destCheck.resolved)) { sendJson(res, { success: false, error: `Project '${destName}' already exists` }, 409); return; }

      const SKIP_COPY = new Set(["node_modules", ".git", ".next", ".nuxt", "dist", ".cache", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache", "projects", ".local", "attached_assets"]);
      function copyFiltered(src, dest) {
        const stat = fs.lstatSync(src);
        if (stat.isDirectory()) {
          fs.mkdirSync(dest, { recursive: true });
          for (const entry of fs.readdirSync(src)) {
            if (SKIP_COPY.has(entry)) continue;
            copyFiltered(path.join(src, entry), path.join(dest, entry));
          }
        } else if (stat.isFile()) {
          fs.copyFileSync(src, dest);
        }
      }
      copyFiltered(check.resolved, destCheck.resolved);

      let copiedFiles = 0;
      function countCopiedFiles(dir) {
        try {
          for (const entry of fs.readdirSync(dir)) {
            const full = path.join(dir, entry);
            try {
              const s = fs.lstatSync(full);
              if (s.isFile()) copiedFiles++;
              else if (s.isDirectory()) countCopiedFiles(full);
            } catch {}
          }
        } catch {}
      }
      countCopiedFiles(destCheck.resolved);

      if (copiedFiles === 0) {
        try { fs.rmSync(destCheck.resolved, { recursive: true, force: true }); } catch {}
        sendJson(res, { success: false, error: "Duplicate produced no files — the source project may be empty or contain only excluded directories." }, 400);
        return;
      }

      const pkgPath = path.join(destCheck.resolved, "package.json");
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          pkg.name = destName;
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf-8");
        } catch {}
      }

      let installed = false;
      if (fs.existsSync(pkgPath)) {
        try {
          const lockFile = path.join(destCheck.resolved, "package-lock.json");
          if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
        } catch {}
        const dupPm = detectPmForDir(destCheck.resolved);
        const installCmds = buildInstallCascade(dupPm);
        for (const cmd of installCmds) {
          try {
            execSync(cmd, {
              cwd: destCheck.resolved,
              timeout: 120000,
              stdio: "pipe",
              shell: true,
              env: { ...process.env, HUSKY: "0", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" },
            });
            installed = true;
            break;
          } catch {}
        }
      }
      sendJson(res, { success: true, name: destName, originalName: name, installed });
    } catch (err) {
      sendJson(res, { success: false, error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/files") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const { name } = JSON.parse(await readBody(req));
      if (!name) { sendJson(res, { success: false, error: "Missing project name" }, 400); return; }
      const check = validateProjectPath(name, null, PROJECTS_DIR);
      if (!check.valid) { sendJson(res, { success: false, error: check.error }, 403); return; }
      if (!fs.existsSync(check.resolved)) { sendJson(res, { success: false, error: "Project not found" }, 404); return; }

      const SKIP_DIRS = new Set(["node_modules", ".cache", "dist", ".git", ".next", ".nuxt", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache"]);
      function walkDir(dir, base) {
        let names;
        try { names = fs.readdirSync(dir); } catch { return []; }
        const result = [];
        for (const name of names) {
          if (name === ".DS_Store") continue;
          const fullPath = path.join(dir, name);
          const relPath = base ? base + "/" + name : name;
          try {
            const stat = fs.lstatSync(fullPath);
            if (stat.isDirectory()) {
              if (SKIP_DIRS.has(name)) continue;
              const children = walkDir(fullPath, relPath);
              result.push({ name, path: relPath, type: "directory", children });
            } else if (stat.isFile()) {
              result.push({ name, path: relPath, type: "file" });
            }
          } catch {}
        }
        return result.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === "directory" ? -1 : 1;
        });
      }
      const tree = walkDir(check.resolved, "");
      sendJson(res, { success: true, name, files: tree });
    } catch (err) {
      sendJson(res, { success: false, error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/read-file") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const { name, filePath } = JSON.parse(await readBody(req));
      if (!name || !filePath) { sendJson(res, { success: false, error: "Missing name or filePath" }, 400); return; }
      const check = validateProjectPath(name, filePath, PROJECTS_DIR);
      if (!check.valid) { sendJson(res, { success: false, error: check.error }, 403); return; }
      const exists = fs.existsSync(check.resolved);
      const content = exists ? fs.readFileSync(check.resolved, "utf-8") : "";
      sendJson(res, { success: true, exists, content, filePath });
    } catch (err) {
      sendJson(res, { success: false, error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/write-file") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const { name, filePath, content } = JSON.parse(await readBody(req));
      if (!name || !filePath || typeof content !== "string") { sendJson(res, { success: false, error: "Missing name, filePath, or content" }, 400); return; }
      const check = validateProjectPath(name, filePath, PROJECTS_DIR);
      if (!check.valid) { sendJson(res, { success: false, error: check.error }, 403); return; }
      const dir = path.dirname(check.resolved);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let previousContent = "";
      if (fs.existsSync(check.resolved)) previousContent = fs.readFileSync(check.resolved, "utf-8");
      fs.writeFileSync(check.resolved, content, "utf-8");
      sendJson(res, { success: true, filePath, previousContent, bytesWritten: content.length });
    } catch (err) {
      sendJson(res, { success: false, error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/preview") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const { name } = JSON.parse(await readBody(req));
      if (!name || /[\/\\]|\.\./.test(name)) { sendJson(res, { error: "Invalid project name" }, 400); return; }
      const projectDir = path.resolve(PROJECTS_DIR, name);
      if (!fs.existsSync(projectDir)) { sendJson(res, { error: "Project not found" }, 404); return; }

      if (previewProcesses.has(name)) {
        const existing = previewProcesses.get(name);
        console.log(`[Preview] Killing existing preview for ${name} (port ${existing.port})`);
        try {
          if (process.platform === "win32") {
            try { execSync(`taskkill /pid ${existing.process.pid} /T /F`, { stdio: "pipe", windowsHide: true }); } catch {}
          } else {
            try { process.kill(-existing.process.pid, 9); } catch {}
          }
          try { existing.process.kill("SIGKILL"); } catch {}
        } catch {}
        previewProcesses.delete(name);
      }

      let port = projectPort(name);
      const usedPorts = new Set([...previewProcesses.values()].map(e => e.port));
      while (usedPorts.has(port)) port++;

      const net = require("net");
      const portInUse = await new Promise((resolve) => {
        const tester = net.createServer().once("error", (err) => {
          resolve(err.code === "EADDRINUSE");
        }).once("listening", () => {
          tester.close(() => resolve(false));
        }).listen(port);
      });

      if (portInUse) {
        console.log(`[Preview] Port ${port} still in use — killing`);
        try {
          if (process.platform !== "win32") {
            try { execSync(`fuser -k ${port}/tcp`, { stdio: "pipe", timeout: 5000 }); } catch {}
          }
        } catch {}
        await new Promise(r => setTimeout(r, 1000));
      }

      let hasPkg = fs.existsSync(path.join(projectDir, "package.json"));
      let pkg = {};
      let effectiveProjectDir = projectDir;
      const SUB_CANDIDATES = ["frontend", "client", "web", "app", "ui"];

      if (hasPkg) {
        try { pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8")); } catch {}
        const rootScripts = pkg.scripts || {};
        const rootDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        const hasRootWebIndicator = rootScripts.dev || rootScripts.start || rootScripts.serve ||
          ["react", "react-dom", "vue", "svelte", "next", "nuxt", "@angular/core", "vite", "preact", "solid-js", "astro"].some(fw => fw in rootDeps);
        if (!hasRootWebIndicator) {
          for (const sub of SUB_CANDIDATES) {
            const subPkgPath = path.join(projectDir, sub, "package.json");
            if (fs.existsSync(subPkgPath)) {
              try {
                const subPkg = JSON.parse(fs.readFileSync(subPkgPath, "utf-8"));
                const subDeps = { ...(subPkg.dependencies || {}), ...(subPkg.devDependencies || {}) };
                const subScripts = subPkg.scripts || {};
                const hasSubWebConfig = ["vite.config.ts", "vite.config.js", "next.config.js", "next.config.mjs", "next.config.ts"].some(f => fs.existsSync(path.join(projectDir, sub, f)));
                if (subScripts.dev || subScripts.start || hasSubWebConfig || ["react", "react-dom", "vue", "vite", "next", "nuxt"].some(fw => fw in subDeps)) {
                  pkg = subPkg;
                  effectiveProjectDir = path.join(projectDir, sub);
                  console.log(`[Preview] Root package.json has no web setup — using ${sub}/package.json for ${name}`);
                  break;
                }
              } catch {}
            }
          }
        }
      } else {
        for (const sub of SUB_CANDIDATES) {
          const subPkgPath = path.join(projectDir, sub, "package.json");
          if (fs.existsSync(subPkgPath)) {
            try {
              pkg = JSON.parse(fs.readFileSync(subPkgPath, "utf-8"));
              effectiveProjectDir = path.join(projectDir, sub);
              hasPkg = true;
              console.log(`[Preview] No root package.json — using ${sub}/package.json for ${name}`);
            } catch {}
            break;
          }
        }
      }

      const pm = detectPmForDir(effectiveProjectDir);
      stripPackageManagerField(effectiveProjectDir);

      const cleanEnv = (extra = {}) => {
        const e = { ...process.env, ...extra };
        delete e.ELECTRON_RUN_AS_NODE;
        return e;
      };

      const hasNodeModules = fs.existsSync(path.join(effectiveProjectDir, "node_modules"));
      if (hasPkg && !hasNodeModules) {
        console.log(`[Preview] Installing dependencies for ${name}...`);
        const installCmds = buildInstallCascade(pm);
        for (const cmd of installCmds) {
          try {
            execSync(cmd, {
              cwd: effectiveProjectDir,
              timeout: 120000,
              stdio: "pipe",
              shell: true,
              env: cleanEnv({ HUSKY: "0", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" }),
            });
            break;
          } catch (installErr) {
            console.log(`[Preview] Install cmd failed (${cmd}): ${installErr.message}`);
          }
        }
      }

      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const scripts = pkg.scripts || {};
      const isNext = !!deps.next;
      const isNuxt = !!deps.nuxt;

      if (isNext) patchNextConfig(effectiveProjectDir);

      let devCmd;
      let detectedCommand = "";
      if (scripts.dev) {
        const devScript = scripts.dev || "";
        const usesVite = devScript.includes("vite") || deps.vite || fs.existsSync(path.join(effectiveProjectDir, "vite.config.ts")) || fs.existsSync(path.join(effectiveProjectDir, "vite.config.js"));
        if (usesVite) {
          devCmd = { cmd: "npx", args: [pm === "npm" ? "npm" : pm, "run", "dev", "--", "--port", String(port), "--host", "0.0.0.0"] };
        } else if (isNext) {
          devCmd = { cmd: "npx", args: [pm === "npm" ? "npm" : pm, "run", "dev", "--", "--port", String(port)] };
        } else if (isNuxt) {
          devCmd = { cmd: "npx", args: [pm === "npm" ? "npm" : pm, "run", "dev", "--", "--port", String(port)] };
        } else {
          devCmd = { cmd: "npx", args: [pm === "npm" ? "npm" : pm, "run", "dev"] };
        }
        detectedCommand = `${pm} run dev`;
      } else if (deps.vite || fs.existsSync(path.join(effectiveProjectDir, "vite.config.ts")) || fs.existsSync(path.join(effectiveProjectDir, "vite.config.js"))) {
        devCmd = { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", String(port)] };
        detectedCommand = "vite";
      } else if (isNext) {
        devCmd = { cmd: "npx", args: ["next", "dev", "--port", String(port)] };
        detectedCommand = "next dev";
      } else if (isNuxt) {
        devCmd = { cmd: "npx", args: ["nuxi", "dev", "--port", String(port)] };
        detectedCommand = "nuxi dev";
      } else if (scripts.start) {
        devCmd = { cmd: "npx", args: [pm === "npm" ? "npm" : pm, "run", "start"] };
        detectedCommand = `${pm} run start`;
      } else {
        devCmd = { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", String(port)] };
        detectedCommand = "vite (fallback)";
      }

      devCmd = resolveLocalBin(devCmd, effectiveProjectDir);

      const env = cleanEnv({
        PORT: String(port),
        VITE_PORT: String(port),
        HOST: "0.0.0.0",
        BROWSER: "none",
        FORCE_COLOR: "1",
        VITE_CJS_IGNORE_WARNING: "true",
      });

      console.log(`[Preview] Starting ${name} on port ${port}: ${devCmd.cmd} ${devCmd.args.join(" ")}`);
      const proc = spawn(devCmd.cmd, devCmd.args, {
        cwd: effectiveProjectDir,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        detached: true,
        shell: process.platform === "win32",
      });

      const logBuf = { stdout: "", stderr: "" };
      const entry = { process: proc, port, logs: logBuf };
      let portDetected = false;
      let procExited = false;
      let procExitCode = null;

      const portPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log(`[Preview] ${name} port detection timed out after 15s — using calculated port ${port}`);
          resolve(port);
        }, 15000);

        proc.stdout?.on("data", (d) => {
          const chunk = d.toString();
          logBuf.stdout += chunk;
          if (logBuf.stdout.length > 20000) logBuf.stdout = logBuf.stdout.slice(-10000);
          const portMatch = chunk.match(/(?:Local|localhost|127\.0\.0\.1|0\.0\.0\.0):\s*https?:\/\/[^:]+:(\d+)/i) ||
                            chunk.match(/listening\s+(?:on\s+)?(?:port\s+)?(\d{4,5})/i) ||
                            chunk.match(/https?:\/\/localhost:(\d+)/);
          if (portMatch && !portDetected) {
            portDetected = true;
            const actualPort = parseInt(portMatch[1], 10);
            if (actualPort !== entry.port) {
              console.log(`[Preview] ${name} actual port: ${actualPort} (calculated was ${entry.port})`);
              entry.port = actualPort;
            }
            clearTimeout(timeout);
            resolve(actualPort);
          }
        });
        proc.stderr?.on("data", (d) => {
          const chunk = d.toString();
          logBuf.stderr += chunk;
          if (logBuf.stderr.length > 20000) logBuf.stderr = logBuf.stderr.slice(-10000);
          if (!portDetected) {
            const portMatch = chunk.match(/(?:Local|localhost|127\.0\.0\.1|0\.0\.0\.0):\s*https?:\/\/[^:]+:(\d+)/i) ||
                              chunk.match(/listening\s+(?:on\s+)?(?:port\s+)?(\d{4,5})/i) ||
                              chunk.match(/https?:\/\/localhost:(\d+)/);
            if (portMatch) {
              portDetected = true;
              const actualPort = parseInt(portMatch[1], 10);
              if (actualPort !== entry.port) {
                console.log(`[Preview] ${name} actual port (stderr): ${actualPort} (calculated was ${entry.port})`);
                entry.port = actualPort;
              }
              clearTimeout(timeout);
              resolve(actualPort);
            }
          }
        });

        proc.on("exit", (code) => {
          procExited = true;
          procExitCode = code;
          console.log(`[Preview] ${name} exited with code ${code}`);
          recentExitedPreviews.set(name, { exitCode: code, stdout: logBuf.stdout.slice(-2000), stderr: logBuf.stderr.slice(-2000), exitedAt: Date.now() });
          previewProcesses.delete(name);
          if (!previewStoppedManually.has(name) && code !== 0) {
            console.log(`[Preview] ${name} crashed. stderr: ${logBuf.stderr.slice(-500)}`);
          }
          previewStoppedManually.delete(name);
          if (!portDetected) {
            clearTimeout(timeout);
            resolve(null);
          }
        });
      });

      previewProcesses.set(name, entry);

      const resolvedPort = await portPromise;

      if (procExited && !portDetected) {
        const errSnippet = (logBuf.stderr || logBuf.stdout || "No output captured").slice(-1000);
        sendJson(res, {
          success: false,
          started: false,
          name,
          error: `Dev server exited with code ${procExitCode} before becoming ready`,
          output: errSnippet,
          detectedCommand,
        });
      } else {
        const finalPort = resolvedPort || port;
        entry.port = finalPort;
        const resp = { success: true, name, port: finalPort, url: `http://localhost:${finalPort}`, detectedCommand, packageManager: pm };
        if (!portDetected && logBuf.stderr) resp.stderr = logBuf.stderr.slice(-1000);
        if (!portDetected && logBuf.stdout) resp.stdout = logBuf.stdout.slice(-1000);
        sendJson(res, resp);
      }
    } catch (err) {
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/preview-info") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const { name } = JSON.parse(await readBody(req));
      const entry = previewProcesses.get(name);
      if (entry) {
        sendJson(res, {
          running: true,
          port: entry.port,
          url: `http://localhost:${entry.port}`,
          stdout: (entry.logs.stdout || "").slice(-2000),
          stderr: (entry.logs.stderr || "").slice(-2000),
        });
      } else {
        const recent = recentExitedPreviews.get(name);
        if (recent && (Date.now() - recent.exitedAt) < 120000) {
          sendJson(res, {
            running: false,
            crashed: true,
            exitCode: recent.exitCode,
            stdout: recent.stdout,
            stderr: recent.stderr,
          });
        } else {
          sendJson(res, { running: false });
        }
      }
    } catch (err) {
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/stop-preview") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const { name } = JSON.parse(await readBody(req));
      previewStoppedManually.add(name);
      const entry = previewProcesses.get(name);
      if (entry) {
        const pid = entry.process.pid;
        if (process.platform === "win32") {
          try { execSync(`taskkill /pid ${pid} /T /F`, { stdio: "pipe", windowsHide: true }); } catch {}
        } else {
          try { process.kill(-pid, 9); } catch {}
        }
        try { entry.process.kill("SIGKILL"); } catch {}
        previewProcesses.delete(name);
      }
      sendJson(res, { stopped: true });
    } catch (err) {
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/bridge-status") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const status = bridgeConnector ? bridgeConnector.getStatus() : { status: "disconnected" };
    const currentRelay = status.relayUrl || bridgeConfig.relayUrl || "";
    const DEV_RELAY = "wss://35c4f698-dc00-400a-9452-39eaf17279c0-00-31k27xn7snnel.janeway.replit.dev";
    const PROD_RELAY = "wss://bridge-relay.replit.app";
    sendJson(res, {
      status: status.status,
      relayUrl: currentRelay,
      devRelayUrl: DEV_RELAY,
      prodRelayUrl: PROD_RELAY,
      connectedClients: status.status === "connected" ? 1 : 0,
    });
    return;
  }

  if (pathname === "/api/console-logs") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const projectName = url.searchParams.get("project") || "";
    sendJson(res, gatherConsoleLogs(projectName));
    return;
  }

  if (pathname === "/api/bridge-config-save") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const body = JSON.parse(await readBody(req));
      bridgeConfig = { relayUrl: body.relayUrl || "", projectName: body.projectName || bridgeConfig.projectName || "" };
      saveBridgeConfig(bridgeConfig);
      connectToBridgeRelay();
      sendJson(res, { success: true });
    } catch (err) {
      sendJson(res, { success: false, error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/bridge-reconnect") {
    if (req.method !== "POST" && req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    if (bridgeConnector) {
      bridgeConnector.reconnect(bridgeConfig.relayUrl || CANONICAL_RELAY_URL);
    } else {
      connectToBridgeRelay();
    }
    sendJson(res, { success: true, status: "reconnecting" });
    return;
  }

  if (pathname === "/api/projects/restart-preview") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const { name } = JSON.parse(await readBody(req));
      if (!name) { sendJson(res, { error: "Missing project name" }, 400); return; }
      const entry = previewProcesses.get(name);
      if (entry) {
        const pid = entry.process.pid;
        if (process.platform === "win32") {
          try { execSync(`taskkill /pid ${pid} /T /F`, { stdio: "pipe", windowsHide: true }); } catch {}
        } else {
          try { process.kill(-pid, 9); } catch {}
        }
        try { entry.process.kill("SIGKILL"); } catch {}
        previewProcesses.delete(name);
      }
      await new Promise(r => setTimeout(r, 1000));
      const fakeReq = { method: "POST", url: "/api/projects/preview", headers: req.headers };
      const bodyStr = JSON.stringify({ name });
      fakeReq[Symbol.asyncIterator] = async function* () { yield Buffer.from(bodyStr); };
      req.url = "/api/projects/preview";
      req.method = "POST";
      req._bodyOverride = bodyStr;
      const projectDir = path.resolve(PROJECTS_DIR, name);
      if (!fs.existsSync(projectDir)) { sendJson(res, { error: "Project not found" }, 404); return; }
      sendJson(res, { restarting: true, name });
    } catch (err) {
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/install-deps") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const body = JSON.parse(await readBody(req));
      const name = body.name || body.project;
      if (!name) { sendJson(res, { error: "Missing project name" }, 400); return; }
      const projectDir = path.resolve(PROJECTS_DIR, name);
      if (!fs.existsSync(projectDir)) { sendJson(res, { error: "Project not found" }, 404); return; }
      const pm = detectPmForDir(projectDir);
      const cmds = buildInstallCascade(pm);
      let installed = false;
      let output = "";
      for (const cmd of cmds) {
        try {
          output = execSync(cmd, { cwd: projectDir, timeout: 120000, stdio: "pipe", shell: true, env: { ...process.env, HUSKY: "0" } }).toString();
          installed = true;
          break;
        } catch (e) { output = e.stderr ? e.stderr.toString() : e.message; }
      }
      sendJson(res, { success: installed, output: output.slice(0, 2000), pm });
    } catch (err) {
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/run-command") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const body = JSON.parse(await readBody(req));
      const name = body.name || body.project;
      const command = body.command;
      if (!name || !command) { sendJson(res, { error: "Missing name or command" }, 400); return; }
      const projectDir = path.resolve(PROJECTS_DIR, name);
      if (!fs.existsSync(projectDir)) { sendJson(res, { error: "Project not found" }, 404); return; }
      const result = execSync(command, { cwd: projectDir, timeout: 60000, stdio: "pipe", shell: true }).toString();
      sendJson(res, { success: true, output: result.slice(0, 5000) });
    } catch (err) {
      sendJson(res, { success: false, error: err.message, output: err.stderr ? err.stderr.toString().slice(0, 5000) : "" }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/import-github") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const body = JSON.parse(await readBody(req));
      const { url: repoUrl, projectName } = body;
      if (!repoUrl) { sendJson(res, { error: "Missing repo URL" }, 400); return; }
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\s#?]+)/);
      if (!match) { sendJson(res, { error: "Invalid GitHub URL" }, 400); return; }
      const name = projectName || match[2].replace(/\.git$/, "");
      const targetDir = path.resolve(PROJECTS_DIR, name);
      if (fs.existsSync(targetDir)) {
        execSync(`git pull`, { cwd: targetDir, timeout: 60000, stdio: "pipe" });
        sendJson(res, { success: true, projectName: name, action: "pulled" });
      } else {
        execSync(`git clone --depth 1 ${repoUrl} "${targetDir}"`, { timeout: 120000, stdio: "pipe" });
        sendJson(res, { success: true, projectName: name, action: "cloned" });
      }
    } catch (err) {
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/projects/files-main") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    sendJson(res, { success: true, files: [] });
    return;
  }

  if (pathname === "/api/read-file") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const { filePath } = JSON.parse(await readBody(req));
      if (!filePath) { sendJson(res, { success: false, error: "Missing filePath" }, 400); return; }
      const resolved = path.resolve(PROJECTS_DIR, filePath);
      const exists = fs.existsSync(resolved);
      const content = exists ? fs.readFileSync(resolved, "utf-8") : "";
      sendJson(res, { success: true, exists, content });
    } catch (err) {
      sendJson(res, { success: false, error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/write-file") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const { filePath, content } = JSON.parse(await readBody(req));
      if (!filePath || typeof content !== "string") { sendJson(res, { success: false, error: "Missing filePath or content" }, 400); return; }
      const resolved = path.resolve(PROJECTS_DIR, filePath);
      const dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let previousContent = "";
      if (fs.existsSync(resolved)) previousContent = fs.readFileSync(resolved, "utf-8");
      fs.writeFileSync(resolved, content, "utf-8");
      sendJson(res, { success: true, filePath, previousContent, bytesWritten: content.length });
    } catch (err) {
      sendJson(res, { success: false, error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/bridge-relay-status") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const status = bridgeConnector ? bridgeConnector.getStatus() : { status: "disconnected" };
    sendJson(res, { status: status.status, relayUrl: status.relayUrl || bridgeConfig.relayUrl || "" });
    return;
  }

  if (pathname === "/api/errors/report") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const body = JSON.parse(await readBody(req));
      console.log(`[ErrorReport] ${body.type || "unknown"}: ${(body.message || "").slice(0, 200)}`);
      sendJson(res, { received: true });
    } catch (err) {
      sendJson(res, { received: false }, 500);
    }
    return;
  }

  if (pathname === "/api/validate-file" || pathname === "/api/grok-fix" || pathname === "/api/grok-browse" || pathname === "/api/programs/install" || pathname === "/api/grok-responses" || pathname === "/api/download-source") {
    sendJson(res, { error: "Not available in desktop mode", desktop: true }, 501);
    return;
  }

  if (pathname === "/health" || pathname === "/healthz") {
    const connected = bridgeConnector ? bridgeConnector.isConnected() : false;
    sendJson(res, { status: "ok", uptime: process.uptime(), bridge: connected ? "connected" : "disconnected" });
    return;
  }

  const previewMatch = pathname.match(/^\/__preview\/(\d+)(\/.*)?$/);
  if (previewMatch) {
    const previewPort = parseInt(previewMatch[1], 10);
    if (previewPort < 5100 || previewPort > 65535) {
      res.writeHead(400);
      res.end("Port out of preview range (5100-65535)");
      return;
    }
    const targetPath = previewMatch[2] || "/";
    _activePreviewPort = previewPort;
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: previewPort,
        path: targetPath + (url.search || ""),
        method: req.method,
        headers: { ...req.headers, host: `localhost:${previewPort}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
    );
    proxyReq.on("error", () => {
      if (!res.headersSent) { res.writeHead(502); res.end("Preview server not responding"); }
    });
    req.pipe(proxyReq, { end: true });
    return;
  }

  const DIST_DIR = path.join(__dirname, "..", "dist");
  if (fs.existsSync(DIST_DIR)) {
    let filePath = path.join(DIST_DIR, pathname === "/" ? "index.html" : pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const MIME = {
        ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
        ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml",
        ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
        ".ttf": "font/ttf", ".eot": "application/vnd.ms-fontobject",
        ".map": "application/json", ".webp": "image/webp", ".avif": "image/avif",
      };
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  const PREVIEW_ASSET_PREFIXES = ["/_next/", "/__nextjs", "/__vite", "/@vite/", "/@react-refresh", "/@id/", "/@fs/", "/node_modules/", "/src/", "/favicon.ico", "/opengraph-image", "/apple-touch-icon", "/manifest.json", "/workbox-", "/static/", "/sockjs-node/", "/build/", "/_assets/", "/assets/", "/public/", "/polyfills", "/.vite/", "/hmr", "/__webpack_hmr", "/@tailwindcss/"];
  if (_activePreviewPort && PREVIEW_ASSET_PREFIXES.some(p => pathname.startsWith(p))) {
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: _activePreviewPort,
        path: rawUrl,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${_activePreviewPort}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
    );
    proxyReq.on("error", () => {
      if (!res.headersSent) { res.writeHead(502); res.end("Preview asset server not responding"); }
    });
    req.pipe(proxyReq, { end: true });
    return;
  }

  if (fs.existsSync(DIST_DIR)) {
    const fallbackPath = path.join(DIST_DIR, "index.html");
    if (fs.existsSync(fallbackPath)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      fs.createReadStream(fallbackPath).pipe(res);
      return;
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

let WebSocketServer;
try { WebSocketServer = require("ws").WebSocketServer; } catch {}

if (WebSocketServer) {
  const sandboxWss = new WebSocketServer({ noServer: true });

  sandboxWss.on("connection", (ws) => {
    console.log("[Sandbox WS] Client connected");
    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "execute") {
          const actions = msg.actions;
          if (!Array.isArray(actions) || actions.length === 0) {
            ws.send(JSON.stringify({ type: "result", requestId: msg.requestId, error: "actions array required" }));
            return;
          }
          if (actions.length > 50) {
            ws.send(JSON.stringify({ type: "result", requestId: msg.requestId, error: "Max 50 actions per request" }));
            return;
          }
          const onActionResult = msg.stream ? (i, result) => {
            try { ws.send(JSON.stringify({ type: "action-result", requestId: msg.requestId, actionIndex: i, actionType: result.type, status: result.status, data: result.data, error: result.error })); } catch {}
          } : undefined;
          const result = await executeSandboxActions(actions, PROJECTS_DIR, { auditLog: sandboxAuditLog, onActionResult, previewProcesses });
          ws.send(JSON.stringify({ type: "result", requestId: msg.requestId, ...result }));
        } else if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (err) {
        try { ws.send(JSON.stringify({ type: "error", error: err.message })); } catch {}
      }
    });
    ws.on("close", () => { console.log("[Sandbox WS] Client disconnected"); });
    ws.on("error", () => {});
  });

  server.on("upgrade", (req, socket, head) => {
    if (req.url && req.url.startsWith("/ws/sandbox")) {
      const reqUrl = new URL(req.url, "http://localhost");
      sandboxWss.handleUpgrade(req, socket, head, (ws) => {
        sandboxWss.emit("connection", ws);
      });
      return;
    }

    const previewWsMatch = req.url && req.url.match(/^\/__preview\/(\d+)(\/.*)?$/);
    if (previewWsMatch) {
      const previewPort = parseInt(previewWsMatch[1], 10);
      if (previewPort < 5100 || previewPort > 65535) { socket.destroy(); return; }
      const targetPath = previewWsMatch[2] || "/";
      const proxySocket = net.connect(previewPort, "127.0.0.1", () => {
        const reqLine = `${req.method || "GET"} ${targetPath} HTTP/1.1\r\n`;
        const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n");
        proxySocket.write(reqLine + headers + "\r\n\r\n");
        if (head && head.length) proxySocket.write(head);
        socket.pipe(proxySocket);
        proxySocket.pipe(socket);
      });
      proxySocket.on("error", () => { try { socket.destroy(); } catch {} });
      socket.on("error", () => { try { proxySocket.destroy(); } catch {} });
      return;
    }

    socket.destroy();
  });
}

process.on("uncaughtException", (err) => {
  console.error(`[Lamby Local] Uncaught exception: ${err.message}`);
  if (err.stack) console.error(err.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error(`[Lamby Local] Unhandled rejection: ${reason}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`[Lamby Local] Port ${PORT} already in use (Electron main.js likely started it)`);
    console.log(`[Lamby Local] Starting bridge connector only (no HTTP server)...`);
    setTimeout(() => connectToBridgeRelay(), 1000);
  } else {
    console.error(`[Lamby Local] Server error: ${err.message}`);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Lamby Local] Server running on port ${PORT}`);
  console.log(`[Lamby Local] No authentication — relay URL is the secret`);
  console.log(`[Lamby Local] Projects dir: ${PROJECTS_DIR}`);
  console.log(`[Lamby Local] Sandbox API: http://localhost:${PORT}/api/sandbox/execute`);
  console.log(`[Lamby Local] Bridge relay: ${bridgeConfig.relayUrl || "(none)"}`);
  setTimeout(() => connectToBridgeRelay(), 1000);
});
