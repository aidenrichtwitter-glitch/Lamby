const { app, BrowserWindow, ipcMain, clipboard, session, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const os = require('os');
const { registerGrokIpcHandlers, BROWSER_MODE_VERSION } = require('./grok-ipc-handlers');

process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED') return;
  if (app.isReady()) {
    const { dialog } = require('electron');
    dialog.showErrorBox('Uncaught Exception', err.stack || err.message);
  }
});

const LOG = '[ELECTRON]';
const USER_DATA = path.join(os.homedir(), '.guardian-ai');
const PROJECTS_DIR = path.resolve(process.env.PROJECT_DIR || path.join(USER_DATA, 'projects'));
const LAMBY_PORT = parseInt(process.env.LAMBY_PORT || '4999', 10);
const VITE_PORT = parseInt(process.env.VITE_PORT || '5000', 10);
const BACKUP_DIR = '.guardian-backup';

if (!fs.existsSync(USER_DATA)) fs.mkdirSync(USER_DATA, { recursive: true });
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

let mainWindow = null;
let localServerProcess = null;
let activeProject = '';

function log(...args) { try { console.log(LOG, ...args); } catch (_) {} }
function logErr(...args) { try { console.error(LOG, ...args); } catch (_) {} }

function getActiveProjectDir() {
  if (!activeProject) return null;
  const dir = path.resolve(PROJECTS_DIR, activeProject);
  if (!fs.existsSync(dir)) return null;
  return dir;
}

function resolveProjectPath(filePath) {
  const projectDir = getActiveProjectDir();
  if (!projectDir) return null;
  const resolved = path.resolve(projectDir, filePath);
  if (!resolved.startsWith(projectDir)) return null;
  return resolved;
}

function startLocalServer() {
  const serverPath = path.join(__dirname, 'local-server.js');
  if (!fs.existsSync(serverPath)) {
    log('local-server.js not found, skipping');
    return;
  }
  log(`Starting local server on port ${LAMBY_PORT} (packaged: ${app.isPackaged})`);
  const serverEnv = { ...process.env, LAMBY_PORT: String(LAMBY_PORT), PROJECT_DIR: PROJECTS_DIR };
  if (app.isPackaged) {
    serverEnv.ELECTRON_RUN_AS_NODE = '1';
  }
  localServerProcess = spawn(process.execPath, [serverPath], {
    env: serverEnv,
    stdio: 'pipe',
    windowsHide: true,
  });
  localServerProcess.stdout.on('data', (d) => { try { log(`[local-server] ${d.toString().trim()}`); } catch (_) {} });
  localServerProcess.stderr.on('data', (d) => { try { logErr(`[local-server] ${d.toString().trim()}`); } catch (_) {} });
  localServerProcess.on('exit', (code) => { try { log(`[local-server] exited with code ${code}`); } catch (_) {} });
}

function proxyToLocalServer(method, apiPath, body) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: '127.0.0.1',
      port: LAMBY_PORT,
      path: apiPath,
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ success: false, error: 'Invalid JSON from local server' }); }
      });
    });
    req.on('error', (err) => resolve({ success: false, error: `Local server error: ${err.message}` }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ success: false, error: 'Local server timeout' }); });
    if (postData) req.write(postData);
    req.end();
  });
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
    },
    title: 'Lamby',
  });

  if (app.isPackaged) {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    log(`Packaged mode — loading ${indexPath}`);
    mainWindow.loadFile(indexPath);
  } else {
    log(`Dev mode — loading http://localhost:${VITE_PORT}`);
    mainWindow.loadURL(`http://localhost:${VITE_PORT}`);
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  log(`BROWSER_MODE_VERSION: ${BROWSER_MODE_VERSION}`);
}

