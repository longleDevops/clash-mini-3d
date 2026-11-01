/**
 * Map registry — the plug-in point for the maps & scenes work.
 *
 * A map definition:
 * {
 *   id, name, placeholder?: boolean,
 *   create({ renderer, scene }) -> {
 *     root,                         // Object3D (already added to scene by the map)
 *     board: { center: Vector3, tile, cols: 8, rows: 4 },   // where the battle grid sits
 *     spots: { home: Vector3 },     // where the hero stands on the home screen
 *     cameras: {                    // camera framing per screen (landscape 16:9)
 *       battle: { pos: [x,y,z], look: [x,y,z], fov },
 *       home:   { pos, look, fov },
 *     },
 *     update?(dt, t), dispose?()
 *   }
 * }
 * The map owns sky, fog, lights and set dressing. Characters, grid tiles,
 * VFX and UI are added by the game on top.
 */
const maps = new Map();
let defaultId = null;

export function registerMap(def, { isDefault = false } = {}) {
  maps.set(def.id, def);
  if (isDefault || !defaultId) defaultId = def.id;
  return def;
}

export function getMap(id) {
  return maps.get(id) || maps.get(defaultId);
}

export function listMaps() {
  return [...maps.values()];
}
