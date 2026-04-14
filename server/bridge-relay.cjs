const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { WebSocketServer } = require("ws");

const PORT = parseInt(process.env.PORT || "3000", 10);

const bridgeClients = new Map();
const pendingRelayRequests = new Map();
const pendingSandboxRelayRequests = new Map();
const pendingConsoleLogRequests = new Map();

const activityLog = [];
const MAX_LOG = 500;
let runTestsInFlight = false;

let cachedScreenshot = { buffer: null, ts: 0, catboxUrl: null, catboxTs: 0, capturing: false };
const SCREENSHOT_INTERVAL = 2000;
const CATBOX_INTERVAL = 5000;

const tunnelRegistry = new Map();
const clientHealth = new Map();
const FAILOVER_TIMEOUT = 8000;
const MAX_RETRIES = 3;

function registerTunnel(clientId, tunnelUrl) {
  tunnelRegistry.set(clientId, { url: tunnelUrl, ts: Date.now(), alive: true });
  console.log(`[FAILOVER] Tunnel registered: ${clientId} → ${tunnelUrl} (${tunnelRegistry.size} total)`);
}

function getHealthScore(clientId) {
  const h = clientHealth.get(clientId);
  if (!h) return { score: 50, successes: 0, failures: 0, avgLatency: 0, inflight: 0 };
  const total = h.successes + h.failures;
  const successRate = total > 0 ? (h.successes / total) * 100 : 50;
  const latencyPenalty = Math.min(h.avgLatency / 100, 30);
  const inflightPenalty = h.inflight * 5;
  return { score: Math.max(0, successRate - latencyPenalty - inflightPenalty), ...h };
}

function recordSuccess(clientId, latencyMs) {
  let h = clientHealth.get(clientId);
  if (!h) h = { successes: 0, failures: 0, avgLatency: 0, inflight: 0, lastSuccess: 0, lastFailure: 0 };
  h.successes++;
  h.avgLatency = h.avgLatency > 0 ? (h.avgLatency * 0.7 + latencyMs * 0.3) : latencyMs;
  h.inflight = Math.max(0, h.inflight - 1);
  h.lastSuccess = Date.now();
  clientHealth.set(clientId, h);
}

function recordFailure(clientId) {
  let h = clientHealth.get(clientId);
  if (!h) h = { successes: 0, failures: 0, avgLatency: 0, inflight: 0, lastSuccess: 0, lastFailure: 0 };
  h.failures++;
  h.inflight = Math.max(0, h.inflight - 1);
  h.lastFailure = Date.now();
  clientHealth.set(clientId, h);
}

function recordInflight(clientId) {
  let h = clientHealth.get(clientId);
  if (!h) h = { successes: 0, failures: 0, avgLatency: 0, inflight: 0, lastSuccess: 0, lastFailure: 0 };
  h.inflight++;
  clientHealth.set(clientId, h);
}

function getAllAliveClients() {
  const clients = [];
  for (const [key, client] of bridgeClients) {
    if (client.alive) clients.push({ key, client });
  }
  clients.sort((a, b) => getHealthScore(b.key).score - getHealthScore(a.key).score);
  return clients;
}

function getFirstAliveClient() {
  const all = getAllAliveClients();
  return all.length > 0 ? all[0].client : null;
}

const _grokMemory = { skills: [], failures: [] };
const MEMORY_FILE = path.join(__dirname, "..", ".local", "grok-memory.json");
(function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
      if (data.skills) _grokMemory.skills = data.skills;
      if (data.failures) _grokMemory.failures = data.failures;
    }
  } catch {}
  console.log(`[RELAY] MEMORY loaded: ${activityLog.length} actions, ${_grokMemory.skills.length} skills, ${_grokMemory.failures.length} failures`);
})();

function saveMemory() {
  try {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(_grokMemory, null, 2));
  } catch {}
}

const _stepTracker = {
  goal: null,
  steps: [],
  currentStep: 0,
  startedAt: null,
  actions: [],
};

function stepTrackerReset(goal) {
  _stepTracker.goal = goal || null;
  _stepTracker.steps = [];
  _stepTracker.currentStep = 0;
  _stepTracker.startedAt = Date.now();
  _stepTracker.actions = [];
}

function stepTrackerRecord(endpoint, params, status, durationMs, enrichedOrVerifStatus) {
  let verifStatus;
  if (typeof enrichedOrVerifStatus === "object" && enrichedOrVerifStatus !== null) {
    verifStatus = extractVerificationStatus(enrichedOrVerifStatus);
  } else if (typeof enrichedOrVerifStatus === "string") {
    verifStatus = enrichedOrVerifStatus;
  } else {
    verifStatus = status;
  }
  _stepTracker.actions.push({
    ts: Date.now(),
    endpoint,
    params: typeof params === "object" ? JSON.stringify(params).slice(0, 200) : String(params).slice(0, 200),
    status,
    durationMs,
    verified: verifStatus === "verified" || verifStatus === "success" || verifStatus === "all_ok",
    verificationStatus: verifStatus,
  });
  if (_stepTracker.actions.length > 100) _stepTracker.actions.splice(0, _stepTracker.actions.length - 100);
}

function extractVerificationStatus(enriched) {
  if (!enriched) return "error";
  if (enriched.verification && enriched.verification.status) return enriched.verification.status;
  if (enriched.error) return "error";
  return "unknown";
}

async function enrichWriteResponse(result, project, filePath) {
  if (!result || result.error) {
    const enriched = typeof result === "object" ? { ...result } : { error: result || "no_response" };
    enriched.verification = { action: "file_write", path: filePath, project, status: "error", hint: `Write failed: ${enriched.error}. Check path and content, then retry.` };
    enriched.nextStep = "Write failed. Read the error above, diagnose the issue, and retry with corrected parameters.";
    return enriched;
  }
  const enriched = typeof result === "object" ? { ...result } : { raw: result };
  let readBack = null;
  try {
    const rb = await relayToDesktop([{ type: "read_file", project: project || "__system__", path: filePath }], 8000);
    if (rb && !rb.error) {
      const content = Array.isArray(rb) ? (rb[0]?.content || rb[0]?.text || "") : (rb.content || rb.text || rb.results?.[0]?.content || "");
      readBack = { status: "verified", lineCount: content.split("\n").length, sizeBytes: Buffer.byteLength(content, "utf-8"), content, preview: content.length > 500 ? content.slice(0, 500) + "...[truncated]" : content };
    } else {
      readBack = { status: "read_failed", error: rb?.error || "unknown" };
    }
  } catch (e) { readBack = { status: "read_failed", error: e.message }; }
  enriched.verification = { action: "file_write", path: filePath, project, ...readBack };
  enriched.nextStep = readBack?.status === "verified" ? "File verified. Proceed to next step." : "File write dispatched but read-back failed. Consider reading the file manually with grok-read.";
  return enriched;
}

function enrichRunResponse(result, cmd) {
  if (!result || result.error) {
    const enriched = typeof result === "object" ? { ...result } : { error: result };
    enriched.stdout = enriched.stdout || "";
    enriched.stderr = enriched.stderr || "";
    enriched.exitCode = enriched.exitCode !== undefined ? enriched.exitCode : null;
    enriched.verification = { action: "command", command: cmd, status: "error", hint: "Command failed. Read the error message above, diagnose the root cause, and try a different approach." };
    enriched.nextStep = "Command failed. Read the error above and try a different approach.";
    return enriched;
  }
  const enriched = typeof result === "object" ? { ...result } : { raw: result };
  const results = Array.isArray(result) ? result : (result.results || [result]);
  const first = results[0] || result;
  enriched.stdout = first.stdout !== undefined ? first.stdout : (enriched.stdout || "");
  enriched.stderr = first.stderr !== undefined ? first.stderr : (enriched.stderr || "");
  if (first.exitCode !== undefined) enriched.exitCode = first.exitCode;
  else if (first.exit_code !== undefined) enriched.exitCode = first.exit_code;
  else if (enriched.exitCode === undefined) enriched.exitCode = null;
  const exitOk = enriched.exitCode === 0;
  const exitUnknown = enriched.exitCode === undefined || enriched.exitCode === null;
  const hasStderr = enriched.stderr && enriched.stderr.trim().length > 0;
  const commandStatus = exitOk ? "success" : exitUnknown ? (hasStderr ? "unknown_with_stderr" : "unknown_exit") : "non_zero_exit";
  enriched.verification = {
    action: "command",
    command: cmd,
    status: commandStatus,
    exitCode: enriched.exitCode,
    hint: exitOk ? "Command completed successfully. Read stdout to confirm the expected output."
      : exitUnknown ? (hasStderr ? "Exit code unknown but stderr has output — review stderr carefully." : "Exit code unknown. Review stdout to determine if the command succeeded.")
      : `Command exited with code ${enriched.exitCode}. Check stderr for details.`,
  };
  enriched.nextStep = "Read the stdout/stderr above. State whether this step succeeded or failed and why, then proceed.";
  return enriched;
}

const UI_CHAIN_CMDS = new Set(["click_at", "double_click", "right_click", "keys", "paste", "drag", "focus", "launch", "click", "type_text", "scroll", "hover", "mouse_move", "nav"]);

function enrichGenericResponse(result, action, meta) {
  if (!result) return { error: "no_response", verification: { action, status: "error", hint: "No response from desktop relay." } };
  const enriched = typeof result === "object" ? { ...result } : { raw: result };
  const hasError = !!enriched.error;
  enriched.verification = {
    action,
    status: hasError ? "error" : "success",
    ...meta,
    hint: hasError ? `${action} failed: ${enriched.error}` : `${action} completed successfully.`,
  };
  enriched.nextStep = hasError
    ? "Read the error above, diagnose root cause, and try a different approach."
    : "Action succeeded. Proceed to next step.";
  return enriched;
}

function enrichUIActionResponse(result, action, meta) {
  const enriched = enrichGenericResponse(result, action, meta);
  if (cachedScreenshot.buffer) {
    enriched.screenshotUrl = "/api/grok-last-screenshot?format=image";
    enriched.screenshotAge = ((Date.now() - cachedScreenshot.ts) / 1000).toFixed(1) + "s";
  }
  enriched.verification.touchedUI = true;
  enriched.nextStep = enriched.verification.status === "error"
    ? "UI action failed. Take a screenshot to see current state, then diagnose."
    : "UI action completed. Take a screenshot to verify the visual result.";
  return enriched;
}

async function autoScreenshotAfterUI() {
  try {
    const ssResult = await relayToDesktop([{ type: "screenshot_preview", project: "__system__", windowTitle: "" }], 8000);
    if (ssResult && !ssResult.error) {
      const r = Array.isArray(ssResult) ? ssResult : (ssResult.results || [ssResult]);
      const f = r[0] || ssResult;
      const b = f.base64 || f.screenshot || f.image || "";
      if (b) { cachedScreenshot.buffer = Buffer.from(b.replace(/^data:image\/\w+;base64,/, ""), "base64"); cachedScreenshot.ts = Date.now(); }
    }
  } catch {}
}

async function enrichChainResponse(results, stepsCount, steps) {
  const enriched = { steps: stepsCount, results };
  const hasScreenshot = results.some(r => r.step && (r.step.startsWith("screenshot") || r.step.startsWith("snapshot")));
  const touchedUI = steps.some(s => { const cmd = s.split(":")[0]; return UI_CHAIN_CMDS.has(cmd); });

  if (touchedUI && !hasScreenshot) {
    try {
      const ssResult = await relayToDesktop([{ type: "screenshot_preview", project: "__system__", windowTitle: "" }], 8000);
      if (ssResult && !ssResult.error) {
        const r = Array.isArray(ssResult) ? ssResult : (ssResult.results || [ssResult]);
        const f = r[0] || ssResult;
        const b = f.base64 || f.screenshot || f.image || "";
        if (b) { cachedScreenshot.buffer = Buffer.from(b.replace(/^data:image\/\w+;base64,/, ""), "base64"); cachedScreenshot.ts = Date.now(); }
      }
    } catch {}
  }

  enriched.verification = {
    action: "chain",
    totalSteps: stepsCount,
    completedSteps: results.length,
    hasScreenshot: hasScreenshot || touchedUI,
    touchedUI,
    status: results.every(r => !r.result?.error) ? "all_ok" : "some_errors",
  };
  if (cachedScreenshot.buffer) {
    enriched.screenshotUrl = "/api/grok-last-screenshot?format=image";
    enriched.screenshotAge = ((Date.now() - cachedScreenshot.ts) / 1000).toFixed(1) + "s";
  }
  enriched.nextStep = "Review each step result above. Confirm all steps succeeded, then proceed to your next planned step.";
  return enriched;
}

const RELAY_MAX_INFLIGHT = 8;
let _relayInflightCount = 0;
const _relayThrottleQueue = [];

function relayAcquireSlot() {
  if (_relayInflightCount < RELAY_MAX_INFLIGHT) {
    _relayInflightCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    _relayThrottleQueue.push(resolve);
  });
}

function relayReleaseSlot() {
  _relayInflightCount--;
  if (_relayThrottleQueue.length > 0 && _relayInflightCount < RELAY_MAX_INFLIGHT) {
    _relayInflightCount++;
    const next = _relayThrottleQueue.shift();
    next();
  }
}

function relayGetQueueDepth() {
  return _relayThrottleQueue.length;
}

function logActivity(endpoint, method, params, status, durationMs, detail, source) {
  const entry = {
    ts: Date.now(),
    time: new Date().toISOString(),
    endpoint,
    method: method || "GET",
    params: params || {},
    status: status || "ok",
    durationMs: durationMs || 0,
    detail: detail || "",
    source: source || "",
  };
  activityLog.push(entry);
  if (activityLog.length > MAX_LOG) activityLog.splice(0, activityLog.length - MAX_LOG);
  const paramStr = Object.keys(entry.params).length > 0 ? " " + JSON.stringify(entry.params) : "";
  const srcStr = entry.source ? ` [${entry.source}]` : "";
  console.log(`[ACTIVITY] ${entry.method} ${entry.endpoint} → ${entry.status} (${entry.durationMs}ms)${paramStr}${entry.detail ? " | " + entry.detail : ""}${srcStr}`);
  return entry;
}

