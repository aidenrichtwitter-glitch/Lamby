const { app, BrowserWindow, ipcMain, clipboard, session, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const os = require('os');
const { registerGrokIpcHandlers, BROWSER_MODE_VERSION } = require('./grok-ipc-handlers');
const { registerClawIpcHandlers } = require('./claw-ipc-handlers');

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
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });
  localServerProcess.stdout.on('data', (d) => { try { log(`[local-server] ${d.toString().trim()}`); } catch (_) {} });
  localServerProcess.stderr.on('data', (d) => { try { logErr(`[local-server] ${d.toString().trim()}`); } catch (_) {} });
  localServerProcess.on('exit', (code) => { try { log(`[local-server] exited with code ${code}`); } catch (_) {} });
  localServerProcess.on('message', async (msg) => {
    if (msg && msg.type === 'browser-interact' && msg.requestId) {
      try {
        if (mainWindow) {
          try { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); } catch (_) {}
          await new Promise(r => setTimeout(r, 300));
        }
        if (!mainWindow) {
          localServerProcess.send({ type: 'browser-interact-result', requestId: msg.requestId, success: false, error: 'No main window' });
          return;
        }
        let result;
        const action = msg.action;
        const selector = msg.selector;
        const value = msg.value;
        const tp = msg.port;
        switch (action) {
          case 'click':
            result = await executeInPreview(`
              const el = document.querySelector(${JSON.stringify(selector || '')});
              if (!el) return { success: false, error: 'Element not found: ${(selector || '').replace(/'/g, "\\'")}' };
              const rect = el.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const evtOpts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 };
              el.dispatchEvent(new PointerEvent('pointerdown', evtOpts));
              el.dispatchEvent(new MouseEvent('mousedown', evtOpts));
              await new Promise(r => setTimeout(r, 80));
              el.dispatchEvent(new PointerEvent('pointerup', evtOpts));
              el.dispatchEvent(new MouseEvent('mouseup', evtOpts));
              el.dispatchEvent(new MouseEvent('click', evtOpts));
              return { success: true, tagName: el.tagName, text: (el.textContent || '').slice(0, 100) };
            `, tp);
            break;
          case 'type':
            result = await executeInPreview(`
              const el = document.querySelector(${JSON.stringify(selector || '')});
              if (!el) return { success: false, error: 'Element not found' };
              el.focus();
              if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                const nativeSet = Object.getOwnPropertyDescriptor(
                  el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
                );
                if (nativeSet && nativeSet.set) nativeSet.set.call(el, ${JSON.stringify(value || '')});
                else el.value = ${JSON.stringify(value || '')};
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              } else if (el.contentEditable === 'true') {
                el.innerText = ${JSON.stringify(value || '')};
                el.dispatchEvent(new InputEvent('input', { bubbles: true }));
              }
              return { success: true };
            `, tp);
            break;
          case 'evaluate':
            result = await executeInPreview(`
              try {
                const __r = await (async () => { ${msg.code || msg.script || ''} })();
                return { success: true, result: __r };
              } catch (e) { return { success: false, error: e.message }; }
            `, tp);
            break;
          case 'select':
            result = await executeInPreview(`
              const el = document.querySelector(${JSON.stringify(selector || '')});
              if (!el) return { success: false, error: 'Element not found' };
              el.value = ${JSON.stringify(value || '')};
              el.dispatchEvent(new Event('change', { bubbles: true }));
              return { success: true };
            `, tp);
            break;
          case 'waitFor':
            result = await executeInPreview(`
              const maxWait = ${msg.timeout || 10000};
              const start = Date.now();
              while (Date.now() - start < maxWait) {
                const el = document.querySelector(${JSON.stringify(selector || '')});
                if (el) return { success: true, found: true };
                await new Promise(r => setTimeout(r, 200));
              }
              return { success: false, error: 'Timeout waiting for element' };
            `, tp);
            break;
          case 'snapshot':
            result = await executeInPreview(`
              return {
                success: true, url: location.href, title: document.title,
                bodyText: document.body ? document.body.innerText.slice(0, 2000) : '',
                elementCount: document.querySelectorAll('*').length,
              };
            `, tp);
            break;
          case 'launch_exe':
            result = await handleNativeAction(msg);
            break;
          case 'list_windows':
            result = await handleNativeAction(msg);
            break;
          case 'bring_window_to_front':
            result = await handleNativeAction(msg);
            break;
          case 'screenshot_window':
            result = await handleNativeAction(msg);
            break;
          case 'click_at':
            result = await handleNativeAction(msg);
            break;
          case 'send_keys':
            result = await handleNativeAction(msg);
            break;
          case 'get_window_info':
            result = await handleNativeAction(msg);
            break;
          default:
            result = { success: false, error: 'Unknown action: ' + action };
        }
        localServerProcess.send({ type: 'browser-interact-result', requestId: msg.requestId, ...(result || { success: false, error: 'No result' }) });
      } catch (err) {
        localServerProcess.send({ type: 'browser-interact-result', requestId: msg.requestId, success: false, error: err.message });
      }
    }
  });
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

