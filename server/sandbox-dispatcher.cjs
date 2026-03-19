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

function executeSandboxAction(action, projectsDir) {
  const t = action.type;
  const projectName = action.project || "";

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
        let stdout = "", stderr = "";
        proc.stdout?.on("data", (d) => { stdout += d.toString(); if (stdout.length > 50000) stdout = stdout.slice(-25000); });
        proc.stderr?.on("data", (d) => { stderr += d.toString(); if (stderr.length > 50000) stderr = stderr.slice(-25000); });
        proc.on("exit", () => { sandboxProcesses.delete(pName); });
        sandboxProcesses.set(pName, { proc, cmd: action.command, startedAt: Date.now() });
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ status: "success", type: t, data: { name: pName, pid: proc.pid, output: stdout.slice(0, 5000), stderr: stderr.slice(0, 2000) } });
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
      case "archive_project": {
        if (!projectName) return { status: "error", type: t, error: "project name required" };
        const dir = validateProjectPath(projectName, null, projectsDir).resolved;
        if (!fs.existsSync(dir)) return { status: "error", type: t, error: "Project not found" };
        const archiveName = `${projectName}-${Date.now()}.tar.gz`;
        const archivePath = path.join(projectsDir, archiveName);
        try {
          childProcess.execSync(`tar -czf "${archivePath}" -C "${projectsDir}" "${projectName}" --exclude=node_modules --exclude=.git --exclude=dist --exclude=.cache`, { timeout: 60000 });
          return { status: "success", type: t, data: { archive: archiveName, path: archivePath } };
        } catch (e) {
          return { status: "error", type: t, error: e.message?.slice(0, 1000) };
        }
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
    const result = await Promise.resolve(executeSandboxAction(action, projectsDir));
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
