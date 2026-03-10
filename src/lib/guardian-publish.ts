import { getGuardianConfig, getEffectivePat, hasPublishCredentials, type GuardianConfig } from './guardian-config';
import { getProjectFiles, readProjectFile, type ProjectFileNode } from './project-manager';

export interface GuardianMeta {
  original_description: string;
  stack: string;
  key_patterns_used: string[];
  common_fixes_applied: string[];
  build_success_rating: number;
  last_updated: string;
  source_repo: string;
  tags: string[];
  commit_chain: string[];
}

export interface PublishProgress {
  stage: 'generating-meta' | 'anonymizing' | 'creating-repo' | 'pushing-files' | 'setting-topics' | 'done' | 'error';
  message: string;
  filesTotal?: number;
  filesPushed?: number;
}

const SENSITIVE_FILES = ['.env', '.env.local', '.env.production', '.env.development', '.env.test'];
const SENSITIVE_PATTERNS = [/\.env(\.\w+)?$/, /secret/i, /\.pem$/, /\.key$/];
const SKIP_DIRS = ['node_modules', '.git', 'dist', '.cache', '.next', '.vite'];

function isSensitivePath(filePath: string): boolean {
  const name = filePath.split('/').pop() || '';
  if (SENSITIVE_FILES.includes(name)) return true;
  return SENSITIVE_PATTERNS.some(p => p.test(name));
}

function stripSensitiveContent(content: string, filePath: string): string {
  if (filePath.endsWith('.json') && filePath.includes('package')) return content;
  let cleaned = content;
  cleaned = cleaned.replace(/(api[_-]?key|secret|token|password|auth|bearer)\s*[:=]\s*['"][^'"]+['"]/gi, '$1: "REDACTED"');
  cleaned = cleaned.replace(/\b[A-Za-z0-9+/]{40,}\b/g, (match) => {
    if (match.length > 60 && /[A-Z]/.test(match) && /[a-z]/.test(match)) {
      return 'REDACTED_KEY';
    }
    return match;
  });
  return cleaned;
}

function detectPatterns(files: ProjectFileNode[], fileContents: Map<string, string>): string[] {
  const patterns: string[] = [];

  for (const [path, content] of fileContents) {
    if (content.includes('useAuth') || content.includes('supabase.auth') || content.includes('firebase/auth')) {
      patterns.push('auth-hook');
      break;
    }
  }

  for (const [path, content] of fileContents) {
    if (content.includes('@dnd-kit') || content.includes('react-beautiful-dnd') || content.includes('useDrag') || content.includes('useDrop')) {
      patterns.push('drag-and-drop');
      break;
    }
  }

  for (const [path, content] of fileContents) {
    if (content.includes('dark:') || content.includes('darkMode') || content.includes('.dark')) {
      patterns.push('dark-mode-toggle');
      break;
    }
  }

  for (const [path, content] of fileContents) {
    if (content.includes('zustand') || content.includes('create(') && content.includes('set(')) {
      patterns.push('zustand-store');
      break;
    }
  }

  for (const [path, content] of fileContents) {
    if (content.includes('useQuery') || content.includes('tanstack')) {
      patterns.push('tanstack-query');
      break;
    }
  }

  for (const [path, content] of fileContents) {
    if (content.includes('tailwindcss') || content.includes('tailwind.config')) {
      patterns.push('tailwind-css');
      break;
    }
  }

  return patterns;
}

function extractDepsStack(pkgContent: string): string {
  try {
    const pkg = JSON.parse(pkgContent);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const stackParts: string[] = [];
    const mapping: Record<string, string> = {
      react: 'react',
      'react-dom': 'react',
      vue: 'vue',
      svelte: 'svelte',
      typescript: 'ts',
      vite: 'vite',
      tailwindcss: 'tailwind',
      '@supabase/supabase-js': 'supabase',
      firebase: 'firebase',
      zustand: 'zustand',
      'react-router-dom': 'react-router',
      wouter: 'wouter',
      prisma: 'prisma',
      drizzle: 'drizzle',
      'drizzle-orm': 'drizzle',
      express: 'express',
      next: 'nextjs',
    };
    for (const dep of Object.keys(allDeps)) {
      if (mapping[dep] && !stackParts.includes(mapping[dep])) {
        stackParts.push(mapping[dep]);
      }
    }
    return stackParts.join(' ');
  } catch {
    return '';
  }
}

