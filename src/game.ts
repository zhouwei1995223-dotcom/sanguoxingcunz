import { getPlatform } from './platform';
import type { TouchKind, TouchPoint } from './platform/types';
import { UI } from './ui/ui';

// 全局游戏对象：场景切换、弹窗栈、主循环

export interface Scene {
  enter?(): void;
  exit?(): void;
  update(dt: number): void;
  onTouch?(kind: TouchKind, touches: TouchPoint[]): void;
}

export interface Dialog {
  /** 返回 false 表示关闭 */
  draw(ui: UI, dt: number): boolean | void;
  /** 是否在弹出时压暗背景 */
  noDim?: boolean;
  closed?: boolean;
  t?: number;
}

class Game {
  ui!: UI;
  ctx!: CanvasRenderingContext2D;
  scene: Scene | null = null;
  dialogs: Dialog[] = [];
  private last = 0;
  private nextScene: Scene | null = null;
  fade = 0;

  start(first: Scene) {
    const p = getPlatform();
    this.ctx = p.canvas.getContext('2d')!;
    this.ui = new UI(this.ctx, p.width, p.height);
    p.onTouch((k, t) => {
      this.ui.onTouch(k, t);
      if (!this.dialogs.length && this.scene && this.scene.onTouch) this.scene.onTouch(k, t);
      else if (this.scene && this.scene.onTouch && k === 'end') this.scene.onTouch(k, t);
    });
    this.setScene(first);
    this.last = p.now();
    const loop = () => {
      const now = p.now();
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1;
      if (dt < 0) dt = 0;
      this.frame(dt);
      p.requestFrame(loop);
    };
    p.requestFrame(loop);
  }

  setScene(s: Scene) {
    this.nextScene = s;
  }

  openDialog(d: Dialog) {
    d.t = 0;
    this.dialogs.push(d);
  }

  closeAll() {
    this.dialogs.length = 0;
  }

  private frame(dt: number) {
    if (this.nextScene) {
      if (this.scene && this.scene.exit) this.scene.exit();
      this.scene = this.nextScene;
      this.nextScene = null;
      this.dialogs.length = 0;
      this.fade = 1;
      if (this.scene.enter) this.scene.enter();
    }
    const ui = this.ui;
    ui.begin(dt);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.scene) this.scene.update(dt);
    for (let i = 0; i < this.dialogs.length; i++) {
      const d = this.dialogs[i];
      ui.layer = i + 1;
      d.t = (d.t || 0) + dt;
      if (!d.noDim) ui.dim(Math.min(0.65, (d.t || 0) * 4));
      ui.blocker('dlg_block_' + i);
      const r = d.draw(ui, dt);
      if (r === false) d.closed = true;
    }
    this.dialogs = this.dialogs.filter((d) => !d.closed);
    ui.layer = 99;
    if (this.fade > 0) {
      this.ctx.fillStyle = `rgba(0,0,0,${this.fade})`;
      this.ctx.fillRect(0, 0, ui.W, ui.H);
      this.fade = Math.max(0, this.fade - dt * 4);
    }
    ui.end();
  }
}

export const game = new Game();
