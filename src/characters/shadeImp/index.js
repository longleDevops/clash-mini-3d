import * as THREE from 'three';
import { registerUnit } from '../registry.js';
import { Rig } from '../rig/Rig.js';
import { FaceCanvas, facePaint as F } from '../FaceCanvas.js';
import { makeMaterials, add, sphere, cyl, roundedBox, fluff, countTris } from '../parts.js';

/**
 * PLACEHOLDER ENEMY — "Shade Imp". A simple, generic opponent so Lyra has
 * something to fight while the real enemy roster is designed. It uses the
 * shared humanoid bone names, so it can borrow any hero clip.
 */
const UNIT = 0.01;
const HEAD = { w: 40, h: 34, d: 34, r: 12 };

function drawImpFace(variant) {
  return (ctx, S, expr, blink) => {
    const X = (u) => (u / HEAD.w + 0.5) * S;
    const Y = (v) => (0.5 - v / HEAD.h) * S;
    const k = S / HEAD.w;
    ctx.fillStyle = variant.skin;
    ctx.fillRect(0, 0, S, S);
    const eye = variant.eye;
    for (const sx of [-1, 1]) {
      const x = X(sx * 8), y = Y(-1);
      if (blink || expr === 'sleepy') {
        F.stroke(ctx, [[x - 3 * k, y], [x + 3 * k, y]], { color: eye, lw: 1.2 * k });
        continue;
      }
      const g = ctx.createRadialGradient(x, y, 0, x, y, 5 * k);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, eye);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 6 * k, y - 6 * k, 12 * k, 12 * k);
      ctx.save();
      ctx.fillStyle = eye;
      ctx.beginPath();
      // angled, mischievous eyes
      ctx.ellipse(x, y, 3.1 * k, (expr === 'surprised' ? 3.4 : 2.3) * k, sx * -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // jagged grin
    const my = Y(-9);
    ctx.fillStyle = '#1a1230';
    ctx.beginPath();
    ctx.moveTo(X(-6), my);
    ctx.quadraticCurveTo(X(0), my + (expr === 'surprised' ? 4 : 3) * k, X(6), my);
    ctx.quadraticCurveTo(X(0), my + 1 * k, X(-6), my);
    ctx.fill();
    ctx.fillStyle = '#f4ecff';
    for (const t of [-3.4, 0, 3.4]) {
      ctx.beginPath();
      ctx.moveTo(X(t - 1), my + 0.5 * k);
      ctx.lineTo(X(t + 1), my + 0.5 * k);
      ctx.lineTo(X(t), my + 2.2 * k);
      ctx.fill();
    }
  };
}

