export interface ParsedBlock {
  filePath: string;
  code: string;
  language: string;
}

const FILE_EXT_PATTERN = '\\S+\\.(?:tsx?|jsx?|css|html|json|md|py|sh|sql|yaml|yml|toml|env|cfg|conf|xml|svg|vue|svelte|go|rs|rb|java|kt|swift|c|cpp|h|hpp)';

function extractFilePathFromCode(code: string): { filePath: string; cleanedCode: string } {
  const lines = code.split('\n');
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const line = lines[i].trim();
    const inlineMatch = line.match(new RegExp(`^(?:\\/\\/|#|/\\*|<!--)\\s*(?:file:\\s?|filename:\\s?)(${FILE_EXT_PATTERN})`, 'i'));
    if (inlineMatch) {
      const remaining = [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n').trim();
      return { filePath: inlineMatch[1], cleanedCode: remaining };
    }
  }
  return { filePath: '', cleanedCode: code };
}

export function mergeCSSVariables(snippet: string, existingCSS: string): string | null {
  const varRegex = /--[\w-]+:\s*[^;]+;/g;
  const newVars = new Map<string, string>();
  let match;
  while ((match = varRegex.exec(snippet)) !== null) {
    const line = match[0];
    const name = line.match(/^(--[\w-]+):/)?.[1];
    if (name) newVars.set(name, line);
  }
  if (newVars.size === 0) return null;

  let merged = existingCSS;
  for (const [name, fullLine] of newVars) {
    const existingRegex = new RegExp(`(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}):\\s*[^;]+;`, 'g');
    if (existingRegex.test(merged)) {
      merged = merged.replace(existingRegex, fullLine);
    }
  }

  const bodyMatch = snippet.match(/body\s*\{[\s\S]*?\}/);
  if (bodyMatch && !merged.includes(bodyMatch[0])) {
  }

  return merged !== existingCSS ? merged : null;
}

export function isLikelySnippet(code: string, existingContent: string): boolean {
  if (!existingContent || existingContent.length === 0) return false;
  const codeLines = code.split('\n').length;
  const existingLines = existingContent.split('\n').length;
  return existingLines > 20 && (codeLines / existingLines) < 0.5;
}

export function parseCodeBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const regex = new RegExp(
    `(?:(?:\\/\\/|#|<!--)\\s*(?:file:\\s?)?(${FILE_EXT_PATTERN})\\s*(?:-->)?\\s*\\n)?\`\`\`(\\w+)?\\n([\\s\\S]*?)\`\`\``,
    'g'
  );
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    let filePath = match[1] || '';
    const language = match[2] || 'typescript';
    let code = match[3].trim();

    if (!filePath) {
      const extracted = extractFilePathFromCode(code);
      if (extracted.filePath) {
        filePath = extracted.filePath;
        code = extracted.cleanedCode;
      }
    }

    if (code.length > 0) blocks.push({ filePath, code, language });
  }
  return blocks;
}
