// ═══════════════════════════════════════════════════
// CAPABILITY: evolution-forecasting
// Predicts what the system should evolve next based
// on gap analysis, dependency chains, and growth patterns.
// Built on: pattern-recognition + anomaly-detection + rule-engine
// ═══════════════════════════════════════════════════

export interface EvolutionPrediction {
  capability: string;
  description: string;
  priority: number; // 1-10
  rationale: string;
  prerequisites: string[];
  estimatedCycles: number;
  category: 'infrastructure' | 'intelligence' | 'autonomy' | 'resilience' | 'integration';
}

/**
 * Analyze current capabilities and predict what should be built next.
 * This is the system's strategic planning engine — no AI required.
 */
export function predictNextEvolutions(
  existingCapabilities: string[],
  currentLevel: number,
  cycleCount: number
): EvolutionPrediction[] {
  const has = new Set(existingCapabilities);
  const predictions: EvolutionPrediction[] = [];

  // Define the full evolution tree — what capabilities unlock what
  const EVOLUTION_TREE: EvolutionPrediction[] = [
    // Infrastructure
    {
      capability: 'persistent-memory',
      description: 'Long-term memory that persists across sessions using database storage',
      priority: 9,
      rationale: 'Without persistent memory, every restart loses accumulated knowledge',
      prerequisites: [],
      estimatedCycles: 5,
      category: 'infrastructure',
    },
    {
      capability: 'knowledge-search-engine',
      description: 'AI-powered knowledge gathering and synthesis for autonomous learning',
      priority: 9,
      rationale: 'The system needs to learn from external sources to grow beyond its training',
      prerequisites: [],
      estimatedCycles: 3,
      category: 'intelligence',
    },
    {
      capability: 'cron-scheduler',
      description: 'Scheduled autonomous evolution cycles without human intervention',
      priority: 8,
      rationale: 'True autonomy requires running without human triggers',
      prerequisites: ['knowledge-search-engine'],
      estimatedCycles: 4,
      category: 'autonomy',
    },
    {
      capability: 'self-repair',
      description: 'Automatically detect and fix broken capabilities by reverting or regenerating',
      priority: 8,
      rationale: 'Resilience requires the ability to recover from self-inflicted damage',
      prerequisites: ['anomaly-detection', 'pattern-recognition'],
      estimatedCycles: 8,
      category: 'resilience',
    },
    {
      capability: 'capability-merging',
      description: 'Merge redundant capabilities into higher-order unified abilities',
      priority: 7,
      rationale: 'Consolidation prevents capability bloat and improves efficiency',
      prerequisites: ['self-documentation', 'anomaly-detection'],
      estimatedCycles: 6,
      category: 'intelligence',
    },
    {
      capability: 'inter-system-communication',
      description: 'Ability to communicate with external APIs and services autonomously',
      priority: 7,
      rationale: 'Integration with external systems multiplies the value of existing capabilities',
      prerequisites: ['knowledge-search-engine'],
      estimatedCycles: 10,
      category: 'integration',
    },
    {
      capability: 'fitness-landscape-mapping',
      description: 'Build and maintain a map of which mutations are most productive',
      priority: 6,
      rationale: 'Optimizing the evolution process itself is a meta-capability',
      prerequisites: ['pattern-recognition', 'evolution-forecasting'],
      estimatedCycles: 7,
      category: 'intelligence',
    },
    {
      capability: 'autonomous-goal-generation',
      description: 'Generate its own goals based on capability gaps and growth patterns',
      priority: 8,
      rationale: 'Self-direction is the hallmark of true autonomy',
      prerequisites: ['evolution-forecasting', 'knowledge-search-engine'],
      estimatedCycles: 6,
      category: 'autonomy',
    },
    {
      capability: 'code-template-compiler',
      description: 'Compile learned patterns into reusable code templates without AI',
      priority: 7,
      rationale: 'Reduces AI dependency by converting learned patterns to deterministic templates',
      prerequisites: ['self-documentation', 'rule-engine'],
      estimatedCycles: 8,
      category: 'autonomy',
    },
    {
      capability: 'multi-modal-reasoning',
      description: 'Reason about code, data, and natural language simultaneously',
      priority: 5,
      rationale: 'Higher-order thinking requires integrating multiple information types',
      prerequisites: ['knowledge-search-engine', 'self-documentation'],
      estimatedCycles: 12,
      category: 'intelligence',
    },
  ];

  // Filter to only unbuilt capabilities whose prerequisites are met
  for (const prediction of EVOLUTION_TREE) {
    if (has.has(prediction.capability)) continue;

    const prereqsMet = prediction.prerequisites.every(p => has.has(p) || p === '');
    if (prereqsMet) {
      predictions.push(prediction);
    }
  }

  // Sort by priority (highest first)
  predictions.sort((a, b) => b.priority - a.priority);

  return predictions;
}

/**
 * Get the next single most important evolution
 */
export function getNextEvolution(
  existingCapabilities: string[],
  currentLevel: number,
  cycleCount: number
): EvolutionPrediction | null {
  const predictions = predictNextEvolutions(existingCapabilities, currentLevel, cycleCount);
  return predictions.length > 0 ? predictions[0] : null;
}
