import * as THREE from 'three';
import { frameCamera } from '../core/Game.js';
import { getMap } from '../maps/registry.js';
import { CHAPTERS, chapterStars, isChapterUnlocked, globalStage, STAGES_PER_CHAPTER } from '../maps/chapters.js';
import { Hotspots } from '../ui/Hotspots.js';
import { h, icon, fmt, toast } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';

/** World map: pick a chapter island. Locked chapters stay veiled in cloud. */
export class WorldMapScreen {
  constructor(game) {
    this.game = game;
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
  }

  async enter() {
    const g = this.game, save = g.save.data;
    this.unlocked = CHAPTERS.filter((c) => isChapterUnlocked(save, c)).map((c) => c.id);
    this.scene = g.newScene();
    this.map = getMap('world-map').create({ renderer: g.renderer, scene: this.scene, unlocked: this.unlocked });
    this.cam = this.map.cameras.view;
    frameCamera(this.camera, this.cam);
    this.t = 0;
    this.buildUI();
  }

  open(ch) {
    if (!this.unlocked.includes(ch.id)) {
      toast(this.ui, `Clear Stage ${ch.id - 1}-${STAGES_PER_CHAPTER} to unlock ${ch.name}`);
      return;
    }
    this.game.go('chapter', { chapter: ch.id });
  }

  buildUI() {
    const g = this.game, save = g.save.data;
    this.ui = h(
      'div',
      { class: 'screen worldmap' },
      (this.spotHost = h('div', { class: 'world-host' })),
      h(
        'div',
        { class: 'scene-top' },
        h('button', { class: 'btn-round', onclick: () => g.go('home'), 'aria-label': 'Back to home' }, icon(ICONS.back)),
        h('div', { class: 'scene-title panel' }, 'World Map'),
        h('div', { class: 'spacer' }),
        h('div', { class: 'res panel' }, icon(ICONS.gem), h('span', {}, fmt(save.gems))),
        h('div', { class: 'res panel' }, icon(ICONS.coin), h('span', {}, fmt(save.gold)))
      ),
      h(
        'div',
        { class: 'difficulty panel' },
        h('button', { class: 'diff active' }, 'Normal'),
        h('button', { class: 'diff locked', onclick: () => toast(this.ui, 'Hard mode unlocks after the campaign') }, 'Hard', h('i', { class: 'lock', html: ICONS.lock })),
        h('button', { class: 'diff locked', onclick: () => toast(this.ui, 'Elite mode unlocks after Hard') }, 'Elite', h('i', { class: 'lock', html: ICONS.lock }))
      )
    );
    g.ui.append(this.ui);

    this.spots = new Hotspots(this.spotHost);
    for (const c of this.map.chapters) {
      const ch = CHAPTERS.find((x) => x.id === c.id);
      const { got, max } = chapterStars(save, ch);
      const current = !c.locked && save.stage >= globalStage(ch.id, 1) && save.stage <= globalStage(ch.id, STAGES_PER_CHAPTER);
      const el = h(
        'button',
        { class: `chapter-label${c.locked ? ' locked' : ''}${current ? ' current' : ''}`, style: { '--c': ch.color }, onclick: () => this.open(ch) },
        h('span', { class: 'num' }, String(ch.id)),
        h('span', { class: 'nm' }, ch.name),
        c.locked
          ? h('small', { class: 'req' }, h('i', { class: 'lock', html: ICONS.lock }), `Clear ${ch.id - 1}-${STAGES_PER_CHAPTER}`)
          : h('small', { class: 'stars' }, icon(ICONS.star), `${got}/${max}`),
        current ? h('em', {}, 'You are here') : null
      );
      this.spots.add(c.anchor, el);
    }
  }

  onPointerDown(ndc) {
    const ray = this.game.raycast(ndc, this.camera);
    let best = null;
    for (const c of this.map.chapters) {
      const d = ray.ray.distanceToPoint(c.center.clone().add(new THREE.Vector3(0, 0.8, 0)));
      if (d < 2.6 && (!best || d < best.d)) best = { c, d };
    }
    if (best) this.open(CHAPTERS.find((x) => x.id === best.c.id));
  }

  update(dt) {
    this.t += dt;
    this.map.update?.(dt, this.t);
    const c = this.cam;
    this.camera.position.set(c.pos[0] + Math.sin(this.t * 0.2) * 0.25, c.pos[1] + Math.sin(this.t * 0.33) * 0.08, c.pos[2]);
    this.camera.lookAt(...c.look);
  }

  afterRender() {
    this.spots?.update(this.camera);
  }

  async exit() {
    this.spots?.dispose();
    this.ui.remove();
    this.map.dispose?.();
  }
}
