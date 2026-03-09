// ═══════════════════════════════════════════════════
// CAPABILITY: capability-dependency-pruning
// Identifies and removes dead capability branches that
// no longer contribute to evolution. Keeps the capability
// tree lean and fast-evolving.
// Built on: capability-merging + fitness-landscape-mapping
// ═══════════════════════════════════════════════════

import { findOrphanCapabilities, findSubsumedCapabilities, findMergeCandidates, type CapabilityNode, type MergeReport } from './capability-merging';
import { FitnessLandscape } from './fitness-landscape';

export interface PruningTarget {
  capability: string;
  reason: PruneReason;
  confidence: number;
  impact: 'safe' | 'minor-risk' | 'risky';
  description: string;
}

export type PruneReason =
  | 'orphan'         // nothing depends on it, and it's old
  | 'subsumed'       // completely contained within another capability
  | 'redundant'      // near-duplicate of another capability
  | 'low-fitness'    // consistently fails or produces no value
  | 'ghost'          // registered but has no source code
  | 'circular';      // creates a circular dependency

export interface PruningReport {
  analyzed: number;
  targets: PruningTarget[];
  safeToPrune: string[];
  healthBefore: number;
  healthAfter: number;
  spaceSaved: number; // estimated capability slots freed
}

/**
 * Analyze the full capability tree and identify what should be pruned
 */
export function analyzePruningTargets(
  capabilities: CapabilityNode[],
  landscape: FitnessLandscape,
  currentLevel: number,
  sourceFileChecker?: (path: string) => boolean
): PruningReport {
  const targets: PruningTarget[] = [];

  // 1. Find orphans
  const orphans = findOrphanCapabilities(capabilities, currentLevel);
  for (const orphan of orphans) {
    targets.push({
      capability: orphan,
      reason: 'orphan',
      confidence: 0.8,
      impact: 'safe',
      description: `\"${orphan}\" is a leaf node with no dependents and is 5+ levels old`,
    });
  }

  // 2. Find subsumed capabilities
  const subsumed = findSubsumedCapabilities(capabilities);
  for (const { child, parent } of subsumed) {
    targets.push({
      capability: child,
      reason: 'subsumed',
      confidence: 0.9,
      impact: 'safe',
      description: `\"${child}\" is fully contained within \"${parent}\"`,
    });
  }

  // 3. Find redundant (near-duplicate) capabilities
  const mergeReport = findMergeCandidates(capabilities);
  for (const candidate of mergeReport.candidates) {
    if (candidate.similarity > 0.85) {
      // Pick the one with lower fitness to prune
      const [a, b] = candidate.capabilities;
      const fitnessA = landscape.getFitness(a);
      const fitnessB = landscape.getFitness(b);
      const toPrune = (fitnessA?.fitness ?? 0) < (fitnessB?.fitness ?? 0) ? a : b;

      targets.push({
        capability: toPrune,
        reason: 'redundant',
        confidence: candidate.similarity,
        impact: 'minor-risk',
        description: `\"${toPrune}\" is ${(candidate.similarity * 100).toFixed(0)}% similar to \"${candidate.capabilities.find(c => c !== toPrune)}\"`,
      });
    }
  }

  // 4. Find low-fitness capabilities
  for (const cap of capabilities) {
    const fitness = landscape.getFitness(cap.name);
    if (fitness && fitness.fitness < 0.2 && fitness.attemptCount >= 3 && fitness.trend === 'degrading') {
      targets.push({
        capability: cap.name,
        reason: 'low-fitness',
        confidence: 0.7,
        impact: 'minor-risk',
        description: `\"${cap.name}\" has fitness ${fitness.fitness} after ${fitness.attemptCount} attempts and is degrading`,
      });
    }
  }

  // 5. Find ghost capabilities (no source file)
  if (sourceFileChecker) {
    for (const cap of capabilities) {
      if (cap.sourceFile && cap.sourceFile !== 'pre-installed' && !sourceFileChecker(cap.sourceFile)) {
        targets.push({
          capability: cap.name,
          reason: 'ghost',
          confidence: 0.95,
          impact: 'safe',
          description: `\"${cap.name}\" references \"${cap.sourceFile}\" which doesn't exist`,
        });
      }
    }
  }

  // 6. Find circular dependencies
  const circulars = detectCircularDeps(capabilities);
  for (const cap of circulars) {
    targets.push({
      capability: cap,
      reason: 'circular',
      confidence: 0.85,
      impact: 'risky',
      description: `\"${cap}\" is part of a circular dependency chain`,
    });
  }

  // De-duplicate targets (same capability might be flagged for multiple reasons)
  const uniqueTargets = deduplicateTargets(targets);

  // Calculate health scores
  const safeToPrune = uniqueTargets.filter(t => t.impact === 'safe').map(t => t.capability);
  const healthBefore = mergeReport.healthScore;
  const healthAfter = capabilities.length > 0
    ? Math.min(1, healthBefore + (safeToPrune.length / capabilities.length) * 0.3)
    : healthBefore;

  return {
    analyzed: capabilities.length,
    targets: uniqueTargets,
    safeToPrune,
    healthBefore,
    healthAfter,
    spaceSaved: safeToPrune.length,
  };
}

/**
 * Execute pruning: returns the list of capabilities to keep
 */
export function executePrune(
  capabilities: CapabilityNode[],
  targetNames: string[]
): { kept: CapabilityNode[]; pruned: string[]; updatedDeps: { capability: string; removedDep: string }[] } {
  const targetSet = new Set(targetNames);
  const kept = capabilities.filter(c => !targetSet.has(c.name));

  // Update dependency references in remaining capabilities
  const updatedDeps: { capability: string; removedDep: string }[] = [];
  for (const cap of kept) {
    const prunedDeps = cap.builtOn.filter(d => targetSet.has(d));
    if (prunedDeps.length > 0) {
      cap.builtOn = cap.builtOn.filter(d => !targetSet.has(d));
      for (const dep of prunedDeps) {
        updatedDeps.push({ capability: cap.name, removedDep: dep });
      }
    }
  }

  return { kept, pruned: targetNames, updatedDeps };
}

// ─── Helpers ───────────────────────────────────────

function detectCircularDeps(capabilities: CapabilityNode[]): string[] {
  const capMap = new Map(capabilities.map(c => [c.name, c]));
  const circular: string[] = [];

  for (const cap of capabilities) {
    const visited = new Set<string>();
    const stack = [...cap.builtOn];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === cap.name) {
        circular.push(cap.name);
        break;
      }
      if (visited.has(current)) continue;
      visited.add(current);

      const node = capMap.get(current);
      if (node) {
        stack.push(...node.builtOn);
      }
    }
  }

  return [...new Set(circular)];
}

function deduplicateTargets(targets: PruningTarget[]): PruningTarget[] {
  const seen = new Map<string, PruningTarget>();

  for (const target of targets) {
    const existing = seen.get(target.capability);
    if (!existing || target.confidence > existing.confidence) {
      seen.set(target.capability, target);
    }
  }

  return [...seen.values()].sort((a, b) => b.confidence - a.confidence);
}
