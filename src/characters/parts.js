import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Procedural "clay toy" building blocks used by every chibi model.

export function makeMaterials(defs) {
  const out = {};
  for (const [k, v] of Object.entries(defs)) {
    const o = typeof v === 'object' ? v : { color: v };
    out[k] = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, ...o });
    out[k].name = k; // names survive GLB export (Blender pipeline, see tools/blender/README.md)
  }
  return out;
}

/** Add a mesh to parent. opts: p (pos), r (rot), s (scale number|[x,y,z]), name, shadow */
export function add(parent, geo, mat, { p = [0, 0, 0], r = [0, 0, 0], s = 1, name, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(r[0], r[1], r[2]);
  if (typeof s === 'number') m.scale.setScalar(s);
  else m.scale.set(s[0], s[1], s[2]);
  m.castShadow = shadow;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

export const sphere = (r = 1, w = 28, h = 20) => new THREE.SphereGeometry(r, w, h);
export const cyl = (rt, rb, h, seg = 24, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
export const roundedBox = (w, h, d, radius, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, radius);

/** Soft lumpy blob — fur tufts, hair waves, clouds. Smooth-shaded. */
export function fluff(radius, { detail = 3, amp = 0.08, freq = 3, seed = 1 } = {}) {
  let g = new THREE.IcosahedronGeometry(radius, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n =
      Math.sin(v.x * freq * 3.1 + seed) * Math.sin(v.y * freq * 2.3 + seed * 1.7) * Math.sin(v.z * freq * 2.7 + seed * 0.6) +
      0.5 * Math.sin(v.x * freq * 6.2 + seed * 2.1) * Math.sin(v.z * freq * 5.1 + seed);
    v.multiplyScalar(radius * (1 + amp * n));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Tint vertices from colorA (bottom) to colorB (top) along local Y. Material needs vertexColors. */
export function gradientY(geo, colorA, colorB, y0, y1) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Color(colorA), b = new THREE.Color(colorB), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - y0) / (y1 - y0), 0, 1);
    c.copy(a).lerp(b, t);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Lathe from [radius, y] pairs (y descending works fine). */
export function lathe(points, seg = 28) {
  // LatheGeometry wants the profile bottom-to-top for outward normals.
  const pts = points[0][1] > points[points.length - 1][1] ? points.slice().reverse() : points;
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

/** Five-petal flower facing +Z. */
export function flower(parent, petalMat, centerMat, size, opts) {
  const g = new THREE.Group();
  const petal = sphere(1, 14, 10);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    add(g, petal, petalMat, { p: [Math.cos(a) * size * 0.95, Math.sin(a) * size * 0.95, 0], r: [0, 0, a], s: [size * 0.95, size * 0.72, size * 0.45] });
  }
  add(g, sphere(1, 12, 10), centerMat, { p: [0, 0, size * 0.32], s: [size * 0.55, size * 0.55, size * 0.4] });
  place(g, opts);
  parent.add(g);
  return g;
}

/** Small temple bell (opening down). */
let bellGeo;
export function bell(parent, mat, darkMat, size, opts) {
  bellGeo ||= lathe([[0, 1.25], [0.32, 1.18], [0.62, 0.88], [0.78, 0.3], [0.9, -0.25], [1.05, -0.62], [0.98, -0.72], [0, -0.66]], 18);
  const g = new THREE.Group();
  add(g, bellGeo, mat, { s: size });
  add(g, new THREE.TorusGeometry(0.32, 0.12, 8, 14), mat, { p: [0, 1.35 * size, 0], s: size });
  add(g, new THREE.BoxGeometry(0.18, 0.62, 0.1), darkMat, { p: [0, -0.32 * size, 0.86 * size], s: size, shadow: false });
  add(g, sphere(0.2, 8, 6), darkMat, { p: [0, -0.74 * size, 0], s: size, shadow: false });
  place(g, opts);
  parent.add(g);
  return g;
}

function place(obj, { p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
  obj.position.set(p[0], p[1], p[2]);
  obj.rotation.set(r[0], r[1], r[2]);
  if (typeof s === 'number') obj.scale.setScalar(s);
  else obj.scale.set(s[0], s[1], s[2]);
}

/** Count triangles under an object (for model spec readouts). */
export function countTris(root) {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    n += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  });
  return Math.round(n);
}
