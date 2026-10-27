// 角色造型对比预览：上排旧造型、下排新造型（各 4 帧，放大），右侧为游戏内实际大小（草地背景 ×3）
// 用法：node tools/art-compare.mjs zhaoyun  → dist/art_compare.png
import { build } from 'esbuild';
import fs from 'node:fs';
import { encodePNG } from './png.mjs';
const out = 'dist/preview-entry.cjs';
await build({ entryPoints: ['tools/preview-entry.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error' });
const { collectPreview } = await import('../' + out + '?t=' + Date.now());
const id = process.argv[2] || 'zhaoyun';
const all = collectPreview();
const rows = [all.filter((x) => x.name.startsWith('hero_' + id)), all.filter((x) => x.name.startsWith('v2_' + id))];
const S = 8, G = 3, pad = 16;
const cellW = 40 * S, cellH = 36 * S;
const gameW = 4 * 44 * G + pad * 2;
const W = pad + 4 * (cellW + pad) + gameW, H = pad + rows.length * (cellH + pad);
const buf = new Uint8ClampedArray(W * H * 4);
const put = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = ((x >> 3) + (y >> 3)) & 1 ? 60 : 72; put(x, y, c, c + 8, c); }
const draw = (img, ox, oy, s) => {
  const rgba = img.toRGBA();
  for (let y = 0; y < img.h * s; y++) for (let x = 0; x < img.w * s; x++) {
    const si = ((y / s | 0) * img.w + (x / s | 0)) * 4; if (!rgba[si + 3]) continue; put(ox + x, oy + y, rgba[si], rgba[si + 1], rgba[si + 2]);
  }
};
rows.forEach((row, r) => {
  const oy = pad + r * (cellH + pad);
  row.forEach((it, i) => draw(it.img, pad + i * (cellW + pad), oy + (cellH - it.img.h * S), S));
  // 游戏内大小：草地背景
  const gx = pad + 4 * (cellW + pad);
  for (let y = oy; y < oy + cellH; y++) for (let x = gx; x < gx + gameW - pad; x++) put(x, y, 79, 140, 62);
  row.forEach((it, i) => draw(it.img, gx + pad + i * 44 * G, oy + cellH - it.img.h * G - 30, G));
});
fs.writeFileSync('dist/art_compare.png', encodePNG(W, H, buf));
console.log('dist/art_compare.png', W, H);
