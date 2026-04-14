import json, os, sys, urllib.request

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

name = CONFIG.get("name", "")
domain = CONFIG.get("domain", "")
steps = CONFIG.get("steps", [])
tunnel = CONFIG.get("tunnel", "")

if not name or not steps:
    print(json.dumps({"action": "crystallize", "error": "name and steps required", "status": "error"}))
    sys.exit(1)

tunnels = [tunnel] if tunnel else [
    "https://alerts-comparison-liberal-basics.trycloudflare.com",
    "https://bowl-dangerous-ladder-manchester.trycloudflare.com",
    "https://alexandria-entry-wan-media.trycloudflare.com"
]

crystal = {"name": name, "domain": domain or name, "steps": steps}
data = json.dumps(crystal).encode()

for t in tunnels:
    try:
        url = t + "/api/grok-memory?action=crystallize"
        req = urllib.request.Request(url, data=data, headers={
            "Content-Type": "application/json",
            "User-Agent": "Lamby/1.0"
        }, method="POST")
        with urllib.request.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read())
        result = resp.get("data", {})
        print(json.dumps({
            "action": "crystallize",
            "name": name,
            "steps_count": len(steps),
            "uses": result.get("uses", 0),
            "tunnel": t,
            "status": "ok"
        }))
        sys.exit(0)
    except Exception as e:
        continue

print(json.dumps({"action": "crystallize", "error": "all tunnels failed", "status": "error"}))
