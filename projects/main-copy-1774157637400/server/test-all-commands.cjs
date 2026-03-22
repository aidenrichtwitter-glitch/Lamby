const fs = require("fs");
const path = require("path");
const { executeSandboxAction, executeSandboxActions, sandboxProcesses } = require("./sandbox-dispatcher.cjs");

const TEST_DIR = path.join(__dirname, "__test_projects__");
const PROJECT = "e2e-test-proj";
const PROJECT_DIR = path.join(TEST_DIR, PROJECT);

const previewProcesses = new Map();
const auditLog = [];
const opts = { auditLog, previewProcesses };

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function setup() {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROJECT_DIR, { recursive: true });
  fs.mkdirSync(path.join(PROJECT_DIR, "src/components"), { recursive: true });
  fs.writeFileSync(path.join(PROJECT_DIR, "src/App.tsx"), `import React from "react";\nimport { Button } from "./components/Button";\nexport default function App() {\n  return <div><Button /><h1>Hello</h1></div>;\n}\n`);
  fs.writeFileSync(path.join(PROJECT_DIR, "src/components/Button.tsx"), `import React from "react";\nexport function Button() { return <button>Click</button>; }\n`);
  fs.writeFileSync(path.join(PROJECT_DIR, "src/utils.js"), `function add(a, b) { return a + b; }\nmodule.exports = { add };\n`);
  fs.writeFileSync(path.join(PROJECT_DIR, "src/index.ts"), `import App from "./App";\nconsole.log("hello");\n`);
  fs.writeFileSync(path.join(PROJECT_DIR, "package.json"), JSON.stringify({ name: "e2e-test", version: "1.0.0", scripts: { dev: "echo dev", build: "echo build done", test: "echo tests pass", lint: "echo lint ok" }, dependencies: {}, devDependencies: {} }, null, 2));
  fs.writeFileSync(path.join(PROJECT_DIR, ".env"), "API_KEY=test123\nSECRET=hunter2\n");
  fs.writeFileSync(path.join(PROJECT_DIR, ".gitignore"), "node_modules\ndist\n");
  try {
    const { execFileSync } = require("child_process");
    execFileSync("git", ["init"], { cwd: PROJECT_DIR, stdio: "pipe" });
    execFileSync("git", ["add", "."], { cwd: PROJECT_DIR, stdio: "pipe" });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@test.com", "commit", "-m", "init"], { cwd: PROJECT_DIR, stdio: "pipe" });
  } catch {}
}

function run(label, action) {
  try {
    const result = executeSandboxAction(action, TEST_DIR, opts);
    if (result && typeof result.then === "function") {
      return result.then(r => check(label, r)).catch(e => fail(label, e.message));
    }
    return check(label, result);
  } catch (e) {
    return fail(label, e.message);
  }
}

function check(label, result) {
  if (result && result.status === "success") {
    passed++;
    console.log(`  ✅ ${label}`);
    return result;
  } else {
    const err = result?.error || result?.status || "unknown";
    if (err.includes("not installed") || err.includes("not found") || err.includes("XAI_API") || err.includes("No preview")) {
      skipped++;
      console.log(`  ⏭️  ${label} (skipped: ${err.slice(0, 80)})`);
      return result;
    }
    failed++;
    failures.push({ label, error: err });
    console.log(`  ❌ ${label}: ${err.slice(0, 120)}`);
    return result;
  }
}

function fail(label, msg) {
  failed++;
  failures.push({ label, error: msg });
  console.log(`  ❌ ${label}: EXCEPTION: ${msg.slice(0, 120)}`);
}

function skip(label, reason) {
  skipped++;
  console.log(`  ⏭️  ${label} (skipped: ${reason})`);
}

