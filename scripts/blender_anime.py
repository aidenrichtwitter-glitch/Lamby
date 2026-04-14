import bpy, math, os
from mathutils import Vector

# ─── CLEAN SCENE ───
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in bpy.data.meshes:
    if block.users == 0: bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    if block.users == 0: bpy.data.materials.remove(block)
for block in bpy.data.armatures:
    if block.users == 0: bpy.data.armatures.remove(block)

# ─── IMPORT GLB MODEL ───
glb_path = r"C:\Users\Aiden\Downloads\b8e1967c0703492e8121d9457f056d27.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)
print(f"Imported GLB")

all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
all_armature = [o for o in bpy.data.objects if o.type == 'ARMATURE']
print(f"Meshes: {len(all_mesh)} | Armatures: {len(all_armature)}")

# ─── CENTER AND SCALE ───
min_co = Vector((float('inf'),)*3)
max_co = Vector((float('-inf'),)*3)
for obj in all_mesh:
    for v in obj.bound_box:
        co = obj.matrix_world @ Vector(v)
        for i in range(3):
            if co[i] < min_co[i]: min_co[i] = co[i]
            if co[i] > max_co[i]: max_co[i] = co[i]

center = (min_co + max_co) / 2
height = max_co[2] - min_co[2]
print(f"Height: {height:.2f}, Center: ({center.x:.2f}, {center.y:.2f}, {center.z:.2f})")

scale_factor = 2.0 / height if height > 0.01 else 1.0

for obj in bpy.data.objects:
    if obj.parent is None and obj.type in ('MESH', 'ARMATURE', 'EMPTY'):
        obj.location.x -= center.x
        obj.location.y -= center.y
        obj.location.z -= min_co.z
        obj.scale *= scale_factor

# ─── OUTLINE MATERIAL ───
outline_mat = bpy.data.materials.new("Outline")
outline_mat.use_nodes = True
ont = outline_mat.node_tree
for n in ont.nodes: ont.nodes.remove(n)
out_n = ont.nodes.new("ShaderNodeOutputMaterial")
em = ont.nodes.new("ShaderNodeEmission")
em.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
em.inputs["Strength"].default_value = 0.0
ont.links.new(em.outputs["Emission"], out_n.inputs["Surface"])

# ─── APPLY CEL-SHADE TO EXISTING MATERIALS ───
for mat in bpy.data.materials:
    if mat.name == "Outline" or not mat.use_nodes:
        continue
    nt = mat.node_tree
    output = None
    bsdf = None
    for node in nt.nodes:
        if node.type == 'OUTPUT_MATERIAL': output = node
        if node.type == 'BSDF_PRINCIPLED': bsdf = node
    
    if bsdf and output:
        # Get the base color
        base_color_input = bsdf.inputs.get("Base Color")
        
        # Insert Shader to RGB + ColorRamp for cel-shade steps
        s2rgb = nt.nodes.new("ShaderNodeShaderToRGB")
        s2rgb.location = (bsdf.location.x + 300, bsdf.location.y)
        
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.location = (bsdf.location.x + 500, bsdf.location.y)
        ramp.color_ramp.interpolation = 'CONSTANT'
        ramp.color_ramp.elements[0].position = 0.0
        ramp.color_ramp.elements[1].position = 0.4
        elem = ramp.color_ramp.elements.new(0.75)
        
        # Emission for flat fill
        emit = nt.nodes.new("ShaderNodeEmission")
        emit.location = (bsdf.location.x + 700, bsdf.location.y)
        
        # Disconnect bsdf -> output, reconnect through cel pipeline
        for link in nt.links:
            if link.to_node == output and link.to_socket.name == "Surface":
                nt.links.remove(link)
                break
        
        nt.links.new(bsdf.outputs["BSDF"], s2rgb.inputs["Shader"])
        nt.links.new(s2rgb.outputs["Color"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], emit.inputs["Color"])
        emit.inputs["Strength"].default_value = 1.0
        nt.links.new(emit.outputs["Emission"], output.inputs["Surface"])

# ─── ADD OUTLINES via Solidify ───
for obj in all_mesh:
    solidify = obj.modifiers.new("Outline", 'SOLIDIFY')
    solidify.thickness = -0.005
    solidify.use_flip_normals = True
    solidify.material_offset = len(obj.data.materials)
    obj.data.materials.append(outline_mat)

