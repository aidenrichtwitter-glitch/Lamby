const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const XAI_API = process.env.XAI_API;
const RELAY = "https://bridge-relay.replit.app";
const LOCAL = "http://localhost:5000";
const MODEL = "grok-4";
const PROJECT = "landing-page";

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
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function postActions(cmdUrl, actions) {
  const body = JSON.stringify({ actions });
  return httpRequest(cmdUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    timeout: 120000
  }, body);
}

function callXAI(messages) {
  const body = JSON.stringify({ model: MODEL, stream: false, max_tokens: 32000, temperature: 0.4, messages });
  return new Promise((resolve, reject) => {
    const req = https.request('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API}`, 'Content-Length': Buffer.byteLength(body) },
      timeout: 600000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { reject(new Error('Parse: ' + d.slice(0,500))); }
      });
    });
    req.on('error', (err) => { console.error(`    [xAI] Request error: ${err.message}`); reject(err); });
    req.on('timeout', () => { req.destroy(); reject(new Error('xAI timeout (600s)')); });
    req.write(body);
    req.end();
  });
}

function extractActionBlocks(text) {
  const blocks = [];
  const fenced = /```json\s*\n?([\s\S]*?)```/g;
  let m;
  while ((m = fenced.exec(text)) !== null) {
    try { const p = JSON.parse(m[1].trim()); if (p.actions) blocks.push(...p.actions); } catch {}
  }
  if (!blocks.length) {
    const raw = /\{[\s\S]*?"actions"\s*:\s*\[[\s\S]*?\]\s*\}/g;
    while ((m = raw.exec(text)) !== null) {
      try { const p = JSON.parse(m[0]); if (p.actions) blocks.push(...p.actions); } catch {}
    }
  }
  return blocks;
}

