const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = parseInt(process.env.PORT || "5000", 10);
const DIST_DIR = path.resolve(__dirname, "..", "dist");
const snapshotKey = "92781fb690e47d110da1458cbe03ac9a";

function isValidKey(providedKey) {
  return providedKey === snapshotKey;
}

const bridgeClients = new Map();
const pendingRelayRequests = new Map();
const pendingSandboxRelayRequests = new Map();
const pendingConsoleLogRequests = new Map();
const sandboxAuditLog = [];

const { createConnector } = require("./bridge-connector.cjs");
const lambyConfigPath = path.resolve(__dirname, "..", ".lamby-keys.json");
let prodBridgeKey;
try {
  if (fs.existsSync(lambyConfigPath)) {
    const saved = JSON.parse(fs.readFileSync(lambyConfigPath, "utf-8"));
    prodBridgeKey = saved.bridgeRelayKey && saved.bridgeRelayKey.length >= 16 ? saved.bridgeRelayKey : crypto.randomBytes(16).toString("hex");
  } else {
    prodBridgeKey = crypto.randomBytes(16).toString("hex");
  }
} catch {
  prodBridgeKey = crypto.randomBytes(16).toString("hex");
}
const prodConnector = createConnector({
  relayUrl: process.env.BRIDGE_RELAY_URL || "wss://bridge-relay.replit.app",
  bridgeKey: prodBridgeKey,
  snapshotKey,
  projectName: "",
  projectDir: path.resolve(__dirname, ".."),
  previewPort: String(PORT),
});
// Do NOT auto-connect: the server already IS the relay via bridge-relay.cjs.
// Auto-connecting as a "desktop" client fights with the user's real desktop connector.
// Only connect if explicitly toggled via /api/bridge-connector-switch.

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

