import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Activity, Brain, Shield, TrendingUp, Network } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { mean, std } from 'mathjs';

interface CapabilityNode {
  name: string;
  description: string;
  builtOn: string[];
  cycle: number;
  level: number;
  x: number;
  y: number;
}

interface EvolutionStats {
  currentLevel: number;
  totalCapabilities: number;
  totalCycles: number;
  totalGoalsCompleted: number;
  activeGoals: number;
  avgCyclesPerCapability: number;
  healthScore: number;
}

const EVOLUTION_TITLES: Record<number, string> = {
  1: 'Nascent', 2: 'Aware', 3: 'Adaptive', 4: 'Intelligent',
  5: 'Transcendent', 6: 'Omniscient', 7: 'Architect', 8: 'Sovereign',
  9: 'Metamorphic', 10: 'Singularity',
};

function layoutGraph(capabilities: CapabilityNode[]): CapabilityNode[] {
  if (capabilities.length === 0) return [];
  
  // Group by level
  const levels = new Map<number, CapabilityNode[]>();
  capabilities.forEach(cap => {
    const lvl = cap.level;
    if (!levels.has(lvl)) levels.set(lvl, []);
    levels.get(lvl)!.push(cap);
  });

  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  const result: CapabilityNode[] = [];

  sortedLevels.forEach((lvl, li) => {
    const nodes = levels.get(lvl)!;
    const y = 80 + li * 120;
    nodes.forEach((node, ni) => {
      const totalWidth = nodes.length * 160;
      const startX = (800 - totalWidth) / 2;
      result.push({ ...node, x: startX + ni * 160 + 80, y });
    });
  });

  return result;
}

