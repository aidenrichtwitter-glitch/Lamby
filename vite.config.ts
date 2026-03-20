import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { VitePWA } from "vite-plugin-pwa";

process.on("uncaughtException", (err) => {
  console.error(`[Lamby] Uncaught exception (non-fatal): ${err.message}`);
  if (err.stack) console.error(err.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error(`[Lamby] Unhandled rejection (non-fatal): ${reason}`);
});

function detectPmForDir(projDir: string): string {
  if (fs.existsSync(path.join(projDir, "bun.lockb")) || fs.existsSync(path.join(projDir, "bun.lock"))) return "bun";
  if (fs.existsSync(path.join(projDir, "pnpm-lock.yaml")) || fs.existsSync(path.join(projDir, "pnpm-workspace.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projDir, "yarn.lock"))) return "yarn";
  return "npm";
}

function buildPmCommand(pm: string, action: string, args = ""): string {
  const a = args ? ` ${args}` : "";
  switch (action) {
    case "install":
      if (pm === "bun") return `npx bun install${a}`;
      if (pm === "pnpm") return `npx pnpm install --no-frozen-lockfile${a}`;
      if (pm === "yarn") return `npx yarn install --ignore-engines${a}`;
      return `npm install --legacy-peer-deps${a}`;
    case "install-ignore-scripts":
      if (pm === "bun") return `npx bun install${a}`;
      if (pm === "pnpm") return `npx pnpm install --no-frozen-lockfile --ignore-scripts${a}`;
      if (pm === "yarn") return `npx yarn install --ignore-engines --ignore-scripts${a}`;
      return `npm install --legacy-peer-deps --ignore-scripts${a}`;
    case "install-force":
      if (pm === "bun") return `npx bun install${a}`;
      if (pm === "pnpm") return `npx pnpm install --no-frozen-lockfile${a}`;
      if (pm === "yarn") return `npx yarn install --ignore-engines${a}`;
      return `npm install --legacy-peer-deps --force${a}`;
    case "install-force-ignore":
      if (pm === "bun") return `npx bun install${a}`;
      if (pm === "pnpm") return `npx pnpm install --no-frozen-lockfile${a}`;
      if (pm === "yarn") return `npx yarn install --ignore-engines${a}`;
      return `npm install --force --ignore-scripts${a}`;
    case "add":
      if (pm === "bun") return `npx bun add${a}`;
      if (pm === "pnpm") return `npx pnpm add${a}`;
      if (pm === "yarn") return `npx yarn add${a}`;
      return `npm install --legacy-peer-deps${a}`;
    case "add-dev":
    case "install-dev":
      if (pm === "bun") return `npx bun add -D${a}`;
      if (pm === "pnpm") return `npx pnpm add -D${a}`;
      if (pm === "yarn") return `npx yarn add -D${a}`;
      return `npm install --save-dev --legacy-peer-deps${a}`;
    case "run":
      return `${pm} run${a}`;
    case "start":
      return `${pm} run start${a}`;
    case "build":
      return `${pm} run build${a}`;
    case "exec":
      if (pm === "bun") return `bunx${a}`;
      if (pm === "pnpm") return `pnpm exec${a}`;
      return `npx${a}`;
    case "cache-clean":
      return "npm cache clean --force";
    case "rebuild":
      return `${pm === "bun" ? "bun" : pm === "pnpm" ? "pnpm" : pm === "yarn" ? "yarn" : "npm"} rebuild`;
    default:
      return `${pm} ${action}${a}`;
  }
}

function buildInstallCascade(pm: string): string[] {
  if (pm === "bun") return ["npx bun install", "npm install --legacy-peer-deps"];
  if (pm === "pnpm") return ["npx pnpm install --no-frozen-lockfile", "npm install --legacy-peer-deps"];
  if (pm === "yarn") return ["npx yarn install --ignore-engines", "npm install --legacy-peer-deps"];
  return [
    "npm install --legacy-peer-deps",
    "npm install --legacy-peer-deps --force",
    "npm install --force --ignore-scripts"
  ];
}

function resolveLocalBin(devCmd: { cmd: string; args: string[] }, projectDir: string): { cmd: string; args: string[] } {
  if (devCmd.cmd === "npx" && devCmd.args.length > 0) {
    const binName = devCmd.args[0];
    const ext = process.platform === "win32" ? ".cmd" : "";
    const localBin = path.join(projectDir, "node_modules", ".bin", binName + ext);
    if (fs.existsSync(localBin)) {
      return { cmd: localBin, args: devCmd.args.slice(1) };
    }
  }
  return devCmd;
}

function patchNextConfig(dir: string): void {
  const candidates = ["next.config.ts", "next.config.mjs", "next.config.js"];
  let configPath: string | null = null;
  for (const c of candidates) {
    const p = path.join(dir, c);
    if (fs.existsSync(p)) { configPath = p; break; }
  }
  if (!configPath) return;

  try {
    let content = fs.readFileSync(configPath, "utf-8");
    let modified = false;

    if (!/allowedDevOrigins/.test(content)) {
      const replitDomain = process.env.REPLIT_DEV_DOMAIN || "";
      const origins = ["localhost", "127.0.0.1", "0.0.0.0"];
      if (replitDomain) origins.push(replitDomain);
      const originsStr = JSON.stringify(origins);
      const snippet = `allowedDevOrigins: ${originsStr},`;
      content = content.replace(
        /const\s+nextConfig[\s:=\w<>{}]*=\s*\{/,
        (match: string) => match + "\n  " + snippet
      );
      if (!/allowedDevOrigins/.test(content)) {
        content = content.replace(
          /export\s+default\s*\{/,
          "export default {\n  " + snippet
        );
      }
      modified = true;
    }

    const parentRefPattern = /["']@[^"']+["']\s*:\s*["']\.\.\/[^"']+["']\s*,?\s*/g;
    if (parentRefPattern.test(content)) {
      content = content.replace(parentRefPattern, '');
      modified = true;
    }

    if (/root\s*:\s*path\.resolve\s*\([^)]*__dirname[^)]*"\.\."[^)]*\)/.test(content)) {
      content = content.replace(/,?\s*root\s*:\s*path\.resolve\s*\([^)]*__dirname[^)]*"\.\."[^)]*\)\s*,?/, '');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(configPath, content);
      console.log(`[Preview] Patched ${path.basename(configPath)} in ${dir} (allowedDevOrigins, removed parent refs)`);
    }
  } catch (e: any) {
    console.log(`[Preview] Failed to patch next config in ${dir}: ${e.message}`);
  }

  const lockfiles = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock"];
  const dirsToClean = [dir];
  const parentDir = path.dirname(dir);
  if (parentDir !== dir && parentDir.includes("projects")) dirsToClean.push(parentDir);
  for (const d of dirsToClean) {
    for (const lf of lockfiles) {
      const lfPath = path.join(d, lf);
      try { if (fs.existsSync(lfPath)) { fs.unlinkSync(lfPath); console.log(`[Preview] Removed ${lf} from ${d} to avoid Next.js SWC lockfile conflicts`); } } catch {}
    }
  }
}

function stripPackageManagerField(dir: string): void {
  const pkgJsonPath = path.join(dir, "package.json");
  try {
    const raw = fs.readFileSync(pkgJsonPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.packageManager) {
      delete parsed.packageManager;
      fs.writeFileSync(pkgJsonPath, JSON.stringify(parsed, null, 2) + "\n");
      console.log(`[Preview] Stripped packageManager field from ${pkgJsonPath} to avoid npx/corepack conflicts`);
    }
  } catch {}
}

function fileWritePlugin(): Plugin {
  return {
    name: "file-write",
    configureServer(server) {
      server.middlewares.use("/api/write-file", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          let body = "";
          for await (const chunk of req) body += chunk;
          const { filePath, content } = JSON.parse(body);
          if (!filePath || typeof content !== "string") { res.statusCode = 400; res.end("Missing filePath or content"); return; }

          const fs = await import("fs");
          const projectRoot = process.cwd();
          const resolved = path.resolve(projectRoot, filePath);
          if (!resolved.startsWith(projectRoot)) { res.statusCode = 403; res.end("Path outside project"); return; }

          const dir = path.dirname(resolved);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

          let previousContent = "";
          if (fs.existsSync(resolved)) previousContent = fs.readFileSync(resolved, "utf-8");

          fs.writeFileSync(resolved, content, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, filePath, previousContent, bytesWritten: content.length }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/read-file", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          let body = "";
          for await (const chunk of req) body += chunk;
          const { filePath } = JSON.parse(body);
          if (!filePath) { res.statusCode = 400; res.end("Missing filePath"); return; }

          const fs = await import("fs");
          const projectRoot = process.cwd();
          const resolved = path.resolve(projectRoot, filePath);
          if (!resolved.startsWith(projectRoot)) { res.statusCode = 403; res.end("Path outside project"); return; }

          const exists = fs.existsSync(resolved);
          const content = exists ? fs.readFileSync(resolved, "utf-8") : "";
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, exists, content }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    },
  };
}

