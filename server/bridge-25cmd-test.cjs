const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const XAI_API = process.env.XAI_API;
const RELAY = "https://bridge-relay.replit.app";
const LOCAL = "http://localhost:5000";
const MODEL = process.env.GROK_MODEL || "grok-3-mini-fast";
const PROJECT = "landing-page";
const LOG_DIR = path.join(__dirname);

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
    timeout: 90000
  }, body);
}

async function fetchSnapshotKey() {
  const res = await httpRequest(`${LOCAL}/api/snapshot-key`, { method: 'GET', timeout: 5000 });
  if (res.status === 200) return JSON.parse(res.body).key;
  throw new Error(`Failed to get snapshot key: ${res.status}`);
}

function callXAI(messages) {
  const body = JSON.stringify({ model: MODEL, stream: false, max_tokens: 16000, temperature: 0.3, messages });
  return new Promise((resolve, reject) => {
    const req = https.request('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API}`, 'Content-Length': Buffer.byteLength(body) },
      timeout: 300000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('Parse error: ' + d.slice(0,300))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('xAI timeout')); });
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

async function main() {
  if (!XAI_API) { console.error('ERROR: XAI_API not set'); process.exit(1); }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   LAMBY 25-COMMAND BRIDGE TEST                             ║');
  console.log('║   Phase 1: Direct command tests via bridge relay           ║');
  console.log('║   Phase 2: Grok agentic test (visible preview change)     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const key = await fetchSnapshotKey();
  console.log(`  Snapshot key: ${key.slice(0,8)}...`);
  const cmdUrl = `${RELAY}/api/sandbox/execute?key=${key}`;

  const results = {};
  let passed = 0;
  let failed = 0;

  async function test(name, actions, validate) {
    process.stdout.write(`  ${name.padEnd(25)}`);
    try {
      const res = await postActions(cmdUrl, actions);
      if (res.status !== 200) {
        console.log(`✗ HTTP ${res.status}: ${res.body.slice(0,150)}`);
        results[name] = { pass: false, error: `HTTP ${res.status}` };
        failed++;
        return null;
      }
      const parsed = JSON.parse(res.body);
      const r = parsed.results?.[0];
      if (r?.status === 'error') {
        console.log(`✗ ${r.error?.slice(0,150) || 'unknown error'}`);
        results[name] = { pass: false, error: r.error };
        failed++;
        return null;
      }
      if (validate) {
        const ok = validate(r, parsed);
        if (!ok) {
          console.log(`✗ validation failed`);
          results[name] = { pass: false, error: 'validation' };
          failed++;
          return parsed;
        }
      }
      console.log(`✓`);
      results[name] = { pass: true };
      passed++;
      return parsed;
    } catch (e) {
      console.log(`✗ ${e.message.slice(0,100)}`);
      results[name] = { pass: false, error: e.message };
      failed++;
      return null;
    }
  }

  console.log('\n── Phase 1: Direct Command Tests ───────────────────────────\n');

  await test('1. list_tree', [{ type: 'list_tree', project: PROJECT }],
    (r) => r?.data && (typeof r.data === 'string' || typeof r.data === 'object'));

  await test('2. detect_structure', [{ type: 'detect_structure', project: PROJECT }],
    (r) => r?.data);

  await test('3. read_file', [{ type: 'read_file', project: PROJECT, path: 'components/hero-home.tsx' }],
    (r) => r?.data?.content?.length > 0 || (typeof r?.data === 'string' && r.data.length > 0));

  await test('4. grep', [{ type: 'grep', project: PROJECT, pattern: 'export', filePattern: '*.tsx' }],
    (r) => r?.data);

  await test('5. search_files', [{ type: 'search_files', project: PROJECT, pattern: 'export' }],
    (r) => r?.data);

  await test('6. create_file', [{ type: 'create_file', project: PROJECT, path: '_test_bridge_cmd.txt', content: 'bridge-test-' + Date.now() }],
    (r) => r?.status === 'ok' || r?.status === 'success');

  await test('7. write_file', [{ type: 'write_file', project: PROJECT, path: '_test_bridge_cmd.txt', content: 'updated-' + Date.now() }],
    (r) => r?.status === 'ok' || r?.status === 'success');

  await test('8. copy_file', [{ type: 'copy_file', project: PROJECT, source: '_test_bridge_cmd.txt', dest: '_test_bridge_copy.txt' }],
    (r) => r?.status === 'ok' || r?.status === 'success');

  await test('9. rename_file', [{ type: 'rename_file', project: PROJECT, source: '_test_bridge_copy.txt', dest: '_test_bridge_renamed.txt' }],
    (r) => r?.status === 'ok' || r?.status === 'success');

  await test('10. move_file', [{ type: 'move_file', project: PROJECT, source: '_test_bridge_renamed.txt', dest: '_test_bridge_moved.txt' }],
    (r) => r?.status === 'ok' || r?.status === 'success');

  await test('11. delete_file (cleanup)', [{ type: 'delete_file', project: PROJECT, path: '_test_bridge_cmd.txt' }],
    (r) => r?.status === 'ok' || r?.status === 'success');
  await postActions(cmdUrl, [{ type: 'delete_file', project: PROJECT, path: '_test_bridge_moved.txt' }]);

  await test('12. run_command', [{ type: 'run_command', project: PROJECT, command: 'echo "bridge-test-ok"' }],
    (r) => r?.data && JSON.stringify(r.data).includes('bridge-test-ok'));

  await test('13. install_deps', [{ type: 'install_deps', project: PROJECT }],
    (r) => r?.status === 'ok' || r?.status === 'success');

  await test('14. git_init', [{ type: 'git_init', project: PROJECT }],
    (r) => r?.data !== undefined);

  await postActions(cmdUrl, [
    { type: 'run_command', project: PROJECT, command: 'git config --global user.email "test@lamby.dev"' },
    { type: 'run_command', project: PROJECT, command: 'git config --global user.name "Lamby Test"' }
  ]);

  await test('15. git_add', [{ type: 'git_add', project: PROJECT, files: '.' }],
    (r) => r?.data !== undefined);

  await test('16. git_commit', [{ type: 'git_commit', project: PROJECT, message: 'bridge test initial' }]);

  await test('17. git_status', [{ type: 'git_status', project: PROJECT }],
    (r) => r?.data !== undefined);

  await test('18. git_diff', [{ type: 'git_diff', project: PROJECT }],
    (r) => r?.data !== undefined);

  await test('19. git_log', [{ type: 'git_log', project: PROJECT, count: 3 }],
    (r) => r?.data !== undefined);

  await test('20. git_branch', [{ type: 'git_branch', project: PROJECT }],
    (r) => r?.data !== undefined);

  await test('21. git_stash', [{ type: 'git_stash', project: PROJECT, args: 'list' }],
    (r) => r?.data !== undefined);

  await test('22. git_checkout', [{ type: 'git_checkout', project: PROJECT, ref: 'master' }]);

  await test('23. start_process', [{ type: 'start_process', project: PROJECT, command: 'sleep 30', name: 'test-proc' }],
    (r) => r?.data !== undefined || r?.status === 'ok' || r?.status === 'success');

  await test('24. list_processes', [{ type: 'list_processes', project: PROJECT }],
    (r) => r?.data !== undefined);

  await test('25. kill_process', [{ type: 'kill_process', project: PROJECT, name: 'test-proc' }],
    (r) => r?.status === 'ok' || r?.status === 'success' || r?.data);

  console.log(`\n  Phase 1 Results: ${passed}/${passed + failed} passed\n`);

  console.log('── Phase 2: Grok Agentic Test ──────────────────────────────');
  console.log('  Asking Grok to make a visible change to hero-home.tsx...\n');

  const origRes = await postActions(cmdUrl, [{ type: 'read_file', project: PROJECT, path: 'components/hero-home.tsx' }]);
  const origContent = JSON.parse(origRes.body).results?.[0]?.data?.content ||
                      JSON.parse(origRes.body).results?.[0]?.data || '';
  const origSnapshot = origContent.slice(0, 500);
  fs.writeFileSync(path.join(LOG_DIR, 'hero_before.txt'), typeof origContent === 'string' ? origContent : JSON.stringify(origContent));

  const systemPrompt = `You are an autonomous coding agent. You make changes by outputting JSON action blocks.

ENDPOINT: POST ${cmdUrl}
FORMAT: \`\`\`json
{"actions": [{"type": "ACTION", "project": "${PROJECT}", ...params}]}
\`\`\`

CRITICAL: Every action MUST include "project": "${PROJECT}". Without it, the action will fail.

Available commands: list_tree, read_file, write_file, create_file, delete_file, move_file, copy_file, rename_file, grep, search_files, run_command, install_deps, git_status, git_add, git_commit, git_diff, git_log, git_branch, git_checkout, git_stash, git_init, detect_structure, start_process, kill_process, list_processes, build_project, run_tests

Examples:
- {"type":"read_file","project":"${PROJECT}","path":"components/hero-home.tsx"}
- {"type":"write_file","project":"${PROJECT}","path":"components/hero-home.tsx","content":"COMPLETE FILE"}
- {"type":"list_tree","project":"${PROJECT}"}

Key rules:
- EVERY action must have "project": "${PROJECT}"
- write_file content must be the COMPLETE file — every import, every line, every closing bracket
- Output JSON action blocks, do NOT just describe changes
- When done, say DONE`;

  const conversation = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `First read the file components/hero-home.tsx, then write back the complete modified version.

Changes needed:
1. Change the main heading text to "Build Anything with Lamby"
2. Change the subtitle to mention "AI-powered autonomous development"
3. Change any blue/indigo CSS classes to violet/purple equivalents

IMPORTANT: First do a read_file to get the current contents, then do write_file with the COMPLETE updated file. Both actions must include "project": "${PROJECT}".` }
  ];

  let grokWrites = 0;
  let grokTurns = 0;
  const MAX_TURNS = 6;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    grokTurns = turn;
    console.log(`  Turn ${turn}/${MAX_TURNS}...`);
    const t0 = Date.now();
    const resp = await callXAI(conversation);
    const ms = Date.now() - t0;

    if (resp.error) {
      console.log(`  API Error: ${JSON.stringify(resp.error)}`);
      break;
    }

    const content = resp.choices?.[0]?.message?.content || '';
    console.log(`  Response: ${content.length} chars in ${(ms/1000).toFixed(1)}s`);
    fs.writeFileSync(path.join(LOG_DIR, `grok25_turn_${turn}.txt`), content);
    conversation.push({ role: 'assistant', content });

    const actions = extractActionBlocks(content);
    if (actions.length > 0) {
      const reads = actions.filter(a => ['read_file','list_tree','grep','search_files','detect_structure','git_status','git_diff','git_log','git_branch','list_processes'].includes(a.type));
      const writes = actions.filter(a => !reads.includes(a));
      console.log(`  Actions: ${actions.length} (${reads.length} reads, ${writes.length} writes)`);
      for (const a of actions.slice(0,5)) {
        const detail = a.path || a.pattern || '';
        const sz = a.content ? ` (${a.content.length}ch)` : '';
        console.log(`    ${a.type} ${detail}${sz}`);
      }

      const bridgeRes = await postActions(cmdUrl, actions);
      console.log(`  Bridge: ${bridgeRes.status}`);
      let parsed;
      try { parsed = JSON.parse(bridgeRes.body); } catch { parsed = { raw: bridgeRes.body.slice(0,2000) }; }

      if (parsed.results) {
        for (const r of parsed.results) {
          if (r.status === 'error') console.log(`  ✗ ${r.type}: ${(r.error||'').slice(0,150)}`);
        }
      }

      grokWrites += writes.length;
      const summary = JSON.stringify(parsed).slice(0, 6000);
      conversation.push({ role: 'user', content: `Results:\n${summary}\n\n${writes.length > 0 ? 'If done, say DONE.' : 'Now make the changes.'}` });

      if (/\bDONE\b/.test(content) && writes.length > 0) {
        console.log('  Grok signaled DONE with writes');
        break;
      }
    } else if (/\bDONE\b/.test(content)) {
      console.log('  Grok signaled DONE');
      break;
    } else {
      console.log(`  No actions found, nudging...`);
      conversation.push({ role: 'user', content: 'Output a ```json action block now. Start with:\n```json\n{"actions":[{"type":"read_file","project":"landing-page","path":"components/hero-home.tsx"}]}\n```' });
    }
  }

  console.log(`\n  Grok turns: ${grokTurns}, writes: ${grokWrites}`);

  console.log('\n── Phase 3: Verification ────────────────────────────────────\n');

  const afterRes = await postActions(cmdUrl, [{ type: 'read_file', project: PROJECT, path: 'components/hero-home.tsx' }]);
  let afterContent = '';
  try {
    const ap = JSON.parse(afterRes.body);
    afterContent = ap.results?.[0]?.data?.content || ap.results?.[0]?.data || '';
  } catch {}
  if (typeof afterContent !== 'string') afterContent = JSON.stringify(afterContent);
  fs.writeFileSync(path.join(LOG_DIR, 'hero_after.txt'), afterContent);

  const lower = afterContent.toLowerCase();
  const checks = {
    hasLamby: lower.includes('lamby'),
    hasNewHeading: lower.includes('build anything with lamby'),
    hasAIPowered: lower.includes('ai-powered') || lower.includes('ai powered') || lower.includes('autonomous'),
    hasViolet: lower.includes('violet') || lower.includes('purple') || lower.includes('#7c3aed') || lower.includes('#8b5cf6'),
    fileChanged: afterContent !== origContent && afterContent.length > 100,
    isComplete: afterContent.includes('export') && (afterContent.includes('function') || afterContent.includes('=>'))
  };

  console.log('  Verification checks:');
  for (const [k, v] of Object.entries(checks)) {
    console.log(`    ${v ? '✓' : '✗'} ${k}`);
  }

  const allPhase2Passed = checks.hasLamby && checks.fileChanged && checks.isComplete;
  const phase1AllPassed = failed === 0;

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  Phase 1 (Direct commands): ${passed}/${passed + failed} passed ${phase1AllPassed ? '✓' : '✗'}`);
  console.log(`  Phase 2 (Grok agentic):    ${allPhase2Passed ? 'PASSED ✓' : 'INCOMPLETE ✗'}`);
  console.log(`    Grok writes: ${grokWrites}, file changed: ${checks.fileChanged}`);
  console.log('══════════════════════════════════════════════════════════════');

  if (phase1AllPassed && allPhase2Passed) {
    console.log('\n  ✓ ALL TESTS PASSED — Bridge is working end-to-end!\n');
  } else {
    console.log('\n  ✗ Some tests failed — check details above.\n');
  }

  fs.writeFileSync(path.join(LOG_DIR, 'e2e_25cmd_summary.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    model: MODEL,
    phase1: { passed, failed, total: passed + failed, results },
    phase2: { grokTurns, grokWrites, checks, passed: allPhase2Passed },
    overall: phase1AllPassed && allPhase2Passed
  }, null, 2));

  console.log(`  Logs: ${LOG_DIR}/grok25_turn_*.txt, hero_before.txt, hero_after.txt\n`);
  if (!phase1AllPassed || !allPhase2Passed) process.exit(1);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
