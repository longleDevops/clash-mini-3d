import { registerUnit } from '../registry.js';
import { buildLyra } from './model.js';
import { LYRA_CLIPS } from './clips.js';
import { LYRA_EXPRESSIONS } from './face.js';
import { LYRA_PALETTE } from './palette.js';
import { loadBodyAsset } from '../bodyAsset.js';
import { bodyChoice } from '../bodyChoice.js';

// Body variants (tools/blender/README.md). The rig, clips, face and staff are shared;
// only the meshes differ. Missing GLBs load as null and drop out of the list.
//   blender:   scripted Blender model  (assets/lyra/lyra.glb)
//   generated: image-to-3D model       (assets/lyra/lyra_gen.glb)
const [blender, generated] = await Promise.all([loadBodyAsset('assets/lyra/lyra.glb'), loadBodyAsset('assets/lyra/lyra_gen.glb')]);
const BODIES = { code: null, blender, generated };
const DEFAULT_BODY = 'blender'; // Blender body (closer to the model sheet); Heroes > Model can switch back

export default registerUnit({
  id: 'lyra',
  name: 'Lyra',
  title: 'Spirit Sorceress',
  role: 'Mage',
  element: 'Arcane',
  rarity: 'Epic',
  team: 'hero',
  blurb: 'A fox-spirit mage who rings her charm bells to call foxfire and starlight.',
  stats: { hp: 1300, atk: 120, def: 32, spd: 110, range: 3, move: 2 },
  skills: { basic: 'lyra.spiritOrb', active: ['lyra.foxfireVolley', 'lyra.moonlitStarfall'], passive: 'lyra.spiritBells' },
  build: (opts = {}) => {
    const pick = opts.procedural ? 'code' : opts.body ?? bodyChoice.get('lyra', DEFAULT_BODY);
    return buildLyra({ glb: BODIES[pick] ?? null });
  },
  bodies: Object.keys(BODIES).filter((k) => k === 'code' || BODIES[k]),
  defaultBody: DEFAULT_BODY,
  clips: LYRA_CLIPS,
  expressions: LYRA_EXPRESSIONS,
  defaultExpression: 'neutral',
  palette: LYRA_PALETTE,
  sheet: { heightHeads: 2.5, gameHeight: '100u', head: '40u', body: '60u', style: 'Chibi / Clash-like 3D' },
  portrait: { target: [0, 0.8, 0], distance: 1.25, fov: 26 },
});
