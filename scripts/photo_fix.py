import bpy, math
from mathutils import Vector

scene = bpy.context.scene

# Fix 1: Brighter sun
sun = bpy.data.objects.get("KeySun")
if sun:
    sun.data.energy = 8.0
    sun.data.color = (1.0, 0.92, 0.8)
    sun.rotation_euler = (math.radians(55), math.radians(5), math.radians(40))
    print(f"Sun: energy=8, warmer angle")

# Fix 2: Reduce volumetric haze
world = scene.world
if world and world.use_nodes:
    for n in world.node_tree.nodes:
        if n.type == 'VOLUME_SCATTER':
            n.inputs['Density'].default_value = 0.002  # Was 0.008
            print("Volumetric: 0.002 (was 0.008)")
        if n.type == 'BACKGROUND':
            n.inputs['Strength'].default_value = 1.8  # Was 1.2
            print("Sky strength: 1.8")
    # Raise sun elevation for brighter scene
    for n in world.node_tree.nodes:
        if n.type == 'TEX_SKY':
            n.sun_elevation = math.radians(35)  # Was 20
            print("Sun elevation: 35deg (was 20)")

# Fix 3: Brighter fill and rim
fill = bpy.data.objects.get("FillLight")
if fill:
    fill.data.energy = 250
    print("Fill: 250")

rim = bpy.data.objects.get("RimLight")
if rim:
    rim.data.energy = 400
    print("Rim: 400")

# Fix 4: Exposure
scene.view_settings.exposure = 0.5  # Was 0.2
print("Exposure: 0.5")

# Fix 5: Camera — wider, pulled back more, lower to show more scene
cam = bpy.data.objects.get("PhotoCamera")
if cam:
    cam.location = (0.5, -11, 1.6)
    cam.data.lens = 50  # Was 85 — too telephoto
    target = Vector((0, 0, 1.3))
    direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    cam.data.dof.focus_distance = 11.0
    cam.data.dof.aperture_fstop = 3.5
    print(f"Camera: 50mm, pos=(0.5,-11,1.6), f/3.5")

# Quick verify
scene.cycles.samples = 16
verify = 'C:/Users/Aiden/Desktop/godmode-evidence/photorealistic_cel_VERIFY2.png'
scene.render.filepath = verify
bpy.ops.render.render(write_still=True)
print(f"VERIFY2: {verify}")
bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/photorealistic_cel.blend')
