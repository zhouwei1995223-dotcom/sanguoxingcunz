// 用代码合成全部音效与背景音乐（五声音阶的古风芯片音乐），输出 mp3 到 assets/audio。
// 用法：node tools/gen-audio.mjs   （需要 ffmpeg）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const SR = 22050;
const OUT = 'assets/audio';
fs.mkdirSync(OUT, { recursive: true });

// —— 基础合成 ——
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const noteFreq = (n) => 440 * Math.pow(2, (n - 69) / 12);
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));

function osc(type, phase) {
  const p = phase - Math.floor(phase);
  switch (type) {
    case 'sine': return Math.sin(p * 2 * Math.PI);
    case 'square': return p < 0.5 ? 1 : -1;
    case 'pulse': return p < 0.25 ? 1 : -1;
    case 'tri': return 1 - 4 * Math.abs(p - 0.5);
    case 'saw': return 2 * p - 1;
    case 'noise': return rnd() * 2 - 1;
  }
  return 0;
}

/** 在 out 上叠加一个音：频率可随时间变化（f0→f1），ADSR 包络 */
function tone(out, t0, dur, { type = 'square', f0 = 440, f1, vol = 0.3, a = 0.005, d = 0.05, s = 0.6, r = 0.08, vib = 0, vibRate = 5 }) {
  const start = Math.floor(t0 * SR);
  const len = Math.floor((dur + r) * SR);
  let phase = 0;
  for (let i = 0; i < len && start + i < out.length; i++) {
    const t = i / SR;
    const k = Math.min(1, t / dur);
    let f = f1 !== undefined ? f0 * Math.pow(f1 / f0, k) : f0;
    if (vib) f *= 1 + vib * Math.sin(2 * Math.PI * vibRate * t);
    phase += f / SR;
    let env;
    if (t < a) env = t / a;
    else if (t < a + d) env = 1 - (1 - s) * ((t - a) / d);
    else if (t < dur) env = s;
    else env = s * (1 - (t - dur) / r);
    out[start + i] += osc(type, phase) * env * vol;
  }
}

/** Karplus-Strong 拨弦（古筝 / 琵琶音色） */
function pluck(out, t0, freq, vol = 0.35, decay = 0.996, len = 1.6) {
  const N = Math.max(2, Math.round(SR / freq));
  const ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = rnd() * 2 - 1;
  const start = Math.floor(t0 * SR);
  let idx = 0;
  const total = Math.floor(len * SR);
  for (let i = 0; i < total && start + i < out.length; i++) {
    const v = ring[idx];
    const nxt = ring[(idx + 1) % N];
    ring[idx] = (v + nxt) * 0.5 * decay;
    out[start + i] += v * vol * Math.min(1, i / 30);
    idx = (idx + 1) % N;
  }
}

function kick(out, t0, vol = 0.8) { tone(out, t0, 0.18, { type: 'sine', f0: 140, f1: 40, vol, a: 0.001, d: 0.1, s: 0.3, r: 0.06 }); }
function taiko(out, t0, vol = 0.9) {
  tone(out, t0, 0.35, { type: 'sine', f0: 95, f1: 45, vol, a: 0.002, d: 0.25, s: 0.2, r: 0.15 });
  tone(out, t0, 0.04, { type: 'noise', vol: vol * 0.35, a: 0.001, d: 0.03, s: 0.1, r: 0.03 });
}
function snare(out, t0, vol = 0.35) { tone(out, t0, 0.1, { type: 'noise', vol, a: 0.001, d: 0.06, s: 0.2, r: 0.05 }); tone(out, t0, 0.05, { type: 'tri', f0: 220, f1: 160, vol: vol * 0.6, a: 0.001, s: 0.4, r: 0.03 }); }
function hat(out, t0, vol = 0.1) { tone(out, t0, 0.02, { type: 'noise', vol, a: 0.001, d: 0.015, s: 0.1, r: 0.02 }); }
function gong(out, t0, vol = 0.4) {
  for (const [m, v] of [[1, 1], [1.48, 0.6], [2.03, 0.4], [2.76, 0.25]])
    tone(out, t0, 0.2, { type: 'sine', f0: 110 * m, f1: 106 * m, vol: vol * v, a: 0.005, d: 0.2, s: 0.5, r: 2.2, vib: 0.004, vibRate: 3 });
}

