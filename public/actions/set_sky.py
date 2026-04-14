import bpy, json, os, math

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

preset = CONFIG.get("preset", "night")
strength = CONFIG.get("strength", 0.6)

PRESETS = {
    "night": {"elevation": -5, "rotation": 120, "altitude": 100},
    "sunset": {"elevation": 5, "rotation": 200, "altitude": 0},
    "golden_hour": {"elevation": 8, "rotation": 160, "altitude": 0},
    "overcast": {"elevation": 30, "rotation": 0, "altitude": 500},
    "noon": {"elevation": 70, "rotation": 0, "altitude": 0},
}

p = PRESETS.get(preset, PRESETS["night"])
if "elevation" in CONFIG: p["elevation"] = CONFIG["elevation"]
if "rotation" in CONFIG: p["rotation"] = CONFIG["rotation"]

world = bpy.data.worlds.new("World")
bpy.context.scene.world = world
world.use_nodes = True
nt = world.node_tree
nt.nodes.clear()
sky = nt.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'NISHITA'
sky.sun_elevation = math.radians(p["elevation"])
sky.sun_rotation = math.radians(p["rotation"])
sky.altitude = p.get("altitude", 0)
bg = nt.nodes.new('ShaderNodeBackground')
bg.inputs['Strength'].default_value = strength
out_w = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
nt.links.new(bg.outputs['Background'], out_w.inputs['Surface'])

print(json.dumps({"action": "set_sky", "preset": preset, "elevation": p["elevation"], "status": "ok"}))
