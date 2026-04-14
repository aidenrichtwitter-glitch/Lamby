<!-- AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag | Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting. | Read docs/no-reply-system.md for the no-reply protocol. -->
# Lamby Bridge Relay — Complete Grok Reference

## Connection Info

- **Relay URL:** `https://35c4f698-dc00-400a-9452-39eaf17279c0-00-31k27xn7snnel.janeway.replit.dev`
- **Project Name:** `simple-keyboard-app-copy-1775775419127-copy-1775783982099`
- **All endpoints are GET requests.** No authentication needed — the relay URL is the secret.
- **All responses are JSON.**

Replace `RELAY` with the relay URL and `PROJECT` with the project name in all examples below.

---

## Part 1: All Available Endpoints

### 1.1 Run a Shell Command
```
GET RELAY/api/grok-run?project=PROJECT&cmd=COMMAND
```
- `cmd` — any Windows shell command (URL-encoded)
- The command runs in the project directory: `C:\Users\Aiden\.guardian-ai\projects\PROJECT\`
- Returns: `{"results":[{"data":{"output":"...","stderr":"...","exitCode":0}}]}`

**Example — list files:**
```
GET RELAY/api/grok-run?project=PROJECT&cmd=dir
```

**Example — check if Chrome debug port is alive:**
```
GET RELAY/api/grok-run?project=PROJECT&cmd=node -e "const http=require('http');http.get('http://localhost:9222/json/version',res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>console.log(d))}).on('error',e=>console.log('ERROR:'+e.message))"
```

### 1.2 Launch an Executable
```
GET RELAY/api/grok-launch-exe?project=PROJECT&path=FULL_EXE_PATH
```
- `path` — full path to the .exe file
- `args` — optional, JSON array of arguments (URL-encoded)
- Returns: `{"results":[{"data":{"launched":true}}]}`

**Example — launch Notepad:**
```
GET RELAY/api/grok-launch-exe?project=PROJECT&path=notepad.exe
```

**Example — launch Chrome with CDP debugging (THIS IS THE KEY ONE):**
```
GET RELAY/api/grok-launch-exe?project=PROJECT&path=C:\Program Files\Google\Chrome\Application\chrome.exe&args=["--remote-debugging-port=9222","--user-data-dir=C:\\Users\\Aiden\\AppData\\Local\\Temp\\chrome-debug","https://soundcloud.com/you/likes"]
```
- `--remote-debugging-port=9222` — opens Chrome DevTools Protocol on port 9222
- `--user-data-dir=C:\Users\Aiden\AppData\Local\Temp\chrome-debug` — CRITICAL: forces Chrome to run as a separate instance (without this, Chrome joins any existing instance and ignores the debug port flag)
- The URL at the end is the page to open

### 1.3 List All Windows
```
GET RELAY/api/grok-list-windows?project=PROJECT
```
- Returns: `{"results":[{"data":{"windows":[{"ProcessName":"chrome","MainWindowTitle":"Google - Google Chrome","Id":12345}, ...]}}]}`

### 1.4 Bring Window to Front
```
GET RELAY/api/grok-bring-to-front?project=PROJECT&title=WINDOW_TITLE
```
- `title` — partial match of the window title (case-insensitive)

### 1.5 Screenshot a Window
```
GET RELAY/api/grok-screenshot-window?project=PROJECT&title=WINDOW_TITLE
```
- `title` — partial match of the window title
- Returns: `{"results":[{"data":{"image":"data:image/png;base64,..."}}]}`

### 1.6 Click at Screen Coordinates
```
GET RELAY/api/grok-click-at?project=PROJECT&x=500&y=300&button=left
```
- `x` — screen X coordinate
- `y` — screen Y coordinate
- `button` — `left` (default) or `right`

### 1.7 Send Keystrokes
```
GET RELAY/api/grok-send-keys?project=PROJECT&keys=KEYS
```
- `keys` — SendKeys format string
  - Regular text: `hello`
  - Enter: `{ENTER}`
  - Tab: `{TAB}`
  - Ctrl+C: `^c`
  - Ctrl+V: `^v`
  - Alt+F4: `%{F4}`
  - Ctrl+T (new tab): `^t`

### 1.8 Get Window Info
```
GET RELAY/api/grok-get-window-info?project=PROJECT&title=WINDOW_TITLE
```
- Returns position, size, PID of the window

### 1.9 Inject Prompt into Grok Chat
```
GET  RELAY/api/grok-inject-prompt?project=PROJECT&prompt=YOUR_PROMPT
POST RELAY/api/grok-inject-prompt?project=PROJECT  (body: {"prompt":"YOUR_PROMPT"})
```
- Injects text into the Grok webview (SuperGrok Browser mode) input and auto-clicks Send
- Uses same selector logic as loop's `grok-send-prompt`: targets `form div.ps-11` contenteditable div
- Selector chain: `form div[class*="ps-11"] div[class*="relative"] div` (leaf nodes) → `div[contenteditable="true"]` → `textarea[placeholder*="Ask"]`
- Input method: contenteditable `innerText` with InputEvent dispatch (or native value setter for textarea fallback)
- Submit chain: `form div.ms-auto button` click → `button[type="submit"]` → form submit → Enter keydown
- Returns: `{"success":true,"inputTag":"DIV","sendMethod":"clicked-ms-auto"}`
- For long prompts, use POST with JSON body to avoid URL length limits

### 1.10 Read a File
```
GET RELAY/api/grok-read?project=PROJECT&path=RELATIVE_FILE_PATH
```
- Returns: `{"results":[{"data":{"content":"file contents here"}}]}`

### 1.10 Write/Create a File (small, <2KB)
```
GET RELAY/api/grok-create?project=PROJECT&path=RELATIVE_FILE_PATH&content=FILE_CONTENT
```
or with base64:
```
GET RELAY/api/grok-create?project=PROJECT&path=RELATIVE_FILE_PATH&contentB64=BASE64_ENCODED_CONTENT
```

### 1.11 Write a File in Chunks (large files)
```
GET RELAY/api/grok-create-chunk?project=PROJECT&path=RELATIVE_FILE_PATH&contentB64=BASE64_CHUNK&chunk=0&total=3
```
- `chunk` — 0-indexed chunk number
- `total` — total number of chunks
- Send chunks 0, 1, 2, ... in order. File is assembled after the last chunk arrives.

### 1.12 Search/Replace in a File
```
GET RELAY/api/grok-edit?project=PROJECT&path=FILE&search=OLD_TEXT&replace=NEW_TEXT
```
or with base64 for HTML/special content:
```
GET RELAY/api/grok-edit?project=PROJECT&path=FILE&searchB64=BASE64_OLD&replaceB64=BASE64_NEW
```

### 1.13 File Tree
```
GET RELAY/api/grok-tree?project=PROJECT
```

### 1.14 Search in Files
```
GET RELAY/api/grok-search?project=PROJECT&q=SEARCH_PATTERN
```

### 1.15 List Running Processes
```
GET RELAY/api/grok-process?project=PROJECT
```

### 1.16 Delete a File
```
GET RELAY/api/grok-delete?project=PROJECT&path=RELATIVE_FILE_PATH
```

### 1.17 Git Operations
```
GET RELAY/api/grok-git?project=PROJECT
```
(returns usage/help)

### 1.18 Screenshot the Lamby Preview (Electron embedded browser)
```
GET RELAY/api/screenshot-data/PROJECT
```

### 1.19 Interact with Lamby Preview (Electron embedded browser)
```
GET RELAY/api/grok-interact?project=PROJECT&action=click&selector=CSS_SELECTOR
GET RELAY/api/grok-interact?project=PROJECT&action=type&selector=CSS_SELECTOR&value=TEXT
GET RELAY/api/grok-interact?project=PROJECT&action=evaluate&code=JAVASCRIPT
GET RELAY/api/grok-interact?project=PROJECT&action=snapshot
```

---

## Part 1B: The __system__ Project (Desktop-Level Control)

Use `project=__system__` for operations that are not tied to any specific project.
`__system__` commands run from `~/.guardian-ai/tools/` and have **NO command restrictions** — the whitelist is bypassed entirely.

### Why use __system__?
- Run any Windows command (dir, powershell, tasklist, etc.) without restriction
- Launch executables, control windows, take screenshots — all without needing a project open
- System-level automation: opening apps, interacting with the desktop, running diagnostics

### Examples with __system__:
```
GET RELAY/api/grok-run?project=__system__&cmd=dir
GET RELAY/api/grok-run?project=__system__&cmd=tasklist
GET RELAY/api/grok-run?project=__system__&cmd=powershell -Command "Get-Process chrome"
GET RELAY/api/grok-list-windows?project=__system__
GET RELAY/api/grok-bring-to-front?project=__system__&title=Chrome
GET RELAY/api/grok-screenshot-window?project=__system__&title=Chrome
GET RELAY/api/grok-get-window-info?project=__system__&title=Chrome
GET RELAY/api/grok-click-at?project=__system__&x=500&y=300&button=left
GET RELAY/api/grok-send-keys?project=__system__&keys=hello{ENTER}
GET RELAY/api/grok-launch-exe?project=__system__&path=notepad.exe
```

### Desktop Interaction Workflow (RECOMMENDED):
1. `grok-list-windows` to see what's open
2. `grok-bring-to-front` to focus the target window
3. `grok-screenshot-window` to see current state
4. Use CDP (`_cdp.js`) for precise DOM interactions in browser windows — **NEVER guess coordinates**
5. `grok-click-at` / `grok-send-keys` only for non-browser windows (Notepad, Settings, etc.)
6. `grok-screenshot-window` again to verify the result

### CDP Best Practices:
- **ALWAYS prefer CDP DOM selectors** over screen coordinates for clicking in browser windows
- First query the DOM to find the right selector, then click/interact with it
- Screen coordinates are guesswork — CDP selectors are precise and reliable
- For SoundCloud play buttons: `document.querySelector('a.sc-button-play.playButton').click()`

---

## Part 2: The _cdp.js Helper Script

This script is located at:
```
~/.guardian-ai/tools/_cdp.js
```
It is also available in the project directory at:
```
C:\Users\Aiden\.guardian-ai\projects\simple-keyboard-app-copy-1775775419127-copy-1775783982099\_cdp.js
```

### What it does:
1. Connects to Chrome's debugging port at `http://localhost:9222/json`
2. Finds the first tab whose URL contains "soundcloud"
3. Opens a raw WebSocket connection to that tab's DevTools endpoint
4. Sends a `Runtime.evaluate` CDP command with whatever JavaScript expression you pass
5. Prints the result and exits

