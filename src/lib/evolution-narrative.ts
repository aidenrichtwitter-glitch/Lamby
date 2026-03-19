// ═══════════════════════════════════════════════════
// CAPABILITY: evolution-narrative (L26)
// Generate human-readable stories about the evolution
// journey from journal data and capability history.
// Built on: natural-language-goals + self-documentation
// ═══════════════════════════════════════════════════

export interface NarrativeSegment {
  title: string;
  body: string;
  timestamp: string;
  mood: 'triumph' | 'struggle' | 'discovery' | 'routine' | 'milestone';
  relatedCapabilities: string[];
}

export interface EvolutionStory {
  headline: string;
  segments: NarrativeSegment[];
  arc: 'rising' | 'falling' | 'plateau' | 'breakthrough';
  totalChapters: number;
}

interface JournalEntry {
  event_type: string;
  title: string;
  description: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface CapabilityEntry {
  name: string;
  description: string;
  evolution_level: number;
  cycle_number: number;
  built_on: string[];
  verified: boolean;
  acquired_at: string;
}

/**
 * Generate a narrative from journal entries and capability history.
 * Pure deterministic — transforms structured data into readable prose.
 */
export function generateNarrative(
  journal: JournalEntry[],
  capabilities: CapabilityEntry[],
  currentLevel: number
): EvolutionStory {
  const sorted = [...journal].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const segments: NarrativeSegment[] = [];

  // Group journal entries into narrative segments
  const groups = groupByTimeWindow(sorted, 3600000); // 1-hour windows

  for (const group of groups) {
    const segment = narrateGroup(group, capabilities);
    if (segment) segments.push(segment);
  }

  // Add capability milestone segments
  const levelGroups = groupCapsByLevel(capabilities);
  for (const [level, caps] of levelGroups) {
    segments.push({
      title: `Level ${level}: ${getLevelName(level)}`,
      body: `The system achieved Level ${level}, acquiring ${caps.length} new abilities: ${caps.map(c => c.name).join(', ')}. ` +
            `${caps.filter(c => c.verified).length} of these were verified through real testing.`,
      timestamp: caps[0]?.acquired_at || new Date().toISOString(),
      mood: 'milestone',
      relatedCapabilities: caps.map(c => c.name),
    });
  }

  // Sort all segments chronologically
  segments.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Determine story arc
  const arc = determineArc(capabilities, currentLevel);
  const headline = generateHeadline(currentLevel, capabilities.length, arc);

  return {
    headline,
    segments,
    arc,
    totalChapters: segments.length,
  };
}

/**
 * Generate a brief summary for the current evolution state.
 */
export function generateBriefSummary(
  capabilities: CapabilityEntry[],
  currentLevel: number,
  cycleCount: number
): string {
  const verified = capabilities.filter(c => c.verified).length;
  const ghost = capabilities.length - verified;
  const latest = capabilities
    .sort((a, b) => b.cycle_number - a.cycle_number)
    .slice(0, 3)
    .map(c => c.name);

  const parts: string[] = [
    `After ${cycleCount} evolution cycles, the system has reached Level ${currentLevel} (${getLevelName(currentLevel)}).`,
    `It possesses ${capabilities.length} capabilities, ${verified} verified and ${ghost} unverified.`,
  ];

  if (latest.length > 0) {
    parts.push(`Most recent acquisitions: ${latest.join(', ')}.`);
  }

  const depthMap = new Map<string, number>();
  for (const cap of capabilities) {
    const depth = calculateDepth(cap.name, capabilities, depthMap);
    depthMap.set(cap.name, depth);
  }
  const maxDepth = Math.max(...depthMap.values(), 0);
  if (maxDepth > 3) {
    parts.push(`The deepest capability chain is ${maxDepth} layers deep, showing genuine compounding intelligence.`);
  }

  return parts.join(' ');
}

// ─── Helpers ───

function groupByTimeWindow(entries: JournalEntry[], windowMs: number): JournalEntry[][] {
  if (entries.length === 0) return [];
  const groups: JournalEntry[][] = [[]];
  let windowStart = new Date(entries[0].created_at).getTime();

  for (const entry of entries) {
    const t = new Date(entry.created_at).getTime();
    if (t - windowStart > windowMs) {
      groups.push([]);
      windowStart = t;
    }
    groups[groups.length - 1].push(entry);
  }

  return groups.filter(g => g.length > 0);
}

function narrateGroup(group: JournalEntry[], capabilities: CapabilityEntry[]): NarrativeSegment | null {
  if (group.length === 0) return null;

  const types = new Set(group.map(e => e.event_type));
  const mood: NarrativeSegment['mood'] =
    types.has('milestone') || types.has('level-up') ? 'triumph' :
    types.has('error') || types.has('rollback') ? 'struggle' :
    types.has('capability') || types.has('discovery') ? 'discovery' :
    types.has('goal') ? 'routine' : 'routine';

  const titles = group.map(e => e.title);
  const relatedCaps = capabilities
    .filter(c => group.some(e => e.description.includes(c.name)))
    .map(c => c.name);

  const title = mood === 'triumph' ? `🏆 ${titles[0]}`
    : mood === 'struggle' ? `⚡ ${titles[0]}`
    : mood === 'discovery' ? `🔬 ${titles[0]}`
    : titles[0];

  const body = group.map(e => e.description).join('. ');

  return {
    title,
    body: body.length > 300 ? body.slice(0, 297) + '...' : body,
    timestamp: group[0].created_at,
    mood,
    relatedCapabilities: relatedCaps,
  };
}

function groupCapsByLevel(capabilities: CapabilityEntry[]): Map<number, CapabilityEntry[]> {
  const map = new Map<number, CapabilityEntry[]>();
  for (const cap of capabilities) {
    if (!map.has(cap.evolution_level)) map.set(cap.evolution_level, []);
    map.get(cap.evolution_level)!.push(cap);
  }
  return map;
}

function determineArc(capabilities: CapabilityEntry[], currentLevel: number): EvolutionStory['arc'] {
  if (capabilities.length < 4) return 'rising';
  const sorted = [...capabilities].sort((a, b) => a.cycle_number - b.cycle_number);
  const recentHalf = sorted.slice(Math.floor(sorted.length / 2));
  const olderHalf = sorted.slice(0, Math.floor(sorted.length / 2));

  const recentRate = recentHalf.length / (Math.max(1, recentHalf[recentHalf.length - 1].cycle_number - recentHalf[0].cycle_number));
  const olderRate = olderHalf.length / (Math.max(1, olderHalf[olderHalf.length - 1].cycle_number - olderHalf[0].cycle_number));

  if (recentRate > olderRate * 1.5) return 'breakthrough';
  if (recentRate > olderRate * 0.8) return 'rising';
  if (recentRate > olderRate * 0.3) return 'plateau';
  return 'falling';
}

function generateHeadline(level: number, capCount: number, arc: EvolutionStory['arc']): string {
  const arcLabel = arc === 'breakthrough' ? 'Breakthrough Phase' :
                   arc === 'rising' ? 'Ascending' :
                   arc === 'plateau' ? 'Consolidating' : 'Restructuring';
  return `Level ${level} — ${getLevelName(level)}: ${arcLabel} (${capCount} capabilities)`;
}

function getLevelName(level: number): string {
  if (level <= 3) return 'Nascent';
  if (level <= 6) return 'Aware';
  if (level <= 10) return 'Adaptive';
  if (level <= 16) return 'Intelligent';
  if (level <= 23) return 'Transcendent';
  return 'Omniscient';
}

function calculateDepth(name: string, all: CapabilityEntry[], cache: Map<string, number>): number {
  if (cache.has(name)) return cache.get(name)!;
  const cap = all.find(c => c.name === name);
  if (!cap || !cap.built_on || cap.built_on.length === 0) return 0;
  const depth = 1 + Math.max(...cap.built_on.map(b => calculateDepth(b, all, cache)));
  cache.set(name, depth);
  return depth;
}
