// 新武将实战巡检：每位进第 1 章，兵器升满、放一次大招，各截两帧。
// HEROES="caocao zhenji" Q='?skip=1' node tools/shot.mjs newhero-battle   （EVO=1 兵器直接进化）
export default async function ({ page, wait, shot, errors }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await wait(400);
  const all = 'liubei weiyan caocao xiahoudun zhangliao xuchu simayi xiahouyuan zhenji sunce zhouyu ganning taishici luxun xiaoqiao diaochan dongzhuo zhangjiao huatuo zuoci';
  const heroes = (process.env.HEROES || all).split(' ');
  const snap = !process.env.NOSHOT;
  for (const h of heroes) {
    const before = errors.length;
    await page.evaluate((h) => {
      const g = window.__game, sv = window.__saveMod.save; g.dialogs.length = 0;
      sv.heroes[h].owned = true; sv.heroes[h].star = 5; sv.hero = h; sv.stamina = 99; sv.guide = 99;
      for (const k of ['boss_warn', 'breakable', 'elite', 'evo', 'lowpower', 'pk_bomb', 'pk_bun', 'pk_magnet', 'strat', 'banish', 'qiyu', 'rush', 'chest', 'gem', 'magnet', 'potion', 'ult']) sv.tips[k] = true;
      g.scene.startBattle(1, 0, 5);
    }, h);
    await page.waitForFunction(() => window.__game.scene.battle, null, { timeout: 8000 });
    await wait(500);
    await page.evaluate((evo) => {
      const g = window.__game; g.dialogs.length = 0; const b = g.scene.battle; if (g.scene.banners) g.scene.banners.length = 0;
      b.base.atk = 30; b.player.maxHp = b.player.hp = 99999;
      const w = b.weapons[0]; w.lv = 5; if (evo) w.evo = true; w.t = 0; b.recalc();
      const ids = ['wei_spear', 'wei_shield', 'wei_cavalry'];
      for (let i = 0; i < 110; i++) { const a = Math.random() * 6.28, d = 40 + Math.random() * 150; b.spawnEnemy(ids[i % 3], b.player.x + Math.cos(a) * d, b.player.y + Math.sin(a) * d * 1.5, { hpMul: 60 }); }
    }, !!process.env.EVO);
    await wait(700);
    await page.evaluate(() => { window.__game.dialogs.length = 0; });
    if (snap) await shot('nh_' + h + '_w');
    await page.evaluate(() => { const g = window.__game, b = g.scene.battle; g.dialogs.length = 0; b.rage = 100; b.rageLock = 0; b.castUlt(); });
    await wait(450);
    if (snap) await shot('nh_' + h + '_u1');
    await wait(900);
    if (snap) await shot('nh_' + h + '_u2');
    await wait(2600);
    const st = await page.evaluate(() => { const b = window.__game.scene.battle; return { kills: b.kills, ult: !!b.ult, hp: Math.round(b.player.hp), dead: b.dead }; });
    console.log(h, JSON.stringify(st), errors.length > before ? 'ERRORS ' + errors.slice(before).join(' | ') : 'ok');
    await page.goto(page.url());
    await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
    await wait(300);
  }
}
