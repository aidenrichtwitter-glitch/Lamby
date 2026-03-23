const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = parseInt(process.env.PORT || "3000", 10);

const bridgeClients = new Map();
const pendingRelayRequests = new Map();
const pendingSandboxRelayRequests = new Map();
const pendingConsoleLogRequests = new Map();
const sandboxAuditLog = [];
let runTestsInFlight = false;

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

function getFirstAliveClient() {
  for (const [, client] of bridgeClients) {
    if (client.alive) return client;
  }
  return null;
}

const bridgeWss = new WebSocketServer({ noServer: true });

bridgeWss.on("connection", (ws, project) => {
  const connId = crypto.randomUUID();

  const existingClient = bridgeClients.get(project);
  if (existingClient) {
    console.log(`[Bridge] Replacing stale connection for project ${project} (old connId: ${existingClient.connId.substring(0, 8)})`);
    existingClient.alive = false;
    existingClient.replaced = true;
    try { existingClient.send(JSON.stringify({ type: "connection_replaced" })); } catch {}
    setTimeout(() => { try { existingClient.ws.close(); } catch {} }, 500);
  }

  console.log(`[Bridge] Client connected (project: ${project}, connId: ${connId.substring(0, 8)})`);

  const client = { ws, lastPing: Date.now(), alive: true, connId, replaced: false };
  bridgeClients.set(project, client);

  client.send = (data) => {
    try { if (ws.readyState === 1) ws.send(data); } catch {}
  };

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
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
      } else if (msg.type === "pong") {
        client.lastPing = Date.now();
      }
    } catch {}
  });

  ws.on("close", () => {
    if (client.replaced) {
      console.log(`[Bridge] Old connection closed (project: ${project}, connId: ${connId.substring(0, 8)}) — already replaced`);
      return;
    }
    console.log(`[Bridge] Client disconnected (project: ${project}, connId: ${connId.substring(0, 8)})`);
    client.alive = false;
    const current = bridgeClients.get(project);
    if (current && current.connId === connId) {
      bridgeClients.delete(project);
    }
  });

  ws.on("error", () => {
    client.alive = false;
    const current = bridgeClients.get(project);
    if (current && current.connId === connId) {
      bridgeClients.delete(project);
    }
  });
});

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
      baseUrl,
      snapshotUrl: `${baseUrl}/api/snapshot/PROJECT_NAME`,
      commandEndpoint: `${baseUrl}/api/sandbox/execute`,
      bridgeWs: `wss://${host}/bridge-ws?project=YOUR_PROJECT`,
      commandProtocol: "POST JSON {actions: [{type, project, ...}]}. All requests forwarded to connected desktop client via bridge.",
    });
    return;
  }

  if (pathname === "/api/bridge-status") {
    const clients = Array.from(bridgeClients.entries()).map(([key, c]) => ({
      key: key.substring(0, 8) + "...",
      connected: c.alive,
      lastPing: c.lastPing,
    }));
    sendJson(res, { connectedClients: clients.length, clients });
    return;
  }

  if (pathname.startsWith("/api/snapshot/")) {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const pathParts = pathname.replace("/api/snapshot/", "").split("/").filter(Boolean);
    const projectName = pathParts[0] || "";

    const matchedClient = getFirstAliveClient();
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
    const projectName = url.searchParams.get("project") || "";

    const matchedClient = getFirstAliveClient();
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
      const body = JSON.parse(await readBody(req));
      const actions = body.actions;
      if (!Array.isArray(actions) || actions.length === 0) { sendJson(res, { error: "actions array required" }, 400); return; }
      if (actions.length > 50) { sendJson(res, { error: "Max 50 actions per request" }, 400); return; }
      const matchedClient = getFirstAliveClient();
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
    sendJson(res, { entries: sandboxAuditLog.slice(-100) });
    return;
  }

  const screenshotMatch = pathname.match(/^\/api\/screenshot\/([^/]+)(?:\/([^/]+))?$/);
  if (screenshotMatch) {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const project = decodeURIComponent(screenshotMatch[2] || screenshotMatch[1]);
    const matchedClient = getFirstAliveClient();
    if (!matchedClient) { sendJson(res, { error: "No desktop client connected." }, 503); return; }
    const selector = url.searchParams.get("selector") || undefined;
    const fullPage = url.searchParams.get("fullPage") === "true";
    const waitMs = parseInt(url.searchParams.get("waitMs") || "2000");
    const action = { type: "screenshot_preview", project, selector, fullPage, waitMs };
    const requestId = crypto.randomUUID();
    const relayPromise = new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingSandboxRelayRequests.delete(requestId);
        resolve(JSON.stringify({ error: "Relay timeout — desktop app did not respond within 60 seconds." }));
      }, 60000);
      pendingSandboxRelayRequests.set(requestId, { resolve, timer });
    });
    try {
      matchedClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions: [action] }));
    } catch {
      sendJson(res, { error: "Could not reach desktop app through relay bridge." }, 502);
      return;
    }
    sandboxAuditLog.push({ ts: Date.now(), action: "screenshot_preview", project, status: "relayed-screenshot" });
    if (sandboxAuditLog.length > 1000) sandboxAuditLog.splice(0, sandboxAuditLog.length - 500);
    const result = await relayPromise;
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(result);
    return;
  }

  if (pathname === "/api/grok-proxy") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const matchedClient = getFirstAliveClient();
    if (!matchedClient) { sendJson(res, { error: "No desktop client connected." }, 503); return; }

    const payloadB64 = url.searchParams.get("payload") || "";
    if (!payloadB64) { sendJson(res, { error: "payload parameter required (base64-encoded JSON)" }, 400); return; }
    let actions;
    try {
      let decoded;
      try { const buf = Buffer.from(payloadB64, "base64"); const zlib = require("zlib"); decoded = zlib.gunzipSync(buf).toString("utf-8"); } catch { decoded = Buffer.from(payloadB64, "base64").toString("utf-8"); }
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
    const matchedClient = getFirstAliveClient();
    if (!matchedClient) { sendJson(res, { error: "No desktop client connected." }, 503); return; }

    const project = url.searchParams.get("project") || "";
    const filePath = url.searchParams.get("path") || "";
    const searchB64 = url.searchParams.get("searchB64") || "";
    const replaceB64 = url.searchParams.get("replaceB64") || "";
    const search = searchB64 ? Buffer.from(searchB64, "base64").toString("utf-8") : (url.searchParams.get("search") || "");
    const replace = replaceB64 ? Buffer.from(replaceB64, "base64").toString("utf-8") : (url.searchParams.get("replace") || "");
    const replaceAll = url.searchParams.get("replaceAll") === "true";

    if (!filePath) { sendJson(res, { error: "path parameter required" }, 400); return; }
    if (!search) { sendJson(res, { error: "search parameter required (use search= or searchB64= for HTML content)" }, 400); return; }

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

  if (pathname === "/api/grok-interact") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    const matchedClient = getFirstAliveClient();
    if (!matchedClient) { sendJson(res, { error: "No desktop client connected." }, 503); return; }

    const project = url.searchParams.get("project") || "";
    const action = url.searchParams.get("action") || "";
    if (!project || !action) {
      sendJson(res, { error: "Required params: project, action", actions: ["click", "type", "select", "evaluate", "runFunction", "waitFor"], example: `https://${req.headers.host || "bridge-relay.replit.app"}/api/grok-interact?project=my-app&action=click&selector=%23screenshot-btn`, params: { selector: "CSS selector", text: "text to type (mapped to value)", value: "value for type/select", code: "JS code for evaluate (mapped to script)", script: "JS code for evaluate", functionName: "for runFunction", args: "JSON array for runFunction", screenshot: "true to capture after", waitAfter: "ms to wait after action", timeout: "ms for waitFor" } });
      return;
    }

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
      const timer = setTimeout(() => {
        pendingSandboxRelayRequests.delete(requestId);
        resolve(JSON.stringify({ error: "Relay timeout — desktop app did not respond within 30 seconds." }));
      }, 30000);
      pendingSandboxRelayRequests.set(requestId, { resolve, timer });
    });
    try {
      matchedClient.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions: [interactAction] }));
    } catch {
      sendJson(res, { error: "Could not reach desktop app through relay bridge." }, 502);
      return;
    }
    sandboxAuditLog.push({ ts: Date.now(), action: "browser_interact", project, status: "relayed-interact" });
    if (sandboxAuditLog.length > 1000) sandboxAuditLog.splice(0, sandboxAuditLog.length - 500);
    const result = await relayPromise;
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(result);
    return;
  }

  if (pathname === "/api/commands") {
    const COMMANDS = ["list_tree","read_file","read_multiple_files","write_file","write_file_chunk","create_file","delete_file","bulk_delete","move_file","copy_file","copy_folder","rename_file","grep","search_files","search_replace","apply_patch","bulk_write","run_command","install_deps","add_dependency","remove_dependency","type_check","lint_and_fix","format_files","get_build_metrics","restart_dev_server","list_open_ports","git_status","git_add","git_commit","git_diff","git_log","git_branch","git_checkout","git_stash","git_init","git_push","git_pull","git_merge","git_stash_pop","git_reset","git_revert","git_tag","detect_structure","start_process","kill_process","list_processes","build_project","run_tests","archive_project","export_project","set_env_var","get_env_vars","rollback_last_change","project_analyze","tailwind_audit","find_usages","component_tree","extract_theme","extract_colors","capture_preview","get_preview_url","generate_component","generate_page","refactor_file","validate_change","profile_performance","create_folder","delete_folder","move_folder","rename_folder","list_tree_filtered","dead_code_detection","dependency_graph","symbol_search","grep_advanced","extract_imports","run_command_advanced","build_with_flags","clean_build_cache","start_process_named","monitor_process","get_process_logs","stop_all_processes","switch_port","visual_diff","capture_component","record_video","get_dom_snapshot","get_console_errors","generate_test","generate_storybook","optimize_code","convert_to_typescript","add_feature","migrate_framework","react_profiler","memory_leak_detection","console_error_analysis","runtime_error_trace","bundle_analyzer","network_monitor","accessibility_audit","security_scan","set_tailwind_config","set_next_config","update_package_json","manage_scripts","switch_package_manager","deploy_preview","export_project_zip","import_project","super_command","screenshot_preview","browser_interact"];
    sendJson(res, {
      total: COMMANDS.length,
      commands: COMMANDS,
      usage: "POST /api/sandbox/execute with {actions: [{type: '<command>', project: 'name', ...params}]}",
      grokProxy: {
        endpoint: "GET /api/grok-proxy",
        params: { payload: "base64(JSON) or base64(gzip(JSON))" },
        encodingPlain: "btoa(JSON.stringify({actions:[...]}))",
        largeFileRule: "For file content > 2 KB use write_file_chunk (split into ~1500-char pieces, chunk_index 0..N-1, total_chunks=N) — do NOT use write_file for large content, the URL will be truncated",
      },
    });
    return;
  }

  if (pathname === "/api/grok") {
    sendJson(res, {
      service: "Lamby Bridge Relay — Grok Integration",
      endpoints: {
        snapshot: "/api/snapshot/:project",
        consoleLogs: "/api/console-logs?project=NAME",
        execute: "POST /api/sandbox/execute",
        grokProxy: "/api/grok-proxy?project=NAME&payload=BASE64_ACTIONS",
        grokEdit: "/api/grok-edit?project=NAME&path=FILE&search=OLD&replace=NEW&replaceAll=true",
        grokInteract: "/api/grok-interact?project=NAME&action=ACTION&selector=CSS",
        screenshot: "/api/screenshot/:project?fullPage=true&waitMs=8000",
        commands: "/api/commands",
        runTests: "/api/run-tests?project=PROJECT_NAME",
      },
      notes: "No authentication required — the relay URL is the secret. All grok-proxy, grok-edit, and grok-interact endpoints are GET-based for use with browse_page. The payload for grok-proxy is base64-encoded JSON: {actions:[{type,project,...}]}. For HTML content in grok-edit, use searchB64 and replaceB64 (base64-encoded) instead of search/replace.",
    });
    return;
  }

  if (pathname === "/api/run-tests") {
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    if (runTestsInFlight) { sendJson(res, { error: "Test suite already running — try again later" }, 429); return; }
    const testProject = url.searchParams.get("project") || "groks-app";
    const { execFile } = require("child_process");
    const testScript = path.join(__dirname, "..", "scripts", "bridge-test.cjs");
    if (!fs.existsSync(testScript)) {
      sendJson(res, { error: "Test script not found at " + testScript }, 404);
      return;
    }
    const selfDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG
      ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : `localhost:${PORT}`;
    runTestsInFlight = true;
    execFile(process.execPath, [testScript], {
      env: { ...process.env, BRIDGE_RELAY_DOMAIN: selfDomain, BRIDGE_TEST_PROJECT: testProject },
      timeout: 120000,
      maxBuffer: 5 * 1024 * 1024,
    }, (err, stdout, stderr) => {
      runTestsInFlight = false;
      if (err && !stdout) {
        sendJson(res, { error: `Test runner failed: ${err.message}`, stderr: stderr.slice(-2000) }, 500);
        return;
      }
      try {
        const report = JSON.parse(stdout);
        const httpStatus = report.tiers && Object.values(report.tiers).some(t => t.failed > 0) ? 200 : 200;
        sendJson(res, report, httpStatus);
      } catch {
        sendJson(res, { error: "Failed to parse test output", stdout: stdout.slice(-2000), stderr: stderr.slice(-2000) }, 500);
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found", endpoints: ["/", "/api/grok", "/api/screenshot/:project", "/api/grok-edit", "/api/grok-interact", "/api/grok-proxy", "/api/snapshot-key", "/api/bridge-status", "/api/snapshot/:project", "/api/console-logs", "/api/sandbox/execute", "/api/sandbox/audit-log", "/api/commands", "/api/run-tests"] }));
});

server.on("upgrade", (req, socket, head) => {
  const reqUrl = new URL(req.url || "", "http://localhost");
  if (req.url && req.url.startsWith("/bridge-ws")) {
    const project = reqUrl.searchParams.get("project") || reqUrl.searchParams.get("key") || "default";
    bridgeWss.handleUpgrade(req, socket, head, (ws) => {
      bridgeWss.emit("connection", ws, project);
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
      try { client.ws.close(); } catch {}
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
  console.log(`  No authentication — relay URL is the secret`);
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
