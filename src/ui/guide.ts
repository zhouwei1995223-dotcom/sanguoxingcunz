import { C, UI } from './ui';

// 新手引导：文字提示 + 手指指向

export function guideHint(ui: UI, text: string, y: number) {
  const u = ui.u;
  const w = Math.min(ui.W - 60 * u, ui.measure(text, 28) + 80 * u);
  const a = 0.85 + 0.15 * Math.sin(ui.time * 4);
  ui.ctx.globalAlpha = a;
  ui.pixRect(ui.W / 2 - w / 2, y - 40 * u, w, 80 * u, 'rgba(16,10,12,0.82)');
  ui.ctx.fillStyle = C.gold;
  ui.ctx.fillRect(ui.W / 2 - w / 2 + 8 * u, y - 40 * u, w - 16 * u, 3 * u);
  ui.text(text, ui.W / 2, y, 28, '#fff4d6', 'center', null);
  ui.ctx.globalAlpha = 1;
}

/** 在矩形处画高亮框和点击手势 */
export function guidePointer(ui: UI, x: number, y: number, w: number, h: number, text?: string) {
  const u = ui.u;
  const g = ui.ctx;
  const pulse = (Math.sin(ui.time * 6) + 1) / 2;
  g.strokeStyle = C.gold;
  g.lineWidth = (4 + pulse * 3) * u;
  g.strokeRect(x - 6 * u, y - 6 * u, w + 12 * u, h + 12 * u);
  // 手指（像素风）
  const hx = x + w * 0.6, hy = y + h * 0.7 + pulse * 14 * u;
  const s = 6 * u;
  const finger = [
    '..ww....',
    '..wpw...',
    '..wpw...',
    '..wpwww.',
    'wwwpppw.',
    'wppppppw',
    '.wppppw.',
    '..wwww..',
  ];
  finger.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const c = row[rx];
      if (c === '.') continue;
      g.fillStyle = c === 'w' ? '#181425' : '#ead4aa';
      g.fillRect(hx + rx * s, hy + ry * s, s, s);
    }
  });
  if (text) {
    const ty = y > ui.H * 0.5 ? y - 70 * u : y + h + 90 * u;
    guideHint(ui, text, ty);
  }
}
