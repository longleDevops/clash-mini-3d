# Blender pipeline for hero bodies

Heroes can get their body meshes from Blender while everything that moves stays in
code. The game loads a body GLB, re-homes each mesh onto the code rig in the rest
pose, and the existing clips, painted faces, staff and skills keep working.

| Stays in code | Comes from Blender |
| --- | --- |
| Rig: bone names, pivots, rest rotations (`src/characters/<hero>/model.js`) | Body meshes, in the rest pose |
| Animation clips (`clips.js`), secondary motion (tail, hair, ears) | Materials (Principled BSDF) |
| Painted face expressions (`FaceCanvas`, `face.js`) | |
| Props with effects (Lyra's staff), VFX anchors | |

Loader and exporter: `src/characters/bodyAsset.js`.

## Files

- `tools/blender/<hero>_blockout.glb`: the code-built model exported for Blender.
  It has one empty per bone (exact bone names, rest pose) with the code meshes
  parented to them, and materials named by role. Start every Blender model from it.
  Regenerate with `node tools/blender/export-blockout.mjs lyra` (needs `npm install`).
- `assets/<hero>/<hero>.glb`: the Blender body the game loads. For Lyra that is
  `assets/lyra/lyra.glb`. `npm run build` embeds it in the artifact page; `npm run dev`
  fetches it. If it is missing or fails to load, the hero falls back to the code body.
- `tools/blender/<hero>/`: Blender sources. Prefer a headless build script
  (`build_<hero>.py`) so the model is reproducible; `.blend` files are git-ignored.
  Preview renders go in `tools/blender/<hero>/previews/`.
- `tools/blender/compare.html`: side-by-side check of the code body and the Blender
  body in the game's renderer, in any clip and pose. With `npm run dev` running, open
  `http://localhost:5173/tools/blender/compare.html?glb=/assets/lyra/lyra.glb&pose=skill:0.7`.

## Rules for a body GLB

1. **Scale and axes.** 1 Blender unit = 1 m = 1 game world unit = 100 model units.
   Lyra stands on the origin, about 1.0 m tall (about 1.2 m to the ear tips), facing
   **-Y** in Blender (front view looks at her face). Her left side (`armL`, `earL`) is
   **+X**. Export with the glTF default **+Y Up**; that maps -Y to the game's +Z front.
2. **Rest pose.** Keep the blockout's bone empties exactly as imported: do not move,
   rotate, rename, re-parent or apply transforms on them. Model in the blockout's pose
   (arms angled down and forward, staff in the left hand).
3. **Bone assignment.** Each mesh object must be a child (direct or nested) of the
   empty for the bone that should move it. A custom property `bone = "<bone name>"`
   on an object also works (exported as glTF extras). A mesh with no bone lands on
   `base` with a console warning. Blender's `.001` name suffixes are fine.
   Meshes are rigid per bone in this version (no armature or weights), so hide joints
   with overlaps the way the blockout does (sleeve over the forearm, boot cuffs,
   collar, skirt over the thighs). Split a part at the pivot when it spans two bones
   (the tail is three pieces).
4. **Face.** The front of the head uses a material named exactly **`face`**, either a
   material slot on the head mesh or a separate face patch under `head`. The game
   swaps it for the painted expressions and projects UVs straight from the front in
   head-bone space: x from -0.22 to +0.22 m, y from 0.00 to 0.40 m above the head
   bone. Eyes are painted at x = +/-0.086, y = 0.168 (each spans y 0.121 to 0.215);
   the mouth at y = 0.096; blush at x = +/-0.125, y = 0.124. Keep that area smooth
   and gently curved, with no modelled eyes, nose or mouth, and keep the fringe tips
   at or above y = 0.21 over the eyes.
5. **Props.** Meshes under `prop` (Lyra's staff) are ignored; the staff stays in
   code because its gem glow and flames are animated effects.
6. **Materials.** Principled BSDF only: Base Color, Roughness, Metallic, Emission
   (gems), and optional vertex colours for gradients (the fur fades lilac to white).
   No image textures in this version, to keep the page small. Turn on backface
   culling for closed meshes and leave it off only for thin shells (hair curtain,
   skirt layers, sleeve linings). Keep the role names below so materials stay legible.
7. **Budget.** Body about 12k to 25k triangles (the sheet's LOD0 target is 6k to 10k;
   heroes are shown close up in the Heroes screen) and under about 2 MB. Apply
   modifiers on export, use smooth shading, and no Draco or meshopt compression.
8. **Export.** `bpy.ops.export_scene.gltf(filepath='assets/lyra/lyra.glb',
   export_format='GLB', export_yup=True, export_apply=True, export_animations=False,
   export_skins=False)`. Export only the body hierarchy (bone empties plus meshes),
   not cameras, lights or reference images.

## Skinned bodies (optional)

A body can instead be one weighted mesh with its own armature, for example from an
image-to-3D tool. Name its bones like the rig (`upper_arm.L`, `forearm.L`, `hand.L`,
`thigh.L` and so on are mapped automatically), put it in the blockout's rest pose and
apply that as its rest pose, and export with `export_skins=True`. Each GLB bone named
like a rig bone follows that code bone through a fixed rest offset; other bones (root,
clavicles, toes) follow their parents. The face material swap does not apply here,
so a skinned body keeps whatever face it has painted in its texture.

## Lyra's bones

| Bone | Carries |
| --- | --- |
| `base`, `hips` | root; nothing visible (thigh tops sit under the skirt) |
| `spine` | obi sash, gold piping, flower knot, ribbon tails |
| `chest` | torso, layered V collar |
| `neck` | neck |
| `head` | head with the `face` material, hair cap, fringe, side locks, tiara and gem, flowers, bells |
| `hairBack` | long wavy back hair (sways) |
| `earL`, `earR` | fox ears with inner fluff (twitch) |
| `armL`, `armR` | shoulder and the hanging furisode sleeve with lining and trims |
| `foreArmL`, `foreArmR` | forearm and cuff |
| `handL`, `handR` | hands (`handL` holds the staff) |
| `skirt` | under-skirt, over-skirt, trims, emblem |
| `thighL/R`, `shinL/R` | stockings |
| `footL`, `footR` | boots with cuffs and soles |
| `tail0`, `tail1`, `tail2` | the fox tail in three pieces, tip on `tail2` (sways) |
| `prop` | the staff (code; ignored in the GLB) |

Material roles from the blockout: `skin`, `face`, `hair`, `hairDeep`, `kimono`,
`sleeve`, `lining`, `rose`, `roseSkirt`, `underSkirt`, `blush`, `gold`, `amber`,
`fur`, `furTip`, `earInner`, `lilac`, `boot`, `sole`, `gem`, `dark`, `emblem`.
Palette (from the model sheet): night `#2B2540`, indigo `#3A2A5E`, violet `#6A4AB3`,
orchid `#C57CFF`, rose `#FF6EB4`, blush `#FFE3F4`, gold `#FFD45C`, amber `#E6A42A`,
peach `#F5C97A`, white `#FFFFFF`, lilac `#E4D9FF`, brown `#5B3E2E`, taupe `#8B6D5A`,
skin `#F8D6C0`.
