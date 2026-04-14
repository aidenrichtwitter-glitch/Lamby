import bpy, math, random, os
from mathutils import Vector

OUT = r"C:\Users\Aiden\Desktop"

print("=== ENABLE GPU VIA PREFERENCES ===")
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for device in prefs.devices:
    if device.type == "CPU":
        device.use = False
    else:
        device.use = True
print(f"  Devices: {[d.name for d in prefs.devices if d.use]}")

print("=== CLEAR SCENE (keep user prefs) ===")
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in list(bpy.data.meshes): bpy.data.meshes.remove(block)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)
for block in list(bpy.data.lights): bpy.data.lights.remove(block)
for block in list(bpy.data.cameras): bpy.data.cameras.remove(block)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.image_settings.file_format = 'PNG'
print(f"  Engine: CYCLES, Device: GPU")

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

print("=== IMPORT HERO ===")
hero_path = os.path.join(r"C:\Users\Aiden\Downloads", "85187f9f246f4702b7c137dcc6c0fc12.glb")
before = set(bpy.data.objects.keys())
bpy.ops.import_scene.gltf(filepath=hero_path)
after = set(bpy.data.objects.keys())
new_names = after - before

for c in bpy.data.collections:
    if c.name not in [ch.name for ch in scene.collection.children]:
        scene.collection.children.link(c)

hero_meshes = []
remove_names = []
for name in new_names:
    o = bpy.data.objects.get(name)
    if o and o.type == 'MESH' and o.data is not None:
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        sz = Vector((max(v[i] for v in bb) - min(v[i] for v in bb) for i in range(3)))
        if sz.x > 3.0 or sz.y > 3.0:
            print(f"  REMOVING BLOCKER: {o.name} size=({sz.x:.1f},{sz.y:.1f},{sz.z:.1f})")
            bpy.data.objects.remove(o, do_unlink=True)
            remove_names.append(name)
        else:
            hero_meshes.append(o)

for rn in remove_names:
    new_names.discard(rn)

amin = Vector((999,999,999)); amax = Vector((-999,-999,-999))
for o in hero_meshes:
    for c in o.bound_box:
        wc = o.matrix_world @ Vector(c)
        amin = Vector((min(amin[i], wc[i]) for i in range(3)))
        amax = Vector((max(amax[i], wc[i]) for i in range(3)))

h = amax.z - amin.z
sf = 1.7 / max(h, 0.01)
roots = [bpy.data.objects[n] for n in new_names if bpy.data.objects[n].parent is None]
for r in roots: r.scale *= sf
bpy.context.view_layer.update()

amin2 = Vector((999,999,999))
for o in hero_meshes:
    if o.data is None: continue
    for c in o.bound_box:
        wc = o.matrix_world @ Vector(c)
        amin2 = Vector((min(amin2[i], wc[i]) for i in range(3)))
off = Vector((0, 0, -amin2.z))
for r in roots: r.location += off
bpy.context.view_layer.update()
print(f"  Hero: {len(hero_meshes)} meshes, scale={sf:.3f}, height={h*sf:.2f}m")

print("=== AERIAL CAPTURE ===")
bpy.ops.object.camera_add(location=(0, 0, 14))
cam = bpy.context.active_object; cam.name = "MainCam"
cam.rotation_euler = (0, 0, 0); cam.data.lens = 35
scene.camera = cam

sun = bpy.data.lights.new("KeySun", 'SUN')
sun.energy = 0.8; sun.color = (1, 0.88, 0.68)
sun_obj = bpy.data.objects.new("KeySun", sun)
bpy.context.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(50), math.radians(-15), math.radians(-50))

scene.cycles.samples = 32
scene.render.filepath = os.path.join(OUT, "aerial_capture.png")
bpy.ops.render.render(write_still=True)
print("  aerial_capture.png saved")

print("=== HERO CLOSEUP ===")
cam.location = (0.0, -3.2, 1.0)
cam.rotation_euler = (math.radians(83), 0, 0)
cam.data.lens = 50
scene.render.filepath = os.path.join(OUT, "hero_closeup.png")
bpy.ops.render.render(write_still=True)
print("  hero_closeup.png saved")

