import * as THREE from 'three';
import { paint, swirlTexture } from './paint.js';
import * as P from './props.js';

// Hub landmarks (home screen buildings). Each returns { anchor } — the world
// point its label floats above — and adds static parts to b.static, moving
// parts to b.root.
const TAU = Math.PI * 2;

/** Two giant crossed swords on a round plinth (Campaign). */
export function swordsMonument(b, pos, s = 1) {
  const g = P.group(b, pos, { scale: s });
  const stone = b.mat('#d9d2ee', { rough: 0.8 });
  const gold = b.mat('#ffd45c', { rough: 0.3, metal: 0.6 });
  const steel = b.mat('#eef2ff', { rough: 0.25, metal: 0.7 });
  const grip = b.mat('#7a4fd0', { rough: 0.6 });
  b.m(new THREE.CylinderGeometry(0.95, 1.1, 0.35, 20), stone, [0, 0.17, 0], { parent: g });
  b.m(new THREE.CylinderGeometry(0.75, 0.85, 0.25, 20), stone, [0, 0.47, 0], { parent: g });
  b.m(new THREE.TorusGeometry(0.8, 0.05, 6, 32).rotateX(Math.PI / 2), gold, [0, 0.6, 0], { parent: g, noCast: true });
  for (const side of [-1, 1]) {
    const sw = new THREE.Group();
    sw.position.set(side * 0.05, 0.6, 0);
    sw.rotation.z = side * 0.55;
    g.add(sw);
    const blade = new THREE.CylinderGeometry(0.02, 0.13, 1.7, 4);
    blade.rotateY(Math.PI / 4);
    blade.scale(1, 1, 0.35);
    b.m(blade, steel, [0, 1.05, 0], { parent: sw });
    b.m(new THREE.BoxGeometry(0.62, 0.11, 0.16), gold, [0, 0.2, 0], { parent: sw });
    b.m(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 8), grip, [0, 0.0, 0], { parent: sw });
    b.m(new THREE.SphereGeometry(0.09, 10, 8), gold, [0, -0.2, 0], { parent: sw });
  }
  P.glow(b, { pos: g.localToWorld(new THREE.Vector3(0, 1.3, 0)), color: '#ffe680', size: 2.4 * s, opacity: 0.35, pulse: 0.4 });
  return { anchor: g.localToWorld(new THREE.Vector3(0, 2.3, 0)) };
}

/** Standing stone ring with a swirling violet portal (Summon). */
export function summonPortal(b, pos, s = 1) {
  const g = P.group(b, pos, { scale: s });
  g.updateMatrixWorld(true);
  const stone = b.mat('#cfc6ea', { rough: 0.8 });
  const gold = b.mat('#ffd45c', { rough: 0.3, metal: 0.6 });
  b.m(new THREE.CylinderGeometry(1.0, 1.15, 0.3, 20), stone, [0, 0.15, 0], { parent: g });
  b.m(new THREE.BoxGeometry(1.6, 0.3, 0.6), stone, [0, 0.42, 0], { parent: g });
  b.m(new THREE.TorusGeometry(0.75, 0.16, 10, 32), stone, [0, 1.35, 0], { parent: g });
  b.m(new THREE.TorusGeometry(0.75, 0.05, 6, 32), gold, [0, 1.35, 0.14], { parent: g, noCast: true });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    b.m(new THREE.OctahedronGeometry(0.1, 0), gold, [Math.cos(a) * 0.75, 1.35 + Math.sin(a) * 0.75, 0.16], { parent: g, noCast: true });
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40), b.basic('#ffffff', { map: swirlTexture('summon-swirl', '#ffe3ff', '#8a3cff'), additive: true, side: THREE.DoubleSide }));
  disc.position.copy(g.localToWorld(new THREE.Vector3(0, 1.35, 0)));
  disc.scale.setScalar(s);
  b.root.add(disc);
  b.onUpdate((dt, t) => (disc.rotation.z = t * 1.5));
  P.glow(b, { pos: disc.position, color: '#c57cff', size: 2.6 * s, opacity: 0.55, pulse: 0.35 });
  P.crystalCluster(b, { pos: g.localToWorld(new THREE.Vector3(-0.8, 0.3, 0.3)), color: '#c99bff', n: 3, size: 0.3 * s });
  P.crystalCluster(b, { pos: g.localToWorld(new THREE.Vector3(0.85, 0.3, 0.2)), color: '#c99bff', n: 3, size: 0.28 * s });
  return { anchor: g.localToWorld(new THREE.Vector3(0, 2.45, 0)) };
}

