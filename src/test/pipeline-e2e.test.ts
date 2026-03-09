import { describe, it, expect } from 'vitest';
import { parseCodeBlocks } from '@/lib/code-parser';
import { validateChange } from '@/lib/safety-engine';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const CHAT_URL = `${SUPABASE_URL}/functions/v1/grok-chat`;
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const canRunLive = SUPABASE_URL && SUPABASE_KEY;

function buildProjectContext(): string {
  const keyFiles = [
    'src/index.css',
    'tailwind.config.ts',
    'src/App.tsx',
    'src/pages/GrokBridge.tsx',
    'package.json',
  ];

  let context = `=== PROJECT CONTEXT ===\n`;
  context += `This is a React + TypeScript + Vite desktop app (Electron) called Guardian AI ("lambda Recursive").\n\n`;

  const allFiles: string[] = [];
  function walk(dir: string, prefix: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (['node_modules', '.git', 'dist', '.guardian-backup', '.local'].includes(entry.name)) continue;
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), rel);
        } else {
          allFiles.push(rel);
        }
      }
    } catch {}
  }
  walk(PROJECT_ROOT, '');

  context += `=== FILE TREE ===\n`;
  const srcFiles = allFiles.filter(f => f.startsWith('src/')).slice(0, 50);
  context += srcFiles.join('\n') + '\n';

  for (const filePath of keyFiles) {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    try {
      let content = fs.readFileSync(fullPath, 'utf-8');
      if (content.length > 6000) content = content.slice(0, 6000) + '\n... (truncated)';
      context += `\n=== ${filePath} ===\n${content}\n`;
    } catch {}
  }

  context += `\n=== INSTRUCTIONS ===\n`;
  context += `When suggesting code changes, use this exact format for each file:\n`;
  context += `// file: path/to/file.tsx\n`;
  context += `\`\`\`css\n// full file content here\n\`\`\`\n`;
  context += `Include the complete file content, not partial patches.\n`;

  return context;
}

