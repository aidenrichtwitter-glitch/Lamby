import bpy, math, random
from mathutils import Vector

random.seed(7)
scene = bpy.context.scene

# ═══════════════════════════════════════════════════════════════
# PHOTOREALISTIC SCENE + CEL-SHADED ANIME GIRL
# Tutorial-based: HDRI-style sky, volumetric atmosphere, PBR ground
# with displacement, realistic lighting, Freestyle outlines on character
# ═══════════════════════════════════════════════════════════════

print("═══ PHOTOREALISTIC + CEL-SHADE BUILD ═══")

# ─── CLEAN ───
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in [bpy.data.meshes, bpy.data.materials, bpy.data.textures, bpy.data.images,
              bpy.data.node_groups, bpy.data.worlds]:
    for item in list(block):
        if item.users == 0:
            block.remove(item)
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

# ═══ 1. IMPORT & SIZE MODELS ═══
# Using crystal: control:blender:import:multi

MODELS = {
    'girl': {
        'path': 'C:/Users/Aiden/Downloads/79e0a10c1ed249b6b5c9a65030826b75.glb',
        'target_height': 2.5,
        'position': (0, 0, 0),
    },
    'tree': {
        'path': 'C:/Users/Aiden/Downloads/bc1df9f4b7de421886b84af8ee8bcea1.glb',
        'target_height': 7.0,
        'position': (-5, 8, 0),
    },
    'rocks': {
        'path': 'C:/Users/Aiden/Downloads/d30f62e2797c48d48aefb82a12a3a788.glb',
        'target_height': 0.6,
        'position': (2.5, 1.5, 0),
    },
}

def measure_raw(objects):
    meshes = [o for o in objects if o.type == 'MESH' and len(o.data.vertices) > 0]
    if not meshes:
        return 0, None, None
    infos = []
    for obj in meshes:
        mn = Vector((float('inf'),)*3)
        mx = Vector((float('-inf'),)*3)
        for v in obj.data.vertices:
            co = obj.matrix_world @ v.co
            for i in range(3):
                mn[i] = min(mn[i], co[i])
                mx[i] = max(mx[i], co[i])
        dim = max(mx[j] - mn[j] for j in range(3))
        infos.append((obj, dim, mn, mx))
    infos.sort(key=lambda x: x[1])
    median = infos[len(infos)//2][1]
    stray_kw = {'Icosphere', 'Plane', 'pPlane'}
    clean = []
    for obj, dim, mn, mx in infos:
        if median > 0 and dim > median * 10 and any(s in obj.name for s in stray_kw):
            print(f"  STRAY: {obj.name}")
            bpy.data.objects.remove(obj, do_unlink=True)
        else:
            clean.append((mn, mx))
    if not clean:
        return 0, None, None
    total_min = Vector((float('inf'),)*3)
    total_max = Vector((float('-inf'),)*3)
    for mn, mx in clean:
        for i in range(3):
            total_min[i] = min(total_min[i], mn[i])
            total_max[i] = max(total_max[i], mx[i])
    return total_max[2] - total_min[2], total_min, total_max

imported = {}
girl_meshes = []
for name, cfg in MODELS.items():
    print(f"\n── {name.upper()} ──")
    before = set(bpy.data.objects[:])
    bpy.ops.import_scene.gltf(filepath=cfg['path'])
    new_objs = list(set(bpy.data.objects[:]) - before)
    print(f"  Objects: {len(new_objs)}")
    root = None
    for o in new_objs:
        if o.parent is None:
            root = o
            break
    height, mn, mx = measure_raw(new_objs)
    print(f"  Native height: {height:.3f}m")
    if height < 0.001:
        continue
    scale_f = cfg['target_height'] / height
    print(f"  Scale: {scale_f:.6f}x → {cfg['target_height']}m")
    if root:
        root.scale *= scale_f
        bpy.context.view_layer.update()
        new_min_z = mn.z * scale_f
        new_center_x = (mn.x + mx.x) / 2 * scale_f
        new_center_y = (mn.y + mx.y) / 2 * scale_f
        root.location.x = cfg['position'][0] - new_center_x
        root.location.y = cfg['position'][1] - new_center_y
        root.location.z = -new_min_z
        bpy.context.view_layer.update()
        print(f"  Placed at {cfg['position']}")
    imported[name] = root
    if name == 'girl':
        girl_meshes = [o for o in new_objs if o.type == 'MESH']

# ═══ 2. CEL-SHADE THE ANIME GIRL (Cycles-compatible) ═══
# In Cycles, ShaderToRGB doesn't work. Instead:
# - Keep original textures for color
# - Add Freestyle outlines for the ink-line cel look
# - Use toon-like shading via ColorRamp on a Diffuse BSDF's output
print("\n── Cel-shade materials ──")
for obj in girl_meshes:
    if obj.name not in bpy.data.objects:
        continue
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        
        # Find the Principled BSDF and its base color input
        pbsdf = None
        for n in nodes:
            if n.type == 'BSDF_PRINCIPLED':
                pbsdf = n
                break
        if not pbsdf:
            continue
        
        # Get the base color source (texture or color)
        base_color_link = None
        base_color = pbsdf.inputs['Base Color'].default_value[:]
        for link in list(links):
            if link.to_node == pbsdf and link.to_socket == pbsdf.inputs['Base Color']:
                base_color_link = link.from_socket
                break
        
        # Create toon shader: Diffuse → ColorRamp (stepped) → Emission
        # This creates hard shadow edges like cel-shading
        diffuse = nodes.new('ShaderNodeBsdfDiffuse')
        diffuse.location = (-200, 200)
        
        # Connect the original texture to the diffuse color
        if base_color_link:
            links.new(base_color_link, diffuse.inputs['Color'])
        else:
            diffuse.inputs['Color'].default_value = base_color
        
        # We can't use ShaderToRGB in Cycles, so we keep it simple:
        # Use the Diffuse BSDF directly but flatten the roughness
        # and reduce specular for a flatter anime look
        pbsdf.inputs['Roughness'].default_value = 1.0
        try:
            pbsdf.inputs['Specular IOR Level'].default_value = 0.0
        except:
            pass
        try:
            pbsdf.inputs['Metallic'].default_value = 0.0
        except:
            pass
        
        # Remove the extra diffuse node we created (keeping Principled but flat)
        nodes.remove(diffuse)
        
        print(f"  Flattened: {mat.name}")

# ═══ 3. FREESTYLE OUTLINES (works in Cycles!) ═══
print("\n── Freestyle outlines ──")
scene.render.use_freestyle = True
vl = scene.view_layers[0]
vl.use_freestyle = True
vl.freestyle_settings.linesets[0].select_silhouette = True
vl.freestyle_settings.linesets[0].select_border = True
vl.freestyle_settings.linesets[0].select_crease = True
vl.freestyle_settings.linesets[0].select_edge_mark = False
ls = vl.freestyle_settings.linesets[0].linestyle
ls.color = (0, 0, 0)  # Black outlines
ls.thickness = 1.5
ls.alpha = 1.0

# ═══ 4. PHOTOREALISTIC ENVIRONMENT ═══

# ── 4a. GROUND with PBR displacement ──
print("\n── PBR Ground ──")
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 10, 0))
ground = bpy.context.active_object
ground.name = "Ground"

