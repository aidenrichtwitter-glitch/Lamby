import { checkOllamaAvailability } from './ollama-safety-guard';

export interface OllamaToasterConfig {
  endpoint: string;
  model: string;
}

const TOASTER_CONFIG_KEY = 'ollama-toaster-config';

const DEFAULT_TOASTER_CONFIG: OllamaToasterConfig = {
  endpoint: 'http://localhost:11434',
  model: 'qwen2.5-coder:7b',
};

export function loadToasterConfig(): OllamaToasterConfig {
  try {
    const raw = localStorage.getItem(TOASTER_CONFIG_KEY);
    if (raw) return { ...DEFAULT_TOASTER_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_TOASTER_CONFIG };
}

export function saveToasterConfig(config: OllamaToasterConfig): void {
  localStorage.setItem(TOASTER_CONFIG_KEY, JSON.stringify(config));
}

export interface ToasterAnalysis {
  error_summary: string;
  affected_files: string[];
  missing_files: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  suggested_context_to_include: string[];
}

export interface ToasterAvailability {
  available: boolean;
  models: string[];
  version?: string;
}

let cachedAvailability: ToasterAvailability | null = null;
let lastAvailabilityCheck = 0;
const AVAILABILITY_CACHE_MS = 30_000;

export async function checkToasterAvailability(config?: OllamaToasterConfig): Promise<ToasterAvailability> {
  const now = Date.now();
  if (cachedAvailability && now - lastAvailabilityCheck < AVAILABILITY_CACHE_MS) {
    return cachedAvailability;
  }
  const cfg = config || loadToasterConfig();
  const result = await checkOllamaAvailability(cfg.endpoint);
  cachedAvailability = result;
  lastAvailabilityCheck = now;
  return result;
}

export function clearAvailabilityCache(): void {
  cachedAvailability = null;
  lastAvailabilityCheck = 0;
}

async function ollamaGenerate(prompt: string, config?: OllamaToasterConfig): Promise<string> {
  const cfg = config || loadToasterConfig();
  const resp = await fetch(`${cfg.endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      prompt,
      stream: false,
      options: {
        temperature: 0.0,
        num_predict: 2048,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Ollama API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  return data.response || '';
}

function extractJSON<T>(text: string): T | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}

export async function analyzeLogsForContext(
  logs: string,
  fileTree: string[],
  fileContents?: Record<string, string>,
  config?: OllamaToasterConfig
): Promise<ToasterAnalysis | null> {
  const availability = await checkToasterAvailability(config);
  if (!availability.available) return null;

  const filesSection = fileTree.slice(0, 100).join('\n');
  const contentsSection = fileContents
    ? Object.entries(fileContents)
        .slice(0, 10)
        .map(([path, content]) => `--- ${path} ---\n${content.slice(0, 2000)}`)
        .join('\n\n')
    : '';

  const prompt = `You are a log analyzer and file selector. Do NOT invent code, fixes, explanations, or suggestions. Only analyze and output JSON.

Given the following console/build logs and project file tree, identify which files are affected by the errors and what the errors are about.

=== LOGS ===
${logs.slice(0, 4000)}

=== FILE TREE ===
${filesSection}

${contentsSection ? `=== FILE CONTENTS ===\n${contentsSection}` : ''}

Output ONLY valid JSON in this exact format, nothing else:
{
  "error_summary": "brief one-line summary of what went wrong",
  "affected_files": ["path/to/file1.ts", "path/to/file2.tsx"],
  "missing_files": ["path/to/missing-import.ts"],
  "priority": "critical|high|medium|low",
  "suggested_context_to_include": ["path/to/related-file.ts"]
}`;

  try {
    const response = await ollamaGenerate(prompt, config);
    const parsed = extractJSON<ToasterAnalysis>(response);
    if (parsed && parsed.error_summary && Array.isArray(parsed.affected_files)) {
      return {
        error_summary: String(parsed.error_summary),
        affected_files: (parsed.affected_files || []).filter((f: unknown) => typeof f === 'string'),
        missing_files: (parsed.missing_files || []).filter((f: unknown) => typeof f === 'string'),
        priority: ['critical', 'high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
        suggested_context_to_include: (parsed.suggested_context_to_include || []).filter((f: unknown) => typeof f === 'string'),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export interface SmartContextBundle {
  usedOllama: boolean;
  analysis: ToasterAnalysis | null;
  filesToInclude: string[];
  errorSummary: string;
  priority: string;
}

export async function buildSmartContext(
  logs: string,
  fileTree: string[],
  fileContents?: Record<string, string>,
  config?: OllamaToasterConfig
): Promise<SmartContextBundle> {
  const analysis = await analyzeLogsForContext(logs, fileTree, fileContents, config);

  if (!analysis) {
    return {
      usedOllama: false,
      analysis: null,
      filesToInclude: fileTree.filter(f =>
        f === 'package.json' || f === 'tsconfig.json' || f === 'vite.config.ts' ||
        f === 'index.html' || f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css')
      ).slice(0, 20),
      errorSummary: '',
      priority: 'medium',
    };
  }

  const allFiles = new Set<string>([
    ...analysis.affected_files,
    ...analysis.missing_files,
    ...analysis.suggested_context_to_include,
  ]);

  const validFiles = [...allFiles].filter(f => fileTree.includes(f));

  const alwaysInclude = ['package.json', 'tsconfig.json', 'vite.config.ts'];
  for (const f of alwaysInclude) {
    if (fileTree.includes(f) && !validFiles.includes(f)) {
      validFiles.push(f);
    }
  }

  return {
    usedOllama: true,
    analysis,
    filesToInclude: validFiles.slice(0, 25),
    errorSummary: analysis.error_summary,
    priority: analysis.priority,
  };
}

export interface CleanedFile {
  path: string;
  action: 'create' | 'update' | 'delete' | 'replace';
  content: string;
  diff: string;
  original_block: string;
}

export interface CleanedResponse {
  reasoning: string;
  files: CleanedFile[];
  unparsed_text: string;
}

export async function cleanGrokResponse(
  rawResponse: string,
  config?: OllamaToasterConfig
): Promise<CleanedResponse | null> {
  const availability = await checkToasterAvailability(config);
  if (!availability.available) return null;

  const truncated = rawResponse.slice(0, 12000);

  const prompt = `You are a response parser. Do NOT interpret, fix, or add anything. Only extract and reformat exactly what is present in the following AI assistant response.

Extract all code blocks with their file paths and the reasoning/explanation text.

=== RAW RESPONSE ===
${truncated}
=== END RAW RESPONSE ===

Output ONLY valid JSON in this exact format, nothing else:
{
  "reasoning": "the explanation text from the response (non-code parts summarized)",
  "files": [
    {
      "path": "src/example.ts",
      "action": "create|update|delete|replace",
      "content": "the full file content from the code block",
      "diff": "",
      "original_block": "the raw code block as it appeared"
    }
  ],
  "unparsed_text": "any text that could not be categorized"
}

Rules:
- Extract EVERY code block that has a file path
- The "path" must be the file path referenced in or above the code block (e.g. from "// file: path" comments or markdown headings)
- The "content" must be the EXACT code from the block, do not modify it
- The "action" should be "create" for new files, "update" for modifications, "replace" for full rewrites, "delete" for deletions
- If a code block has no identifiable file path, still include it with path as empty string
- Do NOT invent or modify any code content`;

  try {
    const response = await ollamaGenerate(prompt, config);
    const parsed = extractJSON<CleanedResponse>(response);
    if (!parsed || !Array.isArray(parsed.files)) return null;

    return {
      reasoning: String(parsed.reasoning || ''),
      files: parsed.files
        .filter((f: any) => f && typeof f.content === 'string' && f.content.length > 0)
        .map((f: any) => ({
          path: String(f.path || ''),
          action: ['create', 'update', 'delete', 'replace'].includes(f.action) ? f.action : 'update',
          content: String(f.content),
          diff: String(f.diff || ''),
          original_block: String(f.original_block || ''),
        })),
      unparsed_text: String(parsed.unparsed_text || ''),
    };
  } catch {
    return null;
  }
}

export function cleanedResponseToBlocks(cleaned: CleanedResponse): import('./code-parser').ParsedBlock[] {
  return cleaned.files
    .filter(f => f.content.length > 0 && f.action !== 'delete')
    .map(f => {
      const ext = f.path.match(/\.(\w+)$/)?.[1]?.toLowerCase() || '';
      const extMap: Record<string, string> = {
        ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
        html: 'html', css: 'css', json: 'json', py: 'python',
        sql: 'sql', yaml: 'yaml', yml: 'yaml', md: 'markdown',
        glsl: 'glsl', vue: 'vue', svelte: 'svelte', go: 'go',
        rs: 'rust', rb: 'ruby', java: 'java', swift: 'swift',
        sh: 'bash', scss: 'scss', less: 'less',
      };
      return {
        filePath: f.path,
        code: f.content,
        language: extMap[ext] || 'typescript',
      };
    });
}

export function formatAnalysisForPrompt(analysis: ToasterAnalysis): string {
  let result = `=== OLLAMA PRE-ANALYSIS ===\n`;
  result += `Priority: ${analysis.priority.toUpperCase()}\n`;
  result += `Error Summary: ${analysis.error_summary}\n`;
  if (analysis.affected_files.length > 0) {
    result += `Affected Files: ${analysis.affected_files.join(', ')}\n`;
  }
  if (analysis.missing_files.length > 0) {
    result += `Missing Files: ${analysis.missing_files.join(', ')}\n`;
  }
  result += `=== END PRE-ANALYSIS ===\n`;
  return result;
}