function waitForLocalServer(maxWaitMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://127.0.0.1:${LAMBY_PORT}/health`, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          log(`Local server ready (${Date.now() - start}ms)`);
          resolve();
        });
      });
      req.on('error', () => {
        if (Date.now() - start > maxWaitMs) {
          reject(new Error(`Timeout waiting for local server on port ${LAMBY_PORT}`));
        } else {
          setTimeout(check, 200);
        }
      });
      req.setTimeout(2000, () => { req.destroy(); setTimeout(check, 200); });
    };
    check();
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
    log(`Packaged mode — loading http://localhost:${LAMBY_PORT} (local server serves dist/)`);
    waitForLocalServer().then(() => {
      mainWindow.loadURL(`http://localhost:${LAMBY_PORT}`);
    }).catch((err) => {
      logErr(`Local server never became ready: ${err.message}`);
      const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
      log(`Falling back to file:// loading: ${indexPath}`);
      mainWindow.loadFile(indexPath);
    });
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

function executeInPreview(code, targetPort) {
  if (!mainWindow) return Promise.reject(new Error('No main window'));

  const iframeFinder = targetPort
    ? `document.querySelector('iframe[src*="__preview/${targetPort}"]') || document.querySelector('iframe[src*="__preview/"]')`
    : `document.querySelector('iframe[src*="__preview/"]')`;

  const wrappedCode = `(async () => {
    const iframe = ${iframeFinder};
    if (!iframe) return { success: false, error: 'No preview iframe found in DOM' };
    const win = iframe.contentWindow;
    if (!win) return { success: false, error: 'Cannot access preview iframe contentWindow' };
    try {
      return await win.eval(${JSON.stringify('(async () => {' + code + '})()')});
    } catch (e) {
      return { success: false, error: 'Preview eval error: ' + e.message };
    }
  })()`;

  return mainWindow.webContents.executeJavaScript(wrappedCode);
}