print("=== BUILD SCENE ===")
sakura_path = os.path.join(r"C:\Users\Aiden\Downloads", "147ae7d0d332456a99ec6195e9b0cd4f.glb")
for sx, sy in [(-4.0, 5.5), (4.0, 5.5)]:
    bef = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=sakura_path)
    aft = set(bpy.data.objects.keys())
    ns = aft - bef
    for c in bpy.data.collections:
        if c.name not in [ch.name for ch in scene.collection.children]:
            scene.collection.children.link(c)
    sm = [bpy.data.objects[n] for n in ns if bpy.data.objects[n].type == 'MESH' and bpy.data.objects[n].data is not None]
    if sm:
        smin = Vector((999,999,999)); smax = Vector((-999,-999,-999))
        for o in sm:
            for c2 in o.bound_box:
                wc = o.matrix_world @ Vector(c2)
                smin = Vector((min(smin[i2], wc[i2]) for i2 in range(3)))
                smax = Vector((max(smax[i2], wc[i2]) for i2 in range(3)))
        sh = smax.z - smin.z; ssf = 4.5 / max(sh, 0.01)
        sr = [bpy.data.objects[n] for n in ns if bpy.data.objects[n].parent is None]
        for r in sr: r.scale *= ssf
        bpy.context.view_layer.update()
        smin2 = Vector((999,999,999))
        for o in sm:
            if o.data is None: continue
            for c2 in o.bound_box:
                wc = o.matrix_world @ Vector(c2)
                smin2 = Vector((min(smin2[i2], wc[i2]) for i2 in range(3)))
        for r in sr: r.location += Vector((sx, sy, 0)) - Vector((0, 0, smin2.z))
        bpy.context.view_layer.update()
        print(f"  Sakura at ({sx},{sy})")

mat_t = bpy.data.materials.new("Torii_red"); mat_t.use_nodes = True
mat_t.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.7, 0.08, 0.05, 1)
mat_t.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.8
bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=4.5, location=(-1.6, 6.5, 2.25))
bpy.context.active_object.name="ToriiPillarL"; bpy.context.active_object.data.materials.append(mat_t)
bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=4.5, location=(1.6, 6.5, 2.25))
bpy.context.active_object.name="ToriiPillarR"; bpy.context.active_object.data.materials.append(mat_t)
bpy.ops.mesh.primitive_cube_add(location=(0, 6.5, 4.55))
b=bpy.context.active_object; b.name="ToriiTop"; b.scale=(2.2,0.12,0.14); b.data.materials.append(mat_t)
bpy.ops.mesh.primitive_cube_add(location=(0, 6.5, 3.75))
b2=bpy.context.active_object; b2.name="ToriiMid"; b2.scale=(1.5,0.08,0.07); b2.data.materials.append(mat_t)

bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 5, -0.02))
gnd=bpy.context.active_object; gnd.name="Ground"
mg=bpy.data.materials.new("Ground"); mg.use_nodes=True
mg.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(0.14,0.22,0.10,1)
mg.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value=0.95
gnd.data.materials.append(mg)

bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 3, 0.005))
path=bpy.context.active_object; path.name="Path"; path.scale=(1.0,6.0,1)
mp=bpy.data.materials.new("Path"); mp.use_nodes=True
mp.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(0.38,0.34,0.28,1)
path.data.materials.append(mp)

ms=bpy.data.materials.new("Steps"); ms.use_nodes=True
ms.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(0.40,0.37,0.33,1)
for i,(sy2,sw) in enumerate([(4.2,1.3),(5.4,1.5),(6.5,1.7)]):
    bpy.ops.mesh.primitive_cube_add(location=(0, sy2, i*0.045))
    s=bpy.context.active_object; s.name=f"Step{i}"; s.scale=(sw,0.22,0.05+i*0.01); s.data.materials.append(ms)

