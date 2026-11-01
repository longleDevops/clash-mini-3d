import * as THREE from 'three';
import { h } from './dom.js';
import { DESIGN_W, DESIGN_H } from '../core/Game.js';

const _v = new THREE.Vector3();

/** HTML elements pinned to 3D positions (HP bars, damage numbers), in 1280x720 UI space. */
export class WorldOverlay {
  constructor(container) {
    this.el = h('div', { class: 'world-layer' });
    container.append(this.el);
    this.bars = new Map();
  }

  project(world, camera, out = { x: 0, y: 0, vis: true }) {
    _v.copy(world).project(camera);
    out.x = (_v.x * 0.5 + 0.5) * DESIGN_W;
    out.y = (-_v.y * 0.5 + 0.5) * DESIGN_H;
    out.vis = _v.z < 1;
    return out;
  }

  addUnit(unit) {
    const fill = h('i', { class: 'fill' });
    const lag = h('i', { class: 'lag' });
    const energy = unit.team === 'player' ? h('i', { class: 'en-fill' }) : null;
    const el = h('div', { class: `unit-bar ${unit.team}` }, h('div', { class: 'hp' }, lag, fill), energy ? h('div', { class: 'energy' }, energy) : null);
    this.el.append(el);
    this.bars.set(unit, { el, fill, lag, energy });
    this.refresh(unit);
  }

  removeUnit(unit) {
    this.bars.get(unit)?.el.remove();
    this.bars.delete(unit);
  }

  refresh(unit) {
    const b = this.bars.get(unit);
    if (!b) return;
    const k = unit.hp / unit.maxHp;
    b.fill.style.width = `${k * 100}%`;
    b.lag.style.width = `${k * 100}%`;
    b.fill.classList.toggle('low', k < 0.3);
    if (b.energy) b.energy.style.width = `${(unit.energy / unit.maxEnergy) * 100}%`;
    b.el.classList.toggle('dead', !unit.alive);
  }

  update(camera) {
    const p = { x: 0, y: 0, vis: true };
    for (const [unit, b] of this.bars) {
      this.project(unit.ch.anchorWorld('overhead', _v.clone()), camera, p);
      b.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
  }

  pop(world, camera, text, cls = '') {
    const p = this.project(world, camera);
    const el = h('div', { class: `pop ${cls}`, style: { left: `${p.x}px`, top: `${p.y}px` } }, text);
    this.el.append(el);
    setTimeout(() => el.remove(), 1100);
  }

  clear() {
    this.el.replaceChildren();
    this.bars.clear();
  }

  dispose() {
    this.el.remove();
  }
}
