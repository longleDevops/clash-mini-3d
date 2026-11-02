import * as THREE from 'three';
import { Rig } from '../rig/Rig.js';
import { FaceCanvas } from '../FaceCanvas.js';
import { makeMaterials, add, sphere, cyl, roundedBox, fluff, gradientY, lathe, flower, bell, countTris } from '../parts.js';
import { LYRA_PALETTE as P, LYRA_HEAD as HEAD } from './palette.js';
import { drawLyraFace } from './face.js';
import { attachBody } from '../bodyAsset.js';
import { buildStaff } from './staff.js';

/** 1 model unit -> world units. Lyra is 100u (~1 world unit) tall without ears. */
export const UNIT = 0.01;

/**
 * Lyra, Spirit Sorceress — procedural chibi model built from the model sheet:
 * 2.5 heads tall (head 40u + body 60u), fox ears, long wavy indigo hair with
 * a middle-parted fringe, flower + bell ornaments, layered kimono with gold
 * trim and obi flower knot, flared sleeves with rose lining, lilac stockings,
 * brown boots, a big white fox tail and her crescent staff.
 */
export function buildLyra({ glb = null } = {}) {
  const m = makeMaterials({
    skin: { color: P.skin, roughness: 0.8 },
    hair: { color: '#46336f', roughness: 0.48, side: THREE.DoubleSide },
    hairDeep: { color: '#33264f', roughness: 0.55 },
    kimono: { color: '#a56ce8', roughness: 0.6 },
    sleeve: { color: '#b47ef2', roughness: 0.6 },
    lining: { color: P.rose, roughness: 0.6, side: THREE.BackSide },
    rose: { color: P.rose, roughness: 0.55 },
    roseSkirt: { color: '#f765b0', roughness: 0.55, side: THREE.DoubleSide },
    underSkirt: { color: P.violet, roughness: 0.6, side: THREE.DoubleSide },
    blush: { color: P.blush, roughness: 0.75 },
    gold: { color: P.gold, roughness: 0.3, metalness: 0.6 },
    amber: { color: P.amber, roughness: 0.35, metalness: 0.5 },
    fur: { color: '#ffffff', roughness: 0.92, vertexColors: true },
    furTip: { color: P.blush, roughness: 0.9 },
    earInner: { color: '#ff9fcf', roughness: 0.8 },
    lilac: { color: P.lilac, roughness: 0.75 },
    boot: { color: P.brown, roughness: 0.5 },
    sole: { color: '#3a2920', roughness: 0.7 },
    gem: { color: '#ff63b3', emissive: '#ff2f8f', emissiveIntensity: 0.45, roughness: 0.2, metalness: 0.1 },
    dark: { color: P.night, roughness: 0.6 },
    emblem: { color: P.lilac, roughness: 0.4, metalness: 0.2 },
  });

  const root = new THREE.Group();
  root.name = 'Lyra';
  const body = new THREE.Group();
  body.scale.setScalar(UNIT);
  root.add(body);

  // ---------------- skeleton (28 bones) ----------------
  const rig = new Rig();
  const base = rig.bone('base', body);
  const hips = rig.bone('hips', base, [0, 24, 0]);
  const spine = rig.bone('spine', hips, [0, 8, 0]);
  const chest = rig.bone('chest', spine, [0, 10, 0]);
  const neck = rig.bone('neck', chest, [0, 15, 0]);
  const head = rig.bone('head', neck, [0, 3, 0]);
  const earL = rig.bone('earL', head, [14.5, 36, -4], [-0.1, 0, -0.4]);
  const earR = rig.bone('earR', head, [-14.5, 36, -4], [-0.1, 0, 0.4]);
  const hairBack = rig.bone('hairBack', head, [0, 33, -1.5]);
  // Staff arm = LEFT (as in the sheet's hero art); free arm rests by the obi.
  const armL = rig.bone('armL', chest, [14.2, 11.5, 0], [-0.22, 0, 0.5]);
  const foreArmL = rig.bone('foreArmL', armL, [0, -11, 0], [-0.62, 0, -0.3]);
  const handL = rig.bone('handL', foreArmL, [0, -13.5, 0]);
  const armR = rig.bone('armR', chest, [-14.2, 11.5, 0], [-0.3, 0, -0.26]);
  const foreArmR = rig.bone('foreArmR', armR, [0, -11, 0], [-0.85, 0, 0.5]);
  const handR = rig.bone('handR', foreArmR, [0, -13.5, 0]);
  const thighL = rig.bone('thighL', hips, [6.6, 0, 0]);
  const shinL = rig.bone('shinL', thighL, [0, -11, 0]);
  const footL = rig.bone('footL', shinL, [0, -8, 0]);
  const thighR = rig.bone('thighR', hips, [-6.6, 0, 0]);
  const shinR = rig.bone('shinR', thighR, [0, -11, 0]);
  const footR = rig.bone('footR', shinR, [0, -8, 0]);
  const skirt = rig.bone('skirt', hips);
  const tail0 = rig.bone('tail0', hips, [-3, 0, -14], [-1.85, 0, 0.75]);
  const tail1 = rig.bone('tail1', tail0, [0, 14, 0], [0.85, 0, 0.3]);
  const tail2 = rig.bone('tail2', tail1, [0, 18, 0], [0.7, 0, 0.2]);

  // ---------------- head + face ----------------
  const face = new FaceCanvas(drawLyraFace);
  const faceMat = new THREE.MeshStandardMaterial({ map: face.texture, roughness: 0.8 });
  faceMat.name = 'face';
  // Body meshes: Blender GLB when one is loaded (tools/blender/README.md), else the code build.
  if (glb) attachBody({ root, rig }, glb, { face: { material: faceMat, w: HEAD.w, h: HEAD.h, centerY: HEAD.h / 2 } });
  else buildBody(rig.bones, m, faceMat);

  // ---------------- staff in right hand ----------------
  const staff = buildStaff(m);
  const mount = new THREE.Group();
  mount.name = 'staffMount';
  mount.position.set(0, -1.2, 0.6);
  handL.add(mount);
  mount.add(staff.group);
  rig.bones.prop = mount;

  // Orient the staff upright in the rest pose (counter the arm's rotations).
  root.updateMatrixWorld(true);
  const qHand = new THREE.Quaternion();
  mount.parent.getWorldQuaternion(qHand);
  const upright = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, 0, 0.1));
  mount.quaternion.copy(qHand.invert().multiply(upright));

  rig.captureRest();

  // anchors used by HUD / VFX
  const anchors = {
    overhead: anchor(body, [0, 138, 0]),
    chest: anchor(chest, [0, 4, 10]),
    staffGem: staff.gemAnchor,
    feet: anchor(body, [0, 0, 0]),
  };

  root.traverse((o) => {
    if (o.isMesh) o.receiveShadow = false;
  });

  // ---------------- secondary motion (on top of clips) ----------------
  const twitch = { t: 2, side: 1, k: 0 };
  function secondary(ch, dt, t) {
    const calm = ch.alive ? 1 : 0.25;
    tail0.rotation.z += Math.sin(t * 2.1) * 0.12 * calm;
    tail1.rotation.z += Math.sin(t * 2.1 - 0.7) * 0.2 * calm;
    tail2.rotation.z += Math.sin(t * 2.1 - 1.4) * 0.26 * calm;
    tail1.rotation.x += Math.sin(t * 1.7 - 0.5) * 0.08 * calm;
    hairBack.rotation.x += Math.sin(t * 1.6) * 0.025 * calm;
    hairBack.rotation.z += Math.sin(t * 1.3 + 1) * 0.02 * calm;
    // ear twitch every few seconds
    twitch.t -= dt;
    if (twitch.t <= 0) {
      twitch.t = 2.5 + Math.random() * 3;
      twitch.side = Math.random() < 0.5 ? 1 : -1;
      twitch.k = 1;
    }
    twitch.k = Math.max(0, twitch.k - dt * 5);
    const tw = Math.sin(twitch.k * Math.PI) * 0.22;
    (twitch.side > 0 ? earL : earR).rotation.z += -twitch.side * tw;
    earL.rotation.x += Math.sin(t * 1.9) * 0.03;
    earR.rotation.x += Math.sin(t * 1.9 + 0.8) * 0.03;
    staff.animate(t);
  }

  return {
    root,
    rig,
    face,
    anchors,
    staff,
    secondary,
    stats: { tris: countTris(root), bones: rig.count, source: glb ? 'blender' : 'code' },
  };
}

