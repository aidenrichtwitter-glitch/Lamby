import bpy, json, os, math, random, traceback, subprocess
from mathutils import Vector

OUT = r"C:\Users\Aiden\Desktop"
BLEND = os.path.join(OUT, "neon_alley.blend")
DL = r"C:\Users\Aiden\Downloads"
RENDER_PATH = os.path.join(OUT, "neon_alley_final.png")

# Character candidates — probe first, fallback chain
CHAR_CANDIDATES = [
    os.path.join(DL, "b2359160a4f54e76b5ae427a55d9594d.glb"),  # Just a girl (NEW)
    os.path.join(DL, "9263ca597dea49bb8bb249f21c7bdc4d.glb"),  # Proven anime girl
]
SWORD_GLB = os.path.join(DL, "DRAGON_SWORD.glb")
TREE_GLB  = os.path.join(DL, "Low_Poly_Tree_Scene_Free.glb")
FOX_GLB   = os.path.join(DL, "Lowpoly_fox.glb")

LOG = []
def log(s, m):
    LOG.append({"s": s, "m": m})
    print(f"[{s}] {m}")

# ═══════════════════════════════════════════════
# SAFE CLEAR — NEVER remove bpy.data.collections
# ═══════════════════════════════════════════════
def safe_clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for coll in [bpy.data.meshes, bpy.data.materials, bpy.data.lights,
                 bpy.data.cameras, bpy.data.images, bpy.data.armatures, bpy.data.textures]:
        for b in list(coll):
            coll.remove(b)

def link_collections(scene):
    for c in bpy.data.collections:
        if c.name not in [ch.name for ch in scene.collection.children]:
            scene.collection.children.link(c)

def remove_blockers(new_names):
    removed = 0
    for name in list(new_names):
        o = bpy.data.objects.get(name)
        if o and o.type == 'MESH' and o.data is not None:
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
            sx = max(v[0] for v in bb) - min(v[0] for v in bb)
            sy = max(v[1] for v in bb) - min(v[1] for v in bb)
            if sx > 3.0 or sy > 3.0:
                bpy.data.objects.remove(o, do_unlink=True)
                new_names.discard(name)
                removed += 1
    return removed

def fix_glb_materials():
    fixed = 0
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
            fixed += 1
    return fixed

def scale_to_height(new_names, target_h, target_pos):
    """Scale imported objects to target_h meters, feet at target_pos"""
    mesh_objs = [bpy.data.objects[n] for n in new_names
                 if n in bpy.data.objects and bpy.data.objects[n].type == 'MESH'
                 and bpy.data.objects[n].data is not None]
    if not mesh_objs:
        return None, 0.0

    amin = Vector((9999, 9999, 9999))
    amax = Vector((-9999, -9999, -9999))
    for o in mesh_objs:
        for c in o.bound_box:
            wc = o.matrix_world @ Vector(c)
            amin = Vector((min(amin[i], wc[i]) for i in range(3)))
            amax = Vector((max(amax[i], wc[i]) for i in range(3)))
    h = amax.z - amin.z
    sf = target_h / max(h, 0.001)

    # Find root objects (including armatures)
    roots = set()
    for n in new_names:
        o = bpy.data.objects.get(n)
        if o:
            r = o
            while r.parent: r = r.parent
            roots.add(r)

    for r in roots: r.scale *= sf
    bpy.context.view_layer.update()

    # Re-measure and offset to target
    amin2 = Vector((9999, 9999, 9999))
    amax2 = Vector((-9999, -9999, -9999))
    for o in mesh_objs:
        if o.name not in bpy.data.objects: continue
        for c in o.bound_box:
            wc = o.matrix_world @ Vector(c)
            amin2 = Vector((min(amin2[i], wc[i]) for i in range(3)))
            amax2 = Vector((max(amax2[i], wc[i]) for i in range(3)))

    offset = target_pos - Vector(((amin2.x+amax2.x)/2, (amin2.y+amax2.y)/2, amin2.z))
    for r in roots: r.location += offset
    bpy.context.view_layer.update()

    # Final center for camera targeting
    amin3 = Vector((9999, 9999, 9999))
    amax3 = Vector((-9999, -9999, -9999))
    for o in mesh_objs:
        if o.name not in bpy.data.objects: continue
        for c in o.bound_box:
            wc = o.matrix_world @ Vector(c)
            amin3 = Vector((min(amin3[i], wc[i]) for i in range(3)))
            amax3 = Vector((max(amax3[i], wc[i]) for i in range(3)))
    center = (amin3 + amax3) / 2
    return center, sf

