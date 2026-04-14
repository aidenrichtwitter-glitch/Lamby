// AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
// Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
// Read docs/no-reply-system.md for the no-reply protocol.
const { ipcMain } = require("electron");
const { ClawAgentBridge, createAgent, SYSTEM_PROMPT } = require("./claw-agent-bridge");
const { toolDefinitions, setNativeActionHandler } = require("./claw-tools");
const { findGrokWebviewContents, BROWSER_MODE_VERSION } = require("./grok-ipc-handlers");

const LOG = "[ClawIPC]";

let activeAgent = null;
let agentSessions = new Map();

async function grokSendPrompt(resolveWc, promptText) {
  const wc = resolveWc();
  if (!wc) return { success: false, error: "No Grok webview found" };

  const escapedPrompt = JSON.stringify(promptText);
  const result = await wc.executeJavaScript(`(async () => {
    const promptText = ${escapedPrompt};
    let input = null;
    const formInputs = document.querySelectorAll('form div[class*="ps-11"] div[class*="relative"] div');
    for (let i = formInputs.length - 1; i >= 0; i--) {
      const el = formInputs[i];
      if (el.children.length === 0 && el.offsetParent !== null) { input = el; break; }
    }
    if (!input) input = document.querySelector('div[contenteditable="true"][role="textbox"]');
    if (!input) {
      const all = document.querySelectorAll('div[contenteditable="true"], textarea');
      for (const el of all) { if (el.offsetParent !== null) { input = el; break; } }
    }
    if (!input) return { success: false, error: 'Could not find Grok input field' };
    input.focus();
    await new Promise(r => setTimeout(r, 100));
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      const nativeSet = Object.getOwnPropertyDescriptor(
        input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
      );
      if (nativeSet && nativeSet.set) nativeSet.set.call(input, promptText);
      else input.value = promptText;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      input.innerText = '';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 50));
      input.innerText = promptText;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
    }
    await new Promise(r => setTimeout(r, 200));
    const form = document.querySelector('form');
    if (form) {
      const sendBtns = form.querySelectorAll('div.ms-auto button');
      if (sendBtns.length > 0) { sendBtns[sendBtns.length - 1].click(); return { success: true }; }
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.click(); return { success: true }; }
    }
    return { success: false, error: 'Could not find send button' };
  })()`);

  return result;
}

async function grokWaitAndExtract(resolveWc) {
  const wc = resolveWc();
  if (!wc) return { success: false, error: "No Grok webview found" };

  const maxWaitMs = 120000;
  const pollMs = 2000;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollMs));

    const generating = await wc.executeJavaScript(`(() => {
      const lastResponse = document.querySelector('div.action-buttons.last-response');
      if (lastResponse) return false;
      const allActionBars = document.querySelectorAll('div.action-buttons');
      const responseEls = document.querySelectorAll('div[id^="response-"]');
      if (responseEls.length > allActionBars.length) return true;
      const allButtons = document.querySelectorAll('button');
      for (const btn of allButtons) {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        const text = (btn.textContent || '').trim().toLowerCase();
        if (label.includes('stop') || text === 'stop' || text === 'stop generating') return true;
      }
      return false;
    })()`);

    if (!generating) {
      await new Promise(r => setTimeout(r, 500));

      const result = await wc.executeJavaScript(`(() => {
        let messages = document.querySelectorAll('div[id^="response-"]');
        if (messages.length === 0) return { success: false, error: 'No response found' };
        const last = messages[messages.length - 1];
        const text = (last.innerText || '').trim();
        if (!text || text.length < 5) return { success: false, error: 'Response too short' };
        return { success: true, text };
      })()`);

      return result;
    }
  }

  return { success: false, error: "Timed out waiting for Grok response (120s)" };
}

