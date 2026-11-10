import { GLOBAL } from './core/global';
import * as saveMod from './meta/save';
import { getPlatform } from './platform';
import { game } from './game';
import { LoadingScene } from './scenes/loadingScene';
import { flushSave } from './meta/save';
import { cloudPush } from './meta/cloud';
import { initTelemetry } from './meta/telemetry';
import { unlockAudio } from './audio/sound';

// 入口：微信 / 抖音的 game.js 与浏览器 index.html 共用

const p = getPlatform();
initTelemetry();
game.start(new LoadingScene());

// 定期与切后台时保存
setInterval(() => flushSave(), 3000);
setInterval(() => cloudPush(), 60000);
p.onHide(() => { flushSave(true); cloudPush(true); });

// 浏览器需要用户手势后才能播放声音
let unlocked = false;
p.onTouch((k) => {
  if (!unlocked && k === 'end') { unlocked = true; unlockAudio(); }
});

// 浏览器下暴露给自动化测试
if (p.name === 'web') {
  (window as any).__game = game;
  import('./meta/save').then((m) => { (window as any).__saveMod = m; });
  import('./gfx/atlas').then((m) => { (window as any).__atlas = m; });
  import('./meta/ops').then((m) => { (window as any).__opsMod = m; });
  import('./ui/skin').then((m) => { (window as any).__skinStats = m.skinStats; });
  import('./data/meta').then((m) => { const w = window as any; w.__equipList = m.EQUIPS; w.__talentList = m.TALENTS; w.__maxQ = m.MAX_EQUIP_QUALITY; w.__maxLv = m.QUALITY_MAX_LV[m.MAX_EQUIP_QUALITY]; });
}
// 小游戏模拟环境（tools/mock-minigame.mjs 预先设置 __MOCK_MINIGAME）下也暴露，正式包里不会有这个标志。
if (GLOBAL.__MOCK_MINIGAME) {
  GLOBAL.__game = game;
  GLOBAL.__saveMod = saveMod;
}
if (p.name === 'web') import('./meta/cloud').then((m) => { (window as any).__cloudMod = m; });
