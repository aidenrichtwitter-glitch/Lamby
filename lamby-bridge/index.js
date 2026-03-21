const http = require("http");
const crypto = require("crypto");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const PORT = parseInt(process.env.PORT || "3000", 10);
// Single desktop connection slot — there is only ever one desktop.
let desktopClient  = null; // the live client object
let desktopBridgeKey = ""; // its bridge key (for logging)
const pendingRelayRequests = new Map();
const pendingSandboxRelayRequests = new Map();
const pendingConsoleLogRequests = new Map();
const sandboxAuditLog = []; // kept for backward-compat alias
const activityLog = sandboxAuditLog; // same array — extended below
const activityLogSSEClients = new Set();
let _activityIdCounter = 0;
function _activityId() { return (++_activityIdCounter).toString(36).padStart(6,"0"); }
const _lastScreenshotLog = new Map(); // project → ts of last logged screenshot

function humanizeAction(type, action, result) {
  const p = action?.path || action?.file || "";
  const cmd = (action?.command || "").slice(0, 70);
  const proj = action?.project ? `[${action.project}] ` : "";
  switch (type) {
    case "read_file":          return `${proj}Read file: ${p}`;
    case "read_multiple_files":return `${proj}Read ${(action?.paths||[]).length} files`;
    case "write_file":         return `${proj}Write file: ${p}`;
    case "write_file_chunk":   return `${proj}Chunk ${(action?.chunk_index??0)+1}/${action?.total_chunks||"?"} → ${p}`;
    case "search_replace": {
      const reps = result?.replacements ?? result?.results?.[0]?.replacements ?? result?.results?.[0]?.data?.results?.[0]?.replacements;
      if (reps === 0) return `${proj}⚠ search_replace — ZERO matches in ${p}`;
      if (reps > 0)  return `${proj}search_replace → ${p} (${reps} replacement${reps!==1?"s":""})`;
      return `${proj}search_replace: ${p}`;
    }
    case "apply_patch":        return `${proj}Apply patch: ${p}`;
    case "list_tree":          return `${proj}List dir: ${p||"root"}`;
    case "list_open_ports":    return `${proj}List open ports`;
    case "list_projects":      return "List projects";
    case "get_preview_url":    return `${proj}Get preview URL`;
    case "run_command":        return `${proj}Run: ${cmd}`;
    case "git_status":         return `${proj}git status`;
    case "git_commit":         return `${proj}Git commit: "${(action?.message||"").slice(0,50)}"`;
    case "git_diff":           return `${proj}git diff`;
    case "git_log":            return `${proj}git log`;
    case "type_check":         return `${proj}TypeScript type-check`;
    case "build_project":      return `${proj}Build project`;
    case "install_deps":       return `${proj}Install dependencies`;
    case "add_dependency":     return `${proj}Add dependency: ${action?.name||""}`;
    case "remove_dependency":  return `${proj}Remove dependency: ${action?.name||""}`;
    case "screenshot_preview": return `${proj}Screenshot captured`;
    case "browser_navigate":   return `${proj}Navigate: ${action?.url||""}`;
    case "browser_interact":   return `${proj}Browser: ${action?.action||""} ${action?.selector||""}`;
    case "evaluate_js":        return `${proj}Evaluate JS`;
    case "console_logs":       return `${proj}Get console logs`;
    default:                   return `${proj}${type}`;
  }
}

function resultSummary(type, parsed) {
  try {
    const d = parsed?.results?.[0]?.data ?? parsed;
    if (!d) return null;
    if (type === "search_replace") {
      const reps = d?.results?.[0]?.replacements ?? d?.replacements;
      if (reps !== undefined) return `${reps} replacement${reps!==1?"s":""}`;
    }
    if (type === "run_command") {
      const out = (d?.stdout || d?.output || "").slice(0,120).trim();
      const err = (d?.stderr || "").slice(0,80).trim();
      if (d?.exitCode !== undefined && d.exitCode !== 0) return `exit ${d.exitCode}${err ? " — " + err : ""}`;
      return out || (d?.exitCode === 0 ? "exit 0" : null);
    }
    if (type === "read_file") {
      const c = d?.content || d?.text || "";
      return `${c.split("\n").length} lines, ${c.length} chars`;
    }
    if (type === "type_check") {
      if (d?.passed) return "✓ no errors";
      return `${d?.errorCount||"?"} error(s)`;
    }
    if (type === "build_project") return d?.built ? "✓ built" : d?.error || "failed";
    if (type === "list_tree") return `${(d?.files||d?.tree||"").split("\n").filter(Boolean).length} entries`;
    if (d?.error) return "Error: " + d.error.slice(0,120);
    if (d?.success === false) return "failed";
    if (d?.success === true) return "ok";
  } catch {}
  return null;
}

function pushActivity(entry) {
  entry.id = _activityId();
  if (!entry.ts) entry.ts = Date.now();
  if (!entry.dur) entry.dur = 0;
  activityLog.push(entry);
  if (activityLog.length > 5000) activityLog.splice(0, activityLog.length - 4000);
  const payload = JSON.stringify({ event: "new", entry });
  for (const client of activityLogSSEClients) {
    try { client.write(`data: ${payload}\n\n`); } catch { activityLogSSEClients.delete(client); }
  }
  return entry;
}

