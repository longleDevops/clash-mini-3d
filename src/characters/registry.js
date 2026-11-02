/**
 * Hero / unit registry. Each definition is plain data + a build() function:
 * {
 *   id, name, title, role, element, rarity, team: 'hero' | 'enemy',
 *   stats: { hp, atk, def, spd, range, move },
 *   skills: { basic, active: [ids], passive },
 *   build(opts) -> { root, rig, face?, anchors, secondary?, stats },
 *   clips: { idle, walk, attack, skill, hit, die, ... },
 *   expressions?: [...], defaultExpression?, portrait?: { distance, height }
 * }
 * Add a new hero by creating src/characters/<id>/index.js and calling registerUnit().
 */
const units = new Map();

export function registerUnit(def) {
  units.set(def.id, def);
  return def;
}

export function getUnit(id) {
  const d = units.get(id);
  if (!d) throw new Error(`Unknown unit "${id}"`);
  return d;
}

export function listUnits(filter = () => true) {
  return [...units.values()].filter(filter);
}
