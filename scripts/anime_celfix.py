import bpy, math
from mathutils import Vector

scene = bpy.context.scene

# First, let's check what materials exist and what the nodes look like
print("=== MATERIAL ANALYSIS ===")
for mat in bpy.data.materials:
    if mat.node_tree:
        nodes = [n.type for n in mat.node_tree.nodes]
        print(f"  {mat.name}: {nodes}")

# The issue: cel-shade outlines via Solidify modifier with flipped normals + black material
# If outline material (index 1) is covering everything, the Solidify is too thick or
# the face flip isn't working right at this scale.

# Remove all Solidify modifiers (they don't scale well with 10x scaling)
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        for mod in list(obj.modifiers):
            if mod.type == 'SOLIDIFY':
                obj.modifiers.remove(mod)
                print(f"  Removed Solidify from {obj.name}")

# Instead, create cel-shade outline using Freestyle
scene.render.use_freestyle = True
scene.view_layers[0].freestyle_settings.as_render_pass = False
scene.view_layers[0].use_freestyle = True

# Configure Freestyle lineset
linesets = scene.view_layers[0].freestyle_settings.linesets
if len(linesets) > 0:
    ls = linesets[0]
else:
    ls = linesets.new("CelOutline")

ls.select_silhouette = True
ls.select_border = True
ls.select_crease = True
ls.select_edge_mark = False
ls.select_external_contour = True

# Line style
style = ls.linestyle
style.color = (0.05, 0.02, 0.05)  # Near-black
style.thickness = 2.5
style.alpha = 1.0

# Now fix the cel-shade materials to use original textures with ShaderToRGB
# The original textures from Sketchfab should still be in the materials
print("\n=== FIXING CEL-SHADE MATERIALS ===")
for mat in bpy.data.materials:
    if mat.name in ("FloorMat", "OutlineMat"):
        continue
    if not mat.node_tree:
        continue
    
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    
    # Find the existing nodes
    bsdf = None
    output = None
    shader_rgb = None
    color_ramp = None
    
    for node in nodes:
        if node.type == 'BSDF_PRINCIPLED':
            bsdf = node
        elif node.type == 'OUTPUT_MATERIAL':
            output = node
        elif node.type == 'SHADERTORGB':
            shader_rgb = node
        elif node.type == 'VALTORGB':
            color_ramp = node
    
    if not bsdf or not output:
        continue
    
    # Remove existing ShaderToRGB + ColorRamp if present (we'll redo them properly)
    if shader_rgb:
        nodes.remove(shader_rgb)
    if color_ramp:
        nodes.remove(color_ramp)
    
    # Create proper cel-shade chain: BSDF → ShaderToRGB → ColorRamp → Output
    s2rgb = nodes.new('ShaderNodeShaderToRGB')
    s2rgb.location = (bsdf.location.x + 300, bsdf.location.y)
    
    cr = nodes.new('ShaderNodeValToRGB')
    cr.location = (s2rgb.location.x + 200, s2rgb.location.y)
    cr.color_ramp.interpolation = 'CONSTANT'
    
    # 3-step cel shading: shadow, mid, highlight
    cr.color_ramp.elements[0].position = 0.0
    cr.color_ramp.elements[0].color = (0.15, 0.15, 0.2, 1.0)  # Shadow
    cr.color_ramp.elements[1].position = 0.35
    cr.color_ramp.elements[1].color = (0.7, 0.7, 0.75, 1.0)  # Mid
    elem = cr.color_ramp.elements.new(0.7)
    elem.color = (1.0, 1.0, 1.0, 1.0)  # Highlight
    
    # Clear existing links to output
    for link in list(links):
        if link.to_node == output:
            links.remove(link)
    
    # Wire: BSDF → ShaderToRGB → ColorRamp → Output
    links.new(bsdf.outputs['BSDF'], s2rgb.inputs['Shader'])
    links.new(s2rgb.outputs['Color'], cr.inputs['Fac'])
    links.new(cr.outputs['Color'], output.inputs['Surface'])
    
    print(f"  Fixed cel-shade on: {mat.name}")

# Remove the OutlineMat material slot from all objects (only 1 slot needed now)
outline_mat = bpy.data.materials.get("OutlineMat")
for obj in bpy.data.objects:
    if obj.type == 'MESH' and len(obj.data.materials) > 1:
        # Remove outline material slot
        for i in range(len(obj.data.materials) - 1, 0, -1):
            if obj.data.materials[i] == outline_mat:
                obj.data.materials.pop(index=i)

# Remove outline material
if outline_mat:
    bpy.data.materials.remove(outline_mat)
    print("Removed OutlineMat")

# Ensure lights are strong enough
for light_obj in bpy.data.objects:
    if light_obj.type == 'LIGHT':
        if 'Key' in light_obj.name:
            light_obj.data.energy = 300
        elif 'Fill' in light_obj.name:
            light_obj.data.energy = 150
        elif 'Rim' in light_obj.name:
            light_obj.data.energy = 200
        print(f"  Light {light_obj.name}: energy={light_obj.data.energy}")

# Save and render
bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/anime_scene.blend')

scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_cel_shaded.png'
bpy.ops.render.render(write_still=True)
print("ANIME_CELFIX_RENDER_COMPLETE")
