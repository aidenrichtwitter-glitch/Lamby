import bpy, math, random, os
from mathutils import Vector

OUT = r"C:\Users\Aiden\Desktop"

print("=== STAGE 1: CLEAR + IMPORT HERO ===")
bpy.ops.wm.read_homefile(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.image_settings.file_format = 'PNG'

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
nt = world.node_tree
nt.nodes.clear()
sky = nt.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'NISHITA'
sky.sun_elevation = math.radians(8)
sky.sun_rotation = math.radians(200)
sky.altitude = 100.0
bg = nt.nodes.new('ShaderNodeBackground')
bg.inputs['Strength'].default_value = 2.0
out = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
print("  Sky: Nishita golden hour")

hero_path = os.path.join(r"C:\Users\Aiden\Downloads", "85187f9f246f4702b7c137dcc6c0fc12.glb")
if os.path.exists(hero_path):
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=hero_path)
    after = set(bpy.data.objects.keys())
    new_objs = after - before
    print(f"  Hero imported: {len(new_objs)} new objects")

    hero_meshes = []
    for name in new_objs:
        o = bpy.data.objects.get(name)
        if o and o.type == 'MESH' and o.data is not None:
            hero_meshes.append(o)

    if hero_meshes:
        all_min = Vector((999,999,999))
        all_max = Vector((-999,-999,-999))
        for o in hero_meshes:
            for c in o.bound_box:
                wc = o.matrix_world @ Vector(c)
                all_min = Vector((min(all_min[i], wc[i]) for i in range(3)))
                all_max = Vector((max(all_max[i], wc[i]) for i in range(3)))
        
        hero_center = (all_min + all_max) / 2
        hero_size = all_max - all_min
        hero_height = hero_size.z
        print(f"  Hero bounds: center={[round(x,2) for x in hero_center]}, size={[round(x,2) for x in hero_size]}, height={hero_height:.2f}")

        target_height = 1.7
        if hero_height > 0.01:
            scale_factor = target_height / hero_height
        else:
            scale_factor = 1.0

        roots = [bpy.data.objects[n] for n in new_objs if bpy.data.objects[n].parent is None]
        for root in roots:
            root.scale *= scale_factor
            bpy.context.view_layer.update()

        all_min2 = Vector((999,999,999))
        all_max2 = Vector((-999,-999,-999))
        for o in hero_meshes:
            if o.data is None:
                continue
            for c in o.bound_box:
                wc = o.matrix_world @ Vector(c)
                all_min2 = Vector((min(all_min2[i], wc[i]) for i in range(3)))
                all_max2 = Vector((max(all_max2[i], wc[i]) for i in range(3)))

        new_center = (all_min2 + all_max2) / 2
        new_size = all_max2 - all_min2
        offset = Vector((0, 0, 0)) - Vector((new_center.x, new_center.y, all_min2.z))
        for root in roots:
            root.location += offset
        bpy.context.view_layer.update()
        print(f"  Hero scaled to {target_height}m and centered at origin, feet on ground")
        print(f"  Post-scale size: {[round(x,2) for x in new_size]}")
else:
    print(f"  HERO FILE NOT FOUND: {hero_path}")
    hero_meshes = []

print("\n=== STAGE 2: AERIAL CAPTURE ===")
bpy.ops.object.camera_add(location=(0, 0, 15))
cam = bpy.context.active_object
cam.name = "AerialCam"
cam.rotation_euler = (0, 0, 0)
cam.data.lens = 35
scene.camera = cam
scene.render.filepath = os.path.join(OUT, "aerial_capture.png")
bpy.ops.render.render(write_still=True)
print("  Aerial capture saved: aerial_capture.png")

print("\n=== STAGE 3: HERO CLOSEUP ===")
cam.location = (0.0, -4.0, 1.2)
cam.rotation_euler = (math.radians(82), 0, 0)
cam.data.lens = 50
scene.render.filepath = os.path.join(OUT, "hero_closeup.png")
bpy.ops.render.render(write_still=True)
print("  Hero closeup saved: hero_closeup.png")

