// AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
// Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
// Read docs/no-reply-system.md for the no-reply protocol.
const { app, BrowserWindow, ipcMain, clipboard, session, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const os = require('os');
const { registerGrokIpcHandlers, findGrokWebviewContents, BROWSER_MODE_VERSION } = require('./grok-ipc-handlers');
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
const CALIB_FILE = path.join(USER_DATA, 'click-calibration.json');
function _loadCalib() {
  try {
    if (fs.existsSync(CALIB_FILE)) {
      const cal = JSON.parse(fs.readFileSync(CALIB_FILE, 'utf8'));
      if (cal.scale && cal.avgOffset) return cal;
    }
  } catch {}
  return null;
}
function calibXY(rawX, rawY) {
  const cal = _loadCalib();
  if (!cal) return { x: rawX, y: rawY };
  return {
    x: Math.round(rawX * cal.scale.x + cal.avgOffset.x),
    y: Math.round(rawY * cal.scale.y + cal.avgOffset.y)
  };
}
const PROJECTS_DIR = path.resolve(process.env.PROJECT_DIR || path.join(USER_DATA, 'projects'));
const LAMBY_PORT = parseInt(process.env.LAMBY_PORT || '4999', 10);
const VITE_PORT = parseInt(process.env.VITE_PORT || '5000', 10);
const BACKUP_DIR = '.guardian-backup';

if (!fs.existsSync(USER_DATA)) fs.mkdirSync(USER_DATA, { recursive: true });
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

const RELAY_PORT = parseInt(process.env.RELAY_PORT || '4100', 10);
const TOOLS_DIR = path.join(USER_DATA, 'tools');

let mainWindow = null;
let localServerProcess = null;
let localRelayProcess = null;
let localRelayRunning = false;
const quickTunnels = new Map();
const QUICK_TUNNEL_COUNT = 3;
let tunnelUrl = '';
const namedTunnels = new Map();
const TUNNELS_DIR = path.join(USER_DATA, 'tunnels');
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

function startLocalRelay() {
  const relayPath = path.join(__dirname, '..', '..', 'server', 'bridge-relay-local.cjs');
  const relayPathAlt = path.join(__dirname, 'bridge-relay-local.cjs');
  const relayPathPkg = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'bridge-relay-local.cjs')
    : null;
  let actualRelayPath = null;
  for (const p of [relayPath, relayPathAlt, relayPathPkg].filter(Boolean)) {
    if (fs.existsSync(p)) { actualRelayPath = p; break; }
  }
  if (!actualRelayPath) {
    log('bridge-relay-local.js not found, local relay disabled');
    log(`  Checked: ${relayPath}`);
    log(`  Checked: ${relayPathAlt}`);
    if (relayPathPkg) log(`  Checked: ${relayPathPkg}`);
    return;
  }
  function triggerLocalServerReconnect() {
    const LAMBY_PORT = process.env.LAMBY_PORT || '4999';
    const req = http.get(`http://localhost:${LAMBY_PORT}/api/bridge-reconnect`, { timeout: 3000 }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => { log(`[relay] Triggered local-server reconnect to local relay`); });
    });
    req.on('error', () => {});
    req.on('timeout', () => { req.destroy(); });
  }
  log(`Starting local relay on port ${RELAY_PORT} from ${actualRelayPath}`);
  const relayEnv = { ...process.env, PORT: String(RELAY_PORT) };
  if (app.isPackaged) {
    relayEnv.ELECTRON_RUN_AS_NODE = '1';
  }
  localRelayProcess = spawn(process.execPath, [actualRelayPath], {
    env: relayEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  localRelayProcess.stdout.on('data', (d) => {
    const line = d.toString().trim();
    try { log(`[relay] ${line}`); } catch (_) {}
    if (line.includes('listening') || line.includes('Listening') || line.includes(`port ${RELAY_PORT}`) || line.includes(`:${RELAY_PORT}`)) {
      localRelayRunning = true;
      log(`Local relay confirmed running on port ${RELAY_PORT}`);
      startTunnel();
      triggerLocalServerReconnect();
    }
  });
  localRelayProcess.stderr.on('data', (d) => {
    try { logErr(`[relay] ${d.toString().trim()}`); } catch (_) {}
  });
  localRelayProcess.on('exit', (code) => {
    log(`[relay] exited with code ${code}`);
    localRelayRunning = false;
    localRelayProcess = null;
    if (code !== 0 && code !== null) {
      log('[relay] Crashed — restarting in 3s...');
      setTimeout(() => { if (!localRelayProcess) startLocalRelay(); }, 3000);
    }
  });
  setTimeout(() => {
    if (localRelayProcess && !localRelayRunning) {
      const probe = http.get(`http://localhost:${RELAY_PORT}/health`, { timeout: 3000 }, (res) => {
        let d = '';
        res.on('data', (c) => { d += c; });
        res.on('end', () => {
          localRelayRunning = true;
          log(`Local relay confirmed running on port ${RELAY_PORT} (health probe)`);
          startTunnel();
          triggerLocalServerReconnect();
        });
      });
      probe.on('error', () => {
        log(`Local relay health probe failed — relay may not be ready yet`);
      });
      probe.on('timeout', () => { probe.destroy(); });
    }
  }, 5000);
}

function getCloudflaredPath() {
  if (!fs.existsSync(TOOLS_DIR)) fs.mkdirSync(TOOLS_DIR, { recursive: true });
  if (process.platform === 'win32') return path.join(TOOLS_DIR, 'cloudflared.exe');
  return path.join(TOOLS_DIR, 'cloudflared');
}

function downloadCloudflared() {
  return new Promise((resolve, reject) => {
    const cfPath = getCloudflaredPath();
    if (fs.existsSync(cfPath)) {
      log('cloudflared already downloaded');
      resolve(cfPath);
      return;
    }
    let url;
    if (process.platform === 'win32') {
      url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';
    } else if (process.platform === 'darwin') {
      const arch = os.arch() === 'arm64' ? 'darwin-arm64' : 'darwin-amd64';
      url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-${arch}`;
    } else {
      const arch = os.arch() === 'arm64' ? 'linux-arm64' : 'linux-amd64';
      url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-${arch}`;
    }
    log(`Downloading cloudflared from ${url}...`);
    const https = require('https');
    function download(downloadUrl, redirects) {
      if (redirects > 5) { reject(new Error('Too many redirects')); return; }
      const mod = downloadUrl.startsWith('https') ? https : http;
      mod.get(downloadUrl, { headers: { 'User-Agent': 'Lamby' }, timeout: 30000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          download(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(cfPath);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          if (process.platform !== 'win32') {
            try { fs.chmodSync(cfPath, 0o755); } catch {}
          }
          log(`cloudflared downloaded to ${cfPath}`);
          resolve(cfPath);
        });
        file.on('error', (e) => { try { fs.unlinkSync(cfPath); } catch {} reject(e); });
      }).on('error', reject);
    }
    download(url, 0);
  });
}

