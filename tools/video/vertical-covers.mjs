// npm run build && node tools/video/vertical-covers.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = 'docs/promo/竖版视频';
const icon = 'data:image/png;base64,' + fs.readFileSync('docs/icon/长坂单骑传_头像144.png').toString('base64');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  // 只在隔离的本地页面运行真实构建，避免读写试玩存档。
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'localhost') return route.abort();
    if (url.pathname === '/' || url.pathname === '/game.js') {
      return route.fulfill({path: 'dist/web/' + (url.pathname === '/' ? 'index.html' : 'game.js')});
    }
    return route.abort();
  });
  for (const [id, label] of [['zhaoyun','1_一骑当千'], ['guanyu','2_名将大招'], ['machao','3_敌将对决']]) {
    await page.goto('http://localhost/?skip=1&heroes=1&nohud=1');
    await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
    const jpg = await page.evaluate(async ({ id, icon }) => {
      const avatar = new Image();
      avatar.src = icon;
      await avatar.decode();
      const g = window.__game, save = window.__saveMod.save;
      save.hero = id;
      Object.assign(save.heroes[id], {owned:true, star:5, awaken:true});
      g.closeAll();
      g.scene.startBattle(1);
      await new Promise(resolve => {
        const ready = () => g.scene.battle ? resolve() : requestAnimationFrame(ready);
        requestAnimationFrame(ready);
      });
      g.closeAll();
      const scene = g.scene, b = scene.battle, p = b.player;
      // 固定测试场景，兵器、人物、敌军、预警和地形均由战斗渲染器绘制。
      let seed = 38171;
      const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      Math.random = random;
      p.x = 225; p.y = -180;
      b.showDamage = false;
      if (id === 'machao') {
        const boss = b.spawnBoss('wenchou', p.x + 26, p.y - 40, true);
        boss.bskills = ['cross']; boss.stateT = 0; boss.state = 'move';
      } else {
        const troops = ['wei_spear','wei_shield','wei_archer','wei_cavalry'];
        for (let i = 0; i < 56; i++) {
          const angle = i * 2.4, radius = 38 + random() * 110;
          b.spawnEnemy(troops[i % troops.length], p.x + Math.cos(angle)*radius,
            p.y + Math.sin(angle)*radius, { hpMul: 12 });
        }
        if (id === 'guanyu') { b.rage = 100; b.castUlt(); }
        else b.addWeapon('crossbow');
      }
      const steps = id === 'machao' ? 22 : id === 'guanyu' ? 6 : 29;
      for (let i = 0; i < steps; i++) b.update(1/60);
      // 静帧关闭闪白与无敌闪烁，让武将和敌将保持本色。
      p.iframe = 0; p.hurtFlash = 0;
      for (const enemy of b.enemies) enemy.flash = 0;
      const world = g.ctx.canvas;
      scene.renderer.render(b, 0, g.ctx);
      const c = document.createElement('canvas');
      c.width = 1080; c.height = 1920;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const width = id === 'zhaoyun' ? 612 : 540, height = width * 16/9;
      const cy = world.height/2 - (id === 'machao' ? 90 : 50);
      ctx.drawImage(world, (world.width-width)/2, cy-height/2, width, height, 0, 0, c.width, c.height);
      // 游戏头像与启动页同款墨字、描金和米色外缘组成统一标识。
      const y = 1560;
      const shade = ctx.createLinearGradient(0, 1290, 0, c.height);
      shade.addColorStop(0, 'rgba(22,18,18,0)'); shade.addColorStop(1, 'rgba(22,18,18,.78)');
      ctx.fillStyle = shade; ctx.fillRect(0, 1290, c.width, c.height-1290);
      ctx.drawImage(avatar, 80, y, 134, 134);
      ctx.font = 'bold 122px "Noto Serif SC", SimSun, serif';
      ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      for (const [line, color] of [[14,'#fdf6e4'],[7,'#e0bf7a'],[3,'#6a4a1c']]) {
        ctx.lineWidth = line; ctx.strokeStyle = color; ctx.strokeText('长坂单骑传', 246, y+72);
      }
      ctx.fillStyle = '#1e1612'; ctx.fillText('长坂单骑传', 246, y+72);
      for (const quality of [.96,.93,.90,.87,.84,.80]) {
        const data = c.toDataURL('image/jpeg', quality).split(',')[1];
        if (data.length * 3 / 4 < 500000) return data;
      }
      throw Error('封面超过 500 KB');
    }, { id, icon });
    fs.writeFileSync(path.join(out, '竖版视频封面'+label+'_1080x1920.jpg'), Buffer.from(jpg,'base64'));
  }
} finally {
  await browser.close();
}