function buildImp({ variant = 'imp' } = {}) {
  const V = VARIANTS[variant];
  const m = makeMaterials({
    skin: { color: V.skin, roughness: 0.7 },
    cloak: { color: V.cloak, roughness: 0.75, side: THREE.DoubleSide },
    trim: { color: V.trim, roughness: 0.5 },
    horn: { color: V.horn, roughness: 0.45 },
    claw: { color: '#efe6ff', roughness: 0.4 },
    dark: { color: '#1d1530', roughness: 0.8 },
  });
  const root = new THREE.Group();
  root.name = V.name;
  const body = new THREE.Group();
  body.scale.setScalar(UNIT * V.scale);
  root.add(body);

  const rig = new Rig();
  const base = rig.bone('base', body);
  const hips = rig.bone('hips', base, [0, 20, 0]);
  const spine = rig.bone('spine', hips, [0, 6, 0]);
  const chest = rig.bone('chest', spine, [0, 8, 0]);
  const neck = rig.bone('neck', chest, [0, 12, 0]);
  const head = rig.bone('head', neck, [0, 2, 0]);
  const earL = rig.bone('earL', head, [12, 30, 2], [0.2, 0, -0.5]);
  const earR = rig.bone('earR', head, [-12, 30, 2], [0.2, 0, 0.5]);
  const armL = rig.bone('armL', chest, [13, 9, 0], [-0.1, 0, 0.35]);
  const foreArmL = rig.bone('foreArmL', armL, [0, -9, 0], [-0.5, 0, 0]);
  const handL = rig.bone('handL', foreArmL, [0, -9, 0]);
  const armR = rig.bone('armR', chest, [-13, 9, 0], [-0.1, 0, -0.35]);
  const foreArmR = rig.bone('foreArmR', armR, [0, -9, 0], [-0.5, 0, 0]);
  const handR = rig.bone('handR', foreArmR, [0, -9, 0]);
  const legs = [];
  for (const sx of [1, -1]) {
    const s = sx > 0 ? 'L' : 'R';
    const thigh = rig.bone('thigh' + s, hips, [sx * 6, 0, 0]);
    const shin = rig.bone('shin' + s, thigh, [0, -9, 0]);
    const foot = rig.bone('foot' + s, shin, [0, -7, 0]);
    legs.push([thigh, shin, foot]);
  }
  const tail0 = rig.bone('tail0', hips, [0, -2, -10], [-2.0, 0, 0]);

  const face = new FaceCanvas(drawImpFace(V));
  const faceMat = new THREE.MeshStandardMaterial({ map: face.texture, roughness: 0.7 });
  const hg = roundedBox(HEAD.w, HEAD.h, HEAD.d, HEAD.r, 4);
  const g = hg.groups.find((gr) => gr.materialIndex === 4);
  for (let i = g.start; i < g.start + g.count; i++) hg.attributes.uv.setXY(i, hg.attributes.position.getX(i) / HEAD.w + 0.5, hg.attributes.position.getY(i) / HEAD.h + 0.5);
  add(head, hg, [m.skin, m.skin, m.skin, m.skin, faceMat, m.skin], { p: [0, HEAD.h / 2, 0] });
  // hood
  add(head, new THREE.SphereGeometry(25, 32, 18, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.62), m.cloak, { p: [0, 17, -2], s: [1, 0.95, 1] });
  add(head, new THREE.TorusGeometry(19, 1.2, 8, 40, Math.PI * 1.2), m.trim, { p: [0, 15, 8], r: [0.2, 0, -0.1 * Math.PI] });
  // horns
  for (const [ear, sx] of [[earL, 1], [earR, -1]]) {
    add(ear, new THREE.ConeGeometry(4, 14, 12), m.horn, { p: [0, 6, 0], r: [0, 0, sx * -0.25] });
  }
  // body: cloak cone + belly
  add(chest, new THREE.ConeGeometry(18, 30, 24, 1, true), m.cloak, { p: [0, -2, 0] });
  add(spine, sphere(12, 20, 14), m.skin, { p: [0, 4, 3], s: [1, 1, 0.9] });
  add(chest, new THREE.TorusGeometry(9, 1.6, 8, 24), m.trim, { p: [0, 11, 0], r: [Math.PI / 2, 0, 0] });
  // arms + claws
  for (const [arm, fore, hand] of [[armL, foreArmL, handL], [armR, foreArmR, handR]]) {
    add(arm, cyl(4, 3.6, 10, 12), m.skin, { p: [0, -4.5, 0] });
    add(fore, cyl(3.6, 3.2, 9, 12), m.skin, { p: [0, -4.5, 0] });
    add(hand, sphere(4.4, 14, 10), m.skin);
    for (const dx of [-2, 0, 2]) add(hand, new THREE.ConeGeometry(1, 4.5, 6), m.claw, { p: [dx, -4, 1.5], r: [Math.PI + 0.3, 0, 0] });
  }
  for (const [thigh, shin, foot] of legs) {
    add(thigh, cyl(4.2, 3.8, 9, 12), m.skin, { p: [0, -4.5, 0] });
    add(shin, cyl(3.8, 3.4, 7, 12), m.dark, { p: [0, -3.5, 0] });
    add(foot, roundedBox(8, 5, 11, 2.2, 2), m.dark, { p: [0, -1.5, 2] });
  }
  add(tail0, cyl(0.8, 2.6, 22, 8), m.skin, { p: [0, 11, 0] });
  add(tail0, new THREE.ConeGeometry(3.2, 6, 4), m.horn, { p: [0, 24, 0] });

  rig.captureRest();
  const anchors = {
    overhead: anchorAt(body, [0, 112, 0]),
    chest: anchorAt(chest, [0, 4, 10]),
    feet: anchorAt(body, [0, 0, 0]),
  };
  anchors.staffGem = anchors.chest;

  function secondary(ch, dt, t) {
    tail0.rotation.z += Math.sin(t * 3) * 0.3 * (ch.alive ? 1 : 0.2);
    earL.rotation.z += Math.sin(t * 2.4) * 0.03;
    earR.rotation.z -= Math.sin(t * 2.4) * 0.03;
  }

  return { root, rig, face, anchors, secondary, stats: { tris: countTris(root), bones: rig.count } };
}

