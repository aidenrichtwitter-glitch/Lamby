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

export function parseCodeBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const regex = new RegExp(
    `(?:(?:\\/\\/|#|<!--)\\s*(?:file:\\s?)?(${FILE_EXT_PATTERN})\\s*(?:-->)?\\s*\\n)?\`\`\`(\\w+)?\\n([\\s\\S]*?)\`\`\``,
    'g'
  );
  let match;
  while ((match = regex.exec(text)) !== null) {
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
