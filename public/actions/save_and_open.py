import bpy, json, os, subprocess

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

blend_path = CONFIG.get("blend_path", "")
open_gui = CONFIG.get("open_gui", False)
open_render = CONFIG.get("open_render", "")

result = {"action": "save_and_open", "status": "ok"}

if blend_path:
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    result["blend"] = blend_path

if open_gui and blend_path:
    subprocess.Popen([
        r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe",
        blend_path
    ])
    result["gui_opened"] = True

if open_render and os.path.exists(open_render):
    subprocess.Popen(['cmd', '/c', 'start', '', open_render], shell=False)
    result["render_opened"] = open_render

print(json.dumps(result))
