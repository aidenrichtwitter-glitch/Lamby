import bpy
from mathutils import Vector

print("═══ SCENE AUDIT: Post-User-Edit ═══")

SKIP = {'Ground', 'MainCam', 'Sun', 'FillLight', 'RimLight'}

for o in bpy.data.objects:
    if o.parent is not None: continue
    if o.name in SKIP: continue
    if o.type not in ('MESH', 'EMPTY', 'ARMATURE'): continue
    
    meshes = []
    def collect(obj):
        if obj.type == 'MESH': meshes.append(obj)
        for c in obj.children: collect(c)
    collect(o)
    if not meshes: continue
    
    bpy.context.view_layer.update()
    bb_min = Vector((float('inf'),)*3)
    bb_max = Vector((float('-inf'),)*3)
    for m in meshes:
        for corner in m.bound_box:
            wc = m.matrix_world @ Vector(corner)
            for i in range(3):
                bb_min[i] = min(bb_min[i], wc[i])
                bb_max[i] = max(bb_max[i], wc[i])
    
    h = bb_max[2] - bb_min[2]
    loc = o.location
    children = len(list(o.children_recursive))
    armatures = sum(1 for c in o.children_recursive if c.type == 'ARMATURE')
    
    zone = 'PARKED' if loc.x > 100 else 'IN-SCENE'
    print(f"  {o.name:30s} {zone:8s} loc=({loc.x:7.1f},{loc.y:7.1f},{loc.z:7.2f}) h={h:6.2f}m children={children} arm={armatures}")

# Camera info
cam = bpy.context.scene.camera
if cam:
    import math
    print(f"\n  Camera: ({cam.location.x:.1f},{cam.location.y:.1f},{cam.location.z:.1f})")
    print(f"  Rot: ({math.degrees(cam.rotation_euler.x):.1f},{math.degrees(cam.rotation_euler.y):.1f},{math.degrees(cam.rotation_euler.z):.1f})")
    print(f"  Lens: {cam.data.lens:.0f}mm")
