import * as THREE from 'three';
import { registerMap } from '../registry.js';
import { MapBuilder } from '../kit/MapBuilder.js';
import { lawnTexture, groundTexture, medallion, petalTexture } from '../kit/paint.js';
import * as P from '../kit/props.js';
import { arena, nearBoard } from './shell.js';

/**
 * FOREST GROVE — chapter 2. A mown lawn ringed by mossy stepping stones,
 * giant spotted mushrooms, round trees, a mossy shrine arch with a leaf
 * crystal, fireflies and drifting petals.
 */
export default registerMap({
  id: 'forest-grove',
  name: 'Forest Grove',
  kind: 'arena',
  theme: { accent: '#7ed46a', sky: ['#5ec3f0', '#d9f5d8'], emblem: 'leaf' },
  create({ scene }) {
    const b = new MapBuilder(scene, { name: 'map:forest-grove', seed: 23 });
    b.sky([[0, '#4fb6ec'], [0.45, '#8fd8ee'], [0.8, '#d2f2d6'], [1, '#effbe2']], { color: '#bfe6c8', near: 24, far: 60 });
    b.lights({ hemi: ['#fffbe8', '#4f8a4a', 1.1], sun: { color: '#fff0cc', intensity: 2.6, pos: [-6, 10, 5] }, rim: { color: '#ffe9a8', intensity: 0.8, pos: [4, 5, -8] } });

    const stone = b.mat('#bdb5a8', { rough: 0.9, flat: true });
    const mossStone = b.mat('#93a77c', { rough: 0.95, flat: true });
    const wood = b.mat('#8a5a3c', { rough: 0.9 });
    const leafCols = ['#4fae4a', '#63c35a', '#3f9a45', '#7fd164'];

    // ---- ground: wide meadow + mown arena lawn
    const meadow = new THREE.CircleGeometry(48, 48);
    meadow.rotateX(-Math.PI / 2);
    b.m(meadow, b.mat('#ffffff', { map: groundTexture('forest-meadow', '#5aa64c', ['#4c9742', '#6fbb57', '#3f8a3c'], { repeat: [14, 14], blades: '#3f8a3c' }) }), [0, -0.03, 0], { noCast: true });
    P.plaza(b, {
      rx: 8.2,
      rz: 5.4,
      tex: lawnTexture('forest-lawn', { base: '#78c65c', light: '#8ad36a', dark: '#5fae4e', emblem: medallion('leaf', '#c9f29a', '#e9ffd0') }),
      rough: 0.95,
    });
    // stepping-stone ring
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      P.rock(b, { pos: [Math.cos(a) * 8.6, 0.02, Math.sin(a) * 5.8], s: b.r(0.26, 0.36), mat: i % 3 ? stone : mossStone, squash: 0.35 });
    }

    // ---- shrine arch with a leaf crystal (back focal point)
    P.gateArch(b, { pos: [0, 0, -6.6], w: 2.3, h: 1.45, mat: stone, trim: mossStone, depth: 0.6 });
    P.crystal(b, { pos: [0, 1.4, -6.6], color: '#7dff9a', emissive: '#4fe07a', size: 0.9 });
    P.flowers(b, { center: [0, 0, -6.4], r0: 0.8, r1: 2.6, n: 40, colors: ['#ff9ad1', '#fff3a8', '#ffffff'] });

    // ---- giant mushrooms
    for (const [x, z, s, cap] of [
      [-6.6, -4.0, 1.7, '#ff5a5f'],
      [-7.4, -1.3, 1.1, '#ff7a6a'],
      [6.7, -4.2, 1.8, '#ff5a5f'],
      [7.6, -1.6, 1.0, '#c77dff'],
      [-3.2, -6.2, 1.2, '#c77dff'],
      [3.3, -6.3, 1.3, '#ff5a5f'],
      [-9.6, 1.2, 1.6, '#ff5a5f'],
      [9.5, 1.0, 1.5, '#c77dff'],
      [-6.4, 4.2, 1.0, '#ff7a6a'],
      [6.6, 4.0, 1.1, '#ff5a5f'],
    ]) {
      P.mushroom(b, { pos: [x, 0, z], s, cap });
      P.mushroom(b, { pos: [x + b.r(0.5, 0.8) * Math.sign(x), 0, z + b.r(-0.4, 0.4)], s: s * 0.45, cap });
    }

    // ---- tree line (layered so the back reads as deep forest)
    const trees = [];
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI * (0.02 + (i / 25) * 0.96);
      const d = b.r(9.5, 12.5);
      trees.push([Math.cos(a) * d * 1.05, Math.sin(a) * d * 0.95 - 1.5, b.r(1.5, 2.3)]);
    }
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI * (0.05 + (i / 13) * 0.9);
      trees.push([Math.cos(a) * 17, Math.sin(a) * 15 - 3, b.r(2.4, 3.2)]);
    }
    for (const [x, z, s] of [[-11.5, 2.5, 1.8], [11.8, 2.2, 1.9], [-12.5, -1.5, 2.0], [12.6, -1.0, 2.1]]) trees.push([x, z, s]);
    for (const [x, z, s] of trees) P.tree(b, { pos: [x, 0, z], s, leaf: leafCols, trunk: '#7a4f34' });

    // ---- bushes, flowers, stumps, lantern posts
    for (let i = 0; i < 22; i++) {
      const a = b.r(-Math.PI, Math.PI), d = b.r(8.9, 10.5);
      const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.72;
      if (z > 3.5) continue;
      P.bush(b, { pos: [x, 0, z], s: b.r(0.8, 1.2), colors: ['#4fae4a', '#63c35a'], flowers: ['#ff9ad1', '#fff3a8', '#ffffff', '#c9a4ff'] });
    }
    P.flowers(b, { r0: 8.9, r1: 12, n: 120, colors: ['#ff9ad1', '#fff3a8', '#ffffff', '#c9a4ff', '#ffb36b'], avoid: (x, z) => nearBoard(x, z, 1.2) });
    for (const [x, z] of [[-8.2, -3.2], [8.4, -3.0]]) {
      b.m(new THREE.CylinderGeometry(0.42, 0.5, 0.45, 10), wood, [x, 0.22, z]);
      b.m(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 10), b.mat('#d9b48a'), [x, 0.46, z], { noCast: true });
    }
    for (const [x, z] of [[-5.4, -4.8], [5.4, -4.8], [-5.8, 0.6], [5.8, 0.6]]) {
      P.brazier(b, { pos: [x, 0, z], flame: '#ffcf5c', core: '#fff8d6', h: 1.0, stand: wood, bowl: b.mat('#5a3d2a', { metal: 0.2 }), size: 0.6 });
    }

    // ---- life
    P.particles(b, { n: 60, box: [-10, 0.3, -8, 10, 3.2, 4], color: '#e9ff7a', size: 0.13, mode: 'drift', speed: 0.35 });
    P.particles(b, { n: 40, box: [-11, 0.2, -8, 11, 6, 5], color: '#ffc4e4', size: 0.16, mode: 'fall', speed: 0.35, tex: petalTexture(), additive: false, opacity: 0.85 });
    for (let i = 0; i < 6; i++) P.cloud(b, { pos: [b.r(-30, 30), b.r(9, 13), b.r(-34, -44)], s: b.r(1.4, 2.4), drift: b.r(0.15, 0.35), wrap: 36, ei: 0.4 });

    return arena(b);
  },
});
