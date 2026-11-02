import { registerSkill } from './registry.js';

// Placeholder enemy attacks.
function melee(id, name, mult, color) {
  registerSkill({
    id,
    owner: 'enemy',
    kind: 'basic',
    name,
    cost: 0,
    icon: 'claw',
    color,
    targets: 'single',
    description: `Melee strike for ${Math.round(mult * 100)}% ATK.`,
    async cast(ctx) {
      const { caster, targets, fx } = ctx;
      const target = targets[0];
      ctx.face(caster, target);
      await caster.ch.playUntil('attack', 'release');
      const p = target.ch.anchorWorld('chest');
      fx.burst(p, { color, count: 10, size: 0.2, speed: 1.8 });
      fx.flash(p, { color, size: 0.8 });
      ctx.damage(target, mult);
      await ctx.wait(0.35);
    },
  });
}
melee('common.claw', 'Shadow Claw', 1.0, '#9b7bff');
melee('common.slam', 'Brute Slam', 1.0, '#ff6a8a');
