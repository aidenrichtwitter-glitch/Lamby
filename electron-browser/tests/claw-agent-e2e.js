// AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
// Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
// Read docs/no-reply-system.md for the no-reply protocol.
const path = require("path");
const fs = require("fs");
const os = require("os");

const { ClawAgentBridge, createAgent } = require("../src/claw-agent-bridge");
const { toolDefinitions, toolHandlers } = require("../src/claw-tools");
const compat = require("../src/anthropic-compat");

const XAI_API_KEY = process.env.XAI_API || process.env.XAI_API_KEY || "";
const TEST_DIR = path.join(os.tmpdir(), `claw-test-${Date.now()}`);

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function testToolDefinitions() {
  console.log("\n=== Test: Tool Definitions ===");
  assert(toolDefinitions.length === 5, "Has 5 tool definitions");
  assert(toolDefinitions.map(t => t.name).includes("list_files"), "Has list_files");
  assert(toolDefinitions.map(t => t.name).includes("write_file"), "Has write_file");
  assert(toolDefinitions.map(t => t.name).includes("read_file"), "Has read_file");
  assert(toolDefinitions.map(t => t.name).includes("search_text"), "Has search_text");
  assert(toolDefinitions.map(t => t.name).includes("run_shell"), "Has run_shell");
}

async function testToolExecution() {
  console.log("\n=== Test: Tool Execution ===");
  fs.mkdirSync(TEST_DIR, { recursive: true });

  const writeResult = await toolHandlers.write_file(
    { path: "hello.txt", content: "Hello from Lamby!" },
    TEST_DIR
  );
  assert(writeResult.content.includes("Wrote hello.txt"), "write_file works");

  const readResult = await toolHandlers.read_file({ path: "hello.txt" }, TEST_DIR);
  assert(readResult.content === "Hello from Lamby!", "read_file works");

  const listResult = await toolHandlers.list_files({}, TEST_DIR);
  assert(listResult.content.includes("hello.txt"), "list_files works");

  const searchResult = await toolHandlers.search_text({ query: "Lamby" }, TEST_DIR);
  assert(searchResult.content.includes("Lamby") || searchResult.content.includes("hello.txt"), "search_text works");

  const shellResult = await toolHandlers.run_shell({ command: "echo test123" }, TEST_DIR);
  assert(shellResult.content.includes("test123"), "run_shell works");
}

async function testAnthropicCompat() {
  console.log("\n=== Test: Anthropic Format Conversion ===");

  const toolNameById = new Map();
  const messages = [
    { role: "user", content: "Hello" },
    {
      role: "assistant",
      content: [
        { type: "text", text: "Let me check." },
        { type: "tool_use", id: "toolu_123", name: "list_files", input: { path: "." } },
      ],
    },
    {
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "toolu_123", content: "file hello.txt" },
      ],
    },
  ];

  const openAIMessages = compat.anthropicMessagesToOpenAI(messages, toolNameById, "You are helpful.", {});
  assert(openAIMessages.length >= 3, "Converts messages (at least system + user + assistant)");
  assert(openAIMessages[0].role === "system", "First message is system");
  assert(openAIMessages[1].role === "user", "Has user message");

  const openAITools = compat.anthropicToolsToOpenAI(toolDefinitions);
  assert(openAITools.length === 5, "Converts all 5 tools to OpenAI format");
  assert(openAITools[0].type === "function", "Tools have function type");
  assert(typeof openAITools[0].function.name === "string", "Tools have names");

  const mockOpenAIResponse = {
    choices: [{
      message: {
        content: "Here's the result.",
        tool_calls: [{
          id: "call_abc",
          type: "function",
          function: { name: "read_file", arguments: '{"path":"test.txt"}' },
        }],
      },
    }],
  };
  const anthropicBlocks = compat.openAIResponseToAnthropic(mockOpenAIResponse);
  assert(anthropicBlocks.some(b => b.type === "text"), "Has text block");
  assert(anthropicBlocks.some(b => b.type === "tool_use"), "Has tool_use block");
  const toolBlock = anthropicBlocks.find(b => b.type === "tool_use");
  assert(toolBlock.name === "read_file", "Tool call name is correct");
  assert(toolBlock.input.path === "test.txt", "Tool call input is parsed");
}