const GROUPS = {
  1: {
    name: "File & Folder Operations",
    commands: ["create_folder", "delete_folder", "move_folder", "rename_folder", "copy_folder", "bulk_write", "bulk_delete", "read_multiple_files", "search_replace", "apply_patch"],
    directTests: [
      { desc: "create_folder", actions: [{ type: "create_folder", project: PROJECT, path: "_test_batch/subdir" }] },
      { desc: "bulk_write (3 files)", actions: [{ type: "bulk_write", project: PROJECT, files: [
        { path: "_test_batch/file_a.txt", content: "Alpha content here" },
        { path: "_test_batch/file_b.txt", content: "Bravo content here" },
        { path: "_test_batch/subdir/file_c.txt", content: "Charlie content here" }
      ]}] },
      { desc: "read_multiple_files", actions: [{ type: "read_multiple_files", project: PROJECT, paths: ["_test_batch/file_a.txt", "_test_batch/file_b.txt", "_test_batch/subdir/file_c.txt"] }] },
      { desc: "search_replace", actions: [{ type: "search_replace", project: PROJECT, path: "_test_batch/file_a.txt", search: "Alpha", replace: "REPLACED_ALPHA" }] },
      { desc: "copy_folder", actions: [{ type: "copy_folder", project: PROJECT, source: "_test_batch/subdir", dest: "_test_batch/subdir_copy" }] },
      { desc: "rename_folder", actions: [{ type: "rename_folder", project: PROJECT, from: "_test_batch/subdir_copy", to: "_test_batch/renamed_dir" }] },
      { desc: "move_folder", actions: [{ type: "move_folder", project: PROJECT, from: "_test_batch/renamed_dir", to: "_test_batch/moved_dir" }] },
      { desc: "apply_patch", actions: [{ type: "apply_patch", project: PROJECT, patch: "--- a/_test_batch/file_b.txt\n+++ b/_test_batch/file_b.txt\n@@ -1 +1 @@\n-Bravo content here\n+PATCHED Bravo content" }] },
      { desc: "bulk_delete", actions: [{ type: "bulk_delete", project: PROJECT, paths: ["_test_batch/file_a.txt", "_test_batch/file_b.txt"] }] },
      { desc: "delete_folder", actions: [{ type: "delete_folder", project: PROJECT, path: "_test_batch" }] },
    ],
    grokTask: `You have 10 new sandbox commands to test. Exercise ALL of them in sequence on the landing-page project:

1. create_folder — create "_grok_test/deeper/nested"
2. bulk_write — write 3 files at once: "_grok_test/a.txt" (content: "hello"), "_grok_test/b.txt" (content: "world"), "_grok_test/deeper/c.txt" (content: "nested file")
   Format: {"type":"bulk_write","project":"landing-page","files":[{"path":"_grok_test/a.txt","content":"hello"},{"path":"_grok_test/b.txt","content":"world"},{"path":"_grok_test/deeper/c.txt","content":"nested file"}]}
3. read_multiple_files — read all 3 files at once
   Format: {"type":"read_multiple_files","project":"landing-page","paths":["_grok_test/a.txt","_grok_test/b.txt","_grok_test/deeper/c.txt"]}
4. search_replace — in "_grok_test/a.txt", replace "hello" with "GROK_WAS_HERE"
   Format: {"type":"search_replace","project":"landing-page","path":"_grok_test/a.txt","search":"hello","replace":"GROK_WAS_HERE"}
5. copy_folder — copy "_grok_test/deeper" to "_grok_test/deeper_copy"
   Format: {"type":"copy_folder","project":"landing-page","source":"_grok_test/deeper","dest":"_grok_test/deeper_copy"}
6. rename_folder — rename "_grok_test/deeper_copy" to "_grok_test/renamed_dir"
   Format: {"type":"rename_folder","project":"landing-page","from":"_grok_test/deeper_copy","to":"_grok_test/renamed_dir"}
7. move_folder — move "_grok_test/renamed_dir" to "_grok_test/moved_final"
   Format: {"type":"move_folder","project":"landing-page","from":"_grok_test/renamed_dir","to":"_grok_test/moved_final"}
8. apply_patch — patch "_grok_test/b.txt": replace "world" with "PATCHED_BY_GROK"
   Format: {"type":"apply_patch","project":"landing-page","patch":"--- a/_grok_test/b.txt\\n+++ b/_grok_test/b.txt\\n@@ -1 +1 @@\\n-world\\n+PATCHED_BY_GROK"}
9. bulk_delete — delete "_grok_test/a.txt" and "_grok_test/b.txt"
   Format: {"type":"bulk_delete","project":"landing-page","paths":["_grok_test/a.txt","_grok_test/b.txt"]}
10. delete_folder — delete the entire "_grok_test" folder
    Format: {"type":"delete_folder","project":"landing-page","path":"_grok_test"}

Execute them IN ORDER. Each action needs project: "landing-page". After each action, report the result. After all 10, say DONE.`
  },

  2: {
    name: "Code Analysis",
    commands: ["list_tree_filtered", "dead_code_detection", "dependency_graph", "symbol_search", "grep_advanced", "extract_imports", "find_usages", "component_tree", "project_analyze", "tailwind_audit"],
    directTests: [
      { desc: "list_tree_filtered (.tsx)", actions: [{ type: "list_tree_filtered", project: PROJECT, filter: ".tsx" }] },
      { desc: "dead_code_detection", actions: [{ type: "dead_code_detection", project: PROJECT }] },
      { desc: "dependency_graph", actions: [{ type: "dependency_graph", project: PROJECT }] },
      { desc: "symbol_search (Hero)", actions: [{ type: "symbol_search", project: PROJECT, query: "Hero" }] },
      { desc: "grep_advanced (export default)", actions: [{ type: "grep_advanced", project: PROJECT, pattern: "export default", filePattern: "*.tsx" }] },
      { desc: "extract_imports (hero-home.tsx)", actions: [{ type: "extract_imports", project: PROJECT, file: "components/hero-home.tsx" }] },
      { desc: "find_usages (HeroHome)", actions: [{ type: "find_usages", project: PROJECT, symbol: "HeroHome" }] },
      { desc: "component_tree", actions: [{ type: "component_tree", project: PROJECT }] },
      { desc: "project_analyze", actions: [{ type: "project_analyze", project: PROJECT }] },
      { desc: "tailwind_audit", actions: [{ type: "tailwind_audit", project: PROJECT }] },
    ],
    grokTask: `You have 10 code analysis commands to test. Exercise ALL of them on the landing-page project:

1. list_tree_filtered — list only .tsx files: {"type":"list_tree_filtered","project":"landing-page","filter":".tsx"}
2. dead_code_detection — find unused exports: {"type":"dead_code_detection","project":"landing-page"}
3. dependency_graph — map import relationships: {"type":"dependency_graph","project":"landing-page"}
4. symbol_search — find symbols matching "Hero": {"type":"symbol_search","project":"landing-page","query":"Hero"}
5. grep_advanced — search for "export default" in .tsx files: {"type":"grep_advanced","project":"landing-page","pattern":"export default","filePattern":"*.tsx"}
6. extract_imports — list imports in hero file: {"type":"extract_imports","project":"landing-page","file":"components/hero-home.tsx"}
7. find_usages — find where HeroHome is used: {"type":"find_usages","project":"landing-page","symbol":"HeroHome"}
8. component_tree — get React component hierarchy: {"type":"component_tree","project":"landing-page"}
9. project_analyze — get project overview: {"type":"project_analyze","project":"landing-page"}
10. tailwind_audit — audit Tailwind usage: {"type":"tailwind_audit","project":"landing-page"}

Execute ALL 10 commands. You can batch multiple in one action block. After all results, say DONE.`
  },

  3: {
    name: "Git Advanced",
    commands: ["git_stash_pop", "git_reset", "git_revert", "git_tag", "rollback_last_change"],
    directTests: [
      { desc: "git_tag (create)", actions: [{ type: "git_tag", project: PROJECT, name: "_test_batch_tag", message: "test tag" }] },
      { desc: "git_tag (list via run_command)", actions: [{ type: "run_command", project: PROJECT, command: "git tag" }] },
      { desc: "git_stash_pop", actions: [{ type: "git_stash_pop", project: PROJECT }] },
      { desc: "git_reset (soft HEAD)", actions: [{ type: "git_reset", project: PROJECT, mode: "soft", ref: "HEAD" }] },
      { desc: "rollback_last_change", actions: [{ type: "rollback_last_change", project: PROJECT }] },
    ],
    grokTask: `You have 5 advanced git commands to test. Exercise ALL on landing-page:

1. git_tag — create a tag (name required): {"type":"git_tag","project":"landing-page","name":"grok-test-tag","message":"created by grok"}
2. run_command — list tags: {"type":"run_command","project":"landing-page","command":"git tag"}
3. git_stash_pop — pop stash (may be empty, that's ok): {"type":"git_stash_pop","project":"landing-page"}
4. git_reset — soft reset to HEAD: {"type":"git_reset","project":"landing-page","mode":"soft","ref":"HEAD"}
5. rollback_last_change — rollback: {"type":"rollback_last_change","project":"landing-page"}

Execute all 5 and report results. Say DONE when finished.`
  },

  4: {
    name: "Process & Server Management",
    commands: ["start_process_named", "monitor_process", "get_process_logs", "stop_all_processes", "restart_dev_server", "list_open_ports", "run_command_advanced"],
    directTests: [
      { desc: "start_process_named", actions: [{ type: "start_process_named", project: PROJECT, name: "batch-test-proc", command: "sleep 60" }] },
      { desc: "monitor_process (via pid)", actions: [{ type: "monitor_process", project: PROJECT, pid: 1 }] },
      { desc: "get_process_logs", actions: [{ type: "get_process_logs", project: PROJECT, name: "batch-test-proc" }] },
      { desc: "list_open_ports", actions: [{ type: "list_open_ports", project: PROJECT }] },
      { desc: "run_command_advanced", actions: [{ type: "run_command_advanced", project: PROJECT, command: "echo advanced-cmd-works", timeout: 10 }] },
      { desc: "stop_all_processes", actions: [{ type: "stop_all_processes", project: PROJECT }] },
    ],
    grokTask: `You have 7 process/server management commands to test. Exercise these on landing-page:

1. start_process_named — start a named process: {"type":"start_process_named","project":"landing-page","name":"grok-proc","command":"echo grok-process-started && sleep 3"}
2. monitor_process — check PID 1's status (pid must be a number): {"type":"monitor_process","project":"landing-page","pid":1}
3. get_process_logs — get its output: {"type":"get_process_logs","project":"landing-page","name":"grok-proc"}
4. list_open_ports — list listening ports: {"type":"list_open_ports","project":"landing-page"}
5. run_command_advanced — run with timeout: {"type":"run_command_advanced","project":"landing-page","command":"echo advanced-works","timeout":10}
6. stop_all_processes — stop everything: {"type":"stop_all_processes","project":"landing-page"}

Execute all 6 in order. Say DONE when finished. Note: restart_dev_server is skipped to avoid disrupting the test environment.`
  },

  5: {
    name: "Build & Package Management",
    commands: ["add_dependency", "get_build_metrics", "manage_scripts", "update_package_json", "type_check", "lint_and_fix", "format_files", "clean_build_cache", "build_with_flags"],
    directTests: [
      { desc: "get_build_metrics", actions: [{ type: "get_build_metrics", project: PROJECT }] },
      { desc: "manage_scripts (read dev)", actions: [{ type: "manage_scripts", project: PROJECT, scriptName: "dev" }] },
      { desc: "type_check", actions: [{ type: "type_check", project: PROJECT }] },
      { desc: "clean_build_cache", actions: [{ type: "clean_build_cache", project: PROJECT }] },
    ],
    grokTask: `You have build/package commands to test. Exercise these on landing-page:

1. get_build_metrics — get build info: {"type":"get_build_metrics","project":"landing-page"}
2. manage_scripts — read the dev script: {"type":"manage_scripts","project":"landing-page","scriptName":"dev"}
3. type_check — run TypeScript check: {"type":"type_check","project":"landing-page"}
4. clean_build_cache — clear caches: {"type":"clean_build_cache","project":"landing-page"}

Execute all 4 and report results. Say DONE when finished. Skip add_dependency/update_package_json to avoid modifying the project.`
  },

  6: {
    name: "Code Generation & Refactoring",
    commands: ["generate_component", "generate_page", "generate_test", "refactor_file", "optimize_code", "convert_to_typescript", "add_feature"],
    directTests: [
      { desc: "generate_component", actions: [{ type: "generate_component", project: PROJECT, name: "TestBatchButton", path: "_test_batch_gen/TestBatchButton.tsx", description: "A simple button component with label and onClick props" }] },
      { desc: "generate_test", actions: [{ type: "generate_test", project: PROJECT, file: "components/hero-home.tsx" }] },
      { desc: "optimize_code", actions: [{ type: "optimize_code", project: PROJECT, file: "components/hero-home.tsx" }] },
    ],
    grokTask: `You have code generation commands to test. Exercise these on landing-page:

1. generate_component — create a component: {"type":"generate_component","project":"landing-page","name":"GrokTestWidget","path":"_grok_gen_test/GrokTestWidget.tsx","description":"A simple test widget showing a title and count with a button"}
2. generate_test — generate tests for hero-home: {"type":"generate_test","project":"landing-page","file":"components/hero-home.tsx"}
3. optimize_code — get optimization suggestions: {"type":"optimize_code","project":"landing-page","file":"components/hero-home.tsx"}

Execute all 3 and report results. Then clean up by deleting the _grok_gen_test folder: {"type":"delete_folder","project":"landing-page","path":"_grok_gen_test"}
Say DONE when finished.`
  },

  7: {
    name: "Preview & Visual",
    commands: ["capture_preview", "get_preview_url", "get_dom_snapshot", "get_console_errors", "visual_diff"],
    directTests: [
      { desc: "capture_preview", actions: [{ type: "capture_preview", project: PROJECT }] },
      { desc: "get_preview_url", actions: [{ type: "get_preview_url", project: PROJECT }] },
      { desc: "get_console_errors", actions: [{ type: "get_console_errors", project: PROJECT }] },
      { desc: "get_dom_snapshot", actions: [{ type: "get_dom_snapshot", project: PROJECT }] },
      { desc: "visual_diff", actions: [{ type: "visual_diff", project: PROJECT, beforeUrl: "http://localhost:3000", afterUrl: "http://localhost:3000" }] },
    ],
    grokTask: `You have preview/visual commands to test. Exercise these on landing-page:

1. capture_preview — get preview screenshot/URL: {"type":"capture_preview","project":"landing-page"}
2. get_preview_url — get the dev server URL: {"type":"get_preview_url","project":"landing-page"}
3. get_console_errors — check for console errors: {"type":"get_console_errors","project":"landing-page"}
4. get_dom_snapshot — get DOM structure: {"type":"get_dom_snapshot","project":"landing-page"}
5. visual_diff — diff using URLs (uses beforeUrl/afterUrl): {"type":"visual_diff","project":"landing-page","beforeUrl":"http://localhost:3000","afterUrl":"http://localhost:3000"}

Execute all 5 and report results. Say DONE when finished.`
  },

  8: {
    name: "Debugging & Profiling",
    commands: ["console_error_analysis", "runtime_error_trace", "bundle_analyzer", "network_monitor", "profile_performance", "validate_change", "memory_leak_detection", "react_profiler"],
    directTests: [
      { desc: "console_error_analysis", actions: [{ type: "console_error_analysis", project: PROJECT }] },
      { desc: "runtime_error_trace", actions: [{ type: "runtime_error_trace", project: PROJECT }] },
      { desc: "bundle_analyzer", actions: [{ type: "bundle_analyzer", project: PROJECT }] },
      { desc: "network_monitor", actions: [{ type: "network_monitor", project: PROJECT }] },
      { desc: "profile_performance", actions: [{ type: "profile_performance", project: PROJECT }] },
      { desc: "validate_change", actions: [{ type: "validate_change", project: PROJECT, path: "components/hero-home.tsx" }] },
      { desc: "memory_leak_detection", actions: [{ type: "memory_leak_detection", project: PROJECT }] },
      { desc: "react_profiler", actions: [{ type: "react_profiler", project: PROJECT }] },
    ],
    grokTask: `You have debugging/profiling commands to test. Exercise ALL on landing-page:

1. console_error_analysis: {"type":"console_error_analysis","project":"landing-page"}
2. runtime_error_trace: {"type":"runtime_error_trace","project":"landing-page"}
3. bundle_analyzer: {"type":"bundle_analyzer","project":"landing-page"}
4. network_monitor: {"type":"network_monitor","project":"landing-page"}
5. profile_performance: {"type":"profile_performance","project":"landing-page"}
6. validate_change: {"type":"validate_change","project":"landing-page","path":"components/hero-home.tsx"}
7. memory_leak_detection: {"type":"memory_leak_detection","project":"landing-page"}
8. react_profiler: {"type":"react_profiler","project":"landing-page"}

Execute ALL 8 in one or two batches. Say DONE when finished.`
  },

  9: {
    name: "Config & Environment",
    commands: ["set_env_var", "get_env_vars", "set_tailwind_config", "set_next_config", "accessibility_audit", "security_scan", "extract_colors", "extract_theme", "archive_project", "super_command"],
    directTests: [
      { desc: "get_env_vars", actions: [{ type: "get_env_vars", project: PROJECT }] },
      { desc: "set_env_var", actions: [{ type: "set_env_var", project: PROJECT, key: "_TEST_BATCH_VAR", value: "batch_test_value" }] },
      { desc: "extract_colors", actions: [{ type: "extract_colors", project: PROJECT }] },
      { desc: "extract_theme", actions: [{ type: "extract_theme", project: PROJECT }] },
      { desc: "accessibility_audit", actions: [{ type: "accessibility_audit", project: PROJECT }] },
      { desc: "security_scan", actions: [{ type: "security_scan", project: PROJECT }] },
      { desc: "archive_project", actions: [{ type: "archive_project", project: PROJECT }] },
      { desc: "super_command", actions: [{ type: "super_command", project: PROJECT, description: "List all TypeScript files in the components directory" }] },
    ],
    grokTask: `You have config/environment commands to test. Exercise ALL on landing-page:

1. get_env_vars: {"type":"get_env_vars","project":"landing-page"}
2. set_env_var: {"type":"set_env_var","project":"landing-page","key":"GROK_TEST_VAR","value":"grok_was_here"}
3. extract_colors: {"type":"extract_colors","project":"landing-page"}
4. extract_theme: {"type":"extract_theme","project":"landing-page"}
5. accessibility_audit: {"type":"accessibility_audit","project":"landing-page"}
6. security_scan: {"type":"security_scan","project":"landing-page"}
7. archive_project: {"type":"archive_project","project":"landing-page"}
8. super_command: {"type":"super_command","project":"landing-page","description":"List all TypeScript files in the components directory"}

Execute ALL 8. Say DONE when finished.`
  }
};

