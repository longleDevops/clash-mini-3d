import * as THREE from 'three';
import { registerMap } from '../registry.js';
import { MapBuilder } from '../kit/MapBuilder.js';
import { plazaTexture, groundTexture, medallion } from '../kit/paint.js';
import * as P from '../kit/props.js';
import { arena } from './shell.js';

/**
 * SKY SANCTUM — chapter 1. A lavender flagstone plaza on a floating island:
 * crenellated white walls, a crystal gate with blue-roofed towers, team
 * banners, and far-off castle islands over a sea of clouds.
 */
export default registerMap(
  {
    id: 'sky-sanctum',
    name: 'Sky Sanctum',
    kind: 'arena',
    theme: { accent: '#7fb2ff', sky: ['#6f7fe8', '#d9d4ff'], emblem: 'star' },
    create({ scene }) {
      const b = new MapBuilder(scene, { name: 'map:sky-sanctum', seed: 11 });
      b.sky([[0, '#6577e6'], [0.42, '#97a8fb'], [0.78, '#d6d2ff'], [1, '#f6e9ff']], { color: '#d3d4ff', near: 30, far: 80 });
      b.lights({ hemi: ['#fff8ff', '#8a7cc8', 1.15], sun: { color: '#fff1de', intensity: 2.5, pos: [-5, 10, 7] }, rim: { color: '#cdb8ff', intensity: 1.0, pos: [4, 5, -8] } });

      const wall = b.mat('#eee9fa', { rough: 0.8 });
      const wallCap = b.mat('#cfc6ea', { rough: 0.8 });
      const roof = b.mat('#4f74e8', { rough: 0.55 });
      const gold = b.mat('#ffd45c', { rough: 0.35, metal: 0.55 });
      const grass = b.mat('#ffffff', { map: groundTexture('sky-grass', '#8fd47c', ['#76c468', '#a7e290', '#6cbb62'], { repeat: [7, 7], blades: '#64ad58' }) });
      const dirt = b.mat('#9b7f6e', { rough: 0.95 });
      const rockMat = b.mat('#8d7fb8', { rough: 0.95, flat: true });
      const rockDark = b.mat('#6e619c', { rough: 0.95, flat: true });

      // ---- floor
      P.plaza(b, {
        rx: 8.4,
        rz: 5.5,
        tex: plazaTexture('sky-plaza', {
          stones: ['#dcd6f1', '#cbc4e6', '#e6e1f6', '#c1b9de'],
          grout: '#9d93c8',
          rings: 10,
          medal: '#f1edfb',
          emblem: medallion('compass', '#ffd45c', '#7fb2ff'),
          seed: 4,
        }),
        rough: 0.78,
      });
      P.curb(b, { rx: 8.65, rz: 5.75, mats: [wallCap, wall], trim: gold, n: 72 });
      P.island(b, { pos: [0, -0.03, -1.5], rx: 13.5, rz: 10.5, depth: 7.5, top: grass, side: dirt, rock: rockMat, segs: 22 });

      // ---- back wall with the crystal gate
      P.wallArc(b, { rx: 9.3, rz: 6.3, a0: -Math.PI * 0.94, a1: -Math.PI * 0.6, h: 0.8, mat: wall, cap: wallCap });
      P.wallArc(b, { rx: 9.3, rz: 6.3, a0: -Math.PI * 0.4, a1: -Math.PI * 0.06, h: 0.8, mat: wall, cap: wallCap });
      P.gateArch(b, { pos: [0, 0, -6.3], w: 2.3, h: 1.45, mat: wall, trim: gold, depth: 0.7 });
      P.crystal(b, { pos: [0, 1.4, -6.3], color: '#5fc8ff', size: 0.95 });
      P.crystalCluster(b, { pos: [-0.75, 0, -6.1], color: '#8fdcff', n: 3, size: 0.35 });
      P.crystalCluster(b, { pos: [0.8, 0, -6.1], color: '#8fdcff', n: 3, size: 0.35 });
      for (const x of [-2.1, 2.1]) P.tower(b, { pos: [x, 0, -6.5], r: 0.5, h: 1.7, mat: wall, roof, trim: gold, roofH: 1.0 });
      for (const x of [-7.6, 7.6]) P.tower(b, { pos: [x, 0, -3.3], r: 0.5, h: 1.6, mat: wall, roof, trim: gold, roofH: 1.0 });
      // steps up to the gate
      for (let i = 0; i < 2; i++) b.m(new THREE.BoxGeometry(2.6 - i * 0.4, 0.12, 0.5), wallCap, [0, 0.06 + i * 0.12, -5.75 - i * 0.18]);

      // ---- team banners (blue = you, red = rivals)
      P.banner(b, { pos: [-5.7, 0, -3.6], color: '#4f7dff', emblem: 'star' });
      P.banner(b, { pos: [-5.6, 0, -0.4], color: '#4f7dff', emblem: 'star', h: 2.4 });
      P.banner(b, { pos: [5.7, 0, -3.6], color: '#e8466a', emblem: 'swords' });
      P.banner(b, { pos: [5.6, 0, -0.4], color: '#e8466a', emblem: 'swords', h: 2.4 });
      P.brazier(b, { pos: [-3.9, 0, -4.9], flame: '#7fc8ff', core: '#ffffff', h: 0.9, stand: wall, bowl: gold, size: 0.8 });
      P.brazier(b, { pos: [3.9, 0, -4.9], flame: '#7fc8ff', core: '#ffffff', h: 0.9, stand: wall, bowl: gold, size: 0.8 });

      // ---- greenery on the island rim
      for (const [x, z, s] of [[-9.4, -4.6, 1.15], [-10.4, -1.2, 1.3], [-8.6, -7.4, 1.0], [9.6, -4.4, 1.2], [10.6, -0.8, 1.35], [8.8, -7.6, 1.0], [-11.2, 2.6, 1.2], [11.4, 2.4, 1.1]]) {
        P.tree(b, { pos: [x, 0, z], s, leaf: ['#6cc35a', '#86d66a', '#58ad4f', '#9ee07a'] });
      }
      for (const [x, z] of [[-8.6, -2.6], [8.7, -2.4], [-6.8, -5.4], [6.9, -5.3], [-9.6, 1.2], [9.7, 1.0], [-3.6, -6.9], [3.7, -6.9]]) {
        P.bush(b, { pos: [x, 0, z], s: b.r(0.8, 1.1), flowers: ['#ff9ad1', '#fff3a8', '#ffffff'] });
      }
      P.flowers(b, { r0: 9.2, r1: 11.5, n: 70, colors: ['#ff9ad1', '#fff3a8', '#ffffff', '#c9a4ff'], avoid: (x, z) => z > 4 });
      for (const [x, z, s] of [[-12, -5, 0.8], [12.2, -5.5, 0.9], [-7, -9.2, 0.7], [6.5, -9.4, 0.8]]) P.rock(b, { pos: [x, 0.1, z], s, mat: rockDark });

      // ---- waterfalls off the back of the island
      P.waterfall(b, { pos: [-5.2, -0.25, -10.4], w: 1.0, h: 8, rotY: 0.25 });
      P.waterfall(b, { pos: [5.8, -0.25, -10.2], w: 0.8, h: 7, rotY: -0.3 });

      // ---- distant castle islands + clouds
      const farGrass = b.mat('#9ad888', { rough: 0.95 });
      for (const [x, y, z, s, castle] of [[-15, -3.2, -24, 1.4, true], [15, -2.4, -27, 1.3, true], [1.5, -1.6, -40, 1.2, true], [-26, -4.5, -32, 0.9, false], [26, -3.5, -20, 0.8, false]]) {
        const g = P.group(b, [x, y, z], { scale: s });
        P.island(b, { pos: [0, 0, 0], rx: 3.2, rz: 2.6, depth: 3.2, top: farGrass, rock: rockMat, parent: g });
        if (castle) P.castle(b, { pos: [0, 0, -0.2], s: 0.75, wall, roof, trim: gold, parent: g });
        else P.tree(b, { pos: [0.4, 0, 0], s: 0.9, parent: g });
      }
      P.cloudSea(b, { y: -8.5, r0: 15, r1: 46, n: 30, color: '#f4efff', emissive: '#e8e0ff', ei: 0.35 });
      for (let i = 0; i < 8; i++) P.cloud(b, { pos: [b.r(-34, 34), b.r(-3, 1), b.r(-30, -46)], s: b.r(1.2, 2.2), drift: b.r(0.15, 0.4), wrap: 40, color: '#ffffff', ei: 0.4 });

      // ---- floating light motes
      P.particles(b, { n: 70, box: [-10, 0.2, -7, 10, 4.5, 4], color: '#fff1b0', size: 0.11, mode: 'rise', speed: 0.25 });

      return arena(b);
    },
  },
  { isDefault: true }
);
