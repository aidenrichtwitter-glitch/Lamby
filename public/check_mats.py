import bpy

print("=== HERO MATERIAL ANALYSIS ===")
for o in bpy.data.objects:
    if o.type == 'MESH' and o.data and o.data.materials:
        for mi, mat in enumerate(o.data.materials):
            if not mat or not mat.node_tree:
                continue
            nt = mat.node_tree
            print(f"\n{o.name} -> Mat[{mi}] '{mat.name}':")
            for node in nt.nodes:
                if node.type == 'TEX_IMAGE':
                    img = node.image
                    if img:
                        print(f"  ImageTex: '{img.name}' size={img.size[0]}x{img.size[1]} packed={img.packed_file is not None} colorspace={img.colorspace_settings.name}")
                    else:
                        print(f"  ImageTex: NO IMAGE LOADED")
                elif node.type == 'BSDF_PRINCIPLED':
                    bc = node.inputs.get("Base Color")
                    alpha = node.inputs.get("Alpha")
                    bc_linked = bc.is_linked if bc else False
                    print(f"  PrincipledBSDF: BaseColor linked={bc_linked}, Alpha={alpha.default_value if alpha else '?'}")
                    if not bc_linked and bc:
                        print(f"    BaseColor value: {[round(x,3) for x in bc.default_value]}")
                elif node.type == 'MIX_SHADER' or 'Mix' in node.name:
                    print(f"  {node.type}: {node.name}")
            links = [(l.from_node.name, l.to_node.name) for l in nt.links[:6]]
            if links:
                print(f"  Links: {links}")
print("\nMAT_CHECK_DONE")
