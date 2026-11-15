// 临时构建首页封面，仅供取景。node tools/cover/xhs-home.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const { chromium } = createRequire(import.meta.url)('playwright');
const bundle = await build({
  entryPoints: ['src/main.ts'], bundle: true, write: false, format: 'iife', keepNames: true,
  define: { 'process.env.TARGET': '"xhs"' },
  plugins: [{
    name: 'home-cover',
    setup(builder) {
      builder.onLoad({ filter: /[\\/]homeScene\.ts$/ }, ({path}) => {
        const source = fs.readFileSync(path, 'utf8');
        const calls = /^    drawSide\((?:side|sideR),[^\n]+$/gm;
        if (source.match(calls)?.length !== 2) throw Error('请核对首页左右侧栏的绘制入口');
        return {contents: source.replace(calls, ''), loader: 'ts'};
      });
    },
  }],
});
const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || undefined});
try {
  const page = await browser.newPage({viewport:{width:540,height:720}, deviceScaleFactor:2});
  await page.route('http://localhost/**', route => {
    const js = new URL(route.request().url()).pathname === '/game.js';
    return route.fulfill({ contentType: js ? 'application/javascript' : 'text/html;charset=utf-8',
      body: js ? bundle.outputFiles[0].text : '<html><body style="margin:0"><script src="/game.js"></script></body></html>' });
  });
  await page.goto('http://localhost/?skip=1&heroes=1&nohud=1');
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'HomeScene');
  await page.evaluate(() => {
    const g = window.__game, s = window.__saveMod.save;
    s.hero = 'zhaoyun'; s.homeMode = 'chapter';
    // 竖封面比手机短，用实际画布高度约束界面字号，给营地留足空间。
    g.ui.u = Math.min(g.ui.u, g.ui.H / 1700);
    g.ui.safeTop = 0; // 导出的 JPG 没有小红书客户端的顶部菜单。
    g.closeAll(); g.scene.autoPopped = true;
  });
  await page.waitForTimeout(750);
  const data = await page.evaluate(() => {
    const g = window.__game, canvas = g.ctx.canvas;
    if (canvas.width !== 1080 || canvas.height !== 1440 || g.dialogs.length ||
      g.ui.prevRegions.some(r => r.id === 'side_signin' || r.id === 'side_settings')) throw Error('封面取景异常');
    return canvas.toDataURL('image/jpeg', .94).split(',')[1];
  });
  fs.writeFileSync('docs/promo/1.1.0/小红书封面-主界面.jpg', Buffer.from(data,'base64'));
} finally { await browser.close(); }