# Subdivide for displacement
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.subdivide(number_cuts=40)
bpy.ops.object.mode_set(mode='OBJECT')

gmat = bpy.data.materials.new("PBR_Ground")
gmat.use_nodes = True
gn = gmat.node_tree.nodes
gl = gmat.node_tree.links
gbsdf = gn["Principled BSDF"]
out_node = gn["Material Output"]

# Texture coordinates
texcoord = gn.new('ShaderNodeTexCoord')
texcoord.location = (-1200, 0)
mapping = gn.new('ShaderNodeMapping')
mapping.location = (-1000, 0)
mapping.inputs['Scale'].default_value = (3, 3, 3)
gl.new(texcoord.outputs['UV'], mapping.inputs['Vector'])

# Noise for ground color variation (grass with dirt patches)
noise1 = gn.new('ShaderNodeTexNoise')
noise1.location = (-800, 200)
noise1.inputs['Scale'].default_value = 15.0
noise1.inputs['Detail'].default_value = 12.0
noise1.inputs['Roughness'].default_value = 0.6
gl.new(mapping.outputs['Vector'], noise1.inputs['Vector'])

# Color ramp: grass greens with earth tones
cr1 = gn.new('ShaderNodeValToRGB')
cr1.location = (-500, 200)
cr1.color_ramp.elements[0].position = 0.3
cr1.color_ramp.elements[0].color = (0.015, 0.06, 0.01, 1)  # Dark grass
cr1.color_ramp.elements[1].position = 0.55
cr1.color_ramp.elements[1].color = (0.04, 0.12, 0.02, 1)   # Mid grass
el = cr1.color_ramp.elements.new(0.75)
el.color = (0.08, 0.04, 0.02, 1)  # Dirt patches
gl.new(noise1.outputs['Fac'], cr1.inputs['Fac'])
gl.new(cr1.outputs['Color'], gbsdf.inputs['Base Color'])

