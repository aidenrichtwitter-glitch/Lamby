import bpy, os

bpy.ops.wm.read_homefile(use_empty=True)
scene = bpy.context.scene

print("=== BEFORE IMPORT ===")
print(f"Collections: {[c.name for c in bpy.data.collections]}")
print(f"Scene.collection objects: {[o.name for o in scene.collection.objects]}")
print(f"Scene.collection children: {[c.name for c in scene.collection.children]}")

hero_path = r"C:\Users\Aiden\Downloads\85187f9f246f4702b7c137dcc6c0fc12.glb"
bpy.ops.import_scene.gltf(filepath=hero_path)

print("\n=== AFTER IMPORT ===")
print(f"Collections: {[c.name for c in bpy.data.collections]}")
print(f"Scene.collection objects: {[o.name for o in scene.collection.objects]}")
print(f"Scene.collection children: {[c.name for c in scene.collection.children]}")

for c in bpy.data.collections:
    print(f"\n  Collection '{c.name}': {len(c.objects)} objects")
    for o in c.objects:
        print(f"    {o.type}: {o.name}")

for vl in scene.view_layers:
    print(f"\nViewLayer '{vl.name}':")
    def show_lc(lc, indent=0):
        ex = "EXCLUDED" if lc.exclude else "included"
        hr = "HIDE_RENDER" if hasattr(lc, 'hide_viewport') and lc.hide_viewport else ""
        print(f"{'  '*(indent+1)}'{lc.name}': {ex} {hr} (direct_objs={len(lc.collection.objects)})")
        for child in lc.children:
            show_lc(child, indent+1)
    show_lc(vl.layer_collection)

print("\nCHECK_DONE")