function killStaleCloudflared() {
  const knownPids = new Set();
  for (const qt of quickTunnels.values()) {
    if (qt.process && qt.process.pid) knownPids.add(qt.process.pid);
  }
  for (const t of namedTunnels.values()) {
    if (t.process && t.process.pid) knownPids.add(t.process.pid);
  }
  try {
    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      const list = execSync('tasklist /FI "IMAGENAME eq cloudflared.exe" /FO CSV /NH', { encoding: 'utf8', windowsHide: true, timeout: 5000 });
      const pids = [];
      for (const line of list.split('\n')) {
        const m = line.match(/"cloudflared\.exe","(\d+)"/i);
        if (m) {
          const pid = parseInt(m[1], 10);
          if (!knownPids.has(pid)) pids.push(pid);
        }
      }
      if (pids.length > 0) {
        log(`[tunnel] Killing ${pids.length} stale cloudflared process(es): ${pids.join(', ')}`);
        for (const pid of pids) {
          try { execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'pipe', windowsHide: true, timeout: 5000 }); } catch {}
        }
      }
    } else {
      const { execSync } = require('child_process');
      try { execSync('pkill -f cloudflared 2>/dev/null || true', { stdio: 'pipe', timeout: 5000 }); } catch {}
    }
  } catch (e) {
    log(`[tunnel] Stale cleanup warning: ${e.message}`);
  }
}

function discoverNamedTunnels() {
  if (!fs.existsSync(TUNNELS_DIR)) {
    try { fs.mkdirSync(TUNNELS_DIR, { recursive: true }); } catch {}
    log(`[tunnel] Created tunnels dir: ${TUNNELS_DIR}`);
    log(`[tunnel] To add named tunnels, place UUID.json credential files in: ${TUNNELS_DIR}`);
    return [];
  }
  const files = fs.readdirSync(TUNNELS_DIR).filter(f => f.endsWith('.json'));
  const tunnels = [];
  for (const file of files) {
    try {
      const fullPath = path.join(TUNNELS_DIR, file);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const uuid = file.replace('.json', '');
      if (data.TunnelSecret && data.AccountTag) {
        tunnels.push({
          uuid,
          name: data.TunnelName || uuid,
          credFile: fullPath,
          account: data.AccountTag,
        });
        log(`[tunnel] Found named tunnel: ${data.TunnelName || uuid} (${uuid.slice(0, 8)}...)`);
      }
    } catch (e) {
      log(`[tunnel] Skipping ${file}: ${e.message}`);
    }
  }
  return tunnels;
}

