// ═══════════════════════════════════════════════════
// MEMORY PALACE — Long-term state kernel persistence.
// Stores evolution snapshots with Merkle roots for
// immutable history verification.
// ═══════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

export interface EvolutionSnapshot {
  evolution_level: number;
  capabilities: string[];
  merkle_root?: string;
  state_blob: Record<string, unknown>;
  cycle_number: number;
  label?: string;
}

// Simple hash for merkle root generation
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `0x${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

export function computeMerkleRoot(capabilities: string[], level: number, cycle: number): string {
  const leaves = capabilities.map(c => simpleHash(c));
  const combined = leaves.join('') + `L${level}C${cycle}`;
  return simpleHash(combined);
}

export async function saveSnapshot(snapshot: EvolutionSnapshot): Promise<void> {
  try {
    const merkle = snapshot.merkle_root || computeMerkleRoot(snapshot.capabilities, snapshot.evolution_level, snapshot.cycle_number);
    await supabase.from('lambda_evolution_state').insert([{
      evolution_level: snapshot.evolution_level,
      capabilities: JSON.parse(JSON.stringify(snapshot.capabilities)),
      merkle_root: merkle,
      state_blob: JSON.parse(JSON.stringify(snapshot.state_blob)),
      cycle_number: snapshot.cycle_number,
      label: snapshot.label || `Snapshot L${snapshot.evolution_level}C${snapshot.cycle_number}`,
    }]);
  } catch {}
}

export async function loadLatestSnapshot(): Promise<EvolutionSnapshot | null> {
  try {
    const { data, error } = await supabase
      .from('lambda_evolution_state')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      evolution_level: data.evolution_level,
      capabilities: (data.capabilities as string[]) || [],
      merkle_root: data.merkle_root || undefined,
      state_blob: (data.state_blob as Record<string, unknown>) || {},
      cycle_number: data.cycle_number,
      label: data.label || undefined,
    };
  } catch {
    return null;
  }
}

export async function loadAllSnapshots(limit = 20): Promise<EvolutionSnapshot[]> {
  try {
    const { data, error } = await supabase
      .from('lambda_evolution_state')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map(row => ({
      evolution_level: row.evolution_level,
      capabilities: (row.capabilities as string[]) || [],
      merkle_root: row.merkle_root || undefined,
      state_blob: (row.state_blob as Record<string, unknown>) || {},
      cycle_number: row.cycle_number,
      label: row.label || undefined,
    }));
  } catch {
    return [];
  }
}
