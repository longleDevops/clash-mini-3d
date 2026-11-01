import { registerUnit } from '../registry.js';
import { buildLyra } from './model.js';
import { LYRA_CLIPS } from './clips.js';
import { LYRA_EXPRESSIONS } from './face.js';
import { LYRA_PALETTE } from './palette.js';

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
  build: buildLyra,
  clips: LYRA_CLIPS,
  expressions: LYRA_EXPRESSIONS,
  defaultExpression: 'neutral',
  palette: LYRA_PALETTE,
  sheet: { heightHeads: 2.5, gameHeight: '100u', head: '40u', body: '60u', style: 'Chibi / Clash-like 3D' },
  portrait: { target: [0, 0.8, 0], distance: 1.25, fov: 26 },
});