function startNamedTunnel(tunnelInfo, cfPath) {
  const { uuid, name, credFile } = tunnelInfo;
  if (namedTunnels.has(uuid) && namedTunnels.get(uuid).process) {
    log(`[tunnel:${name}] Already running, skipping`);
    return;
  }

  log(`[tunnel:${name}] Starting named tunnel ${uuid.slice(0, 8)}... → localhost:${RELAY_PORT}`);

  const configContent = `tunnel: ${uuid}\ncredentials-file: ${credFile}\ningress:\n  - service: http://localhost:${RELAY_PORT}\n`;
  const configPath = path.join(TUNNELS_DIR, `${uuid}-config.yml`);
  fs.writeFileSync(configPath, configContent, 'utf8');

  const proc = spawn(cfPath, ['tunnel', '--no-autoupdate', '--config', configPath, 'run', uuid], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const entry = { process: proc, uuid, name, url: null, retries: 0, configPath };
  namedTunnels.set(uuid, entry);

  const handleLine = (line) => {
    try { log(`[tunnel:${name}] ${line}`); } catch {}
    const urlMatch = line.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/);
    if (urlMatch && !entry.url) {
      entry.url = urlMatch[1];
      entry.retries = 0;
      log(`[tunnel:${name}] URL: ${entry.url}`);
      broadcastTunnelUrls();
    }
    const cfUrlMatch = line.match(/registered.*route.*url=(https:\/\/[^\s]+)/i) || line.match(/Connection.*registered.*connIndex/i);
    if (cfUrlMatch) {
      log(`[tunnel:${name}] Connection registered`);
      if (!entry.url) {
        entry.url = `https://${uuid.slice(0, 8)}.cfargotunnel.com`;
        broadcastTunnelUrls();
      }
    }
  };

  proc.stdout.on('data', (d) => handleLine(d.toString().trim()));
  proc.stderr.on('data', (d) => handleLine(d.toString().trim()));

  proc.on('exit', (code) => {
    log(`[tunnel:${name}] Exited with code ${code}`);
    entry.process = null;
    const hadUrl = !!entry.url;
    entry.url = null;
    broadcastTunnelUrls();

    if (hadUrl) {
      entry.retries = 0;
      log(`[tunnel:${name}] Was connected — restarting in 5s...`);
      setTimeout(() => {
        if (localRelayRunning && (!namedTunnels.has(uuid) || !namedTunnels.get(uuid).process)) {
          downloadCloudflared().then((cf) => startNamedTunnel(tunnelInfo, cf)).catch(() => {});
        }
      }, 5000);
    } else {
      entry.retries++;
      if (entry.retries < 10) {
        const delay = Math.min(5000 * Math.pow(2, entry.retries - 1), 120000);
        log(`[tunnel:${name}] Retry ${entry.retries}/10 in ${delay / 1000}s...`);
        setTimeout(() => {
          if (localRelayRunning) {
            downloadCloudflared().then((cf) => startNamedTunnel(tunnelInfo, cf)).catch(() => {});
          }
        }, delay);
      } else {
        log(`[tunnel:${name}] All retries exhausted — will try again in 2 minutes`);
        entry.retries = 0;
        setTimeout(() => {
          if (localRelayRunning) {
            downloadCloudflared().then((cf) => startNamedTunnel(tunnelInfo, cf)).catch(() => {});
          }
        }, 120000);
      }
    }
  });

  proc.on('error', (err) => {
    logErr(`[tunnel:${name}] Spawn error: ${err.message}`);
    entry.process = null;
  });
}

