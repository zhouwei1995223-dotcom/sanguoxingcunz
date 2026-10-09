import { game, Scene } from '../game';
import { C } from '../ui/ui';
import { buildAtlas } from '../gfx/atlas';
import { initAudio, playBgm } from '../audio/sound';
import { loadSave, save, flushSave } from '../meta/save';
import { onLogin } from '../meta/ops';
import { cloudPull } from '../meta/cloud';
import { GAME_INFO } from '../data/platformConfig';
import { HomeScene } from './homeScene';
import { BattleScene } from './battleScene';
import { PrivacyDialog } from './homeDialogs';

// 启动页：健康游戏忠告 + 资源生成

export class LoadingScene implements Scene {
  private t = 0;
  private step = 0;
  private done = false;
  private cloudWait = false;
  private restored = false;

  update(dt: number) {
    const ui = game.ui;
    const u = ui.u;
    this.t += dt;
    // 分帧初始化，先画出启动页
    if (this.step === 1) { loadSave(); }
    if (this.step === 2) { buildAtlas(); }
    if (this.step === 3) {
      initAudio();
      // 云存档：等待拉取完成（最多 3 秒）再进入游戏
      this.cloudWait = true;
      cloudPull().then((restored) => {
        this.cloudWait = false;
        this.restored = restored;
        onLogin();
        flushSave(true);
      });
    }
    this.step++;

    const g = ui.ctx;
    g.fillStyle = '#120d14';
    g.fillRect(0, 0, ui.W, ui.H);
    ui.text(GAME_INFO.shortName, ui.W / 2, ui.H * 0.32, 110, '#fee761', 'center', '#7a1c24');
    ui.text('三国幸存者', ui.W / 2, ui.H * 0.32 + 100 * u, 40, '#fff4d6');
    const prog = Math.min(1, this.t / 1.6);
    ui.bar(ui.W * 0.15, ui.H * 0.62, ui.W * 0.7, 26 * u, prog, C.gold);
    ui.text(prog < 1 ? '整军备战中…' : '点击屏幕继续', ui.W / 2, ui.H * 0.62 + 60 * u, 24, C.textDim);
    const lines = ['抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。', '适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。'];
    lines.forEach((l, i) => ui.text(l, ui.W / 2, ui.H - 190 * u - ui.safeBottom + i * 40 * u, 20, '#a89a86', 'center', null, false));
    ui.text(`适龄提示 ${GAME_INFO.ageRating}+`, ui.W / 2, ui.H - 100 * u - ui.safeBottom, 20, '#a89a86', 'center', null, false);

    if (this.restored) ui.text('已从云端恢复进度', ui.W / 2, ui.H * 0.62 + 100 * u, 22, '#9be37a');
    if (prog >= 1 && !this.done && this.step > 4 && !this.cloudWait) {
      this.done = true;
      if (!save.agreedPrivacy) game.openDialog(new PrivacyDialog(() => this.route()));
      else this.route();
    }
  }

  private route() {
    if (save.guide === 0) {
      // 新玩家直接进入第一章教学战斗（不消耗体力）
      game.setScene(new BattleScene(1));
    } else {
      playBgm('bgm_home');
      game.setScene(new HomeScene());
    }
  }
}
