import bpy, json, os, math

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

preset = CONFIG.get("preset", "moonlit")
custom_lights = CONFIG.get("lights", [])

PRESETS = {
    "moonlit": [
        {"name": "MoonLight", "type": "AREA", "energy": 0.7, "color": [0.75, 0.80, 1.0], "size": 4, "location": [-5, 12, 8], "rotation_deg": [-35, 20, 0]},
        {"name": "FillArea", "type": "AREA", "energy": 0.5, "color": [0.50, 0.55, 0.80], "size": 6, "location": [0, -4, 3], "rotation_deg": [55, 0, 0]},
        {"name": "FrontFill", "type": "AREA", "energy": 0.4, "color": [0.85, 0.82, 0.75], "size": 4, "location": [2, -3, 2], "rotation_deg": [50, -15, 0]},
        {"name": "WarmAccent", "type": "POINT", "energy": 0.6, "color": [1.0, 0.75, 0.40], "location": [1.5, 3.0, 1.5]},
    ],
    "shrine": [
        {"name": "KeySun", "type": "SUN", "energy": 0.8, "color": [1.0, 0.95, 0.85], "rotation_deg": [-45, 30, 0]},
        {"name": "FillArea", "type": "AREA", "energy": 0.9, "color": [0.60, 0.65, 0.90], "size": 8, "location": [3, -5, 4], "rotation_deg": [50, -20, 0]},
        {"name": "RimArea", "type": "AREA", "energy": 0.7, "color": [1.0, 0.85, 0.70], "size": 3, "location": [-3, 5, 3], "rotation_deg": [-40, 30, 0]},
        {"name": "MoonLight", "type": "AREA", "energy": 0.5, "color": [0.70, 0.75, 1.0], "size": 5, "location": [0, 8, 6], "rotation_deg": [-30, 0, 0]},
        {"name": "FrontFill", "type": "AREA", "energy": 0.6, "color": [0.90, 0.88, 0.80], "size": 4, "location": [0, -4, 2], "rotation_deg": [55, 0, 0]},
        {"name": "FrontFill2", "type": "AREA", "energy": 0.4, "color": [0.80, 0.82, 0.90], "size": 3, "location": [-2, -3, 1.5], "rotation_deg": [45, 10, 0]},
    ],
    "cyberpunk": [
        {"name": "NeonPink", "type": "AREA", "energy": 0.8, "color": [1.0, 0.20, 0.60], "size": 3, "location": [-3, 2, 3], "rotation_deg": [-30, 20, 0]},
        {"name": "NeonBlue", "type": "AREA", "energy": 0.7, "color": [0.20, 0.40, 1.0], "size": 3, "location": [3, 4, 2], "rotation_deg": [-40, -20, 0]},
        {"name": "StreetLight", "type": "POINT", "energy": 0.9, "color": [1.0, 0.90, 0.70], "location": [0, 0, 4]},
        {"name": "FillDim", "type": "AREA", "energy": 0.3, "color": [0.50, 0.50, 0.60], "size": 8, "location": [0, -5, 3], "rotation_deg": [50, 0, 0]},
    ],
}

lights_to_add = custom_lights if custom_lights else PRESETS.get(preset, PRESETS["moonlit"])
added = []

for ldef in lights_to_add:
    ltype = ldef.get("type", "POINT")
    ldata = bpy.data.lights.new(ldef["name"], ltype)
    ldata.energy = ldef.get("energy", 0.5)
    ldata.color = tuple(ldef.get("color", [1, 1, 1]))
    if ltype == "AREA":
        ldata.size = ldef.get("size", 4)
    lobj = bpy.data.objects.new(ldef["name"], ldata)
    bpy.context.collection.objects.link(lobj)
    if "location" in ldef:
        lobj.location = tuple(ldef["location"])
    if "rotation_deg" in ldef:
        import math
        lobj.rotation_euler = tuple(math.radians(r) for r in ldef["rotation_deg"])
    added.append(ldef["name"])

print(json.dumps({"action": "add_lighting", "preset": preset, "lights": added, "status": "ok"}))
