import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { h } from '../ui/dom.js';
import { PortraitRenderer } from '../ui/PortraitRenderer.js';
import { Save } from './save.js';

export const DESIGN_W = 1280;
export const DESIGN_H = 720;

/**
 * Owns the renderer, the fixed 16:9 stage (letterboxed to any window), the
 * DOM UI root (authored at 1280x720 and scaled), and the screen manager.
 */
export class Game {
  constructor(mount) {
    this.mount = mount;
    this.stage = h('div', { class: 'stage' });
    this.ui = h('div', { class: 'ui-root' });
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.stage.append(this.canvas, this.ui);
    this.rotateHint = h('div', { class: 'rotate-hint' }, 'Turn your phone sideways for the full arena');
    mount.append(this.stage, this.rotateHint);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.save = new Save();
    this.portraits = new PortraitRenderer(this);
    this.screens = {};
    this.current = null;
    this.currentName = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.uiScale = 1;

    this._fit = this._fit.bind(this);
    window.addEventListener('resize', this._fit);
    new ResizeObserver(this._fit).observe(mount);
    this._fit();
    this._bindPointer();
    this._last = performance.now();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  newScene() {
    const s = new THREE.Scene();
    s.environment = this.envTexture;
    s.environmentIntensity = 0.45;
    return s;
  }

  register(name, screen) {
    this.screens[name] = screen;
  }

  async go(name, params = {}) {
    if (this._switching) return;
    this._switching = true;
    this.ui.classList.add('fading');
    await new Promise((r) => setTimeout(r, this.current ? 160 : 0));
    const prev = this.current;
    this.current = null; // pause frames while screens swap
    if (prev) await prev.exit();
    const next = this.screens[name];
    try {
      await next.enter(params);
    } catch (err) {
      console.error(`[Game] failed to open ${name}`, err);
      this._switching = false;
      this.ui.classList.remove('fading');
      return;
    }
    this.current = next;
    this.currentName = name;
    next.resize?.(this.width, this.height);
    this.ui.classList.remove('fading');
    this._switching = false;
    this.onScreen?.(name, params);
  }

  _fit() {
    const r = this.mount.getBoundingClientRect();
    const s = Math.min(r.width / DESIGN_W, r.height / DESIGN_H) || 1;
    this.width = Math.max(1, Math.floor(DESIGN_W * s));
    this.height = Math.max(1, Math.floor(DESIGN_H * s));
    this.uiScale = this.width / DESIGN_W;
    this.stage.style.width = this.width + 'px';
    this.stage.style.height = this.height + 'px';
    this.ui.style.transform = `scale(${this.uiScale})`;
    this.renderer.setSize(this.width, this.height);
    this.mount.classList.toggle('portrait', r.height > r.width * 1.05);
    this.current?.resize?.(this.width, this.height);
  }

  _bindPointer() {
    const toNdc = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      return this.pointer;
    };
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
      this.canvas.addEventListener(type, (e) => {
        const fn = this.current?.[{ pointerdown: 'onPointerDown', pointermove: 'onPointerMove', pointerup: 'onPointerUp' }[type]];
        if (fn) fn.call(this.current, toNdc(e), e);
      });
    }
  }

  raycast(ndc, camera) {
    this.raycaster.setFromCamera(ndc, camera);
    return this.raycaster;
  }

  _frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    const scr = this.current;
    if (!scr) return;
    scr.update(dt);
    if (scr.scene && scr.camera) this.renderer.render(scr.scene, scr.camera);
    scr.afterRender?.();
  }
}

/** Apply a { pos, look, fov } framing to a camera. */
export function frameCamera(camera, cfg) {
  camera.position.set(...cfg.pos);
  camera.fov = cfg.fov ?? camera.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(...cfg.look);
}
