import { hash2 } from '../core/math';
import { drawXuanTexture } from '../ui/xuanPaper';
import { getPlatform } from '../platform';

// 主界面背景画：青绿山水长卷（绢色天空、朱砂落日、三重远山、云带、关隘剪影、夯土校场）。
// 全部是静态内容，画一次缓存成整屏图层；云、飞鸟、花瓣这些会动的在 HomeCamp 里每帧叠上去。

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** 一维平滑噪声，返回 [0,1] */
function noise1(x: number, seed: number): number {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash2(i, seed, 17) * (1 - u) + hash2(i + 1, seed, 17) * u;
}

interface Peak { x: number; h: number; w: number }

/** 山脊线：几层噪声起伏 + 指定位置的主峰。返回屏幕 y。 */
function ridge(W: number, base: number, amp: number, seed: number, peaks: Peak[], rough: number) {
  return (x: number) => {
    const t = x / W;
    let y = noise1(t * 3.1 + seed, seed) * 0.55 + noise1(t * 7.3 + seed * 2, seed + 3) * 0.3 + noise1(t * 19 + seed * 5, seed + 7) * 0.15 * rough;
    y += noise1(t * 47, seed + 11) * 0.05 * rough;
    let p = 0;
    for (const pk of peaks) {
      const d = Math.abs(t - pk.x) / pk.w;
      if (d < 1) p = Math.max(p, pk.h * Math.pow(1 - d, 1.6));
    }
    return base - amp * (y * 0.62 + p);
  };
}

function tracePath(g: G, W: number, fn: (x: number) => number, bottom: number, step: number) {
  g.beginPath();
  g.moveTo(-2, bottom);
  for (let x = -2; x <= W + step; x += step) g.lineTo(x, fn(x));
  g.lineTo(W + 2, bottom);
  g.closePath();
}

/** 一重山：渐变敷色（山顶浓、山脚化进云气）+ 山脊勾线 + 皴笔 */
function mountain(g: G, W: number, fn: (x: number) => number, top: number, bottom: number, cTop: string, cMid: string, cBot: string, ink: string, S: number, seed: number, strokes: number) {
  const step = Math.max(2, Math.round(S));
  tracePath(g, W, fn, bottom, step);
  const gr = g.createLinearGradient(0, top, 0, bottom);
  gr.addColorStop(0, cTop);
  gr.addColorStop(0.55, cMid);
  gr.addColorStop(1, cBot);
  g.fillStyle = gr;
  g.fill();
  g.save();
  tracePath(g, W, fn, bottom, step);
  g.clip();
  // 皴笔：沿山脊往下的斜向短笔触，疏密不一，做出山石的阴阳向背
  g.lineCap = 'round';
  for (let i = 0; i < strokes; i++) {
    const x = hash2(i, seed, 1) * W;
    const y0 = fn(x) + hash2(i, seed, 2) * (bottom - top) * 0.42;
    const len = (6 + hash2(i, seed, 3) * 22) * S * 0.5;
    const dir = hash2(Math.floor(x / (40 * S)), seed, 4) < 0.5 ? -1 : 1;
    const fade = 1 - Math.min(1, (y0 - top) / Math.max(1, (bottom - top) * 0.75));
    g.strokeStyle = ink;
    g.globalAlpha = (0.05 + hash2(i, seed, 5) * 0.14) * fade;
    g.lineWidth = (0.6 + hash2(i, seed, 6) * 1.8) * S * 0.5;
    g.beginPath();
    g.moveTo(x, y0);
    g.quadraticCurveTo(x + dir * len * 0.18, y0 + len * 0.5, x + dir * len * 0.5, y0 + len);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.restore();
  // 山脊勾线
  g.beginPath();
  for (let x = -2; x <= W + step; x += step) { if (x === -2) g.moveTo(x, fn(x)); else g.lineTo(x, fn(x)); }
  g.strokeStyle = ink;
  g.globalAlpha = 0.34;
  g.lineWidth = Math.max(1, S * 0.5);
  g.stroke();
  g.globalAlpha = 1;
}

/** 远山上的小松：一竖干 + 三层横向笔触 */
function pine(g: G, x: number, y: number, s: number, ink: string) {
  g.fillStyle = ink;
  g.fillRect(x - s * 0.12, y - s * 1.9, s * 0.24, s * 1.9);
  for (let i = 0; i < 3; i++) {
    const w = s * (0.5 + i * 0.32), yy = y - s * (2.2 - i * 0.6);
    g.beginPath();
    g.moveTo(x - w, yy + s * 0.3);
    g.quadraticCurveTo(x, yy - s * 0.42, x + w, yy + s * 0.3);
    g.quadraticCurveTo(x, yy + s * 0.05, x - w, yy + s * 0.3);
    g.fill();
  }
}

/** 一条横向云带：中间浓两头淡 */
function mistBand(g: G, cx: number, cy: number, rx: number, ry: number, alpha: number, color = '252,246,232') {
  g.save();
  g.translate(cx, cy);
  g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, `rgba(${color},${alpha})`);
  gr.addColorStop(0.55, `rgba(${color},${alpha * 0.55})`);
  gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, rx, 0, TAU);
  g.fill();
  g.restore();
}

