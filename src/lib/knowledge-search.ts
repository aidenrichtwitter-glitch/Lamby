// ═══════════════════════════════════════════════════
// CAPABILITY: knowledge-search-engine
// The system's ability to search for and synthesize
// knowledge autonomously, feeding insights back into
// its evolution loop.
// ═══════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

export type SearchMode = 'knowledge' | 'technical' | 'strategy';

export interface SearchResult {
  success: boolean;
  query: string;
  mode: SearchMode;
  result: string;
  evolution_level: number;
  error?: string;
}

/**
 * Search for knowledge using the AI-powered search engine.
 * The system uses this to gather information autonomously.
 */
export async function searchKnowledge(
  query: string,
  mode: SearchMode = 'knowledge',
  context?: string
): Promise<SearchResult> {
  try {
    const { data, error } = await supabase.functions.invoke('knowledge-search', {
      body: { query, mode, context },
    });

    if (error) {
      return { success: false, query, mode, result: '', evolution_level: 0, error: error.message };
    }

    return data as SearchResult;
  } catch (err) {
    return {
      success: false,
      query,
      mode,
      result: '',
      evolution_level: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Batch search: run multiple queries in parallel
 */
export async function batchSearch(
  queries: { query: string; mode?: SearchMode; context?: string }[]
): Promise<SearchResult[]> {
  return Promise.all(
    queries.map(q => searchKnowledge(q.query, q.mode || 'knowledge', q.context))
  );
}
