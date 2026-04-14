// AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
// Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
// Read docs/no-reply-system.md for the no-reply protocol.
const { toolDefinitions } = require("./claw-tools");

const PROVIDER_PROMPTS = {
  grok: {
    wrapper: "structured",
    supportsToolCalls: false,
    jsonInstructions: true,
  },
  xai: {
    wrapper: "direct",
    supportsToolCalls: true,
    jsonInstructions: false,
  },
  ollama: {
    wrapper: "direct",
    supportsToolCalls: true,
    jsonInstructions: false,
  },
  openai: {
    wrapper: "direct",
    supportsToolCalls: true,
    jsonInstructions: false,
  },
  groq: {
    wrapper: "direct",
    supportsToolCalls: true,
    jsonInstructions: false,
  },
  copilot: {
    wrapper: "direct",
    supportsToolCalls: true,
    jsonInstructions: false,
  },
  zai: {
    wrapper: "direct",
    supportsToolCalls: true,
    jsonInstructions: false,
  },
};

function formatSystemPrompt(basePrompt, provider, projectContext) {
  const config = PROVIDER_PROMPTS[provider] || PROVIDER_PROMPTS.openai;
  let prompt = basePrompt;

  if (projectContext) {
    prompt += `\n\nProject context:\n- Project name: ${projectContext.name || "unknown"}`;
    if (projectContext.structure) {
      prompt += `\n- Structure:\n${projectContext.structure}`;
    }
    if (projectContext.framework) {
      prompt += `\n- Framework: ${projectContext.framework}`;
    }
  }

  if (config.jsonInstructions) {
    const toolsDesc = toolDefinitions
      .map((t) => {
        const params = t.input_schema.properties
          ? Object.entries(t.input_schema.properties)
              .map(([k, v]) => `${k}: ${v.description || v.type}`)
              .join(", ")
          : "";
        return `  - ${t.name}(${params}): ${t.description}`;
      })
      .join("\n");

    prompt += `\n\nAvailable tools:\n${toolsDesc}\n\nTo call tools, include a JSON block:\n\`\`\`json\n{"tool_calls": [{"name": "tool_name", "input": {"param": "value"}}]}\n\`\`\`\n\nYou can call multiple tools in one response. When done, respond normally without tool calls.`;
  }

  return prompt;
}

function formatUserPrompt(userRequest, provider) {
  const config = PROVIDER_PROMPTS[provider] || PROVIDER_PROMPTS.openai;

  if (config.wrapper === "structured") {
    return `Build the following:\n\n${userRequest}\n\nStart by exploring the workspace, then plan and implement. Use tool calls to build the complete application.`;
  }

  return userRequest;
}

function formatToolResults(toolResults, provider) {
  const config = PROVIDER_PROMPTS[provider] || PROVIDER_PROMPTS.openai;

  if (config.wrapper === "structured") {
    const parts = toolResults.map((tr) => {
      const status = tr.is_error ? "ERROR" : "OK";
      return `[${status}] ${tr.tool_use_id || "unknown"}:\n${tr.content}`;
    });
    return `Tool results:\n\n${parts.join("\n\n")}\n\nContinue building. Use more tools if needed, or provide your final summary.`;
  }

  return toolResults;
}

module.exports = {
  formatSystemPrompt,
  formatUserPrompt,
  formatToolResults,
  PROVIDER_PROMPTS,
};
