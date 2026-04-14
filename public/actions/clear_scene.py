import bpy, json, os

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))
keep_gpu = CONFIG.get("keep_gpu", True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in list(bpy.data.meshes): bpy.data.meshes.remove(block)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)
for block in list(bpy.data.lights): bpy.data.lights.remove(block)
for block in list(bpy.data.cameras): bpy.data.cameras.remove(block)
for block in list(bpy.data.images): bpy.data.images.remove(block)
for block in list(bpy.data.textures): bpy.data.textures.remove(block)

print(json.dumps({"action": "clear_scene", "status": "ok"}))