### How to call it:
```
GET RELAY/api/grok-run?project=PROJECT&cmd=node _cdp.js "JAVASCRIPT_EXPRESSION"
```

### The full source code of _cdp.js (so you can recreate it if needed):

```javascript
const http = require('http');
const net = require('net');
const crypto = require('crypto');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function sendWsFrame(socket, msg) {
  const msgBuf = Buffer.from(msg);
  const mask = crypto.randomBytes(4);
  let header;
  if (msgBuf.length < 126) {
    header = Buffer.alloc(6);
    header[0] = 0x81;
    header[1] = 0x80 | msgBuf.length;
    mask.copy(header, 2);
  } else if (msgBuf.length < 65536) {
    header = Buffer.alloc(8);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(msgBuf.length, 2);
    mask.copy(header, 4);
  } else {
    header = Buffer.alloc(14);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(msgBuf.length), 2);
    mask.copy(header, 10);
  }
  const masked = Buffer.alloc(msgBuf.length);
  for (let i = 0; i < msgBuf.length; i++) masked[i] = msgBuf[i] ^ mask[i % 4];
  socket.write(Buffer.concat([header, masked]));
}

function cdpEval(wsDebugUrl, expression) {
  return new Promise((resolve, reject) => {
    const wsUrl = new URL(wsDebugUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const socket = net.connect(parseInt(wsUrl.port), wsUrl.hostname, () => {
      const upgrade = [
        'GET ' + wsUrl.pathname + ' HTTP/1.1',
        'Host: ' + wsUrl.host,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Key: ' + key,
        'Sec-WebSocket-Version: 13',
        '', ''
      ].join('\r\n');
      socket.write(upgrade);
    });
    let upgraded = false;
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      if (!upgraded) {
        const str = chunk.toString();
        if (str.includes('101')) {
          upgraded = true;
          const leftover = chunk.slice(str.indexOf('\r\n\r\n') + 4);
          buffer = leftover;
          const msg = JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } });
          sendWsFrame(socket, msg);
        }
        return;
      }
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 2) {
        let payloadLen = buffer[1] & 0x7f;
        let offset = 2;
        if (payloadLen === 126) { payloadLen = buffer.readUInt16BE(2); offset = 4; }
        else if (payloadLen === 127) { payloadLen = Number(buffer.readBigUInt64BE(2)); offset = 10; }
        if (buffer.length >= offset + payloadLen) {
          const payload = buffer.slice(offset, offset + payloadLen).toString();
          try {
            const resp = JSON.parse(payload);
            if (resp.id === 1) { resolve(resp.result); socket.destroy(); }
          } catch {}
        }
      }
    });
    socket.on('error', (e) => reject(e));
    setTimeout(() => { socket.destroy(); reject(new Error('timeout')); }, 10000);
  });
}

(async () => {
  try {
    const tabsRaw = await httpGet('http://localhost:9222/json');
    const tabs = JSON.parse(tabsRaw);
    const tab = tabs.find(t => t.url.includes('soundcloud'));
    if (!tab) { console.log('No SoundCloud tab. Tabs:', tabs.map(t => t.title).join(', ')); return; }
    console.log('Tab:', tab.title);
    const js = process.argv[2] || 'document.title';
    const result = await cdpEval(tab.webSocketDebuggerUrl, js);
    console.log(JSON.stringify(result));
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
```

