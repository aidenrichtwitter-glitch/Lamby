import { describe, it, expect } from 'vitest';
import { parseCodeBlocks } from '@/lib/code-parser';
import { validateChange } from '@/lib/safety-engine';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const CHAT_URL = `${SUPABASE_URL}/functions/v1/grok-chat`;
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

describe('parseCodeBlocks — simulated responses', () => {
  it('parses a single code block with file path', () => {
    const response = `Here's the file:

// file: src/lib/greeter.ts
\`\`\`typescript
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

That should work!`;

    const blocks = parseCodeBlocks(response);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].filePath).toBe('src/lib/greeter.ts');
    expect(blocks[0].language).toBe('typescript');
    expect(blocks[0].code).toContain('export function greet');
  });

  it('parses multiple code blocks with different file paths', () => {
    const response = `I'll create two files:

// file: src/lib/greeter.ts
\`\`\`typescript
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

And the test:

// file: src/test/greeter.test.ts
\`\`\`typescript
import { greet } from '../lib/greeter';
expect(greet('World')).toBe('Hello, World!');
\`\`\`

Done!`;

    const blocks = parseCodeBlocks(response);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].filePath).toBe('src/lib/greeter.ts');
    expect(blocks[1].filePath).toBe('src/test/greeter.test.ts');
  });

  it('handles code blocks without file paths', () => {
    const response = `Run this command:

\`\`\`bash
npm install lodash
\`\`\`

Then use it like this:

\`\`\`typescript
import _ from 'lodash';
console.log(_.camelCase('hello world'));
\`\`\``;

    const blocks = parseCodeBlocks(response);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].filePath).toBe('');
    expect(blocks[0].language).toBe('bash');
    expect(blocks[1].filePath).toBe('');
    expect(blocks[1].language).toBe('typescript');
  });

  it('handles hash-style file path comments (Python/shell)', () => {
    const response = `# file: src/utils/helper.ts
\`\`\`typescript
export const helper = () => 'helped';
\`\`\``;

    const blocks = parseCodeBlocks(response);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].filePath).toBe('src/utils/helper.ts');
  });

  it('handles HTML-style file path comments', () => {
    const response = `<!-- file: src/components/App.tsx -->
\`\`\`tsx
export default function App() { return <div>Hello</div>; }
\`\`\``;

    const blocks = parseCodeBlocks(response);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].filePath).toBe('src/components/App.tsx');
  });

  it('handles Python and SQL file path comments', () => {
    const response = `# file: scripts/migrate.py
\`\`\`py
def migrate():
    pass
\`\`\`

// file: db/schema.sql
\`\`\`sql
CREATE TABLE users (id SERIAL PRIMARY KEY);
\`\`\``;

    const blocks = parseCodeBlocks(response);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].filePath).toBe('scripts/migrate.py');
    expect(blocks[1].filePath).toBe('db/schema.sql');
  });

  it('returns empty array for text with no code blocks', () => {
    const blocks = parseCodeBlocks('Just a regular message with no code.');
    expect(blocks).toHaveLength(0);
  });
});

describe('Safety engine integration', () => {
  it('passes clean generated code', () => {
    const code = `export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}`;
    const checks = validateChange(code, 'src/lib/greeter.ts');
    const errors = checks.filter(c => c.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('catches dangerous code in generated output', () => {
    const code = `function bad() { while(true) { console.log('loop'); } }`;
    const checks = validateChange(code, 'src/lib/bad.ts');
    const runtime = checks.find(c => c.type === 'runtime' && c.severity === 'error');
    expect(runtime).toBeTruthy();
  });
});

describe('Error feedback prompt format', () => {
  it('generates properly structured error prompt', () => {
    const errorText = "src/lib/greeter.ts(3,5): error TS2304: Cannot find name 'xyz'.";
    const projectContext = '=== PROJECT CONTEXT ===\nTest project';

    const errorPrompt = `The following errors occurred after applying code changes:\n\n${errorText}\n\n` +
      `Please fix these errors. Return the corrected files using this format:\n` +
      `// file: path/to/file.tsx\n\`\`\`tsx\n// corrected content\n\`\`\`\n\n` +
      `Current project context:\n${projectContext.slice(0, 3000)}`;

    expect(errorPrompt).toContain(errorText);
    expect(errorPrompt).toContain('// file: path/to/file.tsx');
    expect(errorPrompt).toContain('Please fix these errors');
    expect(errorPrompt).toContain('PROJECT CONTEXT');
  });
});

describe('Live Grok API pipeline test', () => {
  const canRunLive = SUPABASE_URL && SUPABASE_KEY;

  it.skipIf(!canRunLive)('sends prompt to Grok, parses code blocks, validates, and saves fixture', async () => {
    const prompt = 'Add a greet(name: string) function to src/lib/greeter.ts that returns a greeting string like "Hello, {name}! Welcome to Guardian AI." Return the complete file content with proper TypeScript exports.';

    const messages = [{ role: 'user', content: prompt }];

    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ messages, model: 'grok-3-mini' }),
    });

    expect(resp.ok).toBe(true);
    expect(resp.body).toBeTruthy();

    const reader = resp.body!.getReader();
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

    expect(fullResponse.length).toBeGreaterThan(20);
    console.log('\n=== GROK RAW RESPONSE ===');
    console.log(fullResponse);
    console.log('=== END RESPONSE ===\n');

    const blocks = parseCodeBlocks(fullResponse);
    console.log(`Detected ${blocks.length} code block(s):`);
    blocks.forEach((b, i) => {
      console.log(`  [${i}] file: "${b.filePath}" lang: ${b.language} (${b.code.length} chars)`);
    });

    expect(blocks.length).toBeGreaterThanOrEqual(1);

    const tsBlocks = blocks.filter(b => b.filePath.endsWith('.ts') || b.filePath.endsWith('.tsx'));
    if (tsBlocks.length > 0) {
      expect(tsBlocks[0].filePath).toContain('greeter');
      expect(tsBlocks[0].code).toContain('greet');
    }

    const safetyResults = blocks.map(b => ({
      filePath: b.filePath,
      checks: validateChange(b.code, b.filePath || 'unknown.ts'),
    }));

    safetyResults.forEach(r => {
      const errors = r.checks.filter(c => c.severity === 'error');
      console.log(`  Safety for "${r.filePath}": ${r.checks.length} checks, ${errors.length} errors`);
      expect(errors).toHaveLength(0);
    });

    const fixture = {
      timestamp: new Date().toISOString(),
      prompt,
      model: 'grok-3-mini',
      rawResponse: fullResponse,
      parsedBlocks: blocks,
      safetyResults: safetyResults.map(r => ({
        filePath: r.filePath,
        checkCount: r.checks.length,
        errors: r.checks.filter(c => c.severity === 'error').map(c => c.message),
        warnings: r.checks.filter(c => c.severity === 'warning').map(c => c.message),
      })),
      pipelineStages: {
        apiCall: 'PASS',
        streaming: 'PASS',
        blockParsing: blocks.length > 0 ? 'PASS' : 'FAIL',
        filePathDetection: tsBlocks.length > 0 ? 'PASS' : 'WARN',
        safetyValidation: safetyResults.every(r => r.checks.filter(c => c.severity === 'error').length === 0) ? 'PASS' : 'FAIL',
      },
    };

    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'grok-pipeline-response.json'),
      JSON.stringify(fixture, null, 2)
    );

    console.log('\nPipeline stages:', JSON.stringify(fixture.pipelineStages, null, 2));
    console.log(`Fixture saved to src/test/fixtures/grok-pipeline-response.json`);
  }, 30000);
});
