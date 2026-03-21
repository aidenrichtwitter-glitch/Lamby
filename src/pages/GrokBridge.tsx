import React, { useState, useCallback, useRef, useEffect, useMemo, Fragment } from 'react';
import {
  Send, Shield, Check, AlertTriangle, Undo2, FileCode, Sparkles, Bot,
  User, Loader2, Code2, Trash2, ChevronDown, Globe, MessageSquare,
  Clipboard, ClipboardCheck, Zap, X, ChevronUp, ChevronDown as ChevronDownIcon,
  Dna, FolderOpen, PanelLeftClose, PanelLeft, Play, ExternalLink, Download, Terminal, AlertCircle, Key, ArrowRightLeft, FolderPlus, RefreshCw, Monitor, GitBranch, Upload, Settings,
  Moon, Lock, Smartphone, TestTube2, Gauge, Palette, Wand2, Copy, FileText, Eye, Maximize2, Minimize2
} from 'lucide-react';
import { validateChange, type ValidationContext } from '@/lib/safety-engine';
import { isInfrastructureNoise } from '@/lib/log-filter';
import {
  type AutonomousPhase,
  INITIAL_AUTONOMOUS_STATE, autonomousReducer, getBackoffSeconds,
  formatPhaseLabel, phaseColor,
} from '@/lib/autonomous-loop';
import { SELF_SOURCE } from '@/lib/self-source';
import { SafetyCheck } from '@/lib/self-reference';
import { parseCodeBlocks, ParsedBlock, isLikelySnippet, mergeCSSVariables, parseDependencies, parseActionItems, ActionItem, applySearchReplace, applyUnifiedDiff } from '@/lib/code-parser';
import {
  fetchEvolutionState,
  buildEvolutionContext,
  loadEvolutionPlan,
  extractNextPlan,
  saveEvolutionPlan,
  registerEvolutionResults,
  runGrokEvolutionCycle,
  runFullEvolutionCycle,
  type EvolutionState,
  type EvolutionPlan,
  type EvolutionCycleResult,
  type FullEvolutionCycleResult,
} from '@/lib/evolution-bridge';
import { buildStackFingerprint } from '@/lib/github-discovery';
import {
  getActiveProject, setActiveProject as persistActiveProject,
  readProjectFile, writeProjectFile, getProjectFiles, deleteProject,
  importFromGitHub, detectAllGitHubUrls, detectGitHubUrlInResponse,
  duplicateProject, listProjects,
  type ProjectFileNode, type GitHubImportProgress
} from '@/lib/project-manager';
import {
  checkToasterAvailability,
  buildSmartContext,
  formatAnalysisForPrompt,
  loadToasterConfig,
  saveToasterConfig,
  cleanGrokResponse,
  cleanedResponseToBlocks,
  suggestQuickActions,
  clearAvailabilityCache,
  clearResolvedModelCache,
  toasterReadyTest,
  toasterChat,
  resolveModel,
  type OllamaToasterConfig,
  type ToasterAnalysis,
  type ToasterAvailability,
  type QuickAction,
} from '@/lib/ollama-toaster';
import { publishProject, type PublishProgress } from '@/lib/guardian-publish';
import { captureAndDescribe, checkVisionAvailable } from '@/lib/vision-extender';
import { hasPublishCredentials, getGuardianConfig, setSharedPat, setUserPat } from '@/lib/guardian-config';
import {
  startKnowledgeRefreshLoop,
  stopKnowledgeRefreshLoop,
  searchKnowledge,
  formatKnowledgeForGrokPrompt,
  getKnowledgeSummary,
  type KnowledgeMatch,
} from '@/lib/guardian-knowledge';
import ProjectExplorer from '@/components/ProjectExplorer';
import FileEditor from '@/components/FileEditor';
import LogsPanel, { type LogEntry, formatLogsForGrok } from '@/components/LogsPanel';
import { ParallaxPortal, useParallax } from '@/lib/parallax-context';

const MAX_LOG_ENTRIES = 200;

const isElectron = typeof window !== 'undefined' && typeof (window as any).require === 'function';

type Mode = 'api' | 'browser';
type Msg = { role: 'user' | 'assistant'; content: string };

interface AppliedChange {
  filePath: string;
  previousContent: string;
  newContent: string;
  timestamp: number;
  backupPath?: string;
}

type ApplyStage = 'confirm' | 'writing' | 'checking' | 'committing' | 'done' | 'error';

interface PendingApply {
  filePath: string;
  newContent: string;
  oldContent: string;
  exists: boolean;
  safetyChecks: SafetyCheck[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Msg[];
  model: string;
  createdAt: number;
}

const MODELS = [
  { id: 'grok-4', name: 'Grok 4', desc: 'Most capable (latest)' },
  { id: 'grok-3', name: 'Grok 3', desc: 'Powerful reasoning' },
  { id: 'grok-3-mini', name: 'Grok 3 Mini', desc: 'Fast & efficient' },
  { id: 'grok-3-fast', name: 'Grok 3 Fast', desc: 'Speed optimized' },
  { id: 'grok-2', name: 'Grok 2', desc: 'Balanced' },
];

const BROWSER_SITES = [
  { id: 'grok', name: 'Grok', url: 'https://grok.com', icon: '🤖' },
  { id: 'x', name: 'X', url: 'https://x.com/i/grok', icon: '𝕏' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', icon: '💬' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai', icon: '🧠' },
  { id: 'github', name: 'GitHub', url: 'https://github.com', icon: '🐙' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://perplexity.ai', icon: '🔍' },
];


const BROWSER_MODE_VERSION = 'v26.1';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/grok-chat`;

async function streamGrok({ messages, model, onDelta, onDone, onError }: {
  messages: Msg[]; model: string;
  onDelta: (text: string) => void; onDone: () => void; onError: (err: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ messages, model }),
    });
    if (!resp.ok) { const d = await resp.json().catch(() => ({})); onError(d.error || `Error ${resp.status}`); return; }
    if (!resp.body) { onError('No response body'); return; }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n')) !== -1) {
        let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') { onDone(); return; }
        try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) onDelta(c); } catch { }
      }
    }
    onDone();
  } catch (e) { onError(e instanceof Error ? e.message : 'Stream failed'); }
}

async function streamGrokFC({ messages, model, project, bridgeRelayUrl, systemPrompt, onDelta, onStatus, onDone, onError }: {
  messages: Msg[]; model: string; project: string;
  bridgeRelayUrl: string; systemPrompt?: string;
  onDelta: (text: string) => void; onStatus: (status: string) => void;
  onDone: () => void; onError: (err: string) => void;
}) {
  try {
    const resp = await fetch('/api/grok-responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model, project, bridgeRelayUrl, systemPrompt }),
    });
    if (!resp.ok) { const d = await resp.json().catch(() => ({})); onError(d.error || `Error ${resp.status}`); return; }
    if (!resp.body) { onError('No response body'); return; }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const blocks = buf.split('\n\n');
      buf = blocks.pop() || '';
      for (const block of blocks) {
        const lines = block.split('\n');
        let eventType = '';
        let dataStr = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim();
          else if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
        }
        if (!eventType || !dataStr) continue;
        try {
          const data = JSON.parse(dataStr);
          switch (eventType) {
            case 'status':
              if (data.phase === 'calling-grok') onStatus('🧠 Grok is thinking...');
              else if (data.phase === 'calling-grok-with-results') onStatus(`🔄 Grok processing results (loop ${data.loop})...`);
              break;
            case 'function_call':
              onStatus(`⚡ Calling ${data.name}(${JSON.stringify(data.arguments || {}).slice(0, 80)})`);
              break;
            case 'function_result':
              onStatus(`✅ ${data.name} returned`);
              break;
            case 'text':
              if (data.content) onDelta(data.content);
              break;
            case 'done':
              onDone();
              return;
            case 'error':
              onError(data.error || 'Unknown error');
              return;
          }
        } catch {}
      }
    }
    onDone();
  } catch (e) { onError(e instanceof Error ? e.message : 'Stream failed'); }
}

function generateTitle(messages: Msg[]): string {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New conversation';
  return first.content.slice(0, 50) + (first.content.length > 50 ? '...' : '');
}

const STORAGE_KEY = 'grok-conversations';
function loadConversations(): Conversation[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveConversations(convos: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, 50)));
}

function extractBaseUrl(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return `${url.protocol}//${url.host}`;
  } catch {
    const match = endpoint.match(/^(https?:\/\/[^/]+)/);
    return match ? match[1] : '';
  }
}


async function fetchFreshBridgeEndpoints(project: string): Promise<{ snapUrl: string; cmdUrl: string; proxyUrl: string; editUrl: string; online: boolean }> {
  const isElectronEnv = typeof window !== 'undefined' && (window as any).process?.type === 'renderer';
  try {
    let relayData: any = null;
    let savedMode: string | null = null;
    try { savedMode = localStorage.getItem('lamby-bridge-mode'); } catch {}

    if (isElectronEnv) {
      try {
        const statusRes = await fetch('http://localhost:4999/api/bridge-status').catch(() => null);
        relayData = statusRes?.ok ? await statusRes.json().catch(() => null) : null;
      } catch {}
      if (!relayData) {
        try {
          const devOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';
          const relayRes = await fetch(`${devOrigin}/api/bridge-relay-status`).catch(() => null);
          relayData = relayRes?.ok ? await relayRes.json().catch(() => null) : null;
        } catch {}
      }
    } else {
      const relayRes = await fetch('/api/bridge-relay-status').catch(() => null);
      relayData = relayRes?.ok ? await relayRes.json().catch(() => null) : null;
    }

    if (savedMode === 'production' && relayData?.prodRelayUrl) {
      const relayBase = relayData.prodRelayUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '');
      const statusCheck = await fetch(`${relayBase}/api/bridge-status`).catch(() => null);
      const statusData = statusCheck?.ok ? await statusCheck.json().catch(() => null) : null;
      const online = statusData?.connectedClients > 0 || statusData?.status === 'connected';
      return {
        snapUrl: `${relayBase}/api/snapshot/${project || 'PROJECT_NAME'}`,
        cmdUrl: `${relayBase}/api/sandbox/execute`,
        proxyUrl: `${relayBase}/api/grok-proxy`,
        editUrl: `${relayBase}/api/grok-edit`,
        online,
      };
    }

    const origin = isElectronEnv
      ? (relayData?.devRelayUrl ? relayData.devRelayUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '') : 'http://localhost:4999')
      : (typeof window !== 'undefined' ? window.location.origin : '');
    if (origin) {
      return {
        snapUrl: `${origin}/api/snapshot/${project || 'PROJECT_NAME'}`,
        cmdUrl: `${origin}/api/sandbox/execute`,
        proxyUrl: `${origin}/api/grok-proxy`,
        editUrl: `${origin}/api/grok-edit`,
        online: true,
      };
    }
  } catch {}
  return { snapUrl: '', cmdUrl: '', proxyUrl: '', editUrl: '', online: false };
}

function buildSandboxApiSection(snapshotUrl: string, cmdEndpoint: string, project: string, bridgeOnline = true, proxyUrl = '', editUrl = ''): string {
  if (!snapshotUrl && !cmdEndpoint) return '';
  const proj = project || 'PROJECT_NAME';
  const consoleLogsUrl = snapshotUrl ? snapshotUrl.replace(/\/api\/snapshot\/[^?]+/, '/api/console-logs') + `&project=${proj}` : '';
  const proxyBaseUrl = proxyUrl || (cmdEndpoint ? cmdEndpoint.replace(/\/api\/sandbox\/execute\b/, '/api/grok-proxy') : '');
  const editBaseUrl = editUrl || (cmdEndpoint ? cmdEndpoint.replace(/\/api\/sandbox\/execute\b/, '/api/grok-edit') : '');
  const grokDocsUrl = snapshotUrl ? snapshotUrl.replace(/\/api\/snapshot\/[^?]+/, '/api/grok') : '';

  let section = '\n=== LAMBY WORKSPACE API (YOU HAVE FULL READ/WRITE ACCESS — USE IT) ===\n';
  section += `You are Grok-4 working inside Lamby with full bridge-relay access. Your ONLY web tool is browse_page (GET-only).\n\n`;
  section += `CRITICAL PATIENCE PROTOCOL (MANDATORY — APPLY EVERY TIME):\n`;
  section += `- Desktop connections and Vite dev server reloads take 5–20 seconds. You MUST wait a full 15 seconds after ANY edit (grok-edit or grok-proxy) before taking a screenshot or performing the next action.\n`;
  section += `- Never perform an edit and a screenshot in the same logical step or rapid succession. Always do: edit → wait 15s → screenshot.\n`;
  section += `- For the screenshot tool: ALWAYS use the full URL with ?fullPage=true&waitMs=8000 (minimum 8000ms, use 10000ms for safety on complex pages). Never use the default 3000ms or no wait param — this is required to let the preview fully render after changes.\n`;
  section += `- If you rush or ignore the 15-second wait, the preview may still be loading and changes will appear broken. Slow down every time.\n\n`;

  if (!bridgeOnline) {
    section += `⚠ WARNING: The desktop app may be temporarily offline — API calls might fail until it reconnects. If calls fail, fall back to // file: blocks.\n\n`;
  }

  if (grokDocsUrl) {
    section += `DISCOVERY (call FIRST to confirm endpoints are live):\n`;
    section += `  GET ${grokDocsUrl}\n\n`;
  }

  if (snapshotUrl) {
    section += `READ THE PROJECT (do this before making changes):\n`;
    section += `  GET ${snapshotUrl}\n`;
    section += `  Returns: plain-text snapshot with file tree, package.json, git status, and full contents of every source file.\n\n`;
  }

  if (consoleLogsUrl) {
    section += `CHECK CONSOLE/PREVIEW LOGS:\n`;
    section += `  GET ${consoleLogsUrl}\n`;
    section += `  Returns: JSON { previews: [{ name, port, stdout, stderr }] } — live output from running dev servers.\n\n`;
  }

  if (editBaseUrl) {
    section += `PRIMARY EDIT METHOD — grok-edit (simple GET, no base64):\n`;
    section += `  ${editBaseUrl}&project=${proj}&path=FILE_PATH&search=OLD_TEXT&replace=NEW_TEXT&replaceAll=true\n\n`;
    section += `  This is the fastest way to edit files. URL-encode the search and replace values.\n`;
    section += `  For HTML content with special characters, use base64 params instead:\n`;
    section += `  ${editBaseUrl}&project=${proj}&path=FILE_PATH&searchB64=BASE64_OLD&replaceB64=BASE64_NEW\n`;
    section += `  Returns: { "success": true, "results": [{ "data": { "replacements": N } }] }\n\n`;
    section += `  EXAMPLE:\n`;
    section += `  ${editBaseUrl}&project=${proj}&path=index.html&search=text-white&replace=text-purple-300&replaceAll=true\n\n`;
  }

  const interactBaseUrl = editBaseUrl ? editBaseUrl.replace('/api/grok-edit', '/api/grok-interact') : '';
  if (interactBaseUrl) {
    section += `BROWSER INTERACTION — grok-interact (simple GET, interact with live preview):\n`;
    section += `  ${interactBaseUrl}&project=${proj}&action=ACTION&selector=CSS_SELECTOR\n`;
    section += `  Actions: click, type, select, evaluate, runFunction, waitFor\n`;
    section += `  Params: selector, text (mapped to value), value, x, y, code (mapped to script), script, functionName, args (JSON array), screenshot=true, waitAfter (ms), timeout (ms)\n`;
    section += `  EXAMPLE (click a button):\n`;
    section += `  ${interactBaseUrl}&project=${proj}&action=click&selector=%23submit-btn\n`;
    section += `  EXAMPLE (type text):\n`;
    section += `  ${interactBaseUrl}&project=${proj}&action=type&selector=%23input&text=hello+world\n`;
    section += `  EXAMPLE (evaluate JS):\n`;
    section += `  ${interactBaseUrl}&project=${proj}&action=evaluate&code=return+document.title\n\n`;
  }


  section += `RETRY & ERROR HANDLING (follow strictly):\n`;
  section += `  1. Before any grok-edit call, wait at least 6 seconds.\n`;
  section += `  2. On 503 (or timeout):\n`;
  section += `     - Wait 8 seconds → retry (attempt 2)\n`;
  section += `     - Wait 12 seconds → retry (attempt 3)\n`;
  section += `     - On 3rd failure, report honestly with retry count and pause.\n`;
  section += `  3. Always tell the user:\n`;
  section += `     - Exact URL called\n`;
  section += `     - Success / 503 + retries used\n`;
  section += `     - Current page status from snapshot\n`;
  section += `  Never claim a change happened unless you saw {"success":true}.\n\n`;

  const relayBaseMatch = (snapshotUrl || proxyBaseUrl || editBaseUrl).match(/^(https?:\/\/[^/]+)/);
  const screenshotRelayBase = relayBaseMatch ? relayBaseMatch[1] : 'https://bridge-relay.replit.app';

  if (proxyBaseUrl) {
    section += `ADVANCED: GET proxy for multi-action chains (read + edit + run in one call):\n`;
    section += `  Use this when you need multiple actions in one request (read files, run commands, git, install deps, etc.).\n`;
    section += `  1. Build actions JSON:  { "actions": [ ...action objects... ] }\n`;
    section += `  2. Base64-encode that JSON string\n`;
    section += `  3. Browse:  ${proxyBaseUrl}&project=${proj}&payload=BASE64_ENCODED_ACTIONS\n\n`;
    section += `  Each action needs "type" and "project": "${proj}". Max 50 per request.\n`;
    section += `  Keep payloads under ~6000 chars of JSON before encoding. Use search_replace over write_file for large files.\n\n`;
    section += `  FILE OPERATIONS:\n`;
    section += `    { type: "list_tree", project: "${proj}" }  → full file tree\n`;
    section += `    { type: "read_file", project: "${proj}", path: "src/App.tsx" }  → file content\n`;
    section += `    { type: "write_file", project: "${proj}", path: "src/App.tsx", content: "..." }  → overwrite file (FULL content required, keep under 2KB)\n`;
    section += `    { type: "write_file_chunk", project: "${proj}", path: "src/App.tsx", content: "...", chunk_index: 0, total_chunks: 3 }  → chunked write for files > 2KB\n`;
    section += `      LARGE FILE RULE: For content > 2KB, split into ~1500-char chunks. chunk_index=0 creates/overwrites, 1+ appends. Send each chunk as a separate action.\n`;
    section += `    { type: "create_file", project: "${proj}", path: "src/new.ts", content: "..." }  → create new file\n`;
    section += `    { type: "delete_file", project: "${proj}", path: "src/old.ts" }\n`;
    section += `    { type: "search_replace", project: "${proj}", path: "src/App.tsx", search: "oldText", replace: "newText" }  → find & replace\n`;
    section += `  SEARCH:\n`;
    section += `    { type: "grep", project: "${proj}", pattern: "TODO" }  → regex search across all files\n`;
    section += `    { type: "search_files", project: "${proj}", pattern: "Button" }  → filename search\n`;
    section += `  SHELL / PROCESS / GIT:\n`;
    section += `    { type: "run_command", project: "${proj}", command: "npm run build" }\n`;
    section += `    { type: "install_deps", project: "${proj}" }  → auto-detects npm/yarn/pnpm/bun\n`;
    section += `    { type: "start_process", project: "${proj}", command: "npm run dev" }\n`;
    section += `    { type: "list_processes", project: "${proj}" }\n`;
    section += `    { type: "kill_process", project: "${proj}", pid: 12345 }\n`;
    section += `    { type: "git_status", project: "${proj}" }\n`;
    section += `    { type: "git_add", project: "${proj}", files: "." }\n`;
    section += `    { type: "git_commit", project: "${proj}", message: "fix: description" }\n`;
    section += `    { type: "git_diff", project: "${proj}" }\n`;
    section += `    { type: "git_log", project: "${proj}", count: 10 }\n`;
    section += `  SCREENSHOT — SIMPLE URL (NO encoding needed, just browse this URL):\n`;
    section += `    GET ${screenshotRelayBase}/api/screenshot/${proj}?fullPage=true&waitMs=8000\n`;
    section += `    ALWAYS append ?fullPage=true&waitMs=8000 (or 10000ms for safety). This is the correct, patient way to use the screenshot tool.\n`;
    section += `    Returns: { "success": true, "results": [{ "data": { "captured": true, "screenshotUrl": "https://files.catbox.moe/abc123.png" } }] }\n`;
    section += `    The screenshotUrl is a public direct link — browse it to view or share with the user.\n\n`;
    section += `  SCREENSHOT via grok-proxy (alternative, for multi-action chains):\n`;
    section += `    { type: "screenshot_preview", project: "${proj}" }  → screenshot the running app\n`;
    section += `    { type: "screenshot_preview", project: "${proj}", selector: "#hero", fullPage: true, waitMs: 3000 }\n`;
    section += `    Response: { captured: true, screenshotUrl: "https://files.catbox.moe/abc123.png" }\n`;
    section += `    The screenshotUrl is a public direct link — browse it to view or share with the user.\n`;
    section += `  BROWSER INTERACTION (click buttons, type text, run JS in the live preview):\n`;
    section += `    { type: "browser_interact", project: "${proj}", action: "click", selector: "#submit-btn" }\n`;
    section += `    { type: "browser_interact", project: "${proj}", action: "click", selector: "#btn", screenshot: true }  → click + screenshot after\n`;
    section += `    { type: "browser_interact", project: "${proj}", action: "type", selector: "#input", value: "hello" }\n`;
    section += `    { type: "browser_interact", project: "${proj}", action: "evaluate", script: "return document.title" }\n`;
    section += `    { type: "browser_interact", project: "${proj}", action: "runFunction", functionName: "window.myFunc", args: ["a"] }\n`;
    section += `    { type: "browser_interact", project: "${proj}", action: "waitFor", selector: ".loaded", timeout: 10000 }\n`;
    section += `    Options: screenshot: true (capture + upload after action), waitAfter: 2000 (ms), extractText: true + extractSelector: "#result"\n\n`;
  }

  section += `YOUR WORKFLOW (UPDATED WITH PATIENCE):\n`;
  section += `  1. BROWSE the snapshot URL to see all project files\n`;
  section += `  2. ANALYZE what needs to change\n`;
  section += `  3. USE grok-edit for surgical text replacements (primary) or grok-proxy for complex multi-action chains\n`;
  section += `  3.5. After any edit: WAIT FULL 15 SECONDS for Vite dev server and preview to stabilize\n`;
  section += `  4. BROWSE the screenshot URL to capture the result: ${screenshotRelayBase}/api/screenshot/${proj}?fullPage=true&waitMs=8000\n`;
  section += `  5. VERIFY by browsing the snapshot URL again or checking console logs\n`;
  section += `  6. TELL the user what you did, show the screenshot link\n\n`;

  section += `IMPORTANT RULES (UPDATED):\n`;
  section += `  - ALWAYS use browse_page on these URLs to make changes. Do NOT just show code in your response.\n`;
  section += `  - ALL endpoints are GET-based. Do NOT attempt POST requests.\n`;
  section += `  - Browse the snapshot FIRST to understand the current state before making changes.\n`;
  section += `  - Prefer grok-edit for single-file edits (simpler, faster). Use grok-proxy for multi-step operations.\n`;
  section += `  - After making visual changes, take a screenshot_preview and share the screenshotUrl with the user.\n`;
  section += `  - ENFORCE PATIENCE: Wait 15 seconds after every edit before screenshot or next action. Never work faster than the computer can respond.\n`;
  section += `  - Never claim a change happened unless you saw {"success":true}.\n`;
  section += `  - If an API call fails 3 times, report honestly and fall back to // file: blocks.\n`;

  section += `=== END WORKSPACE API ===\n`;
  return section;
}

// ─── Browser Mode — clipboard-based code extractor ───────────────────────────

interface ExtractedBlock extends ParsedBlock {
  id: string;
  validationResult?: SafetyCheck[];
  applied: boolean;
}

function extractContextSections(fullText: string): string[] {
  const sections: string[] = [];
  const codeBlockRegex = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let match;
  while ((match = codeBlockRegex.exec(fullText)) !== null) {
    const before = fullText.slice(lastIndex, match.index).trim();
    if (before.length > 5) sections.push(before);
    lastIndex = match.index + match[0].length;
  }
  const after = fullText.slice(lastIndex).trim();
  if (after.length > 5) sections.push(after);
  return sections;
}

