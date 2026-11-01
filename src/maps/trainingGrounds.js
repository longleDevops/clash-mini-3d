import * as THREE from 'three';
import { registerMap } from './registry.js';
import { gradientTexture } from '../core/textures.js';
import { seeded } from '../core/math.js';

/**
 * PLACEHOLDER ARENA — "Training Grounds". Deliberately minimal: a round stone
 * dais, a soft sky and team banners. The maps & scenes work replaces this
 * with real arenas through the same interface (see ./registry.js).
 */
export default registerMap(
  {
    id: 'training-grounds',
    name: 'Training Grounds',
    placeholder: true,
    create({ scene }) {
      const root = new THREE.Group();
      root.name = 'map:training-grounds';
      scene.add(root);

      scene.background = gradientTexture('training-sky', [[0, '#8f9cf0'], [0.55, '#c9c3f5'], [1, '#efd9f2']]);
      scene.fog = new THREE.Fog('#d9cdf4', 18, 42);

      const hemi = new THREE.HemisphereLight('#fff6ff', '#6f5fae', 1.15);
      root.add(hemi);
      const sun = new THREE.DirectionalLight('#fff3e6', 2.4);
      sun.position.set(-4, 9, 6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -7;
      sun.shadow.camera.right = 7;
      sun.shadow.camera.top = 6;
      sun.shadow.camera.bottom = -6;
      sun.shadow.camera.far = 30;
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.02;
      root.add(sun);
      const rim = new THREE.DirectionalLight('#d6b8ff', 1.1);
      rim.position.set(3, 4, -7);
      root.add(rim);

      const stone = new THREE.MeshStandardMaterial({ color: '#bdb6dc', roughness: 0.85 });
      const stoneDark = new THREE.MeshStandardMaterial({ color: '#8f86b8', roughness: 0.9 });
      const trim = new THREE.MeshStandardMaterial({ color: '#ffd45c', roughness: 0.35, metalness: 0.5 });
      const grass = new THREE.MeshStandardMaterial({ color: '#9fd59a', roughness: 0.95 });

      // ground + dais
      const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 64), grass);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.32;
      ground.receiveShadow = true;
      root.add(ground);
      const dais = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.9, 0.34, 72), stone);
      dais.position.y = -0.17;
      dais.receiveShadow = true;
      root.add(dais);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(6.65, 0.12, 8, 96), trim);
      lip.rotation.x = Math.PI / 2;
      lip.position.y = 0.0;
      root.add(lip);
      // ring of low stones
      const rnd = seeded(7);
      const block = new THREE.BoxGeometry(0.7, 0.36, 0.5);
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const m = new THREE.Mesh(block, i % 2 ? stone : stoneDark);
        m.position.set(Math.cos(a) * 7.25, -0.12 + rnd() * 0.06, Math.sin(a) * 7.25);
        m.rotation.y = -a;
        m.castShadow = m.receiveShadow = true;
        root.add(m);
      }
      // centre sigil
      const sigil = new THREE.Mesh(
        new THREE.RingGeometry(0.75, 0.86, 48),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false })
      );
      sigil.rotation.x = -Math.PI / 2;
      sigil.position.y = 0.006;
      root.add(sigil);

      // team banners (blue = you, red = rivals)
      const banners = [];
      for (const [x, z, color] of [[-5.2, -2.9, '#4f7dff'], [-5.2, 2.9, '#4f7dff'], [5.2, -2.9, '#ff5c7a'], [5.2, 2.9, '#ff5c7a']]) {
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.6, 10), new THREE.MeshStandardMaterial({ color: '#6b4b3a', roughness: 0.6 }));
        pole.position.y = 1.3;
        pole.castShadow = true;
        g.add(pole);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), trim);
        knob.position.y = 2.66;
        g.add(knob);
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.1, 1, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide }));
        cloth.position.set(0, 1.95, 0.08);
        cloth.castShadow = true;
        g.add(cloth);
        banners.push(cloth);
        root.add(g);
      }

      // soft distant hills
      const hillMat = new THREE.MeshStandardMaterial({ color: '#b6a8e6', roughness: 1 });
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.05 + (i / 8) * 0.9);
        const h = new THREE.Mesh(new THREE.SphereGeometry(4 + rnd() * 3, 20, 12), hillMat);
        h.position.set(Math.cos(a) * 26, -2.2, Math.sin(a) * 20 - 4);
        h.scale.y = 0.6 + rnd() * 0.4;
        root.add(h);
      }

      const t0 = { t: 0 };
      return {
        root,
        board: { center: new THREE.Vector3(0, 0, 0.1), tile: 1.12, cols: 8, rows: 4 },
        spots: { home: new THREE.Vector3(0, 0, 0.6) },
        cameras: {
          battle: { pos: [0, 5.2, 7.5], look: [0, 0.25, 0.3], fov: 37 },
          home: { pos: [0.95, 1.12, 4.6], look: [0.95, 0.68, 0.6], fov: 32 },
        },
        update(dt) {
          t0.t += dt;
          banners.forEach((b, i) => (b.rotation.y = Math.sin(t0.t * 1.6 + i) * 0.18));
        },
        dispose() {
          root.traverse((o) => {
            o.geometry?.dispose();
            o.material?.dispose?.();
          });
          root.removeFromParent();
          scene.fog = null;
        },
      };
    },
  },
  { isDefault: true }
);
