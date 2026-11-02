import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gradientTexture } from '../../core/textures.js';
import { seeded } from '../../core/math.js';

/**
 * Shared scaffolding for every map and scene: material bank, sky + fog,
 * the standard light rig, static-geometry baking (one draw call per material),
 * per-frame updaters and disposal. Props add static meshes to `b.static`
 * (baked at the end) and anything that moves to `b.root`.
 */
export class MapBuilder {
  constructor(scene, { name = 'map', seed = 1 } = {}) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = name;
    scene.add(this.root);
    this.static = new THREE.Group();
    this.rnd = seeded(seed);
    this.mats = new Map();
    this.updaters = [];
    this.disposables = [];
    this.t = 0;
  }

  /** Random float in [a, b). */
  r(a = 0, b = 1) {
    return a + this.rnd() * (b - a);
  }

  pick(arr) {
    return arr[Math.floor(this.rnd() * arr.length)];
  }

  /** Cached MeshStandardMaterial. opts: rough, metal, flat, emissive, ei, map, emissiveMap, side, opacity. */
  mat(color, opts = {}) {
    const key = color + JSON.stringify(opts, (k, v) => (v && v.isTexture ? v.uuid : v));
    if (this.mats.has(key)) return this.mats.get(key);
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.85,
      metalness: opts.metal ?? 0,
      flatShading: !!opts.flat,
      map: opts.map || null,
      emissive: opts.emissive || '#000000',
      emissiveIntensity: opts.ei ?? (opts.emissive ? 1 : 0),
      emissiveMap: opts.emissiveMap || null,
      side: opts.side ?? THREE.FrontSide,
      transparent: opts.opacity !== undefined && opts.opacity < 1,
      opacity: opts.opacity ?? 1,
      alphaTest: opts.alphaTest ?? 0,
      depthWrite: opts.depthWrite ?? true,
    });
    this.mats.set(key, m);
    return m;
  }

  /** Unlit material (glows, sprites, water). Not cached. */
  basic(color, opts = {}) {
    const m = new THREE.MeshBasicMaterial({
      color,
      map: opts.map || null,
      transparent: true,
      opacity: opts.opacity ?? 1,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: opts.side ?? THREE.FrontSide,
      fog: opts.fog ?? true,
    });
    this.disposables.push(m);
    return m;
  }

  /** Mesh helper: m(geo, mat, [x,y,z], { rot:[x,y,z], scale, parent, noCast }) — static by default. */
  m(geo, mat, pos = [0, 0, 0], o = {}) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    if (o.rot) mesh.rotation.set(...o.rot);
    if (o.scale !== undefined) typeof o.scale === 'number' ? mesh.scale.setScalar(o.scale) : mesh.scale.set(...o.scale);
    if (o.noCast) mesh.userData.noCast = true;
    mesh.castShadow = !o.noCast;
    mesh.receiveShadow = true;
    (o.parent || this.static).add(mesh);
    return mesh;
  }

  onUpdate(fn) {
    this.updaters.push(fn);
  }

  /** Background gradient (0 = top) and distance fog. */
  sky(stops, fog) {
    this.scene.background = gradientTexture(this.root.name + ':sky', stops);
    if (fog) this.scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
  }

  /** Hemisphere + shadowed sun + rim light. */
  lights({ hemi = ['#fff6ff', '#6f5fae', 1.1], sun = {}, rim = null, shadow = 9, env } = {}) {
    const hl = new THREE.HemisphereLight(...hemi);
    this.root.add(hl);
    const s = new THREE.DirectionalLight(sun.color || '#fff3e6', sun.intensity ?? 2.4);
    s.position.set(...(sun.pos || [-4, 9, 6]));
    s.target.position.set(...(sun.target || [0, 0, 0]));
    s.castShadow = true;
    s.shadow.mapSize.set(2048, 2048);
    const sc = s.shadow.camera;
    sc.left = -shadow * 1.25;
    sc.right = shadow * 1.25;
    sc.top = shadow;
    sc.bottom = -shadow;
    sc.near = 0.5;
    sc.far = 40;
    s.shadow.bias = -0.0005;
    s.shadow.normalBias = 0.02;
    this.root.add(s, s.target);
    if (rim) {
      const rl = new THREE.DirectionalLight(rim.color, rim.intensity ?? 1);
      rl.position.set(...(rim.pos || [3, 4, -7]));
      this.root.add(rl);
    }
    if (env !== undefined) this.scene.environmentIntensity = env;
    this.sun = s;
    return s;
  }

  /** Merge every static mesh into one mesh per material (and shadow flag). */
  bake(group = this.static) {
    group.updateMatrixWorld(true);
    const buckets = new Map();
    group.traverse((o) => {
      if (!o.isMesh) return;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.morphAttributes = {};
      g.clearGroups();
      g.applyMatrix4(o.matrixWorld);
      const key = o.material.uuid + (o.userData.noCast ? ':flat' : '');
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: !o.userData.noCast, geos: [] });
      buckets.get(key).geos.push(g);
    });
    const used = new Set();
    group.traverse((o) => o.isMesh && used.add(o.geometry));
    for (const { mat, cast, geos } of buckets.values()) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.root.add(mesh);
    }
    used.forEach((g) => g.dispose());
    group.clear();
  }

  /** Bake statics and return the map instance the game expects. */
  finish(extra) {
    this.bake();
    const self = this;
    return {
      root: this.root,
      ...extra,
      update(dt, t) {
        self.t += dt;
        for (const fn of self.updaters) fn(dt, self.t);
      },
      dispose() {
        self.root.traverse((o) => {
          o.geometry?.dispose();
          if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        });
        self.mats.forEach((m) => m.dispose());
        self.disposables.forEach((d) => d.dispose());
        self.root.removeFromParent();
        self.scene.fog = null;
        self.updaters.length = 0;
      },
    };
  }
}