async function runAll() {
  console.log("\n🧪 LAMBY SANDBOX E2E TEST — ALL COMMANDS\n");
  console.log("═".repeat(60));
  setup();
  const P = PROJECT;

  console.log("\n── FILE OPERATIONS ──");
  run("list_tree", { type: "list_tree", project: P });
  run("read_file", { type: "read_file", project: P, path: "src/App.tsx" });
  run("read_multiple_files", { type: "read_multiple_files", project: P, paths: ["src/App.tsx", "src/index.ts"] });
  run("write_file", { type: "write_file", project: P, path: "src/test-write.ts", content: "export const x = 1;\n" });
  run("create_file", { type: "create_file", project: P, path: "src/created.ts", content: "export const y = 2;\n" });
  run("bulk_write", { type: "bulk_write", project: P, files: [{ path: "src/a.ts", content: "const a = 1;\n" }, { path: "src/b.ts", content: "const b = 2;\n" }] });
  run("copy_file", { type: "copy_file", project: P, source: "src/App.tsx", dest: "src/App-copy.tsx" });
  run("rename_file", { type: "rename_file", project: P, source: "src/created.ts", dest: "src/renamed.ts" });
  run("move_file", { type: "move_file", project: P, source: "src/test-write.ts", dest: "src/moved.ts" });
  run("delete_file", { type: "delete_file", project: P, path: "src/moved.ts" });
  run("bulk_delete", { type: "bulk_delete", project: P, paths: ["src/a.ts", "src/b.ts"] });
  run("copy_folder", { type: "copy_folder", project: P, source: "src/components", dest: "src/components-backup" });

  console.log("\n── FOLDER OPERATIONS ──");
  run("create_folder", { type: "create_folder", project: P, path: "src/new-folder/deep" });
  run("rename_folder", { type: "rename_folder", project: P, source: "src/new-folder", newName: "renamed-folder" });
  run("move_folder", { type: "move_folder", project: P, from: "src/renamed-folder", to: "src/moved-folder" });
  run("delete_folder", { type: "delete_folder", project: P, path: "src/moved-folder", recursive: true });
  run("list_tree_filtered", { type: "list_tree_filtered", project: P, filter: "tsx", depth: 3 });

  console.log("\n── SEARCH & REPLACE ──");
  run("grep", { type: "grep", project: P, pattern: "Button" });
  run("search_files", { type: "search_files", project: P, pattern: "App" });
  run("search_replace", { type: "search_replace", project: P, path: "src/App-copy.tsx", search: "Hello", replace: "World" });
  run("apply_patch", { type: "apply_patch", project: P, patch: "--- a/src/renamed.ts\n+++ b/src/renamed.ts\n@@ -1 +1 @@\n-export const y = 2;\n+export const y = 42;\n" });

  console.log("\n── CODE INTELLIGENCE ──");
  run("dead_code_detection", { type: "dead_code_detection", project: P });
  run("dependency_graph", { type: "dependency_graph", project: P });
  run("symbol_search", { type: "symbol_search", project: P, query: "Button" });
  run("grep_advanced", { type: "grep_advanced", project: P, pattern: "import", include: [".tsx"], case_sensitive: true });
  run("extract_imports", { type: "extract_imports", project: P, file: "src/App.tsx" });

  console.log("\n── SHELL & BUILD ──");
  run("run_command", { type: "run_command", project: P, command: "echo hello" });
  run("run_command_advanced", { type: "run_command_advanced", project: P, command: "echo advanced", timeout: 5000 });
  run("build_project", { type: "build_project", project: P });
  run("build_with_flags", { type: "build_with_flags", project: P, flags: [] });
  run("clean_build_cache", { type: "clean_build_cache", project: P });
  run("run_tests", { type: "run_tests", project: P });
  run("install_deps", { type: "install_deps", project: P });
  run("detect_structure", { type: "detect_structure", project: P });
  run("get_build_metrics", { type: "get_build_metrics", project: P });

  console.log("\n── PROCESS MANAGEMENT ──");
  run("start_process", { type: "start_process", project: P, command: "echo proc-started" });
  run("start_process_named", { type: "start_process_named", project: P, command: "echo named-proc", name: "test-proc" });
  run("list_processes", { type: "list_processes", project: P });
  run("monitor_process", { type: "monitor_process", project: P, pid: process.pid });
  run("get_process_logs", { type: "get_process_logs", project: P, name: "test-proc" });
  run("list_open_ports", { type: "list_open_ports", project: P });
  run("switch_port", { type: "switch_port", project: P, port: 3001 });
  run("kill_process", { type: "kill_process", project: P, name: "test-proc" });
  run("stop_all_processes", { type: "stop_all_processes", project: P });
  run("restart_dev_server", { type: "restart_dev_server", project: P, command: "echo restarted" });

  console.log("\n── GIT ──");
  run("git_init", { type: "git_init", project: P });
  run("git_status", { type: "git_status", project: P });
  run("git_add", { type: "git_add", project: P, files: "." });
  run("git_commit", { type: "git_commit", project: P, message: "test commit" });
  run("git_diff", { type: "git_diff", project: P });
  run("git_log", { type: "git_log", project: P, count: 5 });
  run("git_branch", { type: "git_branch", project: P });
  run("git_branch_create", { type: "git_branch", project: P, name: "test-branch" });
  run("git_checkout", { type: "git_checkout", project: P, ref: "test-branch" });
  run("git_checkout_main", { type: "git_checkout", project: P, ref: "main" });
  run("git_merge", { type: "git_merge", project: P, branch: "test-branch" });
  fs.writeFileSync(path.join(PROJECT_DIR, "src/stash-test.ts"), "const stashMe = true;\n");
  try { require("child_process").execFileSync("git", ["add", "src/stash-test.ts"], { cwd: PROJECT_DIR, stdio: "pipe" }); } catch {}
  fs.writeFileSync(path.join(PROJECT_DIR, "src/stash-test.ts"), "const stashMe = false; // changed\n");
  run("git_stash", { type: "git_stash", project: P });
  run("git_stash_pop", { type: "git_stash_pop", project: P });
  run("git_tag", { type: "git_tag", project: P, name: "v0.0.1", message: "test tag" });
  run("git_reset", { type: "git_reset", project: P, mode: "soft", ref: "HEAD" });
  try { require("child_process").execFileSync("git", ["add", "."], { cwd: PROJECT_DIR, stdio: "pipe" }); require("child_process").execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@test.com", "commit", "-m", "pre-revert"], { cwd: PROJECT_DIR, stdio: "pipe" }); } catch {}
  run("git_revert", { type: "git_revert", project: P, commit: "HEAD" });
  skip("git_push", "no remote configured in test env");
  skip("git_pull", "no remote configured in test env");

  console.log("\n── ENVIRONMENT ──");
  run("get_env_vars", { type: "get_env_vars", project: P });
  run("set_env_var", { type: "set_env_var", project: P, key: "NEW_VAR", value: "hello" });
  fs.writeFileSync(path.join(PROJECT_DIR, "src/App.tsx"), "// modified for rollback test\n");
  run("rollback_last_change", { type: "rollback_last_change", project: P, files: "src/App.tsx" });

  console.log("\n── ANALYSIS ──");
  run("project_analyze", { type: "project_analyze", project: P });
  run("tailwind_audit", { type: "tailwind_audit", project: P });
  run("find_usages", { type: "find_usages", project: P, symbol: "Button" });
  run("component_tree", { type: "component_tree", project: P });
  run("extract_theme", { type: "extract_theme", project: P });
  run("extract_colors", { type: "extract_colors", project: P });

  console.log("\n── PREVIEW ──");
  run("get_preview_url", { type: "get_preview_url", project: P });
  run("capture_preview", { type: "capture_preview", project: P });

  console.log("\n── CODE QUALITY ──");
  run("type_check", { type: "type_check", project: P });
  run("lint_and_fix", { type: "lint_and_fix", project: P });
  run("format_files", { type: "format_files", project: P, files: "src/" });
  run("validate_change", { type: "validate_change", project: P });
  run("profile_performance", { type: "profile_performance", project: P });

  console.log("\n── VISUAL & PREVIEW ──");
  run("visual_diff", { type: "visual_diff", project: P, beforeUrl: "http://localhost:3000", afterUrl: "http://localhost:3000" });
  run("capture_component", { type: "capture_component", project: P, componentName: "Header", url: "http://localhost:3000" });
  run("record_video", { type: "record_video", project: P, duration: 1 });
  run("get_dom_snapshot", { type: "get_dom_snapshot", project: P });
  run("get_console_errors", { type: "get_console_errors", project: P });

  console.log("\n── DEBUGGING & PROFILING ──");
  run("react_profiler", { type: "react_profiler", project: P });
  run("memory_leak_detection", { type: "memory_leak_detection", project: P });
  run("console_error_analysis", { type: "console_error_analysis", project: P });
  run("runtime_error_trace", { type: "runtime_error_trace", project: P });
  run("bundle_analyzer", { type: "bundle_analyzer", project: P });
  run("network_monitor", { type: "network_monitor", project: P });
  run("accessibility_audit", { type: "accessibility_audit", project: P });
  run("security_scan", { type: "security_scan", project: P });

  console.log("\n── CONFIG & META ──");
  run("set_tailwind_config", { type: "set_tailwind_config", project: P, config: { content: ["./src/**/*.tsx"] } });
  run("set_next_config", { type: "set_next_config", project: P, config: { reactStrictMode: true } });
  run("update_package_json", { type: "update_package_json", project: P, changes: { scripts: { format: "prettier --write ." } } });
  run("manage_scripts", { type: "manage_scripts", project: P, scriptName: "check", command: "echo check" });
  run("switch_package_manager", { type: "switch_package_manager", project: P, manager: "npm" });
  run("add_dependency", { type: "add_dependency", project: P, name: "lodash", dev: false });
  run("archive_project", { type: "archive_project", project: P });

  console.log("\n── AI GENERATION (requires XAI_API) ──");
  const hasXai = !!(process.env.XAI_API || process.env.XAI_API_KEY);
  if (hasXai) {
    const aiResults = [];
    aiResults.push(run("generate_component", { type: "generate_component", project: P, spec: "a simple counter button", name: "Counter" }));
    aiResults.push(run("generate_page", { type: "generate_page", project: P, spec: "a simple about page", name: "About" }));
    aiResults.push(run("refactor_file", { type: "refactor_file", project: P, path: "src/utils.js", instructions: "add JSDoc comments" }));
    aiResults.push(run("generate_test", { type: "generate_test", project: P, file: "src/utils.js" }));
    aiResults.push(run("generate_storybook", { type: "generate_storybook", project: P, component: "Button" }));
    aiResults.push(run("optimize_code", { type: "optimize_code", project: P, file: "src/App.tsx" }));
    aiResults.push(run("convert_to_typescript", { type: "convert_to_typescript", project: P, file: "src/utils.js" }));
    aiResults.push(run("add_feature", { type: "add_feature", project: P, featureSpec: "add dark mode toggle", path: "src/DarkMode.tsx" }));
    for (const r of aiResults) {
      if (r && typeof r.then === "function") await r;
    }
  } else {
    skip("generate_component", "XAI_API not set");
    skip("generate_page", "XAI_API not set");
    skip("refactor_file", "XAI_API not set");
    skip("generate_test", "XAI_API not set");
    skip("generate_storybook", "XAI_API not set");
    skip("optimize_code", "XAI_API not set");
    skip("convert_to_typescript", "XAI_API not set");
    skip("add_feature", "XAI_API not set");
  }

  console.log("\n── FRAMEWORK MIGRATION ──");
  run("migrate_framework", { type: "migrate_framework", project: P, target: "vite" });

  console.log("\n── SUPER & META ──");
  run("export_project", { type: "export_project", project: P, format: "zip" });
  run("export_project_zip", { type: "export_project_zip", project: P });
  if (hasXai) {
    const superResult = run("super_command", { type: "super_command", project: P, description: "list all files" });
    if (superResult && typeof superResult.then === "function") await superResult;
  } else {
    skip("super_command", "XAI_API not set");
  }
  run("import_project", { type: "import_project", project: P, url: "https://github.com/vercel/next.js", name: "import-test" });
  run("deploy_preview", { type: "deploy_preview", project: P, command: "echo preview-started" });

  console.log("\n── SECURITY: PATH TRAVERSAL TESTS ──");
  const traversalTests = [
    { label: "read_file traversal", action: { type: "read_file", project: P, path: "../../../etc/passwd" } },
    { label: "write_file traversal", action: { type: "write_file", project: P, path: "../../../tmp/evil.txt", content: "hacked" } },
    { label: "create_folder traversal", action: { type: "create_folder", project: P, path: "../../../tmp/evil-dir" } },
    { label: "delete_folder traversal", action: { type: "delete_folder", project: P, path: "../../../tmp" } },
    { label: "run_command metachar", action: { type: "run_command_advanced", project: P, command: "echo hello; rm -rf /" } },
    { label: "run_command newline", action: { type: "run_command_advanced", project: P, command: "echo hello\nrm -rf /" } },
  ];
  for (const tt of traversalTests) {
    try {
      const result = executeSandboxAction(tt.action, TEST_DIR, opts);
      if (result && result.status === "error") {
        passed++;
        console.log(`  ✅ ${tt.label} → BLOCKED: ${result.error.slice(0, 60)}`);
      } else {
        failed++;
        failures.push({ label: tt.label, error: "SHOULD HAVE BEEN BLOCKED but got: " + result?.status });
        console.log(`  ❌ ${tt.label} → NOT BLOCKED! status=${result?.status}`);
      }
    } catch (e) {
      passed++;
      console.log(`  ✅ ${tt.label} → BLOCKED (exception): ${e.message.slice(0, 60)}`);
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped (total: ${passed + failed + skipped})`);
  if (failures.length > 0) {
    console.log("\n❌ FAILURES:");
    for (const f of failures) {
      console.log(`   • ${f.label}: ${f.error.slice(0, 150)}`);
    }
  }
  console.log("");

  fs.rmSync(TEST_DIR, { recursive: true, force: true });

  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch(e => { console.error("Test runner error:", e); process.exit(1); });
