import { getPlatform } from './platform';
import { game } from './game';
import { LoadingScene } from './scenes/loadingScene';
import { flushSave } from './meta/save';
import { unlockAudio } from './audio/sound';

// 入口：微信 / 抖音的 game.js 与浏览器 index.html 共用

const p = getPlatform();
game.start(new LoadingScene());

// 定期与切后台时保存
setInterval(() => flushSave(), 3000);
p.onHide(() => flushSave(true));

// 浏览器需要用户手势后才能播放声音
let unlocked = false;
p.onTouch((k) => {
  if (!unlocked && k === 'end') { unlocked = true; unlockAudio(); }
});

// 浏览器下暴露给自动化测试
if (p.name === 'web') {
  (window as any).__game = game;
  import('./meta/save').then((m) => { (window as any).__saveMod = m; });
}