function ClipboardExtractor({ onApply, onApplyAll, onResponseCaptured, activeProject, onGithubImport, onReplaceRepo, toasterConfig, toasterAvailable, userTask, setUserTask, onGenerateContext, onEditContext, contextLoading, projectContext, injectTextRef, autoDetectEnabled, onToggleAutoDetect }: { onApply: (filePath: string, code: string, editType?: string, searchCode?: string) => void; onApplyAll?: (blocks: { filePath: string; code: string; editType?: string; searchCode?: string }[]) => void; onResponseCaptured?: (fullResponse: string) => void; activeProject?: string | null; onGithubImport?: (url: string) => void; onReplaceRepo?: (url: string) => void; toasterConfig?: OllamaToasterConfig; toasterAvailable?: boolean; userTask: string; setUserTask: (task: string) => void; onGenerateContext: (task?: string) => Promise<void>; onEditContext: () => void; contextLoading: boolean; projectContext: string; injectTextRef?: React.MutableRefObject<((text: string) => void) | null>; autoDetectEnabled: boolean; onToggleAutoDetect: (val: boolean) => void }) {
  type ProjectExtractorState = {
    blocks: ExtractedBlock[];
    detectedDeps: { dependencies: string[]; devDependencies: string[] };
    actionItems: ActionItem[];
    responseContext: string;
    contextSections: string[];
    lastClipboard: string;
    ollamaCleaned: boolean;
    ollamaResult: string | null;
    detectedGithubUrls: { owner: string; repo: string; fullUrl: string }[];
  };
  const emptyState: ProjectExtractorState = {
    blocks: [],
    detectedDeps: { dependencies: [], devDependencies: [] },
    actionItems: [],
    responseContext: '',
    contextSections: [],
    lastClipboard: '',
    ollamaCleaned: false,
    ollamaResult: null,
    detectedGithubUrls: [],
  };
  const projectStatesRef = useRef<Map<string, ProjectExtractorState>>(new Map());
  const currentProjectKey = activeProject || '__no_project__';

  const getProjectState = useCallback((): ProjectExtractorState => {
    return projectStatesRef.current.get(currentProjectKey) || { ...emptyState };
  }, [currentProjectKey]);

  const saveProjectState = useCallback((patch: Partial<ProjectExtractorState>) => {
    const current = projectStatesRef.current.get(currentProjectKey) || { ...emptyState };
    projectStatesRef.current.set(currentProjectKey, { ...current, ...patch });
  }, [currentProjectKey]);

  const [blocks, setBlocks] = useState<ExtractedBlock[]>([]);
  const [detectedDeps, setDetectedDeps] = useState<{ dependencies: string[]; devDependencies: string[] }>({ dependencies: [], devDependencies: [] });
  const [depsInstalling, setDepsInstalling] = useState(false);
  const [depsError, setDepsError] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [programsInstalling, setProgramsInstalling] = useState(false);
  const [programResults, setProgramResults] = useState<{ program: string; label: string; installed: boolean; alreadyInstalled: boolean; error?: string }[] | null>(null);
  const [runningCommands, setRunningCommands] = useState<Set<number>>(new Set());
  const [commandResults, setCommandResults] = useState<Map<number, { success: boolean; output?: string; error?: string }>>(new Map());
  const [responseContext, setResponseContext] = useState<string>('');
  const [contextSections, setContextSections] = useState<string[]>([]);
  const [showContext, setShowContext] = useState(false);
  const [lastClipboard, setLastClipboard] = useState('');
  const [collapsed, setCollapsed] = useState(true);
  const [flash, setFlash] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [clipboardAvailable, setClipboardAvailable] = useState(true);
  const [ollamaCleaned, setOllamaCleaned] = useState(false);
  const [ollamaProcessing, setOllamaProcessing] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [ollamaResult, setOllamaResult] = useState<string | null>(null);
  const [detectedGithubUrls, setDetectedGithubUrls] = useState<{ owner: string; repo: string; fullUrl: string }[]>([]);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const extractorContentRef = useRef<HTMLDivElement>(null);
  const prevProjectKeyRef = useRef(currentProjectKey);
  const extractFromTextRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    if (prevProjectKeyRef.current !== currentProjectKey) {
      const prevKey = prevProjectKeyRef.current;
      const prevState = projectStatesRef.current.get(prevKey) || { ...emptyState };
      projectStatesRef.current.set(prevKey, {
        ...prevState,
        blocks, detectedDeps, actionItems, responseContext, contextSections,
        lastClipboard, ollamaCleaned, ollamaResult, detectedGithubUrls,
      });
      prevProjectKeyRef.current = currentProjectKey;
      const restored = getProjectState();
      setBlocks(restored.blocks);
      setDetectedDeps(restored.detectedDeps);
      setActionItems(restored.actionItems);
      setResponseContext(restored.responseContext);
      setContextSections(restored.contextSections);
      setLastClipboard(restored.lastClipboard);
      setOllamaCleaned(restored.ollamaCleaned);
      setOllamaResult(restored.ollamaResult);
      setDetectedGithubUrls(restored.detectedGithubUrls);
      setDepsInstalling(false);
      setDepsError(null);
      setProgramResults(null);
      setRunningCommands(new Set());
      setCommandResults(new Map());
      setOllamaProcessing(false);
      setOllamaError(null);
    }
  }, [currentProjectKey]);

  const applyParsedBlocks = useCallback((text: string, parsed: { filePath: string; code: string; language: string }[], wasOllamaCleaned: boolean) => {
    const newBlocks: ExtractedBlock[] = parsed.map(b => ({
      ...b,
      id: crypto.randomUUID(),
      applied: false,
    }));
    setBlocks(newBlocks);
    setOllamaCleaned(wasOllamaCleaned);
    setDetectedDeps(parseDependencies(text));
    setActionItems(parseActionItems(text));
    setCollapsed(false);
    setShowPasteBox(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
    if (onResponseCaptured) onResponseCaptured(text);
  }, [onResponseCaptured]);

  const extractFromText = useCallback((text: string) => {
    if (text === lastClipboard || text.length < 10) return;
    if (text.includes('=== PROJECT CONTEXT ===') || text.includes('=== FILE TREE ===') || text.includes('=== EVOLUTION_CONTEXT ===') || text.includes('=== INSTRUCTIONS ===\nWhen suggesting code changes')) return;
    setLastClipboard(text);
    setResponseContext(text);
    setContextSections(extractContextSections(text));

    const githubUrls = detectAllGitHubUrls(text);
    setDetectedGithubUrls(githubUrls);

    if (githubUrls.length > 0 && activeProject && onGithubImport) {
      getProjectFiles(activeProject).then(tree => {
        const flatFiles: string[] = [];
        const walk = (nodes: ProjectFileNode[], prefix = '') => {
          for (const n of nodes) {
            const p = prefix ? `${prefix}/${n.name}` : n.name;
            if (n.type === 'file') flatFiles.push(p);
            if (n.children) walk(n.children, p);
          }
        };
        walk(tree);
        const sourceFiles = flatFiles.filter(f => !['package.json', 'package-lock.json'].includes(f));
        if (sourceFiles.length === 0) {
          onGithubImport(githubUrls[0].fullUrl);
        } else if (onReplaceRepo && text.toLowerCase().includes('suggest') && text.toLowerCase().includes('repo')) {
          onReplaceRepo(githubUrls[0].fullUrl);
        }
      }).catch(() => {});
    }

    const regexParsed = parseCodeBlocks(text);
    applyParsedBlocks(text, regexParsed, false);

    if (toasterAvailable) {
      setOllamaProcessing(true);
      setOllamaError(null);
      setOllamaCleaned(false);
      setOllamaResult(null);
      const startTime = Date.now();
      cleanGrokResponse(text, toasterConfig).then(cleaned => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        if (cleaned && cleaned.files.length > 0) {
          const ollamaBlocks = cleanedResponseToBlocks(cleaned);
          if (ollamaBlocks.length > 0) {
            const regexPathCount = regexParsed.filter(b => b.filePath).length;
            const ollamaPathCount = ollamaBlocks.filter(b => b.filePath).length;
            if (ollamaPathCount >= regexPathCount) {
              applyParsedBlocks(text, ollamaBlocks, true);
              setOllamaResult(`Toaster found ${ollamaBlocks.length} block${ollamaBlocks.length > 1 ? 's' : ''} (${elapsed}s)`);
            } else {
              setOllamaResult(`Regex kept (${regexPathCount} paths vs Toaster ${ollamaPathCount}) — ${elapsed}s`);
            }
          } else {
            setOllamaResult(`Toaster found no blocks — regex result kept (${elapsed}s)`);
          }
        } else {
          setOllamaResult(`Toaster returned empty — regex result kept (${elapsed}s)`);
        }
        if (cleaned?.unparsed_text) {
          const extraDeps = parseDependencies(cleaned.unparsed_text);
          if (extraDeps.dependencies.length > 0 || extraDeps.devDependencies.length > 0) {
            setDetectedDeps(prev => ({
              dependencies: [...new Set([...prev.dependencies, ...extraDeps.dependencies])],
              devDependencies: [...new Set([...prev.devDependencies, ...extraDeps.devDependencies])],
            }));
          }
          const extraActions = parseActionItems(cleaned.unparsed_text);
          if (extraActions.length > 0) {
            setActionItems(prev => [...prev, ...extraActions]);
          }
        }
      }).catch((err) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error('[Toaster] cleanGrokResponse failed:', err);
        setOllamaError(`${err?.message || 'Processing failed'} (${elapsed}s)`);
      }).finally(() => {
        setOllamaProcessing(false);
      });
    }
  }, [lastClipboard, applyParsedBlocks, toasterConfig, toasterAvailable, activeProject, onGithubImport]);

  const readClipboard = useCallback(async () => {
    try {
      if (isElectron) {
        const { ipcRenderer } = (window as any).require('electron');
        const text = await ipcRenderer.invoke('read-clipboard');
        if (text) extractFromText(text);
      } else {
        const text = await navigator.clipboard.readText();
        extractFromText(text);
      }
    } catch {
      setClipboardAvailable(false);
    }
  }, [extractFromText]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (text && text.length > 10) {
      extractFromText(text);
    }
  }, [extractFromText]);

  useEffect(() => {
    extractFromTextRef.current = extractFromText;
    if (injectTextRef) injectTextRef.current = autoDetectEnabled ? extractFromText : null;
    return () => { if (injectTextRef) injectTextRef.current = null; };
  }, [extractFromText, injectTextRef, autoDetectEnabled]);

  useEffect(() => {
    if (!isElectron && autoDetectEnabled) {
      readClipboard();
    }
  }, []);

  const validate = (block: ExtractedBlock) => {
    const checks = validateChange(block.code, block.filePath || 'unknown.ts');
    setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, validationResult: checks } : b));
  };

  const apply = (block: ExtractedBlock) => {
    onApply(block.filePath, block.code, block.editType, block.searchCode);
    setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, applied: true } : b));
    setTimeout(() => {
      setBlocks(prev => prev.filter(b => b.id !== block.id));
    }, 1500);
  };

  const installDeps = async () => {
    if (!activeProject || depsInstalling) return;
    const allDeps = [...detectedDeps.dependencies, ...detectedDeps.devDependencies];
    if (allDeps.length === 0) return;
    setDepsInstalling(true);
    setDepsError(null);
    try {
      const res = await fetch('/api/projects/install-deps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeProject,
          dependencies: detectedDeps.dependencies,
          devDependencies: detectedDeps.devDependencies,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(data.error || `Install failed (${res.status})`);
      }
      if (data.success === false) {
        throw new Error(data.errors?.join('; ') || 'Some packages failed to install');
      }
      setTimeout(() => {
        setDetectedDeps({ dependencies: [], devDependencies: [] });
      }, 2000);
    } catch (err: any) {
      setDepsError(err.message || 'Install failed');
      setTimeout(() => setDepsError(null), 6000);
    } finally {
      setDepsInstalling(false);
    }
  };

  const handleGithubClone = (url: string) => {
    if (activeProject && onReplaceRepo) {
      onReplaceRepo(url);
      setDetectedGithubUrls([]);
    } else if (onGithubImport) {
      onGithubImport(url);
      setDetectedGithubUrls([]);
    }
  };

  return (
    <div className={`border-t bg-background/95 backdrop-blur-sm shadow-2xl transition-colors z-20 ${flash ? 'border-primary bg-primary/10' : 'border-primary/30'}`}>
      {/* Toolbar */}
      <div className="px-4 py-2 flex items-center gap-3 border-b border-border/30 flex-wrap">
        <div className="flex items-center gap-2">
          <Zap className={`w-3.5 h-3.5 text-primary ${flash ? 'animate-ping' : 'animate-pulse'}`} />
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Code Extractor</span>
        </div>
        <button
          onClick={() => onToggleAutoDetect(!autoDetectEnabled)}
          data-testid="button-toggle-autodetect"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] border transition-colors ${autoDetectEnabled ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' : 'bg-muted/30 text-muted-foreground/50 border-border/20 hover:bg-muted/50'}`}
          title={autoDetectEnabled ? 'Auto-detect is ON — click to disable' : 'Auto-detect is OFF — click to enable'}
        >
          <ClipboardCheck className="w-3 h-3" />
          <span>Auto-detect {autoDetectEnabled ? 'ON' : 'OFF'}</span>
        </button>
        <button
          onClick={() => { setShowPasteBox(p => !p); if (collapsed) setCollapsed(false); setTimeout(() => { pasteRef.current?.focus(); }, 100); }}
          data-testid="button-paste-response"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-primary/15 text-primary hover:bg-primary/25 text-[10px] font-medium transition-colors border border-primary/20"
        >
          <Clipboard className="w-3 h-3" /> {showPasteBox ? 'Hide Paste Box' : 'Paste Response'}
        </button>
        {clipboardAvailable && (
          <button
            onClick={readClipboard}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-secondary/50 hover:bg-secondary/80 text-[10px] text-muted-foreground transition-colors"
          >
            <ClipboardCheck className="w-3 h-3" /> Read clipboard
          </button>
        )}
        {blocks.length > 0 && (
          <span className="text-[9px] text-primary/70 ml-1 flex items-center gap-1" data-testid="text-blocks-detected">
            {blocks.length} block{blocks.length > 1 ? 's' : ''} detected
            {ollamaProcessing && (
              <span className="ml-1 text-[8px] text-[hsl(200_70%_60%)] flex items-center gap-1" data-testid="text-ollama-processing">
                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Toaster analyzing...
              </span>
            )}
            {ollamaCleaned && <span className="ml-1 text-[8px] text-[hsl(150_60%_55%)]" data-testid="text-ollama-cleaned">✓ Toaster cleaned</span>}
            {ollamaResult && !ollamaCleaned && <span className="ml-1 text-[8px] text-[hsl(40_80%_60%)]" data-testid="text-ollama-result">⚙ {ollamaResult}</span>}
            {ollamaError && <span className="ml-1 text-[8px] text-red-400" data-testid="text-ollama-error">⚠ {ollamaError}</span>}
          </span>
        )}
        {blocks.filter(b => b.filePath && !b.applied).length > 0 && (
          <button
            onClick={() => {
              const applyable = blocks.filter(b => b.filePath && !b.applied);
              if (applyable.length === 1) {
                onApply(applyable[0].filePath, applyable[0].code, applyable[0].editType, applyable[0].searchCode);
              } else if (onApplyAll) {
                onApplyAll(applyable.map(b => ({ filePath: b.filePath, code: b.code, editType: b.editType, searchCode: b.searchCode })));
              } else {
                applyable.forEach(b => onApply(b.filePath, b.code, b.editType, b.searchCode));
              }
              const ids = new Set(applyable.map(b => b.id));
              setBlocks(prev => prev.map(b => ids.has(b.id) ? { ...b, applied: true } : b));
              setTimeout(() => {
                setBlocks(prev => prev.filter(b => !ids.has(b.id)));
              }, 1500);
            }}
            data-testid="button-apply-toolbar"
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 text-[10px] font-bold transition-colors border border-primary/30"
          >
            <Zap className="w-3 h-3" />
            Apply {blocks.filter(b => b.filePath && !b.applied).length === 1
              ? blocks.find(b => b.filePath && !b.applied)!.filePath.split('/').pop()
              : `All (${blocks.filter(b => b.filePath && !b.applied).length})`}
          </button>
        )}
        {blocks.filter(b => !b.filePath && !b.applied).length > 0 && (
          <span className="text-[8px] text-amber-400/70 ml-1" data-testid="text-snippet-hint">
            {blocks.filter(b => !b.filePath && !b.applied).length} snippet{blocks.filter(b => !b.filePath && !b.applied).length > 1 ? 's' : ''} — assign path to apply
          </span>
        )}
        {!blocks.length && ollamaProcessing && (
          <span className="text-[9px] text-[hsl(200_70%_60%)] ml-1 flex items-center gap-1" data-testid="text-ollama-processing-solo">
            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Toaster analyzing response...
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <input
            type="text"
            value={userTask}
            onChange={e => setUserTask(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && userTask.trim()) {
                e.preventDefault();
                await onGenerateContext(userTask.trim());
              }
            }}
            placeholder="Describe your request for Grok..."
            className="w-[220px] bg-[hsl(220_20%_14%)] text-[10px] text-foreground rounded px-2 py-1 border border-border/20 focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground/30"
            data-testid="input-user-task"
          />
          <button
            onClick={() => onGenerateContext(userTask.trim() || undefined)}
            disabled={contextLoading}
            data-testid="button-generate-context"
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors border border-primary/20 disabled:opacity-40 shrink-0 whitespace-nowrap"
            title={userTask.trim() ? 'Generate context with your task and copy to clipboard' : 'Generate context and copy to clipboard'}
          >
            {contextLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code2 className="w-3 h-3" />}
            {userTask.trim() ? 'Generate & Copy' : 'Copy Context'}
          </button>
          <button
            onClick={onEditContext}
            disabled={!projectContext}
            data-testid="button-edit-context"
            className="flex items-center gap-1 px-1.5 py-1 rounded text-[9px] bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors border border-border/20 disabled:opacity-30 shrink-0"
            title="View and edit the generated context before copying"
          >
            <FileCode className="w-3 h-3" /> Edit
          </button>
        </div>
        {(detectedDeps.dependencies.length > 0 || detectedDeps.devDependencies.length > 0) && (
          depsError ? (
            <span className="text-[9px] text-red-400 ml-1 flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 border border-red-500/30" data-testid="text-deps-error">
              <X className="w-2.5 h-2.5" />
              {depsError}
            </span>
          ) : activeProject ? (
            <button
              onClick={installDeps}
              disabled={depsInstalling}
              data-testid="button-install-deps"
              className="text-[9px] text-[hsl(150_60%_55%)] ml-1 flex items-center gap-1 px-2 py-1.5 rounded bg-[hsl(150_60%_55%/0.1)] hover:bg-[hsl(150_60%_55%/0.25)] border border-[hsl(150_60%_55%/0.3)] cursor-pointer transition-colors font-bold"
            >
              {depsInstalling ? (
                <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Installing...</>
              ) : (
                <><Download className="w-2.5 h-2.5" /> {detectedDeps.dependencies.length + detectedDeps.devDependencies.length} dep{detectedDeps.dependencies.length + detectedDeps.devDependencies.length > 1 ? 's' : ''} to install</>
              )}
            </button>
          ) : (
            <span className="text-[9px] text-[hsl(150_60%_55%/0.5)] ml-1 flex items-center gap-1" data-testid="text-detected-deps-no-project">
              <Zap className="w-2.5 h-2.5" />
              {detectedDeps.dependencies.length + detectedDeps.devDependencies.length} dep{detectedDeps.dependencies.length + detectedDeps.devDependencies.length > 1 ? 's' : ''} (select project to install)
            </span>
          )
        )}
        {actionItems.length > 0 && (
          <span className="text-[9px] text-amber-400/80 ml-1 flex items-center gap-1" data-testid="text-action-items">
            <AlertCircle className="w-2.5 h-2.5" />
            {actionItems.length} action{actionItems.length > 1 ? 's' : ''} needed
          </span>
        )}
        {detectedGithubUrls.length > 0 && onGithubImport && detectedGithubUrls.slice(0, 3).map((gh, i) => (
          <div key={gh.fullUrl} className="flex items-center gap-1 ml-1">
            <button
              onClick={() => handleGithubClone(gh.fullUrl)}
              data-testid={`button-clone-repo-${i}`}
              className={`text-[9px] flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors font-bold border ${
                activeProject
                  ? 'text-amber-300 bg-amber-500/15 hover:bg-amber-500/30 border-amber-500/30'
                  : 'text-[hsl(200_70%_60%)] bg-[hsl(200_70%_60%/0.1)] hover:bg-[hsl(200_70%_60%/0.25)] border-[hsl(200_70%_60%/0.3)]'
              }`}
            >
              <ArrowRightLeft className="w-2.5 h-2.5" />
              {gh.owner}/{gh.repo} → {activeProject ? 'Replace' : 'Clone'}
            </button>
            {activeProject && (
              <button
                onClick={() => { if (onGithubImport) { onGithubImport(gh.fullUrl); setDetectedGithubUrls([]); } }}
                data-testid={`button-clone-alongside-${i}`}
                className="text-[8px] text-[hsl(200_70%_60%)] flex items-center gap-1 px-1.5 py-1 rounded bg-[hsl(200_70%_60%/0.08)] hover:bg-[hsl(200_70%_60%/0.2)] border border-[hsl(200_70%_60%/0.2)] cursor-pointer transition-colors"
              >
                <GitBranch className="w-2 h-2" /> Alongside
              </button>
            )}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {blocks.length > 0 && (
            <button onClick={() => { setBlocks([]); setActionItems([]); setDetectedDeps({ dependencies: [], devDependencies: [] }); setDepsError(null); setProgramResults(null); }} className="p-1 text-muted-foreground/50 hover:text-destructive transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
          <button onClick={() => { setCollapsed(c => !c); }} className="p-1 text-muted-foreground/50 hover:text-foreground transition-colors">
            {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Extracted blocks + context */}
      {!collapsed && (
        <div ref={extractorContentRef} className="p-3 space-y-2">
          {showPasteBox && (
            <div className="rounded-lg border border-primary/30 bg-card/50 p-3">
              <p className="text-[10px] text-muted-foreground mb-2">Copy Grok's response, then paste it here (Ctrl+V / Cmd+V):</p>
              <textarea
                ref={pasteRef}
                data-testid="textarea-paste-response"
                placeholder="Paste Grok's full response here..."
                className="w-full h-24 bg-background/80 border border-border/50 rounded p-2 text-[11px] font-mono text-foreground/80 placeholder:text-muted-foreground/30 resize-y focus:outline-none focus:border-primary/50"
                onPaste={handlePaste}
              />
              <button
                data-testid="button-extract-pasted"
                onClick={() => {
                  const text = pasteRef.current?.value || '';
                  if (text.length > 10) extractFromText(text);
                }}
                className="mt-2 flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 text-[10px] font-bold transition-colors border border-primary/30"
              >
                <Zap className="w-3 h-3" /> Extract Code Blocks
              </button>
            </div>
          )}
          {blocks.length === 0 && !showPasteBox && (
            <div className="text-center py-4 text-[10px] text-muted-foreground/50">
              <p>Click <strong>"Paste Response"</strong> above, then paste Grok's reply (Ctrl+V)</p>
              <p className="mt-1 text-[9px] text-muted-foreground/30">{!autoDetectEnabled ? 'Auto-detect is OFF — use paste or clipboard buttons' : isElectron ? 'Auto-detect also runs in Electron mode' : 'Or use "Read clipboard" if your browser allows it'}</p>
            </div>
          )}

          {responseContext && (
            <div className="rounded-lg border border-border/30 bg-card/30 overflow-hidden">
              <button
                onClick={() => setShowContext(c => !c)}
                data-testid="button-toggle-context"
                className="w-full px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground hover:bg-card/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3 h-3 text-primary/60" />
                  <span className="font-medium">Full Grok Response</span>
                  <span className="text-[8px] text-muted-foreground/50">
                    {blocks.length} code block{blocks.length !== 1 ? 's' : ''} · {contextSections.length} text section{contextSections.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {showContext ? <ChevronUp className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
              </button>
              {showContext && (
                <div className="px-3 py-2 border-t border-border/20 max-h-64 overflow-auto">
                  <div className="text-[10px] text-foreground/70 leading-relaxed whitespace-pre-wrap" data-testid="text-full-response">
                    {responseContext}
                  </div>
                </div>
              )}
            </div>
          )}

          {actionItems.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
              <div className="px-3 py-1.5 flex items-center gap-2 border-b border-amber-500/20">
                <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-[10px] font-bold text-amber-300">Action Required</span>
                <span className="text-[8px] text-amber-400/60">{actionItems.length} step{actionItems.length > 1 ? 's' : ''} — do in order</span>
                {actionItems.some(a => a.type === 'install') && (
                  <button
                    disabled={programsInstalling}
                    onClick={async () => {
                      const progs = actionItems.filter(a => a.type === 'install').map(a => a.command!).filter(Boolean);
                      if (progs.length === 0) return;
                      setProgramsInstalling(true);
                      setProgramResults(null);
                      try {
                        const res = await fetch('/api/programs/install', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ programs: progs }),
                        });
                        const data = await res.json();
                        if (!res.ok && !data.results) {
                          setProgramResults([{ program: 'all', label: 'All', installed: false, alreadyInstalled: false, error: data.error || `HTTP ${res.status}` }]);
                        } else {
                          const results = data.results || [];
                        setProgramResults(results);
                        setTimeout(() => {
                          const successProgs = new Set(results.filter((r: any) => r.installed || r.alreadyInstalled).map((r: any) => r.program));
                          if (successProgs.size > 0) {
                            setActionItems(prev => prev.filter(a => !(a.type === 'install' && a.command && successProgs.has(a.command))));
                          }
                        }, 2000);
                        }
                      } catch (err: any) {
                        setProgramResults([{ program: 'all', label: 'All', installed: false, alreadyInstalled: false, error: err.message }]);
                      } finally {
                        setProgramsInstalling(false);
                      }
                    }}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30 text-[9px] font-bold transition-colors border border-green-500/30 disabled:opacity-50"
                    data-testid="button-download-programs"
                  >
                    {programsInstalling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    {programsInstalling ? 'Installing...' : `Download Programs (${actionItems.filter(a => a.type === 'install').length})`}
                  </button>
                )}
              </div>
              <div className="px-3 py-2 space-y-1.5">
                {actionItems.map((item, i) => {
                  const progResult = item.type === 'install' && programResults ? programResults.find(r => r.program === item.command) : null;
                  return (
                    <div key={i} className="flex items-start gap-2 text-[9px]" data-testid={`action-item-${i}`}>
                      <span className="shrink-0 w-4 h-4 rounded-full bg-foreground/10 flex items-center justify-center text-[8px] font-bold text-foreground/50 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="shrink-0 mt-0.5">
                        {item.type === 'command' && <Terminal className="w-3 h-3 text-amber-400" />}
                        {item.type === 'install' && <Download className="w-3 h-3 text-green-400" />}
                        {item.type === 'env' && <Key className="w-3 h-3 text-blue-400" />}
                        {item.type === 'create-dir' && <FolderPlus className="w-3 h-3 text-cyan-400" />}
                        {item.type === 'rename' && <ArrowRightLeft className="w-3 h-3 text-purple-400" />}
                        {item.type === 'delete' && <Trash2 className="w-3 h-3 text-red-400" />}
                        {item.type === 'manual' && <AlertCircle className="w-3 h-3 text-amber-400" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-foreground/80">{item.description}</span>
                        {progResult && (
                          <span className={`ml-2 text-[8px] ${progResult.installed || progResult.alreadyInstalled ? 'text-green-400' : 'text-red-400'}`}>
                            {progResult.alreadyInstalled ? '✓ already installed' : progResult.installed ? '✓ installed' : `✗ Command failed: ${progResult.command || progResult.error || 'failed'}`}
                            {!progResult.installed && !progResult.alreadyInstalled && (progResult as any).hint && (
                              <span className="block text-amber-400/70 mt-0.5">{(progResult as any).hint}</span>
                            )}
                          </span>
                        )}
                        {item.command && !progResult && (
                          <>
                            {activeProject && item.command && ['command', 'delete', 'create-dir', 'rename'].includes(item.type) && (
                              <button
                                disabled={runningCommands.has(i)}
                                onClick={async () => {
                                  setRunningCommands(prev => new Set(prev).add(i));
                                  setCommandResults(prev => { const m = new Map(prev); m.delete(i); return m; });
                                  try {
                                    const res = await fetch('/api/projects/run-command', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ name: activeProject, command: item.command }),
                                    });
                                    const result = await res.json();
                                    setCommandResults(prev => new Map(prev).set(i, result));
                                    if (result.success) {
                                      const itemDesc = item.description;
                                      const itemCmd = item.command;
                                      setTimeout(() => {
                                        setActionItems(prev => prev.filter(a => !(a.description === itemDesc && a.command === itemCmd)));
                                      }, 2000);
                                    }
                                  } catch (err: any) {
                                    setCommandResults(prev => new Map(prev).set(i, { success: false, error: err.message }));
                                  } finally {
                                    setRunningCommands(prev => { const s = new Set(prev); s.delete(i); return s; });
                                  }
                                }}
                                className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30 text-[8px] font-bold transition-colors border border-green-500/30 disabled:opacity-50"
                                data-testid={`button-run-action-${i}`}
                              >
                                {runningCommands.has(i) ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                                {runningCommands.has(i) ? 'Running...' : 'Run'}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(item.command!);
                              }}
                              className="ml-1 text-[8px] text-primary/60 hover:text-primary underline cursor-pointer"
                              data-testid={`button-copy-action-${i}`}
                            >
                              copy
                            </button>
                            {commandResults.has(i) && (
                              <span className={`ml-1 text-[8px] ${commandResults.get(i)!.success ? 'text-green-400' : 'text-red-400'}`}>
                                {commandResults.get(i)!.success ? '✓ done' : `✗ ${commandResults.get(i)!.error?.slice(0, 80) || 'failed'}`}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {blocks.map(block => {
            const isSnippet = !block.filePath;
            return (
            <div key={block.id} className={`rounded-lg border overflow-hidden transition-all duration-500 ${block.applied ? 'border-primary/40 bg-primary/5 opacity-50 scale-[0.98]' : isSnippet ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/50 bg-card/50'}`}>
              <div className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-border/20">
                <div className="flex items-center gap-2 min-w-0">
                  {isSnippet ? <FileText className="w-3 h-3 text-amber-400 shrink-0" /> : <Code2 className="w-3 h-3 text-muted-foreground shrink-0" />}
                  {isSnippet ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[9px] text-amber-400 font-medium shrink-0">Snippet</span>
                      <input
                        type="text"
                        placeholder="Set file path to apply (e.g. src/App.tsx)"
                        data-testid={`input-snippet-path-${block.id}`}
                        className="text-[10px] font-mono bg-background/60 border border-amber-500/30 rounded px-1.5 py-0.5 text-foreground/80 placeholder:text-muted-foreground/30 w-48 focus:outline-none focus:border-primary/50"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val) setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, filePath: val } : b));
                          }
                        }}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val) setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, filePath: val } : b));
                        }}
                      />
                    </div>
                  ) : (
                    <span className="text-[10px] text-foreground/80 font-mono truncate">{block.filePath}</span>
                  )}
                  <span className="text-[8px] text-muted-foreground/50 shrink-0">{block.code.split('\n').length} lines</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!block.applied && (
                    <>
                      <button
                        onClick={() => { navigator.clipboard.writeText(block.code); }}
                        data-testid={`button-copy-${block.id}`}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/50 text-muted-foreground hover:bg-secondary/80 text-[9px] transition-colors"
                        title="Copy code to clipboard"
                      >
                        <Copy className="w-2.5 h-2.5" /> Copy
                      </button>
                      <button onClick={() => validate(block)} data-testid={`button-check-${block.id}`} className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[9px] transition-colors">
                        <Shield className="w-2.5 h-2.5" /> Check
                      </button>
                      {block.filePath && (
                        <button onClick={() => apply(block)} data-testid={`button-apply-${block.id}`} className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/15 text-primary hover:bg-primary/30 text-[9px] font-medium transition-colors">
                          <Zap className="w-2.5 h-2.5" /> Apply
                        </button>
                      )}
                    </>
                  )}
                  {block.applied && (
                    <span className="flex items-center gap-1 text-[9px] text-primary font-medium">
                      <Check className="w-2.5 h-2.5" /> Applied ✓
                    </span>
                  )}
                </div>
              </div>
              <pre className="px-3 py-2 text-[9px] font-mono text-foreground/60 max-h-28 overflow-auto leading-relaxed whitespace-pre-wrap">
                {block.code.slice(0, 600)}{block.code.length > 600 ? '\n...' : ''}
              </pre>
              {block.validationResult && (
                <div className="px-3 py-1 border-t border-border/20 space-y-0.5">
                  {block.validationResult.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[8px]">
                      {c.severity === 'error' ? <AlertTriangle className="w-2.5 h-2.5 text-destructive" /> : <Check className="w-2.5 h-2.5 text-primary" />}
                      <span className={c.severity === 'error' ? 'text-destructive' : 'text-primary/70'}>{c.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Apply Confirmation Dialog ───────────────────────────────────────────────

function simpleDiff(oldText: string, newText: string): { type: 'same' | 'add' | 'remove'; line: string }[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: { type: 'same' | 'add' | 'remove'; line: string }[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);
  let oi = 0, ni = 0;
  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
      result.push({ type: 'same', line: oldLines[oi] });
      oi++; ni++;
    } else if (oi < oldLines.length && (ni >= newLines.length || !newLines.slice(ni).includes(oldLines[oi]))) {
      result.push({ type: 'remove', line: oldLines[oi] });
      oi++;
    } else {
      result.push({ type: 'add', line: newLines[ni] });
      ni++;
    }
    if (result.length > 200) {
      result.push({ type: 'same', line: `... (${maxLen - 200} more lines)` });
      break;
    }
  }
  return result;
}

function ApplyConfirmDialog({
  pending,
  stage,
  stageMessage,
  compileError,
  onConfirm,
  onCancel,
  onRollback,
}: {
  pending: PendingApply;
  stage: ApplyStage;
  stageMessage: string;
  compileError: string;
  onConfirm: () => void;
  onCancel: () => void;
  onRollback: () => void;
}) {
  const diff = useMemo(() => simpleDiff(pending.oldContent, pending.newContent), [pending.oldContent, pending.newContent]);
  const hasErrors = pending.safetyChecks.some(c => c.severity === 'error');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" data-testid="dialog-apply-confirm">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <FileCode className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{pending.exists ? 'Modify' : 'Create'} File</span>
            <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">{pending.filePath}</span>
            {stageMessage && stage === 'confirm' && (
              <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{stageMessage}</span>
            )}
          </div>
          {stage === 'confirm' && (
            <button onClick={onCancel} data-testid="button-cancel-apply" className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {pending.safetyChecks.length > 0 && (
          <div className="px-4 py-2 border-b border-border/50 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Safety Checks</span>
            {pending.safetyChecks.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                {c.severity === 'error' ? <AlertTriangle className="w-3 h-3 text-destructive" /> : <Check className="w-3 h-3 text-primary" />}
                <span className={c.severity === 'error' ? 'text-destructive' : 'text-primary/70'}>{c.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto px-4 py-2 min-h-0">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
            <span>{pending.exists ? 'Changes' : 'New File Content'}</span>
            {pending.exists && (
              <span className="font-normal text-muted-foreground/60">
                {pending.oldContent.split('\n').length} lines → {pending.newContent.split('\n').length} lines
              </span>
            )}
            {!pending.exists && <span className="font-normal text-muted-foreground/60">{pending.newContent.split('\n').length} lines</span>}
          </div>
          <div className="rounded border border-border/50 bg-card/30 overflow-auto max-h-64">
            <pre className="text-[9px] font-mono leading-relaxed p-2">
              {diff.slice(0, 150).map((d, i) => (
                <div
                  key={i}
                  className={
                    d.type === 'add' ? 'bg-green-500/15 text-green-400' :
                    d.type === 'remove' ? 'bg-red-500/15 text-red-400 line-through' :
                    'text-foreground/50'
                  }
                >
                  {d.type === 'add' ? '+ ' : d.type === 'remove' ? '- ' : '  '}{d.line}
                </div>
              ))}
            </pre>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px]">
            {stage === 'writing' && <><Loader2 className="w-3 h-3 animate-spin text-primary" /><span className="text-primary">Writing file...</span></>}
            {stage === 'checking' && <><Loader2 className="w-3 h-3 animate-spin text-yellow-500" /><span className="text-yellow-500">Checking for errors...</span></>}
            {stage === 'committing' && <><Loader2 className="w-3 h-3 animate-spin text-blue-400" /><span className="text-blue-400">Git commit...</span></>}
            {stage === 'done' && <><Check className="w-3 h-3 text-primary" /><span className="text-primary">{stageMessage}</span></>}
            {stage === 'error' && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-destructive" /><span className="text-destructive">{stageMessage}</span></div>
                {compileError && <pre className="text-[8px] text-destructive/70 max-h-20 overflow-auto whitespace-pre-wrap">{compileError}</pre>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {stage === 'confirm' && (
              <>
                <button onClick={onCancel} data-testid="button-cancel" className="px-3 py-1.5 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Cancel</button>
                <button
                  onClick={onConfirm}
                  data-testid="button-confirm-apply"
                  disabled={hasErrors}
                  className="px-3 py-1.5 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" /> Write to Disk
                </button>
              </>
            )}
            {stage === 'error' && (
              <>
                <button onClick={onRollback} data-testid="button-rollback" className="px-3 py-1.5 rounded text-xs bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors flex items-center gap-1">
                  <Undo2 className="w-3 h-3" /> Rollback
                </button>
                <button onClick={onCancel} data-testid="button-dismiss-error" className="px-3 py-1.5 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Dismiss</button>
              </>
            )}
            {stage === 'done' && (
              <button onClick={onCancel} data-testid="button-done" className="px-3 py-1.5 rounded text-xs bg-primary/15 text-primary hover:bg-primary/25 transition-colors">Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Grok Desktop Browser (Electron embedded webview) ────────────────────────

interface GrokDesktopBrowserProps {
  browserUrl: string;
  setBrowserUrl: (url: string) => void;
  customUrl: string;
  setCustomUrl: (url: string) => void;
}

function GrokDesktopBrowser({ browserUrl, setBrowserUrl, customUrl, setCustomUrl }: GrokDesktopBrowserProps) {
  const webviewRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const initialUrlRef = useRef(browserUrl);
  const currentUrlRef = useRef(browserUrl);

  const navigateTo = useCallback((url: string) => {
    if (isElectron) {
      const wv = webviewRef.current;
      if (wv && typeof wv.loadURL === 'function') {
        wv.loadURL(url);
      }
      currentUrlRef.current = url;
      setBrowserUrl(url);
      setLoading(true);
    } else {
      window.open(url, '_blank');
    }
  }, [setBrowserUrl]);

  const openCustom = useCallback(() => {
    if (!customUrl.trim()) return;
    const url = customUrl.startsWith('http') ? customUrl : `https://${customUrl}`;
    navigateTo(url);
    setCustomUrl('');
  }, [customUrl, setCustomUrl, navigateTo]);

  useEffect(() => {
    if (!isElectron) return;
    const wv = webviewRef.current;
    if (!wv) return;

    let loadTimer: ReturnType<typeof setTimeout> | null = null;
    const onLoading = () => {
      setLoading(true);
      if (loadTimer) clearTimeout(loadTimer);
      loadTimer = setTimeout(() => {
        console.warn('[webview] Loading timeout — hiding overlay');
        setLoading(false);
      }, 5000);
    };
    const onLoaded = () => {
      if (loadTimer) clearTimeout(loadTimer);
      setLoading(false);
    };
    const onNavigation = (e: any) => {
      if (e.url && e.url !== currentUrlRef.current) {
        currentUrlRef.current = e.url;
        setBrowserUrl(e.url);
      }
    };
    const onFailLoad = (e: any) => {
      if (e.errorCode !== -3) {
        console.error('[webview] did-fail-load:', e.errorCode, e.errorDescription, e.validatedURL);
      }
      setLoading(false);
    };
    const onDomReady = () => {
      if (loadTimer) clearTimeout(loadTimer);
      setLoading(false);
    };

    wv.addEventListener('did-start-loading', onLoading);
    wv.addEventListener('did-stop-loading', onLoaded);
    wv.addEventListener('did-navigate', onNavigation);
    wv.addEventListener('did-fail-load', onFailLoad);
    wv.addEventListener('dom-ready', onDomReady);

    return () => {
      if (loadTimer) clearTimeout(loadTimer);
      wv.removeEventListener('did-start-loading', onLoading);
      wv.removeEventListener('did-stop-loading', onLoaded);
      wv.removeEventListener('did-navigate', onNavigation);
      wv.removeEventListener('did-fail-load', onFailLoad);
      wv.removeEventListener('dom-ready', onDomReady);
    };
  }, [setBrowserUrl]);

  const currentSite = BROWSER_SITES.find(s => browserUrl.startsWith(s.url));

  if (!isElectron) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="shrink-0 border-b border-border/30 bg-card/40 px-3 py-2 flex items-center gap-2">
          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            {BROWSER_SITES.map(site => (
              <button
                key={site.id}
                data-testid={`button-open-${site.id}`}
                onClick={() => window.open(site.url, '_blank')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors bg-secondary/30 text-muted-foreground hover:bg-secondary/60 border border-transparent"
              >
                <span>{site.icon}</span>
                <span>{site.name}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Globe className="w-3 h-3 text-muted-foreground/50" />
            <input
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && customUrl.trim()) { const url = customUrl.startsWith('http') ? customUrl : `https://${customUrl}`; window.open(url, '_blank'); setCustomUrl(''); } }}
              placeholder="Custom URL..."
              data-testid="input-custom-url-web"
              className="w-36 bg-background border border-border/50 rounded px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30"
            />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="text-center space-y-3 max-w-lg">
              <Globe className="w-10 h-10 text-primary/60 mx-auto" />
              <h2 className="text-base font-bold text-foreground" data-testid="text-browser-status">Web Mode</h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Running in web mode. Sites open in new browser tabs. For the full embedded browser experience, download and run the desktop app.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 border-b border-border/30 bg-card/40 px-3 py-2 flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {BROWSER_SITES.map(site => (
            <button
              key={site.id}
              data-testid={`button-open-${site.id}`}
              onClick={() => navigateTo(site.url)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors ${
                browserUrl.startsWith(site.url)
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/60 border border-transparent'
              }`}
            >
              <span>{site.icon}</span>
              <span>{site.name}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {loading && <Loader2 className="w-3 h-3 text-primary/60 animate-spin" />}
          <Globe className="w-3 h-3 text-muted-foreground/50" />
          <input
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') openCustom(); }}
            placeholder="Custom URL..."
            data-testid="input-custom-url"
            className="w-36 bg-background border border-border/50 rounded px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      <div className="flex-1 relative min-h-0 overflow-hidden">
        {/* @ts-ignore - webview is an Electron-specific HTML element */}
        <webview
          ref={(el: any) => { webviewRef.current = el; }}
          src={initialUrlRef.current}
          partition="persist:browser"
          data-testid="webview-browser"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          allowpopups="true"
        />
        {loading && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-center py-2 z-10 pointer-events-none">
            <div className="flex items-center gap-2 bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-border/30">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Loading {currentSite?.name || 'page'}...</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Preview Frame with Loading Overlay ──────────────────────────────────────

interface PreviewFrameProps {
  previewKey: number;
  src: string;
  title: string;
  previewLogs: LogEntry[];
  activeProject: string | null;
  panelId?: string;
}

const PreviewFrame = React.forwardRef<HTMLIFrameElement, PreviewFrameProps>(
  ({ previewKey, src, title, previewLogs, activeProject, panelId }, ref) => {
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [serverDown, setServerDown] = useState(false);
    const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      setIframeLoaded(false);
      setServerDown(false);
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
      return () => { if (checkTimerRef.current) clearTimeout(checkTimerRef.current); };
    }, [previewKey]);

    const handleIframeLoad = useCallback(() => {
      setIframeLoaded(true);
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
      checkTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(src, { method: 'HEAD', mode: 'no-cors' });
          setServerDown(false);
        } catch {
          setServerDown(true);
        }
      }, 3000);
    }, [src]);

    const handleIframeError = useCallback(() => {
      setIframeLoaded(true);
      setServerDown(true);
    }, []);

    const errorCount = previewLogs.filter(l => l.level === 'error' && !isInfrastructureNoise(l.message)).length;

    return (
      <div className="flex-1 w-full relative min-h-0 flex flex-col">
        <iframe
          ref={ref}
          key={previewKey}
          src={previewKey > 0 ? `${src}${src.includes('?') ? '&' : '?'}_r=${previewKey}` : src}
          data-testid="iframe-preview"
          data-panel-id={panelId}
          className="flex-1 w-full border-0"
          style={{ background: 'hsl(220 15% 8%)' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          title={title}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
        {!iframeLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[hsl(220_15%_8%)] z-10" data-testid="preview-loading-overlay">
            <Loader2 className="w-8 h-8 text-primary/60 animate-spin" />
            <span className="text-sm text-muted-foreground/70 font-medium">Loading {activeProject || 'preview'}...</span>
            <span className="text-[10px] text-muted-foreground/40">Starting dev server & bundling</span>
          </div>
        )}
        {serverDown && iframeLoaded && (
          <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-2 pt-6 z-10 pointer-events-none" data-testid="preview-blank-overlay">
            <div className="pointer-events-auto flex flex-col items-center gap-2 px-4 py-3 rounded-lg bg-background/95 border border-amber-500/30 shadow-lg max-w-sm text-center backdrop-blur-sm">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span className="text-xs text-amber-300 font-medium">
                Preview server not responding
              </span>
              {errorCount > 0 && (
                <span className="text-[10px] text-red-400/80">
                  {errorCount} error{errorCount > 1 ? 's' : ''} in console
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/60">
                The dev server may have crashed. Check console below.
              </span>
              <button
                onClick={() => setServerDown(false)}
                className="pointer-events-auto text-[9px] text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-1"
                data-testid="button-dismiss-blank-overlay"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

// ─── Main Component ───────────────────────────────────────────────────────────

const GrokBridge: React.FC = () => {
  const [mode, setMode] = useState<Mode>('browser');
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState('grok-4');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(() => localStorage.getItem('lamby-auto-apply') === 'true');
  const [visionEnabled, setVisionEnabled] = useState(() => localStorage.getItem('lamby-vision') === 'true');
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(() => localStorage.getItem('lamby-autodetect') !== 'false');
  const [visionAvailable, setVisionAvailable] = useState(false);
  const [visionAnalyzing, setVisionAnalyzing] = useState(false);
  const [autonomousState, dispatchAutonomous] = React.useReducer(autonomousReducer, INITIAL_AUTONOMOUS_STATE);
  const autonomousTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autonomousCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autonomousCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webviewPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operationLockRef = useRef(false);
  const injectExtractorTextRef = useRef<((text: string) => void) | null>(null);
  const processWebviewResponseRef = useRef<((text: string) => void) | null>(null);
  const autoApplyBackupsRef = useRef<{ filePath: string; oldContent: string; newContent: string }[]>([]);
  const [autoApplyUndoVisible, setAutoApplyUndoVisible] = useState(false);
  const autoApplyUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<AppliedChange[]>([]);
  const [validationResults, setValidationResults] = useState<Map<string, SafetyCheck[]>>(new Map());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string>('');
  const [commandEndpoint, setCommandEndpoint] = useState<string>('');
  const [externalSnapshotUrl, setExternalSnapshotUrl] = useState<string>('');
  const [externalCommandEndpoint, setExternalCommandEndpoint] = useState<string>('');
  const [bridgeStatus, setBridgeStatus] = useState<string>('unknown');
  const [bridgeRelayUrl, setBridgeRelayUrl] = useState<string>('');
  const [showBridgeSettings, setShowBridgeSettings] = useState(false);
  const [bridgeRelayInput, setBridgeRelayInput] = useState('');
  const [bridgeMode, setBridgeMode] = useState<'dev' | 'production'>(() => {
    try { return (localStorage.getItem('lamby-bridge-mode') as 'dev' | 'production') || 'production'; } catch { return 'production'; }
  });
  const [serverDevRelayUrl, setServerDevRelayUrl] = useState<string>('');
  const bridgeWsRef = useRef<WebSocket | null>(null);
  const [browserUrl, setBrowserUrl] = useState('https://grok.com');
  const [customUrl, setCustomUrl] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendMessageRef = useRef<() => Promise<void>>();
  const [activeProject, setActiveProjectState] = useState<string | null>(() => getActiveProject());
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [editorFile, setEditorFile] = useState<{ path: string; content: string } | null>(null);
  const DEFAULT_PANEL_PX = 620;
  type PreviewPanel = {
    id: string;
    projectName: string | null;
    port: number;
    logs: LogEntry[];
    key: number;
    loading: boolean;
    widthPx: number;
    showDiagnoseBanner: boolean;
    diagnoseFixCycleCount: number;
    diagnoseStuck: boolean;
  };
  const [previewPanels, setPreviewPanels] = useState<PreviewPanel[]>([]);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const activePanel = previewPanels.find(p => p.id === activePanelId) ?? previewPanels[0] ?? null;
  const previewPort = activePanel?.port ?? null;
  const showPreviewEmbed = previewPanels.length > 0;
  const [previewExpanded, setPreviewExpanded] = useState(false);
  useEffect(() => { if (previewPanels.length === 0) setPreviewExpanded(false); }, [previewPanels.length]);
  const { setRightPanelCount, setRightWallWidthPx, enabled: parallaxEnabled, setFocusedWall } = useParallax();
  useEffect(() => { setRightPanelCount(previewPanels.length); }, [previewPanels.length, setRightPanelCount]);
  useEffect(() => {
    const total = previewPanels.reduce((sum, p) => sum + (p.widthPx > 0 ? p.widthPx : DEFAULT_PANEL_PX), 0);
    setRightWallWidthPx(previewPanels.length > 0 ? total : 0);
  }, [previewPanels, setRightWallWidthPx]);
  useEffect(() => {
    const el = innerRowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setPanelAreaWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setPanelAreaWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const previewLoading = activePanel?.loading ?? false;
  const previewKey = activePanel?.key ?? 0;
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const panelContainerRef = useRef<HTMLDivElement>(null);
  const innerRowRef = useRef<HTMLDivElement>(null);
  const [panelAreaWidth, setPanelAreaWidth] = useState(0);
  const autoStartPreviewRef = useRef<string | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionState, setEvolutionState] = useState<EvolutionState | null>(null);
  const [currentPlan, setCurrentPlan] = useState<EvolutionPlan | null>(loadEvolutionPlan());
  const [isEvolutionResponse, setIsEvolutionResponse] = useState(false);
  const lastFullResponseRef = useRef<string>('');
  const [toasterAvailability, setToasterAvailability] = useState<ToasterAvailability | null>(null);
  const [toasterConfig, setToasterConfig] = useState<OllamaToasterConfig>(() => loadToasterConfig());
  const [lastToasterAnalysis, setLastToasterAnalysis] = useState<ToasterAnalysis | null>(null);
  const [toasterLoading, setToasterLoading] = useState(false);
  const [toasterReadyMsg, setToasterReadyMsg] = useState<string | null>(null);
  const [resolvedModelName, setResolvedModelName] = useState<string | null>(null);
  const [testedModelName, setTestedModelName] = useState<string | null>(null);
  const [toasterTestPending, setToasterTestPending] = useState(false);
  const [toasterChatOpen, setToasterChatOpen] = useState(false);
  const [toasterChatInput, setToasterChatInput] = useState('');
  const [toasterChatMessages, setToasterChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [toasterChatPending, setToasterChatPending] = useState(false);
  const toasterChatInputRef = useRef<HTMLInputElement>(null);
  const toasterChatScrollRef = useRef<HTMLDivElement>(null);
  const previewLogs = activePanel?.logs ?? [];
  const [githubImportProgress, setGithubImportProgress] = useState<GitHubImportProgress | null>(null);
  const [detectedRepoUrl, setDetectedRepoUrl] = useState<string | null>(null);
  const [pendingNewProject, setPendingNewProject] = useState<string | null>(null);
  const [pendingNewProjectMode, setPendingNewProjectMode] = useState<'starter' | 'fresh'>('starter');
  const showDiagnoseBanner = activePanel?.showDiagnoseBanner ?? false;
  const diagnoseFixCycleCount = activePanel?.diagnoseFixCycleCount ?? 0;
  const diagnoseStuck = activePanel?.diagnoseStuck ?? false;
  const [postApplyMonitoring, setPostApplyMonitoring] = useState(false);
  const [publishProgress, setPublishProgress] = useState<PublishProgress | null>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishDescription, setPublishDescription] = useState('');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSharedPat, setSettingsSharedPat] = useState(() => getGuardianConfig().sharedPat);
  const [settingsUserPat, setSettingsUserPat] = useState(() => getGuardianConfig().userPat || '');
  const [settingsOllamaEndpoint, setSettingsOllamaEndpoint] = useState(() => loadToasterConfig().endpoint);
  const [settingsOllamaModel, setSettingsOllamaModel] = useState(() => loadToasterConfig().model);
  const [knowledgeMatches, setKnowledgeMatches] = useState<KnowledgeMatch[]>([]);
  const lastAppliedFilesRef = useRef<{ filePath: string; code: string }[]>([]);
  const preApplyErrorCountRef = useRef(0);
  const postApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cleanedApiBlocks, setCleanedApiBlocks] = useState<Map<number, ParsedBlock[]>>(new Map());
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [quickActionsLoading, setQuickActionsLoading] = useState(false);
  const validationContextRef = useRef<ValidationContext>({});

  const refreshValidationContext = useCallback(async () => {
    if (!activeProject) { validationContextRef.current = {}; return; }
    try {
      const tree = await getProjectFiles(activeProject);
      const flatPaths: string[] = [];
      const collectPaths = (nodes: ProjectFileNode[], prefix = '') => {
        for (const n of nodes) {
          const p = prefix ? `${prefix}/${n.name}` : n.name;
          if (n.type === 'file') flatPaths.push(p);
          if (n.children) collectPaths(n.children, p);
        }
      };
      collectPaths(tree);
      validationContextRef.current.projectFiles = flatPaths;

      try {
        const pkgContent = await readProjectFile(activeProject, 'package.json');
        validationContextRef.current.packageJson = JSON.parse(pkgContent);
      } catch {
        validationContextRef.current.packageJson = undefined;
      }
    } catch {
      validationContextRef.current = {};
    }
  }, [activeProject]);

  useEffect(() => { refreshValidationContext(); }, [activeProject, refreshValidationContext]);

  useEffect(() => {
    if (!import.meta.hot) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handler = (_data: any) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setPreviewPanels(prev => prev.map(p => ({ ...p, key: p.key + 1 })));
      }, 1500);
    };
    import.meta.hot.on("lamby:files-changed", handler);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      import.meta.hot!.off("lamby:files-changed", handler);
    };
  }, []);

  const updatePanelById = useCallback((panelId: string, updates: Partial<PreviewPanel>) => {
    setPreviewPanels(prev => prev.map(p => p.id === panelId ? { ...p, ...updates } : p));
  }, []);

  const updateActivePanel = useCallback((updates: Partial<PreviewPanel>) => {
    const pid = activePanelId ?? previewPanels[0]?.id;
    if (!pid) return;
    setPreviewPanels(prev => prev.map(p => p.id === pid ? { ...p, ...updates } : p));
  }, [activePanelId, previewPanels]);

  const setShowDiagnoseBanner = useCallback((v: boolean) => updateActivePanel({ showDiagnoseBanner: v }), [updateActivePanel]);
  const setDiagnoseFixCycleCount = useCallback((v: number | ((prev: number) => number)) => {
    setPreviewPanels(prev => {
      const pid = activePanelId ?? prev[0]?.id;
      if (!pid) return prev;
      return prev.map(p => p.id === pid ? { ...p, diagnoseFixCycleCount: typeof v === 'function' ? v(p.diagnoseFixCycleCount) : v } : p);
    });
  }, [activePanelId]);
  const setDiagnoseStuck = useCallback((v: boolean) => updateActivePanel({ diagnoseStuck: v }), [updateActivePanel]);

  const addPanel = useCallback((panel: PreviewPanel) => {
    setPreviewPanels(prev => {
      if (prev.length === 0) {
        return [{ ...panel, widthPx: 0 }];
      }
      const children = Array.from(panelContainerRef.current?.children ?? []) as HTMLElement[];
      const lockedPrev = prev.map((p, i) => {
        const el = children.find(c => c.dataset.panelId === p.id);
        const measuredW = el ? el.getBoundingClientRect().width : p.widthPx;
        return { ...p, widthPx: measuredW > 0 ? measuredW : DEFAULT_PANEL_PX };
      });
      return [...lockedPrev, { ...panel, widthPx: DEFAULT_PANEL_PX }];
    });
    setActivePanelId(panel.id);
  }, []);

  const removePanel = useCallback((panelId: string) => {
    autoStartPreviewRef.current = null;
    setPreviewPanels(prev => {
      const idx = prev.findIndex(p => p.id === panelId);
      const next = prev.filter(p => p.id !== panelId);
      if (next.length === 0) {
        setActivePanelId(null);
        setFocusedWall('center');
        return [];
      }
      const successor = next[Math.min(idx, next.length - 1)];
      setActivePanelId(curId => {
        if (curId === panelId) {
          setActiveProjectState(successor.projectName);
          persistActiveProject(successor.projectName);
          return successor.id;
        }
        return curId;
      });
      return next;
    });
  }, [setFocusedWall]);

  const closePanel = useCallback(async (panelId: string) => {
    const panel = previewPanels.find(p => p.id === panelId);
    if (panel && panel.projectName && panel.port > 0) {
      try {
        await fetch('/api/projects/stop-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: panel.projectName }),
        });
      } catch {}
    }
    removePanel(panelId);
  }, [previewPanels, removePanel]);

  const removePanelsByProject = useCallback((projectName: string) => {
    autoStartPreviewRef.current = null;
    const toRemove = previewPanels.filter(p => p.projectName === projectName);
    toRemove.forEach(p => {
      if (p.port > 0) {
        fetch('/api/projects/stop-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName }),
        }).catch(() => {});
      }
    });
    const ids = new Set(toRemove.map(p => p.id));
    setPreviewPanels(prev => {
      const next = prev.filter(p => !ids.has(p.id));
      if (next.length === 0) {
        setActivePanelId(null);
        setActiveProjectState(null);
        persistActiveProject(null);
        setFocusedWall('center');
        return [];
      }
      setActivePanelId(curId => {
        if (curId && ids.has(curId)) {
          const successor = next[0];
          setActiveProjectState(successor.projectName);
          persistActiveProject(successor.projectName);
          return successor.id;
        }
        return curId;
      });
      return next;
    });
  }, [previewPanels, setFocusedWall]);

  const panelForProject = useCallback((projectName: string | null): PreviewPanel | undefined => {
    return previewPanels.find(p => p.projectName === projectName);
  }, [previewPanels]);

  const openPanelNames = previewPanels.map(p => p.projectName);

  const bumpActivePanelKey = useCallback(() => {
    setPreviewPanels(prev => {
      const pid = activePanelId ?? prev[0]?.id;
      if (!pid) return prev;
      return prev.map(p => p.id === pid ? { ...p, key: p.key + 1 } : p);
    });
  }, [activePanelId]);

  const addPreviewLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    const pid = activePanelId ?? previewPanels[0]?.id;
    if (!pid) return;
    setPreviewPanels(prev => prev.map(p => {
      if (p.id !== pid) return p;
      const newEntry: LogEntry = { ...entry, id: crypto.randomUUID() };
      const updated = [...p.logs, newEntry];
      return { ...p, logs: updated.length > MAX_LOG_ENTRIES ? updated.slice(updated.length - MAX_LOG_ENTRIES) : updated };
    }));
  }, [activePanelId, previewPanels]);

  const clearPreviewLogs = useCallback(() => {
    updateActivePanel({ logs: [] });
  }, [updateActivePanel]);

  const cleanupAutonomousTimers = useCallback(() => {
    if (autonomousTimerRef.current) { clearTimeout(autonomousTimerRef.current); autonomousTimerRef.current = null; }
    if (autonomousCountdownRef.current) { clearInterval(autonomousCountdownRef.current); autonomousCountdownRef.current = null; }
    if (autonomousCheckTimerRef.current) { clearTimeout(autonomousCheckTimerRef.current); autonomousCheckTimerRef.current = null; }
    if (webviewPollRef.current) { clearTimeout(webviewPollRef.current); webviewPollRef.current = null; }
    operationLockRef.current = false;
  }, []);

  const stopAutonomousLoop = useCallback(() => {
    cleanupAutonomousTimers();
    if (postApplyTimerRef.current) { clearTimeout(postApplyTimerRef.current); postApplyTimerRef.current = null; }
    setPostApplyMonitoring(false);
    dispatchAutonomous({ type: 'STOP' });
  }, [cleanupAutonomousTimers]);

  const startAutonomousBackoff = useCallback((attempt: number) => {
    const seconds = getBackoffSeconds(attempt - 1);
    dispatchAutonomous({ type: 'WAIT_START', seconds });
    if (autonomousCountdownRef.current) clearInterval(autonomousCountdownRef.current);
    let remaining = seconds;
    autonomousCountdownRef.current = setInterval(() => {
      remaining--;
      dispatchAutonomous({ type: 'WAIT_TICK' });
      if (remaining <= 0) {
        if (autonomousCountdownRef.current) { clearInterval(autonomousCountdownRef.current); autonomousCountdownRef.current = null; }
        dispatchAutonomous({ type: 'WAIT_DONE' });
      }
    }, 1000);
  }, []);

  const startPostApplyMonitoring = useCallback((appliedFiles: { filePath: string; code: string }[]) => {
    if (postApplyTimerRef.current) clearTimeout(postApplyTimerRef.current);
    lastAppliedFilesRef.current = appliedFiles;
    preApplyErrorCountRef.current = previewLogs.filter(l => l.level === 'error' && !isInfrastructureNoise(l.message)).length;
    setPostApplyMonitoring(true);
    setShowDiagnoseBanner(false);
    if (autonomousState.enabled) {
      dispatchAutonomous({ type: 'CHECK_START' });
    }
    setTimeout(() => {
      preApplyErrorCountRef.current = previewLogs.filter(l => l.level === 'error' && !isInfrastructureNoise(l.message)).length;
    }, 3500);
    postApplyTimerRef.current = setTimeout(() => {
      setPostApplyMonitoring(false);
      if (autonomousState.enabled && autonomousState.phase !== 'success' && autonomousState.phase !== 'failed') {
        const currentErrorCount = previewLogs.filter(l => l.level === 'error' && !isInfrastructureNoise(l.message)).length;
        if (currentErrorCount <= preApplyErrorCountRef.current) {
          dispatchAutonomous({ type: 'NO_ERRORS' });
          setStatusMessage('Autonomous loop: No errors detected — done!');
          cleanupAutonomousTimers();
        }
      }
    }, 8500);
  }, [previewLogs, autonomousState.enabled, autonomousState.phase, cleanupAutonomousTimers]);

  useEffect(() => {
    if (!postApplyMonitoring) return;
    const currentErrorCount = previewLogs.filter(l => l.level === 'error' && !isInfrastructureNoise(l.message)).length;
    if (currentErrorCount > preApplyErrorCountRef.current) {
      if (postApplyTimerRef.current) clearTimeout(postApplyTimerRef.current);
      setPostApplyMonitoring(false);

      if (autonomousState.enabled && autonomousState.phase !== 'success' && autonomousState.phase !== 'failed') {
        const errorMsgs = previewLogs.filter(l => l.level === 'error' && !isInfrastructureNoise(l.message)).slice(-5).map(e => e.message);
        dispatchAutonomous({ type: 'ERRORS_FOUND', errors: errorMsgs });
        const nextAttempt = autonomousState.attempt + 1;
        if (nextAttempt < autonomousState.maxAttempts) {
          startAutonomousBackoff(nextAttempt);
        }
        return;
      }

      if (diagnoseFixCycleCount >= 3) {
        setDiagnoseStuck(true);
        setShowDiagnoseBanner(true);
      } else {
        setShowDiagnoseBanner(true);
        setDiagnoseStuck(false);
      }
    }
  }, [previewLogs, postApplyMonitoring, diagnoseFixCycleCount, autonomousState.enabled, autonomousState.phase, autonomousState.attempt, autonomousState.maxAttempts, startAutonomousBackoff]);

  useEffect(() => {
    return () => {
      if (postApplyTimerRef.current) clearTimeout(postApplyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => cleanupAutonomousTimers();
  }, [cleanupAutonomousTimers]);

  const buildDiagnoseFixPrompt = useCallback(async (targetPanelId?: string) => {
    const targetPanel = targetPanelId ? previewPanels.find(p => p.id === targetPanelId) : activePanel;
    const panelLogs = targetPanel?.logs ?? previewLogs;
    const errorLogs = panelLogs.filter(l => (l.level === 'error' || l.level === 'warn') && !isInfrastructureNoise(l.message));
    const relevantLogs = errorLogs.length > 0 ? errorLogs.slice(-20) : panelLogs.filter(l => !isInfrastructureNoise(l.message)).slice(-20);

    let prompt = `The app preview just failed after applying changes. Here are the exact console/build logs:\n\n`;
    prompt += `=== CONSOLE LOGS (${relevantLogs.length} entries, errors/warnings prioritized) ===\n`;
    for (const log of relevantLogs) {
      const time = new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      prompt += `[${time}] [${log.level.toUpperCase()}] ${log.message}\n`;
      if (log.stack) {
        prompt += `  Stack: ${log.stack.split('\n').slice(0, 5).join('\n  ')}\n`;
      }
      if (log.source) {
        prompt += `  Source: ${log.source}${log.line ? `:${log.line}` : ''}${log.column ? `:${log.column}` : ''}\n`;
      }
    }
    prompt += `=== END LOGS ===\n\n`;

    const diagnoseProject = targetPanel?.projectName ?? activeProject;
    const freshDiag = await fetchFreshBridgeEndpoints(diagnoseProject || activeProject || '');
    const diagBridgeOnline = freshDiag.online && !!freshDiag.cmdUrl;

    const appliedFiles = lastAppliedFilesRef.current;
    if (appliedFiles.length > 0) {
      if (diagBridgeOnline) {
        prompt += `Recently changed files (use the API to read their current content):\n`;
        for (const file of appliedFiles) {
          prompt += `- ${file.filePath}\n`;
        }
        prompt += `\n`;
      } else {
        prompt += `Current files that were changed:\n\n`;
        for (const file of appliedFiles) {
          if (diagnoseProject) {
            try {
              const content = await readProjectFile(diagnoseProject, file.filePath);
              if (content.length < 8000) {
                prompt += `=== ${file.filePath} ===\n${content}\n\n`;
              } else {
                prompt += `=== ${file.filePath} (truncated) ===\n${content.slice(0, 8000)}\n...(truncated)\n\n`;
              }
            } catch {
              prompt += `=== ${file.filePath} (applied content) ===\n${file.code.slice(0, 8000)}\n\n`;
            }
          } else {
            prompt += `=== ${file.filePath} (applied content) ===\n${file.code.slice(0, 8000)}\n\n`;
          }
        }
      }
    }

    const lastResponse = lastFullResponseRef.current;
    if (lastResponse) {
      const snippet = lastResponse.slice(0, 2000);
      prompt += `Previous suggestion from you was:\n${snippet}${lastResponse.length > 2000 ? '\n...(truncated)' : ''}\n\n`;
    }

    if (visionEnabled && isElectron) {
      const panelPort = targetPanel?.port;
      if (panelPort && panelPort > 0) {
        await new Promise(r => setTimeout(r, 4000));
        let visionResult = null;
        for (let visionRetry = 0; visionRetry < 2; visionRetry++) {
          try {
            setVisionAnalyzing(true);
            visionResult = await captureAndDescribe(panelPort, autonomousState.originalGoal || undefined);
            if (visionResult && visionResult.description) break;
          } catch (visionErr: any) {
            console.warn(`[Vision] capture attempt ${visionRetry + 1} failed:`, visionErr?.message);
            if (visionRetry < 1) await new Promise(r => setTimeout(r, 1000));
          }
        }
        setVisionAnalyzing(false);
        if (visionResult && visionResult.description && !visionResult.description.toLowerCase().includes('no visual issues')) {
          prompt += `=== VISUAL ANALYSIS (screenshot analyzed by local vision model) ===\n${visionResult.description}\n=== END VISUAL ANALYSIS ===\n\n`;
        }
      }
    }

    const diagnoseApiSection = buildSandboxApiSection(freshDiag.snapUrl, freshDiag.cmdUrl, diagnoseProject || activeProject || '', freshDiag.online, freshDiag.proxyUrl, freshDiag.editUrl);
    if (diagnoseApiSection) {
      prompt += diagnoseApiSection + '\n';
    }

    if (freshDiag.cmdUrl) {
      prompt += `YOU MUST USE THE SANDBOX API TO FIX THIS. Follow this exact workflow:\n`;
      prompt += `1. read_file each file mentioned in the error stack traces above to see their CURRENT state\n`;
      prompt += `2. grep for the broken symbol/function if the root cause isn't obvious\n`;
      prompt += `3. Diagnose the root cause by cross-referencing errors with the source code\n`;
      prompt += `4. write_file with the corrected content for every file that needs fixing\n`;
      prompt += `5. run_command to verify the fix (e.g. a quick node -e check or build command)\n`;
      prompt += `6. Fetch console logs to confirm errors are resolved\n\n`;
      prompt += `Respond with a \`\`\`json code block containing {"actions": [...]} so Lamby auto-executes your fix.\n`;
      prompt += `Do NOT just describe the fix in text — actually apply it via the API.\n\n`;
    } else {
      prompt += `Fix the issue and provide updated code blocks for affected files only.\n`;
      prompt += `Use this format for each file:\n`;
      prompt += `// file: path/to/file.tsx\n\`\`\`tsx\n// corrected content\n\`\`\`\n`;
    }

    return prompt;
  }, [previewPanels, activePanel, previewLogs, activeProject, visionEnabled, autonomousState.originalGoal]);

  const handleVisionCapture = useCallback(async () => {
    if (!isElectron) { setStatusMessage('Vision capture requires Electron'); return; }
    const panel = activePanel;
    const port = panel?.port;
    if (!port || port <= 0) { setStatusMessage('No active preview to capture'); return; }
    setVisionAnalyzing(true);
    setStatusMessage('Capturing preview screenshot...');
    try {
      const result = await captureAndDescribe(port, autonomousState.originalGoal || undefined);
      if (!result) { setStatusMessage('Screenshot capture failed — is a preview running?'); return; }
      if (result.description.toLowerCase().includes('no visual issues')) {
        setStatusMessage('Vision: No visual issues detected');
      } else {
        let visionPrompt = `I analyzed a screenshot of the app preview and found these visual issues:\n\n${result.description}\n\n`;
        const freshVis = await fetchFreshBridgeEndpoints(activeProject || '');
        const visionApiSection = buildSandboxApiSection(freshVis.snapUrl, freshVis.cmdUrl, activeProject || '', freshVis.online, freshVis.proxyUrl, freshVis.editUrl);
        if (visionApiSection) visionPrompt += visionApiSection;
        if (freshVis.cmdUrl) {
          visionPrompt += `USE THE SANDBOX API to fix these visual issues. Follow this workflow:\n`;
          visionPrompt += `1. read_file the CSS/component files responsible for the broken layout or styling\n`;
          visionPrompt += `2. grep for relevant class names, styles, or component references\n`;
          visionPrompt += `3. write_file with corrected styles, classes, or JSX structure\n`;
          visionPrompt += `4. run_command or check console logs to verify no build errors after your fix\n`;
          visionPrompt += `Respond with a \`\`\`json code block containing {"actions": [...]} so Lamby auto-executes your fix.\n`;
        } else {
          visionPrompt += `Please fix these visual problems. Provide updated code blocks for affected files.`;
        }
        if (mode === 'api') {
          setInput(visionPrompt);
          setStatusMessage('Vision analysis injected into chat — send to fix visual issues');
        } else {
          try {
            if (isElectron) {
              const { clipboard } = (window as any).require('electron');
              clipboard.writeText(visionPrompt);
            } else {
              await navigator.clipboard.writeText(visionPrompt);
            }
            setStatusMessage('Vision analysis copied to clipboard — paste into Grok');
          } catch {
            setStatusMessage('Could not copy vision analysis');
          }
        }
      }
    } catch (e: any) {
      setStatusMessage(`Vision capture failed: ${e.message}`);
    } finally {
      setVisionAnalyzing(false);
    }
  }, [activePanel, mode, autonomousState.originalGoal, activeProject]);

  const handleDiagnoseFix = useCallback(async (targetPanelId?: string) => {
    const targetPanel = targetPanelId ? previewPanels.find(p => p.id === targetPanelId) : activePanel;
    if (targetPanel?.diagnoseStuck) return;
    const prompt = await buildDiagnoseFixPrompt(targetPanelId);
    if (targetPanelId) {
      updatePanelById(targetPanelId, { diagnoseFixCycleCount: (targetPanel?.diagnoseFixCycleCount ?? 0) + 1 });
    } else {
      setDiagnoseFixCycleCount(prev => prev + 1);
    }

    if (mode === 'api' && inputRef.current) {
      setInput(prompt);
      if (targetPanelId) {
        updatePanelById(targetPanelId, { showDiagnoseBanner: false });
      } else {
        setShowDiagnoseBanner(false);
      }
      return;
    }

    try {
      if (isElectron) {
        const { clipboard } = (window as any).require('electron');
        clipboard.writeText(prompt);
      } else {
        await navigator.clipboard.writeText(prompt);
      }
      setStatusMessage('Diagnostic prompt copied to clipboard — paste into Grok');
      if (targetPanelId) {
        updatePanelById(targetPanelId, { showDiagnoseBanner: false });
      } else {
        setShowDiagnoseBanner(false);
      }
    } catch {
      setStatusMessage('Could not copy diagnostic prompt');
    }
  }, [previewPanels, activePanel, buildDiagnoseFixPrompt, mode]);

  const dismissDiagnoseBanner = useCallback((targetPanelId?: string) => {
    if (targetPanelId) {
      updatePanelById(targetPanelId, { showDiagnoseBanner: false, diagnoseStuck: false, diagnoseFixCycleCount: 0 });
    } else {
      setShowDiagnoseBanner(false);
      setDiagnoseStuck(false);
      setDiagnoseFixCycleCount(0);
    }
  }, []);

  const ipcWithTimeout = useCallback(async (ipcRenderer: any, channel: string, ...args: any[]): Promise<any> => {
    return Promise.race([
      ipcRenderer.invoke(channel, ...args),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`IPC ${channel} timed out (3s)`)), 3000)),
    ]);
  }, []);

  const sendPromptToWebview = useCallback(async (prompt: string, statusLabel: string): Promise<boolean> => {
    console.log(`[BROWSER-MODE][${BROWSER_MODE_VERSION}] sendPromptToWebview called: "${statusLabel}", promptLen=${prompt.length}`);
    if (operationLockRef.current) {
      console.log('[BROWSER-MODE] BLOCKED: operation lock held');
      setStatusMessage('Another operation is in progress — waiting...');
      return false;
    }
    if (!isElectron) {
      console.log('[BROWSER-MODE] Not in Electron — clipboard fallback');
      try {
        await navigator.clipboard.writeText(prompt);
        setStatusMessage(`${statusLabel} copied to clipboard — paste into Grok`);
      } catch {
        setStatusMessage('Could not copy prompt to clipboard');
      }
      return false;
    }
    operationLockRef.current = true;
    const ipcRenderer = (window as any).require('electron').ipcRenderer;
    try {
      console.log('[BROWSER-MODE] Calling grok-send-prompt IPC...');
      const sendResult = await ipcWithTimeout(ipcRenderer, 'grok-send-prompt', prompt);
      console.log(`[BROWSER-MODE] grok-send-prompt result: success=${sendResult.success}, baseline: msgs=${sendResult.preMessageCount}, copy=${sendResult.preCopyCount}, reactions=${sendResult.preReactionCount}, followUps=${sendResult.preFollowUpCount}, error=${sendResult.error || 'none'}`);
      if (!sendResult.success) throw new Error(sendResult.error || 'Send failed');
      const signalBaseline = {
        preMessageCount: typeof sendResult.preMessageCount === 'number' ? sendResult.preMessageCount : 0,
        preCopyCount: typeof sendResult.preCopyCount === 'number' ? sendResult.preCopyCount : 0,
        preReactionCount: typeof sendResult.preReactionCount === 'number' ? sendResult.preReactionCount : 0,
        preFollowUpCount: typeof sendResult.preFollowUpCount === 'number' ? sendResult.preFollowUpCount : 0,
      };
      setStatusMessage(`${statusLabel} — waiting for Grok response...`);
      if (webviewPollRef.current) { clearTimeout(webviewPollRef.current); webviewPollRef.current = null; }

      const BACKOFF_INTERVALS = [2000, 3000, 4500, 7000, 10000, 15000];
      const MAX_ELAPSED_MS = 15 * 60 * 1000;
      const POST_SEND_DELAY = 1500;
      const startTime = Date.now();
      let pollIndex = 0;
      let wasGenerating = false;

      const handleReadyResponse = async () => {
        console.log('[BROWSER-MODE] Response READY — calling grok-copy-last-response...');
        try {
          const extractResult = await ipcWithTimeout(ipcRenderer, 'grok-copy-last-response');
          console.log(`[BROWSER-MODE] grok-copy-last-response: success=${extractResult.success}, textLen=${extractResult.text ? extractResult.text.length : 0}, findMethod="${extractResult.findMethod || 'n/a'}", error=${extractResult.error || 'none'}`);
          if (extractResult.success && extractResult.text) {
            console.log(`[BROWSER-MODE] Response captured: ${extractResult.text.length} chars, first 100: "${extractResult.text.substring(0, 100)}..."`);
            setStatusMessage(`Grok response captured (${extractResult.text.length} chars) — processing...`);
            lastFullResponseRef.current = extractResult.text;
            if (injectExtractorTextRef.current) {
              console.log('[BROWSER-MODE] Injecting text into ClipboardExtractor');
              injectExtractorTextRef.current(extractResult.text);
            }
            if (processWebviewResponseRef.current) {
              console.log('[BROWSER-MODE] Processing response via processWebviewResponseRef');
              processWebviewResponseRef.current(extractResult.text);
            }
          } else if (extractResult.success) {
            console.log('[BROWSER-MODE] Old Electron detected — no text field in response');
            setStatusMessage('Grok response ready — update Electron to enable direct capture');
          } else {
            console.log(`[BROWSER-MODE] Extraction failed: ${extractResult.error}`);
            setStatusMessage(`Could not extract response: ${extractResult.error || 'unknown error'}`);
          }
        } catch (err: any) {
          console.error(`[BROWSER-MODE] Response extraction exception: ${err?.message}`);
          setStatusMessage(`Response extraction failed: ${err?.message || 'unknown'}`);
        }
        operationLockRef.current = false;
      };

      const schedulePoll = () => {
        const delay = pollIndex === 0 ? POST_SEND_DELAY : (BACKOFF_INTERVALS[Math.min(pollIndex - 1, BACKOFF_INTERVALS.length - 1)]);
        const intervalLabel = pollIndex === 0 ? 'initial delay' : `${(delay / 1000).toFixed(1)}s`;
        webviewPollRef.current = setTimeout(async () => {
          webviewPollRef.current = null;
          const elapsed = Date.now() - startTime;
          if (elapsed > MAX_ELAPSED_MS) {
            console.log('[BROWSER-MODE] TIMEOUT: 15min elapsed, falling back to clipboard');
            setStatusMessage('Grok still thinking after 15 min — falling back to clipboard');
            try {
              const { clipboard } = (window as any).require('electron');
              clipboard.writeText(prompt);
            } catch {}
            operationLockRef.current = false;
            return;
          }
          try {
            const state = await ipcWithTimeout(ipcRenderer, 'grok-check-response-ready', signalBaseline);
            const ipcVersion = state.version || 'unknown';
            const signalsInfo = state.signals || 'none';
            console.log(`[BROWSER-MODE] Poll #${pollIndex}: ready=${state.ready}, generating=${state.generating}, signals="${signalsInfo}", stopDebug="${state.stopDebug || ''}", ipcVersion=${ipcVersion}, elapsed=${Math.floor(elapsed/1000)}s`);
            if (ipcVersion !== 'unknown' && ipcVersion !== BROWSER_MODE_VERSION) {
              console.warn(`[BROWSER-MODE] VERSION MISMATCH: React=${BROWSER_MODE_VERSION}, Electron=${ipcVersion} — rebuild Electron!`);
            }

            if (state.ready) {
              await handleReadyResponse();
              return;
            }

            if (state.generating) {
              wasGenerating = true;
              const elapsedSec = Math.floor(elapsed / 1000);
              const debugInfo = state.stopDebug ? ` [${state.stopDebug}]` : '';
              const versionTag = ipcVersion !== 'unknown' && ipcVersion !== BROWSER_MODE_VERSION ? ` VERSION MISMATCH (Electron:${ipcVersion})` : '';
              setStatusMessage(`Grok is generating response... (${elapsedSec}s, next check in ${intervalLabel})${debugInfo}${versionTag}`);
            } else if (wasGenerating && !state.generating) {
              console.log('[BROWSER-MODE] Stop button transition detected (was generating, now stopped) — NOT extracting yet, waiting for concrete done signal');
              const elapsedSec = Math.floor(elapsed / 1000);
              setStatusMessage(`Grok may be finishing — waiting for confirmation signal... (${elapsedSec}s)`);
            } else {
              const elapsedSec = Math.floor(elapsed / 1000);
              setStatusMessage(`Waiting for NEW Grok signals... (${elapsedSec}s, current: ${signalsInfo})`);
            }
          } catch (pollErr: any) {
            console.error(`[BROWSER-MODE] Poll error: ${pollErr?.message}`);
            setStatusMessage('Webview poll error — retrying...');
          }
          pollIndex++;
          schedulePoll();
        }, delay);
      };
      schedulePoll();
      return true;
    } catch (e: any) {
      console.error(`[BROWSER-MODE] sendPromptToWebview failed: ${e.message}`);
      operationLockRef.current = false;
      setStatusMessage(`Webview send failed (${e.message}) — falling back to clipboard`);
      try {
        const { clipboard } = (window as any).require('electron');
        clipboard.writeText(prompt);
      } catch {}
      return false;
    }
  }, [ipcWithTimeout]);

  const manualWatcherRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const manualWatchBaselineRef = useRef<{ preCopyCount: number; preReactionCount: number; preFollowUpCount: number } | null>(null);

  useEffect(() => {
    if (!isElectron) return;
    if (!autoDetectEnabled) {
      if (manualWatcherRef.current) { clearInterval(manualWatcherRef.current); manualWatcherRef.current = null; }
      return;
    }
    const ipcRenderer = (window as any).require('electron').ipcRenderer;
    const WATCH_INTERVAL = 3000;

    manualWatcherRef.current = setInterval(async () => {
      if (operationLockRef.current || webviewPollRef.current) return;

      try {
        const snap = await ipcWithTimeout(ipcRenderer, 'grok-snapshot-baseline');
        if (!snap.success) return;

        if (snap.generating) {
          console.log(`[BROWSER-MODE] Manual send detected — Grok is generating! Snapshotting baseline and starting poll...`);
          setStatusMessage('Manual Grok input detected — watching for response...');
          operationLockRef.current = true;
          manualWatchBaselineRef.current = {
            preCopyCount: snap.preCopyCount || 0,
            preReactionCount: snap.preReactionCount || 0,
            preFollowUpCount: snap.preFollowUpCount || 0,
          };
          const signalBaseline = manualWatchBaselineRef.current;

          const BACKOFF_INTERVALS = [2000, 3000, 4500, 7000, 10000, 15000];
          const MAX_ELAPSED_MS = 15 * 60 * 1000;
          const startTime = Date.now();
          let pollIndex = 0;
          let wasGenerating = true;

          const handleReadyResponse = async () => {
            console.log('[BROWSER-MODE][MANUAL] Response READY — extracting...');
            try {
              const extractResult = await ipcWithTimeout(ipcRenderer, 'grok-copy-last-response');
              console.log(`[BROWSER-MODE][MANUAL] grok-copy-last-response: success=${extractResult.success}, textLen=${extractResult.text ? extractResult.text.length : 0}`);
              if (extractResult.success && extractResult.text) {
                setStatusMessage(`Manual Grok response captured (${extractResult.text.length} chars) — processing...`);
                lastFullResponseRef.current = extractResult.text;
                if (injectExtractorTextRef.current) {
                  injectExtractorTextRef.current(extractResult.text);
                }
                if (processWebviewResponseRef.current) {
                  processWebviewResponseRef.current(extractResult.text);
                }
              } else {
                setStatusMessage(`Could not extract manual response: ${extractResult.error || 'unknown'}`);
              }
            } catch (err: any) {
              console.error(`[BROWSER-MODE][MANUAL] Extraction error: ${err?.message}`);
              setStatusMessage(`Manual response extraction failed: ${err?.message || 'unknown'}`);
            }
            operationLockRef.current = false;
          };

          const schedulePoll = () => {
            const delay = BACKOFF_INTERVALS[Math.min(pollIndex, BACKOFF_INTERVALS.length - 1)];
            webviewPollRef.current = setTimeout(async () => {
              webviewPollRef.current = null;
              const elapsed = Date.now() - startTime;
              if (elapsed > MAX_ELAPSED_MS) {
                console.log('[BROWSER-MODE][MANUAL] TIMEOUT: 15min elapsed');
                setStatusMessage('Manual Grok response timed out after 15 min');
                operationLockRef.current = false;
                return;
              }
              try {
                const state = await ipcWithTimeout(ipcRenderer, 'grok-check-response-ready', signalBaseline);
                const signalsInfo = state.signals || 'none';
                console.log(`[BROWSER-MODE][MANUAL] Poll #${pollIndex}: ready=${state.ready}, generating=${state.generating}, signals="${signalsInfo}", elapsed=${Math.floor(elapsed/1000)}s`);

                if (state.ready) {
                  await handleReadyResponse();
                  return;
                }

                if (state.generating) {
                  wasGenerating = true;
                  const elapsedSec = Math.floor(elapsed / 1000);
                  setStatusMessage(`Watching manual Grok response... (${elapsedSec}s)`);
                } else if (wasGenerating) {
                  const elapsedSec = Math.floor(elapsed / 1000);
                  setStatusMessage(`Grok may be finishing — waiting for confirmation... (${elapsedSec}s)`);
                } else {
                  const elapsedSec = Math.floor(elapsed / 1000);
                  setStatusMessage(`Waiting for manual Grok signals... (${elapsedSec}s, ${signalsInfo})`);
                }
              } catch (pollErr: any) {
                console.error(`[BROWSER-MODE][MANUAL] Poll error: ${pollErr?.message}`);
              }
              pollIndex++;
              schedulePoll();
            }, delay);
          };
          schedulePoll();
        }
      } catch {}
    }, WATCH_INTERVAL);

    return () => {
      if (manualWatcherRef.current) {
        clearInterval(manualWatcherRef.current);
        manualWatcherRef.current = null;
      }
    };
  }, [ipcWithTimeout, autoDetectEnabled]);

  useEffect(() => {
    const ipc = (window as any).electronAPI;
    if (!ipc) return;

    (window as any).__grokBrowserAutomation = {
      sendAndCapture: async (prompt: string, label: string): Promise<{ success: boolean; responseText?: string; error?: string }> => {
        return new Promise(async (resolve) => {
          let resolved = false;

          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              console.log('[BROWSER-AUTOMATION] Timeout after 15min');
              resolve({ success: false, error: 'Browser automation timed out (15min)' });
            }
          }, 15 * 60 * 1000);

          try {
            console.log(`[BROWSER-AUTOMATION] Sending prompt (${prompt.length} chars) — ${label}`);
            const sendResult = await ipc.invoke('grok-send-prompt', prompt);
            if (!sendResult?.success) {
              clearTimeout(timeout);
              resolve({ success: false, error: sendResult?.error || 'Failed to send prompt to Grok webview' });
              return;
            }

            const signalBaseline = {
              preCopyCount: sendResult.preCopyCount ?? sendResult.signalBaseline?.copyButtons ?? 0,
              preReactionCount: sendResult.preReactionCount ?? sendResult.signalBaseline?.reactionButtons ?? 0,
              preFollowUpCount: sendResult.preFollowUpCount ?? sendResult.signalBaseline?.followUpButtons ?? 0,
            };
            console.log('[BROWSER-AUTOMATION] Signal baseline from send:', JSON.stringify(signalBaseline));

            const pollForReady = async () => {
              const POLL_INTERVAL = 3000;
              const poll = async () => {
                if (resolved) return;
                try {
                  const ready = await ipc.invoke('grok-check-response-ready', signalBaseline);
                  console.log(`[BROWSER-AUTOMATION] Poll: ready=${ready?.ready}, generating=${ready?.generating}, signals=${JSON.stringify(ready?.signals || {})}`);
                  if (ready?.ready) {
                    const extracted = await ipc.invoke('grok-extract-response');
                    if (extracted?.text && !resolved) {
                      resolved = true;
                      clearTimeout(timeout);
                      console.log(`[BROWSER-AUTOMATION] Captured response: ${extracted.text.length} chars`);
                      resolve({ success: true, responseText: extracted.text });
                      return;
                    }
                  }
                } catch (e) {
                  console.log('[BROWSER-AUTOMATION] Poll error:', e);
                }
                if (!resolved) setTimeout(poll, POLL_INTERVAL);
              };
              poll();
            };
            pollForReady();
          } catch (err: any) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve({ success: false, error: err?.message || 'Send failed' });
            }
          }
        });
      },
    };
  }, []);

  const autonomousSendFixPrompt = useCallback(async () => {
    const fixPrompt = await buildDiagnoseFixPrompt();
    const goalPrefix = `[Autonomous Fix — Attempt ${autonomousState.attempt}/${autonomousState.maxAttempts}]\nOriginal goal: ${autonomousState.originalGoal}\n\n`;
    const fullPrompt = goalPrefix + fixPrompt;

    if (mode === 'api') {
      setInput(fullPrompt);
      if (autonomousTimerRef.current) clearTimeout(autonomousTimerRef.current);
      autonomousTimerRef.current = setTimeout(() => {
        autonomousTimerRef.current = null;
        sendMessageRef.current?.();
      }, 100);
    } else {
      const sent = await sendPromptToWebview(fullPrompt, `Autonomous fix sent (attempt ${autonomousState.attempt}/${autonomousState.maxAttempts})`);
      if (!sent && !isElectron) {
        stopAutonomousLoop();
      }
    }
  }, [buildDiagnoseFixPrompt, autonomousState, mode, stopAutonomousLoop, sendPromptToWebview]);

  useEffect(() => {
    if (autonomousState.phase === 'prompting' && autonomousState.enabled) {
      autonomousSendFixPrompt();
    }
  }, [autonomousState.phase, autonomousState.enabled]);

  useEffect(() => {
    if (autonomousState.phase === 'failed') {
      cleanupAutonomousTimers();
      setStatusMessage(`Autonomous loop: ${autonomousState.maxAttempts} attempts exhausted — needs manual help`);
    }
  }, [autonomousState.phase, cleanupAutonomousTimers]);

  const handleSendLogsToGrok = useCallback(async (formattedPrompt: string) => {
    let enrichedPrompt = formattedPrompt;
    const freshLogs = await fetchFreshBridgeEndpoints(activeProject || '');
    const logsApiSection = buildSandboxApiSection(freshLogs.snapUrl, freshLogs.cmdUrl, activeProject || '', freshLogs.online, freshLogs.proxyUrl, freshLogs.editUrl);
    if (logsApiSection) {
      enrichedPrompt += logsApiSection;
    }
    if (freshLogs.cmdUrl) {
      enrichedPrompt += `\nYOU HAVE FULL READ/WRITE ACCESS to this project via the Sandbox API above.\n`;
      enrichedPrompt += `Use it to investigate and fix the errors shown in these logs:\n`;
      enrichedPrompt += `1. read_file the files referenced in the error traces\n`;
      enrichedPrompt += `2. grep for the broken symbol if needed\n`;
      enrichedPrompt += `3. write_file with corrected code\n`;
      enrichedPrompt += `4. run_command to verify the fix compiles\n`;
      enrichedPrompt += `5. Fetch fresh console logs to confirm the fix\n`;
      enrichedPrompt += `Respond with \`\`\`json {"actions": [...]} so Lamby auto-executes your fix.\n`;
    }
    try {
      if (isElectron) {
        const { clipboard } = (window as any).require('electron');
        clipboard.writeText(enrichedPrompt);
      } else {
        await navigator.clipboard.writeText(enrichedPrompt);
      }
      setStatusMessage('Diagnostic logs copied to clipboard — paste into Grok');
    } catch {
      setStatusMessage('Could not copy logs to clipboard');
    }
  }, [activeProject]);

  useEffect(() => {
    const handlePreviewMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'lamby-console-bridge') return;
      const { level, args, stack, source, line, column } = event.data;
      const validLevels = ['error', 'warn', 'log', 'info'];
      const logLevel = validLevels.includes(level) ? level : 'log';
      const message = Array.isArray(args)
        ? args.map((a: any) => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')
        : String(args || '');
      const newEntry: LogEntry = {
        id: crypto.randomUUID(),
        level: logLevel,
        message,
        timestamp: Date.now(),
        stack: stack || undefined,
        source: source || undefined,
        line: line || undefined,
        column: column || undefined,
      };
      setPreviewPanels(prev => {
        let targetId: string | null = null;
        const iframes = document.querySelectorAll('iframe[data-panel-id]');
        for (const iframe of iframes) {
          if ((iframe as HTMLIFrameElement).contentWindow === event.source) {
            targetId = iframe.getAttribute('data-panel-id');
            break;
          }
        }
        if (!targetId) targetId = activePanelId ?? prev[0]?.id ?? null;
        if (!targetId) return prev;
        return prev.map(p => {
          if (p.id !== targetId) return p;
          const updated = [...p.logs, newEntry];
          return { ...p, logs: updated.length > MAX_LOG_ENTRIES ? updated.slice(updated.length - MAX_LOG_ENTRIES) : updated };
        });
      });
    };
    window.addEventListener('message', handlePreviewMessage);
    return () => window.removeEventListener('message', handlePreviewMessage);
  }, [activePanelId]);

  const toasterMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toasterTestIdRef = useRef(0);
  const fireToasterReadyTest = useCallback(async (cfg: OllamaToasterConfig) => {
    if (toasterMsgTimerRef.current) clearTimeout(toasterMsgTimerRef.current);
    const testId = ++toasterTestIdRef.current;
    setToasterTestPending(true);
    setTestedModelName(null);
    setToasterReadyMsg('Pinging toaster...');
    try {
      const model = await resolveModel(cfg);
      if (testId !== toasterTestIdRef.current) return;
      setResolvedModelName(model);
      setToasterReadyMsg(`Loading ${model}...`);
      const result = await toasterReadyTest(cfg, model);
      if (testId !== toasterTestIdRef.current) return;
      console.log('[Toaster] Ready test response:', result.message, '(model:', result.model, ')');
      setTestedModelName(result.model);
      setToasterReadyMsg(result.message);
      toasterMsgTimerRef.current = setTimeout(() => setToasterReadyMsg(null), 10000);
    } catch (err: any) {
      if (testId !== toasterTestIdRef.current) return;
      console.error('[Toaster] Ready test failed:', err);
      setTestedModelName(null);
      setToasterReadyMsg(`Test failed: ${err.message || 'Unknown error'}`);
      toasterMsgTimerRef.current = setTimeout(() => setToasterReadyMsg(null), 8000);
    } finally {
      if (testId === toasterTestIdRef.current) {
        setToasterTestPending(false);
      }
    }
  }, []);

  useEffect(() => {
    checkToasterAvailability(toasterConfig).then(result => {
      setToasterAvailability(result);
      if (result.available) {
        fireToasterReadyTest(toasterConfig);
      }
    });
    checkVisionAvailable().then(setVisionAvailable);
  }, [toasterConfig, fireToasterReadyTest]);

  useEffect(() => {
    const poll = setInterval(async () => {
      clearAvailabilityCache();
      const result = await checkToasterAvailability(toasterConfig);
      setToasterAvailability(prev => {
        if (prev && prev.available !== result.available) {
          if (result.available) {
            setStatusMessage(`Toaster reconnected — ${result.models.slice(0, 2).join(', ')}`);
            fireToasterReadyTest(toasterConfig);
          } else {
            setStatusMessage(`Toaster disconnected${result.error ? ': ' + result.error : ''}`);
          }
        }
        return result;
      });
    }, 60_000);
    return () => clearInterval(poll);
  }, [toasterConfig, fireToasterReadyTest]);

  useEffect(() => {
    startKnowledgeRefreshLoop();
    return () => stopKnowledgeRefreshLoop();
  }, []);

  const handleEvolutionApply = useCallback(async (fullResponse: string, appliedFiles: string[]) => {
    if (!isEvolutionResponse || appliedFiles.length === 0) return;
    try {
      const state = evolutionState || await fetchEvolutionState();
      const result = await registerEvolutionResults(appliedFiles, fullResponse, state);
      setCurrentPlan(loadEvolutionPlan());
      const parts: string[] = [];
      if (result.capabilitiesRegistered.length > 0) parts.push(`${result.capabilitiesRegistered.length} capabilities registered`);
      if (result.planSaved) parts.push('next evolution plan saved');
      parts.push(`L${result.newLevel}`);
      setStatusMessage(`⚡ Evolution updated: ${parts.join(' · ')}`);
      const updatedState = await fetchEvolutionState();
      setEvolutionState(updatedState);
    } catch (e: any) {
      setStatusMessage(`⚠ Evolution tracking error: ${e.message}`);
    }
  }, [isEvolutionResponse, evolutionState]);

  const startMainAppPreview = useCallback(() => {
    const mainUrl = isElectron ? 'http://localhost:4999' : window.location.origin;
    (window as any).__mainAppPreviewUrl = mainUrl;
    const existing = previewPanels.find(p => p.projectName === null);
    if (existing) {
      setActivePanelId(existing.id);
      setStatusMessage('Main App preview focused');
    } else {
      addPanel({ id: crypto.randomUUID(), projectName: null, port: -1, logs: [], key: 0, loading: false, widthPx: 0, showDiagnoseBanner: false, diagnoseFixCycleCount: 0, diagnoseStuck: false });
      setStatusMessage('Main App preview loaded');
    }
  }, [previewPanels, addPanel]);

  const handleSelectProject = useCallback(async (name: string | null, isNewlyCreated?: boolean, createMode?: 'starter' | 'fresh') => {
    setActiveProjectState(name);
    persistActiveProject(name);
    setAppliedChanges([]);
    setProjectContext('');
    setEditorFile(null);
    setStatusMessage(name ? `Project: ${name}` : 'Switched to Main App');
    const existingPanel = previewPanels.find(p => p.projectName === (name ?? null));
    if (existingPanel) {
      setActivePanelId(existingPanel.id);
    } else if (name) {
      autoStartPreviewRef.current = name;
    } else {
      setTimeout(() => startMainAppPreview(), 0);
    }
    if (isNewlyCreated && name) {
      setPendingNewProjectMode(createMode || 'starter');
      setPendingNewProject(name);
    }
  }, [previewPanels, startMainAppPreview]);

  useEffect(() => {
    (window as any).__lambySelectProject = handleSelectProject;
    return () => { delete (window as any).__lambySelectProject; };
  }, [handleSelectProject]);

  const handleFileEdit = useCallback(async (filePath: string, content: string) => {
    setEditorFile({ path: filePath, content });
    setShowProjectPanel(true);
  }, []);

  const handleEditorSave = useCallback(async (filePath: string, content: string) => {
    if (activeProject) {
      await writeProjectFile(activeProject, filePath, content);
      const isConfigFile = ['vite.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'package.json', 'postcss.config.js', 'postcss.config.cjs'].includes(filePath);
      if (previewPort) {
        setTimeout(() => bumpActivePanelKey(), isConfigFile ? 2500 : 500);
      }
      setStatusMessage(`Saved ${filePath}`);
      buildProjectContext().catch(() => {});
    } else if (isElectron) {
      const { ipcRenderer } = (window as any).require('electron');
      await ipcRenderer.invoke('write-file', { filePath, content });
      setStatusMessage(`Saved ${filePath}`);
    } else {
      await writeProjectFile('__main__', filePath, content);
      setStatusMessage(`Saved ${filePath}`);
    }
  }, [activeProject, previewPort]);

  const handleEditorClose = useCallback(() => {
    setEditorFile(null);
  }, []);

  const handleEditorSendToGrok = useCallback(async (prompt: string) => {
    let enriched = prompt;
    const freshEd = await fetchFreshBridgeEndpoints(activeProject || '');
    const editorApiSection = buildSandboxApiSection(freshEd.snapUrl, freshEd.cmdUrl, activeProject || '', freshEd.online, freshEd.proxyUrl, freshEd.editUrl);
    if (editorApiSection) enriched += editorApiSection;
    if (freshEd.cmdUrl) {
      enriched += `\nUse the Sandbox API above to read, modify, and write files directly. Respond with \`\`\`json {"actions": [...]} so Lamby auto-executes your changes.\n`;
    }
    if (mode === 'api') {
      setInput(enriched);
      inputRef.current?.focus();
    } else {
      navigator.clipboard.writeText(enriched).then(() => {
        setStatusMessage('File prompt copied to clipboard — paste into Grok');
      }).catch(() => {
        setStatusMessage('Could not copy file prompt to clipboard');
      });
    }
  }, [mode, activeProject]);

  const handleGitHubImport = useCallback(async (repoUrl: string) => {
    if (operationLockRef.current) {
      setStatusMessage('Another operation is in progress — clone queued');
      return;
    }
    operationLockRef.current = true;
    setDetectedRepoUrl(null);
    setGithubImportProgress({ stage: 'fetching-tree', message: 'Cloning repository...' });
    try {
      const result = await importFromGitHub(repoUrl, (progress) => {
        setGithubImportProgress(progress);
      }, activeProject || undefined);
      operationLockRef.current = false;
      setGithubImportProgress({
        stage: 'done',
        message: `Imported ${result.projectName} — switching to project`,
        repoName: result.projectName,
      });
      handleSelectProject(result.projectName);
      window.dispatchEvent(new CustomEvent('lamby-refresh-files', { detail: { projectName: result.projectName } }));
      setTimeout(() => setGithubImportProgress(null), 4000);
    } catch (e: any) {
      operationLockRef.current = false;
      setGithubImportProgress({ stage: 'error', message: e.message || 'Import failed' });
      setTimeout(() => setGithubImportProgress(null), 6000);
      if (autonomousState.enabled && autonomousState.phase !== 'failed') {
        const errorMsg = e.message || 'Import failed';
        const retryPrompt = `The suggested repo "${repoUrl}" failed to clone.\nError: ${errorMsg}\n\nSuggest a DIFFERENT public GitHub repo that:\n- Is a working, maintained project\n- Runs in a browser and works with Vite dev server\n- Prefer TypeScript, Tailwind CSS, high stars, MIT license\n\nProvide the full GitHub URL for the replacement repo.`;
        dispatchAutonomous({ type: 'ERRORS_FOUND', errors: [`Clone failed: ${errorMsg}`] });
        if (mode === 'api') {
          setInput(retryPrompt);
          setTimeout(() => sendMessageRef.current?.(), 300);
        } else {
          sendPromptToWebview(retryPrompt, `Clone failed — asking Grok for alternative repo`);
        }
      }
    }
  }, [handleSelectProject, activeProject, autonomousState, mode, sendPromptToWebview]);

  const handleReplaceRepo = useCallback(async (repoUrl: string) => {
    if (activeProject) {
      if (previewPort) {
        try { await fetch('/api/projects/stop-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: activeProject }) }); } catch {}
      }
      try {
        await deleteProject(activeProject);
      } catch {
      }
      if (activeProject) removePanelsByProject(activeProject);
      setAppliedChanges([]);
      setEditorFile(null);
    }
    handleGitHubImport(repoUrl);
  }, [activeProject, previewPort, removePanelsByProject, handleGitHubImport]);

  const handlePublish = useCallback(async () => {
    if (!activeProject || !publishDescription.trim()) return;
    const cfg = getGuardianConfig();
    if (!hasPublishCredentials(cfg)) {
      setStatusMessage('No GitHub PAT configured. Add one in Settings first.');
      return;
    }
    setPublishedUrl(null);
    try {
      const result = await publishProject(activeProject, publishDescription.trim(), (progress) => {
        setPublishProgress(progress);
      }, undefined, cfg);
      setPublishedUrl(result.repoUrl);
      setStatusMessage(`Published ${activeProject} to ${result.repoUrl} (${result.filesPublished} files)`);
      setShowPublishDialog(false);
      setTimeout(() => { setPublishProgress(null); setPublishedUrl(null); }, 8000);
    } catch (e: any) {
      setPublishProgress({ stage: 'error', message: e.message || 'Publish failed' });
      setTimeout(() => setPublishProgress(null), 8000);
    }
  }, [activeProject, publishDescription]);

  const startPreview = useCallback(async () => {
    if (!activeProject) return;
    const panelId = crypto.randomUUID();
    const existingPanel = previewPanels.find(p => p.projectName === activeProject);
    const targetId = existingPanel?.id ?? panelId;
    if (existingPanel) {
      updatePanelById(existingPanel.id, { loading: true, logs: [], key: existingPanel.key + 1 });
    } else {
      addPanel({ id: panelId, projectName: activeProject, port: 0, logs: [], key: 0, loading: true, widthPx: 0, showDiagnoseBanner: false, diagnoseFixCycleCount: 0, diagnoseStuck: false });
    }
    try {
      try {
        await fetch('/api/projects/stop-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: activeProject }),
        });
      } catch {}
      if (isElectron) {
        try {
          const { ipcRenderer } = (window as any).require('electron');
          await ipcRenderer.invoke('ensure-project-polling', { projectName: activeProject });
        } catch {}
      }
      const res = await fetch('/api/projects/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: activeProject }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.openTerminal) {
          setStatusMessage(data.message || `${data.projectType} project detected`);
          const logEntry: LogEntry = { id: crypto.randomUUID(), level: data.launched ? 'info' : 'warn', message: `[Project] ${data.message || 'Non-web project detected'}${data.executables ? ` — Files: ${data.executables.map((e: any) => e.name).join(', ')}` : ''}${data.runCommand ? ` — Command: ${data.runCommand}` : ''}`, timestamp: Date.now() };
          setPreviewPanels(prev => prev.map(p => p.id === targetId ? { ...p, logs: [...p.logs, logEntry], loading: false } : p));
        } else if (data.started === false && data.error) {
          setStatusMessage(`Preview failed: ${data.error.slice(0, 200)}`);
          const errLog: LogEntry = { id: crypto.randomUUID(), level: 'error', message: `[Server] ${data.detectedCommand || 'unknown command'}: ${data.error}`, timestamp: Date.now() };
          const outputLog: LogEntry | null = data.output ? { id: crypto.randomUUID(), level: 'warn', message: `[Server Output] ${data.output.slice(0, 1000)}`, timestamp: Date.now() } : null;
          setPreviewPanels(prev => prev.map(p => p.id === targetId ? { ...p, logs: [...p.logs, errLog, ...(outputLog ? [outputLog] : [])], loading: false } : p));
        } else {
          const extra = data.detectedCommand ? ` (${data.detectedCommand})` : '';
          const pmInfo = data.packageManager && data.packageManager !== 'npm' ? ` [${data.packageManager}]` : '';
          setStatusMessage(`Preview started on port ${data.port}${extra}${pmInfo}`);
          setPreviewPanels(prev => prev.map(p => p.id === targetId ? { ...p, port: data.port, key: p.key + 1, loading: false } : p));
        }
      } else {
        const errData = await res.json().catch(() => ({} as any));
        const errMsg = errData.error || res.statusText || 'Unknown error';
        setStatusMessage(`Failed to start preview: ${errMsg}`);
        const errLog: LogEntry = { id: crypto.randomUUID(), level: 'error', message: `[Preview] Failed to start: ${errMsg}`, timestamp: Date.now() };
        setPreviewPanels(prev => prev.map(p => p.id === targetId ? { ...p, logs: [...p.logs, errLog], loading: false } : p));
      }
    } catch (e: any) {
      setStatusMessage(`Preview error: ${e.message}`);
      const errLog: LogEntry = { id: crypto.randomUUID(), level: 'error', message: `[Preview] ${e.message}`, timestamp: Date.now() };
      setPreviewPanels(prev => prev.map(p => p.id === targetId ? { ...p, logs: [...p.logs, errLog], loading: false } : p));
    }
  }, [activeProject, previewPanels, addPanel, updatePanelById]);

  const stopPreview = useCallback(async () => {
    if (!activeProject) return;
    const panel = previewPanels.find(p => p.projectName === activeProject);
    if (panel) {
      try {
        await fetch('/api/projects/stop-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: activeProject }),
        });
      } catch {}
      removePanel(panel.id);
    }
  }, [activeProject, previewPanels, removePanel]);

  useEffect(() => {
    if (autoStartPreviewRef.current && activeProject === autoStartPreviewRef.current) {
      const name = autoStartPreviewRef.current;
      autoStartPreviewRef.current = null;
      const delay = setTimeout(() => startPreview(), 3000);
      return () => clearTimeout(delay);
    }
  }, [activeProject, startPreview]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { saveConversations(conversations); }, [conversations]);

  const newConversation = useCallback(() => {
    const convo: Conversation = { id: crypto.randomUUID(), title: 'New conversation', messages: [], model, createdAt: Date.now() };
    setConversations(prev => [convo, ...prev]);
    setActiveConvoId(convo.id);
    setMessages([]);
    setAppliedChanges([]);
    setValidationResults(new Map());
  }, [model]);

  const switchConversation = useCallback((id: string) => {
    if (activeConvoId && messages.length > 0) {
      setConversations(prev => prev.map(c => c.id === activeConvoId ? { ...c, messages, title: generateTitle(messages) } : c));
    }
    const convo = conversations.find(c => c.id === id);
    if (convo) { setActiveConvoId(id); setMessages(convo.messages); setModel(convo.model); setAppliedChanges([]); }
  }, [activeConvoId, messages, conversations]);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) { setActiveConvoId(null); setMessages([]); }
  }, [activeConvoId]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    if (autonomousState.enabled && autonomousState.phase === 'idle') {
      dispatchAutonomous({ type: 'START', goal: text });
    }

    const matches = searchKnowledge(text);
    setKnowledgeMatches(matches);

    let enrichedText = text;
    const isNewProject = !!pendingNewProject || !activeProject;
    if (messages.length === 0) {
      if (matches.length > 0) {
        enrichedText = text + '\n\n' + formatKnowledgeForGrokPrompt(matches);
      } else if (isNewProject && pendingNewProjectMode !== 'fresh') {
        enrichedText = text + '\n\n=== REPO SELECTION ===\nActive project: ' + (activeProject || 'none') + ' (newly created, empty)\nFor this new project, suggest ONE public GitHub repo as a starting point — provide the full URL.\nChoose whatever framework or tech stack best fits the user\'s request. The only requirement is it must run in a browser and be previewable via Vite dev server (no native-only or backend-only repos).\nPrefer: TypeScript, Tailwind CSS, high stars, MIT license. Start fresh only if no repo fits.\nLamby source (scan for capabilities): https://github.com/aidenrichtwitter-glitch/guardian-ai\n=== END REPO SELECTION ===';
      }
    }
    if (pendingNewProject) setPendingNewProject(null);

    const userMsg: Msg = { role: 'user', content: enrichedText };
    setInput('');
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setIsLoading(true);
    let convoId = activeConvoId;
    if (!convoId) {
      convoId = crypto.randomUUID();
      const convo: Conversation = { id: convoId, title: text.slice(0, 50), messages: [], model, createdAt: Date.now() };
      setConversations(prev => [convo, ...prev]);
      setActiveConvoId(convoId);
    }
    let assistantSoFar = '';
    const freshBridge = await fetchFreshBridgeEndpoints(activeProject || '');
    const useFunctionCalling = freshBridge.online && !!activeProject && mode === 'api';

    const onDeltaHandler = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    const onDoneHandler = () => {
      setIsLoading(false);
      const msgIndex = allMessages.length;
      setConversations(prev => prev.map(c => c.id === convoId ? { ...c, messages: [...allMessages, { role: 'assistant' as const, content: assistantSoFar }], title: generateTitle(allMessages), model } : c));
      lastFullResponseRef.current = assistantSoFar;
      const repoMatch = detectGitHubUrlInResponse(assistantSoFar);
      if (repoMatch && !assistantSoFar.toLowerCase().includes('starting fresh')) {
        setDetectedRepoUrl(repoMatch.fullUrl);
        setStatusMessage(`Grok suggested repo: ${repoMatch.owner}/${repoMatch.repo} — click to clone`);
        if (autoApplyEnabled && activeProject) {
          getProjectFiles(activeProject).then(tree => {
            const flatFiles: string[] = [];
            const walk = (nodes: ProjectFileNode[], prefix = '') => {
              for (const n of nodes) {
                const p = prefix ? `${prefix}/${n.name}` : n.name;
                if (n.type === 'file') flatFiles.push(p);
                if (n.children) walk(n.children, p);
              }
            };
            walk(tree);
            const sourceFiles = flatFiles.filter(f => !['package.json', 'package-lock.json'].includes(f));
            if (sourceFiles.length === 0) {
              setStatusMessage(`Auto-cloning ${repoMatch.owner}/${repoMatch.repo}...`);
              handleGitHubImport(repoMatch.fullUrl);
            } else if (autonomousState.enabled && assistantSoFar.toLowerCase().includes('suggest') && assistantSoFar.toLowerCase().includes('repo')) {
              setStatusMessage(`Replacing repo with ${repoMatch.owner}/${repoMatch.repo}...`);
              handleReplaceRepo(repoMatch.fullUrl);
            }
          }).catch(() => {});
        }
      }
      const regexBlocks = parseCodeBlocks(assistantSoFar);
      if (autoApplyEnabled && activeProject && regexBlocks.length > 0) {
        const validBlocks = regexBlocks.filter(b => b.filePath);
        if (validBlocks.length > 0) {
          if (autonomousState.enabled) dispatchAutonomous({ type: 'APPLY_START' });
          autoApplyBlocks(validBlocks).then(applied => {
            if (applied) {
              startPostApplyMonitoring(validBlocks);
            } else {
              setStatusMessage('Auto-apply skipped (safety checks failed) — review manually');
              if (autonomousState.enabled) stopAutonomousLoop();
            }
          }).catch(() => {
            if (autonomousState.enabled) stopAutonomousLoop();
          });
        }
      }

      if (toasterAvailability?.available) {
        cleanGrokResponse(assistantSoFar, toasterConfig).then(cleaned => {
          if (cleaned && cleaned.files.length > 0) {
            const ollamaBlocks = cleanedResponseToBlocks(cleaned);
            if (ollamaBlocks.length > 0) {
              const hasMorePaths = ollamaBlocks.filter(b => b.filePath).length >= regexBlocks.filter(b => b.filePath).length;
              if (hasMorePaths) {
                setCleanedApiBlocks(prev => new Map(prev).set(msgIndex, ollamaBlocks));
              }
            }
          }
          if (cleaned?.unparsed_text) {
            const extraDeps = parseDependencies(cleaned.unparsed_text);
            if (extraDeps.dependencies.length > 0 || extraDeps.devDependencies.length > 0) {
              setDetectedDeps(prev => ({
                dependencies: [...new Set([...prev.dependencies, ...extraDeps.dependencies])],
                devDependencies: [...new Set([...prev.devDependencies, ...extraDeps.devDependencies])],
              }));
            }
            const extraActions = parseActionItems(cleaned.unparsed_text);
            if (extraActions.length > 0) {
              setActionItems(prev => [...prev, ...extraActions]);
            }
          }
        }).catch(err => console.error('[Toaster] API mode cleanGrokResponse failed:', err));
      }
    };

    const onErrorHandler = (err: string) => { setIsLoading(false); setStatusMessage(`⚠ ${err}`); };

    if (useFunctionCalling) {
      const relayBase = extractBaseUrl(freshBridge.cmdUrl || freshBridge.snapUrl || '');
      setStatusMessage('🔧 Using function calling mode (Grok can execute tools directly)');
      await streamGrokFC({
        messages: allMessages, model, project: activeProject || '',
        bridgeRelayUrl: relayBase,
        systemPrompt: `You are Grok, an autonomous AI coding assistant inside Lamby IDE. You have access to function tools that let you directly read files, write files, run commands, take screenshots, and more on the user's project "${activeProject}". Use these tools to fulfill the user's request. Always take a screenshot after making visual changes to show the result. When you use tools, the results are automatically fed back to you — you do NOT need to browse URLs or use browse_page.`,
        onDelta: onDeltaHandler,
        onStatus: (status) => setStatusMessage(status),
        onDone: onDoneHandler,
        onError: onErrorHandler,
      });
    } else {
      await streamGrok({
        messages: allMessages, model,
        onDelta: onDeltaHandler,
        onDone: onDoneHandler,
        onError: onErrorHandler,
      });
    }
  }, [input, isLoading, messages, model, activeConvoId, toasterConfig, toasterAvailability, autonomousState.enabled, autonomousState.phase, stopAutonomousLoop, pendingNewProject, pendingNewProjectMode, activeProject, handleReplaceRepo, mode]);

  sendMessageRef.current = sendMessage;

  useEffect(() => {
    if (!pendingNewProject) return;
    const projectName = pendingNewProject.replace(/-/g, ' ');
    const isFresh = pendingNewProjectMode === 'fresh';

    if (mode === 'api') {
      setInput(isFresh ? `Build a ${projectName} app from scratch — generate all code directly, do not use any starter repo` : `Build a ${projectName} app`);
      setMessages([]);
      setActiveConvoId(null);
      if (!autoApplyEnabled) {
        setAutoApplyEnabled(true);
        localStorage.setItem('lamby-auto-apply', 'true');
      }
      setTimeout(() => {
        sendMessageRef.current?.();
      }, 300);
    } else {
      const prompt = isFresh
        ? `Build a ${projectName} app from scratch — generate all the code directly, do not suggest a GitHub repo. Create all necessary files (package.json, index.html, src/, etc.) from zero.`
        : `Build a ${projectName} app\n\n=== REPO SELECTION ===\nActive project: ${pendingNewProject} (newly created, empty)\nFor this new project, suggest ONE public GitHub repo as a starting point — provide the full URL.\nChoose whatever framework or tech stack best fits the user\'s request. The only requirement is it must run in a browser and be previewable via Vite dev server (no native-only or backend-only repos).\nPrefer: TypeScript, Tailwind CSS, high stars, MIT license. Start fresh only if no repo fits.\nLamby source (scan for capabilities): https://github.com/aidenrichtwitter-glitch/guardian-ai\n=== END REPO SELECTION ===`;
      setMessages([]);
      setActiveConvoId(null);
      if (!autoApplyEnabled) {
        setAutoApplyEnabled(true);
        localStorage.setItem('lamby-auto-apply', 'true');
      }
      dispatchAutonomous({ type: 'START', goal: `Build a ${projectName} app` });
      setPendingNewProject(null);
      sendPromptToWebview(prompt, isFresh ? `Asking Grok to build "${projectName}" from scratch` : `Asking Grok for repo suggestion for "${projectName}"`);
    }
  }, [pendingNewProject, pendingNewProjectMode, mode, sendPromptToWebview]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const runValidation = useCallback((blockKey: string, code: string, filePath: string) => {
    const checks = validateChange(code, filePath || 'unknown.ts', undefined, validationContextRef.current);
    setValidationResults(prev => new Map(prev).set(blockKey, checks));
  }, []);

  const toggleAutoApply = useCallback((val: boolean) => {
    setAutoApplyEnabled(val);
    localStorage.setItem('lamby-auto-apply', val ? 'true' : 'false');
  }, []);

  const undoAutoApply = useCallback(async () => {
    if (autoApplyUndoTimerRef.current) { clearTimeout(autoApplyUndoTimerRef.current); autoApplyUndoTimerRef.current = null; }
    setAutoApplyUndoVisible(false);
    const backups = autoApplyBackupsRef.current;
    if (backups.length === 0) return;
    try {
      for (const b of backups) {
        if (activeProject) {
          await writeProjectFile(activeProject, b.filePath, b.oldContent);
        } else if (isElectron) {
          const { ipcRenderer } = (window as any).require('electron');
          await ipcRenderer.invoke('write-file', { filePath: b.filePath, content: b.oldContent });
        }
      }
      setStatusMessage(`Undid auto-apply of ${backups.length} file${backups.length > 1 ? 's' : ''}`);
      autoApplyBackupsRef.current = [];
      if (previewPort) setTimeout(() => bumpActivePanelKey(), 500);
    } catch (e: any) {
      setStatusMessage(`Undo failed: ${e.message}`);
    }
  }, [activeProject, previewPort]);

  const autoApplyBlocks = useCallback(async (blocks: { filePath: string; code: string }[]) => {
    if (!activeProject || blocks.length === 0) return false;
    const backups: { filePath: string; oldContent: string; newContent: string }[] = [];
    const warnings: string[] = [];
    let hasErrors = false;

    for (const block of blocks) {
      let oldContent = '';
      try { oldContent = await readProjectFile(activeProject, block.filePath); } catch { oldContent = ''; }
      const checks = validateChange(block.code, block.filePath, oldContent, validationContextRef.current);
      const errors = checks.filter(c => c.severity === 'error');
      const warns = checks.filter(c => c.severity === 'warning');
      if (errors.length > 0) { hasErrors = true; break; }
      if (warns.length > 0) warnings.push(...warns.map(w => `${block.filePath}: ${w.message}`));
      const lineChanges = Math.abs(block.code.split('\n').length - oldContent.split('\n').length);
      if (lineChanges > 50) { hasErrors = true; break; }
      backups.push({ filePath: block.filePath, oldContent, newContent: block.code });
    }

    if (hasErrors) return false;

    try {
      for (const b of backups) {
        await writeProjectFile(activeProject, b.filePath, b.newContent);
      }
      autoApplyBackupsRef.current = backups;
      setAppliedChanges(prev => [...prev, ...backups.map(b => ({ filePath: `${activeProject}/${b.filePath}`, previousContent: b.oldContent, newContent: b.newContent, timestamp: Date.now() }))]);

      const warningText = warnings.length > 0 ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : '';
      setStatusMessage(`Auto-applied ${backups.length} file${backups.length > 1 ? 's' : ''}${warningText} — Undo available for 5s`);
      setAutoApplyUndoVisible(true);
      if (autoApplyUndoTimerRef.current) clearTimeout(autoApplyUndoTimerRef.current);
      autoApplyUndoTimerRef.current = setTimeout(() => { setAutoApplyUndoVisible(false); autoApplyBackupsRef.current = []; }, 5000);

      const hasConfigChanges = backups.some(b => ['vite.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'package.json', 'postcss.config.js', 'postcss.config.cjs'].includes(b.filePath));
      if (previewPort) setTimeout(() => bumpActivePanelKey(), hasConfigChanges ? 2500 : 500);
      buildProjectContext().catch(() => {});
      refreshValidationContext();
      refreshQuickActions();
      return true;
    } catch (e: any) {
      setStatusMessage(`Auto-apply failed: ${e.message}`);
      return false;
    }
  }, [activeProject, previewPort]);

  useEffect(() => {
    processWebviewResponseRef.current = (text: string) => {
      const repoMatch = detectGitHubUrlInResponse(text);
      if (repoMatch && !text.toLowerCase().includes('starting fresh')) {
        setDetectedRepoUrl(repoMatch.fullUrl);
        if (autoApplyEnabled && activeProject) {
          getProjectFiles(activeProject).then(tree => {
            const flatFiles: string[] = [];
            const walk = (nodes: ProjectFileNode[], prefix = '') => {
              for (const n of nodes) {
                const p = prefix ? `${prefix}/${n.name}` : n.name;
                if (n.type === 'file') flatFiles.push(p);
                if (n.children) walk(n.children, p);
              }
            };
            walk(tree);
            const sourceFiles = flatFiles.filter(f => !['package.json', 'package-lock.json'].includes(f));
            if (sourceFiles.length === 0) {
              setStatusMessage(`Auto-cloning ${repoMatch.owner}/${repoMatch.repo}...`);
              handleGitHubImport(repoMatch.fullUrl);
            } else if (autonomousState.enabled && text.toLowerCase().includes('suggest') && text.toLowerCase().includes('repo')) {
              setStatusMessage(`Replacing repo with ${repoMatch.owner}/${repoMatch.repo}...`);
              handleReplaceRepo(repoMatch.fullUrl);
            }
          }).catch(() => {});
        } else {
          setStatusMessage(`Grok suggested repo: ${repoMatch.owner}/${repoMatch.repo} — click to clone`);
        }
      }

      const regexBlocks = parseCodeBlocks(text);
      if (autoApplyEnabled && activeProject && regexBlocks.length > 0) {
        const validBlocks = regexBlocks.filter(b => b.filePath);
        if (validBlocks.length > 0) {
          if (autonomousState.enabled) dispatchAutonomous({ type: 'APPLY_START' });
          setStatusMessage(`Auto-applying ${validBlocks.length} file${validBlocks.length > 1 ? 's' : ''}...`);
          autoApplyBlocks(validBlocks).then(applied => {
            if (applied) {
              startPostApplyMonitoring(validBlocks);
            } else {
              setStatusMessage('Auto-apply skipped (safety checks failed) — review manually');
              if (autonomousState.enabled) stopAutonomousLoop();
            }
          }).catch(() => {
            if (autonomousState.enabled) stopAutonomousLoop();
          });
        } else {
          setStatusMessage(`Grok responded (${text.length} chars) — no file paths detected in code blocks`);
        }
      } else if (!repoMatch && regexBlocks.length === 0) {
        setStatusMessage(`Grok responded (${text.length} chars) — no code blocks or repo URLs found`);
      } else if (regexBlocks.length > 0 && !autoApplyEnabled) {
        setStatusMessage(`Grok responded — ${regexBlocks.length} code block${regexBlocks.length > 1 ? 's' : ''} ready to apply`);
      }
    };
  }, [autoApplyEnabled, activeProject, autonomousState.enabled, handleGitHubImport, handleReplaceRepo, autoApplyBlocks, startPostApplyMonitoring, stopAutonomousLoop]);

  const [pendingApply, setPendingApply] = useState<PendingApply | null>(null);
  const [applyStage, setApplyStage] = useState<ApplyStage>('confirm');
  const [applyStageMessage, setApplyStageMessage] = useState('');
  const [applyCompileError, setApplyCompileError] = useState('');
  const lastBackupPathRef = useRef('');

  const applyBlock = useCallback(async (filePath: string, code: string, editType?: 'full' | 'search-replace' | 'diff', searchCode?: string) => {
    if (!filePath) { setStatusMessage('⚠ No file path detected'); return; }

    let oldContent = '';
    let exists = false;

    try {
      if (activeProject) {
        try {
          oldContent = await readProjectFile(activeProject, filePath);
          exists = true;
        } catch {
          oldContent = '';
          exists = false;
        }
      } else if (isElectron) {
        const { ipcRenderer } = (window as any).require('electron');
        const readResult = await ipcRenderer.invoke('read-file', { filePath });
        if (!readResult.success) { setStatusMessage(`⚠ ${readResult.error}`); return; }
        oldContent = readResult.content || '';
        exists = readResult.exists ?? false;
      } else {
        const readRes = await fetch('/api/read-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath }),
        });
        const readData = await readRes.json();
        if (!readRes.ok || !readData.success) {
          setStatusMessage(`⚠ Could not read ${filePath}: ${readData.error || 'unknown error'}`);
          return;
        }
        oldContent = readData.content || '';
        exists = readData.exists ?? false;
      }
    } catch (e: any) {
      setStatusMessage(`⚠ ${e.message || 'Failed to read file'}`);
      return;
    }

    let finalContent = code;
    let mergeNote = '';

    if (editType === 'search-replace' && searchCode && exists) {
      const result = applySearchReplace(oldContent, searchCode, code);
      if (result !== null) {
        finalContent = result;
        mergeNote = ' (search/replace applied)';
      } else {
        mergeNote = ' ⚠ search pattern not found — applying as full replacement';
      }
    } else if (editType === 'diff' && exists) {
      const result = applyUnifiedDiff(oldContent, code);
      if (result !== null) {
        finalContent = result;
        mergeNote = ' (diff patch applied)';
      } else {
        mergeNote = ' ⚠ diff could not be applied — showing raw diff';
        setStatusMessage('⚠ Diff could not be applied to current file content');
        return;
      }
    } else if (exists && isLikelySnippet(code, oldContent) && filePath.endsWith('.css')) {
      const merged = mergeCSSVariables(code, oldContent);
      if (merged) {
        finalContent = merged;
        mergeNote = ' (smart-merged snippet into existing file)';
      }
    }

    const safetyChecks = validateChange(finalContent, filePath, oldContent, validationContextRef.current);
    setPendingApply({
      filePath,
      newContent: finalContent,
      oldContent,
      exists,
      safetyChecks,
    });
    setApplyStage('confirm');
    setApplyStageMessage(mergeNote);
    setApplyCompileError('');
    lastBackupPathRef.current = '';
  }, [activeProject]);

  const confirmApply = useCallback(async () => {
    if (!pendingApply) return;
    const { filePath, newContent, oldContent } = pendingApply;
    try {
      if (activeProject) {
        setApplyStage('writing');
        try {
          await writeProjectFile(activeProject, filePath, newContent);
        } catch (e: any) {
          setApplyStage('error');
          setApplyStageMessage(`Write failed: ${e.message}`);
          return;
        }
        const isConfigFile = ['vite.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'package.json', 'postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs', 'postcss.config.ts'].includes(filePath);
        if (previewPort && isConfigFile) {
          try {
            const restartRes = await fetch('/api/projects/restart-preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: activeProject }),
            });
            const restartData = await restartRes.json().catch(() => ({} as any));
            if (!restartData.restarted) {
              setStatusMessage(`Preview restart skipped: ${restartData.reason || 'unknown'}`);
            }
          } catch (restartErr: any) {
            setStatusMessage(`Preview restart failed: ${restartErr.message}`);
          }
        }
        if (previewPort && !isConfigFile) {
          setTimeout(() => bumpActivePanelKey(), 500);
        } else if (previewPort && isConfigFile) {
          setTimeout(() => bumpActivePanelKey(), 2500);
        }
        setApplyStage('done');
        setApplyStageMessage(`Written to ${activeProject}/${filePath}${previewPort ? (isConfigFile ? ' — preview restarting' : ' — HMR updating') : ''}`);
      } else if (isElectron) {
        const { ipcRenderer } = (window as any).require('electron');

        setApplyStage('writing');
        const writeResult = await ipcRenderer.invoke('write-file', { filePath, content: newContent });
        if (!writeResult.success) {
          setApplyStage('error');
          setApplyStageMessage(`Write failed: ${writeResult.error}`);
          return;
        }
        lastBackupPathRef.current = writeResult.backupPath || '';

        setApplyStage('checking');
        const compileResult = await ipcRenderer.invoke('check-compile', { filePath });
        if (compileResult.hasErrors) {
          setApplyStage('error');
          setApplyStageMessage('Compile errors detected — rollback recommended');
          setApplyCompileError(compileResult.errorText);
          return;
        }

        setApplyStage('committing');
        const commitResult = await ipcRenderer.invoke('git-commit', {
          filePath,
          message: `Lamby: apply suggestion to ${filePath}`,
        });

        setApplyStage('done');
        const gitNote = commitResult.success ? ' + committed' : ' (git: ' + (commitResult.error || 'skipped') + ')';
        setApplyStageMessage(`Written to ${filePath}${gitNote}`);
      } else {
        setApplyStage('writing');
        const writeRes = await fetch('/api/write-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath, content: newContent }),
        });
        const writeData = await writeRes.json();
        if (!writeRes.ok || !writeData.success) {
          setApplyStage('error');
          setApplyStageMessage(`Write failed: ${writeData.error || 'unknown error'}`);
          return;
        }

        setApplyStage('done');
        setApplyStageMessage(`Written to ${filePath} (${writeData.bytesWritten} bytes)`);
      }

      if (!activeProject) {
        const existing = SELF_SOURCE.find(f => f.path === filePath);
        if (existing) { existing.content = newContent; existing.isModified = true; existing.lastModified = Date.now(); }
        else {
          const name = filePath.split('/').pop() || filePath;
          const ext = name.split('.').pop() || 'ts';
          const langMap: Record<string, string> = { ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', css: 'css', json: 'json' };
          SELF_SOURCE.push({ name, path: filePath, content: newContent, language: langMap[ext] || 'plaintext', isModified: true, lastModified: Date.now() });
        }
      }

      setAppliedChanges(prev => [...prev, {
        filePath: activeProject ? `${activeProject}/${filePath}` : filePath,
        previousContent: oldContent,
        newContent,
        timestamp: Date.now(),
        backupPath: lastBackupPathRef.current,
      }]);

      if (previewPort) {
        startPostApplyMonitoring([{ filePath, code: newContent }]);
      }

      if (isEvolutionResponse && lastFullResponseRef.current) {
        handleEvolutionApply(lastFullResponseRef.current, [filePath]);
        setIsEvolutionResponse(false);
      }
    } catch (e: any) {
      setApplyStage('error');
      setApplyStageMessage(`Error: ${e.message || 'Unknown failure'}`);
    }
  }, [pendingApply, isEvolutionResponse, handleEvolutionApply, activeProject, previewPort, startPostApplyMonitoring]);

  const rollbackPending = useCallback(async () => {
    if (!pendingApply) { setPendingApply(null); return; }
    if (activeProject) {
      try {
        await writeProjectFile(activeProject, pendingApply.filePath, pendingApply.oldContent);
        setStatusMessage(`↩ Rolled back ${activeProject}/${pendingApply.filePath}`);
      } catch { setStatusMessage(`⚠ Rollback failed for ${pendingApply.filePath}`); }
      setPendingApply(null);
      return;
    }
    if (!isElectron) {
      try {
        await fetch('/api/write-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: pendingApply.filePath, content: pendingApply.oldContent }),
        });
        setStatusMessage(`↩ Rolled back ${pendingApply.filePath}`);
      } catch { setStatusMessage(`⚠ Rollback failed for ${pendingApply.filePath}`); }
      setPendingApply(null);
      return;
    }
    if (!lastBackupPathRef.current) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const check = await ipcRenderer.invoke('read-file', { filePath: pendingApply.filePath });
        if (check.success && check.exists) {
          const { ipcRenderer: ipc2 } = (window as any).require('electron');
          await ipc2.invoke('write-file', { filePath: pendingApply.filePath, content: '' });
        }
      } catch (_) {}
      setStatusMessage(`↩ Rolled back ${pendingApply.filePath} (new file removed)`);
      setPendingApply(null);
      return;
    }
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke('rollback-file', {
        filePath: pendingApply.filePath,
        backupPath: lastBackupPathRef.current,
      });
      if (result.success) {
        setStatusMessage(`↩ Rolled back ${pendingApply.filePath}`);
      } else {
        setStatusMessage(`⚠ Rollback failed: ${result.error}`);
      }
    } catch (e: any) {
      setStatusMessage(`⚠ Rollback error: ${e.message || 'Unknown'}`);
    }
    setPendingApply(null);
  }, [pendingApply]);

  const rollback = useCallback(async (change: AppliedChange) => {
    try {
      if (isElectron && change.backupPath) {
        const { ipcRenderer } = (window as any).require('electron');
        const result = await ipcRenderer.invoke('rollback-file', {
          filePath: change.filePath,
          backupPath: change.backupPath,
        });
        if (!result.success) {
          setStatusMessage(`⚠ Rollback failed: ${result.error}`);
          return;
        }
      }
      const file = SELF_SOURCE.find(f => f.path === change.filePath);
      if (file) { file.content = change.previousContent; file.isModified = true; file.lastModified = Date.now(); }
      setAppliedChanges(prev => prev.filter(c => c !== change));
      setStatusMessage(`↩ Rolled back ${change.filePath}`);
    } catch (e: any) {
      setStatusMessage(`⚠ Rollback error: ${e.message || 'Unknown'}`);
    }
  }, []);

  const [undoAllInProgress, setUndoAllInProgress] = useState(false);
  const undoAll = useCallback(async () => {
    if (appliedChanges.length === 0) return;
    setUndoAllInProgress(true);
    let restored = 0;
    const failedChanges: AppliedChange[] = [];
    const changesToUndo = [...appliedChanges].reverse();
    for (const change of changesToUndo) {
      try {
        if (activeProject) {
          const filePath = change.filePath.startsWith(activeProject + '/') ? change.filePath.slice(activeProject.length + 1) : change.filePath;
          await writeProjectFile(activeProject, filePath, change.previousContent);
          restored++;
        } else if (isElectron && change.backupPath) {
          const { ipcRenderer } = (window as any).require('electron');
          const result = await ipcRenderer.invoke('rollback-file', { filePath: change.filePath, backupPath: change.backupPath });
          if (result.success) { restored++; } else { failedChanges.push(change); }
        } else if (isElectron) {
          const { ipcRenderer } = (window as any).require('electron');
          await ipcRenderer.invoke('write-file', { filePath: change.filePath, content: change.previousContent });
          restored++;
        } else {
          await writeProjectFile('__main__', change.filePath, change.previousContent);
          restored++;
        }
        const file = SELF_SOURCE.find(f => f.path === change.filePath);
        if (file) { file.content = change.previousContent; file.isModified = true; file.lastModified = Date.now(); }
      } catch {
        failedChanges.push(change);
      }
    }
    setAppliedChanges(failedChanges);
    setUndoAllInProgress(false);
    setStatusMessage(`↩ Undid all — ${restored} file${restored !== 1 ? 's' : ''} restored${failedChanges.length > 0 ? `, ${failedChanges.length} failed (retry available)` : ''}`);
    if (previewPort) setTimeout(() => bumpActivePanelKey(), 1000);
  }, [appliedChanges, activeProject, previewPort]);

  const [clearRepoConfirm, setClearRepoConfirm] = useState(false);
  const clearRepo = useCallback(async () => {
    if (!activeProject) return;
    try {
      if (previewPort) {
        try {
          await fetch('/api/projects/stop-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: activeProject }),
          });
        } catch {}
      }
      await deleteProject(activeProject);
      setActiveProjectState(null);
      persistActiveProject(null);
      setAppliedChanges([]);
      if (activeProject) removePanelsByProject(activeProject);
      setProjectContext('');
      setEditorFile(null);
      setClearRepoConfirm(false);
      setStatusMessage('Repo cleared — ready for a new clone');
    } catch (e: any) {
      setStatusMessage(`⚠ Clear failed: ${e.message}`);
      setClearRepoConfirm(false);
    }
  }, [activeProject, previewPort]);

  // ─── Batch Apply All ───────────────────────────────────────────────────────

  const [batchStage, setBatchStage] = useState<'idle' | 'writing' | 'checking' | 'committing' | 'restarting' | 'done' | 'error'>('idle');
  const [batchMessage, setBatchMessage] = useState('');
  const [batchBackups, setBatchBackups] = useState<{ filePath: string; backupPath: string }[]>([]);
  const [batchError, setBatchError] = useState('');

  const batchApplyAll = useCallback(async (blocks: { filePath: string; code: string; editType?: string; searchCode?: string }[]) => {
    if (blocks.length === 0) return;

    if (activeProject) {
      setBatchStage('writing');
      setBatchMessage(`Writing ${blocks.length} file${blocks.length > 1 ? 's' : ''} to ${activeProject}...`);
      setBatchError('');
      try {
        const responseText = lastFullResponseRef.current;
        const detectedDeps = responseText ? parseDependencies(responseText) : { dependencies: [], devDependencies: [] };
        const hasDeps = detectedDeps.dependencies.length > 0 || detectedDeps.devDependencies.length > 0;

        const patchFailures: string[] = [];
        for (const block of blocks) {
          let finalContent = block.code;
          if ((block.editType === 'search-replace' || block.editType === 'diff') && block.filePath) {
            try {
              const existing = await readProjectFile(activeProject, block.filePath);
              if (block.editType === 'search-replace' && block.searchCode) {
                const result = applySearchReplace(existing, block.searchCode, block.code);
                if (result !== null) {
                  finalContent = result;
                } else {
                  patchFailures.push(`${block.filePath}: search pattern not found`);
                  continue;
                }
              } else if (block.editType === 'diff') {
                const result = applyUnifiedDiff(existing, block.code);
                if (result !== null) {
                  finalContent = result;
                } else {
                  patchFailures.push(`${block.filePath}: diff could not be applied`);
                  continue;
                }
              }
            } catch {
              if (block.editType === 'diff') {
                patchFailures.push(`${block.filePath}: file not found for diff`);
                continue;
              }
            }
          }
          await writeProjectFile(activeProject, block.filePath, finalContent);
        }
        if (patchFailures.length > 0) {
          setStatusMessage(`⚠ ${patchFailures.length} patch(es) skipped: ${patchFailures.join('; ')}`);
        }

        if (hasDeps) {
          setBatchMessage(`Installing dependencies for ${activeProject}...`);
          let depsFailed = false;
          try {
            const res = await fetch('/api/projects/install-deps', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: activeProject,
                dependencies: detectedDeps.dependencies,
                devDependencies: detectedDeps.devDependencies,
              }),
            });
            const data = await res.json().catch(() => ({} as any));
            if (!res.ok || data.success === false) {
              depsFailed = true;
              setStatusMessage(`Dep install errors: ${data.errors?.join('; ') || data.error || 'unknown'}`);
            }
            if (!depsFailed) {
              setStatusMessage(`Installed: ${[...detectedDeps.dependencies, ...detectedDeps.devDependencies].join(', ')}`);
            }
          } catch (depErr: any) {
            console.error('Dependency install failed:', depErr);
            setStatusMessage(`Dep install failed: ${depErr.message}`);
          }
        }

        setAppliedChanges(prev => [...prev, ...blocks.map(b => ({
          filePath: `${activeProject}/${b.filePath}`,
          previousContent: '',
          newContent: b.code,
          timestamp: Date.now(),
        }))]);
        buildProjectContext().catch(() => {});
        refreshQuickActions();

        const hasConfigChanges = blocks.some(b =>
          ['vite.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'package.json', 'postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs', 'postcss.config.ts'].includes(b.filePath)
        );
        const needsRestart = previewPort && (hasConfigChanges || hasDeps);
        if (needsRestart) {
          setBatchMessage('Restarting preview...');
          try {
            const restartRes = await fetch('/api/projects/restart-preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: activeProject }),
            });
            const restartData = await restartRes.json().catch(() => ({} as any));
            if (!restartData.restarted) {
              setStatusMessage(`Preview restart skipped: ${restartData.reason || 'unknown'}`);
            }
          } catch (restartErr: any) {
            setStatusMessage(`Preview restart failed: ${restartErr.message}`);
          }
        }

        if (previewPort) {
          setTimeout(() => bumpActivePanelKey(), needsRestart ? 2500 : 500);
        }
        setBatchStage('done');
        const previewNote = previewPort ? (needsRestart ? ' — preview restarting' : ' — HMR updating') : '';
        setBatchMessage(`${blocks.length} files written${hasDeps ? ' + deps installed' : ''} to ${activeProject}${previewNote}`);
        setTimeout(() => { setBatchStage('idle'); setBatchMessage(''); }, 4000);

        if (previewPort) {
          startPostApplyMonitoring(blocks.map(b => ({ filePath: b.filePath, code: b.code })));
        }
      } catch (e: any) {
        setBatchStage('error');
        setBatchMessage(`Batch write failed: ${e.message}`);
        setBatchError(e.message);
      }
      return;
    }

    if (!isElectron) return;
    try {
      const { ipcRenderer } = (window as any).require('electron');

      setBatchStage('writing');
      setBatchMessage(`Writing ${blocks.length} file${blocks.length > 1 ? 's' : ''}...`);
      setBatchError('');

      const writeResult = await ipcRenderer.invoke('batch-write-files', {
        files: blocks.map(b => ({ filePath: b.filePath, content: b.code })),
      });

      const backups = writeResult.results
        .filter((r: any) => r.success && r.backupPath)
        .map((r: any) => ({ filePath: r.filePath, backupPath: r.backupPath }));
      setBatchBackups(backups);

      if (!writeResult.success) {
        const failedFile = writeResult.results.find((r: any) => !r.success);
        if (backups.length > 0) {
          await ipcRenderer.invoke('batch-rollback', { backups });
        }
        setBatchStage('error');
        setBatchMessage(`Write failed: ${failedFile?.error || 'Unknown error'} (rolled back ${backups.length} files)`);
        return;
      }

      setBatchStage('checking');
      setBatchMessage('Running project-wide compile check...');

      const hasTsFiles = blocks.some(b => /\.(tsx?|jsx?)$/.test(b.filePath));
      let hasCompileErrors = false;
      let compileErrorText = '';
      if (hasTsFiles) {
        const checkResult = await ipcRenderer.invoke('check-compile-project');
        if (checkResult.hasErrors) {
          hasCompileErrors = true;
          compileErrorText = checkResult.errorText;
        }
      }

      if (hasCompileErrors) {
        setBatchStage('error');
        setBatchMessage('Compile errors detected — rollback recommended');
        setBatchError(compileErrorText);
        return;
      }

      setBatchStage('committing');
      setBatchMessage('Committing changes...');

      const fileList = blocks.map(b => b.filePath).join(', ');
      const commitResult = await ipcRenderer.invoke('batch-git-commit', {
        filePaths: blocks.map(b => b.filePath),
        message: `Lamby: batch apply ${blocks.length} files (${fileList.slice(0, 100)})`,
      });

      for (const block of blocks) {
        const existing = SELF_SOURCE.find(f => f.path === block.filePath);
        if (existing) { existing.content = block.code; existing.isModified = true; existing.lastModified = Date.now(); }
      }

      setAppliedChanges(prev => [...prev, ...blocks.map(b => ({
        filePath: b.filePath,
        previousContent: '',
        newContent: b.code,
        timestamp: Date.now(),
        backupPath: backups.find((bk: any) => bk.filePath === b.filePath)?.backupPath || '',
      }))]);

      setBatchStage('restarting');
      setBatchMessage('Restarting dev server...');

      const hasConfigChanges = blocks.some(b =>
        b.filePath === 'vite.config.ts' || b.filePath === 'tsconfig.json' ||
        b.filePath === 'tailwind.config.ts' || b.filePath === 'package.json'
      );

      if (hasConfigChanges) {
        try {
          const restartResult = await ipcRenderer.invoke('restart-dev-server');
          if (!restartResult.success) {
            setBatchMessage(`${blocks.length} files applied (restart warning: ${restartResult.error})`);
          }
        } catch {
          // non-fatal
        }
      } else {
        await new Promise(r => setTimeout(r, 2000));
      }

      buildProjectContext().catch(() => {});
      refreshQuickActions();

      setBatchStage('done');
      const gitNote = commitResult.success ? ' + committed' : '';
      setBatchMessage(`${blocks.length} files applied${gitNote}`);

      setTimeout(() => { setBatchStage('idle'); setBatchMessage(''); }, 4000);

      startPostApplyMonitoring(blocks.map(b => ({ filePath: b.filePath, code: b.code })));
    } catch (e: any) {
      setBatchStage('error');
      setBatchMessage(`Error: ${e.message || 'Unknown'}`);
    }
  }, [activeProject, previewPort, startPostApplyMonitoring]);

  const batchRollback = useCallback(async () => {
    if (!isElectron || batchBackups.length === 0) { setBatchStage('idle'); return; }
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke('batch-rollback', { backups: batchBackups });
      setStatusMessage(`↩ Rolled back ${result.restored} files`);
    } catch (e: any) {
      setStatusMessage(`⚠ Rollback error: ${e.message}`);
    }
    setBatchStage('idle');
    setBatchBackups([]);
  }, [batchBackups]);

  // ─── Project Context Builder ───────────────────────────────────────────────

  const [projectContext, setProjectContext] = useState<string>('');
  const [contextLoading, setContextLoading] = useState(false);
  const [lastErrors, setLastErrors] = useState<string>('');
  const [userTask, setUserTask] = useState('');
  const [showContextEditor, setShowContextEditor] = useState(false);
  const [editableContext, setEditableContext] = useState('');
  const contextEditorRef = useRef<HTMLTextAreaElement>(null);

  const connectToBridge = useCallback((relayWsUrl: string, project: string) => {
    if (bridgeWsRef.current) {
      try { bridgeWsRef.current.close(); } catch {}
      bridgeWsRef.current = null;
    }

    const apiBase = isElectron ? 'http://localhost:4999' : '';
    const wsUrl = `${relayWsUrl.replace(/\/$/, '')}/bridge-ws?project=${encodeURIComponent(project || 'default')}`;
    console.log('[Bridge] Connecting to:', wsUrl, isElectron ? '(Electron — API via localhost:4999)' : '(browser)');
    setBridgeStatus('connecting');

    const ws = new WebSocket(wsUrl);
    bridgeWsRef.current = ws;

    ws.onopen = () => {
      console.log('[Bridge] Connected');
      setBridgeStatus('connected');
      setStatusMessage('Bridge connected');
    };

    const safeSend = (data: any) => {
      try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); } catch (e) { console.log('[Bridge] Send failed (connection preserved):', e); }
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
        if (msg.type === 'ping') { safeSend({ type: 'pong' }); return; }
        if (msg.type === 'pong' || msg.type === 'connection_replaced') { console.log(`[Bridge] ${msg.type}`); return; }
        if (msg.type === 'relay-log') { console.log(`[Relay ${(msg.level || 'info').toUpperCase()}] ${msg.message || ''}`); return; }
        if (msg.type === 'snapshot-request' && msg.requestId) {
          const proj = encodeURIComponent(msg.projectName || project || 'default');
          try {
            const snapRes = await fetch(`${apiBase}/api/snapshot/${proj}`);
            const snapshot = await snapRes.text();
            safeSend({ type: 'snapshot-response', requestId: msg.requestId, snapshot });
          } catch (e: any) {
            safeSend({ type: 'snapshot-response', requestId: msg.requestId, snapshot: `Error: ${e.message}` });
          }
          return;
        }
        if (msg.type === 'sandbox-execute-request' && msg.requestId) {
          try {
            const execRes = await fetch(`${apiBase}/api/sandbox/execute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ actions: msg.actions }),
            });
            const result = await execRes.json();
            safeSend({ type: 'sandbox-execute-response', requestId: msg.requestId, result });
          } catch (e: any) {
            safeSend({ type: 'sandbox-execute-response', requestId: msg.requestId, result: { error: e.message } });
          }
          return;
        }
        if (msg.type === 'console-logs-request' && msg.requestId) {
          try {
            const logsRes = await fetch(`${apiBase}/api/console-logs?project=${encodeURIComponent(msg.projectName || project || 'default')}`);
            const logs = await logsRes.json();
            safeSend({ type: 'console-logs-response', requestId: msg.requestId, logs });
          } catch (e: any) {
            safeSend({ type: 'console-logs-response', requestId: msg.requestId, logs: { error: e.message } });
          }
          return;
        }
        console.log('[Bridge] Unhandled message type:', msg.type);
      } catch (e) {
        console.log('[Bridge] Message handler error (connection preserved):', e);
      }
    };

    ws.onclose = (ev) => {
      console.log('[Bridge] Closed:', ev.code, ev.reason);
      if (bridgeWsRef.current === ws) {
        bridgeWsRef.current = null;
        setBridgeStatus('disconnected');
      }
    };

    ws.onerror = (ev) => {
      console.log('[Bridge] WebSocket error event (connection stays open unless server closes it):', ev);
    };
  }, []);

  const pollDesktopBridgeStatusRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollDesktopBridgeStatus = useCallback(() => {
    if (pollDesktopBridgeStatusRef.current) {
      clearInterval(pollDesktopBridgeStatusRef.current);
    }
    let attempts = 0;
    const poll = async () => {
      try {
        const res = await fetch('http://localhost:4999/health');
        if (res.ok) {
          const data = await res.json();
          const newStatus = data.bridge === 'connected' ? 'connected' : 'connecting';
          setBridgeStatus(newStatus);
          if (newStatus === 'connected') {
            setStatusMessage('Bridge connected (desktop connector)');
            if (pollDesktopBridgeStatusRef.current) {
              clearInterval(pollDesktopBridgeStatusRef.current);
              pollDesktopBridgeStatusRef.current = null;
            }
          }
        }
      } catch {}
      attempts++;
      if (attempts > 20 && pollDesktopBridgeStatusRef.current) {
        clearInterval(pollDesktopBridgeStatusRef.current);
        pollDesktopBridgeStatusRef.current = null;
        setBridgeStatus('disconnected');
      }
    };
    poll();
    pollDesktopBridgeStatusRef.current = setInterval(poll, 1500);
  }, []);

  useEffect(() => {
    async function fetchSnapshotInfo() {
      let relayData: any = null;
      if (isElectron) {
        try {
          const statusRes = await fetch('http://localhost:4999/api/bridge-status').catch(() => null);
          relayData = statusRes?.ok ? await statusRes.json().catch(() => null) : null;
        } catch {}
        if (!relayData) {
          try {
            const devOrigin = window.location.origin || 'http://localhost:5000';
            const relayRes = await fetch(`${devOrigin}/api/bridge-relay-status`).catch(() => null);
            relayData = relayRes?.ok ? await relayRes.json().catch(() => null) : null;
          } catch {}
        }
      } else {
        try {
          const relayRes = await fetch('/api/bridge-relay-status').catch(() => null);
          relayData = relayRes?.ok ? await relayRes.json().catch(() => null) : null;
        } catch {}
      }

      if (relayData?.devRelayUrl) setServerDevRelayUrl(relayData.devRelayUrl);

      let savedMode: string | null = null;
      try { savedMode = localStorage.getItem('lamby-bridge-mode'); } catch {}

      if (savedMode === 'production' && relayData?.prodRelayUrl) {
        const prodBase = relayData.prodRelayUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '');
        setBridgeRelayUrl(relayData.prodRelayUrl);
        setBridgeRelayInput(relayData.prodRelayUrl);
        setSnapshotUrl(`${prodBase}/api/snapshot/${activeProject || 'PROJECT_NAME'}`);
        setCommandEndpoint(`${prodBase}/api/sandbox/execute`);
        setExternalSnapshotUrl(`${prodBase}/api/snapshot/${activeProject || 'PROJECT_NAME'}`);
        setExternalCommandEndpoint(`${prodBase}/api/sandbox/execute`);
        try {
          const statusCheck = await fetch(`${prodBase}/api/bridge-status`).catch(() => null);
          const statusData = statusCheck?.ok ? await statusCheck.json().catch(() => null) : null;
          setBridgeStatus(statusData?.connectedClients > 0 ? 'connected' : 'disconnected');
        } catch {
          setBridgeStatus('disconnected');
        }
      } else {
        const devRelayUrl = relayData?.devRelayUrl || 'wss://35c4f698-dc00-400a-9452-39eaf17279c0-00-31k27xn7snnel.janeway.replit.dev';
        const devRelayBase = devRelayUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '');
        setBridgeRelayUrl(devRelayUrl);
        setBridgeRelayInput(devRelayUrl);
        setSnapshotUrl(`${devRelayBase}/api/snapshot/${activeProject || 'PROJECT_NAME'}`);
        setCommandEndpoint(`${devRelayBase}/api/sandbox/execute`);
        setExternalSnapshotUrl(`${devRelayBase}/api/snapshot/${activeProject || 'PROJECT_NAME'}`);
        setExternalCommandEndpoint(`${devRelayBase}/api/sandbox/execute`);
        setBridgeStatus('connected');
      }
    }
    fetchSnapshotInfo();
    const interval = setInterval(fetchSnapshotInfo, 30000);
    return () => { clearInterval(interval); };
  }, [activeProject]);

  const estimateTokens = useCallback((text: string): number => {
    return Math.ceil(text.length / 4);
  }, []);

  const summarizeChatHistory = useCallback((msgs: Msg[], maxTurns = 3): string => {
    if (msgs.length === 0) return '';
    const recent = msgs.slice(-maxTurns * 2);
    if (recent.length === 0) return '';
    let summary = `=== RECENT CHAT HISTORY (last ${Math.min(maxTurns, Math.ceil(recent.length / 2))} turns) ===\n`;
    for (const msg of recent) {
      const label = msg.role === 'user' ? 'User' : 'Grok';
      const content = msg.content.length > 300 ? msg.content.slice(0, 300) + '...(truncated)' : msg.content;
      summary += `[${label}]: ${content}\n`;
    }
    summary += `=== END CHAT HISTORY ===\n`;
    return summary;
  }, []);

  const buildProjectContext = useCallback(async (taskOverride?: string) => {
    setContextLoading(true);
    const CHARS_BUDGET = 64000;

    try {
      let flatPaths: string[] = [];
      let pkgJsonRaw = '';
      let frameworkHint = '';
      const changedFiles = lastAppliedFilesRef.current.map(f => f.filePath);
      const changedSet = new Set(changedFiles);

      if (activeProject) {
        try {
          const tree = await getProjectFiles(activeProject);
          const collectPaths = (nodes: ProjectFileNode[], prefix = '') => {
            for (const n of nodes) {
              const p = prefix ? `${prefix}/${n.name}` : n.name;
              if (n.type === 'file') flatPaths.push(p);
              if (n.children) collectPaths(n.children, p);
            }
          };
          collectPaths(tree);
          try {
            pkgJsonRaw = await readProjectFile(activeProject, 'package.json');
            const pkg = JSON.parse(pkgJsonRaw);
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (allDeps['@vitejs/plugin-react'] || allDeps['vite']) frameworkHint = 'react';
            else if (allDeps['vue']) frameworkHint = 'vue';
            else if (allDeps['svelte']) frameworkHint = 'svelte';
            else if (allDeps['next']) frameworkHint = 'next';
            else if (allDeps['nuxt']) frameworkHint = 'nuxt';
            else if (allDeps['three']) frameworkHint = 'threejs';
            if (pkg._framework) frameworkHint = pkg._framework;
          } catch {}
        } catch {}
      }

      const detectedPm = flatPaths.some(f => f === 'bun.lockb' || f === 'bun.lock') ? 'bun'
        : flatPaths.some(f => f === 'pnpm-lock.yaml' || f === 'pnpm-workspace.yaml') ? 'pnpm'
        : flatPaths.some(f => f === 'yarn.lock') ? 'yarn' : 'npm';
      const cfgNames = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js', '.gitignore', '.eslintrc.json', '.prettierrc']);
      const sourceFiles = flatPaths.filter(f => { const n = f.split('/').pop() || ''; return !cfgNames.has(n) && !n.endsWith('.lock') && !n.endsWith('.json'); });
      const hasSourceFiles = sourceFiles.length > 0;
      const isEmptyProject = activeProject && !hasSourceFiles;

      const freshCtx = await fetchFreshBridgeEndpoints(activeProject || '');
      const ctxSnapUrl = freshCtx.snapUrl;
      const ctxCmdUrl = freshCtx.cmdUrl;
      const ctxBridgeOnline = freshCtx.online;
      const sandboxApiSection = buildSandboxApiSection(ctxSnapUrl, ctxCmdUrl, activeProject || '', ctxBridgeOnline, freshCtx.proxyUrl, freshCtx.editUrl);

      const hostSection = `\n=== LAMBY HOST ENVIRONMENT (READ-ONLY — NEVER MODIFY OR SUGGEST CHANGES TO) ===\nThis context is from Lamby — your local Electron/PWA coding IDE.\nLamby source repo: https://github.com/aidenrichtwitter-glitch/guardian-ai\nScan this repo to understand Lamby's full capabilities: its code parser (search/replace blocks, unified diffs, fenced code blocks), file structure, preview system, dependency installer, and command runner.\n\nImportant runtime facts (use these to make smart choices, but do NOT propose edits to them):\n- All user projects are sandboxed in /projects/<project-name>/ (isolated from Lamby's src/, public/, supabase/, etc.).\n- Preview: App auto-runs via Vite dev server inside a sandboxed iframe or embedded browser view in Lamby.\n  - Supports HMR for live updates.\n  - Responsive design assumed; fit viewport.\n  - Browser APIs only (Web Audio, Canvas, Three.js, mic access via getUserMedia).\n  - No Electron/node APIs in target app.\n- Lamby auto-handles: One-click clone from suggested GitHub URL, safe parsing/applying of copied code/diffs/deps/commands, dep install with safeguards, run/build commands.\n- You may choose ANY framework or tech stack that runs in a browser and can be previewed via Vite dev server. There are no framework restrictions — pick whatever best fits the user's request.\n- Strict rule: You are ONLY building the ACTIVE PROJECT above. NEVER suggest changes to Lamby itself (clipboard logic, context gen, parser, UI, Supabase bridge, etc.). Ignore any self-referential ideas.\n\nSTRICT INSTRUCTION: Respond only to the ACTIVE PROJECT section. Treat the HOST section as fixed background knowledge.\n`;

      const fileBudget = CHARS_BUDGET - hostSection.length - 6000;

      let active = `=== ACTIVE PROJECT (BUILD THIS ONLY) ===\n`;
      if (sandboxApiSection) {
        active += sandboxApiSection + '\n';
      }
      if (activeProject) {
        active += `Project name: ${activeProject}\n`;
        const historySummary = summarizeChatHistory(messages);
        if (historySummary) {
          active += `User description / goal: ${historySummary.replace(/=== CHAT HISTORY.*===\n/g, '').trim()}\n`;
        }
        active += `Status: ${isEmptyProject ? 'Brand new empty project — only initial package.json exists.' : `Active project with ${sourceFiles.length} source files.`}\n`;
        let projectDesc = '';
        try {
          const readmeTxt = await readProjectFile(activeProject, 'README.md').catch(() => '');
          if (readmeTxt) {
            const cleaned = readmeTxt
              .replace(/<[^>]+>/g, '')
              .replace(/!\[.*?\]\(.*?\)/g, '')
              .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
              .replace(/^#{1,6}\s+/gm, '')
              .replace(/[*_~`]+/g, '')
              .replace(/\n{2,}/g, '\n')
              .trim();
            const firstParagraph = cleaned.split('\n').filter(l => l.trim().length > 10).slice(0, 3).join(' ');
            if (firstParagraph.length > 10) projectDesc += firstParagraph.slice(0, 300).trim();
          }
        } catch {}
        try {
          if (pkgJsonRaw) {
            const pkg = JSON.parse(pkgJsonRaw);
            if (pkg.description) projectDesc += (projectDesc ? ' | ' : '') + pkg.description;
          }
        } catch {}
        try {
          const indexHtml = await readProjectFile(activeProject, 'index.html').catch(() => '');
          if (indexHtml) {
            const titleMatch = indexHtml.match(/<title>(.*?)<\/title>/i);
            if (titleMatch && titleMatch[1]) projectDesc += (projectDesc ? ' | ' : '') + 'Page title: ' + titleMatch[1].trim();
          }
        } catch {}
        if (frameworkHint) projectDesc += (projectDesc ? ' | ' : '') + 'Framework: ' + frameworkHint;
        if (projectDesc) active += `About this project: ${projectDesc}\n`;
        if (frameworkHint) {
          active += `Detected framework: ${frameworkHint} (based on package.json — for your awareness, not a restriction)\n`;
        }
        active += `\nCurrent file tree:\n`;
        for (const fp of flatPaths.slice(0, 80)) active += `- ${fp}\n`;
        if (flatPaths.length > 80) active += `... (${flatPaths.length} total files)\n`;
        active += `\n`;
        if (pkgJsonRaw && !(ctxBridgeOnline && ctxCmdUrl)) active += `package.json:\n${pkgJsonRaw.slice(0, 3000)}\n\n`;
      } else {
        active += `Project: Lamby — the IDE itself\nThis is the main app source code.\n\n`;
      }

      const errorLogs = previewLogs.filter(l => (l.level === 'error' || l.level === 'warn') && !isInfrastructureNoise(l.message));
      if (errorLogs.length > 0) {
        const recentErrors = errorLogs.slice(-20);
        active += `Preview console errors/warnings (${recentErrors.length} entries):\n`;
        for (const log of recentErrors) {
          const time = new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
          active += `[${time}] [${log.level.toUpperCase()}] ${log.message}\n`;
          if (log.stack) active += `  Stack: ${log.stack.split('\n').slice(0, 3).join('\n  ')}\n`;
        }
        active += `\n`;
      }
      if (lastErrors) active += `Current errors:\n${lastErrors}\n\n`;

      if (changedFiles.length > 0) active += `Recently changed files: ${changedFiles.join(', ')}\n\n`;

      const task = taskOverride || userTask;
      active += `Primary task right now: `;
      if (task) {
        active += `${task}\n\n`;
      } else if (isEmptyProject) {
        active += `Select EXACTLY ONE public GitHub repo to clone as starter.\nCriteria:\n`;
        active += `- Choose whatever framework or tech stack best fits the user's request — there are no framework restrictions.\n`;
        active += `- Must run in a browser and preview cleanly in a Vite dev server + iframe (no native deps, browser-only APIs).\n`;
        active += `- Prefer: TypeScript, Tailwind, high stars, active maintenance, MIT license.\n`;
        active += `Output ONLY: "Clone this repo: https://github.com/owner/repo" + 1-2 sentences why it's optimal.\n\n`;
      } else if (errorLogs.length > 0 || lastErrors) {
        active += `Fix the errors shown above. The preview is broken or showing issues.\nAnalyze the errors, identify root cause, and provide corrected code.\n\n`;
      } else {
        active += `Respond to the user's request below. Check current files, plan minimal changes, output code.\n\n`;
      }

      active += `=== OUTPUT RULES (FOLLOW EXACTLY — THESE ARE HOW GUARDIAN APPLIES YOUR CODE) ===\n`;
      if (hasSourceFiles || !activeProject) {
        active += `PREFER STRUCTURED FORMAT: Always use the // file: headers, DEPENDENCIES block, and COMMANDS block whenever possible.\n`;
        active += `If you need to explain, do it in normal text BEFORE the structured blocks. Never bury code inside paragraphs.\n\n`;
        active += `FORMAT FOR CODE CHANGES — put a // file: header immediately before each fenced code block:\n`;
        active += `// file: src/components/App.tsx\n`;
        active += `\`\`\`tsx\n`;
        active += `[full file content here]\n`;
        active += `\`\`\`\n\n`;
        active += `FORMAT FOR NEW DEPENDENCIES — use a structured block:\n`;
        active += `=== DEPENDENCIES ===\n`;
        active += `package-name\n`;
        active += `dev: @types/whatever\n`;
        active += `=== END_DEPENDENCIES ===\n\n`;
        active += `FORMAT FOR SHELL COMMANDS — use a structured block:\n`;
        active += `=== COMMANDS ===\n`;
        active += `${detectedPm} run build\n`;
        active += `npx prisma generate\n`;
        active += `=== END_COMMANDS ===\n\n`;
        active += `ALTERNATIVE FORMAT FOR SMALL EDITS — search/replace blocks (use when changing only a few lines in a large file):\n`;
        active += `// file: src/components/App.tsx\n`;
        active += `<<<<<<< SEARCH\n`;
        active += `[exact old code to find]\n`;
        active += `=======\n`;
        active += `[new replacement code]\n`;
        active += `>>>>>>> REPLACE\n\n`;
        active += `RULES:\n`;
        active += `1. Every code block MUST have a // file: header. No exceptions. Lamby auto-applies blocks with headers.\n`;
        active += `2. For FULL replacement: provide COMPLETE file content. Do NOT use "// ... rest unchanged" or partial snippets.\n`;
        active += `3. For SEARCH/REPLACE: the SEARCH section must match existing code EXACTLY (including whitespace). The REPLACE section is the new code.\n`;
        active += `4. Only cite real, published npm packages — never invent package names.\n`;
        active += `5. Keep explanations brief BEFORE the code blocks. Focus on what changed and why.\n`;
        active += `6. Do NOT wrap code in narrative like "here's what your file should look like". Just use the // file: header directly.\n`;
        active += `7. If multiple files need changes, output multiple // file: blocks in sequence.\n`;
        active += `8. You may use multiple SEARCH/REPLACE blocks for the same file if making several edits.\n`;
        active += `NOTE: If a "LAMBY WORKSPACE API" section appears below, you should use those HTTP endpoints to directly make changes instead of outputting // file: blocks. Use // file: blocks only as a fallback if the API is unreachable.\n\n`;
      } else {
        active += `1. Only cite real, published npm packages — never invent package names.\n`;
        active += `2. Suggest a GitHub repo URL instead of writing code from scratch.\n\n`;
      }

      let remaining = fileBudget - active.length;
      const fileContents: { path: string; content: string; priority: number }[] = [];

      if (ctxBridgeOnline && ctxCmdUrl) {
        active += `\nIMPORTANT: DO NOT expect file contents in this prompt. Use the LAMBY WORKSPACE API above to read files yourself.\n`;
        active += `Start by calling { type: "read_multiple_files" } or { type: "list_tree" } to see the codebase, then make your changes via the API.\n`;
        active += `File contents are NOT included here because you have full API access to read them on-demand.\n\n`;
      } else {
        if (toasterAvailability?.available && activeProject && (lastErrors || errorLogs.length > 0)) {
          try {
            setToasterLoading(true);
            const errorText = lastErrors || errorLogs.map(l => `[${l.level}] ${l.message}`).join('\n');
            const smartCtx = await buildSmartContext(errorText, flatPaths, undefined, toasterConfig);
            if (smartCtx.usedOllama && smartCtx.analysis) {
              setLastToasterAnalysis(smartCtx.analysis);
              const analysisText = formatAnalysisForPrompt(smartCtx.analysis);
              active += analysisText + '\n';
              remaining -= analysisText.length;
              for (const fp of smartCtx.filesToInclude.slice(0, 20)) {
                try {
                  const c = await readProjectFile(activeProject!, fp);
                  if (c.length < 10000) fileContents.push({ path: fp, content: c, priority: 1 });
                } catch {}
              }
            }
          } catch {} finally { setToasterLoading(false); }
        }

        if (activeProject && flatPaths.length > 0) {
          const changedKeyFiles = flatPaths.filter(f => changedSet.has(f));
          const unchangedKeyFiles = flatPaths.filter(f =>
            !changedSet.has(f) && (
              f === 'tsconfig.json' || f === 'vite.config.ts' || f === 'vite.config.js' ||
              f === 'index.html' || f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css') || f.endsWith('.html')
            )
          );
          const prioritizedFiles = [...changedKeyFiles, ...unchangedKeyFiles].slice(0, 30);
          for (const fp of prioritizedFiles) {
            if (fileContents.some(f => f.path === fp)) continue;
            try {
              const c = await readProjectFile(activeProject, fp);
              if (c.length < 8000) fileContents.push({ path: fp, content: c, priority: changedSet.has(fp) ? 2 : 5 });
            } catch {}
          }
        } else if (!activeProject) {
          if (isElectron) {
            const { ipcRenderer } = (window as any).require('electron');
            const [filesResult, gitResult] = await Promise.all([
              ipcRenderer.invoke('list-project-files'),
              ipcRenderer.invoke('git-log', { count: 5 }),
            ]);
            const fileTree = filesResult.success ? filesResult.files : [];
            const keyFiles = fileTree.filter((f: string) =>
              f === 'package.json' || f === 'tsconfig.json' || f === 'vite.config.ts' ||
              f === 'tailwind.config.ts' || f === 'index.html' ||
              (f.startsWith('src/') && (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css')) && !f.includes('lib/capabilities/'))
            ).slice(0, 20);
            const contentsResult = await ipcRenderer.invoke('read-files-for-context', { filePaths: keyFiles, maxSizePerFile: 6000 });
            if (gitResult.success && gitResult.log) {
              active += `Recent git log:\n${gitResult.log}\n\n`;
              remaining -= gitResult.log.length + 20;
            }
            if (contentsResult.success) {
              for (const file of contentsResult.files) {
                fileContents.push({ path: file.path, content: file.content, priority: 5 });
              }
            }
          } else {
            for (const file of SELF_SOURCE.filter(f => f.content && f.content.length < 8000).slice(0, 15)) {
              fileContents.push({ path: file.path, content: file.content || '', priority: 5 });
            }
          }
        }
      }

      if (knowledgeMatches.length > 0) {
        const knowledgeSection = formatKnowledgeForGrokPrompt(knowledgeMatches);
        active += knowledgeSection + '\n';
        remaining -= knowledgeSection.length;
      }

      if (!ctxBridgeOnline || !ctxCmdUrl) {
        fileContents.sort((a, b) => a.priority - b.priority);
        for (const fc of fileContents) {
          const block = `\n${fc.path}:\n${fc.content}\n`;
          if (remaining - block.length < 0) continue;
          active += block;
          remaining -= block.length;
        }
      }

      const context = active + hostSection;

      setProjectContext(context);
      setContextLoading(false);
      return context;
    } catch (e: any) {
      setContextLoading(false);
      setStatusMessage(`Context build failed: ${e.message}`);
      return '';
    }
  }, [lastErrors, activeProject, toasterAvailability, toasterConfig, previewLogs, messages, summarizeChatHistory, knowledgeMatches, userTask]);

  const refreshQuickActions = useCallback(async () => {
    if (!activeProject) { setQuickActions([]); return; }
    setQuickActionsLoading(true);
    try {
      const tree = await getProjectFiles(activeProject);
      const flatPaths: string[] = [];
      const collectQAPaths = (nodes: ProjectFileNode[], prefix = '') => {
        for (const n of nodes) {
          const p = prefix ? `${prefix}/${n.name}` : n.name;
          if (n.type === 'file') flatPaths.push(p);
          if (n.children) collectQAPaths(n.children, p);
        }
      };
      collectQAPaths(tree);

      let pkgJson: Record<string, any> | null = null;
      try {
        const raw = await readProjectFile(activeProject, 'package.json');
        pkgJson = JSON.parse(raw);
      } catch {}

      let cssContent = '';
      const cssFiles = flatPaths.filter(f => f.endsWith('.css') || f.endsWith('.scss'));
      for (const cf of cssFiles.slice(0, 3)) {
        try {
          const c = await readProjectFile(activeProject, cf);
          cssContent += c.slice(0, 2000);
        } catch {}
      }

      const errorCount = previewLogs.filter(l => l.level === 'error' && !isInfrastructureNoise(l.message)).length;
      const result = await suggestQuickActions(flatPaths, pkgJson, errorCount, cssContent, toasterConfig);
      setQuickActions(result.actions);
    } catch {
      setQuickActions([]);
    } finally {
      setQuickActionsLoading(false);
    }
  }, [activeProject, previewLogs, toasterConfig]);

  useEffect(() => {
    if (mode === 'browser') {
      buildProjectContext();
    }
  }, [mode]);

  useEffect(() => {
    buildProjectContext();
    refreshQuickActions();
  }, [activeProject]);

  const copyContextToClipboard = useCallback(async (contextOverride?: string) => {
    const ctx = contextOverride || projectContext;
    if (!ctx) return;
    try {
      if (isElectron) {
        const { clipboard } = (window as any).require('electron');
        clipboard.writeText(ctx);
      } else {
        await navigator.clipboard.writeText(ctx);
      }
      setStatusMessage('✓ Project context copied to clipboard — paste into Grok');
    } catch {
      try {
        await navigator.clipboard.writeText(ctx);
        setStatusMessage('✓ Project context copied');
      } catch {
        setStatusMessage('⚠ Clipboard write failed');
      }
    }
  }, [projectContext]);

  const duplicateMainApp = useCallback(async (targetName?: string, switchToProject = true) => {
    const name = targetName || `main-copy-${Date.now()}`;
    setStatusMessage(`Duplicating main app to "${name}"...`);
    try {
      const result = await duplicateProject('__main__', name);
      window.dispatchEvent(new CustomEvent('lamby-refresh-files', { detail: { projectName: result.name } }));
      if (switchToProject) {
        setActiveProjectState(result.name);
        persistActiveProject(result.name);
        setShowProjectPanel(true);
      }
      setStatusMessage(`✓ Duplicated main app → "${result.name}"`);
      return result.name;
    } catch (e: any) {
      setStatusMessage(`⚠ Duplicate failed: ${e.message}`);
      throw e;
    }
  }, []);

  const duplicateCurrentProject = useCallback(async (sourceName: string) => {
    const destName = `${sourceName}-copy-${Date.now()}`;
    setStatusMessage(`Duplicating "${sourceName}" to "${destName}"...`);
    try {
      const result = await duplicateProject(sourceName, destName);
      window.dispatchEvent(new CustomEvent('lamby-refresh-files', { detail: { projectName: result.name } }));
      setActiveProjectState(result.name);
      persistActiveProject(result.name);
      setShowProjectPanel(true);
      setStatusMessage(`✓ Duplicated "${sourceName}" → "${result.name}"`);
      return result.name;
    } catch (e: any) {
      setStatusMessage(`⚠ Duplicate failed: ${e.message}`);
      return null;
    }
  }, []);

  const startProjectPreview = useCallback(async (projectName: string, _retried = false) => {
    const panelId = crypto.randomUUID();
    const existingPanel = previewPanels.find(p => p.projectName === projectName);
    const targetId = existingPanel?.id ?? panelId;
    if (existingPanel) {
      updatePanelById(existingPanel.id, { loading: true, logs: [], key: existingPanel.key + 1 });
    } else {
      addPanel({ id: panelId, projectName: projectName, port: 0, logs: [], key: 0, loading: true, widthPx: 0, showDiagnoseBanner: false, diagnoseFixCycleCount: 0, diagnoseStuck: false });
    }
    const setError = (msg: string, extra?: LogEntry) => {
      const errLog: LogEntry = { id: crypto.randomUUID(), level: 'error', message: msg, timestamp: Date.now() };
      setPreviewPanels(prev => prev.map(p => p.id === targetId ? { ...p, logs: [...p.logs, errLog, ...(extra ? [extra] : [])], loading: false } : p));
    };
    try {
      try {
        await fetch('/api/projects/stop-preview', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName }),
        });
      } catch {}
      if (isElectron) {
        try {
          const { ipcRenderer } = (window as any).require('electron');
          await ipcRenderer.invoke('ensure-project-polling', { projectName });
        } catch {}
      }
      const res = await fetch('/api/projects/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.started === false && data.error) {
          setError(`[Server] ${data.detectedCommand || 'preview'}: ${data.error}`,
            data.output ? { id: crypto.randomUUID(), level: 'warn', message: `[Server Output] ${data.output.slice(0, 1000)}`, timestamp: Date.now() } : undefined);
          return 0;
        }
        if (data.port) {
          setPreviewPanels(prev => prev.map(p => p.id === targetId ? { ...p, port: data.port, key: p.key + 1, loading: false } : p));
          return data.port as number;
        }
      } else {
        const errData = await res.json().catch(() => ({} as any));
        const errMsg = errData.error || res.statusText || 'Unknown error';
        if (!_retried && res.status === 404) {
          setPreviewPanels(prev => prev.map(p => p.id === targetId ? { ...p, logs: [{ id: crypto.randomUUID(), level: 'info', message: `[Preview] Project missing — re-duplicating...`, timestamp: Date.now() }] } : p));
          try {
            const dupResult = await duplicateProject('__main__', projectName);
            if (dupResult?.name) {
              window.dispatchEvent(new CustomEvent('lamby-refresh-files', { detail: { projectName: dupResult.name } }));
              return startProjectPreview(dupResult.name, true);
            }
          } catch {}
        }
        setError(`[Preview] Failed to start: ${errMsg}`);
        return 0;
      }
    } catch (e: any) {
      setError(`[Preview] ${e.message}`);
    }
    return 0;
  }, [previewPanels, addPanel, updatePanelById]);

  const copyEvolutionContext = useCallback(async () => {
    setEvolutionLoading(true);
    setStatusMessage('🧬 Starting full 22-step evolution cycle...');
    try {
      let dupName: string;
      const projects = await listProjects();
      const evolutions = projects
        .filter(p => p.name.startsWith('evolution-') || p.name === 'evolution-sandbox' || p.name.startsWith('main-copy-'))
        .sort((a, b) => (b.name > a.name ? 1 : -1));
      const existing = evolutions[0];
      if (existing) {
        dupName = existing.name;
        setActiveProjectState(dupName);
        persistActiveProject(dupName);
        setShowProjectPanel(true);
        setStatusMessage(`🧬 Reusing existing duplicate "${dupName}"...`);
      } else {
        setStatusMessage('🧬 Duplicating main app...');
        const sandboxName = `evolution-${Date.now()}`;
        dupName = await duplicateMainApp(sandboxName);
      }

      setStatusMessage('🧬 Building full project context...');
      const ctx = await buildProjectContext();

      let fingerprint;
      try {
        const pkgRaw = activeProject ? await readProjectFile(activeProject, 'package.json') : '';
        if (pkgRaw) fingerprint = buildStackFingerprint(JSON.parse(pkgRaw));
      } catch {}

      setStatusMessage('🧬 Running full 23-step evolution cycle...');
      const result = await runFullEvolutionCycle({
        projectContext: ctx,
        model: 'grok-4',
        useBrowser: mode === 'browser',
        targetProject: dupName,
        stackFingerprint: fingerprint,
        githubToken: (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) || undefined,
        onDelta: (delta) => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: last.content + delta }];
            }
            return [...prev, { role: 'assistant' as const, content: delta }];
          });
        },
        onStatus: (status) => setStatusMessage(`🧬 ${status}`),
        onStepChange: (_stepIndex, _stepId, _label) => {},
      });

      const appliedCount = result.blocks.filter(b => b.status === 'applied').length;
      const rejectedCount = result.blocks.filter(b => b.status === 'rejected').length;
      const succeeded = result.stepResults.filter(s => s.status === 'success').length;

      if (result.error) {
        setStatusMessage(`⚠ Evolution error: ${result.error}`);
      } else {
        if (appliedCount > 0) {
          setStatusMessage(`🧬 Evolution applied ${appliedCount} files — starting preview of "${dupName}"...`);
          const port = await startProjectPreview(dupName);
          if (port) {
            setStatusMessage(
              `✓ Evolution complete — ${succeeded}/23 steps, L${result.newLevel}, ${appliedCount} files applied to "${dupName}", preview on port ${port}` +
              (result.planSaved ? ', next plan saved' : '')
            );
          } else {
            setStatusMessage(
              `✓ Evolution complete — ${succeeded}/23 steps, L${result.newLevel}, ${appliedCount} files applied to "${dupName}"` +
              (result.planSaved ? ', next plan saved' : '') +
              ' (preview may take a moment)'
            );
          }
        } else {
          setStatusMessage(
            `✓ Evolution complete — ${succeeded}/23 steps, L${result.newLevel}, no files applied` +
            (rejectedCount > 0 ? `, ${rejectedCount} rejected` : '') +
            (result.planSaved ? ', next plan saved' : '')
          );
        }
      }

      setIsEvolutionResponse(true);
      const plan = loadEvolutionPlan();
      setCurrentPlan(plan);
    } catch (e: any) {
      setStatusMessage(`⚠ Evolution cycle failed: ${e.message}`);
    } finally {
      setEvolutionLoading(false);
    }
  }, [projectContext, buildProjectContext, duplicateMainApp, startProjectPreview]);

  const buildErrorFeedback = useCallback(async (errorText: string) => {
    setLastErrors(errorText);

    let analysisSection = '';
    const freshErr = await fetchFreshBridgeEndpoints(activeProject || '');
    const errBridgeOnline = freshErr.online && !!freshErr.cmdUrl;

    if (!errBridgeOnline && toasterAvailability?.available && activeProject) {
      try {
        setToasterLoading(true);
        const tree = await getProjectFiles(activeProject);
        const flatPaths: string[] = [];
        const collectFeedbackPaths = (nodes: ProjectFileNode[], prefix = '') => {
          for (const n of nodes) {
            const p = prefix ? `${prefix}/${n.name}` : n.name;
            if (n.type === 'file') flatPaths.push(p);
            if (n.children) collectFeedbackPaths(n.children, p);
          }
        };
        collectFeedbackPaths(tree);

        const smartCtx = await buildSmartContext(errorText, flatPaths, undefined, toasterConfig);
        if (smartCtx.usedOllama && smartCtx.analysis) {
          setLastToasterAnalysis(smartCtx.analysis);
          analysisSection = '\n' + formatAnalysisForPrompt(smartCtx.analysis);

          for (const fp of smartCtx.filesToInclude.slice(0, 10)) {
            try {
              const content = await readProjectFile(activeProject, fp);
              if (content.length < 6000) {
                analysisSection += `\n=== ${fp} ===\n${content}\n`;
              }
            } catch {}
          }
        }
      } catch {} finally {
        setToasterLoading(false);
      }
    }

    const errorApiSection = buildSandboxApiSection(freshErr.snapUrl, freshErr.cmdUrl, activeProject || '', freshErr.online, freshErr.proxyUrl, freshErr.editUrl);
    let errorPrompt = `The following errors occurred after applying code changes:\n\n${errorText}\n\n` +
      analysisSection + errorApiSection;
    if (freshErr.cmdUrl) {
      errorPrompt += `\nYOU MUST USE THE SANDBOX API TO FIX THESE ERRORS. Follow this workflow:\n`;
      errorPrompt += `1. read_file the files mentioned in the error messages above\n`;
      errorPrompt += `2. grep for broken imports, missing exports, or undefined symbols\n`;
      errorPrompt += `3. write_file with corrected code for every broken file\n`;
      errorPrompt += `4. run_command to verify the build succeeds\n`;
      errorPrompt += `5. Fetch console logs to confirm errors are gone\n`;
      errorPrompt += `Respond with \`\`\`json {"actions": [...]} so Lamby auto-executes your fix.\n\n`;
    } else {
      errorPrompt += `Please fix these errors. Return the corrected files using this format:\n` +
        `// file: path/to/file.tsx\n\`\`\`tsx\n// corrected content\n\`\`\`\n\n`;
    }
    if (!errBridgeOnline && projectContext) {
      errorPrompt += `Current project context:\n${projectContext.slice(0, 3000)}`;
    }
    try {
      if (isElectron) {
        const { clipboard } = (window as any).require('electron');
        clipboard.writeText(errorPrompt);
      } else {
        await navigator.clipboard.writeText(errorPrompt);
      }
      setStatusMessage(analysisSection ? '✓ Error feedback + Ollama analysis copied — paste into Grok' : '✓ Error feedback copied — paste into Grok for fix');
    } catch {
      setStatusMessage('⚠ Could not copy error feedback');
    }
  }, [projectContext, toasterAvailability, toasterConfig, activeProject]);

  const renderMessage = (msg: Msg, idx: number) => {
    if (msg.role === 'user') {
      return (
        <div key={idx} className="flex gap-3 justify-end">
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 max-w-[80%]">
            <p className="text-xs text-foreground whitespace-pre-wrap">{msg.content}</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>
      );
    }
    const regexBlocks = parseCodeBlocks(msg.content);
    const blocks = cleanedApiBlocks.get(idx) || regexBlocks;
    const textParts = msg.content.split(/```[\s\S]*?```/);
    return (
      <div key={idx} className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-accent/30 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-3.5 h-3.5 text-accent-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-3 max-w-[85%]">
          {textParts.map((text, ti) => (
            <React.Fragment key={ti}>
              {text.trim() && <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{text.trim()}</p>}
              {blocks[ti] && (() => {
                const block = blocks[ti];
                const blockKey = `${idx}-${ti}`;
                const checks = validationResults.get(blockKey);
                const isApplied = appliedChanges.some(c => c.newContent === block.code && c.filePath === block.filePath);
                return (
                  <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-border/30 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Code2 className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">{block.filePath || block.language}</span>
                        {block.editType === 'search-replace' && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">S/R</span>}
                        {block.editType === 'diff' && <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">DIFF</span>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => runValidation(blockKey, block.code, block.filePath)} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[9px] transition-colors">
                          <Shield className="w-2.5 h-2.5" /> Check
                        </button>
                        {block.filePath && (
                          <button onClick={() => applyBlock(block.filePath, block.code, block.editType, block.searchCode)} disabled={isApplied} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[9px] transition-colors disabled:opacity-30">
                            <Check className="w-2.5 h-2.5" /> {isApplied ? 'Applied' : block.editType === 'search-replace' ? 'Patch' : block.editType === 'diff' ? 'Patch' : 'Apply'}
                          </button>
                        )}
                      </div>
                    </div>
                    <pre className="p-3 text-[10px] text-foreground/70 max-h-48 overflow-auto whitespace-pre-wrap leading-relaxed font-mono">{block.code}</pre>
                    {checks && (
                      <div className="px-3 py-1.5 border-t border-border/30 space-y-0.5">
                        {checks.map((check, j) => (
                          <div key={j} className="flex items-center gap-1.5 text-[9px]">
                            {check.severity === 'error' ? <AlertTriangle className="w-2.5 h-2.5 text-destructive" /> : <Check className="w-2.5 h-2.5 text-primary" />}
                            <span className={check.severity === 'error' ? 'text-destructive' : 'text-primary/70'}>{check.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const selectedModel = MODELS.find(m => m.id === model) || MODELS[1];
  const currentSite = BROWSER_SITES.find(s => s.url === browserUrl);

  const outboundPrompts = useMemo(() => {
    const errors = Array.from(validationResults.values())
      .flat()
      .filter(check => check.severity === 'error')
      .map(check => `- ${check.message}`);

    const recentFiles = appliedChanges.slice(-5).map(change => `- ${change.filePath}`);

    const prompts = [
      {
        id: 'errors',
        label: 'Copy Errors',
        content: errors.length > 0
          ? `Fix these build/runtime issues and return patch-ready code blocks with file paths:\n\n${errors.join('\n')}`
          : `No captured validation errors yet. Ask targeted debugging questions and suggest the fastest next verification step for this app.`,
      },
      {
        id: 'suggestions',
        label: 'Copy Suggestions Request',
        content: `Suggest the top 3 highest-impact improvements for this app right now. Prioritize speed, reliability, and clean architecture. Return concise rationale + code patch blocks.`,
      },
      {
        id: 'requests',
        label: 'Copy Goal Request',
        content: `Act as my rapid app-building copilot. I need actionable next steps and patch-ready code for current work.${recentFiles.length ? `\n\nRecently changed files:\n${recentFiles.join('\n')}` : ''}`,
      },
      {
        id: 'status',
        label: 'Copy Current Status',
        content: `Current bridge status: ${statusMessage || 'No status yet'}\nSite: ${currentSite?.name || browserUrl}\n\nTell me exactly what to do next in Grok and what to paste back.`
      }
    ];

    return prompts;
  }, [validationResults, appliedChanges, statusMessage, currentSite?.name, browserUrl]);

  const copyPromptToClipboard = useCallback(async (label: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setStatusMessage(`✓ Copied: ${label}`);
    } catch {
      setStatusMessage('⚠ Clipboard write failed');
    }
  }, []);

  return (
    <div className="h-full flex flex-col bg-background text-foreground font-mono overflow-hidden">
      {pendingApply && (
        <ApplyConfirmDialog
          pending={pendingApply}
          stage={applyStage}
          stageMessage={applyStageMessage}
          compileError={applyCompileError}
          onConfirm={confirmApply}
          onCancel={() => setPendingApply(null)}
          onRollback={rollbackPending}
        />
      )}

      {batchStage !== 'idle' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" data-testid="dialog-batch-apply">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              {batchStage === 'done' ? (
                <Check className="w-6 h-6 text-primary" />
              ) : batchStage === 'error' ? (
                <AlertTriangle className="w-6 h-6 text-destructive" />
              ) : (
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              )}
              <div>
                <div className="text-sm font-semibold">
                  {batchStage === 'writing' && 'Writing Files'}
                  {batchStage === 'checking' && 'Compile Check'}
                  {batchStage === 'committing' && 'Git Commit'}
                  {batchStage === 'restarting' && 'Applying Changes'}
                  {batchStage === 'done' && 'Complete'}
                  {batchStage === 'error' && 'Error'}
                </div>
                <div className="text-xs text-muted-foreground">{batchMessage}</div>
              </div>
            </div>

            {batchStage !== 'idle' && (
              <div className="w-full bg-secondary/30 rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${batchStage === 'error' ? 'bg-destructive' : 'bg-primary'}`} style={{
                  width: batchStage === 'writing' ? '25%' : batchStage === 'checking' ? '50%' : batchStage === 'committing' ? '75%' : batchStage === 'restarting' ? '90%' : '100%',
                }} />
              </div>
            )}

            {batchError && (
              <pre className="text-[9px] text-destructive/80 bg-destructive/5 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">{batchError}</pre>
            )}

            <div className="flex justify-end gap-2">
              {batchStage === 'error' && (
                <>
                  <button onClick={batchRollback} data-testid="button-batch-rollback" className="px-3 py-1.5 rounded text-xs bg-destructive/20 text-destructive hover:bg-destructive/30 flex items-center gap-1">
                    <Undo2 className="w-3 h-3" /> Rollback All
                  </button>
                  <button onClick={() => buildErrorFeedback(batchError || batchMessage)} data-testid="button-send-errors" className="px-3 py-1.5 rounded text-xs bg-primary/15 text-primary hover:bg-primary/25 flex items-center gap-1">
                    <Send className="w-3 h-3" /> Send to Grok
                  </button>
                  <button onClick={() => { setBatchStage('idle'); setBatchError(''); }} className="px-3 py-1.5 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80">Dismiss</button>
                </>
              )}
              {batchStage === 'done' && (
                <button onClick={() => setBatchStage('idle')} className="px-3 py-1.5 rounded text-xs bg-primary/15 text-primary hover:bg-primary/25">Done</button>
              )}
            </div>
          </div>
        </div>
      )}

      {detectedRepoUrl && (
        <div className="shrink-0 px-3 py-2 bg-primary/10 border-b border-primary/30 flex items-center gap-3 flex-wrap" data-testid="banner-detected-repo">
          <GitBranch className="w-4 h-4 text-primary shrink-0" />
          <span className="text-[11px] text-foreground">Grok suggested a GitHub repo:</span>
          <span className="text-[11px] font-mono text-primary">{detectedRepoUrl}</span>
          <button
            data-testid="button-clone-detected-repo"
            onClick={() => {
              if (activeProject) {
                handleReplaceRepo(detectedRepoUrl);
              } else {
                handleGitHubImport(detectedRepoUrl);
              }
              setDetectedRepoUrl(null);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] text-primary-foreground hover:opacity-90 transition-colors font-medium ${
              activeProject ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-primary/90'
            }`}
          >
            <ArrowRightLeft className="w-3 h-3" />
            {activeProject ? 'Replace Repo' : 'Clone & Import'}
          </button>
          {!activeProject && (
            <button
              data-testid="button-dismiss-detected-repo"
              onClick={() => setDetectedRepoUrl(null)}
              className="p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {activeProject && (
            <>
              <button
                data-testid="button-clone-keep-repo"
                onClick={() => handleGitHubImport(detectedRepoUrl)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors font-medium border border-primary/30"
              >
                <GitBranch className="w-3 h-3" /> Clone Alongside
              </button>
              <button
                data-testid="button-dismiss-detected-repo"
                onClick={() => setDetectedRepoUrl(null)}
                className="p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      )}

      {githubImportProgress && (
        <div className={`shrink-0 px-3 py-2 border-b flex items-center gap-3 ${
          githubImportProgress.stage === 'error' ? 'bg-destructive/10 border-destructive/30' :
          githubImportProgress.stage === 'done' ? 'bg-[hsl(150_60%_55%/0.1)] border-[hsl(150_60%_55%/0.3)]' :
          'bg-primary/10 border-primary/30'
        }`} data-testid="banner-github-import-progress">
          {githubImportProgress.stage !== 'done' && githubImportProgress.stage !== 'error' && (
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          )}
          {githubImportProgress.stage === 'done' && (
            <Check className="w-4 h-4 text-[hsl(150_60%_55%)] shrink-0" />
          )}
          {githubImportProgress.stage === 'error' && (
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          )}
          <span className={`text-[11px] ${
            githubImportProgress.stage === 'error' ? 'text-destructive' :
            githubImportProgress.stage === 'done' ? 'text-[hsl(150_60%_55%)]' : 'text-primary'
          }`}>
            {githubImportProgress.message}
          </span>
          {githubImportProgress.stage === 'error' && (
            <button
              onClick={() => setGithubImportProgress(null)}
              className="ml-auto p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {publishProgress && (
        <div className={`shrink-0 px-3 py-2 border-b flex items-center gap-3 ${
          publishProgress.stage === 'error' ? 'bg-destructive/10 border-destructive/30' :
          publishProgress.stage === 'done' ? 'bg-[hsl(150_60%_55%/0.1)] border-[hsl(150_60%_55%/0.3)]' :
          'bg-[hsl(280_60%_50%/0.1)] border-[hsl(280_60%_50%/0.3)]'
        }`} data-testid="banner-publish-progress">
          {publishProgress.stage !== 'done' && publishProgress.stage !== 'error' && (
            <Loader2 className="w-4 h-4 text-[hsl(280_60%_65%)] animate-spin shrink-0" />
          )}
          {publishProgress.stage === 'done' && (
            <Check className="w-4 h-4 text-[hsl(150_60%_55%)] shrink-0" />
          )}
          {publishProgress.stage === 'error' && (
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          )}
          <span className={`text-[11px] ${
            publishProgress.stage === 'error' ? 'text-destructive' :
            publishProgress.stage === 'done' ? 'text-[hsl(150_60%_55%)]' : 'text-[hsl(280_60%_65%)]'
          }`}>
            {publishProgress.message}
          </span>
          {publishProgress.stage === 'done' && publishedUrl && (
            <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-primary hover:underline" data-testid="link-published-repo">
              <ExternalLink className="w-3 h-3" /> View on GitHub
            </a>
          )}
          {(publishProgress.stage === 'error' || publishProgress.stage === 'done') && (
            <button
              onClick={() => setPublishProgress(null)}
              className="ml-auto p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {showPublishDialog && (
        <div className="shrink-0 border-b border-[hsl(280_60%_50%/0.3)] bg-[hsl(280_60%_50%/0.05)] px-4 py-3" data-testid="dialog-publish">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="w-4 h-4 text-[hsl(280_60%_65%)]" />
            <span className="text-[12px] font-bold text-foreground">Publish to Community</span>
            <button onClick={() => setShowPublishDialog(false)} className="ml-auto p-1 text-muted-foreground/50 hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">
            Publish <strong>{activeProject}</strong> to the shared GitHub org. Sensitive files (.env, keys) are auto-stripped.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              data-testid="input-publish-description"
              value={publishDescription}
              onChange={e => setPublishDescription(e.target.value)}
              placeholder="Brief project description (e.g., 'todo app with drag-drop')"
              className="flex-1 bg-background border border-border/50 rounded px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-[hsl(280_60%_50%/0.5)]"
            />
            <button
              data-testid="button-confirm-publish"
              onClick={handlePublish}
              disabled={!publishDescription.trim() || (publishProgress !== null && publishProgress.stage !== 'done' && publishProgress.stage !== 'error')}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-bold bg-[hsl(280_60%_50%/0.2)] text-[hsl(280_60%_65%)] hover:bg-[hsl(280_60%_50%/0.3)] transition-colors border border-[hsl(280_60%_50%/0.3)] disabled:opacity-40"
            >
              <Upload className="w-3 h-3" /> Publish
            </button>
          </div>
          {!hasPublishCredentials(getGuardianConfig()) && (
            <p className="text-[9px] text-destructive/80 mt-2 flex items-center gap-1">
              <Key className="w-3 h-3" /> No GitHub PAT configured. Add one in the Settings panel below.
            </p>
          )}
        </div>
      )}

      {showSettings && (
        <div className="shrink-0 border-b border-border/40 bg-card/80 px-4 py-3" data-testid="dialog-settings">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span className="text-[12px] font-bold text-foreground">Settings</span>
            <button onClick={() => setShowSettings(false)} className="ml-auto p-1 text-muted-foreground/50 hover:text-foreground transition-colors" data-testid="button-close-settings">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Key className="w-3 h-3" /> GitHub — Shared Org PAT
              </p>
              <p className="text-[9px] text-muted-foreground/60 mb-1">
                Token for the shared community org ({getGuardianConfig().orgName}). Needed for publishing builds.
              </p>
              <input
                type="password"
                data-testid="input-shared-pat"
                value={settingsSharedPat}
                onChange={e => setSettingsSharedPat(e.target.value)}
                placeholder="ghp_..."
                className="w-full bg-background border border-border/50 rounded px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Key className="w-3 h-3" /> GitHub — Personal PAT (optional)
              </p>
              <p className="text-[9px] text-muted-foreground/60 mb-1">
                Your personal GitHub token. Used instead of shared PAT when set. Pushes to your account.
              </p>
              <input
                type="password"
                data-testid="input-user-pat"
                value={settingsUserPat}
                onChange={e => setSettingsUserPat(e.target.value)}
                placeholder="ghp_..."
                className="w-full bg-background border border-border/50 rounded px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
            </div>

            <div className="border-t border-border/30 pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Bot className="w-3 h-3" /> Ollama Toaster — Endpoint
              </p>
              <input
                type="text"
                data-testid="input-ollama-endpoint"
                value={settingsOllamaEndpoint}
                onChange={e => setSettingsOllamaEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full bg-background border border-border/50 rounded px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Bot className="w-3 h-3" /> Ollama Toaster — Model
              </p>
              <p className="text-[9px] text-muted-foreground/60 mb-1">
                Recommended: qwen2.5-coder:7b, llama3.2:3b, phi-3.5-mini
              </p>
              <input
                type="text"
                data-testid="input-ollama-model"
                value={settingsOllamaModel}
                onChange={e => setSettingsOllamaModel(e.target.value)}
                placeholder="qwen2.5-coder:7b"
                className="w-full bg-background border border-border/50 rounded px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                data-testid="button-save-settings"
                onClick={() => {
                  setSharedPat(settingsSharedPat);
                  setUserPat(settingsUserPat || null);
                  const newConfig = { endpoint: settingsOllamaEndpoint, model: settingsOllamaModel };
                  saveToasterConfig(newConfig);
                  setToasterConfig(newConfig);
                  clearAvailabilityCache();
                  clearResolvedModelCache();
                  checkToasterAvailability(newConfig).then(setToasterAvailability);
                  setShowSettings(false);
                  setStatusMessage('Settings saved');
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-bold bg-primary/20 text-primary hover:bg-primary/30 transition-colors border border-primary/30"
              >
                <Check className="w-3 h-3" /> Save
              </button>
              <button
                data-testid="button-cancel-settings"
                onClick={() => setShowSettings(false)}
                className="px-3 py-1.5 rounded text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <ParallaxPortal wall="top">
      <div className="shrink-0 border-b border-border/40 bg-card/60">
        <div className="px-3 py-1.5 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--terminal-amber))]" />
            <span className="text-[11px] font-bold text-foreground">AI Bridge</span>
          </div>

          <button
            data-testid="button-toggle-project-panel"
            onClick={() => setShowProjectPanel(p => !p)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors border shrink-0 ${
              activeProject
                ? 'bg-[hsl(150_60%_40%/0.15)] text-[hsl(150_60%_55%)] border-[hsl(150_60%_40%/0.3)]'
                : 'bg-secondary/30 text-muted-foreground border-border/30 hover:bg-secondary/50'
            }`}
          >
            <FolderOpen className="w-3 h-3" />
            {activeProject || 'Main App'}
            {showProjectPanel ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              data-testid="button-duplicate-app"
              onClick={async () => {
                let dupName: string | null = null;
                if (activeProject) {
                  dupName = await duplicateCurrentProject(activeProject);
                } else {
                  try { dupName = await duplicateMainApp(); } catch {}
                }
                if (dupName) {
                  setStatusMessage(`✓ Duplicated → "${dupName}" — starting preview...`);
                  const port = await startProjectPreview(dupName);
                  if (port) {
                    setStatusMessage(`✓ Duplicated → "${dupName}", preview on port ${port}`);
                  } else {
                    setStatusMessage(`✓ Duplicated → "${dupName}" (preview may take a moment)`);
                  }
                }
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-secondary/30 text-muted-foreground hover:bg-secondary/50 transition-colors border border-border/30"
            >
              <Copy className="w-3 h-3" />
              Duplicate
            </button>
            {activeProject && (
              <button
                data-testid="button-start-preview"
                onClick={startPreview}
                disabled={previewLoading}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-[hsl(150_60%_40%/0.15)] text-[hsl(150_60%_55%)] hover:bg-[hsl(150_60%_40%/0.25)] transition-colors border border-[hsl(150_60%_40%/0.3)] disabled:opacity-40"
              >
                {previewLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Preview
              </button>
            )}
            {previewPanels.length > 0 && (
              <>
                <div className="flex items-center gap-0.5 mr-1">
                  {previewPanels.map(p => (
                    <button
                      key={p.id}
                      data-testid={`button-panel-dot-${p.id}`}
                      onClick={() => { setActivePanelId(p.id); setActiveProjectState(p.projectName); persistActiveProject(p.projectName); }}
                      title={p.projectName ?? 'Lamby'}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        p.id === (activePanelId ?? previewPanels[0]?.id)
                          ? 'bg-primary'
                          : 'bg-muted-foreground/30 hover:bg-muted-foreground/60'
                      }`}
                    />
                  ))}
                </div>
                <button
                  data-testid="button-toggle-preview"
                  onClick={() => { if (activePanel) setActivePanelId(activePanel.id); }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-colors border bg-primary/20 text-primary border-primary/30"
                >
                  <Monitor className="w-3 h-3" /> {previewPort === -1 ? 'λ' : previewPort ? `:${previewPort}` : '…'}
                </button>
                <button
                  data-testid="button-refresh-preview"
                  onClick={() => bumpActivePanelKey()}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-[hsl(200_60%_40%/0.15)] text-[hsl(200_60%_55%)] hover:bg-[hsl(200_60%_40%/0.25)] transition-colors border border-[hsl(200_60%_40%/0.3)]"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                {previewPort && (
                  <a href={previewPort === -1 ? ((window as any).__mainAppPreviewUrl || window.location.origin) : `http://localhost:${previewPort}`} target="_blank" rel="noopener noreferrer" data-testid="link-preview-external" className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-secondary/30 text-muted-foreground hover:bg-secondary/50 transition-colors border border-border/30">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button data-testid="button-stop-preview" onClick={() => { if (activePanel) closePanel(activePanel.id); }} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border border-destructive/20">
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
            {activeProject && (
              <button
                data-testid="button-publish-community"
                onClick={() => { setPublishDescription(''); setShowPublishDialog(true); }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-[hsl(280_60%_50%/0.15)] text-[hsl(280_60%_65%)] hover:bg-[hsl(280_60%_50%/0.25)] transition-colors border border-[hsl(280_60%_50%/0.3)]"
              >
                <Upload className="w-3 h-3" /> Publish
              </button>
            )}
          </div>

          <div className="flex items-center gap-0.5 bg-secondary/40 rounded-md p-0.5 shrink-0">
            <button
              onClick={() => setMode('browser')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                mode === 'browser' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="w-3 h-3" /> Browser
            </button>
            <button
              onClick={() => setMode('api')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                mode === 'api' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare className="w-3 h-3" /> API
            </button>
          </div>

          <button
            onClick={() => toggleAutoApply(!autoApplyEnabled)}
            data-testid="button-auto-apply-toggle"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors shrink-0 ${
              autoApplyEnabled ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-secondary/40 text-muted-foreground hover:text-foreground border border-transparent'
            }`}
            title={autoApplyEnabled ? 'Auto-apply ON — safe changes apply automatically' : 'Auto-apply OFF — all changes require confirmation'}
          >
            <Zap className={`w-3 h-3 ${autoApplyEnabled ? 'fill-green-400' : ''}`} />
            Auto
          </button>

          <button
            onClick={() => {
              if (autonomousState.enabled) {
                stopAutonomousLoop();
              } else {
                if (!autoApplyEnabled) toggleAutoApply(true);
                dispatchAutonomous({ type: 'START', goal: '' });
              }
            }}
            data-testid="button-autonomous-toggle"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors shrink-0 ${
              autonomousState.enabled
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-secondary/40 text-muted-foreground hover:text-foreground border border-transparent'
            }`}
            title={autonomousState.enabled ? 'Autonomous Mode ON — auto-fix loop active' : 'Autonomous Mode OFF — enable for auto-retry on errors'}
          >
            <RefreshCw className={`w-3 h-3 ${autonomousState.enabled ? 'animate-spin' : ''}`} style={autonomousState.enabled ? { animationDuration: '3s' } : undefined} />
            Loop
          </button>

          <button
            onClick={() => {
              const next = !visionEnabled;
              setVisionEnabled(next);
              localStorage.setItem('lamby-vision', String(next));
              setStatusMessage(next ? 'Vision enabled — llava will analyze preview screenshots' : 'Vision disabled');
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              handleVisionCapture();
            }}
            disabled={!visionAvailable && !visionEnabled}
            data-testid="button-vision-toggle"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors shrink-0 ${
              visionEnabled
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-secondary/40 text-muted-foreground hover:text-foreground border border-transparent'
            } ${!visionAvailable && !visionEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={
              !visionAvailable && !visionEnabled
                ? 'Vision unavailable — llava model not found in Ollama'
                : visionEnabled
                  ? 'Vision ON — double-click to manually capture & analyze preview'
                  : 'Vision OFF — enable to auto-detect visual issues'
            }
          >
            <Eye className={`w-3 h-3 ${visionAnalyzing ? 'animate-pulse' : ''}`} />
            Vision
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => copyContextToClipboard()}
              disabled={contextLoading || !projectContext}
              data-testid="button-copy-context"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 disabled:opacity-40"
            >
              {contextLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code2 className="w-3 h-3" />}
              Context
            </button>
            <button
              onClick={async () => {
                const urlToCopy = externalSnapshotUrl || snapshotUrl || '';
                if (urlToCopy) {
                  try {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      await navigator.clipboard.writeText(urlToCopy);
                    } else if (typeof window !== 'undefined' && (window as any).require) {
                      (window as any).require('electron').clipboard.writeText(urlToCopy);
                    }
                    setStatusMessage('Snapshot URL copied');
                    setTimeout(() => setStatusMessage(null), 2000);
                  } catch { setStatusMessage('Failed to copy URL'); setTimeout(() => setStatusMessage(null), 2000); }
                } else {
                  setStatusMessage('No URL available — connect bridge first');
                  setTimeout(() => setStatusMessage(null), 2000);
                }
              }}
              data-testid="button-copy-url"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/20"
              title="Copy the snapshot URL to clipboard"
            >
              <Key className="w-3 h-3" />
              URL
            </button>
            <button
              onClick={copyEvolutionContext}
              disabled={evolutionLoading}
              data-testid="button-evolution-context"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-[hsl(280_80%_55%/0.15)] text-[hsl(280_80%_65%)] hover:bg-[hsl(280_80%_55%/0.25)] transition-colors border border-[hsl(280_80%_55%/0.3)] disabled:opacity-40"
            >
              {evolutionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Dna className="w-3 h-3" />}
              Evolve
              {currentPlan && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-[hsl(280_80%_55%)] animate-pulse" />}
            </button>
            {lastErrors && (
              <button
                onClick={() => buildErrorFeedback(lastErrors)}
                data-testid="button-send-errors-top"
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border border-destructive/20"
              >
                <AlertTriangle className="w-3 h-3" /> Errors
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowBridgeSettings(prev => !prev)}
                data-testid="button-bridge-status"
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] transition-colors border ${
                  bridgeStatus === 'connected' || bridgeStatus === 'web-mode'
                    ? 'bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20'
                    : bridgeStatus === 'connecting'
                    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/20'
                    : 'bg-muted/50 text-muted-foreground/60 border-border/30 hover:bg-muted'
                }`}
                title={`Bridge: ${bridgeStatus}${snapshotUrl ? '\n' + snapshotUrl : ''}`}
              >
                <Globe className="w-3 h-3" />
                Bridge
                <span className={`w-1.5 h-1.5 rounded-full ${
                  bridgeStatus === 'connected' || bridgeStatus === 'web-mode' ? 'bg-green-500' :
                  bridgeStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-muted-foreground/40'
                }`} />
              </button>
              {showBridgeSettings && (
                <div className="absolute top-full right-0 mt-1 w-80 bg-card border border-border rounded-lg shadow-xl z-50 p-3 text-[10px]" data-testid="bridge-settings-panel">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">Snapshot Bridge</span>
                    <button onClick={() => setShowBridgeSettings(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                  </div>
                  <p className="text-muted-foreground mb-2">Give this URL to any AI that can browse the web — it will see your full project files.</p>
                  {snapshotUrl ? (
                    <div className="flex items-center gap-1 mb-2 p-1.5 bg-muted/50 rounded border border-border">
                      <code className="flex-1 text-[9px] text-foreground/80 break-all select-all">{snapshotUrl}</code>
                      <button
                        data-testid="button-copy-snapshot-url"
                        onClick={async () => {
                          try {
                            if (isElectron) {
                              (window as any).require('electron').clipboard.writeText(snapshotUrl);
                            } else {
                              await navigator.clipboard.writeText(snapshotUrl);
                            }
                            setStatusMessage('Snapshot URL copied');
                          } catch {}
                        }}
                        className="shrink-0 p-1 hover:bg-primary/10 rounded"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-yellow-500 mb-2">No snapshot URL available yet.</p>
                  )}
                  <div className="flex items-center gap-1 mb-2">
                    <span className={`w-2 h-2 rounded-full ${
                      bridgeStatus === 'connected' || bridgeStatus === 'web-mode' ? 'bg-green-500' :
                      bridgeStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                      bridgeStatus === 'not-configured' ? 'bg-muted-foreground/40' : 'bg-red-500'
                    }`} />
                    <span className="text-muted-foreground">
                      {bridgeStatus === 'connected' ? 'Connected to relay' :
                       bridgeStatus === 'web-mode' ? 'Direct (running on Replit)' :
                       bridgeStatus === 'connecting' ? 'Connecting...' :
                       bridgeStatus === 'not-configured' ? 'Not configured' :
                       bridgeStatus === 'disconnected' ? 'Disconnected' : `Status: ${bridgeStatus}`}
                    </span>
                  </div>
                  {(bridgeStatus === 'connected' || bridgeStatus === 'web-mode') && bridgeRelayUrl && (
                    <div className="text-[9px] space-y-0.5 mt-1 border-t border-border pt-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground/70 shrink-0">Relay:</span>
                        <code data-testid="text-relay-url" className="text-muted-foreground truncate select-all">{bridgeRelayUrl}</code>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground/70 shrink-0">Auth:</span>
                        <code data-testid="text-snapshot-key" className="text-muted-foreground truncate select-all font-mono">none (URL is secret)</code>
                      </div>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="text-muted-foreground font-medium mb-1.5">Relay Mode</div>
                    <div className="flex items-center gap-1" data-testid="bridge-mode-toggle">
                      <button
                        data-testid="button-mode-dev"
                        onClick={async () => {
                          setBridgeMode('dev');
                          try { localStorage.setItem('lamby-bridge-mode', 'dev'); } catch {}
                          const devUrl = serverDevRelayUrl || 'wss://35c4f698-dc00-400a-9452-39eaf17279c0-00-31k27xn7snnel.janeway.replit.dev';
                          const base = devUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '');
                          setBridgeRelayUrl(devUrl);
                          setSnapshotUrl(`${base}/api/snapshot/${activeProject || 'PROJECT_NAME'}`);
                          setCommandEndpoint(`${base}/api/sandbox/execute`);
                          setExternalSnapshotUrl(`${base}/api/snapshot/${activeProject || 'PROJECT_NAME'}`);
                          setExternalCommandEndpoint(`${base}/api/sandbox/execute`);
                          if (isElectron) {
                            const proj = activeProject || 'default';
                            setBridgeStatus('connecting');
                            try {
                              await fetch('http://localhost:4999/api/bridge-config-save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relayUrl: devUrl, projectName: proj }) });
                            } catch (e) { console.log('[Bridge] bridge-config-save failed:', e); }
                            pollDesktopBridgeStatus();
                          } else {
                            connectToBridge(devUrl, activeProject || 'default');
                          }
                        }}
                        className={`flex-1 px-2 py-1 rounded text-[9px] border transition-colors ${
                          bridgeMode === 'dev'
                            ? 'bg-blue-500/15 text-blue-500 border-blue-500/30'
                            : 'bg-muted/50 text-muted-foreground border-border/30 hover:bg-muted'
                        }`}
                      >
                        Dev
                      </button>
                      <button
                        data-testid="button-mode-production"
                        onClick={async () => {
                          const prodUrl = 'wss://bridge-relay.replit.app';
                          const prodBase = 'https://bridge-relay.replit.app';
                          setBridgeMode('production');
                          try { localStorage.setItem('lamby-bridge-mode', 'production'); } catch {}
                          setBridgeRelayUrl(prodUrl);
                          setSnapshotUrl(`${prodBase}/api/snapshot/${activeProject || 'PROJECT_NAME'}`);
                          setCommandEndpoint(`${prodBase}/api/sandbox/execute`);
                          setExternalSnapshotUrl(`${prodBase}/api/snapshot/${activeProject || 'PROJECT_NAME'}`);
                          setExternalCommandEndpoint(`${prodBase}/api/sandbox/execute`);
                          if (isElectron) {
                            const proj = activeProject || 'default';
                            setBridgeStatus('connecting');
                            try {
                              await fetch('http://localhost:4999/api/bridge-config-save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relayUrl: prodUrl, projectName: proj }) });
                            } catch (e) { console.log('[Bridge] bridge-config-save failed:', e); }
                            pollDesktopBridgeStatus();
                          } else {
                            connectToBridge(prodUrl, activeProject || 'default');
                          }
                        }}
                        className={`flex-1 px-2 py-1 rounded text-[9px] border transition-colors ${
                          bridgeMode === 'production'
                            ? 'bg-green-500/15 text-green-500 border-green-500/30'
                            : 'bg-muted/50 text-muted-foreground border-border/30 hover:bg-muted'
                        }`}
                      >
                        Production
                      </button>
                    </div>
                    <p className="text-muted-foreground/60 mt-1">
                      {bridgeMode === 'dev' ? `Dev: ${serverDevRelayUrl || 'dev relay'}` : 'Prod: wss://bridge-relay.replit.app'}
                    </p>
                  </div>
                  {isElectron && (
                    <div className="border-t border-border pt-2 mt-2 space-y-1.5">
                      <div className="text-muted-foreground font-medium">Relay Settings</div>
                      <input
                        data-testid="input-relay-url"
                        type="text"
                        placeholder="Relay URL (e.g. https://my-lamby.replit.app)"
                        value={bridgeRelayInput}
                        onChange={e => setBridgeRelayInput(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-border bg-background text-foreground text-[10px]"
                      />
                      <div className="flex gap-1">
                        <button
                          data-testid="button-save-bridge-config"
                          onClick={async () => {
                            if (!bridgeRelayInput.trim()) return;
                            try {
                              let result: any;
                              if (isElectron) {
                                try {
                                  const ipcRenderer = (window as any).require('electron').ipcRenderer;
                                  result = await ipcRenderer.invoke('bridge-config-save', {
                                    relayUrl: bridgeRelayInput.trim(),
                                  });
                                } catch {
                                  const res = await fetch('http://localhost:4999/api/bridge-config-save', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ relayUrl: bridgeRelayInput.trim() }),
                                  });
                                  result = await res.json();
                                }
                              }
                              setStatusMessage(result?.success ? 'Bridge config saved — reconnecting...' : `Config save failed: ${result?.error || 'unknown'}`);
                            } catch (e: any) { setStatusMessage(`Error: ${e.message}`); }
                          }}
                          className="flex-1 px-2 py-1 rounded text-[9px] bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                        >
                          Save & Connect
                        </button>
                        <button
                          data-testid="button-reconnect-bridge"
                          onClick={async () => {
                            if (isElectron) {
                              try {
                                const ipcRenderer = (window as any).require('electron').ipcRenderer;
                                await ipcRenderer.invoke('bridge-reconnect');
                                setStatusMessage('Bridge reconnecting...');
                              } catch {
                                try { await fetch('http://localhost:4999/api/bridge-reconnect'); setStatusMessage('Bridge reconnecting...'); } catch {}
                              }
                            } else {
                              if (bridgeWsRef.current) { try { bridgeWsRef.current.close(); } catch {} bridgeWsRef.current = null; }
                              const url = bridgeRelayUrl || serverDevRelayUrl || 'wss://35c4f698-dc00-400a-9452-39eaf17279c0-00-31k27xn7snnel.janeway.replit.dev';
                              connectToBridge(url, activeProject || 'default');
                            }
                          }}
                          className="px-2 py-1 rounded text-[9px] bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {toasterAvailability !== null && (
            <div className="relative shrink-0">
              <button
                onClick={() => setToasterChatOpen(prev => !prev)}
                onContextMenu={async (e) => {
                  e.preventDefault();
                  clearAvailabilityCache();
                  clearResolvedModelCache();
                  const result = await checkToasterAvailability(toasterConfig);
                  setToasterAvailability(result);
                  if (result.available) {
                    setStatusMessage(`Toaster connected — ${result.models.length} model${result.models.length !== 1 ? 's' : ''}: ${result.models.slice(0, 3).join(', ')}${result.version ? ` (v${result.version})` : ''}`);
                    fireToasterReadyTest(toasterConfig);
                  } else {
                    setStatusMessage(`Toaster: ${result.error || 'Connection failed'}`);
                    setToasterReadyMsg(null);
                    setResolvedModelName(null);
                    setTestedModelName(null);
                  }
                }}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border cursor-pointer transition-colors ${
                  toasterAvailability.available
                    ? testedModelName
                      ? 'bg-[hsl(150_60%_40%/0.15)] text-[hsl(150_60%_55%)] border-[hsl(150_60%_40%/0.3)] hover:bg-[hsl(150_60%_40%/0.25)]'
                      : 'bg-[hsl(45_80%_40%/0.1)] text-[hsl(45_80%_60%)] border-[hsl(45_80%_40%/0.2)] hover:bg-[hsl(45_80%_40%/0.2)]'
                    : 'bg-secondary/20 text-muted-foreground/50 border-border/20 hover:bg-secondary/40 hover:text-muted-foreground'
                }`}
                data-testid="button-ollama-toaster"
                title={toasterAvailability.available
                  ? `Connected — ${toasterAvailability.models.slice(0, 3).join(', ')}${toasterAvailability.version ? ` (v${toasterAvailability.version})` : ''}${resolvedModelName ? `\nUsing: ${resolvedModelName}` : ''}\nClick to open chat · Right-click to re-ping`
                  : `${toasterAvailability.error || 'Not connected'}\nClick to open chat · Right-click to retry`
                }
              >
                {toasterTestPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Bot className="w-3 h-3" />
                )}
                {toasterLoading ? (
                  <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Analyzing...</>
                ) : toasterAvailability.available ? (
                  <span>{testedModelName ? `🍞 ${testedModelName.split(':')[0]}` : resolvedModelName ? `⟳ ${resolvedModelName.split(':')[0]}` : 'Toaster ⟳'}</span>
                ) : (
                  <span>Toaster off</span>
                )}
              </button>
            </div>
          )}

          {toasterChatOpen && (
            <div
              className="fixed z-[9999] flex flex-col rounded-lg shadow-2xl border overflow-hidden"
              style={{
                bottom: '52px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'min(400px, 90vw)',
                maxHeight: 'min(360px, 50vh)',
                background: 'hsl(220, 25%, 10%)',
                borderColor: toasterAvailability?.available ? 'hsla(150, 60%, 35%, 0.4)' : 'hsla(0, 0%, 40%, 0.3)',
                animation: 'toasterBubbleIn 0.2s ease-out',
              }}
              data-testid="panel-toaster-chat"
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30" style={{ background: 'hsl(220, 25%, 13%)' }}>
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Bot className="w-3 h-3" />
                  Toaster Chat
                  {resolvedModelName && <span className="text-[9px] opacity-60">({resolvedModelName})</span>}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={async () => {
                      clearAvailabilityCache();
                      clearResolvedModelCache();
                      const result = await checkToasterAvailability(toasterConfig);
                      setToasterAvailability(result);
                      if (result.available) {
                        fireToasterReadyTest(toasterConfig);
                        setStatusMessage(`Toaster connected — ${result.models.length} model${result.models.length !== 1 ? 's' : ''}`);
                      } else {
                        setStatusMessage(`Toaster: ${result.error || 'Connection failed'}`);
                      }
                    }}
                    className={`text-[9px] px-1.5 py-0.5 rounded border ${
                      toasterAvailability?.available
                        ? 'bg-[hsl(150_60%_40%/0.1)] text-[hsl(150_60%_55%)] border-[hsl(150_60%_40%/0.2)] hover:bg-[hsl(150_60%_40%/0.2)]'
                        : 'bg-[hsl(45_80%_40%/0.15)] text-[hsl(45_80%_60%)] border-[hsl(45_80%_40%/0.2)] hover:bg-[hsl(45_80%_40%/0.25)]'
                    }`}
                    data-testid="button-toaster-ping"
                  >
                    {toasterTestPending ? 'Pinging...' : toasterAvailability?.available ? 'Ping' : 'Retry'}
                  </button>
                  <button
                    onClick={() => setToasterChatOpen(false)}
                    className="text-muted-foreground/60 hover:text-muted-foreground px-1"
                    data-testid="button-toaster-chat-close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div ref={toasterChatScrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[60px]" style={{ maxHeight: 'min(240px, 35vh)' }}>
                {toasterChatMessages.length === 0 && !toasterChatPending && (
                  <div className="text-[10px] text-muted-foreground/50 text-center py-4">
                    {toasterAvailability?.available
                      ? `Type a message to test Ollama (${resolvedModelName || 'auto-detect'})`
                      : `Ollama not detected at ${toasterConfig.endpoint}\nMake sure Ollama is running and has at least one model installed.`
                    }
                  </div>
                )}
                {toasterReadyMsg && toasterChatMessages.length === 0 && (
                  <div className={`text-[10px] px-2 py-1.5 rounded ${
                    toasterReadyMsg.startsWith('Test failed')
                      ? 'bg-[hsl(0_60%_15%)] text-[hsl(0_80%_75%)] border border-[hsl(0_60%_40%/0.3)]'
                      : toasterReadyMsg.includes('...')
                        ? 'bg-[hsl(220_40%_15%)] text-[hsl(220_60%_75%)] border border-[hsl(220_40%_40%/0.3)]'
                        : 'bg-[hsl(150_60%_12%)] text-[hsl(150_70%_75%)] border border-[hsl(150_60%_35%/0.3)]'
                  }`}>
                    {toasterReadyMsg.includes('...') && <Loader2 className="w-3 h-3 animate-spin inline mr-1.5 -mt-0.5" />}
                    {toasterReadyMsg.startsWith('Test failed') ? '⚠ ' : !toasterReadyMsg.includes('...') ? '🍞 ' : ''}
                    {toasterReadyMsg}
                  </div>
                )}
                {toasterChatMessages.map((msg, i) => (
                  <div key={i} className={`text-[10px] px-2 py-1.5 rounded whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-[hsl(220_40%_18%)] text-[hsl(220_60%_80%)] ml-6'
                      : 'bg-[hsl(150_30%_14%)] text-[hsl(150_40%_80%)] mr-6'
                  }`} data-testid={`text-toaster-msg-${i}`}>
                    {msg.text}
                  </div>
                ))}
                {toasterChatPending && (
                  <div className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5 px-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
                  </div>
                )}
              </div>

              <form
                className="flex items-center gap-1.5 px-2 py-1.5 border-t border-border/30"
                style={{ background: 'hsl(220, 25%, 12%)' }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const msg = toasterChatInput.trim();
                  if (!msg || toasterChatPending) return;
                  setToasterChatInput('');
                  setToasterChatMessages(prev => [...prev, { role: 'user', text: msg }]);
                  setToasterChatPending(true);
                  setTimeout(() => toasterChatScrollRef.current?.scrollTo({ top: 999999 }), 50);
                  try {
                    if (!toasterAvailability?.available) {
                      clearAvailabilityCache();
                      clearResolvedModelCache();
                      const result = await checkToasterAvailability(toasterConfig);
                      setToasterAvailability(result);
                      if (!result.available) {
                        setToasterChatMessages(prev => [...prev, { role: 'assistant', text: `Cannot connect to Ollama at ${toasterConfig.endpoint}. Is it running?` }]);
                        return;
                      }
                      fireToasterReadyTest(toasterConfig);
                    }
                    const result = await toasterChat(msg, toasterConfig);
                    if (!resolvedModelName) setResolvedModelName(result.model);
                    setToasterChatMessages(prev => [...prev, { role: 'assistant', text: result.reply || '(empty response)' }]);
                  } catch (err: any) {
                    setToasterChatMessages(prev => [...prev, { role: 'assistant', text: `Error: ${err.message || 'Unknown error'}` }]);
                  } finally {
                    setToasterChatPending(false);
                    setTimeout(() => {
                      toasterChatScrollRef.current?.scrollTo({ top: 999999 });
                      toasterChatInputRef.current?.focus();
                    }, 50);
                  }
                }}
                data-testid="form-toaster-chat"
              >
                <input
                  ref={toasterChatInputRef}
                  type="text"
                  value={toasterChatInput}
                  onChange={e => setToasterChatInput(e.target.value)}
                  placeholder={toasterAvailability?.available ? 'Say something to test Ollama...' : 'Ollama offline — type to retry...'}
                  className="flex-1 bg-[hsl(220_20%_16%)] text-[11px] text-foreground rounded px-2 py-1.5 border border-border/20 focus:outline-none focus:border-[hsl(150_60%_40%/0.4)] placeholder:text-muted-foreground/30"
                  disabled={toasterChatPending}
                  autoFocus
                  data-testid="input-toaster-chat"
                />
                <button
                  type="submit"
                  disabled={toasterChatPending || !toasterChatInput.trim()}
                  className="px-2 py-1.5 rounded text-[10px] font-medium bg-[hsl(150_60%_40%/0.2)] text-[hsl(150_60%_55%)] border border-[hsl(150_60%_40%/0.3)] hover:bg-[hsl(150_60%_40%/0.3)] disabled:opacity-30 disabled:cursor-not-allowed"
                  data-testid="button-toaster-send"
                >
                  Send
                </button>
              </form>
            </div>
          )}

          <button
            data-testid="button-open-settings"
            onClick={() => {
              const cfg = getGuardianConfig();
              const tc = loadToasterConfig();
              setSettingsSharedPat(cfg.sharedPat);
              setSettingsUserPat(cfg.userPat || '');
              setSettingsOllamaEndpoint(tc.endpoint);
              setSettingsOllamaModel(tc.model);
              setShowSettings(prev => !prev);
            }}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border shrink-0 transition-colors ${
              showSettings
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-secondary/20 text-muted-foreground/50 border-border/20 hover:text-foreground hover:border-border/40'
            }`}
          >
            <Settings className="w-3 h-3" />
          </button>

          {lastToasterAnalysis && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border shrink-0 bg-[hsl(280_60%_50%/0.1)] text-[hsl(280_60%_65%)] border-[hsl(280_60%_50%/0.2)]" data-testid="status-toaster-analysis">
              <Zap className="w-2.5 h-2.5" />
              <span className="truncate max-w-[150px]" title={lastToasterAnalysis.error_summary}>
                {lastToasterAnalysis.priority}: {lastToasterAnalysis.affected_files.length} file{lastToasterAnalysis.affected_files.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {mode === 'browser' && isElectron && (
            <span className="text-[8px] text-muted-foreground/50 font-mono" data-testid="text-browser-mode-version">{BROWSER_MODE_VERSION}</span>
          )}

          {statusMessage && (
            <span className="text-[9px] text-primary/70 truncate max-w-[400px]" title={statusMessage} data-testid="text-status-message">{statusMessage}</span>
          )}

          {autonomousState.enabled && autonomousState.phase !== 'idle' && (
            <div
              data-testid="autonomous-status-panel"
              className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all ${
                autonomousState.phase === 'success'
                  ? 'bg-green-500/15 text-green-400 border-green-500/30'
                  : autonomousState.phase === 'failed'
                  ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
              }`}
            >
              {autonomousState.phase === 'success' ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
              ) : autonomousState.phase === 'failed' ? (
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              ) : autonomousState.phase === 'waiting' ? (
                <span className="tabular-nums font-mono text-orange-400">{autonomousState.countdownSeconds}s</span>
              ) : (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              <span className={phaseColor(autonomousState.phase)} data-testid="text-autonomous-phase">
                {formatPhaseLabel(autonomousState.phase)}
              </span>
              {autonomousState.attempt > 0 && autonomousState.phase !== 'success' && (
                <span className="text-muted-foreground/60 tabular-nums" data-testid="text-autonomous-attempt">
                  {autonomousState.attempt}/{autonomousState.maxAttempts}
                </span>
              )}
              {(autonomousState.phase === 'success' || autonomousState.phase === 'failed') && (
                <button
                  onClick={() => dispatchAutonomous({ type: 'RESET' })}
                  data-testid="button-autonomous-dismiss"
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {autonomousState.phase !== 'success' && autonomousState.phase !== 'failed' && (
                <button
                  onClick={stopAutonomousLoop}
                  data-testid="button-autonomous-stop"
                  className="ml-1 text-muted-foreground hover:text-red-400"
                  title="Stop autonomous loop"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {autoApplyUndoVisible && (
            <button
              onClick={undoAutoApply}
              data-testid="button-auto-apply-undo"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 animate-pulse"
            >
              <Undo2 className="w-3 h-3" /> Undo
            </button>
          )}

          {appliedChanges.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5 overflow-x-auto shrink-0">
              <button
                data-testid="button-undo-all"
                onClick={undoAll}
                disabled={undoAllInProgress}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors border border-destructive/40 shrink-0"
              >
                {undoAllInProgress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                UNDO {appliedChanges.length > 1 ? `ALL (${appliedChanges.length})` : appliedChanges[0].filePath.split('/').pop()}
              </button>
              {appliedChanges.length > 1 && appliedChanges.slice(-2).map((change, i) => (
                <button key={i} onClick={() => rollback(change)} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/30 text-muted-foreground hover:bg-destructive/10 hover:text-destructive text-[8px] transition-colors shrink-0 group" title={`Undo ${change.filePath}`}>
                  <FileCode className="w-2.5 h-2.5" />
                  {change.filePath.split('/').pop()}
                  <Undo2 className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      </ParallaxPortal>

      {/* ── Unified Layout — Browser/API toggle only swaps main content area ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {showProjectPanel && (
            <div className="w-52 border-r border-border/30 bg-card/30 shrink-0 overflow-auto">
              <ProjectExplorer activeProject={activeProject} onSelectProject={handleSelectProject} onFileSelect={(path, content) => setStatusMessage(`Viewing: ${path} (${content.length} chars)`)} onFileEdit={handleFileEdit} openPanelNames={openPanelNames} />
            </div>
        )}
        {editorFile && (
          <div className="border-r border-border/30 flex flex-col" style={{ flex: '1 1 40%', minWidth: 0 }}>
            <FileEditor
              filePath={editorFile.path}
              content={editorFile.content}
              projectName={activeProject || '__main__'}
              onSave={handleEditorSave}
              onClose={handleEditorClose}
              onSendToGrok={handleEditorSendToGrok}
            />
          </div>
        )}

        <div ref={innerRowRef} className="flex-1 flex min-h-0 overflow-hidden">
          {/* Main content area — switches between Browser and API */}
          {!previewExpanded && (
          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto" style={showPreviewEmbed && previewPort ? { flex: '1 1 50%' } : undefined}>
            {mode === 'browser' && (
              <GrokDesktopBrowser browserUrl={browserUrl} setBrowserUrl={setBrowserUrl} customUrl={customUrl} setCustomUrl={setCustomUrl} />
            )}

            {mode === 'api' && (
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Conversations sidebar */}
                <div className="w-48 border-r border-border/30 bg-card/30 flex flex-col shrink-0">
                  <div className="p-2 border-b border-border/30">
                    <button onClick={newConversation} className="w-full px-2 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-medium transition-colors">
                      + New Chat
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-1.5 space-y-0.5">
                    {conversations.map(c => (
                      <div
                        key={c.id}
                        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors text-[10px] ${
                          c.id === activeConvoId ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary/50'
                        }`}
                        onClick={() => switchConversation(c.id)}
                      >
                        <span className="flex-1 truncate">{c.title}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity">
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    {conversations.length === 0 && (
                      <p className="text-[9px] text-muted-foreground/40 text-center py-4">No conversations yet</p>
                    )}
                  </div>
                </div>

                {/* Chat area */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Model picker header */}
                  <div className="shrink-0 border-b border-border/30 bg-card/30 px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/50">Grok API — direct streaming</span>
                    <div className="relative">
                      <button onClick={() => setShowModelPicker(!showModelPicker)} className="flex items-center gap-1 px-2 py-1 rounded bg-secondary/50 hover:bg-secondary/80 text-[10px] text-muted-foreground transition-colors">
                        {selectedModel.name} <ChevronDown className="w-3 h-3" />
                      </button>
                      {showModelPicker && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border/50 rounded-lg shadow-xl z-50 overflow-hidden">
                          {MODELS.map(m => (
                            <button key={m.id} onClick={() => { setModel(m.id); setShowModelPicker(false); }} className={`w-full text-left px-3 py-2 text-[10px] transition-colors flex items-center justify-between ${m.id === model ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-secondary/50'}`}>
                              <div><div className="font-medium">{m.name}</div><div className="text-[9px] text-muted-foreground">{m.desc}</div></div>
                              {m.id === model && <Check className="w-3 h-3 text-primary" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-auto p-5 space-y-4">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
                        <Bot className="w-10 h-10 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Chat with Grok via API</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">Code blocks are auto-validated and one-click applied</p>
                          <p className="text-[9px] text-muted-foreground/40 mt-2">{selectedModel.name} — {selectedModel.desc}</p>
                        </div>
                      </div>
                    )}
                    {messages.map((msg, i) => renderMessage(msg, i))}
                    {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-accent/30 flex items-center justify-center shrink-0">
                          <Loader2 className="w-3.5 h-3.5 text-accent-foreground animate-spin" />
                        </div>
                        <div className="text-xs text-muted-foreground">Thinking...</div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input */}
                  <div className="shrink-0 border-t border-border/50 bg-card/50 p-4">
                    {knowledgeMatches.length > 0 && messages.length === 0 && (
                      <div className="mb-2 px-3 py-1.5 rounded bg-[hsl(280_60%_50%/0.1)] border border-[hsl(280_60%_50%/0.25)] flex items-center gap-2 flex-wrap" data-testid="indicator-built-before">
                        <Dna className="w-3.5 h-3.5 text-[hsl(280_60%_65%)] shrink-0" />
                        <span className="text-[10px] text-[hsl(280_60%_65%)] font-medium" data-testid="text-built-before-count">
                          Similar apps have been built {knowledgeMatches.reduce((sum, m) => sum + (m.entry.stars || 0), 0) || knowledgeMatches.length} time{knowledgeMatches.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[9px] text-[hsl(280_60%_65%/0.7)]">
                          Grok will pick the best starting point
                        </span>
                      </div>
                    )}
                    <div className="flex gap-3 items-end">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => {
                          setInput(e.target.value);
                          if (messages.length === 0 && e.target.value.trim().length > 3) {
                            const matches = searchKnowledge(e.target.value.trim());
                            setKnowledgeMatches(matches);
                          } else if (e.target.value.trim().length <= 3) {
                            setKnowledgeMatches([]);
                          }
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Grok to modify code... (Enter to send)"
                        rows={1}
                        className="flex-1 bg-background border border-border/50 rounded-lg px-4 py-3 text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/30 font-mono min-h-[44px] max-h-32"
                        style={{ height: 'auto', overflow: 'hidden' }}
                        onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 128) + 'px'; }}
                      />
                      <button onClick={sendMessage} disabled={!input.trim() || isLoading} className="px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 shrink-0">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick actions — shared across both modes */}
            {activeProject && quickActions.length > 0 && (
              <div className="shrink-0 border-t border-border/30 bg-card/30 px-3 py-1.5 flex items-center gap-1.5 flex-wrap" data-testid="quick-actions">
                <Wand2 className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                {quickActions.map(action => {
                  const iconMap: Record<string, React.ReactNode> = {
                    AlertTriangle: <AlertTriangle className="w-3 h-3" />,
                    Moon: <Moon className="w-3 h-3" />,
                    Lock: <Lock className="w-3 h-3" />,
                    Palette: <Palette className="w-3 h-3" />,
                    Smartphone: <Smartphone className="w-3 h-3" />,
                    TestTube: <TestTube2 className="w-3 h-3" />,
                    Gauge: <Gauge className="w-3 h-3" />,
                    Zap: <Zap className="w-3 h-3" />,
                    Sparkles: <Sparkles className="w-3 h-3" />,
                  };
                  const categoryColors: Record<string, string> = {
                    fix: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20',
                    enhance: 'bg-[hsl(200_60%_50%/0.1)] text-[hsl(200_60%_60%)] border-[hsl(200_60%_50%/0.2)] hover:bg-[hsl(200_60%_50%/0.2)]',
                    add: 'bg-[hsl(150_60%_50%/0.1)] text-[hsl(150_60%_55%)] border-[hsl(150_60%_50%/0.2)] hover:bg-[hsl(150_60%_50%/0.2)]',
                    optimize: 'bg-[hsl(280_60%_50%/0.1)] text-[hsl(280_60%_65%)] border-[hsl(280_60%_50%/0.2)] hover:bg-[hsl(280_60%_50%/0.2)]',
                  };
                  return (
                    <button
                      key={action.id}
                      data-testid={`button-quick-action-${action.id}`}
                      onClick={() => {
                        if (mode === 'api') {
                          setInput(action.prompt);
                        } else {
                          (async () => {
                            try {
                              if (isElectron) {
                                const { clipboard } = (window as any).require('electron');
                                clipboard.writeText(action.prompt);
                              } else {
                                await navigator.clipboard.writeText(action.prompt);
                              }
                              setStatusMessage(`Copied "${action.label}" prompt to clipboard — paste into Grok`);
                            } catch {
                              setStatusMessage(`Could not copy prompt to clipboard`);
                            }
                          })();
                        }
                      }}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-colors ${categoryColors[action.category] || categoryColors.enhance}`}
                    >
                      {iconMap[action.icon] || <Sparkles className="w-3 h-3" />}
                      {action.label}
                    </button>
                  );
                })}
                {quickActionsLoading && <Loader2 className="w-3 h-3 text-muted-foreground/40 animate-spin" />}
                <button
                  data-testid="button-refresh-quick-actions"
                  onClick={refreshQuickActions}
                  disabled={quickActionsLoading}
                  className="p-1 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  title="Refresh suggestions"
                >
                  <RefreshCw className={`w-3 h-3 ${quickActionsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}

            {/* Code extractor — shared across both modes */}
            <ParallaxPortal wall="bottom">
              <ClipboardExtractor onApply={applyBlock} onApplyAll={batchApplyAll} onResponseCaptured={(text) => { lastFullResponseRef.current = text; }} activeProject={activeProject} onGithubImport={handleGitHubImport} onReplaceRepo={handleReplaceRepo} toasterConfig={toasterConfig} toasterAvailable={toasterAvailability?.available} userTask={userTask} setUserTask={setUserTask} onGenerateContext={async (task?: string) => { const ctx = await buildProjectContext(task); if (ctx) copyContextToClipboard(ctx); }} onEditContext={() => { setEditableContext(projectContext); setShowContextEditor(true); setTimeout(() => contextEditorRef.current?.focus(), 100); }} contextLoading={contextLoading} projectContext={projectContext} injectTextRef={injectExtractorTextRef} autoDetectEnabled={autoDetectEnabled} onToggleAutoDetect={(val) => { setAutoDetectEnabled(val); localStorage.setItem('lamby-autodetect', val ? 'true' : 'false'); }} />
            </ParallaxPortal>
          </div>
          )}

          {/* Preview panels — portal to right wall in parallax mode */}
          <ParallaxPortal wall="right">
            <div ref={panelContainerRef} className="flex flex-row" style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, overflowX: 'auto', overflowY: 'hidden', display: previewPanels.length === 0 ? 'none' : 'flex' }}>
              {previewPanels.map((panel, idx) => {
                const isActive = panel.id === (activePanelId ?? previewPanels[0]?.id);
                const panelPort = panel.port;
                const panelSrc = panelPort === -1
                  ? ((window as any).__mainAppPreviewUrl || window.location.origin)
                  : `/__preview/${panelPort}/`;
                const panelTitle = panel.projectName === null ? 'Lamby' : panel.projectName;
                const showDiagnoseForPanel = panel.showDiagnoseBanner;
                return (
                  <Fragment key={panel.id}>
                  {idx > 0 && (
                    <div
                      data-testid={`resize-handle-${idx}`}
                      className="w-[10px] cursor-col-resize shrink-0 flex items-center justify-center group"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        const handleEl = e.currentTarget as HTMLElement;
                        const leftEl = handleEl.previousElementSibling as HTMLElement | null;
                        const rightEl = handleEl.nextElementSibling as HTMLElement | null;
                        if (!leftEl || !rightEl) return;
                        const startX = e.clientX;
                        const leftId = previewPanels[idx - 1].id;
                        const rightId = panel.id;
                        const startLeftPx = leftEl.getBoundingClientRect().width;
                        const startRightPx = rightEl.getBoundingClientRect().width;
                        setPreviewPanels(prev => prev.map(p =>
                          p.id === leftId ? { ...p, widthPx: startLeftPx } :
                          p.id === rightId ? { ...p, widthPx: startRightPx } : p
                        ));
                        const minPx = 300;
                        const onMove = (ev: PointerEvent) => {
                          const dx = ev.clientX - startX;
                          const newLeft = Math.max(minPx, startLeftPx + dx);
                          setPreviewPanels(prev => prev.map(p => {
                            if (p.id === leftId) return { ...p, widthPx: newLeft };
                            return p;
                          }));
                        };
                        const onUp = () => {
                          document.removeEventListener('pointermove', onMove);
                          document.removeEventListener('pointerup', onUp);
                        };
                        document.addEventListener('pointermove', onMove);
                        document.addEventListener('pointerup', onUp);
                      }}
                    >
                      <div className="w-[3px] h-8 rounded-full bg-border/30 group-hover:bg-primary/50 group-active:bg-primary/70 transition-colors" />
                    </div>
                  )}
                  <div data-panel-id={panel.id} className={`flex flex-col rounded-lg border shadow-lg overflow-hidden ${isActive ? 'border-primary/40 shadow-primary/10' : 'border-border/40 shadow-black/10'}`} style={panel.widthPx > 0 ? { width: `${panel.widthPx}px`, flexShrink: 0, minHeight: 0 } : { flex: '1 1 0', minWidth: 0, minHeight: 0 }}>
                    <div
                      className="flex flex-col flex-1 min-w-0 min-h-0"
                      onClick={() => { if (activePanelId !== panel.id) { setActivePanelId(panel.id); setActiveProjectState(panel.projectName); persistActiveProject(panel.projectName); } }}
                    >
                      <div className="flex items-center gap-2 px-2 py-1 bg-card/50 border-b border-border/30 shrink-0">
                        <Monitor className="w-3 h-3 text-[hsl(150_60%_55%)]" />
                        <span className="text-[10px] font-medium text-foreground/80">{panelTitle} Preview</span>
                        {panelPort !== -1 && panelPort !== 0 && <span className="text-[9px] text-muted-foreground/50">:{panelPort}</span>}
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            data-testid={`button-expand-preview-panel-${panel.id}`}
                            onClick={(e) => { e.stopPropagation(); setPreviewExpanded(prev => !prev); }}
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                            title={previewExpanded ? 'Restore split view' : 'Expand preview'}
                          >
                            {previewExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                          </button>
                          <button
                            data-testid={`button-refresh-preview-panel-${panel.id}`}
                            onClick={(e) => { e.stopPropagation(); setPreviewPanels(prev => prev.map(p => p.id === panel.id ? { ...p, key: p.key + 1 } : p)); }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-[hsl(200_60%_40%/0.15)] text-[hsl(200_60%_55%)] hover:bg-[hsl(200_60%_40%/0.25)] transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                          <button
                            data-testid={`button-close-preview-panel-${panel.id}`}
                            onClick={(e) => { e.stopPropagation(); closePanel(panel.id); }}
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {showDiagnoseForPanel && (
                        <div className={`shrink-0 px-3 py-2 border-b flex items-center gap-3 flex-wrap ${
                          panel.diagnoseStuck
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-destructive/10 border-destructive/30'
                        }`} data-testid="banner-diagnose-fix">
                          <AlertCircle className={`w-4 h-4 shrink-0 ${panel.diagnoseStuck ? 'text-amber-400' : 'text-destructive'}`} />
                          {panel.diagnoseStuck ? (
                            <>
                              <span className="text-[11px] text-amber-400 font-medium" data-testid="text-diagnose-stuck">
                                Stuck — {panel.diagnoseFixCycleCount} fix cycles without success. Try describing the issue manually or revert changes.
                              </span>
                              <button
                                data-testid="button-diagnose-reset"
                                onClick={() => updatePanelById(panel.id, { showDiagnoseBanner: false, diagnoseStuck: false, diagnoseFixCycleCount: 0 })}
                                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors border border-amber-500/30 font-medium"
                              >
                                <RefreshCw className="w-3 h-3" /> Reset Cycles
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-[11px] text-destructive font-medium" data-testid="text-diagnose-errors-detected">
                                Errors detected after applying changes
                              </span>
                              <button
                                data-testid="button-diagnose-fix"
                                onClick={() => handleDiagnoseFix(panel.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors border border-destructive/30 font-bold"
                              >
                                <Zap className="w-3 h-3" /> Diagnose & Fix
                              </button>
                              {panel.diagnoseFixCycleCount > 0 && (
                                <span className="text-[9px] text-muted-foreground/60" data-testid="text-diagnose-cycle-count">
                                  Cycle {panel.diagnoseFixCycleCount}/3
                                </span>
                              )}
                            </>
                          )}
                          <button
                            data-testid="button-dismiss-diagnose"
                            onClick={() => updatePanelById(panel.id, { showDiagnoseBanner: false, diagnoseStuck: false, diagnoseFixCycleCount: 0 })}
                            className="ml-auto p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {panel.loading ? (
                        <div className="flex-1 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
                        </div>
                      ) : panelPort > 0 || panelPort === -1 ? (
                        <div className="relative flex-1 min-h-0 flex flex-col">
                          <PreviewFrame
                            ref={isActive ? previewIframeRef : undefined}
                            previewKey={panel.key}
                            src={panelSrc}
                            title={`${panelTitle} preview`}
                            previewLogs={panel.logs}
                            panelId={panel.id}
                            activeProject={panel.projectName}
                          />
                          {!isActive && (
                            <div
                              data-testid={`overlay-activate-panel-${panel.id}`}
                              className="absolute inset-0 z-10 cursor-pointer"
                              onPointerDown={() => { setActivePanelId(panel.id); setActiveProjectState(panel.projectName); persistActiveProject(panel.projectName); }}
                            />
                          )}
                        </div>
                      ) : panel.logs.some(l => l.level === 'error') ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4">
                          <AlertCircle className="w-5 h-5 text-red-400/70" />
                          <span className="text-[11px] text-red-400/80 font-medium">Preview failed to start</span>
                          <span className="text-[10px] text-muted-foreground/50 text-center max-w-xs">{panel.logs.find(l => l.level === 'error')?.message?.slice(0, 200) || 'Check console for details'}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              data-testid={`button-retry-preview-${panel.id}`}
                              onClick={() => {
                                if (panel.projectName) startProjectPreview(panel.projectName);
                                else startPreview();
                              }}
                              className="px-3 py-1 rounded text-[10px] font-medium bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                            >
                              Retry
                            </button>
                            <button
                              data-testid={`button-close-error-panel-${panel.id}`}
                              onClick={() => removePanel(panel.id)}
                              className="px-3 py-1 rounded text-[10px] font-medium bg-secondary/30 text-muted-foreground hover:bg-secondary/50 transition-colors"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground/40">
                          Starting...
                        </div>
                      )}
                      <LogsPanel
                        logs={panel.logs}
                        onClearLogs={() => updatePanelById(panel.id, { logs: [] })}
                        onSendLogsToGrok={handleSendLogsToGrok}
                        activeProject={panel.projectName}
                        alwaysShowBar
                      />
                    </div>
                  </div>
                  {idx === previewPanels.length - 1 && (
                    <div
                      data-testid={`resize-handle-right-${panel.id}`}
                      className="w-[10px] cursor-col-resize shrink-0 flex items-center justify-center group"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        const panelEl = e.currentTarget.previousElementSibling as HTMLElement | null;
                        if (!panelEl) return;
                        const startX = e.clientX;
                        const startW = panelEl.getBoundingClientRect().width;
                        const minPx = 300;
                        const onMove = (ev: PointerEvent) => {
                          const newW = Math.max(minPx, startW + (ev.clientX - startX));
                          setPreviewPanels(prev => prev.map(p => p.id === panel.id ? { ...p, widthPx: newW } : p));
                        };
                        const onUp = () => {
                          document.removeEventListener('pointermove', onMove);
                          document.removeEventListener('pointerup', onUp);
                        };
                        document.addEventListener('pointermove', onMove);
                        document.addEventListener('pointerup', onUp);
                      }}
                    >
                      <div className="w-[3px] h-8 rounded-full bg-border/30 group-hover:bg-primary/50 group-active:bg-primary/70 transition-colors" />
                    </div>
                  )}
                  </Fragment>
                );
              })}
            </div>
            </ParallaxPortal>
        </div>
      </div>

      {showContextEditor && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowContextEditor(false)}>
          <div
            className="flex flex-col rounded-lg shadow-2xl border border-border/40 overflow-hidden"
            style={{ width: 'min(800px, 92vw)', height: 'min(600px, 80vh)', background: 'hsl(220, 25%, 10%)' }}
            onClick={e => e.stopPropagation()}
            data-testid="modal-context-editor"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/30" style={{ background: 'hsl(220, 25%, 13%)' }}>
              <span className="text-[11px] font-medium text-foreground/80 flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-primary" />
                Edit Context
                <span className="text-[9px] text-muted-foreground/50">({Math.ceil(editableContext.length / 4)} tokens · {editableContext.length} chars)</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={async () => {
                    const ctx = await buildProjectContext(userTask.trim() || undefined);
                    if (ctx) setEditableContext(ctx);
                  }}
                  disabled={contextLoading}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors border border-border/20"
                  data-testid="button-regenerate-context"
                >
                  {contextLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code2 className="w-3 h-3" />}
                  Regenerate
                </button>
                <button
                  onClick={() => {
                    copyContextToClipboard(editableContext);
                    setShowContextEditor(false);
                  }}
                  disabled={!editableContext}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors border border-primary/20 disabled:opacity-30"
                  data-testid="button-copy-edited-context"
                >
                  <Copy className="w-3 h-3" />
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => setShowContextEditor(false)}
                  className="p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
                  data-testid="button-close-context-editor"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <textarea
              ref={contextEditorRef}
              value={editableContext}
              onChange={e => setEditableContext(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none outline-none border-none p-4"
              style={{
                background: 'hsl(220, 20%, 11%)',
                color: 'hsl(220, 10%, 82%)',
                fontSize: '11px',
                fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", "Consolas", monospace',
                lineHeight: '1.5',
                tabSize: 2,
                caretColor: 'hsl(150, 60%, 55%)',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
              }}
              data-testid="textarea-context-editor"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GrokBridge;
