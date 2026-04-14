import bpy
img = bpy.data.images.load(r"C:\Users\Aiden\Desktop\godmode-evidence\cyberpunk_v11.png")
for area in bpy.context.screen.areas:
    if area.type in ('VIEW_3D', 'IMAGE_EDITOR'):
        area.type = 'IMAGE_EDITOR'
        for space in area.spaces:
            if space.type == 'IMAGE_EDITOR':
                space.image = img
        break
