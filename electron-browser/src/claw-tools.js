// AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
// Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
// Read docs/no-reply-system.md for the no-reply protocol.
const { exec } = require("child_process");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { promisify } = require("util");

const execAsync = promisify(exec);

let _nativeActionHandler = null;

function setNativeActionHandler(handler) { _nativeActionHandler = handler; }

async function callNative(action, params) {
  if (_nativeActionHandler) {
    return _nativeActionHandler({ action, ...params });
  }
  if (typeof process.send === "function") {
    const requestId = `claw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
      const handler = (msg) => {
        if (msg && msg.type === "browser-interact-result" && msg.requestId === requestId) {
          clearTimeout(timeout);
          process.removeListener("message", handler);
          resolve(msg);
        }
      };
      const timeout = setTimeout(() => {
        process.removeListener("message", handler);
        resolve({ success: false, error: "IPC timeout (30s) for native action: " + action });
      }, 30000);
      process.on("message", handler);
      process.send({ type: "browser-interact", requestId, action, ...params });
    });
  }
  throw new Error("Native action handler not available — desktop app required");
}

const CDP_SNAPSHOT_JS = `(function(){
  var INTERACTIVE = 'a[href],button,[role="button"],[role="tab"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="switch"],[role="link"],[role="treeitem"],input,textarea,select,summary,[tabindex]:not([tabindex="-1"]),[contenteditable="true"],[onclick],label[for],details';
  var MAX_ELEMENTS = 500;
  var allEls = [];
  function isVisible(el) {
    if (!el.offsetParent && el.tagName !== 'BODY' && el.tagName !== 'HTML' && getComputedStyle(el).position !== 'fixed' && getComputedStyle(el).position !== 'sticky') return false;
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).opacity === '0') return false;
    return true;
  }
  function getSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    var tag = el.tagName.toLowerCase();
    if (el.name) return tag + '[name="' + el.name + '"]';
    if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]';
    if (el.getAttribute('aria-label')) return tag + '[aria-label="' + el.getAttribute('aria-label').replace(/"/g, '\\\\"') + '"]';
    var parent = el.parentElement;
    if (!parent) return tag;
    var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === el.tagName; });
    if (siblings.length === 1) {
      var pSel = getSelector(parent);
      return pSel + ' > ' + tag;
    }
    var idx = siblings.indexOf(el) + 1;
    var pSel2 = getSelector(parent);
    return pSel2 + ' > ' + tag + ':nth-of-type(' + idx + ')';
  }
  function getDescription(el) {
    var desc = '';
    var ariaLabel = el.getAttribute('aria-label');
    var title = el.getAttribute('title');
    var placeholder = el.getAttribute('placeholder');
    var alt = el.getAttribute('alt');
    var text = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
    var value = el.value || '';
    if (ariaLabel) desc = ariaLabel;
    else if (title) desc = title;
    else if (alt) desc = alt;
    else if (placeholder) desc = placeholder;
    else if (text && text.length > 0 && text.length < 80) desc = text;
    else if (value) desc = value;
    if (!desc) {
      var img = el.querySelector('img[alt]');
      if (img) desc = img.alt;
      var svg = el.querySelector('svg');
      if (!desc && svg) {
        var svgTitle = svg.querySelector('title');
        if (svgTitle) desc = svgTitle.textContent;
        else desc = '(icon)';
      }
    }
    return desc ? desc.slice(0, 100) : '(no label)';
  }
  function getElementType(el) {
    var tag = el.tagName.toLowerCase();
    var role = el.getAttribute('role');
    if (role === 'tab') return 'tab';
    if (role === 'menuitem' || role === 'menuitemcheckbox' || role === 'menuitemradio') return 'menu-item';
    if (role === 'option') return 'option';
    if (role === 'switch') return 'switch';
    if (role === 'treeitem') return 'tree-item';
    if (role === 'button' || tag === 'button') return 'button';
    if (role === 'link' || tag === 'a') return 'link';
    if (tag === 'input') {
      var t = el.type || 'text';
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'submit') return 'submit-btn';
      if (t === 'file') return 'file-input';
      if (t === 'range') return 'slider';
      return 'input-' + t;
    }
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'dropdown';
    if (tag === 'summary') return 'disclosure';
    if (el.getAttribute('contenteditable') === 'true') return 'editable';
    return role || 'interactive';
  }
  function getRegion(el) {
    var node = el.parentElement;
    var depth = 0;
    while (node && depth < 8) {
      var role = node.getAttribute('role');
      var ariaLabel = node.getAttribute('aria-label');
      var tag = node.tagName.toLowerCase();
      if (role === 'toolbar' || role === 'navigation' || role === 'menu' || role === 'menubar' || role === 'tablist' || role === 'dialog' || role === 'banner' || role === 'complementary' || role === 'main' || role === 'contentinfo') {
        return (ariaLabel || role).slice(0, 50);
      }
      if (tag === 'nav') return (ariaLabel || 'navigation').slice(0, 50);
      if (tag === 'header') return (ariaLabel || 'header').slice(0, 50);
      if (tag === 'footer') return (ariaLabel || 'footer').slice(0, 50);
      if (tag === 'aside') return (ariaLabel || 'sidebar').slice(0, 50);
      if (tag === 'form') return (ariaLabel || 'form').slice(0, 50);
      if (tag === 'dialog') return (ariaLabel || 'dialog').slice(0, 50);
      if (ariaLabel && (node.children.length > 2)) return ariaLabel.slice(0, 50);
      node = node.parentElement;
      depth++;
    }
    return 'page';
  }
  function getState(el) {
    var states = [];
    if (el.disabled) states.push('disabled');
    if (el.checked) states.push('checked');
    if (el.getAttribute('aria-selected') === 'true') states.push('selected');
    if (el.getAttribute('aria-expanded') === 'true') states.push('expanded');
    if (el.getAttribute('aria-expanded') === 'false') states.push('collapsed');
    if (el.getAttribute('aria-pressed') === 'true') states.push('pressed');
    if (el.classList.contains('active') || el.classList.contains('selected') || el.classList.contains('current')) states.push('active');
    if (el.getAttribute('aria-current')) states.push('current');
    return states.length > 0 ? states.join(',') : '';
  }
  function scanRoot(root, selectorPrefix) {
    var raw = root.querySelectorAll(INTERACTIVE);
    for (var i = 0; i < raw.length && allEls.length < MAX_ELEMENTS; i++) {
      var el = raw[i];
      try {
        if (!isVisible(el)) continue;
        if (el.tagName === 'INPUT' && el.type === 'hidden') continue;
        var sel = getSelector(el);
        if (selectorPrefix) sel = selectorPrefix + ' >>> ' + sel;
        allEls.push({
          idx: allEls.length + 1,
          desc: getDescription(el),
          type: getElementType(el),
          selector: sel,
          region: getRegion(el),
          state: getState(el),
          tag: el.tagName.toLowerCase(),
          context: selectorPrefix ? 'shadow' : 'document'
        });
      } catch(e) {}
    }
    if (allEls.length < MAX_ELEMENTS) {
      var shadowHosts = root.querySelectorAll('*');
      for (var j = 0; j < shadowHosts.length && allEls.length < MAX_ELEMENTS; j++) {
        try {
          if (shadowHosts[j].shadowRoot) {
            var hostSel = selectorPrefix ? selectorPrefix + ' >>> ' + getSelector(shadowHosts[j]) : getSelector(shadowHosts[j]);
            scanRoot(shadowHosts[j].shadowRoot, hostSel);
          }
        } catch(e) {}
      }
    }
  }
  scanRoot(document, '');
  var iframeEls = document.querySelectorAll('iframe');
  for (var fi = 0; fi < iframeEls.length && allEls.length < MAX_ELEMENTS; fi++) {
    try {
      var iframeDoc = iframeEls[fi].contentDocument || (iframeEls[fi].contentWindow && iframeEls[fi].contentWindow.document);
      if (iframeDoc) {
        var iframeSel = getSelector(iframeEls[fi]);
        scanRoot(iframeDoc, 'iframe(' + iframeSel + ')');
      }
    } catch(e) {}
  }
  var regions = {};
  allEls.forEach(function(el) {
    if (!regions[el.region]) regions[el.region] = [];
    regions[el.region].push(el);
  });
  var mapLines = [];
  var regionKeys = Object.keys(regions);
  regionKeys.forEach(function(rk) {
    var items = regions[rk];
    mapLines.push('=== ' + rk + ' (' + items.length + ' elements) ===');
    items.forEach(function(el) {
      var line = '[' + el.idx + '] ' + el.desc;
      if (el.state) line += ' {' + el.state + '}';
      line += ' — ' + el.type + ' — ' + el.selector;
      mapLines.push(line);
    });
    mapLines.push('');
  });
  return JSON.stringify({
    url: location.href, title: document.title,
    bodyText: document.body ? document.body.innerText.slice(0, 3000) : '',
    elementMap: mapLines.join('\\n'),
    totalElements: allEls.length,
    totalRegions: regionKeys.length,
    elements: allEls,
    elementCount: document.querySelectorAll('*').length
  });
})()`;

async function cdpConnect() {
  const http = require("http");
  const targets = await new Promise((resolve, reject) => {
    const req = http.get("http://localhost:9222/json", (res) => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error("CDP connection timeout")); });
  });
  const target = targets.find(t => t.type === "page" && t.webSocketDebuggerUrl && !t.url.startsWith("chrome://") && !t.url.startsWith("edge://") && !t.url.startsWith("about:"));
  if (!target) throw new Error("No active Chrome tab found via CDP. Is Chrome running with --remote-debugging-port=9222?");
  return { target, targets };
}

async function cdpSession(fn) {
  const { target, targets } = await cdpConnect();
  const WebSocket = require("ws");
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();
    function cdpSend(method, params) {
      return new Promise((res, rej) => {
        const id = msgId++;
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      }
    });
    ws.on("error", (e) => { reject(e); });
    ws.on("open", async () => {
      try {
        const result = await fn(cdpSend, targets);
        resolve(result);
        ws.close();
      } catch (e) { resolve({ error: e.message }); ws.close(); }
    });
    setTimeout(() => { ws.close(); reject(new Error("CDP timeout (15s)")); }, 15000);
  });
}

function resolveWithinCwd(cwd, maybeRelative) {
  const normalizedCwd = path.resolve(cwd);
  const resolved = path.resolve(normalizedCwd, maybeRelative);
  const relative = path.relative(normalizedCwd, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes working directory: ${maybeRelative}`);
  }
  return resolved;
}