# ─── CAMERA centered on character ───
cam_data = bpy.data.cameras.new("AnimeCamera")
cam_data.lens = 55
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 4.0
cam_data.dof.focus_distance = 3.5
cam_obj = bpy.data.objects.new("AnimeCamera", cam_data)
bpy.context.collection.objects.link(cam_obj)
cam_obj.location = (0, -3.5, 1.0)
cam_obj.rotation_euler = (math.radians(83), 0, 0)
bpy.context.scene.camera = cam_obj

# ─── ANIME LIGHTING ───
key_data = bpy.data.lights.new("KeyLight", 'SUN')
key_data.energy = 3
key_data.color = (1.0, 0.95, 0.9)
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.rotation_euler = (math.radians(45), math.radians(15), math.radians(-30))

fill_data = bpy.data.lights.new("FillLight", 'AREA')
fill_data.energy = 30
fill_data.color = (0.7, 0.8, 1.0)
fill_data.size = 3
fill_obj = bpy.data.objects.new("FillLight", fill_data)
bpy.context.collection.objects.link(fill_obj)
fill_obj.location = (-3, -1, 2)
fill_obj.rotation_euler = (math.radians(60), 0, math.radians(-45))

rim_data = bpy.data.lights.new("RimLight", 'AREA')
rim_data.energy = 50
rim_data.color = (0.9, 0.7, 1.0)
rim_data.size = 2
rim_obj = bpy.data.objects.new("RimLight", rim_data)
bpy.context.collection.objects.link(rim_obj)
rim_obj.location = (2, 3, 3)
rim_obj.rotation_euler = (math.radians(130), 0, math.radians(30))

# ─── WORLD: anime gradient ───
world = bpy.data.worlds["World"]
world.use_nodes = True
wnt = world.node_tree
for n in wnt.nodes: wnt.nodes.remove(n)

bg = wnt.nodes.new("ShaderNodeBackground")
out_w = wnt.nodes.new("ShaderNodeOutputWorld")
gradient = wnt.nodes.new("ShaderNodeTexGradient")
gradient.gradient_type = 'LINEAR'
mapping = wnt.nodes.new("ShaderNodeMapping")
mapping.inputs["Rotation"].default_value = (math.radians(90), 0, 0)
texcoord = wnt.nodes.new("ShaderNodeTexCoord")
ramp_w = wnt.nodes.new("ShaderNodeValToRGB")
ramp_w.color_ramp.elements[0].position = 0.0
ramp_w.color_ramp.elements[0].color = (0.95, 0.78, 0.85, 1)
ramp_w.color_ramp.elements[1].position = 1.0
ramp_w.color_ramp.elements[1].color = (0.65, 0.82, 1.0, 1)

wnt.links.new(texcoord.outputs["Generated"], mapping.inputs["Vector"])
wnt.links.new(mapping.outputs["Vector"], gradient.inputs["Vector"])
wnt.links.new(gradient.outputs["Fac"], ramp_w.inputs["Fac"])
wnt.links.new(ramp_w.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 1.5
wnt.links.new(bg.outputs["Background"], out_w.inputs["Surface"])

# ─── FLOOR ───
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=5, fill_type='NGON', location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = "Floor"
mat_floor = bpy.data.materials.new("FloorMat")
mat_floor.use_nodes = True
fbsdf = mat_floor.node_tree.nodes["Principled BSDF"]
fbsdf.inputs["Base Color"].default_value = (0.92, 0.9, 0.95, 1.0)
fbsdf.inputs["Roughness"].default_value = 0.15
floor.data.materials.append(mat_floor)

# ─── ANIMATIONS ───
scene = bpy.context.scene
actions = bpy.data.actions
print(f"\nAnimations found: {len(actions)}")
for a in actions:
    print(f"  - {a.name}: frames {a.frame_range[0]:.0f}-{a.frame_range[1]:.0f}")

if actions:
    scene.frame_start = int(actions[0].frame_range[0])
    scene.frame_end = int(actions[0].frame_range[1])
    scene.frame_current = scene.frame_start

# ─── RENDER (EEVEE for ShaderToRGB cel-shade) ───
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080

bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/anime_scene.blend')
print("ANIME_SAVE_COMPLETE")

scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_cel_shaded.png'
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print("ANIME_RENDER_COMPLETE")