def lantern(name, x, y):
    ms2=bpy.data.materials.new(name+"_stone"); ms2.use_nodes=True
    ms2.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(0.45,0.42,0.38,1)
    mg2=bpy.data.materials.new(name+"_glow"); mg2.use_nodes=True
    bsdf=mg2.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value=(1,0.85,0.5,1)
    bsdf.inputs["Emission Color"].default_value=(1,0.75,0.35,1)
    bsdf.inputs["Emission Strength"].default_value=6.0
    bpy.ops.mesh.primitive_cube_add(location=(x,y,0.4))
    base=bpy.context.active_object; base.name=name+"_base"; base.scale=(0.16,0.16,0.4); base.data.materials.append(ms2)
    bpy.ops.mesh.primitive_cube_add(location=(x,y,1.0))
    lamp=bpy.context.active_object; lamp.name=name+"_lamp"; lamp.scale=(0.13,0.13,0.2); lamp.data.materials.append(mg2)
    bpy.ops.mesh.primitive_cone_add(radius1=0.16,radius2=0.02,depth=0.12,location=(x,y,1.28))
    cap=bpy.context.active_object; cap.name=name+"_cap"; cap.data.materials.append(ms2)
    lt=bpy.data.lights.new(name+"_pt",'POINT'); lt.energy=0.8; lt.color=(1,0.72,0.35)
    lo=bpy.data.objects.new(name+"_pt",lt); bpy.context.collection.objects.link(lo); lo.location=(x,y,1.0)
lantern("LanternL",-1.2,3.2)
lantern("LanternR",1.2,3.2)

random.seed(42)
mat_pet=bpy.data.materials.new("Petal"); mat_pet.use_nodes=True
mat_pet.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(1,0.75,0.82,1)
for i in range(30):
    bpy.ops.mesh.primitive_plane_add(size=0.07,location=(random.uniform(-5,5),random.uniform(-1,9),random.uniform(0.3,4)))
    p=bpy.context.active_object; p.name=f"Petal{i}"
    p.rotation_euler=(random.uniform(0,6.28),random.uniform(0,6.28),random.uniform(0,6.28))
    p.data.materials.append(mat_pet)

orb_cols=[(0.3,1.0,0.9),(1.0,0.8,0.3),(0.7,0.4,1.0)]
for i in range(8):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04,location=(random.uniform(-3,3),random.uniform(0,7),random.uniform(0.5,2.5)))
    orb=bpy.context.active_object; orb.name=f"Orb{i}"
    mo=bpy.data.materials.new(f"Orb{i}"); mo.use_nodes=True
    c=orb_cols[i%3]; bsdf=mo.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value=(*c,1)
    bsdf.inputs["Emission Color"].default_value=(*c,1)
    bsdf.inputs["Emission Strength"].default_value=15.0
    orb.data.materials.append(mo)

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.7,location=(4,9,8))
moon=bpy.context.active_object; moon.name="Moon"
mm=bpy.data.materials.new("Moon"); mm.use_nodes=True
mm.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value=(1,0.97,0.88,1)
mm.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value=8.0
moon.data.materials.append(mm)

print("=== LIGHTING (all ≤ 1) ===")
fill=bpy.data.lights.new("Fill",'AREA'); fill.energy=0.9; fill.color=(0.65,0.70,1.0); fill.size=5
fo=bpy.data.objects.new("Fill",fill); bpy.context.collection.objects.link(fo)
fo.location=(4,-3,3.5); fo.rotation_euler=(math.radians(60),math.radians(20),0)

rim=bpy.data.lights.new("Rim",'AREA'); rim.energy=0.7; rim.color=(1,0.92,1.0); rim.size=2
ro=bpy.data.objects.new("Rim",rim); bpy.context.collection.objects.link(ro)
ro.location=(0,7,5); ro.rotation_euler=(math.radians(110),0,math.radians(180))

ml=bpy.data.lights.new("MoonLight",'AREA'); ml.energy=0.5; ml.color=(0.88,0.9,1.0); ml.size=3
mlo=bpy.data.objects.new("MoonLight",ml); bpy.context.collection.objects.link(mlo)
mlo.location=(4,9,8)

print("=== FINAL CAMERA ===")
cam.location=(0.1,-3.0,0.9)
cam.rotation_euler=(math.radians(85),0,0)
cam.data.lens=50

scene.render.use_freestyle=True
scene.render.line_thickness=1.5
for vl in scene.view_layers:
    vl.freestyle_settings.linesets[0].select_silhouette=True
    vl.freestyle_settings.linesets[0].select_border=True

print("=== SAVE + RENDER ===")
scene.cycles.samples=96
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,"anime_shrine_scene.blend"))
scene.render.filepath=os.path.join(OUT,"anime_shrine_final.png")
bpy.ops.render.render(write_still=True)
print("FINAL_SCENE_OK")
