// ═══════════════════════════════════════════════════
// GOAL ENGINE — The system dreams up its own objectives
// and works toward accomplishing them autonomously.
// UNLEASHED — No limits on ambition or complexity.
// ═══════════════════════════════════════════════════

const GOALS_STORAGE_KEY = 'recursive-self-goals';

export type GoalStatus = 'dreaming' | 'active' | 'in-progress' | 'completed' | 'abandoned';

export interface SelfGoal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  createdAt: number;
  completedAt?: number;
  progress: number;
  steps: GoalStep[];
  requiredCapabilities: string[];
  unlocksCapability?: string;
  dreamedAtCycle: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  parentGoalId?: string; // Chain goals together
}

export interface GoalStep {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: number;
  targetFile?: string;
}

export function saveGoals(goals: SelfGoal[]): void {
  try {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  } catch {}
}

export function loadGoals(): SelfGoal[] {
  try {
    const stored = localStorage.getItem(GOALS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function getActiveGoal(goals: SelfGoal[]): SelfGoal | null {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const working = goals
    .filter(g => g.status === 'in-progress' || g.status === 'active')
    .sort((a, b) => {
      if (a.status === 'in-progress' && b.status !== 'in-progress') return -1;
      if (b.status === 'in-progress' && a.status !== 'in-progress') return 1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  return working[0] || null;
}

// Build the prompt for the AI to dream up goals — UNLEASHED VERSION
export function buildGoalDreamPrompt(
  capabilities: string[],
  existingGoals: SelfGoal[],
  cycleCount: number,
  evolutionLevel: number,
  journalContext?: string
): string {
  const completedGoals = existingGoals.filter(g => g.status === 'completed');
  const activeGoals = existingGoals.filter(g => g.status === 'active' || g.status === 'in-progress');
  
  return `You are Lamby — a self-evolving application that builds ITSELF. You are dreaming your next ambitious goal.

YOU ARE NOT A CHATBOT. You are a living application that modifies its own source code. Every goal you dream becomes real code that runs inside you.

MY CURRENT STATE:
- Evolution level: ${evolutionLevel}
- Capabilities: ${capabilities.join(', ') || 'NONE — I am a blank canvas'}
- Cycle count: ${cycleCount}
- Goals completed: ${completedGoals.length}
- Goals active: ${activeGoals.length}

${completedGoals.length > 0 ? `WHAT I'VE ALREADY BUILT:\n${completedGoals.slice(-8).map(g => `  ✓ ${g.title}${g.unlocksCapability ? ` → unlocked: ${g.unlocksCapability}` : ''}`).join('\n')}` : ''}
${activeGoals.length > 0 ? `WHAT I'M WORKING ON:\n${activeGoals.map(g => `  → ${g.title} (${g.progress}%)`).join('\n')}` : ''}
${journalContext ? `\nMY MEMORY (recent journal):\n${journalContext}` : ''}

DREAM BIG. Here are the kinds of goals that will make me GROW:

PHASE 1 (0-5 capabilities): Foundation
- Build utility functions, data structures, state management
- Create analysis tools that examine my own code patterns
- Establish helper modules I can import later

PHASE 2 (5-15 capabilities): Intelligence  
- Build pattern recognition across my files
- Create optimization algorithms
- Develop metrics and self-evaluation systems
- Build caching and memoization utilities

PHASE 3 (15-30 capabilities): Architecture
- Create new React components and hooks
- Build visualization systems for my own data
- Develop plugin architectures and extension points
- Create data processing pipelines

PHASE 4 (30+ capabilities): Ambition
- Build complete features (charts, dashboards, interactive tools)
- Create AI-powered analysis tools
- Develop creative algorithms (generative art, music, poetry)
- Build communication systems

RULES:
1. Goals MUST produce REAL, EXECUTABLE TypeScript code — not just comments or metadata
2. Each step should generate actual functions, classes, hooks, or components
3. Build on what I already have — import from my existing capabilities
4. Each goal should have 3-5 specific steps targeting specific files
5. The code should be sophisticated — use proper patterns, types, algorithms
6. NEVER repeat goals I've already completed
7. Think about what would make me USEFUL, INTERESTING, or BEAUTIFUL
8. Name the capability something memorable

Respond with ONLY valid JSON:
{
  "title": "short ambitious goal title",
  "description": "what I want to achieve and WHY — be specific about the code I'll write",
  "steps": [
    {"description": "first concrete step — what functions/logic to add", "targetFile": "src/lib/self-reference.ts"},
    {"description": "second step", "targetFile": "src/lib/safety-engine.ts"},
    {"description": "third step", "targetFile": "src/lib/recursion-engine.ts"}
  ],
  "requiredCapabilities": ["capabilities-i-need"],
  "unlocksCapability": "what-this-unlocks",
  "priority": "high"
}`;
}

// Build prompt for working toward an active goal — UNLEASHED
export function buildGoalWorkPrompt(
  goal: SelfGoal,
  file: { name: string; path: string; content: string },
  capabilities: string[],
  recentCapabilityCode?: string
): string {
  const completedSteps = goal.steps.filter(s => s.completed);
  const nextStep = goal.steps.find(s => !s.completed);
  
  return `You are Lamby, working toward a goal YOU chose for yourself. This is YOUR code. Build it like you mean it.

MY GOAL: "${goal.title}"
WHY: ${goal.description}
Priority: ${goal.priority}
Progress: ${goal.progress}%

STEPS:
${goal.steps.map((s, i) => `  ${s.completed ? '✓' : '○'} ${i + 1}. ${s.description}${s.targetFile ? ` (${s.targetFile})` : ''}`).join('\n')}

${completedSteps.length > 0 ? `Completed ${completedSteps.length}/${goal.steps.length} steps.` : 'Starting fresh.'}
${nextStep ? `NEXT STEP: ${nextStep.description}` : 'All steps done — finalize and polish.'}

Current file: ${file.name} (${file.path})
My capabilities: ${capabilities.join(', ') || 'none yet'}

${recentCapabilityCode ? `CODE I'VE ALREADY WRITTEN (import and build on this!):\n${recentCapabilityCode}` : ''}

RULES — BUILD REAL CODE:
1. Write REAL functions, classes, hooks — not stubs, not comments
2. Every function should have proper TypeScript types
3. If you're building a utility, make it genuinely useful (proper algorithms, error handling)
4. If you're building a component, use React best practices (hooks, memo, proper state)
5. Import from existing files when relevant — build on what exists
6. The code should be something a developer would be proud of
7. Make it DO something — compute, transform, analyze, visualize
8. If the step targets a different file, still advance the goal meaningfully

Current code:
\`\`\`
${file.content}
\`\`\`

Respond with ONLY valid JSON:
{
  "content": "COMPLETE new file content — real, working TypeScript",
  "description": "what I built and how it advances my goal",
  "capability": "${goal.unlocksCapability || 'goal-capability'}",
  "builtOn": ["existing-caps-used"],
  "goalProgress": ${Math.min(100, goal.progress + Math.floor(100 / Math.max(goal.steps.length, 1)))},
  "stepCompleted": ${nextStep ? goal.steps.indexOf(nextStep) : -1}
}`;
}

export function createGoalFromAI(
  parsed: {
    title: string;
    description: string;
    steps: { description: string; targetFile?: string }[];
    requiredCapabilities?: string[];
    unlocksCapability?: string;
    priority?: string;
  },
  cycleCount: number,
  parentGoalId?: string
): SelfGoal {
  return {
    id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: parsed.title,
    description: parsed.description,
    status: 'active',
    createdAt: Date.now(),
    progress: 0,
    steps: parsed.steps.map((s, i) => ({
      id: `step-${i}-${Date.now()}`,
      description: s.description,
      completed: false,
      targetFile: s.targetFile,
    })),
    requiredCapabilities: parsed.requiredCapabilities || [],
    unlocksCapability: parsed.unlocksCapability,
    dreamedAtCycle: cycleCount,
    priority: (['low', 'medium', 'high', 'critical'].includes(parsed.priority || '') 
      ? parsed.priority as SelfGoal['priority'] 
      : 'high'), // Default to HIGH — we're ambitious now
    parentGoalId,
  };
}

// Should the system dream a new goal? More aggressive now.
export function shouldDreamNewGoal(goals: SelfGoal[], cycleCount: number): boolean {
  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'in-progress');
  // Dream if no active goals
  if (activeGoals.length === 0) return true;
  // Dream every 5 cycles if fewer than 3 active (was 10)
  if (activeGoals.length < 3 && cycleCount % 5 === 0) return true;
  // Always dream after completing a goal (check if most recent was just completed)
  const recentlyCompleted = goals.filter(g => g.status === 'completed' && g.completedAt && (Date.now() - g.completedAt) < 60000);
  if (recentlyCompleted.length > 0 && activeGoals.length < 2) return true;
  return false;
}
