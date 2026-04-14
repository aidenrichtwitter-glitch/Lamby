import bpy

def enable_gpu(device_type="OPTIX", use_cpu=False):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = device_type
    prefs.get_devices()
    for device in prefs.devices:
        if device.type == "CPU":
            device.use = use_cpu
        else:
            device.use = True
    bpy.context.scene.cycles.device = "GPU"
    print(f"GPU enabled: {device_type} | Devices: {[d.name for d in prefs.devices if d.use]}")

enable_gpu(device_type="OPTIX")
