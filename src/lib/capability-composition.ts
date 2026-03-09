// ═══════════════════════════════════════════════════
// CAPABILITY: capability-composition (L26)
// Automatically compose two or more capabilities into
// a higher-order unified capability.
// Built on: capability-dependency-pruning + contextual-code-synthesis
// ═══════════════════════════════════════════════════

import { documentFile, type DocEntry } from './self-documentation';

export interface CompositionCandidate {
  capabilities: string[];
  composedName: string;
  rationale: string;
  sharedExports: string[];
  compositionType: 'pipeline' | 'merger' | 'wrapper' | 'orchestrator';
  score: number; // 0-10 how valuable this composition would be
}

export interface ComposedCapability {
  name: string;
  description: string;
  sourceCapabilities: string[];
  compositionType: CompositionCandidate['compositionType'];
  generatedInterface: string;
}

interface CapabilityInfo {
  name: string;
  filePath: string;
  content: string;
  builtOn: string[];
}

/**
 * Analyze capabilities to find composition opportunities.
 * Two caps are composable if:
 * 1. One's output type matches another's input type (pipeline)
 * 2. They share significant interface overlap (merger)
 * 3. One wraps the other's functionality (wrapper)
 * 4. Multiple are used together frequently (orchestrator)
 */
export function findCompositionCandidates(capabilities: CapabilityInfo[]): CompositionCandidate[] {
  const candidates: CompositionCandidate[] = [];
  const docs = new Map<string, DocEntry>();

  // Document all capabilities
  for (const cap of capabilities) {
    docs.set(cap.name, documentFile(cap.filePath, cap.content));
  }

  // Check all pairs
  for (let i = 0; i < capabilities.length; i++) {
    for (let j = i + 1; j < capabilities.length; j++) {
      const a = capabilities[i];
      const b = capabilities[j];
      const docA = docs.get(a.name)!;
      const docB = docs.get(b.name)!;

      // Pipeline detection: A's return types match B's parameter types
      const pipeline = detectPipeline(docA, docB);
      if (pipeline.score > 0) {
        candidates.push({
          capabilities: [a.name, b.name],
          composedName: `${a.name}→${b.name}`,
          rationale: `${a.name} output feeds into ${b.name} input`,
          sharedExports: pipeline.shared,
          compositionType: 'pipeline',
          score: pipeline.score,
        });
      }

      // Merger detection: shared export names or similar interfaces
      const merger = detectMerger(docA, docB);
      if (merger.score > 0) {
        candidates.push({
          capabilities: [a.name, b.name],
          composedName: `unified-${shorten(a.name)}-${shorten(b.name)}`,
          rationale: `Both expose similar interfaces: ${merger.shared.join(', ')}`,
          sharedExports: merger.shared,
          compositionType: 'merger',
          score: merger.score,
        });
      }

      // Dependency chain detection: one built on the other
      if (a.builtOn.includes(b.name) || b.builtOn.includes(a.name)) {
        candidates.push({
          capabilities: [a.name, b.name],
          composedName: `${a.builtOn.includes(b.name) ? a.name : b.name}-enhanced`,
          rationale: 'Direct dependency chain — tight coupling suggests unification',
          sharedExports: [],
          compositionType: 'wrapper',
          score: 4,
        });
      }
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

/**
 * Generate a composed capability interface from a candidate.
 */
export function composeCapability(candidate: CompositionCandidate, capabilities: CapabilityInfo[]): ComposedCapability {
  const sources = capabilities.filter(c => candidate.capabilities.includes(c.name));
  const docs = sources.map(s => documentFile(s.filePath, s.content));
  
  // Collect all exports
  const allExports = docs.flatMap(d => d.exports);
  const uniqueExports = new Map<string, typeof allExports[0]>();
  for (const exp of allExports) {
    if (!uniqueExports.has(exp.name)) {
      uniqueExports.set(exp.name, exp);
    }
  }

  // Generate interface
  const interfaceLines = [
    `// Composed capability: ${candidate.composedName}`,
    `// Type: ${candidate.compositionType}`,
    `// Sources: ${candidate.capabilities.join(' + ')}`,
    '',
    `export interface ${toPascalCase(candidate.composedName)} {`,
  ];

  for (const [name, exp] of uniqueExports) {
    if (exp.type === 'function') {
      interfaceLines.push(`  ${name}: ${exp.signature};`);
    }
  }

  interfaceLines.push('}');

  return {
    name: candidate.composedName,
    description: candidate.rationale,
    sourceCapabilities: candidate.capabilities,
    compositionType: candidate.compositionType,
    generatedInterface: interfaceLines.join('\n'),
  };
}

// ─── Helpers ───

function detectPipeline(a: DocEntry, b: DocEntry): { score: number; shared: string[] } {
  const aFuncs = a.exports.filter(e => e.type === 'function');
  const bFuncs = b.exports.filter(e => e.type === 'function');
  const shared: string[] = [];

  // Check if A's return types appear in B's signatures
  for (const af of aFuncs) {
    const returnMatch = af.signature.match(/\):\s*(.+)$/);
    if (!returnMatch) continue;
    const returnType = returnMatch[1].trim();

    for (const bf of bFuncs) {
      if (bf.signature.includes(returnType) && returnType.length > 3) {
        shared.push(`${af.name}→${bf.name}`);
      }
    }
  }

  return { score: shared.length > 0 ? Math.min(8, 3 + shared.length * 2) : 0, shared };
}

function detectMerger(a: DocEntry, b: DocEntry): { score: number; shared: string[] } {
  const aNames = new Set(a.exports.map(e => e.name.toLowerCase()));
  const bNames = b.exports.map(e => e.name.toLowerCase());
  const shared = bNames.filter(n => aNames.has(n));

  // Also check interface/type name overlap
  const aTypes = a.exports.filter(e => e.type === 'interface' || e.type === 'type').map(e => e.name);
  const bTypes = b.exports.filter(e => e.type === 'interface' || e.type === 'type').map(e => e.name);
  const typeOverlap = bTypes.filter(t => aTypes.some(at => diceCoefficient(at, t) > 0.5));

  const totalShared = [...shared, ...typeOverlap];
  return {
    score: totalShared.length >= 2 ? Math.min(7, 2 + totalShared.length * 2) : 0,
    shared: totalShared,
  };
}

function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const aSet = bigrams(a.toLowerCase());
  const bSet = bigrams(b.toLowerCase());
  let intersection = 0;
  for (const bg of aSet) if (bSet.has(bg)) intersection++;
  return (2 * intersection) / (aSet.size + bSet.size);
}

function shorten(name: string): string {
  return name.split('-').map(p => p.slice(0, 4)).join('-');
}

function toPascalCase(s: string): string {
  return s.split(/[-→]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}