/** 二阶低通（两次一阶），削掉刺耳的高频 */
function lowpass(out, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  for (let pass = 0; pass < 2; pass++) {
    let y = 0;
    for (let i = 0; i < out.length; i++) { y += a * (out[i] - y); out[i] = y; }
  }
  return out;
}

function normalize(out, peak = 0.9) {
  let m = 0;
  for (const v of out) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < out.length; i++) out[i] = (out[i] / m) * peak;
  // 柔和限幅
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * 1.2) / Math.tanh(1.2);
  return out;
}

function writeWav(file, data) {
  const b = Buffer.alloc(44 + data.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data.length * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(data[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgaudio-'));
function exportMp3(name, data, kbps = 48) {
  const wav = path.join(tmp, name + '.wav');
  writeWav(wav, data);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', kbps + 'k', '-ac', '1', path.join(OUT, name + '.mp3')]);
}

// —— 音效 ——
const sfx = {
  click() { const o = buf(0.08); tone(o, 0, 0.03, { type: 'sine', f0: 660, f1: 880, vol: 0.4, a: 0.003, r: 0.04 }); return o; },
  hit() { const o = buf(0.1); tone(o, 0, 0.03, { type: 'noise', vol: 0.25, a: 0.003, r: 0.03 }); tone(o, 0, 0.05, { type: 'sine', f0: 220, f1: 110, vol: 0.45, a: 0.002, r: 0.03 }); return o; },
  kill() { const o = buf(0.14); tone(o, 0, 0.06, { type: 'noise', vol: 0.45, r: 0.06 }); tone(o, 0, 0.08, { type: 'tri', f0: 200, f1: 70, vol: 0.4, r: 0.04 }); return o; },
  gem() { const o = buf(0.12); tone(o, 0, 0.04, { type: 'tri', f0: noteFreq(84), vol: 0.22, r: 0.02 }); tone(o, 0.04, 0.05, { type: 'tri', f0: noteFreq(91), vol: 0.22, r: 0.03 }); return o; },
  coin() { const o = buf(0.2); tone(o, 0, 0.05, { type: 'tri', f0: noteFreq(88), vol: 0.25, r: 0.02 }); tone(o, 0.05, 0.1, { type: 'tri', f0: noteFreq(93), vol: 0.25, r: 0.05 }); return o; },
  levelup() {
    const o = buf(0.9);
    [72, 74, 76, 79, 81, 84].forEach((n, i) => tone(o, i * 0.07, 0.12, { type: 'tri', f0: noteFreq(n), vol: 0.22, r: 0.1 }));
    tone(o, 0.42, 0.3, { type: 'tri', f0: noteFreq(84), vol: 0.3, r: 0.2, vib: 0.01 });
    pluck(o, 0.42, noteFreq(72), 0.3); pluck(o, 0.42, noteFreq(79), 0.25);
    return o;
  },
  evolve() {
    const o = buf(1.6);
    gong(o, 0, 0.5);
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(o, 0.1 + i * 0.06, 0.15, { type: 'tri', f0: noteFreq(n), vol: 0.18, r: 0.12 }));
    tone(o, 0.55, 0.5, { type: 'tri', f0: noteFreq(72), vol: 0.15, r: 0.4, vib: 0.01 });
    return o;
  },
  chest() {
    const o = buf(0.8);
    for (let i = 0; i < 8; i++) tone(o, i * 0.05, 0.05, { type: 'tri', f0: noteFreq(76 + (i % 4) * 3 + Math.floor(i / 4) * 12), vol: 0.15, r: 0.04 });
    pluck(o, 0.4, noteFreq(84), 0.3);
    return o;
  },
  boss() {
    const o = buf(2.2);
    taiko(o, 0, 1); taiko(o, 0.35, 0.9); taiko(o, 0.7, 1);
    tone(o, 0.9, 0.9, { type: 'tri', f0: noteFreq(50), f1: noteFreq(52), vol: 0.25, a: 0.08, r: 0.4, vib: 0.01 });
    tone(o, 0.9, 0.9, { type: 'tri', f0: noteFreq(57), f1: noteFreq(59), vol: 0.15, a: 0.08, r: 0.4 });
    return o;
  },
  hurt() { const o = buf(0.2); tone(o, 0, 0.12, { type: 'tri', f0: 300, f1: 90, vol: 0.4, r: 0.05 }); tone(o, 0, 0.05, { type: 'noise', vol: 0.3 }); return o; },
  explode() { const o = buf(0.8); tone(o, 0, 0.5, { type: 'noise', vol: 0.7, a: 0.002, d: 0.2, s: 0.4, r: 0.3 }); tone(o, 0, 0.3, { type: 'sine', f0: 90, f1: 30, vol: 0.8, r: 0.2 }); return o; },
  thrust() { const o = buf(0.12); tone(o, 0, 0.07, { type: 'noise', vol: 0.3, a: 0.01, d: 0.04, s: 0.3, r: 0.04 }); tone(o, 0, 0.06, { type: 'tri', f0: 600, f1: 1400, vol: 0.12, r: 0.03 }); return o; },
  shoot() { const o = buf(0.1); tone(o, 0, 0.04, { type: 'tri', f0: 1100, f1: 500, vol: 0.25, r: 0.04 }); return o; },
  horse() {
    const o = buf(0.5);
    [0, 0.09, 0.2, 0.29].forEach((t) => tone(o, t, 0.03, { type: 'noise', vol: 0.35, r: 0.03 }));
    tone(o, 0.05, 0.3, { type: 'tri', f0: 700, f1: 500, vol: 0.12, vib: 0.05, vibRate: 22, r: 0.1 });
    return o;
  },
  fire() { const o = buf(0.4); tone(o, 0, 0.3, { type: 'noise', vol: 0.35, a: 0.03, d: 0.1, s: 0.5, r: 0.1 }); return o; },
  victory() {
    const o = buf(2.4);
    gong(o, 0, 0.3);
    const mel = [[67, 0.15], [69, 0.15], [72, 0.3], [74, 0.15], [76, 0.15], [79, 0.6], [81, 0.3], [84, 0.8]];
    let t = 0.1;
    for (const [n, d] of mel) { tone(o, t, d, { type: 'tri', f0: noteFreq(n), vol: 0.2, r: 0.08 }); pluck(o, t, noteFreq(n - 12), 0.2); t += d; }
    return o;
  },
  defeat() {
    const o = buf(2.0);
    const mel = [[69, 0.3], [67, 0.3], [64, 0.3], [62, 0.4], [57, 0.8]];
    let t = 0;
    for (const [n, d] of mel) { tone(o, t, d, { type: 'tri', f0: noteFreq(n), vol: 0.3, r: 0.1, vib: 0.008 }); t += d; }
    gong(o, 1.2, 0.25);
    return o;
  },
};

// —— 背景音乐 ——
// 五声音阶（宫商角徵羽），D 调
const PENTA = [0, 2, 4, 7, 9];
const scaleNote = (root, deg) => root + PENTA[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5);

function battleBgm(bpm, bars, root, intense) {
  const beat = 60 / bpm;
  const barLen = beat * 4;
  const o = buf(bars * barLen + 0.01);
  // 旋律：以 4 小节为句，句内重复动机并变化
  const motifs = [
    [0, 2, 3, 2, 4, 3, 2, 0],
    [3, 4, 5, 4, 3, 2, 3, -1],
    [5, 4, 3, 2, 3, 2, 0, 1],
    [2, 3, 4, 7, 5, 4, 3, -1],
  ];
  const chords = [0, 3, 4, 0, 5, 3, 4, 0]; // 低音走向（音阶度数）
  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * barLen;
    const ch = chords[bar % chords.length];
    // 鼓
    for (let b = 0; b < 4; b++) {
      const tb = t0 + b * beat;
      if (b === 0 || b === 2) taiko(o, tb, b === 0 ? 0.9 : 0.6);
      if (b === 1 || b === 3) snare(o, tb, intense ? 0.3 : 0.2);
      hat(o, tb + beat / 2, 0.08);
      if (intense) { hat(o, tb + beat / 4, 0.05); hat(o, tb + (beat * 3) / 4, 0.05); }
    }
    if (intense && bar % 2 === 1) { taiko(o, t0 + beat * 3.5, 0.5); taiko(o, t0 + beat * 3.75, 0.5); }
    // 低音：八分音符跳动
    for (let e = 0; e < 8; e++) {
      const n = scaleNote(root - 24, ch) + (e % 2 ? 12 : 0);
      tone(o, t0 + e * beat / 2, beat / 2 * 0.8, { type: 'tri', f0: noteFreq(n), vol: 0.32, a: 0.003, d: 0.05, s: 0.7, r: 0.03 });
    }
    // 琵琶分解和弦
    for (let e = 0; e < 4; e++) pluck(o, t0 + e * beat + beat / 2, noteFreq(scaleNote(root - 12, ch + [0, 2, 4, 2][e])), 0.18, 0.994, 0.6);
    // 主旋律（第一段静默引入，之后进入）
    if (bar >= 2) {
      const m = motifs[Math.floor(bar / 2) % motifs.length];
      const half = bar % 2;
      for (let i = 0; i < 4; i++) {
        const deg = m[half * 4 + i] + (bar >= bars / 2 ? 5 : 0) * (intense ? 1 : 0);
        if (deg < 0) continue;
        const n = scaleNote(root + 12, deg);
        tone(o, t0 + i * beat, beat * 0.9, { type: 'pulse', f0: noteFreq(n), vol: 0.13, a: 0.01, d: 0.08, s: 0.6, r: 0.05, vib: 0.006, vibRate: 6 });
        tone(o, t0 + i * beat, beat * 0.9, { type: 'square', f0: noteFreq(n) * 1.003, vol: 0.06, a: 0.01, s: 0.5, r: 0.05 });
      }
    }
  }
  gong(o, 0, 0.35);
  return o;
}

function homeBgm() {
  const bpm = 84, beat = 60 / bpm, bars = 16;
  const o = buf(bars * beat * 4 + 0.01);
  const root = 62; // D
  const mel = [
    [4, 2], [3, 1], [2, 1], [3, 2], [0, 2],
    [2, 1], [3, 1], [4, 2], [5, 2], [4, 2],
    [7, 2], [5, 1], [4, 1], [3, 2], [2, 2],
    [3, 1], [2, 1], [0, 2], [-1, 2], [0, 2],
  ];
  // 古筝主旋律（拨弦 + 轻颤音长音）
  let t = beat * 4;
  for (let rep = 0; rep < 2; rep++)
    for (const [deg, d] of mel) {
      const n = scaleNote(root, deg);
      pluck(o, t, noteFreq(n), 0.4, 0.997, 2.2);
      if (d >= 2) tone(o, t, d * beat * 0.9, { type: 'sine', f0: noteFreq(n), vol: 0.08, a: 0.1, s: 0.6, r: 0.3, vib: 0.01, vibRate: 5 });
      t += d * beat;
    }
  // 低音分解和弦
  const prog = [0, 3, 4, 0, 5, 3, 4, 0];
  for (let bar = 0; bar < bars; bar++) {
    const ch = prog[bar % prog.length];
    for (let e = 0; e < 4; e++) pluck(o, bar * beat * 4 + e * beat, noteFreq(scaleNote(root - 24, ch + [0, 2, 4, 2][e])), 0.2, 0.995, 1.2);
    if (bar % 2 === 0) taiko(o, bar * beat * 4, 0.35);
  }
  gong(o, 0, 0.25);
  return o;
}

const tracks = {
  bgm_home: () => homeBgm(),
  bgm_battle: () => battleBgm(132, 24, 62, false),
  bgm_boss: () => battleBgm(150, 24, 57, true),
};

// 手机外放高频很刺耳：音效低通到 3.2kHz、峰值压低；音乐低通到 5kHz
for (const [name, fn] of Object.entries(sfx)) exportMp3('sfx_' + name, normalize(lowpass(fn(), 3200), 0.62), 48);
for (const [name, fn] of Object.entries(tracks)) exportMp3(name, normalize(lowpass(fn(), 5000), 0.7), 64);
fs.rmSync(tmp, { recursive: true, force: true });
let total = 0;
for (const f of fs.readdirSync(OUT)) total += fs.statSync(path.join(OUT, f)).size;
console.log('audio files:', fs.readdirSync(OUT).length, 'total KB:', Math.round(total / 1024));
