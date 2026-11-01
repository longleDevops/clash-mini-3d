import * as THREE from 'three';
import { add, cyl, sphere, lathe } from '../parts.js';
import { glowTexture, flameTexture, sparkTexture } from '../../core/textures.js';
import { LYRA_PALETTE as P } from './palette.js';

/**
 * Lyra's crescent staff ("Staff (Separate Asset)" on the sheet).
 * Built along +Y in model units; the returned group's origin is the grip point,
 * so it can be parented straight onto a hand bone.
 */
export const STAFF_GRIP_Y = 38;

export function buildStaff(mats) {
  const group = new THREE.Group();
  group.name = 'staff';
  const s = new THREE.Group();
  s.position.y = -STAFF_GRIP_Y;
  group.add(s);

  const wood = new THREE.MeshStandardMaterial({ color: P.brown, roughness: 0.5 });
  const woodLight = new THREE.MeshStandardMaterial({ color: P.taupe, roughness: 0.5 });
  const { gold, amber } = mats;

  // shaft + fittings
  add(s, cyl(2.0, 2.3, 84, 14), wood, { p: [0, 42, 0] });
  add(s, cyl(2.35, 2.35, 10, 14), woodLight, { p: [0, 38, 0] }); // leather-ish grip wrap
  add(s, new THREE.ConeGeometry(2.7, 7, 14), gold, { p: [0, -2.5, 0], r: [Math.PI, 0, 0] });
  add(s, cyl(3.0, 3.0, 2.2, 16), gold, { p: [0, 1.8, 0] });
  for (const y of [32, 44, 70]) add(s, cyl(2.9, 2.9, 1.8, 16), gold, { p: [0, y, 0] });
  add(s, sphere(3.1, 16, 12), gold, { p: [0, 56, 0], s: [1, 0.8, 1] });
  add(s, lathe([[2.3, 0], [3.2, 2], [4.6, 5], [5.4, 7.5], [4.2, 9], [0, 9]], 20), gold, { p: [0, 82, 0] });

  // head: ring, crescent, gem
  const headY = 104;
  const head = new THREE.Group();
  head.position.y = headY;
  s.add(head);
  add(head, new THREE.TorusGeometry(12, 2.3, 14, 48), gold);
  add(head, new THREE.TorusGeometry(7.6, 0.8, 8, 32), amber, { p: [0, 0, 0] });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    add(head, cyl(0.7, 0.7, 4.6, 8), gold, { p: [Math.cos(a) * 9.9, Math.sin(a) * 9.9, 0], r: [0, 0, a + Math.PI / 2] });
  }
  // side diamonds + bottom point
  const dia = new THREE.OctahedronGeometry(3.2, 0);
  add(head, dia, gold, { p: [14.8, 0, 0], s: [0.75, 1.15, 0.55] });
  add(head, dia, gold, { p: [-14.8, 0, 0], s: [0.75, 1.15, 0.55] });
  add(head, new THREE.ConeGeometry(2.6, 7, 4), gold, { p: [0, -15.5, 0], r: [Math.PI, 0, 0] });

  // crescent moon hugging the top-left of the ring
  const crescent = new THREE.Shape();
  const R = 18.5, maxW = 5.6, a0 = THREE.MathUtils.degToRad(25), a1 = THREE.MathUtils.degToRad(215), N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = a0 + (a1 - a0) * t;
    const x = Math.cos(a) * R, y = Math.sin(a) * R;
    i === 0 ? crescent.moveTo(x, y) : crescent.lineTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N, a = a0 + (a1 - a0) * t, r = R - maxW * Math.sin(Math.PI * t);
    crescent.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const cGeo = new THREE.ExtrudeGeometry(crescent, { depth: 2.6, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.7, bevelSegments: 3, curveSegments: 8 });
  cGeo.translate(0, 0, -1.3);
  add(head, cGeo, gold);

  // the gem (emissive) + glow
  const gemMat = new THREE.MeshStandardMaterial({ color: '#c06bff', emissive: '#9d3cff', emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, flatShading: true });
  const gem = add(head, new THREE.OctahedronGeometry(6.4, 0), gemMat, { s: [0.82, 1.22, 0.82] });
  gem.name = 'gem';
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: P.orchid, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
  glow.scale.setScalar(34);
  head.add(glow);

  // spirit flames at the crescent tip (purple wisps on the sheet)
  const flames = [];
  const tip = new THREE.Vector3(Math.cos(a0) * (R - 1), Math.sin(a0) * (R - 1), 0);
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTexture(), color: i === 1 ? P.rose : P.orchid, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
    f.position.copy(tip).add(new THREE.Vector3(i * 2.2 - 2, 3 + i * 1.5, 1));
    f.scale.set(6, 9, 1);
    f.userData.phase = i * 1.7;
    head.add(f);
    flames.push(f);
  }
  const sparkles = [];
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTexture(), color: '#ffe9ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.setScalar(4);
    sp.userData.phase = (i / 3) * Math.PI * 2;
    head.add(sp);
    sparkles.push(sp);
  }

  const gemAnchor = new THREE.Object3D();
  gemAnchor.name = 'staffGem';
  head.add(gemAnchor);

  function animate(t) {
    gem.rotation.y = t * 1.6;
    const pulse = 0.85 + Math.sin(t * 3.2) * 0.12;
    glow.scale.setScalar(34 * pulse);
    gemMat.emissiveIntensity = 0.75 + Math.sin(t * 3.2) * 0.25;
    for (const f of flames) {
      const ph = t * 7 + f.userData.phase;
      f.scale.set(5.5 + Math.sin(ph) * 0.8, 8.5 + Math.sin(ph * 1.3) * 2.2, 1);
      f.material.opacity = 0.7 + Math.sin(ph * 0.7) * 0.2;
    }
    for (const sp of sparkles) {
      const a = t * 1.4 + sp.userData.phase;
      sp.position.set(Math.cos(a) * 16, Math.sin(a * 1.3) * 5, Math.sin(a) * 16);
      sp.material.opacity = 0.5 + Math.sin(t * 5 + sp.userData.phase) * 0.5;
    }
  }

  return { group, gem, glow, gemAnchor, animate, setPower(k) { glow.material.opacity = 0.85 * k; } };
}
