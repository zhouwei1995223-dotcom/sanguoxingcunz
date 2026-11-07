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

  /** 平台异步初始化（如小红书 Storage 预读、窗口信息）；加载页读档前等待它（最多 3 秒） */
  readonly ready?: Promise<unknown>;

  getItem(key: string): string | null;
  setItem(key: string, value: string): void;

  createSound(path: string, loop: boolean): SoundHandle;

  vibrateShort(): void;
  vibrateLong(): void;

  /** 激励视频，返回是否完整观看 */
  showRewardedAd(placement: string): Promise<boolean>;
  showInterstitialAd(): void;

  share(title: string, query?: string, imageUrl?: string): void;
  onShow(cb: () => void): void;
  onHide(cb: () => void): void;

  /** 抖音侧边栏复访；其他平台返回 false */
  supportsSidebar(): boolean;
  isFromSidebar(): boolean;
  navigateToSidebar(): void;

  /** 添加到桌面 / 我的小程序 */
  supportsAddShortcut(): boolean;
  /** 微信游戏圈（页面管理器打开游戏圈链接） */
  supportsGameClub(): boolean;
  openGameClub(): Promise<boolean>;
  /** 客服会话（微信 wx.openCustomerServiceConversation），sessionFrom 透传给客服，最长 1000 字节 */
  supportsCustomerService(): boolean;
  openCustomerService(sessionFrom: string): Promise<boolean>;
  /** 微信小游戏推荐组件（评价与推荐）：返回玩家关闭时是否推荐了（拿不到时为 null） */
  /** 本次启动来源：广告点进来的返回 'ad'，否则 's' + 场景值（网页版 'web'） */
  launchSource(): string;
  supportsRecommend(): boolean;
  /** 提前加载推荐组件（进主界面时调用，点按钮时就能直接展示） */
  preloadRecommend(): void;
  /** 返回 true / false（是否推荐了）、null（拿不到结果），出错时返回错误信息字符串 */
  showRecommend(): Promise<boolean | null | string>;
  /** 游戏更新提醒（系统订阅消息 SYS_MSG_TYPE_WHATS_NEW，订阅一次永久有效，版本发布后平台自动推送） */
  supportsUpdateNotice(): boolean;
  updateNoticeState(): Promise<'accept' | 'reject' | 'none'>;
  /** 必须在点击里调用（ui.tapNow）。返回 accept / reject / ban，失败时返回错误信息 */
  requestUpdateNotice(): Promise<string>;
  addShortcut(): Promise<boolean>;

  /** 排行榜 */
  submitScore(key: string, value: number): void;
  /** 调用涉及个人信息的接口（好友排行）前确认用户已同意平台的《用户隐私保护指引》；没同意过时平台会弹出统一的隐私授权弹窗 */
  requirePrivacy(): Promise<boolean>;
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
  /** 监听未捕获的错误 */
  onError(cb: (msg: string) => void): void;
  /** 写一条错误日志（微信：后台「运维中心 → 实时日志」可查，无需配置） */
  logError(msg: string): void;

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
