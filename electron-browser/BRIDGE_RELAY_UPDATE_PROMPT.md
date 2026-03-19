# Paste this entire message into the Replit AI chat for the bridge-relay app

---

I need you to update the bridge-relay server (`bridge-relay.cjs` or `index.js` — whatever the main server file is) with the following changes. The desktop Lamby app has expanded from ~60 commands to ~110 commands and the relay needs to reflect that.

## CHANGE 1: Update the commandProtocol string in /api/snapshot-key

Find the `/api/snapshot-key` endpoint. It returns a JSON object with a `commandProtocol` field. Replace the ENTIRE `commandProtocol` string value with this exact string:

```
POST JSON {actions: [{type, project, ...}]}. Action types: list_tree, read_file, read_multiple_files, write_file, create_file, delete_file, bulk_delete, move_file, copy_file, copy_folder, rename_file, grep, search_files, search_replace, apply_patch, bulk_write, run_command, install_deps, add_dependency, remove_dependency, type_check, lint_and_fix, format_files, get_build_metrics, restart_dev_server, list_open_ports, git_status, git_add, git_commit, git_diff, git_log, git_branch, git_checkout, git_stash, git_init, git_push, git_pull, git_merge, detect_structure, start_process, kill_process, list_processes, build_project, run_tests, archive_project, export_project, set_env_var, get_env_vars, rollback_last_change, project_analyze, tailwind_audit, find_usages, component_tree, extract_theme, extract_colors, capture_preview, get_preview_url, generate_component, generate_page, refactor_file, validate_change, profile_performance, create_folder, delete_folder, move_folder, rename_folder, list_tree_filtered, dead_code_detection, dependency_graph, symbol_search, grep_advanced, extract_imports, run_command_advanced, build_with_flags, clean_build_cache, start_process_named, monitor_process, get_process_logs, stop_all_processes, switch_port, git_stash_pop, git_reset, git_revert, git_tag, visual_diff, capture_component, record_video, get_dom_snapshot, get_console_errors, generate_test, generate_storybook, optimize_code, convert_to_typescript, add_feature, migrate_framework, react_profiler, memory_leak_detection, console_error_analysis, runtime_error_trace, bundle_analyzer, network_monitor, accessibility_audit, security_scan, set_tailwind_config, set_next_config, update_package_json, manage_scripts, switch_package_manager, deploy_preview, export_project_zip, import_project, super_command
```

## CHANGE 2: Increase sandbox execute timeout from 60s to 120s

Some new commands (visual_diff, capture_component, build_with_flags, security_scan, super_command) can take longer than 60 seconds. In the `/api/sandbox/execute` handler, find the relay timeout (currently 60000ms / 60 seconds) and change it to 120000ms (120 seconds). Also update the error message to say "120 seconds" instead of "60 seconds".

## CHANGE 3: Increase max actions per request from 50 to 100

In the `/api/sandbox/execute` handler, find where it checks `actions.length > 50` and change the limit to 100. Update the error message to say "Max 100 actions per request".

## CHANGE 4: Increase request body size safety

Add a max body size check in the readBody function (or wherever the POST body is consumed). If the body exceeds 10MB (10 * 1024 * 1024 bytes), reject with a 413 status. This prevents abuse with huge write_file or bulk_write payloads being relayed. Here's how:

In the `readBody` function, track total size and reject if it exceeds the limit:

```javascript
function readBody(req, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    req.on("data", (c) => {
      totalSize += c.length;
      if (totalSize > maxBytes) {
        req.destroy();
        reject(new Error("Request body too large (max 10MB)"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}
```

## CHANGE 5: Add a /api/commands endpoint

Add a new GET endpoint at `/api/commands` that returns the full list of supported command types as a JSON array. This lets AI systems discover available commands programmatically. No auth required for this endpoint since it's just metadata.

```javascript
if (pathname === "/api/commands") {
  const commands = [
    "list_tree", "read_file", "read_multiple_files", "write_file", "create_file",
    "delete_file", "bulk_delete", "move_file", "copy_file", "copy_folder", "rename_file",
    "grep", "search_files", "search_replace", "apply_patch", "bulk_write",
    "run_command", "install_deps", "add_dependency", "remove_dependency",
    "type_check", "lint_and_fix", "format_files", "get_build_metrics",
    "restart_dev_server", "list_open_ports",
    "git_status", "git_add", "git_commit", "git_diff", "git_log",
    "git_branch", "git_checkout", "git_stash", "git_init", "git_push",
    "git_pull", "git_merge", "git_stash_pop", "git_reset", "git_revert", "git_tag",
    "detect_structure", "start_process", "kill_process", "list_processes",
    "build_project", "run_tests", "archive_project", "export_project",
    "set_env_var", "get_env_vars", "rollback_last_change",
    "project_analyze", "tailwind_audit", "find_usages", "component_tree",
    "extract_theme", "extract_colors", "capture_preview", "get_preview_url",
    "generate_component", "generate_page", "refactor_file",
    "validate_change", "profile_performance",
    "create_folder", "delete_folder", "move_folder", "rename_folder",
    "list_tree_filtered", "dead_code_detection", "dependency_graph",
    "symbol_search", "grep_advanced", "extract_imports",
    "run_command_advanced", "build_with_flags", "clean_build_cache",
    "start_process_named", "monitor_process", "get_process_logs",
    "stop_all_processes", "switch_port",
    "visual_diff", "capture_component", "record_video",
    "get_dom_snapshot", "get_console_errors",
    "generate_test", "generate_storybook", "optimize_code",
    "convert_to_typescript", "add_feature", "migrate_framework",
    "react_profiler", "memory_leak_detection", "console_error_analysis",
    "runtime_error_trace", "bundle_analyzer", "network_monitor",
    "accessibility_audit", "security_scan",
    "set_tailwind_config", "set_next_config", "update_package_json",
    "manage_scripts", "switch_package_manager",
    "deploy_preview", "export_project_zip", "import_project", "super_command"
  ];
  sendJson(res, {
    total: commands.length,
    commands,
    usage: "POST /api/sandbox/execute with {actions: [{type: '<command>', project: 'name', ...params}]}"
  });
  return;
}
```

Add this BEFORE the 404 fallback handler, and also add `/api/commands` to the 404 response's endpoints array.

## CHANGE 6: Update the startup log and 404 endpoints list

In the `server.listen` callback where it logs endpoints, add:
```
    GET  /api/commands           List all supported action types
```

And in the 404 handler, add `"/api/commands"` to the endpoints array.

## SUMMARY

That's it — 6 changes total:
1. Updated commandProtocol string with all ~110 action types
2. Sandbox relay timeout 60s → 120s
3. Max actions 50 → 100
4. Body size limit (10MB)
5. New /api/commands discovery endpoint
6. Updated logs and 404 help

The relay itself stays a transparent forwarder — it doesn't process any commands, just passes them through to the connected desktop app via WebSocket. These changes just make sure the relay accurately advertises what the desktop app can do, handles the larger payloads from new bulk commands, and gives enough time for slower commands to complete.

---
