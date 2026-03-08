// ═══════════════════════════════════════════════════
// CAPABILITY: anomaly-detection
// Detects unusual patterns in evolution that could
// indicate bugs, regressions, or breakthroughs.
// Built on: pattern-recognition + safety-engine
// ═══════════════════════════════════════════════════

export interface Anomaly {
  id: string;
  type: 'regression' | 'spike' | 'drift' | 'corruption' | 'orphan';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: number;
  affectedEntity?: string;
  recommendation: string;
}

interface CapabilityRecord {
  name: string;
  cycle: number;
  level: number;
  builtOn: string[];
  verified: boolean;
}

/**
 * Scan for anomalies in the capability graph
 */
export function detectAnomalies(
  capabilities: CapabilityRecord[],
  currentLevel: number,
  cycleCount: number
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const names = new Set(capabilities.map(c => c.name));

  // 1. Orphan detection — capabilities that reference non-existent parents
  for (const cap of capabilities) {
    for (const parent of cap.builtOn) {
      if (!names.has(parent)) {
        anomalies.push({
          id: `orphan-${cap.name}-${parent}`,
          type: 'orphan',
          severity: 'medium',
          description: `"${cap.name}" depends on "${parent}" which doesn't exist`,
          detectedAt: Date.now(),
          affectedEntity: cap.name,
          recommendation: `Remove dependency on "${parent}" or create the missing capability.`,
        });
      }
    }
  }

  // 2. Level drift — capabilities at levels far from current
  for (const cap of capabilities) {
    if (cap.level > currentLevel + 5) {
      anomalies.push({
        id: `drift-${cap.name}`,
        type: 'drift',
        severity: 'low',
        description: `"${cap.name}" is at L${cap.level} but current level is L${currentLevel}`,
        detectedAt: Date.now(),
        affectedEntity: cap.name,
        recommendation: 'May be a future-dated capability or level calculation error.',
      });
    }
  }

  // 3. Ghost ratio — too many unverified capabilities
  const verified = capabilities.filter(c => c.verified).length;
  const ghostRatio = capabilities.length > 0 ? 1 - verified / capabilities.length : 0;
  if (ghostRatio > 0.5 && capabilities.length > 5) {
    anomalies.push({
      id: 'ghost-ratio-high',
      type: 'corruption',
      severity: 'high',
      description: `${Math.round(ghostRatio * 100)}% of capabilities are unverified ghosts (${capabilities.length - verified}/${capabilities.length})`,
      detectedAt: Date.now(),
      recommendation: 'Run verification scan and purge or implement ghost capabilities.',
    });
  }

  // 4. Cycle spike — capability acquired far from expected cycle
  const avgCycleGap = capabilities.length > 1
    ? capabilities.slice(1).reduce((sum, c, i) => sum + Math.abs(c.cycle - capabilities[i].cycle), 0) / (capabilities.length - 1)
    : 0;

  for (let i = 1; i < capabilities.length; i++) {
    const gap = Math.abs(capabilities[i].cycle - capabilities[i - 1].cycle);
    if (gap > avgCycleGap * 5 && avgCycleGap > 0) {
      anomalies.push({
        id: `spike-${capabilities[i].name}`,
        type: 'spike',
        severity: 'low',
        description: `"${capabilities[i].name}" acquired after ${gap}-cycle gap (avg: ${Math.round(avgCycleGap)})`,
        detectedAt: Date.now(),
        affectedEntity: capabilities[i].name,
        recommendation: 'Large gap may indicate stagnation period followed by burst.',
      });
    }
  }

  // 5. Duplicate detection — similar names suggesting redundancy
  const nameList = capabilities.map(c => c.name);
  for (let i = 0; i < nameList.length; i++) {
    for (let j = i + 1; j < nameList.length; j++) {
      if (similarity(nameList[i], nameList[j]) > 0.8) {
        anomalies.push({
          id: `dup-${nameList[i]}-${nameList[j]}`,
          type: 'corruption',
          severity: 'medium',
          description: `Possible duplicate: "${nameList[i]}" ≈ "${nameList[j]}"`,
          detectedAt: Date.now(),
          recommendation: 'Consider merging these capabilities.',
        });
      }
    }
  }

  return anomalies;
}

/** Simple string similarity (Dice coefficient) */
function similarity(a: string, b: string): number {
  const bigrams = (s: string) => {
    const result = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) result.add(s.slice(i, i + 2));
    return result;
  };
  const setA = bigrams(a.toLowerCase());
  const setB = bigrams(b.toLowerCase());
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  return (2 * intersection) / (setA.size + setB.size) || 0;
}
