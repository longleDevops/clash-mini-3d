import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowTexture, flameTexture } from '../../core/textures.js';
import { bannerTexture, dotTexture, streakTexture } from './paint.js';

// Chunky, low-poly props shared by every map. Each takes the MapBuilder `b`
// first; static parts go to b.static (baked), moving parts to b.root.
const TAU = Math.PI * 2;
const v3 = (p) => (Array.isArray(p) ? new THREE.Vector3(...p) : p.clone());

/** Group helper: build children into a group placed at pos (static unless parent given). */
export function group(b, pos = [0, 0, 0], { rotY = 0, scale = 1, parent } = {}) {
  const g = new THREE.Group();
  g.position.copy(v3(pos));
  g.rotation.y = rotY;
  g.scale.setScalar(scale);
  (parent || b.static).add(g);
  g.updateWorldMatrix(true, false);
  return g;
}

/** Jitter the vertices of a geometry for a hand-made look (positions only). */
export function jitter(geo, b, amt = 0.08, keepY = false) {
  const p = geo.attributes.position;
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(k)) seen.set(k, [b.r(-amt, amt), keepY ? 0 : b.r(-amt, amt), b.r(-amt, amt)]);
    const d = seen.get(k);
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Merge a group of meshes sharing one material into a single mesh. */
export function mergeToMesh(g, mat) {
  g.updateMatrixWorld(true);
  const geos = [];
  g.traverse((o) => {
    if (!o.isMesh) return;
    let x = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    x.applyMatrix4(o.matrixWorld);
    geos.push(x);
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach((x) => x.dispose());
  g.traverse((o) => o.geometry?.dispose());
  return new THREE.Mesh(merged, mat);
}

// ------------------------------------------------------------------ ground

/** Elliptical floor disc with a painted texture. */
export function plaza(b, { rx = 8, rz = 7, y = 0, tex, color = '#ffffff', rough = 0.8, emissiveMap, emissive, ei, metal = 0 }) {
  const geo = new THREE.CircleGeometry(1, 96);
  geo.rotateX(-Math.PI / 2);
  const mat = b.mat(color, { map: tex, rough, metal, emissiveMap, emissive, ei });
  const mesh = b.m(geo, mat, [0, y, 0], { scale: [rx, 1, rz], noCast: true });
  return { mesh, mat };
}

/** Ring of curb stones (with an optional gold lip) around an ellipse. */
export function curb(b, { rx, rz, y = 0, h = 0.22, w = 0.42, mats, trim, n = 64, skip }) {
  const geo = new THREE.BoxGeometry(1, h, w);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    if (skip?.(a)) continue;
    const a2 = ((i + 1) / n) * TAU;
    const x = Math.cos(a) * rx, z = Math.sin(a) * rz, x2 = Math.cos(a2) * rx, z2 = Math.sin(a2) * rz;
    const len = Math.hypot(x2 - x, z2 - z);
    b.m(geo, mats[i % mats.length], [(x + x2) / 2, y + h / 2 - 0.03 + b.r(-0.015, 0.015), (z + z2) / 2], {
      rot: [0, -Math.atan2(z2 - z, x2 - x), 0],
      scale: [len * 0.96, 1, 1],
    });
  }
  if (trim) {
    const t = new THREE.TorusGeometry(1, 0.045, 6, 128);
    t.rotateX(Math.PI / 2);
    b.m(t, trim, [0, y + 0.02, 0], { scale: [rx - w / 2 - 0.02, 1, rz - w / 2 - 0.02], noCast: true });
  }
}

/** Floating island chunk: flat top + jagged inverted rock cone. */
export function island(b, { pos = [0, 0, 0], rx = 6, rz = 6, depth = 5, top, side, rock, rotY = 0, parent, lip = 0.35, segs = 18 }) {
  const g = group(b, pos, { rotY, parent });
  const topGeo = new THREE.CylinderGeometry(1, 0.97, 1, segs, 1);
  jitter(topGeo, b, 0.025, true);
  b.m(topGeo, top, [0, -0.5 * lip, 0], { scale: [rx, lip, rz], parent: g, noCast: true });
  const under = new THREE.ConeGeometry(1, 1, segs, 4, true);
  under.rotateX(Math.PI);
  jitter(under, b, 0.09);
  // keep the rim flat so it never pokes through the island top
  const up = under.attributes.position;
  for (let i = 0; i < up.count; i++) if (up.getY(i) > 0.35) up.setY(i, 0.5);
  under.computeVertexNormals();
  b.m(under, rock, [0, -lip - depth / 2 + 0.02, 0], { scale: [rx * 0.98, depth, rz * 0.98], parent: g });
  if (side) {
    const band = new THREE.CylinderGeometry(1, 0.9, 1, segs, 1, true);
    jitter(band, b, 0.03, true);
    b.m(band, side, [0, -lip - 0.25, 0], { scale: [rx * 0.99, 0.5, rz * 0.99], parent: g, noCast: true });
  }
  return g;
}

export function rock(b, { pos, s = 0.5, mat, parent, squash = 0.7, rotY }) {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  jitter(geo, b, 0.18);
  return b.m(geo, mat, v3(pos).toArray(), { scale: [s, s * squash, s * b.r(0.8, 1.2)], rot: [0, rotY ?? b.r(0, TAU), 0], parent });
}

// ------------------------------------------------------------------ architecture

/** Crenellated wall following an ellipse arc from a0 to a1 (radians, -PI/2 = back). */
export function wallArc(b, { rx, rz, a0, a1, y = 0, h = 0.9, thick = 0.55, mat, cap, step = 0.9, crenel = true, broken = 0 }) {
  const per = (rx + rz) / 2;
  const n = Math.max(2, Math.round((Math.abs(a1 - a0) * per) / step));
  const block = new THREE.BoxGeometry(1, 1, thick);
  const merlon = new THREE.BoxGeometry(1, 1, thick * 1.08);
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    const x0 = Math.cos(t0) * rx, z0 = Math.sin(t0) * rz, x1 = Math.cos(t1) * rx, z1 = Math.sin(t1) * rz;
    const len = Math.hypot(x1 - x0, z1 - z0) * 1.02;
    const rot = [0, -Math.atan2(z1 - z0, x1 - x0), 0];
    const hh = broken && b.rnd() < broken ? h * b.r(0.35, 0.75) : h;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    b.m(block, mat, [cx, y + hh / 2, cz], { rot, scale: [len, hh, 1] });
    if (cap) b.m(block, cap, [cx, y + hh + 0.05, cz], { rot, scale: [len * 1.02, 0.1, 1.12] });
    if (crenel && hh === h && i % 2 === 0) b.m(merlon, cap || mat, [cx, y + h + 0.1 + 0.15, cz], { rot, scale: [len * 0.55, 0.3, 1] });
  }
}

