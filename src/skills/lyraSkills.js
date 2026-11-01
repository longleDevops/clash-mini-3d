import * as THREE from 'three';
import { registerSkill } from './registry.js';

// Lyra, Spirit Sorceress — kit
//  Basic   Spirit Orb       arcane orb from the staff gem, 100% ATK.
//  Active  Foxfire Volley   (50 energy) three foxfire wisps seek up to three enemies, 110% ATK each.
//  Active  Moonlit Starfall (100 energy) a crescent moon rains stars on every enemy, 150% ATK.
//  Passive Spirit Bells     every 3rd basic attack rings her bells: heal 6% max HP, +15 energy.

const ARCANE = '#c57cff';
const FOX = '#ff6eb4';

registerSkill({
  id: 'lyra.spiritOrb',
  owner: 'lyra',
  kind: 'basic',
  name: 'Spirit Orb',
  cost: 0,
  icon: 'orb',
  color: ARCANE,
  targets: 'single',
  description: 'Fires an arcane orb from the staff gem at one enemy for 100% ATK.',
  async cast(ctx) {
    const { caster, targets, fx } = ctx;
    const target = targets[0];
    ctx.face(caster, target);
    await caster.ch.playUntil('attack', 'release');
    const from = caster.ch.anchorWorld('staffGem');
    fx.flash(from, { color: ARCANE, size: 0.6 });
    const hit = await fx.projectile({ from, to: () => target.ch.anchorWorld('chest'), color: ARCANE, size: 0.32, speed: 9, arc: 0.3 });
    fx.burst(hit, { color: ARCANE, count: 12 });
    fx.flash(hit, { color: '#ffffff', size: 0.7 });
    ctx.damage(target, 1.0);
    await ctx.wait(0.3);
  },
});

registerSkill({
  id: 'lyra.foxfireVolley',
  owner: 'lyra',
  kind: 'active',
  name: 'Foxfire Volley',
  cost: 50,
  icon: 'foxfire',
  color: FOX,
  targets: 'multi',
  description: 'Summons three foxfire wisps that seek up to three enemies for 110% ATK each.',
  async cast(ctx) {
    const { caster, fx } = ctx;
    const foes = ctx.enemiesOf(caster).sort((a, b) => a.hp - b.hp);
    if (!foes.length) return;
    ctx.face(caster, foes[0]);
    const wisps = fx.orbitWisps(() => caster.ch.anchorWorld('feet'), { count: 3, color: FOX });
    await caster.ch.playUntil('skill', 'release');
    const starts = wisps.positions();
    wisps.release();
    const shots = starts.map((from, i) => {
      const target = foes[i % foes.length];
      return ctx.wait(i * 0.09).then(() =>
        fx.projectile({ from, to: () => target.ch.anchorWorld('chest'), color: FOX, size: 0.42, speed: 7, arc: 0.8, tex: 'flame' }).then((hit) => {
          fx.burst(hit, { color: FOX, count: 14, size: 0.26 });
          fx.ring(target.ch.root.position, { color: FOX, radius: 0.7 });
          if (target.alive) ctx.damage(target, 1.1);
        })
      );
    });
    await Promise.all(shots);
    await ctx.wait(0.35);
  },
});

registerSkill({
  id: 'lyra.moonlitStarfall',
  owner: 'lyra',
  kind: 'active',
  name: 'Moonlit Starfall',
  cost: 100,
  icon: 'starfall',
  color: '#ffd45c',
  targets: 'all',
  description: 'Raises a crescent moon over the arena that rains stars on every enemy for 150% ATK.',
  async cast(ctx) {
    const { caster, fx, battle } = ctx;
    const foes = ctx.enemiesOf(caster);
    if (!foes.length) return;
    ctx.face(caster, foes[0]);
    caster.ch.setExpression('happy', 2.2);
    const center = battle.enemyCenter().add(new THREE.Vector3(0, 2.2, -0.4));
    const dismiss = fx.crescentMoon(center, { size: 0.85 });
    await caster.ch.playUntil('skill', 'release');
    const falls = foes.map((target, i) =>
      fx.fallingStar(target.ch.root.position.clone().add(new THREE.Vector3(0, 0.4, 0)), { delay: i * 0.12 }).then(() => {
        const p = target.ch.anchorWorld('chest');
        fx.burst(p, { color: '#ffd45c', count: 16, size: 0.28, speed: 2.8 });
        fx.ring(target.ch.root.position, { color: '#ffd45c', radius: 1.0 });
        fx.shake = Math.max(fx.shake, 0.35);
        if (target.alive) ctx.damage(target, 1.5);
      })
    );
    await Promise.all(falls);
    await ctx.wait(0.35);
    dismiss();
    await ctx.wait(0.2);
  },
});

registerSkill({
  id: 'lyra.spiritBells',
  owner: 'lyra',
  kind: 'passive',
  name: 'Spirit Bells',
  cost: 0,
  icon: 'bells',
  color: '#ffd45c',
  targets: 'self',
  description: 'Every third basic attack rings her charm bells: heals 6% max HP and grants 15 energy.',
  onBasicAttack(ctx) {
    const { caster, fx } = ctx;
    caster.counters.bells = (caster.counters.bells || 0) + 1;
    if (caster.counters.bells % 3 !== 0) return false;
    fx.chime(caster.ch.anchorWorld('overhead').add(new THREE.Vector3(0, -0.45, 0)));
    fx.heal(caster.ch.anchorWorld('chest'));
    ctx.heal(caster, Math.round(caster.maxHp * 0.06));
    ctx.gainEnergy(caster, 15);
    caster.ch.setExpression('wink', 0.9);
    return true;
  },
});
