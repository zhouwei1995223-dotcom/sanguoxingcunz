// 头像第三版素材导出（2026-11-09）：营地美术（帅帐、火把、枪兵、兵器架、粮草）和赵云觉醒造型原尺寸像素图 → dist/promo2/sprites/
// 用法：npm run build && node tools/shots/avatar3.mjs；再 python3 tools/promo/avatar3.py
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve('dist/web');
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript' }[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const OUT = 'dist/promo2/sprites';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`http://localhost:${server.address().port}/index.html?skip=1`);
await page.waitForFunction(() => window.__atlas && window.__atlas.sprite, null, { timeout: 30000 });
const names = ['camp_tent', 'camp_torch', 'camp_rack', 'camp_supplies', 'camp_stake', 'u_shu_spear_0', 'u_shu_spear_0_L',
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((f) => `hero_zhaoyun_awk_${f}`), ...[4, 5, 6, 7].map((f) => `hero_zhaoyun_awk_${f}_L`)];
const out = await page.evaluate((names) => {
  const r = {};
  for (const n of names) {
    const s = window.__atlas.sprite(n);
    const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
    c.getContext('2d').drawImage(s.canvas, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
    r[n] = { png: c.toDataURL('image/png'), ax: s.ax, ay: s.ay };
  }
  return r;
}, names);
const anchors = {};
for (const [k, v] of Object.entries(out)) { fs.writeFileSync(`${OUT}/${k}.png`, Buffer.from(v.png.split(',')[1], 'base64')); anchors[k] = [v.ax, v.ay]; }
fs.writeFileSync(`${OUT}/anchors.json`, JSON.stringify(anchors, null, 1));
console.log(anchors);
await browser.close();
server.close();
