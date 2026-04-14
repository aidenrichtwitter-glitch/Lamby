import bpy, json, os, math, random

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

props = CONFIG.get("props", [])

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

def new_glass_mat(name, color, roughness=0.05):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Transmission Weight'].default_value = 0.8
    bsdf.inputs['IOR'].default_value = 1.33
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

PROP_BUILDERS = {}

def build_rock_cluster(cfg):
    mat = new_mat("RockMat", cfg.get("color", [0.30, 0.28, 0.26]), 0.85)
    center = cfg.get("center", [0, 0, 0])
    count = cfg.get("count", 5)
    spread = cfg.get("spread", 1.5)
    random.seed(cfg.get("seed", 42))
    added = []
    for i in range(count):
        r = random.uniform(0.15, 0.5)
        x = center[0] + random.uniform(-spread, spread)
        y = center[1] + random.uniform(-spread, spread)
        z = r * 0.6
        bpy.ops.mesh.primitive_ico_sphere_add(radius=r, subdivisions=3, location=(x, y, z))
        rock = bpy.context.active_object
        rock.name = f"Rock_{i}"
        rock.scale = (1.0 + random.uniform(-0.3, 0.3), 1.0 + random.uniform(-0.3, 0.3), 0.6 + random.uniform(-0.2, 0.2))
        assign_mat(rock, mat)
        added.append(rock.name)
    return added
PROP_BUILDERS["rock_cluster"] = build_rock_cluster

def build_bamboo_grove(cfg):
    mat = new_mat("BambooMat", cfg.get("color", [0.25, 0.42, 0.18]), 0.6)
    leaf_mat = new_mat("BambooLeafMat", cfg.get("leaf_color", [0.20, 0.38, 0.15]), 0.5)
    center = cfg.get("center", [-4, 6, 0])
    count = cfg.get("count", 12)
    spread = cfg.get("spread", 2.5)
    random.seed(cfg.get("seed", 99))
    added = []
    for i in range(count):
        x = center[0] + random.uniform(-spread, spread)
        y = center[1] + random.uniform(-spread, spread)
        height = random.uniform(3.0, 5.5)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=height, location=(x, y, height / 2))
        stalk = bpy.context.active_object
        stalk.name = f"Bamboo_{i}"
        stalk.rotation_euler = (random.uniform(-0.03, 0.03), random.uniform(-0.03, 0.03), 0)
        assign_mat(stalk, mat)
        added.append(stalk.name)
        for j in range(3):
            leaf_z = height * (0.5 + j * 0.18)
            bpy.ops.mesh.primitive_plane_add(size=0.4, location=(x + random.uniform(-0.3, 0.3), y + random.uniform(-0.2, 0.2), leaf_z))
            leaf = bpy.context.active_object
            leaf.name = f"BambooLeaf_{i}_{j}"
            leaf.rotation_euler = (random.uniform(0.2, 0.8), random.uniform(-0.5, 0.5), random.uniform(0, math.pi * 2))
            assign_mat(leaf, leaf_mat)
            added.append(leaf.name)
    return added
PROP_BUILDERS["bamboo_grove"] = build_bamboo_grove

def build_stone_lantern(cfg):
    stone_mat = new_mat("LanternStone", cfg.get("stone_color", [0.55, 0.52, 0.48]), 0.8)
    glow_mat = new_emission_mat("LanternGlow", cfg.get("glow_color", [1.0, 0.80, 0.45]), cfg.get("glow_strength", 3.0))
    loc = cfg.get("location", [0, 0, 0])
    x, y = loc[0], loc[1]
    added = []

    bpy.ops.mesh.primitive_cube_add(size=0.5, location=(x, y, 0.25))
    base = bpy.context.active_object
    base.name = "Lantern_base"
    base.scale = (1, 1, 0.3)
    assign_mat(base, stone_mat)
    added.append(base.name)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.8, location=(x, y, 0.8))
    post = bpy.context.active_object
    post.name = "Lantern_post"
    assign_mat(post, stone_mat)
    added.append(post.name)

    bpy.ops.mesh.primitive_cube_add(size=0.4, location=(x, y, 1.35))
    lamp = bpy.context.active_object
    lamp.name = "Lantern_lamp"
    assign_mat(lamp, glow_mat)
    added.append(lamp.name)

    bpy.ops.mesh.primitive_cone_add(radius1=0.35, radius2=0.0, depth=0.3, location=(x, y, 1.7))
    cap = bpy.context.active_object
    cap.name = "Lantern_cap"
    assign_mat(cap, stone_mat)
    added.append(cap.name)

    ldata = bpy.data.lights.new("LanternLight", 'POINT')
    ldata.energy = cfg.get("light_energy", 0.8)
    ldata.color = tuple(cfg.get("glow_color", [1.0, 0.80, 0.45]))
    lobj = bpy.data.objects.new("LanternLight", ldata)
    bpy.context.collection.objects.link(lobj)
    lobj.location = (x, y, 1.35)
    added.append(lobj.name)

    return added
PROP_BUILDERS["stone_lantern"] = build_stone_lantern