function extractTags(description: string, stack: string, patterns: string[]): string[] {
  const tags = new Set<string>();
  const descWords = description.toLowerCase().split(/[\s,.-]+/).filter(w => w.length > 2 && w.length < 20);
  const stopWords = new Set(['the', 'and', 'with', 'for', 'app', 'that', 'this', 'from', 'have', 'are', 'was', 'has']);
  for (const word of descWords) {
    if (!stopWords.has(word)) tags.add(word);
  }
  for (const part of stack.split(' ')) {
    if (part) tags.add(part);
  }
  for (const p of patterns) {
    tags.add(p);
  }
  return Array.from(tags).slice(0, 15);
}

function flattenFileTree(nodes: ProjectFileNode[], prefix = ''): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'directory') {
      if (!SKIP_DIRS.includes(node.name)) {
        if (node.children) {
          paths.push(...flattenFileTree(node.children, fullPath));
        }
      }
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

export async function generateGuardianMeta(
  projectName: string,
  description: string,
  sourceRepo?: string
): Promise<GuardianMeta> {
  const tree = await getProjectFiles(projectName);
  const filePaths = flattenFileTree(tree);

  const fileContents = new Map<string, string>();
  let pkgContent = '';

  for (const fp of filePaths) {
    if (isSensitivePath(fp)) continue;
    try {
      const content = await readProjectFile(projectName, fp);
      if (content.length < 50000) {
        fileContents.set(fp, content);
      }
      if (fp === 'package.json') {
        pkgContent = content;
      }
    } catch {}
  }

  const stack = pkgContent ? extractDepsStack(pkgContent) : '';
  const patterns = detectPatterns(tree, fileContents);
  const tags = extractTags(description, stack, patterns);

  return {
    original_description: description,
    stack,
    key_patterns_used: patterns,
    common_fixes_applied: [],
    build_success_rating: 5,
    last_updated: new Date().toISOString().split('T')[0],
    source_repo: sourceRepo || '',
    tags,
    commit_chain: ['initial-publish'],
  };
}

async function githubApiCall(
  endpoint: string,
  pat: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' = 'GET',
  body?: any
): Promise<any> {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `GitHub API error: ${res.status}`);
  }

  return res.json();
}

async function createGitHubRepo(
  orgName: string,
  repoName: string,
  description: string,
  pat: string
): Promise<{ fullName: string; defaultBranch: string }> {
  try {
    const data = await githubApiCall(`/orgs/${orgName}/repos`, pat, 'POST', {
      name: repoName,
      description: description.slice(0, 200),
      private: false,
      auto_init: true,
      has_issues: false,
      has_wiki: false,
    });
    return { fullName: data.full_name, defaultBranch: data.default_branch || 'main' };
  } catch (orgErr: any) {
    if (orgErr.message?.includes('Not Found') || orgErr.message?.includes('404')) {
      const data = await githubApiCall('/user/repos', pat, 'POST', {
        name: repoName,
        description: description.slice(0, 200),
        private: false,
        auto_init: true,
      });
      return { fullName: data.full_name, defaultBranch: data.default_branch || 'main' };
    }
    throw orgErr;
  }
}

