// 平台抽象层：游戏逻辑只依赖这里的接口，微信 / 抖音 / 浏览器各自实现。

export interface TouchPoint {
  id: number;
  x: number; // 设备像素坐标
  y: number;
}

export type TouchKind = 'start' | 'move' | 'end';

export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SoundHandle {
  play(): void;
  stop(): void;
  setVolume(v: number): void;
  destroy(): void;
}

export interface Platform {
  readonly name: 'web' | 'wx' | 'tt';
  readonly canvas: HTMLCanvasElement;
  /** 画布设备像素尺寸 */
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly safeArea: SafeArea;

  createCanvas(w: number, h: number): HTMLCanvasElement;
  onTouch(cb: (kind: TouchKind, touches: TouchPoint[]) => void): void;
  requestFrame(cb: (t: number) => void): void;
  now(): number;

  getItem(key: string): string | null;
  setItem(key: string, value: string): void;

  createSound(path: string, loop: boolean): SoundHandle;

  vibrateShort(): void;
  vibrateLong(): void;

  /** 激励视频，返回是否完整观看 */
  showRewardedAd(placement: string): Promise<boolean>;
  showInterstitialAd(): void;

  share(title: string, query?: string): void;
  onShow(cb: () => void): void;
  onHide(cb: () => void): void;

  /** 抖音侧边栏复访；其他平台返回 false */
  supportsSidebar(): boolean;
  isFromSidebar(): boolean;
  navigateToSidebar(): void;

  /** 添加到桌面 / 我的小程序 */
  supportsAddShortcut(): boolean;
  addShortcut(): Promise<boolean>;

  /** 排行榜 */
  submitScore(key: string, value: number): void;
  supportsRank(): boolean;
  /** 微信开放数据域画布，用于好友排行 */
  getSharedCanvas(): HTMLCanvasElement | null;
  postToOpenData(msg: unknown): void;
  showNativeRank(): void;

  showToast(text: string): void;
  /** 写入剪贴板等不需要；保留 */
  exit(): void;
}
