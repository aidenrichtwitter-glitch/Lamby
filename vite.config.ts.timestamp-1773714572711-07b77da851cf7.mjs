var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// vite.config.ts
import { defineConfig } from "file:///home/runner/workspace/node_modules/vite/dist/node/index.js";
import react from "file:///home/runner/workspace/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { VitePWA } from "file:///home/runner/workspace/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "/home/runner/workspace";
function fileWritePlugin() {
  return {
    name: "file-write",
    configureServer(server) {
      const fs = __require("fs");
      function detectPmForDir2(projDir) {
        if (fs.existsSync(path.join(projDir, "bun.lockb")) || fs.existsSync(path.join(projDir, "bun.lock"))) return "bun";
        if (fs.existsSync(path.join(projDir, "pnpm-lock.yaml"))) return "pnpm";
        if (fs.existsSync(path.join(projDir, "yarn.lock"))) return "yarn";
        return "npm";
      }
      server.middlewares.use("/api/write-file", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          let body = "";
          for await (const chunk of req) body += chunk;
          const { filePath, content } = JSON.parse(body);
          if (!filePath || typeof content !== "string") {
            res.statusCode = 400;
            res.end("Missing filePath or content");
            return;
          }
          const fs2 = await import("fs");
          const projectRoot = process.cwd();
          const resolved = path.resolve(projectRoot, filePath);
          if (!resolved.startsWith(projectRoot)) {
            res.statusCode = 403;
            res.end("Path outside project");
            return;
          }
          const dir = path.dirname(resolved);
          if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
          let previousContent = "";
          if (fs2.existsSync(resolved)) previousContent = fs2.readFileSync(resolved, "utf-8");
          fs2.writeFileSync(resolved, content, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, filePath, previousContent, bytesWritten: content.length }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/read-file", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          let body = "";
          for await (const chunk of req) body += chunk;
          const { filePath } = JSON.parse(body);
          if (!filePath) {
            res.statusCode = 400;
            res.end("Missing filePath");
            return;
          }
          const fs2 = await import("fs");
          const projectRoot = process.cwd();
          const resolved = path.resolve(projectRoot, filePath);
          if (!resolved.startsWith(projectRoot)) {
            res.statusCode = 403;
            res.end("Path outside project");
            return;
          }
          const exists = fs2.existsSync(resolved);
          const content = exists ? fs2.readFileSync(resolved, "utf-8") : "";
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, exists, content }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    }
  };
}
function projectManagementPlugin() {
  return {
    name: "project-management",
    async configureServer(server) {
      async function readBody(req) {
        let body = "";
        for await (const chunk of req) body += chunk;
        return body;
      }
      function validateProjectPath(projectName, filePath) {
        const projectRoot = process.cwd();
        if (projectName === "__main__") {
          if (!filePath) return { valid: true, resolved: projectRoot };
          const BLOCKED_MAIN_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "projects", ".local", ".agents", ".upm", ".config", ".cache", "dist", "attached_assets", "path", ".replit"]);
          const BLOCKED_MAIN_FILES = /* @__PURE__ */ new Set([".env", ".env.local", ".env.development", ".env.production", ".gitattributes", ".gitignore", "bun.lock", "package-lock.json"]);
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
        if (!projectName || /[\/\\]|\.\./.test(projectName) || projectName === "." || projectName.startsWith(".")) {
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
      const snapshotKey = crypto.randomBytes(16).toString("hex");
      console.log(`[Lamby] Snapshot key generated (use /api/snapshot-key from localhost to retrieve)`);
      const snapshotRateLimit = /* @__PURE__ */ new Map();
      async function gatherProjectSnapshot(projectName) {
        const fs = await import("fs");
        const childProcess = await import("child_process");
        const check = validateProjectPath(projectName);
        if (!check.valid) return `Error: ${check.error}`;
        const projectDir = check.resolved;
        if (!fs.existsSync(projectDir)) return `Error: Project "${projectName}" not found.`;
        const SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".cache", "dist", ".git", ".next", ".nuxt", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache", "build", ".svelte-kit"]);
        const CODE_EXTS = /* @__PURE__ */ new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".py", ".md", ".yaml", ".yml", ".toml", ".env.example", ".gitignore", ".svelte", ".vue", ".astro"]);
        const MAX_FILE_SIZE = 12e3;
        const TOTAL_BUDGET = 1e5;
        const filePaths = [];
        function walkDir(dir, base) {
          let names;
          try {
            names = fs.readdirSync(dir);
          } catch {
            return;
          }
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
            } catch {
            }
          }
        }
        walkDir(projectDir, "");
        let output = `=== LAMBY PROJECT SNAPSHOT ===
`;
        output += `Project: ${projectName}
`;
        output += `Scanned at: ${(/* @__PURE__ */ new Date()).toISOString()}

`;
        output += `=== FILE TREE ===
`;
        for (const fp of filePaths) output += `- ${fp}
`;
        output += `
Total files: ${filePaths.length}

`;
        let gitStatus = "";
        let gitLog = "";
        try {
          gitStatus = childProcess.execSync("git status --short", { cwd: projectDir, timeout: 5e3 }).toString().trim();
          gitLog = childProcess.execSync("git log --oneline -10", { cwd: projectDir, timeout: 5e3 }).toString().trim();
        } catch {
        }
        if (gitStatus || gitLog) {
          output += `=== GIT STATUS ===
`;
          if (gitStatus) output += gitStatus + "\n";
          if (gitLog) output += `
Recent commits:
${gitLog}
`;
          output += `
`;
        }
        let pkgJson = "";
        try {
          pkgJson = fs.readFileSync(path.join(projectDir, "package.json"), "utf-8");
        } catch {
        }
        if (pkgJson) {
          output += `=== package.json ===
${pkgJson}

`;
        }
        output += `=== SOURCE FILES ===
`;
        let totalChars = output.length;
        const codeFiles = filePaths.filter((fp) => {
          const ext = path.extname(fp).toLowerCase();
          return CODE_EXTS.has(ext);
        });
        for (const fp of codeFiles) {
          if (totalChars >= TOTAL_BUDGET) {
            output += `
... (budget reached, ${codeFiles.length - codeFiles.indexOf(fp)} files omitted)
`;
            break;
          }
          try {
            const fullPath = path.join(projectDir, fp);
            const stat = fs.statSync(fullPath);
            if (stat.size > MAX_FILE_SIZE * 2) {
              output += `
--- ${fp} (${stat.size} bytes, too large, skipped) ---
`;
              continue;
            }
            let content = fs.readFileSync(fullPath, "utf-8");
            if (content.length > MAX_FILE_SIZE) content = content.substring(0, MAX_FILE_SIZE) + "\n... (truncated)";
            const block = `
--- ${fp} ---
${content}
`;
            totalChars += block.length;
            output += block;
          } catch {
          }
        }
        output += `
=== END SNAPSHOT ===
`;
        return output;
      }
      server.middlewares.use("/api/snapshot-key", async (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        const clientIp = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
        const isLocal = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "::ffff:127.0.0.1" || clientIp === "localhost";
        if (!isLocal) {
          res.statusCode = 403;
          res.end("Snapshot key only available from localhost");
          return;
        }
        res.setHeader("Content-Type", "application/json");
        const host = req.headers.host || "localhost:5000";
        const protocol = req.headers["x-forwarded-proto"] || "http";
        const baseUrl = `${protocol}://${host}`;
        res.end(JSON.stringify({ key: snapshotKey, baseUrl, exampleUrl: `${baseUrl}/api/snapshot/PROJECT_NAME?key=${snapshotKey}` }));
      });
      server.middlewares.use("/api/snapshot/", async (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const url = new URL(req.url || "", `http://${req.headers.host}`);
          const pathParts = url.pathname.split("/").filter(Boolean);
          const projectName = pathParts[0] || "";
          const providedKey = url.searchParams.get("key") || (req.headers.authorization || "").replace("Bearer ", "");
          if (!providedKey || providedKey !== snapshotKey) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "text/plain");
            res.end("Lamby Snapshot API\n\nAccess denied \u2014 invalid or missing key.\nProvide ?key=YOUR_KEY or Authorization: Bearer YOUR_KEY");
            return;
          }
          const now = Date.now();
          const clientIp = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
          const hits = snapshotRateLimit.get(clientIp) || [];
          const recentHits = hits.filter((t) => now - t < 6e4);
          if (recentHits.length >= 10) {
            res.statusCode = 429;
            res.setHeader("Content-Type", "text/plain");
            res.end("Rate limited \u2014 max 10 requests per minute. Try again shortly.");
            return;
          }
          recentHits.push(now);
          snapshotRateLimit.set(clientIp, recentHits);
          if (!projectName) {
            const fs = await import("fs");
            const projectsDir = path.resolve(process.cwd(), "projects");
            let projectList = [];
            if (fs.existsSync(projectsDir)) {
              projectList = fs.readdirSync(projectsDir).filter((n) => {
                try {
                  return fs.statSync(path.join(projectsDir, n)).isDirectory();
                } catch {
                  return false;
                }
              });
            }
            res.setHeader("Content-Type", "text/plain");
            res.end(`Lamby Snapshot API

Available projects:
${projectList.map((p) => `- ${p}`).join("\n") || "(none)"}

Usage: /api/snapshot/PROJECT_NAME?key=YOUR_KEY`);
            return;
          }
          const snapshot = await gatherProjectSnapshot(projectName);
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(snapshot);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain");
          res.end(`Error generating snapshot: ${err.message}`);
        }
      });
      server.middlewares.use("/api/projects/list", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const fs = await import("fs");
          const projectsDir = path.resolve(process.cwd(), "projects");
          if (!fs.existsSync(projectsDir)) {
            fs.mkdirSync(projectsDir, { recursive: true });
          }
          const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
          const projects = entries.filter((e) => e.isDirectory()).map((e) => {
            const projPath = path.join(projectsDir, e.name);
            const pkgPath = path.join(projPath, "package.json");
            let description = "";
            let framework = "react";
            if (fs.existsSync(pkgPath)) {
              try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                description = pkg.description || "";
                framework = pkg._framework || "react";
              } catch {
              }
            }
            const stat = fs.statSync(projPath);
            return {
              name: e.name,
              path: `projects/${e.name}`,
              createdAt: stat.birthtime.toISOString(),
              framework,
              description
            };
          });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, projects }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/create", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const body = JSON.parse(await readBody(req));
          const { name, framework = "react", description = "" } = body;
          if (!name || typeof name !== "string") {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Missing project name" }));
            return;
          }
          const check = validateProjectPath(name);
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const fs = await import("fs");
          const projectDir = check.resolved;
          if (fs.existsSync(projectDir)) {
            res.statusCode = 409;
            res.end(JSON.stringify({ success: false, error: "Project already exists" }));
            return;
          }
          fs.mkdirSync(projectDir, { recursive: true });
          const pkgJson = JSON.stringify({
            name,
            version: "0.0.1",
            private: true,
            description,
            _framework: framework
          }, null, 2);
          fs.writeFileSync(path.join(projectDir, "package.json"), pkgJson, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name, framework, description, path: `projects/${name}` }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/delete", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Missing project name" }));
            return;
          }
          const check = validateProjectPath(name);
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const fs = await import("fs");
          if (!fs.existsSync(check.resolved)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: "Project not found" }));
            return;
          }
          const tmpDest = check.resolved + `.__deleting_${Date.now()}`;
          try {
            fs.renameSync(check.resolved, tmpDest);
          } catch {
            fs.rmSync(check.resolved, { recursive: true, force: true });
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name }));
          if (fs.existsSync(tmpDest)) {
            fs.rm(tmpDest, { recursive: true, force: true }, () => {
            });
          }
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/duplicate", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          let copyFiltered = function(src, dest) {
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
          }, countCopiedFiles = function(dir) {
            try {
              for (const entry of fs.readdirSync(dir)) {
                const full = path.join(dir, entry);
                try {
                  const s = fs.lstatSync(full);
                  if (s.isFile()) copiedFiles++;
                  else if (s.isDirectory()) countCopiedFiles(full);
                } catch {
                }
              }
            } catch {
            }
          };
          const { name, newName } = JSON.parse(await readBody(req));
          if (!name) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Missing project name" }));
            return;
          }
          const check = validateProjectPath(name);
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const fs = await import("fs");
          if (!fs.existsSync(check.resolved)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: "Project not found" }));
            return;
          }
          const pDir = path.resolve(process.cwd(), "projects");
          let destName = newName;
          if (!destName) {
            let suffix = 1;
            do {
              destName = `${name}-copy${suffix > 1 ? `-${suffix}` : ""}`;
              suffix++;
            } while (fs.existsSync(path.join(pDir, destName)));
          }
          if (/[\/\\]|\.\./.test(destName) || destName === "." || destName.startsWith(".")) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Invalid destination name" }));
            return;
          }
          const destCheck = validateProjectPath(destName);
          if (!destCheck.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: destCheck.error }));
            return;
          }
          if (fs.existsSync(destCheck.resolved)) {
            res.statusCode = 409;
            res.end(JSON.stringify({ success: false, error: `Project '${destName}' already exists` }));
            return;
          }
          const SKIP_COPY = /* @__PURE__ */ new Set(["node_modules", ".git", ".next", ".nuxt", "dist", ".cache", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache", "bun.lock", "projects", ".local", "attached_assets"]);
          copyFiltered(check.resolved, destCheck.resolved);
          let copiedFiles = 0;
          countCopiedFiles(destCheck.resolved);
          if (copiedFiles === 0) {
            console.warn(`[Lamby] Duplicate failed: "${name}" \u2192 "${destName}" produced 0 files (source: ${check.resolved})`);
            try {
              fs.rmSync(destCheck.resolved, { recursive: true, force: true });
            } catch {
            }
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Duplicate produced no files \u2014 the source project may be empty or contain only excluded directories." }));
            return;
          }
          console.log(`[Lamby] Duplicated "${name}" \u2192 "${destName}" (${copiedFiles} files)`);
          const pkgPath = path.join(destCheck.resolved, "package.json");
          if (fs.existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
              pkg.name = destName;
              fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf-8");
            } catch {
            }
          }
          let installed = false;
          if (fs.existsSync(pkgPath)) {
            try {
              const lockFile = path.join(destCheck.resolved, "package-lock.json");
              if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
            } catch {
            }
            const { execSync } = await import("child_process");
            const installCmds = [
              "npm install --legacy-peer-deps",
              "npm install --legacy-peer-deps --ignore-scripts",
              "npm install --legacy-peer-deps --force --ignore-scripts"
            ];
            for (const cmd of installCmds) {
              try {
                execSync(cmd, {
                  cwd: destCheck.resolved,
                  timeout: 12e4,
                  stdio: "pipe",
                  shell: true,
                  env: { ...process.env, HUSKY: "0", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" }
                });
                installed = true;
                break;
              } catch {
              }
            }
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name: destName, originalName: name, installed }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/files-main", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          let walkDir = function(dir, base, maxDepth) {
            if (maxDepth <= 0) return [];
            let names;
            try {
              names = fs.readdirSync(dir);
            } catch {
              return [];
            }
            const result = [];
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
              } catch {
              }
            }
            return result.sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === "directory" ? -1 : 1;
            });
          };
          const fs = await import("fs");
          const rootDir = process.cwd();
          const SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".cache", "dist", ".git", ".next", ".nuxt", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache", "projects", "attached_assets", ".local", ".agents", ".upm", ".config", "path", ".replit"]);
          const tree = walkDir(rootDir, "", 6);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name: "__main__", files: tree }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/files", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          let walkDir = function(dir, base) {
            let names;
            try {
              names = fs.readdirSync(dir);
            } catch {
              return [];
            }
            const result = [];
            for (const name2 of names) {
              if (name2 === ".DS_Store") continue;
              const fullPath = path.join(dir, name2);
              const relPath = base ? base + "/" + name2 : name2;
              try {
                const stat = fs.lstatSync(fullPath);
                if (stat.isDirectory()) {
                  if (SKIP_DIRS.has(name2)) continue;
                  const children = walkDir(fullPath, relPath);
                  result.push({ name: name2, path: relPath, type: "directory", children });
                } else if (stat.isFile()) {
                  result.push({ name: name2, path: relPath, type: "file" });
                }
              } catch {
              }
            }
            return result.sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === "directory" ? -1 : 1;
            });
          };
          const { name } = JSON.parse(await readBody(req));
          if (!name) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Missing project name" }));
            return;
          }
          const check = validateProjectPath(name);
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const fs = await import("fs");
          if (!fs.existsSync(check.resolved)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: "Project not found" }));
            return;
          }
          const SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".cache", "dist", ".git", ".next", ".nuxt", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache"]);
          const tree = walkDir(check.resolved, "");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, name, files: tree }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/read-file", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name, filePath } = JSON.parse(await readBody(req));
          if (!name || !filePath) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Missing name or filePath" }));
            return;
          }
          const check = validateProjectPath(name, filePath);
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const fs = await import("fs");
          const exists = fs.existsSync(check.resolved);
          const content = exists ? fs.readFileSync(check.resolved, "utf-8") : "";
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, exists, content, filePath }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/write-file", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name, filePath, content } = JSON.parse(await readBody(req));
          if (!name || !filePath || typeof content !== "string") {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Missing name, filePath, or content" }));
            return;
          }
          const check = validateProjectPath(name, filePath);
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const fs = await import("fs");
          const dir = path.dirname(check.resolved);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          let previousContent = "";
          if (fs.existsSync(check.resolved)) previousContent = fs.readFileSync(check.resolved, "utf-8");
          fs.writeFileSync(check.resolved, content, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, filePath, previousContent, bytesWritten: content.length }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      const previewProcesses = /* @__PURE__ */ new Map();
      const projectPort = (name) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
        return 5100 + (hash % 100 + 100) % 100;
      };
      server.middlewares.use("/api/projects/preview", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name || /[\/\\]|\.\./.test(name)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Invalid project name" }));
            return;
          }
          const fs = await import("fs");
          const projectDir = path.resolve(process.cwd(), "projects", name);
          if (!fs.existsSync(projectDir)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Project not found" }));
            return;
          }
          if (previewProcesses.has(name)) {
            const existing = previewProcesses.get(name);
            console.log(`[Preview] Killing existing preview for ${name} (port ${existing.port})`);
            try {
              if (process.platform === "win32") {
                try {
                  const { execSync: es } = await import("child_process");
                  es(`taskkill /pid ${existing.process.pid} /T /F`, { stdio: "pipe", windowsHide: true });
                } catch {
                }
              } else {
                try {
                  process.kill(-existing.process.pid, 9);
                } catch {
                }
              }
              try {
                existing.process.kill("SIGKILL");
              } catch {
              }
            } catch {
            }
            previewProcesses.delete(name);
          }
          let port = projectPort(name);
          const usedPorts = new Set([...previewProcesses.values()].map((e) => e.port));
          while (usedPorts.has(port)) port++;
          const { spawn, execSync } = await import("child_process");
          const net = await import("net");
          const killPortProcs = async (p) => {
            try {
              if (process.platform === "win32") {
                try {
                  const out = execSync(`netstat -ano | findstr :${p}`, { stdio: "pipe", encoding: "utf-8", windowsHide: true });
                  const pids = new Set(out.split("\n").map((l) => l.trim().split(/\s+/).pop()).filter((pp) => pp && /^\d+$/.test(pp) && pp !== "0"));
                  for (const pid of pids) {
                    try {
                      execSync(`taskkill /pid ${pid} /T /F`, { stdio: "pipe", windowsHide: true });
                    } catch {
                    }
                  }
                } catch {
                }
              } else {
                try {
                  execSync(`fuser -k ${p}/tcp`, { stdio: "pipe", timeout: 5e3 });
                } catch {
                }
              }
            } catch (e) {
              console.log(`[Preview] Port cleanup error: ${e.message}`);
            }
          };
          const waitForPortFree = async (p, maxWait2) => {
            const startW = Date.now();
            while (Date.now() - startW < maxWait2) {
              const inUse = await new Promise((resolve) => {
                const s = net.createServer();
                s.once("error", () => resolve(true));
                s.once("listening", () => {
                  s.close();
                  resolve(false);
                });
                s.listen(p, "0.0.0.0");
              });
              if (!inUse) return true;
              await new Promise((r) => setTimeout(r, 200));
            }
            return false;
          };
          const portInUse = await new Promise((resolve) => {
            const tester = net.createServer().once("error", (err) => {
              resolve(err.code === "EADDRINUSE");
            }).once("listening", () => {
              tester.close(() => resolve(false));
            }).listen(port);
          });
          if (portInUse) {
            console.log(`[Preview] Port ${port} still in use \u2014 killing`);
            await killPortProcs(port);
            const freed = await waitForPortFree(port, 3e3);
            if (!freed) {
              console.log(`[Preview] Port ${port} still occupied after 3s \u2014 picking new port`);
              port++;
              while (usedPorts.has(port)) port++;
            }
          }
          let hasPkg = fs.existsSync(path.join(projectDir, "package.json"));
          const hasNodeModules = fs.existsSync(path.join(projectDir, "node_modules"));
          let pkg = {};
          let effectiveProjectDir = projectDir;
          const SUB_CANDIDATES = ["frontend", "client", "web", "app"];
          if (hasPkg) {
            try {
              pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"));
            } catch {
            }
            const rootScripts = pkg.scripts || {};
            const rootDeps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
            const hasRootWebIndicator = rootScripts.dev || rootScripts.start || rootScripts.serve || ["react", "react-dom", "vue", "svelte", "next", "nuxt", "@angular/core", "vite", "preact", "solid-js", "astro"].some((fw) => fw in rootDeps);
            if (!hasRootWebIndicator) {
              for (const sub of SUB_CANDIDATES) {
                const subPkgPath = path.join(projectDir, sub, "package.json");
                if (fs.existsSync(subPkgPath)) {
                  try {
                    const subPkg = JSON.parse(fs.readFileSync(subPkgPath, "utf-8"));
                    const subDeps = { ...subPkg.dependencies || {}, ...subPkg.devDependencies || {} };
                    const subScripts = subPkg.scripts || {};
                    const hasSubWebConfig = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs", "next.config.js", "next.config.mjs", "next.config.ts"].some((f) => fs.existsSync(path.join(projectDir, sub, f)));
                    if (subScripts.dev || subScripts.start || hasSubWebConfig || ["react", "react-dom", "vue", "vite", "next", "nuxt"].some((fw) => fw in subDeps)) {
                      pkg = subPkg;
                      effectiveProjectDir = path.join(projectDir, sub);
                      console.log(`[Preview] Root package.json has no web setup \u2014 using ${sub}/package.json for ${name}`);
                      break;
                    }
                  } catch {
                  }
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
                  console.log(`[Preview] No root package.json \u2014 using ${sub}/package.json for ${name}`);
                } catch {
                }
                break;
              }
            }
          }
          const detectPackageManager = () => {
            for (const dir of [effectiveProjectDir, projectDir]) {
              if (fs.existsSync(path.join(dir, "bun.lockb")) || fs.existsSync(path.join(dir, "bun.lock"))) return "bun";
              if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
              if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn";
            }
            return "npm";
          };
          const pm = detectPackageManager();
          const safeInstallEnv = { ...process.env, HUSKY: "0", npm_config_ignore_scripts: "", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" };
          const ensureGitDir = (dir) => {
            const gitDir = path.join(dir, ".git");
            if (!fs.existsSync(gitDir)) {
              try {
                fs.mkdirSync(gitDir, { recursive: true });
                console.log(`[Preview] Created placeholder .git in ${dir}`);
              } catch {
              }
            }
          };
          const safeExecInstall = (cmd, cwd, label, timeoutMs = 12e4) => {
            try {
              console.log(`[Preview] ${label}: ${cmd}`);
              execSync(cmd, { cwd, timeout: timeoutMs, stdio: "pipe", shell: true, windowsHide: true, env: safeInstallEnv });
              console.log(`[Preview] ${label}: success`);
              return true;
            } catch (e) {
              console.error(`[Preview] ${label} failed:`, e.message?.slice(0, 300));
              return false;
            }
          };
          if (hasPkg && !fs.existsSync(path.join(effectiveProjectDir, "node_modules"))) {
            ensureGitDir(effectiveProjectDir);
            if (effectiveProjectDir !== projectDir) ensureGitDir(projectDir);
            const installCmd = pm === "npm" ? "npm install --legacy-peer-deps" : pm === "pnpm" ? "npx pnpm install --no-frozen-lockfile" : pm === "yarn" ? "npx yarn install --ignore-engines" : "npx bun install";
            if (!safeExecInstall(installCmd, effectiveProjectDir, `Install deps for ${name}`)) {
              if (!safeExecInstall("npm install --legacy-peer-deps --ignore-scripts", effectiveProjectDir, `Retry (ignore-scripts) for ${name}`)) {
                safeExecInstall("npm install --legacy-peer-deps --force --ignore-scripts", effectiveProjectDir, `Final retry (force+ignore-scripts) for ${name}`);
              }
            }
          }
          const SUBDIR_CANDIDATES = ["frontend", "client", "web", "app"];
          const detectDevCommand = () => {
            const scripts2 = pkg.scripts || {};
            const deps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
            const portStr = String(port);
            const matchScript = (scriptBody) => {
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
            const extractDevServerCmd = (scriptBody) => {
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
                const segments = cleaned.split("&&").map((s) => s.trim());
                for (const seg of segments) {
                  if (/^tsc\b|^tsc-watch|^node\s|^echo\b|^rm\s|^cp\s|^mkdir\s/.test(seg)) continue;
                  const matched = matchScript(seg);
                  if (matched) return seg;
                }
                const lastSeg = segments[segments.length - 1];
                return lastSeg || cleaned;
              }
              if (cleaned.includes("||")) {
                const segments = cleaned.split("||").map((s) => s.trim());
                for (const seg of segments) {
                  const matched = matchScript(seg);
                  if (matched) return seg;
                }
              }
              return cleaned;
            };
            const isSvelteKit = deps["@sveltejs/kit"] || deps["sveltekit"];
            const isPnpmMonorepo2 = fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"));
            if (isPnpmMonorepo2) {
              try {
                const wsYaml = fs.readFileSync(path.join(projectDir, "pnpm-workspace.yaml"), "utf-8");
                const hasPackages = wsYaml.includes("packages:");
                if (hasPackages) {
                  for (const key of Object.keys(scripts2)) {
                    if (scripts2[key].includes("--filter") && (key.includes("dev") || key === "lp:dev")) {
                      console.log(`[Preview] Detected pnpm monorepo, using script "${key}": ${scripts2[key]}`);
                      return { cmd: pm === "pnpm" ? "pnpm" : "npx pnpm", args: ["run", key] };
                    }
                  }
                }
              } catch {
              }
            }
            if (scripts2.dev) {
              if (isSvelteKit) {
                return { cmd: "npx", args: ["vite", "dev", "--host", "0.0.0.0", "--port", portStr] };
              }
              const extracted = extractDevServerCmd(scripts2.dev);
              const matched = matchScript(extracted);
              if (matched) return matched;
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", "dev"] : ["run", "dev"] };
            }
            if (scripts2.start) {
              const extracted = extractDevServerCmd(scripts2.start);
              const matched = matchScript(extracted);
              if (matched) return matched;
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", "start"] : ["run", "start"] };
            }
            if (scripts2.serve || scripts2["serve:rspack"]) {
              const serveScript = scripts2.serve || scripts2["serve:rspack"];
              const extracted = extractDevServerCmd(serveScript);
              const matched = matchScript(extracted);
              if (matched) return matched;
              const serveKey = scripts2.serve ? "serve" : "serve:rspack";
              return { cmd: pm === "npm" ? "npm" : `npx ${pm}`, args: pm === "npm" ? ["run", serveKey] : ["run", serveKey] };
            }
            for (const key of ["develop", "dev:app", "dev:client", "dev:frontend", "dev:web", "watch"]) {
              if (scripts2[key]) {
                const extracted = extractDevServerCmd(scripts2[key]);
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
                  const subDeps = { ...subPkg.dependencies || {}, ...subPkg.devDependencies || {} };
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
                } catch {
                }
              }
            }
            if (!hasPkg) {
              const hasAnyHtml = fs.existsSync(path.join(projectDir, "index.html")) || fs.readdirSync(projectDir).some((f) => f.endsWith(".html"));
              if (hasAnyHtml) return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
            }
            return { cmd: "npx", args: ["vite", "--host", "0.0.0.0", "--port", portStr] };
          };
          if (!hasPkg) {
            let hasRootIndex = fs.existsSync(path.join(projectDir, "index.html"));
            if (!hasRootIndex) {
              try {
                const dirFiles = fs.readdirSync(projectDir);
                const htmlFiles = dirFiles.filter((f) => f.endsWith(".html") && f !== "index.html");
                if (htmlFiles.length > 0) {
                  const primaryHtml = htmlFiles[0];
                  const redirectContent = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/${primaryHtml}"><title>Redirect</title></head><body><a href="/${primaryHtml}">Open</a></body></html>`;
                  fs.writeFileSync(path.join(projectDir, "index.html"), redirectContent);
                  hasRootIndex = true;
                  console.log(`[Preview] Created index.html redirect to ${primaryHtml} for ${name}`);
                }
              } catch {
              }
            }
            if (hasRootIndex) {
              console.log(`[Preview] Static HTML project detected for ${name}, bootstrapping with vite`);
              const minPkg = { name, private: true, devDependencies: { vite: "^5" } };
              fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify(minPkg, null, 2));
              try {
                const { execSync: es } = await import("child_process");
                es("npm install", { cwd: projectDir, timeout: 6e4, stdio: "pipe", shell: true, windowsHide: true });
              } catch (e) {
                console.log(`[Preview] Static HTML bootstrap install warning: ${e.message?.slice(0, 200)}`);
              }
              pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"));
            }
          }
          const EXECUTABLE_EXTS = [".exe", ".msi", ".appimage", ".app", ".dmg", ".deb", ".rpm", ".snap", ".flatpak"];
          const findExecutables = (dir, depth = 0) => {
            if (depth > 2) return [];
            const results = [];
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
                  if (depth === 0 || sub.some((s) => entry.name.toLowerCase() === s.toLowerCase())) {
                    results.push(...findExecutables(fullPath, depth + 1));
                  }
                }
              }
            } catch {
            }
            return results;
          };
          const os = await import("os");
          const isWin = os.platform() === "win32";
          const isMac = os.platform() === "darwin";
          const isLinux = os.platform() === "linux";
          const releasesCleanupDir = path.join(projectDir, "_releases");
          if (fs.existsSync(releasesCleanupDir)) {
            const sysArch = os.arch();
            const wrongArchPatterns = sysArch === "arm64" ? ["-x64-", "-x86_64-", "-amd64-", "-win64-", ".x64.", ".x86_64.", ".amd64."] : ["-arm64-", "-aarch64-", ".arm64.", ".aarch64."];
            try {
              const releaseFiles = fs.readdirSync(releasesCleanupDir);
              for (const rf of releaseFiles) {
                const rfLower = rf.toLowerCase();
                if (wrongArchPatterns.some((p) => rfLower.includes(p))) {
                  const rfPath = path.join(releasesCleanupDir, rf);
                  try {
                    const stat = fs.statSync(rfPath);
                    if (stat.isDirectory()) {
                      fs.rmSync(rfPath, { recursive: true, force: true });
                    } else {
                      fs.unlinkSync(rfPath);
                    }
                    console.log(`[Preview] Deleted wrong-arch file: ${rf} (system: ${sysArch})`);
                  } catch (delErr) {
                    console.log(`[Preview] Could not delete wrong-arch file ${rf}: ${delErr.message?.slice(0, 100)}`);
                  }
                }
              }
            } catch {
            }
          }
          const normPath = (p) => isWin ? path.normalize(p).replace(/\//g, "\\") : p;
          const spawnTerminalWithCommand = (cwd, cmd, label) => {
            const safeCwd = normPath(path.resolve(cwd));
            try {
              if (isWin) {
                const batchPath = path.join(safeCwd, "__lamby_run.bat");
                const batchContent = `@echo off\r
title ${label.replace(/[&|<>^%"]/g, "")}\r
cd /d "${safeCwd}"\r
echo.\r
echo [Lamby] Running: ${cmd.replace(/[&|<>^%]/g, " ")}\r
echo.\r
${cmd}\r
echo.\r
echo [Lamby] Command finished. Press any key to close.\r
pause >nul\r
`;
                fs.writeFileSync(batchPath, batchContent);
                try {
                  execSync(`start "" "${batchPath}"`, { cwd: safeCwd, shell: true, windowsHide: false, stdio: "ignore", timeout: 5e3 });
                } catch {
                  try {
                    spawn("cmd.exe", ["/c", batchPath], { cwd: safeCwd, detached: true, stdio: "ignore", windowsHide: false });
                  } catch {
                    spawn("cmd.exe", ["/c", "start", '""', "cmd.exe", "/k", `cd /d "${safeCwd}" && ${cmd}`], {
                      cwd: safeCwd,
                      detached: true,
                      stdio: "ignore",
                      windowsHide: false
                    });
                  }
                }
              } else if (isMac) {
                const escaped = cmd.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/'/g, "'\\''");
                const script = `tell application "Terminal" to do script "cd '${safeCwd}' && ${escaped}"`;
                spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" });
              } else {
                const child2 = spawn("bash", ["-c", cmd], { cwd: safeCwd, detached: true, stdio: "ignore" });
                child2.on("error", () => {
                });
                child2.unref();
              }
              console.log(`[Preview] Spawned terminal for ${label} in ${safeCwd}: ${cmd}`);
              return true;
            } catch (e) {
              console.error(`[Preview] Failed to spawn terminal for ${label}:`, e.message?.slice(0, 200));
              return false;
            }
          };
          const launchExecutable = (exePath, label) => {
            const safeExe = normPath(path.resolve(exePath));
            const exeDir = normPath(path.dirname(safeExe));
            const ext = path.extname(safeExe).toLowerCase();
            console.log(`[Preview] Attempting to launch: ${safeExe} (ext: ${ext}, cwd: ${exeDir})`);
            try {
              if (isWin) {
                if (ext === ".msi") {
                  const batPath = path.join(exeDir, "__lamby_launch.bat");
                  fs.writeFileSync(batPath, `@echo off\r
cd /d "${exeDir}"\r
msiexec /i "${safeExe}"\r
`);
                  const child2 = spawn("cmd.exe", ["/c", batPath], { cwd: exeDir, detached: true, stdio: "ignore", windowsHide: false });
                  child2.unref();
                  console.log(`[Preview] Launched MSI installer via msiexec`);
                } else {
                  const batPath = path.join(exeDir, "__lamby_launch.bat");
                  fs.writeFileSync(batPath, `@echo off\r
cd /d "${exeDir}"\r
echo [Lamby] Launching ${path.basename(safeExe)}...\r
"${safeExe}"\r
`);
                  console.log(`[Preview] Wrote launch batch file: ${batPath}`);
                  let launched2 = false;
                  try {
                    const child2 = spawn("cmd.exe", ["/c", "start", '""', batPath], { cwd: exeDir, detached: true, stdio: "ignore", windowsHide: false, shell: true });
                    child2.unref();
                    launched2 = true;
                    console.log(`[Preview] Method 1 (start bat): spawned`);
                  } catch (e1) {
                    console.log(`[Preview] Method 1 failed: ${e1.message?.slice(0, 100)}`);
                  }
                  if (!launched2) {
                    try {
                      const child2 = spawn(safeExe, [], { cwd: exeDir, detached: true, stdio: "ignore" });
                      child2.unref();
                      launched2 = true;
                      console.log(`[Preview] Method 2 (direct spawn): spawned`);
                    } catch (e2) {
                      console.log(`[Preview] Method 2 failed: ${e2.message?.slice(0, 100)}`);
                    }
                  }
                  if (!launched2) {
                    try {
                      const child2 = spawn("cmd.exe", ["/c", batPath], { cwd: exeDir, detached: true, stdio: "ignore", windowsHide: false });
                      child2.unref();
                      launched2 = true;
                      console.log(`[Preview] Method 3 (cmd /c bat): spawned`);
                    } catch (e3) {
                      console.log(`[Preview] Method 3 failed: ${e3.message?.slice(0, 100)}`);
                    }
                  }
                  if (!launched2) {
                    console.error(`[Preview] All launch methods failed for ${safeExe}`);
                    return false;
                  }
                }
              } else if (isMac) {
                const child2 = spawn("open", [safeExe], { detached: true, stdio: "ignore" });
                child2.unref();
              } else {
                try {
                  fs.chmodSync(safeExe, 493);
                } catch {
                }
                const child2 = spawn(safeExe, [], { cwd: exeDir, detached: true, stdio: "ignore" });
                child2.unref();
              }
              console.log(`[Preview] Launched executable for ${label}: ${safeExe}`);
              return true;
            } catch (e) {
              console.error(`[Preview] Failed to launch executable for ${label}:`, e.message?.slice(0, 200));
              return false;
            }
          };
          const executables = findExecutables(projectDir);
          if (executables.length > 0 && !hasPkg) {
            const INSTALLER_HINTS = ["installer", "setup", "install", "uninstall", "-web-", "update"];
            const archHints = os.arch() === "arm64" ? ["arm64", "aarch64"] : ["x64", "x86_64", "amd64", "win64"];
            const wrongArchHints = os.arch() === "arm64" ? ["x64", "x86_64", "amd64", "win64"] : ["arm64", "aarch64"];
            const scored = executables.map((e) => {
              let score = 0;
              const lname = e.name.toLowerCase();
              if (wrongArchHints.some((h) => lname.includes(h))) score -= 1e3;
              if (INSTALLER_HINTS.some((h) => lname.includes(h))) score -= 100;
              if (e.ext === ".msi") score -= 50;
              if (archHints.some((h) => lname.includes(h))) score += 10;
              if (e.ext === ".exe") score += 5;
              else if (e.ext === ".appimage") score += 4;
              else if (e.ext === ".app") score += 3;
              if (lname.includes("portable")) score += 15;
              return { ...e, score };
            }).sort((a, b) => b.score - a.score);
            const compatible = scored.filter((e) => e.score > -1e3);
            if (compatible.length === 0 && scored.length > 0) {
              console.log(`[Preview] All ${scored.length} executables are wrong architecture \u2014 deleting and re-downloading`);
              try {
                fs.rmSync(path.join(projectDir, "_releases"), { recursive: true, force: true });
              } catch {
              }
            }
            const best = compatible.length > 0 ? compatible[0] : null;
            if (best) {
              const bestLower = best.name.toLowerCase();
              const isInstaller = INSTALLER_HINTS.some((h) => bestLower.includes(h)) || best.ext === ".msi";
              const launched2 = launchExecutable(best.fullPath, name);
              const allExeNames = scored.map((e) => `${e.name} (score:${e.score})`).slice(0, 10).join(", ");
              console.log(`[Preview] Precompiled binaries found for ${name}: ${allExeNames}`);
              console.log(`[Preview] Selected: ${best.name} (installer: ${isInstaller})`);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                started: false,
                projectType: isInstaller ? "installer" : "precompiled",
                openTerminal: true,
                launched: launched2,
                isInstaller,
                runCommand: `"${best.fullPath}"`,
                projectDir,
                executables: scored.map((e) => ({ name: e.name, path: e.fullPath, ext: e.ext, score: e.score })).slice(0, 20),
                message: launched2 ? isInstaller ? `Launching installer: ${best.name} \u2014 follow the setup wizard to install` : `Launched ${best.name}` : `Found: ${best.name} \u2014 could not auto-launch`
              }));
              return;
            }
            console.log(`[Preview] No compatible executables found for ${name} (${scored.length} wrong-arch skipped) \u2014 falling through to build/download`);
          }
          const WEB_FRAMEWORKS = ["react", "react-dom", "vue", "svelte", "@sveltejs/kit", "next", "nuxt", "@angular/core", "preact", "solid-js", "astro", "gatsby", "remix", "@remix-run/react", "lit", "ember-source", "qwik", "@builder.io/qwik", "vite", "webpack-dev-server", "parcel", "@rspack/core", "react-scripts"];
          const ptSubDirs = ["frontend", "client", "web", "app"];
          const hasIndexHtml = (() => {
            const dirs = [projectDir, effectiveProjectDir, path.join(projectDir, "public"), path.join(projectDir, "src"), ...ptSubDirs.flatMap((d) => [path.join(projectDir, d), path.join(projectDir, d, "public"), path.join(projectDir, d, "src")])];
            return dirs.some((d) => {
              try {
                return fs.existsSync(path.join(d, "index.html"));
              } catch {
                return false;
              }
            });
          })();
          const hasWebConfig = (() => {
            const dirs = [projectDir, effectiveProjectDir, ...ptSubDirs.map((d) => path.join(projectDir, d))];
            const configFiles = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs", "next.config.js", "next.config.mjs", "next.config.ts", "nuxt.config.ts", "nuxt.config.js", "svelte.config.js", "svelte.config.ts", "astro.config.mjs", "astro.config.ts", "webpack.config.js", "webpack.config.ts", "rspack.config.js", "rspack.config.ts", "angular.json"];
            return dirs.some((d) => {
              try {
                return configFiles.some((f) => fs.existsSync(path.join(d, f)));
              } catch {
                return false;
              }
            });
          })();
          const hasSubdirWebDeps = (() => {
            for (const sub of ptSubDirs) {
              const subPkgPath = path.join(projectDir, sub, "package.json");
              if (fs.existsSync(subPkgPath)) {
                try {
                  const subPkg = JSON.parse(fs.readFileSync(subPkgPath, "utf-8"));
                  const subDeps = { ...subPkg.dependencies || {}, ...subPkg.devDependencies || {} };
                  if (WEB_FRAMEWORKS.some((fw) => fw in subDeps)) return true;
                } catch {
                }
              }
            }
            return false;
          })();
          const allDeps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
          const hasWebFramework = WEB_FRAMEWORKS.some((fw) => fw in allDeps) || hasWebConfig || hasSubdirWebDeps;
          const isCLI = !!pkg.bin;
          const scripts = pkg.scripts || {};
          const hasOnlyBackend = !hasWebFramework && !hasIndexHtml && (allDeps["express"] || allDeps["fastify"] || allDeps["koa"] || allDeps["hapi"] || allDeps["@hapi/hapi"] || allDeps["nest"] || allDeps["@nestjs/core"]);
          const isPythonProject = !hasPkg && (fs.existsSync(path.join(projectDir, "requirements.txt")) || fs.existsSync(path.join(projectDir, "setup.py")) || fs.existsSync(path.join(projectDir, "pyproject.toml")));
          const isGoProject = !hasPkg && (fs.existsSync(path.join(projectDir, "go.mod")) || fs.existsSync(path.join(projectDir, "main.go")));
          const isRustProject = !hasPkg && fs.existsSync(path.join(projectDir, "Cargo.toml"));
          const isCppProject = !hasPkg && (fs.existsSync(path.join(projectDir, "CMakeLists.txt")) || (() => {
            try {
              return fs.readdirSync(projectDir).some((f) => /\.(sln|vcxproj)$/i.test(f));
            } catch {
              return false;
            }
          })() || fs.existsSync(path.join(projectDir, "meson.build")) || (() => {
            try {
              return fs.readdirSync(projectDir).some((f) => /^Makefile$/i.test(f));
            } catch {
              return false;
            }
          })());
          const hasStartScript = scripts.dev || scripts.start || scripts.serve;
          const isNonWebProject = !hasIndexHtml && !hasWebFramework && (isCLI || isPythonProject || isGoProject || isRustProject || isCppProject || !hasStartScript && !hasOnlyBackend);
          if (isNonWebProject) {
            let projectType = isPythonProject ? "python" : isGoProject ? "go" : isRustProject ? "rust" : isCppProject ? "cpp" : isCLI ? "cli" : "terminal";
            let runCmd = "";
            let buildCmd = "";
            let projectMeta = {};
            const metaPath = path.join(projectDir, ".lamby-meta.json");
            try {
              if (fs.existsSync(metaPath)) projectMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
            } catch {
            }
            const repoName = projectMeta.repo || name;
            if (isPythonProject) {
              const mainPy = fs.existsSync(path.join(projectDir, "main.py")) ? "main.py" : fs.existsSync(path.join(projectDir, "app.py")) ? "app.py" : fs.readdirSync(projectDir).find((f) => f.endsWith(".py")) || "main.py";
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
              } catch {
              }
              runCmd = isWin ? `target\\release\\${rustBin}.exe` : `./target/release/${rustBin}`;
            } else if (isCppProject) {
              if (fs.existsSync(path.join(projectDir, "CMakeLists.txt"))) {
                buildCmd = isWin ? `if not exist build mkdir build && cd build && cmake .. && cmake --build . --config Release --parallel` : `mkdir -p build && cd build && cmake .. && cmake --build . --parallel`;
                projectType = "cmake";
              } else if ((() => {
                try {
                  return fs.readdirSync(projectDir).some((f) => f.endsWith(".sln"));
                } catch {
                  return false;
                }
              })()) {
                const slnFile = fs.readdirSync(projectDir).find((f) => f.endsWith(".sln"));
                buildCmd = isWin ? `msbuild "${slnFile}" /p:Configuration=Release /m` : `echo "Visual Studio .sln requires Windows with MSBuild"`;
                projectType = "msbuild";
              } else if (fs.existsSync(path.join(projectDir, "meson.build"))) {
                buildCmd = isWin ? `if not exist builddir meson setup builddir && meson compile -C builddir` : `meson setup builddir 2>/dev/null || true && meson compile -C builddir`;
                projectType = "meson";
              } else {
                const makefile = (() => {
                  try {
                    return fs.readdirSync(projectDir).find((f) => /^Makefile$/i.test(f));
                  } catch {
                    return null;
                  }
                })();
                if (makefile) {
                  buildCmd = "make";
                  projectType = "make";
                }
              }
            } else if (isCLI && pkg.bin) {
              const binName = typeof pkg.bin === "string" ? pkg.name : Object.keys(pkg.bin)[0];
              runCmd = `node ${typeof pkg.bin === "string" ? pkg.bin : pkg.bin[binName]}`;
            } else if (pkg.main) {
              runCmd = `node ${pkg.main}`;
            } else if (scripts.start) {
              runCmd = `npm run start`;
            }
            if (!runCmd && !buildCmd) {
              try {
                const files = fs.readdirSync(projectDir);
                const jsEntry = files.find((f) => /^(index|main|app|server|cli)\.(js|ts|mjs|cjs)$/.test(f));
                if (jsEntry) {
                  runCmd = `node ${jsEntry}`;
                  projectType = "node";
                } else {
                  const pyFile = files.find((f) => f.endsWith(".py"));
                  if (pyFile) {
                    runCmd = isWin ? `python ${pyFile}` : `python3 ${pyFile}`;
                    projectType = "python";
                  } else {
                    const shFile = files.find((f) => f.endsWith(".sh"));
                    if (shFile) {
                      runCmd = `bash ${shFile}`;
                      projectType = "shell";
                    } else {
                      if (fs.existsSync(path.join(projectDir, "Dockerfile"))) {
                        buildCmd = "docker build -t " + repoName + " .";
                        runCmd = "docker run " + repoName;
                        projectType = "docker";
                      }
                    }
                  }
                }
              } catch {
              }
            }
            const findExeInDir = (dir, depth = 0) => {
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
              } catch {
              }
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
                  timeout: 3e5,
                  stdio: "pipe",
                  shell: true,
                  windowsHide: true,
                  env: { ...process.env, MAKEFLAGS: `-j${os.cpus().length || 2}` }
                });
                buildOutput = result.toString().slice(-2e3);
                buildSuccess = true;
                console.log(`[Preview] Build succeeded for ${name}`);
                if (!runCmd) {
                  try {
                    const builtExes = findExecutables(projectDir);
                    if (builtExes.length > 0) {
                      const best = builtExes.find((e) => e.ext === ".exe") || builtExes[0];
                      runCmd = isWin ? `"${normPath(best.fullPath)}"` : `"${best.fullPath}"`;
                    }
                  } catch {
                  }
                  const BUILD_DIRS = ["build", "builddir", "build/Release", "build/Debug", "Release", "Debug", "out", "bin"];
                  if (!runCmd) {
                    for (const bd of BUILD_DIRS) {
                      const bdPath = path.join(projectDir, bd);
                      if (!fs.existsSync(bdPath)) continue;
                      try {
                        const buildFiles = fs.readdirSync(bdPath);
                        const builtBin = buildFiles.find((f) => {
                          const fp = path.join(bdPath, f);
                          try {
                            const stat = fs.statSync(fp);
                            if (!stat.isFile()) return false;
                            if (isWin) return f.endsWith(".exe");
                            return (stat.mode & 73) !== 0;
                          } catch {
                            return false;
                          }
                        });
                        if (builtBin) {
                          const builtPath = path.join(bdPath, builtBin);
                          runCmd = isWin ? `"${normPath(builtPath)}"` : `"${builtPath}"`;
                          break;
                        }
                      } catch {
                      }
                    }
                  }
                  if (!runCmd && (projectType === "make" || projectType === "cmake")) {
                    try {
                      const rootFiles = fs.readdirSync(projectDir);
                      const builtBin = rootFiles.find((f) => {
                        if (/\.(c|cpp|h|hpp|o|obj|txt|md|json|cmake|sln|vcxproj)$/i.test(f) || /^(Makefile|CMakeLists|README|LICENSE|BUILD|WORKSPACE)$/i.test(f)) return false;
                        const fp = path.join(projectDir, f);
                        try {
                          const stat = fs.statSync(fp);
                          if (!stat.isFile()) return false;
                          if (isWin) return f.endsWith(".exe");
                          return (stat.mode & 73) !== 0;
                        } catch {
                          return false;
                        }
                      });
                      if (builtBin) runCmd = isWin ? `"${normPath(path.join(projectDir, builtBin))}"` : `./${builtBin}`;
                    } catch {
                    }
                  }
                }
              } catch (buildErr) {
                buildOutput = (buildErr.stderr?.toString() || buildErr.message || "").slice(-2e3);
                console.error(`[Preview] Build failed for ${name}: ${buildOutput.slice(0, 300)}`);
              }
            }
            const releasesDir = path.join(projectDir, "_releases");
            let releaseExe = "";
            if (fs.existsSync(releasesDir)) {
              releaseExe = findExeInDir(releasesDir);
            }
            if (!buildSuccess && !runCmd && !releaseExe && projectMeta.owner && projectMeta.repo) {
              console.log(`[Preview] Build failed or no build system \u2014 trying GitHub Releases for ${projectMeta.owner}/${projectMeta.repo}...`);
              try {
                const ghToken = process.env.GITHUB_TOKEN || "";
                const relHeaders = { "Accept": "application/vnd.github.v3+json", "User-Agent": "Lamby" };
                if (ghToken) relHeaders["Authorization"] = `token ${ghToken}`;
                const relResp = await fetch(`https://api.github.com/repos/${projectMeta.owner}/${projectMeta.repo}/releases/latest`, { headers: relHeaders });
                if (relResp.ok) {
                  const relData = await relResp.json();
                  const BINARY_EXTS = [".exe", ".msi", ".appimage", ".dmg", ".deb", ".rpm", ".zip", ".tar.gz", ".7z"];
                  const osPlatform = os.platform();
                  const osArch = os.arch();
                  const platformHints = osPlatform === "win32" ? ["win", "windows"] : osPlatform === "darwin" ? ["mac", "macos", "darwin"] : ["linux"];
                  const goodArchHints = osArch === "arm64" ? ["arm64", "aarch64"] : ["x64", "x86_64", "amd64", "win64"];
                  const badArchHints = osArch === "arm64" ? ["x64", "x86_64", "amd64", "win64"] : ["arm64", "aarch64"];
                  const INSTALLER_KW = ["installer", "setup", "install"];
                  const assets = (relData.assets || []).filter((a) => BINARY_EXTS.some((ext) => a.name.toLowerCase().endsWith(ext))).map((a) => {
                    const ln = a.name.toLowerCase();
                    let score = 0;
                    if (platformHints.some((h) => ln.includes(h))) score += 20;
                    if (goodArchHints.some((h) => ln.includes(h))) score += 10;
                    if (badArchHints.some((h) => ln.includes(h))) score -= 15;
                    if (ln.includes("portable")) score += 25;
                    if (INSTALLER_KW.some((h) => ln.includes(h))) score -= 5;
                    if (ln.endsWith(".zip")) score += 3;
                    return { ...a, _score: score };
                  }).sort((a, b) => b._score - a._score);
                  if (assets.length > 0) {
                    const relDir = path.join(projectDir, "_releases");
                    fs.mkdirSync(relDir, { recursive: true });
                    const MAX_DL = 500 * 1024 * 1024;
                    const toDl = assets.filter((a) => a.size < MAX_DL).slice(0, 3);
                    for (const asset of toDl) {
                      try {
                        console.log(`[Preview] Downloading release: ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)}MB)...`);
                        const dlResp = await fetch(asset.browser_download_url, { redirect: "follow" });
                        if (dlResp.ok) {
                          const buf = Buffer.from(await dlResp.arrayBuffer());
                          const assetPath = path.join(relDir, asset.name);
                          fs.writeFileSync(assetPath, buf);
                          if (asset.name.toLowerCase().endsWith(".exe") || asset.name.toLowerCase().endsWith(".appimage")) {
                            try {
                              fs.chmodSync(assetPath, 493);
                            } catch {
                            }
                          }
                          if (asset.name.toLowerCase().endsWith(".zip")) {
                            try {
                              const extractDir = path.join(relDir, asset.name.replace(/\.zip$/i, ""));
                              fs.mkdirSync(extractDir, { recursive: true });
                              if (isWin) {
                                execSync(`tar xf "${normPath(assetPath)}" -C "${normPath(extractDir)}"`, { timeout: 6e4, stdio: "pipe", windowsHide: true, shell: true });
                              } else {
                                execSync(`unzip -o -q "${assetPath}" -d "${extractDir}"`, { timeout: 6e4, stdio: "pipe" });
                              }
                            } catch (unzErr) {
                              console.log(`[Preview] Could not extract ${asset.name}: ${unzErr.message?.slice(0, 100)}`);
                            }
                          }
                          console.log(`[Preview] Downloaded release asset: ${asset.name}`);
                        }
                      } catch (dlErr) {
                        console.log(`[Preview] Download failed for ${asset.name}: ${dlErr.message?.slice(0, 100)}`);
                      }
                    }
                    releaseExe = findExeInDir(relDir);
                  }
                }
              } catch (relErr) {
                console.log(`[Preview] GitHub Releases check failed: ${relErr.message?.slice(0, 100)}`);
              }
            }
            if (releaseExe && (!buildSuccess || !runCmd)) {
              console.log(`[Preview] Using release executable: ${releaseExe}`);
              const launched3 = launchExecutable(releaseExe, name);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                started: false,
                projectType: "precompiled",
                openTerminal: true,
                launched: launched3,
                runCommand: `"${releaseExe}"`,
                projectDir,
                ...buildCmd ? { buildCommand: buildCmd, buildSuccess, buildOutput: buildOutput.slice(0, 1e3) } : {},
                message: launched3 ? `Launched ${path.basename(releaseExe)}${buildCmd && !buildSuccess ? " (build failed \u2014 using precompiled release)" : ""}` : `Found release: ${path.basename(releaseExe)}`
              }));
              return;
            }
            let fullCmd = buildCmd && runCmd && buildSuccess ? runCmd : buildCmd && !buildSuccess ? buildCmd : runCmd || buildCmd;
            if (!fullCmd && !launched) {
              console.log(`[AutoFix] No entry point found for ${name} \u2014 attempting full install + re-detect...`);
              try {
                const autoFixPm = detectPackageManager();
                const installCmd2 = autoFixPm === "bun" ? "npx bun install" : autoFixPm === "pnpm" ? "npx pnpm install --no-frozen-lockfile" : autoFixPm === "yarn" ? "npx yarn install --ignore-engines" : "npm install --legacy-peer-deps";
                execSync(installCmd2, { cwd: effectiveProjectDir, timeout: 18e4, stdio: "pipe", shell: true, windowsHide: true, env: { ...process.env, HUSKY: "0", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" } });
                console.log(`[AutoFix] Full install completed \u2014 re-detecting dev command for ${name}`);
                try {
                  const newPkg = JSON.parse(fs.readFileSync(path.join(effectiveProjectDir, "package.json"), "utf-8"));
                  pkg = newPkg;
                } catch {
                }
                const reDetected = detectDevCommand();
                if (reDetected.cmd && reDetected.args.length > 0) {
                  fullCmd = `${reDetected.cmd} ${reDetected.args.join(" ")}`;
                  console.log(`[AutoFix] Re-detected dev command after install: ${fullCmd}`);
                  viteErrorHistory.push({
                    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    timestamp: Date.now(),
                    source: "startup-recovery",
                    message: "No runnable entry point \u2014 fixed by full install",
                    classified: { category: "no-entry-point", strategy: "full-install-retry", confidence: 0.9, detail: "Auto-recovered" },
                    recovery: { attempted: true, success: true, detail: `Installed deps, found: ${fullCmd}` }
                  });
                }
              } catch (e) {
                console.log(`[AutoFix] Full install failed for ${name}: ${e.message?.slice(0, 200)}`);
              }
            }
            if (!fullCmd && buildCmd && !buildSuccess) {
              console.log(`[AutoFix] Build failed for ${name} \u2014 clearing artifacts and retrying...`);
              clearViteFrameworkCaches(projectDir);
              const artifactDirs = projectType === "rust" ? ["target"] : projectType === "go" ? ["bin"] : projectType === "cpp" ? ["build", "cmake-build-debug"] : [];
              for (const ad of artifactDirs) {
                const adp = path.join(projectDir, ad);
                if (fs.existsSync(adp)) {
                  try {
                    fs.rmSync(adp, { recursive: true, force: true });
                  } catch {
                  }
                }
              }
              try {
                execSync(buildCmd, { cwd: projectDir, timeout: 12e4, stdio: "pipe", shell: true, windowsHide: true });
                buildSuccess = true;
                fullCmd = runCmd || buildCmd;
                console.log(`[AutoFix] Build retry succeeded for ${name}`);
              } catch {
              }
            }
            console.log(`[Preview] Non-web project ${name} (${projectType}) \u2014 cmd: ${fullCmd || "none"}${buildCmd ? `, build: ${buildSuccess ? "ok" : "failed"}` : ""}`);
            const launched2 = fullCmd && !launched ? spawnTerminalWithCommand(projectDir, fullCmd, name) : launched;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              started: false,
              projectType,
              openTerminal: true,
              launched: launched2,
              runCommand: fullCmd,
              projectDir,
              ...buildCmd ? { buildCommand: buildCmd, buildSuccess, buildOutput: buildOutput.slice(0, 1e3) } : {},
              message: buildSuccess && runCmd ? `Build complete \u2014 running: ${runCmd}` : buildSuccess ? `Build complete${runCmd ? ` \u2014 running: ${runCmd}` : ""}` : buildCmd && !buildSuccess ? `Build failed \u2014 check build output for errors` : launched2 ? `Running: ${fullCmd}` : fullCmd ? `${projectType} project \u2014 run: ${fullCmd}` : `No runnable entry point found. Tried: full install + re-detect. Check project structure.`
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
                } catch {
                }
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
                    const allDeps2 = { ...pkg.dependencies || {}, ...pkg.devDependencies || {}, ...pkg.peerDependencies || {} };
                    const hasReact = !!allDeps2["react"];
                    const hasVue = !!allDeps2["vue"];
                    const hasSvelte = !!allDeps2["svelte"];
                    const hasReactPlugin = content.includes("plugin-react");
                    const hasVuePlugin = content.includes("plugin-vue");
                    if (hasReact && !hasReactPlugin) {
                      const pluginPkg = "@vitejs/plugin-react";
                      try {
                        const { execSync: es } = await import("child_process");
                        const missingLibPkgs = [];
                        if (!fs.existsSync(path.join(vcDir, "node_modules", "@vitejs/plugin-react")) && !fs.existsSync(path.join(effectiveProjectDir, "node_modules", "@vitejs/plugin-react"))) missingLibPkgs.push(pluginPkg);
                        if (!fs.existsSync(path.join(vcDir, "node_modules", "react-dom")) && !fs.existsSync(path.join(effectiveProjectDir, "node_modules", "react-dom"))) missingLibPkgs.push("react-dom");
                        if (!fs.existsSync(path.join(vcDir, "node_modules", "react")) && !fs.existsSync(path.join(effectiveProjectDir, "node_modules", "react"))) missingLibPkgs.push("react");
                        if (missingLibPkgs.length > 0) {
                          console.log(`[Preview] Library-mode config for ${name}, installing: ${missingLibPkgs.join(", ")}`);
                          const installCmd = pm === "pnpm" ? `pnpm add -D ${missingLibPkgs.join(" ")}` : pm === "yarn" ? `yarn add -D ${missingLibPkgs.join(" ")}` : pm === "bun" ? `bun add -D ${missingLibPkgs.join(" ")}` : `npm install --save-dev --legacy-peer-deps ${missingLibPkgs.join(" ")}`;
                          es(installCmd, { cwd: effectiveProjectDir, timeout: 6e4, stdio: "pipe", shell: true, windowsHide: true });
                        }
                      } catch (e) {
                        console.log(`[Preview] Failed to install lib-mode deps: ${e.message?.slice(0, 150)}`);
                      }
                      content = `import { defineConfig } from 'vite'
import react from '${pluginPkg}'

export default defineConfig({
  plugins: [react()],
})
`;
                      changed = true;
                      console.log(`[Preview] Rewrote library-mode ${vcName} to dev-mode with React plugin for ${name}`);
                    } else if (hasVue && !hasVuePlugin) {
                      content = `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})
`;
                      changed = true;
                      console.log(`[Preview] Rewrote library-mode ${vcName} to dev-mode with Vue plugin for ${name}`);
                    } else if (!hasReact && !hasVue && !hasSvelte) {
                      content = `import { defineConfig } from 'vite'

export default defineConfig({})
`;
                      changed = true;
                      console.log(`[Preview] Rewrote library-mode ${vcName} to dev-mode for ${name}`);
                    }
                  }
                  if (!changed && /configureServer\s*\(/.test(content)) {
                    const usesSwc = content.includes("plugin-react-swc");
                    const reactImport = usesSwc ? "react from '@vitejs/plugin-react-swc'" : "react from '@vitejs/plugin-react'";
                    const aliasMatch = content.match(/["']@["']\s*:\s*path\.resolve\([^)]+\)/);
                    const aliasBlock = aliasMatch ? `
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },` : "";
                    const mainPort = 5e3;
                    content = `import { defineConfig } from "vite";
import ${reactImport};
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: ${port},
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:${mainPort}",
        changeOrigin: true,
        secure: false,
      },
    },
  },${aliasBlock}
});
`;
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
                } catch {
                }
              }
            }
          };
          await patchViteConfig();
          const ensureESMCompat = (dir) => {
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
                    } catch {
                    }
                  }
                  break;
                }
              }
            } catch {
            }
          };
          ensureESMCompat(effectiveProjectDir);
          if (effectiveProjectDir !== projectDir) ensureESMCompat(projectDir);
          const fixPostCSSAndTailwind = async () => {
            const isESM = pkg.type === "module";
            const dirsToCheck = [effectiveProjectDir];
            if (effectiveProjectDir !== projectDir) dirsToCheck.push(projectDir);
            const postcssConfigs2 = ["postcss.config.js", "postcss.config.mjs", "postcss.config.cjs"];
            for (const baseDir of dirsToCheck) {
              for (const pcName of postcssConfigs2) {
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
                  const allDeps2 = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
                  const missingPkgs = [];
                  if (refsTailwind && !allDeps2["tailwindcss"]) missingPkgs.push("tailwindcss");
                  if (refsAutoprefixer && !allDeps2["autoprefixer"]) missingPkgs.push("autoprefixer");
                  if (missingPkgs.length > 0) {
                    try {
                      const { execSync: es } = await import("child_process");
                      const installCmd = pm === "npm" ? `npm install --save-dev --legacy-peer-deps ${missingPkgs.join(" ")}` : `npx ${pm} add -D ${missingPkgs.join(" ")}`;
                      console.log(`[Preview] Installing missing PostCSS deps: ${missingPkgs.join(", ")}`);
                      es(installCmd, { cwd: effectiveProjectDir, timeout: 6e4, stdio: "pipe", shell: true, windowsHide: true });
                    } catch (e) {
                      console.log(`[Preview] PostCSS dep install warning: ${e.message?.slice(0, 200)}`);
                    }
                  }
                } catch {
                }
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
                } catch {
                }
              }
            }
          };
          await fixPostCSSAndTailwind();
          let devCmd = detectDevCommand();
          console.log(`[Preview] Starting ${name} with: ${devCmd.cmd} ${devCmd.args.join(" ")}`);
          const isPnpmMonorepo = fs.existsSync(path.join(projectDir, "pnpm-workspace.yaml"));
          if (isPnpmMonorepo) {
            const scripts2 = pkg.scripts || {};
            const buildScript = scripts2["packages:build"] || scripts2.build;
            if (buildScript && (buildScript.includes("--filter") || buildScript.includes("packages"))) {
              const buildKey = scripts2["packages:build"] ? "packages:build" : "build";
              console.log(`[Preview] Pre-building pnpm monorepo packages with: pnpm run ${buildKey}`);
              try {
                const { execSync: execSyncBuild } = await import("child_process");
                execSyncBuild(`pnpm run ${buildKey}`, { cwd: projectDir, stdio: "pipe", timeout: 9e4, windowsHide: true });
                console.log(`[Preview] Monorepo packages built successfully`);
              } catch (e) {
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
        var diag = '[Lamby] Blank screen detected \u2014 root element exists but has no rendered content after 5s.';
        if (moduleErrors.length > 0) diag += ' Failed scripts: ' + moduleErrors.join(', ');
        var viteErrors = document.querySelectorAll('vite-error-overlay');
        if (viteErrors.length > 0) diag += ' Vite error overlay is showing.';
        send('warn', [diag]);
      }
      if (!root) {
        var body = document.body;
        var visibleText = body ? body.innerText.trim() : '';
        if (visibleText.length === 0) {
          send('warn', ['[Lamby] Blank screen detected \u2014 no visible content on page after 5s. Check that index.html has the correct root element and entry script.']);
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
            ...SUBDIR_CANDIDATES.map((d) => path.join(projectDir, d, "index.html")),
            ...SUBDIR_CANDIDATES.map((d) => path.join(projectDir, d, "public", "index.html")),
            ...SUBDIR_CANDIDATES.map((d) => path.join(projectDir, d, "src", "index.html"))
          ];
          const previewPathFixScript = `<script data-lamby-preview-path>if(window.location.pathname.match(/^\\/__preview\\/\\d+/)){window.history.replaceState(null,'',window.location.pathname.replace(/^\\/__preview\\/\\d+\\/?/,'/')+window.location.search+window.location.hash)}</script>`;
          for (const indexHtmlPath of indexHtmlPaths) {
            if (fs.existsSync(indexHtmlPath)) {
              let indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
              let injected = false;
              if (!indexHtml.includes("lamby-console-bridge")) {
                indexHtml = indexHtml.replace(/<head([^>]*)>/, `<head$1>
${consoleBridgeScript}`);
                injected = true;
              }
              if (!indexHtml.includes("lamby-preview-path")) {
                indexHtml = indexHtml.replace(/<head([^>]*)>/, `<head$1>
${previewPathFixScript}`);
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
                      fs.writeFileSync(entryFile, `import { createRoot } from "react-dom/client";

function App() {
  return (
    <div style={{ fontFamily: "system-ui", padding: 32, textAlign: "center" }}>
      <h1>Project Ready</h1>
      <p>Edit <code>${scriptMatch[1]}</code> to get started.</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
`);
                    } else {
                      fs.writeFileSync(entryFile, `document.getElementById("root")!.innerHTML = "<h1>Project Ready</h1><p>Edit <code>${scriptMatch[1]}</code> to start.</p>";
`);
                    }
                    console.log(`[Preview] Created missing entry point ${scriptMatch[1]} for ${name}`);
                  }
                }
              } catch {
              }
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
                } catch {
                }
                break;
              }
            }
          }
          const viteConfigDirs = [projectDir, ...SUBDIR_CANDIDATES.map((d) => path.join(projectDir, d))];
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
                      `server: {
    watch: {
      usePolling: true,
      interval: 500,
    },`
                    );
                  } else {
                    content = content.replace(
                      /defineConfig\(\{/,
                      `defineConfig({
  server: {
    watch: {
      usePolling: true,
      interval: 500,
    },
  },`
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
                    content = content.replace(/server\s*:\s*\{/, `server: {
    hmr: { overlay: true },`);
                  } else {
                    content = content.replace(/defineConfig\(\{/, `defineConfig({
  server: { hmr: { overlay: true } },`);
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
                        css = css.replace(/@layer\s+base\s*\{[\s\S]*?\n\}/g, (block) => {
                          return block.replace(/@apply\s+border-border\s*;/g, "border-color: var(--color-border, hsl(var(--border)));").replace(
                            /@apply\s+bg-background\s+text-foreground\s*;/g,
                            "background-color: var(--color-background, hsl(var(--background)));\n    color: var(--color-foreground, hsl(var(--foreground)));"
                          ).replace(/@apply\s+bg-background\s*;/g, "background-color: var(--color-background, hsl(var(--background)));").replace(/@apply\s+text-foreground\s*;/g, "color: var(--color-foreground, hsl(var(--foreground)));");
                        });
                        fs.writeFileSync(cssPath, css);
                        console.log(`[Preview] Patched @apply in @layer base for ${name}/${path.relative(projectDir, cssPath)}`);
                      }
                    } catch {
                    }
                  }
                }
                if (hasTsconfigPaths && !content.includes("tsconfigPaths") && !content.includes("tsconfig-paths")) {
                  const tspPkgInstalled = fs.existsSync(path.join(viteDir, "node_modules", "vite-tsconfig-paths")) || fs.existsSync(path.join(projectDir, "node_modules", "vite-tsconfig-paths"));
                  if (!tspPkgInstalled) {
                    try {
                      let installCmd = "npm install --legacy-peer-deps --save-dev vite-tsconfig-paths";
                      if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"))) installCmd = "npx pnpm add -D vite-tsconfig-paths";
                      else if (fs.existsSync(path.join(projectDir, "yarn.lock"))) installCmd = "yarn add -D vite-tsconfig-paths";
                      else if (fs.existsSync(path.join(projectDir, "bun.lockb")) || fs.existsSync(path.join(projectDir, "bun.lock"))) installCmd = "bun add -D vite-tsconfig-paths";
                      execSync(installCmd, { cwd: viteDir, timeout: 6e4, stdio: "pipe", shell: true, windowsHide: true, env: safeInstallEnv });
                      console.log(`[Preview] Installed vite-tsconfig-paths for ${name}`);
                    } catch (installErr) {
                      console.log(`[Preview] Could not install vite-tsconfig-paths for ${name}: ${installErr.message?.slice(0, 100)}`);
                    }
                  }
                  if (fs.existsSync(path.join(viteDir, "node_modules", "vite-tsconfig-paths")) || fs.existsSync(path.join(projectDir, "node_modules", "vite-tsconfig-paths"))) {
                    const importLine = `import tsconfigPaths from 'vite-tsconfig-paths'
`;
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
                  rsContent = rsContent.replace(/(devServer:\s*\{)/, `$1
    host: '0.0.0.0',`);
                  changed = true;
                } else if (rsContent.includes("host:") && !rsContent.includes("0.0.0.0")) {
                  rsContent = rsContent.replace(/host:\s*['"][^'"]*['"]/, `host: '0.0.0.0'`);
                  changed = true;
                }
                if (changed) {
                  fs.writeFileSync(rspackPath, rsContent, "utf-8");
                  console.log(`[Preview] Patched ${name}/${rspackCfg} with port ${port} and host 0.0.0.0`);
                }
              } catch {
              }
              break;
            }
          }
          const nodeVer = parseInt(process.versions.node.split(".")[0], 10);
          if (nodeVer < 22) {
            const iterMethods = "filter|map|find|some|every|reduce|forEach|flatMap|toSorted";
            const iterRe = new RegExp(`(\\b[a-zA-Z_$][a-zA-Z0-9_$]*)\\.(values|keys|entries)\\(\\)\\.(${iterMethods})\\(`, "g");
            const patchIteratorHelpers = (dir) => {
              try {
                const files = fs.readdirSync(dir);
                for (const f of files) {
                  if (!f.endsWith(".js") && !f.endsWith(".mjs") && !f.endsWith(".cjs")) continue;
                  const fp = path.join(dir, f);
                  try {
                    const src = fs.readFileSync(fp, "utf-8");
                    if (iterRe.test(src)) {
                      iterRe.lastIndex = 0;
                      const patched = src.replace(iterRe, (_match, varName, iterMethod, arrayMethod) => {
                        return `Array.from(${varName}.${iterMethod}()).${arrayMethod}(`;
                      });
                      if (patched !== src) {
                        fs.writeFileSync(fp, patched, "utf-8");
                        console.log(`[Preview] Patched Node 22+ iterator helpers in ${name}/${path.relative(projectDir, fp)}`);
                      }
                    }
                  } catch {
                  }
                }
              } catch {
              }
            };
            const vrDist = path.join(projectDir, "node_modules", "vue-router", "dist");
            if (fs.existsSync(vrDist)) patchIteratorHelpers(vrDist);
            const pnpmVR = path.join(projectDir, "node_modules", ".pnpm");
            if (fs.existsSync(pnpmVR)) {
              try {
                const pnpmDirs = fs.readdirSync(pnpmVR).filter((d) => d.startsWith("vue-router@"));
                for (const d of pnpmDirs) {
                  const dist = path.join(pnpmVR, d, "node_modules", "vue-router", "dist");
                  if (fs.existsSync(dist)) patchIteratorHelpers(dist);
                }
              } catch {
              }
            }
          }
          const pathSep = isWin ? ";" : ":";
          const binDirs = [];
          binDirs.push(path.join(effectiveProjectDir, "node_modules", ".bin"));
          if (effectiveProjectDir !== projectDir) {
            binDirs.push(path.join(projectDir, "node_modules", ".bin"));
          }
          const isolatedPath = binDirs.join(pathSep) + pathSep + (process.env.PATH || process.env.Path || "");
          const nodePaths = [path.join(effectiveProjectDir, "node_modules")];
          if (effectiveProjectDir !== projectDir) {
            nodePaths.push(path.join(projectDir, "node_modules"));
          }
          const portEnv = {
            ...process.env,
            BROWSER: "none",
            PORT: String(port),
            HOST: "0.0.0.0",
            HOSTNAME: "0.0.0.0",
            PATH: isolatedPath,
            NODE_PATH: nodePaths.join(pathSep),
            CHOKIDAR_USEPOLLING: "true"
          };
          if (isWin && portEnv.Path) {
            delete portEnv.Path;
          }
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
            } catch {
            }
          }
          const isWebpackDirect = devCmd.args.includes("webpack") || devCmd.args.includes("webpack-dev-server") || devCmd.args.includes("vue-cli-service");
          if (isWebpackDirect && !isReactScripts) {
            portEnv.NODE_OPTIONS = (portEnv.NODE_OPTIONS || "") + " --openssl-legacy-provider";
          }
          const isNextDev = devCmd.args.includes("next");
          if (isNextDev) {
            portEnv.HOSTNAME = "0.0.0.0";
            const nextLockPath = path.join(projectDir, ".next", "dev", "lock");
            try {
              if (fs.existsSync(nextLockPath)) {
                fs.unlinkSync(nextLockPath);
                console.log(`[Preview] Removed stale .next/dev/lock for ${name}`);
              }
            } catch {
            }
          }
          if (devCmd.cmd === "npx" && devCmd.args.length > 0) {
            const binName = devCmd.args[0];
            const localBin = path.join(effectiveProjectDir, "node_modules", ".bin", isWin ? `${binName}.cmd` : binName);
            if (fs.existsSync(localBin)) {
              console.log(`[Preview] Using local binary for ${name}: ${localBin}`);
              devCmd = { cmd: localBin, args: devCmd.args.slice(1) };
            }
          }
          const postcssConfigs = ["postcss.config.js", "postcss.config.cjs", "postcss.config.mjs", "postcss.config.ts", ".postcssrc", ".postcssrc.js", ".postcssrc.json"];
          const hasOwnPostcss = postcssConfigs.some((f) => fs.existsSync(path.join(effectiveProjectDir, f)));
          if (!hasOwnPostcss) {
            try {
              fs.writeFileSync(path.join(effectiveProjectDir, "postcss.config.cjs"), "module.exports = { plugins: {} };\n");
              console.log(`[Preview] Created empty postcss.config.cjs for ${name} to isolate from parent`);
            } catch {
            }
          }
          const child = spawn(devCmd.cmd, devCmd.args, {
            cwd: effectiveProjectDir,
            stdio: "pipe",
            shell: true,
            detached: !isWin,
            windowsHide: true,
            env: portEnv
          });
          if (!isWin) child.unref();
          let startupOutput = "";
          let serverReady = false;
          const startupErrors = [];
          const collectOutput = (data) => {
            const text = data.toString();
            startupOutput += text;
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
                console.log(`[AutoFix] Live error in preview ${name}: [${classified.category}] \u2014 executing recovery...`);
                let liveRecovery = { attempted: false, success: false, detail: "No auto-fix available" };
                const projDir = path.resolve(process.cwd(), "projects", name);
                if (classified.strategy === "restart-vite" || classified.strategy === "clear-cache-restart") {
                  const entry = previewProcesses.get(name);
                  if (entry) {
                    try {
                      entry.process.kill("SIGTERM");
                    } catch {
                    }
                    previewProcesses.delete(name);
                  }
                  if (classified.strategy === "clear-cache-restart") {
                    clearViteFrameworkCaches(projDir);
                  }
                  liveRecovery = { attempted: true, success: true, detail: `Preview killed for restart (${classified.strategy})` };
                  console.log(`[AutoFix] Killed preview ${name} \u2014 will auto-restart on next request`);
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "npm-install" || classified.strategy === "legacy-peer-deps" || classified.strategy === "full-reinstall") {
                  liveRecovery = { attempted: true, success: true, detail: "Queued install + preview restart" };
                  (async () => {
                    try {
                      const { execSync: es3 } = await import("child_process");
                      const installCmd3 = pm === "bun" ? "npx bun install" : pm === "pnpm" ? "npx pnpm install --no-frozen-lockfile" : pm === "yarn" ? "npx yarn install --ignore-engines" : "npm install --legacy-peer-deps";
                      es3(installCmd3, { cwd: projDir, timeout: 12e4, stdio: "pipe" });
                      const entry2 = previewProcesses.get(name);
                      if (entry2) {
                        try {
                          entry2.process.kill("SIGTERM");
                        } catch {
                        }
                        previewProcesses.delete(name);
                      }
                      console.log(`[AutoFix] Install completed for ${name}`);
                      scheduleViteAutoRestart(name, projDir, String(port));
                    } catch (e) {
                      const em = e instanceof Error ? e.message : String(e);
                      console.log(`[AutoFix] Install failed for ${name}: ${em.slice(0, 200)}`);
                    }
                  })();
                } else if (classified.strategy === "fix-postcss-config") {
                  fixVitePostcssConfig(projDir);
                  const entry = previewProcesses.get(name);
                  if (entry) {
                    try {
                      entry.process.kill("SIGTERM");
                    } catch {
                    }
                    previewProcesses.delete(name);
                  }
                  liveRecovery = { attempted: true, success: true, detail: "PostCSS config fixed + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "kill-port") {
                  const portMatch3 = text.match(/EADDRINUSE.*:(\d+)/i);
                  if (portMatch3) {
                    (async () => {
                      try {
                        const { execSync: es3 } = await import("child_process");
                        es3(`lsof -ti:${portMatch3[1]} | xargs kill -9 2>/dev/null || true`, { timeout: 5e3, stdio: "pipe", shell: true });
                      } catch {
                      }
                    })();
                    liveRecovery = { attempted: true, success: true, detail: `Killed process on port ${portMatch3[1]}` };
                    scheduleViteAutoRestart(name, projDir, String(port));
                  }
                } else if (classified.strategy === "vite-force") {
                  clearViteFrameworkCaches(projDir);
                  const entry = previewProcesses.get(name);
                  if (entry) {
                    try {
                      entry.process.kill("SIGTERM");
                    } catch {
                    }
                    previewProcesses.delete(name);
                  }
                  liveRecovery = { attempted: true, success: true, detail: "Cleared Vite cache + preview killed for --force restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "fix-tsconfig-paths") {
                  fixViteTsconfigPaths(projDir);
                  const entry = previewProcesses.get(name);
                  if (entry) {
                    try {
                      entry.process.kill("SIGTERM");
                    } catch {
                    }
                    previewProcesses.delete(name);
                  }
                  liveRecovery = { attempted: true, success: true, detail: "tsconfig.json paths fixed + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "extend-timeout") {
                  liveRecovery = { attempted: true, success: true, detail: "Startup timeout extended \u2014 waiting longer for dev server" };
                } else if (classified.strategy === "cors-config") {
                  const fixed = fixViteCorsConfig(projDir);
                  if (fixed) {
                    const entry = previewProcesses.get(name);
                    if (entry) {
                      try {
                        entry.process.kill("SIGTERM");
                      } catch {
                      }
                      previewProcesses.delete(name);
                    }
                    liveRecovery = { attempted: true, success: true, detail: "CORS config patched + preview killed for restart" };
                    scheduleViteAutoRestart(name, projDir, String(port));
                  } else {
                    liveRecovery = { attempted: true, success: false, detail: "CORS error detected \u2014 could not auto-patch. Add cors:true to vite server config or CORS middleware to Express app." };
                  }
                } else if (classified.strategy === "increase-ulimit") {
                  (async () => {
                    try {
                      const { execSync: es3 } = await import("child_process");
                      es3("ulimit -n 65536 2>/dev/null || true", { timeout: 5e3, stdio: "pipe", shell: true });
                    } catch {
                    }
                  })();
                  const entry = previewProcesses.get(name);
                  if (entry) {
                    try {
                      entry.process.kill("SIGTERM");
                    } catch {
                    }
                    previewProcesses.delete(name);
                  }
                  liveRecovery = { attempted: true, success: true, detail: "Increased file descriptor limit + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "increase-watchers") {
                  (async () => {
                    try {
                      const { execSync: es3 } = await import("child_process");
                      es3("sysctl -w fs.inotify.max_user_watches=524288 2>/dev/null || true", { timeout: 5e3, stdio: "pipe", shell: true });
                    } catch {
                    }
                  })();
                  const entry = previewProcesses.get(name);
                  if (entry) {
                    try {
                      entry.process.kill("SIGTERM");
                    } catch {
                    }
                    previewProcesses.delete(name);
                  }
                  liveRecovery = { attempted: true, success: true, detail: "Increased inotify watchers + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "angular-update") {
                  (async () => {
                    try {
                      const { execSync: es3 } = await import("child_process");
                      es3("npx ng update @angular/core @angular/cli --force 2>/dev/null || true", { cwd: projDir, timeout: 12e4, stdio: "pipe", shell: true, windowsHide: true });
                    } catch {
                    }
                  })();
                  const entry = previewProcesses.get(name);
                  if (entry) {
                    try {
                      entry.process.kill("SIGTERM");
                    } catch {
                    }
                    previewProcesses.delete(name);
                  }
                  liveRecovery = { attempted: true, success: true, detail: "Angular packages updated via ng update + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "install-missing-dep") {
                  (async () => {
                    try {
                      const livePm = detectPackageManager();
                      const targeted = installViteMissingDep(projDir, text, livePm);
                      if (!targeted) {
                        const { execSync: es3 } = await import("child_process");
                        const installCmd3 = livePm === "bun" ? "npx bun install" : livePm === "pnpm" ? "npx pnpm install --no-frozen-lockfile" : livePm === "yarn" ? "npx yarn install --ignore-engines" : "npm install --legacy-peer-deps";
                        es3(installCmd3, { cwd: projDir, timeout: 12e4, stdio: "pipe", shell: true, windowsHide: true });
                      }
                      const entry2 = previewProcesses.get(name);
                      if (entry2) {
                        try {
                          entry2.process.kill("SIGTERM");
                        } catch {
                        }
                        previewProcesses.delete(name);
                      }
                      scheduleViteAutoRestart(name, projDir, String(port));
                    } catch {
                    }
                  })();
                  liveRecovery = { attempted: true, success: true, detail: "Missing dependency installed + preview killed for restart" };
                } else if (classified.strategy === "delete-framework-cache") {
                  deleteViteFrameworkCache(projDir);
                  const entry = previewProcesses.get(name);
                  if (entry) {
                    try {
                      entry.process.kill("SIGTERM");
                    } catch {
                    }
                    previewProcesses.delete(name);
                  }
                  liveRecovery = { attempted: true, success: true, detail: "Framework cache deleted + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "update-package") {
                  (async () => {
                    try {
                      const { execSync: es3 } = await import("child_process");
                      const livePm = detectPackageManager();
                      const targeted = updateViteSpecificPackage(projDir, text, livePm);
                      if (!targeted) {
                        const installCmd3 = livePm === "bun" ? "npx bun install" : livePm === "pnpm" ? "npx pnpm install --no-frozen-lockfile" : livePm === "yarn" ? "npx yarn install --ignore-engines" : "npm install --legacy-peer-deps";
                        es3(installCmd3, { cwd: projDir, timeout: 12e4, stdio: "pipe", shell: true, windowsHide: true });
                      }
                      const entry2 = previewProcesses.get(name);
                      if (entry2) {
                        try {
                          entry2.process.kill("SIGTERM");
                        } catch {
                        }
                        previewProcesses.delete(name);
                      }
                      scheduleViteAutoRestart(name, projDir, String(port));
                    } catch {
                    }
                  })();
                  liveRecovery = { attempted: true, success: true, detail: "Package updated to latest + preview killed for restart" };
                } else if (classified.strategy === "cache-clean-reinstall" || classified.strategy === "full-install-retry" || classified.strategy === "install-missing-cli" || classified.strategy === "install-types") {
                  (async () => {
                    try {
                      const { execSync: es3 } = await import("child_process");
                      if (classified.strategy === "cache-clean-reinstall") {
                        try {
                          es3("npm cache clean --force", { cwd: projDir, timeout: 3e4, stdio: "pipe", shell: true, windowsHide: true });
                        } catch {
                        }
                        const lockFile = path.join(projDir, "package-lock.json");
                        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
                      }
                      const livePm = detectPackageManager();
                      const installCmd3 = livePm === "bun" ? "npx bun install" : livePm === "pnpm" ? "npx pnpm install --no-frozen-lockfile" : livePm === "yarn" ? "npx yarn install --ignore-engines" : "npm install --legacy-peer-deps";
                      es3(installCmd3, { cwd: projDir, timeout: 12e4, stdio: "pipe", shell: true, windowsHide: true });
                      const entry2 = previewProcesses.get(name);
                      if (entry2) {
                        try {
                          entry2.process.kill("SIGTERM");
                        } catch {
                        }
                        previewProcesses.delete(name);
                      }
                      scheduleViteAutoRestart(name, projDir, String(port));
                    } catch {
                    }
                  })();
                  liveRecovery = { attempted: true, success: true, detail: `Dependencies reinstalled (${classified.strategy}) + preview killed for restart` };
                } else if (classified.strategy === "copy-env-example") {
                  copyViteEnvExample(projDir);
                  const entry = previewProcesses.get(name);
                  if (entry) {
                    try {
                      entry.process.kill("SIGTERM");
                    } catch {
                    }
                    previewProcesses.delete(name);
                  }
                  liveRecovery = { attempted: true, success: true, detail: ".env created + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "add-type-module") {
                  const pkgJsonPath2 = path.join(projDir, "package.json");
                  try {
                    if (fs.existsSync(pkgJsonPath2)) {
                      const pObj = JSON.parse(fs.readFileSync(pkgJsonPath2, "utf-8"));
                      if (pObj.type !== "module") {
                        pObj.type = "module";
                        fs.writeFileSync(pkgJsonPath2, JSON.stringify(pObj, null, 2), "utf-8");
                      }
                    }
                    const entry = previewProcesses.get(name);
                    if (entry) {
                      try {
                        entry.process.kill("SIGTERM");
                      } catch {
                      }
                      previewProcesses.delete(name);
                    }
                    liveRecovery = { attempted: true, success: true, detail: "Added type:module + preview killed for restart" };
                    scheduleViteAutoRestart(name, projDir, String(port));
                  } catch {
                    liveRecovery = { attempted: true, success: false, detail: "Failed to add type:module" };
                  }
                } else if (classified.strategy === "openssl-legacy-provider" || classified.strategy === "increase-heap") {
                  const entry = previewProcesses.get(name);
                  if (entry) {
                    try {
                      entry.process.kill("SIGTERM");
                    } catch {
                    }
                    previewProcesses.delete(name);
                  }
                  liveRecovery = { attempted: true, success: true, detail: `Will apply ${classified.strategy} on restart` };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "fix-tsconfig") {
                  fixViteTsconfigJson(projDir);
                  const entry = previewProcesses.get(name);
                  if (entry) {
                    try {
                      entry.process.kill("SIGTERM");
                    } catch {
                    }
                    previewProcesses.delete(name);
                  }
                  liveRecovery = { attempted: true, success: true, detail: "tsconfig.json fixed + preview killed for restart" };
                  scheduleViteAutoRestart(name, projDir, String(port));
                } else if (classified.strategy === "upgrade-node-warning") {
                  let nodeVer2 = "unknown";
                  try {
                    const cp = __require("child_process");
                    nodeVer2 = cp.execSync("node --version", { timeout: 5e3, stdio: "pipe", encoding: "utf-8" }).toString().trim();
                  } catch {
                  }
                  liveRecovery = { attempted: true, success: false, detail: `Node.js version mismatch: current ${nodeVer2} does not support modern syntax (optional chaining, nullish coalescing, etc.). Please upgrade Node.js to v14+ (v18+ recommended).` };
                }
                viteErrorHistory.push({
                  id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  timestamp: Date.now(),
                  source: "vite-server",
                  message: text.trim().slice(0, 500),
                  projectName: name,
                  classified,
                  recovery: liveRecovery
                });
                if (viteErrorHistory.length > 200) viteErrorHistory.splice(0, viteErrorHistory.length - 200);
              }
            }
          };
          child.stdout?.on("data", collectOutput);
          child.stderr?.on("data", collectOutput);
          previewProcesses.set(name, { process: child, port });
          let exited = false;
          child.on("error", (err) => {
            console.error(`[Preview] Process error for ${name}:`, err.message);
            exited = true;
          });
          child.on("exit", (code) => {
            exited = true;
            if (code !== 0 && code !== null) {
              console.error(`[Preview] Process for ${name} exited with code ${code}`);
              previewProcesses.delete(name);
              console.log(`[AutoFix] Preview ${name} exited with code ${code} \u2014 scheduling auto-restart`);
              scheduleViteAutoRestart(name, effectiveProjectDir, String(port));
            } else {
              previewProcesses.delete(name);
            }
          });
          const maxWait = 15e3;
          const start = Date.now();
          while (Date.now() - start < maxWait && !serverReady && !exited) {
            await new Promise((r) => setTimeout(r, 300));
          }
          const isValidNpmPackageName = (name2) => {
            return /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name2) && name2.length <= 214;
          };
          const NODE_BUILTINS = /* @__PURE__ */ new Set(["fs", "path", "os", "child_process", "http", "https", "url", "util", "crypto", "stream", "events", "assert", "buffer", "net", "tls", "dns", "zlib", "querystring", "module", "vm", "cluster", "dgram", "readline", "tty", "worker_threads", "perf_hooks", "async_hooks", "v8", "inspector", "string_decoder", "timers", "console"]);
          const extractMissingPackages = (output) => {
            const pkgs = /* @__PURE__ */ new Set();
            const addIfValid = (raw) => {
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
                      cwd: effectiveProjectDir,
                      stdio: "pipe",
                      shell: true,
                      detached: !isWin,
                      windowsHide: true,
                      env: portEnv
                    });
                    if (!isWin) child2.unref();
                    startupOutput = "";
                    serverReady = false;
                    exited = false;
                    startupErrors.length = 0;
                    child2.stdout?.on("data", collectOutput);
                    child2.stderr?.on("data", collectOutput);
                    previewProcesses.set(name, { process: child2, port });
                    child2.on("error", () => {
                      exited = true;
                    });
                    child2.on("exit", (code) => {
                      exited = true;
                      if (code !== 0 && code !== null) previewProcesses.delete(name);
                    });
                    const startESM = Date.now();
                    while (Date.now() - startESM < maxWait && !serverReady && !exited) {
                      await new Promise((r) => setTimeout(r, 300));
                    }
                  }
                } catch {
                }
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
                      if (!fs.existsSync(path.join(subPath, ".git"))) {
                        try {
                          fs.mkdirSync(path.join(subPath, ".git"), { recursive: true });
                        } catch {
                        }
                      }
                      execSync("npm install --legacy-peer-deps", { cwd: subPath, timeout: 12e4, stdio: "pipe", shell: true, windowsHide: true, env: { ...process.env, HUSKY: "0" } });
                    } catch {
                    }
                  }
                }
              }
              console.log(`[Preview] Detected missing packages: ${missingPkgs.join(", ")} \u2014 installing in ${installDir === projectDir ? "root" : path.basename(installDir)} and retrying`);
              try {
                const installPkgList = missingPkgs.join(" ");
                const installCmd = pm === "npm" ? `npm install --save-dev --legacy-peer-deps ${installPkgList}` : pm === "pnpm" ? `npx pnpm add -D ${installPkgList}` : pm === "yarn" ? `npx yarn add -D ${installPkgList}` : `npm install --save-dev --legacy-peer-deps ${installPkgList}`;
                execSync(installCmd, { cwd: installDir, timeout: 6e4, stdio: "pipe", shell: true, windowsHide: true, env: safeInstallEnv });
                console.log(`[Preview] Installed ${missingPkgs.join(", ")} \u2014 retrying startup`);
                const child2 = spawn(devCmd.cmd, devCmd.args, {
                  cwd: effectiveProjectDir,
                  stdio: "pipe",
                  shell: true,
                  detached: !isWin,
                  windowsHide: true,
                  env: portEnv
                });
                if (!isWin) child2.unref();
                startupOutput = "";
                serverReady = false;
                exited = false;
                startupErrors.length = 0;
                child2.stdout?.on("data", collectOutput);
                child2.stderr?.on("data", collectOutput);
                previewProcesses.set(name, { process: child2, port });
                child2.on("error", () => {
                  exited = true;
                });
                child2.on("exit", (code) => {
                  exited = true;
                  if (code !== 0 && code !== null) previewProcesses.delete(name);
                });
                const start2 = Date.now();
                while (Date.now() - start2 < maxWait && !serverReady && !exited) {
                  await new Promise((r) => setTimeout(r, 300));
                }
              } catch (e) {
                console.log(`[Preview] Auto-install retry failed: ${e.message?.slice(0, 200)}`);
              }
            }
          }
          res.setHeader("Content-Type", "application/json");
          if (exited && !serverReady && !retried) {
            previewProcesses.delete(name);
            const outputStr = startupOutput + " " + startupErrors.join(" ");
            const safeInstallEnv2 = { ...process.env, HUSKY: "0", npm_config_ignore_scripts: "", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" };
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
                    console.log('[Preview] Auto-fix: added "type":"module" to package.json after ESM error');
                    autoFixed = true;
                  }
                } catch {
                }
              }
            }
            const { fixes: autoFixes } = await attemptViteAutoFixStartup(effectiveProjectDir, outputStr, pm, safeInstallEnv2);
            if (autoFixes.length > 0) autoFixed = true;
            const fixedEnv = buildViteAutoFixEnv({ ...process.env, ...portEnv, PORT: String(port) }, outputStr);
            if (autoFixed) {
              console.log(`[Preview] Retrying ${name} after ${autoFixes.length} auto-fixes: ${autoFixes.join(", ")}...`);
              try {
                let newPkg = {};
                try {
                  newPkg = JSON.parse(fs.readFileSync(path.join(effectiveProjectDir, "package.json"), "utf-8"));
                } catch {
                }
                const newDevCmd = detectDevCommand();
                const { spawn: sp3 } = await import("child_process");
                const child3 = sp3(newDevCmd.cmd, newDevCmd.args, {
                  cwd: effectiveProjectDir,
                  stdio: "pipe",
                  shell: true,
                  detached: !isWin,
                  windowsHide: true,
                  env: fixedEnv
                });
                if (!isWin) child3.unref();
                let startupOutput3 = "";
                let serverReady3 = false;
                let exited3 = false;
                const startupErrors3 = [];
                const collectOutput3 = (data) => {
                  const t = data.toString();
                  startupOutput3 += t;
                  console.log(`[Preview:${name}] ${t.trim()}`);
                  if (/ready|VITE.*ready|compiled|started server|listening|Local:|Successfully compiled/i.test(t)) serverReady3 = true;
                  if (/error|ERR!|Cannot find|MODULE_NOT_FOUND|SyntaxError|ENOENT|EADDRINUSE/i.test(t)) startupErrors3.push(t.trim().slice(0, 300));
                };
                child3.stdout.on("data", collectOutput3);
                child3.stderr.on("data", collectOutput3);
                previewProcesses.set(name, { process: child3, port });
                child3.on("error", () => {
                  exited3 = true;
                });
                child3.on("exit", (code3) => {
                  exited3 = true;
                  if (code3 !== 0 && code3 !== null) previewProcesses.delete(name);
                });
                const isNextProject = /next/i.test(String(newDevCmd.args?.[0] || ""));
                const isTimeoutExtend = autoFixes.includes("extend-timeout") || /timed? ?out|timeout|ETIMEDOUT/i.test(outputStr);
                const retryWait = isNextProject ? 45e3 : isTimeoutExtend ? 3e4 : maxWait;
                const start3 = Date.now();
                while (Date.now() - start3 < retryWait && !serverReady3 && !exited3) {
                  await new Promise((r) => setTimeout(r, 300));
                }
                if (!exited3 || serverReady3) {
                  res.end(JSON.stringify({
                    port,
                    started: true,
                    ready: serverReady3,
                    detectedCommand: `${newDevCmd.cmd} ${newDevCmd.args.join(" ")}`,
                    packageManager: pm,
                    retried: true,
                    autoFixes
                  }));
                  return;
                }
                previewProcesses.delete(name);
                scheduleViteAutoRestart(name, effectiveProjectDir, String(port));
                res.end(JSON.stringify({
                  port,
                  started: false,
                  error: `Dev server failed after auto-fix retry (${autoFixes.join(", ")}). ${startupErrors3.join(" | ").slice(0, 800)}`,
                  output: startupOutput3.slice(-2e3),
                  detectedCommand: `${newDevCmd.cmd} ${newDevCmd.args.join(" ")}`,
                  retried: true,
                  autoFixes
                }));
                return;
              } catch (retryErr) {
                console.log(`[Preview] Auto-fix retry spawn failed: ${retryErr.message?.slice(0, 200)}`);
              }
            }
            const failClassified = classifyViteError(outputStr);
            const actionableMsg = failClassified.category !== "unknown" ? `Dev server failed: ${failClassified.category} (${failClassified.strategy}). ${failClassified.detail || ""} ${startupErrors.join(" | ").slice(0, 600)}` : `Dev server process exited immediately. Check terminal output for errors. ${startupErrors.join(" | ").slice(0, 800)}`;
            scheduleViteAutoRestart(name, effectiveProjectDir, String(port));
            res.end(JSON.stringify({
              port,
              started: false,
              error: actionableMsg,
              output: startupOutput.slice(-2e3),
              detectedCommand: `${devCmd.cmd} ${devCmd.args.join(" ")}`,
              classified: failClassified,
              retried
            }));
          } else if (exited && !serverReady) {
            previewProcesses.delete(name);
            const failClassified2 = classifyViteError(startupOutput + " " + startupErrors.join(" "));
            const actionableMsg2 = failClassified2.category !== "unknown" ? `Dev server failed after retry: ${failClassified2.category} (${failClassified2.strategy}). ${failClassified2.detail || ""} ${startupErrors.join(" | ").slice(0, 600)}` : `Dev server process exited after retry. Check terminal output for errors. ${startupErrors.join(" | ").slice(0, 800)}`;
            scheduleViteAutoRestart(name, effectiveProjectDir, String(port));
            res.end(JSON.stringify({
              port,
              started: false,
              error: actionableMsg2,
              output: startupOutput.slice(-2e3),
              detectedCommand: `${devCmd.cmd} ${devCmd.args.join(" ")}`,
              classified: failClassified2,
              retried
            }));
          } else {
            res.end(JSON.stringify({
              port,
              started: true,
              ready: serverReady,
              detectedCommand: `${devCmd.cmd} ${devCmd.args.join(" ")}`,
              packageManager: pm,
              retried
            }));
          }
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/restart-preview", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name } = JSON.parse(await readBody(req));
          if (!name || /[\/\\]|\.\./.test(name)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Invalid project name" }));
            return;
          }
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
              try {
                execSync(`taskkill /pid ${entry.process.pid} /T /F`, { stdio: "pipe", windowsHide: true });
              } catch {
              }
            } else {
              try {
                process.kill(-entry.process.pid, "SIGKILL");
              } catch {
                try {
                  entry.process.kill("SIGKILL");
                } catch {
                }
              }
            }
          } catch {
          }
          previewProcesses.delete(name);
          const waitForPortFree = async (port, maxWait) => {
            const net = await import("net");
            const start = Date.now();
            while (Date.now() - start < maxWait) {
              const inUse = await new Promise((resolve) => {
                const s = net.createServer();
                s.once("error", () => resolve(true));
                s.once("listening", () => {
                  s.close();
                  resolve(false);
                });
                s.listen(port, "0.0.0.0");
              });
              if (!inUse) return true;
              await new Promise((r) => setTimeout(r, 200));
            }
            return false;
          };
          const portFree = await waitForPortFree(oldPort, 3e3);
          if (!portFree) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ restarted: false, reason: "Port still in use after 3s" }));
            return;
          }
          const fs = await import("fs");
          const projectDir = path.resolve(process.cwd(), "projects", name);
          const { spawn } = await import("child_process");
          let pkg = {};
          let restartDir = projectDir;
          const pkgPath = path.join(projectDir, "package.json");
          if (fs.existsSync(pkgPath)) {
            try {
              pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            } catch {
            }
          } else {
            for (const sub of ["frontend", "client", "web", "app"]) {
              const subPkg = path.join(projectDir, sub, "package.json");
              if (fs.existsSync(subPkg)) {
                try {
                  pkg = JSON.parse(fs.readFileSync(subPkg, "utf-8"));
                  restartDir = path.join(projectDir, sub);
                } catch {
                }
                break;
              }
            }
          }
          const scripts = pkg.scripts || {};
          const deps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
          const detectPMRestart = () => {
            for (const dir of [restartDir, projectDir]) {
              if (fs.existsSync(path.join(dir, "bun.lockb")) || fs.existsSync(path.join(dir, "bun.lock"))) return "bun";
              if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
              if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn";
            }
            return "npm";
          };
          const pmR = detectPMRestart();
          const restartDetect = () => {
            const portStr = String(oldPort);
            const matchScript = (scriptBody) => {
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
              const m = matchScript(scripts.dev);
              if (m) return m;
              return { cmd: pmR === "npm" ? "npm" : `npx ${pmR}`, args: pmR === "npm" ? ["run", "dev"] : ["run", "dev"] };
            }
            if (scripts.start) {
              const m = matchScript(scripts.start);
              if (m) return m;
              return { cmd: pmR === "npm" ? "npm" : `npx ${pmR}`, args: pmR === "npm" ? ["run", "start"] : ["run", "start"] };
            }
            if (scripts.serve || scripts["serve:rspack"]) {
              const s = scripts.serve || scripts["serve:rspack"];
              const m = matchScript(s);
              if (m) return m;
              const k = scripts.serve ? "serve" : "serve:rspack";
              return { cmd: pmR === "npm" ? "npm" : `npx ${pmR}`, args: pmR === "npm" ? ["run", k] : ["run", k] };
            }
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
          const rBinDirs = [path.join(restartDir, "node_modules", ".bin")];
          if (restartDir !== projectDir) rBinDirs.push(path.join(projectDir, "node_modules", ".bin"));
          const rIsolatedPath = rBinDirs.join(rPathSep) + rPathSep + (process.env.PATH || process.env.Path || "");
          const rNodePaths = [path.join(restartDir, "node_modules")];
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
              ...restartCmd.args.some((a) => ["webpack", "webpack-dev-server", "vue-cli-service", "react-scripts"].includes(a)) ? { NODE_OPTIONS: (process.env.NODE_OPTIONS || "") + " --openssl-legacy-provider" } : {}
            }
          });
          if (!isWinR) child.unref();
          previewProcesses.set(name, { process: child, port: oldPort });
          child.stdout?.on("data", (d) => console.log(`[Preview:${name}] ${d.toString().trim()}`));
          child.stderr?.on("data", (d) => console.log(`[Preview:${name}] ${d.toString().trim()}`));
          child.on("error", (err) => {
            console.error(`[Preview] Process error for ${name}:`, err.message);
          });
          child.on("exit", (code) => {
            if (code !== null && code !== 0) {
              console.error(`[Preview] Process for ${name} exited with code ${code}`);
            }
            previewProcesses.delete(name);
          });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ restarted: true, port: oldPort }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      const viteErrorHistory = [];
      const viteRateLimitMap = /* @__PURE__ */ new Map();
      const viteAutoRestartAttempts = /* @__PURE__ */ new Map();
      const VITE_AUTO_RESTART_MAX = 3;
      const VITE_AUTO_RESTART_BACKOFF = [2e3, 5e3, 15e3];
      function scheduleViteAutoRestart(name, projectDir, portStr) {
        const attempts = viteAutoRestartAttempts.get(name) || 0;
        if (attempts >= VITE_AUTO_RESTART_MAX) {
          console.log(`[AutoFix] Preview ${name} has crashed ${attempts} times \u2014 not restarting (max ${VITE_AUTO_RESTART_MAX})`);
          viteAutoRestartAttempts.delete(name);
          return;
        }
        const delay = VITE_AUTO_RESTART_BACKOFF[attempts] || 15e3;
        viteAutoRestartAttempts.set(name, attempts + 1);
        console.log(`[AutoFix] Will auto-restart ${name} in ${delay / 1e3}s (attempt ${attempts + 1}/${VITE_AUTO_RESTART_MAX})`);
        setTimeout(async () => {
          if (previewProcesses.has(name)) {
            console.log(`[AutoFix] Preview ${name} already running \u2014 skipping auto-restart`);
            return;
          }
          const fs2 = await import("fs");
          if (!fs2.existsSync(projectDir)) {
            console.log(`[AutoFix] Project dir not found \u2014 skipping auto-restart for ${name}`);
            viteAutoRestartAttempts.delete(name);
            return;
          }
          console.log(`[AutoFix] Auto-restarting preview ${name}...`);
          try {
            const { spawn: sp2 } = await import("child_process");
            const port = parseInt(portStr) || projectPort(name);
            let pkg = {};
            const pkgPath = path.join(projectDir, "package.json");
            try {
              if (fs2.existsSync(pkgPath)) pkg = JSON.parse(fs2.readFileSync(pkgPath, "utf-8"));
            } catch {
            }
            const scripts = pkg.scripts || {};
            const deps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
            let cmd = "npx";
            let args = ["vite", "--host", "0.0.0.0", "--port", String(port)];
            const devScript = scripts.dev || scripts.start || scripts.serve || "";
            if (devScript.includes("next")) {
              args = ["next", "dev", "--port", String(port), "--hostname", "0.0.0.0"];
            } else if (devScript.includes("react-scripts")) {
              args = ["react-scripts", "start"];
            } else if (devScript.includes("nuxt")) {
              args = ["nuxt", "dev", "--port", String(port)];
            } else if (devScript.includes("astro")) {
              args = ["astro", "dev", "--port", String(port), "--host", "0.0.0.0"];
            } else if (devScript.includes("webpack")) {
              args = ["webpack", "serve", "--host", "0.0.0.0", "--port", String(port)];
            } else if (devScript.includes("ng ") || devScript.includes("ng serve")) {
              args = ["ng", "serve", "--host", "0.0.0.0", "--port", String(port)];
            } else if (devScript.includes("gatsby")) {
              args = ["gatsby", "develop", "-H", "0.0.0.0", "-p", String(port)];
            } else if (deps.next) {
              args = ["next", "dev", "--port", String(port), "--hostname", "0.0.0.0"];
            } else if (deps["react-scripts"]) {
              args = ["react-scripts", "start"];
            } else if (deps.nuxt) {
              args = ["nuxt", "dev", "--port", String(port)];
            }
            console.log(`[AutoFix] Restart command: ${cmd} ${args.join(" ")}`);
            const isWin = process.platform === "win32";
            const child2 = sp2(cmd, args, {
              cwd: projectDir,
              env: { ...process.env, PORT: String(port), VITE_PORT: String(port), BROWSER: "none" },
              stdio: ["pipe", "pipe", "pipe"],
              shell: true,
              detached: !isWin,
              windowsHide: true
            });
            if (!isWin) child2.unref();
            child2.stdout?.on("data", (d) => console.log(`[Preview:${name}] ${d.toString().trim()}`));
            child2.stderr?.on("data", (d) => console.log(`[Preview:${name}] ${d.toString().trim()}`));
            previewProcesses.set(name, { process: child2, port });
            child2.on("exit", (code2) => {
              if (code2 !== 0 && code2 !== null) {
                previewProcesses.delete(name);
                scheduleViteAutoRestart(name, projectDir, portStr);
              }
            });
            console.log(`[AutoFix] Preview ${name} auto-restarted on port ${port}`);
          } catch (e) {
            const em = e instanceof Error ? e.message : String(e);
            console.log(`[AutoFix] Auto-restart failed for ${name}: ${em}`);
          }
        }, delay);
      }
      function viteErrorSig(msg) {
        return msg.replace(/at .*:\d+:\d+/g, "").replace(/\/[^\s:]+/g, "<path>").replace(/\d+/g, "N").trim().slice(0, 120);
      }
      function isViteRateLimited(msg) {
        const sig = viteErrorSig(msg);
        const entry = viteRateLimitMap.get(sig);
        if (!entry) return false;
        if (Date.now() - entry.first > 6e4) {
          viteRateLimitMap.delete(sig);
          return false;
        }
        return entry.count >= 3;
      }
      function recordViteAttempt(msg) {
        const sig = viteErrorSig(msg);
        const entry = viteRateLimitMap.get(sig);
        if (entry) {
          if (Date.now() - entry.first > 6e4) {
            viteRateLimitMap.set(sig, { count: 1, first: Date.now() });
          } else {
            entry.count++;
          }
        } else {
          viteRateLimitMap.set(sig, { count: 1, first: Date.now() });
        }
      }
      function classifyViteError(message, stack) {
        const text = `${message || ""} ${stack || ""}`;
        const patterns = [
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
          { p: /fetch.*failed|net::ERR_|NetworkError/i, cat: "network-error", strat: "retry", conf: 0.6 },
          { p: /supabase|postgrest|realtime.*error/i, cat: "supabase-connection", strat: "retry", conf: 0.7 },
          { p: /VITE_\w+.*undefined|env.*missing|environment variable/i, cat: "env-missing", strat: "copy-env-example", conf: 0.7 },
          { p: /Circular dependency/i, cat: "circular-dependency", strat: "escalate", conf: 0.8 }
        ];
        for (const { p, cat, strat, conf, exFile, exSym } of patterns) {
          const match = text.match(p);
          if (match) {
            const result = {
              category: cat,
              strategy: strat,
              confidence: conf,
              detail: match[0].slice(0, 200)
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
      function clearViteFrameworkCaches(projectDir) {
        const cacheDirs = [".vite", ".next", ".nuxt", ".astro", ".svelte-kit", ".parcel-cache", "node_modules/.cache", "node_modules/.vite"];
        let cleared = 0;
        const fs3 = __require("fs");
        for (const dir of cacheDirs) {
          const full = path.join(projectDir, dir);
          if (fs3.existsSync(full)) {
            try {
              fs3.rmSync(full, { recursive: true, force: true });
              cleared++;
            } catch {
            }
          }
        }
        return cleared;
      }
      function copyViteEnvExample(projectDir) {
        const fs3 = __require("fs");
        const envPath = path.join(projectDir, ".env");
        if (fs3.existsSync(envPath)) return false;
        const examples = [".env.example", ".env.sample", ".env.template", ".env.local.example"];
        for (const ex of examples) {
          const exPath = path.join(projectDir, ex);
          if (fs3.existsSync(exPath)) {
            try {
              fs3.copyFileSync(exPath, envPath);
              console.log(`[AutoFix] Copied ${ex} \u2192 .env`);
              return true;
            } catch {
            }
          }
        }
        try {
          const placeholder = "# Auto-generated placeholder .env\n# Fill in your environment variables below\nNODE_ENV=development\nPORT=3000\n";
          fs3.writeFileSync(envPath, placeholder, "utf-8");
          console.log("[AutoFix] Created placeholder .env (no example found)");
          return true;
        } catch {
        }
        return false;
      }
      function fixViteTsconfigJson(projectDir) {
        const fs3 = __require("fs");
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
        } catch {
          return false;
        }
      }
      function fixVitePostcssConfig(projectDir) {
        const fs3 = __require("fs");
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
                const allDeps = { ...pkg2.dependencies || {}, ...pkg2.devDependencies || {} };
                const twVersion = allDeps.tailwindcss || "";
                if (twVersion.startsWith("4") || twVersion.startsWith("^4") || twVersion.startsWith("~4")) {
                  content = content.replace(/['"]?tailwindcss['"]?\s*:\s*\{\s*\}/g, "'@tailwindcss/postcss': {}");
                  content = content.replace(/require\(['"]tailwindcss['"]\)/g, "require('@tailwindcss/postcss')");
                  fs3.writeFileSync(cfgPath, content, "utf-8");
                  console.log(`[AutoFix] Updated ${cfg} for Tailwind v4 (tailwindcss \u2192 @tailwindcss/postcss)`);
                  return true;
                }
              }
            }
          } catch {
          }
        }
        return false;
      }
      function fixViteTsconfigPaths(projectDir) {
        const fs4 = __require("fs");
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
                const allDeps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
                if (allDeps["@"] || fs4.existsSync(path.join(projectDir, "src"))) {
                  compilerOptions.paths = { "@/*": ["./src/*"] };
                  changed = true;
                }
              } catch {
              }
            }
          }
          if (changed) {
            parsed.compilerOptions = compilerOptions;
            fs4.writeFileSync(tsconfigPath, JSON.stringify(parsed, null, 2), "utf-8");
            console.log("[AutoFix] Fixed tsconfig.json paths (added baseUrl/paths)");
            return true;
          }
        } catch {
        }
        return false;
      }
      function installViteMissingDep(projectDir, errorMessage, pm2) {
        const depMatch = errorMessage.match(/Cannot find module '([^']+)'/i) || errorMessage.match(/Module not found.*Can't resolve '([^']+)'/i);
        if (!depMatch) return false;
        const raw = depMatch[1];
        if (raw.startsWith(".") || raw.startsWith("/")) return false;
        const depName = raw.startsWith("@") ? raw.split("/").slice(0, 2).join("/") : raw.split("/")[0];
        if (!depName) return false;
        try {
          const { execSync: es5 } = __require("child_process");
          const installCmd = pm2 === "pnpm" ? `npx pnpm add ${depName}` : pm2 === "yarn" ? `npx yarn add ${depName}` : `npm install --legacy-peer-deps ${depName}`;
          es5(installCmd, { cwd: projectDir, timeout: 6e4, stdio: "pipe", shell: true, windowsHide: true });
          console.log(`[AutoFix] Installed missing dependency: ${depName}`);
          return true;
        } catch {
        }
        return false;
      }
      function deleteViteFrameworkCache(projectDir) {
        const fs4 = __require("fs");
        const cacheDirs = [".next", ".nuxt", ".angular", "node_modules/.cache", "node_modules/.vite", ".svelte-kit", ".parcel-cache"];
        let deleted = false;
        for (const d of cacheDirs) {
          const dirPath = path.join(projectDir, d);
          if (fs4.existsSync(dirPath)) {
            try {
              fs4.rmSync(dirPath, { recursive: true, force: true });
              console.log(`[AutoFix] Deleted cache dir: ${d}`);
              deleted = true;
            } catch {
            }
          }
        }
        return deleted;
      }
      function fixViteCorsConfig(projectDir) {
        const fs4 = __require("fs");
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
          } catch {
          }
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
          } catch {
          }
        }
        return false;
      }
      function updateViteSpecificPackage(projectDir, errorMessage, pm2) {
        const fs4 = __require("fs");
        const pkgMatch = errorMessage.match(/ERR_PACKAGE_PATH_NOT_EXPORTED.*['"]([^'"]+)['"]/i) || errorMessage.match(/Package path .* is not exported.*package ['"]([^'"]+)['"]/i) || errorMessage.match(/Package subpath ['"]([^'"]+)['"] is not defined/i);
        if (!pkgMatch) return false;
        const pkgName = pkgMatch[1].startsWith("@") ? pkgMatch[1].split("/").slice(0, 2).join("/") : pkgMatch[1].split("/")[0];
        if (!pkgName || pkgName.startsWith(".")) return false;
        try {
          const { execSync: es5 } = __require("child_process");
          const installCmd = pm2 === "pnpm" ? `npx pnpm add ${pkgName}@latest` : pm2 === "yarn" ? `npx yarn add ${pkgName}@latest` : `npm install --legacy-peer-deps ${pkgName}@latest`;
          es5(installCmd, { cwd: projectDir, timeout: 6e4, stdio: "pipe", shell: true, windowsHide: true });
          console.log(`[AutoFix] Updated ${pkgName} to latest (ERR_PACKAGE_PATH_NOT_EXPORTED fix)`);
          return true;
        } catch {
        }
        return false;
      }
      function buildViteAutoFixEnv(baseEnv, outputStr) {
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
      async function attemptViteAutoFixStartup(projectDir, outputStr, pm2, safeEnv) {
        const fixes = [];
        const classified = classifyViteError(outputStr);
        const fs3 = await import("fs");
        const { execSync: es4 } = await import("child_process");
        if (/EINTEGRITY|sha512.*integrity|checksum failed/i.test(outputStr)) {
          try {
            es4("npm cache clean --force", { cwd: projectDir, timeout: 3e4, stdio: "pipe", shell: true, windowsHide: true });
            const lockFile = path.join(projectDir, "package-lock.json");
            if (fs3.existsSync(lockFile)) fs3.unlinkSync(lockFile);
            fixes.push("cache-clean");
            console.log("[AutoFix] Cleaned npm cache + deleted package-lock.json (integrity error)");
          } catch {
          }
        }
        if (/ENOSPC.*inotify|System limit for.*file watchers/i.test(outputStr)) {
          try {
            es4("sysctl -w fs.inotify.max_user_watches=524288 2>/dev/null || true", { timeout: 5e3, stdio: "pipe", shell: true });
            fixes.push("increase-watchers");
            console.log("[AutoFix] Increased inotify watchers");
          } catch {
          }
        }
        if (/EADDRINUSE.*:(\d+)/i.test(outputStr)) {
          const portMatch = outputStr.match(/EADDRINUSE.*:(\d+)/i);
          if (portMatch) {
            try {
              es4(`lsof -ti:${portMatch[1]} | xargs kill -9 2>/dev/null || true`, { timeout: 5e3, stdio: "pipe", shell: true });
              fixes.push("kill-port");
              console.log(`[AutoFix] Killed process on port ${portMatch[1]}`);
            } catch {
            }
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
            const pkgMap = { "react-scripts": "react-scripts", "next": "next", "nuxt": "nuxt", "ng": "@angular/cli" };
            const pkgName = pkgMap[cli];
            if (pkgName) {
              try {
                const installCmd = pm2 === "pnpm" ? `npx pnpm add ${pkgName}` : pm2 === "yarn" ? `npx yarn add ${pkgName}` : `npm install --legacy-peer-deps ${pkgName}`;
                es4(installCmd, { cwd: projectDir, timeout: 12e4, stdio: "pipe", shell: true, windowsHide: true, env: safeEnv });
                fixes.push(`install-cli-${cli}`);
                console.log(`[AutoFix] Installed missing CLI: ${pkgName}`);
              } catch {
              }
            }
          }
        }
        if (/Could not find a declaration file|TS2307.*Cannot find module/i.test(outputStr)) {
          const typeMatch = outputStr.match(/Could not find a declaration file for module '([^']+)'/);
          if (typeMatch) {
            const mod = typeMatch[1].startsWith("@") ? typeMatch[1].split("/").slice(0, 2).join("/") : typeMatch[1].split("/")[0];
            const typePkg = `@types/${mod.replace("@", "").replace("/", "__")}`;
            try {
              const installCmd = pm2 === "pnpm" ? `npx pnpm add -D ${typePkg}` : pm2 === "yarn" ? `npx yarn add -D ${typePkg}` : `npm install --save-dev --legacy-peer-deps ${typePkg}`;
              es4(installCmd, { cwd: projectDir, timeout: 6e4, stdio: "pipe", shell: true, windowsHide: true, env: safeEnv });
              fixes.push(`install-types-${mod}`);
              console.log(`[AutoFix] Installed type declarations: ${typePkg}`);
            } catch {
            }
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
            es4("npx ng update @angular/core @angular/cli --force 2>/dev/null || true", { cwd: projectDir, timeout: 12e4, stdio: "pipe", shell: true, windowsHide: true });
            fixes.push("angular-update");
            console.log("[AutoFix] Angular packages updated via ng update");
          } catch {
          }
        }
        if (/EMFILE|too many open files/i.test(outputStr)) {
          try {
            es4("ulimit -n 65536 2>/dev/null || true", { timeout: 5e3, stdio: "pipe", shell: true });
            fixes.push("increase-ulimit");
            console.log("[AutoFix] Attempted to increase file descriptor limit");
          } catch {
          }
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
            if (fs3.existsSync(nmDir)) {
              fs3.rmSync(nmDir, { recursive: true, force: true });
              fixes.push("delete-node_modules");
            }
            const installCmd = pm2 === "bun" ? "npx bun install" : pm2 === "pnpm" ? "npx pnpm install --no-frozen-lockfile" : pm2 === "yarn" ? "npx yarn install --ignore-engines" : "npm install --legacy-peer-deps";
            es4(installCmd, { cwd: projectDir, timeout: 18e4, stdio: "pipe", shell: true, windowsHide: true, env: safeEnv });
            fixes.push("full-reinstall");
            console.log("[AutoFix] Full reinstall completed");
          } catch {
            try {
              es4("npm install --legacy-peer-deps --force --ignore-scripts", { cwd: projectDir, timeout: 18e4, stdio: "pipe", shell: true, windowsHide: true, env: safeEnv });
              fixes.push("force-reinstall");
              console.log("[AutoFix] Force reinstall completed");
            } catch {
            }
          }
        }
        return { fixes, classified };
      }
      server.middlewares.use("/api/errors/report", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { message, stack, source, projectName: rawPN } = JSON.parse(await readBody(req));
          if (!message) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing error message" }));
            return;
          }
          const projectName = rawPN && typeof rawPN === "string" && /^[a-zA-Z0-9_\-. ]+$/.test(rawPN) && !rawPN.includes("..") ? rawPN : void 0;
          const classified = classifyViteError(message, stack);
          const errorEntry = {
            id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now(),
            source: source || "unknown",
            message: String(message).slice(0, 2e3),
            stack: stack ? String(stack).slice(0, 4e3) : void 0,
            projectName: projectName || void 0,
            classified,
            recovery: null
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
                  recovery = { attempted: true, success: true, detail: "Preview terminated \u2014 will restart on next request" };
                  console.log(`[AutoFix] Killed preview ${projectName} for restart`);
                } catch (e) {
                  const em = e instanceof Error ? e.message : String(e);
                  recovery = { attempted: true, success: false, detail: `Kill failed: ${em}` };
                }
              }
            } else if (classified.strategy === "clear-cache-restart" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              try {
                clearViteFrameworkCaches(projDir);
                const previewEntry = previewProcesses.get(projectName);
                if (previewEntry) {
                  previewEntry.process.kill("SIGTERM");
                  previewProcesses.delete(projectName);
                }
                recovery = { attempted: true, success: true, detail: "Caches cleared + preview terminated" };
                console.log(`[AutoFix] Cleared caches for ${projectName}`);
                scheduleViteAutoRestart(projectName, projDir, String(previewEntry?.port || 0));
              } catch (e) {
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
                  const installCmd4 = pm3 === "bun" ? "npx bun install" : pm3 === "pnpm" ? "npx pnpm install --no-frozen-lockfile" : pm3 === "yarn" ? "npx yarn install --ignore-engines" : "npm install --legacy-peer-deps";
                  exec2(installCmd4, { cwd: projDir, timeout: 12e4, stdio: "pipe", shell: true });
                }
                recovery = { attempted: true, success: true, detail: targeted ? "Missing dependency installed" : "Dependencies reinstalled (install-missing-dep fallback)" };
              } catch (e) {
                const em = e instanceof Error ? e.message : String(e);
                recovery = { attempted: true, success: false, detail: `Dependency install failed: ${em.slice(0, 200)}` };
              }
            } else if (classified.strategy === "delete-framework-cache" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              deleteViteFrameworkCache(projDir);
              const previewEntry = previewProcesses.get(projectName);
              if (previewEntry) {
                try {
                  previewEntry.process.kill("SIGTERM");
                } catch {
                }
                previewProcesses.delete(projectName);
              }
              recovery = { attempted: true, success: true, detail: "Framework cache deleted + preview killed for restart" };
              scheduleViteAutoRestart(projectName, projDir, String(previewEntry?.port || 0));
            } else if ((classified.strategy === "npm-install" || classified.strategy === "legacy-peer-deps" || classified.strategy === "full-reinstall" || classified.strategy === "cache-clean-reinstall" || classified.strategy === "full-install-retry" || classified.strategy === "install-missing-cli" || classified.strategy === "install-types") && projectName) {
              const { execSync: exec2 } = await import("child_process");
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              try {
                if (classified.strategy === "cache-clean-reinstall") {
                  try {
                    exec2("npm cache clean --force", { cwd: projDir, timeout: 3e4, stdio: "pipe", shell: true });
                  } catch {
                  }
                  const fs2 = await import("fs");
                  const lockFile = path.join(projDir, "package-lock.json");
                  if (fs2.existsSync(lockFile)) fs2.unlinkSync(lockFile);
                }
                console.log(`[AutoFix] Installing deps for ${projectName} (${classified.strategy})...`);
                const pm3 = detectPmForDir(projDir);
                const installCmd4 = pm3 === "bun" ? "npx bun install" : pm3 === "pnpm" ? "npx pnpm install --no-frozen-lockfile" : pm3 === "yarn" ? "npx yarn install --ignore-engines" : "npm install --legacy-peer-deps";
                exec2(installCmd4, { cwd: projDir, timeout: 12e4, stdio: "pipe", shell: true });
                recovery = { attempted: true, success: true, detail: `Dependencies reinstalled (${classified.strategy})` };
              } catch (e) {
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
                  const installCmd4 = pm3 === "bun" ? "npx bun install" : pm3 === "pnpm" ? "npx pnpm install --no-frozen-lockfile" : pm3 === "yarn" ? "npx yarn install --ignore-engines" : "npm install --legacy-peer-deps";
                  exec2(installCmd4, { cwd: projDir, timeout: 12e4, stdio: "pipe", shell: true });
                }
                recovery = { attempted: true, success: true, detail: targeted ? "Updated offending package to latest" : "Dependencies reinstalled (update-package fallback)" };
              } catch (e) {
                const em = e instanceof Error ? e.message : String(e);
                recovery = { attempted: true, success: false, detail: `Package update failed: ${em.slice(0, 200)}` };
              }
            } else if (classified.strategy === "fix-postcss-config" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              fixVitePostcssConfig(projDir);
              const previewEntry = previewProcesses.get(projectName);
              if (previewEntry) {
                try {
                  previewEntry.process.kill("SIGTERM");
                } catch {
                }
                previewProcesses.delete(projectName);
              }
              recovery = { attempted: true, success: true, detail: "PostCSS config fixed" };
              scheduleViteAutoRestart(projectName, projDir, String(previewEntry?.port || 0));
            } else if (classified.strategy === "fix-tsconfig" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              fixViteTsconfigJson(projDir);
              recovery = { attempted: true, success: true, detail: "tsconfig.json fixed" };
            } else if (classified.strategy === "copy-env-example" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              const copied = copyViteEnvExample(projDir);
              recovery = { attempted: true, success: copied, detail: copied ? "Copied .env.example \u2192 .env" : "No .env example found" };
            } else if (classified.strategy === "kill-port") {
              const portMatch = message.match(/EADDRINUSE.*:(\d+)/i);
              if (portMatch) {
                try {
                  const { execSync: exec2 } = await import("child_process");
                  exec2(`lsof -ti:${portMatch[1]} | xargs kill -9 2>/dev/null || true`, { timeout: 5e3, stdio: "pipe", shell: true });
                  recovery = { attempted: true, success: true, detail: `Killed process on port ${portMatch[1]}` };
                } catch {
                  recovery = { attempted: true, success: false, detail: "Failed to kill port" };
                }
              }
            } else if (classified.strategy === "vite-force" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              clearViteFrameworkCaches(projDir);
              const previewEntry = previewProcesses.get(projectName);
              if (previewEntry) {
                try {
                  previewEntry.process.kill("SIGTERM");
                } catch {
                }
                previewProcesses.delete(projectName);
              }
              recovery = { attempted: true, success: true, detail: "Cleared Vite cache + preview killed for --force restart" };
              scheduleViteAutoRestart(projectName, projDir, String(previewEntry?.port || 0));
            } else if (classified.strategy === "fix-tsconfig-paths" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              fixViteTsconfigPaths(projDir);
              const previewEntry = previewProcesses.get(projectName);
              if (previewEntry) {
                try {
                  previewEntry.process.kill("SIGTERM");
                } catch {
                }
                previewProcesses.delete(projectName);
              }
              recovery = { attempted: true, success: true, detail: "tsconfig.json paths fixed + preview killed for restart" };
              scheduleViteAutoRestart(projectName, projDir, String(previewEntry?.port || 0));
            } else if (classified.strategy === "extend-timeout") {
              recovery = { attempted: true, success: true, detail: "Startup timeout extended \u2014 waiting longer for dev server" };
            } else if (classified.strategy === "upgrade-node-warning") {
              let nodeVer = "unknown";
              try {
                const { execSync: exec5 } = await import("child_process");
                nodeVer = exec5("node --version", { timeout: 5e3, stdio: "pipe", encoding: "utf-8" }).toString().trim();
              } catch {
              }
              recovery = { attempted: true, success: false, detail: `Node.js version mismatch: current ${nodeVer} does not support modern syntax (optional chaining, nullish coalescing, etc.). Please upgrade Node.js to v14+ (v18+ recommended).` };
            } else if (classified.strategy === "cors-config") {
              if (projectName) {
                const projDir = path.resolve(process.cwd(), "projects", projectName);
                const fixed = fixViteCorsConfig(projDir);
                if (fixed) {
                  const previewEntry = previewProcesses.get(projectName);
                  if (previewEntry) {
                    try {
                      previewEntry.process.kill("SIGTERM");
                    } catch {
                    }
                    previewProcesses.delete(projectName);
                  }
                  recovery = { attempted: true, success: true, detail: "CORS config patched + preview killed for restart" };
                  scheduleViteAutoRestart(projectName, projDir, String(previewEntry?.port || 0));
                } else {
                  recovery = { attempted: true, success: false, detail: "CORS error detected \u2014 could not auto-patch. Add cors:true to vite server config or CORS middleware to Express app." };
                }
              } else {
                recovery = { attempted: false, success: false, detail: "CORS error detected \u2014 no project context for auto-fix." };
              }
            } else if (classified.strategy === "increase-ulimit") {
              try {
                const { execSync: exec5 } = await import("child_process");
                exec5("ulimit -n 65536 2>/dev/null || true", { timeout: 5e3, stdio: "pipe", shell: true });
              } catch {
              }
              const previewEntry = previewProcesses.get(projectName || "");
              if (previewEntry) {
                try {
                  previewEntry.process.kill("SIGTERM");
                } catch {
                }
                previewProcesses.delete(projectName || "");
              }
              recovery = { attempted: true, success: true, detail: "Increased file descriptor limit + preview killed for restart" };
              if (projectName) scheduleViteAutoRestart(projectName, path.resolve(process.cwd(), "projects", projectName), String(previewEntry?.port || 0));
            } else if (classified.strategy === "increase-watchers") {
              try {
                const { execSync: exec5 } = await import("child_process");
                exec5("sysctl -w fs.inotify.max_user_watches=524288 2>/dev/null || true", { timeout: 5e3, stdio: "pipe", shell: true });
              } catch {
              }
              const previewEntry = previewProcesses.get(projectName || "");
              if (previewEntry) {
                try {
                  previewEntry.process.kill("SIGTERM");
                } catch {
                }
                previewProcesses.delete(projectName || "");
              }
              recovery = { attempted: true, success: true, detail: "Increased inotify watchers + preview killed for restart" };
              if (projectName) scheduleViteAutoRestart(projectName, path.resolve(process.cwd(), "projects", projectName), String(previewEntry?.port || 0));
            } else if (classified.strategy === "add-type-module" && projectName) {
              const fs2 = await import("fs");
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              const pkgJsonPath = path.join(projDir, "package.json");
              try {
                if (fs2.existsSync(pkgJsonPath)) {
                  const pObj = JSON.parse(fs2.readFileSync(pkgJsonPath, "utf-8"));
                  if (pObj.type !== "module") {
                    pObj.type = "module";
                    fs2.writeFileSync(pkgJsonPath, JSON.stringify(pObj, null, 2), "utf-8");
                  }
                  recovery = { attempted: true, success: true, detail: "Added type:module to package.json" };
                }
              } catch {
                recovery = { attempted: true, success: false, detail: "Failed to add type:module" };
              }
            } else if (classified.strategy === "angular-update" && projectName) {
              const projDir = path.resolve(process.cwd(), "projects", projectName);
              try {
                const { execSync: exec6 } = await import("child_process");
                exec6("npx ng update @angular/core @angular/cli --force 2>/dev/null || true", { cwd: projDir, timeout: 12e4, stdio: "pipe", shell: true, windowsHide: true });
                recovery = { attempted: true, success: true, detail: "Angular packages updated via ng update" };
              } catch {
                recovery = { attempted: true, success: false, detail: "Angular update failed \u2014 try manual ng update" };
              }
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
                  let fixedContent = null;
                  if (classified.category === "reference-error" && classified.symbol) {
                    const sym = classified.symbol;
                    if (!originalContent.includes("import") || !originalContent.includes(sym)) {
                      const fromMatch = originalContent.match(/from\s+['"]([^'"]+)['"]/);
                      if (fromMatch) {
                        fixedContent = `import { ${sym} } from '${fromMatch[1]}';
${originalContent}`;
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
                        const prompt2 = `Fix this ${classified.category} error in file "${classified.file}":

Error: ${message}
${classified.line ? `Line: ${classified.line}` : ""}${classified.symbol ? `
Symbol: ${classified.symbol}` : ""}

Current file content:
\`\`\`
${originalContent.slice(0, 6e3)}
\`\`\`

Respond with ONLY the fixed file content, no explanation. If you cannot fix it, respond with exactly "CANNOT_FIX".`;
                        const grokResp2 = await fetch("https://api.x.ai/v1/chat/completions", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${settings2.grokApiKey}` },
                          body: JSON.stringify({ model: "grok-3-mini", messages: [{ role: "user", content: prompt2 }], max_tokens: 8e3 })
                        });
                        if (grokResp2.ok) {
                          const grokData2 = await grokResp2.json();
                          const fixedRaw2 = grokData2.choices?.[0]?.message?.content || "";
                          if (!fixedRaw2.includes("CANNOT_FIX") && fixedRaw2.trim()) {
                            const cbMatch = fixedRaw2.match(/```(?:\w+)?\n([\s\S]+?)```/);
                            fixedContent = cbMatch ? cbMatch[1].trim() : fixedRaw2.trim();
                            console.log(`[AutoFix] Grok provided fix for ${classified.file}`);
                          }
                        }
                      }
                    } catch {
                    }
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
                      console.log(`[AutoFix] Fix validation failed \u2014 reverting ${classified.file}`);
                      fs2.writeFileSync(filePath, originalContent, "utf-8");
                      recovery = { attempted: true, success: false, detail: `Fix applied but failed validation \u2014 reverted ${classified.file}` };
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
              } catch (e) {
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
        } catch (err) {
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
        const autoFixed = viteErrorHistory.filter((e) => e.recovery?.success).length;
        const escalated = viteErrorHistory.filter((e) => e.classified?.strategy === "escalate").length;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ errors: recent, stats: { total, autoFixed, escalated } }));
      });
      server.middlewares.use("/api/grok-fix", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { filePath: fp, content, errorMessage, category, line, symbol } = JSON.parse(await readBody(req));
          if (!fp || !content || !errorMessage) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing required fields" }));
            return;
          }
          const fs2 = await import("fs");
          const settingsPath = path.resolve(process.env.HOME || "~", ".guardian-ai", "settings.json");
          let grokApiKey;
          try {
            const settings = JSON.parse(fs2.readFileSync(settingsPath, "utf-8"));
            grokApiKey = settings.grokApiKey;
          } catch {
          }
          if (!grokApiKey) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Grok API key not configured" }));
            return;
          }
          const prompt = `Fix this ${category || "unknown"} error in file "${fp}":

Error: ${errorMessage}
${line ? `Line: ${line}` : ""}${symbol ? `
Symbol: ${symbol}` : ""}

Current file content:
\`\`\`
${String(content).slice(0, 6e3)}
\`\`\`

Respond with ONLY the fixed file content, no explanation. If you cannot fix it, respond with exactly "CANNOT_FIX".`;
          const grokResp = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${grokApiKey}` },
            body: JSON.stringify({ model: "grok-3-mini", messages: [{ role: "user", content: prompt }], max_tokens: 8e3 })
          });
          if (!grokResp.ok) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "Grok API error" }));
            return;
          }
          const grokData = await grokResp.json();
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
        } catch (err) {
          res.statusCode = 500;
          const em = err instanceof Error ? err.message : String(err);
          res.end(JSON.stringify({ error: em }));
        }
      });
      server.middlewares.use("/api/validate-file", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { filePath: fp } = JSON.parse(await readBody(req));
          if (!fp) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing filePath" }));
            return;
          }
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
            } catch (e) {
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
        } catch (err) {
          res.statusCode = 500;
          const em = err instanceof Error ? err.message : String(err);
          res.end(JSON.stringify({ error: em }));
        }
      });
      server.middlewares.use("/api/projects/install-deps", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name, dependencies, devDependencies, fullInstall } = JSON.parse(await readBody(req));
          if (!name || /[\/\\]|\.\./.test(name)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Invalid project name" }));
            return;
          }
          const fs = await import("fs");
          const projectDir = path.resolve(process.cwd(), "projects", name);
          if (!fs.existsSync(projectDir)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Project not found" }));
            return;
          }
          const pkgJsonPath = path.join(projectDir, "package.json");
          let pkgJsonValid = false;
          if (fs.existsSync(pkgJsonPath)) {
            try {
              JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
              pkgJsonValid = true;
            } catch {
            }
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
            const installCmd = pm === "bun" ? "npx bun install" : pm === "pnpm" ? "npx pnpm install" : pm === "yarn" ? "npx yarn install" : "npm install --legacy-peer-deps";
            console.log(`[Deps] Running full install: ${installCmd} in ${name}`);
            if (!fs.existsSync(path.join(projectDir, ".git"))) {
              try {
                fs.mkdirSync(path.join(projectDir, ".git"), { recursive: true });
              } catch {
              }
            }
            const { exec: execFull } = await import("child_process");
            return execFull(installCmd, { cwd: projectDir, timeout: 18e4, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: depsInstallEnv }, (err, _stdout, stderr) => {
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
          const results = [];
          const { exec: execAsync } = await import("child_process");
          const validPkg = /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+(@[^\s]*)?$/;
          const notAPkg = /* @__PURE__ */ new Set(["npm", "npx", "yarn", "pnpm", "bun", "node", "deno", "run", "dev", "start", "build", "test", "serve", "watch", "lint", "deploy", "preview", "install", "add", "remove", "uninstall", "update", "init", "create", "cd", "ls", "mkdir", "rm", "cp", "mv", "cat", "echo", "touch", "git", "curl", "wget", "then", "and", "or", "the", "a", "an", "to", "in", "of", "for", "with", "from", "your", "this", "that", "it", "is", "are", "was", "be", "has", "have", "do", "does", "if", "not", "no", "yes", "on", "off", "up", "so", "but", "by", "at", "as", "server", "app", "application", "project", "file", "directory", "folder", "next", "first", "following", "above", "below", "after", "before", "all", "any", "each", "every", "both", "new", "old"]);
          const filterPkgs = (arr) => (arr || []).filter((d) => {
            if (!validPkg.test(d) || /[;&|`$(){}]/.test(d)) return false;
            const base = d.replace(/@[^\s]*$/, "").toLowerCase();
            return !notAPkg.has(base) && (base.length > 1 || d.startsWith("@"));
          });
          const safeDeps = filterPkgs(dependencies || []);
          const safeDevDeps = filterPkgs(devDependencies || []);
          const buildInstallCmd = (pkgs, isDev) => {
            const pkgStr = pkgs.join(" ");
            switch (pm) {
              case "bun":
                return `npx bun add${isDev ? " -d" : ""} ${pkgStr}`;
              case "pnpm":
                return `npx pnpm add${isDev ? " -D" : ""} ${pkgStr}`;
              case "yarn":
                return `npx yarn add${isDev ? " -D" : ""} ${pkgStr}`;
              default:
                return `npm install --legacy-peer-deps${isDev ? " --save-dev" : ""} ${pkgStr}`;
            }
          };
          if (!fs.existsSync(path.join(projectDir, ".git"))) {
            try {
              fs.mkdirSync(path.join(projectDir, ".git"), { recursive: true });
            } catch {
            }
          }
          const errors = [];
          const runInstall = (pkgs, isDev) => new Promise((resolve) => {
            const cmd = buildInstallCmd(pkgs, isDev);
            console.log(`[Deps] Running: ${cmd} in ${name}`);
            execAsync(cmd, { cwd: projectDir, timeout: 12e4, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: depsInstallEnv }, (err, _stdout, stderr) => {
              if (err) {
                console.error(`[Deps] Failed: ${cmd}`, stderr?.slice(0, 300) || err.message?.slice(0, 300));
                const fallbackCmd = pm !== "npm" ? `npm install --legacy-peer-deps${isDev ? " --save-dev" : ""} ${pkgs.join(" ")}` : `${cmd} --ignore-scripts`;
                console.log(`[Deps] Retrying: ${fallbackCmd}`);
                execAsync(fallbackCmd, { cwd: projectDir, timeout: 12e4, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: depsInstallEnv }, (err2) => {
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
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/run-command", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name, command } = JSON.parse(await readBody(req));
          if (!command || typeof command !== "string") {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "No command specified" }));
            return;
          }
          const check = validateProjectPath(name || "");
          if (!check.valid) {
            res.statusCode = 403;
            res.end(JSON.stringify({ success: false, error: check.error }));
            return;
          }
          const allowedPrefixes = [
            "npm ",
            "npx ",
            "yarn ",
            "pnpm ",
            "bun ",
            "node ",
            "deno ",
            "tsc",
            "tsx ",
            "corepack ",
            "nvm ",
            "fnm ",
            "mkdir ",
            "cp ",
            "mv ",
            "rm ",
            "touch ",
            "cat ",
            "ls ",
            "pwd",
            "chmod ",
            "chown ",
            "ln ",
            "git ",
            "curl ",
            "wget ",
            "python",
            "pip",
            "cargo ",
            "go ",
            "rustc",
            "gcc",
            "g++",
            "make",
            "docker ",
            "docker-compose "
          ];
          const trimmed = command.trim().replace(/\s+#\s+.*$/, "").trim();
          if (/[\r\n\x00]/.test(trimmed)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: "Control characters not allowed in commands" }));
            return;
          }
          if (/^curl-install:https?:\/\//i.test(trimmed)) {
            const scriptUrl = trimmed.replace(/^curl-install:/i, "");
            try {
              const fs2 = await import("fs");
              const projectDir2 = check.resolved;
              if (!fs2.existsSync(projectDir2)) {
                res.statusCode = 404;
                res.end(JSON.stringify({ success: false, error: "Project not found" }));
                return;
              }
              const { exec: execAsync2 } = await import("child_process");
              const os2 = await import("os");
              const isWin2 = os2.platform() === "win32";
              const WIN_NPM_ALTERNATIVES = {
                "bun.sh/install": "npm install -g bun",
                "get.pnpm.io/install.sh": "npm install -g pnpm",
                "install.python-poetry.org": "pip install poetry",
                "rustup.rs": "winget install Rustlang.Rustup",
                "deno.land/install.sh": "npm install -g deno"
              };
              if (isWin2) {
                const winAlt = Object.entries(WIN_NPM_ALTERNATIVES).find(([k]) => scriptUrl.includes(k));
                if (winAlt) {
                  const altCmd = winAlt[1];
                  await new Promise((resolve) => {
                    execAsync2(altCmd, { cwd: projectDir2, timeout: 12e4, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
                      res.setHeader("Content-Type", "application/json");
                      if (err) {
                        res.end(JSON.stringify({ success: false, error: `${err.message?.slice(0, 400)} (ran: ${altCmd})`, output: (stdout || "").slice(0, 4e3), stderr: (stderr || "").slice(0, 2e3) }));
                      } else {
                        res.end(JSON.stringify({ success: true, output: `Windows alternative: ${altCmd}
${(stdout || "").slice(0, 4e3)}` }));
                      }
                      resolve();
                    });
                  });
                  return;
                }
                const ps1Url = scriptUrl.replace(/\.sh$/, ".ps1");
                let usePsScript = false;
                try {
                  const head = await fetch(ps1Url, { method: "HEAD" });
                  usePsScript = head.ok;
                } catch {
                }
                if (usePsScript) {
                  const psCmd = `irm ${ps1Url} | iex`;
                  const encodedCmd = Buffer.from(psCmd, "utf16le").toString("base64");
                  await new Promise((resolve) => {
                    execAsync2(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCmd}`, { cwd: projectDir2, timeout: 12e4, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
                      res.setHeader("Content-Type", "application/json");
                      if (err) {
                        res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: (stdout || "").slice(0, 4e3), stderr: (stderr || "").slice(0, 2e3) }));
                      } else {
                        res.end(JSON.stringify({ success: true, output: (stdout || "").slice(0, 4e3) }));
                      }
                      resolve();
                    });
                  });
                  return;
                }
              }
              const resp = await fetch(scriptUrl);
              if (!resp.ok) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: `Failed to download script: ${resp.status} ${resp.statusText}` }));
                return;
              }
              const script = await resp.text();
              const tmpScript = path.join(os2.tmpdir(), `install-${Date.now()}.sh`);
              fs2.writeFileSync(tmpScript, script, { mode: 493 });
              await new Promise((resolve) => {
                execAsync2(`bash "${tmpScript}"`, { cwd: projectDir2, timeout: 12e4, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: { ...process.env, BUN_INSTALL: projectDir2, CARGO_HOME: projectDir2, RUSTUP_HOME: projectDir2 } }, (err, stdout, stderr) => {
                  try {
                    fs2.unlinkSync(tmpScript);
                  } catch {
                  }
                  res.setHeader("Content-Type", "application/json");
                  if (err) {
                    res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: (stdout || "").slice(0, 4e3), stderr: (stderr || "").slice(0, 2e3) }));
                  } else {
                    res.end(JSON.stringify({ success: true, output: (stdout || "").slice(0, 4e3) }));
                  }
                  resolve();
                });
              });
            } catch (err) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
          }
          const devServerRe = /^(?:npm\s+(?:run\s+)?(?:dev|start)|yarn\s+(?:dev|start)|pnpm\s+(?:dev|start)|bun\s+(?:dev|start)|npx\s+vite(?:\s|$))/i;
          if (devServerRe.test(trimmed)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Dev server commands should use the Preview button instead" }));
            return;
          }
          const isAllowed = allowedPrefixes.some((p) => trimmed.startsWith(p)) || trimmed === "npm install" || trimmed === "corepack enable";
          if (!isAllowed) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: `Command not allowed: ${trimmed.slice(0, 50)}` }));
            return;
          }
          if (/[;&|`$(){}]/.test(trimmed)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: "Shell metacharacters not allowed" }));
            return;
          }
          if (/\.\.[\/\\]/.test(trimmed)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: "Path traversal not allowed" }));
            return;
          }
          const fs = await import("fs");
          const projectDir = check.resolved;
          if (!fs.existsSync(projectDir)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: `Project directory not found: ${projectDir}` }));
            return;
          }
          const { exec: execAsync } = await import("child_process");
          const os = await import("os");
          const isWin = os.platform() === "win32";
          let actualCmd = trimmed === "npm install" ? "npm install --legacy-peer-deps" : trimmed;
          const isInstallCmd = /^(npm\s+install|npm\s+i\b|yarn\s*(install)?$|pnpm\s+install|bun\s+install|npx\s+(pnpm|yarn|bun)\s+install)/i.test(trimmed);
          if (isInstallCmd) {
            const gitDir = path.join(projectDir, ".git");
            if (!fs.existsSync(gitDir)) {
              try {
                fs.mkdirSync(gitDir, { recursive: true });
              } catch {
              }
            }
          }
          const nodeHandled = await (async () => {
            if (/^rm\s+(-rf?\s+)?/i.test(actualCmd)) {
              const targets = actualCmd.replace(/^rm\s+(-rf?\s+)?/i, "").trim().split(/\s+/);
              const results = [];
              for (const t of targets) {
                const targetPath = path.resolve(projectDir, t);
                if (!targetPath.startsWith(projectDir)) {
                  results.push(`Skipped (outside project): ${t}`);
                  continue;
                }
                try {
                  fs.rmSync(targetPath, { recursive: true, force: true });
                  results.push(`Removed: ${t}`);
                } catch (e) {
                  results.push(`Failed to remove ${t}: ${e.message}`);
                }
              }
              return { success: true, output: results.join("\n") };
            }
            if (/^mkdir\s+(-p\s+)?/i.test(actualCmd)) {
              const dir = actualCmd.replace(/^mkdir\s+(-p\s+)?/i, "").trim();
              const dirPath = path.resolve(projectDir, dir);
              if (!dirPath.startsWith(projectDir)) return { success: false, error: "Path outside project" };
              try {
                fs.mkdirSync(dirPath, { recursive: true });
                return { success: true, output: `Created: ${dir}` };
              } catch (e) {
                return { success: false, error: e.message };
              }
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
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
            if (/^cat\s/i.test(actualCmd)) {
              const file = actualCmd.replace(/^cat\s+/i, "").trim();
              const filePath = path.resolve(projectDir, file);
              if (!filePath.startsWith(projectDir)) return { success: false, error: "Path outside project" };
              try {
                return { success: true, output: fs.readFileSync(filePath, "utf-8").slice(0, 4e3) };
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
            if (/^cp\s/i.test(actualCmd)) {
              const args = actualCmd.replace(/^cp\s+(-r\s+)?/i, "").trim().split(/\s+/);
              if (args.length >= 2) {
                const src = path.resolve(projectDir, args[0]);
                const dest = path.resolve(projectDir, args[1]);
                if (!src.startsWith(projectDir) || !dest.startsWith(projectDir)) return { success: false, error: "Path outside project" };
                try {
                  fs.cpSync(src, dest, { recursive: true, force: true });
                  return { success: true, output: `Copied: ${args[0]} \u2192 ${args[1]}` };
                } catch (e) {
                  return { success: false, error: e.message };
                }
              }
            }
            if (/^mv\s/i.test(actualCmd)) {
              const args = actualCmd.replace(/^mv\s+/i, "").trim().split(/\s+/);
              if (args.length >= 2) {
                const src = path.resolve(projectDir, args[0]);
                const dest = path.resolve(projectDir, args[1]);
                if (!src.startsWith(projectDir) || !dest.startsWith(projectDir)) return { success: false, error: "Path outside project" };
                try {
                  fs.renameSync(src, dest);
                  return { success: true, output: `Moved: ${args[0]} \u2192 ${args[1]}` };
                } catch (e) {
                  return { success: false, error: e.message };
                }
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
          const cmdEnv = isInstallCmd ? { ...process.env, HUSKY: "0", npm_config_ignore_scripts: "", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" } : void 0;
          const cmdTimeout = isInstallCmd ? 18e4 : 6e4;
          await new Promise((resolve) => {
            execAsync(actualCmd, { cwd: projectDir, timeout: cmdTimeout, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, ...cmdEnv ? { env: cmdEnv } : {} }, (err, stdout, stderr) => {
              if (err && isInstallCmd) {
                console.log(`[RunCmd] Install failed, retrying with --ignore-scripts: ${err.message?.slice(0, 200)}`);
                const retryCmd = actualCmd.includes("--ignore-scripts") ? actualCmd + " --force" : actualCmd + " --ignore-scripts";
                execAsync(retryCmd, { cwd: projectDir, timeout: cmdTimeout, shell: true, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: cmdEnv }, (retryErr, retryStdout, retryStderr) => {
                  res.setHeader("Content-Type", "application/json");
                  if (retryErr) {
                    res.end(JSON.stringify({ success: false, error: retryErr.message?.slice(0, 500), output: (retryStdout || "").slice(0, 4e3), stderr: (retryStderr || "").slice(0, 2e3), retried: true }));
                  } else {
                    res.end(JSON.stringify({ success: true, output: (retryStdout || "").slice(0, 4e3), retried: true, note: "Installed with --ignore-scripts (some post-install steps were skipped)" }));
                  }
                  resolve();
                });
                return;
              }
              res.setHeader("Content-Type", "application/json");
              if (err) {
                res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: (stdout || "").slice(0, 4e3), stderr: (stderr || "").slice(0, 2e3) }));
              } else {
                res.end(JSON.stringify({ success: true, output: (stdout || "").slice(0, 4e3) }));
              }
              resolve();
            });
          });
        } catch (err) {
          const stderr = err.stderr ? String(err.stderr).slice(0, 2e3) : "";
          const stdout = err.stdout ? String(err.stdout).slice(0, 2e3) : "";
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message?.slice(0, 500), output: stdout, stderr }));
        }
      });
      server.middlewares.use("/api/programs/install", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          let tryExec = function(cmd, timeout = 1e4) {
            try {
              execSync(cmd, { timeout, stdio: "pipe", shell: true, windowsHide: true });
              return true;
            } catch {
              return false;
            }
          };
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
          const programInstallMap = {
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
            "bun": { check: "bun --version", winCmds: ['powershell -c "irm bun.sh/install.ps1|iex"', "scoop install bun"], macCmds: ["curl -fsSL https://bun.sh/install | bash"], linuxCmds: ["curl -fsSL https://bun.sh/install | bash"], label: "Bun" },
            "ruby": { check: "ruby --version", winCmds: ["winget install -e --id RubyInstallerTeam.Ruby.3.2 --accept-source-agreements --accept-package-agreements", "scoop install ruby", "choco install ruby -y"], macCmds: ["brew install ruby"], linuxCmds: ["sudo apt-get install -y ruby"], label: "Ruby" },
            "php": { check: "php --version", winCmds: ["scoop install php", "choco install php -y"], macCmds: ["brew install php"], linuxCmds: ["sudo apt-get install -y php"], label: "PHP" }
          };
          const results = [];
          for (const prog of programs) {
            const key = prog.toLowerCase().replace(/[^a-z0-9.+]/g, "");
            const mapping = programInstallMap[key];
            if (!mapping) {
              results.push({ program: prog, label: prog, alreadyInstalled: false, installed: false, error: `Unknown program: ${prog}` });
              continue;
            }
            let alreadyInstalled = tryExec(mapping.check);
            if (!alreadyInstalled && mapping.altChecks) {
              alreadyInstalled = mapping.altChecks.some((c) => tryExec(c));
            }
            if (!alreadyInstalled) {
              const whichCmd = isWin ? `where ${key}` : `which ${key}`;
              alreadyInstalled = tryExec(whichCmd, 5e3);
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
                execSync(cmd, { timeout: 18e4, stdio: "pipe", shell: true, windowsHide: true });
                installed = true;
                usedCmd = cmd;
                break;
              } catch (err) {
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
          const allOk = results.every((r) => r.installed || r.alreadyInstalled);
          res.end(JSON.stringify({ success: allOk, results }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/import-github", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { owner, repo, targetProject } = JSON.parse(await readBody(req));
          if (!owner || !repo || /[\/\\]|\.\./.test(owner) || /[\/\\]|\.\./.test(repo)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Invalid owner or repo" }));
            return;
          }
          if (targetProject && /[\/\\]|\.\./.test(targetProject)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Invalid target project name" }));
            return;
          }
          const fs = await import("fs");
          const { execSync } = await import("child_process");
          const os = await import("os");
          const projectsDir = path.resolve(process.cwd(), "projects");
          if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });
          const projectName = targetProject || repo.toLowerCase().replace(/[^a-z0-9-]/g, "-");
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
            } catch (rmErr) {
              console.log(`[Import] Full rm failed (${rmErr.message?.slice(0, 100)}), clearing contents instead`);
              try {
                const existingFiles = fs.readdirSync(projectDir);
                for (const f of existingFiles) {
                  try {
                    fs.rmSync(path.join(projectDir, f), { recursive: true, force: true });
                  } catch {
                  }
                }
              } catch {
              }
            }
            console.log(`[Import] Cleared existing project '${projectName}' for clone into`);
          }
          const ghToken = process.env.GITHUB_TOKEN || "";
          const headers = { "User-Agent": "Lamby" };
          if (ghToken) headers["Authorization"] = `token ${ghToken}`;
          let defaultBranch = "main";
          let apiAvailable = false;
          try {
            const infoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { ...headers, "Accept": "application/vnd.github.v3+json" } });
            if (infoResp.ok) {
              const repoInfo = await infoResp.json();
              defaultBranch = repoInfo.default_branch || "main";
              apiAvailable = true;
            } else {
              console.log(`[Import] GitHub API returned ${infoResp.status} for ${owner}/${repo}, will try git clone directly`);
            }
          } catch (apiErr) {
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
                execSync(`tar xzf "${tarPath.replace(/\\/g, "/")}" --strip-components=1 -C "${projectDir.replace(/\\/g, "/")}"`, { timeout: 6e4, stdio: "pipe", windowsHide: true });
              } else {
                execSync(`tar xzf "${tarPath}" --strip-components=1 -C "${projectDir}"`, { timeout: 6e4, stdio: "pipe", windowsHide: true });
              }
              console.log(`[Import] Extracted tarball to ${projectDir}`);
              tarballSuccess = true;
            } catch (tarErr) {
              console.log(`[Import] Tarball method failed for ${owner}/${repo}: ${tarErr.message?.slice(0, 200)}`);
              try {
                fs.rmSync(projectDir, { recursive: true, force: true });
              } catch {
              }
            }
            if (!tarballSuccess) {
              cloneMethod = "git-clone";
              console.log(`[Import] Falling back to git clone --depth 1 for ${owner}/${repo}...`);
              const cloneUrl = ghToken ? `https://x-access-token:${ghToken}@github.com/${owner}/${repo}.git` : `https://github.com/${owner}/${repo}.git`;
              const cloneTmp = path.join(tmpDir, "clone");
              try {
                execSync(`git clone --depth 1 --single-branch --branch "${defaultBranch}" "${cloneUrl}" "${cloneTmp}"`, { timeout: 12e4, stdio: "pipe", windowsHide: true });
              } catch (branchErr) {
                try {
                  execSync(`git clone --depth 1 "${cloneUrl}" "${cloneTmp}"`, { timeout: 12e4, stdio: "pipe", windowsHide: true });
                } catch (cloneErr) {
                  throw new Error(`Failed to clone repository: ${cloneErr.message?.slice(0, 200)}`);
                }
              }
              fs.mkdirSync(projectDir, { recursive: true });
              const cloneEntries = fs.readdirSync(cloneTmp);
              for (const entry of cloneEntries) {
                const src = path.join(cloneTmp, entry);
                const dest = path.join(projectDir, entry);
                try {
                  fs.cpSync(src, dest, { recursive: true, force: true });
                } catch {
                }
              }
              console.log(`[Import] Git clone completed for ${owner}/${repo}`);
            }
            const CLEANUP_PATTERNS = ["node_modules", ".git", ".next", ".nuxt", "dist", ".cache", ".turbo", ".vercel", ".output"];
            for (const pattern of CLEANUP_PATTERNS) {
              const cleanPath = path.join(projectDir, pattern);
              if (fs.existsSync(cleanPath)) {
                try {
                  fs.rmSync(cleanPath, { recursive: true, force: true });
                } catch {
                }
              }
            }
            const walkAndClean = (dir) => {
              try {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                  const full = path.join(dir, entry.name);
                  if (entry.isDirectory()) {
                    if (entry.name === "node_modules" || entry.name === ".git") {
                      try {
                        fs.rmSync(full, { recursive: true, force: true });
                      } catch {
                      }
                    } else {
                      walkAndClean(full);
                    }
                  } else if (entry.name === ".DS_Store") {
                    try {
                      fs.unlinkSync(full);
                    } catch {
                    }
                  }
                }
              } catch {
              }
            };
            walkAndClean(projectDir);
            let filesWritten = 0;
            const countFiles = (dir) => {
              try {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                  if (entry.isDirectory()) countFiles(path.join(dir, entry.name));
                  else filesWritten++;
                }
              } catch {
              }
            };
            countFiles(projectDir);
            let framework = "vanilla";
            const pkgPath = path.join(projectDir, "package.json");
            const detectFramework = (pkgJsonPath) => {
              try {
                const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
                const deps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
                if (deps["next"]) return "nextjs";
                if (deps["nuxt"] || deps["nuxt3"]) return "nuxt";
                if (deps["@angular/core"]) return "angular";
                if (deps["svelte"] || deps["@sveltejs/kit"]) return "svelte";
                if (deps["astro"]) return "astro";
                if (deps["vue"]) return "vue";
                if (deps["react"]) return "react";
              } catch {
              }
              return null;
            };
            if (fs.existsSync(pkgPath)) {
              framework = detectFramework(pkgPath) || "vanilla";
            } else {
              for (const sub of ["frontend", "client", "web", "app"]) {
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
              for (const sub of ["frontend", "client", "web", "app"]) {
                const subPkg = path.join(projectDir, sub, "package.json");
                if (fs.existsSync(subPkg)) {
                  effectiveInstallDir = path.join(projectDir, sub);
                  console.log(`[Import] No root package.json \u2014 using ${sub}/package.json for ${projectName}`);
                  break;
                }
              }
            }
            if (fs.existsSync(path.join(effectiveInstallDir, "package.json"))) {
              const detectPM = () => {
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
              } catch {
              }
              const installCmd = detectedPM === "pnpm" ? "npx pnpm install --no-frozen-lockfile --ignore-scripts" : detectedPM === "yarn" ? "npx yarn install --ignore-engines --ignore-scripts" : detectedPM === "bun" ? "npx bun install --ignore-scripts" : "npm install --legacy-peer-deps --ignore-scripts";
              const importInstallEnv = { ...process.env, HUSKY: "0", DISABLE_OPENCOLLECTIVE: "true", ADBLOCK: "1" };
              if (!fs.existsSync(path.join(effectiveInstallDir, ".git"))) {
                try {
                  fs.mkdirSync(path.join(effectiveInstallDir, ".git"), { recursive: true });
                } catch {
                }
              }
              console.log(`[Import] Installing deps in ${effectiveInstallDir === projectDir ? "root" : path.relative(projectDir, effectiveInstallDir) + "/"} for ${projectName} with: ${installCmd} (pm: ${detectedPM})`);
              try {
                execSync(installCmd, { cwd: effectiveInstallDir, timeout: 18e4, stdio: "pipe", shell: true, windowsHide: true, env: importInstallEnv });
                npmInstalled = true;
                console.log(`[Import] Deps installed for ${projectName}`);
              } catch (installErr) {
                installError = installErr.stderr?.toString().slice(-500) || installErr.message?.slice(0, 500) || "Unknown error";
                console.error(`[Import] Install failed for ${projectName} with ${detectedPM}:`, installError.slice(0, 300));
                if (detectedPM !== "npm") {
                  try {
                    console.log(`[Import] Retrying with npm for ${projectName}`);
                    execSync("npm install --legacy-peer-deps --ignore-scripts", { cwd: effectiveInstallDir, timeout: 18e4, stdio: "pipe", shell: true, windowsHide: true, env: importInstallEnv });
                    npmInstalled = true;
                    installError = "";
                    console.log(`[Import] Deps installed for ${projectName} (npm fallback)`);
                  } catch (retryErr) {
                    installError = retryErr.stderr?.toString().slice(-300) || retryErr.message?.slice(0, 300) || "Retry failed";
                  }
                }
              }
            }
            const COMMON_SUBDIRS = ["frontend", "client", "web", "app", "packages/app", "packages/client", "packages/web"];
            for (const subdir of COMMON_SUBDIRS) {
              const subPkgPath = path.join(projectDir, subdir, "package.json");
              if (fs.existsSync(subPkgPath) && !fs.existsSync(path.join(projectDir, subdir, "node_modules"))) {
                try {
                  console.log(`[Import] Installing deps in subdirectory ${subdir}/...`);
                  const subInstDir = path.join(projectDir, subdir);
                  if (!fs.existsSync(path.join(subInstDir, ".git"))) {
                    try {
                      fs.mkdirSync(path.join(subInstDir, ".git"), { recursive: true });
                    } catch {
                    }
                  }
                  execSync("npm install --legacy-peer-deps --ignore-scripts", { cwd: subInstDir, timeout: 12e4, stdio: "pipe", shell: true, windowsHide: true, env: { ...process.env, HUSKY: "0" } });
                  console.log(`[Import] Subdirectory ${subdir}/ deps installed`);
                } catch (subErr) {
                  console.log(`[Import] Subdirectory ${subdir}/ install failed (non-critical): ${subErr.message?.slice(0, 100)}`);
                }
              }
            }
            const metaPath = path.join(projectDir, ".lamby-meta.json");
            try {
              fs.writeFileSync(metaPath, JSON.stringify({ owner, repo, sourceUrl: `https://github.com/${owner}/${repo}`, clonedAt: (/* @__PURE__ */ new Date()).toISOString(), projectName }, null, 2));
              console.log(`[Import] Saved source metadata to .lamby-meta.json`);
            } catch {
            }
            let releaseAssets = [];
            const hasPkgJson = fs.existsSync(pkgPath);
            if (!hasPkgJson && apiAvailable) {
              try {
                console.log(`[Import] No package.json found \u2014 checking GitHub Releases for precompiled binaries...`);
                const relResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { headers: { ...headers, "Accept": "application/vnd.github.v3+json" } });
                if (relResp.ok) {
                  const relData = await relResp.json();
                  const BINARY_EXTS = [".exe", ".msi", ".appimage", ".dmg", ".deb", ".rpm", ".zip", ".tar.gz", ".7z", ".snap", ".flatpak"];
                  const osPlatform = os.platform();
                  const osArch = os.arch();
                  const platformHints = osPlatform === "win32" ? ["win", "windows"] : osPlatform === "darwin" ? ["mac", "macos", "darwin"] : ["linux"];
                  const goodArchHints = osArch === "arm64" ? ["arm64", "aarch64"] : ["x64", "x86_64", "amd64", "win64"];
                  const badArchHints = osArch === "arm64" ? ["x64", "x86_64", "amd64", "win64"] : ["arm64", "aarch64"];
                  const INSTALLER_KW = ["installer", "setup", "install"];
                  const assets = (relData.assets || []).filter((a) => BINARY_EXTS.some((ext) => a.name.toLowerCase().endsWith(ext))).map((a) => {
                    const ln = a.name.toLowerCase();
                    let score = 0;
                    if (platformHints.some((h) => ln.includes(h))) score += 20;
                    if (goodArchHints.some((h) => ln.includes(h))) score += 10;
                    if (badArchHints.some((h) => ln.includes(h))) score -= 15;
                    if (ln.includes("portable")) score += 25;
                    if (INSTALLER_KW.some((h) => ln.includes(h))) score -= 5;
                    if (ln.endsWith(".zip")) score += 3;
                    return { ...a, _score: score };
                  }).sort((a, b) => b._score - a._score);
                  if (assets.length > 0) {
                    const releasesDir = path.join(projectDir, "_releases");
                    fs.mkdirSync(releasesDir, { recursive: true });
                    const MAX_DOWNLOAD = 500 * 1024 * 1024;
                    const toDownload = assets.filter((a) => a.size < MAX_DOWNLOAD).slice(0, 3);
                    for (const asset of toDownload) {
                      try {
                        console.log(`[Import] Downloading release asset: ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)}MB)...`);
                        const dlResp = await fetch(asset.browser_download_url, { redirect: "follow" });
                        if (dlResp.ok) {
                          const buf = Buffer.from(await dlResp.arrayBuffer());
                          const assetPath = path.join(releasesDir, asset.name);
                          fs.writeFileSync(assetPath, buf);
                          if (asset.name.toLowerCase().endsWith(".exe") || asset.name.toLowerCase().endsWith(".appimage")) {
                            try {
                              fs.chmodSync(assetPath, 493);
                            } catch {
                            }
                          }
                          if (asset.name.toLowerCase().endsWith(".zip")) {
                            try {
                              const extractDir = path.join(releasesDir, asset.name.replace(/\.zip$/i, ""));
                              fs.mkdirSync(extractDir, { recursive: true });
                              if (osPlatform === "win32") {
                                execSync(`tar xf "${assetPath.replace(/\\/g, "/")}" -C "${extractDir.replace(/\\/g, "/")}"`, { timeout: 6e4, stdio: "pipe", windowsHide: true });
                              } else {
                                execSync(`unzip -o -q "${assetPath}" -d "${extractDir}"`, { timeout: 6e4, stdio: "pipe" });
                              }
                              console.log(`[Import] Extracted ${asset.name} to ${extractDir}`);
                            } catch (unzipErr) {
                              console.log(`[Import] Could not extract ${asset.name}: ${unzipErr.message?.slice(0, 100)}`);
                            }
                          }
                          releaseAssets.push({ name: asset.name, size: asset.size, downloadUrl: asset.browser_download_url, downloaded: true });
                          console.log(`[Import] Downloaded: ${asset.name}`);
                        }
                      } catch (dlErr) {
                        console.log(`[Import] Failed to download ${asset.name}: ${dlErr.message?.slice(0, 100)}`);
                        releaseAssets.push({ name: asset.name, size: asset.size, downloadUrl: asset.browser_download_url, downloaded: false });
                      }
                    }
                    for (const asset of assets.slice(3)) {
                      releaseAssets.push({ name: asset.name, size: asset.size, downloadUrl: asset.browser_download_url, downloaded: false });
                    }
                    console.log(`[Import] Release assets: ${releaseAssets.filter((a) => a.downloaded).length} downloaded, ${releaseAssets.length} total`);
                  }
                }
              } catch (relErr) {
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
              ...installError ? { installError: installError.slice(0, 500) } : {},
              ...releaseAssets.length > 0 ? { releaseAssets } : {}
            }));
          } finally {
            try {
              fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch {
            }
          }
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      let activePreviewPort = null;
      const proxyToPreview = async (req, res, port, targetPath) => {
        const http = await import("http");
        const proxyReq = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path: targetPath,
            method: req.method,
            headers: { ...req.headers, host: `localhost:${port}` }
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          }
        );
        proxyReq.on("error", () => {
          if (!res.headersSent) {
            res.statusCode = 502;
            res.end("Preview server not responding");
          }
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
        if (!match) {
          res.statusCode = 400;
          res.end("Invalid preview URL");
          return;
        }
        const port = parseInt(match[1], 10);
        const targetPath = match[2] || "/";
        if (port < 5100 || port > 5200) {
          res.statusCode = 400;
          res.end("Port out of preview range");
          return;
        }
        activePreviewPort = port;
        await proxyToPreview(req, res, port, targetPath);
      });
      server.middlewares.use("/sw.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister().then(()=>self.clients.matchAll()).then(cs=>cs.forEach(c=>c.navigate(c.url)))));`);
      });
      const PREVIEW_ASSET_PREFIXES = ["/_next/", "/__nextjs", "/__vite", "/@vite/", "/@react-refresh", "/@id/", "/@fs/", "/node_modules/", "/src/", "/favicon.ico", "/opengraph-image", "/apple-touch-icon", "/manifest.json", "/workbox-", "/static/", "/sockjs-node/", "/build/", "/_assets/", "/assets/", "/public/", "/polyfills", "/.vite/", "/hmr", "/__webpack_hmr", "/@tailwindcss/"];
      server.middlewares.use(async (req, res, next) => {
        if (!activePreviewPort || !req.url) {
          next();
          return;
        }
        const shouldProxy = PREVIEW_ASSET_PREFIXES.some((p) => req.url.startsWith(p));
        if (!shouldProxy) {
          next();
          return;
        }
        await proxyToPreview(req, res, activePreviewPort, req.url);
      });
      server.middlewares.use("/api/projects/preview-info", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
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
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      server.middlewares.use("/api/projects/stop-preview", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { name } = JSON.parse(await readBody(req));
          const entry = previewProcesses.get(name);
          if (entry) {
            const pid = entry.process.pid;
            if (process.platform === "win32") {
              try {
                const { execSync } = await import("child_process");
                execSync(`taskkill /pid ${pid} /T /F`, { stdio: "pipe", windowsHide: true });
              } catch {
              }
            } else {
              try {
                process.kill(-pid, 9);
              } catch {
              }
            }
            try {
              entry.process.kill("SIGKILL");
            } catch {
            }
            try {
              const fs = await import("fs");
              const killPort = async (port) => {
                if (process.platform === "win32") {
                  try {
                    const { execSync } = await import("child_process");
                    const out = execSync(`netstat -ano | findstr :${port}`, { stdio: "pipe", encoding: "utf-8", windowsHide: true });
                    const pids = new Set(out.split("\n").map((l) => l.trim().split(/\s+/).pop()).filter((p) => p && /^\d+$/.test(p)));
                    for (const p of pids) {
                      try {
                        execSync(`taskkill /pid ${p} /T /F`, { stdio: "pipe", windowsHide: true });
                      } catch {
                      }
                    }
                  } catch {
                  }
                  return;
                }
                const netTcp = fs.readFileSync("/proc/net/tcp", "utf-8") + fs.readFileSync("/proc/net/tcp6", "utf-8");
                const portHex = port.toString(16).toUpperCase().padStart(4, "0");
                const lines = netTcp.split("\n").filter((l) => l.includes(`:${portHex} `));
                for (const line of lines) {
                  const cols = line.trim().split(/\s+/);
                  const inode = cols[9];
                  if (!inode || inode === "0") continue;
                  const procDirs = fs.readdirSync("/proc").filter((d) => /^\d+$/.test(d));
                  for (const p of procDirs) {
                    try {
                      const fds = fs.readdirSync(`/proc/${p}/fd`);
                      for (const fd of fds) {
                        try {
                          if (fs.readlinkSync(`/proc/${p}/fd/${fd}`) === `socket:[${inode}]`) {
                            try {
                              process.kill(-parseInt(p), 9);
                            } catch {
                            }
                            try {
                              process.kill(parseInt(p), 9);
                            } catch {
                            }
                          }
                        } catch {
                        }
                      }
                    } catch {
                    }
                  }
                }
              };
              await killPort(entry.port);
            } catch {
            }
            if (activePreviewPort === entry.port) activePreviewPort = null;
            previewProcesses.delete(name);
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ stopped: true }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}
function sourceDownloadPlugin() {
  return {
    name: "source-download",
    configureServer(server) {
      server.middlewares.use("/api/download-source", async (_req, res) => {
        try {
          const archiver = (await import("file:///home/runner/workspace/node_modules/archiver/index.js")).default;
          const projectRoot = process.cwd();
          res.setHeader("Content-Type", "application/zip");
          res.setHeader("Content-Disposition", "attachment; filename=lambda-recursive-source.zip");
          const archive = archiver("zip", { zlib: { level: 9 } });
          archive.pipe(res);
          const includeDirs = ["src", "public", "supabase", "electron-browser"];
          const includeFiles = [
            "package.json",
            "package-lock.json",
            "tsconfig.json",
            "tsconfig.app.json",
            "tsconfig.node.json",
            "vite.config.ts",
            "tailwind.config.ts",
            "postcss.config.js",
            "index.html",
            "eslint.config.js",
            ".env",
            ".env.example",
            "replit.md",
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
    }
  };
}
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5e3,
    allowedHosts: true,
    hmr: {
      overlay: false
    },
    watch: {
      ignored: ["**/projects/**", "**/.local/**", "**/node_modules/**", "**/.cache/**"]
    }
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
        enabled: false
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"]
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
            purpose: "any maskable"
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3J1bm5lci93b3Jrc3BhY2Uvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIHR5cGUgUGx1Z2luIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcblxuZnVuY3Rpb24gZmlsZVdyaXRlUGx1Z2luKCk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogXCJmaWxlLXdyaXRlXCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgY29uc3QgZnMgPSByZXF1aXJlKFwiZnNcIikgYXMgdHlwZW9mIGltcG9ydChcImZzXCIpO1xuXG4gICAgICBmdW5jdGlvbiBkZXRlY3RQbUZvckRpcihwcm9qRGlyOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvakRpciwgXCJidW4ubG9ja2JcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2pEaXIsIFwiYnVuLmxvY2tcIikpKSByZXR1cm4gXCJidW5cIjtcbiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2pEaXIsIFwicG5wbS1sb2NrLnlhbWxcIikpKSByZXR1cm4gXCJwbnBtXCI7XG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qRGlyLCBcInlhcm4ubG9ja1wiKSkpIHJldHVybiBcInlhcm5cIjtcbiAgICAgICAgcmV0dXJuIFwibnBtXCI7XG4gICAgICB9XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3dyaXRlLWZpbGVcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgbGV0IGJvZHkgPSBcIlwiO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgcmVxKSBib2R5ICs9IGNodW5rO1xuICAgICAgICAgIGNvbnN0IHsgZmlsZVBhdGgsIGNvbnRlbnQgfSA9IEpTT04ucGFyc2UoYm9keSk7XG4gICAgICAgICAgaWYgKCFmaWxlUGF0aCB8fCB0eXBlb2YgY29udGVudCAhPT0gXCJzdHJpbmdcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChcIk1pc3NpbmcgZmlsZVBhdGggb3IgY29udGVudFwiKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3RSb290ID0gcHJvY2Vzcy5jd2QoKTtcbiAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IHBhdGgucmVzb2x2ZShwcm9qZWN0Um9vdCwgZmlsZVBhdGgpO1xuICAgICAgICAgIGlmICghcmVzb2x2ZWQuc3RhcnRzV2l0aChwcm9qZWN0Um9vdCkpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoXCJQYXRoIG91dHNpZGUgcHJvamVjdFwiKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBkaXIgPSBwYXRoLmRpcm5hbWUocmVzb2x2ZWQpO1xuICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhkaXIpKSBmcy5ta2RpclN5bmMoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuICAgICAgICAgIGxldCBwcmV2aW91c0NvbnRlbnQgPSBcIlwiO1xuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHJlc29sdmVkKSkgcHJldmlvdXNDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHJlc29sdmVkLCBcInV0Zi04XCIpO1xuXG4gICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhyZXNvbHZlZCwgY29udGVudCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgZmlsZVBhdGgsIHByZXZpb3VzQ29udGVudCwgYnl0ZXNXcml0dGVuOiBjb250ZW50Lmxlbmd0aCB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcmVhZC1maWxlXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGxldCBib2R5ID0gXCJcIjtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHJlcSkgYm9keSArPSBjaHVuaztcbiAgICAgICAgICBjb25zdCB7IGZpbGVQYXRoIH0gPSBKU09OLnBhcnNlKGJvZHkpO1xuICAgICAgICAgIGlmICghZmlsZVBhdGgpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoXCJNaXNzaW5nIGZpbGVQYXRoXCIpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgcHJvamVjdFJvb3QgPSBwcm9jZXNzLmN3ZCgpO1xuICAgICAgICAgIGNvbnN0IHJlc29sdmVkID0gcGF0aC5yZXNvbHZlKHByb2plY3RSb290LCBmaWxlUGF0aCk7XG4gICAgICAgICAgaWYgKCFyZXNvbHZlZC5zdGFydHNXaXRoKHByb2plY3RSb290KSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMzsgcmVzLmVuZChcIlBhdGggb3V0c2lkZSBwcm9qZWN0XCIpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGV4aXN0cyA9IGZzLmV4aXN0c1N5bmMocmVzb2x2ZWQpO1xuICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBleGlzdHMgPyBmcy5yZWFkRmlsZVN5bmMocmVzb2x2ZWQsIFwidXRmLThcIikgOiBcIlwiO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBleGlzdHMsIGNvbnRlbnQgfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcHJvamVjdE1hbmFnZW1lbnRQbHVnaW4oKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcInByb2plY3QtbWFuYWdlbWVudFwiLFxuICAgIGFzeW5jIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIGFzeW5jIGZ1bmN0aW9uIHJlYWRCb2R5KHJlcTogYW55KTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAgICAgbGV0IGJvZHkgPSBcIlwiO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHJlcSkgYm9keSArPSBjaHVuaztcbiAgICAgICAgcmV0dXJuIGJvZHk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHZhbGlkYXRlUHJvamVjdFBhdGgocHJvamVjdE5hbWU6IHN0cmluZywgZmlsZVBhdGg/OiBzdHJpbmcpOiB7IHZhbGlkOiBib29sZWFuOyByZXNvbHZlZDogc3RyaW5nOyBlcnJvcj86IHN0cmluZyB9IHtcbiAgICAgICAgY29uc3QgcHJvamVjdFJvb3QgPSBwcm9jZXNzLmN3ZCgpO1xuICAgICAgICBpZiAocHJvamVjdE5hbWUgPT09IFwiX19tYWluX19cIikge1xuICAgICAgICAgIGlmICghZmlsZVBhdGgpIHJldHVybiB7IHZhbGlkOiB0cnVlLCByZXNvbHZlZDogcHJvamVjdFJvb3QgfTtcbiAgICAgICAgICBjb25zdCBCTE9DS0VEX01BSU5fRElSUyA9IG5ldyBTZXQoW1wibm9kZV9tb2R1bGVzXCIsIFwiLmdpdFwiLCBcInByb2plY3RzXCIsIFwiLmxvY2FsXCIsIFwiLmFnZW50c1wiLCBcIi51cG1cIiwgXCIuY29uZmlnXCIsIFwiLmNhY2hlXCIsIFwiZGlzdFwiLCBcImF0dGFjaGVkX2Fzc2V0c1wiLCBcInBhdGhcIiwgXCIucmVwbGl0XCJdKTtcbiAgICAgICAgICBjb25zdCBCTE9DS0VEX01BSU5fRklMRVMgPSBuZXcgU2V0KFtcIi5lbnZcIiwgXCIuZW52LmxvY2FsXCIsIFwiLmVudi5kZXZlbG9wbWVudFwiLCBcIi5lbnYucHJvZHVjdGlvblwiLCBcIi5naXRhdHRyaWJ1dGVzXCIsIFwiLmdpdGlnbm9yZVwiLCBcImJ1bi5sb2NrXCIsIFwicGFja2FnZS1sb2NrLmpzb25cIl0pO1xuICAgICAgICAgIGNvbnN0IGZpcnN0U2VnID0gZmlsZVBhdGguc3BsaXQoL1tcXC9cXFxcXS8pWzBdO1xuICAgICAgICAgIGlmIChCTE9DS0VEX01BSU5fRElSUy5oYXMoZmlyc3RTZWcpKSByZXR1cm4geyB2YWxpZDogZmFsc2UsIHJlc29sdmVkOiBcIlwiLCBlcnJvcjogXCJBY2Nlc3MgdG8gdGhpcyBkaXJlY3RvcnkgaXMgYmxvY2tlZFwiIH07XG4gICAgICAgICAgY29uc3QgZmlsZU5hbWUgPSBmaWxlUGF0aC5zcGxpdCgvW1xcL1xcXFxdLykucG9wKCkgfHwgXCJcIjtcbiAgICAgICAgICBpZiAoQkxPQ0tFRF9NQUlOX0ZJTEVTLmhhcyhmaWxlTmFtZSkgJiYgIWZpbGVQYXRoLmluY2x1ZGVzKFwiL1wiKSkgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCByZXNvbHZlZDogXCJcIiwgZXJyb3I6IFwiQWNjZXNzIHRvIHRoaXMgZmlsZSBpcyBibG9ja2VkXCIgfTtcbiAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IHBhdGgucmVzb2x2ZShwcm9qZWN0Um9vdCwgZmlsZVBhdGgpO1xuICAgICAgICAgIGlmICghcmVzb2x2ZWQuc3RhcnRzV2l0aChwcm9qZWN0Um9vdCArIHBhdGguc2VwKSAmJiByZXNvbHZlZCAhPT0gcHJvamVjdFJvb3QpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgcmVzb2x2ZWQ6IFwiXCIsIGVycm9yOiBcIkZpbGUgcGF0aCB0cmF2ZXJzYWwgYmxvY2tlZFwiIH07XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB7IHZhbGlkOiB0cnVlLCByZXNvbHZlZCB9O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHByb2plY3RzRGlyID0gcGF0aC5yZXNvbHZlKHByb2plY3RSb290LCBcInByb2plY3RzXCIpO1xuICAgICAgICBpZiAoIXByb2plY3ROYW1lIHx8IC9bXFwvXFxcXF18XFwuXFwuLy50ZXN0KHByb2plY3ROYW1lKSB8fCBwcm9qZWN0TmFtZSA9PT0gJy4nIHx8IHByb2plY3ROYW1lLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgcmVzb2x2ZWQ6IFwiXCIsIGVycm9yOiBcIkludmFsaWQgcHJvamVjdCBuYW1lXCIgfTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwcm9qZWN0RGlyID0gcGF0aC5yZXNvbHZlKHByb2plY3RzRGlyLCBwcm9qZWN0TmFtZSk7XG4gICAgICAgIGlmICghcHJvamVjdERpci5zdGFydHNXaXRoKHByb2plY3RzRGlyICsgcGF0aC5zZXApICYmIHByb2plY3REaXIgIT09IHByb2plY3RzRGlyKSB7XG4gICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCByZXNvbHZlZDogXCJcIiwgZXJyb3I6IFwiUGF0aCB0cmF2ZXJzYWwgYmxvY2tlZFwiIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZpbGVQYXRoKSB7XG4gICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgZmlsZVBhdGgpO1xuICAgICAgICAgIGlmICghcmVzb2x2ZWQuc3RhcnRzV2l0aChwcm9qZWN0RGlyICsgcGF0aC5zZXApICYmIHJlc29sdmVkICE9PSBwcm9qZWN0RGlyKSB7XG4gICAgICAgICAgICByZXR1cm4geyB2YWxpZDogZmFsc2UsIHJlc29sdmVkOiBcIlwiLCBlcnJvcjogXCJGaWxlIHBhdGggdHJhdmVyc2FsIGJsb2NrZWRcIiB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgcmVzb2x2ZWQgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgcmVzb2x2ZWQ6IHByb2plY3REaXIgfTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY3J5cHRvID0gYXdhaXQgaW1wb3J0KFwiY3J5cHRvXCIpO1xuICAgICAgY29uc3Qgc25hcHNob3RLZXkgPSBjcnlwdG8ucmFuZG9tQnl0ZXMoMTYpLnRvU3RyaW5nKFwiaGV4XCIpO1xuICAgICAgY29uc29sZS5sb2coYFtMYW1ieV0gU25hcHNob3Qga2V5IGdlbmVyYXRlZCAodXNlIC9hcGkvc25hcHNob3Qta2V5IGZyb20gbG9jYWxob3N0IHRvIHJldHJpZXZlKWApO1xuXG4gICAgICBjb25zdCBzbmFwc2hvdFJhdGVMaW1pdCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXJbXT4oKTtcblxuICAgICAgYXN5bmMgZnVuY3Rpb24gZ2F0aGVyUHJvamVjdFNuYXBzaG90KHByb2plY3ROYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICBjb25zdCBjaGlsZFByb2Nlc3MgPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICBjb25zdCBjaGVjayA9IHZhbGlkYXRlUHJvamVjdFBhdGgocHJvamVjdE5hbWUpO1xuICAgICAgICBpZiAoIWNoZWNrLnZhbGlkKSByZXR1cm4gYEVycm9yOiAke2NoZWNrLmVycm9yfWA7XG4gICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBjaGVjay5yZXNvbHZlZDtcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSByZXR1cm4gYEVycm9yOiBQcm9qZWN0IFwiJHtwcm9qZWN0TmFtZX1cIiBub3QgZm91bmQuYDtcblxuICAgICAgICBjb25zdCBTS0lQX0RJUlMgPSBuZXcgU2V0KFtcIm5vZGVfbW9kdWxlc1wiLCBcIi5jYWNoZVwiLCBcImRpc3RcIiwgXCIuZ2l0XCIsIFwiLm5leHRcIiwgXCIubnV4dFwiLCBcIi50dXJib1wiLCBcIi52ZXJjZWxcIiwgXCIub3V0cHV0XCIsIFwiLnN2ZWx0ZS1raXRcIiwgXCJfX3B5Y2FjaGVfX1wiLCBcIi5wYXJjZWwtY2FjaGVcIiwgXCJidWlsZFwiLCBcIi5zdmVsdGUta2l0XCJdKTtcbiAgICAgICAgY29uc3QgQ09ERV9FWFRTID0gbmV3IFNldChbXCIudHNcIiwgXCIudHN4XCIsIFwiLmpzXCIsIFwiLmpzeFwiLCBcIi5qc29uXCIsIFwiLmNzc1wiLCBcIi5odG1sXCIsIFwiLnB5XCIsIFwiLm1kXCIsIFwiLnlhbWxcIiwgXCIueW1sXCIsIFwiLnRvbWxcIiwgXCIuZW52LmV4YW1wbGVcIiwgXCIuZ2l0aWdub3JlXCIsIFwiLnN2ZWx0ZVwiLCBcIi52dWVcIiwgXCIuYXN0cm9cIl0pO1xuICAgICAgICBjb25zdCBNQVhfRklMRV9TSVpFID0gMTIwMDA7XG4gICAgICAgIGNvbnN0IFRPVEFMX0JVREdFVCA9IDEwMDAwMDtcblxuICAgICAgICBjb25zdCBmaWxlUGF0aHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGZ1bmN0aW9uIHdhbGtEaXIoZGlyOiBzdHJpbmcsIGJhc2U6IHN0cmluZykge1xuICAgICAgICAgIGxldCBuYW1lczogc3RyaW5nW107XG4gICAgICAgICAgdHJ5IHsgbmFtZXMgPSBmcy5yZWFkZGlyU3luYyhkaXIpOyB9IGNhdGNoIHsgcmV0dXJuOyB9XG4gICAgICAgICAgZm9yIChjb25zdCBuYW1lIG9mIG5hbWVzKSB7XG4gICAgICAgICAgICBpZiAobmFtZSA9PT0gXCIuRFNfU3RvcmVcIiB8fCBuYW1lLnN0YXJ0c1dpdGgoXCIuXCIpKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGRpciwgbmFtZSk7XG4gICAgICAgICAgICBjb25zdCByZWxQYXRoID0gYmFzZSA/IGJhc2UgKyBcIi9cIiArIG5hbWUgOiBuYW1lO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLmxzdGF0U3luYyhmdWxsUGF0aCk7XG4gICAgICAgICAgICAgIGlmIChzdGF0LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoU0tJUF9ESVJTLmhhcyhuYW1lKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgd2Fsa0RpcihmdWxsUGF0aCwgcmVsUGF0aCk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgIGZpbGVQYXRocy5wdXNoKHJlbFBhdGgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHdhbGtEaXIocHJvamVjdERpciwgXCJcIik7XG5cbiAgICAgICAgbGV0IG91dHB1dCA9IGA9PT0gTEFNQlkgUFJPSkVDVCBTTkFQU0hPVCA9PT1cXG5gO1xuICAgICAgICBvdXRwdXQgKz0gYFByb2plY3Q6ICR7cHJvamVjdE5hbWV9XFxuYDtcbiAgICAgICAgb3V0cHV0ICs9IGBTY2FubmVkIGF0OiAke25ldyBEYXRlKCkudG9JU09TdHJpbmcoKX1cXG5cXG5gO1xuXG4gICAgICAgIG91dHB1dCArPSBgPT09IEZJTEUgVFJFRSA9PT1cXG5gO1xuICAgICAgICBmb3IgKGNvbnN0IGZwIG9mIGZpbGVQYXRocykgb3V0cHV0ICs9IGAtICR7ZnB9XFxuYDtcbiAgICAgICAgb3V0cHV0ICs9IGBcXG5Ub3RhbCBmaWxlczogJHtmaWxlUGF0aHMubGVuZ3RofVxcblxcbmA7XG5cbiAgICAgICAgbGV0IGdpdFN0YXR1cyA9IFwiXCI7XG4gICAgICAgIGxldCBnaXRMb2cgPSBcIlwiO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGdpdFN0YXR1cyA9IGNoaWxkUHJvY2Vzcy5leGVjU3luYyhcImdpdCBzdGF0dXMgLS1zaG9ydFwiLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogNTAwMCB9KS50b1N0cmluZygpLnRyaW0oKTtcbiAgICAgICAgICBnaXRMb2cgPSBjaGlsZFByb2Nlc3MuZXhlY1N5bmMoXCJnaXQgbG9nIC0tb25lbGluZSAtMTBcIiwgeyBjd2Q6IHByb2plY3REaXIsIHRpbWVvdXQ6IDUwMDAgfSkudG9TdHJpbmcoKS50cmltKCk7XG4gICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgaWYgKGdpdFN0YXR1cyB8fCBnaXRMb2cpIHtcbiAgICAgICAgICBvdXRwdXQgKz0gYD09PSBHSVQgU1RBVFVTID09PVxcbmA7XG4gICAgICAgICAgaWYgKGdpdFN0YXR1cykgb3V0cHV0ICs9IGdpdFN0YXR1cyArIFwiXFxuXCI7XG4gICAgICAgICAgaWYgKGdpdExvZykgb3V0cHV0ICs9IGBcXG5SZWNlbnQgY29tbWl0czpcXG4ke2dpdExvZ31cXG5gO1xuICAgICAgICAgIG91dHB1dCArPSBgXFxuYDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBwa2dKc29uID0gXCJcIjtcbiAgICAgICAgdHJ5IHsgcGtnSnNvbiA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIiksIFwidXRmLThcIik7IH0gY2F0Y2gge31cbiAgICAgICAgaWYgKHBrZ0pzb24pIHtcbiAgICAgICAgICBvdXRwdXQgKz0gYD09PSBwYWNrYWdlLmpzb24gPT09XFxuJHtwa2dKc29ufVxcblxcbmA7XG4gICAgICAgIH1cblxuICAgICAgICBvdXRwdXQgKz0gYD09PSBTT1VSQ0UgRklMRVMgPT09XFxuYDtcbiAgICAgICAgbGV0IHRvdGFsQ2hhcnMgPSBvdXRwdXQubGVuZ3RoO1xuICAgICAgICBjb25zdCBjb2RlRmlsZXMgPSBmaWxlUGF0aHMuZmlsdGVyKGZwID0+IHtcbiAgICAgICAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUoZnApLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgcmV0dXJuIENPREVfRVhUUy5oYXMoZXh0KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZm9yIChjb25zdCBmcCBvZiBjb2RlRmlsZXMpIHtcbiAgICAgICAgICBpZiAodG90YWxDaGFycyA+PSBUT1RBTF9CVURHRVQpIHtcbiAgICAgICAgICAgIG91dHB1dCArPSBgXFxuLi4uIChidWRnZXQgcmVhY2hlZCwgJHtjb2RlRmlsZXMubGVuZ3RoIC0gY29kZUZpbGVzLmluZGV4T2YoZnApfSBmaWxlcyBvbWl0dGVkKVxcbmA7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIGZwKTtcbiAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhmdWxsUGF0aCk7XG4gICAgICAgICAgICBpZiAoc3RhdC5zaXplID4gTUFYX0ZJTEVfU0laRSAqIDIpIHtcbiAgICAgICAgICAgICAgb3V0cHV0ICs9IGBcXG4tLS0gJHtmcH0gKCR7c3RhdC5zaXplfSBieXRlcywgdG9vIGxhcmdlLCBza2lwcGVkKSAtLS1cXG5gO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGZ1bGxQYXRoLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnQubGVuZ3RoID4gTUFYX0ZJTEVfU0laRSkgY29udGVudCA9IGNvbnRlbnQuc3Vic3RyaW5nKDAsIE1BWF9GSUxFX1NJWkUpICsgXCJcXG4uLi4gKHRydW5jYXRlZClcIjtcbiAgICAgICAgICAgIGNvbnN0IGJsb2NrID0gYFxcbi0tLSAke2ZwfSAtLS1cXG4ke2NvbnRlbnR9XFxuYDtcbiAgICAgICAgICAgIHRvdGFsQ2hhcnMgKz0gYmxvY2subGVuZ3RoO1xuICAgICAgICAgICAgb3V0cHV0ICs9IGJsb2NrO1xuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIG91dHB1dCArPSBgXFxuPT09IEVORCBTTkFQU0hPVCA9PT1cXG5gO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfVxuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9zbmFwc2hvdC1rZXlcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIkdFVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgY29uc3QgY2xpZW50SXAgPSAocmVxLmhlYWRlcnNbXCJ4LWZvcndhcmRlZC1mb3JcIl0gYXMgc3RyaW5nIHx8IHJlcS5zb2NrZXQ/LnJlbW90ZUFkZHJlc3MgfHwgXCJcIikuc3BsaXQoXCIsXCIpWzBdLnRyaW0oKTtcbiAgICAgICAgY29uc3QgaXNMb2NhbCA9IGNsaWVudElwID09PSBcIjEyNy4wLjAuMVwiIHx8IGNsaWVudElwID09PSBcIjo6MVwiIHx8IGNsaWVudElwID09PSBcIjo6ZmZmZjoxMjcuMC4wLjFcIiB8fCBjbGllbnRJcCA9PT0gXCJsb2NhbGhvc3RcIjtcbiAgICAgICAgaWYgKCFpc0xvY2FsKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAzOyByZXMuZW5kKFwiU25hcHNob3Qga2V5IG9ubHkgYXZhaWxhYmxlIGZyb20gbG9jYWxob3N0XCIpOyByZXR1cm47IH1cbiAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgIGNvbnN0IGhvc3QgPSByZXEuaGVhZGVycy5ob3N0IHx8IFwibG9jYWxob3N0OjUwMDBcIjtcbiAgICAgICAgY29uc3QgcHJvdG9jb2wgPSByZXEuaGVhZGVyc1tcIngtZm9yd2FyZGVkLXByb3RvXCJdIHx8IFwiaHR0cFwiO1xuICAgICAgICBjb25zdCBiYXNlVXJsID0gYCR7cHJvdG9jb2x9Oi8vJHtob3N0fWA7XG4gICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBrZXk6IHNuYXBzaG90S2V5LCBiYXNlVXJsLCBleGFtcGxlVXJsOiBgJHtiYXNlVXJsfS9hcGkvc25hcHNob3QvUFJPSkVDVF9OQU1FP2tleT0ke3NuYXBzaG90S2V5fWAgfSkpO1xuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3NuYXBzaG90L1wiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiR0VUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxLnVybCB8fCBcIlwiLCBgaHR0cDovLyR7cmVxLmhlYWRlcnMuaG9zdH1gKTtcbiAgICAgICAgICBjb25zdCBwYXRoUGFydHMgPSB1cmwucGF0aG5hbWUuc3BsaXQoXCIvXCIpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgICAgICBjb25zdCBwcm9qZWN0TmFtZSA9IHBhdGhQYXJ0c1swXSB8fCBcIlwiO1xuICAgICAgICAgIGNvbnN0IHByb3ZpZGVkS2V5ID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJrZXlcIikgfHwgKHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb24gfHwgXCJcIikucmVwbGFjZShcIkJlYXJlciBcIiwgXCJcIik7XG5cbiAgICAgICAgICBpZiAoIXByb3ZpZGVkS2V5IHx8IHByb3ZpZGVkS2V5ICE9PSBzbmFwc2hvdEtleSkge1xuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDM7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwidGV4dC9wbGFpblwiKTtcbiAgICAgICAgICAgIHJlcy5lbmQoXCJMYW1ieSBTbmFwc2hvdCBBUElcXG5cXG5BY2Nlc3MgZGVuaWVkIFx1MjAxNCBpbnZhbGlkIG9yIG1pc3Npbmcga2V5LlxcblByb3ZpZGUgP2tleT1ZT1VSX0tFWSBvciBBdXRob3JpemF0aW9uOiBCZWFyZXIgWU9VUl9LRVlcIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICBjb25zdCBjbGllbnRJcCA9IChyZXEuaGVhZGVyc1tcIngtZm9yd2FyZGVkLWZvclwiXSBhcyBzdHJpbmcgfHwgcmVxLnNvY2tldD8ucmVtb3RlQWRkcmVzcyB8fCBcInVua25vd25cIikuc3BsaXQoXCIsXCIpWzBdLnRyaW0oKTtcbiAgICAgICAgICBjb25zdCBoaXRzID0gc25hcHNob3RSYXRlTGltaXQuZ2V0KGNsaWVudElwKSB8fCBbXTtcbiAgICAgICAgICBjb25zdCByZWNlbnRIaXRzID0gaGl0cy5maWx0ZXIodCA9PiBub3cgLSB0IDwgNjAwMDApO1xuICAgICAgICAgIGlmIChyZWNlbnRIaXRzLmxlbmd0aCA+PSAxMCkge1xuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0Mjk7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwidGV4dC9wbGFpblwiKTtcbiAgICAgICAgICAgIHJlcy5lbmQoXCJSYXRlIGxpbWl0ZWQgXHUyMDE0IG1heCAxMCByZXF1ZXN0cyBwZXIgbWludXRlLiBUcnkgYWdhaW4gc2hvcnRseS5cIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlY2VudEhpdHMucHVzaChub3cpO1xuICAgICAgICAgIHNuYXBzaG90UmF0ZUxpbWl0LnNldChjbGllbnRJcCwgcmVjZW50SGl0cyk7XG5cbiAgICAgICAgICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgICAgY29uc3QgcHJvamVjdHNEaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiKTtcbiAgICAgICAgICAgIGxldCBwcm9qZWN0TGlzdDogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHByb2plY3RzRGlyKSkge1xuICAgICAgICAgICAgICBwcm9qZWN0TGlzdCA9IGZzLnJlYWRkaXJTeW5jKHByb2plY3RzRGlyKS5maWx0ZXIobiA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHsgcmV0dXJuIGZzLnN0YXRTeW5jKHBhdGguam9pbihwcm9qZWN0c0RpciwgbikpLmlzRGlyZWN0b3J5KCk7IH0gY2F0Y2ggeyByZXR1cm4gZmFsc2U7IH1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwidGV4dC9wbGFpblwiKTtcbiAgICAgICAgICAgIHJlcy5lbmQoYExhbWJ5IFNuYXBzaG90IEFQSVxcblxcbkF2YWlsYWJsZSBwcm9qZWN0czpcXG4ke3Byb2plY3RMaXN0Lm1hcChwID0+IGAtICR7cH1gKS5qb2luKFwiXFxuXCIpIHx8IFwiKG5vbmUpXCJ9XFxuXFxuVXNhZ2U6IC9hcGkvc25hcHNob3QvUFJPSkVDVF9OQU1FP2tleT1ZT1VSX0tFWWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHNuYXBzaG90ID0gYXdhaXQgZ2F0aGVyUHJvamVjdFNuYXBzaG90KHByb2plY3ROYW1lKTtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwidGV4dC9wbGFpbjsgY2hhcnNldD11dGYtOFwiKTtcbiAgICAgICAgICByZXMuZW5kKHNuYXBzaG90KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwidGV4dC9wbGFpblwiKTtcbiAgICAgICAgICByZXMuZW5kKGBFcnJvciBnZW5lcmF0aW5nIHNuYXBzaG90OiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvbGlzdFwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3RzRGlyID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIFwicHJvamVjdHNcIik7XG4gICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHByb2plY3RzRGlyKSkge1xuICAgICAgICAgICAgZnMubWtkaXJTeW5jKHByb2plY3RzRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgZW50cmllcyA9IGZzLnJlYWRkaXJTeW5jKHByb2plY3RzRGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XG4gICAgICAgICAgY29uc3QgcHJvamVjdHMgPSBlbnRyaWVzXG4gICAgICAgICAgICAuZmlsdGVyKChlOiBhbnkpID0+IGUuaXNEaXJlY3RvcnkoKSlcbiAgICAgICAgICAgIC5tYXAoKGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBwcm9qUGF0aCA9IHBhdGguam9pbihwcm9qZWN0c0RpciwgZS5uYW1lKTtcbiAgICAgICAgICAgICAgY29uc3QgcGtnUGF0aCA9IHBhdGguam9pbihwcm9qUGF0aCwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgICAgIGxldCBkZXNjcmlwdGlvbiA9IFwiXCI7XG4gICAgICAgICAgICAgIGxldCBmcmFtZXdvcmsgPSBcInJlYWN0XCI7XG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBrZ1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBrZyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBrZ1BhdGgsIFwidXRmLThcIikpO1xuICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb24gPSBwa2cuZGVzY3JpcHRpb24gfHwgXCJcIjtcbiAgICAgICAgICAgICAgICAgIGZyYW1ld29yayA9IHBrZy5fZnJhbWV3b3JrIHx8IFwicmVhY3RcIjtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKHByb2pQYXRoKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBlLm5hbWUsXG4gICAgICAgICAgICAgICAgcGF0aDogYHByb2plY3RzLyR7ZS5uYW1lfWAsXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBzdGF0LmJpcnRodGltZS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIGZyYW1ld29yayxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBwcm9qZWN0cyB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvY3JlYXRlXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGJvZHkgPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSwgZnJhbWV3b3JrID0gXCJyZWFjdFwiLCBkZXNjcmlwdGlvbiA9IFwiXCIgfSA9IGJvZHk7XG4gICAgICAgICAgaWYgKCFuYW1lIHx8IHR5cGVvZiBuYW1lICE9PSBcInN0cmluZ1wiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIk1pc3NpbmcgcHJvamVjdCBuYW1lXCIgfSkpOyByZXR1cm47IH1cbiAgICAgICAgICBjb25zdCBjaGVjayA9IHZhbGlkYXRlUHJvamVjdFBhdGgobmFtZSk7XG4gICAgICAgICAgaWYgKCFjaGVjay52YWxpZCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMzsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogY2hlY2suZXJyb3IgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IGNoZWNrLnJlc29sdmVkO1xuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA5OyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIlByb2plY3QgYWxyZWFkeSBleGlzdHNcIiB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgZnMubWtkaXJTeW5jKHByb2plY3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgICAgICAgY29uc3QgcGtnSnNvbiA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICB2ZXJzaW9uOiBcIjAuMC4xXCIsXG4gICAgICAgICAgICBwcml2YXRlOiB0cnVlLFxuICAgICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgICBfZnJhbWV3b3JrOiBmcmFtZXdvcmssXG4gICAgICAgICAgfSwgbnVsbCwgMik7XG4gICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIiksIHBrZ0pzb24sIFwidXRmLThcIik7XG5cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgbmFtZSwgZnJhbWV3b3JrLCBkZXNjcmlwdGlvbiwgcGF0aDogYHByb2plY3RzLyR7bmFtZX1gIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy9kZWxldGVcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBuYW1lIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghbmFtZSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJNaXNzaW5nIHByb2plY3QgbmFtZVwiIH0pKTsgcmV0dXJuOyB9XG4gICAgICAgICAgY29uc3QgY2hlY2sgPSB2YWxpZGF0ZVByb2plY3RQYXRoKG5hbWUpO1xuICAgICAgICAgIGlmICghY2hlY2sudmFsaWQpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGNoZWNrLmVycm9yIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjaGVjay5yZXNvbHZlZCkpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiUHJvamVjdCBub3QgZm91bmRcIiB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgY29uc3QgdG1wRGVzdCA9IGNoZWNrLnJlc29sdmVkICsgYC5fX2RlbGV0aW5nXyR7RGF0ZS5ub3coKX1gO1xuICAgICAgICAgIHRyeSB7IGZzLnJlbmFtZVN5bmMoY2hlY2sucmVzb2x2ZWQsIHRtcERlc3QpOyB9IGNhdGNoIHsgZnMucm1TeW5jKGNoZWNrLnJlc29sdmVkLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7IH1cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgbmFtZSB9KSk7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModG1wRGVzdCkpIHtcbiAgICAgICAgICAgIGZzLnJtKHRtcERlc3QsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9LCAoKSA9PiB7fSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL2R1cGxpY2F0ZVwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IG5hbWUsIG5ld05hbWUgfSA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEJvZHkocmVxKSk7XG4gICAgICAgICAgaWYgKCFuYW1lKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIk1pc3NpbmcgcHJvamVjdCBuYW1lXCIgfSkpOyByZXR1cm47IH1cbiAgICAgICAgICBjb25zdCBjaGVjayA9IHZhbGlkYXRlUHJvamVjdFBhdGgobmFtZSk7XG4gICAgICAgICAgaWYgKCFjaGVjay52YWxpZCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMzsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogY2hlY2suZXJyb3IgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNoZWNrLnJlc29sdmVkKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwNDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQcm9qZWN0IG5vdCBmb3VuZFwiIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBwRGlyID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIFwicHJvamVjdHNcIik7XG4gICAgICAgICAgbGV0IGRlc3ROYW1lID0gbmV3TmFtZTtcbiAgICAgICAgICBpZiAoIWRlc3ROYW1lKSB7XG4gICAgICAgICAgICBsZXQgc3VmZml4ID0gMTtcbiAgICAgICAgICAgIGRvIHsgZGVzdE5hbWUgPSBgJHtuYW1lfS1jb3B5JHtzdWZmaXggPiAxID8gYC0ke3N1ZmZpeH1gIDogJyd9YDsgc3VmZml4Kys7IH1cbiAgICAgICAgICAgIHdoaWxlIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwRGlyLCBkZXN0TmFtZSkpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKC9bXFwvXFxcXF18XFwuXFwuLy50ZXN0KGRlc3ROYW1lKSB8fCBkZXN0TmFtZSA9PT0gXCIuXCIgfHwgZGVzdE5hbWUuc3RhcnRzV2l0aChcIi5cIikpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIkludmFsaWQgZGVzdGluYXRpb24gbmFtZVwiIH0pKTsgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBkZXN0Q2hlY2sgPSB2YWxpZGF0ZVByb2plY3RQYXRoKGRlc3ROYW1lKTtcbiAgICAgICAgICBpZiAoIWRlc3RDaGVjay52YWxpZCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMzsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZGVzdENoZWNrLmVycm9yIH0pKTsgcmV0dXJuOyB9XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZGVzdENoZWNrLnJlc29sdmVkKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwOTsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFByb2plY3QgJyR7ZGVzdE5hbWV9JyBhbHJlYWR5IGV4aXN0c2AgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IFNLSVBfQ09QWSA9IG5ldyBTZXQoW1wibm9kZV9tb2R1bGVzXCIsIFwiLmdpdFwiLCBcIi5uZXh0XCIsIFwiLm51eHRcIiwgXCJkaXN0XCIsIFwiLmNhY2hlXCIsIFwiLnR1cmJvXCIsIFwiLnZlcmNlbFwiLCBcIi5vdXRwdXRcIiwgXCIuc3ZlbHRlLWtpdFwiLCBcIl9fcHljYWNoZV9fXCIsIFwiLnBhcmNlbC1jYWNoZVwiLCBcImJ1bi5sb2NrXCIsIFwicHJvamVjdHNcIiwgXCIubG9jYWxcIiwgXCJhdHRhY2hlZF9hc3NldHNcIl0pO1xuICAgICAgICAgIGZ1bmN0aW9uIGNvcHlGaWx0ZXJlZChzcmM6IHN0cmluZywgZGVzdDogc3RyaW5nKSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMubHN0YXRTeW5jKHNyYyk7XG4gICAgICAgICAgICBpZiAoc3RhdC5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhkZXN0LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBmcy5yZWFkZGlyU3luYyhzcmMpKSB7XG4gICAgICAgICAgICAgICAgaWYgKFNLSVBfQ09QWS5oYXMoZW50cnkpKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb3B5RmlsdGVyZWQocGF0aC5qb2luKHNyYywgZW50cnkpLCBwYXRoLmpvaW4oZGVzdCwgZW50cnkpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChzdGF0LmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhzcmMsIGRlc3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb3B5RmlsdGVyZWQoY2hlY2sucmVzb2x2ZWQsIGRlc3RDaGVjay5yZXNvbHZlZCk7XG4gICAgICAgICAgbGV0IGNvcGllZEZpbGVzID0gMDtcbiAgICAgICAgICBmdW5jdGlvbiBjb3VudENvcGllZEZpbGVzKGRpcjogc3RyaW5nKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGZzLnJlYWRkaXJTeW5jKGRpcikpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmdWxsID0gcGF0aC5qb2luKGRpciwgZW50cnkpO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBzID0gZnMubHN0YXRTeW5jKGZ1bGwpO1xuICAgICAgICAgICAgICAgICAgaWYgKHMuaXNGaWxlKCkpIGNvcGllZEZpbGVzKys7XG4gICAgICAgICAgICAgICAgICBlbHNlIGlmIChzLmlzRGlyZWN0b3J5KCkpIGNvdW50Q29waWVkRmlsZXMoZnVsbCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvdW50Q29waWVkRmlsZXMoZGVzdENoZWNrLnJlc29sdmVkKTtcbiAgICAgICAgICBpZiAoY29waWVkRmlsZXMgPT09IDApIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgW0xhbWJ5XSBEdXBsaWNhdGUgZmFpbGVkOiBcIiR7bmFtZX1cIiBcdTIxOTIgXCIke2Rlc3ROYW1lfVwiIHByb2R1Y2VkIDAgZmlsZXMgKHNvdXJjZTogJHtjaGVjay5yZXNvbHZlZH0pYCk7XG4gICAgICAgICAgICB0cnkgeyBmcy5ybVN5bmMoZGVzdENoZWNrLnJlc29sdmVkLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJEdXBsaWNhdGUgcHJvZHVjZWQgbm8gZmlsZXMgXHUyMDE0IHRoZSBzb3VyY2UgcHJvamVjdCBtYXkgYmUgZW1wdHkgb3IgY29udGFpbiBvbmx5IGV4Y2x1ZGVkIGRpcmVjdG9yaWVzLlwiIH0pKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc29sZS5sb2coYFtMYW1ieV0gRHVwbGljYXRlZCBcIiR7bmFtZX1cIiBcdTIxOTIgXCIke2Rlc3ROYW1lfVwiICgke2NvcGllZEZpbGVzfSBmaWxlcylgKTtcbiAgICAgICAgICBjb25zdCBwa2dQYXRoID0gcGF0aC5qb2luKGRlc3RDaGVjay5yZXNvbHZlZCwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGtnUGF0aCkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHBrZyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBrZ1BhdGgsIFwidXRmLThcIikpO1xuICAgICAgICAgICAgICBwa2cubmFtZSA9IGRlc3ROYW1lO1xuICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBrZ1BhdGgsIEpTT04uc3RyaW5naWZ5KHBrZywgbnVsbCwgMiksIFwidXRmLThcIik7XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBpbnN0YWxsZWQgPSBmYWxzZTtcbiAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwa2dQYXRoKSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgbG9ja0ZpbGUgPSBwYXRoLmpvaW4oZGVzdENoZWNrLnJlc29sdmVkLCBcInBhY2thZ2UtbG9jay5qc29uXCIpO1xuICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2NrRmlsZSkpIGZzLnVubGlua1N5bmMobG9ja0ZpbGUpO1xuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgY29uc3QgeyBleGVjU3luYyB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbGxDbWRzID0gW1xuICAgICAgICAgICAgICBcIm5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwc1wiLFxuICAgICAgICAgICAgICBcIm5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwcyAtLWlnbm9yZS1zY3JpcHRzXCIsXG4gICAgICAgICAgICAgIFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzIC0tZm9yY2UgLS1pZ25vcmUtc2NyaXB0c1wiLFxuICAgICAgICAgICAgXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY21kIG9mIGluc3RhbGxDbWRzKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZXhlY1N5bmMoY21kLCB7XG4gICAgICAgICAgICAgICAgICBjd2Q6IGRlc3RDaGVjay5yZXNvbHZlZCxcbiAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDEyMDAwMCxcbiAgICAgICAgICAgICAgICAgIHN0ZGlvOiBcInBpcGVcIixcbiAgICAgICAgICAgICAgICAgIHNoZWxsOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgZW52OiB7IC4uLnByb2Nlc3MuZW52LCBIVVNLWTogXCIwXCIsIERJU0FCTEVfT1BFTkNPTExFQ1RJVkU6IFwidHJ1ZVwiLCBBREJMT0NLOiBcIjFcIiB9LFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIG5hbWU6IGRlc3ROYW1lLCBvcmlnaW5hbE5hbWU6IG5hbWUsIGluc3RhbGxlZCB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvZmlsZXMtbWFpblwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IHJvb3REaXIgPSBwcm9jZXNzLmN3ZCgpO1xuICAgICAgICAgIGNvbnN0IFNLSVBfRElSUyA9IG5ldyBTZXQoW1wibm9kZV9tb2R1bGVzXCIsIFwiLmNhY2hlXCIsIFwiZGlzdFwiLCBcIi5naXRcIiwgXCIubmV4dFwiLCBcIi5udXh0XCIsIFwiLnR1cmJvXCIsIFwiLnZlcmNlbFwiLCBcIi5vdXRwdXRcIiwgXCIuc3ZlbHRlLWtpdFwiLCBcIl9fcHljYWNoZV9fXCIsIFwiLnBhcmNlbC1jYWNoZVwiLCBcInByb2plY3RzXCIsIFwiYXR0YWNoZWRfYXNzZXRzXCIsIFwiLmxvY2FsXCIsIFwiLmFnZW50c1wiLCBcIi51cG1cIiwgXCIuY29uZmlnXCIsIFwicGF0aFwiLCBcIi5yZXBsaXRcIl0pO1xuICAgICAgICAgIGZ1bmN0aW9uIHdhbGtEaXIoZGlyOiBzdHJpbmcsIGJhc2U6IHN0cmluZywgbWF4RGVwdGg6IG51bWJlcik6IGFueVtdIHtcbiAgICAgICAgICAgIGlmIChtYXhEZXB0aCA8PSAwKSByZXR1cm4gW107XG4gICAgICAgICAgICBsZXQgbmFtZXM6IHN0cmluZ1tdO1xuICAgICAgICAgICAgdHJ5IHsgbmFtZXMgPSBmcy5yZWFkZGlyU3luYyhkaXIpOyB9IGNhdGNoIHsgcmV0dXJuIFtdOyB9XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueVtdID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgbmFtZXMpIHtcbiAgICAgICAgICAgICAgaWYgKG5hbWUgPT09IFwiLkRTX1N0b3JlXCIgfHwgbmFtZSA9PT0gXCJidW4ubG9ja1wiIHx8IG5hbWUgPT09IFwicGFja2FnZS1sb2NrLmpzb25cIikgY29udGludWU7XG4gICAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGRpciwgbmFtZSk7XG4gICAgICAgICAgICAgIGNvbnN0IHJlbFBhdGggPSBiYXNlID8gYmFzZSArIFwiL1wiICsgbmFtZSA6IG5hbWU7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLmxzdGF0U3luYyhmdWxsUGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKHN0YXQuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgICAgaWYgKFNLSVBfRElSUy5oYXMobmFtZSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgY29uc3QgY2hpbGRyZW4gPSB3YWxrRGlyKGZ1bGxQYXRoLCByZWxQYXRoLCBtYXhEZXB0aCAtIDEpO1xuICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goeyBuYW1lLCBwYXRoOiByZWxQYXRoLCB0eXBlOiBcImRpcmVjdG9yeVwiLCBjaGlsZHJlbiB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHN0YXQuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHsgbmFtZSwgcGF0aDogcmVsUGF0aCwgdHlwZTogXCJmaWxlXCIgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0LnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiB7XG4gICAgICAgICAgICAgIGlmIChhLnR5cGUgPT09IGIudHlwZSkgcmV0dXJuIGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSk7XG4gICAgICAgICAgICAgIHJldHVybiBhLnR5cGUgPT09IFwiZGlyZWN0b3J5XCIgPyAtMSA6IDE7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgdHJlZSA9IHdhbGtEaXIocm9vdERpciwgXCJcIiwgNik7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIG5hbWU6IFwiX19tYWluX19cIiwgZmlsZXM6IHRyZWUgfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL2ZpbGVzXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBpZiAoIW5hbWUpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiTWlzc2luZyBwcm9qZWN0IG5hbWVcIiB9KSk7IHJldHVybjsgfVxuICAgICAgICAgIGNvbnN0IGNoZWNrID0gdmFsaWRhdGVQcm9qZWN0UGF0aChuYW1lKTtcbiAgICAgICAgICBpZiAoIWNoZWNrLnZhbGlkKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAzOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBjaGVjay5lcnJvciB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoY2hlY2sucmVzb2x2ZWQpKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA0OyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIlByb2plY3Qgbm90IGZvdW5kXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IFNLSVBfRElSUyA9IG5ldyBTZXQoW1wibm9kZV9tb2R1bGVzXCIsIFwiLmNhY2hlXCIsIFwiZGlzdFwiLCBcIi5naXRcIiwgXCIubmV4dFwiLCBcIi5udXh0XCIsIFwiLnR1cmJvXCIsIFwiLnZlcmNlbFwiLCBcIi5vdXRwdXRcIiwgXCIuc3ZlbHRlLWtpdFwiLCBcIl9fcHljYWNoZV9fXCIsIFwiLnBhcmNlbC1jYWNoZVwiXSk7XG4gICAgICAgICAgZnVuY3Rpb24gd2Fsa0RpcihkaXI6IHN0cmluZywgYmFzZTogc3RyaW5nKTogYW55W10ge1xuICAgICAgICAgICAgbGV0IG5hbWVzOiBzdHJpbmdbXTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIG5hbWVzID0gZnMucmVhZGRpclN5bmMoZGlyKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueVtdID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgbmFtZXMpIHtcbiAgICAgICAgICAgICAgaWYgKG5hbWUgPT09IFwiLkRTX1N0b3JlXCIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihkaXIsIG5hbWUpO1xuICAgICAgICAgICAgICBjb25zdCByZWxQYXRoID0gYmFzZSA/IGJhc2UgKyBcIi9cIiArIG5hbWUgOiBuYW1lO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5sc3RhdFN5bmMoZnVsbFBhdGgpO1xuICAgICAgICAgICAgICAgIGlmIChzdGF0LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICAgIGlmIChTS0lQX0RJUlMuaGFzKG5hbWUpKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkcmVuID0gd2Fsa0RpcihmdWxsUGF0aCwgcmVsUGF0aCk7XG4gICAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh7IG5hbWUsIHBhdGg6IHJlbFBhdGgsIHR5cGU6IFwiZGlyZWN0b3J5XCIsIGNoaWxkcmVuIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goeyBuYW1lLCBwYXRoOiByZWxQYXRoLCB0eXBlOiBcImZpbGVcIiB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgICBpZiAoYS50eXBlID09PSBiLnR5cGUpIHJldHVybiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpO1xuICAgICAgICAgICAgICByZXR1cm4gYS50eXBlID09PSBcImRpcmVjdG9yeVwiID8gLTEgOiAxO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgdHJlZSA9IHdhbGtEaXIoY2hlY2sucmVzb2x2ZWQsIFwiXCIpO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBuYW1lLCBmaWxlczogdHJlZSB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvcmVhZC1maWxlXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSwgZmlsZVBhdGggfSA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEJvZHkocmVxKSk7XG4gICAgICAgICAgaWYgKCFuYW1lIHx8ICFmaWxlUGF0aCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJNaXNzaW5nIG5hbWUgb3IgZmlsZVBhdGhcIiB9KSk7IHJldHVybjsgfVxuICAgICAgICAgIGNvbnN0IGNoZWNrID0gdmFsaWRhdGVQcm9qZWN0UGF0aChuYW1lLCBmaWxlUGF0aCk7XG4gICAgICAgICAgaWYgKCFjaGVjay52YWxpZCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMzsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogY2hlY2suZXJyb3IgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgZXhpc3RzID0gZnMuZXhpc3RzU3luYyhjaGVjay5yZXNvbHZlZCk7XG4gICAgICAgICAgY29uc3QgY29udGVudCA9IGV4aXN0cyA/IGZzLnJlYWRGaWxlU3luYyhjaGVjay5yZXNvbHZlZCwgXCJ1dGYtOFwiKSA6IFwiXCI7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIGV4aXN0cywgY29udGVudCwgZmlsZVBhdGggfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL3dyaXRlLWZpbGVcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBuYW1lLCBmaWxlUGF0aCwgY29udGVudCB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBpZiAoIW5hbWUgfHwgIWZpbGVQYXRoIHx8IHR5cGVvZiBjb250ZW50ICE9PSBcInN0cmluZ1wiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIk1pc3NpbmcgbmFtZSwgZmlsZVBhdGgsIG9yIGNvbnRlbnRcIiB9KSk7IHJldHVybjsgfVxuICAgICAgICAgIGNvbnN0IGNoZWNrID0gdmFsaWRhdGVQcm9qZWN0UGF0aChuYW1lLCBmaWxlUGF0aCk7XG4gICAgICAgICAgaWYgKCFjaGVjay52YWxpZCkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMzsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogY2hlY2suZXJyb3IgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgZGlyID0gcGF0aC5kaXJuYW1lKGNoZWNrLnJlc29sdmVkKTtcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZGlyKSkgZnMubWtkaXJTeW5jKGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbiAgICAgICAgICBsZXQgcHJldmlvdXNDb250ZW50ID0gXCJcIjtcbiAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhjaGVjay5yZXNvbHZlZCkpIHByZXZpb3VzQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhjaGVjay5yZXNvbHZlZCwgXCJ1dGYtOFwiKTtcblxuICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoY2hlY2sucmVzb2x2ZWQsIGNvbnRlbnQsIFwidXRmLThcIik7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIGZpbGVQYXRoLCBwcmV2aW91c0NvbnRlbnQsIGJ5dGVzV3JpdHRlbjogY29udGVudC5sZW5ndGggfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHByZXZpZXdQcm9jZXNzZXMgPSBuZXcgTWFwPHN0cmluZywgeyBwcm9jZXNzOiBhbnk7IHBvcnQ6IG51bWJlciB9PigpO1xuICAgICAgY29uc3QgcHJvamVjdFBvcnQgPSAobmFtZTogc3RyaW5nKTogbnVtYmVyID0+IHtcbiAgICAgICAgbGV0IGhhc2ggPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5hbWUubGVuZ3RoOyBpKyspIGhhc2ggPSAoKGhhc2ggPDwgNSkgLSBoYXNoICsgbmFtZS5jaGFyQ29kZUF0KGkpKSB8IDA7XG4gICAgICAgIHJldHVybiA1MTAwICsgKCgoaGFzaCAlIDEwMCkgKyAxMDApICUgMTAwKTtcbiAgICAgIH07XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL3ByZXZpZXdcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBuYW1lIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghbmFtZSB8fCAvW1xcL1xcXFxdfFxcLlxcLi8udGVzdChuYW1lKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIkludmFsaWQgcHJvamVjdCBuYW1lXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcInByb2plY3RzXCIsIG5hbWUpO1xuICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwNDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIlByb2plY3Qgbm90IGZvdW5kXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGlmIChwcmV2aWV3UHJvY2Vzc2VzLmhhcyhuYW1lKSkge1xuICAgICAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBwcmV2aWV3UHJvY2Vzc2VzLmdldChuYW1lKSE7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEtpbGxpbmcgZXhpc3RpbmcgcHJldmlldyBmb3IgJHtuYW1lfSAocG9ydCAke2V4aXN0aW5nLnBvcnR9KWApO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIikge1xuICAgICAgICAgICAgICAgIHRyeSB7IGNvbnN0IHsgZXhlY1N5bmM6IGVzIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpOyBlcyhgdGFza2tpbGwgL3BpZCAke2V4aXN0aW5nLnByb2Nlc3MucGlkfSAvVCAvRmAsIHsgc3RkaW86IFwicGlwZVwiLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRyeSB7IHByb2Nlc3Mua2lsbCgtZXhpc3RpbmcucHJvY2Vzcy5waWQsIDkpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdHJ5IHsgZXhpc3RpbmcucHJvY2Vzcy5raWxsKFwiU0lHS0lMTFwiKTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUobmFtZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGV0IHBvcnQgPSBwcm9qZWN0UG9ydChuYW1lKTtcbiAgICAgICAgICBjb25zdCB1c2VkUG9ydHMgPSBuZXcgU2V0KFsuLi5wcmV2aWV3UHJvY2Vzc2VzLnZhbHVlcygpXS5tYXAoZSA9PiBlLnBvcnQpKTtcbiAgICAgICAgICB3aGlsZSAodXNlZFBvcnRzLmhhcyhwb3J0KSkgcG9ydCsrO1xuICAgICAgICAgIGNvbnN0IHsgc3Bhd24sIGV4ZWNTeW5jIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuXG4gICAgICAgICAgY29uc3QgbmV0ID0gYXdhaXQgaW1wb3J0KFwibmV0XCIpO1xuXG4gICAgICAgICAgY29uc3Qga2lsbFBvcnRQcm9jcyA9IGFzeW5jIChwOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCIpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoYG5ldHN0YXQgLWFubyB8IGZpbmRzdHIgOiR7cH1gLCB7IHN0ZGlvOiBcInBpcGVcIiwgZW5jb2Rpbmc6IFwidXRmLThcIiwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICBjb25zdCBwaWRzID0gbmV3IFNldChvdXQuc3BsaXQoXCJcXG5cIikubWFwKChsOiBzdHJpbmcpID0+IGwudHJpbSgpLnNwbGl0KC9cXHMrLykucG9wKCkpLmZpbHRlcigocHA6IGFueSkgPT4gcHAgJiYgL15cXGQrJC8udGVzdChwcCkgJiYgcHAgIT09IFwiMFwiKSk7XG4gICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHBpZCBvZiBwaWRzKSB7IHRyeSB7IGV4ZWNTeW5jKGB0YXNra2lsbCAvcGlkICR7cGlkfSAvVCAvRmAsIHsgc3RkaW86IFwicGlwZVwiLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fSB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRyeSB7IGV4ZWNTeW5jKGBmdXNlciAtayAke3B9L3RjcGAsIHsgc3RkaW86IFwicGlwZVwiLCB0aW1lb3V0OiA1MDAwIH0pOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkgeyBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFBvcnQgY2xlYW51cCBlcnJvcjogJHtlLm1lc3NhZ2V9YCk7IH1cbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3Qgd2FpdEZvclBvcnRGcmVlID0gYXN5bmMgKHA6IG51bWJlciwgbWF4V2FpdDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzdGFydFcgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgd2hpbGUgKERhdGUubm93KCkgLSBzdGFydFcgPCBtYXhXYWl0KSB7XG4gICAgICAgICAgICAgIGNvbnN0IGluVXNlID0gYXdhaXQgbmV3IFByb21pc2U8Ym9vbGVhbj4ocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcyA9IG5ldC5jcmVhdGVTZXJ2ZXIoKTtcbiAgICAgICAgICAgICAgICBzLm9uY2UoXCJlcnJvclwiLCAoKSA9PiByZXNvbHZlKHRydWUpKTtcbiAgICAgICAgICAgICAgICBzLm9uY2UoXCJsaXN0ZW5pbmdcIiwgKCkgPT4geyBzLmNsb3NlKCk7IHJlc29sdmUoZmFsc2UpOyB9KTtcbiAgICAgICAgICAgICAgICBzLmxpc3RlbihwLCBcIjAuMC4wLjBcIik7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBpZiAoIWluVXNlKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDIwMCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCBwb3J0SW5Vc2UgPSBhd2FpdCBuZXcgUHJvbWlzZTxib29sZWFuPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdGVzdGVyID0gbmV0LmNyZWF0ZVNlcnZlcigpLm9uY2UoXCJlcnJvclwiLCAoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgcmVzb2x2ZShlcnIuY29kZSA9PT0gXCJFQUREUklOVVNFXCIpO1xuICAgICAgICAgICAgfSkub25jZShcImxpc3RlbmluZ1wiLCAoKSA9PiB7XG4gICAgICAgICAgICAgIHRlc3Rlci5jbG9zZSgoKSA9PiByZXNvbHZlKGZhbHNlKSk7XG4gICAgICAgICAgICB9KS5saXN0ZW4ocG9ydCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKHBvcnRJblVzZSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBQb3J0ICR7cG9ydH0gc3RpbGwgaW4gdXNlIFx1MjAxNCBraWxsaW5nYCk7XG4gICAgICAgICAgICBhd2FpdCBraWxsUG9ydFByb2NzKHBvcnQpO1xuICAgICAgICAgICAgY29uc3QgZnJlZWQgPSBhd2FpdCB3YWl0Rm9yUG9ydEZyZWUocG9ydCwgMzAwMCk7XG4gICAgICAgICAgICBpZiAoIWZyZWVkKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUG9ydCAke3BvcnR9IHN0aWxsIG9jY3VwaWVkIGFmdGVyIDNzIFx1MjAxNCBwaWNraW5nIG5ldyBwb3J0YCk7XG4gICAgICAgICAgICAgIHBvcnQrKztcbiAgICAgICAgICAgICAgd2hpbGUgKHVzZWRQb3J0cy5oYXMocG9ydCkpIHBvcnQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZXQgaGFzUGtnID0gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIikpO1xuICAgICAgICAgIGNvbnN0IGhhc05vZGVNb2R1bGVzID0gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJub2RlX21vZHVsZXNcIikpO1xuXG4gICAgICAgICAgbGV0IHBrZzogYW55ID0ge307XG4gICAgICAgICAgbGV0IGVmZmVjdGl2ZVByb2plY3REaXIgPSBwcm9qZWN0RGlyO1xuICAgICAgICAgIGNvbnN0IFNVQl9DQU5ESURBVEVTID0gW1wiZnJvbnRlbmRcIiwgXCJjbGllbnRcIiwgXCJ3ZWJcIiwgXCJhcHBcIl07XG4gICAgICAgICAgaWYgKGhhc1BrZykge1xuICAgICAgICAgICAgdHJ5IHsgcGtnID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwicGFja2FnZS5qc29uXCIpLCBcInV0Zi04XCIpKTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgY29uc3Qgcm9vdFNjcmlwdHMgPSBwa2cuc2NyaXB0cyB8fCB7fTtcbiAgICAgICAgICAgIGNvbnN0IHJvb3REZXBzID0geyAuLi4ocGtnLmRlcGVuZGVuY2llcyB8fCB7fSksIC4uLihwa2cuZGV2RGVwZW5kZW5jaWVzIHx8IHt9KSB9O1xuICAgICAgICAgICAgY29uc3QgaGFzUm9vdFdlYkluZGljYXRvciA9IHJvb3RTY3JpcHRzLmRldiB8fCByb290U2NyaXB0cy5zdGFydCB8fCByb290U2NyaXB0cy5zZXJ2ZSB8fFxuICAgICAgICAgICAgICBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcInZ1ZVwiLCBcInN2ZWx0ZVwiLCBcIm5leHRcIiwgXCJudXh0XCIsIFwiQGFuZ3VsYXIvY29yZVwiLCBcInZpdGVcIiwgXCJwcmVhY3RcIiwgXCJzb2xpZC1qc1wiLCBcImFzdHJvXCJdLnNvbWUoZncgPT4gZncgaW4gcm9vdERlcHMpO1xuICAgICAgICAgICAgaWYgKCFoYXNSb290V2ViSW5kaWNhdG9yKSB7XG4gICAgICAgICAgICAgIGZvciAoY29uc3Qgc3ViIG9mIFNVQl9DQU5ESURBVEVTKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3ViUGtnUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBzdWIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHN1YlBrZ1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdWJQa2cgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhzdWJQa2dQYXRoLCBcInV0Zi04XCIpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ViRGVwcyA9IHsgLi4uKHN1YlBrZy5kZXBlbmRlbmNpZXMgfHwge30pLCAuLi4oc3ViUGtnLmRldkRlcGVuZGVuY2llcyB8fCB7fSkgfTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ViU2NyaXB0cyA9IHN1YlBrZy5zY3JpcHRzIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoYXNTdWJXZWJDb25maWcgPSBbXCJ2aXRlLmNvbmZpZy50c1wiLCBcInZpdGUuY29uZmlnLmpzXCIsIFwidml0ZS5jb25maWcubXRzXCIsIFwidml0ZS5jb25maWcubWpzXCIsIFwibmV4dC5jb25maWcuanNcIiwgXCJuZXh0LmNvbmZpZy5tanNcIiwgXCJuZXh0LmNvbmZpZy50c1wiXS5zb21lKGYgPT4gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgc3ViLCBmKSkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3ViU2NyaXB0cy5kZXYgfHwgc3ViU2NyaXB0cy5zdGFydCB8fCBoYXNTdWJXZWJDb25maWcgfHwgW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIiwgXCJ2dWVcIiwgXCJ2aXRlXCIsIFwibmV4dFwiLCBcIm51eHRcIl0uc29tZShmdyA9PiBmdyBpbiBzdWJEZXBzKSkge1xuICAgICAgICAgICAgICAgICAgICAgIHBrZyA9IHN1YlBrZztcbiAgICAgICAgICAgICAgICAgICAgICBlZmZlY3RpdmVQcm9qZWN0RGlyID0gcGF0aC5qb2luKHByb2plY3REaXIsIHN1Yik7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBSb290IHBhY2thZ2UuanNvbiBoYXMgbm8gd2ViIHNldHVwIFx1MjAxNCB1c2luZyAke3N1Yn0vcGFja2FnZS5qc29uIGZvciAke25hbWV9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChjb25zdCBzdWIgb2YgU1VCX0NBTkRJREFURVMpIHtcbiAgICAgICAgICAgICAgY29uc3Qgc3ViUGtnUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBzdWIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhzdWJQa2dQYXRoKSkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICBwa2cgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhzdWJQa2dQYXRoLCBcInV0Zi04XCIpKTtcbiAgICAgICAgICAgICAgICAgIGVmZmVjdGl2ZVByb2plY3REaXIgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgc3ViKTtcbiAgICAgICAgICAgICAgICAgIGhhc1BrZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIE5vIHJvb3QgcGFja2FnZS5qc29uIFx1MjAxNCB1c2luZyAke3N1Yn0vcGFja2FnZS5qc29uIGZvciAke25hbWV9YCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZGV0ZWN0UGFja2FnZU1hbmFnZXIgPSAoKTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZGlyIG9mIFtlZmZlY3RpdmVQcm9qZWN0RGlyLCBwcm9qZWN0RGlyXSkge1xuICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZGlyLCBcImJ1bi5sb2NrYlwiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZGlyLCBcImJ1bi5sb2NrXCIpKSkgcmV0dXJuIFwiYnVuXCI7XG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihkaXIsIFwicG5wbS1sb2NrLnlhbWxcIikpKSByZXR1cm4gXCJwbnBtXCI7XG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihkaXIsIFwieWFybi5sb2NrXCIpKSkgcmV0dXJuIFwieWFyblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIFwibnBtXCI7XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IHBtID0gZGV0ZWN0UGFja2FnZU1hbmFnZXIoKTtcblxuICAgICAgICAgIGNvbnN0IHNhZmVJbnN0YWxsRW52ID0geyAuLi5wcm9jZXNzLmVudiwgSFVTS1k6IFwiMFwiLCBucG1fY29uZmlnX2lnbm9yZV9zY3JpcHRzOiBcIlwiLCBESVNBQkxFX09QRU5DT0xMRUNUSVZFOiBcInRydWVcIiwgQURCTE9DSzogXCIxXCIgfTtcbiAgICAgICAgICBjb25zdCBlbnN1cmVHaXREaXIgPSAoZGlyOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGdpdERpciA9IHBhdGguam9pbihkaXIsIFwiLmdpdFwiKTtcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhnaXREaXIpKSB7XG4gICAgICAgICAgICAgIHRyeSB7IGZzLm1rZGlyU3luYyhnaXREaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyBjb25zb2xlLmxvZyhgW1ByZXZpZXddIENyZWF0ZWQgcGxhY2Vob2xkZXIgLmdpdCBpbiAke2Rpcn1gKTsgfVxuICAgICAgICAgICAgICBjYXRjaCB7fVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgICAgY29uc3Qgc2FmZUV4ZWNJbnN0YWxsID0gKGNtZDogc3RyaW5nLCBjd2Q6IHN0cmluZywgbGFiZWw6IHN0cmluZywgdGltZW91dE1zID0gMTIwMDAwKTogYm9vbGVhbiA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddICR7bGFiZWx9OiAke2NtZH1gKTtcbiAgICAgICAgICAgICAgZXhlY1N5bmMoY21kLCB7IGN3ZCwgdGltZW91dDogdGltZW91dE1zLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlLCB3aW5kb3dzSGlkZTogdHJ1ZSwgZW52OiBzYWZlSW5zdGFsbEVudiB9KTtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSAke2xhYmVsfTogc3VjY2Vzc2ApO1xuICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gJHtsYWJlbH0gZmFpbGVkOmAsIGUubWVzc2FnZT8uc2xpY2UoMCwgMzAwKSk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgaWYgKGhhc1BrZyAmJiAhZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZWZmZWN0aXZlUHJvamVjdERpciwgXCJub2RlX21vZHVsZXNcIikpKSB7XG4gICAgICAgICAgICBlbnN1cmVHaXREaXIoZWZmZWN0aXZlUHJvamVjdERpcik7XG4gICAgICAgICAgICBpZiAoZWZmZWN0aXZlUHJvamVjdERpciAhPT0gcHJvamVjdERpcikgZW5zdXJlR2l0RGlyKHByb2plY3REaXIpO1xuICAgICAgICAgICAgY29uc3QgaW5zdGFsbENtZCA9IHBtID09PSBcIm5wbVwiID8gXCJucG0gaW5zdGFsbCAtLWxlZ2FjeS1wZWVyLWRlcHNcIlxuICAgICAgICAgICAgICA6IHBtID09PSBcInBucG1cIiA/IFwibnB4IHBucG0gaW5zdGFsbCAtLW5vLWZyb3plbi1sb2NrZmlsZVwiXG4gICAgICAgICAgICAgIDogcG0gPT09IFwieWFyblwiID8gXCJucHggeWFybiBpbnN0YWxsIC0taWdub3JlLWVuZ2luZXNcIlxuICAgICAgICAgICAgICA6IFwibnB4IGJ1biBpbnN0YWxsXCI7XG4gICAgICAgICAgICBpZiAoIXNhZmVFeGVjSW5zdGFsbChpbnN0YWxsQ21kLCBlZmZlY3RpdmVQcm9qZWN0RGlyLCBgSW5zdGFsbCBkZXBzIGZvciAke25hbWV9YCkpIHtcbiAgICAgICAgICAgICAgaWYgKCFzYWZlRXhlY0luc3RhbGwoXCJucG0gaW5zdGFsbCAtLWxlZ2FjeS1wZWVyLWRlcHMgLS1pZ25vcmUtc2NyaXB0c1wiLCBlZmZlY3RpdmVQcm9qZWN0RGlyLCBgUmV0cnkgKGlnbm9yZS1zY3JpcHRzKSBmb3IgJHtuYW1lfWApKSB7XG4gICAgICAgICAgICAgICAgc2FmZUV4ZWNJbnN0YWxsKFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzIC0tZm9yY2UgLS1pZ25vcmUtc2NyaXB0c1wiLCBlZmZlY3RpdmVQcm9qZWN0RGlyLCBgRmluYWwgcmV0cnkgKGZvcmNlK2lnbm9yZS1zY3JpcHRzKSBmb3IgJHtuYW1lfWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgU1VCRElSX0NBTkRJREFURVMgPSBbXCJmcm9udGVuZFwiLCBcImNsaWVudFwiLCBcIndlYlwiLCBcImFwcFwiXTtcbiAgICAgICAgICBjb25zdCBkZXRlY3REZXZDb21tYW5kID0gKCk6IHsgY21kOiBzdHJpbmc7IGFyZ3M6IHN0cmluZ1tdIH0gPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0cyA9IHBrZy5zY3JpcHRzIHx8IHt9O1xuICAgICAgICAgICAgY29uc3QgZGVwcyA9IHsgLi4uKHBrZy5kZXBlbmRlbmNpZXMgfHwge30pLCAuLi4ocGtnLmRldkRlcGVuZGVuY2llcyB8fCB7fSkgfTtcbiAgICAgICAgICAgIGNvbnN0IHBvcnRTdHIgPSBTdHJpbmcocG9ydCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1hdGNoU2NyaXB0ID0gKHNjcmlwdEJvZHk6IHN0cmluZyk6IHsgY21kOiBzdHJpbmc7IGFyZ3M6IHN0cmluZ1tdIH0gfCBudWxsID0+IHtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJuZXh0XCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcIm5leHRcIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0ciwgXCItLWhvc3RuYW1lXCIsIFwiMC4wLjAuMFwiXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInJlYWN0LXNjcmlwdHNcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicmVhY3Qtc2NyaXB0c1wiLCBcInN0YXJ0XCJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwibnV4dFwiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJudXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwiYXN0cm9cIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wiYXN0cm9cIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0ciwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwibmcgXCIpIHx8IHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJuZyBzZXJ2ZVwiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJuZ1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyLCBcIi0tZGlzYWJsZS1ob3N0LWNoZWNrXCJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwicmVtaXhcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicmVtaXhcIiwgXCJ2aXRlOmRldlwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJnYXRzYnlcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wiZ2F0c2J5XCIsIFwiZGV2ZWxvcFwiLCBcIi1IXCIsIFwiMC4wLjAuMFwiLCBcIi1wXCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwid2VicGFja1wiKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHdwQXJncyA9IFtcIndlYnBhY2tcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl07XG4gICAgICAgICAgICAgICAgY29uc3QgY2ZnTSA9IHNjcmlwdEJvZHkubWF0Y2goLyg/Oi0tY29uZmlnWz1cXHNdfC1jXFxzKShcXFMrKS8pO1xuICAgICAgICAgICAgICAgIGlmIChjZmdNKSB3cEFyZ3Muc3BsaWNlKDIsIDAsIFwiLS1jb25maWdcIiwgY2ZnTVsxXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiB3cEFyZ3MgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInJzcGFja1wiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJyc3BhY2tcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJzdmVsdGVcIikgfHwgc2NyaXB0Qm9keS5pbmNsdWRlcyhcInN2ZWx0ZWtpdFwiKSkgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwidnVlLWNsaS1zZXJ2aWNlXCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZ1ZS1jbGktc2VydmljZVwiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInBhcmNlbFwiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJwYXJjZWxcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwiZW1iZXJcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wiZW1iZXJcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJ2aXRlXCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3QgZXh0cmFjdERldlNlcnZlckNtZCA9IChzY3JpcHRCb2R5OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICAgICAgICAgICAgICBsZXQgY2xlYW5lZCA9IHNjcmlwdEJvZHk7XG4gICAgICAgICAgICAgIGNsZWFuZWQgPSBjbGVhbmVkLnJlcGxhY2UoL15jcm9zcy1lbnZcXHMrW1xcdz1dK1xccyovZywgXCJcIik7XG4gICAgICAgICAgICAgIGNsZWFuZWQgPSBjbGVhbmVkLnJlcGxhY2UoL15kb3RlbnZcXHMrKC1lXFxzK1xcUytcXHMrKSotLVxccyovZywgXCJcIik7XG4gICAgICAgICAgICAgIGNsZWFuZWQgPSBjbGVhbmVkLnJlcGxhY2UoL15lbnYtY21kXFxzKygtZlxccytcXFMrXFxzKykqL2csIFwiXCIpO1xuICAgICAgICAgICAgICBpZiAoY2xlYW5lZC5pbmNsdWRlcyhcImNvbmN1cnJlbnRseVwiKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gY2xlYW5lZC5tYXRjaCgvXCIoW15cIl0rKVwifCcoW14nXSspJy9nKTtcbiAgICAgICAgICAgICAgICBpZiAocGFydHMpIHtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbm5lciA9IHBhcnQucmVwbGFjZSgvXltcIiddfFtcIiddJC9nLCBcIlwiKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF0Y2hlZCA9IG1hdGNoU2NyaXB0KGlubmVyKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoZWQpIHJldHVybiBpbm5lcjtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNsZWFuZWQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGNsZWFuZWQuaW5jbHVkZXMoXCImJlwiKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlZ21lbnRzID0gY2xlYW5lZC5zcGxpdChcIiYmXCIpLm1hcChzID0+IHMudHJpbSgpKTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHNlZyBvZiBzZWdtZW50cykge1xuICAgICAgICAgICAgICAgICAgaWYgKC9edHNjXFxifF50c2Mtd2F0Y2h8Xm5vZGVcXHN8XmVjaG9cXGJ8XnJtXFxzfF5jcFxcc3xebWtkaXJcXHMvLnRlc3Qoc2VnKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICBjb25zdCBtYXRjaGVkID0gbWF0Y2hTY3JpcHQoc2VnKTtcbiAgICAgICAgICAgICAgICAgIGlmIChtYXRjaGVkKSByZXR1cm4gc2VnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBsYXN0U2VnID0gc2VnbWVudHNbc2VnbWVudHMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxhc3RTZWcgfHwgY2xlYW5lZDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoY2xlYW5lZC5pbmNsdWRlcyhcInx8XCIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBjbGVhbmVkLnNwbGl0KFwifHxcIikubWFwKHMgPT4gcy50cmltKCkpO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgc2VnIG9mIHNlZ21lbnRzKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBtYXRjaGVkID0gbWF0Y2hTY3JpcHQoc2VnKTtcbiAgICAgICAgICAgICAgICAgIGlmIChtYXRjaGVkKSByZXR1cm4gc2VnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gY2xlYW5lZDtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IGlzU3ZlbHRlS2l0ID0gZGVwc1tcIkBzdmVsdGVqcy9raXRcIl0gfHwgZGVwc1tcInN2ZWx0ZWtpdFwiXTtcbiAgICAgICAgICAgIGNvbnN0IGlzUG5wbU1vbm9yZXBvID0gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwbnBtLXdvcmtzcGFjZS55YW1sXCIpKTtcblxuICAgICAgICAgICAgaWYgKGlzUG5wbU1vbm9yZXBvKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgd3NZYW1sID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0td29ya3NwYWNlLnlhbWxcIiksIFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgY29uc3QgaGFzUGFja2FnZXMgPSB3c1lhbWwuaW5jbHVkZXMoXCJwYWNrYWdlczpcIik7XG4gICAgICAgICAgICAgICAgaWYgKGhhc1BhY2thZ2VzKSB7XG4gICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhzY3JpcHRzKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2NyaXB0c1trZXldLmluY2x1ZGVzKFwiLS1maWx0ZXJcIikgJiYgKGtleS5pbmNsdWRlcyhcImRldlwiKSB8fCBrZXkgPT09IFwibHA6ZGV2XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBEZXRlY3RlZCBwbnBtIG1vbm9yZXBvLCB1c2luZyBzY3JpcHQgXCIke2tleX1cIjogJHtzY3JpcHRzW2tleV19YCk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgY21kOiBwbSA9PT0gXCJwbnBtXCIgPyBcInBucG1cIiA6IFwibnB4IHBucG1cIiwgYXJnczogW1wicnVuXCIsIGtleV0gfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2NyaXB0cy5kZXYpIHtcbiAgICAgICAgICAgICAgaWYgKGlzU3ZlbHRlS2l0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJ2aXRlXCIsIFwiZGV2XCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IGV4dHJhY3RlZCA9IGV4dHJhY3REZXZTZXJ2ZXJDbWQoc2NyaXB0cy5kZXYpO1xuICAgICAgICAgICAgICBjb25zdCBtYXRjaGVkID0gbWF0Y2hTY3JpcHQoZXh0cmFjdGVkKTtcbiAgICAgICAgICAgICAgaWYgKG1hdGNoZWQpIHJldHVybiBtYXRjaGVkO1xuICAgICAgICAgICAgICByZXR1cm4geyBjbWQ6IHBtID09PSBcIm5wbVwiID8gXCJucG1cIiA6IGBucHggJHtwbX1gLCBhcmdzOiBwbSA9PT0gXCJucG1cIiA/IFtcInJ1blwiLCBcImRldlwiXSA6IFtcInJ1blwiLCBcImRldlwiXSB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2NyaXB0cy5zdGFydCkge1xuICAgICAgICAgICAgICBjb25zdCBleHRyYWN0ZWQgPSBleHRyYWN0RGV2U2VydmVyQ21kKHNjcmlwdHMuc3RhcnQpO1xuICAgICAgICAgICAgICBjb25zdCBtYXRjaGVkID0gbWF0Y2hTY3JpcHQoZXh0cmFjdGVkKTtcbiAgICAgICAgICAgICAgaWYgKG1hdGNoZWQpIHJldHVybiBtYXRjaGVkO1xuICAgICAgICAgICAgICByZXR1cm4geyBjbWQ6IHBtID09PSBcIm5wbVwiID8gXCJucG1cIiA6IGBucHggJHtwbX1gLCBhcmdzOiBwbSA9PT0gXCJucG1cIiA/IFtcInJ1blwiLCBcInN0YXJ0XCJdIDogW1wicnVuXCIsIFwic3RhcnRcIl0gfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNjcmlwdHMuc2VydmUgfHwgc2NyaXB0c1tcInNlcnZlOnJzcGFja1wiXSkge1xuICAgICAgICAgICAgICBjb25zdCBzZXJ2ZVNjcmlwdCA9IHNjcmlwdHMuc2VydmUgfHwgc2NyaXB0c1tcInNlcnZlOnJzcGFja1wiXTtcbiAgICAgICAgICAgICAgY29uc3QgZXh0cmFjdGVkID0gZXh0cmFjdERldlNlcnZlckNtZChzZXJ2ZVNjcmlwdCk7XG4gICAgICAgICAgICAgIGNvbnN0IG1hdGNoZWQgPSBtYXRjaFNjcmlwdChleHRyYWN0ZWQpO1xuICAgICAgICAgICAgICBpZiAobWF0Y2hlZCkgcmV0dXJuIG1hdGNoZWQ7XG4gICAgICAgICAgICAgIGNvbnN0IHNlcnZlS2V5ID0gc2NyaXB0cy5zZXJ2ZSA/IFwic2VydmVcIiA6IFwic2VydmU6cnNwYWNrXCI7XG4gICAgICAgICAgICAgIHJldHVybiB7IGNtZDogcG0gPT09IFwibnBtXCIgPyBcIm5wbVwiIDogYG5weCAke3BtfWAsIGFyZ3M6IHBtID09PSBcIm5wbVwiID8gW1wicnVuXCIsIHNlcnZlS2V5XSA6IFtcInJ1blwiLCBzZXJ2ZUtleV0gfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgW1wiZGV2ZWxvcFwiLCBcImRldjphcHBcIiwgXCJkZXY6Y2xpZW50XCIsIFwiZGV2OmZyb250ZW5kXCIsIFwiZGV2OndlYlwiLCBcIndhdGNoXCJdKSB7XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRzW2tleV0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBleHRyYWN0ZWQgPSBleHRyYWN0RGV2U2VydmVyQ21kKHNjcmlwdHNba2V5XSk7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2hlZCA9IG1hdGNoU2NyaXB0KGV4dHJhY3RlZCk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoZWQpIHJldHVybiBtYXRjaGVkO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGNtZDogcG0gPT09IFwibnBtXCIgPyBcIm5wbVwiIDogYG5weCAke3BtfWAsIGFyZ3M6IHBtID09PSBcIm5wbVwiID8gW1wicnVuXCIsIGtleV0gOiBbXCJydW5cIiwga2V5XSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkZXBzW1wibmV4dFwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJuZXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHIsIFwiLS1ob3N0bmFtZVwiLCBcIjAuMC4wLjBcIl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wicmVhY3Qtc2NyaXB0c1wiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJyZWFjdC1zY3JpcHRzXCIsIFwic3RhcnRcIl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wibnV4dFwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJudXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcImFzdHJvXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcImFzdHJvXCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJAYW5ndWxhci9jbGlcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wibmdcIiwgXCJzZXJ2ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0ciwgXCItLWRpc2FibGUtaG9zdC1jaGVja1wiXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJAcmVtaXgtcnVuL2RldlwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJyZW1peFwiLCBcInZpdGU6ZGV2XCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJnYXRzYnlcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wiZ2F0c2J5XCIsIFwiZGV2ZWxvcFwiLCBcIi1IXCIsIFwiMC4wLjAuMFwiLCBcIi1wXCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcIndlYnBhY2stZGV2LXNlcnZlclwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJ3ZWJwYWNrXCIsIFwic2VydmVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcIkByc3BhY2svY2xpXCJdIHx8IGRlcHNbXCJAcnNwYWNrL2NvcmVcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicnNwYWNrXCIsIFwic2VydmVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoZGVwc1tcInBhcmNlbFwiXSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJwYXJjZWxcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICBpZiAoaXNTdmVsdGVLaXQpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1widml0ZVwiLCBcImRldlwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcblxuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwidml0ZS5jb25maWcudHNcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwidml0ZS5jb25maWcuanNcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwidml0ZS5jb25maWcubWpzXCIpKSkge1xuICAgICAgICAgICAgICByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAoY29uc3Qgc3ViRGlyIG9mIFNVQkRJUl9DQU5ESURBVEVTKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHN1YlBhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgc3ViRGlyKTtcbiAgICAgICAgICAgICAgY29uc3Qgc3ViUGtnUGF0aCA9IHBhdGguam9pbihzdWJQYXRoLCBcInBhY2thZ2UuanNvblwiKTtcbiAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoc3ViUGtnUGF0aCkpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgY29uc3Qgc3ViUGtnID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc3ViUGtnUGF0aCwgXCJ1dGYtOFwiKSk7XG4gICAgICAgICAgICAgICAgICBjb25zdCBzdWJTY3JpcHRzID0gc3ViUGtnLnNjcmlwdHMgfHwge307XG4gICAgICAgICAgICAgICAgICBjb25zdCBzdWJEZXBzID0geyAuLi4oc3ViUGtnLmRlcGVuZGVuY2llcyB8fCB7fSksIC4uLihzdWJQa2cuZGV2RGVwZW5kZW5jaWVzIHx8IHt9KSB9O1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgW1wiZGV2XCIsIFwic3RhcnRcIiwgXCJzZXJ2ZVwiXSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3ViU2NyaXB0c1trZXldKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFjdGVkID0gZXh0cmFjdERldlNlcnZlckNtZChzdWJTY3JpcHRzW2tleV0pO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoZWQgPSBtYXRjaFNjcmlwdChleHRyYWN0ZWQpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEZvdW5kIGRldiBjb21tYW5kIGluICR7c3ViRGlyfS9wYWNrYWdlLmpzb24gc2NyaXB0IFwiJHtrZXl9XCJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtYXRjaGVkO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFVzaW5nICR7c3ViRGlyfS9wYWNrYWdlLmpzb24gc2NyaXB0IFwiJHtrZXl9XCI6ICR7c3ViU2NyaXB0c1trZXldfWApO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGNtZDogcG0gPT09IFwibnBtXCIgPyBcIm5wbVwiIDogYG5weCAke3BtfWAsIGFyZ3M6IFtcInJ1blwiLCBrZXksIFwiLS1wcmVmaXhcIiwgc3ViRGlyXSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpZiAoc3ViRGVwc1tcInZpdGVcIl0gfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oc3ViUGF0aCwgXCJ2aXRlLmNvbmZpZy50c1wiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oc3ViUGF0aCwgXCJ2aXRlLmNvbmZpZy5qc1wiKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBGb3VuZCB2aXRlIGluICR7c3ViRGlyfS8sIHJ1bm5pbmcgZnJvbSB0aGVyZWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHIsIFwiLS1yb290XCIsIHN1YkRpcl0gfTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFoYXNQa2cpIHtcbiAgICAgICAgICAgICAgY29uc3QgaGFzQW55SHRtbCA9IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwiaW5kZXguaHRtbFwiKSkgfHwgXG4gICAgICAgICAgICAgICAgKGZzLnJlYWRkaXJTeW5jKHByb2plY3REaXIpLnNvbWUoKGY6IHN0cmluZykgPT4gZi5lbmRzV2l0aChcIi5odG1sXCIpKSk7XG4gICAgICAgICAgICAgIGlmIChoYXNBbnlIdG1sKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1widml0ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgaWYgKCFoYXNQa2cpIHtcbiAgICAgICAgICAgIGxldCBoYXNSb290SW5kZXggPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcImluZGV4Lmh0bWxcIikpO1xuICAgICAgICAgICAgaWYgKCFoYXNSb290SW5kZXgpIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBkaXJGaWxlcyA9IGZzLnJlYWRkaXJTeW5jKHByb2plY3REaXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGh0bWxGaWxlcyA9IGRpckZpbGVzLmZpbHRlcigoZjogc3RyaW5nKSA9PiBmLmVuZHNXaXRoKFwiLmh0bWxcIikgJiYgZiAhPT0gXCJpbmRleC5odG1sXCIpO1xuICAgICAgICAgICAgICAgIGlmIChodG1sRmlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgY29uc3QgcHJpbWFyeUh0bWwgPSBodG1sRmlsZXNbMF07XG4gICAgICAgICAgICAgICAgICBjb25zdCByZWRpcmVjdENvbnRlbnQgPSBgPCFET0NUWVBFIGh0bWw+PGh0bWw+PGhlYWQ+PG1ldGEgaHR0cC1lcXVpdj1cInJlZnJlc2hcIiBjb250ZW50PVwiMDt1cmw9LyR7cHJpbWFyeUh0bWx9XCI+PHRpdGxlPlJlZGlyZWN0PC90aXRsZT48L2hlYWQ+PGJvZHk+PGEgaHJlZj1cIi8ke3ByaW1hcnlIdG1sfVwiPk9wZW48L2E+PC9ib2R5PjwvaHRtbD5gO1xuICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJpbmRleC5odG1sXCIpLCByZWRpcmVjdENvbnRlbnQpO1xuICAgICAgICAgICAgICAgICAgaGFzUm9vdEluZGV4ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gQ3JlYXRlZCBpbmRleC5odG1sIHJlZGlyZWN0IHRvICR7cHJpbWFyeUh0bWx9IGZvciAke25hbWV9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaGFzUm9vdEluZGV4KSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gU3RhdGljIEhUTUwgcHJvamVjdCBkZXRlY3RlZCBmb3IgJHtuYW1lfSwgYm9vdHN0cmFwcGluZyB3aXRoIHZpdGVgKTtcbiAgICAgICAgICAgICAgY29uc3QgbWluUGtnID0geyBuYW1lLCBwcml2YXRlOiB0cnVlLCBkZXZEZXBlbmRlbmNpZXM6IHsgdml0ZTogXCJeNVwiIH0gfTtcbiAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIiksIEpTT04uc3RyaW5naWZ5KG1pblBrZywgbnVsbCwgMikpO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgZXhlY1N5bmM6IGVzIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgICAgICAgIGVzKFwibnBtIGluc3RhbGxcIiwgeyBjd2Q6IHByb2plY3REaXIsIHRpbWVvdXQ6IDYwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBTdGF0aWMgSFRNTCBib290c3RyYXAgaW5zdGFsbCB3YXJuaW5nOiAke2UubWVzc2FnZT8uc2xpY2UoMCwgMjAwKX1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBwa2cgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIiksIFwidXRmLThcIikpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IEVYRUNVVEFCTEVfRVhUUyA9IFtcIi5leGVcIiwgXCIubXNpXCIsIFwiLmFwcGltYWdlXCIsIFwiLmFwcFwiLCBcIi5kbWdcIiwgXCIuZGViXCIsIFwiLnJwbVwiLCBcIi5zbmFwXCIsIFwiLmZsYXRwYWtcIl07XG4gICAgICAgICAgY29uc3QgZmluZEV4ZWN1dGFibGVzID0gKGRpcjogc3RyaW5nLCBkZXB0aCA9IDApOiB7IG5hbWU6IHN0cmluZzsgZnVsbFBhdGg6IHN0cmluZzsgZXh0OiBzdHJpbmcgfVtdID0+IHtcbiAgICAgICAgICAgIGlmIChkZXB0aCA+IDIpIHJldHVybiBbXTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IHsgbmFtZTogc3RyaW5nOyBmdWxsUGF0aDogc3RyaW5nOyBleHQ6IHN0cmluZyB9W10gPSBbXTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGVudHJpZXMgPSBmcy5yZWFkZGlyU3luYyhkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVudHJ5Lm5hbWUuc3RhcnRzV2l0aChcIi5cIikgfHwgZW50cnkubmFtZSA9PT0gXCJub2RlX21vZHVsZXNcIikgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4oZGlyLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoZW50cnkuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZShlbnRyeS5uYW1lKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgaWYgKEVYRUNVVEFCTEVfRVhUUy5pbmNsdWRlcyhleHQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7IG5hbWU6IGVudHJ5Lm5hbWUsIGZ1bGxQYXRoLCBleHQgfSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChlbnRyeS5pc0RpcmVjdG9yeSgpICYmIGRlcHRoIDwgMikge1xuICAgICAgICAgICAgICAgICAgY29uc3Qgc3ViID0gW1wiYmluXCIsIFwiYnVpbGRcIiwgXCJkaXN0XCIsIFwicmVsZWFzZVwiLCBcIlJlbGVhc2VcIiwgXCJvdXRcIiwgXCJvdXRwdXRcIiwgXCJhcnRpZmFjdHNcIiwgXCJyZWxlYXNlc1wiLCBcIl9yZWxlYXNlc1wiXTtcbiAgICAgICAgICAgICAgICAgIGlmIChkZXB0aCA9PT0gMCB8fCBzdWIuc29tZShzID0+IGVudHJ5Lm5hbWUudG9Mb3dlckNhc2UoKSA9PT0gcy50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goLi4uZmluZEV4ZWN1dGFibGVzKGZ1bGxQYXRoLCBkZXB0aCArIDEpKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgICAgIH07XG4gICAgICAgICAgY29uc3Qgb3MgPSBhd2FpdCBpbXBvcnQoXCJvc1wiKTtcbiAgICAgICAgICBjb25zdCBpc1dpbiA9IG9zLnBsYXRmb3JtKCkgPT09IFwid2luMzJcIjtcbiAgICAgICAgICBjb25zdCBpc01hYyA9IG9zLnBsYXRmb3JtKCkgPT09IFwiZGFyd2luXCI7XG4gICAgICAgICAgY29uc3QgaXNMaW51eCA9IG9zLnBsYXRmb3JtKCkgPT09IFwibGludXhcIjtcblxuICAgICAgICAgIGNvbnN0IHJlbGVhc2VzQ2xlYW51cERpciA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBcIl9yZWxlYXNlc1wiKTtcbiAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhyZWxlYXNlc0NsZWFudXBEaXIpKSB7XG4gICAgICAgICAgICBjb25zdCBzeXNBcmNoID0gb3MuYXJjaCgpO1xuICAgICAgICAgICAgY29uc3Qgd3JvbmdBcmNoUGF0dGVybnMgPSBzeXNBcmNoID09PSBcImFybTY0XCJcbiAgICAgICAgICAgICAgPyBbXCIteDY0LVwiLCBcIi14ODZfNjQtXCIsIFwiLWFtZDY0LVwiLCBcIi13aW42NC1cIiwgXCIueDY0LlwiLCBcIi54ODZfNjQuXCIsIFwiLmFtZDY0LlwiXVxuICAgICAgICAgICAgICA6IFtcIi1hcm02NC1cIiwgXCItYWFyY2g2NC1cIiwgXCIuYXJtNjQuXCIsIFwiLmFhcmNoNjQuXCJdO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgcmVsZWFzZUZpbGVzID0gZnMucmVhZGRpclN5bmMocmVsZWFzZXNDbGVhbnVwRGlyKTtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCByZiBvZiByZWxlYXNlRmlsZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZkxvd2VyID0gcmYudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICBpZiAod3JvbmdBcmNoUGF0dGVybnMuc29tZShwID0+IHJmTG93ZXIuaW5jbHVkZXMocCkpKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCByZlBhdGggPSBwYXRoLmpvaW4ocmVsZWFzZXNDbGVhbnVwRGlyLCByZik7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMocmZQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXQuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyhyZlBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBmcy51bmxpbmtTeW5jKHJmUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBEZWxldGVkIHdyb25nLWFyY2ggZmlsZTogJHtyZn0gKHN5c3RlbTogJHtzeXNBcmNofSlgKTtcbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGRlbEVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gQ291bGQgbm90IGRlbGV0ZSB3cm9uZy1hcmNoIGZpbGUgJHtyZn06ICR7ZGVsRXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDEwMCl9YCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3Qgbm9ybVBhdGggPSAocDogc3RyaW5nKSA9PiBpc1dpbiA/IHBhdGgubm9ybWFsaXplKHApLnJlcGxhY2UoL1xcLy9nLCBcIlxcXFxcIikgOiBwO1xuXG4gICAgICAgICAgY29uc3Qgc3Bhd25UZXJtaW5hbFdpdGhDb21tYW5kID0gKGN3ZDogc3RyaW5nLCBjbWQ6IHN0cmluZywgbGFiZWw6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2FmZUN3ZCA9IG5vcm1QYXRoKHBhdGgucmVzb2x2ZShjd2QpKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGlmIChpc1dpbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhdGNoUGF0aCA9IHBhdGguam9pbihzYWZlQ3dkLCBcIl9fbGFtYnlfcnVuLmJhdFwiKTtcbiAgICAgICAgICAgICAgICBjb25zdCBiYXRjaENvbnRlbnQgPSBgQGVjaG8gb2ZmXFxyXFxudGl0bGUgJHtsYWJlbC5yZXBsYWNlKC9bJnw8Pl4lXCJdL2csIFwiXCIpfVxcclxcbmNkIC9kIFwiJHtzYWZlQ3dkfVwiXFxyXFxuZWNoby5cXHJcXG5lY2hvIFtMYW1ieV0gUnVubmluZzogJHtjbWQucmVwbGFjZSgvWyZ8PD5eJV0vZywgXCIgXCIpfVxcclxcbmVjaG8uXFxyXFxuJHtjbWR9XFxyXFxuZWNoby5cXHJcXG5lY2hvIFtMYW1ieV0gQ29tbWFuZCBmaW5pc2hlZC4gUHJlc3MgYW55IGtleSB0byBjbG9zZS5cXHJcXG5wYXVzZSA+bnVsXFxyXFxuYDtcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGJhdGNoUGF0aCwgYmF0Y2hDb250ZW50KTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgZXhlY1N5bmMoYHN0YXJ0IFwiXCIgXCIke2JhdGNoUGF0aH1cImAsIHsgY3dkOiBzYWZlQ3dkLCBzaGVsbDogdHJ1ZSwgd2luZG93c0hpZGU6IGZhbHNlLCBzdGRpbzogXCJpZ25vcmVcIiwgdGltZW91dDogNTAwMCB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHNwYXduKFwiY21kLmV4ZVwiLCBbXCIvY1wiLCBiYXRjaFBhdGhdLCB7IGN3ZDogc2FmZUN3ZCwgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiBcImlnbm9yZVwiLCB3aW5kb3dzSGlkZTogZmFsc2UgfSk7XG4gICAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bhd24oXCJjbWQuZXhlXCIsIFtcIi9jXCIsIFwic3RhcnRcIiwgJ1wiXCInLCBcImNtZC5leGVcIiwgXCIva1wiLCBgY2QgL2QgXCIke3NhZmVDd2R9XCIgJiYgJHtjbWR9YF0sIHtcbiAgICAgICAgICAgICAgICAgICAgICBjd2Q6IHNhZmVDd2QsIGRldGFjaGVkOiB0cnVlLCBzdGRpbzogXCJpZ25vcmVcIiwgd2luZG93c0hpZGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNNYWMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBlc2NhcGVkID0gY21kLnJlcGxhY2UoL1xcXFwvZywgXCJcXFxcXFxcXFwiKS5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykucmVwbGFjZSgvJy9nLCBcIidcXFxcJydcIik7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gYHRlbGwgYXBwbGljYXRpb24gXCJUZXJtaW5hbFwiIHRvIGRvIHNjcmlwdCBcImNkICcke3NhZmVDd2R9JyAmJiAke2VzY2FwZWR9XCJgO1xuICAgICAgICAgICAgICAgIHNwYXduKFwib3Nhc2NyaXB0XCIsIFtcIi1lXCIsIHNjcmlwdF0sIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiBcImlnbm9yZVwiIH0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gc3Bhd24oXCJiYXNoXCIsIFtcIi1jXCIsIGNtZF0sIHsgY3dkOiBzYWZlQ3dkLCBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86IFwiaWdub3JlXCIgfSk7XG4gICAgICAgICAgICAgICAgY2hpbGQub24oJ2Vycm9yJywgKCkgPT4ge30pO1xuICAgICAgICAgICAgICAgIGNoaWxkLnVucmVmKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBTcGF3bmVkIHRlcm1pbmFsIGZvciAke2xhYmVsfSBpbiAke3NhZmVDd2R9OiAke2NtZH1gKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW1ByZXZpZXddIEZhaWxlZCB0byBzcGF3biB0ZXJtaW5hbCBmb3IgJHtsYWJlbH06YCwgZS5tZXNzYWdlPy5zbGljZSgwLCAyMDApKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCBsYXVuY2hFeGVjdXRhYmxlID0gKGV4ZVBhdGg6IHN0cmluZywgbGFiZWw6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2FmZUV4ZSA9IG5vcm1QYXRoKHBhdGgucmVzb2x2ZShleGVQYXRoKSk7XG4gICAgICAgICAgICBjb25zdCBleGVEaXIgPSBub3JtUGF0aChwYXRoLmRpcm5hbWUoc2FmZUV4ZSkpO1xuICAgICAgICAgICAgY29uc3QgZXh0ID0gcGF0aC5leHRuYW1lKHNhZmVFeGUpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEF0dGVtcHRpbmcgdG8gbGF1bmNoOiAke3NhZmVFeGV9IChleHQ6ICR7ZXh0fSwgY3dkOiAke2V4ZURpcn0pYCk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBpZiAoaXNXaW4pIHtcbiAgICAgICAgICAgICAgICBpZiAoZXh0ID09PSBcIi5tc2lcIikge1xuICAgICAgICAgICAgICAgICAgY29uc3QgYmF0UGF0aCA9IHBhdGguam9pbihleGVEaXIsIFwiX19sYW1ieV9sYXVuY2guYmF0XCIpO1xuICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhiYXRQYXRoLCBgQGVjaG8gb2ZmXFxyXFxuY2QgL2QgXCIke2V4ZURpcn1cIlxcclxcbm1zaWV4ZWMgL2kgXCIke3NhZmVFeGV9XCJcXHJcXG5gKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gc3Bhd24oXCJjbWQuZXhlXCIsIFtcIi9jXCIsIGJhdFBhdGhdLCB7IGN3ZDogZXhlRGlyLCBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86IFwiaWdub3JlXCIsIHdpbmRvd3NIaWRlOiBmYWxzZSB9KTtcbiAgICAgICAgICAgICAgICAgIGNoaWxkLnVucmVmKCk7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIExhdW5jaGVkIE1TSSBpbnN0YWxsZXIgdmlhIG1zaWV4ZWNgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgY29uc3QgYmF0UGF0aCA9IHBhdGguam9pbihleGVEaXIsIFwiX19sYW1ieV9sYXVuY2guYmF0XCIpO1xuICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhiYXRQYXRoLCBgQGVjaG8gb2ZmXFxyXFxuY2QgL2QgXCIke2V4ZURpcn1cIlxcclxcbmVjaG8gW0xhbWJ5XSBMYXVuY2hpbmcgJHtwYXRoLmJhc2VuYW1lKHNhZmVFeGUpfS4uLlxcclxcblwiJHtzYWZlRXhlfVwiXFxyXFxuYCk7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFdyb3RlIGxhdW5jaCBiYXRjaCBmaWxlOiAke2JhdFBhdGh9YCk7XG4gICAgICAgICAgICAgICAgICBsZXQgbGF1bmNoZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gc3Bhd24oXCJjbWQuZXhlXCIsIFtcIi9jXCIsIFwic3RhcnRcIiwgJ1wiXCInLCBiYXRQYXRoXSwgeyBjd2Q6IGV4ZURpciwgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiBcImlnbm9yZVwiLCB3aW5kb3dzSGlkZTogZmFsc2UsIHNoZWxsOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICBjaGlsZC51bnJlZigpO1xuICAgICAgICAgICAgICAgICAgICBsYXVuY2hlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gTWV0aG9kIDEgKHN0YXJ0IGJhdCk6IHNwYXduZWRgKTtcbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUxOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBNZXRob2QgMSBmYWlsZWQ6ICR7ZTEubWVzc2FnZT8uc2xpY2UoMCwgMTAwKX1gKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmICghbGF1bmNoZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IHNwYXduKHNhZmVFeGUsIFtdLCB7IGN3ZDogZXhlRGlyLCBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86IFwiaWdub3JlXCIgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgY2hpbGQudW5yZWYoKTtcbiAgICAgICAgICAgICAgICAgICAgICBsYXVuY2hlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBNZXRob2QgMiAoZGlyZWN0IHNwYXduKTogc3Bhd25lZGApO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlMjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBNZXRob2QgMiBmYWlsZWQ6ICR7ZTIubWVzc2FnZT8uc2xpY2UoMCwgMTAwKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgaWYgKCFsYXVuY2hlZCkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gc3Bhd24oXCJjbWQuZXhlXCIsIFtcIi9jXCIsIGJhdFBhdGhdLCB7IGN3ZDogZXhlRGlyLCBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86IFwiaWdub3JlXCIsIHdpbmRvd3NIaWRlOiBmYWxzZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBjaGlsZC51bnJlZigpO1xuICAgICAgICAgICAgICAgICAgICAgIGxhdW5jaGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIE1ldGhvZCAzIChjbWQgL2MgYmF0KTogc3Bhd25lZGApO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlMzogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBNZXRob2QgMyBmYWlsZWQ6ICR7ZTMubWVzc2FnZT8uc2xpY2UoMCwgMTAwKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgaWYgKCFsYXVuY2hlZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gQWxsIGxhdW5jaCBtZXRob2RzIGZhaWxlZCBmb3IgJHtzYWZlRXhlfWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzTWFjKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBzcGF3bihcIm9wZW5cIiwgW3NhZmVFeGVdLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogXCJpZ25vcmVcIiB9KTtcbiAgICAgICAgICAgICAgICBjaGlsZC51bnJlZigpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRyeSB7IGZzLmNobW9kU3luYyhzYWZlRXhlLCAwbzc1NSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IHNwYXduKHNhZmVFeGUsIFtdLCB7IGN3ZDogZXhlRGlyLCBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86IFwiaWdub3JlXCIgfSk7XG4gICAgICAgICAgICAgICAgY2hpbGQudW5yZWYoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIExhdW5jaGVkIGV4ZWN1dGFibGUgZm9yICR7bGFiZWx9OiAke3NhZmVFeGV9YCk7XG4gICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtQcmV2aWV3XSBGYWlsZWQgdG8gbGF1bmNoIGV4ZWN1dGFibGUgZm9yICR7bGFiZWx9OmAsIGUubWVzc2FnZT8uc2xpY2UoMCwgMjAwKSk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgZXhlY3V0YWJsZXMgPSBmaW5kRXhlY3V0YWJsZXMocHJvamVjdERpcik7XG4gICAgICAgICAgaWYgKGV4ZWN1dGFibGVzLmxlbmd0aCA+IDAgJiYgIWhhc1BrZykge1xuICAgICAgICAgICAgY29uc3QgSU5TVEFMTEVSX0hJTlRTID0gW1wiaW5zdGFsbGVyXCIsIFwic2V0dXBcIiwgXCJpbnN0YWxsXCIsIFwidW5pbnN0YWxsXCIsIFwiLXdlYi1cIiwgXCJ1cGRhdGVcIl07XG4gICAgICAgICAgICBjb25zdCBhcmNoSGludHMgPSBvcy5hcmNoKCkgPT09IFwiYXJtNjRcIiA/IFtcImFybTY0XCIsIFwiYWFyY2g2NFwiXSA6IFtcIng2NFwiLCBcIng4Nl82NFwiLCBcImFtZDY0XCIsIFwid2luNjRcIl07XG4gICAgICAgICAgICBjb25zdCB3cm9uZ0FyY2hIaW50cyA9IG9zLmFyY2goKSA9PT0gXCJhcm02NFwiID8gW1wieDY0XCIsIFwieDg2XzY0XCIsIFwiYW1kNjRcIiwgXCJ3aW42NFwiXSA6IFtcImFybTY0XCIsIFwiYWFyY2g2NFwiXTtcbiAgICAgICAgICAgIGNvbnN0IHNjb3JlZCA9IGV4ZWN1dGFibGVzLm1hcChlID0+IHtcbiAgICAgICAgICAgICAgbGV0IHNjb3JlID0gMDtcbiAgICAgICAgICAgICAgY29uc3QgbG5hbWUgPSBlLm5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgaWYgKHdyb25nQXJjaEhpbnRzLnNvbWUoaCA9PiBsbmFtZS5pbmNsdWRlcyhoKSkpIHNjb3JlIC09IDEwMDA7XG4gICAgICAgICAgICAgIGlmIChJTlNUQUxMRVJfSElOVFMuc29tZShoID0+IGxuYW1lLmluY2x1ZGVzKGgpKSkgc2NvcmUgLT0gMTAwO1xuICAgICAgICAgICAgICBpZiAoZS5leHQgPT09IFwiLm1zaVwiKSBzY29yZSAtPSA1MDtcbiAgICAgICAgICAgICAgaWYgKGFyY2hIaW50cy5zb21lKGggPT4gbG5hbWUuaW5jbHVkZXMoaCkpKSBzY29yZSArPSAxMDtcbiAgICAgICAgICAgICAgaWYgKGUuZXh0ID09PSBcIi5leGVcIikgc2NvcmUgKz0gNTtcbiAgICAgICAgICAgICAgZWxzZSBpZiAoZS5leHQgPT09IFwiLmFwcGltYWdlXCIpIHNjb3JlICs9IDQ7XG4gICAgICAgICAgICAgIGVsc2UgaWYgKGUuZXh0ID09PSBcIi5hcHBcIikgc2NvcmUgKz0gMztcbiAgICAgICAgICAgICAgaWYgKGxuYW1lLmluY2x1ZGVzKFwicG9ydGFibGVcIikpIHNjb3JlICs9IDE1O1xuICAgICAgICAgICAgICByZXR1cm4geyAuLi5lLCBzY29yZSB9O1xuICAgICAgICAgICAgfSkuc29ydCgoYSwgYikgPT4gYi5zY29yZSAtIGEuc2NvcmUpO1xuICAgICAgICAgICAgY29uc3QgY29tcGF0aWJsZSA9IHNjb3JlZC5maWx0ZXIoZSA9PiBlLnNjb3JlID4gLTEwMDApO1xuICAgICAgICAgICAgaWYgKGNvbXBhdGlibGUubGVuZ3RoID09PSAwICYmIHNjb3JlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gQWxsICR7c2NvcmVkLmxlbmd0aH0gZXhlY3V0YWJsZXMgYXJlIHdyb25nIGFyY2hpdGVjdHVyZSBcdTIwMTQgZGVsZXRpbmcgYW5kIHJlLWRvd25sb2FkaW5nYCk7XG4gICAgICAgICAgICAgIHRyeSB7IGZzLnJtU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJfcmVsZWFzZXNcIiksIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYmVzdCA9IGNvbXBhdGlibGUubGVuZ3RoID4gMCA/IGNvbXBhdGlibGVbMF0gOiBudWxsO1xuICAgICAgICAgICAgaWYgKGJlc3QpIHtcbiAgICAgICAgICAgICAgY29uc3QgYmVzdExvd2VyID0gYmVzdC5uYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgIGNvbnN0IGlzSW5zdGFsbGVyID0gSU5TVEFMTEVSX0hJTlRTLnNvbWUoaCA9PiBiZXN0TG93ZXIuaW5jbHVkZXMoaCkpIHx8IGJlc3QuZXh0ID09PSBcIi5tc2lcIjtcbiAgICAgICAgICAgICAgY29uc3QgbGF1bmNoZWQgPSBsYXVuY2hFeGVjdXRhYmxlKGJlc3QuZnVsbFBhdGgsIG5hbWUpO1xuICAgICAgICAgICAgICBjb25zdCBhbGxFeGVOYW1lcyA9IHNjb3JlZC5tYXAoZSA9PiBgJHtlLm5hbWV9IChzY29yZToke2Uuc2NvcmV9KWApLnNsaWNlKDAsIDEwKS5qb2luKFwiLCBcIik7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUHJlY29tcGlsZWQgYmluYXJpZXMgZm91bmQgZm9yICR7bmFtZX06ICR7YWxsRXhlTmFtZXN9YCk7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gU2VsZWN0ZWQ6ICR7YmVzdC5uYW1lfSAoaW5zdGFsbGVyOiAke2lzSW5zdGFsbGVyfSlgKTtcbiAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIHN0YXJ0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHByb2plY3RUeXBlOiBpc0luc3RhbGxlciA/IFwiaW5zdGFsbGVyXCIgOiBcInByZWNvbXBpbGVkXCIsXG4gICAgICAgICAgICAgICAgb3BlblRlcm1pbmFsOiB0cnVlLFxuICAgICAgICAgICAgICAgIGxhdW5jaGVkLFxuICAgICAgICAgICAgICAgIGlzSW5zdGFsbGVyLFxuICAgICAgICAgICAgICAgIHJ1bkNvbW1hbmQ6IGBcIiR7YmVzdC5mdWxsUGF0aH1cImAsXG4gICAgICAgICAgICAgICAgcHJvamVjdERpcjogcHJvamVjdERpcixcbiAgICAgICAgICAgICAgICBleGVjdXRhYmxlczogc2NvcmVkLm1hcChlID0+ICh7IG5hbWU6IGUubmFtZSwgcGF0aDogZS5mdWxsUGF0aCwgZXh0OiBlLmV4dCwgc2NvcmU6IGUuc2NvcmUgfSkpLnNsaWNlKDAsIDIwKSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBsYXVuY2hlZFxuICAgICAgICAgICAgICAgICAgPyBpc0luc3RhbGxlclxuICAgICAgICAgICAgICAgICAgICA/IGBMYXVuY2hpbmcgaW5zdGFsbGVyOiAke2Jlc3QubmFtZX0gXHUyMDE0IGZvbGxvdyB0aGUgc2V0dXAgd2l6YXJkIHRvIGluc3RhbGxgXG4gICAgICAgICAgICAgICAgICAgIDogYExhdW5jaGVkICR7YmVzdC5uYW1lfWBcbiAgICAgICAgICAgICAgICAgIDogYEZvdW5kOiAke2Jlc3QubmFtZX0gXHUyMDE0IGNvdWxkIG5vdCBhdXRvLWxhdW5jaGAsXG4gICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBObyBjb21wYXRpYmxlIGV4ZWN1dGFibGVzIGZvdW5kIGZvciAke25hbWV9ICgke3Njb3JlZC5sZW5ndGh9IHdyb25nLWFyY2ggc2tpcHBlZCkgXHUyMDE0IGZhbGxpbmcgdGhyb3VnaCB0byBidWlsZC9kb3dubG9hZGApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IFdFQl9GUkFNRVdPUktTID0gW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIiwgXCJ2dWVcIiwgXCJzdmVsdGVcIiwgXCJAc3ZlbHRlanMva2l0XCIsIFwibmV4dFwiLCBcIm51eHRcIiwgXCJAYW5ndWxhci9jb3JlXCIsIFwicHJlYWN0XCIsIFwic29saWQtanNcIiwgXCJhc3Ryb1wiLCBcImdhdHNieVwiLCBcInJlbWl4XCIsIFwiQHJlbWl4LXJ1bi9yZWFjdFwiLCBcImxpdFwiLCBcImVtYmVyLXNvdXJjZVwiLCBcInF3aWtcIiwgXCJAYnVpbGRlci5pby9xd2lrXCIsIFwidml0ZVwiLCBcIndlYnBhY2stZGV2LXNlcnZlclwiLCBcInBhcmNlbFwiLCBcIkByc3BhY2svY29yZVwiLCBcInJlYWN0LXNjcmlwdHNcIl07XG4gICAgICAgICAgY29uc3QgcHRTdWJEaXJzID0gW1wiZnJvbnRlbmRcIiwgXCJjbGllbnRcIiwgXCJ3ZWJcIiwgXCJhcHBcIl07XG4gICAgICAgICAgY29uc3QgaGFzSW5kZXhIdG1sID0gKCgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRpcnMgPSBbcHJvamVjdERpciwgZWZmZWN0aXZlUHJvamVjdERpciwgcGF0aC5qb2luKHByb2plY3REaXIsIFwicHVibGljXCIpLCBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJzcmNcIiksIC4uLnB0U3ViRGlycy5mbGF0TWFwKGQgPT4gW3BhdGguam9pbihwcm9qZWN0RGlyLCBkKSwgcGF0aC5qb2luKHByb2plY3REaXIsIGQsIFwicHVibGljXCIpLCBwYXRoLmpvaW4ocHJvamVjdERpciwgZCwgXCJzcmNcIildKV07XG4gICAgICAgICAgICByZXR1cm4gZGlycy5zb21lKGQgPT4geyB0cnkgeyByZXR1cm4gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZCwgXCJpbmRleC5odG1sXCIpKTsgfSBjYXRjaCB7IHJldHVybiBmYWxzZTsgfSB9KTtcbiAgICAgICAgICB9KSgpO1xuICAgICAgICAgIGNvbnN0IGhhc1dlYkNvbmZpZyA9ICgoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkaXJzID0gW3Byb2plY3REaXIsIGVmZmVjdGl2ZVByb2plY3REaXIsIC4uLnB0U3ViRGlycy5tYXAoZCA9PiBwYXRoLmpvaW4ocHJvamVjdERpciwgZCkpXTtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ0ZpbGVzID0gW1widml0ZS5jb25maWcudHNcIiwgXCJ2aXRlLmNvbmZpZy5qc1wiLCBcInZpdGUuY29uZmlnLm10c1wiLCBcInZpdGUuY29uZmlnLm1qc1wiLCBcIm5leHQuY29uZmlnLmpzXCIsIFwibmV4dC5jb25maWcubWpzXCIsIFwibmV4dC5jb25maWcudHNcIiwgXCJudXh0LmNvbmZpZy50c1wiLCBcIm51eHQuY29uZmlnLmpzXCIsIFwic3ZlbHRlLmNvbmZpZy5qc1wiLCBcInN2ZWx0ZS5jb25maWcudHNcIiwgXCJhc3Ryby5jb25maWcubWpzXCIsIFwiYXN0cm8uY29uZmlnLnRzXCIsIFwid2VicGFjay5jb25maWcuanNcIiwgXCJ3ZWJwYWNrLmNvbmZpZy50c1wiLCBcInJzcGFjay5jb25maWcuanNcIiwgXCJyc3BhY2suY29uZmlnLnRzXCIsIFwiYW5ndWxhci5qc29uXCJdO1xuICAgICAgICAgICAgcmV0dXJuIGRpcnMuc29tZShkID0+IHsgdHJ5IHsgcmV0dXJuIGNvbmZpZ0ZpbGVzLnNvbWUoZiA9PiBmcy5leGlzdHNTeW5jKHBhdGguam9pbihkLCBmKSkpOyB9IGNhdGNoIHsgcmV0dXJuIGZhbHNlOyB9IH0pO1xuICAgICAgICAgIH0pKCk7XG4gICAgICAgICAgY29uc3QgaGFzU3ViZGlyV2ViRGVwcyA9ICgoKSA9PiB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHN1YiBvZiBwdFN1YkRpcnMpIHtcbiAgICAgICAgICAgICAgY29uc3Qgc3ViUGtnUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBzdWIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhzdWJQa2dQYXRoKSkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBzdWJQa2cgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhzdWJQa2dQYXRoLCBcInV0Zi04XCIpKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHN1YkRlcHMgPSB7IC4uLihzdWJQa2cuZGVwZW5kZW5jaWVzIHx8IHt9KSwgLi4uKHN1YlBrZy5kZXZEZXBlbmRlbmNpZXMgfHwge30pIH07XG4gICAgICAgICAgICAgICAgICBpZiAoV0VCX0ZSQU1FV09SS1Muc29tZShmdyA9PiBmdyBpbiBzdWJEZXBzKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfSkoKTtcbiAgICAgICAgICBjb25zdCBhbGxEZXBzID0geyAuLi4ocGtnLmRlcGVuZGVuY2llcyB8fCB7fSksIC4uLihwa2cuZGV2RGVwZW5kZW5jaWVzIHx8IHt9KSB9O1xuICAgICAgICAgIGNvbnN0IGhhc1dlYkZyYW1ld29yayA9IFdFQl9GUkFNRVdPUktTLnNvbWUoZncgPT4gZncgaW4gYWxsRGVwcykgfHwgaGFzV2ViQ29uZmlnIHx8IGhhc1N1YmRpcldlYkRlcHM7XG4gICAgICAgICAgY29uc3QgaXNDTEkgPSAhIShwa2cuYmluKTtcbiAgICAgICAgICBjb25zdCBzY3JpcHRzID0gcGtnLnNjcmlwdHMgfHwge307XG4gICAgICAgICAgY29uc3QgaGFzT25seUJhY2tlbmQgPSAhaGFzV2ViRnJhbWV3b3JrICYmICFoYXNJbmRleEh0bWwgJiYgKGFsbERlcHNbXCJleHByZXNzXCJdIHx8IGFsbERlcHNbXCJmYXN0aWZ5XCJdIHx8IGFsbERlcHNbXCJrb2FcIl0gfHwgYWxsRGVwc1tcImhhcGlcIl0gfHwgYWxsRGVwc1tcIkBoYXBpL2hhcGlcIl0gfHwgYWxsRGVwc1tcIm5lc3RcIl0gfHwgYWxsRGVwc1tcIkBuZXN0anMvY29yZVwiXSk7XG4gICAgICAgICAgY29uc3QgaXNQeXRob25Qcm9qZWN0ID0gIWhhc1BrZyAmJiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJyZXF1aXJlbWVudHMudHh0XCIpKSB8fCBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInNldHVwLnB5XCIpKSB8fCBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInB5cHJvamVjdC50b21sXCIpKSk7XG4gICAgICAgICAgY29uc3QgaXNHb1Byb2plY3QgPSAhaGFzUGtnICYmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcImdvLm1vZFwiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJtYWluLmdvXCIpKSk7XG4gICAgICAgICAgY29uc3QgaXNSdXN0UHJvamVjdCA9ICFoYXNQa2cgJiYgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJDYXJnby50b21sXCIpKTtcbiAgICAgICAgICBjb25zdCBpc0NwcFByb2plY3QgPSAhaGFzUGtnICYmIChcbiAgICAgICAgICAgIGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwiQ01ha2VMaXN0cy50eHRcIikpIHx8XG4gICAgICAgICAgICAoKCkgPT4geyB0cnkgeyByZXR1cm4gZnMucmVhZGRpclN5bmMocHJvamVjdERpcikuc29tZSgoZjogc3RyaW5nKSA9PiAvXFwuKHNsbnx2Y3hwcm9qKSQvaS50ZXN0KGYpKTsgfSBjYXRjaCB7IHJldHVybiBmYWxzZTsgfSB9KSgpIHx8XG4gICAgICAgICAgICBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcIm1lc29uLmJ1aWxkXCIpKSB8fFxuICAgICAgICAgICAgKCgpID0+IHsgdHJ5IHsgcmV0dXJuIGZzLnJlYWRkaXJTeW5jKHByb2plY3REaXIpLnNvbWUoKGY6IHN0cmluZykgPT4gL15NYWtlZmlsZSQvaS50ZXN0KGYpKTsgfSBjYXRjaCB7IHJldHVybiBmYWxzZTsgfSB9KSgpXG4gICAgICAgICAgKTtcbiAgICAgICAgICBjb25zdCBoYXNTdGFydFNjcmlwdCA9IHNjcmlwdHMuZGV2IHx8IHNjcmlwdHMuc3RhcnQgfHwgc2NyaXB0cy5zZXJ2ZTtcbiAgICAgICAgICBjb25zdCBpc05vbldlYlByb2plY3QgPSAhaGFzSW5kZXhIdG1sICYmICFoYXNXZWJGcmFtZXdvcmsgJiYgKGlzQ0xJIHx8IGlzUHl0aG9uUHJvamVjdCB8fCBpc0dvUHJvamVjdCB8fCBpc1J1c3RQcm9qZWN0IHx8IGlzQ3BwUHJvamVjdCB8fCAoIWhhc1N0YXJ0U2NyaXB0ICYmICFoYXNPbmx5QmFja2VuZCkpO1xuXG4gICAgICAgICAgaWYgKGlzTm9uV2ViUHJvamVjdCkge1xuICAgICAgICAgICAgbGV0IHByb2plY3RUeXBlID0gaXNQeXRob25Qcm9qZWN0ID8gXCJweXRob25cIiA6IGlzR29Qcm9qZWN0ID8gXCJnb1wiIDogaXNSdXN0UHJvamVjdCA/IFwicnVzdFwiIDogaXNDcHBQcm9qZWN0ID8gXCJjcHBcIiA6IGlzQ0xJID8gXCJjbGlcIiA6IFwidGVybWluYWxcIjtcbiAgICAgICAgICAgIGxldCBydW5DbWQgPSBcIlwiO1xuICAgICAgICAgICAgbGV0IGJ1aWxkQ21kID0gXCJcIjtcblxuICAgICAgICAgICAgbGV0IHByb2plY3RNZXRhOiB7IG93bmVyPzogc3RyaW5nOyByZXBvPzogc3RyaW5nIH0gPSB7fTtcbiAgICAgICAgICAgIGNvbnN0IG1ldGFQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIFwiLmxhbWJ5LW1ldGEuanNvblwiKTtcbiAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKG1ldGFQYXRoKSkgcHJvamVjdE1ldGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhtZXRhUGF0aCwgXCJ1dGYtOFwiKSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgIGNvbnN0IHJlcG9OYW1lID0gcHJvamVjdE1ldGEucmVwbyB8fCBuYW1lO1xuXG4gICAgICAgICAgICBpZiAoaXNQeXRob25Qcm9qZWN0KSB7XG4gICAgICAgICAgICAgIGNvbnN0IG1haW5QeSA9IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwibWFpbi5weVwiKSkgPyBcIm1haW4ucHlcIiA6IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwiYXBwLnB5XCIpKSA/IFwiYXBwLnB5XCIgOiBmcy5yZWFkZGlyU3luYyhwcm9qZWN0RGlyKS5maW5kKChmOiBzdHJpbmcpID0+IGYuZW5kc1dpdGgoXCIucHlcIikpIHx8IFwibWFpbi5weVwiO1xuICAgICAgICAgICAgICBydW5DbWQgPSBpc1dpbiA/IGBweXRob24gJHttYWluUHl9YCA6IGBweXRob24zICR7bWFpblB5fWA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzR29Qcm9qZWN0KSB7XG4gICAgICAgICAgICAgIGNvbnN0IGdvRXhlTmFtZSA9IGlzV2luID8gYCR7cmVwb05hbWV9LmV4ZWAgOiByZXBvTmFtZTtcbiAgICAgICAgICAgICAgYnVpbGRDbWQgPSBgZ28gYnVpbGQgLW8gJHtnb0V4ZU5hbWV9IC5gO1xuICAgICAgICAgICAgICBydW5DbWQgPSBpc1dpbiA/IGdvRXhlTmFtZSA6IGAuLyR7Z29FeGVOYW1lfWA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzUnVzdFByb2plY3QpIHtcbiAgICAgICAgICAgICAgYnVpbGRDbWQgPSBcImNhcmdvIGJ1aWxkIC0tcmVsZWFzZVwiO1xuICAgICAgICAgICAgICBsZXQgcnVzdEJpbiA9IHJlcG9OYW1lO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhcmdvVG9tbCA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJDYXJnby50b21sXCIpLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5hbWVNYXRjaCA9IGNhcmdvVG9tbC5tYXRjaCgvXlxccypuYW1lXFxzKj1cXHMqXCIoW15cIl0rKVwiL20pO1xuICAgICAgICAgICAgICAgIGlmIChuYW1lTWF0Y2gpIHJ1c3RCaW4gPSBuYW1lTWF0Y2hbMV07XG4gICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgcnVuQ21kID0gaXNXaW4gPyBgdGFyZ2V0XFxcXHJlbGVhc2VcXFxcJHtydXN0QmlufS5leGVgIDogYC4vdGFyZ2V0L3JlbGVhc2UvJHtydXN0QmlufWA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzQ3BwUHJvamVjdCkge1xuICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJDTWFrZUxpc3RzLnR4dFwiKSkpIHtcbiAgICAgICAgICAgICAgICBidWlsZENtZCA9IGlzV2luXG4gICAgICAgICAgICAgICAgICA/IGBpZiBub3QgZXhpc3QgYnVpbGQgbWtkaXIgYnVpbGQgJiYgY2QgYnVpbGQgJiYgY21ha2UgLi4gJiYgY21ha2UgLS1idWlsZCAuIC0tY29uZmlnIFJlbGVhc2UgLS1wYXJhbGxlbGBcbiAgICAgICAgICAgICAgICAgIDogYG1rZGlyIC1wIGJ1aWxkICYmIGNkIGJ1aWxkICYmIGNtYWtlIC4uICYmIGNtYWtlIC0tYnVpbGQgLiAtLXBhcmFsbGVsYDtcbiAgICAgICAgICAgICAgICBwcm9qZWN0VHlwZSA9IFwiY21ha2VcIjtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmICgoKCkgPT4geyB0cnkgeyByZXR1cm4gZnMucmVhZGRpclN5bmMocHJvamVjdERpcikuc29tZSgoZjogc3RyaW5nKSA9PiBmLmVuZHNXaXRoKFwiLnNsblwiKSk7IH0gY2F0Y2ggeyByZXR1cm4gZmFsc2U7IH0gfSkoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNsbkZpbGUgPSBmcy5yZWFkZGlyU3luYyhwcm9qZWN0RGlyKS5maW5kKChmOiBzdHJpbmcpID0+IGYuZW5kc1dpdGgoXCIuc2xuXCIpKSE7XG4gICAgICAgICAgICAgICAgYnVpbGRDbWQgPSBpc1dpblxuICAgICAgICAgICAgICAgICAgPyBgbXNidWlsZCBcIiR7c2xuRmlsZX1cIiAvcDpDb25maWd1cmF0aW9uPVJlbGVhc2UgL21gXG4gICAgICAgICAgICAgICAgICA6IGBlY2hvIFwiVmlzdWFsIFN0dWRpbyAuc2xuIHJlcXVpcmVzIFdpbmRvd3Mgd2l0aCBNU0J1aWxkXCJgO1xuICAgICAgICAgICAgICAgIHByb2plY3RUeXBlID0gXCJtc2J1aWxkXCI7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJtZXNvbi5idWlsZFwiKSkpIHtcbiAgICAgICAgICAgICAgICBidWlsZENtZCA9IGlzV2luXG4gICAgICAgICAgICAgICAgICA/IGBpZiBub3QgZXhpc3QgYnVpbGRkaXIgbWVzb24gc2V0dXAgYnVpbGRkaXIgJiYgbWVzb24gY29tcGlsZSAtQyBidWlsZGRpcmBcbiAgICAgICAgICAgICAgICAgIDogYG1lc29uIHNldHVwIGJ1aWxkZGlyIDI+L2Rldi9udWxsIHx8IHRydWUgJiYgbWVzb24gY29tcGlsZSAtQyBidWlsZGRpcmA7XG4gICAgICAgICAgICAgICAgcHJvamVjdFR5cGUgPSBcIm1lc29uXCI7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWFrZWZpbGUgPSAoKCkgPT4geyB0cnkgeyByZXR1cm4gZnMucmVhZGRpclN5bmMocHJvamVjdERpcikuZmluZCgoZjogc3RyaW5nKSA9PiAvXk1ha2VmaWxlJC9pLnRlc3QoZikpOyB9IGNhdGNoIHsgcmV0dXJuIG51bGw7IH0gfSkoKTtcbiAgICAgICAgICAgICAgICBpZiAobWFrZWZpbGUpIHsgYnVpbGRDbWQgPSBcIm1ha2VcIjsgcHJvamVjdFR5cGUgPSBcIm1ha2VcIjsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzQ0xJICYmIHBrZy5iaW4pIHtcbiAgICAgICAgICAgICAgY29uc3QgYmluTmFtZSA9IHR5cGVvZiBwa2cuYmluID09PSBcInN0cmluZ1wiID8gcGtnLm5hbWUgOiBPYmplY3Qua2V5cyhwa2cuYmluKVswXTtcbiAgICAgICAgICAgICAgcnVuQ21kID0gYG5vZGUgJHt0eXBlb2YgcGtnLmJpbiA9PT0gXCJzdHJpbmdcIiA/IHBrZy5iaW4gOiBwa2cuYmluW2Jpbk5hbWVdfWA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBrZy5tYWluKSB7XG4gICAgICAgICAgICAgIHJ1bkNtZCA9IGBub2RlICR7cGtnLm1haW59YDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc2NyaXB0cy5zdGFydCkge1xuICAgICAgICAgICAgICBydW5DbWQgPSBgbnBtIHJ1biBzdGFydGA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXJ1bkNtZCAmJiAhYnVpbGRDbWQpIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKHByb2plY3REaXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGpzRW50cnkgPSBmaWxlcy5maW5kKChmOiBzdHJpbmcpID0+IC9eKGluZGV4fG1haW58YXBwfHNlcnZlcnxjbGkpXFwuKGpzfHRzfG1qc3xjanMpJC8udGVzdChmKSk7XG4gICAgICAgICAgICAgICAgaWYgKGpzRW50cnkpIHsgcnVuQ21kID0gYG5vZGUgJHtqc0VudHJ5fWA7IHByb2plY3RUeXBlID0gXCJub2RlXCI7IH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHB5RmlsZSA9IGZpbGVzLmZpbmQoKGY6IHN0cmluZykgPT4gZi5lbmRzV2l0aChcIi5weVwiKSk7XG4gICAgICAgICAgICAgICAgICBpZiAocHlGaWxlKSB7IHJ1bkNtZCA9IGlzV2luID8gYHB5dGhvbiAke3B5RmlsZX1gIDogYHB5dGhvbjMgJHtweUZpbGV9YDsgcHJvamVjdFR5cGUgPSBcInB5dGhvblwiOyB9XG4gICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hGaWxlID0gZmlsZXMuZmluZCgoZjogc3RyaW5nKSA9PiBmLmVuZHNXaXRoKFwiLnNoXCIpKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNoRmlsZSkgeyBydW5DbWQgPSBgYmFzaCAke3NoRmlsZX1gOyBwcm9qZWN0VHlwZSA9IFwic2hlbGxcIjsgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJEb2NrZXJmaWxlXCIpKSkgeyBidWlsZENtZCA9IFwiZG9ja2VyIGJ1aWxkIC10IFwiICsgcmVwb05hbWUgKyBcIiAuXCI7IHJ1bkNtZCA9IFwiZG9ja2VyIHJ1biBcIiArIHJlcG9OYW1lOyBwcm9qZWN0VHlwZSA9IFwiZG9ja2VyXCI7IH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBmaW5kRXhlSW5EaXIgPSAoZGlyOiBzdHJpbmcsIGRlcHRoID0gMCk6IHN0cmluZyA9PiB7XG4gICAgICAgICAgICAgIGlmIChkZXB0aCA+IDMpIHJldHVybiBcIlwiO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZnMucmVhZGRpclN5bmMoZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGZ1bGwgPSBwYXRoLmpvaW4oZGlyLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgICAgICAgICAgIGlmIChlbnRyeS5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUoZW50cnkubmFtZSkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFtcIi5leGVcIiwgXCIuYXBwaW1hZ2VcIiwgXCIuYXBwXCJdLmluY2x1ZGVzKGV4dCkpIHJldHVybiBmdWxsO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChlbnRyeS5pc0RpcmVjdG9yeSgpICYmIGRlcHRoIDwgMykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3VuZCA9IGZpbmRFeGVJbkRpcihmdWxsLCBkZXB0aCArIDEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZm91bmQpIHJldHVybiBmb3VuZDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBsZXQgYnVpbGRPdXRwdXQgPSBcIlwiO1xuICAgICAgICAgICAgbGV0IGJ1aWxkU3VjY2VzcyA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKGJ1aWxkQ21kKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gQXV0by1idWlsZGluZyAke3Byb2plY3RUeXBlfSBwcm9qZWN0ICR7bmFtZX06ICR7YnVpbGRDbWR9YCk7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYnVpbGRDd2QgPSBub3JtUGF0aChwYXRoLnJlc29sdmUocHJvamVjdERpcikpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGV4ZWNTeW5jKGJ1aWxkQ21kLCB7XG4gICAgICAgICAgICAgICAgICBjd2Q6IGJ1aWxkQ3dkLFxuICAgICAgICAgICAgICAgICAgdGltZW91dDogMzAwMDAwLFxuICAgICAgICAgICAgICAgICAgc3RkaW86IFwicGlwZVwiLFxuICAgICAgICAgICAgICAgICAgc2hlbGw6IHRydWUsXG4gICAgICAgICAgICAgICAgICB3aW5kb3dzSGlkZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgTUFLRUZMQUdTOiBgLWoke29zLmNwdXMoKS5sZW5ndGggfHwgMn1gIH0sXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgYnVpbGRPdXRwdXQgPSByZXN1bHQudG9TdHJpbmcoKS5zbGljZSgtMjAwMCk7XG4gICAgICAgICAgICAgICAgYnVpbGRTdWNjZXNzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEJ1aWxkIHN1Y2NlZWRlZCBmb3IgJHtuYW1lfWApO1xuICAgICAgICAgICAgICAgIGlmICghcnVuQ21kKSB7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBidWlsdEV4ZXMgPSBmaW5kRXhlY3V0YWJsZXMocHJvamVjdERpcik7XG4gICAgICAgICAgICAgICAgICAgIGlmIChidWlsdEV4ZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJlc3QgPSBidWlsdEV4ZXMuZmluZChlID0+IGUuZXh0ID09PSBcIi5leGVcIikgfHwgYnVpbHRFeGVzWzBdO1xuICAgICAgICAgICAgICAgICAgICAgIHJ1bkNtZCA9IGlzV2luID8gYFwiJHtub3JtUGF0aChiZXN0LmZ1bGxQYXRoKX1cImAgOiBgXCIke2Jlc3QuZnVsbFBhdGh9XCJgO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICBjb25zdCBCVUlMRF9ESVJTID0gW1wiYnVpbGRcIiwgXCJidWlsZGRpclwiLCBcImJ1aWxkL1JlbGVhc2VcIiwgXCJidWlsZC9EZWJ1Z1wiLCBcIlJlbGVhc2VcIiwgXCJEZWJ1Z1wiLCBcIm91dFwiLCBcImJpblwiXTtcbiAgICAgICAgICAgICAgICAgIGlmICghcnVuQ21kKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYmQgb2YgQlVJTERfRElSUykge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJkUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBiZCk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGJkUGF0aCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBidWlsZEZpbGVzID0gZnMucmVhZGRpclN5bmMoYmRQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ1aWx0QmluID0gYnVpbGRGaWxlcy5maW5kKChmOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZnAgPSBwYXRoLmpvaW4oYmRQYXRoLCBmKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoZnApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc3RhdC5pc0ZpbGUoKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1dpbikgcmV0dXJuIGYuZW5kc1dpdGgoXCIuZXhlXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoc3RhdC5tb2RlICYgMG8xMTEpICE9PSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChidWlsdEJpbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBidWlsdFBhdGggPSBwYXRoLmpvaW4oYmRQYXRoLCBidWlsdEJpbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bkNtZCA9IGlzV2luID8gYFwiJHtub3JtUGF0aChidWlsdFBhdGgpfVwiYCA6IGBcIiR7YnVpbHRQYXRofVwiYDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpZiAoIXJ1bkNtZCAmJiAocHJvamVjdFR5cGUgPT09IFwibWFrZVwiIHx8IHByb2plY3RUeXBlID09PSBcImNtYWtlXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm9vdEZpbGVzID0gZnMucmVhZGRpclN5bmMocHJvamVjdERpcik7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnVpbHRCaW4gPSByb290RmlsZXMuZmluZCgoZjogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoL1xcLihjfGNwcHxofGhwcHxvfG9ianx0eHR8bWR8anNvbnxjbWFrZXxzbG58dmN4cHJvaikkL2kudGVzdChmKSB8fCAvXihNYWtlZmlsZXxDTWFrZUxpc3RzfFJFQURNRXxMSUNFTlNFfEJVSUxEfFdPUktTUEFDRSkkL2kudGVzdChmKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZnAgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgZik7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoZnApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXN0YXQuaXNGaWxlKCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzV2luKSByZXR1cm4gZi5lbmRzV2l0aChcIi5leGVcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoc3RhdC5tb2RlICYgMG8xMTEpICE9PSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7IHJldHVybiBmYWxzZTsgfVxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChidWlsdEJpbikgcnVuQ21kID0gaXNXaW4gPyBgXCIke25vcm1QYXRoKHBhdGguam9pbihwcm9qZWN0RGlyLCBidWlsdEJpbikpfVwiYCA6IGAuLyR7YnVpbHRCaW59YDtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCAoYnVpbGRFcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIGJ1aWxkT3V0cHV0ID0gKGJ1aWxkRXJyLnN0ZGVycj8udG9TdHJpbmcoKSB8fCBidWlsZEVyci5tZXNzYWdlIHx8IFwiXCIpLnNsaWNlKC0yMDAwKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gQnVpbGQgZmFpbGVkIGZvciAke25hbWV9OiAke2J1aWxkT3V0cHV0LnNsaWNlKDAsIDMwMCl9YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcmVsZWFzZXNEaXIgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJfcmVsZWFzZXNcIik7XG4gICAgICAgICAgICBsZXQgcmVsZWFzZUV4ZSA9IFwiXCI7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhyZWxlYXNlc0RpcikpIHtcbiAgICAgICAgICAgICAgcmVsZWFzZUV4ZSA9IGZpbmRFeGVJbkRpcihyZWxlYXNlc0Rpcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghYnVpbGRTdWNjZXNzICYmICFydW5DbWQgJiYgIXJlbGVhc2VFeGUgJiYgcHJvamVjdE1ldGEub3duZXIgJiYgcHJvamVjdE1ldGEucmVwbykge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEJ1aWxkIGZhaWxlZCBvciBubyBidWlsZCBzeXN0ZW0gXHUyMDE0IHRyeWluZyBHaXRIdWIgUmVsZWFzZXMgZm9yICR7cHJvamVjdE1ldGEub3duZXJ9LyR7cHJvamVjdE1ldGEucmVwb30uLi5gKTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBnaFRva2VuID0gcHJvY2Vzcy5lbnYuR0lUSFVCX1RPS0VOIHx8IFwiXCI7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVsSGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgXCJBY2NlcHRcIjogXCJhcHBsaWNhdGlvbi92bmQuZ2l0aHViLnYzK2pzb25cIiwgXCJVc2VyLUFnZW50XCI6IFwiTGFtYnlcIiB9O1xuICAgICAgICAgICAgICAgIGlmIChnaFRva2VuKSByZWxIZWFkZXJzW1wiQXV0aG9yaXphdGlvblwiXSA9IGB0b2tlbiAke2doVG9rZW59YDtcbiAgICAgICAgICAgICAgICBjb25zdCByZWxSZXNwID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvJHtwcm9qZWN0TWV0YS5vd25lcn0vJHtwcm9qZWN0TWV0YS5yZXBvfS9yZWxlYXNlcy9sYXRlc3RgLCB7IGhlYWRlcnM6IHJlbEhlYWRlcnMgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlbFJlc3Aub2spIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbERhdGE6IGFueSA9IGF3YWl0IHJlbFJlc3AuanNvbigpO1xuICAgICAgICAgICAgICAgICAgY29uc3QgQklOQVJZX0VYVFMgPSBbXCIuZXhlXCIsIFwiLm1zaVwiLCBcIi5hcHBpbWFnZVwiLCBcIi5kbWdcIiwgXCIuZGViXCIsIFwiLnJwbVwiLCBcIi56aXBcIiwgXCIudGFyLmd6XCIsIFwiLjd6XCJdO1xuICAgICAgICAgICAgICAgICAgY29uc3Qgb3NQbGF0Zm9ybSA9IG9zLnBsYXRmb3JtKCk7XG4gICAgICAgICAgICAgICAgICBjb25zdCBvc0FyY2ggPSBvcy5hcmNoKCk7XG4gICAgICAgICAgICAgICAgICBjb25zdCBwbGF0Zm9ybUhpbnRzID0gb3NQbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiID8gW1wid2luXCIsIFwid2luZG93c1wiXSA6IG9zUGxhdGZvcm0gPT09IFwiZGFyd2luXCIgPyBbXCJtYWNcIiwgXCJtYWNvc1wiLCBcImRhcndpblwiXSA6IFtcImxpbnV4XCJdO1xuICAgICAgICAgICAgICAgICAgY29uc3QgZ29vZEFyY2hIaW50cyA9IG9zQXJjaCA9PT0gXCJhcm02NFwiID8gW1wiYXJtNjRcIiwgXCJhYXJjaDY0XCJdIDogW1wieDY0XCIsIFwieDg2XzY0XCIsIFwiYW1kNjRcIiwgXCJ3aW42NFwiXTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGJhZEFyY2hIaW50cyA9IG9zQXJjaCA9PT0gXCJhcm02NFwiID8gW1wieDY0XCIsIFwieDg2XzY0XCIsIFwiYW1kNjRcIiwgXCJ3aW42NFwiXSA6IFtcImFybTY0XCIsIFwiYWFyY2g2NFwiXTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IElOU1RBTExFUl9LVyA9IFtcImluc3RhbGxlclwiLCBcInNldHVwXCIsIFwiaW5zdGFsbFwiXTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IChyZWxEYXRhLmFzc2V0cyB8fCBbXSlcbiAgICAgICAgICAgICAgICAgICAgLmZpbHRlcigoYTogYW55KSA9PiBCSU5BUllfRVhUUy5zb21lKGV4dCA9PiBhLm5hbWUudG9Mb3dlckNhc2UoKS5lbmRzV2l0aChleHQpKSlcbiAgICAgICAgICAgICAgICAgICAgLm1hcCgoYTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgbG4gPSBhLm5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICBsZXQgc2NvcmUgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChwbGF0Zm9ybUhpbnRzLnNvbWUoaCA9PiBsbi5pbmNsdWRlcyhoKSkpIHNjb3JlICs9IDIwO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChnb29kQXJjaEhpbnRzLnNvbWUoaCA9PiBsbi5pbmNsdWRlcyhoKSkpIHNjb3JlICs9IDEwO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChiYWRBcmNoSGludHMuc29tZShoID0+IGxuLmluY2x1ZGVzKGgpKSkgc2NvcmUgLT0gMTU7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGxuLmluY2x1ZGVzKFwicG9ydGFibGVcIikpIHNjb3JlICs9IDI1O1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChJTlNUQUxMRVJfS1cuc29tZShoID0+IGxuLmluY2x1ZGVzKGgpKSkgc2NvcmUgLT0gNTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAobG4uZW5kc1dpdGgoXCIuemlwXCIpKSBzY29yZSArPSAzO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7IC4uLmEsIF9zY29yZTogc2NvcmUgfTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBiLl9zY29yZSAtIGEuX3Njb3JlKTtcbiAgICAgICAgICAgICAgICAgIGlmIChhc3NldHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZWxEaXIgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJfcmVsZWFzZXNcIik7XG4gICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhyZWxEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBNQVhfREwgPSA1MDAgKiAxMDI0ICogMTAyNDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdG9EbCA9IGFzc2V0cy5maWx0ZXIoKGE6IGFueSkgPT4gYS5zaXplIDwgTUFYX0RMKS5zbGljZSgwLCAzKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBhc3NldCBvZiB0b0RsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gRG93bmxvYWRpbmcgcmVsZWFzZTogJHthc3NldC5uYW1lfSAoJHsoYXNzZXQuc2l6ZSAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDEpfU1CKS4uLmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGxSZXNwID0gYXdhaXQgZmV0Y2goYXNzZXQuYnJvd3Nlcl9kb3dubG9hZF91cmwsIHsgcmVkaXJlY3Q6IFwiZm9sbG93XCIgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGxSZXNwLm9rKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZiA9IEJ1ZmZlci5mcm9tKGF3YWl0IGRsUmVzcC5hcnJheUJ1ZmZlcigpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRQYXRoID0gcGF0aC5qb2luKHJlbERpciwgYXNzZXQubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoYXNzZXRQYXRoLCBidWYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXQubmFtZS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKFwiLmV4ZVwiKSB8fCBhc3NldC5uYW1lLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoXCIuYXBwaW1hZ2VcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkgeyBmcy5jaG1vZFN5bmMoYXNzZXRQYXRoLCAwbzc1NSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXQubmFtZS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKFwiLnppcFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYWN0RGlyID0gcGF0aC5qb2luKHJlbERpciwgYXNzZXQubmFtZS5yZXBsYWNlKC9cXC56aXAkL2ksIFwiXCIpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhleHRyYWN0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1dpbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjU3luYyhgdGFyIHhmIFwiJHtub3JtUGF0aChhc3NldFBhdGgpfVwiIC1DIFwiJHtub3JtUGF0aChleHRyYWN0RGlyKX1cImAsIHsgdGltZW91dDogNjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgd2luZG93c0hpZGU6IHRydWUsIHNoZWxsOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlY1N5bmMoYHVuemlwIC1vIC1xIFwiJHthc3NldFBhdGh9XCIgLWQgXCIke2V4dHJhY3REaXJ9XCJgLCB7IHRpbWVvdXQ6IDYwMDAwLCBzdGRpbzogXCJwaXBlXCIgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAodW56RXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gQ291bGQgbm90IGV4dHJhY3QgJHthc3NldC5uYW1lfTogJHt1bnpFcnIubWVzc2FnZT8uc2xpY2UoMCwgMTAwKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBEb3dubG9hZGVkIHJlbGVhc2UgYXNzZXQ6ICR7YXNzZXQubmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChkbEVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIERvd25sb2FkIGZhaWxlZCBmb3IgJHthc3NldC5uYW1lfTogJHtkbEVyci5tZXNzYWdlPy5zbGljZSgwLCAxMDApfWApO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZWxlYXNlRXhlID0gZmluZEV4ZUluRGlyKHJlbERpcik7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGNhdGNoIChyZWxFcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gR2l0SHViIFJlbGVhc2VzIGNoZWNrIGZhaWxlZDogJHtyZWxFcnIubWVzc2FnZT8uc2xpY2UoMCwgMTAwKX1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocmVsZWFzZUV4ZSAmJiAoIWJ1aWxkU3VjY2VzcyB8fCAhcnVuQ21kKSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFVzaW5nIHJlbGVhc2UgZXhlY3V0YWJsZTogJHtyZWxlYXNlRXhlfWApO1xuICAgICAgICAgICAgICBjb25zdCBsYXVuY2hlZCA9IGxhdW5jaEV4ZWN1dGFibGUocmVsZWFzZUV4ZSwgbmFtZSk7XG4gICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBzdGFydGVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBwcm9qZWN0VHlwZTogXCJwcmVjb21waWxlZFwiLFxuICAgICAgICAgICAgICAgIG9wZW5UZXJtaW5hbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBsYXVuY2hlZCxcbiAgICAgICAgICAgICAgICBydW5Db21tYW5kOiBgXCIke3JlbGVhc2VFeGV9XCJgLFxuICAgICAgICAgICAgICAgIHByb2plY3REaXIsXG4gICAgICAgICAgICAgICAgLi4uKGJ1aWxkQ21kID8geyBidWlsZENvbW1hbmQ6IGJ1aWxkQ21kLCBidWlsZFN1Y2Nlc3MsIGJ1aWxkT3V0cHV0OiBidWlsZE91dHB1dC5zbGljZSgwLCAxMDAwKSB9IDoge30pLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGxhdW5jaGVkXG4gICAgICAgICAgICAgICAgICA/IGBMYXVuY2hlZCAke3BhdGguYmFzZW5hbWUocmVsZWFzZUV4ZSl9JHtidWlsZENtZCAmJiAhYnVpbGRTdWNjZXNzID8gXCIgKGJ1aWxkIGZhaWxlZCBcdTIwMTQgdXNpbmcgcHJlY29tcGlsZWQgcmVsZWFzZSlcIiA6IFwiXCJ9YFxuICAgICAgICAgICAgICAgICAgOiBgRm91bmQgcmVsZWFzZTogJHtwYXRoLmJhc2VuYW1lKHJlbGVhc2VFeGUpfWAsXG4gICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgZnVsbENtZCA9IGJ1aWxkQ21kICYmIHJ1bkNtZCAmJiBidWlsZFN1Y2Nlc3NcbiAgICAgICAgICAgICAgPyBydW5DbWRcbiAgICAgICAgICAgICAgOiBidWlsZENtZCAmJiAhYnVpbGRTdWNjZXNzXG4gICAgICAgICAgICAgICAgPyBidWlsZENtZFxuICAgICAgICAgICAgICAgIDogcnVuQ21kIHx8IGJ1aWxkQ21kO1xuXG4gICAgICAgICAgICBpZiAoIWZ1bGxDbWQgJiYgIWxhdW5jaGVkKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gTm8gZW50cnkgcG9pbnQgZm91bmQgZm9yICR7bmFtZX0gXHUyMDE0IGF0dGVtcHRpbmcgZnVsbCBpbnN0YWxsICsgcmUtZGV0ZWN0Li4uYCk7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXV0b0ZpeFBtID0gZGV0ZWN0UGFja2FnZU1hbmFnZXIoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbnN0YWxsQ21kMiA9IGF1dG9GaXhQbSA9PT0gXCJidW5cIiA/IFwibnB4IGJ1biBpbnN0YWxsXCIgOiBhdXRvRml4UG0gPT09IFwicG5wbVwiID8gXCJucHggcG5wbSBpbnN0YWxsIC0tbm8tZnJvemVuLWxvY2tmaWxlXCIgOiBhdXRvRml4UG0gPT09IFwieWFyblwiID8gXCJucHggeWFybiBpbnN0YWxsIC0taWdub3JlLWVuZ2luZXNcIiA6IFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzXCI7XG4gICAgICAgICAgICAgICAgZXhlY1N5bmMoaW5zdGFsbENtZDIsIHsgY3dkOiBlZmZlY3RpdmVQcm9qZWN0RGlyLCB0aW1lb3V0OiAxODAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUsIHdpbmRvd3NIaWRlOiB0cnVlLCBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIEhVU0tZOiBcIjBcIiwgRElTQUJMRV9PUEVOQ09MTEVDVElWRTogXCJ0cnVlXCIsIEFEQkxPQ0s6IFwiMVwiIH0gfSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtBdXRvRml4XSBGdWxsIGluc3RhbGwgY29tcGxldGVkIFx1MjAxNCByZS1kZXRlY3RpbmcgZGV2IGNvbW1hbmQgZm9yICR7bmFtZX1gKTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UGtnID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKGVmZmVjdGl2ZVByb2plY3REaXIsIFwicGFja2FnZS5qc29uXCIpLCBcInV0Zi04XCIpKTtcbiAgICAgICAgICAgICAgICAgIHBrZyA9IG5ld1BrZztcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgY29uc3QgcmVEZXRlY3RlZCA9IGRldGVjdERldkNvbW1hbmQoKTtcbiAgICAgICAgICAgICAgICBpZiAocmVEZXRlY3RlZC5jbWQgJiYgcmVEZXRlY3RlZC5hcmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgIGZ1bGxDbWQgPSBgJHtyZURldGVjdGVkLmNtZH0gJHtyZURldGVjdGVkLmFyZ3Muam9pbihcIiBcIil9YDtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gUmUtZGV0ZWN0ZWQgZGV2IGNvbW1hbmQgYWZ0ZXIgaW5zdGFsbDogJHtmdWxsQ21kfWApO1xuICAgICAgICAgICAgICAgICAgdml0ZUVycm9ySGlzdG9yeS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6IGBlcnItJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDYpfWAsXG4gICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSwgc291cmNlOiBcInN0YXJ0dXAtcmVjb3ZlcnlcIiwgbWVzc2FnZTogXCJObyBydW5uYWJsZSBlbnRyeSBwb2ludCBcdTIwMTQgZml4ZWQgYnkgZnVsbCBpbnN0YWxsXCIsXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzaWZpZWQ6IHsgY2F0ZWdvcnk6IFwibm8tZW50cnktcG9pbnRcIiwgc3RyYXRlZ3k6IFwiZnVsbC1pbnN0YWxsLXJldHJ5XCIsIGNvbmZpZGVuY2U6IDAuOSwgZGV0YWlsOiBcIkF1dG8tcmVjb3ZlcmVkXCIgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVjb3Zlcnk6IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IGBJbnN0YWxsZWQgZGVwcywgZm91bmQ6ICR7ZnVsbENtZH1gIH0sXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gRnVsbCBpbnN0YWxsIGZhaWxlZCBmb3IgJHtuYW1lfTogJHtlLm1lc3NhZ2U/LnNsaWNlKDAsIDIwMCl9YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFmdWxsQ21kICYmIGJ1aWxkQ21kICYmICFidWlsZFN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtBdXRvRml4XSBCdWlsZCBmYWlsZWQgZm9yICR7bmFtZX0gXHUyMDE0IGNsZWFyaW5nIGFydGlmYWN0cyBhbmQgcmV0cnlpbmcuLi5gKTtcbiAgICAgICAgICAgICAgY2xlYXJWaXRlRnJhbWV3b3JrQ2FjaGVzKHByb2plY3REaXIpO1xuICAgICAgICAgICAgICBjb25zdCBhcnRpZmFjdERpcnMgPSBwcm9qZWN0VHlwZSA9PT0gXCJydXN0XCIgPyBbXCJ0YXJnZXRcIl0gOiBwcm9qZWN0VHlwZSA9PT0gXCJnb1wiID8gW1wiYmluXCJdIDogcHJvamVjdFR5cGUgPT09IFwiY3BwXCIgPyBbXCJidWlsZFwiLCBcImNtYWtlLWJ1aWxkLWRlYnVnXCJdIDogW107XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgYWQgb2YgYXJ0aWZhY3REaXJzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYWRwID0gcGF0aC5qb2luKHByb2plY3REaXIsIGFkKTtcbiAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhhZHApKSB7IHRyeSB7IGZzLnJtU3luYyhhZHAsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fSB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBleGVjU3luYyhidWlsZENtZCwgeyBjd2Q6IHByb2plY3REaXIsIHRpbWVvdXQ6IDEyMDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgYnVpbGRTdWNjZXNzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBmdWxsQ21kID0gcnVuQ21kIHx8IGJ1aWxkQ21kO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gQnVpbGQgcmV0cnkgc3VjY2VlZGVkIGZvciAke25hbWV9YCk7XG4gICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBOb24td2ViIHByb2plY3QgJHtuYW1lfSAoJHtwcm9qZWN0VHlwZX0pIFx1MjAxNCBjbWQ6ICR7ZnVsbENtZCB8fCAnbm9uZSd9JHtidWlsZENtZCA/IGAsIGJ1aWxkOiAke2J1aWxkU3VjY2VzcyA/ICdvaycgOiAnZmFpbGVkJ31gIDogJyd9YCk7XG4gICAgICAgICAgICBjb25zdCBsYXVuY2hlZDIgPSBmdWxsQ21kICYmICFsYXVuY2hlZCA/IHNwYXduVGVybWluYWxXaXRoQ29tbWFuZChwcm9qZWN0RGlyLCBmdWxsQ21kLCBuYW1lKSA6IGxhdW5jaGVkO1xuICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgc3RhcnRlZDogZmFsc2UsXG4gICAgICAgICAgICAgIHByb2plY3RUeXBlLFxuICAgICAgICAgICAgICBvcGVuVGVybWluYWw6IHRydWUsXG4gICAgICAgICAgICAgIGxhdW5jaGVkOiBsYXVuY2hlZDIsXG4gICAgICAgICAgICAgIHJ1bkNvbW1hbmQ6IGZ1bGxDbWQsXG4gICAgICAgICAgICAgIHByb2plY3REaXIsXG4gICAgICAgICAgICAgIC4uLihidWlsZENtZCA/IHsgYnVpbGRDb21tYW5kOiBidWlsZENtZCwgYnVpbGRTdWNjZXNzLCBidWlsZE91dHB1dDogYnVpbGRPdXRwdXQuc2xpY2UoMCwgMTAwMCkgfSA6IHt9KSxcbiAgICAgICAgICAgICAgbWVzc2FnZTogYnVpbGRTdWNjZXNzICYmIHJ1bkNtZFxuICAgICAgICAgICAgICAgID8gYEJ1aWxkIGNvbXBsZXRlIFx1MjAxNCBydW5uaW5nOiAke3J1bkNtZH1gXG4gICAgICAgICAgICAgICAgOiBidWlsZFN1Y2Nlc3NcbiAgICAgICAgICAgICAgICAgID8gYEJ1aWxkIGNvbXBsZXRlJHtydW5DbWQgPyBgIFx1MjAxNCBydW5uaW5nOiAke3J1bkNtZH1gIDogJyd9YFxuICAgICAgICAgICAgICAgICAgOiBidWlsZENtZCAmJiAhYnVpbGRTdWNjZXNzXG4gICAgICAgICAgICAgICAgICAgID8gYEJ1aWxkIGZhaWxlZCBcdTIwMTQgY2hlY2sgYnVpbGQgb3V0cHV0IGZvciBlcnJvcnNgXG4gICAgICAgICAgICAgICAgICAgIDogbGF1bmNoZWQyXG4gICAgICAgICAgICAgICAgICAgICAgPyBgUnVubmluZzogJHtmdWxsQ21kfWBcbiAgICAgICAgICAgICAgICAgICAgICA6IGZ1bGxDbWRcbiAgICAgICAgICAgICAgICAgICAgICAgID8gYCR7cHJvamVjdFR5cGV9IHByb2plY3QgXHUyMDE0IHJ1bjogJHtmdWxsQ21kfWBcbiAgICAgICAgICAgICAgICAgICAgICAgIDogYE5vIHJ1bm5hYmxlIGVudHJ5IHBvaW50IGZvdW5kLiBUcmllZDogZnVsbCBpbnN0YWxsICsgcmUtZGV0ZWN0LiBDaGVjayBwcm9qZWN0IHN0cnVjdHVyZS5gLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHBhdGNoUG9ydEluRW52RmlsZXMgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBlbnZGaWxlcyA9IFtcIi5lbnZcIiwgXCIuZW52LmxvY2FsXCIsIFwiLmVudi5kZXZlbG9wbWVudFwiLCBcIi5lbnYuZGV2ZWxvcG1lbnQubG9jYWxcIl07XG4gICAgICAgICAgICBjb25zdCBlbnZEaXJzID0gZWZmZWN0aXZlUHJvamVjdERpciAhPT0gcHJvamVjdERpciA/IFtlZmZlY3RpdmVQcm9qZWN0RGlyLCBwcm9qZWN0RGlyXSA6IFtwcm9qZWN0RGlyXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZW52RGlyIG9mIGVudkRpcnMpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZW52RmlsZSBvZiBlbnZGaWxlcykge1xuICAgICAgICAgICAgICBjb25zdCBlbnZQYXRoID0gcGF0aC5qb2luKGVudkRpciwgZW52RmlsZSk7XG4gICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhlbnZQYXRoKSkgY29udGludWU7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbGV0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoZW52UGF0aCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmICgvXlBPUlRcXHMqPS9tLnRlc3QoY29udGVudCkpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoL15QT1JUXFxzKj0uKi9tLCBgUE9SVD0ke3BvcnR9YCk7XG4gICAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKC9eSE9TVFxccyo9L20udGVzdChjb250ZW50KSkge1xuICAgICAgICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgvXkhPU1RcXHMqPS4qL20sIGBIT1NUPTAuMC4wLjBgKTtcbiAgICAgICAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhlbnZQYXRoLCBjb250ZW50KTtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUGF0Y2hlZCBwb3J0L2hvc3QgaW4gJHtlbnZGaWxlfSBmb3IgJHtuYW1lfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgICAgcGF0Y2hQb3J0SW5FbnZGaWxlcygpO1xuXG4gICAgICAgICAgY29uc3QgcGF0Y2hWaXRlQ29uZmlnID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgdml0ZUNvbmZpZ05hbWVzID0gW1widml0ZS5jb25maWcudHNcIiwgXCJ2aXRlLmNvbmZpZy5qc1wiLCBcInZpdGUuY29uZmlnLm1qc1wiXTtcbiAgICAgICAgICAgIGNvbnN0IHZjRGlycyA9IGVmZmVjdGl2ZVByb2plY3REaXIgIT09IHByb2plY3REaXIgPyBbZWZmZWN0aXZlUHJvamVjdERpciwgcHJvamVjdERpcl0gOiBbcHJvamVjdERpcl07XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHZjRGlyIG9mIHZjRGlycykge1xuICAgICAgICAgICAgZm9yIChjb25zdCB2Y05hbWUgb2Ygdml0ZUNvbmZpZ05hbWVzKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHZjUGF0aCA9IHBhdGguam9pbih2Y0RpciwgdmNOYW1lKTtcbiAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHZjUGF0aCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxldCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHZjUGF0aCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgaXNMaWJyYXJ5TW9kZSA9IC9idWlsZFxccyo6XFxzKlxce1tcXHNcXFNdKj9saWJcXHMqOi9tLnRlc3QoY29udGVudCk7XG4gICAgICAgICAgICAgICAgaWYgKGlzTGlicmFyeU1vZGUpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbERlcHMgPSB7IC4uLihwa2cuZGVwZW5kZW5jaWVzIHx8IHt9KSwgLi4uKHBrZy5kZXZEZXBlbmRlbmNpZXMgfHwge30pLCAuLi4ocGtnLnBlZXJEZXBlbmRlbmNpZXMgfHwge30pIH07XG4gICAgICAgICAgICAgICAgICBjb25zdCBoYXNSZWFjdCA9ICEhYWxsRGVwc1tcInJlYWN0XCJdO1xuICAgICAgICAgICAgICAgICAgY29uc3QgaGFzVnVlID0gISFhbGxEZXBzW1widnVlXCJdO1xuICAgICAgICAgICAgICAgICAgY29uc3QgaGFzU3ZlbHRlID0gISFhbGxEZXBzW1wic3ZlbHRlXCJdO1xuICAgICAgICAgICAgICAgICAgY29uc3QgaGFzUmVhY3RQbHVnaW4gPSBjb250ZW50LmluY2x1ZGVzKFwicGx1Z2luLXJlYWN0XCIpO1xuICAgICAgICAgICAgICAgICAgY29uc3QgaGFzVnVlUGx1Z2luID0gY29udGVudC5pbmNsdWRlcyhcInBsdWdpbi12dWVcIik7XG5cbiAgICAgICAgICAgICAgICAgIGlmIChoYXNSZWFjdCAmJiAhaGFzUmVhY3RQbHVnaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGx1Z2luUGtnID0gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgZXhlY1N5bmM6IGVzIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1pc3NpbmdMaWJQa2dzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4odmNEaXIsIFwibm9kZV9tb2R1bGVzXCIsIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIikpICYmICFmcy5leGlzdHNTeW5jKHBhdGguam9pbihlZmZlY3RpdmVQcm9qZWN0RGlyLCBcIm5vZGVfbW9kdWxlc1wiLCBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCIpKSkgbWlzc2luZ0xpYlBrZ3MucHVzaChwbHVnaW5Qa2cpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4odmNEaXIsIFwibm9kZV9tb2R1bGVzXCIsIFwicmVhY3QtZG9tXCIpKSAmJiAhZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZWZmZWN0aXZlUHJvamVjdERpciwgXCJub2RlX21vZHVsZXNcIiwgXCJyZWFjdC1kb21cIikpKSBtaXNzaW5nTGliUGtncy5wdXNoKFwicmVhY3QtZG9tXCIpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4odmNEaXIsIFwibm9kZV9tb2R1bGVzXCIsIFwicmVhY3RcIikpICYmICFmcy5leGlzdHNTeW5jKHBhdGguam9pbihlZmZlY3RpdmVQcm9qZWN0RGlyLCBcIm5vZGVfbW9kdWxlc1wiLCBcInJlYWN0XCIpKSkgbWlzc2luZ0xpYlBrZ3MucHVzaChcInJlYWN0XCIpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChtaXNzaW5nTGliUGtncy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIExpYnJhcnktbW9kZSBjb25maWcgZm9yICR7bmFtZX0sIGluc3RhbGxpbmc6ICR7bWlzc2luZ0xpYlBrZ3Muam9pbihcIiwgXCIpfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5zdGFsbENtZCA9IHBtID09PSBcInBucG1cIiA/IGBwbnBtIGFkZCAtRCAke21pc3NpbmdMaWJQa2dzLmpvaW4oXCIgXCIpfWAgOiBwbSA9PT0gXCJ5YXJuXCIgPyBgeWFybiBhZGQgLUQgJHttaXNzaW5nTGliUGtncy5qb2luKFwiIFwiKX1gIDogcG0gPT09IFwiYnVuXCIgPyBgYnVuIGFkZCAtRCAke21pc3NpbmdMaWJQa2dzLmpvaW4oXCIgXCIpfWAgOiBgbnBtIGluc3RhbGwgLS1zYXZlLWRldiAtLWxlZ2FjeS1wZWVyLWRlcHMgJHttaXNzaW5nTGliUGtncy5qb2luKFwiIFwiKX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXMoaW5zdGFsbENtZCwgeyBjd2Q6IGVmZmVjdGl2ZVByb2plY3REaXIsIHRpbWVvdXQ6IDYwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gRmFpbGVkIHRvIGluc3RhbGwgbGliLW1vZGUgZGVwczogJHtlLm1lc3NhZ2U/LnNsaWNlKDAsIDE1MCl9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29udGVudCA9IGBpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xcbmltcG9ydCByZWFjdCBmcm9tICcke3BsdWdpblBrZ30nXFxuXFxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcXG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcXG59KVxcbmA7XG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFJld3JvdGUgbGlicmFyeS1tb2RlICR7dmNOYW1lfSB0byBkZXYtbW9kZSB3aXRoIFJlYWN0IHBsdWdpbiBmb3IgJHtuYW1lfWApO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChoYXNWdWUgJiYgIWhhc1Z1ZVBsdWdpbikge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50ID0gYGltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXFxuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXFxuXFxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcXG4gIHBsdWdpbnM6IFt2dWUoKV0sXFxufSlcXG5gO1xuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBSZXdyb3RlIGxpYnJhcnktbW9kZSAke3ZjTmFtZX0gdG8gZGV2LW1vZGUgd2l0aCBWdWUgcGx1Z2luIGZvciAke25hbWV9YCk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFoYXNSZWFjdCAmJiAhaGFzVnVlICYmICFoYXNTdmVsdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVudCA9IGBpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xcblxcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7fSlcXG5gO1xuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBSZXdyb3RlIGxpYnJhcnktbW9kZSAke3ZjTmFtZX0gdG8gZGV2LW1vZGUgZm9yICR7bmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWNoYW5nZWQgJiYgL2NvbmZpZ3VyZVNlcnZlclxccypcXCgvLnRlc3QoY29udGVudCkpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHVzZXNTd2MgPSBjb250ZW50LmluY2x1ZGVzKFwicGx1Z2luLXJlYWN0LXN3Y1wiKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHJlYWN0SW1wb3J0ID0gdXNlc1N3YyA/IFwicmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djJ1wiIDogXCJyZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcIjtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGFsaWFzTWF0Y2ggPSBjb250ZW50Lm1hdGNoKC9bXCInXUBbXCInXVxccyo6XFxzKnBhdGhcXC5yZXNvbHZlXFwoW14pXStcXCkvKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGFsaWFzQmxvY2sgPSBhbGlhc01hdGNoID8gYFxcbiAgcmVzb2x2ZToge1xcbiAgICBhbGlhczoge1xcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxcbiAgICAgIFwiQHNoYXJlZFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc2hhcmVkXCIpLFxcbiAgICAgIFwiQGFzc2V0c1wiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vYXR0YWNoZWRfYXNzZXRzXCIpLFxcbiAgICB9LFxcbiAgfSxgIDogXCJcIjtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IG1haW5Qb3J0ID0gNTAwMDtcbiAgICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBgaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcXG5pbXBvcnQgJHtyZWFjdEltcG9ydH07XFxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcXG5cXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xcbiAgcGx1Z2luczogW3JlYWN0KCldLFxcbiAgc2VydmVyOiB7XFxuICAgIGhvc3Q6IFwiMC4wLjAuMFwiLFxcbiAgICBwb3J0OiAke3BvcnR9LFxcbiAgICBhbGxvd2VkSG9zdHM6IHRydWUsXFxuICAgIHByb3h5OiB7XFxuICAgICAgXCIvYXBpXCI6IHtcXG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OiR7bWFpblBvcnR9XCIsXFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxcbiAgICAgIH0sXFxuICAgIH0sXFxuICB9LCR7YWxpYXNCbG9ja31cXG59KTtcXG5gO1xuICAgICAgICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFJlcGxhY2VkIHNlcnZlci1taWRkbGV3YXJlIHZpdGUgY29uZmlnIHdpdGggbWluaW1hbCBjb25maWcgZm9yICR7bmFtZX1gKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWNoYW5nZWQpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBvcnRNYXRjaCA9IGNvbnRlbnQubWF0Y2goL3BvcnRcXHMqOlxccyooXFxkKykvKTtcbiAgICAgICAgICAgICAgICAgIGlmIChwb3J0TWF0Y2ggJiYgcG9ydE1hdGNoWzFdICE9PSBTdHJpbmcocG9ydCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgvcG9ydFxccyo6XFxzKlxcZCsvLCBgcG9ydDogJHtwb3J0fWApO1xuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmICgvaG9zdFxccyo6XFxzKlsnXCJdbG9jYWxob3N0WydcIl0vLnRlc3QoY29udGVudCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgvaG9zdFxccyo6XFxzKlsnXCJdbG9jYWxob3N0WydcIl0vLCBgaG9zdDogJzAuMC4wLjAnYCk7XG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgaWYgKC9vcGVuXFxzKjpcXHMqdHJ1ZS8udGVzdChjb250ZW50KSkge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKC9vcGVuXFxzKjpcXHMqdHJ1ZS9nLCBcIm9wZW46IGZhbHNlXCIpO1xuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh2Y1BhdGgsIGNvbnRlbnQpO1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBQYXRjaGVkICR7dmNOYW1lfSBmb3IgJHtuYW1lfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgICAgYXdhaXQgcGF0Y2hWaXRlQ29uZmlnKCk7XG5cbiAgICAgICAgICBjb25zdCBlbnN1cmVFU01Db21wYXQgPSAoZGlyOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBrZ0pzb25QYXRoID0gcGF0aC5qb2luKGRpciwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocGtnSnNvblBhdGgpKSByZXR1cm47XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCBwa2dSYXcgPSBmcy5yZWFkRmlsZVN5bmMocGtnSnNvblBhdGgsIFwidXRmLThcIik7XG4gICAgICAgICAgICAgIGNvbnN0IHBrZ09iaiA9IEpTT04ucGFyc2UocGtnUmF3KTtcbiAgICAgICAgICAgICAgaWYgKHBrZ09iai50eXBlID09PSBcIm1vZHVsZVwiKSByZXR1cm47XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgdmNOYW1lIG9mIFtcInZpdGUuY29uZmlnLnRzXCIsIFwidml0ZS5jb25maWcuanNcIiwgXCJ2aXRlLmNvbmZpZy5tdHNcIiwgXCJ2aXRlLmNvbmZpZy5tanNcIl0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2Y1BhdGggPSBwYXRoLmpvaW4oZGlyLCB2Y05hbWUpO1xuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh2Y1BhdGgpKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCB2Y0NvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmModmNQYXRoLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgIGlmICgvXlxccyppbXBvcnRcXHMrL20udGVzdCh2Y0NvbnRlbnQpIHx8IC9eXFxzKmV4cG9ydFxccytkZWZhdWx0L20udGVzdCh2Y0NvbnRlbnQpKSB7XG4gICAgICAgICAgICAgICAgICBwa2dPYmoudHlwZSA9IFwibW9kdWxlXCI7XG4gICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBrZ0pzb25QYXRoLCBKU09OLnN0cmluZ2lmeShwa2dPYmosIG51bGwsIDIpLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBBZGRlZCBcInR5cGVcIjpcIm1vZHVsZVwiIHRvICR7bmFtZX0vJHtwYXRoLnJlbGF0aXZlKHByb2plY3REaXIsIHBrZ0pzb25QYXRoKX0gKHZpdGUgY29uZmlnIHVzZXMgRVNNIGltcG9ydHMpYCk7XG4gICAgICAgICAgICAgICAgICBpZiAocGtnT2JqID09PSBwa2cpIHBrZy50eXBlID0gXCJtb2R1bGVcIjtcblxuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBjZmdOYW1lIG9mIFtcInBvc3Rjc3MuY29uZmlnLmpzXCIsIFwicG9zdGNzcy5jb25maWcudHNcIiwgXCJ0YWlsd2luZC5jb25maWcuanNcIiwgXCJ0YWlsd2luZC5jb25maWcudHNcIl0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2ZnUGF0aCA9IHBhdGguam9pbihkaXIsIGNmZ05hbWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoY2ZnUGF0aCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNmZ0NvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoY2ZnUGF0aCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoY2ZnQ29udGVudC5pbmNsdWRlcyhcIm1vZHVsZS5leHBvcnRzXCIpIHx8IGNmZ0NvbnRlbnQuaW5jbHVkZXMoXCJyZXF1aXJlKFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3TmFtZSA9IGNmZ05hbWUucmVwbGFjZSgvXFwuKGpzfHRzKSQvLCBcIi5janNcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5yZW5hbWVTeW5jKGNmZ1BhdGgsIHBhdGguam9pbihkaXIsIG5ld05hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUmVuYW1lZCAke2NmZ05hbWV9IC0+ICR7bmV3TmFtZX0gKENKUyBzeW50YXggaW4gRVNNIHByb2plY3QpYCk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICB9O1xuICAgICAgICAgIGVuc3VyZUVTTUNvbXBhdChlZmZlY3RpdmVQcm9qZWN0RGlyKTtcbiAgICAgICAgICBpZiAoZWZmZWN0aXZlUHJvamVjdERpciAhPT0gcHJvamVjdERpcikgZW5zdXJlRVNNQ29tcGF0KHByb2plY3REaXIpO1xuXG4gICAgICAgICAgY29uc3QgZml4UG9zdENTU0FuZFRhaWx3aW5kID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgaXNFU00gPSBwa2cudHlwZSA9PT0gXCJtb2R1bGVcIjtcbiAgICAgICAgICAgIGNvbnN0IGRpcnNUb0NoZWNrID0gW2VmZmVjdGl2ZVByb2plY3REaXJdO1xuICAgICAgICAgICAgaWYgKGVmZmVjdGl2ZVByb2plY3REaXIgIT09IHByb2plY3REaXIpIGRpcnNUb0NoZWNrLnB1c2gocHJvamVjdERpcik7XG4gICAgICAgICAgICBjb25zdCBwb3N0Y3NzQ29uZmlncyA9IFtcInBvc3Rjc3MuY29uZmlnLmpzXCIsIFwicG9zdGNzcy5jb25maWcubWpzXCIsIFwicG9zdGNzcy5jb25maWcuY2pzXCJdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBiYXNlRGlyIG9mIGRpcnNUb0NoZWNrKSB7XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgcGNOYW1lIG9mIHBvc3Rjc3NDb25maWdzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGNQYXRoID0gcGF0aC5qb2luKGJhc2VEaXIsIHBjTmFtZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHBjUGF0aCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHBjUGF0aCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICAgIGlmIChpc0VTTSAmJiBjb250ZW50LmluY2x1ZGVzKFwibW9kdWxlLmV4cG9ydHNcIikgJiYgIXBjTmFtZS5lbmRzV2l0aChcIi5janNcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3TmFtZSA9IHBjTmFtZS5yZXBsYWNlKC9cXC4oanN8dHN8bWpzKSQvLCBcIi5janNcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBwYXRoLmpvaW4oYmFzZURpciwgbmV3TmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGZzLnJlbmFtZVN5bmMocGNQYXRoLCBuZXdQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBSZW5hbWVkICR7cGNOYW1lfSAtPiAke25ld05hbWV9IChFU00gcHJvamVjdCB1c2VzIG1vZHVsZS5leHBvcnRzKWApO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgaWYgKCFpc0VTTSAmJiBjb250ZW50LmluY2x1ZGVzKFwiZXhwb3J0IGRlZmF1bHRcIikgJiYgIXBjTmFtZS5lbmRzV2l0aChcIi5tanNcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3TmFtZSA9IHBjTmFtZS5yZXBsYWNlKC9cXC4oanN8dHN8Y2pzKSQvLCBcIi5tanNcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBwYXRoLmpvaW4oYmFzZURpciwgbmV3TmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGZzLnJlbmFtZVN5bmMocGNQYXRoLCBuZXdQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBSZW5hbWVkICR7cGNOYW1lfSAtPiAke25ld05hbWV9IChDSlMgcHJvamVjdCB1c2VzIGV4cG9ydCBkZWZhdWx0KWApO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgY29uc3QgcmVmc1RhaWx3aW5kID0gY29udGVudC5pbmNsdWRlcyhcInRhaWx3aW5kY3NzXCIpO1xuICAgICAgICAgICAgICAgICAgY29uc3QgcmVmc0F1dG9wcmVmaXhlciA9IGNvbnRlbnQuaW5jbHVkZXMoXCJhdXRvcHJlZml4ZXJcIik7XG4gICAgICAgICAgICAgICAgICBjb25zdCBhbGxEZXBzID0geyAuLi4ocGtnLmRlcGVuZGVuY2llcyB8fCB7fSksIC4uLihwa2cuZGV2RGVwZW5kZW5jaWVzIHx8IHt9KSB9O1xuICAgICAgICAgICAgICAgICAgY29uc3QgbWlzc2luZ1BrZ3M6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICAgICAgICBpZiAocmVmc1RhaWx3aW5kICYmICFhbGxEZXBzW1widGFpbHdpbmRjc3NcIl0pIG1pc3NpbmdQa2dzLnB1c2goXCJ0YWlsd2luZGNzc1wiKTtcbiAgICAgICAgICAgICAgICAgIGlmIChyZWZzQXV0b3ByZWZpeGVyICYmICFhbGxEZXBzW1wiYXV0b3ByZWZpeGVyXCJdKSBtaXNzaW5nUGtncy5wdXNoKFwiYXV0b3ByZWZpeGVyXCIpO1xuICAgICAgICAgICAgICAgICAgaWYgKG1pc3NpbmdQa2dzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGV4ZWNTeW5jOiBlcyB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnN0YWxsQ21kID0gcG0gPT09IFwibnBtXCIgPyBgbnBtIGluc3RhbGwgLS1zYXZlLWRldiAtLWxlZ2FjeS1wZWVyLWRlcHMgJHttaXNzaW5nUGtncy5qb2luKFwiIFwiKX1gIDogYG5weCAke3BtfSBhZGQgLUQgJHttaXNzaW5nUGtncy5qb2luKFwiIFwiKX1gO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gSW5zdGFsbGluZyBtaXNzaW5nIFBvc3RDU1MgZGVwczogJHttaXNzaW5nUGtncy5qb2luKFwiLCBcIil9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgZXMoaW5zdGFsbENtZCwgeyBjd2Q6IGVmZmVjdGl2ZVByb2plY3REaXIsIHRpbWVvdXQ6IDYwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBQb3N0Q1NTIGRlcCBpbnN0YWxsIHdhcm5pbmc6ICR7ZS5tZXNzYWdlPy5zbGljZSgwLCAyMDApfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB0YWlsd2luZENvbmZpZ3MgPSBbXCJ0YWlsd2luZC5jb25maWcuanNcIiwgXCJ0YWlsd2luZC5jb25maWcuY2pzXCIsIFwidGFpbHdpbmQuY29uZmlnLm1qc1wiXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgYmFzZURpciBvZiBkaXJzVG9DaGVjaykge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHR3TmFtZSBvZiB0YWlsd2luZENvbmZpZ3MpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0d1BhdGggPSBwYXRoLmpvaW4oYmFzZURpciwgdHdOYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmModHdQYXRoKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmModHdQYXRoLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgaWYgKGlzRVNNICYmIGNvbnRlbnQuaW5jbHVkZXMoXCJtb2R1bGUuZXhwb3J0c1wiKSAmJiAhdHdOYW1lLmVuZHNXaXRoKFwiLmNqc1wiKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdOYW1lID0gdHdOYW1lLnJlcGxhY2UoL1xcLihqc3x0c3xtanMpJC8sIFwiLmNqc1wiKTtcbiAgICAgICAgICAgICAgICAgICAgZnMucmVuYW1lU3luYyh0d1BhdGgsIHBhdGguam9pbihiYXNlRGlyLCBuZXdOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUmVuYW1lZCAke3R3TmFtZX0gLT4gJHtuZXdOYW1lfSAoRVNNIGNvbXBhdClgKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgIGF3YWl0IGZpeFBvc3RDU1NBbmRUYWlsd2luZCgpO1xuXG4gICAgICAgICAgbGV0IGRldkNtZCA9IGRldGVjdERldkNvbW1hbmQoKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFN0YXJ0aW5nICR7bmFtZX0gd2l0aDogJHtkZXZDbWQuY21kfSAke2RldkNtZC5hcmdzLmpvaW4oXCIgXCIpfWApO1xuXG4gICAgICAgICAgY29uc3QgaXNQbnBtTW9ub3JlcG8gPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0td29ya3NwYWNlLnlhbWxcIikpO1xuICAgICAgICAgIGlmIChpc1BucG1Nb25vcmVwbykge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0cyA9IHBrZy5zY3JpcHRzIHx8IHt9O1xuICAgICAgICAgICAgY29uc3QgYnVpbGRTY3JpcHQgPSBzY3JpcHRzW1wicGFja2FnZXM6YnVpbGRcIl0gfHwgc2NyaXB0cy5idWlsZDtcbiAgICAgICAgICAgIGlmIChidWlsZFNjcmlwdCAmJiAoYnVpbGRTY3JpcHQuaW5jbHVkZXMoXCItLWZpbHRlclwiKSB8fCBidWlsZFNjcmlwdC5pbmNsdWRlcyhcInBhY2thZ2VzXCIpKSkge1xuICAgICAgICAgICAgICBjb25zdCBidWlsZEtleSA9IHNjcmlwdHNbXCJwYWNrYWdlczpidWlsZFwiXSA/IFwicGFja2FnZXM6YnVpbGRcIiA6IFwiYnVpbGRcIjtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBQcmUtYnVpbGRpbmcgcG5wbSBtb25vcmVwbyBwYWNrYWdlcyB3aXRoOiBwbnBtIHJ1biAke2J1aWxkS2V5fWApO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgZXhlY1N5bmM6IGV4ZWNTeW5jQnVpbGQgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgICAgICAgZXhlY1N5bmNCdWlsZChgcG5wbSBydW4gJHtidWlsZEtleX1gLCB7IGN3ZDogcHJvamVjdERpciwgc3RkaW86IFwicGlwZVwiLCB0aW1lb3V0OiA5MDAwMCwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBNb25vcmVwbyBwYWNrYWdlcyBidWlsdCBzdWNjZXNzZnVsbHlgKTtcbiAgICAgICAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBNb25vcmVwbyBwYWNrYWdlIGJ1aWxkIHdhcm5pbmc6ICR7ZS5tZXNzYWdlPy5zbGljZSgwLCAyMDApfWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgY29uc29sZUJyaWRnZVNjcmlwdCA9IGA8c2NyaXB0IGRhdGEtbGFtYnktY29uc29sZS1icmlkZ2U+XG4oZnVuY3Rpb24oKSB7XG4gIGlmICh3aW5kb3cuX19sYW1ieUNvbnNvbGVCcmlkZ2UpIHJldHVybjtcbiAgd2luZG93Ll9fbGFtYnlDb25zb2xlQnJpZGdlID0gdHJ1ZTtcbiAgdmFyIG9yaWdMb2cgPSBjb25zb2xlLmxvZywgb3JpZ1dhcm4gPSBjb25zb2xlLndhcm4sIG9yaWdFcnJvciA9IGNvbnNvbGUuZXJyb3IsIG9yaWdJbmZvID0gY29uc29sZS5pbmZvO1xuICBmdW5jdGlvbiBzZW5kKGxldmVsLCBhcmdzLCBzdGFjaykge1xuICAgIHRyeSB7XG4gICAgICB2YXIgc2VyaWFsaXplZCA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRyeSB7IHNlcmlhbGl6ZWQucHVzaCh0eXBlb2YgYXJnc1tpXSA9PT0gJ29iamVjdCcgPyBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGFyZ3NbaV0pKSA6IGFyZ3NbaV0pOyB9XG4gICAgICAgIGNhdGNoKGUpIHsgc2VyaWFsaXplZC5wdXNoKFN0cmluZyhhcmdzW2ldKSk7IH1cbiAgICAgIH1cbiAgICAgIHdpbmRvdy5wYXJlbnQucG9zdE1lc3NhZ2UoeyB0eXBlOiAnbGFtYnktY29uc29sZS1icmlkZ2UnLCBsZXZlbDogbGV2ZWwsIGFyZ3M6IHNlcmlhbGl6ZWQsIHN0YWNrOiBzdGFjayB8fCBudWxsIH0sICcqJyk7XG4gICAgfSBjYXRjaChlKSB7fVxuICB9XG4gIGNvbnNvbGUubG9nID0gZnVuY3Rpb24oKSB7IHNlbmQoJ2xvZycsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpOyBvcmlnTG9nLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cyk7IH07XG4gIGNvbnNvbGUud2FybiA9IGZ1bmN0aW9uKCkgeyBzZW5kKCd3YXJuJywgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSk7IG9yaWdXYXJuLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cyk7IH07XG4gIGNvbnNvbGUuZXJyb3IgPSBmdW5jdGlvbigpIHsgc2VuZCgnZXJyb3InLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKTsgb3JpZ0Vycm9yLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cyk7IH07XG4gIGNvbnNvbGUuaW5mbyA9IGZ1bmN0aW9uKCkgeyBzZW5kKCdpbmZvJywgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSk7IG9yaWdJbmZvLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cyk7IH07XG4gIHdpbmRvdy5vbmVycm9yID0gZnVuY3Rpb24obXNnLCBzb3VyY2UsIGxpbmUsIGNvbHVtbiwgZXJyb3IpIHtcbiAgICBzZW5kKCdlcnJvcicsIFtTdHJpbmcobXNnKV0sIGVycm9yICYmIGVycm9yLnN0YWNrID8gZXJyb3Iuc3RhY2sgOiBudWxsKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCd1bmhhbmRsZWRyZWplY3Rpb24nLCBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciByZWFzb24gPSBldmVudC5yZWFzb247XG4gICAgdmFyIG1zZyA9IHJlYXNvbiBpbnN0YW5jZW9mIEVycm9yID8gcmVhc29uLm1lc3NhZ2UgOiBTdHJpbmcocmVhc29uKTtcbiAgICB2YXIgc3RhY2sgPSByZWFzb24gaW5zdGFuY2VvZiBFcnJvciA/IHJlYXNvbi5zdGFjayA6IG51bGw7XG4gICAgc2VuZCgnZXJyb3InLCBbJ1VuaGFuZGxlZCBQcm9taXNlIFJlamVjdGlvbjogJyArIG1zZ10sIHN0YWNrKTtcbiAgfSk7XG4gIHZhciBtb2R1bGVFcnJvcnMgPSBbXTtcbiAgdmFyIG9yaWdDcmVhdGVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudDtcbiAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCA9IGZ1bmN0aW9uKHRhZykge1xuICAgIHZhciBlbCA9IG9yaWdDcmVhdGVFbGVtZW50LmNhbGwoZG9jdW1lbnQsIHRhZyk7XG4gICAgaWYgKHRhZyA9PT0gJ3NjcmlwdCcpIHtcbiAgICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZnVuY3Rpb24oZSkge1xuICAgICAgICB2YXIgc3JjID0gZWwuc3JjIHx8IGVsLmdldEF0dHJpYnV0ZSgnc3JjJykgfHwgJ3Vua25vd24nO1xuICAgICAgICBtb2R1bGVFcnJvcnMucHVzaChzcmMpO1xuICAgICAgICBzZW5kKCdlcnJvcicsIFsnW0xhbWJ5XSBGYWlsZWQgdG8gbG9hZCBzY3JpcHQ6ICcgKyBzcmNdKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gZWw7XG4gIH07XG4gIGZ1bmN0aW9uIGV4dHJhY3RPdmVybGF5Q29udGVudChlbCkge1xuICAgIHRyeSB7XG4gICAgICB2YXIgcm9vdCA9IGVsLnNoYWRvd1Jvb3QgfHwgZWw7XG4gICAgICB2YXIgdGV4dCA9ICcnO1xuICAgICAgdmFyIG1zZ0VsID0gcm9vdC5xdWVyeVNlbGVjdG9yKCcubWVzc2FnZS1ib2R5LCAubWVzc2FnZSwgW2NsYXNzKj1cIm1lc3NhZ2VcIl0sIHByZScpO1xuICAgICAgaWYgKG1zZ0VsKSB0ZXh0ID0gbXNnRWwudGV4dENvbnRlbnQgfHwgJyc7XG4gICAgICBpZiAoIXRleHQpIHtcbiAgICAgICAgdmFyIHByZUVscyA9IHJvb3QucXVlcnlTZWxlY3RvckFsbCgncHJlLCBjb2RlJyk7XG4gICAgICAgIGZvciAodmFyIHAgPSAwOyBwIDwgcHJlRWxzLmxlbmd0aDsgcCsrKSB7IHRleHQgKz0gKHByZUVsc1twXS50ZXh0Q29udGVudCB8fCAnJykgKyAnXFxcXG4nOyB9XG4gICAgICB9XG4gICAgICBpZiAoIXRleHQpIHtcbiAgICAgICAgdGV4dCA9IHJvb3QudGV4dENvbnRlbnQgfHwgZWwudGV4dENvbnRlbnQgfHwgJyc7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGV4dC50cmltKCkuc3Vic3RyaW5nKDAsIDQwMDApO1xuICAgIH0gY2F0Y2goZSkgeyByZXR1cm4gJyc7IH1cbiAgfVxuICBmdW5jdGlvbiBjaGVja092ZXJsYXlzKCkge1xuICAgIHRyeSB7XG4gICAgICB2YXIgc2VsZWN0b3JzID0gWyd2aXRlLWVycm9yLW92ZXJsYXknLCAnbmV4dGpzLXBvcnRhbCcsICcjd2VicGFjay1kZXYtc2VydmVyLWNsaWVudC1vdmVybGF5J107XG4gICAgICBmb3IgKHZhciBzID0gMDsgcyA8IHNlbGVjdG9ycy5sZW5ndGg7IHMrKykge1xuICAgICAgICB2YXIgZWxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcnNbc10pO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChlbHNbaV0uX19sYW1ieVJlcG9ydGVkKSBjb250aW51ZTtcbiAgICAgICAgICBlbHNbaV0uX19sYW1ieVJlcG9ydGVkID0gdHJ1ZTtcbiAgICAgICAgICB2YXIgY29udGVudCA9IGV4dHJhY3RPdmVybGF5Q29udGVudChlbHNbaV0pO1xuICAgICAgICAgIGlmIChjb250ZW50KSB7XG4gICAgICAgICAgICBzZW5kKCdlcnJvcicsIFsnW0xhbWJ5XSBFcnJvciBvdmVybGF5IGRldGVjdGVkICgnICsgc2VsZWN0b3JzW3NdICsgJyk6XFxcXG4nICsgY29udGVudF0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZW5kKCdlcnJvcicsIFsnW0xhbWJ5XSBFcnJvciBvdmVybGF5IGRldGVjdGVkICgnICsgc2VsZWN0b3JzW3NdICsgJykgYnV0IGNvdWxkIG5vdCBleHRyYWN0IGNvbnRlbnQuJ10pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2goZSkge31cbiAgfVxuICB0cnkge1xuICAgIHZhciBvdmVybGF5T2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihmdW5jdGlvbigpIHsgY2hlY2tPdmVybGF5cygpOyB9KTtcbiAgICBvdmVybGF5T2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuICB9IGNhdGNoKGUpIHt9XG4gIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgY2hlY2tPdmVybGF5cygpO1xuICAgIHRyeSB7XG4gICAgICB2YXIgcm9vdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyb290JykgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FwcCcpO1xuICAgICAgaWYgKHJvb3QgJiYgcm9vdC5jaGlsZHJlbi5sZW5ndGggPT09IDAgJiYgcm9vdC50ZXh0Q29udGVudC50cmltKCkgPT09ICcnKSB7XG4gICAgICAgIHZhciBkaWFnID0gJ1tMYW1ieV0gQmxhbmsgc2NyZWVuIGRldGVjdGVkIFx1MjAxNCByb290IGVsZW1lbnQgZXhpc3RzIGJ1dCBoYXMgbm8gcmVuZGVyZWQgY29udGVudCBhZnRlciA1cy4nO1xuICAgICAgICBpZiAobW9kdWxlRXJyb3JzLmxlbmd0aCA+IDApIGRpYWcgKz0gJyBGYWlsZWQgc2NyaXB0czogJyArIG1vZHVsZUVycm9ycy5qb2luKCcsICcpO1xuICAgICAgICB2YXIgdml0ZUVycm9ycyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3ZpdGUtZXJyb3Itb3ZlcmxheScpO1xuICAgICAgICBpZiAodml0ZUVycm9ycy5sZW5ndGggPiAwKSBkaWFnICs9ICcgVml0ZSBlcnJvciBvdmVybGF5IGlzIHNob3dpbmcuJztcbiAgICAgICAgc2VuZCgnd2FybicsIFtkaWFnXSk7XG4gICAgICB9XG4gICAgICBpZiAoIXJvb3QpIHtcbiAgICAgICAgdmFyIGJvZHkgPSBkb2N1bWVudC5ib2R5O1xuICAgICAgICB2YXIgdmlzaWJsZVRleHQgPSBib2R5ID8gYm9keS5pbm5lclRleHQudHJpbSgpIDogJyc7XG4gICAgICAgIGlmICh2aXNpYmxlVGV4dC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBzZW5kKCd3YXJuJywgWydbTGFtYnldIEJsYW5rIHNjcmVlbiBkZXRlY3RlZCBcdTIwMTQgbm8gdmlzaWJsZSBjb250ZW50IG9uIHBhZ2UgYWZ0ZXIgNXMuIENoZWNrIHRoYXQgaW5kZXguaHRtbCBoYXMgdGhlIGNvcnJlY3Qgcm9vdCBlbGVtZW50IGFuZCBlbnRyeSBzY3JpcHQuJ10pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaChlKSB7fVxuICB9LCA1MDAwKTtcbn0pKCk7XG48L3NjcmlwdD5gO1xuXG4gICAgICAgICAgY29uc3QgaW5kZXhIdG1sUGF0aHMgPSBbXG4gICAgICAgICAgICBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJpbmRleC5odG1sXCIpLFxuICAgICAgICAgICAgcGF0aC5qb2luKHByb2plY3REaXIsIFwicHVibGljXCIsIFwiaW5kZXguaHRtbFwiKSxcbiAgICAgICAgICAgIHBhdGguam9pbihwcm9qZWN0RGlyLCBcInNyY1wiLCBcImluZGV4Lmh0bWxcIiksXG4gICAgICAgICAgICAuLi5TVUJESVJfQ0FORElEQVRFUy5tYXAoZCA9PiBwYXRoLmpvaW4ocHJvamVjdERpciwgZCwgXCJpbmRleC5odG1sXCIpKSxcbiAgICAgICAgICAgIC4uLlNVQkRJUl9DQU5ESURBVEVTLm1hcChkID0+IHBhdGguam9pbihwcm9qZWN0RGlyLCBkLCBcInB1YmxpY1wiLCBcImluZGV4Lmh0bWxcIikpLFxuICAgICAgICAgICAgLi4uU1VCRElSX0NBTkRJREFURVMubWFwKGQgPT4gcGF0aC5qb2luKHByb2plY3REaXIsIGQsIFwic3JjXCIsIFwiaW5kZXguaHRtbFwiKSksXG4gICAgICAgICAgXTtcbiAgICAgICAgICBjb25zdCBwcmV2aWV3UGF0aEZpeFNjcmlwdCA9IGA8c2NyaXB0IGRhdGEtbGFtYnktcHJldmlldy1wYXRoPmlmKHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5tYXRjaCgvXlxcXFwvX19wcmV2aWV3XFxcXC9cXFxcZCsvKSl7d2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKG51bGwsJycsd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnJlcGxhY2UoL15cXFxcL19fcHJldmlld1xcXFwvXFxcXGQrXFxcXC8/LywnLycpK3dpbmRvdy5sb2NhdGlvbi5zZWFyY2grd2luZG93LmxvY2F0aW9uLmhhc2gpfTwvc2NyaXB0PmA7XG4gICAgICAgICAgZm9yIChjb25zdCBpbmRleEh0bWxQYXRoIG9mIGluZGV4SHRtbFBhdGhzKSB7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhpbmRleEh0bWxQYXRoKSkge1xuICAgICAgICAgICAgICBsZXQgaW5kZXhIdG1sID0gZnMucmVhZEZpbGVTeW5jKGluZGV4SHRtbFBhdGgsIFwidXRmLThcIik7XG4gICAgICAgICAgICAgIGxldCBpbmplY3RlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICBpZiAoIWluZGV4SHRtbC5pbmNsdWRlcyhcImxhbWJ5LWNvbnNvbGUtYnJpZGdlXCIpKSB7XG4gICAgICAgICAgICAgICAgaW5kZXhIdG1sID0gaW5kZXhIdG1sLnJlcGxhY2UoLzxoZWFkKFtePl0qKT4vLCBgPGhlYWQkMT5cXG4ke2NvbnNvbGVCcmlkZ2VTY3JpcHR9YCk7XG4gICAgICAgICAgICAgICAgaW5qZWN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICghaW5kZXhIdG1sLmluY2x1ZGVzKFwibGFtYnktcHJldmlldy1wYXRoXCIpKSB7XG4gICAgICAgICAgICAgICAgaW5kZXhIdG1sID0gaW5kZXhIdG1sLnJlcGxhY2UoLzxoZWFkKFtePl0qKT4vLCBgPGhlYWQkMT5cXG4ke3ByZXZpZXdQYXRoRml4U2NyaXB0fWApO1xuICAgICAgICAgICAgICAgIGluamVjdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoaW5qZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGluZGV4SHRtbFBhdGgsIGluZGV4SHRtbCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEluamVjdGVkIGNvbnNvbGUgYnJpZGdlIGludG8gJHtuYW1lfS8ke3BhdGgucmVsYXRpdmUocHJvamVjdERpciwgaW5kZXhIdG1sUGF0aCl9YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IGluZGV4SHRtbFBhdGggb2YgaW5kZXhIdG1sUGF0aHMpIHtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGluZGV4SHRtbFBhdGgpKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXhDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGluZGV4SHRtbFBhdGgsIFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0TWF0Y2ggPSBpbmRleENvbnRlbnQubWF0Y2goL3NyYz1bXCInXVxcLz8oc3JjXFwvW15cIiddK1xcLnRzeD8pW1wiJ10vKTtcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0TWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4RGlyID0gcGF0aC5kaXJuYW1lKGluZGV4SHRtbFBhdGgpO1xuICAgICAgICAgICAgICAgICAgY29uc3QgZW50cnlGaWxlID0gcGF0aC5qb2luKGluZGV4RGlyLCBzY3JpcHRNYXRjaFsxXSk7XG4gICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZW50cnlGaWxlKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeURpciA9IHBhdGguZGlybmFtZShlbnRyeUZpbGUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZW50cnlEaXIpKSBmcy5ta2RpclN5bmMoZW50cnlEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBleHQgPSBlbnRyeUZpbGUuZW5kc1dpdGgoXCIudHN4XCIpID8gXCJ0c3hcIiA6IFwidHNcIjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV4dCA9PT0gXCJ0c3hcIikge1xuICAgICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoZW50cnlGaWxlLCBgaW1wb3J0IHsgY3JlYXRlUm9vdCB9IGZyb20gXCJyZWFjdC1kb20vY2xpZW50XCI7XFxuXFxuZnVuY3Rpb24gQXBwKCkge1xcbiAgcmV0dXJuIChcXG4gICAgPGRpdiBzdHlsZT17eyBmb250RmFtaWx5OiBcInN5c3RlbS11aVwiLCBwYWRkaW5nOiAzMiwgdGV4dEFsaWduOiBcImNlbnRlclwiIH19PlxcbiAgICAgIDxoMT5Qcm9qZWN0IFJlYWR5PC9oMT5cXG4gICAgICA8cD5FZGl0IDxjb2RlPiR7c2NyaXB0TWF0Y2hbMV19PC9jb2RlPiB0byBnZXQgc3RhcnRlZC48L3A+XFxuICAgIDwvZGl2PlxcbiAgKTtcXG59XFxuXFxuY3JlYXRlUm9vdChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInJvb3RcIikhKS5yZW5kZXIoPEFwcCAvPik7XFxuYCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhlbnRyeUZpbGUsIGBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInJvb3RcIikhLmlubmVySFRNTCA9IFwiPGgxPlByb2plY3QgUmVhZHk8L2gxPjxwPkVkaXQgPGNvZGU+JHtzY3JpcHRNYXRjaFsxXX08L2NvZGU+IHRvIHN0YXJ0LjwvcD5cIjtcXG5gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIENyZWF0ZWQgbWlzc2luZyBlbnRyeSBwb2ludCAke3NjcmlwdE1hdGNoWzFdfSBmb3IgJHtuYW1lfWApO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZXQgaGFzVHNjb25maWdQYXRocyA9IGZhbHNlO1xuICAgICAgICAgIGNvbnN0IHRzY2ZnRGlycyA9IGVmZmVjdGl2ZVByb2plY3REaXIgIT09IHByb2plY3REaXIgPyBbZWZmZWN0aXZlUHJvamVjdERpciwgcHJvamVjdERpcl0gOiBbcHJvamVjdERpcl07XG4gICAgICAgICAgZm9yIChjb25zdCB0c2NmZ0RpciBvZiB0c2NmZ0RpcnMpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRzY2ZnIG9mIFtcInRzY29uZmlnLmpzb25cIiwgXCJ0c2NvbmZpZy5hcHAuanNvblwiXSkge1xuICAgICAgICAgICAgY29uc3QgdHNjZmdQYXRoID0gcGF0aC5qb2luKHRzY2ZnRGlyLCB0c2NmZyk7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0c2NmZ1BhdGgpKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gZnMucmVhZEZpbGVTeW5jKHRzY2ZnUGF0aCwgXCJ1dGYtOFwiKS5yZXBsYWNlKC9cXC9cXC8uKiQvZ20sIFwiXCIpLnJlcGxhY2UoL1xcL1xcKltcXHNcXFNdKj9cXCpcXC8vZywgXCJcIikucmVwbGFjZSgvLFxccyooW1xcXX1dKS9nLCBcIiQxXCIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UocmF3KTtcbiAgICAgICAgICAgICAgICBjb25zdCBjbyA9IHBhcnNlZC5jb21waWxlck9wdGlvbnMgfHwge307XG4gICAgICAgICAgICAgICAgaWYgKGNvLmJhc2VVcmwgfHwgY28ucGF0aHMpIGhhc1RzY29uZmlnUGF0aHMgPSB0cnVlO1xuICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCB2aXRlQ29uZmlnRGlycyA9IFtwcm9qZWN0RGlyLCAuLi5TVUJESVJfQ0FORElEQVRFUy5tYXAoZCA9PiBwYXRoLmpvaW4ocHJvamVjdERpciwgZCkpXTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHZpdGVEaXIgb2Ygdml0ZUNvbmZpZ0RpcnMpIHtcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh2aXRlRGlyKSkgY29udGludWU7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNmZ05hbWUgb2YgW1widml0ZS5jb25maWcudHNcIiwgXCJ2aXRlLmNvbmZpZy5qc1wiLCBcInZpdGUuY29uZmlnLm1qc1wiXSkge1xuICAgICAgICAgICAgICBjb25zdCB2aXRlQ29uZmlnUGF0aCA9IHBhdGguam9pbih2aXRlRGlyLCBjZmdOYW1lKTtcbiAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModml0ZUNvbmZpZ1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgdml0ZUNvbmZpZ0NvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmModml0ZUNvbmZpZ1BhdGgsIFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgbGV0IGNvbnRlbnQgPSB2aXRlQ29uZmlnQ29udGVudDtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoXCJ1c2VQb2xsaW5nXCIpKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBoYXNTZXJ2ZXJCbG9jayA9IC9zZXJ2ZXJcXHMqOlxccypcXHsvLnRlc3QoY29udGVudCk7XG4gICAgICAgICAgICAgICAgICBpZiAoaGFzU2VydmVyQmxvY2spIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZShcbiAgICAgICAgICAgICAgICAgICAgICAvc2VydmVyXFxzKjpcXHMqXFx7LyxcbiAgICAgICAgICAgICAgICAgICAgICBgc2VydmVyOiB7XFxuICAgIHdhdGNoOiB7XFxuICAgICAgdXNlUG9sbGluZzogdHJ1ZSxcXG4gICAgICBpbnRlcnZhbDogNTAwLFxcbiAgICB9LGBcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgICAgICAgL2RlZmluZUNvbmZpZ1xcKFxcey8sXG4gICAgICAgICAgICAgICAgICAgICAgYGRlZmluZUNvbmZpZyh7XFxuICBzZXJ2ZXI6IHtcXG4gICAgd2F0Y2g6IHtcXG4gICAgICB1c2VQb2xsaW5nOiB0cnVlLFxcbiAgICAgIGludGVydmFsOiA1MDAsXFxuICAgIH0sXFxuICB9LGBcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmIChjb250ZW50ICE9PSB2aXRlQ29uZmlnQ29udGVudCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFBhdGNoZWQgJHtuYW1lfS8ke3BhdGgucmVsYXRpdmUocHJvamVjdERpciwgdml0ZUNvbmZpZ1BhdGgpfSB3aXRoIHVzZVBvbGxpbmdgKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKC9iYXNlOlxccypbXCInXVxcL1teXCInXStbXCInXS8udGVzdChjb250ZW50KSkge1xuICAgICAgICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgvXFxzKmJhc2U6XFxzKltcIiddXFwvW15cIiddK1tcIiddLD9cXG4/L2csIFwiXFxuXCIpO1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBSZW1vdmVkIGN1c3RvbSBiYXNlIHBhdGggZnJvbSAke25hbWV9LyR7cGF0aC5yZWxhdGl2ZShwcm9qZWN0RGlyLCB2aXRlQ29uZmlnUGF0aCl9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghL2htclxccyo6Ly50ZXN0KGNvbnRlbnQpKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoL3NlcnZlclxccyo6XFxzKlxcey8udGVzdChjb250ZW50KSkge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKC9zZXJ2ZXJcXHMqOlxccypcXHsvLCBgc2VydmVyOiB7XFxuICAgIGhtcjogeyBvdmVybGF5OiB0cnVlIH0sYCk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKC9kZWZpbmVDb25maWdcXChcXHsvLCBgZGVmaW5lQ29uZmlnKHtcXG4gIHNlcnZlcjogeyBobXI6IHsgb3ZlcmxheTogdHJ1ZSB9IH0sYCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEVuc3VyZWQgSE1SIGVycm9yIG92ZXJsYXkgZW5hYmxlZCBmb3IgJHtuYW1lfS8ke3BhdGgucmVsYXRpdmUocHJvamVjdERpciwgdml0ZUNvbmZpZ1BhdGgpfWApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGNzc0ZpbGVzID0gW1wiZ2xvYmFscy5jc3NcIiwgXCJpbmRleC5jc3NcIiwgXCJnbG9iYWwuY3NzXCIsIFwiYXBwLmNzc1wiLCBcInN0eWxlLmNzc1wiXTtcbiAgICAgICAgICAgICAgICBjb25zdCBjc3NEaXJzID0gW3BhdGguam9pbih2aXRlRGlyLCBcInNyY1wiKSwgcGF0aC5qb2luKHZpdGVEaXIsIFwic3JjXCIsIFwic3R5bGVcIiksIHBhdGguam9pbih2aXRlRGlyLCBcInNyY1wiLCBcInN0eWxlc1wiKSwgcGF0aC5qb2luKHZpdGVEaXIsIFwic3JjXCIsIFwiY3NzXCIpLCBwYXRoLmpvaW4odml0ZURpciwgXCJhcHBcIildO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY3NzRGlyIG9mIGNzc0RpcnMpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjc3NEaXIpKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY3NzTmFtZSBvZiBjc3NGaWxlcykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjc3NQYXRoID0gcGF0aC5qb2luKGNzc0RpciwgY3NzTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjc3NQYXRoKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgbGV0IGNzcyA9IGZzLnJlYWRGaWxlU3luYyhjc3NQYXRoLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICgvQGxheWVyXFxzK2Jhc2VcXHMqXFx7W1xcc1xcU10qP0BhcHBseVxccy8udGVzdChjc3MpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjc3MgPSBjc3MucmVwbGFjZSgvQGxheWVyXFxzK2Jhc2VcXHMqXFx7W1xcc1xcU10qP1xcblxcfS9nLCAoYmxvY2s6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYmxvY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvQGFwcGx5XFxzK2JvcmRlci1ib3JkZXJcXHMqOy9nLCBcImJvcmRlci1jb2xvcjogdmFyKC0tY29sb3ItYm9yZGVyLCBoc2wodmFyKC0tYm9yZGVyKSkpO1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9AYXBwbHlcXHMrYmctYmFja2dyb3VuZFxccyt0ZXh0LWZvcmVncm91bmRcXHMqOy9nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jb2xvci1iYWNrZ3JvdW5kLCBoc2wodmFyKC0tYmFja2dyb3VuZCkpKTtcXG4gICAgY29sb3I6IHZhcigtLWNvbG9yLWZvcmVncm91bmQsIGhzbCh2YXIoLS1mb3JlZ3JvdW5kKSkpO1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9AYXBwbHlcXHMrYmctYmFja2dyb3VuZFxccyo7L2csIFwiYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY29sb3ItYmFja2dyb3VuZCwgaHNsKHZhcigtLWJhY2tncm91bmQpKSk7XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL0BhcHBseVxccyt0ZXh0LWZvcmVncm91bmRcXHMqOy9nLCBcImNvbG9yOiB2YXIoLS1jb2xvci1mb3JlZ3JvdW5kLCBoc2wodmFyKC0tZm9yZWdyb3VuZCkpKTtcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoY3NzUGF0aCwgY3NzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUGF0Y2hlZCBAYXBwbHkgaW4gQGxheWVyIGJhc2UgZm9yICR7bmFtZX0vJHtwYXRoLnJlbGF0aXZlKHByb2plY3REaXIsIGNzc1BhdGgpfWApO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChoYXNUc2NvbmZpZ1BhdGhzICYmICFjb250ZW50LmluY2x1ZGVzKFwidHNjb25maWdQYXRoc1wiKSAmJiAhY29udGVudC5pbmNsdWRlcyhcInRzY29uZmlnLXBhdGhzXCIpKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCB0c3BQa2dJbnN0YWxsZWQgPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbih2aXRlRGlyLCBcIm5vZGVfbW9kdWxlc1wiLCBcInZpdGUtdHNjb25maWctcGF0aHNcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwibm9kZV9tb2R1bGVzXCIsIFwidml0ZS10c2NvbmZpZy1wYXRoc1wiKSk7XG4gICAgICAgICAgICAgICAgICBpZiAoIXRzcFBrZ0luc3RhbGxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGxldCBpbnN0YWxsQ21kID0gXCJucG0gaW5zdGFsbCAtLWxlZ2FjeS1wZWVyLWRlcHMgLS1zYXZlLWRldiB2aXRlLXRzY29uZmlnLXBhdGhzXCI7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwicG5wbS1sb2NrLnlhbWxcIikpKSBpbnN0YWxsQ21kID0gXCJucHggcG5wbSBhZGQgLUQgdml0ZS10c2NvbmZpZy1wYXRoc1wiO1xuICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwieWFybi5sb2NrXCIpKSkgaW5zdGFsbENtZCA9IFwieWFybiBhZGQgLUQgdml0ZS10c2NvbmZpZy1wYXRoc1wiO1xuICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwiYnVuLmxvY2tiXCIpKSB8fCBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcImJ1bi5sb2NrXCIpKSkgaW5zdGFsbENtZCA9IFwiYnVuIGFkZCAtRCB2aXRlLXRzY29uZmlnLXBhdGhzXCI7XG4gICAgICAgICAgICAgICAgICAgICAgZXhlY1N5bmMoaW5zdGFsbENtZCwgeyBjd2Q6IHZpdGVEaXIsIHRpbWVvdXQ6IDYwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlLCB3aW5kb3dzSGlkZTogdHJ1ZSwgZW52OiBzYWZlSW5zdGFsbEVudiB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIEluc3RhbGxlZCB2aXRlLXRzY29uZmlnLXBhdGhzIGZvciAke25hbWV9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGluc3RhbGxFcnI6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gQ291bGQgbm90IGluc3RhbGwgdml0ZS10c2NvbmZpZy1wYXRocyBmb3IgJHtuYW1lfTogJHtpbnN0YWxsRXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDEwMCl9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbih2aXRlRGlyLCBcIm5vZGVfbW9kdWxlc1wiLCBcInZpdGUtdHNjb25maWctcGF0aHNcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwibm9kZV9tb2R1bGVzXCIsIFwidml0ZS10c2NvbmZpZy1wYXRoc1wiKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW1wb3J0TGluZSA9IGBpbXBvcnQgdHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJ1xcbmA7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBsdWdpbnNNYXRjaCA9IGNvbnRlbnQubWF0Y2goL3BsdWdpbnNcXHMqOlxccypcXFsvKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBsdWdpbnNNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBpbXBvcnRMaW5lICsgY29udGVudDtcbiAgICAgICAgICAgICAgICAgICAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKC9wbHVnaW5zXFxzKjpcXHMqXFxbLywgYHBsdWdpbnM6IFt0c2NvbmZpZ1BhdGhzKCksIGApO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gQWRkZWQgdHNjb25maWdQYXRocyBwbHVnaW4gdG8gJHtuYW1lfS8ke3BhdGgucmVsYXRpdmUocHJvamVjdERpciwgdml0ZUNvbmZpZ1BhdGgpfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGNvbnRlbnQgIT09IHZpdGVDb25maWdDb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHZpdGVDb25maWdQYXRoLCBjb250ZW50LCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZvciAoY29uc3QgcnNwYWNrQ2ZnIG9mIFtcInJzcGFjay5jb25maWcuanNcIiwgXCJyc3BhY2suY29uZmlnLnRzXCJdKSB7XG4gICAgICAgICAgICBjb25zdCByc3BhY2tQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIHJzcGFja0NmZyk7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhyc3BhY2tQYXRoKSkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxldCByc0NvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMocnNwYWNrUGF0aCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvcnRNYXRjaCA9IHJzQ29udGVudC5tYXRjaCgvcG9ydDpcXHMqKFxcZCspLyk7XG4gICAgICAgICAgICAgICAgaWYgKHBvcnRNYXRjaCAmJiBwb3J0TWF0Y2hbMV0gIT09IFN0cmluZyhwb3J0KSkge1xuICAgICAgICAgICAgICAgICAgcnNDb250ZW50ID0gcnNDb250ZW50LnJlcGxhY2UoL3BvcnQ6XFxzKlxcZCsvLCBgcG9ydDogJHtwb3J0fWApO1xuICAgICAgICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChyc0NvbnRlbnQuaW5jbHVkZXMoXCJkZXZTZXJ2ZXJcIikgJiYgIXJzQ29udGVudC5pbmNsdWRlcyhcImhvc3Q6XCIpKSB7XG4gICAgICAgICAgICAgICAgICByc0NvbnRlbnQgPSByc0NvbnRlbnQucmVwbGFjZSgvKGRldlNlcnZlcjpcXHMqXFx7KS8sIGAkMVxcbiAgICBob3N0OiAnMC4wLjAuMCcsYCk7XG4gICAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJzQ29udGVudC5pbmNsdWRlcyhcImhvc3Q6XCIpICYmICFyc0NvbnRlbnQuaW5jbHVkZXMoXCIwLjAuMC4wXCIpKSB7XG4gICAgICAgICAgICAgICAgICByc0NvbnRlbnQgPSByc0NvbnRlbnQucmVwbGFjZSgvaG9zdDpcXHMqWydcIl1bXidcIl0qWydcIl0vLCBgaG9zdDogJzAuMC4wLjAnYCk7XG4gICAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocnNwYWNrUGF0aCwgcnNDb250ZW50LCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBQYXRjaGVkICR7bmFtZX0vJHtyc3BhY2tDZmd9IHdpdGggcG9ydCAke3BvcnR9IGFuZCBob3N0IDAuMC4wLjBgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3Qgbm9kZVZlciA9IHBhcnNlSW50KHByb2Nlc3MudmVyc2lvbnMubm9kZS5zcGxpdChcIi5cIilbMF0sIDEwKTtcbiAgICAgICAgICBpZiAobm9kZVZlciA8IDIyKSB7XG4gICAgICAgICAgICBjb25zdCBpdGVyTWV0aG9kcyA9IFwiZmlsdGVyfG1hcHxmaW5kfHNvbWV8ZXZlcnl8cmVkdWNlfGZvckVhY2h8ZmxhdE1hcHx0b1NvcnRlZFwiO1xuICAgICAgICAgICAgY29uc3QgaXRlclJlID0gbmV3IFJlZ0V4cChgKFxcXFxiW2EtekEtWl8kXVthLXpBLVowLTlfJF0qKVxcXFwuKHZhbHVlc3xrZXlzfGVudHJpZXMpXFxcXChcXFxcKVxcXFwuKCR7aXRlck1ldGhvZHN9KVxcXFwoYCwgXCJnXCIpO1xuICAgICAgICAgICAgY29uc3QgcGF0Y2hJdGVyYXRvckhlbHBlcnMgPSAoZGlyOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKGRpcik7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBmIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoIWYuZW5kc1dpdGgoXCIuanNcIikgJiYgIWYuZW5kc1dpdGgoXCIubWpzXCIpICYmICFmLmVuZHNXaXRoKFwiLmNqc1wiKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICBjb25zdCBmcCA9IHBhdGguam9pbihkaXIsIGYpO1xuICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3JjID0gZnMucmVhZEZpbGVTeW5jKGZwLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXRlclJlLnRlc3Qoc3JjKSkge1xuICAgICAgICAgICAgICAgICAgICAgIGl0ZXJSZS5sYXN0SW5kZXggPSAwO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhdGNoZWQgPSBzcmMucmVwbGFjZShpdGVyUmUsIChfbWF0Y2g6IHN0cmluZywgdmFyTmFtZTogc3RyaW5nLCBpdGVyTWV0aG9kOiBzdHJpbmcsIGFycmF5TWV0aG9kOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBgQXJyYXkuZnJvbSgke3Zhck5hbWV9LiR7aXRlck1ldGhvZH0oKSkuJHthcnJheU1ldGhvZH0oYDtcbiAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAocGF0Y2hlZCAhPT0gc3JjKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGZwLCBwYXRjaGVkLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBQYXRjaGVkIE5vZGUgMjIrIGl0ZXJhdG9yIGhlbHBlcnMgaW4gJHtuYW1lfS8ke3BhdGgucmVsYXRpdmUocHJvamVjdERpciwgZnApfWApO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNvbnN0IHZyRGlzdCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBcIm5vZGVfbW9kdWxlc1wiLCBcInZ1ZS1yb3V0ZXJcIiwgXCJkaXN0XCIpO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModnJEaXN0KSkgcGF0Y2hJdGVyYXRvckhlbHBlcnModnJEaXN0KTtcbiAgICAgICAgICAgIGNvbnN0IHBucG1WUiA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBcIm5vZGVfbW9kdWxlc1wiLCBcIi5wbnBtXCIpO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocG5wbVZSKSkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBucG1EaXJzID0gZnMucmVhZGRpclN5bmMocG5wbVZSKS5maWx0ZXIoKGQ6IHN0cmluZykgPT4gZC5zdGFydHNXaXRoKFwidnVlLXJvdXRlckBcIikpO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZCBvZiBwbnBtRGlycykge1xuICAgICAgICAgICAgICAgICAgY29uc3QgZGlzdCA9IHBhdGguam9pbihwbnBtVlIsIGQsIFwibm9kZV9tb2R1bGVzXCIsIFwidnVlLXJvdXRlclwiLCBcImRpc3RcIik7XG4gICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhkaXN0KSkgcGF0Y2hJdGVyYXRvckhlbHBlcnMoZGlzdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcGF0aFNlcCA9IGlzV2luID8gXCI7XCIgOiBcIjpcIjtcbiAgICAgICAgICBjb25zdCBiaW5EaXJzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgIGJpbkRpcnMucHVzaChwYXRoLmpvaW4oZWZmZWN0aXZlUHJvamVjdERpciwgXCJub2RlX21vZHVsZXNcIiwgXCIuYmluXCIpKTtcbiAgICAgICAgICBpZiAoZWZmZWN0aXZlUHJvamVjdERpciAhPT0gcHJvamVjdERpcikge1xuICAgICAgICAgICAgYmluRGlycy5wdXNoKHBhdGguam9pbihwcm9qZWN0RGlyLCBcIm5vZGVfbW9kdWxlc1wiLCBcIi5iaW5cIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBpc29sYXRlZFBhdGggPSBiaW5EaXJzLmpvaW4ocGF0aFNlcCkgKyBwYXRoU2VwICsgKHByb2Nlc3MuZW52LlBBVEggfHwgcHJvY2Vzcy5lbnYuUGF0aCB8fCBcIlwiKTtcblxuICAgICAgICAgIGNvbnN0IG5vZGVQYXRoczogc3RyaW5nW10gPSBbcGF0aC5qb2luKGVmZmVjdGl2ZVByb2plY3REaXIsIFwibm9kZV9tb2R1bGVzXCIpXTtcbiAgICAgICAgICBpZiAoZWZmZWN0aXZlUHJvamVjdERpciAhPT0gcHJvamVjdERpcikge1xuICAgICAgICAgICAgbm9kZVBhdGhzLnB1c2gocGF0aC5qb2luKHByb2plY3REaXIsIFwibm9kZV9tb2R1bGVzXCIpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBwb3J0RW52OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICAgICAgLi4ucHJvY2Vzcy5lbnYgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgICAgICAgICAgIEJST1dTRVI6IFwibm9uZVwiLFxuICAgICAgICAgICAgUE9SVDogU3RyaW5nKHBvcnQpLFxuICAgICAgICAgICAgSE9TVDogXCIwLjAuMC4wXCIsXG4gICAgICAgICAgICBIT1NUTkFNRTogXCIwLjAuMC4wXCIsXG4gICAgICAgICAgICBQQVRIOiBpc29sYXRlZFBhdGgsXG4gICAgICAgICAgICBOT0RFX1BBVEg6IG5vZGVQYXRocy5qb2luKHBhdGhTZXApLFxuICAgICAgICAgICAgQ0hPS0lEQVJfVVNFUE9MTElORzogXCJ0cnVlXCIsXG4gICAgICAgICAgfTtcbiAgICAgICAgICBpZiAoaXNXaW4gJiYgcG9ydEVudi5QYXRoKSB7IGRlbGV0ZSBwb3J0RW52LlBhdGg7IH1cblxuICAgICAgICAgIGNvbnN0IGlzUmVhY3RTY3JpcHRzID0gZGV2Q21kLmFyZ3MuaW5jbHVkZXMoXCJyZWFjdC1zY3JpcHRzXCIpO1xuICAgICAgICAgIGlmIChpc1JlYWN0U2NyaXB0cykge1xuICAgICAgICAgICAgcG9ydEVudi5QT1JUID0gU3RyaW5nKHBvcnQpO1xuICAgICAgICAgICAgcG9ydEVudi5IT1NUID0gXCIwLjAuMC4wXCI7XG4gICAgICAgICAgICBwb3J0RW52LlNLSVBfUFJFRkxJR0hUX0NIRUNLID0gXCJ0cnVlXCI7XG4gICAgICAgICAgICBwb3J0RW52LlBVQkxJQ19VUkwgPSBcIlwiO1xuICAgICAgICAgICAgcG9ydEVudi5OT0RFX09QVElPTlMgPSAocG9ydEVudi5OT0RFX09QVElPTlMgfHwgXCJcIikgKyBcIiAtLW9wZW5zc2wtbGVnYWN5LXByb3ZpZGVyXCI7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCBwa2dQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgICAgICBjb25zdCBwa2dSYXcgPSBmcy5yZWFkRmlsZVN5bmMocGtnUGF0aCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgY29uc3QgcGtnT2JqID0gSlNPTi5wYXJzZShwa2dSYXcpO1xuICAgICAgICAgICAgICBpZiAocGtnT2JqLmhvbWVwYWdlKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHBrZ09iai5ob21lcGFnZTtcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBrZ1BhdGgsIEpTT04uc3RyaW5naWZ5KHBrZ09iaiwgbnVsbCwgMikpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gUmVtb3ZlZCBob21lcGFnZSBmcm9tICR7bmFtZX0vcGFja2FnZS5qc29uIGZvciBjb3JyZWN0IGRldiBzZXJ2aW5nYCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBpc1dlYnBhY2tEaXJlY3QgPSBkZXZDbWQuYXJncy5pbmNsdWRlcyhcIndlYnBhY2tcIikgfHwgZGV2Q21kLmFyZ3MuaW5jbHVkZXMoXCJ3ZWJwYWNrLWRldi1zZXJ2ZXJcIikgfHwgZGV2Q21kLmFyZ3MuaW5jbHVkZXMoXCJ2dWUtY2xpLXNlcnZpY2VcIik7XG4gICAgICAgICAgaWYgKGlzV2VicGFja0RpcmVjdCAmJiAhaXNSZWFjdFNjcmlwdHMpIHtcbiAgICAgICAgICAgIHBvcnRFbnYuTk9ERV9PUFRJT05TID0gKHBvcnRFbnYuTk9ERV9PUFRJT05TIHx8IFwiXCIpICsgXCIgLS1vcGVuc3NsLWxlZ2FjeS1wcm92aWRlclwiO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGlzTmV4dERldiA9IGRldkNtZC5hcmdzLmluY2x1ZGVzKFwibmV4dFwiKTtcbiAgICAgICAgICBpZiAoaXNOZXh0RGV2KSB7XG4gICAgICAgICAgICBwb3J0RW52LkhPU1ROQU1FID0gXCIwLjAuMC4wXCI7XG4gICAgICAgICAgICBjb25zdCBuZXh0TG9ja1BhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgXCIubmV4dFwiLCBcImRldlwiLCBcImxvY2tcIik7XG4gICAgICAgICAgICB0cnkgeyBpZiAoZnMuZXhpc3RzU3luYyhuZXh0TG9ja1BhdGgpKSB7IGZzLnVubGlua1N5bmMobmV4dExvY2tQYXRoKTsgY29uc29sZS5sb2coYFtQcmV2aWV3XSBSZW1vdmVkIHN0YWxlIC5uZXh0L2Rldi9sb2NrIGZvciAke25hbWV9YCk7IH0gfSBjYXRjaCB7fVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChkZXZDbWQuY21kID09PSBcIm5weFwiICYmIGRldkNtZC5hcmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGJpbk5hbWUgPSBkZXZDbWQuYXJnc1swXTtcbiAgICAgICAgICAgIGNvbnN0IGxvY2FsQmluID0gcGF0aC5qb2luKGVmZmVjdGl2ZVByb2plY3REaXIsIFwibm9kZV9tb2R1bGVzXCIsIFwiLmJpblwiLCBpc1dpbiA/IGAke2Jpbk5hbWV9LmNtZGAgOiBiaW5OYW1lKTtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGxvY2FsQmluKSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXddIFVzaW5nIGxvY2FsIGJpbmFyeSBmb3IgJHtuYW1lfTogJHtsb2NhbEJpbn1gKTtcbiAgICAgICAgICAgICAgZGV2Q21kID0geyBjbWQ6IGxvY2FsQmluLCBhcmdzOiBkZXZDbWQuYXJncy5zbGljZSgxKSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHBvc3Rjc3NDb25maWdzID0gW1wicG9zdGNzcy5jb25maWcuanNcIiwgXCJwb3N0Y3NzLmNvbmZpZy5janNcIiwgXCJwb3N0Y3NzLmNvbmZpZy5tanNcIiwgXCJwb3N0Y3NzLmNvbmZpZy50c1wiLCBcIi5wb3N0Y3NzcmNcIiwgXCIucG9zdGNzc3JjLmpzXCIsIFwiLnBvc3Rjc3NyYy5qc29uXCJdO1xuICAgICAgICAgIGNvbnN0IGhhc093blBvc3Rjc3MgPSBwb3N0Y3NzQ29uZmlncy5zb21lKGYgPT4gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZWZmZWN0aXZlUHJvamVjdERpciwgZikpKTtcbiAgICAgICAgICBpZiAoIWhhc093blBvc3Rjc3MpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKGVmZmVjdGl2ZVByb2plY3REaXIsIFwicG9zdGNzcy5jb25maWcuY2pzXCIpLCBcIm1vZHVsZS5leHBvcnRzID0geyBwbHVnaW5zOiB7fSB9O1xcblwiKTtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBDcmVhdGVkIGVtcHR5IHBvc3Rjc3MuY29uZmlnLmNqcyBmb3IgJHtuYW1lfSB0byBpc29sYXRlIGZyb20gcGFyZW50YCk7XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgY2hpbGQgPSBzcGF3bihkZXZDbWQuY21kLCBkZXZDbWQuYXJncywge1xuICAgICAgICAgICAgY3dkOiBlZmZlY3RpdmVQcm9qZWN0RGlyLFxuICAgICAgICAgICAgc3RkaW86IFwicGlwZVwiLFxuICAgICAgICAgICAgc2hlbGw6IHRydWUsXG4gICAgICAgICAgICBkZXRhY2hlZDogIWlzV2luLFxuICAgICAgICAgICAgd2luZG93c0hpZGU6IHRydWUsXG4gICAgICAgICAgICBlbnY6IHBvcnRFbnYsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKCFpc1dpbikgY2hpbGQudW5yZWYoKTtcblxuICAgICAgICAgIGxldCBzdGFydHVwT3V0cHV0ID0gXCJcIjtcbiAgICAgICAgICBsZXQgc2VydmVyUmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICBjb25zdCBzdGFydHVwRXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICAgICAgY29uc3QgY29sbGVjdE91dHB1dCA9IChkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRleHQgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICBzdGFydHVwT3V0cHV0ICs9IHRleHQ7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ByZXZpZXc6JHtuYW1lfV0gJHt0ZXh0LnRyaW0oKX1gKTtcbiAgICAgICAgICAgIGlmICgvcmVhZHl8VklURS4qcmVhZHl8Y29tcGlsZWR8c3RhcnRlZCBzZXJ2ZXJ8bGlzdGVuaW5nfExvY2FsOnxTdWNjZXNzZnVsbHkgY29tcGlsZWQvaS50ZXN0KHRleHQpKSB7XG4gICAgICAgICAgICAgIHNlcnZlclJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgvZXJyb3J8RVJSIXxDYW5ub3QgZmluZHxNT0RVTEVfTk9UX0ZPVU5EfFN5bnRheEVycm9yfEVOT0VOVHxFQUREUklOVVNFfEVSRVNPTFZFfEVJTlRFR1JJVFl8RU5PTUVNfEVSUl9SRVFVSVJFX0VTTXxFUlJfT1NTTF9FVlAvaS50ZXN0KHRleHQpKSB7XG4gICAgICAgICAgICAgIHN0YXJ0dXBFcnJvcnMucHVzaCh0ZXh0LnRyaW0oKS5zbGljZSgwLCAzMDApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzZXJ2ZXJSZWFkeSAmJiAvZG9lcyBub3QgcHJvdmlkZSBhbiBleHBvcnR8RmFpbGVkIHRvIHJlc29sdmUgaW1wb3J0fFByZS10cmFuc2Zvcm0gZXJyb3J8SW50ZXJuYWwgc2VydmVyIGVycm9yfENhbm5vdCByZWFkIHByb3BlcnQuKnBvc3Rjc3N8RVJSX1BBQ0tBR0VfUEFUSF9OT1RfRVhQT1JURUR8Q2lyY3VsYXIgZGVwZW5kZW5jeXxFUkVTT0xWRXxFSU5URUdSSVRZfEVOT0VOVC4qbm9kZV9tb2R1bGVzfEVSUl9NT0RVTEVfTk9UX0ZPVU5EfEVSUl9SRVFVSVJFX0VTTXxFUlJfT1NTTF9FVlB8RU5PU1BDLippbm90aWZ5fEVNRklMRXxFTk9NRU18aGVhcCBvdXQgb2YgbWVtb3J5fEVBRERSSU5VU0V8VFMyMzA3fHRzY29uZmlnLiplcnJvcnxhbmd1bGFyLiptaXNtYXRjaHxFQ09OTlJFRlVTRUR8XFwuZW52Lipub3QgZm91bmR8Q09SUy4qYmxvY2tlZHx0aW1lZD8gP291dHxFVElNRURPVVR8ZXhpdGVkIHdpdGggY29kZSBbMS05XS9pLnRlc3QodGV4dCkpIHtcbiAgICAgICAgICAgICAgY29uc3QgY2xhc3NpZmllZCA9IGNsYXNzaWZ5Vml0ZUVycm9yKHRleHQpO1xuICAgICAgICAgICAgICBpZiAoY2xhc3NpZmllZC5jb25maWRlbmNlID49IDAuOCAmJiAhaXNWaXRlUmF0ZUxpbWl0ZWQodGV4dCkpIHtcbiAgICAgICAgICAgICAgICByZWNvcmRWaXRlQXR0ZW1wdCh0ZXh0KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0F1dG9GaXhdIExpdmUgZXJyb3IgaW4gcHJldmlldyAke25hbWV9OiBbJHtjbGFzc2lmaWVkLmNhdGVnb3J5fV0gXHUyMDE0IGV4ZWN1dGluZyByZWNvdmVyeS4uLmApO1xuXG4gICAgICAgICAgICAgICAgbGV0IGxpdmVSZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiBmYWxzZSwgc3VjY2VzczogZmFsc2UsIGRldGFpbDogXCJObyBhdXRvLWZpeCBhdmFpbGFibGVcIiB9O1xuICAgICAgICAgICAgICAgIGNvbnN0IHByb2pEaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiLCBuYW1lKTtcblxuICAgICAgICAgICAgICAgIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcInJlc3RhcnQtdml0ZVwiIHx8IGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiY2xlYXItY2FjaGUtcmVzdGFydFwiKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KG5hbWUpO1xuICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5KSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7IGVudHJ5LnByb2Nlc3Mua2lsbChcIlNJR1RFUk1cIik7IH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgICAgcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUobmFtZSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJjbGVhci1jYWNoZS1yZXN0YXJ0XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJWaXRlRnJhbWV3b3JrQ2FjaGVzKHByb2pEaXIpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgbGl2ZVJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IHRydWUsIGRldGFpbDogYFByZXZpZXcga2lsbGVkIGZvciByZXN0YXJ0ICgke2NsYXNzaWZpZWQuc3RyYXRlZ3l9KWAgfTtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gS2lsbGVkIHByZXZpZXcgJHtuYW1lfSBcdTIwMTQgd2lsbCBhdXRvLXJlc3RhcnQgb24gbmV4dCByZXF1ZXN0YCk7XG4gICAgICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBwcm9qRGlyLCBTdHJpbmcocG9ydCkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJucG0taW5zdGFsbFwiIHx8IGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwibGVnYWN5LXBlZXItZGVwc1wiIHx8IGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiZnVsbC1yZWluc3RhbGxcIikge1xuICAgICAgICAgICAgICAgICAgbGl2ZVJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IHRydWUsIGRldGFpbDogXCJRdWV1ZWQgaW5zdGFsbCArIHByZXZpZXcgcmVzdGFydFwiIH07XG4gICAgICAgICAgICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgZXhlY1N5bmM6IGVzMyB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnN0YWxsQ21kMyA9IHBtID09PSBcImJ1blwiID8gXCJucHggYnVuIGluc3RhbGxcIiA6IHBtID09PSBcInBucG1cIiA/IFwibnB4IHBucG0gaW5zdGFsbCAtLW5vLWZyb3plbi1sb2NrZmlsZVwiIDogcG0gPT09IFwieWFyblwiID8gXCJucHggeWFybiBpbnN0YWxsIC0taWdub3JlLWVuZ2luZXNcIiA6IFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzXCI7XG4gICAgICAgICAgICAgICAgICAgICAgZXMzKGluc3RhbGxDbWQzLCB7IGN3ZDogcHJvakRpciwgdGltZW91dDogMTIwMDAwLCBzdGRpbzogXCJwaXBlXCIgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZW50cnkyID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQobmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5MikgeyB0cnkgeyBlbnRyeTIucHJvY2Vzcy5raWxsKFwiU0lHVEVSTVwiKTsgfSBjYXRjaCB7fSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTsgfVxuICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gSW5zdGFsbCBjb21wbGV0ZWQgZm9yICR7bmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBwcm9qRGlyLCBTdHJpbmcocG9ydCkpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlOiB1bmtub3duKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZW0gPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtBdXRvRml4XSBJbnN0YWxsIGZhaWxlZCBmb3IgJHtuYW1lfTogJHtlbS5zbGljZSgwLCAyMDApfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9KSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJmaXgtcG9zdGNzcy1jb25maWdcIikge1xuICAgICAgICAgICAgICAgICAgZml4Vml0ZVBvc3Rjc3NDb25maWcocHJvakRpcik7XG4gICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KG5hbWUpO1xuICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5KSB7IHRyeSB7IGVudHJ5LnByb2Nlc3Mua2lsbChcIlNJR1RFUk1cIik7IH0gY2F0Y2gge30gcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUobmFtZSk7IH1cbiAgICAgICAgICAgICAgICAgIGxpdmVSZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IFwiUG9zdENTUyBjb25maWcgZml4ZWQgKyBwcmV2aWV3IGtpbGxlZCBmb3IgcmVzdGFydFwiIH07XG4gICAgICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBwcm9qRGlyLCBTdHJpbmcocG9ydCkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJraWxsLXBvcnRcIikge1xuICAgICAgICAgICAgICAgICAgY29uc3QgcG9ydE1hdGNoMyA9IHRleHQubWF0Y2goL0VBRERSSU5VU0UuKjooXFxkKykvaSk7XG4gICAgICAgICAgICAgICAgICBpZiAocG9ydE1hdGNoMykge1xuICAgICAgICAgICAgICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGV4ZWNTeW5jOiBlczMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBlczMoYGxzb2YgLXRpOiR7cG9ydE1hdGNoM1sxXX0gfCB4YXJncyBraWxsIC05IDI+L2Rldi9udWxsIHx8IHRydWVgLCB7IHRpbWVvdXQ6IDUwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgICB9KSgpO1xuICAgICAgICAgICAgICAgICAgICBsaXZlUmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiBgS2lsbGVkIHByb2Nlc3Mgb24gcG9ydCAke3BvcnRNYXRjaDNbMV19YCB9O1xuICAgICAgICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBwcm9qRGlyLCBTdHJpbmcocG9ydCkpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJ2aXRlLWZvcmNlXCIpIHtcbiAgICAgICAgICAgICAgICAgIGNsZWFyVml0ZUZyYW1ld29ya0NhY2hlcyhwcm9qRGlyKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQobmFtZSk7XG4gICAgICAgICAgICAgICAgICBpZiAoZW50cnkpIHsgdHJ5IHsgZW50cnkucHJvY2Vzcy5raWxsKFwiU0lHVEVSTVwiKTsgfSBjYXRjaCB7fSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTsgfVxuICAgICAgICAgICAgICAgICAgbGl2ZVJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IHRydWUsIGRldGFpbDogXCJDbGVhcmVkIFZpdGUgY2FjaGUgKyBwcmV2aWV3IGtpbGxlZCBmb3IgLS1mb3JjZSByZXN0YXJ0XCIgfTtcbiAgICAgICAgICAgICAgICAgIHNjaGVkdWxlVml0ZUF1dG9SZXN0YXJ0KG5hbWUsIHByb2pEaXIsIFN0cmluZyhwb3J0KSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcImZpeC10c2NvbmZpZy1wYXRoc1wiKSB7XG4gICAgICAgICAgICAgICAgICBmaXhWaXRlVHNjb25maWdQYXRocyhwcm9qRGlyKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQobmFtZSk7XG4gICAgICAgICAgICAgICAgICBpZiAoZW50cnkpIHsgdHJ5IHsgZW50cnkucHJvY2Vzcy5raWxsKFwiU0lHVEVSTVwiKTsgfSBjYXRjaCB7fSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTsgfVxuICAgICAgICAgICAgICAgICAgbGl2ZVJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IHRydWUsIGRldGFpbDogXCJ0c2NvbmZpZy5qc29uIHBhdGhzIGZpeGVkICsgcHJldmlldyBraWxsZWQgZm9yIHJlc3RhcnRcIiB9O1xuICAgICAgICAgICAgICAgICAgc2NoZWR1bGVWaXRlQXV0b1Jlc3RhcnQobmFtZSwgcHJvakRpciwgU3RyaW5nKHBvcnQpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiZXh0ZW5kLXRpbWVvdXRcIikge1xuICAgICAgICAgICAgICAgICAgbGl2ZVJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IHRydWUsIGRldGFpbDogXCJTdGFydHVwIHRpbWVvdXQgZXh0ZW5kZWQgXHUyMDE0IHdhaXRpbmcgbG9uZ2VyIGZvciBkZXYgc2VydmVyXCIgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiY29ycy1jb25maWdcIikge1xuICAgICAgICAgICAgICAgICAgY29uc3QgZml4ZWQgPSBmaXhWaXRlQ29yc0NvbmZpZyhwcm9qRGlyKTtcbiAgICAgICAgICAgICAgICAgIGlmIChmaXhlZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZW50cnkpIHsgdHJ5IHsgZW50cnkucHJvY2Vzcy5raWxsKFwiU0lHVEVSTVwiKTsgfSBjYXRjaCB7fSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTsgfVxuICAgICAgICAgICAgICAgICAgICBsaXZlUmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiBcIkNPUlMgY29uZmlnIHBhdGNoZWQgKyBwcmV2aWV3IGtpbGxlZCBmb3IgcmVzdGFydFwiIH07XG4gICAgICAgICAgICAgICAgICAgIHNjaGVkdWxlVml0ZUF1dG9SZXN0YXJ0KG5hbWUsIHByb2pEaXIsIFN0cmluZyhwb3J0KSk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsaXZlUmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogZmFsc2UsIGRldGFpbDogXCJDT1JTIGVycm9yIGRldGVjdGVkIFx1MjAxNCBjb3VsZCBub3QgYXV0by1wYXRjaC4gQWRkIGNvcnM6dHJ1ZSB0byB2aXRlIHNlcnZlciBjb25maWcgb3IgQ09SUyBtaWRkbGV3YXJlIHRvIEV4cHJlc3MgYXBwLlwiIH07XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcImluY3JlYXNlLXVsaW1pdFwiKSB7XG4gICAgICAgICAgICAgICAgICAoYXN5bmMgKCkgPT4geyB0cnkgeyBjb25zdCB7IGV4ZWNTeW5jOiBlczMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7IGVzMyhcInVsaW1pdCAtbiA2NTUzNiAyPi9kZXYvbnVsbCB8fCB0cnVlXCIsIHsgdGltZW91dDogNTAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSB9KTsgfSBjYXRjaCB7fSB9KSgpO1xuICAgICAgICAgICAgICAgICAgY29uc3QgZW50cnkgPSBwcmV2aWV3UHJvY2Vzc2VzLmdldChuYW1lKTtcbiAgICAgICAgICAgICAgICAgIGlmIChlbnRyeSkgeyB0cnkgeyBlbnRyeS5wcm9jZXNzLmtpbGwoXCJTSUdURVJNXCIpOyB9IGNhdGNoIHt9IHByZXZpZXdQcm9jZXNzZXMuZGVsZXRlKG5hbWUpOyB9XG4gICAgICAgICAgICAgICAgICBsaXZlUmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiBcIkluY3JlYXNlZCBmaWxlIGRlc2NyaXB0b3IgbGltaXQgKyBwcmV2aWV3IGtpbGxlZCBmb3IgcmVzdGFydFwiIH07XG4gICAgICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBwcm9qRGlyLCBTdHJpbmcocG9ydCkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJpbmNyZWFzZS13YXRjaGVyc1wiKSB7XG4gICAgICAgICAgICAgICAgICAoYXN5bmMgKCkgPT4geyB0cnkgeyBjb25zdCB7IGV4ZWNTeW5jOiBlczMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7IGVzMyhcInN5c2N0bCAtdyBmcy5pbm90aWZ5Lm1heF91c2VyX3dhdGNoZXM9NTI0Mjg4IDI+L2Rldi9udWxsIHx8IHRydWVcIiwgeyB0aW1lb3V0OiA1MDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlIH0pOyB9IGNhdGNoIHt9IH0pKCk7XG4gICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KG5hbWUpO1xuICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5KSB7IHRyeSB7IGVudHJ5LnByb2Nlc3Mua2lsbChcIlNJR1RFUk1cIik7IH0gY2F0Y2gge30gcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUobmFtZSk7IH1cbiAgICAgICAgICAgICAgICAgIGxpdmVSZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IFwiSW5jcmVhc2VkIGlub3RpZnkgd2F0Y2hlcnMgKyBwcmV2aWV3IGtpbGxlZCBmb3IgcmVzdGFydFwiIH07XG4gICAgICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBwcm9qRGlyLCBTdHJpbmcocG9ydCkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJhbmd1bGFyLXVwZGF0ZVwiKSB7XG4gICAgICAgICAgICAgICAgICAoYXN5bmMgKCkgPT4geyB0cnkgeyBjb25zdCB7IGV4ZWNTeW5jOiBlczMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7IGVzMyhcIm5weCBuZyB1cGRhdGUgQGFuZ3VsYXIvY29yZSBAYW5ndWxhci9jbGkgLS1mb3JjZSAyPi9kZXYvbnVsbCB8fCB0cnVlXCIsIHsgY3dkOiBwcm9qRGlyLCB0aW1lb3V0OiAxMjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUsIHdpbmRvd3NIaWRlOiB0cnVlIH0pOyB9IGNhdGNoIHt9IH0pKCk7XG4gICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KG5hbWUpO1xuICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5KSB7IHRyeSB7IGVudHJ5LnByb2Nlc3Mua2lsbChcIlNJR1RFUk1cIik7IH0gY2F0Y2gge30gcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUobmFtZSk7IH1cbiAgICAgICAgICAgICAgICAgIGxpdmVSZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IFwiQW5ndWxhciBwYWNrYWdlcyB1cGRhdGVkIHZpYSBuZyB1cGRhdGUgKyBwcmV2aWV3IGtpbGxlZCBmb3IgcmVzdGFydFwiIH07XG4gICAgICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBwcm9qRGlyLCBTdHJpbmcocG9ydCkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJpbnN0YWxsLW1pc3NpbmctZGVwXCIpIHtcbiAgICAgICAgICAgICAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGl2ZVBtID0gZGV0ZWN0UGFja2FnZU1hbmFnZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRlZCA9IGluc3RhbGxWaXRlTWlzc2luZ0RlcChwcm9qRGlyLCB0ZXh0LCBsaXZlUG0pO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgZXhlY1N5bmM6IGVzMyB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbGxDbWQzID0gbGl2ZVBtID09PSBcImJ1blwiID8gXCJucHggYnVuIGluc3RhbGxcIiA6IGxpdmVQbSA9PT0gXCJwbnBtXCIgPyBcIm5weCBwbnBtIGluc3RhbGwgLS1uby1mcm96ZW4tbG9ja2ZpbGVcIiA6IGxpdmVQbSA9PT0gXCJ5YXJuXCIgPyBcIm5weCB5YXJuIGluc3RhbGwgLS1pZ25vcmUtZW5naW5lc1wiIDogXCJucG0gaW5zdGFsbCAtLWxlZ2FjeS1wZWVyLWRlcHNcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVzMyhpbnN0YWxsQ21kMywgeyBjd2Q6IHByb2pEaXIsIHRpbWVvdXQ6IDEyMDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5MiA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRyeTIpIHsgdHJ5IHsgZW50cnkyLnByb2Nlc3Mua2lsbChcIlNJR1RFUk1cIik7IH0gY2F0Y2gge30gcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUobmFtZSk7IH1cbiAgICAgICAgICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBwcm9qRGlyLCBTdHJpbmcocG9ydCkpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICB9KSgpO1xuICAgICAgICAgICAgICAgICAgbGl2ZVJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IHRydWUsIGRldGFpbDogXCJNaXNzaW5nIGRlcGVuZGVuY3kgaW5zdGFsbGVkICsgcHJldmlldyBraWxsZWQgZm9yIHJlc3RhcnRcIiB9O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJkZWxldGUtZnJhbWV3b3JrLWNhY2hlXCIpIHtcbiAgICAgICAgICAgICAgICAgIGRlbGV0ZVZpdGVGcmFtZXdvcmtDYWNoZShwcm9qRGlyKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQobmFtZSk7XG4gICAgICAgICAgICAgICAgICBpZiAoZW50cnkpIHsgdHJ5IHsgZW50cnkucHJvY2Vzcy5raWxsKFwiU0lHVEVSTVwiKTsgfSBjYXRjaCB7fSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTsgfVxuICAgICAgICAgICAgICAgICAgbGl2ZVJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IHRydWUsIGRldGFpbDogXCJGcmFtZXdvcmsgY2FjaGUgZGVsZXRlZCArIHByZXZpZXcga2lsbGVkIGZvciByZXN0YXJ0XCIgfTtcbiAgICAgICAgICAgICAgICAgIHNjaGVkdWxlVml0ZUF1dG9SZXN0YXJ0KG5hbWUsIHByb2pEaXIsIFN0cmluZyhwb3J0KSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcInVwZGF0ZS1wYWNrYWdlXCIpIHtcbiAgICAgICAgICAgICAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBleGVjU3luYzogZXMzIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpdmVQbSA9IGRldGVjdFBhY2thZ2VNYW5hZ2VyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0ZWQgPSB1cGRhdGVWaXRlU3BlY2lmaWNQYWNrYWdlKHByb2pEaXIsIHRleHQsIGxpdmVQbSk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5zdGFsbENtZDMgPSBsaXZlUG0gPT09IFwiYnVuXCIgPyBcIm5weCBidW4gaW5zdGFsbFwiIDogbGl2ZVBtID09PSBcInBucG1cIiA/IFwibnB4IHBucG0gaW5zdGFsbCAtLW5vLWZyb3plbi1sb2NrZmlsZVwiIDogbGl2ZVBtID09PSBcInlhcm5cIiA/IFwibnB4IHlhcm4gaW5zdGFsbCAtLWlnbm9yZS1lbmdpbmVzXCIgOiBcIm5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwc1wiO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXMzKGluc3RhbGxDbWQzLCB7IGN3ZDogcHJvakRpciwgdGltZW91dDogMTIwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZW50cnkyID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQobmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5MikgeyB0cnkgeyBlbnRyeTIucHJvY2Vzcy5raWxsKFwiU0lHVEVSTVwiKTsgfSBjYXRjaCB7fSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTsgfVxuICAgICAgICAgICAgICAgICAgICAgIHNjaGVkdWxlVml0ZUF1dG9SZXN0YXJ0KG5hbWUsIHByb2pEaXIsIFN0cmluZyhwb3J0KSk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgIH0pKCk7XG4gICAgICAgICAgICAgICAgICBsaXZlUmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiBcIlBhY2thZ2UgdXBkYXRlZCB0byBsYXRlc3QgKyBwcmV2aWV3IGtpbGxlZCBmb3IgcmVzdGFydFwiIH07XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcImNhY2hlLWNsZWFuLXJlaW5zdGFsbFwiIHx8IGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiZnVsbC1pbnN0YWxsLXJldHJ5XCIgfHwgY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJpbnN0YWxsLW1pc3NpbmctY2xpXCIgfHwgY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJpbnN0YWxsLXR5cGVzXCIpIHtcbiAgICAgICAgICAgICAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBleGVjU3luYzogZXMzIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcImNhY2hlLWNsZWFuLXJlaW5zdGFsbFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkgeyBlczMoXCJucG0gY2FjaGUgY2xlYW4gLS1mb3JjZVwiLCB7IGN3ZDogcHJvakRpciwgdGltZW91dDogMzAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUsIHdpbmRvd3NIaWRlOiB0cnVlIH0pOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsb2NrRmlsZSA9IHBhdGguam9pbihwcm9qRGlyLCBcInBhY2thZ2UtbG9jay5qc29uXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMobG9ja0ZpbGUpKSBmcy51bmxpbmtTeW5jKGxvY2tGaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGl2ZVBtID0gZGV0ZWN0UGFja2FnZU1hbmFnZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnN0YWxsQ21kMyA9IGxpdmVQbSA9PT0gXCJidW5cIiA/IFwibnB4IGJ1biBpbnN0YWxsXCIgOiBsaXZlUG0gPT09IFwicG5wbVwiID8gXCJucHggcG5wbSBpbnN0YWxsIC0tbm8tZnJvemVuLWxvY2tmaWxlXCIgOiBsaXZlUG0gPT09IFwieWFyblwiID8gXCJucHggeWFybiBpbnN0YWxsIC0taWdub3JlLWVuZ2luZXNcIiA6IFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzXCI7XG4gICAgICAgICAgICAgICAgICAgICAgZXMzKGluc3RhbGxDbWQzLCB7IGN3ZDogcHJvakRpciwgdGltZW91dDogMTIwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeTIgPSBwcmV2aWV3UHJvY2Vzc2VzLmdldChuYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50cnkyKSB7IHRyeSB7IGVudHJ5Mi5wcm9jZXNzLmtpbGwoXCJTSUdURVJNXCIpOyB9IGNhdGNoIHt9IHByZXZpZXdQcm9jZXNzZXMuZGVsZXRlKG5hbWUpOyB9XG4gICAgICAgICAgICAgICAgICAgICAgc2NoZWR1bGVWaXRlQXV0b1Jlc3RhcnQobmFtZSwgcHJvakRpciwgU3RyaW5nKHBvcnQpKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgfSkoKTtcbiAgICAgICAgICAgICAgICAgIGxpdmVSZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IGBEZXBlbmRlbmNpZXMgcmVpbnN0YWxsZWQgKCR7Y2xhc3NpZmllZC5zdHJhdGVneX0pICsgcHJldmlldyBraWxsZWQgZm9yIHJlc3RhcnRgIH07XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcImNvcHktZW52LWV4YW1wbGVcIikge1xuICAgICAgICAgICAgICAgICAgY29weVZpdGVFbnZFeGFtcGxlKHByb2pEaXIpO1xuICAgICAgICAgICAgICAgICAgY29uc3QgZW50cnkgPSBwcmV2aWV3UHJvY2Vzc2VzLmdldChuYW1lKTtcbiAgICAgICAgICAgICAgICAgIGlmIChlbnRyeSkgeyB0cnkgeyBlbnRyeS5wcm9jZXNzLmtpbGwoXCJTSUdURVJNXCIpOyB9IGNhdGNoIHt9IHByZXZpZXdQcm9jZXNzZXMuZGVsZXRlKG5hbWUpOyB9XG4gICAgICAgICAgICAgICAgICBsaXZlUmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiBcIi5lbnYgY3JlYXRlZCArIHByZXZpZXcga2lsbGVkIGZvciByZXN0YXJ0XCIgfTtcbiAgICAgICAgICAgICAgICAgIHNjaGVkdWxlVml0ZUF1dG9SZXN0YXJ0KG5hbWUsIHByb2pEaXIsIFN0cmluZyhwb3J0KSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcImFkZC10eXBlLW1vZHVsZVwiKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBwa2dKc29uUGF0aDIgPSBwYXRoLmpvaW4ocHJvakRpciwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwa2dKc29uUGF0aDIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgcE9iaiA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBrZ0pzb25QYXRoMiwgXCJ1dGYtOFwiKSk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHBPYmoudHlwZSAhPT0gXCJtb2R1bGVcIikgeyBwT2JqLnR5cGUgPSBcIm1vZHVsZVwiOyBmcy53cml0ZUZpbGVTeW5jKHBrZ0pzb25QYXRoMiwgSlNPTi5zdHJpbmdpZnkocE9iaiwgbnVsbCwgMiksIFwidXRmLThcIik7IH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZW50cnkpIHsgdHJ5IHsgZW50cnkucHJvY2Vzcy5raWxsKFwiU0lHVEVSTVwiKTsgfSBjYXRjaCB7fSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTsgfVxuICAgICAgICAgICAgICAgICAgICBsaXZlUmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiBcIkFkZGVkIHR5cGU6bW9kdWxlICsgcHJldmlldyBraWxsZWQgZm9yIHJlc3RhcnRcIiB9O1xuICAgICAgICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBwcm9qRGlyLCBTdHJpbmcocG9ydCkpO1xuICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7IGxpdmVSZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiBmYWxzZSwgZGV0YWlsOiBcIkZhaWxlZCB0byBhZGQgdHlwZTptb2R1bGVcIiB9OyB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcIm9wZW5zc2wtbGVnYWN5LXByb3ZpZGVyXCIgfHwgY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJpbmNyZWFzZS1oZWFwXCIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQobmFtZSk7XG4gICAgICAgICAgICAgICAgICBpZiAoZW50cnkpIHsgdHJ5IHsgZW50cnkucHJvY2Vzcy5raWxsKFwiU0lHVEVSTVwiKTsgfSBjYXRjaCB7fSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTsgfVxuICAgICAgICAgICAgICAgICAgbGl2ZVJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IHRydWUsIGRldGFpbDogYFdpbGwgYXBwbHkgJHtjbGFzc2lmaWVkLnN0cmF0ZWd5fSBvbiByZXN0YXJ0YCB9O1xuICAgICAgICAgICAgICAgICAgc2NoZWR1bGVWaXRlQXV0b1Jlc3RhcnQobmFtZSwgcHJvakRpciwgU3RyaW5nKHBvcnQpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiZml4LXRzY29uZmlnXCIpIHtcbiAgICAgICAgICAgICAgICAgIGZpeFZpdGVUc2NvbmZpZ0pzb24ocHJvakRpcik7XG4gICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KG5hbWUpO1xuICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5KSB7IHRyeSB7IGVudHJ5LnByb2Nlc3Mua2lsbChcIlNJR1RFUk1cIik7IH0gY2F0Y2gge30gcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUobmFtZSk7IH1cbiAgICAgICAgICAgICAgICAgIGxpdmVSZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IFwidHNjb25maWcuanNvbiBmaXhlZCArIHByZXZpZXcga2lsbGVkIGZvciByZXN0YXJ0XCIgfTtcbiAgICAgICAgICAgICAgICAgIHNjaGVkdWxlVml0ZUF1dG9SZXN0YXJ0KG5hbWUsIHByb2pEaXIsIFN0cmluZyhwb3J0KSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcInVwZ3JhZGUtbm9kZS13YXJuaW5nXCIpIHtcbiAgICAgICAgICAgICAgICAgIGxldCBub2RlVmVyID0gXCJ1bmtub3duXCI7XG4gICAgICAgICAgICAgICAgICB0cnkgeyBjb25zdCBjcCA9IHJlcXVpcmUoXCJjaGlsZF9wcm9jZXNzXCIpIGFzIHR5cGVvZiBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpOyBub2RlVmVyID0gY3AuZXhlY1N5bmMoXCJub2RlIC0tdmVyc2lvblwiLCB7IHRpbWVvdXQ6IDUwMDAsIHN0ZGlvOiBcInBpcGVcIiwgZW5jb2Rpbmc6IFwidXRmLThcIiB9KS50b1N0cmluZygpLnRyaW0oKTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgbGl2ZVJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IGZhbHNlLCBkZXRhaWw6IGBOb2RlLmpzIHZlcnNpb24gbWlzbWF0Y2g6IGN1cnJlbnQgJHtub2RlVmVyfSBkb2VzIG5vdCBzdXBwb3J0IG1vZGVybiBzeW50YXggKG9wdGlvbmFsIGNoYWluaW5nLCBudWxsaXNoIGNvYWxlc2NpbmcsIGV0Yy4pLiBQbGVhc2UgdXBncmFkZSBOb2RlLmpzIHRvIHYxNCsgKHYxOCsgcmVjb21tZW5kZWQpLmAgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2aXRlRXJyb3JIaXN0b3J5LnB1c2goe1xuICAgICAgICAgICAgICAgICAgaWQ6IGBlcnItJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDYpfWAsXG4gICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksIHNvdXJjZTogXCJ2aXRlLXNlcnZlclwiLCBtZXNzYWdlOiB0ZXh0LnRyaW0oKS5zbGljZSgwLCA1MDApLFxuICAgICAgICAgICAgICAgICAgcHJvamVjdE5hbWU6IG5hbWUsIGNsYXNzaWZpZWQsIHJlY292ZXJ5OiBsaXZlUmVjb3ZlcnksXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHZpdGVFcnJvckhpc3RvcnkubGVuZ3RoID4gMjAwKSB2aXRlRXJyb3JIaXN0b3J5LnNwbGljZSgwLCB2aXRlRXJyb3JIaXN0b3J5Lmxlbmd0aCAtIDIwMCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY2hpbGQuc3Rkb3V0Py5vbihcImRhdGFcIiwgY29sbGVjdE91dHB1dCk7XG4gICAgICAgICAgY2hpbGQuc3RkZXJyPy5vbihcImRhdGFcIiwgY29sbGVjdE91dHB1dCk7XG5cbiAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLnNldChuYW1lLCB7IHByb2Nlc3M6IGNoaWxkLCBwb3J0IH0pO1xuXG4gICAgICAgICAgbGV0IGV4aXRlZCA9IGZhbHNlO1xuICAgICAgICAgIGNoaWxkLm9uKFwiZXJyb3JcIiwgKGVycjogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gUHJvY2VzcyBlcnJvciBmb3IgJHtuYW1lfTpgLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICBleGl0ZWQgPSB0cnVlO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY2hpbGQub24oXCJleGl0XCIsIChjb2RlOiBudW1iZXIgfCBudWxsKSA9PiB7XG4gICAgICAgICAgICBleGl0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKGNvZGUgIT09IDAgJiYgY29kZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gUHJvY2VzcyBmb3IgJHtuYW1lfSBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gKTtcbiAgICAgICAgICAgICAgcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUobmFtZSk7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gUHJldmlldyAke25hbWV9IGV4aXRlZCB3aXRoIGNvZGUgJHtjb2RlfSBcdTIwMTQgc2NoZWR1bGluZyBhdXRvLXJlc3RhcnRgKTtcbiAgICAgICAgICAgICAgc2NoZWR1bGVWaXRlQXV0b1Jlc3RhcnQobmFtZSwgZWZmZWN0aXZlUHJvamVjdERpciwgU3RyaW5nKHBvcnQpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHByZXZpZXdQcm9jZXNzZXMuZGVsZXRlKG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY29uc3QgbWF4V2FpdCA9IDE1MDAwO1xuICAgICAgICAgIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICB3aGlsZSAoRGF0ZS5ub3coKSAtIHN0YXJ0IDwgbWF4V2FpdCAmJiAhc2VydmVyUmVhZHkgJiYgIWV4aXRlZCkge1xuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDMwMCkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGlzVmFsaWROcG1QYWNrYWdlTmFtZSA9IChuYW1lOiBzdHJpbmcpOiBib29sZWFuID0+IHtcbiAgICAgICAgICAgIHJldHVybiAvXihAW2EtejAtOS5fLV0rXFwvKT9bYS16MC05Ll8tXSskLy50ZXN0KG5hbWUpICYmIG5hbWUubGVuZ3RoIDw9IDIxNDtcbiAgICAgICAgICB9O1xuICAgICAgICAgIGNvbnN0IE5PREVfQlVJTFRJTlMgPSBuZXcgU2V0KFtcImZzXCIsIFwicGF0aFwiLCBcIm9zXCIsIFwiY2hpbGRfcHJvY2Vzc1wiLCBcImh0dHBcIiwgXCJodHRwc1wiLCBcInVybFwiLCBcInV0aWxcIiwgXCJjcnlwdG9cIiwgXCJzdHJlYW1cIiwgXCJldmVudHNcIiwgXCJhc3NlcnRcIiwgXCJidWZmZXJcIiwgXCJuZXRcIiwgXCJ0bHNcIiwgXCJkbnNcIiwgXCJ6bGliXCIsIFwicXVlcnlzdHJpbmdcIiwgXCJtb2R1bGVcIiwgXCJ2bVwiLCBcImNsdXN0ZXJcIiwgXCJkZ3JhbVwiLCBcInJlYWRsaW5lXCIsIFwidHR5XCIsIFwid29ya2VyX3RocmVhZHNcIiwgXCJwZXJmX2hvb2tzXCIsIFwiYXN5bmNfaG9va3NcIiwgXCJ2OFwiLCBcImluc3BlY3RvclwiLCBcInN0cmluZ19kZWNvZGVyXCIsIFwidGltZXJzXCIsIFwiY29uc29sZVwiXSk7XG4gICAgICAgICAgY29uc3QgZXh0cmFjdE1pc3NpbmdQYWNrYWdlcyA9IChvdXRwdXQ6IHN0cmluZyk6IHN0cmluZ1tdID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBrZ3MgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgICAgICAgIGNvbnN0IGFkZElmVmFsaWQgPSAocmF3OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbW9kID0gcmF3LnN0YXJ0c1dpdGgoXCJAXCIpID8gcmF3LnNwbGl0KFwiL1wiKS5zbGljZSgwLCAyKS5qb2luKFwiL1wiKSA6IHJhdy5zcGxpdChcIi9cIilbMF07XG4gICAgICAgICAgICAgIGlmIChtb2QgJiYgIW1vZC5zdGFydHNXaXRoKFwiLlwiKSAmJiAhbW9kLnN0YXJ0c1dpdGgoXCIvXCIpICYmICFtb2Quc3RhcnRzV2l0aChcIn5cIikgJiYgIU5PREVfQlVJTFRJTlMuaGFzKG1vZCkgJiYgaXNWYWxpZE5wbVBhY2thZ2VOYW1lKG1vZCkpIHtcbiAgICAgICAgICAgICAgICBwa2dzLmFkZChtb2QpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29uc3QgY2Fubm90RmluZCA9IG91dHB1dC5tYXRjaEFsbCgvQ2Fubm90IGZpbmQgKD86bW9kdWxlfHBhY2thZ2UpIFsnXCJdKFteJ1wiXSspWydcIl0vZyk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG0gb2YgY2Fubm90RmluZCkgYWRkSWZWYWxpZChtWzFdKTtcbiAgICAgICAgICAgIGNvbnN0IGNvdWxkTm90UmVzb2x2ZSA9IG91dHB1dC5tYXRjaEFsbCgvQ291bGQgbm90IHJlc29sdmUgW1wiJ10oW15cIiddKylbXCInXS9nKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgbSBvZiBjb3VsZE5vdFJlc29sdmUpIGFkZElmVmFsaWQobVsxXSk7XG4gICAgICAgICAgICBjb25zdCBtb2R1bGVOb3RGb3VuZCA9IG91dHB1dC5tYXRjaEFsbCgvTW9kdWxlIG5vdCBmb3VuZC4qWydcIl0oW14nXCJdKylbJ1wiXS9nKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgbSBvZiBtb2R1bGVOb3RGb3VuZCkgYWRkSWZWYWxpZChtWzFdKTtcbiAgICAgICAgICAgIHJldHVybiBbLi4ucGtnc107XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGxldCByZXRyaWVkID0gZmFsc2U7XG4gICAgICAgICAgaWYgKGV4aXRlZCAmJiAhc2VydmVyUmVhZHkgJiYgIXJldHJpZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IG91dHB1dFN0ciA9IHN0YXJ0dXBPdXRwdXQgKyBcIiBcIiArIHN0YXJ0dXBFcnJvcnMuam9pbihcIiBcIik7XG4gICAgICAgICAgICBpZiAoL0VTTSBmaWxlIGNhbm5vdCBiZSBsb2FkZWQgYnkuKnJlcXVpcmV8Q2Fubm90IHVzZSBpbXBvcnQgc3RhdGVtZW50IG91dHNpZGUgYSBtb2R1bGV8RVJSX1JFUVVJUkVfRVNNL2kudGVzdChvdXRwdXRTdHIpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHBrZ0pzb25QYXRoID0gcGF0aC5qb2luKGVmZmVjdGl2ZVByb2plY3REaXIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwa2dKc29uUGF0aCkpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgY29uc3QgcFJhdyA9IGZzLnJlYWRGaWxlU3luYyhwa2dKc29uUGF0aCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBPYmogPSBKU09OLnBhcnNlKHBSYXcpO1xuICAgICAgICAgICAgICAgICAgaWYgKHBPYmoudHlwZSAhPT0gXCJtb2R1bGVcIikge1xuICAgICAgICAgICAgICAgICAgICBwT2JqLnR5cGUgPSBcIm1vZHVsZVwiO1xuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBrZ0pzb25QYXRoLCBKU09OLnN0cmluZ2lmeShwT2JqLCBudWxsLCAyKSwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBBdXRvLWZpeDogYWRkZWQgXCJ0eXBlXCI6XCJtb2R1bGVcIiB0byBwYWNrYWdlLmpzb24gYWZ0ZXIgRVNNIGVycm9yYCk7XG4gICAgICAgICAgICAgICAgICAgIGVuc3VyZUVTTUNvbXBhdChlZmZlY3RpdmVQcm9qZWN0RGlyKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVmZmVjdGl2ZVByb2plY3REaXIgIT09IHByb2plY3REaXIpIGVuc3VyZUVTTUNvbXBhdChwcm9qZWN0RGlyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0cmllZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2hpbGQyID0gc3Bhd24oZGV2Q21kLmNtZCwgZGV2Q21kLmFyZ3MsIHtcbiAgICAgICAgICAgICAgICAgICAgICBjd2Q6IGVmZmVjdGl2ZVByb2plY3REaXIsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgZGV0YWNoZWQ6ICFpc1dpbiwgd2luZG93c0hpZGU6IHRydWUsIGVudjogcG9ydEVudixcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNXaW4pIGNoaWxkMi51bnJlZigpO1xuICAgICAgICAgICAgICAgICAgICBzdGFydHVwT3V0cHV0ID0gXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgc2VydmVyUmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgZXhpdGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0dXBFcnJvcnMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGQyLnN0ZG91dD8ub24oXCJkYXRhXCIsIGNvbGxlY3RPdXRwdXQpO1xuICAgICAgICAgICAgICAgICAgICBjaGlsZDIuc3RkZXJyPy5vbihcImRhdGFcIiwgY29sbGVjdE91dHB1dCk7XG4gICAgICAgICAgICAgICAgICAgIHByZXZpZXdQcm9jZXNzZXMuc2V0KG5hbWUsIHsgcHJvY2VzczogY2hpbGQyLCBwb3J0IH0pO1xuICAgICAgICAgICAgICAgICAgICBjaGlsZDIub24oXCJlcnJvclwiLCAoKSA9PiB7IGV4aXRlZCA9IHRydWU7IH0pO1xuICAgICAgICAgICAgICAgICAgICBjaGlsZDIub24oXCJleGl0XCIsIChjb2RlOiBudW1iZXIgfCBudWxsKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgZXhpdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoY29kZSAhPT0gMCAmJiBjb2RlICE9PSBudWxsKSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0RVNNID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKERhdGUubm93KCkgLSBzdGFydEVTTSA8IG1heFdhaXQgJiYgIXNlcnZlclJlYWR5ICYmICFleGl0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMzAwKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGV4aXRlZCAmJiAhc2VydmVyUmVhZHkgJiYgIXJldHJpZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IG1pc3NpbmdQa2dzID0gZXh0cmFjdE1pc3NpbmdQYWNrYWdlcyhzdGFydHVwT3V0cHV0KTtcbiAgICAgICAgICAgIGlmIChtaXNzaW5nUGtncy5sZW5ndGggPiAwICYmIG1pc3NpbmdQa2dzLmxlbmd0aCA8PSA1KSB7XG4gICAgICAgICAgICAgIHJldHJpZWQgPSB0cnVlO1xuICAgICAgICAgICAgICBsZXQgaW5zdGFsbERpciA9IHByb2plY3REaXI7XG4gICAgICAgICAgICAgIGNvbnN0IHN1YmRpck1hdGNoID0gc3RhcnR1cE91dHB1dC5tYXRjaCgvW1xcL1xcXFxdKGZyb250ZW5kfGNsaWVudHx3ZWJ8YXBwKVtcXC9cXFxcXS9pKTtcbiAgICAgICAgICAgICAgaWYgKHN1YmRpck1hdGNoKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3ViUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBzdWJkaXJNYXRjaFsxXS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oc3ViUGF0aCwgXCJwYWNrYWdlLmpzb25cIikpKSB7XG4gICAgICAgICAgICAgICAgICBpbnN0YWxsRGlyID0gc3ViUGF0aDtcbiAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oc3ViUGF0aCwgXCJub2RlX21vZHVsZXNcIikpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBJbnN0YWxsaW5nIGFsbCBkZXBzIGluICR7c3ViZGlyTWF0Y2hbMV19LyBmaXJzdC4uLmApO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oc3ViUGF0aCwgXCIuZ2l0XCIpKSkgeyB0cnkgeyBmcy5ta2RpclN5bmMocGF0aC5qb2luKHN1YlBhdGgsIFwiLmdpdFwiKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gY2F0Y2gge30gfVxuICAgICAgICAgICAgICAgICAgICAgIGV4ZWNTeW5jKFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzXCIsIHsgY3dkOiBzdWJQYXRoLCB0aW1lb3V0OiAxMjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUsIHdpbmRvd3NIaWRlOiB0cnVlLCBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIEhVU0tZOiBcIjBcIiB9IH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gRGV0ZWN0ZWQgbWlzc2luZyBwYWNrYWdlczogJHttaXNzaW5nUGtncy5qb2luKFwiLCBcIil9IFx1MjAxNCBpbnN0YWxsaW5nIGluICR7aW5zdGFsbERpciA9PT0gcHJvamVjdERpciA/ICdyb290JyA6IHBhdGguYmFzZW5hbWUoaW5zdGFsbERpcil9IGFuZCByZXRyeWluZ2ApO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbGxQa2dMaXN0ID0gbWlzc2luZ1BrZ3Muam9pbihcIiBcIik7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5zdGFsbENtZCA9IHBtID09PSBcIm5wbVwiXG4gICAgICAgICAgICAgICAgICA/IGBucG0gaW5zdGFsbCAtLXNhdmUtZGV2IC0tbGVnYWN5LXBlZXItZGVwcyAke2luc3RhbGxQa2dMaXN0fWBcbiAgICAgICAgICAgICAgICAgIDogcG0gPT09IFwicG5wbVwiID8gYG5weCBwbnBtIGFkZCAtRCAke2luc3RhbGxQa2dMaXN0fWBcbiAgICAgICAgICAgICAgICAgIDogcG0gPT09IFwieWFyblwiID8gYG5weCB5YXJuIGFkZCAtRCAke2luc3RhbGxQa2dMaXN0fWBcbiAgICAgICAgICAgICAgICAgIDogYG5wbSBpbnN0YWxsIC0tc2F2ZS1kZXYgLS1sZWdhY3ktcGVlci1kZXBzICR7aW5zdGFsbFBrZ0xpc3R9YDtcbiAgICAgICAgICAgICAgICBleGVjU3luYyhpbnN0YWxsQ21kLCB7IGN3ZDogaW5zdGFsbERpciwgdGltZW91dDogNjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUsIHdpbmRvd3NIaWRlOiB0cnVlLCBlbnY6IHNhZmVJbnN0YWxsRW52IH0pO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gSW5zdGFsbGVkICR7bWlzc2luZ1BrZ3Muam9pbihcIiwgXCIpfSBcdTIwMTQgcmV0cnlpbmcgc3RhcnR1cGApO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQyID0gc3Bhd24oZGV2Q21kLmNtZCwgZGV2Q21kLmFyZ3MsIHtcbiAgICAgICAgICAgICAgICAgIGN3ZDogZWZmZWN0aXZlUHJvamVjdERpciwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgIGRldGFjaGVkOiAhaXNXaW4sIHdpbmRvd3NIaWRlOiB0cnVlLCBlbnY6IHBvcnRFbnYsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1dpbikgY2hpbGQyLnVucmVmKCk7XG4gICAgICAgICAgICAgICAgc3RhcnR1cE91dHB1dCA9IFwiXCI7XG4gICAgICAgICAgICAgICAgc2VydmVyUmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBleGl0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzdGFydHVwRXJyb3JzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgY2hpbGQyLnN0ZG91dD8ub24oXCJkYXRhXCIsIGNvbGxlY3RPdXRwdXQpO1xuICAgICAgICAgICAgICAgIGNoaWxkMi5zdGRlcnI/Lm9uKFwiZGF0YVwiLCBjb2xsZWN0T3V0cHV0KTtcbiAgICAgICAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLnNldChuYW1lLCB7IHByb2Nlc3M6IGNoaWxkMiwgcG9ydCB9KTtcbiAgICAgICAgICAgICAgICBjaGlsZDIub24oXCJlcnJvclwiLCAoKSA9PiB7IGV4aXRlZCA9IHRydWU7IH0pO1xuICAgICAgICAgICAgICAgIGNoaWxkMi5vbihcImV4aXRcIiwgKGNvZGU6IG51bWJlciB8IG51bGwpID0+IHtcbiAgICAgICAgICAgICAgICAgIGV4aXRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICBpZiAoY29kZSAhPT0gMCAmJiBjb2RlICE9PSBudWxsKSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBzdGFydDIgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgICAgIHdoaWxlIChEYXRlLm5vdygpIC0gc3RhcnQyIDwgbWF4V2FpdCAmJiAhc2VydmVyUmVhZHkgJiYgIWV4aXRlZCkge1xuICAgICAgICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDMwMCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBBdXRvLWluc3RhbGwgcmV0cnkgZmFpbGVkOiAke2UubWVzc2FnZT8uc2xpY2UoMCwgMjAwKX1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIGlmIChleGl0ZWQgJiYgIXNlcnZlclJlYWR5ICYmICFyZXRyaWVkKSB7XG4gICAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgIGNvbnN0IG91dHB1dFN0ciA9IHN0YXJ0dXBPdXRwdXQgKyBcIiBcIiArIHN0YXJ0dXBFcnJvcnMuam9pbihcIiBcIik7XG5cbiAgICAgICAgICAgIGNvbnN0IHNhZmVJbnN0YWxsRW52MjogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgdW5kZWZpbmVkPiA9IHsgLi4ucHJvY2Vzcy5lbnYsIEhVU0tZOiBcIjBcIiwgbnBtX2NvbmZpZ19pZ25vcmVfc2NyaXB0czogXCJcIiwgRElTQUJMRV9PUEVOQ09MTEVDVElWRTogXCJ0cnVlXCIsIEFEQkxPQ0s6IFwiMVwiIH07XG4gICAgICAgICAgICBsZXQgYXV0b0ZpeGVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmICgvRVJSX1JFUVVJUkVfRVNNfENhbm5vdCB1c2UgaW1wb3J0IHN0YXRlbWVudCBvdXRzaWRlIGEgbW9kdWxlfEVTTSBmaWxlIGNhbm5vdCBiZSBsb2FkZWQgYnkuKnJlcXVpcmUvaS50ZXN0KG91dHB1dFN0cikpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGtnSnNvblBhdGggPSBwYXRoLmpvaW4oZWZmZWN0aXZlUHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBrZ0pzb25QYXRoKSkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBwUmF3ID0gZnMucmVhZEZpbGVTeW5jKHBrZ0pzb25QYXRoLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgY29uc3QgcE9iaiA9IEpTT04ucGFyc2UocFJhdyk7XG4gICAgICAgICAgICAgICAgICBpZiAocE9iai50eXBlICE9PSBcIm1vZHVsZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHBPYmoudHlwZSA9IFwibW9kdWxlXCI7XG4gICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGtnSnNvblBhdGgsIEpTT04uc3RyaW5naWZ5KHBPYmosIG51bGwsIDIpLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIltQcmV2aWV3XSBBdXRvLWZpeDogYWRkZWQgXFxcInR5cGVcXFwiOlxcXCJtb2R1bGVcXFwiIHRvIHBhY2thZ2UuanNvbiBhZnRlciBFU00gZXJyb3JcIik7XG4gICAgICAgICAgICAgICAgICAgIGF1dG9GaXhlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHsgZml4ZXM6IGF1dG9GaXhlcyB9ID0gYXdhaXQgYXR0ZW1wdFZpdGVBdXRvRml4U3RhcnR1cChlZmZlY3RpdmVQcm9qZWN0RGlyLCBvdXRwdXRTdHIsIHBtLCBzYWZlSW5zdGFsbEVudjIpO1xuICAgICAgICAgICAgaWYgKGF1dG9GaXhlcy5sZW5ndGggPiAwKSBhdXRvRml4ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICBjb25zdCBmaXhlZEVudiA9IGJ1aWxkVml0ZUF1dG9GaXhFbnYoeyAuLi5wcm9jZXNzLmVudiwgLi4ucG9ydEVudiwgUE9SVDogU3RyaW5nKHBvcnQpIH0sIG91dHB1dFN0cik7XG5cbiAgICAgICAgICAgIGlmIChhdXRvRml4ZWQpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBSZXRyeWluZyAke25hbWV9IGFmdGVyICR7YXV0b0ZpeGVzLmxlbmd0aH0gYXV0by1maXhlczogJHthdXRvRml4ZXMuam9pbihcIiwgXCIpfS4uLmApO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxldCBuZXdQa2c6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgICAgICAgICAgICB0cnkgeyBuZXdQa2cgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oZWZmZWN0aXZlUHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIiksIFwidXRmLThcIikpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3RGV2Q21kID0gZGV0ZWN0RGV2Q29tbWFuZCgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Bhd246IHNwMyB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZDMgPSBzcDMobmV3RGV2Q21kLmNtZCwgbmV3RGV2Q21kLmFyZ3MsIHtcbiAgICAgICAgICAgICAgICAgIGN3ZDogZWZmZWN0aXZlUHJvamVjdERpciwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSwgZGV0YWNoZWQ6ICFpc1dpbiwgd2luZG93c0hpZGU6IHRydWUsIGVudjogZml4ZWRFbnYsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1dpbikgY2hpbGQzLnVucmVmKCk7XG4gICAgICAgICAgICAgICAgbGV0IHN0YXJ0dXBPdXRwdXQzID0gXCJcIjtcbiAgICAgICAgICAgICAgICBsZXQgc2VydmVyUmVhZHkzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgbGV0IGV4aXRlZDMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBjb25zdCBzdGFydHVwRXJyb3JzMzogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xsZWN0T3V0cHV0MyA9IChkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHQgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgICBzdGFydHVwT3V0cHV0MyArPSB0O1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3OiR7bmFtZX1dICR7dC50cmltKCl9YCk7XG4gICAgICAgICAgICAgICAgICBpZiAoL3JlYWR5fFZJVEUuKnJlYWR5fGNvbXBpbGVkfHN0YXJ0ZWQgc2VydmVyfGxpc3RlbmluZ3xMb2NhbDp8U3VjY2Vzc2Z1bGx5IGNvbXBpbGVkL2kudGVzdCh0KSkgc2VydmVyUmVhZHkzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIGlmICgvZXJyb3J8RVJSIXxDYW5ub3QgZmluZHxNT0RVTEVfTk9UX0ZPVU5EfFN5bnRheEVycm9yfEVOT0VOVHxFQUREUklOVVNFL2kudGVzdCh0KSkgc3RhcnR1cEVycm9yczMucHVzaCh0LnRyaW0oKS5zbGljZSgwLCAzMDApKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGNoaWxkMy5zdGRvdXQub24oXCJkYXRhXCIsIGNvbGxlY3RPdXRwdXQzKTtcbiAgICAgICAgICAgICAgICBjaGlsZDMuc3RkZXJyLm9uKFwiZGF0YVwiLCBjb2xsZWN0T3V0cHV0Myk7XG4gICAgICAgICAgICAgICAgcHJldmlld1Byb2Nlc3Nlcy5zZXQobmFtZSwgeyBwcm9jZXNzOiBjaGlsZDMsIHBvcnQgfSk7XG4gICAgICAgICAgICAgICAgY2hpbGQzLm9uKFwiZXJyb3JcIiwgKCkgPT4geyBleGl0ZWQzID0gdHJ1ZTsgfSk7XG4gICAgICAgICAgICAgICAgY2hpbGQzLm9uKFwiZXhpdFwiLCAoY29kZTMpID0+IHtcbiAgICAgICAgICAgICAgICAgIGV4aXRlZDMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgaWYgKGNvZGUzICE9PSAwICYmIGNvZGUzICE9PSBudWxsKSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBpc05leHRQcm9qZWN0ID0gL25leHQvaS50ZXN0KFN0cmluZyhuZXdEZXZDbWQuYXJncz8uWzBdIHx8IFwiXCIpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBpc1RpbWVvdXRFeHRlbmQgPSBhdXRvRml4ZXMuaW5jbHVkZXMoXCJleHRlbmQtdGltZW91dFwiKSB8fCAvdGltZWQ/ID9vdXR8dGltZW91dHxFVElNRURPVVQvaS50ZXN0KG91dHB1dFN0cik7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0cnlXYWl0ID0gaXNOZXh0UHJvamVjdCA/IDQ1MDAwIDogaXNUaW1lb3V0RXh0ZW5kID8gMzAwMDAgOiBtYXhXYWl0O1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0MyA9IERhdGUubm93KCk7XG4gICAgICAgICAgICAgICAgd2hpbGUgKERhdGUubm93KCkgLSBzdGFydDMgPCByZXRyeVdhaXQgJiYgIXNlcnZlclJlYWR5MyAmJiAhZXhpdGVkMykge1xuICAgICAgICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDMwMCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIWV4aXRlZDMgfHwgc2VydmVyUmVhZHkzKSB7XG4gICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgcG9ydCwgc3RhcnRlZDogdHJ1ZSwgcmVhZHk6IHNlcnZlclJlYWR5MyxcbiAgICAgICAgICAgICAgICAgICAgZGV0ZWN0ZWRDb21tYW5kOiBgJHtuZXdEZXZDbWQuY21kfSAke25ld0RldkNtZC5hcmdzLmpvaW4oXCIgXCIpfWAsXG4gICAgICAgICAgICAgICAgICAgIHBhY2thZ2VNYW5hZ2VyOiBwbSwgcmV0cmllZDogdHJ1ZSwgYXV0b0ZpeGVzLFxuICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBlZmZlY3RpdmVQcm9qZWN0RGlyLCBTdHJpbmcocG9ydCkpO1xuICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgcG9ydCwgc3RhcnRlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICBlcnJvcjogYERldiBzZXJ2ZXIgZmFpbGVkIGFmdGVyIGF1dG8tZml4IHJldHJ5ICgke2F1dG9GaXhlcy5qb2luKFwiLCBcIil9KS4gJHtzdGFydHVwRXJyb3JzMy5qb2luKFwiIHwgXCIpLnNsaWNlKDAsIDgwMCl9YCxcbiAgICAgICAgICAgICAgICAgIG91dHB1dDogc3RhcnR1cE91dHB1dDMuc2xpY2UoLTIwMDApLFxuICAgICAgICAgICAgICAgICAgZGV0ZWN0ZWRDb21tYW5kOiBgJHtuZXdEZXZDbWQuY21kfSAke25ld0RldkNtZC5hcmdzLmpvaW4oXCIgXCIpfWAsXG4gICAgICAgICAgICAgICAgICByZXRyaWVkOiB0cnVlLCBhdXRvRml4ZXMsXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfSBjYXRjaCAocmV0cnlFcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJldmlld10gQXV0by1maXggcmV0cnkgc3Bhd24gZmFpbGVkOiAke3JldHJ5RXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDIwMCl9YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZmFpbENsYXNzaWZpZWQgPSBjbGFzc2lmeVZpdGVFcnJvcihvdXRwdXRTdHIpO1xuICAgICAgICAgICAgY29uc3QgYWN0aW9uYWJsZU1zZyA9IGZhaWxDbGFzc2lmaWVkLmNhdGVnb3J5ICE9PSBcInVua25vd25cIlxuICAgICAgICAgICAgICA/IGBEZXYgc2VydmVyIGZhaWxlZDogJHtmYWlsQ2xhc3NpZmllZC5jYXRlZ29yeX0gKCR7ZmFpbENsYXNzaWZpZWQuc3RyYXRlZ3l9KS4gJHtmYWlsQ2xhc3NpZmllZC5kZXRhaWwgfHwgXCJcIn0gJHtzdGFydHVwRXJyb3JzLmpvaW4oXCIgfCBcIikuc2xpY2UoMCwgNjAwKX1gXG4gICAgICAgICAgICAgIDogYERldiBzZXJ2ZXIgcHJvY2VzcyBleGl0ZWQgaW1tZWRpYXRlbHkuIENoZWNrIHRlcm1pbmFsIG91dHB1dCBmb3IgZXJyb3JzLiAke3N0YXJ0dXBFcnJvcnMuam9pbihcIiB8IFwiKS5zbGljZSgwLCA4MDApfWA7XG4gICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBlZmZlY3RpdmVQcm9qZWN0RGlyLCBTdHJpbmcocG9ydCkpO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgIHBvcnQsXG4gICAgICAgICAgICAgIHN0YXJ0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICBlcnJvcjogYWN0aW9uYWJsZU1zZyxcbiAgICAgICAgICAgICAgb3V0cHV0OiBzdGFydHVwT3V0cHV0LnNsaWNlKC0yMDAwKSxcbiAgICAgICAgICAgICAgZGV0ZWN0ZWRDb21tYW5kOiBgJHtkZXZDbWQuY21kfSAke2RldkNtZC5hcmdzLmpvaW4oXCIgXCIpfWAsXG4gICAgICAgICAgICAgIGNsYXNzaWZpZWQ6IGZhaWxDbGFzc2lmaWVkLFxuICAgICAgICAgICAgICByZXRyaWVkLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZXhpdGVkICYmICFzZXJ2ZXJSZWFkeSkge1xuICAgICAgICAgICAgcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUobmFtZSk7XG4gICAgICAgICAgICBjb25zdCBmYWlsQ2xhc3NpZmllZDIgPSBjbGFzc2lmeVZpdGVFcnJvcihzdGFydHVwT3V0cHV0ICsgXCIgXCIgKyBzdGFydHVwRXJyb3JzLmpvaW4oXCIgXCIpKTtcbiAgICAgICAgICAgIGNvbnN0IGFjdGlvbmFibGVNc2cyID0gZmFpbENsYXNzaWZpZWQyLmNhdGVnb3J5ICE9PSBcInVua25vd25cIlxuICAgICAgICAgICAgICA/IGBEZXYgc2VydmVyIGZhaWxlZCBhZnRlciByZXRyeTogJHtmYWlsQ2xhc3NpZmllZDIuY2F0ZWdvcnl9ICgke2ZhaWxDbGFzc2lmaWVkMi5zdHJhdGVneX0pLiAke2ZhaWxDbGFzc2lmaWVkMi5kZXRhaWwgfHwgXCJcIn0gJHtzdGFydHVwRXJyb3JzLmpvaW4oXCIgfCBcIikuc2xpY2UoMCwgNjAwKX1gXG4gICAgICAgICAgICAgIDogYERldiBzZXJ2ZXIgcHJvY2VzcyBleGl0ZWQgYWZ0ZXIgcmV0cnkuIENoZWNrIHRlcm1pbmFsIG91dHB1dCBmb3IgZXJyb3JzLiAke3N0YXJ0dXBFcnJvcnMuam9pbihcIiB8IFwiKS5zbGljZSgwLCA4MDApfWA7XG4gICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBlZmZlY3RpdmVQcm9qZWN0RGlyLCBTdHJpbmcocG9ydCkpO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgIHBvcnQsXG4gICAgICAgICAgICAgIHN0YXJ0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICBlcnJvcjogYWN0aW9uYWJsZU1zZzIsXG4gICAgICAgICAgICAgIG91dHB1dDogc3RhcnR1cE91dHB1dC5zbGljZSgtMjAwMCksXG4gICAgICAgICAgICAgIGRldGVjdGVkQ29tbWFuZDogYCR7ZGV2Q21kLmNtZH0gJHtkZXZDbWQuYXJncy5qb2luKFwiIFwiKX1gLFxuICAgICAgICAgICAgICBjbGFzc2lmaWVkOiBmYWlsQ2xhc3NpZmllZDIsXG4gICAgICAgICAgICAgIHJldHJpZWQsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBwb3J0LFxuICAgICAgICAgICAgICBzdGFydGVkOiB0cnVlLFxuICAgICAgICAgICAgICByZWFkeTogc2VydmVyUmVhZHksXG4gICAgICAgICAgICAgIGRldGVjdGVkQ29tbWFuZDogYCR7ZGV2Q21kLmNtZH0gJHtkZXZDbWQuYXJncy5qb2luKFwiIFwiKX1gLFxuICAgICAgICAgICAgICBwYWNrYWdlTWFuYWdlcjogcG0sXG4gICAgICAgICAgICAgIHJldHJpZWQsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvcmVzdGFydC1wcmV2aWV3XCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBpZiAoIW5hbWUgfHwgL1tcXC9cXFxcXXxcXC5cXC4vLnRlc3QobmFtZSkpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJJbnZhbGlkIHByb2plY3QgbmFtZVwiIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KG5hbWUpO1xuICAgICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHJlc3RhcnRlZDogZmFsc2UsIHJlYXNvbjogXCJObyBhY3RpdmUgcHJldmlld1wiIH0pKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBvbGRQb3J0ID0gZW50cnkucG9ydDtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIikge1xuICAgICAgICAgICAgICBjb25zdCB7IGV4ZWNTeW5jIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgICAgICB0cnkgeyBleGVjU3luYyhgdGFza2tpbGwgL3BpZCAke2VudHJ5LnByb2Nlc3MucGlkfSAvVCAvRmAsIHsgc3RkaW86IFwicGlwZVwiLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdHJ5IHsgcHJvY2Vzcy5raWxsKC1lbnRyeS5wcm9jZXNzLnBpZCwgXCJTSUdLSUxMXCIpOyB9IGNhdGNoIHsgdHJ5IHsgZW50cnkucHJvY2Vzcy5raWxsKFwiU0lHS0lMTFwiKTsgfSBjYXRjaCB7fSB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgIHByZXZpZXdQcm9jZXNzZXMuZGVsZXRlKG5hbWUpO1xuXG4gICAgICAgICAgY29uc3Qgd2FpdEZvclBvcnRGcmVlID0gYXN5bmMgKHBvcnQ6IG51bWJlciwgbWF4V2FpdDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBuZXQgPSBhd2FpdCBpbXBvcnQoXCJuZXRcIik7XG4gICAgICAgICAgICBjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG4gICAgICAgICAgICB3aGlsZSAoRGF0ZS5ub3coKSAtIHN0YXJ0IDwgbWF4V2FpdCkge1xuICAgICAgICAgICAgICBjb25zdCBpblVzZSA9IGF3YWl0IG5ldyBQcm9taXNlPGJvb2xlYW4+KHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHMgPSBuZXQuY3JlYXRlU2VydmVyKCk7XG4gICAgICAgICAgICAgICAgcy5vbmNlKFwiZXJyb3JcIiwgKCkgPT4gcmVzb2x2ZSh0cnVlKSk7XG4gICAgICAgICAgICAgICAgcy5vbmNlKFwibGlzdGVuaW5nXCIsICgpID0+IHsgcy5jbG9zZSgpOyByZXNvbHZlKGZhbHNlKTsgfSk7XG4gICAgICAgICAgICAgICAgcy5saXN0ZW4ocG9ydCwgXCIwLjAuMC4wXCIpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgaWYgKCFpblVzZSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAyMDApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIGNvbnN0IHBvcnRGcmVlID0gYXdhaXQgd2FpdEZvclBvcnRGcmVlKG9sZFBvcnQsIDMwMDApO1xuICAgICAgICAgIGlmICghcG9ydEZyZWUpIHtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHJlc3RhcnRlZDogZmFsc2UsIHJlYXNvbjogXCJQb3J0IHN0aWxsIGluIHVzZSBhZnRlciAzc1wiIH0pKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiLCBuYW1lKTtcbiAgICAgICAgICBjb25zdCB7IHNwYXduIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuXG4gICAgICAgICAgbGV0IHBrZzogYW55ID0ge307XG4gICAgICAgICAgbGV0IHJlc3RhcnREaXIgPSBwcm9qZWN0RGlyO1xuICAgICAgICAgIGNvbnN0IHBrZ1BhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGtnUGF0aCkpIHtcbiAgICAgICAgICAgIHRyeSB7IHBrZyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBrZ1BhdGgsIFwidXRmLThcIikpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAoY29uc3Qgc3ViIG9mIFtcImZyb250ZW5kXCIsIFwiY2xpZW50XCIsIFwid2ViXCIsIFwiYXBwXCJdKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHN1YlBrZyA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBzdWIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhzdWJQa2cpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHsgcGtnID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc3ViUGtnLCBcInV0Zi04XCIpKTsgcmVzdGFydERpciA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBzdWIpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qgc2NyaXB0cyA9IHBrZy5zY3JpcHRzIHx8IHt9O1xuICAgICAgICAgIGNvbnN0IGRlcHMgPSB7IC4uLihwa2cuZGVwZW5kZW5jaWVzIHx8IHt9KSwgLi4uKHBrZy5kZXZEZXBlbmRlbmNpZXMgfHwge30pIH07XG5cbiAgICAgICAgICBjb25zdCBkZXRlY3RQTVJlc3RhcnQgPSAoKTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZGlyIG9mIFtyZXN0YXJ0RGlyLCBwcm9qZWN0RGlyXSkge1xuICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZGlyLCBcImJ1bi5sb2NrYlwiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZGlyLCBcImJ1bi5sb2NrXCIpKSkgcmV0dXJuIFwiYnVuXCI7XG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihkaXIsIFwicG5wbS1sb2NrLnlhbWxcIikpKSByZXR1cm4gXCJwbnBtXCI7XG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihkaXIsIFwieWFybi5sb2NrXCIpKSkgcmV0dXJuIFwieWFyblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIFwibnBtXCI7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb25zdCBwbVIgPSBkZXRlY3RQTVJlc3RhcnQoKTtcblxuICAgICAgICAgIGNvbnN0IHJlc3RhcnREZXRlY3QgPSAoKTogeyBjbWQ6IHN0cmluZzsgYXJnczogc3RyaW5nW10gfSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwb3J0U3RyID0gU3RyaW5nKG9sZFBvcnQpO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2hTY3JpcHQgPSAoc2NyaXB0Qm9keTogc3RyaW5nKTogeyBjbWQ6IHN0cmluZzsgYXJnczogc3RyaW5nW10gfSB8IG51bGwgPT4ge1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcIm5leHRcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wibmV4dFwiLCBcImRldlwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInJlYWN0LXNjcmlwdHNcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicmVhY3Qtc2NyaXB0c1wiLCBcInN0YXJ0XCJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwibnV4dFwiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJudXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwiYXN0cm9cIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wiYXN0cm9cIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJ3ZWJwYWNrXCIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgd3BBcmdzID0gW1wid2VicGFja1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXTtcbiAgICAgICAgICAgICAgICBjb25zdCBjZmdNID0gc2NyaXB0Qm9keS5tYXRjaCgvKD86LS1jb25maWdbPVxcc118LWNcXHMpKFxcUyspLyk7XG4gICAgICAgICAgICAgICAgaWYgKGNmZ00pIHdwQXJncy5zcGxpY2UoMiwgMCwgXCItLWNvbmZpZ1wiLCBjZmdNWzFdKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IHdwQXJncyB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwicnNwYWNrXCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInJzcGFja1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInN2ZWx0ZVwiKSB8fCBzY3JpcHRCb2R5LmluY2x1ZGVzKFwic3ZlbHRla2l0XCIpKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJ2dWUtY2xpLXNlcnZpY2VcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1widnVlLWNsaS1zZXJ2aWNlXCIsIFwic2VydmVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGlmIChzY3JpcHRCb2R5LmluY2x1ZGVzKFwicGFyY2VsXCIpKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInBhcmNlbFwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgaWYgKHNjcmlwdEJvZHkuaW5jbHVkZXMoXCJlbWJlclwiKSkgcmV0dXJuIHsgY21kOiBcIm5weFwiLCBhcmdzOiBbXCJlbWJlclwiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgICBpZiAoc2NyaXB0Qm9keS5pbmNsdWRlcyhcInZpdGVcIikpIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1widml0ZVwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29uc3QgaXNTdmVsdGVLaXQgPSBkZXBzW1wiQHN2ZWx0ZWpzL2tpdFwiXSB8fCBkZXBzW1wic3ZlbHRla2l0XCJdO1xuICAgICAgICAgICAgY29uc3QgaXNQbnBtTW9ubyA9IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwicG5wbS13b3Jrc3BhY2UueWFtbFwiKSk7XG4gICAgICAgICAgICBpZiAoaXNQbnBtTW9ubykge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhzY3JpcHRzKSkge1xuICAgICAgICAgICAgICAgIGlmIChzY3JpcHRzW2tleV0uaW5jbHVkZXMoXCItLWZpbHRlclwiKSAmJiAoa2V5LmluY2x1ZGVzKFwiZGV2XCIpIHx8IGtleSA9PT0gXCJscDpkZXZcIikpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB7IGNtZDogXCJwbnBtXCIsIGFyZ3M6IFtcInJ1blwiLCBrZXldIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2NyaXB0cy5kZXYpIHtcbiAgICAgICAgICAgICAgaWYgKGlzU3ZlbHRlS2l0KSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCJkZXZcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICAgIGNvbnN0IG0gPSBtYXRjaFNjcmlwdChzY3JpcHRzLmRldik7IGlmIChtKSByZXR1cm4gbTtcbiAgICAgICAgICAgICAgcmV0dXJuIHsgY21kOiBwbVIgPT09IFwibnBtXCIgPyBcIm5wbVwiIDogYG5weCAke3BtUn1gLCBhcmdzOiBwbVIgPT09IFwibnBtXCIgPyBbXCJydW5cIiwgXCJkZXZcIl0gOiBbXCJydW5cIiwgXCJkZXZcIl0gfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzY3JpcHRzLnN0YXJ0KSB7IGNvbnN0IG0gPSBtYXRjaFNjcmlwdChzY3JpcHRzLnN0YXJ0KTsgaWYgKG0pIHJldHVybiBtOyByZXR1cm4geyBjbWQ6IHBtUiA9PT0gXCJucG1cIiA/IFwibnBtXCIgOiBgbnB4ICR7cG1SfWAsIGFyZ3M6IHBtUiA9PT0gXCJucG1cIiA/IFtcInJ1blwiLCBcInN0YXJ0XCJdIDogW1wicnVuXCIsIFwic3RhcnRcIl0gfTsgfVxuICAgICAgICAgICAgaWYgKHNjcmlwdHMuc2VydmUgfHwgc2NyaXB0c1tcInNlcnZlOnJzcGFja1wiXSkgeyBjb25zdCBzID0gc2NyaXB0cy5zZXJ2ZSB8fCBzY3JpcHRzW1wic2VydmU6cnNwYWNrXCJdOyBjb25zdCBtID0gbWF0Y2hTY3JpcHQocyk7IGlmIChtKSByZXR1cm4gbTsgY29uc3QgayA9IHNjcmlwdHMuc2VydmUgPyBcInNlcnZlXCIgOiBcInNlcnZlOnJzcGFja1wiOyByZXR1cm4geyBjbWQ6IHBtUiA9PT0gXCJucG1cIiA/IFwibnBtXCIgOiBgbnB4ICR7cG1SfWAsIGFyZ3M6IHBtUiA9PT0gXCJucG1cIiA/IFtcInJ1blwiLCBrXSA6IFtcInJ1blwiLCBrXSB9OyB9XG4gICAgICAgICAgICBpZiAoZGVwc1tcIm5leHRcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wibmV4dFwiLCBcImRldlwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJyZWFjdC1zY3JpcHRzXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInJlYWN0LXNjcmlwdHNcIiwgXCJzdGFydFwiXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJudXh0XCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcIm51eHRcIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wiYXN0cm9cIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wiYXN0cm9cIiwgXCJkZXZcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wiQGFuZ3VsYXIvY2xpXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcIm5nXCIsIFwic2VydmVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHIsIFwiLS1kaXNhYmxlLWhvc3QtY2hlY2tcIl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wiQHJlbWl4LXJ1bi9kZXZcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicmVtaXhcIiwgXCJ2aXRlOmRldlwiLCBcIi0taG9zdFwiLCBcIjAuMC4wLjBcIiwgXCItLXBvcnRcIiwgcG9ydFN0cl0gfTtcbiAgICAgICAgICAgIGlmIChkZXBzW1wiZ2F0c2J5XCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcImdhdHNieVwiLCBcImRldmVsb3BcIiwgXCItSFwiLCBcIjAuMC4wLjBcIiwgXCItcFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJ3ZWJwYWNrLWRldi1zZXJ2ZXJcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wid2VicGFja1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJAcnNwYWNrL2NsaVwiXSB8fCBkZXBzW1wiQHJzcGFjay9jb3JlXCJdKSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInJzcGFja1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGRlcHNbXCJwYXJjZWxcIl0pIHJldHVybiB7IGNtZDogXCJucHhcIiwgYXJnczogW1wicGFyY2VsXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBwb3J0U3RyXSB9O1xuICAgICAgICAgICAgaWYgKGlzU3ZlbHRlS2l0KSByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCJkZXZcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgICByZXR1cm4geyBjbWQ6IFwibnB4XCIsIGFyZ3M6IFtcInZpdGVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIHBvcnRTdHJdIH07XG4gICAgICAgICAgfTtcbiAgICAgICAgICBsZXQgcmVzdGFydENtZCA9IHJlc3RhcnREZXRlY3QoKTtcblxuICAgICAgICAgIGNvbnN0IGlzV2luUiA9IHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIjtcbiAgICAgICAgICBpZiAocmVzdGFydENtZC5jbWQgPT09IFwibnB4XCIgJiYgcmVzdGFydENtZC5hcmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHJCaW5OYW1lID0gcmVzdGFydENtZC5hcmdzWzBdO1xuICAgICAgICAgICAgY29uc3QgckxvY2FsQmluID0gcGF0aC5qb2luKHJlc3RhcnREaXIsIFwibm9kZV9tb2R1bGVzXCIsIFwiLmJpblwiLCBpc1dpblIgPyBgJHtyQmluTmFtZX0uY21kYCA6IHJCaW5OYW1lKTtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHJMb2NhbEJpbikpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBVc2luZyBsb2NhbCBiaW5hcnkgZm9yICR7bmFtZX0gcmVzdGFydDogJHtyTG9jYWxCaW59YCk7XG4gICAgICAgICAgICAgIHJlc3RhcnRDbWQgPSB7IGNtZDogckxvY2FsQmluLCBhcmdzOiByZXN0YXJ0Q21kLmFyZ3Muc2xpY2UoMSkgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc29sZS5sb2coYFtQcmV2aWV3XSBSZXN0YXJ0aW5nICR7bmFtZX0gd2l0aDogJHtyZXN0YXJ0Q21kLmNtZH0gJHtyZXN0YXJ0Q21kLmFyZ3Muam9pbihcIiBcIil9YCk7XG5cbiAgICAgICAgICBjb25zdCByUGF0aFNlcCA9IGlzV2luUiA/IFwiO1wiIDogXCI6XCI7XG4gICAgICAgICAgY29uc3QgckJpbkRpcnM6IHN0cmluZ1tdID0gW3BhdGguam9pbihyZXN0YXJ0RGlyLCBcIm5vZGVfbW9kdWxlc1wiLCBcIi5iaW5cIildO1xuICAgICAgICAgIGlmIChyZXN0YXJ0RGlyICE9PSBwcm9qZWN0RGlyKSByQmluRGlycy5wdXNoKHBhdGguam9pbihwcm9qZWN0RGlyLCBcIm5vZGVfbW9kdWxlc1wiLCBcIi5iaW5cIikpO1xuICAgICAgICAgIGNvbnN0IHJJc29sYXRlZFBhdGggPSByQmluRGlycy5qb2luKHJQYXRoU2VwKSArIHJQYXRoU2VwICsgKHByb2Nlc3MuZW52LlBBVEggfHwgcHJvY2Vzcy5lbnYuUGF0aCB8fCBcIlwiKTtcbiAgICAgICAgICBjb25zdCByTm9kZVBhdGhzOiBzdHJpbmdbXSA9IFtwYXRoLmpvaW4ocmVzdGFydERpciwgXCJub2RlX21vZHVsZXNcIildO1xuICAgICAgICAgIGlmIChyZXN0YXJ0RGlyICE9PSBwcm9qZWN0RGlyKSByTm9kZVBhdGhzLnB1c2gocGF0aC5qb2luKHByb2plY3REaXIsIFwibm9kZV9tb2R1bGVzXCIpKTtcblxuICAgICAgICAgIGNvbnN0IGNoaWxkID0gc3Bhd24ocmVzdGFydENtZC5jbWQsIHJlc3RhcnRDbWQuYXJncywge1xuICAgICAgICAgICAgY3dkOiByZXN0YXJ0RGlyLFxuICAgICAgICAgICAgc3RkaW86IFwicGlwZVwiLFxuICAgICAgICAgICAgc2hlbGw6IHRydWUsXG4gICAgICAgICAgICBkZXRhY2hlZDogIWlzV2luUixcbiAgICAgICAgICAgIHdpbmRvd3NIaWRlOiB0cnVlLFxuICAgICAgICAgICAgZW52OiB7XG4gICAgICAgICAgICAgIC4uLnByb2Nlc3MuZW52LFxuICAgICAgICAgICAgICBCUk9XU0VSOiBcIm5vbmVcIixcbiAgICAgICAgICAgICAgUE9SVDogU3RyaW5nKG9sZFBvcnQpLFxuICAgICAgICAgICAgICBIT1NUOiBcIjAuMC4wLjBcIixcbiAgICAgICAgICAgICAgSE9TVE5BTUU6IFwiMC4wLjAuMFwiLFxuICAgICAgICAgICAgICBQQVRIOiBySXNvbGF0ZWRQYXRoLFxuICAgICAgICAgICAgICBOT0RFX1BBVEg6IHJOb2RlUGF0aHMuam9pbihyUGF0aFNlcCksXG4gICAgICAgICAgICAgIENIT0tJREFSX1VTRVBPTExJTkc6IFwidHJ1ZVwiLFxuICAgICAgICAgICAgICAuLi4ocmVzdGFydENtZC5hcmdzLnNvbWUoKGE6IHN0cmluZykgPT4gW1wid2VicGFja1wiLCBcIndlYnBhY2stZGV2LXNlcnZlclwiLCBcInZ1ZS1jbGktc2VydmljZVwiLCBcInJlYWN0LXNjcmlwdHNcIl0uaW5jbHVkZXMoYSkpID8geyBOT0RFX09QVElPTlM6IChwcm9jZXNzLmVudi5OT0RFX09QVElPTlMgfHwgXCJcIikgKyBcIiAtLW9wZW5zc2wtbGVnYWN5LXByb3ZpZGVyXCIgfSA6IHt9KSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKCFpc1dpblIpIGNoaWxkLnVucmVmKCk7XG5cbiAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLnNldChuYW1lLCB7IHByb2Nlc3M6IGNoaWxkLCBwb3J0OiBvbGRQb3J0IH0pO1xuXG4gICAgICAgICAgY2hpbGQuc3Rkb3V0Py5vbihcImRhdGFcIiwgKGQ6IEJ1ZmZlcikgPT4gY29uc29sZS5sb2coYFtQcmV2aWV3OiR7bmFtZX1dICR7ZC50b1N0cmluZygpLnRyaW0oKX1gKSk7XG4gICAgICAgICAgY2hpbGQuc3RkZXJyPy5vbihcImRhdGFcIiwgKGQ6IEJ1ZmZlcikgPT4gY29uc29sZS5sb2coYFtQcmV2aWV3OiR7bmFtZX1dICR7ZC50b1N0cmluZygpLnRyaW0oKX1gKSk7XG5cbiAgICAgICAgICBjaGlsZC5vbihcImVycm9yXCIsIChlcnI6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW1ByZXZpZXddIFByb2Nlc3MgZXJyb3IgZm9yICR7bmFtZX06YCwgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNoaWxkLm9uKFwiZXhpdFwiLCAoY29kZTogbnVtYmVyIHwgbnVsbCkgPT4ge1xuICAgICAgICAgICAgaWYgKGNvZGUgIT09IG51bGwgJiYgY29kZSAhPT0gMCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUHJldmlld10gUHJvY2VzcyBmb3IgJHtuYW1lfSBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByZXZpZXdQcm9jZXNzZXMuZGVsZXRlKG5hbWUpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHJlc3RhcnRlZDogdHJ1ZSwgcG9ydDogb2xkUG9ydCB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBcdTI1MDBcdTI1MDAgQVVUTy1FUlJPUi1SRUNPVkVSWSBFTkRQT0lOVFMgXHUyNTAwXHUyNTAwXG4gICAgICBjb25zdCB2aXRlRXJyb3JIaXN0b3J5OiB7IGlkOiBzdHJpbmc7IHRpbWVzdGFtcDogbnVtYmVyOyBzb3VyY2U6IHN0cmluZzsgbWVzc2FnZTogc3RyaW5nOyBzdGFjaz86IHN0cmluZzsgcHJvamVjdE5hbWU/OiBzdHJpbmc7IGNsYXNzaWZpZWQ6IFJldHVyblR5cGU8dHlwZW9mIGNsYXNzaWZ5Vml0ZUVycm9yPjsgcmVjb3Zlcnk6IHsgYXR0ZW1wdGVkOiBib29sZWFuOyBzdWNjZXNzOiBib29sZWFuOyBkZXRhaWw6IHN0cmluZyB9IHwgbnVsbCB9W10gPSBbXTtcbiAgICAgIGNvbnN0IHZpdGVSYXRlTGltaXRNYXAgPSBuZXcgTWFwPHN0cmluZywgeyBjb3VudDogbnVtYmVyOyBmaXJzdDogbnVtYmVyIH0+KCk7XG4gICAgICBjb25zdCB2aXRlQXV0b1Jlc3RhcnRBdHRlbXB0cyA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgICBjb25zdCBWSVRFX0FVVE9fUkVTVEFSVF9NQVggPSAzO1xuICAgICAgY29uc3QgVklURV9BVVRPX1JFU1RBUlRfQkFDS09GRiA9IFsyMDAwLCA1MDAwLCAxNTAwMF07XG5cbiAgICAgIGZ1bmN0aW9uIHNjaGVkdWxlVml0ZUF1dG9SZXN0YXJ0KG5hbWU6IHN0cmluZywgcHJvamVjdERpcjogc3RyaW5nLCBwb3J0U3RyOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgYXR0ZW1wdHMgPSB2aXRlQXV0b1Jlc3RhcnRBdHRlbXB0cy5nZXQobmFtZSkgfHwgMDtcbiAgICAgICAgaWYgKGF0dGVtcHRzID49IFZJVEVfQVVUT19SRVNUQVJUX01BWCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gUHJldmlldyAke25hbWV9IGhhcyBjcmFzaGVkICR7YXR0ZW1wdHN9IHRpbWVzIFx1MjAxNCBub3QgcmVzdGFydGluZyAobWF4ICR7VklURV9BVVRPX1JFU1RBUlRfTUFYfSlgKTtcbiAgICAgICAgICB2aXRlQXV0b1Jlc3RhcnRBdHRlbXB0cy5kZWxldGUobmFtZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRlbGF5ID0gVklURV9BVVRPX1JFU1RBUlRfQkFDS09GRlthdHRlbXB0c10gfHwgMTUwMDA7XG4gICAgICAgIHZpdGVBdXRvUmVzdGFydEF0dGVtcHRzLnNldChuYW1lLCBhdHRlbXB0cyArIDEpO1xuICAgICAgICBjb25zb2xlLmxvZyhgW0F1dG9GaXhdIFdpbGwgYXV0by1yZXN0YXJ0ICR7bmFtZX0gaW4gJHtkZWxheSAvIDEwMDB9cyAoYXR0ZW1wdCAke2F0dGVtcHRzICsgMX0vJHtWSVRFX0FVVE9fUkVTVEFSVF9NQVh9KWApO1xuXG4gICAgICAgIHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGlmIChwcmV2aWV3UHJvY2Vzc2VzLmhhcyhuYW1lKSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtBdXRvRml4XSBQcmV2aWV3ICR7bmFtZX0gYWxyZWFkeSBydW5uaW5nIFx1MjAxNCBza2lwcGluZyBhdXRvLXJlc3RhcnRgKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgZnMyID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgaWYgKCFmczIuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtBdXRvRml4XSBQcm9qZWN0IGRpciBub3QgZm91bmQgXHUyMDE0IHNraXBwaW5nIGF1dG8tcmVzdGFydCBmb3IgJHtuYW1lfWApO1xuICAgICAgICAgICAgdml0ZUF1dG9SZXN0YXJ0QXR0ZW1wdHMuZGVsZXRlKG5hbWUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0F1dG9GaXhdIEF1dG8tcmVzdGFydGluZyBwcmV2aWV3ICR7bmFtZX0uLi5gKTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBzcGF3bjogc3AyIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgICAgY29uc3QgcG9ydCA9IHBhcnNlSW50KHBvcnRTdHIpIHx8IHByb2plY3RQb3J0KG5hbWUpO1xuXG4gICAgICAgICAgICBsZXQgcGtnOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgICAgICAgICBjb25zdCBwa2dQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgICAgdHJ5IHsgaWYgKGZzMi5leGlzdHNTeW5jKHBrZ1BhdGgpKSBwa2cgPSBKU09OLnBhcnNlKGZzMi5yZWFkRmlsZVN5bmMocGtnUGF0aCwgXCJ1dGYtOFwiKSk7IH0gY2F0Y2gge31cblxuICAgICAgICAgICAgY29uc3Qgc2NyaXB0cyA9IHBrZy5zY3JpcHRzIHx8IHt9O1xuICAgICAgICAgICAgY29uc3QgZGVwcyA9IHsgLi4uKHBrZy5kZXBlbmRlbmNpZXMgfHwge30pLCAuLi4ocGtnLmRldkRlcGVuZGVuY2llcyB8fCB7fSkgfTtcbiAgICAgICAgICAgIGxldCBjbWQgPSBcIm5weFwiO1xuICAgICAgICAgICAgbGV0IGFyZ3MgPSBbXCJ2aXRlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBTdHJpbmcocG9ydCldO1xuXG4gICAgICAgICAgICBjb25zdCBkZXZTY3JpcHQgPSBzY3JpcHRzLmRldiB8fCBzY3JpcHRzLnN0YXJ0IHx8IHNjcmlwdHMuc2VydmUgfHwgXCJcIjtcbiAgICAgICAgICAgIGlmIChkZXZTY3JpcHQuaW5jbHVkZXMoXCJuZXh0XCIpKSB7IGFyZ3MgPSBbXCJuZXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIFN0cmluZyhwb3J0KSwgXCItLWhvc3RuYW1lXCIsIFwiMC4wLjAuMFwiXTsgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGV2U2NyaXB0LmluY2x1ZGVzKFwicmVhY3Qtc2NyaXB0c1wiKSkgeyBhcmdzID0gW1wicmVhY3Qtc2NyaXB0c1wiLCBcInN0YXJ0XCJdOyB9XG4gICAgICAgICAgICBlbHNlIGlmIChkZXZTY3JpcHQuaW5jbHVkZXMoXCJudXh0XCIpKSB7IGFyZ3MgPSBbXCJudXh0XCIsIFwiZGV2XCIsIFwiLS1wb3J0XCIsIFN0cmluZyhwb3J0KV07IH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRldlNjcmlwdC5pbmNsdWRlcyhcImFzdHJvXCIpKSB7IGFyZ3MgPSBbXCJhc3Ryb1wiLCBcImRldlwiLCBcIi0tcG9ydFwiLCBTdHJpbmcocG9ydCksIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiXTsgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGV2U2NyaXB0LmluY2x1ZGVzKFwid2VicGFja1wiKSkgeyBhcmdzID0gW1wid2VicGFja1wiLCBcInNlcnZlXCIsIFwiLS1ob3N0XCIsIFwiMC4wLjAuMFwiLCBcIi0tcG9ydFwiLCBTdHJpbmcocG9ydCldOyB9XG4gICAgICAgICAgICBlbHNlIGlmIChkZXZTY3JpcHQuaW5jbHVkZXMoXCJuZyBcIikgfHwgZGV2U2NyaXB0LmluY2x1ZGVzKFwibmcgc2VydmVcIikpIHsgYXJncyA9IFtcIm5nXCIsIFwic2VydmVcIiwgXCItLWhvc3RcIiwgXCIwLjAuMC4wXCIsIFwiLS1wb3J0XCIsIFN0cmluZyhwb3J0KV07IH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRldlNjcmlwdC5pbmNsdWRlcyhcImdhdHNieVwiKSkgeyBhcmdzID0gW1wiZ2F0c2J5XCIsIFwiZGV2ZWxvcFwiLCBcIi1IXCIsIFwiMC4wLjAuMFwiLCBcIi1wXCIsIFN0cmluZyhwb3J0KV07IH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRlcHMubmV4dCkgeyBhcmdzID0gW1wibmV4dFwiLCBcImRldlwiLCBcIi0tcG9ydFwiLCBTdHJpbmcocG9ydCksIFwiLS1ob3N0bmFtZVwiLCBcIjAuMC4wLjBcIl07IH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRlcHNbXCJyZWFjdC1zY3JpcHRzXCJdKSB7IGFyZ3MgPSBbXCJyZWFjdC1zY3JpcHRzXCIsIFwic3RhcnRcIl07IH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRlcHMubnV4dCkgeyBhcmdzID0gW1wibnV4dFwiLCBcImRldlwiLCBcIi0tcG9ydFwiLCBTdHJpbmcocG9ydCldOyB9XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gUmVzdGFydCBjb21tYW5kOiAke2NtZH0gJHthcmdzLmpvaW4oXCIgXCIpfWApO1xuICAgICAgICAgICAgY29uc3QgaXNXaW4gPSBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCI7XG4gICAgICAgICAgICBjb25zdCBjaGlsZDIgPSBzcDIoY21kLCBhcmdzLCB7XG4gICAgICAgICAgICAgIGN3ZDogcHJvamVjdERpcixcbiAgICAgICAgICAgICAgZW52OiB7IC4uLnByb2Nlc3MuZW52LCBQT1JUOiBTdHJpbmcocG9ydCksIFZJVEVfUE9SVDogU3RyaW5nKHBvcnQpLCBCUk9XU0VSOiBcIm5vbmVcIiB9LFxuICAgICAgICAgICAgICBzdGRpbzogW1wicGlwZVwiLCBcInBpcGVcIiwgXCJwaXBlXCJdLFxuICAgICAgICAgICAgICBzaGVsbDogdHJ1ZSwgZGV0YWNoZWQ6ICFpc1dpbiwgd2luZG93c0hpZGU6IHRydWUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmICghaXNXaW4pIGNoaWxkMi51bnJlZigpO1xuICAgICAgICAgICAgY2hpbGQyLnN0ZG91dD8ub24oXCJkYXRhXCIsIChkOiBCdWZmZXIpID0+IGNvbnNvbGUubG9nKGBbUHJldmlldzoke25hbWV9XSAke2QudG9TdHJpbmcoKS50cmltKCl9YCkpO1xuICAgICAgICAgICAgY2hpbGQyLnN0ZGVycj8ub24oXCJkYXRhXCIsIChkOiBCdWZmZXIpID0+IGNvbnNvbGUubG9nKGBbUHJldmlldzoke25hbWV9XSAke2QudG9TdHJpbmcoKS50cmltKCl9YCkpO1xuICAgICAgICAgICAgcHJldmlld1Byb2Nlc3Nlcy5zZXQobmFtZSwgeyBwcm9jZXNzOiBjaGlsZDIsIHBvcnQgfSk7XG4gICAgICAgICAgICBjaGlsZDIub24oXCJleGl0XCIsIChjb2RlMjogbnVtYmVyIHwgbnVsbCkgPT4ge1xuICAgICAgICAgICAgICBpZiAoY29kZTIgIT09IDAgJiYgY29kZTIgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChuYW1lLCBwcm9qZWN0RGlyLCBwb3J0U3RyKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0F1dG9GaXhdIFByZXZpZXcgJHtuYW1lfSBhdXRvLXJlc3RhcnRlZCBvbiBwb3J0ICR7cG9ydH1gKTtcbiAgICAgICAgICB9IGNhdGNoIChlOiB1bmtub3duKSB7XG4gICAgICAgICAgICBjb25zdCBlbSA9IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gQXV0by1yZXN0YXJ0IGZhaWxlZCBmb3IgJHtuYW1lfTogJHtlbX1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIGRlbGF5KTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gdml0ZUVycm9yU2lnKG1zZzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIG1zZy5yZXBsYWNlKC9hdCAuKjpcXGQrOlxcZCsvZywgXCJcIikucmVwbGFjZSgvXFwvW15cXHM6XSsvZywgXCI8cGF0aD5cIikucmVwbGFjZSgvXFxkKy9nLCBcIk5cIikudHJpbSgpLnNsaWNlKDAsIDEyMCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGlzVml0ZVJhdGVMaW1pdGVkKG1zZzogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IHNpZyA9IHZpdGVFcnJvclNpZyhtc2cpO1xuICAgICAgICBjb25zdCBlbnRyeSA9IHZpdGVSYXRlTGltaXRNYXAuZ2V0KHNpZyk7XG4gICAgICAgIGlmICghZW50cnkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKERhdGUubm93KCkgLSBlbnRyeS5maXJzdCA+IDYwMDAwKSB7IHZpdGVSYXRlTGltaXRNYXAuZGVsZXRlKHNpZyk7IHJldHVybiBmYWxzZTsgfVxuICAgICAgICByZXR1cm4gZW50cnkuY291bnQgPj0gMztcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gcmVjb3JkVml0ZUF0dGVtcHQobXNnOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgY29uc3Qgc2lnID0gdml0ZUVycm9yU2lnKG1zZyk7XG4gICAgICAgIGNvbnN0IGVudHJ5ID0gdml0ZVJhdGVMaW1pdE1hcC5nZXQoc2lnKTtcbiAgICAgICAgaWYgKGVudHJ5KSB7XG4gICAgICAgICAgaWYgKERhdGUubm93KCkgLSBlbnRyeS5maXJzdCA+IDYwMDAwKSB7IHZpdGVSYXRlTGltaXRNYXAuc2V0KHNpZywgeyBjb3VudDogMSwgZmlyc3Q6IERhdGUubm93KCkgfSk7IH1cbiAgICAgICAgICBlbHNlIHsgZW50cnkuY291bnQrKzsgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZpdGVSYXRlTGltaXRNYXAuc2V0KHNpZywgeyBjb3VudDogMSwgZmlyc3Q6IERhdGUubm93KCkgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gY2xhc3NpZnlWaXRlRXJyb3IobWVzc2FnZTogc3RyaW5nLCBzdGFjaz86IHN0cmluZyk6IHsgY2F0ZWdvcnk6IHN0cmluZzsgc3RyYXRlZ3k6IHN0cmluZzsgY29uZmlkZW5jZTogbnVtYmVyOyBkZXRhaWw6IHN0cmluZzsgZmlsZT86IHN0cmluZzsgc3ltYm9sPzogc3RyaW5nOyBsaW5lPzogbnVtYmVyOyBjb2x1bW4/OiBudW1iZXIgfSB7XG4gICAgICAgIGNvbnN0IHRleHQgPSBgJHttZXNzYWdlIHx8IFwiXCJ9ICR7c3RhY2sgfHwgXCJcIn1gO1xuICAgICAgICBjb25zdCBwYXR0ZXJuczogeyBwOiBSZWdFeHA7IGNhdDogc3RyaW5nOyBzdHJhdDogc3RyaW5nOyBjb25mOiBudW1iZXI7IGV4RmlsZT86IGJvb2xlYW47IGV4U3ltPzogYm9vbGVhbiB9W10gPSBbXG4gICAgICAgICAgeyBwOiAvZG9lcyBub3QgcHJvdmlkZSBhbiBleHBvcnQgbmFtZWQgJyhbXiddKyknL2ksIGNhdDogXCJleHBvcnQtbWlzc2luZ1wiLCBzdHJhdDogXCJyZXN0YXJ0LXZpdGVcIiwgY29uZjogMC45NSwgZXhTeW06IHRydWUgfSxcbiAgICAgICAgICB7IHA6IC9UaGUgcmVxdWVzdGVkIG1vZHVsZSAnKFteJ10rKScgZG9lcyBub3QgcHJvdmlkZS9pLCBjYXQ6IFwiZXhwb3J0LW1pc3NpbmdcIiwgc3RyYXQ6IFwicmVzdGFydC12aXRlXCIsIGNvbmY6IDAuOTUsIGV4RmlsZTogdHJ1ZSB9LFxuICAgICAgICAgIHsgcDogL0ZhaWxlZCB0byByZXNvbHZlIGltcG9ydCBcIihbXlwiXSspXCIgZnJvbSBcIihbXlwiXSspXCIvaSwgY2F0OiBcIm1vZHVsZS1ub3QtZm91bmRcIiwgc3RyYXQ6IFwicmVzdGFydC12aXRlXCIsIGNvbmY6IDAuOSwgZXhGaWxlOiB0cnVlIH0sXG4gICAgICAgICAgeyBwOiAvQ2Fubm90IGZpbmQgbW9kdWxlICcoW14nXSspJy9pLCBjYXQ6IFwiZGVwZW5kZW5jeS1taXNzaW5nXCIsIHN0cmF0OiBcImluc3RhbGwtbWlzc2luZy1kZXBcIiwgY29uZjogMC44NSwgZXhTeW06IHRydWUgfSxcbiAgICAgICAgICB7IHA6IC9Nb2R1bGUgbm90IGZvdW5kLipDYW4ndCByZXNvbHZlICcoW14nXSspJy9pLCBjYXQ6IFwiZGVwZW5kZW5jeS1taXNzaW5nXCIsIHN0cmF0OiBcImluc3RhbGwtbWlzc2luZy1kZXBcIiwgY29uZjogMC44NSwgZXhTeW06IHRydWUgfSxcbiAgICAgICAgICB7IHA6IC9NT0RVTEVfTk9UX0ZPVU5EL2ksIGNhdDogXCJkZXBlbmRlbmN5LW1pc3NpbmdcIiwgc3RyYXQ6IFwiaW5zdGFsbC1taXNzaW5nLWRlcFwiLCBjb25mOiAwLjggfSxcbiAgICAgICAgICB7IHA6IC9FUkVTT0xWRXxwZWVyIGRlcCg/OmVuZGVuY3kpPy4qY29uZmxpY3R8dW5hYmxlIHRvIHJlc29sdmUgZGVwZW5kZW5jeSB0cmVlL2ksIGNhdDogXCJwZWVyLWRlcC1jb25mbGljdFwiLCBzdHJhdDogXCJsZWdhY3ktcGVlci1kZXBzXCIsIGNvbmY6IDAuOSB9LFxuICAgICAgICAgIHsgcDogL0VJTlRFR1JJVFl8c2hhNTEyLippbnRlZ3JpdHl8Y2hlY2tzdW0gZmFpbGVkL2ksIGNhdDogXCJpbnRlZ3JpdHktZXJyb3JcIiwgc3RyYXQ6IFwiY2FjaGUtY2xlYW4tcmVpbnN0YWxsXCIsIGNvbmY6IDAuOTUgfSxcbiAgICAgICAgICB7IHA6IC9FTk9FTlQuKm5vZGVfbW9kdWxlc3xjb3JydXB0ZWQuKm5vZGVfbW9kdWxlc3xjYW5ub3QgZmluZC4qbm9kZV9tb2R1bGVzL2ksIGNhdDogXCJjb3JydXB0ZWQtbm9kZS1tb2R1bGVzXCIsIHN0cmF0OiBcImZ1bGwtcmVpbnN0YWxsXCIsIGNvbmY6IDAuOSB9LFxuICAgICAgICAgIHsgcDogL0VSUl9QQUNLQUdFX1BBVEhfTk9UX0VYUE9SVEVEL2ksIGNhdDogXCJwYWNrYWdlLWV4cG9ydC1lcnJvclwiLCBzdHJhdDogXCJ1cGRhdGUtcGFja2FnZVwiLCBjb25mOiAwLjg1IH0sXG4gICAgICAgICAgeyBwOiAvRVJSX01PRFVMRV9OT1RfRk9VTkQvaSwgY2F0OiBcImVzbS1tb2R1bGUtbm90LWZvdW5kXCIsIHN0cmF0OiBcImFkZC10eXBlLW1vZHVsZVwiLCBjb25mOiAwLjggfSxcbiAgICAgICAgICB7IHA6IC9FUlJfUkVRVUlSRV9FU018Q2Fubm90IHVzZSBpbXBvcnQgc3RhdGVtZW50IG91dHNpZGUgYSBtb2R1bGV8RVNNIGZpbGUgY2Fubm90IGJlIGxvYWRlZCBieS4qcmVxdWlyZS9pLCBjYXQ6IFwiZXNtLWNvbXBhdFwiLCBzdHJhdDogXCJhZGQtdHlwZS1tb2R1bGVcIiwgY29uZjogMC45IH0sXG4gICAgICAgICAgeyBwOiAvRVJSX09TU0xfRVZQX1VOU1VQUE9SVEVEfGRpZ2l0YWwgZW52ZWxvcGUgcm91dGluZXMuKnVuc3VwcG9ydGVkfGVycm9yOjAzMDgwMTBDL2ksIGNhdDogXCJvcGVuc3NsLWxlZ2FjeVwiLCBzdHJhdDogXCJvcGVuc3NsLWxlZ2FjeS1wcm92aWRlclwiLCBjb25mOiAwLjk1IH0sXG4gICAgICAgICAgeyBwOiAvRU5PU1BDLippbm90aWZ5fG5vIHNwYWNlIGxlZnQuKndhdGNoZXJ8U3lzdGVtIGxpbWl0IGZvci4qZmlsZSB3YXRjaGVycy9pLCBjYXQ6IFwid2F0Y2hlci1saW1pdFwiLCBzdHJhdDogXCJpbmNyZWFzZS13YXRjaGVyc1wiLCBjb25mOiAwLjk1IH0sXG4gICAgICAgICAgeyBwOiAvRU1GSUxFfHRvbyBtYW55IG9wZW4gZmlsZXMvaSwgY2F0OiBcInRvby1tYW55LWZpbGVzXCIsIHN0cmF0OiBcImluY3JlYXNlLXVsaW1pdFwiLCBjb25mOiAwLjkgfSxcbiAgICAgICAgICB7IHA6IC9FTk9NRU18SmF2YVNjcmlwdCBoZWFwIG91dCBvZiBtZW1vcnl8RkFUQUwgRVJST1IuKlJlYWNoZWQgaGVhcCBsaW1pdC9pLCBjYXQ6IFwiaGVhcC1vb21cIiwgc3RyYXQ6IFwiaW5jcmVhc2UtaGVhcFwiLCBjb25mOiAwLjk1IH0sXG4gICAgICAgICAgeyBwOiAvU3ludGF4RXJyb3I6LiooPzpvcHRpb25hbCBjaGFpbmluZ3xudWxsaXNoIGNvYWxlc2Npbmd8XFw/XFwufGNsYXNzIGZpZWxkfHByaXZhdGUgZmllbGR8dG9wLWxldmVsIGF3YWl0KS9pLCBjYXQ6IFwibm9kZS12ZXJzaW9uLW1pc21hdGNoXCIsIHN0cmF0OiBcInVwZ3JhZGUtbm9kZS13YXJuaW5nXCIsIGNvbmY6IDAuODUgfSxcbiAgICAgICAgICB7IHA6IC9TeW50YXhFcnJvcjouKig/OlVuZXhwZWN0ZWQgdG9rZW58VW5leHBlY3RlZCBpZGVudGlmaWVyfE1pc3NpbmcgLiogYmVmb3JlKS9pLCBjYXQ6IFwic3ludGF4LWVycm9yXCIsIHN0cmF0OiBcImNvZGUtZml4XCIsIGNvbmY6IDAuNyB9LFxuICAgICAgICAgIHsgcDogL1R5cGVFcnJvcjogKC4qKSBpcyBub3QgYSBmdW5jdGlvbi9pLCBjYXQ6IFwidHlwZS1lcnJvclwiLCBzdHJhdDogXCJjb2RlLWZpeFwiLCBjb25mOiAwLjYgfSxcbiAgICAgICAgICB7IHA6IC9UeXBlRXJyb3I6IENhbm5vdCByZWFkIHByb3BlcnQoPzp5fGllcykgb2YgKG51bGx8dW5kZWZpbmVkKS9pLCBjYXQ6IFwidHlwZS1lcnJvclwiLCBzdHJhdDogXCJjb2RlLWZpeFwiLCBjb25mOiAwLjYgfSxcbiAgICAgICAgICB7IHA6IC9SZWZlcmVuY2VFcnJvcjogKFxcdyspIGlzIG5vdCBkZWZpbmVkL2ksIGNhdDogXCJyZWZlcmVuY2UtZXJyb3JcIiwgc3RyYXQ6IFwiY29kZS1maXhcIiwgY29uZjogMC43LCBleFN5bTogdHJ1ZSB9LFxuICAgICAgICAgIHsgcDogL0VBRERSSU5VU0UuKjooXFxkKykvaSwgY2F0OiBcInBvcnQtY29uZmxpY3RcIiwgc3RyYXQ6IFwia2lsbC1wb3J0XCIsIGNvbmY6IDAuOTUgfSxcbiAgICAgICAgICB7IHA6IC9QcmUtdHJhbnNmb3JtIGVycm9yL2ksIGNhdDogXCJ2aXRlLXByZS10cmFuc2Zvcm1cIiwgc3RyYXQ6IFwidml0ZS1mb3JjZVwiLCBjb25mOiAwLjkgfSxcbiAgICAgICAgICB7IHA6IC9cXFt2aXRlXFxdIEludGVybmFsIHNlcnZlciBlcnJvci9pLCBjYXQ6IFwidml0ZS1jYWNoZVwiLCBzdHJhdDogXCJkZWxldGUtZnJhbWV3b3JrLWNhY2hlXCIsIGNvbmY6IDAuOCB9LFxuICAgICAgICAgIHsgcDogL0Nhbm5vdCByZWFkIHByb3BlcnQoPzp5fGllcykgb2YgdW5kZWZpbmVkLiooPzpyZWFkaW5nICdjb25maWcnfHBvc3Rjc3N8dGFpbHdpbmQpL2ksIGNhdDogXCJwb3N0Y3NzLXRhaWx3aW5kLW1pc21hdGNoXCIsIHN0cmF0OiBcImZpeC1wb3N0Y3NzLWNvbmZpZ1wiLCBjb25mOiAwLjkgfSxcbiAgICAgICAgICB7IHA6IC9yZWFjdC1zY3JpcHRzOi4qKD86bm90IGZvdW5kfGNvbW1hbmQgbm90IGZvdW5kfEVOT0VOVCkvaSwgY2F0OiBcIm1pc3NpbmctY2xpXCIsIHN0cmF0OiBcImluc3RhbGwtbWlzc2luZy1jbGlcIiwgY29uZjogMC45NSB9LFxuICAgICAgICAgIHsgcDogL25leHQ6LiooPzpub3QgZm91bmR8Y29tbWFuZCBub3QgZm91bmQpfHNoOiBuZXh0OiBjb21tYW5kIG5vdCBmb3VuZC9pLCBjYXQ6IFwibWlzc2luZy1jbGlcIiwgc3RyYXQ6IFwiaW5zdGFsbC1taXNzaW5nLWNsaVwiLCBjb25mOiAwLjk1IH0sXG4gICAgICAgICAgeyBwOiAvbmc6LiooPzpub3QgZm91bmR8Y29tbWFuZCBub3QgZm91bmQpL2ksIGNhdDogXCJtaXNzaW5nLWNsaVwiLCBzdHJhdDogXCJpbnN0YWxsLW1pc3NpbmctY2xpXCIsIGNvbmY6IDAuOSB9LFxuICAgICAgICAgIHsgcDogL251eHQ6LiooPzpub3QgZm91bmR8Y29tbWFuZCBub3QgZm91bmQpL2ksIGNhdDogXCJtaXNzaW5nLWNsaVwiLCBzdHJhdDogXCJpbnN0YWxsLW1pc3NpbmctY2xpXCIsIGNvbmY6IDAuOSB9LFxuICAgICAgICAgIHsgcDogL2FuZ3VsYXIuKnZlcnNpb24uKm1pc21hdGNofG5nIHVwZGF0ZXxyZXF1aXJlcyBBbmd1bGFyL2ksIGNhdDogXCJhbmd1bGFyLW1pc21hdGNoXCIsIHN0cmF0OiBcImFuZ3VsYXItdXBkYXRlXCIsIGNvbmY6IDAuODUgfSxcbiAgICAgICAgICB7IHA6IC9FQ09OTlJFRlVTRUQuKig/OjU0MzJ8MzMwNnwyNzAxN3w2Mzc5KS9pLCBjYXQ6IFwiZGItY29ubmVjdGlvbi1yZWZ1c2VkXCIsIHN0cmF0OiBcImNvcHktZW52LWV4YW1wbGVcIiwgY29uZjogMC43IH0sXG4gICAgICAgICAgeyBwOiAvXFwuZW52LiooPzpub3QgZm91bmR8bWlzc2luZ3xFTk9FTlQpfGVudi4qZmlsZS4qbWlzc2luZy9pLCBjYXQ6IFwibWlzc2luZy1lbnZcIiwgc3RyYXQ6IFwiY29weS1lbnYtZXhhbXBsZVwiLCBjb25mOiAwLjg1IH0sXG4gICAgICAgICAgeyBwOiAvVFMyMzA3LipDYW5ub3QgZmluZCBtb2R1bGUgJyhbXiddKyknL2ksIGNhdDogXCJ0cy1wYXRoLWVycm9yXCIsIHN0cmF0OiBcImZpeC10c2NvbmZpZy1wYXRoc1wiLCBjb25mOiAwLjgsIGV4U3ltOiB0cnVlIH0sXG4gICAgICAgICAgeyBwOiAvZXJyb3IgVFNcXGQrL2ksIGNhdDogXCJ0eXBlc2NyaXB0LWVycm9yXCIsIHN0cmF0OiBcImNvZGUtZml4XCIsIGNvbmY6IDAuNiB9LFxuICAgICAgICAgIHsgcDogL3RzY29uZmlnXFwuanNvbi4qKD86ZXJyb3J8cGFyc2V8aW52YWxpZHxVbmV4cGVjdGVkKS9pLCBjYXQ6IFwidHNjb25maWctcGFyc2UtZXJyb3JcIiwgc3RyYXQ6IFwiZml4LXRzY29uZmlnXCIsIGNvbmY6IDAuODUgfSxcbiAgICAgICAgICB7IHA6IC9Db3VsZCBub3QgZmluZCBhIGRlY2xhcmF0aW9uIGZpbGUgZm9yIG1vZHVsZSAnKFteJ10rKScvaSwgY2F0OiBcIm1pc3NpbmctdHlwZXNcIiwgc3RyYXQ6IFwiaW5zdGFsbC10eXBlc1wiLCBjb25mOiAwLjgsIGV4U3ltOiB0cnVlIH0sXG4gICAgICAgICAgeyBwOiAvTm8gcnVubmFibGUgZW50cnkgcG9pbnQgZm91bmQvaSwgY2F0OiBcIm5vLWVudHJ5LXBvaW50XCIsIHN0cmF0OiBcImZ1bGwtaW5zdGFsbC1yZXRyeVwiLCBjb25mOiAwLjkgfSxcbiAgICAgICAgICB7IHA6IC9wcm9jZXNzIGV4aXQoPzplZCk/LiooPzpjb2RlIFsxLTldfHNpZ25hbCl8ZXhpdGVkIHdpdGggY29kZSBbMS05XS9pLCBjYXQ6IFwicHJvY2Vzcy1leGl0XCIsIHN0cmF0OiBcImNsZWFyLWNhY2hlLXJlc3RhcnRcIiwgY29uZjogMC43IH0sXG4gICAgICAgICAgeyBwOiAvdGltZWQ/ID9vdXR8dGltZW91dC4qd2FpdGluZ3xFVElNRURPVVQvaSwgY2F0OiBcInN0YXJ0dXAtdGltZW91dFwiLCBzdHJhdDogXCJleHRlbmQtdGltZW91dFwiLCBjb25mOiAwLjggfSxcbiAgICAgICAgICB7IHA6IC9DT1JTLipibG9ja2VkfGJsb2NrZWQgYnkgQ09SU3xBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4vaSwgY2F0OiBcImNvcnNcIiwgc3RyYXQ6IFwiY29ycy1jb25maWdcIiwgY29uZjogMC43IH0sXG4gICAgICAgICAgeyBwOiAvZmV0Y2guKmZhaWxlZHxuZXQ6OkVSUl98TmV0d29ya0Vycm9yL2ksIGNhdDogXCJuZXR3b3JrLWVycm9yXCIsIHN0cmF0OiBcInJldHJ5XCIsIGNvbmY6IDAuNiB9LFxuICAgICAgICAgIHsgcDogL3N1cGFiYXNlfHBvc3RncmVzdHxyZWFsdGltZS4qZXJyb3IvaSwgY2F0OiBcInN1cGFiYXNlLWNvbm5lY3Rpb25cIiwgc3RyYXQ6IFwicmV0cnlcIiwgY29uZjogMC43IH0sXG4gICAgICAgICAgeyBwOiAvVklURV9cXHcrLip1bmRlZmluZWR8ZW52LiptaXNzaW5nfGVudmlyb25tZW50IHZhcmlhYmxlL2ksIGNhdDogXCJlbnYtbWlzc2luZ1wiLCBzdHJhdDogXCJjb3B5LWVudi1leGFtcGxlXCIsIGNvbmY6IDAuNyB9LFxuICAgICAgICAgIHsgcDogL0NpcmN1bGFyIGRlcGVuZGVuY3kvaSwgY2F0OiBcImNpcmN1bGFyLWRlcGVuZGVuY3lcIiwgc3RyYXQ6IFwiZXNjYWxhdGVcIiwgY29uZjogMC44IH0sXG4gICAgICAgIF07XG4gICAgICAgIGZvciAoY29uc3QgeyBwLCBjYXQsIHN0cmF0LCBjb25mLCBleEZpbGUsIGV4U3ltIH0gb2YgcGF0dGVybnMpIHtcbiAgICAgICAgICBjb25zdCBtYXRjaCA9IHRleHQubWF0Y2gocCk7XG4gICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IHsgY2F0ZWdvcnk6IHN0cmluZzsgc3RyYXRlZ3k6IHN0cmluZzsgY29uZmlkZW5jZTogbnVtYmVyOyBkZXRhaWw6IHN0cmluZzsgZmlsZT86IHN0cmluZzsgc3ltYm9sPzogc3RyaW5nOyBsaW5lPzogbnVtYmVyOyBjb2x1bW4/OiBudW1iZXIgfSA9IHtcbiAgICAgICAgICAgICAgY2F0ZWdvcnk6IGNhdCwgc3RyYXRlZ3k6IHN0cmF0LCBjb25maWRlbmNlOiBjb25mLCBkZXRhaWw6IG1hdGNoWzBdLnNsaWNlKDAsIDIwMCksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGV4RmlsZSAmJiBtYXRjaFsxXSkgcmVzdWx0LmZpbGUgPSBtYXRjaFsxXS5yZXBsYWNlKC9eXFwvc3JjXFwvLywgXCJzcmMvXCIpO1xuICAgICAgICAgICAgaWYgKGV4U3ltICYmIG1hdGNoWzFdKSByZXN1bHQuc3ltYm9sID0gbWF0Y2hbMV07XG4gICAgICAgICAgICBjb25zdCBmaWxlTWF0Y2ggPSB0ZXh0Lm1hdGNoKC8oPzphdCB8ZnJvbSB8aW4gKSg/OlxcLyk/KFteXFxzOigpXStcXC5banRdc3g/KTooXFxkKykoPzo6KFxcZCspKT8vKTtcbiAgICAgICAgICAgIGlmIChmaWxlTWF0Y2gpIHtcbiAgICAgICAgICAgICAgaWYgKCFyZXN1bHQuZmlsZSkgcmVzdWx0LmZpbGUgPSBmaWxlTWF0Y2hbMV07XG4gICAgICAgICAgICAgIHJlc3VsdC5saW5lID0gcGFyc2VJbnQoZmlsZU1hdGNoWzJdLCAxMCk7XG4gICAgICAgICAgICAgIGlmIChmaWxlTWF0Y2hbM10pIHJlc3VsdC5jb2x1bW4gPSBwYXJzZUludChmaWxlTWF0Y2hbM10sIDEwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IGNhdGVnb3J5OiBcInVua25vd25cIiwgc3RyYXRlZ3k6IFwiZXNjYWxhdGVcIiwgY29uZmlkZW5jZTogMC4xLCBkZXRhaWw6IFN0cmluZyhtZXNzYWdlKS5zbGljZSgwLCAyMDApIH07XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGNsZWFyVml0ZUZyYW1ld29ya0NhY2hlcyhwcm9qZWN0RGlyOiBzdHJpbmcpOiBudW1iZXIge1xuICAgICAgICBjb25zdCBjYWNoZURpcnMgPSBbXCIudml0ZVwiLCBcIi5uZXh0XCIsIFwiLm51eHRcIiwgXCIuYXN0cm9cIiwgXCIuc3ZlbHRlLWtpdFwiLCBcIi5wYXJjZWwtY2FjaGVcIiwgXCJub2RlX21vZHVsZXMvLmNhY2hlXCIsIFwibm9kZV9tb2R1bGVzLy52aXRlXCJdO1xuICAgICAgICBsZXQgY2xlYXJlZCA9IDA7XG4gICAgICAgIGNvbnN0IGZzMyA9IHJlcXVpcmUoXCJmc1wiKSBhcyB0eXBlb2YgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgIGZvciAoY29uc3QgZGlyIG9mIGNhY2hlRGlycykge1xuICAgICAgICAgIGNvbnN0IGZ1bGwgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgZGlyKTtcbiAgICAgICAgICBpZiAoZnMzLmV4aXN0c1N5bmMoZnVsbCkpIHtcbiAgICAgICAgICAgIHRyeSB7IGZzMy5ybVN5bmMoZnVsbCwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pOyBjbGVhcmVkKys7IH0gY2F0Y2gge31cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNsZWFyZWQ7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGNvcHlWaXRlRW52RXhhbXBsZShwcm9qZWN0RGlyOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgZnMzID0gcmVxdWlyZShcImZzXCIpIGFzIHR5cGVvZiBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgY29uc3QgZW52UGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBcIi5lbnZcIik7XG4gICAgICAgIGlmIChmczMuZXhpc3RzU3luYyhlbnZQYXRoKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBleGFtcGxlcyA9IFtcIi5lbnYuZXhhbXBsZVwiLCBcIi5lbnYuc2FtcGxlXCIsIFwiLmVudi50ZW1wbGF0ZVwiLCBcIi5lbnYubG9jYWwuZXhhbXBsZVwiXTtcbiAgICAgICAgZm9yIChjb25zdCBleCBvZiBleGFtcGxlcykge1xuICAgICAgICAgIGNvbnN0IGV4UGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBleCk7XG4gICAgICAgICAgaWYgKGZzMy5leGlzdHNTeW5jKGV4UGF0aCkpIHtcbiAgICAgICAgICAgIHRyeSB7IGZzMy5jb3B5RmlsZVN5bmMoZXhQYXRoLCBlbnZQYXRoKTsgY29uc29sZS5sb2coYFtBdXRvRml4XSBDb3BpZWQgJHtleH0gXHUyMTkyIC5lbnZgKTsgcmV0dXJuIHRydWU7IH0gY2F0Y2gge31cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlciA9IFwiIyBBdXRvLWdlbmVyYXRlZCBwbGFjZWhvbGRlciAuZW52XFxuIyBGaWxsIGluIHlvdXIgZW52aXJvbm1lbnQgdmFyaWFibGVzIGJlbG93XFxuTk9ERV9FTlY9ZGV2ZWxvcG1lbnRcXG5QT1JUPTMwMDBcXG5cIjtcbiAgICAgICAgICBmczMud3JpdGVGaWxlU3luYyhlbnZQYXRoLCBwbGFjZWhvbGRlciwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIltBdXRvRml4XSBDcmVhdGVkIHBsYWNlaG9sZGVyIC5lbnYgKG5vIGV4YW1wbGUgZm91bmQpXCIpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZml4Vml0ZVRzY29uZmlnSnNvbihwcm9qZWN0RGlyOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgZnMzID0gcmVxdWlyZShcImZzXCIpIGFzIHR5cGVvZiBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgY29uc3QgdHNjb25maWdQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIFwidHNjb25maWcuanNvblwiKTtcbiAgICAgICAgaWYgKCFmczMuZXhpc3RzU3luYyh0c2NvbmZpZ1BhdGgpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgbGV0IHJhdyA9IGZzMy5yZWFkRmlsZVN5bmModHNjb25maWdQYXRoLCBcInV0Zi04XCIpO1xuICAgICAgICAgIHJhdyA9IHJhdy5yZXBsYWNlKC9cXC9cXC8uKiQvZ20sIFwiXCIpO1xuICAgICAgICAgIHJhdyA9IHJhdy5yZXBsYWNlKC9cXC9cXCpbXFxzXFxTXSo/XFwqXFwvL2csIFwiXCIpO1xuICAgICAgICAgIHJhdyA9IHJhdy5yZXBsYWNlKC8sKFxccypbfVxcXV0pL2csIFwiJDFcIik7XG4gICAgICAgICAgSlNPTi5wYXJzZShyYXcpO1xuICAgICAgICAgIGZzMy53cml0ZUZpbGVTeW5jKHRzY29uZmlnUGF0aCwgcmF3LCBcInV0Zi04XCIpO1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiW0F1dG9GaXhdIEZpeGVkIHRzY29uZmlnLmpzb24gKHJlbW92ZWQgY29tbWVudHMvdHJhaWxpbmcgY29tbWFzKVwiKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCB7IHJldHVybiBmYWxzZTsgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBmaXhWaXRlUG9zdGNzc0NvbmZpZyhwcm9qZWN0RGlyOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgZnMzID0gcmVxdWlyZShcImZzXCIpIGFzIHR5cGVvZiBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgY29uc3QgY29uZmlncyA9IFtcInBvc3Rjc3MuY29uZmlnLmpzXCIsIFwicG9zdGNzcy5jb25maWcuY2pzXCIsIFwicG9zdGNzcy5jb25maWcubWpzXCJdO1xuICAgICAgICBmb3IgKGNvbnN0IGNmZyBvZiBjb25maWdzKSB7XG4gICAgICAgICAgY29uc3QgY2ZnUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBjZmcpO1xuICAgICAgICAgIGlmICghZnMzLmV4aXN0c1N5bmMoY2ZnUGF0aCkpIGNvbnRpbnVlO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgY29udGVudCA9IGZzMy5yZWFkRmlsZVN5bmMoY2ZnUGF0aCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50LmluY2x1ZGVzKFwidGFpbHdpbmRjc3NcIikgJiYgIWNvbnRlbnQuaW5jbHVkZXMoXCJAdGFpbHdpbmRjc3MvcG9zdGNzc1wiKSkge1xuICAgICAgICAgICAgICBjb25zdCBwa2dQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgICAgICBpZiAoZnMzLmV4aXN0c1N5bmMocGtnUGF0aCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwa2cyID0gSlNPTi5wYXJzZShmczMucmVhZEZpbGVTeW5jKHBrZ1BhdGgsIFwidXRmLThcIikpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFsbERlcHMgPSB7IC4uLihwa2cyLmRlcGVuZGVuY2llcyB8fCB7fSksIC4uLihwa2cyLmRldkRlcGVuZGVuY2llcyB8fCB7fSkgfTtcbiAgICAgICAgICAgICAgICBjb25zdCB0d1ZlcnNpb24gPSBhbGxEZXBzLnRhaWx3aW5kY3NzIHx8IFwiXCI7XG4gICAgICAgICAgICAgICAgaWYgKHR3VmVyc2lvbi5zdGFydHNXaXRoKFwiNFwiKSB8fCB0d1ZlcnNpb24uc3RhcnRzV2l0aChcIl40XCIpIHx8IHR3VmVyc2lvbi5zdGFydHNXaXRoKFwifjRcIikpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoL1snXCJdP3RhaWx3aW5kY3NzWydcIl0/XFxzKjpcXHMqXFx7XFxzKlxcfS9nLCBcIidAdGFpbHdpbmRjc3MvcG9zdGNzcyc6IHt9XCIpO1xuICAgICAgICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgvcmVxdWlyZVxcKFsnXCJddGFpbHdpbmRjc3NbJ1wiXVxcKS9nLCBcInJlcXVpcmUoJ0B0YWlsd2luZGNzcy9wb3N0Y3NzJylcIik7XG4gICAgICAgICAgICAgICAgICBmczMud3JpdGVGaWxlU3luYyhjZmdQYXRoLCBjb250ZW50LCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtBdXRvRml4XSBVcGRhdGVkICR7Y2ZnfSBmb3IgVGFpbHdpbmQgdjQgKHRhaWx3aW5kY3NzIFx1MjE5MiBAdGFpbHdpbmRjc3MvcG9zdGNzcylgKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGZpeFZpdGVUc2NvbmZpZ1BhdGhzKHByb2plY3REaXI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICBjb25zdCBmczQgPSByZXF1aXJlKFwiZnNcIikgYXMgdHlwZW9mIGltcG9ydChcImZzXCIpO1xuICAgICAgICBjb25zdCB0c2NvbmZpZ1BhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJ0c2NvbmZpZy5qc29uXCIpO1xuICAgICAgICBpZiAoIWZzNC5leGlzdHNTeW5jKHRzY29uZmlnUGF0aCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBsZXQgcmF3ID0gZnM0LnJlYWRGaWxlU3luYyh0c2NvbmZpZ1BhdGgsIFwidXRmLThcIik7XG4gICAgICAgICAgcmF3ID0gcmF3LnJlcGxhY2UoL1xcL1xcLy4qJC9nbSwgXCJcIikucmVwbGFjZSgvXFwvXFwqW1xcc1xcU10qP1xcKlxcLy9nLCBcIlwiKS5yZXBsYWNlKC8sKFxccypbfVxcXV0pL2csIFwiJDFcIik7XG4gICAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShyYXcpO1xuICAgICAgICAgIGNvbnN0IGNvbXBpbGVyT3B0aW9ucyA9IHBhcnNlZC5jb21waWxlck9wdGlvbnMgfHwge307XG4gICAgICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcbiAgICAgICAgICBpZiAoIWNvbXBpbGVyT3B0aW9ucy5iYXNlVXJsKSB7XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMuYmFzZVVybCA9IFwiLlwiO1xuICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghY29tcGlsZXJPcHRpb25zLnBhdGhzKSB7XG4gICAgICAgICAgICBjb25zdCBwa2dQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgICAgaWYgKGZzNC5leGlzdHNTeW5jKHBrZ1BhdGgpKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGtnID0gSlNPTi5wYXJzZShmczQucmVhZEZpbGVTeW5jKHBrZ1BhdGgsIFwidXRmLThcIikpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFsbERlcHMgPSB7IC4uLihwa2cuZGVwZW5kZW5jaWVzIHx8IHt9KSwgLi4uKHBrZy5kZXZEZXBlbmRlbmNpZXMgfHwge30pIH07XG4gICAgICAgICAgICAgICAgaWYgKGFsbERlcHNbXCJAXCJdIHx8IGZzNC5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInNyY1wiKSkpIHtcbiAgICAgICAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy5wYXRocyA9IHsgXCJALypcIjogW1wiLi9zcmMvKlwiXSB9O1xuICAgICAgICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgICAgICBwYXJzZWQuY29tcGlsZXJPcHRpb25zID0gY29tcGlsZXJPcHRpb25zO1xuICAgICAgICAgICAgZnM0LndyaXRlRmlsZVN5bmModHNjb25maWdQYXRoLCBKU09OLnN0cmluZ2lmeShwYXJzZWQsIG51bGwsIDIpLCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJbQXV0b0ZpeF0gRml4ZWQgdHNjb25maWcuanNvbiBwYXRocyAoYWRkZWQgYmFzZVVybC9wYXRocylcIik7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBpbnN0YWxsVml0ZU1pc3NpbmdEZXAocHJvamVjdERpcjogc3RyaW5nLCBlcnJvck1lc3NhZ2U6IHN0cmluZywgcG0yOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgZGVwTWF0Y2ggPSBlcnJvck1lc3NhZ2UubWF0Y2goL0Nhbm5vdCBmaW5kIG1vZHVsZSAnKFteJ10rKScvaSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvck1lc3NhZ2UubWF0Y2goL01vZHVsZSBub3QgZm91bmQuKkNhbid0IHJlc29sdmUgJyhbXiddKyknL2kpO1xuICAgICAgICBpZiAoIWRlcE1hdGNoKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IHJhdyA9IGRlcE1hdGNoWzFdO1xuICAgICAgICBpZiAocmF3LnN0YXJ0c1dpdGgoXCIuXCIpIHx8IHJhdy5zdGFydHNXaXRoKFwiL1wiKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBkZXBOYW1lID0gcmF3LnN0YXJ0c1dpdGgoXCJAXCIpID8gcmF3LnNwbGl0KFwiL1wiKS5zbGljZSgwLCAyKS5qb2luKFwiL1wiKSA6IHJhdy5zcGxpdChcIi9cIilbMF07XG4gICAgICAgIGlmICghZGVwTmFtZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgZXhlY1N5bmM6IGVzNSB9ID0gcmVxdWlyZShcImNoaWxkX3Byb2Nlc3NcIikgYXMgdHlwZW9mIGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgY29uc3QgaW5zdGFsbENtZCA9IHBtMiA9PT0gXCJwbnBtXCIgPyBgbnB4IHBucG0gYWRkICR7ZGVwTmFtZX1gIDogcG0yID09PSBcInlhcm5cIiA/IGBucHggeWFybiBhZGQgJHtkZXBOYW1lfWAgOiBgbnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzICR7ZGVwTmFtZX1gO1xuICAgICAgICAgIGVzNShpbnN0YWxsQ21kLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogNjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUsIHdpbmRvd3NIaWRlOiB0cnVlIH0pO1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gSW5zdGFsbGVkIG1pc3NpbmcgZGVwZW5kZW5jeTogJHtkZXBOYW1lfWApO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZGVsZXRlVml0ZUZyYW1ld29ya0NhY2hlKHByb2plY3REaXI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICBjb25zdCBmczQgPSByZXF1aXJlKFwiZnNcIikgYXMgdHlwZW9mIGltcG9ydChcImZzXCIpO1xuICAgICAgICBjb25zdCBjYWNoZURpcnMgPSBbXCIubmV4dFwiLCBcIi5udXh0XCIsIFwiLmFuZ3VsYXJcIiwgXCJub2RlX21vZHVsZXMvLmNhY2hlXCIsIFwibm9kZV9tb2R1bGVzLy52aXRlXCIsIFwiLnN2ZWx0ZS1raXRcIiwgXCIucGFyY2VsLWNhY2hlXCJdO1xuICAgICAgICBsZXQgZGVsZXRlZCA9IGZhbHNlO1xuICAgICAgICBmb3IgKGNvbnN0IGQgb2YgY2FjaGVEaXJzKSB7XG4gICAgICAgICAgY29uc3QgZGlyUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBkKTtcbiAgICAgICAgICBpZiAoZnM0LmV4aXN0c1N5bmMoZGlyUGF0aCkpIHtcbiAgICAgICAgICAgIHRyeSB7IGZzNC5ybVN5bmMoZGlyUGF0aCwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pOyBjb25zb2xlLmxvZyhgW0F1dG9GaXhdIERlbGV0ZWQgY2FjaGUgZGlyOiAke2R9YCk7IGRlbGV0ZWQgPSB0cnVlOyB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWxldGVkO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBmaXhWaXRlQ29yc0NvbmZpZyhwcm9qZWN0RGlyOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgZnM0ID0gcmVxdWlyZShcImZzXCIpIGFzIHR5cGVvZiBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgY29uc3Qgdml0ZUNvbmZpZ0ZpbGVzID0gW1widml0ZS5jb25maWcudHNcIiwgXCJ2aXRlLmNvbmZpZy5qc1wiLCBcInZpdGUuY29uZmlnLm1qc1wiXTtcbiAgICAgICAgZm9yIChjb25zdCB2Y2Ygb2Ygdml0ZUNvbmZpZ0ZpbGVzKSB7XG4gICAgICAgICAgY29uc3QgdmNQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIHZjZik7XG4gICAgICAgICAgaWYgKCFmczQuZXhpc3RzU3luYyh2Y1BhdGgpKSBjb250aW51ZTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IGNvbnRlbnQgPSBmczQucmVhZEZpbGVTeW5jKHZjUGF0aCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50LmluY2x1ZGVzKFwiY29yczpcIikgfHwgY29udGVudC5pbmNsdWRlcyhcImNvcnMgOlwiKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZShcbiAgICAgICAgICAgICAgL3NlcnZlclxccyo6XFxzKlxcey8sXG4gICAgICAgICAgICAgIFwic2VydmVyOiB7XFxuICAgIGNvcnM6IHRydWUsXCJcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBmczQud3JpdGVGaWxlU3luYyh2Y1BhdGgsIGNvbnRlbnQsIFwidXRmLThcIik7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0F1dG9GaXhdIEFkZGVkIGNvcnM6dHJ1ZSB0byAke3ZjZn1gKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBleHByZXNzRmlsZXMgPSBbXCJzZXJ2ZXIuanNcIiwgXCJzZXJ2ZXIudHNcIiwgXCJhcHAuanNcIiwgXCJhcHAudHNcIiwgXCJpbmRleC5qc1wiLCBcImluZGV4LnRzXCIsIFwic3JjL3NlcnZlci5qc1wiLCBcInNyYy9zZXJ2ZXIudHNcIiwgXCJzcmMvYXBwLmpzXCIsIFwic3JjL2FwcC50c1wiLCBcInNyYy9pbmRleC5qc1wiLCBcInNyYy9pbmRleC50c1wiXTtcbiAgICAgICAgZm9yIChjb25zdCBlZiBvZiBleHByZXNzRmlsZXMpIHtcbiAgICAgICAgICBjb25zdCBlZlBhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgZWYpO1xuICAgICAgICAgIGlmICghZnM0LmV4aXN0c1N5bmMoZWZQYXRoKSkgY29udGludWU7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBjb250ZW50ID0gZnM0LnJlYWRGaWxlU3luYyhlZlBhdGgsIFwidXRmLThcIik7XG4gICAgICAgICAgICBpZiAoY29udGVudC5pbmNsdWRlcyhcImNvcnMoXCIpIHx8IGNvbnRlbnQuaW5jbHVkZXMoXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIGlmIChjb250ZW50LmluY2x1ZGVzKFwiZXhwcmVzcygpXCIpIHx8IGNvbnRlbnQuaW5jbHVkZXMoXCJleHByZXNzLmpzb25cIikpIHtcbiAgICAgICAgICAgICAgY29uc3QgY29yc01pZGRsZXdhcmUgPSBcIlxcbmFwcC51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7IHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsICcqJyk7IHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnLCAnR0VULFBPU1QsUFVULERFTEVURSxPUFRJT05TJyk7IHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnLCAnQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nKTsgaWYgKHJlcS5tZXRob2QgPT09ICdPUFRJT05TJykgcmV0dXJuIHJlcy5zZW5kU3RhdHVzKDIwNCk7IG5leHQoKTsgfSk7XFxuXCI7XG4gICAgICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoLyhjb25zdCBhcHBcXHMqPVxccypleHByZXNzXFwoXFwpOz8pLywgYCQxJHtjb3JzTWlkZGxld2FyZX1gKTtcbiAgICAgICAgICAgICAgZnM0LndyaXRlRmlsZVN5bmMoZWZQYXRoLCBjb250ZW50LCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0F1dG9GaXhdIEFkZGVkIENPUlMgbWlkZGxld2FyZSB0byAke2VmfWApO1xuICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiB1cGRhdGVWaXRlU3BlY2lmaWNQYWNrYWdlKHByb2plY3REaXI6IHN0cmluZywgZXJyb3JNZXNzYWdlOiBzdHJpbmcsIHBtMjogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGZzNCA9IHJlcXVpcmUoXCJmc1wiKSBhcyB0eXBlb2YgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgIGNvbnN0IHBrZ01hdGNoID0gZXJyb3JNZXNzYWdlLm1hdGNoKC9FUlJfUEFDS0FHRV9QQVRIX05PVF9FWFBPUlRFRC4qWydcIl0oW14nXCJdKylbJ1wiXS9pKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yTWVzc2FnZS5tYXRjaCgvUGFja2FnZSBwYXRoIC4qIGlzIG5vdCBleHBvcnRlZC4qcGFja2FnZSBbJ1wiXShbXidcIl0rKVsnXCJdL2kpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JNZXNzYWdlLm1hdGNoKC9QYWNrYWdlIHN1YnBhdGggWydcIl0oW14nXCJdKylbJ1wiXSBpcyBub3QgZGVmaW5lZC9pKTtcbiAgICAgICAgaWYgKCFwa2dNYXRjaCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBwa2dOYW1lID0gcGtnTWF0Y2hbMV0uc3RhcnRzV2l0aChcIkBcIikgPyBwa2dNYXRjaFsxXS5zcGxpdChcIi9cIikuc2xpY2UoMCwgMikuam9pbihcIi9cIikgOiBwa2dNYXRjaFsxXS5zcGxpdChcIi9cIilbMF07XG4gICAgICAgIGlmICghcGtnTmFtZSB8fCBwa2dOYW1lLnN0YXJ0c1dpdGgoXCIuXCIpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBleGVjU3luYzogZXM1IH0gPSByZXF1aXJlKFwiY2hpbGRfcHJvY2Vzc1wiKSBhcyB0eXBlb2YgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICBjb25zdCBpbnN0YWxsQ21kID0gcG0yID09PSBcInBucG1cIiA/IGBucHggcG5wbSBhZGQgJHtwa2dOYW1lfUBsYXRlc3RgIDogcG0yID09PSBcInlhcm5cIiA/IGBucHggeWFybiBhZGQgJHtwa2dOYW1lfUBsYXRlc3RgIDogYG5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwcyAke3BrZ05hbWV9QGxhdGVzdGA7XG4gICAgICAgICAgZXM1KGluc3RhbGxDbWQsIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiA2MDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtBdXRvRml4XSBVcGRhdGVkICR7cGtnTmFtZX0gdG8gbGF0ZXN0IChFUlJfUEFDS0FHRV9QQVRIX05PVF9FWFBPUlRFRCBmaXgpYCk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBidWlsZFZpdGVBdXRvRml4RW52KGJhc2VFbnY6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IHVuZGVmaW5lZD4sIG91dHB1dFN0cjogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gICAgICAgIGNvbnN0IGVudiA9IHsgLi4uYmFzZUVudiB9O1xuICAgICAgICBpZiAoL0VSUl9PU1NMX0VWUF9VTlNVUFBPUlRFRHxkaWdpdGFsIGVudmVsb3BlIHJvdXRpbmVzLip1bnN1cHBvcnRlZHxlcnJvcjowMzA4MDEwQy9pLnRlc3Qob3V0cHV0U3RyKSkge1xuICAgICAgICAgIGVudi5OT0RFX09QVElPTlMgPSAoKGVudi5OT0RFX09QVElPTlMgfHwgXCJcIikgKyBcIiAtLW9wZW5zc2wtbGVnYWN5LXByb3ZpZGVyXCIpLnRyaW0oKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIltBdXRvRml4XSBBZGRlZCAtLW9wZW5zc2wtbGVnYWN5LXByb3ZpZGVyIHRvIE5PREVfT1BUSU9OU1wiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoL0VOT01FTXxKYXZhU2NyaXB0IGhlYXAgb3V0IG9mIG1lbW9yeXxGQVRBTCBFUlJPUi4qUmVhY2hlZCBoZWFwIGxpbWl0L2kudGVzdChvdXRwdXRTdHIpKSB7XG4gICAgICAgICAgZW52Lk5PREVfT1BUSU9OUyA9ICgoZW52Lk5PREVfT1BUSU9OUyB8fCBcIlwiKSArIFwiIC0tbWF4LW9sZC1zcGFjZS1zaXplPTQwOTZcIikudHJpbSgpO1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiW0F1dG9GaXhdIEFkZGVkIC0tbWF4LW9sZC1zcGFjZS1zaXplPTQwOTYgdG8gTk9ERV9PUFRJT05TXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBlbnY7XG4gICAgICB9XG5cbiAgICAgIGFzeW5jIGZ1bmN0aW9uIGF0dGVtcHRWaXRlQXV0b0ZpeFN0YXJ0dXAocHJvamVjdERpcjogc3RyaW5nLCBvdXRwdXRTdHI6IHN0cmluZywgcG0yOiBzdHJpbmcsIHNhZmVFbnY6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IHVuZGVmaW5lZD4pOiBQcm9taXNlPHsgZml4ZXM6IHN0cmluZ1tdOyBjbGFzc2lmaWVkOiBSZXR1cm5UeXBlPHR5cGVvZiBjbGFzc2lmeVZpdGVFcnJvcj4gfT4ge1xuICAgICAgICBjb25zdCBmaXhlczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3QgY2xhc3NpZmllZCA9IGNsYXNzaWZ5Vml0ZUVycm9yKG91dHB1dFN0cik7XG4gICAgICAgIGNvbnN0IGZzMyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICBjb25zdCB7IGV4ZWNTeW5jOiBlczQgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG5cbiAgICAgICAgaWYgKC9FSU5URUdSSVRZfHNoYTUxMi4qaW50ZWdyaXR5fGNoZWNrc3VtIGZhaWxlZC9pLnRlc3Qob3V0cHV0U3RyKSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBlczQoXCJucG0gY2FjaGUgY2xlYW4gLS1mb3JjZVwiLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogMzAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUsIHdpbmRvd3NIaWRlOiB0cnVlIH0pO1xuICAgICAgICAgICAgY29uc3QgbG9ja0ZpbGUgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLWxvY2suanNvblwiKTtcbiAgICAgICAgICAgIGlmIChmczMuZXhpc3RzU3luYyhsb2NrRmlsZSkpIGZzMy51bmxpbmtTeW5jKGxvY2tGaWxlKTtcbiAgICAgICAgICAgIGZpeGVzLnB1c2goXCJjYWNoZS1jbGVhblwiKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW0F1dG9GaXhdIENsZWFuZWQgbnBtIGNhY2hlICsgZGVsZXRlZCBwYWNrYWdlLWxvY2suanNvbiAoaW50ZWdyaXR5IGVycm9yKVwiKTtcbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoL0VOT1NQQy4qaW5vdGlmeXxTeXN0ZW0gbGltaXQgZm9yLipmaWxlIHdhdGNoZXJzL2kudGVzdChvdXRwdXRTdHIpKSB7XG4gICAgICAgICAgdHJ5IHsgZXM0KFwic3lzY3RsIC13IGZzLmlub3RpZnkubWF4X3VzZXJfd2F0Y2hlcz01MjQyODggMj4vZGV2L251bGwgfHwgdHJ1ZVwiLCB7IHRpbWVvdXQ6IDUwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUgfSk7IGZpeGVzLnB1c2goXCJpbmNyZWFzZS13YXRjaGVyc1wiKTsgY29uc29sZS5sb2coXCJbQXV0b0ZpeF0gSW5jcmVhc2VkIGlub3RpZnkgd2F0Y2hlcnNcIik7IH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgvRUFERFJJTlVTRS4qOihcXGQrKS9pLnRlc3Qob3V0cHV0U3RyKSkge1xuICAgICAgICAgIGNvbnN0IHBvcnRNYXRjaCA9IG91dHB1dFN0ci5tYXRjaCgvRUFERFJJTlVTRS4qOihcXGQrKS9pKTtcbiAgICAgICAgICBpZiAocG9ydE1hdGNoKSB7XG4gICAgICAgICAgICB0cnkgeyBlczQoYGxzb2YgLXRpOiR7cG9ydE1hdGNoWzFdfSB8IHhhcmdzIGtpbGwgLTkgMj4vZGV2L251bGwgfHwgdHJ1ZWAsIHsgdGltZW91dDogNTAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSB9KTsgZml4ZXMucHVzaChcImtpbGwtcG9ydFwiKTsgY29uc29sZS5sb2coYFtBdXRvRml4XSBLaWxsZWQgcHJvY2VzcyBvbiBwb3J0ICR7cG9ydE1hdGNoWzFdfWApOyB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKC9DYW5ub3QgcmVhZCBwcm9wZXJ0LiooPzpyZWFkaW5nICdjb25maWcnfHBvc3Rjc3N8dGFpbHdpbmQpL2kudGVzdChvdXRwdXRTdHIpKSB7XG4gICAgICAgICAgaWYgKGZpeFZpdGVQb3N0Y3NzQ29uZmlnKHByb2plY3REaXIpKSBmaXhlcy5wdXNoKFwiZml4LXBvc3Rjc3NcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoL3RzY29uZmlnXFwuanNvbi4qKD86ZXJyb3J8cGFyc2V8aW52YWxpZHxVbmV4cGVjdGVkKS9pLnRlc3Qob3V0cHV0U3RyKSkge1xuICAgICAgICAgIGlmIChmaXhWaXRlVHNjb25maWdKc29uKHByb2plY3REaXIpKSBmaXhlcy5wdXNoKFwiZml4LXRzY29uZmlnXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKC9cXC5lbnYuKig/Om5vdCBmb3VuZHxtaXNzaW5nfEVOT0VOVCl8RUNPTk5SRUZVU0VELiooPzo1NDMyfDMzMDZ8MjcwMTd8NjM3OSkvaS50ZXN0KG91dHB1dFN0cikpIHtcbiAgICAgICAgICBpZiAoY29weVZpdGVFbnZFeGFtcGxlKHByb2plY3REaXIpKSBmaXhlcy5wdXNoKFwiY29weS1lbnZcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoL3JlYWN0LXNjcmlwdHMuKm5vdCBmb3VuZHxuZXh0Lipjb21tYW5kIG5vdCBmb3VuZHxuZy4qbm90IGZvdW5kfG51eHQuKm5vdCBmb3VuZC9pLnRlc3Qob3V0cHV0U3RyKSkge1xuICAgICAgICAgIGNvbnN0IGNsaU1hdGNoID0gb3V0cHV0U3RyLm1hdGNoKC8ocmVhY3Qtc2NyaXB0c3xuZXh0fG51eHR8bmcpWzpcXHNdL2kpO1xuICAgICAgICAgIGlmIChjbGlNYXRjaCkge1xuICAgICAgICAgICAgY29uc3QgY2xpID0gY2xpTWF0Y2hbMV0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIGNvbnN0IHBrZ01hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgXCJyZWFjdC1zY3JpcHRzXCI6IFwicmVhY3Qtc2NyaXB0c1wiLCBcIm5leHRcIjogXCJuZXh0XCIsIFwibnV4dFwiOiBcIm51eHRcIiwgXCJuZ1wiOiBcIkBhbmd1bGFyL2NsaVwiIH07XG4gICAgICAgICAgICBjb25zdCBwa2dOYW1lID0gcGtnTWFwW2NsaV07XG4gICAgICAgICAgICBpZiAocGtnTmFtZSkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbGxDbWQgPSBwbTIgPT09IFwicG5wbVwiID8gYG5weCBwbnBtIGFkZCAke3BrZ05hbWV9YCA6IHBtMiA9PT0gXCJ5YXJuXCIgPyBgbnB4IHlhcm4gYWRkICR7cGtnTmFtZX1gIDogYG5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwcyAke3BrZ05hbWV9YDtcbiAgICAgICAgICAgICAgICBlczQoaW5zdGFsbENtZCwgeyBjd2Q6IHByb2plY3REaXIsIHRpbWVvdXQ6IDEyMDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSwgd2luZG93c0hpZGU6IHRydWUsIGVudjogc2FmZUVudiBhcyBOb2RlSlMuUHJvY2Vzc0VudiB9KTtcbiAgICAgICAgICAgICAgICBmaXhlcy5wdXNoKGBpbnN0YWxsLWNsaS0ke2NsaX1gKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0F1dG9GaXhdIEluc3RhbGxlZCBtaXNzaW5nIENMSTogJHtwa2dOYW1lfWApO1xuICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKC9Db3VsZCBub3QgZmluZCBhIGRlY2xhcmF0aW9uIGZpbGV8VFMyMzA3LipDYW5ub3QgZmluZCBtb2R1bGUvaS50ZXN0KG91dHB1dFN0cikpIHtcbiAgICAgICAgICBjb25zdCB0eXBlTWF0Y2ggPSBvdXRwdXRTdHIubWF0Y2goL0NvdWxkIG5vdCBmaW5kIGEgZGVjbGFyYXRpb24gZmlsZSBmb3IgbW9kdWxlICcoW14nXSspJy8pO1xuICAgICAgICAgIGlmICh0eXBlTWF0Y2gpIHtcbiAgICAgICAgICAgIGNvbnN0IG1vZCA9IHR5cGVNYXRjaFsxXS5zdGFydHNXaXRoKFwiQFwiKSA/IHR5cGVNYXRjaFsxXS5zcGxpdChcIi9cIikuc2xpY2UoMCwgMikuam9pbihcIi9cIikgOiB0eXBlTWF0Y2hbMV0uc3BsaXQoXCIvXCIpWzBdO1xuICAgICAgICAgICAgY29uc3QgdHlwZVBrZyA9IGBAdHlwZXMvJHttb2QucmVwbGFjZShcIkBcIiwgXCJcIikucmVwbGFjZShcIi9cIiwgXCJfX1wiKX1gO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgaW5zdGFsbENtZCA9IHBtMiA9PT0gXCJwbnBtXCIgPyBgbnB4IHBucG0gYWRkIC1EICR7dHlwZVBrZ31gIDogcG0yID09PSBcInlhcm5cIiA/IGBucHggeWFybiBhZGQgLUQgJHt0eXBlUGtnfWAgOiBgbnBtIGluc3RhbGwgLS1zYXZlLWRldiAtLWxlZ2FjeS1wZWVyLWRlcHMgJHt0eXBlUGtnfWA7XG4gICAgICAgICAgICAgIGVzNChpbnN0YWxsQ21kLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogNjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUsIHdpbmRvd3NIaWRlOiB0cnVlLCBlbnY6IHNhZmVFbnYgYXMgTm9kZUpTLlByb2Nlc3NFbnYgfSk7XG4gICAgICAgICAgICAgIGZpeGVzLnB1c2goYGluc3RhbGwtdHlwZXMtJHttb2R9YCk7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gSW5zdGFsbGVkIHR5cGUgZGVjbGFyYXRpb25zOiAke3R5cGVQa2d9YCk7XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgvVFMyMzA3LipDYW5ub3QgZmluZCBtb2R1bGUvaS50ZXN0KG91dHB1dFN0cikpIHtcbiAgICAgICAgICAgIGlmIChmaXhWaXRlVHNjb25maWdQYXRocyhwcm9qZWN0RGlyKSkgZml4ZXMucHVzaChcImZpeC10c2NvbmZpZy1wYXRoc1wiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoL0Nhbm5vdCBmaW5kIG1vZHVsZSAnKFteJ10rKSd8TW9kdWxlIG5vdCBmb3VuZC4qQ2FuJ3QgcmVzb2x2ZSAnKFteJ10rKSd8TU9EVUxFX05PVF9GT1VORC9pLnRlc3Qob3V0cHV0U3RyKSkge1xuICAgICAgICAgIGNvbnN0IGxpdmVQbTIgPSBkZXRlY3RQbUZvckRpcihwcm9qZWN0RGlyKTtcbiAgICAgICAgICBpZiAoaW5zdGFsbFZpdGVNaXNzaW5nRGVwKHByb2plY3REaXIsIG91dHB1dFN0ciwgbGl2ZVBtMikpIGZpeGVzLnB1c2goXCJpbnN0YWxsLW1pc3NpbmctZGVwXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKC9cXFt2aXRlXFxdIEludGVybmFsIHNlcnZlciBlcnJvci9pLnRlc3Qob3V0cHV0U3RyKSkge1xuICAgICAgICAgIGlmIChkZWxldGVWaXRlRnJhbWV3b3JrQ2FjaGUocHJvamVjdERpcikpIGZpeGVzLnB1c2goXCJkZWxldGUtZnJhbWV3b3JrLWNhY2hlXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKC9hbmd1bGFyLip2ZXJzaW9uLiptaXNtYXRjaHxuZyB1cGRhdGV8cmVxdWlyZXMgQW5ndWxhci9pLnRlc3Qob3V0cHV0U3RyKSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBlczQoXCJucHggbmcgdXBkYXRlIEBhbmd1bGFyL2NvcmUgQGFuZ3VsYXIvY2xpIC0tZm9yY2UgMj4vZGV2L251bGwgfHwgdHJ1ZVwiLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogMTIwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIGZpeGVzLnB1c2goXCJhbmd1bGFyLXVwZGF0ZVwiKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW0F1dG9GaXhdIEFuZ3VsYXIgcGFja2FnZXMgdXBkYXRlZCB2aWEgbmcgdXBkYXRlXCIpO1xuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgvRU1GSUxFfHRvbyBtYW55IG9wZW4gZmlsZXMvaS50ZXN0KG91dHB1dFN0cikpIHtcbiAgICAgICAgICB0cnkgeyBlczQoXCJ1bGltaXQgLW4gNjU1MzYgMj4vZGV2L251bGwgfHwgdHJ1ZVwiLCB7IHRpbWVvdXQ6IDUwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUgfSk7IGZpeGVzLnB1c2goXCJpbmNyZWFzZS11bGltaXRcIik7IGNvbnNvbGUubG9nKFwiW0F1dG9GaXhdIEF0dGVtcHRlZCB0byBpbmNyZWFzZSBmaWxlIGRlc2NyaXB0b3IgbGltaXRcIik7IH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgvUHJlLXRyYW5zZm9ybSBlcnJvci9pLnRlc3Qob3V0cHV0U3RyKSkge1xuICAgICAgICAgIGNsZWFyVml0ZUZyYW1ld29ya0NhY2hlcyhwcm9qZWN0RGlyKTtcbiAgICAgICAgICBmaXhlcy5wdXNoKFwidml0ZS1mb3JjZVwiKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIltBdXRvRml4XSBDbGVhcmVkIFZpdGUgY2FjaGUgZm9yIC0tZm9yY2UgcmVzdGFydFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNhY2hlc0NsZWFyZWQgPSBjbGVhclZpdGVGcmFtZXdvcmtDYWNoZXMocHJvamVjdERpcik7XG4gICAgICAgIGlmIChjYWNoZXNDbGVhcmVkID4gMCkgZml4ZXMucHVzaChgY2xlYXItJHtjYWNoZXNDbGVhcmVkfS1jYWNoZXNgKTtcblxuICAgICAgICBpZiAoL0VSRVNPTFZFfHBlZXIgZGVwLipjb25mbGljdHx1bmFibGUgdG8gcmVzb2x2ZSBkZXBlbmRlbmN5L2kudGVzdChvdXRwdXRTdHIpIHx8IC9DYW5ub3QgZmluZCBtb2R1bGV8TU9EVUxFX05PVF9GT1VORHxFTk9FTlQuKm5vZGVfbW9kdWxlcy9pLnRlc3Qob3V0cHV0U3RyKSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBubURpciA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBcIm5vZGVfbW9kdWxlc1wiKTtcbiAgICAgICAgICAgIGlmIChmczMuZXhpc3RzU3luYyhubURpcikpIHsgZnMzLnJtU3luYyhubURpciwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pOyBmaXhlcy5wdXNoKFwiZGVsZXRlLW5vZGVfbW9kdWxlc1wiKTsgfVxuICAgICAgICAgICAgY29uc3QgaW5zdGFsbENtZCA9IHBtMiA9PT0gXCJidW5cIiA/IFwibnB4IGJ1biBpbnN0YWxsXCIgOiBwbTIgPT09IFwicG5wbVwiID8gXCJucHggcG5wbSBpbnN0YWxsIC0tbm8tZnJvemVuLWxvY2tmaWxlXCIgOiBwbTIgPT09IFwieWFyblwiID8gXCJucHggeWFybiBpbnN0YWxsIC0taWdub3JlLWVuZ2luZXNcIiA6IFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzXCI7XG4gICAgICAgICAgICBlczQoaW5zdGFsbENtZCwgeyBjd2Q6IHByb2plY3REaXIsIHRpbWVvdXQ6IDE4MDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSwgd2luZG93c0hpZGU6IHRydWUsIGVudjogc2FmZUVudiBhcyBOb2RlSlMuUHJvY2Vzc0VudiB9KTtcbiAgICAgICAgICAgIGZpeGVzLnB1c2goXCJmdWxsLXJlaW5zdGFsbFwiKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW0F1dG9GaXhdIEZ1bGwgcmVpbnN0YWxsIGNvbXBsZXRlZFwiKTtcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGVzNChcIm5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwcyAtLWZvcmNlIC0taWdub3JlLXNjcmlwdHNcIiwgeyBjd2Q6IHByb2plY3REaXIsIHRpbWVvdXQ6IDE4MDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSwgd2luZG93c0hpZGU6IHRydWUsIGVudjogc2FmZUVudiBhcyBOb2RlSlMuUHJvY2Vzc0VudiB9KTtcbiAgICAgICAgICAgICAgZml4ZXMucHVzaChcImZvcmNlLXJlaW5zdGFsbFwiKTtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJbQXV0b0ZpeF0gRm9yY2UgcmVpbnN0YWxsIGNvbXBsZXRlZFwiKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geyBmaXhlcywgY2xhc3NpZmllZCB9O1xuICAgICAgfVxuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9lcnJvcnMvcmVwb3J0XCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbWVzc2FnZSwgc3RhY2ssIHNvdXJjZSwgcHJvamVjdE5hbWU6IHJhd1BOIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghbWVzc2FnZSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIk1pc3NpbmcgZXJyb3IgbWVzc2FnZVwiIH0pKTsgcmV0dXJuOyB9XG4gICAgICAgICAgY29uc3QgcHJvamVjdE5hbWUgPSAocmF3UE4gJiYgdHlwZW9mIHJhd1BOID09PSBcInN0cmluZ1wiICYmIC9eW2EtekEtWjAtOV9cXC0uIF0rJC8udGVzdChyYXdQTikgJiYgIXJhd1BOLmluY2x1ZGVzKFwiLi5cIikpID8gcmF3UE4gOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgICBjb25zdCBjbGFzc2lmaWVkID0gY2xhc3NpZnlWaXRlRXJyb3IobWVzc2FnZSwgc3RhY2spO1xuICAgICAgICAgIGNvbnN0IGVycm9yRW50cnkgPSB7XG4gICAgICAgICAgICBpZDogYGVyci0ke0RhdGUubm93KCl9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgNil9YCxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgIHNvdXJjZTogc291cmNlIHx8IFwidW5rbm93blwiLFxuICAgICAgICAgICAgbWVzc2FnZTogU3RyaW5nKG1lc3NhZ2UpLnNsaWNlKDAsIDIwMDApLFxuICAgICAgICAgICAgc3RhY2s6IHN0YWNrID8gU3RyaW5nKHN0YWNrKS5zbGljZSgwLCA0MDAwKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHByb2plY3ROYW1lOiBwcm9qZWN0TmFtZSB8fCB1bmRlZmluZWQsXG4gICAgICAgICAgICBjbGFzc2lmaWVkLFxuICAgICAgICAgICAgcmVjb3Zlcnk6IG51bGwgYXMgeyBhdHRlbXB0ZWQ6IGJvb2xlYW47IHN1Y2Nlc3M6IGJvb2xlYW47IGRldGFpbDogc3RyaW5nOyBzdHJhdGVneT86IHN0cmluZzsgZHVyYXRpb25Ncz86IG51bWJlciB9IHwgbnVsbCxcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgdml0ZUVycm9ySGlzdG9yeS5wdXNoKGVycm9yRW50cnkpO1xuICAgICAgICAgIGlmICh2aXRlRXJyb3JIaXN0b3J5Lmxlbmd0aCA+IDIwMCkgdml0ZUVycm9ySGlzdG9yeS5zcGxpY2UoMCwgdml0ZUVycm9ySGlzdG9yeS5sZW5ndGggLSAyMDApO1xuXG4gICAgICAgICAgY29uc29sZS5sb2coYFtBdXRvRml4XSBFcnJvciByZXBvcnRlZDogWyR7Y2xhc3NpZmllZC5jYXRlZ29yeX1dICR7U3RyaW5nKG1lc3NhZ2UpLnNsaWNlKDAsIDEwMCl9IChjb25maWRlbmNlOiAke01hdGgucm91bmQoY2xhc3NpZmllZC5jb25maWRlbmNlICogMTAwKX0lKWApO1xuXG4gICAgICAgICAgbGV0IHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IGZhbHNlLCBzdWNjZXNzOiBmYWxzZSwgZGV0YWlsOiBcIk5vIGF1dG8tZml4IGF2YWlsYWJsZVwiIH07XG5cbiAgICAgICAgICBpZiAoY2xhc3NpZmllZC5jb25maWRlbmNlID49IDAuNSAmJiAhaXNWaXRlUmF0ZUxpbWl0ZWQobWVzc2FnZSkpIHtcbiAgICAgICAgICAgIHJlY29yZFZpdGVBdHRlbXB0KG1lc3NhZ2UpO1xuXG4gICAgICAgICAgICBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJyZXN0YXJ0LXZpdGVcIiAmJiBwcm9qZWN0TmFtZSkge1xuICAgICAgICAgICAgICBjb25zdCBwcmV2aWV3RW50cnkgPSBwcmV2aWV3UHJvY2Vzc2VzLmdldChwcm9qZWN0TmFtZSk7XG4gICAgICAgICAgICAgIGlmIChwcmV2aWV3RW50cnkpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgcHJldmlld0VudHJ5LnByb2Nlc3Mua2lsbChcIlNJR1RFUk1cIik7XG4gICAgICAgICAgICAgICAgICBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShwcm9qZWN0TmFtZSk7XG4gICAgICAgICAgICAgICAgICByZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IFwiUHJldmlldyB0ZXJtaW5hdGVkIFx1MjAxNCB3aWxsIHJlc3RhcnQgb24gbmV4dCByZXF1ZXN0XCIgfTtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gS2lsbGVkIHByZXZpZXcgJHtwcm9qZWN0TmFtZX0gZm9yIHJlc3RhcnRgKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlOiB1bmtub3duKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBlbSA9IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTtcbiAgICAgICAgICAgICAgICAgIHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IGZhbHNlLCBkZXRhaWw6IGBLaWxsIGZhaWxlZDogJHtlbX1gIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiY2xlYXItY2FjaGUtcmVzdGFydFwiICYmIHByb2plY3ROYW1lKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHByb2pEaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiLCBwcm9qZWN0TmFtZSk7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY2xlYXJWaXRlRnJhbWV3b3JrQ2FjaGVzKHByb2pEaXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHByZXZpZXdFbnRyeSA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KHByb2plY3ROYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAocHJldmlld0VudHJ5KSB7IHByZXZpZXdFbnRyeS5wcm9jZXNzLmtpbGwoXCJTSUdURVJNXCIpOyBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShwcm9qZWN0TmFtZSk7IH1cbiAgICAgICAgICAgICAgICByZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IFwiQ2FjaGVzIGNsZWFyZWQgKyBwcmV2aWV3IHRlcm1pbmF0ZWRcIiB9O1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gQ2xlYXJlZCBjYWNoZXMgZm9yICR7cHJvamVjdE5hbWV9YCk7XG4gICAgICAgICAgICAgICAgc2NoZWR1bGVWaXRlQXV0b1Jlc3RhcnQocHJvamVjdE5hbWUsIHByb2pEaXIsIFN0cmluZyhwcmV2aWV3RW50cnk/LnBvcnQgfHwgMCkpO1xuICAgICAgICAgICAgICB9IGNhdGNoIChlOiB1bmtub3duKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW0gPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7XG4gICAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogZmFsc2UsIGRldGFpbDogYENhY2hlIGNsZWFyIGZhaWxlZDogJHtlbX1gIH07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJpbnN0YWxsLW1pc3NpbmctZGVwXCIgJiYgcHJvamVjdE5hbWUpIHtcbiAgICAgICAgICAgICAgY29uc3QgeyBleGVjU3luYzogZXhlYzIgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgICAgIGNvbnN0IHByb2pEaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiLCBwcm9qZWN0TmFtZSk7XG4gICAgICAgICAgICAgIGNvbnN0IHBtMyA9IGRldGVjdFBtRm9yRGlyKHByb2pEaXIpO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldGVkID0gaW5zdGFsbFZpdGVNaXNzaW5nRGVwKHByb2pEaXIsIG1lc3NhZ2UgfHwgXCJcIiwgcG0zKTtcbiAgICAgICAgICAgICAgICBpZiAoIXRhcmdldGVkKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBpbnN0YWxsQ21kNCA9IHBtMyA9PT0gXCJidW5cIiA/IFwibnB4IGJ1biBpbnN0YWxsXCIgOiBwbTMgPT09IFwicG5wbVwiID8gXCJucHggcG5wbSBpbnN0YWxsIC0tbm8tZnJvemVuLWxvY2tmaWxlXCIgOiBwbTMgPT09IFwieWFyblwiID8gXCJucHggeWFybiBpbnN0YWxsIC0taWdub3JlLWVuZ2luZXNcIiA6IFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzXCI7XG4gICAgICAgICAgICAgICAgICBleGVjMihpbnN0YWxsQ21kNCwgeyBjd2Q6IHByb2pEaXIsIHRpbWVvdXQ6IDEyMDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiB0YXJnZXRlZCA/IFwiTWlzc2luZyBkZXBlbmRlbmN5IGluc3RhbGxlZFwiIDogXCJEZXBlbmRlbmNpZXMgcmVpbnN0YWxsZWQgKGluc3RhbGwtbWlzc2luZy1kZXAgZmFsbGJhY2spXCIgfTtcbiAgICAgICAgICAgICAgfSBjYXRjaCAoZTogdW5rbm93bikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVtID0gZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpO1xuICAgICAgICAgICAgICAgIHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IGZhbHNlLCBkZXRhaWw6IGBEZXBlbmRlbmN5IGluc3RhbGwgZmFpbGVkOiAke2VtLnNsaWNlKDAsIDIwMCl9YCB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiZGVsZXRlLWZyYW1ld29yay1jYWNoZVwiICYmIHByb2plY3ROYW1lKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHByb2pEaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiLCBwcm9qZWN0TmFtZSk7XG4gICAgICAgICAgICAgIGRlbGV0ZVZpdGVGcmFtZXdvcmtDYWNoZShwcm9qRGlyKTtcbiAgICAgICAgICAgICAgY29uc3QgcHJldmlld0VudHJ5ID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQocHJvamVjdE5hbWUpO1xuICAgICAgICAgICAgICBpZiAocHJldmlld0VudHJ5KSB7IHRyeSB7IHByZXZpZXdFbnRyeS5wcm9jZXNzLmtpbGwoXCJTSUdURVJNXCIpOyB9IGNhdGNoIHt9IHByZXZpZXdQcm9jZXNzZXMuZGVsZXRlKHByb2plY3ROYW1lKTsgfVxuICAgICAgICAgICAgICByZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IFwiRnJhbWV3b3JrIGNhY2hlIGRlbGV0ZWQgKyBwcmV2aWV3IGtpbGxlZCBmb3IgcmVzdGFydFwiIH07XG4gICAgICAgICAgICAgIHNjaGVkdWxlVml0ZUF1dG9SZXN0YXJ0KHByb2plY3ROYW1lLCBwcm9qRGlyLCBTdHJpbmcocHJldmlld0VudHJ5Py5wb3J0IHx8IDApKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwibnBtLWluc3RhbGxcIiB8fCBjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcImxlZ2FjeS1wZWVyLWRlcHNcIiB8fCBjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcImZ1bGwtcmVpbnN0YWxsXCIgfHwgY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJjYWNoZS1jbGVhbi1yZWluc3RhbGxcIiB8fCBjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcImZ1bGwtaW5zdGFsbC1yZXRyeVwiIHx8IGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiaW5zdGFsbC1taXNzaW5nLWNsaVwiIHx8IGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiaW5zdGFsbC10eXBlc1wiKSAmJiBwcm9qZWN0TmFtZSkge1xuICAgICAgICAgICAgICBjb25zdCB7IGV4ZWNTeW5jOiBleGVjMiB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICAgICAgY29uc3QgcHJvakRpciA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcInByb2plY3RzXCIsIHByb2plY3ROYW1lKTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJjYWNoZS1jbGVhbi1yZWluc3RhbGxcIikge1xuICAgICAgICAgICAgICAgICAgdHJ5IHsgZXhlYzIoXCJucG0gY2FjaGUgY2xlYW4gLS1mb3JjZVwiLCB7IGN3ZDogcHJvakRpciwgdGltZW91dDogMzAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUgfSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgIGNvbnN0IGZzMiA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgICAgICAgICAgY29uc3QgbG9ja0ZpbGUgPSBwYXRoLmpvaW4ocHJvakRpciwgXCJwYWNrYWdlLWxvY2suanNvblwiKTtcbiAgICAgICAgICAgICAgICAgIGlmIChmczIuZXhpc3RzU3luYyhsb2NrRmlsZSkpIGZzMi51bmxpbmtTeW5jKGxvY2tGaWxlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtBdXRvRml4XSBJbnN0YWxsaW5nIGRlcHMgZm9yICR7cHJvamVjdE5hbWV9ICgke2NsYXNzaWZpZWQuc3RyYXRlZ3l9KS4uLmApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBtMyA9IGRldGVjdFBtRm9yRGlyKHByb2pEaXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbGxDbWQ0ID0gcG0zID09PSBcImJ1blwiID8gXCJucHggYnVuIGluc3RhbGxcIiA6IHBtMyA9PT0gXCJwbnBtXCIgPyBcIm5weCBwbnBtIGluc3RhbGwgLS1uby1mcm96ZW4tbG9ja2ZpbGVcIiA6IHBtMyA9PT0gXCJ5YXJuXCIgPyBcIm5weCB5YXJuIGluc3RhbGwgLS1pZ25vcmUtZW5naW5lc1wiIDogXCJucG0gaW5zdGFsbCAtLWxlZ2FjeS1wZWVyLWRlcHNcIjtcbiAgICAgICAgICAgICAgICBleGVjMihpbnN0YWxsQ21kNCwgeyBjd2Q6IHByb2pEaXIsIHRpbWVvdXQ6IDEyMDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICByZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IGBEZXBlbmRlbmNpZXMgcmVpbnN0YWxsZWQgKCR7Y2xhc3NpZmllZC5zdHJhdGVneX0pYCB9O1xuICAgICAgICAgICAgICB9IGNhdGNoIChlOiB1bmtub3duKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW0gPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7XG4gICAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogZmFsc2UsIGRldGFpbDogYEluc3RhbGwgZmFpbGVkOiAke2VtLnNsaWNlKDAsIDIwMCl9YCB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwidXBkYXRlLXBhY2thZ2VcIiAmJiBwcm9qZWN0TmFtZSkge1xuICAgICAgICAgICAgICBjb25zdCB7IGV4ZWNTeW5jOiBleGVjMiB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICAgICAgY29uc3QgcHJvakRpciA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcInByb2plY3RzXCIsIHByb2plY3ROYW1lKTtcbiAgICAgICAgICAgICAgY29uc3QgcG0zID0gZGV0ZWN0UG1Gb3JEaXIocHJvakRpcik7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0ZWQgPSB1cGRhdGVWaXRlU3BlY2lmaWNQYWNrYWdlKHByb2pEaXIsIG1lc3NhZ2UgfHwgXCJcIiwgcG0zKTtcbiAgICAgICAgICAgICAgICBpZiAoIXRhcmdldGVkKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBpbnN0YWxsQ21kNCA9IHBtMyA9PT0gXCJidW5cIiA/IFwibnB4IGJ1biBpbnN0YWxsXCIgOiBwbTMgPT09IFwicG5wbVwiID8gXCJucHggcG5wbSBpbnN0YWxsIC0tbm8tZnJvemVuLWxvY2tmaWxlXCIgOiBwbTMgPT09IFwieWFyblwiID8gXCJucHggeWFybiBpbnN0YWxsIC0taWdub3JlLWVuZ2luZXNcIiA6IFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzXCI7XG4gICAgICAgICAgICAgICAgICBleGVjMihpbnN0YWxsQ21kNCwgeyBjd2Q6IHByb2pEaXIsIHRpbWVvdXQ6IDEyMDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiB0YXJnZXRlZCA/IFwiVXBkYXRlZCBvZmZlbmRpbmcgcGFja2FnZSB0byBsYXRlc3RcIiA6IFwiRGVwZW5kZW5jaWVzIHJlaW5zdGFsbGVkICh1cGRhdGUtcGFja2FnZSBmYWxsYmFjaylcIiB9O1xuICAgICAgICAgICAgICB9IGNhdGNoIChlOiB1bmtub3duKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW0gPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7XG4gICAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogZmFsc2UsIGRldGFpbDogYFBhY2thZ2UgdXBkYXRlIGZhaWxlZDogJHtlbS5zbGljZSgwLCAyMDApfWAgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcImZpeC1wb3N0Y3NzLWNvbmZpZ1wiICYmIHByb2plY3ROYW1lKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHByb2pEaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiLCBwcm9qZWN0TmFtZSk7XG4gICAgICAgICAgICAgIGZpeFZpdGVQb3N0Y3NzQ29uZmlnKHByb2pEaXIpO1xuICAgICAgICAgICAgICBjb25zdCBwcmV2aWV3RW50cnkgPSBwcmV2aWV3UHJvY2Vzc2VzLmdldChwcm9qZWN0TmFtZSk7XG4gICAgICAgICAgICAgIGlmIChwcmV2aWV3RW50cnkpIHsgdHJ5IHsgcHJldmlld0VudHJ5LnByb2Nlc3Mua2lsbChcIlNJR1RFUk1cIik7IH0gY2F0Y2gge30gcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUocHJvamVjdE5hbWUpOyB9XG4gICAgICAgICAgICAgIHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IHRydWUsIGRldGFpbDogXCJQb3N0Q1NTIGNvbmZpZyBmaXhlZFwiIH07XG4gICAgICAgICAgICAgIHNjaGVkdWxlVml0ZUF1dG9SZXN0YXJ0KHByb2plY3ROYW1lLCBwcm9qRGlyLCBTdHJpbmcocHJldmlld0VudHJ5Py5wb3J0IHx8IDApKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJmaXgtdHNjb25maWdcIiAmJiBwcm9qZWN0TmFtZSkge1xuICAgICAgICAgICAgICBjb25zdCBwcm9qRGlyID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIFwicHJvamVjdHNcIiwgcHJvamVjdE5hbWUpO1xuICAgICAgICAgICAgICBmaXhWaXRlVHNjb25maWdKc29uKHByb2pEaXIpO1xuICAgICAgICAgICAgICByZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IFwidHNjb25maWcuanNvbiBmaXhlZFwiIH07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiY29weS1lbnYtZXhhbXBsZVwiICYmIHByb2plY3ROYW1lKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHByb2pEaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiLCBwcm9qZWN0TmFtZSk7XG4gICAgICAgICAgICAgIGNvbnN0IGNvcGllZCA9IGNvcHlWaXRlRW52RXhhbXBsZShwcm9qRGlyKTtcbiAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogY29waWVkLCBkZXRhaWw6IGNvcGllZCA/IFwiQ29waWVkIC5lbnYuZXhhbXBsZSBcdTIxOTIgLmVudlwiIDogXCJObyAuZW52IGV4YW1wbGUgZm91bmRcIiB9O1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcImtpbGwtcG9ydFwiKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHBvcnRNYXRjaCA9IG1lc3NhZ2UubWF0Y2goL0VBRERSSU5VU0UuKjooXFxkKykvaSk7XG4gICAgICAgICAgICAgIGlmIChwb3J0TWF0Y2gpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgY29uc3QgeyBleGVjU3luYzogZXhlYzIgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgICAgICAgICBleGVjMihgbHNvZiAtdGk6JHtwb3J0TWF0Y2hbMV19IHwgeGFyZ3Mga2lsbCAtOSAyPi9kZXYvbnVsbCB8fCB0cnVlYCwgeyB0aW1lb3V0OiA1MDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiBgS2lsbGVkIHByb2Nlc3Mgb24gcG9ydCAke3BvcnRNYXRjaFsxXX1gIH07XG4gICAgICAgICAgICAgICAgfSBjYXRjaCB7IHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IGZhbHNlLCBkZXRhaWw6IFwiRmFpbGVkIHRvIGtpbGwgcG9ydFwiIH07IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcInZpdGUtZm9yY2VcIiAmJiBwcm9qZWN0TmFtZSkge1xuICAgICAgICAgICAgICBjb25zdCBwcm9qRGlyID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIFwicHJvamVjdHNcIiwgcHJvamVjdE5hbWUpO1xuICAgICAgICAgICAgICBjbGVhclZpdGVGcmFtZXdvcmtDYWNoZXMocHJvakRpcik7XG4gICAgICAgICAgICAgIGNvbnN0IHByZXZpZXdFbnRyeSA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KHByb2plY3ROYW1lKTtcbiAgICAgICAgICAgICAgaWYgKHByZXZpZXdFbnRyeSkgeyB0cnkgeyBwcmV2aWV3RW50cnkucHJvY2Vzcy5raWxsKFwiU0lHVEVSTVwiKTsgfSBjYXRjaCB7fSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShwcm9qZWN0TmFtZSk7IH1cbiAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiBcIkNsZWFyZWQgVml0ZSBjYWNoZSArIHByZXZpZXcga2lsbGVkIGZvciAtLWZvcmNlIHJlc3RhcnRcIiB9O1xuICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChwcm9qZWN0TmFtZSwgcHJvakRpciwgU3RyaW5nKHByZXZpZXdFbnRyeT8ucG9ydCB8fCAwKSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiZml4LXRzY29uZmlnLXBhdGhzXCIgJiYgcHJvamVjdE5hbWUpIHtcbiAgICAgICAgICAgICAgY29uc3QgcHJvakRpciA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcInByb2plY3RzXCIsIHByb2plY3ROYW1lKTtcbiAgICAgICAgICAgICAgZml4Vml0ZVRzY29uZmlnUGF0aHMocHJvakRpcik7XG4gICAgICAgICAgICAgIGNvbnN0IHByZXZpZXdFbnRyeSA9IHByZXZpZXdQcm9jZXNzZXMuZ2V0KHByb2plY3ROYW1lKTtcbiAgICAgICAgICAgICAgaWYgKHByZXZpZXdFbnRyeSkgeyB0cnkgeyBwcmV2aWV3RW50cnkucHJvY2Vzcy5raWxsKFwiU0lHVEVSTVwiKTsgfSBjYXRjaCB7fSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShwcm9qZWN0TmFtZSk7IH1cbiAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiBcInRzY29uZmlnLmpzb24gcGF0aHMgZml4ZWQgKyBwcmV2aWV3IGtpbGxlZCBmb3IgcmVzdGFydFwiIH07XG4gICAgICAgICAgICAgIHNjaGVkdWxlVml0ZUF1dG9SZXN0YXJ0KHByb2plY3ROYW1lLCBwcm9qRGlyLCBTdHJpbmcocHJldmlld0VudHJ5Py5wb3J0IHx8IDApKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJleHRlbmQtdGltZW91dFwiKSB7XG4gICAgICAgICAgICAgIHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IHRydWUsIGRldGFpbDogXCJTdGFydHVwIHRpbWVvdXQgZXh0ZW5kZWQgXHUyMDE0IHdhaXRpbmcgbG9uZ2VyIGZvciBkZXYgc2VydmVyXCIgfTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJ1cGdyYWRlLW5vZGUtd2FybmluZ1wiKSB7XG4gICAgICAgICAgICAgIGxldCBub2RlVmVyID0gXCJ1bmtub3duXCI7XG4gICAgICAgICAgICAgIHRyeSB7IGNvbnN0IHsgZXhlY1N5bmM6IGV4ZWM1IH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpOyBub2RlVmVyID0gZXhlYzUoXCJub2RlIC0tdmVyc2lvblwiLCB7IHRpbWVvdXQ6IDUwMDAsIHN0ZGlvOiBcInBpcGVcIiwgZW5jb2Rpbmc6IFwidXRmLThcIiB9KS50b1N0cmluZygpLnRyaW0oKTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICByZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiBmYWxzZSwgZGV0YWlsOiBgTm9kZS5qcyB2ZXJzaW9uIG1pc21hdGNoOiBjdXJyZW50ICR7bm9kZVZlcn0gZG9lcyBub3Qgc3VwcG9ydCBtb2Rlcm4gc3ludGF4IChvcHRpb25hbCBjaGFpbmluZywgbnVsbGlzaCBjb2FsZXNjaW5nLCBldGMuKS4gUGxlYXNlIHVwZ3JhZGUgTm9kZS5qcyB0byB2MTQrICh2MTgrIHJlY29tbWVuZGVkKS5gIH07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiY29ycy1jb25maWdcIikge1xuICAgICAgICAgICAgICBpZiAocHJvamVjdE5hbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwcm9qRGlyID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIFwicHJvamVjdHNcIiwgcHJvamVjdE5hbWUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpeGVkID0gZml4Vml0ZUNvcnNDb25maWcocHJvakRpcik7XG4gICAgICAgICAgICAgICAgaWYgKGZpeGVkKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBwcmV2aWV3RW50cnkgPSBwcmV2aWV3UHJvY2Vzc2VzLmdldChwcm9qZWN0TmFtZSk7XG4gICAgICAgICAgICAgICAgICBpZiAocHJldmlld0VudHJ5KSB7IHRyeSB7IHByZXZpZXdFbnRyeS5wcm9jZXNzLmtpbGwoXCJTSUdURVJNXCIpOyB9IGNhdGNoIHt9IHByZXZpZXdQcm9jZXNzZXMuZGVsZXRlKHByb2plY3ROYW1lKTsgfVxuICAgICAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiBcIkNPUlMgY29uZmlnIHBhdGNoZWQgKyBwcmV2aWV3IGtpbGxlZCBmb3IgcmVzdGFydFwiIH07XG4gICAgICAgICAgICAgICAgICBzY2hlZHVsZVZpdGVBdXRvUmVzdGFydChwcm9qZWN0TmFtZSwgcHJvakRpciwgU3RyaW5nKHByZXZpZXdFbnRyeT8ucG9ydCB8fCAwKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IGZhbHNlLCBkZXRhaWw6IFwiQ09SUyBlcnJvciBkZXRlY3RlZCBcdTIwMTQgY291bGQgbm90IGF1dG8tcGF0Y2guIEFkZCBjb3JzOnRydWUgdG8gdml0ZSBzZXJ2ZXIgY29uZmlnIG9yIENPUlMgbWlkZGxld2FyZSB0byBFeHByZXNzIGFwcC5cIiB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiBmYWxzZSwgc3VjY2VzczogZmFsc2UsIGRldGFpbDogXCJDT1JTIGVycm9yIGRldGVjdGVkIFx1MjAxNCBubyBwcm9qZWN0IGNvbnRleHQgZm9yIGF1dG8tZml4LlwiIH07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJpbmNyZWFzZS11bGltaXRcIikge1xuICAgICAgICAgICAgICB0cnkgeyBjb25zdCB7IGV4ZWNTeW5jOiBleGVjNSB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTsgZXhlYzUoXCJ1bGltaXQgLW4gNjU1MzYgMj4vZGV2L251bGwgfHwgdHJ1ZVwiLCB7IHRpbWVvdXQ6IDUwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUgfSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgY29uc3QgcHJldmlld0VudHJ5ID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQocHJvamVjdE5hbWUgfHwgXCJcIik7XG4gICAgICAgICAgICAgIGlmIChwcmV2aWV3RW50cnkpIHsgdHJ5IHsgcHJldmlld0VudHJ5LnByb2Nlc3Mua2lsbChcIlNJR1RFUk1cIik7IH0gY2F0Y2gge30gcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUocHJvamVjdE5hbWUgfHwgXCJcIik7IH1cbiAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiBcIkluY3JlYXNlZCBmaWxlIGRlc2NyaXB0b3IgbGltaXQgKyBwcmV2aWV3IGtpbGxlZCBmb3IgcmVzdGFydFwiIH07XG4gICAgICAgICAgICAgIGlmIChwcm9qZWN0TmFtZSkgc2NoZWR1bGVWaXRlQXV0b1Jlc3RhcnQocHJvamVjdE5hbWUsIHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcInByb2plY3RzXCIsIHByb2plY3ROYW1lKSwgU3RyaW5nKHByZXZpZXdFbnRyeT8ucG9ydCB8fCAwKSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiaW5jcmVhc2Utd2F0Y2hlcnNcIikge1xuICAgICAgICAgICAgICB0cnkgeyBjb25zdCB7IGV4ZWNTeW5jOiBleGVjNSB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTsgZXhlYzUoXCJzeXNjdGwgLXcgZnMuaW5vdGlmeS5tYXhfdXNlcl93YXRjaGVzPTUyNDI4OCAyPi9kZXYvbnVsbCB8fCB0cnVlXCIsIHsgdGltZW91dDogNTAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSB9KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICBjb25zdCBwcmV2aWV3RW50cnkgPSBwcmV2aWV3UHJvY2Vzc2VzLmdldChwcm9qZWN0TmFtZSB8fCBcIlwiKTtcbiAgICAgICAgICAgICAgaWYgKHByZXZpZXdFbnRyeSkgeyB0cnkgeyBwcmV2aWV3RW50cnkucHJvY2Vzcy5raWxsKFwiU0lHVEVSTVwiKTsgfSBjYXRjaCB7fSBwcmV2aWV3UHJvY2Vzc2VzLmRlbGV0ZShwcm9qZWN0TmFtZSB8fCBcIlwiKTsgfVxuICAgICAgICAgICAgICByZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IFwiSW5jcmVhc2VkIGlub3RpZnkgd2F0Y2hlcnMgKyBwcmV2aWV3IGtpbGxlZCBmb3IgcmVzdGFydFwiIH07XG4gICAgICAgICAgICAgIGlmIChwcm9qZWN0TmFtZSkgc2NoZWR1bGVWaXRlQXV0b1Jlc3RhcnQocHJvamVjdE5hbWUsIHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcInByb2plY3RzXCIsIHByb2plY3ROYW1lKSwgU3RyaW5nKHByZXZpZXdFbnRyeT8ucG9ydCB8fCAwKSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiYWRkLXR5cGUtbW9kdWxlXCIgJiYgcHJvamVjdE5hbWUpIHtcbiAgICAgICAgICAgICAgY29uc3QgZnMyID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgICAgIGNvbnN0IHByb2pEaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiLCBwcm9qZWN0TmFtZSk7XG4gICAgICAgICAgICAgIGNvbnN0IHBrZ0pzb25QYXRoID0gcGF0aC5qb2luKHByb2pEaXIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChmczIuZXhpc3RzU3luYyhwa2dKc29uUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBPYmogPSBKU09OLnBhcnNlKGZzMi5yZWFkRmlsZVN5bmMocGtnSnNvblBhdGgsIFwidXRmLThcIikpO1xuICAgICAgICAgICAgICAgICAgaWYgKHBPYmoudHlwZSAhPT0gXCJtb2R1bGVcIikgeyBwT2JqLnR5cGUgPSBcIm1vZHVsZVwiOyBmczIud3JpdGVGaWxlU3luYyhwa2dKc29uUGF0aCwgSlNPTi5zdHJpbmdpZnkocE9iaiwgbnVsbCwgMiksIFwidXRmLThcIik7IH1cbiAgICAgICAgICAgICAgICAgIHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IHRydWUsIGRldGFpbDogXCJBZGRlZCB0eXBlOm1vZHVsZSB0byBwYWNrYWdlLmpzb25cIiB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCB7IHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IGZhbHNlLCBkZXRhaWw6IFwiRmFpbGVkIHRvIGFkZCB0eXBlOm1vZHVsZVwiIH07IH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJhbmd1bGFyLXVwZGF0ZVwiICYmIHByb2plY3ROYW1lKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHByb2pEaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJwcm9qZWN0c1wiLCBwcm9qZWN0TmFtZSk7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBleGVjU3luYzogZXhlYzYgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgICAgICAgZXhlYzYoXCJucHggbmcgdXBkYXRlIEBhbmd1bGFyL2NvcmUgQGFuZ3VsYXIvY2xpIC0tZm9yY2UgMj4vZGV2L251bGwgfHwgdHJ1ZVwiLCB7IGN3ZDogcHJvakRpciwgdGltZW91dDogMTIwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICByZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IFwiQW5ndWxhciBwYWNrYWdlcyB1cGRhdGVkIHZpYSBuZyB1cGRhdGVcIiB9O1xuICAgICAgICAgICAgICB9IGNhdGNoIHsgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogZmFsc2UsIGRldGFpbDogXCJBbmd1bGFyIHVwZGF0ZSBmYWlsZWQgXHUyMDE0IHRyeSBtYW51YWwgbmcgdXBkYXRlXCIgfTsgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICgoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJvcGVuc3NsLWxlZ2FjeS1wcm92aWRlclwiIHx8IGNsYXNzaWZpZWQuc3RyYXRlZ3kgPT09IFwiaW5jcmVhc2UtaGVhcFwiKSAmJiBwcm9qZWN0TmFtZSkge1xuICAgICAgICAgICAgICByZWNvdmVyeSA9IHsgYXR0ZW1wdGVkOiB0cnVlLCBzdWNjZXNzOiB0cnVlLCBkZXRhaWw6IGBXaWxsIGFwcGx5ICR7Y2xhc3NpZmllZC5zdHJhdGVneX0gb24gbmV4dCBwcmV2aWV3IHN0YXJ0YCB9O1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWVkLnN0cmF0ZWd5ID09PSBcImNvZGUtZml4XCIgJiYgcHJvamVjdE5hbWUgJiYgY2xhc3NpZmllZC5maWxlKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGZzMiA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgICAgICBjb25zdCBwcm9qRGlyID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIFwicHJvamVjdHNcIiwgcHJvamVjdE5hbWUpO1xuICAgICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGgucmVzb2x2ZShwcm9qRGlyLCBjbGFzc2lmaWVkLmZpbGUpO1xuICAgICAgICAgICAgICBpZiAoIWZpbGVQYXRoLnN0YXJ0c1dpdGgocHJvakRpciArIHBhdGguc2VwKSAmJiBmaWxlUGF0aCAhPT0gcHJvakRpcikge1xuICAgICAgICAgICAgICAgIHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IGZhbHNlLCBkZXRhaWw6IFwiUGF0aCB0cmF2ZXJzYWwgYmxvY2tlZFwiIH07XG4gICAgICAgICAgICAgIH0gZWxzZSB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChmczIuZXhpc3RzU3luYyhmaWxlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsQ29udGVudCA9IGZzMi5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsIFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgICBjb25zdCBiYWNrdXBQYXRoID0gZmlsZVBhdGggKyBcIi5hdXRvZml4LWJhY2t1cFwiO1xuICAgICAgICAgICAgICAgICAgZnMyLndyaXRlRmlsZVN5bmMoYmFja3VwUGF0aCwgb3JpZ2luYWxDb250ZW50LCBcInV0Zi04XCIpO1xuXG4gICAgICAgICAgICAgICAgICBsZXQgZml4ZWRDb250ZW50OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAgICAgICAgICAgICAgICAgaWYgKGNsYXNzaWZpZWQuY2F0ZWdvcnkgPT09IFwicmVmZXJlbmNlLWVycm9yXCIgJiYgY2xhc3NpZmllZC5zeW1ib2wpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ltID0gY2xhc3NpZmllZC5zeW1ib2w7XG4gICAgICAgICAgICAgICAgICAgIGlmICghb3JpZ2luYWxDb250ZW50LmluY2x1ZGVzKFwiaW1wb3J0XCIpIHx8ICFvcmlnaW5hbENvbnRlbnQuaW5jbHVkZXMoc3ltKSkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZyb21NYXRjaCA9IG9yaWdpbmFsQ29udGVudC5tYXRjaCgvZnJvbVxccytbJ1wiXShbXidcIl0rKVsnXCJdLyk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGZyb21NYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZml4ZWRDb250ZW50ID0gYGltcG9ydCB7ICR7c3ltfSB9IGZyb20gJyR7ZnJvbU1hdGNoWzFdfSc7XFxuJHtvcmlnaW5hbENvbnRlbnR9YDtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5jYXRlZ29yeSA9PT0gXCJ0eXBlLWVycm9yXCIgJiYgY2xhc3NpZmllZC5saW5lKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gb3JpZ2luYWxDb250ZW50LnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaW5lSWR4ID0gY2xhc3NpZmllZC5saW5lIC0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpbmVJZHggPj0gMCAmJiBsaW5lSWR4IDwgbGluZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZG90QWNjZXNzID0gbGluZXNbbGluZUlkeF0ubWF0Y2goLyhcXHcrKVxcLihcXHcrKS8pO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChkb3RBY2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVzW2xpbmVJZHhdID0gbGluZXNbbGluZUlkeF0ucmVwbGFjZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYCR7ZG90QWNjZXNzWzFdfS4ke2RvdEFjY2Vzc1syXX1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBgJHtkb3RBY2Nlc3NbMV19Py4ke2RvdEFjY2Vzc1syXX1gXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgZml4ZWRDb250ZW50ID0gbGluZXMuam9pbihcIlxcblwiKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5jYXRlZ29yeSA9PT0gXCJleHBvcnQtbWlzc2luZ1wiICYmIGNsYXNzaWZpZWQuc3ltYm9sKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN5bSA9IGNsYXNzaWZpZWQuc3ltYm9sO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmdW5jTWF0Y2ggPSBvcmlnaW5hbENvbnRlbnQubWF0Y2gobmV3IFJlZ0V4cChgKD86ZnVuY3Rpb258Y29uc3R8bGV0fHZhcnxjbGFzcylcXFxccyske3N5bX1cXFxcYmApKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZ1bmNNYXRjaCAmJiAhb3JpZ2luYWxDb250ZW50Lm1hdGNoKG5ldyBSZWdFeHAoYGV4cG9ydFxcXFxzKyg/OmRlZmF1bHRcXFxccyspPyg/OmZ1bmN0aW9ufGNvbnN0fGxldHx2YXJ8Y2xhc3MpXFxcXHMrJHtzeW19XFxcXGJgKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICBmaXhlZENvbnRlbnQgPSBvcmlnaW5hbENvbnRlbnQucmVwbGFjZShcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBSZWdFeHAoYChmdW5jdGlvbnxjb25zdHxsZXR8dmFyfGNsYXNzKVxcXFxzKygke3N5bX1cXFxcYilgKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZXhwb3J0ICQxICQyXCJcbiAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGlmICghZml4ZWRDb250ZW50IHx8IGZpeGVkQ29udGVudCA9PT0gb3JpZ2luYWxDb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3NQYXRoMiA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmVudi5IT01FIHx8IFwiflwiLCBcIi5ndWFyZGlhbi1haVwiLCBcInNldHRpbmdzLmpzb25cIik7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3MyID0gSlNPTi5wYXJzZShmczIucmVhZEZpbGVTeW5jKHNldHRpbmdzUGF0aDIsIFwidXRmLThcIikpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChzZXR0aW5nczIuZ3Jva0FwaUtleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJvbXB0MiA9IGBGaXggdGhpcyAke2NsYXNzaWZpZWQuY2F0ZWdvcnl9IGVycm9yIGluIGZpbGUgXCIke2NsYXNzaWZpZWQuZmlsZX1cIjpcXG5cXG5FcnJvcjogJHttZXNzYWdlfVxcbiR7Y2xhc3NpZmllZC5saW5lID8gYExpbmU6ICR7Y2xhc3NpZmllZC5saW5lfWAgOiBcIlwifSR7Y2xhc3NpZmllZC5zeW1ib2wgPyBgXFxuU3ltYm9sOiAke2NsYXNzaWZpZWQuc3ltYm9sfWAgOiBcIlwifVxcblxcbkN1cnJlbnQgZmlsZSBjb250ZW50OlxcblxcYFxcYFxcYFxcbiR7b3JpZ2luYWxDb250ZW50LnNsaWNlKDAsIDYwMDApfVxcblxcYFxcYFxcYFxcblxcblJlc3BvbmQgd2l0aCBPTkxZIHRoZSBmaXhlZCBmaWxlIGNvbnRlbnQsIG5vIGV4cGxhbmF0aW9uLiBJZiB5b3UgY2Fubm90IGZpeCBpdCwgcmVzcG9uZCB3aXRoIGV4YWN0bHkgXCJDQU5OT1RfRklYXCIuYDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGdyb2tSZXNwMiA9IGF3YWl0IGZldGNoKFwiaHR0cHM6Ly9hcGkueC5haS92MS9jaGF0L2NvbXBsZXRpb25zXCIsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiwgXCJBdXRob3JpemF0aW9uXCI6IGBCZWFyZXIgJHtzZXR0aW5nczIuZ3Jva0FwaUtleX1gIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgbW9kZWw6IFwiZ3Jvay0zLW1pbmlcIiwgbWVzc2FnZXM6IFt7IHJvbGU6IFwidXNlclwiLCBjb250ZW50OiBwcm9tcHQyIH1dLCBtYXhfdG9rZW5zOiA4MDAwIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZ3Jva1Jlc3AyLm9rKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGdyb2tEYXRhMiA9IGF3YWl0IGdyb2tSZXNwMi5qc29uKCkgYXMgeyBjaG9pY2VzPzogeyBtZXNzYWdlPzogeyBjb250ZW50Pzogc3RyaW5nIH0gfVtdIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpeGVkUmF3MiA9IGdyb2tEYXRhMi5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LmNvbnRlbnQgfHwgXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFmaXhlZFJhdzIuaW5jbHVkZXMoXCJDQU5OT1RfRklYXCIpICYmIGZpeGVkUmF3Mi50cmltKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjYk1hdGNoID0gZml4ZWRSYXcyLm1hdGNoKC9gYGAoPzpcXHcrKT9cXG4oW1xcc1xcU10rPylgYGAvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaXhlZENvbnRlbnQgPSBjYk1hdGNoID8gY2JNYXRjaFsxXS50cmltKCkgOiBmaXhlZFJhdzIudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXV0b0ZpeF0gR3JvayBwcm92aWRlZCBmaXggZm9yICR7Y2xhc3NpZmllZC5maWxlfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGlmIChmaXhlZENvbnRlbnQgJiYgZml4ZWRDb250ZW50ICE9PSBvcmlnaW5hbENvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgZnMyLndyaXRlRmlsZVN5bmMoZmlsZVBhdGgsIGZpeGVkQ29udGVudCwgXCJ1dGYtOFwiKTtcblxuICAgICAgICAgICAgICAgICAgICBsZXQgdmFsaWRhdGlvbk9rID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKC9cXC5banRdc3g/JC8udGVzdChjbGFzc2lmaWVkLmZpbGUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnJhY2VzID0gKGZpeGVkQ29udGVudC5tYXRjaCgvey9nKSB8fCBbXSkubGVuZ3RoICE9PSAoZml4ZWRDb250ZW50Lm1hdGNoKC99L2cpIHx8IFtdKS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyZW5zID0gKGZpeGVkQ29udGVudC5tYXRjaCgvXFwoL2cpIHx8IFtdKS5sZW5ndGggIT09IChmaXhlZENvbnRlbnQubWF0Y2goL1xcKS9nKSB8fCBbXSkubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChicmFjZXMgfHwgcGFyZW5zKSB2YWxpZGF0aW9uT2sgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICghdmFsaWRhdGlvbk9rKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtBdXRvRml4XSBGaXggdmFsaWRhdGlvbiBmYWlsZWQgXHUyMDE0IHJldmVydGluZyAke2NsYXNzaWZpZWQuZmlsZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICBmczIud3JpdGVGaWxlU3luYyhmaWxlUGF0aCwgb3JpZ2luYWxDb250ZW50LCBcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgICAgIHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IGZhbHNlLCBkZXRhaWw6IGBGaXggYXBwbGllZCBidXQgZmFpbGVkIHZhbGlkYXRpb24gXHUyMDE0IHJldmVydGVkICR7Y2xhc3NpZmllZC5maWxlfWAgfTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0F1dG9GaXhdIEFwcGxpZWQgYW5kIHZhbGlkYXRlZCBjb2RlIGZpeCBmb3IgJHtjbGFzc2lmaWVkLmZpbGV9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogdHJ1ZSwgZGV0YWlsOiBgRml4ZWQgJHtjbGFzc2lmaWVkLmNhdGVnb3J5fSBpbiAke2NsYXNzaWZpZWQuZmlsZX1gIH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IGZhbHNlLCBkZXRhaWw6IGBObyBmaXggYXZhaWxhYmxlIGZvciAke2NsYXNzaWZpZWQuY2F0ZWdvcnl9IGluICR7Y2xhc3NpZmllZC5maWxlfWAgfTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogZmFsc2UsIGRldGFpbDogYEZpbGUgbm90IGZvdW5kOiAke2NsYXNzaWZpZWQuZmlsZX1gIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGNhdGNoIChlOiB1bmtub3duKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW0gPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7XG4gICAgICAgICAgICAgICAgcmVjb3ZlcnkgPSB7IGF0dGVtcHRlZDogdHJ1ZSwgc3VjY2VzczogZmFsc2UsIGRldGFpbDogYENvZGUgZml4IGZhaWxlZDogJHtlbX1gIH07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2xhc3NpZmllZC5zdHJhdGVneSA9PT0gXCJyZXRyeVwiKSB7XG4gICAgICAgICAgICAgIHJlY292ZXJ5ID0geyBhdHRlbXB0ZWQ6IHRydWUsIHN1Y2Nlc3M6IHRydWUsIGRldGFpbDogXCJNYXJrZWQgZm9yIHJldHJ5IG9uIG5leHQgb2NjdXJyZW5jZVwiIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZXJyb3JFbnRyeS5yZWNvdmVyeSA9IHJlY292ZXJ5O1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyByZXBvcnRlZDogdHJ1ZSwgaWQ6IGVycm9yRW50cnkuaWQsIGNsYXNzaWZpZWQsIHJlY292ZXJ5IH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiB1bmtub3duKSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgY29uc3QgZW0gPSBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlbSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9lcnJvcnMvaGlzdG9yeVwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgY29uc3QgdXJsMiA9IG5ldyBVUkwocmVxLnVybCB8fCBcIi9cIiwgXCJodHRwOi8vbG9jYWxob3N0XCIpO1xuICAgICAgICBjb25zdCBsaW1pdCA9IHBhcnNlSW50KHVybDIuc2VhcmNoUGFyYW1zLmdldChcImxpbWl0XCIpIHx8IFwiNTBcIiwgMTApIHx8IDUwO1xuICAgICAgICBjb25zdCByZWNlbnQgPSB2aXRlRXJyb3JIaXN0b3J5LnNsaWNlKC1saW1pdCk7XG4gICAgICAgIGNvbnN0IHRvdGFsID0gdml0ZUVycm9ySGlzdG9yeS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGF1dG9GaXhlZCA9IHZpdGVFcnJvckhpc3RvcnkuZmlsdGVyKChlOiB7IHJlY292ZXJ5PzogeyBzdWNjZXNzPzogYm9vbGVhbiB9IH0pID0+IGUucmVjb3Zlcnk/LnN1Y2Nlc3MpLmxlbmd0aDtcbiAgICAgICAgY29uc3QgZXNjYWxhdGVkID0gdml0ZUVycm9ySGlzdG9yeS5maWx0ZXIoKGU6IHsgY2xhc3NpZmllZD86IHsgc3RyYXRlZ3k/OiBzdHJpbmcgfSB9KSA9PiBlLmNsYXNzaWZpZWQ/LnN0cmF0ZWd5ID09PSBcImVzY2FsYXRlXCIpLmxlbmd0aDtcbiAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcnM6IHJlY2VudCwgc3RhdHM6IHsgdG90YWwsIGF1dG9GaXhlZCwgZXNjYWxhdGVkIH0gfSkpO1xuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL2dyb2stZml4XCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgZmlsZVBhdGg6IGZwLCBjb250ZW50LCBlcnJvck1lc3NhZ2UsIGNhdGVnb3J5LCBsaW5lLCBzeW1ib2wgfSA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEJvZHkocmVxKSk7XG4gICAgICAgICAgaWYgKCFmcCB8fCAhY29udGVudCB8fCAhZXJyb3JNZXNzYWdlKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIiB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgY29uc3QgZnMyID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3Qgc2V0dGluZ3NQYXRoID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuZW52LkhPTUUgfHwgXCJ+XCIsIFwiLmd1YXJkaWFuLWFpXCIsIFwic2V0dGluZ3MuanNvblwiKTtcbiAgICAgICAgICBsZXQgZ3Jva0FwaUtleTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzZXR0aW5ncyA9IEpTT04ucGFyc2UoZnMyLnJlYWRGaWxlU3luYyhzZXR0aW5nc1BhdGgsIFwidXRmLThcIikpO1xuICAgICAgICAgICAgZ3Jva0FwaUtleSA9IHNldHRpbmdzLmdyb2tBcGlLZXk7XG4gICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgaWYgKCFncm9rQXBpS2V5KSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiR3JvayBBUEkga2V5IG5vdCBjb25maWd1cmVkXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IHByb21wdCA9IGBGaXggdGhpcyAke2NhdGVnb3J5IHx8IFwidW5rbm93blwifSBlcnJvciBpbiBmaWxlIFwiJHtmcH1cIjpcXG5cXG5FcnJvcjogJHtlcnJvck1lc3NhZ2V9XFxuJHtsaW5lID8gYExpbmU6ICR7bGluZX1gIDogXCJcIn0ke3N5bWJvbCA/IGBcXG5TeW1ib2w6ICR7c3ltYm9sfWAgOiBcIlwifVxcblxcbkN1cnJlbnQgZmlsZSBjb250ZW50OlxcblxcYFxcYFxcYFxcbiR7U3RyaW5nKGNvbnRlbnQpLnNsaWNlKDAsIDYwMDApfVxcblxcYFxcYFxcYFxcblxcblJlc3BvbmQgd2l0aCBPTkxZIHRoZSBmaXhlZCBmaWxlIGNvbnRlbnQsIG5vIGV4cGxhbmF0aW9uLiBJZiB5b3UgY2Fubm90IGZpeCBpdCwgcmVzcG9uZCB3aXRoIGV4YWN0bHkgXCJDQU5OT1RfRklYXCIuYDtcblxuICAgICAgICAgIGNvbnN0IGdyb2tSZXNwID0gYXdhaXQgZmV0Y2goXCJodHRwczovL2FwaS54LmFpL3YxL2NoYXQvY29tcGxldGlvbnNcIiwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsIFwiQXV0aG9yaXphdGlvblwiOiBgQmVhcmVyICR7Z3Jva0FwaUtleX1gIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IG1vZGVsOiBcImdyb2stMy1taW5pXCIsIG1lc3NhZ2VzOiBbeyByb2xlOiBcInVzZXJcIiwgY29udGVudDogcHJvbXB0IH1dLCBtYXhfdG9rZW5zOiA4MDAwIH0pLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmICghZ3Jva1Jlc3Aub2spIHsgcmVzLnN0YXR1c0NvZGUgPSA1MDI7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJHcm9rIEFQSSBlcnJvclwiIH0pKTsgcmV0dXJuOyB9XG4gICAgICAgICAgY29uc3QgZ3Jva0RhdGEgPSBhd2FpdCBncm9rUmVzcC5qc29uKCkgYXMgeyBjaG9pY2VzPzogeyBtZXNzYWdlPzogeyBjb250ZW50Pzogc3RyaW5nIH0gfVtdIH07XG4gICAgICAgICAgY29uc3QgZml4ZWRSYXcgPSBncm9rRGF0YS5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LmNvbnRlbnQgfHwgXCJcIjtcblxuICAgICAgICAgIGlmIChmaXhlZFJhdy5pbmNsdWRlcyhcIkNBTk5PVF9GSVhcIikgfHwgIWZpeGVkUmF3LnRyaW0oKSkge1xuICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZml4ZWRDb250ZW50OiBudWxsLCByZWFzb246IFwiR3JvayBjb3VsZCBub3QgZml4IHRoaXMgZXJyb3JcIiB9KSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGV0IGZpeGVkQ29udGVudCA9IGZpeGVkUmF3O1xuICAgICAgICAgIGNvbnN0IGNvZGVCbG9ja01hdGNoID0gZml4ZWRSYXcubWF0Y2goL2BgYCg/OlxcdyspP1xcbihbXFxzXFxTXSs/KWBgYC8pO1xuICAgICAgICAgIGlmIChjb2RlQmxvY2tNYXRjaCkgZml4ZWRDb250ZW50ID0gY29kZUJsb2NrTWF0Y2hbMV07XG5cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZml4ZWRDb250ZW50OiBmaXhlZENvbnRlbnQudHJpbSgpIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiB1bmtub3duKSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgY29uc3QgZW0gPSBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlbSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS92YWxpZGF0ZS1maWxlXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgZmlsZVBhdGg6IGZwIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghZnApIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJNaXNzaW5nIGZpbGVQYXRoXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzMiA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IGFic1BhdGggPSBwYXRoLmlzQWJzb2x1dGUoZnApID8gZnAgOiBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgZnApO1xuICAgICAgICAgIGlmICghZnMyLmV4aXN0c1N5bmMoYWJzUGF0aCkpIHtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHZhbGlkOiBmYWxzZSwgcmVhc29uOiBcIkZpbGUgbm90IGZvdW5kXCIgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBmczIucmVhZEZpbGVTeW5jKGFic1BhdGgsIFwidXRmLThcIik7XG5cbiAgICAgICAgICBpZiAoZnAuZW5kc1dpdGgoXCIuanNvblwiKSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgSlNPTi5wYXJzZShjb250ZW50KTtcbiAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyB2YWxpZDogdHJ1ZSB9KSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGU6IHVua25vd24pIHtcbiAgICAgICAgICAgICAgY29uc3QgZW0gPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7XG4gICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgdmFsaWQ6IGZhbHNlLCByZWFzb246IGBKU09OIHBhcnNlIGVycm9yOiAke2VtfWAgfSkpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKC9cXC5banRdc3g/JC8udGVzdChmcCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGhhc1VubWF0Y2hlZEJyYWNlcyA9IChjb250ZW50Lm1hdGNoKC97L2cpIHx8IFtdKS5sZW5ndGggIT09IChjb250ZW50Lm1hdGNoKC99L2cpIHx8IFtdKS5sZW5ndGg7XG4gICAgICAgICAgICBjb25zdCBoYXNVbm1hdGNoZWRQYXJlbnMgPSAoY29udGVudC5tYXRjaCgvXFwoL2cpIHx8IFtdKS5sZW5ndGggIT09IChjb250ZW50Lm1hdGNoKC9cXCkvZykgfHwgW10pLmxlbmd0aDtcbiAgICAgICAgICAgIGlmIChoYXNVbm1hdGNoZWRCcmFjZXMgfHwgaGFzVW5tYXRjaGVkUGFyZW5zKSB7XG4gICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgdmFsaWQ6IGZhbHNlLCByZWFzb246IFwiVW5tYXRjaGVkIGJyYWNlcyBvciBwYXJlbnRoZXNlc1wiIH0pKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyB2YWxpZDogdHJ1ZSB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogdW5rbm93bikge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIGNvbnN0IGVtID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZW0gfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJvamVjdHMvaW5zdGFsbC1kZXBzXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSwgZGVwZW5kZW5jaWVzLCBkZXZEZXBlbmRlbmNpZXMsIGZ1bGxJbnN0YWxsIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGlmICghbmFtZSB8fCAvW1xcL1xcXFxdfFxcLlxcLi8udGVzdChuYW1lKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIkludmFsaWQgcHJvamVjdCBuYW1lXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcInByb2plY3RzXCIsIG5hbWUpO1xuICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkgeyByZXMuc3RhdHVzQ29kZSA9IDQwNDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIlByb2plY3Qgbm90IGZvdW5kXCIgfSkpOyByZXR1cm47IH1cblxuICAgICAgICAgIGNvbnN0IHBrZ0pzb25QYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgIGxldCBwa2dKc29uVmFsaWQgPSBmYWxzZTtcbiAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwa2dKc29uUGF0aCkpIHtcbiAgICAgICAgICAgIHRyeSB7IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBrZ0pzb25QYXRoLCBcInV0Zi04XCIpKTsgcGtnSnNvblZhbGlkID0gdHJ1ZTsgfSBjYXRjaCB7fVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXBrZ0pzb25WYWxpZCkge1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwa2dKc29uUGF0aCwgSlNPTi5zdHJpbmdpZnkoeyBuYW1lLCB2ZXJzaW9uOiBcIjAuMC4xXCIsIHByaXZhdGU6IHRydWUgfSwgbnVsbCwgMikpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCBwbSA9IFwibnBtXCI7XG4gICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwiYnVuLmxvY2tiXCIpKSB8fCBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcImJ1bi5sb2NrXCIpKSkgcG0gPSBcImJ1blwiO1xuICAgICAgICAgIGVsc2UgaWYgKGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwicG5wbS1sb2NrLnlhbWxcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwicG5wbS13b3Jrc3BhY2UueWFtbFwiKSkpIHBtID0gXCJwbnBtXCI7XG4gICAgICAgICAgZWxzZSBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCJ5YXJuLmxvY2tcIikpKSBwbSA9IFwieWFyblwiO1xuXG4gICAgICAgICAgY29uc3QgZGVwc0luc3RhbGxFbnYgPSB7IC4uLnByb2Nlc3MuZW52LCBIVVNLWTogXCIwXCIsIERJU0FCTEVfT1BFTkNPTExFQ1RJVkU6IFwidHJ1ZVwiLCBBREJMT0NLOiBcIjFcIiB9O1xuXG4gICAgICAgICAgaWYgKGZ1bGxJbnN0YWxsICYmICFkZXBlbmRlbmNpZXM/Lmxlbmd0aCAmJiAhZGV2RGVwZW5kZW5jaWVzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbGxDbWQgPSBwbSA9PT0gXCJidW5cIiA/IFwibnB4IGJ1biBpbnN0YWxsXCIgOiBwbSA9PT0gXCJwbnBtXCIgPyBcIm5weCBwbnBtIGluc3RhbGxcIiA6IHBtID09PSBcInlhcm5cIiA/IFwibnB4IHlhcm4gaW5zdGFsbFwiIDogXCJucG0gaW5zdGFsbCAtLWxlZ2FjeS1wZWVyLWRlcHNcIjtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbRGVwc10gUnVubmluZyBmdWxsIGluc3RhbGw6ICR7aW5zdGFsbENtZH0gaW4gJHtuYW1lfWApO1xuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcIi5naXRcIikpKSB7IHRyeSB7IGZzLm1rZGlyU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCIuZ2l0XCIpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fSB9XG4gICAgICAgICAgICBjb25zdCB7IGV4ZWM6IGV4ZWNGdWxsIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgICAgcmV0dXJuIGV4ZWNGdWxsKGluc3RhbGxDbWQsIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiAxODAwMDAsIHNoZWxsOiB0cnVlLCBtYXhCdWZmZXI6IDIgKiAxMDI0ICogMTAyNCwgd2luZG93c0hpZGU6IHRydWUsIGVudjogZGVwc0luc3RhbGxFbnYgfSwgKGVyciwgX3N0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0RlcHNdIEZ1bGwgaW5zdGFsbCB3YXJuaW5nIGZvciAke25hbWV9OiAke3N0ZGVycj8uc2xpY2UoMCwgMjAwKX1gKTtcbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBzdGRlcnI/LnNsaWNlKDAsIDMwMCkgfHwgZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0RlcHNdIEZ1bGwgaW5zdGFsbCBjb21wbGV0ZSBmb3IgJHtuYW1lfWApO1xuICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIHJlc3VsdHM6IFtcImZ1bGwgaW5zdGFsbCBjb21wbGV0ZVwiXSB9KSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCByZXN1bHRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgIGNvbnN0IHsgZXhlYzogZXhlY0FzeW5jIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgICAgICAgIGNvbnN0IHZhbGlkUGtnID0gL14oQFthLXowLTkuXy1dK1xcLyk/W2EtejAtOS5fLV0rKEBbXlxcc10qKT8kLztcbiAgICAgICAgICBjb25zdCBub3RBUGtnID0gbmV3IFNldChbXCJucG1cIixcIm5weFwiLFwieWFyblwiLFwicG5wbVwiLFwiYnVuXCIsXCJub2RlXCIsXCJkZW5vXCIsXCJydW5cIixcImRldlwiLFwic3RhcnRcIixcImJ1aWxkXCIsXCJ0ZXN0XCIsXCJzZXJ2ZVwiLFwid2F0Y2hcIixcImxpbnRcIixcImRlcGxveVwiLFwicHJldmlld1wiLFwiaW5zdGFsbFwiLFwiYWRkXCIsXCJyZW1vdmVcIixcInVuaW5zdGFsbFwiLFwidXBkYXRlXCIsXCJpbml0XCIsXCJjcmVhdGVcIixcImNkXCIsXCJsc1wiLFwibWtkaXJcIixcInJtXCIsXCJjcFwiLFwibXZcIixcImNhdFwiLFwiZWNob1wiLFwidG91Y2hcIixcImdpdFwiLFwiY3VybFwiLFwid2dldFwiLFwidGhlblwiLFwiYW5kXCIsXCJvclwiLFwidGhlXCIsXCJhXCIsXCJhblwiLFwidG9cIixcImluXCIsXCJvZlwiLFwiZm9yXCIsXCJ3aXRoXCIsXCJmcm9tXCIsXCJ5b3VyXCIsXCJ0aGlzXCIsXCJ0aGF0XCIsXCJpdFwiLFwiaXNcIixcImFyZVwiLFwid2FzXCIsXCJiZVwiLFwiaGFzXCIsXCJoYXZlXCIsXCJkb1wiLFwiZG9lc1wiLFwiaWZcIixcIm5vdFwiLFwibm9cIixcInllc1wiLFwib25cIixcIm9mZlwiLFwidXBcIixcInNvXCIsXCJidXRcIixcImJ5XCIsXCJhdFwiLFwiYXNcIixcInNlcnZlclwiLFwiYXBwXCIsXCJhcHBsaWNhdGlvblwiLFwicHJvamVjdFwiLFwiZmlsZVwiLFwiZGlyZWN0b3J5XCIsXCJmb2xkZXJcIixcIm5leHRcIixcImZpcnN0XCIsXCJmb2xsb3dpbmdcIixcImFib3ZlXCIsXCJiZWxvd1wiLFwiYWZ0ZXJcIixcImJlZm9yZVwiLFwiYWxsXCIsXCJhbnlcIixcImVhY2hcIixcImV2ZXJ5XCIsXCJib3RoXCIsXCJuZXdcIixcIm9sZFwiXSk7XG4gICAgICAgICAgY29uc3QgZmlsdGVyUGtncyA9IChhcnI6IHN0cmluZ1tdKSA9PiAoYXJyIHx8IFtdKS5maWx0ZXIoKGQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgaWYgKCF2YWxpZFBrZy50ZXN0KGQpIHx8IC9bOyZ8YCQoKXt9XS8udGVzdChkKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgYmFzZSA9IGQucmVwbGFjZSgvQFteXFxzXSokLywgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICByZXR1cm4gIW5vdEFQa2cuaGFzKGJhc2UpICYmIChiYXNlLmxlbmd0aCA+IDEgfHwgZC5zdGFydHNXaXRoKCdAJykpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbnN0IHNhZmVEZXBzID0gZmlsdGVyUGtncyhkZXBlbmRlbmNpZXMgfHwgW10pO1xuICAgICAgICAgIGNvbnN0IHNhZmVEZXZEZXBzID0gZmlsdGVyUGtncyhkZXZEZXBlbmRlbmNpZXMgfHwgW10pO1xuXG4gICAgICAgICAgY29uc3QgYnVpbGRJbnN0YWxsQ21kID0gKHBrZ3M6IHN0cmluZ1tdLCBpc0RldjogYm9vbGVhbik6IHN0cmluZyA9PiB7XG4gICAgICAgICAgICBjb25zdCBwa2dTdHIgPSBwa2dzLmpvaW4oXCIgXCIpO1xuICAgICAgICAgICAgc3dpdGNoIChwbSkge1xuICAgICAgICAgICAgICBjYXNlIFwiYnVuXCI6IHJldHVybiBgbnB4IGJ1biBhZGQke2lzRGV2ID8gXCIgLWRcIiA6IFwiXCJ9ICR7cGtnU3RyfWA7XG4gICAgICAgICAgICAgIGNhc2UgXCJwbnBtXCI6IHJldHVybiBgbnB4IHBucG0gYWRkJHtpc0RldiA/IFwiIC1EXCIgOiBcIlwifSAke3BrZ1N0cn1gO1xuICAgICAgICAgICAgICBjYXNlIFwieWFyblwiOiByZXR1cm4gYG5weCB5YXJuIGFkZCR7aXNEZXYgPyBcIiAtRFwiIDogXCJcIn0gJHtwa2dTdHJ9YDtcbiAgICAgICAgICAgICAgZGVmYXVsdDogcmV0dXJuIGBucG0gaW5zdGFsbCAtLWxlZ2FjeS1wZWVyLWRlcHMke2lzRGV2ID8gXCIgLS1zYXZlLWRldlwiIDogXCJcIn0gJHtwa2dTdHJ9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgXCIuZ2l0XCIpKSkgeyB0cnkgeyBmcy5ta2RpclN5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwiLmdpdFwiKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gY2F0Y2gge30gfVxuICAgICAgICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICBjb25zdCBydW5JbnN0YWxsID0gKHBrZ3M6IHN0cmluZ1tdLCBpc0RldjogYm9vbGVhbik6IFByb21pc2U8dm9pZD4gPT4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNtZCA9IGJ1aWxkSW5zdGFsbENtZChwa2dzLCBpc0Rldik7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0RlcHNdIFJ1bm5pbmc6ICR7Y21kfSBpbiAke25hbWV9YCk7XG4gICAgICAgICAgICBleGVjQXN5bmMoY21kLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogMTIwMDAwLCBzaGVsbDogdHJ1ZSwgbWF4QnVmZmVyOiAyICogMTAyNCAqIDEwMjQsIHdpbmRvd3NIaWRlOiB0cnVlLCBlbnY6IGRlcHNJbnN0YWxsRW52IH0sIChlcnIsIF9zdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW0RlcHNdIEZhaWxlZDogJHtjbWR9YCwgc3RkZXJyPy5zbGljZSgwLCAzMDApIHx8IGVyci5tZXNzYWdlPy5zbGljZSgwLCAzMDApKTtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWxsYmFja0NtZCA9IHBtICE9PSBcIm5wbVwiXG4gICAgICAgICAgICAgICAgICA/IGBucG0gaW5zdGFsbCAtLWxlZ2FjeS1wZWVyLWRlcHMke2lzRGV2ID8gXCIgLS1zYXZlLWRldlwiIDogXCJcIn0gJHtwa2dzLmpvaW4oXCIgXCIpfWBcbiAgICAgICAgICAgICAgICAgIDogYCR7Y21kfSAtLWlnbm9yZS1zY3JpcHRzYDtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0RlcHNdIFJldHJ5aW5nOiAke2ZhbGxiYWNrQ21kfWApO1xuICAgICAgICAgICAgICAgIGV4ZWNBc3luYyhmYWxsYmFja0NtZCwgeyBjd2Q6IHByb2plY3REaXIsIHRpbWVvdXQ6IDEyMDAwMCwgc2hlbGw6IHRydWUsIG1heEJ1ZmZlcjogMiAqIDEwMjQgKiAxMDI0LCB3aW5kb3dzSGlkZTogdHJ1ZSwgZW52OiBkZXBzSW5zdGFsbEVudiB9LCAoZXJyMikgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKGVycjIpIGVycm9ycy5wdXNoKGBGYWlsZWQ6IENvbW1hbmQgZmFpbGVkOiAke2NtZH1gKTtcbiAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgaWYgKHNhZmVEZXBzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGF3YWl0IHJ1bkluc3RhbGwoc2FmZURlcHMsIGZhbHNlKTtcbiAgICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoID09PSAwKSByZXN1bHRzLnB1c2goYEluc3RhbGxlZDogJHtzYWZlRGVwcy5qb2luKFwiLCBcIil9YCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHNhZmVEZXZEZXBzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHByZXZFcnJvcnMgPSBlcnJvcnMubGVuZ3RoO1xuICAgICAgICAgICAgYXdhaXQgcnVuSW5zdGFsbChzYWZlRGV2RGVwcywgdHJ1ZSk7XG4gICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCA9PT0gcHJldkVycm9ycykgcmVzdWx0cy5wdXNoKGBJbnN0YWxsZWQgZGV2OiAke3NhZmVEZXZEZXBzLmpvaW4oXCIsIFwiKX1gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICBjb25zdCBzdWNjZXNzID0gZXJyb3JzLmxlbmd0aCA9PT0gMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzcywgcmVzdWx0cywgZXJyb3JzIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL3J1bi1jb21tYW5kXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgbmFtZSwgY29tbWFuZCB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBpZiAoIWNvbW1hbmQgfHwgdHlwZW9mIGNvbW1hbmQgIT09IFwic3RyaW5nXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDA7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJObyBjb21tYW5kIHNwZWNpZmllZFwiIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCBjaGVjayA9IHZhbGlkYXRlUHJvamVjdFBhdGgobmFtZSB8fCBcIlwiKTtcbiAgICAgICAgICBpZiAoIWNoZWNrLnZhbGlkKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAzOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBjaGVjay5lcnJvciB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgY29uc3QgYWxsb3dlZFByZWZpeGVzID0gW1xuICAgICAgICAgICAgXCJucG0gXCIsIFwibnB4IFwiLCBcInlhcm4gXCIsIFwicG5wbSBcIiwgXCJidW4gXCIsXG4gICAgICAgICAgICBcIm5vZGUgXCIsIFwiZGVubyBcIiwgXCJ0c2NcIiwgXCJ0c3ggXCIsXG4gICAgICAgICAgICBcImNvcmVwYWNrIFwiLCBcIm52bSBcIiwgXCJmbm0gXCIsXG4gICAgICAgICAgICBcIm1rZGlyIFwiLCBcImNwIFwiLCBcIm12IFwiLCBcInJtIFwiLCBcInRvdWNoIFwiLCBcImNhdCBcIiwgXCJscyBcIiwgXCJwd2RcIixcbiAgICAgICAgICAgIFwiY2htb2QgXCIsIFwiY2hvd24gXCIsIFwibG4gXCIsXG4gICAgICAgICAgICBcImdpdCBcIiwgXCJjdXJsIFwiLCBcIndnZXQgXCIsXG4gICAgICAgICAgICBcInB5dGhvblwiLCBcInBpcFwiLCBcImNhcmdvIFwiLCBcImdvIFwiLCBcInJ1c3RjXCIsIFwiZ2NjXCIsIFwiZysrXCIsIFwibWFrZVwiLFxuICAgICAgICAgICAgXCJkb2NrZXIgXCIsIFwiZG9ja2VyLWNvbXBvc2UgXCIsXG4gICAgICAgICAgXTtcbiAgICAgICAgICBjb25zdCB0cmltbWVkID0gY29tbWFuZC50cmltKCkucmVwbGFjZSgvXFxzKyNcXHMrLiokLywgJycpLnRyaW0oKTtcbiAgICAgICAgICBpZiAoL1tcXHJcXG5cXHgwMF0vLnRlc3QodHJpbW1lZCkpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJDb250cm9sIGNoYXJhY3RlcnMgbm90IGFsbG93ZWQgaW4gY29tbWFuZHNcIiB9KSk7IHJldHVybjsgfVxuXG4gICAgICAgICAgaWYgKC9eY3VybC1pbnN0YWxsOmh0dHBzPzpcXC9cXC8vaS50ZXN0KHRyaW1tZWQpKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHRVcmwgPSB0cmltbWVkLnJlcGxhY2UoL15jdXJsLWluc3RhbGw6L2ksIFwiXCIpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IGNoZWNrLnJlc29sdmVkO1xuICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiUHJvamVjdCBub3QgZm91bmRcIiB9KSk7IHJldHVybjsgfVxuICAgICAgICAgICAgICBjb25zdCB7IGV4ZWM6IGV4ZWNBc3luYyB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICAgICAgY29uc3Qgb3MgPSBhd2FpdCBpbXBvcnQoXCJvc1wiKTtcbiAgICAgICAgICAgICAgY29uc3QgaXNXaW4gPSBvcy5wbGF0Zm9ybSgpID09PSBcIndpbjMyXCI7XG5cbiAgICAgICAgICAgICAgY29uc3QgV0lOX05QTV9BTFRFUk5BVElWRVM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAgICAgICAgICAgXCJidW4uc2gvaW5zdGFsbFwiOiBcIm5wbSBpbnN0YWxsIC1nIGJ1blwiLFxuICAgICAgICAgICAgICAgIFwiZ2V0LnBucG0uaW8vaW5zdGFsbC5zaFwiOiBcIm5wbSBpbnN0YWxsIC1nIHBucG1cIixcbiAgICAgICAgICAgICAgICBcImluc3RhbGwucHl0aG9uLXBvZXRyeS5vcmdcIjogXCJwaXAgaW5zdGFsbCBwb2V0cnlcIixcbiAgICAgICAgICAgICAgICBcInJ1c3R1cC5yc1wiOiBcIndpbmdldCBpbnN0YWxsIFJ1c3RsYW5nLlJ1c3R1cFwiLFxuICAgICAgICAgICAgICAgIFwiZGVuby5sYW5kL2luc3RhbGwuc2hcIjogXCJucG0gaW5zdGFsbCAtZyBkZW5vXCIsXG4gICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgaWYgKGlzV2luKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgd2luQWx0ID0gT2JqZWN0LmVudHJpZXMoV0lOX05QTV9BTFRFUk5BVElWRVMpLmZpbmQoKFtrXSkgPT4gc2NyaXB0VXJsLmluY2x1ZGVzKGspKTtcbiAgICAgICAgICAgICAgICBpZiAod2luQWx0KSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBhbHRDbWQgPSB3aW5BbHRbMV07XG4gICAgICAgICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBleGVjQXN5bmMoYWx0Q21kLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogMTIwMDAwLCBzaGVsbDogdHJ1ZSwgbWF4QnVmZmVyOiAyICogMTAyNCAqIDEwMjQsIHdpbmRvd3NIaWRlOiB0cnVlIH0sIChlcnIsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYCR7ZXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDQwMCl9IChyYW46ICR7YWx0Q21kfSlgLCBvdXRwdXQ6IChzdGRvdXQgfHwgXCJcIikuc2xpY2UoMCwgNDAwMCksIHN0ZGVycjogKHN0ZGVyciB8fCBcIlwiKS5zbGljZSgwLCAyMDAwKSB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBvdXRwdXQ6IGBXaW5kb3dzIGFsdGVybmF0aXZlOiAke2FsdENtZH1cXG4keyhzdGRvdXQgfHwgXCJcIikuc2xpY2UoMCwgNDAwMCl9YCB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwczFVcmwgPSBzY3JpcHRVcmwucmVwbGFjZSgvXFwuc2gkLywgXCIucHMxXCIpO1xuICAgICAgICAgICAgICAgIGxldCB1c2VQc1NjcmlwdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRyeSB7IGNvbnN0IGhlYWQgPSBhd2FpdCBmZXRjaChwczFVcmwsIHsgbWV0aG9kOiBcIkhFQURcIiB9KTsgdXNlUHNTY3JpcHQgPSBoZWFkLm9rOyB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgICAgICBpZiAodXNlUHNTY3JpcHQpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBzQ21kID0gYGlybSAke3BzMVVybH0gfCBpZXhgO1xuICAgICAgICAgICAgICAgICAgY29uc3QgZW5jb2RlZENtZCA9IEJ1ZmZlci5mcm9tKHBzQ21kLCBcInV0ZjE2bGVcIikudG9TdHJpbmcoXCJiYXNlNjRcIik7XG4gICAgICAgICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBleGVjQXN5bmMoYHBvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtRXhlY3V0aW9uUG9saWN5IEJ5cGFzcyAtRW5jb2RlZENvbW1hbmQgJHtlbmNvZGVkQ21kfWAsIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiAxMjAwMDAsIHNoZWxsOiB0cnVlLCBtYXhCdWZmZXI6IDIgKiAxMDI0ICogMTAyNCwgd2luZG93c0hpZGU6IHRydWUgfSwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZT8uc2xpY2UoMCwgNTAwKSwgb3V0cHV0OiAoc3Rkb3V0IHx8IFwiXCIpLnNsaWNlKDAsIDQwMDApLCBzdGRlcnI6IChzdGRlcnIgfHwgXCJcIikuc2xpY2UoMCwgMjAwMCkgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiAoc3Rkb3V0IHx8IFwiXCIpLnNsaWNlKDAsIDQwMDApIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaChzY3JpcHRVcmwpO1xuICAgICAgICAgICAgICBpZiAoIXJlc3Aub2spIHsgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gZG93bmxvYWQgc2NyaXB0OiAke3Jlc3Auc3RhdHVzfSAke3Jlc3Auc3RhdHVzVGV4dH1gIH0pKTsgcmV0dXJuOyB9XG4gICAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IGF3YWl0IHJlc3AudGV4dCgpO1xuICAgICAgICAgICAgICBjb25zdCB0bXBTY3JpcHQgPSBwYXRoLmpvaW4ob3MudG1wZGlyKCksIGBpbnN0YWxsLSR7RGF0ZS5ub3coKX0uc2hgKTtcbiAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh0bXBTY3JpcHQsIHNjcmlwdCwgeyBtb2RlOiAwbzc1NSB9KTtcbiAgICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICBleGVjQXN5bmMoYGJhc2ggXCIke3RtcFNjcmlwdH1cImAsIHsgY3dkOiBwcm9qZWN0RGlyLCB0aW1lb3V0OiAxMjAwMDAsIHNoZWxsOiB0cnVlLCBtYXhCdWZmZXI6IDIgKiAxMDI0ICogMTAyNCwgd2luZG93c0hpZGU6IHRydWUsIGVudjogeyAuLi5wcm9jZXNzLmVudiwgQlVOX0lOU1RBTEw6IHByb2plY3REaXIsIENBUkdPX0hPTUU6IHByb2plY3REaXIsIFJVU1RVUF9IT01FOiBwcm9qZWN0RGlyIH0gfSwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgIHRyeSB7IGZzLnVubGlua1N5bmModG1wU2NyaXB0KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlPy5zbGljZSgwLCA1MDApLCBvdXRwdXQ6IChzdGRvdXQgfHwgXCJcIikuc2xpY2UoMCwgNDAwMCksIHN0ZGVycjogKHN0ZGVyciB8fCBcIlwiKS5zbGljZSgwLCAyMDAwKSB9KSk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiAoc3Rkb3V0IHx8IFwiXCIpLnNsaWNlKDAsIDQwMDApIH0pKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGRldlNlcnZlclJlID0gL14oPzpucG1cXHMrKD86cnVuXFxzKyk/KD86ZGV2fHN0YXJ0KXx5YXJuXFxzKyg/OmRldnxzdGFydCl8cG5wbVxccysoPzpkZXZ8c3RhcnQpfGJ1blxccysoPzpkZXZ8c3RhcnQpfG5weFxccyt2aXRlKD86XFxzfCQpKS9pO1xuICAgICAgICAgIGlmIChkZXZTZXJ2ZXJSZS50ZXN0KHRyaW1tZWQpKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiRGV2IHNlcnZlciBjb21tYW5kcyBzaG91bGQgdXNlIHRoZSBQcmV2aWV3IGJ1dHRvbiBpbnN0ZWFkXCIgfSkpOyByZXR1cm47IH1cbiAgICAgICAgICBjb25zdCBpc0FsbG93ZWQgPSBhbGxvd2VkUHJlZml4ZXMuc29tZShwID0+IHRyaW1tZWQuc3RhcnRzV2l0aChwKSkgfHwgdHJpbW1lZCA9PT0gXCJucG0gaW5zdGFsbFwiIHx8IHRyaW1tZWQgPT09IFwiY29yZXBhY2sgZW5hYmxlXCI7XG4gICAgICAgICAgaWYgKCFpc0FsbG93ZWQpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDM7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogYENvbW1hbmQgbm90IGFsbG93ZWQ6ICR7dHJpbW1lZC5zbGljZSgwLCA1MCl9YCB9KSk7IHJldHVybjsgfVxuICAgICAgICAgIGlmICgvWzsmfGAkKCl7fV0vLnRlc3QodHJpbW1lZCkpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAzOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiU2hlbGwgbWV0YWNoYXJhY3RlcnMgbm90IGFsbG93ZWRcIiB9KSk7IHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKC9cXC5cXC5bXFwvXFxcXF0vLnRlc3QodHJpbW1lZCkpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAzOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiUGF0aCB0cmF2ZXJzYWwgbm90IGFsbG93ZWRcIiB9KSk7IHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBjaGVjay5yZXNvbHZlZDtcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7IHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcm9qZWN0IGRpcmVjdG9yeSBub3QgZm91bmQ6ICR7cHJvamVjdERpcn1gIH0pKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgICBjb25zdCB7IGV4ZWM6IGV4ZWNBc3luYyB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICBjb25zdCBvcyA9IGF3YWl0IGltcG9ydChcIm9zXCIpO1xuICAgICAgICAgIGNvbnN0IGlzV2luID0gb3MucGxhdGZvcm0oKSA9PT0gXCJ3aW4zMlwiO1xuICAgICAgICAgIGxldCBhY3R1YWxDbWQgPSB0cmltbWVkID09PSBcIm5wbSBpbnN0YWxsXCIgPyBcIm5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwc1wiIDogdHJpbW1lZDtcblxuICAgICAgICAgIGNvbnN0IGlzSW5zdGFsbENtZCA9IC9eKG5wbVxccytpbnN0YWxsfG5wbVxccytpXFxifHlhcm5cXHMqKGluc3RhbGwpPyR8cG5wbVxccytpbnN0YWxsfGJ1blxccytpbnN0YWxsfG5weFxccysocG5wbXx5YXJufGJ1bilcXHMraW5zdGFsbCkvaS50ZXN0KHRyaW1tZWQpO1xuICAgICAgICAgIGlmIChpc0luc3RhbGxDbWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGdpdERpciA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBcIi5naXRcIik7XG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZ2l0RGlyKSkge1xuICAgICAgICAgICAgICB0cnkgeyBmcy5ta2RpclN5bmMoZ2l0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IG5vZGVIYW5kbGVkID0gYXdhaXQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGlmICgvXnJtXFxzKygtcmY/XFxzKyk/L2kudGVzdChhY3R1YWxDbWQpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHRhcmdldHMgPSBhY3R1YWxDbWQucmVwbGFjZSgvXnJtXFxzKygtcmY/XFxzKyk/L2ksIFwiXCIpLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgICAgICAgICBjb25zdCByZXN1bHRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgdCk7XG4gICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRQYXRoLnN0YXJ0c1dpdGgocHJvamVjdERpcikpIHsgcmVzdWx0cy5wdXNoKGBTa2lwcGVkIChvdXRzaWRlIHByb2plY3QpOiAke3R9YCk7IGNvbnRpbnVlOyB9XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyh0YXJnZXRQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goYFJlbW92ZWQ6ICR7dH1gKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlOiBhbnkpIHsgcmVzdWx0cy5wdXNoKGBGYWlsZWQgdG8gcmVtb3ZlICR7dH06ICR7ZS5tZXNzYWdlfWApOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiByZXN1bHRzLmpvaW4oXCJcXG5cIikgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgvXm1rZGlyXFxzKygtcFxccyspPy9pLnRlc3QoYWN0dWFsQ21kKSkge1xuICAgICAgICAgICAgICBjb25zdCBkaXIgPSBhY3R1YWxDbWQucmVwbGFjZSgvXm1rZGlyXFxzKygtcFxccyspPy9pLCBcIlwiKS50cmltKCk7XG4gICAgICAgICAgICAgIGNvbnN0IGRpclBhdGggPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgZGlyKTtcbiAgICAgICAgICAgICAgaWYgKCFkaXJQYXRoLnN0YXJ0c1dpdGgocHJvamVjdERpcikpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQYXRoIG91dHNpZGUgcHJvamVjdFwiIH07XG4gICAgICAgICAgICAgIHRyeSB7IGZzLm1rZGlyU3luYyhkaXJQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiBgQ3JlYXRlZDogJHtkaXJ9YCB9OyB9XG4gICAgICAgICAgICAgIGNhdGNoIChlOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlLm1lc3NhZ2UgfTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKC9edG91Y2hcXHMvaS50ZXN0KGFjdHVhbENtZCkpIHtcbiAgICAgICAgICAgICAgY29uc3QgZmlsZSA9IGFjdHVhbENtZC5yZXBsYWNlKC9edG91Y2hcXHMrL2ksIFwiXCIpLnRyaW0oKTtcbiAgICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgZmlsZSk7XG4gICAgICAgICAgICAgIGlmICghZmlsZVBhdGguc3RhcnRzV2l0aChwcm9qZWN0RGlyKSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIlBhdGggb3V0c2lkZSBwcm9qZWN0XCIgfTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBkaXIgPSBwYXRoLmRpcm5hbWUoZmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhkaXIpKSBmcy5ta2RpclN5bmMoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGZpbGVQYXRoLCBcIlwiLCB7IGZsYWc6IFwiYVwiIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG91dHB1dDogYFRvdWNoZWQ6ICR7ZmlsZX1gIH07XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGUubWVzc2FnZSB9OyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoL15jYXRcXHMvaS50ZXN0KGFjdHVhbENtZCkpIHtcbiAgICAgICAgICAgICAgY29uc3QgZmlsZSA9IGFjdHVhbENtZC5yZXBsYWNlKC9eY2F0XFxzKy9pLCBcIlwiKS50cmltKCk7XG4gICAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5yZXNvbHZlKHByb2plY3REaXIsIGZpbGUpO1xuICAgICAgICAgICAgICBpZiAoIWZpbGVQYXRoLnN0YXJ0c1dpdGgocHJvamVjdERpcikpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQYXRoIG91dHNpZGUgcHJvamVjdFwiIH07XG4gICAgICAgICAgICAgIHRyeSB7IHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG91dHB1dDogZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCBcInV0Zi04XCIpLnNsaWNlKDAsIDQwMDApIH07IH1cbiAgICAgICAgICAgICAgY2F0Y2ggKGU6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGUubWVzc2FnZSB9OyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoL15jcFxccy9pLnRlc3QoYWN0dWFsQ21kKSkge1xuICAgICAgICAgICAgICBjb25zdCBhcmdzID0gYWN0dWFsQ21kLnJlcGxhY2UoL15jcFxccysoLXJcXHMrKT8vaSwgXCJcIikudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+PSAyKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3JjID0gcGF0aC5yZXNvbHZlKHByb2plY3REaXIsIGFyZ3NbMF0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlc3QgPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgYXJnc1sxXSk7XG4gICAgICAgICAgICAgICAgaWYgKCFzcmMuc3RhcnRzV2l0aChwcm9qZWN0RGlyKSB8fCAhZGVzdC5zdGFydHNXaXRoKHByb2plY3REaXIpKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiUGF0aCBvdXRzaWRlIHByb2plY3RcIiB9O1xuICAgICAgICAgICAgICAgIHRyeSB7IGZzLmNwU3luYyhzcmMsIGRlc3QsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTsgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiBgQ29waWVkOiAke2FyZ3NbMF19IFx1MjE5MiAke2FyZ3NbMV19YCB9OyB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGU6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGUubWVzc2FnZSB9OyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgvXm12XFxzL2kudGVzdChhY3R1YWxDbWQpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGFyZ3MgPSBhY3R1YWxDbWQucmVwbGFjZSgvXm12XFxzKy9pLCBcIlwiKS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID49IDIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzcmMgPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgYXJnc1swXSk7XG4gICAgICAgICAgICAgICAgY29uc3QgZGVzdCA9IHBhdGgucmVzb2x2ZShwcm9qZWN0RGlyLCBhcmdzWzFdKTtcbiAgICAgICAgICAgICAgICBpZiAoIXNyYy5zdGFydHNXaXRoKHByb2plY3REaXIpIHx8ICFkZXN0LnN0YXJ0c1dpdGgocHJvamVjdERpcikpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQYXRoIG91dHNpZGUgcHJvamVjdFwiIH07XG4gICAgICAgICAgICAgICAgdHJ5IHsgZnMucmVuYW1lU3luYyhzcmMsIGRlc3QpOyByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBvdXRwdXQ6IGBNb3ZlZDogJHthcmdzWzBdfSBcdTIxOTIgJHthcmdzWzFdfWAgfTsgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlLm1lc3NhZ2UgfTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9KSgpO1xuXG4gICAgICAgICAgaWYgKG5vZGVIYW5kbGVkKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkobm9kZUhhbmRsZWQpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaXNXaW4gJiYgL15jb3JlcGFja1xccy9pLnRlc3QoYWN0dWFsQ21kKSkge1xuICAgICAgICAgICAgYWN0dWFsQ21kID0gYG5weCAke2FjdHVhbENtZH1gO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGNtZEVudiA9IGlzSW5zdGFsbENtZFxuICAgICAgICAgICAgPyB7IC4uLnByb2Nlc3MuZW52LCBIVVNLWTogXCIwXCIsIG5wbV9jb25maWdfaWdub3JlX3NjcmlwdHM6IFwiXCIsIERJU0FCTEVfT1BFTkNPTExFQ1RJVkU6IFwidHJ1ZVwiLCBBREJMT0NLOiBcIjFcIiB9XG4gICAgICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICAgICAgICBjb25zdCBjbWRUaW1lb3V0ID0gaXNJbnN0YWxsQ21kID8gMTgwMDAwIDogNjAwMDA7XG5cbiAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgZXhlY0FzeW5jKGFjdHVhbENtZCwgeyBjd2Q6IHByb2plY3REaXIsIHRpbWVvdXQ6IGNtZFRpbWVvdXQsIHNoZWxsOiB0cnVlLCBtYXhCdWZmZXI6IDIgKiAxMDI0ICogMTAyNCwgd2luZG93c0hpZGU6IHRydWUsIC4uLihjbWRFbnYgPyB7IGVudjogY21kRW52IH0gOiB7fSkgfSwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgaWYgKGVyciAmJiBpc0luc3RhbGxDbWQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1J1bkNtZF0gSW5zdGFsbCBmYWlsZWQsIHJldHJ5aW5nIHdpdGggLS1pZ25vcmUtc2NyaXB0czogJHtlcnIubWVzc2FnZT8uc2xpY2UoMCwgMjAwKX1gKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXRyeUNtZCA9IGFjdHVhbENtZC5pbmNsdWRlcyhcIi0taWdub3JlLXNjcmlwdHNcIikgPyBhY3R1YWxDbWQgKyBcIiAtLWZvcmNlXCIgOiBhY3R1YWxDbWQgKyBcIiAtLWlnbm9yZS1zY3JpcHRzXCI7XG4gICAgICAgICAgICAgICAgZXhlY0FzeW5jKHJldHJ5Q21kLCB7IGN3ZDogcHJvamVjdERpciwgdGltZW91dDogY21kVGltZW91dCwgc2hlbGw6IHRydWUsIG1heEJ1ZmZlcjogMiAqIDEwMjQgKiAxMDI0LCB3aW5kb3dzSGlkZTogdHJ1ZSwgZW52OiBjbWRFbnYgfSwgKHJldHJ5RXJyLCByZXRyeVN0ZG91dCwgcmV0cnlTdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgICAgICAgICAgaWYgKHJldHJ5RXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IHJldHJ5RXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDUwMCksIG91dHB1dDogKHJldHJ5U3Rkb3V0IHx8IFwiXCIpLnNsaWNlKDAsIDQwMDApLCBzdGRlcnI6IChyZXRyeVN0ZGVyciB8fCBcIlwiKS5zbGljZSgwLCAyMDAwKSwgcmV0cmllZDogdHJ1ZSB9KSk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0OiAocmV0cnlTdGRvdXQgfHwgXCJcIikuc2xpY2UoMCwgNDAwMCksIHJldHJpZWQ6IHRydWUsIG5vdGU6IFwiSW5zdGFsbGVkIHdpdGggLS1pZ25vcmUtc2NyaXB0cyAoc29tZSBwb3N0LWluc3RhbGwgc3RlcHMgd2VyZSBza2lwcGVkKVwiIH0pKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZT8uc2xpY2UoMCwgNTAwKSwgb3V0cHV0OiAoc3Rkb3V0IHx8IFwiXCIpLnNsaWNlKDAsIDQwMDApLCBzdGRlcnI6IChzdGRlcnIgfHwgXCJcIikuc2xpY2UoMCwgMjAwMCkgfSkpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBvdXRwdXQ6IChzdGRvdXQgfHwgXCJcIikuc2xpY2UoMCwgNDAwMCkgfSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIGNvbnN0IHN0ZGVyciA9IGVyci5zdGRlcnIgPyBTdHJpbmcoZXJyLnN0ZGVycikuc2xpY2UoMCwgMjAwMCkgOiBcIlwiO1xuICAgICAgICAgIGNvbnN0IHN0ZG91dCA9IGVyci5zdGRvdXQgPyBTdHJpbmcoZXJyLnN0ZG91dCkuc2xpY2UoMCwgMjAwMCkgOiBcIlwiO1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlPy5zbGljZSgwLCA1MDApLCBvdXRwdXQ6IHN0ZG91dCwgc3RkZXJyIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2dyYW1zL2luc3RhbGxcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBwcm9ncmFtcyB9ID0gSlNPTi5wYXJzZShhd2FpdCByZWFkQm9keShyZXEpKTtcbiAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJvZ3JhbXMpIHx8IHByb2dyYW1zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDA7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiTm8gcHJvZ3JhbXMgc3BlY2lmaWVkXCIgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocHJvZ3JhbXMubGVuZ3RoID4gMTApIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIlRvbyBtYW55IHByb2dyYW1zIChtYXggMTApXCIgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHsgZXhlY1N5bmMgfSA9IGF3YWl0IGltcG9ydChcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgICAgICAgY29uc3QgaXNXaW4gPSBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCI7XG4gICAgICAgICAgY29uc3QgaXNNYWMgPSBwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiO1xuXG4gICAgICAgICAgY29uc3QgcHJvZ3JhbUluc3RhbGxNYXA6IFJlY29yZDxzdHJpbmcsIHsgY2hlY2s6IHN0cmluZzsgd2luQ21kczogc3RyaW5nW107IG1hY0NtZHM6IHN0cmluZ1tdOyBsaW51eENtZHM6IHN0cmluZ1tdOyBsYWJlbDogc3RyaW5nOyBhbHRDaGVja3M/OiBzdHJpbmdbXSB9PiA9IHtcbiAgICAgICAgICAgIFwiZysrXCI6IHsgY2hlY2s6IFwiZysrIC0tdmVyc2lvblwiLCB3aW5DbWRzOiBbXCJ3aW5nZXQgaW5zdGFsbCAtZSAtLWlkIEdudVdpbjMyLk1ha2UgLS1hY2NlcHQtc291cmNlLWFncmVlbWVudHMgLS1hY2NlcHQtcGFja2FnZS1hZ3JlZW1lbnRzXCIsIFwic2Nvb3AgaW5zdGFsbCBnY2NcIiwgXCJjaG9jbyBpbnN0YWxsIG1pbmd3IC15XCJdLCBtYWNDbWRzOiBbXCJ4Y29kZS1zZWxlY3QgLS1pbnN0YWxsXCJdLCBsaW51eENtZHM6IFtcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGcrK1wiXSwgbGFiZWw6IFwiRysrIChDKysgQ29tcGlsZXIpXCIgfSxcbiAgICAgICAgICAgIFwiZ2NjXCI6IHsgY2hlY2s6IFwiZ2NjIC0tdmVyc2lvblwiLCB3aW5DbWRzOiBbXCJzY29vcCBpbnN0YWxsIGdjY1wiLCBcImNob2NvIGluc3RhbGwgbWluZ3cgLXlcIl0sIG1hY0NtZHM6IFtcInhjb2RlLXNlbGVjdCAtLWluc3RhbGxcIl0sIGxpbnV4Q21kczogW1wic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgZ2NjXCJdLCBsYWJlbDogXCJHQ0MgKEMgQ29tcGlsZXIpXCIgfSxcbiAgICAgICAgICAgIFwiY2xhbmdcIjogeyBjaGVjazogXCJjbGFuZyAtLXZlcnNpb25cIiwgd2luQ21kczogW1wid2luZ2V0IGluc3RhbGwgLWUgLS1pZCBMTFZNLkxMVk0gLS1hY2NlcHQtc291cmNlLWFncmVlbWVudHMgLS1hY2NlcHQtcGFja2FnZS1hZ3JlZW1lbnRzXCIsIFwic2Nvb3AgaW5zdGFsbCBsbHZtXCIsIFwiY2hvY28gaW5zdGFsbCBsbHZtIC15XCJdLCBtYWNDbWRzOiBbXCJ4Y29kZS1zZWxlY3QgLS1pbnN0YWxsXCJdLCBsaW51eENtZHM6IFtcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGNsYW5nXCJdLCBsYWJlbDogXCJDbGFuZ1wiIH0sXG4gICAgICAgICAgICBcImNtYWtlXCI6IHsgY2hlY2s6IFwiY21ha2UgLS12ZXJzaW9uXCIsIHdpbkNtZHM6IFtcIndpbmdldCBpbnN0YWxsIC1lIC0taWQgS2l0d2FyZS5DTWFrZSAtLWFjY2VwdC1zb3VyY2UtYWdyZWVtZW50cyAtLWFjY2VwdC1wYWNrYWdlLWFncmVlbWVudHNcIiwgXCJzY29vcCBpbnN0YWxsIGNtYWtlXCIsIFwiY2hvY28gaW5zdGFsbCBjbWFrZSAteVwiXSwgbWFjQ21kczogW1wiYnJldyBpbnN0YWxsIGNtYWtlXCJdLCBsaW51eENtZHM6IFtcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGNtYWtlXCJdLCBsYWJlbDogXCJDTWFrZVwiIH0sXG4gICAgICAgICAgICBcIm1ha2VcIjogeyBjaGVjazogXCJtYWtlIC0tdmVyc2lvblwiLCB3aW5DbWRzOiBbXCJzY29vcCBpbnN0YWxsIG1ha2VcIiwgXCJjaG9jbyBpbnN0YWxsIG1ha2UgLXlcIl0sIG1hY0NtZHM6IFtcInhjb2RlLXNlbGVjdCAtLWluc3RhbGxcIl0sIGxpbnV4Q21kczogW1wic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgbWFrZVwiXSwgbGFiZWw6IFwiTWFrZVwiIH0sXG4gICAgICAgICAgICBcInB5dGhvblwiOiB7IGNoZWNrOiBcInB5dGhvbjMgLS12ZXJzaW9uXCIsIHdpbkNtZHM6IFtcIndpbmdldCBpbnN0YWxsIC1lIC0taWQgUHl0aG9uLlB5dGhvbi4zLjEyIC0tYWNjZXB0LXNvdXJjZS1hZ3JlZW1lbnRzIC0tYWNjZXB0LXBhY2thZ2UtYWdyZWVtZW50c1wiLCBcInNjb29wIGluc3RhbGwgcHl0aG9uXCIsIFwiY2hvY28gaW5zdGFsbCBweXRob24gLXlcIl0sIG1hY0NtZHM6IFtcImJyZXcgaW5zdGFsbCBweXRob24zXCJdLCBsaW51eENtZHM6IFtcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IHB5dGhvbjNcIl0sIGxhYmVsOiBcIlB5dGhvbiAzXCIsIGFsdENoZWNrczogW1wicHl0aG9uIC0tdmVyc2lvblwiXSB9LFxuICAgICAgICAgICAgXCJweXRob24zXCI6IHsgY2hlY2s6IFwicHl0aG9uMyAtLXZlcnNpb25cIiwgd2luQ21kczogW1wid2luZ2V0IGluc3RhbGwgLWUgLS1pZCBQeXRob24uUHl0aG9uLjMuMTIgLS1hY2NlcHQtc291cmNlLWFncmVlbWVudHMgLS1hY2NlcHQtcGFja2FnZS1hZ3JlZW1lbnRzXCIsIFwic2Nvb3AgaW5zdGFsbCBweXRob25cIiwgXCJjaG9jbyBpbnN0YWxsIHB5dGhvbiAteVwiXSwgbWFjQ21kczogW1wiYnJldyBpbnN0YWxsIHB5dGhvbjNcIl0sIGxpbnV4Q21kczogW1wic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgcHl0aG9uM1wiXSwgbGFiZWw6IFwiUHl0aG9uIDNcIiwgYWx0Q2hlY2tzOiBbXCJweXRob24gLS12ZXJzaW9uXCJdIH0sXG4gICAgICAgICAgICBcInBpcFwiOiB7IGNoZWNrOiBcInBpcDMgLS12ZXJzaW9uXCIsIHdpbkNtZHM6IFtcInB5dGhvbiAtbSBlbnN1cmVwaXBcIiwgXCJweXRob24zIC1tIGVuc3VyZXBpcFwiXSwgbWFjQ21kczogW1wicHl0aG9uMyAtbSBlbnN1cmVwaXBcIl0sIGxpbnV4Q21kczogW1wic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgcHl0aG9uMy1waXBcIl0sIGxhYmVsOiBcIlBpcFwiLCBhbHRDaGVja3M6IFtcInBpcCAtLXZlcnNpb25cIl0gfSxcbiAgICAgICAgICAgIFwicGlwM1wiOiB7IGNoZWNrOiBcInBpcDMgLS12ZXJzaW9uXCIsIHdpbkNtZHM6IFtcInB5dGhvbiAtbSBlbnN1cmVwaXBcIiwgXCJweXRob24zIC1tIGVuc3VyZXBpcFwiXSwgbWFjQ21kczogW1wicHl0aG9uMyAtbSBlbnN1cmVwaXBcIl0sIGxpbnV4Q21kczogW1wic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgcHl0aG9uMy1waXBcIl0sIGxhYmVsOiBcIlBpcCAzXCIsIGFsdENoZWNrczogW1wicGlwIC0tdmVyc2lvblwiXSB9LFxuICAgICAgICAgICAgXCJub2RlXCI6IHsgY2hlY2s6IFwibm9kZSAtLXZlcnNpb25cIiwgd2luQ21kczogW1wid2luZ2V0IGluc3RhbGwgLWUgLS1pZCBPcGVuSlMuTm9kZUpTLkxUUyAtLWFjY2VwdC1zb3VyY2UtYWdyZWVtZW50cyAtLWFjY2VwdC1wYWNrYWdlLWFncmVlbWVudHNcIiwgXCJzY29vcCBpbnN0YWxsIG5vZGVqcy1sdHNcIiwgXCJjaG9jbyBpbnN0YWxsIG5vZGVqcyAteVwiXSwgbWFjQ21kczogW1wiYnJldyBpbnN0YWxsIG5vZGVcIl0sIGxpbnV4Q21kczogW1wiY3VybCAtZnNTTCBodHRwczovL2RlYi5ub2Rlc291cmNlLmNvbS9zZXR1cF9sdHMueCB8IHN1ZG8gLUUgYmFzaCAtICYmIHN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IG5vZGVqc1wiXSwgbGFiZWw6IFwiTm9kZS5qc1wiIH0sXG4gICAgICAgICAgICBcIm5vZGVqc1wiOiB7IGNoZWNrOiBcIm5vZGUgLS12ZXJzaW9uXCIsIHdpbkNtZHM6IFtcIndpbmdldCBpbnN0YWxsIC1lIC0taWQgT3BlbkpTLk5vZGVKUy5MVFMgLS1hY2NlcHQtc291cmNlLWFncmVlbWVudHMgLS1hY2NlcHQtcGFja2FnZS1hZ3JlZW1lbnRzXCIsIFwic2Nvb3AgaW5zdGFsbCBub2RlanMtbHRzXCIsIFwiY2hvY28gaW5zdGFsbCBub2RlanMgLXlcIl0sIG1hY0NtZHM6IFtcImJyZXcgaW5zdGFsbCBub2RlXCJdLCBsaW51eENtZHM6IFtcImN1cmwgLWZzU0wgaHR0cHM6Ly9kZWIubm9kZXNvdXJjZS5jb20vc2V0dXBfbHRzLnggfCBzdWRvIC1FIGJhc2ggLSAmJiBzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBub2RlanNcIl0sIGxhYmVsOiBcIk5vZGUuanNcIiB9LFxuICAgICAgICAgICAgXCJub2RlLmpzXCI6IHsgY2hlY2s6IFwibm9kZSAtLXZlcnNpb25cIiwgd2luQ21kczogW1wid2luZ2V0IGluc3RhbGwgLWUgLS1pZCBPcGVuSlMuTm9kZUpTLkxUUyAtLWFjY2VwdC1zb3VyY2UtYWdyZWVtZW50cyAtLWFjY2VwdC1wYWNrYWdlLWFncmVlbWVudHNcIiwgXCJzY29vcCBpbnN0YWxsIG5vZGVqcy1sdHNcIiwgXCJjaG9jbyBpbnN0YWxsIG5vZGVqcyAteVwiXSwgbWFjQ21kczogW1wiYnJldyBpbnN0YWxsIG5vZGVcIl0sIGxpbnV4Q21kczogW1wiY3VybCAtZnNTTCBodHRwczovL2RlYi5ub2Rlc291cmNlLmNvbS9zZXR1cF9sdHMueCB8IHN1ZG8gLUUgYmFzaCAtICYmIHN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IG5vZGVqc1wiXSwgbGFiZWw6IFwiTm9kZS5qc1wiIH0sXG4gICAgICAgICAgICBcInJ1c3RcIjogeyBjaGVjazogXCJydXN0YyAtLXZlcnNpb25cIiwgd2luQ21kczogW1wid2luZ2V0IGluc3RhbGwgLWUgLS1pZCBSdXN0bGFuZy5SdXN0dXAgLS1hY2NlcHQtc291cmNlLWFncmVlbWVudHMgLS1hY2NlcHQtcGFja2FnZS1hZ3JlZW1lbnRzXCIsIFwic2Nvb3AgaW5zdGFsbCBydXN0dXBcIiwgXCJjaG9jbyBpbnN0YWxsIHJ1c3QgLXlcIl0sIG1hY0NtZHM6IFtcImN1cmwgLS1wcm90byAnPWh0dHBzJyAtLXRsc3YxLjIgLXNTZiBodHRwczovL3NoLnJ1c3R1cC5ycyB8IHNoIC1zIC0tIC15XCJdLCBsaW51eENtZHM6IFtcImN1cmwgLS1wcm90byAnPWh0dHBzJyAtLXRsc3YxLjIgLXNTZiBodHRwczovL3NoLnJ1c3R1cC5ycyB8IHNoIC1zIC0tIC15XCJdLCBsYWJlbDogXCJSdXN0XCIgfSxcbiAgICAgICAgICAgIFwicnVzdGNcIjogeyBjaGVjazogXCJydXN0YyAtLXZlcnNpb25cIiwgd2luQ21kczogW1wid2luZ2V0IGluc3RhbGwgLWUgLS1pZCBSdXN0bGFuZy5SdXN0dXAgLS1hY2NlcHQtc291cmNlLWFncmVlbWVudHMgLS1hY2NlcHQtcGFja2FnZS1hZ3JlZW1lbnRzXCIsIFwic2Nvb3AgaW5zdGFsbCBydXN0dXBcIiwgXCJjaG9jbyBpbnN0YWxsIHJ1c3QgLXlcIl0sIG1hY0NtZHM6IFtcImN1cmwgLS1wcm90byAnPWh0dHBzJyAtLXRsc3YxLjIgLXNTZiBodHRwczovL3NoLnJ1c3R1cC5ycyB8IHNoIC1zIC0tIC15XCJdLCBsaW51eENtZHM6IFtcImN1cmwgLS1wcm90byAnPWh0dHBzJyAtLXRsc3YxLjIgLXNTZiBodHRwczovL3NoLnJ1c3R1cC5ycyB8IHNoIC1zIC0tIC15XCJdLCBsYWJlbDogXCJSdXN0XCIgfSxcbiAgICAgICAgICAgIFwiY2FyZ29cIjogeyBjaGVjazogXCJjYXJnbyAtLXZlcnNpb25cIiwgd2luQ21kczogW1wid2luZ2V0IGluc3RhbGwgLWUgLS1pZCBSdXN0bGFuZy5SdXN0dXAgLS1hY2NlcHQtc291cmNlLWFncmVlbWVudHMgLS1hY2NlcHQtcGFja2FnZS1hZ3JlZW1lbnRzXCIsIFwic2Nvb3AgaW5zdGFsbCBydXN0dXBcIiwgXCJjaG9jbyBpbnN0YWxsIHJ1c3QgLXlcIl0sIG1hY0NtZHM6IFtcImN1cmwgLS1wcm90byAnPWh0dHBzJyAtLXRsc3YxLjIgLXNTZiBodHRwczovL3NoLnJ1c3R1cC5ycyB8IHNoIC1zIC0tIC15XCJdLCBsaW51eENtZHM6IFtcImN1cmwgLS1wcm90byAnPWh0dHBzJyAtLXRsc3YxLjIgLXNTZiBodHRwczovL3NoLnJ1c3R1cC5ycyB8IHNoIC1zIC0tIC15XCJdLCBsYWJlbDogXCJDYXJnbyAoUnVzdClcIiB9LFxuICAgICAgICAgICAgXCJnb1wiOiB7IGNoZWNrOiBcImdvIHZlcnNpb25cIiwgd2luQ21kczogW1wid2luZ2V0IGluc3RhbGwgLWUgLS1pZCBHb0xhbmcuR28gLS1hY2NlcHQtc291cmNlLWFncmVlbWVudHMgLS1hY2NlcHQtcGFja2FnZS1hZ3JlZW1lbnRzXCIsIFwic2Nvb3AgaW5zdGFsbCBnb1wiLCBcImNob2NvIGluc3RhbGwgZ29sYW5nIC15XCJdLCBtYWNDbWRzOiBbXCJicmV3IGluc3RhbGwgZ29cIl0sIGxpbnV4Q21kczogW1wic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgZ29sYW5nXCJdLCBsYWJlbDogXCJHb1wiIH0sXG4gICAgICAgICAgICBcImdvbGFuZ1wiOiB7IGNoZWNrOiBcImdvIHZlcnNpb25cIiwgd2luQ21kczogW1wid2luZ2V0IGluc3RhbGwgLWUgLS1pZCBHb0xhbmcuR28gLS1hY2NlcHQtc291cmNlLWFncmVlbWVudHMgLS1hY2NlcHQtcGFja2FnZS1hZ3JlZW1lbnRzXCIsIFwic2Nvb3AgaW5zdGFsbCBnb1wiLCBcImNob2NvIGluc3RhbGwgZ29sYW5nIC15XCJdLCBtYWNDbWRzOiBbXCJicmV3IGluc3RhbGwgZ29cIl0sIGxpbnV4Q21kczogW1wic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgZ29sYW5nXCJdLCBsYWJlbDogXCJHb1wiIH0sXG4gICAgICAgICAgICBcImphdmFcIjogeyBjaGVjazogXCJqYXZhIC12ZXJzaW9uXCIsIHdpbkNtZHM6IFtcIndpbmdldCBpbnN0YWxsIC1lIC0taWQgTWljcm9zb2Z0Lk9wZW5KREsuMjEgLS1hY2NlcHQtc291cmNlLWFncmVlbWVudHMgLS1hY2NlcHQtcGFja2FnZS1hZ3JlZW1lbnRzXCIsIFwic2Nvb3AgaW5zdGFsbCBvcGVuamRrXCIsIFwiY2hvY28gaW5zdGFsbCBvcGVuamRrIC15XCJdLCBtYWNDbWRzOiBbXCJicmV3IGluc3RhbGwgb3Blbmpka1wiXSwgbGludXhDbWRzOiBbXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBkZWZhdWx0LWpka1wiXSwgbGFiZWw6IFwiSmF2YSAoSkRLKVwiIH0sXG4gICAgICAgICAgICBcImpka1wiOiB7IGNoZWNrOiBcImphdmEgLXZlcnNpb25cIiwgd2luQ21kczogW1wid2luZ2V0IGluc3RhbGwgLWUgLS1pZCBNaWNyb3NvZnQuT3BlbkpESy4yMSAtLWFjY2VwdC1zb3VyY2UtYWdyZWVtZW50cyAtLWFjY2VwdC1wYWNrYWdlLWFncmVlbWVudHNcIiwgXCJzY29vcCBpbnN0YWxsIG9wZW5qZGtcIiwgXCJjaG9jbyBpbnN0YWxsIG9wZW5qZGsgLXlcIl0sIG1hY0NtZHM6IFtcImJyZXcgaW5zdGFsbCBvcGVuamRrXCJdLCBsaW51eENtZHM6IFtcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGRlZmF1bHQtamRrXCJdLCBsYWJlbDogXCJKYXZhIChKREspXCIgfSxcbiAgICAgICAgICAgIFwiZG9ja2VyXCI6IHsgY2hlY2s6IFwiZG9ja2VyIC0tdmVyc2lvblwiLCB3aW5DbWRzOiBbXCJ3aW5nZXQgaW5zdGFsbCAtZSAtLWlkIERvY2tlci5Eb2NrZXJEZXNrdG9wIC0tYWNjZXB0LXNvdXJjZS1hZ3JlZW1lbnRzIC0tYWNjZXB0LXBhY2thZ2UtYWdyZWVtZW50c1wiLCBcImNob2NvIGluc3RhbGwgZG9ja2VyLWRlc2t0b3AgLXlcIl0sIG1hY0NtZHM6IFtcImJyZXcgaW5zdGFsbCAtLWNhc2sgZG9ja2VyXCJdLCBsaW51eENtZHM6IFtcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGRvY2tlci5pb1wiXSwgbGFiZWw6IFwiRG9ja2VyXCIgfSxcbiAgICAgICAgICAgIFwiZ2l0XCI6IHsgY2hlY2s6IFwiZ2l0IC0tdmVyc2lvblwiLCB3aW5DbWRzOiBbXCJ3aW5nZXQgaW5zdGFsbCAtZSAtLWlkIEdpdC5HaXQgLS1hY2NlcHQtc291cmNlLWFncmVlbWVudHMgLS1hY2NlcHQtcGFja2FnZS1hZ3JlZW1lbnRzXCIsIFwic2Nvb3AgaW5zdGFsbCBnaXRcIiwgXCJjaG9jbyBpbnN0YWxsIGdpdCAteVwiXSwgbWFjQ21kczogW1wiYnJldyBpbnN0YWxsIGdpdFwiXSwgbGludXhDbWRzOiBbXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBnaXRcIl0sIGxhYmVsOiBcIkdpdFwiIH0sXG4gICAgICAgICAgICBcImN1cmxcIjogeyBjaGVjazogXCJjdXJsIC0tdmVyc2lvblwiLCB3aW5DbWRzOiBbXCJzY29vcCBpbnN0YWxsIGN1cmxcIiwgXCJjaG9jbyBpbnN0YWxsIGN1cmwgLXlcIl0sIG1hY0NtZHM6IFtcImJyZXcgaW5zdGFsbCBjdXJsXCJdLCBsaW51eENtZHM6IFtcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGN1cmxcIl0sIGxhYmVsOiBcImNVUkxcIiB9LFxuICAgICAgICAgICAgXCJ3Z2V0XCI6IHsgY2hlY2s6IFwid2dldCAtLXZlcnNpb25cIiwgd2luQ21kczogW1wic2Nvb3AgaW5zdGFsbCB3Z2V0XCIsIFwiY2hvY28gaW5zdGFsbCB3Z2V0IC15XCJdLCBtYWNDbWRzOiBbXCJicmV3IGluc3RhbGwgd2dldFwiXSwgbGludXhDbWRzOiBbXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSB3Z2V0XCJdLCBsYWJlbDogXCJXZ2V0XCIgfSxcbiAgICAgICAgICAgIFwiZmZtcGVnXCI6IHsgY2hlY2s6IFwiZmZtcGVnIC12ZXJzaW9uXCIsIHdpbkNtZHM6IFtcIndpbmdldCBpbnN0YWxsIC1lIC0taWQgR3lhbi5GRm1wZWcgLS1hY2NlcHQtc291cmNlLWFncmVlbWVudHMgLS1hY2NlcHQtcGFja2FnZS1hZ3JlZW1lbnRzXCIsIFwic2Nvb3AgaW5zdGFsbCBmZm1wZWdcIiwgXCJjaG9jbyBpbnN0YWxsIGZmbXBlZyAteVwiXSwgbWFjQ21kczogW1wiYnJldyBpbnN0YWxsIGZmbXBlZ1wiXSwgbGludXhDbWRzOiBbXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBmZm1wZWdcIl0sIGxhYmVsOiBcIkZGbXBlZ1wiIH0sXG4gICAgICAgICAgICBcImltYWdlbWFnaWNrXCI6IHsgY2hlY2s6IFwiY29udmVydCAtLXZlcnNpb25cIiwgd2luQ21kczogW1wid2luZ2V0IGluc3RhbGwgLWUgLS1pZCBJbWFnZU1hZ2ljay5JbWFnZU1hZ2ljayAtLWFjY2VwdC1zb3VyY2UtYWdyZWVtZW50cyAtLWFjY2VwdC1wYWNrYWdlLWFncmVlbWVudHNcIiwgXCJzY29vcCBpbnN0YWxsIGltYWdlbWFnaWNrXCIsIFwiY2hvY28gaW5zdGFsbCBpbWFnZW1hZ2ljayAteVwiXSwgbWFjQ21kczogW1wiYnJldyBpbnN0YWxsIGltYWdlbWFnaWNrXCJdLCBsaW51eENtZHM6IFtcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IGltYWdlbWFnaWNrXCJdLCBsYWJlbDogXCJJbWFnZU1hZ2lja1wiLCBhbHRDaGVja3M6IFtcIm1hZ2ljayAtLXZlcnNpb25cIl0gfSxcbiAgICAgICAgICAgIFwic3FsaXRlM1wiOiB7IGNoZWNrOiBcInNxbGl0ZTMgLS12ZXJzaW9uXCIsIHdpbkNtZHM6IFtcInNjb29wIGluc3RhbGwgc3FsaXRlXCIsIFwiY2hvY28gaW5zdGFsbCBzcWxpdGUgLXlcIl0sIG1hY0NtZHM6IFtcImJyZXcgaW5zdGFsbCBzcWxpdGVcIl0sIGxpbnV4Q21kczogW1wic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgc3FsaXRlM1wiXSwgbGFiZWw6IFwiU1FMaXRlXCIgfSxcbiAgICAgICAgICAgIFwicG9zdGdyZXNxbFwiOiB7IGNoZWNrOiBcInBzcWwgLS12ZXJzaW9uXCIsIHdpbkNtZHM6IFtcIndpbmdldCBpbnN0YWxsIC1lIC0taWQgUG9zdGdyZVNRTC5Qb3N0Z3JlU1FMIC0tYWNjZXB0LXNvdXJjZS1hZ3JlZW1lbnRzIC0tYWNjZXB0LXBhY2thZ2UtYWdyZWVtZW50c1wiLCBcInNjb29wIGluc3RhbGwgcG9zdGdyZXNxbFwiLCBcImNob2NvIGluc3RhbGwgcG9zdGdyZXNxbCAteVwiXSwgbWFjQ21kczogW1wiYnJldyBpbnN0YWxsIHBvc3RncmVzcWxcIl0sIGxpbnV4Q21kczogW1wic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgcG9zdGdyZXNxbFwiXSwgbGFiZWw6IFwiUG9zdGdyZVNRTFwiIH0sXG4gICAgICAgICAgICBcInJlZGlzXCI6IHsgY2hlY2s6IFwicmVkaXMtc2VydmVyIC0tdmVyc2lvblwiLCB3aW5DbWRzOiBbXCJzY29vcCBpbnN0YWxsIHJlZGlzXCIsIFwiY2hvY28gaW5zdGFsbCByZWRpcyAteVwiXSwgbWFjQ21kczogW1wiYnJldyBpbnN0YWxsIHJlZGlzXCJdLCBsaW51eENtZHM6IFtcInN1ZG8gYXB0LWdldCBpbnN0YWxsIC15IHJlZGlzLXNlcnZlclwiXSwgbGFiZWw6IFwiUmVkaXNcIiB9LFxuICAgICAgICAgICAgXCJkZW5vXCI6IHsgY2hlY2s6IFwiZGVubyAtLXZlcnNpb25cIiwgd2luQ21kczogW1wid2luZ2V0IGluc3RhbGwgLWUgLS1pZCBEZW5vTGFuZC5EZW5vIC0tYWNjZXB0LXNvdXJjZS1hZ3JlZW1lbnRzIC0tYWNjZXB0LXBhY2thZ2UtYWdyZWVtZW50c1wiLCBcInNjb29wIGluc3RhbGwgZGVub1wiLCBcImNob2NvIGluc3RhbGwgZGVubyAteVwiXSwgbWFjQ21kczogW1wiYnJldyBpbnN0YWxsIGRlbm9cIl0sIGxpbnV4Q21kczogW1wiY3VybCAtZnNTTCBodHRwczovL2Rlbm8ubGFuZC9pbnN0YWxsLnNoIHwgc2hcIl0sIGxhYmVsOiBcIkRlbm9cIiB9LFxuICAgICAgICAgICAgXCJidW5cIjogeyBjaGVjazogXCJidW4gLS12ZXJzaW9uXCIsIHdpbkNtZHM6IFtcInBvd2Vyc2hlbGwgLWMgXFxcImlybSBidW4uc2gvaW5zdGFsbC5wczF8aWV4XFxcIlwiLCBcInNjb29wIGluc3RhbGwgYnVuXCJdLCBtYWNDbWRzOiBbXCJjdXJsIC1mc1NMIGh0dHBzOi8vYnVuLnNoL2luc3RhbGwgfCBiYXNoXCJdLCBsaW51eENtZHM6IFtcImN1cmwgLWZzU0wgaHR0cHM6Ly9idW4uc2gvaW5zdGFsbCB8IGJhc2hcIl0sIGxhYmVsOiBcIkJ1blwiIH0sXG4gICAgICAgICAgICBcInJ1YnlcIjogeyBjaGVjazogXCJydWJ5IC0tdmVyc2lvblwiLCB3aW5DbWRzOiBbXCJ3aW5nZXQgaW5zdGFsbCAtZSAtLWlkIFJ1YnlJbnN0YWxsZXJUZWFtLlJ1YnkuMy4yIC0tYWNjZXB0LXNvdXJjZS1hZ3JlZW1lbnRzIC0tYWNjZXB0LXBhY2thZ2UtYWdyZWVtZW50c1wiLCBcInNjb29wIGluc3RhbGwgcnVieVwiLCBcImNob2NvIGluc3RhbGwgcnVieSAteVwiXSwgbWFjQ21kczogW1wiYnJldyBpbnN0YWxsIHJ1YnlcIl0sIGxpbnV4Q21kczogW1wic3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgcnVieVwiXSwgbGFiZWw6IFwiUnVieVwiIH0sXG4gICAgICAgICAgICBcInBocFwiOiB7IGNoZWNrOiBcInBocCAtLXZlcnNpb25cIiwgd2luQ21kczogW1wic2Nvb3AgaW5zdGFsbCBwaHBcIiwgXCJjaG9jbyBpbnN0YWxsIHBocCAteVwiXSwgbWFjQ21kczogW1wiYnJldyBpbnN0YWxsIHBocFwiXSwgbGludXhDbWRzOiBbXCJzdWRvIGFwdC1nZXQgaW5zdGFsbCAteSBwaHBcIl0sIGxhYmVsOiBcIlBIUFwiIH0sXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IHsgcHJvZ3JhbTogc3RyaW5nOyBsYWJlbDogc3RyaW5nOyBhbHJlYWR5SW5zdGFsbGVkOiBib29sZWFuOyBpbnN0YWxsZWQ6IGJvb2xlYW47IGVycm9yPzogc3RyaW5nOyBjb21tYW5kPzogc3RyaW5nIH1bXSA9IFtdO1xuXG4gICAgICAgICAgZnVuY3Rpb24gdHJ5RXhlYyhjbWQ6IHN0cmluZywgdGltZW91dCA9IDEwMDAwKTogYm9vbGVhbiB7XG4gICAgICAgICAgICB0cnkgeyBleGVjU3luYyhjbWQsIHsgdGltZW91dCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSwgd2luZG93c0hpZGU6IHRydWUgfSk7IHJldHVybiB0cnVlOyB9IGNhdGNoIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZm9yIChjb25zdCBwcm9nIG9mIHByb2dyYW1zKSB7XG4gICAgICAgICAgICBjb25zdCBrZXkgPSBwcm9nLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTkuK10vZywgXCJcIik7XG4gICAgICAgICAgICBjb25zdCBtYXBwaW5nID0gcHJvZ3JhbUluc3RhbGxNYXBba2V5XTtcbiAgICAgICAgICAgIGlmICghbWFwcGluZykge1xuICAgICAgICAgICAgICByZXN1bHRzLnB1c2goeyBwcm9ncmFtOiBwcm9nLCBsYWJlbDogcHJvZywgYWxyZWFkeUluc3RhbGxlZDogZmFsc2UsIGluc3RhbGxlZDogZmFsc2UsIGVycm9yOiBgVW5rbm93biBwcm9ncmFtOiAke3Byb2d9YCB9KTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBhbHJlYWR5SW5zdGFsbGVkID0gdHJ5RXhlYyhtYXBwaW5nLmNoZWNrKTtcbiAgICAgICAgICAgIGlmICghYWxyZWFkeUluc3RhbGxlZCAmJiBtYXBwaW5nLmFsdENoZWNrcykge1xuICAgICAgICAgICAgICBhbHJlYWR5SW5zdGFsbGVkID0gbWFwcGluZy5hbHRDaGVja3Muc29tZShjID0+IHRyeUV4ZWMoYykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFhbHJlYWR5SW5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHdoaWNoQ21kID0gaXNXaW4gPyBgd2hlcmUgJHtrZXl9YCA6IGB3aGljaCAke2tleX1gO1xuICAgICAgICAgICAgICBhbHJlYWR5SW5zdGFsbGVkID0gdHJ5RXhlYyh3aGljaENtZCwgNTAwMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhbHJlYWR5SW5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7IHByb2dyYW06IHByb2csIGxhYmVsOiBtYXBwaW5nLmxhYmVsLCBhbHJlYWR5SW5zdGFsbGVkOiB0cnVlLCBpbnN0YWxsZWQ6IHRydWUgfSk7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBpbnN0YWxsQ21kcyA9IGlzV2luID8gbWFwcGluZy53aW5DbWRzIDogaXNNYWMgPyBtYXBwaW5nLm1hY0NtZHMgOiBtYXBwaW5nLmxpbnV4Q21kcztcbiAgICAgICAgICAgIGlmICghaW5zdGFsbENtZHMgfHwgaW5zdGFsbENtZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7IHByb2dyYW06IHByb2csIGxhYmVsOiBtYXBwaW5nLmxhYmVsLCBhbHJlYWR5SW5zdGFsbGVkOiBmYWxzZSwgaW5zdGFsbGVkOiBmYWxzZSwgZXJyb3I6IGBObyBpbnN0YWxsIGNvbW1hbmQgZm9yIHRoaXMgcGxhdGZvcm1gIH0pO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGluc3RhbGxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgbGV0IGxhc3RFcnIgPSBcIlwiO1xuICAgICAgICAgICAgbGV0IHVzZWRDbWQgPSBcIlwiO1xuICAgICAgICAgICAgZm9yIChjb25zdCBjbWQgb2YgaW5zdGFsbENtZHMpIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBleGVjU3luYyhjbWQsIHsgdGltZW91dDogMTgwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHNoZWxsOiB0cnVlLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICBpbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHVzZWRDbWQgPSBjbWQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgbGFzdEVyciA9IGVyci5tZXNzYWdlPy5zbGljZSgwLCAxNTApIHx8IFwiZmFpbGVkXCI7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtQcm9ncmFtc10gJHttYXBwaW5nLmxhYmVsfTogJyR7Y21kfScgZmFpbGVkLCB0cnlpbmcgbmV4dC4uLmApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChpbnN0YWxsZWQpIHtcbiAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHsgcHJvZ3JhbTogcHJvZywgbGFiZWw6IG1hcHBpbmcubGFiZWwsIGFscmVhZHlJbnN0YWxsZWQ6IGZhbHNlLCBpbnN0YWxsZWQ6IHRydWUsIGNvbW1hbmQ6IHVzZWRDbWQgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXN1bHRzLnB1c2goeyBwcm9ncmFtOiBwcm9nLCBsYWJlbDogbWFwcGluZy5sYWJlbCwgYWxyZWFkeUluc3RhbGxlZDogZmFsc2UsIGluc3RhbGxlZDogZmFsc2UsIGVycm9yOiBgQWxsIGluc3RhbGwgbWV0aG9kcyBmYWlsZWQuIExhc3Q6ICR7bGFzdEVycn1gLCBjb21tYW5kOiBpbnN0YWxsQ21kc1tpbnN0YWxsQ21kcy5sZW5ndGggLSAxXSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICBjb25zdCBhbGxPayA9IHJlc3VsdHMuZXZlcnkociA9PiByLmluc3RhbGxlZCB8fCByLmFscmVhZHlJbnN0YWxsZWQpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBhbGxPaywgcmVzdWx0cyB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy9pbXBvcnQtZ2l0aHViXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJQT1NUXCIpIHsgcmVzLnN0YXR1c0NvZGUgPSA0MDU7IHJlcy5lbmQoXCJNZXRob2Qgbm90IGFsbG93ZWRcIik7IHJldHVybjsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgb3duZXIsIHJlcG8sIHRhcmdldFByb2plY3QgfSA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEJvZHkocmVxKSk7XG4gICAgICAgICAgaWYgKCFvd25lciB8fCAhcmVwbyB8fCAvW1xcL1xcXFxdfFxcLlxcLi8udGVzdChvd25lcikgfHwgL1tcXC9cXFxcXXxcXC5cXC4vLnRlc3QocmVwbykpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IFwiSW52YWxpZCBvd25lciBvciByZXBvXCIgfSkpOyByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0YXJnZXRQcm9qZWN0ICYmIC9bXFwvXFxcXF18XFwuXFwuLy50ZXN0KHRhcmdldFByb2plY3QpKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwMDsgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIkludmFsaWQgdGFyZ2V0IHByb2plY3QgbmFtZVwiIH0pKTsgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgY29uc3QgeyBleGVjU3luYyB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICBjb25zdCBvcyA9IGF3YWl0IGltcG9ydChcIm9zXCIpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3RzRGlyID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIFwicHJvamVjdHNcIik7XG4gICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHByb2plY3RzRGlyKSkgZnMubWtkaXJTeW5jKHByb2plY3RzRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuICAgICAgICAgIGNvbnN0IHByb2plY3ROYW1lID0gdGFyZ2V0UHJvamVjdCB8fCByZXBvLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTktXS9nLCAnLScpO1xuICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLnJlc29sdmUocHJvamVjdHNEaXIsIHByb2plY3ROYW1lKTtcblxuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHByb2plY3REaXIpICYmICF0YXJnZXRQcm9qZWN0KSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwOTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogYFByb2plY3QgJyR7cHJvamVjdE5hbWV9JyBhbHJlYWR5IGV4aXN0cy4gRGVsZXRlIGl0IGZpcnN0IG9yIHVzZSBhIGRpZmZlcmVudCBuYW1lLmAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodGFyZ2V0UHJvamVjdCAmJiBmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBmcy5ybVN5bmMocHJvamVjdERpciwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gUmVtb3ZlZCBleGlzdGluZyBwcm9qZWN0IGRpcmVjdG9yeSAnJHtwcm9qZWN0TmFtZX0nYCk7XG4gICAgICAgICAgICB9IGNhdGNoIChybUVycjogYW55KSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbSW1wb3J0XSBGdWxsIHJtIGZhaWxlZCAoJHtybUVyci5tZXNzYWdlPy5zbGljZSgwLCAxMDApfSksIGNsZWFyaW5nIGNvbnRlbnRzIGluc3RlYWRgKTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ0ZpbGVzID0gZnMucmVhZGRpclN5bmMocHJvamVjdERpcik7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBmIG9mIGV4aXN0aW5nRmlsZXMpIHtcbiAgICAgICAgICAgICAgICAgIHRyeSB7IGZzLnJtU3luYyhwYXRoLmpvaW4ocHJvamVjdERpciwgZiksIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIENsZWFyZWQgZXhpc3RpbmcgcHJvamVjdCAnJHtwcm9qZWN0TmFtZX0nIGZvciBjbG9uZSBpbnRvYCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZ2hUb2tlbiA9IHByb2Nlc3MuZW52LkdJVEhVQl9UT0tFTiB8fCBcIlwiO1xuICAgICAgICAgIGNvbnN0IGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7IFwiVXNlci1BZ2VudFwiOiBcIkxhbWJ5XCIgfTtcbiAgICAgICAgICBpZiAoZ2hUb2tlbikgaGVhZGVyc1tcIkF1dGhvcml6YXRpb25cIl0gPSBgdG9rZW4gJHtnaFRva2VufWA7XG5cbiAgICAgICAgICBsZXQgZGVmYXVsdEJyYW5jaCA9IFwibWFpblwiO1xuICAgICAgICAgIGxldCBhcGlBdmFpbGFibGUgPSBmYWxzZTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgaW5mb1Jlc3AgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy8ke293bmVyfS8ke3JlcG99YCwgeyBoZWFkZXJzOiB7IC4uLmhlYWRlcnMsIFwiQWNjZXB0XCI6IFwiYXBwbGljYXRpb24vdm5kLmdpdGh1Yi52Mytqc29uXCIgfSB9KTtcbiAgICAgICAgICAgIGlmIChpbmZvUmVzcC5vaykge1xuICAgICAgICAgICAgICBjb25zdCByZXBvSW5mbzogYW55ID0gYXdhaXQgaW5mb1Jlc3AuanNvbigpO1xuICAgICAgICAgICAgICBkZWZhdWx0QnJhbmNoID0gcmVwb0luZm8uZGVmYXVsdF9icmFuY2ggfHwgXCJtYWluXCI7XG4gICAgICAgICAgICAgIGFwaUF2YWlsYWJsZSA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gR2l0SHViIEFQSSByZXR1cm5lZCAke2luZm9SZXNwLnN0YXR1c30gZm9yICR7b3duZXJ9LyR7cmVwb30sIHdpbGwgdHJ5IGdpdCBjbG9uZSBkaXJlY3RseWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGFwaUVycjogYW55KSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gR2l0SHViIEFQSSByZXF1ZXN0IGZhaWxlZCBmb3IgJHtvd25lcn0vJHtyZXBvfTogJHthcGlFcnIubWVzc2FnZT8uc2xpY2UoMCwgMTAwKX0sIHdpbGwgdHJ5IGdpdCBjbG9uZSBkaXJlY3RseWApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IE1BWF9UQVJCQUxMX1NJWkUgPSAyMDAgKiAxMDI0ICogMTAyNDtcbiAgICAgICAgICBjb25zdCB0bXBEaXIgPSBmcy5ta2R0ZW1wU3luYyhwYXRoLmpvaW4ob3MudG1wZGlyKCksIFwibGFtYnktaW1wb3J0LVwiKSk7XG4gICAgICAgICAgbGV0IGNsb25lTWV0aG9kID0gXCJ0YXJiYWxsXCI7XG4gICAgICAgICAgdHJ5IHtcblxuICAgICAgICAgIGxldCB0YXJiYWxsU3VjY2VzcyA9IGZhbHNlO1xuICAgICAgICAgIGlmIChhcGlBdmFpbGFibGUpIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gRG93bmxvYWRpbmcgdGFyYmFsbCBmb3IgJHtvd25lcn0vJHtyZXBvfSAoYnJhbmNoOiAke2RlZmF1bHRCcmFuY2h9KS4uLmApO1xuICAgICAgICAgICAgY29uc3QgdGFyYmFsbFVybCA9IGBodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zLyR7b3duZXJ9LyR7cmVwb30vdGFyYmFsbC8ke2VuY29kZVVSSUNvbXBvbmVudChkZWZhdWx0QnJhbmNoKX1gO1xuICAgICAgICAgICAgY29uc3QgdGFyUmVzcCA9IGF3YWl0IGZldGNoKHRhcmJhbGxVcmwsIHsgaGVhZGVyczogeyAuLi5oZWFkZXJzLCBcIkFjY2VwdFwiOiBcImFwcGxpY2F0aW9uL3ZuZC5naXRodWIudjMranNvblwiIH0sIHJlZGlyZWN0OiBcImZvbGxvd1wiIH0pO1xuICAgICAgICAgICAgaWYgKCF0YXJSZXNwLm9rKSB0aHJvdyBuZXcgRXJyb3IoYFRhcmJhbGwgZG93bmxvYWQgZmFpbGVkOiBIVFRQICR7dGFyUmVzcC5zdGF0dXN9YCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSBwYXJzZUludCh0YXJSZXNwLmhlYWRlcnMuZ2V0KFwiY29udGVudC1sZW5ndGhcIikgfHwgXCIwXCIsIDEwKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50TGVuZ3RoID4gTUFYX1RBUkJBTExfU0laRSkgdGhyb3cgbmV3IEVycm9yKGBSZXBvc2l0b3J5IHRvbyBsYXJnZSBmb3IgdGFyYmFsbCAoJHsoY29udGVudExlbmd0aCAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDApfU1CKWApO1xuXG4gICAgICAgICAgICBjb25zdCB0YXJQYXRoID0gcGF0aC5qb2luKHRtcERpciwgXCJyZXBvLnRhci5nelwiKTtcbiAgICAgICAgICAgIGNvbnN0IGFycmF5QnVmID0gYXdhaXQgdGFyUmVzcC5hcnJheUJ1ZmZlcigpO1xuICAgICAgICAgICAgaWYgKGFycmF5QnVmLmJ5dGVMZW5ndGggPiBNQVhfVEFSQkFMTF9TSVpFKSB0aHJvdyBuZXcgRXJyb3IoYFJlcG9zaXRvcnkgdG9vIGxhcmdlICgkeyhhcnJheUJ1Zi5ieXRlTGVuZ3RoIC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMCl9TUIpYCk7XG5cbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmModGFyUGF0aCwgQnVmZmVyLmZyb20oYXJyYXlCdWYpKTtcbiAgICAgICAgICAgIGNvbnN0IHRhclNpemUgPSBmcy5zdGF0U3luYyh0YXJQYXRoKS5zaXplO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIFRhcmJhbGwgZG93bmxvYWRlZDogJHsodGFyU2l6ZSAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDEpfU1CYCk7XG5cbiAgICAgICAgICAgIGZzLm1rZGlyU3luYyhwcm9qZWN0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCIpIHtcbiAgICAgICAgICAgICAgZXhlY1N5bmMoYHRhciB4emYgXCIke3RhclBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpfVwiIC0tc3RyaXAtY29tcG9uZW50cz0xIC1DIFwiJHtwcm9qZWN0RGlyLnJlcGxhY2UoL1xcXFwvZywgJy8nKX1cImAsIHsgdGltZW91dDogNjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBleGVjU3luYyhgdGFyIHh6ZiBcIiR7dGFyUGF0aH1cIiAtLXN0cmlwLWNvbXBvbmVudHM9MSAtQyBcIiR7cHJvamVjdERpcn1cImAsIHsgdGltZW91dDogNjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gRXh0cmFjdGVkIHRhcmJhbGwgdG8gJHtwcm9qZWN0RGlyfWApO1xuICAgICAgICAgICAgdGFyYmFsbFN1Y2Nlc3MgPSB0cnVlO1xuICAgICAgICAgIH0gY2F0Y2ggKHRhckVycjogYW55KSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gVGFyYmFsbCBtZXRob2QgZmFpbGVkIGZvciAke293bmVyfS8ke3JlcG99OiAke3RhckVyci5tZXNzYWdlPy5zbGljZSgwLCAyMDApfWApO1xuICAgICAgICAgICAgdHJ5IHsgZnMucm1TeW5jKHByb2plY3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghdGFyYmFsbFN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIGNsb25lTWV0aG9kID0gXCJnaXQtY2xvbmVcIjtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbSW1wb3J0XSBGYWxsaW5nIGJhY2sgdG8gZ2l0IGNsb25lIC0tZGVwdGggMSBmb3IgJHtvd25lcn0vJHtyZXBvfS4uLmApO1xuICAgICAgICAgICAgY29uc3QgY2xvbmVVcmwgPSBnaFRva2VuXG4gICAgICAgICAgICAgID8gYGh0dHBzOi8veC1hY2Nlc3MtdG9rZW46JHtnaFRva2VufUBnaXRodWIuY29tLyR7b3duZXJ9LyR7cmVwb30uZ2l0YFxuICAgICAgICAgICAgICA6IGBodHRwczovL2dpdGh1Yi5jb20vJHtvd25lcn0vJHtyZXBvfS5naXRgO1xuICAgICAgICAgICAgY29uc3QgY2xvbmVUbXAgPSBwYXRoLmpvaW4odG1wRGlyLCBcImNsb25lXCIpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZXhlY1N5bmMoYGdpdCBjbG9uZSAtLWRlcHRoIDEgLS1zaW5nbGUtYnJhbmNoIC0tYnJhbmNoIFwiJHtkZWZhdWx0QnJhbmNofVwiIFwiJHtjbG9uZVVybH1cIiBcIiR7Y2xvbmVUbXB9XCJgLCB7IHRpbWVvdXQ6IDEyMDAwMCwgc3RkaW86IFwicGlwZVwiLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGJyYW5jaEVycjogYW55KSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZXhlY1N5bmMoYGdpdCBjbG9uZSAtLWRlcHRoIDEgXCIke2Nsb25lVXJsfVwiIFwiJHtjbG9uZVRtcH1cImAsIHsgdGltZW91dDogMTIwMDAwLCBzdGRpbzogXCJwaXBlXCIsIHdpbmRvd3NIaWRlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICB9IGNhdGNoIChjbG9uZUVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gY2xvbmUgcmVwb3NpdG9yeTogJHtjbG9uZUVyci5tZXNzYWdlPy5zbGljZSgwLCAyMDApfWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmcy5ta2RpclN5bmMocHJvamVjdERpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICBjb25zdCBjbG9uZUVudHJpZXMgPSBmcy5yZWFkZGlyU3luYyhjbG9uZVRtcCk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGNsb25lRW50cmllcykge1xuICAgICAgICAgICAgICBjb25zdCBzcmMgPSBwYXRoLmpvaW4oY2xvbmVUbXAsIGVudHJ5KTtcbiAgICAgICAgICAgICAgY29uc3QgZGVzdCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBlbnRyeSk7XG4gICAgICAgICAgICAgIHRyeSB7IGZzLmNwU3luYyhzcmMsIGRlc3QsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIEdpdCBjbG9uZSBjb21wbGV0ZWQgZm9yICR7b3duZXJ9LyR7cmVwb31gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBDTEVBTlVQX1BBVFRFUk5TID0gW1wibm9kZV9tb2R1bGVzXCIsIFwiLmdpdFwiLCBcIi5uZXh0XCIsIFwiLm51eHRcIiwgXCJkaXN0XCIsIFwiLmNhY2hlXCIsIFwiLnR1cmJvXCIsIFwiLnZlcmNlbFwiLCBcIi5vdXRwdXRcIl07XG4gICAgICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIENMRUFOVVBfUEFUVEVSTlMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNsZWFuUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBwYXR0ZXJuKTtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGNsZWFuUGF0aCkpIHtcbiAgICAgICAgICAgICAgdHJ5IHsgZnMucm1TeW5jKGNsZWFuUGF0aCwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHdhbGtBbmRDbGVhbiA9IChkaXI6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBmcy5yZWFkZGlyU3luYyhkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bGwgPSBwYXRoLmpvaW4oZGlyLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5Lm5hbWUgPT09IFwibm9kZV9tb2R1bGVzXCIgfHwgZW50cnkubmFtZSA9PT0gXCIuZ2l0XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHsgZnMucm1TeW5jKGZ1bGwsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgd2Fsa0FuZENsZWFuKGZ1bGwpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZW50cnkubmFtZSA9PT0gXCIuRFNfU3RvcmVcIikge1xuICAgICAgICAgICAgICAgICAgdHJ5IHsgZnMudW5saW5rU3luYyhmdWxsKTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgIH07XG4gICAgICAgICAgd2Fsa0FuZENsZWFuKHByb2plY3REaXIpO1xuXG4gICAgICAgICAgbGV0IGZpbGVzV3JpdHRlbiA9IDA7XG4gICAgICAgICAgY29uc3QgY291bnRGaWxlcyA9IChkaXI6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBmcy5yZWFkZGlyU3luYyhkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KSkge1xuICAgICAgICAgICAgICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSgpKSBjb3VudEZpbGVzKHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpKTtcbiAgICAgICAgICAgICAgICBlbHNlIGZpbGVzV3JpdHRlbisrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb3VudEZpbGVzKHByb2plY3REaXIpO1xuXG4gICAgICAgICAgbGV0IGZyYW1ld29yayA9IFwidmFuaWxsYVwiO1xuICAgICAgICAgIGNvbnN0IHBrZ1BhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgY29uc3QgZGV0ZWN0RnJhbWV3b3JrID0gKHBrZ0pzb25QYXRoOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHBrZyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBrZ0pzb25QYXRoLCBcInV0Zi04XCIpKTtcbiAgICAgICAgICAgICAgY29uc3QgZGVwcyA9IHsgLi4uKHBrZy5kZXBlbmRlbmNpZXMgfHwge30pLCAuLi4ocGtnLmRldkRlcGVuZGVuY2llcyB8fCB7fSkgfTtcbiAgICAgICAgICAgICAgaWYgKGRlcHNbXCJuZXh0XCJdKSByZXR1cm4gXCJuZXh0anNcIjtcbiAgICAgICAgICAgICAgaWYgKGRlcHNbXCJudXh0XCJdIHx8IGRlcHNbXCJudXh0M1wiXSkgcmV0dXJuIFwibnV4dFwiO1xuICAgICAgICAgICAgICBpZiAoZGVwc1tcIkBhbmd1bGFyL2NvcmVcIl0pIHJldHVybiBcImFuZ3VsYXJcIjtcbiAgICAgICAgICAgICAgaWYgKGRlcHNbXCJzdmVsdGVcIl0gfHwgZGVwc1tcIkBzdmVsdGVqcy9raXRcIl0pIHJldHVybiBcInN2ZWx0ZVwiO1xuICAgICAgICAgICAgICBpZiAoZGVwc1tcImFzdHJvXCJdKSByZXR1cm4gXCJhc3Ryb1wiO1xuICAgICAgICAgICAgICBpZiAoZGVwc1tcInZ1ZVwiXSkgcmV0dXJuIFwidnVlXCI7XG4gICAgICAgICAgICAgIGlmIChkZXBzW1wicmVhY3RcIl0pIHJldHVybiBcInJlYWN0XCI7XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9O1xuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBrZ1BhdGgpKSB7XG4gICAgICAgICAgICBmcmFtZXdvcmsgPSBkZXRlY3RGcmFtZXdvcmsocGtnUGF0aCkgfHwgXCJ2YW5pbGxhXCI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAoY29uc3Qgc3ViIG9mIFtcImZyb250ZW5kXCIsIFwiY2xpZW50XCIsIFwid2ViXCIsIFwiYXBwXCJdKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHN1YlBrZyA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBzdWIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhzdWJQa2cpKSB7XG4gICAgICAgICAgICAgICAgZnJhbWV3b3JrID0gZGV0ZWN0RnJhbWV3b3JrKHN1YlBrZykgfHwgXCJ2YW5pbGxhXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZXQgbnBtSW5zdGFsbGVkID0gZmFsc2U7XG4gICAgICAgICAgbGV0IGluc3RhbGxFcnJvciA9IFwiXCI7XG4gICAgICAgICAgbGV0IGVmZmVjdGl2ZUluc3RhbGxEaXIgPSBwcm9qZWN0RGlyO1xuICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwa2dQYXRoKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBzdWIgb2YgW1wiZnJvbnRlbmRcIiwgXCJjbGllbnRcIiwgXCJ3ZWJcIiwgXCJhcHBcIl0pIHtcbiAgICAgICAgICAgICAgY29uc3Qgc3ViUGtnID0gcGF0aC5qb2luKHByb2plY3REaXIsIHN1YiwgXCJwYWNrYWdlLmpzb25cIik7XG4gICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHN1YlBrZykpIHtcbiAgICAgICAgICAgICAgICBlZmZlY3RpdmVJbnN0YWxsRGlyID0gcGF0aC5qb2luKHByb2plY3REaXIsIHN1Yik7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIE5vIHJvb3QgcGFja2FnZS5qc29uIFx1MjAxNCB1c2luZyAke3N1Yn0vcGFja2FnZS5qc29uIGZvciAke3Byb2plY3ROYW1lfWApO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihlZmZlY3RpdmVJbnN0YWxsRGlyLCBcInBhY2thZ2UuanNvblwiKSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGRldGVjdFBNID0gKCk6IHN0cmluZyA9PiB7XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgZCBvZiBbZWZmZWN0aXZlSW5zdGFsbERpciwgcHJvamVjdERpcl0pIHtcbiAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZCwgXCJidW4ubG9ja2JcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKGQsIFwiYnVuLmxvY2tcIikpKSByZXR1cm4gXCJidW5cIjtcbiAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZCwgXCJwbnBtLWxvY2sueWFtbFwiKSkgfHwgZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZCwgXCJwbnBtLXdvcmtzcGFjZS55YW1sXCIpKSkgcmV0dXJuIFwicG5wbVwiO1xuICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGguam9pbihkLCBcInlhcm4ubG9ja1wiKSkpIHJldHVybiBcInlhcm5cIjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gXCJucG1cIjtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCBkZXRlY3RlZFBNID0gZGV0ZWN0UE0oKTtcblxuICAgICAgICAgICAgbGV0IGlzTW9ub3JlcG8gPSBmYWxzZTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGVmZlBrZyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihlZmZlY3RpdmVJbnN0YWxsRGlyLCBcInBhY2thZ2UuanNvblwiKSwgXCJ1dGYtOFwiKSk7XG4gICAgICAgICAgICAgIGlmIChlZmZQa2cud29ya3NwYWNlcyB8fCBmcy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0RGlyLCBcInBucG0td29ya3NwYWNlLnlhbWxcIikpIHx8IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIFwibGVybmEuanNvblwiKSkpIHtcbiAgICAgICAgICAgICAgICBpc01vbm9yZXBvID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICBjb25zdCBpbnN0YWxsQ21kID0gZGV0ZWN0ZWRQTSA9PT0gXCJwbnBtXCIgPyBcIm5weCBwbnBtIGluc3RhbGwgLS1uby1mcm96ZW4tbG9ja2ZpbGUgLS1pZ25vcmUtc2NyaXB0c1wiXG4gICAgICAgICAgICAgIDogZGV0ZWN0ZWRQTSA9PT0gXCJ5YXJuXCIgPyBcIm5weCB5YXJuIGluc3RhbGwgLS1pZ25vcmUtZW5naW5lcyAtLWlnbm9yZS1zY3JpcHRzXCJcbiAgICAgICAgICAgICAgOiBkZXRlY3RlZFBNID09PSBcImJ1blwiID8gXCJucHggYnVuIGluc3RhbGwgLS1pZ25vcmUtc2NyaXB0c1wiXG4gICAgICAgICAgICAgIDogXCJucG0gaW5zdGFsbCAtLWxlZ2FjeS1wZWVyLWRlcHMgLS1pZ25vcmUtc2NyaXB0c1wiO1xuXG4gICAgICAgICAgICBjb25zdCBpbXBvcnRJbnN0YWxsRW52ID0geyAuLi5wcm9jZXNzLmVudiwgSFVTS1k6IFwiMFwiLCBESVNBQkxFX09QRU5DT0xMRUNUSVZFOiBcInRydWVcIiwgQURCTE9DSzogXCIxXCIgfTtcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZWZmZWN0aXZlSW5zdGFsbERpciwgXCIuZ2l0XCIpKSkgeyB0cnkgeyBmcy5ta2RpclN5bmMocGF0aC5qb2luKGVmZmVjdGl2ZUluc3RhbGxEaXIsIFwiLmdpdFwiKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gY2F0Y2gge30gfVxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIEluc3RhbGxpbmcgZGVwcyBpbiAke2VmZmVjdGl2ZUluc3RhbGxEaXIgPT09IHByb2plY3REaXIgPyBcInJvb3RcIiA6IHBhdGgucmVsYXRpdmUocHJvamVjdERpciwgZWZmZWN0aXZlSW5zdGFsbERpcikgKyBcIi9cIn0gZm9yICR7cHJvamVjdE5hbWV9IHdpdGg6ICR7aW5zdGFsbENtZH0gKHBtOiAke2RldGVjdGVkUE19KWApO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZXhlY1N5bmMoaW5zdGFsbENtZCwgeyBjd2Q6IGVmZmVjdGl2ZUluc3RhbGxEaXIsIHRpbWVvdXQ6IDE4MDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSwgd2luZG93c0hpZGU6IHRydWUsIGVudjogaW1wb3J0SW5zdGFsbEVudiB9KTtcbiAgICAgICAgICAgICAgbnBtSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIERlcHMgaW5zdGFsbGVkIGZvciAke3Byb2plY3ROYW1lfWApO1xuICAgICAgICAgICAgfSBjYXRjaCAoaW5zdGFsbEVycjogYW55KSB7XG4gICAgICAgICAgICAgIGluc3RhbGxFcnJvciA9IGluc3RhbGxFcnIuc3RkZXJyPy50b1N0cmluZygpLnNsaWNlKC01MDApIHx8IGluc3RhbGxFcnIubWVzc2FnZT8uc2xpY2UoMCwgNTAwKSB8fCBcIlVua25vd24gZXJyb3JcIjtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW0ltcG9ydF0gSW5zdGFsbCBmYWlsZWQgZm9yICR7cHJvamVjdE5hbWV9IHdpdGggJHtkZXRlY3RlZFBNfTpgLCBpbnN0YWxsRXJyb3Iuc2xpY2UoMCwgMzAwKSk7XG4gICAgICAgICAgICAgIGlmIChkZXRlY3RlZFBNICE9PSBcIm5wbVwiKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbSW1wb3J0XSBSZXRyeWluZyB3aXRoIG5wbSBmb3IgJHtwcm9qZWN0TmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgIGV4ZWNTeW5jKFwibnBtIGluc3RhbGwgLS1sZWdhY3ktcGVlci1kZXBzIC0taWdub3JlLXNjcmlwdHNcIiwgeyBjd2Q6IGVmZmVjdGl2ZUluc3RhbGxEaXIsIHRpbWVvdXQ6IDE4MDAwMCwgc3RkaW86IFwicGlwZVwiLCBzaGVsbDogdHJ1ZSwgd2luZG93c0hpZGU6IHRydWUsIGVudjogaW1wb3J0SW5zdGFsbEVudiB9KTtcbiAgICAgICAgICAgICAgICAgIG5wbUluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICBpbnN0YWxsRXJyb3IgPSBcIlwiO1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIERlcHMgaW5zdGFsbGVkIGZvciAke3Byb2plY3ROYW1lfSAobnBtIGZhbGxiYWNrKWApO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKHJldHJ5RXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgIGluc3RhbGxFcnJvciA9IHJldHJ5RXJyLnN0ZGVycj8udG9TdHJpbmcoKS5zbGljZSgtMzAwKSB8fCByZXRyeUVyci5tZXNzYWdlPy5zbGljZSgwLCAzMDApIHx8IFwiUmV0cnkgZmFpbGVkXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgQ09NTU9OX1NVQkRJUlMgPSBbXCJmcm9udGVuZFwiLCBcImNsaWVudFwiLCBcIndlYlwiLCBcImFwcFwiLCBcInBhY2thZ2VzL2FwcFwiLCBcInBhY2thZ2VzL2NsaWVudFwiLCBcInBhY2thZ2VzL3dlYlwiXTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHN1YmRpciBvZiBDT01NT05fU1VCRElSUykge1xuICAgICAgICAgICAgY29uc3Qgc3ViUGtnUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCBzdWJkaXIsIFwicGFja2FnZS5qc29uXCIpO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoc3ViUGtnUGF0aCkgJiYgIWZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHByb2plY3REaXIsIHN1YmRpciwgXCJub2RlX21vZHVsZXNcIikpKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIEluc3RhbGxpbmcgZGVwcyBpbiBzdWJkaXJlY3RvcnkgJHtzdWJkaXJ9Ly4uLmApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1Ykluc3REaXIgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgc3ViZGlyKTtcbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHN1Ykluc3REaXIsIFwiLmdpdFwiKSkpIHsgdHJ5IHsgZnMubWtkaXJTeW5jKHBhdGguam9pbihzdWJJbnN0RGlyLCBcIi5naXRcIiksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9IGNhdGNoIHt9IH1cbiAgICAgICAgICAgICAgICBleGVjU3luYyhcIm5wbSBpbnN0YWxsIC0tbGVnYWN5LXBlZXItZGVwcyAtLWlnbm9yZS1zY3JpcHRzXCIsIHsgY3dkOiBzdWJJbnN0RGlyLCB0aW1lb3V0OiAxMjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgc2hlbGw6IHRydWUsIHdpbmRvd3NIaWRlOiB0cnVlLCBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIEhVU0tZOiBcIjBcIiB9IH0pO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbSW1wb3J0XSBTdWJkaXJlY3RvcnkgJHtzdWJkaXJ9LyBkZXBzIGluc3RhbGxlZGApO1xuICAgICAgICAgICAgICB9IGNhdGNoIChzdWJFcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbSW1wb3J0XSBTdWJkaXJlY3RvcnkgJHtzdWJkaXJ9LyBpbnN0YWxsIGZhaWxlZCAobm9uLWNyaXRpY2FsKTogJHtzdWJFcnIubWVzc2FnZT8uc2xpY2UoMCwgMTAwKX1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IG1ldGFQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsIFwiLmxhbWJ5LW1ldGEuanNvblwiKTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhtZXRhUGF0aCwgSlNPTi5zdHJpbmdpZnkoeyBvd25lciwgcmVwbywgc291cmNlVXJsOiBgaHR0cHM6Ly9naXRodWIuY29tLyR7b3duZXJ9LyR7cmVwb31gLCBjbG9uZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLCBwcm9qZWN0TmFtZSB9LCBudWxsLCAyKSk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gU2F2ZWQgc291cmNlIG1ldGFkYXRhIHRvIC5sYW1ieS1tZXRhLmpzb25gKTtcbiAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICBsZXQgcmVsZWFzZUFzc2V0czogeyBuYW1lOiBzdHJpbmc7IHNpemU6IG51bWJlcjsgZG93bmxvYWRVcmw6IHN0cmluZzsgZG93bmxvYWRlZDogYm9vbGVhbiB9W10gPSBbXTtcbiAgICAgICAgICBjb25zdCBoYXNQa2dKc29uID0gZnMuZXhpc3RzU3luYyhwa2dQYXRoKTtcbiAgICAgICAgICBpZiAoIWhhc1BrZ0pzb24gJiYgYXBpQXZhaWxhYmxlKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gTm8gcGFja2FnZS5qc29uIGZvdW5kIFx1MjAxNCBjaGVja2luZyBHaXRIdWIgUmVsZWFzZXMgZm9yIHByZWNvbXBpbGVkIGJpbmFyaWVzLi4uYCk7XG4gICAgICAgICAgICAgIGNvbnN0IHJlbFJlc3AgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy8ke293bmVyfS8ke3JlcG99L3JlbGVhc2VzL2xhdGVzdGAsIHsgaGVhZGVyczogeyAuLi5oZWFkZXJzLCBcIkFjY2VwdFwiOiBcImFwcGxpY2F0aW9uL3ZuZC5naXRodWIudjMranNvblwiIH0gfSk7XG4gICAgICAgICAgICAgIGlmIChyZWxSZXNwLm9rKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVsRGF0YTogYW55ID0gYXdhaXQgcmVsUmVzcC5qc29uKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgQklOQVJZX0VYVFMgPSBbXCIuZXhlXCIsIFwiLm1zaVwiLCBcIi5hcHBpbWFnZVwiLCBcIi5kbWdcIiwgXCIuZGViXCIsIFwiLnJwbVwiLCBcIi56aXBcIiwgXCIudGFyLmd6XCIsIFwiLjd6XCIsIFwiLnNuYXBcIiwgXCIuZmxhdHBha1wiXTtcbiAgICAgICAgICAgICAgICBjb25zdCBvc1BsYXRmb3JtID0gb3MucGxhdGZvcm0oKTtcbiAgICAgICAgICAgICAgICBjb25zdCBvc0FyY2ggPSBvcy5hcmNoKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcGxhdGZvcm1IaW50cyA9IG9zUGxhdGZvcm0gPT09IFwid2luMzJcIiA/IFtcIndpblwiLCBcIndpbmRvd3NcIl0gOiBvc1BsYXRmb3JtID09PSBcImRhcndpblwiID8gW1wibWFjXCIsIFwibWFjb3NcIiwgXCJkYXJ3aW5cIl0gOiBbXCJsaW51eFwiXTtcbiAgICAgICAgICAgICAgICBjb25zdCBnb29kQXJjaEhpbnRzID0gb3NBcmNoID09PSBcImFybTY0XCIgPyBbXCJhcm02NFwiLCBcImFhcmNoNjRcIl0gOiBbXCJ4NjRcIiwgXCJ4ODZfNjRcIiwgXCJhbWQ2NFwiLCBcIndpbjY0XCJdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhZEFyY2hIaW50cyA9IG9zQXJjaCA9PT0gXCJhcm02NFwiID8gW1wieDY0XCIsIFwieDg2XzY0XCIsIFwiYW1kNjRcIiwgXCJ3aW42NFwiXSA6IFtcImFybTY0XCIsIFwiYWFyY2g2NFwiXTtcbiAgICAgICAgICAgICAgICBjb25zdCBJTlNUQUxMRVJfS1cgPSBbXCJpbnN0YWxsZXJcIiwgXCJzZXR1cFwiLCBcImluc3RhbGxcIl07XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gKHJlbERhdGEuYXNzZXRzIHx8IFtdKVxuICAgICAgICAgICAgICAgICAgLmZpbHRlcigoYTogYW55KSA9PiBCSU5BUllfRVhUUy5zb21lKGV4dCA9PiBhLm5hbWUudG9Mb3dlckNhc2UoKS5lbmRzV2l0aChleHQpKSlcbiAgICAgICAgICAgICAgICAgIC5tYXAoKGE6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsbiA9IGEubmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgc2NvcmUgPSAwO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGxhdGZvcm1IaW50cy5zb21lKGggPT4gbG4uaW5jbHVkZXMoaCkpKSBzY29yZSArPSAyMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdvb2RBcmNoSGludHMuc29tZShoID0+IGxuLmluY2x1ZGVzKGgpKSkgc2NvcmUgKz0gMTA7XG4gICAgICAgICAgICAgICAgICAgIGlmIChiYWRBcmNoSGludHMuc29tZShoID0+IGxuLmluY2x1ZGVzKGgpKSkgc2NvcmUgLT0gMTU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsbi5pbmNsdWRlcyhcInBvcnRhYmxlXCIpKSBzY29yZSArPSAyNTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKElOU1RBTExFUl9LVy5zb21lKGggPT4gbG4uaW5jbHVkZXMoaCkpKSBzY29yZSAtPSA1O1xuICAgICAgICAgICAgICAgICAgICBpZiAobG4uZW5kc1dpdGgoXCIuemlwXCIpKSBzY29yZSArPSAzO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyAuLi5hLCBfc2NvcmU6IHNjb3JlIH07XG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBiLl9zY29yZSAtIGEuX3Njb3JlKTtcbiAgICAgICAgICAgICAgICBpZiAoYXNzZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbGVhc2VzRGlyID0gcGF0aC5qb2luKHByb2plY3REaXIsIFwiX3JlbGVhc2VzXCIpO1xuICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKHJlbGVhc2VzRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IE1BWF9ET1dOTE9BRCA9IDUwMCAqIDEwMjQgKiAxMDI0O1xuICAgICAgICAgICAgICAgICAgY29uc3QgdG9Eb3dubG9hZCA9IGFzc2V0cy5maWx0ZXIoKGE6IGFueSkgPT4gYS5zaXplIDwgTUFYX0RPV05MT0FEKS5zbGljZSgwLCAzKTtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgdG9Eb3dubG9hZCkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbSW1wb3J0XSBEb3dubG9hZGluZyByZWxlYXNlIGFzc2V0OiAke2Fzc2V0Lm5hbWV9ICgkeyhhc3NldC5zaXplIC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMSl9TUIpLi4uYCk7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGxSZXNwID0gYXdhaXQgZmV0Y2goYXNzZXQuYnJvd3Nlcl9kb3dubG9hZF91cmwsIHsgcmVkaXJlY3Q6IFwiZm9sbG93XCIgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGRsUmVzcC5vaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnVmID0gQnVmZmVyLmZyb20oYXdhaXQgZGxSZXNwLmFycmF5QnVmZmVyKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRQYXRoID0gcGF0aC5qb2luKHJlbGVhc2VzRGlyLCBhc3NldC5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoYXNzZXRQYXRoLCBidWYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0Lm5hbWUudG9Mb3dlckNhc2UoKS5lbmRzV2l0aChcIi5leGVcIikgfHwgYXNzZXQubmFtZS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKFwiLmFwcGltYWdlXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7IGZzLmNobW9kU3luYyhhc3NldFBhdGgsIDBvNzU1KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0Lm5hbWUudG9Mb3dlckNhc2UoKS5lbmRzV2l0aChcIi56aXBcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYWN0RGlyID0gcGF0aC5qb2luKHJlbGVhc2VzRGlyLCBhc3NldC5uYW1lLnJlcGxhY2UoL1xcLnppcCQvaSwgXCJcIikpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhleHRyYWN0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob3NQbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjU3luYyhgdGFyIHhmIFwiJHthc3NldFBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpfVwiIC1DIFwiJHtleHRyYWN0RGlyLnJlcGxhY2UoL1xcXFwvZywgJy8nKX1cImAsIHsgdGltZW91dDogNjAwMDAsIHN0ZGlvOiBcInBpcGVcIiwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWNTeW5jKGB1bnppcCAtbyAtcSBcIiR7YXNzZXRQYXRofVwiIC1kIFwiJHtleHRyYWN0RGlyfVwiYCwgeyB0aW1lb3V0OiA2MDAwMCwgc3RkaW86IFwicGlwZVwiIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gRXh0cmFjdGVkICR7YXNzZXQubmFtZX0gdG8gJHtleHRyYWN0RGlyfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoICh1bnppcEVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIENvdWxkIG5vdCBleHRyYWN0ICR7YXNzZXQubmFtZX06ICR7dW56aXBFcnIubWVzc2FnZT8uc2xpY2UoMCwgMTAwKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVsZWFzZUFzc2V0cy5wdXNoKHsgbmFtZTogYXNzZXQubmFtZSwgc2l6ZTogYXNzZXQuc2l6ZSwgZG93bmxvYWRVcmw6IGFzc2V0LmJyb3dzZXJfZG93bmxvYWRfdXJsLCBkb3dubG9hZGVkOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIERvd25sb2FkZWQ6ICR7YXNzZXQubmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGRsRXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gRmFpbGVkIHRvIGRvd25sb2FkICR7YXNzZXQubmFtZX06ICR7ZGxFcnIubWVzc2FnZT8uc2xpY2UoMCwgMTAwKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICByZWxlYXNlQXNzZXRzLnB1c2goeyBuYW1lOiBhc3NldC5uYW1lLCBzaXplOiBhc3NldC5zaXplLCBkb3dubG9hZFVybDogYXNzZXQuYnJvd3Nlcl9kb3dubG9hZF91cmwsIGRvd25sb2FkZWQ6IGZhbHNlIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGFzc2V0IG9mIGFzc2V0cy5zbGljZSgzKSkge1xuICAgICAgICAgICAgICAgICAgICByZWxlYXNlQXNzZXRzLnB1c2goeyBuYW1lOiBhc3NldC5uYW1lLCBzaXplOiBhc3NldC5zaXplLCBkb3dubG9hZFVybDogYXNzZXQuYnJvd3Nlcl9kb3dubG9hZF91cmwsIGRvd25sb2FkZWQ6IGZhbHNlIH0pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtJbXBvcnRdIFJlbGVhc2UgYXNzZXRzOiAke3JlbGVhc2VBc3NldHMuZmlsdGVyKGEgPT4gYS5kb3dubG9hZGVkKS5sZW5ndGh9IGRvd25sb2FkZWQsICR7cmVsZWFzZUFzc2V0cy5sZW5ndGh9IHRvdGFsYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChyZWxFcnI6IGFueSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0ltcG9ydF0gUmVsZWFzZSBjaGVjayBmYWlsZWQgKG5vbi1jcml0aWNhbCk6ICR7cmVsRXJyLm1lc3NhZ2U/LnNsaWNlKDAsIDEwMCl9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgcHJvamVjdE5hbWUsXG4gICAgICAgICAgICBmcmFtZXdvcmssXG4gICAgICAgICAgICBmaWxlc1dyaXR0ZW4sXG4gICAgICAgICAgICBucG1JbnN0YWxsZWQsXG4gICAgICAgICAgICBjbG9uZU1ldGhvZCxcbiAgICAgICAgICAgIHNvdXJjZVJlcG86IGBodHRwczovL2dpdGh1Yi5jb20vJHtvd25lcn0vJHtyZXBvfWAsXG4gICAgICAgICAgICBkZWZhdWx0QnJhbmNoLFxuICAgICAgICAgICAgLi4uKGluc3RhbGxFcnJvciA/IHsgaW5zdGFsbEVycm9yOiBpbnN0YWxsRXJyb3Iuc2xpY2UoMCwgNTAwKSB9IDoge30pLFxuICAgICAgICAgICAgLi4uKHJlbGVhc2VBc3NldHMubGVuZ3RoID4gMCA/IHsgcmVsZWFzZUFzc2V0cyB9IDoge30pLFxuICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdHJ5IHsgZnMucm1TeW5jKHRtcERpciwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pOyB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgbGV0IGFjdGl2ZVByZXZpZXdQb3J0OiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAgICAgY29uc3QgcHJveHlUb1ByZXZpZXcgPSBhc3luYyAocmVxOiBhbnksIHJlczogYW55LCBwb3J0OiBudW1iZXIsIHRhcmdldFBhdGg6IHN0cmluZykgPT4ge1xuICAgICAgICBjb25zdCBodHRwID0gYXdhaXQgaW1wb3J0KFwiaHR0cFwiKTtcbiAgICAgICAgY29uc3QgcHJveHlSZXEgPSBodHRwLnJlcXVlc3QoXG4gICAgICAgICAge1xuICAgICAgICAgICAgaG9zdG5hbWU6IFwiMTI3LjAuMC4xXCIsXG4gICAgICAgICAgICBwb3J0LFxuICAgICAgICAgICAgcGF0aDogdGFyZ2V0UGF0aCxcbiAgICAgICAgICAgIG1ldGhvZDogcmVxLm1ldGhvZCxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgLi4ucmVxLmhlYWRlcnMsIGhvc3Q6IGBsb2NhbGhvc3Q6JHtwb3J0fWAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIChwcm94eVJlcykgPT4ge1xuICAgICAgICAgICAgcmVzLndyaXRlSGVhZChwcm94eVJlcy5zdGF0dXNDb2RlIHx8IDIwMCwgcHJveHlSZXMuaGVhZGVycyk7XG4gICAgICAgICAgICBwcm94eVJlcy5waXBlKHJlcywgeyBlbmQ6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgICBwcm94eVJlcS5vbihcImVycm9yXCIsICgpID0+IHtcbiAgICAgICAgICBpZiAoIXJlcy5oZWFkZXJzU2VudCkgeyByZXMuc3RhdHVzQ29kZSA9IDUwMjsgcmVzLmVuZChcIlByZXZpZXcgc2VydmVyIG5vdCByZXNwb25kaW5nXCIpOyB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXEucGlwZShwcm94eVJlcSwgeyBlbmQ6IHRydWUgfSk7XG4gICAgICB9O1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKChyZXEsIF9yZXMsIG5leHQpID0+IHtcbiAgICAgICAgaWYgKHJlcS51cmwgPT09IFwiL1wiIHx8IHJlcS51cmwgPT09IFwiL2luZGV4Lmh0bWxcIikge1xuICAgICAgICAgIGFjdGl2ZVByZXZpZXdQb3J0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBuZXh0KCk7XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9fX3ByZXZpZXdcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gcmVxLnVybD8ubWF0Y2goL15cXC8oXFxkKykoXFwvLiopPyQvKSB8fCByZXEudXJsPy5tYXRjaCgvXlxcL19fcHJldmlld1xcLyhcXGQrKShcXC8uKik/JC8pO1xuICAgICAgICBpZiAoIW1hdGNoKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKFwiSW52YWxpZCBwcmV2aWV3IFVSTFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIGNvbnN0IHBvcnQgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICBjb25zdCB0YXJnZXRQYXRoID0gbWF0Y2hbMl0gfHwgXCIvXCI7XG5cbiAgICAgICAgaWYgKHBvcnQgPCA1MTAwIHx8IHBvcnQgPiA1MjAwKSB7IHJlcy5zdGF0dXNDb2RlID0gNDAwOyByZXMuZW5kKFwiUG9ydCBvdXQgb2YgcHJldmlldyByYW5nZVwiKTsgcmV0dXJuOyB9XG5cbiAgICAgICAgYWN0aXZlUHJldmlld1BvcnQgPSBwb3J0O1xuICAgICAgICBhd2FpdCBwcm94eVRvUHJldmlldyhyZXEsIHJlcywgcG9ydCwgdGFyZ2V0UGF0aCk7XG4gICAgICB9KTtcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9zdy5qc1wiLCAoX3JlcSwgcmVzKSA9PiB7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qYXZhc2NyaXB0XCIpO1xuICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ2FjaGUtQ29udHJvbFwiLCBcIm5vLXN0b3JlXCIpO1xuICAgICAgICByZXMuZW5kKGBzZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ2luc3RhbGwnLCgpPT5zZWxmLnNraXBXYWl0aW5nKCkpO3NlbGYuYWRkRXZlbnRMaXN0ZW5lcignYWN0aXZhdGUnLGU9PmUud2FpdFVudGlsKHNlbGYucmVnaXN0cmF0aW9uLnVucmVnaXN0ZXIoKS50aGVuKCgpPT5zZWxmLmNsaWVudHMubWF0Y2hBbGwoKSkudGhlbihjcz0+Y3MuZm9yRWFjaChjPT5jLm5hdmlnYXRlKGMudXJsKSkpKSk7YCk7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgUFJFVklFV19BU1NFVF9QUkVGSVhFUyA9IFtcIi9fbmV4dC9cIiwgXCIvX19uZXh0anNcIiwgXCIvX192aXRlXCIsIFwiL0B2aXRlL1wiLCBcIi9AcmVhY3QtcmVmcmVzaFwiLCBcIi9AaWQvXCIsIFwiL0Bmcy9cIiwgXCIvbm9kZV9tb2R1bGVzL1wiLCBcIi9zcmMvXCIsIFwiL2Zhdmljb24uaWNvXCIsIFwiL29wZW5ncmFwaC1pbWFnZVwiLCBcIi9hcHBsZS10b3VjaC1pY29uXCIsIFwiL21hbmlmZXN0Lmpzb25cIiwgXCIvd29ya2JveC1cIiwgXCIvc3RhdGljL1wiLCBcIi9zb2NranMtbm9kZS9cIiwgXCIvYnVpbGQvXCIsIFwiL19hc3NldHMvXCIsIFwiL2Fzc2V0cy9cIiwgXCIvcHVibGljL1wiLCBcIi9wb2x5ZmlsbHNcIiwgXCIvLnZpdGUvXCIsIFwiL2htclwiLCBcIi9fX3dlYnBhY2tfaG1yXCIsIFwiL0B0YWlsd2luZGNzcy9cIl07XG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xuICAgICAgICBpZiAoIWFjdGl2ZVByZXZpZXdQb3J0IHx8ICFyZXEudXJsKSB7IG5leHQoKTsgcmV0dXJuOyB9XG4gICAgICAgIGNvbnN0IHNob3VsZFByb3h5ID0gUFJFVklFV19BU1NFVF9QUkVGSVhFUy5zb21lKHAgPT4gcmVxLnVybCEuc3RhcnRzV2l0aChwKSk7XG4gICAgICAgIGlmICghc2hvdWxkUHJveHkpIHsgbmV4dCgpOyByZXR1cm47IH1cbiAgICAgICAgYXdhaXQgcHJveHlUb1ByZXZpZXcocmVxLCByZXMsIGFjdGl2ZVByZXZpZXdQb3J0LCByZXEudXJsKTtcbiAgICAgIH0pO1xuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm9qZWN0cy9wcmV2aWV3LWluZm9cIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgeyByZXMuc3RhdHVzQ29kZSA9IDQwNTsgcmVzLmVuZChcIk1ldGhvZCBub3QgYWxsb3dlZFwiKTsgcmV0dXJuOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBuYW1lIH0gPSBKU09OLnBhcnNlKGF3YWl0IHJlYWRCb2R5KHJlcSkpO1xuICAgICAgICAgIGNvbnN0IGVudHJ5ID0gcHJldmlld1Byb2Nlc3Nlcy5nZXQobmFtZSk7XG4gICAgICAgICAgY29uc3QgcmVwbGl0RG9tYWluID0gcHJvY2Vzcy5lbnYuUkVQTElUX0RFVl9ET01BSU4gfHwgXCJcIjtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcbiAgICAgICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3h5VXJsID0gYC9fX3ByZXZpZXcvJHtlbnRyeS5wb3J0fS9gO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHJ1bm5pbmc6IHRydWUsIHBvcnQ6IGVudHJ5LnBvcnQsIHByb3h5VXJsLCByZXBsaXREb21haW4gfSkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgcnVubmluZzogZmFsc2UgfSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzL3N0b3AtcHJldmlld1wiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7IHJlcy5zdGF0dXNDb2RlID0gNDA1OyByZXMuZW5kKFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIpOyByZXR1cm47IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IG5hbWUgfSA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEJvZHkocmVxKSk7XG4gICAgICAgICAgY29uc3QgZW50cnkgPSBwcmV2aWV3UHJvY2Vzc2VzLmdldChuYW1lKTtcbiAgICAgICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgICAgIGNvbnN0IHBpZCA9IGVudHJ5LnByb2Nlc3MucGlkO1xuICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIikge1xuICAgICAgICAgICAgICB0cnkgeyBjb25zdCB7IGV4ZWNTeW5jIH0gPSBhd2FpdCBpbXBvcnQoXCJjaGlsZF9wcm9jZXNzXCIpOyBleGVjU3luYyhgdGFza2tpbGwgL3BpZCAke3BpZH0gL1QgL0ZgLCB7IHN0ZGlvOiBcInBpcGVcIiwgd2luZG93c0hpZGU6IHRydWUgfSk7IH0gY2F0Y2gge31cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRyeSB7IHByb2Nlc3Mua2lsbCgtcGlkLCA5KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJ5IHsgZW50cnkucHJvY2Vzcy5raWxsKFwiU0lHS0lMTFwiKTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoXCJmc1wiKTtcbiAgICAgICAgICAgICAgY29uc3Qga2lsbFBvcnQgPSBhc3luYyAocG9ydDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIikge1xuICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBleGVjU3luYyB9ID0gYXdhaXQgaW1wb3J0KFwiY2hpbGRfcHJvY2Vzc1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoYG5ldHN0YXQgLWFubyB8IGZpbmRzdHIgOiR7cG9ydH1gLCB7IHN0ZGlvOiBcInBpcGVcIiwgZW5jb2Rpbmc6IFwidXRmLThcIiwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBpZHMgPSBuZXcgU2V0KG91dC5zcGxpdChcIlxcblwiKS5tYXAoKGw6IHN0cmluZykgPT4gbC50cmltKCkuc3BsaXQoL1xccysvKS5wb3AoKSkuZmlsdGVyKChwOiBhbnkpID0+IHAgJiYgL15cXGQrJC8udGVzdChwKSkpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHAgb2YgcGlkcykgeyB0cnkgeyBleGVjU3luYyhgdGFza2tpbGwgL3BpZCAke3B9IC9UIC9GYCwgeyBzdGRpbzogXCJwaXBlXCIsIHdpbmRvd3NIaWRlOiB0cnVlIH0pOyB9IGNhdGNoIHt9IH1cbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgbmV0VGNwID0gZnMucmVhZEZpbGVTeW5jKFwiL3Byb2MvbmV0L3RjcFwiLCBcInV0Zi04XCIpICsgZnMucmVhZEZpbGVTeW5jKFwiL3Byb2MvbmV0L3RjcDZcIiwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwb3J0SGV4ID0gcG9ydC50b1N0cmluZygxNikudG9VcHBlckNhc2UoKS5wYWRTdGFydCg0LCBcIjBcIik7XG4gICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSBuZXRUY3Auc3BsaXQoXCJcXG5cIikuZmlsdGVyKChsOiBzdHJpbmcpID0+IGwuaW5jbHVkZXMoYDoke3BvcnRIZXh9IGApKTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbHMgPSBsaW5lLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgICAgICAgICAgICAgY29uc3QgaW5vZGUgPSBjb2xzWzldO1xuICAgICAgICAgICAgICAgICAgaWYgKCFpbm9kZSB8fCBpbm9kZSA9PT0gXCIwXCIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgY29uc3QgcHJvY0RpcnMgPSBmcy5yZWFkZGlyU3luYyhcIi9wcm9jXCIpLmZpbHRlcigoZDogc3RyaW5nKSA9PiAvXlxcZCskLy50ZXN0KGQpKTtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcCBvZiBwcm9jRGlycykge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZkcyA9IGZzLnJlYWRkaXJTeW5jKGAvcHJvYy8ke3B9L2ZkYCk7XG4gICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBmZCBvZiBmZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmcy5yZWFkbGlua1N5bmMoYC9wcm9jLyR7cH0vZmQvJHtmZH1gKSA9PT0gYHNvY2tldDpbJHtpbm9kZX1dYCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7IHByb2Nlc3Mua2lsbCgtcGFyc2VJbnQocCksIDkpOyB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHsgcHJvY2Vzcy5raWxsKHBhcnNlSW50KHApLCA5KTsgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBhd2FpdCBraWxsUG9ydChlbnRyeS5wb3J0KTtcbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgIGlmIChhY3RpdmVQcmV2aWV3UG9ydCA9PT0gZW50cnkucG9ydCkgYWN0aXZlUHJldmlld1BvcnQgPSBudWxsO1xuICAgICAgICAgICAgcHJldmlld1Byb2Nlc3Nlcy5kZWxldGUobmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdG9wcGVkOiB0cnVlIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gc291cmNlRG93bmxvYWRQbHVnaW4oKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcInNvdXJjZS1kb3dubG9hZFwiLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL2Rvd25sb2FkLXNvdXJjZVwiLCBhc3luYyAoX3JlcSwgcmVzKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgYXJjaGl2ZXIgPSAoYXdhaXQgaW1wb3J0KFwiYXJjaGl2ZXJcIikpLmRlZmF1bHQ7XG4gICAgICAgICAgY29uc3QgcHJvamVjdFJvb3QgPSBwcm9jZXNzLmN3ZCgpO1xuXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL3ppcFwiKTtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1EaXNwb3NpdGlvblwiLCBcImF0dGFjaG1lbnQ7IGZpbGVuYW1lPWxhbWJkYS1yZWN1cnNpdmUtc291cmNlLnppcFwiKTtcblxuICAgICAgICAgIGNvbnN0IGFyY2hpdmUgPSBhcmNoaXZlcihcInppcFwiLCB7IHpsaWI6IHsgbGV2ZWw6IDkgfSB9KTtcbiAgICAgICAgICBhcmNoaXZlLnBpcGUocmVzKTtcblxuICAgICAgICAgIGNvbnN0IGluY2x1ZGVEaXJzID0gW1wic3JjXCIsIFwicHVibGljXCIsIFwic3VwYWJhc2VcIiwgXCJlbGVjdHJvbi1icm93c2VyXCJdO1xuICAgICAgICAgIGNvbnN0IGluY2x1ZGVGaWxlcyA9IFtcbiAgICAgICAgICAgIFwicGFja2FnZS5qc29uXCIsIFwicGFja2FnZS1sb2NrLmpzb25cIiwgXCJ0c2NvbmZpZy5qc29uXCIsIFwidHNjb25maWcuYXBwLmpzb25cIixcbiAgICAgICAgICAgIFwidHNjb25maWcubm9kZS5qc29uXCIsIFwidml0ZS5jb25maWcudHNcIiwgXCJ0YWlsd2luZC5jb25maWcudHNcIiwgXCJwb3N0Y3NzLmNvbmZpZy5qc1wiLFxuICAgICAgICAgICAgXCJpbmRleC5odG1sXCIsIFwiZXNsaW50LmNvbmZpZy5qc1wiLCBcIi5lbnZcIiwgXCIuZW52LmV4YW1wbGVcIiwgXCJyZXBsaXQubWRcIixcbiAgICAgICAgICAgIFwiY29tcG9uZW50cy5qc29uXCJcbiAgICAgICAgICBdO1xuXG4gICAgICAgICAgZm9yIChjb25zdCBkaXIgb2YgaW5jbHVkZURpcnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KFwiZnNcIik7XG4gICAgICAgICAgICBjb25zdCBkaXJQYXRoID0gcGF0aC5qb2luKHByb2plY3RSb290LCBkaXIpO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZGlyUGF0aCkpIHtcbiAgICAgICAgICAgICAgYXJjaGl2ZS5kaXJlY3RvcnkoZGlyUGF0aCwgZGlyLCAoZW50cnkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZW50cnkubmFtZS5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlc1wiKSB8fCBlbnRyeS5uYW1lLmluY2x1ZGVzKFwiLmNhY2hlXCIpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVudHJ5O1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgaW5jbHVkZUZpbGVzKSB7XG4gICAgICAgICAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydChcImZzXCIpO1xuICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvamVjdFJvb3QsIGZpbGUpO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZmlsZVBhdGgpKSB7XG4gICAgICAgICAgICAgIGFyY2hpdmUuZmlsZShmaWxlUGF0aCwgeyBuYW1lOiBmaWxlIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGF3YWl0IGFyY2hpdmUuZmluYWxpemUoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIkRvd25sb2FkIHNvdXJjZSBlcnJvcjpcIiwgZXJyKTtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgICAgICByZXMuZW5kKFwiRmFpbGVkIHRvIGNyZWF0ZSBzb3VyY2UgYXJjaGl2ZVwiKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IFwiMC4wLjAuMFwiLFxuICAgIHBvcnQ6IDUwMDAsXG4gICAgYWxsb3dlZEhvc3RzOiB0cnVlLFxuICAgIGhtcjoge1xuICAgICAgb3ZlcmxheTogZmFsc2UsXG4gICAgfSxcbiAgICB3YXRjaDoge1xuICAgICAgaWdub3JlZDogW1wiKiovcHJvamVjdHMvKipcIiwgXCIqKi8ubG9jYWwvKipcIiwgXCIqKi9ub2RlX21vZHVsZXMvKipcIiwgXCIqKi8uY2FjaGUvKipcIl0sXG4gICAgfSxcbiAgfSxcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgZmlsZVdyaXRlUGx1Z2luKCksXG4gICAgcHJvamVjdE1hbmFnZW1lbnRQbHVnaW4oKSxcbiAgICBzb3VyY2VEb3dubG9hZFBsdWdpbigpLFxuICAgIFZpdGVQV0Eoe1xuICAgICAgcmVnaXN0ZXJUeXBlOiBcImF1dG9VcGRhdGVcIixcbiAgICAgIGluY2x1ZGVBc3NldHM6IFtcImZhdmljb24uaWNvXCIsIFwicHdhLWljb24tNTEyLnBuZ1wiXSxcbiAgICAgIGRldk9wdGlvbnM6IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICB9LFxuICAgICAgd29ya2JveDoge1xuICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrRGVueWxpc3Q6IFsvXlxcL35vYXV0aC9dLFxuICAgICAgICBnbG9iUGF0dGVybnM6IFtcIioqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLHdvZmYyfVwiXSxcbiAgICAgIH0sXG4gICAgICBtYW5pZmVzdDoge1xuICAgICAgICBuYW1lOiBcIkxhbWJ5XCIsXG4gICAgICAgIHNob3J0X25hbWU6IFwiTGFtYnlcIixcbiAgICAgICAgZGVzY3JpcHRpb246IFwiQUktcG93ZXJlZCBhdXRvbm9tb3VzIGRldmVsb3BtZW50IGxvb3BcIixcbiAgICAgICAgdGhlbWVfY29sb3I6IFwiIzBhMGEwYVwiLFxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiBcIiMwYTBhMGFcIixcbiAgICAgICAgZGlzcGxheTogXCJzdGFuZGFsb25lXCIsXG4gICAgICAgIHNjb3BlOiBcIi9cIixcbiAgICAgICAgc3RhcnRfdXJsOiBcIi9cIixcbiAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6IFwicHdhLWljb24tNTEyLnBuZ1wiLFxuICAgICAgICAgICAgc2l6ZXM6IFwiNTEyeDUxMlwiLFxuICAgICAgICAgICAgdHlwZTogXCJpbWFnZS9wbmdcIixcbiAgICAgICAgICAgIHB1cnBvc2U6IFwiYW55IG1hc2thYmxlXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSksXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgIH0sXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7OztBQUFvUCxTQUFTLG9CQUFpQztBQUM5UixPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsZUFBZTtBQUh4QixJQUFNLG1DQUFtQztBQUt6QyxTQUFTLGtCQUEwQjtBQUNqQyxT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QUNkLEtBQUs7QUFBQSxNQUNILFNBQVM7QUFBQSxJQUNYO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxTQUFTLENBQUMsa0JBQWtCLGdCQUFnQixzQkFBc0IsY0FBYztBQUFBLElBQ2xGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sZ0JBQWdCO0FBQUEsSUFDaEIsd0JBQXdCO0FBQUEsSUFDeEIscUJBQXFCO0FBQUEsSUFDckIsUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsZUFBZSxDQUFDLGVBQWUsa0JBQWtCO0FBQUEsTUFDakQsWUFBWTtBQUFBLFFBQ1YsU0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBLFNBQVM7QUFBQSxRQUNQLDBCQUEwQixDQUFDLFdBQVc7QUFBQSxRQUN0QyxjQUFjLENBQUMsc0NBQXNDO0FBQUEsTUFDdkQ7QUFBQSxNQUNBLFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLFNBQVM7QUFBQSxRQUNULE9BQU87QUFBQSxRQUNQLFdBQVc7QUFBQSxRQUNYLE9BQU87QUFBQSxVQUNMO0FBQUEsWUFDRSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsWUFDTixTQUFTO0FBQUEsVUFDWDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSCxFQUFFLE9BQU8sT0FBTztBQUFBLEVBQ2hCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogWyJkZXRlY3RQbUZvckRpciIsICJmcyIsICJuYW1lIiwgIm1heFdhaXQiLCAic2NyaXB0cyIsICJpc1BucG1Nb25vcmVwbyIsICJjaGlsZCIsICJsYXVuY2hlZCIsICJhbGxEZXBzIiwgInBvc3Rjc3NDb25maWdzIiwgIm5vZGVWZXIiLCAicHJvamVjdERpciIsICJleGVjQXN5bmMiLCAib3MiLCAiaXNXaW4iXQp9Cg==
