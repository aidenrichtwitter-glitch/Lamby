#!/usr/bin/env node
// desktop-connector.js — Lamby Bridge Connector v2.0
// Zero-dependency Node.js WebSocket client for the Lamby Bridge Relay.
// 86 commands implemented. Auto-reconnects forever. Hardened for real Grok usage.
//
// Usage:  node desktop-connector.js
// Config via env vars (or edit start-connector.bat):
//   RELAY_URL      wss://bridge-relay.replit.app   Relay server URL
//   PROJECT_NAME   ""       Default project name sent on connect
//   PROJECT_DIR    cwd      Root dir containing projects/ subdirectory
//   PREVIEW_PORT   3000     Fallback port for screenshot if not auto-detected
"use strict";
const net    = require("net");
const tls    = require("tls");
const http   = require("http");
const crypto = require("crypto");
const fs     = require("fs");
const path   = require("path");
const os     = require("os");
const https  = require("https");
const { exec, spawn, execSync } = require("child_process");

// ── Config ────────────────────────────────────────────────────────────────────
const RELAY_URL    = process.env.RELAY_URL    || "wss://bridge-relay.replit.app";
const PROJECT_NAME = process.env.PROJECT_NAME || "";
const PROJECT_DIR  = process.env.PROJECT_DIR  || process.cwd();
const PREVIEW_PORT = parseInt(process.env.PREVIEW_PORT || process.env.LAMBY_PORT || "3000", 10);

// ── State ─────────────────────────────────────────────────────────────────────
const runningProcs  = new Map(); // pid → { proc, name, command, project, cwd, startedAt, stdout:[], stderr:[] }
const namedProcs    = new Map(); // name → pid  (for start_process_named + kill by name)
const lastWritten   = new Map(); // project → filePath  (for rollback_last_change)
const devPortCache  = new Map(); // project → { port, at }   (last confirmed live dev port)
const pendingChunks  = new Map(); // "project:path" → { chunks:[], total, lastAt }
const projectDirCache = new Map(); // lowercased_name → { dir, pkgName, hasDev }  — built by scanProjectDirs()
const RECONNECT_DELAY = 5000; // flat 5s reconnect — no exponential backoff
let _socket         = null;
let _connected      = false;
let _pingInterval   = null;
let _lastScreenshotUrl  = "";
let _lastUploadedHash   = "";

// ── Logging ───────────────────────────────────────────────────────────────────
function log(level, msg) {
  const ts  = new Date().toISOString().slice(11, 19);
  const tag = level === "error" ? "[Bridge ERROR]" : level === "warn" ? "[Bridge WARN] " : "[Bridge]      ";
  console.log(`${ts} ${tag} ${msg}`);
}

// ── WebSocket frame encoding (client→server MUST be masked per RFC 6455) ──────
function wsEncodeFrame(data) {
  const payload = Buffer.from(data, "utf-8");
  const len = payload.length;
  const mask = crypto.randomBytes(4);
  let header;
  if (len < 126) {
    header = Buffer.alloc(6); header[0] = 0x81; header[1] = 0x80 | len; mask.copy(header, 2);
  } else if (len < 65536) {
    header = Buffer.alloc(8); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); mask.copy(header, 4);
  } else {
    header = Buffer.alloc(14); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); mask.copy(header, 10);
  }
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
  return Buffer.concat([header, masked]);
}

// ── WebSocket frame decoding (server→client frames are NOT masked) ─────────────
function wsDecodeFrame(buf) {
  if (buf.length < 2) return { data: null, bytesConsumed: 0, opcode: 0 };
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;
  if (payloadLen === 126) {
    if (buf.length < 4) return { data: null, bytesConsumed: 0, opcode };
    payloadLen = buf.readUInt16BE(2); offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return { data: null, bytesConsumed: 0, opcode };
    payloadLen = Number(buf.readBigUInt64BE(2)); offset = 10;
  }
  if (masked) {
    if (buf.length < offset + 4 + payloadLen) return { data: null, bytesConsumed: 0, opcode };
    const m = buf.slice(offset, offset + 4); offset += 4;
    const p = Buffer.alloc(payloadLen);
    for (let i = 0; i < payloadLen; i++) p[i] = buf[offset + i] ^ m[i % 4];
    return { data: p.toString("utf-8"), opcode, bytesConsumed: offset + payloadLen };
  }
  if (buf.length < offset + payloadLen) return { data: null, bytesConsumed: 0, opcode };
  return { data: buf.slice(offset, offset + payloadLen).toString("utf-8"), opcode, bytesConsumed: offset + payloadLen };
}

// ── Send ──────────────────────────────────────────────────────────────────────
function send(obj) {
  if (!_socket || !_connected) return false;
  try { _socket.write(wsEncodeFrame(JSON.stringify(obj))); return true; } catch { return false; }
}

// ── Project directory scanner ─────────────────────────────────────────────────
// Walks PROJECT_DIR/projects/ and PROJECT_DIR/ to build projectDirCache.
// Called at startup and every 15 seconds so new projects are auto-discovered
// without needing a connector restart.
function scanProjectDirs() {
  const roots = [
    path.join(PROJECT_DIR, "projects"),
    PROJECT_DIR,
  ];
  let found = 0;
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    let entries;
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      // Skip hidden dirs and node_modules at the root level
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const dir = path.join(root, e.name);
      const pkgPath = path.join(dir, "package.json");
      let pkgName = null;
      let hasDev = false;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        pkgName = pkg.name || null;
        hasDev  = !!(pkg.scripts && (pkg.scripts.dev || pkg.scripts.start));
      } catch { /* no package.json — still register by dir name */ }
      const entry = { dir, pkgName, hasDev };
      // Register by lowercased directory name
      projectDirCache.set(e.name.toLowerCase(), entry);
      // Also register by package.json name (e.g. "groks-app" vs folder "groks_app")
      if (pkgName) projectDirCache.set(pkgName.toLowerCase(), entry);
      found++;
    }
  }
  return found;
}

// ── Project path resolution ───────────────────────────────────────────────────
// Resolution order:
//   1. Exact path: PROJECT_DIR/projects/project  or  PROJECT_DIR/project
//   2. projectDirCache (populated by scanProjectDirs every 15s) — case-insensitive
//      matches both the folder name and the package.json "name" field
//   3. Fuzzy partial match in cache (project name contained in folder name or vice versa)
//   4. Fall back to PROJECT_DIR so callers that check existsSync still get a valid path
function resolveProjectDir(project) {
  if (!project) return PROJECT_DIR;

  // 1. Exact filesystem paths (original fast path)
  for (const sub of ["projects", ""]) {
    const candidate = sub
      ? path.join(PROJECT_DIR, sub, project)
      : path.join(PROJECT_DIR, project);
    if (fs.existsSync(candidate)) return candidate;
  }

  // 2. Cache lookup — case-insensitive exact match (dir name or package.json name)
  const lp = project.toLowerCase();
  const cached = projectDirCache.get(lp);
  if (cached && fs.existsSync(cached.dir)) return cached.dir;

  // 3. Fuzzy cache match — project name is a substring of the folder/pkg name or vice versa
  for (const [key, entry] of projectDirCache) {
    if ((key.includes(lp) || lp.includes(key)) && fs.existsSync(entry.dir)) {
      log("info", `resolveProjectDir fuzzy match: "${project}" → "${entry.dir}"`);
      return entry.dir;
    }
  }

  // 4. Re-scan on demand in case it was recently created
  scanProjectDirs();
  const recached = projectDirCache.get(lp);
  if (recached && fs.existsSync(recached.dir)) return recached.dir;

  log("warn", `resolveProjectDir: no match for "${project}" in ${PROJECT_DIR}. Known: [${[...projectDirCache.keys()].join(", ")}]`);
  return PROJECT_DIR;
}

function resolvePath(project, filePath) {
  if (!filePath && filePath !== "") throw new Error("Missing required field: path");
  const base = path.resolve(resolveProjectDir(project));
  const resolved = path.resolve(base, filePath);
  const rel = path.relative(base, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path traversal blocked: "${filePath}" escapes project root`);
  }
  return resolved;
}

function resolveCwd(base, cwd) {
  if (!cwd) return base;
  const resolved = path.resolve(base, cwd);
  const rel = path.relative(base, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`cwd escapes project root: "${cwd}"`);
  }
  return resolved;
}

// ── Chrome detection ──────────────────────────────────────────────────────────
function findChrome() {
  const pf   = process.env["PROGRAMFILES"]      || "C:\\Program Files";
  const pf86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
  const lad  = process.env["LOCALAPPDATA"]      || "";
  const candidates = process.platform === "win32"
    ? [ path.join(pf,   "Google\\Chrome\\Application\\chrome.exe"),
        path.join(pf86, "Google\\Chrome\\Application\\chrome.exe"),
        path.join(lad,  "Google\\Chrome\\Application\\chrome.exe"),
        path.join(pf,   "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
        path.join(pf,   "Chromium\\Application\\chrome.exe") ]
    : process.platform === "darwin"
    ? [ "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" ]
    : [ "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser", "/usr/bin/chromium", "/snap/bin/chromium" ];
  for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch {} }
  return null;
}

// ── catbox.moe upload ─────────────────────────────────────────────────────────
function uploadToCatbox(filePath) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(filePath);
    const boundary = "LambyBound" + crypto.randomBytes(8).toString("hex");
    const part1 = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="${path.basename(filePath)}"\r\nContent-Type: image/png\r\n\r\n`);
    const part2 = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body  = Buffer.concat([part1, fileData, part2]);
    const req   = https.request({ hostname: "catbox.moe", path: "/user/api.php", method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": body.length } },
      (res) => {
        let data = "";
        res.on("data", c => { data += c; });
        res.on("end", () => {
          if (data.startsWith("https://")) resolve(data.trim());
          else reject(new Error(`catbox upload failed: ${data.substring(0, 80)}`));
        });
      });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Exec helper (configurable timeout) ───────────────────────────────────────
function execp(cmd, opts = {}) {
  const timeout = opts.timeout || 30000;
  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 8 * 1024 * 1024, ...opts, timeout }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          stdout: stdout || "",
          stderr: stderr || "",
          exitCode: err.code ?? null,
          timedOut: err.killed || err.signal === "SIGTERM",
          error: err.message,
        });
      } else {
        resolve({ stdout: stdout || "", stderr: stderr || "", exitCode: 0 });
      }
    });
  });
}

// ── execFile wrapper — NO shell expansion, args are passed as an argv array ───
// Use this for any command that takes user-controlled parameters.
// exec() passes the whole string to cmd.exe/sh which interprets shell metacharacters;
// execFile() calls the binary directly with an argv array — no shell injection possible.
const { execFile } = require("child_process");
function execFilep(file, args, opts = {}) {
  const timeout = opts.timeout || 30000;
  return new Promise((resolve) => {
    execFile(file, args, { maxBuffer: 8 * 1024 * 1024, ...opts, timeout }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          stdout: stdout || "",
          stderr: stderr || "",
          exitCode: err.code ?? null,
          timedOut: err.killed || err.signal === "SIGTERM",
          error: err.message,
        });
      } else {
        resolve({ stdout: stdout || "", stderr: stderr || "", exitCode: 0 });
      }
    });
  });
}

// ── Input validation helpers (throws on invalid input) ────────────────────────
// These prevent shell injection when values are used in command arguments.
// Even though execFilep doesn't use a shell, validated inputs also protect
// against unintended git flag injection (e.g. "--upload-pack=...").

/** Valid git ref chars: alphanumeric, dash, dot, underscore, slash, tilde, caret, colon, @, { } */
const GIT_REF_RE = /^[a-zA-Z0-9._\-/~^:@{}]+$/;
function validateGitRef(val, fieldName = "ref") {
  if (!val || typeof val !== "string") throw new Error(`${fieldName} is required`);
  if (val.length > 200) throw new Error(`${fieldName} too long (max 200)`);
  if (!GIT_REF_RE.test(val)) throw new Error(`${fieldName} contains invalid characters: ${JSON.stringify(val)}`);
  if (val.startsWith("-")) throw new Error(`${fieldName} must not start with "-" (looks like a flag)`);
  return val;
}

