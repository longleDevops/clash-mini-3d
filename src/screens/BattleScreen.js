import * as THREE from 'three';
import { frameCamera } from '../core/Game.js';
import { Clock } from '../core/Clock.js';
import { getMap } from '../maps/registry.js';
import { BoardView } from '../battle/BoardView.js';
import { BattleController } from '../battle/BattleController.js';
import { stageInfo } from '../battle/stages.js';
import { FxSystem } from '../fx/FxSystem.js';
import { WorldOverlay } from '../ui/WorldOverlay.js';
import { h, icon, fmt } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';

/**
 * Battle flow: deploy (place your hero on the blue half) -> fight (turn-based
 * rounds, fire skills when energy allows) -> result (stars + rewards).
 */
export class BattleScreen {
  constructor(game) {
    this.game = game;
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);
  }

  async enter({ stage } = {}) {
    const g = this.game;
    this.stage = stageInfo(stage || g.save.data.stage);
    this.scene = g.newScene();
    this.clock = new Clock();
    this.map = getMap().create({ renderer: g.renderer, scene: this.scene });
    this.camCfg = this.map.cameras.battle;
    frameCamera(this.camera, this.camCfg);
    this.boardView = new BoardView(this.map.board);
    this.scene.add(this.boardView.group);
    this.fx = new FxSystem(this.scene);
    this.phase = 'deploy';
    this.t = 0;

    this.buildUI();
    this.overlay = new WorldOverlay(this.worldHost);
    this.battle = new BattleController({
      scene: this.scene,
      boardView: this.boardView,
      fx: this.fx,
      clock: this.clock,
      hooks: {
        onUnitAdded: (u) => this.overlay.addUnit(u),
        onUnitRemoved: (u) => this.overlay.removeUnit(u),
        onUnitChanged: (u) => this.refreshUnit(u),
        onDamage: (u, amt, crit) => this.overlay.pop(u.ch.anchorWorld('overhead'), this.camera, crit ? `${amt}!` : String(amt), `${u.team === 'player' ? 'hurt' : 'dmg'}${crit ? ' crit' : ''}`),
        onHeal: (u, amt) => amt > 0 && this.overlay.pop(u.ch.anchorWorld('overhead'), this.camera, `+${amt}`, 'heal'),
        onRound: (n, max) => this.showRound(n, max),
        onSkillCast: (u, s) => this.banner(s.name, s.color),
        onEnd: (res) => this.onEnd(res),
      },
    });
    this.battle.maxRounds = this.stage.maxRounds;

    this.hero = this.battle.addUnit('lyra', 'player', 2, 1);
    for (const [id, c, r] of this.stage.enemies) this.battle.addUnit(id, 'enemy', c, r, { statScale: this.stage.statScale });
    this.boardView.setMode('deploy');
    this.refreshAll();
  }

  // ---------------- UI ----------------
  buildUI() {
    const g = this.game;
    const lyraFace = g.portraits.get('lyra', { expression: 'neutral' });
    const impFace = g.portraits.get('shadeImp', { expression: 'neutral', yaw: -0.35 });
    this.worldHost = h('div', { class: 'world-host' });

    this.teamBars = {
      player: h('i', { class: 'fill' }),
      enemy: h('i', { class: 'fill' }),
    };
    this.roundEl = h('div', { class: 'round' }, `Stage ${this.stage.number}`);
    this.speedBtn = h('button', { class: 'btn-round small', onclick: () => this.toggleSpeed(), 'aria-label': 'Battle speed' }, h('b', {}, 'x1'));
    this.autoBtn = h('button', { class: 'btn-round small auto', onclick: () => this.toggleAuto(), 'aria-label': 'Auto skills' }, h('b', {}, 'Auto'));
    this.pauseBtn = h('button', { class: 'btn-round small', onclick: () => this.togglePause(), 'aria-label': 'Pause' }, icon(ICONS.pause));

    this.skillBtns = [];

    this.deployBar = h(
      'div',
      { class: 'deploy-bar' },
      h('div', { class: 'deploy-tip panel' }, h('b', {}, 'Formation'), ' Tap a blue tile to move Lyra. Ranged mages like the back rows.'),
      h('button', { class: 'btn btn-gold fight-btn', onclick: () => this.startFight() }, icon(ICONS.swords), 'Fight!')
    );

    this.skillDock = h('div', { class: 'skill-dock', hidden: true });
    this.heroCard = h(
      'div',
      { class: 'hero-card panel', hidden: true },
      h('img', { src: lyraFace, alt: '' }),
      h('div', { class: 'bars' }, h('div', { class: 'nm' }, 'Lyra'), h('div', { class: 'bar hp' }, (this.heroHp = h('i'))), h('div', { class: 'bar en' }, (this.heroEn = h('i'))), (this.heroBells = h('div', { class: 'bells' })))
    );

    this.ui = h(
      'div',
      { class: 'screen battle' },
      this.worldHost,
      h(
        'div',
        { class: 'vs-bar' },
        h('div', { class: 'team you' }, h('img', { src: lyraFace, alt: '' }), h('div', { class: 'tb' }, h('span', {}, 'You'), h('div', { class: 'bar' }, this.teamBars.player))),
        h('div', { class: 'vs' }, h('span', { class: 'vs-word' }, 'VS'), this.roundEl),
        h('div', { class: 'team foe' }, h('div', { class: 'tb' }, h('span', {}, 'Shade Legion'), h('div', { class: 'bar' }, this.teamBars.enemy)), h('img', { src: impFace, alt: '' }))
      ),
      h('button', { class: 'btn-round back', onclick: () => g.go('home'), 'aria-label': 'Leave battle' }, icon(ICONS.back)),
      h('div', { class: 'speed-ctrls' }, this.pauseBtn, this.speedBtn, this.autoBtn),
      this.deployBar,
      this.heroCard,
      this.skillDock,
      (this.roundBanner = h('div', { class: 'round-banner' })),
      (this.castBanner = h('div', { class: 'cast-banner' })),
      (this.pauseVeil = h('div', { class: 'pause-veil', hidden: true, onclick: () => this.togglePause() }, h('div', {}, 'Paused'), h('small', {}, 'Tap to resume')))
    );
    g.ui.append(this.ui);
  }

  buildSkillDock() {
    const hero = this.hero;
    this.skillDock.replaceChildren();
    this.skillBtns = hero.skills.active.map((s) => {
      const fill = h('i', { class: 'charge' });
      const btn = h(
        'button',
        { class: 'skill-btn', style: { '--c': s.color }, onclick: () => this.onSkill(s), title: s.description },
        fill,
        icon(ICONS[s.icon] || ICONS.orb),
        h('span', { class: 'cost' }, String(s.cost)),
        h('span', { class: 'nm' }, s.name)
      );
      return { s, btn, fill };
    });
    this.skillDock.append(...this.skillBtns.map((b) => b.btn));
  }

  onSkill(skill) {
    if (this.phase !== 'fight') return;
    this.battle.queueSkill(this.hero, skill);
    this.refreshUnit(this.hero);
  }

  refreshUnit(u) {
    this.overlay.refresh(u);
    if (u === this.hero) {
      this.heroHp.style.width = `${(u.hp / u.maxHp) * 100}%`;
      this.heroEn.style.width = `${(u.energy / u.maxEnergy) * 100}%`;
      const bells = (u.counters.bells || 0) % 3;
      this.heroBells.replaceChildren(...[0, 1, 2].map((i) => h('i', { class: i < bells ? 'on' : '' })));
      for (const b of this.skillBtns) {
        const ready = u.alive && u.energy >= b.s.cost;
        b.btn.classList.toggle('ready', ready);
        b.btn.classList.toggle('queued', u.queued === b.s);
        b.fill.style.height = `${Math.min(1, u.energy / b.s.cost) * 100}%`;
      }
    }
    this.refreshTeams();
  }

  refreshAll() {
    for (const u of this.battle.units) this.refreshUnit(u);
  }

  refreshTeams() {
    for (const team of ['player', 'enemy']) {
      const list = this.battle.units.filter((u) => u.team === team);
      const k = list.reduce((a, u) => a + u.hp, 0) / Math.max(1, list.reduce((a, u) => a + u.maxHp, 0));
      this.teamBars[team].style.width = `${k * 100}%`;
    }
  }

  showRound(n, max) {
    this.roundEl.textContent = `Round ${n}/${max}`;
    this.roundBanner.textContent = `Round ${n}`;
    this.roundBanner.classList.remove('show');
    void this.roundBanner.offsetWidth;
    this.roundBanner.classList.add('show');
  }

  banner(text, color) {
    this.castBanner.textContent = text;
    this.castBanner.style.setProperty('--c', color || '#c57cff');
    this.castBanner.classList.remove('show');
    void this.castBanner.offsetWidth;
    this.castBanner.classList.add('show');
  }

  toggleSpeed() {
    this.clock.scale = this.clock.scale > 1 ? 1 : 2;
    this.speedBtn.firstChild.textContent = `x${this.clock.scale}`;
    this.speedBtn.classList.toggle('active', this.clock.scale > 1);
  }

  toggleAuto() {
    this.battle.auto = !this.battle.auto;
    this.autoBtn.classList.toggle('active', this.battle.auto);
  }

  togglePause() {
    if (this.phase !== 'fight') return;
    this.clock.paused = !this.clock.paused;
    this.pauseVeil.hidden = !this.clock.paused;
    this.pauseBtn.replaceChildren(icon(this.clock.paused ? ICONS.play : ICONS.pause));
  }

  // ---------------- flow ----------------
  async startFight() {
    if (this.phase !== 'deploy') return;
    this.phase = 'fight';
    this.deployBar.hidden = true;
    this.heroCard.hidden = false;
    this.skillDock.hidden = false;
    this.buildSkillDock();
    this.boardView.setMode('battle');
    this.boardView.hover(null);
    this.hero.ch.setExpression('angry', 1.2);
    this.refreshAll();
    await this.battle.run();
  }

  onEnd(res) {
    this.phase = 'result';
    this.clock.scale = 1;
    const save = this.game.save;
    const gold = res.victory ? 300 + this.stage.number * 120 + res.stars * 50 : 60;
    const gems = res.victory ? 10 + res.stars * 5 : 0;
    const exp = res.victory ? 200 + this.stage.number * 40 : 40;
    const patch = { gold: save.data.gold + gold, gems: save.data.gems + gems };
    if (res.victory) {
      patch.wins = save.data.wins + 1;
      patch.stage = Math.max(save.data.stage, this.stage.number + 1);
      patch.bestStars = { ...save.data.bestStars, [this.stage.number]: Math.max(res.stars, save.data.bestStars[this.stage.number] || 0) };
    }
    save.set(patch);

    setTimeout(() => {
      if (this.phase !== 'result' || !this.ui.isConnected) return;
      this.heroCard.hidden = this.skillDock.hidden = true;
      const reward = (svg, n) => h('div', { class: 'reward' }, icon(svg), h('b', {}, fmt(n)));
      const panel = h(
        'div',
        { class: `result ${res.victory ? 'win' : 'lose'}` },
        h('div', { class: 'ribbon' }, res.victory ? 'Victory' : 'Defeat'),
        h('div', { class: 'stars' }, [0, 1, 2].map((i) => h('span', { class: 'st', style: { animationDelay: `${0.25 + i * 0.18}s` } }, icon(i < res.stars ? ICONS.star : ICONS.starEmpty)))),
        h('div', { class: 'sub' }, res.victory ? `Stage ${this.stage.number} cleared in ${res.rounds} rounds` : res.rounds >= this.stage.maxRounds ? 'Out of rounds. Fire skills sooner to end it faster.' : 'Lyra was knocked out. Try a back-row tile.'),
        h('div', { class: 'rewards panel' }, h('div', { class: 'eyebrow' }, 'Rewards'), h('div', { class: 'row' }, gems ? reward(ICONS.gem, gems) : null, reward(ICONS.coin, gold), reward(ICONS.exp, exp))),
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn btn-purple', onclick: () => this.game.go('battle', { stage: this.stage.number }) }, 'Retry'),
          res.victory ? h('button', { class: 'btn btn-gold', onclick: () => this.game.go('battle', { stage: this.stage.number + 1 }) }, 'Next Stage') : null,
          h('button', { class: 'btn btn-plain', onclick: () => this.game.go('home') }, 'Home')
        )
      );
      this.ui.append(panel);
    }, res.victory ? 1300 : 1600);
  }

  // ---------------- input ----------------
  onPointerMove(ndc) {
    if (this.phase !== 'deploy') return;
    const tile = this.boardView.pick(this.game.raycast(ndc, this.camera));
    this.boardView.hover(tile && tile.userData.player && !this.battle.board.at(tile.userData.c, tile.userData.r) ? tile : null);
  }

  onPointerDown(ndc) {
    if (this.phase !== 'deploy') return;
    const tile = this.boardView.pick(this.game.raycast(ndc, this.camera));
    if (tile?.userData.player) this.battle.reposition(this.hero, tile.userData.c, tile.userData.r);
  }

  // ---------------- frame ----------------
  update(realDt) {
    const dt = this.clock.tick(realDt);
    this.t += dt;
    this.battle.update(dt);
    this.fx.update(dt);
    this.map.update?.(dt, this.t);
    const c = this.camCfg;
    const sh = this.fx.shake;
    this.camera.position.set(c.pos[0] + (Math.random() - 0.5) * sh * 0.25, c.pos[1] + (Math.random() - 0.5) * sh * 0.2, c.pos[2]);
    this.camera.lookAt(...c.look);
  }

  afterRender() {
    this.overlay.update(this.camera);
  }

  async exit() {
    this.phase = 'gone';
    this.clock.reset();
    this.battle.dispose();
    this.fx.clear();
    this.boardView.dispose();
    this.map.dispose?.();
    this.overlay.dispose();
    this.ui.remove();
  }
}