print("\n=== STAGE 4: BUILD SCENE AROUND HERO ===")

bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 5, -0.01))
ground = bpy.context.active_object
ground.name = "Ground"
mat_g = bpy.data.materials.new("Ground_mat")
mat_g.use_nodes = True
bsdf_g = mat_g.node_tree.nodes["Principled BSDF"]
bsdf_g.inputs["Base Color"].default_value = (0.15, 0.22, 0.10, 1)
bsdf_g.inputs["Roughness"].default_value = 0.95
ground.data.materials.append(mat_g)

bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 3.0, 0.005))
path = bpy.context.active_object
path.name = "StonePath"
path.scale = (1.0, 6.0, 1.0)
mat_p = bpy.data.materials.new("Path_mat")
mat_p.use_nodes = True
bsdf_p = mat_p.node_tree.nodes["Principled BSDF"]
bsdf_p.inputs["Base Color"].default_value = (0.35, 0.32, 0.28, 1)
bsdf_p.inputs["Roughness"].default_value = 0.92
path.data.materials.append(mat_p)

print("  Ground + path placed")

def make_torii(y=6.5):
    mat_t = bpy.data.materials.new("Torii_red")
    mat_t.use_nodes = True
    bsdf = mat_t.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.7, 0.08, 0.05, 1)
    bsdf.inputs["Roughness"].default_value = 0.8

    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=4.5, location=(-1.6, y, 2.25))
    lp = bpy.context.active_object
    lp.name = "Torii_PillarL"
    lp.data.materials.append(mat_t)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=4.5, location=(1.6, y, 2.25))
    rp = bpy.context.active_object
    rp.name = "Torii_PillarR"
    rp.data.materials.append(mat_t)

    bpy.ops.mesh.primitive_cube_add(location=(0, y, 4.6))
    top = bpy.context.active_object
    top.name = "Torii_TopBeam"
    top.scale = (2.2, 0.12, 0.15)
    top.data.materials.append(mat_t)

    bpy.ops.mesh.primitive_cube_add(location=(0, y, 3.8))
    mid = bpy.context.active_object
    mid.name = "Torii_MidBeam"
    mid.scale = (1.5, 0.08, 0.08)
    mid.data.materials.append(mat_t)
    print(f"  Torii gate at y={y}")

make_torii(6.5)

sakura_path = os.path.join(r"C:\Users\Aiden\Downloads", "147ae7d0d332456a99ec6195e9b0cd4f.glb")
sakura_positions = [(-4.5, 5.0), (4.5, 5.0)]
if os.path.exists(sakura_path):
    for i, (sx, sy) in enumerate(sakura_positions):
        before_s = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=sakura_path)
        after_s = set(bpy.data.objects.keys())
        new_s = after_s - before_s
        
        s_meshes = []
        for name in new_s:
            o = bpy.data.objects.get(name)
            if o and o.type == 'MESH' and o.data is not None:
                s_meshes.append(o)
        
        if s_meshes:
            smin = Vector((999,999,999))
            smax = Vector((-999,-999,-999))
            for o in s_meshes:
                for c in o.bound_box:
                    wc = o.matrix_world @ Vector(c)
                    smin = Vector((min(smin[i2], wc[i2]) for i2 in range(3)))
                    smax = Vector((max(smax[i2], wc[i2]) for i2 in range(3)))
            
            s_height = smax.z - smin.z
            target_h = 4.5
            sf = target_h / max(s_height, 0.01)
            
            s_roots = [bpy.data.objects[n] for n in new_s if bpy.data.objects[n].parent is None]
            for r in s_roots:
                r.scale *= sf
            bpy.context.view_layer.update()
            
            smin2 = Vector((999,999,999))
            for o in s_meshes:
                if o.data is None:
                    continue
                for c in o.bound_box:
                    wc = o.matrix_world @ Vector(c)
                    smin2 = Vector((min(smin2[i2], wc[i2]) for i2 in range(3)))
            
            offset_s = Vector((sx, sy, 0)) - Vector((0, 0, smin2.z))
            for r in s_roots:
                r.location += offset_s
            bpy.context.view_layer.update()
            print(f"  Sakura tree {i} at ({sx}, {sy}), height={target_h}m")
