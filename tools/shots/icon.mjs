// 生成小游戏头像：像素赵云 + 夕阳背景，输出 dist/icon_144.png / dist/icon_512.png
import fs from 'node:fs';
export default async function ({ page, wait }) {
  await page.waitForFunction(() => window.__game && window.__atlas && window.__game.scene && window.__game.scene.constructor.name === 'HomeScene');
  await wait(300);
  for (const S of [512, 144]) {
    const data = await page.evaluate((S) => {
      const { sprite } = window.__atlas;
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      // 夕阳天空
      const sky = g.createLinearGradient(0, 0, 0, S);
      sky.addColorStop(0, '#3a1c3a'); sky.addColorStop(0.55, '#a22633'); sky.addColorStop(0.75, '#f77622'); sky.addColorStop(1, '#feae34');
      g.fillStyle = sky; g.fillRect(0, 0, S, S);
      // 太阳
      g.fillStyle = '#fee761';
      g.beginPath(); g.arc(S * 0.72, S * 0.42, S * 0.17, 0, Math.PI * 2); g.fill();
      // 远山（像素台阶）
      g.fillStyle = '#5a2a3a';
      const step = S / 32;
      for (let x = 0; x < S; x += step) {
        const h = S * 0.18 + Math.abs(Math.sin(x / S * 5.2)) * S * 0.12;
        g.fillRect(x, S * 0.78 - h, step + 1, h + S);
      }
      // 地面
      g.fillStyle = '#3e2731'; g.fillRect(0, S * 0.8, S, S);
      // 赵云（整数倍放大保证像素清晰）
      const s = sprite('hero_zhaoyun_1');
      const k = Math.floor((S * 0.78) / Math.max(s.w, s.h));
      const w = s.w * k, h = s.h * k;
      g.drawImage(s.canvas, s.x, s.y, s.w, s.h, Math.round(S / 2 - w / 2 - S * 0.02), Math.round(S * 0.9 - h), w, h);
      return c.toDataURL('image/png');
    }, S);
    fs.writeFileSync(`dist/icon_${S}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
}
