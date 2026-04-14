import bpy, math
from mathutils import Vector

print("=== SCENE DIAGNOSTIC ===")

scene = bpy.context.scene

cam = scene.camera
if cam:
    print(f"Camera: pos={[round(x,2) for x in cam.location]}, rot_deg={[round(math.degrees(x),1) for x in cam.rotation_euler]}")
    print(f"Camera lens: {cam.data.lens}mm")
    fwd = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    print(f"Camera forward: {[round(x,2) for x in fwd]}")
else:
    print("NO CAMERA FOUND!")

print(f"\nTotal objects: {len(bpy.data.objects)}")
print(f"Meshes: {len([o for o in bpy.data.objects if o.type=='MESH'])}")
print(f"Lights: {len([o for o in bpy.data.objects if o.type=='LIGHT'])}")
print(f"Empties: {len([o for o in bpy.data.objects if o.type=='EMPTY'])}")
print(f"Armatures: {len([o for o in bpy.data.objects if o.type=='ARMATURE'])}")

print("\n=== KEY OBJECTS (non-trivial meshes) ===")
for o in bpy.data.objects:
    if o.type == 'MESH':
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        mins = Vector([min(v[i] for v in bb) for i in range(3)])
        maxs = Vector([max(v[i] for v in bb) for i in range(3)])
        size = maxs - mins
        center = (mins + maxs) / 2
        vol = size.x * size.y * size.z
        if vol > 0.01 or 'Sketchfab' in o.name or 'spirit' in o.name.lower() or 'sakura' in o.name.lower():
            print(f"  {o.name}: center={[round(x,1) for x in center]}, size={[round(x,2) for x in size]}, visible={not o.hide_render}")

print("\n=== LIGHTS ===")
for o in bpy.data.objects:
    if o.type == 'LIGHT':
        print(f"  {o.name}: type={o.data.type}, energy={o.data.energy}, pos={[round(x,1) for x in o.location]}")

print("\n=== RENDER SETTINGS ===")
print(f"Engine: {scene.render.engine}")
print(f"Resolution: {scene.render.resolution_x}x{scene.render.resolution_y}")
print(f"Output: {scene.render.filepath}")
if scene.render.engine == 'CYCLES':
    print(f"Samples: {scene.cycles.samples}")

print("\n=== WORLD ===")
w = scene.world
if w and w.node_tree:
    for n in w.node_tree.nodes:
        print(f"  Node: {n.name} ({n.type})")
        if hasattr(n, 'sky_type'):
            print(f"    sky_type={n.sky_type}, sun_elev={math.degrees(n.sun_elevation):.1f}deg")
else:
    print("  No world/nodes!")

print("\nDIAGNOSTIC_DONE")
