import bpy, json, os

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

preset = CONFIG.get("preset", "sand")
size = CONFIG.get("size", 50)
location = CONFIG.get("location", [0, 5, -0.02])

PRESETS = {
    "sand": {"color": [0.62, 0.58, 0.48], "roughness": 0.95},
    "grass": {"color": [0.22, 0.38, 0.15], "roughness": 0.85},
    "stone": {"color": [0.40, 0.38, 0.35], "roughness": 0.9},
    "wood": {"color": [0.45, 0.30, 0.15], "roughness": 0.75},
    "snow": {"color": [0.92, 0.93, 0.95], "roughness": 0.6},
    "dirt": {"color": [0.35, 0.28, 0.18], "roughness": 0.95},
}

p = PRESETS.get(preset, PRESETS["sand"])
color = CONFIG.get("color", p["color"])
roughness = CONFIG.get("roughness", p["roughness"])

mat = bpy.data.materials.new(f"Ground_{preset}")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs['Base Color'].default_value = (*color, 1.0)
bsdf.inputs['Roughness'].default_value = roughness

bpy.ops.mesh.primitive_plane_add(size=size, location=tuple(location))
ground = bpy.context.active_object
ground.name = "Ground"
ground.data.materials.clear()
ground.data.materials.append(mat)

print(json.dumps({"action": "add_ground", "preset": preset, "size": size, "status": "ok"}))
