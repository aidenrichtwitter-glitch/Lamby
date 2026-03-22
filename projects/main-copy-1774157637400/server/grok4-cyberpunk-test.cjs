const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const XAI_API = process.env.XAI_API;
const RELAY = "https://bridge-relay.replit.app";
const LOCAL = "http://localhost:5000";
const MODEL = "grok-4";
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

async function main() {
  if (!XAI_API) { console.error('XAI_API not set'); process.exit(1); }

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  GROK-4 CYBERPUNK THEME TEST v2                ║');
  console.log('║  Neon cyberpunk + polished buttons & fonts      ║');
  console.log('╚══════════════════════════════════════════════════╝');

  const keyRes = await httpRequest(`${LOCAL}/api/snapshot-key`, { method: 'GET', timeout: 5000 });
  const key = JSON.parse(keyRes.body).key;
  const cmdUrl = `${RELAY}/api/sandbox/execute?key=${key}`;
  console.log(`  Key: ${key.slice(0,8)}...  Model: ${MODEL}\n`);

  const origRes = await postActions(cmdUrl, [{ type: 'read_file', project: PROJECT, path: 'components/hero-home.tsx' }]);
  const origContent = JSON.parse(origRes.body).results?.[0]?.data?.content || JSON.parse(origRes.body).results?.[0]?.data || '';
  fs.writeFileSync(path.join(LOG_DIR, 'cyber_before.txt'), typeof origContent === 'string' ? origContent : JSON.stringify(origContent));
  console.log(`  Original hero: ${typeof origContent === 'string' ? origContent.length : 0} chars\n`);

  const systemPrompt = `You are an autonomous coding agent with full read/write access to a Next.js project.

ENDPOINT: POST ${cmdUrl}
FORMAT:
\`\`\`json
{"actions": [{"type": "ACTION", "project": "${PROJECT}", ...params}]}
\`\`\`

CRITICAL RULES:
1. Every action MUST include "project": "${PROJECT}"
2. write_file content MUST be the COMPLETE file — every import, every JSX tag, every closing bracket/brace. NEVER truncate or abbreviate.
3. After writing, do a read_file to verify the file is complete
4. Output \`\`\`json action blocks
5. When fully done AND verified, say DONE

Available commands: list_tree, read_file, write_file, create_file, delete_file, move_file, copy_file, rename_file, grep, search_files, run_command, install_deps, git_status, git_add, git_commit, git_diff, git_log, git_branch, git_checkout, git_stash, git_init, detect_structure, start_process, kill_process, list_processes, build_project, run_tests

ANTI-TRUNCATION WARNING: The file compiles immediately via Next.js. Missing closing tags/braces = broken build. Write EVERY line. No "// rest of file" shortcuts.`;

  const conversation = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Transform hero-home.tsx into a neon cyberpunk theme with polished, professional styling.

1. Read components/hero-home.tsx
2. Rewrite it with:
   - Dark background (black/gray-950)
   - Neon colors: cyan (#00FFFF), magenta (#FF00FF), electric green (#39FF14)
   - Glowing text effects via inline style text-shadow
   - Heading: "Lamby — Code at Light Speed"
   - Subtitle: "Neon-powered autonomous AI development"
   
   BUTTONS (critical — must look polished):
   - Both buttons MUST have the EXACT SAME height (use py-3 px-6 on both)
   - Use Tailwind classes only for sizing: text-sm font-semibold rounded-lg
   - Primary button: bg-cyan-500 text-black hover:bg-cyan-400, with a subtle cyan glow via inline boxShadow
   - Secondary button: transparent border border-cyan-400 text-cyan-400 hover:bg-cyan-400/10
   - Wrap both buttons in a flex container with items-center gap-4 to guarantee alignment
   - Do NOT use different padding, font-size, or line-height between buttons
   
   FONT:
   - Use font-sans (system default Inter/sans-serif stack) for everything — do NOT use monospace or decorative fonts
   - Heading should be text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight
   
   - MUST use "export default function HeroHome()" — default export required, other files import it as default
   - Keep the Image import from "next/image" and PageIllustration import from "@/components/page-illustration" — these are used in the original
   - Keep same component structure so it compiles
3. Verify by reading the file back
4. Say DONE

Write the COMPLETE file — every line, every tag, every brace.` }
  ];

  const t0 = Date.now();
  let writes = 0;
  const MAX_TURNS = 10;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    process.stdout.write(`  Turn ${turn}/${MAX_TURNS}... `);
    let resp;
    try {
      resp = await callXAI(conversation);
    } catch (err) {
      console.log(`\n  ✗ xAI call failed on turn ${turn}: ${err.message}`);
      break;
    }
    const ms = Date.now() - t0;

    if (resp.error) { console.log(`API Error: ${JSON.stringify(resp.error)}`); break; }

    const content = resp.choices?.[0]?.message?.content || '';
    console.log(`${content.length}ch ${(ms/1000).toFixed(0)}s`);
    fs.writeFileSync(path.join(LOG_DIR, `cyber_turn_${turn}.txt`), content);
    conversation.push({ role: 'assistant', content });

    const actions = extractActionBlocks(content);
    if (actions.length > 0) {
      const reads = actions.filter(a => ['read_file','list_tree','grep','search_files','detect_structure','git_status','git_diff','git_log','git_branch','list_processes'].includes(a.type));
      const writeActions = actions.filter(a => !reads.includes(a));
      for (const a of actions) {
        const sz = a.content ? ` (${a.content.length}ch)` : '';
        console.log(`    ${a.type} ${a.path || ''}${sz}`);
      }

      const bridgeRes = await postActions(cmdUrl, actions);
      let parsed;
      try { parsed = JSON.parse(bridgeRes.body); } catch { parsed = { raw: bridgeRes.body.slice(0,2000) }; }

      if (parsed.results) {
        for (const r of parsed.results) {
          if (r.status === 'error') console.log(`    ✗ ${r.type}: ${(r.error||'').slice(0,150)}`);
        }
      }

      writes += writeActions.length;
      const summary = JSON.stringify(parsed).slice(0, 8000);
      conversation.push({ role: 'user', content: `Results:\n${summary}\n\n${writeActions.length > 0 ? 'Verify the file is complete by reading it back, then say DONE.' : 'Continue.'}` });

      if (/\bDONE\b/.test(content) && writeActions.length === 0 && writes > 0) {
        console.log('  ✓ Grok verified and signaled DONE');
        break;
      }
    } else if (/\bDONE\b/.test(content) && writes > 0) {
      console.log('  ✓ Grok signaled DONE');
      break;
    } else {
      conversation.push({ role: 'user', content: 'Output a ```json action block. Example:\n```json\n{"actions":[{"type":"read_file","project":"landing-page","path":"components/hero-home.tsx"}]}\n```' });
    }
  }

  const totalMs = Date.now() - t0;
  console.log(`\n  Total: ${writes} writes, ${(totalMs/1000).toFixed(0)}s\n`);

  const afterRes = await postActions(cmdUrl, [{ type: 'read_file', project: PROJECT, path: 'components/hero-home.tsx' }]);
  let afterContent = '';
  try {
    const ap = JSON.parse(afterRes.body);
    afterContent = ap.results?.[0]?.data?.content || ap.results?.[0]?.data || '';
  } catch {}
  if (typeof afterContent !== 'string') afterContent = JSON.stringify(afterContent);
  fs.writeFileSync(path.join(LOG_DIR, 'cyber_after.txt'), afterContent);

  const lower = afterContent.toLowerCase();
  const checks = {
    hasLamby: lower.includes('lamby'),
    hasCyberpunk: lower.includes('light speed') || lower.includes('neon') || lower.includes('cyberpunk'),
    hasNeonColors: lower.includes('#00ffff') || lower.includes('cyan') || lower.includes('#ff00ff') || lower.includes('magenta') || lower.includes('#39ff14'),
    hasDarkBg: lower.includes('bg-black') || lower.includes('bg-gray-9') || lower.includes('#000') || lower.includes('#0a') || lower.includes('#111'),
    hasGlow: lower.includes('shadow') || lower.includes('glow'),
    fileChanged: afterContent.length > 100 && afterContent !== origContent,
    isComplete: afterContent.includes('export') && (afterContent.includes('function') || afterContent.includes('=>')),
    jsxClosed: afterContent.trim().endsWith('}'),
    defaultExport: afterContent.includes('export default'),
    fontSans: lower.includes('font-sans') || lower.includes('font-extrabold') || lower.includes('tracking-tight'),
    buttonsAligned: lower.includes('items-center') && lower.includes('py-3') && lower.includes('px-6'),
    noMonoFont: !lower.includes('font-mono') && !lower.includes('courier') && !lower.includes('fira code')
  };

  console.log('  Checks:');
  let allPass = true;
  for (const [k, v] of Object.entries(checks)) {
    console.log(`    ${v ? '✓' : '✗'} ${k}`);
    if (!v) allPass = false;
  }

  console.log(allPass
    ? '\n  ✓ CYBERPUNK THEME APPLIED SUCCESSFULLY!\n'
    : '\n  ✗ Some checks failed — see above\n');

  fs.writeFileSync(path.join(LOG_DIR, 'cyber_summary.json'), JSON.stringify({
    timestamp: new Date().toISOString(), model: MODEL, writes, durationMs: totalMs, checks, passed: allPass
  }, null, 2));

  if (!allPass) process.exit(1);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
