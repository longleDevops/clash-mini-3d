import * as THREE from 'three';
import { registerMap } from '../registry.js';
import { MapBuilder } from '../kit/MapBuilder.js';
import { groundTexture, plazaTexture, medallion } from '../kit/paint.js';
import * as P from '../kit/props.js';
import * as L from '../kit/landmarks.js';

/**
 * SKYWARD HAVEN — the home hub. Lyra stands on a little floating dais in the
 * foreground; behind her the sanctum castle and the landmark islands
 * (Campaign, Heroes, Summon, Guild, Shop, Arena) float over a sea of clouds.
 * Exposes `hotspots` so the home screen can pin tappable labels on them.
 */
export default registerMap({
  id: 'skyward-haven',
  name: 'Skyward Haven',
  kind: 'hub',
  create({ scene }) {
    const b = new MapBuilder(scene, { name: 'map:skyward-haven', seed: 71 });
    b.sky([[0, '#5f74e6'], [0.35, '#8fa3fa'], [0.62, '#cfd0ff'], [0.8, '#f5e3ff'], [1, '#e6d8ff']], { color: '#e3dcff', near: 30, far: 95 });
    b.lights({ hemi: ['#fff8ff', '#8a7cc8', 1.2], sun: { color: '#fff1de', intensity: 2.4, pos: [-6, 12, 9], target: [0, 0, -4] }, rim: { color: '#d9c4ff', intensity: 1.1, pos: [5, 6, -10] }, shadow: 12 });

    const grass = b.mat('#ffffff', { map: groundTexture('haven-grass', '#93d77f', ['#7cc76c', '#a6e08e', '#6fbd63'], { repeat: [3, 3], blades: '#6db25f' }) });
    const dirt = b.mat('#9b7f6e', { rough: 0.95 });
    const rockMat = b.mat('#8d7fb8', { rough: 0.95, flat: true });
    const wall = b.mat('#eee9fa', { rough: 0.8 });
    const roof = b.mat('#4f74e8', { rough: 0.55 });
    const gold = b.mat('#ffd45c', { rough: 0.35, metal: 0.55 });
    const leaf = ['#6cc35a', '#86d66a', '#58ad4f', '#9ee07a'];
    const isle = (pos, rx, rz, depth, rotY = 0) => P.island(b, { pos, rx, rz, depth, top: grass, side: dirt, rock: rockMat, rotY, segs: 16 });

    // ---- Lyra's dais (foreground)
    const home = new THREE.Vector3(-0.9, 0.055, 3.0);
    isle([home.x - 0.2, -0.02, home.z - 0.3], 2.1, 1.7, 2.6);
    const dais = new THREE.CircleGeometry(1.05, 48).rotateX(-Math.PI / 2);
    b.m(dais, b.mat('#ffffff', { map: plazaTexture('haven-dais', { stones: ['#e3ddf5', '#d2cbea', '#ece8f8'], grout: '#a69cd0', rings: 3, medal: '#f6f2ff', emblem: medallion('star', '#ffd45c', '#c57cff'), seed: 2 }) }), [home.x, 0.06, home.z], { noCast: true });
    b.m(new THREE.CylinderGeometry(1.1, 1.15, 0.1, 48), wall, [home.x, 0.0, home.z]);
    b.m(new THREE.TorusGeometry(1.08, 0.04, 6, 48).rotateX(Math.PI / 2), gold, [home.x, 0.07, home.z], { noCast: true });
    P.bush(b, { pos: [home.x - 1.7, 0, home.z - 0.9], s: 0.6, flowers: ['#ff9ad1', '#fff3a8', '#ffffff'] });
    P.flowers(b, { center: [home.x, 0, home.z - 0.3], r0: 1.25, r1: 1.9, n: 18, size: 0.05, colors: ['#ff9ad1', '#fff3a8', '#ffffff', '#c9a4ff'] });

    // ---- landmark islands
    const hotspots = [];
    const spot = (id, label, anchor, extra = {}) => hotspots.push({ id, label, anchor, ...extra });

    // positions tuned so labels spread across the frame around Lyra (see cameras.home)
    isle([2.0, -1.3, -4.0], 1.9, 1.6, 2.4);
    spot('campaign', 'Campaign', L.swordsMonument(b, [2.0, -1.3, -4.0], 1.0).anchor, { primary: true, target: 'world' });
    P.flowers(b, { center: [2.0, -1.3, -4.0], r0: 1.1, r1: 1.7, n: 18, colors: ['#fff3a8', '#ffffff'], y: -1.24 });

    isle([5.4, -2.0, -5.0], 1.8, 1.4, 2.2, 0.3);
    spot('shop', 'Shop', L.shopStall(b, [5.4, -2.0, -5.0], 0.95, -0.35).anchor, { locked: true });

    isle([-8.0, -1.0, -8.0], 2.0, 1.7, 2.8);
    spot('summon', 'Summon', L.summonPortal(b, [-8.0, -1.0, -8.0], 1.0).anchor, { locked: true });
    P.tree(b, { pos: [-9.3, -1.0, -8.6], s: 0.8, leaf });

    isle([-5.2, 0.9, -11.0], 2.3, 1.9, 3.0);
    spot('heroes', 'Heroes', L.heroHall(b, [-5.2, 0.9, -11.0], 1.0).anchor, { target: 'studio' });
    P.tree(b, { pos: [-6.8, 0.9, -11.3], s: 0.75, leaf });

    isle([6.6, -0.9, -13.0], 2.1, 1.7, 3.0);
    spot('guild', 'Guild', L.guildKeep(b, [6.6, -0.9, -13.0], 1.0).anchor, { locked: true });

    isle([9.6, -1.6, -11.0], 2.0, 1.7, 2.6);
    spot('arena', 'Arena', L.arenaRing(b, [9.6, -1.6, -11.0], 0.9).anchor, { locked: true });

    // ---- the sanctum castle (backdrop)
    isle([2.0, -3.2, -18.0], 4.6, 3.6, 5.5);
    P.castle(b, { pos: [2.0, -3.2, -18.4], s: 1.1, wall, roof, trim: gold });
    P.crystal(b, { pos: [2.0, 3.3, -18.6], color: '#5fc8ff', size: 0.75 });
    for (const [x, z, s] of [[-1.6, -16.6, 0.9], [5.6, -16.8, 0.95], [-0.2, -20.4, 0.8]]) P.tree(b, { pos: [x, -3.2, z], s, leaf });
    P.waterfall(b, { pos: [0.4, -3.4, -15.2], w: 0.9, h: 6.5, rotY: 0.1 });
    P.waterfall(b, { pos: [4.4, -3.4, -15.4], w: 0.7, h: 5.5, rotY: -0.2 });

    // ---- plank bridges between near islands
    const plank = b.mat('#b07a4f', { rough: 0.85 });
    const bridge = (a, c) => {
      const A = new THREE.Vector3(...a), C = new THREE.Vector3(...c);
      const n = Math.round(A.distanceTo(C) / 0.32);
      const dir = C.clone().sub(A);
      const yaw = Math.atan2(dir.x, dir.z);
      for (let i = 0; i <= n; i++) {
        const t = i / n, p = A.clone().lerp(C, t);
        p.y -= Math.sin(t * Math.PI) * 0.25;
        b.m(new THREE.BoxGeometry(0.75, 0.06, 0.24), plank, p.toArray(), { rot: [0, yaw, 0] });
      }
    };
    bridge([0.2, -0.06, 1.3], [1.6, -1.28, -2.5]);
    bridge([3.7, -1.32, -4.3], [4.2, -1.98, -4.7]);

    // ---- small filler islands, clouds, motes
    for (const [x, y, z, r, tree] of [[13.5, 3.2, -20, 1.4, true], [-14, 4.5, -24, 1.6, true], [8.2, -3.0, -6.5, 0.9, false], [16, -4, -24, 2.2, true], [-18, -4, -28, 2.6, true]]) {
      isle([x, y, z], r, r * 0.8, r * 1.6);
      if (tree) P.tree(b, { pos: [x, y, z], s: r * 0.6, leaf });
    }
    for (const [x, y, z, s] of [[-14, 5.2, -30], [10, 6.4, -34], [-3, 7.5, -42], [22, 4.4, -28], [-26, 3.5, -36]]) P.cloud(b, { pos: [x, y, z], s: 2.2, drift: 0.25, wrap: 40, ei: 0.45 });
    P.cloudSea(b, { y: -8, r0: 6, r1: 50, n: 34, color: '#f6f0ff', emissive: '#efe6ff', ei: 0.4 });
    P.particles(b, { n: 50, box: [-10, -2, -14, 10, 5, 4], color: '#fff1b0', size: 0.09, mode: 'rise', speed: 0.2 });

    const map = b.finish({
      spots: { home },
      cameras: {
        home: { pos: [0, 1.3, 7.6], look: [0, -0.2, -4], fov: 38 },
      },
    });
    map.hotspots = hotspots;
    return map;
  },
});
