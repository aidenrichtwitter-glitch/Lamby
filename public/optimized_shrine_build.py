import bpy, math, random, traceback
from mathutils import Vector

OUT = r"C:\Users\Aiden\Desktop"
BLEND = OUT + r"\anime_shrine_v2.blend"
HERO_PATH = OUT + r"\Lamby\sketchfab_downloads\spirit_blossom_kindred\scene.gltf"

try:
    print("=" * 60)
    print("OPTIMIZED ANIME SHRINE — PHASE 1 (EEVEE BUILD)")
    print("Uses ONLY proven working steps")
    print("=" * 60)

    print("\n=== GPU CUDA ===")
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "CUDA"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = (d.type != "CPU")
    print(f"  GPU: {[d.name for d in prefs.devices if d.use]}")

    print("\n=== CLEAR SCENE (preserve GPU prefs) ===")
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in list(bpy.data.meshes): bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials): bpy.data.materials.remove(block)
    for block in list(bpy.data.lights): bpy.data.lights.remove(block)
    for block in list(bpy.data.cameras): bpy.data.cameras.remove(block)
    for block in list(bpy.data.images): bpy.data.images.remove(block)
    for block in list(bpy.data.textures): bpy.data.textures.remove(block)

    scene = bpy.context.scene

    print("\n=== EEVEE MODE (building phase) ===")
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 320
    scene.render.resolution_y = 180
    scene.eevee.taa_render_samples = 8

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

    def assign_mat(obj, mat):
        obj.data.materials.clear()
        obj.data.materials.append(mat)

    print("\n=== NISHITA SKY ===")
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
    bg.inputs['Strength'].default_value = 0.8
    out_w = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out_w.inputs['Surface'])

    print("\n=== IMPORT HERO ===")
    import os
    if os.path.exists(HERO_PATH):
        before = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=HERO_PATH)
        after = set(bpy.data.objects.keys())
        new_names = after - before

        for c in bpy.data.collections:
            if c.name not in [ch.name for ch in scene.collection.children]:
                scene.collection.children.link(c)
                print(f"  Linked collection: {c.name}")

        for name in list(new_names):
            o = bpy.data.objects.get(name)
            if o and o.type == 'MESH' and o.data is not None:
                bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
                sz_x = max(v[0] for v in bb) - min(v[0] for v in bb)
                sz_y = max(v[1] for v in bb) - min(v[1] for v in bb)
                if sz_x > 3.0 or sz_y > 3.0:
                    print(f"  Removed blocker: {name} ({sz_x:.1f}x{sz_y:.1f})")
                    bpy.data.objects.remove(o, do_unlink=True)
                    new_names.discard(name)

        print("\n=== FIX GLB MATERIALS ===")
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
                    if 'body' in mn:
                        bsdf.inputs['Base Color'].default_value = (0.85, 0.72, 0.62, 1.0)
                    elif 'hair' in mn:
                        bsdf.inputs['Base Color'].default_value = (0.15, 0.12, 0.35, 1.0)
                    elif 'cloth' in mn:
                        bsdf.inputs['Base Color'].default_value = (0.20, 0.18, 0.45, 1.0)
                    elif 'bow' in mn:
                        bsdf.inputs['Base Color'].default_value = (0.55, 0.15, 0.20, 1.0)
                    else:
                        bsdf.inputs['Base Color'].default_value = (0.70, 0.65, 0.75, 1.0)
                bsdf.inputs['Roughness'].default_value = 0.65
                print(f"  Fixed: {mat.name}")

        print("\n=== SCALE HERO ===")
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
            print(f"  Scaled to 1.7m, feet at z=0")
    else:
        print(f"  HERO NOT FOUND at {HERO_PATH} — building scene without hero")

    print("\n=== GROUND ===")
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 5, -0.02))
    ground = bpy.context.active_object
    ground.name = "Ground"
    assign_mat(ground, new_mat("GroundMat", (0.35, 0.38, 0.22), 0.9))

    print("\n=== STONE PATH ===")
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 3, 0.005))
    path = bpy.context.active_object
    path.name = "StonePath"
    path.scale = (1.0, 6.0, 1)
    assign_mat(path, new_mat("PathMat", (0.72, 0.68, 0.58), 0.85))

    print("\n=== STEPS ===")
    step_mat = new_mat("StepMat", (0.75, 0.72, 0.65), 0.8)
    for i, y in enumerate([4.2, 5.4, 6.5]):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y, 0.15 * (i + 1)))
        s = bpy.context.active_object
        s.name = f"Step_{i}"
        s.scale = (1.5, 0.6, 0.15)
        assign_mat(s, step_mat)

    print("\n=== TORII GATE ===")
    torii_mat = new_mat("ToriiMat", (0.85, 0.45, 0.15), 0.6)
    for x_sign in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=4.5, location=(x_sign * 1.6, 6.5, 2.25))
        pillar = bpy.context.active_object
        pillar.name = f"ToriiPillar_{'L' if x_sign < 0 else 'R'}"
        assign_mat(pillar, torii_mat)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 6.5, 4.55))
    beam_top = bpy.context.active_object
    beam_top.name = "ToriiBeamTop"
    beam_top.scale = (2.2, 0.15, 0.12)
    assign_mat(beam_top, torii_mat)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 6.5, 3.75))
    beam_mid = bpy.context.active_object
    beam_mid.name = "ToriiBeamMid"
    beam_mid.scale = (1.8, 0.12, 0.08)
    assign_mat(beam_mid, torii_mat)

    print("\n=== LANTERNS ===")
    lantern_mat = new_mat("LanternMat", (0.85, 0.82, 0.78), 0.7)
    lamp_mat = new_emission_mat("LampGlow", (1.0, 0.85, 0.5), 3.0)
    for x_sign in [-1, 1]:
        x = x_sign * 1.2
        bpy.ops.mesh.primitive_cube_add(size=0.4, location=(x, 3.2, 0.2))
        base = bpy.context.active_object
        base.name = f"LanternBase_{'L' if x_sign < 0 else 'R'}"
        assign_mat(base, lantern_mat)

        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, location=(x, 3.2, 0.65))
        lamp = bpy.context.active_object
        lamp.name = f"LanternLamp_{'L' if x_sign < 0 else 'R'}"
        assign_mat(lamp, lamp_mat)

        bpy.ops.mesh.primitive_cone_add(radius1=0.25, radius2=0.0, depth=0.2, location=(x, 3.2, 0.9))
        cap = bpy.context.active_object
        cap.name = f"LanternCap_{'L' if x_sign < 0 else 'R'}"
        assign_mat(cap, lantern_mat)

        ldata = bpy.data.lights.new(f"LanternLight_{'L' if x_sign < 0 else 'R'}", 'POINT')
        ldata.energy = 0.8
        ldata.color = (1.0, 0.85, 0.5)
        lobj = bpy.data.objects.new(f"LanternLight_{'L' if x_sign < 0 else 'R'}", ldata)
        bpy.context.collection.objects.link(lobj)
        lobj.location = (x, 3.2, 0.65)

    print("\n=== SAKURA TREES ===")
    sakura_path = OUT + r"\Lamby\sketchfab_downloads\sakura_tree\scene.gltf"
    if os.path.exists(sakura_path):
        for x_pos, suffix in [(-4.0, "L"), (4.0, "R")]:
            before_t = set(bpy.data.objects.keys())
            bpy.ops.import_scene.gltf(filepath=sakura_path)
            after_t = set(bpy.data.objects.keys())
            tree_names = after_t - before_t

            for c in bpy.data.collections:
                if c.name not in [ch.name for ch in scene.collection.children]:
                    scene.collection.children.link(c)

            tree_roots = [bpy.data.objects[n] for n in tree_names if n in bpy.data.objects and bpy.data.objects[n].parent is None]
            tree_meshes = [bpy.data.objects[n] for n in tree_names if n in bpy.data.objects and bpy.data.objects[n].type == 'MESH' and bpy.data.objects[n].data is not None]

            if tree_meshes:
                t_amin = Vector((999, 999, 999))
                t_amax = Vector((-999, -999, -999))
                for o in tree_meshes:
                    for c_bb in o.bound_box:
                        wc = o.matrix_world @ Vector(c_bb)
                        t_amin = Vector((min(t_amin[i], wc[i]) for i in range(3)))
                        t_amax = Vector((max(t_amax[i], wc[i]) for i in range(3)))
                t_h = t_amax.z - t_amin.z
                t_sf = 4.5 / max(t_h, 0.01)
                for r in tree_roots:
                    r.scale *= t_sf
                    r.location = (x_pos, 5.5, 0)
                bpy.context.view_layer.update()
            print(f"  Sakura {suffix} placed at ({x_pos}, 5.5)")
    else:
        print(f"  Sakura trees not found — skipping")

    print("\n=== PETALS ===")
    petal_mat = new_mat("PetalMat", (0.95, 0.80, 0.85), 0.5)
    random.seed(42)
    for i in range(30):
        x = random.uniform(-5, 5)
        y = random.uniform(-1, 9)
        z = random.uniform(0.3, 4)
        bpy.ops.mesh.primitive_plane_add(size=0.08, location=(x, y, z))
        p = bpy.context.active_object
        p.name = f"Petal_{i}"
        p.rotation_euler = (random.uniform(0, math.pi), random.uniform(0, math.pi), random.uniform(0, 2 * math.pi))
        assign_mat(p, petal_mat)

    print("\n=== ORBS ===")
    orb_mat = new_emission_mat("OrbMat", (1.0, 0.95, 0.85), 2.0)
    for i in range(8):
        x = random.uniform(-2, 2)
        y = random.uniform(0, 7)
        z = random.uniform(0.5, 2.5)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(x, y, z))
        orb = bpy.context.active_object
        orb.name = f"Orb_{i}"
        assign_mat(orb, orb_mat)

    print("\n=== MOON ===")
    moon_mat = new_emission_mat("MoonMat", (1.0, 0.98, 0.90), 1.5)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.7, location=(4, 9, 8))
    moon = bpy.context.active_object
    moon.name = "Moon"
    assign_mat(moon, moon_mat)

    print("\n=== LIGHTING ===")
    sun_data = bpy.data.lights.new("KeySun", 'SUN')
    sun_data.energy = 0.8
    sun_data.color = (1, 0.88, 0.68)
    sun_obj = bpy.data.objects.new("KeySun", sun_data)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(50), math.radians(-15), math.radians(-50))

    fill_data = bpy.data.lights.new("FillArea", 'AREA')
    fill_data.energy = 0.9
    fill_data.color = (0.65, 0.70, 1.0)
    fill_data.size = 5
    fill_obj = bpy.data.objects.new("FillArea", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.location = (0, -4, 3)
    fill_obj.rotation_euler = (math.radians(55), 0, 0)

    rim_data = bpy.data.lights.new("RimArea", 'AREA')
    rim_data.energy = 0.7
    rim_data.color = (1, 0.92, 1.0)
    rim_data.size = 3
    rim_obj = bpy.data.objects.new("RimArea", rim_data)
    bpy.context.collection.objects.link(rim_obj)
    rim_obj.location = (0, 8, 3)
    rim_obj.rotation_euler = (math.radians(-45), 0, 0)

    front_data = bpy.data.lights.new("FrontFill", 'AREA')
    front_data.energy = 0.6
    front_data.size = 4
    front_obj = bpy.data.objects.new("FrontFill", front_data)
    bpy.context.collection.objects.link(front_obj)
    front_obj.location = (0, -4, 3)
    front_obj.rotation_euler = (math.radians(55), 0, 0)

    front2_data = bpy.data.lights.new("FrontFill2", 'AREA')
    front2_data.energy = 0.4
    front2_data.size = 3
    front2_obj = bpy.data.objects.new("FrontFill2", front2_data)
    bpy.context.collection.objects.link(front2_obj)
    front2_obj.location = (-2, -3, 2)
    front2_obj.rotation_euler = (math.radians(50), math.radians(20), 0)

    moon_light = bpy.data.lights.new("MoonLight", 'AREA')
    moon_light.energy = 0.5
    moon_light.color = (0.8, 0.85, 1.0)
    moon_light.size = 2
    ml_obj = bpy.data.objects.new("MoonLight", moon_light)
    bpy.context.collection.objects.link(ml_obj)
    ml_obj.location = (4, 9, 7)

    print("\n=== CAMERA ===")
    cam_data = bpy.data.cameras.new("MainCam")
    cam_data.lens = 35
    cam_obj = bpy.data.objects.new("MainCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = (0.12, -3.58, 0.85)
    cam_obj.rotation_euler = (math.radians(83), 0, 0)
    scene.camera = cam_obj

    print("\n=== SCENE INVENTORY ===")
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    lights = [o for o in bpy.data.objects if o.type == 'LIGHT']
    print(f"  Meshes: {len(meshes)}, Lights: {len(lights)}")
    print(f"  Camera: {cam_obj.location} lens={cam_data.lens}mm")

    print("\n=== EEVEE PREVIEW RENDER ===")
    scene.render.filepath = f"{OUT}\\anime_shrine_v2_preview.jpg"
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 60
    bpy.ops.render.render(write_still=True)
    print(f"  Preview: {scene.render.filepath}")

    print("\n=== SAVE .BLEND ===")
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"  Saved: {BLEND}")

    print("\n" + "=" * 60)
    print("PHASE 1 COMPLETE — Scene built in EEVEE")
    print("Run cycles_composite_render.py for Phase 2 (Cycles + Freestyle)")
    print("=" * 60)

except Exception as e:
    print(f"\nERROR: {e}")
    traceback.print_exc()
