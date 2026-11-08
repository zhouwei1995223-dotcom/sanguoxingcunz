import { HERO_BY_ID } from '../data/heroes';
import { WEAPONS, skillPoolFor, weaponLink, fitPreparation, coreWeaponFits, WEAPON_SLOTS, SkillId, WeaponId, PassiveId } from '../data/skills';
import { save, markDirty, flushSave, preparationPresetsFor, selectedPreparationStage } from './save';

// 备战「推荐设置」：一键给当前武将配好一套能进化的方案（2026-11-08 用户要求）。
// 思路：专属兵器做核心 → 该武将有专属联动的兵器优先 → 常用强势兵器补满；
// 兵法先放所选兵器的进化搭档（保证能进化），再补通用好兵法。守城没有兵法，只排兵器。

const GOOD_WEAPONS: WeaponId[] = ['crossbow', 'thunder', 'aura', 'fire', 'sword', 'horse', 'rock', 'caltrop', 'knife', 'catapult', 'drum', 'hook', 'warshield'];
const GOOD_PASSIVES: PassiveId[] = ['tiger', 'book', 'lingzhi', 'armor', 'wine', 'flag', 'seal', 'horseshoe', 'pouch', 'bowl', 'map', 'whetstone'];

export function recommendPreparation(heroId: string): { skills: SkillId[]; core: WeaponId | null } {
  const hero = HERO_BY_ID[heroId];
  const stage = selectedPreparationStage();
  const pool = skillPoolFor(hero, save.maxCleared, stage.chapter, stage.defense);
  const full = skillPoolFor(hero, Infinity, null, false);
  const links = pool.weapons.filter((id) => id !== hero.weapon && weaponLink(id, hero.id));
  const rest = [...GOOD_WEAPONS, ...pool.weapons].filter((id) => pool.weapons.includes(id) && id !== hero.weapon && !links.includes(id));
  const weapons = [...new Set<WeaponId>([hero.weapon, ...links, ...rest])].slice(0, WEAPON_SLOTS);
  const list: SkillId[] = [];
  for (const w of weapons) {
    list.push(w);
    const evo = WEAPONS[w].evoPassive;
    if (!stage.defense && pool.passives.includes(evo) && !list.includes(evo)) list.push(evo);
  }
  if (!stage.defense) for (const p of GOOD_PASSIVES) if (pool.passives.includes(p) && !list.includes(p)) list.push(p);
  const skills = fitPreparation(list, full, [hero.weapon]);
  const core = coreWeaponFits(hero.weapon, pool, stage.defense) ? hero.weapon : links.find((id) => coreWeaponFits(id, pool, stage.defense)) ?? null;
  return { skills, core };
}

/** 把推荐方案写进第 slot 个预设并启用；返回填了几项 */
export function applyRecommendedPreparation(heroId: string, slot?: number): number {
  const rec = recommendPreparation(heroId);
  const stored = preparationPresetsFor(heroId);
  const i = slot ?? stored.active;
  stored.slots[i] = rec.skills;
  stored.coreWeapons[i] = rec.core;
  stored.active = i;
  (save.preparationPresets ??= {})[heroId] = stored;
  markDirty();
  flushSave(true);
  return rec.skills.length;
}
