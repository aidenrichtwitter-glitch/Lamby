import bpy, math, traceback

OUT = r"C:\Users\Aiden\Desktop"
BLEND = r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend"

try:
    print("=" * 60)
    print("OPTIMIZED CYCLES COMPOSITE — PHASE 2")
    print("Uses ONLY proven working steps")
    print("=" * 60)

    print("\n=== GPU CUDA ===")
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "CUDA"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = (d.type != "CPU")
    print(f"  GPU: {[d.name for d in prefs.devices if d.use]}")

    scene = bpy.context.scene

    print("\n=== CYCLES 128spp + OIDN ===")
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'

    print("\n=== 1920x1080 PNG ===")
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 15

    print("\n=== FREESTYLE (remove loop, single lineset) ===")
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
    print("  Lineset: AnimeOutlines (dark purple)")

    print("\n=== FILMIC + MEDIUM HIGH CONTRAST ===")
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'

    for c in bpy.data.collections:
        if c.name not in [ch.name for ch in scene.collection.children]:
            scene.collection.children.link(c)
            print(f"  Linked collection: {c.name}")

    print("\n=== INVENTORY ===")
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    lights = [o for o in bpy.data.objects if o.type == 'LIGHT']
    print(f"  Meshes: {len(meshes)}, Lights: {len(lights)}")
    if scene.camera:
        print(f"  Camera: {scene.camera.name} lens={scene.camera.data.lens}mm")

    print("\n=== RENDERING 1920x1080 Cycles + Freestyle ===")
    scene.render.filepath = f"{OUT}\\anime_shrine_v2_final.png"
    print(f"  Meshes: {len([o for o in bpy.data.objects if o.type=='MESH'])}")
    print(f"  Camera: {scene.camera.name if scene.camera else 'NONE'}")
    bpy.ops.render.render(write_still=True)
    print(f"  PNG: {scene.render.filepath}")

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"  Blend: {BLEND}")

    print("\n=== TRANSFER JPEG ===")
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 55
    transfer = f"{OUT}\\anime_shrine_v2_transfer.jpg"
    img = bpy.data.images.get('Render Result')
    if img:
        img.save_render(filepath=transfer, scene=scene)
        print(f"  JPEG: {transfer}")

    print("\n" + "=" * 60)
    print("PHASE 2 COMPLETE — Full Cycles + Freestyle render done")
    print("=" * 60)

except Exception as e:
    print(f"\nERROR: {e}")
    traceback.print_exc()
