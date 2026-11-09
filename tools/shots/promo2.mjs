import fs from 'node:fs';
import { clickId, startCampaign } from './_lib.mjs';
// 推广素材第二版（2026-11-09，1.0.8 之后）：十位武将全部五星觉醒（步战造型），拍新版水墨界面与各玩法。
// 用法：npm run build && SHOT_DIR=dist/promo2 Q='?skip=1&rich=1&heroes=1' node tools/shot.mjs promo2
// 输出：dist/promo2/*.png（截图）、dist/promo2/sprites/*.png（觉醒造型原尺寸像素图，合成脚本放大用）
// ONLY=home,battle,tianji,defense,tower 只拍其中几段
const ONLY = (process.env.ONLY || 'home,battle,tianji,defense,tower').split(',');
const OUT = process.env.SHOT_DIR || 'dist/promo2';
export const HERO_IDS = ['zhaoyun', 'guanyu', 'zhangfei', 'zhuge', 'lvbu', 'huangzhong', 'machao', 'sunshangxiang', 'dianwei', 'jiangwei'];

export default async function ({ page, wait, shot }) {
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await wait(600);
  // 全员五星觉醒、引导结束、不弹签到 / 备战提醒
  const setHero = (id) => page.evaluate((id) => {
    const s = window.__saveMod.save;
    for (const h of Object.values(s.heroes)) { h.owned = true; h.star = 5; h.awaken = true; h.lv = Math.max(h.lv || 1, 60); }
    s.hero = id; s.guide = 99; s.daily.prepNoRemind = true;
    // 截图里的数字像正常玩家（不显示「1.0亿」），章节推进到第 6 章
    s.gold = 128600; s.yuanbao = 3260; s.iron = 1480; s.stamina = 60; s.maxCleared = Math.max(s.maxCleared || 0, 5); s.selectedChapter = 6;
    const g = window.__game; g.dialogs.length = 0;
    const Home = g.scene.constructor.name === 'HomeScene' ? g.scene.constructor : null;
    if (Home) { const h = new Home(); h.autoPopped = true; g.setScene(h); }
  }, id);
  await setHero('zhaoyun');
  await wait(800);

  // 觉醒造型原图（站立待机第 4 帧、走路第 1 帧，朝右 / 朝左）
  fs.mkdirSync(OUT + '/sprites', { recursive: true });
  const sprites = await page.evaluate((ids) => {
    const out = {};
    const sp = window.__atlas.sprite;
    for (const id of [...ids, 'wuming']) for (const f of ['4', '1', '4_L', '1_L']) {
      const s = sp(`hero_${id}_awk_${f}`);
      const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
      c.getContext('2d').drawImage(s.canvas, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
      out[`${id}_${f}`] = c.toDataURL('image/png');
    }
    return out;
  }, HERO_IDS);
  for (const [k, v] of Object.entries(sprites)) fs.writeFileSync(`${OUT}/sprites/${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
  console.log('sprites', Object.keys(sprites).length);

  const home = async (mode, name, hero = 'zhaoyun') => {
    await page.evaluate((m) => { window.__saveMod.save.homeMode = m; }, mode);
    await setHero(hero);
    await wait(2200);
    await page.evaluate(() => { window.__game.dialogs.length = 0; });
    await wait(300);
    await shot(name);
  };
  if (ONLY.includes('home')) {
    await home('chapter', 'h_home_chapter');
    await home('tianji', 'h_home_tianji');
    // 武将页：五星觉醒
    await page.evaluate(() => { window.__game.scene.tab = 'hero'; });
    await wait(900); await shot('h_hero_tab');
    await page.evaluate(() => { window.__game.scene.tab = 'battle'; });
  }

  const clear = () => page.evaluate(() => { const g = window.__game; const sc = g.scene; const b = sc.battle; g.dialogs.length = 0; if (!b) return;
    // 截图时去掉横幅和新手提示（「精英敌军出现」「敌人即将出招」等），画面更干净
    if (sc.banners) sc.banners.length = 0; sc.tipText = null; sc.tipT = 0; if (sc.tipQueue) sc.tipQueue.length = 0; b.pendingLevelUps = 0; b.pendingChests.length = 0; if (b.pendingStrats) b.pendingStrats.length = 0; });
  const crowd = (n, r0, r1, ids) => page.evaluate(([n, r0, r1, ids]) => {
    const b = window.__game.scene.battle; const p = b.player;
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; const d = r0 + Math.random() * (r1 - r0); b.spawnEnemy(ids[i % ids.length], p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 1.6, { hpMul: 6 }); }
  }, [n, r0, r1, ids]);
  const WEI = ['wei_spear', 'wei_spear', 'wei_spear', 'wei_shield', 'wei_cavalry', 'wei_heavy', 'wei_archer'];
  const roam = async (n, ms = 450) => {
    for (let i = 0; i < n; i++) {
      await clear();
      const k = ['d', 's', 'a', 'w'][i % 4];
      await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k);
    }
  };
  const powerUp = (weapons) => page.evaluate((weapons) => {
    const b = window.__game.scene.battle;
    b.base.atk = 60; b.player.maxHp = b.player.hp = 99999; b.base.hp = 99999;
    weapons.forEach((id) => { if (!b.weapon(id)) b.addWeapon(id); });
    b.weapons.forEach((w) => (w.lv = 5));
    b.recalc();
  }, weapons);
  const ult = async (name) => {
    await page.evaluate(() => { const b = window.__game.scene.battle; b.rage = 100; b.rageLock = 0; });
    await clear(); await wait(150);
    await page.evaluate(() => window.__game.scene.pressUlt());
    await wait(450); await shot(name + '_cut');
    await wait(900); await shot(name + '_fx');
    await wait(1200);
  };
  const backHome = async () => {
    await page.evaluate(() => {
      const g = window.__game; g.dialogs.length = 0;
      // 用加载页留下的主界面类重新进主界面（不结算）
      const h = new window.__HomeCtor(); h.autoPopped = true; g.setScene(h); // 不弹签到
    });
    await page.waitForFunction(() => window.__game.scene.constructor.name === 'HomeScene');
    await wait(500);
  };
  await page.evaluate(() => { window.__HomeCtor = window.__game.scene.constructor; });

  if (ONLY.includes('battle')) {
    // 征战：几位名将轮流上阵，满屏割草 + 大招切入
    for (const [hero, weapons, enemies] of [
      ['zhaoyun', ['sword', 'horse', 'fire', 'crossbow'], WEI],
      ['guanyu', ['halberd', 'fire', 'aura', 'thunder'], WEI],
      ['sunshangxiang', ['chakram', 'knife', 'crossbow', 'rock'], ['wu_spear', 'wu_shield', 'wu_archer', 'wu_spear']],
      ['lvbu', ['ji', 'fire', 'thunder', 'drum'], ['xl_heavy', 'qiang_spear', 'qiang_club', 'elite_guard']],
    ]) {
      await backHome();
      await setHero(hero);
      await wait(500);
      await startCampaign(page);
      await wait(400);
      await powerUp(weapons);
      // 1:00 前后：中途敌将还没来（没有敌将血条和出招提示），等级 / 斩敌数像打了一阵
      await page.evaluate(() => { const b = window.__game.scene.battle; b.t = 55; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 50); b.level = 24; b.kills = 1260; });
      await roam(10);
      await page.evaluate(() => { const b = window.__game.scene.battle; b.level = 24; b.kills = Math.max(b.kills, 1260); });
      await crowd(120, 50, 170, enemies);
      await wait(1300);
      await clear(); await wait(100);
      await shot('b_' + hero + '_crowd');
      await crowd(90, 50, 160, enemies);
      await ult('b_' + hero + '_ult');
      if (hero === 'zhaoyun') {
        // 升级三选一（带进化）与锦囊
        await page.evaluate(() => {
          const g = window.__game; const s = g.scene; g.dialogs.length = 0;
          s.openLevelUpForTest([{ kind: 'weapon', id: 'sword', lv: 5, isNew: false }, { kind: 'weapon', id: 'thunder', lv: 1, isNew: true }, { kind: 'passive', id: 'book', lv: 1, isNew: true }]);
        });
        await wait(800); await shot('b_levelup');
        await page.evaluate(() => { const g = window.__game; g.dialogs.length = 0; g.scene.openStrategyForTest(2, 2); });
        await wait(1000); await shot('b_strat');
        await clear();
        // 敌将：推到中途敌将（章节时间 ×0.6，3:00 的敌将在 1:48 登场）
        await page.evaluate(() => { const b = window.__game.scene.battle; b.t = 100; b.eventIdx = b.chapter.events.findIndex((e) => e.t >= 98); });
        for (let i = 0; i < 16; i++) {
          const d = await page.evaluate(() => { const g = window.__game; return g.dialogs.length ? g.dialogs[g.dialogs.length - 1].constructor.name : ''; });
          if (d === 'BossIntroDialog') { await wait(900); await shot('b_boss_intro'); await wait(1600); await page.evaluate(() => { window.__game.dialogs.length = 0; }); continue; }
          if (d) await clear();
          const k = ['w', 'd', 's', 'a'][i % 4];
          await page.keyboard.down(k); await wait(500); await page.keyboard.up(k);
          if (i === 12) { await clear(); await shot('b_boss_fight'); }
        }
      }
    }
  }

  if (ONLY.includes('tianji')) {
    await backHome();
    await page.evaluate(() => { window.__saveMod.save.homeMode = 'tianji'; window.__saveMod.save.settings.tjSkipAnim = false; window.__saveMod.save.settings.tjAuto = false; });
    await wait(400);
    await clickId(page, 'tj_start');
    await wait(800);
    await page.waitForFunction(() => window.__game.scene.battle?.tj);
    await wait(1500);
    await page.evaluate(() => {
      const b = window.__game.scene.battle; b.player.maxHp = b.player.hp = 99999; b.base.hp = 99999; b.base.atk = 60;
      ['sword', 'thunder', 'crossbow', 'fire', 'chakram'].forEach((id) => { if (!b.weapon(id)) b.addWeapon(id); }); b.weapons.forEach((w) => (w.lv = 5)); b.recalc();
      b.t = 200;
    });
    await roam(8);
    await crowd(120, 40, 150, WEI);
    await wait(900); await clear();
    await shot('t_field');
    // 上上签揭晓：天命所归
    for (const [id, name] of [['destiny', 't_sign_top'], ['wuhu', 't_sign_wuhu'], ['allstar', 't_sign_allstar']]) {
      await page.evaluate((id) => { const b = window.__game.scene.battle; window.__game.dialogs.length = 0; b.tj.force = id; b.tj.tickets = Math.max(b.tj.tickets, 2); }, id);
      await page.evaluate(() => window.__game.scene.pressDraw());
      await wait(380); if (name === 't_sign_top') await shot('t_draw_shake');
      await wait(1500); await shot(name);
      await page.evaluate(() => { window.__game.dialogs.length = 0; });
      await wait(1200);
    }
    // 天命之主
    await page.evaluate(() => { const b = window.__game.scene.battle; window.__game.dialogs.length = 0; b.t = 508; });
    await page.waitForFunction(() => window.__game.scene.battle.tj.final, null, { timeout: 12000 });
    await page.evaluate(() => { const b = window.__game.scene.battle, e = b.tj.final; e.x = b.player.x + 60; e.y = b.player.y - 20; });
    await wait(3000); await clear(); await shot('t_final');
  }

  if (ONLY.includes('defense')) {
    await backHome();
    await setHero('guanyu');
    await page.evaluate(() => { window.__saveMod.save.homeMode = 'defense'; });
    await wait(600);
    await clickId(page, 'start_defense');
    await wait(300);
    if (await page.evaluate(() => window.__game.ui.prevRegions.some((r) => r.id === 'prep_rm_skip'))) await clickId(page, 'prep_rm_skip');
    await page.waitForFunction(() => window.__game.scene.battle?.def, null, { timeout: 8000 });
    await page.evaluate(() => { const b = window.__game.scene.battle; b.player.maxHp = b.player.hp = 99999; b.base.hp = 99999; b.t = 130; if (b.def) b.def.grain = 999; });
    for (let i = 0; i < 14; i++) {
      await page.evaluate(() => { const g = window.__game; const b = g.scene.battle; const d = g.dialogs[g.dialogs.length - 1]; if (d && d.choices && d.choices.length) { try { b.applyChoice ? b.applyChoice(d.choices[0]) : null; } catch (e) {} } g.dialogs.length = 0; b.pendingLevelUps = 0; });
      const k = ['a', 'd', 'w', 's'][i % 4];
      await page.keyboard.down(k); await wait(500); await page.keyboard.up(k);
    }
    await clear(); await wait(200);
    await shot('d_field');
  }

  if (ONLY.includes('tower')) {
    await backHome();
    await page.evaluate(() => { window.__saveMod.save.homeMode = 'tower'; });
    await wait(600);
    await shot('w_home');
    await clickId(page, 'td_start');
    await wait(1200);
    await shot('w_select');
  }
}
