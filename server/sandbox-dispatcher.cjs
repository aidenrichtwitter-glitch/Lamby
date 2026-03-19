const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

function detectPmForDir(projDir) {
  if (fs.existsSync(path.join(projDir, "bun.lockb")) || fs.existsSync(path.join(projDir, "bun.lock"))) return "bun";
  if (fs.existsSync(path.join(projDir, "pnpm-lock.yaml")) || fs.existsSync(path.join(projDir, "pnpm-workspace.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projDir, "yarn.lock"))) return "yarn";
  return "npm";
}

function buildPmCommand(pm, action, args = "") {
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

function buildInstallCascade(pm) {
  if (pm === "bun") return ["npx bun install", "npm install --legacy-peer-deps"];
  if (pm === "pnpm") return ["npx pnpm install --no-frozen-lockfile", "npm install --legacy-peer-deps"];
  if (pm === "yarn") return ["npx yarn install --ignore-engines", "npm install --legacy-peer-deps"];
  return [
    "npm install --legacy-peer-deps",
    "npm install --legacy-peer-deps --force",
    "npm install --force --ignore-scripts"
  ];
}

function validateProjectPath(projectName, filePath, projectsDir) {
  if (projectName === "__main__") {
    const projectRoot = path.dirname(projectsDir);
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

function validateBoundedPath(filePath, rootDir) {
  if (!filePath || typeof filePath !== "string") return { valid: false, resolved: "", error: "path required" };
  if (/\0/.test(filePath)) return { valid: false, resolved: "", error: "Null bytes not allowed" };
  const resolved = path.resolve(rootDir, filePath);
  if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) {
    return { valid: false, resolved: "", error: "Path traversal blocked" };
  }
  return { valid: true, resolved };
}

function sanitizeGitArg(val) {
  if (!val || typeof val !== "string") return "";
  const clean = val.trim();
  if (/[;&|`${}()\n\r\t\\]/.test(clean)) return "";
  if (clean.startsWith("-") && !clean.startsWith("--")) return "";
  if (clean.length > 200) return "";
  return clean;
}

const ALLOWED_CMD_PREFIXES = [
  "npm ", "npx ", "yarn ", "pnpm ", "bun ",
  "node ", "deno ", "tsc", "tsx ",
  "mkdir ", "cp ", "mv ", "rm ", "touch ", "cat ", "ls ", "pwd",
  "chmod ", "chown ", "ln ",
  "git ", "curl ", "wget ",
  "python", "pip", "cargo ", "go ", "rustc", "gcc", "g++", "make",
  "docker ", "docker-compose ", "echo ",
];

const sandboxProcesses = new Map();

function executeSandboxAction(action, projectsDir, options) {
  const t = action.type;
  const projectName = action.project || "";
  const _opts = options || {};

  try {
    switch (t) {
      case "list_tree": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const depth = action.depth ?? 4;
        const ignore = new Set(action.ignore || ["node_modules", ".git", "dist", ".cache", ".next"]);
        const entries = [];
        function walk(d, rel, lvl) {
          if (lvl > depth) return;
          let items;
          try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat;
            try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { entries.push(r + "/"); walk(full, r, lvl + 1); }
            else entries.push(r);
          }
        }
        walk(dir, "", 0);
        return { status: "success", type: t, data: { entries } };
      }
      case "read_file": {
        if (!action.path) return { status: "error", type: t, error: "path required" };
        const c = projectName ? validateProjectPath(projectName, action.path, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.path) };
        if (!c.valid) return { status: "error", type: t, error: c.error };
        if (!fs.existsSync(c.resolved)) return { status: "error", type: t, error: "File not found" };
        const content = fs.readFileSync(c.resolved, "utf-8");
        return { status: "success", type: t, data: { path: action.path, content: content.slice(0, 500000) } };
      }
      case "write_file":
      case "create_file": {
        if (!action.path || action.content === undefined) return { status: "error", type: t, error: "path and content required" };
        const c = projectName ? validateProjectPath(projectName, action.path, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.path) };
        if (!c.valid) return { status: "error", type: t, error: c.error };
        const dir = path.dirname(c.resolved);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const existed = fs.existsSync(c.resolved);
        const prev = existed ? fs.readFileSync(c.resolved, "utf-8") : null;
        if (action.mode === "append") { fs.appendFileSync(c.resolved, action.content); }
        else { fs.writeFileSync(c.resolved, action.content); }
        return { status: "success", type: t, data: { path: action.path, created: !existed, previousLength: prev?.length ?? 0 } };
      }
      case "delete_file": {
        if (!action.path) return { status: "error", type: t, error: "path required" };
        const c = projectName ? validateProjectPath(projectName, action.path, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.path) };
        if (!c.valid) return { status: "error", type: t, error: c.error };
        if (!fs.existsSync(c.resolved)) return { status: "error", type: t, error: "File not found" };
        const stat = fs.statSync(c.resolved);
        if (stat.isDirectory()) { fs.rmSync(c.resolved, { recursive: !!action.recursive, force: true }); }
        else { fs.unlinkSync(c.resolved); }
        return { status: "success", type: t, data: { path: action.path } };
      }
      case "move_file":
      case "rename_file": {
        if (!action.source || !action.dest) return { status: "error", type: t, error: "source and dest required" };
        const src = projectName ? validateProjectPath(projectName, action.source, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.source) };
        const dst = projectName ? validateProjectPath(projectName, action.dest, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.dest) };
        if (!src.valid) return { status: "error", type: t, error: src.error };
        if (!dst.valid) return { status: "error", type: t, error: dst.error };
        if (!fs.existsSync(src.resolved)) return { status: "error", type: t, error: "Source not found" };
        const dstDir = path.dirname(dst.resolved);
        if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
        fs.renameSync(src.resolved, dst.resolved);
        return { status: "success", type: t, data: { source: action.source, dest: action.dest } };
      }
      case "copy_file": {
        if (!action.source || !action.dest) return { status: "error", type: t, error: "source and dest required" };
        const src = projectName ? validateProjectPath(projectName, action.source, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.source) };
        const dst = projectName ? validateProjectPath(projectName, action.dest, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.dest) };
        if (!src.valid) return { status: "error", type: t, error: src.error };
        if (!dst.valid) return { status: "error", type: t, error: dst.error };
        if (!fs.existsSync(src.resolved)) return { status: "error", type: t, error: "Source not found" };
        const dstDir = path.dirname(dst.resolved);
        if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
        fs.copyFileSync(src.resolved, dst.resolved);
        return { status: "success", type: t, data: { source: action.source, dest: action.dest } };
      }
      case "grep": {
        if (!action.pattern) return { status: "error", type: t, error: "pattern required" };
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const exts = action.extensions || [".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".py", ".rs", ".go", ".txt", ".md", ".yaml", ".yml", ".toml", ".sh", ".sql", ".vue", ".svelte"];
        const matches = [];
        const re = new RegExp(action.pattern, action.case_sensitive ? "g" : "gi");
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next"]);
        function grepWalk(d, rel) {
          let items;
          try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat;
            try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { grepWalk(full, r); }
            else if (exts.some(e => item.endsWith(e))) {
              try {
                const content = fs.readFileSync(full, "utf-8");
                const lines = content.split("\n");
                for (let i = 0; i < lines.length; i++) {
                  if (re.test(lines[i])) { matches.push({ file: r, line: i + 1, text: lines[i].trim().slice(0, 200) }); }
                  re.lastIndex = 0;
                }
              } catch {}
            }
            if (matches.length >= 100) return;
          }
        }
        grepWalk(dir, "");
        return { status: "success", type: t, data: { pattern: action.pattern, matches: matches.slice(0, 100) } };
      }
      case "search_files": {
        if (!action.pattern) return { status: "error", type: t, error: "pattern required" };
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const re = new RegExp(action.pattern, "i");
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next"]);
        const results = [];
        function searchWalk(d, rel) {
          let items;
          try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat;
            try { stat = fs.statSync(full); } catch { continue; }
            if (re.test(item)) results.push(r);
            if (stat.isDirectory()) searchWalk(full, r);
            if (results.length >= 100) return;
          }
        }
        searchWalk(dir, "");
        return { status: "success", type: t, data: { pattern: action.pattern, files: results.slice(0, 100) } };
      }
      case "run_command": {
        if (!action.command) return { status: "error", type: t, error: "command required" };
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const cmd = action.command.trim();
        const isAllowed = ALLOWED_CMD_PREFIXES.some(p => cmd.startsWith(p));
        if (!isAllowed) return { status: "error", type: t, error: `Command not allowed: ${cmd.slice(0, 50)}` };
        const cmdOutsideQuotes = cmd.replace(/"[^"]*"/g, "").replace(/'[^']*'/g, "");
        if (/[;&|`${}]/.test(cmdOutsideQuotes)) return { status: "error", type: t, error: "Shell metacharacters not allowed" };
        const timeout = Math.min(action.timeout || 30000, 120000);
        try {
          const output = childProcess.execSync(cmd, {
            cwd: dir, timeout, maxBuffer: 4 * 1024 * 1024,
            env: { ...process.env, ...(action.env || {}) },
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });
          return { status: "success", type: t, data: { command: cmd, output: (output || "").slice(0, 50000) } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 2000), data: { command: cmd, stdout: (e.stdout || "").slice(0, 10000), stderr: (e.stderr || "").slice(0, 10000) } };
        }
      }
      case "install_deps": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const pm = detectPmForDir(dir);
        const installCmd = buildPmCommand(pm, "install");
        try {
          const output = childProcess.execSync(installCmd, { cwd: dir, timeout: 120000, maxBuffer: 4 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: installCmd, output: (output || "").slice(0, 20000) } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 2000) };
        }
      }
      case "git_status":
      case "git_add":
      case "git_commit":
      case "git_diff":
      case "git_log":
      case "git_branch":
      case "git_checkout":
      case "git_stash":
      case "git_init": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        let gitCmd = "";
        switch (t) {
          case "git_status": gitCmd = "git status --porcelain"; break;
          case "git_add": gitCmd = `git add ${action.files || "."}`; break;
          case "git_commit": gitCmd = `git commit -m "${(action.message || "auto-commit").replace(/"/g, '\\"')}"`; break;
          case "git_diff": gitCmd = `git diff ${action.args || ""}`; break;
          case "git_log": gitCmd = `git log --oneline -${action.count || 10}`; break;
          case "git_branch": gitCmd = action.name ? `git branch ${action.name}` : "git branch"; break;
          case "git_checkout": gitCmd = `git checkout ${action.ref || "main"}`; break;
          case "git_stash": gitCmd = `git stash ${action.args || ""}`; break;
          case "git_init": gitCmd = "git init"; break;
        }
        try {
          const output = childProcess.execSync(gitCmd, { cwd: dir, timeout: 15000, maxBuffer: 2 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: gitCmd, output: (output || "").trim().slice(0, 50000) } };
        } catch (e) {
          return { status: "error", type: t, error: (e.stderr || e.message || "").slice(0, 2000), data: { command: gitCmd, stdout: (e.stdout || "").slice(0, 5000) } };
        }
      }
      case "detect_structure": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const hasPkg = fs.existsSync(path.join(dir, "package.json"));
        const hasCargo = fs.existsSync(path.join(dir, "Cargo.toml"));
        const hasGoMod = fs.existsSync(path.join(dir, "go.mod"));
        const hasPy = fs.existsSync(path.join(dir, "requirements.txt")) || fs.existsSync(path.join(dir, "pyproject.toml"));
        let pkg = {};
        if (hasPkg) try { pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8")); } catch {}
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        let framework = "unknown";
        if (deps?.next) framework = "next";
        else if (deps?.react) framework = "react";
        else if (deps?.vue) framework = "vue";
        else if (deps?.svelte) framework = "svelte";
        else if (deps?.express) framework = "express";
        else if (deps?.fastify) framework = "fastify";
        else if (hasCargo) framework = "rust";
        else if (hasGoMod) framework = "go";
        else if (hasPy) framework = "python";
        const pm = hasPkg ? detectPmForDir(dir) : "none";
        return { status: "success", type: t, data: { framework, packageManager: pm, hasPackageJson: hasPkg, hasCargo, hasGoMod, hasPython: hasPy, name: pkg.name || path.basename(dir) } };
      }
      case "start_process": {
        if (!action.command) return { status: "error", type: t, error: "command required" };
        const pName = action.name || `proc-${Date.now()}`;
        if (sandboxProcesses.has(pName)) return { status: "error", type: t, error: `Process '${pName}' already running` };
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        const parts = action.command.split(" ");
        const proc = childProcess.spawn(parts[0], parts.slice(1), { cwd: dir, env: { ...process.env, ...(action.env || {}) }, stdio: ["pipe", "pipe", "pipe"], detached: false });
        const logs = { stdout: "", stderr: "" };
        proc.stdout?.on("data", (d) => { logs.stdout += d.toString(); if (logs.stdout.length > 50000) logs.stdout = logs.stdout.slice(-25000); });
        proc.stderr?.on("data", (d) => { logs.stderr += d.toString(); if (logs.stderr.length > 50000) logs.stderr = logs.stderr.slice(-25000); });
        proc.on("exit", () => { sandboxProcesses.delete(pName); });
        sandboxProcesses.set(pName, { proc, cmd: action.command, startedAt: Date.now(), logs });
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ status: "success", type: t, data: { name: pName, pid: proc.pid, output: logs.stdout.slice(0, 5000), stderr: logs.stderr.slice(0, 2000) } });
          }, 500);
        });
      }
      case "kill_process": {
        const pName = action.name;
        if (!pName) return { status: "error", type: t, error: "name required" };
        const entry = sandboxProcesses.get(pName);
        if (!entry) return { status: "error", type: t, error: `No process named '${pName}'` };
        try { entry.proc.kill("SIGTERM"); } catch {}
        sandboxProcesses.delete(pName);
        return { status: "success", type: t, data: { name: pName, killed: true } };
      }
      case "list_processes": {
        const procs = Array.from(sandboxProcesses.entries()).map(([n, e]) => ({ name: n, cmd: e.cmd, pid: e.proc.pid, running: !e.proc.killed, startedAt: e.startedAt }));
        return { status: "success", type: t, data: { processes: procs } };
      }
      case "build_project": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const pm = detectPmForDir(dir);
        const buildCmd = buildPmCommand(pm, "build");
        try {
          const output = childProcess.execSync(buildCmd, { cwd: dir, timeout: 120000, maxBuffer: 4 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: buildCmd, output: (output || "").slice(0, 20000) } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 2000), data: { stdout: (e.stdout || "").slice(0, 10000), stderr: (e.stderr || "").slice(0, 10000) } };
        }
      }
      case "run_tests": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const pm = detectPmForDir(dir);
        const testCmd = action.command || buildPmCommand(pm, "run", "test");
        try {
          const output = childProcess.execSync(testCmd, { cwd: dir, timeout: 120000, maxBuffer: 4 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: testCmd, output: (output || "").slice(0, 20000) } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 2000), data: { stdout: (e.stdout || "").slice(0, 10000), stderr: (e.stderr || "").slice(0, 10000) } };
        }
      }
      case "archive_project":
      case "export_project": {
        if (!projectName) return { status: "error", type: t, error: "project name required" };
        const dir = validateProjectPath(projectName, null, projectsDir).resolved;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Project not found" };
        const fmt = action.format || "tar.gz";
        const archiveName = `${projectName}-${Date.now()}.${fmt === "zip" ? "zip" : "tar.gz"}`;
        const archivePath = path.join(projectsDir, archiveName);
        try {
          if (fmt === "zip") {
            childProcess.execSync(`cd "${projectsDir}" && zip -r "${archivePath}" "${projectName}" -x "*/node_modules/*" -x "*/.git/*" -x "*/dist/*" -x "*/.cache/*"`, { timeout: 60000 });
          } else {
            childProcess.execSync(`tar --exclude=node_modules --exclude=.git --exclude=dist --exclude=.cache -czf "${archivePath}" -C "${projectsDir}" "${projectName}"`, { timeout: 60000 });
          }
          return { status: "success", type: t, data: { archive: archiveName, path: archivePath, format: fmt } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 1000) };
        }
      }
      case "read_multiple_files": {
        if (!Array.isArray(action.paths) || action.paths.length === 0) return { status: "error", type: t, error: "paths array required" };
        const files = [];
        for (const p of action.paths.slice(0, 50)) {
          const c = projectName ? validateProjectPath(projectName, p, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, p) };
          if (!c.valid) { files.push({ path: p, error: c.error }); continue; }
          if (!fs.existsSync(c.resolved)) { files.push({ path: p, error: "File not found" }); continue; }
          try { files.push({ path: p, content: fs.readFileSync(c.resolved, "utf-8").slice(0, 500000) }); }
          catch (e) { files.push({ path: p, error: e.message }); }
        }
        return { status: "success", type: t, data: { files } };
      }
      case "bulk_write": {
        if (!Array.isArray(action.files) || action.files.length === 0) return { status: "error", type: t, error: "files array required" };
        const backups = [];
        const written = [];
        try {
          for (const f of action.files) {
            if (!f.path || f.content === undefined) throw new Error(`Missing path/content for file: ${f.path || "?"}`);
            const c = projectName ? validateProjectPath(projectName, f.path, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, f.path) };
            if (!c.valid) throw new Error(`Invalid path ${f.path}: ${c.error}`);
            const dir = path.dirname(c.resolved);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const existed = fs.existsSync(c.resolved);
            const prev = existed ? fs.readFileSync(c.resolved, "utf-8") : null;
            backups.push({ resolved: c.resolved, existed, prev });
            fs.writeFileSync(c.resolved, f.content);
            written.push(f.path);
          }
          return { status: "success", type: t, data: { written, count: written.length } };
        } catch (e) {
          for (const b of backups) {
            try {
              if (b.existed && b.prev !== null) fs.writeFileSync(b.resolved, b.prev);
              else if (!b.existed && fs.existsSync(b.resolved)) fs.unlinkSync(b.resolved);
            } catch {}
          }
          return { status: "error", type: t, error: `Atomic write failed (rolled back): ${e.message}` };
        }
      }
      case "bulk_delete": {
        if (!Array.isArray(action.paths) || action.paths.length === 0) return { status: "error", type: t, error: "paths array required" };
        const deleted = [];
        const errors = [];
        for (const p of action.paths) {
          const c = projectName ? validateProjectPath(projectName, p, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, p) };
          if (!c.valid) { errors.push({ path: p, error: c.error }); continue; }
          if (!fs.existsSync(c.resolved)) { errors.push({ path: p, error: "Not found" }); continue; }
          try {
            const stat = fs.statSync(c.resolved);
            if (stat.isDirectory()) fs.rmSync(c.resolved, { recursive: true, force: true });
            else fs.unlinkSync(c.resolved);
            deleted.push(p);
          } catch (e) { errors.push({ path: p, error: e.message }); }
        }
        return { status: "success", type: t, data: { deleted, errors } };
      }
      case "copy_folder": {
        if (!action.source || !action.dest) return { status: "error", type: t, error: "source and dest required" };
        const src = projectName ? validateProjectPath(projectName, action.source, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.source) };
        const dst = projectName ? validateProjectPath(projectName, action.dest, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.dest) };
        if (!src.valid) return { status: "error", type: t, error: src.error };
        if (!dst.valid) return { status: "error", type: t, error: dst.error };
        if (!fs.existsSync(src.resolved)) return { status: "error", type: t, error: "Source folder not found" };
        try {
          fs.cpSync(src.resolved, dst.resolved, { recursive: true });
          return { status: "success", type: t, data: { source: action.source, dest: action.dest } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 1000) };
        }
      }
      case "search_replace": {
        const filePaths = action.paths || (action.path ? [action.path] : []);
        if (filePaths.length === 0 || !action.search) return { status: "error", type: t, error: "path(s) and search required" };
        const replaceWith = action.replace ?? "";
        const useRegex = !!action.regex;
        const results = [];
        for (const fp of filePaths) {
          const c = projectName ? validateProjectPath(projectName, fp, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, fp) };
          if (!c.valid) { results.push({ path: fp, error: c.error }); continue; }
          if (!fs.existsSync(c.resolved)) { results.push({ path: fp, error: "File not found" }); continue; }
          try {
            let content = fs.readFileSync(c.resolved, "utf-8");
            const pattern = useRegex ? new RegExp(action.search, "g") : action.search;
            const count = useRegex ? (content.match(pattern) || []).length : content.split(action.search).length - 1;
            if (count === 0) { results.push({ path: fp, replacements: 0 }); continue; }
            content = useRegex ? content.replace(pattern, replaceWith) : content.split(action.search).join(replaceWith);
            fs.writeFileSync(c.resolved, content);
            results.push({ path: fp, replacements: count });
          } catch (e) { results.push({ path: fp, error: e.message }); }
        }
        return { status: "success", type: t, data: { results } };
      }
      case "apply_patch": {
        if (!action.patch) return { status: "error", type: t, error: "patch (unified diff) required" };
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const lines = action.patch.split("\n");
        let currentFile = null;
        let hunks = [];
        let appliedFiles = [];
        let errors = [];
        function flushFile() {
          if (!currentFile || hunks.length === 0) return;
          if (/\.\.[\\/]/.test(currentFile) || currentFile.startsWith("/")) {
            errors.push({ file: currentFile, error: "Path traversal blocked" });
            hunks = [];
            return;
          }
          const patchCheck = projectName ? validateProjectPath(projectName, currentFile, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, currentFile) };
          if (!patchCheck.valid) {
            errors.push({ file: currentFile, error: patchCheck.error });
            hunks = [];
            return;
          }
          const filePath = patchCheck.resolved;
          try {
            let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
            let contentLines = content.split("\n");
            let offset = 0;
            let hunkErrors = [];
            for (let hi = 0; hi < hunks.length; hi++) {
              const hunk = hunks[hi];
              const startLine = hunk.oldStart - 1 + offset;
              let contextMatch = true;
              for (let ri = 0; ri < hunk.removes.length; ri++) {
                const lineIdx = startLine + ri;
                if (lineIdx >= contentLines.length) { contextMatch = false; break; }
                const actual = contentLines[lineIdx].trimEnd();
                const expected = hunk.removes[ri].trimEnd();
                if (actual !== expected) { contextMatch = false; break; }
              }
              if (!contextMatch) {
                let found = false;
                for (let search = Math.max(0, startLine - 10); search < Math.min(contentLines.length, startLine + 10); search++) {
                  let match = true;
                  for (let ri = 0; ri < hunk.removes.length; ri++) {
                    if (search + ri >= contentLines.length || contentLines[search + ri].trimEnd() !== hunk.removes[ri].trimEnd()) { match = false; break; }
                  }
                  if (match) {
                    const removeCount = hunk.removes.length;
                    contentLines.splice(search, removeCount, ...hunk.adds);
                    offset += hunk.adds.length - removeCount;
                    found = true;
                    break;
                  }
                }
                if (!found) {
                  hunkErrors.push(`Hunk ${hi + 1} at line ${hunk.oldStart}: context mismatch`);
                }
              } else {
                const removeCount = hunk.removes.length;
                contentLines.splice(startLine, removeCount, ...hunk.adds);
                offset += hunk.adds.length - removeCount;
              }
            }
            const parentDir = path.dirname(filePath);
            if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
            if (hunkErrors.length > 0 && hunkErrors.length === hunks.length) {
              errors.push({ file: currentFile, error: `All hunks failed: ${hunkErrors.join("; ")}` });
            } else {
              fs.writeFileSync(filePath, contentLines.join("\n"));
              appliedFiles.push(currentFile);
              if (hunkErrors.length > 0) errors.push({ file: currentFile, warning: `Partial: ${hunkErrors.join("; ")}` });
            }
          } catch (e) { errors.push({ file: currentFile, error: e.message }); }
          hunks = [];
        }
        for (const line of lines) {
          if (line.startsWith("--- ") || line.startsWith("+++ ")) {
            if (line.startsWith("+++ ")) {
              flushFile();
              let fp = line.slice(4).trim();
              if (fp.startsWith("b/")) fp = fp.slice(2);
              if (fp === "/dev/null") fp = null;
              currentFile = fp;
            }
            continue;
          }
          const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
          if (hunkMatch) {
            hunks.push({ oldStart: parseInt(hunkMatch[1]), adds: [], removes: [] });
            continue;
          }
          if (hunks.length > 0) {
            const h = hunks[hunks.length - 1];
            if (line.startsWith("+")) h.adds.push(line.slice(1));
            else if (line.startsWith("-")) h.removes.push(line.slice(1));
            else if (line.startsWith(" ")) { h.adds.push(line.slice(1)); h.removes.push(line.slice(1)); }
          }
        }
        flushFile();
        return { status: "success", type: t, data: { appliedFiles, errors } };
      }
      case "add_dependency": {
        if (!action.name) return { status: "error", type: t, error: "name required" };
        const pkgName = action.name.trim();
        if (!/^(@[a-z0-9\-~][a-z0-9\-._~]*\/)?[a-z0-9\-~][a-z0-9\-._~]*$/.test(pkgName)) {
          return { status: "error", type: t, error: "Invalid package name" };
        }
        if (action.version && !/^[a-z0-9\-._~^<>=|*\s]+$/i.test(action.version)) {
          return { status: "error", type: t, error: "Invalid version string" };
        }
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const pm = detectPmForDir(dir);
        const pkg = action.version ? `${pkgName}@${action.version.trim()}` : pkgName;
        const addCmd = buildPmCommand(pm, action.dev ? "add-dev" : "add", pkg);
        try {
          const output = childProcess.execSync(addCmd, { cwd: dir, timeout: 120000, maxBuffer: 4 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: addCmd, package: pkgName, version: action.version || "latest", dev: !!action.dev, output: (output || "").slice(0, 10000) } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 2000), data: { command: addCmd } };
        }
      }
      case "type_check": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const tscCmd = fs.existsSync(path.join(dir, "node_modules/.bin/tsc")) ? path.join(dir, "node_modules/.bin/tsc") + " --noEmit" : "npx tsc --noEmit";
        try {
          const output = childProcess.execSync(tscCmd, { cwd: dir, timeout: 60000, maxBuffer: 4 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: tscCmd, output: (output || "").slice(0, 20000), errors: 0 } };
        } catch (e) {
          const combined = ((e.stdout || "") + "\n" + (e.stderr || "")).trim();
          const errorCount = (combined.match(/error TS\d+/g) || []).length;
          return { status: "error", type: t, error: combined.slice(0, 5000), data: { command: tscCmd, errors: errorCount } };
        }
      }
      case "lint_and_fix": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const target = sanitizeGitArg(action.files) || ".";
        let lintCmd;
        if (fs.existsSync(path.join(dir, "node_modules/.bin/eslint"))) {
          lintCmd = `${path.join(dir, "node_modules/.bin/eslint")} --fix ${target}`;
        } else if (fs.existsSync(path.join(dir, "node_modules/.bin/prettier"))) {
          lintCmd = `${path.join(dir, "node_modules/.bin/prettier")} --write ${target}`;
        } else {
          lintCmd = `npx eslint --fix ${target}`;
        }
        try {
          const output = childProcess.execSync(lintCmd, { cwd: dir, timeout: 60000, maxBuffer: 4 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: lintCmd, output: (output || "").slice(0, 10000) } };
        } catch (e) {
          return { status: "error", type: t, error: (e.stderr || e.message || "").slice(0, 5000), data: { command: lintCmd, stdout: (e.stdout || "").slice(0, 5000) } };
        }
      }
      case "format_files": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const target = sanitizeGitArg(action.files) || ".";
        let fmtCmd;
        if (fs.existsSync(path.join(dir, "node_modules/.bin/prettier"))) {
          fmtCmd = `${path.join(dir, "node_modules/.bin/prettier")} --write "${target}"`;
        } else {
          fmtCmd = `npx prettier --write "${target}"`;
        }
        try {
          const output = childProcess.execSync(fmtCmd, { cwd: dir, timeout: 60000, maxBuffer: 4 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: fmtCmd, output: (output || "").slice(0, 10000) } };
        } catch (e) {
          return { status: "error", type: t, error: (e.stderr || e.message || "").slice(0, 5000), data: { command: fmtCmd } };
        }
      }
      case "get_build_metrics": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        let buildOutput = null;
        let buildError = null;
        if (action.runBuild !== false) {
          const pm = detectPmForDir(dir);
          const buildCmd = buildPmCommand(pm, "build");
          try {
            buildOutput = childProcess.execSync(buildCmd, { cwd: dir, timeout: 120000, maxBuffer: 4 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
            buildOutput = (buildOutput || "").slice(0, 5000);
          } catch (e) {
            buildError = (e.stderr || e.message || "").slice(0, 3000);
          }
        }
        const distDirs = ["dist", ".next", "build", "out"];
        let distDir = null;
        for (const d of distDirs) {
          const p = path.join(dir, d);
          if (fs.existsSync(p)) { distDir = p; break; }
        }
        const metrics = { distDir: distDir ? path.basename(distDir) : null, files: [], totalSize: 0, buildOutput, buildError };
        if (distDir) {
          function walkDist(d, rel) {
            try {
              for (const item of fs.readdirSync(d)) {
                const full = path.join(d, item);
                const r = rel ? `${rel}/${item}` : item;
                try {
                  const stat = fs.statSync(full);
                  if (stat.isDirectory()) walkDist(full, r);
                  else { metrics.files.push({ path: r, size: stat.size }); metrics.totalSize += stat.size; }
                } catch {}
              }
            } catch {}
          }
          walkDist(distDir, "");
          metrics.files.sort((a, b) => b.size - a.size);
          metrics.files = metrics.files.slice(0, 50);
        }
        return { status: "success", type: t, data: metrics };
      }
      case "restart_dev_server": {
        for (const [name, entry] of sandboxProcesses) {
          try { entry.proc.kill("SIGTERM"); } catch {}
          sandboxProcesses.delete(name);
        }
        if (action.command) {
          const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
          const parts = action.command.split(" ");
          const proc = childProcess.spawn(parts[0], parts.slice(1), { cwd: dir, env: { ...process.env, ...(action.env || {}) }, stdio: ["pipe", "pipe", "pipe"], detached: false });
          const logs = { stdout: "", stderr: "" };
          proc.stdout?.on("data", (d) => { logs.stdout += d.toString(); if (logs.stdout.length > 50000) logs.stdout = logs.stdout.slice(-25000); });
          proc.stderr?.on("data", (d) => { logs.stderr += d.toString(); if (logs.stderr.length > 50000) logs.stderr = logs.stderr.slice(-25000); });
          const pName = action.name || "dev-server";
          proc.on("exit", () => { sandboxProcesses.delete(pName); });
          sandboxProcesses.set(pName, { proc, cmd: action.command, startedAt: Date.now(), logs });
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({ status: "success", type: t, data: { killedAll: true, restarted: pName, pid: proc.pid, output: logs.stdout.slice(0, 5000) } });
            }, 1000);
          });
        }
        return { status: "success", type: t, data: { killedAll: true, restarted: false } };
      }
      case "list_open_ports": {
        try {
          let output = "";
          try { output = childProcess.execFileSync("ss", ["-tlnp"], { timeout: 5000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }); }
          catch { try { output = childProcess.execFileSync("netstat", ["-tlnp"], { timeout: 5000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }); } catch { output = "no port listing tool available"; } }
          const ports = [];
          const lines = output.split("\n");
          for (const line of lines) {
            const portMatch = line.match(/:(\d{4,5})\b/);
            if (portMatch) {
              const p = parseInt(portMatch[1]);
              if (p >= 1024 && p <= 65535 && !ports.includes(p)) ports.push(p);
            }
          }
          return { status: "success", type: t, data: { ports: ports.sort((a, b) => a - b), raw: output.slice(0, 5000) } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 1000) };
        }
      }
      case "git_push": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const remote = sanitizeGitArg(action.remote) || "origin";
        const branch = sanitizeGitArg(action.branch);
        if (!remote) return { status: "error", type: t, error: "Invalid remote name" };
        const gitCmd = branch ? `git push ${remote} ${branch}` : `git push ${remote}`;
        try {
          const output = childProcess.execSync(gitCmd, { cwd: dir, timeout: 30000, maxBuffer: 2 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: gitCmd, output: (output || "").trim().slice(0, 10000) } };
        } catch (e) {
          return { status: "error", type: t, error: (e.stderr || e.message || "").slice(0, 2000), data: { command: gitCmd } };
        }
      }
      case "git_pull": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const remote = sanitizeGitArg(action.remote) || "origin";
        const branch = sanitizeGitArg(action.branch);
        if (!remote) return { status: "error", type: t, error: "Invalid remote name" };
        const gitCmd = branch ? `git pull ${remote} ${branch}` : `git pull ${remote}`;
        try {
          const output = childProcess.execSync(gitCmd, { cwd: dir, timeout: 30000, maxBuffer: 2 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: gitCmd, output: (output || "").trim().slice(0, 10000) } };
        } catch (e) {
          return { status: "error", type: t, error: (e.stderr || e.message || "").slice(0, 2000), data: { command: gitCmd } };
        }
      }
      case "git_merge": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const branch = sanitizeGitArg(action.branch);
        if (!branch) return { status: "error", type: t, error: "branch required (valid git branch name)" };
        const gitCmd = `git merge ${branch}`;
        try {
          const output = childProcess.execSync(gitCmd, { cwd: dir, timeout: 30000, maxBuffer: 2 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: gitCmd, output: (output || "").trim().slice(0, 10000) } };
        } catch (e) {
          return { status: "error", type: t, error: (e.stderr || e.message || "").slice(0, 2000), data: { command: gitCmd, stdout: (e.stdout || "").slice(0, 5000) } };
        }
      }
      case "set_env_var": {
        if (!action.key) return { status: "error", type: t, error: "key required" };
        const envFileName = action.file || ".env";
        const envCheck = projectName ? validateProjectPath(projectName, envFileName, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, envFileName) };
        if (!envCheck.valid) return { status: "error", type: t, error: envCheck.error };
        const dir = path.dirname(envCheck.resolved);
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const envPath = envCheck.resolved;
        let envContent = "";
        try { envContent = fs.readFileSync(envPath, "utf-8"); } catch {}
        const envLines = envContent.split("\n");
        const keyPattern = new RegExp(`^${action.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`);
        let found = false;
        for (let i = 0; i < envLines.length; i++) {
          if (keyPattern.test(envLines[i])) {
            envLines[i] = `${action.key}=${action.value ?? ""}`;
            found = true;
            break;
          }
        }
        if (!found) envLines.push(`${action.key}=${action.value ?? ""}`);
        fs.writeFileSync(envPath, envLines.join("\n"));
        return { status: "success", type: t, data: { key: action.key, file: action.file || ".env", updated: found, created: !found } };
      }
      case "get_env_vars": {
        const getEnvFileName = action.file || ".env";
        const getEnvCheck = projectName ? validateProjectPath(projectName, getEnvFileName, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, getEnvFileName) };
        if (!getEnvCheck.valid) return { status: "error", type: t, error: getEnvCheck.error };
        const envPath = getEnvCheck.resolved;
        if (!fs.existsSync(envPath)) return { status: "success", type: t, data: { vars: {}, file: action.file || ".env", exists: false } };
        const envContent = fs.readFileSync(envPath, "utf-8");
        const vars = {};
        for (const line of envContent.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
        }
        return { status: "success", type: t, data: { vars, file: action.file || ".env", exists: true } };
      }
      case "rollback_last_change": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        if (action.files) {
          const filesList = Array.isArray(action.files) ? action.files : [action.files];
          const sanitizedFiles = filesList.map(f => sanitizeGitArg(f)).filter(Boolean);
          if (sanitizedFiles.length === 0) return { status: "error", type: t, error: "Invalid file paths" };
          for (const f of sanitizedFiles) {
            const check = projectName ? validateProjectPath(projectName, f, projectsDir) : { valid: true };
            if (!check.valid) return { status: "error", type: t, error: `Invalid path: ${f}` };
          }
          const gitCmd = `git checkout -- ${sanitizedFiles.join(" ")}`;
          try {
            const output = childProcess.execSync(gitCmd, { cwd: dir, timeout: 10000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
            return { status: "success", type: t, data: { command: gitCmd, output: (output || "").trim() } };
          } catch (e) {
            return { status: "error", type: t, error: (e.stderr || e.message || "").slice(0, 2000) };
          }
        }
        try {
          const output = childProcess.execSync("git stash apply", { cwd: dir, timeout: 10000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: "git stash apply", output: (output || "").trim() } };
        } catch (e) {
          try {
            const output2 = childProcess.execSync("git checkout -- .", { cwd: dir, timeout: 10000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
            return { status: "success", type: t, data: { command: "git checkout -- .", output: (output2 || "").trim() } };
          } catch (e2) {
            return { status: "error", type: t, error: (e2.stderr || e2.message || "").slice(0, 2000) };
          }
        }
      }
      case "project_analyze": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next", ".nuxt", "__pycache__", "build", ".output"]);
        const filesByExt = {};
        let totalFiles = 0;
        const components = [];
        const routes = [];
        function analyzeWalk(d, rel) {
          let items;
          try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat;
            try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { analyzeWalk(full, r); continue; }
            totalFiles++;
            const ext = path.extname(item).toLowerCase();
            filesByExt[ext] = (filesByExt[ext] || 0) + 1;
            if (/\.(tsx|jsx)$/.test(item) && /^[A-Z]/.test(item)) components.push(r);
            if (/pages\/|routes\/|app\//i.test(r) && /\.(tsx|jsx|ts|js|vue|svelte)$/.test(item)) routes.push(r);
          }
        }
        analyzeWalk(dir, "");
        let pkg = {};
        try { pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8")); } catch {}
        const deps = Object.keys(pkg.dependencies || {});
        const devDeps = Object.keys(pkg.devDependencies || {});
        const colors = [];
        try {
          const cssFiles = [];
          function findCss(d, rel) {
            let items;
            try { items = fs.readdirSync(d); } catch { return; }
            for (const item of items) {
              if (ignore.has(item)) continue;
              const full = path.join(d, item);
              const r = rel ? `${rel}/${item}` : item;
              try {
                const s = fs.statSync(full);
                if (s.isDirectory()) findCss(full, r);
                else if (/\.css$/.test(item)) cssFiles.push(full);
              } catch {}
            }
          }
          findCss(dir, "");
          for (const cf of cssFiles.slice(0, 10)) {
            const content = fs.readFileSync(cf, "utf-8");
            const varMatches = content.match(/--[\w-]+\s*:\s*[^;]+/g);
            if (varMatches) for (const m of varMatches.slice(0, 50)) {
              const [name, ...rest] = m.split(":");
              colors.push({ variable: name.trim(), value: rest.join(":").trim() });
            }
          }
        } catch {}
        return { status: "success", type: t, data: { totalFiles, filesByExtension: filesByExt, components: components.slice(0, 100), routes: routes.slice(0, 100), dependencies: deps, devDependencies: devDeps, name: pkg.name || path.basename(dir), cssVariables: colors.slice(0, 100) } };
      }
      case "tailwind_audit": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const twConfigCandidates = ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs", "tailwind.config.mjs"];
        let twConfigPath = null;
        let twConfig = null;
        for (const c of twConfigCandidates) {
          const p = path.join(dir, c);
          if (fs.existsSync(p)) { twConfigPath = c; twConfig = fs.readFileSync(p, "utf-8"); break; }
        }
        const hasTw = !!twConfigPath || (fs.existsSync(path.join(dir, "package.json")) && fs.readFileSync(path.join(dir, "package.json"), "utf-8").includes("tailwindcss"));
        const customColors = [];
        const breakpoints = [];
        const plugins = [];
        if (twConfig) {
          const colorMatches = twConfig.match(/colors?\s*:\s*\{[\s\S]*?\}/g);
          if (colorMatches) for (const cm of colorMatches.slice(0, 5)) customColors.push(cm.slice(0, 500));
          const bpMatches = twConfig.match(/screens?\s*:\s*\{[\s\S]*?\}/g);
          if (bpMatches) for (const bm of bpMatches.slice(0, 3)) breakpoints.push(bm.slice(0, 300));
          const pluginMatch = twConfig.match(/plugins\s*:\s*\[[\s\S]*?\]/);
          if (pluginMatch) plugins.push(pluginMatch[0].slice(0, 500));
        }
        const usedClasses = new Set();
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next"]);
        function twWalk(d) {
          let items;
          try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            try {
              const s = fs.statSync(full);
              if (s.isDirectory()) { twWalk(full); continue; }
              if (!/\.(tsx|jsx|html|vue|svelte)$/.test(item)) continue;
              const content = fs.readFileSync(full, "utf-8");
              const classMatches = content.match(/class(?:Name)?\s*=\s*["'`][^"'`]*["'`]/g);
              if (classMatches) for (const cm of classMatches) {
                const classes = cm.replace(/^class(?:Name)?\s*=\s*["'`]/, "").replace(/["'`]$/, "").split(/\s+/);
                for (const c of classes) if (c && !c.includes("{")) usedClasses.add(c);
              }
            } catch {}
            if (usedClasses.size > 500) return;
          }
        }
        twWalk(dir);
        const commonUtilities = ["flex","grid","block","inline","hidden","relative","absolute","fixed","sticky","p-","m-","w-","h-","text-","bg-","border","rounded","shadow","opacity","overflow","z-","gap-","justify-","items-","self-","font-","leading-","tracking-","space-","divide-","ring-","transition","duration-","ease-","animate-","cursor-","select-","resize","fill-","stroke-","sr-only","container","mx-auto","max-w-","min-w-","max-h-","min-h-"];
        const usedArray = Array.from(usedClasses);
        const unusedUtilities = commonUtilities.filter(prefix => !usedArray.some(c => c.startsWith(prefix) || c.includes(`:${prefix}`)));
        return { status: "success", type: t, data: { hasTailwind: hasTw, configFile: twConfigPath, configContent: twConfig ? twConfig.slice(0, 5000) : null, customColors, breakpoints, plugins, usedClassesSample: usedArray.slice(0, 200), unusedUtilityPrefixes: unusedUtilities, totalUsedClasses: usedClasses.size } };
      }
      case "find_usages": {
        if (!action.symbol) return { status: "error", type: t, error: "symbol required" };
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const symbol = action.symbol;
        const exts = action.extensions || [".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".vue", ".svelte", ".json", ".md"];
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next"]);
        const context = action.context || 2;
        const usages = [];
        function usageWalk(d, rel) {
          let items;
          try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            try {
              const s = fs.statSync(full);
              if (s.isDirectory()) { usageWalk(full, r); continue; }
              if (!exts.some(e => item.endsWith(e))) continue;
              const content = fs.readFileSync(full, "utf-8");
              const lines = content.split("\n");
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(symbol)) {
                  const start = Math.max(0, i - context);
                  const end = Math.min(lines.length, i + context + 1);
                  usages.push({ file: r, line: i + 1, context: lines.slice(start, end).join("\n").slice(0, 500) });
                }
              }
            } catch {}
            if (usages.length >= 200) return;
          }
        }
        usageWalk(dir, "");
        return { status: "success", type: t, data: { symbol, usages: usages.slice(0, 200), totalMatches: usages.length } };
      }
      case "component_tree": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next"]);
        const tree = {};
        function treeWalk(d, rel) {
          let items;
          try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            try {
              const s = fs.statSync(full);
              if (s.isDirectory()) { treeWalk(full, r); continue; }
              if (!/\.(tsx|jsx)$/.test(item)) continue;
              const content = fs.readFileSync(full, "utf-8");
              const imports = [];
              const importRe = /import\s+(?:\{[^}]*\}|[\w*]+(?:\s*,\s*\{[^}]*\})?)\s+from\s+['"]([^'"]+)['"]/g;
              let m;
              while ((m = importRe.exec(content)) !== null) imports.push(m[1]);
              const exportDefault = /export\s+default\s+(?:function\s+)?(\w+)/.exec(content);
              const namedExports = [];
              const namedRe = /export\s+(?:function|const|class)\s+(\w+)/g;
              while ((m = namedRe.exec(content)) !== null) namedExports.push(m[1]);
              const jsxUsages = [];
              const jsxRe = /<([A-Z]\w+)[\s/>]/g;
              while ((m = jsxRe.exec(content)) !== null) {
                if (!jsxUsages.includes(m[1])) jsxUsages.push(m[1]);
              }
              tree[r] = {
                imports, jsxUsages: jsxUsages.slice(0, 50),
                defaultExport: exportDefault ? exportDefault[1] : null,
                namedExports: namedExports.slice(0, 20),
              };
            } catch {}
          }
        }
        treeWalk(dir, "");
        return { status: "success", type: t, data: { components: tree } };
      }
      case "extract_theme":
      case "extract_colors": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next"]);
        const cssVars = [];
        const twColors = [];
        function themeWalk(d, rel) {
          let items;
          try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            try {
              const s = fs.statSync(full);
              if (s.isDirectory()) { themeWalk(full, r); continue; }
              if (/\.css$/.test(item)) {
                const content = fs.readFileSync(full, "utf-8");
                const varMatches = content.match(/--[\w-]+\s*:\s*[^;]+/g);
                if (varMatches) for (const vm of varMatches) {
                  const [name, ...rest] = vm.split(":");
                  cssVars.push({ file: r, variable: name.trim(), value: rest.join(":").trim() });
                }
              }
            } catch {}
          }
        }
        themeWalk(dir, "");
        const twConfigCandidates = ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs", "tailwind.config.mjs"];
        for (const c of twConfigCandidates) {
          const p = path.join(dir, c);
          if (fs.existsSync(p)) {
            try {
              const content = fs.readFileSync(p, "utf-8");
              const colorBlock = content.match(/colors?\s*:\s*\{[\s\S]*?\}/g);
              if (colorBlock) for (const cb of colorBlock) twColors.push(cb.slice(0, 1000));
            } catch {}
            break;
          }
        }
        return { status: "success", type: t, data: { cssVariables: cssVars.slice(0, 200), tailwindColors: twColors, totalCssVars: cssVars.length } };
      }
      case "capture_preview":
      case "get_preview_url": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        let previewPort = null;
        let previewUrl = null;
        const extPreviews = _opts.previewProcesses;
        if (extPreviews && extPreviews.size > 0) {
          if (projectName && extPreviews.has(projectName)) {
            const entry = extPreviews.get(projectName);
            previewPort = entry.port;
            if (entry.url) previewUrl = entry.url;
          } else {
            for (const [name, entry] of extPreviews) {
              if (entry.port) { previewPort = entry.port; if (entry.url) previewUrl = entry.url; break; }
            }
          }
        }
        if (!previewPort && sandboxProcesses.size > 0) {
          for (const [, entry] of sandboxProcesses) {
            if (entry.cmd && /dev|start|serve/.test(entry.cmd)) {
              const portMatch = (entry.logs?.stdout || "").match(/localhost:(\d+)|port\s+(\d+)/i);
              if (portMatch) { previewPort = parseInt(portMatch[1] || portMatch[2]); break; }
            }
          }
        }
        if (!previewPort) {
          try {
            const ssOut = childProcess.execSync("ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo none", { cwd: dir, timeout: 5000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
            const portMatches = ssOut.match(/:(\d{4,5})\s/g);
            if (portMatches) {
              const devPorts = portMatches.map(m => parseInt(m.slice(1))).filter(p => p >= 3000 && p <= 9999);
              if (devPorts.length > 0) previewPort = devPorts[0];
            }
          } catch {}
        }
        if (!previewUrl) previewUrl = previewPort ? `http://localhost:${previewPort}` : null;
        if (t === "get_preview_url") {
          return { status: "success", type: t, data: { url: previewUrl, port: previewPort } };
        }
        if (!previewUrl) return { status: "error", type: t, error: "No preview server detected. Start a dev server first." };
        let screenshotPath;
        if (action.output) {
          const outCheck = projectName ? validateProjectPath(projectName, action.output, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.output) };
          if (!outCheck.valid) return { status: "error", type: t, error: outCheck.error };
          screenshotPath = outCheck.resolved;
        } else {
          screenshotPath = path.join(dir, `preview-${Date.now()}.png`);
        }
        const playwrightBin = path.join(dir, "node_modules/playwright");
        const puppeteerBin = path.join(dir, "node_modules/puppeteer");
        const hasPlaywright = fs.existsSync(playwrightBin);
        const hasPuppeteer = fs.existsSync(puppeteerBin);
        if (hasPlaywright || hasPuppeteer) {
          const captureScript = hasPlaywright
            ? `const { chromium } = require('playwright'); (async()=>{ const b=await chromium.launch({headless:true}); const p=await b.newPage(); await p.setViewportSize({width:${action.width||1280},height:${action.height||720}}); await p.goto('${previewUrl}',{waitUntil:'networkidle',timeout:15000}).catch(()=>{}); await p.screenshot({path:'${screenshotPath.replace(/'/g,"\\'")}',fullPage:${!!action.fullPage}}); await b.close(); })();`
            : `const pup = require('puppeteer'); (async()=>{ const b=await pup.launch({headless:'new',args:['--no-sandbox']}); const p=await b.newPage(); await p.setViewport({width:${action.width||1280},height:${action.height||720}}); await p.goto('${previewUrl}',{waitUntil:'networkidle0',timeout:15000}).catch(()=>{}); await p.screenshot({path:'${screenshotPath.replace(/'/g,"\\'")}',fullPage:${!!action.fullPage}}); await b.close(); })();`;
          return new Promise((resolve) => {
            try {
              childProcess.execSync(`node -e "${captureScript.replace(/"/g, '\\"')}"`, { cwd: dir, timeout: 30000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
              if (fs.existsSync(screenshotPath)) {
                const imgData = fs.readFileSync(screenshotPath);
                const base64 = imgData.toString("base64");
                resolve({ status: "success", type: t, data: { url: previewUrl, port: previewPort, screenshotPath, base64: base64.length < 5000000 ? base64 : null, base64Length: base64.length, captured: true } });
              } else {
                resolve({ status: "success", type: t, data: { url: previewUrl, port: previewPort, captured: false, error: "Screenshot file not created" } });
              }
            } catch (e) {
              resolve({ status: "success", type: t, data: { url: previewUrl, port: previewPort, captured: false, error: `Screenshot failed: ${e.message}`.slice(0, 500) } });
            }
          });
        }
        return { status: "success", type: t, data: { url: previewUrl, port: previewPort, captured: false, note: "Install puppeteer or playwright for automated screenshots. Use the URL to view the preview manually." } };
      }
      case "generate_component":
      case "generate_page":
      case "refactor_file": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const xaiKey = process.env.XAI_API || process.env.XAI_API_KEY || "";
        if (!xaiKey) return { status: "error", type: t, error: "XAI_API environment variable not set" };
        let prompt = "";
        let outputPath = "";
        if (t === "refactor_file") {
          if (!action.path) return { status: "error", type: t, error: "path required" };
          if (!action.instructions) return { status: "error", type: t, error: "instructions required" };
          const fCheck = projectName ? validateProjectPath(projectName, action.path, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.path) };
          if (!fCheck.valid) return { status: "error", type: t, error: fCheck.error };
          if (!fs.existsSync(fCheck.resolved)) return { status: "error", type: t, error: "File not found" };
          const existingContent = fs.readFileSync(fCheck.resolved, "utf-8");
          outputPath = action.path;
          prompt = `Refactor the following file according to these instructions: ${action.instructions}\n\nFile: ${action.path}\n\`\`\`\n${existingContent.slice(0, 50000)}\n\`\`\`\n\nReturn ONLY the complete refactored file content, no explanations or markdown fences.`;
        } else {
          if (!action.spec && !action.description) return { status: "error", type: t, error: "spec or description required" };
          outputPath = action.path || (t === "generate_component" ? `src/components/${action.name || "Generated"}.tsx` : `src/pages/${action.name || "Generated"}.tsx`);
          const fCheck = projectName ? validateProjectPath(projectName, outputPath, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, outputPath) };
          if (!fCheck.valid) return { status: "error", type: t, error: fCheck.error };
          let projectContext = "";
          try {
            const pkgPath = path.join(dir, "package.json");
            if (fs.existsSync(pkgPath)) {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
              projectContext = `\nProject deps: ${Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(", ")}`;
            }
          } catch {}
          const kind = t === "generate_component" ? "React component" : "page/route";
          prompt = `Generate a ${kind} for: ${action.spec || action.description}${projectContext}\n\nComponent name: ${action.name || path.basename(outputPath, path.extname(outputPath))}\nFile path: ${outputPath}\n${action.style ? `Style: ${action.style}` : ""}\n${action.framework ? `Framework: ${action.framework}` : ""}\n\nReturn ONLY the complete file content, no explanations or markdown fences.`;
        }
        const https = require("https");
        const reqBody = JSON.stringify({
          model: action.model || "grok-3-mini-fast",
          messages: [
            { role: "system", content: "You are a code generator. Return ONLY the raw file content. No markdown fences, no explanations." },
            { role: "user", content: prompt },
          ],
          max_tokens: 8000,
          temperature: 0.3,
        });
        const _outputPath = outputPath;
        const _projectName = projectName;
        const _projectsDir = projectsDir;
        const _t = t;
        return new Promise((resolve) => {
          const req = https.request({
            hostname: "api.x.ai",
            path: "/v1/chat/completions",
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}`, "Content-Length": Buffer.byteLength(reqBody) },
            timeout: 60000,
          }, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.message?.content;
                if (!content) { resolve({ status: "error", type: _t, error: "No content in API response" }); return; }
                let cleanContent = content.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
                const writeResult = executeSandboxAction({ type: "write_file", project: _projectName, path: _outputPath, content: cleanContent }, _projectsDir);
                if (writeResult.status === "error") { resolve({ status: "error", type: _t, error: `Write failed: ${writeResult.error}` }); return; }
                resolve({ status: "success", type: _t, data: { path: _outputPath, generated: true, length: cleanContent.length, preview: cleanContent.slice(0, 500) } });
              } catch (e) {
                resolve({ status: "error", type: _t, error: `AI generation failed: ${e.message}`.slice(0, 2000) });
              }
            });
          });
          req.on("error", (e) => { resolve({ status: "error", type: _t, error: `AI generation failed: ${e.message}`.slice(0, 2000) }); });
          req.on("timeout", () => { req.destroy(); resolve({ status: "error", type: _t, error: "API request timed out" }); });
          req.write(reqBody);
          req.end();
        });
      }
      case "validate_change": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const results = { typeCheck: null, lint: null, passed: true };
        try {
          const tscPath = fs.existsSync(path.join(dir, "node_modules/.bin/tsc")) ? path.join(dir, "node_modules/.bin/tsc") : null;
          if (tscPath) {
            try {
              childProcess.execSync(`${tscPath} --noEmit`, { cwd: dir, timeout: 60000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
              results.typeCheck = { passed: true, errors: 0 };
            } catch (e) {
              const output = (e.stdout || "") + (e.stderr || "");
              const errorCount = (output.match(/error TS/g) || []).length;
              results.typeCheck = { passed: false, errors: errorCount, output: output.slice(0, 5000) };
              results.passed = false;
            }
          }
        } catch {}
        try {
          const eslintPath = fs.existsSync(path.join(dir, "node_modules/.bin/eslint")) ? path.join(dir, "node_modules/.bin/eslint") : null;
          if (eslintPath) {
            let lintTargets = action.files || "src/";
            if (typeof lintTargets === "string") lintTargets = [lintTargets];
            const safeTargets = lintTargets.map(f => {
              const clean = f.replace(/[;&|`${}()\n\r\t\\]/g, "");
              if (clean.startsWith("-") || clean.includes("..")) return null;
              return clean;
            }).filter(Boolean);
            if (safeTargets.length === 0) safeTargets.push("src/");
            try {
              const args = [...safeTargets];
              childProcess.execFileSync(eslintPath, args, { cwd: dir, timeout: 60000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
              results.lint = { passed: true, errors: 0 };
            } catch (e) {
              const output = (e.stdout || "") + (e.stderr || "");
              const errorCount = (output.match(/\d+ error/g) || []).length;
              results.lint = { passed: false, errors: errorCount, output: output.slice(0, 5000) };
              results.passed = false;
            }
          }
        } catch {}
        return { status: "success", type: t, data: results };
      }
      case "profile_performance": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const results = { bundleSize: null, lighthouse: null };
        const distCandidates = ["dist", ".next", "build", "out"];
        for (const dc of distCandidates) {
          const distPath = path.join(dir, dc);
          if (fs.existsSync(distPath)) {
            const sizes = [];
            let totalSize = 0;
            function sizeWalk(d, rel) {
              try {
                const items = fs.readdirSync(d);
                for (const item of items) {
                  const full = path.join(d, item);
                  const r = rel ? `${rel}/${item}` : item;
                  const s = fs.statSync(full);
                  if (s.isDirectory()) sizeWalk(full, r);
                  else { sizes.push({ file: r, size: s.size }); totalSize += s.size; }
                }
              } catch {}
            }
            sizeWalk(distPath, dc);
            sizes.sort((a, b) => b.size - a.size);
            results.bundleSize = { directory: dc, totalSize, totalSizeKB: Math.round(totalSize / 1024), fileCount: sizes.length, largestFiles: sizes.slice(0, 20).map(f => ({ ...f, sizeKB: Math.round(f.size / 1024) })) };
            break;
          }
        }
        const lhciPath = fs.existsSync(path.join(dir, "node_modules/.bin/lhci")) ? path.join(dir, "node_modules/.bin/lhci") : null;
        const lighthousePath = fs.existsSync(path.join(dir, "node_modules/.bin/lighthouse")) ? path.join(dir, "node_modules/.bin/lighthouse") : null;
        if (lhciPath || lighthousePath) {
          try {
            const safePort = Math.max(1, Math.min(65535, parseInt(action.port, 10) || 3000));
            const lhArgs = lhciPath
              ? [lhciPath, "autorun"]
              : [lighthousePath, `http://localhost:${safePort}`, "--output=json", "--chrome-flags=--no-sandbox --headless"];
            const lhOutput = childProcess.execFileSync(lhArgs[0], lhArgs.slice(1), { cwd: dir, timeout: 120000, maxBuffer: 8 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
            results.lighthouse = { available: true, ran: true, output: lhOutput.slice(0, 20000) };
          } catch (e) {
            results.lighthouse = { available: true, ran: false, error: (e.stderr || e.message || "").slice(0, 2000), output: (e.stdout || "").slice(0, 5000) };
          }
        } else {
          const wbaPath = fs.existsSync(path.join(dir, "node_modules/.bin/webpack-bundle-analyzer")) ? path.join(dir, "node_modules/.bin/webpack-bundle-analyzer") : null;
          if (wbaPath) {
            results.lighthouse = { available: false };
            try {
              const statsPath = path.join(dir, "dist/stats.json");
              if (fs.existsSync(statsPath)) {
                results.bundleAnalyzer = { available: true, statsFile: "dist/stats.json" };
              } else {
                results.bundleAnalyzer = { available: true, note: "Run build with --json to generate stats.json" };
              }
            } catch {}
          } else {
            results.lighthouse = { available: false, note: "Install @lhci/cli or lighthouse for automated performance audits" };
          }
        }
        return { status: "success", type: t, data: results };
      }
      case "create_folder": {
        if (!action.path) return { status: "error", type: t, error: "path required" };
        const c = projectName ? validateProjectPath(projectName, action.path, projectsDir) : validateBoundedPath(action.path, projectsDir);
        if (!c.valid) return { status: "error", type: t, error: c.error };
        fs.mkdirSync(c.resolved, { recursive: true });
        return { status: "success", type: t, data: { path: action.path, created: true } };
      }
      case "delete_folder": {
        if (!action.path) return { status: "error", type: t, error: "path required" };
        const c = projectName ? validateProjectPath(projectName, action.path, projectsDir) : validateBoundedPath(action.path, projectsDir);
        if (!c.valid) return { status: "error", type: t, error: c.error };
        if (!fs.existsSync(c.resolved)) return { status: "error", type: t, error: "Folder not found" };
        fs.rmSync(c.resolved, { recursive: action.recursive !== false, force: true });
        return { status: "success", type: t, data: { path: action.path, deleted: true } };
      }
      case "move_folder":
      case "rename_folder": {
        if (!action.from && !action.source) return { status: "error", type: t, error: "from/source required" };
        if (!action.to && !action.dest && !action.newName) return { status: "error", type: t, error: "to/dest/newName required" };
        const srcPath = action.from || action.source;
        let dstPath = action.to || action.dest;
        if (!dstPath && action.newName) dstPath = path.join(path.dirname(srcPath), action.newName);
        const src = projectName ? validateProjectPath(projectName, srcPath, projectsDir) : validateBoundedPath(srcPath, projectsDir);
        const dst = projectName ? validateProjectPath(projectName, dstPath, projectsDir) : validateBoundedPath(dstPath, projectsDir);
        if (!src.valid) return { status: "error", type: t, error: src.error };
        if (!dst.valid) return { status: "error", type: t, error: dst.error };
        if (!fs.existsSync(src.resolved)) return { status: "error", type: t, error: "Source folder not found" };
        const dstDir = path.dirname(dst.resolved);
        if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
        fs.renameSync(src.resolved, dst.resolved);
        return { status: "success", type: t, data: { from: srcPath, to: dstPath } };
      }
      case "list_tree_filtered": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const filterStr = action.filter || "";
        const filterExts = filterStr.split("|").map(e => e.startsWith(".") ? e : "." + e).filter(Boolean);
        const depth = parseInt(action.depth, 10) || 6;
        const ignore = new Set(action.ignore || ["node_modules", ".git", "dist", ".cache", ".next"]);
        const entries = [];
        function filtWalk(d, rel, lvl) {
          if (lvl > depth) return;
          let items;
          try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat;
            try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { filtWalk(full, r, lvl + 1); }
            else if (filterExts.length === 0 || filterExts.some(e => item.endsWith(e))) entries.push(r);
          }
          if (entries.length >= 2000) return;
        }
        filtWalk(dir, "", 0);
        return { status: "success", type: t, data: { filter: filterStr, entries: entries.slice(0, 2000) } };
      }
      case "dead_code_detection": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next", "build"]);
        const allFiles = [];
        const allExports = {};
        const allImports = new Set();
        function dcWalk(d, rel) {
          let items; try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat; try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { dcWalk(full, r); continue; }
            if (!/\.(ts|tsx|js|jsx)$/.test(item)) continue;
            allFiles.push(r);
            try {
              const content = fs.readFileSync(full, "utf-8");
              const expDefault = /export\s+default/.test(content);
              const expNamed = [];
              const re = /export\s+(?:function|const|class|let|var|type|interface|enum)\s+(\w+)/g;
              let m; while ((m = re.exec(content)) !== null) expNamed.push(m[1]);
              if (expDefault || expNamed.length > 0) allExports[r] = { default: expDefault, named: expNamed };
              const impRe = /from\s+['"]([^'"]+)['"]/g;
              while ((m = impRe.exec(content)) !== null) allImports.add(m[1]);
            } catch {}
          }
        }
        dcWalk(dir, "");
        const potentiallyUnused = [];
        for (const [file, exp] of Object.entries(allExports)) {
          const baseName = file.replace(/\.(ts|tsx|js|jsx)$/, "");
          const shortBase = "./" + baseName;
          const isImported = [...allImports].some(imp => {
            if (imp === shortBase || imp === "./" + file) return true;
            if (imp.endsWith("/" + path.basename(baseName))) return true;
            return false;
          });
          if (!isImported && !/index\.(ts|tsx|js|jsx)$/.test(file) && !/main\.(ts|tsx|js|jsx)$/.test(file) && !/App\.(ts|tsx|js|jsx)$/.test(file)) {
            potentiallyUnused.push({ file, exports: exp });
          }
        }
        return { status: "success", type: t, data: { totalFiles: allFiles.length, potentiallyUnused: potentiallyUnused.slice(0, 100), totalExportedModules: Object.keys(allExports).length } };
      }
      case "dependency_graph": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next", "build"]);
        const graph = {};
        function dgWalk(d, rel) {
          let items; try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat; try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { dgWalk(full, r); continue; }
            if (!/\.(ts|tsx|js|jsx|vue|svelte)$/.test(item)) continue;
            try {
              const content = fs.readFileSync(full, "utf-8");
              const imports = [];
              const re = /(?:import\s+(?:[\w{},*\s]+\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
              let m; while ((m = re.exec(content)) !== null) imports.push(m[1] || m[2]);
              graph[r] = { imports: imports.slice(0, 50) };
            } catch {}
          }
        }
        dgWalk(dir, "");
        return { status: "success", type: t, data: { graph, totalModules: Object.keys(graph).length } };
      }
      case "symbol_search": {
        if (!action.query) return { status: "error", type: t, error: "query required" };
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next"]);
        const query = action.query;
        const results = [];
        const defPatterns = [
          new RegExp(`(?:function|const|let|var|class|type|interface|enum)\\s+(\\w*${query}\\w*)`, "gi"),
          new RegExp(`export\\s+default\\s+(?:function\\s+)?(\\w*${query}\\w*)`, "gi"),
        ];
        function symWalk(d, rel) {
          let items; try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat; try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { symWalk(full, r); continue; }
            if (!/\.(ts|tsx|js|jsx|py|rs|go)$/.test(item)) continue;
            try {
              const content = fs.readFileSync(full, "utf-8");
              const lines = content.split("\n");
              for (let i = 0; i < lines.length; i++) {
                for (const pat of defPatterns) {
                  pat.lastIndex = 0;
                  let m; while ((m = pat.exec(lines[i])) !== null) {
                    results.push({ file: r, line: i + 1, symbol: m[1], text: lines[i].trim().slice(0, 200) });
                  }
                }
              }
            } catch {}
            if (results.length >= 100) return;
          }
        }
        symWalk(dir, "");
        return { status: "success", type: t, data: { query, results: results.slice(0, 100) } };
      }
      case "grep_advanced": {
        if (!action.pattern) return { status: "error", type: t, error: "pattern required" };
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const includeGlobs = action.include || [];
        const excludeGlobs = action.exclude || [];
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next"]);
        const re = new RegExp(action.pattern, action.case_sensitive ? "g" : "gi");
        const matches = [];
        function gaWalk(d, rel) {
          let items; try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat; try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { gaWalk(full, r); continue; }
            if (includeGlobs.length > 0 && !includeGlobs.some(g => item.endsWith(g) || r.includes(g))) continue;
            if (excludeGlobs.some(g => item.endsWith(g) || r.includes(g))) continue;
            try {
              const content = fs.readFileSync(full, "utf-8");
              const lines = content.split("\n");
              for (let i = 0; i < lines.length; i++) {
                re.lastIndex = 0;
                if (re.test(lines[i])) matches.push({ file: r, line: i + 1, text: lines[i].trim().slice(0, 200) });
              }
            } catch {}
            if (matches.length >= 200) return;
          }
        }
        gaWalk(dir, "");
        return { status: "success", type: t, data: { pattern: action.pattern, matches: matches.slice(0, 200) } };
      }
      case "extract_imports": {
        if (!action.file) return { status: "error", type: t, error: "file required" };
        const c = projectName ? validateProjectPath(projectName, action.file, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.file) };
        if (!c.valid) return { status: "error", type: t, error: c.error };
        if (!fs.existsSync(c.resolved)) return { status: "error", type: t, error: "File not found" };
        const content = fs.readFileSync(c.resolved, "utf-8");
        const imports = [];
        const re = /import\s+(?:(\{[^}]*\})|(\w+)(?:\s*,\s*(\{[^}]*\}))?)\s+from\s+['"]([^'"]+)['"]/g;
        let m; while ((m = re.exec(content)) !== null) {
          const specifiers = m[1] || m[3] ? (m[1] || m[3]).replace(/[{}]/g, "").split(",").map(s => s.trim()).filter(Boolean) : [];
          const defaultImport = m[2] || null;
          imports.push({ source: m[4], default: defaultImport, named: specifiers });
        }
        const requireRe = /(?:const|let|var)\s+(?:(\{[^}]*\})|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((m = requireRe.exec(content)) !== null) {
          imports.push({ source: m[3], default: m[2] || null, named: m[1] ? m[1].replace(/[{}]/g, "").split(",").map(s => s.trim()).filter(Boolean) : [] });
        }
        return { status: "success", type: t, data: { file: action.file, imports } };
      }
      case "run_command_advanced": {
        if (!action.command) return { status: "error", type: t, error: "command required" };
        const dir = projectName ? validateProjectPath(projectName, action.cwd || null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const cmd = action.command.trim();
        if (/[\n\r\0]/.test(cmd)) return { status: "error", type: t, error: "Newlines/control characters not allowed in command" };
        const isAllowed = ALLOWED_CMD_PREFIXES.some(p => cmd.startsWith(p));
        if (!isAllowed) return { status: "error", type: t, error: `Command not allowed: ${cmd.slice(0, 50)}` };
        const cmdOutsideQuotes = cmd.replace(/"[^"]*"/g, "").replace(/'[^']*'/g, "");
        if (/[;&|`${}]/.test(cmdOutsideQuotes)) return { status: "error", type: t, error: "Shell metacharacters not allowed" };
        const timeout = Math.min(Math.max(parseInt(action.timeout, 10) || 30000, 1000), 120000);
        const cmdParts = cmd.split(/\s+/);
        const cmdBin = cmdParts[0];
        const cmdArgs = cmdParts.slice(1);
        try {
          const output = childProcess.execFileSync(cmdBin, cmdArgs, { cwd: dir, timeout, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, ...(action.env || {}) }, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: cmd, output: (output || "").slice(0, 50000) } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 2000), data: { command: cmd, stdout: (e.stdout || "").slice(0, 10000), stderr: (e.stderr || "").slice(0, 10000) } };
        }
      }
      case "build_with_flags": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const pm = detectPmForDir(dir);
        const safeFlags = Array.isArray(action.flags) ? action.flags.map(f => sanitizeGitArg(f)).filter(Boolean) : [];
        const buildCmdStr = buildPmCommand(pm, "build");
        const buildParts = buildCmdStr.split(/\s+/);
        const buildBin = buildParts[0];
        const buildArgs = [...buildParts.slice(1), ...(safeFlags.length > 0 ? ["--", ...safeFlags] : [])];
        try {
          const output = childProcess.execFileSync(buildBin, buildArgs, { cwd: dir, timeout: 120000, maxBuffer: 4 * 1024 * 1024, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: `${buildBin} ${buildArgs.join(" ")}`, output: (output || "").slice(0, 20000) } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 2000), data: { stdout: (e.stdout || "").slice(0, 10000), stderr: (e.stderr || "").slice(0, 10000) } };
        }
      }
      case "clean_build_cache": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const cleaned = [];
        const cacheDirs = ["dist", ".next", "build", "out", ".cache", ".turbo", ".parcel-cache", ".output", ".nuxt"];
        for (const cd of cacheDirs) {
          const p = path.join(dir, cd);
          if (fs.existsSync(p)) { try { fs.rmSync(p, { recursive: true, force: true }); cleaned.push(cd); } catch {} }
        }
        const nmCache = path.join(dir, "node_modules", ".cache");
        if (fs.existsSync(nmCache)) { try { fs.rmSync(nmCache, { recursive: true, force: true }); cleaned.push("node_modules/.cache"); } catch {} }
        return { status: "success", type: t, data: { cleaned } };
      }
      case "start_process_named": {
        if (!action.command) return { status: "error", type: t, error: "command required" };
        if (!action.name) return { status: "error", type: t, error: "name required" };
        return executeSandboxAction({ ...action, type: "start_process" }, projectsDir, _opts);
      }
      case "monitor_process": {
        const pid = parseInt(action.pid, 10);
        if (!pid) return { status: "error", type: t, error: "pid required (number)" };
        let alive = false;
        try { process.kill(pid, 0); alive = true; } catch { alive = false; }
        let info = null;
        for (const [name, entry] of sandboxProcesses) {
          if (entry.proc && entry.proc.pid === pid) { info = { name, cmd: entry.cmd, startedAt: entry.startedAt }; break; }
        }
        return { status: "success", type: t, data: { pid, alive, processInfo: info } };
      }
      case "get_process_logs": {
        const name = action.name;
        const pid = action.pid ? parseInt(action.pid, 10) : null;
        let entry = null;
        if (name && sandboxProcesses.has(name)) {
          entry = sandboxProcesses.get(name);
        } else if (pid) {
          for (const [n, e] of sandboxProcesses) { if (e.proc && e.proc.pid === pid) { entry = e; break; } }
        }
        if (!entry) {
          const extPreviews = _opts.previewProcesses;
          if (extPreviews) {
            if (name && extPreviews.has(name)) entry = extPreviews.get(name);
            else if (pid) { for (const [, e] of extPreviews) { if (e.process && e.process.pid === pid) { entry = e; break; } } }
          }
        }
        if (!entry) return { status: "error", type: t, error: "Process not found" };
        return { status: "success", type: t, data: { stdout: (entry.logs?.stdout || "").slice(-20000), stderr: (entry.logs?.stderr || "").slice(-20000) } };
      }
      case "stop_all_processes": {
        const killed = [];
        for (const [name, entry] of sandboxProcesses) {
          try { entry.proc.kill("SIGTERM"); } catch {}
          killed.push(name);
          sandboxProcesses.delete(name);
        }
        return { status: "success", type: t, data: { killed } };
      }
      case "switch_port": {
        const port = parseInt(action.port, 10);
        if (!port || port < 1 || port > 65535) return { status: "error", type: t, error: "Valid port number required (1-65535)" };
        const extPreviews = _opts.previewProcesses;
        let updated = false;
        if (extPreviews && projectName && extPreviews.has(projectName)) {
          const entry = extPreviews.get(projectName);
          entry.port = port;
          entry.url = `http://localhost:${port}`;
          updated = true;
        } else if (extPreviews) {
          for (const [name, entry] of extPreviews) {
            entry.port = port;
            entry.url = `http://localhost:${port}`;
            updated = true;
            break;
          }
        }
        return { status: "success", type: t, data: { port, updated, previewUrl: `http://localhost:${port}` } };
      }
      case "git_stash_pop": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        try {
          const output = childProcess.execFileSync("git", ["stash", "pop"], { cwd: dir, timeout: 15000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: "git stash pop", output: (output || "").trim().slice(0, 10000) } };
        } catch (e) {
          return { status: "error", type: t, error: (e.stderr || e.message || "").slice(0, 2000) };
        }
      }
      case "git_reset": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const mode = action.mode === "hard" ? "--hard" : "--soft";
        const ref = sanitizeGitArg(action.ref) || "HEAD";
        try {
          const output = childProcess.execFileSync("git", ["reset", mode, ref], { cwd: dir, timeout: 15000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: `git reset ${mode} ${ref}`, output: (output || "").trim().slice(0, 10000) } };
        } catch (e) {
          return { status: "error", type: t, error: (e.stderr || e.message || "").slice(0, 2000) };
        }
      }
      case "git_revert": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const commit = sanitizeGitArg(action.commit);
        if (!commit) return { status: "error", type: t, error: "commit hash required" };
        try {
          const output = childProcess.execFileSync("git", ["revert", "--no-edit", commit], { cwd: dir, timeout: 30000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: `git revert ${commit}`, output: (output || "").trim().slice(0, 10000) } };
        } catch (e) {
          return { status: "error", type: t, error: (e.stderr || e.message || "").slice(0, 2000) };
        }
      }
      case "git_tag": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const tagName = sanitizeGitArg(action.name);
        if (!tagName) return { status: "error", type: t, error: "tag name required" };
        const args = action.message ? ["tag", "-a", tagName, "-m", action.message] : ["tag", tagName];
        try {
          const output = childProcess.execFileSync("git", args, { cwd: dir, timeout: 15000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { command: `git tag ${tagName}`, output: (output || "").trim().slice(0, 5000) } };
        } catch (e) {
          return { status: "error", type: t, error: (e.stderr || e.message || "").slice(0, 2000) };
        }
      }
      case "visual_diff": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!action.beforeUrl && !action.afterUrl) return { status: "error", type: t, error: "beforeUrl and afterUrl required" };
        let puppeteerPath = null;
        try { puppeteerPath = require.resolve("puppeteer"); } catch {}
        if (!puppeteerPath) { try { puppeteerPath = require.resolve("puppeteer-core"); } catch {} }
        if (puppeteerPath) {
          const outDir = path.join(dir, ".visual-diffs");
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
          const ts = Date.now();
          const script = `const p=require("${puppeteerPath.replace(/\\/g, "/")}");(async()=>{const b=await p.launch({headless:"new",args:["--no-sandbox"]});const pg=await b.newPage();` +
            (action.beforeUrl ? `await pg.goto(${JSON.stringify(action.beforeUrl)},{waitUntil:"networkidle2",timeout:15000});await pg.screenshot({path:${JSON.stringify(path.join(outDir, `before-${ts}.png`))},fullPage:true});` : "") +
            (action.afterUrl ? `await pg.goto(${JSON.stringify(action.afterUrl)},{waitUntil:"networkidle2",timeout:15000});await pg.screenshot({path:${JSON.stringify(path.join(outDir, `after-${ts}.png`))},fullPage:true});` : "") +
            `await b.close();console.log("done");})().catch(e=>{console.error(e.message);process.exit(1);})`;
          try {
            childProcess.execFileSync("node", ["-e", script], { cwd: dir, timeout: 30000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
            return { status: "success", type: t, data: { beforeFile: action.beforeUrl ? `before-${ts}.png` : null, afterFile: action.afterUrl ? `after-${ts}.png` : null, outputDir: ".visual-diffs" } };
          } catch (e) {
            return { status: "error", type: t, error: `Visual diff capture failed: ${(e.stderr || e.message || "").slice(0, 500)}` };
          }
        }
        return { status: "success", type: t, data: { beforeUrl: action.beforeUrl, afterUrl: action.afterUrl, available: false, note: "Puppeteer/puppeteer-core not installed. Install with: npm i puppeteer" } };
      }
      case "capture_component": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!action.componentName && !action.url) return { status: "error", type: t, error: "componentName or url required" };
        let puppeteerPath = null;
        try { puppeteerPath = require.resolve("puppeteer"); } catch {}
        if (!puppeteerPath) { try { puppeteerPath = require.resolve("puppeteer-core"); } catch {} }
        if (puppeteerPath && action.url) {
          const outDir = path.join(dir, ".component-captures");
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
          const ts = Date.now();
          const safeName = (action.componentName || "component").replace(/[^a-zA-Z0-9_-]/g, "_");
          const outFile = path.join(outDir, `${safeName}-${ts}.png`);
          const selectorCode = action.selector
            ? `const el=await pg.$(${JSON.stringify(action.selector)});if(el){await el.screenshot({path:${JSON.stringify(outFile)}})}else{await pg.screenshot({path:${JSON.stringify(outFile)},fullPage:true})}`
            : `await pg.screenshot({path:${JSON.stringify(outFile)},fullPage:true})`;
          const script = `const p=require("${puppeteerPath.replace(/\\/g, "/")}");(async()=>{const b=await p.launch({headless:"new",args:["--no-sandbox"]});const pg=await b.newPage();` +
            `await pg.goto(${JSON.stringify(action.url)},{waitUntil:"networkidle2",timeout:15000});${selectorCode};await b.close();console.log("done");})().catch(e=>{console.error(e.message);process.exit(1);})`;
          try {
            childProcess.execFileSync("node", ["-e", script], { cwd: dir, timeout: 30000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
            return { status: "success", type: t, data: { file: `${safeName}-${ts}.png`, outputDir: ".component-captures", componentName: action.componentName } };
          } catch (e) {
            return { status: "error", type: t, error: `Component capture failed: ${(e.stderr || e.message || "").slice(0, 500)}` };
          }
        }
        if (!puppeteerPath) {
          return { status: "success", type: t, data: { componentName: action.componentName, available: false, note: "Puppeteer/puppeteer-core not installed. Install with: npm i puppeteer. Then provide a url to capture." } };
        }
        return { status: "success", type: t, data: { componentName: action.componentName, available: true, note: "Provide a url parameter pointing to the component's isolated render (Storybook URL or dev server route) to capture it." } };
      }
      case "record_video": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        return { status: "success", type: t, data: { duration: parseInt(action.duration, 10) || 5, note: "Video recording requires puppeteer/playwright with video support. Install one and use the preview URL." } };
      }
      case "get_dom_snapshot": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        let previewUrl = null;
        const extPreviews = _opts.previewProcesses;
        if (extPreviews && projectName && extPreviews.has(projectName)) {
          previewUrl = `http://localhost:${extPreviews.get(projectName).port}`;
        }
        if (!previewUrl) {
          for (const [, entry] of sandboxProcesses) {
            if (entry.cmd && /dev|start|serve/.test(entry.cmd)) {
              const portMatch = (entry.logs?.stdout || "").match(/localhost:(\d+)/);
              if (portMatch) { previewUrl = `http://localhost:${portMatch[1]}`; break; }
            }
          }
        }
        if (!previewUrl) return { status: "success", type: t, data: { note: "No running preview server. Start a dev server first.", html: null } };
        try {
          const html = childProcess.execFileSync("curl", ["-s", "-m", "10", previewUrl], { timeout: 15000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { url: previewUrl, html: html.slice(0, 100000) } };
        } catch (e) {
          return { status: "success", type: t, data: { url: previewUrl, html: null, error: e.message?.slice(0, 500) } };
        }
      }
      case "get_console_errors": {
        const extPreviews = _opts.previewProcesses;
        const errors = [];
        if (extPreviews) {
          for (const [name, entry] of extPreviews) {
            const stderr = entry.logs?.stderr || "";
            const stdout = entry.logs?.stdout || "";
            const combined = stderr + stdout;
            const errLines = combined.split("\n").filter(l => /error|Error|ERR|FAIL|fatal|FATAL|TypeError|ReferenceError|SyntaxError/i.test(l));
            if (errLines.length > 0) errors.push({ process: name, errors: errLines.slice(-50).map(l => l.trim().slice(0, 300)) });
          }
        }
        for (const [name, entry] of sandboxProcesses) {
          const stderr = entry.logs?.stderr || "";
          const stdout = entry.logs?.stdout || "";
          const combined = stderr + stdout;
          const errLines = combined.split("\n").filter(l => /error|Error|ERR|FAIL|fatal|FATAL/i.test(l));
          if (errLines.length > 0) errors.push({ process: name, errors: errLines.slice(-50).map(l => l.trim().slice(0, 300)) });
        }
        return { status: "success", type: t, data: { errors, totalErrors: errors.reduce((s, e) => s + e.errors.length, 0) } };
      }
      case "generate_test":
      case "generate_storybook":
      case "optimize_code":
      case "convert_to_typescript":
      case "add_feature": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const xaiKey = process.env.XAI_API || process.env.XAI_API_KEY || "";
        if (!xaiKey) return { status: "error", type: t, error: "XAI_API environment variable not set" };
        let aiPrompt = "";
        let outPath = "";
        if (t === "generate_test") {
          if (!action.file) return { status: "error", type: t, error: "file required" };
          const fc = projectName ? validateProjectPath(projectName, action.file, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.file) };
          if (!fc.valid) return { status: "error", type: t, error: fc.error };
          if (!fs.existsSync(fc.resolved)) return { status: "error", type: t, error: "File not found" };
          const src = fs.readFileSync(fc.resolved, "utf-8");
          const ext = path.extname(action.file);
          outPath = action.file.replace(ext, `.test${ext}`);
          aiPrompt = `Generate comprehensive unit tests for this file using Jest/Vitest:\n\nFile: ${action.file}\n\`\`\`\n${src.slice(0, 40000)}\n\`\`\`\n\nReturn ONLY the complete test file content.`;
        } else if (t === "generate_storybook") {
          if (!action.component) return { status: "error", type: t, error: "component name required" };
          const compFiles = [];
          function sbWalk(d, rel) {
            let items; try { items = fs.readdirSync(d); } catch { return; }
            for (const item of items) {
              if (["node_modules", ".git", "dist"].includes(item)) continue;
              const full = path.join(d, item);
              const r = rel ? `${rel}/${item}` : item;
              try { const s = fs.statSync(full); if (s.isDirectory()) sbWalk(full, r); else if (item.includes(action.component) && /\.(tsx|jsx)$/.test(item)) compFiles.push({ path: r, content: fs.readFileSync(full, "utf-8").slice(0, 20000) }); } catch {}
            }
          }
          sbWalk(dir, "");
          const compSrc = compFiles[0] ? `\n\`\`\`\n${compFiles[0].content}\n\`\`\`` : "";
          outPath = compFiles[0] ? compFiles[0].path.replace(/\.(tsx|jsx)$/, ".stories.$1") : `src/stories/${action.component}.stories.tsx`;
          aiPrompt = `Generate a Storybook story file for the component "${action.component}".${compSrc}\n\nReturn ONLY the complete stories file content.`;
        } else if (t === "optimize_code") {
          if (!action.file) return { status: "error", type: t, error: "file required" };
          const fc = projectName ? validateProjectPath(projectName, action.file, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.file) };
          if (!fc.valid) return { status: "error", type: t, error: fc.error };
          if (!fs.existsSync(fc.resolved)) return { status: "error", type: t, error: "File not found" };
          const src = fs.readFileSync(fc.resolved, "utf-8");
          outPath = action.file;
          aiPrompt = `Optimize this code for performance, readability, and best practices. Preserve all functionality.\n\nFile: ${action.file}\n\`\`\`\n${src.slice(0, 50000)}\n\`\`\`\n\nReturn ONLY the complete optimized file content.`;
        } else if (t === "convert_to_typescript") {
          if (!action.file) return { status: "error", type: t, error: "file required" };
          const fc = projectName ? validateProjectPath(projectName, action.file, projectsDir) : { valid: true, resolved: path.resolve(projectsDir, action.file) };
          if (!fc.valid) return { status: "error", type: t, error: fc.error };
          if (!fs.existsSync(fc.resolved)) return { status: "error", type: t, error: "File not found" };
          const src = fs.readFileSync(fc.resolved, "utf-8");
          outPath = action.file.replace(/\.(js|jsx)$/, (m, ext) => ext === "jsx" ? ".tsx" : ".ts");
          aiPrompt = `Convert this JavaScript file to TypeScript with proper type annotations.\n\nFile: ${action.file}\n\`\`\`\n${src.slice(0, 50000)}\n\`\`\`\n\nReturn ONLY the complete TypeScript file content.`;
        } else if (t === "add_feature") {
          if (!action.featureSpec) return { status: "error", type: t, error: "featureSpec required" };
          let projectContext = "";
          try {
            const pkgPath = path.join(dir, "package.json");
            if (fs.existsSync(pkgPath)) {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
              projectContext = `\nProject: ${pkg.name || ""}\nDeps: ${Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(", ")}`;
            }
          } catch {}
          outPath = action.path || "src/features/NewFeature.tsx";
          aiPrompt = `Implement this feature: ${action.featureSpec}${projectContext}\n\nFile to create: ${outPath}\n\nReturn ONLY the complete file content.`;
        }
        const https = require("https");
        const reqBody = JSON.stringify({
          model: action.model || "grok-3-mini-fast",
          messages: [{ role: "system", content: "You are a code generator. Return ONLY raw file content. No markdown fences, no explanations." }, { role: "user", content: aiPrompt }],
          max_tokens: 8000, temperature: 0.3,
        });
        const _outPath = outPath, _pn = projectName, _pd = projectsDir, _tt = t;
        return new Promise((resolve) => {
          const req = https.request({ hostname: "api.x.ai", path: "/v1/chat/completions", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}`, "Content-Length": Buffer.byteLength(reqBody) }, timeout: 60000 }, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.message?.content;
                if (!content) { resolve({ status: "error", type: _tt, error: "No content in API response" }); return; }
                let clean = content.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
                const wr = executeSandboxAction({ type: "write_file", project: _pn, path: _outPath, content: clean }, _pd);
                if (wr.status === "error") { resolve({ status: "error", type: _tt, error: `Write failed: ${wr.error}` }); return; }
                resolve({ status: "success", type: _tt, data: { path: _outPath, generated: true, length: clean.length, preview: clean.slice(0, 500) } });
              } catch (e) { resolve({ status: "error", type: _tt, error: `AI generation failed: ${e.message}`.slice(0, 2000) }); }
            });
          });
          req.on("error", (e) => { resolve({ status: "error", type: _tt, error: `AI request failed: ${e.message}`.slice(0, 2000) }); });
          req.on("timeout", () => { req.destroy(); resolve({ status: "error", type: _tt, error: "API request timed out" }); });
          req.write(reqBody);
          req.end();
        });
      }
      case "migrate_framework": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const target = action.target;
        if (!target) return { status: "error", type: t, error: "target framework required (vite, react, next)" };
        const suggestions = [];
        if (target === "vite") {
          suggestions.push("Install vite: npm install -D vite @vitejs/plugin-react");
          suggestions.push("Create vite.config.ts with React plugin");
          suggestions.push("Update package.json scripts: dev -> vite, build -> vite build");
          suggestions.push("Move index.html to project root if not already there");
        } else if (target === "next") {
          suggestions.push("Install next: npm install next react react-dom");
          suggestions.push("Create next.config.js");
          suggestions.push("Move pages to /pages or /app directory");
          suggestions.push("Update package.json scripts: dev -> next dev, build -> next build");
        }
        return { status: "success", type: t, data: { target, suggestions, note: "Use generate_component or write_file to create config files. Use add_dependency to install packages." } };
      }
      case "react_profiler": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next"]);
        const suggestions = [];
        function rpWalk(d, rel) {
          let items; try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat; try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { rpWalk(full, r); continue; }
            if (!/\.(tsx|jsx)$/.test(item)) continue;
            try {
              const content = fs.readFileSync(full, "utf-8");
              if (/export\s+default\s+function/.test(content) && !/React\.memo|memo\(/.test(content) && content.length > 500) {
                suggestions.push({ file: r, suggestion: "Consider wrapping with React.memo if props rarely change" });
              }
              if (/useEffect\s*\(\s*\(\)\s*=>\s*\{/.test(content) && !/\[\s*\]/.test(content.slice(content.indexOf("useEffect")))) {
                suggestions.push({ file: r, suggestion: "Check useEffect dependency arrays — possible unnecessary re-runs" });
              }
              if (/new\s+Array|\.map\s*\(/.test(content) && /useMemo|useCallback/.test(content) === false && content.split("\n").length > 50) {
                suggestions.push({ file: r, suggestion: "Consider useMemo for expensive computations or large array mappings" });
              }
            } catch {}
            if (suggestions.length >= 50) return;
          }
        }
        rpWalk(dir, "");
        return { status: "success", type: t, data: { suggestions: suggestions.slice(0, 50) } };
      }
      case "memory_leak_detection": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next"]);
        const issues = [];
        function mlWalk(d, rel) {
          let items; try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat; try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { mlWalk(full, r); continue; }
            if (!/\.(ts|tsx|js|jsx)$/.test(item)) continue;
            try {
              const content = fs.readFileSync(full, "utf-8");
              if (/addEventListener/.test(content) && !/removeEventListener/.test(content)) issues.push({ file: r, issue: "addEventListener without removeEventListener — potential event listener leak" });
              if (/setInterval/.test(content) && !/clearInterval/.test(content)) issues.push({ file: r, issue: "setInterval without clearInterval — potential timer leak" });
              if (/setTimeout/.test(content) && /useEffect/.test(content) && !/clearTimeout/.test(content)) issues.push({ file: r, issue: "setTimeout in useEffect without clearTimeout cleanup" });
              if (/new\s+(?:WebSocket|EventSource|MutationObserver)/.test(content) && !/\.close\(\)/.test(content)) issues.push({ file: r, issue: "WebSocket/EventSource/Observer opened without close() — potential connection leak" });
            } catch {}
            if (issues.length >= 50) return;
          }
        }
        mlWalk(dir, "");
        return { status: "success", type: t, data: { issues: issues.slice(0, 50) } };
      }
      case "console_error_analysis": {
        const extPreviews = _opts.previewProcesses;
        const analysis = { errors: [], warnings: [], total: 0 };
        const processLogs = (name, logs) => {
          const combined = (logs.stderr || "") + (logs.stdout || "");
          const lines = combined.split("\n");
          for (const line of lines) {
            if (/error|Error|ERR|TypeError|ReferenceError|SyntaxError|FATAL/i.test(line)) analysis.errors.push({ process: name, message: line.trim().slice(0, 300) });
            else if (/warn|Warning|WARN|deprecated/i.test(line)) analysis.warnings.push({ process: name, message: line.trim().slice(0, 300) });
          }
        };
        if (extPreviews) for (const [name, entry] of extPreviews) processLogs(name, entry.logs || {});
        for (const [name, entry] of sandboxProcesses) processLogs(name, entry.logs || {});
        analysis.total = analysis.errors.length + analysis.warnings.length;
        analysis.errors = analysis.errors.slice(-100);
        analysis.warnings = analysis.warnings.slice(-100);
        return { status: "success", type: t, data: analysis };
      }
      case "runtime_error_trace": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next"]);
        const findings = { errorBoundaries: [], tryCatchBlocks: [], uncaughtPatterns: [] };
        function reWalk(d, rel) {
          let items; try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat; try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { reWalk(full, r); continue; }
            if (!/\.(ts|tsx|js|jsx)$/.test(item)) continue;
            try {
              const content = fs.readFileSync(full, "utf-8");
              if (/componentDidCatch|ErrorBoundary|getDerivedStateFromError/.test(content)) findings.errorBoundaries.push(r);
              const tryCatches = (content.match(/try\s*\{/g) || []).length;
              if (tryCatches > 0) findings.tryCatchBlocks.push({ file: r, count: tryCatches });
              if (/throw\s+new\s+Error/.test(content) && !/try\s*\{/.test(content)) findings.uncaughtPatterns.push(r);
            } catch {}
          }
        }
        reWalk(dir, "");
        return { status: "success", type: t, data: findings };
      }
      case "bundle_analyzer": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const distCandidates = ["dist", ".next", "build", "out"];
        let distDir = null;
        for (const dc of distCandidates) { const p = path.join(dir, dc); if (fs.existsSync(p)) { distDir = p; break; } }
        if (!distDir) return { status: "success", type: t, data: { note: "No build output found. Run build_project first.", files: [] } };
        const files = [];
        let totalSize = 0;
        const byType = {};
        function baWalk(d, rel) {
          let items; try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat; try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { baWalk(full, r); continue; }
            const ext = path.extname(item).toLowerCase();
            files.push({ path: r, size: stat.size, sizeKB: Math.round(stat.size / 1024), type: ext });
            totalSize += stat.size;
            byType[ext] = (byType[ext] || 0) + stat.size;
          }
        }
        baWalk(distDir, "");
        files.sort((a, b) => b.size - a.size);
        return { status: "success", type: t, data: { totalSize, totalSizeKB: Math.round(totalSize / 1024), fileCount: files.length, byType, largestFiles: files.slice(0, 30) } };
      }
      case "network_monitor": {
        try {
          let output = "";
          try { output = childProcess.execFileSync("ss", ["-tnp"], { timeout: 5000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }); }
          catch { try { output = childProcess.execFileSync("netstat", ["-tnp"], { timeout: 5000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }); } catch { output = "no tool available"; } }
          const connections = [];
          const lines = output.split("\n").slice(1);
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) connections.push({ local: parts[3] || "", remote: parts[4] || "", state: parts[0] || "" });
          }
          return { status: "success", type: t, data: { connections: connections.slice(0, 100), raw: output.slice(0, 5000) } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 1000) };
        }
      }
      case "accessibility_audit": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const ignore = new Set(["node_modules", ".git", "dist", ".cache", ".next"]);
        const issues = [];
        function a11yWalk(d, rel) {
          let items; try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat; try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { a11yWalk(full, r); continue; }
            if (!/\.(tsx|jsx|html)$/.test(item)) continue;
            try {
              const content = fs.readFileSync(full, "utf-8");
              if (/<img[^>]+(?!alt=)/.test(content) && !/<img[^>]+alt=/.test(content)) issues.push({ file: r, issue: "img without alt attribute" });
              if (/<a[^>]+(?!href)/.test(content) && content.includes("<a") && !content.includes("href=")) issues.push({ file: r, issue: "anchor without href" });
              if (/<button[^>]*>\s*<\/(button)>/i.test(content)) issues.push({ file: r, issue: "empty button element" });
              if (/onClick\s*=/.test(content) && /<div[^>]*onClick/.test(content) && !/role=/.test(content)) issues.push({ file: r, issue: "div with onClick but no role attribute — use button instead" });
              if (/<input[^>]+(?!id=)/.test(content) && /<label/.test(content) && !/htmlFor=/.test(content)) issues.push({ file: r, issue: "label without htmlFor / input without id pairing" });
            } catch {}
            if (issues.length >= 50) return;
          }
        }
        a11yWalk(dir, "");
        return { status: "success", type: t, data: { issues: issues.slice(0, 50), note: "Heuristic scan — install axe-core for comprehensive testing" } };
      }
      case "security_scan": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const results = { npmAudit: null, envExposed: [], dangerousPatterns: [] };
        if (fs.existsSync(path.join(dir, "package.json"))) {
          try {
            const output = childProcess.execFileSync("npm", ["audit", "--json"], { cwd: dir, timeout: 30000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
            try { results.npmAudit = JSON.parse(output); } catch { results.npmAudit = { raw: output.slice(0, 5000) }; }
          } catch (e) {
            const auditOut = e.stdout || "";
            try { results.npmAudit = JSON.parse(auditOut); } catch { results.npmAudit = { error: (e.message || "").slice(0, 1000), raw: auditOut.slice(0, 5000) }; }
          }
        }
        const ignore = new Set(["node_modules", ".git", "dist", ".cache"]);
        function secWalk(d, rel) {
          let items; try { items = fs.readdirSync(d); } catch { return; }
          for (const item of items) {
            if (ignore.has(item)) continue;
            const full = path.join(d, item);
            const r = rel ? `${rel}/${item}` : item;
            let stat; try { stat = fs.statSync(full); } catch { continue; }
            if (stat.isDirectory()) { secWalk(full, r); continue; }
            if (!/\.(ts|tsx|js|jsx)$/.test(item)) continue;
            try {
              const content = fs.readFileSync(full, "utf-8");
              if (/dangerouslySetInnerHTML/.test(content)) results.dangerousPatterns.push({ file: r, pattern: "dangerouslySetInnerHTML" });
              if (/eval\s*\(/.test(content)) results.dangerousPatterns.push({ file: r, pattern: "eval()" });
              if (/(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/i.test(content)) results.envExposed.push({ file: r, issue: "Possible hardcoded secret/API key" });
            } catch {}
          }
        }
        secWalk(dir, "");
        return { status: "success", type: t, data: results };
      }
      case "set_tailwind_config":
      case "set_next_config": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        if (!action.config || typeof action.config !== "object") return { status: "error", type: t, error: "config object required" };
        const configCandidates = t === "set_tailwind_config"
          ? ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs", "tailwind.config.mjs"]
          : ["next.config.js", "next.config.ts", "next.config.mjs"];
        let configPath = null;
        for (const c of configCandidates) { const p = path.join(dir, c); if (fs.existsSync(p)) { configPath = p; break; } }
        if (!configPath) {
          const defaultFile = t === "set_tailwind_config" ? "tailwind.config.js" : "next.config.js";
          configPath = path.join(dir, defaultFile);
        }
        const existed = fs.existsSync(configPath);
        let mergedConfig = action.config;
        if (existed) {
          try {
            const existingContent = fs.readFileSync(configPath, "utf-8");
            const jsonMatch = existingContent.match(/module\.exports\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
            if (jsonMatch) {
              try {
                const existingObj = JSON.parse(jsonMatch[1].replace(/'/g, '"').replace(/(\w+)\s*:/g, '"$1":').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'));
                function deepMerge(target, source) {
                  const result = { ...target };
                  for (const [key, val] of Object.entries(source)) {
                    if (val && typeof val === "object" && !Array.isArray(val) && result[key] && typeof result[key] === "object" && !Array.isArray(result[key])) {
                      result[key] = deepMerge(result[key], val);
                    } else {
                      result[key] = val;
                    }
                  }
                  return result;
                }
                mergedConfig = deepMerge(existingObj, action.config);
              } catch {}
            }
          } catch {}
        }
        const configContent = `module.exports = ${JSON.stringify(mergedConfig, null, 2)};\n`;
        fs.writeFileSync(configPath, configContent);
        return { status: "success", type: t, data: { file: path.basename(configPath), created: !existed, merged: existed, config: JSON.stringify(mergedConfig).slice(0, 5000) } };
      }
      case "update_package_json": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        const pkgPath = path.join(dir, "package.json");
        if (!fs.existsSync(pkgPath)) return { status: "error", type: t, error: "package.json not found" };
        if (!action.changes || typeof action.changes !== "object") return { status: "error", type: t, error: "changes object required" };
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          for (const [key, value] of Object.entries(action.changes)) {
            if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof pkg[key] === "object" && pkg[key] !== null) {
              pkg[key] = { ...pkg[key], ...value };
            } else {
              pkg[key] = value;
            }
          }
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
          return { status: "success", type: t, data: { updated: Object.keys(action.changes), packageJson: JSON.stringify(pkg).slice(0, 5000) } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 1000) };
        }
      }
      case "manage_scripts": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        const pkgPath = path.join(dir, "package.json");
        if (!fs.existsSync(pkgPath)) return { status: "error", type: t, error: "package.json not found" };
        if (!action.scriptName) return { status: "error", type: t, error: "scriptName required" };
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          if (!pkg.scripts) pkg.scripts = {};
          if (action.command === null || action.command === "") {
            delete pkg.scripts[action.scriptName];
          } else if (action.command) {
            pkg.scripts[action.scriptName] = action.command;
          }
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
          return { status: "success", type: t, data: { scriptName: action.scriptName, command: action.command || "(deleted)", scripts: pkg.scripts } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 1000) };
        }
      }
      case "switch_package_manager": {
        const dir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Directory not found" };
        const target = action.manager;
        if (!["npm", "yarn", "pnpm"].includes(target)) return { status: "error", type: t, error: "manager must be npm, yarn, or pnpm" };
        const lockfiles = { npm: "package-lock.json", yarn: "yarn.lock", pnpm: "pnpm-lock.yaml" };
        const removed = [];
        for (const [pm, lf] of Object.entries(lockfiles)) {
          if (pm !== target) {
            const lfPath = path.join(dir, lf);
            if (fs.existsSync(lfPath)) { try { fs.unlinkSync(lfPath); removed.push(lf); } catch {} }
          }
        }
        const buns = ["bun.lockb", "bun.lock"];
        for (const b of buns) { const bp = path.join(dir, b); if (fs.existsSync(bp)) { try { fs.unlinkSync(bp); removed.push(b); } catch {} } }
        try {
          const pkgPath = path.join(dir, "package.json");
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            delete pkg.packageManager;
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
          }
        } catch {}
        return { status: "success", type: t, data: { target, removedLockfiles: removed, note: `Switched to ${target}. Run install_deps to generate new lockfile.` } };
      }
      case "deploy_preview": {
        const dpDir = projectName ? validateProjectPath(projectName, null, projectsDir).resolved : projectsDir;
        if (!fs.existsSync(dpDir)) return { status: "error", type: t, error: "Directory not found" };
        const dpResultRaw = executeSandboxAction({ ...action, type: "start_process", command: action.command || "npm run dev", name: action.name || "preview-server" }, projectsDir, _opts);
        const wrapResult = (dpResult) => {
          let dpUrl = null;
          const dpPort = action.port ? parseInt(action.port, 10) : null;
          if (dpPort) dpUrl = `http://localhost:${dpPort}`;
          if (!dpUrl && dpResult.data?.output) {
            const portMatch = dpResult.data.output.match(/localhost:(\d+)|port\s+(\d+)/i);
            if (portMatch) dpUrl = `http://localhost:${portMatch[1] || portMatch[2]}`;
          }
          if (!dpUrl) dpUrl = "http://localhost:3000";
          return { status: dpResult.status, type: t, data: { ...dpResult.data, previewUrl: dpUrl } };
        };
        if (dpResultRaw && typeof dpResultRaw.then === "function") {
          return dpResultRaw.then(wrapResult);
        }
        return wrapResult(dpResultRaw);
      }
      case "export_project_zip": {
        return executeSandboxAction({ ...action, type: "export_project", format: "zip" }, projectsDir, _opts);
      }
      case "import_project": {
        if (!action.url) return { status: "error", type: t, error: "url required" };
        const url = action.url.trim();
        if (!/^https?:\/\//.test(url)) return { status: "error", type: t, error: "URL must start with http:// or https://" };
        if (/[;&|`${}]/.test(url)) return { status: "error", type: t, error: "Invalid URL characters" };
        const repoName = action.name || url.split("/").filter(Boolean).pop()?.replace(/\.git$/, "") || `imported-${Date.now()}`;
        if (/[\/\\]|\.\./.test(repoName)) return { status: "error", type: t, error: "Invalid project name" };
        const targetDir = path.join(projectsDir, repoName);
        if (fs.existsSync(targetDir)) return { status: "error", type: t, error: `Project '${repoName}' already exists` };
        try {
          childProcess.execFileSync("git", ["clone", "--depth", "1", url, targetDir], { timeout: 120000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          return { status: "success", type: t, data: { name: repoName, url, cloned: true } };
        } catch (e) {
          return { status: "error", type: t, error: `Git clone failed: ${(e.stderr || e.message || "").slice(0, 2000)}` };
        }
      }
      case "super_command": {
        if (!action.description) return { status: "error", type: t, error: "description required" };
        const xaiKey = process.env.XAI_API || process.env.XAI_API_KEY || "";
        if (!xaiKey) return { status: "error", type: t, error: "XAI_API environment variable not set" };
        const proj = projectName || "PROJECT_NAME";
        const superPrompt = `You are an AI that translates natural language descriptions into a JSON array of Lamby sandbox actions.
Available action types: list_tree, read_file, write_file, create_file, delete_file, move_file, copy_file, grep, search_replace, run_command, install_deps, add_dependency, git_status, git_add, git_commit, create_folder, delete_folder, build_project, run_tests, generate_component, generate_page, refactor_file.

The user wants: "${action.description}"
Project name: "${proj}"

Return ONLY a valid JSON array of action objects. Example: [{"type":"read_file","project":"${proj}","path":"src/App.tsx"}]`;
        const https = require("https");
        const reqBody = JSON.stringify({ model: "grok-3-mini-fast", messages: [{ role: "user", content: superPrompt }], max_tokens: 4000, temperature: 0.2 });
        return new Promise((resolve) => {
          const req = https.request({ hostname: "api.x.ai", path: "/v1/chat/completions", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}`, "Content-Length": Buffer.byteLength(reqBody) }, timeout: 30000 }, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.message?.content || "";
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (!jsonMatch) { resolve({ status: "error", type: t, error: "AI did not return a valid action list" }); return; }
                const actions = JSON.parse(jsonMatch[0]);
                resolve({ status: "success", type: t, data: { description: action.description, generatedActions: actions, actionCount: actions.length } });
              } catch (e) { resolve({ status: "error", type: t, error: `Failed to parse AI response: ${e.message}`.slice(0, 1000) }); }
            });
          });
          req.on("error", (e) => { resolve({ status: "error", type: t, error: `AI request failed: ${e.message}`.slice(0, 500) }); });
          req.on("timeout", () => { req.destroy(); resolve({ status: "error", type: t, error: "API request timed out" }); });
          req.write(reqBody);
          req.end();
        });
      }
      default:
        return { status: "error", type: t, error: `Unknown action type: ${t}` };
    }
  } catch (err) {
    return { status: "error", type: t, error: err.message?.slice(0, 1000) || "Unknown error" };
  }
}

