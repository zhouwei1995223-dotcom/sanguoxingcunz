import { Dialog, game } from '../game';
import type { Battle } from '../battle/battle';
import type { DamageSource } from '../battle/entities';
import { fmtNum, fmtTime } from '../core/math';
import { WEAPONS, weaponLink, WeaponId } from '../data/skills';
import { UI } from '../ui/ui';
import { dialogFrame } from '../ui/widgets';

const sourceNames = {
  ultimate: '武将大招', strategy: '锦囊妙计', allies: '守军与城防', bomb: '震天雷', other: '其他伤害',
} satisfies Record<Exclude<DamageSource, WeaponId>, string>;

interface DamageRow {
  name: string;
  isWeapon: boolean;
  total: number;
  boss: number;
}

/** 战斗结束时生成一次快照，反复打开战报不会重新结算奖励。 */
export class DamageReportDialog implements Dialog {
  t?: number;
  closed?: boolean;
  readonly seconds: number;
  readonly total: number;
  readonly dps: number;
  readonly bossStatus: string;
  readonly bestWeapon?: DamageRow;
  private rows: DamageRow[];
  private bossKills: number;
  private hasBoss: boolean;

  constructor(b: Battle) {
    this.bossKills = b.bossKills;
    this.seconds = Math.max(0, b.t - b.skippedSeconds);
    this.hasBoss = !!b.finalBoss || b.finalBossSec >= 0;
    this.bossStatus = b.finalBoss
      ? `最终主将剩余生命 ${Math.ceil(Math.max(0, b.finalBoss.hp) / b.finalBoss.maxHp * 100)}%`
      : b.finalBossSec >= 0 ? `最终主将已击败 · 用时 ${fmtTime(Math.ceil(b.finalBossSec))}` : b.chapter.endless ? '' : '最终主将尚未登场';
    const ids = new Set<DamageSource>([...b.weapons.map(w => w.id), ...b.damageBySource.keys()]);
    this.rows = Array.from(ids, id => {
      const w = b.weapon(id as WeaponId);
      const value = b.damageBySource.get(id);
      let name: string;
      if (w) {
        const d = WEAPONS[w.id];
        name = w.evo ? weaponLink(w.id, b.hero.id)?.name || d.evoName : d.name;
      } else {
        name = sourceNames[id as keyof typeof sourceNames] || WEAPONS[id as WeaponId]?.name || '其他伤害';
      }
      return { name, isWeapon: !!w, total: value?.total || 0, boss: value?.boss || 0 };
    }).sort((a, c) => c.total - a.total);
    this.bestWeapon = this.rows.filter(r => r.isWeapon && r.boss > 0).sort((a, c) => c.boss - a.boss)[0];
    this.total = this.rows.reduce((sum, r) => sum + r.total, 0);
    this.dps = this.seconds > 0 ? this.total / this.seconds : 0;
  }

  open() {
    this.closed = false;
    game.ui.resetScroll('damage_report_rows');
    game.openDialog(this);
  }

  draw(ui: UI) {
    const u = ui.u, w = ui.W - 52 * u, rowH = 64 * u;
    const h = Math.min(ui.H - ui.safeTop - 108 * u, (482 + this.rows.length * 64) * u);
    const f = dialogFrame(ui, w, h, '输出战报', this.t, 'damage_report_close');
    if (f.close) return false;
    const cx = ui.W / 2, left = f.x + 34 * u, right = f.x + w - 34 * u;
    const ink = '#38291e', dim = '#665344', red = '#993c2b', paper = '#f5ebd8';
    ui.text(`全局 DPS  ${fmtNum(Math.round(this.dps))}`, cx, f.y + 76 * u, 34, red, 'center', paper);
    ui.text(`实战 ${fmtTime(this.seconds)}  ·  总伤害 ${fmtNum(this.total)}  ·  斩将 ${this.bossKills}`,
      cx, f.y + 126 * u, 22, dim, 'center', paper);
    if (this.bossStatus) ui.text(this.bossStatus, cx, f.y + 187 * u, 26, ink, 'center', paper);
    if (this.bestWeapon) {
      ui.text(`对主将伤害最高的武器  ${this.bestWeapon.name}`, cx, f.y + 230 * u, 22, red, 'center', paper);
    }
    let y = f.y + (this.bestWeapon ? 290 : this.bossStatus ? 252 : 200) * u;
    const dpsX = f.x + w * 0.5, totalX = f.x + w * 0.72;
    ui.text('伤害来源', left, y, 23, dim, 'left', paper);
    ui.text('DPS', dpsX, y, 23, dim, 'right', paper);
    ui.text('总伤害', totalX, y, 23, dim, 'right', paper);
    ui.text('对主将', right, y, 23, dim, 'right', paper);
    const top = y + 26 * u, bottom = f.y + h - 110 * u;
    const off = ui.beginScroll('damage_report_rows', left - 6 * u, top, right - left + 12 * u, bottom - top, rowH * this.rows.length);
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      y = top + i * rowH + off;
      if (y + rowH < top || y > bottom) continue;
      ui.pixRect(left, y, right - left, Math.max(1, u), '#c8b89b');
      const mid = y + rowH / 2;
      ui.text(row.name, left, mid, 24, ink, 'left', paper);
      ui.text(fmtNum(Math.round(this.seconds > 0 ? row.total / this.seconds : 0)), dpsX, mid, 24, red, 'right', paper);
      ui.text(fmtNum(row.total), totalX, mid, 22, ink, 'right', paper);
      ui.text(this.hasBoss ? fmtNum(row.boss) : '—', right, mid, 22, ink, 'right', paper);
    }
    ui.endScroll();
    ui.text('DPS = 有效伤害 ÷ 实战秒数，跳过的波次不计时', cx, bottom + 34 * u, 20, dim, 'center', paper);
    ui.text('只计实际扣除的生命与护盾，武器进化前后合计', cx, bottom + 68 * u, 20, dim, 'center', paper);
  }
}
