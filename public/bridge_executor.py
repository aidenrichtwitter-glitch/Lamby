import urllib.request, urllib.parse, json, time, sys

CHUNK_SIZE = 450
WAIT_AFTER_WRITE = 0

results = []
had_writes = False

def _get(url, timeout=20):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())

def _encode(text):
    return urllib.parse.quote(str(text), safe='')

def do_create(step):
    global had_writes
    path = step["path"]
    content = step["content"]
    raw_len = len(content)
    if raw_len <= CHUNK_SIZE:
        encoded = _encode(content)
        url = f"{RELAY}/api/grok-create?project={PROJECT}&path={path}&content={encoded}"
        r = _get(url)
        status = r.get("results", [{}])[0].get("status", "unknown")
        had_writes = True
        return {"status": status, "path": path, "raw_chars": raw_len, "method": "single"}
    mid = raw_len // 2
    raw_chunks = [content[:mid], content[mid:]]
    total = len(raw_chunks)
    chunk_results = []
    for i, raw_chunk in enumerate(raw_chunks):
        encoded_chunk = _encode(raw_chunk)
        url = f"{RELAY}/api/grok-create-chunk?project={PROJECT}&path={path}&content={encoded_chunk}&chunk={i}&total={total}"
        r = _get(url)
        s = r.get("results", [{}])[0].get("status", "unknown")
        d = r.get("results", [{}])[0].get("data", {})
        chunk_results.append({"chunk": i, "status": s, "raw_chars": len(raw_chunk), "encoded_chars": len(encoded_chunk)})
        time.sleep(0.3)
    had_writes = True
    final = chunk_results[-1] if chunk_results else {}
    return {"status": "ok" if any(c.get("status") == "ok" for c in chunk_results) else "error", "path": path, "raw_chars": raw_len, "chunks": total, "chunk_results": chunk_results, "method": "chunked"}

def do_edit(step):
    global had_writes
    path = step["path"]
    search = _encode(step["search"])
    replace = _encode(step["replace"])
    url = f"{RELAY}/api/grok-write?project={PROJECT}&path={path}&search={search}&replace={replace}"
    r = _get(url)
    data = r.get("results", [{}])[0].get("data", {})
    reps = data.get("replacements", data.get("results", [{}])[0].get("replacements") if isinstance(data.get("results"), list) else 0)
    if reps is None:
        reps = 0
    had_writes = True
    return {"status": "ok" if reps and reps > 0 else "no_match", "path": path, "replacements": reps}

def do_delete(step):
    path = step["path"]
    url = f"{RELAY}/api/grok-delete?project={PROJECT}&path={path}"
    r = _get(url)
    status = r.get("results", [{}])[0].get("status", "unknown")
    return {"status": status, "path": path}

def do_read(step):
    path = step["path"]
    url = f"{RELAY}/api/grok-read?project={PROJECT}&path={path}"
    r = _get(url)
    data = r.get("results", [{}])[0].get("data", {})
    content = data.get("content", "")
    return {"status": "ok", "path": path, "chars": len(content), "lines": content.count("\n") + 1 if content else 0, "preview": content[:200]}

def do_git(step):
    action = step.get("git_action", "")
    if step["action"] == "git_add":
        action = "add"
        args = "."
    elif step["action"] == "git_commit":
        action = "commit"
        args = ""
        msg = _encode(step.get("message", "auto-commit"))
        url = f"{RELAY}/api/grok-git?project={PROJECT}&action=commit&message={msg}"
        r = _get(url)
        data = r.get("results", [{}])[0].get("data", {})
        return {"status": "ok", "action": "commit", "data": data}
    elif step["action"] == "git_log":
        action = "log"
        count = step.get("count", 3)
        url = f"{RELAY}/api/grok-git?project={PROJECT}&action=log&count={count}"
        r = _get(url)
        data = r.get("results", [{}])[0].get("data", {})
        return {"status": "ok", "action": "log", "data": data}
    elif step["action"] == "git_checkout":
        args_val = _encode(step.get("args", ""))
        url = f"{RELAY}/api/grok-git?project={PROJECT}&action=checkout&args={args_val}"
        r = _get(url)
        data = r.get("results", [{}])[0].get("data", {})
        return {"status": "ok", "action": "checkout", "data": data}
    else:
        return {"status": "error", "message": f"Unknown git action: {step['action']}"}

    url = f"{RELAY}/api/grok-git?project={PROJECT}&action={action}&args={_encode(args)}"
    r = _get(url)
    data = r.get("results", [{}])[0].get("data", {})
    return {"status": "ok", "action": action, "data": data}

