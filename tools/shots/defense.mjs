// 守城模式：开局、召唤、军令卡、波次、敌将；自动选卡和召唤，看一局能不能跑完
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
  await wait(300);
  await shot('def_home');
  // 测试存档（战力卡在这一关的推荐战力上）：
  //   prof=bare  只有武将等级 / 星级（没装备、没军略）
  //   prof=built 装备 + 军略按进度点好，剩下的用武将等级补齐
  //   strong=1   老写法：赵云 60 级五星巅峰 20
  const info = await page.evaluate(() => {
    const g = window.__game; const sv = window.__saveMod.save; const ops = window.__opsMod;
    const q = location.search;
    const m = q.match(/lv=(\d+)/); const lv = m ? +m[1] : 1;
    const pm = q.match(/prof=(\w+)/); const prof = pm ? pm[1] : '';
    const CH = [400, 1500, 2800, 4800, 8000, 12000, 18000, 27000, 40000, 58000];
    const target = Math.round(CH[lv - 1] * 1.1 / 100) * 100;
    if (q.includes('strong=1')) {
      Object.assign(sv.heroes.zhaoyun, { lv: 60, star: 5, peak: 20 });
      for (const id of ['lvbu', 'guanyu']) Object.assign(sv.heroes[id], { owned: true, lv: 50, star: 5 });
    } else if (prof) {
      const star = Math.min(5, 1 + Math.floor(lv / 2));
      if (prof === 'built') {
        const ql = Math.min(4, Math.floor((lv + 1) / 2));
        const tids = { weapon: 'yajiao', helm: 'yinshi', armor: 'longlin', boots: 'tayun', mount: 'yeshizi', jade: 'yupei' };
        sv.items = []; sv.equipped = {};
        let uid = 9000;
        for (const [slot, tid] of Object.entries(tids)) { const it = { uid: uid++, tid, q: ql, lv: 1 }; sv.items.push(it); sv.equipped[slot] = it.uid; }
        const tl = Math.round(lv * 1.3);
        sv.talents = { t_atk: Math.min(20, tl), t_hp: Math.min(20, tl), t_potion: Math.min(10, lv), t_def: Math.min(15, lv), t_speed: Math.min(10, lv), t_pickup: Math.min(10, lv), t_exp: Math.min(15, lv), t_gold: Math.min(15, lv), t_crit: Math.min(10, Math.floor(lv * 0.8)), t_cd: Math.min(10, Math.floor(lv * 0.8)), t_regen: Math.min(10, Math.floor(lv * 0.6)), t_reroll: Math.min(3, Math.floor(lv / 3)), t_revive: lv >= 6 ? 1 : 0 };
      }
      // 武将等级二分到刚好够推荐战力
      let lo = 1, hi = 120;
      // 养成到位的存档：装备等级 = 武将等级的一半（一起涨）
      const setLv = (L) => { Object.assign(sv.heroes.zhaoyun, { lv: L, star }); for (const it of sv.items || []) if (it.uid >= 9000) it.lv = Math.max(1, Math.round(L / 2)); };
      while (lo < hi) { const mid = (lo + hi) >> 1; setLv(mid); if (ops.combatPower(ops.computeStats('zhaoyun')) >= target) hi = mid; else lo = mid + 1; }
      setLv(lo);
      for (const id of ['lvbu', 'guanyu']) Object.assign(sv.heroes[id], { owned: lv >= 2, lv: Math.max(1, Math.round(lo * 0.8)), star: Math.max(1, star - 1) });
    }
    sv.hero = 'zhaoyun';
    sv.stamina = 99;
    const power = ops.combatPower(ops.computeStats('zhaoyun'));
    g.scene.startBattle(-3, lv);
    return { lv, prof, target, power, heroLv: sv.heroes.zhaoyun.lv, star: sv.heroes.zhaoyun.star, itemLv: (sv.items || []).find((x) => x.uid >= 9000)?.lv };
  });
  console.log('PROFILE ' + JSON.stringify(info));
  await wait(800);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
  await wait(1500);
  await shot('def_start');
  const log = [];
  const N = (process.env.Q || "").includes("full=1") ? 1300 : 260;
  for (let i = 0; i < N; i++) {
    const s = await page.evaluate(() => {
      const g = window.__game; const sc = g.scene; const b = sc.battle; const d = b.def;
      if (!d) return { err: 'no def' };
      // 自动选升级（优先推荐）和召唤
      if (g.dialogs.length) {
        const dl = g.dialogs[g.dialogs.length - 1];
        if (dl.choices && dl.scene) { const k = b.recommend(dl.choices); const c = dl.choices[Math.max(0, k)]; (window.__picks = window.__picks || []).push(c.kind + ':' + (c.id || '')); dl.scene.choose(c); g.dialogs.length = 0; }
        else g.dialogs.length = 0;
      }
      const kinds = ['xbow', 'cav', 'archer', 'shield', 'spear'];
      for (const k of kinds) { const c = { spear: 40, shield: 50, archer: 55, cav: 70, xbow: 90 }[k]; if (d.grain >= c + 20) { const m = window.__defMod; } }
      return { t: Math.round(b.t), city: Math.round(d.cityHp), max: d.cityMax, grain: Math.round(d.grain), allies: d.allies.filter((a) => !a.dead).length, wave: d.waveIdx, lv: b.level, orders: JSON.stringify(d.orders), links: [...d.links].join(','), dmg: JSON.stringify(Object.fromEntries(Object.entries(d.dmgBy).map(([k, v]) => [k, Math.round(v)]))), builds: d.builds.map((x) => x.kind[0] + x.lv).join(''), picks: (window.__picks = window.__picks || []).slice(-6).join(','), weapon: b.weapons.map((w) => w.id + (w.evo ? '★' : w.lv)).join(''), lvl: b.chapter.id, hp: Math.round(b.chapter.hpMul * 100) / 100, won: b.won, dead: b.dead, down: d.downT > 0, enemies: b.enemies.filter((e) => !e.dead).length };
    });
    if (s.err) { log.push(s); break; }
    if (i % 80 === 0) log.push(s);
    // 第三轮起不用点按钮：自动出兵，兵种 / 建筑 / 武将 / 修城都在升级三选一里（上面按推荐自动选）
    await page.evaluate(() => { const b = window.__game.scene.battle; b.player.hp = Math.max(b.player.hp, 1); });
    // 像玩家一样守在城边：离城太远就往回走，否则绕城巡逻、追最近的敌人
    await page.evaluate((i) => {
      const b = window.__game.scene.battle; const p = b.player; const K = (window.__keys = window.__keys || {});
      for (const k of ['w', 'a', 's', 'd']) K[k] = false;
      let tx, ty;
      const dist = Math.hypot(p.x, p.y);
      let near = null, nd = 1e9;
      for (const e of b.enemies) { if (e.dead) continue; const dd = Math.hypot(e.x, e.y); if (dd < nd) { nd = dd; near = e; } }
      if (dist > 170) { tx = 0; ty = 0; }
      else if (near && nd < 200) { tx = near.x; ty = near.y; }
      else { const a = i * 0.3; tx = Math.cos(a) * 100; ty = Math.sin(a) * 100; }
      const dx = tx - p.x, dy = ty - p.y;
      if (dx > 8) K.d = true; if (dx < -8) K.a = true; if (dy > 8) K.s = true; if (dy < -8) K.w = true;
    }, i);
    await wait(250);
    if (i === 40) await shot('def_mid');
    if (s.won || s.dead) { log.push(s); break; }
  }
  await shot('def_end');
  console.log(log.map((x) => JSON.stringify(x)).join('\n'));
}
