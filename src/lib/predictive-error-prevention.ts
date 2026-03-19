// ═══════════════════════════════════════════════════
// CAPABILITY: predictive-error-prevention
// Predicts which mutations will fail BEFORE attempting
// them, using fitness landscape data and anomaly patterns.
// Eliminates wasted evolution cycles on doomed mutations.
// Built on: fitness-landscape-mapping + anomaly-detection + pattern-recognition
// ═══════════════════════════════════════════════════

import { FitnessLandscape, type MutationRecord } from './fitness-landscape';
import { detectAnomalies, type Anomaly } from './anomaly-detection';
import { detectPatterns, type EvolutionPattern } from './pattern-recognition';

export interface MutationProposal {
  capability: string;
  category: string;
  parentCapabilities: string[];
  description: string;
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface PredictionResult {
  proposal: MutationProposal;
  verdict: 'proceed' | 'caution' | 'abort';
  successProbability: number;
  risks: Risk[];
  recommendations: string[];
  reasoning: string;
}

export interface Risk {
  type: 'prerequisite-weak' | 'category-cold' | 'anomaly-present' | 'pattern-mismatch' | 'complexity-high';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

/**
 * Predict whether a mutation will succeed before attempting it
 */
export function predictMutation(
  proposal: MutationProposal,
  landscape: FitnessLandscape,
  capabilities: { name: string; cycle: number; level: number; builtOn: string[]; verified: boolean }[],
  currentLevel: number,
  cycleCount: number
): PredictionResult {
  const risks: Risk[] = [];
  const recommendations: string[] = [];

  // 1. Fitness landscape prediction
  const fitnessPrediction = landscape.predictSuccess(
    proposal.capability,
    proposal.parentCapabilities,
    proposal.category
  );

  // 2. Check parent capability health
  for (const parent of proposal.parentCapabilities) {
    const parentFitness = landscape.getFitness(parent);
    if (parentFitness && parentFitness.fitness < 0.4) {
      risks.push({
        type: 'prerequisite-weak',
        severity: 'high',
        description: `Parent "${parent}" has low fitness (${parentFitness.fitness})`,
      });
      recommendations.push(`Strengthen "${parent}" before building "${proposal.capability}"`);
    } else if (parentFitness && parentFitness.trend === 'degrading') {
      risks.push({
        type: 'prerequisite-weak',
        severity: 'medium',
        description: `Parent "${parent}" fitness is degrading`,
      });
    }
  }

  // 3. Check for active anomalies that could interfere
  const anomalies = detectAnomalies(capabilities, currentLevel, cycleCount);
  const relevantAnomalies = anomalies.filter(a =>
    a.affectedEntity === proposal.capability ||
    proposal.parentCapabilities.includes(a.affectedEntity || '')
  );

  for (const anomaly of relevantAnomalies) {
    risks.push({
      type: 'anomaly-present',
      severity: anomaly.severity === 'critical' ? 'high' : anomaly.severity === 'high' ? 'medium' : 'low',
      description: `Active anomaly: ${anomaly.description}`,
    });
    recommendations.push(anomaly.recommendation);
  }

  // 4. Check evolution patterns for timing
  const patterns = detectPatterns(
    capabilities.map(c => ({ cycle: c.cycle, level: c.level, name: c.name })),
    cycleCount
  );

  const stagnation = patterns.find(p => p.type === 'stagnation');
  if (stagnation && stagnation.confidence > 0.7) {
    risks.push({
      type: 'pattern-mismatch',
      severity: 'medium',
      description: `System in stagnation phase — mutations may not take hold`,
    });
    recommendations.push('Consider a different evolution strategy to break stagnation');
  }

  // 5. Complexity assessment
  if (proposal.estimatedComplexity === 'high') {
    risks.push({
      type: 'complexity-high',
      severity: 'medium',
      description: 'High-complexity mutation has lower success rate historically',
    });
    recommendations.push('Consider breaking into smaller sub-capabilities');
  }

  // 6. Category temperature check
  const summary = landscape.summarize();
  const categoryInfo = summary.categoryBreakdown[proposal.category];
  if (categoryInfo && categoryInfo.successRate < 0.4) {
    risks.push({
      type: 'category-cold',
      severity: 'medium',
      description: `Category "${proposal.category}" has low success rate (${(categoryInfo.successRate * 100).toFixed(0)}%)`,
    });
  }

  // Calculate final probability
  let probability = fitnessPrediction.probability;
  for (const risk of risks) {
    if (risk.severity === 'high') probability -= 0.15;
    else if (risk.severity === 'medium') probability -= 0.08;
    else probability -= 0.03;
  }
  probability = Math.max(0, Math.min(1, probability));

  // Determine verdict
  let verdict: PredictionResult['verdict'];
  if (probability >= 0.6) verdict = 'proceed';
  else if (probability >= 0.35) verdict = 'caution';
  else verdict = 'abort';

  // Build reasoning
  const reasoning = buildReasoning(proposal, probability, risks, fitnessPrediction.reasoning);

  if (recommendations.length === 0) {
    recommendations.push('All signals green — proceed with mutation');
  }

  return {
    proposal,
    verdict,
    successProbability: Math.round(probability * 100) / 100,
    risks,
    recommendations,
    reasoning,
  };
}

/**
 * Batch-predict multiple mutations and rank by success probability
 */
export function rankMutations(
  proposals: MutationProposal[],
  landscape: FitnessLandscape,
  capabilities: { name: string; cycle: number; level: number; builtOn: string[]; verified: boolean }[],
  currentLevel: number,
  cycleCount: number
): PredictionResult[] {
  return proposals
    .map(p => predictMutation(p, landscape, capabilities, currentLevel, cycleCount))
    .sort((a, b) => b.successProbability - a.successProbability);
}

/**
 * Get only "safe" mutations (verdict: proceed)
 */
export function getSafeMutations(
  proposals: MutationProposal[],
  landscape: FitnessLandscape,
  capabilities: { name: string; cycle: number; level: number; builtOn: string[]; verified: boolean }[],
  currentLevel: number,
  cycleCount: number
): PredictionResult[] {
  return rankMutations(proposals, landscape, capabilities, currentLevel, cycleCount)
    .filter(r => r.verdict === 'proceed');
}

// ─── Helpers ───────────────────────────────────────

function buildReasoning(
  proposal: MutationProposal,
  probability: number,
  risks: Risk[],
  fitnessReasoning: string
): string {
  const parts: string[] = [];
  parts.push(`Mutation "${proposal.capability}" (${proposal.category})`);
  parts.push(`Fitness analysis: ${fitnessReasoning}`);
  parts.push(`${risks.length} risk(s) identified`);

  const highRisks = risks.filter(r => r.severity === 'high');
  if (highRisks.length > 0) {
    parts.push(`⚠ High risks: ${highRisks.map(r => r.description).join('; ')}`);
  }

  parts.push(`Final probability: ${(probability * 100).toFixed(0)}%`);
  return parts.join('. ');
}