/** Round tower with a cone roof and gold finial. */
export function tower(b, { pos, r = 0.6, h = 2.6, mat, roof, trim, roofH = 1.3, parent, crown = false }) {
  const g = group(b, pos, { parent });
  const body = new THREE.CylinderGeometry(r, r * 1.08, h, 14);
  b.m(body, mat, [0, h / 2, 0], { parent: g });
  if (trim) {
    const band = new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.14, 14);
    b.m(band, trim, [0, h, 0], { parent: g });
  }
  if (crown) {
    const merl = new THREE.BoxGeometry(r * 0.38, 0.28, r * 0.3);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      b.m(merl, mat, [Math.cos(a) * r, h + 0.2, Math.sin(a) * r], { rot: [0, -a, 0], parent: g });
    }
  } else if (roof) {
    const cone = new THREE.ConeGeometry(r * 1.3, roofH, 14);
    b.m(cone, roof, [0, h + roofH / 2 + 0.05, 0], { parent: g });
    if (trim) b.m(new THREE.SphereGeometry(r * 0.18, 10, 8), trim, [0, h + roofH + 0.12, 0], { parent: g });
  }
  return g;
}

/** Stone archway: two pillars + half-ring arch + keystone. Returns the group. */
export function gateArch(b, { pos, w = 2.6, h = 2.4, mat, trim, depth = 0.6, parent }) {
  const g = group(b, pos, { parent });
  const pw = 0.5;
  const pillar = new THREE.BoxGeometry(pw, h, depth);
  b.m(pillar, mat, [-w / 2, h / 2, 0], { parent: g });
  b.m(pillar, mat, [w / 2, h / 2, 0], { parent: g });
  const base = new THREE.BoxGeometry(pw * 1.3, 0.3, depth * 1.2);
  b.m(base, trim || mat, [-w / 2, 0.15, 0], { parent: g });
  b.m(base, trim || mat, [w / 2, 0.15, 0], { parent: g });
  const arc = new THREE.TorusGeometry(w / 2, pw / 2, 8, 18, Math.PI);
  b.m(arc, mat, [0, h, 0], { parent: g, scale: [1, 1, depth / pw] });
  if (trim) {
    const lip = new THREE.TorusGeometry(w / 2 - pw / 2, 0.06, 6, 24, Math.PI);
    b.m(lip, trim, [0, h, depth / 2 + 0.02], { parent: g });
    b.m(new THREE.BoxGeometry(0.42, 0.5, depth * 1.15), trim, [0, h + w / 2 + 0.05, 0], { parent: g });
  }
  return g;
}

