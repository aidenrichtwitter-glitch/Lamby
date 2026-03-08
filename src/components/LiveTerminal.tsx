import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TerminalEvent {
  id: string;
  timestamp: number;
  source: string;
  type: 'emit' | 'state' | 'ai' | 'goal' | 'capability' | 'error';
  message: string;
}

// Global event bus for the terminal
const terminalListeners: Set<(event: TerminalEvent) => void> = new Set();

export function emitTerminalEvent(source: string, type: TerminalEvent['type'], message: string) {
  const event: TerminalEvent = {
    id: `te-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    source,
    type,
    message,
  };
  terminalListeners.forEach(fn => fn(event));
}

const TYPE_COLORS: Record<TerminalEvent['type'], string> = {
  emit: 'text-primary',
  state: 'text-accent',
  ai: 'text-[hsl(var(--terminal-amber))]',
  goal: 'text-[hsl(var(--terminal-cyan))]',
  capability: 'text-primary',
  error: 'text-destructive',
};

const TYPE_PREFIXES: Record<TerminalEvent['type'], string> = {
  emit: '⚡',
  state: '◆',
  ai: '🤖',
  goal: '🎯',
  capability: '⚙',
  error: '✗',
};

const LiveTerminal: React.FC = () => {
  const [events, setEvents] = useState<TerminalEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const maxEvents = 200;

  const handleEvent = useCallback((event: TerminalEvent) => {
    setEvents(prev => {
      const next = [...prev, event];
      if (next.length > maxEvents) next.splice(0, next.length - maxEvents);
      return next;
    });
  }, []);

  useEffect(() => {
    terminalListeners.add(handleEvent);
    return () => { terminalListeners.delete(handleEvent); };
  }, [handleEvent]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <TerminalIcon className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-bold text-foreground/80 uppercase tracking-wider">Live Terminal</span>
          <span className="text-[8px] text-muted-foreground">({events.length})</span>
        </div>
        <button
          onClick={() => setEvents([])}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          title="Clear terminal"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-2 font-mono text-[10px] space-y-0.5 bg-background/50">
        {events.length === 0 && (
          <div className="text-muted-foreground/30 text-center py-4">
            Waiting for system events...
          </div>
        )}
        <AnimatePresence initial={false}>
          {events.map(evt => (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-1.5 leading-tight"
            >
              <span className="text-muted-foreground/30 shrink-0">
                {new Date(evt.timestamp).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`shrink-0 ${TYPE_COLORS[evt.type]}`}>
                {TYPE_PREFIXES[evt.type]}
              </span>
              <span className="text-muted-foreground/50 shrink-0">[{evt.source}]</span>
              <span className={TYPE_COLORS[evt.type]}>{evt.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LiveTerminal;