else:
    print("  Sakura GLB not found, skipping")

def make_lantern(name, x, y):
    mat_stone = bpy.data.materials.new(name+"_stone")
    mat_stone.use_nodes = True
    bsdf = mat_stone.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.45, 0.43, 0.40, 1)
    bsdf.inputs["Roughness"].default_value = 0.95

    bpy.ops.mesh.primitive_cube_add(location=(x, y, 0.4))
    base = bpy.context.active_object
    base.name = name+"_base"
    base.scale = (0.18, 0.18, 0.4)
    base.data.materials.append(mat_stone)

    mat_glow = bpy.data.materials.new(name+"_glow")
    mat_glow.use_nodes = True
    bsdf = mat_glow.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (1.0, 0.85, 0.5, 1)
    bsdf.inputs["Emission Color"].default_value = (1.0, 0.75, 0.35, 1)
    bsdf.inputs["Emission Strength"].default_value = 10.0

    bpy.ops.mesh.primitive_cube_add(location=(x, y, 1.0))
    lamp = bpy.context.active_object
    lamp.name = name+"_lamp"
    lamp.scale = (0.14, 0.14, 0.22)
    lamp.data.materials.append(mat_glow)

    bpy.ops.mesh.primitive_cone_add(radius1=0.17, radius2=0.02, depth=0.15, location=(x, y, 1.3))
    cap = bpy.context.active_object
    cap.name = name+"_cap"
    cap.data.materials.append(mat_stone)

    light = bpy.data.lights.new(name+"_light", 'POINT')
    light.energy = 80
    light.color = (1.0, 0.72, 0.35)
    lo = bpy.data.objects.new(name+"_light", light)
    bpy.context.collection.objects.link(lo)
    lo.location = (x, y, 1.0)

make_lantern("LanternL", -1.3, 3.0)
make_lantern("LanternR", 1.3, 3.0)
print("  Lanterns placed")

for i in range(3):
    bpy.ops.mesh.primitive_cube_add(location=(0, 4.0 + i*1.2, i*0.04))
    step = bpy.context.active_object
    step.name = f"Step_{i}"
    step.scale = (1.4 + i*0.15, 0.25, 0.06)
    mat_step = bpy.data.materials.new(f"Step_{i}_mat")
    mat_step.use_nodes = True
    bsdf = mat_step.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.42, 0.40, 0.36, 1)
    bsdf.inputs["Roughness"].default_value = 0.9
    step.data.materials.append(mat_step)
print("  Steps placed")

random.seed(42)
mat_petal = bpy.data.materials.new("Petal_mat")
mat_petal.use_nodes = True
bsdf_pet = mat_petal.node_tree.nodes["Principled BSDF"]
bsdf_pet.inputs["Base Color"].default_value = (1.0, 0.75, 0.82, 1)
bsdf_pet.inputs["Alpha"].default_value = 0.85
mat_petal.blend_method = 'BLEND' if hasattr(mat_petal, 'blend_method') else None

for i in range(35):
    px = random.uniform(-5, 5)
    py = random.uniform(-2, 9)
    pz = random.uniform(0.3, 4.5)
    bpy.ops.mesh.primitive_plane_add(size=0.08, location=(px, py, pz))
    pet = bpy.context.active_object
    pet.name = f"Petal_{i}"
    pet.rotation_euler = (random.uniform(0, 6.28), random.uniform(0, 6.28), random.uniform(0, 6.28))
    pet.data.materials.append(mat_petal)

