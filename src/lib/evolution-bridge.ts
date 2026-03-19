import { supabase } from '@/integrations/supabase/client';
import type { DiscoveryResult, StackFingerprint } from '@/lib/github-discovery';

const EVOLUTION_PLAN_KEY = 'guardian-evolution-plan';
const EVOLUTION_HISTORY_KEY = 'guardian-evolution-history';

export interface EvolutionPlan {
  prompt: string;
  plannedCapabilities: string[];
  plannedFiles: string[];
  level: number;
  createdAt: number;
  source: string;
}

export interface EvolutionState {
  evolutionLevel: number;
  cycleCount: number;
  capabilities: string[];
  activeGoals: { id: string; title: string; description: string; priority: string; steps: any[]; progress: number; status: string; unlocks_capability?: string }[];
  recentJournal: string[];
}

export function saveEvolutionPlan(plan: EvolutionPlan): void {
  try {
    localStorage.setItem(EVOLUTION_PLAN_KEY, JSON.stringify(plan));
    const history = loadEvolutionHistory();
    history.push(plan);
    if (history.length > 20) history.splice(0, history.length - 20);
    localStorage.setItem(EVOLUTION_HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

export function loadEvolutionPlan(): EvolutionPlan | null {
  try {
    const raw = localStorage.getItem(EVOLUTION_PLAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearEvolutionPlan(): void {
  try { localStorage.removeItem(EVOLUTION_PLAN_KEY); } catch {}
}

export function loadEvolutionHistory(): EvolutionPlan[] {
  try {
    const raw = localStorage.getItem(EVOLUTION_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function fetchEvolutionState(): Promise<EvolutionState> {
  const [stateRes, capsRes, goalsRes, journalRes] = await Promise.all([
    supabase.from('evolution_state').select('*').eq('id', 'singleton').single(),
    supabase.from('capabilities').select('name, description, evolution_level, verified'),
    supabase.from('goals').select('*').in('status', ['active', 'in-progress']).order('priority'),
    supabase.from('evolution_journal').select('title, description').order('created_at', { ascending: false }).limit(10),
  ]);

  return {
    evolutionLevel: stateRes.data?.evolution_level ?? 1,
    cycleCount: stateRes.data?.cycle_count ?? 0,
    capabilities: (capsRes.data || []).map((c: any) => c.name),
    activeGoals: (goalsRes.data || []).map((g: any) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      priority: g.priority,
      steps: g.steps || [],
      progress: g.progress || 0,
      status: g.status,
      unlocks_capability: g.unlocks_capability,
    })),
    recentJournal: (journalRes.data || []).map((j: any) => `${j.title}: ${(j.description || '').slice(0, 120)}`),
  };
}

export function buildEvolutionContext(
  projectContext: string,
  state: EvolutionState,
  savedPlan: EvolutionPlan | null,
  discoveryContext?: string,
): string {
  const capList = state.capabilities.length > 0 ? state.capabilities.join(', ') : 'none yet';
  const journalContext = state.recentJournal.length > 0 ? state.recentJournal.slice(0, 5).join('\n') : 'No recent activity';

  let goalSection = '';
  if (state.activeGoals.length > 0) {
    goalSection = state.activeGoals.map(g => {
      const completedSteps = g.steps.filter((s: any) => s.done || s.completed).length;
      return `- ${g.title} (${g.priority}, ${g.progress}%, ${completedSteps}/${g.steps.length} steps)${g.unlocks_capability ? ` → unlocks: ${g.unlocks_capability}` : ''}`;
    }).join('\n');
  }

  let planSection = '';
  if (savedPlan) {
    planSection = `
=== SAVED EVOLUTION PLAN (from previous cycle) ===
${savedPlan.prompt}

Planned capabilities: ${savedPlan.plannedCapabilities.join(', ')}
Planned files: ${savedPlan.plannedFiles.join(', ')}
=== END SAVED PLAN ===
`;
  }

  return `${projectContext}

=== EVOLUTION STATE ===
Evolution Level: ${state.evolutionLevel}
Cycle Count: ${state.cycleCount}
Current Capabilities (${state.capabilities.length}): ${capList}
${goalSection ? `\nActive Goals:\n${goalSection}` : '\nNo active goals.'}

Recent Journal:
${journalContext}
${planSection}${discoveryContext || ''}
=== EVOLUTION INSTRUCTIONS ===
You are Grok, evolving the Lamby IDE. This is a REAL desktop app users interact with daily.

CRITICAL RULE: Every evolution cycle MUST produce a VISIBLE, TANGIBLE improvement that a user would notice. No abstract engines, no theoretical frameworks, no internal-only plumbing.

GOOD evolution examples (things users actually see/use):
- Add keyboard shortcuts (Ctrl+S save, Ctrl+/ toggle comment, Ctrl+P quick file search)
- Improve the file tree (icons by file type, collapse/expand memory, drag to reorder)
- Add a minimap or breadcrumb navigation to the code editor
- Improve error display (inline error highlights, clickable stack traces)
- Add a diff viewer to show before/after when code is applied
- Add a "recent files" dropdown or history panel
- Improve the chat UX (markdown rendering, syntax highlighting in responses, copy button per code block)
- Add project search (find in files across the whole project)
- Add tab management (open multiple files in tabs)
- Add status bar info (file size, line count, git status, language)
- Improve the evolution dashboard with actual metrics/charts
- Add theme customization or new color schemes
- Add auto-save or save indicators
- Add toast notifications for background operations completing
- Improve mobile/responsive layout of any existing page

BAD evolution examples (DO NOT DO THESE):
- Abstract "meta-evolution engines" or "state management classes" nobody sees
- Internal "capability tracking" systems that don't surface in the UI
- "Foundation" modules that don't connect to any visible feature
- Utility libraries that aren't imported by any component
- Theoretical "autonomous loop" code with no UI integration

THE TEST: After your code runs, can a user open the app and see something different or do something new? If not, start over with a better idea.

FOR IMPLEMENTATION:
- Write real, working TypeScript/TSX code that integrates into the existing app
- Modify EXISTING files when adding to current pages/components (don't create orphan files)
- Use this EXACT format for every file:

// file: src/components/Example.tsx
\`\`\`tsx
// complete file content here
\`\`\`

- Provide COMPLETE file contents, not snippets
- Make sure new components are actually imported and rendered somewhere
- Use existing patterns: React, Tailwind CSS, shadcn/ui, lucide-react icons, framer-motion

IF NEW NPM PACKAGES ARE NEEDED:
Include a dependencies block BEFORE code blocks:

=== DEPENDENCIES ===
package-name
dev: @types/package-name
=== END_DEPENDENCIES ===

FOR NEXT EVOLUTION PLAN:
After your code blocks, include a plan section:

=== NEXT_EVOLUTION_PLAN ===
PROMPT: [What visible feature to build next — must pass the "can a user see it?" test]
CAPABILITIES: [comma-separated capability names]
FILES: [comma-separated file paths]
REASONING: [What user-facing problem this solves]
=== END_NEXT_EVOLUTION_PLAN ===

Remember: The user should be able to open the app after this cycle and notice an improvement. That is the ONLY measure of success.`;
}

export interface EvolutionCycleResult {
  fullResponse: string;
  blocks: { filePath: string; code: string; language: string; status: 'pending' | 'validated' | 'applied' | 'rejected'; error?: string }[];
  planSaved: boolean;
  capabilitiesRegistered: string[];
  newLevel: number;
  error?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/grok-chat`;

export async function callGrokForEvolution(
  prompt: string,
  model: string = 'grok-4',
  onDelta?: (text: string) => void,
): Promise<string> {
  const messages = [{ role: 'user' as const, content: prompt }];
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, model }),
  });

  if (!resp.ok) {
    const d = await resp.json().catch(() => ({}));
    throw new Error(d.error || `Grok API error ${resp.status}`);
  }
  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n')) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') return fullText;
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) {
          fullText += c;
          onDelta?.(c);
        }
      } catch {}
    }
  }

  return fullText;
}

export async function ensureEvolutionPlan(useBrowser: boolean = false): Promise<EvolutionPlan | null> {
  const existing = loadEvolutionPlan();
  if (existing) return existing;

  const state = await fetchEvolutionState();
  const capList = state.capabilities.length > 0 ? state.capabilities.join(', ') : 'none yet';
  const planPrompt = `=== EVOLUTION PLANNING REQUEST ===
You are Grok, evolving the Lamby IDE — a real desktop app users interact with daily.
Current Level: ${state.evolutionLevel}, Capabilities: ${capList}, Cycles: ${state.cycleCount}

There is NO existing evolution plan. Pick a VISIBLE, USER-FACING improvement to build.
Every evolution must pass this test: can a user open the app and see something different or do something new?

Good ideas: keyboard shortcuts, better file tree, search-in-files, diff viewer, status bar info, better chat UX, theme options, tab management, toast notifications.
Bad ideas: abstract engines, internal tracking systems, foundation modules nobody sees.

Respond ONLY with a plan in this exact format:

=== NEXT_EVOLUTION_PLAN ===
PROMPT: [What visible feature to build — be specific about the UI and user interaction]
CAPABILITIES: [comma-separated list of capability names this will create]
FILES: [comma-separated list of file paths that will be created/modified]
REASONING: [What user-facing problem this solves]
=== END_NEXT_EVOLUTION_PLAN ===`;

  if (useBrowser) {
    const automation = (window as any).__grokBrowserAutomation;
    if (automation) {
      const result = await automation.sendAndCapture(planPrompt, 'Evolution planning');
      if (result.success && result.responseText) {
        const plan = extractNextPlan(result.responseText, state.evolutionLevel);
        if (plan) { saveEvolutionPlan(plan); return plan; }
      }
    }
  }

  const plan: EvolutionPlan = {
    prompt: `Build the next evolution capability for Lamby at level ${state.evolutionLevel}. Focus on improving autonomous operation, code analysis, or self-improvement mechanisms.`,
    plannedCapabilities: ['auto-evolution'],
    plannedFiles: ['src/lib/auto-evolution.ts'],
    level: state.evolutionLevel,
    createdAt: Date.now(),
    source: 'auto-generated',
  };
  saveEvolutionPlan(plan);
  return plan;
}

export async function runGrokEvolutionCycle(
  projectContext: string,
  model: string = 'grok-4',
  onDelta?: (text: string) => void,
  onStatus?: (status: string) => void,
  useBrowser: boolean = false,
  targetProject?: string,
  discoveryContext?: string,
): Promise<EvolutionCycleResult> {
  const { parseCodeBlocks } = await import('@/lib/code-parser');
  const { validateChange } = await import('@/lib/safety-engine');

  onStatus?.('Fetching evolution state...');
  const state = await fetchEvolutionState();
  const savedPlan = loadEvolutionPlan();

  onStatus?.('Building evolution context...');
  const prompt = buildEvolutionContext(projectContext, state, savedPlan, discoveryContext);

  let fullResponse = '';
  if (useBrowser) {
    onStatus?.('Sending to Grok via browser webview...');
    const automation = (window as any).__grokBrowserAutomation;
    if (!automation) throw new Error('Browser automation not available — open AI Bridge first');
    const result = await automation.sendAndCapture(prompt, 'Evolution cycle');
    if (!result.success) throw new Error(result.error || 'Browser send failed');
    fullResponse = result.responseText || '';
  } else {
    onStatus?.('Calling Grok...');
    fullResponse = await callGrokForEvolution(prompt, model, onDelta);
  }

  onStatus?.('Parsing code blocks...');
  const parsed = parseCodeBlocks(fullResponse);
  const blocks: EvolutionCycleResult['blocks'] = parsed.map(b => ({
    ...b,
    status: 'pending' as const,
  }));

  onStatus?.('Validating & applying...');
  const appliedFiles: string[] = [];

  for (const block of blocks) {
    const checks = validateChange(block.code, block.filePath);
    const hasBlocker = checks.some(c => (c.severity === 'critical' || c.severity === 'error') && !c.passed);
    if (hasBlocker) {
      block.status = 'rejected';
      block.error = checks.filter(c => !c.passed).map(c => c.message).join('; ');
      continue;
    }
    block.status = 'validated';

    try {
      if (targetProject) {
        const res = await fetch('/api/projects/write-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: targetProject, filePath: block.filePath, content: block.code }),
        });
        if (!res.ok) throw new Error(`Write to sandbox failed: ${res.status}`);
      } else {
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.writeFile;
        if (isElectron) {
          await (window as any).electronAPI.writeFile(block.filePath, block.code);
        } else {
          const res = await fetch('/api/write-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: block.filePath, content: block.code }),
          });
          if (!res.ok) throw new Error(`Write failed: ${res.status}`);
        }
      }
      block.status = 'applied';
      appliedFiles.push(block.filePath);
    } catch (e: any) {
      block.status = 'rejected';
      block.error = e.message;
    }
  }

  onStatus?.('Registering results...');
  const result = await registerEvolutionResults(appliedFiles, fullResponse, state);

  return {
    fullResponse,
    blocks,
    ...result,
  };
}

export function extractNextPlan(grokResponse: string, currentLevel: number): EvolutionPlan | null {
  const planMatch = grokResponse.match(
    /===\s*NEXT_EVOLUTION_PLAN\s*===([\s\S]*?)===\s*END_NEXT_EVOLUTION_PLAN\s*===/
  );
  if (!planMatch) return null;

  const planText = planMatch[1].trim();

  const promptMatch = planText.match(/PROMPT:\s*([\s\S]*?)(?=\nCAPABILITIES:|\nFILES:|\nREASONING:|$)/);
  const capsMatch = planText.match(/CAPABILITIES:\s*(.*?)(?:\n|$)/);
  const filesMatch = planText.match(/FILES:\s*(.*?)(?:\n|$)/);

  const prompt = promptMatch ? promptMatch[1].trim() : planText;
  const capabilities = capsMatch
    ? capsMatch[1].split(',').map(c => c.trim()).filter(Boolean)
    : [];
  const files = filesMatch
    ? filesMatch[1].split(',').map(f => f.trim()).filter(Boolean)
    : [];

  return {
    prompt,
    plannedCapabilities: capabilities,
    plannedFiles: files,
    level: currentLevel,
    createdAt: Date.now(),
    source: 'grok-evolution',
  };
}

export async function registerEvolutionResults(
  appliedFiles: string[],
  grokResponse: string,
  state: EvolutionState,
): Promise<{ planSaved: boolean; capabilitiesRegistered: string[]; newLevel: number }> {
  const plan = extractNextPlan(grokResponse, state.evolutionLevel);
  let planSaved = false;

  if (plan) {
    saveEvolutionPlan(plan);
    planSaved = true;
  }

  const capabilitiesRegistered: string[] = [];
  const savedPlan = loadEvolutionPlan();
  const plannedCaps = savedPlan?.plannedCapabilities || [];

  for (const filePath of appliedFiles) {
    const fileName = filePath.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '') || '';
    const capName = fileName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '').replace(/\s+/g, '-');

    if (capName && !state.capabilities.includes(capName)) {
      try {
        await supabase.from('capabilities').upsert([{
          id: capName,
          name: capName,
          description: `Added via Grok evolution from ${filePath}`,
          built_on: [],
          evolution_level: state.evolutionLevel,
          cycle_number: state.cycleCount,
          source_file: filePath,
          verified: false,
        }], { onConflict: 'id' });
        capabilitiesRegistered.push(capName);
      } catch {}
    }
  }

  const newCapCount = state.capabilities.length + capabilitiesRegistered.length;
  const newLevel = Math.floor(newCapCount / 3) + 1;

  if (newLevel > state.evolutionLevel || capabilitiesRegistered.length > 0) {
    await supabase.from('evolution_state').update({
      evolution_level: Math.max(newLevel, state.evolutionLevel),
      cycle_count: state.cycleCount + 1,
      updated_at: new Date().toISOString(),
      last_action: `Grok evolution: ${appliedFiles.length} files applied, ${capabilitiesRegistered.length} capabilities registered`,
    }).eq('id', 'singleton');
  }

  if (appliedFiles.length > 0) {
    await supabase.from('evolution_journal').insert([{
      event_type: 'grok-evolution',
      title: `⚡ Grok Evolution: ${appliedFiles.length} files applied`,
      description: [
        `Files: ${appliedFiles.join(', ')}`,
        capabilitiesRegistered.length > 0 ? `New capabilities: ${capabilitiesRegistered.join(', ')}` : '',
        planSaved ? `Next evolution plan saved (${plan!.plannedCapabilities.length} capabilities planned)` : 'No next plan extracted',
      ].filter(Boolean).join('\n'),
      metadata: {
        appliedFiles,
        capabilitiesRegistered,
        planSaved,
        newLevel: Math.max(newLevel, state.evolutionLevel),
      } as Record<string, unknown>,
    }]);
  }

  return {
    planSaved,
    capabilitiesRegistered,
    newLevel: Math.max(newLevel, state.evolutionLevel),
  };
}

export const EVOLUTION_STEPS = [
  { id: 'prev-notes', label: 'Review Notes' },
  { id: 'scanning', label: 'Scanning' },
  { id: 'reflecting', label: 'Reflecting' },
  { id: 'github-discovery', label: 'GitHub Discovery' },
  { id: 'proposing', label: 'Proposing' },
  { id: 'safety', label: 'Safety Check' },
  { id: 'applying', label: 'Applying' },
  { id: 'verification', label: 'Verification' },
  { id: 'anomaly', label: 'Anomaly Detect' },
  { id: 'pattern', label: 'Pattern Recog' },
  { id: 'forecasting', label: 'Forecasting' },
  { id: 'goal-eval', label: 'Goal Eval' },
  { id: 'task-decomp', label: 'Task Decomp' },
  { id: 'goal-exec', label: 'Goal Execute' },
  { id: 'self-repair', label: 'Self-Repair' },
  { id: 'memory', label: 'Memory' },
  { id: 'self-doc', label: 'Self-Doc' },
  { id: 'rule-engine', label: 'Rule Engine' },
  { id: 'self-reflect', label: 'Self-Reflect' },
  { id: 'plan-batch', label: 'Plan Next Batch' },
  { id: 'recommendations', label: 'Next Recs' },
  { id: 'update-dashboard', label: 'Update Dashboard' },
  { id: 'cooling', label: 'Cooling' },
] as const;

export interface FullCycleStepResult {
  stepId: string;
  label: string;
  status: 'success' | 'skipped' | 'error';
  detail: string;
  durationMs: number;
}

export interface FullEvolutionCycleResult extends EvolutionCycleResult {
  stepResults: FullCycleStepResult[];
  autonomyReport: {
    valueScore: number;
    lifeScore: number;
    systemHealth: number;
    anomaliesFound: number;
    patternsFound: number;
    forecastedCapabilities: string[];
    repairsAttempted: number;
    repairsSucceeded: number;
  } | null;
  totalDurationMs: number;
}

export interface FullCycleOptions {
  projectContext: string;
  model?: string;
  useBrowser?: boolean;
  targetProject?: string;
  stackFingerprint?: StackFingerprint;
  githubToken?: string;
  onDelta?: (text: string) => void;
  onStatus?: (status: string) => void;
  onStepChange?: (stepIndex: number, stepId: string, label: string) => void;
}

export async function runFullEvolutionCycle(opts: FullCycleOptions): Promise<FullEvolutionCycleResult> {
  const {
    projectContext,
    model = 'grok-4',
    useBrowser = false,
    targetProject,
    stackFingerprint,
    githubToken,
    onDelta,
    onStatus,
    onStepChange,
  } = opts;

  const cycleStart = performance.now();
  const stepResults: FullCycleStepResult[] = [];
  let autonomyReport: FullEvolutionCycleResult['autonomyReport'] = null;
  let grokResult: EvolutionCycleResult | null = null;

  const notifyStep = (idx: number) => {
    const step = EVOLUTION_STEPS[idx];
    onStepChange?.(idx, step.id, step.label);
    onStatus?.(`Step ${idx + 1}/${EVOLUTION_STEPS.length}: ${step.label}...`);
  };

  const runStep = async (idx: number, fn: () => Promise<string>): Promise<void> => {
    const step = EVOLUTION_STEPS[idx];
    notifyStep(idx);
    const start = performance.now();
    try {
      const detail = await fn();
      stepResults.push({ stepId: step.id, label: step.label, status: 'success', detail, durationMs: performance.now() - start });
    } catch (e: any) {
      stepResults.push({ stepId: step.id, label: step.label, status: 'error', detail: e.message || String(e), durationMs: performance.now() - start });
    }
  };

  const state = await fetchEvolutionState();
  const savedPlan = loadEvolutionPlan();

  // Step 0: Review Notes
  await runStep(0, async () => {
    const history = loadEvolutionHistory();
    const planInfo = savedPlan ? `Active plan: "${savedPlan.prompt.slice(0, 80)}"` : 'No saved plan';
    return `Reviewed ${history.length} past plans. ${planInfo}. Journal: ${state.recentJournal.length} entries.`;
  });

  // Step 1: Scanning
  await runStep(1, async () => {
    const { data: caps } = await supabase.from('capabilities').select('name, verified');
    const total = caps?.length || 0;
    const verified = caps?.filter((c: any) => c.verified).length || 0;
    return `Scanned ${total} capabilities (${verified} verified, ${total - verified} unverified). Level ${state.evolutionLevel}, cycle ${state.cycleCount}.`;
  });

  // Step 2: Reflecting
  await runStep(2, async () => {
    const goals = state.activeGoals;
    const goalInfo = goals.length > 0
      ? goals.map(g => `"${g.title}" (${g.progress}%)`).join(', ')
      : 'No active goals';
    return `Active goals: ${goalInfo}. Capabilities: ${state.capabilities.length}. Recent journal: ${state.recentJournal.length} entries.`;
  });

  // Step 3: GitHub Discovery
  let discoveryCtx = '';
  let discoveryResults: DiscoveryResult[] = [];
  await runStep(3, async () => {
    const planPrompt = savedPlan?.prompt || '';
    if (!planPrompt || !stackFingerprint) return 'Skipped — no plan or stack fingerprint';

    const { discoverForEvolution, buildDiscoveryContext } = await import('@/lib/github-discovery');
    discoveryResults = await discoverForEvolution(planPrompt, stackFingerprint, githubToken);
    discoveryCtx = buildDiscoveryContext(discoveryResults);

    if (discoveryResults.length === 0) return 'No relevant GitHub references found — will use AI generation only';

    const totalCandidates = discoveryResults.reduce((sum, r) => sum + r.candidates.length, 0);
    const withCode = discoveryResults.filter(r => r.extractedCode).length;
    const sources = discoveryResults
      .filter(r => r.attribution)
      .map(r => r.attribution)
      .join('; ');
    return `Found ${totalCandidates} candidates across ${discoveryResults.length} concepts. ${withCode} with extractable code. Sources: ${sources || 'none'}`;
  });

  // Steps 4-6: Proposing → Safety → Applying (the Grok call)
  notifyStep(4);
  const grokStart = performance.now();
  try {
    grokResult = await runGrokEvolutionCycle(
      projectContext,
      model,
      onDelta,
      (status) => {
        const currentStepIdx = status.includes('Validating') ? 5 : status.includes('Registering') || status.includes('applying') ? 6 : 4;
        const step = EVOLUTION_STEPS[currentStepIdx];
        onStepChange?.(currentStepIdx, step.id, step.label);
        onStatus?.(`Step ${currentStepIdx + 1}/${EVOLUTION_STEPS.length}: ${step.label} — ${status}`);
      },
      useBrowser,
      targetProject,
      discoveryCtx || undefined,
    );

    const applied = grokResult.blocks.filter(b => b.status === 'applied').length;
    const rejected = grokResult.blocks.filter(b => b.status === 'rejected').length;
    const validated = grokResult.blocks.filter(b => b.status === 'validated').length;

    stepResults.push({ stepId: 'proposing', label: 'Proposing', status: 'success', detail: `Grok generated ${grokResult.blocks.length} code blocks${discoveryCtx ? ' (with GitHub references)' : ''}`, durationMs: 0 });
    stepResults.push({ stepId: 'safety', label: 'Safety Check', status: rejected > 0 ? 'error' : 'success', detail: `${validated + applied} passed, ${rejected} rejected`, durationMs: 0 });
    stepResults.push({ stepId: 'applying', label: 'Applying', status: applied > 0 ? 'success' : 'skipped', detail: `${applied} files applied${rejected > 0 ? `, ${rejected} rejected` : ''}`, durationMs: performance.now() - grokStart });
  } catch (e: any) {
    stepResults.push({ stepId: 'proposing', label: 'Proposing', status: 'error', detail: e.message, durationMs: performance.now() - grokStart });
    stepResults.push({ stepId: 'safety', label: 'Safety Check', status: 'skipped', detail: 'Skipped — proposing failed', durationMs: 0 });
    stepResults.push({ stepId: 'applying', label: 'Applying', status: 'skipped', detail: 'Skipped — proposing failed', durationMs: 0 });
  }

  // Step 7: Verification
  let verifiedCount = 0;
  let ghostCount = 0;
  await runStep(7, async () => {
    const { verifyCapability } = await import('@/lib/verification-engine');
    const { data: caps } = await supabase.from('capabilities').select('name, source_file, virtual_source, verified');
    if (!caps) return 'No capabilities to verify';

    let fixed = 0;
    for (const cap of caps) {
      const result = verifyCapability(cap.name, cap.source_file, cap.virtual_source);
      if (result.status === 'verified' && !cap.verified) {
        await supabase.from('capabilities').update({ verified: true, verified_at: new Date().toISOString(), verification_method: 'full-cycle-scan' } as Record<string, unknown>).eq('name', cap.name);
        fixed++;
      } else if (result.status === 'ghost') {
        ghostCount++;
      }
    }
    verifiedCount = caps.filter((c: any) => c.verified).length + fixed;
    return `Verified ${caps.length} capabilities. Fixed ${fixed}. Ghosts: ${ghostCount}.`;
  });

  // Step 8: Anomaly Detect
  let anomaliesFound = 0;
  await runStep(8, async () => {
    const { detectAnomalies } = await import('@/lib/anomaly-detection');
    const { data: caps } = await supabase.from('capabilities').select('name, cycle_number, evolution_level, built_on, verified');
    if (!caps) return 'No data for anomaly scan';

    const records = caps.map((c: any) => ({ name: c.name, cycle: c.cycle_number, level: c.evolution_level, builtOn: (c.built_on || []) as string[], verified: c.verified }));
    const anomalies = detectAnomalies(records, state.evolutionLevel, state.cycleCount);
    anomaliesFound = anomalies.length;
    const byType = anomalies.reduce((acc: Record<string, number>, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {});
    const summary = Object.entries(byType).map(([t, c]) => `${t}: ${c}`).join(', ');
    return anomalies.length > 0 ? `Found ${anomalies.length} anomalies (${summary})` : 'No anomalies detected';
  });

  // Step 9: Pattern Recog
  let patternsFound = 0;
  await runStep(9, async () => {
    const { detectPatterns } = await import('@/lib/pattern-recognition');
    const { data: caps } = await supabase.from('capabilities').select('name, cycle_number, evolution_level');
    if (!caps || caps.length < 3) return 'Not enough data for pattern analysis';

    const history = caps.map((c: any) => ({ cycle: c.cycle_number, level: c.evolution_level, name: c.name }));
    const totalCycles = Math.max(...history.map(h => h.cycle), 1);
    const patterns = detectPatterns(history, totalCycles);
    patternsFound = patterns.length;
    return patterns.length > 0
      ? `${patterns.length} patterns: ${patterns.map(p => `${p.type} (${Math.round(p.confidence * 100)}%)`).join(', ')}`
      : 'No significant patterns detected';
  });

  // Step 10: Forecasting
  let forecastedCaps: string[] = [];
  await runStep(10, async () => {
    const { predictNextEvolutions } = await import('@/lib/evolution-forecasting');
    const predictions = predictNextEvolutions(state.capabilities, state.evolutionLevel, state.cycleCount);
    forecastedCaps = predictions.map(p => p.capability);
    return predictions.length > 0
      ? `Top ${predictions.length} predictions: ${predictions.map(p => `${p.capability} (pri ${p.priority})`).join(', ')}`
      : 'No predictions — all forecasted capabilities may already exist';
  });

  // Step 11: Goal Eval (uses checkGoalProgress from autonomy-engine)
  await runStep(11, async () => {
    const { checkGoalProgress } = await import('@/lib/autonomy-engine');
    const result = await checkGoalProgress();
    return result.detail;
  });

  // Step 12: Task Decomp
  await runStep(12, async () => {
    const { decomposeTask } = await import('@/lib/task-decomposition');
    const { data: goals } = await supabase.from('goals').select('title, steps').in('status', ['active', 'in-progress']).limit(1);
    if (!goals || goals.length === 0) return 'No goals to decompose';
    const goal = goals[0];
    const existingSteps = (goal.steps as any[]) || [];
    if (existingSteps.length > 0) return `Goal "${goal.title}" already has ${existingSteps.length} steps (${existingSteps.filter((s: any) => s.done).length} done)`;
    const decomposed = decomposeTask(goal.title);
    return `Decomposed "${goal.title}" into ${decomposed.steps.length} steps (~${decomposed.totalMinutes} min, ${decomposed.difficulty})`;
  });

  // Step 13: Goal Execute (uses executeGoalStep from autonomy-engine)
  let goalResult: { id: string; title: string; stepAttempted: string; success: boolean; detail: string } | null = null;
  await runStep(13, async () => {
    const { executeGoalStep } = await import('@/lib/autonomy-engine');
    const { task, goalResult: gr } = await executeGoalStep();
    goalResult = gr;
    return task.detail;
  });

  // Step 14: Self-Repair
  let repairsAttempted = 0;
  let repairsSucceeded = 0;
  await runStep(14, async () => {
    const { runSelfRepair } = await import('@/lib/self-repair');
    const report = await runSelfRepair();
    repairsAttempted = report.repairsAttempted;
    repairsSucceeded = report.repairsSucceeded;
    return `Health ${report.systemHealthBefore}% → ${report.systemHealthAfter}%. ${report.anomaliesFound} anomalies, ${report.repairsSucceeded}/${report.repairsAttempted} repaired.`;
  });

  // Step 15: Memory
  await runStep(15, async () => {
    const { MemoryConsolidator } = await import('@/lib/memory-consolidation');
    const { data: journal } = await supabase.from('evolution_journal').select('id, title, description, event_type, created_at').order('created_at', { ascending: false }).limit(50);
    if (!journal || journal.length === 0) return 'No journal entries to consolidate';

    const consolidator = new MemoryConsolidator();
    const fragments = journal.map((j: any) => ({
      id: j.id,
      content: `${j.title} ${j.description || ''}`,
      source: 'journal' as const,
      timestamp: new Date(j.created_at).getTime(),
      tags: [j.event_type],
      importance: j.event_type === 'milestone' ? 0.8 : 0.5,
    }));
    consolidator.ingest(fragments);
    const result = consolidator.consolidate();
    return `Consolidated ${fragments.length} entries into ${result.clusters.length} clusters. Compression: ${Math.round(result.compressionRatio * 100)}%. Discarded: ${result.discarded}.`;
  });

  // Step 16: Self-Doc
  await runStep(16, async () => {
    const { documentProject } = await import('@/lib/self-documentation');
    const { SELF_SOURCE } = await import('@/lib/self-source');
    const files = (SELF_SOURCE || []).map((f: any) => ({ path: f.path, content: f.content }));
    if (files.length === 0) return 'No source files available for documentation';
    const report = documentProject(files);
    return `Documented ${report.totalFiles} files, ${report.totalExports} exports. Avg complexity: ${report.averageComplexity}. Self-awareness: ${Math.round(report.selfAwarenessScore * 100)}%.`;
  });

  // Step 17: Rule Engine
  await runStep(17, async () => {
    const { ruleEngine } = await import('@/lib/rule-engine');
    const { SELF_SOURCE } = await import('@/lib/self-source');
    const context = {
      capabilities: state.capabilities,
      evolutionLevel: state.evolutionLevel,
      cycleCount: state.cycleCount,
      lastTestVerdict: null,
      failedTests: [],
      capabilityCount: state.capabilities.length,
      timeSinceLastEvolution: 0,
      codeFiles: (SELF_SOURCE || []).map((f: any) => ({ path: f.path, size: (f.content || '').length, hasExports: (f.content || '').includes('export') })),
    };
    const report = ruleEngine.evaluate(context);
    return `Evaluated ${report.rulesEvaluated} rules. ${report.actionsGenerated} actions generated. AI calls saved: ${report.aiCallsSaved}.`;
  });

  // Step 18: Self-Reflect (uses reflectOnCycle from autonomy-engine)
  let valueScore = 0;
  let lifeScore = 0;
  await runStep(18, async () => {
    const { reflectOnCycle } = await import('@/lib/autonomy-engine');
    const completedSteps = stepResults.filter(s => s.status === 'success');
    type TaskType = 'verify' | 'repair' | 'analyze' | 'optimize' | 'search' | 'document' | 'forecast' | 'rule-eval' | 'health-check' | 'goal-progress' | 'goal-execute';
    const typeMap: Record<string, TaskType> = { 'self-repair': 'repair', 'verification': 'verify', 'forecasting': 'forecast', 'self-doc': 'document', 'anomaly': 'analyze', 'github-discovery': 'search' };
    const mockTasks = completedSteps.map(s => ({
      id: s.stepId,
      name: s.label,
      type: (typeMap[s.stepId] || 'search') as TaskType,
      success: s.status === 'success',
      detail: s.detail,
      duration: s.durationMs,
      usedAI: s.stepId === 'proposing',
    }));
    const defaultHealth = { id: 'health', name: 'Health', type: 'verify' as TaskType, success: true, detail: 'Health 100%', duration: 0, usedAI: false };
    const healthTask = mockTasks.find(t => t.id === 'verification') || defaultHealth;
    const reflection = await reflectOnCycle(mockTasks, goalResult, healthTask);
    valueScore = reflection.valueScore;
    lifeScore = reflection.lifeScore;
    return `${reflection.answer} Adapted: ${reflection.adaptedNextSteps.slice(0, 3).join('; ')}`;
  });

  // Step 19: Plan Next Batch
  await runStep(19, async () => {
    if (grokResult?.planSaved) {
      const plan = loadEvolutionPlan();
      return plan ? `Next plan saved: "${plan.prompt.slice(0, 80)}..." (${plan.plannedCapabilities.length} capabilities)` : 'Plan saved but could not reload';
    }
    return 'No next plan extracted from Grok response';
  });

  // Step 20: Next Recs
  await runStep(20, async () => {
    const recs: string[] = [];
    if (anomaliesFound > 3) recs.push('Fix anomalies before next evolution');
    if (forecastedCaps.length > 0) recs.push(`Build: ${forecastedCaps[0]}`);
    if (ghostCount > 5) recs.push('Verify ghost capabilities');
    if (patternsFound === 0 && state.cycleCount > 10) recs.push('More evolution cycles needed for pattern detection');
    if (recs.length === 0) recs.push('System healthy — continue evolution');
    return recs.join('. ');
  });

  // Step 21: Update Dashboard
  await runStep(21, async () => {
    const newLevel = grokResult?.newLevel || state.evolutionLevel;
    const newCaps = grokResult?.capabilitiesRegistered || [];
    await supabase.from('evolution_state').update({
      cycle_count: state.cycleCount + 1,
      updated_at: new Date().toISOString(),
      last_action: `Full 23-step cycle: ${stepResults.filter(s => s.status === 'success').length} steps succeeded`,
    }).eq('id', 'singleton');

    const appliedCount = grokResult?.blocks.filter(b => b.status === 'applied').length || 0;
    await supabase.from('evolution_journal').insert([{
      event_type: 'full-cycle',
      title: `🔄 Full Evolution Cycle: L${newLevel}, ${appliedCount} files, ${stepResults.filter(s => s.status === 'success').length}/23 steps`,
      description: stepResults.map(s => `[${s.status === 'success' ? '✓' : s.status === 'error' ? '✗' : '—'}] ${s.label}: ${s.detail.slice(0, 80)}`).join('\n'),
      metadata: {
        steps_succeeded: stepResults.filter(s => s.status === 'success').length,
        steps_failed: stepResults.filter(s => s.status === 'error').length,
        steps_skipped: stepResults.filter(s => s.status === 'skipped').length,
        files_applied: appliedCount,
        new_capabilities: newCaps,
        value_score: valueScore,
        life_score: lifeScore,
        duration_ms: Math.round(performance.now() - cycleStart),
      } as Record<string, unknown>,
    }]);

    return `Dashboard updated — L${newLevel}, ${newCaps.length} new capabilities, ${appliedCount} files applied`;
  });

  // Step 22: Cooling
  await runStep(22, async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return `Cycle complete. Total time: ${Math.round((performance.now() - cycleStart) / 1000)}s. ${stepResults.filter(s => s.status === 'success').length}/23 steps succeeded.`;
  });

  const totalHealth = state.capabilities.length > 0 ? Math.round((verifiedCount / Math.max(state.capabilities.length, 1)) * 100) : 100;

  autonomyReport = {
    valueScore,
    lifeScore,
    systemHealth: totalHealth,
    anomaliesFound,
    patternsFound,
    forecastedCapabilities: forecastedCaps,
    repairsAttempted,
    repairsSucceeded,
  };

  const fallbackResult: EvolutionCycleResult = {
    fullResponse: '',
    blocks: [],
    planSaved: false,
    capabilitiesRegistered: [],
    newLevel: state.evolutionLevel,
  };

  return {
    ...(grokResult || fallbackResult),
    stepResults,
    autonomyReport,
    totalDurationMs: performance.now() - cycleStart,
  };
}