/** The code-built body (head, hair, outfit, tail) on the rig's bones. */
function buildBody(B, m, faceMat) {
  const { head, neck, hairBack, earL, earR, chest, spine, skirt, tail0, tail1, tail2 } = B;
  const { thighL, shinL, footL, thighR, shinR, footR, armL, foreArmL, handL, armR, foreArmR, handR } = B;
  const headGeo = roundedBox(HEAD.w, HEAD.h, HEAD.d, HEAD.r, 5);
  planarFrontUV(headGeo, HEAD.w, HEAD.h);
  add(head, headGeo, [m.skin, m.skin, m.skin, m.skin, faceMat, m.skin], { p: [0, HEAD.h / 2, 0] });
  add(neck, cyl(4.6, 5.2, 6, 16), m.skin, { p: [0, 1, 0] });

  // hair: a helmet that follows the head with the face window cut out
  add(head, hairHelmet(), m.hair, { p: [0, 21.5, -1.6] });
  // middle-parted fringe
  const strand = sphere(1, 18, 14);
  const bangs = [
    [4.8, 30.4, 21.2, 5.6, 9.8, 2.8, 0.62],
    [11.2, 29.4, 21.0, 6.3, 10.2, 3.0, 0.36],
    [17.4, 27.6, 20.0, 5.8, 10.8, 3.2, 0.14],
  ];
  for (const sx of [-1, 1]) {
    for (const [x, y, z, a, b, c, rz] of bangs) add(head, strand, m.hair, { p: [sx * x, y, z], r: [0.12, 0, sx * rz], s: [a, b, c] });
    // face-framing side lock, tapering into a soft curl
    add(head, hairLock(), m.hair, { p: [sx * 22.6, 26, 11.5], r: [0.12, 0, sx * 0.08], s: [sx, 1, 1] });
  }
  // long wavy back hair: one flowing curtain (secondary-motion bone) + curled ends
  add(hairBack, hairCurtain(), m.hair);

  // fox ears
  for (const [ear, sx] of [[earL, 1], [earR, -1]]) {
    add(ear, new THREE.ConeGeometry(11, 29, 24, 1), m.fur, { p: [0, 13, 0], s: [1, 1, 0.46] });
    add(ear, new THREE.ConeGeometry(7.2, 21, 20, 1), m.earInner, { p: [0, 10.5, 2.8], s: [1, 1, 0.32] });
    add(ear, fluff(1, { seed: 20 + sx, amp: 0.15 }), m.fur, { p: [0, 2.6, 3.2], s: [5.2, 4.2, 2.8] });
  }
  for (const o of [earL, earR]) o.children[0].geometry = gradientY(o.children[0].geometry, P.lilac, '#ffffff', -14, 4);

  // tiara + forehead gem
  add(head, new THREE.OctahedronGeometry(2.6, 0), m.gem, { p: [0, 30.6, 21.3], s: [0.85, 1.35, 0.6] });
  add(head, new THREE.TorusGeometry(3.0, 0.7, 8, 20), m.gold, { p: [0, 30.6, 20.9] });
  for (const sx of [-1, 1]) add(head, new THREE.ConeGeometry(1.2, 6, 10), m.gold, { p: [sx * 4.6, 32.4, 20.4], r: [0, 0, -sx * 1.05] });
  add(head, sphere(0.9, 10, 8), m.gem, { p: [0, 25.2, 20.25] });

  // flowers + bells
  for (const sx of [-1, 1]) {
    flower(head, m.rose, m.gold, 3.5, { p: [sx * 22.4, 27.5, 9], r: [0, sx * 0.95, 0] });
    flower(head, m.rose, m.gold, 2.5, { p: [sx * 17, 37.5, 6.5], r: [-0.3, sx * 0.6, 0] });
    add(head, cyl(0.45, 0.45, 5, 6), m.rose, { p: [sx * 23.6, 23.4, 9.2] });
    bell(head, m.gold, m.dark, 2.6, { p: [sx * 23.8, 18.5, 9.4] });
    bell(head, m.gold, m.dark, 2.2, { p: [sx * 25.0, 22.5, 3.2], r: [0, 0, sx * 0.2] });
  }

  // ---------------- torso ----------------
  add(chest, cyl(11.6, 14.8, 20, 32), m.kimono, { p: [0, 3, 0] });
  add(chest, sphere(12, 28, 16), m.kimono, { p: [0, 12.6, 0], s: [1.2, 0.55, 0.95] });
  // V collar: blush under-layer, rose bands, gold piping
  add(chest, new THREE.BoxGeometry(9, 12, 1), m.blush, { p: [0, 6.5, 12.3], r: [-0.14, 0, 0] });
  for (const sx of [-1, 1]) {
    add(chest, new THREE.BoxGeometry(3.4, 17, 1.4), m.rose, { p: [sx * 3.8, 6.3, 12.9], r: [-0.15, 0, -sx * 0.42] });
    add(chest, new THREE.BoxGeometry(0.9, 17, 1.6), m.gold, { p: [sx * 6.1, 6.6, 12.7], r: [-0.15, 0, -sx * 0.42] });
  }
  // obi sash + golden flower knot + ribbon tails
  add(spine, cyl(15.4, 15.8, 8, 32), m.rose, { p: [0, 2.5, 0] });
  add(spine, new THREE.TorusGeometry(15.6, 0.9, 8, 48), m.gold, { p: [0, 6.6, 0], r: [Math.PI / 2, 0, 0] });
  add(spine, new THREE.TorusGeometry(15.9, 0.9, 8, 48), m.gold, { p: [0, -1.5, 0], r: [Math.PI / 2, 0, 0] });
  flower(spine, m.gold, m.amber, 4.0, { p: [0, 2.6, 16.4] });
  for (const sx of [-1, 1]) {
    add(spine, new THREE.BoxGeometry(3.6, 12, 1.2), m.rose, { p: [sx * 2.6, -5.5, 16.6], r: [0.12, 0, sx * 0.2] });
    add(spine, new THREE.ConeGeometry(1.4, 2.6, 4), m.gold, { p: [sx * 3.8, -12, 17.4], r: [Math.PI, 0, 0] });
  }

  // ---------------- skirt ----------------
  add(skirt, pleated(14.6, 23.2, 22, 14, 0.04), m.underSkirt, { p: [0, 0, 0] });
  add(skirt, new THREE.TorusGeometry(23.2, 0.95, 8, 64), m.gold, { p: [0, -11, 0], r: [Math.PI / 2, 0, 0] });
  add(skirt, pleated(15.1, 21.6, 14, 12, 0.035, 0.42), m.roseSkirt, { p: [0, 4, 0] });
  add(skirt, arcTorus(21.7, 0.8, 0.42), m.gold, { p: [0, -3, 0], r: [Math.PI / 2, 0, 0] });
  add(skirt, new THREE.OctahedronGeometry(3, 0), m.emblem, { p: [0, -5.5, 20.6], r: [-0.36, 0, 0], s: [0.85, 1.25, 0.32] });
  add(skirt, new THREE.OctahedronGeometry(1.4, 0), m.amber, { p: [0, -5.5, 21.3], r: [-0.36, 0, 0], s: [1, 1.2, 0.4] });

  // ---------------- legs ----------------
  for (const [thigh, shin, foot] of [[thighL, shinL, footL], [thighR, shinR, footR]]) {
    add(thigh, cyl(5, 4.6, 12, 14), m.lilac, { p: [0, -6, 0] });
    add(shin, cyl(4.4, 3.9, 9, 14), m.lilac, { p: [0, -4.5, 0] });
    add(foot, cyl(4.9, 5.2, 6, 16), m.boot, { p: [0, 1.5, 0] });
    add(foot, new THREE.TorusGeometry(5.1, 1.25, 8, 20), m.amber, { p: [0, 4.6, 0], r: [Math.PI / 2, 0, 0] });
    add(foot, roundedBox(10, 7, 13.5, 3, 3), m.boot, { p: [0, -1.4, 1.8] });
    add(foot, roundedBox(10.6, 2.2, 14, 1, 2), m.sole, { p: [0, -4.4, 1.8] });
  }

  // ---------------- arms + kimono sleeves ----------------
  // Furisode-style sleeves hang from the upper arm (opening faces down, rose lining
  // and gold hem), so they read as drooping sleeves rather than tubes.
  const bag = lathe([[6.4, 0.5], [7.3, -4], [8.8, -10], [10.2, -16], [11.0, -20.5], [10.6, -23]], 28);
  for (const [arm, fore, hand, sx] of [[armL, foreArmL, handL, 1], [armR, foreArmR, handR, -1]]) {
    add(arm, sphere(6.6, 20, 14), m.sleeve, { p: [0, 0, 0] });
    add(arm, bag, m.sleeve, { s: [1, 1, 0.82] });
    add(arm, bag, m.lining, { s: [0.95, 0.99, 0.78] });
    add(arm, new THREE.TorusGeometry(10.65, 0.7, 8, 36), m.gold, { p: [0, -23, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.82, 1] });
    add(arm, new THREE.TorusGeometry(10.1, 0.55, 8, 36), m.rose, { p: [0, -21.4, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.82, 1] });
    add(fore, cyl(3.6, 4.2, 12, 14), m.blush, { p: [0, -6, 0] });
    add(fore, new THREE.TorusGeometry(4.1, 0.7, 8, 18), m.gold, { p: [0, -11.6, 0], r: [Math.PI / 2, 0, 0] });
    add(hand, sphere(4.3, 18, 14), m.skin, { p: [0, -1.2, 0.4], s: [1, 1.05, 0.95] });
    add(hand, sphere(1.7, 10, 8), m.skin, { p: [sx * -2.6, 0.2, 2.6] });
  }

  // ---------------- tail ----------------
  const tailGeo = (seed) => gradientY(fluff(1, { seed, amp: 0.1, freq: 2.6 }), P.lilac, '#ffffff', -1, 0.8);
  add(tail0, tailGeo(31), m.fur, { p: [0, 7, 0], s: [8, 12, 8] });
  add(tail1, tailGeo(32), m.fur, { p: [0, 9, 0], s: [14, 16, 13] });
  add(tail2, tailGeo(33), m.fur, { p: [0, 8, 0], s: [12.5, 15, 12] });
  add(tail2, fluff(1, { seed: 34, amp: 0.12 }), m.furTip, { p: [0, 19, 0], s: [7, 9, 7] });
}

