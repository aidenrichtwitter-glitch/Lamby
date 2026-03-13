import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export type TrackingMode = 'mouse' | 'head';

interface ParallaxState {
  enabled: boolean;
  trackingMode: TrackingMode;
  headX: number;
  headY: number;
  targetX: number;
  targetY: number;
  faceDetected: boolean;
  cameraActive: boolean;
  statusText: string;
}

interface ParallaxContextValue extends ParallaxState {
  setEnabled: (v: boolean) => void;
  setTrackingMode: (m: TrackingMode) => void;
  updateTarget: (x: number, y: number) => void;
  setFaceDetected: (v: boolean) => void;
  setCameraActive: (v: boolean) => void;
  setStatusText: (s: string) => void;
  lerpRef: React.MutableRefObject<{ headX: number; headY: number }>;
  targetRef: React.MutableRefObject<{ x: number; y: number }>;
}

const ParallaxContext = createContext<ParallaxContextValue | null>(null);

const LS_KEY_ENABLED = 'parallax-enabled';
const LS_KEY_MODE = 'parallax-tracking-mode';

export function ParallaxProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledRaw] = useState(() => {
    try { return localStorage.getItem(LS_KEY_ENABLED) === 'true'; } catch { return false; }
  });
  const [trackingMode, setTrackingModeRaw] = useState<TrackingMode>(() => {
    try { return (localStorage.getItem(LS_KEY_MODE) as TrackingMode) || 'mouse'; } catch { return 'mouse'; }
  });
  const [targetX, setTargetX] = useState(0);
  const [targetY, setTargetY] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [statusText, setStatusText] = useState('Mode: Mouse');

  const lerpRef = useRef({ headX: 0, headY: 0 });
  const targetRef = useRef({ x: 0, y: 0 });

  const setEnabled = useCallback((v: boolean) => {
    setEnabledRaw(v);
    try { localStorage.setItem(LS_KEY_ENABLED, String(v)); } catch {}
    if (!v) {
      lerpRef.current = { headX: 0, headY: 0 };
      targetRef.current = { x: 0, y: 0 };
      setTargetX(0);
      setTargetY(0);
    }
  }, []);

  const setTrackingMode = useCallback((m: TrackingMode) => {
    setTrackingModeRaw(m);
    try { localStorage.setItem(LS_KEY_MODE, m); } catch {}
  }, []);

  const updateTarget = useCallback((x: number, y: number) => {
    targetRef.current = { x, y };
    setTargetX(x);
    setTargetY(y);
  }, []);

  return (
    <ParallaxContext.Provider value={{
      enabled,
      trackingMode,
      headX: lerpRef.current.headX,
      headY: lerpRef.current.headY,
      targetX,
      targetY,
      faceDetected,
      cameraActive,
      statusText,
      setEnabled,
      setTrackingMode,
      updateTarget,
      setFaceDetected,
      setCameraActive,
      setStatusText,
      lerpRef,
      targetRef,
    }}>
      {children}
    </ParallaxContext.Provider>
  );
}

export function useParallax() {
  const ctx = useContext(ParallaxContext);
  if (!ctx) throw new Error('useParallax must be used within ParallaxProvider');
  return ctx;
}