function broadcastTunnelUrls() {
  const allUrls = [];
  for (const [id, qt] of quickTunnels) {
    if (qt.url) allUrls.push({ type: 'quick', name: `quick-${id}`, url: qt.url });
  }
  for (const [uuid, t] of namedTunnels) {
    if (t.url) allUrls.push({ type: 'named', name: t.name, uuid, url: t.url });
  }
  tunnelUrl = allUrls.length > 0 ? allUrls[0].url : '';
  const primary = tunnelUrl;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tunnel-url-changed', primary);
    mainWindow.webContents.send('tunnel-pool-changed', allUrls);
  }
  try {
    const markerPath = path.join(path.resolve(__dirname, '../..'), '_new_tunnel_url.txt');
    const content = allUrls.map(t => t.url).join('\n');
    if (content) fs.writeFileSync(markerPath, content, 'utf8');
  } catch {}
  log(`[tunnel] Active tunnel pool: ${allUrls.length} tunnels${allUrls.length > 0 ? ' → ' + allUrls.map(t => t.url).join(', ') : ''}`);
}

const MAX_QUICK_RETRIES = 5;

function startAllTunnels() {
  if (!localRelayRunning) return;
  killStaleCloudflared();

  const named = discoverNamedTunnels();

  if (named.length > 0) {
    log(`[tunnel] Found ${named.length} named tunnel(s) — launching all in parallel`);
    downloadCloudflared().then((cfPath) => {
      for (const t of named) {
        startNamedTunnel(t, cfPath);
      }
      const quickNeeded = Math.max(0, QUICK_TUNNEL_COUNT - named.length);
      if (quickNeeded > 0) {
        log(`[tunnel] Launching ${quickNeeded} QuickTunnel(s) to fill pool to ${QUICK_TUNNEL_COUNT}`);
        for (let i = 0; i < quickNeeded; i++) {
          startOneQuickTunnel(i, cfPath);
        }
      }
    }).catch((err) => {
      logErr(`[tunnel] cloudflared download failed: ${err.message}`);
      launchAllQuickTunnels();
    });
  } else {
    log(`[tunnel] No named tunnels found — launching ${QUICK_TUNNEL_COUNT} QuickTunnels in parallel`);
    launchAllQuickTunnels();
  }
}

function launchAllQuickTunnels() {
  downloadCloudflared().then((cfPath) => {
    log(`[tunnel] Launching ${QUICK_TUNNEL_COUNT} QuickTunnels (staggered 10s apart to avoid Cloudflare rate limits)`);
    for (let i = 0; i < QUICK_TUNNEL_COUNT; i++) {
      const delay = i * 10000;
      if (delay === 0) {
        startOneQuickTunnel(i, cfPath);
      } else {
        setTimeout(() => {
          if (localRelayRunning) startOneQuickTunnel(i, cfPath);
        }, delay);
      }
    }
  }).catch((err) => {
    logErr(`[tunnel] cloudflared download failed: ${err.message}`);
    const cfPath = getCloudflaredPath();
    if (fs.existsSync(cfPath)) {
      log('[tunnel] Removing possibly corrupt cloudflared binary and retrying...');
      try { fs.unlinkSync(cfPath); } catch {}
    }
    setTimeout(() => { if (localRelayRunning) launchAllQuickTunnels(); }, 10000);
  });
}