/** A pennant pole with a waving swallow-tail banner. */
export function banner(b, { pos, color = '#4f7dff', emblem = 'star', h = 2.8, trim = '#ffd45c', rotY = 0, pole = '#6b4b3a', size = 1 }) {
  const P = v3(pos);
  const poleMat = b.mat(pole, { rough: 0.6 });
  const gold = b.mat('#ffd45c', { rough: 0.35, metal: 0.5 });
  b.m(new THREE.CylinderGeometry(0.06, 0.08, h, 8), poleMat, [P.x, P.y + h / 2, P.z]);
  b.m(new THREE.SphereGeometry(0.13, 10, 8), gold, [P.x, P.y + h + 0.08, P.z]);
  const bar = new THREE.CylinderGeometry(0.035, 0.035, 0.95 * size, 6);
  bar.rotateZ(Math.PI / 2);
  bar.rotateY(rotY);
  b.m(bar, gold, [P.x, P.y + h - 0.12, P.z]);
  const W = 0.82 * size, H = 1.35 * size;
  const geo = new THREE.PlaneGeometry(W, H, 4, 10);
  geo.translate(0, -H / 2, 0);
  const base = Float32Array.from(geo.attributes.position.array);
  const mat = b.mat('#ffffff', { map: bannerTexture(color, emblem, trim), rough: 0.75, side: THREE.DoubleSide, alphaTest: 0.5 });
  const cloth = new THREE.Mesh(geo, mat);
  cloth.position.set(P.x, P.y + h - 0.14, P.z);
  cloth.rotation.y = rotY;
  cloth.castShadow = true;
  b.root.add(cloth);
  const ph = b.r(0, TAU);
  const pos3 = geo.attributes.position;
  b.onUpdate((dt, t) => {
    for (let i = 0; i < pos3.count; i++) {
      const y = base[i * 3 + 1], x = base[i * 3];
      const k = -y / H;
      pos3.setZ(i, Math.sin(t * 2.3 + ph + k * 3.2 + x * 1.5) * 0.09 * k);
    }
    pos3.needsUpdate = true;
  });
  return cloth;
}