function updateActivity(entry, updates) {
  Object.assign(entry, updates);
  const payload = JSON.stringify({ event: "update", entry });
  for (const client of activityLogSSEClients) {
    try { client.write(`data: ${payload}\n\n`); } catch { activityLogSSEClients.delete(client); }
  }
}
const pendingScreenshots = new Map(); // key → { requestId, timer, waiters: Set<{res,format}>, maxWaitMs }
const screenshotCache = new Map();    // key → { result: string, expiresAt: number }
const screenshotLastGood = new Map(); // project → { url: string, capturedAt: number }
const editInflight = new Map();       // dedup key → Promise<string> (grok-edit in-flight fan-in)
const editResultCache = new Map();    // dedup key → { result: string, ts: number } (10s recency cache)
const screenshotHistory = new Map(); // project → Array<{url,capturedAt}> max 60 (1 hour backup)
const screenshotDataCache = new Map(); // project → { base64: string, mimeType: string, capturedAt: number } — relay-served PNG
const sseClients        = new Map(); // project → Set<res> (SSE live stream connections)
const lastEditByProject = new Map(); // project → {path, replacements, ts}
const pendingSnapshots = new Map();   // projectName → { requestId, timer, waiters: Set<res> }
const snapshotCache = new Map();      // projectName → { result: string, expiresAt: number }
function relayLog(level, message) {
  const ts = Date.now();
  if (level === "warn") console.warn(`[RELAY] ${message}`);
  else if (level === "error") console.error(`[RELAY] ${message}`);
  else console.log(`[RELAY] ${message}`);
  const payload = JSON.stringify({ type: "relay-log", level, message, ts });
  if (desktopClient?.alive) {
    try { desktopClient.socket.write(wsEncodeFrame(payload)); } catch {}
  }
}
function sendJson(res, obj, status) {
  res.writeHead(status || 200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(obj));
}
function readBody(req, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    req.on("data", (c) => {
      totalSize += c.length;
      if (totalSize > maxBytes) {
        req.destroy();
        reject(new Error("Request body too large (max 10MB)"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}
// ── JSON repair helpers ───────────────────────────────────────────────────────
// repairJson: single-pass FSM that fixes two common LLM encoding mistakes:
//   1. Raw control chars (0x00–0x1F) inside string values → proper JSON escapes
//   2. Trailing commas before } or ] outside strings → removed
// Pure Node.js, zero dependencies. Handles nested strings, escaped quotes, unicode.
function repairJson(str) {
  let out = "", inStr = false, esc = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i], code = str.charCodeAt(i);
    if (esc) {
      // After a backslash inside a string: if the next char is itself a raw control
      // char (e.g. backslash + literal newline), emit the proper escape letter so the
      // output remains valid JSON. For anything else pass through unchanged.
      if (inStr && code < 0x20) {
        const escLetter = { 9: "t", 10: "n", 13: "r", 8: "b", 12: "f" };
        out += escLetter[code] !== undefined ? escLetter[code] : `u${code.toString(16).padStart(4, "0")}`;
      } else {
        out += ch;
      }
      esc = false;
      continue;
    }
    if (ch === "\\" && inStr) { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr && code < 0x20) {
      // Escape raw control chars inside string values
      const map = { 9: "\\t", 10: "\\n", 13: "\\r", 8: "\\b", 12: "\\f" };
      out += map[code] !== undefined ? map[code] : `\\u${code.toString(16).padStart(4, "0")}`;
      continue;
    }
    if (!inStr && ch === ",") {
      // Look ahead: skip comma if next non-whitespace char is } or ] (trailing comma)
      let j = i + 1;
      while (j < str.length && (str[j] === " " || str[j] === "\t" || str[j] === "\n" || str[j] === "\r")) j++;
      if (j < str.length && (str[j] === "}" || str[j] === "]")) continue;
    }
    out += ch;
  }
  return out;
}
// parseWithRepair: three-stage fallback chain.
// Stage 1: plain JSON.parse — zero overhead for well-formed payloads.
// Stage 2: trailing-comma-only FSM strip — cheap fix for the most common LLM mistake.
// Stage 3: full repairJson — handles control chars + trailing commas in one pass.
// Each stage logs a distinct WARN so repairs are visible in production logs.
// Throws the original error if all stages fail.
function parseWithRepair(str, label) {
  try { return JSON.parse(str); } catch (e1) {
    // Stage 2: strip trailing commas only (string-context-aware FSM, no control-char changes)
    try {
      let s2 = "", inS = false, es = false;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (es) { s2 += ch; es = false; continue; }
        if (ch === "\\" && inS) { s2 += ch; es = true; continue; }
        if (ch === '"') { inS = !inS; s2 += ch; continue; }
        if (!inS && ch === ",") {
          let j = i + 1;
          while (j < str.length && (str[j] === " " || str[j] === "\t" || str[j] === "\n" || str[j] === "\r")) j++;
          if (j < str.length && (str[j] === "}" || str[j] === "]")) continue;
        }
        s2 += ch;
      }
      const r = JSON.parse(s2);
      relayLog("warn", `${label} JSON auto-repaired (trailing comma): ${e1.message}`);
      return r;
    } catch {}
    // Stage 3: full repair — control chars + trailing commas
    try {
      const r = JSON.parse(repairJson(str));
      relayLog("warn", `${label} JSON auto-repaired (control chars): ${e1.message}`);
      return r;
    } catch {}
    throw e1;
  }
}
function findBridgeClient() {
  return (desktopClient?.alive) ? desktopClient : null;
}
function makeRelayPromise(requestId, req, timeoutMs, logPrefix) {
  return new Promise((resolve) => {
    let progressInterval;
    const elapsed = { ms: 0 };
    progressInterval = setInterval(() => {
      elapsed.ms += 15000;
      relayLog("info", `${logPrefix} still waiting for desktop... ${elapsed.ms / 1000}s elapsed reqId=${requestId.substring(0, 8)}...`);
    }, 15000);
    const cleanup = (reason, value) => {
      clearInterval(progressInterval);
      const pending = pendingSandboxRelayRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingSandboxRelayRequests.delete(requestId);
        relayLog("warn", `${logPrefix} ${reason} reqId=${requestId.substring(0, 8)}...`);
        pending.resolve(value);
      }
    };
    const timer = setTimeout(() => {
      cleanup(`TIMEOUT ${timeoutMs / 1000}s`, JSON.stringify({ error: `Relay timeout — desktop app did not respond within ${timeoutMs / 1000} seconds.` }));
    }, timeoutMs);
    pendingSandboxRelayRequests.set(requestId, { resolve: (v) => { clearInterval(progressInterval); resolve(v); }, timer });
    req.on("close", () => {
      cleanup("client disconnected early (browse_page timeout?)", JSON.stringify({ __clientDisconnected: true }));
    });
  });
}
function waitForClient(maxWaitMs = 60000, intervalMs = 300) {
  return new Promise((resolve) => {
    const client = findBridgeClient();
    if (client) { resolve(client); return; }
    let elapsed = 0;
    const poll = setInterval(() => {
      elapsed += intervalMs;
      const found = findBridgeClient();
      if (found) { clearInterval(poll); resolve(found); return; }
      if (elapsed >= maxWaitMs) { clearInterval(poll); resolve(null); }
    }, intervalMs);
  });
}
function wsEncodeFrame(data) {
  const payload = Buffer.from(data, "utf-8");
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}
function wsDecodeFrame(buf) {
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
    const mask = buf.slice(offset, offset + 4);
    offset += 4;
    const payload = Buffer.alloc(payloadLen);
    for (let i = 0; i < payloadLen; i++) {
      payload[i] = buf[offset + i] ^ mask[i % 4];
    }
    return { data: payload.toString("utf-8"), opcode, bytesConsumed: offset + payloadLen };
  }
  if (buf.length < offset + payloadLen) return { data: null, bytesConsumed: 0 };
  return { data: buf.slice(offset, offset + payloadLen).toString("utf-8"), opcode, bytesConsumed: offset + payloadLen };
}
function pushScreenshotAndBroadcast(project, url, capturedAt) {
  if (!screenshotHistory.has(project)) screenshotHistory.set(project, []);
  const hist = screenshotHistory.get(project);
  hist.push({ url, capturedAt });
  if (hist.length > 60) hist.splice(0, hist.length - 60);
  const clients = sseClients.get(project);
  if (!clients || clients.size === 0) return;
  const lastEdit = lastEditByProject.get(project) || null;
  const evt = `event: screenshot\ndata: ${JSON.stringify({ url, capturedAt, lastEdit })}\n\n`;
  for (const r of clients) { try { r.write(evt); } catch { clients.delete(r); } }
}
// findClientForProject: prefer the desktop client registered for this project;
// falls back to any alive client — intentional open-routing for single-desktop setups
// where the desktop may not have sent a project param on WS connect.
// TODO (future hardening): in strict multi-desktop/multi-project environments the
// fallback can route background captures to a non-owning client. When strict per-project
// isolation is needed, remove the second loop and return null if no exact match found.
function findClientForProject(project) {
  if (!desktopClient?.alive) return null;
  // With a single slot the client handles any project (open-routing fallback built-in).
  return desktopClient;
}
function buildZip(files) {
  const _crcTable = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ _crcTable[(c ^ buf[i]) & 0xff];
    return (c ^ 0xffffffff) >>> 0;
  }
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) >>> 0;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) >>> 0;
  const localParts = [];
  const centralDirs = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBytes = Buffer.from(name, "utf8");
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
    const compressed = zlib.deflateRawSync(raw, { level: 6 });
    const crc = crc32(raw);
    const lh = Buffer.alloc(30 + nameBytes.length);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(compressed.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBytes.length, 26); lh.writeUInt16LE(0, 28);
    nameBytes.copy(lh, 30);
    localParts.push(lh, compressed);
    const cd = Buffer.alloc(46 + nameBytes.length);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10); cd.writeUInt16LE(dosTime, 12); cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(compressed.length, 20); cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBytes.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
    nameBytes.copy(cd, 46);
    centralDirs.push(cd);
    offset += lh.length + compressed.length;
  }
  const cdBuf = Buffer.concat(centralDirs);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, cdBuf, eocd]);
}
function handleWsUpgrade(req, socket, clientProject) {
  const bridgeKey = req.headers["sec-websocket-key"]?.substring(0, 12) || "desktop";
  const acceptKey = crypto
    .createHash("sha1")
    .update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-5AB9C04E64DC")
    .digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
    "\r\n"
  );
  relayLog("info", `Desktop connected${clientProject ? " project=" + clientProject : ""}`);
  pushActivity({ type: "connect", project: clientProject, status: "ok", human: `Desktop connected${clientProject ? " — " + clientProject : ""}`, detail: clientProject || "no project" });
  // Silently close any prior connection — no message sent, connector's _connected guard prevents loops.
  if (desktopClient) {
    relayLog("info", `Replacing existing desktop connection`);
    desktopClient.alive = false;
    try { desktopClient.socket.end(); } catch {}
  }
  const client = { socket, project: clientProject || "", lastPing: Date.now(), alive: true };
  desktopClient  = client;
  desktopBridgeKey = bridgeKey;
  client.send = (data) => {
    try {
      socket.write(wsEncodeFrame(data));
    } catch (err) {
      relayLog("error", `Send failed key=${bridgeKey.substring(0, 8)}... err=${err.message}`);
      client.alive = false;
      if (desktopClient === client) desktopClient = null;
    }
  };
  let keepaliveInterval;
  const sendPing = () => {
    if (!client.alive) { clearInterval(keepaliveInterval); return; }
    client.send(JSON.stringify({ type: "ping", ts: Date.now() }));
    relayLog("info", `Keepalive ping sent key=${bridgeKey.substring(0, 8)}...`);
  };
  sendPing();
  keepaliveInterval = setInterval(sendPing, 15000);
  let buffer = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length > 0) {
      const { data, opcode, bytesConsumed } = wsDecodeFrame(buffer);
      if (data === null) break;
      buffer = buffer.slice(bytesConsumed);
      if (opcode === 0x8) { socket.end(); return; }
      if (opcode === 0x9) {
        const pong = Buffer.alloc(2);
        pong[0] = 0x8a;
        pong[1] = 0;
        try { socket.write(pong); } catch {}
        continue;
      }
      try {
        const msg = parseWithRepair(data, "←Desktop WS");
        client.lastPing = Date.now();
        if (msg.type === "snapshot-response" && msg.requestId) {
          const snapshotResult = msg.snapshot || "Error: Empty snapshot response from desktop.";
          relayLog("info", `←Desktop snapshot-response reqId=${msg.requestId.substring(0, 8)}... snapshotLen=${snapshotResult.length}`);
          // Fan-out: find which project this requestId belongs to
          let fanned = false;
          for (const [proj, ps] of pendingSnapshots) {
            if (ps.requestId === msg.requestId) {
              clearTimeout(ps.timer);
              pendingSnapshots.delete(proj);
              snapshotCache.set(proj, { result: snapshotResult, expiresAt: Date.now() + 15000 });
              relayLog("info", `SNAPSHOT fan-out to ${ps.waiters.size} waiter(s) project=${proj}`);
              for (const r of ps.waiters) {
                if (!r.writableEnded) {
                  r.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" });
                  r.end(snapshotResult);
                }
              }
              fanned = true;
              break;
            }
          }
          if (!fanned) {
            relayLog("warn", `←Desktop snapshot-response reqId=${msg.requestId.substring(0, 8)}... NO PENDING SNAPSHOT — already timed out or duplicate`);
          }
        } else if (msg.type === "sandbox-execute-response" && msg.requestId) {
          // ── Intercept screenshotBase64: store in relay, replace with relay-served URL ──
          let _rawResult = msg.result || {};
          try {
            const _d = _rawResult?.results?.[0]?.data;
            if (_d?.screenshotBase64) {
              // Resolve project from the pending screenshot entry (more reliable than clientProject which may be empty)
              let _proj = clientProject || "";
              for (const [sk, sc] of pendingScreenshots) {
                if (sc.requestId === msg.requestId) { _proj = sk.split(":")[0] || _proj; break; }
              }
              if (!_proj) _proj = "unknown";
              const _proto = req.headers["x-forwarded-proto"] || "https";
              const _wsHost = req.headers.host || `localhost:${PORT}`;
              screenshotDataCache.set(_proj, { base64: _d.screenshotBase64, mimeType: _d.mimeType || "image/png", capturedAt: Date.now() });
              const _relayUrl = `${_proto}://${_wsHost}/api/screenshot-data/${_proj}`;
              _d.screenshotUrl = _relayUrl;
              _d.relayServed = true;
              delete _d.screenshotBase64; // strip large base64 before forwarding to Grok
              const _ssBytes = screenshotDataCache.get(_proj)?.base64?.length || 0;
              relayLog("info", `SCREENSHOT-RELAY stored project=${_proj} bytes=${_ssBytes} url=${_relayUrl}`);
              // Rate-limit screenshot entries in the activity log (auto shots fire every 1s — only log 1 per 30s)
              const _ssLastLog = _lastScreenshotLog.get(_proj) || 0;
              if (Date.now() - _ssLastLog > 30000) {
                _lastScreenshotLog.set(_proj, Date.now());
                pushActivity({ type: "screenshot_preview", project: _proj, status: "ok", human: `[${_proj}] Screenshot captured`, detail: `${Math.round(_ssBytes * 3/4 / 1024)} KB PNG` });
              }
            }
          } catch (e) { relayLog("warn", `SCREENSHOT-RELAY intercept error: ${e.message}`); }
          const resultStr = JSON.stringify(_rawResult);
          relayLog("info", `←Desktop sandbox-execute-response reqId=${msg.requestId.substring(0, 8)}... resultLen=${resultStr.length} preview=${resultStr.substring(0, 120)}`);
          let handledByScreenshot = false;
          for (const [sk, sc] of pendingScreenshots) {
            if (sc.requestId === msg.requestId) {
              clearTimeout(sc.timer);
              pendingScreenshots.delete(sk);
              screenshotCache.set(sk, { result: resultStr, expiresAt: Date.now() + 30000 });
              // Extract screenshotUrl for plain-text / redirect formats and last-good cache
              let screenshotUrl = null;
              try {
                const parsed = JSON.parse(resultStr);
                screenshotUrl = parsed?.results?.[0]?.data?.screenshotUrl || null;
              } catch {}
              const project = sk.split(":")[0];
              if (screenshotUrl) {
                const _capturedAt = Date.now();
                screenshotLastGood.set(project, { url: screenshotUrl, capturedAt: _capturedAt });
                relayLog("info", `SCREENSHOT last-good stored project=${project} url=${screenshotUrl}`);
                pushScreenshotAndBroadcast(project, screenshotUrl, _capturedAt);
              }
              relayLog("info", `SCREENSHOT fan-out to ${sc.waiters.size} waiter(s) key=${sk}`);
              for (const w of sc.waiters) {
                const r = w.res || w;
                const fmt = w.format || "json";
                if (r.writableEnded) continue;
                try {
                  if (fmt === "text") {
                    const url = screenshotUrl || (screenshotLastGood.get(project)?.url) || "";
                    r.writeHead(200, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
                    r.end(url || "Error: no screenshot URL available");
                  } else if (fmt === "redirect") {
                    const url = screenshotUrl || (screenshotLastGood.get(project)?.url) || null;
                    if (url) {
                      r.writeHead(302, { "Location": url, "Access-Control-Allow-Origin": "*" });
                      r.end();
                    } else {
                      r.writeHead(503, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
                      r.end("Error: screenshot failed and no prior screenshot cached.");
                    }
                  } else {
                    r.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
                    r.end(resultStr);
                  }
                } catch {}
              }
              handledByScreenshot = true;
              break;
            }
          }
          if (!handledByScreenshot) {
          const pending = pendingSandboxRelayRequests.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingSandboxRelayRequests.delete(msg.requestId);
            pending.resolve(JSON.stringify(msg.result || { error: "Empty sandbox response from desktop." }));
          } else {
            relayLog("warn", `←Desktop sandbox-execute-response reqId=${msg.requestId.substring(0, 8)}... NO PENDING REQUEST — already timed out`);
          }
          }
        } else if (msg.type === "console-logs-response" && msg.requestId) {
          relayLog("info", `←Desktop console-logs-response reqId=${msg.requestId.substring(0, 8)}...`);
          const pending = pendingConsoleLogRequests.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingConsoleLogRequests.delete(msg.requestId);
            pending.resolve(msg.logs || { stdout: "", stderr: "", entries: [] });
          } else {
            relayLog("warn", `←Desktop console-logs-response reqId=${msg.requestId.substring(0, 8)}... NO PENDING REQUEST — already timed out`);
          }
        } else if (msg.type === "ping") {
          relayLog("info", `←Desktop ping key=${bridgeKey.substring(0, 8)}... sending pong`);
          client.send(JSON.stringify({ type: "pong" }));
        } else if (msg.type === "pong") {
          relayLog("info", `←Desktop pong key=${bridgeKey.substring(0, 8)}...`);
        } else {
          relayLog("warn", `←Desktop UNKNOWN msg type="${msg.type}" reqId=${msg.requestId || "(none)"} keys=${Object.keys(msg).join(",")}`);
        }
      } catch (parseErr) {
        relayLog("error", `←Desktop JSON parse error: ${parseErr.message} raw(200)=${data.substring(0, 200)}`);
      }
    }
  });
  socket.on("close", () => {
    relayLog("warn", `Desktop disconnected key=${bridgeKey.substring(0, 8)}...`);
    pushActivity({ type: "disconnect", project: clientProject, status: "warn", human: `Desktop disconnected${clientProject ? " — " + clientProject : ""}`, detail: "connection closed" });
    client.alive = false;
    clearInterval(keepaliveInterval);
    if (desktopClient === client) desktopClient = null;
  });
  socket.on("error", (err) => {
    relayLog("error", `Socket error key=${bridgeKey.substring(0, 8)}... err=${err.message}`);
    pushActivity({ type: "disconnect", project: clientProject, status: "fail", human: `Desktop socket error${clientProject ? " — " + clientProject : ""}`, detail: err.message });
    client.alive = false;
    clearInterval(keepaliveInterval);
    if (desktopClient === client) desktopClient = null;
  });
}
const server = http.createServer({ maxHeaderSize: 1048576 }, async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const silent = pathname === "/" || pathname === "/api/status" || pathname === "/api/bridge-status" || pathname === "/health" || pathname === "/healthz";
  if (!silent) {
    relayLog("info", `HTTP ${req.method} ${pathname} connected=${desktopClient ? "yes" : "no"}`);
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }
  if (pathname === "/health" || pathname === "/healthz") {
    sendJson(res, {
      status: "ok",
      service: "Lamby Bridge Relay",
      bridge: desktopClient ? "connected" : "waiting-for-desktop",
      connectedClients: desktopClient ? 1 : 0,
      uptime: process.uptime(),
    });
    return;
  }
  if (pathname === "/api/status") {
    sendJson(res, {
      status: "ok",
      bridge: desktopClient ? "connected" : "waiting-for-desktop",
      connectedClients: desktopClient ? 1 : 0,
      uptime: process.uptime(),
      clients: desktopClient ? [{
        connected: desktopClient.alive,
        lastPing: desktopClient.lastPing,
        project: desktopClient.project || null,
      }] : [],
      auditTotal: sandboxAuditLog.length,
      recentAudit: sandboxAuditLog.slice(-5),
    });
    return;
  }
  if (pathname === "/") {
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${protocol}://${host}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lamby Bridge Relay — Activity</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      min-height: 100vh;
      padding: 24px 16px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .logo {
      width: 42px; height: 42px; border-radius: 10px;
      background: linear-gradient(135deg, #7c3aed, #2563eb);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; flex-shrink: 0;
    }
    h1 { font-size: 19px; font-weight: 600; color: #f0f6fc; }
    h1 span { font-size: 12px; font-weight: 400; color: #8b949e; display: block; margin-top: 2px; }
    .badge {
      margin-left: auto; padding: 4px 12px; border-radius: 20px;
      font-size: 12px; font-weight: 600; letter-spacing: 0.04em; flex-shrink: 0;
    }
    .badge.connected { background: #0d3a22; color: #3fb950; border: 1px solid #238636; }
    .badge.waiting { background: #2d1f00; color: #e3b341; border: 1px solid #9e6a03; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    @media(max-width:600px){ .grid { grid-template-columns: 1fr; } }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 16px 18px; }
    .card-title { font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: #8b949e; margin-bottom: 10px; }
    .stat-row { display: flex; gap: 20px; flex-wrap: wrap; }
    .stat { flex: 1; min-width: 70px; }
    .stat-value { font-size: 26px; font-weight: 700; color: #f0f6fc; line-height: 1; }
    .stat-label { font-size: 11px; color: #8b949e; margin-top: 3px; }
    .sse-dot { width: 8px; height: 8px; border-radius: 50%; background: #e3b341; display: inline-block; margin-right: 5px; transition: background .3s; vertical-align: middle; }
    .sse-dot.live { background: #3fb950; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
    .key-box {
      background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
      padding: 9px 12px; font-family: monospace; font-size: 12px;
      color: #79c0ff; display: flex; align-items: center; justify-content: space-between;
      gap: 8px; word-break: break-all; margin-bottom: 8px;
    }
    .key-box:last-child { margin-bottom: 0; }
    .copy-btn { background: #21262d; border: 1px solid #30363d; border-radius: 5px; color: #c9d1d9; font-size: 11px; padding: 3px 9px; cursor: pointer; flex-shrink: 0; transition: background 0.15s; }
    .copy-btn:hover { background: #30363d; }
    .copy-btn.copied { color: #3fb950; border-color: #238636; }
    .feed-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
    .feed-title { font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: #8b949e; margin-right: auto; }
    .filter-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
    .tab { font-size: 11px; padding: 3px 10px; border-radius: 20px; cursor: pointer; border: 1px solid #30363d; background: transparent; color: #8b949e; transition: all .15s; }
    .tab:hover { border-color: #58a6ff; color: #58a6ff; }
    .tab.active { background: #1f2937; border-color: #58a6ff; color: #e6edf3; }
    .tab.err { color: #f85149; border-color: #f8514944; }
    .tab.err.active { background: #2d0f0e; border-color: #f85149; color: #f85149; }
    .feed-controls { display: flex; gap: 6px; align-items: center; }
    .ctrl-btn { font-size: 11px; padding: 3px 9px; border-radius: 6px; cursor: pointer; border: 1px solid #30363d; background: #21262d; color: #8b949e; transition: all .15s; }
    .ctrl-btn:hover { border-color: #8b949e; color: #e6edf3; }
    .feed { font-size: 12px; font-family: monospace; max-height: 680px; overflow-y: auto; background: #0d1117; border: 1px solid #21262d; border-radius: 8px; }
    .feed.paused { border-color: #9e6a03; }
    .entry { display: grid; grid-template-columns: 62px 20px 1fr auto; gap: 0 8px; padding: 6px 12px; border-bottom: 1px solid #161b22; align-items: start; cursor: pointer; transition: background .1s; }
    .entry:last-child { border-bottom: none; }
    .entry:hover { background: #161b22; }
    .entry.expanded { background: #161b22; }
    .entry-ts { color: #484f58; font-size: 10px; padding-top: 2px; white-space: nowrap; }
    .entry-icon { font-size: 12px; padding-top: 1px; }
    .entry-body { min-width: 0; }
    .entry-human { color: #e6edf3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
    .entry-detail { color: #8b949e; font-size: 11px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .entry-dur { color: #484f58; font-size: 10px; white-space: nowrap; padding-top: 2px; text-align: right; }
    .entry-expand { display: none; margin-top: 8px; padding: 8px; background: #0a0d11; border-radius: 6px; border: 1px solid #21262d; white-space: pre-wrap; word-break: break-all; color: #8b949e; font-size: 11px; grid-column: 1 / -1; max-height: 300px; overflow-y: auto; }
    .entry.expanded .entry-expand { display: block; }
    .s-ok    .entry-human { color: #e6edf3; }
    .s-fail  .entry-human { color: #f85149; }
    .s-warn  .entry-human { color: #e3b341; }
    .s-pending .entry-human { color: #8b949e; }
    .s-ok    .entry-icon::after { content: "✅"; }
    .s-fail  .entry-icon::after { content: "❌"; }
    .s-warn  .entry-icon::after { content: "⚠"; }
    .s-pending .entry-icon::after { content: "⏳"; }
    .s-connect .entry-icon::after { content: "🔌"; }
    .s-connect .entry-human { color: #3fb950; }
    .s-disconnect .entry-icon::after { content: "🔌"; }
    .s-disconnect .entry-human { color: #e3b341; }
    .empty-feed { color: #484f58; font-size: 12px; font-style: italic; text-align: center; padding: 40px 16px; }
    .client-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid #21262d; font-size: 13px; }
    .client-row:last-child { border-bottom: none; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #3fb950; flex-shrink: 0; animation: pulse 2s infinite; }
    .client-key { font-family: monospace; color: #79c0ff; }
    .client-snap { font-family: monospace; color: #8b949e; font-size: 12px; margin-left: auto; }
    .empty { color: #8b949e; font-size: 13px; font-style: italic; }
    footer { text-align: center; color: #484f58; font-size: 11px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">🌉</div>
      <div>
        <h1>Lamby Bridge Relay <span>Live Activity Dashboard</span></h1>
      </div>
      <div id="badge" class="badge waiting">Waiting</div>
    </header>

    <div class="grid">
      <div class="card">
        <div class="card-title">Status</div>
        <div class="stat-row">
          <div class="stat"><div class="stat-value" id="clients">—</div><div class="stat-label">Connected</div></div>
          <div class="stat"><div class="stat-value" id="uptime">—</div><div class="stat-label">Uptime</div></div>
          <div class="stat"><div class="stat-value" id="total-actions">0</div><div class="stat-label">Total actions</div></div>
          <div class="stat"><div class="stat-value" id="fail-count" style="color:#f85149">0</div><div class="stat-label">Failures</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Connected Desktops</div>
        <div id="clients-list"><span class="empty">No desktops connected</span></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px; border-color:#7c3aed44; background:linear-gradient(135deg,#1a1030,#161b22);">
      <div class="card-title" style="color:#d2a8ff;">For Grok — browse this to get command docs:</div>
      <div class="key-box">
        <span id="grok-docs-url">${baseUrl}/api/grok</span>
        <button class="copy-btn" onclick="copy(this,document.getElementById('grok-docs-url').textContent)">Copy</button>
      </div>
      <div class="key-box">
        <span>WebSocket: wss://${host}/bridge-ws?project=YOUR_PROJECT</span>
        <button class="copy-btn" onclick="copy(this,'wss://${host}/bridge-ws?project=YOUR_PROJECT')">Copy</button>
      </div>
    </div>

    <div class="card" style="padding-bottom:0">
      <div class="feed-header">
        <div class="feed-title">
          <span class="sse-dot" id="sse-dot"></span>
          Live Activity Feed
        </div>
        <div class="filter-tabs">
          <button class="tab active" onclick="setFilter('all',this)">All</button>
          <button class="tab err" onclick="setFilter('fail',this)">Errors</button>
          <button class="tab" onclick="setFilter('warn',this)">Warnings</button>
          <button class="tab" onclick="setFilter('file',this)">Files</button>
          <button class="tab" onclick="setFilter('screenshot_preview',this)">Screenshots</button>
          <button class="tab" onclick="setFilter('command',this)">Commands</button>
          <button class="tab" onclick="setFilter('connect',this)">Connections</button>
        </div>
        <div class="feed-controls">
          <button class="ctrl-btn" onclick="clearFeed()">Clear</button>
          <button class="ctrl-btn" id="pause-btn" onclick="togglePause()">Pause</button>
        </div>
      </div>
      <div class="feed" id="feed">
        <div class="empty-feed">Connecting to live stream…</div>
      </div>
    </div>

    <footer style="margin-top:14px">
      <a href="/api/download/source.zip" download="lamby-bridge-source.zip" style="background:#238636;color:#fff;text-decoration:none;padding:4px 12px;border-radius:5px;font-size:12px;font-weight:600;margin-right:12px">⬇ Download Source ZIP</a>
      <a href="/desktop-connector.js" download style="color:#3fb950;text-decoration:none;margin-right:12px">⬇ desktop-connector.js</a>
      <a href="/start-connector.bat" download style="color:#8b949e;text-decoration:none">⬇ start-connector.bat</a>
      &nbsp;·&nbsp; Lamby Bridge Relay &nbsp;·&nbsp; Zero dependencies
    </footer>
  </div>
  <script>
    function copy(btn, text) {
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "Copied!"; btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1500);
      });
    }
    function fmt(s) {
      const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=Math.floor(s%60);
      return h?h+"h "+m+"m":m?m+"m "+ss+"s":ss+"s";
    }
    function tsStr(ms) {
      return new Date(ms).toLocaleTimeString([],{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
    }
    function durStr(ms) {
      if(!ms||ms<1) return "";
      if(ms<1000) return ms+"ms";
      return (ms/1000).toFixed(1)+"s";
    }
    function esc(s) {
      return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }

    let entries=[], filter="all", paused=false, stickBottom=true;
    const MAX_ENTRIES=3000;
    const FILE_TYPES=new Set(["read_file","read_multiple_files","write_file","write_file_chunk","search_replace","apply_patch","list_tree"]);
    const CMD_TYPES=new Set(["run_command","git_status","git_commit","git_diff","git_log","git_push","build_project","type_check","install_deps","add_dependency","remove_dependency"]);

    function matches(e) {
      if(filter==="all") return true;
      if(filter==="fail") return e.status==="fail";
      if(filter==="warn") return e.status==="warn";
      if(filter==="screenshot_preview") return e.type==="screenshot_preview";
      if(filter==="file") return FILE_TYPES.has(e.type);
      if(filter==="command") return CMD_TYPES.has(e.type);
      if(filter==="connect") return e.type==="connect"||e.type==="disconnect";
      return true;
    }
    function sClass(e) {
      if(e.type==="connect") return "s-connect";
      if(e.type==="disconnect") return "s-disconnect";
      return "s-"+(e.status||"pending");
    }
    function makeRow(e) {
      const expandData = [];
      if(e.action && Object.keys(e.action).length>0) {
        const compact = Object.assign({},e.action);
        delete compact.content; // skip large file content in expand view
        expandData.push("Request: "+JSON.stringify(compact,null,2).slice(0,2000));
      }
      if(e.detail && e.detail.length>0) expandData.push("Result:  "+e.detail);
      const expandHtml = esc(expandData.join(" ▸ "));
      return '<div class="entry '+sClass(e)+'" id="e-'+esc(e.id)+'" onclick="this.classList.toggle(\\'expanded\\')">'
        +'<div class="entry-ts">'+tsStr(e.ts)+'</div>'
        +'<div class="entry-icon"></div>'
        +'<div class="entry-body">'
          +'<div class="entry-human">'+esc(e.human||e.type)+'</div>'
          +(e.detail?'<div class="entry-detail">'+esc(e.detail)+'</div>':"")
        +'</div>'
        +'<div class="entry-dur">'+durStr(e.dur)+'</div>'
        +'<div class="entry-expand">'+expandHtml+'</div>'
        +'</div>';
    }

    let rAF=false;
    function schedRender() { if(!rAF){rAF=true;requestAnimationFrame(doRender);} }
    function doRender() {
      rAF=false;
      if(paused) return;
      const feed=document.getElementById("feed");
      const vis=entries.filter(matches);
      if(vis.length===0){
        feed.innerHTML='<div class="empty-feed">No entries match the current filter.</div>';
        updateStats(); return;
      }
      const existIds=new Set([...feed.querySelectorAll(".entry[id]")].map(el=>el.id.replace("e-","")));
      if(existIds.size===0||vis.length>existIds.size+100){
        // full rebuild
        feed.innerHTML=vis.map(makeRow).join("");
      } else {
        // incremental: append new, update changed
        const visSet=new Set(vis.map(e=>e.id));
        // remove stale
        for(const el of feed.querySelectorAll(".entry[id]")){
          if(!visSet.has(el.id.replace("e-",""))) el.remove();
        }
        for(const e of vis){
          if(!existIds.has(e.id)){
            feed.insertAdjacentHTML("beforeend",makeRow(e));
          } else {
            const el=document.getElementById("e-"+e.id);
            if(el){
              const wasExpanded=el.classList.contains("expanded");
              const fresh=document.createElement("div");
              fresh.innerHTML=makeRow(e);
              const nr=fresh.firstChild;
              if(wasExpanded) nr.classList.add("expanded");
              el.replaceWith(nr);
            }
          }
        }
      }
      if(stickBottom) feed.scrollTop=feed.scrollHeight;
      updateStats();
    }
    function updateStats() {
      document.getElementById("total-actions").textContent=entries.length;
      const fc=entries.filter(e=>e.status==="fail").length;
      const wc=entries.filter(e=>e.status==="warn").length;
      document.getElementById("fail-count").textContent=fc+(wc?" / "+wc+"w":"");
    }

    function connectSSE() {
      const dot=document.getElementById("sse-dot");
      dot.className="sse-dot";
      const since=entries.length>0?entries[entries.length-1].ts:0;
      const src=new EventSource("/api/activity-stream?since="+since);
      src.onopen=()=>{ dot.className="sse-dot live"; };
      src.onmessage=(ev)=>{
        try {
          const {event,entry}=JSON.parse(ev.data);
          if(event==="new"){
            entries.push(entry);
            if(entries.length>MAX_ENTRIES) entries.splice(0,entries.length-MAX_ENTRIES);
          } else if(event==="update"){
            for(var _i=entries.length-1;_i>=0;_i--){if(entries[_i].id===entry.id){entries[_i]=entry;break;}}
          }
          schedRender();
        } catch(e){}
      };
      src.onerror=()=>{ dot.className="sse-dot"; src.close(); setTimeout(connectSSE,3000); };
      const feed=document.getElementById("feed");
      feed.addEventListener("scroll",()=>{
        stickBottom=feed.scrollTop+feed.clientHeight>=feed.scrollHeight-40;
      });
    }

    async function refreshStatus() {
      try {
        const d=await(await fetch("/api/status")).json();
        const conn=d.connectedClients>0;
        const badge=document.getElementById("badge");
        badge.textContent=conn?d.connectedClients+" Connected":"Waiting";
        badge.className="badge "+(conn?"connected":"waiting");
        document.getElementById("clients").textContent=d.connectedClients;
        document.getElementById("uptime").textContent=fmt(d.uptime);
        const cl=document.getElementById("clients-list");
        cl.innerHTML=d.clients&&d.clients.length
          ?d.clients.map(c=>'<div class="client-row"><div class="dot"></div><span class="client-key">'+( c.project||"desktop")+'</span></div>').join("")
          :'<span class="empty">No desktops connected</span>';
      } catch(e){}
    }

    function setFilter(f,btn){
      filter=f;
      document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
      btn.classList.add("active");
      schedRender();
    }
    function clearFeed(){ entries=[]; schedRender(); }
    function togglePause(){
      paused=!paused;
      document.getElementById("pause-btn").textContent=paused?"Resume":"Pause";
      document.getElementById("feed").classList.toggle("paused",paused);
      if(!paused) schedRender();
    }

    connectSSE();
    refreshStatus();
    setInterval(refreshStatus,5000);
  </script>
</body>
</html>`;

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  if (pathname === "/desktop-connector.js") {
    try {
      const content = fs.readFileSync(path.join(__dirname, "desktop-connector.js"), "utf-8");
      res.writeHead(200, {
        "Content-Type": "application/javascript; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"desktop-connector.js\"",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      });
      res.end(content);
    } catch (e) {
      sendJson(res, { error: "desktop-connector.js not found on server" }, 404);
    }
    return;
  }
  if (pathname === "/start-connector.bat") {
    try {
      const content = fs.readFileSync(path.join(__dirname, "start-connector.bat"), "utf-8");
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment; filename=\"start-connector.bat\"",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      });
      res.end(content);
    } catch (e) {
      sendJson(res, { error: "start-connector.bat not found on server" }, 404);
    }
    return;
  }
  if (pathname === "/api/connectivity-test") {
    const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?";
    const ua = req.headers["user-agent"] || "";
    relayLog("info", `CONNECTIVITY-TEST from ip=${ip} ua=${ua.substring(0, 60)}`);
    sendJson(res, { ok: true, relay: "lamby-bridge", ts: Date.now(), ip, wsUrl: `wss://${req.headers.host || "bridge-relay.replit.app"}/bridge-ws?project=YOUR_PROJECT` });
    return;
  }
  if (pathname === "/api/download/source.zip") {
    try {
      const __dir = path.dirname(new URL(`file://${process.argv[1]}`).pathname);
      const readSafe = (f) => { try { return fs.readFileSync(path.join(__dir, f)); } catch { return Buffer.alloc(0); } };
      const zipFiles = [
        { name: "lamby-bridge/index.js",            data: readSafe("index.js") },
        { name: "lamby-bridge/desktop-connector.js", data: readSafe("desktop-connector.js") },
        { name: "lamby-bridge/start-connector.bat",  data: readSafe("start-connector.bat") },
      ].filter(f => f.data.length > 0);
      if (!zipFiles.length) { res.writeHead(500); res.end("No files found"); return; }
      const zipBuf = buildZip(zipFiles);
      res.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="lamby-bridge-source.zip"',
        "Content-Length": zipBuf.length,
        "Access-Control-Allow-Origin": "*",
      });
      res.end(zipBuf);
    } catch (e) {
      res.writeHead(500); res.end("ZIP build error: " + e.message);
    }
    return;
  }
  if (pathname === "/api/snapshot-key") {
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${protocol}://${host}`;
    sendJson(res, {
      baseUrl,
      connected: !!desktopClient?.alive,
      project: desktopClient?.project || null,
      snapshotUrl: `${baseUrl}/api/snapshot/PROJECT_NAME`,
      commandEndpoint: `${baseUrl}/api/sandbox/execute`,
      consoleLogsEndpoint: `${baseUrl}/api/console-logs`,
      bridgeWs: `wss://${host}/bridge-ws?project=PROJECT_NAME`,
    });
    return;
  }
  if (pathname === "/api/bridge-status") {
    const clients = desktopClient ? [{
      connected: desktopClient.alive,
      lastPing: desktopClient.lastPing,
      project: desktopClient.project || null,
    }] : [];
    sendJson(res, {
      connectedClients: clients.length,
      clients,
    });
    return;
  }
  if (pathname.startsWith("/api/snapshot/")) {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const pathParts = pathname.replace("/api/snapshot/", "").split("/").filter(Boolean);
    const projectName = pathParts[0] || "";

    // 1. Cache hit
    const cached = snapshotCache.get(projectName);
    if (cached && cached.expiresAt > Date.now()) {
      relayLog("info", `SNAPSHOT cache hit project=${projectName} expiresIn=${Math.round((cached.expiresAt - Date.now()) / 1000)}s`);
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" });
      res.end(cached.result);
      return;
    }

    // 2. Already in-flight for this project — join the waiters
    if (pendingSnapshots.has(projectName)) {
      const existing = pendingSnapshots.get(projectName);
      existing.waiters.add(res);
      req.on("close", () => existing.waiters.delete(res));
      relayLog("info", `SNAPSHOT fan-in project=${projectName} waiters=${existing.waiters.size}`);
      return; // response delivered by WS fan-out
    }

    // 3. New request — need a connected desktop
    const matchedClient = findBridgeClient();
    if (!matchedClient) {
      res.writeHead(503, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
      res.end("No desktop client connected.\nStart your Lamby desktop app and connect it to this relay.");
      return;
    }

    const requestId = crypto.randomUUID();
    const waiters = new Set([res]);
    req.on("close", () => waiters.delete(res));

    const timer = setTimeout(() => {
      const ps = pendingSnapshots.get(projectName);
      if (ps && ps.requestId === requestId) {
        pendingSnapshots.delete(projectName);
        relayLog("warn", `SNAPSHOT TIMEOUT 60s project=${projectName} waiters=${ps.waiters.size}`);
        const errStr = "Error: Relay timeout — desktop app did not respond within 60 seconds.";
        for (const r of ps.waiters) {
          if (!r.writableEnded) {
            r.writeHead(503, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
            r.end(errStr);
          }
        }
      }
    }, 60000);

    pendingSnapshots.set(projectName, { requestId, timer, waiters });

    try {
      relayLog("info", `→Desktop snapshot-request project=${projectName} reqId=${requestId.substring(0, 8)}...`);
      matchedClient.send(JSON.stringify({ type: "snapshot-request", requestId, projectName }));
    } catch (sendErr) {
      pendingSnapshots.delete(projectName);
      clearTimeout(timer);
      relayLog("error", `SNAPSHOT send failed: ${sendErr.message}`);
      res.writeHead(502, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
      res.end("Error: Could not reach desktop app through relay bridge.");
    }
    return; // response delivered by WS fan-out
  }
  if (pathname === "/api/console-logs") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const projectName = url.searchParams.get("project") || "";
    const matchedClient = findBridgeClient();
    if (!matchedClient) {
      sendJson(res, { error: "No desktop client connected." }, 503);
      return;
    }
    const requestId = crypto.randomUUID();
    const relayPromise = new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingConsoleLogRequests.delete(requestId);
        resolve({ error: "Relay timeout — desktop app did not respond within 15 seconds." });
      }, 15000);
      pendingConsoleLogRequests.set(requestId, { resolve, timer });
    });
    try {
      relayLog("info", `→Desktop console-logs-request project=${projectName} reqId=${requestId.substring(0, 8)}...`);
      matchedClient.send(JSON.stringify({ type: "console-logs-request", requestId, projectName }));
    } catch {
      sendJson(res, { error: "Could not reach desktop app." }, 502);
      return;
    }
    const logs = await relayPromise;
    sendJson(res, logs);
    return;
  }
  if (pathname === "/api/sandbox/execute") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const matchedClient = findBridgeClient();
      relayLog("info", `EXECUTE hasClient=${!!matchedClient} desktopAlive=${!!desktopClient?.alive}`);
      let rawBody;
      try {
        rawBody = await readBody(req);
        relayLog("info", `EXECUTE body received size=${rawBody.length} bytes`);
      } catch (bodyErr) {
        relayLog("error", `EXECUTE body read error: ${bodyErr.message}`);
        sendJson(res, { error: bodyErr.message }, 413);
        return;
      }
      let body;
      try {
        body = parseWithRepair(rawBody, "EXECUTE");
      } catch (parseErr) {
        relayLog("error", `EXECUTE JSON parse error: ${parseErr.message} raw(200)=${rawBody.substring(0, 200)}`);
        sendJson(res, { error: "Invalid JSON body" }, 400);
        return;
      }
      const actions = body.actions ?? body.types ?? body.commands ?? body.data ?? body.payload;
      if (!Array.isArray(actions) || actions.length === 0) {
        relayLog("warn", `EXECUTE 400 actions missing or empty. Body keys: ${Object.keys(body).join(", ")}`);
        sendJson(res, { error: "actions array required" }, 400); return;
      }
      if (actions.length > 100) { sendJson(res, { error: "Max 100 actions per request" }, 400); return; }
      relayLog("info", `EXECUTE actions(${actions.length}): ${actions.map(a => a.type + (a.project ? "@" + a.project : "")).join(", ")}`);
      const liveClient = await waitForClient();
      if (!liveClient) {
        relayLog("warn", `EXECUTE 503 no alive client found after wait. desktopClient=${!!desktopClient}`);
        sendJson(res, { error: "No desktop client connected. Start your Lamby desktop app and connect it to this relay." }, 503);
        return;
      }
      const requestId = crypto.randomUUID();
      const relayPromise = makeRelayPromise(requestId, req, 120000, "EXECUTE");
      try {
        relayLog("info", `→Desktop EXECUTE reqId=${requestId.substring(0, 8)}... actions=[${actions.map(a => a.type).join(",")}]`);
        liveClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions }));
        relayLog("info", `→Desktop EXECUTE sent OK, waiting for response... reqId=${requestId.substring(0, 8)}...`);
      } catch (sendErr) {
        relayLog("error", `→Desktop EXECUTE send failed: ${sendErr.message} reqId=${requestId.substring(0, 8)}...`);
        sendJson(res, { error: "Could not reach desktop app through relay bridge." }, 502);
        return;
      }
      const _execT0 = Date.now();
      const _execEntries = actions.map(action => pushActivity({
        type: action.type, project: action.project || "", status: "pending",
        human: humanizeAction(action.type, action), detail: "waiting for desktop…", action
      }));
      const result = await relayPromise;
      try { if (parseWithRepair(result, "EXECUTE disconnect-check").__clientDisconnected) { relayLog("info", `EXECUTE dropping result — client already gone reqId=${requestId.substring(0, 8)}...`); return; } } catch {}
      relayLog("info", `←Desktop EXECUTE responded reqId=${requestId.substring(0, 8)}... size=${result.length} preview=${result.substring(0, 120)}`);
      try {
        const parsed = parseWithRepair(result, "EXECUTE result");
        const dur = Date.now() - _execT0;
        _execEntries.forEach((entry, i) => {
          const actionType = actions[i]?.type;
          const rData = parsed?.results?.[i]?.data;
          const ok = rData?.success !== false && !rData?.error;
          const detail = resultSummary(actionType, parsed?.results?.[i] ? { results: [parsed.results[i]] } : parsed) || (rData?.error ? rData.error.slice(0,150) : ok ? "ok" : "unknown");
          updateActivity(entry, { status: ok ? "ok" : "fail", dur, human: humanizeAction(actionType, actions[i], rData), detail });
        });
      } catch {}
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(result);
    } catch (err) {
      relayLog("error", `EXECUTE unhandled error: ${err.message}`);
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }
  if (pathname === "/api/sandbox/audit-log") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    sendJson(res, { entries: activityLog.slice(-200) });
    return;
  }
  if (pathname === "/api/activity-log") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const _alLimit = Math.min(parseInt(url.searchParams.get("limit") || "500", 10), 5000);
    const _alProject = url.searchParams.get("project") || "";
    const _alStatus = url.searchParams.get("status") || "";
    const _alType = url.searchParams.get("type") || "";
    const _alSince = parseInt(url.searchParams.get("since") || "0", 10);
    let _alEntries = activityLog.slice();
    if (_alProject) _alEntries = _alEntries.filter(e => e.project === _alProject);
    if (_alStatus) _alEntries = _alEntries.filter(e => e.status === _alStatus);
    if (_alType) _alEntries = _alEntries.filter(e => e.type === _alType);
    if (_alSince) _alEntries = _alEntries.filter(e => e.ts > _alSince);
    _alEntries = _alEntries.slice(-_alLimit);
    const _alCountByStatus = {};
    for (const e of activityLog) { _alCountByStatus[e.status] = (_alCountByStatus[e.status] || 0) + 1; }
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" });
    res.end(JSON.stringify({ total: activityLog.length, returned: _alEntries.length, countByStatus: _alCountByStatus, entries: _alEntries }));
    return;
  }
  if (pathname === "/api/activity-stream") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const _asSince = parseInt(url.searchParams.get("since") || "0", 10);
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "Access-Control-Allow-Origin": "*" });
    res.write(": connected\n\n");
    // Send backfill of entries since `since`
    const _backfill = _asSince ? activityLog.filter(e => e.ts > _asSince) : activityLog.slice(-200);
    for (const e of _backfill) {
      try { res.write(`data: ${JSON.stringify({ event: "new", entry: e })}\n\n`); } catch { break; }
    }
    activityLogSSEClients.add(res);
    const _asKA = setInterval(() => { try { res.write(": ka\n\n"); } catch { clearInterval(_asKA); activityLogSSEClients.delete(res); } }, 20000);
    const _asClean = () => { activityLogSSEClients.delete(res); clearInterval(_asKA); };
    req.on("close", _asClean); req.on("error", _asClean);
    return;
  }
  if (pathname === "/api/grok") {
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${protocol}://${host}`;
    const proxyBase = `${baseUrl}/api/grok-proxy?payload=`;
    // Detect actual connected project name — Grok reads examples and copies the
    // project field literally into its real API calls. Using "my-app" placeholder
    // causes every command to fail with 503 because no such project is connected.
    const connectedProject = (desktopClient?.alive && desktopClient.project) ? desktopClient.project : null;
    const _P = connectedProject || "YOUR_PROJECT_NAME";
    const commands = [
      { type: "list_projects", desc: "⭐ CALL THIS FIRST if unsure of project name — lists all projects found under PROJECT_DIR with their directory path, hasDev flag, and active dev port. Returns {projects:[{name, dir, hasDev, activePort}]}. Use the 'name' field as the project value in all subsequent commands.", example: { type: "list_projects" } },
      { type: "list_tree", desc: "List files in a project directory", example: { type: "list_tree", project: "my-app", path: "src" } },
      { type: "read_file", desc: "Read a file's full content", example: { type: "read_file", project: "my-app", path: "src/index.html" } },
      { type: "read_multiple_files", desc: "Read several files at once", example: { type: "read_multiple_files", project: "my-app", paths: ["src/index.html","src/main.js"] } },
      { type: "write_file", desc: "Write/overwrite a file — use ONLY for content under 2 KB (config files, small scripts). For larger files use write_file_chunk. CAUTION: Before writing App.tsx read src/index.tsx first — it may import from 'components/App' not 'App', meaning the real file is src/components/App.tsx.", example: { type: "write_file", project: "my-app", path: "src/config.json", content: "{}" } },
      { type: "write_file_chunk", desc: "Write a large file in pieces — REQUIRED for any content > 2 KB (full components, pages, etc.). Split content into chunks of ~1500 chars each. Send one action per chunk; file is assembled and written when the final chunk arrives. CAUTION: Before writing App.tsx read src/index.tsx first to find the correct path (may be src/components/App.tsx not src/App.tsx).", example: { type: "write_file_chunk", project: "my-app", path: "src/App.tsx", chunk_index: 0, total_chunks: 3, content: "import React..." } },
      { type: "create_file", desc: "Create a new file", example: { type: "create_file", project: "my-app", path: "src/new.js", content: "" } },
      { type: "delete_file", desc: "Delete a file", example: { type: "delete_file", project: "my-app", path: "src/old.js" } },
      { type: "search_replace", desc: "Find and replace text in a file (best for small edits)", example: { type: "search_replace", project: "my-app", path: "src/index.html", search: "old text", replace: "new text" } },
      { type: "bulk_write", desc: "Write multiple files at once", example: { type: "bulk_write", project: "my-app", files: [{ path: "a.js", content: "..." }] } },
      { type: "apply_patch", desc: "Apply a unified diff patch", example: { type: "apply_patch", project: "my-app", patch: "--- a/src/index.html\n+++ b/src/index.html\n..." } },
      { type: "move_file", desc: "Move/rename a file", example: { type: "move_file", project: "my-app", from: "src/old.js", to: "src/new.js" } },
      { type: "copy_file", desc: "Copy a file", example: { type: "copy_file", project: "my-app", from: "src/a.js", to: "src/b.js" } },
      { type: "delete_folder", desc: "Delete a folder", example: { type: "delete_folder", project: "my-app", path: "src/unused" } },
      { type: "create_folder", desc: "Create a folder", example: { type: "create_folder", project: "my-app", path: "src/new-dir" } },
      { type: "bulk_delete", desc: "Delete multiple files", example: { type: "bulk_delete", project: "my-app", paths: ["src/a.js","src/b.js"] } },
      { type: "grep", desc: "Regex search across files", example: { type: "grep", project: "my-app", pattern: "TODO", path: "src" } },
      { type: "grep_advanced", desc: "Grep with include/exclude globs", example: { type: "grep_advanced", project: "my-app", pattern: "console\\.log", include: "**/*.js" } },
      { type: "search_files", desc: "Full-text search across project", example: { type: "search_files", project: "my-app", query: "background-color" } },
      { type: "symbol_search", desc: "Find function/class definitions", example: { type: "symbol_search", project: "my-app", symbol: "handleClick" } },
      { type: "find_usages", desc: "Find all usages of a symbol", example: { type: "find_usages", project: "my-app", symbol: "fetchUser" } },
      { type: "run_command", desc: "Run a shell command in the project", example: { type: "run_command", project: "my-app", command: "npm run build" } },
      { type: "run_command_advanced", desc: "Run command with cwd/env options", example: { type: "run_command_advanced", project: "my-app", command: "ls -la", cwd: "src" } },
      { type: "install_deps", desc: "Install all dependencies", example: { type: "install_deps", project: "my-app" } },
      { type: "add_dependency", desc: "Add an npm package", example: { type: "add_dependency", project: "my-app", package: "lodash" } },
      { type: "remove_dependency", desc: "Remove an npm package", example: { type: "remove_dependency", project: "my-app", package: "lodash" } },
      { type: "type_check", desc: "Run TypeScript type checker", example: { type: "type_check", project: "my-app" } },
      { type: "lint_and_fix", desc: "Lint and auto-fix code", example: { type: "lint_and_fix", project: "my-app" } },
      { type: "format_files", desc: "Format files with Prettier", example: { type: "format_files", project: "my-app", paths: ["src/index.ts"] } },
      { type: "git_status", desc: "git status", example: { type: "git_status", project: "my-app" } },
      { type: "git_diff", desc: "git diff (staged or unstaged)", example: { type: "git_diff", project: "my-app" } },
      { type: "git_add", desc: "git add files", example: { type: "git_add", project: "my-app", paths: ["."] } },
      { type: "git_commit", desc: "git commit with message", example: { type: "git_commit", project: "my-app", message: "fix: update styles" } },
      { type: "git_log", desc: "git log (recent commits)", example: { type: "git_log", project: "my-app", limit: 10 } },
      { type: "git_branch", desc: "List or create branches", example: { type: "git_branch", project: "my-app" } },
      { type: "git_checkout", desc: "Checkout a branch", example: { type: "git_checkout", project: "my-app", branch: "main" } },
      { type: "git_push", desc: "git push", example: { type: "git_push", project: "my-app" } },
      { type: "git_pull", desc: "git pull", example: { type: "git_pull", project: "my-app" } },
      { type: "git_merge", desc: "Merge a branch", example: { type: "git_merge", project: "my-app", branch: "feature-x" } },
      { type: "git_stash", desc: "Stash changes", example: { type: "git_stash", project: "my-app" } },
      { type: "git_stash_pop", desc: "Pop stash", example: { type: "git_stash_pop", project: "my-app" } },
      { type: "git_reset", desc: "git reset", example: { type: "git_reset", project: "my-app", mode: "soft", ref: "HEAD~1" } },
      { type: "git_revert", desc: "git revert a commit", example: { type: "git_revert", project: "my-app", commit: "abc1234" } },
      { type: "git_tag", desc: "Create/list git tags", example: { type: "git_tag", project: "my-app", tag: "v1.0.0" } },
      { type: "git_init", desc: "git init", example: { type: "git_init", project: "my-app" } },
      { type: "detect_structure", desc: "Detect project framework/structure", example: { type: "detect_structure", project: "my-app" } },
      { type: "project_analyze", desc: "Deep project analysis", example: { type: "project_analyze", project: "my-app" } },
      { type: "component_tree", desc: "React component tree", example: { type: "component_tree", project: "my-app" } },
      { type: "extract_theme", desc: "Extract design tokens/theme", example: { type: "extract_theme", project: "my-app" } },
      { type: "extract_colors", desc: "Extract all colors used", example: { type: "extract_colors", project: "my-app" } },
      { type: "extract_imports", desc: "Map all import dependencies", example: { type: "extract_imports", project: "my-app", path: "src/index.ts" } },
      { type: "dependency_graph", desc: "Full dependency graph", example: { type: "dependency_graph", project: "my-app" } },
      { type: "dead_code_detection", desc: "Find unused code", example: { type: "dead_code_detection", project: "my-app" } },
      { type: "tailwind_audit", desc: "Audit Tailwind CSS usage", example: { type: "tailwind_audit", project: "my-app" } },
      { type: "build_project", desc: "Build the project", example: { type: "build_project", project: "my-app" } },
      { type: "run_tests", desc: "Run test suite", example: { type: "run_tests", project: "my-app" } },
      { type: "get_build_metrics", desc: "Bundle size and build info", example: { type: "get_build_metrics", project: "my-app" } },
      { type: "start_process", desc: "Start a background process", example: { type: "start_process", project: "my-app", command: "npm run dev" } },
      { type: "start_process_named", desc: "Start named background process", example: { type: "start_process_named", project: "my-app", name: "devserver", command: "npm run dev" } },
      { type: "kill_process", desc: "Kill a process by PID or name", example: { type: "kill_process", project: "my-app", pid: 1234 } },
      { type: "list_processes", desc: "List running processes", example: { type: "list_processes", project: "my-app" } },
      { type: "monitor_process", desc: "Get process status/cpu/mem", example: { type: "monitor_process", project: "my-app", name: "devserver" } },
      { type: "get_process_logs", desc: "Get stdout/stderr of a process", example: { type: "get_process_logs", project: "my-app", name: "devserver" } },
      { type: "stop_all_processes", desc: "Stop all running processes", example: { type: "stop_all_processes", project: "my-app" } },
      { type: "list_open_ports", desc: "List ports in use", example: { type: "list_open_ports", project: "my-app" } },
      { type: "restart_dev_server", desc: "Restart dev server", example: { type: "restart_dev_server", project: "my-app" } },
      { type: "switch_port", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — use manage_scripts to update port in package.json scripts, then call restart_dev_server", example: { type: "switch_port", project: "my-app", port: 3001 } },
      { type: "set_env_var", desc: "Set an environment variable", example: { type: "set_env_var", project: "my-app", key: "API_URL", value: "https://api.example.com" } },
      { type: "get_env_vars", desc: "List env vars", example: { type: "get_env_vars", project: "my-app" } },
      { type: "capture_preview", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — use the /api/screenshot/PROJECT URL instead (see screenshotEndpoint at top of this response)", example: { type: "capture_preview", project: "YOUR_PROJECT_NAME" } },
      { type: "get_preview_url", desc: "Get the live preview URL", example: { type: "get_preview_url", project: "YOUR_PROJECT_NAME" } },
      { type: "get_dom_snapshot", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires browser DevTools Protocol. Use get_preview_url + grep_search on source files instead", example: { type: "get_dom_snapshot", project: "my-app", url: "/" } },
      { type: "get_console_errors", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires browser DevTools Protocol. Use get_process_logs or run_command('npm run build') instead", example: { type: "get_console_errors", project: "my-app" } },
      { type: "visual_diff", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires image diffing. Take before/after screenshots with /api/screenshot-url instead", example: { type: "visual_diff", project: "my-app" } },
      { type: "capture_component", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — use the /api/screenshot/PROJECT URL instead (see screenshotEndpoint at top of this response)", example: { type: "capture_component", project: "YOUR_PROJECT_NAME", component: "Button" } },
      { type: "rollback_last_change", desc: "Undo last file change", example: { type: "rollback_last_change", project: "my-app" } },
      { type: "generate_component", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires AI/LLM connection. Use write_file or create_file to write the component manually", example: { type: "generate_component", project: "my-app", name: "PricingCard", description: "A pricing card with title, price, and CTA button" } },
      { type: "generate_page", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires AI/LLM connection. Use write_file to create the page", example: { type: "generate_page", project: "my-app", name: "Landing", description: "Hero + features + CTA" } },
      { type: "generate_test", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires AI/LLM connection. Use write_file to create test files", example: { type: "generate_test", project: "my-app", path: "src/Button.tsx" } },
      { type: "refactor_file", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires AI/LLM connection. Use search_replace + write_file for targeted edits", example: { type: "refactor_file", project: "my-app", path: "src/utils.ts", instruction: "split into separate modules" } },
      { type: "optimize_code", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires AI/LLM connection. Use type_check + lint_and_fix to catch obvious issues", example: { type: "optimize_code", project: "my-app", path: "src/heavy.ts" } },
      { type: "validate_change", desc: "Lint+type-check after a change", example: { type: "validate_change", project: "my-app" } },
      { type: "super_command", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires AI/LLM to interpret natural language. Break into specific commands: list_tree → read_file → search_replace → git_commit", example: { type: "super_command", project: "my-app", instruction: "Add a dark mode toggle to the header" } },
      { type: "update_package_json", desc: "Edit package.json fields", example: { type: "update_package_json", project: "my-app", fields: { version: "1.2.0" } } },
      { type: "manage_scripts", desc: "Add/edit npm scripts", example: { type: "manage_scripts", project: "my-app", scripts: { preview: "vite preview" } } },
      { type: "bundle_analyzer", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires browser treemap. Use get_build_metrics for bundle size info instead", example: { type: "bundle_analyzer", project: "my-app" } },
      { type: "security_scan", desc: "Scan for security issues via npm audit", example: { type: "security_scan", project: "my-app" } },
      { type: "accessibility_audit", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires axe-core in browser. Use run_command('npx axe-cli http://localhost:PORT') instead", example: { type: "accessibility_audit", project: "my-app" } },
      // ── Commands implemented in connector but missing from this list ─────
      { type: "screenshot_preview", desc: "Take a screenshot of the running dev server. Connector captures PNG via headless Chrome, sends base64 to relay, relay serves it at /api/screenshot-data/PROJECT — 100% reliable, no external upload needed. Returns {captured:true, screenshotUrl:'https://RELAY/api/screenshot-data/project', relayServed:true}.", example: { type: "screenshot_preview", project: "my-app", fullPage: true, waitMs: 3000 } },
      { type: "glob_search", desc: "Glob pattern search across project files", example: { type: "glob_search", project: "my-app", pattern: "**/*.tsx" } },
      { type: "grep_search", desc: "Regex search across files (alias for grep)", example: { type: "grep_search", project: "my-app", pattern: "useState", path: "src" } },
      { type: "rename_file", desc: "Rename a file (alias for move_file)", example: { type: "rename_file", project: "my-app", from: "src/old.ts", to: "src/new.ts" } },
      { type: "move_folder", desc: "Move or rename a folder", example: { type: "move_folder", project: "my-app", from: "src/components", to: "src/ui" } },
      { type: "rename_folder", desc: "Rename a folder (alias for move_folder)", example: { type: "rename_folder", project: "my-app", from: "src/old-dir", to: "src/new-dir" } },
      { type: "list_tree_filtered", desc: "List files filtered by extension or query", example: { type: "list_tree_filtered", project: "my-app", extension: ".tsx", query: "Button" } },
      { type: "git_revert", desc: "Revert a commit", example: { type: "git_revert", project: "my-app", commit: "abc1234" } },
      { type: "git_tag", desc: "Create or list git tags", example: { type: "git_tag", project: "my-app", tag: "v1.0.0" } },
      { type: "git_init", desc: "Initialize a git repository", example: { type: "git_init", project: "my-app" } },
      { type: "browser_interact", desc: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires the full Electron desktop app with embedded Chromium. Use screenshot_preview + write_file for edits instead.", example: { type: "browser_interact", project: "my-app", action: "click", selector: "#btn" } },
    ];
    // Build example payloads using the real connected project name
    const exampleReadPayload = Buffer.from(JSON.stringify({ actions: [{ type: "read_file", project: _P, path: "src/index.html" }] })).toString("base64");
    const exampleReplacePayload = Buffer.from(JSON.stringify({ actions: [{ type: "search_replace", project: _P, path: "src/index.html", search: "old text", replace: "new text" }] })).toString("base64");
    const _grokResponseObj = {

      // ═══════════════════════════════════════════════════════════════════
      // 1. CONNECTION STATE — read this first
      // ═══════════════════════════════════════════════════════════════════
      connection: {
        status: connectedProject ? "CONNECTED" : "WAITING",
        connectedProject: _P,
        connectedDesktops: desktopClient ? 1 : 0,
        relayBaseUrl: baseUrl,
        note: connectedProject
          ? `Desktop is live — project "${_P}" detected. All examples below already use this project name. Do NOT change it.`
          : "No desktop connected yet. Start the connector on the Windows machine. Examples show YOUR_PROJECT_NAME — replace once connected.",
      },

      // ═══════════════════════════════════════════════════════════════════
      // 2. SYSTEM ARCHITECTURE — how the whole chain works
      // ═══════════════════════════════════════════════════════════════════
      architecture: {
        overview: "Lamby Bridge Relay — zero-dependency WebSocket bridge between Grok (cloud AI) and a local Windows desktop running Node.js.",
        requestChain: [
          "1. Grok builds payload = base64(JSON.stringify({actions:[{type,project,...}]}))",
          "2. Grok issues HTTP GET /api/grok-proxy?payload=PAYLOAD to this relay (Replit cloud)",
          "3. Relay decodes payload, forwards actions via WebSocket to the connected desktop connector",
          "4. Desktop connector (Node.js on Windows) executes: file I/O, shell commands, git, etc.",
          "5. Connector sends result back over WebSocket",
          "6. Relay returns JSON to Grok: {success:true, results:[{type:'command_type', data:{...}}]}",
        ],
        constraints: [
          "Grok is GET-only — every request must be a GET URL. POST is not available.",
          "URL length limit ~8 KB total — file content > 2 KB WILL be silently truncated in the URL.",
          "All commands are async over WebSocket — relay waits up to 30s for desktop response.",
          "Desktop connector runs on Windows — use PowerShell syntax for run_command shell commands.",
          "One WebSocket connection per desktop instance — commands queue; do not fire many in parallel.",
        ],
        projectResolution: "The connector resolves project names to disk paths. Given project='groks-app', it looks for: PROJECT_DIR/projects/groks-app → then PROJECT_DIR/groks-app. PROJECT_DIR is the root set in the connector's .env (default: cwd). File paths in commands are relative to the resolved project root.",
        devServerDetection: "The connector dynamically detects the Vite/Next/CRA dev server port by scanning active TCP listeners on ports 3000–9999 using netstat. Result cached for 2 minutes. Use get_preview_url to get the live URL.",
        hmr: "Vite uses Hot Module Replacement — writing a file via write_file or write_file_chunk triggers an instant browser update with no server restart needed, ONLY if you write to the correct file (the one actually imported by index.tsx).",
      },

      // ═══════════════════════════════════════════════════════════════════
      // 3. CRITICAL RULES — violations cause silent failures
      // ═══════════════════════════════════════════════════════════════════
      criticalRules: [
        "RULE 1 — LARGE FILES: Any file content > 2 KB (React components, pages, full modules) MUST use write_file_chunk. Split into ~1500-char chunks, send chunk_index 0..N-1, total_chunks=N. One action per chunk. File assembles and writes only when final chunk arrives. write_file on large content silently truncates the URL and corrupts the file.",
        "RULE 2 — ENTRY POINT: Before writing App.tsx (or any root component) ALWAYS read src/index.tsx first. Projects often import from 'components/App' not 'App', so the real file is src/components/App.tsx. Writing to src/App.tsx when nothing imports it has zero visible effect — the app won't change.",
        "RULE 3 — ADD DEPENDENCY: add_dependency only edits package.json. You MUST follow it with install_deps to actually install the package into node_modules. Without install_deps, imports will fail at build time.",
        "RULE 4 — SEARCH_REPLACE ZERO MATCHES: If search_replace returns {zeroReplacements:true}, the exact string was NOT found in the file. Read the file first with read_file, copy the exact target text (including whitespace/newlines), then retry.",
        "RULE 5 — PROJECT NAME: Always use the exact connected project name from connection.connectedProject. Never substitute 'my-app', 'YOUR_PROJECT_NAME', or any guess. Every command will 503 if the project field doesn't match the connected project.",
        "RULE 6 — WINDOWS SHELL: run_command runs on Windows. Use PowerShell syntax: Set-Location not cd, Get-ChildItem not ls, $env:VAR not $VAR. Avoid Unix-only tools (grep, awk, sed, tail) — use Select-String, Get-Content, etc.",
        "RULE 7 — VERIFY CHANGES: After any file edit, confirm the change took effect by either: (a) read_file and check the content, or (b) take a screenshot_preview. Never assume an edit worked without verification.",
      ],

      // ═══════════════════════════════════════════════════════════════════
      // 4. HOW TO MAKE A REQUEST
      // ═══════════════════════════════════════════════════════════════════
      howToRequest: {
        endpoint: `${baseUrl}/api/grok-proxy`,
        method: "GET",
        params: {
          payload: "base64(JSON.stringify({actions:[{type,project,...params}]}))"
        },
        encoding: {
          step1: "Build actions array: [{type:'read_file', project:'groks-app', path:'src/index.tsx'}]",
          step2: "JSON.stringify the wrapper: JSON.stringify({actions:[...]})",
          step3: "base64 encode: btoa(step2)  — or Buffer.from(step2).toString('base64') in Node",
          step4: "URL-encode the base64 if it contains + or = characters",
          step5: `GET ${baseUrl}/api/grok-proxy?payload=ENCODED_BASE64`,
        },
        autoRepair: "Relay auto-fixes common encoding mistakes: escapes raw control chars, strips trailing commas, accepts 'types'/'commands'/'data'/'payload' as aliases for 'actions'.",
        batchActions: "You can chain up to 10 actions in one request. All execute sequentially on the desktop. Results come back as results[0], results[1], etc.",
        exampleUrls: {
          readFile: `${proxyBase}${exampleReadPayload}`,
          searchReplace: `${proxyBase}${exampleReplacePayload}`,
        },
      },

      // ═══════════════════════════════════════════════════════════════════
      // 5. RESPONSE FORMAT — how to parse every response
      // ═══════════════════════════════════════════════════════════════════
      responseFormat: {
        successWrapper: '{ "success": true, "results": [ { "type": "command_type", "data": { ...command-specific fields... } } ] }',
        errorWrapper: '{ "success": false, "error": "description" }',
        accessPattern: "results[N].data — where N matches the position of your action in the actions array",
        commandSchemas: {
          list_tree:          '{ success:true, fileTree:"index.html\\nsrc/\\n  components/\\n    App.tsx\\n  index.tsx\\n..." }',
          read_file:          '{ success:true, content:"full file text", path:"src/index.tsx", size:1234 }',
          read_multiple_files:'{ success:true, files:[{path,content,size},...] }',
          write_file:         '{ success:true, path:"src/config.json", bytesWritten:42 }',
          write_file_chunk:   'buffering: { received:N, waiting_for:M, done:false } | final chunk: { done:true, bytes:7024, path:"src/App.tsx" }',
          search_replace:     '{ success:true, replacements:1, path:"src/App.tsx" } | { zeroReplacements:true } = string not found — read file first',
          create_file:        '{ success:true, path:"src/new.tsx" }',
          delete_file:        '{ success:true, path:"src/old.tsx" }',
          grep:               '{ success:true, results:[{file,line,col,match,context},...], count:N }',
          run_command:        '{ success:true, stdout:"...", stderr:"...", exitCode:0, command:"..." }',
          install_deps:       '{ success:true, stdout:"...", stderr:"...", packageManager:"pnpm" }',
          add_dependency:     '{ success:true, package:"react-markdown" } — WARNING: only updates package.json; run install_deps after',
          type_check:         '{ passed:true, errorCount:0 } | { passed:false, errorCount:N, errors:[{file,line,col,code,message}] }',
          lint_and_fix:       '{ success:true, output:"...", fixed:true }',
          build_project:      '{ built:true, stdout:"...", stderr:"..." } | { built:false, stderr:"error output..." }',
          get_build_metrics:  '{ totalKb:165, files:[{name,kb},...] }',
          git_status:         '{ success:true, modified:[...], untracked:[...], staged:[...], branch:"main" }',
          git_add:            '{ success:true }',
          git_commit:         '{ success:true, hash:"abc1234", message:"..." }',
          git_log:            '{ success:true, commits:[{hash,author,date,message},...] }',
          screenshot_preview: '{ captured:true, screenshotUrl:"https://RELAY/api/screenshot-data/project", relayServed:true } — PNG served from relay memory, no external upload. Browse screenshotUrl directly to see the app.',
          get_preview_url:    '{ success:true, url:"http://localhost:PORT", port:PORT }',
          detect_structure:   '{ success:true, framework:"react-vite", packageManager:"pnpm", hasTypeScript:true, hasTailwind:true }',
          project_analyze:    '{ success:true, fileCount:N, dependencyCount:N, framework:"...", ... }',
        },
        timeouts: "Desktop has 30s to respond. Long operations (pnpm install, build) may use more — use run_command with explicit timeout-safe commands if needed.",
      },

      // ═══════════════════════════════════════════════════════════════════
      // 6. WORKFLOW GUIDES — step-by-step for common tasks
      // ═══════════════════════════════════════════════════════════════════
      workflowGuides: {
        editUIComponent: {
          goal: "Change visible text, styles, or logic in the running app",
          steps: [
            "1. list_tree — map the project file structure",
            "2. read_file src/index.tsx (or src/main.tsx) — find which file it imports for the root component",
            "3. read_file on the actual component path found in step 2",
            "4a. search_replace — for targeted edits (change a class, rename a string). PREFERRED for small changes.",
            "4b. write_file_chunk — for full rewrites of components > 2 KB. Split into ~1500-char chunks.",
            "5. read_file the edited file — verify the content looks correct",
            "6. screenshot_preview or GET /api/screenshot-url/PROJECT — confirm the visual change",
          ],
          note: "Vite HMR updates the browser instantly when a file changes — no server restart needed.",
        },
        installAndUsePackage: {
          goal: "Add a new npm package and use it in code",
          steps: [
            "1. add_dependency — adds package to package.json",
            "2. install_deps — actually installs it into node_modules (REQUIRED — add_dependency alone is not enough)",
            "3. write_file_chunk or search_replace — add the import and usage to the component",
            "4. type_check — confirm no TS errors",
            "5. build_project — confirm it compiles clean",
          ],
        },
        debugBuildFailure: {
          goal: "Fix a build or type error",
          steps: [
            "1. build_project — get the full error output from stderr",
            "2. grep or read_file the file mentioned in the error",
            "3. search_replace — fix the specific error location",
            "4. type_check — verify errors are gone",
            "5. build_project — confirm clean build",
          ],
        },
        fullComponentRewrite: {
          goal: "Replace a React component with new code (> 2 KB)",
          steps: [
            "1. read_file src/index.tsx — find the correct component path (e.g. components/App)",
            "2. Build the full new component text locally",
            "3. Split into chunks: every ~1500 chars = one chunk",
            "4. Send write_file_chunk for chunk_index 0, total_chunks=N",
            "5. Send write_file_chunk for chunk_index 1..N-1",
            "6. Final chunk response will have {done:true, bytes:N} — file is now written",
            "7. read_file to verify the assembled content is correct",
            "8. type_check — confirm no errors",
            "9. screenshot_preview — confirm the UI updated",
          ],
        },
        gitWorkflow: {
          goal: "Commit changes to git",
          steps: [
            "1. git_status — see what changed",
            "2. git_add {paths:['.']} — stage all",
            "3. git_commit {message:'feat: description'} — commit",
            "4. (optional) git_push — push to remote",
          ],
        },
      },

      // ═══════════════════════════════════════════════════════════════════
      // 7. KNOWN GOTCHAS — things that fail silently or confusingly
      // ═══════════════════════════════════════════════════════════════════
      knownGotchas: [
        "WRONG APP FILE: Writing to src/App.tsx when index.tsx imports from 'components/App' → file is written but app never changes. Always read index.tsx first.",
        "LARGE WRITE TRUNCATION: write_file with content > ~2 KB → URL is silently truncated by the browser/proxy → file on disk is a corrupted partial. Use write_file_chunk.",
        "ADD_DEPENDENCY WITHOUT INSTALL: add_dependency → package.json updated but pnpm/npm install NOT run → TypeScript can't find the module → build fails. Always follow with install_deps.",
        "ZERO REPLACEMENTS: search_replace returns {zeroReplacements:true} → the exact search string (including whitespace, quotes, semicolons) was not found in the file → read_file first, copy exact text, retry.",
        "WRONG PROJECT NAME: Using 'my-app' or any name other than the connected project → relay returns 503. If unsure, call list_projects first — it scans the desktop and returns all known project names and their disk paths. Use the 'name' field from that result.",
        "UNIX COMMANDS ON WINDOWS: run_command with grep/ls/cat/sed/awk → PowerShell doesn't have these → use Select-String, Get-ChildItem, Get-Content, etc.",
        "CHUNK ORDER MATTERS: write_file_chunk with out-of-order chunk_index → file assembles incorrectly. Always send chunks 0, 1, 2, ... in order.",
        "STALE CHUNKS: If you start a chunked write but don't finish it within 5 minutes, the relay purges the partial buffer. Start again from chunk_index 0.",
        "SCREENSHOT: screenshot_preview now sends PNG as base64 over WebSocket → relay caches it and serves at /api/screenshot-data/PROJECT (no catbox.moe, no external network, always works). screenshotUrl in the response IS this relay URL. Just browse it.",
        "DEV SERVER NOT RUNNING: get_preview_url returns no port → dev server is not started. Use run_command 'pnpm run dev' or restart_dev_server.",
        "TYPE ERRORS AFTER EDIT: search_replace changed a type signature → import still uses old type → type_check will catch it. Always run type_check after structural changes.",
        "VITE CACHE: In rare cases Vite caches old module despite file change → run restart_dev_server to force a full reload.",
      ],

      // ═══════════════════════════════════════════════════════════════════
      // 8. ENDPOINTS REFERENCE
      // ═══════════════════════════════════════════════════════════════════
      endpoints: {
        grokProxy: {
          url: `${baseUrl}/api/grok-proxy?payload=BASE64`,
          use: "Execute any action(s) against the desktop. Primary endpoint.",
          method: "GET",
        },
        grokEdit: {
          url: `${baseUrl}/api/grok-edit?project=PROJECT&path=FILE&search=OLD&replace=NEW`,
          use: "Search-and-replace with NO encoding — plain query params. Best for targeted text swaps.",
          method: "GET",
          b64Variant: `${baseUrl}/api/grok-edit?project=PROJECT&path=FILE&searchB64=B64&replaceB64=B64`,
          b64Note: "Use searchB64/replaceB64 for content with special chars (JSX, quotes, angle brackets).",
          note: "Returns {zeroReplacements:true} if string not found. Screenshot cache refreshes on success.",
        },
        screenshotData: {
          url: `${baseUrl}/api/screenshot-data/YOUR_PROJECT_NAME`,
          use: "⭐ PRIMARY — Serves the raw PNG directly from relay memory. No catbox, no external network. Returns Content-Type: image/png. Browse this URL to see the app. Updated every time screenshot_preview runs.",
          method: "GET",
          note: "This URL is what screenshotUrl contains after screenshot_preview. 100% reliable.",
        },
        screenshotUrl: {
          url: `${baseUrl}/api/screenshot-url/YOUR_PROJECT_NAME?fullPage=true&waitMs=30000`,
          use: "Triggers a new screenshot_preview and returns the plain-text /api/screenshot-data URL. Falls back to last-good URL.",
          method: "GET",
        },
        screenshotImage: {
          url: `${baseUrl}/api/screenshot-image/YOUR_PROJECT_NAME`,
          use: "302 redirect directly to /api/screenshot-data URL. Embed in browse_page tool.",
          method: "GET",
        },
        screenshotJson: {
          url: `${baseUrl}/api/screenshot/YOUR_PROJECT_NAME?fullPage=true&waitMs=30000`,
          use: "JSON response with screenshotUrl field pointing to /api/screenshot-data. Extract: response.results[0].data.screenshotUrl",
          method: "GET",
        },
        liveView: {
          url: `${baseUrl}/live/YOUR_PROJECT_NAME`,
          use: "Browser page that auto-refreshes the screenshot every ~2s as edits land. Human monitoring.",
        },
        screenshotHistory: {
          url: `${baseUrl}/api/screenshot-history/YOUR_PROJECT_NAME`,
          use: "Last 60 screenshots (1 hour). Use if latest screenshot is stale or missing.",
        },
        bridgeStatus: {
          url: `${baseUrl}/api/bridge-status`,
          use: "Public — shows connected desktop count and project names.",
        },
        commands: {
          url: `${baseUrl}/api/commands`,
          use: "Compact flat list of all supported command type strings.",
        },
        grokInteract: {
          url: `${baseUrl}/api/grok-interact?project=PROJECT&action=click&selector=%23btn`,
          use: "⛔ NOT AVAILABLE IN STANDALONE CONNECTOR MODE — requires full Electron app with Chromium. Returns {supported:false}.",
          note: "Use screenshot_preview + write_file/search_replace for edit-and-verify loop instead.",
        },
      },

      // ═══════════════════════════════════════════════════════════════════
      // 9. COMMAND CATEGORIES — organized by purpose
      // ═══════════════════════════════════════════════════════════════════
      commandCategories: {
        discovery: {
          desc: "Understand the project structure before making any changes",
          commands: ["list_tree", "list_tree_filtered", "read_file", "read_multiple_files", "detect_structure", "project_analyze", "extract_imports", "dependency_graph", "component_tree", "extract_theme", "extract_colors"],
        },
        search: {
          desc: "Find code, patterns, or symbols across files",
          commands: ["grep", "grep_search", "grep_advanced", "search_files", "glob_search", "symbol_search", "find_usages", "dead_code_detection"],
        },
        fileWrite: {
          desc: "Write files — choose based on content size",
          commands: ["search_replace", "write_file", "write_file_chunk", "create_file", "bulk_write", "apply_patch"],
          sizeGuide: "< 2 KB → write_file | > 2 KB → write_file_chunk (chunks of ~1500 chars) | targeted edit → search_replace (preferred)",
        },
        fileManage: {
          desc: "Move, copy, rename, delete files and folders",
          commands: ["delete_file", "move_file", "copy_file", "rename_file", "move_folder", "rename_folder", "create_folder", "delete_folder", "bulk_delete", "rollback_last_change"],
        },
        dependencies: {
          desc: "Manage npm/pnpm packages — always install_deps after add_dependency",
          commands: ["install_deps", "add_dependency", "remove_dependency", "update_package_json", "manage_scripts", "security_scan"],
          warning: "add_dependency alone only edits package.json — must follow with install_deps to actually install",
        },
        quality: {
          desc: "Type checking, linting, formatting, testing",
          commands: ["type_check", "lint_and_fix", "format_files", "validate_change", "run_tests", "tailwind_audit"],
        },
        build: {
          desc: "Build and deploy",
          commands: ["build_project", "get_build_metrics"],
        },
        shell: {
          desc: "Run arbitrary commands on Windows (PowerShell)",
          commands: ["run_command", "run_command_advanced"],
          note: "Use PowerShell syntax. Project cwd is auto-set. Avoid Unix-only tools.",
        },
        processes: {
          desc: "Manage dev servers and background processes",
          commands: ["restart_dev_server", "get_preview_url", "list_open_ports", "start_process", "start_process_named", "kill_process", "list_processes", "stop_all_processes", "monitor_process", "get_process_logs"],
        },
        git: {
          desc: "Full git workflow",
          commands: ["git_status", "git_diff", "git_add", "git_commit", "git_log", "git_branch", "git_checkout", "git_push", "git_pull", "git_merge", "git_stash", "git_stash_pop", "git_reset", "git_revert", "git_tag", "git_init"],
        },
        environment: {
          desc: "Environment variables",
          commands: ["set_env_var", "get_env_vars"],
        },
        screenshot: {
          desc: "Visual verification — use HTTP endpoints, not commands, for screenshots",
          note: "Use GET /api/screenshot-url or /api/screenshot-image — not capture_preview (unavailable in standalone mode)",
          available: ["screenshot_preview (via grok-proxy action)"],
          unavailable: ["capture_preview ⛔", "capture_component ⛔", "get_dom_snapshot ⛔", "visual_diff ⛔", "browser_interact ⛔"],
        },
        unavailable: {
          desc: "Commands that require AI/LLM or full Electron app — not available in standalone connector",
          commands: ["generate_component", "generate_page", "generate_test", "refactor_file", "optimize_code", "super_command", "bundle_analyzer", "accessibility_audit", "browser_interact", "get_dom_snapshot", "get_console_errors", "visual_diff", "capture_preview", "capture_component", "switch_port"],
          workaround: "Use write_file_chunk or search_replace to implement changes manually. Use run_command for custom shell tasks.",
        },
      },

      // ═══════════════════════════════════════════════════════════════════
      // 10. WRITE_FILE_CHUNK DEEP DIVE
      // ═══════════════════════════════════════════════════════════════════
      writeFileChunkGuide: {
        when: "Any file content > 2 KB — React components, pages, full TypeScript modules, CSS files, JSON config",
        why: "GET URLs max out at ~8 KB total. A 5 KB component in a write_file URL gets truncated mid-file. The written file is corrupted and the app breaks silently.",
        howItWorks: [
          "Split content into chunks of ~1500 chars each (safe below URL limit with encoding overhead)",
          "Send chunk_index:0 first, then 1, 2, ... up to total_chunks-1",
          "Relay buffers chunks in memory keyed by 'project:path'",
          "On final chunk: relay assembles in order, writes the complete file atomically",
          "Returns {done:true, bytes:N} on the final chunk",
          "Intermediate chunks return {received:N, waiting_for:M, done:false}",
        ],
        chunkFields: {
          type: "write_file_chunk",
          project: "groks-app",
          path: "src/components/App.tsx",
          chunk_index: "0-based index of this chunk",
          total_chunks: "total number of chunks",
          content: "the ~1500-char slice of the file content",
        },
        staleness: "Incomplete writes are purged after 5 minutes. If you start a chunked write, finish it.",
        verification: "After done:true, always read_file to confirm the assembled content is correct before running type_check or build.",
      },

      // ═══════════════════════════════════════════════════════════════════
      // 11. FULL COMMAND LIST
      // ═══════════════════════════════════════════════════════════════════
      totalCommands: commands.length,
      commands,
    };
    // Replace all placeholder project names with the real connected project.
    // Grok copies the "project" field from examples literally into its API calls —
    // if they say "my-app" or "YOUR_PROJECT_NAME", every command will fail.
    const _grokJson = JSON.stringify(_grokResponseObj)
      .replace(/"my-app"/g, JSON.stringify(_P))
      .replace(/"YOUR_PROJECT_NAME"/g, JSON.stringify(_P))
      .replace(/YOUR_PROJECT_NAME/g, _P);
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end(_grokJson);
    return;
  }
  if (pathname === "/api/commands") {
    const commands = [
      "list_tree", "read_file", "read_multiple_files", "write_file", "write_file_chunk", "create_file",
      "delete_file", "bulk_delete", "move_file", "copy_file", "copy_folder", "rename_file",
      "grep", "search_files", "search_replace", "apply_patch", "bulk_write",
      "run_command", "install_deps", "add_dependency", "remove_dependency",
      "type_check", "lint_and_fix", "format_files", "get_build_metrics",
      "restart_dev_server", "list_open_ports",
      "git_status", "git_add", "git_commit", "git_diff", "git_log",
      "git_branch", "git_checkout", "git_stash", "git_init", "git_push",
      "git_pull", "git_merge", "git_stash_pop", "git_reset", "git_revert", "git_tag",
      "detect_structure", "start_process", "kill_process", "list_processes",
      "build_project", "run_tests", "archive_project", "export_project",
      "set_env_var", "get_env_vars", "rollback_last_change",
      "project_analyze", "tailwind_audit", "find_usages", "component_tree",
      "extract_theme", "extract_colors", "capture_preview", "get_preview_url",
      "generate_component", "generate_page", "refactor_file",
      "validate_change", "profile_performance",
      "create_folder", "delete_folder", "move_folder", "rename_folder",
      "list_tree_filtered", "dead_code_detection", "dependency_graph",
      "symbol_search", "grep_advanced", "extract_imports",
      "run_command_advanced", "build_with_flags", "clean_build_cache",
      "start_process_named", "monitor_process", "get_process_logs",
      "stop_all_processes", "switch_port",
      "visual_diff", "capture_component", "record_video",
      "get_dom_snapshot", "get_console_errors",
      "generate_test", "generate_storybook", "optimize_code",
      "convert_to_typescript", "add_feature", "migrate_framework",
      "react_profiler", "memory_leak_detection", "console_error_analysis",
      "runtime_error_trace", "bundle_analyzer", "network_monitor",
      "accessibility_audit", "security_scan",
      "set_tailwind_config", "set_next_config", "update_package_json",
      "manage_scripts", "switch_package_manager",
      "deploy_preview", "export_project_zip", "import_project", "super_command"
    ];
    sendJson(res, {
      total: commands.length,
      commands,
      usage: "POST /api/sandbox/execute with {actions: [{type: '<command>', project: 'name', ...params}]}",
      grokProxy: {
        endpoint: "GET /api/grok-proxy",
        params: { key: "your-key", payload: "base64(JSON) or base64(gzip(JSON))" },
        encodingPlain: "btoa(JSON.stringify({actions:[...]}))",
        largeFileRule: "For file content > 2 KB use write_file_chunk (split into ~1500-char pieces, chunk_index 0..N-1, total_chunks=N) — do NOT use write_file for large content, the URL will be truncated"
      }
    });
    return;
  }

  if (pathname === "/api/self-test") {
    const startTs = Date.now();
    const checks = [];
    function chk(id, name, pass, ms, err) {
      checks.push({ id, name, pass, ms: ms || 0, ...(err ? { error: err } : {}) });
    }
    // A01 — relay health
    chk("A01", "/health endpoint", true, 0);
    // A02 — bridge-status
    const connectedCount = desktopClient ? 1 : 0;
    const aliveCount = desktopClient?.alive ? 1 : 0;
    chk("A02", "bridge-status", true, 0);
    // A03 — grok docs built
    chk("A03", "/api/grok docs", true, 0);
    // A05 — JSON repair smoke test
    try {
      const bad = '{"a":1,"b":2,}';
      const repaired = repairJson(bad);
      const parsed = JSON.parse(repaired);
      chk("A05", "JSON auto-repair", parsed.a === 1 && parsed.b === 2, 0);
    } catch (e) { chk("A05", "JSON auto-repair", false, 0, e.message); }
    // A06 — gzip detection (relay decodes gzip payloads)
    try {
      const zlib = require("zlib");
      const sample = JSON.stringify({ actions: [{ type: "list_tree", project: "test" }] });
      const gz = zlib.gzipSync(Buffer.from(sample));
      const b64 = gz.toString("base64");
      const decompressed = zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf-8");
      const parsed = JSON.parse(decompressed);
      chk("A06", "gzip base64 decode", parsed.actions?.[0]?.type === "list_tree", 0);
    } catch (e) { chk("A06", "gzip base64 decode", false, 0, e.message); }
    // A07 — desktop connected?
    const desktopConnected = aliveCount > 0;
    chk("desktop", "desktop connected", desktopConnected, 0, desktopConnected ? null : `${aliveCount}/${connectedCount} clients alive`);
    // A08 — pending requests maps healthy
    chk("A08", "pending maps empty", pendingRelayRequests.size < 1000, 0);
    // A09 — screenshot cache healthy
    chk("A09", "screenshot cache", screenshotCache.size < 10000, 0);
    // A10 — real desktop roundtrip (dispatch get_preview_url and verify url field)
    if (desktopConnected) {
      const t10 = Date.now();
      try {
        // Find any alive client and the project it's serving
        let liveClientA10, projectA10;
        if (desktopClient?.alive && desktopClient.project) {
          liveClientA10 = desktopClient; projectA10 = desktopClient.project;
        }
        if (liveClientA10) {
          const requestIdA10 = crypto.randomUUID();
          const promiseA10 = new Promise((resolve) => {
            const timer = setTimeout(() => {
              pendingSandboxRelayRequests.delete(requestIdA10);
              resolve(null); // timeout
            }, 6000);
            // Use the same map the WebSocket response handler resolves from
            pendingSandboxRelayRequests.set(requestIdA10, {
              resolve: (data) => { clearTimeout(timer); pendingSandboxRelayRequests.delete(requestIdA10); resolve(data); },
              timer
            });
          });
          liveClientA10.send(JSON.stringify({ type: "sandbox-execute-request", requestId: requestIdA10, actions: [{ type: "get_preview_url", project: projectA10 }] }));
          const rawA10 = await promiseA10;
          const ms10 = Date.now() - t10;
          if (rawA10 === null) {
            chk("A10", "desktop roundtrip", false, ms10, "timeout after 6s");
          } else {
            try {
              const parsed10 = JSON.parse(rawA10);
              const result10 = parsed10.results?.[0]?.data;
              chk("A10", "desktop roundtrip", !!(result10?.url), ms10, result10?.url ? null : "response missing url field");
            } catch (e) { chk("A10", "desktop roundtrip", false, ms10, "response parse error: " + e.message); }
          }
        } else {
          chk("A10", "desktop roundtrip", false, 0, "no alive client with project found");
        }
      } catch (e) { chk("A10", "desktop roundtrip", false, Date.now() - t10, e.message); }
    } else {
      chk("A10", "desktop roundtrip", false, 0, "skipped — no desktop connected");
    }
    const passed = checks.filter(c => c.pass).length;
    const total = checks.length;
    const relayOk = checks.filter(c => c.id !== "desktop" && c.id !== "A10").every(c => c.pass);
    sendJson(res, {
      relay: relayOk ? "ok" : "degraded",
      checks,
      passed,
      total,
      desktopConnected,
      connectedClients: aliveCount,
      uptimeSec: Math.floor(process.uptime()),
      testedIn: Date.now() - startTs + "ms",
    });
    return;
  }

  // ── Shared screenshot helper ─────────────────────────────────────────────
  // Handles /api/screenshot/, /api/screenshot-url/, /api/screenshot-image/
  // format: "json" | "text" | "redirect"
  async function handleScreenshot(req, res, project, format) {
    const fullPage = url.searchParams.get("fullPage") === "true" || url.searchParams.get("fullPage") === "1";
    const waitMs   = parseInt(url.searchParams.get("waitMs") || "0", 10) || 0;
    const selector = url.searchParams.get("selector") || "";
    // Key excludes waitMs — requests with different waitMs share same dedup slot
    const screenshotKey = `${project}:${fullPage ? "true" : ""}:${selector}`;
    const lastGoodUrl = screenshotLastGood.get(project)?.url || null;

    function flushWaiter(w, resultStr, screenshotUrl) {
      const r = w.res; const fmt = w.format;
      if (r.writableEnded) return;
      try {
        if (fmt === "text") {
          const u = screenshotUrl || lastGoodUrl || "Error: no screenshot URL available";
          r.writeHead(200, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
          r.end(u);
        } else if (fmt === "redirect") {
          const u = screenshotUrl || lastGoodUrl;
          if (u) { r.writeHead(302, { "Location": u, "Access-Control-Allow-Origin": "*" }); r.end(); }
          else { r.writeHead(503, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" }); r.end("Error: screenshot failed, no cached image available."); }
        } else {
          r.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          r.end(resultStr);
        }
      } catch {}
    }

    // 1. Cache hit
    const cached = screenshotCache.get(screenshotKey);
    if (cached && cached.expiresAt > Date.now()) {
      relayLog("info", `SCREENSHOT cache hit key=${screenshotKey} expiresIn=${Math.round((cached.expiresAt - Date.now()) / 1000)}s`);
      let cachedUrl = null;
      try { cachedUrl = JSON.parse(cached.result)?.results?.[0]?.data?.screenshotUrl || null; } catch {}
      flushWaiter({ res, format }, cached.result, cachedUrl);
      return;
    }

    // 2. In-flight dedup — join existing request (even if still waiting for client)
    if (pendingScreenshots.has(screenshotKey)) {
      const existing = pendingScreenshots.get(screenshotKey);
      existing.maxWaitMs = Math.max(existing.maxWaitMs || 0, waitMs || 0);
      const waiter = { res, format };
      existing.waiters.add(waiter);
      req.on("close", () => existing.waiters.delete(waiter));
      relayLog("info", `SCREENSHOT dedup — joining key=${screenshotKey} waiters=${existing.waiters.size} maxWaitMs=${existing.maxWaitMs} reqId=${existing.requestId ? existing.requestId.substring(0, 8) + "..." : "pending-client"}`);
      return;
    }

    // 3. Register stub entry NOW (before async waitForClient) so concurrent requests join above
    const waiters = new Set();
    const waiter = { res, format };
    waiters.add(waiter);
    req.on("close", () => waiters.delete(waiter));
    pendingScreenshots.set(screenshotKey, { requestId: null, timer: null, waiters, maxWaitMs: waitMs });

    // 4. Wait for desktop client
    const liveClient = await waitForClient();
    if (!liveClient) {
      pendingScreenshots.delete(screenshotKey);
      relayLog("warn", `SCREENSHOT 503 no alive client waiters=${waiters.size}`);
      for (const w of waiters) {
        if (w.res.writableEnded) continue;
        try { flushWaiter(w, JSON.stringify({ error: "No desktop client connected.", last_good_url: lastGoodUrl, hint: "Start your Lamby desktop app." }), null); } catch {}
      }
      return;
    }

    // 5. Send to desktop — fill in requestId on the existing entry
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => {
      const sc = pendingScreenshots.get(screenshotKey);
      if (sc && sc.requestId === requestId) {
        pendingScreenshots.delete(screenshotKey);
        relayLog("warn", `SCREENSHOT TIMEOUT 120s key=${screenshotKey} waiters=${sc.waiters.size}`);
        for (const w of sc.waiters) {
          if (w.res.writableEnded) continue;
          try { flushWaiter(w, JSON.stringify({ error: "Relay timeout — desktop did not respond within 120 seconds.", last_good_url: lastGoodUrl }), null); } catch {}
        }
      }
    }, 120000);

    const entry = pendingScreenshots.get(screenshotKey);
    if (entry) { entry.requestId = requestId; entry.timer = timer; }

    try {
      const effectiveWaitMs = entry ? entry.maxWaitMs : waitMs;
      const screenshotAction = { type: "screenshot_preview", project,
        ...(fullPage         ? { fullPage: true } : {}),
        ...(effectiveWaitMs  ? { waitMs: effectiveWaitMs } : {}),
        ...(selector         ? { selector } : {}) };
      relayLog("info", `SCREENSHOT →Desktop reqId=${requestId.substring(0, 8)}... project=${project} fullPage=${fullPage} waitMs=${effectiveWaitMs}`);
      liveClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions: [screenshotAction] }));
    } catch (sendErr) {
      pendingScreenshots.delete(screenshotKey);
      clearTimeout(timer);
      relayLog("error", `SCREENSHOT send failed: ${sendErr.message}`);
      for (const w of waiters) {
        if (w.res.writableEnded) continue;
        try { flushWaiter(w, JSON.stringify({ error: "Could not reach desktop app." }), null); } catch {}
      }
    }
    // (screenshot result logged inside WS fan-out — see SCREENSHOT-RELAY handler)
    // Response delivered asynchronously by WS fan-out
  }

  if (pathname.startsWith("/api/screenshot/")) {
    const project = pathname.replace("/api/screenshot/", "").split("/").filter(Boolean).join("/") || "";
    if (!project) {
      res.writeHead(400, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
      res.end("Usage: GET /api/screenshot/PROJECT?fullPage=true&waitMs=30000");
      return;
    }
    try { await handleScreenshot(req, res, project, "json"); }
    catch (err) {
      relayLog("error", `SCREENSHOT unhandled error: ${err.message}`);
      if (!res.writableEnded) { try { res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); res.end(JSON.stringify({ error: err.message })); } catch {} }
    }
    return;
  }

  // ── /api/screenshot-data/:project — serve PNG from relay memory (no catbox, 100% reliable) ──
  if (pathname.startsWith("/api/screenshot-data/")) {
    const project = pathname.replace("/api/screenshot-data/", "").split("/").filter(Boolean).join("/") || "";
    if (!project) {
      res.writeHead(400, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
      res.end("Usage: GET /api/screenshot-data/PROJECT");
      return;
    }
    const cached = screenshotDataCache.get(project);
    if (!cached) {
      res.writeHead(404, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
      res.end(`No screenshot cached for project "${project}". Run screenshot_preview via /api/grok-proxy first.`);
      return;
    }
    const buf = Buffer.from(cached.base64, "base64");
    const ageMs = Date.now() - cached.capturedAt;
    res.writeHead(200, {
      "Content-Type": cached.mimeType || "image/png",
      "Content-Length": buf.length,
      "Cache-Control": "no-store",
      "X-Captured-At": new Date(cached.capturedAt).toISOString(),
      "X-Age-Ms": ageMs,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(buf);
    return;
  }

  if (pathname.startsWith("/api/screenshot-url/")) {
    const project = pathname.replace("/api/screenshot-url/", "").split("/").filter(Boolean).join("/") || "";
    if (!project) {
      res.writeHead(400, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
      res.end("Usage: GET /api/screenshot-url/PROJECT?fullPage=true&waitMs=30000\nReturns: plain-text catbox.moe URL (no JSON parsing needed)");
      return;
    }
    try { await handleScreenshot(req, res, project, "text"); }
    catch (err) {
      relayLog("error", `SCREENSHOT-URL unhandled error: ${err.message}`);
      if (!res.writableEnded) { try { res.writeHead(500, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" }); res.end("Error: " + err.message); } catch {} }
    }
    return;
  }

  if (pathname.startsWith("/api/screenshot-image/")) {
    const project = pathname.replace("/api/screenshot-image/", "").split("/").filter(Boolean).join("/") || "";
    if (!project) {
      res.writeHead(400, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
      res.end("Usage: GET /api/screenshot-image/PROJECT\nRedirects (302) directly to the screenshot image — browse this URL to view the app screenshot.");
      return;
    }
    try { await handleScreenshot(req, res, project, "redirect"); }
    catch (err) {
      relayLog("error", `SCREENSHOT-IMAGE unhandled error: ${err.message}`);
      if (!res.writableEnded) { try { res.writeHead(500, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" }); res.end("Error: " + err.message); } catch {} }
    }
    return;
  }

  if (pathname === "/api/grok-interact") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const project = url.searchParams.get("project");
      const action = url.searchParams.get("action");
      const selector = url.searchParams.get("selector") || null;
      const functionName = url.searchParams.get("functionName") || null;
      const argsRaw = url.searchParams.get("args") || null;
      if (!project || !action) {
        sendJson(res, {
          error: "Required params: project, action",
          actions: ["click", "runFunction", "type", "scroll", "evaluate"],
          example: `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/grok-interact?project=my-app&action=click&selector=%23screenshot-btn`
        }, 400); return;
      }
      let args = [];
      if (argsRaw) {
        try { args = JSON.parse(argsRaw); } catch { args = [argsRaw]; }
      }
      relayLog("info", `GROK-INTERACT project=${project} action=${action} selector=${selector} fn=${functionName} args=${JSON.stringify(args).substring(0, 80)}`);
      const liveClient = await waitForClient();
      if (!liveClient) {
        relayLog("warn", `GROK-INTERACT 503 no alive client after 5s wait`);
        sendJson(res, { error: "No desktop client connected." }, 503); return;
      }
      const requestId = crypto.randomUUID();
      const relayPromise = makeRelayPromise(requestId, req, 120000, "GROK-INTERACT");
      const actions = [{ type: "browser_interact", project, action, selector, functionName, args }];
      try {
        relayLog("info", `GROK-INTERACT →Desktop reqId=${requestId.substring(0, 8)}... action=${action} selector=${selector} fn=${functionName}`);
        liveClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions }));
      } catch (sendErr) {
        relayLog("error", `GROK-INTERACT send failed: ${sendErr.message}`);
        sendJson(res, { error: "Could not reach desktop app." }, 502); return;
      }
      const _intT0 = Date.now();
      const _intEntry = pushActivity({ type: `browser_interact`, project, status: "pending", human: humanizeAction("browser_interact", { project, action, selector }), detail: "waiting…" });
      const result = await relayPromise;
      try { if (parseWithRepair(result, "GROK-INTERACT disconnect-check").__clientDisconnected) { relayLog("info", `GROK-INTERACT dropping result — client already gone reqId=${requestId.substring(0, 8)}...`); return; } } catch {}
      relayLog("info", `GROK-INTERACT ←Desktop responded reqId=${requestId.substring(0, 8)}... size=${result.length}`);
      try {
        const _ip = parseWithRepair(result, "GROK-INTERACT result");
        const _iok = _ip?.results?.[0]?.data?.success !== false;
        updateActivity(_intEntry, { status: _iok ? "ok" : "fail", dur: Date.now() - _intT0, detail: _ip?.results?.[0]?.data?.error || (_iok ? "ok" : "failed") });
      } catch {}
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(result);
    } catch (err) {
      relayLog("error", `GROK-INTERACT unhandled error: ${err.message}`);
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }
  if (pathname === "/api/grok-edit") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const project = url.searchParams.get("project");
      const path = url.searchParams.get("path");
      const replaceAll = url.searchParams.get("replaceAll") === "true";
      // Decode URL-safe base64 params if provided (avoids HTML special char URL-encoding issues)
      const decodeB64Param = (b64) => { if (!b64) return null; try { return Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"); } catch { return null; } };
      // Unescape HTML entities that browse_page sometimes injects into query values
      const unescapeHtml = (s) => { if (!s) return s; return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"); };
      // Unescape JS escape sequences that Grok sends literally in query params (e.g. \n → newline)
      const unescapeJs = (s) => { if (!s) return s; return s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r"); };
      const rawSearch  = decodeB64Param(url.searchParams.get("searchB64"))  ?? unescapeHtml(url.searchParams.get("search"));
      const rawReplace = decodeB64Param(url.searchParams.get("replaceB64")) ?? unescapeHtml(url.searchParams.get("replace"));
      const search  = unescapeJs(rawSearch);
      const replace = unescapeJs(rawReplace);
      if (!project || !path || search === null || replace === null) {
        sendJson(res, { error: "Required params: project, path, search, replace (or searchB64, replaceB64 for HTML content)", example: `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/grok-edit?project=my-app&path=src/index.html&search=old+text&replace=new+text`, b64example: "For HTML: use searchB64=URL_SAFE_BASE64 and replaceB64=URL_SAFE_BASE64 instead (no special char issues)" }, 400); return;
      }
      // Handle regex anchors as prepend/append (connector only does literal match)
      const isPrepend = search === "^";
      const isAppend  = search === "$";
      relayLog("info", `GROK-EDIT project=${project} path=${path} search="${search.substring(0, 60)}" replace="${replace.substring(0, 60)}" replaceAll=${replaceAll}${isPrepend ? " [PREPEND]" : isAppend ? " [APPEND]" : ""}`);
      // ── Dedup: identical in-flight edit requests fan-in to a single desktop call ──
      const editKey = `${project}:${path}:${search}:${replace}:${replaceAll}`;
      // Check 10-second recency cache first (same edit already completed recently)
      const cached = editResultCache.get(editKey);
      if (cached && Date.now() - cached.ts < 10000) {
        relayLog("info", `GROK-EDIT cache hit key=${editKey.substring(0, 40)}...`);
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(cached.result); return;
      }
      // Check for an already in-flight request for the exact same edit
      if (editInflight.has(editKey)) {
        relayLog("info", `GROK-EDIT fan-in to existing in-flight key=${editKey.substring(0, 40)}...`);
        const result = await editInflight.get(editKey);
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(result); return;
      }
      const liveClient = await waitForClient();
      if (!liveClient) {
        relayLog("warn", `GROK-EDIT 503 no alive client after wait`);
        sendJson(res, { error: "No desktop client connected." }, 503); return;
      }
      const requestId = crypto.randomUUID();
      const relayPromise = makeRelayPromise(requestId, req, 120000, "GROK-EDIT");
      // Translate ^ (prepend) and $ (append) to prepend_file/append_file actions
      const actions = isPrepend ? [{ type: "prepend_file", project, path, content: replace }]
        : isAppend  ? [{ type: "append_file",  project, path, content: replace }]
        : [{ type: "search_replace", project, path, search, replace, replaceAll }];
      // Register in-flight promise so concurrent identical requests fan-in
      editInflight.set(editKey, relayPromise.then(r => r, e => { throw e; }).finally(() => editInflight.delete(editKey)));
      try {
        relayLog("info", `GROK-EDIT →Desktop reqId=${requestId.substring(0, 8)}... search_replace ${path}`);
        liveClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions }));
      } catch (sendErr) {
        relayLog("error", `GROK-EDIT send failed: ${sendErr.message}`);
        editInflight.delete(editKey);
        sendJson(res, { error: "Could not reach desktop app." }, 502); return;
      }
      const _editT0 = Date.now();
      const _editEntry = pushActivity({ type: "search_replace", project, status: "pending", human: `[${project}] search_replace: ${path}`, detail: `search: ${search.slice(0,80)}` });
      const result = await relayPromise;
      try { if (parseWithRepair(result, "GROK-EDIT disconnect-check").__clientDisconnected) { relayLog("info", `GROK-EDIT dropping result — client already gone reqId=${requestId.substring(0, 8)}...`); return; } } catch {}
      relayLog("info", `GROK-EDIT ←Desktop responded reqId=${requestId.substring(0, 8)}... size=${result.length}`);
      // ── 0-replacements hint: tell Grok exactly what to try next ──
      let finalResult = result;
      try {
        const parsed = parseWithRepair(result, "GROK-EDIT result parse");
        const actionResult = parsed?.results?.[0]?.data;
        const replacements = actionResult?.results?.[0]?.replacements ?? actionResult?.replacements ?? -1;
        const isWriteOp = isPrepend || isAppend || (actionResult?.operation === "prepend" || actionResult?.operation === "append");
        const written = isWriteOp ? (actionResult?.written ?? false) : undefined;
        updateActivity(_editEntry, {
          status: isWriteOp ? (written ? "ok" : "fail") : (replacements === 0 ? "warn" : replacements > 0 ? "ok" : "fail"),
          dur: Date.now() - _editT0,
          human: humanizeAction(isWriteOp ? "write_file" : "search_replace", { project, path }, { replacements: replacements >= 0 && !isWriteOp ? replacements : undefined }),
          detail: isWriteOp ? `${actionResult?.operation ?? "write"} ${path} (${actionResult?.bytes ?? "?"}B)` : replacements >= 0 ? `${replacements} replacement${replacements !== 1 ? "s" : ""} in ${path}` : "unknown result"
        });
        if (!isWriteOp && replacements === 0) {
          relayLog("warn", `GROK-EDIT 0 replacements for search="${search.substring(0, 60)}" in ${path} — appending hint`);
          const hint = {
            zeroReplacements: true,
            searchUsed: search,
            hint: [
              `The search string was NOT found verbatim in ${path}.`,
              `Possible reasons: (1) an earlier edit already applied this change, (2) the file has different indentation/whitespace, (3) the file was modified since you last read it.`,
              `RECOMMENDED: Use ?action=read_file in /api/grok-proxy to read the current file, then extract the EXACT line you want to change and use that as your search string.`,
              `TIP: For JSX/HTML with double-quotes inside (e.g. className="..."), use searchB64 and replaceB64 params (URL-safe base64) to avoid encoding issues.`,
              `CURRENT SEARCH (${search.length} chars): ${JSON.stringify(search)}`,
            ].join(" "),
          };
          const augmented = Object.assign({}, parsed, { editMeta: hint });
          finalResult = JSON.stringify(augmented);
        } else if (replacements > 0 || (isWriteOp && written)) {
          for (const sk of screenshotCache.keys()) { if (sk.startsWith(project + ":")) screenshotCache.delete(sk); }
          lastEditByProject.set(project, { path, replacements: replacements > 0 ? replacements : 1, ts: Date.now() });
          relayLog("info", `GROK-EDIT cache bust project=${project} ${isWriteOp ? actionResult?.operation : `replacements=${replacements}`}`);
        }
      } catch (_) { /* leave result unchanged if augmentation fails */ }
      // Cache result for 10 seconds to serve duplicate requests
      editResultCache.set(editKey, { result: finalResult, ts: Date.now() });
      setTimeout(() => { editResultCache.delete(editKey); }, 10000);
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(finalResult);
    } catch (err) {
      relayLog("error", `GROK-EDIT unhandled error: ${err.message}`);
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }
  if (pathname.startsWith("/api/screenshot-history/")) {
    if (req.method !== "GET") { sendJson(res, { error: "Method Not Allowed" }, 405); return; }
    const _shProject = pathname.replace("/api/screenshot-history/", "").split("/").filter(Boolean).join("/") || "";
    const _shLimit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1), 60);
    const _shHist = screenshotHistory.get(_shProject) || [];
    sendJson(res, { project: _shProject, history: _shHist.slice(-_shLimit), total: _shHist.length, maxHistory: 60 });
    return;
  }
  if (pathname.startsWith("/api/live/")) {
    if (req.method !== "GET") { sendJson(res, { error: "Method Not Allowed" }, 405); return; }
    const _liveProject = pathname.replace("/api/live/", "").split("/").filter(Boolean).join("/") || "";
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "Access-Control-Allow-Origin": "*" });
    res.write(": connected\n\n");
    const _liveLastGood = screenshotLastGood.get(_liveProject);
    if (_liveLastGood) {
      const _liveInitLastEdit = lastEditByProject.get(_liveProject) || null;
      res.write(`event: screenshot\ndata: ${JSON.stringify({ ..._liveLastGood, lastEdit: _liveInitLastEdit })}\n\n`);
    }
    if (!sseClients.has(_liveProject)) sseClients.set(_liveProject, new Set());
    sseClients.get(_liveProject).add(res);
    const _liveKA = setInterval(() => { try { res.write(": keepalive\n\n"); } catch { clearInterval(_liveKA); } }, 15000);
    const _liveCleanup = () => { sseClients.get(_liveProject)?.delete(res); clearInterval(_liveKA); };
    req.on("close", _liveCleanup); req.on("error", _liveCleanup);
    return;
  }
  if (pathname.startsWith("/live/")) {
    if (req.method !== "GET") { res.writeHead(405, { "Content-Type": "text/plain" }); res.end("Method Not Allowed"); return; }
    const _lvProj  = pathname.replace("/live/", "").split("/").filter(Boolean).join("/") || "";
    const _lvHost  = req.headers.host || `localhost:${PORT}`;
    const _lvProto = req.headers["x-forwarded-proto"] || "https";
    const _lvBase  = `${_lvProto}://${_lvHost}`;
    const _lvSseUrl  = `${_lvBase}/api/live/${_lvProj}`;
    const _lvHistUrl = `${_lvBase}/api/screenshot-history/${_lvProj}?limit=5`;
    const _lastGoodNow = screenshotLastGood.get(_lvProj);
    const _lvInitUrl = _lastGoodNow?.url || "";
    const _lvInitLastEdit = lastEditByProject.get(_lvProj) || null;
    const _lvHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Live View — ${_lvProj}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,monospace;background:#0d1117;color:#e6edf3;min-height:100vh;padding:24px 16px}
    .wrap{max-width:900px;margin:0 auto}
    header{display:flex;align-items:center;gap:12px;margin-bottom:20px}
    .logo{width:38px;height:38px;border-radius:9px;background:linear-gradient(135deg,#7c3aed,#2563eb);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
    h1{font-size:18px;font-weight:600;color:#f0f6fc}
    h1 span{font-size:12px;font-weight:400;color:#8b949e;display:block;margin-top:1px}
    .status-dot{width:10px;height:10px;border-radius:50%;background:#e3b341;margin-left:auto;flex-shrink:0;transition:background .3s}
    .status-dot.live{background:#3fb950}
    .status-dot.dead{background:#f85149}
    .card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:16px 20px;margin-bottom:14px}
    .card-title{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#8b949e;margin-bottom:12px}
    #live-img{width:100%;border-radius:8px;border:1px solid #30363d;display:block;min-height:200px;background:#0d1117;object-fit:contain}
    #live-img.loading{opacity:.4}
    .meta{font-size:12px;color:#8b949e;margin-top:8px}
    .meta strong{color:#c9d1d9}
    .filmstrip{display:flex;gap:8px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}
    .filmstrip a{flex-shrink:0;display:block;width:120px}
    .filmstrip img{width:120px;height:72px;object-fit:cover;border-radius:6px;border:1px solid #30363d;cursor:pointer;transition:border-color .15s}
    .filmstrip img:hover{border-color:#7c3aed}
    .filmstrip .ts{font-size:10px;color:#8b949e;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .empty{color:#484f58;font-size:13px;font-style:italic}
    footer{text-align:center;color:#484f58;font-size:11px;margin-top:16px}
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="logo">📡</div>
      <div>
        <h1>Live View <span>${_lvProj} &nbsp;·&nbsp; auto-refreshes on every edit</span></h1>
      </div>
      <div class="status-dot" id="dot" title="SSE disconnected"></div>
    </header>
    <div class="card">
      <div class="card-title">Current State</div>
      <img id="live-img" src="${_lvInitUrl}" alt="Live screenshot" ${_lvInitUrl ? "" : 'class="loading"'}>
      <div class="meta" id="meta">${_lastGoodNow ? `Captured <strong>${new Date(_lastGoodNow.capturedAt).toLocaleTimeString()}</strong>` : "Waiting for first screenshot…"}</div>
      <div class="meta" id="last-edit" style="margin-top:6px">${_lvInitLastEdit ? `Last edit &nbsp;·&nbsp; <strong>${_lvInitLastEdit.path}</strong> &nbsp;·&nbsp; ${_lvInitLastEdit.replacements} replacement${_lvInitLastEdit.replacements !== 1 ? "s" : ""} &nbsp;·&nbsp; <strong>${new Date(_lvInitLastEdit.ts).toLocaleTimeString()}</strong>` : "No edits yet this session"}</div>
    </div>
    <div class="card">
      <div class="card-title">Recent Snapshots (last 5 — click to open full size)</div>
      <div class="filmstrip" id="filmstrip"><span class="empty">Loading…</span></div>
    </div>
    <footer>Lamby Bridge Relay &nbsp;·&nbsp; SSE live stream &nbsp;·&nbsp; backup every 60s</footer>
  </div>
  <script>
    const sseUrl = ${JSON.stringify(_lvSseUrl)};
    const histUrl = ${JSON.stringify(_lvHistUrl)};
    const img = document.getElementById("live-img");
    const meta = document.getElementById("meta");
    const lastEditEl = document.getElementById("last-edit");
    const dot = document.getElementById("dot");
    const film = document.getElementById("filmstrip");

    function fmtTime(ms) {
      return new Date(ms).toLocaleTimeString();
    }

    function renderFilmstrip(hist) {
      if (!hist || hist.length === 0) { film.innerHTML = '<span class="empty">No snapshots yet</span>'; return; }
      film.innerHTML = hist.slice().reverse().map(h =>
        '<a href="' + h.url + '" target="_blank"><img src="' + h.url + '" loading="lazy" title="' + fmtTime(h.capturedAt) + '"><div class="ts">' + fmtTime(h.capturedAt) + '</div></a>'
      ).join("");
    }

    async function loadFilmstrip() {
      try { const r = await fetch(histUrl); const d = await r.json(); renderFilmstrip(d.history); } catch {}
    }

    function connectSSE() {
      const es = new EventSource(sseUrl);
      es.onopen = () => { dot.className = "status-dot live"; dot.title = "SSE live"; };
      es.onerror = () => { dot.className = "status-dot dead"; dot.title = "SSE disconnected — retrying"; };
      es.addEventListener("screenshot", (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.url) {
            img.src = d.url;
            img.classList.remove("loading");
            meta.innerHTML = "Captured <strong>" + fmtTime(d.capturedAt) + "</strong> &nbsp;·&nbsp; auto-updated";
            if (d.lastEdit) {
              const le = d.lastEdit;
              lastEditEl.innerHTML = "Last edit &nbsp;·&nbsp; <strong>" + le.path + "</strong> &nbsp;·&nbsp; " + le.replacements + " replacement" + (le.replacements !== 1 ? "s" : "") + " &nbsp;·&nbsp; <strong>" + fmtTime(le.ts) + "</strong>";
            }
            loadFilmstrip();
          }
        } catch {}
      });
    }

    loadFilmstrip();
    connectSSE();
  </script>
</body>
</html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(_lvHtml);
    return;
  }
  if (pathname === "/api/grok-proxy") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const matchedClient = findBridgeClient();
      relayLog("info", `GROK-PROXY hasClient=${!!matchedClient} desktopAlive=${!!desktopClient?.alive}`);
      const payload = url.searchParams.get("payload");
      if (!payload) {
        relayLog("warn", `GROK-PROXY 400 missing payload param`);
        sendJson(res, { error: "Missing payload query param (base64-encoded JSON with actions array)" }, 400); return;
      }
      let body;
      try {
        const rawBuffer = Buffer.from(payload, "base64");
        let decoded;
        const isGzip = rawBuffer[0] === 0x1f && rawBuffer[1] === 0x8b;
        if (isGzip) {
          decoded = zlib.gunzipSync(rawBuffer).toString("utf8");
          relayLog("info", `GROK-PROXY decoded gzip payload compressed=${rawBuffer.length}B expanded=${decoded.length}B preview=${decoded.substring(0, 200)}`);
        } else {
          decoded = rawBuffer.toString("utf8");
          relayLog("info", `GROK-PROXY decoded plain payload ${decoded.length}B preview=${decoded.substring(0, 200)}`);
        }
        body = parseWithRepair(decoded, "GROK-PROXY");
      } catch (parseErr) {
        relayLog("error", `GROK-PROXY payload decode/parse error: ${parseErr.message}`);
        sendJson(res, { error: "payload must be valid base64-encoded JSON (plain or gzip-compressed)" }, 400); return;
      }
      // Accept raw array payload (Grok sometimes sends [...] directly instead of {actions:[...]})
      const actions = Array.isArray(body) ? body
        : (body.actions ?? body.types ?? body.commands ?? body.data ?? body.payload);
      if (!Array.isArray(actions) || actions.length === 0) {
        relayLog("warn", `GROK-PROXY 400 actions missing or empty. Body keys: ${Object.keys(body).join(", ")}`);
        sendJson(res, { error: "actions array required. Wrap your array: {\"actions\":[...]} OR send raw JSON array directly." }, 400); return;
      }
      if (actions.length > 100) { sendJson(res, { error: "Max 100 actions per request" }, 400); return; }
      // Unescape \n/\t/\r in search_replace search/replace fields (Grok sends them literally)
      // Also translate ^ → prepend_file, $ → append_file
      for (const a of actions) {
        if (a.type === "search_replace") {
          if (a.search)  a.search  = a.search.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r");
          if (a.replace) a.replace = a.replace.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r");
          if (a.search === "^") { a.type = "prepend_file"; a.content = a.replace; delete a.search; delete a.replace; }
          else if (a.search === "$") { a.type = "append_file"; a.content = a.replace; delete a.search; delete a.replace; }
        }
      }
      relayLog("info", `GROK-PROXY actions(${actions.length}): ${actions.map(a => a.type + (a.project ? "@" + a.project : "")).join(", ")}`);
      const liveClient = await waitForClient();
      if (!liveClient) {
        relayLog("warn", `GROK-PROXY 503 no alive client found. desktopClient=${!!desktopClient}`);
        sendJson(res, { error: "No desktop client connected." }, 503); return;
      }
      const requestId = crypto.randomUUID();
      const relayPromise = makeRelayPromise(requestId, req, 120000, "GROK-PROXY");
      try {
        relayLog("info", `GROK-PROXY →Desktop reqId=${requestId.substring(0, 8)}... actions=[${actions.map(a => a.type).join(",")}]`);
        liveClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions }));
        relayLog("info", `GROK-PROXY →Desktop sent OK, waiting... reqId=${requestId.substring(0, 8)}...`);
      } catch (sendErr) {
        relayLog("error", `GROK-PROXY send failed: ${sendErr.message}`);
        sendJson(res, { error: "Could not reach desktop app." }, 502); return;
      }
      const _proxyT0 = Date.now();
      const _proxyEntries = actions.map(action => pushActivity({
        type: action.type, project: action.project || "", status: "pending",
        human: humanizeAction(action.type, action), detail: "waiting for desktop…", action
      }));
      const result = await relayPromise;
      try { if (parseWithRepair(result, "GROK-PROXY disconnect-check").__clientDisconnected) { relayLog("info", `GROK-PROXY dropping result — client already gone reqId=${requestId.substring(0, 8)}...`); return; } } catch {}
      relayLog("info", `GROK-PROXY ←Desktop responded reqId=${requestId.substring(0, 8)}... size=${result.length} preview=${result.substring(0, 120)}`);
      try {
        const _pp = parseWithRepair(result, "GROK-PROXY result");
        const _pdur = Date.now() - _proxyT0;
        _proxyEntries.forEach((entry, i) => {
          const at = actions[i]?.type;
          const rd = _pp?.results?.[i]?.data;
          const ok = rd?.success !== false && !rd?.error;
          const detail = resultSummary(at, _pp?.results?.[i] ? { results: [_pp.results[i]] } : _pp) || (rd?.error ? rd.error.slice(0,150) : ok ? "ok" : "?");
          updateActivity(entry, { status: ok ? "ok" : "fail", dur: _pdur, human: humanizeAction(at, actions[i], rd), detail });
        });
      } catch {}
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(result);
    } catch (err) {
      relayLog("error", `GROK-PROXY unhandled error: ${err.message}`);
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found", endpoints: ["/", "/api/grok", "/api/grok-edit", "/api/grok-interact", "/api/grok-proxy", "/api/snapshot-key", "/api/bridge-status", "/api/snapshot/:project", "/api/console-logs", "/api/sandbox/execute", "/api/sandbox/audit-log", "/api/screenshot-data/:project", "/api/commands"] }));
});
server.on("upgrade", (req, socket, head) => {
  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?";
  const ua = req.headers["user-agent"] || "";
  relayLog("info", `WS-UPGRADE attempt url=${req.url} ip=${ip} ua=${ua.substring(0, 60)}`);
  const reqUrl = new URL(req.url || "", "http://localhost");
  if (req.url && req.url.startsWith("/bridge-ws")) {
    const clientProject = reqUrl.searchParams.get("project") || "";
    handleWsUpgrade(req, socket, clientProject);
    return;
  }
  relayLog("warn", `WS-UPGRADE rejected bad-path url=${req.url}`);
  socket.destroy();
});
setInterval(() => {
  const now = Date.now();
  if (desktopClient && now - desktopClient.lastPing > 600000) {
    relayLog("warn", `Pruning stale desktop client key=${desktopBridgeKey.substring(0, 8)}... lastPing=${Math.round((now - desktopClient.lastPing)/1000)}s ago`);
    desktopClient.alive = false;
    try { desktopClient.socket.destroy(); } catch {}
    desktopClient = null;
  }
}, 30000);
process.on("uncaughtException", (err) => {
  console.error(`[Bridge] Uncaught exception: ${err.message}`);
  console.error(err.stack);
});
process.on("unhandledRejection", (reason) => {
  console.error(`[Bridge] Unhandled rejection: ${reason}`);
});
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Lamby Bridge Relay]`);
  console.log(`  Running on port ${PORT}`);
  console.log(`  Zero dependencies — pure Node.js`);
  console.log(`  Endpoints:`);
  console.log(`    GET  /                      Health check`);
  console.log(`    GET  /api/snapshot-key       Get connection info`);
  console.log(`    GET  /api/bridge-status      Connected clients (public)`);
  console.log(`    GET  /api/snapshot/:project   Get project snapshot (via desktop)`);
  console.log(`    GET  /api/console-logs       Get desktop console logs (via desktop)`);
  console.log(`    POST /api/sandbox/execute    Execute actions (via desktop)`);
  console.log(`    GET  /api/sandbox/audit-log  Recent actions`);
  console.log(`    GET  /api/grok               Full AI agent docs + all commands (browse this!)`);
  console.log(`    GET  /api/screenshot/:project  Clean screenshot URL — no & needed (best for browse_page)`);
  console.log(`    GET  /api/grok-edit          Search-replace, no encoding (best for Grok)`);
  console.log(`    GET  /api/grok-interact      Browser interact: click, runFunction, evaluate`);
  console.log(`    GET  /api/grok-proxy         GET proxy (base64 payload → execute)`);
  console.log(`    GET  /api/commands           Compact command type list`);
  console.log(`    WS   /bridge-ws             Desktop WebSocket connection`);
});
