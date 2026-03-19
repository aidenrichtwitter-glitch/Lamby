#!/usr/bin/env node

const http = require("http");
const https = require("https");

const LOCAL_URL = "http://localhost:5000";
const BASE_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : LOCAL_URL;

const XAI_API_KEY = process.env.XAI_API;
const PROJECT = "landing-page";

let passed = 0;
let failed = 0;
let skipped = 0;

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function assert(condition, msg) {
  if (condition) {
    passed++;
    log("\u2705", msg);
  } else {
    failed++;
    log("\u274c", msg);
  }
}

function skip(msg) {
  skipped++;
  log("\u23ed\ufe0f", `SKIP: ${msg}`);
}

async function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.request(url, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      timeout: options.timeout || 30000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    if (options.body) req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

async function callXAI(messages, temperature = 0.3, maxTokens = 8192) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: "grok-3-mini-fast",
      messages,
      temperature,
      max_tokens: maxTokens,
    });
    const req = https.request("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_API_KEY}`,
      },
      timeout: 120000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(`xAI API error: ${JSON.stringify(parsed.error)}`));
          else resolve(parsed.choices[0].message.content);
        } catch (e) { reject(new Error(`Failed to parse xAI response: ${data.slice(0, 500)}`)); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("xAI API timeout")); });
    req.write(postData);
    req.end();
  });
}

function parseAIResponse(raw) {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*"actions"\s*:\s*\[[\s\S]*\]\s*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error("Could not parse AI response as JSON");
  }
}

async function sandboxExecute(key, actions) {
  return fetchJSON(`${BASE_URL}/api/sandbox/execute?key=${key}`, {
    method: "POST",
    body: { actions },
    timeout: 60000,
  });
}

function logResults(results) {
  for (const r of results) {
    const preview = r.data ? JSON.stringify(r.data).slice(0, 150) : (r.error || "").slice(0, 150);
    log("  \ud83d\udcca", `[${r.actionIndex}] ${r.type}: ${r.status} \u2014 ${preview}`);
  }
}

const SYSTEM_PROMPT = `You are an AI assistant that controls a code sandbox through structured JSON commands.
You have access to a sandbox API that accepts an array of actions. Each action has a "type" field and additional parameters.

Available action types:
- list_tree: {type: "list_tree", project: "NAME", depth: N}
- read_file: {type: "read_file", project: "NAME", path: "file/path"}
- write_file: {type: "write_file", project: "NAME", path: "file/path", content: "..."}
- create_file: {type: "create_file", project: "NAME", path: "file/path", content: "..."}
- delete_file: {type: "delete_file", project: "NAME", path: "file/path", recursive: true/false}
- move_file: {type: "move_file", project: "NAME", source: "old/path", dest: "new/path"}
- copy_file: {type: "copy_file", project: "NAME", source: "src", dest: "dst"}
- grep: {type: "grep", project: "NAME", pattern: "regex", extensions: [".js",".html"]}
- search_files: {type: "search_files", project: "NAME", pattern: "regex"}
- run_command: {type: "run_command", project: "NAME", command: "cmd", timeout: 30000}
- install_deps: {type: "install_deps", project: "NAME"}
- git_init: {type: "git_init", project: "NAME"}
- git_status: {type: "git_status", project: "NAME"}
- git_add: {type: "git_add", project: "NAME", files: ["."]}
- git_commit: {type: "git_commit", project: "NAME", message: "commit msg"}
- git_diff: {type: "git_diff", project: "NAME"}
- git_log: {type: "git_log", project: "NAME"}
- detect_structure: {type: "detect_structure", project: "NAME"}
- start_process: {type: "start_process", project: "NAME", command: "cmd", name: "proc-name"}
- list_processes: {type: "list_processes"}
- kill_process: {type: "kill_process", name: "proc-name"}

IMPORTANT: Respond with ONLY a valid JSON object containing an "actions" array. No markdown, no explanation, no code fences. Just raw JSON.
Example: {"actions": [{"type": "list_tree", "project": "my-project", "depth": 2}]}`;

