export interface StackFingerprint {
  framework: string;
  language: 'typescript' | 'javascript';
  styling: string;
  keyDeps: string[];
  stateManagement: string;
}

export interface GitHubCandidate {
  repo: string;
  owner: string;
  filePath: string;
  rawUrl: string;
  stars: number;
  license: string;
  lastUpdated: string;
  matchScore: number;
  searchQuery: string;
  description: string;
}

export interface DiscoveryResult {
  concept: string;
  candidates: GitHubCandidate[];
  extractedCode: string | null;
  attribution: string;
  searchQuery: string;
  durationMs: number;
  fallback: boolean;
}

const ALLOWED_LICENSES = ['mit', 'apache-2.0', 'isc', 'bsd-2-clause', 'bsd-3-clause', 'unlicense', '0bsd', 'mpl-2.0'];

const GITHUB_API = 'https://api.github.com';

async function githubFetch(url: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;
  return fetch(url, { headers });
}

export function buildStackFingerprint(pkg: Record<string, any>): StackFingerprint {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const depNames = Object.keys(deps);

  let framework = 'vanilla';
  if (deps.next) framework = 'nextjs';
  else if (deps.vite || deps['@vitejs/plugin-react']) framework = 'vite';
  else if (deps['react-scripts']) framework = 'cra';
  else if (deps.nuxt) framework = 'nuxt';
  else if (deps.astro) framework = 'astro';
  else if (deps.svelte || deps['@sveltejs/kit']) framework = 'svelte';
  else if (deps.vue) framework = 'vue';
  else if (deps.react) framework = 'react';

  const language: 'typescript' | 'javascript' = deps.typescript ? 'typescript' : 'javascript';

  let styling = 'css';
  if (deps.tailwindcss || deps['@tailwindcss/vite']) styling = 'tailwind';
  else if (deps['styled-components']) styling = 'styled-components';
  else if (deps['@emotion/react']) styling = 'emotion';
  else if (deps.sass) styling = 'sass';

  let stateManagement = 'none';
  if (deps.zustand) stateManagement = 'zustand';
  else if (deps.redux || deps['@reduxjs/toolkit']) stateManagement = 'redux';
  else if (deps.jotai) stateManagement = 'jotai';
  else if (deps.recoil) stateManagement = 'recoil';
  else if (deps.mobx) stateManagement = 'mobx';

  const importantDeps = ['three', '@react-three/fiber', '@react-three/drei', 'framer-motion',
    'gsap', 'd3', 'chart.js', 'recharts', '@solana/web3.js', 'ethers', 'wagmi',
    'prisma', 'drizzle-orm', 'mongoose', 'socket.io', 'trpc', '@trpc/client',
    'shadcn', '@radix-ui/react-dialog', 'lucide-react', 'react-query', '@tanstack/react-query',
    'openai', 'langchain', 'stripe', 'firebase'];
  const keyDeps = depNames.filter(d => importantDeps.includes(d) || d.startsWith('@solana/') || d.startsWith('@drift'));

  return { framework, language, styling, keyDeps, stateManagement };
}

export function conceptToSearchQuery(concept: string, fingerprint: StackFingerprint): string {
  const techTerms = concept
    .replace(/add|implement|create|build|improve|enhance|integrate|set up|setup/gi, '')
    .trim();

  const langFilter = `language:${fingerprint.language === 'typescript' ? 'TypeScript' : 'JavaScript'}`;

  const frameworkTerms: Record<string, string> = {
    nextjs: 'next.js OR nextjs',
    vite: 'vite',
    react: 'react',
    vue: 'vue',
    svelte: 'svelte',
    nuxt: 'nuxt',
    astro: 'astro',
  };
  const fw = frameworkTerms[fingerprint.framework] || '';

  return `${techTerms} ${fw} ${langFilter} stars:>20`.replace(/\s+/g, ' ').trim();
}