async function pushFilesToRepo(
  fullName: string,
  defaultBranch: string,
  files: { path: string; content: string }[],
  pat: string,
  onProgress?: (pushed: number, total: number) => void
): Promise<void> {
  const refData = await githubApiCall(`/repos/${fullName}/git/ref/heads/${defaultBranch}`, pat);
  const latestCommitSha = refData.object.sha;

  const commitData = await githubApiCall(`/repos/${fullName}/git/commits/${latestCommitSha}`, pat);
  const baseTreeSha = commitData.tree.sha;

  const treeItems = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const blobData = await githubApiCall(`/repos/${fullName}/git/blobs`, pat, 'POST', {
      content: btoa(unescape(encodeURIComponent(file.content))),
      encoding: 'base64',
    });
    treeItems.push({
      path: file.path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: blobData.sha,
    });
    onProgress?.(i + 1, files.length);
  }

  const newTree = await githubApiCall(`/repos/${fullName}/git/trees`, pat, 'POST', {
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  const newCommit = await githubApiCall(`/repos/${fullName}/git/commits`, pat, 'POST', {
    message: 'Published via Guardian AI',
    tree: newTree.sha,
    parents: [latestCommitSha],
  });

  await githubApiCall(`/repos/${fullName}/git/refs/heads/${defaultBranch}`, pat, 'PATCH', {
    sha: newCommit.sha,
  });
}

async function setRepoTopics(fullName: string, topics: string[], pat: string): Promise<void> {
  const validTopics = topics
    .map(t => t.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .filter(t => t.length >= 1 && t.length <= 35)
    .slice(0, 20);

  if (validTopics.length === 0) return;

  await fetch(`https://api.github.com/repos/${fullName}/topics`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github.mercy-preview+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ names: validTopics }),
  });
}

export async function publishProject(
  projectName: string,
  description: string,
  onProgress?: (progress: PublishProgress) => void,
  sourceRepo?: string,
  config?: GuardianConfig
): Promise<{ repoUrl: string; filesPublished: number }> {
  const cfg = config || getGuardianConfig();
  if (!hasPublishCredentials(cfg)) {
    throw new Error('No GitHub PAT configured. Add a PAT in Settings to publish.');
  }
  const pat = getEffectivePat(cfg);

  onProgress?.({ stage: 'generating-meta', message: 'Generating project metadata...' });
  const meta = await generateGuardianMeta(projectName, description, sourceRepo);

  onProgress?.({ stage: 'anonymizing', message: 'Scanning and anonymizing files...' });
  const tree = await getProjectFiles(projectName);
  const filePaths = flattenFileTree(tree);

  const filesToPush: { path: string; content: string }[] = [];

  for (const fp of filePaths) {
    if (isSensitivePath(fp)) continue;
    try {
      const content = await readProjectFile(projectName, fp);
      if (content.length > 500000) continue;
      const cleaned = stripSensitiveContent(content, fp);
      filesToPush.push({ path: fp, content: cleaned });
    } catch {}
  }

  filesToPush.push({
    path: 'GUARDIAN-META.json',
    content: JSON.stringify(meta, null, 2),
  });

  const repoName = `guardian-${projectName}`.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();

  onProgress?.({ stage: 'creating-repo', message: `Creating repo ${cfg.orgName}/${repoName}...` });
  const { fullName, defaultBranch } = await createGitHubRepo(cfg.orgName, repoName, description, pat);

  onProgress?.({ stage: 'pushing-files', message: `Pushing ${filesToPush.length} files...`, filesTotal: filesToPush.length, filesPushed: 0 });
  await pushFilesToRepo(fullName, defaultBranch, filesToPush, pat, (pushed, total) => {
    onProgress?.({ stage: 'pushing-files', message: `Pushing files (${pushed}/${total})...`, filesTotal: total, filesPushed: pushed });
  });

  onProgress?.({ stage: 'setting-topics', message: 'Setting repo topics...' });
  try {
    await setRepoTopics(fullName, ['guardian-ai', ...meta.tags], pat);
  } catch {}

  const repoUrl = `https://github.com/${fullName}`;

  onProgress?.({ stage: 'done', message: `Published to ${repoUrl}`, filesTotal: filesToPush.length, filesPushed: filesToPush.length });

  return { repoUrl, filesPublished: filesToPush.length };
}
