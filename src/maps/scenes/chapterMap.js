import * as THREE from 'three';
import { registerMap } from '../registry.js';
import { MapBuilder } from '../kit/MapBuilder.js';
import { themeKit } from '../kit/themes.js';
import { glowTexture } from '../../core/textures.js';
import * as P from '../kit/props.js';
import { getChapter } from '../chapters.js';

// Stage node positions (x, z) on the island: a left-to-right zigzag, boss last.
const NODES = [
  [-5.6, 1.9],
  [-3.5, -0.5],
  [-1.3, 1.7],
  [0.9, -0.6],
  [3.0, 1.6],
  [5.1, -0.9],
];

const SKY = {
  1: { stops: [[0, '#5f74e6'], [0.45, '#97a8fb'], [0.8, '#d9d4ff'], [1, '#f6e9ff']], fog: '#d6d4ff', sea: '#f4efff' },
  2: { stops: [[0, '#4fb6ec'], [0.5, '#9fdcef'], [0.85, '#d6f2d8'], [1, '#f0fbe4']], fog: '#cdeed6', sea: '#f2fff2' },
  3: { stops: [[0, '#1b0f2e'], [0.45, '#3a1838'], [0.8, '#7a2a35'], [1, '#d2582c']], fog: '#4a1d2e', sea: '#5a2a3a' },
  4: { stops: [[0, '#6a98ee'], [0.5, '#a6c9f8'], [0.85, '#e0eeff'], [1, '#f7fbff']], fog: '#dce9fb', sea: '#f4f8ff' },
};

/**
 * CHAPTER MAP — one big themed island with a winding flagstone road through
 * six stage pedestals (the sixth is the boss). States come from the save:
 * create({ chapter, states: ['cleared'|'current'|'locked', x6] })
 * -> map with `nodes: [{ index, pos, top }]` and `cameras.view`.
 */
