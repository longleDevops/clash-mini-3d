import * as THREE from 'three';
import { frameCamera } from '../core/Game.js';
import { getMap } from '../maps/registry.js';
import { Character } from '../characters/Character.js';
import { getUnit } from '../characters/registry.js';
import { FxSystem } from '../fx/FxSystem.js';
import { Hotspots } from '../ui/Hotspots.js';
import { h, icon, fmt, toast } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';
import { SCENE_ICONS } from '../ui/sceneIcons.js';
import { pick } from '../core/math.js';
import { chapterForStage, stageRef } from '../maps/chapters.js';

const SPOT_ICONS = { campaign: ICONS.swords, heroes: ICONS.heroes, summon: SCENE_ICONS.summon, guild: ICONS.guild, shop: ICONS.shop, arena: SCENE_ICONS.arena };

/**
 * Main hub (Skyward Haven): Lyra on her dais in front of the floating sanctum,
 * tappable landmark labels, resources, and the Battle button.
 */
export class HomeScreen {
  constructor(game) {
    this.game = game;
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);
  }

  async enter() {
    const g = this.game;
    this.scene = g.newScene();
    this.map = getMap('skyward-haven').create({ renderer: g.renderer, scene: this.scene });
    this.fx = new FxSystem(this.scene);
    this.hero = new Character(getUnit('lyra'));
    this.hero.root.position.copy(this.map.spots.home);
    this.cam = this.map.cameras.home;
    // turn to face the camera
    this.hero.faceTowards(Math.atan2(this.cam.pos[0] - this.map.spots.home.x, this.cam.pos[2] - this.map.spots.home.z) + 0.1, { instant: true });
    this.scene.add(this.hero.root);
    frameCamera(this.camera, this.cam);
    this.t = 0;
    this.buildUI();
  }

  buildUI() {
    const g = this.game, save = g.save.data, lyra = getUnit('lyra');
    const avatar = g.portraits.get('lyra', { expression: 'happy' });
    const next = stageRef(save.stage);
    const goCampaign = () => g.go('chapter', { chapter: chapterForStage(save.stage).id });
    this.ui = h(
      'div',
      { class: 'screen home' },
      (this.spotHost = h('div', { class: 'world-host' })),
      h(
        'div',
        { class: 'topbar' },
        h('div', { class: 'player-card panel' }, h('img', { class: 'avatar', src: avatar, alt: '' }), h('div', {}, h('div', { class: 'pname' }, 'Summoner'), h('div', { class: 'plevel' }, `Stage ${next.label}`))),
        h(
          'div',
          { class: 'resources' },
          h('div', { class: 'res panel' }, icon(ICONS.gem), h('span', {}, fmt(save.gems))),
          h('div', { class: 'res panel' }, icon(ICONS.coin), h('span', {}, fmt(save.gold))),
          h('div', { class: 'res panel' }, icon(ICONS.bolt), h('span', {}, '30/30'))
        )
      ),
      h(
        'div',
        { class: 'hero-plate compact' },
        h('div', { class: 'eyebrow' }, 'Featured hero'),
        h('div', { class: 'hero-name' }, lyra.name),
        h('div', { class: 'hero-title' }, lyra.title),
        h('div', { class: 'chips' }, h('span', { class: 'chip' }, icon(ICONS.mage), lyra.role), h('span', { class: 'chip' }, icon(ICONS.arcane), lyra.element)),
        h('div', { class: 'tap-hint' }, 'Tap Lyra to say hi')
      ),
      h(
        'nav',
        { class: 'bottom-nav' },
        navBtn(ICONS.home, 'Home', true),
        navBtn(ICONS.heroes, 'Heroes', false, () => g.go('studio')),
        h('button', { class: 'btn btn-gold battle-btn', onclick: goCampaign }, icon(ICONS.swords), h('span', {}, 'Battle'), h('small', {}, next.bonus ? next.label : `Stage ${next.label}`)),
        navBtn(SCENE_ICONS.map, 'World', false, () => g.go('world')),
        navBtn(ICONS.shop, 'Shop', false, () => toast(this.ui, 'Shop opens in a later update'), true)
      )
    );
    g.ui.append(this.ui);

    // landmark labels pinned to the hub's islands
    this.spots = new Hotspots(this.spotHost);
    for (const s of this.map.hotspots || []) {
      const act = () => {
        if (s.target === 'world') g.go('world');
        else if (s.target === 'studio') g.go('studio');
        else toast(this.ui, `${s.label} opens in a later update`);
      };
      const el = h(
        'button',
        { class: `spot-label${s.primary ? ' primary' : ''}${s.locked ? ' locked' : ''}`, onclick: act, 'aria-label': s.label },
        icon(SPOT_ICONS[s.id] || ICONS.star),
        h('span', {}, s.label),
        s.primary ? h('small', {}, next.label) : null,
        s.locked ? h('i', { class: 'lock', html: ICONS.lock }) : null
      );
      this.spots.add(s.anchor, el);
    }
  }

  onPointerDown(ndc) {
    const ray = this.game.raycast(ndc, this.camera);
    const hit = ray.intersectObject(this.hero.root, true)[0];
    if (!hit) return;
    const react = pick(['happy', 'wink', 'laugh', 'surprised']);
    this.hero.play('victory');
    this.hero.setExpression(react, 1.3);
    this.fx.burst(this.hero.anchorWorld('overhead').add(new THREE.Vector3(0, -0.3, 0)), { color: '#ffd45c', count: 10, size: 0.16, speed: 1.4 });
    clearTimeout(this._react);
    this._react = setTimeout(() => this.hero?.play('idle', { fade: 0.25 }), 1150);
  }

  update(dt) {
    this.t += dt;
    this.hero.update(dt);
    this.map.update?.(dt, this.t);
    this.fx.update(dt);
    // gentle idle camera drift
    const c = this.cam;
    this.camera.position.set(c.pos[0] + Math.sin(this.t * 0.25) * 0.12, c.pos[1] + Math.sin(this.t * 0.4) * 0.03, c.pos[2]);
    this.camera.lookAt(...c.look);
  }

  afterRender() {
    this.spots?.update(this.camera);
  }

  async exit() {
    clearTimeout(this._react);
    this.spots?.dispose();
    this.ui.remove();
    this.fx.clear();
    this.hero.dispose();
    this.map.dispose?.();
    this.hero = null;
  }
}

function navBtn(svg, label, active, onclick, locked) {
  return h('button', { class: `nav-btn${active ? ' active' : ''}${locked ? ' locked' : ''}`, onclick }, icon(svg), h('span', {}, label), locked ? h('i', { class: 'lock', html: ICONS.lock }) : null);
}