async function listFiles(input, cwd) {
  const target = typeof input.path === "string" ? input.path : ".";
  const fullPath = resolveWithinCwd(cwd, target);
  const entries = await fsp.readdir(fullPath, { withFileTypes: true });
  const lines = entries
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => `${entry.isDirectory() ? "dir " : "file"} ${entry.name}`);
  return { content: lines.length > 0 ? lines.join("\n") : "(empty directory)" };
}

async function readFile(input, cwd) {
  if (typeof input.path !== "string") throw new Error("path is required");
  const fullPath = resolveWithinCwd(cwd, input.path);
  const content = await fsp.readFile(fullPath, "utf8");
  return { content };
}

async function writeFile(input, cwd) {
  if (typeof input.path !== "string") throw new Error("path is required");
  if (typeof input.content !== "string") throw new Error("content is required");
  const fullPath = resolveWithinCwd(cwd, input.path);
  await fsp.mkdir(path.dirname(fullPath), { recursive: true });
  await fsp.writeFile(fullPath, input.content, "utf8");
  return { content: `Wrote ${input.path}` };
}

async function searchText(input, cwd) {
  if (typeof input.query !== "string" || input.query.length === 0) {
    throw new Error("query is required");
  }
  const target = typeof input.path === "string" ? input.path : ".";
  const fullPath = resolveWithinCwd(cwd, target);

  const isWindows = process.platform === "win32";
  let cmd;
  if (isWindows) {
    cmd = `findstr /S /N /I /C:${JSON.stringify(input.query)} ${JSON.stringify(fullPath + "\\*")}`;
  } else {
    cmd = `grep -rn --include="*" ${JSON.stringify(input.query)} ${JSON.stringify(fullPath)} 2>/dev/null || true`;
  }

  try {
    const rgCmd = `rg -n --hidden --glob "!node_modules" --glob "!dist" --glob "!.git" ${JSON.stringify(input.query)} ${JSON.stringify(fullPath)}`;
    const result = await execAsync(rgCmd, { cwd, windowsHide: true, maxBuffer: 1024 * 1024 })
      .catch((error) => ({ stdout: error.stdout || "", stderr: error.stderr || "" }));
    const content = (result.stdout || "").trim() || (result.stderr || "").trim() || "(no matches)";
    return { content };
  } catch (_) {
    const result = await execAsync(cmd, { cwd, windowsHide: true, maxBuffer: 1024 * 1024 })
      .catch((error) => ({ stdout: error.stdout || "", stderr: error.stderr || "" }));
    const content = (result.stdout || "").trim() || (result.stderr || "").trim() || "(no matches)";
    return { content };
  }
}