function anchorAt(parent, p) {
  const o = new THREE.Object3D();
  o.position.set(...p);
  parent.add(o);
  return o;
}

const VARIANTS = {
  imp: { name: 'Shade Imp', scale: 1, skin: '#5b4796', cloak: '#2b2540', trim: '#8a5cff', horn: '#e6a42a', eye: '#ffd45c' },
  brute: { name: 'Shade Brute', scale: 1.4, skin: '#6b3f7f', cloak: '#241a36', trim: '#ff5c8a', horn: '#ffb35c', eye: '#ff6a5c' },
};

const IMP_CLIPS = {
  idle: {
    duration: 1.2,
    loop: true,
    pos: { hips: [[0, 0, 0, 0], [0.6, 0, -1.6, 0], [1.2, 0, 0, 0]] },
    rot: {
      spine: [[0, 6, 0, 0], [0.6, 10, 0, 0], [1.2, 6, 0, 0]],
      head: [[0, -4, 0, -4], [0.6, 2, 0, 4], [1.2, -4, 0, -4]],
      armL: [[0, 0, 0, 0], [0.6, -10, 0, 8], [1.2, 0, 0, 0]],
      armR: [[0, 0, 0, 0], [0.6, -10, 0, -8], [1.2, 0, 0, 0]],
    },
  },
  walk: {
    duration: 0.5,
    loop: true,
    pos: { hips: [[0, 0, 0, 0], [0.125, 0, 2.5, 0], [0.25, 0, 0, 0], [0.375, 0, 2.5, 0], [0.5, 0, 0, 0]] },
    rot: {
      spine: [[0, 14, 0, -5], [0.25, 14, 0, 5], [0.5, 14, 0, -5]],
      thighL: [[0, -32, 0, 0], [0.25, 28, 0, 0], [0.5, -32, 0, 0]],
      thighR: [[0, 28, 0, 0], [0.25, -32, 0, 0], [0.5, 28, 0, 0]],
      shinL: [[0, 10, 0, 0], [0.375, 40, 0, 0], [0.5, 10, 0, 0]],
      shinR: [[0, 10, 0, 0], [0.125, 40, 0, 0], [0.25, 10, 0, 0], [0.5, 10, 0, 0]],
      armL: [[0, 30, 0, 0], [0.25, -30, 0, 0], [0.5, 30, 0, 0]],
      armR: [[0, -30, 0, 0], [0.25, 30, 0, 0], [0.5, -30, 0, 0]],
    },
  },
  attack: {
    duration: 0.8,
    events: [{ t: 0.05, face: 'angry', hold: 0.6 }, { t: 0.38, name: 'release' }],
    pos: { hips: [[0, 0, 0, 0], [0.25, 0, 1, -3], [0.38, 0, -1, 8], [0.8, 0, 0, 0]] },
    rot: {
      spine: [[0, 0, 0, 0], [0.25, -10, -20, 0], [0.38, 20, 25, 0], [0.8, 0, 0, 0]],
      armR: [[0, 0, 0, 0], [0.25, -150, 0, -20], [0.38, -40, 0, 10], [0.55, -30, 0, 0], [0.8, 0, 0, 0]],
      foreArmR: [[0, 0, 0, 0], [0.25, 30, 0, 0], [0.38, -20, 0, 0], [0.8, 0, 0, 0]],
      armL: [[0, 0, 0, 0], [0.25, 20, 0, 30], [0.38, -30, 0, 20], [0.8, 0, 0, 0]],
      thighL: [[0, 0, 0, 0], [0.38, -25, 0, 0], [0.8, 0, 0, 0]],
      thighR: [[0, 0, 0, 0], [0.38, 15, 0, 0], [0.8, 0, 0, 0]],
    },
  },
  skill: {
    duration: 1,
    events: [{ t: 0.5, name: 'release' }],
    pos: { hips: [[0, 0, 0, 0], [0.4, 0, 8, 0], [0.6, 0, 0, 0], [1, 0, 0, 0]] },
    rot: {
      armL: [[0, 0, 0, 0], [0.4, -160, 0, 20], [0.6, -60, 0, 0], [1, 0, 0, 0]],
      armR: [[0, 0, 0, 0], [0.4, -160, 0, -20], [0.6, -60, 0, 0], [1, 0, 0, 0]],
    },
  },
  hit: {
    duration: 0.45,
    events: [{ t: 0, face: 'surprised', hold: 0.45 }],
    pos: { hips: [[0, 0, 0, 0], [0.08, 0, 0, -5], [0.45, 0, 0, 0]] },
    rot: {
      spine: [[0, 0, 0, 0], [0.08, -22, 0, 6], [0.45, 0, 0, 0]],
      head: [[0, 0, 0, 0], [0.08, -18, 0, -8], [0.45, 0, 0, 0]],
      armL: [[0, 0, 0, 0], [0.08, 0, 0, 40], [0.45, 0, 0, 0]],
      armR: [[0, 0, 0, 0], [0.08, 0, 0, -40], [0.45, 0, 0, 0]],
    },
  },
  die: {
    duration: 1.1,
    clamp: true,
    events: [{ t: 0.1, face: 'sleepy', hold: 0 }],
    pos: { hips: [[0, 0, 0, 0], [0.3, 0, 6, -2], [0.7, 0, -4, -4], [1.1, 0, -6, -4]] },
    rot: {
      base: [[0, 0, 0, 0], [0.3, -10, 0, 0], [0.75, -85, 0, 0], [0.9, -78, 0, 0], [1.1, -88, 0, 0]],
      spine: [[0, 0, 0, 0], [0.3, -20, 0, 0], [1.1, 0, 0, 0]],
      armL: [[0, 0, 0, 0], [0.5, 0, 0, 80], [1.1, 0, 0, 70]],
      armR: [[0, 0, 0, 0], [0.5, 0, 0, -80], [1.1, 0, 0, -70]],
    },
  },
  victory: {
    duration: 0.6,
    loop: true,
    pos: { hips: [[0, 0, 0, 0], [0.3, 0, 6, 0], [0.6, 0, 0, 0]] },
    rot: { armL: [[0, -150, 0, 30], [0.6, -150, 0, 30]], armR: [[0, -150, 0, -30], [0.6, -150, 0, -30]] },
  },
};

const common = {
  role: 'Warrior',
  element: 'Shadow',
  rarity: 'Common',
  team: 'enemy',
  placeholder: true,
  clips: IMP_CLIPS,
  defaultExpression: 'neutral',
};

export const shadeImp = registerUnit({
  ...common,
  id: 'shadeImp',
  name: 'Shade Imp',
  title: 'Placeholder foe',
  stats: { hp: 430, atk: 58, def: 10, spd: 95, range: 1, move: 2 },
  skills: { basic: 'common.claw', active: [], passive: null },
  build: () => buildImp({ variant: 'imp' }),
  portrait: { target: [0, 0.62, 0], distance: 1.1, fov: 26 },
});

export const shadeBrute = registerUnit({
  ...common,
  id: 'shadeBrute',
  name: 'Shade Brute',
  title: 'Placeholder foe',
  stats: { hp: 980, atk: 82, def: 22, spd: 80, range: 1, move: 1 },
  skills: { basic: 'common.slam', active: [], passive: null },
  build: () => buildImp({ variant: 'brute' }),
  portrait: { target: [0, 0.85, 0], distance: 1.5, fov: 26 },
});
