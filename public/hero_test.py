import bpy, math, os
from mathutils import Vector

bpy.ops.wm.read_homefile(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.device = 'CPU'
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.image_settings.file_format = 'PNG'

world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
nt = world.node_tree
nt.nodes.clear()
sky = nt.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'NISHITA'
sky.sun_elevation = math.radians(30)
bg = nt.nodes.new('ShaderNodeBackground')
bg.inputs['Strength'].default_value = 3.0
out_n = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
nt.links.new(bg.outputs['Background'], out_n.inputs['Surface'])

sun = bpy.data.lights.new("Sun", 'SUN')
sun.energy = 5.0
sun_obj = bpy.data.objects.new("Sun", sun)
bpy.context.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(45), 0, math.radians(-30))

bpy.ops.object.camera_add(location=(0, -5, 1.5))
cam = bpy.context.active_object
cam.rotation_euler = (math.radians(82), 0, 0)
cam.data.lens = 50
scene.camera = cam

print("=== PRE-IMPORT STATE ===")
print(f"World: {scene.world.name}, Camera: {scene.camera.name}")

hero_path = r"C:\Users\Aiden\Downloads\85187f9f246f4702b7c137dcc6c0fc12.glb"
if not os.path.exists(hero_path):
    print(f"HERO NOT FOUND: {hero_path}")
else:
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=hero_path)
    after = set(bpy.data.objects.keys())
    new_names = after - before
    print(f"\n=== POST-IMPORT ===")
    print(f"New objects: {len(new_names)}")
    print(f"World still set: {scene.world is not None} -> {scene.world.name if scene.world else 'NONE'}")
    print(f"Camera still set: {scene.camera is not None} -> {scene.camera.name if scene.camera else 'NONE'}")

    for name in sorted(new_names):
        o = bpy.data.objects.get(name)
        if not o:
            continue
        vis = "VISIBLE" if not o.hide_render else "HIDDEN"
        if o.type == 'MESH' and o.data is not None:
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
            mn = Vector((min(v[i] for v in bb) for i in range(3)))
            mx = Vector((max(v[i] for v in bb) for i in range(3)))
            sz = mx - mn
            ct = (mn+mx)/2
            print(f"  MESH {name}: center=({ct.x:.1f},{ct.y:.1f},{ct.z:.1f}) size=({sz.x:.1f},{sz.y:.1f},{sz.z:.1f}) {vis}")
            if o.data.materials:
                for mi, m in enumerate(o.data.materials):
                    if m:
                        nt2 = m.node_tree
                        if nt2:
                            for n in nt2.nodes:
                                if 'Principled' in n.name or 'BSDF' in n.type:
                                    bc = n.inputs.get("Base Color")
                                    alpha = n.inputs.get("Alpha")
                                    print(f"    Mat[{mi}] '{m.name}': BaseColor={[round(x,2) for x in bc.default_value] if bc else '?'}, Alpha={alpha.default_value if alpha else '?'}")
        elif o.type == 'MESH':
            print(f"  MESH {name}: data=None (armature) {vis}")
        else:
            print(f"  {o.type} {name} {vis}")

    # Scale + position hero
    all_meshes = [bpy.data.objects[n] for n in new_names if bpy.data.objects[n].type == 'MESH' and bpy.data.objects[n].data is not None]
    if all_meshes:
        amin = Vector((999,999,999))
        amax = Vector((-999,-999,-999))
        for o in all_meshes:
            for c in o.bound_box:
                wc = o.matrix_world @ Vector(c)
                amin = Vector((min(amin[i], wc[i]) for i in range(3)))
                amax = Vector((max(amax[i], wc[i]) for i in range(3)))
        
        h = amax.z - amin.z
        sf = 1.7 / max(h, 0.01)
        roots = [bpy.data.objects[n] for n in new_names if bpy.data.objects[n].parent is None]
        for r in roots:
            r.scale *= sf
        bpy.context.view_layer.update()
        
        amin2 = Vector((999,999,999))
        amax2 = Vector((-999,-999,-999))
        for o in all_meshes:
            if o.data is None:
                continue
            for c in o.bound_box:
                wc = o.matrix_world @ Vector(c)
                amin2 = Vector((min(amin2[i], wc[i]) for i in range(3)))
                amax2 = Vector((max(amax2[i], wc[i]) for i in range(3)))
        
        off = Vector((0,0,0)) - Vector((0, 0, amin2.z))
        for r in roots:
            r.location += off
        bpy.context.view_layer.update()
        
        print(f"\nHero scaled: factor={sf:.3f}, original_h={h:.1f}, target=1.7m")
        print(f"Hero positioned: feet at z=0")

bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.01))
ground = bpy.context.active_object
mat_g = bpy.data.materials.new("Gnd")
mat_g.use_nodes = True
mat_g.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.3, 0.5, 0.2, 1)
ground.data.materials.append(mat_g)

print(f"\n=== RENDERING ===")
print(f"Camera: {[round(x,2) for x in scene.camera.location]}")
print(f"World: {scene.world.name}")
scene.render.filepath = r"C:\Users\Aiden\Desktop\hero_test.png"
bpy.ops.render.render(write_still=True)
print("HERO_TEST_DONE")
