// 仅使用首页的营地与题字绘制 3:4 封面。node tools/cover/xhs-home.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const { chromium } = createRequire(import.meta.url)('playwright');
const bundle = await build({
  stdin: { resolveDir: process.cwd(), contents: `
    import { buildAtlas } from './src/gfx/atlas';
    import { HomeCamp } from './src/scenes/homeCamp';
    import { drawGameTitle } from './src/scenes/homeArt';
    import { loadSave, save } from './src/meta/save';
    window.renderCover = () => {
      loadSave();
      save.hero = 'zhaoyun';
      for (const hero of Object.values(save.heroes)) hero.owned = true;
      const c = document.createElement('canvas');
      c.width = 1080; c.height = 1440;
      const g = c.getContext('2d');
      buildAtlas();
      const camp = new HomeCamp();
      camp.draw(g, 1/30, c.width, c.height, 1120, 5, false);
      drawGameTitle(g, c.width, 243, 2.2, true);
      return c.toDataURL('image/jpeg', .94).split(',')[1];
    };` },
  bundle: true, write: false, format: 'iife', define: { 'process.env.TARGET': '"xhs"' },
});
const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || undefined});
try {
  const page = await browser.newPage({viewport:{width:540,height:720}, deviceScaleFactor:2});
  await page.route('http://localhost/', r => r.fulfill({contentType:'text/html',body:'<body></body>'}));
  await page.goto('http://localhost/');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const jpg = await page.evaluate(() => window.renderCover());
  fs.writeFileSync('docs/promo/1.1.0/小红书封面-主界面.jpg', Buffer.from(jpg,'base64'));
} finally { await browser.close(); }