function runPowerShell(script, timeoutMs = 10000) {
  const tmpFile = path.join(os.tmpdir(), `lamby_ps_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.ps1`);
  try {
    fs.writeFileSync(tmpFile, script, 'utf-8');
    const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`, {
      encoding: 'utf-8', timeout: timeoutMs, windowsHide: true, maxBuffer: 10 * 1024 * 1024,
    }).trim();
    return result;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

async function handleNativeAction(msg) {
  const action = msg.action;
  if (process.platform !== 'win32') {
    return { success: false, error: `Native GUI actions require Windows (current platform: ${process.platform})` };
  }
  try {
    switch (action) {
      case 'launch_exe': {
        const exePath = msg.path;
        if (!exePath) return { success: false, error: "Missing 'path' for launch_exe" };
        let args = msg.args || [];
        if (typeof args === 'string') {
          try { args = JSON.parse(args); } catch { args = args.split(',').map(a => a.trim()).filter(Boolean); }
        }
        const child = spawn(exePath, args, { detached: true, stdio: 'ignore', windowsHide: false, shell: false });
        child.unref();
        const pid = child.pid;
        log(`[NativeGUI] launch_exe: "${exePath}" args=${JSON.stringify(args)} pid=${pid}`);
        return { success: true, pid, launched: true };
      }

      case 'list_windows': {
        const script = [
          'Get-Process | Where-Object {$_.MainWindowTitle -ne ""} |',
          'Select-Object Id,MainWindowTitle,MainWindowHandle |',
          'ConvertTo-Json -Compress',
        ].join(' ');
        const raw = runPowerShell(script);
        let windows = [];
        if (raw) {
          const parsed = JSON.parse(raw);
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          windows = arr.map(w => ({ title: w.MainWindowTitle, pid: w.Id, hwnd: String(w.MainWindowHandle) }));
        }
        log(`[NativeGUI] list_windows: found ${windows.length} windows`);
        return { success: true, windows };
      }

      case 'bring_window_to_front': {
        const title = msg.title;
        const pid = msg.pid;
        if (!title && !pid) return { success: false, error: "Must provide 'title' or 'pid'" };
        const findLine = pid
          ? `$p = Get-Process -Id ${parseInt(pid)} -ErrorAction Stop`
          : `$p = Get-Process | Where-Object {$_.MainWindowTitle -like '*${(title || '').replace(/'/g, "''")}*'} | Select-Object -First 1\nif (-not $p) { throw "No window found matching '${(title || '').replace(/'/g, "''")}'" }`;
        const script = `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
${findLine}
$h = $p.MainWindowHandle
[WinAPI]::ShowWindow($h, 9) | Out-Null
[WinAPI]::SetForegroundWindow($h) | Out-Null
Write-Output "ok"`;
        runPowerShell(script);
        log(`[NativeGUI] bring_window_to_front: title=${title || ''} pid=${pid || ''}`);
        return { success: true };
      }

      case 'screenshot_window': {
        const title = msg.title;
        const pid = msg.pid;
        if (!title && !pid) return { success: false, error: "Must provide 'title' or 'pid'" };
        const findLine = pid
          ? `$p = Get-Process -Id ${parseInt(pid)} -ErrorAction Stop`
          : `$p = Get-Process | Where-Object {$_.MainWindowTitle -like '*${(title || '').replace(/'/g, "''")}*'} | Select-Object -First 1\nif (-not $p) { throw "No window found" }`;
        const script = `Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ScreenCapture {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
${findLine}
$h = $p.MainWindowHandle
[ScreenCapture]::ShowWindow($h, 9) | Out-Null
[ScreenCapture]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 300
$rect = New-Object ScreenCapture+RECT
[ScreenCapture]::GetWindowRect($h, [ref]$rect) | Out-Null
$w = $rect.Right - $rect.Left
$he = $rect.Bottom - $rect.Top
if ($w -le 0 -or $he -le 0) { throw "Window has zero size" }
$bmp = New-Object System.Drawing.Bitmap($w, $he)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($w, $he)))
$g.Dispose()
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$b64 = [Convert]::ToBase64String($ms.ToArray())
$ms.Dispose()
Write-Output $b64`;
        const b64 = runPowerShell(script, 15000);
        log(`[NativeGUI] screenshot_window: captured ${b64.length} chars base64`);
        return { success: true, image: b64 };
      }

      case 'click_at': {
        const x = parseInt(msg.x);
        const y = parseInt(msg.y);
        if (isNaN(x) || isNaN(y)) return { success: false, error: "Missing or invalid 'x'/'y' coordinates" };
        const button = (msg.button || 'left').toLowerCase();
        let downFlag, upFlag;
        if (button === 'right') { downFlag = '0x0008'; upFlag = '0x0010'; }
        else if (button === 'middle') { downFlag = '0x0020'; upFlag = '0x0040'; }
        else { downFlag = '0x0002'; upFlag = '0x0004'; }
        const script = `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseOps {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);
}
"@
[MouseOps]::SetCursorPos(${x}, ${y}) | Out-Null
Start-Sleep -Milliseconds 50
[MouseOps]::mouse_event(${downFlag}, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 50
[MouseOps]::mouse_event(${upFlag}, 0, 0, 0, [IntPtr]::Zero)
Write-Output "ok"`;
        runPowerShell(script);
        log(`[NativeGUI] click_at: x=${x} y=${y} button=${button}`);
        return { success: true, clicked: true, x, y, button };
      }

      case 'send_keys': {
        const keys = msg.keys;
        if (!keys) return { success: false, error: "Missing 'keys'" };
        const safeKeys = keys.replace(/'/g, "''");
        const script = `Add-Type -AssemblyName System.Windows.Forms\n[System.Windows.Forms.SendKeys]::SendWait('${safeKeys}')\nWrite-Output "ok"`;
        runPowerShell(script);
        log(`[NativeGUI] send_keys: "${keys}"`);
        return { success: true, sent: true, keys };
      }

      case 'get_window_info': {
        const title = msg.title;
        const pid = msg.pid;
        if (!title && !pid) return { success: false, error: "Must provide 'title' or 'pid'" };
        const findLine = pid
          ? `$p = Get-Process -Id ${parseInt(pid)} -ErrorAction Stop`
          : `$p = Get-Process | Where-Object {$_.MainWindowTitle -like '*${(title || '').replace(/'/g, "''")}*'} | Select-Object -First 1\nif (-not $p) { throw "No window found" }`;
        const script = `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinInfo {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
"@
${findLine}
$h = $p.MainWindowHandle
$rect = New-Object WinInfo+RECT
[WinInfo]::GetWindowRect($h, [ref]$rect) | Out-Null
@{title=$p.MainWindowTitle;pid=$p.Id;x=$rect.Left;y=$rect.Top;width=$rect.Right-$rect.Left;height=$rect.Bottom-$rect.Top} | ConvertTo-Json -Compress`;
        const raw = runPowerShell(script);
        const info = JSON.parse(raw);
        log(`[NativeGUI] get_window_info: ${info.title} ${info.x},${info.y} ${info.width}x${info.height}`);
        return { success: true, ...info };
      }

      default:
        return { success: false, error: `Unknown native action: ${action}` };
    }
  } catch (err) {
    logErr(`[NativeGUI] ${action} failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

function registerBrowserInteractIpcHandlers() {
  ipcMain.handle('browser-interact', async (_event, args) => {
    try {
      const { action, selector, value, url: targetUrl, port: targetPort, screenshot } = args;
      if (!action) return { success: false, error: "Missing 'action' field" };

      if (mainWindow) {
        try { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.focus(); } catch (_) {}
        await new Promise(r => setTimeout(r, 300));
      }

      if (!mainWindow) {
        return { success: false, error: 'No main window available' };
      }

      let result;
      switch (action) {
        case 'click':
          if (!selector) return { success: false, error: "Missing 'selector' for click" };
          result = await executeInPreview(`
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { success: false, error: 'Element not found: ${selector.replace(/'/g, "\\'")}' };
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const evtOpts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 };
            el.dispatchEvent(new PointerEvent('pointerdown', evtOpts));
            el.dispatchEvent(new MouseEvent('mousedown', evtOpts));
            await new Promise(r => setTimeout(r, 80));
            el.dispatchEvent(new PointerEvent('pointerup', evtOpts));
            el.dispatchEvent(new MouseEvent('mouseup', evtOpts));
            el.dispatchEvent(new MouseEvent('click', evtOpts));
            return { success: true, tagName: el.tagName, text: (el.textContent || '').slice(0, 100) };
          `, targetPort);
          break;

        case 'type':
          if (!selector) return { success: false, error: "Missing 'selector' for type" };
          if (value === undefined) return { success: false, error: "Missing 'value' for type" };
          result = await executeInPreview(`
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { success: false, error: 'Element not found: ${selector.replace(/'/g, "\\'")}' };
            el.focus();
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
              const nativeSet = Object.getOwnPropertyDescriptor(
                el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
              );
              if (nativeSet && nativeSet.set) nativeSet.set.call(el, ${JSON.stringify(value)});
              else el.value = ${JSON.stringify(value)};
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (el.contentEditable === 'true') {
              el.innerText = ${JSON.stringify(value)};
              el.dispatchEvent(new InputEvent('input', { bubbles: true }));
            }
            return { success: true };
          `, targetPort);
          break;

        case 'evaluate':
          if (!args.code) return { success: false, error: "Missing 'code' for evaluate" };
          result = await executeInPreview(`
            try {
              const __result = await (async () => { ${args.code} })();
              return { success: true, result: __result };
            } catch (e) { return { success: false, error: e.message }; }
          `, targetPort);
          break;

        case 'select':
          if (!selector) return { success: false, error: "Missing 'selector' for select" };
          if (value === undefined) return { success: false, error: "Missing 'value' for select" };
          result = await executeInPreview(`
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { success: false, error: 'Element not found' };
            el.value = ${JSON.stringify(value)};
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true };
          `, targetPort);
          break;

        case 'waitFor':
          if (!selector) return { success: false, error: "Missing 'selector' for waitFor" };
          result = await executeInPreview(`
            const maxWait = ${args.timeout || 10000};
            const start = Date.now();
            while (Date.now() - start < maxWait) {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (el) return { success: true, found: true };
              await new Promise(r => setTimeout(r, 200));
            }
            return { success: false, error: 'Timeout waiting for element' };
          `, targetPort);
          break;

        case 'snapshot':
          result = await executeInPreview(`
            return {
              success: true,
              url: location.href,
              title: document.title,
              bodyText: document.body ? document.body.innerText.slice(0, 2000) : '',
              elementCount: document.querySelectorAll('*').length,
            };
          `, targetPort);
          break;

        case 'launch_exe':
        case 'list_windows':
        case 'bring_window_to_front':
        case 'screenshot_window':
        case 'click_at':
        case 'send_keys':
        case 'get_window_info':
          result = await handleNativeAction({ action, ...args });
          break;

        default:
          return { success: false, error: 'Unknown action: ' + action };
      }

      return result || { success: false, error: 'No result from action' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  log('Browser-interact IPC handler registered');
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
  registerBrowserInteractIpcHandlers();
  registerGrokIpcHandlers();
  registerClawIpcHandlers({
    getProjectsDir: () => PROJECTS_DIR,
    getWebviewContents: null,
    getGrokIpc: null,
  });

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
