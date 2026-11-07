import { getPlatform } from '../platform';
import { IS_XHS } from '../data/platformConfig';
import { getBuildVersion, atLeast, miniTool } from './xhs';

export type PublishKind = 'comment' | 'note';
export interface PublishCopy {
  title: string;
  content: string;
  comment: string;
}

const supported = { comment: false, note: false };
export let publishing = false;

export async function refreshPublishSupport() {
  if (!IS_XHS) return;
  const version = await getBuildVersion();
  const api = miniTool();
  supported.note = atLeast(version, 9430) && typeof api?.postNote === 'function';
  supported.comment = atLeast(version, 9490) && typeof api?.interactionOpenApi === 'function'
    && typeof api?.writeTempFile === 'function';
}

export function canPublish(kind: PublishKind) { return IS_XHS && supported[kind]; }

/** 评论以路由成功为准；笔记以玩家点击发布后的平台回调为准。 */
export async function publish(kind: PublishKind, copy: PublishCopy): Promise<boolean> {
  if (publishing || !canPublish(kind)) return false;
  publishing = true;
  try {
    const api = miniTool();
    const image = getPlatform().canvas.toDataURL('image/jpeg', 0.85);
    if (kind === 'note') {
      await api.postNote({
        title: Array.from(copy.title).slice(0, 20).join(''), content: copy.content,
        pageType: 'photo_publish', mediaInfo: { image_resources: [{ url: image }] },
      });
      return true;
    }
    const file = await api.writeTempFile({ data: image });
    if (!file?.filePath) return false;
    const result = await api.interactionOpenApi({
      payload: { action: 'post_comment', content: copy.comment, media_bean: [{ media_type: 'image', cover_image_url: file.filePath }] },
      saveToAlbum: false,
    });
    return result?.routed === true;
  } catch {
    return false;
  } finally {
    publishing = false;
  }
}
