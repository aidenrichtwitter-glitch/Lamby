const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const XAI_API = process.env.XAI_API;
const RELAY = "https://bridge-relay.replit.app";
const LOCAL = "http://localhost:5000";
const MODEL = process.env.GROK_MODEL || "grok-3-mini-fast";
const MAX_TURNS = parseInt(process.env.MAX_TURNS, 10) || 8;
const PROJECT = "landing-page";
const LOG_DIR = path.join(__dirname);

const AVAILABLE_COMMANDS = [
  "list_tree", "read_file", "read_multiple_files", "write_file", "create_file",
  "delete_file", "bulk_delete", "move_file", "copy_file", "copy_folder",
  "rename_file", "grep", "search_files", "search_replace", "apply_patch",
  "bulk_write", "run_command", "install_deps", "add_dependency", "type_check",
  "lint_and_fix", "format_files", "get_build_metrics", "restart_dev_server",
  "list_open_ports", "git_status", "git_add", "git_commit", "git_diff",
  "git_log", "git_branch", "git_checkout", "git_stash", "git_init",
  "git_push", "git_pull", "git_merge", "detect_structure", "start_process",
  "kill_process", "list_processes", "build_project", "run_tests",
  "archive_project", "export_project", "set_env_var", "get_env_vars",
  "rollback_last_change", "project_analyze", "tailwind_audit", "find_usages",
  "component_tree", "extract_theme", "extract_colors", "capture_preview",
  "get_preview_url", "generate_component", "generate_page", "refactor_file",
  "validate_change", "profile_performance", "create_folder", "delete_folder",
  "move_folder", "rename_folder", "list_tree_filtered", "dead_code_detection",
  "dependency_graph", "symbol_search", "grep_advanced", "extract_imports",
  "run_command_advanced", "build_with_flags", "clean_build_cache",
  "start_process_named", "monitor_process", "get_process_logs",
  "stop_all_processes", "switch_port", "git_stash_pop", "git_reset",
  "git_revert", "git_tag", "visual_diff", "capture_component", "record_video",
  "get_dom_snapshot", "get_console_errors", "generate_test",
  "generate_storybook", "optimize_code", "convert_to_typescript",
  "add_feature", "migrate_framework", "react_profiler",
  "memory_leak_detection", "console_error_analysis", "runtime_error_trace",
  "bundle_analyzer", "network_monitor", "accessibility_audit", "security_scan",
  "set_tailwind_config", "set_next_config", "update_package_json",
  "manage_scripts", "switch_package_manager", "deploy_preview",
  "export_project_zip", "import_project", "super_command"
];

function buildSystemPrompt(cmdUrl) {
  return `=== LAMBY WORKSPACE API (STRICT MODE) ===

You have full read/write access via the bridge.

**HARD RULE** (most important):
You MUST output the raw \`\`\`json action block when you want to make any changes.
Do NOT describe, plan, or explain first. Output the JSON block immediately.

**Workflow you follow every time**:
1. Fetch the snapshot or read files first
2. Analyze if needed (read_multiple_files, project_analyze, etc.)
3. Output the exact JSON action block
4. Verify with another snapshot or console logs
5. ONLY THEN explain what you changed

**Endpoint**:
POST ${cmdUrl}

**Request format**:
\`\`\`json
{"actions": [{"type": "ACTION_TYPE", "project": "${PROJECT}", ...}]}
\`\`\`

**Available commands** (${AVAILABLE_COMMANDS.length} total):
${AVAILABLE_COMMANDS.join(", ")}

**Key command examples**:
- Read file: {"type":"read_file","project":"${PROJECT}","path":"app/layout.tsx"}
- Read multiple: {"type":"read_multiple_files","project":"${PROJECT}","paths":["app/layout.tsx","components/hero-home.tsx"]}
- List tree: {"type":"list_tree","project":"${PROJECT}"}
- Write file: {"type":"write_file","project":"${PROJECT}","path":"app/layout.tsx","content":"FULL FILE CONTENT"}
- Search/replace: {"type":"search_replace","project":"${PROJECT}","path":"app/layout.tsx","search":"old text","replace":"new text"}
- Grep: {"type":"grep","project":"${PROJECT}","pattern":"Simple","filePattern":"*.tsx"}
- Project analyze: {"type":"project_analyze","project":"${PROJECT}"}
- Detect structure: {"type":"detect_structure","project":"${PROJECT}"}

**Important rules**:
- write_file content MUST be the COMPLETE file — every import, every line, every closing bracket.
- Do NOT paste project files back to me. I execute your action blocks and return results.
- When done with ALL changes, respond with exactly: DONE
- Max 50 actions per request.

Project name: ${PROJECT}`;
}

