import * as THREE from 'three';
import { Board } from './Board.js';
import { Character } from '../characters/Character.js';
import { getUnit } from '../characters/registry.js';
import { skillsFor } from '../skills/registry.js';
import { rand } from '../core/math.js';

let uidSeq = 1;
const _v = new THREE.Vector3();

/**
 * Turn-based auto-battle. Each round every living unit acts once, fastest first:
 * cast a queued/auto skill, otherwise walk toward the nearest foe and basic-attack
 * when in range. Players steer the fight by firing hero skills when energy allows.
 */
export class BattleController {
  constructor({ scene, boardView, fx, clock, hooks = {} }) {
    this.scene = scene;
    this.view = boardView;
    this.board = new Board({ cols: boardView.cols, rows: boardView.rows });
    this.fx = fx;
    this.clock = clock;
    this.hooks = hooks;
    this.units = [];
    this.round = 0;
    this.maxRounds = 15;
    this.auto = false;
    this.running = false;
    this.over = false;
    this.unitScale = 1.3; // chibis read better a bit larger than one tile on the battle camera
  }

  // ---------------- setup ----------------
  addUnit(id, team, c, r, { statScale = 1 } = {}) {
    const def = getUnit(id);
    const ch = new Character(def);
    const s = def.stats;
    const unit = {
      uid: uidSeq++,
      def,
      ch,
      team,
      maxHp: Math.round(s.hp * statScale),
      hp: Math.round(s.hp * statScale),
      atk: Math.round(s.atk * statScale),
      defense: Math.round(s.def * statScale),
      spd: s.spd,
      range: s.range,
      move: s.move,
      energy: 0,
      maxEnergy: 100,
      alive: true,
      queued: null,
      counters: {},
      skills: skillsFor(def),
    };
    ch.root.scale.setScalar(this.unitScale);
    this.scene.add(ch.root);
    this.board.place(unit, c, r);
    ch.root.position.copy(this.view.tileCenter(c, r));
    ch.faceTowards(this.restYaw(team), { instant: true });
    this.units.push(unit);
    this.hooks.onUnitAdded?.(unit);
    return unit;
  }

  removeUnit(unit) {
    this.board.remove(unit);
    unit.ch.dispose();
    this.units = this.units.filter((u) => u !== unit);
    this.hooks.onUnitRemoved?.(unit);
  }

  /** Move a unit during formation (player side only). */
  reposition(unit, c, r) {
    if (this.board.at(c, r) || !this.board.isPlayerSide(c)) return false;
    this.board.place(unit, c, r);
    const target = this.view.tileCenter(c, r);
    const from = unit.ch.root.position.clone();
    unit.ch.play('walk');
    unit.ch.faceTowards(Math.atan2(target.x - from.x, target.z - from.z));
    this.clock.tween(0.35, (k) => unit.ch.root.position.lerpVectors(from, target, k)).then(() => {
      unit.ch.play('idle');
      unit.ch.faceTowards(this.restYaw(unit.team));
      unit.ch.setExpression('happy', 0.8);
    });
    return true;
  }

  restYaw(team) {
    // face the other side, turned a little toward the camera so faces stay readable
    return team === 'player' ? Math.atan2(1, 0.95) : Math.atan2(-1, 0.95);
  }

  side(team) {
    return this.units.filter((u) => u.team === team && u.alive);
  }

  enemiesOf(unit) {
    return this.side(unit.team === 'player' ? 'enemy' : 'player');
  }

  enemyCenter(team = 'enemy') {
    const list = this.side(team);
    const c = new THREE.Vector3();
    list.forEach((u) => c.add(u.ch.root.position));
    return list.length ? c.divideScalar(list.length) : c;
  }

  // ---------------- player input ----------------
  queueSkill(unit, skill) {
    if (!unit.alive || unit.energy < skill.cost) return false;
    unit.queued = unit.queued === skill ? null : skill;
    this.hooks.onUnitChanged?.(unit);
    return true;
  }

  // ---------------- main loop ----------------
  async run() {
    this.running = true;
    for (this.round = 1; this.round <= this.maxRounds && !this.over; this.round++) {
      this.hooks.onRound?.(this.round, this.maxRounds);
      await this.wait(0.55);
      const order = this.units
        .filter((u) => u.alive)
        .map((u) => ({ u, k: u.spd + rand(0, 6) + (u.team === 'player' ? 0.5 : 0) }))
        .sort((a, b) => b.k - a.k)
        .map((o) => o.u);
      for (const unit of order) {
        if (this.over) break;
        if (!unit.alive) continue;
        await this.takeTurn(unit);
        this.checkEnd();
        await this.wait(0.12);
      }
    }
    if (!this.over) this.finish(false);
    return this.result;
  }

  checkEnd() {
    if (this.over) return;
    if (!this.side('enemy').length) this.finish(true);
    else if (!this.side('player').length) this.finish(false);
  }

  finish(victory) {
    this.over = true;
    const heroes = this.units.filter((u) => u.team === 'player');
    const hpFrac = heroes.reduce((a, u) => a + u.hp, 0) / Math.max(1, heroes.reduce((a, u) => a + u.maxHp, 0));
    const stars = victory ? (hpFrac > 0.6 ? 3 : hpFrac > 0.3 ? 2 : 1) : 0;
    this.result = { victory, stars, rounds: Math.min(this.round, this.maxRounds) };
    for (const u of this.units) {
      if (!u.alive) continue;
      const won = (u.team === 'player') === victory;
      if (won) {
        u.ch.play(u.ch.animator.has('victory') ? 'victory' : 'idle');
        u.ch.faceTowards(0);
      } else u.ch.setExpression('sad', 0);
    }
    this.hooks.onEnd?.(this.result);
  }