function anchor(parent, p) {
  const o = new THREE.Object3D();
  o.position.set(p[0], p[1], p[2]);
  parent.add(o);
  return o;
}

/** Rounded shell over the head with the face window removed (keeps side hair framing the face). */
function hairHelmet() {
  const geo = roundedBox(48.5, 44.5, 44.5, 15.5, 6);
  const pos = geo.attributes.position;
  const keep = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
    // window: front-facing, below the hairline, inside the side locks (hairline dips at the temples)
    const hairline = 9.5 - Math.max(0, Math.abs(cx) - 8) * 0.35;
    if (cz > 6 && cy < hairline && Math.abs(cx) < 19.5) continue;
    keep.push(i, i + 1, i + 2);
  }
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const src = geo.attributes[name];
    const arr = new Float32Array(keep.length * 3);
    keep.forEach((vi, k) => { arr[k * 3] = src.getX(vi); arr[k * 3 + 1] = src.getY(vi); arr[k * 3 + 2] = src.getZ(vi); });
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  geo.dispose();
  return out;
}

/**
 * Long hair curtain: an open, wavy shell that wraps the back and sides, widening
 * toward the hips with a scalloped hem (the sheet's big wavy back hair).
 */
function hairCurtain() {
  const H = 76, gap = 1.15; // front opening half-angle (radians)
  const geo = new THREE.CylinderGeometry(25.5, 25, H, 72, 16, true, gap, Math.PI * 2 - gap * 2);
  geo.translate(0, -H / 2, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(x, z);
    const d = THREE.MathUtils.clamp(-y / H, 0, 1); // 0 at crown, 1 at hem
    const bulge = 1 + 0.1 * Math.sin(Math.min(1, d * 1.6) * Math.PI * 0.5) - 0.06 * Math.max(0, d - 0.6);
    const wave = 1 + (0.02 + 0.06 * d) * Math.sin(a * 7 + d * 6);
    x *= bulge * wave;
    z *= bulge * wave;
    // below the jaw the hair falls behind the shoulders: pull the side edges back
    const fall = THREE.MathUtils.smoothstep(d, 0.28, 0.6);
    if (z > -6) z = -6 + (z + 6) * (1 - 0.6 * fall);
    z -= 5 * fall;
    if (d > 0.93) y += 3.4 * Math.sin(a * 7 + 1.2) + 1.5; // scalloped hem
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A single tapered lock that ends in a curl (local origin at its root). */
let lockGeo;
function hairLock() {
  if (lockGeo) return lockGeo;
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = 4.4 * Math.sin(Math.PI * (0.12 + 0.8 * t)) + 0.6;
    pts.push(new THREE.Vector2(r, -t * 34));
  }
  lockGeo = new THREE.LatheGeometry(pts, 18);
  const pos = lockGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), t = -y / 34;
    pos.setX(i, pos.getX(i) * 0.85 + Math.sin(t * Math.PI * 1.6) * 2.2 * t);
    pos.setZ(i, pos.getZ(i) * 1.15 - t * t * 3);
  }
  lockGeo.computeVertexNormals();
  return lockGeo;
}

/** Replace the +Z face UVs of a RoundedBoxGeometry with a planar projection (face texture). */
function planarFrontUV(geo, w, h) {
  const g = geo.groups.find((gr) => gr.materialIndex === 4);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = g.start; i < g.start + g.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  }
  uv.needsUpdate = true;
}

/** Open, flared skirt cylinder with soft pleat ridges. gapFront leaves the front open (radians). */
function pleated(rTop, rBottom, h, pleats, amp, gapFront = 0) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, 72, 4, true, gapFront, Math.PI * 2 - gapFront * 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(x, z);
    const lower = 0.35 + 0.65 * (0.5 - y / h);
    const k = 1 + amp * Math.cos(a * pleats) * lower;
    pos.setXYZ(i, x * k, y, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Torus arc that matches a skirt with a front gap. */
function arcTorus(r, tube, gapFront) {
  const geo = new THREE.TorusGeometry(r, tube, 8, 60, Math.PI * 2 - gapFront * 2);
  // TorusGeometry starts at +X in its XY plane; after rotating X by +90° that plane maps onto XZ.
  // Rotate so the gap is centred on +Z (front).
  geo.rotateZ(Math.PI / 2 + gapFront);
  return geo;
}
