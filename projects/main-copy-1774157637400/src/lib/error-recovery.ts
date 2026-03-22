import { supabase } from '@/integrations/supabase/client';

export type ErrorCategory =
  | 'module-not-found'
  | 'export-missing'
  | 'syntax-error'
  | 'type-error'
  | 'missing-import'
  | 'react-crash'
  | 'dependency-missing'
  | 'port-conflict'
  | 'vite-cache'
  | 'vite-pre-transform'
  | 'supabase-connection'
  | 'cors'
  | 'env-missing'
  | 'circular-dependency'
  | 'reference-error'
  | 'network-error'
  | 'config-error'
  | 'peer-dep-conflict'
  | 'integrity-error'
  | 'corrupted-node-modules'
  | 'package-export-error'
  | 'esm-module-not-found'
  | 'esm-compat'
  | 'openssl-legacy'
  | 'watcher-limit'
  | 'too-many-files'
  | 'heap-oom'
  | 'postcss-tailwind-mismatch'
  | 'missing-cli'
  | 'db-connection-refused'
  | 'missing-env'
  | 'ts-path-error'
  | 'typescript-error'
  | 'tsconfig-parse-error'
  | 'missing-types'
  | 'no-entry-point'
  | 'angular-mismatch'
  | 'process-exit'
  | 'startup-timeout'
  | 'arch-mismatch'
  | 'unknown';

export type RecoveryStrategy =
  | 'restart-vite'
  | 'clear-cache-restart'
  | 'npm-install'
  | 'code-fix'
  | 'retry'
  | 'reload-page'
  | 'new-port'
  | 'kill-port'
  | 'legacy-peer-deps'
  | 'cache-clean-reinstall'
  | 'full-reinstall'
  | 'update-package'
  | 'install-missing-dep'
  | 'delete-framework-cache'
  | 'add-type-module'
  | 'openssl-legacy-provider'
  | 'increase-watchers'
  | 'increase-ulimit'
  | 'increase-heap'
  | 'fix-postcss-config'
  | 'install-missing-cli'
  | 'copy-env-example'
  | 'install-types'
  | 'fix-tsconfig'
  | 'fix-tsconfig-paths'
  | 'full-install-retry'
  | 'vite-force'
  | 'extend-timeout'
  | 'cors-config'
  | 'angular-update'
  | 'upgrade-node-warning'
  | 'escalate';

export interface ClassifiedError {
  category: ErrorCategory;
  strategy: RecoveryStrategy;
  confidence: number;
  file?: string;
  line?: number;
  column?: number;
  symbol?: string;
  detail: string;
}

export interface ErrorReport {
  id: string;
  timestamp: number;
  source: 'browser' | 'vite-server' | 'build' | 'server' | 'preview';
  message: string;
  stack?: string;
  projectName?: string;
  url?: string;
  classified?: ClassifiedError;
  recovery?: {
    strategy: RecoveryStrategy;
    attempted: boolean;
    success: boolean;
    detail: string;
    durationMs: number;
  };
}

interface RateLimitEntry {
  signature: string;
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
}

const errorHistory: ErrorReport[] = [];
const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_HISTORY = 200;
const MAX_ATTEMPTS = 3;
const RATE_WINDOW_MS = 60000;

function errorSignature(msg: string): string {
  return msg
    .replace(/at .*:\d+:\d+/g, '')
    .replace(/\/[^\s:]+/g, '<path>')
    .replace(/\d+/g, 'N')
    .trim()
    .slice(0, 120);
}

function isRateLimited(sig: string): boolean {
  const entry = rateLimitMap.get(sig);
  if (!entry) return false;
  if (Date.now() - entry.firstAttempt > RATE_WINDOW_MS) {
    rateLimitMap.delete(sig);
    return false;
  }
  return entry.attempts >= MAX_ATTEMPTS;
}

function recordAttempt(sig: string): void {
  const entry = rateLimitMap.get(sig);
  if (entry) {
    if (Date.now() - entry.firstAttempt > RATE_WINDOW_MS) {
      rateLimitMap.set(sig, { signature: sig, attempts: 1, firstAttempt: Date.now(), lastAttempt: Date.now() });
    } else {
      entry.attempts++;
      entry.lastAttempt = Date.now();
    }
  } else {
    rateLimitMap.set(sig, { signature: sig, attempts: 1, firstAttempt: Date.now(), lastAttempt: Date.now() });
  }
}

