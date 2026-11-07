import { game, Dialog } from '../game';
import type { Battle } from '../battle/battle';
import { WEB_RULES } from '../data/platformConfig';
import { SkillId, WeaponId, WEAPONS, PASSIVES, MAX_WEAPON_LV, weaponLink, weaponsForHero } from '../data/skills';
import { C, UI } from '../ui/ui';
import { dialogFrame } from '../ui/widgets';

interface PreparationView extends Pick<Battle, 'hero' | 'skillPool'> {
  coreWeapon: WeaponId | null;
  selected: readonly SkillId[];
  defense: boolean;
  preset: number;
}

/** 暂停页按实战持有情况展示；备战页按正在编辑的预设展示。 */
export class EvoTableDialog implements Dialog {
  t?: number;
  private readonly ids: WeaponId[];

  constructor(private source: Battle | PreparationView) {
    const { hero, skillPool } = source;
    this.ids = WEB_RULES || 'selected' in source ? skillPool.weapons.slice() : weaponsForHero(hero.id, source.cleared);
    const rank = (id: WeaponId) => id === source.coreWeapon ? -1 : WEAPONS[id].hero ? 0 : weaponLink(id, hero.id) ? 1 : 2;
    this.ids.sort((a, b) => rank(a) - rank(b));
    game.ui.resetScroll('evo_table');
  }

  draw(ui: UI) {
    const u = ui.u;
    const source = this.source;
    const planning = 'selected' in source;
    const defense = planning ? source.defense : WEB_RULES && !!source.def;
    const w = ui.W - 50 * u, h = Math.min(ui.H - 200 * u - ui.safeTop, 1300 * u);
    const title = planning ? `进化表 · ${source.hero.name} · 预设${source.preset}` : '进化表';
    const f = dialogFrame(ui, w, h, title, this.t, 'evo_close');
    if (f.close) return false;
    const rule = defense ? '守城武器升满级即可进化' : `武器${MAX_WEAPON_LV}级 + 对应兵法，开宝箱进化`;
    ui.text(rule, ui.W / 2, f.y + 80 * u, 22, '#9be37a');
    const rh = (planning ? 142 : 120) * u;
    const top = f.y + 110 * u, vh = h - 140 * u;
    const off = ui.beginScroll('evo_table', f.x + 20 * u, top, w - 40 * u, vh, this.ids.length * (rh + 10 * u));
    this.ids.forEach((id, i) => {
      const d = WEAPONS[id];
      const link = weaponLink(id, source.hero.id);
      const y = top + i * (rh + 10 * u) + off;
      if (y + rh < top || y > top + vh) return;
      const own = planning ? undefined : source.weapon(id);
      const hasWeapon = planning ? id === source.hero.weapon || source.selected.includes(id) : !!own;
      const hasPassive = planning ? source.selected.includes(d.evoPassive) : source.passiveLv(d.evoPassive) > 0;
      if (planning) {
        ui.ctx.fillStyle = hasWeapon ? '#f2e0c3' : '#f5ecda';
        ui.ctx.fillRect(f.x + 24 * u, y, w - 48 * u, rh);
        ui.ctx.strokeStyle = hasWeapon ? '#9d693f' : '#b3a18b';
        ui.ctx.lineWidth = Math.max(1, u);
        ui.ctx.strokeRect(f.x + 25 * u, y + u, w - 50 * u, rh - 2 * u);
      } else ui.pixRect(f.x + 24 * u, y, w - 48 * u, rh, link || d.hero ? '#4a3418' : '#2a2030');
      const isz = 84 * u, iy = y + (rh - isz) / 2 - (planning ? 8 * u : 0);
      let x = f.x + 40 * u;
      const cell = (icon: string, name: string, col: string, active: boolean) => {
        ui.qualityFrame(x, iy, isz, active ? '#feae34' : '#5a6988');
        ui.icon(icon, x + isz / 2, iy + isz / 2, isz * 0.66, active ? 1 : 0.7);
        if (name) ui.text(name, x + isz / 2, iy + isz + (planning ? 15 : 2) * u, planning ? 21 : 16, col);
        x += isz;
      };
      cell(d.icon, d.name, '#fff4d6', hasWeapon);
      if (!defense) {
        ui.text('+', x + 22 * u, iy + isz / 2, 34, C.gold);
        x += 44 * u;
        cell(PASSIVES[d.evoPassive].icon, PASSIVES[d.evoPassive].name, '#fff4d6', hasPassive);
      }
      ui.text('→', x + 26 * u, iy + isz / 2, 34, C.gold);
      x += 52 * u;
      cell(link?.icon || d.evoIcon, '', '#fff', planning ? hasWeapon && (defense || hasPassive) : !!own?.evo);
      const tx = x + 20 * u;
      ui.text(link ? link.name : d.evoName, tx, iy + 20 * u, 28, link ? '#fee761' : '#fff4d6', 'left');
      const missing = WEB_RULES && !defense && !source.skillPool.passives.includes(d.evoPassive);
      const trait = id === source.coreWeapon ? '★核心武器' : link ? '★' + source.hero.name + '专属联动' : d.hero ? '★专属武器' : '';
      const detail = !planning && missing ? '本章缺少' + PASSIVES[d.evoPassive].name
        : trait || (own?.evo ? '已进化' : own ? `已拥有 Lv.${own.lv}` : '');
      ui.text(detail, tx, iy + 60 * u, 20, link || d.hero ? '#feae34' : '#9be37a', 'left');
      if (planning) {
        let status = '';
        if (missing) status = '本章缺少' + PASSIVES[d.evoPassive].name;
        else if (hasWeapon) status = defense || hasPassive ? '预设已配齐' : '待配兵法：' + PASSIVES[d.evoPassive].name;
        else if (!defense && hasPassive) status = '兵法已选，待配武器';
        ui.text(status, tx, iy + 97 * u, 20, hasWeapon && (defense || hasPassive) && !missing ? '#9be37a' : C.textDim, 'left');
      }
    });
    ui.endScroll();
  }
}