function httpRequest(url, options, bodyStr) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith("https");
    const mod = isHttps ? https : http;
    const parsed = new URL(url);
    const req = mod.request(parsed, options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP request timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function postActions(cmdUrl, actions) {
  const body = JSON.stringify({ actions });
  return httpRequest(cmdUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    timeout: 90000
  }, body);
}

function callXAI(messages) {
  const body = JSON.stringify({
    model: MODEL,
    stream: false,
    max_tokens: 16000,
    temperature: 0.3,
    messages
  });
  return new Promise((resolve, reject) => {
    const req = https.request('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 300000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('xAI response parse error: ' + d.substring(0, 300))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('xAI API timeout')); });
    req.write(body);
    req.end();
  });
}

function extractActionBlocks(text) {
  const blocks = [];

  const fencedRegex = /```json\s*\n?([\s\S]*?)```/g;
  let match;
  while ((match = fencedRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.actions && Array.isArray(parsed.actions)) {
        blocks.push(...parsed.actions);
      }
    } catch {}
  }

  if (blocks.length === 0) {
    const jsonRegex = /\{[\s\S]*?"actions"\s*:\s*\[[\s\S]*?\]\s*\}/g;
    while ((match = jsonRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.actions && Array.isArray(parsed.actions)) {
          blocks.push(...parsed.actions);
        }
      } catch {}
    }
  }

  return blocks;
}

function classifyActions(actions) {
  const reads = [];
  const writes = [];
  for (const a of actions) {
    const t = a.type;
    if (["read_file", "read_multiple_files", "list_tree", "list_tree_filtered",
         "grep", "search_files", "grep_advanced", "detect_structure",
         "project_analyze", "find_usages", "component_tree", "extract_theme",
         "extract_colors", "extract_imports", "symbol_search",
         "dependency_graph", "dead_code_detection", "git_status", "git_diff",
         "git_log", "tailwind_audit", "get_console_errors",
         "console_error_analysis", "runtime_error_trace", "bundle_analyzer",
         "get_dom_snapshot", "get_preview_url", "get_env_vars",
         "list_processes", "list_open_ports", "monitor_process",
         "get_process_logs", "get_build_metrics", "react_profiler",
         "memory_leak_detection", "accessibility_audit", "security_scan",
         "network_monitor", "capture_preview"].includes(t)) {
      reads.push(a);
    } else {
      writes.push(a);
    }
  }
  return { reads, writes };
}

async function fetchSnapshotKey() {
  try {
    const res = await httpRequest(`${LOCAL}/api/snapshot-key`, { method: 'GET', timeout: 5000 });
    if (res.status === 200) {
      const parsed = JSON.parse(res.body);
      return parsed.key;
    }
  } catch {}
  return null;
}

