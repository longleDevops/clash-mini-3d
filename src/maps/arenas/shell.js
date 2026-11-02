import * as THREE from 'three';

// Shared arena framing. Every arena keeps the same 8x4 board anchor so units,
// skills and tile picking behave identically on all maps.
export const BOARD = { cols: 8, rows: 4, tile: 1.12, center: [0, 0, 0.1] };
export const BOARD_HALF_W = (BOARD.cols * BOARD.tile) / 2; // 4.48
export const BOARD_Z0 = BOARD.center[2] - (BOARD.rows * BOARD.tile) / 2; // back edge
export const BOARD_Z1 = BOARD.center[2] + (BOARD.rows * BOARD.tile) / 2; // front edge

/** Battle camera: high three-quarter view, back of the arena visible under the VS bar. */
export const BATTLE_CAM = { pos: [0, 6.1, 9.4], look: [0, 0.45, -0.9], fov: 37 };

/** True when (x, z) is on (or within `m` of) the battle grid, so props stay clear of it. */
export function nearBoard(x, z, m = 0.6) {
  return Math.abs(x) < BOARD_HALF_W + m && z > BOARD_Z0 - m && z < BOARD_Z1 + m;
}

/** Finish an arena: bake statics and hand back the map instance with board + cameras. */
export function arena(b, { battle = {}, home = {} } = {}) {
  return b.finish({
    board: { center: new THREE.Vector3(...BOARD.center), tile: BOARD.tile, cols: BOARD.cols, rows: BOARD.rows },
    spots: { home: new THREE.Vector3(0, 0, 0.6) },
    cameras: {
      battle: { ...BATTLE_CAM, ...battle },
      home: { pos: [0.95, 1.12, 4.6], look: [0.95, 0.68, 0.6], fov: 32, ...home },
    },
  });
}
