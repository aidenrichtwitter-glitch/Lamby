import bpy
from mathutils import Vector

print("=== DETAILED MESH ANALYSIS ===")
for obj in bpy.data.objects:
    if obj.type == 'MESH' and obj.name != 'Floor':
        # Check actual vertex world positions
        verts = [obj.matrix_world @ v.co for v in obj.data.vertices[:5]]
        if verts:
            print(f"{obj.name}: first vert world pos = ({verts[0].x:.4f}, {verts[0].y:.4f}, {verts[0].z:.4f})")
            # Check bounding box
            bb_min = Vector((float('inf'),)*3)
            bb_max = Vector((float('-inf'),)*3)
            for v in obj.data.vertices:
                co = obj.matrix_world @ v.co
                for i in range(3):
                    if co[i] < bb_min[i]: bb_min[i] = co[i]
                    if co[i] > bb_max[i]: bb_max[i] = co[i]
            print(f"  BBox: ({bb_min.x:.4f},{bb_min.y:.4f},{bb_min.z:.4f}) -> ({bb_max.x:.4f},{bb_max.y:.4f},{bb_max.z:.4f})")
            print(f"  Size: ({bb_max.x-bb_min.x:.4f},{bb_max.y-bb_min.y:.4f},{bb_max.z-bb_min.z:.4f})")

# Check root hierarchy
print("\n=== ROOT OBJECTS ===")
for obj in bpy.data.objects:
    if obj.parent is None:
        print(f"Root: {obj.name} type={obj.type} loc=({obj.location.x:.4f},{obj.location.y:.4f},{obj.location.z:.4f}) scale=({obj.scale.x:.6f},{obj.scale.y:.6f},{obj.scale.z:.6f})")
        # Check matrix_world
        mw = obj.matrix_world
        print(f"  matrix_world scale: ({mw.to_scale().x:.6f},{mw.to_scale().y:.6f},{mw.to_scale().z:.6f})")

# Camera info
cam = bpy.data.objects.get("AnimeCamera")
if cam:
    print(f"\nCamera: lens={cam.data.lens}mm, loc=({cam.location.x:.3f},{cam.location.y:.3f},{cam.location.z:.3f})")
    print(f"  sensor={cam.data.sensor_width}mm, resolution={bpy.context.scene.render.resolution_x}x{bpy.context.scene.render.resolution_y}")