**Important:** This script currently hardcodes `soundcloud` as the tab filter. To target a different site, either:
- Modify line `const tab = tabs.find(t => t.url.includes('soundcloud'));`
- Or push a new version that accepts tab filter as a second argument

### No npm packages needed
The script uses only Node.js built-in modules: `http`, `net`, `crypto`. No npm install required.

---

## Part 3: Exact SoundCloud Playback — Every Single Step

### Step 1: Launch Chrome with remote debugging

**Call:**
```
GET RELAY/api/grok-launch-exe?project=PROJECT&path=C:\Program Files\Google\Chrome\Application\chrome.exe&args=["--remote-debugging-port=9222","--user-data-dir=C:\\Users\\Aiden\\AppData\\Local\\Temp\\chrome-debug","https://soundcloud.com/you/likes"]
```

**Expected response:**
```json
{"results":[{"data":{"launched":true}}]}
```

**What happened:** A new Chrome window opened on the desktop. It has its own temporary profile (separate from the user's main Chrome), so it will NOT be logged into any sites.

---

### Step 2: WAIT 6 SECONDS

Do nothing. Chrome needs time to:
1. Start the process
2. Open the window
3. Start the DevTools WebSocket server on port 9222
4. Load the initial page

6 seconds is the minimum safe wait time. If the next step fails, wait longer.

---

### Step 3: Verify Chrome debug port 9222 is responding

**Call:**
```
GET RELAY/api/grok-run?project=PROJECT&cmd=node -e "const http=require('http');http.get('http://localhost:9222/json/version',res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>console.log(d))}).on('error',e=>console.log('ERROR:'+e.message))"
```

**Expected SUCCESS response:**
```
{"results":[{"data":{"output":"{\n   \"Browser\": \"Chrome/146.0.7680.178\",\n   \"Protocol-Version\": \"1.3\",\n   \"User-Agent\": \"...\",\n   \"webSocketDebuggerUrl\": \"ws://localhost:9222/devtools/browser/SOME-GUID\"\n}\n"}}]}
```

**If you see `ERROR:connect ECONNREFUSED`:** Chrome hasn't started the debug server yet. Wait 3 more seconds and repeat this step.

**If you see `ERROR:connect ECONNREFUSED` after 3 retries:** Something is wrong. The Chrome launch may have failed, or another process is using port 9222. Try killing stray chrome processes and relaunching.

---

### Step 4: List all open Chrome tabs

**Call:**
```
GET RELAY/api/grok-run?project=PROJECT&cmd=node -e "const http=require('http');http.get('http://localhost:9222/json',res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{const tabs=JSON.parse(d);tabs.forEach(t=>console.log(t.type+': '+t.title+' | '+t.url.slice(0,80)))})}).on('error',e=>console.log('ERR:'+e.message))"
```

**Expected response (before login):**
```
page: SoundCloud — Register, sign-in or access our Homepage | https://soundcloud.com/signin?redirect_url=/you/likes
```

This shows a SoundCloud sign-in page because the temp Chrome profile isn't logged in.

---

### Step 5: USER MUST LOG IN

The user needs to manually log in to SoundCloud in the Chrome window that opened. This is a one-time thing — after login, the temp profile will stay logged in as long as the Chrome window stays open.

**How to know when login is complete:** Periodically check the page title (Step 6). When it changes from containing "sign-in" or "Register" to "Hear the tracks you've liked", login is done.

---

### Step 6: Check page title to confirm login status

**Call:**
```
GET RELAY/api/grok-run?project=PROJECT&cmd=node _cdp.js "document.title"
```

**Expected response (BEFORE login):**
```
{"results":[{"data":{"output":"Tab: SoundCloud — Register, sign-in or access our Homepage\n{\"result\":{\"type\":\"string\",\"value\":\"SoundCloud — Register, sign-in or access our Homepage\"}}\n"}}]}
```

**Expected response (AFTER login):**
```
{"results":[{"data":{"output":"Tab: Hear the tracks you've liked: on SoundCloud\n{\"result\":{\"type\":\"string\",\"value\":\"Hear the tracks you've liked: on SoundCloud\"}}\n"}}]}
```

If the title still says "Register" or "sign-in", the user hasn't logged in yet. Wait and retry.

---

### Step 7: Navigate to the likes page

Even if the user logged in and is now on the likes page, navigate explicitly to be sure.

**Call:**
```
GET RELAY/api/grok-run?project=PROJECT&cmd=node _cdp.js "window.location.href='https://soundcloud.com/you/likes';'navigating'"
```

**Expected response:**
```
{"results":[{"data":{"output":"Tab: Hear the tracks you've liked: on SoundCloud\n{\"result\":{\"type\":\"string\",\"value\":\"navigating\"}}\n"}}]}
```

---

### Step 8: WAIT 5 SECONDS

SoundCloud is a single-page application. After navigation, it needs time to:
1. Route to the new page internally
2. Fetch the user's liked tracks from SoundCloud API
3. Render all the track items and their play buttons in the DOM

5 seconds is the minimum safe wait for SoundCloud to finish loading.

---

### Step 9: Verify the page loaded correctly

**Call:**
```
GET RELAY/api/grok-run?project=PROJECT&cmd=node _cdp.js "JSON.stringify({title:document.title,url:location.href})"
```

**Expected response:**
```
{"results":[{"data":{"output":"Tab: Hear the tracks you've liked: on SoundCloud\n{\"result\":{\"type\":\"string\",\"value\":\"{\\\"title\\\":\\\"Hear the tracks you've liked: on SoundCloud\\\",\\\"url\\\":\\\"https://soundcloud.com/you/likes\\\"}\"}}\n"}}]}
```

Confirm that:
- `title` contains "Hear the tracks you've liked"
- `url` is `https://soundcloud.com/you/likes`

If the title says something else, navigation may not have completed. Wait 3 more seconds and retry.

---

### Step 10: Find all play buttons on the page

**Call:**
```
GET RELAY/api/grok-run?project=PROJECT&cmd=node _cdp.js "(function(){var plays=document.querySelectorAll('a.sc-button-play, button.playButton, .soundTitle__playButton, [aria-label*=Play]');return JSON.stringify({count:plays.length,first:plays[0]?{tag:plays[0].tagName,class:plays[0].className.slice(0,100),text:plays[0].textContent.trim().slice(0,50)}:null})})()"
```

**Expected response:**
```
{"results":[{"data":{"output":"Tab: Hear the tracks you've liked: on SoundCloud\n{\"result\":{\"type\":\"string\",\"value\":\"{\\\"count\\\":27,\\\"first\\\":{\\\"tag\\\":\\\"A\\\",\\\"class\\\":\\\"sc-button-play playButton sc-button sc-button-xxlarge\\\",\\\"text\\\":\\\"\\\"}}\"}}\n"}}]}
```

**What to look for:**
- `count` should be greater than 0 (the actual number depends on how many liked tracks exist)
- `first.tag` is `A` (anchor element)
- `first.class` contains `sc-button-play playButton`

**If `count` is 0:** The page hasn't finished rendering. Wait 3 more seconds and retry this step.

**If `count` is still 0 after 3 retries:** The user might not have any liked tracks, or the CSS selectors have changed.

---

### Step 11: Click the first play button

**Call:**
```
GET RELAY/api/grok-run?project=PROJECT&cmd=node _cdp.js "(function(){var btn=document.querySelector('a.sc-button-play.playButton');if(!btn)return'no button found';btn.click();return'clicked play button'})()"
```

**Expected response:**
```
{"results":[{"data":{"output":"Tab: Hear the tracks you've liked: on SoundCloud\n{\"result\":{\"type\":\"string\",\"value\":\"clicked play button\"}}\n"}}]}
```

If the response says "no button found" instead of "clicked play button", go back to step 10 to re-check selectors.

---

### Step 12: WAIT 3 SECONDS

After clicking play, SoundCloud needs to:
1. Buffer the audio
2. Start playback
3. Update the page title to show the track name

3 seconds is enough for this.

---

### Step 13: Verify the track is playing

**Call:**
```
GET RELAY/api/grok-run?project=PROJECT&cmd=node _cdp.js "document.title"
```

**Expected response:**
```
{"results":[{"data":{"output":"Tab: What Love Can Do by BONNIE X CLYDE\n{\"result\":{\"type\":\"string\",\"value\":\"What Love Can Do by BONNIE X CLYDE\"}}\n"}}]}
```

**How to confirm success:** The page title changed from "Hear the tracks you've liked: on SoundCloud" to the name of a specific track (e.g., "What Love Can Do by BONNIE X CLYDE"). This means music is playing!

**If the title is still "Hear the tracks you've liked":** The click may not have triggered playback. Try:
1. Wait 2 more seconds, then check title again
2. If still unchanged, try clicking again (repeat Step 11)
3. If still unchanged, the play button may need a different interaction — try dispatching mouse events instead:
```
GET RELAY/api/grok-run?project=PROJECT&cmd=node _cdp.js "(function(){var btn=document.querySelector('a.sc-button-play.playButton');if(!btn)return'no button';btn.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));btn.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));btn.dispatchEvent(new MouseEvent('click',{bubbles:true}));return'dispatched events'})()"
```

---

## Part 4: Other Useful CDP Patterns

### Read text from any element
```
node _cdp.js "document.querySelector('.my-class').textContent.trim()"
```

### Click any element by CSS selector
```
node _cdp.js "document.querySelector('#my-button').click();'clicked'"
```

### Type into an input field
```
node _cdp.js "var el=document.querySelector('input[type=search]');el.value='search term';el.dispatchEvent(new Event('input',{bubbles:true}));'typed'"
```

### Scroll the page
```
node _cdp.js "window.scrollBy(0, 500);'scrolled'"
```

### Get all links on a page
```
node _cdp.js "JSON.stringify([...document.querySelectorAll('a')].slice(0,20).map(a=>({text:a.textContent.trim().slice(0,40),href:a.href.slice(0,80)})))"
```

### Wait for an element to appear (poll every 500ms, up to 10s)
```
node _cdp.js "(function(){return new Promise(function(resolve){var attempts=0;var interval=setInterval(function(){var el=document.querySelector('.my-selector');attempts++;if(el){clearInterval(interval);el.click();resolve('found and clicked after '+attempts+' attempts')}else if(attempts>=20){clearInterval(interval);resolve('NOT FOUND after 10 seconds')}},500)})})()"
```

### Navigate to any URL
```
node _cdp.js "window.location.href='https://example.com';'navigating'"
```

### Get the page's full URL
```
node _cdp.js "location.href"
```

---

## Part 5: Important Warnings

1. **DO NOT run `taskkill /im chrome.exe /f`** — This kills ALL Chromium-based processes including the Lamby Electron app itself. Only kill specific Chrome PIDs if needed.

2. **The `--user-data-dir` flag is essential** — Without it, launching Chrome with `--remote-debugging-port` when another Chrome is already running will just open a new tab in the existing Chrome and NOT start the debug port.

3. **The `_cdp.js` script hardcodes "soundcloud" as the tab filter** — It searches tab URLs for the string "soundcloud". To use it with other sites, either modify the script or push a new version.

4. **CDP only works in the Chrome instance launched with `--remote-debugging-port`** — It cannot interact with Chrome instances that were started without this flag.

5. **Response format** — All grok-run responses are wrapped in: `{"results":[{"data":{"output":"STDOUT","stderr":"STDERR","exitCode":0}}]}`. The actual _cdp.js output is inside `data.output`.

6. **URL encoding** — When passing commands via `cmd=` query parameter, special characters must be URL-encoded. Spaces become `%20`, quotes become `%22`, etc.

7. **`project=__system__` bypasses all command restrictions** — Use `__system__` for system-level operations (dir, powershell, tasklist, etc.). Regular projects enforce a command whitelist; `__system__` does not.

8. **ALWAYS use CDP DOM selectors over screen coordinates** — When interacting with browser windows, use `_cdp.js` to find and click elements by CSS selector. Screen coordinates are unreliable (depend on window position, scroll state, zoom level). CDP selectors are precise and always work.

9. **`_cdp.js` is available at two locations** — `~/.guardian-ai/tools/_cdp.js` (global) and in the project directory. Use the global path with `__system__` when no project is active.