function sendJson(res, obj, status) {
  res.writeHead(status || 200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(obj, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function getFirstAliveClient() {
  for (const [, client] of bridgeClients) {
    if (client.alive) return client;
  }
  return null;
}

function relaySingleClient(client, clientKey, actions, timeoutMs) {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const startTs = Date.now();
    recordInflight(clientKey);
    const timer = setTimeout(() => {
      pendingSandboxRelayRequests.delete(requestId);
      recordFailure(clientKey);
      resolve({ error: `Client ${clientKey} timed out after ${(timeoutMs / 1000).toFixed(0)}s`, timeout: true, failedClient: clientKey });
    }, timeoutMs || FAILOVER_TIMEOUT);
    pendingSandboxRelayRequests.set(requestId, {
      resolve: (raw) => {
        clearTimeout(timer);
        const latency = Date.now() - startTs;
        recordSuccess(clientKey, latency);
        try { resolve(JSON.parse(raw)); } catch { resolve({ raw }); }
      },
      timer,
    });
    try {
      client.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions }));
    } catch {
      clearTimeout(timer);
      pendingSandboxRelayRequests.delete(requestId);
      recordFailure(clientKey);
      resolve({ error: `WebSocket send failed for ${clientKey}`, sendFailed: true, failedClient: clientKey });
    }
  });
}

async function relayToDesktop(actions, timeoutMs) {
  const allClients = getAllAliveClients();
  if (allClients.length === 0) {
    return { error: "No desktop client connected.", noClient: true };
  }

  const perClientTimeout = Math.min(timeoutMs || 60000, FAILOVER_TIMEOUT);
  const tried = [];

  for (let attempt = 0; attempt < Math.min(allClients.length, MAX_RETRIES); attempt++) {
    const { key, client } = allClients[attempt];
    tried.push(key);
    const result = await relaySingleClient(client, key, actions, perClientTimeout);

    if (!result.timeout && !result.sendFailed && !result.error) {
      if (tried.length > 1) {
        logActivity("/failover", "INTERNAL", { attempt: attempt + 1, tried }, "recovered", 0, `Failover succeeded on client ${key} after ${tried.length} attempts`);
      }
      return result;
    }

    if (result.error && !result.timeout && !result.sendFailed) {
      return result;
    }

    console.log(`[FAILOVER] Client ${key} failed (attempt ${attempt + 1}/${Math.min(allClients.length, MAX_RETRIES)}): ${result.error}`);

    if (result.timeout) {
      client.alive = false;
      setTimeout(() => { client.alive = true; }, 15000);
    }
  }

  if (allClients.length > tried.length) {
    const remaining = allClients.slice(tried.length);
    for (const { key, client } of remaining) {
      tried.push(key);
      const result = await relaySingleClient(client, key, actions, perClientTimeout);
      if (!result.timeout && !result.sendFailed) return result;
      console.log(`[FAILOVER] Extended retry ${key} also failed: ${result.error}`);
    }
  }

  logActivity("/failover", "INTERNAL", { tried }, "all-failed", 0, `All ${tried.length} clients failed`);
  return { error: `All ${tried.length} desktop clients failed. Tried: ${tried.join(", ")}`, allFailed: true, tried };
}

