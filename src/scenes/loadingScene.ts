import { game, Scene } from '../game';
import { C } from '../ui/ui';
import { buildAtlas } from '../gfx/atlas';
import { initAudio, playBgm, audioPrewarmTasks } from '../audio/sound';
import { prewarmPaper } from '../ui/xuanPaper';
import { loadSave, save, flushSave } from '../meta/save';
import { onLogin } from '../meta/ops';
import { cloudPull } from '../meta/cloud';
import { GAME_INFO } from '../data/platformConfig';
import { HomeScene } from './homeScene';
import { BattleScene } from './battleScene';
import { reportDailyLogin } from '../meta/telemetry';
import { PrivacyDialog } from './homeDialogs';
import { DEBUG } from '../debug';
import { TowerScene } from './towerScene';
import { TOWER_MAPS } from '../data/tower';
import { getPlatform } from '../platform';

// 启动页：健康游戏忠告 + 资源生成

export class LoadingScene implements Scene {
  private t = 0;
  private done = false;
  private cloudWait = false;
  private restored = false;
  /** null：还没开始等；false：等待中；true：平台已就绪（或超时） */
  private platformReady: boolean | null = null;
  /** 分帧加载任务：每帧做一个，进度条按真实完成度走（原来进度条按 1.6 秒计时走满，
   *  之后显示「点击屏幕继续」但其实点了没用，要等后面的资源生成完才自动进去） */
  private tasks: (() => void)[] = [];
  private total = 0;
  private finished = 0;
  private shown = 0;

  constructor() {
    this.tasks = [
      () => {
        loadSave(); reportDailyLogin();
        // 小红书现场合成音频：读档后才知道先放哪首背景音乐；插在「生成宣纸」之后、云存档之前
        this.tasks.splice(3, 0, ...audioPrewarmTasks(save.guide === 0 ? 'bgm_battle' : 'bgm_home'));
        this.total = 1 + this.tasks.length;
      },
      () => buildAtlas(),
      () => initAudio(),
      () => prewarmPaper(game.ui.u),
      () => this.warmHome(),
      () => {
        // 云存档：等待拉取完成（最多 3 秒）再进入游戏
        this.cloudWait = true;
        cloudPull().then((restored) => {
          this.cloudWait = false;
          this.restored = restored;
          onLogin();
          flushSave(true);
        });
      },
    ];
    this.total = this.tasks.length;
  }

  update(dt: number) {
    const ui = game.ui;
    const u = ui.u;
    this.t += dt;
    // 平台异步初始化（小红书 Storage 预读、顶部按钮位置）：读档前等待，最多 3 秒
    if (this.platformReady === null) {
      const ready = getPlatform().ready;
      if (!ready) this.platformReady = true;
      else {
        this.platformReady = false;
        const done = () => {
          if (this.platformReady) return;
          this.platformReady = true;
          // 顶部避让可能更新了安全区：界面重新读取
          game.ui.safeTop = getPlatform().safeArea.top;
        };
        ready.then(done, done);
        setTimeout(done, 3000);
      }
    }

    const g = ui.ctx;
    g.fillStyle = '#120d14';
    g.fillRect(0, 0, ui.W, ui.H);
    ui.text(GAME_INFO.shortName, ui.W / 2, ui.H * 0.32, 110, '#fee761', 'center', '#7a1c24');
    ui.text('乱世幸存者', ui.W / 2, ui.H * 0.32 + 100 * u, 40, '#fff4d6');
    // 进度条按真实加载进度平滑前进；第一帧先把启动页画出来，再开始干重活
    const target = this.total ? this.finished / this.total : 1;
    this.shown = Math.min(target, this.shown + dt * 2.5);
    const loaded = this.tasks.length === 0 && !this.cloudWait;
    ui.bar(ui.W * 0.15, ui.H * 0.62, ui.W * 0.7, 26 * u, this.shown, C.gold);
    ui.text(loaded ? '即将进入…' : '整军备战中…', ui.W / 2, ui.H * 0.62 + 60 * u, 24, C.textDim);
    const lines = ['抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。', '适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。'];
    lines.forEach((l, i) => ui.text(l, ui.W / 2, ui.H - 190 * u - ui.safeBottom + i * 40 * u, 20, '#a89a86', 'center', null, false));
    ui.text(`适龄提示 ${GAME_INFO.ageRating}+`, ui.W / 2, ui.H - 100 * u - ui.safeBottom, 20, '#a89a86', 'center', null, false);
    if (this.restored) ui.text('已从云端恢复进度', ui.W / 2, ui.H * 0.62 + 100 * u, 22, '#9be37a');

    // 每帧做一个加载任务（读档要等平台就绪）
    if (this.t > 0.05 && this.tasks.length && this.platformReady) {
      const task = this.tasks.shift()!;
      task();
      this.finished++;
    }
    // 加载完、进度条走满、健康忠告至少显示 1 秒，就自动进入，不用点击
    if (loaded && this.shown >= 1 && this.t >= 1 && !this.done) {
      this.done = true;
      if (!save.agreedPrivacy) game.openDialog(new PrivacyDialog(() => this.route()));
      else this.route();
    }
  }

  /** 预建主界面并在离屏画布上画一帧：文字缓存、图标放大图、营地背景都提前生成，
   *  切到主界面的第一帧不再卡（原来这一帧要一秒左右）。只是预热，出错就跳过。 */
  private home: HomeScene | null = null;
  private warmHome() {
    if (save.guide === 0 || DEBUG.webPlaytest && DEBUG.tower) return;
    const ui = game.ui, main = ui.ctx, dialogs = game.dialogs.slice();
    const home = new HomeScene();
    try {
      const off = getPlatform().createCanvas(ui.W, ui.H);
      ui.ctx = off.getContext('2d')!;
      home.enter();
      (home as any).autoPopped = true; // 预热时不弹签到
      home.update(0);
      this.home = home;
    } catch (e) {
      this.home = null;
    } finally {
      ui.ctx = main;
      ui.discardRegions();
      game.dialogs = dialogs;
      (home as any).autoPopped = false;
    }
  }

  private route() {
    if (DEBUG.webPlaytest && Number.isInteger(DEBUG.tower) && TOWER_MAPS[DEBUG.tower - 1]) {
      save.homeMode = 'tower';
      game.setScene(new TowerScene(DEBUG.tower));
      return;
    }
    if (save.guide === 0) {
      // 新玩家直接进入一分钟的新手试炼（不消耗体力，不算通关第一章）
      game.setScene(new BattleScene(-2));
    } else {
      playBgm('bgm_home');
      game.setScene(this.home || new HomeScene());
    }
  }
}
