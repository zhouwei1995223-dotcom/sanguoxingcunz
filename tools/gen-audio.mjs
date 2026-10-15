// 用代码合成全部音效与背景音乐，输出 mp3 到 assets/audio（微信 / 抖音包使用）。
// 合成器本身在 src/audio/synth.ts，小红书版在运行时直接调用它。
// 用法：node tools/gen-audio.mjs   （需要 ffmpeg）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const OUT = 'assets/audio';
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgaudio-'));
const mod = path.join(tmp, 'synth.mjs');
await build({ entryPoints: ['src/audio/synth.ts'], bundle: true, format: 'esm', platform: 'node', outfile: mod, logLevel: 'error' });
const { SR, synthSfx, synthTrack, SFX_NAMES, TRACK_NAMES } = await import(mod);

function writeWav(file, data) {
  const b = Buffer.alloc(44 + data.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data.length * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(data[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
}

function exportMp3(name, data, kbps) {
  const wav = path.join(tmp, name + '.wav');
  writeWav(wav, data);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', kbps + 'k', '-ac', '1', path.join(OUT, name + '.mp3')]);
}

for (const name of SFX_NAMES) exportMp3('sfx_' + name, synthSfx(name), 48);
for (const name of TRACK_NAMES) exportMp3(name, synthTrack(name), 64);
fs.rmSync(tmp, { recursive: true, force: true });
let total = 0;
for (const f of fs.readdirSync(OUT)) total += fs.statSync(path.join(OUT, f)).size;
console.log('audio files:', fs.readdirSync(OUT).length, 'total KB:', Math.round(total / 1024));
