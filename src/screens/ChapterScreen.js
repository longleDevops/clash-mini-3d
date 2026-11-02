import * as THREE from 'three';
import { frameCamera } from '../core/Game.js';
import { getMap } from '../maps/registry.js';
import { Character } from '../characters/Character.js';
import { getUnit } from '../characters/registry.js';
import { stageInfo } from '../battle/stages.js';
import { getChapter, globalStage, chapterStars, isChapterUnlocked, STAGES_PER_CHAPTER, CHEST_STEPS, CHAPTERS } from '../maps/chapters.js';
import { Hotspots } from '../ui/Hotspots.js';
import { h, icon, fmt, toast } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';
import { SCENE_ICONS } from '../ui/sceneIcons.js';

/**
 * Chapter map: six stage pedestals along a road, Lyra waiting on the next
 * one. Tap a stage for its details and the Battle button; star chests along
 * the bottom pay out at 6 / 12 / 18 stars.
 */
export class ChapterScreen {
  constructor(game) {
    this.game = game;
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
  }

  async enter({ chapter } = {}) {
    const g = this.game, save = g.save.data;
    let ch = getChapter(chapter || [...CHAPTERS].reverse().find((c) => isChapterUnlocked(save, c))?.id || 1);
    if (!isChapterUnlocked(save, ch)) ch = CHAPTERS[0];
    this.ch = ch;
    this.states = [];
    for (let i = 1; i <= STAGES_PER_CHAPTER; i++) {
      const n = globalStage(ch.id, i);
      this.states.push(save.bestStars?.[n] > 0 ? 'cleared' : n <= save.stage ? 'current' : 'locked');
    }
    // only the first uncleared unlocked stage is "current"
    let seen = false;
    this.states = this.states.map((s) => (s === 'current' ? (seen ? 'cleared' : ((seen = true), 'current')) : s));
    this.scene = g.newScene();
    this.map = getMap('chapter-map').create({ renderer: g.renderer, scene: this.scene, chapter: ch.id, states: this.states });
    this.cam = this.map.cameras.view;
    frameCamera(this.camera, this.cam);

    // Lyra waits on the next stage (or the boss pedestal once all are cleared)
    const at = this.map.nodes.find((n) => n.state === 'current') || this.map.nodes[this.map.nodes.length - 1];
    this.hero = new Character(getUnit('lyra'));
    this.hero.root.scale.setScalar(1.25);
    this.hero.root.position.copy(at.pos);
    this.hero.faceTowards(Math.atan2(this.cam.pos[0] - at.pos.x, this.cam.pos[2] - at.pos.z), { instant: true });
    this.scene.add(this.hero.root);
    this.t = 0;
    this.selected = null;
    this.buildUI();
    this.select(at.index, false);
  }

  stageNumber(i) {
    return globalStage(this.ch.id, i);
  }

  buildUI() {
    const g = this.game, save = g.save.data, ch = this.ch;
    this.ui = h(
      'div',
      { class: 'screen chaptermap', style: { '--c': ch.color } },
      (this.spotHost = h('div', { class: 'world-host' })),
      h(
        'div',
        { class: 'scene-top' },
        h('button', { class: 'btn-round', onclick: () => g.go('world'), 'aria-label': 'Back to world map' }, icon(ICONS.back)),
        h('div', { class: 'scene-title panel' }, h('small', {}, `Chapter ${ch.id}`), ch.name),
        h('div', { class: 'spacer' }),
        h('div', { class: 'res panel' }, icon(ICONS.gem), (this.gemEl = h('span', {}, fmt(save.gems)))),
        h('div', { class: 'res panel' }, icon(ICONS.coin), (this.goldEl = h('span', {}, fmt(save.gold))))
      ),
      (this.card = h('div', { class: 'stage-card panel' })),
      (this.chestBar = h('div', { class: 'chest-bar panel' })),
      h('button', { class: 'btn btn-purple small home-btn', onclick: () => g.go('home') }, icon(ICONS.home), 'Home')
    );
    g.ui.append(this.ui);

    this.spots = new Hotspots(this.spotHost);
    this.badges = this.map.nodes.map((node) => {
      const n = this.stageNumber(node.index);
      const stars = save.bestStars?.[n] || 0;
      const el = h(
        'button',
        { class: `node-badge ${node.state}${node.boss ? ' boss' : ''}`, onclick: () => this.select(node.index) },
        node.boss ? icon(SCENE_ICONS.boss, 'ico boss-ico') : null,
        h('b', {}, `${ch.id}-${node.index}`),
        node.state === 'locked' ? h('i', { class: 'lock', html: ICONS.lock }) : h('span', { class: 'mini-stars' }, [0, 1, 2].map((k) => icon(k < stars ? ICONS.star : ICONS.starEmpty)))
      );
      this.spots.add(node.pos.clone().add(new THREE.Vector3(0, node.boss ? 2.0 : node.state === 'current' ? 1.75 : 0.55, 0)), el);
      return el;
    });
    this.renderChests();
  }

