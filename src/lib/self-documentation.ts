// ═══════════════════════════════════════════════════
// CAPABILITY: self-documentation-engine
// Automatically generates documentation from code
// structure, without AI calls. Pure deterministic.
// Built on: verification-engine + rule-engine
// ═══════════════════════════════════════════════════

export interface DocEntry {
  file: string;
  exports: ExportDoc[];
  summary: string;
  complexity: 'low' | 'medium' | 'high';
  selfAwareness: number; // 0-1, how much of the file is self-documenting
}

export interface ExportDoc {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'const';
  signature: string;
  description: string; // extracted from JSDoc or inferred
  lineNumber: number;
}

/**
 * Parse a TypeScript file and extract documentation deterministically.
 * No AI needed — pure pattern matching.
 */
export function documentFile(filePath: string, content: string): DocEntry {
  const lines = content.split('\n');
  const exports: ExportDoc[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Extract exported functions
    const funcMatch = line.match(/^export\s+(?:async\s+)?function\s+(\w+)\s*(\([^)]*\))/);
    if (funcMatch) {
      exports.push({
        name: funcMatch[1],
        type: 'function',
        signature: `${funcMatch[1]}${funcMatch[2]}`,
        description: extractJSDoc(lines, i),
        lineNumber: i + 1,
      });
      continue;
    }

    // Extract exported classes
    const classMatch = line.match(/^export\s+class\s+(\w+)/);
    if (classMatch) {
      exports.push({
        name: classMatch[1],
        type: 'class',
        signature: classMatch[1],
        description: extractJSDoc(lines, i),
        lineNumber: i + 1,
      });
      continue;
    }

    // Extract exported interfaces
    const ifaceMatch = line.match(/^export\s+interface\s+(\w+)/);
    if (ifaceMatch) {
      exports.push({
        name: ifaceMatch[1],
        type: 'interface',
        signature: ifaceMatch[1],
        description: extractJSDoc(lines, i),
        lineNumber: i + 1,
      });
      continue;
    }

    // Extract exported types
    const typeMatch = line.match(/^export\s+type\s+(\w+)/);
    if (typeMatch) {
      exports.push({
        name: typeMatch[1],
        type: 'type',
        signature: typeMatch[1],
        description: extractJSDoc(lines, i),
        lineNumber: i + 1,
      });
      continue;
    }

    // Extract exported constants
    const constMatch = line.match(/^export\s+const\s+(\w+)/);
    if (constMatch) {
      exports.push({
        name: constMatch[1],
        type: 'const',
        signature: constMatch[1],
        description: extractJSDoc(lines, i),
        lineNumber: i + 1,
      });
    }
  }

  // Calculate self-awareness (comment density + JSDoc coverage)
  const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('*') || l.trim().startsWith('/*')).length;
  const selfAwareness = Math.min(1, commentLines / Math.max(lines.length, 1));

  // Complexity estimate
  const imports = (content.match(/^import/gm) || []).length;
  const functions = (content.match(/function\s+\w+/g) || []).length;
  const complexity: DocEntry['complexity'] =
    imports + functions > 15 ? 'high' :
    imports + functions > 7 ? 'medium' : 'low';

  // Generate summary
  const summary = generateSummary(filePath, exports, lines.length, complexity);

  return { file: filePath, exports, summary, complexity, selfAwareness };
}

/**
 * Extract JSDoc comment above a line
 */
function extractJSDoc(lines: string[], targetLine: number): string {
  const docs: string[] = [];
  for (let i = targetLine - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('/**') || trimmed.startsWith('//')) {
      docs.unshift(trimmed.replace(/^\/?\*+\/?/, '').replace(/^\/\//, '').trim());
    } else if (trimmed === '') {
      continue;
    } else {
      break;
    }
  }
  return docs.filter(d => d.length > 0).join(' ').slice(0, 200);
}

/**
 * Generate a summary without AI
 */
function generateSummary(
  filePath: string,
  exports: ExportDoc[],
  lineCount: number,
  complexity: DocEntry['complexity']
): string {
  const fileName = filePath.split('/').pop() || filePath;
  const counts = {
    functions: exports.filter(e => e.type === 'function').length,
    classes: exports.filter(e => e.type === 'class').length,
    interfaces: exports.filter(e => e.type === 'interface').length,
    types: exports.filter(e => e.type === 'type').length,
    constants: exports.filter(e => e.type === 'const').length,
  };

  const parts = [];
  if (counts.classes) parts.push(`${counts.classes} class(es)`);
  if (counts.functions) parts.push(`${counts.functions} function(s)`);
  if (counts.interfaces) parts.push(`${counts.interfaces} interface(s)`);
  if (counts.types) parts.push(`${counts.types} type(s)`);
  if (counts.constants) parts.push(`${counts.constants} constant(s)`);

  return `${fileName}: ${lineCount} lines, ${complexity} complexity. Exports: ${parts.join(', ') || 'none'}.`;
}

/**
 * Generate full documentation for multiple files
 */
export function documentProject(
  files: { path: string; content: string }[]
): { docs: DocEntry[]; totalExports: number; avgSelfAwareness: number } {
  const docs = files.map(f => documentFile(f.path, f.content));
  const totalExports = docs.reduce((sum, d) => sum + d.exports.length, 0);
  const avgSelfAwareness = docs.length > 0
    ? docs.reduce((sum, d) => sum + d.selfAwareness, 0) / docs.length
    : 0;

  return { docs, totalExports, avgSelfAwareness: Math.round(avgSelfAwareness * 100) / 100 };
}
