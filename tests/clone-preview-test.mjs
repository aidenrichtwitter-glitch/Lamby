import http from "http";
import fs from "fs";

const BASE = "http://localhost:5000";

const TEST_REPOS = [
  { owner: "WebDevSimplified", repo: "react-todo-list", category: "React+Vite" },
  { owner: "safak", repo: "react-admin-ui", category: "React+CRA" },
  { owner: "codewithsadee", repo: "vcard-personal-portfolio", category: "Static HTML/CSS/JS" },
  { owner: "bedimcode", repo: "responsive-portfolio-website-Alexa", category: "Static HTML/CSS/JS" },
  { owner: "atherosai", repo: "ui", category: "React+Tailwind+Next" },
  { owner: "vuejs", repo: "petite-vue", category: "Vue library + examples" },
  { owner: "adrianhajdin", repo: "project_hoobank", category: "React+Vite+Tailwind" },
  { owner: "adrianhajdin", repo: "project_modern_ui_ux_gpt3", category: "React+CRA" },
  { owner: "jgthms", repo: "web-design-in-4-minutes", category: "Static HTML" },
  { owner: "Renovamen", repo: "playground-macos", category: "React+Vite+Tailwind" },
  { owner: "ixartz", repo: "Next-js-Boilerplate", category: "Next.js+Tailwind" },
  { owner: "adrianhajdin", repo: "project_3D_developer_portfolio", category: "React+Vite+Three.js" },
  { owner: "facebook", repo: "create-react-app", category: "React CRA monorepo", skip: true, reason: "monorepo build tool, not a standalone app" },
];

function postJSON(urlPath, body, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(urlPath, BASE);
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      timeout,
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch { resolve({ raw: body }); } });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    req.write(data);
    req.end();
  });
}

function httpGet(port, urlPath = "/") {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: "127.0.0.1", port, path: urlPath, method: "GET",
      headers: { "Accept": "text/html,application/xhtml+xml,*/*", "User-Agent": "Guardian-Preview-Test/1.0" },
      timeout: 15000,
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on("error", (e) => resolve({ status: 0, body: "", error: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "", error: "timeout" }); });
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function checkUIContent(html) {
  if (!html || html.length < 30) return { ok: false, reason: `empty or tiny (${html?.length || 0}b)` };

  const lower = html.toLowerCase();
  const isErrorPage = /cannot get|enoent|internal server error|cannot find module|module_not_found|err_module_not_found|elifecycle/i.test(html);
  if (isErrorPage) return { ok: false, reason: "error page: " + html.replace(/\n/g, " ").substring(0, 200).trim() };

  const hasDoctype = lower.includes("<!doctype") || lower.includes("<html");
  const hasBody = lower.includes("<body");
  const hasDiv = lower.includes("<div");
  const hasScript = lower.includes("<script");
  const hasLink = lower.includes("<link");
  const hasH1H2 = /<h[1-6]/i.test(html);
  const hasAnchor = lower.includes("<a ");
  const hasUl = lower.includes("<ul");
  const hasMeta = lower.includes("<meta");

  const htmlElements = [hasDoctype, hasBody, hasDiv, hasScript, hasLink, hasH1H2, hasAnchor, hasUl, hasMeta].filter(Boolean).length;

  if (htmlElements >= 2) return { ok: true };
  if (html.length > 500) return { ok: true };
  return { ok: false, reason: `insufficient HTML (${htmlElements} elements found, ${html.length}b)` };
}

