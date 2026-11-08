// 局外养成能把无名剑客加强多少：白板 / 军略满 / 史诗30级装备+半军略 / 无双70级装备+满军略
export default async function ({ page }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene' && window.__opsMod);
  const r = await page.evaluate(async () => {
    const S = window.__saveMod.save, ops = window.__opsMod, meta = await import('/game.js').catch(() => null);
    void meta;
    const EQUIPS = window.__equips;
    return { ok: !!EQUIPS };
  });
  void r;
  const out = await page.evaluate((process_carry) => {
    const S = window.__saveMod.save, ops = window.__opsMod;
    const keep = JSON.stringify({ items: S.items, equipped: S.equipped, talents: S.talents });
    const talentMax = { t_dmg: 20, t_hp: 20, t_potion: 10, t_def: 15, t_speed: 10, t_pickup: 10, t_exp: 15, t_gold: 15, t_crit: 10, t_cd: 10, t_regen: 10, t_reroll: 3, t_revive: 1 };
    const profile = (q, lv, talentK) => {
      S.items = []; S.equipped = {};
      if (q >= 0) for (const slot of ['weapon', 'helm', 'armor', 'boots', 'mount', 'jade']) {
        const tpls = window.__equipList.filter((e) => e.slot === slot);
        let best = null, bestP = -1;
        for (const t of tpls) { const it = { uid: 'x' + slot + t.id, tid: t.id, q, lv }; S.items.push(it); S.equipped[slot] = it.uid; const p = ops.combatPower(ops.computeStats('wuming')); if (p > bestP) { bestP = p; best = it; } }
        S.equipped[slot] = best.uid;
      }
      S.talents = {};
      for (const t of window.__talentList) S.talents[t.id] = Math.round(t.max * talentK);
      const st = ops.computeStats('wuming', process_carry ? ops.TIANJI_CARRY : undefined);
      return { atk: st.atk, hp: st.hp, dmg: st.dmg, crit: st.crit, critDmg: st.critDmg, def: st.def, cd: st.cd, speed: st.speed, regen: +st.regen.toFixed(1), power: ops.combatPower(st) };
    };
    const res = { bare: profile(-1, 0, 0), talentsFull: profile(-1, 0, 1), epic30_halfTalent: profile(3, 30, 0.5), legend50_fullTalent: profile(4, 50, 1), max: profile(window.__maxQ, window.__maxLv, 1) };
    const k = JSON.parse(keep); S.items = k.items; S.equipped = k.equipped; S.talents = k.talents;
    return res;
  }, !!process.env.CARRY);
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(20), JSON.stringify(v));
}
