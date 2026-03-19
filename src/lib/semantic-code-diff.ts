// ═══════════════════════════════════════════════════
// CAPABILITY: semantic-code-diff (L26)
// Compares code changes by meaning rather than text.
// Understands intent-preserving refactors vs behavioral changes.
// Built on: contextual-code-synthesis + pattern-recognition
// ═══════════════════════════════════════════════════

import { documentFile, type ExportDoc } from './self-documentation';

export interface SemanticDiff {
  type: 'identical' | 'refactor' | 'behavioral' | 'additive' | 'destructive';
  confidence: number; // 0-1
  summary: string;
  changes: SemanticChange[];
  riskScore: number; // 0-10
}

export interface SemanticChange {
  kind: 'export-added' | 'export-removed' | 'export-renamed' | 'export-signature-changed'
      | 'logic-changed' | 'import-changed' | 'comment-only' | 'formatting-only';
  entity?: string;
  description: string;
  breaking: boolean;
}

/**
 * Compare two versions of a file semantically — not just text diff.
 * Returns what actually changed in terms of meaning and behavior.
 */
export function semanticDiff(filePath: string, oldContent: string, newContent: string): SemanticDiff {
  if (oldContent === newContent) {
    return { type: 'identical', confidence: 1, summary: 'No changes', changes: [], riskScore: 0 };
  }

  const oldDoc = documentFile(filePath, oldContent);
  const newDoc = documentFile(filePath, newContent);
  const changes: SemanticChange[] = [];

  // Build export maps
  const oldExports = new Map(oldDoc.exports.map(e => [e.name, e]));
  const newExports = new Map(newDoc.exports.map(e => [e.name, e]));

  // Detect removed exports
  for (const [name, exp] of oldExports) {
    if (!newExports.has(name)) {
      // Check if it was renamed (same signature exists under different name)
      const renamed = findRenamed(exp, newExports, oldExports);
      if (renamed) {
        changes.push({
          kind: 'export-renamed',
          entity: `${name} → ${renamed}`,
          description: `Export "${name}" renamed to "${renamed}"`,
          breaking: true,
        });
      } else {
        changes.push({
          kind: 'export-removed',
          entity: name,
          description: `Export "${name}" (${exp.type}) was removed`,
          breaking: true,
        });
      }
    }
  }

  // Detect added exports
  for (const [name, exp] of newExports) {
    if (!oldExports.has(name)) {
      const wasRenamed = changes.some(c => c.kind === 'export-renamed' && c.entity?.includes(`→ ${name}`));
      if (!wasRenamed) {
        changes.push({
          kind: 'export-added',
          entity: name,
          description: `New export "${name}" (${exp.type}) added`,
          breaking: false,
        });
      }
    }
  }

  // Detect signature changes on shared exports
  for (const [name, oldExp] of oldExports) {
    const newExp = newExports.get(name);
    if (newExp && oldExp.signature !== newExp.signature) {
      changes.push({
        kind: 'export-signature-changed',
        entity: name,
        description: `Signature of "${name}" changed`,
        breaking: true,
      });
    }
  }

  // Check for import-only changes
  const oldImports = extractImports(oldContent);
  const newImports = extractImports(newContent);
  if (oldImports !== newImports) {
    changes.push({
      kind: 'import-changed',
      description: 'Import statements modified',
      breaking: false,
    });
  }

  // Check for comment-only or formatting-only changes
  const oldStripped = stripCommentsAndWhitespace(oldContent);
  const newStripped = stripCommentsAndWhitespace(newContent);
  if (oldStripped === newStripped && changes.length === 0) {
    changes.push({
      kind: 'comment-only',
      description: 'Only comments or whitespace changed',
      breaking: false,
    });
    return { type: 'refactor', confidence: 0.95, summary: 'Comment/formatting changes only', changes, riskScore: 0 };
  }

  // Classify the overall diff
  const hasBreaking = changes.some(c => c.breaking);
  const hasRemovals = changes.some(c => c.kind === 'export-removed');
  const hasAdditions = changes.some(c => c.kind === 'export-added');
  const hasSignatureChanges = changes.some(c => c.kind === 'export-signature-changed');

  let type: SemanticDiff['type'];
  let riskScore: number;

  if (hasRemovals) {
    type = 'destructive';
    riskScore = 8 + changes.filter(c => c.kind === 'export-removed').length;
  } else if (hasSignatureChanges) {
    type = 'behavioral';
    riskScore = 5 + changes.filter(c => c.kind === 'export-signature-changed').length;
  } else if (hasAdditions && !hasBreaking) {
    type = 'additive';
    riskScore = 1;
  } else if (!hasBreaking) {
    type = 'refactor';
    riskScore = 2;
  } else {
    type = 'behavioral';
    riskScore = 4;
  }

  riskScore = Math.min(10, riskScore);
  const confidence = changes.length > 0 ? 0.8 : 0.5;
  const summary = `${type} change: ${changes.length} semantic difference(s), risk ${riskScore}/10`;

  return { type, confidence, summary, changes, riskScore };
}

/**
 * Batch compare multiple file changes and return an aggregate risk assessment.
 */
export function batchSemanticDiff(
  fileDiffs: { path: string; oldContent: string; newContent: string }[]
): { diffs: (SemanticDiff & { path: string })[]; totalRisk: number; verdict: 'safe' | 'review' | 'dangerous' } {
  const diffs = fileDiffs.map(f => ({
    ...semanticDiff(f.path, f.oldContent, f.newContent),
    path: f.path,
  }));

  const totalRisk = diffs.reduce((sum, d) => sum + d.riskScore, 0);
  const maxRisk = Math.max(...diffs.map(d => d.riskScore), 0);
  const verdict = maxRisk >= 8 ? 'dangerous' : totalRisk >= 10 ? 'review' : 'safe';

  return { diffs, totalRisk, verdict };
}

// ─── Helpers ───

function findRenamed(exp: ExportDoc, newExports: Map<string, ExportDoc>, oldExports: Map<string, ExportDoc>): string | null {
  for (const [name, newExp] of newExports) {
    if (!oldExports.has(name) && newExp.type === exp.type && newExp.signature === exp.signature) {
      return name;
    }
  }
  return null;
}

function extractImports(content: string): string {
  return content.split('\n').filter(l => l.trimStart().startsWith('import ')).sort().join('\n');
}

function stripCommentsAndWhitespace(content: string): string {
  return content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
