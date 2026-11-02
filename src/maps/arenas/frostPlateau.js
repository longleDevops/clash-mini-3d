import * as THREE from 'three';
import { registerMap } from '../registry.js';
import { MapBuilder } from '../kit/MapBuilder.js';
import { plazaTexture, groundTexture, medallion, snowflakeTexture } from '../kit/paint.js';
import * as P from '../kit/props.js';
import { arena } from './shell.js';

/**
 * FROST PLATEAU — chapter 4. Ice-blue flagstones dusted with snow inside an
 * ice citadel: crenellated walls with snow caps, the great sky crystal on its
 * pedestal, snowy pines, ice clusters and steady snowfall.
 */
export default registerMap({
  id: 'frost-plateau',
  name: 'Frost Plateau',
  kind: 'arena',
  theme: { accent: '#a8dcff', sky: ['#6f9ff0', '#eef6ff'], emblem: 'snow' },
  create({ scene }) {
    const b = new MapBuilder(scene, { name: 'map:frost-plateau', seed: 53 });
    b.sky([[0, '#6a98ee'], [0.45, '#a6c9f8'], [0.8, '#e0eeff'], [1, '#f7fbff']], { color: '#dce9fb', near: 26, far: 66 });
    b.lights({ hemi: ['#f4f9ff', '#7d93c8', 1.2], sun: { color: '#ffffff', intensity: 2.3, pos: [-5, 10, 6] }, rim: { color: '#bfe0ff', intensity: 1.1, pos: [4, 5, -8] } });

    const ice = b.mat('#d6e8fb', { rough: 0.45, metal: 0.05 });
    const iceDeep = b.mat('#a9cdf2', { rough: 0.4, metal: 0.05, flat: true });
    const snow = b.mat('#f6faff', { rough: 0.85 });
    const silver = b.mat('#e9f3ff', { rough: 0.3, metal: 0.6 });
    const gold = b.mat('#ffd45c', { rough: 0.35, metal: 0.55 });
    const rockMat = b.mat('#8a9cc4', { rough: 0.9, flat: true });

    // ---- snowfield + ice plaza
    const field = new THREE.CircleGeometry(50, 48);
    field.rotateX(-Math.PI / 2);
    b.m(field, b.mat('#ffffff', { map: groundTexture('frost-snow', '#eef4ff', ['#dbe7fb', '#ffffff', '#cfdcf5'], { repeat: [12, 12] }) }), [0, -0.03, 0], { noCast: true });
    P.plaza(b, {
      rx: 8.3,
      rz: 5.5,
      tex: plazaTexture('frost-plaza', {
        stones: ['#cfe3fb', '#bcd6f5', '#e1eefc', '#aecbee'],
        grout: '#8eabd8',
        rings: 10,
        medal: '#e9f3ff',
        emblem: medallion('snow', '#ffffff', '#7fb2ff'),
        snow: true,
        seed: 15,
      }),
      rough: 0.5,
    });
    P.curb(b, { rx: 8.55, rz: 5.75, mats: [ice, iceDeep], trim: silver, n: 72 });
    // snow drifts outside the curb
    for (let i = 0; i < 26; i++) {
      const a = b.r(-Math.PI, 0.05), d = b.r(9.4, 11.5);
      const geo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      b.m(geo, snow, [Math.cos(a) * d, -0.05, Math.sin(a) * d * 0.7], { scale: [b.r(0.9, 1.8), b.r(0.25, 0.5), b.r(0.7, 1.2)], noCast: true });
    }

    // ---- ice citadel walls + the great crystal
    P.wallArc(b, { rx: 9.4, rz: 6.4, a0: -Math.PI * 0.95, a1: -Math.PI * 0.6, h: 0.95, mat: ice, cap: snow });
    P.wallArc(b, { rx: 9.4, rz: 6.4, a0: -Math.PI * 0.4, a1: -Math.PI * 0.05, h: 0.95, mat: ice, cap: snow });
    for (const x of [-2.1, 2.1]) P.tower(b, { pos: [x, 0, -6.5], r: 0.55, h: 1.8, mat: ice, roof: b.mat('#6f8fe8', { rough: 0.5 }), trim: silver, roofH: 1.0 });
    for (const x of [-7.7, 7.7]) P.tower(b, { pos: [x, 0, -3.4], r: 0.5, h: 1.5, mat: ice, trim: silver, crown: true });
    // pedestal
    b.m(new THREE.CylinderGeometry(0.9, 1.05, 0.35, 8), iceDeep, [0, 0.17, -6.4]);
    b.m(new THREE.CylinderGeometry(0.62, 0.8, 0.3, 8), ice, [0, 0.48, -6.4]);
    b.m(new THREE.TorusGeometry(0.66, 0.05, 6, 24).rotateX(Math.PI / 2), gold, [0, 0.64, -6.4], { noCast: true });
    P.crystal(b, { pos: [0, 1.6, -6.4], color: '#6fc4ff', emissive: '#4aa8ff', size: 1.15 });
    P.crystalCluster(b, { pos: [-1.2, 0, -6.0], color: '#9fd8ff', n: 4, size: 0.42 });
    P.crystalCluster(b, { pos: [1.2, 0, -6.0], color: '#9fd8ff', n: 4, size: 0.42 });

    // ---- banners
    P.banner(b, { pos: [-5.8, 0, -3.6], color: '#4f7dff', emblem: 'star' });
    P.banner(b, { pos: [-5.3, 0, -0.7], color: '#4f7dff', emblem: 'snow', h: 2.4 });
    P.banner(b, { pos: [5.8, 0, -3.6], color: '#e8466a', emblem: 'swords' });
    P.banner(b, { pos: [5.3, 0, -0.7], color: '#e8466a', emblem: 'moon', h: 2.4 });

    // ---- snowy pines, rocks, ice spikes
    for (let i = 0; i < 30; i++) {
      const a = -Math.PI * (0.0 + (i / 29) * 1.0);
      const d = b.r(10.2, 15);
      P.pine(b, { pos: [Math.cos(a) * d * 1.05, 0, Math.sin(a) * d * 0.85 - 1], s: b.r(1.3, 2.1), color: '#3f7f73', snow: true });
    }
    for (const [x, z, s] of [[-11.2, 2.2, 1.7], [11.4, 2.0, 1.8], [-12.6, -0.6, 2.0], [12.5, -0.4, 1.9]]) P.pine(b, { pos: [x, 0, z], s, color: '#3f7f73', snow: true });
    for (const [x, z] of [[-9.2, -2.0], [9.3, -2.2], [-6.8, -5.6], [6.8, -5.7], [-10, 0.8], [10.1, 0.6]]) {
      P.rock(b, { pos: [x, 0, z], s: b.r(0.5, 0.8), mat: rockMat });
      P.crystalCluster(b, { pos: [x + 0.4, 0, z + 0.3], color: '#bfe6ff', n: 3, size: 0.38 });
    }
    // distant mountains
    for (const [x, z, r, h] of [[-20, -34, 9, 11], [0, -42, 12, 14], [22, -36, 10, 12], [-34, -24, 8, 8], [34, -26, 8, 9]]) {
      const m = new THREE.ConeGeometry(r, h, 7);
      P.jitter(m, b, 0.05);
      b.m(m, b.mat('#9fb4dc', { flat: true, rough: 0.9 }), [x, h / 2 - 1, z], { noCast: true });
      const cap = new THREE.ConeGeometry(r * 0.42, h * 0.42, 7);
      b.m(cap, snow, [x, h - 1 - h * 0.21 + 0.05, z], { noCast: true });
    }
    for (let i = 0; i < 6; i++) P.cloud(b, { pos: [b.r(-34, 34), b.r(8, 13), b.r(-32, -44)], s: b.r(1.4, 2.4), drift: b.r(0.12, 0.3), wrap: 38, ei: 0.45 });

    // ---- snowfall
    P.particles(b, { n: 160, box: [-13, -0.2, -10, 13, 8, 6], color: '#ffffff', size: 0.13, mode: 'fall', speed: 0.6, tex: snowflakeTexture(), additive: false, opacity: 0.95 });

    return arena(b);
  },
});
