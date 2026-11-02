import * as THREE from 'three';
import { registerMap } from '../registry.js';
import { MapBuilder } from '../kit/MapBuilder.js';
import { themeKit } from '../kit/themes.js';
import * as P from '../kit/props.js';
import { CHAPTERS } from '../chapters.js';

// Island layout across the 16:9 frame, left to right in chapter order.
const SPOTS = [
  [-6.6, 0.0, 0.0],
  [-2.2, 0.8, -3.0],
  [2.2, 0.2, 0.2],
  [6.6, 1.0, -3.0],
];

/**
 * WORLD MAP — one floating island per chapter, each a little diorama of its
 * arena, linked by a dotted sky path. Locked chapters sit inside a cloud veil.
 * create({ unlocked: [chapterIds] }) -> map with `chapters: [{ id, center, anchor }]`.
 */
export default registerMap({
  id: 'world-map',
  name: 'World Map',
  kind: 'scene',
  create({ scene, unlocked = [1] }) {
    const b = new MapBuilder(scene, { name: 'map:world', seed: 91 });
    b.sky([[0, '#5f74e6'], [0.4, '#93a6fb'], [0.75, '#d9d4ff'], [1, '#f7ecff']], { color: '#dcd6ff', near: 30, far: 80 });
    b.lights({ hemi: ['#fff8ff', '#8a7cc8', 1.2], sun: { color: '#fff1de', intensity: 2.4, pos: [-6, 14, 8] }, rim: { color: '#d9c4ff', intensity: 1.0, pos: [5, 6, -10] }, shadow: 12 });

    const chapters = [];
    CHAPTERS.forEach((ch, i) => {
      const [x, y, z] = SPOTS[i];
      const th = themeKit(b, ch.id);
      const g = P.group(b, [x, y, z]);
      P.island(b, { pos: [0, 0, 0], rx: 2.5, rz: 2.0, depth: 3.4, top: th.top, side: th.side, rock: th.rock, parent: g, segs: 18 });
      const h = th.center([x, y, z - 0.4], 1.0, undefined);
      for (let k = 0; k < 7; k++) {
        const a = b.r(0, Math.PI * 2), d = b.r(1.3, 2.0);
        th.decor([x + Math.cos(a) * d, y, z + Math.sin(a) * d * 0.75], b.r(0.7, 1.0));
      }
      if (th.lava) {
        const pool = new THREE.CircleGeometry(0.7, 16).rotateX(-Math.PI / 2);
        b.m(pool, th.lava, [x + 1.2, y + 0.02, z + 0.9], { noCast: true, scale: [1, 1, 0.7] });
        P.particles(b, { n: 20, box: [x - 2, y, z - 2, x + 2, y + 3, z + 2], color: '#ffae4a', size: 0.12, mode: 'rise', speed: 0.6 });
      }
      if (ch.id === 4) P.particles(b, { n: 30, box: [x - 2.5, y, z - 2.2, x + 2.5, y + 3.5, z + 2.2], color: '#ffffff', size: 0.1, mode: 'fall', speed: 0.5, additive: false });
      if (ch.id === 1) P.waterfall(b, { pos: [x + 1.6, y - 0.3, z + 1.4], w: 0.5, h: 3.5, rotY: -0.6 });
      const locked = !unlocked.includes(ch.id);
      if (locked) {
        // shimmering seal over chapters you haven't reached yet
        const dome = new THREE.Mesh(new THREE.SphereGeometry(2.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), b.basic('#cbb8ff', { additive: true, opacity: 0.16, side: THREE.DoubleSide }));
        dome.position.set(x, y - 0.1, z);
        dome.scale.set(1, 1.15, 0.85);
        b.root.add(dome);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.05, 6, 64).rotateX(Math.PI / 2), b.basic('#e4d9ff', { additive: true, opacity: 0.6 }));
        ring.position.set(x, y + 0.05, z);
        ring.scale.set(1, 1, 0.85);
        b.root.add(ring);
        const ph = b.r(0, 6);
        b.onUpdate((dt, t) => (dome.material.opacity = 0.12 + 0.06 * Math.sin(t * 1.6 + ph)));
      } else {
        P.glow(b, { pos: [x, y + 0.2, z], color: ch.color, size: 6, opacity: 0.18, pulse: 0.3 });
      }
      chapters.push({ id: ch.id, center: new THREE.Vector3(x, y, z), anchor: new THREE.Vector3(x, y + h + 0.2, z - 0.4), locked });
    });

    // dotted sky path between islands
    const dot = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10);
    const dotMat = b.mat('#fff3c4', { emissive: '#ffd45c', ei: 0.6 });
    const dimMat = b.mat('#c9c1e8', { rough: 0.8 });
    for (let i = 0; i < SPOTS.length - 1; i++) {
      const A = new THREE.Vector3(...SPOTS[i]), C = new THREE.Vector3(...SPOTS[i + 1]);
      const n = 9;
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const p = A.clone().lerp(C, t);
        p.y += Math.sin(t * Math.PI) * 0.9 + 0.05;
        if (t < 0.28 || t > 0.72) continue;
        b.m(dot, unlocked.includes(i + 2) ? dotMat : dimMat, p.toArray(), { noCast: true });
      }
    }

    P.cloudSea(b, { y: -10, r0: 4, r1: 30, n: 34, color: '#f6f0ff', emissive: '#efe6ff', ei: 0.4 });
    for (let i = 0; i < 6; i++) P.cloud(b, { pos: [b.r(-26, 26), b.r(4, 7), b.r(-22, -30)], s: b.r(1.6, 2.6), drift: b.r(0.15, 0.35), wrap: 32, ei: 0.45 });
    P.particles(b, { n: 50, box: [-12, -1, -6, 12, 5, 4], color: '#fff1b0', size: 0.09, mode: 'rise', speed: 0.2 });

    const map = b.finish({ cameras: { view: { pos: [0, 9.5, 14], look: [0, 0, -1.5], fov: 42 } } });
    map.chapters = chapters;
    return map;
  },
});
