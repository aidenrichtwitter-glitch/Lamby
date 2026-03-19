// ═══════════════════════════════════════════════════
// CAPABILITY: natural-language-goals
// Accepts goals in plain English and auto-decomposes
// them into capability requirements, execution steps,
// and priority ordering. Bridges human intent with
// autonomous execution.
// Built on: multi-modal-reasoning + task-decomposition + autonomous-goal-generation
// ═══════════════════════════════════════════════════

import { reason } from './multi-modal-reasoning';
import { decomposeTask, type DecomposedTask } from './task-decomposition';

export interface ParsedGoal {
  title: string;
  description: string;
  intent: GoalIntent;
  requiredCapabilities: string[];
  steps: GoalStep[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedCycles: number;
  tags: string[];
  unlocks: string | null;
}

export interface GoalStep {
  order: number;
  action: string;
  type: 'build' | 'verify' | 'integrate' | 'test' | 'deploy';
  estimatedMinutes: number;
  requiresCapability?: string;
}

export type GoalIntent =
  | 'build-capability'
  | 'fix-issue'
  | 'improve-performance'
  | 'add-feature'
  | 'refactor'
  | 'explore'
  | 'general';

// ─── Intent Detection Patterns ─────────────────────

const INTENT_PATTERNS: { intent: GoalIntent; keywords: string[]; weight: number }[] = [
  { intent: 'build-capability', keywords: ['build', 'create', 'implement', 'add capability', 'develop', 'make', 'synthesize'], weight: 3 },
  { intent: 'fix-issue', keywords: ['fix', 'repair', 'debug', 'resolve', 'broken', 'error', 'bug', 'crash'], weight: 3 },
  { intent: 'improve-performance', keywords: ['optimize', 'speed up', 'faster', 'improve', 'performance', 'efficient', 'reduce'], weight: 2 },
  { intent: 'add-feature', keywords: ['feature', 'add', 'support', 'enable', 'integrate', 'connect'], weight: 2 },
  { intent: 'refactor', keywords: ['refactor', 'restructure', 'clean up', 'reorganize', 'simplify', 'consolidate'], weight: 2 },
  { intent: 'explore', keywords: ['explore', 'investigate', 'research', 'analyze', 'understand', 'discover', 'learn'], weight: 1 },
];

// ─── Capability Keywords ───────────────────────────

const CAPABILITY_KEYWORDS: Record<string, string[]> = {
  'pattern-recognition': ['pattern', 'detect', 'recognize', 'classify', 'categorize'],
  'anomaly-detection': ['anomaly', 'unusual', 'abnormal', 'outlier', 'regression'],
  'self-repair': ['repair', 'heal', 'recover', 'restore', 'self-fix'],
  'evolution-forecasting': ['forecast', 'predict', 'future', 'plan', 'roadmap'],
  'code-template-compiler': ['template', 'generate code', 'scaffold', 'boilerplate'],
  'multi-modal-reasoning': ['reason', 'analyze', 'understand', 'synthesize'],
  'fitness-landscape-mapping': ['fitness', 'landscape', 'mutation', 'success rate'],
  'capability-merging': ['merge', 'combine', 'unify', 'consolidate capabilities'],
  'task-decomposition': ['decompose', 'break down', 'steps', 'subtasks'],
  'persistent-memory': ['remember', 'persist', 'store', 'save', 'memory'],
  'knowledge-search-engine': ['search', 'find', 'lookup', 'web', 'knowledge'],
  'rule-engine': ['rule', 'deterministic', 'without ai', 'template'],
  'self-documentation': ['document', 'describe', 'explain', 'catalog'],
  'contextual-code-synthesis': ['synthesize', 'generate module', 'write code', 'code from spec'],
};

/**
 * Parse a natural language goal into a structured goal specification
 */
export function parseGoal(naturalLanguage: string, existingCapabilities: string[]): ParsedGoal {
  const lower = naturalLanguage.toLowerCase();

  // 1. Detect intent
  const intent = detectIntent(lower);

  // 2. Extract required capabilities
  const requiredCapabilities = detectRequiredCapabilities(lower, existingCapabilities);

  // 3. Determine priority
  const priority = detectPriority(lower, intent);

  // 4. Generate steps using task decomposition + intent-specific logic
  const decomposed = decomposeTask(naturalLanguage);
  const steps = convertToGoalSteps(decomposed, intent);

  // 5. Use multi-modal reasoning for deeper analysis
  const analysis = reason({
    mode: 'text',
    text: naturalLanguage,
    question: 'What capability does this goal require and what would it unlock?',
  });

  // 6. Determine what this unlocks
  const unlocks = detectUnlockedCapability(lower, analysis.textAnalysis?.entities || []);

  // 7. Extract tags
  const tags = [
    intent,
    priority,
    ...requiredCapabilities.slice(0, 3),
    ...(analysis.textAnalysis?.keywords.slice(0, 3) || []),
  ];

  // 8. Estimate cycles
  const estimatedCycles = estimateCycles(steps, intent, requiredCapabilities, existingCapabilities);

  // 9. Generate title from natural language
  const title = generateTitle(naturalLanguage, intent);

  return {
    title,
    description: naturalLanguage,
    intent,
    requiredCapabilities,
    steps,
    priority,
    estimatedCycles,
    tags: [...new Set(tags)],
    unlocks,
  };
}

/**
 * Parse multiple goals from a paragraph (split on newlines, semicolons, or numbered items)
 */
export function parseGoals(text: string, existingCapabilities: string[]): ParsedGoal[] {
  const lines = text
    .split(/[\n;]|(?:\d+\.\s)/)
    .map(l => l.trim())
    .filter(l => l.length > 10); // filter out tiny fragments

  return lines.map(line => parseGoal(line, existingCapabilities));
}

/**
 * Convert a parsed goal into a database-ready goal object
 */
export function toGoalRecord(parsed: ParsedGoal, cycleNumber: number): Record<string, unknown> {
  return {
    id: `goal-${toKebabCase(parsed.title)}-${Date.now()}`,
    title: parsed.title,
    description: parsed.description,
    status: 'active',
    priority: parsed.priority,
    required_capabilities: parsed.requiredCapabilities,
    unlocks_capability: parsed.unlocks,
    steps: parsed.steps,
    dreamed_at_cycle: cycleNumber,
    progress: 0,
  };
}

// ─── Internal Helpers ──────────────────────────────

function detectIntent(text: string): GoalIntent {
  let best: { intent: GoalIntent; score: number } = { intent: 'general', score: 0 };

  for (const pattern of INTENT_PATTERNS) {
    const matches = pattern.keywords.filter(kw => text.includes(kw));
    const score = matches.length * pattern.weight;
    if (score > best.score) {
      best = { intent: pattern.intent, score };
    }
  }

  return best.intent;
}

function detectRequiredCapabilities(text: string, existing: string[]): string[] {
  const required: string[] = [];

  for (const [capability, keywords] of Object.entries(CAPABILITY_KEYWORDS)) {
    const matches = keywords.filter(kw => text.includes(kw));
    if (matches.length > 0) {
      required.push(capability);
    }
  }

  // Also check if any existing capability names are mentioned directly
  for (const cap of existing) {
    if (text.includes(cap)) {
      required.push(cap);
    }
  }

  return [...new Set(required)];
}

function detectPriority(text: string, intent: GoalIntent): ParsedGoal['priority'] {
  if (/urgent|critical|asap|immediately|must|breaking/i.test(text)) return 'critical';
  if (/important|high priority|needs to|should|required/i.test(text)) return 'high';
  if (/nice to have|eventually|low priority|someday|could/i.test(text)) return 'low';
  if (intent === 'fix-issue') return 'high';
  return 'medium';
}

function convertToGoalSteps(decomposed: DecomposedTask, intent: GoalIntent): GoalStep[] {
  return decomposed.steps.map((step, i) => ({
    order: i + 1,
    action: step.action,
    type: mapStepType(step.category, intent),
    estimatedMinutes: step.estimateMinutes,
  }));
}

function mapStepType(category: string, intent: GoalIntent): GoalStep['type'] {
  if (category === 'verify') return 'verify';
  if (category === 'cleanup') return 'deploy';
  if (category === 'prepare') return intent === 'build-capability' ? 'build' : 'integrate';
  if (category === 'execute') return intent === 'fix-issue' ? 'test' : 'build';
  return 'build';
}

function detectUnlockedCapability(text: string, entities: string[]): string | null {
  // Check if text describes building a specific capability
  const buildMatch = text.match(/(?:build|create|implement|add)\s+(?:a\s+)?([a-z][\w-]+(?:\s+[a-z][\w-]+){0,3})/i);
  if (buildMatch) {
    return toKebabCase(buildMatch[1]);
  }

  // Check entities for capability-like names
  for (const entity of entities) {
    if (entity.includes('-') && entity.length > 5) return entity;
  }

  return null;
}

function estimateCycles(
  steps: GoalStep[],
  intent: GoalIntent,
  required: string[],
  existing: string[]
): number {
  let base = Math.ceil(steps.length / 2);

  // Missing capabilities add cycles
  const missing = required.filter(r => !existing.includes(r));
  base += missing.length * 3;

  // Intent complexity multiplier
  if (intent === 'build-capability') base = Math.ceil(base * 1.5);
  if (intent === 'fix-issue') base = Math.ceil(base * 0.8);
  if (intent === 'explore') base = Math.ceil(base * 0.5);

  return Math.max(1, Math.min(20, base));
}

function generateTitle(text: string, intent: GoalIntent): string {
  // Take first meaningful phrase (up to 60 chars)
  let title = text.split(/[.!?;]/).find(s => s.trim().length > 5)?.trim() || text;
  if (title.length > 60) title = title.slice(0, 57) + '...';

  // Capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}