/** Standing brazier / torch with flickering flame sprites. */
export function brazier(b, { pos, flame = '#ff9a3c', core = '#fff1b8', h = 1.1, stand, bowl, light = false, size = 1 }) {
  const P = v3(pos);
  stand = stand || b.mat('#5b4a6e', { rough: 0.7 });
  bowl = bowl || b.mat('#3b2e4a', { rough: 0.5, metal: 0.4 });
  b.m(new THREE.CylinderGeometry(0.12 * size, 0.22 * size, h, 8), stand, [P.x, P.y + h / 2, P.z]);
  b.m(new THREE.CylinderGeometry(0.3 * size, 0.16 * size, 0.24 * size, 10), bowl, [P.x, P.y + h + 0.08, P.z]);
  const top = new THREE.Vector3(P.x, P.y + h + 0.2 * size, P.z);
  const sprites = [];
  for (const [c, s, o] of [[flame, 0.75, 0.9], [core, 0.42, 1]]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTexture(), color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.center.set(0.5, 0.15);
    sp.position.copy(top);
    sp.scale.set(s * 0.7 * size, s * size, 1);
    b.root.add(sp);
    sprites.push([sp, s * size]);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: flame, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.copy(top).add(new THREE.Vector3(0, 0.25 * size, 0));
  glow.scale.setScalar(1.6 * size);
  b.root.add(glow);
  let pl = null;
  if (light) {
    pl = new THREE.PointLight(flame, 3, 5, 1.6);
    pl.position.copy(top).add(new THREE.Vector3(0, 0.3, 0));
    b.root.add(pl);
  }
  const ph = b.r(0, 10);
  b.onUpdate((dt, t) => {
    const f = 1 + Math.sin(t * 13 + ph) * 0.08 + Math.sin(t * 7.3 + ph * 2) * 0.06;
    for (const [sp, s] of sprites) sp.scale.set(s * 0.7 * (2 - f), s * f, 1);
    glow.material.opacity = 0.38 + (f - 1) * 1.2;
    if (pl) pl.intensity = 2.6 + (f - 1) * 6;
  });
}

/** Glowing faceted crystal; floats and spins unless static. */
export function crystal(b, { pos, color = '#6fd2ff', size = 1, float = true, glow = true, parent, emissive }) {
  const P = v3(pos);
  const g = new THREE.Group();
  g.position.copy(P);
  const geo = new THREE.OctahedronGeometry(0.5 * size, 0);
  geo.scale(0.8, 1.7, 0.8);
  const mat = b.mat(color, { rough: 0.15, metal: 0.1, flat: true, emissive: emissive || color, ei: 0.55 });
  const gem = new THREE.Mesh(geo, mat);
  gem.castShadow = true;
  g.add(gem);
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 * size, 0).scale(0.8, 1.7, 0.8), b.mat('#ffffff', { emissive: '#ffffff', ei: 0.8, flat: true }));
  inner.scale.setScalar(0.92);
  g.add(inner);
  if (glow) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.setScalar(2.6 * size);
    g.add(sp);
    b.disposables.push(sp.material);
  }
  (parent || b.root).add(g);
  if (float) {
    const ph = b.r(0, 10);
    b.onUpdate((dt, t) => {
      g.position.y = P.y + Math.sin(t * 1.4 + ph) * 0.12 * size;
      gem.rotation.y = inner.rotation.y = t * 0.6 + ph;
    });
  }
  return g;
}

/** Static cluster of small crystals poking out of the ground. */
export function crystalCluster(b, { pos, color = '#8fdcff', n = 5, size = 0.5, parent }) {
  const P = v3(pos);
  const mat = b.mat(color, { rough: 0.2, flat: true, emissive: color, ei: 0.35 });
  for (let i = 0; i < n; i++) {
    const s = size * b.r(0.5, 1.1);
    const geo = new THREE.OctahedronGeometry(0.4, 0).scale(0.6, 1.9, 0.6);
    const a = b.r(0, TAU), d = i === 0 ? 0 : b.r(0.1, 0.35) * size * 2;
    b.m(geo, mat, [P.x + Math.cos(a) * d, P.y + 0.3 * s, P.z + Math.sin(a) * d], { scale: s, rot: [b.r(-0.4, 0.4), b.r(0, 3), b.r(-0.4, 0.4)], parent });
  }
}

// ------------------------------------------------------------------ nature

/** Round, bushy cartoon tree (blobby canopy). */
export function tree(b, { pos, s = 1, leaf = ['#6cc35a', '#86d66a', '#58ad4f'], trunk = '#8a5a3c', parent }) {
  const P = v3(pos);
  const g = group(b, P, { parent, scale: s, rotY: b.r(0, TAU) });
  const tr = new THREE.CylinderGeometry(0.16, 0.26, 1.3, 7);
  b.m(tr, b.mat(trunk, { rough: 0.9 }), [0, 0.65, 0], { parent: g });
  const blobs = [[0, 1.75, 0, 0.85], [0.55, 1.45, 0.1, 0.6], [-0.5, 1.5, -0.1, 0.62], [0.1, 1.5, 0.5, 0.58], [-0.1, 2.25, -0.1, 0.55]];
  for (const [x, y, z, r] of blobs) {
    const geo = new THREE.IcosahedronGeometry(r, 1);
    jitter(geo, b, 0.06);
    b.m(geo, b.mat(b.pick(leaf), { rough: 0.9, flat: true }), [x, y, z], { parent: g });
  }
  return g;
}

/** Layered pine; snow caps optional. */
export function pine(b, { pos, s = 1, color = '#3f8f6a', snow = false, trunk = '#7a5238', parent }) {
  const g = group(b, pos, { parent, scale: s, rotY: b.r(0, TAU) });
  b.m(new THREE.CylinderGeometry(0.1, 0.16, 0.6, 6), b.mat(trunk), [0, 0.3, 0], { parent: g });
  const leaf = b.mat(color, { flat: true, rough: 0.9 });
  const white = b.mat('#f4f8ff', { flat: true, rough: 0.7 });
  [[0.85, 1.0, 0.75], [0.66, 0.85, 1.35], [0.45, 0.7, 1.85]].forEach(([r, h, y]) => {
    b.m(new THREE.ConeGeometry(r, h, 8), leaf, [0, y, 0], { parent: g });
    if (snow) b.m(new THREE.ConeGeometry(r * 0.62, h * 0.5, 8), white, [0, y + h * 0.27, 0], { parent: g });
  });
  return g;
}