async function runShell(input, cwd) {
  if (typeof input.command !== "string" || input.command.length === 0) {
    throw new Error("command is required");
  }
  const isWindows = process.platform === "win32";
  const shellOpts = isWindows
    ? { shell: "cmd.exe", windowsHide: true }
    : { shell: true, windowsHide: true };

  const { stdout, stderr } = await execAsync(input.command, {
    cwd,
    ...shellOpts,
    maxBuffer: 2 * 1024 * 1024,
    timeout: 60000,
  });
  const content = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
  return { content: content || "(command produced no output)" };
}

async function listWindows(input) {
  const r = await callNative("list_windows", { title: input.title || "" });
  if (!r.success) return { content: `Error: ${r.error}`, isError: true };
  const wins = r.windows || [];
  const lines = wins.map(w => `• ${w.title} (pid: ${w.pid})`);
  return { content: lines.length > 0 ? `${wins.length} windows:\n${lines.join("\n")}` : "No windows found" };
}

async function focusWindow(input) {
  if (!input.title) throw new Error("title is required");
  const r = await callNative("bring_window_to_front", { title: input.title });
  if (!r.success) return { content: `Failed to focus "${input.title}": ${r.error}`, isError: true };
  return { content: `Focused window matching "${input.title}"` };
}

async function screenshotWindow(input) {
  if (!input.title) throw new Error("title is required");
  const r = await callNative("screenshot_window", { title: input.title });
  if (!r.success) return { content: `Screenshot failed: ${r.error}`, isError: true };
  const sizeKB = r.image ? Math.round(r.image.length / 1024) : 0;
  return { content: `Screenshot captured of "${input.title}" (${sizeKB}KB). Window is visible and active.` };
}

