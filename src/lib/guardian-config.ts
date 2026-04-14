// AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
// Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
// Read docs/no-reply-system.md for the no-reply protocol.
const GUARDIAN_ORG = 'guardian-ai-builds';

const GUARDIAN_SHARED_PAT_KEY = 'guardian-shared-pat';
const GUARDIAN_USER_PAT_KEY = 'guardian-user-pat';

export interface GuardianConfig {
  orgName: string;
  sharedPat: string;
  userPat: string | null;
}

export function getGuardianConfig(): GuardianConfig {
  const sharedPat = localStorage.getItem(GUARDIAN_SHARED_PAT_KEY) || '';
  const userPat = localStorage.getItem(GUARDIAN_USER_PAT_KEY) || null;
  return {
    orgName: GUARDIAN_ORG,
    sharedPat,
    userPat,
  };
}

export function setSharedPat(pat: string): void {
  localStorage.setItem(GUARDIAN_SHARED_PAT_KEY, pat);
}

export function setUserPat(pat: string | null): void {
  if (pat) {
    localStorage.setItem(GUARDIAN_USER_PAT_KEY, pat);
  } else {
    localStorage.removeItem(GUARDIAN_USER_PAT_KEY);
  }
}

export function getEffectivePat(config: GuardianConfig): string {
  return config.userPat || config.sharedPat;
}

export function hasPublishCredentials(config: GuardianConfig): boolean {
  return !!(config.sharedPat || config.userPat);
}