async function testAgentCreation() {
  console.log("\n=== Test: Agent Creation ===");
  const agent = createAgent({ cwd: TEST_DIR, provider: "xai", model: "grok-3-mini", apiKey: "test" });
  assert(agent instanceof ClawAgentBridge, "Creates ClawAgentBridge instance");
  assert(agent.provider === "xai", "Has correct provider");
  assert(agent.model === "grok-3-mini", "Has correct model");
  assert(agent.cwd === TEST_DIR, "Has correct cwd");
  assert(agent.messages.length === 0, "Starts with empty messages");

  agent.clear();
  assert(agent.messages.length === 0, "Clear resets messages");
}

async function testXAIDirectAPI() {
  console.log("\n=== Test: XAI Direct API (E2E) ===");
  if (!XAI_API_KEY) {
    console.log("  ⊘ Skipped (no XAI_API / XAI_API_KEY env var)");
    return;
  }

  const progressEvents = [];
  const agent = createAgent({
    cwd: TEST_DIR,
    provider: "xai",
    model: "grok-3-mini",
    apiKey: XAI_API_KEY,
    maxIterations: 3,
    onProgress: (event, data) => {
      progressEvents.push(event);
    },
  });

  const result = await agent.runTask("List the files in the current directory, then read hello.txt and tell me what it says.");
  console.log(`  Agent response (${result.toolCalls} tool calls): ${(result.text || "").slice(0, 200)}`);

  assert(!result.error, "No error");
  assert(typeof result.text === "string" && result.text.length > 0, "Got text response");
  assert(result.toolCalls > 0, `Made tool calls (${result.toolCalls})`);
  assert(progressEvents.includes("start"), "Emitted start event");
  assert(progressEvents.includes("tool_call"), "Emitted tool_call event");
  assert(progressEvents.includes("complete") || progressEvents.includes("max_iterations"), "Emitted completion event");
}

async function testXAIWriteFile() {
  console.log("\n=== Test: XAI Agent Writes File (E2E) ===");
  if (!XAI_API_KEY) {
    console.log("  ⊘ Skipped (no XAI_API / XAI_API_KEY env var)");
    return;
  }

  const agent = createAgent({
    cwd: TEST_DIR,
    provider: "xai",
    model: "grok-3-mini",
    apiKey: XAI_API_KEY,
    maxIterations: 4,
  });

  const result = await agent.runTask(
    "Create a file called 'lamby-test.html' with a simple HTML page that says 'Built by Lamby'. Just create the file, nothing else."
  );
  console.log(`  Agent response (${result.toolCalls} tool calls): ${(result.text || "").slice(0, 200)}`);

  assert(!result.error, "No error");
  assert(result.toolCalls > 0, `Made tool calls (${result.toolCalls})`);

  const filePath = path.join(TEST_DIR, "lamby-test.html");
  const fileExists = fs.existsSync(filePath);
  assert(fileExists, "Created lamby-test.html");
  if (fileExists) {
    const content = fs.readFileSync(filePath, "utf8");
    assert(content.includes("Lamby") || content.includes("lamby"), "File contains Lamby reference");
    assert(content.includes("<") && content.includes(">"), "File contains HTML tags");
  }
}

async function cleanup() {
  try {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  } catch (_) {}
}

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Claw-Dev Agent Bridge E2E Test Suite    ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`Test directory: ${TEST_DIR}`);
  console.log(`XAI API key: ${XAI_API_KEY ? "present" : "NOT SET"}`);

  await testToolDefinitions();
  await testToolExecution();
  await testAnthropicCompat();
  await testAgentCreation();
  await testXAIDirectAPI();
  await testXAIWriteFile();
  await cleanup();

  console.log(`\n${"=".repeat(42)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(42)}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test suite crashed:", err);
  cleanup();
  process.exit(1);
});