async function runPhase1(groupNum, cmdUrl) {
  const group = GROUPS[groupNum];
  console.log(`\n  ── Phase 1: Direct command tests ──`);
  let passed = 0, failed = 0;
  for (const test of group.directTests) {
    process.stdout.write(`    ${test.desc}... `);
    try {
      const res = await postActions(cmdUrl, test.actions);
      const parsed = JSON.parse(res.body);
      const firstResult = parsed.results?.[0];
      if (firstResult?.status === 'success') {
        const preview = JSON.stringify(firstResult.data || {}).slice(0, 120);
        console.log(`✓ ${preview}`);
        passed++;
      } else if (firstResult?.status === 'error') {
        const isExpected = test.desc.includes('stash_pop') || test.desc.includes('rollback');
        if (isExpected) {
          console.log(`✓ (expected error: ${(firstResult.error || '').slice(0, 80)})`);
          passed++;
        } else {
          console.log(`✗ ${(firstResult.error || 'unknown error').slice(0, 120)}`);
          failed++;
        }
      } else {
        console.log(`? Unexpected: ${JSON.stringify(parsed).slice(0, 150)}`);
        failed++;
      }
    } catch (err) {
      console.log(`✗ ${err.message.slice(0, 100)}`);
      failed++;
    }
  }
  console.log(`\n  Phase 1: ${passed}/${passed + failed} passed\n`);
  return { passed, failed };
}

