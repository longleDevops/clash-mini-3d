# Skyward Minis (working title)

An original turn-based 3D chibi auto-battler in the Clash Mini style, built with
Three.js and our own art direction (purple/indigo "toy" UI, landscape 16:9).
Everything is procedural, so the whole game ships as one web page.

**Play the latest build:** https://claude.ai/artifact/3WeYPu5nEHGo4ZYn2Y3hEB
(the shared project artifact; every change is republished to this same link)

## What's in this build

- **Lyra, Spirit Sorceress** (first hero), modelled from her model sheet:
  2.5 heads tall (head 40u + body 60u), fox ears, middle-parted indigo hair,
  flower + bell ornaments, layered kimono with obi flower knot, furisode
  sleeves, fox tail and her crescent staff. Palette = the sheet's 14 colours.
- **Rig + animation**: 28-bone humanoid rig; clips Idle, Walk, Attack, Skill,
  Hit, Die and Victory, plus procedural tail/ear/hair motion and blinking.
- **8 expressions** from the sheet: neutral, happy, surprised, angry, wink,
  laugh, sad, sleepy.
- **Skills**: Spirit Orb (basic), Foxfire Volley (50 energy), Moonlit
  Starfall (100 energy), Spirit Bells (passive).
- **Screens**: Home hub, Hero Studio (turntable, moves, faces, skills, model
  specs), Battle (formation -> rounds -> victory/defeat with rewards).
- **Placeholder** enemies (Shade Imp / Shade Brute) and a placeholder arena
  (Training Grounds) until the real roster and maps land.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (uses local three.js if installed)
npm run build      # -> dist/skyward-minis.html (artifact page) + dist/play.html
```

`index.html` loads the ES modules in `src/` directly (no build step needed to
develop). `npm run build` bundles `src/` with esbuild into one page; three.js is
loaded from jsDelivr through an import map.

## Code map

```
src/
  main.js                 entry: registers content, opens Home
  core/                   Game (renderer, 16:9 stage, screens), Clock, textures, save
  characters/
    registry.js           unit registry (heroes + enemies)
    Character.js          runtime model: animator, faces, blink, secondary motion
    rig/                  Rig (bones) + Animator (clip format, blending, events)
    parts.js, FaceCanvas.js  procedural building blocks + painted faces
    lyra/                 model, staff, face, clips, palette, definition
    shadeImp/             placeholder enemies
  skills/                 skill registry, Lyra's kit, enemy attacks
  fx/FxSystem.js          particles, projectiles, wisps, crescent moon, stars
  battle/                 Board (grid logic), BoardView, BattleController, stages
  maps/                   map registry + placeholder Training Grounds
  screens/                Home, Studio, Battle
  ui/                     styles.css, icons, overlay (HP bars, numbers), portraits
```

## Adding content

- **A hero**: create `src/characters/<id>/` with a `build()` that returns
  `{ root, rig, face?, anchors, secondary?, stats }` using the shared bone
  names (see `rig/Rig.js`), a clip set (see `rig/Animator.js` for the format),
  then `registerUnit({...})` and import it in `src/main.js`. Skills go in
  `src/skills/` via `registerSkill`.
- **A map**: implement the interface documented in `src/maps/registry.js`
  (sky, lights, set dressing, board anchor, camera framings) and register it.
  Maps never draw grid tiles or characters; the game adds those on top.