function uploadToCatbox(buffer) {
  return new Promise((resolve) => {
    const boundary = "----LambyUpload" + Date.now();
    const filename = "lamby-stream-" + Date.now() + ".jpg";
    let body = "";
    body += `--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n`;
    body += `--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    const bodyBuf = Buffer.concat([Buffer.from(body), buffer, Buffer.from(footer)]);
    const req = https.request({
      hostname: "catbox.moe",
      path: "/user/api.php",
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": bodyBuf.length },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", (d) => data += d);
      res.on("end", () => resolve(data.trim()));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.write(bodyBuf);
    req.end();
  });
}

async function refreshScreenshot() {
  if (cachedScreenshot.capturing) return;
  const client = getFirstAliveClient();
  if (!client) return;
  cachedScreenshot.capturing = true;
  try {
    const result = await relayToDesktop([{ type: "screenshot_preview", project: "__system__" }], 15000);
    if (result && !result.error) {
      const results = Array.isArray(result) ? result : (result.results || [result]);
      const first = results[0] || result;
      const b64 = first.base64 || first.screenshot || first.image || "";
      if (b64) {
        const clean = b64.replace(/^data:image\/\w+;base64,/, "");
        cachedScreenshot.buffer = Buffer.from(clean, "base64");
        cachedScreenshot.ts = Date.now();
      }
      if (first.url && first.url.startsWith("http")) {
        cachedScreenshot.catboxUrl = first.url;
        cachedScreenshot.catboxTs = Date.now();
      }
    }
  } catch {}
  cachedScreenshot.capturing = false;
}

async function uploadCachedToCatbox() {
  if (!cachedScreenshot.buffer) return;
  if (Date.now() - cachedScreenshot.catboxTs < CATBOX_INTERVAL) return;
  const url = await uploadToCatbox(cachedScreenshot.buffer);
  if (url && url.startsWith("http")) {
    cachedScreenshot.catboxUrl = url;
    cachedScreenshot.catboxTs = Date.now();
  }
}

setInterval(refreshScreenshot, SCREENSHOT_INTERVAL);
setInterval(uploadCachedToCatbox, CATBOX_INTERVAL);

setInterval(() => {
  const now = Date.now();
  const STALE_MS = 60000;
  for (const [key, client] of bridgeClients) {
    if (!client.alive) continue;
    if (now - client.lastPing > STALE_MS) {
      console.log(`[FAILOVER] Client ${key} stale (no ping in ${((now - client.lastPing) / 1000).toFixed(0)}s) — marking dead, pool has ${getAllAliveClients().length - 1} remaining`);
      client.alive = false;
      try { client.send(JSON.stringify({ type: "ping" })); } catch {}
    }
  }
  for (const [key, tunnel] of tunnelRegistry) {
    if (now - tunnel.ts > 300000) {
      tunnelRegistry.delete(key);
      console.log(`[FAILOVER] Removed stale tunnel ${key} (5min+ old)`);
    }
  }
}, 15000);

const bridgeWss = new WebSocketServer({ noServer: true });

bridgeWss.on("connection", (ws, project, initialPreviewPort) => {
  const connId = crypto.randomUUID();
  const clientKey = project + "-" + connId.slice(0, 8);

  const existingClient = bridgeClients.get(project);
  if (existingClient) {
    const altKey = project + "-alt-" + Date.now();
    console.log(`[Bridge] Multiple connections for ${project} (old connId: ${existingClient.connId.substring(0, 8)}) — keeping both (failover pool). Primary=${project}, Alt=${altKey}`);
    bridgeClients.set(altKey, existingClient);
  }

  const ppNum = initialPreviewPort ? parseInt(initialPreviewPort, 10) : null;
  logActivity("/bridge-ws", "WS", { project, previewPort: ppNum, totalClients: bridgeClients.size + 1 }, "connected", 0, `Desktop client connected (pool: ${bridgeClients.size + 1})`);

  const client = { ws, lastPing: Date.now(), alive: true, connId, replaced: false, project, previewPort: ppNum || null, tunnelUrl: null };
  bridgeClients.set(project, client);

  client.send = (data) => {
    try {
      if (ws.readyState === 1) {
        ws.send(data, (err) => {
          if (err) console.log(`[Bridge] Send error to ${project}: ${err.message}`);
        });
      }
    } catch (err) {
      console.log(`[Bridge] Send exception to ${project}: ${err.message}`);
    }
  };

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "snapshot-response" && msg.requestId) {
        const pending = pendingRelayRequests.get(msg.requestId);
        if (pending) { clearTimeout(pending.timer); pendingRelayRequests.delete(msg.requestId); pending.resolve(msg.snapshot || "Error: Empty snapshot response."); }
      } else if (msg.type === "sandbox-execute-response" && msg.requestId) {
        const pending = pendingSandboxRelayRequests.get(msg.requestId);
        if (pending) { clearTimeout(pending.timer); pendingSandboxRelayRequests.delete(msg.requestId); pending.resolve(JSON.stringify(msg.result || { error: "Empty sandbox response." })); }
      } else if (msg.type === "console-logs-response" && msg.requestId) {
        const pending = pendingConsoleLogRequests.get(msg.requestId);
        if (pending) { clearTimeout(pending.timer); pendingConsoleLogRequests.delete(msg.requestId); pending.resolve(msg.logs || { error: "Empty console logs." }); }
      } else if (msg.type === "hello") {
        if (msg.previewPort) { const pp = parseInt(msg.previewPort, 10); if (pp > 0) client.previewPort = pp; }
        if (msg.projectName) client.project = msg.projectName;
        if (msg.tunnelUrl) {
          client.tunnelUrl = msg.tunnelUrl;
          registerTunnel(project, msg.tunnelUrl);
        }
        client.lastPing = Date.now();
      } else if (msg.type === "register-tunnel") {
        if (msg.url) {
          client.tunnelUrl = msg.url;
          registerTunnel(msg.id || project, msg.url);
          client.send(JSON.stringify({ type: "tunnel-registered", url: msg.url, pool: tunnelRegistry.size }));
        }
      } else if (msg.type === "ping") {
        client.lastPing = Date.now();
        client.send(JSON.stringify({ type: "pong", pool: bridgeClients.size, health: getHealthScore(project) }));
      } else if (msg.type === "pong") {
        client.lastPing = Date.now();
      }
    } catch {}
  });

  ws.on("close", () => {
    if (client.replaced) return;
    client.alive = false;
    const current = bridgeClients.get(project);
    if (current && current.connId === connId) bridgeClients.delete(project);

    const remaining = getAllAliveClients();
    if (remaining.length > 0) {
      logActivity("/bridge-ws", "WS", { project, remaining: remaining.length }, "client-dropped", 0, `Client dropped but ${remaining.length} still in pool — no disruption`);
    } else {
      logActivity("/bridge-ws", "WS", { project }, "all-disconnected", 0, "Last desktop client disconnected");
    }
  });

  ws.on("error", () => {
    client.alive = false;
    const current = bridgeClients.get(project);
    if (current && current.connId === connId) bridgeClients.delete(project);
  });
});

function buildDashboardHtml() {
  const entries = activityLog.slice(-200).reverse();
  const rows = entries.map((e) => {
    const age = ((Date.now() - e.ts) / 1000).toFixed(0);
    const cls = e.status === "error" || e.status === "timeout" ? "err" : e.status === "connected" || e.status === "ok" ? "ok" : "warn";
    const params = Object.keys(e.params).length > 0 ? JSON.stringify(e.params) : "";
    const src = e.source ? `<span style="color:#818cf8;font-size:10px">${e.source}</span>` : "";
    return `<tr class="${cls}"><td>${age}s ago</td><td>${src}</td><td><b>${e.method}</b></td><td>${e.endpoint}</td><td>${params}</td><td>${e.status}</td><td>${e.durationMs}ms</td><td>${e.detail || ""}</td></tr>`;
  }).join("");

  const aliveClients = getAllAliveClients();
  const clients = Array.from(bridgeClients.entries()).map(([k, c]) => {
    const age = ((Date.now() - c.lastPing) / 1000).toFixed(0);
    const h = getHealthScore(k);
    const healthBar = `<span style="display:inline-block;width:40px;height:6px;background:#333;border-radius:3px;overflow:hidden;vertical-align:middle"><span style="display:block;width:${Math.round(h.score)}%;height:100%;background:${h.score > 70 ? '#34d399' : h.score > 40 ? '#fbbf24' : '#ef4444'}"></span></span>`;
    const tunnel = c.tunnelUrl ? ` | <a href="${c.tunnelUrl}" style="color:#60a5fa;font-size:10px">${c.tunnelUrl.replace(/https?:\/\//, '').slice(0, 30)}...</a>` : "";
    return `<div class="client ${c.alive ? "alive" : "dead"}"><b>${c.project || k}</b> | port ${c.previewPort || "?"} | ping ${age}s ago | ${c.alive ? "ALIVE" : "DEAD"} | health ${healthBar} ${h.score.toFixed(0)}% | ${h.successes}ok/${h.failures}fail | inflight:${h.inflight}${tunnel}</div>`;
  }).join("") || '<div class="client dead">No clients connected</div>';

  const tunnels = Array.from(tunnelRegistry.entries()).map(([k, v]) => {
    const age = ((Date.now() - v.ts) / 1000).toFixed(0);
    return `<div class="tunnel"><b>${k}</b> → <a href="${v.url}" target="_blank" style="color:#60a5fa">${v.url}</a> (${age}s ago) ${v.alive ? "ACTIVE" : "DOWN"}</div>`;
  }).join("") || '<div class="tunnel">No tunnels registered</div>';

  const failoverMode = aliveClients.length > 1 ? "MULTI-CLIENT FAILOVER" : aliveClients.length === 1 ? "SINGLE CLIENT" : "NO CLIENTS";
  const failoverColor = aliveClients.length > 1 ? "#34d399" : aliveClients.length === 1 ? "#fbbf24" : "#ef4444";

  const streamAge = cachedScreenshot.ts > 0 ? ((Date.now() - cachedScreenshot.ts) / 1000).toFixed(1) + "s ago" : "none";
  const catboxAge = cachedScreenshot.catboxTs > 0 ? ((Date.now() - cachedScreenshot.catboxTs) / 1000).toFixed(1) + "s ago" : "none";

  return `<!DOCTYPE html><html><head><title>Lamby Bridge Relay v2.1</title>
<meta http-equiv="refresh" content="3">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#c8ccd0;font-family:'SF Mono',Monaco,Consolas,monospace;font-size:13px;padding:16px}
h1{color:#a78bfa;font-size:20px;margin-bottom:4px}
h2{color:#60a5fa;font-size:14px;margin:12px 0 6px;text-transform:uppercase;letter-spacing:1px}
.header{display:flex;align-items:center;gap:16px;margin-bottom:12px;flex-wrap:wrap}
.header .badge{background:#1e1b4b;color:#a78bfa;padding:4px 10px;border-radius:4px;font-size:12px}
.header .badge.live{background:#064e3b;color:#34d399}
.header .badge.failover{background:#1e3a5f;color:${failoverColor};font-weight:bold}
.clients{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.client{padding:6px 12px;border-radius:4px;font-size:12px;background:#1a1a2e}
.client.alive{border-left:3px solid #34d399}
.client.dead{border-left:3px solid #ef4444;opacity:0.6}
.tunnel{padding:4px 12px;border-radius:4px;font-size:11px;background:#111127;margin-bottom:4px}
.stream-info{background:#1a1a2e;padding:10px 14px;border-radius:6px;margin-bottom:12px;display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.stream-info a{color:#60a5fa;text-decoration:none}
.stream-info a:hover{text-decoration:underline}
.stream-preview{max-width:320px;max-height:180px;border:1px solid #333;border-radius:4px}
table{width:100%;border-collapse:collapse;margin-top:6px}
th{text-align:left;padding:6px 8px;background:#1a1a2e;color:#a78bfa;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;position:sticky;top:0}
td{padding:5px 8px;border-bottom:1px solid #1a1a2e;font-size:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
tr.ok td:nth-child(5){color:#34d399}
tr.err td:nth-child(5){color:#ef4444;font-weight:bold}
tr.warn td:nth-child(5){color:#fbbf24}
tr:hover{background:#111127}
.log-wrap{max-height:calc(100vh - 300px);overflow-y:auto}
</style></head><body>
<div class="header">
  <h1>Lamby Bridge Relay v2.1</h1>
  <span class="badge">uptime: ${(process.uptime() / 60).toFixed(1)}m</span>
  <span class="badge ${bridgeClients.size > 0 ? "live" : ""}">${bridgeClients.size > 0 ? "DESKTOP CONNECTED" : "WAITING FOR DESKTOP"}</span>
  <span class="badge failover">${failoverMode}</span>
  <span class="badge">${aliveClients.length}/${bridgeClients.size} clients alive</span>
  <span class="badge">${tunnelRegistry.size} tunnels</span>
  <span class="badge">${activityLog.length} events logged</span>
</div>
<h2>Client Pool (failover-enabled)</h2>
<div class="clients">${clients}</div>
<h2>Registered Tunnels</h2>
<div style="margin-bottom:12px">${tunnels}</div>
${_stepTracker.goal ? `<h2>Active Goal Tracker</h2>
<div style="background:#1a1a2e;padding:12px 16px;border-radius:6px;margin-bottom:12px;border-left:3px solid #a78bfa">
  <div style="font-size:14px;font-weight:bold;color:#e0e7ff;margin-bottom:6px">🎯 ${_stepTracker.goal}</div>
  <div style="font-size:11px;color:#818cf8;margin-bottom:8px">Started: ${_stepTracker.startedAt ? new Date(_stepTracker.startedAt).toLocaleTimeString() : 'N/A'} | Actions: ${_stepTracker.actions.length}</div>
  ${_stepTracker.steps.length > 0 ? '<div style="display:flex;flex-direction:column;gap:3px">' + _stepTracker.steps.map((s, i) => {
    const icon = s.status === 'done' ? '✅' : s.status === 'failed' ? '❌' : i === _stepTracker.currentStep ? '▶️' : '⬜';
    const color = s.status === 'done' ? '#34d399' : s.status === 'failed' ? '#ef4444' : i === _stepTracker.currentStep ? '#fbbf24' : '#666';
    return `<div style="font-size:12px;color:${color}">${icon} Step ${i + 1}: ${s.description}</div>`;
  }).join('') + '</div>' : '<div style="font-size:11px;color:#666">No steps registered (Grok can POST to /api/grok-goal to set steps)</div>'}
  ${_stepTracker.actions.length > 0 ? '<div style="margin-top:8px;font-size:10px;color:#666">Recent actions: ' + _stepTracker.actions.slice(-5).map(a => `<span style="color:${a.verified ? '#34d399' : a.verificationStatus === 'error' || a.verificationStatus === 'non_zero_exit' ? '#f87171' : '#fbbf24'}">${a.endpoint} <b>${a.verified ? 'PASS' : a.verificationStatus === 'error' || a.verificationStatus === 'non_zero_exit' ? 'FAIL' : a.verificationStatus || '?'}</b>(${a.durationMs}ms)</span>`).join(' → ') + '</div>' : ''}
</div>` : ''}
<h2>Live Screenshot Stream</h2>
<div class="stream-info">
  <div>
    <div><b>PNG Stream:</b> <a href="/stream">/stream</a> (raw image, ${streamAge})</div>
    <div><b>Catbox:</b> ${cachedScreenshot.catboxUrl ? `<a href="${cachedScreenshot.catboxUrl}" target="_blank">${cachedScreenshot.catboxUrl}</a>` : "uploading..."} (${catboxAge})</div>
    <div><b>Stream Viewer:</b> <a href="/api/desktop-stream">/api/desktop-stream</a></div>
    <div><b>JSON:</b> <a href="/api/stream-status">/api/stream-status</a></div>
  </div>
  ${cachedScreenshot.buffer ? `<img class="stream-preview" src="/stream?t=${Date.now()}" alt="Live Stream">` : ""}
</div>
<h2>Activity Log (last ${entries.length})</h2>
<div class="log-wrap">
<table><thead><tr><th>Age</th><th>Source</th><th>Method</th><th>Endpoint</th><th>Params</th><th>Status</th><th>Duration</th><th>Detail</th></tr></thead>
<tbody>${rows}</tbody></table>
</div>
</body></html>`;
}

function buildStreamViewerHtml(baseUrl) {
  return `<!DOCTYPE html><html><head><title>Lamby Desktop Stream</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#111;color:#eee;font-family:system-ui;overflow:hidden}
#wrap{position:relative;width:100vw;height:calc(100vh - 50px)}
#frame{width:100%;height:100%;object-fit:contain;background:#000;display:block}
#coords{position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:14px;padding:6px 12px;border-radius:4px;z-index:20;pointer-events:none;white-space:pre}
#crosshair{position:absolute;pointer-events:none;display:none;z-index:10}
#crosshair .h{position:absolute;width:30px;height:1px;background:rgba(255,50,50,0.8)}
#crosshair .v{position:absolute;width:1px;height:30px;background:rgba(255,50,50,0.8)}
#clickMarker{position:absolute;width:12px;height:12px;border-radius:50%;border:2px solid #f00;background:rgba(255,0,0,0.3);pointer-events:none;display:none;z-index:15;transform:translate(-50%,-50%)}
#controls{height:50px;display:flex;align-items:center;gap:12px;padding:0 16px;background:#222;border-top:1px solid #333}
#controls button{background:#444;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px}
#controls button:hover{background:#555}
#controls button.active{background:#7c3aed}
#status{margin-left:auto;font-size:12px;color:#888}
#fps{font-size:12px;color:#aaa;margin-left:8px}
select{background:#333;color:#fff;border:1px solid #555;padding:4px 8px;border-radius:4px;font-size:13px}
</style></head><body>
<div id="wrap">
  <img id="frame" alt="Desktop Stream">
  <div id="coords">PHYSICAL: --,--</div>
  <div id="crosshair"><div class="h"></div><div class="v"></div></div>
  <div id="clickMarker"></div>
</div>
<div id="controls">
  <button onclick="toggleStream()" id="toggleBtn" class="active">Pause</button>
  <label>FPS: <select id="fpsSelect" onchange="setFps(this.value)">
    <option value="500">2</option><option value="1000" selected>1</option><option value="2000">0.5</option><option value="250">4</option>
  </select></label>
  <span id="fps"></span>
  <span id="status">Connecting...</span>
</div>
<script>
let streaming=true, interval=1000, frameCount=0, lastFpsTs=Date.now();
let imgNatW=1920, imgNatH=1080;
const img=document.getElementById("frame"), status=document.getElementById("status"), fpsEl=document.getElementById("fps");
const coordsEl=document.getElementById("coords"), crosshair=document.getElementById("crosshair"), clickMarker=document.getElementById("clickMarker");

function getScreenCoords(e){
  const rect=img.getBoundingClientRect();
  const imgAspect=imgNatW/imgNatH, boxAspect=rect.width/rect.height;
  let renderW,renderH,offsetX,offsetY;
  if(imgAspect>boxAspect){renderW=rect.width;renderH=rect.width/imgAspect;offsetX=0;offsetY=(rect.height-renderH)/2;}
  else{renderH=rect.height;renderW=rect.height*imgAspect;offsetY=0;offsetX=(rect.width-renderW)/2;}
  const localX=e.clientX-rect.left-offsetX, localY=e.clientY-rect.top-offsetY;
  const physX=Math.round((localX/renderW)*imgNatW), physY=Math.round((localY/renderH)*imgNatH);
  return {sx:physX,sy:physY,localX,localY,renderW,renderH,offsetX,offsetY,inBounds:localX>=0&&localY>=0&&localX<=renderW&&localY<=renderH};
}

img.addEventListener("mousemove",function(e){
  const c=getScreenCoords(e);
  if(!c.inBounds){coordsEl.textContent="Out of bounds";return;}
  coordsEl.textContent="PHYSICAL: "+c.sx+","+c.sy+"\\nhw.exe click "+c.sx+" "+c.sy;
  crosshair.style.display="block";
  crosshair.style.left=(e.clientX-img.getBoundingClientRect().left)+"px";
  crosshair.style.top=(e.clientY-img.getBoundingClientRect().top)+"px";
});

img.addEventListener("click",function(e){
  const c=getScreenCoords(e);
  if(!c.inBounds)return;
  clickMarker.style.display="block";
  clickMarker.style.left=(e.clientX-img.getBoundingClientRect().left)+"px";
  clickMarker.style.top=(e.clientY-img.getBoundingClientRect().top)+"px";
  navigator.clipboard.writeText("click_at:"+c.sx+","+c.sy).catch(()=>{});
  coordsEl.textContent="CLICKED: "+c.sx+","+c.sy+" (copied)";
  setTimeout(()=>{clickMarker.style.display="none";},2000);
});

function poll(){
  if(!streaming)return;
  const t=Date.now();
  fetch("/api/desktop-frame?t="+t).then(r=>{
    if(!r.ok)throw new Error(r.status);
    return r.blob();
  }).then(b=>{
    const url=URL.createObjectURL(b);
    const tmpImg=new Image();
    tmpImg.onload=function(){imgNatW=tmpImg.naturalWidth;imgNatH=tmpImg.naturalHeight;img.src=url;};
    tmpImg.src=url;
    frameCount++;
    const elapsed=Date.now()-lastFpsTs;
    if(elapsed>2000){fpsEl.textContent=((frameCount/(elapsed/1000)).toFixed(1))+" fps";frameCount=0;lastFpsTs=Date.now();}
    status.textContent="Live ("+Math.round(Date.now()-t)+"ms) "+imgNatW+"x"+imgNatH;
    setTimeout(poll,interval);
  }).catch(e=>{status.textContent="Error: "+e.message;setTimeout(poll,interval*2);});
}
function toggleStream(){streaming=!streaming;document.getElementById("toggleBtn").textContent=streaming?"Pause":"Resume";document.getElementById("toggleBtn").classList.toggle("active",streaming);if(streaming)poll();}
function setFps(v){interval=parseInt(v);}
poll();
</script></body></html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const startTime = Date.now();
  const reqHost = (req.headers.host || "").replace(/:\d+$/, "");
  const reqSource = reqHost.includes("trycloudflare.com") ? reqHost.split(".")[0] : reqHost.includes("localhost") ? "localhost" : reqHost.split(".")[0] || "";
  const _log = (ep, method, params, status, dur, detail) => logActivity(ep, method, params, status, dur, detail, reqSource);

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" });
    res.end();
    return;
  }

  if (pathname === "/" || pathname === "/dashboard") {
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" });
    res.end(buildDashboardHtml());
    return;
  }

  if (pathname === "/health" || pathname === "/healthz") {
    sendJson(res, {
      status: "ok",
      service: "Lamby Bridge Relay",
      bridge: bridgeClients.size > 0 ? "connected" : "waiting-for-desktop",
      connectedClients: bridgeClients.size,
      uptime: process.uptime(),
      screenshot: { age: cachedScreenshot.ts > 0 ? Date.now() - cachedScreenshot.ts : null, catboxUrl: cachedScreenshot.catboxUrl },
      throttle: { inflight: _relayInflightCount, maxInflight: RELAY_MAX_INFLIGHT, queued: _relayThrottleQueue.length },
    });
    return;
  }

  if (pathname === "/stream" || pathname === "/api/stream.png" || pathname === "/api/screenshot-latest.png") {
    _log(pathname, "GET", {}, cachedScreenshot.buffer ? "ok" : "no-frame", Date.now() - startTime, "Stream frame requested");
    if (cachedScreenshot.buffer) {
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-cache, no-store, must-revalidate", "Access-Control-Allow-Origin": "*" });
      res.end(cachedScreenshot.buffer);
    } else {
      const placeholder = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" });
      res.end(placeholder);
    }
    return;
  }

  if (pathname === "/api/stream-status") {
    sendJson(res, {
      hasFrame: !!cachedScreenshot.buffer,
      frameAge: cachedScreenshot.ts > 0 ? Date.now() - cachedScreenshot.ts : null,
      frameSize: cachedScreenshot.buffer ? cachedScreenshot.buffer.length : 0,
      catboxUrl: cachedScreenshot.catboxUrl,
      catboxAge: cachedScreenshot.catboxTs > 0 ? Date.now() - cachedScreenshot.catboxTs : null,
      streamUrl: "/stream",
      desktopConnected: bridgeClients.size > 0,
    });
    return;
  }

  if (pathname === "/api/desktop-stream") {
    res.writeHead(200, { "Content-Type": "text/html", "Access-Control-Allow-Origin": "*" });
    res.end(buildStreamViewerHtml(`${url.protocol}//${url.host}`));
    return;
  }

  if (pathname === "/api/desktop-frame") {
    _log(pathname, "GET", Object.fromEntries(url.searchParams), "forwarding", 0, "Desktop frame request");
    if (cachedScreenshot.buffer && Date.now() - cachedScreenshot.ts < 5000) {
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-cache, no-store", "Access-Control-Allow-Origin": "*" });
      res.end(cachedScreenshot.buffer);
      return;
    }
    const result = await relayToDesktop([{ type: "screenshot_preview", project: "__system__" }], 15000);
    if (result && !result.error) {
      const results = Array.isArray(result) ? result : (result.results || [result]);
      const first = results[0] || result;
      const b64 = first.base64 || first.screenshot || first.image || "";
      if (b64) {
        const clean = b64.replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(clean, "base64");
        cachedScreenshot.buffer = buf;
        cachedScreenshot.ts = Date.now();
        _log(pathname, "GET", {}, "ok", Date.now() - startTime, `Frame ${buf.length} bytes`);
        res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-cache, no-store", "Access-Control-Allow-Origin": "*" });
        res.end(buf);
        return;
      }
    }
    _log(pathname, "GET", {}, "error", Date.now() - startTime, "No frame available");
    sendJson(res, { error: "Could not capture desktop frame", result }, 503);
    return;
  }

  if (pathname === "/api/activity") {
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const filter = url.searchParams.get("filter") || "";
    let entries = activityLog.slice(-limit);
    if (filter) entries = entries.filter(e => e.endpoint.includes(filter) || e.detail.includes(filter) || e.status.includes(filter));
    sendJson(res, { total: activityLog.length, showing: entries.length, entries: entries.reverse() });
    return;
  }

  if (pathname === "/api/snapshot-key") {
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${protocol}://${host}`;
    sendJson(res, {
      baseUrl,
      snapshotUrl: `${baseUrl}/api/snapshot/PROJECT_NAME`,
      commandEndpoint: `${baseUrl}/api/sandbox/execute`,
      streamUrl: `${baseUrl}/stream`,
      catboxUrl: cachedScreenshot.catboxUrl,
      dashboardUrl: `${baseUrl}/dashboard`,
      bridgeWs: `wss://${host}/bridge-ws?project=YOUR_PROJECT`,
    });
    return;
  }

  if (pathname === "/api/bridge-status") {
    const clients = Array.from(bridgeClients.entries()).map(([key, c]) => ({
      key: key.substring(0, 8) + "...",
      project: c.project || key,
      connected: c.alive,
      previewPort: c.previewPort || null,
      lastPing: c.lastPing,
      lastPingAge: Date.now() - c.lastPing,
      tunnelUrl: c.tunnelUrl || null,
      health: getHealthScore(key),
    }));
    const tunnels = Array.from(tunnelRegistry.entries()).map(([k, v]) => ({ id: k, url: v.url, alive: v.alive, age: Date.now() - v.ts }));
    sendJson(res, {
      connectedClients: clients.length,
      aliveClients: clients.filter(c => c.connected).length,
      failoverEnabled: clients.filter(c => c.connected).length > 1,
      clients,
      tunnels,
      screenshot: { age: cachedScreenshot.ts > 0 ? Date.now() - cachedScreenshot.ts : null, catboxUrl: cachedScreenshot.catboxUrl },
    });
    return;
  }

  if (pathname === "/api/failover-status") {
    const allClients = getAllAliveClients();
    const healthMap = {};
    for (const { key } of allClients) healthMap[key] = getHealthScore(key);
    const tunnels = Array.from(tunnelRegistry.entries()).map(([k, v]) => ({ id: k, ...v }));
    sendJson(res, {
      mode: allClients.length > 1 ? "multi-client-failover" : allClients.length === 1 ? "single-client" : "no-clients",
      poolSize: allClients.length,
      maxRetries: MAX_RETRIES,
      failoverTimeout: FAILOVER_TIMEOUT,
      clients: allClients.map(({ key, client }) => ({
        key,
        project: client.project,
        alive: client.alive,
        tunnelUrl: client.tunnelUrl,
        lastPing: client.lastPing,
        health: getHealthScore(key),
      })),
      tunnels,
      healthMap,
    });
    return;
  }

  if (pathname === "/api/register-tunnel") {
    let tunnelUrl, tunnelId;
    if (req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      tunnelUrl = body.url; tunnelId = body.id;
    } else {
      tunnelUrl = url.searchParams.get("url") || "";
      tunnelId = url.searchParams.get("id") || "";
    }
    if (tunnelUrl) {
      registerTunnel(tunnelId || "manual-" + Date.now(), tunnelUrl);
      _log("/api/register-tunnel", req.method, { id: tunnelId, url: tunnelUrl }, "ok", 0, "Tunnel registered via API");
      sendJson(res, { ok: true, totalTunnels: tunnelRegistry.size, tunnels: Array.from(tunnelRegistry.entries()).map(([k, v]) => ({ id: k, url: v.url })) });
    } else {
      sendJson(res, { error: "Missing url field. GET: ?url=URL&id=ID or POST: {url, id}" }, 400);
    }
    return;
  }

  if (pathname === "/api/tunnels") {
    const tunnels = Array.from(tunnelRegistry.entries()).map(([k, v]) => ({ id: k, url: v.url, alive: v.alive, registeredAt: v.ts, age: Date.now() - v.ts }));
    sendJson(res, { count: tunnels.length, tunnels });
    return;
  }

  if (pathname === "/api/upload-render" && req.method === "POST") {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      try {
        const buf = Buffer.concat(chunks);
        const ts = Date.now();
        const fname = `render_${ts}.jpg`;
        const fpath = path.join(__dirname, "..", "public", "renders", fname);
        fs.mkdirSync(path.join(__dirname, "..", "public", "renders"), { recursive: true });
        fs.writeFileSync(fpath, buf);
        _log(pathname, "POST", {}, "ok", Date.now() - startTime, `${fname} ${buf.length} bytes`);
        sendJson(res, { ok: true, file: fname, size: buf.length, url: `/renders/${fname}` });
      } catch (e) {
        sendJson(res, { error: e.message }, 500);
      }
    });
    return;
  }

  if (pathname.startsWith("/api/snapshot/")) {
    const pathParts = pathname.replace("/api/snapshot/", "").split("/").filter(Boolean);
    const projectName = pathParts[0] || "";
    _log(pathname, "GET", { project: projectName }, "forwarding", 0, "Snapshot request");
    const matchedClient = getFirstAliveClient();
    if (!matchedClient) { _log(pathname, "GET", { project: projectName }, "no-client", Date.now() - startTime); sendJson(res, { error: "No desktop client connected." }, 503); return; }
    const requestId = crypto.randomUUID();
    const relayPromise = new Promise((resolve) => {
      const timer = setTimeout(() => { pendingRelayRequests.delete(requestId); resolve("Error: Relay timeout."); }, 30000);
      pendingRelayRequests.set(requestId, { resolve, timer });
    });
    try { matchedClient.send(JSON.stringify({ type: "snapshot-request", requestId, projectName })); } catch { sendJson(res, { error: "WebSocket send failed." }, 502); return; }
    const snapshot = await relayPromise;
    _log(pathname, "GET", { project: projectName }, "ok", Date.now() - startTime, `Snapshot ${typeof snapshot === "string" ? snapshot.length : 0} chars`);
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" });
    res.end(snapshot);
    return;
  }

  if (pathname === "/api/console-logs") {
    const projectName = url.searchParams.get("project") || "";
    _log(pathname, "GET", { project: projectName }, "forwarding", 0);
    const matchedClient = getFirstAliveClient();
    if (!matchedClient) { sendJson(res, { error: "No desktop client connected." }, 503); return; }
    const requestId = crypto.randomUUID();
    const relayPromise = new Promise((resolve) => {
      const timer = setTimeout(() => { pendingConsoleLogRequests.delete(requestId); resolve({ error: "Relay timeout." }); }, 15000);
      pendingConsoleLogRequests.set(requestId, { resolve, timer });
    });
    try { matchedClient.send(JSON.stringify({ type: "console-logs-request", requestId, projectName })); } catch { sendJson(res, { error: "WebSocket send failed." }, 502); return; }
    const logs = await relayPromise;
    _log(pathname, "GET", { project: projectName }, "ok", Date.now() - startTime);
    sendJson(res, logs);
    return;
  }

  if (pathname === "/api/sandbox/execute") {
    let actions;
    try {
      if (req.method === "POST") {
        const body = JSON.parse(await readBody(req));
        actions = body.actions;
      } else {
        const actionsParam = url.searchParams.get("actions") || "";
        const payloadParam = url.searchParams.get("payload") || "";
        if (payloadParam) {
          actions = JSON.parse(Buffer.from(payloadParam, "base64").toString("utf-8"));
          if (!Array.isArray(actions)) actions = [actions];
        } else if (actionsParam) {
          actions = JSON.parse(actionsParam);
          if (!Array.isArray(actions)) actions = [actions];
        }
      }
      if (!actions) { sendJson(res, { error: "actions required. GET: ?actions=JSON or ?payload=BASE64 or POST: {actions: [...]}" }, 400); return; }
      if (!Array.isArray(actions) || actions.length === 0) { sendJson(res, { error: "actions array required" }, 400); return; }
      if (actions.length > 50) { sendJson(res, { error: "Max 50 actions" }, 400); return; }
      for (const a of actions) _log(pathname, "POST", { type: a.type, project: a.project || "" }, "forwarding", 0);
      const queueDepth = relayGetQueueDepth();
      await relayAcquireSlot();
      try {
        const dynamicTimeout = 60000 + (queueDepth * 10000);
        const result = await relayToDesktop(actions, dynamicTimeout);
        const dur = Date.now() - startTime;
        for (const a of actions) _log(pathname, req.method, { type: a.type, project: a.project || "" }, result.error ? "error" : "ok", dur, result.error || "");
        const enriched = enrichGenericResponse(result, "sandbox_execute", { actionCount: actions.length, types: actions.map(a => a.type).join(",") });
        stepTrackerRecord(pathname, { actionCount: actions.length }, result.error ? "error" : "ok", dur, enriched);
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify(enriched, null, 2));
      } finally {
        relayReleaseSlot();
      }
    } catch (err) { sendJson(res, { error: err.message }, 500); }
    return;
  }

  if (pathname === "/api/sandbox/audit-log") {
    sendJson(res, { total: activityLog.length, entries: activityLog.slice(-100).reverse() });
    return;
  }

  const screenshotMatch = pathname.match(/^\/api\/screenshot\/([^/]+)(?:\/([^/]+))?$/);
  if (screenshotMatch) {
    const project = decodeURIComponent(screenshotMatch[2] || screenshotMatch[1]);
    const selector = url.searchParams.get("selector") || undefined;
    const fullPage = url.searchParams.get("fullPage") === "true";
    const waitMs = parseInt(url.searchParams.get("waitMs") || "2000");
    _log(pathname, "GET", { project, selector, fullPage }, "forwarding", 0);
    const result = await relayToDesktop([{ type: "screenshot_preview", project, selector, fullPage, waitMs }], 60000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "screenshot_preview", { project, selector: selector || null });
    if (!enriched.error) {
      const raw = Array.isArray(result) ? result[0] : result;
      const b64 = raw?.screenshot || raw?.image || raw?.data || raw?.base64 || "";
      if (b64) {
        cachedScreenshot.buffer = Buffer.from(b64, "base64");
        cachedScreenshot.ts = Date.now();
        enriched.screenshotUrl = "/api/grok-last-screenshot?format=image";
        enriched.screenshotAge = "0.0s";
      }
    }
    stepTrackerRecord(pathname, { project }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-proxy") {
    const matchedClient = getFirstAliveClient();
    if (!matchedClient) { sendJson(res, { error: "No desktop client connected." }, 503); return; }
    const payloadB64 = url.searchParams.get("payload") || "";
    if (!payloadB64) { sendJson(res, { error: "payload parameter required (base64-encoded JSON)" }, 400); return; }
    let actions;
    try {
      let decoded;
      try { const buf = Buffer.from(payloadB64, "base64"); decoded = zlib.gunzipSync(buf).toString("utf-8"); } catch { decoded = Buffer.from(payloadB64, "base64").toString("utf-8"); }
      const parsed = JSON.parse(decoded);
      actions = parsed.actions || [parsed];
      if (!Array.isArray(actions)) actions = [actions];
    } catch (e) { sendJson(res, { error: "Invalid base64 payload: " + e.message }, 400); return; }
    if (actions.length === 0) { sendJson(res, { error: "Empty actions" }, 400); return; }
    if (actions.length > 50) { sendJson(res, { error: "Max 50 actions" }, 400); return; }
    const project = url.searchParams.get("project") || "";
    actions = actions.map(a => ({ ...a, project: a.project || project }));
    for (const a of actions) _log(pathname, "GET", { type: a.type, project: a.project || "" }, "forwarding", 0, `grok-proxy: ${a.type}`);
    const result = await relayToDesktop(actions, 60000);
    const dur = Date.now() - startTime;
    for (const a of actions) _log(pathname, "GET", { type: a.type }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "grok_proxy", { actionCount: actions.length, types: actions.map(a => a.type).join(",") });
    stepTrackerRecord(pathname, { actionCount: actions.length }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-edit") {
    const project = url.searchParams.get("project") || "";
    const filePath = url.searchParams.get("path") || "";
    const searchB64 = url.searchParams.get("searchB64") || "";
    const replaceB64 = url.searchParams.get("replaceB64") || "";
    const search = searchB64 ? Buffer.from(searchB64, "base64").toString("utf-8") : (url.searchParams.get("search") || "");
    const replace = replaceB64 ? Buffer.from(replaceB64, "base64").toString("utf-8") : (url.searchParams.get("replace") || "");
    const replaceAll = url.searchParams.get("replaceAll") === "true";
    if (!filePath) { sendJson(res, { error: "path parameter required" }, 400); return; }
    if (!search) { sendJson(res, { error: "search parameter required" }, 400); return; }
    _log(pathname, "GET", { project, path: filePath }, "forwarding", 0, `Edit ${filePath}`);
    const result = await relayToDesktop([{ type: "search_replace", project, path: filePath, search, replace, replaceAll }], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project, path: filePath }, result.error ? "error" : "ok", dur, `Edit ${filePath}`);
    const enriched = await enrichWriteResponse(result, project, filePath);
    stepTrackerRecord(pathname, { project, path: filePath }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-interact") {
    const project = url.searchParams.get("project") || "";
    const action = url.searchParams.get("action") || "";
    if (!project || !action) {
      sendJson(res, { error: "Required: project, action", actions: ["click", "type", "select", "evaluate", "runFunction", "waitFor", "snapshot"] });
      return;
    }
    const interactAction = { type: "browser_interact", project, action };
    for (const [k, v] of url.searchParams) {
      if (k === "project" || k === "action") continue;
      if (k === "text") interactAction.value = v;
      else if (k === "code") interactAction.script = v;
      else if (k === "x" || k === "y" || k === "waitAfter" || k === "timeout") interactAction[k] = parseInt(v);
      else if (k === "screenshot") interactAction[k] = v === "true";
      else if (k === "args") try { interactAction[k] = JSON.parse(v); } catch {}
      else interactAction[k] = v;
    }
    _log(pathname, "GET", { project, action }, "forwarding", 0, `Interact: ${action}`);
    const result = await relayToDesktop([interactAction], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project, action }, result.error ? "error" : "ok", dur);
    await autoScreenshotAfterUI();
    const enriched = enrichUIActionResponse(result, "browser_interact", { project, action });
    stepTrackerRecord(pathname, { project, action }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-read") {
    const project = url.searchParams.get("project") || "";
    const filePath = url.searchParams.get("path") || "";
    const files = url.searchParams.get("files") || "";
    let actions;
    if (files) {
      actions = [{ type: "read_multiple_files", project, paths: files.split(",").map(f => f.trim()) }];
    } else {
      if (!filePath) { sendJson(res, { error: "path or files parameter required" }, 400); return; }
      actions = [{ type: "read_file", project, path: filePath }];
    }
    _log(pathname, "GET", { project, path: filePath || files }, "forwarding", 0);
    const result = await relayToDesktop(actions, 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "read_file", { project, path: filePath || files });
    stepTrackerRecord(pathname, { project, path: filePath || files }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-write") {
    const project = url.searchParams.get("project") || "";
    const filePath = url.searchParams.get("path") || "";
    const searchB64 = url.searchParams.get("searchB64") || "";
    const replaceB64 = url.searchParams.get("replaceB64") || "";
    const search = searchB64 ? Buffer.from(searchB64, "base64").toString("utf-8") : (url.searchParams.get("search") || "");
    const replace = replaceB64 ? Buffer.from(replaceB64, "base64").toString("utf-8") : (url.searchParams.get("replace") || "");
    const patch = url.searchParams.get("patch") || "";
    if (!filePath) { sendJson(res, { error: "path required" }, 400); return; }
    let actions;
    if (patch) {
      actions = [{ type: "apply_patch", project, path: filePath, patch }];
    } else {
      actions = [{ type: "search_replace", project, path: filePath, search, replace, replaceAll: url.searchParams.get("replaceAll") === "true" }];
    }
    _log(pathname, "GET", { project, path: filePath }, "forwarding", 0, `Write ${filePath}`);
    const result = await relayToDesktop(actions, 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project, path: filePath }, result.error ? "error" : "ok", dur);
    const enriched = await enrichWriteResponse(result, project, filePath);
    stepTrackerRecord(pathname, { project, path: filePath }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-create") {
    const project = url.searchParams.get("project") || "";
    const filePath = url.searchParams.get("path") || "";
    const contentB64 = url.searchParams.get("contentB64") || "";
    const content = contentB64 ? Buffer.from(contentB64, "base64").toString("utf-8") : (url.searchParams.get("content") || "");
    if (!filePath) { sendJson(res, { error: "path required" }, 400); return; }
    _log(pathname, "GET", { project, path: filePath }, "forwarding", 0, `Create ${filePath}`);
    const result = await relayToDesktop([{ type: "create_file", project, path: filePath, content }], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project, path: filePath }, result.error ? "error" : "ok", dur);
    const enriched = await enrichWriteResponse(result, project, filePath);
    stepTrackerRecord(pathname, { project, path: filePath }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-create-chunk") {
    const project = url.searchParams.get("project") || "";
    const filePath = url.searchParams.get("path") || "";
    const content = url.searchParams.get("content") || "";
    const chunk = parseInt(url.searchParams.get("chunk") || "0");
    const total = parseInt(url.searchParams.get("total") || "1");
    if (!filePath) { sendJson(res, { error: "path required" }, 400); return; }
    _log(pathname, "GET", { project, path: filePath, chunk, total }, "forwarding", 0);
    const result = await relayToDesktop([{ type: "write_file_chunk", project, path: filePath, content, chunk_index: chunk, total_chunks: total }], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project, path: filePath }, result.error ? "error" : "ok", dur);
    if (chunk === total - 1) {
      const enriched = await enrichWriteResponse(result, project, filePath);
      stepTrackerRecord(pathname, { project, path: filePath }, result.error ? "error" : "ok", dur, enriched);
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(enriched, null, 2));
    } else {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(result, null, 2));
    }
    return;
  }

  if (pathname === "/api/grok-push") {
    const project = url.searchParams.get("project") || "";
    const filePath = url.searchParams.get("path") || "";
    const contentB64 = url.searchParams.get("contentB64") || "";
    const content = contentB64 ? Buffer.from(contentB64, "base64").toString("utf-8") : (url.searchParams.get("content") || "");
    const search = url.searchParams.get("search") || "";
    const replace = url.searchParams.get("replace") || "";
    if (!filePath) { sendJson(res, { error: "path required" }, 400); return; }
    let actions;
    if (search) {
      actions = [{ type: "search_replace", project, path: filePath, search, replace }];
    } else {
      actions = [{ type: "write_file", project, path: filePath, content }];
    }
    _log(pathname, "GET", { project, path: filePath }, "forwarding", 0);
    const result = await relayToDesktop(actions, 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project, path: filePath }, result.error ? "error" : "ok", dur);
    const enriched = await enrichWriteResponse(result, project, filePath);
    stepTrackerRecord(pathname, { project, path: filePath }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-delete") {
    const project = url.searchParams.get("project") || "";
    const filePath = url.searchParams.get("path") || "";
    if (!filePath) { sendJson(res, { error: "path required" }, 400); return; }
    _log(pathname, "GET", { project, path: filePath }, "forwarding", 0, `Delete ${filePath}`);
    const result = await relayToDesktop([{ type: "delete_file", project, path: filePath }], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project, path: filePath }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "delete_file", { project, path: filePath });
    stepTrackerRecord(pathname, { project, path: filePath }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/remote-update" || pathname === "/api/grok-remote-update") {
    let filePath, content, project;
    if (req.method === "POST") {
      try {
        const body = JSON.parse(await readBody(req));
        filePath = body.file || body.path || "";
        content = body.content || "";
        project = body.project || "__system__";
        if (body.contentB64) content = Buffer.from(body.contentB64, "base64").toString("utf-8");
      } catch (e) { sendJson(res, { error: "Invalid JSON body: " + e.message }, 400); return; }
    } else {
      filePath = url.searchParams.get("file") || url.searchParams.get("path") || "";
      project = url.searchParams.get("project") || "__system__";
      const contentB64 = url.searchParams.get("contentB64") || "";
      content = contentB64 ? Buffer.from(contentB64, "base64").toString("utf-8") : (url.searchParams.get("content") || "");
    }
    if (!filePath) { sendJson(res, { error: "file/path required. GET: ?file=PATH&content=DATA or POST: {file, content}" }, 400); return; }
    if (filePath === "status") {
      sendJson(res, { ok: true, endpoint: "remote-update", hint: "Pass ?file=PATH&content=DATA to write a file on the desktop" });
      return;
    }
    _log(pathname, req.method, { project, path: filePath, contentLen: content.length }, "forwarding", 0, `Remote update ${filePath}`);
    const result = await relayToDesktop([{ type: "write_file", project, path: filePath, content }], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, req.method, { project, path: filePath }, result.error ? "error" : "ok", dur);
    const enriched = await enrichWriteResponse(result, project, filePath);
    stepTrackerRecord(pathname, { project, path: filePath }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-tree") {
    const project = url.searchParams.get("project") || "";
    const filter = url.searchParams.get("filter") || "";
    const ext = url.searchParams.get("ext") || "";
    _log(pathname, "GET", { project }, "forwarding", 0);
    const action = { type: "list_tree", project };
    if (filter) action.filter = filter;
    if (ext) action.ext = ext;
    const result = await relayToDesktop([action], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "list_tree", { project });
    stepTrackerRecord(pathname, { project }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-search") {
    const project = url.searchParams.get("project") || "";
    const q = url.searchParams.get("q") || "";
    const type = url.searchParams.get("type") || "";
    if (!q) { sendJson(res, { error: "q parameter required" }, 400); return; }
    _log(pathname, "GET", { project, q, type }, "forwarding", 0);
    let actionType = "grep";
    if (type === "symbol") actionType = "symbol_search";
    else if (type === "file") actionType = "search_files";
    else if (type === "usages") actionType = "find_usages";
    const result = await relayToDesktop([{ type: actionType, project, query: q, pattern: q }], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project, q }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "search", { project, query: q });
    stepTrackerRecord(pathname, { project, q }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-run") {
    const project = url.searchParams.get("project") || "";
    const cmd = url.searchParams.get("cmd") || "";
    if (!cmd) { sendJson(res, { error: "cmd parameter required" }, 400); return; }
    _log(pathname, "GET", { project, cmd: cmd.substring(0, 80) }, "forwarding", 0, `Run: ${cmd.substring(0, 60)}`);
    const result = await relayToDesktop([{ type: "run_command", project, command: cmd }], 60000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur, `Run: ${cmd.substring(0, 40)}`);
    const enriched = enrichRunResponse(result, cmd);
    stepTrackerRecord(pathname, { cmd: cmd.substring(0, 80) }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-git") {
    const project = url.searchParams.get("project") || "";
    const action = url.searchParams.get("action") || "status";
    const params = Object.fromEntries(url.searchParams);
    _log(pathname, "GET", { project, action }, "forwarding", 0, `Git: ${action}`);
    const gitAction = { type: `git_${action}`, project };
    if (params.message) gitAction.message = params.message;
    if (params.branch) gitAction.branch = params.branch;
    if (params.files) gitAction.files = params.files;
    if (params.path) gitAction.path = params.path;
    const result = await relayToDesktop([gitAction], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project, action }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, `git_${action}`, { project, action });
    stepTrackerRecord(pathname, { project, action }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-process") {
    const project = url.searchParams.get("project") || "";
    const action = url.searchParams.get("action") || "list";
    _log(pathname, "GET", { project, action }, "forwarding", 0);
    let actionType = "list_processes";
    if (action === "kill") actionType = "kill_process";
    else if (action === "start") actionType = "start_process";
    const actionObj = { type: actionType, project };
    if (url.searchParams.get("pid")) actionObj.pid = parseInt(url.searchParams.get("pid"));
    if (url.searchParams.get("name")) actionObj.name = url.searchParams.get("name");
    if (url.searchParams.get("command")) actionObj.command = url.searchParams.get("command");
    const result = await relayToDesktop([actionObj], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project, action }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, `process_${action}`, { project });
    stepTrackerRecord(pathname, { project, action }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-quality") {
    const project = url.searchParams.get("project") || "";
    _log(pathname, "GET", { project }, "forwarding", 0);
    const result = await relayToDesktop([{ type: "type_check", project }, { type: "lint_and_fix", project }], 60000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "quality_check", { project });
    stepTrackerRecord(pathname, { project }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-deps") {
    const project = url.searchParams.get("project") || "";
    _log(pathname, "GET", { project }, "forwarding", 0);
    const result = await relayToDesktop([{ type: "install_deps", project }], 60000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichRunResponse(result, "install_deps");
    stepTrackerRecord(pathname, { project }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-super") {
    const project = url.searchParams.get("project") || "";
    const describe = url.searchParams.get("describe") || "";
    _log(pathname, "GET", { project, describe: describe.substring(0, 60) }, "forwarding", 0);
    const result = await relayToDesktop([{ type: "super_command", project, describe }], 60000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "super_command", { project, describe });
    stepTrackerRecord(pathname, { project, describe: describe.substring(0, 60) }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-graph") {
    const project = url.searchParams.get("project") || "";
    const action = url.searchParams.get("action") || "deps";
    const params = Object.fromEntries(url.searchParams);
    _log(pathname, "GET", { project, action }, "forwarding", 0);
    const result = await relayToDesktop([{ type: "dependency_graph", project, action, ...params }], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "dependency_graph", { project, action });
    stepTrackerRecord(pathname, { project, action }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-changeset") {
    const project = url.searchParams.get("project") || "";
    const action = url.searchParams.get("action") || "apply";
    const opsB64 = url.searchParams.get("ops") || "";
    _log(pathname, "GET", { project, action }, "forwarding", 0);
    let ops = [];
    if (opsB64) try { ops = JSON.parse(Buffer.from(opsB64, "base64").toString("utf-8")); } catch {}
    const result = await relayToDesktop([{ type: "bulk_write", project, action, ops }], 60000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "bulk_write", { project, action, opsCount: ops.length });
    stepTrackerRecord(pathname, { project, action, opsCount: ops.length }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-macro/project-status") {
    const project = url.searchParams.get("project") || "";
    _log(pathname, "GET", { project }, "forwarding", 0);
    const result = await relayToDesktop([
      { type: "git_status", project },
      { type: "list_tree", project },
      { type: "detect_structure", project },
    ], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "project_status", { project });
    stepTrackerRecord(pathname, { project }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-macro/read-context") {
    const project = url.searchParams.get("project") || "";
    const filePath = url.searchParams.get("path") || "";
    if (!filePath) { sendJson(res, { error: "path required" }, 400); return; }
    _log(pathname, "GET", { project, path: filePath }, "forwarding", 0);
    const result = await relayToDesktop([
      { type: "read_file", project, path: filePath },
      { type: "extract_imports", project, path: filePath },
    ], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "read_context", { project, path: filePath });
    stepTrackerRecord(pathname, { project, path: filePath }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-launch-exe") {
    const project = url.searchParams.get("project") || "";
    const exePath = url.searchParams.get("path") || "";
    const args = url.searchParams.get("args") || "";
    if (!exePath) { sendJson(res, { error: "path required" }, 400); return; }
    _log(pathname, "GET", { project, path: exePath }, "forwarding", 0, `Launch: ${exePath}`);
    const cmd = args ? `"${exePath}" ${args}` : `"${exePath}"`;
    const result = await relayToDesktop([{ type: "run_command", project, command: `start "" ${cmd}` }], 15000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichRunResponse(result, `launch ${exePath}`);
    stepTrackerRecord(pathname, { path: exePath }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-list-windows") {
    const project = url.searchParams.get("project") || "__system__";
    _log(pathname, "GET", { project }, "forwarding", 0);
    const result = await relayToDesktop([{ type: "run_command", project, command: 'powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne \'\'} | Select-Object Id, MainWindowTitle | Format-Table -AutoSize"' }], 15000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichRunResponse(result, "list_windows");
    stepTrackerRecord(pathname, {}, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-bring-to-front") {
    const project = url.searchParams.get("project") || "__system__";
    const title = url.searchParams.get("title") || "";
    if (!title) { sendJson(res, { error: "title required" }, 400); return; }
    _log(pathname, "GET", { title }, "forwarding", 0);
    const result = await relayToDesktop([{ type: "run_command", project, command: `powershell -Command "$w = Get-Process | Where-Object {$_.MainWindowTitle -like '*${title}*'} | Select-Object -First 1; if($w){[void][System.Reflection.Assembly]::LoadWithPartialName('Microsoft.VisualBasic');[Microsoft.VisualBasic.Interaction]::AppActivate($w.Id)}"` }], 10000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { title }, result.error ? "error" : "ok", dur);
    await autoScreenshotAfterUI();
    const enriched = enrichUIActionResponse(result, "bring_to_front", { title });
    stepTrackerRecord(pathname, { title }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-get-window-info") {
    const project = url.searchParams.get("project") || "__system__";
    const title = url.searchParams.get("title") || "";
    _log(pathname, "GET", { title }, "forwarding", 0);
    const result = await relayToDesktop([{ type: "run_command", project, command: `powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle -like '*${title}*'} | Select-Object Id, MainWindowTitle, @{N='Responding';E={$_.Responding}} | ConvertTo-Json"` }], 10000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { title }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "get_window_info", { title });
    stepTrackerRecord(pathname, { title }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-click-at") {
    const project = url.searchParams.get("project") || "__system__";
    const x = url.searchParams.get("x") || "0";
    const y = url.searchParams.get("y") || "0";
    _log(pathname, "GET", { x, y }, "forwarding", 0, `Click at ${x},${y}`);
    const result = await relayToDesktop([{ type: "run_command", project, command: `C:\\Users\\Aiden\\Desktop\\Lamby\\hw.exe click ${x} ${y}` }], 10000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { x, y }, result.error ? "error" : "ok", dur);
    await autoScreenshotAfterUI();
    const enriched = enrichUIActionResponse(result, "click_at", { x, y });
    stepTrackerRecord(pathname, { x, y }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-send-keys") {
    const project = url.searchParams.get("project") || "__system__";
    const keys = url.searchParams.get("keys") || "";
    if (!keys) { sendJson(res, { error: "keys required" }, 400); return; }
    _log(pathname, "GET", { keys }, "forwarding", 0, `Keys: ${keys}`);
    const result = await relayToDesktop([{ type: "run_command", project, command: `C:\\Users\\Aiden\\Desktop\\Lamby\\hw.exe key ${keys}` }], 10000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { keys }, result.error ? "error" : "ok", dur);
    await autoScreenshotAfterUI();
    const enriched = enrichUIActionResponse(result, "send_keys", { keys });
    stepTrackerRecord(pathname, { keys }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-paste") {
    const project = url.searchParams.get("project") || "__system__";
    const text = url.searchParams.get("text") || "";
    _log(pathname, "GET", { textLen: text.length }, "forwarding", 0, `Paste ${text.length} chars`);
    const result = await relayToDesktop([{ type: "run_command", project, command: `C:\\Users\\Aiden\\Desktop\\Lamby\\hw.exe type ${text}` }], 10000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", {}, result.error ? "error" : "ok", dur);
    await autoScreenshotAfterUI();
    const enriched = enrichUIActionResponse(result, "paste", { textLen: text.length });
    stepTrackerRecord(pathname, { textLen: text.length }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-cdp") {
    const project = url.searchParams.get("project") || "";
    const action = url.searchParams.get("action") || "snapshot";
    const params = Object.fromEntries(url.searchParams);
    _log(pathname, "GET", { project, action }, "forwarding", 0, `CDP: ${action}`);
    const result = await relayToDesktop([{ type: "browser_interact", project, action, ...params }], 30000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project, action }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, `cdp_${action}`, { project, action });
    stepTrackerRecord(pathname, { project, action }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-screenshot-window") {
    const project = url.searchParams.get("project") || "__system__";
    const title = url.searchParams.get("title") || "";
    _log(pathname, "GET", { title }, "forwarding", 0, `Screenshot window: ${title}`);
    const result = await relayToDesktop([{ type: "screenshot_preview", project, windowTitle: title }], 30000);
    if (result && !result.error) {
      const results = Array.isArray(result) ? result : (result.results || [result]);
      const first = results[0] || result;
      const b64 = first.base64 || first.screenshot || first.image || "";
      if (b64) {
        const clean = b64.replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(clean, "base64");
        cachedScreenshot.buffer = buf;
        cachedScreenshot.ts = Date.now();
      }
    }
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { title }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "screenshot_window", { title });
    stepTrackerRecord(pathname, { title }, result.error ? "error" : "ok", dur, enriched);
    if (cachedScreenshot.buffer) {
      enriched.screenshotUrl = "/api/grok-last-screenshot?format=image";
      enriched.screenshotAge = ((Date.now() - cachedScreenshot.ts) / 1000).toFixed(1) + "s";
    }
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-inject-prompt") {
    const project = url.searchParams.get("project") || "";
    const prompt = url.searchParams.get("prompt") || "";
    _log(pathname, "GET", { project, promptLen: prompt.length }, "forwarding", 0);
    const result = await relayToDesktop([{ type: "run_command", project, command: `echo ${JSON.stringify(prompt)}` }], 10000);
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { project }, result.error ? "error" : "ok", dur);
    const enriched = enrichGenericResponse(result, "inject_prompt", { promptLen: prompt.length });
    stepTrackerRecord(pathname, { promptLen: prompt.length }, result.error ? "error" : "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-last-screenshot") {
    if (cachedScreenshot.buffer) {
      _log(pathname, "GET", {}, "ok", 0, "Cached screenshot");
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" });
      res.end(cachedScreenshot.buffer);
    } else {
      sendJson(res, { error: "No screenshot cached" }, 404);
    }
    return;
  }

  if (pathname === "/api/grok-do") {
    const chain = url.searchParams.get("chain") || "";
    const task = url.searchParams.get("task") || "";
    const params = Object.fromEntries(url.searchParams);
    _log(pathname, "GET", { chain: chain.substring(0, 80), task }, "forwarding", 0, `Do: ${chain || task}`);

    if (task) {
      const result = await relayToDesktop([{ type: "run_command", project: "__system__", command: `echo "Task: ${task}" && ${task}` }], 60000);
      const dur = Date.now() - startTime;
      _log(pathname, "GET", { task }, result.error ? "error" : "ok", dur);
      const enriched = enrichRunResponse(result, task);
      stepTrackerRecord(pathname, { task }, result.error ? "error" : "ok", dur, enriched);
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(enriched, null, 2));
      return;
    }

    if (!chain) { sendJson(res, { error: "chain or task parameter required" }, 400); return; }

    const steps = chain.split("|").map(s => s.trim()).filter(Boolean);
    const results = [];
    for (const step of steps) {
      const [cmd, ...argParts] = step.split(":");
      const arg = argParts.join(":");
      let action;
      switch (cmd) {
        case "run": action = { type: "run_command", project: "__system__", command: arg }; break;
        case "wait": await new Promise(r => setTimeout(r, parseInt(arg) || 1000)); results.push({ step, result: "waited" }); continue;
        case "screenshot": action = { type: "screenshot_preview", project: "__system__", windowTitle: arg || "" }; break;
        case "click_at": { const [x, y] = (arg || "0,0").split(","); action = { type: "run_command", project: "__system__", command: `C:\\Users\\Aiden\\Desktop\\Lamby\\hw.exe click ${x} ${y}` }; break; }
        case "double_click": { const [x, y] = (arg || "0,0").split(","); action = { type: "run_command", project: "__system__", command: `C:\\Users\\Aiden\\Desktop\\Lamby\\hw.exe dclick ${x} ${y}` }; break; }
        case "right_click": { const [x, y] = (arg || "0,0").split(","); action = { type: "run_command", project: "__system__", command: `C:\\Users\\Aiden\\Desktop\\Lamby\\hw.exe rclick ${x} ${y}` }; break; }
        case "keys": action = { type: "run_command", project: "__system__", command: `C:\\Users\\Aiden\\Desktop\\Lamby\\hw.exe key ${arg}` }; break;
        case "paste": action = { type: "run_command", project: "__system__", command: `C:\\Users\\Aiden\\Desktop\\Lamby\\hw.exe type ${arg}` }; break;
        case "drag": { const [x1, y1, x2, y2, btn, st] = (arg || "").split(","); action = { type: "run_command", project: "__system__", command: `C:\\Users\\Aiden\\Desktop\\Lamby\\hw.exe drag ${x1} ${y1} ${x2} ${y2} ${st || 50}` }; break; }
        case "focus": action = { type: "run_command", project: "__system__", command: `powershell -Command "$w = Get-Process | Where-Object {$_.MainWindowTitle -like '*${arg}*'} | Select-Object -First 1; if($w){[void][System.Reflection.Assembly]::LoadWithPartialName('Microsoft.VisualBasic');[Microsoft.VisualBasic.Interaction]::AppActivate($w.Id)}"` }; break;
        case "launch": action = { type: "run_command", project: "__system__", command: `start "" "${arg}"` }; break;
        case "list_windows": action = { type: "run_command", project: "__system__", command: 'powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne \'\'} | Select-Object Id, MainWindowTitle | Format-Table -AutoSize"' }; break;
        case "mouse_move": case "hover": { const [x, y] = (arg || "0,0").split(","); action = { type: "run_command", project: "__system__", command: `C:\\Users\\Aiden\\Desktop\\Lamby\\hw.exe move ${x} ${y}` }; break; }
        case "scroll": { const [x, y, dy] = (arg || "0,0,3").split(","); action = { type: "run_command", project: "__system__", command: `C:\\Users\\Aiden\\Desktop\\Lamby\\hw.exe scroll ${x} ${y} ${dy || 3}` }; break; }
        case "nav": action = { type: "browser_interact", project: "__system__", action: "navigate", url: arg }; break;
        case "click": action = { type: "browser_interact", project: "__system__", action: "click", selector: arg }; break;
        case "type_text": { const [sel, ...txt] = (arg || ",").split(","); action = { type: "browser_interact", project: "__system__", action: "type", selector: sel, value: txt.join(",") }; break; }
        case "eval": action = { type: "browser_interact", project: "__system__", action: "evaluate", script: arg }; break;
        case "snapshot": action = { type: "browser_interact", project: "__system__", action: "snapshot" }; break;
        default: action = { type: "run_command", project: "__system__", command: step }; break;
      }
      const stepResult = await relayToDesktop([action], 30000);
      results.push({ step, result: stepResult });
      if (cmd === "screenshot" && stepResult && !stepResult.error) {
        const r = Array.isArray(stepResult) ? stepResult : (stepResult.results || [stepResult]);
        const f = r[0] || stepResult;
        const b = f.base64 || f.screenshot || f.image || "";
        if (b) { cachedScreenshot.buffer = Buffer.from(b.replace(/^data:image\/\w+;base64,/, ""), "base64"); cachedScreenshot.ts = Date.now(); }
      }
    }
    const dur = Date.now() - startTime;
    _log(pathname, "GET", { steps: steps.length }, "ok", dur, `Chain: ${steps.length} steps`);
    const enriched = await enrichChainResponse(results, steps.length, steps);
    stepTrackerRecord(pathname, { chain: chain.substring(0, 80) }, "ok", dur, enriched);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(enriched, null, 2));
    return;
  }

  if (pathname === "/api/grok-orient") {
    const project = url.searchParams.get("project") || "";
    const goal = url.searchParams.get("goal") || "";
    const orient = { ts: Date.now(), desktopConnected: bridgeClients.size > 0 };
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocol}://${host}`;

    if (goal) {
      stepTrackerReset(goal);
      orient.goalRegistered = goal;
    }

    try {
      const treeResult = await relayToDesktop([{ type: "list_tree", project: project || "__system__" }], 10000);
      orient.fileTree = treeResult.error ? { error: treeResult.error } : treeResult;
    } catch (e) { orient.fileTree = { error: e.message }; }

    try {
      const gitResult = await relayToDesktop([{ type: "git_status", project: project || "__system__" }], 10000);
      orient.gitStatus = gitResult.error ? { error: gitResult.error } : gitResult;
    } catch (e) { orient.gitStatus = { error: e.message }; }

    try {
      const diffResult = await relayToDesktop([{ type: "git_diff", project: project || "__system__" }], 10000);
      orient.gitDiff = diffResult.error ? { error: diffResult.error } : diffResult;
    } catch (e) { orient.gitDiff = { error: e.message }; }

    try {
      const logResult = await relayToDesktop([{ type: "run_command", project: project || "__system__", command: "git log --oneline -5" }], 10000);
      const raw = Array.isArray(logResult) ? (logResult[0]?.stdout || "") : (logResult.stdout || logResult.results?.[0]?.stdout || "");
      orient.gitRecentCommits = raw ? raw.trim().split("\n").slice(0, 5) : [];
    } catch (e) { orient.gitRecentCommits = { error: e.message }; }

    try {
      const winResult = await relayToDesktop([{ type: "run_command", project: "__system__", command: 'powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne \'\'} | Select-Object Id, MainWindowTitle | Format-Table -AutoSize"' }], 10000);
      orient.windows = winResult;
    } catch (e) { orient.windows = { error: e.message }; }

    const screenshotStale = !cachedScreenshot.buffer || (Date.now() - cachedScreenshot.ts > 10000);
    if (screenshotStale && bridgeClients.size > 0) {
      try {
        const ssResult = await relayToDesktop([{ type: "screenshot_preview" }], 8000);
        if (ssResult && !ssResult.error) {
          const raw = Array.isArray(ssResult) ? ssResult[0] : ssResult;
          const b64 = raw?.screenshot || raw?.image || raw?.data || raw?.base64 || "";
          if (b64) {
            cachedScreenshot.buffer = Buffer.from(b64, "base64");
            cachedScreenshot.ts = Date.now();
          }
        }
      } catch (e) { /* best-effort screenshot capture */ }
    }
    orient.screenshot = cachedScreenshot.buffer
      ? { available: true, url: `${base}/api/grok-last-screenshot?format=image`, ageSeconds: ((Date.now() - cachedScreenshot.ts) / 1000).toFixed(1), catboxUrl: cachedScreenshot.catboxUrl || null }
      : { available: false, reason: bridgeClients.size > 0 ? "screenshot_capture_failed" : "no_desktop_connected" };

    if (goal) {
      const q = goal.toLowerCase();
      orient.relevantSkills = _grokMemory.skills.filter(s => s.name.toLowerCase().includes(q) || s.domain.toLowerCase().includes(q) || JSON.stringify(s.steps).toLowerCase().includes(q)).map(s => ({ name: s.name, domain: s.domain, stepsCount: s.steps.length }));
    }
    orient.allSkills = _grokMemory.skills.map(s => ({ name: s.name, domain: s.domain, stepsCount: s.steps.length }));

    orient.recentErrors = activityLog.filter(a => a.status === "error").slice(-5).map(a => ({ ts: a.ts, endpoint: a.endpoint, detail: a.detail }));

    orient.stepTracker = { ..._stepTracker };

    orient.quickRef = {
      orient: `${base}/api/grok-orient?project=PROJECT&goal=TASK_DESCRIPTION`,
      goal: `${base}/api/grok-goal (POST {goal, steps} | GET ?action=advance|fail|clear)`,
      write: `${base}/api/grok-write?project=PROJECT&path=FILE&search=OLD&replace=NEW`,
      create: `${base}/api/grok-create?project=PROJECT&path=FILE&content=DATA`,
      run: `${base}/api/grok-run?project=PROJECT&cmd=COMMAND`,
      read: `${base}/api/grok-read?project=PROJECT&path=FILE`,
      tree: `${base}/api/grok-tree?project=PROJECT`,
      search: `${base}/api/grok-search?project=PROJECT&q=QUERY`,
      "do": `${base}/api/grok-do?chain=STEP1|STEP2`,
      screenshot: `${base}/api/grok-do?chain=screenshot`,
      git: `${base}/api/grok-git?project=PROJECT&action=status`,
    };

    _log(pathname, "GET", { project, goal: goal || "(none)" }, "ok", Date.now() - startTime, "Orient");
    sendJson(res, orient);
    return;
  }

  if (pathname === "/api/grok-goal") {
    const action = url.searchParams.get("action") || "";
    const goalParam = url.searchParams.get("goal") || "";

    if (req.method === "POST" || (goalParam && action !== "advance" && action !== "fail" && action !== "clear")) {
      try {
        let goalText, stepsArr;
        if (req.method === "POST") {
          const body = JSON.parse(await readBody(req));
          goalText = body.goal || ""; stepsArr = body.steps;
        } else {
          goalText = goalParam;
          const stepsParam = url.searchParams.get("steps") || "";
          if (stepsParam) {
            try { stepsArr = JSON.parse(stepsParam); } catch { stepsArr = stepsParam.split("|").map(s => s.trim()).filter(Boolean); }
          }
        }
        stepTrackerReset(goalText);
        if (stepsArr && Array.isArray(stepsArr)) {
          _stepTracker.steps = stepsArr.map((s, i) => ({ index: i, description: typeof s === "string" ? s : s.description || `Step ${i+1}`, status: "pending" }));
        }
        _log(pathname, req.method, { goal: _stepTracker.goal }, "ok", Date.now() - startTime, `Goal set: ${_stepTracker.goal}`);
        sendJson(res, { ok: true, goal: _stepTracker.goal, steps: _stepTracker.steps.length });
      } catch (e) { sendJson(res, { error: e.message }, 400); }
      return;
    }
    if (action === "advance") {
      const idx = _stepTracker.currentStep;
      if (idx < _stepTracker.steps.length) {
        _stepTracker.steps[idx].status = "done";
        _stepTracker.currentStep = idx + 1;
      }
      sendJson(res, { ok: true, currentStep: _stepTracker.currentStep, total: _stepTracker.steps.length });
      return;
    }
    if (action === "fail") {
      const idx = _stepTracker.currentStep;
      if (idx < _stepTracker.steps.length) _stepTracker.steps[idx].status = "failed";
      sendJson(res, { ok: true, currentStep: _stepTracker.currentStep, failedStep: idx });
      return;
    }
    if (action === "clear") {
      stepTrackerReset(null);
      sendJson(res, { ok: true, cleared: true });
      return;
    }
    sendJson(res, _stepTracker);
    return;
  }

  if (pathname === "/api/grok-memory") {
    const action = url.searchParams.get("action") || "";

    if (action === "crystallize") {
      try {
        let skillData;
        if (req.method === "POST") {
          skillData = JSON.parse(await readBody(req));
        } else {
          const nameP = url.searchParams.get("name") || "unnamed";
          const domainP = url.searchParams.get("domain") || "";
          const stepsP = url.searchParams.get("steps") || "[]";
          let parsedSteps;
          try { parsedSteps = JSON.parse(stepsP); } catch { parsedSteps = stepsP.split("|").map(s => s.trim()).filter(Boolean); }
          const stepsB64 = url.searchParams.get("stepsB64") || "";
          if (stepsB64) {
            try { parsedSteps = JSON.parse(Buffer.from(stepsB64, "base64").toString("utf-8")); } catch {}
          }
          skillData = { name: nameP, domain: domainP, steps: parsedSteps };
        }
        const skill = { name: skillData.name || "unnamed", domain: skillData.domain || "", steps: skillData.steps || [], crystallizedAt: new Date().toISOString() };
        const existing = _grokMemory.skills.findIndex(s => s.name === skill.name);
        if (existing >= 0) _grokMemory.skills[existing] = skill;
        else _grokMemory.skills.push(skill);
        saveMemory();
        _log(pathname, req.method, { name: skill.name }, "ok", Date.now() - startTime, `Crystallized: ${skill.name}`);
        sendJson(res, { ok: true, name: skill.name, totalSkills: _grokMemory.skills.length });
      } catch (e) { sendJson(res, { error: e.message }, 400); }
      return;
    }

    if (action === "skills") {
      sendJson(res, { skills: _grokMemory.skills.map(s => ({ name: s.name, domain: s.domain, stepsCount: s.steps.length, crystallizedAt: s.crystallizedAt })) });
      return;
    }

    if (action === "replay") {
      const name = url.searchParams.get("skill") || "";
      const skill = _grokMemory.skills.find(s => s.name === name);
      if (!skill) { sendJson(res, { error: "Skill not found", available: _grokMemory.skills.map(s => s.name) }, 404); return; }
      sendJson(res, skill);
      return;
    }

    if (action === "recall") {
      const query = (url.searchParams.get("query") || "").toLowerCase();
      const matches = _grokMemory.skills.filter(s => s.name.toLowerCase().includes(query) || s.domain.toLowerCase().includes(query) || JSON.stringify(s.steps).toLowerCase().includes(query));
      sendJson(res, { query, matches: matches.map(s => ({ name: s.name, domain: s.domain, stepsCount: s.steps.length })) });
      return;
    }

    sendJson(res, { actions: ["crystallize (POST)", "skills", "replay?skill=NAME", "recall?query=TEXT"], totalSkills: _grokMemory.skills.length });
    return;
  }

  if (pathname === "/api/screen-info") {
    _log(pathname, "GET", {}, "forwarding", 0);
    const result = await relayToDesktop([{ type: "run_command", project: "__system__", command: 'powershell -Command "[System.Windows.Forms.Screen]::PrimaryScreen | Select-Object -ExpandProperty Bounds | ConvertTo-Json"' }], 10000);
    _log(pathname, "GET", {}, result.error ? "error" : "ok", Date.now() - startTime);
    sendJson(res, { physical: { w: 3840, h: 2160 }, raw: result });
    return;
  }

  if (pathname === "/api/diag") {
    sendJson(res, {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      clients: Array.from(bridgeClients.entries()).map(([k, c]) => ({ project: c.project || k, alive: c.alive, lastPing: c.lastPing, previewPort: c.previewPort })),
      activityCount: activityLog.length,
      screenshot: { hasFrame: !!cachedScreenshot.buffer, age: cachedScreenshot.ts > 0 ? Date.now() - cachedScreenshot.ts : null, catboxUrl: cachedScreenshot.catboxUrl },
      pendingRequests: { relay: pendingRelayRequests.size, sandbox: pendingSandboxRelayRequests.size, console: pendingConsoleLogRequests.size },
      memorySkills: _grokMemory.skills.length,
    });
    return;
  }

  if (pathname === "/api/commands") {
    const COMMANDS = ["list_tree","read_file","read_multiple_files","write_file","write_file_chunk","create_file","delete_file","bulk_delete","move_file","copy_file","copy_folder","rename_file","grep","search_files","search_replace","apply_patch","bulk_write","run_command","install_deps","add_dependency","remove_dependency","type_check","lint_and_fix","format_files","get_build_metrics","restart_dev_server","list_open_ports","git_status","git_add","git_commit","git_diff","git_log","git_branch","git_checkout","git_stash","git_init","git_push","git_pull","git_merge","git_stash_pop","git_reset","git_revert","git_tag","detect_structure","start_process","kill_process","list_processes","build_project","run_tests","archive_project","export_project","set_env_var","get_env_vars","rollback_last_change","project_analyze","tailwind_audit","find_usages","component_tree","extract_theme","extract_colors","capture_preview","get_preview_url","generate_component","generate_page","refactor_file","validate_change","profile_performance","create_folder","delete_folder","move_folder","rename_folder","list_tree_filtered","dead_code_detection","dependency_graph","symbol_search","grep_advanced","extract_imports","run_command_advanced","build_with_flags","clean_build_cache","start_process_named","monitor_process","get_process_logs","stop_all_processes","switch_port","visual_diff","capture_component","record_video","get_dom_snapshot","get_console_errors","generate_test","generate_storybook","optimize_code","convert_to_typescript","add_feature","migrate_framework","react_profiler","memory_leak_detection","console_error_analysis","runtime_error_trace","bundle_analyzer","network_monitor","accessibility_audit","security_scan","set_tailwind_config","set_next_config","update_package_json","manage_scripts","switch_package_manager","deploy_preview","export_project_zip","import_project","super_command","screenshot_preview","browser_interact"];
    sendJson(res, {
      total: COMMANDS.length,
      commands: COMMANDS,
      usage: "POST /api/sandbox/execute with {actions: [{type: '<command>', project: 'name', ...params}]}",
      grokProxy: { endpoint: "GET /api/grok-proxy", params: { payload: "base64(JSON) or base64(gzip(JSON))" } },
    });
    return;
  }

  if (pathname === "/api/grok") {
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocol}://${host}`;
    sendJson(res, {
      service: "Lamby Bridge Relay",
      desktopConnected: bridgeClients.size > 0,
      stream: { png: `${base}/stream`, viewer: `${base}/api/desktop-stream`, catbox: cachedScreenshot.catboxUrl, status: `${base}/api/stream-status` },
      dashboard: `${base}/dashboard`,
      endpoints: {
        grokOrient: `${base}/api/grok-orient?project=NAME&goal=TASK_DESC`,
        grokGoal: `${base}/api/grok-goal?goal=TEXT&steps=S1|S2|S3`,
        grokRead: `${base}/api/grok-read?project=NAME&path=FILE`,
        grokWrite: `${base}/api/grok-write?project=NAME&path=FILE&search=OLD&replace=NEW`,
        grokEdit: `${base}/api/grok-edit?project=NAME&path=FILE&search=OLD&replace=NEW`,
        grokCreate: `${base}/api/grok-create?project=NAME&path=FILE&content=DATA`,
        grokCreateChunk: `${base}/api/grok-create-chunk?project=NAME&path=FILE&content=CHUNK&chunk=0&total=1`,
        grokPush: `${base}/api/grok-push?project=NAME&path=FILE&content=DATA`,
        grokDelete: `${base}/api/grok-delete?project=NAME&path=FILE`,
        remoteUpdate: `${base}/api/remote-update?file=PATH&content=DATA`,
        grokTree: `${base}/api/grok-tree?project=NAME`,
        grokSearch: `${base}/api/grok-search?project=NAME&q=QUERY`,
        grokRun: `${base}/api/grok-run?project=NAME&cmd=COMMAND`,
        grokDo: `${base}/api/grok-do?chain=STEP1|STEP2|STEP3`,
        grokGit: `${base}/api/grok-git?project=NAME&action=status`,
        grokProcess: `${base}/api/grok-process?project=NAME&action=list`,
        grokMemory: `${base}/api/grok-memory?action=skills`,
        grokQuality: `${base}/api/grok-quality?project=NAME`,
        grokDeps: `${base}/api/grok-deps?project=NAME`,
        grokSuper: `${base}/api/grok-super?project=NAME&describe=TASK`,
        grokClickAt: `${base}/api/grok-click-at?project=NAME&x=X&y=Y`,
        grokSendKeys: `${base}/api/grok-send-keys?project=NAME&keys=COMBO`,
        grokPaste: `${base}/api/grok-paste?project=NAME&text=TEXT`,
        grokLaunchExe: `${base}/api/grok-launch-exe?project=NAME&path=EXE`,
        grokListWindows: `${base}/api/grok-list-windows?project=NAME`,
        grokBringToFront: `${base}/api/grok-bring-to-front?project=NAME&title=WINDOW`,
        grokWindowInfo: `${base}/api/grok-get-window-info?project=NAME&title=WINDOW`,
        grokScreenshotWindow: `${base}/api/grok-screenshot-window?project=NAME&title=WINDOW`,
        grokInteract: `${base}/api/grok-interact?project=NAME&action=ACTION&selector=CSS`,
        grokCdp: `${base}/api/grok-cdp?project=NAME&action=snapshot`,
        grokChangeset: `${base}/api/grok-changeset?project=NAME&action=apply&ops=BASE64_OPS`,
        grokGraph: `${base}/api/grok-graph?project=NAME&action=deps`,
        grokMacroStatus: `${base}/api/grok-macro/project-status?project=NAME`,
        grokMacroContext: `${base}/api/grok-macro/read-context?project=NAME&path=FILE`,
        grokInjectPrompt: `${base}/api/grok-inject-prompt?project=NAME&prompt=TEXT`,
        screenshot: `${base}/api/screenshot/PROJECT_NAME`,
        desktopFrame: `${base}/api/desktop-frame`,
        desktopStream: `${base}/api/desktop-stream`,
        stream: `${base}/stream`,
        streamStatus: `${base}/api/stream-status`,
        screenshotLatest: `${base}/api/screenshot-latest.png`,
        lastScreenshot: `${base}/api/grok-last-screenshot?format=image`,
        screenInfo: `${base}/api/screen-info`,
        snapshot: `${base}/api/snapshot/PROJECT_NAME`,
        consoleLogs: `${base}/api/console-logs?project=NAME`,
        execute: `${base}/api/sandbox/execute?actions=JSON_ARRAY`,
        grokProxy: `${base}/api/grok-proxy?payload=BASE64_JSON`,
        auditLog: `${base}/api/sandbox/audit-log`,
        registerTunnel: `${base}/api/register-tunnel?url=URL&id=TUNNEL_ID`,
        tunnels: `${base}/api/tunnels`,
        failoverStatus: `${base}/api/failover-status`,
        bridgeStatus: `${base}/api/bridge-status`,
        connectivityTest: `${base}/api/connectivity-test`,
        health: `${base}/health`,
        snapshotKey: `${base}/api/snapshot-key`,
        runTests: `${base}/api/run-tests?project=NAME`,
        diag: `${base}/api/diag`,
        activity: `${base}/api/activity?limit=100`,
        commands: `${base}/api/commands`,
        dashboard: `${base}/dashboard`,
        grokReference: `${base}/api/grok-reference`,
        grokDocs: `${base}/api/grok-docs`,
        grokChatPrompt: `${base}/api/grok-chat-prompt`,
      },
      failover: {
        mode: getAllAliveClients().length > 1 ? "multi-client" : getAllAliveClients().length === 1 ? "single" : "none",
        poolSize: getAllAliveClients().length,
        maxRetries: MAX_RETRIES,
        timeout: FAILOVER_TIMEOUT,
        tunnels: Array.from(tunnelRegistry.entries()).map(([k, v]) => ({ id: k, url: v.url })),
      },
    });
    return;
  }

  if (pathname === "/api/grok-docs") {
    const docsPath = path.join(__dirname, "..", "GROK_BRIDGE_MAP.md");
    const altPath = path.join(__dirname, "GROK-BRIDGE-DOCS.md");
    const p = fs.existsSync(docsPath) ? docsPath : fs.existsSync(altPath) ? altPath : null;
    if (!p) { sendJson(res, { error: "Docs file not found" }, 404); return; }
    const docs = fs.readFileSync(p, "utf-8");
    res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8", "Access-Control-Allow-Origin": "*" });
    res.end(docs);
    return;
  }

  if (pathname === "/api/grok-reference") {
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocol}://${host}`;
    const grokMapPath = path.join(__dirname, "..", "GROK_ENDPOINT_MAP.txt");
    const mapPath = path.join(__dirname, "..", "ENDPOINT_MAP.txt");
    const fallbackPath = path.join(__dirname, "..", "GROK_BRIDGE_MAP.md");
    const filePath = fs.existsSync(grokMapPath) ? grokMapPath : fs.existsSync(mapPath) ? mapPath : fs.existsSync(fallbackPath) ? fallbackPath : null;
    if (!filePath) { sendJson(res, { error: "Reference not found" }, 404); return; }
    let content = fs.readFileSync(filePath, "utf-8");
    content = content.replace(/\{\{BASE\}\}/g, base);
    content = content.replace(/\{BRIDGE\}/g, base);
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" });
    res.end(content);
    return;
  }

  if (pathname === "/api/grok-chat-prompt") {
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocol}://${host}`;
    const aliveClients = getAllAliveClients();
    const prompt = `You have FULL desktop control via the Lamby Bridge Relay at ${base}

ALL endpoints are GET requests unless noted. Browse any URL below.

DISCOVERY: ${base}/api/grok — lists all endpoints
STREAM: ${base}/stream — live desktop screenshot (PNG, refreshes every 2s)
CATBOX: ${cachedScreenshot.catboxUrl || "uploading..."} — public screenshot URL

KEY ENDPOINTS:
- ${base}/api/grok-do?chain=STEP1|STEP2|STEP3 — chain commands
- ${base}/api/grok-run?project=__system__&cmd=COMMAND — run shell commands
- ${base}/api/grok-read?project=NAME&path=FILE — read files
- ${base}/api/grok-write?project=NAME&path=FILE&search=OLD&replace=NEW — edit files
- ${base}/api/grok-create?project=NAME&path=FILE&content=DATA — create files
- ${base}/api/grok-tree?project=NAME — list file tree
- ${base}/api/desktop-frame — live desktop screenshot (JPEG)
- ${base}/api/grok-click-at?project=__system__&x=X&y=Y — click at coordinates
- ${base}/api/grok-send-keys?project=__system__&keys=COMBO — send keystrokes
- ${base}/api/grok-memory?action=skills — recall crystallized knowledge

FULL ENDPOINT MAP (read this first): ${base}/api/grok-reference
DETAILED DOCS: ${base}/api/grok-docs

FAILOVER:
- ${base}/api/failover-status — check pool health and routing
- ${base}/api/tunnels — list all registered tunnel URLs
- ${base}/api/register-tunnel (POST) — register a new tunnel: {"url":"https://...","id":"tunnel-2"}
- Pool: ${aliveClients.length} alive clients, failover tries up to ${MAX_RETRIES} clients per request
- If one client overloads/times out, request automatically retries on next healthiest client

RULES:
1. All coordinates are PHYSICAL (3840x2160)
2. Always verify visually after actions
3. Crystallize working knowledge via /api/grok-memory
4. Use /stream to check live desktop state anytime
5. If a request fails, the relay auto-retries on backup clients — you will not see disconnection`;
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" });
    res.end(prompt);
    return;
  }

  if (pathname === "/api/run-tests") {
    if (runTestsInFlight) { sendJson(res, { error: "Test suite already running" }, 429); return; }
    const testProject = url.searchParams.get("project") || "groks-app";
    const { execFile } = require("child_process");
    const testScript = path.join(__dirname, "..", "scripts", "bridge-test.cjs");
    if (!fs.existsSync(testScript)) { sendJson(res, { error: "Test script not found" }, 404); return; }
    const selfDomain = process.env.REPLIT_DEV_DOMAIN || `localhost:${PORT}`;
    runTestsInFlight = true;
    _log(pathname, "GET", { project: testProject }, "running", 0, "Test suite started");
    execFile(process.execPath, [testScript], {
      env: { ...process.env, BRIDGE_RELAY_DOMAIN: selfDomain, BRIDGE_TEST_PROJECT: testProject },
      timeout: 120000,
      maxBuffer: 5 * 1024 * 1024,
    }, (err, stdout, stderr) => {
      runTestsInFlight = false;
      if (err && !stdout) { sendJson(res, { error: `Test runner failed: ${err.message}`, stderr: stderr.slice(-2000) }, 500); return; }
      try {
        const report = JSON.parse(stdout);
        const hasFailures = report.tiers && Object.values(report.tiers).some(t => t.failed > 0);
        _log(pathname, "GET", { project: testProject }, hasFailures ? "failures" : "ok", Date.now() - startTime, "Tests complete");
        sendJson(res, report, hasFailures ? 207 : 200);
      } catch { sendJson(res, { error: "Failed to parse test output", stdout: stdout.slice(-2000) }, 500); }
    });
    return;
  }

  if (pathname === "/api/connectivity-test") {
    sendJson(res, {
      relay: "ok",
      desktopConnected: bridgeClients.size > 0,
      clients: Array.from(bridgeClients.entries()).map(([k, c]) => ({ project: c.project || k, alive: c.alive })),
      screenshot: { available: !!cachedScreenshot.buffer, age: cachedScreenshot.ts > 0 ? Date.now() - cachedScreenshot.ts : null },
    });
    return;
  }

  if (pathname === "/api/status") {
    sendJson(res, {
      status: "ok",
      service: "Lamby Bridge Relay",
      bridge: bridgeClients.size > 0 ? "connected" : "waiting-for-desktop",
      connectedClients: bridgeClients.size,
      uptime: process.uptime(),
      screenshot: { catboxUrl: cachedScreenshot.catboxUrl, age: cachedScreenshot.ts > 0 ? Date.now() - cachedScreenshot.ts : null },
    });
    return;
  }

  _log(pathname, req.method, {}, "404", Date.now() - startTime, "Not found");
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found", hint: "GET /api/grok for endpoint discovery, GET / for dashboard" }));
});

server.on("upgrade", (req, socket, head) => {
  const reqUrl = new URL(req.url || "", "http://localhost");
  if (req.url && req.url.startsWith("/bridge-ws")) {
    const project = reqUrl.searchParams.get("project") || reqUrl.searchParams.get("key") || "default";
    const previewPort = reqUrl.searchParams.get("previewPort") || null;
    bridgeWss.handleUpgrade(req, socket, head, (ws) => {
      bridgeWss.emit("connection", ws, project, previewPort);
    });
    return;
  }
  socket.destroy();
});

setInterval(() => {
  const now = Date.now();
  for (const [key, client] of bridgeClients) {
    if (now - client.lastPing > 120000) {
      console.log(`[Bridge] Pruning stale client (project: ${key})`);
      _log("/bridge-ws", "WS", { project: key }, "pruned", 0, "Stale client removed");
      try { client.ws.close(); } catch {}
      bridgeClients.delete(key);
    }
  }
}, 30000);

process.on("uncaughtException", (err) => { console.error(`[Bridge] Uncaught exception: ${err.message}`); console.error(err.stack); });
process.on("unhandledRejection", (reason) => { console.error(`[Bridge] Unhandled rejection: ${reason}`); });

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n[Lamby Bridge Relay] v2.1 — FAILOVER ENABLED`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Dashboard: http://localhost:${PORT}/`);
  console.log(`  Stream: http://localhost:${PORT}/stream`);
  console.log(`  Desktop Stream Viewer: http://localhost:${PORT}/api/desktop-stream`);
  console.log(`  Grok Discovery: http://localhost:${PORT}/api/grok`);
  console.log(`  Activity Log: http://localhost:${PORT}/api/activity`);
  console.log(`  Failover Status: http://localhost:${PORT}/api/failover-status`);
  console.log(`  Tunnel Registry: http://localhost:${PORT}/api/tunnels`);
  console.log(`  Screenshot auto-refresh: every ${SCREENSHOT_INTERVAL / 1000}s`);
  console.log(`  Catbox auto-upload: every ${CATBOX_INTERVAL / 1000}s`);
  console.log(`  Failover: timeout=${FAILOVER_TIMEOUT/1000}s, max_retries=${MAX_RETRIES}`);
  console.log(`  Multi-client pool: requests auto-failover to next healthiest client`);
  console.log(`  All grok-* endpoints forwarded to desktop client`);
  console.log(`  No authentication — relay URL is the secret\n`);
});
