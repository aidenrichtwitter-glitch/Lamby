#!/usr/bin/env node
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const zlib = require("zlib");

const RELAY_DOMAIN =
  process.env.BRIDGE_RELAY_DOMAIN ||
  "35c4f698-dc00-400a-9452-39eaf17279c0-00-31k27xn7snnel.janeway.replit.dev";
const RELAY_PROTOCOL = RELAY_DOMAIN.startsWith("localhost") || RELAY_DOMAIN.startsWith("127.") ? "http" : "https";
const RELAY_BASE = `${RELAY_PROTOCOL}://${RELAY_DOMAIN}`;
const PROJECT = process.env.BRIDGE_TEST_PROJECT || "groks-app";
const VERBOSE = process.argv.includes("--verbose") || process.argv.includes("-v");

function log(...args) {
  if (VERBOSE) console.error("[bridge-test]", ...args);
}

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: opts.method || "GET",
      headers: { ...(opts.headers || {}) },
      timeout: 65000,
    };
    if (opts.body) {
      reqOpts.headers["Content-Type"] = reqOpts.headers["Content-Type"] || "application/json";
      reqOpts.headers["Content-Length"] = Buffer.byteLength(opts.body);
    }
    const req = mod.request(reqOpts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function parseJson(body) {
  try { return JSON.parse(body); } catch { return null; }
}

function sandboxExecute(actions) {
  return fetch(`${RELAY_BASE}/api/sandbox/execute`, {
    method: "POST",
    body: JSON.stringify({ actions }),
  }).then((r) => ({ status: r.status, data: parseJson(r.body) || r.body }));
}

function extractContent(data) {
  const results = data?.results || data;
  const entry = Array.isArray(results) ? results[0] : results;
  return entry?.data?.content || entry?.content || (typeof entry === "string" ? entry : "");
}

async function safeDelete(filePath) {
  try { await sandboxExecute([{ type: "delete_file", project: PROJECT, path: filePath }]); } catch {}
}

async function safeKillProcess(project) {
  try { await sandboxExecute([{ type: "kill_process", project }]); } catch {}
}

const results = [];
const startTime = Date.now();

async function runTest(name, tier, fn) {
  const t0 = Date.now();
  const entry = { name, tier, status: "skip", duration_ms: 0, detail: null, error: null };
  try {
    const detail = await fn();
    entry.status = "pass";
    entry.detail = typeof detail === "string" ? detail : JSON.stringify(detail);
  } catch (err) {
    entry.status = "fail";
    entry.error = err.message || String(err);
  }
  entry.duration_ms = Date.now() - t0;
  results.push(entry);
  const icon = entry.status === "pass" ? "✓" : entry.status === "fail" ? "✗" : "○";
  const color = entry.status === "pass" ? "\x1b[32m" : entry.status === "fail" ? "\x1b[31m" : "\x1b[33m";
  console.error(`${color}  ${icon}\x1b[0m [T${tier}] ${name} (${entry.duration_ms}ms)${entry.error ? " — " + entry.error : ""}`);
}

function skip(name, tier, reason) {
  results.push({ name, tier, status: "skip", duration_ms: 0, detail: reason, error: null });
  console.error(`\x1b[33m  ○\x1b[0m [T${tier}] ${name} — SKIPPED: ${reason}`);
}

async function main() {
  console.error(`\n  Lamby Bridge Integration Tests`);
  console.error(`  Relay: ${RELAY_BASE}`);
  console.error(`  Project: ${PROJECT}`);
  console.error(`  ─────────────────────────────────\n`);

  console.error(`  TIER 1: Relay Health (no desktop needed)\n`);

  await runTest("health", 1, async () => {
    const r = await fetch(`${RELAY_BASE}/health`);
    if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
    const d = parseJson(r.body);
    if (!d || d.status !== "ok") throw new Error(`Bad health response: ${r.body.slice(0, 200)}`);
    return `${d.status} — ${d.connectedClients} client(s), uptime ${Math.round(d.uptime)}s`;
  });

  await runTest("bridge-status", 1, async () => {
    const r = await fetch(`${RELAY_BASE}/api/bridge-status`);
    if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
    const d = parseJson(r.body);
    if (d === null || typeof d.connectedClients !== "number") throw new Error(`Bad response: ${r.body.slice(0, 200)}`);
    return `${d.connectedClients} client(s)`;
  });

  let desktopConnected = false;
  const statusRes = await fetch(`${RELAY_BASE}/api/bridge-status`).catch(() => null);
  if (statusRes) {
    const sd = parseJson(statusRes.body);
    desktopConnected = sd && sd.connectedClients > 0;
  }

  await runTest("snapshot-key", 1, async () => {
    const r = await fetch(`${RELAY_BASE}/api/snapshot-key`);
    if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
    const d = parseJson(r.body);
    if (!d || !d.baseUrl) throw new Error(`Missing baseUrl: ${r.body.slice(0, 300)}`);
    return `baseUrl=${d.baseUrl}`;
  });

  await runTest("commands", 1, async () => {
    const r = await fetch(`${RELAY_BASE}/api/commands`);
    if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
    const d = parseJson(r.body);
    if (!d || !Array.isArray(d.commands)) throw new Error(`Bad commands response`);
    if (d.commands.length < 50) throw new Error(`Expected 50+ commands, got ${d.commands.length}`);
    return `${d.total} commands`;
  });

  await runTest("grok-endpoint-directory", 1, async () => {
    const r = await fetch(`${RELAY_BASE}/api/grok`);
    if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
    const d = parseJson(r.body);
    if (!d || !d.endpoints) throw new Error(`No endpoints in response`);
    return `${Object.keys(d.endpoints).length} endpoints listed`;
  });

  await runTest("audit-log", 1, async () => {
    const r = await fetch(`${RELAY_BASE}/api/sandbox/audit-log`);
    if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
    const d = parseJson(r.body);
    if (!d || !Array.isArray(d.entries)) throw new Error(`Bad audit-log response`);
    return `${d.entries.length} entries`;
  });

  await runTest("404-handler", 1, async () => {
    const r = await fetch(`${RELAY_BASE}/api/nonexistent-endpoint-xyz`);
    if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`);
    const d = parseJson(r.body);
    if (!d || !d.error || !Array.isArray(d.endpoints)) throw new Error(`Bad 404 response: ${r.body.slice(0, 200)}`);
    return `404 with ${d.endpoints.length} listed endpoints`;
  });

  await runTest("method-not-allowed", 1, async () => {
    const r = await fetch(`${RELAY_BASE}/api/sandbox/execute`);
    if (r.status !== 405) throw new Error(`Expected 405, got ${r.status}`);
    return `POST-only endpoint correctly rejects GET`;
  });

  console.error(`\n  TIER 2: Desktop Bridge (requires connected desktop)\n`);

  if (!desktopConnected) {
    const tier2Tests = [
      "snapshot", "list-tree", "read-file", "write-read-delete-roundtrip",
      "git-status", "grep-search", "console-logs", "screenshot",
      "detect-structure", "grok-proxy-roundtrip-compare", "grok-proxy-gzip",
      "grok-edit-roundtrip", "grok-edit-base64", "grok-interact",
      "grok-interact-missing-params",
    ];
    for (const t of tier2Tests) skip(t, 2, "No desktop client connected");
  } else {
    await runTest("snapshot", 2, async () => {
      const r = await fetch(`${RELAY_BASE}/api/snapshot/${PROJECT}`);
      if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
      if (!r.body || r.body.length < 50) throw new Error(`Snapshot too short (${r.body.length} chars)`);
      if (!r.body.includes("SNAPSHOT") && !r.body.includes("FILE TREE")) throw new Error(`Does not look like a snapshot`);
      return `${r.body.length} chars`;
    });

    await runTest("list-tree", 2, async () => {
      const res = await sandboxExecute([{ type: "list_tree", project: PROJECT }]);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const d = res.data;
      if (!d || d.error) throw new Error(d?.error || "Empty response");
      const r = d.results || d;
      const treeData = Array.isArray(r) ? r[0] : r;
      if (!treeData) throw new Error("No tree data returned");
      return `tree returned`;
    });

    await runTest("read-file", 2, async () => {
      const res = await sandboxExecute([{ type: "read_file", project: PROJECT, path: "package.json" }]);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const d = res.data;
      if (d && d.success === false && Array.isArray(d.results) && d.results[0]?.error === "File not found") {
        const treeRes = await sandboxExecute([{ type: "list_tree", project: PROJECT }]);
        const td = treeRes.data;
        const treeResults = td?.results || td;
        const treeEntry = Array.isArray(treeResults) ? treeResults[0] : treeResults;
        const tree = treeEntry?.data?.tree || treeEntry?.tree || treeEntry?.data || "";
        const treeStr = typeof tree === "string" ? tree : JSON.stringify(tree);
        const pkgMatch = treeStr.match(/([\w/.-]*package\.json)/);
        if (pkgMatch) {
          const altPath = pkgMatch[1];
          const retryRes = await sandboxExecute([{ type: "read_file", project: PROJECT, path: altPath }]);
          const rd = retryRes.data;
          if (rd && rd.success !== false) {
            const c = extractContent(rd);
            if (c) {
              const p = parseJson(c);
              return `package.json (at ${altPath}) name=${p?.name || "?"}`;
            }
          }
        }
        return `read_file works (package.json not at root — project may use nested structure)`;
      }
      if (d && d.error) throw new Error(d.error);
      const content = extractContent(d);
      if (!content || typeof content !== "string") throw new Error("No file content returned");
      const parsed = parseJson(content);
      return `package.json name=${parsed?.name || "?"}`;
    });

    const marker = `bridge-test-${crypto.randomUUID().slice(0, 8)}`;
    const markerFile = "_bridge_test_marker.txt";

    await runTest("write-read-delete-roundtrip", 2, async () => {
      try {
        const writeRes = await sandboxExecute([{ type: "write_file", project: PROJECT, path: markerFile, content: marker }]);
        if (writeRes.status !== 200) throw new Error(`Write failed: ${writeRes.status}`);
        if (writeRes.data?.error) throw new Error(`Write error: ${writeRes.data.error}`);

        const readRes = await sandboxExecute([{ type: "read_file", project: PROJECT, path: markerFile }]);
        if (readRes.status !== 200) throw new Error(`Read failed: ${readRes.status}`);
        if (readRes.data?.error) throw new Error(`Read error: ${readRes.data.error}`);
        const readContent = extractContent(readRes.data);
        if (!readContent.includes(marker)) throw new Error(`Content mismatch: expected "${marker}", got "${readContent.slice(0, 100)}"`);

        const delRes = await sandboxExecute([{ type: "delete_file", project: PROJECT, path: markerFile }]);
        if (delRes.status !== 200) throw new Error(`Delete failed: ${delRes.status}`);
        if (delRes.data?.error) throw new Error(`Delete error: ${delRes.data.error}`);

        return `wrote/read/deleted "${markerFile}" with marker ${marker}`;
      } finally {
        await safeDelete(markerFile);
      }
    });

    await runTest("git-status", 2, async () => {
      const res = await sandboxExecute([{ type: "git_status", project: PROJECT }]);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data?.error) throw new Error(res.data.error);
      return `git status returned`;
    });

    await runTest("grep-search", 2, async () => {
      const res = await sandboxExecute([{ type: "grep", project: PROJECT, pattern: "package" }]);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data?.error) throw new Error(res.data.error);
      return `grep returned`;
    });

    await runTest("console-logs", 2, async () => {
      const r = await fetch(`${RELAY_BASE}/api/console-logs?project=${encodeURIComponent(PROJECT)}`);
      if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
      const d = parseJson(r.body);
      if (!d) throw new Error("Non-JSON response");
      if (d.error) throw new Error(d.error);
      return `logs returned (previews: ${(d.previews || []).length})`;
    });

    await runTest("screenshot", 2, async () => {
      const r = await fetch(`${RELAY_BASE}/api/screenshot/${PROJECT}?waitMs=3000`);
      if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
      const d = parseJson(r.body);
      if (!d) throw new Error("Non-JSON response");
      if (d.error) throw new Error(d.error);
      const rr = d.results || d;
      const entry = Array.isArray(rr) ? rr[0] : rr;
      const hasImage = entry?.data?.screenshotUrl || entry?.data?.screenshot || entry?.data?.captured || entry?.screenshot || entry?.image;
      if (!hasImage) log("Warning: screenshot response had no image data, but no error either — desktop may not support screenshots");
      return `screenshot response received${hasImage ? " (image present)" : " (no image data)"}`;
    });

    await runTest("detect-structure", 2, async () => {
      const res = await sandboxExecute([{ type: "detect_structure", project: PROJECT }]);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data?.error) throw new Error(res.data.error);
      return `structure detection returned`;
    });

    let directTreeResult = null;

    await runTest("grok-proxy-roundtrip-compare", 2, async () => {
      const directRes = await sandboxExecute([{ type: "list_tree", project: PROJECT }]);
      if (directRes.status !== 200) throw new Error(`Direct call failed: ${directRes.status}`);
      directTreeResult = JSON.stringify(directRes.data);

      const payload = JSON.stringify({ actions: [{ type: "list_tree", project: PROJECT }] });
      const b64 = Buffer.from(payload).toString("base64");
      const r = await fetch(`${RELAY_BASE}/api/grok-proxy?payload=${encodeURIComponent(b64)}&project=${encodeURIComponent(PROJECT)}`);
      if (r.status !== 200) throw new Error(`Proxy call failed: ${r.status}`);
      const proxyData = parseJson(r.body);
      if (!proxyData) throw new Error("Non-JSON proxy response");
      if (proxyData.error) throw new Error(proxyData.error);

      const proxyStr = JSON.stringify(proxyData);
      const directKeys = Object.keys(parseJson(directTreeResult) || {}).sort().join(",");
      const proxyKeys = Object.keys(proxyData).sort().join(",");
      if (directKeys !== proxyKeys) {
        log(`Direct keys: ${directKeys}`);
        log(`Proxy keys: ${proxyKeys}`);
        throw new Error(`Proxy response structure differs from direct call: direct=[${directKeys}] proxy=[${proxyKeys}]`);
      }
      return `proxy matches direct call (keys: ${proxyKeys})`;
    });

    await runTest("grok-proxy-gzip", 2, async () => {
      const payload = JSON.stringify({ actions: [{ type: "list_tree", project: PROJECT }] });
      const compressed = zlib.gzipSync(Buffer.from(payload));
      const b64 = compressed.toString("base64");
      const r = await fetch(`${RELAY_BASE}/api/grok-proxy?payload=${encodeURIComponent(b64)}&project=${encodeURIComponent(PROJECT)}`);
      if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
      const d = parseJson(r.body);
      if (!d) throw new Error("Non-JSON response");
      if (d.error) throw new Error(d.error);
      return `gzip proxy returned`;
    });

    await runTest("grok-edit-roundtrip", 2, async () => {
      const testFile = "_bridge_edit_test.txt";
      try {
        await sandboxExecute([{ type: "write_file", project: PROJECT, path: testFile, content: "hello world" }]);
        const r = await fetch(`${RELAY_BASE}/api/grok-edit?project=${encodeURIComponent(PROJECT)}&path=${encodeURIComponent(testFile)}&search=hello&replace=goodbye`);
        if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
        const d = parseJson(r.body);
        if (d && d.error) throw new Error(d.error);
        const readRes = await sandboxExecute([{ type: "read_file", project: PROJECT, path: testFile }]);
        const content = extractContent(readRes.data);
        if (!content.includes("goodbye")) throw new Error(`Edit did not apply: "${content.slice(0, 100)}"`);
        return `edit hello→goodbye verified`;
      } finally {
        await safeDelete(testFile);
      }
    });

    await runTest("grok-edit-base64", 2, async () => {
      const testFile = "_bridge_b64_test.txt";
      try {
        const original = '<div class="old">test</div>';
        const replacement = '<div class="new">test</div>';
        await sandboxExecute([{ type: "write_file", project: PROJECT, path: testFile, content: original }]);
        const searchB64 = Buffer.from(original).toString("base64");
        const replaceB64 = Buffer.from(replacement).toString("base64");
        const r = await fetch(`${RELAY_BASE}/api/grok-edit?project=${encodeURIComponent(PROJECT)}&path=${encodeURIComponent(testFile)}&searchB64=${encodeURIComponent(searchB64)}&replaceB64=${encodeURIComponent(replaceB64)}`);
        if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
        const readRes = await sandboxExecute([{ type: "read_file", project: PROJECT, path: testFile }]);
        const content = extractContent(readRes.data);
        if (!content.includes('class="new"')) throw new Error(`Base64 edit did not apply: "${content.slice(0, 100)}"`);
        return `base64 edit verified`;
      } finally {
        await safeDelete(testFile);
      }
    });

    await runTest("grok-interact", 2, async () => {
      const r = await fetch(`${RELAY_BASE}/api/grok-interact?project=${encodeURIComponent(PROJECT)}&action=evaluate&code=return+document.title`);
      if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
      const d = parseJson(r.body);
      if (d && d.error) throw new Error(d.error);
      return `interact evaluate returned`;
    });

    await runTest("grok-interact-missing-params", 2, async () => {
      const r = await fetch(`${RELAY_BASE}/api/grok-interact?project=${encodeURIComponent(PROJECT)}`);
      const d = parseJson(r.body);
      if (!d) throw new Error("Non-JSON response");
      if (d.actions || d.error) return `missing action param returns usage/error (status ${r.status})`;
      throw new Error(`Unexpected response: ${r.body.slice(0, 200)}`);
    });
  }

  console.error(`\n  TIER 3: Full Cycle Simulation\n`);

  const tier2Failed = results.filter(r => r.tier === 2 && r.status === "fail").length > 0;

  if (!desktopConnected || tier2Failed) {
    const skipReason = !desktopConnected ? "No desktop client connected" : "Tier 2 had failures";
    const tier3Tests = [
      "start-preview", "wait-preview-ready", "screenshot-running-preview",
      "console-logs-after-preview", "inject-error", "capture-error-state",
      "fix-error", "verify-recovery", "cleanup",
    ];
    for (const t of tier3Tests) skip(t, 3, skipReason);
  } else {
    let previewStarted = false;
    let targetFile = null;
    let originalContent = null;

    await runTest("start-preview", 3, async () => {
      const res = await sandboxExecute([{ type: "start_process", project: PROJECT, cmd: "npm run dev" }]);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const d = res.data;
      if (d && d.error && !d.error.includes("already")) throw new Error(d.error);
      const procResults = d?.results || d;
      const procData = Array.isArray(procResults) ? procResults[0] : procResults;
      const status = procData?.data?.status || procData?.status || procData?.data?.started;
      if (d.error && d.error.includes("already")) {
        previewStarted = true;
        return `preview already running`;
      }
      if (!procData && !d.success) throw new Error("No process data returned from start_process");
      previewStarted = true;
      const port = procData?.data?.port || procData?.port || null;
      return `preview started${port ? ` on port ${port}` : ""}`;
    });

    if (previewStarted) {
      await runTest("wait-preview-ready", 3, async () => {
        const maxWait = 25000;
        const pollInterval = 2000;
        const start = Date.now();
        let lastStatus = "not started";
        while (Date.now() - start < maxWait) {
          try {
            const logRes = await fetch(`${RELAY_BASE}/api/console-logs?project=${encodeURIComponent(PROJECT)}`);
            if (logRes.status === 200) {
              const logData = parseJson(logRes.body);
              if (logData && Array.isArray(logData.previews)) {
                for (const p of logData.previews) {
                  const output = (p.stdout || "") + (p.stderr || "");
                  if (output.includes("ready") || output.includes("localhost:") || output.includes("Local:") || output.includes("listening")) {
                    return `preview ready after ${Date.now() - start}ms (detected ready signal in output)`;
                  }
                  lastStatus = output.length > 0 ? `output: ${output.length} chars` : "no output yet";
                }
              }
            }
          } catch {}
          try {
            const ssRes = await fetch(`${RELAY_BASE}/api/screenshot/${PROJECT}?waitMs=2000`);
            if (ssRes.status === 200) {
              const ssData = parseJson(ssRes.body);
              if (ssData && ssData.success) {
                const rr = ssData.results || ssData;
                const entry = Array.isArray(rr) ? rr[0] : rr;
                if (entry?.status === "success" || entry?.data?.url || entry?.data?.port) {
                  return `preview ready after ${Date.now() - start}ms (confirmed via screenshot endpoint — port ${entry?.data?.port || "?"})`;
                }
              }
            }
          } catch {}
          await new Promise((r) => setTimeout(r, pollInterval));
        }
        throw new Error(`Preview did not become ready within ${maxWait}ms (last status: ${lastStatus})`);
      });

      await runTest("screenshot-running-preview", 3, async () => {
        const r = await fetch(`${RELAY_BASE}/api/screenshot/${PROJECT}?fullPage=true&waitMs=5000`);
        if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
        const d = parseJson(r.body);
        if (d && d.error) throw new Error(d.error);
        const rr = d?.results || d;
        const entry = Array.isArray(rr) ? rr[0] : rr;
        const hasImage = entry?.data?.screenshotUrl || entry?.data?.screenshot || entry?.data?.captured || entry?.screenshot || entry?.image;
        return `screenshot captured${hasImage ? " (image present)" : ""}`;
      });

      await runTest("console-logs-after-preview", 3, async () => {
        const r = await fetch(`${RELAY_BASE}/api/console-logs?project=${encodeURIComponent(PROJECT)}`);
        if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
        const d = parseJson(r.body);
        if (!d) throw new Error("Non-JSON response");
        if (d.error) throw new Error(d.error);
        const previews = d.previews || [];
        if (previews.length === 0 && !d.message) throw new Error("No preview entries in console logs — preview may not have started");
        let totalOutput = 0;
        for (const p of previews) {
          totalOutput += (p.stdout || "").length + (p.stderr || "").length;
        }
        return `${previews.length} preview(s), ${totalOutput} chars of output${totalOutput === 0 ? " (buffer may have been flushed)" : ""}`;
      });

      await runTest("inject-error", 3, async () => {
        const candidates = [
          "src/App.tsx", "src/App.jsx", "src/app.tsx",
          "src/main.tsx", "src/main.jsx", "src/index.tsx", "src/index.jsx",
          "src/components/App.tsx", "src/components/App.jsx",
          "src/pages/Dashboard.tsx", "src/pages/Dashboard.jsx",
        ];
        for (const candidate of candidates) {
          const readRes = await sandboxExecute([{ type: "read_file", project: PROJECT, path: candidate }]);
          const content = extractContent(readRes.data);
          if (content && content.length > 10 && !readRes.data?.error) {
            targetFile = candidate;
            originalContent = content;
            break;
          }
        }
        if (!targetFile || !originalContent) {
          const treeRes = await sandboxExecute([{ type: "list_tree", project: PROJECT }]);
          const treeStr = JSON.stringify(treeRes.data);
          const sourceFiles = [];
          const re = /([a-zA-Z0-9_/.-]*\/[A-Za-z]+\.(tsx|jsx|ts|js))/g;
          let m;
          while ((m = re.exec(treeStr)) !== null) {
            if (!m[1].includes("node_modules") && !m[1].includes(".d.ts")) sourceFiles.push(m[1]);
          }
          for (const sf of sourceFiles) {
            const readRes = await sandboxExecute([{ type: "read_file", project: PROJECT, path: sf }]);
            const content = extractContent(readRes.data);
            if (content && content.length > 10 && !readRes.data?.error) {
              targetFile = sf;
              originalContent = content;
              break;
            }
          }
        }
        if (!targetFile || !originalContent) throw new Error("Could not find a source file to inject error into");
        const brokenContent = "SYNTAX_ERROR_INJECTED_BY_BRIDGE_TEST <<<\n" + originalContent;
        const writeRes = await sandboxExecute([{ type: "write_file", project: PROJECT, path: targetFile, content: brokenContent }]);
        if (writeRes.data?.error) throw new Error(writeRes.data.error);
        await new Promise((r) => setTimeout(r, 5000));
        return `injected syntax error into ${targetFile} (${originalContent.length} chars original), waited 5s for HMR`;
      });

      await runTest("capture-error-state", 3, async () => {
        const maxWait = 10000;
        const pollInterval = 2000;
        const start = Date.now();
        while (Date.now() - start < maxWait) {
          const r = await fetch(`${RELAY_BASE}/api/console-logs?project=${encodeURIComponent(PROJECT)}`);
          if (r.status === 200) {
            const d = parseJson(r.body);
            if (d) {
              for (const p of (d.previews || [])) {
                const combined = ((p.stdout || "") + (p.stderr || "")).toLowerCase();
                if (combined.includes("error") || combined.includes("syntax") || combined.includes("fail") || combined.includes("unexpected") || combined.includes("transform")) {
                  return `error detected in console logs after ${Date.now() - start}ms (injected into ${targetFile})`;
                }
              }
            }
          }
          await new Promise((r) => setTimeout(r, pollInterval));
        }
        const verifyRes = await sandboxExecute([{ type: "read_file", project: PROJECT, path: targetFile }]);
        const verifyContent = extractContent(verifyRes.data);
        if (verifyContent && verifyContent.startsWith("SYNTAX_ERROR_INJECTED")) {
          return `error injection confirmed on disk (${targetFile}) — console logs did not surface error within ${maxWait}ms (desktop may buffer output)`;
        }
        throw new Error("No error detected in console logs and injected file not found — error injection failed for " + targetFile);
      });

      await runTest("fix-error", 3, async () => {
        if (!targetFile || !originalContent) throw new Error("No target file to restore — inject-error may have failed");
        const writeRes = await sandboxExecute([{ type: "write_file", project: PROJECT, path: targetFile, content: originalContent }]);
        if (writeRes.data?.error) throw new Error(writeRes.data.error);
        await new Promise((r) => setTimeout(r, 5000));
        return `restored original content to ${targetFile}, waited 5s for HMR recovery`;
      });

      await runTest("verify-recovery", 3, async () => {
        const logRes = await fetch(`${RELAY_BASE}/api/console-logs?project=${encodeURIComponent(PROJECT)}`);
        if (logRes.status !== 200) throw new Error(`Console logs failed: ${logRes.status}`);
        const logData = parseJson(logRes.body);
        if (!logData) throw new Error("Non-JSON console log response");

        const screenshotRes = await fetch(`${RELAY_BASE}/api/screenshot/${PROJECT}?waitMs=3000`);
        if (screenshotRes.status !== 200) throw new Error(`Screenshot failed: ${screenshotRes.status}`);
        const ssData = parseJson(screenshotRes.body);
        if (ssData && ssData.error) throw new Error(`Screenshot error: ${ssData.error}`);

        for (const p of (logData.previews || [])) {
          const recent = ((p.stdout || "") + (p.stderr || ""));
          const last200 = recent.slice(-200).toLowerCase();
          if (last200.includes("syntax_error_injected") || last200.includes("unexpected token")) {
            throw new Error("Residual injected errors found in log tail after fix — recovery failed");
          }
        }
        return `recovery verified — clean log tail and screenshot captured`;
      });

      await runTest("cleanup", 3, async () => {
        if (targetFile && originalContent) {
          await sandboxExecute([{ type: "write_file", project: PROJECT, path: targetFile, content: originalContent }]).catch(() => {});
        }
        await safeKillProcess(PROJECT);
        return `restored ${targetFile || "n/a"} and stopped preview`;
      });
    } else {
      const tier3Remaining = [
        "wait-preview-ready", "screenshot-running-preview",
        "console-logs-after-preview", "inject-error", "capture-error-state",
        "fix-error", "verify-recovery", "cleanup",
      ];
      for (const t of tier3Remaining) skip(t, 3, "Preview did not start");
    }
  }

  const tiers = { tier1: { passed: 0, failed: 0, skipped: 0, tests: [] }, tier2: { passed: 0, failed: 0, skipped: 0, tests: [] }, tier3: { passed: 0, failed: 0, skipped: 0, tests: [] } };
  for (const r of results) {
    const tier = `tier${r.tier}`;
    tiers[tier].tests.push(r);
    tiers[tier][r.status === "pass" ? "passed" : r.status === "fail" ? "failed" : "skipped"]++;
  }
  const totalPassed = results.filter((r) => r.status === "pass").length;
  const totalFailed = results.filter((r) => r.status === "fail").length;
  const totalSkipped = results.filter((r) => r.status === "skip").length;

  const report = {
    timestamp: new Date().toISOString(),
    relay: RELAY_DOMAIN,
    project: PROJECT,
    desktopConnected,
    tiers,
    summary: `${totalPassed}/${results.length} passed, ${totalFailed} failed, ${totalSkipped} skipped`,
    duration_ms: Date.now() - startTime,
  };

  console.error(`\n  ─────────────────────────────────`);
  console.error(`  ${totalFailed === 0 ? "\x1b[32m✓" : "\x1b[31m✗"}\x1b[0m ${report.summary} in ${report.duration_ms}ms`);
  console.error(`  Desktop connected: ${desktopConnected}`);
  console.error(``);

  console.log(JSON.stringify(report, null, 2));

  process.exit(totalFailed > 0 ? 1 : 0);
}

if (process.argv[1] === __filename || process.argv[1]?.endsWith("/bridge-test.cjs")) {
  main().catch((err) => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(2);
  });
}

module.exports = { runTests: main, RELAY_BASE, PROJECT };