  select(index, bounce = true) {
    const g = this.game, save = g.save.data, ch = this.ch;
    const node = this.map.nodes[index - 1];
    const n = this.stageNumber(index);
    const info = stageInfo(n);
    const stars = save.bestStars?.[n] || 0;
    this.selected = index;
    this.badges.forEach((b, i) => b.classList.toggle('selected', i === index - 1));
    const counts = {};
    for (const [id] of info.enemies) counts[id] = (counts[id] || 0) + 1;
    const foes = Object.entries(counts).map(([id, k]) =>
      h('div', { class: 'foe' }, h('img', { src: g.portraits.get(id, { expression: 'neutral', yaw: -0.35 }), alt: '' }), h('b', {}, `x${k}`), h('small', {}, getUnit(id).name))
    );
    const locked = node.state === 'locked';
    const gold = 300 + n * 120 + 150;
    this.card.replaceChildren(
      h('div', { class: 'eyebrow' }, node.boss ? 'Boss stage' : `Chapter ${ch.id}`),
      h('h2', {}, `Stage ${ch.id}-${index}`),
      h('div', { class: 'card-stars' }, [0, 1, 2].map((k) => icon(k < stars ? ICONS.star : ICONS.starEmpty))),
      h('div', { class: 'sub' }, 'Enemies'),
      h('div', { class: 'foes' }, foes),
      h('div', { class: 'sub' }, 'Rewards'),
      h('div', { class: 'card-rewards' }, h('span', {}, icon(ICONS.coin), `up to ${fmt(gold)}`), h('span', {}, icon(ICONS.gem), 'up to 25')),
      h('div', { class: 'hint' }, 'Stars: keep Lyra above 30% / 60% HP'),
      locked
        ? h('button', { class: 'btn btn-plain', disabled: true }, icon(ICONS.lock), `Clear ${ch.id}-${index - 1}`)
        : h('button', { class: 'btn btn-gold go-btn', onclick: () => g.go('battle', { stage: n }) }, icon(ICONS.swords), node.state === 'cleared' ? 'Replay' : 'Battle')
    );
    if (bounce) {
      this.card.classList.remove('pop-in');
      void this.card.offsetWidth;
      this.card.classList.add('pop-in');
      // Lyra turns to look at the picked stage
      if (this.hero) this.hero.faceTowards(node.pos);
    }
  }

  renderChests() {
    const save = this.game.save.data, ch = this.ch;
    const { got, max } = chapterStars(save, ch);
    const claimed = save.chests?.[ch.id] || [];
    const pct = (got / max) * 100;
    this.chestBar.replaceChildren(
      h('div', { class: 'star-count' }, icon(ICONS.star), h('b', {}, `${got}/${max}`)),
      h(
        'div',
        { class: 'track' },
        h('i', { class: 'fill', style: { width: `${pct}%` } }),
        CHEST_STEPS.map((step, i) => {
          const ready = got >= step.stars && !claimed[i];
          return h(
            'button',
            { class: `chest${ready ? ' ready' : ''}${claimed[i] ? ' open' : ''}`, style: { left: `${(step.stars / max) * 100}%` }, onclick: () => this.claim(i), 'aria-label': `Chest at ${step.stars} stars` },
            icon(ICONS.chest),
            h('small', {}, String(step.stars))
          );
        })
      )
    );
  }

  claim(i) {
    const g = this.game, save = g.save, ch = this.ch, step = CHEST_STEPS[i];
    const { got } = chapterStars(save.data, ch);
    const claimed = [...(save.data.chests?.[ch.id] || [])];
    if (claimed[i]) return toast(this.ui, 'Already opened');
    if (got < step.stars) return toast(this.ui, `Collect ${step.stars} stars in this chapter to open`);
    claimed[i] = true;
    save.set({ gems: save.data.gems + step.gems, gold: save.data.gold + step.gold, chests: { ...(save.data.chests || {}), [ch.id]: claimed } });
    this.gemEl.textContent = fmt(save.data.gems);
    this.goldEl.textContent = fmt(save.data.gold);
    toast(this.ui, `+${step.gems} gems, +${fmt(step.gold)} gold`);
    this.hero?.play('victory');
    this.renderChests();
  }

  onPointerDown(ndc) {
    const ray = this.game.raycast(ndc, this.camera);
    if (this.hero && ray.intersectObject(this.hero.root, true)[0]) {
      this.hero.play('victory');
      this.hero.setExpression('happy', 1.2);
      return;
    }
    const hit = ray.intersectObjects(this.map.nodes.map((n) => n.pick), false)[0];
    if (hit) this.select(this.map.nodes.find((n) => n.pick === hit.object).index);
  }

  update(dt) {
    this.t += dt;
    this.hero?.update(dt);
    this.map.update?.(dt, this.t);
    const c = this.cam;
    this.camera.position.set(c.pos[0] + Math.sin(this.t * 0.22) * 0.2, c.pos[1], c.pos[2] + Math.sin(this.t * 0.3) * 0.08);
    this.camera.lookAt(...c.look);
  }

  afterRender() {
    this.spots?.update(this.camera);
  }

  async exit() {
    this.spots?.dispose();
    this.ui.remove();
    this.hero?.dispose();
    this.hero = null;
    this.map.dispose?.();
  }
}
