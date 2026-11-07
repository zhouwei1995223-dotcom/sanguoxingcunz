import type { Strike } from '../battle/tower';

/** 地图坐标中的战斗反馈。轨迹只读战斗时钟，暂停、选牌和倍速与命中同步。 */
export function drawMissile(g: CanvasRenderingContext2D, f: Strike) {
  const k = f.age / f.life, ice = f.kind === 'iceShard', bolt = f.kind === 'bolt';
  const dx = f.tx - f.x, dy = f.ty - f.y;
  g.translate(f.x + dx * k, f.y + dy * k - 5 * k);
  g.rotate(Math.atan2(dy - 5, dx));
  const length = bolt ? 17 : 10;
  g.globalAlpha = .44;
  g.fillStyle = ice ? '#6ad6db' : bolt ? '#d78530' : '#f7e6a5';
  g.fillRect(-length * 1.8, -1, length * 1.8, 2);
  g.globalAlpha = 1;
  g.fillStyle = ice ? '#2587b0' : '#674125';
  g.fillRect(-length, -1, length, bolt ? 3 : 2);
  g.beginPath(); g.moveTo(4, 0); g.lineTo(-3, -3); g.lineTo(ice ? -9 : -2, 0); g.lineTo(-3, 3); g.closePath();
  g.fillStyle = ice ? '#d3ffff' : '#fff4c9'; g.fill();
  if (!ice) {
    g.fillStyle = bolt ? '#b33e26' : '#e6d0a2';
    g.fillRect(-length, -2, 4, 4);
  }
}

export function drawImpact(g: CanvasRenderingContext2D, f: Strike) {
  const k = f.age / f.life, fire = f.kind === 'blast', shield = f.kind === 'breakShield';
  g.translate(f.tx, f.ty - (shield ? 9 : 0));
  g.globalAlpha = 1 - k;
  g.strokeStyle = fire ? '#ffcc57' : shield ? '#fff0a8' : '#a7855c';
  g.lineWidth = fire ? 3 : 1.5;
  g.beginPath(); g.ellipse(0, 0, 2 + f.radius * k, 2 + f.radius * k * .55, 0, 0, Math.PI * 2); g.stroke();
  const count = shield ? 5 : 8;
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count, reach = f.radius * k * (.65 + .15 * (i % 3));
    const x = Math.cos(a) * reach, y = Math.sin(a) * reach * .55 - 11 * Math.sin(Math.PI * k);
    const side = 2 + (i % 3);
    g.fillStyle = fire ? (i % 2 ? '#e36129' : '#ffd04e') : shield ? '#dcb35a' : (i % 2 ? '#8e7558' : '#d6bf95');
    g.fillRect(Math.round(x), Math.round(y), side, fire ? side + 2 : side);
  }
}

export function drawThunder(g: CanvasRenderingContext2D, f: Strike) {
  const k = f.age / f.life, dx = f.tx - f.x, dy = f.ty - f.y;
  const d = Math.hypot(dx, dy) || 1, phase = Math.floor(k * 4) * .9;
  g.beginPath(); g.moveTo(f.x, f.y);
  for (let i = 1; i < 6; i++) {
    const swing = Math.sin(i * 2.7 + phase) * Math.min(6, d / 5);
    g.lineTo(f.x + dx * i / 6 - dy / d * swing, f.y + dy * i / 6 + dx / d * swing);
  }
  g.lineTo(f.tx, f.ty);
  g.strokeStyle = f.kind === 'arc' ? '#488acb' : '#b37a36'; g.lineWidth = 4; g.stroke();
  g.strokeStyle = f.kind === 'arc' ? '#dcffff' : '#fff3ac'; g.lineWidth = 1.5; g.stroke();
}
