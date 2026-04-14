import bpy
scene = bpy.context.scene
scene.use_nodes = False
scene.cycles.samples = 96
scene.render.resolution_x = 540
scene.render.resolution_y = 960
scene.render.filepath = r"C:\Users\Aiden\Desktop\godmode-evidence\cyberpunk_current.png"
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print("RENDERED")
