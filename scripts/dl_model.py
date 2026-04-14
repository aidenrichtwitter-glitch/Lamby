import os, json, zipfile, glob, shutil
from urllib.request import urlopen, Request

env_path = r'C:\Users\Aiden\Desktop\Lamby\.env'
token = ''
for line in open(env_path):
    if 'SKETCHFAB_API_KEY' in line and '=' in line:
        token = line.split('=',1)[1].strip()
        break

uid = '1b34bb4a10ce4d6d9b984b783f075681'
name = 'misato'
models_dir = r'C:\Users\Aiden\Desktop\Lamby\models'
os.makedirs(models_dir, exist_ok=True)

print(f'Token length: {len(token)}')
print(f'Getting download URL for {uid}...')

req = Request(f'https://api.sketchfab.com/v3/models/{uid}/download',
              headers={'Authorization': f'Token {token}'})
resp = urlopen(req, timeout=30)
data = json.loads(resp.read())
dl_url = data['gltf']['url']
print(f'Got URL, downloading...')

zip_path = os.path.join(models_dir, f'{name}.zip')
req2 = Request(dl_url)
zip_data = urlopen(req2, timeout=120).read()
with open(zip_path, 'wb') as f:
    f.write(zip_data)
print(f'Downloaded {len(zip_data)} bytes')

extract_dir = os.path.join(models_dir, name)
if os.path.exists(extract_dir):
    shutil.rmtree(extract_dir)
with zipfile.ZipFile(zip_path) as z:
    z.extractall(extract_dir)

gltf = glob.glob(os.path.join(extract_dir, '**', '*.gltf'), recursive=True)
glb = glob.glob(os.path.join(extract_dir, '**', '*.glb'), recursive=True)
for f in gltf + glb:
    print(f'Found: {f}')
print('Done!')
