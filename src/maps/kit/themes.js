import * as THREE from 'three';
import { groundTexture, lavaTexture } from './paint.js';
import * as P from './props.js';

/**
 * Per-chapter look for the overview scenes (world map islands, chapter map):
 * ground materials, scatter decor and a centrepiece landmark, matching the
 * chapter's arena.
 */
export function themeKit(b, chapterId) {
  const gold = b.mat('#ffd45c', { rough: 0.35, metal: 0.55 });
  const T = {
    1: () => {
      const wall = b.mat('#eee9fa', { rough: 0.8 });
      const roof = b.mat('#4f74e8', { rough: 0.55 });
      return {
        top: b.mat('#ffffff', { map: groundTexture('t1-grass', '#93d77f', ['#7cc76c', '#a6e08e', '#6fbd63'], { repeat: [3, 3], blades: '#6db25f' }) }),
        side: b.mat('#9b7f6e', { rough: 0.95 }),
        rock: b.mat('#8d7fb8', { rough: 0.95, flat: true }),
        path: b.mat('#e3ddf5', { rough: 0.8 }),
        decor: (p, s) => (b.rnd() < 0.6 ? P.tree(b, { pos: p, s: s * 0.7, leaf: ['#6cc35a', '#86d66a', '#9ee07a'] }) : P.bush(b, { pos: p, s, flowers: ['#ff9ad1', '#fff3a8', '#ffffff'] })),
        center: (p, s, parent) => {
          P.castle(b, { pos: p, s: s * 0.55, wall, roof, trim: gold, parent });
          return 3.4 * s;
        },
        crystal: '#5fc8ff',
      };
    },
    2: () => ({
      top: b.mat('#ffffff', { map: groundTexture('t2-grass', '#6cbc55', ['#5aa64c', '#7fcb62', '#4c9742'], { repeat: [3, 3], blades: '#3f8a3c' }) }),
      side: b.mat('#8a6a52', { rough: 0.95 }),
      rock: b.mat('#6f6a5a', { rough: 0.95, flat: true }),
      path: b.mat('#d9c9a6', { rough: 0.9 }),
      decor: (p, s) => {
        const r = b.rnd();
        if (r < 0.45) P.tree(b, { pos: p, s: s * 0.8, leaf: ['#4fae4a', '#63c35a', '#3f9a45'] });
        else if (r < 0.8) P.mushroom(b, { pos: p, s: s * 0.7, cap: b.pick(['#ff5a5f', '#c77dff', '#ff7a6a']) });
        else P.bush(b, { pos: p, s, colors: ['#4fae4a', '#63c35a'], flowers: ['#ff9ad1', '#fff3a8'] });
      },
      center: (p, s, parent) => {
        P.tree(b, { pos: p, s: s * 0.95, leaf: ['#4fae4a', '#63c35a', '#3f9a45', '#7fd164'], parent });
        const q = new THREE.Vector3(...(Array.isArray(p) ? p : p.toArray()));
        P.mushroom(b, { pos: [q.x + 0.9 * s, q.y, q.z + 0.4 * s], s: s * 0.8, cap: '#ff5a5f', parent });
        P.mushroom(b, { pos: [q.x - 0.9 * s, q.y, q.z + 0.3 * s], s: s * 0.6, cap: '#c77dff', parent });
        return 3.6 * s;
      },
      crystal: '#7dff9a',
    }),
    3: () => {
      const basalt = b.mat('#4a3646', { rough: 0.9, flat: true });
      return {
        top: b.mat('#ffffff', { map: groundTexture('t3-rock', '#4a3646', ['#3b2a36', '#5a4152', '#2e2029'], { repeat: [3, 3] }) }),
        side: b.mat('#33242f', { rough: 0.95, flat: true }),
        rock: b.mat('#2e2029', { rough: 0.95, flat: true }),
        path: b.mat('#6a4f5e', { rough: 0.85 }),
        decor: (p, s) => {
          if (b.rnd() < 0.55) P.rock(b, { pos: p, s: s * 0.45, mat: basalt, squash: b.r(0.7, 1.6) });
          else P.crystalCluster(b, { pos: p, color: '#ff7a3a', n: 3, size: s * 0.35 });
        },
        center: (p, s) => {
          const q = Array.isArray(p) ? p : p.toArray();
          P.volcano(b, { pos: q, r: 1.7 * s, h: 2.6 * s, rock: b.mat('#33242f', { rough: 0.95, flat: true }) });
          return 3.2 * s;
        },
        crystal: '#ff8a3a',
        lava: b.mat('#6a1e12', { map: lavaTexture(), emissive: '#ff5a1a', emissiveMap: lavaTexture(), ei: 0.75, rough: 0.6 }),
      };
    },
    4: () => ({
      top: b.mat('#ffffff', { map: groundTexture('t4-snow', '#eef4ff', ['#dbe7fb', '#ffffff', '#cfdcf5'], { repeat: [3, 3] }) }),
      side: b.mat('#b9cbe8', { rough: 0.9 }),
      rock: b.mat('#8a9cc4', { rough: 0.9, flat: true }),
      path: b.mat('#cfe3fb', { rough: 0.5 }),
      decor: (p, s) => {
        if (b.rnd() < 0.65) P.pine(b, { pos: p, s: s * 0.75, color: '#3f7f73', snow: true });
        else P.crystalCluster(b, { pos: p, color: '#bfe6ff', n: 3, size: s * 0.35 });
      },
      center: (p, s) => {
        const q = Array.isArray(p) ? new THREE.Vector3(...p) : p.clone();
        b.m(new THREE.CylinderGeometry(0.7 * s, 0.85 * s, 0.4 * s, 8), b.mat('#a9cdf2', { rough: 0.4, flat: true }), [q.x, q.y + 0.2 * s, q.z]);
        P.crystal(b, { pos: [q.x, q.y + 1.4 * s, q.z], color: '#6fc4ff', emissive: '#4aa8ff', size: s * 1.1 });
        P.crystalCluster(b, { pos: [q.x - 0.8 * s, q.y, q.z + 0.3 * s], color: '#9fd8ff', n: 4, size: 0.4 * s });
        P.crystalCluster(b, { pos: [q.x + 0.8 * s, q.y, q.z + 0.2 * s], color: '#9fd8ff', n: 4, size: 0.4 * s });
        return 2.8 * s;
      },
      crystal: '#6fc4ff',
    }),
  };
  return (T[chapterId] || T[1])();
}
