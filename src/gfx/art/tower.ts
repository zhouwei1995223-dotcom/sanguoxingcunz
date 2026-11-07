import { PixelImage } from '../pixel';
import { arrowTowerImage } from './defense';
import { FIELD_H, FIELD_W, Point, TowerKind, TowerMap } from '../../data/tower';

export function emplacementImage(kind: TowerKind, level: number, pose = 0): PixelImage {
  if (kind === 'arrow') {
    const p = arrowTowerImage(level).pad(0, 0, 5, 0);
    const bow = pose === 1 ? 22 : pose === 2 ? 19 : 17;
    p.line(15, 6, bow, 9, 'y'); p.line(bow, 9, 15, 13, 'u');
    p.line(15, 6, pose === 1 ? 15 : 11, 9, 'w'); p.line(pose === 1 ? 15 : 11, 9, 15, 13, 'w');
    return p;
  }
  const p = new PixelImage(34, 40);
  p.rect(2, 32, 30, 6, 'n');
  p.rect(4, 29, 26, 5, 's');
  p.rect(6, 28, 22, 3, 'S');
  if (kind === 'bolt' || kind === 'stone') {
    for (const x of [7, 24]) {
      p.disc(x, 25, 4, 'K'); p.disc(x, 25, 3, 'U'); p.set(x, 25, 'y');
    }
    p.rect(4, 20, 24, 4, 'u'); p.rect(6, 20, 20, 1, 'y');
    if (kind === 'stone') {
      const tipX = [4, 18, 10][pose], tipY = [15, 2, 6][pose];
      p.line(10, 21, 15, 14, 'G'); p.line(21, 21, 15, 14, 'd');
      p.line(tipX, tipY, 24, 20, 'U'); p.line(tipX, tipY - 1, 24, 19, 'y');
      p.disc(15, 14, 2, 'S'); p.rect(tipX - 3, tipY - 2, 6, 3, 'u');
      if (pose === 0) p.disc(tipX, tipY - 3, 3, 's');
    } else {
      const back = [9, 5, 7][pose], arm = [17, 23, 20][pose];
      p.rect(back, 12, 17, 4, 'G'); p.rect(back - 2, 16, 18, 3, 'U');
      p.line(arm, 7, back + 4, 13, 'y'); p.line(arm, 19, back + 4, 14, 'u');
      p.line(arm, 7, back, 13, 'w'); p.line(back, 13, arm, 19, 'w');
      if (pose !== 1) p.line(back, 13, 28, 13, 'S');
    }
  } else {
    p.rect(6, 14, 3, 16, 'U');
    p.rect(24, 14, 3, 16, 'U');
    p.rect(5, 13, 23, 3, 'u');
    p.rect(7, 12, 19, 2, 'y');
    if (kind === 'oil') {
      const lift = [0, 4, 2][pose];
      p.rect(10, 11 - lift, 15, 13, 'K');
      p.rect(8, 13 - lift, 19, 7, 'n');
      p.rect(10, 12 - lift, 15, 3, 'u');
      p.rect(11, 19 - lift, 13, 2, 'y');
      p.line(6, 18, 11, 14 - lift, 'y'); p.line(26, 18, 23, 14 - lift, 'u');
      p.rect(14, 7, 7, 6, 'R');
      p.rect(15 + pose, 4 - pose, 3, 7 + pose, 'o');
      p.rect(18, 8, 2, 4, 'Y');
    } else {
      p.disc(16, 15, 8, 'r');
      p.disc(15, 14, 7, 'q');
      p.ring(15, 14, 6, 'y');
      p.disc(15, 14, 2, 'R');
      const a = [7, 12, 9][pose], b = [6, 12, 8][pose];
      p.line(4, 5, 12, a, 'U'); p.line(27, 4, 20, b, 'U');
      p.disc(12, a, 2, 'R'); p.disc(20, b, 2, 'R');
    }
  }
  p.rect(28, 8, 1, 20, 'U');
  p.rect(29, 8, 4, 9, level === 1 ? 'G' : level === 2 ? 'B' : 'R');
  for (let i = 0; i < level; i++) p.rect(7 + i * 6, 34, 3, 2, 'Y');
  return p.outline();
}

export function passGate() {
  const p = new PixelImage(50, 39);
  p.rect(2, 17, 46, 19, 'N');
  p.rect(4, 17, 42, 15, 's');
  for (let y = 20; y < 35; y += 4)for (let x = (y % 8 ? 3 : 6); x < 46; x += 8)p.rect(x, y, 5, 1, 'S');
  p.rect(15, 17, 20, 19, 'U');
  p.rect(18, 19, 14, 17, 'K');
  p.rect(18, 23, 14, 13, 'z');
  for (let i = 0; i < 3; i++) { p.rect(7 + 16 * i, 11, 4, 7, 'r'); }
  p.rect(4, 10, 42, 3, 'u');
  p.rect(0, 8, 50, 3, 'K');
  p.rect(4, 6, 42, 3, 'd');
  p.rect(9, 4, 32, 3, 'G');
  p.rect(14, 2, 22, 3, 'd');
  p.rect(1, 6, 4, 2, 'K');
  p.rect(45, 6, 4, 2, 'K');
  p.rect(20, 12, 10, 4, 'y');
  return p.outline();
}