# Roughness variation
noise2 = gn.new('ShaderNodeTexNoise')
noise2.location = (-800, -100)
noise2.inputs['Scale'].default_value = 25.0
noise2.inputs['Detail'].default_value = 8.0
gl.new(mapping.outputs['Vector'], noise2.inputs['Vector'])
cr2 = gn.new('ShaderNodeValToRGB')
cr2.location = (-500, -100)
cr2.color_ramp.elements[0].position = 0.4
cr2.color_ramp.elements[0].color = (0.7, 0.7, 0.7, 1)
cr2.color_ramp.elements[1].position = 0.8
cr2.color_ramp.elements[1].color = (0.95, 0.95, 0.95, 1)
gl.new(noise2.outputs['Fac'], cr2.inputs['Fac'])
gl.new(cr2.outputs['Color'], gbsdf.inputs['Roughness'])

# Displacement (micro bumps)
noise3 = gn.new('ShaderNodeTexNoise')
noise3.location = (-800, -400)
noise3.inputs['Scale'].default_value = 30.0
noise3.inputs['Detail'].default_value = 10.0
gl.new(mapping.outputs['Vector'], noise3.inputs['Vector'])
disp = gn.new('ShaderNodeDisplacement')
disp.location = (-200, -400)
disp.inputs['Scale'].default_value = 0.15
disp.inputs['Midlevel'].default_value = 0.5
gl.new(noise3.outputs['Fac'], disp.inputs['Height'])
gl.new(disp.outputs['Displacement'], out_node.inputs['Displacement'])

# Normal map from noise for surface detail
bump = gn.new('ShaderNodeBump')
bump.location = (-200, -200)
bump.inputs['Strength'].default_value = 0.3
noise4 = gn.new('ShaderNodeTexNoise')
noise4.location = (-500, -300)
noise4.inputs['Scale'].default_value = 50.0
noise4.inputs['Detail'].default_value = 6.0
gl.new(mapping.outputs['Vector'], noise4.inputs['Vector'])
gl.new(noise4.outputs['Fac'], bump.inputs['Height'])
gl.new(bump.outputs['Normal'], gbsdf.inputs['Normal'])

ground.data.materials.append(gmat)

# ── 4b. VOLUMETRIC ATMOSPHERE ──
print("── Volumetric atmosphere ──")
world = bpy.data.worlds.new("PhotoWorld")
scene.world = world
world.use_nodes = True
wn = world.node_tree
for n in list(wn.nodes): wn.nodes.remove(n)

# Sky texture
sky = wn.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'HOSEK_WILKIE'
sky.sun_elevation = math.radians(20)    # Golden hour low sun
sky.sun_rotation = math.radians(120)
sky.sun_intensity = 1.0
sky.location = (-400, 200)

bg = wn.nodes.new('ShaderNodeBackground')
bg.inputs['Strength'].default_value = 1.2
bg.location = (-100, 200)

# Volume scatter for atmospheric haze
vol_scatter = wn.nodes.new('ShaderNodeVolumeScatter')
vol_scatter.inputs['Color'].default_value = (0.8, 0.85, 0.95, 1)  # Slight blue
vol_scatter.inputs['Density'].default_value = 0.008  # Very subtle haze
vol_scatter.location = (-100, -100)

wo = wn.nodes.new('ShaderNodeOutputWorld')
wo.location = (200, 0)

wn.links.new(sky.outputs['Color'], bg.inputs['Color'])
wn.links.new(bg.outputs['Background'], wo.inputs['Surface'])
wn.links.new(vol_scatter.outputs['Volume'], wo.inputs['Volume'])

# ── 4c. REALISTIC LIGHTING ──
print("── Photorealistic lighting ──")

# Key light (sun) — warm golden hour
bpy.ops.object.light_add(type='SUN', location=(0, 0, 10))
sun = bpy.context.active_object
sun.name = "KeySun"
sun.data.energy = 5.0
sun.data.color = (1.0, 0.9, 0.75)  # Warm golden
sun.data.angle = math.radians(1.0)  # Soft sun edges
sun.rotation_euler = (math.radians(65), math.radians(10), math.radians(50))

# Fill light — cool blue from opposite side
bpy.ops.object.light_add(type='AREA', location=(-6, -4, 4))
fill = bpy.context.active_object
fill.name = "FillLight"
fill.data.energy = 150
fill.data.color = (0.6, 0.7, 1.0)  # Cool blue
fill.data.size = 8
fill.rotation_euler = (math.radians(-30), math.radians(20), 0)