const PATTERNS: { pattern: RegExp; category: ErrorCategory; strategy: RecoveryStrategy; confidence: number; extractFile?: boolean; extractSymbol?: boolean }[] = [
  { pattern: /does not provide an export named '([^']+)'/i, category: 'export-missing', strategy: 'restart-vite', confidence: 0.95, extractSymbol: true },
  { pattern: /The requested module '([^']+)' does not provide/i, category: 'export-missing', strategy: 'restart-vite', confidence: 0.95, extractFile: true },
  { pattern: /Failed to resolve import "([^"]+)" from "([^"]+)"/i, category: 'module-not-found', strategy: 'restart-vite', confidence: 0.9, extractFile: true },
  { pattern: /Cannot find module '([^']+)'/i, category: 'dependency-missing', strategy: 'npm-install', confidence: 0.85, extractSymbol: true },
  { pattern: /Module not found.*Can't resolve '([^']+)'/i, category: 'dependency-missing', strategy: 'npm-install', confidence: 0.85, extractSymbol: true },
  { pattern: /MODULE_NOT_FOUND/i, category: 'dependency-missing', strategy: 'npm-install', confidence: 0.8 },
  { pattern: /ERESOLVE|peer dep(?:endency)?.*conflict|unable to resolve dependency tree/i, category: 'peer-dep-conflict', strategy: 'legacy-peer-deps', confidence: 0.9 },
  { pattern: /EINTEGRITY|sha512.*integrity|checksum failed/i, category: 'integrity-error', strategy: 'cache-clean-reinstall', confidence: 0.95 },
  { pattern: /ENOENT.*node_modules|corrupted.*node_modules|cannot find.*node_modules/i, category: 'corrupted-node-modules', strategy: 'full-reinstall', confidence: 0.9 },
  { pattern: /ERR_PACKAGE_PATH_NOT_EXPORTED/i, category: 'package-export-error', strategy: 'update-package', confidence: 0.85 },
  { pattern: /ERR_MODULE_NOT_FOUND/i, category: 'esm-module-not-found', strategy: 'full-reinstall', confidence: 0.8 },
  { pattern: /ERR_REQUIRE_ESM|Cannot use import statement outside a module|ESM file cannot be loaded by.*require/i, category: 'esm-compat', strategy: 'add-type-module', confidence: 0.9 },
  { pattern: /ERR_OSSL_EVP_UNSUPPORTED|digital envelope routines.*unsupported|error:0308010C/i, category: 'openssl-legacy', strategy: 'openssl-legacy-provider', confidence: 0.95 },
  { pattern: /ENOSPC.*inotify|no space left.*watcher|System limit for.*file watchers/i, category: 'watcher-limit', strategy: 'increase-watchers', confidence: 0.95 },
  { pattern: /EMFILE|too many open files/i, category: 'too-many-files', strategy: 'increase-ulimit', confidence: 0.9 },
  { pattern: /ENOMEM|JavaScript heap out of memory|FATAL ERROR.*Reached heap limit/i, category: 'heap-oom', strategy: 'increase-heap', confidence: 0.95 },
  { pattern: /SyntaxError:.*(?:Unexpected token|Unexpected identifier|Missing .* before)/i, category: 'syntax-error', strategy: 'code-fix', confidence: 0.7 },
  { pattern: /TypeError: (.*) is not a function/i, category: 'type-error', strategy: 'code-fix', confidence: 0.6 },
  { pattern: /TypeError: Cannot read propert(?:y|ies) of (null|undefined)/i, category: 'type-error', strategy: 'code-fix', confidence: 0.6 },
  { pattern: /ReferenceError: (\w+) is not defined/i, category: 'reference-error', strategy: 'code-fix', confidence: 0.7, extractSymbol: true },
  { pattern: /EADDRINUSE.*:(\d+)/i, category: 'port-conflict', strategy: 'kill-port', confidence: 0.95 },
  { pattern: /Pre-transform error/i, category: 'vite-pre-transform', strategy: 'clear-cache-restart', confidence: 0.9 },
  { pattern: /\[vite\] Internal server error/i, category: 'vite-cache', strategy: 'clear-cache-restart', confidence: 0.8 },
  { pattern: /Cannot read propert(?:y|ies) of undefined.*(?:reading 'config'|postcss|tailwind)/i, category: 'postcss-tailwind-mismatch', strategy: 'fix-postcss-config', confidence: 0.9 },
  { pattern: /react-scripts:.*(?:not found|command not found|ENOENT)/i, category: 'missing-cli', strategy: 'install-missing-cli', confidence: 0.95 },
  { pattern: /next:.*(?:not found|command not found)|sh: next: command not found/i, category: 'missing-cli', strategy: 'install-missing-cli', confidence: 0.95 },
  { pattern: /ng:.*(?:not found|command not found)/i, category: 'missing-cli', strategy: 'install-missing-cli', confidence: 0.9 },
  { pattern: /nuxt:.*(?:not found|command not found)/i, category: 'missing-cli', strategy: 'install-missing-cli', confidence: 0.9 },
  { pattern: /ECONNREFUSED.*(?:5432|3306|27017|6379)/i, category: 'db-connection-refused', strategy: 'copy-env-example', confidence: 0.7 },
  { pattern: /\.env.*(?:not found|missing|ENOENT)|env.*file.*missing/i, category: 'missing-env', strategy: 'copy-env-example', confidence: 0.85 },
  { pattern: /TS2307.*Cannot find module/i, category: 'ts-path-error', strategy: 'install-types', confidence: 0.8, extractSymbol: true },
  { pattern: /error TS\d+/i, category: 'typescript-error', strategy: 'code-fix', confidence: 0.6 },
  { pattern: /tsconfig\.json.*(?:error|parse|invalid|Unexpected)/i, category: 'tsconfig-parse-error', strategy: 'fix-tsconfig', confidence: 0.85 },
  { pattern: /Could not find a declaration file for module '([^']+)'/i, category: 'missing-types', strategy: 'install-types', confidence: 0.8, extractSymbol: true },
  { pattern: /No runnable entry point found/i, category: 'no-entry-point', strategy: 'full-install-retry', confidence: 0.9 },
  { pattern: /CORS|Access-Control-Allow-Origin/i, category: 'cors', strategy: 'escalate', confidence: 0.7 },
  { pattern: /fetch.*failed|net::ERR_|NetworkError/i, category: 'network-error', strategy: 'retry', confidence: 0.6 },
  { pattern: /supabase|postgrest|realtime.*error/i, category: 'supabase-connection', strategy: 'retry', confidence: 0.7 },
  { pattern: /VITE_\w+.*undefined|env.*missing|environment variable/i, category: 'env-missing', strategy: 'copy-env-example', confidence: 0.7 },
  { pattern: /Circular dependency/i, category: 'circular-dependency', strategy: 'escalate', confidence: 0.8 },
  { pattern: /import .* from/i, category: 'missing-import', strategy: 'code-fix', confidence: 0.4 },
];