async function callGrokAPI(prompt: string, model = 'grok-3-mini', retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await _callGrokAPIOnce(prompt, model);
    } catch (e: any) {
      if (attempt === retries) throw e;
      console.log(`  Attempt ${attempt + 1} failed (${e.message}), retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('Unreachable');
}

async function _callGrokAPIOnce(prompt: string, model: string): Promise<string> {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      model,
    }),
  });

  if (!resp.ok) throw new Error(`API returned ${resp.status}`);
  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let buf = '';
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n')) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') { streamDone = true; break; }
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) fullResponse += c;
      } catch {}
    }
  }

  return fullResponse;
}

describe('End-to-end: change theme from green to blue via Grok API', () => {
  it.skipIf(!canRunLive)('builds project context, sends to Grok, applies CSS changes to disk', async () => {
    const cssPath = path.join(PROJECT_ROOT, 'src/index.css');
    const originalCSS = fs.readFileSync(cssPath, 'utf-8');

    console.log('\n=== Step 1: Building project context (same as Copy Context button) ===');
    const context = buildProjectContext();
    console.log(`Context built: ${context.length} chars`);
    expect(context).toContain('=== PROJECT CONTEXT ===');
    expect(context).toContain('=== src/index.css ===');
    expect(context).toContain('=== FILE TREE ===');
    expect(context).toContain('=== INSTRUCTIONS ===');

    console.log('\n=== Step 2: Sending context + "change green to blue" to Grok ===');
    const userRequest = `I want to change the app theme from green to blue. Replace EVERY occurrence of hue value 140 with 220 throughout the entire file — in CSS variables, in hardcoded hsl() values, in scrollbar styles, in ::selection, in .text-glow, in .scanline, everywhere. The number 140 should not appear as a hue value anywhere in the output. Keep hue 175 (cyan accent) and hue 220 (background) unchanged. Keep hue 0 and 40 unchanged.

Return the complete modified src/index.css file.`;

    const fullPrompt = context + '\n\n=== USER REQUEST ===\n' + userRequest;

    const rawResponse = await callGrokAPI(fullPrompt, 'grok-3-mini');
    console.log(`Response received: ${rawResponse.length} chars`);

    console.log('\n=== Step 3: Parsing code blocks (same as Code Extractor) ===');
    const blocks = parseCodeBlocks(rawResponse);
    console.log(`Detected ${blocks.length} code block(s):`);
    blocks.forEach((b, i) => {
      console.log(`  [${i}] file: "${b.filePath}" lang: ${b.language} (${b.code.length} chars)`);
    });

    expect(blocks.length).toBeGreaterThanOrEqual(1);

    const cssBlock = blocks.find(b => b.filePath === 'src/index.css') ||
                     blocks.find(b => b.filePath.includes('index.css')) ||
                     blocks.find(b => b.language === 'css');
    expect(cssBlock).toBeTruthy();

    const newCSS = cssBlock!.code;

    console.log('\n=== Step 4: Verifying theme changes ===');

    const primaryMatch = newCSS.match(/--primary:\s*([\d]+)/);
    expect(primaryMatch).toBeTruthy();
    const primaryHue = parseInt(primaryMatch![1]);
    console.log(`  --primary hue: ${primaryHue} (expected 200-250, was 140)`);
    expect(primaryHue).toBeGreaterThanOrEqual(200);
    expect(primaryHue).toBeLessThanOrEqual(250);

    expect(newCSS).toContain('@tailwind base');
    expect(newCSS).toContain(':root');
    expect(newCSS).toContain('--background');

    const greenHue140Count = (newCSS.match(/\b140\s+\d+%\s+\d+%/g) || []).length;
    const originalGreenCount = (originalCSS.match(/\b140\s+\d+%\s+\d+%/g) || []).length;
    console.log(`  Green hue 140: was ${originalGreenCount} occurrences, now ${greenHue140Count}`);
    expect(greenHue140Count).toBe(0);

    const accentMatch = newCSS.match(/--accent:\s*([\d]+)/);
    if (accentMatch) {
      const accentHue = parseInt(accentMatch[1]);
      console.log(`  --accent hue: ${accentHue} (expected ~175, unchanged)`);
      expect(accentHue).toBeGreaterThanOrEqual(160);
      expect(accentHue).toBeLessThanOrEqual(190);
    }

    console.log('\n=== Step 5: Safety validation ===');
    const safetyChecks = validateChange(newCSS, 'src/index.css');
    const errors = safetyChecks.filter(c => c.severity === 'error');
    console.log(`  Safety: ${safetyChecks.length} checks, ${errors.length} errors`);
    expect(errors).toHaveLength(0);

    console.log('\n=== Step 6: WRITING CHANGES TO DISK (this changes the live app) ===');
    try {
      fs.writeFileSync(cssPath, newCSS, 'utf-8');
      console.log(`  Wrote ${newCSS.length} chars to src/index.css`);

      const writtenCSS = fs.readFileSync(cssPath, 'utf-8');
      expect(writtenCSS).toBe(newCSS);
      console.log('  Verified file on disk matches expected content');

      const writtenPrimary = writtenCSS.match(/--primary:\s*([\d]+)/);
      expect(writtenPrimary).toBeTruthy();
      expect(parseInt(writtenPrimary![1])).toBeGreaterThanOrEqual(200);
      console.log(`  Verified on-disk --primary hue: ${writtenPrimary![1]}`);
    } finally {
      console.log('\n=== Restoring original CSS ===');
      fs.writeFileSync(cssPath, originalCSS, 'utf-8');
      console.log('  Restored original green theme');
    }

    console.log('\n=== Step 7: Saving fixture ===');
    const fixture = {
      timestamp: new Date().toISOString(),
      testName: 'theme-green-to-blue-applied',
      model: 'grok-3-mini',
      contextLength: context.length,
      rawResponse,
      parsedBlocks: blocks.map(b => ({
        filePath: b.filePath,
        language: b.language,
        codeLength: b.code.length,
      })),
      verification: {
        primaryHue,
        greenRemainingCount: greenHue140Count,
        safetyErrors: errors.length,
        writtenToFile: true,
        filePath: 'src/index.css',
      },
      pipelineStages: {
        contextBuild: 'PASS',
        apiCall: 'PASS',
        streaming: 'PASS',
        blockParsing: blocks.length > 0 ? 'PASS' : 'FAIL',
        filePathDetection: cssBlock ? 'PASS' : 'FAIL',
        themeChange: primaryHue >= 200 && primaryHue <= 250 ? 'PASS' : 'FAIL',
        safetyValidation: errors.length === 0 ? 'PASS' : 'FAIL',
        fileWrite: 'PASS',
      },
      originalCSSPreview: originalCSS.slice(0, 300),
      newCSSPreview: newCSS.slice(0, 300),
    };

    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'grok-theme-change.json'),
      JSON.stringify(fixture, null, 2)
    );

    console.log('\n=== PIPELINE RESULT ===');
    console.log(JSON.stringify(fixture.pipelineStages, null, 2));
    console.log('\nThe app theme was changed from GREEN to BLUE and restored.');
    console.log('Fixture saved to src/test/fixtures/grok-theme-change.json');
  }, 60000);
});
