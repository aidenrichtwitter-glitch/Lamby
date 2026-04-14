import bpy, os, tempfile, zipfile, glob, shutil
from urllib.request import urlopen, Request
import json

SKETCHFAB_TOKEN = os.environ.get('SKETCHFAB_API_KEY', '')
if not SKETCHFAB_TOKEN:
    # Try reading from .env
    env_path = r'C:\Users\Aiden\Desktop\Lamby\.env'
    if os.path.exists(env_path):
        for line in open(env_path):
            if 'SKETCHFAB' in line and '=' in line:
                SKETCHFAB_TOKEN = line.split('=',1)[1].strip()

MODEL_UID = '1b34bb4a10ce4d6d9b984b783f075681'
MODEL_NAME = 'misato_katsuragi'

print(f"Downloading {MODEL_NAME} ({MODEL_UID})...")

headers = {'Authorization': f'Token {SKETCHFAB_TOKEN}'}
req = Request(f'https://api.sketchfab.com/v3/models/{MODEL_UID}/download', headers=headers)
resp = urlopen(req, timeout=30)
data = json.loads(resp.read())
dl_url = data['gltf']['url']
print(f"  Download URL obtained")

# Download zip
req2 = Request(dl_url)
zip_data = urlopen(req2, timeout=60).read()
zip_path = os.path.join(tempfile.gettempdir(), f'{MODEL_NAME}.zip')
with open(zip_path, 'wb') as f:
    f.write(zip_data)
print(f"  Downloaded {len(zip_data)} bytes")

# Extract
extract_dir = os.path.join(tempfile.gettempdir(), MODEL_NAME)
if os.path.exists(extract_dir):
    shutil.rmtree(extract_dir)
with zipfile.ZipFile(zip_path) as z:
    z.extractall(extract_dir)

# Find glTF/glb
gltf_files = glob.glob(os.path.join(extract_dir, '**', '*.gltf'), recursive=True)
glb_files = glob.glob(os.path.join(extract_dir, '**', '*.glb'), recursive=True)
import_file = (gltf_files + glb_files)[0] if (gltf_files + glb_files) else None

if not import_file:
    print("ERROR: No glTF/glb found")
    raise SystemExit(1)

print(f"  Importing: {os.path.basename(import_file)}")

# Import
bpy.ops.import_scene.gltf(filepath=import_file)

# Find imported objects
imported = [o for o in bpy.context.selected_objects]
print(f"  Imported {len(imported)} objects")

# Measure
from mathutils import Vector
bb_min = Vector((float('inf'),)*3)
bb_max = Vector((float('-inf'),)*3)
for o in bpy.data.objects:
    if o.type != 'MESH': continue
    for corner in o.bound_box:
        wc = o.matrix_world @ Vector(corner)
        for i in range(3):
            bb_min[i] = min(bb_min[i], wc[i])
            bb_max[i] = max(bb_max[i], wc[i])

h = bb_max[2] - bb_min[2]
w = max(bb_max[0] - bb_min[0], bb_max[1] - bb_min[1])
print(f"  Native size: h={h:.2f}m, w={w:.2f}m")
print(f"  Done!")
