import { save, flushSave, rolloverDaily } from '../meta/save';
import { C, UI } from '../ui/ui';
import { canPublish, publish, publishing, PublishCopy, PublishKind } from '../platform/xhsPublish';

// 旧版小红书已领的免费金匣十连计作今日第一次，第二次仍可通过笔记领取。
export function goldTenStep() {
  return save.daily.xhsGoldTenStep ?? (save.daily.chestTenAd?.gold ? 1 : 0);
}

export function drawGoldTen(ui: UI, x: number, y: number, w: number, h: number, drawTen: () => void) {
  const step = goldTenStep();
  const kind = step === 0 ? 'comment' : 'note';
  const available = canPublish(kind);
  ui.button('chest_social_gold', x, y, w, h, step >= 2 ? '今日已领' : step === 0 ? '评论十连' : '笔记十连', C.btnGold, {
    size: 24, sub: step >= 2 ? '2/2' : !available ? '客户端暂不支持' : step === 0 ? '打开评论区 · 1/2' : '发布笔记 · 2/2',
    disabled: publishing || step >= 2 || !available,
    tap: async () => {
      rolloverDaily();
      const day = save.daily.day;
      if (publishing || goldTenStep() !== step) return;
      const ok = await publish(kind, { title: '长坂单骑传 · 名将宝匣', content: '我在《长坂单骑传》开名将宝匣。', comment: '来开名将宝匣了！' });
      if (!ok) { ui.toast('本次未领取，可重试'); return; }
      rolloverDaily();
      if (save.daily.day !== day || goldTenStep() !== step) return;
      save.daily.xhsGoldTenStep = step + 1;
      drawTen(); // 与十份奖励一同落盘
    },
  });
}

export function hasResultPublish() { return canPublish('note') || canPublish('comment'); }

export function drawResultPublish(ui: UI, prefix: string, x: number, y: number, w: number, copy: PublishCopy) {
  const kinds = (['note', 'comment'] as PublishKind[]).filter(canPublish);
  const gap = 16 * ui.u;
  const width = kinds.length === 2 ? (w - gap) / 2 : w;
  kinds.forEach((kind, i) => {
    const note = kind === 'note';
    const key = note ? 'xhsNoteReward' : 'xhsCommentReward';
    const amount = note ? 3000 : 1000;
    ui.button(prefix + '_' + kind, x + i * (width + gap), y, width, 80 * ui.u, note ? '发笔记' : '发评论', note ? C.btnBlue : C.btnGreen, {
      size: 24, sub: save.daily[key] ? '今日已领' : amount + '元宝', disabled: publishing,
      tap: async () => {
        if (publishing) return;
        rolloverDaily();
        const day = save.daily.day;
        if (!await publish(kind, copy)) { ui.toast('未完成，可重试'); return; }
        rolloverDaily();
        if (save.daily.day !== day || save.daily[key]) return;
        save.daily[key] = true;
        save.yuanbao += amount;
        flushSave(true);
        ui.toast((note ? '笔记已提交' : '已打开评论区') + '，元宝+' + amount);
      },
    });
  });
}

/** 天机签结算专属：发一篇笔记领 3000 元宝，每人只能领一次（2026-11-08 用户要求） */
export const TIANJI_NOTE_YB = 3000;
export function tianjiNoteAvailable() { return canPublish('note') && !save.xhsTianjiNote; }
export function drawTianjiNote(ui: UI, x: number, y: number, w: number, copy: PublishCopy) {
  ui.button('res_tj_note', x, y, w, 80 * ui.u, '发天机笔记', C.btnRed, {
    size: 26, sub: `领 ${TIANJI_NOTE_YB} 元宝 · 每人一次`, disabled: publishing,
    tap: async () => {
      if (publishing || save.xhsTianjiNote) return;
      if (!await publish('note', copy)) { ui.toast('未完成，可重试'); return; }
      if (save.xhsTianjiNote) return;
      save.xhsTianjiNote = true;
      save.yuanbao += TIANJI_NOTE_YB;
      flushSave(true);
      ui.toast(`笔记已提交，元宝+${TIANJI_NOTE_YB}`);
    },
  });
}