def build_torii_gate(cfg):
    mat = new_mat("ToriiMat", cfg.get("color", [0.75, 0.15, 0.10]), 0.6)
    loc = cfg.get("location", [0, 0, 0])
    x, y = loc[0], loc[1]
    height = cfg.get("height", 3.0)
    width = cfg.get("width", 2.5)
    added = []

    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=height, location=(x + side * width / 2, y, height / 2))
        pillar = bpy.context.active_object
        pillar.name = f"Torii_pillar_{'L' if side < 0 else 'R'}"
        assign_mat(pillar, mat)
        added.append(pillar.name)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, height))
    beam = bpy.context.active_object
    beam.name = "Torii_beam_top"
    beam.scale = (width * 0.7, 0.12, 0.08)
    assign_mat(beam, mat)
    added.append(beam.name)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, height * 0.75))
    beam2 = bpy.context.active_object
    beam2.name = "Torii_beam_mid"
    beam2.scale = (width * 0.55, 0.08, 0.06)
    assign_mat(beam2, mat)
    added.append(beam2.name)

    return added
PROP_BUILDERS["torii_gate"] = build_torii_gate

def build_koi_pond(cfg):
    water_mat = new_glass_mat("WaterMat", cfg.get("water_color", [0.15, 0.25, 0.35]), 0.05)
    rim_mat = new_mat("PondRimMat", cfg.get("rim_color", [0.35, 0.32, 0.28]), 0.8)
    loc = cfg.get("location", [0, 0, 0])
    radius = cfg.get("radius", 2.5)
    added = []

    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=radius, fill_type='NGON', location=(loc[0], loc[1], 0.01))
    pond = bpy.context.active_object
    pond.name = "KoiPond"
    assign_mat(pond, water_mat)
    added.append(pond.name)

    bpy.ops.mesh.primitive_torus_add(major_radius=radius + 0.05, minor_radius=0.08, location=(loc[0], loc[1], 0.05))
    rim = bpy.context.active_object
    rim.name = "PondRim"
    assign_mat(rim, rim_mat)
    added.append(rim.name)

    return added
PROP_BUILDERS["koi_pond"] = build_koi_pond

def build_fireflies(cfg):
    mat = new_emission_mat("FireflyMat", cfg.get("color", [0.85, 1.0, 0.60]), cfg.get("strength", 4.0))
    count = cfg.get("count", 15)
    bounds = cfg.get("bounds", [[-4, 4], [0, 7], [0.3, 2.0]])
    random.seed(cfg.get("seed", 77))
    added = []
    for i in range(count):
        x = random.uniform(bounds[0][0], bounds[0][1])
        y = random.uniform(bounds[1][0], bounds[1][1])
        z = random.uniform(bounds[2][0], bounds[2][1])
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(x, y, z))
        ff = bpy.context.active_object
        ff.name = f"Firefly_{i}"
        assign_mat(ff, mat)
        added.append(ff.name)
    return added
PROP_BUILDERS["fireflies"] = build_fireflies

def build_moon(cfg):
    mat = new_emission_mat("MoonMat", cfg.get("color", [0.90, 0.92, 1.0]), cfg.get("strength", 2.0))
    loc = cfg.get("location", [-5, 12, 9])
    radius = cfg.get("radius", 1.0)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=tuple(loc))
    moon = bpy.context.active_object
    moon.name = "Moon"
    assign_mat(moon, mat)
    return ["Moon"]
PROP_BUILDERS["moon"] = build_moon

def build_cherry_tree(cfg):
    trunk_mat = new_mat("TrunkMat", cfg.get("trunk_color", [0.35, 0.22, 0.12]), 0.8)
    blossom_mat = new_mat("BlossomMat", cfg.get("blossom_color", [0.95, 0.70, 0.75]), 0.4)
    loc = cfg.get("location", [0, 0, 0])
    x, y = loc[0], loc[1]
    height = cfg.get("height", 3.5)
    added = []

    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=height, location=(x, y, height / 2))
    trunk = bpy.context.active_object
    trunk.name = "CherryTrunk"
    assign_mat(trunk, trunk_mat)
    added.append(trunk.name)

    random.seed(cfg.get("seed", 55))
    for i in range(5):
        angle = random.uniform(0, math.pi * 2)
        dist = random.uniform(0.4, 1.2)
        bx = x + math.cos(angle) * dist
        by = y + math.sin(angle) * dist
        bz = height * 0.7 + random.uniform(0, height * 0.4)
        r = random.uniform(0.3, 0.6)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(bx, by, bz))
        bloom = bpy.context.active_object
        bloom.name = f"Blossom_{i}"
        assign_mat(bloom, blossom_mat)
        added.append(bloom.name)

    return added
PROP_BUILDERS["cherry_tree"] = build_cherry_tree

all_added = []
for prop_cfg in props:
    ptype = prop_cfg.get("type", "")
    builder = PROP_BUILDERS.get(ptype)
    if builder:
        names = builder(prop_cfg)
        all_added.extend(names)
    else:
        print(f"WARNING: Unknown prop type '{ptype}'")

print(json.dumps({"action": "add_props", "added": len(all_added), "types": [p.get("type") for p in props], "status": "ok"}))
