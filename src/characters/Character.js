import * as THREE from 'three';
import { Animator } from './rig/Animator.js';
import { disposeObject } from '../core/dispose.js';

const _v = new THREE.Vector3();

/**
 * Runtime instance of a hero/unit model: owns the 3D object, its Animator,
 * face expressions, blinking and secondary motion. Gameplay state (HP, team…)
 * lives in the battle layer, not here.
 */
export class Character {
  constructor(def, opts = {}) {
    this.def = def;
    const built = def.build(opts);
    this.built = built;
    this.root = built.root;
    this.rig = built.rig;
    this.face = built.face || null;
    this.anchors = built.anchors || {};
    this.animator = new Animator(this.rig, def.clips);
    this.animator.onAnyEvent = (ev) => {
      if (ev.face) this.setExpression(ev.face, ev.hold);
    };
    this.alive = true;
    this.time = Math.random() * 10;
    this.defaultExpression = def.defaultExpression || 'neutral';
    this._exprTimer = 0;
    this._blinkTimer = 1.5 + Math.random() * 2;
    this._blinkHold = 0;
    this.facingTarget = null;
    this.root.traverse((o) => {
      if (o.isMesh) o.userData.character = this;
    });
    this.animator.play('idle', { fade: 0 });
    this.animator.update(0);
    built.afterPose?.();
  }

  /** Play a clip; resolves when a one-shot ends. opts.onEvent(ev) gets named events. */
  play(name, opts = {}) {
    return new Promise((resolve) => {
      if (!this.animator.has(name)) return resolve();
      this.animator.play(name, {
        ...opts,
        onEnd: () => {
          opts.onEnd?.();
          resolve();
        },
      });
      if (this.animator.clips[name].loop) resolve();
    });
  }

  /** Play a one-shot and resolve at a named event (e.g. 'release') — or at the end. */
  playUntil(name, eventName, opts = {}) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      this.play(name, {
        ...opts,
        onEvent: (ev) => {
          opts.onEvent?.(ev);
          if (ev.name === eventName) finish();
        },
      }).then(finish);
    });
  }

  setExpression(name, hold = 0) {
    if (!this.face) return;
    this.face.set(name);
    this._exprTimer = hold || 0;
  }

  /** Smoothly yaw toward a world position (or a yaw angle). */
  faceTowards(target, { instant = false } = {}) {
    let yaw = target;
    if (typeof target !== 'number') {
      _v.copy(target).sub(this.root.position);
      yaw = Math.atan2(_v.x, _v.z);
    }
    this.facingTarget = yaw;
    if (instant) this.root.rotation.y = yaw;
  }

  anchorWorld(name, out = new THREE.Vector3()) {
    const a = this.anchors[name] || this.root;
    return a.getWorldPosition(out);
  }

  update(dt) {
    this.time += dt;
    this.animator.update(dt);
    this.built.secondary?.(this, dt, this.time);
    this.built.afterPose?.();

    if (this.facingTarget !== null) {
      let d = this.facingTarget - this.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.root.rotation.y += d * Math.min(1, dt * 10);
    }

    if (this._exprTimer > 0) {
      this._exprTimer -= dt;
      if (this._exprTimer <= 0 && this.alive) this.face?.set(this.defaultExpression);
    }
    if (this.face && this.alive) {
      if (this._blinkHold > 0) {
        this._blinkHold -= dt;
        if (this._blinkHold <= 0) this.face.setBlink(false);
      } else {
        this._blinkTimer -= dt;
        if (this._blinkTimer <= 0) {
          this.face.setBlink(true);
          this._blinkHold = 0.11;
          this._blinkTimer = 2 + Math.random() * 3;
        }
      }
    }
  }

  dispose() {
    disposeObject(this.root);
  }
}