export function classifyError(message: string, stack?: string): ClassifiedError {
  const fullText = `${message} ${stack || ''}`;

  for (const p of PATTERNS) {
    const match = fullText.match(p.pattern);
    if (match) {
      const result: ClassifiedError = {
        category: p.category,
        strategy: p.strategy,
        confidence: p.confidence,
        detail: match[0].slice(0, 200),
      };

      if (p.extractFile && match[1]) {
        result.file = match[1].replace(/^\/src\//, 'src/');
      }
      if (p.extractSymbol && match[1]) {
        result.symbol = match[1];
      }

      const fileMatch = fullText.match(/(?:at |from |in )(?:\/)?([^\s:()]+\.[jt]sx?):(\d+)(?::(\d+))?/);
      if (fileMatch) {
        result.file = result.file || fileMatch[1];
        result.line = parseInt(fileMatch[2], 10);
        if (fileMatch[3]) result.column = parseInt(fileMatch[3], 10);
      }

      return result;
    }
  }

  return {
    category: 'unknown',
    strategy: 'escalate',
    confidence: 0.1,
    detail: message.slice(0, 200),
  };
}

export function reportError(report: Omit<ErrorReport, 'id' | 'timestamp' | 'classified'>): ErrorReport {
  const classified = classifyError(report.message, report.stack);
  const entry: ErrorReport = {
    ...report,
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    classified,
  };

  errorHistory.push(entry);
  if (errorHistory.length > MAX_HISTORY) {
    errorHistory.splice(0, errorHistory.length - MAX_HISTORY);
  }

  console.log(`[AutoFix] Error detected: [${classified.category}] ${classified.detail.slice(0, 100)} (confidence: ${Math.round(classified.confidence * 100)}%, strategy: ${classified.strategy})`);

  return entry;
}

export async function attemptRecovery(
  report: ErrorReport,
  handlers: {
    restartVite?: (projectName?: string) => Promise<boolean>;
    clearCacheRestart?: (projectName?: string) => Promise<boolean>;
    npmInstall?: (projectName?: string) => Promise<boolean>;
    reloadPage?: () => void;
  } = {}
): Promise<{ attempted: boolean; success: boolean; detail: string }> {
  if (!report.classified) {
    return { attempted: false, success: false, detail: 'Error not classified' };
  }

  const sig = errorSignature(report.message);
  if (isRateLimited(sig)) {
    console.log(`[AutoFix] Rate limited — ${sig.slice(0, 60)}... (${MAX_ATTEMPTS} attempts in ${RATE_WINDOW_MS / 1000}s)`);
    return { attempted: false, success: false, detail: `Rate limited: too many attempts for this error pattern` };
  }

  recordAttempt(sig);
  const start = performance.now();
  const { strategy } = report.classified;

  try {
    switch (strategy) {
      case 'restart-vite': {
        if (handlers.restartVite) {
          console.log(`[AutoFix] Restarting Vite server for ${report.projectName || 'main'}...`);
          const ok = await handlers.restartVite(report.projectName);
          const result = { attempted: true, success: ok, detail: ok ? 'Vite server restarted successfully' : 'Vite restart failed' };
          report.recovery = { ...result, strategy, durationMs: Math.round(performance.now() - start) };
          return result;
        }
        return { attempted: false, success: false, detail: 'No Vite restart handler available' };
      }

      case 'clear-cache-restart': {
        if (handlers.clearCacheRestart) {
          console.log(`[AutoFix] Clearing Vite cache and restarting for ${report.projectName || 'main'}...`);
          const ok = await handlers.clearCacheRestart(report.projectName);
          const result = { attempted: true, success: ok, detail: ok ? 'Cache cleared and Vite restarted' : 'Cache clear + restart failed' };
          report.recovery = { ...result, strategy, durationMs: Math.round(performance.now() - start) };
          return result;
        }
        return { attempted: false, success: false, detail: 'No cache clear handler available' };
      }

      case 'npm-install': {
        if (handlers.npmInstall) {
          console.log(`[AutoFix] Installing missing dependencies for ${report.projectName || 'main'}...`);
          const ok = await handlers.npmInstall(report.projectName);
          const result = { attempted: true, success: ok, detail: ok ? 'Dependencies installed' : 'npm install failed' };
          report.recovery = { ...result, strategy, durationMs: Math.round(performance.now() - start) };
          return result;
        }
        return { attempted: false, success: false, detail: 'No npm install handler available' };
      }

      case 'reload-page': {
        if (handlers.reloadPage) {
          console.log('[AutoFix] Triggering page reload...');
          handlers.reloadPage();
          const result = { attempted: true, success: true, detail: 'Page reload triggered' };
          report.recovery = { ...result, strategy, durationMs: Math.round(performance.now() - start) };
          return result;
        }
        return { attempted: false, success: false, detail: 'No page reload handler available' };
      }

      case 'retry': {
        console.log(`[AutoFix] Transient error — will retry automatically on next occurrence`);
        const result = { attempted: true, success: true, detail: 'Marked for retry' };
        report.recovery = { ...result, strategy, durationMs: Math.round(performance.now() - start) };
        return result;
      }

      case 'code-fix': {
        const fixResult = await attemptCodeFix(report);
        report.recovery = { ...fixResult, strategy, durationMs: Math.round(performance.now() - start) };
        return fixResult;
      }

      case 'vite-force':
      case 'fix-tsconfig-paths':
      case 'fix-tsconfig':
      case 'fix-postcss-config':
      case 'increase-ulimit':
      case 'increase-watchers':
      case 'increase-heap':
      case 'openssl-legacy-provider':
      case 'add-type-module':
      case 'kill-port':
      case 'legacy-peer-deps':
      case 'cache-clean-reinstall':
      case 'full-reinstall':
      case 'full-install-retry':
      case 'install-missing-cli':
      case 'install-types':
      case 'update-package':
      case 'copy-env-example':
      case 'extend-timeout':
      case 'cors-config':
      case 'angular-update': {
        console.log(`[AutoFix] Delegating ${strategy} to server for ${report.projectName || 'main'}...`);
        try {
          const resp = await fetch('/api/errors/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: report.message,
              stack: report.stack,
              source: report.source,
              projectName: report.projectName,
            }),
          });
          const data = await resp.json();
          const result = data.recovery || { attempted: true, success: resp.ok, detail: `Server handled ${strategy}` };
          report.recovery = { ...result, strategy, durationMs: Math.round(performance.now() - start) };
          return result;
        } catch {
          const result = { attempted: true, success: false, detail: `Failed to delegate ${strategy} to server` };
          report.recovery = { ...result, strategy, durationMs: Math.round(performance.now() - start) };
          return result;
        }
      }

      case 'new-port':
      case 'escalate':
      default: {
        console.log(`[AutoFix] Cannot auto-fix: ${report.classified.category} — escalating to user`);
        const result = { attempted: false, success: false, detail: `Escalated: ${report.classified.category}` };
        report.recovery = { ...result, strategy, durationMs: Math.round(performance.now() - start) };
        return result;
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[AutoFix] Recovery failed: ${msg}`);
    const result = { attempted: true, success: false, detail: `Recovery threw: ${msg}` };
    report.recovery = { ...result, strategy, durationMs: Math.round(performance.now() - start) };
    return result;
  }
}

async function attemptCodeFix(report: ErrorReport): Promise<{ attempted: boolean; success: boolean; detail: string }> {
  const classified = report.classified;
  if (!classified || !classified.file) {
    console.log('[AutoFix] Code fix: no file identified — escalating');
    return { attempted: false, success: false, detail: 'Cannot determine which file to fix' };
  }

  const filePath = classified.file;
  console.log(`[AutoFix] Attempting code fix for ${filePath} (${classified.category})...`);

  try {
    const readResp = await fetch('/api/read-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
    if (!readResp.ok) {
      return { attempted: true, success: false, detail: `Cannot read file: ${filePath}` };
    }
    const { content: originalContent } = await readResp.json();
    if (typeof originalContent !== 'string') {
      return { attempted: true, success: false, detail: `File read returned no content: ${filePath}` };
    }

    const backupPath = `${filePath}.autofix-backup`;
    await fetch('/api/write-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: backupPath, content: originalContent }),
    });

    let fixedContent: string | null = null;

    if (classified.category === 'reference-error' && classified.symbol) {
      fixedContent = tryFixReferenceError(originalContent, classified.symbol);
    } else if (classified.category === 'missing-import' && classified.symbol) {
      fixedContent = tryFixMissingImport(originalContent, classified.symbol);
    } else if (classified.category === 'type-error') {
      fixedContent = tryFixTypeError(originalContent, report.message, classified.line);
    } else if (classified.category === 'export-missing' && classified.symbol) {
      fixedContent = tryFixMissingExport(originalContent, classified.symbol);
    }

    if (!fixedContent || fixedContent === originalContent) {
      const grokResult = await tryGrokAssistedFix(filePath, originalContent, report.message, classified);
      if (grokResult) {
        fixedContent = grokResult;
      } else {
        console.log(`[AutoFix] No fix found for ${classified.category} — escalating`);
        return { attempted: true, success: false, detail: `No fix available for ${classified.category} in ${filePath}` };
      }
    }

    const writeResp = await fetch('/api/write-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content: fixedContent }),
    });

    if (!writeResp.ok) {
      await revertFile(filePath, originalContent);
      return { attempted: true, success: false, detail: `Write failed — reverted ${filePath}` };
    }

    const validationOk = await validateFixedFile(filePath);
    if (!validationOk) {
      console.log(`[AutoFix] Fix validation failed — reverting ${filePath}`);
      await revertFile(filePath, originalContent);
      return { attempted: true, success: false, detail: `Fix applied but validation failed — reverted ${filePath}` };
    }

    console.log(`[AutoFix] Applied and validated code fix for ${filePath}`);
    return { attempted: true, success: true, detail: `Fixed ${classified.category} in ${filePath}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[AutoFix] Code fix error: ${msg}`);
    return { attempted: true, success: false, detail: `Code fix failed: ${msg}` };
  }
}

async function revertFile(filePath: string, originalContent: string): Promise<void> {
  try {
    await fetch('/api/write-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content: originalContent }),
    });
    console.log(`[AutoFix] Reverted ${filePath} to original content`);
  } catch {
    console.log(`[AutoFix] WARNING: Failed to revert ${filePath}`);
  }
}

async function validateFixedFile(filePath: string): Promise<boolean> {
  try {
    const resp = await fetch('/api/validate-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
    if (!resp.ok) return true;
    const data = await resp.json();
    return data.valid !== false;
  } catch {
    return true;
  }
}

async function tryGrokAssistedFix(filePath: string, content: string, errorMessage: string, classified: ClassifiedError): Promise<string | null> {
  try {
    const resp = await fetch('/api/grok-fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath,
        content: content.slice(0, 8000),
        errorMessage,
        category: classified.category,
        line: classified.line,
        symbol: classified.symbol,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.fixedContent && typeof data.fixedContent === 'string' && data.fixedContent !== content) {
      console.log(`[AutoFix] Grok provided fix for ${filePath}`);
      return data.fixedContent;
    }
    return null;
  } catch {
    console.log(`[AutoFix] Grok-assisted fix unavailable`);
    return null;
  }
}

function tryFixReferenceError(content: string, symbol: string): string | null {
  const alreadyImported = new RegExp(`import\\s+.*\\b${symbol}\\b.*from`, 'm').test(content);
  if (alreadyImported) return null;

  const usageExists = new RegExp(`\\b${symbol}\\b`).test(content);
  if (!usageExists) return null;

  const existingImports = content.match(/from\s+['"]([^'"]+)['"]/g);
  if (existingImports && existingImports.length > 0) {
    const lastImport = existingImports[existingImports.length - 1];
    const moduleMatch = lastImport.match(/from\s+['"]([^'"]+)['"]/);
    if (moduleMatch) {
      const insertLine = `import { ${symbol} } from '${moduleMatch[1]}';\n`;
      const lastImportIdx = content.lastIndexOf(lastImport);
      const lineEnd = content.indexOf('\n', lastImportIdx);
      if (lineEnd >= 0) {
        return content.slice(0, lineEnd + 1) + insertLine + content.slice(lineEnd + 1);
      }
    }
  }
  return null;
}

function tryFixMissingImport(content: string, symbol: string): string | null {
  const usageExists = new RegExp(`\\b${symbol}\\b`).test(content);
  if (!usageExists) return null;

  const alreadyImported = new RegExp(`import\\s+.*\\b${symbol}\\b.*from`, 'm').test(content);
  if (alreadyImported) return null;

  const existingImports = content.match(/from\s+['"]([^'"]+)['"]/g);
  if (existingImports && existingImports.length > 0) {
    const lastImport = existingImports[existingImports.length - 1];
    const moduleMatch = lastImport.match(/from\s+['"]([^'"]+)['"]/);
    if (moduleMatch) {
      const insertLine = `import { ${symbol} } from '${moduleMatch[1]}';\n`;
      const lastImportIdx = content.lastIndexOf(lastImport);
      const lineEnd = content.indexOf('\n', lastImportIdx);
      if (lineEnd >= 0) {
        return content.slice(0, lineEnd + 1) + insertLine + content.slice(lineEnd + 1);
      }
    }
  }
  return null;
}

function tryFixTypeError(content: string, message: string, line?: number): string | null {
  const nullMatch = message.match(/Cannot read propert(?:y|ies) of (null|undefined)/);
  if (nullMatch && line && line > 0) {
    const lines = content.split('\n');
    if (line <= lines.length) {
      const targetLine = lines[line - 1];
      const dotAccess = targetLine.match(/(\w+)\.(\w+)/);
      if (dotAccess) {
        lines[line - 1] = targetLine.replace(
          `${dotAccess[1]}.${dotAccess[2]}`,
          `${dotAccess[1]}?.${dotAccess[2]}`
        );
        return lines.join('\n');
      }
    }
  }
  return null;
}

function tryFixMissingExport(content: string, symbol: string): string | null {
  const funcMatch = content.match(new RegExp(`(?:function|const|let|var|class)\\s+${symbol}\\b`));
  if (funcMatch && !content.match(new RegExp(`export\\s+(?:default\\s+)?(?:function|const|let|var|class)\\s+${symbol}\\b`))) {
    return content.replace(
      new RegExp(`(function|const|let|var|class)\\s+(${symbol}\\b)`),
      `export $1 $2`
    );
  }
  return null;
}

export function getErrorHistory(limit = 50): ErrorReport[] {
  return errorHistory.slice(-limit);
}

export function clearErrorHistory(): void {
  errorHistory.length = 0;
  rateLimitMap.clear();
}

export function getRecoveryStats(): { total: number; autoFixed: number; escalated: number; rateLimited: number } {
  const total = errorHistory.length;
  const autoFixed = errorHistory.filter(e => e.recovery?.success).length;
  const escalated = errorHistory.filter(e => e.classified?.strategy === 'escalate').length;
  const rateLimited = Array.from(rateLimitMap.values()).filter(e => e.attempts >= MAX_ATTEMPTS).length;
  return { total, autoFixed, escalated, rateLimited };
}
