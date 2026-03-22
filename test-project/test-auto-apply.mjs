import { readFileSync } from 'fs';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import https from 'https';
import path from 'path';

const XAI_API_KEY = process.env.XAI_API;
if (!XAI_API_KEY) { console.error("XAI_API not set"); process.exit(1); }

// ── Step 1: Call Grok API with a prompt asking it to create files ──
const PROMPT = `You are modifying a React project. Create the following two files:

1. src/components/Navigation.tsx — A navigation bar component with links to Dashboard, Metrics, and Settings. Use inline styles. Export default.

2. src/pages/Metrics.tsx — A metrics dashboard page showing 3 metric cards (Total Users: 1,234, Revenue: $5,678, Active Sessions: 89). Use useState for a refresh button. Use inline styles. Export default.

3. Update src/App.tsx to import and render both Navigation and Metrics.

Output each file as a fenced code block with the file path. For example:

\`\`\`tsx
// src/components/Navigation.tsx
...code...
\`\`\`

Do NOT use any external dependencies beyond react. Keep each file under 50 lines.`;

console.log("=== Step 1: Calling Grok API ===");

function callGrok(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "grok-4",
      messages: [
        { role: "system", content: "You are a React developer. Output complete file contents in fenced code blocks with file paths as comments on the first line." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    const req = https.request({
      hostname: "api.x.ai",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_API_KEY}`
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
            return;
          }
          resolve(parsed.choices[0].message.content);
        } catch (e) {
          reject(new Error(`Parse error: ${data.slice(0, 500)}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

try {
  const response = await callGrok(PROMPT);
  console.log(`\nGrok response length: ${response.length} chars`);
  console.log("\n--- RAW RESPONSE (first 500 chars) ---");
  console.log(response.slice(0, 500));
  console.log("\n--- END PREVIEW ---\n");

  // Save full response for inspection
  writeFileSync("test-project/grok-response.txt", response);
  console.log("Full response saved to test-project/grok-response.txt");

  // ── Step 2: Parse with a simplified code block extractor ──
  // (We can't import the TS parser directly, so we replicate the core logic)
  console.log("\n=== Step 2: Parsing code blocks ===");

  const blocks = [];
  const fencedRegex = /```(\w*)\n([\s\S]*?)```/g;
  let match;

  while ((match = fencedRegex.exec(response)) !== null) {
    const lang = match[1] || "unknown";
    const code = match[2];

    // Extract file path from first line comment
    let filePath = null;
    const firstLine = code.split("\n")[0].trim();

    // Try // file: path or // path patterns
    const pathPatterns = [
      /^\/\/\s*(?:file:\s*)?(\S+\.\w+)$/,
      /^\/\*\s*(?:file:\s*)?(\S+\.\w+)\s*\*\/$/,
      /^\/\/\s*(\S+\/\S+\.\w+)/,
    ];

    for (const p of pathPatterns) {
      const m = firstLine.match(p);
      if (m) { filePath = m[1]; break; }
    }

    // Also check preceding text for file path
    if (!filePath) {
      const before = response.slice(Math.max(0, match.index - 200), match.index);
      const beforeMatch = before.match(/`([^`]+\.(tsx|ts|jsx|js|css|html))`\s*$/);
      if (beforeMatch) filePath = beforeMatch[1];
      const headerMatch = before.match(/(?:###?\s*\d*\.?\s*)?[`*]*(\S+\.\w{2,4})[`*]*\s*(?:[—–:-].*)?$/m);
      if (!filePath && headerMatch) filePath = headerMatch[1];
    }

    blocks.push({ filePath, language: lang, code, chars: code.length });
  }

  console.log(`Found ${blocks.length} code blocks:\n`);
  for (const b of blocks) {
    console.log(`  ${b.filePath || "NO PATH DETECTED"} (${b.language}, ${b.chars} chars)`);
    if (b.filePath) {
      console.log(`    First line: ${b.code.split("\\n")[0]?.slice(0, 80)}`);
    }
  }

  // ── Step 3: Write files to test-project ──
  console.log("\n=== Step 3: Writing files ===");
  const validBlocks = blocks.filter(b => b.filePath);
  for (const b of validBlocks) {
    const fullPath = path.join("test-project", b.filePath);
    const dir = path.dirname(fullPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // Strip the file path comment from the first line if present
    let code = b.code;
    const firstLine = code.split("\n")[0].trim();
    if (firstLine.startsWith("//") && firstLine.includes(b.filePath)) {
      code = code.split("\n").slice(1).join("\n");
    }

    writeFileSync(fullPath, code);
    console.log(`  WRITTEN: ${fullPath} (${code.length} chars)`);
  }

  // ── Step 4: Verify files exist ──
  console.log("\n=== Step 4: Verification ===");
  for (const b of validBlocks) {
    const fullPath = path.join("test-project", b.filePath);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, "utf8");
      const hasExport = content.includes("export default") || content.includes("export {");
      console.log(`  PASS: ${b.filePath} — ${content.length} chars, hasExport=${hasExport}`);
    } else {
      console.log(`  FAIL: ${b.filePath} — file not found`);
    }
  }

  console.log("\n=== DONE ===");

} catch (err) {
  console.error("Error:", err.message);
}
