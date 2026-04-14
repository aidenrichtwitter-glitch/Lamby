import bpy
import json

info = {}

# Get ALL registered render engines
engines = []
for engine in bpy.types.RenderEngine.__subclasses__():
    engines.append(engine.bl_idname)
info["registered_engines"] = engines

# Get engine via scene
info["current_engine"] = bpy.context.scene.render.engine

# Try setting each engine
valid = []
for e in ["BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES", "BLENDER_WORKBENCH"]:
    try:
        bpy.context.scene.render.engine = e
        valid.append(e)
    except:
        pass
info["valid_engine_values"] = valid

# Principled BSDF input names (critical for scripting)
mat = bpy.data.materials.new("__test__")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
if bsdf:
    info["principled_bsdf_inputs"] = {inp.name: inp.type for inp in bsdf.inputs}
    info["principled_bsdf_outputs"] = {out.name: out.type for out in bsdf.outputs}
bpy.data.materials.remove(mat)

# Color ramp node outputs
info["colorramp_outputs"] = []
try:
    m2 = bpy.data.materials.new("__test2__")
    m2.use_nodes = True
    ramp = m2.node_tree.nodes.new("ShaderNodeValToRGB")
    info["colorramp_outputs"] = {out.name: out.type for out in ramp.outputs}
    info["colorramp_inputs"] = {inp.name: inp.type for inp in ramp.inputs}
    bpy.data.materials.remove(m2)
except: pass

# Displacement node
info["displacement_inputs"] = []
try:
    m3 = bpy.data.materials.new("__test3__")
    m3.use_nodes = True
    disp = m3.node_tree.nodes.new("ShaderNodeDisplacement")
    info["displacement_inputs"] = {inp.name: inp.type for inp in disp.inputs}
    bpy.data.materials.remove(m3)
except: pass

# Volume nodes
info["volume_nodes"] = [n for n in dir(bpy.types) if "Volume" in n and "ShaderNode" in n]

# Geometry nodes
info["geometry_nodes"] = [n for n in dir(bpy.types) if n.startswith("GeometryNode")][:50]

print("ENGINE_DUMP_START")
print(json.dumps(info, indent=2))
print("ENGINE_DUMP_END")
