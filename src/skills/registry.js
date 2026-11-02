/**
 * Skill registry. A skill is data + an async cast(ctx):
 * {
 *   id, owner, kind: 'basic' | 'active' | 'passive', name, cost (energy), icon, color,
 *   description, targets: 'single' | 'multi' | 'all' | 'self',
 *   async cast(ctx)            // ctx: see BattleController.skillContext()
 *   onBasicAttack?(ctx)        // passive hook, after each basic attack
 * }
 */
const skills = new Map();

export function registerSkill(def) {
  skills.set(def.id, def);
  return def;
}

export function getSkill(id) {
  return id ? skills.get(id) || null : null;
}

export function skillsFor(unitDef) {
  const s = unitDef.skills || {};
  return {
    basic: getSkill(s.basic),
    active: (s.active || []).map(getSkill).filter(Boolean),
    passive: getSkill(s.passive),
  };
}
