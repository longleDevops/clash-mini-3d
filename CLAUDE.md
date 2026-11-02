# Working on Skyward Minis

Original chibi 3D auto-battler (Clash Mini genre, our own characters and UI).
Do not copy names, characters or art from existing games.

## One shared artifact
All playable builds go to ONE artifact: https://claude.ai/artifact/3WeYPu5nEHGo4ZYn2Y3hEB
After every change: `npm run build`, then publish `dist/skyward-minis.html` to that
URL (pass it as `url` from a new conversation). Never create a second game artifact.

## Workstreams (keep them separate)
- Characters + skills: `src/characters/`, `src/skills/`, `src/fx/`, studio screen.
- Maps + scenes: `src/maps/` only, through the interface in `src/maps/registry.js`.
  The placeholder `trainingGrounds.js` is meant to be replaced; keep the board
  anchor at 8x4 tiles and provide `cameras.battle` / `cameras.home`.

## Conventions
- Landscape 16:9. UI is authored at 1280x720 (`src/ui/styles.css`) and scaled.
- Model units: 1u = 0.01 world units; heroes are ~100u tall (2.5 heads).
- Shared bone names (`src/characters/rig/Rig.js`) so clips can be reused.
- Clips are degree offsets from the rest pose (`rig/Animator.js`); one-shots
  emit events like `release` that skills await to time projectiles.
- Faces are painted canvases (`FaceCanvas.js`); the head's front face uses
  planar UVs, so draw features in head units.
- Skills are data + `async cast(ctx)`; `ctx` comes from `BattleController.skillContext`.
- Hero bodies can come from Blender (`assets/<hero>/<hero>.glb`, loaded by
  `src/characters/bodyAsset.js`); the rig, clips, face and props stay in code. The
  contract, blockout export and compare page are in `tools/blender/README.md`. Blender
  runs on the user's Mac mini through Remote Control (headless `blender -b`).

## Checking changes
`npm run dev`, then open http://localhost:5173. Headless Chromium works with
`--use-gl=angle --use-angle=swiftshader` (slow; raise the battle clock scale in tests).
`node scripts/build-artifact.mjs --check` verifies the bundle builds.