export async function searchGitHubRepos(
  query: string,
  token?: string,
  maxResults: number = 5,
): Promise<Array<{ owner: string; repo: string; stars: number; license: string; description: string; lastPush: string; fullName: string }>> {
  try {
    const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${maxResults}`;
    const res = await githubFetch(url, token);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      owner: item.owner?.login || '',
      repo: item.name || '',
      stars: item.stargazers_count || 0,
      license: item.license?.spdx_id?.toLowerCase() || 'unknown',
      description: item.description || '',
      lastPush: item.pushed_at || '',
      fullName: item.full_name || '',
    }));
  } catch {
    return [];
  }
}

export async function searchGitHubCode(
  query: string,
  token?: string,
  maxResults: number = 5,
): Promise<Array<{ owner: string; repo: string; filePath: string; rawUrl: string; htmlUrl: string; repoStars: number }>> {
  if (!token) return [];
  try {
    const url = `${GITHUB_API}/search/code?q=${encodeURIComponent(query)}&per_page=${maxResults}`;
    const res = await githubFetch(url, token);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      owner: item.repository?.owner?.login || '',
      repo: item.repository?.name || '',
      filePath: item.path || '',
      rawUrl: item.html_url?.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/') || '',
      htmlUrl: item.html_url || '',
      repoStars: item.repository?.stargazers_count || 0,
    }));
  } catch {
    return [];
  }
}

export async function fetchFileContent(rawUrl: string, token?: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `token ${token}`;
    const res = await fetch(rawUrl, { headers });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > 50000) return null;
    return text;
  } catch {
    return null;
  }
}

function scoreCandidate(
  stars: number,
  license: string,
  lastPush: string,
  fingerprint: StackFingerprint,
  depOverlap: number,
): number {
  let score = 0;

  if (stars > 10000) score += 30;
  else if (stars > 1000) score += 25;
  else if (stars > 100) score += 15;
  else if (stars > 20) score += 5;

  if (ALLOWED_LICENSES.includes(license)) score += 20;
  else if (license === 'unknown') score += 5;

  const pushDate = new Date(lastPush);
  const monthsAgo = (Date.now() - pushDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsAgo < 3) score += 20;
  else if (monthsAgo < 6) score += 15;
  else if (monthsAgo < 12) score += 10;
  else if (monthsAgo < 24) score += 5;

  score += Math.min(depOverlap * 5, 20);

  return Math.min(score, 100);
}

export async function discoverForConcept(
  concept: string,
  fingerprint: StackFingerprint,
  token?: string,
): Promise<DiscoveryResult> {
  const start = performance.now();
  const searchQuery = conceptToSearchQuery(concept, fingerprint);
  const candidates: GitHubCandidate[] = [];

  const [repoResults, codeResults] = await Promise.all([
    searchGitHubRepos(searchQuery, token),
    searchGitHubCode(searchQuery, token),
  ]);

  for (const repo of repoResults) {
    const depOverlap = fingerprint.keyDeps.length > 0 ? 1 : 0;
    const ms = scoreCandidate(repo.stars, repo.license, repo.lastPush, fingerprint, depOverlap);
    if (ms > 15) {
      candidates.push({
        repo: repo.repo,
        owner: repo.owner,
        filePath: '',
        rawUrl: '',
        stars: repo.stars,
        license: repo.license,
        lastUpdated: repo.lastPush,
        matchScore: ms,
        searchQuery,
        description: repo.description,
      });
    }
  }

  for (const code of codeResults) {
    const existing = candidates.find(c => c.owner === code.owner && c.repo === code.repo);
    if (existing && !existing.filePath) {
      existing.filePath = code.filePath;
      existing.rawUrl = code.rawUrl;
      existing.matchScore += 10;
    } else if (!existing) {
      candidates.push({
        repo: code.repo,
        owner: code.owner,
        filePath: code.filePath,
        rawUrl: code.rawUrl,
        stars: code.repoStars,
        license: 'unknown',
        lastUpdated: '',
        matchScore: 20,
        searchQuery,
        description: '',
      });
    }
  }

  candidates.sort((a, b) => b.matchScore - a.matchScore);
  const topCandidates = candidates.slice(0, 3);

  let extractedCode: string | null = null;
  let attribution = '';

  for (const candidate of topCandidates) {
    if (candidate.rawUrl) {
      const code = await fetchFileContent(candidate.rawUrl, token);
      if (code && code.length > 50 && code.length < 30000) {
        extractedCode = code;
        attribution = `Adapted from github.com/${candidate.owner}/${candidate.repo}/${candidate.filePath} (${candidate.license.toUpperCase()}, ${candidate.stars.toLocaleString()} stars)`;
        break;
      }
    }
  }

  if (!extractedCode && topCandidates.length > 0) {
    const best = topCandidates[0];
    attribution = `Reference: github.com/${best.owner}/${best.repo} (${best.license.toUpperCase()}, ${best.stars.toLocaleString()} stars)`;
  }

  return {
    concept,
    candidates: topCandidates,
    extractedCode,
    attribution,
    searchQuery,
    durationMs: performance.now() - start,
    fallback: extractedCode === null,
  };
}

export async function discoverForEvolution(
  planPrompt: string,
  fingerprint: StackFingerprint,
  token?: string,
): Promise<DiscoveryResult[]> {
  const concepts = extractConcepts(planPrompt);
  if (concepts.length === 0) return [];

  const results = await Promise.all(
    concepts.slice(0, 3).map(concept => discoverForConcept(concept, fingerprint, token)),
  );

  return results.filter(r => r.candidates.length > 0);
}

function extractConcepts(prompt: string): string[] {
  const concepts: string[] = [];

  const actionPatterns = [
    /(?:add|implement|create|build|integrate|set up|enable)\s+(.+?)(?:\.|,|$)/gi,
    /(?:improve|enhance|upgrade|optimize)\s+(.+?)(?:\.|,|$)/gi,
  ];

  for (const pattern of actionPatterns) {
    let match;
    while ((match = pattern.exec(prompt)) !== null) {
      const concept = match[1].trim();
      if (concept.length > 3 && concept.length < 100) {
        concepts.push(concept);
      }
    }
  }

  if (concepts.length === 0 && prompt.length > 10) {
    concepts.push(prompt.slice(0, 100));
  }

  return [...new Set(concepts)];
}

export function buildDiscoveryContext(results: DiscoveryResult[]): string {
  if (results.length === 0) return '';

  const sections = results
    .filter(r => r.extractedCode || r.candidates.length > 0)
    .map(r => {
      const lines: string[] = [`=== GITHUB REFERENCE: ${r.concept} ===`];

      if (r.attribution) lines.push(r.attribution);

      if (r.extractedCode) {
        const truncated = r.extractedCode.length > 8000
          ? r.extractedCode.slice(0, 8000) + '\n// ... (truncated)'
          : r.extractedCode;
        lines.push(`\nReference implementation found (adapt to fit this project, do NOT copy verbatim):`);
        lines.push('```');
        lines.push(truncated);
        lines.push('```');
      } else if (r.candidates.length > 0) {
        lines.push(`\nNo extractable code found, but these repos have relevant implementations:`);
        for (const c of r.candidates.slice(0, 3)) {
          lines.push(`- github.com/${c.owner}/${c.repo} (${c.stars.toLocaleString()} stars, ${c.license}): ${c.description.slice(0, 100)}`);
        }
      }

      lines.push(`=== END GITHUB REFERENCE ===`);
      return lines.join('\n');
    });

  if (sections.length === 0) return '';

  return '\n\n' + sections.join('\n\n') + '\n\nUse the above GitHub references as inspiration and adapt the patterns to fit this project\'s architecture. Cite the source repo in code comments where you use their patterns.\n';
}
