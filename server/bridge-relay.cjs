const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "3000", 10);
const snapshotKey = process.env.SNAPSHOT_KEY || crypto.randomBytes(16).toString("hex");

const bridgeClients = new Map();
const pendingRelayRequests = new Map();
const pendingSandboxRelayRequests = new Map();
const pendingConsoleLogRequests = new Map();
const sandboxAuditLog = [];

function sendJson(res, obj, status) {
  res.writeHead(status || 200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
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
  for (const [, client] of bridgeClients) {
    if (client.snapshotKey === key && client.alive) return client;
  }
  return null;
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

  console.log(`[Bridge] Desktop connected (key: ${bridgeKey.substring(0, 8)}...)`);

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

      if (opcode === 0x8) { socket.end(); return; }
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
            pending.resolve(msg.logs || { error: "Empty console logs response from desktop." });
          }
        } else if (msg.type === "ping") {
          client.lastPing = Date.now();
          client.send(JSON.stringify({ type: "pong" }));
        }
      } catch {}
    }
  });

  socket.on("close", () => {
    console.log(`[Bridge] Desktop disconnected (key: ${bridgeKey.substring(0, 8)}...)`);
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

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  if (pathname === "/" || pathname === "/health" || pathname === "/healthz") {
    sendJson(res, {
      status: "ok",
      service: "Lamby Bridge Relay",
      bridge: bridgeClients.size > 0 ? "connected" : "waiting-for-desktop",
      connectedClients: bridgeClients.size,
      uptime: process.uptime(),
    });
    return;
  }

  if (pathname === "/api/snapshot-key") {
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${protocol}://${host}`;
    sendJson(res, {
      key: snapshotKey,
      baseUrl,
      snapshotUrl: `${baseUrl}/api/snapshot/PROJECT_NAME?key=${snapshotKey}`,
      commandEndpoint: `${baseUrl}/api/sandbox/execute?key=${snapshotKey}`,
      bridgeWs: `wss://${host}/bridge-ws?key=YOUR_BRIDGE_KEY&snapshotKey=${snapshotKey}`,
      commandProtocol: "POST JSON {actions: [{type, project, ...}]}. All requests forwarded to connected desktop client via bridge.",
    });
    return;
  }

  if (pathname === "/api/bridge-status") {
    const clients = Array.from(bridgeClients.entries()).map(([key, c]) => ({
      key: key.substring(0, 8) + "...",
      connected: c.alive,
      lastPing: c.lastPing,
      snapshotKeyPrefix: c.snapshotKey ? c.snapshotKey.substring(0, 8) + "..." : "",
    }));
    sendJson(res, { connectedClients: clients.length, clients });
    return;
  }

  if (pathname.startsWith("/api/snapshot/")) {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const pathParts = pathname.replace("/api/snapshot/", "").split("/").filter(Boolean);
    const projectName = pathParts[0] || "";
    const providedKey = getKey(req, url);

    const matchedClient = findBridgeClient(providedKey);
    if (!matchedClient && providedKey !== snapshotKey) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Lamby Bridge Relay\n\nAccess denied — invalid or missing key.\nProvide ?key=YOUR_KEY or Authorization: Bearer YOUR_KEY");
      return;
    }
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
    res.end("No desktop client connected.\nStart your Lamby desktop app and connect it to this relay.");
    return;
  }

  if (pathname === "/api/console-logs") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const providedKey = getKey(req, url);
    const projectName = url.searchParams.get("project") || "";

    const matchedClient = findBridgeClient(providedKey);
    if (!matchedClient && providedKey !== snapshotKey) {
      sendJson(res, { error: "Invalid key" }, 403);
      return;
    }
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
      const providedKey = getKey(req, url);
      const matchedClient = findBridgeClient(providedKey);
      if (!matchedClient && providedKey !== snapshotKey) { sendJson(res, { error: "Invalid key" }, 403); return; }

      const body = JSON.parse(await readBody(req));
      const actions = body.actions;
      if (!Array.isArray(actions) || actions.length === 0) { sendJson(res, { error: "actions array required" }, 400); return; }
      if (actions.length > 50) { sendJson(res, { error: "Max 50 actions per request" }, 400); return; }
      if (!matchedClient) {
        sendJson(res, { error: "No desktop client connected. Start your Lamby desktop app and connect it to this relay." }, 503);
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
        sandboxAuditLog.push({ ts: Date.now(), action: action.type, project: action.project || "", status: "relayed" });
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
    if (providedKey !== snapshotKey && !findBridgeClient(providedKey)) { sendJson(res, { error: "Invalid key" }, 403); return; }
    sendJson(res, { entries: sandboxAuditLog.slice(-100) });
    return;
  }

  if (pathname === "/api/grok-proxy") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const providedKey = getKey(req, url);
    const matchedClient = findBridgeClient(providedKey);
    if (!matchedClient && providedKey !== snapshotKey) { sendJson(res, { error: "Invalid key" }, 403); return; }
    if (!matchedClient) { sendJson(res, { error: "No desktop client connected." }, 503); return; }

    const payloadB64 = url.searchParams.get("payload") || "";
    if (!payloadB64) { sendJson(res, { error: "payload parameter required (base64-encoded JSON)" }, 400); return; }
    let actions;
    try {
      const decoded = Buffer.from(payloadB64, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      actions = parsed.actions || [parsed];
      if (!Array.isArray(actions)) actions = [actions];
    } catch (e) {
      sendJson(res, { error: "Invalid base64 payload: " + e.message }, 400);
      return;
    }
    if (actions.length === 0) { sendJson(res, { error: "Empty actions" }, 400); return; }
    if (actions.length > 50) { sendJson(res, { error: "Max 50 actions per request" }, 400); return; }

    const project = url.searchParams.get("project") || "";
    actions = actions.map(a => ({ ...a, project: a.project || project }));

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
      sandboxAuditLog.push({ ts: Date.now(), action: action.type, project: action.project || "", status: "relayed-proxy" });
    }
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
    const search = url.searchParams.get("search") || "";
    const replace = url.searchParams.get("replace") || "";
    const replaceAll = url.searchParams.get("replaceAll") === "true";

    if (!filePath) { sendJson(res, { error: "path parameter required" }, 400); return; }
    if (!search) { sendJson(res, { error: "search parameter required" }, 400); return; }

    const actions = [{ type: "search_replace", project, path: filePath, search, replace, replaceAll }];
    const requestId = crypto.randomUUID();
    const relayPromise = new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingSandboxRelayRequests.delete(requestId);
        resolve(JSON.stringify({ error: "Relay timeout — desktop app did not respond within 30 seconds." }));
      }, 30000);
      pendingSandboxRelayRequests.set(requestId, { resolve, timer });
    });
    try {
      matchedClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions }));
    } catch {
      sendJson(res, { error: "Could not reach desktop app through relay bridge." }, 502);
      return;
    }
    sandboxAuditLog.push({ ts: Date.now(), action: "search_replace", project, status: "relayed-edit" });
    if (sandboxAuditLog.length > 1000) sandboxAuditLog.splice(0, sandboxAuditLog.length - 500);
    const result = await relayPromise;
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(result);
    return;
  }

  if (pathname === "/api/grok") {
    sendJson(res, {
      service: "Lamby Bridge Relay — Grok Integration",
      endpoints: {
        snapshot: "/api/snapshot/:project?key=KEY",
        consoleLogs: "/api/console-logs?key=KEY&project=NAME",
        execute: "POST /api/sandbox/execute?key=KEY",
        grokProxy: "/api/grok-proxy?key=KEY&project=NAME&payload=BASE64_ACTIONS",
        grokEdit: "/api/grok-edit?key=KEY&project=NAME&path=FILE&search=OLD&replace=NEW&replaceAll=true",
      },
      notes: "All grok-proxy and grok-edit endpoints are GET-based for use with browse_page. The payload for grok-proxy is base64-encoded JSON: {actions:[{type,project,...}]}.",
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found", endpoints: ["/", "/api/snapshot-key", "/api/bridge-status", "/api/snapshot/:project", "/api/console-logs", "/api/sandbox/execute", "/api/sandbox/audit-log", "/api/grok-proxy", "/api/grok-edit", "/api/grok"] }));
});

server.on("upgrade", (req, socket, head) => {
  const reqUrl = new URL(req.url || "", "http://localhost");
  if (req.url && req.url.startsWith("/bridge-ws")) {
    const bridgeKey = reqUrl.searchParams.get("key") || "";
    const clientSnapshotKey = reqUrl.searchParams.get("snapshotKey") || "";
    if (!bridgeKey || bridgeKey.length < 8) { socket.destroy(); return; }
    if (clientSnapshotKey !== snapshotKey && clientSnapshotKey.length < 16) {
      console.log(`[Bridge] Rejected — snapshotKey too short`);
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
      console.log(`[Bridge] Pruning stale client (key: ${key.substring(0, 8)}...)`);
      try { client.socket.destroy(); } catch {}
      bridgeClients.delete(key);
    }
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
  console.log(`  Snapshot key: ${snapshotKey}`);
  console.log(`  Zero dependencies — pure Node.js`);
  console.log(`  Endpoints:`);
  console.log(`    GET  /                      Health check`);
  console.log(`    GET  /api/snapshot-key       Get connection info`);
  console.log(`    GET  /api/bridge-status      Connected clients`);
  console.log(`    GET  /api/snapshot/:project   Get project snapshot (via desktop)`);
  console.log(`    GET  /api/console-logs       Get desktop console logs (via desktop)`);
  console.log(`    POST /api/sandbox/execute    Execute actions (via desktop)`);
  console.log(`    GET  /api/sandbox/audit-log  Recent actions`);
  console.log(`    GET  /api/grok-proxy         GET-based proxy for Grok (base64 payload)`);
  console.log(`    GET  /api/grok-edit          GET-based file edit for Grok`);
  console.log(`    GET  /api/grok              Endpoint discovery`);
  console.log(`    WS   /bridge-ws             Desktop WebSocket connection`);
});
