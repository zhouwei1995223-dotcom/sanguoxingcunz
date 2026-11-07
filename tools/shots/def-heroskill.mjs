import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// 守城召唤武将放技能的动画：Q='?skip=1&heroes=1' node tools/shot.mjs def-heroskill
// HEROES="guanyu,zhangfei" 可只测部分武将。
export default async function({ page }) {
  const out = path.resolve(process.env.SHOT_DIR || 'dist/shots');
  fs.mkdirSync(out, { recursive: true });
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__game.closeAll(); window.__game.scene.startBattle(-3, 1); });
  await page.waitForFunction(() => window.__game.scene.battle?.def);
  await page.waitForTimeout(800);
  const ids = (process.env.HEROES || 'zhaoyun,guanyu,zhangfei,zhuge,lvbu,huangzhong,machao,sunshangxiang,dianwei,jiangwei').split(',');
  for (const id of ids) {
    const fx = await page.evaluate(id => {
      const g = window.__game; g.closeAll();
      const b = g.scene.battle, d = b.def;
      // 清掉在场武将，保证能召唤；出征武将换成别人，避免与召唤对象相同
      d.allies = d.allies.filter(a => a.kind !== 'hero');
      d.heroCd = {};
      if (b.hero.id === id) return -1;
      if (!d.heroes[id]) return -2;
      b.applyChoice({ kind: 'hero', id });
      const a = d.allies.find(x => x.kind === 'hero' && x.heroId === id);
      a.skillT = 0;
      const before = b.fx.length;
      b.update(1 / 60);
      return b.fx.length - before;
    }, id);
    if (fx < 0) { console.log(id, 'skip', fx); continue; }
    assert.ok(fx >= 6, `${id} 放技能应有动画（新增特效 ${fx} 个）`);
    for (const [k, ms] of [[0, 120], [1, 260]]) {
      await page.waitForTimeout(ms);
      await page.evaluate(() => window.__game.closeAll());
      await page.screenshot({ path: path.join(out, `heroskill-${id}-${k}.png`) });
    }
    console.log(id, 'fx', fx);
  }
}
