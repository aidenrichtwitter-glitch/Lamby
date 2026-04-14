import bpy
from mathutils import Vector

print("\n═══ SCENE SPATIAL AUDIT ═══")
print(f"Scene unit: {bpy.context.scene.unit_settings.system} scale={bpy.context.scene.unit_settings.scale_length}")

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
empties = [o for o in bpy.data.objects if o.type == 'EMPTY']
cameras = [o for o in bpy.data.objects if o.type == 'CAMERA']
lights = [o for o in bpy.data.objects if o.type == 'LIGHT']

print(f"\nObjects: {len(bpy.data.objects)} total, {len(meshes)} mesh, {len(empties)} empty, {len(cameras)} cam, {len(lights)} light")

# Get bounding box of entire scene
scene_min = Vector((float('inf'),)*3)
scene_max = Vector((float('-inf'),)*3)
for obj in meshes:
    for corner in obj.bound_box:
        world_co = obj.matrix_world @ Vector(corner)
        for i in range(3):
            scene_min[i] = min(scene_min[i], world_co[i])
            scene_max[i] = max(scene_max[i], world_co[i])

print(f"\nScene bounds:")
print(f"  X: {scene_min[0]:.1f} to {scene_max[0]:.1f} (width: {scene_max[0]-scene_min[0]:.1f}m)")
print(f"  Y: {scene_min[1]:.1f} to {scene_max[1]:.1f} (depth: {scene_max[1]-scene_min[1]:.1f}m)")
print(f"  Z: {scene_min[2]:.1f} to {scene_max[2]:.1f} (height: {scene_max[2]-scene_min[2]:.1f}m)")

# Top-level parent objects with their positions and sizes
print(f"\n── TOP-LEVEL OBJECTS (parents) ──")
roots = [o for o in bpy.data.objects if o.parent is None and o.type in ('MESH','EMPTY')]
for r in sorted(roots, key=lambda x: x.name)[:30]:
    loc = r.location
    dims = r.dimensions if r.type == 'MESH' else Vector((0,0,0))
    children = len(r.children_recursive)
    print(f"  {r.name:30s} pos=({loc.x:6.1f},{loc.y:6.1f},{loc.z:6.1f}) dims=({dims.x:.1f},{dims.y:.1f},{dims.z:.1f}) children={children}")

# Camera info
for cam in cameras:
    print(f"\nCamera '{cam.name}': pos=({cam.location.x:.1f},{cam.location.y:.1f},{cam.location.z:.1f}) rot=({cam.rotation_euler.x:.2f},{cam.rotation_euler.y:.2f},{cam.rotation_euler.z:.2f})")

# Lights
for lt in lights:
    print(f"Light '{lt.name}': type={lt.data.type} pos=({lt.location.x:.1f},{lt.location.y:.1f},{lt.location.z:.1f}) energy={lt.data.energy:.0f}")

# Render settings
r = bpy.context.scene.render
print(f"\nRender: {r.engine} {r.resolution_x}x{r.resolution_y}")
if r.engine == 'CYCLES':
    c = bpy.context.scene.cycles
    print(f"  Samples: {c.samples}, Denoise: {c.use_denoising}, Device: {c.device}")
