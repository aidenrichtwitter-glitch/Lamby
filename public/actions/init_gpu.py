import bpy, json, sys, os

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "CUDA"
prefs.get_devices()
for d in prefs.devices:
    d.use = (d.type != "CPU")
gpus = [d.name for d in prefs.devices if d.use]
print(json.dumps({"action": "init_gpu", "gpus": gpus, "status": "ok"}))
