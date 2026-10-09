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

  // —— 云存档（微信云开发 / 抖音云）——
  cloudReady(): boolean;
  cloudLoad(): Promise<{ data: string; updatedAt: number } | null>;
  cloudSave(data: string, updatedAt: number): Promise<boolean>;

  /** 数据埋点（需在平台后台配置同名事件） */
  report(event: string, data: Record<string, string | number>): void;

  // —— 录屏（抖音）——
  supportsRecorder(): boolean;
  recorderStart(): void;
  /** 标记精彩片段（大招、击杀首领） */
  recorderMark(): void;
  /** 结束录制并返回视频路径（无录屏能力时返回 null） */
  recorderStop(): Promise<string | null>;
  shareVideo(videoPath: string, title: string): Promise<boolean>;

  /** 弹出文本输入（兑换码） */
  inputText(title: string): Promise<string | null>;

  /** 订阅消息（体力回满 / 巡营满仓提醒），返回用户是否同意 */
  requestSubscribe(): Promise<boolean>;
  /** 登记一次提醒（由云函数在指定时间推送） */
  scheduleReminder(kind: string, at: number): void;
  /** 写入剪贴板等不需要；保留 */
  exit(): void;
}
