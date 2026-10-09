// 自动化试玩截图：node tools/shot.mjs <脚本名>
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist/web');
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(p);
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.mp3': 'audio/mpeg' }[ext] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
const out = process.env.SHOT_DIR || 'dist/shots';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const query = process.env.Q || '';
await page.goto(`http://localhost:${port}/index.html${query}`);
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const tap = async (x, y) => { await page.mouse.click(x, y); await wait(150); };
const drag = async (x, y, dx, dy, ms) => {
  await page.mouse.move(x, y); await page.mouse.down();
  const steps = Math.max(2, Math.round(ms / 50));
  for (let i = 1; i <= steps; i++) { await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps); await wait(50); }
  await page.mouse.up();
};
const ctx = { page, wait, shot, tap, drag, errors };
const scriptName = process.argv[2] || 'basic';
const mod = await import('./shots/' + scriptName + '.mjs');
try { await mod.default(ctx); } catch (e) { console.log('SCRIPT ERROR', e); }
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close();
server.close();