# Rim/backlight — warm highlight from behind
bpy.ops.object.light_add(type='AREA', location=(2, 6, 5))
rim = bpy.context.active_object
rim.name = "RimLight"
rim.data.energy = 300
rim.data.color = (1.0, 0.85, 0.7)
rim.data.size = 4
rim.rotation_euler = (math.radians(-50), 0, math.radians(-10))

# Bounce light — subtle warm from ground
bpy.ops.object.light_add(type='AREA', location=(0, 0, 0.3))
bounce = bpy.context.active_object
bounce.name = "BounceLight"
bounce.data.energy = 30
bounce.data.color = (0.4, 0.5, 0.2)  # Green bounce from grass
bounce.data.size = 10
bounce.rotation_euler = (math.radians(90), 0, 0)  # Pointing up

# ═══ 5. DUPLICATE TREES ═══
print("── Forest ──")
tree_root = imported.get('tree')
if tree_root:
    positions = [
        (-8, 10, 0), (-3, 14, 0), (1, 16, 0), (5, 12, 0), (9, 10, 0),
        (-6, 18, 0), (-1, 20, 0), (3, 22, 0), (7, 18, 0),
        (-10, 15, 0), (11, 14, 0), (0, 25, 0),
        (-4, 6, 0), (6, 7, 0),
    ]
    for pos in positions:
        bpy.ops.object.select_all(action='DESELECT')
        tree_root.select_set(True)
        for ch in tree_root.children_recursive:
            ch.select_set(True)
        bpy.context.view_layer.objects.active = tree_root
        bpy.ops.object.duplicate()
        nt = bpy.context.active_object
        nt.location = Vector(pos)
        s = random.uniform(0.5, 1.4)
        nt.scale = tree_root.scale * s
        nt.rotation_euler.z = random.uniform(0, math.tau)

# ═══ 6. ROCKS ═══
rock_root = imported.get('rocks')
if rock_root:
    for pos in [(1.5,0.5,0),(-1.5,1,0),(3,3,0),(-3,2.5,0),(0,3.5,0),(-2,4,0)]:
        bpy.ops.object.select_all(action='DESELECT')
        rock_root.select_set(True)
        for ch in rock_root.children_recursive:
            ch.select_set(True)
        bpy.context.view_layer.objects.active = rock_root
        bpy.ops.object.duplicate()
        nr = bpy.context.active_object
        nr.location = Vector(pos)
        s = random.uniform(0.3, 1.0)
        nr.scale = rock_root.scale * s
        nr.rotation_euler.z = random.uniform(0, math.tau)

# ═══ 7. CAMERA — PORTRAIT HERO FRAMING ═══
print("── Camera ──")
bpy.ops.object.camera_add(location=(1.5, -10, 2.0))
cam = bpy.context.active_object
cam.name = "PhotoCamera"
cam.data.lens = 85  # Portrait telephoto — compression for realism
scene.camera = cam

target = Vector((0, 0, 1.2))
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# Realistic DOF
cam.data.dof.use_dof = True
cam.data.dof.focus_distance = 10.5
cam.data.dof.aperture_fstop = 2.0  # Shallow — cinematic bokeh

# Film settings for photorealism
cam.data.sensor_width = 36  # Full-frame sensor

# ═══ 8. CYCLES RENDER SETTINGS ═══
print("── Cycles setup ──")
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU'
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'

prefs = bpy.context.preferences.addons.get('cycles')
if prefs:
    prefs.preferences.compute_device_type = 'CUDA'
    prefs.preferences.get_devices()
    for d in prefs.preferences.devices:
        d.use = True

# Color management — photorealistic
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.2
scene.view_settings.gamma = 1.0

# Resolution
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100

# Film
scene.render.film_transparent = False
scene.cycles.film_exposure = 1.0

scene.frame_set(1)

# ═══ 9. VERIFY RENDER (16 samples — fast check) ═══
print("\n═══ VERIFY RENDER (16 samples) ═══")
scene.cycles.samples = 16
verify_path = 'C:/Users/Aiden/Desktop/godmode-evidence/photorealistic_cel_VERIFY.png'
scene.render.filepath = verify_path
bpy.ops.render.render(write_still=True)
print(f"VERIFY: {verify_path}")

# Save blend
blend_path = 'C:/Users/Aiden/Desktop/godmode-evidence/photorealistic_cel.blend'
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f"Blend: {blend_path}")
print("═══ CHECK VERIFY — if good, run full render ═══")
