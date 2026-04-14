import bpy, math, traceback

OUT = r"C:\Users\Aiden\Desktop"
BLEND = r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend"

print("=" * 60)
print("CYCLES COMPOSITE RENDER — FULL QUALITY")
print("=" * 60)

try:
    print("\n=== GPU CUDA SETUP ===")
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "CUDA"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = (d.type != "CPU")
    print(f"  Devices: {[d.name for d in prefs.devices if d.use]}")

    scene = bpy.context.scene

    print("\n=== SWITCH TO CYCLES ===")
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'

    print("\n=== RESOLUTION: 1920x1080 ===")
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 15

    print("\n=== FREESTYLE OUTLINES ===")
    scene.render.use_freestyle = True
    scene.render.line_thickness = 1.2

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
        ls.linestyle.thickness = 1.5
        ls.linestyle.color = (0.08, 0.05, 0.15)
        print(f"  Lineset 'AnimeOutlines' created")

    print(f"  Freestyle: ON")

    print("\n=== FILM SETTINGS ===")
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'
    print("  Filmic + Medium High Contrast")

    print("\n=== SCENE INVENTORY ===")
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    lights = [o for o in bpy.data.objects if o.type == 'LIGHT']
    cameras = [o for o in bpy.data.objects if o.type == 'CAMERA']
    print(f"  Meshes: {len(meshes)}")
    print(f"  Lights: {len(lights)}")
    print(f"  Cameras: {len(cameras)}")
    if scene.camera:
        cam = scene.camera
        print(f"  Active camera: {cam.name} at {cam.location} lens={cam.data.lens}mm")
    else:
        print("  WARNING: No active camera!")

    for c in bpy.data.collections:
        if c.name not in [ch.name for ch in scene.collection.children]:
            scene.collection.children.link(c)
            print(f"  Linked orphaned collection: {c.name}")

    print("\n=== RENDERING 1920x1080 Cycles 128spp + Freestyle ===")
    print("  (this may take 1-3 minutes...)")
    scene.render.filepath = f"{OUT}\\anime_shrine_cycles_final.png"
    bpy.ops.render.render(write_still=True)
    print(f"  PNG saved: {scene.render.filepath}")

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"  Blend saved: {BLEND}")

    print("\n=== QUICK JPEG COPY FOR TRANSFER ===")
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 55
    transfer_path = f"{OUT}\\anime_shrine_cycles_final_transfer.jpg"
    img = bpy.data.images.get('Render Result')
    if img:
        img.save_render(filepath=transfer_path, scene=scene)
        print(f"  Transfer JPEG saved: {transfer_path}")
    else:
        print("  WARNING: No Render Result image found for JPEG copy")

    print("\n" + "=" * 60)
    print("RENDER COMPLETE")
    print("=" * 60)

except Exception as e:
    print(f"\nERROR: {e}")
    traceback.print_exc()
