import * as THREE from 'three';
import { registerMap } from '../registry.js';
import { MapBuilder } from '../kit/MapBuilder.js';
import { plazaTexture, crackGlowTexture, groundTexture, medallion, swirlTexture, lavaTexture } from '../kit/paint.js';
import * as P from '../kit/props.js';
import { arena } from './shell.js';

/**
 * VOLCANIC FORGE — chapter 3. A raised basalt ring with glowing cracks,
 * floating over a lava sea; ruined walls, a forge-portal gate, torches all
 * round, volcanoes on the horizon and embers in the air.
 */
export default registerMap({
  id: 'volcanic-forge',
  name: 'Volcanic Forge',
  kind: 'arena',
  theme: { accent: '#ff8a4c', sky: ['#2a1640', '#c4502c'], emblem: 'flame' },
  create({ scene }) {
    const b = new MapBuilder(scene, { name: 'map:volcanic-forge', seed: 37 });
    b.sky([[0, '#1b0f2e'], [0.4, '#3a1838'], [0.75, '#7a2a35'], [1, '#d2582c']], { color: '#4a1d2e', near: 22, far: 58 });
    b.lights({
      hemi: ['#ffb48a', '#2a1530', 0.85],
      sun: { color: '#ffc08a', intensity: 1.9, pos: [-4, 9, 5] },
      rim: { color: '#ff5a2a', intensity: 1.6, pos: [3, 4, -8] },
      env: 0.32,
    });

    const basalt = b.mat('#4a3646', { rough: 0.9, flat: true });
    const basaltDark = b.mat('#33242f', { rough: 0.95, flat: true });
    const ember = b.mat('#ff7a2a', { emissive: '#ff5a1a', ei: 1.3 });
    const iron = b.mat('#3a2e3a', { rough: 0.5, metal: 0.5 });

    // ---- lava sea (scrolling, glowing)
    const lavaTex = lavaTexture().clone();
    lavaTex.needsUpdate = true;
    lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping;
    lavaTex.repeat.set(10, 10);
    b.disposables.push(lavaTex);
    const lavaMat = b.mat('#ffffff', { map: lavaTex, emissive: '#ff6a2a', emissiveMap: lavaTex, ei: 1.1, rough: 0.6 });
    const sea = new THREE.Mesh(new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2), lavaMat);
    sea.position.y = -1.1;
    b.root.add(sea);

    // ---- raised forge ring
    const plazaTex = plazaTexture('forge-plaza', {
      stones: ['#56404f', '#4a3646', '#5f4757', '#433140'],
      grout: '#24161f',
      rings: 9,
      medal: '#3a2834',
      emblem: medallion('flame', '#ff9a3c', '#ff6a2a'),
      cracks: '#ff7a2a',
      seed: 8,
    });
    const { mat: floorMat } = P.plaza(b, { rx: 8.3, rz: 5.5, tex: plazaTex, rough: 0.85, emissiveMap: crackGlowTexture('forge-glow', '#ff8a3a', 8), emissive: '#ff6a2a', ei: 1.0 });
    const side = new THREE.CylinderGeometry(1, 0.86, 1, 48, 2, true);
    P.jitter(side, b, 0.02, true);
    b.m(side, basaltDark, [0, -0.6, 0], { scale: [8.75, 1.2, 5.95], noCast: true });
    P.curb(b, { rx: 8.55, rz: 5.75, mats: [basalt, basaltDark], trim: ember, n: 64 });
    // rocky shore the ring stands on (back half)
    const shore = new THREE.CylinderGeometry(1, 1.1, 1, 28, 1);
    P.jitter(shore, b, 0.04, true);
    b.m(shore, b.mat('#ffffff', { map: groundTexture('forge-rock', '#3b2a36', ['#2b1d27', '#4d3746', '#22161e'], { repeat: [6, 6] }), rough: 0.95 }), [0, -0.62, -6.5], { scale: [15, 1.1, 6.5], noCast: true });

    // ---- ruined back wall + forge portal
    P.wallArc(b, { rx: 9.3, rz: 6.4, a0: -Math.PI * 0.95, a1: -Math.PI * 0.6, h: 1.0, mat: basalt, cap: basaltDark, broken: 0.45 });
    P.wallArc(b, { rx: 9.3, rz: 6.4, a0: -Math.PI * 0.4, a1: -Math.PI * 0.05, h: 1.0, mat: basalt, cap: basaltDark, broken: 0.45 });
    P.gateArch(b, { pos: [0, 0, -6.5], w: 2.4, h: 1.5, mat: basaltDark, trim: ember, depth: 0.75 });
    const portalMat = b.basic('#ffffff', { map: swirlTexture('forge-swirl', '#fff1a8', '#ff4a1a'), additive: true, opacity: 0.95, side: THREE.DoubleSide });
    const portal = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), portalMat);
    portal.position.set(0, 1.42, -6.5);
    b.root.add(portal);
    P.glow(b, { pos: [0, 1.4, -6.2], color: '#ff6a2a', size: 4.2, opacity: 0.6, pulse: 0.3 });
    b.onUpdate((dt, t) => (portal.rotation.z = -t * 1.2));
    const pl = new THREE.PointLight('#ff7a3a', 6, 9, 1.6);
    pl.position.set(0, 1.5, -5.6);
    b.root.add(pl);
    for (const x of [-2.2, 2.2]) P.tower(b, { pos: [x, 0, -6.6], r: 0.55, h: 1.9, mat: basalt, trim: ember, crown: true });
    // anvil + forge pieces by the gate
    for (const x of [-3.6, 3.6]) {
      b.m(new THREE.BoxGeometry(0.7, 0.4, 0.45), iron, [x, 0.2, -5.2]);
      b.m(new THREE.BoxGeometry(0.95, 0.18, 0.5), iron, [x, 0.49, -5.2]);
    }

    // ---- torches round the ring
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.08 - (i / 9) * Math.PI * 0.84;
      P.brazier(b, { pos: [Math.cos(a) * 9.0, 0, Math.sin(a) * 6.1], flame: '#ff8a2a', core: '#ffe08a', h: 1.2, stand: basaltDark, bowl: iron, size: 0.85 });
    }
    for (const x of [-6.6, 6.6]) P.brazier(b, { pos: [x, 0, 1.4], flame: '#ff8a2a', core: '#ffe08a', h: 1.1, stand: basaltDark, bowl: iron, size: 0.8, light: true });
    P.banner(b, { pos: [-5.9, 0, -3.5], color: '#4f7dff', emblem: 'star', pole: '#2b1d27', trim: '#ff9a3c' });
    P.banner(b, { pos: [5.9, 0, -3.5], color: '#e8466a', emblem: 'flame', pole: '#2b1d27', trim: '#ff9a3c' });

    // ---- rocks + spires on the shore, volcanoes on the horizon
    for (let i = 0; i < 18; i++) {
      const x = b.r(-15, 15), z = b.r(-12, -7.2);
      if (Math.abs(x) < 3 && z > -9) continue;
      P.rock(b, { pos: [x, -0.1, z], s: b.r(0.5, 1.3), mat: b.rnd() > 0.5 ? basalt : basaltDark, squash: b.r(0.6, 1.6) });
    }
    for (const [x, z, h] of [[-11, -9, 3.5], [-13.5, -6, 2.6], [12, -9.5, 3.8], [14, -5.5, 2.4], [-7.5, -10.5, 2.2], [8, -11, 2.8]]) {
      const sp = new THREE.ConeGeometry(0.9, h, 6);
      P.jitter(sp, b, 0.08);
      b.m(sp, basaltDark, [x, h / 2 - 0.4, z]);
    }
    for (const [x, z] of [[-10.8, 2.5], [10.8, 2.0], [-12, -2], [12.3, -2.5]]) {
      P.rock(b, { pos: [x, -0.9, z], s: 1.6, mat: basaltDark, squash: 0.7 });
      P.crystalCluster(b, { pos: [x, -0.1, z], color: '#ff7a3a', n: 4, size: 0.45 });
    }
    P.volcano(b, { pos: [-16, -1.2, -30], r: 7, h: 10, rock: basaltDark });
    P.volcano(b, { pos: [17, -1.2, -34], r: 8, h: 12, rock: basaltDark });
    P.volcano(b, { pos: [2, -1.2, -44], r: 9, h: 9, rock: basaltDark });

    // ---- embers, lava shimmer, glowing cracks
    P.particles(b, { n: 90, box: [-12, -0.8, -9, 12, 6, 4], color: '#ffae4a', size: 0.12, mode: 'rise', speed: 0.7 });
    b.onUpdate((dt, t) => {
      lavaTex.offset.x += dt * 0.02;
      lavaTex.offset.y += dt * 0.012;
      lavaMat.emissiveIntensity = 1.0 + Math.sin(t * 1.7) * 0.15;
      floorMat.emissiveIntensity = 0.85 + Math.sin(t * 2.1) * 0.25;
    });

    return arena(b);
  },
});
