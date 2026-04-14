// AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
// Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
// Read docs/no-reply-system.md for the no-reply protocol.
import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BubbleTarget {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  popped: boolean;
}

interface CalibrationPoint {
  expectedX: number;
  expectedY: number;
  actualX: number;
  actualY: number;
  offsetX: number;
  offsetY: number;
  size: number;
  timestamp: number;
}

interface CalibrationResult {
  points: CalibrationPoint[];
  avgOffsetX: number;
  avgOffsetY: number;
  maxOffsetX: number;
  maxOffsetY: number;
  accuracy: number;
  screenWidth: number;
  screenHeight: number;
  gridMap: Record<string, { offsetX: number; offsetY: number; samples: number }>;
  timestamp: string;
}

const NEON_COLORS = [
  "#ff00ff", "#00ffff", "#ff3399", "#33ff99", "#ffff00",
  "#ff6600", "#6633ff", "#00ff66", "#ff0066", "#66ffcc",
  "#cc33ff", "#33ccff", "#ff9933", "#99ff33", "#ff3366",
];

const PHASES = [
  { name: "Phase 1: Big Targets", size: 80, count: 9, gridCols: 3, gridRows: 3 },
  { name: "Phase 2: Medium Targets", size: 50, count: 16, gridCols: 4, gridRows: 4 },
  { name: "Phase 3: Small Targets", size: 30, count: 25, gridCols: 5, gridRows: 5 },
  { name: "Phase 4: Tiny Targets", size: 18, count: 36, gridCols: 6, gridRows: 6 },
  { name: "Phase 5: Precision", size: 12, count: 49, gridCols: 7, gridRows: 7 },
];

function generateBubbles(phaseIndex: number, screenW: number, screenH: number): BubbleTarget[] {
  const phase = PHASES[phaseIndex];
  const bubbles: BubbleTarget[] = [];
  const padX = phase.size + 40;
  const padY = phase.size + 40;
  const usableW = screenW - padX * 2;
  const usableH = screenH - padY * 2;

  for (let row = 0; row < phase.gridRows; row++) {
    for (let col = 0; col < phase.gridCols; col++) {
      const x = padX + (usableW / (phase.gridCols - 1 || 1)) * col;
      const y = padY + (usableH / (phase.gridRows - 1 || 1)) * row;
      bubbles.push({
        id: row * phase.gridCols + col,
        x: Math.round(x),
        y: Math.round(y),
        size: phase.size,
        color: NEON_COLORS[(row * phase.gridCols + col) % NEON_COLORS.length],
        popped: false,
      });
    }
  }
  return bubbles;
}

function computeCalibration(points: CalibrationPoint[], screenW: number, screenH: number): CalibrationResult {
  const avgOffsetX = points.reduce((s, p) => s + p.offsetX, 0) / points.length;
  const avgOffsetY = points.reduce((s, p) => s + p.offsetY, 0) / points.length;
  const maxOffsetX = Math.max(...points.map(p => Math.abs(p.offsetX)));
  const maxOffsetY = Math.max(...points.map(p => Math.abs(p.offsetY)));
  const avgDist = points.reduce((s, p) => s + Math.sqrt(p.offsetX ** 2 + p.offsetY ** 2), 0) / points.length;
  const maxPossibleDist = Math.sqrt(screenW ** 2 + screenH ** 2);
  const accuracy = Math.max(0, 100 - (avgDist / maxPossibleDist) * 100 * 50);

  const GRID_CELLS = 8;
  const gridMap: Record<string, { offsetX: number; offsetY: number; samples: number }> = {};
  for (const p of points) {
    const gx = Math.min(GRID_CELLS - 1, Math.floor((p.expectedX / screenW) * GRID_CELLS));
    const gy = Math.min(GRID_CELLS - 1, Math.floor((p.expectedY / screenH) * GRID_CELLS));
    const key = `${gx},${gy}`;
    if (!gridMap[key]) gridMap[key] = { offsetX: 0, offsetY: 0, samples: 0 };
    gridMap[key].offsetX += p.offsetX;
    gridMap[key].offsetY += p.offsetY;
    gridMap[key].samples += 1;
  }
  for (const key of Object.keys(gridMap)) {
    gridMap[key].offsetX /= gridMap[key].samples;
    gridMap[key].offsetY /= gridMap[key].samples;
  }

  return {
    points,
    avgOffsetX,
    avgOffsetY,
    maxOffsetX,
    maxOffsetY,
    accuracy,
    screenWidth: screenW,
    screenHeight: screenH,
    gridMap,
    timestamp: new Date().toISOString(),
  };
}

