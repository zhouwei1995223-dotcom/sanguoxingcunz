import { IS_XHS } from '../data/platformConfig';
import { miniTool, getBuildVersion, atLeast } from './xhs';

// 小红书排行榜（在线文档 §3.17，内测，客户端 9.51+）：天机签「天命伤害」全员榜。
// - 分数须在 ±1,000,000 内：天命伤害动辄几亿，按「万」为单位提交（保留一位小数），同一榜内单位一致。
// - board 1 = 天机签天命伤害；period：all / month / week / day，平台按周期各留最好成绩。
// - 1005：上传时没勾「用户头像昵称授权」→ 隐藏线上榜、退回本地战绩；2002：榜单未就绪 → 退避重试，不当空榜。
// - 结果缓存 45 秒；昵称只用于展示，不存储。

export const RANK_MIN_CLIENT = 9510;
export const TIANJI_BOARD = 1;
export type RankPeriod = 'all' | 'month' | 'week' | 'day';
export interface RankRow { rank: number; score: number; nickname: string | null }
export interface RankView {
  state: 'loading' | 'ok' | 'unsupported' | 'unauthorized' | 'error';
  list: RankRow[];
  my: { status: string; rank: number | null; score: number | null } | null;
}

let support: boolean | null = null;
let unauthorized = false;
const cache: Partial<Record<RankPeriod, { at: number; view: RankView }>> = {};
const pending: Partial<Record<RankPeriod, boolean>> = {};

export async function rankSupported(): Promise<boolean> {
  if (!IS_XHS) return false;
  if (support !== null) return support && !unauthorized;
  const api = miniTool();
  support = !!api && typeof api.submitScore === 'function' && typeof api.getRankList === 'function' && atLeast(await getBuildVersion(), RANK_MIN_CLIENT);
  return support && !unauthorized;
}

/** 天命伤害 → 榜单分数（万，保留一位小数，封顶 999,999） */
export const damageToScore = (dmg: number) => Math.min(999999, Math.round(dmg / 1000) / 10);

/** 结算时提交（失败不影响结算；1005 记下来以后隐藏入口） */
export async function submitTianjiScore(dmg: number): Promise<void> {
  if (dmg <= 0 || !(await rankSupported())) return;
  try {
    await miniTool().submitScore({ board: TIANJI_BOARD, score: damageToScore(dmg) });
    for (const k in cache) delete cache[k as RankPeriod];
  } catch (e: any) {
    if (e && (e.errCode === 1005)) unauthorized = true;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 取榜单 + 本人名次；2002 时按 0.5 / 1 / 2 / 4 秒退避 */
async function fetchView(period: RankPeriod): Promise<RankView> {
  const api = miniTool();
  for (const wait of [0, 500, 1000, 2000, 4000]) {
    if (wait) await sleep(wait);
    try {
      const [list, my] = await Promise.all([
        api.getRankList({ board: TIANJI_BOARD, period }),
        typeof api.getMyRank === 'function' ? api.getMyRank({ board: TIANJI_BOARD, period }) : Promise.resolve(null),
      ]);
      const rows: RankRow[] = ((list && list.data) || []).map((r: any) => ({ rank: r.rank, score: r.score, nickname: r.nickname ?? null }));
      return { state: 'ok', list: rows, my: my ? { status: my.status, rank: my.rank ?? null, score: my.score ?? null } : null };
    } catch (e: any) {
      const code = e && e.errCode;
      if (code === 1005) { unauthorized = true; return { state: 'unauthorized', list: [], my: null }; }
      if (code !== 2002 && code !== 2008) return { state: 'error', list: [], my: null };
    }
  }
  return { state: 'error', list: [], my: null };
}

/** 界面每帧调用：有缓存（45 秒内）直接用，否则后台拉取，期间返回 loading */
export function tianjiRankView(period: RankPeriod): RankView {
  if (unauthorized) return { state: 'unauthorized', list: [], my: null };
  if (support === false) return { state: 'unsupported', list: [], my: null };
  const c = cache[period];
  if (c && Date.now() - c.at < 45000) return c.view;
  if (!pending[period]) {
    pending[period] = true;
    rankSupported().then(async (ok) => {
      const view = ok ? await fetchView(period) : { state: unauthorized ? 'unauthorized' : 'unsupported', list: [], my: null } as RankView;
      cache[period] = { at: Date.now(), view };
      pending[period] = false;
    });
  }
  return c ? c.view : { state: 'loading', list: [], my: null };
}
