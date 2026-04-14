// AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
// Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
// Read docs/no-reply-system.md for the no-reply protocol.
const INFRA_NOISE_PATTERNS = [
  'React Router Future Flag Warning',
  '[Lamby] Blank screen detected',
  '[vite] connecting',
  '[vite] connected',
  '[vite] server connection lost',
  '[vite] failed to connect to websocket',
  'Download the React DevTools',
  'createBrowserRouter is not defined',
];

export function isInfrastructureNoise(msg: string): boolean {
  return INFRA_NOISE_PATTERNS.some(p => msg.includes(p));
}