async function clickAt(input) {
  if (input.x === undefined || input.y === undefined) throw new Error("x and y are required");
  const r = await callNative("click_at", { x: input.x, y: input.y, button: input.button || "left" });
  if (!r.success) return { content: `Click failed: ${r.error}`, isError: true };
  return { content: `Clicked at (${input.x}, ${input.y}) with ${input.button || "left"} button` };
}

async function sendKeys(input) {
  if (!input.keys) throw new Error("keys is required");
  const r = await callNative("send_keys", { keys: input.keys });
  if (!r.success) return { content: `Send keys failed: ${r.error}`, isError: true };
  return { content: `Sent keys: ${input.keys}` };
}

async function pasteText(input) {
  if (!input.text) throw new Error("text is required");
  const send = input.send !== false;
  const childProcess = require("child_process");
  try {
    const b64 = Buffer.from(input.text, "utf8").toString("base64");
    const psScript = `[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')) | Set-Clipboard`;
    childProcess.execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psScript], { timeout: 10000, stdio: "pipe" });
    await new Promise(r => setTimeout(r, 300));
    const pasteResult = await callNative("send_keys", { keys: "^v" });
    if (!pasteResult.success) return { content: `Paste failed: ${pasteResult.error}`, isError: true };
    await new Promise(r => setTimeout(r, 500));
    if (send) {
      await callNative("send_keys", { keys: "{ENTER}" });
    }
    return { content: `Pasted ${input.text.length} chars${send ? " and pressed Enter" : ""}. Preview: ${input.text.substring(0, 80)}` };
  } catch (e) {
    return { content: `Paste failed: ${e.message}`, isError: true };
  }
}