def mat(name, color, rough=0.7, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs['Base Color'].default_value = (*color, 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m

def emit(name, color, strength=2.0):
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

def set_mat(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)

def add_light(name, ltype, energy, color, loc, rot_deg=None, size=None):
    ld = bpy.data.lights.new(name, ltype)
    ld.energy = energy
    ld.color = color
    if size and hasattr(ld, 'size'): ld.size = size
    if hasattr(ld, 'shadow_soft_size'): ld.shadow_soft_size = 0.3
    lo = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(lo)
    lo.location = loc
    if rot_deg:
        lo.rotation_euler = tuple(math.radians(x) for x in rot_deg)
    return lo

try:
    # ═══════════════════════════════════════
    # PHASE 0: GPU
    # ═══════════════════════════════════════
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "CUDA"
    prefs.get_devices()
    for d in prefs.devices: d.use = (d.type != "CPU")
    log("GPU", f"CUDA: {[d.name for d in prefs.devices if d.use]}")

    # ═══════════════════════════════════════
    # PHASE 1: SAFE CLEAR
    # ═══════════════════════════════════════
    safe_clear()
    scene = bpy.context.scene
    log("CLEAR", "Done")

    # ═══════════════════════════════════════
    # PHASE 2: IMPORT HERO (probe each candidate)
    # ═══════════════════════════════════════
    hero_center = Vector((0, 0, 0.85))
    hero_glb_used = None

    for glb_path in CHAR_CANDIDATES:
        if not os.path.exists(glb_path):
            log("HERO", f"Missing: {os.path.basename(glb_path)}")
            continue
        size_mb = os.path.getsize(glb_path) / (1024*1024)
        log("HERO_TRY", f"{os.path.basename(glb_path)} ({size_mb:.1f}MB)")

        before = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=glb_path)
        after = set(bpy.data.objects.keys())
        new_names = after - before

        link_collections(scene)
        removed = remove_blockers(new_names)
        fixed = fix_glb_materials()

        mesh_c = sum(1 for n in new_names if n in bpy.data.objects and bpy.data.objects[n].type == 'MESH' and bpy.data.objects[n].data is not None)
        arm_c  = sum(1 for n in new_names if n in bpy.data.objects and bpy.data.objects[n].type == 'ARMATURE')

        log("HERO_PROBE", f"meshes={mesh_c} arms={arm_c} blockers_removed={removed} mats_fixed={fixed}")

        if arm_c > 0 and mesh_c >= 1:
            # Good character — scale to 1.7m at hero position
            center, sf = scale_to_height(new_names, 1.7, Vector((0, 0.5, 0)))
            if center:
                hero_center = center
                hero_glb_used = glb_path
                log("HERO_OK", f"Using {os.path.basename(glb_path)}, sf={sf:.3f}, center={hero_center}")
                break
        else:
            log("HERO_SKIP", f"Not a character (arm_c={arm_c} mesh_c={mesh_c}), trying next")
            # Remove imported objects and try next
            for n in list(new_names):
                o = bpy.data.objects.get(n)
                if o: bpy.data.objects.remove(o, do_unlink=True)

    log("HERO_FINAL", f"Used: {os.path.basename(hero_glb_used) if hero_glb_used else 'NONE'}")

    # ═══════════════════════════════════════
    # PHASE 3: IMPORT DRAGON SWORD PROP
    # ═══════════════════════════════════════
    if os.path.exists(SWORD_GLB):
        before = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=SWORD_GLB)
        after = set(bpy.data.objects.keys())
        sword_names = after - before
        link_collections(scene)
        remove_blockers(sword_names)
        fix_glb_materials()
        sword_center, sword_sf = scale_to_height(sword_names, 1.3, Vector((-0.8, 0.5, 0)))
        log("SWORD", f"Imported, sf={sword_sf:.3f}, placed at (-0.8, 0.5)")
    else:
        log("SWORD", f"Not found: {SWORD_GLB}")

    # ═══════════════════════════════════════
    # PHASE 4: IMPORT FOX PROP
    # ═══════════════════════════════════════
    if os.path.exists(FOX_GLB):
        before = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=FOX_GLB)
        after = set(bpy.data.objects.keys())
        fox_names = after - before
        link_collections(scene)
        fix_glb_materials()
        fox_center, fox_sf = scale_to_height(fox_names, 0.5, Vector((1.2, 1.2, 0)))
        log("FOX", f"Imported, sf={fox_sf:.3f}, placed at (1.2, 1.2)")
    else:
        log("FOX", f"Not found: {FOX_GLB}")

    # ═══════════════════════════════════════
    # PHASE 5: WORLD / SKY (dark night)
    # ═══════════════════════════════════════
    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(-8)
    sky.sun_rotation = math.radians(0)
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.2
    out_w = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out_w.inputs['Surface'])
    log("SKY", "Deep night, Nishita")

    # ═══════════════════════════════════════
    # PHASE 6: ALLEY ENVIRONMENT
    # ═══════════════════════════════════════
    concrete = mat("Concrete", (0.25, 0.24, 0.23), 0.92)
    wet_floor = mat("WetFloor", (0.12, 0.13, 0.16), 0.03, 0.2)
    brick = mat("Brick", (0.30, 0.22, 0.18), 0.88)
    metal_dark = mat("MetalDark", (0.18, 0.17, 0.19), 0.4, 0.9)
    glass_panel = mat("Glass", (0.3, 0.5, 0.7), 0.1, 0.0)

    # Wet ground
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 3, 0))
    set_mat(bpy.context.active_object, wet_floor)

    # Left wall
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-4, 3, 3.5))
    lw = bpy.context.active_object
    lw.scale = (0.2, 10, 7)
    set_mat(lw, brick)

    # Right wall
    bpy.ops.mesh.primitive_cube_add(size=1, location=(4, 3, 3.5))
    rw = bpy.context.active_object
    rw.scale = (0.2, 10, 7)
    set_mat(rw, brick)

    # Back wall
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 8, 3.5))
    bw = bpy.context.active_object
    bw.scale = (8, 0.2, 7)
    set_mat(bw, concrete)

    log("WALLS", "Ground + left/right/back walls")

    # ═══════════════════════════════════════
    # PHASE 7: NEON SIGNS (the hero visual elements)
    # ═══════════════════════════════════════
    neon_signs = [
        # (pos, scale, color_rgb, strength, name)
        ((-3.6, 4.0, 5.0), (0.05, 2.5, 0.35),  (1.0, 0.05, 0.4),  8.0, "NeonMagenta"),
        ((-3.6, 6.0, 3.5), (0.05, 1.8, 0.25),  (0.0, 0.85, 1.0),  7.0, "NeonCyan"),
        ((-3.6, 2.5, 4.0), (0.05, 1.2, 0.15),  (1.0, 0.65, 0.0),  6.0, "NeonOrange"),
        ((3.6,  5.0, 4.5), (0.05, 2.0, 0.30),  (0.5, 0.0,  1.0),  8.0, "NeonPurple"),
        ((3.6,  3.0, 3.0), (0.05, 1.5, 0.20),  (0.0, 1.0,  0.4),  6.0, "NeonGreen"),
        ((0,    8.1, 5.5), (3.5,  0.05, 0.4),  (1.0, 0.85, 0.0),  7.0, "NeonYellow_BG"),
    ]
    for pos, scale, color, strength, name in neon_signs:
        bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
        sign = bpy.context.active_object
        sign.name = name
        sign.scale = scale
        set_mat(sign, emit(name, color, strength))

    log("NEON", f"{len(neon_signs)} neon signs")

    # ═══════════════════════════════════════
    # PHASE 8: FIRE ESCAPES + PIPES + DETAILS
    # ═══════════════════════════════════════
    fe_mat = mat("FireEscape", (0.22, 0.20, 0.18), 0.5, 0.8)

    for y in [2, 4, 6]:
        # Left side fire escape platform
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-3.6, y, 2.5))
        fe = bpy.context.active_object
        fe.scale = (0.6, 0.8, 0.04)
        set_mat(fe, fe_mat)
        # Railings
        for xi in [-3.85, -3.35]:
            bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.6, location=(xi, y, 2.82))
            set_mat(bpy.context.active_object, fe_mat)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=0.55, location=(-3.6, y, 3.12))
        rail = bpy.context.active_object
        rail.rotation_euler = (0, math.radians(90), 0)
        set_mat(rail, fe_mat)

    # Vertical pipes on walls
    pipe_mat = mat("Pipe", (0.28, 0.26, 0.24), 0.4, 0.7)
    for x, y in [(-3.5, 1), (-3.5, 7), (3.5, 2), (3.5, 5)]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=7, location=(x, y, 3.5))
        set_mat(bpy.context.active_object, pipe_mat)

    # Trash cans
    trash_mat = mat("Trash", (0.20, 0.20, 0.18), 0.6, 0.4)
    for pos in [(-2, 7.5, 0.4), (-1.5, 7.5, 0.4), (2.5, 7.5, 0.4)]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=0.8, location=pos)
        set_mat(bpy.context.active_object, trash_mat)

    # Puddles with neon reflections
    for pos, size, color, strength in [
        ((0.5, 2.5, 0.002), 0.9, (1.0, 0.05, 0.4), 0.5),
        ((-1.2, 4.0, 0.002), 0.6, (0.0, 0.85, 1.0), 0.4),
        ((1.8, 5.5, 0.002), 0.7, (0.5, 0.0, 1.0), 0.3),
    ]:
        bpy.ops.mesh.primitive_circle_add(vertices=32, radius=size, fill_type='NGON', location=pos)
        p = bpy.context.active_object
        set_mat(p, emit(f"Puddle_{pos}", color, strength))

    # Wires strung between buildings
    wire_mat = mat("Wire", (0.08, 0.07, 0.06), 0.5, 0.9)
    for z in [4.5, 5.5, 6.0]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.008, depth=8.5, location=(0, 5, z))
        wire = bpy.context.active_object
        wire.rotation_euler = (0, math.radians(90), 0)
        set_mat(wire, wire_mat)

    # Paper lanterns hanging from wires
    lantern_mat = emit("Lantern", (1.0, 0.7, 0.3), 3.0)
    for x, z in [(-1.5, 5.3), (0, 4.8), (1.2, 5.8), (-0.5, 6.3)]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.18, location=(x, 5, z))
        lan = bpy.context.active_object
        lan.scale = (1, 1, 1.3)
        set_mat(lan, lantern_mat)

    log("DETAILS", "Fire escapes, pipes, trash, puddles, wires, lanterns")

    # ═══════════════════════════════════════
    # PHASE 9: LIGHTING (neon color rig)
    # ═══════════════════════════════════════
    # Moonlight (weak, overhead)
    add_light("MoonLight", 'SUN', 0.2, (0.6, 0.65, 0.85), (0,0,0), rot_deg=(45, 0, -20))

    # Magenta neon key from left wall
    add_light("NeonMagenta_L", 'AREA', 0.7, (1.0, 0.05, 0.4), (-3.5, 3, 4), rot_deg=(0, 90, 0), size=3)

    # Cyan neon from left wall (higher)
    add_light("NeonCyan_L", 'AREA', 0.6, (0.0, 0.85, 1.0), (-3.5, 6, 3), rot_deg=(0, 90, 0), size=2)

    # Purple from right wall
    add_light("NeonPurple_R", 'AREA', 0.5, (0.5, 0.0, 1.0), (3.5, 4, 4), rot_deg=(0, -90, 0), size=3)

    # Front fill — CRITICAL: prevents hero from going dark  
    add_light("FrontFill", 'AREA', 0.5, (0.80, 0.75, 0.85), (0, -3, 2), rot_deg=(55, 0, 0), size=5)
    add_light("FrontFill2", 'AREA', 0.35, (0.90, 0.70, 0.80), (-2, -2, 1.5), rot_deg=(50, 10, 0), size=3)

    # Warm backlight rim (from yellow sign above back wall)
    add_light("RimWarm", 'AREA', 0.4, (1.0, 0.85, 0.3), (0, 8, 5), rot_deg=(-40, 0, 0), size=4)

    # Point lights at lanterns
    for x, z in [(-1.5, 5.3), (0, 4.8), (1.2, 5.8)]:
        add_light(f"LanternPt", 'POINT', 0.5, (1.0, 0.65, 0.25), (x, 5, z))

    log("LIGHTS", "Moon + 3 neon area + 2 front fill + rim + 3 lantern points = 10 lights")

    # ═══════════════════════════════════════
    # PHASE 10: CAMERA (aim at hero)
    # ═══════════════════════════════════════
    cam_data = bpy.data.cameras.new("MainCam")
    cam_data.lens = 50
    cam_obj = bpy.data.objects.new("MainCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # Slightly lower and to the right, looking at hero chest height
    cam_target = Vector((hero_center.x, hero_center.y, hero_center.z - 0.15))
    cam_obj.location = Vector((hero_center.x + 1.5, hero_center.y - 4.5, hero_center.z - 0.2))
    direction = cam_target - cam_obj.location
    rot = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot.to_euler()
    log("CAMERA", f"Aimed at {cam_target}, from {cam_obj.location}, lens=50mm")

    # ═══════════════════════════════════════
    # PHASE 11: INVENTORY
    # ═══════════════════════════════════════
    mesh_count = len([o for o in bpy.data.objects if o.type == 'MESH'])
    light_count = len([o for o in bpy.data.objects if o.type == 'LIGHT'])
    log("INVENTORY", f"Meshes={mesh_count}, Lights={light_count}")

    # ═══════════════════════════════════════
    # PHASE 12: RENDER CONFIG
    # ═══════════════════════════════════════
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

    # Freestyle — single lineset, remove loop (NEVER .clear())
    scene.render.use_freestyle = True
    scene.render.line_thickness = 1.0
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
        ls.linestyle.thickness = 1.3
        ls.linestyle.color = (0.05, 0.02, 0.08)

    log("RENDER_CFG", "Cycles 128spp OIDN 1920x1080 Filmic Freestyle")

    # ═══════════════════════════════════════
    # PHASE 13: FINAL RENDER
    # ═══════════════════════════════════════
    scene.render.filepath = RENDER_PATH
    scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    log("RENDER", f"Done: {RENDER_PATH}")

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    subprocess.Popen(['cmd', '/c', 'start', '', RENDER_PATH], shell=False)

    # Write log
    with open(os.path.join(OUT, "neon_alley_log.json"), 'w') as f:
        json.dump({"steps": LOG}, f, indent=2)

    print(f"\nPIPELINE_DONE meshes={mesh_count} lights={light_count} hero={os.path.basename(hero_glb_used) if hero_glb_used else 'NONE'}")

except Exception as e:
    log("ERROR", str(e))
    print(f"\nERROR: {e}")
    traceback.print_exc()
    with open(os.path.join(OUT, "neon_alley_log.json"), 'w') as f:
        json.dump({"steps": LOG, "error": str(e)}, f, indent=2)
