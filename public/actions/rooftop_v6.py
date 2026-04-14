import bpy, json, os, math, random, traceback, subprocess
from mathutils import Vector

OUT = r"C:\Users\Aiden\Desktop"
BLEND = os.path.join(OUT, "rooftop_scene_v6.blend")
HERO_GLB = os.path.join(r"C:\Users\Aiden\Downloads", "9263ca597dea49bb8bb249f21c7bdc4d.glb")

LOG = []

def log(step, msg):
    LOG.append({"step": step, "msg": msg})
    print(f"[{step}] {msg}")

try:
    log("GPU", "Init CUDA")
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "CUDA"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = (d.type != "CPU")

    log("CLEAR", "Clear scene")
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in list(bpy.data.meshes): bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials): bpy.data.materials.remove(block)
    for block in list(bpy.data.lights): bpy.data.lights.remove(block)
    for block in list(bpy.data.cameras): bpy.data.cameras.remove(block)
    for block in list(bpy.data.images): bpy.data.images.remove(block)
    for block in list(bpy.data.armatures): bpy.data.armatures.remove(block)

    scene = bpy.context.scene

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

    log("SKY", "Nishita dusk sky")
    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(5)
    sky.sun_rotation = math.radians(200)
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.8
    out_w = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out_w.inputs['Surface'])

    log("IMPORT", f"Importing {os.path.basename(HERO_GLB)}")
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=HERO_GLB)
    after = set(bpy.data.objects.keys())
    new_names = after - before
    log("IMPORT", f"Got {len(new_names)} objects")

    for c in bpy.data.collections:
        if c.name not in [ch.name for ch in scene.collection.children]:
            scene.collection.children.link(c)

    removed = []
    for name in list(new_names):
        o = bpy.data.objects.get(name)
        if o and o.type == 'MESH' and o.data is not None:
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
            sx = max(v[0] for v in bb) - min(v[0] for v in bb)
            sy = max(v[1] for v in bb) - min(v[1] for v in bb)
            if sx > 3.0 or sy > 3.0:
                removed.append(name)
                bpy.data.objects.remove(o, do_unlink=True)
                new_names.discard(name)
    log("BLOCKERS", f"Removed {len(removed)}")

    for mat in bpy.data.materials:
        if not mat.node_tree: continue
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
            bsdf.inputs['Roughness'].default_value = 0.65

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
        sf = 1.7 / max(h, 0.001)
        log("SCALE", f"Height={h:.4f} scale_factor={sf:.2f}")

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

        amin2 = Vector((999, 999, 999))
        amax2 = Vector((-999, -999, -999))
        for o in hero_meshes:
            if o.name not in bpy.data.objects: continue
            for c in o.bound_box:
                wc = o.matrix_world @ Vector(c)
                amin2 = Vector((min(amin2[i], wc[i]) for i in range(3)))
                amax2 = Vector((max(amax2[i], wc[i]) for i in range(3)))

        target = Vector((0, 1.5, 0))
        offset = target - Vector(((amin2.x+amax2.x)/2, (amin2.y+amax2.y)/2, amin2.z))
        for r in roots:
            r.location += offset
        bpy.context.view_layer.update()

        amin3 = Vector((999, 999, 999))
        amax3 = Vector((-999, -999, -999))
        for o in hero_meshes:
            if o.name not in bpy.data.objects: continue
            for c in o.bound_box:
                wc = o.matrix_world @ Vector(c)
                amin3 = Vector((min(amin3[i], wc[i]) for i in range(3)))
                amax3 = Vector((max(amax3[i], wc[i]) for i in range(3)))
        hero_center = (amin3 + amax3) / 2
        log("HERO_POS", f"Center={hero_center} height={amax3.z-amin3.z:.2f}")

    log("GROUND", "Build rooftop")
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
        wall.name = f"RoofWall_{y_pos}"
        wall.scale = (6, 0.15, 0.4)
        assign_mat(wall, edge_mat)
    for x_pos in [-3, 3]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x_pos, 3, 0.1))
        wall = bpy.context.active_object
        wall.name = f"RoofWall_{x_pos}"
        wall.scale = (0.15, 8, 0.4)
        assign_mat(wall, edge_mat)

    log("PROPS", "AC, antenna, crates, puddle, railing")
    ac_mat = new_metal_mat("ACMat", (0.65, 0.63, 0.60), 0.7, 0.4)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-2, 5.5, 0.5))
    ac = bpy.context.active_object
    ac.name = "AC_Unit"
    ac.scale = (0.8, 0.5, 0.5)
    assign_mat(ac, ac_mat)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=1.5, location=(-2, 5.5, 1.5))
    assign_mat(bpy.context.active_object, ac_mat)

    antenna_mat = new_metal_mat("AntennaMat", (0.50, 0.48, 0.45), 0.8, 0.5)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=3.0, location=(2.5, 6, 1.5))
    assign_mat(bpy.context.active_object, antenna_mat)
    bpy.ops.mesh.primitive_cube_add(size=0.3, location=(2.5, 6, 3.1))
    top = bpy.context.active_object
    top.scale = (1, 0.1, 0.5)
    assign_mat(top, antenna_mat)

    crate_mat = new_mat("CrateMat", (0.45, 0.35, 0.20), 0.8)
    for i, (cx, cy) in enumerate([(-1.5, 5), (-1.8, 4.5), (-1.2, 4.8)]):
        bpy.ops.mesh.primitive_cube_add(size=0.5+i*0.1, location=(cx, cy, 0.25+i*0.15))
        c = bpy.context.active_object
        c.rotation_euler = (0, 0, math.radians(i*15-10))
        assign_mat(c, crate_mat)

    puddle_mat = new_mat("PuddleMat", (0.15, 0.18, 0.25), 0.05)
    bpy.ops.mesh.primitive_circle_add(vertices=32, radius=0.8, fill_type='NGON', location=(1, 2, 0.005))
    assign_mat(bpy.context.active_object, puddle_mat)

    railing_mat = new_metal_mat("RailingMat", (0.40, 0.38, 0.35), 0.8, 0.4)
    for i in range(6):
        x = -2.5 + i * 1.0
        bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=1.0, location=(x, -0.85, 0.5))
        assign_mat(bpy.context.active_object, railing_mat)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=5.5, location=(0, -0.85, 0.95))
    rail = bpy.context.active_object
    rail.rotation_euler = (0, math.radians(90), 0)
    assign_mat(rail, railing_mat)

    log("CITY", "Background buildings")
    random.seed(42)
    for i in range(12):
        bx = random.uniform(-15, 15)
        by = random.uniform(12, 30)
        bw = random.uniform(1.5, 4.0)
        bd = random.uniform(1.5, 4.0)
        bh = random.uniform(3, 15)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(bx, by, bh/2 - 2))
        bldg = bpy.context.active_object
        bldg.scale = (bw, bd, bh)
        assign_mat(bldg, new_mat(f"BldgMat_{i}", (random.uniform(0.2,0.32), random.uniform(0.2,0.30), random.uniform(0.25,0.35)), 0.8))
        for j in range(int(bh)):
            for k in range(int(bw)):
                if random.random() > 0.5:
                    wx = bx - bw/2 + k*1.0 + 0.5
                    wz = j*1.0 + 0.5
                    bpy.ops.mesh.primitive_plane_add(size=0.3, location=(wx, by - bd/2 - 0.01, wz))
                    win = bpy.context.active_object
                    win.rotation_euler = (math.radians(90), 0, 0)
                    warmth = random.uniform(0.6, 1.0)
                    assign_mat(win, new_emission_mat(f"WG_{i}_{j}_{k}", (1.0, warmth, warmth*0.6), random.uniform(1.0, 3.0)))

    log("LIGHTS", "Sun + fill + rim + 2x front")
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

    for loc, col, e, sz in [((2,-3,2),(0.85,0.80,0.75),0.4,4), ((-2,-2,1.5),(0.80,0.82,0.90),0.3,3)]:
        fd = bpy.data.lights.new("FrontFill", 'AREA')
        fd.energy = e
        fd.size = sz
        fd.color = col
        fo = bpy.data.objects.new("FrontFill", fd)
        bpy.context.collection.objects.link(fo)
        fo.location = loc
        fo.rotation_euler = (math.radians(50), 0, 0)

    log("CAMERA", "Setup camera aimed at hero")
    cam_data = bpy.data.cameras.new("MainCam")
    cam_data.lens = 50
    cam_obj = bpy.data.objects.new("MainCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    if hero_meshes:
        cam_obj.location = (hero_center.x + 2.0, hero_center.y - 3.5, hero_center.z)
        direction = hero_center - cam_obj.location
        rot = direction.to_track_quat('-Z', 'Y')
        cam_obj.rotation_euler = rot.to_euler()
    else:
        cam_obj.location = (2, -3.5, 1.0)
        cam_obj.rotation_euler = (math.radians(78), 0, math.radians(8))

    log("RENDER_CYCLES", "Cycles 128spp OIDN 1920x1080")
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

    scene.render.filepath = os.path.join(OUT, "rooftop_v6_final.png")
    scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    subprocess.Popen(['cmd', '/c', 'start', '', os.path.join(OUT, "rooftop_v6_final.png")], shell=False)

    meshes = len([o for o in bpy.data.objects if o.type == 'MESH'])
    lights = len([o for o in bpy.data.objects if o.type == 'LIGHT'])
    print(f"\nPIPELINE_DONE meshes={meshes} lights={lights}")

except Exception as e:
    log("ERROR", str(e))
    traceback.print_exc()
