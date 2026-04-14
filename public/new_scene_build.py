import bpy, math, random, traceback
from mathutils import Vector

OUT = r"C:\Users\Aiden\Desktop"
BLEND = OUT + r"\moonlit_garden.blend"

try:
    print("=" * 60)
    print("MOONLIT ZEN GARDEN — PHASE 1 (EEVEE BUILD)")
    print("Same proven process, new scene")
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

    def new_metal_mat(name, color, metallic=0.9, roughness=0.3):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Metallic'].default_value = metallic
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

    def new_glass_mat(name, color, roughness=0.05):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Transmission Weight'].default_value = 0.8
        bsdf.inputs['IOR'].default_value = 1.33
        return mat

    def assign_mat(obj, mat):
        obj.data.materials.clear()
        obj.data.materials.append(mat)

    print("\n=== NISHITA SKY (night) ===")
    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(-5)
    sky.sun_rotation = math.radians(120)
    sky.altitude = 100.0
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.6
    out_w = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out_w.inputs['Surface'])

    print("\n=== GROUND — raked sand ===")
    bpy.ops.mesh.primitive_plane_add(size=50, location=(0, 5, -0.02))
    ground = bpy.context.active_object
    ground.name = "Ground"
    assign_mat(ground, new_mat("SandMat", (0.62, 0.58, 0.48), 0.95))

    print("\n=== KOI POND ===")
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=2.5, fill_type='NGON', location=(1.5, 2.5, 0.01))
    pond = bpy.context.active_object
    pond.name = "KoiPond"
    assign_mat(pond, new_glass_mat("WaterMat", (0.15, 0.25, 0.35), 0.05))

    bpy.ops.mesh.primitive_torus_add(major_radius=2.55, minor_radius=0.08, location=(1.5, 2.5, 0.05))
    pond_rim = bpy.context.active_object
    pond_rim.name = "PondRim"
    assign_mat(pond_rim, new_mat("PondRimMat", (0.35, 0.32, 0.28), 0.8))

    print("\n=== ZEN ROCKS ===")
    rock_mat = new_mat("RockMat", (0.30, 0.28, 0.26), 0.85)
    rock_positions = [
        (-2.0, 3.0, 0.3, 0.5),
        (-2.5, 3.8, 0.2, 0.35),
        (-1.5, 3.5, 0.15, 0.25),
        (-2.8, 2.5, 0.25, 0.4),
        (-1.8, 4.5, 0.18, 0.3),
    ]
    for i, (x, y, z, r) in enumerate(rock_positions):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=r, subdivisions=3, location=(x, y, z))
        rock = bpy.context.active_object
        rock.name = f"ZenRock_{i}"
        rock.scale = (1.0 + random.uniform(-0.3, 0.3), 1.0 + random.uniform(-0.3, 0.3), 0.6 + random.uniform(-0.2, 0.2))
        assign_mat(rock, rock_mat)

    print("\n=== BAMBOO GROVE ===")
    bamboo_mat = new_mat("BambooMat", (0.25, 0.42, 0.18), 0.6)
    bamboo_leaf_mat = new_mat("BambooLeafMat", (0.20, 0.38, 0.15), 0.5)
    random.seed(99)
    for i in range(12):
        x = random.uniform(-5.5, -3.0)
        y = random.uniform(4.0, 8.0)
        height = random.uniform(3.0, 5.5)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=height, location=(x, y, height / 2))
        stalk = bpy.context.active_object
        stalk.name = f"Bamboo_{i}"
        stalk.rotation_euler = (random.uniform(-0.03, 0.03), random.uniform(-0.03, 0.03), 0)
        assign_mat(stalk, bamboo_mat)

        for j in range(3):
            leaf_z = height * (0.5 + j * 0.18)
            bpy.ops.mesh.primitive_plane_add(size=0.4, location=(x + random.uniform(-0.3, 0.3), y + random.uniform(-0.2, 0.2), leaf_z))
            leaf = bpy.context.active_object
            leaf.name = f"BambooLeaf_{i}_{j}"
            leaf.rotation_euler = (random.uniform(0.2, 0.8), random.uniform(-0.5, 0.5), random.uniform(0, math.pi * 2))
            assign_mat(leaf, bamboo_leaf_mat)

    print("\n=== WOODEN BRIDGE ===")
    bridge_mat = new_mat("BridgeMat", (0.40, 0.28, 0.15), 0.75)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(1.5, 0.5, 0.15))
    bridge_deck = bpy.context.active_object
    bridge_deck.name = "BridgeDeck"
    bridge_deck.scale = (1.2, 0.4, 0.05)
    assign_mat(bridge_deck, bridge_mat)

    for x_off in [-0.5, 0.5]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.5, location=(1.5 + x_off * 2.2, 0.5, 0.35))
        rail_post = bpy.context.active_object
        rail_post.name = f"RailPost_{'L' if x_off < 0 else 'R'}"
        assign_mat(rail_post, bridge_mat)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=2.6, location=(1.5, 0.5, 0.55))
    rail_bar = bpy.context.active_object
    rail_bar.name = "RailBar"
    rail_bar.rotation_euler = (0, math.radians(90), 0)
    assign_mat(rail_bar, bridge_mat)

    print("\n=== STONE LANTERN ===")
    lantern_stone = new_mat("LanternStone", (0.55, 0.52, 0.48), 0.8)
    lamp_glow = new_emission_mat("LanternGlow", (1.0, 0.80, 0.45), 3.0)

    for x_pos, suffix in [(3.5, "R"), (-0.5, "L")]:
        y_pos = 4.0 if suffix == "R" else 1.5
        bpy.ops.mesh.primitive_cube_add(size=0.5, location=(x_pos, y_pos, 0.25))
        base = bpy.context.active_object
        base.name = f"Lantern_base_{suffix}"
        base.scale = (1, 1, 0.3)
        assign_mat(base, lantern_stone)

        bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.8, location=(x_pos, y_pos, 0.8))
        post = bpy.context.active_object
        post.name = f"Lantern_post_{suffix}"
        assign_mat(post, lantern_stone)

        bpy.ops.mesh.primitive_cube_add(size=0.4, location=(x_pos, y_pos, 1.35))
        lamp_box = bpy.context.active_object
        lamp_box.name = f"Lantern_lamp_{suffix}"
        assign_mat(lamp_box, lamp_glow)

        bpy.ops.mesh.primitive_cone_add(radius1=0.35, radius2=0.0, depth=0.3, location=(x_pos, y_pos, 1.7))
        cap = bpy.context.active_object
        cap.name = f"Lantern_cap_{suffix}"
        assign_mat(cap, lantern_stone)

        ldata = bpy.data.lights.new(f"LanternLight_{suffix}", 'POINT')
        ldata.energy = 0.8
        ldata.color = (1.0, 0.80, 0.45)
        lobj = bpy.data.objects.new(f"LanternLight_{suffix}", ldata)
        bpy.context.collection.objects.link(lobj)
        lobj.location = (x_pos, y_pos, 1.35)

    print("\n=== STEPPING STONES ===")
    stepping_mat = new_mat("SteppingMat", (0.45, 0.42, 0.38), 0.9)
    stone_path = [(0, -0.5), (0.3, 0.3), (0.8, 1.0), (1.2, 1.8)]
    for i, (sx, sy) in enumerate(stone_path):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.06, location=(sx, sy, 0.01))
        stone = bpy.context.active_object
        stone.name = f"SteppingStone_{i}"
        stone.scale = (1.0 + random.uniform(-0.2, 0.2), 1.0 + random.uniform(-0.2, 0.2), 1)
        stone.rotation_euler = (0, 0, random.uniform(0, math.pi))
        assign_mat(stone, stepping_mat)

    print("\n=== MOON ===")
    moon_mat = new_emission_mat("MoonMat", (0.90, 0.92, 1.0), 2.0)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=(-5, 12, 9))
    moon = bpy.context.active_object
    moon.name = "Moon"
    assign_mat(moon, moon_mat)

    print("\n=== FIREFLIES ===")
    firefly_mat = new_emission_mat("FireflyMat", (0.85, 1.0, 0.60), 4.0)
    random.seed(77)
    for i in range(15):
        x = random.uniform(-4, 4)
        y = random.uniform(0, 7)
        z = random.uniform(0.3, 2.0)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(x, y, z))
        ff = bpy.context.active_object
        ff.name = f"Firefly_{i}"
        assign_mat(ff, firefly_mat)

    print("\n=== RAKED SAND LINES ===")
    sand_line_mat = new_mat("SandLineMat", (0.58, 0.54, 0.44), 0.95)
    for i in range(8):
        y_pos = 2.0 + i * 0.35
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.0, y_pos, 0.002))
        line = bpy.context.active_object
        line.name = f"SandLine_{i}"
        line.scale = (2.0, 0.02, 0.003)
        assign_mat(line, sand_line_mat)

    print("\n=== LIGHTING ===")
    moon_light = bpy.data.lights.new("MoonLight", 'AREA')
    moon_light.energy = 0.7
    moon_light.color = (0.75, 0.80, 1.0)
    moon_light.size = 4
    ml_obj = bpy.data.objects.new("MoonLight", moon_light)
    bpy.context.collection.objects.link(ml_obj)
    ml_obj.location = (-5, 12, 8)
    ml_obj.rotation_euler = (math.radians(-35), math.radians(20), 0)

    fill_data = bpy.data.lights.new("FillArea", 'AREA')
    fill_data.energy = 0.5
    fill_data.color = (0.50, 0.55, 0.80)
    fill_data.size = 6
    fill_obj = bpy.data.objects.new("FillArea", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.location = (0, -4, 3)
    fill_obj.rotation_euler = (math.radians(55), 0, 0)

    front_data = bpy.data.lights.new("FrontFill", 'AREA')
    front_data.energy = 0.4
    front_data.size = 4
    front_data.color = (0.85, 0.82, 0.75)
    front_obj = bpy.data.objects.new("FrontFill", front_data)
    bpy.context.collection.objects.link(front_obj)
    front_obj.location = (2, -3, 2)
    front_obj.rotation_euler = (math.radians(50), math.radians(-15), 0)

    warm_data = bpy.data.lights.new("WarmAccent", 'POINT')
    warm_data.energy = 0.6
    warm_data.color = (1.0, 0.75, 0.40)
    warm_obj = bpy.data.objects.new("WarmAccent", warm_data)
    bpy.context.collection.objects.link(warm_obj)
    warm_obj.location = (1.5, 3.0, 1.5)

    print("\n=== CAMERA ===")
    cam_data = bpy.data.cameras.new("MainCam")
    cam_data.lens = 35
    cam_obj = bpy.data.objects.new("MainCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = (1.0, -4.0, 1.2)
    cam_obj.rotation_euler = (math.radians(80), 0, math.radians(5))
    scene.camera = cam_obj

    print("\n=== SCENE INVENTORY ===")
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    lights = [o for o in bpy.data.objects if o.type == 'LIGHT']
    print(f"  Meshes: {len(meshes)}, Lights: {len(lights)}")
    print(f"  Camera: {cam_obj.location} lens={cam_data.lens}mm")

    print("\n=== HERO — Kitsune Fox Spirit ===")
    hero_body_mat = new_mat("HeroBodyMat", (0.95, 0.90, 0.82), 0.5)
    hero_fur_mat = new_mat("HeroFurMat", (0.92, 0.70, 0.35), 0.6)
    hero_accent_mat = new_emission_mat("HeroAccentMat", (0.60, 0.85, 1.0), 1.5)
    hero_dark_mat = new_mat("HeroDarkMat", (0.15, 0.12, 0.18), 0.5)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.18, location=(0.5, 1.0, 1.15))
    head = bpy.context.active_object
    head.name = "Hero_Head"
    head.scale = (1.0, 0.9, 1.05)
    assign_mat(head, hero_body_mat)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.25, location=(0.5, 1.0, 0.75))
    torso = bpy.context.active_object
    torso.name = "Hero_Torso"
    torso.scale = (0.8, 0.6, 1.2)
    assign_mat(torso, hero_body_mat)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, location=(0.5, 1.0, 0.4))
    hips = bpy.context.active_object
    hips.name = "Hero_Hips"
    hips.scale = (0.85, 0.6, 0.8)
    assign_mat(hips, hero_body_mat)

    for side, sx in [("L", -1), ("R", 1)]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.45, location=(0.5 + sx * 0.15, 1.0, 0.55))
        arm = bpy.context.active_object
        arm.name = f"Hero_Arm_{side}"
        arm.rotation_euler = (0, math.radians(sx * 15), 0)
        assign_mat(arm, hero_body_mat)

        bpy.ops.mesh.primitive_cylinder_add(radius=0.065, depth=0.4, location=(0.5 + sx * 0.1, 1.0, 0.15))
        leg = bpy.context.active_object
        leg.name = f"Hero_Leg_{side}"
        assign_mat(leg, hero_body_mat)

        bpy.ops.mesh.primitive_cone_add(radius1=0.08, radius2=0.02, depth=0.15, location=(0.5 + sx * 0.06, 0.95, 1.32))
        ear = bpy.context.active_object
        ear.name = f"Hero_Ear_{side}"
        ear.rotation_euler = (math.radians(-10), math.radians(sx * 15), 0)
        assign_mat(ear, hero_fur_mat)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.025, location=(0.44, 0.88, 1.18))
    eye_l = bpy.context.active_object
    eye_l.name = "Hero_Eye_L"
    assign_mat(eye_l, hero_accent_mat)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.025, location=(0.56, 0.88, 1.18))
    eye_r = bpy.context.active_object
    eye_r.name = "Hero_Eye_R"
    assign_mat(eye_r, hero_accent_mat)

    for i in range(3):
        angle = math.radians(-30 + i * 30)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=0.8, location=(0.5, 1.35 + i * 0.05, 0.55 + i * 0.08))
        tail = bpy.context.active_object
        tail.name = f"Hero_Tail_{i}"
        tail.rotation_euler = (math.radians(-50 + i * 10), math.radians(-10 + i * 10), 0)
        tail.scale = (1, 1, 1)
        assign_mat(tail, hero_fur_mat)

        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(0.5 + math.sin(angle) * 0.1, 1.7 + i * 0.08, 0.85 + i * 0.12))
        tip = bpy.context.active_object
        tip.name = f"Hero_TailTip_{i}"
        assign_mat(tip, hero_accent_mat)

    bpy.ops.mesh.primitive_cube_add(size=0.3, location=(0.5, 0.92, 0.85))
    kimono = bpy.context.active_object
    kimono.name = "Hero_Kimono"
    kimono.scale = (1.1, 0.5, 1.5)
    assign_mat(kimono, new_mat("KimonoMat", (0.20, 0.15, 0.35), 0.5))

    bpy.ops.mesh.primitive_torus_add(major_radius=0.06, minor_radius=0.015, location=(0.5, 0.88, 1.05))
    mask = bpy.context.active_object
    mask.name = "Hero_Mask"
    mask.rotation_euler = (math.radians(90), 0, 0)
    assign_mat(mask, new_mat("MaskMat", (0.90, 0.25, 0.20), 0.4))

    print("\n=== EEVEE PREVIEW RENDER ===")
    scene.render.filepath = f"{OUT}\\moonlit_garden_preview.jpg"
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 60
    bpy.ops.render.render(write_still=True)
    print(f"  Preview: {scene.render.filepath}")

    print("\n=== SAVE .BLEND ===")
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"  Saved: {BLEND}")

    print("\n" + "=" * 60)
    print("PHASE 1 COMPLETE — Moonlit Zen Garden + Kitsune Hero")
    print("=" * 60)

except Exception as e:
    print(f"\nERROR: {e}")
    traceback.print_exc()