/** Storybook mushroom with a spotted cap. */
export function mushroom(b, { pos, s = 1, cap = '#ff5a5f', spots = '#fff4e8', stem = '#f5e6d0', parent, tilt = 0.12 }) {
  const g = group(b, pos, { parent, scale: s, rotY: b.r(0, TAU) });
  g.rotation.z = b.r(-tilt, tilt);
  const st = new THREE.CylinderGeometry(0.16, 0.22, 0.7, 10);
  b.m(st, b.mat(stem, { rough: 0.8 }), [0, 0.35, 0], { parent: g });
  const capGeo = new THREE.SphereGeometry(0.55, 16, 10, 0, TAU, 0, Math.PI / 2);
  b.m(capGeo, b.mat(cap, { rough: 0.55 }), [0, 0.62, 0], { parent: g, scale: [1, 0.75, 1] });
  const under = new THREE.CircleGeometry(0.55, 16);
  under.rotateX(Math.PI / 2);
  b.m(under, b.mat(stem, { rough: 0.9 }), [0, 0.62, 0], { parent: g, noCast: true });
  const dot = new THREE.SphereGeometry(0.09, 8, 6);
  const sm = b.mat(spots, { rough: 0.6 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + b.r(0, 0.5), el = i === 0 ? 1.4 : b.r(0.45, 0.95);
    const x = Math.cos(a) * Math.cos(el) * 0.55, y = Math.sin(el) * 0.55 * 0.75, z = Math.sin(a) * Math.cos(el) * 0.55;
    b.m(dot, sm, [i === 0 ? 0 : x, 0.62 + (i === 0 ? 0.41 : y), i === 0 ? 0 : z], { parent: g, scale: [1, 0.45, 1] });
  }
  return g;
}

export function bush(b, { pos, s = 1, colors = ['#5fb85a', '#7acb63'], parent, flowers }) {
  const g = group(b, pos, { parent, scale: s });
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.IcosahedronGeometry(b.r(0.32, 0.45), 1);
    jitter(geo, b, 0.04);
    b.m(geo, b.mat(b.pick(colors), { flat: true, rough: 0.9 }), [b.r(-0.3, 0.3), 0.25, b.r(-0.2, 0.2)], { parent: g });
  }
  if (flowers) {
    const f = new THREE.SphereGeometry(0.07, 6, 5);
    for (let i = 0; i < 6; i++) b.m(f, b.mat(b.pick(flowers), { rough: 0.6 }), [b.r(-0.4, 0.4), b.r(0.4, 0.6), b.r(-0.3, 0.3)], { parent: g });
  }
  return g;
}

/** Scatter little flowers (stalk-less blobs) in a ring or disc. */
export function flowers(b, { center = [0, 0, 0], r0 = 0, r1 = 1, n = 30, colors, y = 0.06, size = 0.08, avoid }) {
  const C = v3(center);
  const geo = new THREE.SphereGeometry(size, 6, 5);
  const leaf = new THREE.SphereGeometry(size * 1.3, 5, 4);
  const lm = b.mat('#4fa64f', { flat: true });
  for (let i = 0; i < n; i++) {
    const a = b.r(0, TAU), d = b.r(r0, r1);
    const x = C.x + Math.cos(a) * d, z = C.z + Math.sin(a) * d;
    if (avoid?.(x, z)) continue;
    b.m(leaf, lm, [x, y - size * 0.6, z], { scale: [1.2, 0.4, 1.2], noCast: true });
    b.m(geo, b.mat(b.pick(colors), { rough: 0.6 }), [x, y, z], { noCast: true });
  }
}

