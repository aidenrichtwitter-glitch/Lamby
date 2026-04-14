import bpy, json

info = {}

valid_engines = []
for e in ["BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES", "BLENDER_WORKBENCH", "BLENDER_GAME"]:
    try:
        bpy.context.scene.render.engine = e
        valid_engines.append(e)
    except: pass
bpy.context.scene.render.engine = "BLENDER_EEVEE"
info["valid_engines"] = valid_engines

mat = bpy.data.materials.new("__test__")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
if bsdf:
    info["principled_inputs"] = {inp.name: inp.type for inp in bsdf.inputs}
bpy.data.materials.remove(mat)

mat2 = bpy.data.materials.new("__test2__")
mat2.use_nodes = True
mix = mat2.node_tree.nodes.new("ShaderNodeMix")
info["mix_inputs"] = {inp.name: inp.type for inp in mix.inputs}
info["mix_data_type_default"] = mix.data_type
bpy.data.materials.remove(mat2)

info["volume_nodes"] = [n for n in dir(bpy.types) if "Volume" in n and "Node" in n]

print("DUMP_START")
print(json.dumps(info, indent=2))
print("DUMP_END")
