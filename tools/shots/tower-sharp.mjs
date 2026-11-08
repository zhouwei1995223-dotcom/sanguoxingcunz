// 模拟手机画布（微信 / 小红书）：强制 imageSmoothingEnabled 永远为 true，截布阵战场看地图和精灵是否清晰。
// Q='?skip=1&tower=2' node tools/shot.mjs tower-sharp
export default async function ({ page, wait, shot }) {
  await page.addInitScript(() => {
    const P = CanvasRenderingContext2D.prototype;
    const d = Object.getOwnPropertyDescriptor(P, 'imageSmoothingEnabled');
    Object.defineProperty(P, 'imageSmoothingEnabled', { get() { return true; }, set() { d.set.call(this, true); } });
  });
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene?.constructor.name === 'TowerScene');
  await wait(9000);
  await shot(process.env.NAME || 'tower-sharp');
  const r = await page.evaluate(() => { const s = window.__game.scene; return { key: s.terrainKey, units: s.battle.enemies.length }; });
  console.log(JSON.stringify(r));
}