/** Columned hall with a golden dome and star finial (Heroes). */
export function heroHall(b, pos, s = 1) {
  const g = P.group(b, pos, { scale: s });
  const wall = b.mat('#f3eefc', { rough: 0.75 });
  const roof = b.mat('#9466f0', { rough: 0.5 });
  const gold = b.mat('#ffd45c', { rough: 0.3, metal: 0.6 });
  b.m(new THREE.BoxGeometry(2.2, 0.25, 1.6), wall, [0, 0.12, 0], { parent: g });
  b.m(new THREE.BoxGeometry(1.7, 1.0, 1.1), wall, [0, 0.75, -0.1], { parent: g });
  for (const x of [-0.85, -0.3, 0.3, 0.85]) b.m(new THREE.CylinderGeometry(0.08, 0.09, 1.0, 10), wall, [x, 0.75, 0.6], { parent: g });
  b.m(new THREE.BoxGeometry(2.0, 0.18, 1.5), roof, [0, 1.33, 0.05], { parent: g });
  b.m(new THREE.SphereGeometry(0.55, 18, 10, 0, TAU, 0, Math.PI / 2), gold, [0, 1.42, -0.1], { parent: g });
  b.m(new THREE.BoxGeometry(0.42, 0.55, 0.06), b.mat('#4a3260'), [0, 0.52, 0.46], { parent: g, noCast: true });
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 0.1 : 0.24;
    i ? star.lineTo(Math.cos(a) * r, -Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, -Math.sin(a) * r);
  }
  b.m(new THREE.ExtrudeGeometry(star, { depth: 0.06, bevelEnabled: false }), gold, [0, 2.2, -0.13], { parent: g });
  b.m(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), gold, [0, 1.95, -0.1], { parent: g });
  return { anchor: g.localToWorld(new THREE.Vector3(0, 2.75, 0)) };
}

/** Small keep with a big guild banner. */
export function guildKeep(b, pos, s = 1) {
  const g = P.group(b, pos, { scale: s });
  g.updateMatrixWorld(true);
  const wall = b.mat('#e8e2f6', { rough: 0.8 });
  const roof = b.mat('#4f74e8', { rough: 0.55 });
  const gold = b.mat('#ffd45c', { rough: 0.3, metal: 0.6 });
  b.m(new THREE.BoxGeometry(1.4, 1.0, 1.0), wall, [0, 0.5, 0], { parent: g });
  P.tower(b, { pos: [-0.55, 0, 0.1], r: 0.32, h: 1.6, mat: wall, roof, trim: gold, roofH: 0.8, parent: g });
  P.tower(b, { pos: [0.55, 0, 0.1], r: 0.32, h: 1.6, mat: wall, roof, trim: gold, roofH: 0.8, parent: g });
  P.banner(b, { pos: g.localToWorld(new THREE.Vector3(0, 0.9, 0.2)), color: '#4f7dff', emblem: 'crown', h: 1.5 * s, size: 0.9 * s });
  return { anchor: g.localToWorld(new THREE.Vector3(0, 3.0, 0)) };
}

function stripeTexture(a, c) {
  return paint(`stripes:${a}:${c}`, 128, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? c : a;
      g.fillRect((i * w) / 8, 0, w / 8 + 1, h);
    }
  });
}