/**
 * 画整张背景。(ox, oy) 是篝火在屏幕上的位置，S 是营地像素的放大倍数，u 是界面设计单位。
 * 地平线在营地栅栏一线（oy - 58S），上面是天空与远山，下面是沙地与校场。
 */
export function paintHomeScene(g: G, W: number, H: number, ox: number, oy: number, S: number, u: number) {
  const Y = (y: number) => Math.round(oy + y * S), X = (x: number) => Math.round(ox + x * S);
  const hz = Y(-58);

  // —— 天空：绢色，越靠近地平线越暖 ——
  const sky = g.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#e9dfc6');
  sky.addColorStop(0.45, '#f1e4c6');
  sky.addColorStop(0.82, '#f6dfb4');
  sky.addColorStop(1, '#f4d6a6');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, hz + 2);

  // —— 落日：朱砂日轮 + 两圈霞光 ——
  const sunX = W * 0.71, sunY = Y(-126), sunR = 13.5 * S;
  for (const [r, a] of [[9, 0.1], [5, 0.16], [2.6, 0.24]] as [number, number][]) {
    const gl = g.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, sunR * r);
    gl.addColorStop(0, `rgba(238,120,64,${a})`);
    gl.addColorStop(1, 'rgba(238,120,64,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, W, hz);
  }
  const sg = g.createRadialGradient(sunX - sunR * 0.25, sunY - sunR * 0.3, sunR * 0.1, sunX, sunY, sunR);
  sg.addColorStop(0, '#f0705a');
  sg.addColorStop(0.7, '#d9452f');
  sg.addColorStop(1, '#c23a26');
  g.fillStyle = sg;
  g.beginPath();
  g.arc(sunX, sunY, sunR, 0, TAU);
  g.fill();

  // —— 高空几抹卷云（留白） ——
  for (let i = 0; i < 5; i++) {
    const cx = W * (0.12 + hash2(i, 3, 41) * 0.8), cy = hz * (0.2 + hash2(i, 5, 41) * 0.3);
    mistBand(g, cx, cy, (90 + hash2(i, 7, 41) * 120) * u, (7 + hash2(i, 9, 41) * 8) * u, 0.5);
  }

  // —— 第一重：远岫（石青淡染） ——
  const r1 = ridge(W, Y(-96), 62 * S, 3, [{ x: 0.24, h: 0.78, w: 0.2 }, { x: 0.5, h: 0.3, w: 0.16 }, { x: 0.9, h: 0.52, w: 0.2 }], 0.6);
  mountain(g, W, r1, Y(-170), hz, 'rgba(120,150,160,0.62)', 'rgba(150,176,178,0.4)', 'rgba(214,214,190,0)', '#46626c', S, 5, 110);
  // 落日压在远山前的云带
  mistBand(g, sunX - 10 * S, sunY + sunR * 0.72, 62 * S, 4.2 * S, 0.9, '250,238,214');
  mistBand(g, W * 0.3, Y(-104), 110 * S, 9 * S, 0.72);

  // —— 第二重：中景（石绿、花青），右侧山头一座关隘 ——
  const r2 = ridge(W, Y(-84), 48 * S, 9, [{ x: 0.08, h: 0.5, w: 0.2 }, { x: 0.62, h: 0.34, w: 0.14 }, { x: 0.82, h: 0.7, w: 0.17 }], 0.9);
  // 关隘剪影：城墙 + 门楼（画在山体后面一点点，被山脊遮住墙根）
  {
    const fx = W * 0.6, fy = r2(fx) + 2 * S;
    g.fillStyle = 'rgba(62,92,96,0.78)';
    const ww = 26 * S, wh = 7 * S;
    g.fillRect(fx - ww / 2, fy - wh, ww, wh + 4 * S);
    for (let i = 0; i < 9; i++) g.fillRect(fx - ww / 2 + i * (ww / 8.5), fy - wh - 1.2 * S, ww / 17, 1.4 * S);
    // 门楼
    g.fillRect(fx - 5 * S, fy - wh - 6 * S, 10 * S, 6 * S);
    g.beginPath();
    g.moveTo(fx - 8.5 * S, fy - wh - 5.6 * S);
    g.quadraticCurveTo(fx - 5 * S, fy - wh - 7 * S, fx, fy - wh - 10 * S);
    g.quadraticCurveTo(fx + 5 * S, fy - wh - 7 * S, fx + 8.5 * S, fy - wh - 5.6 * S);
    g.quadraticCurveTo(fx, fy - wh - 6.6 * S, fx - 8.5 * S, fy - wh - 5.6 * S);
    g.fill();
    // 旗
    g.fillRect(fx + 10 * S, fy - wh - 9 * S, 0.6 * S, 9 * S);
    g.fillStyle = 'rgba(190,60,44,0.8)';
    g.fillRect(fx + 10.6 * S, fy - wh - 9 * S, 4 * S, 2.6 * S);
  }
  mountain(g, W, r2, Y(-132), hz + 4 * S, 'rgba(58,104,108,0.86)', 'rgba(104,146,132,0.62)', 'rgba(206,204,168,0.05)', '#1f3d42', S, 12, 150);
  mistBand(g, W * 0.72, Y(-80), 120 * S, 8 * S, 0.8);
  mistBand(g, W * 0.12, Y(-74), 80 * S, 7 * S, 0.66);

  // —— 第三重：近岭（浓墨带绿），岭上疏松 ——
  const r3 = ridge(W, Y(-66), 30 * S, 21, [{ x: 0.0, h: 0.75, w: 0.26 }, { x: 0.36, h: 0.2, w: 0.14 }, { x: 1.0, h: 0.62, w: 0.26 }], 1.2);
  mountain(g, W, r3, Y(-96), hz + 8 * S, 'rgba(34,62,56,0.94)', 'rgba(64,98,74,0.8)', 'rgba(170,170,120,0.2)', '#10231f', S, 27, 190);
  for (let i = 0; i < 22; i++) {
    const t = hash2(i, 2, 77);
    const x = t < 0.5 ? t * 2 * W * 0.3 : W * (0.7 + (t - 0.5) * 2 * 0.3);
    const s = (2.4 + hash2(i, 4, 77) * 2.4) * S;
    pine(g, x, r3(x) + s * 0.3, s, 'rgba(18,40,34,0.92)');
  }

  // —— 山脚云气：把远山和营地隔开，留白 ——
  const mist = g.createLinearGradient(0, Y(-80), 0, hz + 10 * S);
  mist.addColorStop(0, 'rgba(250,242,224,0)');
  mist.addColorStop(0.62, 'rgba(250,242,224,0.82)');
  mist.addColorStop(1, 'rgba(240,226,196,0.96)');
  g.fillStyle = mist;
  g.fillRect(0, Y(-80), W, hz + 10 * S - Y(-80));

  // —— 沙地 ——
  const gy0 = hz + 6 * S;
  const ground = g.createLinearGradient(0, gy0, 0, H);
  ground.addColorStop(0, '#efdfbb');
  ground.addColorStop(0.25, '#e6d2a6');
  ground.addColorStop(0.65, '#dcc494');
  ground.addColorStop(1, '#d0b684');
  g.fillStyle = ground;
  g.fillRect(0, gy0, W, H - gy0);
  // 大片深浅不匀的土色
  for (let i = 0; i < 16; i++) {
    const cx = hash2(i, 1, 91) * W, cy = gy0 + hash2(i, 2, 91) * (H - gy0);
    const dark = hash2(i, 3, 91) < 0.55;
    mistBand(g, cx, cy, (70 + hash2(i, 4, 91) * 110) * S * 0.5, (14 + hash2(i, 5, 91) * 18) * S * 0.5, dark ? 0.11 : 0.3, dark ? '150,112,62' : '250,238,206');
  }

  // 沙地上的像素碎石、枯草（和营地像素画同一比例）
  const cell = 16;
  const x0 = Math.floor(-ox / S / cell) - 1, x1 = Math.ceil((W - ox) / S / cell) + 1;
  const y1 = Math.ceil((H - oy) / S / cell) + 1;
  for (let cy = -4; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const h = hash2(cx, cy, 3);
    const wx = cx * cell + hash2(cx, cy, 5) * cell, wy = cy * cell + hash2(cx, cy, 7) * cell;
    if (wy < -50) continue;
    const dx = wx / 104, dy = (wy + 6) / 50;
    if (dx * dx + dy * dy < 1.05) continue; // 校场里干净
    if (h > 0.62) { g.fillStyle = 'rgba(255,246,220,0.5)'; g.fillRect(X(wx), Y(wy), 3 * S, S); }
    else if (h > 0.3) { g.fillStyle = 'rgba(160,122,72,0.3)'; g.fillRect(X(wx), Y(wy), 2 * S, S); }
    if (h < 0.06) {
      g.fillStyle = '#a79a86'; g.fillRect(X(wx + 4), Y(wy + 2), 3 * S, 2 * S);
      g.fillStyle = '#cfc5b0'; g.fillRect(X(wx + 4), Y(wy + 2), 2 * S, S);
      g.fillStyle = 'rgba(70,50,30,0.25)'; g.fillRect(X(wx + 4), Y(wy + 4), 3 * S, S);
    } else if (h < 0.15) {
      g.fillStyle = '#8f9a5c'; g.fillRect(X(wx + 2), Y(wy - 2), S, 2 * S); g.fillRect(X(wx + 6), Y(wy - 2), S, 2 * S);
      g.fillStyle = '#6f7c46'; g.fillRect(X(wx + 4), Y(wy - 3), S, 3 * S);
    }
  }

  // —— 校场：夯土圆坛，外沿一圈压实的深色，内圈两道界线 ——
  const ell = (cx: number, cy: number, rx: number, ry: number) => { g.save(); g.translate(cx, cy); g.scale(1, ry / rx); g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.restore(); };
  ell(X(0), Y(-3), 112 * S, 54 * S); g.fillStyle = 'rgba(120,86,46,0.12)'; g.fill();
  ell(X(0), Y(-5), 106 * S, 50 * S); g.fillStyle = 'rgba(132,96,54,0.34)'; g.fill();
  g.save();
  g.translate(X(0), Y(-6));
  g.scale(1, 45 / 98);
  const ag = g.createRadialGradient(0, -20 * S, 10 * S, 0, 0, 98 * S);
  ag.addColorStop(0, '#f6e8c8');
  ag.addColorStop(0.7, '#ecd9b0');
  ag.addColorStop(1, '#dcc496');
  g.fillStyle = ag;
  g.beginPath(); g.arc(0, 0, 98 * S, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(120,88,50,0.3)';
  g.lineWidth = Math.max(1, S * 0.7);
  g.beginPath(); g.arc(0, 0, 92 * S, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(176,52,38,0.22)';
  if (g.setLineDash) g.setLineDash([6 * S, 5 * S]);
  g.beginPath(); g.arc(0, 0, 64 * S, 0, TAU); g.stroke();
  if (g.setLineDash) g.setLineDash([]);
  g.restore();
  // 校场上的细碎土点
  for (let i = 0; i < 90; i++) {
    const a = hash2(i, 1, 9) * TAU, r = Math.sqrt(hash2(i, 2, 9));
    g.fillStyle = i % 3 ? 'rgba(150,112,64,0.28)' : 'rgba(255,248,226,0.6)';
    g.fillRect(X(Math.cos(a) * 92 * r), Y(-6 + Math.sin(a) * 41 * r), (1 + (i % 2)) * S, S);
  }
  // 固定物件脚下的地影（帅帐、兵器架、粮草）
  g.fillStyle = 'rgba(70,46,22,0.22)';
  ell(X(0), Y(-39), 34 * S, 7 * S); g.fill();
  ell(X(-58), Y(-25), 15 * S, 3.6 * S); g.fill();
  ell(X(58), Y(-23), 15 * S, 3.6 * S); g.fill();

  // 整幅绢本肌理 + 四周淡淡压暗，把视线收到中间
  drawXuanTexture(g, 0, 0, W, H, u, { alpha: 0.9, patina: false });
  const vg = g.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.42, W / 2, H * 0.46, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(60,36,14,0)');
  vg.addColorStop(1, 'rgba(60,36,14,0.26)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
}

/** 一朵会飘的薄云（预渲染小图，每帧平移贴上去） */
let wisp: HTMLCanvasElement | null = null;
let wispU = 0;
export function cloudWisp(u: number): HTMLCanvasElement {
  if (wisp && wispU === u) return wisp;
  const w = Math.ceil(420 * u), h = Math.ceil(84 * u);
  const c = getPlatform().createCanvas(w, h);
  const g = c.getContext('2d')!;
  for (let i = 0; i < 9; i++) {
    const cx = w * (0.16 + hash2(i, 1, 55) * 0.68), cy = h * (0.42 + hash2(i, 2, 55) * 0.24);
    mistBand(g, cx, cy, (60 + hash2(i, 3, 55) * 80) * u, (10 + hash2(i, 4, 55) * 12) * u, 0.36);
  }
  wisp = c; wispU = u;
  return c;
}

/** 非主界面页签（商店 / 装备 / 军略 / 武将 / 演武）的底：整张熟宣 + 上下两抹远山 + 顶部云纹暗花 */
export function paintPageBg(g: G, W: number, H: number, u: number) {
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#efe5cf');
  bg.addColorStop(0.5, '#e6d8bc');
  bg.addColorStop(1, '#d6c4a2');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // 顶部远山（淡青）
  const r1 = ridge(W, 330 * u, 150 * u, 31, [{ x: 0.2, h: 0.6, w: 0.22 }, { x: 0.8, h: 0.8, w: 0.24 }], 0.7);
  mountain(g, W, r1, 150 * u, 420 * u, 'rgba(96,130,134,0.2)', 'rgba(130,156,150,0.1)', 'rgba(220,210,180,0)', '#35545a', 2 * u, 31, 70);
  // 底部近山
  const r2 = ridge(W, H - 150 * u, 190 * u, 44, [{ x: 0.1, h: 0.7, w: 0.3 }, { x: 0.72, h: 0.5, w: 0.26 }], 1);
  mountain(g, W, r2, H - 380 * u, H, 'rgba(66,84,74,0.05)', 'rgba(66,84,74,0.14)', 'rgba(52,66,58,0.22)', '#2a3a34', 2 * u, 44, 90);
  mistBand(g, W * 0.5, H - 250 * u, W * 0.7, 40 * u, 0.5);
  drawXuanTexture(g, 0, 0, W, H, u, { alpha: 0.96, patina: true, patinaStrength: 1.2 });
  const vg = g.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.45, W / 2, H * 0.5, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(60,36,14,0)');
  vg.addColorStop(1, 'rgba(60,36,14,0.2)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
}

/** 启动页：只用渐变和几笔远山（这时图集、宣纸纹理都还没生成），画一次缓存 */
export function paintSplash(g: G, W: number, H: number, u: number) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#e9dfc6');
  sky.addColorStop(0.42, '#f3e3c0');
  sky.addColorStop(0.62, '#f5d9aa');
  sky.addColorStop(1, '#e2cfa6');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const S = 2 * u;
  const hz = H * 0.66;
  const sunX = W * 0.7, sunY = H * 0.5, sunR = 46 * u;
  for (const [r, a] of [[8, 0.1], [4.4, 0.16], [2.4, 0.24]] as [number, number][]) {
    const gl = g.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, sunR * r);
    gl.addColorStop(0, `rgba(238,120,64,${a})`);
    gl.addColorStop(1, 'rgba(238,120,64,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, W, H);
  }
  g.fillStyle = '#d9452f';
  g.beginPath(); g.arc(sunX, sunY, sunR, 0, TAU); g.fill();
  const r1 = ridge(W, hz - 40 * u, 230 * u, 3, [{ x: 0.22, h: 0.8, w: 0.22 }, { x: 0.9, h: 0.5, w: 0.2 }], 0.6);
  mountain(g, W, r1, hz - 300 * u, hz + 30 * u, 'rgba(120,150,160,0.6)', 'rgba(150,176,178,0.38)', 'rgba(214,214,190,0)', '#46626c', S, 5, 80);
  mistBand(g, sunX - 30 * u, sunY + sunR * 0.75, 210 * u, 15 * u, 0.9, '250,238,214');
  const r2 = ridge(W, hz, 170 * u, 9, [{ x: 0.06, h: 0.5, w: 0.2 }, { x: 0.8, h: 0.7, w: 0.18 }], 0.9);
  mountain(g, W, r2, hz - 170 * u, hz + 60 * u, 'rgba(58,104,108,0.86)', 'rgba(104,146,132,0.6)', 'rgba(206,204,168,0.05)', '#1f3d42', S, 12, 110);
  mistBand(g, W * 0.3, hz - 6 * u, 320 * u, 26 * u, 0.8);
  const r3 = ridge(W, hz + 70 * u, 110 * u, 21, [{ x: 0.0, h: 0.75, w: 0.26 }, { x: 1.0, h: 0.62, w: 0.26 }], 1.2);
  mountain(g, W, r3, hz - 40 * u, hz + 130 * u, 'rgba(34,62,56,0.94)', 'rgba(64,98,74,0.8)', 'rgba(170,170,120,0.2)', '#10231f', S, 27, 130);
  for (let i = 0; i < 16; i++) {
    const t = hash2(i, 2, 77);
    const x = t < 0.5 ? t * 2 * W * 0.3 : W * (0.7 + (t - 0.5) * 2 * 0.3);
    const s = (8 + hash2(i, 4, 77) * 8) * u;
    pine(g, x, r3(x) + s * 0.3, s, 'rgba(18,40,34,0.92)');
  }
  const mist = g.createLinearGradient(0, hz + 40 * u, 0, hz + 190 * u);
  mist.addColorStop(0, 'rgba(244,232,206,0)');
  mist.addColorStop(0.7, 'rgba(240,226,196,0.95)');
  mist.addColorStop(1, 'rgba(232,216,180,1)');
  g.fillStyle = mist;
  g.fillRect(0, hz + 40 * u, W, H - hz - 40 * u);
  const vg = g.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.42, W / 2, H * 0.46, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(60,36,14,0)');
  vg.addColorStop(1, 'rgba(60,36,14,0.3)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
}