async function getWindowInfo(input) {
  if (!input.title) throw new Error("title is required");
  const r = await callNative("get_window_info", { title: input.title });
  if (!r.success) return { content: `Error: ${r.error}`, isError: true };
  return { content: `Window "${r.title}": position (${r.x}, ${r.y}), size ${r.width}x${r.height}, pid ${r.pid}` };
}

function formatSnapshot(s, prefix) {
  let content = prefix || "";
  content += `Title: ${s.title || "?"}\nURL: ${s.url || "?"}\n`;
  if (s.elementMap) {
    content += `\n${s.totalElements || 0} interactive elements in ${s.totalRegions || 0} regions:\n\n`;
    content += s.elementMap + "\n";
  } else {
    if (s.bodyText) content += `Body text (first 3000 chars):\n${s.bodyText.substring(0, 3000)}\n`;
    if (s.buttons?.length) content += `\nButtons (${s.buttons.length}):\n${s.buttons.slice(0, 20).map(b => `  "${b.text}" → selector: ${b.selector}`).join("\n")}\n`;
    if (s.inputs?.length) content += `\nInputs (${s.inputs.length}):\n${s.inputs.slice(0, 20).map(i => `  type=${i.type} name=${i.name} placeholder="${i.placeholder||""}" → selector: ${i.selector}`).join("\n")}\n`;
    if (s.links?.length) content += `\nLinks (${s.links.length}):\n${s.links.slice(0, 20).map(l => `  "${l.text}" → ${l.href}`).join("\n")}\n`;
  }
  return content;
}

async function openBrowser(input) {
  if (!input.url) throw new Error("url is required");
  const childProcess = require("child_process");
  const profileDir = "C:\\Users\\Aiden\\LambyChromeProfile";
  const args = [
    `--user-data-dir=${profileDir}`,
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    input.url,
  ];
  try {
    childProcess.execFile("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", args, { windowsHide: false, detached: true, stdio: "ignore" }).unref();
  } catch (_) {
    childProcess.exec(`start chrome ${input.url}`, { windowsHide: true });
  }
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const s = await cdpSession(async (cdpSend) => {
        const evalResult = await cdpSend("Runtime.evaluate", { expression: CDP_SNAPSHOT_JS, returnByValue: true });
        return JSON.parse(evalResult.result.value);
      });
      if (s && !s.error) {
        return { content: formatSnapshot(s, `Opened ${input.url} in Chrome.\n`) };
      }
    } catch (_) {}
  }
  return { content: `Opened ${input.url} in Chrome but couldn't get CDP snapshot yet. Try cdp_snapshot in a moment.` };
}

