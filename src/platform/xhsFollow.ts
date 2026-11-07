import { miniTool, getBuildVersion, atLeast } from './xhs';
// 小红书小工具「关注作者」（文档 §3.6、§3.15）。只调用 window.xhs.miniTool，
// 不打开深链、网页或新窗口（容器禁用 window.open 和外链，§4.2）。

/** 客户端 9.51.0。buildVersion 末 3 位是编译序号，比较前要先丢掉。 */
const XHS_FOLLOW_MIN_CLIENT = 9510;

export type XhsFollowStatus = -1 | 0 | 1 | 2;
export type XhsFollowSupport = 'ok' | 'old' | 'missing';

export interface XhsFollowView {
  support: XhsFollowSupport;
  status: XhsFollowStatus;
}

interface XhsErr {
  errCode?: number;
  errMsg?: string;
  message?: string;
}

function asStatus(value: any): XhsFollowStatus {
  if (value === 0 || value === 1 || value === 2 || value === -1) return value;
  return -1;
}

/** 已关注，或当前用户就是小工具作者。只有这两种可以领奖。 */
export function xhsFollowEligible(status: number): boolean {
  return status === 1 || status === 2;
}

export function xhsFollowLabel(status: number): string {
  if (status === 0) return '未关注';
  if (status === 1) return '已关注';
  if (status === 2) return '作者本人';
  return '暂时无法获取';
}

export function xhsFollowFailText(errCode: number): string {
  if (errCode === 20002) return '已取消关注，还不能领取孙尚香';
  if (errCode === 15404) return '今日关注引导次数已达上限';
  if (errCode === 10003) return '关注确认还在进行，请稍后再试';
  return '关注没有完成，请稍后再试';
}

export async function xhsFollowSupport(): Promise<XhsFollowSupport> {
  const api = miniTool();
  if (!api || typeof api.followAuthor !== 'function' || typeof api.getFollowStatus !== 'function') return 'missing';
  const build = await getBuildVersion();
  if (!build || !atLeast(build, XHS_FOLLOW_MIN_CLIENT)) return 'old';
  return 'ok';
}

/** 查询关注关系。业务失败是 follow_status = -1，不会 reject。 */
export async function xhsGetFollowStatus(): Promise<XhsFollowStatus> {
  const api = miniTool();
  if (!api || typeof api.getFollowStatus !== 'function') return -1;
  try {
    const result = await api.getFollowStatus();
    return asStatus(result && result.follow_status);
  } catch (e) {
    return -1;
  }
}

export type XhsFollowCall =
  | { ok: true; status: XhsFollowStatus }
  | { ok: false; errCode: number; message: string };

/** 拉起平台关注确认。必须在玩家点击里调用，没有用户 id 参数。 */
export async function xhsFollowAuthor(): Promise<XhsFollowCall> {
  const api = miniTool();
  if (!api || typeof api.followAuthor !== 'function') {
    return { ok: false, errCode: 0, message: '请更新小红书 App 后再领取孙尚香' };
  }
  try {
    const result = await api.followAuthor();
    return { ok: true, status: asStatus(result && result.follow_status) };
  } catch (err) {
    const e = (err || {}) as XhsErr;
    const errCode = Number(e.errCode) || 0;
    return { ok: false, errCode, message: xhsFollowFailText(errCode) };
  }
}

/** 进主界面或打开弹窗时查一次。版本不够或没有接口时不调用关注接口。 */
export async function refreshXhsFollow(): Promise<XhsFollowView> {
  try {
    const support = await xhsFollowSupport();
    if (support !== 'ok') return { support, status: -1 };
    return { support, status: await xhsGetFollowStatus() };
  } catch (e) {
    return { support: 'missing', status: -1 };
  }
}
