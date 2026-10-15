// 离线整理预览素材：需要可选开发工具 sharp；数据保存在 docs，不参与正式构建。
// node tools/import-guanyu-art.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const input = 'docs/art/guanyu-trot-sheet.png';
const size = 96, baseline = 94, targetHeight = 88;
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const cw = info.width / 2, ch = info.height / 2;
const boxes = [0, 1, 2, 3].map((i) => {
  const ox = i % 2 * cw, oy = Math.floor(i / 2) * ch;
  let x0 = cw, y0 = ch, x1 = 0, y1 = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    if (data[((oy + y) * info.width + ox + x) * 4 + 3] < 128) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { left: ox + x0, top: oy + y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
});
const scale = targetHeight / Math.max(...boxes.map((b) => b.height));
const palette = new Map(), colors = {};
const encode = (r, g, b) => {
  // 轻量颜色归并，保留色阶，控制嵌入数据大小。
  const hex = '#' + [r, g, b].map((v) => Math.min(255, Math.round(v / 12) * 12).toString(16).padStart(2, '0')).join('');
  if (!palette.has(hex)) { const c = String.fromCharCode(0x100 + palette.size); palette.set(hex, c); colors[c] = hex; }
  return palette.get(hex);
};
const rows = [], skinRows = [];
fs.mkdirSync('dist/guanyu-art', { recursive: true });
for (let f = 0; f < 4; f++) {
  const box = boxes[f], w = Math.round(box.width * scale), h = Math.round(box.height * scale);
  const rgba = await sharp(input).extract(box).resize(w, h, { kernel: 'nearest' }).ensureAlpha().raw().toBuffer();
  const frame = Array.from({ length: size }, () => Array(size).fill('.'));
  const skin = frame.map((row) => row.slice());
  const ox = Math.floor((size - w) / 2), oy = baseline - h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4;
    if (rgba[p + 3] < 128) continue;
    const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    frame[oy + y][ox + x] = encode(r, g, b);
    let sr = r, sg = g, sb = b;
    // 保留旧皮肤的深色战袍 / 红马方向；脸与胡须保留原色。
    if (g > r * 1.15 && g > b * 1.15) { sr *= 0.45; sg *= 0.48; sb *= 0.65; }
    else if (oy + y > 44 && r > g * 1.25 && r > b * 1.5) { sr = Math.min(255, r * 1.15); sg *= 0.8; sb *= 0.8; }
    skin[oy + y][ox + x] = encode(sr, sg, sb);
  }
  rows.push(frame.map((r) => r.join('')));
  skinRows.push(skin.map((r) => r.join('')));
  await sharp(input).extract(box).resize(w, h, { kernel: 'nearest' }).extend({ top: oy, bottom: size - oy - h, left: ox, right: size - ox - w, background: '#00000000' }).png().toFile(`dist/guanyu-art/frame-${f}.png`);
}
fs.writeFileSync('docs/art/guanyu-preview-data.ts', '// 由 tools/import-guanyu-art.mjs 导入；图片来源和提示词见 docs/art/guanyu.md。\n'
  + 'export const GUANYU_COLORS: Record<string, string> = ' + JSON.stringify(colors) + ';\n'
  + 'export const GUANYU_ROWS = ' + JSON.stringify(rows) + ';\n'
  + 'export const GUANYU_SKIN_ROWS = ' + JSON.stringify(skinRows) + ';\n');
console.log(JSON.stringify({ boxes, colors: palette.size, frameSize: size, fileBytes: fs.statSync('docs/art/guanyu-preview-data.ts').size }));