async function cdpSnapshot() {
  try {
    const s = await cdpSession(async (cdpSend) => {
      const evalResult = await cdpSend("Runtime.evaluate", { expression: CDP_SNAPSHOT_JS, returnByValue: true });
      return JSON.parse(evalResult.result.value);
    });
    if (s.error) return { content: `CDP snapshot failed: ${s.error}`, isError: true };
    return { content: formatSnapshot(s, `Page snapshot:\n`) };
  } catch (e) {
    return { content: `CDP snapshot failed: ${e.message}`, isError: true };
  }
}

async function cdpClick(input) {
  if (!input.selector) throw new Error("selector is required");
  try {
    const r = await cdpSession(async (cdpSend) => {
      const evalResult = await cdpSend("Runtime.evaluate", {
        expression: `(function() {
          const el = document.querySelector(${JSON.stringify(input.selector)});
          if (!el) return JSON.stringify({ success: false, error: "Element not found: ${input.selector.replace(/"/g, '\\"')}" });
          const rect = el.getBoundingClientRect();
          return JSON.stringify({ success: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, tag: el.tagName, text: (el.textContent||"").slice(0,100) });
        })()`,
        returnByValue: true
      });
      const loc = JSON.parse(evalResult.result.value);
      if (!loc.success) return loc;
      await cdpSend("Input.dispatchMouseEvent", { type: "mousePressed", x: loc.x, y: loc.y, button: "left", clickCount: 1 });
      await cdpSend("Input.dispatchMouseEvent", { type: "mouseReleased", x: loc.x, y: loc.y, button: "left", clickCount: 1 });
      return { success: true, clicked: input.selector, tag: loc.tag, text: loc.text };
    });
    if (r.error || !r.success) return { content: `Click failed: ${r.error || "unknown"}`, isError: true };
    return { content: `Clicked element: ${input.selector} (${r.tag}: "${r.text}")` };
  } catch (e) {
    return { content: `Click failed: ${e.message}`, isError: true };
  }
}

async function cdpType(input) {
  if (!input.selector) throw new Error("selector is required");
  if (!input.text) throw new Error("text is required");
  try {
    const r = await cdpSession(async (cdpSend) => {
      await cdpSend("Runtime.evaluate", {
        expression: `(function() {
          const el = document.querySelector(${JSON.stringify(input.selector)});
          if (!el) throw new Error("Element not found");
          el.focus();
          el.value = ${JSON.stringify(input.text)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        })()`,
        returnByValue: true
      });
      return { success: true };
    });
    if (r.error) return { content: `Type failed: ${r.error}`, isError: true };
    return { content: `Typed "${input.text.substring(0, 50)}" into ${input.selector}` };
  } catch (e) {
    return { content: `Type failed: ${e.message}`, isError: true };
  }
}

async function cdpNavigate(input) {
  if (!input.url) throw new Error("url is required");
  try {
    const r = await cdpSession(async (cdpSend) => {
      await cdpSend("Page.enable", {});
      await cdpSend("Page.navigate", { url: input.url });
      await new Promise(r => setTimeout(r, 3000));
      const evalResult = await cdpSend("Runtime.evaluate", { expression: CDP_SNAPSHOT_JS, returnByValue: true });
      return { success: true, snapshot: JSON.parse(evalResult.result.value) };
    });
    if (r.error) return { content: `Navigate failed: ${r.error}`, isError: true };
    return { content: formatSnapshot(r.snapshot, `Navigated to ${input.url}\n`) };
  } catch (e) {
    return { content: `Navigate failed: ${e.message}`, isError: true };
  }
}

async function cdpEval(input) {
  if (!input.code) throw new Error("code is required");
  try {
    const r = await cdpSession(async (cdpSend) => {
      const evalResult = await cdpSend("Runtime.evaluate", { expression: input.code, returnByValue: true, awaitPromise: true });
      return { success: true, result: evalResult.result?.value };
    });
    if (r.error) return { content: `Eval failed: ${r.error}`, isError: true };
    return { content: typeof r.result !== "undefined" ? String(r.result) : "(undefined)" };
  } catch (e) {
    return { content: `Eval failed: ${e.message}`, isError: true };
  }
}