function startOneQuickTunnel(id, cfPath) {
  const existing = quickTunnels.get(id);
  if (existing && existing.process) return;

  const entry = { process: null, url: null, retries: existing ? existing.retries : 0 };
  quickTunnels.set(id, entry);

  log(`[tunnel:quick-${id}] Starting QuickTunnel for localhost:${RELAY_PORT} (attempt ${entry.retries + 1}/${MAX_QUICK_RETRIES})`);

  const proc = spawn(cfPath, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${RELAY_PORT}`], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  entry.process = proc;

  const urlTimeout = setTimeout(() => {
    if (!entry.url && entry.process) {
      log(`[tunnel:quick-${id}] No URL received after 30s — killing and retrying...`);
      try { entry.process.kill('SIGKILL'); } catch {}
    }
  }, 30000);

  const parseUrl = (line) => {
    const m = line.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/);
    if (m && !entry.url) {
      entry.url = m[1];
      entry.retries = 0;
      clearTimeout(urlTimeout);
      log(`[tunnel:quick-${id}] URL: ${entry.url}`);
      broadcastTunnelUrls();
      return true;
    }
    return false;
  };

  proc.stdout.on('data', (d) => {
    const line = d.toString().trim();
    try { log(`[tunnel:quick-${id}] ${line}`); } catch (_) {}
    parseUrl(line);
  });
  proc.stderr.on('data', (d) => {
    const line = d.toString().trim();
    try { log(`[tunnel:quick-${id}] ${line}`); } catch (_) {}
    parseUrl(line);
  });

  proc.on('exit', (code) => {
    clearTimeout(urlTimeout);
    log(`[tunnel:quick-${id}] Exited with code ${code}`);
    const hadUrl = !!entry.url;
    entry.process = null;
    entry.url = null;
    broadcastTunnelUrls();

    if (hadUrl) {
      entry.retries = 0;
      log(`[tunnel:quick-${id}] Was connected — restarting in 3s...`);
      setTimeout(() => {
        if (localRelayRunning) {
          downloadCloudflared().then((cf) => startOneQuickTunnel(id, cf)).catch(() => {});
        }
      }, 3000);
    } else {
      entry.retries++;
      if (entry.retries < MAX_QUICK_RETRIES) {
        const delay = Math.min(5000 * Math.pow(2, entry.retries - 1), 60000);
        log(`[tunnel:quick-${id}] Retry ${entry.retries}/${MAX_QUICK_RETRIES} in ${delay / 1000}s...`);
        setTimeout(() => {
          if (localRelayRunning) {
            downloadCloudflared().then((cf) => startOneQuickTunnel(id, cf)).catch(() => {});
          }
        }, delay);
      } else {
        logErr(`[tunnel:quick-${id}] All ${MAX_QUICK_RETRIES} attempts failed — retrying in 60s`);
        entry.retries = 0;
        setTimeout(() => {
          if (localRelayRunning) {
            downloadCloudflared().then((cf) => startOneQuickTunnel(id, cf)).catch(() => {});
          }
        }, 60000);
      }
    }
  });

  proc.on('error', (err) => {
    clearTimeout(urlTimeout);
    logErr(`[tunnel:quick-${id}] spawn error: ${err.message}`);
    entry.process = null;
  });
}

function startTunnel() {
  startAllTunnels();
}

function stopAllTunnels() {
  for (const [uuid, t] of namedTunnels) {
    if (t.process) {
      log(`[tunnel] Stopping named tunnel ${t.name} (${uuid.slice(0, 8)}...)`);
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${t.process.pid} /T /F`, { stdio: 'pipe', windowsHide: true });
        } else {
          t.process.kill('SIGTERM');
        }
      } catch {}
      t.process = null;
      t.url = null;
    }
    if (t.configPath) {
      try { fs.unlinkSync(t.configPath); } catch {}
    }
  }
  namedTunnels.clear();
}

