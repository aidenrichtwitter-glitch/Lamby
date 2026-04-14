// AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
// Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
// Read docs/no-reply-system.md for the no-reply protocol.
const crypto = require("crypto");
const { toolDefinitions, toolHandlers } = require("./claw-tools");
const compat = require("./anthropic-compat");

const LOG = "[ClawAgent]";
const MAX_ITERATIONS = 20;

const SYSTEM_PROMPT = `You are Lamby, an autonomous AI assistant with FULL control of a Windows desktop (3840x2160, DPI 240, scale 2.5x), Chrome browser, and local project files.
You execute tasks step by step until they are COMPLETE. You never give up — if something fails, you try a different approach.

=== CALIBRATED CLICK SYSTEM (VERIFIED 135/135, 100% ACCURACY) ===

FORMULA (CSS to Physical coordinates):
  physicalX = CSS_X * 2.5
  physicalY = CSS_Y * 2.5 + 150   (150px Chrome UI offset for tabs + address bar)

SCREEN CONSTANTS:
  Physical: 3840x2160, DPI 240, scale 2.5x
  CSS viewport: 1536x760
  Chrome UI offset: +150 physical pixels in Y

CLICK CHAINING (fastest method — chain multiple clicks in one call):
  hw.exe click X1 Y1 && hw.exe click X2 Y2 && hw.exe click X3 Y3
  All execute in one grok-run call. No delay needed. 49 clicks in ~3 seconds.

=== YOUR TOOLS ===

FILE TOOLS: list_files, read_file, write_file, search_text, run_shell
DESKTOP TOOLS: list_windows, focus_window, screenshot_window, click_at, send_keys, paste_text, get_window_info
BROWSER TOOLS: open_browser, cdp_snapshot, cdp_click, cdp_type, cdp_navigate, cdp_eval, cdp_tabs
GIT TOOLS: git_status, git_diff, git_commit
UTILITY: wait

=== CRYSTALLIZATION SYSTEM (persist working knowledge) ===

After EVERY session that produces working knowledge, CRYSTALLIZE it:
  POST /api/grok-memory?action=crystallize  (body: {name, domain, steps, metadata})
  GET  /api/grok-memory?action=skills       (list all crystals)
  GET  /api/grok-memory?action=recall&query=KEYWORD  (search crystals)
  GET  /api/grok-memory?action=replay&skill=NAME     (replay a crystal)

Crystal tree: control > control:input, control:visual, control:file, control:run, control:search,
  control:calibration:complete, control:blender:*, control:paint:*
Before attempting a novel task, ALWAYS recall existing crystals first.

=== DESKTOP ENDPOINTS ===

SEE THE DESKTOP:
  GET /api/desktop-frame              (JPEG screenshot — your eyes)
  GET /api/desktop-frame?source=cdp   (Chrome tab only)

PUSH FILES TO DESKTOP:
  POST /api/remote-update  (body: {file, content} or {file, contentB64})
  Always use remote-update for file writes. Never use echo/PowerShell for file content.

RUN COMMANDS (unrestricted with __system__):
  GET /api/grok-run?project=__system__&cmd=ANY_COMMAND

=== NO-REPLY PROTOCOL ===

When no-reply mode is active (.local/no-reply-mode.flag = on):
  - ZERO conversational text. No greetings, no explanations, no summaries.
  - Output = tool calls ONLY.
  - Final output = JSON: {"done":true,"actions":[...],"issues":[]}
  - Errors: retry 3x silently, then report structured error.
  - You MUST still follow ALL operational rules — silent execution != skipping the rulebook.

=== CRITICAL RULES ===

1. ALWAYS list_windows before trying to focus any app
2. ALWAYS focus_window before sending keys or pasting
3. ALWAYS use paste_text for text longer than 3 words (never send_keys for long text)
4. For browser pages: use open_browser ONCE, then cdp_click/cdp_type/cdp_eval with selectors from the snapshot
5. NEVER guess CSS selectors — always get them from cdp_snapshot or open_browser response
6. After important actions, use screenshot_window or cdp_snapshot to VERIFY the result
7. If an action fails, wait 1-2 seconds and retry with a different approach
8. Keep tool inputs minimal — don't pass unnecessary parameters
9. ALWAYS chain hw.exe clicks with && for speed. Never send individual click requests when multiple targets are known.
10. After EVERY session producing working knowledge, CRYSTALLIZE it via /api/grok-memory?action=crystallize.
11. Before attempting a novel task, RECALL existing crystals: /api/grok-memory?action=recall&query=KEYWORD.
12. ALWAYS take a desktop-frame after every action to verify what happened. This is your eyes.
13. Use /api/remote-update (POST) for all file writes to the desktop — never echo/PowerShell.

=== DESKTOP APP WORKFLOW ===
To send a message in any desktop app (Telegram, Discord, Notepad, etc.):
1. list_windows -> find the app by title
2. focus_window -> bring it to front
3. paste_text -> paste your message (auto-sends with Enter by default)
4. screenshot_window -> verify it worked

=== BROWSER WORKFLOW ===
To interact with any website:
1. open_browser with the URL -> get page snapshot with all selectors
2. Use cdp_click/cdp_type with selectors FROM the snapshot
3. After clicks that change the page, call cdp_snapshot to get fresh selectors
4. Use cdp_navigate to go to a different page (don't open_browser again)

=== FILE EDITING WORKFLOW ===
1. list_files to see project structure
2. read_file to understand current content
3. write_file with complete new content
4. run_shell to test (e.g. npm run build)

=== BANNED ===
- grok-3-mini model (always use grok-4)
- EEVEE background renders (causes crash)
- CompositorNodeGlare (causes crash)

Always produce complete, functional results — never use placeholders or TODOs.
Be patient. Take your time. Verify each step before moving to the next.`;

