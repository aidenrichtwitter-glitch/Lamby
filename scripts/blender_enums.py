import bpy, json

info = {}

info["render_engines"] = list(bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys())

info["sky_types"] = list(bpy.types.ShaderNodeTexSky.bl_rna.properties["sky_type"].enum_items.keys())

info["blend_modes"] = []
try:
    info["blend_modes"] = list(bpy.types.ShaderNodeMix.bl_rna.properties["blend_type"].enum_items.keys())
except: pass

info["object_modes"] = list(bpy.types.Object.bl_rna.properties["mode"].enum_items.keys())

info["light_types"] = list(bpy.types.Light.bl_rna.properties["type"].enum_items.keys())

info["image_formats"] = list(bpy.types.ImageFormatSettings.bl_rna.properties["file_format"].enum_items.keys())

info["shading_types"] = []
try:
    info["shading_types"] = list(bpy.types.View3DShading.bl_rna.properties["type"].enum_items.keys())
except: pass

info["mesh_primitives"] = [m for m in dir(bpy.ops.mesh) if m.startswith("primitive_")]

info["shader_nodes"] = [n for n in dir(bpy.types) if n.startswith("ShaderNode")]

info["compositor_nodes"] = [n for n in dir(bpy.types) if n.startswith("CompositorNode")]

info["texture_nodes"] = [n for n in dir(bpy.types) if n.startswith("ShaderNodeTex")]

info["interpolation_types"] = []
try:
    info["interpolation_types"] = list(bpy.types.ShaderNodeMapRange.bl_rna.properties["interpolation_type"].enum_items.keys())
except: pass

info["mix_data_types"] = []
try:
    info["mix_data_types"] = list(bpy.types.ShaderNodeMix.bl_rna.properties["data_type"].enum_items.keys())
except: pass

info["wave_types"] = []
try:
    info["wave_types"] = list(bpy.types.ShaderNodeTexWave.bl_rna.properties["wave_type"].enum_items.keys())
except: pass

info["noise_dimensions"] = []
try:
    info["noise_dimensions"] = list(bpy.types.ShaderNodeTexNoise.bl_rna.properties["noise_dimensions"].enum_items.keys())
except: pass

info["cycles_device"] = []
try:
    info["cycles_device"] = list(bpy.types.CyclesRenderSettings.bl_rna.properties["device"].enum_items.keys())
except: pass

info["eevee_shadow_method"] = []
try:
    info["eevee_shadow_method"] = list(bpy.types.SceneEEVEE.bl_rna.properties["shadow_method"].enum_items.keys())
except: pass

info["principled_distribution"] = []
try:
    info["principled_distribution"] = list(bpy.types.ShaderNodeBsdfPrincipled.bl_rna.properties["distribution"].enum_items.keys())
except: pass

info["principled_subsurface"] = []
try:
    info["principled_subsurface"] = list(bpy.types.ShaderNodeBsdfPrincipled.bl_rna.properties["subsurface_method"].enum_items.keys())
except: pass

info["color_management"] = []
try:
    info["color_management"] = list(bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items.keys())
except: pass

info["space_types"] = list(bpy.types.Space.bl_rna.properties["type"].enum_items.keys())

info["constraint_types"] = [c for c in dir(bpy.types) if "Constraint" in c and not c.startswith("_")][:30]

info["modifier_types"] = [m for m in dir(bpy.types) if "Modifier" in m and not m.startswith("_")][:40]

info["particle_types"] = []
try:
    info["particle_types"] = list(bpy.types.ParticleSettings.bl_rna.properties["type"].enum_items.keys())
except: pass

info["physics_types"] = []
try:
    info["physics_types"] = list(bpy.types.PointCache.bl_rna.properties["point_caches"].enum_items.keys()) if hasattr(bpy.types, "PointCache") else []
except: pass

info["material_blend_methods"] = []
try:
    for prop_name in ["blend_method", "surface_render_method"]:
        if hasattr(bpy.types.Material.bl_rna.properties, prop_name):
            info["material_blend_methods"] = list(bpy.types.Material.bl_rna.properties[prop_name].enum_items.keys())
            info["material_blend_prop_name"] = prop_name
            break
except: pass

info["uv_project_methods"] = []
try:
    info["uv_project_methods"] = list(bpy.types.UVProjectModifier.bl_rna.properties["projector_count"].enum_items.keys()) if hasattr(bpy.types, "UVProjectModifier") else []
except: pass

info["blender_version"] = list(bpy.app.version)
info["blender_version_string"] = bpy.app.version_string

output = json.dumps(info, indent=2)
print("ENUM_DUMP_START")
print(output)
print("ENUM_DUMP_END")