async function executeSandboxActions(actions, projectsDir, options = {}) {
  const auditLog = options.auditLog || [];
  const results = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const result = await Promise.resolve(executeSandboxAction(action, projectsDir, options));
    results.push({ actionIndex: i, ...result });
    auditLog.push({ ts: Date.now(), action: action.type, project: action.project || "", status: result.status, detail: result.error || undefined });
    if (auditLog.length > 1000) auditLog.splice(0, auditLog.length - 500);
    if (options.onActionResult) {
      options.onActionResult(i, result);
    }
  }
  return { success: results.every(r => r.status === "success"), results };
}

function gatherProjectSnapshot(projectName, projectsDir) {
  const check = validateProjectPath(projectName, null, projectsDir);
  if (!check.valid) return `Error: ${check.error}`;
  const projectDir = check.resolved;
  if (!fs.existsSync(projectDir)) return `Error: Project "${projectName}" not found.`;

  const SKIP_DIRS = new Set(["node_modules", ".cache", "dist", ".git", ".next", ".nuxt", ".turbo", ".vercel", ".output", ".svelte-kit", "__pycache__", ".parcel-cache", "build"]);
  const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".py", ".md", ".yaml", ".yml", ".toml", ".env.example", ".gitignore", ".svelte", ".vue", ".astro"]);
  const MAX_FILE_SIZE = 12000;
  const TOTAL_BUDGET = 100000;

  const filePaths = [];
  function walkDir(dir, base) {
    let names;
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

module.exports = {
  executeSandboxAction,
  executeSandboxActions,
  gatherProjectSnapshot,
  validateProjectPath,
  detectPmForDir,
  buildPmCommand,
  buildInstallCascade,
  sandboxProcesses,
  ALLOWED_CMD_PREFIXES,
};