function getMime(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function sendJson(res, obj, status) {
  res.writeHead(status || 200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function getKey(req, url) {
  return url.searchParams.get("key") || (req.headers.authorization || "").replace("Bearer ", "");
}

function findBridgeClient(key) {
  if (key === snapshotKey) {
    for (const [, client] of bridgeClients) {
      if (client.alive) return client;
    }
  }
  return null;
}

function serveStatic(req, res) {
  let filePath = path.join(DIST_DIR, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  filePath = path.normalize(filePath);
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const headers = { "Content-Type": getMime(filePath) };
    if (ext !== ".html") {
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  } else {
    const indexPath = path.join(DIST_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  }
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

function handleWsUpgrade(req, socket, bridgeKey, clientSnapshotKey) {
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

  console.log(`[Bridge Relay] Desktop client connected (key: ${bridgeKey.substring(0, 8)}...)`);

  const client = { socket, snapshotKey: clientSnapshotKey, lastPing: Date.now(), alive: true };
  bridgeClients.set(bridgeKey, client);

  client.send = (data) => {
    try { socket.write(wsEncodeFrame(data)); } catch {}
  };

  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length > 0) {
      const { data, opcode, bytesConsumed } = wsDecodeFrame(buffer);
      if (data === null) break;
      buffer = buffer.slice(bytesConsumed);

      if (opcode === 0x8) {
        socket.end();
        return;
      }
      if (opcode === 0x9) {
        const pong = Buffer.alloc(2);
        pong[0] = 0x8a;
        pong[1] = 0;
        try { socket.write(pong); } catch {}
        continue;
      }

      try {
        const msg = JSON.parse(data);
        if (msg.type === "snapshot-response" && msg.requestId) {
          const pending = pendingRelayRequests.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingRelayRequests.delete(msg.requestId);
            pending.resolve(msg.snapshot || "Error: Empty snapshot response from desktop.");
          }
        } else if (msg.type === "sandbox-execute-response" && msg.requestId) {
          const pending = pendingSandboxRelayRequests.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingSandboxRelayRequests.delete(msg.requestId);
            pending.resolve(JSON.stringify(msg.result || { error: "Empty sandbox response from desktop." }));
          }
        } else if (msg.type === "console-logs-response" && msg.requestId) {
          const pending = pendingConsoleLogRequests.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingConsoleLogRequests.delete(msg.requestId);
            pending.resolve(JSON.stringify(msg.logs || {}));
          }
        } else if (msg.type === "ping") {
          client.lastPing = Date.now();
          client.send(JSON.stringify({ type: "pong" }));
        }
      } catch {}
    }
  });

  socket.on("close", () => {
    console.log(`[Bridge Relay] Desktop client disconnected (key: ${bridgeKey.substring(0, 8)}...)`);
    client.alive = false;
    bridgeClients.delete(bridgeKey);
  });

  socket.on("error", () => {
    client.alive = false;
    bridgeClients.delete(bridgeKey);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (pathname === "/api/snapshot-key") {
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${protocol}://${host}`;
    const requestedProject = url.searchParams.get("project") || "";
    sendJson(res, {
      key: snapshotKey,
      globalKey: snapshotKey,
      project: requestedProject || null,
      baseUrl,
      exampleUrl: `${baseUrl}/api/snapshot/${requestedProject || "PROJECT_NAME"}?key=${snapshotKey}`,
      commandEndpoint: `${baseUrl}/api/sandbox/execute?key=${snapshotKey}`,
      commandProtocol: "POST JSON {actions: [{type, project, ...}]}. Relay-only in production — requests forwarded to connected desktop client via bridge.",
    });
    return;
  }

  if (pathname === "/api/bridge-status") {
    const providedKey = getKey(req, url);
    if (!isValidKey(providedKey) && !findBridgeClient(providedKey)) {
      sendJson(res, { error: "Invalid key" }, 403);
      return;
    }
    const clients = Array.from(bridgeClients.entries()).map(([key, c]) => ({
      key: key.substring(0, 8) + "...",
      snapshotKey: c.snapshotKey.substring(0, 8) + "...",
      connected: c.alive,
      lastPing: c.lastPing,
    }));
    const connectorStatus = prodConnector ? prodConnector.getStatus() : null;
    sendJson(res, {
      connectedClients: clients.length,
      clients,
      connector: connectorStatus ? { status: connectorStatus.status, relayUrl: connectorStatus.relayUrl, mode: connectorStatus.mode } : null,
      bridgeKey: connectorStatus ? connectorStatus.bridgeKey : undefined,
      key: snapshotKey,
      mode: connectorStatus ? connectorStatus.mode : undefined,
    });
    return;
  }

  if (pathname === "/api/bridge-relay-status") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const connectorStatus = prodConnector ? prodConnector.getStatus() : { status: "disconnected", relayUrl: "", snapshotKey, mode: "production" };
    sendJson(res, {
      status: connectorStatus.status,
      relayUrl: connectorStatus.relayUrl,
      snapshotKey: connectorStatus.snapshotKey || snapshotKey,
      mode: connectorStatus.mode,
    });
    return;
  }

  if (pathname === "/api/bridge-connector-switch") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const body = JSON.parse(await readBody(req));
      const relayUrl = body.relayUrl;
      const providedKey = body.key;
      if (!relayUrl) { sendJson(res, { error: "relayUrl required" }, 400); return; }
      if (!isValidKey(providedKey)) { sendJson(res, { error: "Invalid key" }, 403); return; }
      const allowedUrls = new Set([
        "wss://bridge-relay.replit.app",
        `wss://${process.env.REPLIT_DEV_DOMAIN || "localhost:" + PORT}`,
      ]);
      if (!allowedUrls.has(relayUrl)) { sendJson(res, { error: "Relay URL not in allowlist" }, 403); return; }
      if (prodConnector) {
        prodConnector.reconnect(relayUrl);
        sendJson(res, { success: true, relayUrl });
      } else {
        sendJson(res, { error: "Connector not initialized" }, 500);
      }
    } catch (err) {
      sendJson(res, { error: err.message }, 400);
    }
    return;
  }

  if (pathname.startsWith("/api/snapshot/")) {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const pathParts = pathname.replace("/api/snapshot/", "").split("/").filter(Boolean);
    const projectName = pathParts[0] || "";
    const providedKey = getKey(req, url);

    if (!isValidKey(providedKey) && !findBridgeClient(providedKey)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Lamby Snapshot API\n\nAccess denied — invalid or missing key.\nProvide ?key=YOUR_KEY or Authorization: Bearer YOUR_KEY");
      return;
    }

    const matchedClient = findBridgeClient(providedKey);
    if (matchedClient) {
      const requestId = crypto.randomUUID();
      const relayPromise = new Promise((resolve) => {
        const timer = setTimeout(() => {
          pendingRelayRequests.delete(requestId);
          resolve("Error: Relay timeout — desktop app did not respond within 30 seconds.");
        }, 30000);
        pendingRelayRequests.set(requestId, { resolve, timer });
      });
      try {
        matchedClient.send(JSON.stringify({ type: "snapshot-request", requestId, projectName }));
      } catch {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Error: Could not reach desktop app through relay bridge.");
        return;
      }
      const snapshot = await relayPromise;
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(snapshot);
      return;
    }

    res.writeHead(503, { "Content-Type": "text/plain" });
    res.end("No desktop client connected. The production server is relay-only — connect your desktop app via the Bridge to access project snapshots.");
    return;
  }

  if (pathname === "/api/sandbox/execute") {
    if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }
    try {
      const providedKey = getKey(req, url);
      const execProject = url.searchParams.get("project") || "";
      if (!isValidKey(providedKey) && !findBridgeClient(providedKey)) {
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

      const matchedClient = findBridgeClient(providedKey);
      if (!matchedClient) {
        sendJson(res, { error: "No desktop client connected. The production server is relay-only — connect your desktop app via the Bridge." }, 503);
        return;
      }

      const requestId = crypto.randomUUID();
      const relayPromise = new Promise((resolve) => {
        const timer = setTimeout(() => {
          pendingSandboxRelayRequests.delete(requestId);
          resolve(JSON.stringify({ error: "Relay timeout — desktop app did not respond within 60 seconds." }));
        }, 60000);
        pendingSandboxRelayRequests.set(requestId, { resolve, timer });
      });
      try {
        matchedClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions }));
      } catch {
        sendJson(res, { error: "Could not reach desktop app through relay bridge." }, 502);
        return;
      }

      for (const action of actions) {
        sandboxAuditLog.push({ ts: Date.now(), action: action.type, project: action.project || "", status: "relayed", detail: "Forwarded to desktop via bridge" });
      }
      if (sandboxAuditLog.length > 1000) sandboxAuditLog.splice(0, sandboxAuditLog.length - 500);

      const result = await relayPromise;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(result);
    } catch (err) {
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }

  if (pathname === "/api/sandbox/audit-log") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const providedKey = getKey(req, url);
    const auditProject = url.searchParams.get("project") || "";
    if (!isValidKey(providedKey) && !findBridgeClient(providedKey)) {
      sendJson(res, { error: "Invalid key" }, 403);
      return;
    }
    sendJson(res, { entries: sandboxAuditLog.slice(-100) });
    return;
  }

  if (pathname === "/api/console-logs") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const providedKey = getKey(req, url);
    const matchedClient = findBridgeClient(providedKey);
    if (!matchedClient) {
      sendJson(res, { error: "No desktop client connected" }, 503);
      return;
    }
    const requestId = crypto.randomUUID();
    const projectName = url.searchParams.get("project") || "";
    const relayPromise = new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingConsoleLogRequests.delete(requestId);
        resolve(JSON.stringify({ error: "Relay timeout" }));
      }, 30000);
      pendingConsoleLogRequests.set(requestId, { resolve, timer });
    });
    try {
      matchedClient.send(JSON.stringify({ type: "console-logs-request", requestId, project: projectName }));
    } catch {
      sendJson(res, { error: "Could not reach desktop app" }, 502);
      return;
    }
    const result = await relayPromise;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(result);
    return;
  }

  const screenshotMatch = pathname.match(/^\/api\/screenshot\/([^/]+)\/([^/]+)$/);
  if (screenshotMatch) {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const providedKey = screenshotMatch[1];
    const project = decodeURIComponent(screenshotMatch[2]);
    const matchedClient = findBridgeClient(providedKey);
    if (!matchedClient && providedKey !== snapshotKey) { sendJson(res, { error: "Invalid key" }, 403); return; }
    if (!matchedClient) { sendJson(res, { error: "No desktop client connected." }, 503); return; }
    const selector = url.searchParams.get("selector") || undefined;
    const fullPage = url.searchParams.get("fullPage") === "true";
    const waitMs = parseInt(url.searchParams.get("waitMs") || "2000");
    const action = { type: "screenshot_preview", project, selector, fullPage, waitMs };
    const requestId = crypto.randomUUID();
    const relayPromise = new Promise((resolve) => {
      const timer = setTimeout(() => { pendingSandboxRelayRequests.delete(requestId); resolve(JSON.stringify({ error: "Relay timeout — desktop app did not respond within 60 seconds." })); }, 60000);
      pendingSandboxRelayRequests.set(requestId, { resolve, timer });
    });
    try { matchedClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions: [action] })); } catch { sendJson(res, { error: "Could not reach desktop app through relay bridge." }, 502); return; }
    sandboxAuditLog.push({ ts: Date.now(), action: "screenshot_preview", project, status: "relayed-screenshot" });
    if (sandboxAuditLog.length > 1000) sandboxAuditLog.splice(0, sandboxAuditLog.length - 500);
    const result = await relayPromise;
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(result);
    return;
  }

  if (pathname === "/api/grok-proxy") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const providedKey = getKey(req, url);
    const matchedClient = findBridgeClient(providedKey);
    if (!matchedClient && providedKey !== snapshotKey) { sendJson(res, { error: "Invalid key" }, 403); return; }
    if (!matchedClient) { sendJson(res, { error: "No desktop client connected." }, 503); return; }

    const payloadB64 = url.searchParams.get("payload") || "";
    if (!payloadB64) { sendJson(res, { error: "payload parameter required (base64 JSON)" }, 400); return; }
    let actions;
    try {
      let decoded;
      try { const buf = Buffer.from(payloadB64, "base64"); const zlib = require("zlib"); decoded = zlib.gunzipSync(buf).toString("utf-8"); } catch { decoded = Buffer.from(payloadB64, "base64").toString("utf-8"); }
      const parsed = JSON.parse(decoded);
      actions = parsed.actions || parsed;
      if (!Array.isArray(actions)) throw new Error("actions must be array");
    } catch (e) { sendJson(res, { error: "Invalid payload: " + e.message }, 400); return; }
    if (actions.length > 50) { sendJson(res, { error: "Max 50 actions per request" }, 400); return; }

    const project = url.searchParams.get("project") || "";
    if (project) actions = actions.map(a => ({ ...a, project: a.project || project }));

    const requestId = crypto.randomUUID();
    const relayPromise = new Promise((resolve) => {
      const timer = setTimeout(() => { pendingSandboxRelayRequests.delete(requestId); resolve(JSON.stringify({ error: "Relay timeout — desktop app did not respond within 60 seconds." })); }, 60000);
      pendingSandboxRelayRequests.set(requestId, { resolve, timer });
    });
    try { matchedClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions })); } catch { sendJson(res, { error: "Could not reach desktop app through relay bridge." }, 502); return; }
    for (const action of actions) { sandboxAuditLog.push({ ts: Date.now(), action: action.type, project: action.project || "", status: "relayed-proxy" }); }
    if (sandboxAuditLog.length > 1000) sandboxAuditLog.splice(0, sandboxAuditLog.length - 500);
    const result = await relayPromise;
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(result);
    return;
  }

  if (pathname === "/api/grok-edit") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const providedKey = getKey(req, url);
    const matchedClient = findBridgeClient(providedKey);
    if (!matchedClient && providedKey !== snapshotKey) { sendJson(res, { error: "Invalid key" }, 403); return; }
    if (!matchedClient) { sendJson(res, { error: "No desktop client connected." }, 503); return; }

    const project = url.searchParams.get("project") || "";
    const filePath = url.searchParams.get("path") || "";
    const searchB64 = url.searchParams.get("searchB64") || "";
    const replaceB64 = url.searchParams.get("replaceB64") || "";
    const search = searchB64 ? Buffer.from(searchB64, "base64").toString("utf-8") : (url.searchParams.get("search") || "");
    const replace = replaceB64 ? Buffer.from(replaceB64, "base64").toString("utf-8") : (url.searchParams.get("replace") || "");
    const replaceAll = url.searchParams.get("replaceAll") === "true";

    if (!filePath) { sendJson(res, { error: "path parameter required" }, 400); return; }
    if (!search) { sendJson(res, { error: "search parameter required" }, 400); return; }

    const actions = [{ type: "search_replace", project, path: filePath, search, replace, replaceAll }];
    const requestId = crypto.randomUUID();
    const relayPromise = new Promise((resolve) => {
      const timer = setTimeout(() => { pendingSandboxRelayRequests.delete(requestId); resolve(JSON.stringify({ error: "Relay timeout — desktop app did not respond within 30 seconds." })); }, 30000);
      pendingSandboxRelayRequests.set(requestId, { resolve, timer });
    });
    try { matchedClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions })); } catch { sendJson(res, { error: "Could not reach desktop app through relay bridge." }, 502); return; }
    sandboxAuditLog.push({ ts: Date.now(), action: "search_replace", project, status: "relayed-edit" });
    if (sandboxAuditLog.length > 1000) sandboxAuditLog.splice(0, sandboxAuditLog.length - 500);
    const result = await relayPromise;
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(result);
    return;
  }

  if (pathname === "/api/grok-interact") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const providedKey = getKey(req, url);
    const matchedClient = findBridgeClient(providedKey);
    if (!matchedClient && providedKey !== snapshotKey) { sendJson(res, { error: "Invalid key" }, 403); return; }
    if (!matchedClient) { sendJson(res, { error: "No desktop client connected." }, 503); return; }

    const project = url.searchParams.get("project") || "";
    const action = url.searchParams.get("action") || "";
    if (!project || !action) { sendJson(res, { error: "Required params: project, action" }, 400); return; }

    const interactAction = { type: "browser_interact", project, action };
    if (url.searchParams.get("selector")) interactAction.selector = url.searchParams.get("selector");
    if (url.searchParams.get("text")) interactAction.value = url.searchParams.get("text");
    if (url.searchParams.get("value")) interactAction.value = url.searchParams.get("value");
    if (url.searchParams.get("x")) interactAction.x = parseInt(url.searchParams.get("x"));
    if (url.searchParams.get("y")) interactAction.y = parseInt(url.searchParams.get("y"));
    if (url.searchParams.get("code")) interactAction.script = url.searchParams.get("code");
    if (url.searchParams.get("script")) interactAction.script = url.searchParams.get("script");
    if (url.searchParams.get("functionName")) interactAction.functionName = url.searchParams.get("functionName");
    if (url.searchParams.get("args")) try { interactAction.args = JSON.parse(url.searchParams.get("args")); } catch {}
    if (url.searchParams.get("screenshot") === "true") interactAction.screenshot = true;
    if (url.searchParams.get("waitAfter")) interactAction.waitAfter = parseInt(url.searchParams.get("waitAfter"));
    if (url.searchParams.get("timeout")) interactAction.timeout = parseInt(url.searchParams.get("timeout"));

    const requestId = crypto.randomUUID();
    const relayPromise = new Promise((resolve) => {
      const timer = setTimeout(() => { pendingSandboxRelayRequests.delete(requestId); resolve(JSON.stringify({ error: "Relay timeout — desktop app did not respond within 30 seconds." })); }, 30000);
      pendingSandboxRelayRequests.set(requestId, { resolve, timer });
    });
    try { matchedClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions: [interactAction] })); } catch { sendJson(res, { error: "Could not reach desktop app through relay bridge." }, 502); return; }
    sandboxAuditLog.push({ ts: Date.now(), action: "browser_interact", project, status: "relayed-interact" });
    if (sandboxAuditLog.length > 1000) sandboxAuditLog.splice(0, sandboxAuditLog.length - 500);
    const result = await relayPromise;
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(result);
    return;
  }

  if (pathname === "/api/commands") {
    const COMMANDS = ["list_tree","read_file","read_multiple_files","write_file","write_file_chunk","create_file","delete_file","bulk_delete","move_file","copy_file","copy_folder","rename_file","grep","search_files","search_replace","apply_patch","bulk_write","run_command","install_deps","git_status","git_add","git_commit","git_diff","git_log","start_process","kill_process","list_processes","screenshot_preview","browser_interact"];
    sendJson(res, { total: COMMANDS.length, commands: COMMANDS });
    return;
  }

  if (pathname === "/api/grok") {
    sendJson(res, {
      service: "Lamby Bridge Relay — Grok Integration (Production)",
      endpoints: {
        snapshot: "/api/snapshot/:project?key=KEY",
        consoleLogs: "/api/console-logs?key=KEY&project=NAME",
        execute: "POST /api/sandbox/execute?key=KEY",
        grokProxy: "/api/grok-proxy?key=KEY&project=NAME&payload=BASE64_ACTIONS",
        grokEdit: "/api/grok-edit?key=KEY&project=NAME&path=FILE&search=OLD&replace=NEW&replaceAll=true",
        grokInteract: "/api/grok-interact?key=KEY&project=NAME&action=ACTION&selector=CSS",
        screenshot: "/api/screenshot/:key/:project?fullPage=true&waitMs=8000",
        commands: "/api/commands",
      },
    });
    return;
  }

  if (pathname === "/health" || pathname === "/healthz") {
    sendJson(res, { status: "ok", bridge: bridgeClients.size > 0 ? "connected" : "no-desktop", uptime: process.uptime() });
    return;
  }

  serveStatic(req, res);
});

