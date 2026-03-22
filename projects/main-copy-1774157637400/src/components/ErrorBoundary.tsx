import { Component, type ReactNode } from 'react';
import { reportError, attemptRecovery } from '@/lib/error-recovery';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  recovering: boolean;
  recoveryExhausted: boolean;
  recoveryMessage: string;
}

const MAX_RECOVERY_ATTEMPTS = 3;
const RELOAD_GUARD_KEY = 'lamby-error-boundary-reload';
const RELOAD_GUARD_TTL_MS = 60000;

function getReloadAttempts(): number {
  try {
    const raw = sessionStorage.getItem(RELOAD_GUARD_KEY);
    if (!raw) return 0;
    const { count, ts } = JSON.parse(raw);
    if (Date.now() - ts > RELOAD_GUARD_TTL_MS) {
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
      return 0;
    }
    return count || 0;
  } catch {
    return 0;
  }
}

function incrementReloadAttempts(): number {
  const current = getReloadAttempts();
  const next = current + 1;
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify({ count: next, ts: Date.now() }));
  } catch {}
  return next;
}

function clearReloadAttempts(): void {
  try { sessionStorage.removeItem(RELOAD_GUARD_KEY); } catch {}
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    recovering: false,
    recoveryExhausted: false,
    recoveryMessage: '',
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    const stack = `${error.stack || ''}\nComponent Stack:${info.componentStack || ''}`;

    console.log(`[AutoFix] React error boundary caught: ${error.message}`);

    const report = reportError({
      source: 'browser',
      message: error.message,
      stack,
    });

    fetch('/api/errors/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message, stack, source: 'browser' }),
    }).catch(() => {});

    const reloadCount = getReloadAttempts();
    if (reloadCount >= MAX_RECOVERY_ATTEMPTS) {
      console.log(`[AutoFix] Recovery exhausted (${reloadCount} reloads in ${RELOAD_GUARD_TTL_MS / 1000}s) — showing error UI`);
      this.setState({
        recovering: false,
        recoveryExhausted: true,
        recoveryMessage: `Auto-recovery exhausted after ${reloadCount} attempts`,
      });
      return;
    }

    this.setState({ recovering: true, recoveryMessage: 'Auto-recovering...' });

    attemptRecovery(report, {
      reloadPage: () => {
        incrementReloadAttempts();
        console.log(`[AutoFix] ErrorBoundary triggering page reload (attempt ${reloadCount + 1}/${MAX_RECOVERY_ATTEMPTS})...`);
        setTimeout(() => window.location.reload(), 1000);
      },
    }).then(result => {
      if (result.success && result.attempted) {
        return;
      }
      if (reloadCount + 1 < MAX_RECOVERY_ATTEMPTS) {
        incrementReloadAttempts();
        console.log(`[AutoFix] Recovery attempt ${reloadCount + 1} — trying page reload`);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        this.setState({
          recovering: false,
          recoveryExhausted: true,
          recoveryMessage: result.detail || 'Auto-recovery exhausted',
        });
      }
    });
  }

  handleRetry = (): void => {
    clearReloadAttempts();
    window.location.reload();
  };

  handleReload = (): void => {
    clearReloadAttempts();
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.state.recovering) {
        return (
          <div data-testid="error-boundary-recovering" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: 'var(--background, #0a0a0a)', color: 'var(--foreground, #fafafa)',
            fontFamily: 'system-ui, sans-serif',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', animation: 'pulse 1.5s infinite' }}>
                Auto-recovering...
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.6 }}>
                Lamby detected an error and is fixing it
              </div>
            </div>
          </div>
        );
      }

      if (this.props.fallback) return this.props.fallback;

      return (
        <div data-testid="error-boundary-fallback" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: 'var(--background, #0a0a0a)', color: 'var(--foreground, #fafafa)',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</div>
            <div style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '1.5rem', fontFamily: 'monospace', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', textAlign: 'left', wordBreak: 'break-all' }}>
              {this.state.error?.message || 'Unknown error'}
            </div>
            {this.state.recoveryMessage && (
              <div data-testid="text-recovery-message" style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '1rem' }}>
                Recovery: {this.state.recoveryMessage}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                data-testid="button-retry"
                onClick={this.handleRetry}
                style={{
                  padding: '0.5rem 1.5rem', borderRadius: '0.375rem', border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)', color: 'inherit', cursor: 'pointer', fontSize: '0.875rem',
                }}
              >
                Try Again
              </button>
              <button
                data-testid="button-reload"
                onClick={this.handleReload}
                style={{
                  padding: '0.5rem 1.5rem', borderRadius: '0.375rem', border: 'none',
                  background: 'var(--primary, #7c3aed)', color: '#fff', cursor: 'pointer', fontSize: '0.875rem',
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