/** Market stall with striped awning, crates and a chest (Shop). */
export function shopStall(b, pos, s = 1, rotY = 0) {
  const g = P.group(b, pos, { scale: s, rotY });
  const wood = b.mat('#a9714a', { rough: 0.85 });
  const woodDark = b.mat('#7a4f34', { rough: 0.9 });
  const awn = b.mat('#ffffff', { map: stripeTexture('#ff6e8a', '#fff3e0'), rough: 0.7, side: THREE.DoubleSide });
  b.m(new THREE.BoxGeometry(1.6, 0.6, 0.7), wood, [0, 0.3, 0.1], { parent: g });
  b.m(new THREE.BoxGeometry(1.7, 0.08, 0.8), woodDark, [0, 0.64, 0.1], { parent: g });
  for (const x of [-0.75, 0.75]) b.m(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), woodDark, [x, 0.7, -0.15], { parent: g });
  const roof = new THREE.CylinderGeometry(0.55, 0.55, 1.75, 16, 1, true, -Math.PI / 2, Math.PI);
  roof.rotateZ(Math.PI / 2);
  b.m(roof, awn, [0, 1.35, 0.05], { parent: g, scale: [1, 0.7, 1] });
  // scalloped edge
  for (let i = 0; i < 8; i++) b.m(new THREE.SphereGeometry(0.11, 8, 6, 0, TAU, 0, Math.PI / 2), awn, [-0.77 + i * 0.22, 1.35, 0.6], { parent: g, rot: [Math.PI, 0, 0], noCast: true });
  // goods
  b.m(new THREE.BoxGeometry(0.4, 0.35, 0.4), woodDark, [-1.05, 0.18, 0.35], { parent: g });
  b.m(new THREE.BoxGeometry(0.3, 0.28, 0.3), wood, [-1.0, 0.5, 0.35], { parent: g, rot: [0, 0.4, 0] });
  const gold = b.mat('#ffd45c', { rough: 0.3, metal: 0.6 });
  b.m(new THREE.BoxGeometry(0.46, 0.28, 0.3), b.mat('#c9862b'), [1.05, 0.14, 0.4], { parent: g });
  b.m(new THREE.CylinderGeometry(0.15, 0.15, 0.46, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), b.mat('#e8a43a'), [1.05, 0.28, 0.4], { parent: g });
  b.m(new THREE.BoxGeometry(0.1, 0.12, 0.05), gold, [1.05, 0.28, 0.57], { parent: g, noCast: true });
  for (const [x, c] of [[-0.45, '#a66bff'], [0, '#6fd2ff'], [0.42, '#ff6eb4']]) b.m(new THREE.OctahedronGeometry(0.1, 0).scale(0.8, 1.4, 0.8), b.mat(c, { emissive: c, ei: 0.4, flat: true }), [x, 0.8, 0.25], { parent: g });
  return { anchor: g.localToWorld(new THREE.Vector3(0, 2.15, 0)) };
}

/** Mini colosseum ring with flags (Arena). */
export function arenaRing(b, pos, s = 1) {
  const g = P.group(b, pos, { scale: s });
  g.updateMatrixWorld(true);
  const wall = b.mat('#e4dcf4', { rough: 0.8 });
  const cap = b.mat('#c6bce6', { rough: 0.8 });
  const sand = b.mat('#f0d9a8', { rough: 0.95 });
  b.m(new THREE.CylinderGeometry(1.2, 1.2, 0.08, 24), sand, [0, 0.04, 0], { parent: g, noCast: true });
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * 1.35, z = Math.sin(a) * 1.35;
    b.m(new THREE.BoxGeometry(0.5, 0.75, 0.3), wall, [x, 0.38, z], { parent: g, rot: [0, -a + Math.PI / 2, 0] });
    if (i % 2 === 0) b.m(new THREE.BoxGeometry(0.42, 0.18, 0.34), cap, [x, 0.84, z], { parent: g, rot: [0, -a + Math.PI / 2, 0] });
  }
  for (const [x, z, c] of [[-1.35, 0, '#4f7dff'], [1.35, 0, '#e8466a']]) {
    const p = g.localToWorld(new THREE.Vector3(x, 0.8, z));
    P.banner(b, { pos: p, color: c, emblem: c === '#4f7dff' ? 'star' : 'swords', h: 0.9 * s, size: 0.55 * s });
  }
  return { anchor: g.localToWorld(new THREE.Vector3(0, 2.2, 0)) };
}
