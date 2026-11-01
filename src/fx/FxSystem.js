import * as THREE from 'three';
import { glowTexture, sparkTexture, flameTexture, ringTexture } from '../core/textures.js';
import { rand, ease } from '../core/math.js';

const _v = new THREE.Vector3();

/**
 * Lightweight VFX: additive sprites (particles, projectiles, wisps), ground rings
 * and a few bespoke meshes. Everything is driven by the screen's game clock, so
 * x2 speed and pause apply automatically. No dynamic lights (avoids shader recompiles).
 */
export class FxSystem {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'fx';
    scene.add(this.group);
    this.items = [];
    this.shake = 0;
  }

  // Coloured sprites use normal blending so effects stay readable on bright arenas;
  // white cores/flashes are additive for a hot centre.
  _sprite(tex, color, size, opacity = 1, additive = false) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false })
    );
    s.scale.setScalar(size);
    this.group.add(s);
    return s;
  }

  /** Generic updatable: item.update(dt) returns false when finished. */
  _push(item) {
    this.items.push(item);
    return item;
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.update(dt) === false) {
        this.items.splice(i, 1);
        it.dispose?.();
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  clear() {
    for (const it of this.items) it.dispose?.();
    this.items.length = 0;
  }

  // ---------- particles ----------
  burst(pos, { color = '#c57cff', count = 14, speed = 2.2, size = 0.22, life = 0.6, gravity = -3, up = 1.2, tex = 'spark', spread = 1 } = {}) {
    const map = tex === 'glow' ? glowTexture() : sparkTexture();
    for (let n = 0; n < count; n++) {
      const s = this._sprite(map, color, size * rand(0.6, 1.2));
      s.position.copy(pos);
      const dir = new THREE.Vector3(rand(-1, 1) * spread, rand(0.2, 1) * up, rand(-1, 1) * spread).normalize().multiplyScalar(speed * rand(0.5, 1.1));
      const base = s.scale.x;
      let t = 0;
      const L = life * rand(0.7, 1.2);
      this._push({
        update: (dt) => {
          t += dt;
          dir.y += gravity * dt;
          s.position.addScaledVector(dir, dt);
          const k = t / L;
          s.material.opacity = 1 - k;
          s.scale.setScalar(base * (1 - k * 0.6));
          s.material.rotation += dt * 4;
          return t < L;
        },
        dispose: () => this._kill(s),
      });
    }
  }

  ring(pos, { color = '#c57cff', radius = 1.1, life = 0.5, y = 0.03 } = {}) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: ringTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, y, pos.z);
    this.group.add(m);
    let t = 0;
    return this._push({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / life);
        m.scale.setScalar(0.2 + radius * 2 * ease.out(k));
        m.material.opacity = 1 - k;
        return k < 1;
      },
      dispose: () => this._kill(m),
    });
  }

  flash(pos, { color = '#ffffff', size = 1.2, life = 0.25 } = {}) {
    const s = this._sprite(glowTexture(), color, size, 1, true);
    s.position.copy(pos);
    let t = 0;
    this._push({
      update: (dt) => {
        t += dt;
        const k = t / life;
        s.scale.setScalar(size * (1 + k));
        s.material.opacity = 1 - k;
        return k < 1;
      },
      dispose: () => this._kill(s),
    });
  }

  /** Glowing orb that flies from -> to (Vector3 or () => Vector3) on an arc. Resolves on impact. */
  projectile({ from, to, color = '#c57cff', core = '#ffffff', size = 0.34, speed = 8, arc = 0.35, trail = true, tex = 'glow' }) {
    return new Promise((resolve) => {
      const start = from.clone();
      const getTo = typeof to === 'function' ? to : () => to;
      const head = this._sprite(tex === 'flame' ? flameTexture() : glowTexture(), color, size * 1.7);
      const inner = this._sprite(glowTexture(), core, size * 0.75, 1, true);
      const dist = start.distanceTo(getTo());
      const dur = Math.max(0.18, dist / speed);
      let t = 0, trailT = 0;
      this._push({
        update: (dt) => {
          t += dt;
          const k = Math.min(1, t / dur);
          const end = getTo();
          _v.lerpVectors(start, end, k);
          _v.y += Math.sin(k * Math.PI) * arc * dist * 0.35;
          head.position.copy(_v);
          inner.position.copy(_v);
          head.material.rotation += dt * 6;
          if (trail) {
            trailT += dt;
            while (trailT > 0.016) {
              trailT -= 0.016;
              this._trail(_v, color, size * 0.9);
            }
          }
          if (k >= 1) {
            resolve(end.clone());
            return false;
          }
          return true;
        },
        dispose: () => {
          this._kill(head);
          this._kill(inner);
        },
      });
    });
  }

  _trail(pos, color, size) {
    const s = this._sprite(glowTexture(), color, size);
    s.position.copy(pos).add(new THREE.Vector3(rand(-0.03, 0.03), rand(-0.03, 0.03), rand(-0.03, 0.03)));
    let t = 0;
    this._push({
      update: (dt) => {
        t += dt;
        const k = t / 0.3;
        s.material.opacity = 0.55 * (1 - k);
        s.scale.setScalar(size * (1 - k * 0.7));
        return k < 1;
      },
      dispose: () => this._kill(s),
    });
  }

  /** Foxfire wisps that orbit `center()` until released. Returns a controller. */
  orbitWisps(center, { count = 3, color = '#ff6eb4', radius = 0.55, height = 0.75, size = 0.36 } = {}) {
    const wisps = [];
    for (let i = 0; i < count; i++) {
      const s = this._sprite(flameTexture(), i % 2 ? '#c57cff' : color, size);
      s.scale.set(size * 0.8, size * 1.15, 1);
      wisps.push({ s, phase: (i / count) * Math.PI * 2, grow: 0 });
    }
    let t = 0, live = true;
    const item = this._push({
      update: (dt) => {
        if (!live) return false;
        t += dt;
        const c = center();
        for (const w of wisps) {
          w.grow = Math.min(1, w.grow + dt * 3);
          const a = t * 4 + w.phase;
          w.s.position.set(c.x + Math.cos(a) * radius, c.y + height + Math.sin(t * 6 + w.phase) * 0.08, c.z + Math.sin(a) * radius);
          const fl = 1 + Math.sin(t * 20 + w.phase) * 0.1;
          w.s.scale.set(size * 0.8 * w.grow * fl, size * 1.15 * w.grow * fl, 1);
          if (Math.random() < 0.5) this._trail(w.s.position, w.s.material.color.getStyle(), size * 0.45);
        }
        return true;
      },
      dispose: () => wisps.forEach((w) => this._kill(w.s)),
    });
    return {
      positions: () => wisps.map((w) => w.s.position.clone()),
      release: () => {
        live = false;
        item.update = () => false;
      },
    };
  }

  /** Big crescent moon that fades in above a point, then out. Returns a dismiss() function. */
  crescentMoon(pos, { color = '#ffd45c', size = 2.2 } = {}) {
    const shape = new THREE.Shape();
    const R = 1, N = 36;
    for (let i = 0; i <= N; i++) {
      const a = -Math.PI * 0.75 + (i / N) * Math.PI * 1.5;
      i ? shape.lineTo(Math.cos(a) * R, Math.sin(a) * R) : shape.moveTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N, a = -Math.PI * 0.75 + t * Math.PI * 1.5;
      const r = R - 0.42 * Math.sin(Math.PI * t);
      shape.lineTo(Math.cos(a) * r + 0.1, Math.sin(a) * r);
    }
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.z = Math.PI * 0.5;
    g.add(mesh);
    const halo = this._sprite(glowTexture(), '#c57cff', size * 2.4, 0);
    this.group.remove(halo);
    g.add(halo);
    g.position.copy(pos);
    g.scale.setScalar(size);
    this.group.add(g);
    let t = 0, out = -1;
    this._push({
      update: (dt) => {
        t += dt;
        const k = out < 0 ? Math.min(1, t / 0.45) : Math.max(0, 1 - (t - out) / 0.5);
        mesh.material.opacity = 0.95 * k;
        halo.material.opacity = 0.6 * k;
        g.rotation.z = Math.sin(t * 1.5) * 0.08;
        g.position.y = pos.y + Math.sin(t * 2) * 0.05;
        return !(out >= 0 && k <= 0);
      },
      dispose: () => {
        g.removeFromParent();
        mesh.geometry.dispose();
        mesh.material.dispose();
        halo.material.dispose();
      },
    });
    return () => {
      out = t;
    };
  }

  /** A star that falls from the sky onto `to`. Resolves on impact. */
  fallingStar(to, { color = '#ffd45c', delay = 0, height = 4.5 } = {}) {
    return new Promise((resolve) => {
      const s = this._sprite(sparkTexture(), color, 0.9, 0);
      const glow = this._sprite(glowTexture(), '#c57cff', 1.1, 0);
      const from = to.clone().add(new THREE.Vector3(-1.2, height, -0.4));
      let t = -delay;
      const dur = 0.42;
      this._push({
        update: (dt) => {
          t += dt;
          if (t < 0) return true;
          const k = Math.min(1, t / dur);
          const e = ease.in(k);
          s.position.lerpVectors(from, to, e);
          glow.position.copy(s.position);
          s.material.opacity = glow.material.opacity = Math.min(1, k * 4);
          s.material.rotation += dt * 10;
          this._trail(s.position, color, 0.4);
          if (k >= 1) {
            resolve();
            return false;
          }
          return true;
        },
        dispose: () => {
          this._kill(s);
          this._kill(glow);
        },
      });
    });
  }

  /** Bell chime: little golden rings + sparkles around a point. */
  chime(pos) {
    for (let i = 0; i < 3; i++) {
      const s = this._sprite(sparkTexture(), '#ffd45c', 0.3);
      const a = (i / 3) * Math.PI * 2;
      let t = 0;
      this._push({
        update: (dt) => {
          t += dt;
          const k = t / 0.9;
          s.position.set(pos.x + Math.cos(a + t * 3) * (0.3 + k * 0.4), pos.y + k * 0.6, pos.z + Math.sin(a + t * 3) * (0.3 + k * 0.4));
          s.material.opacity = 1 - k;
          return k < 1;
        },
        dispose: () => this._kill(s),
      });
    }
    this.ring(new THREE.Vector3(pos.x, 0, pos.z), { color: '#ffd45c', radius: 0.8, life: 0.6 });
  }

  /** Short-lived healing sparkle column. */
  heal(pos) {
    this.burst(pos, { color: '#8dffb0', count: 10, speed: 0.8, up: 2, gravity: 1.5, size: 0.18, life: 0.9, spread: 0.4 });
  }

  _kill(obj) {
    obj.removeFromParent();
    obj.material?.dispose();
  }
}
