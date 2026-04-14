import bpy, json, sys, os, traceback

config_path = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else ""
action_path = sys.argv[sys.argv.index("--") + 2] if "--" in sys.argv and len(sys.argv) > sys.argv.index("--") + 2 else ""

try:
    if config_path and os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
    else:
        config = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

    os.environ["ACTION_CONFIG"] = json.dumps(config)

    if action_path and os.path.exists(action_path):
        exec(open(action_path).read())
    else:
        print(json.dumps({"error": f"Action script not found: {action_path}"}))

except Exception as e:
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
