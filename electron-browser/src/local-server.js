const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, execSync } = require("child_process");
const os = require("os");

const {
  executeSandboxActions,
  gatherProjectSnapshot,
  validateProjectPath,
  detectPmForDir,
  buildPmCommand,
  buildInstallCascade,
} = require("../../server/sandbox-dispatcher.cjs");

const tls = require("tls");
const net = require("net");

const USER_DATA_DIR = path.join(os.homedir(), ".guardian-ai");
const PROJECTS_DIR = path.join(USER_DATA_DIR, "projects");
const BRIDGE_CONFIG_PATH = path.join(USER_DATA_DIR, "bridge-config.json");
const PORT = parseInt(process.env.LAMBY_PORT || "4999", 10);

if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

const snapshotKey = crypto.randomBytes(16).toString("hex");
const CANONICAL_RELAY_URL = "https://bridge-relay.replit.app";

function loadBridgeConfig() {
  try {
    if (fs.existsSync(BRIDGE_CONFIG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(BRIDGE_CONFIG_PATH, "utf-8"));
      let changed = false;
      if (!cfg.relayUrl) { cfg.relayUrl = CANONICAL_RELAY_URL; changed = true; }
      if (!cfg.bridgeKey || cfg.bridgeKey.length < 8) { cfg.bridgeKey = crypto.randomBytes(16).toString("hex"); changed = true; }
      if (changed) { try { fs.writeFileSync(BRIDGE_CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8"); } catch {} }
      return cfg;
    }
  } catch {}
  const cfg = { relayUrl: CANONICAL_RELAY_URL, bridgeKey: crypto.randomBytes(16).toString("hex") };
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
let bridgeSocket = null;
let bridgeConnected = false;
let bridgeReconnectTimer = null;
let bridgeReconnectDelay = 2000;
let bridgePingTimer = null;
let bridgeBuffer = Buffer.alloc(0);
let bridgeFailCount = 0;
let bridgeTriedFallback = false;
let bridgeLastConnectedAt = 0;
const BRIDGE_GRACE_PERIOD_MS = 30000;

function wsClientEncodeFrame(data) {
  const payload = Buffer.from(data, "utf-8");
  const len = payload.length;
  const mask = crypto.randomBytes(4);
  let header;
  if (len < 126) {
    header = Buffer.alloc(6);
    header[0] = 0x81;
    header[1] = 0x80 | len;
    mask.copy(header, 2);
  } else if (len < 65536) {
    header = Buffer.alloc(8);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
    mask.copy(header, 4);
  } else {
    header = Buffer.alloc(14);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
    mask.copy(header, 10);
  }
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
  return Buffer.concat([header, masked]);
}

function wsClientDecodeFrame(buf) {
  if (buf.length < 2) return { data: null, bytesConsumed: 0 };
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;
  if (payloadLen === 126) {
    if (buf.length < 4) return { data: null, bytesConsumed: 0 };
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return { data: null, bytesConsumed: 0 };
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  if (masked) {
    if (buf.length < offset + 4 + payloadLen) return { data: null, bytesConsumed: 0 };
    const maskKey = buf.slice(offset, offset + 4);
    offset += 4;
    const payload = Buffer.alloc(payloadLen);
    for (let i = 0; i < payloadLen; i++) payload[i] = buf[offset + i] ^ maskKey[i % 4];
    return { data: payload.toString("utf-8"), opcode, bytesConsumed: offset + payloadLen };
  }
  if (buf.length < offset + payloadLen) return { data: null, bytesConsumed: 0 };
  return { data: buf.slice(offset, offset + payloadLen).toString("utf-8"), opcode, bytesConsumed: offset + payloadLen };
}

function bridgeSend(data) {
  if (!bridgeSocket || !bridgeConnected) return;
  try { bridgeSocket.write(wsClientEncodeFrame(data)); } catch (err) {
    console.error(`[Bridge] Send failed: ${err.message}`);
  }
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

async function handleBridgeMessage(msg) {
  try {
    const parsed = JSON.parse(msg);
    if (parsed.type === "snapshot-request" && parsed.requestId) {
      console.log(`[Bridge] Received snapshot-request for "${parsed.projectName || ""}" (reqId: ${parsed.requestId.slice(0, 8)})`);
      const snapshot = gatherProjectSnapshot(parsed.projectName || "", PROJECTS_DIR);
      bridgeSend(JSON.stringify({ type: "snapshot-response", requestId: parsed.requestId, snapshot }));
      console.log(`[Bridge] Sent snapshot-response (reqId: ${parsed.requestId.slice(0, 8)}, len: ${typeof snapshot === 'string' ? snapshot.length : JSON.stringify(snapshot).length})`);
    } else if (parsed.type === "sandbox-execute-request" && parsed.requestId) {
      console.log(`[Bridge] Received sandbox-execute-request (reqId: ${parsed.requestId.slice(0, 8)}, actions: ${(parsed.actions || []).length})`);
      try {
        const result = await executeSandboxActions(parsed.actions || [], PROJECTS_DIR, { auditLog: sandboxAuditLog });
        bridgeSend(JSON.stringify({ type: "sandbox-execute-response", requestId: parsed.requestId, result }));
        console.log(`[Bridge] Sent sandbox-execute-response (reqId: ${parsed.requestId.slice(0, 8)})`);
      } catch (err) {
        console.error(`[Bridge] sandbox-execute error: ${err.message}`);
        bridgeSend(JSON.stringify({ type: "sandbox-execute-response", requestId: parsed.requestId, result: { error: err.message } }));
      }
    } else if (parsed.type === "console-logs-request" && parsed.requestId) {
      console.log(`[Bridge] Received console-logs-request for "${parsed.projectName || ""}" (reqId: ${parsed.requestId.slice(0, 8)})`);
      const logs = gatherConsoleLogs(parsed.projectName || "");
      bridgeSend(JSON.stringify({ type: "console-logs-response", requestId: parsed.requestId, logs }));
      console.log(`[Bridge] Sent console-logs-response (reqId: ${parsed.requestId.slice(0, 8)})`);
    } else if (parsed.type === "ping") {
      bridgeSend(JSON.stringify({ type: "pong" }));
    } else if (parsed.type === "pong") {
    }
  } catch (err) {
    console.error(`[Bridge] handleBridgeMessage error: ${err.message}`);
  }
}

function connectToBridgeRelay() {
  if (bridgeSocket) {
    try { bridgeSocket.destroy(); } catch {}
    bridgeSocket = null;
  }
  bridgeConnected = false;
  if (bridgePingTimer) { clearInterval(bridgePingTimer); bridgePingTimer = null; }

  let relayUrl = bridgeConfig.relayUrl || CANONICAL_RELAY_URL;
  if (bridgeFailCount >= 3 && !bridgeTriedFallback && relayUrl !== CANONICAL_RELAY_URL) {
    console.log(`[Bridge] Stored relay URL failed ${bridgeFailCount} times — falling back to ${CANONICAL_RELAY_URL}`);
    relayUrl = CANONICAL_RELAY_URL;
    bridgeTriedFallback = true;
    bridgeConfig.relayUrl = CANONICAL_RELAY_URL;
    saveBridgeConfig(bridgeConfig);
  }
  if (!relayUrl) { console.log("[Bridge] No relay URL configured — skipping auto-connect"); return; }

  let parsed;
  try { parsed = new URL(relayUrl); } catch { console.error("[Bridge] Invalid relay URL:", relayUrl); return; }

  const host = parsed.hostname;
  const port = parsed.port ? parseInt(parsed.port) : (parsed.protocol === "https:" ? 443 : 80);
  const useTls = parsed.protocol === "https:";
  let bridgeKey = bridgeConfig.bridgeKey;
  if (!bridgeKey || bridgeKey.length < 8) {
    bridgeKey = crypto.randomBytes(16).toString("hex");
    bridgeConfig.bridgeKey = bridgeKey;
    saveBridgeConfig(bridgeConfig);
  }
  const wsPath = `/bridge-ws?key=${encodeURIComponent(bridgeKey)}&snapshotKey=${encodeURIComponent(snapshotKey)}`;
  const wsKeyRaw = crypto.randomBytes(16).toString("base64");

  console.log(`[Bridge] Connecting to ${host}:${port}${wsPath.split("?")[0]}...`);

  const connectOpts = { host, port, servername: host };
  const socket = useTls ? tls.connect(connectOpts) : net.connect(connectOpts);

  socket.on("connect", () => {
    socket.write(
      `GET ${wsPath} HTTP/1.1\r\n` +
      `Host: ${host}\r\n` +
      `Upgrade: websocket\r\n` +
      `Connection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${wsKeyRaw}\r\n` +
      `Sec-WebSocket-Version: 13\r\n` +
      `\r\n`
    );
  });

  if (useTls) {
    socket.on("secureConnect", () => {});
  }

  let handshakeDone = false;
  let httpBuffer = "";
  bridgeBuffer = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    if (!handshakeDone) {
      httpBuffer += chunk.toString("utf-8");
      const headerEnd = httpBuffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const statusLine = httpBuffer.split("\r\n")[0];
      if (!statusLine.includes("101")) {
        console.error(`[Bridge] Handshake failed: ${statusLine}`);
        bridgeFailCount++;
        socket.destroy();
        scheduleBridgeReconnect();
        return;
      }
      handshakeDone = true;
      bridgeSocket = socket;
      bridgeConnected = true;
      bridgeLastConnectedAt = Date.now();
      bridgeReconnectDelay = 2000;
      bridgeFailCount = 0;
      bridgeTriedFallback = false;
      console.log(`[Bridge] Connected to relay at ${host}`);
      bridgeSend(JSON.stringify({ type: "ping" }));
      bridgePingTimer = setInterval(() => {
        bridgeSend(JSON.stringify({ type: "ping" }));
      }, 15000);
      const headerBytes = Buffer.byteLength(httpBuffer.slice(0, headerEnd + 4), "utf-8");
      const remaining = chunk.slice(headerBytes);
      if (remaining.length > 0) {
        bridgeBuffer = Buffer.concat([bridgeBuffer, remaining]);
        processBridgeBuffer();
      }
      return;
    }
    bridgeBuffer = Buffer.concat([bridgeBuffer, chunk]);
    processBridgeBuffer();
  });

  socket.on("close", (hadError) => {
    const uptime = bridgeLastConnectedAt ? Math.round((Date.now() - bridgeLastConnectedAt) / 1000) : 0;
    if (bridgeConnected) console.log(`[Bridge] Disconnected from relay (hadError: ${hadError}, uptime: ${uptime}s)`);
    bridgeConnected = false;
    bridgeSocket = null;
    if (bridgePingTimer) { clearInterval(bridgePingTimer); bridgePingTimer = null; }
    scheduleBridgeReconnect();
  });

  socket.on("error", (err) => {
    console.error(`[Bridge] Connection error: ${err.code || err.message}`);
    bridgeConnected = false;
    bridgeSocket = null;
    if (bridgePingTimer) { clearInterval(bridgePingTimer); bridgePingTimer = null; }
    scheduleBridgeReconnect();
  });
}

function processBridgeBuffer() {
  while (bridgeBuffer.length > 0) {
    const { data, opcode, bytesConsumed } = wsClientDecodeFrame(bridgeBuffer);
    if (data === null) break;
    bridgeBuffer = bridgeBuffer.slice(bytesConsumed);
    if (opcode === 0x8) { if (bridgeSocket) bridgeSocket.destroy(); return; }
    if (opcode === 0x9) {
      const pong = Buffer.alloc(2); pong[0] = 0x8a; pong[1] = 0;
      if (bridgeSocket) bridgeSocket.write(pong);
      continue;
    }
    handleBridgeMessage(data);
  }
}

function scheduleBridgeReconnect() {
  if (bridgeReconnectTimer) return;
  const delay = Math.min(bridgeReconnectDelay, 60000);
  console.log(`[Bridge] Reconnecting in ${delay / 1000}s...`);
  bridgeReconnectTimer = setTimeout(() => {
    bridgeReconnectTimer = null;
    bridgeReconnectDelay = Math.min(bridgeReconnectDelay * 1.5, 60000);
    connectToBridgeRelay();
  }, delay);
}

const previewProcesses = new Map();
const previewStoppedManually = new Set();
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

function getKey(req, url) {
  return url.searchParams.get("key") || (req.headers.authorization || "").replace("Bearer ", "");
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
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (pathname === "/api/snapshot-key") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const baseUrl = `${protocol}://${host}`;
    sendJson(res, {
      key: snapshotKey,
      baseUrl,
      exampleUrl: `${baseUrl}/api/snapshot/PROJECT_NAME?key=${snapshotKey}`,
      commandEndpoint: `${baseUrl}/api/sandbox/execute?key=${snapshotKey}`,
      commandProtocol: "POST JSON {actions: [{type, project, ...}]}. Action types: list_tree, read_file, read_multiple_files, write_file, create_file, delete_file, bulk_delete, move_file, copy_file, copy_folder, rename_file, grep, search_files, search_replace, apply_patch, bulk_write, run_command, install_deps, add_dependency, type_check, lint_and_fix, format_files, get_build_metrics, restart_dev_server, list_open_ports, git_status, git_add, git_commit, git_diff, git_log, git_branch, git_checkout, git_stash, git_init, git_push, git_pull, git_merge, detect_structure, start_process, kill_process, list_processes, build_project, run_tests, archive_project, export_project, set_env_var, get_env_vars, rollback_last_change, project_analyze, tailwind_audit, find_usages, component_tree, extract_theme, extract_colors, capture_preview, get_preview_url, generate_component, generate_page, refactor_file, validate_change, profile_performance",
    });
    return;
  }

  if (pathname.startsWith("/api/snapshot/")) {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const providedKey = getKey(req, url);
    if (providedKey !== snapshotKey) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Lamby Snapshot API\n\nAccess denied — invalid or missing key.\nProvide ?key=YOUR_KEY or Authorization: Bearer YOUR_KEY");
      return;
    }
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
      res.end(`Lamby Snapshot API\n\nAvailable projects:\n${projectList.map(p => `- ${p}`).join("\n") || "(none)"}\n\nUsage: /api/snapshot/PROJECT_NAME?key=YOUR_KEY`);
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
      const providedKey = getKey(req, url);
      if (providedKey !== snapshotKey) {
        sendJson(res, { error: "Invalid key" }, 403);
        return;
      }
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
      const result = await executeSandboxActions(actions, PROJECTS_DIR, { auditLog: sandboxAuditLog });
      sendJson(res, result);
    } catch (err) {
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/sandbox/audit-log") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const providedKey = getKey(req, url);
    if (providedKey !== snapshotKey) {
      sendJson(res, { error: "Invalid key" }, 403);
      return;
    }
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
              env: { ...process.env, HUSKY: "0", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" },
            });
            break;
          } catch {}
        }
      }

      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const scripts = pkg.scripts || {};
      const isNext = !!deps.next;
      const isNuxt = !!deps.nuxt;

      if (isNext) patchNextConfig(effectiveProjectDir);

      let devCmd;
      if (scripts.dev) {
        devCmd = { cmd: "npx", args: [pm === "npm" ? "npm" : pm, "run", "dev"] };
      } else if (deps.vite || fs.existsSync(path.join(effectiveProjectDir, "vite.config.ts")) || fs.existsSync(path.join(effectiveProjectDir, "vite.config.js"))) {
        devCmd = { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", String(port)] };
      } else if (isNext) {
        devCmd = { cmd: "npx", args: ["next", "dev", "--port", String(port)] };
      } else if (isNuxt) {
        devCmd = { cmd: "npx", args: ["nuxi", "dev", "--port", String(port)] };
      } else if (scripts.start) {
        devCmd = { cmd: "npx", args: [pm === "npm" ? "npm" : pm, "run", "start"] };
      } else {
        devCmd = { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", String(port)] };
      }

      devCmd = resolveLocalBin(devCmd, effectiveProjectDir);

      const env = {
        ...process.env,
        PORT: String(port),
        HOST: "0.0.0.0",
        BROWSER: "none",
        FORCE_COLOR: "1",
      };

      console.log(`[Preview] Starting ${name} on port ${port}: ${devCmd.cmd} ${devCmd.args.join(" ")}`);
      const proc = spawn(devCmd.cmd, devCmd.args, {
        cwd: effectiveProjectDir,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        detached: true,
        shell: process.platform === "win32",
      });

      const logBuf = { stdout: "", stderr: "" };
      proc.stdout?.on("data", (d) => { logBuf.stdout += d.toString(); if (logBuf.stdout.length > 20000) logBuf.stdout = logBuf.stdout.slice(-10000); });
      proc.stderr?.on("data", (d) => { logBuf.stderr += d.toString(); if (logBuf.stderr.length > 20000) logBuf.stderr = logBuf.stderr.slice(-10000); });

      previewProcesses.set(name, { process: proc, port, logs: logBuf });

      proc.on("exit", (code) => {
        console.log(`[Preview] ${name} exited with code ${code}`);
        previewProcesses.delete(name);
        if (!previewStoppedManually.has(name) && code !== 0) {
          console.log(`[Preview] ${name} crashed — will not auto-restart`);
        }
        previewStoppedManually.delete(name);
      });

      await new Promise(r => setTimeout(r, 2000));
      sendJson(res, { success: true, name, port, url: `http://localhost:${port}` });
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
        sendJson(res, { running: true, port: entry.port, url: `http://localhost:${entry.port}` });
      } else {
        sendJson(res, { running: false });
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
    const withinGrace = !bridgeConnected && bridgeLastConnectedAt > 0 && (Date.now() - bridgeLastConnectedAt) < BRIDGE_GRACE_PERIOD_MS;
    const effectiveStatus = bridgeConnected ? "connected" : (withinGrace ? "connected" : (bridgeReconnectTimer ? "connecting" : "disconnected"));
    sendJson(res, {
      status: effectiveStatus,
      relayUrl: bridgeConfig.relayUrl || "",
      bridgeKey: bridgeConfig.bridgeKey || "",
      key: snapshotKey,
    });
    return;
  }

  if (pathname === "/api/console-logs") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const projectName = url.searchParams.get("project") || "";
    const providedKey = getKey(req, url);
    if (providedKey !== snapshotKey) { sendJson(res, { error: "Invalid key" }, 403); return; }
    sendJson(res, gatherConsoleLogs(projectName));
    return;
  }

  if (pathname === "/api/bridge-config-save") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const body = JSON.parse(await readBody(req));
      bridgeConfig = { relayUrl: body.relayUrl || "", bridgeKey: body.bridgeKey || "" };
      saveBridgeConfig(bridgeConfig);
      if (bridgeReconnectTimer) { clearTimeout(bridgeReconnectTimer); bridgeReconnectTimer = null; }
      bridgeReconnectDelay = 2000;
      bridgeFailCount = 0;
      bridgeTriedFallback = false;
      connectToBridgeRelay();
      sendJson(res, { success: true });
    } catch (err) {
      sendJson(res, { success: false, error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/bridge-reconnect") {
    if (req.method !== "POST" && req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    if (bridgeReconnectTimer) { clearTimeout(bridgeReconnectTimer); bridgeReconnectTimer = null; }
    bridgeReconnectDelay = 2000;
    bridgeFailCount = 0;
    bridgeTriedFallback = false;
    connectToBridgeRelay();
    sendJson(res, { success: true, status: "reconnecting" });
    return;
  }

  if (pathname === "/health" || pathname === "/healthz") {
    sendJson(res, { status: "ok", uptime: process.uptime(), bridge: bridgeConnected ? "connected" : "disconnected" });
    return;
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
          const result = await executeSandboxActions(actions, PROJECTS_DIR, { auditLog: sandboxAuditLog, onActionResult });
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
      const providedKey = reqUrl.searchParams.get("key") || "";
      if (providedKey !== snapshotKey) { socket.destroy(); return; }
      sandboxWss.handleUpgrade(req, socket, head, (ws) => {
        sandboxWss.emit("connection", ws);
      });
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Lamby Local] Server running on port ${PORT}`);
  console.log(`[Lamby Local] Snapshot key: ${snapshotKey}`);
  console.log(`[Lamby Local] Projects dir: ${PROJECTS_DIR}`);
  console.log(`[Lamby Local] Sandbox API: http://localhost:${PORT}/api/sandbox/execute`);
  console.log(`[Lamby Local] Bridge relay: ${bridgeConfig.relayUrl || "(none)"}`);
  setTimeout(() => connectToBridgeRelay(), 1000);
});