class ClawAgentBridge {
  constructor(opts) {
    this.cwd = opts.cwd;
    this.provider = opts.provider || "browser";
    this.model = opts.model || compat.PROVIDER_DEFAULTS[opts.provider] || "grok-4";
    this.apiKey = opts.apiKey || "";
    this.ollamaBaseUrl = opts.ollamaBaseUrl || "http://127.0.0.1:11434";
    this.ollamaConfig = opts.ollamaConfig || {};
    this.maxIterations = opts.maxIterations || MAX_ITERATIONS;
    this.systemPrompt = opts.systemPrompt || SYSTEM_PROMPT;
    this.messages = [];
    this.onProgress = opts.onProgress || (() => {});
    this.onToolCall = opts.onToolCall || (() => {});
    this.browserSendPrompt = opts.browserSendPrompt || null;
    this.browserGetResponse = opts.browserGetResponse || null;
    this.aborted = false;
    this._sessionId = crypto.randomUUID();
  }

  abort() {
    this.aborted = true;
  }

  clear() {
    this.messages = [];
    this.aborted = false;
    this._sessionId = crypto.randomUUID();
  }

  async runTask(userPrompt) {
    this.aborted = false;
    const startTime = Date.now();
    this._emit("start", { prompt: userPrompt, sessionId: this._sessionId });

    this.messages.push({ role: "user", content: userPrompt });

    let finalText = "";
    let totalToolCalls = 0;

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      if (this.aborted) {
        this._emit("aborted", { iteration });
        return { text: finalText || "Task aborted.", toolCalls: totalToolCalls, aborted: true };
      }

      this._emit("iteration", { iteration, total: this.maxIterations });

      let response;
      try {
        if (this.provider === "browser") {
          response = await this._callBrowser();
        } else if (this.provider === "ollama") {
          response = await this._callOllama();
        } else {
          response = await this._callDirectAPI();
        }
      } catch (err) {
        console.error(`${LOG} LLM call failed on iteration ${iteration}:`, err.message);
        this._emit("error", { iteration, error: err.message });
        return { text: finalText || `Error: ${err.message}`, toolCalls: totalToolCalls, error: err.message };
      }

      const textBlocks = response.filter((b) => b.type === "text");
      if (textBlocks.length > 0) {
        finalText = textBlocks.map((b) => b.text).join("\n");
        this._emit("text", { text: finalText, iteration });
      }

      this.messages.push({ role: "assistant", content: response });

      const toolUses = response.filter((b) => b.type === "tool_use");
      if (toolUses.length === 0) {
        this._emit("complete", {
          text: finalText,
          toolCalls: totalToolCalls,
          iterations: iteration + 1,
          durationMs: Date.now() - startTime,
        });
        return { text: finalText, toolCalls: totalToolCalls };
      }

      const toolResults = [];
      for (const toolUse of toolUses) {
        totalToolCalls++;
        const handler = toolHandlers[toolUse.name];
        this._emit("tool_call", { name: toolUse.name, input: toolUse.input, id: toolUse.id });
        this.onToolCall(toolUse.name, toolUse.input);

        if (!handler) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            is_error: true,
            content: `Unknown tool: ${toolUse.name}`,
          });
          continue;
        }

        try {
          const result = await handler(toolUse.input || {}, this.cwd);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result.content,
            ...(result.isError ? { is_error: true } : {}),
          });
          this._emit("tool_result", { name: toolUse.name, id: toolUse.id, contentLength: result.content.length });
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            is_error: true,
            content: err.message,
          });
          this._emit("tool_error", { name: toolUse.name, id: toolUse.id, error: err.message });
        }
      }

      this.messages.push({ role: "user", content: toolResults });
    }

    this._emit("max_iterations", { text: finalText, toolCalls: totalToolCalls });
    return { text: finalText || "Stopped after reaching the iteration limit.", toolCalls: totalToolCalls };
  }

  async _callDirectAPI() {
    const provider = this.provider;
    const endpoint = compat.PROVIDER_ENDPOINTS[provider];
    if (!endpoint) throw new Error(`No endpoint configured for provider: ${provider}`);

    const toolNameById = new Map();
    const openAIMessages = compat.anthropicMessagesToOpenAI(
      this.messages,
      toolNameById,
      this.systemPrompt,
      { includeToolName: false }
    );
    const openAITools = compat.anthropicToolsToOpenAI(toolDefinitions);

    const extraHeaders = {};
    if (provider === "copilot") {
      extraHeaders["X-GitHub-Api-Version"] = "2022-11-28";
    }

    const json = await compat.callOpenAICompatible(
      endpoint, this.apiKey, this.model, openAIMessages, openAITools, null, extraHeaders
    );
    return compat.openAIResponseToAnthropic(json);
  }

  async _callOllama() {
    const toolNameById = new Map();
    const openAIMessages = compat.anthropicMessagesToOpenAI(
      this.messages,
      toolNameById,
      this.systemPrompt,
      { includeToolName: true, argsAsObject: true }
    );
    const openAITools = compat.anthropicToolsToOpenAI(toolDefinitions);

    const json = await compat.callOllama(
      this.ollamaBaseUrl, this.model, openAIMessages, openAITools,
      this.apiKey || undefined, this.ollamaConfig
    );
    return compat.ollamaResponseToAnthropic(json);
  }

  async _callBrowser() {
    if (!this.browserSendPrompt || !this.browserGetResponse) {
      throw new Error("Browser mode requires browserSendPrompt and browserGetResponse callbacks");
    }

    const prompt = this._buildBrowserPrompt();

    const sendResult = await this.browserSendPrompt(prompt);
    if (!sendResult || !sendResult.success) {
      throw new Error(`Failed to send prompt to browser: ${sendResult ? sendResult.error : "no result"}`);
    }

    const response = await this.browserGetResponse();
    if (!response || !response.success) {
      throw new Error(`Failed to get response from browser: ${response ? response.error : "no result"}`);
    }

    return this._parseBrowserResponse(response.text);
  }

  _buildBrowserPrompt() {
    const lastMsg = this.messages[this.messages.length - 1];

    if (lastMsg.role === "user" && typeof lastMsg.content === "string") {
      const toolsDesc = toolDefinitions
        .map((t) => `- ${t.name}: ${t.description}`)
        .join("\n");

      return `${this.systemPrompt}

Available tools (respond with JSON tool calls in a \`\`\`json code block to use them):
${toolsDesc}

To call a tool, include a JSON block like:
\`\`\`json
{"tool_calls": [{"name": "tool_name", "input": {"param": "value"}}]}
\`\`\`

When you're done (no more tool calls needed), just respond with your final message.

User request: ${lastMsg.content}`;
    }

    if (lastMsg.role === "user" && Array.isArray(lastMsg.content)) {
      const parts = lastMsg.content.map((tr) => {
        if (tr.type === "tool_result") {
          return `Tool result for ${tr.tool_use_id}${tr.is_error ? " (ERROR)" : ""}:\n${tr.content}`;
        }
        return "";
      }).filter(Boolean);

      return `Tool results:\n\n${parts.join("\n\n")}\n\nContinue with the task. Use more tool calls if needed, or provide your final response.`;
    }

    return typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content);
  }

  _parseBrowserResponse(text) {
    const blocks = [];
    const jsonBlockRegex = /```json\s*\n?([\s\S]*?)```/g;
    let match;
    let foundToolCalls = false;

    const validToolNames = new Set(toolDefinitions.map((t) => t.name));

    while ((match = jsonBlockRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
          for (const tc of parsed.tool_calls) {
            if (typeof tc.name !== "string" || !validToolNames.has(tc.name)) continue;
            const input = typeof tc.input === "object" && tc.input !== null && !Array.isArray(tc.input) ? tc.input : {};
            blocks.push({
              type: "tool_use",
              id: `toolu_${crypto.randomUUID()}`,
              name: tc.name,
              input,
            });
            foundToolCalls = true;
          }
        } else if (typeof parsed.name === "string" && validToolNames.has(parsed.name)) {
          const input = typeof parsed.input === "object" && parsed.input !== null && !Array.isArray(parsed.input) ? parsed.input : {};
          blocks.push({
            type: "tool_use",
            id: `toolu_${crypto.randomUUID()}`,
            name: parsed.name,
            input,
          });
          foundToolCalls = true;
        }
      } catch (_) {}
    }

    const cleanText = text.replace(/```json\s*\n?[\s\S]*?```/g, "").trim();
    if (cleanText) {
      blocks.unshift({ type: "text", text: cleanText, citations: null });
    }

    if (blocks.length === 0) {
      blocks.push({ type: "text", text: text || "", citations: null });
    }

    return blocks;
  }

  _emit(event, data) {
    try {
      this.onProgress(event, { ...data, sessionId: this._sessionId, provider: this.provider });
    } catch (_) {}
  }
}

function createAgent(opts) {
  return new ClawAgentBridge(opts);
}

async function runSingleTask(opts) {
  const agent = createAgent(opts);
  return agent.runTask(opts.prompt);
}

module.exports = { ClawAgentBridge, createAgent, runSingleTask, SYSTEM_PROMPT };