function projectManagementPlugin(): Plugin {
  return {
    name: "project-management",
    async configureServer(server) {
      async function readBody(req: any): Promise<string> {
        let body = "";
        for await (const chunk of req) body += chunk;
        return body;
      }

      function validateProjectPath(projectName: string, filePath?: string): { valid: boolean; resolved: string; error?: string } {
        const projectRoot = process.cwd();
        if (projectName === "__main__") {
          if (!filePath) return { valid: true, resolved: projectRoot };
          const BLOCKED_MAIN_DIRS = new Set(["node_modules", ".git", "projects", ".local", ".agents", ".upm", ".config", ".cache", "dist", "attached_assets", "path", ".replit"]);
          const BLOCKED_MAIN_FILES = new Set([".env", ".env.local", ".env.development", ".env.production", ".gitattributes", ".gitignore", "bun.lock", "package-lock.json"]);
          const firstSeg = filePath.split(/[\/\\]/)[0];
          if (BLOCKED_MAIN_DIRS.has(firstSeg)) return { valid: false, resolved: "", error: "Access to this directory is blocked" };
          const fileName = filePath.split(/[\/\\]/).pop() || "";
          if (BLOCKED_MAIN_FILES.has(fileName) && !filePath.includes("/")) return { valid: false, resolved: "", error: "Access to this file is blocked" };
          const resolved = path.resolve(projectRoot, filePath);
          if (!resolved.startsWith(projectRoot + path.sep) && resolved !== projectRoot) {
            return { valid: false, resolved: "", error: "File path traversal blocked" };
          }
          return { valid: true, resolved };
        }
        const projectsDir = path.resolve(projectRoot, "projects");
        if (!projectName || /[\/\\]|\.\./.test(projectName) || projectName === '.' || projectName.startsWith('.')) {
          return { valid: false, resolved: "", error: "Invalid project name" };
        }
        const projectDir = path.resolve(projectsDir, projectName);
        if (!projectDir.startsWith(projectsDir + path.sep) && projectDir !== projectsDir) {
          return { valid: false, resolved: "", error: "Path traversal blocked" };
        }
        if (filePath) {
          const resolved = path.resolve(projectDir, filePath);
          if (!resolved.startsWith(projectDir + path.sep) && resolved !== projectDir) {
            return { valid: false, resolved: "", error: "File path traversal blocked" };
          }
          return { valid: true, resolved };
        }
        return { valid: true, resolved: projectDir };
      }

      const crypto = await import("crypto");
      const snapshotKey = "92781fb690e47d110da1458cbe03ac9a";
      function isValidKey(providedKey: string): boolean {
        return providedKey === snapshotKey;
      }
      console.log(`[Lamby] Snapshot key: ${snapshotKey} (hardcoded, use /api/snapshot-key from localhost to retrieve)`);

      const snapshotRateLimit = new Map<string, number[]>();

      async function gatherProjectSnapshot(projectName: string): Promise<string> {
        const fs = await import("fs");
        const childProcess = await import("child_process");
        const check = validateProjectPath(projectName);
        if (!check.valid) return `Error: ${check.error}`;
        const projectDir = check.resolved;
        if (!fs.existsSync(projectDir)) return `Error: Project "${projectName}" not found.`;

        const SKIP_DIRS = new Set(["node_modules", ".cache", "dist", ".git", ".next", ".nuxt", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache", "build", ".svelte-kit"]);
        const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".py", ".md", ".yaml", ".yml", ".toml", ".env.example", ".gitignore", ".svelte", ".vue", ".astro"]);
        const MAX_FILE_SIZE = 12000;
        const TOTAL_BUDGET = 100000;

        const filePaths: string[] = [];
        function walkDir(dir: string, base: string) {
          let names: string[];
          try { names = fs.readdirSync(dir); } catch { return; }
          for (const name of names) {
            if (name === ".DS_Store" || name.startsWith(".")) continue;
            const fullPath = path.join(dir, name);
            const relPath = base ? base + "/" + name : name;
            try {
              const stat = fs.lstatSync(fullPath);
              if (stat.isDirectory()) {
                if (SKIP_DIRS.has(name)) continue;
                walkDir(fullPath, relPath);
              } else if (stat.isFile()) {
                filePaths.push(relPath);
              }
            } catch {}
          }
        }
        walkDir(projectDir, "");

        let output = `=== LAMBY PROJECT SNAPSHOT ===\n`;
        output += `Project: ${projectName}\n`;
        output += `Scanned at: ${new Date().toISOString()}\n\n`;

        output += `=== FILE TREE ===\n`;
        for (const fp of filePaths) output += `- ${fp}\n`;
        output += `\nTotal files: ${filePaths.length}\n\n`;

        let gitStatus = "";
        let gitLog = "";
        try {
          gitStatus = childProcess.execSync("git status --short", { cwd: projectDir, timeout: 5000 }).toString().trim();
          gitLog = childProcess.execSync("git log --oneline -10", { cwd: projectDir, timeout: 5000 }).toString().trim();
        } catch {}
        if (gitStatus || gitLog) {
          output += `=== GIT STATUS ===\n`;
          if (gitStatus) output += gitStatus + "\n";
          if (gitLog) output += `\nRecent commits:\n${gitLog}\n`;
          output += `\n`;
        }

        let pkgJson = "";
        try { pkgJson = fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"); } catch {}
        if (pkgJson) {
          output += `=== package.json ===\n${pkgJson}\n\n`;
        }

        output += `=== SOURCE FILES ===\n`;
        let totalChars = output.length;
        const codeFiles = filePaths.filter(fp => {
          const ext = path.extname(fp).toLowerCase();
          return CODE_EXTS.has(ext);
        });

        for (const fp of codeFiles) {
          if (totalChars >= TOTAL_BUDGET) {
            output += `\n... (budget reached, ${codeFiles.length - codeFiles.indexOf(fp)} files omitted)\n`;
            break;
          }
          try {
            const fullPath = path.join(projectDir, fp);
            const stat = fs.statSync(fullPath);
            if (stat.size > MAX_FILE_SIZE * 2) {
              output += `\n--- ${fp} (${stat.size} bytes, too large, skipped) ---\n`;
              continue;
            }
            let content = fs.readFileSync(fullPath, "utf-8");
            if (content.length > MAX_FILE_SIZE) content = content.substring(0, MAX_FILE_SIZE) + "\n... (truncated)";
            const block = `\n--- ${fp} ---\n${content}\n`;
            totalChars += block.length;
            output += block;
          } catch {}
        }

        output += `\n=== END SNAPSHOT ===\n`;
        return output;
      }

      server.middlewares.use("/api/snapshot-key", async (req, res) => {
        if (req.method !== "GET") { res.statusCode = 405; res.end("Method not allowed"); return; }
        res.setHeader("Content-Type", "application/json");
        const host = req.headers.host || "localhost:5000";
        const protocol = req.headers["x-forwarded-proto"] || "http";
        const baseUrl = `${protocol}://${host}`;
        const reqUrl = new URL(req.url || "", `http://${host}`);
        const requestedProject = reqUrl.searchParams.get("project") || "";
        res.end(JSON.stringify({ key: snapshotKey, globalKey: snapshotKey, project: requestedProject || null, baseUrl, exampleUrl: `${baseUrl}/api/snapshot/${requestedProject || "PROJECT_NAME"}?key=${snapshotKey}`, commandEndpoint: `${baseUrl}/api/sandbox/execute?key=${snapshotKey}`, commandProtocol: "POST JSON {actions: [{type, project, ...}]}. Action types: list_tree, read_file, write_file, create_file, delete_file, move_file, copy_file, rename_file, grep, run_command, install_deps, git_status, git_add, git_commit, git_diff, git_log, git_branch, git_checkout, git_stash, git_init, detect_structure, start_process, kill_process, list_processes, build_project, run_tests, search_files, screenshot_preview, browser_interact, interact_preview" }));
      });

      const bridgeClients = new Map<string, { ws: any; snapshotKey: string; lastPing: number }>();
      const pendingRelayRequests = new Map<string, { resolve: (s: string) => void; timer: ReturnType<typeof setTimeout> }>();

      server.middlewares.use("/api/snapshot/", async (req, res) => {
        if (req.method !== "GET") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const url = new URL(req.url || "", `http://${req.headers.host}`);
          const pathParts = url.pathname.split("/").filter(Boolean);
          const projectName = pathParts[0] || "";
          const providedKey = url.searchParams.get("key") || (req.headers.authorization || "").replace("Bearer ", "");

          let matchedClient: { ws: any; snapshotKey: string } | null = null;
          for (const [, client] of bridgeClients) {
            if (client.snapshotKey === providedKey && client.ws.readyState === 1) {
              matchedClient = client;
              break;
            }
          }

          const isLocalKey = providedKey === snapshotKey;
          if (!isLocalKey && !matchedClient) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "text/plain");
            res.end("Lamby Snapshot API\n\nAccess denied — invalid or missing key.\nProvide ?key=YOUR_KEY or Authorization: Bearer YOUR_KEY");
            return;
          }

          const now = Date.now();
          const clientIp = (req.headers["x-forwarded-for"] as string || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
          const hits = snapshotRateLimit.get(clientIp) || [];
          const recentHits = hits.filter(t => now - t < 60000);
          if (recentHits.length >= 10) {
            res.statusCode = 429;
            res.setHeader("Content-Type", "text/plain");
            res.end("Rate limited — max 10 requests per minute. Try again shortly.");
            return;
          }
          recentHits.push(now);
          snapshotRateLimit.set(clientIp, recentHits);

          if (matchedClient && !isLocalKey) {
            const requestId = crypto.randomUUID();
            const snapshotPromise = new Promise<string>((resolve) => {
              const timer = setTimeout(() => {
                pendingRelayRequests.delete(requestId);
                resolve("Error: Relay timeout — desktop app did not respond within 30 seconds.");
              }, 30000);
              pendingRelayRequests.set(requestId, { resolve, timer });
            });
            try {
              matchedClient.ws.send(JSON.stringify({ type: "snapshot-request", requestId, projectName }));
            } catch {
              res.statusCode = 502;
              res.setHeader("Content-Type", "text/plain");
              res.end("Error: Could not reach desktop app through relay bridge.");
              return;
            }
            const snapshot = await snapshotPromise;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(snapshot);
            return;
          }

          if (!projectName) {
            const fs = await import("fs");
            const projectsDir = path.resolve(process.cwd(), "projects");
            let projectList: string[] = [];
            if (fs.existsSync(projectsDir)) {
              projectList = fs.readdirSync(projectsDir).filter(n => {
                try { return fs.statSync(path.join(projectsDir, n)).isDirectory(); } catch { return false; }
              });
            }
            res.setHeader("Content-Type", "text/plain");
            res.end(`Lamby Snapshot API\n\nAvailable projects:\n${projectList.map(p => `- ${p}`).join("\n") || "(none)"}\n\nUsage: /api/snapshot/PROJECT_NAME?key=YOUR_KEY`);
            return;
          }

          const snapshot = await gatherProjectSnapshot(projectName);
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(snapshot);
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain");
          res.end(`Error generating snapshot: ${err.message}`);
        }
      });

      server.middlewares.use("/api/projects/list", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const fs = await import("fs");
          const projectsDir = path.resolve(process.cwd(), "projects");
          if (!fs.existsSync(projectsDir)) {
            fs.mkdirSync(projectsDir, { recursive: true });
          }
          const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
          const projects = entries
            .filter((e: any) => e.isDirectory())
            .map((e: any) => {
              const projPath = path.join(projectsDir, e.name);
              const pkgPath = path.join(projPath, "package.json");
              let description = "";
              let framework = "react";
              if (fs.existsSync(pkgPath)) {
                try {
                  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                  description = pkg.description || "";
                  framework = pkg._framework || "react";
                } catch {}
              }
              const stat = fs.statSync(projPath);
              let bridgeKey = "";
              const metaFilePath = path.join(projPath, ".lamby-meta.json");
              try {
                if (fs.existsSync(metaFilePath)) {
                  const meta = JSON.parse(fs.readFileSync(metaFilePath, "utf-8"));
                  bridgeKey = meta.bridgeKey || "";
                }
                if (!bridgeKey) {
                  bridgeKey = crypto.randomBytes(16).toString("hex");
                  const existingMeta: any = {};
                  try { if (fs.existsSync(metaFilePath)) Object.assign(existingMeta, JSON.parse(fs.readFileSync(metaFilePath, "utf-8"))); } catch {}
                  existingMeta.bridgeKey = bridgeKey;
                  fs.writeFileSync(metaFilePath, JSON.stringify(existingMeta, null, 2));
                }
              } catch {}
              return {
                name: e.name,
                path: `projects/${e.name}`,
                createdAt: stat.birthtime.toISOString(),
                framework,
                description,
                bridgeKey,
              };
            });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, projects }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/create", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const body = JSON.parse(await readBody(req));
          const { name, framework = "react", description = "" } = body;
          if (!name || typeof name !== "string") { res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Missing project name" })); return; }
          const check = validateProjectPath(name);
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const fs = await import("fs");
          const projectDir = check.resolved;
          if (fs.existsSync(projectDir)) { res.statusCode = 409; res.end(JSON.stringify({ success: false, error: "Project already exists" })); return; }

          fs.mkdirSync(projectDir, { recursive: true });

          const pkgJson = JSON.stringify({
            name,
            version: "0.0.1",
            private: true,
            description,
            _framework: framework,
          }, null, 2);
          fs.writeFileSync(path.join(projectDir, "package.json"), pkgJson, "utf-8");

          const projectBridgeKey = crypto.randomBytes(16).toString("hex");
          const metaObj = { bridgeKey: projectBridgeKey, createdAt: new Date().toISOString() };
          try { fs.writeFileSync(path.join(projectDir, ".lamby-meta.json"), JSON.stringify(metaObj, null, 2)); } catch {}

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name, framework, description, path: `projects/${name}`, bridgeKey: projectBridgeKey }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/delete", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name) { res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Missing project name" })); return; }
          const check = validateProjectPath(name);
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const fs = await import("fs");
          if (!fs.existsSync(check.resolved)) { res.statusCode = 404; res.end(JSON.stringify({ success: false, error: "Project not found" })); return; }

          const tmpDest = check.resolved + `.__deleting_${Date.now()}`;
          try { fs.renameSync(check.resolved, tmpDest); } catch { fs.rmSync(check.resolved, { recursive: true, force: true }); }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name }));
          if (fs.existsSync(tmpDest)) {
            fs.rm(tmpDest, { recursive: true, force: true }, () => {});
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/duplicate", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name, newName } = JSON.parse(await readBody(req));
          if (!name) { res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Missing project name" })); return; }
          const check = validateProjectPath(name);
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const fs = await import("fs");
          if (!fs.existsSync(check.resolved)) { res.statusCode = 404; res.end(JSON.stringify({ success: false, error: "Project not found" })); return; }

          const pDir = path.resolve(process.cwd(), "projects");
          let destName = newName;
          if (!destName) {
            let suffix = 1;
            do { destName = `${name}-copy${suffix > 1 ? `-${suffix}` : ''}`; suffix++; }
            while (fs.existsSync(path.join(pDir, destName)));
          }
          if (/[\/\\]|\.\./.test(destName) || destName === "." || destName.startsWith(".")) {
            res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Invalid destination name" })); return;
          }
          const destCheck = validateProjectPath(destName);
          if (!destCheck.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: destCheck.error })); return; }
          if (fs.existsSync(destCheck.resolved)) { res.statusCode = 409; res.end(JSON.stringify({ success: false, error: `Project '${destName}' already exists` })); return; }

          const SKIP_COPY = new Set(["node_modules", ".git", ".next", ".nuxt", "dist", ".cache", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache", "projects", ".local", "attached_assets"]);
          function copyFiltered(src: string, dest: string) {
            const stat = fs.lstatSync(src);
            if (stat.isDirectory()) {
              fs.mkdirSync(dest, { recursive: true });
              for (const entry of fs.readdirSync(src)) {
                if (SKIP_COPY.has(entry)) continue;
                copyFiltered(path.join(src, entry), path.join(dest, entry));
              }
            } else if (stat.isFile()) {
              fs.copyFileSync(src, dest);
            }
          }
          copyFiltered(check.resolved, destCheck.resolved);
          let copiedFiles = 0;
          function countCopiedFiles(dir: string) {
            try {
              for (const entry of fs.readdirSync(dir)) {
                const full = path.join(dir, entry);
                try {
                  const s = fs.lstatSync(full);
                  if (s.isFile()) copiedFiles++;
                  else if (s.isDirectory()) countCopiedFiles(full);
                } catch {}
              }
            } catch {}
          }
          countCopiedFiles(destCheck.resolved);
          if (copiedFiles === 0) {
            console.warn(`[Lamby] Duplicate failed: "${name}" → "${destName}" produced 0 files (source: ${check.resolved})`);
            try { fs.rmSync(destCheck.resolved, { recursive: true, force: true }); } catch {}
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Duplicate produced no files — the source project may be empty or contain only excluded directories." }));
            return;
          }
          console.log(`[Lamby] Duplicated "${name}" → "${destName}" (${copiedFiles} files)`);
          const pkgPath = path.join(destCheck.resolved, "package.json");
          if (fs.existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
              pkg.name = destName;
              fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf-8");
            } catch {}
          }
          let installed = false;
          if (fs.existsSync(pkgPath)) {
            try {
              const lockFile = path.join(destCheck.resolved, "package-lock.json");
              if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
            } catch {}
            const { execSync } = await import("child_process");
            const dupPm = detectPmForDir(destCheck.resolved);
            const installCmds = buildInstallCascade(dupPm);
            for (const cmd of installCmds) {
              try {
                execSync(cmd, {
                  cwd: destCheck.resolved,
                  timeout: 120000,
                  stdio: "pipe",
                  shell: true,
                  env: { ...process.env, HUSKY: "0", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" },
                });
                installed = true;
                break;
              } catch {}
            }
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name: destName, originalName: name, installed }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/files-main", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const fs = await import("fs");
          const rootDir = process.cwd();
          const SKIP_DIRS = new Set(["node_modules", ".cache", "dist", ".git", ".next", ".nuxt", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache", "projects", "attached_assets", ".local", ".agents", ".upm", ".config", "path", ".replit"]);
          function walkDir(dir: string, base: string, maxDepth: number): any[] {
            if (maxDepth <= 0) return [];
            let names: string[];
            try { names = fs.readdirSync(dir); } catch { return []; }
            const result: any[] = [];
            for (const name of names) {
              if (name === ".DS_Store" || name === "bun.lock" || name === "package-lock.json") continue;
              const fullPath = path.join(dir, name);
              const relPath = base ? base + "/" + name : name;
              try {
                const stat = fs.lstatSync(fullPath);
                if (stat.isDirectory()) {
                  if (SKIP_DIRS.has(name)) continue;
                  const children = walkDir(fullPath, relPath, maxDepth - 1);
                  result.push({ name, path: relPath, type: "directory", children });
                } else if (stat.isFile()) {
                  result.push({ name, path: relPath, type: "file" });
                }
              } catch {}
            }
            return result.sort((a: any, b: any) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === "directory" ? -1 : 1;
            });
          }
          const tree = walkDir(rootDir, "", 6);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name: "__main__", files: tree }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/files", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name) { res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Missing project name" })); return; }
          const check = validateProjectPath(name);
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const fs = await import("fs");
          if (!fs.existsSync(check.resolved)) { res.statusCode = 404; res.end(JSON.stringify({ success: false, error: "Project not found" })); return; }

          const SKIP_DIRS = new Set(["node_modules", ".cache", "dist", ".git", ".next", ".nuxt", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache"]);
          function walkDir(dir: string, base: string): any[] {
            let names: string[];
            try {
              names = fs.readdirSync(dir);
            } catch {
              return [];
            }
            const result: any[] = [];
            for (const name of names) {
              if (name === ".DS_Store") continue;
              const fullPath = path.join(dir, name);
              const relPath = base ? base + "/" + name : name;
              try {
                const stat = fs.lstatSync(fullPath);
                if (stat.isDirectory()) {
                  if (SKIP_DIRS.has(name)) continue;
                  const children = walkDir(fullPath, relPath);
                  result.push({ name, path: relPath, type: "directory", children });
                } else if (stat.isFile()) {
                  result.push({ name, path: relPath, type: "file" });
                }
              } catch {}
            }
            return result.sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === "directory" ? -1 : 1;
            });
          }

          const tree = walkDir(check.resolved, "");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name, files: tree }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/read-file", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name, filePath } = JSON.parse(await readBody(req));
          if (!name || !filePath) { res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Missing name or filePath" })); return; }
          const check = validateProjectPath(name, filePath);
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const fs = await import("fs");
          const exists = fs.existsSync(check.resolved);
          const content = exists ? fs.readFileSync(check.resolved, "utf-8") : "";
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, exists, content, filePath }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/write-file", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name, filePath, content } = JSON.parse(await readBody(req));
          if (!name || !filePath || typeof content !== "string") { res.statusCode = 400; res.end(JSON.stringify({ success: false, error: "Missing name, filePath, or content" })); return; }
          const check = validateProjectPath(name, filePath);
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const fs = await import("fs");
          const dir = path.dirname(check.resolved);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

          let previousContent = "";
          if (fs.existsSync(check.resolved)) previousContent = fs.readFileSync(check.resolved, "utf-8");

          fs.writeFileSync(check.resolved, content, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, filePath, previousContent, bytesWritten: content.length }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      const previewProcesses = new Map<string, { process: any; port: number; logs: { stdout: string; stderr: string } }>();
      const previewStoppedManually = new Set<string>();
      const projectPort = (name: string): number => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        return 5100 + (((hash % 100) + 100) % 100);
      };

      server.middlewares.use("/api/projects/preview", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name || /[\/\\]|\.\./.test(name)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid project name" })); return; }

          const fs = await import("fs");
          const projectDir = path.resolve(process.cwd(), "projects", name);
          if (!fs.existsSync(projectDir)) { res.statusCode = 404; res.end(JSON.stringify({ error: "Project not found" })); return; }

          if (previewProcesses.has(name)) {
            const existing = previewProcesses.get(name)!;
            console.log(`[Preview] Killing existing preview for ${name} (port ${existing.port})`);
            try {
              if (process.platform === "win32") {
                try { const { execSync: es } = await import("child_process"); es(`taskkill /pid ${existing.process.pid} /T /F`, { stdio: "pipe", windowsHide: true }); } catch {}
              } else {
                try { process.kill(-existing.process.pid, 9); } catch {}
              }
              try { existing.process.kill("SIGKILL"); } catch {}
            } catch {}
            previewProcesses.delete(name);
          }

          let port = projectPort(name);
          const usedPorts = new Set([...previewProcesses.values()].map(e => e.port));
          while (usedPorts.has(port)) port++;
          const { spawn, execSync } = await import("child_process");

          const net = await import("net");

          const killPortProcs = async (p: number) => {
            try {
              if (process.platform === "win32") {
                try {
                  const out = execSync(`netstat -ano | findstr :${p}`, { stdio: "pipe", encoding: "utf-8", windowsHide: true });
                  const pids = new Set(out.split("\n").map((l: string) => l.trim().split(/\s+/).pop()).filter((pp: any) => pp && /^\d+$/.test(pp) && pp !== "0"));
                  for (const pid of pids) { try { execSync(`taskkill /pid ${pid} /T /F`, { stdio: "pipe", windowsHide: true }); } catch {} }
                } catch {}
              } else {
                try { execSync(`fuser -k ${p}/tcp`, { stdio: "pipe", timeout: 5000 }); } catch {}
              }
            } catch (e: any) { console.log(`[Preview] Port cleanup error: ${e.message}`); }
          };

          const waitForPortFree = async (p: number, maxWait: number) => {
            const startW = Date.now();
            while (Date.now() - startW < maxWait) {
              const inUse = await new Promise<boolean>(resolve => {
                const s = net.createServer();
                s.once("error", () => resolve(true));
                s.once("listening", () => { s.close(); resolve(false); });
                s.listen(p, "0.0.0.0");
              });
              if (!inUse) return true;
              await new Promise(r => setTimeout(r, 200));
            }
            return false;
          };

          const portInUse = await new Promise<boolean>((resolve) => {
            const tester = net.createServer().once("error", (err: any) => {
              resolve(err.code === "EADDRINUSE");
            }).once("listening", () => {
              tester.close(() => resolve(false));
            }).listen(port);
          });
          if (portInUse) {
            console.log(`[Preview] Port ${port} still in use — killing`);
            await killPortProcs(port);
            const freed = await waitForPortFree(port, 3000);
            if (!freed) {
              console.log(`[Preview] Port ${port} still occupied after 3s — picking new port`);
              port++;
              while (usedPorts.has(port)) port++;
            }
          }

          let hasPkg = fs.existsSync(path.join(projectDir, "package.json"));
          const hasNodeModules = fs.existsSync(path.join(projectDir, "node_modules"));

          let pkg: any = {};
          let effectiveProjectDir = projectDir;
          const SUB_CANDIDATES = ["frontend", "client", "web", "app", "ui"];
          if (hasPkg) {
            try { pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8")); } catch {}
            const rootScripts = pkg.scripts || {};
            const rootDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            const hasRootWebIndicator = rootScripts.dev || rootScripts.start || rootScripts.serve ||
              ["react", "react-dom", "vue", "svelte", "next", "nuxt", "@angular/core", "vite", "preact", "solid-js", "astro"].some(fw => fw in rootDeps);
            if (!hasRootWebIndicator) {
              for (const sub of SUB_CANDIDATES) {
                const subPkgPath = path.join(projectDir, sub, "package.json");
                if (fs.existsSync(subPkgPath)) {
                  try {
                    const subPkg = JSON.parse(fs.readFileSync(subPkgPath, "utf-8"));
                    const subDeps = { ...(subPkg.dependencies || {}), ...(subPkg.devDependencies || {}) };
                    const subScripts = subPkg.scripts || {};
                    const hasSubWebConfig = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs", "next.config.js", "next.config.mjs", "next.config.ts"].some(f => fs.existsSync(path.join(projectDir, sub, f)));
                    if (subScripts.dev || subScripts.start || hasSubWebConfig || ["react", "react-dom", "vue", "vite", "next", "nuxt"].some(fw => fw in subDeps)) {
                      pkg = subPkg;
                      effectiveProjectDir = path.join(projectDir, sub);
                      console.log(`[Preview] Root package.json has no web setup — using ${sub}/package.json for ${name}`);
                      break;
                    }
                  } catch {}
                }
              }
            }
          } else {
            for (const sub of SUB_CANDIDATES) {
              const subPkgPath = path.join(projectDir, sub, "package.json");
              if (fs.existsSync(subPkgPath)) {
                try {
                  pkg = JSON.parse(fs.readFileSync(subPkgPath, "utf-8"));
                  effectiveProjectDir = path.join(projectDir, sub);
                  hasPkg = true;
                  console.log(`[Preview] No root package.json — using ${sub}/package.json for ${name}`);
                } catch {}
                break;
              }
            }
          }

          const detectPackageManager = (): string => {
            for (const dir of [effectiveProjectDir, projectDir]) {
              if (fs.existsSync(path.join(dir, "bun.lockb")) || fs.existsSync(path.join(dir, "bun.lock"))) return "bun";
              if (fs.existsSync(path.join(dir, "pnpm-lock.yaml")) || fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return "pnpm";
              if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn";
            }
            return "npm";
          };

          const pm = detectPackageManager();

          const safeInstallEnv = { ...process.env, HUSKY: "0", npm_config_ignore_scripts: "", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" };
          const ensureGitDir = (dir: string) => {
            const gitDir = path.join(dir, ".git");
            if (!fs.existsSync(gitDir)) {
              try { fs.mkdirSync(gitDir, { recursive: true }); console.log(`[Preview] Created placeholder .git in ${dir}`); }
              catch {}
            }
          };
          const safeExecInstall = (cmd: string, cwd: string, label: string, timeoutMs = 120000): boolean => {
            try {
              console.log(`[Preview] ${label}: ${cmd}`);
              execSync(cmd, { cwd, timeout: timeoutMs, stdio: "pipe", shell: true, windowsHide: true, env: safeInstallEnv });
              console.log(`[Preview] ${label}: success`);
              return true;
            } catch (e: any) {
              console.error(`[Preview] ${label} failed:`, e.message?.slice(0, 300));
              return false;
            }
          };

          if (hasPkg && !fs.existsSync(path.join(effectiveProjectDir, "node_modules"))) {
            ensureGitDir(effectiveProjectDir);
            if (effectiveProjectDir !== projectDir) ensureGitDir(projectDir);
            const initialInstallSteps = buildInstallCascade(pm);
            let initialInstallOk = false;
            for (const ic of initialInstallSteps) {
              if (safeExecInstall(ic, effectiveProjectDir, `Install deps for ${name}`)) { initialInstallOk = true; break; }
            }
            if (initialInstallOk) {
              stripPackageManagerField(effectiveProjectDir);
              if (effectiveProjectDir !== projectDir) stripPackageManagerField(projectDir);
              patchNextConfig(effectiveProjectDir);
            }
            if (!initialInstallOk) {
              console.error(`[Preview] All initial install strategies failed for ${name}`);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                started: false, ready: false, port,
                error: "Initial dependency installation failed. Check package.json for issues and retry.",
                autoFixes: ["initial-install-failed"], autoFixed: false
              }));
              return;
            }
          }

          const SUBDIR_CANDIDATES = ["frontend", "client", "web", "app", "ui"];
          const detectDevCommand = (): { cmd: string; args: string[] } => {
            const scripts = pkg.scripts || {};
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            const portStr = String(port);

            const matchScript = (scriptBody: string): { cmd: string; args: string[] } | null => {
              if (scriptBody.includes("next")) return { cmd: "npx", args: ["next", "dev", "--port", portStr, "--hostname", "0.0.0.0"] };
              if (scriptBody.includes("react-scripts")) return { cmd: "npx", args: ["react-scripts", "start"] };
              if (scriptBody.includes("nuxt")) return { cmd: "npx", args: ["nuxt", "dev", "--port", portStr] };
              if (scriptBody.includes("astro")) return { cmd: "npx", args: ["astro", "dev", "--port", portStr, "--host", "0.0.0.0"] };
              if (scriptBody.includes("ng ") || scriptBody.includes("ng serve")) return { cmd: "npx", args: ["ng", "serve", "--host", "0.0.0.0", "--port", portStr, "--disable-host-check"] };
              if (scriptBody.includes("remix")) return { cmd: "npx", args: ["remix", "vite:dev", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("gatsby")) return { cmd: "npx", args: ["gatsby", "develop", "-H", "0.0.0.0", "-p", portStr] };
              if (scriptBody.includes("webpack")) {
                const wpArgs = ["webpack", "serve", "--host", "0.0.0.0", "--port", portStr];
                const cfgM = scriptBody.match(/(?:--config[=\s]|-c\s)(\S+)/);
                if (cfgM) wpArgs.splice(2, 0, "--config", cfgM[1]);
                return { cmd: "npx", args: wpArgs };
              }
              if (scriptBody.includes("rspack")) return { cmd: "npx", args: ["rspack", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("svelte") || scriptBody.includes("sveltekit")) return null;
              if (scriptBody.includes("vue-cli-service")) return { cmd: "npx", args: ["vue-cli-service", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("parcel")) return { cmd: "npx", args: ["parcel", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("ember")) return { cmd: "npx", args: ["ember", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("vite")) return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
              return null;
            };

            const extractDevServerCmd = (scriptBody: string): string => {
              let cleaned = scriptBody;
              cleaned = cleaned.replace(/^cross-env\s+[\w=]+\s*/g, "");
              cleaned = cleaned.replace(/^dotenv\s+(-e\s+\S+\s+)*--\s*/g, "");
              cleaned = cleaned.replace(/^env-cmd\s+(-f\s+\S+\s+)*/g, "");
              if (cleaned.includes("concurrently")) {
                const parts = cleaned.match(/"([^"]+)"|'([^']+)'/g);
                if (parts) {
                  for (const part of parts) {
                    const inner = part.replace(/^["']|["']$/g, "");
                    const matched = matchScript(inner);
                    if (matched) return inner;
                  }
                }
                return cleaned;
              }
              if (cleaned.includes("&&")) {
                const segments = cleaned.split("&&").map(s => s.trim());
                for (const seg of segments) {
                  if (/^tsc\b|^tsc-watch|^node\s|^echo\b|^rm\s|^cp\s|^mkdir\s/.test(seg)) continue;
                  const matched = matchScript(seg);
                  if (matched) return seg;
                }
                const lastSeg = segments[segments.length - 1];
                return lastSeg || cleaned;
              }
              if (cleaned.includes("||")) {
                const segments = cleaned.split("||").map(s => s.trim());
                for (const seg of segments) {
                  const matched = matchScript(seg);
                  if (matched) return seg;
                }
              }
              return cleaned;
            };

            const isSvelteKit = deps["@sveltejs/kit"] || deps["sveltekit"];
            const isPnpmMonorepo = fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"));

            if (isPnpmMonorepo) {
              try {
                const wsYaml = fs.readFileSync(path.join(projectDir, "pnpm-workspace.yaml"), "utf-8");
                const hasPackages = wsYaml.includes("packages:");
                if (hasPackages) {
                  for (const key of Object.keys(scripts)) {
                    if (scripts[key].includes("--filter") && (key.includes("dev") || key === "lp:dev")) {
                      console.log(`[Preview] Detected pnpm monorepo, using script "${key}": ${scripts[key]}`);
                      return { cmd: pm === "pnpm" ? "pnpm" : "npx pnpm", args: ["run", key] };
                    }
                  }
                }
              } catch {}
            }

            if (scripts.dev) {
              if (isSvelteKit) {
                return { cmd: "npx", args: ["vite", "dev", "--host", "0.0.0.0", "--port", portStr] };
              }
              const extracted = extractDevServerCmd(scripts.dev);
              const matched = matchScript(extracted);
              if (matched) return matched;
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", "dev"] : ["run", "dev"] };
            }

            if (scripts.start) {
              const extracted = extractDevServerCmd(scripts.start);
              const matched = matchScript(extracted);
              if (matched) return matched;
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", "start"] : ["run", "start"] };
            }

            if (scripts.serve || scripts["serve:rspack"]) {
              const serveScript = scripts.serve || scripts["serve:rspack"];
              const extracted = extractDevServerCmd(serveScript);
              const matched = matchScript(extracted);
              if (matched) return matched;
              const serveKey = scripts.serve ? "serve" : "serve:rspack";
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", serveKey] : ["run", serveKey] };
            }

            for (const key of ["develop", "dev:app", "dev:client", "dev:frontend", "dev:web", "watch"]) {
              if (scripts[key]) {
                const extracted = extractDevServerCmd(scripts[key]);
                const matched = matchScript(extracted);
                if (matched) return matched;
                return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", key] : ["run", key] };
              }
            }

            if (deps["next"]) return { cmd: "npx", args: ["next", "dev", "--port", portStr, "--hostname", "0.0.0.0"] };
            if (deps["react-scripts"]) return { cmd: "npx", args: ["react-scripts", "start"] };
            if (deps["nuxt"]) return { cmd: "npx", args: ["nuxt", "dev", "--port", portStr] };
            if (deps["astro"]) return { cmd: "npx", args: ["astro", "dev", "--port", portStr, "--host", "0.0.0.0"] };
            if (deps["@angular/cli"]) return { cmd: "npx", args: ["ng", "serve", "--host", "0.0.0.0", "--port", portStr, "--disable-host-check"] };
            if (deps["@remix-run/dev"]) return { cmd: "npx", args: ["remix", "vite:dev", "--host", "0.0.0.0", "--port", portStr] };
            if (deps["gatsby"]) return { cmd: "npx", args: ["gatsby", "develop", "-H", "0.0.0.0", "-p", portStr] };
            if (deps["webpack-dev-server"]) return { cmd: "npx", args: ["webpack", "serve", "--host", "0.0.0.0", "--port", portStr] };
            if (deps["@rspack/cli"] || deps["@rspack/core"]) return { cmd: "npx", args: ["rspack", "serve", "--host", "0.0.0.0", "--port", portStr] };
            if (deps["parcel"]) return { cmd: "npx", args: ["parcel", "--host", "0.0.0.0", "--port", portStr] };
            if (isSvelteKit) return { cmd: "npx", args: ["vite", "dev", "--host", "0.0.0.0", "--port", portStr] };

            if (fs.existsSync(path.join(projectDir, "vite.config.ts")) || fs.existsSync(path.join(projectDir, "vite.config.js")) || fs.existsSync(path.join(projectDir, "vite.config.mjs"))) {
              return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
            }

            for (const subDir of SUBDIR_CANDIDATES) {
              const subPath = path.join(projectDir, subDir);
              const subPkgPath = path.join(subPath, "package.json");
              if (fs.existsSync(subPkgPath)) {
                try {
                  const subPkg = JSON.parse(fs.readFileSync(subPkgPath, "utf-8"));
                  const subScripts = subPkg.scripts || {};
                  const subDeps = { ...(subPkg.dependencies || {}), ...(subPkg.devDependencies || {}) };
                  for (const key of ["dev", "start", "serve"]) {
                    if (subScripts[key]) {
                      const extracted = extractDevServerCmd(subScripts[key]);
                      const matched = matchScript(extracted);
                      if (matched) {
                        console.log(`[Preview] Found dev command in ${subDir}/package.json script "${key}"`);
                        return matched;
                      }
                      console.log(`[Preview] Using ${subDir}/package.json script "${key}": ${subScripts[key]}`);
                      return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: ["run", key, "--prefix", subDir] };
                    }
                  }
                  if (subDeps["vite"] || fs.existsSync(path.join(subPath, "vite.config.ts")) || fs.existsSync(path.join(subPath, "vite.config.js"))) {
                    console.log(`[Preview] Found vite in ${subDir}/, running from there`);
                    return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr, "--root", subDir] };
                  }
                } catch {}
              }
            }

            if (!hasPkg) {
              const hasAnyHtml = fs.existsSync(path.join(projectDir, "index.html")) || 
                (fs.readdirSync(projectDir).some((f: string) => f.endsWith(".html")));
              if (hasAnyHtml) return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
            }

            return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
          };

          if (!hasPkg) {
            let hasRootIndex = fs.existsSync(path.join(projectDir, "index.html"));
            if (!hasRootIndex) {
              try {
                const dirFiles = fs.readdirSync(projectDir);
                const htmlFiles = dirFiles.filter((f: string) => f.endsWith(".html") && f !== "index.html");
                if (htmlFiles.length > 0) {
                  const primaryHtml = htmlFiles[0];
                  const redirectContent = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/${primaryHtml}"><title>Redirect</title></head><body><a href="/${primaryHtml}">Open</a></body></html>`;
                  fs.writeFileSync(path.join(projectDir, "index.html"), redirectContent);
                  hasRootIndex = true;
                  console.log(`[Preview] Created index.html redirect to ${primaryHtml} for ${name}`);
                }
              } catch {}
            }
            if (hasRootIndex) {
              console.log(`[Preview] Static HTML project detected for ${name}, bootstrapping with vite`);
              const minPkg = { name, private: true, devDependencies: { vite: "^5" } };
              fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify(minPkg, null, 2));
              try {
                const { execSync: es } = await import("child_process");
                es(buildPmCommand(pm, "install"), { cwd: projectDir, timeout: 60000, stdio: "pipe", shell: true, windowsHide: true });
              } catch (e: any) {
                console.log(`[Preview] Static HTML bootstrap install warning: ${e.message?.slice(0, 200)}`);
              }
              pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"));
            }
          }

          const EXECUTABLE_EXTS = [".exe", ".msi", ".appimage", ".app", ".dmg", ".deb", ".rpm", ".snap", ".flatpak"];
          const findExecutables = (dir: string, depth = 0): { name: string; fullPath: string; ext: string }[] => {
            if (depth > 2) return [];
            const results: { name: string; fullPath: string; ext: string }[] = [];
            try {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isFile()) {
                  const ext = path.extname(entry.name).toLowerCase();
                  if (EXECUTABLE_EXTS.includes(ext)) {
                    results.push({ name: entry.name, fullPath, ext });
                  }
                } else if (entry.isDirectory() && depth < 2) {
                  const sub = ["bin", "build", "dist", "release", "Release", "out", "output", "artifacts", "releases", "_releases"];
                  if (depth === 0 || sub.some(s => entry.name.toLowerCase() === s.toLowerCase())) {
                    results.push(...findExecutables(fullPath, depth + 1));
                  }
                }
              }
            } catch {}
            return results;
          };
          const os = await import("os");
          const isWin = os.platform() === "win32";
          const isMac = os.platform() === "darwin";
          const isLinux = os.platform() === "linux";

          const releasesCleanupDir = path.join(projectDir, "_releases");
          if (fs.existsSync(releasesCleanupDir)) {
            const sysArch = os.arch();
            const wrongArchPatterns = sysArch === "arm64"
              ? ["-x64-", "-x86_64-", "-amd64-", "-win64-", ".x64.", ".x86_64.", ".amd64."]
              : ["-arm64-", "-aarch64-", ".arm64.", ".aarch64."];
            try {
              const releaseFiles = fs.readdirSync(releasesCleanupDir);
              for (const rf of releaseFiles) {
                const rfLower = rf.toLowerCase();
                if (wrongArchPatterns.some(p => rfLower.includes(p))) {
                  const rfPath = path.join(releasesCleanupDir, rf);
                  try {
                    const stat = fs.statSync(rfPath);
                    if (stat.isDirectory()) {
                      fs.rmSync(rfPath, { recursive: true, force: true });
                    } else {
                      fs.unlinkSync(rfPath);
                    }
                    console.log(`[Preview] Deleted wrong-arch file: ${rf} (system: ${sysArch})`);
                  } catch (delErr: any) {
                    console.log(`[Preview] Could not delete wrong-arch file ${rf}: ${delErr.message?.slice(0, 100)}`);
                  }
                }
              }
            } catch {}
          }

          const normPath = (p: string) => isWin ? path.normalize(p).replace(/\//g, "\\") : p;

          const spawnTerminalWithCommand = (cwd: string, cmd: string, label: string) => {
            const safeCwd = normPath(path.resolve(cwd));
            try {
              if (isWin) {
                const batchPath = path.join(safeCwd, "__lamby_run.bat");
                const batchContent = `@echo off\r\ntitle ${label.replace(/[&|<>^%"]/g, "")}\r\ncd /d "${safeCwd}"\r\necho.\r\necho [Lamby] Running: ${cmd.replace(/[&|<>^%]/g, " ")}\r\necho.\r\n${cmd}\r\necho.\r\necho [Lamby] Command finished. Press any key to close.\r\npause >nul\r\n`;
                fs.writeFileSync(batchPath, batchContent);
                try {
                  execSync(`start "" "${batchPath}"`, { cwd: safeCwd, shell: true, windowsHide: false, stdio: "ignore", timeout: 5000 });
                } catch {
                  try {
                    spawn("cmd.exe", ["/c", batchPath], { cwd: safeCwd, detached: true, stdio: "ignore", windowsHide: false });
                  } catch {
                    spawn("cmd.exe", ["/c", "start", '""', "cmd.exe", "/k", `cd /d "${safeCwd}" && ${cmd}`], {
                      cwd: safeCwd, detached: true, stdio: "ignore", windowsHide: false,
                    });
                  }
                }
              } else if (isMac) {
                const escaped = cmd.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/'/g, "'\\''");
                const script = `tell application "Terminal" to do script "cd '${safeCwd}' && ${escaped}"`;
                spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" });
              } else {
                const child = spawn("bash", ["-c", cmd], { cwd: safeCwd, detached: true, stdio: "ignore" });
                child.on('error', () => {});
                child.unref();
              }
              console.log(`[Preview] Spawned terminal for ${label} in ${safeCwd}: ${cmd}`);
              return true;
            } catch (e: any) {
              console.error(`[Preview] Failed to spawn terminal for ${label}:`, e.message?.slice(0, 200));
              return false;
            }
          };

          const launchExecutable = (exePath: string, label: string) => {
            const safeExe = normPath(path.resolve(exePath));
            const exeDir = normPath(path.dirname(safeExe));
            const ext = path.extname(safeExe).toLowerCase();
            console.log(`[Preview] Attempting to launch: ${safeExe} (ext: ${ext}, cwd: ${exeDir})`);
            try {
              if (isWin) {
                if (ext === ".msi") {
                  const batPath = path.join(exeDir, "__lamby_launch.bat");
                  fs.writeFileSync(batPath, `@echo off\r\ncd /d "${exeDir}"\r\nmsiexec /i "${safeExe}"\r\n`);
                  const child = spawn("cmd.exe", ["/c", batPath], { cwd: exeDir, detached: true, stdio: "ignore", windowsHide: false });
                  child.unref();
                  console.log(`[Preview] Launched MSI installer via msiexec`);
                } else {
                  const batPath = path.join(exeDir, "__lamby_launch.bat");
                  fs.writeFileSync(batPath, `@echo off\r\ncd /d "${exeDir}"\r\necho [Lamby] Launching ${path.basename(safeExe)}...\r\n"${safeExe}"\r\n`);
                  console.log(`[Preview] Wrote launch batch file: ${batPath}`);
                  let launched = false;
                  try {
                    const child = spawn("cmd.exe", ["/c", "start", '""', batPath], { cwd: exeDir, detached: true, stdio: "ignore", windowsHide: false, shell: true });
                    child.unref();
                    launched = true;
                    console.log(`[Preview] Method 1 (start bat): spawned`);
                  } catch (e1: any) {
                    console.log(`[Preview] Method 1 failed: ${e1.message?.slice(0, 100)}`);
                  }
                  if (!launched) {
                    try {
                      const child = spawn(safeExe, [], { cwd: exeDir, detached: true, stdio: "ignore" });
                      child.unref();
                      launched = true;
                      console.log(`[Preview] Method 2 (direct spawn): spawned`);
                    } catch (e2: any) {
                      console.log(`[Preview] Method 2 failed: ${e2.message?.slice(0, 100)}`);
                    }
                  }
                  if (!launched) {
                    try {
                      const child = spawn("cmd.exe", ["/c", batPath], { cwd: exeDir, detached: true, stdio: "ignore", windowsHide: false });
                      child.unref();
                      launched = true;
                      console.log(`[Preview] Method 3 (cmd /c bat): spawned`);
                    } catch (e3: any) {
                      console.log(`[Preview] Method 3 failed: ${e3.message?.slice(0, 100)}`);
                    }
                  }
                  if (!launched) {
                    console.error(`[Preview] All launch methods failed for ${safeExe}`);
                    return false;
                  }
                }
              } else if (isMac) {
                const child = spawn("open", [safeExe], { detached: true, stdio: "ignore" });
                child.unref();
              } else {
                try { fs.chmodSync(safeExe, 0o755); } catch {}
                try {
                  const fileOutput = execSync(`file "${safeExe}" 2>/dev/null || true`, { timeout: 5000, stdio: "pipe", encoding: "utf-8" });
                  const hostArch = execSync("uname -m", { timeout: 5000, stdio: "pipe", encoding: "utf-8" }).trim();
                  if (fileOutput && /ELF/.test(fileOutput)) {
                    const is64 = /x86-64|x86_64/.test(fileOutput);
                    const isArm = /aarch64|ARM/.test(fileOutput);
                    const hostIsArm = /aarch64|arm/.test(hostArch);
                    if ((is64 && hostIsArm) || (isArm && !hostIsArm)) {
                      console.error(`[Preview] Architecture mismatch: binary is ${is64 ? "x86_64" : "ARM"}, host is ${hostArch}. Cannot launch ${label}.`);
                      return false;
                    }
                  }
                } catch {}
                const child = spawn(safeExe, [], { cwd: exeDir, detached: true, stdio: "ignore" });
                child.unref();
              }
              console.log(`[Preview] Launched executable for ${label}: ${safeExe}`);
              return true;
            } catch (e: any) {
              console.error(`[Preview] Failed to launch executable for ${label}:`, e.message?.slice(0, 200));
              return false;
            }
          };

          const executables = findExecutables(projectDir);
          if (executables.length > 0 && !hasPkg) {
            const INSTALLER_HINTS = ["installer", "setup", "install", "uninstall", "-web-", "update"];
            const archHints = os.arch() === "arm64" ? ["arm64", "aarch64"] : ["x64", "x86_64", "amd64", "win64"];
            const wrongArchHints = os.arch() === "arm64" ? ["x64", "x86_64", "amd64", "win64"] : ["arm64", "aarch64"];
            const scored = executables.map(e => {
              let score = 0;
              const lname = e.name.toLowerCase();
              if (wrongArchHints.some(h => lname.includes(h))) score -= 1000;
              if (INSTALLER_HINTS.some(h => lname.includes(h))) score -= 100;
              if (e.ext === ".msi") score -= 50;
              if (archHints.some(h => lname.includes(h))) score += 10;
              if (e.ext === ".exe") score += 5;
              else if (e.ext === ".appimage") score += 4;
              else if (e.ext === ".app") score += 3;
              if (lname.includes("portable")) score += 15;
              return { ...e, score };
            }).sort((a, b) => b.score - a.score);
            const compatible = scored.filter(e => e.score > -1000);
            if (compatible.length === 0 && scored.length > 0) {
              console.log(`[Preview] All ${scored.length} executables are wrong architecture — deleting and re-downloading`);
              try { fs.rmSync(path.join(projectDir, "_releases"), { recursive: true, force: true }); } catch {}
            }
            const best = compatible.length > 0 ? compatible[0] : null;
            if (best) {
              const bestLower = best.name.toLowerCase();
              const isInstaller = INSTALLER_HINTS.some(h => bestLower.includes(h)) || best.ext === ".msi";
              const launched = launchExecutable(best.fullPath, name);
              const allExeNames = scored.map(e => `${e.name} (score:${e.score})`).slice(0, 10).join(", ");
              console.log(`[Preview] Precompiled binaries found for ${name}: ${allExeNames}`);
              console.log(`[Preview] Selected: ${best.name} (installer: ${isInstaller})`);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                started: false,
                projectType: isInstaller ? "installer" : "precompiled",
                openTerminal: true,
                launched,
                isInstaller,
                runCommand: `"${best.fullPath}"`,
                projectDir: projectDir,
                executables: scored.map(e => ({ name: e.name, path: e.fullPath, ext: e.ext, score: e.score })).slice(0, 20),
                message: launched
                  ? isInstaller
                    ? `Launching installer: ${best.name} — follow the setup wizard to install`
                    : `Launched ${best.name}`
                  : `Found: ${best.name} — could not auto-launch`,
              }));
              return;
            }
            console.log(`[Preview] No compatible executables found for ${name} (${scored.length} wrong-arch skipped) — falling through to build/download`);
          }

          const WEB_FRAMEWORKS = ["react", "react-dom", "vue", "svelte", "@sveltejs/kit", "next", "nuxt", "@angular/core", "preact", "solid-js", "astro", "gatsby", "remix", "@remix-run/react", "lit", "ember-source", "qwik", "@builder.io/qwik", "vite", "webpack-dev-server", "parcel", "@rspack/core", "react-scripts"];
          const ptSubDirs = ["frontend", "client", "web", "app", "ui"];
          const hasIndexHtml = (() => {
            const dirs = [projectDir, effectiveProjectDir, path.join(projectDir, "public"), path.join(projectDir, "src"), ...ptSubDirs.flatMap(d => [path.join(projectDir, d), path.join(projectDir, d, "public"), path.join(projectDir, d, "src")])];
            return dirs.some(d => { try { return fs.existsSync(path.join(d, "index.html")); } catch { return false; } });
          })();
          const hasWebConfig = (() => {
            const dirs = [projectDir, effectiveProjectDir, ...ptSubDirs.map(d => path.join(projectDir, d))];
            const configFiles = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs", "next.config.js", "next.config.mjs", "next.config.ts", "nuxt.config.ts", "nuxt.config.js", "svelte.config.js", "svelte.config.ts", "astro.config.mjs", "astro.config.ts", "webpack.config.js", "webpack.config.ts", "rspack.config.js", "rspack.config.ts", "angular.json"];
            return dirs.some(d => { try { return configFiles.some(f => fs.existsSync(path.join(d, f))); } catch { return false; } });
          })();
          const hasSubdirWebDeps = (() => {
            for (const sub of ptSubDirs) {
              const subPkgPath = path.join(projectDir, sub, "package.json");
              if (fs.existsSync(subPkgPath)) {
                try {
                  const subPkg = JSON.parse(fs.readFileSync(subPkgPath, "utf-8"));
                  const subDeps = { ...(subPkg.dependencies || {}), ...(subPkg.devDependencies || {}) };
                  if (WEB_FRAMEWORKS.some(fw => fw in subDeps)) return true;
                } catch {}
              }
            }
            return false;
          })();
          const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          const hasWebFramework = WEB_FRAMEWORKS.some(fw => fw in allDeps) || hasWebConfig || hasSubdirWebDeps;
          const isCLI = !!(pkg.bin);
          const scripts = pkg.scripts || {};
          const hasOnlyBackend = !hasWebFramework && !hasIndexHtml && (allDeps["express"] || allDeps["fastify"] || allDeps["koa"] || allDeps["hapi"] || allDeps["@hapi/hapi"] || allDeps["nest"] || allDeps["@nestjs/core"]);
          const isPythonProject = !hasPkg && (fs.existsSync(path.join(projectDir, "requirements.txt")) || fs.existsSync(path.join(projectDir, "setup.py")) || fs.existsSync(path.join(projectDir, "pyproject.toml")));
          const isGoProject = !hasPkg && (fs.existsSync(path.join(projectDir, "go.mod")) || fs.existsSync(path.join(projectDir, "main.go")));
          const isRustProject = !hasPkg && fs.existsSync(path.join(projectDir, "Cargo.toml"));
          const isCppProject = !hasPkg && (
            fs.existsSync(path.join(projectDir, "CMakeLists.txt")) ||
            (() => { try { return fs.readdirSync(projectDir).some((f: string) => /\.(sln|vcxproj)$/i.test(f)); } catch { return false; } })() ||
            fs.existsSync(path.join(projectDir, "meson.build")) ||
            (() => { try { return fs.readdirSync(projectDir).some((f: string) => /^Makefile$/i.test(f)); } catch { return false; } })()
          );
          const hasStartScript = scripts.dev || scripts.start || scripts.serve;
          const isNonWebProject = !hasIndexHtml && !hasWebFramework && (isCLI || isPythonProject || isGoProject || isRustProject || isCppProject || (!hasStartScript && !hasOnlyBackend));

          if (isNonWebProject) {
            let launched = false;
            let projectType = isPythonProject ? "python" : isGoProject ? "go" : isRustProject ? "rust" : isCppProject ? "cpp" : isCLI ? "cli" : "terminal";
            let runCmd = "";
            let buildCmd = "";

            let projectMeta: { owner?: string; repo?: string } = {};
            const metaPath = path.join(projectDir, ".lamby-meta.json");
            try { if (fs.existsSync(metaPath)) projectMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8")); } catch {}
            const repoName = projectMeta.repo || name;

            if (isPythonProject) {
              const mainPy = fs.existsSync(path.join(projectDir, "main.py")) ? "main.py" : fs.existsSync(path.join(projectDir, "app.py")) ? "app.py" : fs.readdirSync(projectDir).find((f: string) => f.endsWith(".py")) || "main.py";
              runCmd = isWin ? `python ${mainPy}` : `python3 ${mainPy}`;
            } else if (isGoProject) {
              const goExeName = isWin ? `${repoName}.exe` : repoName;
              buildCmd = `go build -o ${goExeName} .`;
              runCmd = isWin ? goExeName : `./${goExeName}`;
            } else if (isRustProject) {
              buildCmd = "cargo build --release";
              let rustBin = repoName;
              try {
                const cargoToml = fs.readFileSync(path.join(projectDir, "Cargo.toml"), "utf-8");
                const nameMatch = cargoToml.match(/^\s*name\s*=\s*"([^"]+)"/m);
                if (nameMatch) rustBin = nameMatch[1];
              } catch {}
              runCmd = isWin ? `target\\release\\${rustBin}.exe` : `./target/release/${rustBin}`;
            } else if (isCppProject) {
              if (fs.existsSync(path.join(projectDir, "CMakeLists.txt"))) {
                buildCmd = isWin
                  ? `if not exist build mkdir build && cd build && cmake .. && cmake --build . --config Release --parallel`
                  : `mkdir -p build && cd build && cmake .. && cmake --build . --parallel`;
                projectType = "cmake";
              } else if ((() => { try { return fs.readdirSync(projectDir).some((f: string) => f.endsWith(".sln")); } catch { return false; } })()) {
                const slnFile = fs.readdirSync(projectDir).find((f: string) => f.endsWith(".sln"))!;
                buildCmd = isWin
                  ? `msbuild "${slnFile}" /p:Configuration=Release /m`
                  : `echo "Visual Studio .sln requires Windows with MSBuild"`;
                projectType = "msbuild";
              } else if (fs.existsSync(path.join(projectDir, "meson.build"))) {
                buildCmd = isWin
                  ? `if not exist builddir meson setup builddir && meson compile -C builddir`
                  : `meson setup builddir 2>/dev/null || true && meson compile -C builddir`;
                projectType = "meson";
              } else {
                const makefile = (() => { try { return fs.readdirSync(projectDir).find((f: string) => /^Makefile$/i.test(f)); } catch { return null; } })();
                if (makefile) { buildCmd = "make"; projectType = "make"; }
              }
            } else if (isCLI && pkg.bin) {
              const binName = typeof pkg.bin === "string" ? pkg.name : Object.keys(pkg.bin)[0];
              runCmd = `node ${typeof pkg.bin === "string" ? pkg.bin : pkg.bin[binName]}`;
            } else if (pkg.main) {
              runCmd = `node ${pkg.main}`;
            } else if (scripts.start) {
              runCmd = buildPmCommand(pm, "start");
            }
            if (!runCmd && !buildCmd) {
              try {
                const files = fs.readdirSync(projectDir);
                const jsEntry = files.find((f: string) => /^(index|main|app|server|cli)\.(js|ts|mjs|cjs)$/.test(f));
                if (jsEntry) { runCmd = `node ${jsEntry}`; projectType = "node"; }
                else {
                  const pyFile = files.find((f: string) => f.endsWith(".py"));
                  if (pyFile) { runCmd = isWin ? `python ${pyFile}` : `python3 ${pyFile}`; projectType = "python"; }
                  else {
                    const shFile = files.find((f: string) => f.endsWith(".sh"));
                    if (shFile) { runCmd = `bash ${shFile}`; projectType = "shell"; }
                    else {
                      if (fs.existsSync(path.join(projectDir, "Dockerfile"))) { buildCmd = "docker build -t " + repoName + " ."; runCmd = "docker run " + repoName; projectType = "docker"; }
                    }
                  }
                }
              } catch {}
            }

            const findExeInDir = (dir: string, depth = 0): string => {
              if (depth > 3) return "";
              try {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                  const full = path.join(dir, entry.name);
                  if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if ([".exe", ".appimage", ".app"].includes(ext)) return full;
                  } else if (entry.isDirectory() && depth < 3) {
                    const found = findExeInDir(full, depth + 1);
                    if (found) return found;
                  }
                }
              } catch {}
              return "";
            };

            let buildOutput = "";
            let buildSuccess = false;
            if (buildCmd) {
              console.log(`[Preview] Auto-building ${projectType} project ${name}: ${buildCmd}`);
              try {
                const buildCwd = normPath(path.resolve(projectDir));
                const result = execSync(buildCmd, {
                  cwd: buildCwd,
                  timeout: 300000,
                  stdio: "pipe",
                  shell: true,
                  windowsHide: true,
                  env: { ...process.env, MAKEFLAGS: `-j${os.cpus().length || 2}` },
                });
                buildOutput = result.toString().slice(-2000);
                buildSuccess = true;
                console.log(`[Preview] Build succeeded for ${name}`);
                if (!runCmd) {
                  try {
                    const builtExes = findExecutables(projectDir);
                    if (builtExes.length > 0) {
                      const best = builtExes.find(e => e.ext === ".exe") || builtExes[0];
                      runCmd = isWin ? `"${normPath(best.fullPath)}"` : `"${best.fullPath}"`;
                    }
                  } catch {}
                  const BUILD_DIRS = ["build", "builddir", "build/Release", "build/Debug", "Release", "Debug", "out", "bin"];
                  if (!runCmd) {
                    for (const bd of BUILD_DIRS) {
                      const bdPath = path.join(projectDir, bd);
                      if (!fs.existsSync(bdPath)) continue;
                      try {
                        const buildFiles = fs.readdirSync(bdPath);
                        const builtBin = buildFiles.find((f: string) => {
                          const fp = path.join(bdPath, f);
                          try {
                            const stat = fs.statSync(fp);
                            if (!stat.isFile()) return false;
                            if (isWin) return f.endsWith(".exe");
                            return (stat.mode & 0o111) !== 0;
                          } catch { return false; }
                        });
                        if (builtBin) {
                          const builtPath = path.join(bdPath, builtBin);
                          runCmd = isWin ? `"${normPath(builtPath)}"` : `"${builtPath}"`;
                          break;
                        }
                      } catch {}
                    }
                  }
                  if (!runCmd && (projectType === "make" || projectType === "cmake")) {
                    try {
                      const rootFiles = fs.readdirSync(projectDir);
                      const builtBin = rootFiles.find((f: string) => {
                        if (/\.(c|cpp|h|hpp|o|obj|txt|md|json|cmake|sln|vcxproj)$/i.test(f) || /^(Makefile|CMakeLists|README|LICENSE|BUILD|WORKSPACE)$/i.test(f)) return false;
                        const fp = path.join(projectDir, f);
                        try {
                          const stat = fs.statSync(fp);
                          if (!stat.isFile()) return false;
                          if (isWin) return f.endsWith(".exe");
                          return (stat.mode & 0o111) !== 0;
                        } catch { return false; }
                      });
                      if (builtBin) runCmd = isWin ? `"${normPath(path.join(projectDir, builtBin))}"` : `./${builtBin}`;
                    } catch {}
                  }
                }
              } catch (buildErr: any) {
                buildOutput = (buildErr.stderr?.toString() || buildErr.message || "").slice(-2000);
                console.error(`[Preview] Build failed for ${name}: ${buildOutput.slice(0, 300)}`);
              }
            }

            const releasesDir = path.join(projectDir, "_releases");
            let releaseExe = "";
            if (fs.existsSync(releasesDir)) {
              releaseExe = findExeInDir(releasesDir);
            }

            if (!buildSuccess && !runCmd && !releaseExe && projectMeta.owner && projectMeta.repo) {
              console.log(`[Preview] Build failed or no build system — trying GitHub Releases for ${projectMeta.owner}/${projectMeta.repo}...`);
              try {
                const ghToken = process.env.GITHUB_TOKEN || "";
                const relHeaders: Record<string, string> = { "Accept": "application/vnd.github.v3+json", "User-Agent": "Lamby" };
                if (ghToken) relHeaders["Authorization"] = `token ${ghToken}`;
                const relResp = await fetch(`https://api.github.com/repos/${projectMeta.owner}/${projectMeta.repo}/releases/latest`, { headers: relHeaders });
                if (relResp.ok) {
                  const relData: any = await relResp.json();
                  const BINARY_EXTS = [".exe", ".msi", ".appimage", ".dmg", ".deb", ".rpm", ".zip", ".tar.gz", ".7z"];
                  const osPlatform = os.platform();
                  const osArch = os.arch();
                  const platformHints = osPlatform === "win32" ? ["win", "windows"] : osPlatform === "darwin" ? ["mac", "macos", "darwin"] : ["linux"];
                  const goodArchHints = osArch === "arm64" ? ["arm64", "aarch64"] : ["x64", "x86_64", "amd64", "win64"];
                  const badArchHints = osArch === "arm64" ? ["x64", "x86_64", "amd64", "win64"] : ["arm64", "aarch64"];
                  const INSTALLER_KW = ["installer", "setup", "install"];
                  const assets = (relData.assets || [])
                    .filter((a: any) => BINARY_EXTS.some(ext => a.name.toLowerCase().endsWith(ext)))
                    .map((a: any) => {
                      const ln = a.name.toLowerCase();
                      let score = 0;
                      if (platformHints.some(h => ln.includes(h))) score += 20;
                      if (goodArchHints.some(h => ln.includes(h))) score += 10;
                      if (badArchHints.some(h => ln.includes(h))) score -= 15;
                      if (ln.includes("portable")) score += 25;
                      if (INSTALLER_KW.some(h => ln.includes(h))) score -= 5;
                      if (ln.endsWith(".zip")) score += 3;
                      return { ...a, _score: score };
                    })
                    .sort((a: any, b: any) => b._score - a._score);
                  if (assets.length > 0) {
                    const relDir = path.join(projectDir, "_releases");
                    fs.mkdirSync(relDir, { recursive: true });
                    const MAX_DL = 500 * 1024 * 1024;
                    const toDl = assets.filter((a: any) => a.size < MAX_DL).slice(0, 3);
                    for (const asset of toDl) {
                      try {
                        console.log(`[Preview] Downloading release: ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)}MB)...`);
                        const dlResp = await fetch(asset.browser_download_url, { redirect: "follow" });
                        if (dlResp.ok) {
                          const buf = Buffer.from(await dlResp.arrayBuffer());
                          const assetPath = path.join(relDir, asset.name);
                          fs.writeFileSync(assetPath, buf);
                          if (asset.name.toLowerCase().endsWith(".exe") || asset.name.toLowerCase().endsWith(".appimage")) {
                            try { fs.chmodSync(assetPath, 0o755); } catch {}
                          }
                          if (asset.name.toLowerCase().endsWith(".zip")) {
                            try {
                              const extractDir = path.join(relDir, asset.name.replace(/\.zip$/i, ""));
                              fs.mkdirSync(extractDir, { recursive: true });
                              if (isWin) {
                                execSync(`tar xf "${normPath(assetPath)}" -C "${normPath(extractDir)}"`, { timeout: 60000, stdio: "pipe", windowsHide: true, shell: true });
                              } else {
                                execSync(`unzip -o -q "${assetPath}" -d "${extractDir}"`, { timeout: 60000, stdio: "pipe" });
                              }
                            } catch (unzErr: any) {
                              console.log(`[Preview] Could not extract ${asset.name}: ${unzErr.message?.slice(0, 100)}`);
                            }
                          }
                          console.log(`[Preview] Downloaded release asset: ${asset.name}`);
                        }
                      } catch (dlErr: any) {
                        console.log(`[Preview] Download failed for ${asset.name}: ${dlErr.message?.slice(0, 100)}`);
                      }
                    }
                    releaseExe = findExeInDir(relDir);
                  }
                }
              } catch (relErr: any) {
                console.log(`[Preview] GitHub Releases check failed: ${relErr.message?.slice(0, 100)}`);
              }
            }

            if (releaseExe && (!buildSuccess || !runCmd)) {
              console.log(`[Preview] Using release executable: ${releaseExe}`);
              const launched = launchExecutable(releaseExe, name);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                started: false,
                projectType: "precompiled",
                openTerminal: true,
                launched,
                runCommand: `"${releaseExe}"`,
                projectDir,
                ...(buildCmd ? { buildCommand: buildCmd, buildSuccess, buildOutput: buildOutput.slice(0, 1000) } : {}),
                message: launched
                  ? `Launched ${path.basename(releaseExe)}${buildCmd && !buildSuccess ? " (build failed — using precompiled release)" : ""}`
                  : `Found release: ${path.basename(releaseExe)}`,
              }));
              return;
            }

            let fullCmd = buildCmd && runCmd && buildSuccess
              ? runCmd
              : buildCmd && !buildSuccess
                ? buildCmd
                : runCmd || buildCmd;

            if (!fullCmd && !launched) {
              console.log(`[AutoFix] No entry point found for ${name} — attempting full install + re-detect...`);
              try {
                const autoFixPm = detectPackageManager();
                const installCmd2 = buildPmCommand(autoFixPm, "install");
                execSync(installCmd2, { cwd: effectiveProjectDir, timeout: 180000, stdio: "pipe", shell: true, windowsHide: true, env: { ...process.env, HUSKY: "0", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" } });
                console.log(`[AutoFix] Full install completed — re-detecting dev command for ${name}`);
                try {
                  const newPkg = JSON.parse(fs.readFileSync(path.join(effectiveProjectDir, "package.json"), "utf-8"));
                  pkg = newPkg;
                } catch {}
                const reDetected = detectDevCommand();
                if (reDetected.cmd && reDetected.args.length > 0) {
                  fullCmd = `${reDetected.cmd} ${reDetected.args.join(" ")}`;
                  console.log(`[AutoFix] Re-detected dev command after install: ${fullCmd}`);
                  viteErrorHistory.push({
                    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    timestamp: Date.now(), source: "startup-recovery", message: "No runnable entry point — fixed by full install",
                    classified: { category: "no-entry-point", strategy: "full-install-retry", confidence: 0.9, detail: "Auto-recovered" },
                    recovery: { attempted: true, success: true, detail: `Installed deps, found: ${fullCmd}` },
                  });
                }
              } catch (e: any) {
                console.log(`[AutoFix] Full install failed for ${name}: ${e.message?.slice(0, 200)}`);
              }
            }

            if (!fullCmd && buildCmd && !buildSuccess) {
              console.log(`[AutoFix] Build failed for ${name} — clearing artifacts and retrying...`);
              clearViteFrameworkCaches(projectDir);
              const artifactDirs = projectType === "rust" ? ["target"] : projectType === "go" ? ["bin"] : projectType === "cpp" ? ["build", "cmake-build-debug"] : [];
              for (const ad of artifactDirs) {
                const adp = path.join(projectDir, ad);
                if (fs.existsSync(adp)) { try { fs.rmSync(adp, { recursive: true, force: true }); } catch {} }
              }
              try {
                execSync(buildCmd, { cwd: projectDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true });
                buildSuccess = true;
                fullCmd = runCmd || buildCmd;
                console.log(`[AutoFix] Build retry succeeded for ${name}`);
              } catch {}
            }

            console.log(`[Preview] Non-web project ${name} (${projectType}) — cmd: ${fullCmd || 'none'}${buildCmd ? `, build: ${buildSuccess ? 'ok' : 'failed'}` : ''}`);
            const launched2 = fullCmd && !launched ? spawnTerminalWithCommand(projectDir, fullCmd, name) : launched;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              started: false,
              projectType,
              openTerminal: true,
              launched: launched2,
              runCommand: fullCmd,
              projectDir,
              ...(buildCmd ? { buildCommand: buildCmd, buildSuccess, buildOutput: buildOutput.slice(0, 1000) } : {}),
              message: buildSuccess && runCmd
                ? `Build complete — running: ${runCmd}`
                : buildSuccess
                  ? `Build complete${runCmd ? ` — running: ${runCmd}` : ''}`
                  : buildCmd && !buildSuccess
                    ? `Build failed — check build output for errors`
                    : launched2
                      ? `Running: ${fullCmd}`
                      : fullCmd
                        ? `${projectType} project — run: ${fullCmd}`
                        : `No runnable entry point found. Tried: full install + re-detect. Check project structure.`,
            }));
            return;
          }

          const patchPortInEnvFiles = () => {
            const envFiles = [".env", ".env.local", ".env.development", ".env.development.local"];
            const envDirs = effectiveProjectDir !== projectDir ? [effectiveProjectDir, projectDir] : [projectDir];
            for (const envDir of envDirs) {
            for (const envFile of envFiles) {
              const envPath = path.join(envDir, envFile);
              if (!fs.existsSync(envPath)) continue;
              try {
                let content = fs.readFileSync(envPath, "utf-8");
                let changed = false;
                if (/^PORT\s*=/m.test(content)) {
                  content = content.replace(/^PORT\s*=.*/m, `PORT=${port}`);
                  changed = true;
                }
                if (/^HOST\s*=/m.test(content)) {
                  content = content.replace(/^HOST\s*=.*/m, `HOST=0.0.0.0`);
                  changed = true;
                }
                if (changed) {
                  fs.writeFileSync(envPath, content);
                  console.log(`[Preview] Patched port/host in ${envFile} for ${name}`);
                }
              } catch {}
            }
            }
          };
          patchPortInEnvFiles();

          const patchViteConfig = async () => {
            const viteConfigNames = ["vite.config.ts", "vite.config.js", "vite.config.mjs"];
            const vcDirs = effectiveProjectDir !== projectDir ? [effectiveProjectDir, projectDir] : [projectDir];
            for (const vcDir of vcDirs) {
            for (const vcName of viteConfigNames) {
              const vcPath = path.join(vcDir, vcName);
              if (!fs.existsSync(vcPath)) continue;
              try {
                let content = fs.readFileSync(vcPath, "utf-8");
                let changed = false;

                const isLibraryMode = /build\s*:\s*\{[\s\S]*?lib\s*:/m.test(content);
                if (isLibraryMode) {
                  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}), ...(pkg.peerDependencies || {}) };
                  const hasReact = !!allDeps["react"];
                  const hasVue = !!allDeps["vue"];
                  const hasSvelte = !!allDeps["svelte"];
                  const hasReactPlugin = content.includes("plugin-react");
                  const hasVuePlugin = content.includes("plugin-vue");

                  if (hasReact && !hasReactPlugin) {
                    const pluginPkg = "@vitejs/plugin-react";
                    try {
                      const { execSync: es } = await import("child_process");
                      const missingLibPkgs: string[] = [];
                      if (!fs.existsSync(path.join(vcDir, "node_modules", "@vitejs/plugin-react")) && !fs.existsSync(path.join(effectiveProjectDir, "node_modules", "@vitejs/plugin-react"))) missingLibPkgs.push(pluginPkg);
                      if (!fs.existsSync(path.join(vcDir, "node_modules", "react-dom")) && !fs.existsSync(path.join(effectiveProjectDir, "node_modules", "react-dom"))) missingLibPkgs.push("react-dom");
                      if (!fs.existsSync(path.join(vcDir, "node_modules", "react")) && !fs.existsSync(path.join(effectiveProjectDir, "node_modules", "react"))) missingLibPkgs.push("react");
                      if (missingLibPkgs.length > 0) {
                        console.log(`[Preview] Library-mode config for ${name}, installing: ${missingLibPkgs.join(", ")}`);
                        const installCmd = buildPmCommand(pm, "add-dev", missingLibPkgs.join(" "));
                        es(installCmd, { cwd: effectiveProjectDir, timeout: 60000, stdio: "pipe", shell: true, windowsHide: true });
                      }
                    } catch (e: any) {
                      console.log(`[Preview] Failed to install lib-mode deps: ${e.message?.slice(0, 150)}`);
                    }
                    content = `import { defineConfig } from 'vite'\nimport react from '${pluginPkg}'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n`;
                    changed = true;
                    console.log(`[Preview] Rewrote library-mode ${vcName} to dev-mode with React plugin for ${name}`);
                  } else if (hasVue && !hasVuePlugin) {
                    content = `import { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\n\nexport default defineConfig({\n  plugins: [vue()],\n})\n`;
                    changed = true;
                    console.log(`[Preview] Rewrote library-mode ${vcName} to dev-mode with Vue plugin for ${name}`);
                  } else if (!hasReact && !hasVue && !hasSvelte) {
                    content = `import { defineConfig } from 'vite'\n\nexport default defineConfig({})\n`;
                    changed = true;
                    console.log(`[Preview] Rewrote library-mode ${vcName} to dev-mode for ${name}`);
                  }
                }

                if (!changed && /configureServer\s*\(/.test(content)) {
                  const usesSwc = content.includes("plugin-react-swc");
                  const reactImport = usesSwc ? "react from '@vitejs/plugin-react-swc'" : "react from '@vitejs/plugin-react'";
                  const aliasMatch = content.match(/["']@["']\s*:\s*path\.resolve\([^)]+\)/);
                  const aliasBlock = aliasMatch ? `\n  resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n      "@shared": path.resolve(__dirname, "./shared"),\n      "@assets": path.resolve(__dirname, "./attached_assets"),\n    },\n  },` : "";
                  const mainPort = 5000;
                  content = `import { defineConfig } from "vite";\nimport ${reactImport};\nimport path from "path";\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    host: "0.0.0.0",\n    port: ${port},\n    allowedHosts: true,\n    proxy: {\n      "/api": {\n        target: "http://localhost:${mainPort}",\n        changeOrigin: true,\n        secure: false,\n      },\n    },\n  },${aliasBlock}\n});\n`;
                  changed = true;
                  console.log(`[Preview] Replaced server-middleware vite config with minimal config for ${name}`);
                }

                if (!changed) {
                  const portMatch = content.match(/port\s*:\s*(\d+)/);
                  if (portMatch && portMatch[1] !== String(port)) {
                    content = content.replace(/port\s*:\s*\d+/, `port: ${port}`);
                    changed = true;
                  }
                  if (/host\s*:\s*['"]localhost['"]/.test(content)) {
                    content = content.replace(/host\s*:\s*['"]localhost['"]/, `host: '0.0.0.0'`);
                    changed = true;
                  }
                  if (/open\s*:\s*true/.test(content)) {
                    content = content.replace(/open\s*:\s*true/g, "open: false");
                    changed = true;
                  }
                }

                if (changed) {
                  fs.writeFileSync(vcPath, content);
                  console.log(`[Preview] Patched ${vcName} for ${name}`);
                }
              } catch {}
            }
            }
          };
          await patchViteConfig();

          const ensureESMCompat = (dir: string) => {
            const pkgJsonPath = path.join(dir, "package.json");
            if (!fs.existsSync(pkgJsonPath)) return;
            try {
              const pkgRaw = fs.readFileSync(pkgJsonPath, "utf-8");
              const pkgObj = JSON.parse(pkgRaw);
              if (pkgObj.type === "module") return;
              for (const vcName of ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"]) {
                const vcPath = path.join(dir, vcName);
                if (!fs.existsSync(vcPath)) continue;
                const vcContent = fs.readFileSync(vcPath, "utf-8");
                if (/^\s*import\s+/m.test(vcContent) || /^\s*export\s+default/m.test(vcContent)) {
                  pkgObj.type = "module";
                  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgObj, null, 2), "utf-8");
                  console.log(`[Preview] Added "type":"module" to ${name}/${path.relative(projectDir, pkgJsonPath)} (vite config uses ESM imports)`);
                  if (pkgObj === pkg) pkg.type = "module";

                  for (const cfgName of ["postcss.config.js", "postcss.config.ts", "tailwind.config.js", "tailwind.config.ts"]) {
                    const cfgPath = path.join(dir, cfgName);
                    if (!fs.existsSync(cfgPath)) continue;
                    try {
                      const cfgContent = fs.readFileSync(cfgPath, "utf-8");
                      if (cfgContent.includes("module.exports") || cfgContent.includes("require(")) {
                        const newName = cfgName.replace(/\.(js|ts)$/, ".cjs");
                        fs.renameSync(cfgPath, path.join(dir, newName));
                        console.log(`[Preview] Renamed ${cfgName} -> ${newName} (CJS syntax in ESM project)`);
                      }
                    } catch {}
                  }
                  break;
                }
              }
            } catch {}
          };
          ensureESMCompat(effectiveProjectDir);
          if (effectiveProjectDir !== projectDir) ensureESMCompat(projectDir);

          const fixPostCSSAndTailwind = async () => {
            const isESM = pkg.type === "module";
            const dirsToCheck = [effectiveProjectDir];
            if (effectiveProjectDir !== projectDir) dirsToCheck.push(projectDir);
            const postcssConfigs = ["postcss.config.js", "postcss.config.mjs", "postcss.config.cjs"];
            for (const baseDir of dirsToCheck) {
              for (const pcName of postcssConfigs) {
                const pcPath = path.join(baseDir, pcName);
                if (!fs.existsSync(pcPath)) continue;
                try {
                  const content = fs.readFileSync(pcPath, "utf-8");
                  if (isESM && content.includes("module.exports") && !pcName.endsWith(".cjs")) {
                    const newName = pcName.replace(/\.(js|ts|mjs)$/, ".cjs");
                    const newPath = path.join(baseDir, newName);
                    fs.renameSync(pcPath, newPath);
                    console.log(`[Preview] Renamed ${pcName} -> ${newName} (ESM project uses module.exports)`);
                  }
                  if (!isESM && content.includes("export default") && !pcName.endsWith(".mjs")) {
                    const newName = pcName.replace(/\.(js|ts|cjs)$/, ".mjs");
                    const newPath = path.join(baseDir, newName);
                    fs.renameSync(pcPath, newPath);
                    console.log(`[Preview] Renamed ${pcName} -> ${newName} (CJS project uses export default)`);
                  }
                  const refsTailwind = content.includes("tailwindcss");
                  const refsAutoprefixer = content.includes("autoprefixer");
                  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                  const missingPkgs: string[] = [];
                  if (refsTailwind && !allDeps["tailwindcss"]) missingPkgs.push("tailwindcss");
                  if (refsAutoprefixer && !allDeps["autoprefixer"]) missingPkgs.push("autoprefixer");
                  if (missingPkgs.length > 0) {
                    try {
                      const { execSync: es } = await import("child_process");
                      const installCmd = buildPmCommand(pm, "add-dev", missingPkgs.join(" "));
                      console.log(`[Preview] Installing missing PostCSS deps: ${missingPkgs.join(", ")}`);
                      es(installCmd, { cwd: effectiveProjectDir, timeout: 60000, stdio: "pipe", shell: true, windowsHide: true });
                    } catch (e: any) {
                      console.log(`[Preview] PostCSS dep install warning: ${e.message?.slice(0, 200)}`);
                    }
                  }
                } catch {}
              }
            }
            const tailwindConfigs = ["tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs"];
            for (const baseDir of dirsToCheck) {
              for (const twName of tailwindConfigs) {
                const twPath = path.join(baseDir, twName);
                if (!fs.existsSync(twPath)) continue;
                try {
                  const content = fs.readFileSync(twPath, "utf-8");
                  if (isESM && content.includes("module.exports") && !twName.endsWith(".cjs")) {
                    const newName = twName.replace(/\.(js|ts|mjs)$/, ".cjs");
                    fs.renameSync(twPath, path.join(baseDir, newName));
                    console.log(`[Preview] Renamed ${twName} -> ${newName} (ESM compat)`);
                  }
                } catch {}
              }
            }
          };
          await fixPostCSSAndTailwind();

          let devCmd = detectDevCommand();
          console.log(`[Preview] Starting ${name} with: ${devCmd.cmd} ${devCmd.args.join(" ")}`);

          const isPnpmMonorepo = fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"));
          if (isPnpmMonorepo) {
            const scripts = pkg.scripts || {};
            const buildScript = scripts["packages:build"] || scripts.build;
            if (buildScript && (buildScript.includes("--filter") || buildScript.includes("packages"))) {
              const buildKey = scripts["packages:build"] ? "packages:build" : "build";
              console.log(`[Preview] Pre-building pnpm monorepo packages with: pnpm run ${buildKey}`);
              try {
                const { execSync: execSyncBuild } = await import("child_process");
                execSyncBuild(`pnpm run ${buildKey}`, { cwd: projectDir, stdio: "pipe", timeout: 90000, windowsHide: true });
                console.log(`[Preview] Monorepo packages built successfully`);
              } catch (e: any) {
                console.log(`[Preview] Monorepo package build warning: ${e.message?.slice(0, 200)}`);
              }
            }
          }

          const consoleBridgeScript = `<script data-lamby-console-bridge>
(function() {
  if (window.__lambyConsoleBridge) return;
  window.__lambyConsoleBridge = true;
  var origLog = console.log, origWarn = console.warn, origError = console.error, origInfo = console.info;
  function send(level, args, stack) {
    try {
      var serialized = [];
      for (var i = 0; i < args.length; i++) {
        try { serialized.push(typeof args[i] === 'object' ? JSON.parse(JSON.stringify(args[i])) : args[i]); }
        catch(e) { serialized.push(String(args[i])); }
      }
      window.parent.postMessage({ type: 'lamby-console-bridge', level: level, args: serialized, stack: stack || null }, '*');
    } catch(e) {}
  }
  console.log = function() { send('log', Array.prototype.slice.call(arguments)); origLog.apply(console, arguments); };
  console.warn = function() { send('warn', Array.prototype.slice.call(arguments)); origWarn.apply(console, arguments); };
  console.error = function() { send('error', Array.prototype.slice.call(arguments)); origError.apply(console, arguments); };
  console.info = function() { send('info', Array.prototype.slice.call(arguments)); origInfo.apply(console, arguments); };
  window.onerror = function(msg, source, line, column, error) {
    send('error', [String(msg)], error && error.stack ? error.stack : null);
    return false;
  };
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason;
    var msg = reason instanceof Error ? reason.message : String(reason);
    var stack = reason instanceof Error ? reason.stack : null;
    send('error', ['Unhandled Promise Rejection: ' + msg], stack);
  });
  var moduleErrors = [];
  var origCreateElement = document.createElement;
  document.createElement = function(tag) {
    var el = origCreateElement.call(document, tag);
    if (tag === 'script') {
      el.addEventListener('error', function(e) {
        var src = el.src || el.getAttribute('src') || 'unknown';
        moduleErrors.push(src);
        send('error', ['[Lamby] Failed to load script: ' + src]);
      });
    }
    return el;
  };
  function extractOverlayContent(el) {
    try {
      var root = el.shadowRoot || el;
      var text = '';
      var msgEl = root.querySelector('.message-body, .message, [class*="message"], pre');
      if (msgEl) text = msgEl.textContent || '';
      if (!text) {
        var preEls = root.querySelectorAll('pre, code');
        for (var p = 0; p < preEls.length; p++) { text += (preEls[p].textContent || '') + '\\n'; }
      }
      if (!text) {
        text = root.textContent || el.textContent || '';
      }
      return text.trim().substring(0, 4000);
    } catch(e) { return ''; }
  }
  function checkOverlays() {
    try {
      var selectors = ['vite-error-overlay', 'nextjs-portal', '#webpack-dev-server-client-overlay'];
      for (var s = 0; s < selectors.length; s++) {
        var els = document.querySelectorAll(selectors[s]);
        for (var i = 0; i < els.length; i++) {
          if (els[i].__lambyReported) continue;
          els[i].__lambyReported = true;
          var content = extractOverlayContent(els[i]);
          if (content) {
            send('error', ['[Lamby] Error overlay detected (' + selectors[s] + '):\\n' + content]);
          } else {
            send('error', ['[Lamby] Error overlay detected (' + selectors[s] + ') but could not extract content.']);
          }
        }
      }
    } catch(e) {}
  }
  try {
    var overlayObserver = new MutationObserver(function() { checkOverlays(); });
    overlayObserver.observe(document.documentElement, { childList: true, subtree: true });
  } catch(e) {}
  setTimeout(function() {
    checkOverlays();
    try {
      var root = document.getElementById('root') || document.getElementById('app');
      if (root && root.children.length === 0 && root.textContent.trim() === '') {
        var diag = '[Lamby] Blank screen detected — root element exists but has no rendered content after 5s.';
        if (moduleErrors.length > 0) diag += ' Failed scripts: ' + moduleErrors.join(', ');
        var viteErrors = document.querySelectorAll('vite-error-overlay');
        if (viteErrors.length > 0) diag += ' Vite error overlay is showing.';
        send('warn', [diag]);
      }
      if (!root) {
        var body = document.body;
        var visibleText = body ? body.innerText.trim() : '';
        if (visibleText.length === 0) {
          send('warn', ['[Lamby] Blank screen detected — no visible content on page after 5s. Check that index.html has the correct root element and entry script.']);
        }
      }
    } catch(e) {}
  }, 5000);
})();
</script>`;

          const indexHtmlPaths = [
            path.join(projectDir, "index.html"),
            path.join(projectDir, "public", "index.html"),
            path.join(projectDir, "src", "index.html"),
            ...SUBDIR_CANDIDATES.map(d => path.join(projectDir, d, "index.html")),
            ...SUBDIR_CANDIDATES.map(d => path.join(projectDir, d, "public", "index.html")),
            ...SUBDIR_CANDIDATES.map(d => path.join(projectDir, d, "src", "index.html")),
          ];
          const previewPathFixScript = `<script data-lamby-preview-path>if(window.location.pathname.match(/^\\/__preview\\/\\d+/)){window.history.replaceState(null,'',window.location.pathname.replace(/^\\/__preview\\/\\d+\\/?/,'/')+window.location.search+window.location.hash)}</script>`;
          for (const indexHtmlPath of indexHtmlPaths) {
            if (fs.existsSync(indexHtmlPath)) {
              let indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
              let injected = false;
              if (!indexHtml.includes("lamby-console-bridge")) {
                indexHtml = indexHtml.replace(/<head([^>]*)>/, `<head$1>\n${consoleBridgeScript}`);
                injected = true;
              }
              if (!indexHtml.includes("lamby-preview-path")) {
                indexHtml = indexHtml.replace(/<head([^>]*)>/, `<head$1>\n${previewPathFixScript}`);
                injected = true;
              }
              if (injected) {
                fs.writeFileSync(indexHtmlPath, indexHtml, "utf-8");
                console.log(`[Preview] Injected console bridge into ${name}/${path.relative(projectDir, indexHtmlPath)}`);
              }
            }
          }

          for (const indexHtmlPath of indexHtmlPaths) {
            if (fs.existsSync(indexHtmlPath)) {
              try {
                const indexContent = fs.readFileSync(indexHtmlPath, "utf-8");
                const scriptMatch = indexContent.match(/src=["']\/?(src\/[^"']+\.tsx?)["']/);
                if (scriptMatch) {
                  const indexDir = path.dirname(indexHtmlPath);
                  const entryFile = path.join(indexDir, scriptMatch[1]);
                  if (!fs.existsSync(entryFile)) {
                    const entryDir = path.dirname(entryFile);
                    if (!fs.existsSync(entryDir)) fs.mkdirSync(entryDir, { recursive: true });
                    const ext = entryFile.endsWith(".tsx") ? "tsx" : "ts";
                    if (ext === "tsx") {
                      fs.writeFileSync(entryFile, `import { createRoot } from "react-dom/client";\n\nfunction App() {\n  return (\n    <div style={{ fontFamily: "system-ui", padding: 32, textAlign: "center" }}>\n      <h1>Project Ready</h1>\n      <p>Edit <code>${scriptMatch[1]}</code> to get started.</p>\n    </div>\n  );\n}\n\ncreateRoot(document.getElementById("root")!).render(<App />);\n`);
                    } else {
                      fs.writeFileSync(entryFile, `document.getElementById("root")!.innerHTML = "<h1>Project Ready</h1><p>Edit <code>${scriptMatch[1]}</code> to start.</p>";\n`);
                    }
                    console.log(`[Preview] Created missing entry point ${scriptMatch[1]} for ${name}`);
                  }
                }
              } catch {}
              break;
            }
          }

          let hasTsconfigPaths = false;
          const tscfgDirs = effectiveProjectDir !== projectDir ? [effectiveProjectDir, projectDir] : [projectDir];
          for (const tscfgDir of tscfgDirs) {
          for (const tscfg of ["tsconfig.json", "tsconfig.app.json"]) {
            const tscfgPath = path.join(tscfgDir, tscfg);
            if (fs.existsSync(tscfgPath)) {
              try {
                const raw = fs.readFileSync(tscfgPath, "utf-8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/,\s*([\]}])/g, "$1");
                const parsed = JSON.parse(raw);
                const co = parsed.compilerOptions || {};
                if (co.baseUrl || co.paths) hasTsconfigPaths = true;
              } catch {}
              break;
            }
          }
          }

          const viteConfigDirs = [projectDir, ...SUBDIR_CANDIDATES.map(d => path.join(projectDir, d))];
          for (const viteDir of viteConfigDirs) {
            if (!fs.existsSync(viteDir)) continue;
            for (const cfgName of ["vite.config.ts", "vite.config.js", "vite.config.mjs"]) {
              const viteConfigPath = path.join(viteDir, cfgName);
              if (fs.existsSync(viteConfigPath)) {
                const viteConfigContent = fs.readFileSync(viteConfigPath, "utf-8");
                let content = viteConfigContent;
                if (!content.includes("usePolling")) {
                  const hasServerBlock = /server\s*:\s*\{/.test(content);
                  if (hasServerBlock) {
                    content = content.replace(
                      /server\s*:\s*\{/,
                      `server: {\n    watch: {\n      usePolling: true,\n      interval: 500,\n    },`
                    );
                  } else {
                    content = content.replace(
                      /defineConfig\(\{/,
                      `defineConfig({\n  server: {\n    watch: {\n      usePolling: true,\n      interval: 500,\n    },\n  },`
                    );
                  }
                  if (content !== viteConfigContent) {
                    console.log(`[Preview] Patched ${name}/${path.relative(projectDir, viteConfigPath)} with usePolling`);
                  }
                }
                if (/base:\s*["']\/[^"']+["']/.test(content)) {
                  content = content.replace(/\s*base:\s*["']\/[^"']+["'],?\n?/g, "\n");
                  console.log(`[Preview] Removed custom base path from ${name}/${path.relative(projectDir, viteConfigPath)}`);
                }
                if (!/hmr\s*:/.test(content)) {
                  if (/server\s*:\s*\{/.test(content)) {
                    content = content.replace(/server\s*:\s*\{/, `server: {\n    hmr: { overlay: true },`);
                  } else {
                    content = content.replace(/defineConfig\(\{/, `defineConfig({\n  server: { hmr: { overlay: true } },`);
                  }
                  console.log(`[Preview] Ensured HMR error overlay enabled for ${name}/${path.relative(projectDir, viteConfigPath)}`);
                }

                const cssFiles = ["globals.css", "index.css", "global.css", "app.css", "style.css"];
                const cssDirs = [path.join(viteDir, "src"), path.join(viteDir, "src", "style"), path.join(viteDir, "src", "styles"), path.join(viteDir, "src", "css"), path.join(viteDir, "app")];
                for (const cssDir of cssDirs) {
                  if (!fs.existsSync(cssDir)) continue;
                  for (const cssName of cssFiles) {
                    const cssPath = path.join(cssDir, cssName);
                    if (!fs.existsSync(cssPath)) continue;
                    try {
                      let css = fs.readFileSync(cssPath, "utf-8");
                      if (/@layer\s+base\s*\{[\s\S]*?@apply\s/.test(css)) {
                        css = css.replace(/@layer\s+base\s*\{[\s\S]*?\n\}/g, (block: string) => {
                          return block
                            .replace(/@apply\s+border-border\s*;/g, "border-color: var(--color-border, hsl(var(--border)));")
                            .replace(/@apply\s+bg-background\s+text-foreground\s*;/g,
                              "background-color: var(--color-background, hsl(var(--background)));\n    color: var(--color-foreground, hsl(var(--foreground)));")
                            .replace(/@apply\s+bg-background\s*;/g, "background-color: var(--color-background, hsl(var(--background)));")
                            .replace(/@apply\s+text-foreground\s*;/g, "color: var(--color-foreground, hsl(var(--foreground)));");
                        });
                        fs.writeFileSync(cssPath, css);
                        console.log(`[Preview] Patched @apply in @layer base for ${name}/${path.relative(projectDir, cssPath)}`);
                      }
                    } catch {}
                  }
                }

                if (hasTsconfigPaths && !content.includes("tsconfigPaths") && !content.includes("tsconfig-paths")) {
                  const tspPkgInstalled = fs.existsSync(path.join(viteDir, "node_modules", "vite-tsconfig-paths")) || fs.existsSync(path.join(projectDir, "node_modules", "vite-tsconfig-paths"));
                  if (!tspPkgInstalled) {
                    try {
                      const installCmd = buildPmCommand(pm, "add-dev", "vite-tsconfig-paths");
                      execSync(installCmd, { cwd: viteDir, timeout: 60000, stdio: "pipe", shell: true, windowsHide: true, env: safeInstallEnv });
                      console.log(`[Preview] Installed vite-tsconfig-paths for ${name}`);
                    } catch (installErr: any) {
                      console.log(`[Preview] Could not install vite-tsconfig-paths for ${name}: ${installErr.message?.slice(0, 100)}`);
                    }
                  }
                  if (fs.existsSync(path.join(viteDir, "node_modules", "vite-tsconfig-paths")) || fs.existsSync(path.join(projectDir, "node_modules", "vite-tsconfig-paths"))) {
                    const importLine = `import tsconfigPaths from 'vite-tsconfig-paths'\n`;
                    const pluginsMatch = content.match(/plugins\s*:\s*\[/);
                    if (pluginsMatch) {
                      content = importLine + content;
                      content = content.replace(/plugins\s*:\s*\[/, `plugins: [tsconfigPaths(), `);
                      console.log(`[Preview] Added tsconfigPaths plugin to ${name}/${path.relative(projectDir, viteConfigPath)}`);
                    }
                  }
                }

                if (content !== viteConfigContent) {
                  fs.writeFileSync(viteConfigPath, content, "utf-8");
                }
              }
            }
          }

          for (const rspackCfg of ["rspack.config.js", "rspack.config.ts"]) {
            const rspackPath = path.join(projectDir, rspackCfg);
            if (fs.existsSync(rspackPath)) {
              try {
                let rsContent = fs.readFileSync(rspackPath, "utf-8");
                let changed = false;
                const portMatch = rsContent.match(/port:\s*(\d+)/);
                if (portMatch && portMatch[1] !== String(port)) {
                  rsContent = rsContent.replace(/port:\s*\d+/, `port: ${port}`);
                  changed = true;
                }
                if (rsContent.includes("devServer") && !rsContent.includes("host:")) {
                  rsContent = rsContent.replace(/(devServer:\s*\{)/, `$1\n    host: '0.0.0.0',`);
                  changed = true;
                } else if (rsContent.includes("host:") && !rsContent.includes("0.0.0.0")) {
                  rsContent = rsContent.replace(/host:\s*['"][^'"]*['"]/, `host: '0.0.0.0'`);
                  changed = true;
                }
                if (changed) {
                  fs.writeFileSync(rspackPath, rsContent, "utf-8");
                  console.log(`[Preview] Patched ${name}/${rspackCfg} with port ${port} and host 0.0.0.0`);
                }
              } catch {}
              break;
            }
          }

          const nodeVer = parseInt(process.versions.node.split(".")[0], 10);
          if (nodeVer < 22) {
            const iterMethods = "filter|map|find|some|every|reduce|forEach|flatMap|toSorted";
            const iterRe = new RegExp(`(\\b[a-zA-Z_$][a-zA-Z0-9_$]*)\\.(values|keys|entries)\\(\\)\\.(${iterMethods})\\(`, "g");
            const patchIteratorHelpers = (dir: string) => {
              try {
                const files = fs.readdirSync(dir);
                for (const f of files) {
                  if (!f.endsWith(".js") && !f.endsWith(".mjs") && !f.endsWith(".cjs")) continue;
                  const fp = path.join(dir, f);
                  try {
                    const src = fs.readFileSync(fp, "utf-8");
                    if (iterRe.test(src)) {
                      iterRe.lastIndex = 0;
                      const patched = src.replace(iterRe, (_match: string, varName: string, iterMethod: string, arrayMethod: string) => {
                        return `Array.from(${varName}.${iterMethod}()).${arrayMethod}(`;
                      });
                      if (patched !== src) {
                        fs.writeFileSync(fp, patched, "utf-8");
                        console.log(`[Preview] Patched Node 22+ iterator helpers in ${name}/${path.relative(projectDir, fp)}`);
                      }
                    }
                  } catch {}
                }
              } catch {}
            };
            const vrDist = path.join(projectDir, "node_modules", "vue-router", "dist");
            if (fs.existsSync(vrDist)) patchIteratorHelpers(vrDist);
            const pnpmVR = path.join(projectDir, "node_modules", ".pnpm");
            if (fs.existsSync(pnpmVR)) {
              try {
                const pnpmDirs = fs.readdirSync(pnpmVR).filter((d: string) => d.startsWith("vue-router@"));
                for (const d of pnpmDirs) {
                  const dist = path.join(pnpmVR, d, "node_modules", "vue-router", "dist");
                  if (fs.existsSync(dist)) patchIteratorHelpers(dist);
                }
              } catch {}
            }
          }

          const pathSep = isWin ? ";" : ":";
          const binDirs: string[] = [];
          binDirs.push(path.join(effectiveProjectDir, "node_modules", ".bin"));
          if (effectiveProjectDir !== projectDir) {
            binDirs.push(path.join(projectDir, "node_modules", ".bin"));
          }
          const isolatedPath = binDirs.join(pathSep) + pathSep + (process.env.PATH || process.env.Path || "");

          const nodePaths: string[] = [path.join(effectiveProjectDir, "node_modules")];
          if (effectiveProjectDir !== projectDir) {
            nodePaths.push(path.join(projectDir, "node_modules"));
          }

          const portEnv: Record<string, string> = {
            ...process.env as Record<string, string>,
            BROWSER: "none",
            PORT: String(port),
            HOST: "0.0.0.0",
            HOSTNAME: "0.0.0.0",
            PATH: isolatedPath,
            NODE_PATH: nodePaths.join(pathSep),
            CHOKIDAR_USEPOLLING: "true",
          };
          if (isWin && portEnv.Path) { delete portEnv.Path; }

          const isReactScripts = devCmd.args.includes("react-scripts");
          if (isReactScripts) {
            portEnv.PORT = String(port);
            portEnv.HOST = "0.0.0.0";
            portEnv.SKIP_PREFLIGHT_CHECK = "true";
            portEnv.PUBLIC_URL = "";
            portEnv.NODE_OPTIONS = (portEnv.NODE_OPTIONS || "") + " --openssl-legacy-provider";
            try {
              const pkgPath = path.join(projectDir, "package.json");
              const pkgRaw = fs.readFileSync(pkgPath, "utf-8");
              const pkgObj = JSON.parse(pkgRaw);
              if (pkgObj.homepage) {
                delete pkgObj.homepage;
                fs.writeFileSync(pkgPath, JSON.stringify(pkgObj, null, 2));
                console.log(`[Preview] Removed homepage from ${name}/package.json for correct dev serving`);
              }
            } catch {}
          }

          const isWebpackDirect = devCmd.args.includes("webpack") || devCmd.args.includes("webpack-dev-server") || devCmd.args.includes("vue-cli-service");
          if (isWebpackDirect && !isReactScripts) {
            portEnv.NODE_OPTIONS = (portEnv.NODE_OPTIONS || "") + " --openssl-legacy-provider";
          }

          const isNextDev = devCmd.args.includes("next");
          if (isNextDev) {
            portEnv.HOSTNAME = "0.0.0.0";
            patchNextConfig(effectiveProjectDir);
            const nextLockPath = path.join(projectDir, ".next", "dev", "lock");
            try { if (fs.existsSync(nextLockPath)) { fs.unlinkSync(nextLockPath); console.log(`[Preview] Removed stale .next/dev/lock for ${name}`); } } catch {}
          }

          devCmd = resolveLocalBin(devCmd, effectiveProjectDir);
          if (devCmd.cmd !== "npx") console.log(`[Preview] Using local binary for ${name}: ${devCmd.cmd}`);

          const postcssConfigs = ["postcss.config.js", "postcss.config.cjs", "postcss.config.mjs", "postcss.config.ts", ".postcssrc", ".postcssrc.js", ".postcssrc.json"];
          const hasOwnPostcss = postcssConfigs.some(f => fs.existsSync(path.join(effectiveProjectDir, f)));
          if (!hasOwnPostcss) {
            try {
              fs.writeFileSync(path.join(effectiveProjectDir, "postcss.config.cjs"), "module.exports = { plugins: {} };\n");
              console.log(`[Preview] Created empty postcss.config.cjs for ${name} to isolate from parent`);
            } catch {}
          }

          const child = spawn(devCmd.cmd, devCmd.args, {
            cwd: effectiveProjectDir,
            stdio: "pipe",
            shell: true,
            detached: !isWin,
            windowsHide: true,
            env: portEnv,
          });
          if (!isWin) child.unref();

          let startupOutput = "";
          let serverReady = false;
          const startupErrors: string[] = [];
          const logBuf = { stdout: "", stderr: "" };

          const collectOutput = (data: Buffer, isStderr?: boolean) => {
            const text = data.toString();
            startupOutput += text;
            if (isStderr) {
              logBuf.stderr += text;
              if (logBuf.stderr.length > 20000) logBuf.stderr = logBuf.stderr.slice(-10000);
            } else {
              logBuf.stdout += text;
              if (logBuf.stdout.length > 20000) logBuf.stdout = logBuf.stdout.slice(-10000);
            }
            console.log(`[Preview:${name}] ${text.trim()}`);
            if (/ready|VITE.*ready|compiled|started server|listening|Local:|Successfully compiled/i.test(text)) {
              serverReady = true;
            }
            if (/error|ERR!|Cannot find|MODULE_NOT_FOUND|SyntaxError|ENOENT|EADDRINUSE|ERESOLVE|EINTEGRITY|ENOMEM|ERR_REQUIRE_ESM|ERR_OSSL_EVP/i.test(text)) {
              startupErrors.push(text.trim().slice(0, 300));
            }
            if (serverReady && /does not provide an export|Failed to resolve import|Pre-transform error|Internal server error|Cannot read propert.*postcss|ERR_PACKAGE_PATH_NOT_EXPORTED|Circular dependency|ERESOLVE|EINTEGRITY|ENOENT.*node_modules|ERR_MODULE_NOT_FOUND|ERR_REQUIRE_ESM|ERR_OSSL_EVP|ENOSPC.*inotify|EMFILE|ENOMEM|heap out of memory|EADDRINUSE|TS2307|tsconfig.*error|angular.*mismatch|ECONNREFUSED|\.env.*not found|CORS.*blocked|timed? ?out|ETIMEDOUT|exited with code [1-9]/i.test(text)) {
              const classified = classifyViteError(text);
              if (classified.confidence >= 0.8 && !isViteRateLimited(text)) {
                recordViteAttempt(text);
                console.log(`[AutoFix] Live error in preview ${name}: [${classified.category}] — executing recovery...`);

                let liveRecovery = { attempted: false, success: false, detail: "No auto-fix available" };
                const projDir = path.resolve(process.cwd(), "projects", name);

                if (classified.strategy === "restart-vite" || classified.strategy === "clear-cache-restart") {
                  const entry = previewProcesses.get(name);
                  if (entry) {
                    try { entry.process.kill("SIGTERM"); } catch {}
                    previewProcesses.delete(name);
                  }
                  if (classified.strategy === "clear-cache-restart") {
                    clearViteFrameworkCaches(projDir);
                  }
                  liveRecovery = { attempted: true, success: true, detail: `Preview killed for restart (${classified.strategy})` };
                  console.log(`[AutoFix] Killed preview ${name} — will auto-restart on next request`);
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "npm-install" || classified.strategy === "legacy-peer-deps" || classified.strategy === "full-reinstall") {
                  liveRecovery = { attempted: true, success: true, detail: "Queued install + preview restart" };
                  (async () => {
                    try {
                      const { execSync: es3 } = await import("child_process");
                      const installSteps = buildInstallCascade(pm);
                      let installOk = false;
                      for (const cmd of installSteps) {
                        try { es3(cmd, { cwd: projDir, timeout: 120000, stdio: "pipe" }); installOk = true; break; } catch {}
                      }
                      if (installOk) {
                        const entry2 = previewProcesses.get(name);
                        if (entry2) { try { entry2.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                        console.log(`[AutoFix] Install completed for ${name}`);
                        scheduleViteAutoRestart(name, projDir, String(port));
                      } else {
                        console.log(`[AutoFix] All install strategies failed for ${name}`);
                      }
                    } catch (e: unknown) {
                      const em = e instanceof Error ? e.message : String(e);
                      console.log(`[AutoFix] Install failed for ${name}: ${em.slice(0, 200)}`);
                    }
                  })();
                } else if (classified.strategy === "fix-postcss-config") {
                  fixVitePostcssConfig(projDir);
                  const entry = previewProcesses.get(name);
                  if (entry) { try { entry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                  liveRecovery = { attempted: true, success: true, detail: "PostCSS config fixed + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "kill-port") {
                  const portMatch3 = text.match(/EADDRINUSE.*:(\d+)/i);
                  if (portMatch3) {
                    (async () => {
                      try {
                        const { execSync: es3 } = await import("child_process");
                        es3(`lsof -ti:${portMatch3[1]} | xargs kill -9 2>/dev/null || true`, { timeout: 5000, stdio: "pipe", shell: true });
                      } catch {}
                    })();
                    liveRecovery = { attempted: true, success: true, detail: `Killed process on port ${portMatch3[1]}` };
                    scheduleViteAutoRestart(name, projDir, String(port));
                  }
                } else if (classified.strategy === "vite-force") {
                  clearViteFrameworkCaches(projDir);
                  const entry = previewProcesses.get(name);
                  if (entry) { try { entry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                  liveRecovery = { attempted: true, success: true, detail: "Cleared Vite cache + preview killed for --force restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "fix-tsconfig-paths") {
                  fixViteTsconfigPaths(projDir);
                  const entry = previewProcesses.get(name);
                  if (entry) { try { entry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                  liveRecovery = { attempted: true, success: true, detail: "tsconfig.json paths fixed + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "extend-timeout") {
                  liveRecovery = { attempted: true, success: true, detail: "Startup timeout extended — waiting longer for dev server" };
                } else if (classified.strategy === "cors-config") {
                  const fixed = fixViteCorsConfig(projDir);
                  if (fixed) {
                    const entry = previewProcesses.get(name);
                    if (entry) { try { entry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                    liveRecovery = { attempted: true, success: true, detail: "CORS config patched + preview killed for restart" };
                    scheduleViteAutoRestart(name, projDir, String(port));
                  } else {
                    liveRecovery = { attempted: true, success: false, detail: "CORS error detected — could not auto-patch. Add cors:true to vite server config or CORS middleware to Express app." };
                  }
                } else if (classified.strategy === "increase-ulimit") {
                  (async () => { try { const { execSync: es3 } = await import("child_process"); es3("ulimit -n 65536 2>/dev/null || true", { timeout: 5000, stdio: "pipe", shell: true }); } catch {} })();
                  const entry = previewProcesses.get(name);
                  if (entry) { try { entry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                  liveRecovery = { attempted: true, success: true, detail: "Increased file descriptor limit + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "increase-watchers") {
                  (async () => { try { const { execSync: es3 } = await import("child_process"); es3("sysctl -w fs.inotify.max_user_watches=524288 2>/dev/null || true", { timeout: 5000, stdio: "pipe", shell: true }); } catch {} })();
                  const entry = previewProcesses.get(name);
                  if (entry) { try { entry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                  liveRecovery = { attempted: true, success: true, detail: "Increased inotify watchers + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "angular-update") {
                  (async () => { try { const { execSync: es3 } = await import("child_process"); es3("npx ng update @angular/core @angular/cli --force 2>/dev/null || true", { cwd: projDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true }); } catch {} })();
                  const entry = previewProcesses.get(name);
                  if (entry) { try { entry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                  liveRecovery = { attempted: true, success: true, detail: "Angular packages updated via ng update + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "install-missing-dep") {
                  (async () => {
                    try {
                      const livePm = detectPackageManager();
                      const targeted = installViteMissingDep(projDir, text, livePm);
                      if (!targeted) {
                        const { execSync: es3 } = await import("child_process");
                        const installCmd3 = buildPmCommand(livePm, "install");
                        es3(installCmd3, { cwd: projDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true });
                      }
                      const entry2 = previewProcesses.get(name);
                      if (entry2) { try { entry2.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                      scheduleViteAutoRestart(name, projDir, String(port));
                    } catch {}
                  })();
                  liveRecovery = { attempted: true, success: true, detail: "Missing dependency installed + preview killed for restart" };
                } else if (classified.strategy === "delete-framework-cache") {
                  deleteViteFrameworkCache(projDir);
                  const entry = previewProcesses.get(name);
                  if (entry) { try { entry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                  liveRecovery = { attempted: true, success: true, detail: "Framework cache deleted + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "update-package") {
                  (async () => {
                    try {
                      const { execSync: es3 } = await import("child_process");
                      const livePm = detectPackageManager();
                      const targeted = updateViteSpecificPackage(projDir, text, livePm);
                      if (!targeted) {
                        const installCmd3 = buildPmCommand(livePm, "install");
                        es3(installCmd3, { cwd: projDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true });
                      }
                      const entry2 = previewProcesses.get(name);
                      if (entry2) { try { entry2.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                      scheduleViteAutoRestart(name, projDir, String(port));
                    } catch {}
                  })();
                  liveRecovery = { attempted: true, success: true, detail: "Package updated to latest + preview killed for restart" };
                } else if (classified.strategy === "cache-clean-reinstall" || classified.strategy === "full-install-retry" || classified.strategy === "install-missing-cli" || classified.strategy === "install-types") {
                  (async () => {
                    try {
                      const { execSync: es3 } = await import("child_process");
                      if (classified.strategy === "cache-clean-reinstall") {
                        try { es3("npm cache clean --force", { cwd: projDir, timeout: 30000, stdio: "pipe", shell: true, windowsHide: true }); } catch {}
                        const lockFile = path.join(projDir, "package-lock.json");
                        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
                      }
                      const livePm = detectPackageManager();
                      const installCmd3 = buildPmCommand(livePm, "install");
                      es3(installCmd3, { cwd: projDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true });
                      const entry2 = previewProcesses.get(name);
                      if (entry2) { try { entry2.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                      scheduleViteAutoRestart(name, projDir, String(port));
                    } catch {}
                  })();
                  liveRecovery = { attempted: true, success: true, detail: `Dependencies reinstalled (${classified.strategy}) + preview killed for restart` };
                } else if (classified.strategy === "copy-env-example") {
                  copyViteEnvExample(projDir);
                  const entry = previewProcesses.get(name);
                  if (entry) { try { entry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                  liveRecovery = { attempted: true, success: true, detail: ".env created + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "add-type-module") {
                  const pkgJsonPath2 = path.join(projDir, "package.json");
                  try {
                    if (fs.existsSync(pkgJsonPath2)) {
                      const pObj = JSON.parse(fs.readFileSync(pkgJsonPath2, "utf-8"));
                      const needsRemove = /require is not defined in ES module|ReferenceError: require is not defined|__dirname is not defined|__filename is not defined/i.test(text);
                      if (needsRemove && pObj.type === "module") {
                        delete pObj.type;
                        fs.writeFileSync(pkgJsonPath2, JSON.stringify(pObj, null, 2), "utf-8");
                      } else if (!needsRemove && pObj.type !== "module") {
                        pObj.type = "module";
                        fs.writeFileSync(pkgJsonPath2, JSON.stringify(pObj, null, 2), "utf-8");
                      }
                    }
                    const entry = previewProcesses.get(name);
                    if (entry) { try { entry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                    liveRecovery = { attempted: true, success: true, detail: "Toggled type:module + preview killed for restart" };
                    scheduleViteAutoRestart(name, projDir, String(port));
                  } catch { liveRecovery = { attempted: true, success: false, detail: "Failed to toggle type:module" }; }
                } else if (classified.strategy === "openssl-legacy-provider" || classified.strategy === "increase-heap") {
                  const entry = previewProcesses.get(name);
                  if (entry) { try { entry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                  liveRecovery = { attempted: true, success: true, detail: `Will apply ${classified.strategy} on restart` };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "fix-tsconfig") {
                  fixViteTsconfigJson(projDir);
                  const entry = previewProcesses.get(name);
                  if (entry) { try { entry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(name); }
                  liveRecovery = { attempted: true, success: true, detail: "tsconfig.json fixed + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "upgrade-node-warning") {
                  let nodeVer = "unknown";
                  try { const cp = require("child_process") as typeof import("child_process"); nodeVer = cp.execSync("node --version", { timeout: 5000, stdio: "pipe", encoding: "utf-8" }).toString().trim(); } catch {}
                  liveRecovery = { attempted: true, success: false, detail: `Node.js version mismatch: current ${nodeVer} does not support modern syntax (optional chaining, nullish coalescing, etc.). Please upgrade Node.js to v14+ (v18+ recommended).` };
                }

                viteErrorHistory.push({
                  id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  timestamp: Date.now(), source: "vite-server", message: text.trim().slice(0, 500),
                  projectName: name, classified, recovery: liveRecovery,
                });
                if (viteErrorHistory.length > 200) viteErrorHistory.splice(0, viteErrorHistory.length - 200);
              }
            }
          };

          child.stdout?.on("data", (d: Buffer) => collectOutput(d, false));
          child.stderr?.on("data", (d: Buffer) => collectOutput(d, true));

          previewProcesses.set(name, { process: child, port, logs: logBuf });

          let exited = false;
          child.on("error", (err: any) => {
            console.error(`[Preview] Process error for ${name}:`, err.message);
            exited = true;
          });

          child.on("exit", (code: number | null) => {
            try {
              exited = true;
              previewProcesses.delete(name);
              if (previewStoppedManually.has(name)) {
                console.log(`[Preview] ${name} stopped by user — not auto-restarting`);
                previewStoppedManually.delete(name);
                return;
              }
              if (code !== 0 && code !== null) {
                console.error(`[Preview] Process for ${name} exited with code ${code}`);
                console.log(`[AutoFix] Preview ${name} exited with code ${code} — scheduling auto-restart`);
                scheduleViteAutoRestart(name, effectiveProjectDir, String(port));
              }
            } catch (exitErr: any) {
              console.error(`[Preview] Error in exit handler for ${name}:`, exitErr?.message);
            }
          });

          const maxWait = 15000;
          const start = Date.now();
          while (Date.now() - start < maxWait && !serverReady && !exited) {
            await new Promise(r => setTimeout(r, 300));
          }

          const isValidNpmPackageName = (name: string): boolean => {
            return /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name) && name.length <= 214;
          };
          const NODE_BUILTINS = new Set(["fs", "path", "os", "child_process", "http", "https", "url", "util", "crypto", "stream", "events", "assert", "buffer", "net", "tls", "dns", "zlib", "querystring", "module", "vm", "cluster", "dgram", "readline", "tty", "worker_threads", "perf_hooks", "async_hooks", "v8", "inspector", "string_decoder", "timers", "console"]);
          const extractMissingPackages = (output: string): string[] => {
            const pkgs = new Set<string>();
            const addIfValid = (raw: string) => {
              const mod = raw.startsWith("@") ? raw.split("/").slice(0, 2).join("/") : raw.split("/")[0];
              if (mod && !mod.startsWith(".") && !mod.startsWith("/") && !mod.startsWith("~") && !NODE_BUILTINS.has(mod) && isValidNpmPackageName(mod)) {
                pkgs.add(mod);
              }
            };
            const cannotFind = output.matchAll(/Cannot find (?:module|package) ['"]([^'"]+)['"]/g);
            for (const m of cannotFind) addIfValid(m[1]);
            const couldNotResolve = output.matchAll(/Could not resolve ["']([^"']+)["']/g);
            for (const m of couldNotResolve) addIfValid(m[1]);
            const moduleNotFound = output.matchAll(/Module not found.*['"]([^'"]+)['"]/g);
            for (const m of moduleNotFound) addIfValid(m[1]);
            return [...pkgs];
          };

          let retried = false;
          if (exited && !serverReady && !retried) {
            const outputStr = startupOutput + " " + startupErrors.join(" ");
            if (/ESM file cannot be loaded by.*require|Cannot use import statement outside a module|ERR_REQUIRE_ESM/i.test(outputStr)) {
              const pkgJsonPath = path.join(effectiveProjectDir, "package.json");
              if (fs.existsSync(pkgJsonPath)) {
                try {
                  const pRaw = fs.readFileSync(pkgJsonPath, "utf-8");
                  const pObj = JSON.parse(pRaw);
                  if (pObj.type !== "module") {
                    pObj.type = "module";
                    fs.writeFileSync(pkgJsonPath, JSON.stringify(pObj, null, 2), "utf-8");
                    console.log(`[Preview] Auto-fix: added "type":"module" to package.json after ESM error`);
                    ensureESMCompat(effectiveProjectDir);
                    if (effectiveProjectDir !== projectDir) ensureESMCompat(projectDir);
                    retried = true;

                    const child2 = spawn(devCmd.cmd, devCmd.args, {
                      cwd: effectiveProjectDir, stdio: "pipe", shell: true,
                      detached: !isWin, windowsHide: true, env: portEnv,
                    });
                    if (!isWin) child2.unref();
                    startupOutput = "";
                    serverReady = false;
                    exited = false;
                    startupErrors.length = 0;
                    child2.stdout?.on("data", (d: Buffer) => collectOutput(d, false));
                    child2.stderr?.on("data", (d: Buffer) => collectOutput(d, true));
                    previewProcesses.set(name, { process: child2, port, logs: logBuf });
                    child2.on("error", () => { exited = true; });
                    child2.on("exit", (code: number | null) => {
                      exited = true;
                      if (code !== 0 && code !== null) previewProcesses.delete(name);
                    });
                    const startESM = Date.now();
                    while (Date.now() - startESM < maxWait && !serverReady && !exited) {
                      await new Promise(r => setTimeout(r, 300));
                    }
                  }
                } catch {}
              }
            }
          }
          if (exited && !serverReady && !retried) {
            const missingPkgs = extractMissingPackages(startupOutput);
            if (missingPkgs.length > 0 && missingPkgs.length <= 5) {
              retried = true;
              let installDir = projectDir;
              const subdirMatch = startupOutput.match(/[\/\\](frontend|client|web|app)[\/\\]/i);
              if (subdirMatch) {
                const subPath = path.join(projectDir, subdirMatch[1].toLowerCase());
                if (fs.existsSync(path.join(subPath, "package.json"))) {
                  installDir = subPath;
                  if (!fs.existsSync(path.join(subPath, "node_modules"))) {
                    try {
                      console.log(`[Preview] Installing all deps in ${subdirMatch[1]}/ first...`);
                      if (!fs.existsSync(path.join(subPath, ".git"))) { try { fs.mkdirSync(path.join(subPath, ".git"), { recursive: true }); } catch {} }
                      execSync(buildPmCommand(detectPmForDir(subPath), "install"), { cwd: subPath, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true, env: { ...process.env, HUSKY: "0" } });
                    } catch {}
                  }
                }
              }
              console.log(`[Preview] Detected missing packages: ${missingPkgs.join(", ")} — installing in ${installDir === projectDir ? 'root' : path.basename(installDir)} and retrying`);
              try {
                const installPkgList = missingPkgs.join(" ");
                const installCmd = buildPmCommand(pm, "add-dev", installPkgList);
                execSync(installCmd, { cwd: installDir, timeout: 60000, stdio: "pipe", shell: true, windowsHide: true, env: safeInstallEnv });
                console.log(`[Preview] Installed ${missingPkgs.join(", ")} — retrying startup`);

                const child2 = spawn(devCmd.cmd, devCmd.args, {
                  cwd: effectiveProjectDir, stdio: "pipe", shell: true,
                  detached: !isWin, windowsHide: true, env: portEnv,
                });
                if (!isWin) child2.unref();
                startupOutput = "";
                serverReady = false;
                exited = false;
                startupErrors.length = 0;
                child2.stdout?.on("data", (d: Buffer) => collectOutput(d, false));
                child2.stderr?.on("data", (d: Buffer) => collectOutput(d, true));
                previewProcesses.set(name, { process: child2, port, logs: logBuf });
                child2.on("error", () => { exited = true; });
                child2.on("exit", (code: number | null) => {
                  exited = true;
                  if (code !== 0 && code !== null) previewProcesses.delete(name);
                });
                const start2 = Date.now();
                while (Date.now() - start2 < maxWait && !serverReady && !exited) {
                  await new Promise(r => setTimeout(r, 300));
                }
              } catch (e: any) {
                console.log(`[Preview] Auto-install retry failed: ${e.message?.slice(0, 200)}`);
              }
            }
          }

          res.setHeader("Content-Type", "application/json");
          if (exited && !serverReady && !retried) {
            previewProcesses.delete(name);
            const outputStr = startupOutput + " " + startupErrors.join(" ");

            const safeInstallEnv2: Record<string, string | undefined> = { ...process.env, HUSKY: "0", npm_config_ignore_scripts: "", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" };
            let autoFixed = false;

            if (/ERR_REQUIRE_ESM|Cannot use import statement outside a module|ESM file cannot be loaded by.*require/i.test(outputStr)) {
              const pkgJsonPath = path.join(effectiveProjectDir, "package.json");
              if (fs.existsSync(pkgJsonPath)) {
                try {
                  const pRaw = fs.readFileSync(pkgJsonPath, "utf-8");
                  const pObj = JSON.parse(pRaw);
                  if (pObj.type !== "module") {
                    pObj.type = "module";
                    fs.writeFileSync(pkgJsonPath, JSON.stringify(pObj, null, 2), "utf-8");
                    console.log("[Preview] Auto-fix: added \"type\":\"module\" to package.json after ESM error");
                    autoFixed = true;
                  }
                } catch {}
              }
            }

            const { fixes: autoFixes, installFailed: installDidFail } = await attemptViteAutoFixStartup(effectiveProjectDir, outputStr, pm, safeInstallEnv2);
            if (autoFixes.length > 0) autoFixed = true;

            if (installDidFail) {
              res.statusCode = 200;
              res.end(JSON.stringify({
                started: false, ready: false, port,
                error: `Dependency installation failed and could not be recovered. Fix package.json issues manually and retry. Auto-fix attempts: ${autoFixes.join(", ")}`,
                autoFixes, autoFixed: true
              }));
              return;
            }

            const fixedEnv = buildViteAutoFixEnv({ ...process.env, ...portEnv, PORT: String(port) }, outputStr);

            if (autoFixed) {
              console.log(`[Preview] Retrying ${name} after ${autoFixes.length} auto-fixes: ${autoFixes.join(", ")}...`);
              try {
                let newPkg: Record<string, any> = {};
                try { newPkg = JSON.parse(fs.readFileSync(path.join(effectiveProjectDir, "package.json"), "utf-8")); } catch {}
                let newDevCmd = detectDevCommand();
                newDevCmd = resolveLocalBin(newDevCmd, effectiveProjectDir);
                const { spawn: sp3 } = await import("child_process");
                const child3 = sp3(newDevCmd.cmd, newDevCmd.args, {
                  cwd: effectiveProjectDir, stdio: "pipe", shell: true, detached: !isWin, windowsHide: true, env: fixedEnv,
                });
                if (!isWin) child3.unref();
                let startupOutput3 = "";
                let serverReady3 = false;
                let exited3 = false;
                const startupErrors3: string[] = [];
                const collectOutput3 = (data: Buffer, isStderr?: boolean) => {
                  const t = data.toString();
                  startupOutput3 += t;
                  if (isStderr) {
                    logBuf.stderr += t;
                    if (logBuf.stderr.length > 20000) logBuf.stderr = logBuf.stderr.slice(-10000);
                  } else {
                    logBuf.stdout += t;
                    if (logBuf.stdout.length > 20000) logBuf.stdout = logBuf.stdout.slice(-10000);
                  }
                  console.log(`[Preview:${name}] ${t.trim()}`);
                  if (/ready|VITE.*ready|compiled|started server|listening|Local:|Successfully compiled/i.test(t)) serverReady3 = true;
                  if (/error|ERR!|Cannot find|MODULE_NOT_FOUND|SyntaxError|ENOENT|EADDRINUSE/i.test(t)) startupErrors3.push(t.trim().slice(0, 300));
                };
                child3.stdout.on("data", (d: Buffer) => collectOutput3(d, false));
                child3.stderr.on("data", (d: Buffer) => collectOutput3(d, true));
                previewProcesses.set(name, { process: child3, port, logs: logBuf });
                child3.on("error", () => { exited3 = true; });
                child3.on("exit", (code3) => {
                  exited3 = true;
                  if (code3 !== 0 && code3 !== null) previewProcesses.delete(name);
                });
                const isNextProject = /next/i.test(String(newDevCmd.args?.[0] || ""));
                const isTimeoutExtend = autoFixes.includes("extend-timeout") || /timed? ?out|timeout|ETIMEDOUT/i.test(outputStr);
                const retryWait = isNextProject ? 45000 : isTimeoutExtend ? 30000 : maxWait;
                const start3 = Date.now();
                while (Date.now() - start3 < retryWait && !serverReady3 && !exited3) {
                  await new Promise(r => setTimeout(r, 300));
                }
                if (!exited3 || serverReady3) {
                  res.end(JSON.stringify({
                    port, started: true, ready: serverReady3,
                    detectedCommand: `${newDevCmd.cmd} ${newDevCmd.args.join(" ")}`,
                    packageManager: pm, retried: true, autoFixes,
                  }));
                  return;
                }
                previewProcesses.delete(name);
                scheduleViteAutoRestart(name, effectiveProjectDir, String(port));
                res.end(JSON.stringify({
                  port, started: false,
                  error: `Dev server failed after auto-fix retry (${autoFixes.join(", ")}). ${startupErrors3.join(" | ").slice(0, 800)}`,
                  output: startupOutput3.slice(-2000),
                  detectedCommand: `${newDevCmd.cmd} ${newDevCmd.args.join(" ")}`,
                  retried: true, autoFixes,
                }));
                return;
              } catch (retryErr: any) {
                console.log(`[Preview] Auto-fix retry spawn failed: ${retryErr.message?.slice(0, 200)}`);
              }
            }

            const failClassified = classifyViteError(outputStr);
            const actionableMsg = failClassified.category !== "unknown"
              ? `Dev server failed: ${failClassified.category} (${failClassified.strategy}). ${failClassified.detail || ""} ${startupErrors.join(" | ").slice(0, 600)}`
              : `Dev server process exited immediately. Check terminal output for errors. ${startupErrors.join(" | ").slice(0, 800)}`;
            scheduleViteAutoRestart(name, effectiveProjectDir, String(port));
            res.end(JSON.stringify({
              port,
              started: false,
              error: actionableMsg,
              output: startupOutput.slice(-2000),
              detectedCommand: `${devCmd.cmd} ${devCmd.args.join(" ")}`,
              classified: failClassified,
              retried,
            }));
          } else if (exited && !serverReady) {
            previewProcesses.delete(name);
            const failClassified2 = classifyViteError(startupOutput + " " + startupErrors.join(" "));
            const actionableMsg2 = failClassified2.category !== "unknown"
              ? `Dev server failed after retry: ${failClassified2.category} (${failClassified2.strategy}). ${failClassified2.detail || ""} ${startupErrors.join(" | ").slice(0, 600)}`
              : `Dev server process exited after retry. Check terminal output for errors. ${startupErrors.join(" | ").slice(0, 800)}`;
            scheduleViteAutoRestart(name, effectiveProjectDir, String(port));
            res.end(JSON.stringify({
              port,
              started: false,
              error: actionableMsg2,
              output: startupOutput.slice(-2000),
              detectedCommand: `${devCmd.cmd} ${devCmd.args.join(" ")}`,
              classified: failClassified2,
              retried,
            }));
          } else {
            res.end(JSON.stringify({
              port,
              started: true,
              ready: serverReady,
              detectedCommand: `${devCmd.cmd} ${devCmd.args.join(" ")}`,
              packageManager: pm,
              retried,
            }));
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/restart-preview", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name || /[\/\\]|\.\./.test(name)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid project name" })); return; }

          const entry = previewProcesses.get(name);
          if (!entry) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ restarted: false, reason: "No active preview" }));
            return;
          }

          const oldPort = entry.port;
          try {
            if (process.platform === "win32") {
              const { execSync } = await import("child_process");
              try { execSync(`taskkill /pid ${entry.process.pid} /T /F`, { stdio: "pipe", windowsHide: true }); } catch {}
            } else {
              try { process.kill(-entry.process.pid, "SIGKILL"); } catch { try { entry.process.kill("SIGKILL"); } catch {} }
            }
          } catch {}
          previewProcesses.delete(name);

          const waitForPortFree = async (port: number, maxWait: number) => {
            const net = await import("net");
            const start = Date.now();
            while (Date.now() - start < maxWait) {
              const inUse = await new Promise<boolean>(resolve => {
                const s = net.createServer();
                s.once("error", () => resolve(true));
                s.once("listening", () => { s.close(); resolve(false); });
                s.listen(port, "0.0.0.0");
              });
              if (!inUse) return true;
              await new Promise(r => setTimeout(r, 200));
            }
            return false;
          };
          const portFree = await waitForPortFree(oldPort, 3000);
          if (!portFree) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ restarted: false, reason: "Port still in use after 3s" }));
            return;
          }

          const fs = await import("fs");
          const projectDir = path.resolve(process.cwd(), "projects", name);
          const { spawn } = await import("child_process");

          let pkg: any = {};
          let restartDir = projectDir;
          const pkgPath = path.join(projectDir, "package.json");
          if (fs.existsSync(pkgPath)) {
            try { pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")); } catch {}
          } else {
            for (const sub of ["frontend", "client", "web", "app", "ui"]) {
              const subPkg = path.join(projectDir, sub, "package.json");
              if (fs.existsSync(subPkg)) {
                try { pkg = JSON.parse(fs.readFileSync(subPkg, "utf-8")); restartDir = path.join(projectDir, sub); } catch {}
                break;
              }
            }
          }
          const scripts = pkg.scripts || {};
          const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

          const detectPMRestart = (): string => {
            for (const dir of [restartDir, projectDir]) {
              if (fs.existsSync(path.join(dir, "bun.lockb")) || fs.existsSync(path.join(dir, "bun.lock"))) return "bun";
              if (fs.existsSync(path.join(dir, "pnpm-lock.yaml")) || fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return "pnpm";
              if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn";
            }
            return "npm";
          };
          const pmR = detectPMRestart();

          const restartDetect = (): { cmd: string; args: string[] } => {
            const portStr = String(oldPort);
            const matchScript = (scriptBody: string): { cmd: string; args: string[] } | null => {
              if (scriptBody.includes("next")) return { cmd: "npx", args: ["next", "dev", "--port", portStr] };
              if (scriptBody.includes("react-scripts")) return { cmd: "npx", args: ["react-scripts", "start"] };
              if (scriptBody.includes("nuxt")) return { cmd: "npx", args: ["nuxt", "dev", "--port", portStr] };
              if (scriptBody.includes("astro")) return { cmd: "npx", args: ["astro", "dev", "--port", portStr] };
              if (scriptBody.includes("webpack")) {
                const wpArgs = ["webpack", "serve", "--host", "0.0.0.0", "--port", portStr];
                const cfgM = scriptBody.match(/(?:--config[=\s]|-c\s)(\S+)/);
                if (cfgM) wpArgs.splice(2, 0, "--config", cfgM[1]);
                return { cmd: "npx", args: wpArgs };
              }
              if (scriptBody.includes("rspack")) return { cmd: "npx", args: ["rspack", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("svelte") || scriptBody.includes("sveltekit")) return null;
              if (scriptBody.includes("vue-cli-service")) return { cmd: "npx", args: ["vue-cli-service", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("parcel")) return { cmd: "npx", args: ["parcel", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("ember")) return { cmd: "npx", args: ["ember", "serve", "--host", "0.0.0.0", "--port", portStr] };
              if (scriptBody.includes("vite")) return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
              return null;
            };
            const isSvelteKit = deps["@sveltejs/kit"] || deps["sveltekit"];
            const isPnpmMono = fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"));
            if (isPnpmMono) {
              for (const key of Object.keys(scripts)) {
                if (scripts[key].includes("--filter") && (key.includes("dev") || key === "lp:dev")) {
                  return { cmd: "pnpm", args: ["run", key] };
                }
              }
            }
            if (scripts.dev) {
              if (isSvelteKit) return { cmd: "npx", args: ["vite", "dev", "--host", "0.0.0.0", "--port", portStr] };
              const m = matchScript(scripts.dev); if (m) return m;
              return { cmd: pmR === "npm" ? "npm" : `npx ${pmR}`, args: pmR === "npm" ? ["run", "dev"] : ["run", "dev"] };
            }
            if (scripts.start) { const m = matchScript(scripts.start); if (m) return m; return { cmd: pmR === "npm" ? "npm" : `npx ${pmR}`, args: pmR === "npm" ? ["run", "start"] : ["run", "start"] }; }
            if (scripts.serve || scripts["serve:rspack"]) { const s = scripts.serve || scripts["serve:rspack"]; const m = matchScript(s); if (m) return m; const k = scripts.serve ? "serve" : "serve:rspack"; return { cmd: pmR === "npm" ? "npm" : `npx ${pmR}`, args: pmR === "npm" ? ["run", k] : ["run", k] }; }
            if (deps["next"]) return { cmd: "npx", args: ["next", "dev", "--port", portStr] };
            if (deps["react-scripts"]) return { cmd: "npx", args: ["react-scripts", "start"] };
            if (deps["nuxt"]) return { cmd: "npx", args: ["nuxt", "dev", "--port", portStr] };
            if (deps["astro"]) return { cmd: "npx", args: ["astro", "dev", "--port", portStr] };
            if (deps["@angular/cli"]) return { cmd: "npx", args: ["ng", "serve", "--host", "0.0.0.0", "--port", portStr, "--disable-host-check"] };
            if (deps["@remix-run/dev"]) return { cmd: "npx", args: ["remix", "vite:dev", "--host", "0.0.0.0", "--port", portStr] };
            if (deps["gatsby"]) return { cmd: "npx", args: ["gatsby", "develop", "-H", "0.0.0.0", "-p", portStr] };
            if (deps["webpack-dev-server"]) return { cmd: "npx", args: ["webpack", "serve", "--host", "0.0.0.0", "--port", portStr] };
            if (deps["@rspack/cli"] || deps["@rspack/core"]) return { cmd: "npx", args: ["rspack", "serve", "--host", "0.0.0.0", "--port", portStr] };
            if (deps["parcel"]) return { cmd: "npx", args: ["parcel", "--host", "0.0.0.0", "--port", portStr] };
            if (isSvelteKit) return { cmd: "npx", args: ["vite", "dev", "--host", "0.0.0.0", "--port", portStr] };
            return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
          };
          let restartCmd = restartDetect();

          const isWinR = process.platform === "win32";
          if (restartCmd.cmd === "npx" && restartCmd.args.length > 0) {
            const rBinName = restartCmd.args[0];
            const rLocalBin = path.join(restartDir, "node_modules", ".bin", isWinR ? `${rBinName}.cmd` : rBinName);
            if (fs.existsSync(rLocalBin)) {
              console.log(`[Preview] Using local binary for ${name} restart: ${rLocalBin}`);
              restartCmd = { cmd: rLocalBin, args: restartCmd.args.slice(1) };
            }
          }
          console.log(`[Preview] Restarting ${name} with: ${restartCmd.cmd} ${restartCmd.args.join(" ")}`);

          const rPathSep = isWinR ? ";" : ":";
          const rBinDirs: string[] = [path.join(restartDir, "node_modules", ".bin")];
          if (restartDir !== projectDir) rBinDirs.push(path.join(projectDir, "node_modules", ".bin"));
          const rIsolatedPath = rBinDirs.join(rPathSep) + rPathSep + (process.env.PATH || process.env.Path || "");
          const rNodePaths: string[] = [path.join(restartDir, "node_modules")];
          if (restartDir !== projectDir) rNodePaths.push(path.join(projectDir, "node_modules"));

          const child = spawn(restartCmd.cmd, restartCmd.args, {
            cwd: restartDir,
            stdio: "pipe",
            shell: true,
            detached: !isWinR,
            windowsHide: true,
            env: {
              ...process.env,
              BROWSER: "none",
              PORT: String(oldPort),
              HOST: "0.0.0.0",
              HOSTNAME: "0.0.0.0",
              PATH: rIsolatedPath,
              NODE_PATH: rNodePaths.join(rPathSep),
              CHOKIDAR_USEPOLLING: "true",
              ...(restartCmd.args.some((a: string) => ["webpack", "webpack-dev-server", "vue-cli-service", "react-scripts"].includes(a)) ? { NODE_OPTIONS: (process.env.NODE_OPTIONS || "") + " --openssl-legacy-provider" } : {}),
            },
          });
          if (!isWinR) child.unref();

          const rLogBuf = { stdout: "", stderr: "" };
          previewProcesses.set(name, { process: child, port: oldPort, logs: rLogBuf });

          child.stdout?.on("data", (d: Buffer) => { const t = d.toString(); rLogBuf.stdout += t; if (rLogBuf.stdout.length > 20000) rLogBuf.stdout = rLogBuf.stdout.slice(-10000); console.log(`[Preview:${name}] ${t.trim()}`); });
          child.stderr?.on("data", (d: Buffer) => { const t = d.toString(); rLogBuf.stderr += t; if (rLogBuf.stderr.length > 20000) rLogBuf.stderr = rLogBuf.stderr.slice(-10000); console.log(`[Preview:${name}] ${t.trim()}`); });

          child.on("error", (err: any) => {
            console.error(`[Preview] Process error for ${name}:`, err.message);
          });
          child.on("exit", (code: number | null) => {
            if (code !== null && code !== 0) {
              console.error(`[Preview] Process for ${name} exited with code ${code}`);
            }
            previewProcesses.delete(name);
          });

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ restarted: true, port: oldPort }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // ── AUTO-ERROR-RECOVERY ENDPOINTS ──
      const viteErrorHistory: { id: string; timestamp: number; source: string; message: string; stack?: string; projectName?: string; classified: ReturnType<typeof classifyViteError>; recovery: { attempted: boolean; success: boolean; detail: string } | null }[] = [];
      const viteRateLimitMap = new Map<string, { count: number; first: number }>();
      const viteAutoRestartAttempts = new Map<string, number>();
      const VITE_AUTO_RESTART_MAX = 3;
      const VITE_AUTO_RESTART_BACKOFF = [2000, 5000, 15000];

      function scheduleViteAutoRestart(name: string, projectDir: string, portStr: string) {
        const attempts = viteAutoRestartAttempts.get(name) || 0;
        if (attempts >= VITE_AUTO_RESTART_MAX) {
          console.log(`[AutoFix] Preview ${name} has crashed ${attempts} times — not restarting (max ${VITE_AUTO_RESTART_MAX})`);
          viteAutoRestartAttempts.delete(name);
          return;
        }
        const delay = VITE_AUTO_RESTART_BACKOFF[attempts] || 15000;
        viteAutoRestartAttempts.set(name, attempts + 1);
        console.log(`[AutoFix] Will auto-restart ${name} in ${delay / 1000}s (attempt ${attempts + 1}/${VITE_AUTO_RESTART_MAX})`);

        setTimeout(async () => {
          if (previewProcesses.has(name)) {
            console.log(`[AutoFix] Preview ${name} already running — skipping auto-restart`);
            return;
          }
          const fs2 = await import("fs");
          if (!fs2.existsSync(projectDir)) {
            console.log(`[AutoFix] Project dir not found — skipping auto-restart for ${name}`);
            viteAutoRestartAttempts.delete(name);
            return;
          }
          console.log(`[AutoFix] Auto-restarting preview ${name}...`);
          try {
            const { spawn: sp2 } = await import("child_process");
            const port = parseInt(portStr) || projectPort(name);

            let pkg: Record<string, any> = {};
            const pkgPath = path.join(projectDir, "package.json");
            try { if (fs2.existsSync(pkgPath)) pkg = JSON.parse(fs2.readFileSync(pkgPath, "utf-8")); } catch {}

            let effectiveDir = projectDir;
            const RESTART_SUBDIRS = ["frontend", "client", "web", "app", "ui", "packages/app", "packages/client", "packages/web", "packages/ui"];
            for (const sd of RESTART_SUBDIRS) {
              const subPkg = path.join(projectDir, sd, "package.json");
              if (fs2.existsSync(subPkg)) {
                try {
                  const subPkgData = JSON.parse(fs2.readFileSync(subPkg, "utf-8"));
                  const subScripts = subPkgData.scripts || {};
                  const subDeps = { ...(subPkgData.dependencies || {}), ...(subPkgData.devDependencies || {}) };
                  if (subScripts.dev || subScripts.start || subDeps.next || subDeps.vite || subDeps["react-scripts"] || subDeps.nuxt) {
                    effectiveDir = path.join(projectDir, sd);
                    pkg = subPkgData;
                    break;
                  }
                } catch {}
              }
            }

            const scripts = pkg.scripts || {};
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            let cmd = "npx";
            let args = ["vite", "--host", "0.0.0.0", "--port", String(port)];

            const devScript = scripts.dev || scripts.start || scripts.serve || "";
            if (devScript.includes("next")) { args = ["next", "dev", "--port", String(port), "--hostname", "0.0.0.0"]; }
            else if (devScript.includes("react-scripts")) { args = ["react-scripts", "start"]; }
            else if (devScript.includes("nuxt")) { args = ["nuxt", "dev", "--port", String(port)]; }
            else if (devScript.includes("astro")) { args = ["astro", "dev", "--port", String(port), "--host", "0.0.0.0"]; }
            else if (devScript.includes("webpack")) { args = ["webpack", "serve", "--host", "0.0.0.0", "--port", String(port)]; }
            else if (devScript.includes("ng ") || devScript.includes("ng serve")) { args = ["ng", "serve", "--host", "0.0.0.0", "--port", String(port)]; }
            else if (devScript.includes("gatsby")) { args = ["gatsby", "develop", "-H", "0.0.0.0", "-p", String(port)]; }
            else if (deps.next) { args = ["next", "dev", "--port", String(port), "--hostname", "0.0.0.0"]; }
            else if (deps["react-scripts"]) { args = ["react-scripts", "start"]; }
            else if (deps.nuxt) { args = ["nuxt", "dev", "--port", String(port)]; }

            const isNextRestart = args.includes("next");
            if (isNextRestart) patchNextConfig(effectiveDir);
            let restartDevCmd = resolveLocalBin({ cmd, args }, effectiveDir);
            console.log(`[AutoFix] Restart command: ${restartDevCmd.cmd} ${restartDevCmd.args.join(" ")}`);
            const isWin = process.platform === "win32";
            const child2 = sp2(restartDevCmd.cmd, restartDevCmd.args, {
              cwd: effectiveDir,
              env: { ...process.env, PORT: String(port), VITE_PORT: String(port), BROWSER: "none", ...(isNextRestart ? { HOSTNAME: "0.0.0.0" } : {}) },
              stdio: ["pipe", "pipe", "pipe"],
              shell: true, detached: !isWin, windowsHide: true,
            });
            if (!isWin) child2.unref();
            const r2LogBuf = { stdout: "", stderr: "" };
            child2.stdout?.on("data", (d: Buffer) => { const t = d.toString(); r2LogBuf.stdout += t; if (r2LogBuf.stdout.length > 20000) r2LogBuf.stdout = r2LogBuf.stdout.slice(-10000); console.log(`[Preview:${name}] ${t.trim()}`); });
            child2.stderr?.on("data", (d: Buffer) => { const t = d.toString(); r2LogBuf.stderr += t; if (r2LogBuf.stderr.length > 20000) r2LogBuf.stderr = r2LogBuf.stderr.slice(-10000); console.log(`[Preview:${name}] ${t.trim()}`); });
            previewProcesses.set(name, { process: child2, port, logs: r2LogBuf });
            child2.on("exit", (code2: number | null) => {
              if (code2 !== 0 && code2 !== null) {
                previewProcesses.delete(name);
                scheduleViteAutoRestart(name, projectDir, portStr);
              }
            });
            console.log(`[AutoFix] Preview ${name} auto-restarted on port ${port}`);
          } catch (e: unknown) {
            const em = e instanceof Error ? e.message : String(e);
            console.log(`[AutoFix] Auto-restart failed for ${name}: ${em}`);
          }
        }, delay);
      }

      function viteErrorSig(msg: string): string {
        return msg.replace(/at .*:\d+:\d+/g, "").replace(/\/[^\s:]+/g, "<path>").replace(/\d+/g, "N").trim().slice(0, 120);
      }

      function isViteRateLimited(msg: string): boolean {
        const sig = viteErrorSig(msg);
        const entry = viteRateLimitMap.get(sig);
        if (!entry) return false;
        if (Date.now() - entry.first > 60000) { viteRateLimitMap.delete(sig); return false; }
        return entry.count >= 3;
      }

      function recordViteAttempt(msg: string): void {
        const sig = viteErrorSig(msg);
        const entry = viteRateLimitMap.get(sig);
        if (entry) {
          if (Date.now() - entry.first > 60000) { viteRateLimitMap.set(sig, { count: 1, first: Date.now() }); }
          else { entry.count++; }
        } else {
          viteRateLimitMap.set(sig, { count: 1, first: Date.now() });
        }
      }

      function classifyViteError(message: string, stack?: string): { category: string; strategy: string; confidence: number; detail: string; file?: string; symbol?: string; line?: number; column?: number } {
        const text = `${message || ""} ${stack || ""}`;
        const patterns: { p: RegExp; cat: string; strat: string; conf: number; exFile?: boolean; exSym?: boolean }[] = [
          { p: /does not provide an export named '([^']+)'/i, cat: "export-missing", strat: "restart-vite", conf: 0.95, exSym: true },
          { p: /The requested module '([^']+)' does not provide/i, cat: "export-missing", strat: "restart-vite", conf: 0.95, exFile: true },
          { p: /Failed to resolve import "([^"]+)" from "([^"]+)"/i, cat: "module-not-found", strat: "restart-vite", conf: 0.9, exFile: true },
          { p: /Cannot find module '([^']+)'/i, cat: "dependency-missing", strat: "install-missing-dep", conf: 0.85, exSym: true },
          { p: /Module not found.*Can't resolve '([^']+)'/i, cat: "dependency-missing", strat: "install-missing-dep", conf: 0.85, exSym: true },
          { p: /MODULE_NOT_FOUND/i, cat: "dependency-missing", strat: "install-missing-dep", conf: 0.8 },
          { p: /ERESOLVE|peer dep(?:endency)?.*conflict|unable to resolve dependency tree/i, cat: "peer-dep-conflict", strat: "legacy-peer-deps", conf: 0.9 },
          { p: /EINTEGRITY|sha512.*integrity|checksum failed/i, cat: "integrity-error", strat: "cache-clean-reinstall", conf: 0.95 },
          { p: /ENOENT.*node_modules|corrupted.*node_modules|cannot find.*node_modules/i, cat: "corrupted-node-modules", strat: "full-reinstall", conf: 0.9 },
          { p: /ERR_PACKAGE_PATH_NOT_EXPORTED/i, cat: "package-export-error", strat: "update-package", conf: 0.85 },
          { p: /ERR_MODULE_NOT_FOUND/i, cat: "esm-module-not-found", strat: "add-type-module", conf: 0.8 },
          { p: /ERR_REQUIRE_ESM|Cannot use import statement outside a module|ESM file cannot be loaded by.*require/i, cat: "esm-compat", strat: "add-type-module", conf: 0.9 },
          { p: /ERR_OSSL_EVP_UNSUPPORTED|digital envelope routines.*unsupported|error:0308010C/i, cat: "openssl-legacy", strat: "openssl-legacy-provider", conf: 0.95 },
          { p: /ENOSPC.*inotify|no space left.*watcher|System limit for.*file watchers/i, cat: "watcher-limit", strat: "increase-watchers", conf: 0.95 },
          { p: /EMFILE|too many open files/i, cat: "too-many-files", strat: "increase-ulimit", conf: 0.9 },
          { p: /ENOMEM|JavaScript heap out of memory|FATAL ERROR.*Reached heap limit/i, cat: "heap-oom", strat: "increase-heap", conf: 0.95 },
          { p: /SyntaxError:.*(?:optional chaining|nullish coalescing|\?\.|class field|private field|top-level await)/i, cat: "node-version-mismatch", strat: "upgrade-node-warning", conf: 0.85 },
          { p: /SyntaxError:.*(?:Unexpected token|Unexpected identifier|Missing .* before)/i, cat: "syntax-error", strat: "code-fix", conf: 0.7 },
          { p: /TypeError: (.*) is not a function/i, cat: "type-error", strat: "code-fix", conf: 0.6 },
          { p: /TypeError: Cannot read propert(?:y|ies) of (null|undefined)/i, cat: "type-error", strat: "code-fix", conf: 0.6 },
          { p: /ReferenceError: (\w+) is not defined/i, cat: "reference-error", strat: "code-fix", conf: 0.7, exSym: true },
          { p: /EADDRINUSE.*:(\d+)/i, cat: "port-conflict", strat: "kill-port", conf: 0.95 },
          { p: /Pre-transform error/i, cat: "vite-pre-transform", strat: "vite-force", conf: 0.9 },
          { p: /\[vite\] Internal server error/i, cat: "vite-cache", strat: "delete-framework-cache", conf: 0.8 },
          { p: /Cannot read propert(?:y|ies) of undefined.*(?:reading 'config'|postcss|tailwind)/i, cat: "postcss-tailwind-mismatch", strat: "fix-postcss-config", conf: 0.9 },
          { p: /react-scripts:.*(?:not found|command not found|ENOENT)/i, cat: "missing-cli", strat: "install-missing-cli", conf: 0.95 },
          { p: /next:.*(?:not found|command not found)|sh: next: command not found/i, cat: "missing-cli", strat: "install-missing-cli", conf: 0.95 },
          { p: /ng:.*(?:not found|command not found)/i, cat: "missing-cli", strat: "install-missing-cli", conf: 0.9 },
          { p: /nuxt:.*(?:not found|command not found)/i, cat: "missing-cli", strat: "install-missing-cli", conf: 0.9 },
          { p: /angular.*version.*mismatch|ng update|requires Angular/i, cat: "angular-mismatch", strat: "angular-update", conf: 0.85 },
          { p: /ECONNREFUSED.*(?:5432|3306|27017|6379)/i, cat: "db-connection-refused", strat: "copy-env-example", conf: 0.7 },
          { p: /\.env.*(?:not found|missing|ENOENT)|env.*file.*missing/i, cat: "missing-env", strat: "copy-env-example", conf: 0.85 },
          { p: /TS2307.*Cannot find module '([^']+)'/i, cat: "ts-path-error", strat: "fix-tsconfig-paths", conf: 0.8, exSym: true },
          { p: /error TS\d+/i, cat: "typescript-error", strat: "code-fix", conf: 0.6 },
          { p: /tsconfig\.json.*(?:error|parse|invalid|Unexpected)/i, cat: "tsconfig-parse-error", strat: "fix-tsconfig", conf: 0.85 },
          { p: /Could not find a declaration file for module '([^']+)'/i, cat: "missing-types", strat: "install-types", conf: 0.8, exSym: true },
          { p: /No runnable entry point found/i, cat: "no-entry-point", strat: "full-install-retry", conf: 0.9 },
          { p: /process exit(?:ed)?.*(?:code [1-9]|signal)|exited with code [1-9]/i, cat: "process-exit", strat: "clear-cache-restart", conf: 0.7 },
          { p: /timed? ?out|timeout.*waiting|ETIMEDOUT/i, cat: "startup-timeout", strat: "extend-timeout", conf: 0.8 },
          { p: /CORS.*blocked|blocked by CORS|Access-Control-Allow-Origin/i, cat: "cors", strat: "cors-config", conf: 0.7 },
          { p: /exec format error|cannot execute binary|is not a supported platform|ELF.*wrong architecture/i, cat: "arch-mismatch", strat: "upgrade-node-warning", conf: 0.9 },
          { p: /fetch.*failed|net::ERR_|NetworkError/i, cat: "network-error", strat: "retry", conf: 0.6 },
          { p: /supabase|postgrest|realtime.*error/i, cat: "supabase-connection", strat: "retry", conf: 0.7 },
          { p: /VITE_\w+.*undefined|env.*missing|environment variable/i, cat: "env-missing", strat: "copy-env-example", conf: 0.7 },
          { p: /Circular dependency/i, cat: "circular-dependency", strat: "escalate", conf: 0.8 },
        ];
        for (const { p, cat, strat, conf, exFile, exSym } of patterns) {
          const match = text.match(p);
          if (match) {
            const result: { category: string; strategy: string; confidence: number; detail: string; file?: string; symbol?: string; line?: number; column?: number } = {
              category: cat, strategy: strat, confidence: conf, detail: match[0].slice(0, 200),
            };
            if (exFile && match[1]) result.file = match[1].replace(/^\/src\//, "src/");
            if (exSym && match[1]) result.symbol = match[1];
            const fileMatch = text.match(/(?:at |from |in )(?:\/)?([^\s:()]+\.[jt]sx?):(\d+)(?::(\d+))?/);
            if (fileMatch) {
              if (!result.file) result.file = fileMatch[1];
              result.line = parseInt(fileMatch[2], 10);
              if (fileMatch[3]) result.column = parseInt(fileMatch[3], 10);
            }
            return result;
          }
        }
        return { category: "unknown", strategy: "escalate", confidence: 0.1, detail: String(message).slice(0, 200) };
      }

      function clearViteFrameworkCaches(projectDir: string): number {
        const cacheDirs = [".vite", ".next", ".nuxt", ".astro", ".svelte-kit", ".parcel-cache", "node_modules/.cache", "node_modules/.vite"];
        let cleared = 0;
        const fs3 = require("fs") as typeof import("fs");
        for (const dir of cacheDirs) {
          const full = path.join(projectDir, dir);
          if (fs3.existsSync(full)) {
            try { fs3.rmSync(full, { recursive: true, force: true }); cleared++; } catch {}
          }
        }
        return cleared;
      }

      function copyViteEnvExample(projectDir: string): boolean {
        const fs3 = require("fs") as typeof import("fs");
        const envPath = path.join(projectDir, ".env");
        if (fs3.existsSync(envPath)) return false;
        const examples = [".env.example", ".env.sample", ".env.template", ".env.local.example"];
        for (const ex of examples) {
          const exPath = path.join(projectDir, ex);
          if (fs3.existsSync(exPath)) {
            try { fs3.copyFileSync(exPath, envPath); console.log(`[AutoFix] Copied ${ex} → .env`); return true; } catch {}
          }
        }
        try {
          const placeholder = "# Auto-generated placeholder .env\n# Fill in your environment variables below\nNODE_ENV=development\nPORT=3000\n";
          fs3.writeFileSync(envPath, placeholder, "utf-8");
          console.log("[AutoFix] Created placeholder .env (no example found)");
          return true;
        } catch {}
        return false;
      }

      function fixViteTsconfigJson(projectDir: string): boolean {
        const fs3 = require("fs") as typeof import("fs");
        const tsconfigPath = path.join(projectDir, "tsconfig.json");
        if (!fs3.existsSync(tsconfigPath)) return false;
        try {
          let raw = fs3.readFileSync(tsconfigPath, "utf-8");
          raw = raw.replace(/\/\/.*$/gm, "");
          raw = raw.replace(/\/\*[\s\S]*?\*\//g, "");
          raw = raw.replace(/,(\s*[}\]])/g, "$1");
          JSON.parse(raw);
          fs3.writeFileSync(tsconfigPath, raw, "utf-8");
          console.log("[AutoFix] Fixed tsconfig.json (removed comments/trailing commas)");
          return true;
        } catch { return false; }
      }

      function fixVitePostcssConfig(projectDir: string): boolean {
        const fs3 = require("fs") as typeof import("fs");
        const configs = ["postcss.config.js", "postcss.config.cjs", "postcss.config.mjs"];
        for (const cfg of configs) {
          const cfgPath = path.join(projectDir, cfg);
          if (!fs3.existsSync(cfgPath)) continue;
          try {
            let content = fs3.readFileSync(cfgPath, "utf-8");
            if (content.includes("tailwindcss") && !content.includes("@tailwindcss/postcss")) {
              const pkgPath = path.join(projectDir, "package.json");
              if (fs3.existsSync(pkgPath)) {
                const pkg2 = JSON.parse(fs3.readFileSync(pkgPath, "utf-8"));
                const allDeps = { ...(pkg2.dependencies || {}), ...(pkg2.devDependencies || {}) };
                const twVersion = allDeps.tailwindcss || "";
                if (twVersion.startsWith("4") || twVersion.startsWith("^4") || twVersion.startsWith("~4")) {
                  content = content.replace(/['"]?tailwindcss['"]?\s*:\s*\{\s*\}/g, "'@tailwindcss/postcss': {}");
                  content = content.replace(/require\(['"]tailwindcss['"]\)/g, "require('@tailwindcss/postcss')");
                  fs3.writeFileSync(cfgPath, content, "utf-8");
                  console.log(`[AutoFix] Updated ${cfg} for Tailwind v4 (tailwindcss → @tailwindcss/postcss)`);
                  return true;
                }
              }
            }
          } catch {}
        }
        return false;
      }

      function fixViteTsconfigPaths(projectDir: string): boolean {
        const fs4 = require("fs") as typeof import("fs");
        const tsconfigPath = path.join(projectDir, "tsconfig.json");
        if (!fs4.existsSync(tsconfigPath)) return false;
        try {
          let raw = fs4.readFileSync(tsconfigPath, "utf-8");
          raw = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/,(\s*[}\]])/g, "$1");
          const parsed = JSON.parse(raw);
          const compilerOptions = parsed.compilerOptions || {};
          let changed = false;
          if (!compilerOptions.baseUrl) {
            compilerOptions.baseUrl = ".";
            changed = true;
          }
          if (!compilerOptions.paths) {
            const pkgPath = path.join(projectDir, "package.json");
            if (fs4.existsSync(pkgPath)) {
              try {
                const pkg = JSON.parse(fs4.readFileSync(pkgPath, "utf-8"));
                const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                if (allDeps["@"] || fs4.existsSync(path.join(projectDir, "src"))) {
                  compilerOptions.paths = { "@/*": ["./src/*"] };
                  changed = true;
                }
              } catch {}
            }
          }
          if (changed) {
            parsed.compilerOptions = compilerOptions;
            fs4.writeFileSync(tsconfigPath, JSON.stringify(parsed, null, 2), "utf-8");
            console.log("[AutoFix] Fixed tsconfig.json paths (added baseUrl/paths)");
            return true;
          }
        } catch {}
        return false;
      }

      function installViteMissingDep(projectDir: string, errorMessage: string, pm2: string): boolean {
        const depMatch = errorMessage.match(/Cannot find module '([^']+)'/i) ||
                         errorMessage.match(/Module not found.*Can't resolve '([^']+)'/i);
        if (!depMatch) return false;
        const raw = depMatch[1];
        if (raw.startsWith(".") || raw.startsWith("/")) return false;
        const depName = raw.startsWith("@") ? raw.split("/").slice(0, 2).join("/") : raw.split("/")[0];
        if (!depName) return false;
        try {
          const { execSync: es5 } = require("child_process") as typeof import("child_process");
          const installCmd = buildPmCommand(pm2, "add", depName);
          es5(installCmd, { cwd: projectDir, timeout: 60000, stdio: "pipe", shell: true, windowsHide: true });
          console.log(`[AutoFix] Installed missing dependency: ${depName}`);
          return true;
        } catch {}
        return false;
      }

      function deleteViteFrameworkCache(projectDir: string): boolean {
        const fs4 = require("fs") as typeof import("fs");
        const cacheDirs = [".next", ".nuxt", ".angular", "node_modules/.cache", "node_modules/.vite", ".svelte-kit", ".parcel-cache"];
        let deleted = false;
        for (const d of cacheDirs) {
          const dirPath = path.join(projectDir, d);
          if (fs4.existsSync(dirPath)) {
            try { fs4.rmSync(dirPath, { recursive: true, force: true }); console.log(`[AutoFix] Deleted cache dir: ${d}`); deleted = true; } catch {}
          }
        }
        return deleted;
      }

      function fixViteCorsConfig(projectDir: string): boolean {
        const fs4 = require("fs") as typeof import("fs");
        const viteConfigFiles = ["vite.config.ts", "vite.config.js", "vite.config.mjs"];
        for (const vcf of viteConfigFiles) {
          const vcPath = path.join(projectDir, vcf);
          if (!fs4.existsSync(vcPath)) continue;
          try {
            let content = fs4.readFileSync(vcPath, "utf-8");
            if (content.includes("cors:") || content.includes("cors :")) return false;
            content = content.replace(
              /server\s*:\s*\{/,
              "server: {\n    cors: true,"
            );
            fs4.writeFileSync(vcPath, content, "utf-8");
            console.log(`[AutoFix] Added cors:true to ${vcf}`);
            return true;
          } catch {}
        }
        const expressFiles = ["server.js", "server.ts", "app.js", "app.ts", "index.js", "index.ts", "src/server.js", "src/server.ts", "src/app.js", "src/app.ts", "src/index.js", "src/index.ts"];
        for (const ef of expressFiles) {
          const efPath = path.join(projectDir, ef);
          if (!fs4.existsSync(efPath)) continue;
          try {
            let content = fs4.readFileSync(efPath, "utf-8");
            if (content.includes("cors(") || content.includes("Access-Control-Allow-Origin")) return false;
            if (content.includes("express()") || content.includes("express.json")) {
              const corsMiddleware = "\napp.use((req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization'); if (req.method === 'OPTIONS') return res.sendStatus(204); next(); });\n";
              content = content.replace(/(const app\s*=\s*express\(\);?)/, `$1${corsMiddleware}`);
              fs4.writeFileSync(efPath, content, "utf-8");
              console.log(`[AutoFix] Added CORS middleware to ${ef}`);
              return true;
            }
          } catch {}
        }
        return false;
      }

      function updateViteSpecificPackage(projectDir: string, errorMessage: string, pm2: string): boolean {
        const fs4 = require("fs") as typeof import("fs");
        const pkgMatch = errorMessage.match(/ERR_PACKAGE_PATH_NOT_EXPORTED.*['"]([^'"]+)['"]/i) ||
                         errorMessage.match(/Package path .* is not exported.*package ['"]([^'"]+)['"]/i) ||
                         errorMessage.match(/Package subpath ['"]([^'"]+)['"] is not defined/i);
        if (!pkgMatch) return false;
        const pkgName = pkgMatch[1].startsWith("@") ? pkgMatch[1].split("/").slice(0, 2).join("/") : pkgMatch[1].split("/")[0];
        if (!pkgName || pkgName.startsWith(".")) return false;
        try {
          const { execSync: es5 } = require("child_process") as typeof import("child_process");
          const installCmd = buildPmCommand(pm2, "add", `${pkgName}@latest`);
          es5(installCmd, { cwd: projectDir, timeout: 60000, stdio: "pipe", shell: true, windowsHide: true });
          console.log(`[AutoFix] Updated ${pkgName} to latest (ERR_PACKAGE_PATH_NOT_EXPORTED fix)`);
          return true;
        } catch {}
        return false;
      }

      function buildViteAutoFixEnv(baseEnv: Record<string, string | undefined>, outputStr: string): Record<string, string | undefined> {
        const env = { ...baseEnv };
        if (/ERR_OSSL_EVP_UNSUPPORTED|digital envelope routines.*unsupported|error:0308010C/i.test(outputStr)) {
          env.NODE_OPTIONS = ((env.NODE_OPTIONS || "") + " --openssl-legacy-provider").trim();
          console.log("[AutoFix] Added --openssl-legacy-provider to NODE_OPTIONS");
        }
        if (/ENOMEM|JavaScript heap out of memory|FATAL ERROR.*Reached heap limit/i.test(outputStr)) {
          env.NODE_OPTIONS = ((env.NODE_OPTIONS || "") + " --max-old-space-size=4096").trim();
          console.log("[AutoFix] Added --max-old-space-size=4096 to NODE_OPTIONS");
        }
        return env;
      }

      async function attemptViteAutoFixStartup(projectDir: string, outputStr: string, pm2: string, safeEnv: Record<string, string | undefined>): Promise<{ fixes: string[]; classified: ReturnType<typeof classifyViteError>; installFailed: boolean }> {
        const fixes: string[] = [];
        let installFailed = false;
        const historyEntries: Array<Record<string, unknown>> = [];
        const classified = classifyViteError(outputStr);
        const fs3 = await import("fs");
        const { execSync: es4 } = await import("child_process");

        function recordFix(strategy: string, success: boolean, detail: string) {
          historyEntries.push({
            id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now(), source: "startup-autofix",
            message: outputStr.slice(0, 500),
            classified: { category: classified.category, strategy, confidence: classified.confidence },
            recovery: { attempted: true, success, detail }
          });
        }

        if (/EINTEGRITY|sha512.*integrity|checksum failed/i.test(outputStr)) {
          try {
            es4("npm cache clean --force", { cwd: projectDir, timeout: 30000, stdio: "pipe", shell: true, windowsHide: true });
            const lockFile = path.join(projectDir, "package-lock.json");
            if (fs3.existsSync(lockFile)) fs3.unlinkSync(lockFile);
            fixes.push("cache-clean");
            console.log("[AutoFix] Cleaned npm cache + deleted package-lock.json (integrity error)");
          } catch {}
        }

        if (/ENOSPC.*inotify|System limit for.*file watchers/i.test(outputStr)) {
          try { es4("sysctl -w fs.inotify.max_user_watches=524288 2>/dev/null || true", { timeout: 5000, stdio: "pipe", shell: true }); fixes.push("increase-watchers"); console.log("[AutoFix] Increased inotify watchers"); } catch {}
        }

        if (/EADDRINUSE.*:(\d+)/i.test(outputStr)) {
          const portMatch = outputStr.match(/EADDRINUSE.*:(\d+)/i);
          if (portMatch) {
            try { es4(`lsof -ti:${portMatch[1]} | xargs kill -9 2>/dev/null || true`, { timeout: 5000, stdio: "pipe", shell: true }); fixes.push("kill-port"); console.log(`[AutoFix] Killed process on port ${portMatch[1]}`); } catch {}
          }
        }

        if (/Cannot read propert.*(?:reading 'config'|postcss|tailwind)/i.test(outputStr)) {
          if (fixVitePostcssConfig(projectDir)) fixes.push("fix-postcss");
        }

        if (/tsconfig\.json.*(?:error|parse|invalid|Unexpected)/i.test(outputStr)) {
          if (fixViteTsconfigJson(projectDir)) fixes.push("fix-tsconfig");
        }

        if (/\.env.*(?:not found|missing|ENOENT)|ECONNREFUSED.*(?:5432|3306|27017|6379)/i.test(outputStr)) {
          if (copyViteEnvExample(projectDir)) fixes.push("copy-env");
        }

        if (/react-scripts.*not found|next.*command not found|ng.*not found|nuxt.*not found/i.test(outputStr)) {
          const cliMatch = outputStr.match(/(react-scripts|next|nuxt|ng)[:\s]/i);
          if (cliMatch) {
            const cli = cliMatch[1].toLowerCase();
            const pkgMap: Record<string, string> = { "react-scripts": "react-scripts", "next": "next", "nuxt": "nuxt", "ng": "@angular/cli" };
            const pkgName = pkgMap[cli];
            if (pkgName) {
              try {
                const installCmd = buildPmCommand(pm2, "add", pkgName);
                es4(installCmd, { cwd: projectDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true, env: safeEnv as NodeJS.ProcessEnv });
                fixes.push(`install-cli-${cli}`);
                console.log(`[AutoFix] Installed missing CLI: ${pkgName}`);
              } catch {}
            }
          }
        }

        if (/Could not find a declaration file|TS2307.*Cannot find module/i.test(outputStr)) {
          const typeMatch = outputStr.match(/Could not find a declaration file for module '([^']+)'/);
          if (typeMatch) {
            const mod = typeMatch[1].startsWith("@") ? typeMatch[1].split("/").slice(0, 2).join("/") : typeMatch[1].split("/")[0];
            const typePkg = `@types/${mod.replace("@", "").replace("/", "__")}`;
            try {
              const installCmd = buildPmCommand(pm2, "add-dev", typePkg);
              es4(installCmd, { cwd: projectDir, timeout: 60000, stdio: "pipe", shell: true, windowsHide: true, env: safeEnv as NodeJS.ProcessEnv });
              fixes.push(`install-types-${mod}`);
              console.log(`[AutoFix] Installed type declarations: ${typePkg}`);
            } catch {}
          }
          if (/TS2307.*Cannot find module/i.test(outputStr)) {
            if (fixViteTsconfigPaths(projectDir)) fixes.push("fix-tsconfig-paths");
          }
        }

        if (/Cannot find module '([^']+)'|Module not found.*Can't resolve '([^']+)'|MODULE_NOT_FOUND/i.test(outputStr)) {
          const livePm2 = detectPmForDir(projectDir);
          if (installViteMissingDep(projectDir, outputStr, livePm2)) fixes.push("install-missing-dep");
        }

        if (/\[vite\] Internal server error/i.test(outputStr)) {
          if (deleteViteFrameworkCache(projectDir)) fixes.push("delete-framework-cache");
        }

        if (/angular.*version.*mismatch|ng update|requires Angular/i.test(outputStr)) {
          try {
            es4("npx ng update @angular/core @angular/cli --force 2>/dev/null || true", { cwd: projectDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true });
            fixes.push("angular-update");
            console.log("[AutoFix] Angular packages updated via ng update");
          } catch {}
        }

        if (/EMFILE|too many open files/i.test(outputStr)) {
          try { es4("ulimit -n 65536 2>/dev/null || true", { timeout: 5000, stdio: "pipe", shell: true }); fixes.push("increase-ulimit"); console.log("[AutoFix] Attempted to increase file descriptor limit"); } catch {}
        }

        if (/Pre-transform error/i.test(outputStr)) {
          clearViteFrameworkCaches(projectDir);
          fixes.push("vite-force");
          console.log("[AutoFix] Cleared Vite cache for --force restart");
        }

        const cachesCleared = clearViteFrameworkCaches(projectDir);
        if (cachesCleared > 0) fixes.push(`clear-${cachesCleared}-caches`);

        if (/ERESOLVE|peer dep.*conflict|unable to resolve dependency/i.test(outputStr) || /Cannot find module|MODULE_NOT_FOUND|ENOENT.*node_modules/i.test(outputStr)) {
          try {
            const nmDir = path.join(projectDir, "node_modules");
            if (fs3.existsSync(nmDir)) { fs3.rmSync(nmDir, { recursive: true, force: true }); fixes.push("delete-node_modules"); }
            const installCmd = buildPmCommand(pm2, "install");
            es4(installCmd, { cwd: projectDir, timeout: 180000, stdio: "pipe", shell: true, windowsHide: true, env: safeEnv as NodeJS.ProcessEnv });
            fixes.push("full-reinstall");
            recordFix("full-reinstall", true, "Full reinstall completed");
            console.log("[AutoFix] Full reinstall completed");
          } catch (e: unknown) {
            try {
              es4(buildPmCommand(pm2, "install-force-ignore"), { cwd: projectDir, timeout: 180000, stdio: "pipe", shell: true, windowsHide: true, env: safeEnv as NodeJS.ProcessEnv });
              fixes.push("force-reinstall");
              recordFix("full-reinstall", true, "Force reinstall completed (fallback)");
              console.log("[AutoFix] Force reinstall completed");
            } catch (e2: unknown) {
              installFailed = true;
              const em = e2 instanceof Error ? e2.message : (e instanceof Error ? e.message : "");
              recordFix("full-reinstall", false, `Install failed: ${em.slice(0, 200)}`);
              console.log("[AutoFix] Install failed — will not continue startup");
            }
          }
        }

        if (/exec format error|cannot execute binary|is not a supported platform|Exec format error|ELF.*wrong architecture/i.test(outputStr)) {
          let nodeVer = "unknown"; let arch = "unknown";
          try { nodeVer = es4("node --version", { timeout: 5000, stdio: "pipe", encoding: "utf-8" }).toString().trim(); } catch {}
          try { arch = es4("uname -m", { timeout: 5000, stdio: "pipe", encoding: "utf-8" }).toString().trim(); } catch {}
          recordFix("upgrade-node-warning", false, `Architecture mismatch: binary not compatible with ${arch} (Node ${nodeVer}). Reinstall native dependencies or rebuild from source.`);
          fixes.push("arch-mismatch-detected");
        }

        if (fixes.length > 0) {
          for (const entry of historyEntries) viteErrorHistory.push(entry as typeof viteErrorHistory[0]);
          if (viteErrorHistory.length > 200) viteErrorHistory.splice(0, viteErrorHistory.length - 200);
        }

        return { fixes, classified, installFailed };
      }

      server.middlewares.use("/api/errors/report", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { message, stack, source, projectName: rawPN } = JSON.parse(await readBody(req));
          if (!message) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing error message" })); return; }
          const projectName = (rawPN && typeof rawPN === "string" && /^[a-zA-Z0-9_\-. ]+$/.test(rawPN) && !rawPN.includes("..")) ? rawPN : undefined;

          const classified = classifyViteError(message, stack);
          const errorEntry = {
            id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now(),
            source: source || "unknown",
            message: String(message).slice(0, 2000),
            stack: stack ? String(stack).slice(0, 4000) : undefined,
            projectName: projectName || undefined,
            classified,
            recovery: null as { attempted: boolean; success: boolean; detail: string; strategy?: string; durationMs?: number } | null,
          };

          viteErrorHistory.push(errorEntry);
          if (viteErrorHistory.length > 200) viteErrorHistory.splice(0, viteErrorHistory.length - 200);

          console.log(`[AutoFix] Error reported: [${classified.category}] ${String(message).slice(0, 100)} (confidence: ${Math.round(classified.confidence * 100)}%)`);

          let recovery = { attempted: false, success: false, detail: "No auto-fix available" };

          if (classified.confidence >= 0.5 && !isViteRateLimited(message)) {
            recordViteAttempt(message);

            if (classified.strategy === "restart-vite" && projectName) {
              const previewEntry = previewProcesses.get(projectName);
              if (previewEntry) {
                try {
                  previewEntry.process.kill("SIGTERM");
                  previewProcesses.delete(projectName);
                  recovery = { attempted: true, success: true, detail: "Preview terminated — will restart on next request" };
                  console.log(`[AutoFix] Killed preview ${projectName} for restart`);
                } catch (e: unknown) {
                  const em = e instanceof Error ? e.message : String(e);
                  recovery = { attempted: true, success: false, detail: `Kill failed: ${em}` };
                }
              }
            } else if (classified.strategy === "clear-cache-restart" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              try {
                clearViteFrameworkCaches(projDir);
                const previewEntry = previewProcesses.get(projectName);
                if (previewEntry) { previewEntry.process.kill("SIGTERM"); previewProcesses.delete(projectName); }
                recovery = { attempted: true, success: true, detail: "Caches cleared + preview terminated" };
                console.log(`[AutoFix] Cleared caches for ${projectName}`);
                scheduleViteAutoRestart(projectName, projDir, String(previewEntry?.port || 0));
              } catch (e: unknown) {
                const em = e instanceof Error ? e.message : String(e);
                recovery = { attempted: true, success: false, detail: `Cache clear failed: ${em}` };
              }
            } else if (classified.strategy === "install-missing-dep" && projectName) {
              const { execSync: exec2 } = await import("child_process");
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              const pm3 = detectPmForDir(projDir);
              try {
                const targeted = installViteMissingDep(projDir, message || "", pm3);
                if (!targeted) {
                  const installCmd4 = buildPmCommand(pm3, "install");
                  exec2(installCmd4, { cwd: projDir, timeout: 120000, stdio: "pipe", shell: true });
                }
                recovery = { attempted: true, success: true, detail: targeted ? "Missing dependency installed" : "Dependencies reinstalled (install-missing-dep fallback)" };
              } catch (e: unknown) {
                const em = e instanceof Error ? e.message : String(e);
                recovery = { attempted: true, success: false, detail: `Dependency install failed: ${em.slice(0, 200)}` };
              }
            } else if (classified.strategy === "delete-framework-cache" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              deleteViteFrameworkCache(projDir);
              const previewEntry = previewProcesses.get(projectName);
              if (previewEntry) { try { previewEntry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(projectName); }
              recovery = { attempted: true, success: true, detail: "Framework cache deleted + preview killed for restart" };
              scheduleViteAutoRestart(projectName, projDir, String(previewEntry?.port || 0));
            } else if ((classified.strategy === "npm-install" || classified.strategy === "legacy-peer-deps" || classified.strategy === "full-reinstall" || classified.strategy === "cache-clean-reinstall" || classified.strategy === "full-install-retry" || classified.strategy === "install-missing-cli" || classified.strategy === "install-types") && projectName) {
              const { execSync: exec2 } = await import("child_process");
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              try {
                if (classified.strategy === "cache-clean-reinstall") {
                  try { exec2("npm cache clean --force", { cwd: projDir, timeout: 30000, stdio: "pipe", shell: true }); } catch {}
                  const fs2 = await import("fs");
                  const lockFile = path.join(projDir, "package-lock.json");
                  if (fs2.existsSync(lockFile)) fs2.unlinkSync(lockFile);
                }
                console.log(`[AutoFix] Installing deps for ${projectName} (${classified.strategy})...`);
                const pm3 = detectPmForDir(projDir);
                const installSteps2 = buildInstallCascade(pm3);
                let installOk2 = false;
                for (const cmd of installSteps2) {
                  try { exec2(cmd, { cwd: projDir, timeout: 120000, stdio: "pipe", shell: true }); installOk2 = true; break; } catch {}
                }
                if (installOk2) {
                  recovery = { attempted: true, success: true, detail: `Dependencies reinstalled (${classified.strategy})` };
                } else {
                  recovery = { attempted: true, success: false, detail: "All install strategies failed (legacy-peer-deps → force → ignore-scripts)" };
                }
              } catch (e: unknown) {
                const em = e instanceof Error ? e.message : String(e);
                recovery = { attempted: true, success: false, detail: `Install failed: ${em.slice(0, 200)}` };
              }
            } else if (classified.strategy === "update-package" && projectName) {
              const { execSync: exec2 } = await import("child_process");
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              const pm3 = detectPmForDir(projDir);
              try {
                const targeted = updateViteSpecificPackage(projDir, message || "", pm3);
                if (!targeted) {
                  const installCmd4 = buildPmCommand(pm3, "install");
                  exec2(installCmd4, { cwd: projDir, timeout: 120000, stdio: "pipe", shell: true });
                }
                recovery = { attempted: true, success: true, detail: targeted ? "Updated offending package to latest" : "Dependencies reinstalled (update-package fallback)" };
              } catch (e: unknown) {
                const em = e instanceof Error ? e.message : String(e);
                recovery = { attempted: true, success: false, detail: `Package update failed: ${em.slice(0, 200)}` };
              }
            } else if (classified.strategy === "fix-postcss-config" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              fixVitePostcssConfig(projDir);
              const previewEntry = previewProcesses.get(projectName);
              if (previewEntry) { try { previewEntry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(projectName); }
              recovery = { attempted: true, success: true, detail: "PostCSS config fixed" };
              scheduleViteAutoRestart(projectName, projDir, String(previewEntry?.port || 0));
            } else if (classified.strategy === "fix-tsconfig" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              fixViteTsconfigJson(projDir);
              recovery = { attempted: true, success: true, detail: "tsconfig.json fixed" };
            } else if (classified.strategy === "copy-env-example" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              const copied = copyViteEnvExample(projDir);
              recovery = { attempted: true, success: copied, detail: copied ? "Copied .env.example → .env" : "No .env example found" };
            } else if (classified.strategy === "kill-port") {
              const portMatch = message.match(/EADDRINUSE.*:(\d+)/i);
              if (portMatch) {
                try {
                  const { execSync: exec2 } = await import("child_process");
                  exec2(`lsof -ti:${portMatch[1]} | xargs kill -9 2>/dev/null || true`, { timeout: 5000, stdio: "pipe", shell: true });
                  recovery = { attempted: true, success: true, detail: `Killed process on port ${portMatch[1]}` };
                } catch { recovery = { attempted: true, success: false, detail: "Failed to kill port" }; }
              }
            } else if (classified.strategy === "vite-force" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              clearViteFrameworkCaches(projDir);
              const previewEntry = previewProcesses.get(projectName);
              if (previewEntry) { try { previewEntry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(projectName); }
              recovery = { attempted: true, success: true, detail: "Cleared Vite cache + preview killed for --force restart" };
              scheduleViteAutoRestart(projectName, projDir, String(previewEntry?.port || 0));
            } else if (classified.strategy === "fix-tsconfig-paths" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              fixViteTsconfigPaths(projDir);
              const previewEntry = previewProcesses.get(projectName);
              if (previewEntry) { try { previewEntry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(projectName); }
              recovery = { attempted: true, success: true, detail: "tsconfig.json paths fixed + preview killed for restart" };
              scheduleViteAutoRestart(projectName, projDir, String(previewEntry?.port || 0));
            } else if (classified.strategy === "extend-timeout") {
              recovery = { attempted: true, success: true, detail: "Startup timeout extended — waiting longer for dev server" };
            } else if (classified.strategy === "upgrade-node-warning") {
              let nodeVer = "unknown";
              try { const { execSync: exec5 } = await import("child_process"); nodeVer = exec5("node --version", { timeout: 5000, stdio: "pipe", encoding: "utf-8" }).toString().trim(); } catch {}
              recovery = { attempted: true, success: false, detail: `Node.js version mismatch: current ${nodeVer} does not support modern syntax (optional chaining, nullish coalescing, etc.). Please upgrade Node.js to v14+ (v18+ recommended).` };
            } else if (classified.strategy === "cors-config") {
              if (projectName) {
                const projDir = path.resolve(process.cwd(), "projects", projectName);
                const fixed = fixViteCorsConfig(projDir);
                if (fixed) {
                  const previewEntry = previewProcesses.get(projectName);
                  if (previewEntry) { try { previewEntry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(projectName); }
                  recovery = { attempted: true, success: true, detail: "CORS config patched + preview killed for restart" };
                  scheduleViteAutoRestart(projectName, projDir, String(previewEntry?.port || 0));
                } else {
                  recovery = { attempted: true, success: false, detail: "CORS error detected — could not auto-patch. Add cors:true to vite server config or CORS middleware to Express app." };
                }
              } else {
                recovery = { attempted: false, success: false, detail: "CORS error detected — no project context for auto-fix." };
              }
            } else if (classified.strategy === "increase-ulimit") {
              try { const { execSync: exec5 } = await import("child_process"); exec5("ulimit -n 65536 2>/dev/null || true", { timeout: 5000, stdio: "pipe", shell: true }); } catch {}
              const previewEntry = previewProcesses.get(projectName || "");
              if (previewEntry) { try { previewEntry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(projectName || ""); }
              recovery = { attempted: true, success: true, detail: "Increased file descriptor limit + preview killed for restart" };
              if (projectName) scheduleViteAutoRestart(projectName, path.resolve(process.cwd(), "projects", projectName), String(previewEntry?.port || 0));
            } else if (classified.strategy === "increase-watchers") {
              try { const { execSync: exec5 } = await import("child_process"); exec5("sysctl -w fs.inotify.max_user_watches=524288 2>/dev/null || true", { timeout: 5000, stdio: "pipe", shell: true }); } catch {}
              const previewEntry = previewProcesses.get(projectName || "");
              if (previewEntry) { try { previewEntry.process.kill("SIGTERM"); } catch {} previewProcesses.delete(projectName || ""); }
              recovery = { attempted: true, success: true, detail: "Increased inotify watchers + preview killed for restart" };
              if (projectName) scheduleViteAutoRestart(projectName, path.resolve(process.cwd(), "projects", projectName), String(previewEntry?.port || 0));
            } else if (classified.strategy === "add-type-module" && projectName) {
              const fs2 = await import("fs");
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              const pkgJsonPath = path.join(projDir, "package.json");
              try {
                if (fs2.existsSync(pkgJsonPath)) {
                  const pObj = JSON.parse(fs2.readFileSync(pkgJsonPath, "utf-8"));
                  const errMsg = body.message || body.error || "";
                  const needsRemove = /require is not defined in ES module|ReferenceError: require is not defined|__dirname is not defined|__filename is not defined/i.test(errMsg);
                  if (needsRemove && pObj.type === "module") {
                    delete pObj.type;
                    fs2.writeFileSync(pkgJsonPath, JSON.stringify(pObj, null, 2), "utf-8");
                    recovery = { attempted: true, success: true, detail: "Removed type:module from package.json (CJS compat)" };
                  } else if (!needsRemove && pObj.type !== "module") {
                    pObj.type = "module";
                    fs2.writeFileSync(pkgJsonPath, JSON.stringify(pObj, null, 2), "utf-8");
                    recovery = { attempted: true, success: true, detail: "Added type:module to package.json" };
                  } else {
                    recovery = { attempted: true, success: true, detail: "type:module already correct" };
                  }
                }
              } catch { recovery = { attempted: true, success: false, detail: "Failed to toggle type:module" }; }
            } else if (classified.strategy === "angular-update" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              try {
                const { execSync: exec6 } = await import("child_process");
                exec6("npx ng update @angular/core @angular/cli --force 2>/dev/null || true", { cwd: projDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true });
                recovery = { attempted: true, success: true, detail: "Angular packages updated via ng update" };
              } catch { recovery = { attempted: true, success: false, detail: "Angular update failed — try manual ng update" }; }
            } else if ((classified.strategy === "openssl-legacy-provider" || classified.strategy === "increase-heap") && projectName) {
              recovery = { attempted: true, success: true, detail: `Will apply ${classified.strategy} on next preview start` };
            } else if (classified.strategy === "code-fix" && projectName && classified.file) {
              const fs2 = await import("fs");
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              const filePath = path.resolve(projDir, classified.file);
              if (!filePath.startsWith(projDir + path.sep) && filePath !== projDir) {
                recovery = { attempted: true, success: false, detail: "Path traversal blocked" };
              } else try {
                if (fs2.existsSync(filePath)) {
                  const originalContent = fs2.readFileSync(filePath, "utf-8");
                  const backupPath = filePath + ".autofix-backup";
                  fs2.writeFileSync(backupPath, originalContent, "utf-8");

                  let fixedContent: string | null = null;

                  if (classified.category === "reference-error" && classified.symbol) {
                    const sym = classified.symbol;
                    if (!originalContent.includes("import") || !originalContent.includes(sym)) {
                      const fromMatch = originalContent.match(/from\s+['"]([^'"]+)['"]/);
                      if (fromMatch) {
                        fixedContent = `import { ${sym} } from '${fromMatch[1]}';\n${originalContent}`;
                      }
                    }
                  } else if (classified.category === "type-error" && classified.line) {
                    const lines = originalContent.split("\n");
                    const lineIdx = classified.line - 1;
                    if (lineIdx >= 0 && lineIdx < lines.length) {
                      const dotAccess = lines[lineIdx].match(/(\w+)\.(\w+)/);
                      if (dotAccess) {
                        lines[lineIdx] = lines[lineIdx].replace(
                          `${dotAccess[1]}.${dotAccess[2]}`,
                          `${dotAccess[1]}?.${dotAccess[2]}`
                        );
                        fixedContent = lines.join("\n");
                      }
                    }
                  } else if (classified.category === "export-missing" && classified.symbol) {
                    const sym = classified.symbol;
                    const funcMatch = originalContent.match(new RegExp(`(?:function|const|let|var|class)\\s+${sym}\\b`));
                    if (funcMatch && !originalContent.match(new RegExp(`export\\s+(?:default\\s+)?(?:function|const|let|var|class)\\s+${sym}\\b`))) {
                      fixedContent = originalContent.replace(
                        new RegExp(`(function|const|let|var|class)\\s+(${sym}\\b)`),
                        "export $1 $2"
                      );
                    }
                  }

                  if (!fixedContent || fixedContent === originalContent) {
                    try {
                      const settingsPath2 = path.resolve(process.env.HOME || "~", ".guardian-ai", "settings.json");
                      const settings2 = JSON.parse(fs2.readFileSync(settingsPath2, "utf-8"));
                      if (settings2.grokApiKey) {
                        const prompt2 = `Fix this ${classified.category} error in file "${classified.file}":\n\nError: ${message}\n${classified.line ? `Line: ${classified.line}` : ""}${classified.symbol ? `\nSymbol: ${classified.symbol}` : ""}\n\nCurrent file content:\n\`\`\`\n${originalContent.slice(0, 6000)}\n\`\`\`\n\nRespond with ONLY the fixed file content, no explanation. If you cannot fix it, respond with exactly "CANNOT_FIX".`;
                        const grokResp2 = await fetch("https://api.x.ai/v1/chat/completions", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${settings2.grokApiKey}` },
                          body: JSON.stringify({ model: "grok-3-mini", messages: [{ role: "user", content: prompt2 }], max_tokens: 8000 }),
                        });
                        if (grokResp2.ok) {
                          const grokData2 = await grokResp2.json() as { choices?: { message?: { content?: string } }[] };
                          const fixedRaw2 = grokData2.choices?.[0]?.message?.content || "";
                          if (!fixedRaw2.includes("CANNOT_FIX") && fixedRaw2.trim()) {
                            const cbMatch = fixedRaw2.match(/```(?:\w+)?\n([\s\S]+?)```/);
                            fixedContent = cbMatch ? cbMatch[1].trim() : fixedRaw2.trim();
                            console.log(`[AutoFix] Grok provided fix for ${classified.file}`);
                          }
                        }
                      }
                    } catch {}
                  }

                  if (fixedContent && fixedContent !== originalContent) {
                    fs2.writeFileSync(filePath, fixedContent, "utf-8");

                    let validationOk = true;
                    if (/\.[jt]sx?$/.test(classified.file)) {
                      const braces = (fixedContent.match(/{/g) || []).length !== (fixedContent.match(/}/g) || []).length;
                      const parens = (fixedContent.match(/\(/g) || []).length !== (fixedContent.match(/\)/g) || []).length;
                      if (braces || parens) validationOk = false;
                    }

                    if (!validationOk) {
                      console.log(`[AutoFix] Fix validation failed — reverting ${classified.file}`);
                      fs2.writeFileSync(filePath, originalContent, "utf-8");
                      recovery = { attempted: true, success: false, detail: `Fix applied but failed validation — reverted ${classified.file}` };
                    } else {
                      console.log(`[AutoFix] Applied and validated code fix for ${classified.file}`);
                      recovery = { attempted: true, success: true, detail: `Fixed ${classified.category} in ${classified.file}` };
                    }
                  } else {
                    recovery = { attempted: true, success: false, detail: `No fix available for ${classified.category} in ${classified.file}` };
                  }
                } else {
                  recovery = { attempted: true, success: false, detail: `File not found: ${classified.file}` };
                }
              } catch (e: unknown) {
                const em = e instanceof Error ? e.message : String(e);
                recovery = { attempted: true, success: false, detail: `Code fix failed: ${em}` };
              }
            } else if (classified.strategy === "retry") {
              recovery = { attempted: true, success: true, detail: "Marked for retry on next occurrence" };
            }
          }

          errorEntry.recovery = recovery;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ reported: true, id: errorEntry.id, classified, recovery }));
        } catch (err: unknown) {
          res.statusCode = 500;
          const em = err instanceof Error ? err.message : String(err);
          res.end(JSON.stringify({ error: em }));
        }
      });

      server.middlewares.use("/api/errors/history", async (req, res) => {
        const url2 = new URL(req.url || "/", "http://localhost");
        const limit = parseInt(url2.searchParams.get("limit") || "50", 10) || 50;
        const recent = viteErrorHistory.slice(-limit);
        const total = viteErrorHistory.length;
        const autoFixed = viteErrorHistory.filter((e: { recovery?: { success?: boolean } }) => e.recovery?.success).length;
        const escalated = viteErrorHistory.filter((e: { classified?: { strategy?: string } }) => e.classified?.strategy === "escalate").length;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ errors: recent, stats: { total, autoFixed, escalated } }));
      });

      // ─── Grok Responses API with Function Calling ─────────────────────
      const GROK_FC_TOOLS = [
        { type: "function", name: "take_screenshot", description: "Take a screenshot of the running app preview. Returns a public Catbox.moe image URL.", parameters: { type: "object", properties: { project: { type: "string", description: "Project name" } }, required: ["project"] } },
        { type: "function", name: "read_file", description: "Read a file from the project.", parameters: { type: "object", properties: { project: { type: "string" }, path: { type: "string" } }, required: ["project", "path"] } },
        { type: "function", name: "write_file", description: "Write/overwrite a file in the project.", parameters: { type: "object", properties: { project: { type: "string" }, path: { type: "string" }, content: { type: "string" } }, required: ["project", "path", "content"] } },
        { type: "function", name: "search_replace", description: "Find and replace text in a file.", parameters: { type: "object", properties: { project: { type: "string" }, path: { type: "string" }, search: { type: "string" }, replace: { type: "string" }, replaceAll: { type: "boolean" } }, required: ["project", "path", "search", "replace"] } },
        { type: "function", name: "run_command", description: "Run a shell command in the project directory.", parameters: { type: "object", properties: { project: { type: "string" }, command: { type: "string" } }, required: ["project", "command"] } },
        { type: "function", name: "list_tree", description: "List the file tree of the project.", parameters: { type: "object", properties: { project: { type: "string" } }, required: ["project"] } },
        { type: "function", name: "grep_search", description: "Search for a pattern across all project files.", parameters: { type: "object", properties: { project: { type: "string" }, pattern: { type: "string" } }, required: ["project", "pattern"] } },
        { type: "function", name: "console_logs", description: "Get console/preview logs from the running app.", parameters: { type: "object", properties: { project: { type: "string" } }, required: ["project"] } },
        { type: "function", name: "read_snapshot", description: "Read the full project snapshot (file tree + all source files).", parameters: { type: "object", properties: { project: { type: "string" } }, required: ["project"] } },
        { type: "function", name: "browser_interact", description: "Interact with the live preview (click, type, evaluate JS).", parameters: { type: "object", properties: { project: { type: "string" }, action: { type: "string", enum: ["click", "type", "evaluate", "waitFor"] }, selector: { type: "string" }, value: { type: "string" }, script: { type: "string" }, screenshot: { type: "boolean" } }, required: ["project", "action"] } },
      ];

      async function executeGrokFunctionCall(name: string, args: any, bridgeRelayUrl: string, bridgeKey: string): Promise<string> {
        const project = args.project || "";
        let actions: any[] = [];

        switch (name) {
          case "take_screenshot":
            actions = [{ type: "screenshot_preview", project }];
            break;
          case "read_file":
            actions = [{ type: "read_file", project, path: args.path }];
            break;
          case "write_file":
            actions = [{ type: "write_file", project, path: args.path, content: args.content }];
            break;
          case "search_replace":
            actions = [{ type: "search_replace", project, path: args.path, search: args.search, replace: args.replace, replaceAll: args.replaceAll }];
            break;
          case "run_command":
            actions = [{ type: "run_command", project, command: args.command }];
            break;
          case "list_tree":
            actions = [{ type: "list_tree", project }];
            break;
          case "grep_search":
            actions = [{ type: "grep", project, pattern: args.pattern }];
            break;
          case "console_logs": {
            try {
              const clUrl = `${bridgeRelayUrl}/api/console-logs?key=${encodeURIComponent(bridgeKey)}&project=${encodeURIComponent(project)}`;
              const clResp = await fetch(clUrl);
              return await clResp.text();
            } catch (e: any) {
              return JSON.stringify({ error: e.message });
            }
          }
          case "read_snapshot": {
            try {
              const snapUrl = `${bridgeRelayUrl}/api/snapshot/${encodeURIComponent(project)}?key=${encodeURIComponent(bridgeKey)}`;
              const snapResp = await fetch(snapUrl);
              const snapText = await snapResp.text();
              return snapText.length > 80000 ? snapText.slice(0, 80000) + "\n...(truncated)" : snapText;
            } catch (e: any) {
              return JSON.stringify({ error: e.message });
            }
          }
          case "browser_interact":
            actions = [{ type: "browser_interact", project, action: args.action, selector: args.selector, value: args.value, script: args.script, screenshot: args.screenshot }];
            break;
          default:
            return JSON.stringify({ error: `Unknown function: ${name}` });
        }

        try {
          const execUrl = `${bridgeRelayUrl}/api/sandbox/execute?key=${encodeURIComponent(bridgeKey)}`;
          const execResp = await fetch(execUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actions }),
          });
          const result = await execResp.text();
          return result.length > 80000 ? result.slice(0, 80000) + "\n...(truncated)" : result;
        } catch (e: any) {
          return JSON.stringify({ error: e.message });
        }
      }

      server.middlewares.use("/api/grok-responses", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const body = JSON.parse(await readBody(req));
          const { messages, model, project, bridgeRelayUrl: clientRelayUrl, bridgeKey: clientBridgeKey, systemPrompt } = body;

          if (!messages || !Array.isArray(messages)) {
            res.statusCode = 400; res.end(JSON.stringify({ error: "messages array required" })); return;
          }

          const fs2 = await import("fs");
          let apiKey = process.env.XAI_API || process.env.XAI_API_KEY || "";
          if (!apiKey) {
            try {
              const settingsPath = path.resolve(process.env.HOME || "~", ".guardian-ai", "settings.json");
              const settings = JSON.parse(fs2.readFileSync(settingsPath, "utf-8"));
              apiKey = settings.grokApiKey || "";
            } catch {}
          }
          if (!apiKey) { res.statusCode = 400; res.end(JSON.stringify({ error: "XAI API key not configured" })); return; }

          const relayUrl = clientRelayUrl || BRIDGE_RELAY_URL;
          const bKey = clientBridgeKey || bridgeRelayKey || snapshotKey;
          const useModel = model || "grok-4-0709";

          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.setHeader("Access-Control-Allow-Origin", "*");

          const sendSSE = (event: string, data: any) => {
            if (res.destroyed) return;
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          };

          const chatMessages = [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            ...messages,
          ];

          let loopCount = 0;
          const MAX_LOOPS = 15;
          let previousResponseId: string | null = null;

          while (loopCount < MAX_LOOPS) {
            loopCount++;
            if (res.destroyed) { console.log("[grok-responses] Client disconnected, stopping loop"); return; }

            sendSSE("status", { phase: loopCount === 1 ? "calling-grok" : "calling-grok-with-results", loop: loopCount });

            let xaiBody: any;
            if (previousResponseId) {
              xaiBody = {
                model: useModel,
                previous_response_id: previousResponseId,
                tools: GROK_FC_TOOLS,
                input: chatMessages.slice(-1).map((m: any) => ({
                  type: "function_call_output",
                  call_id: m.call_id,
                  output: m.output,
                })),
              };
            } else {
              xaiBody = {
                model: useModel,
                tools: GROK_FC_TOOLS,
                input: chatMessages.map((m: any) => {
                  if (m.role === "system") return { role: "developer", content: m.content };
                  return { role: m.role, content: m.content };
                }),
              };
            }

            const xaiResp = await fetch("https://api.x.ai/v1/responses", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
              body: JSON.stringify(xaiBody),
            });

            if (!xaiResp.ok) {
              const errText = await xaiResp.text();
              sendSSE("error", { error: `xAI API error ${xaiResp.status}: ${errText}` });
              res.end();
              return;
            }

            const xaiData = await xaiResp.json();
            previousResponseId = xaiData.id;

            const output = xaiData.output || [];
            const functionCalls = output.filter((o: any) => o.type === "function_call");
            const textOutputs = output.filter((o: any) => o.type === "message");

            if (functionCalls.length === 0) {
              let finalText = "";
              for (const msg of textOutputs) {
                if (msg.content) {
                  for (const part of msg.content) {
                    if (part.type === "output_text" || part.text) finalText += part.text || "";
                  }
                }
              }
              sendSSE("text", { content: finalText });
              sendSSE("done", { loops: loopCount });
              res.end();
              return;
            }

            const functionResults: any[] = [];
            for (const fc of functionCalls) {
              const fnName = fc.name;
              let fnArgs: any = {};
              try { fnArgs = typeof fc.arguments === "string" ? JSON.parse(fc.arguments) : fc.arguments || {}; } catch {}

              if (!fnArgs.project && project) fnArgs.project = project;

              sendSSE("function_call", { name: fnName, arguments: fnArgs, call_id: fc.call_id });

              const result = await executeGrokFunctionCall(fnName, fnArgs, relayUrl, bKey);

              sendSSE("function_result", { name: fnName, call_id: fc.call_id, result: result.length > 2000 ? result.slice(0, 2000) + "...(truncated in SSE, full sent to Grok)" : result });

              functionResults.push({
                type: "function_call_output",
                call_id: fc.call_id,
                output: result,
              });
            }

            chatMessages.splice(0, chatMessages.length, ...functionResults);
          }

          sendSSE("error", { error: "Max function-calling loops reached" });
          res.end();
        } catch (err: any) {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        }
      });

      server.middlewares.use("/api/grok-fix", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { filePath: fp, content, errorMessage, category, line, symbol } = JSON.parse(await readBody(req));
          if (!fp || !content || !errorMessage) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing required fields" })); return; }

          const fs2 = await import("fs");
          const settingsPath = path.resolve(process.env.HOME || "~", ".guardian-ai", "settings.json");
          let grokApiKey: string | undefined;
          try {
            const settings = JSON.parse(fs2.readFileSync(settingsPath, "utf-8"));
            grokApiKey = settings.grokApiKey;
          } catch {}

          if (!grokApiKey) { res.statusCode = 400; res.end(JSON.stringify({ error: "Grok API key not configured" })); return; }

          const prompt = `Fix this ${category || "unknown"} error in file "${fp}":\n\nError: ${errorMessage}\n${line ? `Line: ${line}` : ""}${symbol ? `\nSymbol: ${symbol}` : ""}\n\nCurrent file content:\n\`\`\`\n${String(content).slice(0, 6000)}\n\`\`\`\n\nRespond with ONLY the fixed file content, no explanation. If you cannot fix it, respond with exactly "CANNOT_FIX".`;

          const grokResp = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${grokApiKey}` },
            body: JSON.stringify({ model: "grok-3-mini", messages: [{ role: "user", content: prompt }], max_tokens: 8000 }),
          });
          if (!grokResp.ok) { res.statusCode = 502; res.end(JSON.stringify({ error: "Grok API error" })); return; }
          const grokData = await grokResp.json() as { choices?: { message?: { content?: string } }[] };
          const fixedRaw = grokData.choices?.[0]?.message?.content || "";

          if (fixedRaw.includes("CANNOT_FIX") || !fixedRaw.trim()) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ fixedContent: null, reason: "Grok could not fix this error" }));
            return;
          }

          let fixedContent = fixedRaw;
          const codeBlockMatch = fixedRaw.match(/```(?:\w+)?\n([\s\S]+?)```/);
          if (codeBlockMatch) fixedContent = codeBlockMatch[1];

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ fixedContent: fixedContent.trim() }));
        } catch (err: unknown) {
          res.statusCode = 500;
          const em = err instanceof Error ? err.message : String(err);
          res.end(JSON.stringify({ error: em }));
        }
      });

      server.middlewares.use("/api/validate-file", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { filePath: fp } = JSON.parse(await readBody(req));
          if (!fp) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing filePath" })); return; }

          const fs2 = await import("fs");
          const absPath = path.isAbsolute(fp) ? fp : path.resolve(process.cwd(), fp);
          if (!fs2.existsSync(absPath)) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ valid: false, reason: "File not found" }));
            return;
          }

          const content = fs2.readFileSync(absPath, "utf-8");

          if (fp.endsWith(".json")) {
            try {
              JSON.parse(content);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ valid: true }));
              return;
            } catch (e: unknown) {
              const em = e instanceof Error ? e.message : String(e);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ valid: false, reason: `JSON parse error: ${em}` }));
              return;
            }
          }

          if (/\.[jt]sx?$/.test(fp)) {
            const hasUnmatchedBraces = (content.match(/{/g) || []).length !== (content.match(/}/g) || []).length;
            const hasUnmatchedParens = (content.match(/\(/g) || []).length !== (content.match(/\)/g) || []).length;
            if (hasUnmatchedBraces || hasUnmatchedParens) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ valid: false, reason: "Unmatched braces or parentheses" }));
              return;
            }
          }

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ valid: true }));
        } catch (err: unknown) {
          res.statusCode = 500;
          const em = err instanceof Error ? err.message : String(err);
          res.end(JSON.stringify({ error: em }));
        }
      });

      server.middlewares.use("/api/projects/install-deps", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name, dependencies, devDependencies, fullInstall } = JSON.parse(await readBody(req));
          if (!name || /[\/\\]|\.\./.test(name)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid project name" })); return; }

          const fs = await import("fs");
          const projectDir = path.resolve(process.cwd(), "projects", name);
          if (!fs.existsSync(projectDir)) { res.statusCode = 404; res.end(JSON.stringify({ error: "Project not found" })); return; }

          const pkgJsonPath = path.join(projectDir, "package.json");
          let pkgJsonValid = false;
          if (fs.existsSync(pkgJsonPath)) {
            try { JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")); pkgJsonValid = true; } catch {}
          }
          if (!pkgJsonValid) {
            fs.writeFileSync(pkgJsonPath, JSON.stringify({ name, version: "0.0.1", private: true }, null, 2));
          }

          let pm = "npm";
          if (fs.existsSync(path.join(projectDir, "bun.lockb")) || fs.existsSync(path.join(projectDir, "bun.lock"))) pm = "bun";
          else if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml")) || fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"))) pm = "pnpm";
          else if (fs.existsSync(path.join(projectDir, "yarn.lock"))) pm = "yarn";

          const depsInstallEnv = { ...process.env, HUSKY: "0", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" };

          if (fullInstall && !dependencies?.length && !devDependencies?.length) {
            const installCmd = buildPmCommand(pm, "install");
            console.log(`[Deps] Running full install: ${installCmd} in ${name}`);
            if (!fs.existsSync(path.join(projectDir, ".git"))) { try { fs.mkdirSync(path.join(projectDir, ".git"), { recursive: true }); } catch {} }
            const { exec: execFull } = await import("child_process");
            return execFull(installCmd, { cwd: projectDir, timeout: 180000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: depsInstallEnv }, (err, _stdout, stderr) => {
              if (err) {
                console.log(`[Deps] Full install warning for ${name}: ${stderr?.slice(0, 200)}`);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: stderr?.slice(0, 300) || err.message }));
                return;
              }
              console.log(`[Deps] Full install complete for ${name}`);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, results: ["full install complete"] }));
            });
          }

          const results: string[] = [];
          const { exec: execAsync } = await import("child_process");
          const validPkg = /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+(@[^\s]*)?$/;
          const notAPkg = new Set(["npm","npx","yarn","pnpm","bun","node","deno","run","dev","start","build","test","serve","watch","lint","deploy","preview","install","add","remove","uninstall","update","init","create","cd","ls","mkdir","rm","cp","mv","cat","echo","touch","git","curl","wget","then","and","or","the","a","an","to","in","of","for","with","from","your","this","that","it","is","are","was","be","has","have","do","does","if","not","no","yes","on","off","up","so","but","by","at","as","server","app","application","project","file","directory","folder","next","first","following","above","below","after","before","all","any","each","every","both","new","old"]);
          const filterPkgs = (arr: string[]) => (arr || []).filter((d: string) => {
            if (!validPkg.test(d) || /[;&|`$(){}]/.test(d)) return false;
            const base = d.replace(/@[^\s]*$/, '').toLowerCase();
            return !notAPkg.has(base) && (base.length > 1 || d.startsWith('@'));
          });
          const safeDeps = filterPkgs(dependencies || []);
          const safeDevDeps = filterPkgs(devDependencies || []);

          const buildInstallCmd = (pkgs: string[], isDev: boolean): string => {
            return buildPmCommand(pm, isDev ? "add-dev" : "add", pkgs.join(" "));
          };
          if (!fs.existsSync(path.join(projectDir, ".git"))) { try { fs.mkdirSync(path.join(projectDir, ".git"), { recursive: true }); } catch {} }
          const errors: string[] = [];
          const runInstall = (pkgs: string[], isDev: boolean): Promise<void> => new Promise((resolve) => {
            const cmd = buildInstallCmd(pkgs, isDev);
            console.log(`[Deps] Running: ${cmd} in ${name}`);
            execAsync(cmd, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: depsInstallEnv }, (err, _stdout, stderr) => {
              if (err) {
                console.error(`[Deps] Failed: ${cmd}`, stderr?.slice(0, 300) || err.message?.slice(0, 300));
                const fallbackCmd = pm !== "npm"
                  ? buildPmCommand("npm", isDev ? "add-dev" : "add", pkgs.join(" "))
                  : `${cmd} --ignore-scripts`;
                console.log(`[Deps] Retrying: ${fallbackCmd}`);
                execAsync(fallbackCmd, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: depsInstallEnv }, (err2) => {
                  if (err2) errors.push(`Failed: Command failed: ${cmd}`);
                  resolve();
                });
              } else {
                resolve();
              }
            });
          });

          if (safeDeps.length > 0) {
            await runInstall(safeDeps, false);
            if (errors.length === 0) results.push(`Installed: ${safeDeps.join(", ")}`);
          }

          if (safeDevDeps.length > 0) {
            const prevErrors = errors.length;
            await runInstall(safeDevDeps, true);
            if (errors.length === prevErrors) results.push(`Installed dev: ${safeDevDeps.join(", ")}`);
          }

          res.setHeader("Content-Type", "application/json");
          const success = errors.length === 0;
          res.end(JSON.stringify({ success, results, errors }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/run-command", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name, command } = JSON.parse(await readBody(req));
          if (!command || typeof command !== "string") { res.statusCode = 400; res.end(JSON.stringify({ error: "No command specified" })); return; }

          const check = validateProjectPath(name || "");
          if (!check.valid) { res.statusCode = 403; res.end(JSON.stringify({ success: false, error: check.error })); return; }

          const allowedPrefixes = [
            "npm ", "npx ", "yarn ", "pnpm ", "bun ",
            "node ", "deno ", "tsc", "tsx ",
            "corepack ", "nvm ", "fnm ",
            "mkdir ", "cp ", "mv ", "rm ", "touch ", "cat ", "ls ", "pwd",
            "chmod ", "chown ", "ln ",
            "git ", "curl ", "wget ",
            "python", "pip", "cargo ", "go ", "rustc", "gcc", "g++", "make",
            "docker ", "docker-compose ",
          ];
          const trimmed = command.trim().replace(/\s+#\s+.*$/, '').trim();
          if (/[\r\n\x00]/.test(trimmed)) { res.statusCode = 403; res.end(JSON.stringify({ error: "Control characters not allowed in commands" })); return; }

          if (/^curl-install:https?:\/\//i.test(trimmed)) {
            const scriptUrl = trimmed.replace(/^curl-install:/i, "");
            try {
              const fs = await import("fs");
              const projectDir = check.resolved;
              if (!fs.existsSync(projectDir)) { res.statusCode = 404; res.end(JSON.stringify({ success: false, error: "Project not found" })); return; }
              const { exec: execAsync } = await import("child_process");
              const os = await import("os");
              const isWin = os.platform() === "win32";

              const WIN_NPM_ALTERNATIVES: Record<string, string> = {
                "bun.sh/install": "npm install -g bun",
                "get.pnpm.io/install.sh": "npm install -g pnpm",
                "install.python-poetry.org": "pip install poetry",
                "rustup.rs": "winget install Rustlang.Rustup",
                "deno.land/install.sh": "npm install -g deno",
              };

              if (isWin) {
                const winAlt = Object.entries(WIN_NPM_ALTERNATIVES).find(([k]) => scriptUrl.includes(k));
                if (winAlt) {
                  const altCmd = winAlt[1];
                  await new Promise<void>((resolve) => {
                    execAsync(altCmd, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
                      res.setHeader("Content-Type", "application/json");
                      if (err) {
                        res.end(JSON.stringify({ success: false, error: `${err.message?.slice(0, 400)} (ran: ${altCmd})`, output: (stdout || "").slice(0, 4000), stderr: (stderr || "").slice(0, 2000) }));
                      } else {
                        res.end(JSON.stringify({ success: true, output: `Windows alternative: ${altCmd}\n${(stdout || "").slice(0, 4000)}` }));
                      }
                      resolve();
                    });
                  });
                  return;
                }

                const ps1Url = scriptUrl.replace(/\.sh$/, ".ps1");
                let usePsScript = false;
                try { const head = await fetch(ps1Url, { method: "HEAD" }); usePsScript = head.ok; } catch {}

                if (usePsScript) {
                  const psCmd = `irm ${ps1Url} | iex`;
                  const encodedCmd = Buffer.from(psCmd, "utf16le").toString("base64");
                  await new Promise<void>((resolve) => {
                    execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCmd}`, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
                      res.setHeader("Content-Type", "application/json");
                      if (err) {
                        res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: (stdout || "").slice(0, 4000), stderr: (stderr || "").slice(0, 2000) }));
                      } else {
                        res.end(JSON.stringify({ success: true, output: (stdout || "").slice(0, 4000) }));
                      }
                      resolve();
                    });
                  });
                  return;
                }
              }

              const resp = await fetch(scriptUrl);
              if (!resp.ok) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ success: false, error: `Failed to download script: ${resp.status} ${resp.statusText}` })); return; }
              const script = await resp.text();
              const tmpScript = path.join(os.tmpdir(), `install-${Date.now()}.sh`);
              fs.writeFileSync(tmpScript, script, { mode: 0o755 });
              await new Promise<void>((resolve) => {
                execAsync(`bash "${tmpScript}"`, { cwd: projectDir, timeout: 120000, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: { ...process.env, BUN_INSTALL: projectDir, CARGO_HOME: projectDir, RUSTUP_HOME: projectDir } }, (err, stdout, stderr) => {
                  try { fs.unlinkSync(tmpScript); } catch {}
                  res.setHeader("Content-Type", "application/json");
                  if (err) {
                    res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: (stdout || "").slice(0, 4000), stderr: (stderr || "").slice(0, 2000) }));
                  } else {
                    res.end(JSON.stringify({ success: true, output: (stdout || "").slice(0, 4000) }));
                  }
                  resolve();
                });
              });
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
          }

          const devServerRe = /^(?:npm\s+(?:run\s+)?(?:dev|start)|yarn\s+(?:dev|start)|pnpm\s+(?:dev|start)|bun\s+(?:dev|start)|npx\s+vite(?:\s|$))/i;
          if (devServerRe.test(trimmed)) { res.statusCode = 400; res.end(JSON.stringify({ error: "Dev server commands should use the Preview button instead" })); return; }
          const isAllowed = allowedPrefixes.some(p => trimmed.startsWith(p)) || /^(npm\s+install|pnpm\s+install|yarn\s+install|bun\s+install|npx\s+(pnpm|yarn|bun)\s+install)$/i.test(trimmed) || trimmed === "corepack enable";
          if (!isAllowed) { res.statusCode = 403; res.end(JSON.stringify({ error: `Command not allowed: ${trimmed.slice(0, 50)}` })); return; }
          if (/[;&|`$(){}]/.test(trimmed)) {
            res.statusCode = 403; res.end(JSON.stringify({ error: "Shell metacharacters not allowed" })); return;
          }
          if (/\.\.[\/\\]/.test(trimmed)) {
            res.statusCode = 403; res.end(JSON.stringify({ error: "Path traversal not allowed" })); return;
          }

          const fs = await import("fs");
          const projectDir = check.resolved;
          if (!fs.existsSync(projectDir)) { res.statusCode = 404; res.end(JSON.stringify({ success: false, error: `Project directory not found: ${projectDir}` })); return; }

          const { exec: execAsync } = await import("child_process");
          const os = await import("os");
          const isWin = os.platform() === "win32";
          const termPm = detectPmForDir(projectDir);
          let actualCmd = /^(npm\s+install|pnpm\s+install|yarn\s+install|bun\s+install|npx\s+(pnpm|yarn|bun)\s+install)$/i.test(trimmed) ? buildPmCommand(termPm, "install") : trimmed;

          const isInstallCmd = /^(npm\s+install|npm\s+i\b|yarn\s*(install)?$|pnpm\s+install|bun\s+install|npx\s+(pnpm|yarn|bun)\s+install)/i.test(trimmed);
          if (isInstallCmd) {
            const gitDir = path.join(projectDir, ".git");
            if (!fs.existsSync(gitDir)) {
              try { fs.mkdirSync(gitDir, { recursive: true }); } catch {}
            }
          }

          const nodeHandled = await (async () => {
            if (/^rm\s+(-rf?\s+)?/i.test(actualCmd)) {
              const targets = actualCmd.replace(/^rm\s+(-rf?\s+)?/i, "").trim().split(/\s+/);
              const results: string[] = [];
              for (const t of targets) {
                const targetPath = path.resolve(projectDir, t);
                if (!targetPath.startsWith(projectDir)) { results.push(`Skipped (outside project): ${t}`); continue; }
                try {
                  fs.rmSync(targetPath, { recursive: true, force: true });
                  results.push(`Removed: ${t}`);
                } catch (e: any) { results.push(`Failed to remove ${t}: ${e.message}`); }
              }
              return { success: true, output: results.join("\n") };
            }
            if (/^mkdir\s+(-p\s+)?/i.test(actualCmd)) {
              const dir = actualCmd.replace(/^mkdir\s+(-p\s+)?/i, "").trim();
              const dirPath = path.resolve(projectDir, dir);
              if (!dirPath.startsWith(projectDir)) return { success: false, error: "Path outside project" };
              try { fs.mkdirSync(dirPath, { recursive: true }); return { success: true, output: `Created: ${dir}` }; }
              catch (e: any) { return { success: false, error: e.message }; }
            }
            if (/^touch\s/i.test(actualCmd)) {
              const file = actualCmd.replace(/^touch\s+/i, "").trim();
              const filePath = path.resolve(projectDir, file);
              if (!filePath.startsWith(projectDir)) return { success: false, error: "Path outside project" };
              try {
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(filePath, "", { flag: "a" });
                return { success: true, output: `Touched: ${file}` };
              } catch (e: any) { return { success: false, error: e.message }; }
            }
            if (/^cat\s/i.test(actualCmd)) {
              const file = actualCmd.replace(/^cat\s+/i, "").trim();
              const filePath = path.resolve(projectDir, file);
              if (!filePath.startsWith(projectDir)) return { success: false, error: "Path outside project" };
              try { return { success: true, output: fs.readFileSync(filePath, "utf-8").slice(0, 4000) }; }
              catch (e: any) { return { success: false, error: e.message }; }
            }
            if (/^cp\s/i.test(actualCmd)) {
              const args = actualCmd.replace(/^cp\s+(-r\s+)?/i, "").trim().split(/\s+/);
              if (args.length >= 2) {
                const src = path.resolve(projectDir, args[0]);
                const dest = path.resolve(projectDir, args[1]);
                if (!src.startsWith(projectDir) || !dest.startsWith(projectDir)) return { success: false, error: "Path outside project" };
                try { fs.cpSync(src, dest, { recursive: true, force: true }); return { success: true, output: `Copied: ${args[0]} → ${args[1]}` }; }
                catch (e: any) { return { success: false, error: e.message }; }
              }
            }
            if (/^mv\s/i.test(actualCmd)) {
              const args = actualCmd.replace(/^mv\s+/i, "").trim().split(/\s+/);
              if (args.length >= 2) {
                const src = path.resolve(projectDir, args[0]);
                const dest = path.resolve(projectDir, args[1]);
                if (!src.startsWith(projectDir) || !dest.startsWith(projectDir)) return { success: false, error: "Path outside project" };
                try { fs.renameSync(src, dest); return { success: true, output: `Moved: ${args[0]} → ${args[1]}` }; }
                catch (e: any) { return { success: false, error: e.message }; }
              }
            }
            return null;
          })();

          if (nodeHandled) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(nodeHandled));
            return;
          }

          if (isWin && /^corepack\s/i.test(actualCmd)) {
            actualCmd = `npx ${actualCmd}`;
          }

          const cmdEnv = isInstallCmd
            ? { ...process.env, HUSKY: "0", npm_config_ignore_scripts: "", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" }
            : undefined;
          const cmdTimeout = isInstallCmd ? 180000 : 60000;

          await new Promise<void>((resolve) => {
            execAsync(actualCmd, { cwd: projectDir, timeout: cmdTimeout, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, ...(cmdEnv ? { env: cmdEnv } : {}) }, (err, stdout, stderr) => {
              if (err && isInstallCmd) {
                console.log(`[RunCmd] Install failed, retrying with --ignore-scripts: ${err.message?.slice(0, 200)}`);
                const retryCmd = actualCmd.includes("--ignore-scripts") ? actualCmd + " --force" : actualCmd + " --ignore-scripts";
                execAsync(retryCmd, { cwd: projectDir, timeout: cmdTimeout, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: cmdEnv }, (retryErr, retryStdout, retryStderr) => {
                  res.setHeader("Content-Type", "application/json");
                  if (retryErr) {
                    res.end(JSON.stringify({ success: false, error: retryErr.message?.slice(0, 500), output: (retryStdout || "").slice(0, 4000), stderr: (retryStderr || "").slice(0, 2000), retried: true }));
                  } else {
                    res.end(JSON.stringify({ success: true, output: (retryStdout || "").slice(0, 4000), retried: true, note: "Installed with --ignore-scripts (some post-install steps were skipped)" }));
                  }
                  resolve();
                });
                return;
              }
              res.setHeader("Content-Type", "application/json");
              if (err) {
                res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: (stdout || "").slice(0, 4000), stderr: (stderr || "").slice(0, 2000) }));
              } else {
                res.end(JSON.stringify({ success: true, output: (stdout || "").slice(0, 4000) }));
              }
              resolve();
            });
          });
        } catch (err: any) {
          const stderr = err.stderr ? String(err.stderr).slice(0, 2000) : "";
          const stdout = err.stdout ? String(err.stdout).slice(0, 2000) : "";
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: stdout, stderr }));
        }
      });

      server.middlewares.use("/api/programs/install", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { programs } = JSON.parse(await readBody(req));
          if (!Array.isArray(programs) || programs.length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "No programs specified" }));
            return;
          }
          if (programs.length > 10) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Too many programs (max 10)" }));
            return;
          }

          const { execSync } = await import("child_process");
          const isWin = process.platform === "win32";
          const isMac = process.platform === "darwin";

          const programInstallMap: Record<string, { check: string; winCmds: string[]; macCmds: string[]; linuxCmds: string[]; label: string; altChecks?: string[] }> = {
            "g++": { check: "g++ --version", winCmds: ["winget install -e --id GnuWin32.Make --accept-source-agreements --accept-package-agreements", "scoop install gcc", "choco install mingw -y"], macCmds: ["xcode-select --install"], linuxCmds: ["sudo apt-get install -y g++"], label: "G++ (C++ Compiler)" },
            "gcc": { check: "gcc --version", winCmds: ["scoop install gcc", "choco install mingw -y"], macCmds: ["xcode-select --install"], linuxCmds: ["sudo apt-get install -y gcc"], label: "GCC (C Compiler)" },
            "clang": { check: "clang --version", winCmds: ["winget install -e --id LLVM.LLVM --accept-source-agreements --accept-package-agreements", "scoop install llvm", "choco install llvm -y"], macCmds: ["xcode-select --install"], linuxCmds: ["sudo apt-get install -y clang"], label: "Clang" },
            "cmake": { check: "cmake --version", winCmds: ["winget install -e --id Kitware.CMake --accept-source-agreements --accept-package-agreements", "scoop install cmake", "choco install cmake -y"], macCmds: ["brew install cmake"], linuxCmds: ["sudo apt-get install -y cmake"], label: "CMake" },
            "make": { check: "make --version", winCmds: ["scoop install make", "choco install make -y"], macCmds: ["xcode-select --install"], linuxCmds: ["sudo apt-get install -y make"], label: "Make" },
            "python": { check: "python3 --version", winCmds: ["winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements", "scoop install python", "choco install python -y"], macCmds: ["brew install python3"], linuxCmds: ["sudo apt-get install -y python3"], label: "Python 3", altChecks: ["python --version"] },
            "python3": { check: "python3 --version", winCmds: ["winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements", "scoop install python", "choco install python -y"], macCmds: ["brew install python3"], linuxCmds: ["sudo apt-get install -y python3"], label: "Python 3", altChecks: ["python --version"] },
            "pip": { check: "pip3 --version", winCmds: ["python -m ensurepip", "python3 -m ensurepip"], macCmds: ["python3 -m ensurepip"], linuxCmds: ["sudo apt-get install -y python3-pip"], label: "Pip", altChecks: ["pip --version"] },
            "pip3": { check: "pip3 --version", winCmds: ["python -m ensurepip", "python3 -m ensurepip"], macCmds: ["python3 -m ensurepip"], linuxCmds: ["sudo apt-get install -y python3-pip"], label: "Pip 3", altChecks: ["pip --version"] },
            "node": { check: "node --version", winCmds: ["winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements", "scoop install nodejs-lts", "choco install nodejs -y"], macCmds: ["brew install node"], linuxCmds: ["curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"], label: "Node.js" },
            "nodejs": { check: "node --version", winCmds: ["winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements", "scoop install nodejs-lts", "choco install nodejs -y"], macCmds: ["brew install node"], linuxCmds: ["curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"], label: "Node.js" },
            "node.js": { check: "node --version", winCmds: ["winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements", "scoop install nodejs-lts", "choco install nodejs -y"], macCmds: ["brew install node"], linuxCmds: ["curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"], label: "Node.js" },
            "rust": { check: "rustc --version", winCmds: ["winget install -e --id Rustlang.Rustup --accept-source-agreements --accept-package-agreements", "scoop install rustup", "choco install rust -y"], macCmds: ["curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"], linuxCmds: ["curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"], label: "Rust" },
            "rustc": { check: "rustc --version", winCmds: ["winget install -e --id Rustlang.Rustup --accept-source-agreements --accept-package-agreements", "scoop install rustup", "choco install rust -y"], macCmds: ["curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"], linuxCmds: ["curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"], label: "Rust" },
            "cargo": { check: "cargo --version", winCmds: ["winget install -e --id Rustlang.Rustup --accept-source-agreements --accept-package-agreements", "scoop install rustup", "choco install rust -y"], macCmds: ["curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"], linuxCmds: ["curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"], label: "Cargo (Rust)" },
            "go": { check: "go version", winCmds: ["winget install -e --id GoLang.Go --accept-source-agreements --accept-package-agreements", "scoop install go", "choco install golang -y"], macCmds: ["brew install go"], linuxCmds: ["sudo apt-get install -y golang"], label: "Go" },
            "golang": { check: "go version", winCmds: ["winget install -e --id GoLang.Go --accept-source-agreements --accept-package-agreements", "scoop install go", "choco install golang -y"], macCmds: ["brew install go"], linuxCmds: ["sudo apt-get install -y golang"], label: "Go" },
            "java": { check: "java -version", winCmds: ["winget install -e --id Microsoft.OpenJDK.21 --accept-source-agreements --accept-package-agreements", "scoop install openjdk", "choco install openjdk -y"], macCmds: ["brew install openjdk"], linuxCmds: ["sudo apt-get install -y default-jdk"], label: "Java (JDK)" },
            "jdk": { check: "java -version", winCmds: ["winget install -e --id Microsoft.OpenJDK.21 --accept-source-agreements --accept-package-agreements", "scoop install openjdk", "choco install openjdk -y"], macCmds: ["brew install openjdk"], linuxCmds: ["sudo apt-get install -y default-jdk"], label: "Java (JDK)" },
            "docker": { check: "docker --version", winCmds: ["winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements", "choco install docker-desktop -y"], macCmds: ["brew install --cask docker"], linuxCmds: ["sudo apt-get install -y docker.io"], label: "Docker" },
            "git": { check: "git --version", winCmds: ["winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements", "scoop install git", "choco install git -y"], macCmds: ["brew install git"], linuxCmds: ["sudo apt-get install -y git"], label: "Git" },
            "curl": { check: "curl --version", winCmds: ["scoop install curl", "choco install curl -y"], macCmds: ["brew install curl"], linuxCmds: ["sudo apt-get install -y curl"], label: "cURL" },
            "wget": { check: "wget --version", winCmds: ["scoop install wget", "choco install wget -y"], macCmds: ["brew install wget"], linuxCmds: ["sudo apt-get install -y wget"], label: "Wget" },
            "ffmpeg": { check: "ffmpeg -version", winCmds: ["winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements", "scoop install ffmpeg", "choco install ffmpeg -y"], macCmds: ["brew install ffmpeg"], linuxCmds: ["sudo apt-get install -y ffmpeg"], label: "FFmpeg" },
            "imagemagick": { check: "convert --version", winCmds: ["winget install -e --id ImageMagick.ImageMagick --accept-source-agreements --accept-package-agreements", "scoop install imagemagick", "choco install imagemagick -y"], macCmds: ["brew install imagemagick"], linuxCmds: ["sudo apt-get install -y imagemagick"], label: "ImageMagick", altChecks: ["magick --version"] },
            "sqlite3": { check: "sqlite3 --version", winCmds: ["scoop install sqlite", "choco install sqlite -y"], macCmds: ["brew install sqlite"], linuxCmds: ["sudo apt-get install -y sqlite3"], label: "SQLite" },
            "postgresql": { check: "psql --version", winCmds: ["winget install -e --id PostgreSQL.PostgreSQL --accept-source-agreements --accept-package-agreements", "scoop install postgresql", "choco install postgresql -y"], macCmds: ["brew install postgresql"], linuxCmds: ["sudo apt-get install -y postgresql"], label: "PostgreSQL" },
            "redis": { check: "redis-server --version", winCmds: ["scoop install redis", "choco install redis -y"], macCmds: ["brew install redis"], linuxCmds: ["sudo apt-get install -y redis-server"], label: "Redis" },
            "deno": { check: "deno --version", winCmds: ["winget install -e --id DenoLand.Deno --accept-source-agreements --accept-package-agreements", "scoop install deno", "choco install deno -y"], macCmds: ["brew install deno"], linuxCmds: ["curl -fsSL https://deno.land/install.sh | sh"], label: "Deno" },
            "bun": { check: "bun --version", winCmds: ["powershell -c \"irm bun.sh/install.ps1|iex\"", "scoop install bun"], macCmds: ["curl -fsSL https://bun.sh/install | bash"], linuxCmds: ["curl -fsSL https://bun.sh/install | bash"], label: "Bun" },
            "ruby": { check: "ruby --version", winCmds: ["winget install -e --id RubyInstallerTeam.Ruby.3.2 --accept-source-agreements --accept-package-agreements", "scoop install ruby", "choco install ruby -y"], macCmds: ["brew install ruby"], linuxCmds: ["sudo apt-get install -y ruby"], label: "Ruby" },
            "php": { check: "php --version", winCmds: ["scoop install php", "choco install php -y"], macCmds: ["brew install php"], linuxCmds: ["sudo apt-get install -y php"], label: "PHP" },
          };

          const results: { program: string; label: string; alreadyInstalled: boolean; installed: boolean; error?: string; command?: string }[] = [];

          function tryExec(cmd: string, timeout = 10000): boolean {
            try { execSync(cmd, { timeout, stdio: "pipe", shell: true, windowsHide: true }); return true; } catch { return false; }
          }

          for (const prog of programs) {
            const key = prog.toLowerCase().replace(/[^a-z0-9.+]/g, "");
            const mapping = programInstallMap[key];
            if (!mapping) {
              results.push({ program: prog, label: prog, alreadyInstalled: false, installed: false, error: `Unknown program: ${prog}` });
              continue;
            }

            let alreadyInstalled = tryExec(mapping.check);
            if (!alreadyInstalled && mapping.altChecks) {
              alreadyInstalled = mapping.altChecks.some(c => tryExec(c));
            }
            if (!alreadyInstalled) {
              const whichCmd = isWin ? `where ${key}` : `which ${key}`;
              alreadyInstalled = tryExec(whichCmd, 5000);
            }

            if (alreadyInstalled) {
              results.push({ program: prog, label: mapping.label, alreadyInstalled: true, installed: true });
              continue;
            }

            const installCmds = isWin ? mapping.winCmds : isMac ? mapping.macCmds : mapping.linuxCmds;
            if (!installCmds || installCmds.length === 0) {
              results.push({ program: prog, label: mapping.label, alreadyInstalled: false, installed: false, error: `No install command for this platform` });
              continue;
            }

            let installed = false;
            let lastErr = "";
            let usedCmd = "";
            for (const cmd of installCmds) {
              try {
                execSync(cmd, { timeout: 180000, stdio: "pipe", shell: true, windowsHide: true });
                installed = true;
                usedCmd = cmd;
                break;
              } catch (err: any) {
                lastErr = err.message?.slice(0, 150) || "failed";
                console.log(`[Programs] ${mapping.label}: '${cmd}' failed, trying next...`);
              }
            }

            if (installed) {
              results.push({ program: prog, label: mapping.label, alreadyInstalled: false, installed: true, command: usedCmd });
            } else {
              results.push({ program: prog, label: mapping.label, alreadyInstalled: false, installed: false, error: `All install methods failed. Last: ${lastErr}`, command: installCmds[installCmds.length - 1] });
            }
          }

          res.setHeader("Content-Type", "application/json");
          const allOk = results.every(r => r.installed || r.alreadyInstalled);
          res.end(JSON.stringify({ success: allOk, results }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/import-github", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { owner, repo, targetProject } = JSON.parse(await readBody(req));
          if (!owner || !repo || /[\/\\]|\.\./.test(owner) || /[\/\\]|\.\./.test(repo)) {
            res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid owner or repo" })); return;
          }
          if (targetProject && /[\/\\]|\.\./.test(targetProject)) {
            res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid target project name" })); return;
          }

          const fs = await import("fs");
          const { execSync } = await import("child_process");
          const os = await import("os");
          const projectsDir = path.resolve(process.cwd(), "projects");
          if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });

          const projectName = targetProject || repo.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          const projectDir = path.resolve(projectsDir, projectName);

          if (fs.existsSync(projectDir) && !targetProject) {
            res.statusCode = 409;
            res.end(JSON.stringify({ error: `Project '${projectName}' already exists. Delete it first or use a different name.` }));
            return;
          }
          if (targetProject && fs.existsSync(projectDir)) {
            try {
              fs.rmSync(projectDir, { recursive: true, force: true });
              console.log(`[Import] Removed existing project directory '${projectName}'`);
            } catch (rmErr: any) {
              console.log(`[Import] Full rm failed (${rmErr.message?.slice(0, 100)}), clearing contents instead`);
              try {
                const existingFiles = fs.readdirSync(projectDir);
                for (const f of existingFiles) {
                  try { fs.rmSync(path.join(projectDir, f), { recursive: true, force: true }); } catch {}
                }
              } catch {}
            }
            console.log(`[Import] Cleared existing project '${projectName}' for clone into`);
          }

          const ghToken = process.env.GITHUB_TOKEN || "";
          const headers: Record<string, string> = { "User-Agent": "Lamby" };
          if (ghToken) headers["Authorization"] = `token ${ghToken}`;

          let defaultBranch = "main";
          let apiAvailable = false;
          try {
            const infoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { ...headers, "Accept": "application/vnd.github.v3+json" } });
            if (infoResp.ok) {
              const repoInfo: any = await infoResp.json();
              defaultBranch = repoInfo.default_branch || "main";
              apiAvailable = true;
            } else {
              console.log(`[Import] GitHub API returned ${infoResp.status} for ${owner}/${repo}, will try git clone directly`);
            }
          } catch (apiErr: any) {
            console.log(`[Import] GitHub API request failed for ${owner}/${repo}: ${apiErr.message?.slice(0, 100)}, will try git clone directly`);
          }

          const MAX_TARBALL_SIZE = 200 * 1024 * 1024;
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lamby-import-"));
          let cloneMethod = "tarball";
          try {

          let tarballSuccess = false;
          if (apiAvailable) try {
            console.log(`[Import] Downloading tarball for ${owner}/${repo} (branch: ${defaultBranch})...`);
            const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(defaultBranch)}`;
            const tarResp = await fetch(tarballUrl, { headers: { ...headers, "Accept": "application/vnd.github.v3+json" }, redirect: "follow" });
            if (!tarResp.ok) throw new Error(`Tarball download failed: HTTP ${tarResp.status}`);

            const contentLength = parseInt(tarResp.headers.get("content-length") || "0", 10);
            if (contentLength > MAX_TARBALL_SIZE) throw new Error(`Repository too large for tarball (${(contentLength / 1024 / 1024).toFixed(0)}MB)`);

            const tarPath = path.join(tmpDir, "repo.tar.gz");
            const arrayBuf = await tarResp.arrayBuffer();
            if (arrayBuf.byteLength > MAX_TARBALL_SIZE) throw new Error(`Repository too large (${(arrayBuf.byteLength / 1024 / 1024).toFixed(0)}MB)`);

            fs.writeFileSync(tarPath, Buffer.from(arrayBuf));
            const tarSize = fs.statSync(tarPath).size;
            console.log(`[Import] Tarball downloaded: ${(tarSize / 1024 / 1024).toFixed(1)}MB`);

            fs.mkdirSync(projectDir, { recursive: true });
            if (process.platform === "win32") {
              execSync(`tar xzf "${tarPath.replace(/\\/g, '/')}" --strip-components=1 -C "${projectDir.replace(/\\/g, '/')}"`, { timeout: 60000, stdio: "pipe", windowsHide: true });
            } else {
              execSync(`tar xzf "${tarPath}" --strip-components=1 -C "${projectDir}"`, { timeout: 60000, stdio: "pipe", windowsHide: true });
            }
            console.log(`[Import] Extracted tarball to ${projectDir}`);
            tarballSuccess = true;
          } catch (tarErr: any) {
            console.log(`[Import] Tarball method failed for ${owner}/${repo}: ${tarErr.message?.slice(0, 200)}`);
            try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}
          }

          if (!tarballSuccess) {
            cloneMethod = "git-clone";
            console.log(`[Import] Falling back to git clone --depth 1 for ${owner}/${repo}...`);
            const cloneUrl = ghToken
              ? `https://x-access-token:${ghToken}@github.com/${owner}/${repo}.git`
              : `https://github.com/${owner}/${repo}.git`;
            const cloneTmp = path.join(tmpDir, "clone");
            try {
              execSync(`git clone --depth 1 --single-branch --branch "${defaultBranch}" "${cloneUrl}" "${cloneTmp}"`, { timeout: 120000, stdio: "pipe", windowsHide: true });
            } catch (branchErr: any) {
              try {
                execSync(`git clone --depth 1 "${cloneUrl}" "${cloneTmp}"`, { timeout: 120000, stdio: "pipe", windowsHide: true });
              } catch (cloneErr: any) {
                throw new Error(`Failed to clone repository: ${cloneErr.message?.slice(0, 200)}`);
              }
            }
            fs.mkdirSync(projectDir, { recursive: true });
            const cloneEntries = fs.readdirSync(cloneTmp);
            for (const entry of cloneEntries) {
              const src = path.join(cloneTmp, entry);
              const dest = path.join(projectDir, entry);
              try { fs.cpSync(src, dest, { recursive: true, force: true }); } catch {}
            }
            console.log(`[Import] Git clone completed for ${owner}/${repo}`);
          }

          const CLEANUP_PATTERNS = ["node_modules", ".git", ".next", ".nuxt", "dist", ".cache", ".turbo", ".vercel", ".output"];
          for (const pattern of CLEANUP_PATTERNS) {
            const cleanPath = path.join(projectDir, pattern);
            if (fs.existsSync(cleanPath)) {
              try { fs.rmSync(cleanPath, { recursive: true, force: true }); } catch {}
            }
          }
          const walkAndClean = (dir: string) => {
            try {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  if (entry.name === "node_modules" || entry.name === ".git") {
                    try { fs.rmSync(full, { recursive: true, force: true }); } catch {}
                  } else {
                    walkAndClean(full);
                  }
                } else if (entry.name === ".DS_Store") {
                  try { fs.unlinkSync(full); } catch {}
                }
              }
            } catch {}
          };
          walkAndClean(projectDir);

          let filesWritten = 0;
          const countFiles = (dir: string) => {
            try {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.isDirectory()) countFiles(path.join(dir, entry.name));
                else filesWritten++;
              }
            } catch {}
          };
          countFiles(projectDir);

          let framework = "vanilla";
          const pkgPath = path.join(projectDir, "package.json");
          const detectFramework = (pkgJsonPath: string): string | null => {
            try {
              const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
              const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
              if (deps["next"]) return "nextjs";
              if (deps["nuxt"] || deps["nuxt3"]) return "nuxt";
              if (deps["@angular/core"]) return "angular";
              if (deps["svelte"] || deps["@sveltejs/kit"]) return "svelte";
              if (deps["astro"]) return "astro";
              if (deps["vue"]) return "vue";
              if (deps["react"]) return "react";
            } catch {}
            return null;
          };
          if (fs.existsSync(pkgPath)) {
            framework = detectFramework(pkgPath) || "vanilla";
          } else {
            for (const sub of ["frontend", "client", "web", "app", "ui"]) {
              const subPkg = path.join(projectDir, sub, "package.json");
              if (fs.existsSync(subPkg)) {
                framework = detectFramework(subPkg) || "vanilla";
                break;
              }
            }
          }

          let npmInstalled = false;
          let installError = "";
          let effectiveInstallDir = projectDir;
          if (!fs.existsSync(pkgPath)) {
            for (const sub of ["frontend", "client", "web", "app", "ui"]) {
              const subPkg = path.join(projectDir, sub, "package.json");
              if (fs.existsSync(subPkg)) {
                effectiveInstallDir = path.join(projectDir, sub);
                console.log(`[Import] No root package.json — using ${sub}/package.json for ${projectName}`);
                break;
              }
            }
          }
          if (fs.existsSync(path.join(effectiveInstallDir, "package.json"))) {
            const detectPM = (): string => {
              for (const d of [effectiveInstallDir, projectDir]) {
                if (fs.existsSync(path.join(d, "bun.lockb")) || fs.existsSync(path.join(d, "bun.lock"))) return "bun";
                if (fs.existsSync(path.join(d, "pnpm-lock.yaml")) || fs.existsSync(path.join(d, "pnpm-workspace.yaml"))) return "pnpm";
                if (fs.existsSync(path.join(d, "yarn.lock"))) return "yarn";
              }
              return "npm";
            };
            const detectedPM = detectPM();

            let isMonorepo = false;
            try {
              const effPkg = JSON.parse(fs.readFileSync(path.join(effectiveInstallDir, "package.json"), "utf-8"));
              if (effPkg.workspaces || fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml")) || fs.existsSync(path.join(projectDir, "lerna.json"))) {
                isMonorepo = true;
              }
            } catch {}

            const installCmd = buildPmCommand(detectedPM, "install-ignore-scripts");

            const importInstallEnv = { ...process.env, HUSKY: "0", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" };
            if (!fs.existsSync(path.join(effectiveInstallDir, ".git"))) { try { fs.mkdirSync(path.join(effectiveInstallDir, ".git"), { recursive: true }); } catch {} }
            console.log(`[Import] Installing deps in ${effectiveInstallDir === projectDir ? "root" : path.relative(projectDir, effectiveInstallDir) + "/"} for ${projectName} with: ${installCmd} (pm: ${detectedPM})`);
            try {
              execSync(installCmd, { cwd: effectiveInstallDir, timeout: 180000, stdio: "pipe", shell: true, windowsHide: true, env: importInstallEnv });
              npmInstalled = true;
              console.log(`[Import] Deps installed for ${projectName}`);
            } catch (installErr: any) {
              installError = installErr.stderr?.toString().slice(-500) || installErr.message?.slice(0, 500) || "Unknown error";
              console.error(`[Import] Install failed for ${projectName} with ${detectedPM}:`, installError.slice(0, 300));
              if (detectedPM !== "npm") {
                try {
                  console.log(`[Import] Retrying with npm for ${projectName}`);
                  execSync(buildPmCommand("npm", "install-ignore-scripts"), { cwd: effectiveInstallDir, timeout: 180000, stdio: "pipe", shell: true, windowsHide: true, env: importInstallEnv });
                  stripPackageManagerField(effectiveInstallDir);
                  npmInstalled = true;
                  installError = "";
                  console.log(`[Import] Deps installed for ${projectName} (npm fallback)`);
                } catch (retryErr: any) {
                  installError = retryErr.stderr?.toString().slice(-300) || retryErr.message?.slice(0, 300) || "Retry failed";
                }
              }
            }
          }

          const COMMON_SUBDIRS = ["frontend", "client", "web", "app", "ui", "packages/app", "packages/client", "packages/web", "packages/ui"];
          for (const subdir of COMMON_SUBDIRS) {
            const subPkgPath = path.join(projectDir, subdir, "package.json");
            if (fs.existsSync(subPkgPath) && !fs.existsSync(path.join(projectDir, subdir, "node_modules"))) {
              try {
                console.log(`[Import] Installing deps in subdirectory ${subdir}/...`);
                const subInstDir = path.join(projectDir, subdir);
                if (!fs.existsSync(path.join(subInstDir, ".git"))) { try { fs.mkdirSync(path.join(subInstDir, ".git"), { recursive: true }); } catch {} }
                const subPm = detectPmForDir(subInstDir);
                try {
                  execSync(buildPmCommand(subPm, "install-ignore-scripts"), { cwd: subInstDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true, env: { ...process.env, HUSKY: "0" } });
                } catch {
                  if (subPm !== "npm") {
                    execSync(buildPmCommand("npm", "install-ignore-scripts"), { cwd: subInstDir, timeout: 120000, stdio: "pipe", shell: true, windowsHide: true, env: { ...process.env, HUSKY: "0" } });
                  } else { throw new Error("npm install failed"); }
                }
                stripPackageManagerField(subInstDir);
                console.log(`[Import] Subdirectory ${subdir}/ deps installed`);
              } catch (subErr: any) {
                console.log(`[Import] Subdirectory ${subdir}/ install failed (non-critical): ${subErr.message?.slice(0, 100)}`);
              }
            }
          }

          const metaPath = path.join(projectDir, ".lamby-meta.json");
          try {
            const existingMeta: any = {};
            try { if (fs.existsSync(metaPath)) Object.assign(existingMeta, JSON.parse(fs.readFileSync(metaPath, "utf-8"))); } catch {}
            if (!existingMeta.bridgeKey) existingMeta.bridgeKey = crypto.randomBytes(16).toString("hex");
            Object.assign(existingMeta, { owner, repo, sourceUrl: `https://github.com/${owner}/${repo}`, clonedAt: new Date().toISOString(), projectName });
            fs.writeFileSync(metaPath, JSON.stringify(existingMeta, null, 2));
            console.log(`[Import] Saved source metadata to .lamby-meta.json`);
          } catch {}

          let releaseAssets: { name: string; size: number; downloadUrl: string; downloaded: boolean }[] = [];
          const hasPkgJson = fs.existsSync(pkgPath);
          if (!hasPkgJson && apiAvailable) {
            try {
              console.log(`[Import] No package.json found — checking GitHub Releases for precompiled binaries...`);
              const relResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { headers: { ...headers, "Accept": "application/vnd.github.v3+json" } });
              if (relResp.ok) {
                const relData: any = await relResp.json();
                const BINARY_EXTS = [".exe", ".msi", ".appimage", ".dmg", ".deb", ".rpm", ".zip", ".tar.gz", ".7z", ".snap", ".flatpak"];
                const osPlatform = os.platform();
                const osArch = os.arch();
                const platformHints = osPlatform === "win32" ? ["win", "windows"] : osPlatform === "darwin" ? ["mac", "macos", "darwin"] : ["linux"];
                const goodArchHints = osArch === "arm64" ? ["arm64", "aarch64"] : ["x64", "x86_64", "amd64", "win64"];
                const badArchHints = osArch === "arm64" ? ["x64", "x86_64", "amd64", "win64"] : ["arm64", "aarch64"];
                const INSTALLER_KW = ["installer", "setup", "install"];
                const assets = (relData.assets || [])
                  .filter((a: any) => BINARY_EXTS.some(ext => a.name.toLowerCase().endsWith(ext)))
                  .map((a: any) => {
                    const ln = a.name.toLowerCase();
                    let score = 0;
                    if (platformHints.some(h => ln.includes(h))) score += 20;
                    if (goodArchHints.some(h => ln.includes(h))) score += 10;
                    if (badArchHints.some(h => ln.includes(h))) score -= 15;
                    if (ln.includes("portable")) score += 25;
                    if (INSTALLER_KW.some(h => ln.includes(h))) score -= 5;
                    if (ln.endsWith(".zip")) score += 3;
                    return { ...a, _score: score };
                  })
                  .sort((a: any, b: any) => b._score - a._score);
                if (assets.length > 0) {
                  const releasesDir = path.join(projectDir, "_releases");
                  fs.mkdirSync(releasesDir, { recursive: true });
                  const MAX_DOWNLOAD = 500 * 1024 * 1024;
                  const toDownload = assets.filter((a: any) => a.size < MAX_DOWNLOAD).slice(0, 3);
                  for (const asset of toDownload) {
                    try {
                      console.log(`[Import] Downloading release asset: ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)}MB)...`);
                      const dlResp = await fetch(asset.browser_download_url, { redirect: "follow" });
                      if (dlResp.ok) {
                        const buf = Buffer.from(await dlResp.arrayBuffer());
                        const assetPath = path.join(releasesDir, asset.name);
                        fs.writeFileSync(assetPath, buf);
                        if (asset.name.toLowerCase().endsWith(".exe") || asset.name.toLowerCase().endsWith(".appimage")) {
                          try { fs.chmodSync(assetPath, 0o755); } catch {}
                        }
                        if (asset.name.toLowerCase().endsWith(".zip")) {
                          try {
                            const extractDir = path.join(releasesDir, asset.name.replace(/\.zip$/i, ""));
                            fs.mkdirSync(extractDir, { recursive: true });
                            if (osPlatform === "win32") {
                              execSync(`tar xf "${assetPath.replace(/\\/g, '/')}" -C "${extractDir.replace(/\\/g, '/')}"`, { timeout: 60000, stdio: "pipe", windowsHide: true });
                            } else {
                              execSync(`unzip -o -q "${assetPath}" -d "${extractDir}"`, { timeout: 60000, stdio: "pipe" });
                            }
                            console.log(`[Import] Extracted ${asset.name} to ${extractDir}`);
                          } catch (unzipErr: any) {
                            console.log(`[Import] Could not extract ${asset.name}: ${unzipErr.message?.slice(0, 100)}`);
                          }
                        }
                        releaseAssets.push({ name: asset.name, size: asset.size, downloadUrl: asset.browser_download_url, downloaded: true });
                        console.log(`[Import] Downloaded: ${asset.name}`);
                      }
                    } catch (dlErr: any) {
                      console.log(`[Import] Failed to download ${asset.name}: ${dlErr.message?.slice(0, 100)}`);
                      releaseAssets.push({ name: asset.name, size: asset.size, downloadUrl: asset.browser_download_url, downloaded: false });
                    }
                  }
                  for (const asset of assets.slice(3)) {
                    releaseAssets.push({ name: asset.name, size: asset.size, downloadUrl: asset.browser_download_url, downloaded: false });
                  }
                  console.log(`[Import] Release assets: ${releaseAssets.filter(a => a.downloaded).length} downloaded, ${releaseAssets.length} total`);
                }
              }
            } catch (relErr: any) {
              console.log(`[Import] Release check failed (non-critical): ${relErr.message?.slice(0, 100)}`);
            }
          }

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            success: true,
            projectName,
            framework,
            filesWritten,
            npmInstalled,
            cloneMethod,
            sourceRepo: `https://github.com/${owner}/${repo}`,
            defaultBranch,
            ...(installError ? { installError: installError.slice(0, 500) } : {}),
            ...(releaseAssets.length > 0 ? { releaseAssets } : {}),
          }));
          } finally {
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      const sandboxAuditLog: { ts: number; action: string; project: string; status: string; detail?: string }[] = [];

      const { createRequire } = await import("module");
      const _require = createRequire(import.meta.url);
      const sandboxDispatcher = _require("./server/sandbox-dispatcher.cjs");
      const executeSandboxAction = (action: any, projectsDir: string) => sandboxDispatcher.executeSandboxAction(action, projectsDir);
      const executeSandboxActions = (actions: any[], projectsDir: string, opts?: any) => sandboxDispatcher.executeSandboxActions(actions, projectsDir, opts);

      const pendingSandboxRelayRequests = new Map<string, { resolve: (s: string) => void; timer: ReturnType<typeof setTimeout> }>();

      const BRIDGE_RELAY_URL = process.env.BRIDGE_RELAY_URL || "https://bridge-relay.replit.app";
      let bridgeRelaySocket: any = null;
      let bridgeRelayConnected = false;
      let bridgeRelayReconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let bridgeRelayReconnectDelay = 2000;
      let bridgeRelayPingTimer: ReturnType<typeof setInterval> | null = null;
      let bridgeRelayBuffer = Buffer.alloc(0);
      let bridgeRelayLastConnectedAt = 0;
      const BRIDGE_RELAY_GRACE_PERIOD_MS = 30000;
      const lambyConfigPath = path.resolve(process.cwd(), ".lamby-keys.json");
      let bridgeRelayKey: string;
      try {
        const fs3 = await import("fs");
        if (fs3.existsSync(lambyConfigPath)) {
          const saved2 = JSON.parse(fs3.readFileSync(lambyConfigPath, "utf-8"));
          bridgeRelayKey = saved2.bridgeRelayKey && saved2.bridgeRelayKey.length >= 16 ? saved2.bridgeRelayKey : crypto.randomBytes(16).toString("hex");
          if (!saved2.bridgeRelayKey) {
            saved2.bridgeRelayKey = bridgeRelayKey;
            fs3.writeFileSync(lambyConfigPath, JSON.stringify(saved2, null, 2), "utf-8");
          }
        } else {
          bridgeRelayKey = crypto.randomBytes(16).toString("hex");
        }
      } catch {
        bridgeRelayKey = crypto.randomBytes(16).toString("hex");
      }

      function wsRelayEncodeFrame(data: string): Buffer {
        const payload = Buffer.from(data, "utf-8");
        const len = payload.length;
        const mask = crypto.randomBytes(4);
        let header: Buffer;
        if (len < 126) {
          header = Buffer.alloc(6);
          header[0] = 0x81;
          header[1] = 0x80 | len;
          mask.copy(header, 2);
        } else if (len < 65536) {
          header = Buffer.alloc(8);
          header[0] = 0x81;
          header[1] = 0x80 | 126;
          header.writeUInt16BE(len, 2);
          mask.copy(header, 4);
        } else {
          header = Buffer.alloc(14);
          header[0] = 0x81;
          header[1] = 0x80 | 127;
          header.writeBigUInt64BE(BigInt(len), 2);
          mask.copy(header, 10);
        }
        const masked = Buffer.alloc(len);
        for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
        return Buffer.concat([header, masked]);
      }

      function wsRelayDecodeFrame(buf: Buffer): { data: string | null; opcode?: number; bytesConsumed: number } {
        if (buf.length < 2) return { data: null, bytesConsumed: 0 };
        const opcode = buf[0] & 0x0f;
        const isMasked = (buf[1] & 0x80) !== 0;
        let payloadLen = buf[1] & 0x7f;
        let offset = 2;
        if (payloadLen === 126) {
          if (buf.length < 4) return { data: null, bytesConsumed: 0 };
          payloadLen = buf.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buf.length < 10) return { data: null, bytesConsumed: 0 };
          payloadLen = Number(buf.readBigUInt64BE(2));
          offset = 10;
        }
        if (isMasked) {
          if (buf.length < offset + 4 + payloadLen) return { data: null, bytesConsumed: 0 };
          const maskKey = buf.slice(offset, offset + 4);
          offset += 4;
          const pl = Buffer.alloc(payloadLen);
          for (let i = 0; i < payloadLen; i++) pl[i] = buf[offset + i] ^ maskKey[i % 4];
          return { data: pl.toString("utf-8"), opcode, bytesConsumed: offset + payloadLen };
        }
        if (buf.length < offset + payloadLen) return { data: null, bytesConsumed: 0 };
        return { data: buf.slice(offset, offset + payloadLen).toString("utf-8"), opcode, bytesConsumed: offset + payloadLen };
      }

      function bridgeRelaySend(data: string) {
        if (!bridgeRelaySocket || !bridgeRelayConnected) return;
        try { bridgeRelaySocket.write(wsRelayEncodeFrame(data)); } catch (err: any) {
          console.error(`[Bridge] Send failed: ${err.message}`);
        }
      }

      function gatherConsoleLogs(projectName: string) {
        const result: { previews: any[]; message?: string } = { previews: [] };
        if (projectName) {
          const entry = previewProcesses.get(projectName);
          if (entry && entry.logs) {
            result.previews.push({ name: projectName, port: entry.port, stdout: entry.logs.stdout, stderr: entry.logs.stderr });
          } else {
            result.previews.push({ name: projectName, error: "No preview running for this project" });
          }
        } else {
          for (const [name, entry] of previewProcesses) {
            result.previews.push({ name, port: entry.port, stdout: entry.logs ? entry.logs.stdout : "", stderr: entry.logs ? entry.logs.stderr : "" });
          }
          if (result.previews.length === 0) {
            result.message = "No preview processes running";
          }
        }
        return result;
      }

      async function handleBridgeRelayMessage(msg: string) {
        try {
          const parsed = JSON.parse(msg);
          if (parsed.type === "snapshot-request" && parsed.requestId) {
            console.log(`[Bridge] Received snapshot-request for "${parsed.projectName || ""}" (reqId: ${parsed.requestId.slice(0, 8)})`);
            try {
              const snapshot = await gatherProjectSnapshot(parsed.projectName || "");
              bridgeRelaySend(JSON.stringify({ type: "snapshot-response", requestId: parsed.requestId, snapshot }));
              console.log(`[Bridge] Sent snapshot-response (reqId: ${parsed.requestId.slice(0, 8)}, len: ${typeof snapshot === 'string' ? snapshot.length : JSON.stringify(snapshot).length})`);
            } catch (err: any) {
              console.error(`[Bridge] snapshot error: ${err.message}`);
              bridgeRelaySend(JSON.stringify({ type: "snapshot-response", requestId: parsed.requestId, snapshot: `Error gathering snapshot: ${err.message}` }));
            }
          } else if (parsed.type === "sandbox-execute-request" && parsed.requestId) {
            console.log(`[Bridge] Received sandbox-execute-request (reqId: ${parsed.requestId.slice(0, 8)}, actions: ${(parsed.actions || []).length})`);
            try {
              const projectsDir = path.resolve(process.cwd(), "projects");
              const result = await executeSandboxActions(parsed.actions || [], projectsDir, { auditLog: sandboxAuditLog, previewProcesses });
              bridgeRelaySend(JSON.stringify({ type: "sandbox-execute-response", requestId: parsed.requestId, result }));
              console.log(`[Bridge] Sent sandbox-execute-response (reqId: ${parsed.requestId.slice(0, 8)})`);
              const fileWriteActions = new Set(["write_file", "create_file", "search_replace", "delete_file", "move_file", "rename_file", "copy_file"]);
              const hadFileWrite = (parsed.actions || []).some((a: any) => fileWriteActions.has(a.type));
              if (hadFileWrite && result && result.success) {
                try { server.hot.send({ type: "custom", event: "lamby:files-changed", data: { ts: Date.now() } }); } catch {}
              }
            } catch (err: any) {
              console.error(`[Bridge] sandbox-execute error: ${err.message}`);
              bridgeRelaySend(JSON.stringify({ type: "sandbox-execute-response", requestId: parsed.requestId, result: { error: err.message } }));
            }
          } else if (parsed.type === "browser-interact-request" && parsed.requestId) {
            console.log(`[Bridge] Received browser-interact-request (reqId: ${parsed.requestId.slice(0, 8)}, action: ${parsed.action || "?"})`);
            try {
              const projectsDir = path.resolve(process.cwd(), "projects");
              const interactAction = {
                type: "browser_interact",
                project: parsed.project || parsed.projectName || "",
                action: parsed.action,
                selector: parsed.selector,
                functionName: parsed.functionName,
                script: parsed.script || parsed.functionName,
                args: parsed.args,
                value: parsed.value,
                screenshot: parsed.screenshot === true,
                fullPage: parsed.fullPage,
                timeout: parsed.timeout,
                waitAfter: parsed.waitAfter,
                extractText: parsed.extractText,
                extractSelector: parsed.extractSelector,
                width: parsed.width,
                height: parsed.height,
                waitMs: parsed.waitMs,
                url: parsed.url,
              };
              const result = await executeSandboxActions([interactAction], projectsDir, { auditLog: sandboxAuditLog, previewProcesses });
              bridgeRelaySend(JSON.stringify({ type: "browser-interact-response", requestId: parsed.requestId, result }));
              console.log(`[Bridge] Sent browser-interact-response (reqId: ${parsed.requestId.slice(0, 8)})`);
            } catch (err: any) {
              console.error(`[Bridge] browser-interact error: ${err.message}`);
              bridgeRelaySend(JSON.stringify({ type: "browser-interact-response", requestId: parsed.requestId, result: { error: err.message } }));
            }
          } else if (parsed.type === "console-logs-request" && parsed.requestId) {
            console.log(`[Bridge] Received console-logs-request for "${parsed.projectName || ""}" (reqId: ${parsed.requestId.slice(0, 8)})`);
            try {
              const logs = gatherConsoleLogs(parsed.projectName || "");
              bridgeRelaySend(JSON.stringify({ type: "console-logs-response", requestId: parsed.requestId, logs }));
              console.log(`[Bridge] Sent console-logs-response (reqId: ${parsed.requestId.slice(0, 8)})`);
            } catch (err: any) {
              console.error(`[Bridge] console-logs error: ${err.message}`);
              bridgeRelaySend(JSON.stringify({ type: "console-logs-response", requestId: parsed.requestId, logs: { error: `Error gathering console logs: ${err.message}` } }));
            }
          } else if (parsed.type === "ping") {
            bridgeRelaySend(JSON.stringify({ type: "pong" }));
          } else if (parsed.type === "pong") {
          } else if (parsed.type === "relay-log") {
            const lvl = (parsed.level || "info").toUpperCase();
            const logMsg = parsed.message || "";
            const prefix = `[Relay ${lvl}]`;
            if (lvl === "ERROR") console.error(`${prefix} ${logMsg}`);
            else if (lvl === "WARN") console.warn(`${prefix} ${logMsg}`);
            else console.log(`${prefix} ${logMsg}`);
            if (typeof sandboxWss !== "undefined") {
              const fwd = JSON.stringify({ type: "relay-log", level: parsed.level, message: logMsg, ts: parsed.ts || Date.now() });
              sandboxWss.clients.forEach((c: any) => { try { if (c.readyState === 1) c.send(fwd); } catch {} });
            }
          }
        } catch (err: any) {
          console.error(`[Bridge] handleBridgeRelayMessage error: ${err.message}`);
        }
      }

      function processRelayBuffer() {
        while (bridgeRelayBuffer.length > 0) {
          const { data, opcode, bytesConsumed } = wsRelayDecodeFrame(bridgeRelayBuffer);
          if (data === null) break;
          bridgeRelayBuffer = bridgeRelayBuffer.slice(bytesConsumed);
          if (opcode === 0x8) { if (bridgeRelaySocket) bridgeRelaySocket.destroy(); return; }
          if (opcode === 0x9) {
            const pong = Buffer.alloc(2); pong[0] = 0x8a; pong[1] = 0;
            if (bridgeRelaySocket) bridgeRelaySocket.write(pong);
            continue;
          }
          handleBridgeRelayMessage(data).catch((err: any) => {
            console.error(`[Bridge] Unhandled relay message error: ${err.message}`);
          });
        }
      }

      function scheduleRelayReconnect() {
        if (bridgeRelayReconnectTimer) return;
        const delay = Math.min(bridgeRelayReconnectDelay, 60000);
        console.log(`[Bridge] Reconnecting in ${delay / 1000}s...`);
        bridgeRelayReconnectTimer = setTimeout(() => {
          bridgeRelayReconnectTimer = null;
          bridgeRelayReconnectDelay = Math.min(bridgeRelayReconnectDelay * 1.5, 60000);
          connectToRelay();
        }, delay);
      }

      function connectToRelay() {
        if (bridgeRelaySocket) { try { bridgeRelaySocket.destroy(); } catch {} bridgeRelaySocket = null; }
        bridgeRelayConnected = false;
        if (bridgeRelayPingTimer) { clearInterval(bridgeRelayPingTimer); bridgeRelayPingTimer = null; }

        if (!BRIDGE_RELAY_URL) { console.log("[Bridge] No relay URL — skipping"); return; }
        let parsed: URL;
        try { parsed = new URL(BRIDGE_RELAY_URL); } catch { console.error("[Bridge] Invalid relay URL:", BRIDGE_RELAY_URL); return; }

        const host = parsed.hostname;
        const port = parsed.port ? parseInt(parsed.port) : (parsed.protocol === "https:" ? 443 : 80);
        const useTls = parsed.protocol === "https:";
        const wsPath = `/bridge-ws?key=${encodeURIComponent(bridgeRelayKey)}&snapshotKey=${encodeURIComponent(snapshotKey)}`;
        const wsKeyRaw = crypto.randomBytes(16).toString("base64");

        console.log(`[Bridge] Connecting to ${host}...`);

        const tlsMod = _require("tls");
        const netMod = _require("net");
        const connectOpts = { host, port, servername: host };
        const socket = useTls ? tlsMod.connect(connectOpts) : netMod.connect(connectOpts);

        let handshakeDone = false;
        let httpBuffer = "";
        bridgeRelayBuffer = Buffer.alloc(0);

        socket.on("connect", () => {
          socket.write(
            `GET ${wsPath} HTTP/1.1\r\n` +
            `Host: ${host}\r\n` +
            `Upgrade: websocket\r\n` +
            `Connection: Upgrade\r\n` +
            `Sec-WebSocket-Key: ${wsKeyRaw}\r\n` +
            `Sec-WebSocket-Version: 13\r\n` +
            `\r\n`
          );
        });

        socket.on("data", (chunk: Buffer) => {
          if (!handshakeDone) {
            httpBuffer += chunk.toString("utf-8");
            const headerEnd = httpBuffer.indexOf("\r\n\r\n");
            if (headerEnd === -1) return;
            const statusLine = httpBuffer.split("\r\n")[0];
            if (!statusLine.includes("101")) {
              console.error(`[Bridge] Handshake failed: ${statusLine}`);
              socket.destroy();
              scheduleRelayReconnect();
              return;
            }
            handshakeDone = true;
            bridgeRelaySocket = socket;
            bridgeRelayConnected = true;
            bridgeRelayLastConnectedAt = Date.now();
            bridgeRelayReconnectDelay = 2000;
            console.log(`[Bridge] Connected to relay at ${host}`);
            bridgeRelaySend(JSON.stringify({ type: "ping" }));
            bridgeRelayPingTimer = setInterval(() => {
              bridgeRelaySend(JSON.stringify({ type: "ping" }));
            }, 15000);
            const headerBytes = Buffer.byteLength(httpBuffer.slice(0, headerEnd + 4), "utf-8");
            const remaining = chunk.slice(headerBytes);
            if (remaining.length > 0) {
              bridgeRelayBuffer = Buffer.concat([bridgeRelayBuffer, remaining]);
              processRelayBuffer();
            }
            return;
          }
          bridgeRelayBuffer = Buffer.concat([bridgeRelayBuffer, chunk]);
          processRelayBuffer();
        });

        socket.on("close", (hadError: boolean) => {
          const uptime = bridgeRelayLastConnectedAt ? Math.round((Date.now() - bridgeRelayLastConnectedAt) / 1000) : 0;
          if (bridgeRelayConnected) console.log(`[Bridge] Disconnected from relay (hadError: ${hadError}, uptime: ${uptime}s)`);
          bridgeRelayConnected = false;
          bridgeRelaySocket = null;
          if (bridgeRelayPingTimer) { clearInterval(bridgeRelayPingTimer); bridgeRelayPingTimer = null; }
          scheduleRelayReconnect();
        });

        socket.on("error", (err: any) => {
          console.error(`[Bridge] Connection error: ${err.code || err.message}`);
          bridgeRelayConnected = false;
          bridgeRelaySocket = null;
          if (bridgeRelayPingTimer) { clearInterval(bridgeRelayPingTimer); bridgeRelayPingTimer = null; }
          scheduleRelayReconnect();
        });
      }

      setTimeout(() => connectToRelay(), 2000);

      server.middlewares.use("/api/bridge-relay-status", async (req, res) => {
        if (req.method !== "GET") { res.statusCode = 405; res.end("Method not allowed"); return; }
        res.setHeader("Content-Type", "application/json");
        const withinGrace = !bridgeRelayConnected && bridgeRelayLastConnectedAt > 0 && (Date.now() - bridgeRelayLastConnectedAt) < BRIDGE_RELAY_GRACE_PERIOD_MS;
        const effectiveStatus = bridgeRelayConnected ? "connected" : (withinGrace ? "connected" : (bridgeRelayReconnectTimer ? "connecting" : "disconnected"));
        res.end(JSON.stringify({
          status: effectiveStatus,
          relayUrl: BRIDGE_RELAY_URL,
          snapshotKey,
        }));
      });

      server.middlewares.use("/api/bridge-status", async (req, res) => {
        if (req.method !== "GET") { res.statusCode = 405; res.end("Method not allowed"); return; }
        res.setHeader("Content-Type", "application/json");
        const withinGrace = !bridgeRelayConnected && bridgeRelayLastConnectedAt > 0 && (Date.now() - bridgeRelayLastConnectedAt) < BRIDGE_RELAY_GRACE_PERIOD_MS;
        const effectiveStatus = bridgeRelayConnected ? "connected" : (withinGrace ? "connected" : (bridgeRelayReconnectTimer ? "connecting" : "disconnected"));
        res.end(JSON.stringify({
          status: effectiveStatus,
          relayUrl: BRIDGE_RELAY_URL,
          bridgeKey: bridgeRelayKey,
          key: snapshotKey,
        }));
      });

      server.middlewares.use("/api/console-logs", async (req, res) => {
        if (req.method !== "GET") { res.statusCode = 405; res.end("Method not allowed"); return; }
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const projectName = url.searchParams.get("project") || "";
        const providedKey = url.searchParams.get("key") || (req.headers.authorization || "").replace("Bearer ", "");
        if (providedKey !== snapshotKey) { res.statusCode = 403; res.end(JSON.stringify({ error: "Invalid key" })); return; }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(gatherConsoleLogs(projectName)));
      });

      server.middlewares.use("/api/sandbox/execute", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const url = new URL(req.url || "", `http://${req.headers.host}`);
          const providedKey = url.searchParams.get("key") || (req.headers.authorization || "").replace("Bearer ", "");

          let matchedBridgeClient: { ws: any; snapshotKey: string } | null = null;
          if (providedKey !== snapshotKey) {
            for (const [, client] of bridgeClients) {
              if (client.snapshotKey === providedKey && client.ws.readyState === 1) { matchedBridgeClient = client; break; }
            }
            if (!matchedBridgeClient) { res.statusCode = 403; res.end(JSON.stringify({ error: "Invalid key" })); return; }
          }

          const body = JSON.parse(await readBody(req));
          const actions = body.actions;
          if (!Array.isArray(actions) || actions.length === 0) {
            res.statusCode = 400; res.end(JSON.stringify({ error: "actions array required" })); return;
          }
          if (actions.length > 50) {
            res.statusCode = 400; res.end(JSON.stringify({ error: "Max 50 actions per request" })); return;
          }

          if (matchedBridgeClient) {
            const requestId = crypto.randomUUID();
            const relayPromise = new Promise<string>((resolve) => {
              const timer = setTimeout(() => {
                pendingSandboxRelayRequests.delete(requestId);
                resolve(JSON.stringify({ error: "Relay timeout — desktop app did not respond within 60 seconds." }));
              }, 60000);
              pendingSandboxRelayRequests.set(requestId, { resolve, timer });
            });
            try {
              matchedBridgeClient.ws.send(JSON.stringify({ type: "sandbox-execute-request", requestId, actions }));
            } catch {
              res.statusCode = 502;
              res.end(JSON.stringify({ error: "Could not reach desktop app through relay bridge." }));
              return;
            }
            const result = await relayPromise;
            res.setHeader("Content-Type", "application/json");
            res.end(result);
            return;
          }

          const projectsDir = path.resolve(process.cwd(), "projects");
          const result = await executeSandboxActions(actions, projectsDir, { auditLog: sandboxAuditLog, previewProcesses });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use("/api/sandbox/audit-log", async (req, res) => {
        if (req.method !== "GET") { res.statusCode = 405; res.end("Method not allowed"); return; }
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const providedKey = url.searchParams.get("key") || (req.headers.authorization || "").replace("Bearer ", "");
        if (providedKey !== snapshotKey) {
          let bridgeMatch = false;
          for (const [, client] of bridgeClients) {
            if (client.snapshotKey === providedKey && client.ws.readyState === 1) { bridgeMatch = true; break; }
          }
          if (!bridgeMatch) { res.statusCode = 403; res.end(JSON.stringify({ error: "Invalid key" })); return; }
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ entries: sandboxAuditLog.slice(-100) }));
      });

      let activePreviewPort: number | null = null;

      const proxyToPreview = async (req: any, res: any, port: number, targetPath: string) => {
        const http = await import("http");
        const proxyReq = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path: targetPath,
            method: req.method,
            headers: { ...req.headers, host: `localhost:${port}` },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          }
        );
        proxyReq.on("error", () => {
          if (!res.headersSent) { res.statusCode = 502; res.end("Preview server not responding"); }
        });
        req.pipe(proxyReq, { end: true });
      };

      server.middlewares.use((req, _res, next) => {
        if (req.url === "/" || req.url === "/index.html") {
          activePreviewPort = null;
        }
        next();
      });

      server.middlewares.use("/__preview", async (req, res) => {
        const match = req.url?.match(/^\/(\d+)(\/.*)?$/) || req.url?.match(/^\/__preview\/(\d+)(\/.*)?$/);
        if (!match) { res.statusCode = 400; res.end("Invalid preview URL"); return; }
        const port = parseInt(match[1], 10);
        const targetPath = match[2] || "/";

        if (port < 5100 || port > 5200) { res.statusCode = 400; res.end("Port out of preview range"); return; }

        activePreviewPort = port;
        await proxyToPreview(req, res, port, targetPath);
      });

      if (server.httpServer) {
        const { WebSocketServer } = await import("ws");
        const sandboxWss = new WebSocketServer({ noServer: true });

        sandboxWss.on("connection", (ws: any) => {
          console.log("[Sandbox WS] Client connected");
          ws.on("message", async (data: any) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.type === "execute") {
                const actions = msg.actions;
                if (!Array.isArray(actions) || actions.length === 0) {
                  ws.send(JSON.stringify({ type: "result", requestId: msg.requestId, error: "actions array required" }));
                  return;
                }
                if (actions.length > 50) {
                  ws.send(JSON.stringify({ type: "result", requestId: msg.requestId, error: "Max 50 actions per request" }));
                  return;
                }
                const projectsDir = path.resolve(process.cwd(), "projects");
                const onActionResult = msg.stream ? (i: number, result: any) => {
                  try { ws.send(JSON.stringify({ type: "action-result", requestId: msg.requestId, actionIndex: i, actionType: result.type, status: result.status, data: result.data, error: result.error })); } catch {}
                } : undefined;
                const wsResult = await executeSandboxActions(actions, projectsDir, { auditLog: sandboxAuditLog, onActionResult, previewProcesses });
                ws.send(JSON.stringify({ type: "result", requestId: msg.requestId, ...wsResult }));
                const fileWriteActions2 = new Set(["write_file", "create_file", "search_replace", "delete_file", "move_file", "rename_file", "copy_file"]);
                const hadFileWrite2 = actions.some((a: any) => fileWriteActions2.has(a.type));
                if (hadFileWrite2 && wsResult && wsResult.success) {
                  try { server.hot.send({ type: "custom", event: "lamby:files-changed", data: { ts: Date.now() } }); } catch {}
                }
              } else if (msg.type === "ping") {
                ws.send(JSON.stringify({ type: "pong" }));
              }
            } catch (err: any) {
              try { ws.send(JSON.stringify({ type: "error", error: err.message })); } catch {}
            }
          });
          ws.on("close", () => { console.log("[Sandbox WS] Client disconnected"); });
          ws.on("error", () => {});
        });

        const bridgeWss = new WebSocketServer({ noServer: true });

        bridgeWss.on("connection", (ws: any, bridgeKey: string, clientSnapshotKey: string) => {
          console.log(`[Bridge Relay] Desktop client connected (key: ${bridgeKey.substring(0, 8)}...)`);
          bridgeClients.set(bridgeKey, { ws, snapshotKey: clientSnapshotKey, lastPing: Date.now() });

          ws.on("message", (data: any) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.type === "snapshot-response" && msg.requestId) {
                const pending = pendingRelayRequests.get(msg.requestId);
                if (pending) {
                  clearTimeout(pending.timer);
                  pendingRelayRequests.delete(msg.requestId);
                  pending.resolve(msg.snapshot || "Error: Empty snapshot response from desktop.");
                }
              } else if (msg.type === "sandbox-execute-response" && msg.requestId) {
                const pending = pendingSandboxRelayRequests.get(msg.requestId);
                if (pending) {
                  clearTimeout(pending.timer);
                  pendingSandboxRelayRequests.delete(msg.requestId);
                  pending.resolve(JSON.stringify(msg.result || { error: "Empty sandbox response from desktop." }));
                }
              } else if (msg.type === "ping") {
                const client = bridgeClients.get(bridgeKey);
                if (client) client.lastPing = Date.now();
                try { ws.send(JSON.stringify({ type: "pong" })); } catch {}
              }
            } catch {}
          });

          ws.on("close", () => {
            console.log(`[Bridge Relay] Desktop client disconnected (key: ${bridgeKey.substring(0, 8)}...)`);
            bridgeClients.delete(bridgeKey);
          });

          ws.on("error", () => {
            bridgeClients.delete(bridgeKey);
          });
        });

        server.httpServer.on("upgrade", (req: any, socket: any, head: any) => {
          if (req.url && req.url.startsWith("/ws/sandbox")) {
            const reqUrl = new URL(req.url, "http://localhost");
            const providedKey = reqUrl.searchParams.get("key") || "";
            if (providedKey !== snapshotKey) {
              let bridgeMatch = false;
              for (const [, client] of bridgeClients) {
                if (client.snapshotKey === providedKey && client.ws.readyState === 1) { bridgeMatch = true; break; }
              }
              if (!bridgeMatch) { socket.destroy(); return; }
            }
            sandboxWss.handleUpgrade(req, socket, head, (ws: any) => {
              sandboxWss.emit("connection", ws);
            });
            return;
          }
          if (req.url && req.url.startsWith("/bridge-ws")) {
            const reqUrl = new URL(req.url, "http://localhost");
            const bridgeKey = reqUrl.searchParams.get("key") || "";
            const clientSnapshotKey = reqUrl.searchParams.get("snapshotKey") || "";
            if (!bridgeKey || bridgeKey.length < 8) {
              socket.destroy();
              return;
            }
            bridgeWss.handleUpgrade(req, socket, head, (ws: any) => {
              bridgeWss.emit("connection", ws, bridgeKey, clientSnapshotKey);
            });
            return;
          }

          const match = req.url && req.url.match(/^\/__preview\/(\d+)(\/.*)?$/);
          if (match) {
            const previewPort = parseInt(match[1], 10);
            if (previewPort < 5100 || previewPort > 5200) { socket.destroy(); return; }
            const targetPath = match[2] || "/";
            const net = require("net");
            const proxySocket = net.connect(previewPort, "127.0.0.1", () => {
              const reqLine = `${req.method || "GET"} ${targetPath} HTTP/1.1\r\n`;
              const headers = Object.entries(req.headers).map(([k, v]: [string, any]) => `${k}: ${v}`).join("\r\n");
              proxySocket.write(reqLine + headers + "\r\n\r\n");
              if (head && head.length) proxySocket.write(head);
              socket.pipe(proxySocket);
              proxySocket.pipe(socket);
            });
            proxySocket.on("error", () => socket.destroy());
            socket.on("error", () => proxySocket.destroy());
          }
        });
      }

      server.middlewares.use("/sw.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister().then(()=>self.clients.matchAll()).then(cs=>cs.forEach(c=>c.navigate(c.url)))));`);
      });

      const PREVIEW_ASSET_PREFIXES = ["/_next/", "/__nextjs", "/__vite", "/@vite/", "/@react-refresh", "/@id/", "/@fs/", "/node_modules/", "/src/", "/favicon.ico", "/opengraph-image", "/apple-touch-icon", "/manifest.json", "/workbox-", "/static/", "/sockjs-node/", "/build/", "/_assets/", "/assets/", "/public/", "/polyfills", "/.vite/", "/hmr", "/__webpack_hmr", "/@tailwindcss/"];
      server.middlewares.use(async (req, res, next) => {
        if (!activePreviewPort || !req.url) { next(); return; }
        const shouldProxy = PREVIEW_ASSET_PREFIXES.some(p => req.url!.startsWith(p));
        if (!shouldProxy) { next(); return; }
        await proxyToPreview(req, res, activePreviewPort, req.url);
      });

      server.middlewares.use("/api/projects/preview-info", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          const entry = previewProcesses.get(name);
          const replitDomain = process.env.REPLIT_DEV_DOMAIN || "";
          res.setHeader("Content-Type", "application/json");
          if (entry) {
            const proxyUrl = `/__preview/${entry.port}/`;
            res.end(JSON.stringify({ running: true, port: entry.port, proxyUrl, replitDomain }));
          } else {
            res.end(JSON.stringify({ running: false }));
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use("/api/projects/stop-preview", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
        try {
          const { name } = JSON.parse(await readBody(req));
          previewStoppedManually.add(name);
          const entry = previewProcesses.get(name);
          if (entry) {
            const pid = entry.process.pid;
            if (process.platform === "win32") {
              try { const { execSync } = await import("child_process"); execSync(`taskkill /pid ${pid} /T /F`, { stdio: "pipe", windowsHide: true }); } catch {}
            } else {
              try { process.kill(-pid, 9); } catch {}
            }
            try { entry.process.kill("SIGKILL"); } catch {}
            try {
              const fs = await import("fs");
              const killPort = async (port: number) => {
                if (process.platform === "win32") {
                  try {
                    const { execSync } = await import("child_process");
                    const out = execSync(`netstat -ano | findstr :${port}`, { stdio: "pipe", encoding: "utf-8", windowsHide: true });
                    const pids = new Set(out.split("\n").map((l: string) => l.trim().split(/\s+/).pop()).filter((p: any) => p && /^\d+$/.test(p)));
                    for (const p of pids) { try { execSync(`taskkill /pid ${p} /T /F`, { stdio: "pipe", windowsHide: true }); } catch {} }
                  } catch {}
                  return;
                }
                const netTcp = fs.readFileSync("/proc/net/tcp", "utf-8") + fs.readFileSync("/proc/net/tcp6", "utf-8");
                const portHex = port.toString(16).toUpperCase().padStart(4, "0");
                const lines = netTcp.split("\n").filter((l: string) => l.includes(`:${portHex} `));
                for (const line of lines) {
                  const cols = line.trim().split(/\s+/);
                  const inode = cols[9];
                  if (!inode || inode === "0") continue;
                  const procDirs = fs.readdirSync("/proc").filter((d: string) => /^\d+$/.test(d));
                  for (const p of procDirs) {
                    try {
                      const fds = fs.readdirSync(`/proc/${p}/fd`);
                      for (const fd of fds) {
                        try {
                          if (fs.readlinkSync(`/proc/${p}/fd/${fd}`) === `socket:[${inode}]`) {
                            try { process.kill(-parseInt(p), 9); } catch {}
                            try { process.kill(parseInt(p), 9); } catch {}
                          }
                        } catch {}
                      }
                    } catch {}
                  }
                }
              };
              await killPort(entry.port);
            } catch {}
            if (activePreviewPort === entry.port) activePreviewPort = null;
            previewProcesses.delete(name);
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ stopped: true }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

function sourceDownloadPlugin(): Plugin {
  return {
    name: "source-download",
    configureServer(server) {
      server.middlewares.use("/api/download-source", async (_req, res) => {
        try {
          const archiver = (await import("archiver")).default;
          const projectRoot = process.cwd();

          res.setHeader("Content-Type", "application/zip");
          res.setHeader("Content-Disposition", "attachment; filename=lambda-recursive-source.zip");

          const archive = archiver("zip", { zlib: { level: 9 } });
          archive.pipe(res);

          const includeDirs = ["src", "public", "supabase", "electron-browser", "server", "scripts", "test"];
          const includeFiles = [
            "package.json", "package-lock.json", "tsconfig.json", "tsconfig.app.json",
            "tsconfig.node.json", "vite.config.ts", "tailwind.config.ts", "postcss.config.js",
            "index.html", "eslint.config.js", ".env", ".env.example", "replit.md",
            "components.json"
          ];

          for (const dir of includeDirs) {
            const fs = await import("fs");
            const dirPath = path.join(projectRoot, dir);
            if (fs.existsSync(dirPath)) {
              archive.directory(dirPath, dir, (entry) => {
                if (entry.name.includes("node_modules") || entry.name.includes(".cache")) return false;
                return entry;
              });
            }
          }

          for (const file of includeFiles) {
            const fs = await import("fs");
            const filePath = path.join(projectRoot, file);
            if (fs.existsSync(filePath)) {
              archive.file(filePath, { name: file });
            }
          }

          await archive.finalize();
        } catch (err) {
          console.error("Download source error:", err);
          res.statusCode = 500;
          res.end("Failed to create source archive");
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    watch: {
      ignored: ["**/projects/**", "**/.local/**", "**/node_modules/**", "**/.cache/**"],
    },
  },
  plugins: [
    react(),
    fileWritePlugin(),
    projectManagementPlugin(),
    sourceDownloadPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-icon-512.png"],
      devOptions: {
        enabled: false,
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      manifest: {
        name: "Lamby",
        short_name: "Lamby",
        description: "AI-powered autonomous development loop",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
