export interface ParsedBlock {
  filePath: string;
  code: string;
  language: string;
}

export function parseCodeBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const regex = /(?:(?:\/\/|#|<!--)\s*(?:file:\s*)?(\S+\.(?:tsx?|jsx?|css|html|json|md|py|sh|sql|yaml|yml|toml|env|cfg|conf|xml|svg|vue|svelte|go|rs|rb|java|kt|swift|c|cpp|h|hpp))\s*(?:-->)?\s*\n)?```(\w+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const filePath = match[1] || '';
    const language = match[2] || 'typescript';
    const code = match[3].trim();
    if (code.length > 0) blocks.push({ filePath, code, language });
  }
  return blocks;
}