/** Puffy cloud (one merged mesh). drift = units/sec along x, wrapped within ±wrap. */
export function cloud(b, { pos, s = 1, color = '#ffffff', drift = 0, wrap = 40, opacity = 1, emissive = '#ffffff', ei = 0.25 }) {
  const g = new THREE.Group();
  const n = 5 + Math.floor(b.r(0, 3));
  for (let i = 0; i < n; i++) {
    const r = b.r(0.6, 1.1) * (i === 0 ? 1.3 : 1);
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2));
    m.position.set((i - n / 2) * 0.75 + b.r(-0.2, 0.2), b.r(-0.1, 0.35) + (i === 0 ? 0.3 : 0), b.r(-0.4, 0.4));
    m.scale.y = 0.75;
    g.add(m);
  }
  const mat = b.mat(color, { rough: 1, emissive, ei, opacity });
  const mesh = mergeToMesh(g, mat);
  const P = v3(pos);
  mesh.position.copy(P);
  mesh.scale.setScalar(s);
  b.root.add(mesh);
  if (drift) {
    b.onUpdate((dt) => {
      mesh.position.x += drift * dt;
      if (mesh.position.x > wrap) mesh.position.x = -wrap;
    });
  }
  return mesh;
}

/** Sea of clouds below a floating island (big flattened puffs). */
export function cloudSea(b, { y = -6, r0 = 10, r1 = 34, n = 26, color = '#ffffff', emissive = '#ffffff', ei = 0.3 }) {
  for (let i = 0; i < n; i++) {
    const a = b.r(0, TAU), d = b.r(r0, r1);
    cloud(b, { pos: [Math.cos(a) * d, y + b.r(-1.5, 1), Math.sin(a) * d], s: b.r(1.6, 3.2), color, emissive, ei, drift: 0 });
  }
}

/** Animated waterfall ribbon (scrolling texture) + mist puff. */
export function waterfall(b, { pos, w = 0.8, h = 4, rotY = 0, colors = ['#bfe6ff', '#ffffff', '#8fd0ff'], speed = 0.8, glow = false }) {
  const tex = streakTexture('falls:' + colors.join(), colors).clone();
  tex.needsUpdate = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, h / 3);
  b.disposables.push(tex);
  const mat = b.basic('#ffffff', { map: tex, opacity: 0.9, side: THREE.DoubleSide, additive: glow });
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  geo.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(v3(pos));
  m.rotation.y = rotY;
  b.root.add(m);
  const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: colors[1], transparent: true, opacity: 0.6, depthWrite: false }));
  mist.position.copy(m.position).add(new THREE.Vector3(0, -h, 0));
  mist.scale.set(w * 2.5, w * 1.6, 1);
  b.root.add(mist);
  b.disposables.push(mist.material);
  b.onUpdate((dt) => (tex.offset.y += dt * speed));
  return m;
}

/** Additive glow sprite; pulse > 0 breathes its opacity. */
export function glow(b, { pos, color, size = 2, opacity = 0.5, pulse = 0, parent }) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.position.copy(v3(pos));
  sp.scale.setScalar(size);
  (parent || b.root).add(sp);
  b.disposables.push(sp.material);
  if (pulse) {
    const ph = b.r(0, 10);
    b.onUpdate((dt, t) => (sp.material.opacity = opacity * (1 - pulse + pulse * (0.5 + 0.5 * Math.sin(t * 2 + ph)))));
  }
  return sp;
}

/**
 * Ambient particles. mode: 'rise' (embers, motes), 'fall' (snow), 'drift' (fireflies, petals).
 * box: [minX, minY, minZ, maxX, maxY, maxZ].
 */
export function particles(b, { n = 80, box, color = '#ffffff', size = 0.12, mode = 'drift', speed = 0.4, tex, additive = true, opacity = 0.9 }) {
  const [x0, y0, z0, x1, y1, z1] = box;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = b.r(x0, x1);
    pos[i * 3 + 1] = b.r(y0, y1);
    pos[i * 3 + 2] = b.r(z0, z1);
    seed[i] = b.r(0, 10);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, map: tex || dotTexture(), transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  b.root.add(pts);
  b.onUpdate((dt, t) => {
    for (let i = 0; i < n; i++) {
      const k = i * 3, s = seed[i];
      if (mode === 'rise') {
        pos[k + 1] += dt * speed * (0.6 + (s % 1));
        pos[k] += Math.sin(t * 1.3 + s) * dt * 0.25;
        if (pos[k + 1] > y1) pos[k + 1] = y0;
      } else if (mode === 'fall') {
        pos[k + 1] -= dt * speed * (0.7 + (s % 1) * 0.6);
        pos[k] += Math.sin(t * 0.9 + s) * dt * 0.35;
        pos[k + 2] += Math.cos(t * 0.7 + s) * dt * 0.2;
        if (pos[k + 1] < y0) pos[k + 1] = y1;
      } else {
        pos[k] += Math.sin(t * 0.6 + s * 1.7) * dt * speed;
        pos[k + 1] += Math.sin(t * 0.9 + s) * dt * speed * 0.5;
        pos[k + 2] += Math.cos(t * 0.5 + s * 1.3) * dt * speed;
      }
    }
    geo.attributes.position.needsUpdate = true;
    if (mode === 'drift') mat.opacity = opacity * (0.75 + 0.25 * Math.sin(t * 2.2));
  });
  return pts;
}

