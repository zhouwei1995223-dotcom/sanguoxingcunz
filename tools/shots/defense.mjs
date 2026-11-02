// 守城模式：开局、召唤、军令卡、波次、敌将；自动选卡和召唤，看一局能不能跑完
export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(400);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
  await wait(300);
  await shot('def_home');
  // ?strong=1：模拟养成很深的老玩家（赵云 60 级五星巅峰 20、吕布关羽可召唤）
  await page.evaluate(() => {
    const g = window.__game; const sv = window.__saveMod.save;
    if (location.search.includes('strong=1')) {
      Object.assign(sv.heroes.zhaoyun, { lv: 60, star: 5, peak: 20 });
      for (const id of ['lvbu', 'guanyu']) Object.assign(sv.heroes[id], { owned: true, lv: 50, star: 5 });
    }
    const m = location.search.match(/lv=(\d+)/);
    sv.stamina = 99;
    g.scene.startBattle(-3, m ? +m[1] : 1);
  });
  await wait(800);
  await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; });
  await wait(1500);
  await shot('def_start');
  const log = [];
  for (let i = 0; i < 260; i++) {
    const s = await page.evaluate(() => {
      const g = window.__game; const sc = g.scene; const b = sc.battle; const d = b.def;
      if (!d) return { err: 'no def' };
      // 自动选升级（优先推荐）和召唤
      if (g.dialogs.length) {
        const dl = g.dialogs[g.dialogs.length - 1];
        if (dl.choices && dl.scene) { const k = b.recommend(dl.choices); dl.scene.choose(dl.choices[Math.max(0, k)]); g.dialogs.length = 0; }
        else if (dl.constructor.name === 'HeroSummonDialog') { const r = g.ui.prevRegions.find((x) => x.id.startsWith('hsum_') && x.id !== 'hsum_close'); if (r) g.ui.clickedId = r.id; else g.dialogs.length = 0; }
        else g.dialogs.length = 0;
      }
      const kinds = ['xbow', 'cav', 'archer', 'shield', 'spear'];
      for (const k of kinds) { const c = { spear: 40, shield: 50, archer: 55, cav: 70, xbow: 90 }[k]; if (d.grain >= c + 20) { const m = window.__defMod; } }
      return { t: Math.round(b.t), city: Math.round(d.cityHp), max: d.cityMax, grain: Math.round(d.grain), allies: d.allies.filter((a) => !a.dead).length, wave: d.waveIdx, lv: b.level, orders: JSON.stringify(d.orders), links: [...d.links].join(','), dmg: JSON.stringify(Object.fromEntries(Object.entries(d.dmgBy).map(([k, v]) => [k, Math.round(v)]))), lvl: b.chapter.id, hp: Math.round(b.chapter.hpMul * 100) / 100, won: b.won, dead: b.dead, down: d.downT > 0, enemies: b.enemies.filter((e) => !e.dead).length };
    });
    if (s.err) { log.push(s); break; }
    if (i % 20 === 0) log.push(s);
    // 点召唤按钮（右侧那一列）
    await page.evaluate(() => {
      const g = window.__game; const b = g.scene.battle; const d = b.def;
      if (Math.random() < 0.5) return;
      if (d.cityHp < d.cityMax * 0.6 && d.repairCd <= 0 && d.grain >= 60) { g.ui.clickedId = 'def_repair'; return; }
      if (d.grain >= 120 && Math.random() < 0.3 && g.ui.prevRegions.find((x) => x.id === 'def_hero')) { g.ui.clickedId = 'def_hero'; return; }
      const btns = ['def_xbow', 'def_cav', 'def_archer', 'def_shield', 'def_spear'];
      for (const id of btns) { const r = g.ui.prevRegions.find((x) => x.id === id); if (r) { g.ui.clickedId = id; break; } }
      if (d.allies.filter((a) => !a.dead && a.kind === 'hero').length === 0 && d.grain > 130) {
        const ids = Object.keys(d.heroes).filter((id) => id !== b.hero.id);
        void ids;
      }
      b.player.hp = Math.max(b.player.hp, 1);
    });
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
