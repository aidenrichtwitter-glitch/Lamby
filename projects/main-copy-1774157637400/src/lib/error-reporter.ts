import { reportError, attemptRecovery, type ErrorReport } from './error-recovery';

type RecoveryListener = (report: ErrorReport, result: { attempted: boolean; success: boolean; detail: string }) => void;

let initialized = false;
let recovering = false;
const listeners: RecoveryListener[] = [];

export function onRecoveryAttempt(fn: RecoveryListener): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notifyListeners(report: ErrorReport, result: { attempted: boolean; success: boolean; detail: string }): void {
  for (const fn of listeners) {
    try { fn(report, result); } catch {}
  }
}

async function postToServer(report: ErrorReport): Promise<void> {
  try {
    await fetch('/api/errors/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: report.message,
        stack: report.stack,
        source: report.source,
        projectName: report.projectName,
      }),
    });
  } catch {}
}

async function handleError(message: string, stack?: string, source: ErrorReport['source'] = 'browser', projectName?: string): Promise<void> {
  if (recovering) return;
  if (shouldIgnore(message)) return;

  const report = reportError({ source, message, stack, projectName });

  postToServer(report);

  if (!report.classified || report.classified.confidence < 0.5) {
    console.log(`[AutoFix] Low confidence (${Math.round((report.classified?.confidence || 0) * 100)}%) — not attempting auto-fix for: ${message.slice(0, 80)}`);
    return;
  }

  recovering = true;
  try {
    const result = await attemptRecovery(report, {
      restartVite: tryRestartPreview,
      clearCacheRestart: tryClearCacheAndRestart,
      npmInstall: tryNpmInstall,
      reloadPage: () => {
        setTimeout(() => window.location.reload(), 500);
      },
    });
    notifyListeners(report, result);
  } finally {
    recovering = false;
  }
}

function shouldIgnore(msg: string): boolean {
  const ignorePatterns = [
    /ResizeObserver loop/i,
    /Non-Error promise rejection captured/i,
    /Loading chunk \d+ failed/i,
    /\[vite\] connecting/i,
    /\[vite\] connected/i,
    /\[vite\] hot updated/i,
    /Download the React DevTools/i,
    /Warning: /,
    /\[HMR\]/,
    /favicon\.ico/,
    /Minified React error/,
    /ERR_CONNECTION_REFUSED/i,
  ];
  return ignorePatterns.some(p => p.test(msg));
}

async function tryRestartPreview(projectName?: string): Promise<boolean> {
  if (!projectName) return false;
  try {
    const resp = await fetch('/api/projects/restart-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: projectName }),
    });
    const data = await resp.json();
    return data.restarted === true || data.started === true;
  } catch {
    return false;
  }
}

async function tryClearCacheAndRestart(projectName?: string): Promise<boolean> {
  try {
    if (projectName) {
      await fetch('/api/projects/run-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, command: 'rm -rf node_modules/.vite .vite' }),
      });
    }
    return tryRestartPreview(projectName);
  } catch {
    return false;
  }
}

async function tryNpmInstall(projectName?: string): Promise<boolean> {
  try {
    if (projectName) {
      const resp = await fetch('/api/projects/install-deps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, fullInstall: true }),
      });
      const data = await resp.json();
      if (data.success) {
        return tryRestartPreview(projectName);
      }
      return false;
    }
    return false;
  } catch {
    return false;
  }
}

export function initErrorReporter(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener('error', (event) => {
    const msg = event.message || String(event.error);
    const stack = event.error?.stack || `at ${event.filename}:${event.lineno}:${event.colno}`;
    handleError(msg, stack, 'browser');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    handleError(msg, stack, 'browser');
  });

  console.log('[AutoFix] Error reporter initialized — monitoring for errors');
}

export function reportBuildError(message: string, file?: string, line?: number): void {
  handleError(message, file ? `at ${file}:${line || 0}:0` : undefined, 'build');
}

export function reportServerError(message: string, stack?: string): void {
  handleError(message, stack, 'server');
}

export function reportPreviewError(message: string, projectName: string, stack?: string): void {
  handleError(message, stack, 'preview', projectName);
}
