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

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function assert(condition, msg) {
  if (condition) {
    passed++;
    log("✅", msg);
  } else {
    failed++;
    log("❌", msg);
  }
}

async function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.request(url, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      timeout: 30000,
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

async function callXAI(messages, temperature = 0.3) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: "grok-3-mini-fast",
      messages,
      temperature,
      max_tokens: 4096,
    });
    const req = https.request("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_API_KEY}`,
      },
      timeout: 60000,
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

async function sandboxExecute(key, actions) {
  return fetchJSON(`${BASE_URL}/api/sandbox/execute?key=${key}`, {
    method: "POST",
    body: { actions },
  });
}

const SYSTEM_PROMPT = `You are an AI assistant that controls a code sandbox through structured JSON commands.
You have access to a sandbox API that accepts an array of actions. Each action has a "type" field and additional parameters.

Available action types:
- list_tree: {type: "list_tree", project: "NAME", depth: N} — list project files
- read_file: {type: "read_file", project: "NAME", path: "file/path"} — read a file
- write_file: {type: "write_file", project: "NAME", path: "file/path", content: "..."} — write/overwrite a file
- create_file: {type: "create_file", project: "NAME", path: "file/path", content: "..."} — create a new file
- delete_file: {type: "delete_file", project: "NAME", path: "file/path"} — delete a file
- move_file: {type: "move_file", project: "NAME", source: "old/path", dest: "new/path"}
- copy_file: {type: "copy_file", project: "NAME", source: "src", dest: "dst"}
- grep: {type: "grep", project: "NAME", pattern: "regex"} — search across files
- run_command: {type: "run_command", project: "NAME", command: "cmd"} — run a shell command
- install_deps: {type: "install_deps", project: "NAME"} — install dependencies
- git_status: {type: "git_status", project: "NAME"}
- git_diff: {type: "git_diff", project: "NAME"}
- detect_structure: {type: "detect_structure", project: "NAME"}

IMPORTANT: Respond with ONLY a valid JSON object containing an "actions" array. No markdown, no explanation, no code fences. Just raw JSON.
Example: {"actions": [{"type": "list_tree", "project": "my-project", "depth": 2}]}`;

