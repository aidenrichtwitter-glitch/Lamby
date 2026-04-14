import bpy, json, os, math, random, traceback, subprocess
from mathutils import Vector

OUT = r"C:\Users\Aiden\Desktop"
BLEND = os.path.join(OUT, "moonlit_station.blend")
HERO_GLB = os.path.join(r"C:\Users\Aiden\Downloads", "9263ca597dea49bb8bb249f21c7bdc4d.glb")
SCENE_NAME = "Moonlit Train Station"
RENDER_PATH = os.path.join(OUT, "moonlit_station_final.png")

LOG = []
def log(s, m):
    LOG.append({"s": s, "m": m})
    print(f"[{s}] {m}")

try:
    # ═══════════════════════════════════════════════════
    # PHASE 0: GPU (CUDA only, never OptiX)
    # ═══════════════════════════════════════════════════
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "CUDA"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = (d.type != "CPU")
    log("GPU", f"CUDA: {[d.name for d in prefs.devices if d.use]}")

    # ═══════════════════════════════════════════════════
    # PHASE 1: CLEAR (manual, never read_homefile)
    # ═══════════════════════════════════════════════════
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for coll in [bpy.data.meshes, bpy.data.materials, bpy.data.lights,
                 bpy.data.cameras, bpy.data.images, bpy.data.textures, bpy.data.armatures]:
        for b in list(coll):
            coll.remove(b)
    scene = bpy.context.scene
    log("CLEAR", "Done")

    # ═══════════════════════════════════════════════════
    # MATERIAL HELPERS
    # ═══════════════════════════════════════════════════
    def mat(name, color, rough=0.7, metal=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes.get("Principled BSDF")
        b.inputs['Base Color'].default_value = (*color, 1.0)
        b.inputs['Roughness'].default_value = rough
        b.inputs['Metallic'].default_value = metal
        return m

    def emit_mat(name, color, strength=2.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        e = nt.nodes.new('ShaderNodeEmission')
        e.inputs['Color'].default_value = (*color, 1.0)
        e.inputs['Strength'].default_value = strength
        o = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(e.outputs['Emission'], o.inputs['Surface'])
        return m

    def glass_mat(name, color, ior=1.45, rough=0.1):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        g = nt.nodes.new('ShaderNodeBsdfGlass')
        g.inputs['Color'].default_value = (*color, 1.0)
        g.inputs['IOR'].default_value = ior
        g.inputs['Roughness'].default_value = rough
        o = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(g.outputs['BSDF'], o.inputs['Surface'])
        return m

    def set_mat(obj, m):
        obj.data.materials.clear()
        obj.data.materials.append(m)

    # ═══════════════════════════════════════════════════
    # PHASE 2: SKY — Nishita night (Blender 5.1)
    # ═══════════════════════════════════════════════════
    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(-5)
    sky.sun_rotation = math.radians(120)
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.4
    out_w = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out_w.inputs['Surface'])
    log("SKY", "Night sky, sun below horizon")

    # ═══════════════════════════════════════════════════
    # PHASE 3: IMPORT HERO (proven pipeline)
    # ═══════════════════════════════════════════════════
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=HERO_GLB)
    after = set(bpy.data.objects.keys())
    new_names = after - before
    log("IMPORT", f"{len(new_names)} objects from {os.path.basename(HERO_GLB)}")

    # Link orphaned collections (CRITICAL — without this, invisible)
    for c in bpy.data.collections:
        if c.name not in [ch.name for ch in scene.collection.children]:
            scene.collection.children.link(c)

    # Remove blockers (>3m in x or y)
    for name in list(new_names):
        o = bpy.data.objects.get(name)
        if o and o.type == 'MESH' and o.data is not None:
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
            sx = max(v[0] for v in bb) - min(v[0] for v in bb)
            sy = max(v[1] for v in bb) - min(v[1] for v in bb)
            if sx > 3.0 or sy > 3.0:
                bpy.data.objects.remove(o, do_unlink=True)
                new_names.discard(name)

    # Fix GLB unlit materials (Emission+LightPath → PrincipledBSDF)
    for m in bpy.data.materials:
        if not m.node_tree: continue
        has_e = any(n.type == 'EMISSION' for n in m.node_tree.nodes)
        has_l = any(n.type == 'LIGHT_PATH' for n in m.node_tree.nodes)
        if has_e and has_l:
            nt_m = m.node_tree
            img = next((n for n in nt_m.nodes if n.type == 'TEX_IMAGE' and n.image), None)
            saved = img.image if img else None
            nt_m.nodes.clear()
            b = nt_m.nodes.new('ShaderNodeBsdfPrincipled')
            o = nt_m.nodes.new('ShaderNodeOutputMaterial')
            nt_m.links.new(b.outputs['BSDF'], o.inputs['Surface'])
            if saved:
                t = nt_m.nodes.new('ShaderNodeTexImage')
                t.image = saved
                nt_m.links.new(t.outputs['Color'], b.inputs['Base Color'])
            b.inputs['Roughness'].default_value = 0.65

    # Scale to 1.7m (CRITICAL: measure actual height, never assume)
    hero_meshes = [bpy.data.objects[n] for n in new_names
                   if n in bpy.data.objects and bpy.data.objects[n].type == 'MESH' and bpy.data.objects[n].data is not None]
    hero_center = Vector((0, 0, 0.85))

    if hero_meshes:
        amin = Vector((999, 999, 999))
        amax = Vector((-999, -999, -999))
        for o in hero_meshes:
            for c in o.bound_box:
                wc = o.matrix_world @ Vector(c)
                amin = Vector((min(amin[i], wc[i]) for i in range(3)))
                amax = Vector((max(amax[i], wc[i]) for i in range(3)))
        h = amax.z - amin.z
        sf = 1.7 / max(h, 0.001)
        log("SCALE", f"Raw height={h:.3f}m, factor={sf:.2f}")

        roots = set()
        for o in hero_meshes:
            r = o
            while r.parent: r = r.parent
            roots.add(r)
        for a in [bpy.data.objects[n] for n in new_names if n in bpy.data.objects and bpy.data.objects[n].type == 'ARMATURE']:
            r = a
            while r.parent: r = r.parent
            roots.add(r)
        for r in roots:
            r.scale *= sf
        bpy.context.view_layer.update()

        # Re-measure and position
        amin2 = Vector((999, 999, 999))
        amax2 = Vector((-999, -999, -999))
        for o in hero_meshes:
            if o.name not in bpy.data.objects: continue
            for c in o.bound_box:
                wc = o.matrix_world @ Vector(c)
                amin2 = Vector((min(amin2[i], wc[i]) for i in range(3)))
                amax2 = Vector((max(amax2[i], wc[i]) for i in range(3)))
        target = Vector((0.5, 1.0, 0))
        offset = target - Vector(((amin2.x + amax2.x) / 2, (amin2.y + amax2.y) / 2, amin2.z))
        for r in roots:
            r.location += offset
        bpy.context.view_layer.update()

        # Final bounds for camera targeting
        amin3 = Vector((999, 999, 999))
        amax3 = Vector((-999, -999, -999))
        for o in hero_meshes:
            if o.name not in bpy.data.objects: continue
            for c in o.bound_box:
                wc = o.matrix_world @ Vector(c)
                amin3 = Vector((min(amin3[i], wc[i]) for i in range(3)))
                amax3 = Vector((max(amax3[i], wc[i]) for i in range(3)))
        hero_center = (amin3 + amax3) / 2
        log("HERO", f"Center={hero_center}, height={amax3.z - amin3.z:.2f}m")

    # ═══════════════════════════════════════════════════
    # PHASE 4: TRAIN STATION PLATFORM
    # ═══════════════════════════════════════════════════
    platform_mat = mat("Platform", (0.30, 0.28, 0.26), 0.85)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 4, -0.2))
    p = bpy.context.active_object
    p.name = "Platform"
    p.scale = (8, 12, 0.2)
    set_mat(p, platform_mat)

    # Platform edge (yellow safety line)
    edge_line_mat = emit_mat("SafetyLine", (0.9, 0.8, 0.1), 0.5)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -1.9, 0.005))
    el = bpy.context.active_object
    el.name = "SafetyLine"
    el.scale = (8, 0.08, 0.01)
    set_mat(el, edge_line_mat)

    # Tracks
    track_mat = mat("Track", (0.35, 0.32, 0.28), 0.6, 0.7)
    for x_off in [-0.5, 0.5]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x_off, 4, -0.5))
        t = bpy.context.active_object
        t.name = f"Rail_{x_off}"
        t.scale = (0.04, 14, 0.04)
        set_mat(t, track_mat)

    # Sleepers
    sleeper_mat = mat("Sleeper", (0.25, 0.20, 0.15), 0.9)
    for i in range(20):
        y = -2 + i * 1.0
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y, -0.52))
        s = bpy.context.active_object
        s.name = f"Sleeper_{i}"
        s.scale = (1.2, 0.12, 0.08)
        set_mat(s, sleeper_mat)

    log("PLATFORM", "Platform + safety line + tracks + sleepers")

    # ═══════════════════════════════════════════════════
    # PHASE 5: STATION SHELTER (roof + pillars)
    # ═══════════════════════════════════════════════════
    pillar_mat = mat("Pillar", (0.50, 0.48, 0.45), 0.5, 0.6)
    for x in [-3, 0, 3]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=3.0, location=(x, 3, 1.5))
        set_mat(bpy.context.active_object, pillar_mat)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=3.0, location=(x, 7, 1.5))
        set_mat(bpy.context.active_object, pillar_mat)

    roof_mat = mat("StationRoof", (0.20, 0.22, 0.25), 0.7, 0.3)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 5, 3.05))
    roof = bpy.context.active_object
    roof.name = "StationRoof"
    roof.scale = (8, 6, 0.08)
    set_mat(roof, roof_mat)
    log("SHELTER", "6 pillars + roof")

    # ═══════════════════════════════════════════════════
    # PHASE 6: BENCH
    # ═══════════════════════════════════════════════════
    bench_mat = mat("Bench", (0.35, 0.25, 0.15), 0.8)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(2.5, 2, 0.35))
    bench = bpy.context.active_object
    bench.name = "BenchSeat"
    bench.scale = (0.8, 0.3, 0.04)
    set_mat(bench, bench_mat)
    for x in [2.1, 2.9]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 2, 0.17))
        leg = bpy.context.active_object
        leg.scale = (0.04, 0.25, 0.17)
        set_mat(leg, pillar_mat)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(2.5, 2.14, 0.55))
    back = bpy.context.active_object
    back.scale = (0.8, 0.03, 0.15)
    set_mat(back, bench_mat)
    log("BENCH", "Wooden bench at (2.5, 2)")

    # ═══════════════════════════════════════════════════
    # PHASE 7: VENDING MACHINE
    # ═══════════════════════════════════════════════════
    vend_mat = mat("VendBody", (0.15, 0.18, 0.30), 0.4, 0.5)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.5, 5, 0.9))
    vend = bpy.context.active_object
    vend.name = "VendingMachine"
    vend.scale = (0.6, 0.5, 0.9)
    set_mat(vend, vend_mat)

    vend_glow = emit_mat("VendGlow", (0.3, 0.7, 1.0), 3.0)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(-2.5, 4.74, 1.0))
    vg = bpy.context.active_object
    vg.name = "VendScreen"
    vg.scale = (0.5, 0.7, 1)
    vg.rotation_euler = (math.radians(90), 0, 0)
    set_mat(vg, vend_glow)
    log("VENDING", "Blue-glowing vending machine")

    # ═══════════════════════════════════════════════════
    # PHASE 8: STATION SIGN
    # ═══════════════════════════════════════════════════
    sign_mat = mat("SignBoard", (0.12, 0.12, 0.15), 0.5, 0.3)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 5, 2.6))
    sign = bpy.context.active_object
    sign.name = "StationSign"
    sign.scale = (2.5, 0.05, 0.35)
    set_mat(sign, sign_mat)

    sign_glow = emit_mat("SignGlow", (1.0, 0.95, 0.8), 1.5)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 4.97, 2.6))
    sg = bpy.context.active_object
    sg.name = "SignText"
    sg.scale = (2.3, 0.3, 1)
    sg.rotation_euler = (math.radians(90), 0, 0)
    set_mat(sg, sign_glow)
    log("SIGN", "Station sign with warm glow")

    # ═══════════════════════════════════════════════════
    # PHASE 9: PLATFORM LIGHTS
    # ═══════════════════════════════════════════════════
    lamp_mat = mat("LampPost", (0.40, 0.38, 0.35), 0.5, 0.7)
    lamp_glow = emit_mat("LampGlow", (1.0, 0.85, 0.5), 4.0)
    for x in [-2.5, 2.5]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=2.8, location=(x, 1, 1.4))
        set_mat(bpy.context.active_object, lamp_mat)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(x, 1, 2.85))
        set_mat(bpy.context.active_object, lamp_glow)

        pt = bpy.data.lights.new(f"LampPt_{x}", 'POINT')
        pt.energy = 0.6
        pt.color = (1.0, 0.85, 0.55)
        pt.shadow_soft_size = 0.3
        po = bpy.data.objects.new(f"LampPt_{x}", pt)
        bpy.context.collection.objects.link(po)
        po.location = (x, 1, 2.85)
    log("LAMPS", "2 platform lamps with point lights")

    # ═══════════════════════════════════════════════════
    # PHASE 10: DISTANT CITY SKYLINE
    # ═══════════════════════════════════════════════════
    random.seed(77)
    for i in range(15):
        bx = random.uniform(-20, 20)
        by = random.uniform(18, 40)
        bw = random.uniform(1.5, 4.0)
        bd = random.uniform(1.5, 3.0)
        bh = random.uniform(5, 20)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(bx, by, bh / 2 - 2))
        bldg = bpy.context.active_object
        bldg.scale = (bw, bd, bh)
        set_mat(bldg, mat(f"B_{i}", (random.uniform(0.12, 0.22), random.uniform(0.12, 0.20), random.uniform(0.15, 0.25)), 0.85))

        for j in range(min(int(bh), 8)):
            for k in range(min(int(bw), 3)):
                if random.random() > 0.4:
                    wx = bx - bw / 2 + k * 1.0 + 0.5
                    wz = j * 1.2 + 0.6
                    bpy.ops.mesh.primitive_plane_add(size=0.25, location=(wx, by - bd / 2 - 0.01, wz))
                    w = bpy.context.active_object
                    w.rotation_euler = (math.radians(90), 0, 0)
                    warmth = random.uniform(0.5, 1.0)
                    set_mat(w, emit_mat(f"W_{i}_{j}_{k}", (warmth, warmth * 0.85, warmth * 0.5), random.uniform(0.8, 2.5)))
    log("CITY", "15 buildings + lit windows")

    # ═══════════════════════════════════════════════════
    # PHASE 11: MOON
    # ═══════════════════════════════════════════════════
    moon_mat = emit_mat("Moon", (0.95, 0.93, 0.85), 8.0)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.5, location=(8, 35, 15))
    moon = bpy.context.active_object
    moon.name = "Moon"
    set_mat(moon, moon_mat)
    log("MOON", "Full moon at (8, 35, 15)")

    # ═══════════════════════════════════════════════════
    # PHASE 12: SCATTERED DETAILS
    # ═══════════════════════════════════════════════════
    # Cherry blossom petals floating
    petal_mat = mat("Petal", (0.95, 0.70, 0.75), 0.6)
    random.seed(99)
    for i in range(25):
        px = random.uniform(-4, 4)
        py = random.uniform(-1, 8)
        pz = random.uniform(0.3, 4.0)
        bpy.ops.mesh.primitive_plane_add(size=0.06, location=(px, py, pz))
        pet = bpy.context.active_object
        pet.rotation_euler = (random.uniform(0, 3.14), random.uniform(0, 3.14), random.uniform(0, 3.14))
        set_mat(pet, petal_mat)

    # Puddle reflection on platform
    puddle_mat = mat("Puddle", (0.10, 0.12, 0.18), 0.02, 0.3)
    bpy.ops.mesh.primitive_circle_add(vertices=32, radius=1.0, fill_type='NGON', location=(1, 3, 0.005))
    set_mat(bpy.context.active_object, puddle_mat)
    log("DETAILS", "25 petals + puddle")

    # ═══════════════════════════════════════════════════
    # PHASE 13: LIGHTING (5-light rig — proven)
    # ═══════════════════════════════════════════════════
    # Moonlight (main key — cool blue from above-right)
    moon_light = bpy.data.lights.new("MoonKey", 'SUN')
    moon_light.energy = 0.4
    moon_light.color = (0.65, 0.70, 0.90)
    ml = bpy.data.objects.new("MoonKey", moon_light)
    bpy.context.collection.objects.link(ml)
    ml.rotation_euler = (math.radians(60), math.radians(20), math.radians(-30))

    # Fill (camera-side — prevents silhouette, CRITICAL)
    fill = bpy.data.lights.new("FillArea", 'AREA')
    fill.energy = 0.5
    fill.color = (0.60, 0.65, 0.80)
    fill.size = 6
    fo = bpy.data.objects.new("FillArea", fill)
    bpy.context.collection.objects.link(fo)
    fo.location = (0, -4, 3)
    fo.rotation_euler = (math.radians(55), 0, 0)

    # Warm rim from behind
    rim = bpy.data.lights.new("RimArea", 'AREA')
    rim.energy = 0.5
    rim.color = (1.0, 0.80, 0.55)
    rim.size = 4
    ro = bpy.data.objects.new("RimArea", rim)
    bpy.context.collection.objects.link(ro)
    ro.location = (0, 8, 3)
    ro.rotation_euler = (math.radians(-35), 0, 0)

    # Front fills (2x, camera-side, prevents hero going dark)
    for loc, col, e, sz in [((2.5, -3, 2), (0.80, 0.75, 0.70), 0.35, 3),
                             ((-2, -2, 1.5), (0.70, 0.75, 0.85), 0.3, 3)]:
        fd = bpy.data.lights.new("FrontFill", 'AREA')
        fd.energy = e
        fd.size = sz
        fd.color = col
        ffo = bpy.data.objects.new("FrontFill", fd)
        bpy.context.collection.objects.link(ffo)
        ffo.location = loc
        ffo.rotation_euler = (math.radians(50), 0, 0)
    log("LIGHTS", "MoonKey + Fill + Rim + 2x FrontFill + 2 LampPoints = 7 lights")

    # ═══════════════════════════════════════════════════
    # PHASE 14: CAMERA (aim at hero center — proven method)
    # ═══════════════════════════════════════════════════
    cam_data = bpy.data.cameras.new("MainCam")
    cam_data.lens = 50
    cam_obj = bpy.data.objects.new("MainCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    cam_obj.location = (hero_center.x + 2.2, hero_center.y - 4.0, hero_center.z - 0.1)
    direction = hero_center - cam_obj.location
    rot = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot.to_euler()
    log("CAMERA", f"Aimed at {hero_center}, lens=50mm")

    # ═══════════════════════════════════════════════════
    # PHASE 15: INVENTORY
    # ═══════════════════════════════════════════════════
    mesh_count = len([o for o in bpy.data.objects if o.type == 'MESH'])
    light_count = len([o for o in bpy.data.objects if o.type == 'LIGHT'])
    log("INVENTORY", f"Meshes={mesh_count} Lights={light_count}")

    # ═══════════════════════════════════════════════════
    # PHASE 16: RENDER (Cycles 128spp + OIDN + Freestyle)
    # ═══════════════════════════════════════════════════
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'

    # Freestyle — SINGLE lineset, remove loop (never .clear())
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
        ls.linestyle.color = (0.05, 0.03, 0.12)

    scene.render.filepath = RENDER_PATH
    scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    log("RENDER", f"Cycles 128spp done: {RENDER_PATH}")

    # ═══════════════════════════════════════════════════
    # PHASE 17: SAVE + OPEN
    # ═══════════════════════════════════════════════════
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    subprocess.Popen(['cmd', '/c', 'start', '', RENDER_PATH], shell=False)

    print(f"\nPIPELINE_DONE scene={SCENE_NAME} meshes={mesh_count} lights={light_count}")

except Exception as e:
    log("ERROR", str(e))
    print(f"\nERROR: {e}")
    traceback.print_exc()
