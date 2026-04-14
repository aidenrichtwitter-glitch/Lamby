import bpy

print("=== FIX HERO MATERIALS ===")

prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type != "CPU"
bpy.context.scene.cycles.device = "GPU"

print(f"All images: {[(img.name, img.size[0], img.size[1], img.packed_file is not None) for img in bpy.data.images]}")

hero_mat_names = [
    'bow_texture', 'clothes_textures', 'body.texture', 'body.texture.bfc',
    'body.texture.alpha', 'body.texture.trasparent', 'hair.texture',
    'material'
]

for mat in bpy.data.materials:
    if mat.name not in hero_mat_names and not mat.name.startswith('material'):
        continue
    if not mat.node_tree:
        continue

    nt = mat.node_tree
    
    img_node = None
    for node in nt.nodes:
        if node.type == 'TEX_IMAGE' and node.image:
            img_node = node
            break
    
    emission_node = None
    for node in nt.nodes:
        if node.type == 'EMISSION':
            emission_node = node
            bc = emission_node.inputs.get('Color')
            if bc and not bc.is_linked:
                em_color = list(bc.default_value)
                print(f"  '{mat.name}': Emission color = {[round(x,3) for x in em_color]}")

    nt.nodes.clear()
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    output = nt.nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    nt.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    if img_node and img_node.image:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img_node.image
        tex.location = (-400, 0)
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 0.7
        print(f"  '{mat.name}': Rebuilt with image texture '{img_node.image.name}'")
    else:
        if 'body' in mat.name:
            bsdf.inputs['Base Color'].default_value = (0.85, 0.72, 0.62, 1)
        elif 'hair' in mat.name:
            bsdf.inputs['Base Color'].default_value = (0.15, 0.12, 0.35, 1)
        elif 'clothes' in mat.name:
            bsdf.inputs['Base Color'].default_value = (0.20, 0.18, 0.45, 1)
        elif 'bow' in mat.name:
            bsdf.inputs['Base Color'].default_value = (0.55, 0.15, 0.20, 1)
        elif mat.name == 'material':
            bsdf.inputs['Base Color'].default_value = (0.30, 0.28, 0.55, 1)
            bsdf.inputs['Alpha'].default_value = 0.3
            mat.blend_method = 'BLEND' if hasattr(mat, 'blend_method') else None
        else:
            bsdf.inputs['Base Color'].default_value = (0.70, 0.65, 0.60, 1)
        bsdf.inputs['Roughness'].default_value = 0.6
        print(f"  '{mat.name}': Rebuilt with flat color (no texture found)")

print("\n=== SAVE + RE-RENDER ===")
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend")
bpy.context.scene.render.filepath = r"C:\Users\Aiden\Desktop\anime_shrine_final.png"
bpy.context.scene.cycles.samples = 96
bpy.ops.render.render(write_still=True)
print("MAT_FIX_OK")
