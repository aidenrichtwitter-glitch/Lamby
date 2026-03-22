const http = require("http");
const crypto = require("crypto");

const BASE_URL = process.env.LAMBY_URL || "http://localhost:5000";
const XAI_API_KEY = process.env.XAI_API_KEY || "";
const TEST_PROJECT = "e2e-test-" + Date.now();

let snapshotKey = "";
let passed = 0;
let failed = 0;

function log(msg) { console.log(`[E2E] ${msg}`); }
function pass(name) { passed++; log(`✓ ${name}`); }
function fail(name, err) { failed++; log(`✗ ${name}: ${err}`); }

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (data) opts.headers["Content-Length"] = Buffer.byteLength(data);
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function xaiComplete(prompt) {
  if (!XAI_API_KEY) throw new Error("XAI_API_KEY not set");
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "grok-3-mini-fast",
      messages: [
        { role: "system", content: "You are an AI developer assistant. Respond ONLY with valid JSON — no markdown, no code fences, no explanation. The JSON must be an object with an 'actions' array." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    });
    const opts = {
      hostname: "api.x.ai",
      port: 443,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_API_KEY}`,
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const https = require("https");
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          const content = body.choices?.[0]?.message?.content || "";
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          resolve(JSON.parse(cleaned));
        } catch (e) {
          reject(new Error(`xAI parse error: ${e.message}`));
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  log("=== Lamby Sandbox E2E Test ===");
  log(`Base URL: ${BASE_URL}`);
  log(`Test project: ${TEST_PROJECT}`);

  try {
    const keyRes = await request("GET", "/api/snapshot-key");
    if (keyRes.data?.key) {
      snapshotKey = keyRes.data.key;
      pass("GET /api/snapshot-key");
    } else {
      fail("GET /api/snapshot-key", "No key returned");
      process.exit(1);
    }
  } catch (e) {
    fail("GET /api/snapshot-key", e.message);
    process.exit(1);
  }

  try {
    const res = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, {
      actions: [
        { type: "run_command", command: `mkdir -p projects/${TEST_PROJECT}` },
        { type: "write_file", project: TEST_PROJECT, path: "package.json", content: JSON.stringify({ name: TEST_PROJECT, version: "0.0.1", private: true }, null, 2) },
        { type: "write_file", project: TEST_PROJECT, path: "index.html", content: "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>" },
      ],
    });
    if (res.data?.success) pass("Create test project via sandbox");
    else fail("Create test project", JSON.stringify(res.data));
  } catch (e) {
    fail("Create test project", e.message);
  }

  try {
    const res = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, {
      actions: [{ type: "list_tree", project: TEST_PROJECT }],
    });
    const entries = res.data?.results?.[0]?.data?.entries || [];
    if (entries.length >= 2) pass("list_tree");
    else fail("list_tree", `Expected >=2 entries, got ${entries.length}`);
  } catch (e) {
    fail("list_tree", e.message);
  }

  try {
    const res = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, {
      actions: [{ type: "read_file", project: TEST_PROJECT, path: "index.html" }],
    });
    const content = res.data?.results?.[0]?.data?.content || "";
    if (content.includes("<h1>Hello</h1>")) pass("read_file");
    else fail("read_file", "Content mismatch");
  } catch (e) {
    fail("read_file", e.message);
  }

  try {
    const res = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, {
      actions: [{ type: "grep", project: TEST_PROJECT, pattern: "Hello" }],
    });
    const matches = res.data?.results?.[0]?.data?.matches || [];
    if (matches.length > 0) pass("grep");
    else fail("grep", "No matches found");
  } catch (e) {
    fail("grep", e.message);
  }

  try {
    const res = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, {
      actions: [{ type: "search_files", project: TEST_PROJECT, pattern: "index" }],
    });
    const files = res.data?.results?.[0]?.data?.files || [];
    if (files.length > 0) pass("search_files");
    else fail("search_files", "No files found");
  } catch (e) {
    fail("search_files", e.message);
  }

  try {
    const res = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, {
      actions: [{ type: "detect_structure", project: TEST_PROJECT }],
    });
    const data = res.data?.results?.[0]?.data || {};
    if (data.hasPackageJson) pass("detect_structure");
    else fail("detect_structure", JSON.stringify(data));
  } catch (e) {
    fail("detect_structure", e.message);
  }

  try {
    const res = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, {
      actions: [
        { type: "copy_file", project: TEST_PROJECT, source: "index.html", dest: "index-copy.html" },
        { type: "rename_file", project: TEST_PROJECT, source: "index-copy.html", dest: "index-renamed.html" },
      ],
    });
    if (res.data?.success) pass("copy_file + rename_file");
    else fail("copy_file + rename_file", JSON.stringify(res.data));
  } catch (e) {
    fail("copy_file + rename_file", e.message);
  }

  try {
    const res = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, {
      actions: [{ type: "delete_file", project: TEST_PROJECT, path: "index-renamed.html" }],
    });
    if (res.data?.success) pass("delete_file");
    else fail("delete_file", JSON.stringify(res.data));
  } catch (e) {
    fail("delete_file", e.message);
  }

  try {
    const res = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, {
      actions: [
        { type: "git_init", project: TEST_PROJECT },
        { type: "git_add", project: TEST_PROJECT },
        { type: "git_commit", project: TEST_PROJECT, message: "initial commit" },
        { type: "git_status", project: TEST_PROJECT },
        { type: "git_log", project: TEST_PROJECT, count: 5 },
      ],
    });
    const results = res.data?.results || [];
    const commitResult = results.find(r => r.type === "git_commit");
    const logResult = results.find(r => r.type === "git_log");
    if (commitResult?.status === "success" && logResult?.data?.output?.includes("initial commit")) pass("git operations");
    else fail("git operations", JSON.stringify(results.map(r => ({ type: r.type, status: r.status }))));
  } catch (e) {
    fail("git operations", e.message);
  }

  try {
    const res = await request("GET", `/api/snapshot/${TEST_PROJECT}?key=${snapshotKey}`);
    const snapshot = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    if (snapshot.includes("LAMBY PROJECT SNAPSHOT") && snapshot.includes(TEST_PROJECT)) pass("snapshot");
    else fail("snapshot", "Missing expected content");
  } catch (e) {
    fail("snapshot", e.message);
  }

  try {
    const res = await request("GET", `/api/sandbox/audit-log?key=${snapshotKey}`);
    const entries = res.data?.entries || [];
    if (entries.length > 0) pass("audit-log");
    else fail("audit-log", "No audit entries");
  } catch (e) {
    fail("audit-log", e.message);
  }

  try {
    const res = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, {
      actions: [{ type: "run_command", command: "rm -rf /etc/passwd" }],
    });
    const result = res.data?.results?.[0];
    if (result?.status === "error") pass("safety: blocked dangerous command");
    else fail("safety: blocked dangerous command", JSON.stringify(result));
  } catch (e) {
    fail("safety: blocked dangerous command", e.message);
  }

  try {
    const res = await request("POST", "/api/sandbox/execute?key=invalid-key", {
      actions: [{ type: "list_tree" }],
    });
    if (res.status === 403) pass("auth: rejected invalid key");
    else fail("auth: rejected invalid key", `Status ${res.status}`);
  } catch (e) {
    fail("auth: rejected invalid key", e.message);
  }

  if (XAI_API_KEY) {
    log("\n--- xAI Integration Test ---");
    try {
      const snapshot = await request("GET", `/api/snapshot/${TEST_PROJECT}?key=${snapshotKey}`);
      const snapshotText = typeof snapshot.data === "string" ? snapshot.data : JSON.stringify(snapshot.data);

      const aiResponse = await xaiComplete(
        `You are looking at a project snapshot. Create a landing page for this project.\n\nSnapshot:\n${snapshotText.slice(0, 5000)}\n\nRespond with JSON: {"actions": [{"type": "write_file", "project": "${TEST_PROJECT}", "path": "index.html", "content": "...full HTML landing page content..."}]}`
      );

      if (aiResponse?.actions?.length > 0) {
        pass("xAI: generated actions from snapshot");

        const execRes = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, { actions: aiResponse.actions });
        if (execRes.data?.success) pass("xAI: executed AI-generated actions");
        else fail("xAI: executed AI-generated actions", JSON.stringify(execRes.data));

        const verifyRes = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, {
          actions: [{ type: "read_file", project: TEST_PROJECT, path: "index.html" }],
        });
        const newContent = verifyRes.data?.results?.[0]?.data?.content || "";
        if (newContent.length > 100 && newContent.includes("<html")) pass("xAI: verified file was written");
        else fail("xAI: verified file was written", `Content length: ${newContent.length}`);

        const snapshot2 = await request("GET", `/api/snapshot/${TEST_PROJECT}?key=${snapshotKey}`);
        const snap2Text = typeof snapshot2.data === "string" ? snapshot2.data : JSON.stringify(snapshot2.data);
        const aiResponse2 = await xaiComplete(
          `You are looking at a project that has a landing page. Add a CSS file to style it.\n\nSnapshot:\n${snap2Text.slice(0, 5000)}\n\nRespond with JSON: {"actions": [{"type": "write_file", "project": "${TEST_PROJECT}", "path": "styles.css", "content": "...CSS content..."}]}`
        );

        if (aiResponse2?.actions?.length > 0) {
          const execRes2 = await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, { actions: aiResponse2.actions });
          if (execRes2.data?.success) pass("xAI: second round (CSS)");
          else fail("xAI: second round (CSS)", JSON.stringify(execRes2.data));
        } else {
          fail("xAI: second round", "No actions generated");
        }
      } else {
        fail("xAI: generated actions", "No actions in response");
      }
    } catch (e) {
      fail("xAI integration", e.message);
    }
  } else {
    log("\n--- Skipping xAI test (XAI_API_KEY not set) ---");
  }

  try {
    await request("POST", `/api/sandbox/execute?key=${snapshotKey}`, {
      actions: [{ type: "delete_file", project: TEST_PROJECT, path: ".", recursive: true }],
    });
  } catch {}

  log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  log(`Fatal error: ${e.message}`);
  process.exit(1);
});