function registerClawIpcHandlers(opts) {
  const { getProjectsDir, getWebviewContents, getGrokIpc, handleNativeAction } = opts || {};

  if (handleNativeAction) {
    setNativeActionHandler(handleNativeAction);
    console.log(`${LOG} Native action handler wired to Claw tools`);
  }

  const resolveWc = getWebviewContents || findGrokWebviewContents;

  ipcMain.handle("claw-agent-start", async (_event, config) => {
    try {
      const {
        prompt,
        provider = "browser",
        model,
        apiKey,
        projectName,
        projectDir,
        ollamaBaseUrl,
        ollamaConfig,
        maxIterations,
        systemPrompt,
      } = config;

      if (!prompt) return { success: false, error: "prompt is required" };

      let cwd = projectDir;
      if (!cwd && projectName && getProjectsDir) {
        const path = require("path");
        cwd = path.join(getProjectsDir(), projectName);
      }
      if (!cwd) return { success: false, error: "projectDir or projectName is required" };

      const fs = require("fs");
      if (!fs.existsSync(cwd)) {
        fs.mkdirSync(cwd, { recursive: true });
      }

      if (activeAgent) {
        activeAgent.abort();
      }

      const progressLog = [];
      const agentOpts = {
        cwd,
        provider,
        model,
        apiKey,
        ollamaBaseUrl,
        ollamaConfig,
        maxIterations,
        systemPrompt,
        onProgress: (event, data) => {
          progressLog.push({ event, ...data, timestamp: Date.now() });
          console.log(`${LOG} [${data.sessionId?.slice(0, 8)}] ${event}`, JSON.stringify(data).slice(0, 200));
          try {
            _event.sender.send("claw-agent-progress", { event, ...data });
          } catch (_) {}
        },
        onToolCall: (name, input) => {
          console.log(`${LOG} Tool: ${name}(${JSON.stringify(input).slice(0, 100)})`);
        },
      };

      if (provider === "browser") {
        agentOpts.browserSendPrompt = async (promptText) => {
          if (getGrokIpc) return getGrokIpc().sendPrompt(promptText);
          return grokSendPrompt(resolveWc, promptText);
        };
        agentOpts.browserGetResponse = async () => {
          if (getGrokIpc) return getGrokIpc().getResponse();
          return grokWaitAndExtract(resolveWc);
        };
      }

      activeAgent = createAgent(agentOpts);
      const sessionId = activeAgent._sessionId;
      agentSessions.set(sessionId, { agent: activeAgent, progressLog, startTime: Date.now() });

      console.log(`${LOG} Starting agent task (session: ${sessionId.slice(0, 8)}, provider: ${provider}, model: ${model || "default"})`);

      const result = await activeAgent.runTask(prompt);

      agentSessions.get(sessionId).result = result;
      agentSessions.get(sessionId).endTime = Date.now();
      activeAgent = null;

      console.log(`${LOG} Agent task complete (session: ${sessionId.slice(0, 8)}, toolCalls: ${result.toolCalls})`);

      return {
        success: true,
        sessionId,
        text: result.text,
        toolCalls: result.toolCalls,
        error: result.error || null,
        aborted: result.aborted || false,
      };
    } catch (err) {
      console.error(`${LOG} claw-agent-start error:`, err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("claw-agent-abort", async () => {
    if (activeAgent) {
      activeAgent.abort();
      console.log(`${LOG} Agent abort requested`);
      return { success: true };
    }
    return { success: false, error: "No active agent" };
  });

  ipcMain.handle("claw-agent-status", async () => {
    return {
      active: !!activeAgent,
      sessionId: activeAgent ? activeAgent._sessionId : null,
      provider: activeAgent ? activeAgent.provider : null,
      sessions: Array.from(agentSessions.entries()).map(([id, s]) => ({
        sessionId: id,
        startTime: s.startTime,
        endTime: s.endTime || null,
        toolCalls: s.result ? s.result.toolCalls : 0,
        complete: !!s.result,
        progressCount: s.progressLog.length,
      })),
    };
  });

  ipcMain.handle("claw-agent-session", async (_event, sessionId) => {
    const session = agentSessions.get(sessionId);
    if (!session) return { success: false, error: "Session not found" };
    return {
      success: true,
      sessionId,
      startTime: session.startTime,
      endTime: session.endTime || null,
      result: session.result || null,
      progressLog: session.progressLog,
    };
  });

  ipcMain.handle("claw-tools-list", async () => {
    return { tools: toolDefinitions };
  });

  ipcMain.handle("claw-providers-list", async () => {
    return {
      providers: [
        { id: "browser", name: "Browser (Grok)", description: "Routes through Grok webview — zero API cost", requiresKey: false },
        { id: "xai", name: "xAI (Grok API)", description: "Direct xAI/Grok API with tool calling", requiresKey: true },
        { id: "ollama", name: "Ollama (Local)", description: "Full agent mode with local Ollama models", requiresKey: false },
        { id: "openai", name: "OpenAI", description: "GPT-4.1 and other OpenAI models", requiresKey: true },
        { id: "groq", name: "Groq", description: "Fast inference via Groq", requiresKey: true },
        { id: "copilot", name: "GitHub Copilot", description: "GitHub Models/Copilot API", requiresKey: true },
        { id: "zai", name: "Z.AI", description: "Z.AI GLM models", requiresKey: true },
      ],
    };
  });

  ipcMain.handle("claw-agent-test", async (_event, config) => {
    try {
      const { provider = "ollama", model, apiKey, ollamaBaseUrl } = config || {};
      const compat = require("./anthropic-compat");

      if (provider === "ollama") {
        const baseUrl = ollamaBaseUrl || "http://127.0.0.1:11434";
        const testModel = model || "qwen2.5:32b-instruct-q5_K_M";
        const messages = [
          { role: "system", content: "You are a helpful assistant. Reply briefly." },
          { role: "user", content: "Say hello in one sentence." },
        ];
        const json = await compat.callOllama(baseUrl, testModel, messages, [], undefined, {});
        const blocks = compat.ollamaResponseToAnthropic(json);
        const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
        return { success: true, provider, model: testModel, response: text };
      }

      const endpoint = compat.PROVIDER_ENDPOINTS[provider];
      if (!endpoint) return { success: false, error: `Unknown provider: ${provider}` };
      if (!apiKey) return { success: false, error: "apiKey is required for this provider" };

      const testModel = model || compat.PROVIDER_DEFAULTS[provider] || "gpt-4.1-mini";
      const messages = [
        { role: "system", content: "You are a helpful assistant. Reply briefly." },
        { role: "user", content: "Say hello in one sentence." },
      ];
      const json = await compat.callOpenAICompatible(endpoint, apiKey, testModel, messages, [], null, {});
      const blocks = compat.openAIResponseToAnthropic(json);
      const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      return { success: true, provider, model: testModel, response: text };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  console.log(`${LOG} Claw-Dev agent IPC handlers registered (browser wiring: ${resolveWc === findGrokWebviewContents ? 'auto-detect' : 'custom'})`);
}

module.exports = { registerClawIpcHandlers };
