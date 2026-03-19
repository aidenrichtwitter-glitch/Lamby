// ═══════════════════════════════════════════════════
// CAPABILITY: intent-verification (L26)
// Verify that mutations achieve their stated intent,
// not just pass safety checks. Closes the gap between
// "code is safe" and "code does what was intended."
// Built on: predictive-error-prevention + contextual-code-synthesis
// ═══════════════════════════════════════════════════

import { documentFile } from './self-documentation';

export interface IntentSpec {
  description: string;
  expectedExports: string[];
  expectedBehaviors: string[];
  mustNotBreak: string[];
  category?: string;
}

export interface IntentVerdict {
  pass: boolean;
  score: number; // 0-100
  checks: IntentCheck[];
  summary: string;
}

export interface IntentCheck {
  name: string;
  pass: boolean;
  weight: number;
  detail: string;
}

/**
 * Verify that generated/mutated code fulfills the stated intent.
 * Pure deterministic — no AI calls.
 */
export function verifyIntent(
  intent: IntentSpec,
  filePath: string,
  generatedCode: string,
  previousCode?: string
): IntentVerdict {
  const checks: IntentCheck[] = [];
  const doc = documentFile(filePath, generatedCode);

  // 1. Export presence check
  for (const expected of intent.expectedExports) {
    const found = doc.exports.some(e => e.name === expected);
    checks.push({
      name: `export:${expected}`,
      pass: found,
      weight: 3,
      detail: found
        ? `Export "${expected}" present`
        : `Missing expected export "${expected}"`,
    });
  }

  // 2. Behavior keyword check — scan code for behavioral indicators
  for (const behavior of intent.expectedBehaviors) {
    const keywords = extractKeywords(behavior);
    const codeLC = generatedCode.toLowerCase();
    const matchCount = keywords.filter(k => codeLC.includes(k.toLowerCase())).length;
    const ratio = keywords.length > 0 ? matchCount / keywords.length : 0;
    checks.push({
      name: `behavior:${behavior.slice(0, 40)}`,
      pass: ratio >= 0.4,
      weight: 2,
      detail: `${Math.round(ratio * 100)}% keyword match for "${behavior.slice(0, 50)}"`,
    });
  }

  // 3. Must-not-break check — verify referenced entities still exist if previous code provided
  if (previousCode) {
    const prevDoc = documentFile(filePath, previousCode);
    for (const entity of intent.mustNotBreak) {
      const wasThere = prevDoc.exports.some(e => e.name === entity);
      const stillThere = doc.exports.some(e => e.name === entity);
      if (wasThere) {
        checks.push({
          name: `preserve:${entity}`,
          pass: stillThere,
          weight: 4,
          detail: stillThere
            ? `Protected export "${entity}" preserved`
            : `BREAKING: Protected export "${entity}" was removed`,
        });
      }
    }
  }

  // 4. Non-empty check — code must have substance
  const hasSubstance = doc.exports.length > 0 && generatedCode.trim().split('\n').length > 5;
  checks.push({
    name: 'substance',
    pass: hasSubstance,
    weight: 2,
    detail: hasSubstance
      ? `File has ${doc.exports.length} exports across ${generatedCode.trim().split('\n').length} lines`
      : 'Generated code appears empty or trivial',
  });

  // 5. Description alignment — check if the intent description keywords appear
  const descKeywords = extractKeywords(intent.description);
  const commentText = extractComments(generatedCode).toLowerCase();
  const codeText = generatedCode.toLowerCase();
  const descMatchCount = descKeywords.filter(k => commentText.includes(k) || codeText.includes(k)).length;
  const descRatio = descKeywords.length > 0 ? descMatchCount / descKeywords.length : 0;
  checks.push({
    name: 'description-alignment',
    pass: descRatio >= 0.3,
    weight: 1,
    detail: `${Math.round(descRatio * 100)}% alignment with stated intent description`,
  });

  // 6. Category-specific checks
  if (intent.category === 'resilience') {
    const hasErrorHandling = /try\s*{|catch\s*\(|\.catch\(|throw\s/.test(generatedCode);
    checks.push({
      name: 'resilience-patterns',
      pass: hasErrorHandling,
      weight: 2,
      detail: hasErrorHandling ? 'Error handling patterns detected' : 'No error handling found for resilience capability',
    });
  }
  if (intent.category === 'autonomy') {
    const hasDeterministic = !/await\s+fetch|await\s+supabase/.test(generatedCode) ||
                             /deterministic|rule|template/.test(generatedCode.toLowerCase());
    checks.push({
      name: 'autonomy-determinism',
      pass: hasDeterministic,
      weight: 1,
      detail: hasDeterministic ? 'Deterministic operation path available' : 'Relies entirely on external calls',
    });
  }

  // Calculate score
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const passedWeight = checks.filter(c => c.pass).reduce((s, c) => s + c.weight, 0);
  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;
  const pass = score >= 60 && !checks.some(c => !c.pass && c.weight >= 4);

  const failedCritical = checks.filter(c => !c.pass && c.weight >= 3);
  const summary = pass
    ? `Intent verified (${score}%): ${checks.filter(c => c.pass).length}/${checks.length} checks passed`
    : `Intent FAILED (${score}%): ${failedCritical.map(c => c.detail).join('; ')}`;

  return { pass, score, checks, summary };
}

/**
 * Create an intent spec from a natural language description.
 */
export function specFromDescription(
  description: string,
  expectedExports: string[] = [],
  mustNotBreak: string[] = [],
  category?: string
): IntentSpec {
  const behaviors = description
    .split(/[.;,]/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  return {
    description,
    expectedExports,
    expectedBehaviors: behaviors,
    mustNotBreak,
    category,
  };
}

// ─── Helpers ───

function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
    'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'and', 'but', 'or', 'not',
    'that', 'this', 'it', 'its', 'which', 'what', 'who', 'whom', 'how', 'when', 'where', 'why']);
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

function extractComments(code: string): string {
  const singleLine = code.match(/\/\/.*$/gm) || [];
  const multiLine = code.match(/\/\*[\s\S]*?\*\//g) || [];
  return [...singleLine, ...multiLine].join(' ');
}