function PopParticles({ x, y, color }: { x: number; y: number; color: string }) {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const dist = 30 + Math.random() * 50;
    return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, size: 3 + Math.random() * 5 };
  });

  return (
    <>
      {particles.map((p, i) => (
        <motion.div
          key={i}
          initial={{ x: x - p.size / 2, y: y - p.size / 2, opacity: 1, scale: 1 }}
          animate={{ x: x + p.dx, y: y + p.dy, opacity: 0, scale: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            position: "fixed",
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
            pointerEvents: "none",
            zIndex: 9999,
          }}
        />
      ))}
    </>
  );
}

export default function Calibration() {
  const [phase, setPhase] = useState(-1);
  const [bubbles, setBubbles] = useState<BubbleTarget[]>([]);
  const [allPoints, setAllPoints] = useState<CalibrationPoint[]>([]);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [missClicks, setMissClicks] = useState(0);
  const particleId = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const startPhase = useCallback((idx: number) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    setPhase(idx);
    setBubbles(generateBubbles(idx, w, h));
  }, []);

  const handleBubbleClick = useCallback((bubble: BubbleTarget, e: React.MouseEvent) => {
    e.stopPropagation();
    if (bubble.popped) return;

    const point: CalibrationPoint = {
      expectedX: bubble.x,
      expectedY: bubble.y,
      actualX: e.clientX,
      actualY: e.clientY,
      offsetX: e.clientX - bubble.x,
      offsetY: e.clientY - bubble.y,
      size: bubble.size,
      timestamp: Date.now(),
    };

    setAllPoints(prev => [...prev, point]);
    setBubbles(prev => prev.map(b => b.id === bubble.id ? { ...b, popped: true } : b));

    const pid = particleId.current++;
    setParticles(prev => [...prev, { id: pid, x: e.clientX, y: e.clientY, color: bubble.color }]);
    setTimeout(() => setParticles(prev => prev.filter(p => p.id !== pid)), 600);
  }, []);

  const handleMiss = useCallback((e: React.MouseEvent) => {
    if (phase < 0 || result) return;
    setMissClicks(prev => prev + 1);
    const pid = particleId.current++;
    setParticles(prev => [...prev, { id: pid, x: e.clientX, y: e.clientY, color: "#ff0000" }]);
    setTimeout(() => setParticles(prev => prev.filter(p => p.id !== pid)), 600);
  }, [phase, result]);

  useEffect(() => {
    if (phase < 0) return;
    const allPopped = bubbles.length > 0 && bubbles.every(b => b.popped);
    if (!allPopped) return;

    const timer = setTimeout(() => {
      if (phase < PHASES.length - 1) {
        startPhase(phase + 1);
      } else {
        const cal = computeCalibration(allPoints, window.innerWidth, window.innerHeight);
        setResult(cal);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [bubbles, phase, allPoints, startPhase]);

  const saveCalibration = useCallback(async () => {
    if (!result) return;
    setSaving(true);
    try {
      await fetch("/api/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });

      const tunnelBase = (window as any).__TUNNEL_URL ||
        new URLSearchParams(window.location.search).get("tunnel") || "";

      if (tunnelBase) {
        try {
          await fetch(`${tunnelBase}/api/grok-memory?action=crystallize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "control:calibration",
              domain: "control",
              steps: [{ description: "Apply calibration offsets before every click. Look up the grid cell for the target coordinate and subtract the offset." }],
              metadata: {
                avgOffsetX: result.avgOffsetX,
                avgOffsetY: result.avgOffsetY,
                accuracy: result.accuracy,
                gridMap: result.gridMap,
                screenWidth: result.screenWidth,
                screenHeight: result.screenHeight,
                timestamp: result.timestamp,
                totalPoints: result.points.length,
              },
            }),
          });
        } catch {}
      }

      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `calibration-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);

      setSaved(true);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [result]);

  const reset = useCallback(() => {
    setPhase(-1);
    setBubbles([]);
    setAllPoints([]);
    setResult(null);
    setSaved(false);
    setMissClicks(0);
  }, []);

  if (phase === -1 && !result) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#fff", zIndex: 9000,
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: "center", maxWidth: 600, padding: 40 }}
        >
          <h1 style={{
            fontSize: 48, fontWeight: 800, marginBottom: 8,
            background: "linear-gradient(90deg, #ff00ff, #00ffff, #ffff00)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Click Calibration
          </h1>
          <p style={{ fontSize: 18, color: "#aaa", marginBottom: 32, lineHeight: 1.6 }}>
            Pop the bubbles as accurately as possible. They get smaller each round.
            Your click offsets are mapped into a calibration grid for pixel-perfect accuracy forever.
          </p>

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
            marginBottom: 32, fontSize: 13, color: "#888",
          }}>
            {PHASES.map((p, i) => (
              <div key={i} style={{
                padding: "12px 8px", borderRadius: 8,
                border: "1px solid #333", background: "rgba(255,255,255,0.03)",
              }}>
                <div style={{ color: NEON_COLORS[i], fontWeight: 700, marginBottom: 4 }}>
                  Round {i + 1}
                </div>
                <div>{p.count} targets</div>
                <div>{p.size}px diameter</div>
              </div>
            ))}
          </div>

          <motion.button
            data-testid="button-start-calibration"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => startPhase(0)}
            style={{
              padding: "16px 48px", fontSize: 20, fontWeight: 700,
              border: "2px solid #00ffff", borderRadius: 12,
              background: "linear-gradient(135deg, rgba(0,255,255,0.15), rgba(255,0,255,0.15))",
              color: "#00ffff", cursor: "pointer",
              boxShadow: "0 0 30px rgba(0,255,255,0.3)",
            }}
          >
            Start Calibration
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (result) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif",
          color: "#fff", zIndex: 9000, overflow: "auto",
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ textAlign: "center", maxWidth: 700, padding: 40 }}
        >
          <h1 style={{
            fontSize: 42, fontWeight: 800, marginBottom: 8,
            background: result.accuracy >= 95
              ? "linear-gradient(90deg, #33ff99, #00ffff)"
              : result.accuracy >= 80
                ? "linear-gradient(90deg, #ffff00, #ff9933)"
                : "linear-gradient(90deg, #ff3366, #ff6600)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            {result.accuracy >= 95 ? "Perfect!" : result.accuracy >= 80 ? "Good!" : "Calibrated"}
          </h1>

          <div style={{
            fontSize: 72, fontWeight: 900, marginBottom: 24,
            color: result.accuracy >= 95 ? "#33ff99" : result.accuracy >= 80 ? "#ffff00" : "#ff6600",
            textShadow: `0 0 40px ${result.accuracy >= 95 ? "#33ff99" : "#ffff00"}`,
          }}>
            {result.accuracy.toFixed(1)}%
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16,
            marginBottom: 24, fontSize: 14,
          }}>
            <div style={{ padding: 16, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid #333" }}>
              <div style={{ color: "#888", marginBottom: 4 }}>Avg Offset</div>
              <div style={{ color: "#00ffff", fontSize: 18, fontWeight: 700 }}>
                {result.avgOffsetX.toFixed(1)}px, {result.avgOffsetY.toFixed(1)}px
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid #333" }}>
              <div style={{ color: "#888", marginBottom: 4 }}>Max Offset</div>
              <div style={{ color: "#ff9933", fontSize: 18, fontWeight: 700 }}>
                {result.maxOffsetX.toFixed(1)}px, {result.maxOffsetY.toFixed(1)}px
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid #333" }}>
              <div style={{ color: "#888", marginBottom: 4 }}>Points / Misses</div>
              <div style={{ color: "#ff00ff", fontSize: 18, fontWeight: 700 }}>
                {result.points.length} / {missClicks}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>Grid Offset Map (8x8)</div>
            <div style={{
              display: "inline-grid", gridTemplateColumns: "repeat(8, 32px)",
              gap: 2, background: "#111", padding: 8, borderRadius: 8,
            }}>
              {Array.from({ length: 64 }, (_, i) => {
                const gx = i % 8;
                const gy = Math.floor(i / 8);
                const cell = result.gridMap[`${gx},${gy}`];
                const intensity = cell
                  ? Math.min(255, Math.round(Math.sqrt(cell.offsetX ** 2 + cell.offsetY ** 2) * 8))
                  : 0;
                return (
                  <div
                    key={i}
                    title={cell ? `(${cell.offsetX.toFixed(1)}, ${cell.offsetY.toFixed(1)}) n=${cell.samples}` : "no data"}
                    style={{
                      width: 32, height: 32, borderRadius: 4,
                      backgroundColor: cell
                        ? `rgba(${intensity}, ${255 - intensity}, 255, 0.6)`
                        : "rgba(255,255,255,0.03)",
                      border: "1px solid #222",
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <motion.button
              data-testid="button-save-calibration"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={saveCalibration}
              disabled={saving || saved}
              style={{
                padding: "14px 36px", fontSize: 16, fontWeight: 700,
                border: `2px solid ${saved ? "#33ff99" : "#00ffff"}`,
                borderRadius: 10,
                background: saved
                  ? "rgba(51,255,153,0.15)"
                  : "linear-gradient(135deg, rgba(0,255,255,0.15), rgba(255,0,255,0.15))",
                color: saved ? "#33ff99" : "#00ffff",
                cursor: saving || saved ? "default" : "pointer",
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saved ? "Saved & Crystallized ✓" : saving ? "Saving..." : "Save & Crystallize"}
            </motion.button>
            <motion.button
              data-testid="button-recalibrate"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={reset}
              style={{
                padding: "14px 36px", fontSize: 16, fontWeight: 700,
                border: "2px solid #666", borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                color: "#aaa", cursor: "pointer",
              }}
            >
              Recalibrate
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentPhase = PHASES[phase];
  const popped = bubbles.filter(b => b.popped).length;
  const total = bubbles.length;
  const progress = total > 0 ? (popped / total) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onClick={handleMiss}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.92)",
        cursor: "crosshair", zIndex: 9000,
      }}
    >
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0,
        padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.8)", borderBottom: "1px solid #333",
        zIndex: 9999, fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        <div style={{ color: NEON_COLORS[phase], fontWeight: 700, fontSize: 16 }}>
          {currentPhase.name}
        </div>
        <div style={{
          flex: 1, maxWidth: 300, height: 6, margin: "0 24px",
          background: "#222", borderRadius: 3, overflow: "hidden",
        }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            style={{
              height: "100%", borderRadius: 3,
              background: `linear-gradient(90deg, ${NEON_COLORS[phase]}, ${NEON_COLORS[(phase + 1) % NEON_COLORS.length]})`,
            }}
          />
        </div>
        <div style={{ color: "#888", fontSize: 14, fontFamily: "monospace" }}>
          {popped}/{total} · {currentPhase.size}px · misses: {missClicks}
        </div>
      </div>

      <AnimatePresence>
        {bubbles.filter(b => !b.popped).map(bubble => (
          <motion.div
            key={`${phase}-${bubble.id}`}
            data-testid={`bubble-target-${bubble.id}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 2.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            onClick={(e) => handleBubbleClick(bubble, e)}
            style={{
              position: "fixed",
              left: bubble.x - bubble.size / 2,
              top: bubble.y - bubble.size / 2,
              width: bubble.size,
              height: bubble.size,
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, ${bubble.color}cc, ${bubble.color}44)`,
              border: `2px solid ${bubble.color}`,
              boxShadow: `0 0 ${bubble.size / 2}px ${bubble.color}66, inset 0 0 ${bubble.size / 3}px ${bubble.color}33`,
              cursor: "pointer",
              zIndex: 9500,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div style={{
              width: bubble.size * 0.2,
              height: bubble.size * 0.2,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.6)",
            }} />
          </motion.div>
        ))}
      </AnimatePresence>

      {particles.map(p => (
        <PopParticles key={p.id} x={p.x} y={p.y} color={p.color} />
      ))}
    </div>
  );
}
