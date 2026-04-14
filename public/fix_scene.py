import bpy, math
from mathutils import Vector

print("=== FIX SCENE ===")

BOUNDS = 25.0
removed = []
kept = []

for o in list(bpy.data.objects):
    if o.type not in ('MESH', 'EMPTY', 'ARMATURE'):
        kept.append(o.name)
        continue
    
    if o.type == 'MESH':
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        center = sum(bb, Vector()) / 8
        if abs(center.x) > BOUNDS or abs(center.y) > BOUNDS or abs(center.z) > BOUNDS:
            removed.append(f"{o.name} center=({center.x:.0f},{center.y:.0f},{center.z:.0f})")
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        
        maxdim = max((max(v[i] for v in bb) - min(v[i] for v in bb)) for i in range(3))
        if maxdim > 50:
            removed.append(f"{o.name} TOO_BIG dim={maxdim:.0f}")
            bpy.data.objects.remove(o, do_unlink=True)
            continue
    
    kept.append(o.name)

print(f"Removed {len(removed)} rogue objects:")
for r in removed:
    print(f"  - {r}")

print(f"\nKept {len(kept)} objects")

sakura_r = None
for o in bpy.data.objects:
    if o.type == 'MESH' and 'Sakura' in o.name:
        print(f"  Sakura found: {o.name} at {[round(x,1) for x in o.location]}")

has_right_sakura = False
for o in bpy.data.objects:
    if o.type == 'MESH' and 'Sakura' in o.name and o.location.x > 2:
        has_right_sakura = True
        break

if not has_right_sakura:
    print("\nAdding right sakura tree (duplicate)...")
    for o in bpy.data.objects:
        if 'Sakura' in o.name and o.type == 'MESH' and o.location.x < 0:
            o.select_set(True)
            bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    sakura_objs = [o for o in bpy.data.objects if 'Sakura' in o.name and o.type == 'MESH']
    for o in sakura_objs:
        new = o.copy()
        new.data = o.data.copy()
        bpy.context.collection.objects.link(new)
        new.location.x = -o.location.x
        print(f"  Duplicated {o.name} -> x={new.location.x:.1f}")

has_torii = any('torii' in o.name.lower() or 'gate' in o.name.lower() for o in bpy.data.objects)
if not has_torii:
    print("\nTorii gate was removed (rogue scale). Building procedural torii...")
    
    def make_pillar(name, x, y, height=4.0, radius=0.18):
        bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=height, location=(x, y, height/2))
        p = bpy.context.active_object
        p.name = name
        mat = bpy.data.materials.new(name+"_mat")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (0.6, 0.12, 0.08, 1)
        bsdf.inputs["Roughness"].default_value = 0.85
        p.data.materials.append(mat)
        return p
    
    lp = make_pillar("Torii_L", -1.8, 7.0)
    rp = make_pillar("Torii_R", 1.8, 7.0)
    
    bpy.ops.mesh.primitive_cube_add(location=(0, 7.0, 4.2))
    beam = bpy.context.active_object
    beam.name = "Torii_Beam"
    beam.scale = (2.4, 0.15, 0.12)
    beam.data.materials.append(lp.data.materials[0])
    
    bpy.ops.mesh.primitive_cube_add(location=(0, 7.0, 3.5))
    beam2 = bpy.context.active_object
    beam2.name = "Torii_Beam2"
    beam2.scale = (1.6, 0.10, 0.08)
    beam2.data.materials.append(lp.data.materials[0])
    print("  Built procedural torii gate at y=7")

has_lanterns = any('lantern' in o.name.lower() or 'Glow' in o.name for o in bpy.data.objects if o.type == 'MESH')
lantern_lights = [o for o in bpy.data.objects if o.type == 'LIGHT' and 'Glow' in o.name]
if not any('lantern' in o.name.lower() for o in bpy.data.objects if o.type == 'MESH'):
    print("\nBuilding procedural lanterns...")
    
    def make_lantern(name, x, y):
        bpy.ops.mesh.primitive_cube_add(location=(x, y, 0.0))
        base = bpy.context.active_object
        base.name = name + "_base"
        base.scale = (0.2, 0.2, 0.5)
        mat_stone = bpy.data.materials.new(name+"_stone")
        mat_stone.use_nodes = True
        bsdf = mat_stone.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (0.45, 0.43, 0.40, 1)
        bsdf.inputs["Roughness"].default_value = 0.95
        base.data.materials.append(mat_stone)
        
        bpy.ops.mesh.primitive_cube_add(location=(x, y, 0.8))
        lamp = bpy.context.active_object
        lamp.name = name + "_lamp"
        lamp.scale = (0.15, 0.15, 0.25)
        mat_paper = bpy.data.materials.new(name+"_paper")
        mat_paper.use_nodes = True
        bsdf = mat_paper.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (1.0, 0.85, 0.5, 1)
        bsdf.inputs["Emission Color"].default_value = (1.0, 0.75, 0.35, 1)
        bsdf.inputs["Emission Strength"].default_value = 8.0
        lamp.data.materials.append(mat_paper)
        
        bpy.ops.mesh.primitive_cone_add(radius1=0.18, radius2=0.02, depth=0.15, location=(x, y, 1.1))
        cap = bpy.context.active_object
        cap.name = name + "_cap"
        cap.data.materials.append(mat_stone)
        print(f"  Built lantern '{name}' at ({x}, {y})")
    
    make_lantern("Lantern_L", -1.4, 2.8)
    make_lantern("Lantern_R", 1.4, 2.8)

ground = None
for o in bpy.data.objects:
    if o.name == 'Ground' and o.type == 'MESH':
        ground = o
        break
if not ground:
    print("\nGround missing, adding...")
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 5, -0.01))
    ground = bpy.context.active_object
    ground.name = "Ground"
    mat = bpy.data.materials.new("Ground_mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.18, 0.25, 0.12, 1)
    bsdf.inputs["Roughness"].default_value = 0.95
    ground.data.materials.append(mat)

path_exists = any(o.name == 'StonePath' for o in bpy.data.objects)
if not path_exists:
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 2.5, 0.0))
    path = bpy.context.active_object
    path.name = "StonePath"
    path.scale = (1.2, 5.0, 1.0)
    mat = bpy.data.materials.new("Path_mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.35, 0.32, 0.28, 1)
    bsdf.inputs["Roughness"].default_value = 0.92
    path.data.materials.append(mat)
    print("  Added stone path")

cam = bpy.context.scene.camera
if cam:
    cam.location = (0.3, -6.0, 2.0)
    cam.rotation_euler = (math.radians(78), 0, math.radians(2))
    cam.data.lens = 50
    print(f"\nCamera adjusted: pos={[round(x,1) for x in cam.location]}, lens=50mm")

print("\n=== FINAL OBJECT COUNT ===")
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
print(f"Meshes: {len(meshes)}")
for o in meshes:
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    center = sum(bb, Vector()) / 8
    maxdim = max((max(v[i] for v in bb) - min(v[i] for v in bb)) for i in range(3))
    print(f"  {o.name}: center=({center.x:.1f},{center.y:.1f},{center.z:.1f}) maxdim={maxdim:.1f}")

bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend")
print("\nBLEND_SAVED")

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.filepath = r"C:\Users\Aiden\Desktop\anime_shrine_final.png"
scene.render.image_settings.file_format = 'PNG'

bpy.ops.render.render(write_still=True)
print("RENDER_DONE")

print("\nFIX_SCENE_OK")