def do_verify(step):
    path = step["path"]
    url = f"{RELAY}/api/grok-read?project={PROJECT}&path={path}"
    r = _get(url)
    data = r.get("results", [{}])[0].get("data", {})
    content = data.get("content", "")
    checks = step.get("contains", [])
    missing = [c for c in checks if c not in content]
    passed = len(missing) == 0 and len(content) > 0
    return {
        "status": "PASS" if passed else "FAIL",
        "path": path,
        "chars": len(content),
        "lines": content.count("\n") + 1 if content else 0,
        "checks_total": len(checks),
        "checks_passed": len(checks) - len(missing),
        "missing": missing if missing else None,
        "empty": len(content) == 0,
    }

def do_console_check(step):
    payload = json.dumps({"actions": [{"type": "get_console_errors", "project": PROJECT}]})
    encoded_payload = _encode(payload)
    url = f"{RELAY}/api/grok-proxy?project={PROJECT}&payload={encoded_payload}"
    r = _get(url)
    data = r.get("results", [{}])[0].get("data", {})
    errors = data.get("errors", [])
    return {"status": "PASS" if len(errors) == 0 else "FAIL", "error_count": len(errors), "errors": errors[:5] if errors else None}

def do_wait(step):
    seconds = step.get("seconds", 15)
    print(f"  Waiting {seconds}s...")
    time.sleep(seconds)
    return {"status": "ok", "waited": seconds}

def do_coord(step):
    note = _encode(step.get("note", ""))
    url = f"{RELAY}/api/coord?note={note}&from=grok"
    r = _get(url)
    return {"status": "ok"}

HANDLERS = {
    "create": do_create,
    "edit": do_edit,
    "delete": do_delete,
    "read": do_read,
    "git_add": do_git,
    "git_commit": do_git,
    "git_log": do_git,
    "git_checkout": do_git,
    "verify": do_verify,
    "console_check": do_console_check,
    "wait": do_wait,
    "coord": do_coord,
}

WRITE_ACTIONS = {"create", "edit", "delete"}
VERIFY_ACTIONS = {"verify", "console_check", "read"}

print(f"=== BRIDGE EXECUTOR ===")
print(f"Relay: {RELAY}")
print(f"Project: {PROJECT}")
print(f"Steps: {len(plan)}")
print()

first_verify_idx = None
for idx, step in enumerate(plan):
    if step.get("action") in VERIFY_ACTIONS and first_verify_idx is None:
        first_verify_idx = idx

for idx, step in enumerate(plan):
    action = step.get("action", "unknown")
    label = f"[{idx+1}/{len(plan)}] {action}"
    if "path" in step:
        label += f" {step['path']}"
    elif "message" in step:
        label += f" \"{step['message']}\""

    if idx == first_verify_idx and had_writes:
        print(f"  --- Waiting 15s for file propagation before verification ---")
        time.sleep(15)

    handler = HANDLERS.get(action)
    if not handler:
        print(f"{label}: SKIP (unknown action)")
        results.append({"step": idx+1, "action": action, "status": "skipped", "reason": "unknown action"})
        continue

    try:
        result = handler(step)
        status = result.get("status", "ok")
        icon = "PASS" if status in ("ok", "PASS") else "FAIL" if status in ("FAIL", "error", "no_match") else status
        detail_parts = []
        if "chars" in result:
            detail_parts.append(f"{result['chars']} chars")
        if "lines" in result:
            detail_parts.append(f"{result['lines']} lines")
        if "raw_chars" in result:
            detail_parts.append(f"{result['raw_chars']} raw chars")
        if "chunks" in result:
            detail_parts.append(f"{result['chunks']} chunks")
        if "replacements" in result:
            detail_parts.append(f"{result['replacements']} replacements")
        if "missing" in result and result["missing"]:
            detail_parts.append(f"missing: {result['missing']}")
        if "error_count" in result:
            detail_parts.append(f"{result['error_count']} errors")
        detail = " | ".join(detail_parts) if detail_parts else json.dumps(result)
        print(f"{label}: {icon} — {detail}")
        results.append({"step": idx+1, "action": action, **result})
    except Exception as e:
        print(f"{label}: ERROR — {e}")
        results.append({"step": idx+1, "action": action, "status": "error", "error": str(e)})

print()
print("=== SUMMARY ===")
passed = sum(1 for r in results if r.get("status") in ("ok", "PASS"))
failed = sum(1 for r in results if r.get("status") in ("FAIL", "error", "no_match"))
skipped = sum(1 for r in results if r.get("status") == "skipped")
total = len(results)
overall = "PASS" if failed == 0 and skipped == 0 else "FAIL"
print(f"Result: {overall} — {passed}/{total} passed, {failed} failed, {skipped} skipped")

for r in results:
    if r.get("status") in ("FAIL", "error", "no_match"):
        print(f"  FAILED step {r['step']}: {r['action']} — {r.get('error', r.get('missing', r.get('status')))}")

file_results = [r for r in results if r.get("action") in ("create", "verify")]
for r in file_results:
    chars = r.get("chars", r.get("raw_chars", "?"))
    print(f"  {r.get('path', '?')}: {chars} chars, {r.get('status')}")

print(f"\nOverall: {overall}")