async function cdpTabs() {
  try {
    const { targets } = await cdpConnect();
    const tabs = targets.filter(t => t.type === "page" && !t.url.startsWith("chrome://") && !t.url.startsWith("edge://") && !t.url.startsWith("about:"));
    const lines = tabs.map((t, i) => `  ${i}: "${t.title}" → ${t.url} (id: ${t.id})`);
    return { content: `${tabs.length} open tabs:\n${lines.join("\n")}` };
  } catch (e) {
    return { content: `CDP tabs failed: ${e.message}`, isError: true };
  }
}

async function gitStatus(input, cwd) {
  const { stdout } = await execAsync("git status --porcelain", { cwd, windowsHide: true, timeout: 10000 })
    .catch(e => ({ stdout: `Error: ${e.message}` }));
  return { content: stdout.trim() || "(working tree clean)" };
}

async function gitDiff(input, cwd) {
  const target = input.path || "";
  const { stdout } = await execAsync(`git diff ${target}`, { cwd, windowsHide: true, timeout: 15000, maxBuffer: 2 * 1024 * 1024 })
    .catch(e => ({ stdout: `Error: ${e.message}` }));
  return { content: stdout.trim() || "(no changes)" };
}

async function gitCommit(input, cwd) {
  if (!input.message) throw new Error("message is required");
  await execAsync("git add -A", { cwd, windowsHide: true, timeout: 10000 });
  const { stdout } = await execAsync(`git commit -m ${JSON.stringify(input.message)}`, { cwd, windowsHide: true, timeout: 15000 })
    .catch(e => ({ stdout: `Error: ${e.message}` }));
  return { content: stdout.trim() };
}

async function wait(input) {
  const ms = input.ms || 1000;
  const capped = Math.min(ms, 30000);
  await new Promise(r => setTimeout(r, capped));
  return { content: `Waited ${capped}ms` };
}

