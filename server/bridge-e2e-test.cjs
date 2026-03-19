const fs = require('fs');
const https = require('https');
const path = require('path');

const XAI_API = process.env.XAI_API;
const BRIDGE_KEY = process.argv[2] || "173adfecab895f4ba0325859a78d951a";
const RELAY = "https://bridge-relay.replit.app";
const CMD_URL = `${RELAY}/api/sandbox/execute?key=${BRIDGE_KEY}`;

function postJSON(url, obj) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(obj);
    const parsed = new URL(url);
    const req = https.request(parsed, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== STEP 1: Copy project context ===');
  const base = path.resolve(__dirname, '../projects/landing-page');
  const fileList = [
    'app/layout.tsx',
    'components/hero-home.tsx',
    'components/features-planet.tsx',
    'components/cta.tsx',
    'components/large-testimonial.tsx',
  ];
  let context = '';
  for (const fp of fileList) {
    context += `--- ${fp} ---\n${fs.readFileSync(path.join(base, fp), 'utf-8')}\n\n`;
  }
  console.log(`Context: ${context.length} chars, ${fileList.length} files`);

  console.log('\n=== STEP 2: Send context + change request to xAI API (grok-4) ===');
  const body = JSON.stringify({
    model: 'grok-4',
    stream: false,
    max_tokens: 40000,
    messages: [
      { role: 'system', content: `Output ONLY valid JSON. No markdown, no explanation, no code fences. Respond with: {"actions":[{type:"write_file",project:"landing-page",path:"...",content:"COMPLETE file content"},...]}\nEach file MUST be complete — every import, every line, every closing bracket. Do NOT truncate.` },
      { role: 'user', content: `Rebrand this Next.js landing page from "Simple" to "Lamby" (AI-powered autonomous development IDE).\n\nChanges:\n1. app/layout.tsx: title="Lamby - AI-Powered Development", bg=#0b0f1a\n2. hero-home.tsx: heading="Build Anything with Lamby", subtitle about AI IDE, buttons="Start Building"/"See It Work", terminal=lamby commands, blue→violet\n3. features-planet.tsx: heading="Lamby does the heavy lifting", 6 AI features with unique descriptions, blue→violet\n4. cta.tsx: heading="Ship faster with Lamby", button="Get Started Free", blue→violet\n5. large-testimonial.tsx: Lamby quote, "Alex Chen"/"Lead Engineer at Vercel", blue→violet\n\nProject files:\n${context}` }
    ]
  });

  console.log(`Calling grok-4 (${body.length} bytes)...`);
  const start = Date.now();

  const response = await new Promise((resolve, reject) => {
    const req = https.request('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API}`, 'Content-Length': Buffer.byteLength(body) },
      timeout: 600000
    }, res => {
      let d = '';
      res.on('data', c => { d += c; if (d.length % 5000 < 100) process.stderr.write(`\r${d.length} bytes...`); });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('Parse: ' + d.substring(0, 300))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  if (response.error) { console.error(`\nAPI Error after ${elapsed}s:`, JSON.stringify(response.error)); process.exit(1); }

  const content = response.choices[0].message.content;
  console.log(`\nGrok-4 responded in ${elapsed}s (${content.length} chars)`);
  fs.writeFileSync(path.join(__dirname, 'grok4_response.txt'), content);

  let cleaned = content.replace(/^```json?\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch(e) {
    console.error('JSON parse failed:', e.message);
    console.log('First 500:', cleaned.substring(0, 500));
    process.exit(1);
  }

  const actions = parsed.actions || [];
  console.log(`\nGrok generated ${actions.length} actions:`);
  for (const a of actions) console.log(`  ${a.type} ${a.path} (${(a.content||'').length} chars)`);

  console.log(`\n=== POSTing ${actions.length} actions to bridge: ${CMD_URL} ===`);
  const result = await postJSON(CMD_URL, { actions });
  console.log(`Bridge response: ${result.status}`);
  console.log(result.body.substring(0, 1000));

  if (result.status === 200) {
    console.log('\n=== SUCCESS: All changes applied through bridge! ===');
  } else {
    console.log('\n=== BRIDGE ERROR ===');
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