// ------------------------------------------------------------------ set pieces

/** Fairy-tale castle: keep, corner towers, roofs, central spire. Static. */
export function castle(b, { pos, s = 1, wall, roof, trim, parent, rotY = 0, spire = true }) {
  const g = group(b, pos, { parent, scale: s, rotY });
  const box = new THREE.BoxGeometry(1, 1, 1);
  b.m(box, wall, [0, 0.9, 0], { scale: [2.6, 1.8, 2], parent: g });
  // walls crenellation
  for (let i = -3; i <= 3; i += 2) b.m(box, wall, [i * 0.35, 1.95, 1.0], { scale: [0.3, 0.3, 0.2], parent: g });
  // keep
  b.m(box, wall, [0, 2.2, -0.2], { scale: [1.3, 1.6, 1.2], parent: g });
  const keepRoof = new THREE.ConeGeometry(1.0, 1.2, 4);
  keepRoof.rotateY(Math.PI / 4);
  b.m(keepRoof, roof, [0, 3.6, -0.2], { parent: g, scale: [1, 1, 0.9] });
  // door + windows
  const door = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12, 1, false, 0, Math.PI);
  door.rotateX(Math.PI / 2);
  b.m(new THREE.BoxGeometry(0.64, 0.6, 0.1), b.mat('#4a3260'), [0, 0.3, 1.01], { parent: g, noCast: true });
  b.m(door, b.mat('#4a3260'), [0, 0.6, 1.01], { parent: g, noCast: true, rot: [0, 0, Math.PI / 2 - Math.PI / 2] });
  for (const [x, y] of [[-0.8, 1.2], [0.8, 1.2], [-0.3, 2.5], [0.3, 2.5]]) b.m(new THREE.BoxGeometry(0.18, 0.28, 0.06), b.mat('#ffe07a', { emissive: '#ffcf4a', ei: 0.6 }), [x, y, y > 2 ? 0.41 : 1.01], { parent: g, noCast: true });
  for (const [x, z, h] of [[-1.35, 1.0, 2.2], [1.35, 1.0, 2.2], [-1.35, -1.0, 2.6], [1.35, -1.0, 2.6]]) tower(b, { pos: [x, 0, z], r: 0.42, h, mat: wall, roof, trim, roofH: 1.0, parent: g });
  if (spire) tower(b, { pos: [0, 2.9, -0.2], r: 0.3, h: 1.4, mat: wall, roof, trim, roofH: 1.1, parent: g });
  return g;
}

/** Cone volcano with glowing crater (static) + smoke puffs (animated). */
export function volcano(b, { pos, r = 4, h = 5, rock, lava = '#ff6a2a' }) {
  const P = v3(pos);
  const geo = new THREE.CylinderGeometry(r * 0.22, r, h, 12, 3);
  jitter(geo, b, 0.25);
  b.m(geo, rock, [P.x, P.y + h / 2, P.z]);
  const crater = new THREE.CircleGeometry(r * 0.2, 12);
  crater.rotateX(-Math.PI / 2);
  b.m(crater, b.mat(lava, { emissive: lava, ei: 1.4 }), [P.x, P.y + h + 0.02, P.z], { noCast: true });
  glow(b, { pos: [P.x, P.y + h + 0.6, P.z], color: lava, size: r * 1.6, opacity: 0.55, pulse: 0.3 });
  // lava streak down the front
  const streak = new THREE.PlaneGeometry(r * 0.18, h * 0.8);
  const sm = b.mat(lava, { emissive: lava, ei: 1.2, side: THREE.DoubleSide });
  const m = b.m(streak, sm, [P.x + r * 0.12, P.y + h * 0.55, P.z + r * 0.48], { rot: [-0.62, 0, 0], noCast: true });
  return m;
}