async function runPhase2(groupNum, cmdUrl) {
  const group = GROUPS[groupNum];
  if (!XAI_API) { console.log('  Phase 2: SKIPPED (no XAI_API)'); return { passed: 0, failed: 0 }; }

  console.log(`  ── Phase 2: Grok autonomous test ──\n`);

  const systemPrompt = `You are an autonomous coding agent. Execute sandbox commands by outputting JSON action blocks.

ENDPOINT: POST ${cmdUrl}
FORMAT:
\`\`\`json
{"actions": [{"type": "COMMAND", "project": "${PROJECT}", ...params}]}
\`\`\`

RULES:
1. Every action MUST include "project": "${PROJECT}"
2. Output \`\`\`json action blocks
3. You can batch multiple commands in one action block
4. Report each result briefly
5. When ALL commands are tested, say DONE`;

  const conversation = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: group.grokTask }
  ];

  const t0 = Date.now();
  const MAX_TURNS = 8;
  let commandsExecuted = 0;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    process.stdout.write(`    Turn ${turn}/${MAX_TURNS}... `);
    let resp;
    try {
      resp = await callXAI(conversation);
    } catch (err) {
      console.log(`\n    ✗ xAI error: ${err.message}`);
      break;
    }

    const content = resp.choices?.[0]?.message?.content || '';
    console.log(`${content.length}ch ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    conversation.push({ role: 'assistant', content });

    const actions = extractActionBlocks(content);
    if (actions.length > 0) {
      for (const a of actions) {
        console.log(`      → ${a.type} ${a.path || a.name || a.query || a.symbol || a.command?.slice(0,30) || ''}`);
      }
      commandsExecuted += actions.length;

      const bridgeRes = await postActions(cmdUrl, actions);
      let parsed;
      try { parsed = JSON.parse(bridgeRes.body); } catch { parsed = { raw: bridgeRes.body.slice(0, 2000) }; }

      if (parsed.results) {
        for (const r of parsed.results) {
          if (r.status === 'error') console.log(`      ✗ ${r.type}: ${(r.error || '').slice(0, 100)}`);
          else console.log(`      ✓ ${r.type}`);
        }
      }

      const summary = JSON.stringify(parsed).slice(0, 6000);
      conversation.push({ role: 'user', content: `Results:\n${summary}\n\nContinue with remaining commands, or say DONE if all tested.` });

      if (/\bDONE\b/.test(content)) {
        console.log('    ✓ Grok signaled DONE');
        break;
      }
    } else if (/\bDONE\b/.test(content)) {
      console.log('    ✓ Grok signaled DONE');
      break;
    } else {
      conversation.push({ role: 'user', content: 'Output ```json action blocks to execute the commands.' });
    }
  }

  const totalSec = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\n  Phase 2: ${commandsExecuted} commands executed by Grok in ${totalSec}s\n`);
  return { commandsExecuted, durationSec: totalSec };
}

async function main() {
  const groupArg = parseInt(process.argv[2]);
  const phaseArg = process.argv[3]; // "p1" for phase1 only, "p2" for phase2 only, default both

  if (!groupArg || !GROUPS[groupArg]) {
    console.log('Usage: node batch-cmd-test.cjs <group> [p1|p2]');
    console.log('Groups:');
    for (const [k, v] of Object.entries(GROUPS)) {
      console.log(`  ${k}: ${v.name} (${v.commands.length} commands)`);
    }
    process.exit(0);
  }

  const group = GROUPS[groupArg];
  console.log('╔══════════════════════════════════════════════════╗');
  console.log(`║  BATCH COMMAND TEST — Group ${groupArg}                  ║`);
  console.log(`║  ${group.name.padEnd(44)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  Commands: ${group.commands.join(', ')}`);

  const keyRes = await httpRequest(`${LOCAL}/api/snapshot-key`, { method: 'GET', timeout: 5000 });
  const key = JSON.parse(keyRes.body).key;
  const cmdUrl = `${RELAY}/api/sandbox/execute?key=${key}`;
  console.log(`  Key: ${key.slice(0, 8)}...  Model: ${MODEL}`);

  let p1 = { passed: 0, failed: 0 };
  let p2 = { commandsExecuted: 0 };

  if (phaseArg !== 'p2') {
    p1 = await runPhase1(groupArg, cmdUrl);
  }

  if (phaseArg !== 'p1') {
    p2 = await runPhase2(groupArg, cmdUrl);
  }

  console.log('══════════════════════════════════════════════════');
  if (phaseArg !== 'p2') console.log(`  Phase 1: ${p1.passed}/${p1.passed + p1.failed} direct tests passed`);
  if (phaseArg !== 'p1') console.log(`  Phase 2: ${p2.commandsExecuted} commands executed by Grok`);
  console.log('══════════════════════════════════════════════════\n');

  if (p1.failed > 0) process.exit(1);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