async function verifyRebranding(cmdUrl) {
  const targetFiles = [
    "app/layout.tsx",
    "components/hero-home.tsx",
    "components/features-planet.tsx",
    "components/cta.tsx",
    "components/large-testimonial.tsx"
  ];

  const verifyActions = targetFiles.map(f => ({ type: "read_file", project: PROJECT, path: f }));

  const res = await postActions(cmdUrl, verifyActions);
  if (res.status !== 200) {
    console.log(`  Verification bridge call failed: ${res.status}`);
    return { passed: false, details: "Bridge returned non-200", fileChecks: {} };
  }

  let result;
  try { result = JSON.parse(res.body); } catch {
    console.log(`  Verification response not JSON`);
    return { passed: false, details: "Response not JSON", fileChecks: {} };
  }

  const fileChecks = {};
  const results = result.results || [];

  for (let i = 0; i < targetFiles.length; i++) {
    const file = targetFiles[i];
    const r = results[i];
    const content = (r?.data?.content || r?.data || '').toString().toLowerCase();

    if (!content || r?.status === 'error') {
      fileChecks[file] = { readable: false, hasLamby: false, hasViolet: false, noSimpleBranding: true };
      continue;
    }

    const hasLamby = content.includes('lamby');
    const hasViolet = content.includes('violet') || content.includes('#7c3aed') ||
                      content.includes('#8b5cf6') || content.includes('#6d28d9') ||
                      content.includes('purple') || content.includes('#a855f7');

    const simpleAsProduct = /["']simple["']/.test(content) && !content.includes('lamby');
    const noSimpleBranding = !simpleAsProduct;

    fileChecks[file] = { readable: true, hasLamby, hasViolet, noSimpleBranding };
  }

  const allFiles = Object.values(fileChecks);
  const allReadable = allFiles.every(f => f.readable);
  const allHaveLamby = allFiles.every(f => f.hasLamby);
  const someHaveViolet = allFiles.filter(f => f.hasViolet).length >= 3;
  const noOldBranding = allFiles.every(f => f.noSimpleBranding);

  const passed = allReadable && allHaveLamby && someHaveViolet && noOldBranding;
  const summary = { allReadable, allHaveLamby, someHaveViolet, noOldBranding };

  return { passed, summary, fileChecks };
}

async function main() {
  if (!XAI_API) {
    console.error('ERROR: XAI_API environment variable not set');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   LAMBY AGENTIC E2E BRIDGE TEST                            ║');
  console.log('║   Grok reads/writes through the bridge autonomously        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Model: ${MODEL}`);
  console.log(`  Max turns: ${MAX_TURNS}`);
  console.log(`  Relay: ${RELAY}`);

  console.log('\n── Step 1: Fetch snapshot key ──');
  let key = process.argv[2] || null;
  if (!key) {
    key = await fetchSnapshotKey();
    if (key) {
      console.log(`  Got key from local server: ${key.slice(0, 8)}...`);
    }
  } else {
    console.log(`  Using CLI key: ${key.slice(0, 8)}...`);
  }
  if (!key) {
    console.error('  ERROR: Could not fetch snapshot key. Is the dev server running?');
    process.exit(1);
  }

  const cmdUrl = `${RELAY}/api/sandbox/execute?key=${key}`;
  console.log(`  Command URL: ${cmdUrl.replace(key, key.slice(0, 8) + '...')}`);

  console.log('\n── Step 2: Verify bridge connectivity ──');
  const pingRes = await postActions(cmdUrl, [{ type: "detect_structure", project: PROJECT }]);
  if (pingRes.status !== 200) {
    console.error(`  Bridge not reachable (status ${pingRes.status}): ${pingRes.body.slice(0, 200)}`);
    process.exit(1);
  }
  let pingParsed;
  try { pingParsed = JSON.parse(pingRes.body); } catch { pingParsed = null; }
  if (pingParsed?.results?.[0]?.status === 'error') {
    console.error(`  Bridge reachable but action failed: ${pingParsed.results[0].error}`);
    process.exit(1);
  }
  console.log(`  Bridge connected! (status ${pingRes.status}, project detected)`);

  console.log('\n── Step 3: Start agentic loop ──');
  const systemPrompt = buildSystemPrompt(cmdUrl);

  const conversation = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Rebrand this Next.js landing page project ("${PROJECT}") from "Simple" to "Lamby" (AI-powered autonomous development IDE).

First, read the key project files to understand the current state. Then make these changes:
1. app/layout.tsx: title → "Lamby - AI-Powered Development", update meta description
2. components/hero-home.tsx: heading → "Build Anything with Lamby", subtitle about AI IDE, buttons → "Start Building" / "See It Work", terminal lines → lamby CLI commands, change blue accents → violet/purple
3. components/features-planet.tsx: heading → "Lamby does the heavy lifting", update 6 feature descriptions to be about AI development features, blue → violet/purple
4. components/cta.tsx: heading → "Ship faster with Lamby", button → "Get Started Free", blue → violet/purple
5. components/large-testimonial.tsx: testimonial quote about Lamby, attribution → "Alex Chen" / "Lead Engineer at Vercel", blue → violet/purple

Start by reading the files you need, then make all the changes.` }
  ];

  const globalStart = Date.now();
  let totalReads = 0;
  let totalWrites = 0;
  let lastWriteTurn = -1;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const turnStart = Date.now();
    console.log(`\n  ┌─ Turn ${turn}/${MAX_TURNS} ─────────────────────────────`);

    const response = await callXAI(conversation);
    const turnApiMs = Date.now() - turnStart;

    if (response.error) {
      console.error(`  │ API Error: ${JSON.stringify(response.error)}`);
      break;
    }

    const content = response.choices?.[0]?.message?.content || '';
    const finishReason = response.choices?.[0]?.finish_reason || 'unknown';
    console.log(`  │ Response: ${content.length} chars in ${(turnApiMs / 1000).toFixed(1)}s (finish: ${finishReason})`);

    fs.writeFileSync(path.join(LOG_DIR, `grok_turn_${turn}.txt`), content);

    conversation.push({ role: 'assistant', content });

    const actions = extractActionBlocks(content);

    if (actions.length > 0) {
      const { reads, writes } = classifyActions(actions);
      console.log(`  │ Actions: ${actions.length} total (${reads.length} reads, ${writes.length} writes)`);
      for (const a of actions.slice(0, 10)) {
        const detail = a.path || a.paths?.join(', ') || a.pattern || '';
        const size = a.content ? ` (${a.content.length} chars)` : '';
        console.log(`  │   ${a.type} ${detail}${size}`);
      }
      if (actions.length > 10) console.log(`  │   ... and ${actions.length - 10} more`);

      const batches = [];
      for (let i = 0; i < actions.length; i += 50) {
        batches.push(actions.slice(i, i + 50));
      }

      let allResults = [];
      let writeErrors = 0;
      for (let bi = 0; bi < batches.length; bi++) {
        const batch = batches[bi];
        if (batches.length > 1) console.log(`  │ Posting batch ${bi + 1}/${batches.length} (${batch.length} actions)`);
        const bridgeRes = await postActions(cmdUrl, batch);
        console.log(`  │ Bridge response: ${bridgeRes.status}`);

        if (bridgeRes.status !== 200) {
          console.error(`  │ ✗ Bridge error (${bridgeRes.status}): ${bridgeRes.body.slice(0, 300)}`);
          allResults.push({ error: bridgeRes.body.slice(0, 500), status: bridgeRes.status });
          const batchWriteCount = batch.filter(a => !classifyActions([a]).reads.length).length;
          writeErrors += batchWriteCount;
          continue;
        }

        let parsed;
        try { parsed = JSON.parse(bridgeRes.body); } catch {
          parsed = { raw: bridgeRes.body.slice(0, 2000) };
        }

        if (parsed.results) {
          for (const r of parsed.results) {
            if (r.status === 'error') {
              const isWrite = r.type && !classifyActions([{ type: r.type }]).reads.length;
              if (isWrite) writeErrors++;
              console.log(`  │ ✗ Action error [${r.type}]: ${(r.error || '').slice(0, 200)}`);
            }
          }
        }

        allResults.push(parsed);
      }

      const successfulWrites = writes.length - writeErrors;
      totalReads += reads.length;
      totalWrites += (successfulWrites > 0 ? successfulWrites : 0);
      if (successfulWrites > 0) lastWriteTurn = turn;

      if (writeErrors > 0) {
        console.log(`  │ ⚠ ${writeErrors} write action(s) had errors`);
      }

      const resultSummary = JSON.stringify(allResults).slice(0, 8000);
      conversation.push({
        role: 'user',
        content: `Action results:\n${resultSummary}\n\n${writes.length > 0 ? 'If all changes are done, respond with DONE. Otherwise, continue with the next actions.' : 'Continue with the changes now that you have the file contents.'}`
      });

      console.log(`  └──────────────────────────────────────────`);

      if (/\bDONE\b/.test(content) && writes.length === 0) {
        console.log(`  Grok signaled DONE (after executing read-only actions)`);
        break;
      }
      continue;
    }

    if (/\bDONE\b/.test(content) && turn > 1) {
      console.log(`  │ Grok signaled DONE`);
      console.log(`  └──────────────────────────────────────────`);
      break;
    }

    if (turn > 1 && lastWriteTurn > 0) {
      console.log(`  │ No more actions — treating as completion (writes done on turn ${lastWriteTurn})`);
      console.log(`  └──────────────────────────────────────────`);
      break;
    }

    console.log(`  │ No action blocks found in response`);
    console.log(`  │ Preview: ${content.slice(0, 200).replace(/\n/g, ' ')}`);
    conversation.push({ role: 'user', content: 'You must output a ```json action block. Start by reading the project files. Example:\n```json\n{"actions": [{"type": "list_tree", "project": "landing-page"}]}\n```' });
    console.log(`  └──────────────────────────────────────────`);
  }

  const totalMs = Date.now() - globalStart;
  console.log(`\n── Step 4: Verification ──`);
  console.log(`  Total turns: ${conversation.filter(m => m.role === 'assistant').length}`);
  console.log(`  Total reads: ${totalReads}, writes: ${totalWrites}`);
  console.log(`  Total time: ${(totalMs / 1000).toFixed(1)}s`);

  if (totalWrites === 0) {
    console.log('\n  ⚠ WARNING: No write actions were executed!');
    console.log('  Grok may have described changes without outputting action blocks.');
    console.log('  Check the turn log files for details.');
    process.exit(1);
  }

  console.log('\n  Verifying rebranding through bridge...');
  const verification = await verifyRebranding(cmdUrl);
  console.log(`  Summary: ${JSON.stringify(verification.summary || {})}`);
  for (const [file, checks] of Object.entries(verification.fileChecks || {})) {
    const status = checks.readable && checks.hasLamby ? '✓' : '✗';
    console.log(`    ${status} ${file}: lamby=${checks.hasLamby}, violet=${checks.hasViolet}, noOldBrand=${checks.noSimpleBranding}`);
  }

  if (verification.passed) {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║   ✓ E2E TEST PASSED                                        ║');
    console.log('║   Landing page rebranded from "Simple" to "Lamby"           ║');
    console.log('║   through the bridge relay — Grok acted autonomously!       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
  } else {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║   ✗ VERIFICATION INCOMPLETE                                 ║');
    console.log('║   Some expected changes not detected.                       ║');
    console.log('║   Check turn logs and bridge responses for details.         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
  }

  fs.writeFileSync(path.join(LOG_DIR, 'e2e_summary.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    model: MODEL,
    turns: conversation.filter(m => m.role === 'assistant').length,
    totalReads,
    totalWrites,
    durationMs: totalMs,
    verification,
    passed: verification.passed
  }, null, 2));

  console.log(`\n  Logs saved to ${LOG_DIR}/grok_turn_*.txt and e2e_summary.json`);

  if (!verification.passed) process.exit(1);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
