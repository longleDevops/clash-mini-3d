import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/**
 * Blender pipeline for hero bodies (contract: tools/blender/README.md).
 *
 * The rig, clips, face canvas, anchors and props stay in code. A body GLB only
 * supplies meshes + materials in the rest pose, each parented (in Blender) to an
 * empty named after the rig bone that should carry it. At load time every mesh is
 * re-homed onto the code rig: its rest-pose placement is baked into the geometry
 * relative to that bone, so the existing clips drive it unchanged.
 *
 *   toBlockout(built)       code model -> blockout scene for GLTFExporter (Blender reference)
 *   loadBodyAsset(url)      GLB (embedded in the artifact, or fetched in dev) -> gltf | null
 *   attachBody(built, gltf) put the GLB meshes onto a freshly built rig
 *
 * Skinned bodies (one weighted mesh with its own armature, e.g. from an
 * image-to-3D tool) are supported too: every GLB node named like a rig bone
 * follows that code bone through a fixed rest offset, so the same clips drive it.
 */

export const MODEL_SCALE = 0.01; // model units -> world units (= Blender metres)

// ---------------------------------------------------------------- export side

export function toBlockout({ root, rig }) {
  root.updateMatrixWorld(true);
  const boneName = new Map(Object.entries(rig.bones).map(([n, b]) => [b, n]));
  const scene = new THREE.Group();
  scene.name = `${root.name || 'hero'}_blockout`;
  const nodes = {};
  for (const [name, b] of Object.entries(rig.bones)) {
    const n = new THREE.Object3D();
    n.name = name;
    n.position.copy(b.position).multiplyScalar(MODEL_SCALE);
    n.quaternion.copy(b.quaternion);
    (nodes[boneName.get(b.parent)] || scene).add(n);
    nodes[name] = n;
  }
  const S = new THREE.Matrix4().makeScale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
  const rel = new THREE.Matrix4();
  const seq = {};
  const report = { bones: Object.keys(nodes).length, meshes: 0, tris: 0, perBone: {} };
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return; // sprites (glows, flames) stay code-only
    let b = o.parent;
    while (b && !boneName.has(b)) b = b.parent;
    if (!b) return;
    const bn = boneName.get(b);
    rel.copy(b.matrixWorld).invert().multiply(o.matrixWorld).premultiply(S);
    const geo = o.geometry.clone();
    geo.applyMatrix4(rel);
    let flip = rel.determinant() < 0;
    let mats = [].concat(o.material);
    if (mats.length === 1 && mats[0].side === THREE.BackSide) {
      // glTF has no back-side-only materials: turn the faces around instead
      flip = !flip;
      negateNormals(geo);
      const c = mats[0].clone();
      c.side = THREE.FrontSide;
      c.name = mats[0].name;
      mats = [c];
    }
    if (flip) flipWinding(geo);
    const mat = mats.length === 1 ? mats[0] : mats;
    const label = `${bn}.${mats[0].name || 'mat'}`;
    seq[label] = (seq[label] || 0) + 1;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${label}.${String(seq[label]).padStart(2, '0')}`;
    nodes[bn].add(mesh);
    const tris = triCount(geo);
    report.meshes++;
    report.tris += tris;
    report.perBone[bn] = (report.perBone[bn] || 0) + tris;
  });
  return { scene, report };
}

// ---------------------------------------------------------------- import side

let loader;
const pending = new Map();

/** Load a body GLB. The artifact build embeds files in window.__SKYWARD_ASSETS__; dev fetches them. */
export function loadBodyAsset(url) {
  if (!pending.has(url)) pending.set(url, _load(url));
  return pending.get(url);
}

async function _load(url) {
  try {
    const bundled = globalThis.__SKYWARD_ASSETS__; // set by the artifact build (may be empty)
    let buf;
    if (bundled?.[url]) buf = Uint8Array.from(atob(bundled[url]), (c) => c.charCodeAt(0)).buffer;
    else if (bundled) return null;
    else {
      const res = await fetch(url);
      if (!res.ok) return null;
      buf = await res.arrayBuffer();
    }
    loader ||= new GLTFLoader();
    return await loader.parseAsync(buf, '');
  } catch (e) {
    console.warn(`[body] ${url} not loaded, using the code-built model`, e);
    return null;
  }
}

/**
 * Re-home the GLB meshes onto a code-built rig (rest pose, root at the origin).
 * opts.face: { material, w, h, centerY } — meshes using a material named "face"
 *   go on the head bone and get planar UVs in head units for the painted face.
 * opts.skip: bone names whose meshes stay code-built (e.g. 'prop' for the staff).
 */
export function attachBody({ root, rig }, gltf, { face, skip = ['prop'], castShadow = true } = {}) {
  root.updateMatrixWorld(true);
  const src = gltf.scene;
  src.updateMatrixWorld(true);
  const json = gltf.parser?.json;
  const realName = (o) => {
    const a = gltf.parser?.associations?.get(o);
    return (a?.nodes !== undefined && json?.nodes?.[a.nodes]?.name) || o.name;
  };
  let skinned = false;
  src.traverse((o) => (skinned ||= !!o.isSkinnedMesh));
  if (skinned) return attachSkinned({ root, rig }, src, realName, { skip, castShadow });

  const SKIP = Symbol('skip');
  const boneFor = (o) => {
    for (let x = o; x && x !== src; x = x.parent) {
      if (x.userData?.bone && rig.bones[x.userData.bone]) return x.userData.bone;
      const n = realName(x);
      if (skip.includes(n) || skip.includes(n.replace(/\.\d{3}$/, ''))) return SKIP;
      const bn = codeBoneName(n, rig);
      if (bn) return bn;
    }
    return null;
  };

  const meshes = [];
  src.traverse((o) => o.isMesh && meshes.push(o));
  const matCache = new Map();
  const ownMat = (m) => {
    if (!matCache.has(m)) matCache.set(m, m.clone());
    return matCache.get(m);
  };
  const stats = { meshes: 0, tris: 0, unassigned: [] };
  const M = new THREE.Matrix4();
  for (const o of meshes) {
    const isFace = face && [].concat(o.material).some((m) => /^face(\.\d+)?$/.test(m?.name || ''));
    let bn = isFace ? 'head' : boneFor(o);
    if (bn === SKIP) continue;
    if (!bn) {
      stats.unassigned.push(realName(o));
      bn = 'base';
    }
    const bone = rig.bones[bn];
    M.copy(bone.matrixWorld).invert().multiply(o.matrixWorld);
    const geo = o.geometry.clone();
    geo.applyMatrix4(M);
    if (M.determinant() < 0) flipWinding(geo);
    let mat;
    if (isFace) {
      planarUV(geo, face);
      mat = face.material;
    } else mat = Array.isArray(o.material) ? o.material.map(ownMat) : ownMat(o.material);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = realName(o);
    mesh.castShadow = castShadow;
    bone.add(mesh);
    stats.meshes++;
    stats.tris += triCount(geo);
  }
  if (stats.unassigned.length) console.warn('[body] meshes without a bone parent (put on base):', stats.unassigned);
  return stats;
}

// Common armature names -> rig bone names (after dropping .L/.R separators).
const ALIASES = { upper_armL: 'armL', upper_armR: 'armR', upperarmL: 'armL', upperarmR: 'armR', forearmL: 'foreArmL', forearmR: 'foreArmR', lower_armL: 'foreArmL', lower_armR: 'foreArmR' };

function codeBoneName(n, rig) {
  if (rig.bones[n]) return n;
  const k = n.replace(/\.\d{3}$/, '').replace(/[._]([LR])$/, '$1'); // Blender duplicate suffix, side separator
  if (rig.bones[k]) return k;
  if (ALIASES[k] && rig.bones[ALIASES[k]]) return ALIASES[k];
  return null;
}

/** Skinned body: keep the GLB armature and make its bones follow the code rig every frame. */
function attachSkinned({ root, rig }, src, realName, { skip, castShadow }) {
  const copy = cloneSkinned(src);
  const original = new Map();
  (function pair(a, b) {
    original.set(b, a);
    for (let i = 0; i < a.children.length; i++) pair(a.children[i], b.children[i]);
  })(src, copy);
  copy.name = 'skinnedBody';
  root.add(copy);
  root.updateMatrixWorld(true);
  const stats = { meshes: 0, tris: 0, unassigned: [], skinned: true, followed: [] };
  const follows = [];
  copy.traverse((o) => {
    if (o.isMesh) {
      o.geometry = o.geometry.clone();
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      o.castShadow = castShadow;
      if (o.isSkinnedMesh) o.frustumCulled = false; // bounds don't follow the pose
      stats.meshes++;
      stats.tris += triCount(o.geometry);
      return;
    }
    if (o === copy) return;
    const n = realName(original.get(o) || o);
    if (skip.includes(n)) return;
    const bn = codeBoneName(n, rig);
    if (!bn) return;
    const bone = rig.bones[bn];
    follows.push({ node: o, bone, offset: new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(o.matrixWorld) });
    stats.followed.push(bn);
  });
  const m = new THREE.Matrix4();
  // Call after the clips + secondary motion have posed the code rig.
  stats.follow = () => {
    root.updateMatrixWorld(true);
    for (const f of follows) {
      f.node.parent.updateWorldMatrix(true, false);
      m.copy(f.node.parent.matrixWorld).invert().multiply(f.bone.matrixWorld).multiply(f.offset);
      m.decompose(f.node.position, f.node.quaternion, f.node.scale);
    }
  };
  return stats;
}

/** Planar projection of the head's front in head units, matching FaceCanvas drawing space. */
function planarUV(geo, { w, h, centerY = 0 }) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / w + 0.5;
    uv[i * 2 + 1] = (pos.getY(i) - centerY) / h + 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ---------------------------------------------------------------- helpers

function flipWinding(geo) {
  if (geo.index) {
    const idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
    geo.index.needsUpdate = true;
    return;
  }
  for (const attr of Object.values(geo.attributes)) {
    const a = attr.array, n = attr.itemSize;
    for (let v = 0; v + 2 < attr.count; v += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (v + 1) * n + k, i2 = (v + 2) * n + k;
        const t = a[i1];
        a[i1] = a[i2];
        a[i2] = t;
      }
    }
    attr.needsUpdate = true;
  }
}

function negateNormals(geo) {
  const nrm = geo.attributes.normal;
  if (!nrm) return;
  for (let i = 0; i < nrm.array.length; i++) nrm.array[i] = -nrm.array[i];
  nrm.needsUpdate = true;
}

function triCount(geo) {
  return (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
}