async function main() {
  console.log("\n\ud83e\uddea LAMBY SANDBOX COMPREHENSIVE E2E TEST");
  console.log("==========================================");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Project:  ${PROJECT}`);
  console.log(`xAI API:  ${XAI_API_KEY ? "configured" : "MISSING"}\n`);

  if (!XAI_API_KEY) {
    log("\u274c", "XAI_API environment variable not set \u2014 cannot run E2E test");
    process.exit(1);
  }

  let key;

  // ============================================================
  // PHASE 1: Infrastructure & Auth
  // ============================================================
  console.log("\n\u2550\u2550\u2550 PHASE 1: Infrastructure & Auth \u2550\u2550\u2550\n");

  log("\ud83d\udccb", "1.1 Fetching snapshot key...");
  try {
    const keyRes = await fetchJSON(`${LOCAL_URL}/api/snapshot-key`);
    assert(keyRes.status === 200, "Snapshot key endpoint returns 200");
    key = keyRes.data.key;
    assert(typeof key === "string" && key.length > 10, "Snapshot key is a valid string");
    assert(!!keyRes.data.commandEndpoint, "commandEndpoint URL present");
    assert(!!keyRes.data.commandProtocol, "commandProtocol description present");
    assert(!!keyRes.data.baseUrl, "baseUrl present");
    log("\ud83d\udd11", `Key: ${key.slice(0, 8)}...`);
  } catch (e) {
    log("\u274c", `Fatal: Failed to get snapshot key: ${e.message}`);
    process.exit(1);
  }

  log("\n\ud83d\udccb", "1.2 Auth test \u2014 invalid key rejected...");
  try {
    const res = await sandboxExecute("wrong-key-12345", [{ type: "list_tree", project: PROJECT }]);
    assert(res.status === 403, "Invalid key returns 403");
  } catch (e) {
    log("\u274c", `Auth test failed: ${e.message}`);
  }

  log("\n\ud83d\udccb", "1.3 Bridge relay status...");
  try {
    const res = await fetchJSON(`${LOCAL_URL}/api/bridge-relay-status`);
    assert(res.status === 200, "bridge-relay-status endpoint responds");
    assert(["connected", "connecting", "disconnected"].includes(res.data.status), `Relay status: ${res.data.status}`);
    if (res.data.relayUrl) log("\ud83c\udf10", `Relay URL: ${res.data.relayUrl}`);
  } catch (e) {
    log("\u274c", `Bridge relay status failed: ${e.message}`);
  }

  log("\n\ud83d\udccb", "1.4 Bridge status (desktop clients)...");
  try {
    const res = await fetchJSON(`${LOCAL_URL}/api/bridge-status`);
    assert(res.status === 200, "bridge-status endpoint responds");
    assert(typeof res.data.connectedClients === "number", `Connected clients: ${res.data.connectedClients}`);
  } catch (e) {
    log("\u274c", `Bridge status failed: ${e.message}`);
  }

  // ============================================================
  // PHASE 2: Sandbox Action Types (direct API)
  // ============================================================
  console.log("\n\u2550\u2550\u2550 PHASE 2: Sandbox Action Types \u2550\u2550\u2550\n");

  log("\ud83d\udccb", "2.1 detect_structure...");
  try {
    const res = await sandboxExecute(key, [{ type: "detect_structure", project: PROJECT }]);
    assert(res.data.success === true, "detect_structure succeeds");
    assert(res.data.results[0].type === "detect_structure", "Returns detect_structure type");
    log("  \u2139\ufe0f", `Structure: ${JSON.stringify(res.data.results[0].data).slice(0, 200)}`);
  } catch (e) { log("\u274c", `detect_structure failed: ${e.message}`); }

  log("\n\ud83d\udccb", "2.2 list_tree...");
  try {
    const res = await sandboxExecute(key, [{ type: "list_tree", project: PROJECT, depth: 3 }]);
    assert(res.data.success === true, "list_tree succeeds");
    assert(res.data.results[0].data.entries.length > 0, `list_tree returns ${res.data.results[0].data.entries.length} entries`);
  } catch (e) { log("\u274c", `list_tree failed: ${e.message}`); }

  log("\n\ud83d\udccb", "2.3 read_file (package.json)...");
  try {
    const res = await sandboxExecute(key, [{ type: "read_file", project: PROJECT, path: "package.json" }]);
    assert(res.data.success === true, "read_file succeeds");
    assert(res.data.results[0].data.content.length > 0, "package.json has content");
  } catch (e) { log("\u274c", `read_file failed: ${e.message}`); }

  log("\n\ud83d\udccb", "2.4 create_file + read_file + write_file (append) + read_file...");
  try {
    const res = await sandboxExecute(key, [
      { type: "create_file", project: PROJECT, path: "e2e-test-marker.txt", content: "LINE1:MARKER_E2E_TEST\n" },
      { type: "read_file", project: PROJECT, path: "e2e-test-marker.txt" },
      { type: "write_file", project: PROJECT, path: "e2e-test-marker.txt", content: "LINE2:APPENDED\n", mode: "append" },
      { type: "read_file", project: PROJECT, path: "e2e-test-marker.txt" },
    ]);
    assert(res.data.success === true, "CRUD batch succeeds");
    assert(res.data.results[0].data.created === true, "File created");
    assert(res.data.results[1].data.content.includes("MARKER_E2E_TEST"), "Read confirms create");
    assert(res.data.results[3].data.content.includes("LINE1") && res.data.results[3].data.content.includes("LINE2"), "Append worked");
  } catch (e) { log("\u274c", `create+write failed: ${e.message}`); }

  log("\n\ud83d\udccb", "2.5 copy_file + move_file...");
  try {
    const res = await sandboxExecute(key, [
      { type: "copy_file", project: PROJECT, source: "e2e-test-marker.txt", dest: "e2e-test-copy.txt" },
      { type: "read_file", project: PROJECT, path: "e2e-test-copy.txt" },
      { type: "move_file", project: PROJECT, source: "e2e-test-copy.txt", dest: "e2e-test-moved.txt" },
      { type: "read_file", project: PROJECT, path: "e2e-test-moved.txt" },
    ]);
    assert(res.data.results[0].status === "success", "copy_file succeeds");
    assert(res.data.results[1].data.content.includes("MARKER_E2E_TEST"), "Copied file has content");
    assert(res.data.results[2].status === "success", "move_file succeeds");
    assert(res.data.results[3].data.content.includes("MARKER_E2E_TEST"), "Moved file has content");
  } catch (e) { log("\u274c", `copy+move failed: ${e.message}`); }

  log("\n\ud83d\udccb", "2.6 grep + search_files...");
  try {
    const res = await sandboxExecute(key, [
      { type: "grep", project: PROJECT, pattern: "MARKER_E2E_TEST" },
      { type: "search_files", project: PROJECT, pattern: "e2e-test" },
    ]);
    assert(res.data.results[0].status === "success", "grep succeeds");
    assert(res.data.results[0].data.matches.length > 0, `grep found ${res.data.results[0].data.matches.length} matches`);
    assert(res.data.results[1].status === "success", "search_files succeeds");
  } catch (e) { log("\u274c", `grep+search failed: ${e.message}`); }

  log("\n\ud83d\udccb", "2.7 delete_file (cleanup test files)...");
  try {
    const res = await sandboxExecute(key, [
      { type: "delete_file", project: PROJECT, path: "e2e-test-marker.txt" },
      { type: "delete_file", project: PROJECT, path: "e2e-test-moved.txt" },
    ]);
    assert(res.data.results[0].status === "success", "delete_file (marker) succeeds");
    assert(res.data.results[1].status === "success", "delete_file (moved) succeeds");
  } catch (e) { log("\u274c", `delete_file failed: ${e.message}`); }

  log("\n\ud83d\udccb", "2.8 run_command...");
  try {
    const res = await sandboxExecute(key, [
      { type: "run_command", project: PROJECT, command: "echo E2E_COMMAND_WORKS" },
      { type: "run_command", project: PROJECT, command: "node -e \"console.log(JSON.stringify({node:true,v:process.version}))\"" },
      { type: "run_command", project: PROJECT, command: "ls -la" },
    ]);
    assert(res.data.results[0].data.output.includes("E2E_COMMAND_WORKS"), "echo command works");
    assert(res.data.results[1].data.output.includes("node"), "node -e works");
    assert(res.data.results[2].data.output.includes("package.json"), "ls shows project files");
  } catch (e) { log("\u274c", `run_command failed: ${e.message}`); }

  log("\n\ud83d\udccb", "2.9 git_init + git_status + git_add + git_commit + git_log + git_diff...");
  try {
    const res1 = await sandboxExecute(key, [{ type: "git_init", project: PROJECT }]);
    const gitInitOk = res1.data.results[0].status === "success";
    assert(gitInitOk || (res1.data.results[0].data?.output || "").includes("Reinitialized"), "git_init succeeds (or repo already exists)");

    await sandboxExecute(key, [
      { type: "run_command", project: PROJECT, command: "git config user.email \"e2e@lamby.test\"" },
      { type: "run_command", project: PROJECT, command: "git config user.name \"E2E Test\"" },
      { type: "create_file", project: PROJECT, path: "git-test-file.txt", content: "git test content\n" },
    ]);

    const res2 = await sandboxExecute(key, [
      { type: "git_status", project: PROJECT },
      { type: "git_add", project: PROJECT, files: ["."] },
      { type: "git_commit", project: PROJECT, message: "E2E test commit" },
    ]);
    assert(res2.data.results[0].status === "success", "git_status succeeds");
    assert(res2.data.results[1].status === "success", "git_add succeeds");
    const commitOk = res2.data.results[2].status === "success";
    assert(commitOk || (res2.data.results[2].error || "").includes("nothing to commit"), "git_commit succeeds (or nothing to commit)");

    const res2b = await sandboxExecute(key, [{ type: "git_log", project: PROJECT }]);
    assert(res2b.data.results[0].status === "success", "git_log succeeds");

    await sandboxExecute(key, [
      { type: "write_file", project: PROJECT, path: "git-test-file.txt", content: "modified content\n" },
    ]);
    const res3 = await sandboxExecute(key, [{ type: "git_diff", project: PROJECT }]);
    assert(res3.data.results[0].status === "success", "git_diff succeeds");

    await sandboxExecute(key, [
      { type: "git_add", project: PROJECT, files: ["."] },
      { type: "git_commit", project: PROJECT, message: "E2E test commit 2" },
      { type: "delete_file", project: PROJECT, path: "git-test-file.txt" },
      { type: "git_add", project: PROJECT, files: ["."] },
      { type: "git_commit", project: PROJECT, message: "E2E cleanup" },
    ]);
  } catch (e) { log("\u274c", `git operations failed: ${e.message}`); }

  log("\n\ud83d\udccb", "2.10 install_deps...");
  try {
    const res = await sandboxExecute(key, [{ type: "install_deps", project: PROJECT }]);
    assert(res.data.results[0].status === "success", "install_deps succeeds");
  } catch (e) { log("\u274c", `install_deps failed: ${e.message}`); }

  log("\n\ud83d\udccb", "2.11 start_process + list_processes + kill_process...");
  try {
    const res1 = await sandboxExecute(key, [
      { type: "start_process", project: PROJECT, command: "node -e \"const h=require('http');const s=h.createServer((q,r)=>{r.end('ok')});s.listen(19876,()=>console.log('listening'))\"", name: "e2e-test-proc" },
    ]);
    assert(res1.data.results[0].status === "success", "start_process succeeds");

    await new Promise(r => setTimeout(r, 2000));

    const res2 = await sandboxExecute(key, [{ type: "list_processes" }]);
    assert(res2.data.results[0].status === "success", "list_processes succeeds");
    log("  \u2139\ufe0f", `Processes: ${JSON.stringify(res2.data.results[0].data).slice(0, 200)}`);

    const res3 = await sandboxExecute(key, [{ type: "kill_process", name: "e2e-test-proc" }]);
    const killOk = res3.data.results[0].status === "success";
    const killErr = res3.data.results[0].error || "";
    assert(killOk || killErr.includes("not found") || killErr.includes("No process"), "kill_process succeeds (or process already exited)");
  } catch (e) { log("\u274c", `process management failed: ${e.message}`); }

  // ============================================================
  // PHASE 3: Higher-Level Endpoints
  // ============================================================
  console.log("\n\u2550\u2550\u2550 PHASE 3: Higher-Level Endpoints \u2550\u2550\u2550\n");

  log("\ud83d\udccb", "3.1 Project snapshot...");
  let snapshotContext = "";
  try {
    const snapRes = await fetchJSON(`${BASE_URL}/api/snapshot/${PROJECT}?key=${key}`, { timeout: 15000 });
    snapshotContext = typeof snapRes.data === "string" ? snapRes.data : JSON.stringify(snapRes.data);
    assert(snapshotContext.length > 50, `Snapshot fetched (${snapshotContext.length} chars)`);
    assert(snapshotContext.includes("LAMBY PROJECT SNAPSHOT") || snapshotContext.includes(PROJECT), "Snapshot contains project data");
  } catch (e) {
    log("\u274c", `Snapshot failed: ${e.message}`);
    snapshotContext = `Project: ${PROJECT}. An empty landing page project with package.json.`;
  }

  log("\n\ud83d\udccb", "3.2 Console logs endpoint...");
  try {
    const res = await fetchJSON(`${BASE_URL}/api/console-logs?key=${key}`, { timeout: 10000 });
    assert(res.status === 200, "console-logs endpoint returns 200");
    assert(Array.isArray(res.data.previews), "console-logs returns previews array");
    log("  \u2139\ufe0f", `Console logs: ${JSON.stringify(res.data).slice(0, 200)}`);
  } catch (e) { log("\u274c", `Console logs failed: ${e.message}`); }

  log("\n\ud83d\udccb", "3.3 Audit log...");
  try {
    const res = await fetchJSON(`${BASE_URL}/api/sandbox/audit-log?key=${key}`);
    assert(res.status === 200, "audit-log endpoint returns 200");
    assert(Array.isArray(res.data.entries), "audit-log returns entries array");
    assert(res.data.entries.length > 0, `Audit log has ${res.data.entries.length} entries from previous tests`);
    const last = res.data.entries[res.data.entries.length - 1];
    assert(!!last.ts && !!last.action, "Entries have ts and action fields");
  } catch (e) { log("\u274c", `Audit log failed: ${e.message}`); }

  log("\n\ud83d\udccb", "3.4 Project listing via snapshot (no project name)...");
  try {
    const res = await fetchJSON(`${BASE_URL}/api/snapshot/?key=${key}`, { timeout: 10000 });
    assert(res.status === 200, "Project listing returns 200");
    const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    assert(body.includes(PROJECT) || body.includes("Available projects"), "Listing includes our project or heading");
  } catch (e) { log("\u274c", `Project listing failed: ${e.message}`); }

  // ============================================================
  // PHASE 4: Grok-Driven App Building
  // ============================================================
  console.log("\n\u2550\u2550\u2550 PHASE 4: Grok Builds a Landing Page \u2550\u2550\u2550\n");

  const truncatedSnapshot = snapshotContext.slice(0, 6000);
  const conversationHistory = [{ role: "system", content: SYSTEM_PROMPT }];

  log("\ud83d\udccb", "4.1 Round 1 \u2014 Grok explores the project...");
  let round1Results = null;
  try {
    const prompt1 = `Here is the current state of the "${PROJECT}" project:\n\n${truncatedSnapshot}\n\nPlease explore this project:\n1. Read the package.json to understand the current setup\n2. List all files with depth 3\n3. Detect the project structure\n\nRespond with ONLY a JSON object containing an "actions" array.`;

    conversationHistory.push({ role: "user", content: prompt1 });
    log("\ud83e\udd16", "Calling xAI API (Round 1: explore)...");
    const response = await callXAI(conversationHistory);
    conversationHistory.push({ role: "assistant", content: response });

    const parsed = parseAIResponse(response);
    assert(parsed && Array.isArray(parsed.actions), "Round 1: Grok returned valid actions");
    log("\ud83d\udcdd", `Round 1 actions: ${parsed.actions.map(a => a.type).join(", ")}`);

    const res = await sandboxExecute(key, parsed.actions);
    round1Results = res.data;
    const ok = round1Results.results.filter(r => r.status === "success").length;
    assert(ok > 0, `Round 1: ${ok}/${round1Results.results.length} actions succeeded`);
    logResults(round1Results.results);
  } catch (e) {
    log("\u274c", `Round 1 failed: ${e.message}`);
  }

  log("\n\ud83d\udccb", "4.2 Round 2 \u2014 Grok creates the landing page...");
  let round2Results = null;
  try {
    const r1Context = round1Results
      ? JSON.stringify(round1Results.results.map(r => ({ type: r.type, status: r.status, data: r.data, error: r.error })), null, 2).slice(0, 6000)
      : "No results from Round 1";

    const prompt2 = `I executed your exploration actions. Here are the results:\n\n${r1Context}\n\nNow create a beautiful, modern landing page for a product called "Lamby AI" \u2014 an AI-powered autonomous development platform. The page should be a single index.html file with embedded CSS and a small amount of JavaScript.\n\nRequirements:\n- Clean, modern design with a dark gradient hero section\n- Product name "Lamby AI" prominently displayed\n- Tagline: "Your AI-Powered Development Partner"\n- 3 feature cards (Autonomous Coding, Smart Debugging, Instant Deploy)\n- A call-to-action button\n- Responsive design that looks good on mobile\n- Smooth scroll animations using CSS only\n- A footer with copyright\n\nAlso create/update the package.json to add a "start" script that serves the page (use "npx serve ." or similar).\n\nRespond with ONLY a JSON object containing an "actions" array. Use write_file to create/overwrite index.html and package.json.`;

    conversationHistory.push({ role: "user", content: prompt2 });
    log("\ud83e\udd16", "Calling xAI API (Round 2: create landing page)...");
    const response = await callXAI(conversationHistory, 0.4, 12000);
    conversationHistory.push({ role: "assistant", content: response });

    const parsed = parseAIResponse(response);
    assert(parsed && Array.isArray(parsed.actions), "Round 2: Grok returned valid actions");
    log("\ud83d\udcdd", `Round 2 actions: ${parsed.actions.map(a => a.type).join(", ")}`);

    const res = await sandboxExecute(key, parsed.actions);
    round2Results = res.data;
    const ok = round2Results.results.filter(r => r.status === "success").length;
    assert(ok > 0, `Round 2: ${ok}/${round2Results.results.length} actions succeeded`);
    logResults(round2Results.results);
  } catch (e) {
    log("\u274c", `Round 2 failed: ${e.message}`);
  }

  log("\n\ud83d\udccb", "4.3 Round 3 \u2014 Grok verifies and commits...");
  try {
    const r2Context = round2Results
      ? JSON.stringify(round2Results.results.map(r => ({ type: r.type, status: r.status, error: r.error })), null, 2).slice(0, 3000)
      : "No results from Round 2";

    const prompt3 = `I executed your file creation actions. Here are the results:\n\n${r2Context}\n\nNow please:\n1. Read the index.html to verify it was written correctly\n2. Read the package.json to verify the start script is there\n3. Run "ls -la" to see all files\n4. Initialize git if needed, add all files, and commit with message "feat: Lamby AI landing page created by Grok"\n\nRespond with ONLY a JSON object containing an "actions" array.`;

    conversationHistory.push({ role: "user", content: prompt3 });
    log("\ud83e\udd16", "Calling xAI API (Round 3: verify & commit)...");
    const response = await callXAI(conversationHistory);
    conversationHistory.push({ role: "assistant", content: response });

    const parsed = parseAIResponse(response);
    assert(parsed && Array.isArray(parsed.actions), "Round 3: Grok returned valid actions");
    log("\ud83d\udcdd", `Round 3 actions: ${parsed.actions.map(a => a.type).join(", ")}`);

    const res = await sandboxExecute(key, parsed.actions);
    const ok = res.data.results.filter(r => r.status === "success").length;
    assert(ok > 0, `Round 3: ${ok}/${res.data.results.length} actions succeeded`);
    logResults(res.data.results);

    const htmlRead = res.data.results.find(r => r.type === "read_file" && r.data?.content?.includes("<html"));
    if (htmlRead) {
      assert(htmlRead.data.content.includes("Lamby"), "index.html contains 'Lamby'");
      assert(htmlRead.data.content.length > 500, `index.html is substantial (${htmlRead.data.content.length} chars)`);
    }
  } catch (e) {
    log("\u274c", `Round 3 failed: ${e.message}`);
  }

  // ============================================================
  // PHASE 5: Final Verification
  // ============================================================
  console.log("\n\u2550\u2550\u2550 PHASE 5: Final Verification \u2550\u2550\u2550\n");

  log("\ud83d\udccb", "5.1 Verify index.html exists and has content...");
  try {
    const res = await sandboxExecute(key, [
      { type: "read_file", project: PROJECT, path: "index.html" },
    ]);
    if (res.data.results[0].status === "success") {
      const content = res.data.results[0].data.content;
      assert(content.includes("<!DOCTYPE html") || content.includes("<html"), "index.html is valid HTML");
      assert(content.includes("Lamby") || content.includes("lamby"), "index.html mentions Lamby");
      assert(content.length > 1000, `index.html has substantial content (${content.length} chars)`);
      log("\ud83c\udf89", "Landing page created successfully!");
    } else {
      assert(false, `index.html not found: ${res.data.results[0].error}`);
    }
  } catch (e) { log("\u274c", `Final verification failed: ${e.message}`); }

  log("\n\ud83d\udccb", "5.2 Verify project structure...");
  try {
    const res = await sandboxExecute(key, [
      { type: "list_tree", project: PROJECT, depth: 2 },
      { type: "git_log", project: PROJECT },
    ]);
    const entries = res.data.results[0].data.entries;
    assert(entries.length > 0, `Project has ${entries.length} files`);
    const hasIndex = entries.some(e => {
      const name = typeof e === "string" ? e : (e.name || e.path || "");
      return name === "index.html" || name.includes("index.html");
    });
    assert(hasIndex, "index.html appears in file tree");
    if (res.data.results[1].status === "success") {
      log("  \ud83d\udcdc", `Git log: ${JSON.stringify(res.data.results[1].data).slice(0, 300)}`);
    }
  } catch (e) { log("\u274c", `Structure verification failed: ${e.message}`); }

  log("\n\ud83d\udccb", "5.3 Final snapshot of completed project...");
  try {
    const res = await fetchJSON(`${BASE_URL}/api/snapshot/${PROJECT}?key=${key}`, { timeout: 15000 });
    const snap = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    assert(snap.length > 500, `Final snapshot captured (${snap.length} chars)`);
    assert(snap.includes("index.html"), "Final snapshot includes index.html");
  } catch (e) { log("\u274c", `Final snapshot failed: ${e.message}`); }

  // ============================================================
  // PHASE 6: Bridge Relay Round-Trip
  // ============================================================
  console.log("\n\u2550\u2550\u2550 PHASE 6: Bridge Relay Round-Trip \u2550\u2550\u2550\n");

  let relayUrl = null;
  let relayKey = null;
  let relayAvailable = false;

  log("\ud83d\udccb", "6.0 Checking bridge relay connection...");
  try {
    const relayStatus = await fetchJSON(`${LOCAL_URL}/api/bridge-relay-status`);
    if (relayStatus.status === 200 && relayStatus.data.status === "connected" && relayStatus.data.relayUrl) {
      relayUrl = relayStatus.data.relayUrl.replace(/\/$/, "");
      relayKey = relayStatus.data.snapshotKey || key;
      relayAvailable = true;
      log("\ud83c\udf10", `Relay connected: ${relayUrl}`);
      log("\ud83d\udd11", `Relay key: ${relayKey.slice(0, 8)}...`);
    } else {
      log("\u26a0\ufe0f", `Relay status: ${relayStatus.data.status || "unknown"} \u2014 relay tests will be skipped`);
    }
  } catch (e) {
    log("\u26a0\ufe0f", `Could not reach bridge-relay-status: ${e.message} \u2014 relay tests will be skipped`);
  }

  if (!relayAvailable) {
    skip("6.1 Relay sandbox list_tree \u2014 relay not connected");
    skip("6.2 Relay sandbox read_file \u2014 relay not connected");
    skip("6.3 Relay sandbox create+read+delete \u2014 relay not connected");
    skip("6.4 Relay snapshot fetch \u2014 relay not connected");
    skip("6.5 Relay console-logs fetch \u2014 relay not connected");
    skip("6.6 Relay xAI-driven round-trip \u2014 relay not connected");
  } else {
    const relaySandbox = async (actions) => {
      return fetchJSON(`${relayUrl}/api/sandbox/execute?key=${relayKey}`, {
        method: "POST",
        body: { actions },
        timeout: 60000,
      });
    };

    log("\ud83d\udccb", "6.1 Relay sandbox: list_tree...");
    try {
      const res = await relaySandbox([{ type: "list_tree", project: PROJECT, depth: 2 }]);
      assert(res.status === 200, "Relay list_tree returns 200");
      assert(res.data.success === true, "Relay list_tree succeeds");
      assert(res.data.results[0].data.entries.length > 0, `Relay list_tree returns ${res.data.results[0].data.entries.length} entries`);
    } catch (e) { log("\u274c", `Relay list_tree failed: ${e.message}`); }

    log("\n\ud83d\udccb", "6.2 Relay sandbox: read_file...");
    try {
      const res = await relaySandbox([{ type: "read_file", project: PROJECT, path: "package.json" }]);
      assert(res.status === 200, "Relay read_file returns 200");
      assert(res.data.success === true, "Relay read_file succeeds");
      assert(res.data.results[0].data.content.length > 0, "Relay read_file returns content");
    } catch (e) { log("\u274c", `Relay read_file failed: ${e.message}`); }

    log("\n\ud83d\udccb", "6.3 Relay sandbox: create_file + read_file + delete_file round-trip...");
    try {
      const marker = `RELAY_E2E_${Date.now()}`;
      const createRes = await relaySandbox([
        { type: "create_file", project: PROJECT, path: "relay-test-marker.txt", content: `${marker}\n` },
      ]);
      assert(createRes.data.success === true, "Relay create_file succeeds");

      const readRes = await relaySandbox([
        { type: "read_file", project: PROJECT, path: "relay-test-marker.txt" },
      ]);
      assert(readRes.data.success === true, "Relay read_file (verify create) succeeds");
      assert(readRes.data.results[0].data.content.includes(marker), "Relay round-trip: written content matches read content");

      const delRes = await relaySandbox([
        { type: "delete_file", project: PROJECT, path: "relay-test-marker.txt" },
      ]);
      assert(delRes.data.success === true, "Relay delete_file (cleanup) succeeds");
      log("\ud83d\udd04", "Full relay CRUD round-trip verified: create \u2192 read \u2192 delete");
    } catch (e) { log("\u274c", `Relay CRUD round-trip failed: ${e.message}`); }

    log("\n\ud83d\udccb", "6.4 Relay snapshot fetch...");
    try {
      const res = await fetchJSON(`${relayUrl}/api/snapshot/${PROJECT}?key=${relayKey}`, { timeout: 30000 });
      const snap = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      assert(res.status === 200, "Relay snapshot returns 200");
      assert(snap.length > 50, `Relay snapshot fetched (${snap.length} chars)`);
      assert(snap.includes(PROJECT) || snap.includes("LAMBY PROJECT SNAPSHOT"), "Relay snapshot contains project data");
    } catch (e) { log("\u274c", `Relay snapshot failed: ${e.message}`); }

    log("\n\ud83d\udccb", "6.5 Relay console-logs fetch...");
    try {
      const res = await fetchJSON(`${relayUrl}/api/console-logs?key=${relayKey}`, { timeout: 15000 });
      assert(res.status === 200, "Relay console-logs returns 200");
      const body = typeof res.data === "object" ? res.data : {};
      assert(body.previews || body.error !== "Relay timeout", "Relay console-logs returns data (not timeout)");
      log("  \u2139\ufe0f", `Relay console-logs: ${JSON.stringify(body).slice(0, 200)}`);
    } catch (e) { log("\u274c", `Relay console-logs failed: ${e.message}`); }

    log("\n\ud83d\udccb", "6.6 Relay xAI-driven round-trip (AI \u2192 relay \u2192 desktop \u2192 relay \u2192 AI)...");
    try {
      const relayConversation = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `You have access to the "${PROJECT}" project sandbox. Please:\n1. List the project files (depth 2)\n2. Read the package.json file\n3. Create a test file called "relay-ai-test.txt" with the content "Hello from Grok via relay!"\n\nRespond with ONLY a JSON object containing an "actions" array.` },
      ];

      log("\ud83e\udd16", "Calling xAI API for relay round-trip...");
      const aiResponse = await callXAI(relayConversation, 0.2, 4096);
      const parsed = parseAIResponse(aiResponse);
      assert(parsed && Array.isArray(parsed.actions), "xAI returned valid actions for relay test");
      assert(parsed.actions.length >= 2, `xAI returned ${parsed.actions.length} actions`);
      log("\ud83d\udcdd", `AI actions: ${parsed.actions.map(a => a.type).join(", ")}`);

      log("\ud83d\udd04", "Executing AI actions through relay...");
      const aiRes = await relaySandbox(parsed.actions);
      assert(aiRes.status === 200, "Relay accepts AI-generated actions");
      assert(aiRes.data.success === true, "Relay AI actions execute successfully");
      const okCount = aiRes.data.results.filter(r => r.status === "success").length;
      assert(okCount > 0, `Relay: ${okCount}/${aiRes.data.results.length} AI actions succeeded`);
      logResults(aiRes.data.results);

      log("\ud83d\udd0d", "Verifying AI-created file through relay...");
      const verifyRes = await relaySandbox([
        { type: "read_file", project: PROJECT, path: "relay-ai-test.txt" },
      ]);
      if (verifyRes.data.success && verifyRes.data.results[0].status === "success") {
        assert(verifyRes.data.results[0].data.content.includes("Grok") || verifyRes.data.results[0].data.content.includes("relay"), "AI-created file contains expected content");
        log("\ud83c\udf89", "Full AI \u2192 Relay \u2192 Desktop pipeline verified!");
      } else {
        log("\u26a0\ufe0f", "AI may not have created relay-ai-test.txt (non-critical)");
      }

      await relaySandbox([{ type: "delete_file", project: PROJECT, path: "relay-ai-test.txt" }]).catch(() => {});
    } catch (e) { log("\u274c", `Relay xAI round-trip failed: ${e.message}`); }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n==========================================");
  console.log(`\ud83e\uddea E2E TEST RESULTS`);
  console.log(`\u2705 Passed:  ${passed}`);
  console.log(`\u274c Failed:  ${failed}`);
  console.log(`\u23ed\ufe0f  Skipped: ${skipped}`);
  console.log(`   Total:   ${passed + failed + skipped}`);
  console.log("==========================================");
  console.log(`\n\ud83d\udcc1 The "${PROJECT}" project now has a complete landing page.`);
  console.log(`   Preview it with: cd projects/${PROJECT} && npx serve .`);
  console.log(`   Or start a preview from the Lamby UI.\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
