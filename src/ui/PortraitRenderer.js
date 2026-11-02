import * as THREE from 'three';
import { Character } from '../characters/Character.js';
import { getUnit } from '../characters/registry.js';
import { bodyChoice } from '../characters/bodyChoice.js';

/**
 * Renders a hero's bust into a transparent PNG (data URL) using the main
 * renderer — used for avatars, unit cards and expression chips.
 */
export class PortraitRenderer {
  constructor(game) {
    this.game = game;
    this.cache = new Map();
    this.size = 256;
    this.rt = new THREE.WebGLRenderTarget(this.size, this.size, { samples: 4 });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.scene = game.newScene();
    this.scene.environmentIntensity = 0.6;
    this.scene.add(new THREE.HemisphereLight('#fff6ff', '#6f5fae', 1.3));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(1.5, 2, 3);
    this.scene.add(key);
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.05, 20);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.size;
    this.pixels = new Uint8Array(this.size * this.size * 4);
  }

  get(unitId, { expression = 'happy', yaw = 0.35, clip = 'idle', t = 0.4 } = {}) {
    const key = `${unitId}|${bodyChoice.get(unitId, '')}|${expression}|${yaw}|${clip}|${t}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const def = getUnit(unitId);
    const ch = new Character(def);
    ch.face?.set(expression);
    ch.face?.setBlink(false);
    ch.animator.play(clip, { fade: 0 });
    ch.animator.update(t);
    ch.built.secondary?.(ch, 0, 0);
    ch.built.afterPose?.();
    ch.root.rotation.y = yaw;
    this.scene.add(ch.root);
    const p = def.portrait || { target: [0, 0.8, 0], distance: 1.3, fov: 26 };
    this.camera.fov = p.fov || 26;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(p.target[0] + 0.12, p.target[1] + 0.06, p.target[2] + p.distance);
    this.camera.lookAt(...p.target);

    const r = this.game.renderer;
    const prevTarget = r.getRenderTarget();
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, this.camera);
    r.readRenderTargetPixels(this.rt, 0, 0, this.size, this.size, this.pixels);
    r.setRenderTarget(prevTarget);
    r.setClearColor(0x000000, 1);

    const ctx = this.canvas.getContext('2d');
    const img = ctx.createImageData(this.size, this.size);
    const row = this.size * 4;
    for (let y = 0; y < this.size; y++) img.data.set(this.pixels.subarray((this.size - 1 - y) * row, (this.size - y) * row), y * row);
    ctx.putImageData(img, 0, 0);
    const url = this.canvas.toDataURL('image/png');
    ch.dispose();
    this.cache.set(key, url);
    return url;
  }
}
