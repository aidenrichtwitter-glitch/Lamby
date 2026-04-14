import bpy, json, sys, os, traceback

config_path = None
for i, arg in enumerate(sys.argv):
    if arg == "--" and i + 1 < len(sys.argv):
        config_path = sys.argv[i + 1]
        break

if not config_path or not os.path.exists(config_path):
    print(json.dumps({"error": "Pipeline config not found. Usage: blender --background --python pipeline.py -- config.json"}))
    sys.exit(1)

with open(config_path, 'r') as f:
    pipeline = json.load(f)

ACTIONS_DIR = pipeline.get("actions_dir", r"C:\Users\Aiden\Desktop\actions")
steps = pipeline.get("steps", [])
results = []

print("=" * 60)
print(f"PIPELINE: {pipeline.get('name', 'unnamed')} — {len(steps)} steps")
print("=" * 60)

for i, step in enumerate(steps):
    action = step.get("action", "")
    config = step.get("config", {})
    action_file = os.path.join(ACTIONS_DIR, f"{action}.py")

    print(f"\n--- Step {i+1}/{len(steps)}: {action} ---")

    if not os.path.exists(action_file):
        err = f"Action not found: {action_file}"
        print(f"ERROR: {err}")
        results.append({"step": i+1, "action": action, "error": err})
        if step.get("required", True):
            break
        continue

    try:
        os.environ["ACTION_CONFIG"] = json.dumps(config)
        exec(open(action_file).read())
        results.append({"step": i+1, "action": action, "status": "ok"})
    except Exception as e:
        err = str(e)
        print(f"ERROR: {err}")
        traceback.print_exc()
        results.append({"step": i+1, "action": action, "error": err})
        if step.get("required", True):
            break

print("\n" + "=" * 60)
print(f"PIPELINE COMPLETE: {sum(1 for r in results if r.get('status') == 'ok')}/{len(steps)} steps OK")
print("=" * 60)
print(json.dumps({"pipeline": pipeline.get("name", "unnamed"), "results": results}))