export default registerMap({
  id: 'chapter-map',
  name: 'Chapter Map',
  kind: 'scene',
  create({ scene, chapter = 1, states = [] }) {
    const ch = getChapter(chapter);
    const sky = SKY[ch.id] || SKY[1];
    const b = new MapBuilder(scene, { name: 'map:chapter-' + ch.id, seed: 100 + ch.id * 7 });
    b.sky(sky.stops, { color: sky.fog, near: 28, far: 70 });
    const dark = ch.id === 3;
    b.lights({
      hemi: dark ? ['#ffb48a', '#2a1530', 0.95] : ['#fff8ff', '#8a7cc8', 1.2],
      sun: { color: dark ? '#ffc08a' : '#fff1de', intensity: dark ? 2.0 : 2.4, pos: [-6, 14, 8] },
      rim: { color: dark ? '#ff5a2a' : '#d9c4ff', intensity: 1.1, pos: [5, 6, -10] },
      shadow: 11,
      env: dark ? 0.32 : undefined,
    });
    const th = themeKit(b, ch.id);
    const gold = b.mat('#ffd45c', { rough: 0.3, metal: 0.6 });

    // ---- island
    P.island(b, { pos: [0, 0, 0], rx: 9.6, rz: 5.4, depth: 5.5, top: th.top, side: th.side, rock: th.rock, segs: 26 });
    if (th.lava) {
      const lava = th.lava;
      for (const [x, z, r] of [[-4.6, -3.3, 1.0], [5.0, 3.4, 0.8], [-1.2, 3.8, 0.6], [2.4, -3.6, 0.7]]) {
        b.m(new THREE.CircleGeometry(r, 16).rotateX(-Math.PI / 2), lava, [x, 0.02, z], { noCast: true, scale: [1.3, 1, 0.8] });
      }
    }

    // ---- road through the nodes
    const pts = NODES.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength();
    const slab = new THREE.CylinderGeometry(0.26, 0.28, 0.06, 7);
    for (let i = 0, n = Math.floor(len / 0.34); i <= n; i++) {
      const p = curve.getPointAt(i / n);
      if (NODES.some(([x, z]) => Math.hypot(p.x - x, p.z - z) < 0.75)) continue;
      const tan = curve.getTangentAt(i / n);
      const side = new THREE.Vector3(-tan.z, 0, tan.x).multiplyScalar(b.r(-0.12, 0.12));
      b.m(slab, th.path, [p.x + side.x, 0.02, p.z + side.z], { scale: [b.r(0.9, 1.15), 1, b.r(0.8, 1.0)], rot: [0, b.r(0, 3), 0], noCast: true });
    }
    const nearRoad = (x, z, m) => {
      for (let i = 0; i <= 60; i++) {
        const p = curve.getPointAt(i / 60);
        if (Math.hypot(p.x - x, p.z - z) < m) return true;
      }
      return false;
    };

    // ---- centrepiece + decor
    th.center([0.2, 0, -3.6], 1.25);
    // decor stays off the road, and out of the strip in front of each pedestal (camera side)
    const blocksNode = (x, z) => NODES.some(([nx, nz]) => Math.abs(x - nx) < 1.3 && z > nz - 1.2 && z < nz + 2.8);
    for (let i = 0; i < 46; i++) {
      const a = b.r(0, Math.PI * 2), d = Math.sqrt(b.r(0.05, 1));
      const x = Math.cos(a) * d * 8.8, z = Math.sin(a) * d * 4.9;
      if (nearRoad(x, z, 1.15) || blocksNode(x, z) || Math.hypot(x - 0.2, (z + 3.6) * 1.4) < 2.4) continue;
      th.decor([x, 0, z], z > 2.5 ? b.r(0.5, 0.7) : b.r(0.7, 1.05));
    }

    // ---- stage pedestals (kept live so states can glow)
    const stone = b.mat('#d9d2ee', { rough: 0.8 });
    const stoneDim = b.mat('#9a93b5', { rough: 0.9 });
    const nodes = [];
    const pulses = [];
    NODES.forEach(([x, z], i) => {
      const state = states[i] || 'locked';
      const boss = i === NODES.length - 1;
      const r = boss ? 0.78 : 0.58;
      b.m(new THREE.CylinderGeometry(r, r * 1.12, 0.26, 24), state === 'locked' ? stoneDim : stone, [x, 0.13, z]);
      b.m(new THREE.TorusGeometry(r * 0.98, 0.05, 6, 32).rotateX(Math.PI / 2), state === 'locked' ? stoneDim : gold, [x, 0.27, z], { noCast: true });
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(r * 0.82, 32).rotateX(-Math.PI / 2),
        b.mat(state === 'cleared' ? '#ffe27a' : state === 'current' ? ch.color : '#7d769c', { emissive: state === 'locked' ? '#000000' : state === 'cleared' ? '#ffb92e' : ch.color, ei: state === 'locked' ? 0 : 0.55, rough: 0.5 })
      );
      disc.position.set(x, 0.265, z);
      b.root.add(disc);
      if (state === 'current') {
        const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.05, r * 1.35, 40).rotateX(-Math.PI / 2), b.basic(ch.color, { additive: true, opacity: 0.8, map: null }));
        ring.position.set(x, 0.05, z);
        b.root.add(ring);
        pulses.push(ring);
        const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: ch.color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
        beam.position.set(x, 0.9, z);
        beam.scale.set(1.6, 2.4, 1);
        b.root.add(beam);
      }
      if (boss) {
        P.banner(b, { pos: [x + 0.55, 0.26, z - 0.55], color: '#e8466a', emblem: 'crown', h: 1.7, size: 0.8 });
        P.banner(b, { pos: [x - 0.55, 0.26, z - 0.55], color: '#e8466a', emblem: 'swords', h: 1.7, size: 0.8 });
      }
      nodes.push({ index: i + 1, pos: new THREE.Vector3(x, 0.27, z), state, boss, pick: disc });
    });
    b.onUpdate((dt, t) => {
      const k = 1 + 0.12 * Math.sin(t * 3);
      for (const p of pulses) {
        p.scale.set(k, 1, k);
        p.material.opacity = 0.45 + 0.35 * Math.sin(t * 3);
      }
    });

    if (dark) {
      // the forge island floats over a lava sea instead of clouds
      const sea = new THREE.Mesh(new THREE.CircleGeometry(70, 48).rotateX(-Math.PI / 2), th.lava);
      sea.position.y = -7;
      b.root.add(sea);
      P.glow(b, { pos: [0, -5, -6], color: '#ff5a1a', size: 30, opacity: 0.25 });
    } else P.cloudSea(b, { y: -6.5, r0: 9, r1: 42, n: 32, color: sky.sea, emissive: sky.sea, ei: 0.4 });
    if (ch.id === 4) P.particles(b, { n: 120, box: [-11, 0, -6, 11, 7, 6], color: '#ffffff', size: 0.11, mode: 'fall', speed: 0.5, additive: false });
    else if (ch.id === 3) P.particles(b, { n: 80, box: [-11, 0, -6, 11, 6, 6], color: '#ffae4a', size: 0.11, mode: 'rise', speed: 0.6 });
    else if (ch.id === 2) P.particles(b, { n: 50, box: [-10, 0.3, -5, 10, 3, 5], color: '#e9ff7a', size: 0.12, mode: 'drift', speed: 0.3 });
    else P.particles(b, { n: 50, box: [-10, 0, -5, 10, 4, 5], color: '#fff1b0', size: 0.09, mode: 'rise', speed: 0.2 });

    const map = b.finish({ cameras: { view: { pos: [1.6, 10.2, 9.8], look: [1.6, 0, -0.4], fov: 42 } } });
    map.nodes = nodes;
    return map;
  },
});