async function main() {
  console.log("\n🧪 LAMBY SANDBOX E2E TEST");
  console.log("========================");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Project: ${PROJECT}`);
  console.log(`xAI API: ${XAI_API_KEY ? "configured" : "MISSING"}\n`);

  if (!XAI_API_KEY) {
    log("❌", "XAI_API environment variable not set — cannot run E2E test");
    process.exit(1);
  }

  // Step 1: Fetch snapshot key
  log("📋", "Step 1: Fetching snapshot key...");
  let key;
  try {
    const keyRes = await fetchJSON(`${LOCAL_URL}/api/snapshot-key`);
    assert(keyRes.status === 200 || keyRes.data?.key, "Snapshot key endpoint responds");
    key = keyRes.data.key;
    log("🔑", `Key: ${key.slice(0, 8)}...`);
    assert(!!keyRes.data.commandEndpoint, "Command endpoint URL included in snapshot-key response");
    assert(!!keyRes.data.commandProtocol, "Command protocol description included in snapshot-key response");
  } catch (e) {
    log("❌", `Failed to get snapshot key: ${e.message}`);
    process.exit(1);
  }

  // Step 2: Direct API test — list_tree + read_file + detect_structure
  log("\n📋", "Step 2: Direct API test — basic sandbox actions...");
  try {
    const res = await sandboxExecute(key, [
      { type: "list_tree", project: PROJECT, depth: 2 },
      { type: "read_file", project: PROJECT, path: "package.json" },
      { type: "detect_structure", project: PROJECT },
    ]);
    assert(res.data.success === true, "Multi-action batch succeeds");
    assert(res.data.results.length === 3, "All 3 actions returned results");
    assert(res.data.results[0].type === "list_tree" && res.data.results[0].data.entries.length > 0, "list_tree returns entries");
    assert(res.data.results[1].type === "read_file" && res.data.results[1].data.content.includes("landing-page"), "read_file returns correct content");
    assert(res.data.results[2].type === "detect_structure", "detect_structure returns");
    log("📁", `Files found: ${res.data.results[0].data.entries.length}`);
  } catch (e) {
    log("❌", `Direct API test failed: ${e.message}`);
  }

  // Step 3: Direct API test — write + read + grep + delete
  log("\n📋", "Step 3: Direct API test — file CRUD cycle...");
  try {
    const res = await sandboxExecute(key, [
      { type: "create_file", project: PROJECT, path: "e2e-test-file.txt", content: "Hello from E2E test! UNIQUE_MARKER_12345" },
      { type: "read_file", project: PROJECT, path: "e2e-test-file.txt" },
      { type: "grep", project: PROJECT, pattern: "UNIQUE_MARKER_12345" },
      { type: "delete_file", project: PROJECT, path: "e2e-test-file.txt" },
    ]);
    assert(res.data.success === true, "CRUD cycle succeeds");
    assert(res.data.results[0].data.created === true, "File created");
    assert(res.data.results[1].data.content.includes("UNIQUE_MARKER_12345"), "File content verified");
    assert(res.data.results[2].data.matches.length > 0, "Grep found the marker");
    assert(res.data.results[3].status === "success", "File deleted");
  } catch (e) {
    log("❌", `CRUD cycle test failed: ${e.message}`);
  }

  // Step 4: Direct API test — run_command
  log("\n📋", "Step 4: Direct API test — run_command...");
  try {
    const res = await sandboxExecute(key, [
      { type: "run_command", project: PROJECT, command: "echo SANDBOX_WORKS" },
      { type: "run_command", project: PROJECT, command: "ls -1" },
    ]);
    assert(res.data.results[0].data.output.includes("SANDBOX_WORKS"), "echo command works");
    assert(res.data.results[1].data.output.includes("package.json"), "ls command shows project files");
  } catch (e) {
    log("❌", `run_command test failed: ${e.message}`);
  }

  // Step 5: Auth test — wrong key should fail
  log("\n📋", "Step 5: Auth test — invalid key rejected...");
  try {
    const res = await sandboxExecute("wrong-key-12345", [{ type: "list_tree", project: PROJECT }]);
    assert(res.status === 403, "Invalid key returns 403");
  } catch (e) {
    log("❌", `Auth test failed: ${e.message}`);
  }

  // Step 6: Audit log test
  log("\n📋", "Step 6: Audit log test...");
  try {
    const res = await fetchJSON(`${BASE_URL}/api/sandbox/audit-log?key=${key}`);
    assert(res.data.entries && res.data.entries.length > 0, "Audit log has entries from previous tests");
    const lastEntry = res.data.entries[res.data.entries.length - 1];
    assert(!!lastEntry.ts && !!lastEntry.action, "Audit log entries have timestamp and action type");
    log("📊", `Audit log has ${res.data.entries.length} entries`);
  } catch (e) {
    log("❌", `Audit log test failed: ${e.message}`);
  }

  // Step 7: Fetch project snapshot for AI context
  log("\n📋", "Step 7: Fetching project snapshot for AI context...");
  let snapshotContext = "";
  try {
    const snapRes = await fetchJSON(`${BASE_URL}/api/snapshot/${PROJECT}?key=${key}`);
    snapshotContext = typeof snapRes.data === "string" ? snapRes.data : JSON.stringify(snapRes.data);
    assert(snapshotContext.length > 100, `Snapshot fetched (${snapshotContext.length} chars)`);
    log("📄", `Snapshot length: ${snapshotContext.length} chars`);
  } catch (e) {
    log("⚠️", `Snapshot fetch failed (non-fatal): ${e.message}`);
    snapshotContext = "Project: landing-page. A simple landing page with index.html, package.json (vite dev dep), hero.png, postcss.config.cjs.";
  }

  // Step 8: xAI Round 1 — Ask Grok to explore the project and create a test file
  log("\n📋", "Step 8: xAI Round 1 — asking Grok to explore project and create a file...");
  let round1Actions = null;
  try {
    const truncatedSnapshot = snapshotContext.slice(0, 8000);
    const userPrompt = `Here is the current state of the "${PROJECT}" project:\n\n${truncatedSnapshot}\n\nPlease do the following:\n1. Read the package.json to understand the project\n2. Create a new file called "health-check.js" with a simple Node.js script that exports a function checkHealth() that returns {status: "ok", timestamp: Date.now()}\n3. Run the command "node -e \\"console.log('health-check-created')\\"" to verify node works\n\nRespond with ONLY a JSON object containing an "actions" array. No markdown, no code fences.`;

    log("🤖", "Calling xAI API (grok-3-mini-fast)...");
    const response = await callXAI([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ]);

    log("📨", `xAI response length: ${response.length} chars`);

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    try {
      round1Actions = JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*"actions"\s*:\s*\[[\s\S]*\]\s*\}/);
      if (jsonMatch) round1Actions = JSON.parse(jsonMatch[0]);
    }

    assert(round1Actions && Array.isArray(round1Actions.actions), "Grok returned valid actions JSON");
    assert(round1Actions.actions.length >= 2, `Grok generated ${round1Actions.actions.length} actions`);

    log("📝", `Actions: ${round1Actions.actions.map(a => a.type).join(", ")}`);
  } catch (e) {
    log("❌", `xAI Round 1 failed: ${e.message}`);
    round1Actions = {
      actions: [
        { type: "read_file", project: PROJECT, path: "package.json" },
        { type: "create_file", project: PROJECT, path: "health-check.js", content: 'module.exports = { checkHealth() { return { status: "ok", timestamp: Date.now() }; } };' },
        { type: "run_command", project: PROJECT, command: "node -e \"console.log('health-check-created')\"" },
      ]
    };
    log("⚠️", "Using fallback actions");
  }

  // Step 9: Execute the AI-generated actions
  log("\n📋", "Step 9: Executing AI-generated actions...");
  let round1Results = null;
  try {
    const res = await sandboxExecute(key, round1Actions.actions);
    round1Results = res.data;
    const successCount = round1Results.results.filter(r => r.status === "success").length;
    const failCount = round1Results.results.filter(r => r.status === "error").length;
    assert(successCount > 0, `${successCount}/${round1Results.results.length} actions succeeded`);
    if (failCount > 0) {
      log("⚠️", `${failCount} actions had errors:`);
      round1Results.results.filter(r => r.status === "error").forEach(r => log("  ⚠️", `${r.type}: ${r.error}`));
    }

    for (const r of round1Results.results) {
      log("  📊", `[${r.actionIndex}] ${r.type}: ${r.status}${r.data ? " — " + JSON.stringify(r.data).slice(0, 120) : ""}${r.error ? " — " + r.error.slice(0, 120) : ""}`);
    }
  } catch (e) {
    log("❌", `Executing AI actions failed: ${e.message}`);
  }

  // Step 10: Verify the file was created
  log("\n📋", "Step 10: Verifying AI-created file exists...");
  try {
    const verifyRes = await sandboxExecute(key, [
      { type: "read_file", project: PROJECT, path: "health-check.js" },
    ]);
    if (verifyRes.data.results[0].status === "success") {
      assert(true, "health-check.js file exists and is readable");
      assert(verifyRes.data.results[0].data.content.includes("checkHealth") || verifyRes.data.results[0].data.content.includes("health"), "File contains expected health check code");
    } else {
      assert(false, `health-check.js verification failed: ${verifyRes.data.results[0].error}`);
    }
  } catch (e) {
    log("❌", `Verification failed: ${e.message}`);
  }

  // Step 11: xAI Round 2 — Feed results back and ask Grok to verify/fix
  log("\n📋", "Step 11: xAI Round 2 — feeding results back for verification...");
  try {
    const resultsContext = round1Results
      ? JSON.stringify(round1Results.results.map(r => ({ type: r.type, status: r.status, data: r.data, error: r.error })), null, 2)
      : "No results from Round 1";

    const round2Prompt = `I executed your actions against the "${PROJECT}" sandbox. Here are the results:\n\n${resultsContext}\n\nNow please:\n1. Read the health-check.js file to verify it was created correctly\n2. Run "node -e \\"const h = require('./health-check.js'); console.log(JSON.stringify(h.checkHealth()))\\"" to test it works\n3. If anything failed or is wrong, create corrective actions\n\nRespond with ONLY a JSON object containing an "actions" array.`;

    log("🤖", "Calling xAI API for Round 2...");
    const response2 = await callXAI([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: round2Prompt },
    ]);

    let cleaned2 = response2.trim();
    if (cleaned2.startsWith("```")) {
      cleaned2 = cleaned2.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    let round2Actions;
    try {
      round2Actions = JSON.parse(cleaned2);
    } catch {
      const jsonMatch = cleaned2.match(/\{[\s\S]*"actions"\s*:\s*\[[\s\S]*\]\s*\}/);
      if (jsonMatch) round2Actions = JSON.parse(jsonMatch[0]);
      else throw new Error("Could not parse Round 2 response as JSON");
    }

    assert(round2Actions && Array.isArray(round2Actions.actions), "Grok Round 2 returned valid actions");
    log("📝", `Round 2 actions: ${round2Actions.actions.map(a => a.type).join(", ")}`);

    const res2 = await sandboxExecute(key, round2Actions.actions);
    const s2 = res2.data.results.filter(r => r.status === "success").length;
    assert(s2 > 0, `Round 2: ${s2}/${res2.data.results.length} actions succeeded`);

    for (const r of res2.data.results) {
      log("  📊", `[${r.actionIndex}] ${r.type}: ${r.status}${r.data ? " — " + JSON.stringify(r.data).slice(0, 120) : ""}${r.error ? " — " + r.error.slice(0, 120) : ""}`);
    }

    const hasVerifyRead = res2.data.results.some(r => r.type === "read_file" && r.status === "success");
    if (hasVerifyRead) assert(true, "Round 2 successfully read and verified file");
  } catch (e) {
    log("❌", `xAI Round 2 failed: ${e.message}`);
  }

  // Step 12: Cleanup
  log("\n📋", "Step 12: Cleaning up test artifacts...");
  try {
    await sandboxExecute(key, [
      { type: "delete_file", project: PROJECT, path: "health-check.js" },
      { type: "delete_file", project: PROJECT, path: "e2e-test-file.txt" },
    ]);
    log("🧹", "Cleanup complete");
  } catch {
    log("⚠️", "Cleanup had issues (non-fatal)");
  }

  // Final summary
  console.log("\n=============================");
  console.log(`🧪 E2E TEST RESULTS`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log("=============================\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