/** Valid npm package name chars (including scoped @scope/name) */
const PKG_NAME_RE = /^(@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+(@[a-zA-Z0-9._~^<>=*-]+)?$/;
function validatePkgName(val) {
  if (!val || typeof val !== "string") throw new Error("package name is required");
  if (val.length > 200) throw new Error("package name too long");
  if (!PKG_NAME_RE.test(val)) throw new Error(`Invalid package name: ${JSON.stringify(val)}`);
  return val;
}

/** Git reset mode — must be one of the three known values */
const ALLOWED_RESET_MODES = new Set(["soft", "mixed", "hard"]);
function validateResetMode(val) {
  const m = (val || "soft").toLowerCase();
  if (!ALLOWED_RESET_MODES.has(m)) throw new Error(`git_reset mode must be one of: soft, mixed, hard — got: ${JSON.stringify(val)}`);
  return m;
}

/** Path arg — no shell metacharacters; must not start with "-" */
const SAFE_PATH_RE = /^[^;&|`$<>()\r\n]+$/;
function validateShellPath(val, fieldName = "path") {
  if (!val || typeof val !== "string") throw new Error(`${fieldName} is required`);
  if (!SAFE_PATH_RE.test(val)) throw new Error(`${fieldName} contains unsafe characters: ${JSON.stringify(val)}`);
  if (val.startsWith("-")) throw new Error(`${fieldName} must not start with "-"`);
  return val;
}

// ── Detect package manager ────────────────────────────────────────────────────
function detectPkgManager(dir) {
  if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(dir, "yarn.lock")))      return "yarn";
  if (fs.existsSync(path.join(dir, "bun.lockb")))      return "bun";
  return "npm";
}

// ── Truncate output lines ─────────────────────────────────────────────────────
function truncateLines(str, maxLines = 1000) {
  const lines = (str || "").split("\n");
  if (lines.length <= maxLines) return { output: str, truncated: false, totalLines: lines.length };
  return { output: lines.slice(0, maxLines).join("\n"), truncated: true, totalLines: lines.length };
}

// ── Binary file detection ─────────────────────────────────────────────────────
function isBinary(fp) {
  try {
    const buf = Buffer.alloc(512);
    const fd  = fs.openSync(fp, "r");
    const read = fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);
    for (let i = 0; i < read; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch { return false; }
}

// ── Walk directory (returns array of relative paths) ─────────────────────────
const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", ".cache", ".next", "build", "__pycache__", ".turbo", "coverage", ".vite"]);

function walkFiles(dir, base = dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const e of entries) {
    if (IGNORED_DIRS.has(e.name) || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    const rel  = path.relative(base, full);
    if (e.isDirectory()) walkFiles(full, base, results);
    else results.push(rel);
  }
  return results;
}

// ── Tree builder ─────────────────────────────────────────────────────────────
function buildTree(dir, prefix = "") {
  let out = "";
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return ""; }
  for (const e of entries) {
    if (IGNORED_DIRS.has(e.name) || e.name.startsWith(".")) continue;
    out += `${prefix}${e.name}${e.isDirectory() ? "/" : ""}\n`;
    if (e.isDirectory()) out += buildTree(path.join(dir, e.name), prefix + "  ");
  }
  return out;
}

// ── Find dev port from running processes ──────────────────────────────────────
function findDevPort(project) {
  for (const [, e] of runningProcs) {
    if (e.project === project) {
      const allOut = [...e.stdout, ...e.stderr].join("\n");
      // Vite prints: "Local:   http://localhost:5168/" or "localhost:5168"
      const m = allOut.match(/localhost:(\d{4,5})/);
      if (m) return parseInt(m[1]);
    }
  }
  return null;
}

// Quick TCP connection test — true if something is listening on port
function tcpProbe(port) {
  return new Promise(resolve => {
    const s = net.createConnection({ host: "127.0.0.1", port, timeout: 600 });
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("error",   () => { s.destroy(); resolve(false); });
    s.once("timeout", () => { s.destroy(); resolve(false); });
  });
}

// Get all TCP LISTENING ports (Windows: netstat -ano, Linux: ss/netstat)
async function getListeningPorts() {
  const ports = [];
  try {
    let raw = "";
    if (process.platform === "win32") {
      raw = await new Promise((res, rej) => {
        exec("netstat -ano", { timeout: 8000 }, (e, out) => e ? rej(e) : res(out));
      });
      for (const line of raw.split("\n")) {
        const m = line.match(/TCP\s+[\d.:*]+:(\d+)\s+[\d.:*]+\s+LISTENING/i);
        if (m) { const p = parseInt(m[1]); if (p >= 3000 && p <= 9999) ports.push(p); }
      }
    } else {
      raw = await new Promise((res) => {
        exec("ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null", { timeout: 8000 }, (e, out) => res(out || ""));
      });
      for (const line of raw.split("\n")) {
        const m = line.match(/:(\d{4,5})\s/);
        if (m) { const p = parseInt(m[1]); if (p >= 3000 && p <= 9999) ports.push(p); }
      }
    }
  } catch (_) {}
  // Deduplicate and sort; prefer Vite defaults (5173, 5174 … 5199 etc.)
  const uniq = [...new Set(ports)];
  uniq.sort((a, b) => {
    const viteish = p => (p >= 5100 && p <= 5299) ? 0 : 1;
    return viteish(a) - viteish(b) || a - b;
  });
  return uniq;
}

// Find the live dev port for a project — fastest accurate method wins.
// Strategy: process-stdout → cached → netstat+TCP probe → PREVIEW_PORT
async function findDevPortActive(project) {
  // 1. Process stdout (zero-cost, works when start_process_named was used)
  const fromProc = findDevPort(project);
  if (fromProc) {
    if (await tcpProbe(fromProc)) {
      devPortCache.set(project, { port: fromProc, at: Date.now() });
      return fromProc;
    }
  }
  // 2. Cached port (valid for 2 min; re-verify it's still alive)
  const cached = devPortCache.get(project);
  if (cached && (Date.now() - cached.at < 120000)) {
    if (await tcpProbe(cached.port)) return cached.port;
    devPortCache.delete(project);
  }
  // 3. Active netstat scan — find all LISTENING ports in dev range then TCP-probe each
  const ports = await getListeningPorts();
  for (const port of ports) {
    if (await tcpProbe(port)) {
      devPortCache.set(project, { port, at: Date.now() });
      return port;
    }
  }
  // 4. Last resort: PREVIEW_PORT env fallback
  return null;
}

// ── Parse .env file ───────────────────────────────────────────────────────────
function parseDotEnv(fp) {
  const vars = {};
  if (!fs.existsSync(fp)) return vars;
  const lines = fs.readFileSync(fp, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

function writeDotEnv(fp, vars) {
  const lines = [];
  for (const [k, v] of Object.entries(vars)) {
    const needsQuotes = v.includes(" ") || v.includes("#") || v.includes("=");
    lines.push(`${k}=${needsQuotes ? `"${v.replace(/"/g, '\\"')}"` : v}`);
  }
  fs.writeFileSync(fp, lines.join("\n") + "\n", "utf-8");
}

// ── Import extraction ─────────────────────────────────────────────────────────
function extractImportsFromContent(content) {
  const imports = [];
  const re = /^import\s+(type\s+)?(.+?)\s+from\s+['"](.+?)['"]/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const isType = !!m[1];
    const what   = m[2].trim();
    const module = m[3];
    if (what.startsWith("{")) {
      const names = what.replace(/[{}]/g, "").split(",").map(n => n.trim().split(" as ")[0].trim()).filter(Boolean);
      imports.push({ module, names, isDefault: false, isType });
    } else if (what.startsWith("* as")) {
      imports.push({ module, names: [what], isDefault: false, isType, isNamespace: true });
    } else if (what.includes(",")) {
      // default + named: React, { useState }
      const names = what.split(",").map(p => p.trim().replace(/[{}]/g, "").trim()).filter(Boolean);
      imports.push({ module, names, isDefault: true, isType });
    } else {
      imports.push({ module, names: [what], isDefault: true, isType });
    }
  }
  // Dynamic imports
  const dynRe = /import\(['"](.+?)['"]\)/g;
  while ((m = dynRe.exec(content)) !== null) {
    imports.push({ module: m[1], names: ["*"], isDefault: false, isDynamic: true });
  }
  return imports;
}

// ── Unified diff applier ──────────────────────────────────────────────────────
function applyUnifiedPatch(origContent, patchText) {
  const patchLines = patchText.split("\n");
  let fileLines    = origContent.split("\n");
  let idx          = 0;
  let appliedHunks = 0;
  let failedHunks  = 0;

  // Skip file header (--- / +++ lines)
  while (idx < patchLines.length && !patchLines[idx].startsWith("@@")) idx++;

  while (idx < patchLines.length) {
    if (!patchLines[idx].startsWith("@@")) { idx++; continue; }
    const hunkHeader = patchLines[idx++];
    const m = hunkHeader.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!m) continue;
    const origStart = parseInt(m[1]) - 1; // 0-indexed

    // Collect hunk body
    const hunkBody = [];
    while (idx < patchLines.length && !patchLines[idx].startsWith("@@") &&
           !patchLines[idx].startsWith("diff ")) {
      const line = patchLines[idx++];
      if (line.startsWith("--- ") || line.startsWith("+++ ")) break;
      hunkBody.push(line);
    }

    // Build remove/add lists (context lines appear in both)
    const toRemove = [];
    const toAdd    = [];
    for (const line of hunkBody) {
      if (line.startsWith("-")) { toRemove.push(line.slice(1)); }
      else if (line.startsWith("+")) { toAdd.push(line.slice(1)); }
      else if (line.startsWith("\\")) { /* no-newline indicator — skip */ }
      else { const c = line.startsWith(" ") ? line.slice(1) : line; toRemove.push(c); toAdd.push(c); }
    }

    // Find exact position, with fuzzy fallback ±30 lines
    let applyAt = -1;
    const removeStr = toRemove.join("\n");
    const searchRadius = 30;

    const tryAt = (start) => {
      if (start < 0 || start + toRemove.length > fileLines.length + 1) return false;
      const candidate = fileLines.slice(start, start + toRemove.length).join("\n");
      if (candidate === removeStr) { applyAt = start; return true; }
      return false;
    };

    if (!tryAt(origStart)) {
      for (let d = 1; d <= searchRadius; d++) {
        if (tryAt(origStart + d) || tryAt(origStart - d)) break;
      }
    }

    if (applyAt !== -1) {
      fileLines.splice(applyAt, toRemove.length, ...toAdd);
      appliedHunks++;
    } else {
      failedHunks++;
    }
  }

  return { content: fileLines.join("\n"), appliedHunks, failedHunks };
}

// ── Detect project structure ──────────────────────────────────────────────────
function detectStructure(projDir) {
  let pkg = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(projDir, "package.json"), "utf-8")); } catch {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const scripts = pkg.scripts || {};

  const has = (name) => !!deps[name];
  const hasFile = (f) => fs.existsSync(path.join(projDir, f));

  const framework = has("next") ? "next" : has("nuxt") ? "nuxt" : has("@sveltejs/kit") ? "sveltekit"
    : (has("react") || has("react-dom")) ? "react" : has("vue") ? "vue" : has("svelte") ? "svelte"
    : has("@angular/core") ? "angular" : has("express") || has("fastify") || has("koa") ? "node-server" : "unknown";

  const bundler = has("vite") ? "vite" : has("webpack") ? "webpack" : has("parcel") ? "parcel"
    : has("esbuild") ? "esbuild" : has("rollup") ? "rollup" : has("turbopack") ? "turbopack" : "unknown";

  const language = hasFile("tsconfig.json") || hasFile("tsconfig.base.json") ? "typescript" : "javascript";
  const pkgManager = detectPkgManager(projDir);
  const testRunner = has("vitest") ? "vitest" : has("jest") ? "jest" : has("mocha") ? "mocha" : has("playwright") ? "playwright" : "none";
  const hasTailwind = has("tailwindcss") || hasFile("tailwind.config.js") || hasFile("tailwind.config.ts");
  const hasGit = hasFile(".git");
  const hasDocker = hasFile("Dockerfile") || hasFile("docker-compose.yml");

  return {
    framework, bundler, language, pkgManager, testRunner,
    hasTailwind, hasGit, hasDocker,
    name: pkg.name || path.basename(projDir),
    version: pkg.version || "0.0.0",
    scripts: Object.keys(scripts),
    packageCount: Object.keys(deps).length,
  };
}

// ── Action handler ────────────────────────────────────────────────────────────
async function handleAction(action) {
  const project = action.project || PROJECT_NAME || "";
  const projDir = resolveProjectDir(project);

  // Validate project dir exists — give a helpful error showing known projects
  if (!fs.existsSync(projDir)) {
    const known = [...new Set([...projectDirCache.values()].map(e => e.pkgName || path.basename(e.dir)))].join(", ");
    throw new Error(
      `Project directory not found: "${project}" → resolved to "${projDir}" which does not exist. ` +
      `PROJECT_DIR=${PROJECT_DIR}. ` +
      (known ? `Known projects: [${known}]. ` : "No projects found under PROJECT_DIR. ") +
      `Try one of the known names, or check PROJECT_DIR in start-connector.bat.`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DISCOVERY
  // ─────────────────────────────────────────────────────────────────────────

  if (action.type === "list_projects") {
    scanProjectDirs(); // refresh before reporting
    const seen = new Set();
    const projects = [];
    for (const [, entry] of projectDirCache) {
      if (seen.has(entry.dir)) continue;
      seen.add(entry.dir);
      const devPort = devPortCache.get(path.basename(entry.dir));
      projects.push({
        name: entry.pkgName || path.basename(entry.dir),
        dir: entry.dir,
        hasDev: entry.hasDev,
        activePort: devPort ? devPort.port : null,
      });
    }
    return { success: true, projects, projectDir: PROJECT_DIR };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FILE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  if (action.type === "list_tree") {
    const subPath = action.path ? resolvePath(project, action.path) : projDir;
    const tree = buildTree(subPath);
    const allFiles = walkFiles(subPath);
    return { fileTree: tree, projectDir: projDir, fileCount: allFiles.length };
  }

  if (action.type === "read_file") {
    const fp = resolvePath(project, action.path);
    if (!fs.existsSync(fp)) return { success: false, error: `File not found: ${action.path}`, path: action.path, content: null };
    if (isBinary(fp)) return { success: false, error: "binary file — cannot read as text", path: action.path, content: null };
    const stat = fs.statSync(fp);
    const MAX_BYTES = 500 * 1024; // 500KB
    if (stat.size > MAX_BYTES) {
      const content = fs.readFileSync(fp, "utf-8").slice(0, MAX_BYTES);
      const lines = content.split("\n");
      return { path: action.path, content: lines.slice(0, 200).join("\n"), truncated: true, totalBytes: stat.size, shownLines: Math.min(lines.length, 200) };
    }
    const content = fs.readFileSync(fp, "utf-8");
    return { path: action.path, content, size: content.length };
  }

  if (action.type === "read_multiple_files") {
    const paths = action.paths || [];
    if (!Array.isArray(paths) || paths.length === 0) throw new Error("Missing required field: paths (array)");
    const files = [];
    for (const p of paths) {
      try {
        const fp = resolvePath(project, p);
        if (!fs.existsSync(fp)) { files.push({ path: p, content: null, error: "not found" }); continue; }
        if (isBinary(fp)) { files.push({ path: p, content: null, error: "binary file" }); continue; }
        const content = fs.readFileSync(fp, "utf-8");
        files.push({ path: p, content, size: content.length });
      } catch (e) {
        files.push({ path: p, content: null, error: e.message });
      }
    }
    return { files };
  }

  if (action.type === "write_file") {
    if (action.content === undefined) throw new Error("Missing required field: content");
    const fp = resolvePath(project, action.path);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, action.content, "utf-8");
    lastWritten.set(project, action.path);
    return { path: action.path, written: true, bytes: Buffer.byteLength(action.content, "utf-8") };
  }

  if (action.type === "write_file_chunk") {
    const chunkIndex = Number(action.chunk_index ?? action.chunkIndex ?? 0);
    const totalChunks = Number(action.total_chunks ?? action.totalChunks ?? 1);
    const content = action.content ?? "";
    if (!action.path) throw new Error("Missing required field: path");
    const key = `${project}:${action.path}`;
    let entry = pendingChunks.get(key);
    if (!entry) {
      entry = { chunks: [], total: totalChunks, lastAt: Date.now() };
      pendingChunks.set(key, entry);
    }
    entry.chunks[chunkIndex] = content;
    entry.lastAt = Date.now();
    const receivedCount = entry.chunks.filter(c => c !== undefined).length;
    if (receivedCount < totalChunks) {
      return { path: action.path, received: chunkIndex, total: totalChunks,
               waiting_for: totalChunks - receivedCount, done: false };
    }
    const assembled = entry.chunks.join("");
    pendingChunks.delete(key);
    const fp = resolvePath(project, action.path);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, assembled, "utf-8");
    lastWritten.set(project, action.path);
    return { path: action.path, done: true, written: true,
             bytes: Buffer.byteLength(assembled, "utf-8"), chunks: totalChunks };
  }

  if (action.type === "create_file") {
    const fp = resolvePath(project, action.path);
    if (fs.existsSync(fp) && !action.overwrite) {
      return { path: action.path, created: false, exists: true };
    }
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, action.content || "", "utf-8");
    lastWritten.set(project, action.path);
    return { path: action.path, created: true };
  }

  if (action.type === "delete_file") {
    const fp = resolvePath(project, action.path);
    const existed = fs.existsSync(fp);
    if (existed) fs.unlinkSync(fp);
    return { path: action.path, deleted: existed };
  }

  if (action.type === "bulk_delete") {
    const paths = action.paths || [];
    const deleted = [], errors = [];
    for (const p of paths) {
      try {
        const fp = resolvePath(project, p);
        if (fs.existsSync(fp)) { fs.unlinkSync(fp); deleted.push(p); }
        else errors.push({ path: p, error: "not found" });
      } catch (e) {
        errors.push({ path: p, error: e.message });
      }
    }
    return { deleted, errors };
  }

  if (action.type === "bulk_write") {
    const files = action.files || [];
    const written = [], errors = [];
    for (const f of files) {
      try {
        const fp = resolvePath(project, f.path);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, f.content || "", "utf-8");
        lastWritten.set(project, f.path);
        written.push({ path: f.path, bytes: Buffer.byteLength(f.content || "", "utf-8") });
      } catch (e) {
        errors.push({ path: f.path, error: e.message });
      }
    }
    return { written, errors, totalFiles: written.length };
  }

  if (action.type === "move_file" || action.type === "rename_file") {
    const from = resolvePath(project, action.from);
    const to   = resolvePath(project, action.to);
    if (!fs.existsSync(from)) throw new Error(`Source not found: ${action.from}`);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    return { moved: true, from: action.from, to: action.to };
  }

  if (action.type === "copy_file") {
    const from = resolvePath(project, action.from);
    const to   = resolvePath(project, action.to);
    if (!fs.existsSync(from)) throw new Error(`Source not found: ${action.from}`);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    return { copied: true, from: action.from, to: action.to };
  }

  if (action.type === "create_folder") {
    const fp = resolvePath(project, action.path);
    const existed = fs.existsSync(fp);
    fs.mkdirSync(fp, { recursive: true });
    return { path: action.path, created: !existed, exists: existed };
  }

  if (action.type === "delete_folder" || action.type === "move_folder") {
    if (action.type === "move_folder") {
      const from = resolvePath(project, action.from);
      const to   = resolvePath(project, action.to);
      if (!fs.existsSync(from)) throw new Error(`Source folder not found: ${action.from}`);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);
      return { moved: true, from: action.from, to: action.to };
    }
    const fp = resolvePath(project, action.path);
    if (!fs.existsSync(fp)) return { path: action.path, deleted: false, reason: "not found" };
    fs.rmSync(fp, { recursive: true, force: true });
    return { path: action.path, deleted: true };
  }

  if (action.type === "rename_folder") {
    const from = resolvePath(project, action.from);
    const to   = resolvePath(project, action.to);
    if (!fs.existsSync(from)) throw new Error(`Source folder not found: ${action.from}`);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    return { renamed: true, from: action.from, to: action.to };
  }

  if (action.type === "apply_patch") {
    const patch = action.patch || "";
    if (!patch) throw new Error("Missing required field: patch");

    // Handle multi-file patches by splitting on "diff --git" or "--- a/" headers
    const fileBlocks = [];
    const lines = patch.split("\n");
    let curFile = null;
    let curPatch = [];

    for (const line of lines) {
      if (line.startsWith("diff --git ") || (line.startsWith("--- ") && !line.startsWith("--- /dev/null"))) {
        if (curFile && curPatch.length) fileBlocks.push({ file: curFile, patch: curPatch.join("\n") });
        curPatch = [line];
        curFile = null;
      } else if (line.startsWith("+++ ") && !line.startsWith("+++ /dev/null")) {
        const fp = line.slice(4).replace(/^[ab]\//, "");
        curFile = fp;
        curPatch.push(line);
      } else {
        curPatch.push(line);
      }
    }
    if (curFile && curPatch.length) fileBlocks.push({ file: curFile, patch: curPatch.join("\n") });

    // If no file headers found, apply patch to action.path
    if (fileBlocks.length === 0 && action.path) {
      fileBlocks.push({ file: action.path, patch });
    }

    const results = [];
    for (const block of fileBlocks) {
      try {
        const fp = resolvePath(project, block.file);
        const origContent = fs.existsSync(fp) ? fs.readFileSync(fp, "utf-8") : "";
        const { content, appliedHunks, failedHunks } = applyUnifiedPatch(origContent, block.patch);
        if (appliedHunks > 0) {
          fs.mkdirSync(path.dirname(fp), { recursive: true });
          fs.writeFileSync(fp, content, "utf-8");
          lastWritten.set(project, block.file);
        }
        results.push({ file: block.file, appliedHunks, failedHunks, applied: appliedHunks > 0 });
      } catch (e) {
        results.push({ file: block.file, error: e.message, applied: false });
      }
    }
    return { applied: results.every(r => r.applied), results };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  if (action.type === "search_replace") {
    const fp = resolvePath(project, action.path);
    if (!fs.existsSync(fp)) throw new Error(`File not found: ${action.path}`);
    let content = fs.readFileSync(fp, "utf-8");
    const search  = action.search  ?? "";
    const replace = action.replace ?? "";
    if (!search) throw new Error("Missing required field: search");
    let replacements = 0;
    if (action.replaceAll) {
      const parts = content.split(search);
      replacements = parts.length - 1;
      if (replacements > 0) content = parts.join(replace);
    } else {
      const idx = content.indexOf(search);
      if (idx !== -1) {
        content = content.slice(0, idx) + replace + content.slice(idx + search.length);
        replacements = 1;
      }
    }
    if (replacements > 0) {
      fs.writeFileSync(fp, content, "utf-8");
      lastWritten.set(project, action.path);
    }
    const hint = replacements === 0
      ? `The search string was not found in ${action.path}. Use read_file first to get the exact current content of the file, then copy the exact string you want to replace (including whitespace and indentation).`
      : undefined;
    return { path: action.path, replacements, ...(hint ? { hint } : {}), results: [{ replacements }] };
  }

  if (action.type === "prepend_file") {
    if (action.content === undefined) throw new Error("Missing required field: content");
    const fp = resolvePath(project, action.path);
    if (!fs.existsSync(fp)) throw new Error(`File not found: ${action.path}`);
    const existing = fs.readFileSync(fp, "utf-8");
    const newContent = action.content + existing;
    fs.writeFileSync(fp, newContent, "utf-8");
    lastWritten.set(project, action.path);
    return { path: action.path, written: true, bytes: Buffer.byteLength(newContent, "utf-8"), operation: "prepend" };
  }

  if (action.type === "append_file") {
    if (action.content === undefined) throw new Error("Missing required field: content");
    const fp = resolvePath(project, action.path);
    if (!fs.existsSync(fp)) throw new Error(`File not found: ${action.path}`);
    const existing = fs.readFileSync(fp, "utf-8");
    const newContent = existing + action.content;
    fs.writeFileSync(fp, newContent, "utf-8");
    lastWritten.set(project, action.path);
    return { path: action.path, written: true, bytes: Buffer.byteLength(newContent, "utf-8"), operation: "append" };
  }

  if (action.type === "glob_search") {
    const results = [];
    const pattern = (action.pattern || "").replace(/\*\*/g, "").replace(/\*/g, "").toLowerCase();
    const ext     = action.extension || "";
    const files   = walkFiles(projDir);
    for (const f of files) {
      const name = f.toLowerCase();
      if ((!pattern || name.includes(pattern)) && (!ext || f.endsWith(ext))) results.push(f);
    }
    return { results: results.slice(0, 500), query: action.pattern, total: results.length };
  }

  if (action.type === "grep" || action.type === "grep_search") {
    const pattern = action.pattern || "";
    if (!pattern) throw new Error("Missing required field: pattern");
    const searchDir = action.path ? resolvePath(project, action.path) : projDir;
    const cmd = process.platform === "win32"
      ? `findstr /rns ${JSON.stringify(pattern)} /s *`
      : `grep -rn --include="*" ${JSON.stringify(pattern)} .`;
    const r = await execp(cmd, { cwd: searchDir, timeout: 15000 });
    const lines = (r.stdout || "").split("\n").filter(Boolean).slice(0, 300);
    return { results: lines, pattern, count: lines.length };
  }

  if (action.type === "grep_advanced") {
    const pattern = action.pattern || "";
    if (!pattern) throw new Error("Missing required field: pattern");
    const searchDir = action.path ? resolvePath(project, action.path) : projDir;
    let r;
    if (process.platform === "win32") {
      // findstr on Windows — pattern passed as separate argv, no shell injection
      r = await execFilep("findstr", ["/rns", "/s", pattern, "*"], { cwd: searchDir, timeout: 15000 });
    } else {
      const include = action.include || "*";
      const exclude = action.exclude || "";
      const args = ["-rn"];
      if (include !== "*") args.push(`--include=${include}`);
      if (exclude)         args.push(`--exclude=${exclude}`);
      args.push("--", pattern, ".");
      r = await execFilep("grep", args, { cwd: searchDir, timeout: 15000 });
    }
    const lines = (r.stdout || "").split("\n").filter(Boolean).slice(0, 300);
    return { results: lines, pattern, count: lines.length };
  }

  if (action.type === "search_files") {
    const query = (action.query || "").toLowerCase();
    if (!query) throw new Error("Missing required field: query");
    const results = [];
    const files   = walkFiles(projDir);
    for (const f of files) {
      if (results.length >= 200) break;
      try {
        const fp  = path.join(projDir, f);
        if (isBinary(fp)) continue;
        const content = fs.readFileSync(fp, "utf-8");
        const linesArr = content.split("\n");
        for (let i = 0; i < linesArr.length; i++) {
          if (linesArr[i].toLowerCase().includes(query)) {
            results.push({ file: f, line: i + 1, text: linesArr[i].trim() });
            if (results.length >= 200) break;
          }
        }
      } catch {}
    }
    return { results, query, count: results.length };
  }

  if (action.type === "symbol_search") {
    const symbol = action.symbol || "";
    if (!symbol) throw new Error("Missing required field: symbol");
    const results = [];
    const files   = walkFiles(projDir);
    const patterns = [
      new RegExp(`function\\s+${symbol}\\b`),
      new RegExp(`const\\s+${symbol}\\s*=`),
      new RegExp(`let\\s+${symbol}\\s*=`),
      new RegExp(`var\\s+${symbol}\\s*=`),
      new RegExp(`class\\s+${symbol}\\b`),
      new RegExp(`export\\s+(default\\s+)?function\\s+${symbol}\\b`),
      new RegExp(`export\\s+(default\\s+)?class\\s+${symbol}\\b`),
      new RegExp(`export\\s+const\\s+${symbol}\\s*=`),
      new RegExp(`interface\\s+${symbol}\\b`),
      new RegExp(`type\\s+${symbol}\\s*=`),
    ];
    for (const f of files) {
      if (results.length >= 100) break;
      try {
        const fp  = path.join(projDir, f);
        if (isBinary(fp)) continue;
        const content  = fs.readFileSync(fp, "utf-8");
        const linesArr = content.split("\n");
        for (let i = 0; i < linesArr.length; i++) {
          if (patterns.some(p => p.test(linesArr[i]))) {
            results.push({ file: f, line: i + 1, context: linesArr[i].trim() });
          }
        }
      } catch {}
    }
    return { matches: results, symbol, count: results.length };
  }

  if (action.type === "find_usages") {
    const symbol = action.symbol || "";
    if (!symbol) throw new Error("Missing required field: symbol");
    const results = [];
    const files   = walkFiles(projDir);
    const re      = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    for (const f of files) {
      if (results.length >= 200) break;
      try {
        const fp  = path.join(projDir, f);
        if (isBinary(fp)) continue;
        const content  = fs.readFileSync(fp, "utf-8");
        const linesArr = content.split("\n");
        for (let i = 0; i < linesArr.length; i++) {
          if (re.test(linesArr[i])) {
            results.push({ file: f, line: i + 1, context: linesArr[i].trim() });
          }
        }
      } catch {}
    }
    return { usages: results, symbol, count: results.length };
  }

  if (action.type === "extract_imports") {
    const fp = resolvePath(project, action.path);
    if (!fs.existsSync(fp)) throw new Error(`File not found: ${action.path}`);
    const content = fs.readFileSync(fp, "utf-8");
    return { path: action.path, imports: extractImportsFromContent(content) };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROCESS MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  if (action.type === "start_process" || action.type === "start_process_named") {
    const cmd  = action.command || "";
    const name = action.name || cmd.split(" ")[0];
    if (!cmd) throw new Error("Missing required field: command");

    // Check if name already running (and actually alive, not just recently exited)
    if (namedProcs.has(name)) {
      const existingPid = namedProcs.get(name);
      const existing = runningProcs.get(existingPid);
      if (existing && existing.running !== false) {
        return { started: false, alreadyRunning: true, pid: existingPid, name };
      }
      // Dead process — remove and allow restart
      namedProcs.delete(name);
    }

    const cwd  = resolveCwd(projDir, action.cwd);
    const proc = spawn(cmd, { shell: true, cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    const entry = { proc, name, command: cmd, project, cwd, startedAt: Date.now(), stdout: [], stderr: [] };
    runningProcs.set(proc.pid, entry);
    namedProcs.set(name, proc.pid);
    proc.stdout.on("data", d => {
      const s = d.toString(); entry.stdout.push(s);
      if (entry.stdout.length > 500) entry.stdout.shift();
      process.stdout.write(`[${project}:${name}] ${s}`);
    });
    proc.stderr.on("data", d => {
      const s = d.toString(); entry.stderr.push(s);
      if (entry.stderr.length > 200) entry.stderr.shift();
    });
    proc.on("exit", code => {
      log("info", `Process ${proc.pid} (${name}) exited code=${code}`);
      // Keep entry for 60s so monitor_process can still report exit status
      if (runningProcs.has(proc.pid)) runningProcs.get(proc.pid).running = false;
      setTimeout(() => {
        runningProcs.delete(proc.pid);
        if (namedProcs.get(name) === proc.pid) namedProcs.delete(name);
      }, 60000);
    });
    proc.on("error", e => {
      log("error", `Process spawn error: ${e.message}`);
      if (runningProcs.has(proc.pid)) runningProcs.get(proc.pid).running = false;
      setTimeout(() => {
        runningProcs.delete(proc.pid);
        if (namedProcs.get(name) === proc.pid) namedProcs.delete(name);
      }, 60000);
    });
    return { pid: proc.pid, command: cmd, name, started: true };
  }

  if (action.type === "kill_process") {
    const name = action.name;
    const pid  = action.pid;

    // Kill by name
    if (name) {
      const namedPid = namedProcs.get(name);
      if (namedPid && runningProcs.has(namedPid)) {
        const entry = runningProcs.get(namedPid);
        try { entry.proc.kill("SIGTERM"); } catch {}
        runningProcs.delete(namedPid);
        namedProcs.delete(name);
        return { killed: true, pid: namedPid, name };
      }
      // Try partial name match
      for (const [p, e] of runningProcs) {
        if (e.name.includes(name) || e.command.includes(name)) {
          try { e.proc.kill("SIGTERM"); } catch {}
          runningProcs.delete(p);
          if (namedProcs.get(e.name) === p) namedProcs.delete(e.name);
          return { killed: true, pid: p, name: e.name };
        }
      }
      return { killed: false, reason: `No process named "${name}" found` };
    }

    // Kill by PID
    if (pid) {
      const entry = runningProcs.get(pid);
      if (entry) {
        try { entry.proc.kill("SIGTERM"); } catch {}
        runningProcs.delete(pid);
        if (namedProcs.get(entry.name) === pid) namedProcs.delete(entry.name);
        return { killed: true, pid };
      }
      try { process.kill(pid, "SIGTERM"); return { killed: true, pid }; } catch (e) {
        return { killed: false, reason: e.message };
      }
    }
    throw new Error("Missing required field: name or pid");
  }

  if (action.type === "list_processes") {
    const procs = [];
    for (const [pid, e] of runningProcs) {
      if (e.running === false) continue; // skip recently-exited entries
      procs.push({ pid, name: e.name, command: e.command, project: e.project,
        uptimeSec: Math.floor((Date.now() - e.startedAt) / 1000),
        lastLog: (e.stdout[e.stdout.length - 1] || "").slice(0, 200) });
    }
    return { processes: procs };
  }

  if (action.type === "monitor_process") {
    const name = action.name;
    const pid  = action.pid;
    let entry = null;
    let foundPid = null;

    if (name && namedProcs.has(name)) { foundPid = namedProcs.get(name); entry = runningProcs.get(foundPid); }
    else if (pid && runningProcs.has(pid)) { foundPid = pid; entry = runningProcs.get(pid); }

    if (!entry) return { found: false, name: name || null, pid: pid || null, running: false };

    const isRunning = entry.running !== false; // default true, set to false on exit
    return {
      found: true, running: isRunning,
      pid: foundPid, name: entry.name, command: entry.command,
      uptimeMs: Date.now() - entry.startedAt,
      uptimeSec: Math.floor((Date.now() - entry.startedAt) / 1000),
      lastLog: (entry.stdout.slice(-3).join("") || "").slice(0, 500),
      exitedRecently: !isRunning,
    };
  }

  if (action.type === "get_process_logs") {
    const name  = action.name;
    const lines = parseInt(action.lines || "100", 10);
    let entry = null;

    if (name && namedProcs.has(name)) {
      entry = runningProcs.get(namedProcs.get(name));
    } else if (action.pid && runningProcs.has(action.pid)) {
      entry = runningProcs.get(action.pid);
    } else if (name) {
      for (const [, e] of runningProcs) {
        if (e.name === name || e.command.includes(name)) { entry = e; break; }
      }
    }

    if (!entry) return { found: false, logs: [], hint: "Use start_process or start_process_named to start a process first" };

    const allLogs = [...entry.stdout, ...entry.stderr].join("").split("\n");
    const tail = allLogs.slice(-lines);
    return { found: true, name: entry.name, pid: namedProcs.get(entry.name), logs: tail, totalLines: allLogs.length };
  }

  if (action.type === "stop_all_processes") {
    const stopped = [];
    for (const [pid, e] of runningProcs) {
      try { e.proc.kill("SIGTERM"); } catch {}
      stopped.push({ pid, name: e.name, command: e.command });
    }
    runningProcs.clear();
    namedProcs.clear();
    return { stopped, count: stopped.length };
  }

  if (action.type === "restart_dev_server") {
    const name = action.name || "devserver";
    const namedPid = namedProcs.get(name);
    let cmd = action.command;

    if (namedPid && runningProcs.has(namedPid)) {
      const existing = runningProcs.get(namedPid);
      if (!cmd) cmd = existing.command;
      try { existing.proc.kill("SIGTERM"); } catch {}
      runningProcs.delete(namedPid);
      namedProcs.delete(name);
      await new Promise(r => setTimeout(r, 500));
    }

    if (!cmd) cmd = "npm run dev";
    const cwd  = resolveCwd(projDir, action.cwd);
    const proc = spawn(cmd, { shell: true, cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    const entry = { proc, name, command: cmd, project, cwd, startedAt: Date.now(), stdout: [], stderr: [] };
    runningProcs.set(proc.pid, entry);
    namedProcs.set(name, proc.pid);
    proc.stdout.on("data", d => { const s = d.toString(); entry.stdout.push(s); if (entry.stdout.length > 500) entry.stdout.shift(); });
    proc.stderr.on("data", d => { const s = d.toString(); entry.stderr.push(s); if (entry.stderr.length > 200) entry.stderr.shift(); });
    proc.on("exit", code => { runningProcs.delete(proc.pid); if (namedProcs.get(name) === proc.pid) namedProcs.delete(name); });
    proc.on("error", e => { runningProcs.delete(proc.pid); if (namedProcs.get(name) === proc.pid) namedProcs.delete(name); });
    return { restarted: true, oldPid: namedPid || null, newPid: proc.pid, name, command: cmd };
  }

  if (action.type === "list_open_ports") {
    let cmd;
    if (process.platform === "win32") cmd = "netstat -ano";
    else cmd = "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null";
    const r = await execp(cmd, { timeout: 10000 });
    const ports = [];
    if (process.platform === "win32") {
      for (const line of (r.stdout || "").split("\n")) {
        const m = line.match(/(?:TCP|UDP)\s+[\d.:*]+:(\d+)\s+[\d.:*]+\s+\w+\s+(\d+)/i);
        if (m) ports.push({ port: parseInt(m[1]), pid: parseInt(m[2]) });
      }
    } else {
      for (const line of (r.stdout || "").split("\n")) {
        const m = line.match(/:(\d{2,5})\s+.*?(?:pid=(\d+))?/);
        if (m && parseInt(m[1]) > 0) ports.push({ port: parseInt(m[1]), pid: m[2] ? parseInt(m[2]) : null });
      }
    }
    // Add known running procs
    for (const [pid, e] of runningProcs) {
      for (const line of e.stdout) {
        const m = line.match(/localhost:(\d{4,5})/);
        if (m) {
          const port = parseInt(m[1]);
          if (!ports.find(p => p.port === port)) {
            ports.push({ port, pid, name: e.name });
          }
        }
      }
    }
    return { ports: ports.slice(0, 100) };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHELL / BUILD COMMANDS
  // ─────────────────────────────────────────────────────────────────────────

  if (action.type === "run_command") {
    const cmd = action.command || "";
    if (!cmd) throw new Error("Missing required field: command");
    const cwd = resolveCwd(projDir, action.cwd);
    const r   = await execp(cmd, { cwd, timeout: 120000 });
    const out = truncateLines(r.stdout);
    const err = truncateLines(r.stderr, 200);
    return {
      command: cmd, stdout: out.output, stderr: err.output,
      exitCode: r.exitCode ?? 0, timedOut: r.timedOut || false,
      truncated: out.truncated, totalLines: out.totalLines,
    };
  }

  if (action.type === "run_command_advanced") {
    const cmd = action.command || "";
    if (!cmd) throw new Error("Missing required field: command");
    const cwd = resolveCwd(projDir, action.cwd);
    const env = action.env ? { ...process.env, ...action.env } : undefined;
    const r   = await execp(cmd, { cwd, timeout: action.timeout || 120000, env });
    const out = truncateLines(r.stdout);
    return {
      command: cmd, stdout: out.output, stderr: r.stderr.slice(0, 4000),
      exitCode: r.exitCode ?? 0, timedOut: r.timedOut || false,
      truncated: out.truncated, cwd: path.relative(projDir, cwd) || ".",
    };
  }

  if (action.type === "install_deps") {
    const cwd = projDir;
    const pm  = detectPkgManager(cwd);
    const cmd = pm === "pnpm" ? "pnpm install" : pm === "yarn" ? "yarn install" : pm === "bun" ? "bun install" : "npm install";
    const r   = await execp(cmd, { cwd, timeout: 300000 });
    return { command: cmd, packageManager: pm, stdout: r.stdout.slice(-3000), stderr: r.stderr.slice(-1000), exitCode: r.exitCode ?? 0 };
  }

  if (action.type === "add_dependency") {
    const pkg = validatePkgName(action.package || action.pkg || "");
    const isDev = action.dev || false;
    const pm    = detectPkgManager(projDir);
    // execFilep: pkg is a separate argv element — no shell injection possible
    const devFlag = isDev ? (pm === "npm" ? "--save-dev" : "-D") : null;
    const baseArgs = pm === "pnpm" ? ["add"] : pm === "yarn" ? ["add"] : pm === "bun" ? ["add"] : ["install"];
    const args = [...baseArgs, ...(devFlag ? [devFlag] : []), pkg];
    const r = await execFilep(pm, args, { cwd: projDir, timeout: 120000 });
    const vMatch = (r.stdout + r.stderr).match(new RegExp(`${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@([\\d.]+)`));
    return { installed: (r.exitCode ?? 0) === 0, package: pkg, version: vMatch ? vMatch[1] : null, stdout: r.stdout.slice(-1000) };
  }

  if (action.type === "remove_dependency") {
    const pkg = validatePkgName(action.package || action.pkg || "");
    const pm  = detectPkgManager(projDir);
    const sub = pm === "npm" ? "uninstall" : "remove";
    const r   = await execFilep(pm, [sub, pkg], { cwd: projDir, timeout: 60000 });
    return { removed: (r.exitCode ?? 0) === 0, package: pkg, stdout: r.stdout.slice(-500) };
  }

  if (action.type === "type_check") {
    const r = await execp("npx tsc --noEmit 2>&1", { cwd: projDir, timeout: 60000 });
    const output = r.stdout || r.stderr || "";
    const errors = output.split("\n").filter(l => l.includes(": error TS"));
    return {
      checked: true, passed: errors.length === 0, errorCount: errors.length,
      errors: errors.slice(0, 50).map(line => {
        const m = line.match(/(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)/);
        return m ? { file: m[1], line: parseInt(m[2]), col: parseInt(m[3]), code: m[4], message: m[5] } : { raw: line };
      }),
      stdout: output.slice(0, 3000),
    };
  }

  if (action.type === "lint_and_fix") {
    // execFilep: each path is a separate argv element — no shell injection
    const paths = action.paths && action.paths.length ? action.paths : ["."];
    const r = await execFilep("npx", ["eslint", "--fix", ...paths], { cwd: projDir, timeout: 60000 });
    const output = (r.stdout || "") + (r.stderr || "");
    const errLines = output.split("\n").filter(l => l.includes("error") || l.includes("warning")).slice(0, 50);
    return { linted: true, fixed: (r.exitCode ?? 0) === 0, output: output.slice(0, 3000), issues: errLines };
  }

  if (action.type === "format_files") {
    const paths = action.paths && action.paths.length ? action.paths : ["."];
    const r = await execFilep("npx", ["prettier", "--write", ...paths], { cwd: projDir, timeout: 30000 });
    const formatted = (r.stdout || "").split("\n").filter(l => l.trim()).length;
    return { formatted: (r.exitCode ?? 0) === 0, fileCount: formatted, stdout: r.stdout.slice(0, 1000) };
  }

  if (action.type === "build_project") {
    const pm   = detectPkgManager(projDir);
    const cmd  = action.command || (pm === "pnpm" ? "pnpm build" : pm === "yarn" ? "yarn build" : "npm run build");
    const r    = await execp(cmd + " 2>&1", { cwd: projDir, timeout: 300000 });
    const out  = truncateLines(r.stdout);
    return { built: (r.exitCode ?? 0) === 0, command: cmd, stdout: out.output, exitCode: r.exitCode, truncated: out.truncated };
  }

  if (action.type === "run_tests") {
    const pm  = detectPkgManager(projDir);
    const cmd = action.command || (pm === "pnpm" ? "pnpm test" : pm === "yarn" ? "yarn test" : "npm test");
    const r   = await execp(cmd + " 2>&1", { cwd: projDir, timeout: 180000 });
    const out = truncateLines(r.stdout);
    return { passed: (r.exitCode ?? 0) === 0, command: cmd, stdout: out.output, exitCode: r.exitCode, truncated: out.truncated };
  }

  if (action.type === "get_build_metrics") {
    const distDir = path.join(projDir, "dist");
    const buildDir = path.join(projDir, "build");
    const outDir = fs.existsSync(distDir) ? distDir : fs.existsSync(buildDir) ? buildDir : null;
    if (!outDir) return { success: false, reason: "No dist/ or build/ folder found. Run build_project first." };
    const files = [];
    let totalBytes = 0;
    const allFiles = walkFiles(outDir);
    for (const f of allFiles) {
      try {
        const st = fs.statSync(path.join(outDir, f));
        files.push({ path: f, kb: Math.round(st.size / 1024 * 10) / 10 });
        totalBytes += st.size;
      } catch {}
    }
    files.sort((a, b) => b.kb - a.kb);
    return { totalKb: Math.round(totalBytes / 1024), files: files.slice(0, 20), fileCount: files.length };
  }

  if (action.type === "validate_change") {
    const tsc  = await execp("npx tsc --noEmit 2>&1", { cwd: projDir, timeout: 60000 });
    const eslint = await execp("npx eslint . --max-warnings=0 2>&1", { cwd: projDir, timeout: 60000 });
    const typeErrors = (tsc.stdout || "").split("\n").filter(l => l.includes(": error TS")).length;
    const lintErrors = (eslint.stdout || "").split("\n").filter(l => / error /.test(l)).length;
    return {
      passed: typeErrors === 0 && lintErrors === 0,
      typeCheck: { errors: typeErrors, output: tsc.stdout.slice(0, 1000) },
      lint:      { errors: lintErrors, output: eslint.stdout.slice(0, 1000) },
    };
  }

  if (action.type === "security_scan") {
    const r = await execp("npm audit --json 2>&1", { cwd: projDir, timeout: 60000 });
    try {
      const data = JSON.parse(r.stdout);
      const vuln = data.metadata?.vulnerabilities || data.vulnerabilities || {};
      return { scanned: true, vulnerabilities: vuln, summary: `${Object.values(vuln).reduce((a, b) => a + b, 0)} vulnerabilities found` };
    } catch {
      return { scanned: false, reason: "npm audit did not return parseable JSON", output: r.stdout.slice(0, 500) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PACKAGE.JSON / ENV OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  if (action.type === "update_package_json") {
    const fp  = path.join(projDir, "package.json");
    let pkg   = {};
    try { pkg = JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { throw new Error("package.json not found or invalid JSON"); }
    // Deep-merge: recursively merge nested objects (e.g. scripts, dependencies, devDependencies)
    function deepMerge(target, source) {
      for (const key of Object.keys(source)) {
        if (source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key]) &&
            target[key] !== null && typeof target[key] === "object" && !Array.isArray(target[key])) {
          target[key] = deepMerge({ ...target[key] }, source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    }
    pkg = deepMerge(pkg, action.fields || {});
    fs.writeFileSync(fp, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
    return { updated: true, fields: action.fields };
  }

  if (action.type === "manage_scripts") {
    const fp  = path.join(projDir, "package.json");
    let pkg   = {};
    try { pkg = JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { throw new Error("package.json not found or invalid JSON"); }
    pkg.scripts = { ...pkg.scripts, ...action.scripts };
    fs.writeFileSync(fp, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
    return { updated: true, scripts: pkg.scripts };
  }

  if (action.type === "get_env_vars") {
    const fp = path.join(projDir, ".env");
    return { vars: parseDotEnv(fp), envFile: fp };
  }

  if (action.type === "set_env_var") {
    const key = action.key || "";
    const val = action.value !== undefined ? String(action.value) : "";
    if (!key) throw new Error("Missing required field: key");
    const fp   = path.join(projDir, ".env");
    const vars = parseDotEnv(fp);
    vars[key]  = val;
    writeDotEnv(fp, vars);
    return { set: true, key, value: val };
  }

  if (action.type === "get_preview_url") {
    const port      = (await findDevPortActive(project)) || PREVIEW_PORT;
    const basePath  = action.path || "";  // optional sub-path e.g. "/dashboard"
    const url       = `http://localhost:${port}${basePath}`;
    return { url, port, project, basePath: basePath || "/",
      detected: port !== PREVIEW_PORT ? "netstat-scan" : "env-fallback",
      note: "URL is local to the Windows machine running the connector" };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GIT OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  if (action.type === "git_status") {
    const r = await execp("git status --short", { cwd: projDir, timeout: 10000 });
    return { status: r.stdout, changed: r.stdout.trim().length > 0 };
  }

  if (action.type === "git_diff") {
    // execFilep: all args are separate argv elements — no shell injection
    const args = ["diff"];
    if (action.staged) args.push("--cached");
    if (action.path)   args.push("--", action.path);
    const r = await execFilep("git", args, { cwd: projDir, timeout: 15000 });
    return { diff: r.stdout.slice(0, 100000), changed: r.stdout.trim().length > 0 };
  }

  if (action.type === "git_add") {
    const raw = action.files || action.paths || ".";
    const fileList = Array.isArray(raw) ? raw : [raw];
    // execFilep avoids shell — each path is a separate argv element, no injection possible
    const r = await execFilep("git", ["add", "--", ...fileList], { cwd: projDir, timeout: 15000 });
    return { added: true, targets: raw, stderr: r.stderr.slice(0, 200) };
  }

  if (action.type === "git_commit") {
    const msg = action.message || "chore: update";
    const r   = await execp(`git commit -m ${JSON.stringify(msg)}`, { cwd: projDir, timeout: 15000 });
    // Windows: git may write to stderr even on success; combine both streams
    const combined = r.stdout + r.stderr;
    const combinedLower = combined.toLowerCase();
    // Detect "nothing to commit" from any stream or non-zero exit
    if (combinedLower.includes("nothing to commit") || combinedLower.includes("nothing added to commit") ||
        (r.exitCode !== 0 && (combinedLower.includes("nothing") || !combined.trim()))) {
      return { committed: false, reason: "nothing to commit", message: msg };
    }
    // Non-zero exit with actual error
    if (r.exitCode !== 0) {
      return { committed: false, reason: (r.stderr || r.stdout).trim().slice(0, 200), message: msg };
    }
    // Extract hash — git writes e.g. [main abc1234] on either stream
    const hashMatch = combined.match(/\[[\w/.-]+\s+([a-f0-9]{6,40})\]/);
    return { committed: true, message: msg, hash: hashMatch ? hashMatch[1] : null, output: combined.trim() };
  }

  if (action.type === "git_log") {
    const count   = Math.min(parseInt(action.count || action.limit || "10", 10), 100);
    const format  = "--format=%H|%an|%ai|%s";
    const r       = await execp(`git log ${format} -${count}`, { cwd: projDir, timeout: 10000 });
    const entries = r.stdout.split("\n").filter(Boolean).map(line => {
      const [hash, author, date, ...msgParts] = line.split("|");
      return { hash, author, date, message: msgParts.join("|") };
    });
    return { log: entries, count: entries.length };
  }

  if (action.type === "git_push") {
    const remote = validateGitRef(action.remote || "origin", "remote");
    const branch = action.branch ? validateGitRef(action.branch, "branch") : null;
    const args = ["push", remote, ...(branch ? [branch] : [])];
    const r = await execFilep("git", args, { cwd: projDir, timeout: 60000 });
    return { pushed: (r.exitCode ?? 0) === 0, output: r.stdout + r.stderr };
  }

  if (action.type === "git_pull") {
    const remote = validateGitRef(action.remote || "origin", "remote");
    const r = await execFilep("git", ["pull", remote], { cwd: projDir, timeout: 60000 });
    return { pulled: (r.exitCode ?? 0) === 0, output: r.stdout + r.stderr };
  }

  if (action.type === "git_branch") {
    const r = await execp("git branch -a", { cwd: projDir, timeout: 10000 });
    const branches = r.stdout.split("\n").filter(Boolean).map(b => b.trim().replace(/^\* /, ""));
    const current  = r.stdout.split("\n").find(b => b.startsWith("* "));
    return { branches, current: current ? current.replace("* ", "").trim() : null };
  }

  if (action.type === "git_checkout") {
    const branch = validateGitRef(action.branch || "", "branch");
    const args = action.create ? ["checkout", "-b", branch] : ["checkout", branch];
    const r = await execFilep("git", args, { cwd: projDir, timeout: 15000 });
    const ok = (r.exitCode ?? 0) === 0;
    return { checkedOut: ok, branch, output: r.stdout + r.stderr, error: ok ? null : r.stderr.slice(0, 300) };
  }

  if (action.type === "git_merge") {
    const branch = validateGitRef(action.branch || "", "branch");
    const r = await execFilep("git", ["merge", branch], { cwd: projDir, timeout: 30000 });
    const conflicts = (r.stdout + r.stderr).includes("CONFLICT");
    return { merged: !conflicts && (r.exitCode ?? 0) === 0, branch, conflicts: conflicts ? [] : null, output: r.stdout.slice(0, 1000) };
  }

  if (action.type === "git_stash") {
    const args = action.message ? ["stash", "push", "-m", action.message] : ["stash"];
    const r   = await execFilep("git", args, { cwd: projDir, timeout: 15000 });
    const ok  = (r.exitCode ?? 0) === 0 && !r.stdout.includes("No local changes");
    return { stashed: ok, message: r.stdout.trim(), reason: ok ? null : "nothing to stash" };
  }

  if (action.type === "git_stash_pop") {
    const r = await execFilep("git", ["stash", "pop"], { cwd: projDir, timeout: 15000 });
    return { popped: (r.exitCode ?? 0) === 0, output: r.stdout + r.stderr };
  }

  if (action.type === "git_reset") {
    const mode = validateResetMode(action.mode);
    const ref  = validateGitRef(action.ref || "HEAD~1", "ref");
    const r    = await execFilep("git", ["reset", "--" + mode, ref], { cwd: projDir, timeout: 15000 });
    const ok   = (r.exitCode ?? 0) === 0;
    return { reset: ok, mode, ref, output: r.stdout + r.stderr, error: ok ? null : r.stderr.slice(0, 200) };
  }

  if (action.type === "git_revert") {
    const commit = validateGitRef(action.commit || "HEAD", "commit");
    const r      = await execFilep("git", ["revert", commit, "--no-edit"], { cwd: projDir, timeout: 15000 });
    return { reverted: (r.exitCode ?? 0) === 0, commit, output: r.stdout + r.stderr };
  }

  if (action.type === "git_tag") {
    if (action.tag) {
      const tag = validateGitRef(action.tag, "tag");
      const r = await execFilep("git", ["tag", tag], { cwd: projDir, timeout: 10000 });
      return { tagged: (r.exitCode ?? 0) === 0, tag };
    }
    const r = await execFilep("git", ["tag", "-l"], { cwd: projDir, timeout: 10000 });
    return { tags: r.stdout.split("\n").filter(Boolean) };
  }

  if (action.type === "git_init") {
    const r = await execp("git init", { cwd: projDir, timeout: 10000 });
    const alreadyInit = r.stdout.includes("Reinitialized") || r.stderr.includes("Reinitialized");
    return { initialized: true, alreadyExisted: alreadyInit, output: r.stdout };
  }

  if (action.type === "rollback_last_change") {
    const filePath = action.path || lastWritten.get(project);
    if (!filePath) return { rolledBack: false, reason: "No recent file change tracked. Pass path explicitly." };
    // execFilep: filePath is a separate argv element — no shell injection
    const r = await execFilep("git", ["checkout", "HEAD", "--", filePath], { cwd: projDir, timeout: 10000 });
    if (r.exitCode && r.exitCode !== 0) return { rolledBack: false, reason: r.stderr.slice(0, 200) };
    return { rolledBack: true, path: filePath };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANALYSIS OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  if (action.type === "detect_structure") {
    return detectStructure(projDir);
  }

  if (action.type === "project_analyze") {
    const structure = detectStructure(projDir);
    const files     = walkFiles(projDir);
    let log = "";
    try {
      const r = await execp("git log --format=%H|%an|%ai|%s -5", { cwd: projDir, timeout: 10000 });
      log = r.stdout;
    } catch {}
    // Find TODOs
    const todos = [];
    for (const f of files.slice(0, 100)) {
      try {
        const content = fs.readFileSync(path.join(projDir, f), "utf-8");
        const lines   = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (/TODO|FIXME|HACK|XXX/.test(lines[i])) todos.push({ file: f, line: i + 1, text: lines[i].trim() });
        }
      } catch {}
    }
    return { ...structure, totalFiles: files.length, recentCommits: log, todos: todos.slice(0, 20) };
  }

  if (action.type === "component_tree") {
    const files = walkFiles(projDir).filter(f => /\.(tsx|jsx|svelte|vue)$/.test(f));
    const components = [];
    const patterns = [
      /export\s+default\s+function\s+(\w+)/,
      /export\s+function\s+(\w+)/,
      /export\s+const\s+(\w+)\s*=\s*(?:React\.)?(?:memo|forwardRef|lazy|styled\.?\w*)\s*[(<(]/,
      /export\s+const\s+(\w+)\s*:\s*(?:React\.)?(?:FC|FunctionComponent|ComponentType)/,
      /export\s+default\s+(?:memo|forwardRef)\s*\(\s*function\s+(\w+)/,
      /export\s+default\s+class\s+(\w+)/,
    ];
    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(projDir, f), "utf-8");
        const lines   = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          for (const p of patterns) {
            const m = lines[i].match(p);
            if (m) { components.push({ name: m[1], file: f, line: i + 1 }); break; }
          }
        }
      } catch {}
    }
    return { components, count: components.length };
  }

  if (action.type === "extract_theme") {
    const result = { colors: {}, spacing: {}, fonts: {}, fromFiles: [] };
    // Try tailwind config
    for (const cfgName of ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs"]) {
      const cfgPath = path.join(projDir, cfgName);
      if (fs.existsSync(cfgPath)) {
        result.fromFiles.push(cfgName);
        const content = fs.readFileSync(cfgPath, "utf-8");
        const colorMatch = content.match(/colors:\s*\{([^}]+)\}/s);
        if (colorMatch) result.colors.tailwind = colorMatch[1].slice(0, 500);
      }
    }
    // CSS variables
    const cssFiles = walkFiles(projDir).filter(f => /\.(css|scss|sass)$/.test(f));
    for (const f of cssFiles) {
      try {
        const content = fs.readFileSync(path.join(projDir, f), "utf-8");
        const vars    = [...content.matchAll(/--[\w-]+:\s*([^;]+);/g)].map(m => m[0]);
        if (vars.length) { result.fromFiles.push(f); result.cssVars = vars.slice(0, 50); }
      } catch {}
    }
    return result;
  }

  if (action.type === "extract_colors") {
    const colorMap = {};
    const files    = walkFiles(projDir).filter(f => /\.(tsx|jsx|ts|js|css|scss|html|vue|svelte)$/.test(f));
    const hexRe    = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
    const rgbRe    = /(?:rgba?|hsla?)\([^)]+\)/g;
    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(projDir, f), "utf-8");
        for (const m of [...content.matchAll(hexRe), ...content.matchAll(rgbRe)]) {
          const val = m[0]; if (!colorMap[val]) colorMap[val] = []; colorMap[val].push(f);
        }
      } catch {}
    }
    const colors = Object.entries(colorMap).map(([value, files]) => ({ value, type: value.startsWith("#") ? "hex" : "function", files: [...new Set(files)].slice(0, 5) }));
    return { colors: colors.slice(0, 200), count: colors.length };
  }

  if (action.type === "dependency_graph") {
    const entryFile = action.path
      ? resolvePath(project, action.path)
      : ["src/index.tsx","src/index.ts","src/main.tsx","src/main.ts","src/App.tsx","index.js","index.ts"]
        .map(f => path.join(projDir, f)).find(f => fs.existsSync(f));

    if (!entryFile) return { graph: {}, reason: "No entry file found. Pass path explicitly." };

    const graph    = {};
    const circular = [];
    const visited  = new Set();

    function trace(fp, depth) {
      if (depth > 3 || visited.has(fp)) { if (visited.has(fp)) circular.push(fp); return; }
      visited.add(fp);
      try {
        const content = fs.readFileSync(fp, "utf-8");
        const imports = extractImportsFromContent(content)
          .filter(i => i.module.startsWith("."))
          .map(i => {
            const base = path.dirname(fp);
            let resolved = path.resolve(base, i.module);
            for (const ext of ["", ".ts", ".tsx", ".js", ".jsx"]) {
              if (fs.existsSync(resolved + ext)) return resolved + ext;
              if (fs.existsSync(path.join(resolved, "index" + ext))) return path.join(resolved, "index" + ext);
            }
            return null;
          }).filter(Boolean);
        const relKey = path.relative(projDir, fp);
        graph[relKey] = imports.map(i => path.relative(projDir, i));
        for (const imp of imports) trace(imp, depth + 1);
      } catch {}
    }

    trace(entryFile, 0);
    return { graph, circular: [...new Set(circular)].map(f => path.relative(projDir, f)) };
  }

  if (action.type === "dead_code_detection") {
    const files   = walkFiles(projDir).filter(f => /\.(tsx?|jsx?)$/.test(f));
    const exports = {}; // file → [exportName]
    const imports = {}; // exportName → bool (used)

    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(projDir, f), "utf-8");
        const exRe    = /export\s+(?:const|function|class|default\s+function)\s+(\w+)/g;
        let m;
        while ((m = exRe.exec(content)) !== null) {
          if (!exports[f]) exports[f] = [];
          exports[f].push(m[1]);
        }
      } catch {}
    }
    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(projDir, f), "utf-8");
        const impRe   = /import\s+.*?(?:\{([^}]+)\}|(\w+))\s+from/g;
        let m;
        while ((m = impRe.exec(content)) !== null) {
          const names = m[1] ? m[1].split(",").map(n => n.trim().split(" as ")[0].trim()) : [m[2]];
          for (const n of names) if (n) imports[n] = true;
        }
      } catch {}
    }
    const unused = [];
    for (const [file, exps] of Object.entries(exports)) {
      for (const exp of exps) {
        if (!imports[exp] && exp !== "default") unused.push({ file, export: exp });
      }
    }
    return { unused: unused.slice(0, 100), totalChecked: files.length };
  }

  if (action.type === "tailwind_audit") {
    const files   = walkFiles(projDir).filter(f => /\.(tsx?|jsx?|html|vue|svelte)$/.test(f));
    const classes = {};
    const classRe = /className=["'`]([^"'`]+)["'`]/g;
    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(projDir, f), "utf-8");
        let m;
        while ((m = classRe.exec(content)) !== null) {
          for (const cls of m[1].split(/\s+/)) {
            if (cls) classes[cls] = (classes[cls] || 0) + 1;
          }
        }
      } catch {}
    }
    const configExists = fs.existsSync(path.join(projDir, "tailwind.config.js")) ||
                         fs.existsSync(path.join(projDir, "tailwind.config.ts"));
    return { totalClasses: Object.keys(classes).length, topClasses: Object.entries(classes).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([cls,count])=>({cls,count})), configFound: configExists };
  }

  if (action.type === "list_tree_filtered") {
    const ext   = action.extension || "";
    const query = (action.query || "").toLowerCase();
    const files = walkFiles(projDir).filter(f => (!ext || f.endsWith(ext)) && (!query || f.toLowerCase().includes(query)));
    return { files: files.slice(0, 500), total: files.length };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREENSHOT
  // ─────────────────────────────────────────────────────────────────────────

  if (action.type === "screenshot_preview") {
    const chromePath = findChrome();
    if (!chromePath) {
      return { captured: false, screenshotUrl: _lastScreenshotUrl || null, error: "Chrome/Chromium not found. Install Chrome or set CHROME_PATH." };
    }
    let targetUrl = action.url || "";
    if (!targetUrl) {
      const autoPort = (await findDevPortActive(project)) || PREVIEW_PORT;
      targetUrl = `http://localhost:${autoPort}${project ? "/" + project : ""}`;
    }
    const waitMs  = Math.max(action.waitMs || 3000, 1000);
    const tmpFile = path.join(os.tmpdir(), `lamby-ss-${Date.now()}.png`);
    log("info", `SCREENSHOT → ${targetUrl} wait=${waitMs}ms`);
    return new Promise((resolve) => {
      const args = [
        "--headless=new", "--no-sandbox", "--disable-gpu",
        "--disable-dev-shm-usage", "--disable-extensions",
        `--screenshot=${tmpFile}`, "--window-size=1280,800",
        `--virtual-time-budget=${waitMs}`,
        ...(action.fullPage ? ["--run-all-compositor-stages-before-draw"] : []),
        targetUrl,
      ];
      const proc = spawn(chromePath, args, { stdio: "pipe" });
      const killTimer = setTimeout(() => { try { proc.kill(); } catch {} }, 40000);
      proc.on("close", async () => {
        clearTimeout(killTimer);
        if (!fs.existsSync(tmpFile)) {
          resolve({ captured: false, screenshotUrl: _lastScreenshotUrl || null, error: "Chrome exited without producing a screenshot. Is the dev server running?" });
          return;
        }
        try {
          // Read PNG as base64 immediately — relay stores it and serves at /api/screenshot-data/
          // This is reliable and has no external network dependency.
          const pngBuf    = fs.readFileSync(tmpFile);
          const pngBase64 = pngBuf.toString("base64");
          const pngHash   = crypto.createHash("sha256").update(pngBuf).digest("hex");
          // Upload to catbox only when the screenshot actually changed — no point uploading identical frames
          if (pngHash !== _lastUploadedHash) {
            _lastUploadedHash = pngHash;
            uploadToCatbox(tmpFile)
              .then(url => { _lastScreenshotUrl = url; })
              .catch(() => { /* catbox failed silently — relay-served URL is the primary */ })
              .finally(() => { try { fs.unlinkSync(tmpFile); } catch {} });
          } else {
            try { fs.unlinkSync(tmpFile); } catch {}
          }
          resolve({ captured: true, screenshotBase64: pngBase64, mimeType: "image/png", screenshotUrl: _lastScreenshotUrl || null });
        } catch (e) {
          try { fs.unlinkSync(tmpFile); } catch {}
          resolve({ captured: false, screenshotUrl: _lastScreenshotUrl || null, error: `Screenshot read failed: ${e.message}` });
        }
      });
      proc.on("error", e => {
        clearTimeout(killTimer);
        resolve({ captured: false, screenshotUrl: _lastScreenshotUrl || null, error: `Chrome spawn error: ${e.message}` });
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 3 — Requires browser/Electron/AI: return helpful error, never throw
  // ─────────────────────────────────────────────────────────────────────────

  const UNSUPPORTED = {
    browser_interact:    { reason: "browser_interact requires the full Electron desktop app with embedded Chromium DevTools Protocol access", hint: "Use screenshot_preview to capture the current UI, and search_replace/write_file to make code changes" },
    capture_preview:     { reason: "capture_preview requires a Windows Electron app with spawnSync Chrome — use the relay's /api/screenshot-url endpoint instead", hint: "GET /api/screenshot-url/KEY/PROJECT_NAME?fullPage=true&waitMs=30000" },
    capture_component:   { reason: "capture_component requires the Electron desktop app", hint: "Use GET /api/screenshot-url/KEY/PROJECT_NAME for screenshots" },
    get_dom_snapshot:    { reason: "get_dom_snapshot requires a running browser with DevTools Protocol access", hint: "Use get_preview_url to get the URL then inspect manually, or use grep_search to find DOM elements in source" },
    get_console_errors:  { reason: "get_console_errors requires a running browser with DevTools Protocol access", hint: "Use get_process_logs to get the dev server output, or run_command to execute 'npm run build' and see compile errors" },
    visual_diff:         { reason: "visual_diff requires two screenshots and image diffing — not available in standalone mode", hint: "Take screenshots before and after with screenshot_preview" },
    accessibility_audit: { reason: "accessibility_audit requires axe-core running in a real browser", hint: "Install axe and run via run_command: npx axe-cli http://localhost:PORT" },
    bundle_analyzer:     { reason: "bundle_analyzer requires a browser to display the interactive treemap", hint: "Use get_build_metrics for bundle size info, or run_command 'npx vite-bundle-visualizer' and view the output HTML" },
    switch_port:         { reason: "switch_port requires modifying the running dev server config and restarting — do this via manage_scripts + restart_dev_server", hint: "Use manage_scripts to update the port in package.json scripts, then call restart_dev_server" },
    generate_component:  { reason: "generate_component requires an AI/LLM model connection not available in standalone mode", hint: "Write the component yourself using write_file or create_file" },
    generate_page:       { reason: "generate_page requires an AI/LLM model connection", hint: "Use write_file to create the page file with the desired content" },
    generate_test:       { reason: "generate_test requires an AI/LLM model connection", hint: "Use write_file to create test files, or run_tests to run existing tests" },
    refactor_file:       { reason: "refactor_file requires an AI/LLM model connection to interpret refactoring instructions", hint: "Use search_replace or write_file for targeted changes, or read_file + write_file for full rewrites" },
    optimize_code:       { reason: "optimize_code requires an AI/LLM model connection", hint: "Use type_check and lint_and_fix to catch obvious issues, or read_file to review the code yourself" },
    super_command:       { reason: "super_command requires an AI/LLM to interpret natural language instructions", hint: "Break your instruction into specific commands: list_tree → read_file → search_replace → git_commit" },
    convert_to_typescript: { reason: "convert_to_typescript requires AI to safely transform JS to TS", hint: "Rename files with move_file then add TypeScript types manually with write_file" },
    add_feature:         { reason: "add_feature requires AI to interpret and generate code", hint: "Use create_file + write_file to add the feature manually" },
    migrate_framework:   { reason: "migrate_framework requires AI to perform complex code transformations", hint: "Migrate manually using bulk_write and search_replace" },
    react_profiler:      { reason: "react_profiler requires React DevTools running in a browser", hint: "Use run_command to run performance benchmarks with Node.js" },
    memory_leak_detection: { reason: "memory_leak_detection requires a running browser with memory profiling", hint: "Use run_command to run Node.js heap snapshots with --inspect" },
    console_error_analysis: { reason: "console_error_analysis requires a running browser", hint: "Use get_process_logs to check dev server output" },
    runtime_error_trace: { reason: "runtime_error_trace requires a running browser with DevTools", hint: "Use run_command to run the app with Node.js and capture stderr" },
    network_monitor:     { reason: "network_monitor requires a running browser with DevTools Network tab", hint: "Add console.log statements with write_file to trace network calls" },
    record_video:        { reason: "record_video requires a running browser with screen capture", hint: "Use screenshot_preview to capture static screenshots" },
    generate_storybook:  { reason: "generate_storybook requires an AI/LLM and running Storybook instance", hint: "Create stories manually with write_file" },
    profile_performance: { reason: "profile_performance requires a running browser with Performance tab", hint: "Use run_command to run lighthouse-cli: npx lighthouse http://localhost:PORT" },
    deploy_preview:      { reason: "deploy_preview requires CI/CD platform integration", hint: "Use run_command to run build and deploy commands directly" },
    export_project_zip:  { reason: "export_project_zip is not implemented in standalone mode", hint: "Use run_command to create a zip: zip -r project.zip . --exclude 'node_modules/*'" },
    import_project:      { reason: "import_project is not implemented in standalone mode", hint: "Use bulk_write to create project files" },
    archive_project:     { reason: "archive_project is not implemented in standalone mode", hint: "Use run_command to archive: tar -czf project.tar.gz ." },
    export_project:      { reason: "export_project is not implemented in standalone mode", hint: "Use run_command to export" },
    set_tailwind_config: { reason: "set_tailwind_config is not implemented — edit the config file directly", hint: "Use write_file or search_replace to edit tailwind.config.js" },
    set_next_config:     { reason: "set_next_config is not implemented — edit the config file directly", hint: "Use write_file or search_replace to edit next.config.js" },
    switch_package_manager: { reason: "switch_package_manager requires restructuring lock files", hint: "Manually delete old lock files and run install_deps after adding the new lock file" },
    build_with_flags:    { reason: "build_with_flags is not implemented separately", hint: "Use run_command with your full build command including flags" },
    clean_build_cache:   { reason: "clean_build_cache is not implemented separately", hint: "Use run_command to clean: rm -rf dist .cache .next node_modules/.cache" },
    copy_folder:         { reason: "copy_folder is not implemented — use run_command to copy directories", hint: "Use run_command: cp -r src/ dest/ (Linux) or xcopy src dest /E /I (Windows)" },
  };

  if (UNSUPPORTED[action.type]) {
    const u = UNSUPPORTED[action.type];
    return { success: false, supported: false, reason: u.reason, hint: u.hint };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UNKNOWN — never throw a cryptic error
  // ─────────────────────────────────────────────────────────────────────────
  return {
    success: false,
    supported: false,
    reason: `Unknown action type: "${action.type}". This command is not implemented in the Lamby Bridge Connector.`,
    hint: `Check /api/grok for the full list of supported commands. Common alternatives: use run_command for shell operations, write_file for file creation, search_replace for targeted edits.`,
  };
}

// ── Message router ────────────────────────────────────────────────────────────
async function onMessage(rawData) {
  let msg;
  try { msg = JSON.parse(rawData); } catch { log("warn", `Unparseable message: ${rawData.substring(0, 80)}`); return; }

  if (msg.type === "ping") { send({ type: "pong", ts: Date.now() }); return; }
  if (msg.type === "pong" || msg.type === "relay-log") return;
  if (msg.type === "sandbox-execute-request" && msg.requestId) {
    const actions = Array.isArray(msg.actions)  ? msg.actions
      : Array.isArray(msg.types)                ? msg.types
      : Array.isArray(msg.commands)             ? msg.commands
      : Array.isArray(msg.data)                 ? msg.data : [];
    log("info", `sandbox-execute-request reqId=${msg.requestId.substring(0, 8)} actions=${actions.length}`);
    const results = [];
    for (const action of actions) {
      try {
        const data = await handleAction(action);
        results.push({ type: action.type, data: { success: true, ...data } });
      } catch (e) {
        log("error", `Action ${action.type} failed: ${e.message}`);
        results.push({ type: action.type, data: { success: false, error: e.message } });
      }
    }
    send({ type: "sandbox-execute-response", requestId: msg.requestId, result: { success: true, results } });
    return;
  }

  if (msg.type === "snapshot-request" && msg.requestId) {
    log("info", `snapshot-request reqId=${msg.requestId.substring(0, 8)} project=${msg.project || "(none)"}`);
    const project = msg.project || msg.projectName || PROJECT_NAME || "";
    const projDir = resolveProjectDir(project);
    let snapshot = `=== Lamby Desktop Connector Snapshot ===\nProject: ${project || "(default)"}\nDir: ${projDir}\nConnector: standalone node.js v2.0\nTime: ${new Date().toISOString()}\n\n`;
    try {
      const pkgPath = path.join(projDir, "package.json");
      if (fs.existsSync(pkgPath)) snapshot += `=== package.json ===\n${fs.readFileSync(pkgPath, "utf-8")}\n\n`;
    } catch {}
    try {
      const { stdout } = await execp("git status --short && git log --oneline -5", { cwd: projDir }).catch(() => ({ stdout: "" }));
      if (stdout) snapshot += `=== git status + log ===\n${stdout}\n\n`;
    } catch {}
    send({ type: "snapshot-response", requestId: msg.requestId, snapshot });
    return;
  }

  if (msg.type === "console-logs-request" && msg.requestId) {
    const previews = [];
    for (const [pid, e] of runningProcs) {
      let port = null;
      for (const line of e.stdout) { const m = line.match(/localhost:(\d{4,5})/); if (m) { port = parseInt(m[1]); break; } }
      previews.push({ name: e.name, port, pid, stdout: e.stdout.slice(-50).join(""), stderr: e.stderr.slice(-20).join("") });
    }
    send({ type: "console-logs-response", requestId: msg.requestId, logs: { previews } });
    return;
  }

  log("warn", `Unhandled message type: ${msg.type}`);
}

// ── Startup project scan + periodic refresh ────────────────────────────────────
// Run immediately so resolveProjectDir works from the first command received.
// Then re-run every 15 seconds to pick up newly created projects automatically.
(function initProjectScan() {
  const n = scanProjectDirs();
  const names = [...new Set([...projectDirCache.values()].map(e => e.pkgName || path.basename(e.dir)))];
  log("info", `Project scan: found ${n} dirs under "${PROJECT_DIR}" → [${names.join(", ")}]`);
  setInterval(() => { scanProjectDirs(); }, 15000).unref();
})();

// ── WebSocket connection ────────────────────────────────────────────────────────
function connect() {
  if (_connected) return; // already connected — do not open a second socket
  let relayUrl;
  try { relayUrl = new URL(RELAY_URL); } catch { log("error", `Invalid RELAY_URL: ${RELAY_URL}`); process.exit(1); }
  const isSecure = relayUrl.protocol === "wss:";
  const host     = relayUrl.hostname;
  const port     = relayUrl.port ? parseInt(relayUrl.port) : (isSecure ? 443 : 80);
  const wsKey    = crypto.randomBytes(16).toString("base64");
  const wsPath   = `/bridge-ws` + (PROJECT_NAME ? `?project=${encodeURIComponent(PROJECT_NAME)}` : "");
  const upgradeReq = [
    `GET ${wsPath} HTTP/1.1`,
    `Host: ${host}`,
    `Upgrade: websocket`,
    `Connection: Upgrade`,
    `Sec-WebSocket-Key: ${wsKey}`,
    `Sec-WebSocket-Version: 13`,
    `User-Agent: LambyBridgeConnector/2.0`,
    `\r\n`,
  ].join("\r\n");

  log("info", `Connecting to ${RELAY_URL}...`);
  const connectOpts = { host, port };
  const sock = isSecure ? tls.connect({ ...connectOpts, servername: host }) : net.connect(connectOpts);
  let upgraded = false;
  let rxBuf = Buffer.alloc(0);
  let disconnectFired = false;

  const doUpgrade = () => { if (!upgraded) sock.write(upgradeReq); };
  if (isSecure) sock.on("secureConnect", doUpgrade); else sock.on("connect", doUpgrade);

  sock.on("data", (chunk) => {
    rxBuf = Buffer.concat([rxBuf, chunk]);
    if (!upgraded) {
      const sepIdx = rxBuf.indexOf("\r\n\r\n");
      if (sepIdx === -1) return;
      const headerStr = rxBuf.slice(0, sepIdx).toString();
      rxBuf = rxBuf.slice(sepIdx + 4);
      if (!headerStr.includes("101")) { log("error", `WS upgrade rejected: ${headerStr.split("\r\n")[0]}`); sock.destroy(); return; }
      upgraded = true; _connected = true; _socket = sock;
      log("info", `Connected to relay`);
      clearInterval(_pingInterval);
      _pingInterval = setInterval(() => { if (_connected) send({ type: "ping", ts: Date.now() }); }, 15000);
    }
    while (rxBuf.length > 0) {
      const { data, opcode, bytesConsumed } = wsDecodeFrame(rxBuf);
      if (data === null) break;
      rxBuf = rxBuf.slice(bytesConsumed);
      if (opcode === 0x8) { sock.end(); return; }
      if (opcode === 0x9) { send({ type: "pong" }); continue; }
      if (data) onMessage(data).catch(e => log("error", `Handler error: ${e.message}`));
    }
  });

  const onDisconnect = () => {
    if (disconnectFired) return;
    disconnectFired = true;
    sock.removeAllListeners();
    try { sock.destroy(); } catch {}
    clearInterval(_pingInterval); _pingInterval = null;
    _connected = false; _socket = null;
    log("warn", `Disconnected. Reconnecting in ${RECONNECT_DELAY / 1000}s...`);
    setTimeout(connect, RECONNECT_DELAY);
  };
  sock.on("close",   () => onDisconnect());
  sock.on("error",   (e) => { log("error", `Socket error: ${e.message}`); onDisconnect(); });
  sock.on("timeout", () => onDisconnect());
  sock.setTimeout(90000);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const chromePath = findChrome();
console.log("╔═══════════════════════════════════════════════════════╗");
console.log("║   Lamby Bridge Connector v2.0  (86 commands live)    ║");
console.log("╚═══════════════════════════════════════════════════════╝");
console.log(`  Relay URL:    ${RELAY_URL}`);
console.log(`  Project:      ${PROJECT_NAME || "(not set — pass PROJECT_NAME env var)"}`);
console.log(`  Project dir:  ${PROJECT_DIR}`);
console.log(`  Chrome:       ${chromePath || "NOT FOUND — screenshots disabled"}`);
console.log("");
console.log("  Press Ctrl+C to stop. Auto-reconnects forever.");
console.log("");

connect();

// Purge stale pending chunk sets older than 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pendingChunks) {
    if (now - entry.lastAt > 300000) { pendingChunks.delete(key); log("warn", `Dropped stale chunk set: ${key}`); }
  }
}, 60000).unref();

process.on("SIGINT",  () => { console.log("\n[Bridge] Stopped."); process.exit(0); });
process.on("SIGTERM", () => { console.log("\n[Bridge] Terminated."); process.exit(0); });
process.on("uncaughtException", (e) => { log("error", `Uncaught: ${e.message}`); });
process.on("unhandledRejection", (e) => { log("error", `Unhandled rejection: ${e}`); });
