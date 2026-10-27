// Q 版造型效果图：node tools/concept.mjs → dist/concept.png（放大图 + 游戏内大小对比）
import { build } from 'esbuild';
import fs from 'node:fs';
import { encodePNG } from './png.mjs';
const out = 'dist/concept-entry.cjs';
await build({ entryPoints: ['tools/concept-entry.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error' });
const { concepts } = await import('../' + out + '?t=' + Date.now());
const c = concepts();
const S = 9, G = 3, pad = 30;
const big = [c.standing, c.mounted];
const gameW = [c.old, c.standing, c.mounted].reduce((a, im) => a + im.w * G + 10, 0) + 28;
const W = pad + big.reduce((a, im) => a + im.w * S + pad, 0) + gameW + pad;
const H = pad * 2 + Math.max(...big.map((im) => im.h * S));
const buf = new Uint8ClampedArray(W * H * 4);
const put = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, 238, 228, 205);
const draw = (img, ox, oy, s) => { const rgba = img.toRGBA(); for (let y = 0; y < img.h * s; y++) for (let x = 0; x < img.w * s; x++) { const si = ((y / s | 0) * img.w + (x / s | 0)) * 4; if (!rgba[si + 3]) continue; put(ox + x, oy + y, rgba[si], rgba[si + 1], rgba[si + 2]); } };
let x = pad;
for (const im of big) { draw(im, x, H - pad - im.h * S, S); x += im.w * S + pad; }
// 游戏内大小（草地，×3）：旧造型 / 步行 / 骑马
const gx = x, gy = pad;
for (let y = gy; y < H - pad; y++) for (let xx = gx; xx < W - pad / 2; xx++) put(xx, y, 79, 140, 62);
let px = gx + 14;
for (const im of [c.old, c.standing, c.mounted]) { draw(im, px, H - pad - 20 - im.h * G, G); px += im.w * G + 10; }
fs.writeFileSync('dist/concept.png', encodePNG(W, H, buf));
console.log('dist/concept.png', W, H);
