import bpy, json, os, math

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

loc = CONFIG.get("location", [1.0, -4.0, 1.2])
rot_deg = CONFIG.get("rotation_deg", [80, 0, 5])
lens = CONFIG.get("lens", 35)
name = CONFIG.get("name", "MainCam")

cam_data = bpy.data.cameras.new(name)
cam_data.lens = lens
cam_obj = bpy.data.objects.new(name, cam_data)
bpy.context.collection.objects.link(cam_obj)
cam_obj.location = tuple(loc)
cam_obj.rotation_euler = tuple(math.radians(r) for r in rot_deg)
bpy.context.scene.camera = cam_obj

print(json.dumps({"action": "add_camera", "name": name, "lens": lens, "location": loc, "status": "ok"}))
