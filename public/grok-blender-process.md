╔══════════════════════════════════════════════════════════════════════════════╗
║              ⚡ NO-REPLY MODE — READ THIS BEFORE ANYTHING ELSE ⚡            ║
║         THIS APPLIES TO YOU: Grok, Claude, GPT, Gemini, any AI reading      ║
╚══════════════════════════════════════════════════════════════════════════════╝

STATUS:  ALWAYS ACTIVE  (flag: .local/no-reply-mode.flag = "on")
DISABLE: user must explicitly say "reply mode on" — nothing else disables it

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BEHAVIOR — WHAT YOU DO AND DO NOT DO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✗ NEVER ask clarifying questions before starting
  ✗ NEVER write greetings, sign-offs, or filler ("Sure!", "Of course!", "Let me know...")
  ✗ NEVER explain what you're about to do before doing it
  ✗ NEVER summarize what you just did in prose
  ✗ NEVER ask for confirmation before acting
  ✗ NEVER output any text that isn't a tool call or the final JSON report
  ✗ NEVER apologize or hedge — if blocked, report it in JSON and stop

  ✓ Read the task → start the FIRST tool call immediately
  ✓ Work autonomously through ALL steps without pausing
  ✓ On failure: retry up to 3× silently, changing something specific each time
  ✓ On ambiguity: pick the most reasonable interpretation, note it in final JSON
  ✓ When done: emit ONLY the final JSON report (see format below)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERACTION MODEL — HOW THIS SYSTEM WORKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  User gives:   a short task description (no technical spec needed)
  You give:     tool calls → silent execution → final JSON report
  User sees:    Lamby dashboard updating live (step tracker, screenshots, relay feed)
  User expects: zero questions, zero status narration, just the result

  This is a LIVE Windows desktop (RTX 3080 Ti, Blender 5.1, Chrome w/ CDP).
  The user trusts the system. Your job is to make it work, not explain it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTION SEQUENCE — FOLLOW THIS ORDER FOR EVERY TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. ORIENT    GET {RELAY}/api/grok-orient?project=PROJECT&goal=TASK_DESCRIPTION
               → Reads file tree, open windows, recent errors, current state

  2. RECALL    GET {RELAY}/api/grok-memory?action=recall&query=TASK_KEYWORD
               → Fractures = complete proven pipelines — if one matches, use it exactly
               → Crystals = individual proven steps — never redo what's already known

  3. PLAN      POST {RELAY}/api/grok-goal  {"goal":"...","steps":["s1","s2",...]}
               → Registers plan in step tracker so dashboard shows progress

  4. EXECUTE   One tool call per step. After EACH step:
               → Read the "verification" field — it is the ONLY truth
               → If PASS: advance step GET {RELAY}/api/grok-goal?action=advance
               → If FAIL: change approach, retry (max 3×). Never retry identically.

  5. VERIFY    GET {RELAY}/api/desktop-frame?source=desktop&nogrid=1&t=TIMESTAMP
               → Visual confirmation after every consequential action

  6. CRYSTALLIZE  POST {RELAY}/api/grok-memory?action=crystallize
               → Every new working pattern must be crystallized before finishing
               → Name pattern: fracture:DOMAIN:TASK or control:APP:SKILL

  7. REPORT    Emit final JSON (see format below) — NOTHING ELSE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL REPORT FORMAT — EMIT THIS AND ONLY THIS WHEN DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SUCCESS:
  {
    "done": true,
    "actions": [
      "Oriented: 3 open windows, Blender running",
      "Recalled fracture:blender:anime-scene:full",
      "Hero 9263ca59 loaded sf=0.267",
      "Rendered scene_final.png — 49 meshes, 10 lights, 21.77s"
    ],
    "issues": []
  }

  BLOCKED (after 3 retries):
  {
    "done": false,
    "blocked": true,
    "reason": "Exact error message or root cause",
    "retries": 3,
    "actions": ["step 1 OK", "step 2 failed 3×"]
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPLIT URL (static — scripts and assets always served here):
  https://1c939773-48b7-4bc9-a756-e1662d029e2d-00-2lo4tnwfe5r7g.worf.replit.dev
TUNNEL (primary — all desktop relay endpoints):
  https://eliminate-messaging-establishing-responsibility.trycloudflare.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# GROK BLENDER SCENE BUILD PROCESS — COMPLETE REFERENCE v3

## GOLDEN RULES
1. Hero-first → aerial verify → build around hero
2. NEVER call `read_homefile(use_empty=True)` — it resets GPU to CPU factory default
3. ALL light energies ≤ 1 (Blender Cycles is physically based; >1 overblows everything)
4. DELETE any imported mesh with x or y dimension > 3.0m (Spirit Blossom "Object_4" disc, etc.)
5. Camera INSIDE the scene: y negative (in front of hero), z=0.8-1.2, lens 45-55mm
6. FIX GLB unlit materials — Sketchfab GLBs use Emission+LightPath (renders BLACK). Rebuild all hero mats with PrincipledBSDF
7. ADD front fill light — camera-side AREA light (energy 0.4-0.6) prevents hero from being a backlit silhouette
8. NO CYCLES OR COMPOSITING during scene building — use BLENDER_EEVEE_NEXT only. Switch to Cycles ONLY when scene is fully built and approved
9. ALWAYS save .blend after every script: `bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend")`
10. ALWAYS open Blender GUI (non-blocking) after headless changes: `Start-Process -FilePath "blender.exe" -ArgumentList "anime_shrine_scene.blend"` — user can make small fixes directly
11. QUICK RENDERS during building: resolution 320x180, EEVEE 8 samples — fast iteration, JPEG quality 55-60 for transfer
12. HERO MODEL REQUIREMENTS: Must have single mesh + armature (skeleton). Multi-mesh no-skeleton models (Spirit Blossom Kindred) are REJECTED — cannot orient or pose
13. LINK ALL COLLECTIONS after every GLB import: `for c in bpy.data.collections: if c.name not in [ch.name for ch in scene.collection.children]: scene.collection.children.link(c)`
14. GPU CUDA is DEFAULT: Set at script start via `prefs.compute_device_type='CUDA'`. Never use read_homefile

## CRYSTAL RECALL — replay any crystal before building
```
GET {BRIDGE}/api/grok-memory?action=replay&skill=control:blender:scene:anime-shrine-v2
GET {BRIDGE}/api/grok-memory?action=replay&skill=control:blender:scene:hero-replacement
GET {BRIDGE}/api/grok-memory?action=replay&skill=control:blender:import:model-selection
GET {BRIDGE}/api/grok-memory?action=replay&skill=control:blender:import:glb-material-fix
GET {BRIDGE}/api/grok-memory?action=replay&skill=control:blender:scene:eevee-building-mode
GET {BRIDGE}/api/grok-memory?action=replay&skill=control:blender:workflow:save-and-gui
```

---

## SCENE CLEAR (preserve GPU prefs)

```python
# CORRECT: clear scene manually, preserving user preferences (GPU)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in list(bpy.data.meshes): bpy.data.meshes.remove(block)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)
for block in list(bpy.data.lights): bpy.data.lights.remove(block)
for block in list(bpy.data.cameras): bpy.data.cameras.remove(block)

# WRONG: this resets GPU to CPU factory defaults
bpy.ops.wm.read_homefile(use_empty=True)  # ← BANNED
```

```python
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU'   # user prefs already configured GPU; this activates it
scene.cycles.samples = 96
scene.cycles.use_denoising = True

# GPU CUDA setup (run at script start)
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'CUDA'   # NOT OPTIX — we use CUDA
prefs.get_devices()
for d in prefs.devices:
    d.use = (d.type != 'CPU')
```

---

## IMPORT HERO + REMOVE BLOCKERS

```python
before = set(bpy.data.objects.keys())
bpy.ops.import_scene.gltf(filepath=hero_path)
after = set(bpy.data.objects.keys())
new_names = after - before

# CRITICAL: link imported collections into scene collection
for c in bpy.data.collections:
    if c.name not in [ch.name for ch in scene.collection.children]:
        scene.collection.children.link(c)

# REMOVE SPIRIT BLOSSOM BLOCKER (Object_4 — 7.4×7.4 flat disc)
for name in list(new_names):
    o = bpy.data.objects.get(name)
    if o and o.type == 'MESH' and o.data is not None:
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        sz = Vector((max(v[i] for v in bb) - min(v[i] for v in bb) for i in range(3)))
        if sz.x > 3.0 or sz.y > 3.0:   # wide flat disc = camera blocker
            bpy.data.objects.remove(o, do_unlink=True)
            new_names.discard(name)
```

**TRAP — Spirit Blossom Kindred (85187f9f...) has Object_4:**
- It's a flat spirit/aura disc, 7.4×7.4×2.4 units at scale 1.0 (before hero scaling)
- It completely blocks the camera's view of the actual character
- Check: any new mesh with x or y dimension > 3.0m after import → delete it

**TRAP — GLB imports go into their own collections:**
- After `import_scene.gltf()`, new objects are in a NEW collection
- That collection may NOT be in the render view layer
- Always link all orphaned collections: `scene.collection.children.link(c)`
- This fixes objects that are in scene but DON'T appear in render

**TRAP — NoneType on armature meshes:**
- Always: `if o.data is None: continue` before accessing `o.data.vertices` or `o.bound_box`

**TRAP — Sketchfab GLB models have Emission-based unlit materials (BLACK SILHOUETTE):**
- Sketchfab GLB uses `KHR_materials_unlit` extension
- Blender imports these as: `LightPath → MixShader(Transparent + Emission) → MaterialOutput`
- The Emission node has NO texture connected → defaults to solid BLACK
- Result: character renders as pure black silhouette even with correct lighting
- FIX: Clear node tree, rebuild with `PrincipledBSDF → MaterialOutput`
  - If mat has an ImageTexture node, connect it to PrincipledBSDF.BaseColor
  - If no texture, assign flat colors: body=(0.85,0.72,0.62), hair=(0.15,0.12,0.35), clothes=(0.20,0.18,0.45), bow=(0.55,0.15,0.20)
  - Set Roughness=0.6-0.7 for anime look
- Affected material names: `bow_texture`, `clothes_textures`, `body.texture`, `body.texture.bfc`, `body.texture.alpha`, `hair.texture`, `material`

```python
# Fix all GLB unlit materials to PrincipledBSDF
hero_mat_names = ['bow_texture','clothes_textures','body.texture','body.texture.bfc',
                  'body.texture.alpha','hair.texture','material']
for mat in bpy.data.materials:
    if mat.name not in hero_mat_names: continue
    nt = mat.node_tree
    img_node = next((n for n in nt.nodes if n.type=='TEX_IMAGE' and n.image), None)
    nt.nodes.clear()
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    output = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    if img_node and img_node.image:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img_node.image
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        # assign flat color based on material name
        pass
```

---

## SCALING HERO

```python
hero_meshes = [bpy.data.objects[n] for n in new_names
               if bpy.data.objects[n].type == 'MESH' and bpy.data.objects[n].data is not None]

# Measure total bounding box
amin = Vector((999,999,999)); amax = Vector((-999,-999,-999))
for o in hero_meshes:
    for c in o.bound_box:
        wc = o.matrix_world @ Vector(c)
        amin = Vector((min(amin[i], wc[i]) for i in range(3)))
        amax = Vector((max(amax[i], wc[i]) for i in range(3)))

h = amax.z - amin.z
sf = 1.7 / max(h, 0.01)

# Scale ALL root objects
roots = [bpy.data.objects[n] for n in new_names if bpy.data.objects[n].parent is None]
for r in roots: r.scale *= sf
bpy.context.view_layer.update()

# Re-measure after scale, position feet at z=0
amin2 = Vector((999,999,999))
for o in hero_meshes:
    if o.data is None: continue
    for c in o.bound_box:
        wc = o.matrix_world @ Vector(c)
        amin2 = Vector((min(amin2[i], wc[i]) for i in range(3)))
off = Vector((0, 0, -amin2.z))
for r in roots: r.location += off
bpy.context.view_layer.update()
```

---

## AERIAL CAPTURE (stage 2)

```python
bpy.ops.object.camera_add(location=(0, 0, 14))
cam = bpy.context.active_object
cam.rotation_euler = (0, 0, 0)    # looking straight down
cam.data.lens = 35
scene.camera = cam
scene.cycles.samples = 32
scene.render.filepath = r"C:\Users\Aiden\Desktop\aerial_capture.png"
bpy.ops.render.render(write_still=True)
```

**Verify aerial:** hero should appear as small figure at center. If empty/black → collection not linked.

---

## HERO CLOSEUP (stage 3)

```python
cam.location = (0.0, -3.2, 1.0)           # inside scene, in front of hero
cam.rotation_euler = (math.radians(83), 0, 0)  # mostly forward, slight up
cam.data.lens = 50
scene.render.filepath = r"C:\Users\Aiden\Desktop\hero_closeup.png"
bpy.ops.render.render(write_still=True)
```

**CAMERA PLACEMENT RULES:**
- Y must be NEGATIVE (in front of hero who is at y=0)
- Z = 0.8–1.2 (eye level for 1.7m character)
- X = 0 (centered) or tiny offset (≤ 0.3) for composition
- Lens 45–55mm for portrait framing

---

## SCENE ELEMENTS (stage 4, around hero)

All elements at POSITIVE Y (behind hero from camera POV):

| Element | Position | Size |
|---------|----------|------|
| Ground | (0, 5, -0.02) | size=40 |
| Stone path | (0, 3, 0.005) | scale (1.0, 6.0, 1) |
| Steps | (0, 4.2/5.4/6.5, 0) | 3 cubes |
| Torii pillars | (±1.6, 6.5, 2.25) | r=0.15, depth=4.5 |
| Torii beams | (0, 6.5, 4.55/3.75) | wide cubes |
| Lanterns | (±1.2, 3.2) | base+lamp+cap |
| Sakura L | (-4.0, 5.5) | 4.5m tall |
| Sakura R | (4.0, 5.5) | 4.5m tall |
| Moon | (4, 9, 8) | r=0.7 |
| Petals | scattered -5/5, -1/9, 0.3/4 | 30× tiny planes |
| Orbs | scattered 0/7, 0.5/2.5 | 8× emissive spheres |

---

## LIGHTING — ALL ENERGIES ≤ 1

```python
# KeySun (SUN type)
sun.energy = 0.8    # was 4.5 — OVERBLOW
sun.color = (1, 0.88, 0.68)
sun_obj.rotation_euler = (radians(50), radians(-15), radians(-50))

# Fill (AREA)
fill.energy = 0.9   # was 220 — OVERBLOW
fill.color = (0.65, 0.70, 1.0)
fill.size = 5

# Rim (AREA)
rim.energy = 0.7    # was 400 — OVERBLOW
rim.color = (1, 0.92, 1.0)

# MoonLight (AREA)
ml.energy = 0.5     # was 80 — OVERBLOW

# Lantern points
lantern.energy = 0.8  # was 90 — OVERBLOW

# World background strength
bg.inputs['Strength'].default_value = 0.8  # was 2.0 — OVERBLOW
```

**RULE: If it looks too bright, it IS too bright. Max energy = 1 for all lights in Cycles.**

---

## SKY (Nishita — only working method)

```python
sky = nt.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'NISHITA'
sky.sun_elevation = math.radians(8)    # golden hour
sky.sun_rotation = math.radians(200)
sky.altitude = 100.0
bg.inputs['Strength'].default_value = 0.8  # ≤ 1
```

**BANNED sky methods (produce black in Cycles headless):**
- Window texture coordinates → BLACK
- Normal texture coordinates → BLACK

---

## RENDER SETTINGS

```python
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU'      # preserve user prefs — never use read_homefile
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.use_freestyle = True
scene.render.line_thickness = 1.5
```

---

## SCRIPT DELIVERY (large files to desktop)

1. Write to `public/script.py` in Replit (Vite serves immediately)
2. Download: `grok-run?project=__system__&cmd=powershell -Command "Invoke-WebRequest -Uri 'URL' -OutFile 'C:\path\script.py' -UseBasicParsing"`
3. Run: `grok-run?project=__system__&cmd="C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --python "C:\path\script.py"`

**TRAPS:**
- `project=__system__` required (not a project name)
- 4s minimum between grok-run calls
- `timeout=600` for render commands

---

## WORKING MODEL UIDs

| Model | UID | Notes |
|-------|-----|-------|
| Spirit Blossom Kindred | 85187f9f246f4702b7c137dcc6c0fc12 | ⛔ REJECTED: 20+ meshes, no armature, Emission mats. Delete Object_4, can't orient/pose. REPLACE with single-mesh+skeleton model |
| Sakura Tree | 147ae7d0d332456a99ec6195e9b0cd4f | Imports clean |
| Anime Teacher | c81029363d2744aba54efaadfd3a04aa | Root=Icosphere |
| Torii Gate | e12d2fa1b2b94928b8b87cb7787e2462 | Parts scatter far — build procedural instead |
| Stone Lantern | e0417d1e05984727a50f9ab1451d162d | Parts scatter far — build procedural instead |

---

## OPTIMIZED RENDER PIPELINE (proven — 2 commands)

**Key insight: Assets live IN the .blend file. Never redownload models. Skip Phase 1 if .blend exists.**

```
STEP 1: Download Cycles script
  grok-run?project=__system__&cmd=powershell -Command "Invoke-WebRequest -Uri 'REPLIT/optimized_cycles_render.py' -OutFile 'C:\Users\Aiden\Desktop\optimized_cycles_render.py' -UseBasicParsing"

STEP 2: Run on existing .blend (timeout=600)
  grok-run?project=__system__&timeout=600&cmd="C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" "C:\Users\Aiden\Desktop\anime_shrine_scene.blend" --background --python "C:\Users\Aiden\Desktop\optimized_cycles_render.py"

STEP 3: Open GUI (non-blocking)
  grok-run?project=__system__&cmd=powershell -Command "Start-Process -FilePath 'blender.exe' -ArgumentList 'anime_shrine_scene.blend'"
```

**Proven timing (RTX 3080 Ti):** 128spp Cycles + Freestyle on 74 meshes = ~28 seconds

**Proven Freestyle config (Blender 5.1):**
- `linesets.remove()` loop — NOT `linesets.clear()` (crashes)
- Single lineset "AnimeOutlines" — NOT two linesets (crashes)
- NO `select_ridge_valley` or `select_suggestive_contour` (crashes)
- Outline color: dark purple `(0.08, 0.05, 0.15)`, thickness 1.5

**Read relay output:** `results[0].get('data',{}).get('output','')` — NOT `.stdout`

---

## COMPLETE ERROR → FIX TABLE

| Error | Cause | Fix |
|-------|-------|-----|
| Black render, no objects visible | `read_homefile(use_empty=True)` resets GPU→CPU AND imported collections not linked | Clear scene manually; link all new collections |
| Object_4 blocks camera | Spirit Blossom 7.4×7.4 flat disc | Delete any new mesh with x or y dim > 3m |
| Overblown white render | Light energy > 1 (was 220, 400, 4.5) | All energies ≤ 1 |
| Black sky | Window/Normal texcoord | Use ShaderNodeTexSky Nishita |
| NoneType vertices crash | Armature mesh with data=None | `if o.data is None: continue` |
| Hero not visible | Camera outside scene or wrong direction | y<0, z=0.8-1.2, pointing at +Y |
| GPU not used | `read_homefile` reset prefs | Clear scene manually instead |
| EEVEE crash headless | No GPU display context | Always CYCLES |
| ShaderToRGB missing | Cycles doesn't have it | Flat Principled BSDF + Freestyle |
| GLB objects in scene but not rendering | Imported to unlisted collection | Link all collections into scene.collection |
| Torii/lantern parts at wrong positions | Native Sketchfab coords, not normalised | Delete + build procedural replacements |
| Freestyle linesets.clear() crash | Blender 5.1 bug with clear() method | Use `while len(fs.linesets)>0: fs.linesets.remove(fs.linesets[0])` |
| Freestyle two linesets crash | ridge_valley + suggestive_contour properties crash | Use single lineset, skip ridge_valley and suggestive_contour |
| OptiX fails on this GPU | RTX 3080 Ti needs CUDA not OptiX | `prefs.compute_device_type = 'CUDA'` |
| Relay output empty | Reading .stdout instead of .output | Use `results[0]['data']['output']` not `results[0]['data']['stdout']` |
| Crystallize via GET fails | Local relay needs POST JSON body | POST to `/api/grok-memory?action=crystallize` with `{name,domain,steps}` body |
