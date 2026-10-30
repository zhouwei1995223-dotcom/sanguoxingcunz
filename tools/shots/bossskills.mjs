// 敌将新技能（扇形横扫 / 箭雨 / 十字刀气 / 震地）的预警画面，以及护盾、狂暴
export default async function ({ page, wait, shot, tap }) {
  await wait(2600);
  await page.evaluate(() => { window.__game.dialogs.length = 0; });
  await wait(300);
  await tap(195, 722); // 出征
  await wait(1500);
  await page.evaluate(() => {
    const g = window.__game;
    g.dialogs.length = 0;
    const b = g.scene.battle;
    b.player.maxHp = b.player.hp = 99999;
    b.base.hp = 99999;
    for (const e of b.enemies) e.dead = true;
    const e = b.spawnBoss('wenchou', b.player.x + 70, b.player.y - 10, true);
    e.maxHp = e.hp = 1e9;
    window.__boss = e;
    g.dialogs.length = 0;
  });
  const cast = async (skill, name, delay) => {
    await page.evaluate((s) => {
      const b = window.__game.scene.battle, e = window.__boss;
      window.__game.dialogs.length = 0;
      b.warnings.length = 0;
      e.x = b.player.x + 70; e.y = b.player.y - 10;
      e.bskills = [s]; e.skillIdx = 0; e.state = 'move'; e.stateT = 0;
    }, skill);
    await wait(delay);
    await shot('bskill_' + name);
  };
  await cast('fan', 'fan', 500);
  await wait(800);
  await shot('bskill_fan_hit');
  await cast('rain', 'rain', 600);
  await cast('cross', 'cross', 600);
  await wait(500);
  await shot('bskill_cross_hit');
  await cast('nova', 'nova', 700);
  // 护盾
  await page.evaluate(() => {
    const b = window.__game.scene.battle, e = window.__boss;
    b.warnings.length = 0;
    e.bskills = ['charge']; e.maxHp = 1e6; e.hp = 5.5e5;
  });
  await wait(900);
  await shot('bskill_shield');
  // 狂暴
  await page.evaluate(() => { window.__boss.shieldT = 0.05; });
  await wait(900);
  await shot('bskill_enrage');
  const st = await page.evaluate(() => { const e = window.__boss; return { enraged: e.enraged, shield: e.shield, dmgTaken: Math.round(window.__game.scene.battle.statDmgTaken) }; });
  console.log(JSON.stringify(st));
}
