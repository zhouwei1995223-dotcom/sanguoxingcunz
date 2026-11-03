// 小红书小工具发笔记 / 发评论（文档 §3.3、§3.5、§3.9）。
// 只在小红书包里调用。媒体先 writeTempFile，评论不能传 data: 地址。

import { getXhsBuildVersion, xhsClientAtLeast } from './xhsFollow';
import { getPlatform } from '../platform';
import { fmtTime } from '../core/math';

/** pageType photo_publish 需要客户端 9.43+ */
export const XHS_NOTE_MIN_CLIENT = 9430;
/** 发布评论需要客户端 9.49+ */
export const XHS_COMMENT_MIN_CLIENT = 9490;

export interface XhsPublishCaps {
  note: boolean;
  comment: boolean;
}

export interface XhsRunCard {
  hero: string;
  label: string;
  win: boolean;
  seconds: number;
  kills: number;
  bosses: number;
  mode: string;
  chapter: number;
}

export interface XhsPublishResult {
  ok: boolean;
  message: string;
}

interface XhsErr {
  errCode?: number;
  errMsg?: string;
}

const NONE: XhsPublishCaps = { note: false, comment: false };
let ready: XhsPublishCaps | null = null;
let pending: Promise<XhsPublishCaps> | null = null;

function miniTool(): any {
  const xhs = (window as any).xhs;
  return xhs && xhs.miniTool;
}

function clipText(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max).join('');
}

function failMessage(err: XhsErr | null, fallback: string): string {
  void err;
  return fallback;
}

/** 已经查过的能力。还没查完时是 null，按钮先不画。 */
export function peekXhsPublishCaps(): XhsPublishCaps | null {
  return ready;
}

/** 方法不存在，或版本号读到了但不够，就关掉对应按钮。版本暂时读不到时下次再查。 */
export function refreshXhsPublishCaps(): Promise<XhsPublishCaps> {
  if (ready) return Promise.resolve(ready);
  if (pending) return pending;
  pending = detectCaps().then((found) => {
    pending = null;
    if (found.keep) ready = found.caps;
    return found.caps;
  }, () => {
    pending = null;
    return NONE;
  });
  return pending;
}

async function detectCaps(): Promise<{ caps: XhsPublishCaps; keep: boolean }> {
  const api = miniTool();
  const canWrite = !!(api && typeof api.writeTempFile === 'function');
  const canNote = canWrite && typeof api.postNote === 'function';
  const canComment = canWrite && typeof api.interactionOpenApi === 'function';
  if (!canNote && !canComment) return { caps: NONE, keep: true };
  const build = await getXhsBuildVersion();
  if (!build) return { caps: NONE, keep: false };
  return {
    keep: true,
    caps: {
      note: canNote && xhsClientAtLeast(build, XHS_NOTE_MIN_CLIENT),
      comment: canComment && xhsClientAtLeast(build, XHS_COMMENT_MIN_CLIENT),
    },
  };
}

export function xhsRunCopy(card: XhsRunCard): { title: string; content: string; comment: string } {
  const headline = card.win ? `${card.hero}拿下${card.label}` : `${card.hero}坚守${card.label}`;
  const stats = card.kills > 0 || card.seconds > 0
    ? `坚守 ${fmtTime(card.seconds)}，击败敌军 ${card.kills}，斩将 ${card.bosses}。`
    : '战力碾压，免挑战直接拿下。';
  const content = [
    '《长坂单骑传》',
    `${card.hero}，${card.label}`,
    (card.win ? '这一局打赢了。' : '这一局没守住。') + stats,
    '单手拖动就能割草，点开就能玩。',
  ].join('\n');
  const boast = card.win
    ? `${card.hero}拿下${card.label}${card.kills ? '，击败' + card.kills + '人' : ''}！`
    : `${card.hero}在${card.label}斩敌${card.kills}，你能守更久吗？`;
  return { title: clipText(headline, 20), content: clipText(content, 1000), comment: clipText(boast, 80) };
}

function snapshotInfo(card: XhsRunCard): string | undefined {
  const text = JSON.stringify({
    page: 'result', mode: card.mode, chapter: card.chapter, win: card.win ? 1 : 0, kills: card.kills, hero: card.hero,
  });
  let bytes = text.length * 3;
  try { bytes = new TextEncoder().encode(text).length; } catch (e) {}
  return bytes <= 2048 ? text : undefined;
}

export function captureXhsShot(): string | null {
  try {
    const canvas = getPlatform().canvas;
    if (!canvas || typeof canvas.toDataURL !== 'function') return null;
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (e) {
    return null;
  }
}

async function writeShot(dataUrl: string): Promise<string | null> {
  const api = miniTool();
  if (!api || typeof api.writeTempFile !== 'function') return null;
  const written = await api.writeTempFile({ data: dataUrl });
  const filePath = written && written.filePath;
  return typeof filePath === 'string' && filePath ? filePath : null;
}

/** 在玩家点击里调用。成功只表示发布页打开并且玩家点了发布，不表示审核通过。 */
export async function xhsPostRunNote(dataUrl: string, card: XhsRunCard): Promise<XhsPublishResult> {
  const api = miniTool();
  if (!api || typeof api.postNote !== 'function' || typeof api.writeTempFile !== 'function') {
    return { ok: false, message: '当前版本不能发笔记' };
  }
  const copy = xhsRunCopy(card);
  try {
    const filePath = await writeShot(dataUrl);
    if (!filePath) return { ok: false, message: '战绩图没有生成' };
    await api.postNote({
      title: copy.title,
      content: copy.content,
      pageType: 'photo_publish',
      mediaInfo: { image_resources: [{ url: filePath }] },
    });
    return { ok: true, message: '已提交笔记，审核通过后才会展示' };
  } catch (err) {
    return { ok: false, message: failMessage(err as XhsErr, '笔记没有发出去，请稍后再试') };
  }
}

/** 评论图必须是 writeTempFile 的本地路径，不能传 data:。 */
export async function xhsPostRunComment(dataUrl: string, card: XhsRunCard): Promise<XhsPublishResult> {
  const api = miniTool();
  if (!api || typeof api.interactionOpenApi !== 'function' || typeof api.writeTempFile !== 'function') {
    return { ok: false, message: '当前版本不能发评论' };
  }
  const copy = xhsRunCopy(card);
  try {
    const filePath = await writeShot(dataUrl);
    if (!filePath) return { ok: false, message: '战绩图没有生成' };
    const info = snapshotInfo(card);
    const payload: Record<string, unknown> = {
      action: 'post_comment',
      content: copy.comment,
      media_bean: [{ media_type: 'image', cover_image_url: filePath }],
    };
    if (info) payload.miniToolSnapshotInfo = info;
    const result = await api.interactionOpenApi({ payload, saveToAlbum: false });
    if (result && result.routed === false) return { ok: false, message: '评论页没有打开，请稍后再试' };
    return { ok: true, message: '已打开评论页' };
  } catch (err) {
    return { ok: false, message: failMessage(err as XhsErr, '评论没有发出去，请稍后再试') };
  }
}
