// AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
// Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
// Read docs/no-reply-system.md for the no-reply protocol.
const crypto = require("crypto");

const LOG = "[AnthropicCompat]";

function normalizeSystemPrompt(system) {
  if (typeof system === "string") return system;
  if (!Array.isArray(system)) return "";
  return system
    .map((block) => (typeof block.text === "string" ? block.text : ""))
    .filter((t) => t.length > 0)
    .join("\n\n");
}

function normalizeAnthropicContent(content) {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return Array.isArray(content) ? content : [];
}

function extractToolResultText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
      .filter((t) => t.length > 0)
      .join("\n");
  }
  if (isRecord(content)) return JSON.stringify(content);
  return "";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function anthropicMessagesToOpenAI(messages, toolNameById, systemInstruction, opts) {
  const result = [];
  if (systemInstruction) {
    result.push({ role: "system", content: systemInstruction });
  }
  for (const message of messages || []) {
    const parts = normalizeAnthropicContent(message.content);
    const textParts = [];
    const toolMessages = [];
    const toolCalls = [];
    for (const part of parts) {
      const type = typeof part.type === "string" ? part.type : "";
      if (type === "text" && typeof part.text === "string") {
        textParts.push(part.text);
        continue;
      }
      if (type === "tool_use") {
        const id = typeof part.id === "string" ? part.id : `toolu_${crypto.randomUUID()}`;
        const name = typeof part.name === "string" ? part.name : "tool";
        const input = isRecord(part.input) ? part.input : {};
        toolNameById.set(id, name);
        toolCalls.push({
          id,
          type: "function",
          function: { name, arguments: opts && opts.argsAsObject ? input : JSON.stringify(input) },
        });
        continue;
      }
      if (type === "tool_result") {
        const toolUseId = typeof part.tool_use_id === "string" ? part.tool_use_id : `toolu_${crypto.randomUUID()}`;
        const toolName = toolNameById.get(toolUseId) || "tool";
        toolMessages.push({
          role: "tool",
          tool_call_id: toolUseId,
          ...(opts && opts.includeToolName ? { tool_name: toolName } : {}),
          content: extractToolResultText(part.content),
        });
      }
    }
    if (message.role === "assistant") {
      if (textParts.length > 0 || toolCalls.length > 0) {
        result.push({
          role: "assistant",
          content: textParts.join("\n") || "",
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        });
      }
      continue;
    }
    if (textParts.length > 0) {
      result.push({ role: "user", content: textParts.join("\n") });
    }
    result.push(...toolMessages);
  }
  return result;
}

function anthropicToolsToOpenAI(tools) {
  return (tools || [])
    .map((tool) => {
      const name = typeof tool.name === "string" ? tool.name : null;
      if (!name) return null;
      return {
        type: "function",
        function: {
          name,
          description: typeof tool.description === "string" ? tool.description : "",
          parameters: isRecord(tool.input_schema) ? tool.input_schema : { type: "object", properties: {} },
        },
      };
    })
    .filter(Boolean);
}

function openAIResponseToAnthropic(json) {
  const choices = Array.isArray(json.choices) ? json.choices : [];
  const first = choices[0];
  if (!first || !isRecord(first) || !isRecord(first.message)) {
    return [{ type: "text", text: "", citations: null }];
  }
  const message = first.message;
  const blocks = [];
  if (typeof message.content === "string" && message.content.length > 0) {
    blocks.push({ type: "text", text: message.content, citations: null });
  }
  const rawToolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  for (const rawToolCall of rawToolCalls) {
    if (!isRecord(rawToolCall)) continue;
    const id = typeof rawToolCall.id === "string" ? rawToolCall.id : `toolu_${crypto.randomUUID()}`;
    const fn = isRecord(rawToolCall.function) ? rawToolCall.function : {};
    const name = typeof fn.name === "string" ? fn.name : "tool";
    let input = {};
    if (typeof fn.arguments === "string" && fn.arguments.trim().length > 0) {
      try { input = JSON.parse(fn.arguments); if (!isRecord(input)) input = {}; } catch { input = {}; }
    }
    blocks.push({ type: "tool_use", id, name, input });
  }
  return blocks.length > 0 ? blocks : [{ type: "text", text: "", citations: null }];
}

function ollamaResponseToAnthropic(json) {
  const message = isRecord(json.message) ? json.message : json;
  const blocks = [];
  if (typeof message.content === "string" && message.content.length > 0) {
    blocks.push({ type: "text", text: message.content, citations: null });
  }
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  for (const rawCall of toolCalls) {
    if (!isRecord(rawCall) || !isRecord(rawCall.function)) continue;
    const name = typeof rawCall.function.name === "string" ? rawCall.function.name : "tool";
    const input = isRecord(rawCall.function.arguments) ? rawCall.function.arguments : {};
    blocks.push({ type: "tool_use", id: `toolu_${crypto.randomUUID()}`, name, input });
  }
  return blocks.length > 0 ? blocks : [{ type: "text", text: "", citations: null }];
}

function buildAnthropicResponse(content, model) {
  return {
    id: `msg_${crypto.randomUUID()}`,
    type: "message",
    role: "assistant",
    model: model || "unknown",
    content,
    stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 0,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      output_tokens: 0,
      server_tool_use: null,
    },
  };
}

function buildOpenAIToolChoice(toolChoice) {
  if (!toolChoice || toolChoice.type === "auto") return "auto";
  if (toolChoice.type === "none") return "none";
  if (toolChoice.type === "tool" && toolChoice.name) {
    return { type: "function", function: { name: toolChoice.name } };
  }
  return "required";
}

async function callOpenAICompatible(endpoint, apiKey, model, messages, tools, toolChoice, extraHeaders) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(extraHeaders || {}),
    },
    body: JSON.stringify({
      model,
      messages,
      ...(tools && tools.length > 0 ? { tools } : {}),
      ...(tools && tools.length > 0 ? { tool_choice: buildOpenAIToolChoice(toolChoice) } : {}),
      stream: false,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${endpoint} returned ${response.status}: ${errText}`);
  }
  return response.json();
}

async function callOllama(baseUrl, model, messages, tools, apiKey, runtimeConfig) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      ...(tools && tools.length > 0 ? { tools } : {}),
      ...(runtimeConfig || {}),
      stream: false,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama returned ${response.status}: ${errText}`);
  }
  return response.json();
}

const PROVIDER_ENDPOINTS = {
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  copilot: "https://models.github.ai/inference/chat/completions",
  zai: "https://api.z.ai/api/paas/v4/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
};

const PROVIDER_DEFAULTS = {
  openai: "gpt-4.1-mini",
  groq: "openai/gpt-oss-20b",
  copilot: "openai/gpt-4.1-mini",
  zai: "glm-5",
  xai: "grok-4",
  ollama: "qwen2.5:32b-instruct-q5_K_M",
};

module.exports = {
  normalizeSystemPrompt,
  normalizeAnthropicContent,
  extractToolResultText,
  isRecord,
  anthropicMessagesToOpenAI,
  anthropicToolsToOpenAI,
  openAIResponseToAnthropic,
  ollamaResponseToAnthropic,
  buildAnthropicResponse,
  buildOpenAIToolChoice,
  callOpenAICompatible,
  callOllama,
  PROVIDER_ENDPOINTS,
  PROVIDER_DEFAULTS,
  LOG,
};