  async takeTurn(unit) {
    this.hooks.onTurn?.(unit);
    const { basic, active } = unit.skills;

    let skill = null;
    if (unit.queued && unit.energy >= unit.queued.cost) skill = unit.queued;
    else if (this.auto && unit.team === 'player') skill = this.autoPick(unit, active);
    if (skill) {
      unit.queued = null;
      unit.energy -= skill.cost;
      this.hooks.onUnitChanged?.(unit);
      this.hooks.onSkillCast?.(unit, skill);
      await skill.cast(this.skillContext(unit, []));
      return;
    }

    let target = this.pickTarget(unit);
    if (!target) return;
    if (Board.dist(unit, target) > unit.range) {
      const path = this.board.path(unit, target, unit.move, unit.range);
      if (path.length) await this.walk(unit, path);
      target = this.pickTarget(unit);
    }
    if (target && Board.dist(unit, target) <= unit.range && basic) {
      await basic.cast(this.skillContext(unit, [target]));
      this.gainEnergy(unit, 20);
      unit.skills.passive?.onBasicAttack?.(this.skillContext(unit, []));
    }
    unit.ch.faceTowards(this.restYaw(unit.team));
  }

  autoPick(unit, actives) {
    const foes = this.enemiesOf(unit).length;
    const affordable = actives.filter((s) => unit.energy >= s.cost);
    if (!affordable.length) return null;
    const big = affordable.find((s) => s.targets === 'all');
    if (big && foes >= 2) return big;
    if (foes >= 3 && actives.some((s) => s.targets === 'all' && s.cost > unit.energy) && unit.energy < 100) {
      // save up for the big one when the field is crowded
      return unit.energy >= 50 && Math.random() < 0.35 ? affordable[0] : null;
    }
    return affordable.find((s) => s.targets !== 'all') || affordable[0];
  }

  pickTarget(unit) {
    const foes = this.enemiesOf(unit);
    if (!foes.length) return null;
    foes.sort((a, b) => Board.dist(unit, a) - Board.dist(unit, b) || a.hp - b.hp);
    return foes[0];
  }

  async walk(unit, path) {
    const last = path[path.length - 1];
    this.board.place(unit, last.c, last.r);
    unit.ch.play('walk');
    for (const step of path) {
      const from = unit.ch.root.position.clone();
      const to = this.view.tileCenter(step.c, step.r);
      unit.ch.faceTowards(Math.atan2(to.x - from.x, to.z - from.z));
      await this.clock.tween(0.36, (k) => unit.ch.root.position.lerpVectors(from, to, k), (t) => t);
    }
    unit.ch.play('idle');
  }

  // ---------------- skill context ----------------
  skillContext(caster, targets) {
    return {
      battle: this,
      caster,
      targets,
      fx: this.fx,
      clock: this.clock,
      wait: (s) => this.wait(s),
      damage: (target, mult) => this.damage(caster, target, mult),
      heal: (unit, amount) => this.heal(unit, amount),
      gainEnergy: (unit, n) => this.gainEnergy(unit, n),
      enemiesOf: (u) => this.enemiesOf(u),
      face: (u, target) => {
        _v.copy(target.ch.root.position).sub(u.ch.root.position);
        u.ch.faceTowards(Math.atan2(_v.x, _v.z + _v.length() * 0.6));
      },
    };
  }

  damage(src, target, mult) {
    if (!target.alive) return 0;
    const crit = Math.random() < 0.12;
    let amt = src.atk * mult * (100 / (100 + target.defense)) * rand(0.92, 1.08) * (crit ? 1.5 : 1);
    amt = Math.max(1, Math.round(amt));
    target.hp = Math.max(0, target.hp - amt);
    this.hooks.onDamage?.(target, amt, crit);
    if (target.team === 'player') this.gainEnergy(target, 8);
    if (target.hp <= 0) this.kill(target);
    else target.ch.play('hit', { fade: 0.05 });
    this.hooks.onUnitChanged?.(target);
    return amt;
  }

  heal(unit, amount) {
    if (!unit.alive) return;
    const before = unit.hp;
    unit.hp = Math.min(unit.maxHp, unit.hp + amount);
    this.hooks.onHeal?.(unit, unit.hp - before);
    this.hooks.onUnitChanged?.(unit);
  }

  gainEnergy(unit, n) {
    unit.energy = Math.min(unit.maxEnergy, unit.energy + n);
    this.hooks.onUnitChanged?.(unit);
  }

  kill(unit) {
    unit.alive = false;
    unit.ch.alive = false;
    unit.queued = null;
    this.board.remove(unit);
    unit.ch.play('die', { fade: 0.05 });
    this.hooks.onDeath?.(unit);
    // fade + sink after the fall
    this.wait(1.5).then(() => {
      const mats = new Set();
      unit.ch.root.traverse((o) => {
        if (o.isMesh) [].concat(o.material).forEach((m) => mats.add(m));
      });
      mats.forEach((m) => {
        m.transparent = true;
        m.depthWrite = false;
      });
      const y0 = unit.ch.root.position.y;
      this.fx.burst(unit.ch.anchorWorld('chest'), { color: '#b9a6ff', count: 10, tex: 'glow', size: 0.3, speed: 0.8, up: 2, gravity: 1 });
      return this.clock.tween(0.6, (k) => {
        mats.forEach((m) => (m.opacity = 1 - k));
        unit.ch.root.position.y = y0 - k * 0.25;
      });
    }).then(() => {
      unit.ch.root.visible = false;
    });
  }

  wait(s) {
    return this.clock.wait(s);
  }

  update(dt) {
    for (const u of this.units) u.ch.update(dt);
  }

  dispose() {
    this.over = true;
    for (const u of this.units) u.ch.dispose();
    this.units = [];
  }
}
