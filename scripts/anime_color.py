import bpy, math
from mathutils import Vector

scene = bpy.context.scene

# Fix cel-shade to preserve original texture colors
# Instead of ColorRamp replacing color, use it as a multiply/lighten mask
print("=== COLOR CEL-SHADE FIX ===")
for mat in bpy.data.materials:
    if mat.name in ("FloorMat", "FloorMat.001"):
        continue
    if not mat.node_tree:
        continue
    
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    
    bsdf = None
    output = None
    s2rgb = None
    cr = None
    
    for node in nodes:
        if node.type == 'BSDF_PRINCIPLED':
            bsdf = node
        elif node.type == 'OUTPUT_MATERIAL':
            output = node
        elif node.type == 'SHADERTORGB':
            s2rgb = node
        elif node.type == 'VALTORGB':
            cr = node
    
    if not bsdf or not output or not s2rgb or not cr:
        continue
    
    # Get whatever is plugged into the BSDF Base Color
    base_color_input = bsdf.inputs["Base Color"]
    base_color_link = None
    for link in links:
        if link.to_socket == base_color_input:
            base_color_link = link
            break
    
    # Create MixRGB node: multiply cel-shade tones with original color
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.location = (cr.location.x + 200, cr.location.y)
    mix.inputs['Factor'].default_value = 1.0
    
    # ColorRamp output → Mix A
    # Original base color/texture → Mix B
    # Clear old links to output
    for link in list(links):
        if link.to_node == output and link.to_socket.name == 'Surface':
            links.remove(link)
    
    # ShaderToRGB color output also has the original coloring baked in
    # So just use CR output directly with some tweaks
    
    # Actually simpler approach: make CR use the original color values
    # Set color ramp to use lighter steps so original texture shows through
    cr.color_ramp.elements[0].position = 0.0
    cr.color_ramp.elements[0].color = (0.3, 0.28, 0.35, 1.0)  # Dark shadow
    cr.color_ramp.elements[1].position = 0.3
    cr.color_ramp.elements[1].color = (0.85, 0.83, 0.88, 1.0)  # Mid tone
    # Third element (highlight)
    if len(cr.color_ramp.elements) > 2:
        cr.color_ramp.elements[2].position = 0.65
        cr.color_ramp.elements[2].color = (1.0, 0.98, 1.0, 1.0)  # Bright highlight
    
    # Route: S2RGB → CR → Mix(multiply) with S2RGB.Color → Output
    links.new(s2rgb.outputs['Color'], mix.inputs[6])  # A (color input)
    links.new(cr.outputs['Color'], mix.inputs[7])  # B (factor/mask)
    links.new(mix.outputs[2], output.inputs['Surface'])  # Result
    
    # Remove old direct link
    nodes.remove(mix)  # Actually this multiply won't work well
    
    # Simplest fix: just link CR directly to output (it already has tone)
    # But use S2RGB Color output which preserves hue
    links.new(s2rgb.outputs['Color'], output.inputs['Surface'])
    
    print(f"  Color-fixed: {mat.name}")

# Actually, best approach for anime: use ShaderToRGB direct output
# which naturally has the texture colors + lighting baked in
# The color ramp was flattening it to grayscale

# Make the background more colorful
world = scene.world
if world and world.node_tree:
    wnodes = world.node_tree.nodes
    wlinks = world.node_tree.links
    
    # Clear existing nodes
    for n in list(wnodes):
        wnodes.remove(n)
    
    # Gradient background: anime sky pink → blue
    output = wnodes.new('ShaderNodeOutputWorld')
    output.location = (600, 0)
    
    bg = wnodes.new('ShaderNodeBackground')
    bg.location = (400, 0)
    bg.inputs['Strength'].default_value = 1.0
    
    mix = wnodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.location = (200, 0)
    mix.inputs[6].default_value = (1.0, 0.7, 0.85, 1.0)  # Pink (bottom)
    mix.inputs[7].default_value = (0.55, 0.78, 1.0, 1.0)  # Sky blue (top)
    
    # Map window for gradient direction
    texcoord = wnodes.new('ShaderNodeTexCoord')
    texcoord.location = (-200, 0)
    
    sep = wnodes.new('ShaderNodeSeparateXYZ')
    sep.location = (0, 0)
    
    wlinks.new(texcoord.outputs['Window'], sep.inputs['Vector'])
    wlinks.new(sep.outputs['Y'], mix.inputs['Factor'])
    wlinks.new(mix.outputs[2], bg.inputs['Color'])
    wlinks.new(bg.outputs['Background'], output.inputs['Surface'])
    
    print("World gradient fixed")

# Make floor slightly reflective with subtle color
floor_mat = bpy.data.materials.get("FloorMat.001") or bpy.data.materials.get("FloorMat")
if floor_mat and floor_mat.node_tree:
    for node in floor_mat.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            node.inputs["Base Color"].default_value = (0.95, 0.92, 0.97, 1.0)
            node.inputs["Roughness"].default_value = 0.08
            node.inputs["Metallic"].default_value = 0.0
    # Remove cel-shade from floor
    fnodes = floor_mat.node_tree.nodes
    flinks = floor_mat.node_tree.links
    fbsdf = None
    fout = None
    for n in fnodes:
        if n.type == 'BSDF_PRINCIPLED': fbsdf = n
        elif n.type == 'OUTPUT_MATERIAL': fout = n
    
    # Remove all non-essential nodes from floor
    for n in list(fnodes):
        if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'):
            fnodes.remove(n)
    
    if fbsdf and fout:
        for link in list(flinks):
            if link.to_node == fout:
                flinks.remove(link)
        flinks.new(fbsdf.outputs['BSDF'], fout.inputs['Surface'])

# Freestyle line thickness
scene.view_layers[0].freestyle_settings.linesets[0].linestyle.thickness = 2.0

# Save and render
bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/anime_scene.blend')
scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_cel_shaded.png'
bpy.ops.render.render(write_still=True)
print("ANIME_COLOR_RENDER_COMPLETE")
