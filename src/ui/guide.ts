import { C, UI } from './ui';

// 新手引导：文字提示 + 手指指向

export function guideHint(ui: UI, text: string, y: number) {
  const u = ui.u;
  const w = Math.min(ui.W - 50 * u, ui.measure(text, 26) + 88 * u);
  const a = 0.88 + 0.12 * Math.sin(ui.time * 4);
  const ctx = ui.ctx;
  ctx.save();
  ctx.globalAlpha = a;
  if (!ui.paperTheme) {
    ui.pixRect(ui.W / 2 - w / 2, y - 40 * u, w, 80 * u, 'rgba(16,10,12,0.82)');
    ctx.fillStyle = C.gold;
    ctx.fillRect(ui.W / 2 - w / 2 + 8 * u, y - 40 * u, w - 16 * u, 3 * u);
    ui.text(text, ui.W / 2, y, 28, '#fff4d6', 'center', null);
  } else {
    const h = 68 * u;
    const x = ui.W / 2 - w / 2;
    const top = y - h / 2;
    const c = Math.max(2, Math.round(u * 2.5));
    ui.pixRect(x, top + 4 * u, w, h, 'rgba(18,12,8,0.36)', c);
    ui.pixRect(x, top, w, h, '#2b2119', c);
    ui.pixRect(x + 2 * u, top + 2 * u, w - 4 * u, h - 4 * u, '#f9f1df', Math.max(1, c - 1));
    ctx.strokeStyle = '#b5281f';
    ctx.lineWidth = Math.max(1.2, u * 1.4);
    ctx.strokeRect(x + 6 * u, top + 6 * u, w - 12 * u, h - 12 * u);
    // 白底提示框里一律用墨字，不加深色描边（战斗里原来白字加描边，糊成一团）。
    ui.text(text, ui.W / 2, y, 25, '#1e1814', 'center', null);
  }
  ctx.restore();
}

/** 在矩形处画高亮框和点击手势 */
export function guidePointer(ui: UI, x: number, y: number, w: number, h: number, text?: string) {
  const u = ui.u;
  const g = ui.ctx;
  const pulse = (Math.sin(ui.time * 6) + 1) / 2;
  g.strokeStyle = ui.paperTheme ? '#b8281e' : C.gold;
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
