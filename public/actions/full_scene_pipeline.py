import bpy, json, os, math, random, traceback, subprocess
from mathutils import Vector

OUT = r"C:\Users\Aiden\Desktop"
BLEND = os.path.join(OUT, "rooftop_scene.blend")
HERO_GLB = os.path.join(r"C:\Users\Aiden\Downloads", "71f86ae0a1c148a69fe3327397fff5ee.glb")
SCENE_NAME = "Anime Rooftop at Dusk"

LOG = []

def log(step, msg):
    LOG.append({"step": step, "msg": msg})
    print(f"[{step}] {msg}")

try:
    log("STEP_01_GPU", "=== INIT GPU CUDA ===")
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "CUDA"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = (d.type != "CPU")
    gpus = [d.name for d in prefs.devices if d.use]
    log("STEP_01_GPU", f"GPUs: {gpus}")

    log("STEP_02_CLEAR", "=== CLEAR SCENE ===")
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in list(bpy.data.meshes): bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials): bpy.data.materials.remove(block)
    for block in list(bpy.data.lights): bpy.data.lights.remove(block)
    for block in list(bpy.data.cameras): bpy.data.cameras.remove(block)
    for block in list(bpy.data.images): bpy.data.images.remove(block)
    for block in list(bpy.data.textures): bpy.data.textures.remove(block)
    for block in list(bpy.data.armatures): bpy.data.armatures.remove(block)
    log("STEP_02_CLEAR", "Scene cleared")

    scene = bpy.context.scene

    log("STEP_03_EEVEE", "=== SET EEVEE BUILD MODE ===")
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 320
    scene.render.resolution_y = 180
    scene.eevee.taa_render_samples = 8
    log("STEP_03_EEVEE", "EEVEE 320x180 8spp")

    def new_mat(name, color, roughness=0.7):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Roughness'].default_value = roughness
        return mat

    def new_emission_mat(name, color, strength=2.0):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        emit = nt.nodes.new('ShaderNodeEmission')
        emit.inputs['Color'].default_value = (*color, 1.0)
        emit.inputs['Strength'].default_value = strength
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
        return mat

    def new_metal_mat(name, color, metallic=0.9, roughness=0.3):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Roughness'].default_value = roughness
        return mat

    def assign_mat(obj, mat):
        obj.data.materials.clear()
        obj.data.materials.append(mat)

    log("STEP_04_SKY", "=== SET SKY — DUSK ===")
    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(5)
    sky.sun_rotation = math.radians(200)
    sky.altitude = 0.0
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.8
    out_w = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out_w.inputs['Surface'])
    log("STEP_04_SKY", "Nishita dusk sky, elevation=5deg")

    log("STEP_05_IMPORT", "=== IMPORT HERO GLB ===")
    if os.path.exists(HERO_GLB):
        before = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=HERO_GLB)
        after = set(bpy.data.objects.keys())
        new_names = after - before
        log("STEP_05_IMPORT", f"Imported {len(new_names)} objects from {os.path.basename(HERO_GLB)}")

        log("STEP_06_LINK_COLLECTIONS", "=== LINK COLLECTIONS ===")
        linked = 0
        for c in bpy.data.collections:
            if c.name not in [ch.name for ch in scene.collection.children]:
                scene.collection.children.link(c)
                linked += 1
        log("STEP_06_LINK_COLLECTIONS", f"Linked {linked} collections")

        log("STEP_07_REMOVE_BLOCKERS", "=== REMOVE BLOCKER MESHES ===")
        removed = []
        for name in list(new_names):
            o = bpy.data.objects.get(name)
            if o and o.type == 'MESH' and o.data is not None:
                bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
                sx = max(v[0] for v in bb) - min(v[0] for v in bb)
                sy = max(v[1] for v in bb) - min(v[1] for v in bb)
                if sx > 3.0 or sy > 3.0:
                    removed.append(f"{name} ({sx:.1f}x{sy:.1f})")
                    bpy.data.objects.remove(o, do_unlink=True)
                    new_names.discard(name)
        log("STEP_07_REMOVE_BLOCKERS", f"Removed {len(removed)}: {removed}")

        log("STEP_08_FIX_MATERIALS", "=== FIX GLB UNLIT MATERIALS ===")
        fixed = []
        for mat in bpy.data.materials:
            if not mat.node_tree:
                continue
            has_emission = any(n.type == 'EMISSION' for n in mat.node_tree.nodes)
            has_lightpath = any(n.type == 'LIGHT_PATH' for n in mat.node_tree.nodes)
            if has_emission and has_lightpath:
                nt_m = mat.node_tree
                img_node = next((n for n in nt_m.nodes if n.type == 'TEX_IMAGE' and n.image), None)
                saved_img = img_node.image if img_node else None
                nt_m.nodes.clear()
                bsdf = nt_m.nodes.new('ShaderNodeBsdfPrincipled')
                out_m = nt_m.nodes.new('ShaderNodeOutputMaterial')
                nt_m.links.new(bsdf.outputs['BSDF'], out_m.inputs['Surface'])
                if saved_img:
                    tex = nt_m.nodes.new('ShaderNodeTexImage')
                    tex.image = saved_img
                    nt_m.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
                else:
                    mn = mat.name.lower()
                    if 'body' in mn or 'skin' in mn:
                        bsdf.inputs['Base Color'].default_value = (0.85, 0.72, 0.62, 1.0)
                    elif 'hair' in mn:
                        bsdf.inputs['Base Color'].default_value = (0.15, 0.12, 0.35, 1.0)
                    elif 'cloth' in mn or 'shirt' in mn or 'pants' in mn:
                        bsdf.inputs['Base Color'].default_value = (0.20, 0.18, 0.45, 1.0)
                    else:
                        bsdf.inputs['Base Color'].default_value = (0.70, 0.65, 0.75, 1.0)
                bsdf.inputs['Roughness'].default_value = 0.65
                fixed.append(mat.name)
        log("STEP_08_FIX_MATERIALS", f"Fixed {len(fixed)} materials: {fixed}")

        log("STEP_09_SCALE_HERO", "=== SCALE HERO TO 1.7m ===")
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
            sf = 1.7 / max(h, 0.01)
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
            off = Vector((0, 0, -amin2.z))
            for r in roots:
                r.location += off
            bpy.context.view_layer.update()
            log("STEP_09_SCALE_HERO", f"Scaled {len(hero_meshes)} meshes, factor={sf:.2f}, feet at z=0")
        else:
            log("STEP_09_SCALE_HERO", "No hero meshes found")
    else:
        log("STEP_05_IMPORT", f"Hero GLB not found: {HERO_GLB}")

    log("STEP_10_GROUND", "=== BUILD ROOFTOP GROUND ===")
    roof_mat = new_mat("RoofMat", (0.35, 0.33, 0.30), 0.85)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 3, -0.15))
    roof = bpy.context.active_object
    roof.name = "Rooftop"
    roof.scale = (6, 8, 0.15)
    assign_mat(roof, roof_mat)

    edge_mat = new_metal_mat("EdgeMat", (0.45, 0.42, 0.40), 0.6, 0.5)
    for y_pos in [-1, 7]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y_pos, 0.1))
        wall = bpy.context.active_object
        wall.name = f"RoofWall_{'front' if y_pos < 0 else 'back'}"
        wall.scale = (6, 0.15, 0.4)
        assign_mat(wall, edge_mat)

    for x_pos in [-3, 3]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x_pos, 3, 0.1))
        wall = bpy.context.active_object
        wall.name = f"RoofWall_{'left' if x_pos < 0 else 'right'}"
        wall.scale = (0.15, 8, 0.4)
        assign_mat(wall, edge_mat)
    log("STEP_10_GROUND", "Rooftop platform + walls")

    log("STEP_11_PROPS", "=== BUILD SCENE PROPS ===")
    
    ac_mat = new_metal_mat("ACMat", (0.65, 0.63, 0.60), 0.7, 0.4)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-2, 5.5, 0.5))
    ac = bpy.context.active_object
    ac.name = "AC_Unit"
    ac.scale = (0.8, 0.5, 0.5)
    assign_mat(ac, ac_mat)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=1.5, location=(-2, 5.5, 1.5))
    pipe = bpy.context.active_object
    pipe.name = "AC_Pipe"
    assign_mat(pipe, ac_mat)

    antenna_mat = new_metal_mat("AntennaMat", (0.50, 0.48, 0.45), 0.8, 0.5)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=3.0, location=(2.5, 6, 1.5))
    antenna = bpy.context.active_object
    antenna.name = "Antenna"
    assign_mat(antenna, antenna_mat)

    bpy.ops.mesh.primitive_cube_add(size=0.3, location=(2.5, 6, 3.1))
    antenna_top = bpy.context.active_object
    antenna_top.name = "AntennaTop"
    antenna_top.scale = (1, 0.1, 0.5)
    assign_mat(antenna_top, antenna_mat)

    crate_mat = new_mat("CrateMat", (0.45, 0.35, 0.20), 0.8)
    for i, (cx, cy) in enumerate([(-1.5, 5), (-1.8, 4.5), (-1.2, 4.8)]):
        bpy.ops.mesh.primitive_cube_add(size=0.5 + i * 0.1, location=(cx, cy, 0.25 + i * 0.15))
        crate = bpy.context.active_object
        crate.name = f"Crate_{i}"
        crate.rotation_euler = (0, 0, math.radians(i * 15 - 10))
        assign_mat(crate, crate_mat)

    puddle_mat = new_mat("PuddleMat", (0.15, 0.18, 0.25), 0.05)
    bpy.ops.mesh.primitive_circle_add(vertices=32, radius=0.8, fill_type='NGON', location=(1, 2, 0.005))
    puddle = bpy.context.active_object
    puddle.name = "Puddle"
    assign_mat(puddle, puddle_mat)

    railing_mat = new_metal_mat("RailingMat", (0.40, 0.38, 0.35), 0.8, 0.4)
    for i in range(6):
        x = -2.5 + i * 1.0
        bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=1.0, location=(x, -0.85, 0.5))
        post = bpy.context.active_object
        post.name = f"RailingPost_{i}"
        assign_mat(post, railing_mat)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=5.5, location=(0, -0.85, 0.95))
    rail = bpy.context.active_object
    rail.name = "RailingBar"
    rail.rotation_euler = (0, math.radians(90), 0)
    assign_mat(rail, railing_mat)

    log("STEP_11_PROPS", "AC unit, antenna, crates, puddle, railing")

    log("STEP_12_CITY_BG", "=== BUILD CITY BACKGROUND ===")
    building_colors = [
        (0.25, 0.25, 0.30), (0.30, 0.28, 0.32), (0.22, 0.22, 0.28),
        (0.28, 0.26, 0.30), (0.20, 0.20, 0.25), (0.32, 0.30, 0.35)
    ]
    random.seed(42)
    for i in range(12):
        bx = random.uniform(-15, 15)
        by = random.uniform(12, 30)
        bw = random.uniform(1.5, 4.0)
        bd = random.uniform(1.5, 4.0)
        bh = random.uniform(3, 15)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(bx, by, bh / 2 - 2))
        bldg = bpy.context.active_object
        bldg.name = f"Building_{i}"
        bldg.scale = (bw, bd, bh)
        assign_mat(bldg, new_mat(f"BldgMat_{i}", random.choice(building_colors), 0.8))

        for j in range(int(bh)):
            for k in range(int(bw)):
                if random.random() > 0.5:
                    wx = bx - bw / 2 + k * 1.0 + 0.5
                    wz = j * 1.0 + 0.5
                    bpy.ops.mesh.primitive_plane_add(size=0.3, location=(wx, by - bd / 2 - 0.01, wz))
                    win = bpy.context.active_object
                    win.name = f"Window_{i}_{j}_{k}"
                    win.rotation_euler = (math.radians(90), 0, 0)
                    warmth = random.uniform(0.6, 1.0)
                    assign_mat(win, new_emission_mat(f"WinGlow_{i}_{j}_{k}", (1.0, warmth, warmth * 0.6), random.uniform(1.0, 3.0)))
    log("STEP_12_CITY_BG", "12 buildings + lit windows")

    log("STEP_13_LIGHTING", "=== LIGHTING ===")
    sun_data = bpy.data.lights.new("DuskSun", 'SUN')
    sun_data.energy = 0.7
    sun_data.color = (1.0, 0.75, 0.45)
    sun_obj = bpy.data.objects.new("DuskSun", sun_data)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(80), math.radians(-20), math.radians(-40))

    fill_data = bpy.data.lights.new("FillArea", 'AREA')
    fill_data.energy = 0.5
    fill_data.color = (0.55, 0.60, 0.85)
    fill_data.size = 6
    fill_obj = bpy.data.objects.new("FillArea", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.location = (0, -4, 3)
    fill_obj.rotation_euler = (math.radians(55), 0, 0)

    rim_data = bpy.data.lights.new("RimArea", 'AREA')
    rim_data.energy = 0.6
    rim_data.color = (1.0, 0.80, 0.55)
    rim_data.size = 3
    rim_obj = bpy.data.objects.new("RimArea", rim_data)
    bpy.context.collection.objects.link(rim_obj)
    rim_obj.location = (0, 8, 4)
    rim_obj.rotation_euler = (math.radians(-40), 0, 0)

    front_data = bpy.data.lights.new("FrontFill", 'AREA')
    front_data.energy = 0.4
    front_data.size = 4
    front_data.color = (0.85, 0.80, 0.75)
    front_obj = bpy.data.objects.new("FrontFill", front_data)
    bpy.context.collection.objects.link(front_obj)
    front_obj.location = (2, -3, 2)
    front_obj.rotation_euler = (math.radians(50), math.radians(-15), 0)

    front2_data = bpy.data.lights.new("FrontFill2", 'AREA')
    front2_data.energy = 0.3
    front2_data.size = 3
    front2_data.color = (0.80, 0.82, 0.90)
    front2_obj = bpy.data.objects.new("FrontFill2", front2_data)
    bpy.context.collection.objects.link(front2_obj)
    front2_obj.location = (-2, -2, 1.5)
    front2_obj.rotation_euler = (math.radians(45), math.radians(10), 0)
    log("STEP_13_LIGHTING", "DuskSun 0.7 + FillArea 0.5 + Rim 0.6 + FrontFill 0.4 + FrontFill2 0.3")

    log("STEP_14_CAMERA", "=== CAMERA ===")
    cam_data = bpy.data.cameras.new("MainCam")
    cam_data.lens = 35
    cam_obj = bpy.data.objects.new("MainCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = (0.5, -3.5, 1.0)
    cam_obj.rotation_euler = (math.radians(82), 0, math.radians(3))
    scene.camera = cam_obj
    log("STEP_14_CAMERA", f"MainCam at {list(cam_obj.location)} lens={cam_data.lens}mm")

    log("STEP_15_INVENTORY", "=== SCENE INVENTORY ===")
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    lights = [o for o in bpy.data.objects if o.type == 'LIGHT']
    log("STEP_15_INVENTORY", f"Meshes: {len(meshes)}, Lights: {len(lights)}")

    log("STEP_16_PREVIEW", "=== EEVEE PREVIEW RENDER ===")
    scene.render.filepath = os.path.join(OUT, "rooftop_preview.jpg")
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 60
    bpy.ops.render.render(write_still=True)
    log("STEP_16_PREVIEW", f"Preview: {scene.render.filepath}")

    log("STEP_17_SAVE_BLEND", "=== SAVE .BLEND ===")
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    log("STEP_17_SAVE_BLEND", f"Saved: {BLEND}")

    log("STEP_18_CYCLES", "=== SWITCH TO CYCLES ===")
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 15
    log("STEP_18_CYCLES", "Cycles 128spp OIDN 1920x1080")

    log("STEP_19_FREESTYLE", "=== FREESTYLE ===")
    scene.render.use_freestyle = True
    scene.render.line_thickness = 1.2
    for vl in scene.view_layers:
        vl.use_freestyle = True
        fs = vl.freestyle_settings
        while len(fs.linesets) > 0:
            fs.linesets.remove(fs.linesets[0])
        ls = fs.linesets.new("AnimeOutlines")
        ls.select_silhouette = True
        ls.select_border = True
        ls.select_crease = True
        ls.select_edge_mark = False
        ls.select_external_contour = True
        ls.select_suggestive_contour = False
        ls.select_material_boundary = True
        ls.linestyle.thickness = 1.5
        ls.linestyle.color = (0.08, 0.05, 0.15)
    log("STEP_19_FREESTYLE", "AnimeOutlines dark purple single lineset")

    log("STEP_20_FILMIC", "=== FILMIC ===")
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'
    log("STEP_20_FILMIC", "Filmic Medium High Contrast")

    log("STEP_21_RENDER", "=== FINAL RENDER ===")
    scene.render.filepath = os.path.join(OUT, "rooftop_final.png")
    bpy.ops.render.render(write_still=True)
    log("STEP_21_RENDER", f"Rendered: {scene.render.filepath}")

    log("STEP_22_SAVE", "=== SAVE FINAL .BLEND ===")
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    log("STEP_22_SAVE", f"Saved: {BLEND}")

    log("STEP_23_JPEG", "=== TRANSFER JPEG ===")
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 55
    jpg_path = os.path.join(OUT, "rooftop_transfer.jpg")
    img = bpy.data.images.get('Render Result')
    if img:
        img.save_render(filepath=jpg_path, scene=scene)
    log("STEP_23_JPEG", f"JPEG: {jpg_path}")

    log("STEP_24_OPEN", "=== OPEN RENDER ===")
    subprocess.Popen(['cmd', '/c', 'start', '', os.path.join(OUT, "rooftop_final.png")], shell=False)
    log("STEP_24_OPEN", "Render opened in viewer")

    log_path = os.path.join(OUT, "rooftop_build_log.json")
    with open(log_path, 'w') as f:
        json.dump({"scene": SCENE_NAME, "steps": LOG, "total_steps": len(LOG)}, f, indent=2)

    print("\n" + "=" * 60)
    print(f"PIPELINE COMPLETE: {SCENE_NAME}")
    print(f"Steps: {len(LOG)}")
    print(f"Meshes: {len([o for o in bpy.data.objects if o.type=='MESH'])}")
    print(f"Lights: {len([o for o in bpy.data.objects if o.type=='LIGHT'])}")
    print(f"Render: {os.path.join(OUT, 'rooftop_final.png')}")
    print("=" * 60)

except Exception as e:
    log("ERROR", f"{e}")
    print(f"\nERROR: {e}")
    traceback.print_exc()
    log_path = os.path.join(OUT, "rooftop_build_log.json")
    with open(log_path, 'w') as f:
        json.dump({"scene": SCENE_NAME, "steps": LOG, "error": str(e)}, f, indent=2)
