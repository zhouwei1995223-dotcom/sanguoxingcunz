// 导出封面用的精灵图到 dist/cover/*.png
import { build } from 'esbuild';
import fs from 'node:fs';
import { encodePNG } from '../png.mjs';
const out = 'dist/cover-entry.cjs';
await build({ entryPoints: ['tools/cover/entry.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error' });
const { sprites } = await import('../../' + out + '?t=' + Date.now());
fs.mkdirSync('dist/cover', { recursive: true });
for (const [k, img] of Object.entries(sprites())) fs.writeFileSync(`dist/cover/${k}.png`, encodePNG(img.w, img.h, img.toRGBA()));
console.log(Object.keys(sprites()).join(' '));