const toolDefinitions = [
  {
    name: "list_files",
    description: "List files and directories inside a path relative to the current workspace.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path to inspect." },
      },
    },
  },
  {
    name: "read_file",
    description: "Read a UTF-8 text file from the workspace.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write a UTF-8 text file inside the workspace.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path." },
        content: { type: "string", description: "Full file content." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "search_text",
    description: "Search for text in workspace files.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text." },
        path: { type: "string", description: "Optional relative path to narrow the search." },
      },
      required: ["query"],
    },
  },
  {
    name: "run_shell",
    description: "Run a shell command in the current workspace and capture stdout and stderr.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute." },
      },
      required: ["command"],
    },
  },
  {
    name: "list_windows",
    description: "List all open windows on the desktop. Returns title and pid for each window. Use this FIRST before trying to focus or interact with any app.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Optional partial title to filter windows." },
      },
    },
  },
  {
    name: "focus_window",
    description: "Bring a window to the front by partial title match. Case-insensitive. ALWAYS call this before sending keys or pasting text.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Partial window title to match (e.g. 'Telegram', 'Notepad', 'Chrome')." },
      },
      required: ["title"],
    },
  },
  {
    name: "screenshot_window",
    description: "Take a screenshot of a window by partial title match. Use to verify actions completed successfully.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Partial window title to match." },
      },
      required: ["title"],
    },
  },
  {
    name: "click_at",
    description: "Click at absolute screen coordinates. Use for desktop apps when you know the position. For browser pages, use cdp_click instead.",
    input_schema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X screen coordinate." },
        y: { type: "number", description: "Y screen coordinate." },
        button: { type: "string", description: "Mouse button: left, right, or middle. Default: left." },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "send_keys",
    description: "Send keystrokes to the focused window. Use for keyboard shortcuts and short text only. For longer text, use paste_text. Format: literal text, {ENTER}, {TAB}, ^c (Ctrl+C), ^v (Ctrl+V), %{F4} (Alt+F4).",
    input_schema: {
      type: "object",
      properties: {
        keys: { type: "string", description: "Keys to send. Special: {ENTER}, {TAB}, {ESCAPE}, ^c, ^v, ^a, ^z, %{F4}" },
      },
      required: ["keys"],
    },
  },
  {
    name: "paste_text",
    description: "Paste text into the focused window via clipboard (Ctrl+V). ALWAYS use this instead of send_keys for text longer than a few words. By default also presses Enter to send.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to paste." },
        send: { type: "boolean", description: "Press Enter after pasting. Default: true." },
      },
      required: ["text"],
    },
  },
  {
    name: "get_window_info",
    description: "Get position, size, and title of a window by partial title match.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Partial window title." },
      },
      required: ["title"],
    },
  },
  {
    name: "open_browser",
    description: "Open a URL in Chrome with CDP (Chrome DevTools Protocol) enabled. Returns a page snapshot with all interactive elements (buttons, inputs, links) and their CSS selectors. Use the selectors for cdp_click and cdp_type.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to open." },
      },
      required: ["url"],
    },
  },
  {
    name: "cdp_snapshot",
    description: "Get a descriptive map of ALL interactive elements on the current Chrome page. Returns numbered elements grouped by region with human-readable descriptions, types, states, and CSS selectors. READ THIS MAP FIRST to understand the page before clicking anything. Example: '[14] Brush tool {selected} — button — button.tool-brush'. Click by index using the selector.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "cdp_click",
    description: "Click an element on the Chrome page using a CSS selector from the snapshot.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the element to click (from cdp_snapshot)." },
      },
      required: ["selector"],
    },
  },
  {
    name: "cdp_type",
    description: "Type text into an input element on the Chrome page using a CSS selector.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the input element." },
        text: { type: "string", description: "Text to type." },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "cdp_navigate",
    description: "Navigate the current Chrome tab to a new URL. Returns a fresh page snapshot.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to navigate to." },
      },
      required: ["url"],
    },
  },
  {
    name: "cdp_eval",
    description: "Execute JavaScript code on the current Chrome page and return the result.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript code to evaluate." },
      },
      required: ["code"],
    },
  },
  {
    name: "cdp_tabs",
    description: "List all open Chrome tabs with their titles, URLs, and IDs.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "git_status",
    description: "Show git status (modified, added, deleted files) in the workspace.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "git_diff",
    description: "Show git diff of changes in the workspace.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Optional file path to diff." },
      },
    },
  },
  {
    name: "git_commit",
    description: "Stage all changes and commit with a message.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Commit message." },
      },
      required: ["message"],
    },
  },
  {
    name: "wait",
    description: "Wait for a specified number of milliseconds. Use between actions that need time to complete (max 30 seconds).",
    input_schema: {
      type: "object",
      properties: {
        ms: { type: "number", description: "Milliseconds to wait. Default: 1000, max: 30000." },
      },
    },
  },
];

const toolHandlers = {
  list_files: listFiles,
  read_file: readFile,
  write_file: writeFile,
  search_text: searchText,
  run_shell: runShell,
  list_windows: listWindows,
  focus_window: focusWindow,
  screenshot_window: screenshotWindow,
  click_at: clickAt,
  send_keys: sendKeys,
  paste_text: pasteText,
  get_window_info: getWindowInfo,
  open_browser: openBrowser,
  cdp_snapshot: cdpSnapshot,
  cdp_click: cdpClick,
  cdp_type: cdpType,
  cdp_navigate: cdpNavigate,
  cdp_eval: cdpEval,
  cdp_tabs: cdpTabs,
  git_status: gitStatus,
  git_diff: gitDiff,
  git_commit: gitCommit,
  wait: wait,
};

module.exports = { toolDefinitions, toolHandlers, resolveWithinCwd, setNativeActionHandler };