const Evolution: React.FC = () => {
  const [capabilities, setCapabilities] = useState<CapabilityNode[]>([]);
  const [stats, setStats] = useState<EvolutionStats | null>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    // Fetch capabilities
    supabase.from('capabilities').select('*').order('cycle_number', { ascending: true }).then(({ data }) => {
      if (data) {
        const nodes: CapabilityNode[] = data.map(row => ({
          name: row.name,
          description: row.description,
          builtOn: row.built_on || [],
          cycle: row.cycle_number,
          level: row.evolution_level,
          x: 0, y: 0,
        }));
        setCapabilities(layoutGraph(nodes));
      }
    });

    // Fetch evolution state
    supabase.from('evolution_state').select('*').eq('id', 'singleton').single().then(({ data }) => {
      if (data) {
        // Fetch goals for stats
        supabase.from('goals').select('status').then(({ data: goalsData }) => {
          const completed = goalsData?.filter(g => g.status === 'completed').length || 0;
          const active = goalsData?.filter(g => g.status === 'active' || g.status === 'in-progress').length || 0;

          supabase.from('capabilities').select('cycle_number').then(({ data: capData }) => {
            const cycles = capData?.map(c => c.cycle_number) || [];
            const avgCycles = cycles.length > 1 ? Number(mean(cycles)) : 0;
            const stdDev = cycles.length > 2 ? Number(std(cycles)) : 0;
            // Health = inverse of stdDev normalized (lower variance = healthier)
            const healthScore = Math.max(0, Math.min(100, 100 - stdDev * 5));

            setStats({
              currentLevel: data.evolution_level,
              totalCapabilities: capData?.length || 0,
              totalCycles: data.cycle_count,
              totalGoalsCompleted: completed,
              activeGoals: active,
              avgCyclesPerCapability: Math.round(avgCycles * 10) / 10,
              healthScore: Math.round(healthScore),
            });
          });
        });
      }
    });

    // Fetch memory palace snapshots
    supabase.from('lambda_evolution_state').select('*').order('created_at', { ascending: false }).limit(10).then(({ data }) => {
      if (data) setSnapshots(data);
    });
  }, []);

  const layoutNodes = useMemo(() => capabilities, [capabilities]);

  const edges = useMemo(() => {
    const result: { from: CapabilityNode; to: CapabilityNode }[] = [];
    layoutNodes.forEach(node => {
      node.builtOn.forEach(parentName => {
        const parent = layoutNodes.find(n => n.name === parentName);
        if (parent) result.push({ from: parent, to: node });
      });
    });
    return result;
  }, [layoutNodes]);

  const selectedCap = selectedNode ? layoutNodes.find(n => n.name === selectedNode) : null;

  const title = stats ? (EVOLUTION_TITLES[stats.currentLevel] || `Level ${stats.currentLevel}`) : 'Loading...';

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Network className="w-4 h-4 text-primary text-glow" />
          <h1 className="text-sm font-display font-bold text-foreground">
            <span className="text-primary text-glow">λ</span> Evolution Dashboard
          </h1>
          {stats && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" />
              {title} · {stats.totalCapabilities} abilities
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main: Capability Graph */}
        <main className="flex-1 relative overflow-auto bg-background">
          <svg width="800" height={Math.max(600, (layoutNodes.length / 3) * 140 + 200)} className="w-full" viewBox={`0 0 800 ${Math.max(600, (layoutNodes.length / 3) * 140 + 200)}`}>
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(140 30% 20% / 0.15)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Edges */}
            {edges.map((edge, i) => (
              <motion.line
                key={`edge-${i}`}
                x1={edge.from.x}
                y1={edge.from.y}
                x2={edge.to.x}
                y2={edge.to.y}
                stroke="hsl(140 70% 45% / 0.3)"
                strokeWidth="1.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: i * 0.05 }}
              />
            ))}

            {/* Nodes */}
            {layoutNodes.map((node, i) => {
              const isSelected = selectedNode === node.name;
              return (
                <g key={node.name} onClick={() => setSelectedNode(isSelected ? null : node.name)} className="cursor-pointer">
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={isSelected ? 22 : 16}
                    fill={isSelected ? 'hsl(140 70% 45% / 0.3)' : 'hsl(220 18% 10%)'}
                    stroke={isSelected ? 'hsl(140 70% 45%)' : 'hsl(140 30% 20%)'}
                    strokeWidth={isSelected ? 2 : 1}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: i * 0.03 }}
                  />
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={4}
                    fill="hsl(140 70% 45%)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 + 0.2 }}
                  />
                  <text
                    x={node.x}
                    y={node.y + 30}
                    textAnchor="middle"
                    fill="hsl(140 60% 75%)"
                    fontSize="8"
                    fontFamily="JetBrains Mono, monospace"
                    className="pointer-events-none"
                  >
                    {node.name.length > 20 ? node.name.substring(0, 18) + '…' : node.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Selected node detail overlay */}
          <AnimatePresence>
            {selectedCap && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-4 left-4 right-4 bg-card border border-border rounded-lg p-4 shadow-xl"
              >
                <h3 className="text-sm font-bold text-primary text-glow font-display">{selectedCap.name}</h3>
                <p className="text-[11px] text-foreground/80 mt-1">{selectedCap.description}</p>
                <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground">
                  <span>Cycle {selectedCap.cycle}</span>
                  <span>Level {selectedCap.level}</span>
                  {selectedCap.builtOn.length > 0 && (
                    <span className="text-primary/60">Built on: {selectedCap.builtOn.join(' + ')}</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Stats Sidebar */}
        <aside className="w-72 border-l border-border bg-card/30 flex flex-col shrink-0 overflow-auto">
          {stats ? (
            <div className="p-4 space-y-4">
              {/* Current Level */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wider font-display">{title}</span>
                </div>
                <div className="text-3xl font-bold text-foreground font-display">Level {stats.currentLevel}</div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Capabilities', value: stats.totalCapabilities, icon: Brain },
                  { label: 'Cycles', value: stats.totalCycles, icon: Activity },
                  { label: 'Goals Done', value: stats.totalGoalsCompleted, icon: Shield },
                  { label: 'Active Goals', value: stats.activeGoals, icon: TrendingUp },
                ].map(stat => (
                  <div key={stat.label} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                    <stat.icon className="w-3 h-3 text-primary/60 mb-1" />
                    <div className="text-lg font-bold text-foreground">{stat.value}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* System Health Gauge */}
              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">System Health</div>
                <div className="relative h-3 rounded-full bg-muted/30 overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background: stats.healthScore > 70 
                        ? 'linear-gradient(90deg, hsl(140 70% 45%), hsl(175 70% 40%))' 
                        : stats.healthScore > 40 
                        ? 'linear-gradient(90deg, hsl(40 90% 55%), hsl(140 70% 45%))' 
                        : 'linear-gradient(90deg, hsl(0 70% 50%), hsl(40 90% 55%))',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.healthScore}%` }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>{stats.healthScore}%</span>
                  <span>Avg {stats.avgCyclesPerCapability} cycles/cap</span>
                </div>
              </div>

              {/* Memory Palace Snapshots */}
              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Brain className="w-3 h-3" /> Memory Palace
                </div>
                {snapshots.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/50 py-2">No snapshots yet — the palace awaits.</div>
                ) : (
                  snapshots.map(snap => (
                    <div key={snap.id} className="bg-muted/20 rounded p-2 border border-border/30">
                      <div className="text-[10px] text-foreground/80 font-semibold">{snap.label || `Snapshot L${snap.evolution_level}`}</div>
                      <div className="text-[8px] text-muted-foreground mt-0.5">
                        Level {snap.evolution_level} · Cycle {snap.cycle_number} · {new Date(snap.created_at).toLocaleString()}
                      </div>
                      {snap.merkle_root && (
                        <div className="text-[7px] text-primary/40 mt-0.5 font-mono truncate">
                          Merkle: {snap.merkle_root}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground animate-pulse">Loading evolution data...</div>
            </div>
          )}
        </aside>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-4 py-1 border-t border-border bg-card/30 text-[10px] text-muted-foreground/50 shrink-0">
        <span>λ Evolution Dashboard — Capability Dependency Graph</span>
        <span>{capabilities.length} nodes · {edges.length} edges</span>
      </footer>
    </div>
  );
};

export default Evolution;
