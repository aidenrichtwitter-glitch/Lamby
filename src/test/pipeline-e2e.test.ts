import { describe, it, expect } from 'vitest';
import { parseCodeBlocks } from '@/lib/code-parser';
import { validateChange } from '@/lib/safety-engine';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const CHAT_URL = `${SUPABASE_URL}/functions/v1/grok-chat`;
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const canRunLive = SUPABASE_URL && SUPABASE_KEY;

const INDEX_CSS = fs.readFileSync(path.resolve(__dirname, '../../src/index.css'), 'utf-8');

async function callGrokAPI(prompt: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await _callGrokAPIOnce(prompt);
    } catch (e: any) {
      if (attempt === retries) throw e;
      console.log(`  Attempt ${attempt + 1} failed (${e.message}), retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('Unreachable');
}

async function _callGrokAPIOnce(prompt: string): Promise<string> {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      model: 'grok-3-mini',
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
  it.skipIf(!canRunLive)('sends index.css + "change green to blue" prompt, verifies blue-themed CSS is returned', async () => {
    const prompt = `Here is the current CSS theme file for my app:

// file: src/index.css
\`\`\`css
${INDEX_CSS}
\`\`\`

I want to change the theme from green to blue. Change all the green-based hues (hue ~140) to blue-based hues (hue ~220-230), and update the terminal-green, glow-green, text-glow, and scanline colors to match. Keep the same saturation/lightness values where possible. Keep the cyan accent as-is.

Return the complete modified file using this exact format:
// file: src/index.css
\`\`\`css
// complete file content
\`\`\``;

    console.log('\n=== Sending theme change request to Grok... ===');
    const rawResponse = await callGrokAPI(prompt);
    console.log(`Response received: ${rawResponse.length} chars`);

    const blocks = parseCodeBlocks(rawResponse);
    console.log(`Parsed ${blocks.length} code block(s)`);
    blocks.forEach((b, i) => {
      console.log(`  [${i}] file: "${b.filePath}" lang: ${b.language} (${b.code.length} chars)`);
    });

    expect(blocks.length).toBeGreaterThanOrEqual(1);

    const cssBlock = blocks.find(b =>
      b.filePath.includes('index.css') || b.language === 'css'
    );
    expect(cssBlock).toBeTruthy();

    const newCSS = cssBlock!.code;

    console.log('\n=== Verifying theme changes ===');

    const primaryMatch = newCSS.match(/--primary:\s*([\d]+)/);
    expect(primaryMatch).toBeTruthy();
    const primaryHue = parseInt(primaryMatch![1]);
    console.log(`  --primary hue: ${primaryHue} (expected ~210-240, was 140)`);
    expect(primaryHue).toBeGreaterThanOrEqual(200);
    expect(primaryHue).toBeLessThanOrEqual(250);

    const foregroundMatch = newCSS.match(/--foreground:\s*([\d]+)/);
    if (foregroundMatch) {
      const fgHue = parseInt(foregroundMatch[1]);
      console.log(`  --foreground hue: ${fgHue}`);
      expect(fgHue).not.toBe(140);
    }

    const terminalGreenMatch = newCSS.match(/--terminal-green:\s*([\d]+)/);
    if (terminalGreenMatch) {
      const termGreenHue = parseInt(terminalGreenMatch[1]);
      console.log(`  --terminal-green hue: ${termGreenHue} (should be blue ~200-250, was 140)`);
      expect(termGreenHue).toBeGreaterThanOrEqual(200);
    }

    const ringMatch = newCSS.match(/--ring:\s*([\d]+)/);
    if (ringMatch) {
      const ringHue = parseInt(ringMatch[1]);
      console.log(`  --ring hue: ${ringHue} (should be blue, was 140)`);
      expect(ringHue).toBeGreaterThanOrEqual(200);
    }

    const borderMatch = newCSS.match(/--border:\s*([\d]+)/);
    if (borderMatch) {
      const borderHue = parseInt(borderMatch[1]);
      console.log(`  --border hue: ${borderHue} (should be blue, was 140)`);
      expect(borderHue).toBeGreaterThanOrEqual(200);
    }

    expect(newCSS).toContain('--accent');
    const accentMatch = newCSS.match(/--accent:\s*([\d]+)/);
    if (accentMatch) {
      const accentHue = parseInt(accentMatch[1]);
      console.log(`  --accent hue: ${accentHue} (should stay ~175 cyan)`);
      expect(accentHue).toBeLessThan(200);
    }

    expect(newCSS).toContain('@tailwind base');
    expect(newCSS).toContain(':root');
    expect(newCSS).toContain('--background');
    expect(newCSS).toContain('--radius');

    const greenHue140Count = (newCSS.match(/\b140\s+\d+%\s+\d+%/g) || []).length;
    console.log(`  Remaining green (hue 140) occurrences: ${greenHue140Count}`);
    expect(greenHue140Count).toBeLessThanOrEqual(2);

    expect(cssBlock!.filePath).toBe('src/index.css');

    const safetyChecks = validateChange(newCSS, 'src/index.css');
    const errors = safetyChecks.filter(c => c.severity === 'error');
    console.log(`  Safety checks: ${safetyChecks.length} total, ${errors.length} errors`);
    expect(errors).toHaveLength(0);

    const fixture = {
      timestamp: new Date().toISOString(),
      testName: 'theme-green-to-blue',
      prompt: prompt.slice(0, 200) + '...',
      model: 'grok-3-mini',
      rawResponse,
      parsedBlocks: blocks.map(b => ({
        filePath: b.filePath,
        language: b.language,
        codeLength: b.code.length,
        codePreview: b.code.slice(0, 300) + '...',
      })),
      verification: {
        primaryHue: primaryMatch ? parseInt(primaryMatch[1]) : null,
        foregroundHue: foregroundMatch ? parseInt(foregroundMatch[1]) : null,
        greenRemainingCount: greenHue140Count,
        hasRequiredCSSStructure: true,
        safetyErrors: errors.length,
      },
      fullNewCSS: newCSS,
      pipelineStages: {
        apiCall: 'PASS',
        streaming: 'PASS',
        blockParsing: blocks.length > 0 ? 'PASS' : 'FAIL',
        filePathDetection: cssBlock ? 'PASS' : 'FAIL',
        themeChange: primaryHue >= 200 && primaryHue <= 250 ? 'PASS' : 'FAIL',
        safetyValidation: errors.length === 0 ? 'PASS' : 'FAIL',
      },
    };

    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'grok-theme-change.json'),
      JSON.stringify(fixture, null, 2)
    );

    console.log('\n=== Pipeline stages ===');
    console.log(JSON.stringify(fixture.pipelineStages, null, 2));
    console.log(`\nFixture saved to src/test/fixtures/grok-theme-change.json`);
    console.log('\n=== CSS preview (first 500 chars) ===');
    console.log(newCSS.slice(0, 500));
  }, 45000);
});
