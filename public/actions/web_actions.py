"""
FRACTURE: Web Actions Base Library — Autonomous Python Scripts
Provides relay_chain() and relay_task() for all web automation.

Grok usage:
  1. Import: from web_actions import relay_chain, relay_task, relay_eval, relay_snapshot
  2. Navigate: relay_chain("nav:https://example.com|wait:6000|snapshot")
  3. Click:    relay_chain("click:button[aria-label='Submit']")
  4. Eval:     relay_eval("document.querySelector('h1').textContent")
  5. Task:     relay_task("google-home", action="off")
  6. Task:     relay_task("web-search", query="weather today")
  7. Task:     relay_task("telegram-reply", message="Hello from Grok")
"""

import json, time, os, sys

TUNNEL = os.environ.get("LAMBY_TUNNEL", os.environ.get("TUNNEL",
    "https://eliminate-messaging-establishing-responsibility.trycloudflare.com"))


def _http_get(url, timeout=60):
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "Lamby/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def relay_chain(chain, project="__system__", timeout=60):
    import urllib.parse
    enc = urllib.parse.quote(chain, safe='')
    return _http_get(f"{TUNNEL}/api/grok-do?chain={enc}&project={project}", timeout)


def relay_task(task_name, timeout=60, **params):
    import urllib.parse
    qs = f"task={urllib.parse.quote(task_name)}"
    for k, v in params.items():
        qs += f"&{urllib.parse.quote(k)}={urllib.parse.quote(str(v))}"
    return _http_get(f"{TUNNEL}/api/grok-do?{qs}", timeout)


def relay_eval(js_code, timeout=30):
    result = relay_chain(f"eval:{js_code}", timeout=timeout)
    data = result.get("data", {})
    for r in data.get("results", []):
        d = r.get("data", {})
        val = d.get("output", d.get("result", d.get("value", "")))
        if val:
            return val
    return None


def relay_snapshot(timeout=30):
    result = relay_chain("snapshot", timeout=timeout)
    data = result.get("data", {})
    for r in data.get("results", []):
        d = r.get("data", {})
        if "bodyText" in d:
            return {"url": d.get("url", ""), "title": d.get("title", ""), "body": d["bodyText"]}
        snap = d.get("snapshot", {})
        if isinstance(snap, dict) and "bodyText" in snap:
            return {"url": snap.get("url", ""), "title": snap.get("title", ""), "body": snap["bodyText"]}
    return None


def relay_navigate(url, wait_ms=6000, timeout=60):
    result = relay_chain(f"nav:{url}|wait:{wait_ms}|snapshot", timeout=timeout)
    data = result.get("data", {})
    for r in data.get("results", []):
        d = r.get("data", {})
        if "bodyText" in d:
            return {"url": d.get("url", ""), "title": d.get("title", ""), "body": d["bodyText"]}
        snap = d.get("snapshot", {})
        if isinstance(snap, dict) and "bodyText" in snap:
            return {"url": snap.get("url", ""), "title": snap.get("title", ""), "body": snap["bodyText"]}
    return result


def relay_click(selector, timeout=30):
    return relay_chain(f"click:{selector}", timeout=timeout)


def relay_type(selector, text, timeout=30):
    return relay_chain(f"type_text:{selector}>>>{text}", timeout=timeout)


def lights_off(rooms=None):
    params = {"action": "off"}
    if rooms:
        params["rooms"] = rooms
    return relay_task("google-home", **params)


def lights_on(rooms=None):
    params = {"action": "on"}
    if rooms:
        params["rooms"] = rooms
    return relay_task("google-home", **params)


def lights_status():
    return relay_task("google-home", action="status")


def web_search(query):
    return relay_task("web-search", query=query)


def telegram_send(message):
    return relay_task("telegram-reply", message=message)


def soundcloud_play(url):
    relay_chain(f"run:start chrome {url}|wait:4000")
    return relay_snapshot()


def website_test(url):
    return relay_task("website-test", url=url)


PROVEN_TASKS = {
    "lights-off":      lambda args: lights_off(args.get("rooms")),
    "lights-on":       lambda args: lights_on(args.get("rooms")),
    "lights-status":   lambda args: lights_status(),
    "web-search":      lambda args: web_search(args.get("query", "")),
    "telegram":        lambda args: telegram_send(args.get("message", "")),
    "soundcloud":      lambda args: soundcloud_play(args.get("url", "")),
    "website-test":    lambda args: website_test(args.get("url", "")),
    "navigate":        lambda args: relay_navigate(args.get("url", ""), int(args.get("wait", 6000))),
    "eval":            lambda args: relay_eval(args.get("code", "")),
    "click":           lambda args: relay_click(args.get("selector", "")),
    "snapshot":        lambda args: relay_snapshot(),
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python web_actions.py <task> [key=value ...]")
        print(f"Tasks: {', '.join(PROVEN_TASKS.keys())}")
        sys.exit(0)

    task = sys.argv[1]
    args = {}
    for arg in sys.argv[2:]:
        if "=" in arg:
            k, v = arg.split("=", 1)
            args[k] = v
        else:
            args["query"] = args.get("query", "") + " " + arg

    if task not in PROVEN_TASKS:
        print(f"Unknown task: {task}")
        print(f"Available: {', '.join(PROVEN_TASKS.keys())}")
        sys.exit(1)

    result = PROVEN_TASKS[task](args)
    print(json.dumps(result, indent=2, default=str))
