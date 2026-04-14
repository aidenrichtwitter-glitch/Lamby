"""
BLENDER HELPER — run from Blender Scripting tab
Fixes black silhouette materials + sets EEVEE for fast iteration
"""
import bpy, math
from mathutils import Vector

scene = bpy.context.scene

# ── EEVEE (no Cycles during scene build) ──────────────────────────
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 320
scene.render.resolution_y = 180

# ── FIX BLACK SILHOUETTE MATERIALS ────────────────────────────────
hero_mat_names = [
    'bow_texture','clothes_textures','body.texture','body.texture.bfc',
    'body.texture.alpha','body.texture.trasparent','hair.texture','material'
]
color_map = {
    'body':   (0.85, 0.72, 0.62, 1),
    'hair':   (0.15, 0.12, 0.35, 1),
    'clothes':(0.20, 0.18, 0.45, 1),
    'bow':    (0.55, 0.15, 0.20, 1),
    'material':(0.30, 0.28, 0.55, 1),
}

fixed = 0
for mat in bpy.data.materials:
    if mat.name not in hero_mat_names:
        continue
    nt = mat.node_tree
    if not nt:
        continue
    has_emission_lp = any(n.type == 'EMISSION' for n in nt.nodes) and \
                      any(n.type == 'LIGHT_PATH' for n in nt.nodes)
    has_principled = any(n.type == 'BSDF_PRINCIPLED' for n in nt.nodes)
    if has_principled:
        continue

    img_node = next((n for n in nt.nodes if n.type=='TEX_IMAGE' and n.image), None)
    nt.nodes.clear()
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    output = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf.location = (0, 0); output.location = (300, 0)
    nt.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    if img_node and img_node.image:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img_node.image
        tex.location = (-300, 0)
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        key = next((k for k in color_map if k in mat.name), None)
        bsdf.inputs['Base Color'].default_value = color_map.get(key, (0.7,0.65,0.6,1))

    bsdf.inputs['Roughness'].default_value = 0.65
    fixed += 1

print(f"Fixed {fixed} materials")

bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend")
print("Saved anime_shrine_scene.blend — open in Blender GUI and adjust hero rotation (Sketchfab_model → Z rotation)")