async function testRepo(repo, index, total) {
  const { owner, repo: repoName, category } = repo;
  console.log(`\n[${ index + 1 }/${total}] ─── ${owner}/${repoName}  (${category}) ───`);

  if (repo.skip) {
    console.log(`  SKIP: ${repo.reason}`);
    return { name: repoName, owner, status: "SKIP", reason: repo.reason, category };
  }

  let clonedName = null;

  try {
    const t0 = Date.now();
    const cloneResult = await postJSON("/api/projects/import-github", { owner, repo: repoName });

    if (cloneResult.error) {
      console.log(`  ✗ CLONE FAILED (${((Date.now()-t0)/1000).toFixed(0)}s): ${cloneResult.error}`);
      return { name: repoName, owner, status: "FAIL", phase: "clone", reason: cloneResult.error, category };
    }

    clonedName = cloneResult.projectName || cloneResult.name || repoName;
    console.log(`  Cloned "${clonedName}" (${cloneResult.filesWritten || "?"} files, ${((Date.now()-t0)/1000).toFixed(0)}s)`);

    const t1 = Date.now();
    const previewResult = await postJSON("/api/projects/preview", { name: clonedName });

    const port = previewResult.port;
    const started = previewResult.started || previewResult.reused;
    const cmd = previewResult.detectedCommand || "?";

    if (!port || !started) {
      const errMsg = (previewResult.error || "server didn't start").substring(0, 300);
      console.log(`  ✗ PREVIEW FAILED (${((Date.now()-t1)/1000).toFixed(0)}s): ${errMsg}`);
      return { name: clonedName, owner, status: "FAIL", phase: "preview-start", reason: errMsg, category, cmd };
    }

    console.log(`  Server :${port} cmd=[${cmd}] (${((Date.now()-t1)/1000).toFixed(0)}s)`);

    let uiResult = { ok: false, reason: "server never responded" };
    let lastBody = "";
    for (let attempt = 1; attempt <= 12; attempt++) {
      await sleep(2000);
      const response = await httpGet(port);
      lastBody = response.body || "";
      if (response.status >= 200 && response.status < 400 && response.body) {
        uiResult = checkUIContent(response.body);
        if (uiResult.ok) {
          console.log(`  UI OK: attempt ${attempt}, ${response.body.length}b, HTTP ${response.status}`);
          break;
        }
      } else if (response.status === 0 && response.error) {
        uiResult = { ok: false, reason: `connection error: ${response.error}` };
      }
      if (attempt === 1 || attempt === 6 || attempt === 12) {
        console.log(`  Wait ${attempt}/12: HTTP ${response.status}, ${response.body?.length || 0}b ${response.error || ""} ${uiResult.ok ? "" : uiResult.reason}`);
      }
    }

    try { await postJSON("/api/projects/stop-preview", { name: clonedName }, 10000); } catch {}

    if (uiResult.ok) {
      console.log(`  ✓ PASS`);
      return { name: clonedName, owner, status: "PASS", category, cmd };
    } else {
      console.log(`  ✗ FAIL (ui-render): ${uiResult.reason}`);
      if (lastBody) console.log(`  Body snippet: ${lastBody.substring(0, 200).replace(/\n/g, " ")}`);
      return { name: clonedName, owner, status: "FAIL", phase: "ui-render", reason: uiResult.reason, category, cmd };
    }

  } catch (err) {
    console.log(`  ✗ FAIL (exception): ${err.message}`);
    if (clonedName) try { await postJSON("/api/projects/stop-preview", { name: clonedName }, 5000); } catch {}
    return { name: clonedName || repoName, owner, status: "FAIL", phase: "exception", reason: err.message, category };
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  T007: Clone-to-Preview Integration Test                ║");
  console.log("║  Testing ACTUAL UI rendering for fresh GitHub repos     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const active = TEST_REPOS.filter(r => !r.skip);
  console.log(`Testing ${active.length} repos (${TEST_REPOS.length - active.length} skipped)\n`);

  const results = [];
  const total = TEST_REPOS.length;
  for (let i = 0; i < total; i++) {
    results.push(await testRepo(TEST_REPOS[i], i, total));
  }

  const passed = results.filter(r => r.status === "PASS");
  const failed = results.filter(r => r.status === "FAIL");
  const skipped = results.filter(r => r.status === "SKIP");
  const tested = passed.length + failed.length;

  console.log("\n\n╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                              TEST RESULTS                                   ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝\n");
  for (const r of results) {
    const icon = r.status === "PASS" ? "✓" : r.status === "FAIL" ? "✗" : "○";
    const phase = r.phase ? ` (${r.phase})` : "";
    const reason = r.reason ? `: ${r.reason.substring(0, 80)}` : "";
    console.log(`${icon} ${r.status.padEnd(5)} ${(r.owner + "/" + r.name).padEnd(50)} ${r.category}${phase}${reason}`);
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`PASSED:  ${passed.length} / ${tested}`);
  console.log(`FAILED:  ${failed.length} / ${tested}`);
  console.log(`SKIPPED: ${skipped.length}`);
  if (tested > 0) {
    const pct = Math.round(passed.length * 100 / tested);
    console.log(`SUCCESS RATE: ${pct}% ${pct >= 90 ? "(TARGET MET ✓)" : "(TARGET NOT MET ✗)"}`);
  }

  if (failed.length > 0) {
    console.log("\nFAILURE DETAILS:");
    for (const r of failed) console.log(`  ${r.owner}/${r.name} [${r.phase}] cmd=${r.cmd||"n/a"}: ${r.reason?.substring(0, 250)}`);
  }

  fs.writeFileSync("/tmp/t007-results.json", JSON.stringify(results, null, 2));
  console.log("\nFull results: /tmp/t007-results.json");
}

main().catch((e) => { console.error("Test failed:", e); process.exit(1); });
