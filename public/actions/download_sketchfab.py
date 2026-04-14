import json, os, sys, urllib.request, urllib.error

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

uid = CONFIG.get("uid", "")
output_dir = CONFIG.get("output_dir", r"C:\Users\Aiden\Downloads")

if not uid:
    print(json.dumps({"action": "download_sketchfab", "error": "No uid provided", "status": "error"}))
    sys.exit(1)

output_path = os.path.join(output_dir, f"{uid}.glb")

if os.path.exists(output_path):
    size = os.path.getsize(output_path)
    print(json.dumps({
        "action": "download_sketchfab",
        "uid": uid,
        "path": output_path,
        "size_mb": round(size / 1048576, 1),
        "cached": True,
        "status": "ok"
    }))
    sys.exit(0)

url = f"https://sketchfab.com/models/{uid}/download"
glb_url = f"https://sketchfab.com/models/{uid}/download"

try:
    api_url = f"https://api.sketchfab.com/v3/models/{uid}/download"
    req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read())
        glb_url = data.get("glb", {}).get("url", glb_url)
except:
    glb_url = f"https://sketchfab.com/models/{uid}/download"

try:
    req = urllib.request.Request(glb_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        with open(output_path, 'wb') as f:
            f.write(r.read())
    size = os.path.getsize(output_path)
    print(json.dumps({
        "action": "download_sketchfab",
        "uid": uid,
        "path": output_path,
        "size_mb": round(size / 1048576, 1),
        "cached": False,
        "status": "ok"
    }))
except Exception as e:
    print(json.dumps({
        "action": "download_sketchfab",
        "uid": uid,
        "error": str(e),
        "status": "error"
    }))