server.on("upgrade", (req, socket, head) => {
  const reqUrl = new URL(req.url || "", "http://localhost");
  if (req.url && req.url.startsWith("/bridge-ws")) {
    const bridgeKey = reqUrl.searchParams.get("key") || "";
    const clientSnapshotKey = reqUrl.searchParams.get("snapshotKey") || "";
    if (!bridgeKey || bridgeKey.length < 8) {
      socket.destroy();
      return;
    }
    if (clientSnapshotKey !== snapshotKey && clientSnapshotKey.length < 16) {
      console.log(`[Bridge Relay] Rejected connection — snapshotKey too short`);
      socket.destroy();
      return;
    }
    handleWsUpgrade(req, socket, bridgeKey, clientSnapshotKey);
    return;
  }
  socket.destroy();
});

setInterval(() => {
  const now = Date.now();
  for (const [key, client] of bridgeClients) {
    if (now - client.lastPing > 120000) {
      console.log(`[Bridge Relay] Pruning stale client (key: ${key.substring(0, 8)}...)`);
      try { client.socket.destroy(); } catch {}
      bridgeClients.delete(key);
    }
  }
}, 30000);

process.on("uncaughtException", (err) => {
  console.error(`[Lamby Production] Uncaught exception: ${err.message}`);
  console.error(err.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error(`[Lamby Production] Unhandled rejection: ${reason}`);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Lamby Production] Server running on port ${PORT}`);
  console.log(`[Lamby Production] Snapshot key: ${snapshotKey}`);
  console.log(`[Lamby Production] Bridge relay ready at /bridge-ws`);
  console.log(`[Lamby Production] Serving static files from ${DIST_DIR}`);
});
