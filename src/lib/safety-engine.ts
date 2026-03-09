import { SafetyCheck } from './self-reference';

// The safety engine - MINIMAL guardrails only
// We protect against crashes but NOT against ambition
// The system should be free to build whatever it dreams

let idCounter = 0;
const nextId = () => `check-${++idCounter}`;

export function validateChange(newContent: string, filePath: string, oldContent?: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  checks.push(...checkBalancedBrackets(newContent, filePath));
  checks.push(...checkImports(newContent, filePath));
  checks.push(...checkCatastrophicPatterns(newContent, filePath));

  if (oldContent !== undefined && oldContent.length > 0) {
    checks.push(...checkSizeReduction(newContent, oldContent, filePath));
  }

  if (checks.length === 0) {
    checks.push({
      id: nextId(),
      type: 'syntax',
      severity: 'info',
      message: 'All safety checks passed — build freely',
      file: filePath,
    });
  }

  return checks;
}

function checkSizeReduction(newContent: string, oldContent: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  const oldLines = oldContent.split('\n').length;
  const newLines = newContent.split('\n').length;
  const ratio = newLines / oldLines;

  if (oldLines > 20 && ratio < 0.3) {
    checks.push({
      id: nextId(),
      type: 'runtime',
      severity: 'error',
      message: `This looks like a snippet, not a full file replacement. The existing file has ${oldLines} lines but the new content only has ${newLines} lines (${Math.round(ratio * 100)}%). This will delete most of the file. Ask Grok to return the COMPLETE file instead.`,
      file,
    });
  } else if (oldLines > 20 && ratio < 0.6) {
    checks.push({
      id: nextId(),
      type: 'runtime',
      severity: 'warning',
      message: `New content is significantly smaller: ${oldLines} → ${newLines} lines (${Math.round(ratio * 100)}%). Make sure Grok returned the complete file, not just a snippet.`,
      file,
    });
  }

  return checks;
}

function checkBalancedBrackets(content: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  const stack: { char: string; line: number }[] = [];
  const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
  const closers = new Set(Object.values(pairs));
  let inString = false;
  let stringChar = '';
  let line = 1;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '\n') line++;
    
    if (inString) {
      if (c === stringChar && content[i - 1] !== '\\') inString = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inString = true;
      stringChar = c;
      continue;
    }

    if (pairs[c]) {
      stack.push({ char: c, line });
    } else if (closers.has(c)) {
      const last = stack.pop();
      if (last && pairs[last.char] !== c) {
        checks.push({
          id: nextId(),
          type: 'syntax',
          severity: 'error',
          message: `Mismatched bracket: expected '${pairs[last.char]}' but found '${c}'`,
          line,
          file,
        });
      }
    }
  }

  // Only error on severely unbalanced (3+ unclosed)
  if (stack.length >= 3) {
    checks.push({
      id: nextId(),
      type: 'syntax',
      severity: 'error',
      message: `${stack.length} unclosed bracket(s) — likely broken syntax`,
      line: stack[0].line,
      file,
    });
  } else if (stack.length > 0) {
    checks.push({
      id: nextId(),
      type: 'syntax',
      severity: 'warning',
      message: `${stack.length} unclosed bracket(s) — minor syntax issue`,
      line: stack[0].line,
      file,
    });
  }

  return checks;
}

function checkImports(content: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (file.includes(importPath.replace('./', '').replace('@/', 'src/'))) {
      checks.push({
        id: nextId(),
        type: 'circular',
        severity: 'error',
        message: `Circular self-import via '${importPath}'`,
        file,
      });
    }
  }

  return checks;
}

// Only block patterns that would crash or freeze the browser
function checkCatastrophicPatterns(content: string, file: string): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  
  const patterns = [
    { regex: /while\s*\(\s*true\s*\)\s*\{[^}]*\}/g, msg: 'Synchronous infinite loop — will freeze the browser', severity: 'error' as const },
    { regex: /for\s*\(\s*;\s*;\s*\)\s*\{[^}]*\}/g, msg: 'Synchronous infinite loop — will freeze', severity: 'error' as const },
  ];

  for (const { regex, msg, severity } of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      // Allow if there's a break/return inside
      const loopBody = match[0];
      if (loopBody.includes('break') || loopBody.includes('return') || loopBody.includes('await')) continue;
      const line = content.substring(0, match.index).split('\n').length;
      checks.push({ id: nextId(), type: 'runtime', severity, message: msg, line, file });
    }
  }

  return checks;
}

export function getSeverityColor(severity: SafetyCheck['severity']): string {
  switch (severity) {
    case 'error': return 'text-terminal-red';
    case 'warning': return 'text-terminal-amber';
    case 'info': return 'text-terminal-green';
  }
}
