import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface StormProcess {
  id: string;
  label: string;
  source: string;
  target: string;
  type: 'rule' | 'ai' | 'test' | 'capability' | 'mutation';
  status: 'running' | 'success' | 'fail';
  reason?: string;
  timestamp: number;
}

// Global bus for storm events
const stormListeners: Set<(p: StormProcess) => void> = new Set();
export function emitStormProcess(p: Omit<StormProcess, 'id' | 'timestamp'>) {
  const event: StormProcess = {
    ...p,
    id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    timestamp: Date.now(),
  };
  stormListeners.forEach(fn => fn(event));
}

// Lightning bolt ASCII art frames
const BOLT_CHARS = ['╲', '│', '╱', '─', '⚡', '╳', '┃', '┆'];

interface Bolt {
  id: string;
  x: number;
  y: number;
  char: string;
  color: string;
  opacity: number;
  decay: number;
}

interface TraceNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  pulse: boolean;
  age: number;
}

const TYPE_COLORS: Record<StormProcess['type'], string> = {
  rule: 'hsl(var(--primary))',
  ai: 'hsl(var(--terminal-amber))',
  test: 'hsl(var(--terminal-cyan))',
  capability: 'hsl(140 70% 65%)',
  mutation: 'hsl(280 87% 65%)',
};

const STATUS_CHAR: Record<StormProcess['status'], string> = {
  running: '◌',
  success: '●',
  fail: '✗',
};

const TerminalStorm: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [processes, setProcesses] = useState<StormProcess[]>([]);
  const [bolts, setBolts] = useState<Bolt[]>([]);
  const [traceNodes, setTraceNodes] = useState<TraceNode[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const maxProcesses = 50;
  const maxBolts = 40;

  // Listen for storm events
  useEffect(() => {
    const handler = (p: StormProcess) => {
      setProcesses(prev => {
        const next = [...prev, p];
        if (next.length > maxProcesses) next.splice(0, next.length - maxProcesses);
        return next;
      });

      // Generate lightning bolts along the path
      const numBolts = p.status === 'fail' ? 6 : 3;
      const newBolts: Bolt[] = [];
      for (let i = 0; i < numBolts; i++) {
        newBolts.push({
          id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          x: 5 + Math.random() * 90,
          y: 10 + Math.random() * 80,
          char: BOLT_CHARS[Math.floor(Math.random() * BOLT_CHARS.length)],
          color: p.status === 'fail' ? 'hsl(var(--terminal-red))' : TYPE_COLORS[p.type],
          opacity: 0.8 + Math.random() * 0.2,
          decay: 800 + Math.random() * 1200,
        });
      }
      setBolts(prev => {
        const merged = [...prev, ...newBolts];
        if (merged.length > maxBolts) merged.splice(0, merged.length - maxBolts);
        return merged;
      });

      // Add trace node
      setTraceNodes(prev => {
        const node: TraceNode = {
          id: p.id,
          label: p.label.slice(0, 20),
          x: 10 + Math.random() * 80,
          y: 10 + Math.random() * 80,
          color: TYPE_COLORS[p.type],
          pulse: p.status === 'running',
          age: 0,
        };
        const next = [...prev, node].slice(-12);
        return next;
      });
    };

    stormListeners.add(handler);
    return () => { stormListeners.delete(handler); };
  }, []);

  // Decay bolts
  useEffect(() => {
    const interval = setInterval(() => {
      setBolts(prev => prev.filter(b => Date.now() - (b as any)._created < b.decay).length !== prev.length
        ? prev.filter(b => {
            if (!(b as any)._created) (b as any)._created = Date.now();
            return Date.now() - (b as any)._created < b.decay;
          })
        : prev
      );
      setTraceNodes(prev => prev.map(n => ({ ...n, age: n.age + 1 })).filter(n => n.age < 30));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Lightning connections between trace nodes
  const connections = useMemo(() => {
    const conns: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
    for (let i = 1; i < traceNodes.length; i++) {
      conns.push({
        x1: traceNodes[i - 1].x,
        y1: traceNodes[i - 1].y,
        x2: traceNodes[i].x,
        y2: traceNodes[i].y,
        color: traceNodes[i].color,
      });
    }
    return conns;
  }, [traceNodes]);

  const recentProcesses = processes.slice(-15);

  return (
    <div className={`relative overflow-hidden font-mono ${className}`}>
      {/* Storm canvas - ASCII lightning field */}
      <div ref={canvasRef} className="absolute inset-0 pointer-events-none">
        {/* SVG connections between nodes */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {connections.map((c, i) => (
            <motion.line
              key={`conn-${i}`}
              x1={c.x1} y1={c.y1}
              x2={c.x2} y2={c.y2}
              stroke={c.color}
              strokeWidth="0.3"
              strokeOpacity={0.4}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </svg>

        {/* Lightning bolts */}
        <AnimatePresence>
          {bolts.map(bolt => (
            <motion.span
              key={bolt.id}
              className="absolute text-[10px] pointer-events-none select-none"
              style={{
                left: `${bolt.x}%`,
                top: `${bolt.y}%`,
                color: bolt.color,
                textShadow: `0 0 6px ${bolt.color}`,
              }}
              initial={{ opacity: bolt.opacity, scale: 1.5 }}
              animate={{ opacity: 0, scale: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: bolt.decay / 1000 }}
            >
              {bolt.char}
            </motion.span>
          ))}
        </AnimatePresence>

        {/* Trace nodes */}
        <AnimatePresence>
          {traceNodes.map(node => (
            <motion.div
              key={node.id}
              className="absolute pointer-events-none"
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: Math.max(0.2, 1 - node.age / 30), scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: node.color,
                  boxShadow: node.pulse ? `0 0 8px ${node.color}` : 'none',
                }}
              />
              <span
                className="absolute top-3 left-1/2 -translate-x-1/2 text-[6px] whitespace-nowrap"
                style={{ color: node.color, opacity: 0.6 }}
              >
                {node.label}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Process log overlay - bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/90 to-transparent">
        <div className="px-2 py-1 space-y-px max-h-[40%] overflow-hidden">
          <AnimatePresence initial={false}>
            {recentProcesses.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[9px] leading-tight"
              >
                <span className="text-muted-foreground/30 shrink-0">
                  {new Date(p.timestamp).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span style={{ color: TYPE_COLORS[p.type] }} className="shrink-0">
                  {STATUS_CHAR[p.status]}
                </span>
                <span className="text-muted-foreground/50 shrink-0 uppercase text-[7px]">
                  [{p.type}]
                </span>
                <span style={{ color: p.status === 'fail' ? 'hsl(var(--terminal-red))' : TYPE_COLORS[p.type] }}>
                  {p.label}
                </span>
                {p.reason && (
                  <span className="text-muted-foreground/40 truncate">— {p.reason}</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Top-left: storm status */}
      <div className="absolute top-2 left-2 text-[8px] text-muted-foreground/50 space-y-0.5">
        <div className="flex items-center gap-1">
          <span className="text-primary">⚡</span>
          <span>STORM ACTIVE</span>
          <span className="text-primary animate-blink">█</span>
        </div>
        <div>{processes.length} processes traced</div>
        <div>{traceNodes.length} active nodes</div>
      </div>
    </div>
  );
};

export default TerminalStorm;