function stopLocalRelay() {
  stopAllTunnels();
  for (const [id, qt] of quickTunnels) {
    if (qt.process) {
      log(`[tunnel] Stopping quick tunnel ${id}`);
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${qt.process.pid} /T /F`, { stdio: 'pipe', windowsHide: true });
        } else {
          qt.process.kill('SIGTERM');
        }
      } catch {}
      qt.process = null;
      qt.url = null;
    }
  }
  quickTunnels.clear();
  tunnelUrl = '';
  if (localRelayProcess) {
    const proc = localRelayProcess;
    localRelayProcess = null;
    localRelayRunning = false;
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'pipe', windowsHide: true });
      } else {
        proc.kill('SIGTERM');
      }
    } catch {}
  }
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
          case 'double_click':
          case 'right_click':
          case 'mouse_down':
          case 'mouse_up':
          case 'mouse_move':
          case 'drag':
          case 'scroll':
          case 'hover':
            result = await handleNativeAction(msg);
            break;
          case 'send_keys':
            result = await handleNativeAction(msg);
            break;
          case 'get_window_info':
            result = await handleNativeAction(msg);
            break;
          case 'inject_prompt':
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
        if (exePath === 'PATH_TO_EXE' || exePath === 'PATH') return { success: false, error: "Invalid path — use an actual executable path, not the placeholder" };
        let args = msg.args || [];
        if (typeof args === 'string') {
          try { args = JSON.parse(args); } catch { args = args.split(',').map(a => a.trim()).filter(Boolean); }
        }
        try {
          if (!exePath.includes('\\') && !exePath.includes('/') && !fs.existsSync(exePath)) {
            try { execSync(`where "${exePath}"`, { encoding: 'utf-8', timeout: 5000, windowsHide: true }); } catch {
              return { success: false, error: `Executable not found: "${exePath}". Provide a full path.` };
            }
          } else if ((exePath.includes('\\') || exePath.includes('/')) && !fs.existsSync(exePath)) {
            return { success: false, error: `File not found: "${exePath}"` };
          }
          const child = spawn(exePath, args, { detached: true, stdio: 'ignore', windowsHide: false, shell: false });
          child.on('error', (err) => { logErr(`[NativeGUI] launch_exe child error: ${err.message}`); });
          child.unref();
          const pid = child.pid;
          log(`[NativeGUI] launch_exe: "${exePath}" args=${JSON.stringify(args)} pid=${pid}`);
          return { success: true, pid, launched: true };
        } catch (spawnErr) {
          logErr(`[NativeGUI] launch_exe spawn failed: ${spawnErr.message}`);
          return { success: false, error: `Failed to launch: ${spawnErr.message}` };
        }
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
        const rawX = parseInt(msg.x);
        const rawY = parseInt(msg.y);
        if (isNaN(rawX) || isNaN(rawY)) return { success: false, error: "Missing or invalid 'x'/'y' coordinates" };
        const { x, y } = msg.raw ? { x: rawX, y: rawY } : calibXY(rawX, rawY);
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
        log(`[NativeGUI] click_at: raw=(${rawX},${rawY}) calibrated=(${x},${y}) button=${button}`);
        return { success: true, clicked: true, x, y, rawX, rawY, button, calibrated: x !== rawX || y !== rawY };
      }

      case 'double_click': {
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
Start-Sleep -Milliseconds 30
[MouseOps]::mouse_event(${downFlag}, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 30
[MouseOps]::mouse_event(${upFlag}, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 50
[MouseOps]::mouse_event(${downFlag}, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 30
[MouseOps]::mouse_event(${upFlag}, 0, 0, 0, [IntPtr]::Zero)
Write-Output "ok"`;
        runPowerShell(script);
        log(`[NativeGUI] double_click: x=${x} y=${y} button=${button}`);
        return { success: true, double_clicked: true, x, y, button };
      }

      case 'right_click': {
        const x = parseInt(msg.x);
        const y = parseInt(msg.y);
        if (isNaN(x) || isNaN(y)) return { success: false, error: "Missing or invalid 'x'/'y' coordinates" };
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
[MouseOps]::mouse_event(0x0008, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 50
[MouseOps]::mouse_event(0x0010, 0, 0, 0, [IntPtr]::Zero)
Write-Output "ok"`;
        runPowerShell(script);
        log(`[NativeGUI] right_click: x=${x} y=${y}`);
        return { success: true, right_clicked: true, x, y };
      }

      case 'mouse_down': {
        const x = parseInt(msg.x);
        const y = parseInt(msg.y);
        if (isNaN(x) || isNaN(y)) return { success: false, error: "Missing or invalid 'x'/'y' coordinates" };
        const button = (msg.button || 'left').toLowerCase();
        let downFlag;
        if (button === 'right') { downFlag = '0x0008'; }
        else if (button === 'middle') { downFlag = '0x0020'; }
        else { downFlag = '0x0002'; }
        const script = `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseOps {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);
}
"@
[MouseOps]::SetCursorPos(${x}, ${y}) | Out-Null
Start-Sleep -Milliseconds 30
[MouseOps]::mouse_event(${downFlag}, 0, 0, 0, [IntPtr]::Zero)
Write-Output "ok"`;
        runPowerShell(script);
        log(`[NativeGUI] mouse_down: x=${x} y=${y} button=${button}`);
        return { success: true, mouse_down: true, x, y, button };
      }

      case 'mouse_up': {
        const x = parseInt(msg.x);
        const y = parseInt(msg.y);
        if (isNaN(x) || isNaN(y)) return { success: false, error: "Missing or invalid 'x'/'y' coordinates" };
        const button = (msg.button || 'left').toLowerCase();
        let upFlag;
        if (button === 'right') { upFlag = '0x0010'; }
        else if (button === 'middle') { upFlag = '0x0040'; }
        else { upFlag = '0x0004'; }
        const script = `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseOps {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);
}
"@
[MouseOps]::SetCursorPos(${x}, ${y}) | Out-Null
Start-Sleep -Milliseconds 30
[MouseOps]::mouse_event(${upFlag}, 0, 0, 0, [IntPtr]::Zero)
Write-Output "ok"`;
        runPowerShell(script);
        log(`[NativeGUI] mouse_up: x=${x} y=${y} button=${button}`);
        return { success: true, mouse_up: true, x, y, button };
      }

      case 'mouse_move': {
        const x = parseInt(msg.x);
        const y = parseInt(msg.y);
        if (isNaN(x) || isNaN(y)) return { success: false, error: "Missing or invalid 'x'/'y' coordinates" };
        const script = `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseOps {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
}
"@
[MouseOps]::SetCursorPos(${x}, ${y}) | Out-Null
Write-Output "ok"`;
        runPowerShell(script);
        log(`[NativeGUI] mouse_move: x=${x} y=${y}`);
        return { success: true, mouse_moved: true, x, y };
      }

      case 'drag': {
        const x1 = parseInt(msg.x1 || msg.fromX || msg.x);
        const y1 = parseInt(msg.y1 || msg.fromY || msg.y);
        const x2 = parseInt(msg.x2 || msg.toX);
        const y2 = parseInt(msg.y2 || msg.toY);
        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return { success: false, error: "Missing coordinates. Need x1,y1,x2,y2 (or fromX,fromY,toX,toY)" };
        const button = (msg.button || 'left').toLowerCase();
        let downFlag, upFlag, moveFlag;
        if (button === 'right') { downFlag = '0x0008'; upFlag = '0x0010'; moveFlag = '0x0001'; }
        else if (button === 'middle') { downFlag = '0x0020'; upFlag = '0x0040'; moveFlag = '0x0001'; }
        else { downFlag = '0x0002'; upFlag = '0x0004'; moveFlag = '0x0001'; }
        const steps = parseInt(msg.steps) || 20;
        const stepDelay = parseInt(msg.stepDelay) || 5;
        const script = `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseOps {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);
}
"@
[MouseOps]::SetCursorPos(${x1}, ${y1}) | Out-Null
Start-Sleep -Milliseconds 50
[MouseOps]::mouse_event(${downFlag}, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 30
$steps = ${steps}
for ($i = 1; $i -le $steps; $i++) {
  $cx = [int](${x1} + (${x2} - ${x1}) * $i / $steps)
  $cy = [int](${y1} + (${y2} - ${y1}) * $i / $steps)
  [MouseOps]::SetCursorPos($cx, $cy) | Out-Null
  [MouseOps]::mouse_event(${moveFlag}, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds ${stepDelay}
}
[MouseOps]::SetCursorPos(${x2}, ${y2}) | Out-Null
Start-Sleep -Milliseconds 30
[MouseOps]::mouse_event(${upFlag}, 0, 0, 0, [IntPtr]::Zero)
Write-Output "ok"`;
        runPowerShell(script, 15000);
        log(`[NativeGUI] drag: (${x1},${y1}) -> (${x2},${y2}) button=${button} steps=${steps}`);
        return { success: true, dragged: true, from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, button, steps };
      }

      case 'scroll': {
        const x = parseInt(msg.x || 0);
        const y = parseInt(msg.y || 0);
        const deltaY = parseInt(msg.deltaY || msg.amount || msg.delta || 0);
        const deltaX = parseInt(msg.deltaX || 0);
        if (deltaY === 0 && deltaX === 0) return { success: false, error: "Need deltaY or deltaX (positive=down/right, negative=up/left). e.g. deltaY=-120 for scroll up" };
        let script = `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseOps {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);
}
"@
`;
        if (x || y) script += `[MouseOps]::SetCursorPos(${x}, ${y}) | Out-Null\nStart-Sleep -Milliseconds 30\n`;
        if (deltaY !== 0) {
          const wheelDelta = -deltaY;
          script += `[MouseOps]::mouse_event(0x0800, 0, 0, ${wheelDelta}, [IntPtr]::Zero)\n`;
        }
        if (deltaX !== 0) {
          const hWheelDelta = deltaX;
          script += `[MouseOps]::mouse_event(0x01000, 0, 0, ${hWheelDelta}, [IntPtr]::Zero)\n`;
        }
        script += `Write-Output "ok"`;
        runPowerShell(script);
        log(`[NativeGUI] scroll: x=${x} y=${y} deltaY=${deltaY} deltaX=${deltaX}`);
        return { success: true, scrolled: true, x, y, deltaY, deltaX };
      }

      case 'hover': {
        const x = parseInt(msg.x);
        const y = parseInt(msg.y);
        if (isNaN(x) || isNaN(y)) return { success: false, error: "Missing or invalid 'x'/'y' coordinates" };
        const duration = parseInt(msg.duration) || 500;
        const script = `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseOps {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);
}
"@
[MouseOps]::SetCursorPos(${x}, ${y}) | Out-Null
[MouseOps]::mouse_event(0x0001, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds ${duration}
Write-Output "ok"`;
        runPowerShell(script);
        log(`[NativeGUI] hover: x=${x} y=${y} duration=${duration}ms`);
        return { success: true, hovered: true, x, y, duration };
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

      case 'inject_prompt': {
        const promptText = msg.prompt;
        if (!promptText) return { success: false, error: "Missing 'prompt'" };
        const wc = findGrokWebviewContents();
        if (!wc) return { success: false, error: "No Grok webview found" };
        try {
          const escapedPrompt = JSON.stringify(promptText);
          const result = await wc.executeJavaScript(`(async () => {
            const promptText = ${escapedPrompt};
            let input = null;

            const formInputs = document.querySelectorAll('form div[class*="ps-11"] div[class*="relative"] div');
            for (let i = formInputs.length - 1; i >= 0; i--) {
              const el = formInputs[i];
              if (el.children.length === 0 && el.offsetParent !== null) {
                input = el;
                break;
              }
            }

            if (!input) {
              input = document.querySelector('form div[class*="ps-11"] div[class*="relative"] div[contenteditable], div[contenteditable="true"][role="textbox"], textarea[placeholder*="Ask"]');
            }

            if (!input) {
              const all = document.querySelectorAll('div[contenteditable="true"], textarea');
              for (const el of all) {
                if (el.offsetParent !== null) { input = el; break; }
              }
            }

            if (!input) return { success: false, error: 'Could not find Grok input field' };

            input.focus();
            await new Promise(r => setTimeout(r, 100));

            if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
              const nativeSet = Object.getOwnPropertyDescriptor(
                input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
              );
              if (nativeSet && nativeSet.set) { nativeSet.set.call(input, promptText); }
              else { input.value = promptText; }
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              if (input.getAttribute('contenteditable')) {
                input.focus();
                input.innerText = '';
                input.dispatchEvent(new InputEvent('input', { bubbles: true }));
                await new Promise(r => setTimeout(r, 50));
                input.innerText = promptText;
                input.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
              } else {
                input.focus();
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, promptText);
              }
            }

            await new Promise(r => setTimeout(r, 100));
            return { success: true, inputTag: input.tagName };
          })()`);

          if (result.success) {
            await new Promise(r => setTimeout(r, 200));
            const sendMethod = await wc.executeJavaScript(`(() => {
              const form = document.querySelector('form');
              if (form) {
                const sendBtns = form.querySelectorAll('div.ms-auto button');
                if (sendBtns.length > 0) { sendBtns[sendBtns.length - 1].click(); return 'clicked-ms-auto'; }
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) { submitBtn.click(); return 'clicked-submit'; }
                form.dispatchEvent(new Event('submit', { bubbles: true }));
                return 'form-submit';
              }
              const input = document.activeElement;
              if (input) {
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                return 'enter-key';
              }
              return 'no-send';
            })()`);
            result.sendMethod = sendMethod;
            if (sendMethod === 'no-send') { result.success = false; result.error = 'Could not find send button or form'; }
          }

          log('[NativeGUI] inject_prompt: ' + JSON.stringify(result));
          return result;
        } catch (err) {
          logErr('[NativeGUI] inject_prompt failed: ' + err.message);
          return { success: false, error: err.message };
        }
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
        case 'double_click':
        case 'right_click':
        case 'mouse_down':
        case 'mouse_up':
        case 'mouse_move':
        case 'drag':
        case 'scroll':
        case 'hover':
        case 'send_keys':
        case 'get_window_info':
        case 'inject_prompt':
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

  ipcMain.handle('local-relay-status', async () => {
    return {
      running: localRelayRunning,
      port: RELAY_PORT,
      localUrl: localRelayRunning ? `http://localhost:${RELAY_PORT}` : null,
      tunnelUrl: tunnelUrl || null,
      tunnelActive: !!tunnelUrl,
      tunnelPool: (() => {
        const pool = [];
        for (const [id, qt] of quickTunnels) {
          pool.push({ type: 'quick', name: `quick-${id}`, url: qt.url, alive: !!qt.process });
        }
        for (const [uuid, t] of namedTunnels) {
          pool.push({ type: 'named', name: t.name, uuid: uuid.slice(0, 8), url: t.url, alive: !!t.process });
        }
        return pool;
      })(),
      tunnelPoolSize: Array.from(quickTunnels.values()).filter(qt => qt.url).length + Array.from(namedTunnels.values()).filter(t => t.url).length,
      tunnelsDir: TUNNELS_DIR,
    };
  });

  ipcMain.handle('restart-local-relay', async () => {
    stopLocalRelay();
    await new Promise(r => setTimeout(r, 1000));
    startLocalRelay();
    return { success: true };
  });
}

app.whenReady().then(() => {
  startLocalRelay();
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
    handleNativeAction,
  });

  log(`All IPC handlers registered (${BROWSER_MODE_VERSION})`);
});

app.on('window-all-closed', () => {
  stopLocalRelay();
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