orb_colors = [(0.3, 1.0, 0.9), (1.0, 0.8, 0.3), (0.7, 0.4, 1.0)]
for i in range(8):
    ox = random.uniform(-3, 3)
    oy = random.uniform(0, 7)
    oz = random.uniform(0.5, 2.5)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04, location=(ox, oy, oz))
    orb = bpy.context.active_object
    orb.name = f"Orb_{i}"
    mat_orb = bpy.data.materials.new(f"Orb_{i}_mat")
    mat_orb.use_nodes = True
    bsdf = mat_orb.node_tree.nodes["Principled BSDF"]
    c = orb_colors[i % 3]
    bsdf.inputs["Base Color"].default_value = (*c, 1)
    bsdf.inputs["Emission Color"].default_value = (*c, 1)
    bsdf.inputs["Emission Strength"].default_value = 20.0
    orb.data.materials.append(mat_orb)

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.8, location=(4, 9, 8))
moon = bpy.context.active_object
moon.name = "Moon"
mat_moon = bpy.data.materials.new("Moon_mat")
mat_moon.use_nodes = True
bsdf = mat_moon.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (1.0, 0.97, 0.88, 1)
bsdf.inputs["Emission Color"].default_value = (1.0, 0.95, 0.85, 1)
bsdf.inputs["Emission Strength"].default_value = 12.0
moon.data.materials.append(mat_moon)
print("  Petals + orbs + moon placed")

print("\n=== STAGE 5: LIGHTING ===")
sun = bpy.data.lights.new("KeySun", 'SUN')
sun.energy = 3.5
sun.color = (1, 0.88, 0.68)
sun_obj = bpy.data.objects.new("KeySun", sun)
bpy.context.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(50), math.radians(-15), math.radians(-50))

fill = bpy.data.lights.new("Fill", 'AREA')
fill.energy = 180
fill.color = (0.65, 0.70, 1.0)
fill.size = 5
fill_obj = bpy.data.objects.new("Fill", fill)
bpy.context.collection.objects.link(fill_obj)
fill_obj.location = (4, -3, 3.5)
fill_obj.rotation_euler = (math.radians(60), math.radians(20), 0)

rim = bpy.data.lights.new("Rim", 'AREA')
rim.energy = 350
rim.color = (1, 0.92, 1.0)
rim.size = 2
rim_obj = bpy.data.objects.new("Rim", rim)
bpy.context.collection.objects.link(rim_obj)
rim_obj.location = (0, 7, 5)
rim_obj.rotation_euler = (math.radians(110), 0, math.radians(180))

moon_light = bpy.data.lights.new("MoonLight", 'AREA')
moon_light.energy = 60
moon_light.color = (0.88, 0.9, 1.0)
moon_light.size = 3
ml_obj = bpy.data.objects.new("MoonLight", moon_light)
bpy.context.collection.objects.link(ml_obj)
ml_obj.location = (4, 9, 8)
print("  3-point + moon lighting set")

print("\n=== STAGE 6: CAMERA FRAMING HERO ===")
cam.name = "MainCam"
cam.location = (0.2, -3.8, 1.3)
cam.rotation_euler = (math.radians(80), 0, math.radians(1))
cam.data.lens = 45
scene.camera = cam
print(f"  Camera: pos={[round(x,1) for x in cam.location]}, lens=45mm")
print("  Camera is INSIDE scene, close to hero, looking up slightly")

scene.render.use_freestyle = True
scene.render.line_thickness = 1.8
for vl in scene.view_layers:
    vl.freestyle_settings.linesets[0].select_silhouette = True
    vl.freestyle_settings.linesets[0].select_border = True
    vl.freestyle_settings.linesets[0].select_crease = True
print("  Freestyle outlines enabled")

print("\n=== STAGE 7: SAVE .BLEND ===")
blend_path = os.path.join(OUT, "anime_shrine_scene.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f"  Saved: {blend_path}")

print("\n=== STAGE 8: FINAL RENDER ===")
scene.cycles.samples = 96
scene.render.filepath = os.path.join(OUT, "anime_shrine_final.png")
bpy.ops.render.render(write_still=True)
print("  Final render saved!")

print("\nREBUILD_SCENE_OK")
