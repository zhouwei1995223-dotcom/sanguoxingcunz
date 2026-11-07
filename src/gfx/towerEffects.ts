import type { Strike } from '../battle/tower';

/** 地图坐标中的战斗反馈。轨迹只读战斗时钟，暂停、选牌和倍速与命中同步。 */
export function drawMissile(g: CanvasRenderingContext2D, f: Strike) {
  const k = Math.min(1, f.age / f.life), ice = f.kind === 'iceShard', bolt = f.kind === 'bolt';
  const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
  // 箭矢走低弧线：高度按正弦，朝向取轨迹切线。
  const lift = bolt ? 0 : Math.min(10, d * .09);
  const px = f.x + dx * k, py = f.y + dy * k - lift * Math.sin(Math.PI * k);
  const slope = -lift * Math.PI * Math.cos(Math.PI * k);
  if (!bolt && !ice) {
    g.save();
    g.globalAlpha = .22;
    g.fillStyle = '#2d2418';
    g.fillRect(f.x + dx * k - 2, f.y + dy * k + 2, 4, 1.5);
    g.restore();
  }
  g.translate(px, py);
  g.rotate(Math.atan2(dy + slope, dx));
  const length = bolt ? 17 : 10;
  // 拖尾：三段渐隐
  for (let i = 0; i < 3; i++) {
    g.globalAlpha = (.42 - i * .12) * (bolt ? 1.3 : 1);
    g.fillStyle = ice ? '#9ff1f5' : bolt ? '#ffb05a' : '#fff1bd';
    g.fillRect(-length - (i + 1) * length * .7, -1 + (bolt ? 0 : .5), length * .7, bolt ? 3 - i * .7 : 1.5);
  }
  g.globalAlpha = 1;
  g.fillStyle = ice ? '#2587b0' : '#674125';
  g.fillRect(-length, -1, length, bolt ? 3 : 2);
  g.beginPath(); g.moveTo(5, 0); g.lineTo(-3, -3); g.lineTo(ice ? -9 : -2, 0); g.lineTo(-3, 3); g.closePath();
  g.fillStyle = ice ? '#d3ffff' : '#fff4c9'; g.fill();
  if (!ice) {
    g.fillStyle = bolt ? '#b33e26' : '#e6d0a2';
    g.fillRect(-length, -2, 4, 4);
  }
  if (bolt) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = .55;
    g.fillStyle = '#ffcf7a';
    g.beginPath(); g.ellipse(2, 0, 6, 3, 0, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
}

export function drawImpact(g: CanvasRenderingContext2D, f: Strike) {
  const k = f.age / f.life, fire = f.kind === 'blast', shield = f.kind === 'breakShield';
  const ease = 1 - (1 - k) * (1 - k);
  g.translate(f.tx, f.ty - (shield ? 9 : 0));
  g.globalAlpha = 1 - k;
  if (fire) {
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(255,170,60,.55)';
    g.beginPath(); g.ellipse(0, -2, f.radius * (.4 + .6 * ease), f.radius * (.4 + .6 * ease) * .6, 0, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  g.strokeStyle = fire ? '#ffcc57' : shield ? '#fff0a8' : '#efe0bd';
  g.lineWidth = fire ? 3 : 2;
  g.beginPath(); g.ellipse(0, 0, 2 + f.radius * ease, 2 + f.radius * ease * .55, 0, 0, Math.PI * 2); g.stroke();
  if (!shield) {
    g.strokeStyle = fire ? '#e36129' : '#a7855c';
    g.lineWidth = 1;
    g.beginPath(); g.ellipse(0, 0, f.radius * ease * .7, f.radius * ease * .38, 0, 0, Math.PI * 2); g.stroke();
  }
  const count = shield ? 7 : 8;
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count, reach = f.radius * ease * (.65 + .15 * (i % 3));
    const x = Math.cos(a) * reach, y = Math.sin(a) * reach * .55 - 11 * Math.sin(Math.PI * k);
    const side = 2 + (i % 3);
    g.fillStyle = fire ? (i % 2 ? '#e36129' : '#ffd04e') : shield ? (i % 2 ? '#dcb35a' : '#fff3c4') : (i % 2 ? '#8e7558' : '#d6bf95');
    g.fillRect(Math.round(x), Math.round(y), side, fire ? side + 2 : side);
  }
}

/** 天雷（自天而降）与雷弧（塔间跳跃）：外层辉光、内层白芯、两条分叉。 */
export function drawThunder(g: CanvasRenderingContext2D, f: Strike) {
  const k = f.age / f.life, sky = f.kind === 'lightning';
  const sx = sky ? f.tx - 6 : f.x, sy = sky ? f.ty - 120 : f.y;
  const dx = f.tx - sx, dy = f.ty - sy, d = Math.hypot(dx, dy) || 1, phase = Math.floor(k * 5) * 1.3;
  const pts: [number, number][] = [[sx, sy]];
  const seg = sky ? 8 : 6;
  for (let i = 1; i < seg; i++) {
    const swing = Math.sin(i * 2.7 + phase) * Math.min(sky ? 9 : 6, d / 5);
    pts.push([sx + dx * i / seg - dy / d * swing, sy + dy * i / seg + dx / d * swing]);
  }
  pts.push([f.tx, f.ty]);
  const path = (list: [number, number][]) => { g.beginPath(); list.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); };
  g.lineJoin = 'round';
  g.globalCompositeOperation = 'lighter';
  path(pts);
  g.strokeStyle = sky ? 'rgba(140,190,255,.45)' : 'rgba(90,150,230,.45)'; g.lineWidth = sky ? 9 : 6; g.stroke();
  g.globalCompositeOperation = 'source-over';
  path(pts);
  g.strokeStyle = sky ? '#5a8fd8' : '#488acb'; g.lineWidth = sky ? 4 : 3; g.stroke();
  g.strokeStyle = '#f4ffff'; g.lineWidth = 1.5; g.stroke();
  if (sky) {
    for (const at of [2, 5]) {
      const [bx, by] = pts[at], side = at === 2 ? 1 : -1;
      path([[bx, by], [bx + side * 9, by + 8], [bx + side * 13, by + 18]]);
      g.strokeStyle = '#bfe0ff'; g.lineWidth = 1.2; g.stroke();
    }
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(200,230,255,.7)';
    g.beginPath(); g.ellipse(f.tx, f.ty, 11 * (1 - k * .5), 5 * (1 - k * .5), 0, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
}

/** 抛射物（礌石、火油罐）在地面的影子：越高越小越淡。 */
export function drawLobShadow(g: CanvasRenderingContext2D, x: number, y: number, h: number, size: number) {
  const s = Math.max(.35, 1 - h / 60);
  g.fillStyle = `rgba(40,30,20,${.32 * s})`;
  g.beginPath(); g.ellipse(x, y, size * .55 * s, size * .25 * s, 0, 0, Math.PI * 2); g.fill();
}
