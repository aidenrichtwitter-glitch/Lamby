import bpy

print("═══ HIDING CLUTTER ═══")

# Hide Icosphere objects
for name in ['Icosphere', 'Icosphere.001']:
    obj = bpy.data.objects.get(name)
    if obj:
        obj.hide_viewport = True
        obj.hide_render = True
        print(f"  Hidden: {name}")

# Hide armature display on the anime_girl skeleton so it doesn't show wireframe bones
for obj in bpy.data.objects:
    if obj.type == 'ARMATURE':
        obj.hide_viewport = True
        print(f"  Hidden armature: {obj.name}")

# Also hide the camera and lights from viewport display (they show wireframe)
for obj in bpy.data.objects:
    if obj.type in ('CAMERA', 'LIGHT'):
        obj.hide_viewport = True
        print(f"  Hidden {obj.type}: {obj.name}")

bpy.ops.wm.save_mainfile()
print("  Saved!")
print("═══ DONE ═══")
