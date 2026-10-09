// 用法：node tools/preview.mjs [过滤关键字] —— 把所有像素图拼成一张放大预览图
import { build } from 'esbuild';
import fs from 'node:fs';
import { encodePNG } from './png.mjs';
const out = 'dist/preview-entry.cjs';
await build({ entryPoints: ['tools/preview-entry.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error' });
const { collectPreview } = await import('../' + out + '?t=' + Date.now());
const filter = process.argv[2] || '';
const items = collectPreview().filter((it) => it.name.includes(filter));
const S = Number(process.argv[3] || 4), pad = 4, maxW = 1400;
let x = pad, y = pad, rowH = 0; const pos = [];
for (const it of items) {
  const w = it.img.w * S, h = it.img.h * S;
  if (x + w + pad > maxW) { x = pad; y += rowH + pad; rowH = 0; }
  pos.push([x, y]); x += w + pad; rowH = Math.max(rowH, h);
}
const W = maxW, H = y + rowH + pad;
const buf = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) { const c = ((i % W >> 3) + ((i / W | 0) >> 3)) & 1 ? 70 : 90; buf[i*4]=c; buf[i*4+1]=c+10; buf[i*4+2]=c; buf[i*4+3]=255; }
items.forEach((it, n) => {
  const rgba = it.img.toRGBA(); const [ox, oy] = pos[n];
  for (let yy = 0; yy < it.img.h * S; yy++) for (let xx = 0; xx < it.img.w * S; xx++) {
    const si = ((yy / S | 0) * it.img.w + (xx / S | 0)) * 4; const a = rgba[si + 3] / 255; if (!a) continue;
    const di = ((oy + yy) * W + ox + xx) * 4;
    for (let k = 0; k < 3; k++) buf[di + k] = rgba[si + k] * a + buf[di + k] * (1 - a);
  }
});
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/preview.png', encodePNG(W, H, buf));
console.log('items', items.length, '->', 'dist/preview.png', W, H);
