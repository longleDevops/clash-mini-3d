import * as THREE from 'three';
import { h } from './dom.js';
import { DESIGN_W, DESIGN_H } from '../core/Game.js';

const _v = new THREE.Vector3();

/**
 * DOM elements pinned above 3D points (landmark labels, stage nodes) in the
 * 1280x720 UI space. Each element is centred horizontally on its anchor and
 * sits above it; elements behind the camera are hidden.
 */
export class Hotspots {
  constructor(container, cls = 'hotspot-layer') {
    this.el = h('div', { class: cls });
    container.append(this.el);
    this.items = [];
  }

  add(anchor, el, { align = 'bottom' } = {}) {
    this.el.append(el);
    const item = { anchor: anchor.clone(), el, align };
    this.items.push(item);
    return item;
  }

  project(world, camera) {
    _v.copy(world).project(camera);
    return { x: (_v.x * 0.5 + 0.5) * DESIGN_W, y: (-_v.y * 0.5 + 0.5) * DESIGN_H, vis: _v.z < 1 };
  }

  update(camera) {
    for (const it of this.items) {
      const p = this.project(it.anchor, camera);
      // keep labels fully on screen (width measured once, after first layout)
      if (!it.w) it.w = it.el.offsetWidth;
      const half = (it.w || 0) / 2 + 8;
      const x = Math.min(DESIGN_W - half, Math.max(half, p.x));
      const ty = it.align === 'center' ? '-50%' : '-100%';
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, ${ty})`;
      it.el.style.visibility = p.vis ? '' : 'hidden';
    }
  }

  dispose() {
    this.el.remove();
    this.items.length = 0;
  }
}
