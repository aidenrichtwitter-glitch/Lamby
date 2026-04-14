import bpy, math
from mathutils import Vector

bpy.ops.wm.read_homefile(use_empty=True)
scene = bpy.context.scene

print(f"View layers: {[vl.name for vl in scene.view_layers]}")
print(f"Collections: {[c.name for c in bpy.data.collections]}")
print(f"Scene collection children: {[c.name for c in scene.collection.children]}")

scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.device = 'CPU'
scene.render.resolution_x = 960
scene.render.resolution_y = 540

world = bpy.data.worlds.new("TestWorld")
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
print(f"World links: {len(nt.links)}")

bpy.ops.mesh.primitive_monkey_add(size=1.5, location=(0, 0, 1))
monkey = bpy.context.active_object
mat = bpy.data.materials.new("MonkeyMat")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.8, 0.2, 0.1, 1)
monkey.data.materials.append(mat)

sun = bpy.data.lights.new("Sun", 'SUN')
sun.energy = 5.0
sun_obj = bpy.data.objects.new("Sun", sun)
bpy.context.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(45), 0, math.radians(-30))

bpy.ops.object.camera_add(location=(0, -5, 2))
cam = bpy.context.active_object
cam.rotation_euler = (math.radians(78), 0, 0)
cam.data.lens = 50
scene.camera = cam

print(f"Objects: {[o.name for o in bpy.data.objects]}")
print(f"Camera: {scene.camera.name}")
print(f"World: {scene.world.name}")

for vl in scene.view_layers:
    print(f"ViewLayer '{vl.name}': use={vl.use}")
    def print_layer_col(lc, indent=0):
        print(f"{'  '*indent}LayerCol '{lc.name}': exclude={lc.exclude}, hide_viewport={lc.hide_viewport}")
        for child in lc.children:
            print_layer_col(child, indent+1)
    print_layer_col(vl.layer_collection)

scene.render.filepath = r"C:\Users\Aiden\Desktop\debug_render.png"
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print("DEBUG_RENDER_DONE")
