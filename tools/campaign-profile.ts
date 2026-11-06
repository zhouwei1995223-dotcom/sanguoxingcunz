import { HERO, EQUIPS, QUALITY_MAX_LV, SLOTS, TALENTS } from '../src/data/meta';
import { MAX_STAR, PEAK_MAX } from '../src/data/heroes';
import { save } from '../src/meta/save';
import { combatPower, computeStats } from '../src/meta/ops';

/** 在测试进程内组装真实配装，按面板公式挑最接近目标战力的一套。 */
export function campaignProfile(hero: string, target: number, cleared: number) {
  save.hero = hero;
  save.maxCleared = cleared;
  const state = save.heroes[hero];
  state.owned = true;
  let best = computeStats();
  let gap = Math.abs(combatPower(best) - target);
  const pieces = SLOTS.map(slot => EQUIPS.filter(e => e.slot === slot));
  // 高战力档按满养成的 64 种配装比对。中低档同时扫装备、武将和军略养成梯度。
  const steps = target >= 78000 ? [100] : Array.from({ length: 41 }, (_, i) => i * 2.5);
  for (const step of steps) {
    const t = step / 100;
    const quality = Math.min(5, Math.floor(t * 6));
    const lv = Math.max(1, Math.round(QUALITY_MAX_LV[quality] * t));
    state.lv = 1 + Math.round(t * (HERO.maxLevel - 1));
    state.star = Math.max(1, Math.ceil(t * MAX_STAR));
    state.awaken = state.star === MAX_STAR;
    state.peak = state.awaken ? Math.round(Math.max(0, t - 0.8) * 5 * PEAK_MAX) : 0;
    for (const talent of TALENTS) save.talents[talent.id] = cleared >= talent.unlockChapter ? Math.round(t * talent.max) : 0;
    save.items = EQUIPS.map((e, i) => ({ uid: i + 1, tid: e.id, q: quality, lv }));
    for (let mask = 0; mask < 2 ** SLOTS.length; mask++) {
      SLOTS.forEach((slot, j) => {
        const piece = pieces[j][(mask >> j) & 1];
        save.equipped[slot] = save.items.find(item => item.tid === piece.id)!.uid;
      });
      // 初期尚未集齐六个部位，避免 500～1000 战力只能找到裸装或整套装备。
      const minimumSlots = step <= 15 ? 0 : SLOTS.length;
      for (let equipped = SLOTS.length; equipped >= minimumSlots; equipped--) {
        if (equipped < SLOTS.length) save.equipped[SLOTS[equipped]] = 0;
        const stats = computeStats();
        const distance = Math.abs(combatPower(stats) - target);
        if (distance < gap) { gap = distance; best = stats; }
      }
    }
  }
  return best;
}
