// ═══════════════════════════════════════════════════
// ARTIFACT VAULT — File storage for generated artifacts.
// The system can save code, JSON, and markdown to
// persistent storage accessible across sessions.
// ═══════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

export interface ArtifactFile {
  name: string;
  id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export async function uploadArtifact(path: string, content: string, contentType = 'text/plain'): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('manage-artifact', {
      body: { action: 'upload', path, content, contentType },
    });
    return !error;
  } catch {
    return false;
  }
}

export async function listArtifacts(folder = ''): Promise<ArtifactFile[]> {
  try {
    const { data, error } = await supabase.functions.invoke('manage-artifact', {
      body: { action: 'list', path: folder },
    });
    if (error) return [];
    return data?.files || [];
  } catch {
    return [];
  }
}

export async function readArtifact(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('manage-artifact', {
      body: { action: 'read', path },
    });
    if (error) return null;
    return data?.content || null;
  } catch {
    return null;
  }
}

export async function deleteArtifact(path: string): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('manage-artifact', {
      body: { action: 'delete', path },
    });
    return !error;
  } catch {
    return false;
  }
}
