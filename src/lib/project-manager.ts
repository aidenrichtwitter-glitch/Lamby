export interface Project {
  name: string;
  path: string;
  createdAt: number;
  framework: 'react' | 'vanilla' | 'html';
  description: string;
}

export interface ProjectFileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: ProjectFileNode[];
}

const ACTIVE_PROJECT_KEY = 'active-project';

export async function listProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects/list', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to list projects');
  const data = await res.json();
  return data.projects ?? [];
}

export async function createProject(
  name: string,
  framework: Project['framework'],
  description: string
): Promise<Project> {
  const res = await fetch('/api/projects/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, framework, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create project' }));
    throw new Error(err.error || 'Failed to create project');
  }
  return res.json();
}

export async function deleteProject(name: string): Promise<void> {
  const res = await fetch('/api/projects/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to delete project');
}

export async function getProjectFiles(name: string): Promise<ProjectFileNode[]> {
  const res = await fetch('/api/projects/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to get project files');
  const data = await res.json();
  return data.files ?? data.tree ?? [];
}

export async function readProjectFile(project: string, filePath: string): Promise<string> {
  const res = await fetch('/api/projects/read-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: project, filePath }),
  });
  if (!res.ok) throw new Error('Failed to read project file');
  const data = await res.json();
  return data.content ?? '';
}

export async function writeProjectFile(
  project: string,
  filePath: string,
  content: string
): Promise<void> {
  const res = await fetch('/api/projects/write-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: project, filePath, content }),
  });
  if (!res.ok) throw new Error('Failed to write project file');
}

export function getActiveProject(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function setActiveProject(projectName: string | null): void {
  try {
    if (projectName === null) {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    } else {
      localStorage.setItem(ACTIVE_PROJECT_KEY, projectName);
    }
  } catch {}
}