function registerFileIpcHandlers() {
  ipcMain.handle('read-file', async (_event, args) => {
    try {
      const { filePath } = args;
      const resolved = resolveProjectPath(filePath);
      if (!resolved) return { success: false, error: 'Invalid path or no active project' };
      const exists = fs.existsSync(resolved);
      const content = exists ? fs.readFileSync(resolved, 'utf-8') : '';
      return { success: true, exists, content, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('write-file', async (_event, args) => {
    try {
      const { filePath, content } = args;
      const resolved = resolveProjectPath(filePath);
      if (!resolved) return { success: false, error: 'Invalid path or no active project' };
      const dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let previousContent = '';
      if (fs.existsSync(resolved)) previousContent = fs.readFileSync(resolved, 'utf-8');
      const backupDir = path.join(getActiveProjectDir(), BACKUP_DIR);
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const backupPath = path.join(BACKUP_DIR, `${filePath.replace(/[\/\\]/g, '_')}.${Date.now()}.bak`);
      const backupResolved = path.resolve(getActiveProjectDir(), backupPath);
      const backupParent = path.dirname(backupResolved);
      if (!fs.existsSync(backupParent)) fs.mkdirSync(backupParent, { recursive: true });
      if (previousContent) fs.writeFileSync(backupResolved, previousContent, 'utf-8');
      fs.writeFileSync(resolved, content, 'utf-8');
      return { success: true, filePath, previousContent, backupPath, bytesWritten: content.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('rollback-file', async (_event, args) => {
    try {
      const { filePath, backupPath } = args;
      const projectDir = getActiveProjectDir();
      if (!projectDir) return { success: false, error: 'No active project' };
      if (backupPath) {
        const backupResolved = path.resolve(projectDir, backupPath);
        if (!fs.existsSync(backupResolved)) return { success: false, error: 'Backup file not found' };
        const content = fs.readFileSync(backupResolved, 'utf-8');
        const fileResolved = path.resolve(projectDir, filePath);
        fs.writeFileSync(fileResolved, content, 'utf-8');
        return { success: true, filePath, restoredFrom: backupPath };
      }
      return { success: false, error: 'No backup path provided' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('batch-write-files', async (_event, args) => {
    try {
      const { files } = args;
      const projectDir = getActiveProjectDir();
      if (!projectDir) return { success: false, error: 'No active project' };
      const results = [];
      const backups = [];
      for (const file of files) {
        const resolved = path.resolve(projectDir, file.filePath);
        if (!resolved.startsWith(projectDir)) {
          results.push({ filePath: file.filePath, success: false, error: 'Path traversal' });
          continue;
        }
        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        let previousContent = '';
        if (fs.existsSync(resolved)) previousContent = fs.readFileSync(resolved, 'utf-8');
        const backupDir = path.join(projectDir, BACKUP_DIR);
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const backupPath = path.join(BACKUP_DIR, `${file.filePath.replace(/[\/\\]/g, '_')}.${Date.now()}.bak`);
        if (previousContent) {
          const backupResolved = path.resolve(projectDir, backupPath);
          const bp = path.dirname(backupResolved);
          if (!fs.existsSync(bp)) fs.mkdirSync(bp, { recursive: true });
          fs.writeFileSync(backupResolved, previousContent, 'utf-8');
        }
        fs.writeFileSync(resolved, file.content, 'utf-8');
        results.push({ filePath: file.filePath, success: true, backupPath, previousContent });
        backups.push({ filePath: file.filePath, backupPath, oldContent: previousContent });
      }
      return { success: true, results, backups };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('batch-rollback', async (_event, args) => {
    try {
      const { backups } = args;
      const projectDir = getActiveProjectDir();
      if (!projectDir) return { success: false, error: 'No active project' };
      for (const b of backups) {
        if (b.backupPath) {
          const backupResolved = path.resolve(projectDir, b.backupPath);
          if (fs.existsSync(backupResolved)) {
            const content = fs.readFileSync(backupResolved, 'utf-8');
            fs.writeFileSync(path.resolve(projectDir, b.filePath), content, 'utf-8');
          }
        } else if (b.oldContent !== undefined) {
          fs.writeFileSync(path.resolve(projectDir, b.filePath), b.oldContent, 'utf-8');
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

function registerGitIpcHandlers() {
  ipcMain.handle('git-commit', async (_event, args) => {
    try {
      const projectDir = getActiveProjectDir();
      if (!projectDir) return { success: false, error: 'No active project' };
      const { message, filePaths } = args;
      const files = filePaths || ['.'];
      for (const f of files) {
        try { execSync(`git add "${f}"`, { cwd: projectDir, windowsHide: true, stdio: 'pipe' }); } catch {}
      }
      try {
        execSync(`git commit -m "${(message || 'auto-commit').replace(/"/g, '\\"')}"`, { cwd: projectDir, windowsHide: true, stdio: 'pipe' });
      } catch (e) {
        const msg = e.stderr ? e.stderr.toString() : e.message;
        if (msg.includes('nothing to commit')) return { success: true, warning: 'Nothing to commit' };
        return { success: false, error: msg };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('batch-git-commit', async (_event, args) => {
    try {
      const projectDir = getActiveProjectDir();
      if (!projectDir) return { success: false, error: 'No active project' };
      const { message, backups } = args;
      const files = backups ? backups.map(b => b.filePath) : ['.'];
      for (const f of files) {
        try { execSync(`git add "${f}"`, { cwd: projectDir, windowsHide: true, stdio: 'pipe' }); } catch {}
      }
      try {
        execSync(`git commit -m "${(message || 'batch auto-commit').replace(/"/g, '\\"')}"`, { cwd: projectDir, windowsHide: true, stdio: 'pipe' });
      } catch (e) {
        const msg = e.stderr ? e.stderr.toString() : e.message;
        if (msg.includes('nothing to commit')) return { success: true, warning: 'Nothing to commit' };
        return { success: false, error: msg };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('git-log', async (_event, args) => {
    try {
      const projectDir = getActiveProjectDir();
      if (!projectDir) return { success: false, error: 'No active project' };
      const count = args?.count || 10;
      const output = execSync(`git log --oneline -${count}`, { cwd: projectDir, windowsHide: true, stdio: 'pipe' }).toString().trim();
      const entries = output.split('\n').filter(Boolean).map(line => {
        const spaceIdx = line.indexOf(' ');
        return { hash: line.slice(0, spaceIdx), message: line.slice(spaceIdx + 1) };
      });
      return { success: true, entries };
    } catch (err) {
      return { success: false, error: err.message, entries: [] };
    }
  });
}

function registerProjectIpcHandlers() {
  ipcMain.handle('list-project-files', async () => {
    try {
      const projectDir = getActiveProjectDir();
      if (!projectDir) return { success: false, error: 'No active project', files: [] };
      const SKIP = new Set(['node_modules', '.cache', 'dist', '.git', '.next', '.nuxt', '.turbo', '.vercel', '.output', '.svelte-kit', '__pycache__', '.parcel-cache', BACKUP_DIR]);
      const files = [];
      function walk(dir, prefix) {
        let entries;
        try { entries = fs.readdirSync(dir); } catch { return; }
        for (const entry of entries) {
          if (SKIP.has(entry)) continue;
          const full = path.join(dir, entry);
          let stat;
          try { stat = fs.lstatSync(full); } catch { continue; }
          const rel = prefix ? `${prefix}/${entry}` : entry;
          if (stat.isDirectory()) {
            walk(full, rel);
          } else if (stat.isFile()) {
            files.push(rel);
          }
        }
      }
      walk(projectDir, '');
      return { success: true, files };
    } catch (err) {
      return { success: false, error: err.message, files: [] };
    }
  });

  ipcMain.handle('read-files-for-context', async (_event, args) => {
    try {
      const projectDir = getActiveProjectDir();
      if (!projectDir) return { success: false, error: 'No active project' };
      const { filePaths, maxSizePerFile } = args;
      const max = maxSizePerFile || 6000;
      const results = {};
      for (const fp of filePaths) {
        const resolved = path.resolve(projectDir, fp);
        if (!resolved.startsWith(projectDir)) continue;
        try {
          if (fs.existsSync(resolved)) {
            let content = fs.readFileSync(resolved, 'utf-8');
            if (content.length > max) content = content.slice(0, max) + '\n... (truncated)';
            results[fp] = content;
          }
        } catch {}
      }
      return { success: true, contents: results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('check-compile', async (_event, args) => {
    try {
      const projectDir = getActiveProjectDir();
      if (!projectDir) return { success: true, errors: [] };
      return { success: true, errors: [] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('check-compile-project', async () => {
    try {
      const projectDir = getActiveProjectDir();
      if (!projectDir) return { success: true, errors: [] };
      return { success: true, errors: [] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ensure-project-polling', async (_event, args) => {
    if (args?.projectName) activeProject = args.projectName;
    log(`Active project set to: ${activeProject}`);
    return { success: true, projectName: activeProject };
  });

  ipcMain.handle('restart-dev-server', async () => {
    return proxyToLocalServer('POST', '/api/projects/preview', { name: activeProject });
  });

  ipcMain.handle('run-npm-install', async () => {
    try {
      const projectDir = getActiveProjectDir();
      if (!projectDir) return { success: false, error: 'No active project' };
      execSync('npm install', { cwd: projectDir, windowsHide: true, stdio: 'pipe', timeout: 60000 });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

function registerMiscIpcHandlers() {
  ipcMain.handle('read-clipboard', async () => {
    return clipboard.readText();
  });

  ipcMain.handle('bridge-config-save', async (_event, args) => {
    return proxyToLocalServer('POST', '/api/bridge-config-save', args);
  });

  ipcMain.handle('bridge-reconnect', async () => {
    return proxyToLocalServer('GET', '/api/bridge-reconnect');
  });
}

app.whenReady().then(() => {
  startLocalServer();

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"],
      },
    });
  });

  createWindow();
  registerFileIpcHandlers();
  registerGitIpcHandlers();
  registerProjectIpcHandlers();
  registerMiscIpcHandlers();
  registerGrokIpcHandlers();

  log(`All IPC handlers registered (${BROWSER_MODE_VERSION})`);
});

app.on('window-all-closed', () => {
  if (localServerProcess) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${localServerProcess.pid} /T /F`, { stdio: 'pipe', windowsHide: true });
      } else {
        localServerProcess.kill('SIGTERM');
      }
    } catch {}
  }
  app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
