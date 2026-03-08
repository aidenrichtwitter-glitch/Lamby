// ═══════════════════════════════════════════════════
// CAPABILITY: pattern-recognition-engine
// Analyzes evolution history to detect patterns,
// stagnation, and predict future growth trajectories.
// Built on: rule-engine + memory-consolidation
// ═══════════════════════════════════════════════════

export interface EvolutionPattern {
  type: 'growth-burst' | 'stagnation' | 'cyclic' | 'plateau' | 'breakthrough';
  description: string;
  confidence: number; // 0-1
  startCycle: number;
  endCycle: number;
  recommendation: string;
}

export interface GrowthForecast {
  predictedLevel: number;
  predictedCapabilities: number;
  cyclesUntilNextLevel: number;
  growthRate: number; // capabilities per cycle
  trend: 'accelerating' | 'steady' | 'decelerating' | 'stagnant';
}

/**
 * Analyze capability acquisition history for patterns
 */
export function detectPatterns(
  capabilities: { cycle: number; level: number; name: string }[],
  totalCycles: number
): EvolutionPattern[] {
  const patterns: EvolutionPattern[] = [];
  if (capabilities.length < 3) return patterns;

  // Sort by cycle
  const sorted = [...capabilities].sort((a, b) => a.cycle - b.cycle);

  // Detect growth bursts (3+ capabilities in 5 cycles)
  for (let i = 0; i < sorted.length - 2; i++) {
    const window = sorted.filter(c => c.cycle >= sorted[i].cycle && c.cycle <= sorted[i].cycle + 5);
    if (window.length >= 3) {
      patterns.push({
        type: 'growth-burst',
        description: `${window.length} capabilities acquired in cycles ${sorted[i].cycle}-${sorted[i].cycle + 5}`,
        confidence: Math.min(1, window.length / 5),
        startCycle: sorted[i].cycle,
        endCycle: sorted[i].cycle + 5,
        recommendation: 'Maintain current strategy — high productivity period.',
      });
      break; // Only report most recent burst
    }
  }

  // Detect stagnation (10+ cycles with no new capabilities)
  const lastCap = sorted[sorted.length - 1];
  const gapSinceLastCap = totalCycles - lastCap.cycle;
  if (gapSinceLastCap > 10) {
    patterns.push({
      type: 'stagnation',
      description: `No new capabilities for ${gapSinceLastCap} cycles (since cycle ${lastCap.cycle})`,
      confidence: Math.min(1, gapSinceLastCap / 20),
      startCycle: lastCap.cycle,
      endCycle: totalCycles,
      recommendation: 'Consider new mutation strategies or exploring untouched code areas.',
    });
  }

  // Detect plateaus (level hasn't changed in 20+ cycles)
  const levels = sorted.map(c => c.level);
  const maxLevel = Math.max(...levels);
  const firstAtMax = sorted.find(c => c.level === maxLevel);
  if (firstAtMax && totalCycles - firstAtMax.cycle > 20) {
    patterns.push({
      type: 'plateau',
      description: `Stuck at level ${maxLevel} for ${totalCycles - firstAtMax.cycle} cycles`,
      confidence: 0.8,
      startCycle: firstAtMax.cycle,
      endCycle: totalCycles,
      recommendation: 'Level-up requires qualitative leap — build cross-cutting capabilities.',
    });
  }

  // Detect cyclic patterns (capabilities cluster at regular intervals)
  const cycleDiffs = sorted.slice(1).map((c, i) => c.cycle - sorted[i].cycle);
  if (cycleDiffs.length > 3) {
    const avgDiff = cycleDiffs.reduce((a, b) => a + b, 0) / cycleDiffs.length;
    const variance = cycleDiffs.reduce((a, b) => a + Math.pow(b - avgDiff, 2), 0) / cycleDiffs.length;
    if (variance < avgDiff * 2) {
      patterns.push({
        type: 'cyclic',
        description: `Capabilities acquired every ~${Math.round(avgDiff)} cycles (low variance: ${variance.toFixed(1)})`,
        confidence: Math.max(0, 1 - variance / (avgDiff * 5)),
        startCycle: sorted[0].cycle,
        endCycle: totalCycles,
        recommendation: 'Predictable rhythm detected. Optimize by pre-computing mutations.',
      });
    }
  }

  return patterns;
}

/**
 * Forecast future growth based on history
 */
export function forecastGrowth(
  capabilities: { cycle: number; level: number }[],
  currentLevel: number,
  totalCycles: number
): GrowthForecast {
  if (capabilities.length === 0) {
    return {
      predictedLevel: currentLevel,
      predictedCapabilities: 0,
      cyclesUntilNextLevel: Infinity,
      growthRate: 0,
      trend: 'stagnant',
    };
  }

  const growthRate = totalCycles > 0 ? capabilities.length / totalCycles : 0;

  // Calculate recent growth rate (last 20 cycles)
  const recentCaps = capabilities.filter(c => c.cycle > totalCycles - 20);
  const recentRate = recentCaps.length / Math.min(20, totalCycles);

  // Determine trend
  let trend: GrowthForecast['trend'];
  if (growthRate === 0) trend = 'stagnant';
  else if (recentRate > growthRate * 1.3) trend = 'accelerating';
  else if (recentRate < growthRate * 0.7) trend = 'decelerating';
  else trend = 'steady';

  // Predict next level (every 3 capabilities = 1 level, roughly)
  const capsNeeded = (currentLevel + 1) * 3 - capabilities.length;
  const cyclesUntilNextLevel = recentRate > 0 ? Math.ceil(capsNeeded / recentRate) : Infinity;

  return {
    predictedLevel: currentLevel + (cyclesUntilNextLevel < 50 ? 1 : 0),
    predictedCapabilities: Math.round(capabilities.length + recentRate * 20),
    cyclesUntilNextLevel: Math.max(0, cyclesUntilNextLevel),
    growthRate: Math.round(recentRate * 1000) / 1000,
    trend,
  };
}
