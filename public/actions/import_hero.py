import bpy, json, os, traceback
from mathutils import Vector

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

glb_path = CONFIG.get("glb_path", "")
target_height = CONFIG.get("target_height", 1.7)
position = CONFIG.get("position", [0, 0, 0])
remove_blockers = CONFIG.get("remove_blockers", True)
blocker_threshold = CONFIG.get("blocker_threshold", 3.0)
fix_materials = CONFIG.get("fix_materials", True)
fallback_colors = CONFIG.get("fallback_colors", {
    "body": [0.85, 0.72, 0.62],
    "hair": [0.15, 0.12, 0.35],
    "cloth": [0.20, 0.18, 0.45],
    "bow": [0.55, 0.15, 0.20],
    "default": [0.70, 0.65, 0.75]
})

try:
    if not os.path.exists(glb_path):
        print(json.dumps({"action": "import_hero", "error": f"File not found: {glb_path}", "status": "error"}))
        raise SystemExit

    scene = bpy.context.scene
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=glb_path)
    after = set(bpy.data.objects.keys())
    new_names = after - before

    for c in bpy.data.collections:
        if c.name not in [ch.name for ch in scene.collection.children]:
            scene.collection.children.link(c)

    removed = []
    if remove_blockers:
        for name in list(new_names):
            o = bpy.data.objects.get(name)
            if o and o.type == 'MESH' and o.data is not None:
                bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
                sx = max(v[0] for v in bb) - min(v[0] for v in bb)
                sy = max(v[1] for v in bb) - min(v[1] for v in bb)
                if sx > blocker_threshold or sy > blocker_threshold:
                    removed.append(name)
                    bpy.data.objects.remove(o, do_unlink=True)
                    new_names.discard(name)

    fixed_mats = []
    if fix_materials:
        for mat in bpy.data.materials:
            if not mat.node_tree:
                continue
            has_emission = any(n.type == 'EMISSION' for n in mat.node_tree.nodes)
            has_lightpath = any(n.type == 'LIGHT_PATH' for n in mat.node_tree.nodes)
            if has_emission and has_lightpath:
                nt = mat.node_tree
                img_node = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image), None)
                saved_img = img_node.image if img_node else None
                nt.nodes.clear()
                bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
                out_m = nt.nodes.new('ShaderNodeOutputMaterial')
                nt.links.new(bsdf.outputs['BSDF'], out_m.inputs['Surface'])
                if saved_img:
                    tex = nt.nodes.new('ShaderNodeTexImage')
                    tex.image = saved_img
                    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
                else:
                    mn = mat.name.lower()
                    color = fallback_colors.get("default", [0.7, 0.65, 0.75])
                    for key in ["body", "hair", "cloth", "bow"]:
                        if key in mn:
                            color = fallback_colors.get(key, color)
                            break
                    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
                bsdf.inputs['Roughness'].default_value = 0.65
                fixed_mats.append(mat.name)

    hero_meshes = [bpy.data.objects[n] for n in new_names
                   if n in bpy.data.objects and bpy.data.objects[n].type == 'MESH' and bpy.data.objects[n].data is not None]

    if hero_meshes:
        amin = Vector((999, 999, 999))
        amax = Vector((-999, -999, -999))
        for o in hero_meshes:
            for c in o.bound_box:
                wc = o.matrix_world @ Vector(c)
                amin = Vector((min(amin[i], wc[i]) for i in range(3)))
                amax = Vector((max(amax[i], wc[i]) for i in range(3)))
        h = amax.z - amin.z
        sf = target_height / max(h, 0.01)

        roots = [bpy.data.objects[n] for n in new_names if n in bpy.data.objects and bpy.data.objects[n].parent is None]
        for r in roots:
            r.scale *= sf
        bpy.context.view_layer.update()

        amin2 = Vector((999, 999, 999))
        for o in hero_meshes:
            if o.data is None:
                continue
            for c in o.bound_box:
                wc = o.matrix_world @ Vector(c)
                amin2 = Vector((min(amin2[i], wc[i]) for i in range(3)))
        off = Vector((position[0] - 0, position[1] - 0, position[2] - amin2.z))
        for r in roots:
            r.location += off
        bpy.context.view_layer.update()

    mesh_count = len(hero_meshes)
    arm_count = sum(1 for n in new_names if n in bpy.data.objects and bpy.data.objects[n].type == 'ARMATURE')
    total_verts = sum(len(o.data.vertices) for o in hero_meshes)

    print(json.dumps({
        "action": "import_hero",
        "glb_path": glb_path,
        "meshes": mesh_count,
        "armatures": arm_count,
        "vertices": total_verts,
        "target_height": target_height,
        "position": position,
        "removed_blockers": removed,
        "fixed_materials": fixed_mats,
        "status": "ok"
    }))

except SystemExit:
    pass
except Exception as e:
    print(json.dumps({"action": "import_hero", "error": str(e), "status": "error"}))
    traceback.print_exc()