type Stamp = (name: string, x: number, y: number, size: number) => void;
function roadDistance(x: number, y: number, a: Point, b: Point) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/** 在地图尺寸的离屏画布上绘一次。路径、建塔位与碰撞共用地图坐标。 */
export function drawTerrain(g: CanvasRenderingContext2D, map: TowerMap, stamp: Stamp) {
  let seed = 13791 * map.id;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const base = ['#acba82', '#9cad8a', '#aba17d'][map.id - 1];
  g.fillStyle = base;
  g.fillRect(0, 0, FIELD_W, FIELD_H);
  for (let i = 0; i < 500; i++) {
    const x = Math.floor(random() * FIELD_W), y = Math.floor(random() * FIELD_H);
    const w = 4 + Math.floor(random() * 23);
    g.fillStyle = i % 3 ? 'rgba(64,91,54,.07)' : 'rgba(243,226,148,.16)';
    g.fillRect(x, y, w, 3);
    g.fillRect(x + 3, y - 2, w - 4, 7);
  }
  const path = (points: Point[]) => {
    g.beginPath();
    points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  };
  if (map.id === 2) {
    const river = HANSHUI_RIVER;
    for (const [width, col] of [[28, '#83967a'], [22, '#719b91'], [12, '#80aaa0']] as const) {
      path(river);
      g.lineWidth = width;
      g.strokeStyle = col;
      g.stroke();
    }
  }
  g.lineJoin = 'bevel';
  for (const [width, color] of [[25, '#8a825e'], [22, '#b7a37c'], [18, '#dac399'], [12, '#e3cea7']] as const) {
    g.lineWidth = width;
    g.strokeStyle = color;
    for (const line of map.routes) {
      path(line);
      g.stroke();
    }
  }
  for (const line of map.routes) for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    for (let s = 3; s < l; s += 5) {
      const f = s / l, j = (random() - 0.5) * 16;
      g.fillStyle = '#c7b18b';
      g.fillRect(Math.round(a[0] + dx * f - dy * j / l), Math.round(a[1] + dy * f + dx * j / l), 2, 1);
    }
    if (l > 70) {
      g.save();
      g.translate(a[0] + dx * .57, a[1] + dy * .57);
      g.rotate(Math.atan2(dy, dx));
      g.strokeStyle = '#ae926e';
      g.lineWidth = 1.5;
      path([[-3, -3], [1, 0], [-3, 3]]);
      g.stroke();
      g.restore();
    }
  }
  const decor: { x: number; y: number; size: number; name: string }[] = [];
  for (let i = 0; i < 330; i++) {
    const x = random() * FIELD_W, y = random() * FIELD_H, size = 7 + random() * 16;
    if (map.routes.some(r => r.some((p, k) => k > 0 && roadDistance(x, y, p, r[k - 1]) < 15 + size * .22))) continue;
    if (map.sites.some(p => Math.hypot(x - p[0], y - p[1]) < 20)) continue;
    const name = random() < 0.55 ? ['tree', 'reeds', 'pine'][map.id - 1] : 'rock';
    decor.push({ x, y, size, name });
  }
  decor.sort((a, b) => a.y - b.y).forEach(o => stamp('env_' + map.theme + '_' + o.name, o.x, o.y, o.size));
  // 出兵旗与城门每帧单独绘制（旗帜飘动、城门受击晃动），这里只画地面痕迹。
  const gate = map.routes[0][map.routes[0].length - 1];
  g.fillStyle = 'rgba(60,46,30,.22)';
  g.beginPath(); g.ellipse(gate[0], gate[1] + 12, 27, 6, 0, 0, Math.PI * 2); g.fill();
}

/** 汉水双渡的河道（地图与水面波光共用）。 */
export const HANSHUI_RIVER: Point[] = [[0, 202], [64, 178], [111, 185], [159, 161], [207, 160], [263, 179], [320, 163]];

/** 出兵口的军旗：旗面按时间波动。 */
export function drawSpawnFlag(g: CanvasRenderingContext2D, x: number, y: number, t: number, phase: number) {
  const px = x < 100 ? 10 : FIELD_W - 12, dir = x < 100 ? 1 : -1;
  g.fillStyle = 'rgba(40,30,20,.25)';
  g.fillRect(px - 2, y - 3, 6, 2);
  g.fillStyle = '#513b2d';
  g.fillRect(px, y - 25, 2, 23);
  g.fillStyle = '#e9cc85';
  g.fillRect(px - 1, y - 26, 4, 2);
  const x0 = dir > 0 ? px + 2 : px;
  for (let i = 0; i < 6; i++) {
    const wave = Math.round(Math.sin(t * 6 + phase - i * .8) * 1.5 * (i / 5));
    g.fillStyle = i === 2 || i === 3 ? '#b5382d' : '#9d3028';
    g.fillRect(x0 + dir * (i * 2) - (dir < 0 ? 2 : 0), y - 23 + wave, 2, 9);
    if (i >= 1 && i <= 3) { g.fillStyle = '#e9cc85'; g.fillRect(x0 + dir * (i * 2) - (dir < 0 ? 2 : 0), y - 20 + wave, 2, 2); }
  }
}
