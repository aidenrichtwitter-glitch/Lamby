import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal, Trash2, Send, ChevronUp, ChevronDown, AlertTriangle,
  AlertCircle, Info, X, Copy, Check
} from 'lucide-react';
import { isInfrastructureNoise } from '@/lib/log-filter';

export interface LogEntry {
  id: string;
  level: 'error' | 'warn' | 'log' | 'info';
  message: string;
  timestamp: number;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
}

interface LogsPanelProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  onSendLogsToGrok: (formattedPrompt: string) => void;
  activeProject?: string | null;
  alwaysShowBar?: boolean;
}

const MAX_VISIBLE_STACK_LINES = 5;
const LOG_LEVEL_CONFIG = {
  error: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertCircle },
  warn: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertTriangle },
  log: { color: 'text-muted-foreground', bg: 'bg-transparent', border: 'border-transparent', icon: Terminal },
  info: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Info },
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function formatLogsForGrok(logs: LogEntry[], activeProject?: string | null): string {
  const filtered = logs.filter(l => !isInfrastructureNoise(l.message));
  const errorWarnings = filtered.filter(l => l.level === 'error' || l.level === 'warn');
  const relevantLogs = errorWarnings.length > 0 ? errorWarnings.slice(-20) : filtered.slice(-20);

  let prompt = `=== PREVIEW CONSOLE LOGS ===\n`;
  prompt += `Captured from ${activeProject || 'app'} preview iframe.\n`;
  prompt += `Total entries: ${filtered.length} (${filtered.filter(l => l.level === 'error').length} errors, ${filtered.filter(l => l.level === 'warn').length} warnings)\n\n`;

  for (const log of relevantLogs) {
    const time = formatTimestamp(log.timestamp);
    prompt += `[${time}] [${log.level.toUpperCase()}] ${log.message}\n`;
    if (log.stack) {
      prompt += `  Stack: ${log.stack.split('\n').slice(0, 5).join('\n  ')}\n`;
    }
    if (log.source) {
      prompt += `  Source: ${log.source}${log.line ? `:${log.line}` : ''}${log.column ? `:${log.column}` : ''}\n`;
    }
  }

  prompt += `\n=== END LOGS ===\n\n`;
  prompt += `Please analyze these errors/warnings from the preview and suggest fixes.\n`;
  prompt += `Return corrected files using this format:\n`;
  prompt += `// file: path/to/file.tsx\n\`\`\`tsx\n// corrected content\n\`\`\`\n`;

  return prompt;
}

const LogsPanel: React.FC<LogsPanelProps> = ({ logs, onClearLogs, onSendLogsToGrok, activeProject, alwaysShowBar }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());
  const logsEndRef = useRef<HTMLDivElement>(null);
  const prevLogCount = useRef(logs.length);

  const errorCount = logs.filter(l => l.level === 'error' && !isInfrastructureNoise(l.message)).length;
  const warnCount = logs.filter(l => l.level === 'warn' && !isInfrastructureNoise(l.message)).length;

  useEffect(() => {
    if (logs.length > prevLogCount.current && !collapsed) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLogCount.current = logs.length;
  }, [logs.length, collapsed]);

  useEffect(() => {
    if (errorCount > 0 && collapsed) {
      setCollapsed(false);
    }
  }, [errorCount]);

  const handleSendToGrok = useCallback(() => {
    const prompt = formatLogsForGrok(logs, activeProject);
    onSendLogsToGrok(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [logs, activeProject, onSendLogsToGrok]);

  const toggleStack = useCallback((id: string) => {
    setExpandedStacks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (logs.length === 0 && collapsed && !alwaysShowBar) return null;

  return (
    <div className="border-t border-border/30 bg-background/95 backdrop-blur-sm" data-testid="logs-panel">
      <div
        className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setCollapsed(c => !c)}
        data-testid="button-toggle-logs"
      >
        <Terminal className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Console</span>

        {errorCount > 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-red-500/15 text-red-400 border border-red-500/20" data-testid="text-error-count">
            <AlertCircle className="w-2.5 h-2.5" />
            {errorCount}
          </span>
        )}
        {warnCount > 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/20" data-testid="text-warn-count">
            <AlertTriangle className="w-2.5 h-2.5" />
            {warnCount}
          </span>
        )}
        {logs.length > 0 && errorCount === 0 && warnCount === 0 && (
          <span className="text-[9px] text-muted-foreground/50">{logs.length} log{logs.length !== 1 ? 's' : ''}</span>
        )}

        <div className="ml-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {logs.length > 0 && (
            <>
              <button
                data-testid="button-send-logs-to-grok"
                onClick={handleSendToGrok}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
              >
                {copied ? <Check className="w-2.5 h-2.5" /> : <Send className="w-2.5 h-2.5" />}
                {copied ? 'Copied' : 'Send Logs to Grok'}
              </button>
              <button
                data-testid="button-clear-logs"
                onClick={onClearLogs}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-2.5 h-2.5" />
                Clear
              </button>
            </>
          )}
          {collapsed ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </div>

      {!collapsed && (
        <div className="max-h-48 overflow-auto border-t border-border/20" data-testid="logs-panel-content">
          {logs.length === 0 ? (
            <div className="px-3 py-4 text-center text-[10px] text-muted-foreground/40">
              No console output captured yet
            </div>
          ) : (
            <div className="font-mono text-[10px]">
              {logs.map((log) => {
                const config = LOG_LEVEL_CONFIG[log.level];
                const IconComponent = config.icon;
                const hasStack = log.stack && log.stack.length > 0;
                const isStackExpanded = expandedStacks.has(log.id);

                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-1.5 px-2 py-0.5 ${config.bg} border-l-2 ${config.border} hover:bg-muted/20 transition-colors`}
                    data-testid={`log-entry-${log.id}`}
                  >
                    <span className="text-[8px] text-muted-foreground/40 shrink-0 pt-0.5 select-none tabular-nums">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <IconComponent className={`w-3 h-3 ${config.color} shrink-0 mt-px`} />
                    <div className="flex-1 min-w-0">
                      <span className={`${config.color} break-all whitespace-pre-wrap`}>
                        {log.message}
                      </span>
                      {log.source && (
                        <span className="text-[8px] text-muted-foreground/30 ml-2">
                          {log.source}{log.line ? `:${log.line}` : ''}{log.column ? `:${log.column}` : ''}
                        </span>
                      )}
                      {hasStack && (
                        <div>
                          <button
                            onClick={() => toggleStack(log.id)}
                            className="text-[8px] text-muted-foreground/40 hover:text-muted-foreground/60 mt-0.5"
                            data-testid={`button-toggle-stack-${log.id}`}
                          >
                            {isStackExpanded ? 'Hide stack' : 'Show stack'}
                          </button>
                          {isStackExpanded && (
                            <pre className="text-[8px] text-muted-foreground/40 mt-0.5 whitespace-pre-wrap break-all" data-testid={`text-stack-${log.id}`}>
                              {log.stack}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export { formatLogsForGrok };
export default LogsPanel;
