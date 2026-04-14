import bpy, math, random
from mathutils import Vector

random.seed(777)
scene = bpy.context.scene

# ─── SWITCH VIEWPORT TO MATERIAL PREVIEW ───
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        for space in area.spaces:
            if space.type == 'VIEW_3D':
                space.shading.type = 'MATERIAL'
                break

# ─── IMPROVE TERRAIN: add displacement for rolling hills ───
terrain = bpy.data.objects.get("Terrain")
if terrain:
    # Add subdivision surface for smoother displacement
    if not any(m.type == 'SUBSURF' for m in terrain.modifiers):
        sub = terrain.modifiers.new("Subdivide", 'SUBSURF')
        sub.levels = 2
        sub.render_levels = 3

    # Improve material with color gradient
    if terrain.data.materials:
        mat = terrain.data.materials[0]
        nt = mat.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        if bsdf:
            # Add noise-driven color variation (dry patches)
            tc = nt.nodes.new("ShaderNodeTexCoord")
            noise1 = nt.nodes.new("ShaderNodeTexNoise")
            noise1.inputs["Scale"].default_value = 3.0
            noise1.inputs["Detail"].default_value = 8.0
            noise1.inputs["Roughness"].default_value = 0.6
            
            ramp = nt.nodes.new("ShaderNodeValToRGB")
            ramp.color_ramp.elements[0].position = 0.35
            ramp.color_ramp.elements[0].color = (0.15, 0.42, 0.06, 1)  # Lush green
            ramp.color_ramp.elements[1].position = 0.65
            ramp.color_ramp.elements[1].color = (0.25, 0.35, 0.08, 1)  # Dry green
            elem = ramp.color_ramp.elements.new(0.85)
            elem.color = (0.35, 0.28, 0.12, 1)  # Dirt patches
            
            nt.links.new(tc.outputs["Generated"], noise1.inputs["Vector"])
            nt.links.new(noise1.outputs["Fac"], ramp.inputs["Fac"])
            nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])

# ─── IMPROVE TREE CANOPIES: better leaf-like look ───
canopy_mat = bpy.data.materials.get("CanopyMaterial")
if canopy_mat:
    cnt = canopy_mat.node_tree
    cbsdf = cnt.nodes.get("Principled BSDF")
    if cbsdf:
        # Add noise for leaf variation
        tc = cnt.nodes.new("ShaderNodeTexCoord")
        noise = cnt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 12.0
        noise.inputs["Detail"].default_value = 6.0
        
        ramp = cnt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.3
        ramp.color_ramp.elements[0].color = (0.05, 0.28, 0.02, 1)  # Dark green
        ramp.color_ramp.elements[1].position = 0.7
        ramp.color_ramp.elements[1].color = (0.12, 0.5, 0.08, 1)   # Bright green
        
        cnt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
        cnt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        cnt.links.new(ramp.outputs["Color"], cbsdf.inputs["Base Color"])
        
        cbsdf.inputs["Roughness"].default_value = 0.65
        cbsdf.inputs["Subsurface Weight"].default_value = 0.2
        cbsdf.inputs["Subsurface Radius"].default_value = (0.1, 0.5, 0.05)

# ─── IMPROVE ROCK MATERIAL: mossy rocks ───
rock_mat = bpy.data.materials.get("RockMaterial")
if rock_mat:
    rnt = rock_mat.node_tree
    rbsdf = rnt.nodes.get("Principled BSDF")
    if rbsdf:
        tc = rnt.nodes.new("ShaderNodeTexCoord")
        noise = rnt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 5.0
        noise.inputs["Detail"].default_value = 8.0
        
        ramp = rnt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.4
        ramp.color_ramp.elements[0].color = (0.3, 0.28, 0.22, 1)  # Rock
        ramp.color_ramp.elements[1].position = 0.6
        ramp.color_ramp.elements[1].color = (0.15, 0.3, 0.08, 1)   # Moss
        
        rnt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
        rnt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        rnt.links.new(ramp.outputs["Color"], rbsdf.inputs["Base Color"])
        
        # Bump for rock texture
        bump = rnt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.4
        noise2 = rnt.nodes.new("ShaderNodeTexNoise")
        noise2.inputs["Scale"].default_value = 20.0
        noise2.inputs["Detail"].default_value = 10.0
        rnt.links.new(noise2.outputs["Fac"], bump.inputs["Height"])
        rnt.links.new(bump.outputs["Normal"], rbsdf.inputs["Normal"])

# ─── IMPROVE WATER: ripple normal map ───
water = bpy.data.objects.get("Water")
if water and water.data.materials:
    wmat = water.data.materials[0]
    wnt = wmat.node_tree
    wbsdf = wnt.nodes.get("Principled BSDF")
    if wbsdf:
        tc = wnt.nodes.new("ShaderNodeTexCoord")
        wave = wnt.nodes.new("ShaderNodeTexWave")
        wave.inputs["Scale"].default_value = 8.0
        wave.inputs["Distortion"].default_value = 3.0
        wave.inputs["Detail"].default_value = 4.0
        
        bump = wnt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.15
        
        wnt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
        wnt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
        wnt.links.new(bump.outputs["Normal"], wbsdf.inputs["Normal"])
        
        wbsdf.inputs["Base Color"].default_value = (0.03, 0.18, 0.28, 1.0)
        wbsdf.inputs["Roughness"].default_value = 0.01
        wbsdf.inputs["IOR"].default_value = 1.33
        wbsdf.inputs["Transmission Weight"].default_value = 0.85

# ─── ADD SUNBEAMS: volumetric spot light ───
beam_data = bpy.data.lights.new("SunBeam", 'SPOT')
beam_data.energy = 200
beam_data.color = (1.0, 0.95, 0.8)
beam_data.spot_size = math.radians(25)
beam_data.spot_blend = 0.8
beam_obj = bpy.data.objects.new("SunBeam", beam_data)
bpy.context.collection.objects.link(beam_obj)
beam_obj.location = (12, 5, 20)
beam_obj.rotation_euler = (math.radians(60), math.radians(-15), 0)

# ─── CAMERA: slightly higher, wider for panorama ───
cam = bpy.data.objects.get("SceneCamera")
if cam:
    cam.location = (12, -18, 7)
    cam.rotation_euler = (math.radians(68), 0, math.radians(28))
    cam.data.lens = 28
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 4.0
    cam.data.dof.focus_distance = 18
    scene.camera = cam

# ─── RENDER WITH CYCLES GPU ───
scene.render.engine = 'CYCLES'
scene.cycles.samples = 128
scene.cycles.use_denoising = True
try:
    scene.cycles.device = 'GPU'
    prefs = bpy.context.preferences.addons.get('cycles')
    if prefs:
        prefs.preferences.compute_device_type = 'CUDA'
        prefs.preferences.get_devices()
        for d in prefs.preferences.devices:
            d.use = True
except Exception as e:
    print(f"GPU setup note: {e}")

scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100

# Save
bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/landscape_v5.blend')
print("V5_SAVE_COMPLETE")

# Render
scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/landscape_v5_cycles.png'
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print("V5_RENDER_COMPLETE")
