import { game, Scene, Dialog } from '../game';
import { fmtTime } from '../core/math';
import { Marcher, TowerBattle } from '../battle/tower';
import { AID_LIMIT, ALLY_CARDS, FIELD_H, FIELD_W, TACTIC_CARDS, TOWER_MAPS, TOWERS, TowerCard, MARCH_SECONDS, GATE_HP, commandBonus } from '../data/tower';
import { HERO_BY_ID, HEROES } from '../data/heroes';
import { BOSSES } from '../data/enemies';
import { IS_WEB, IS_WX } from '../data/platformConfig';
import { getPlatform } from '../platform';
import { sprite } from '../gfx/atlas';
import { drawTerrain } from '../gfx/art/tower';
import { drawXuanTexture } from '../ui/xuanPaper';
import { C, UI } from '../ui/ui';
import { dialogFrame, rewardEntries, rewardRow } from '../ui/widgets';
import { save, markDirty, flushSave } from '../meta/save';
import { settleTower } from '../meta/run';
import { progressTask } from '../meta/ops';
import { playBgm, playSfx } from '../audio/sound';
import { HomeScene } from './homeScene';

const INK = '#30291f', MUTED = '#6a5842', RED = '#a02f24', GREEN = '#365c43';
const VIDEO = IS_WEB || IS_WX;

export class TowerStageDialog implements Dialog {
  t?: number;
  draw(ui: UI) {
    const u = ui.u, g = ui.ctx;
    const f = dialogFrame(ui, 660 * u, 690 * u, '布阵选关', this.t, 'td_list_close');
    if (f.close) return false;
    for (const [i, map] of TOWER_MAPS.entries()) {
      const x = f.x + 30 * u, y = f.y + (94 + i * 185) * u, w = 600 * u, h = 163 * u;
      const open = map.id <= save.tower.cleared + 1;
      ui.panel(x, y, w, h, 'paper');
      g.fillStyle = open ? '#c4c9a0' : '#c9bfaa';
      g.fillRect(x + 12 * u, y + 13 * u, 138 * u, h - 26 * u);
      g.lineWidth = 5 * u;
      g.strokeStyle = open ? GREEN : MUTED;
      for (const road of map.routes) {
        g.beginPath();
        road.forEach(([px, py], j) => {
          const sx = x + (20 + px / FIELD_W * 120) * u, sy = y + (20 + py / FIELD_H * 121) * u;
          if (j) g.lineTo(sx, sy); else g.moveTo(sx, sy);
        });
        g.stroke();
      }
      ui.text(`第 ${map.id} 关　${map.name}`, x + 177 * u, y + 49 * u, 32, C.text, 'left');
      ui.text(open ? ['单路回折', '双渡汇流', '两翼夹击'][i] : `通关第 ${i} 关解锁`, x + 177 * u, y + 111 * u, 23, C.textDim, 'left');
      const stars = save.tower.stars[map.id] || 0;
      ui.text('★'.repeat(stars) + '☆'.repeat(3 - stars), x + w - 17 * u, y + 111 * u, 24, C.gold, 'right');
      if (ui.clicked('td_map_' + map.id, x, y, w, h)) {
        save.tower.selected = map.id;
        markDirty();
        return false;
      }
    }
    ui.text('零漏怪得三星，漏过五名以内得二星', ui.W / 2, f.y + 659 * u, 22, C.textDim);
  }
}

export function towerCommander() {
  const id = save.tower.commander || save.hero;
  return HERO_BY_ID[id] && save.heroes[id]?.owned ? id : 'zhaoyun';
}
export class CommanderDialog implements Dialog {
  t?: number;
  draw(ui: UI) {
    const heroes = HEROES.filter(h => save.heroes[h.id]?.owned), u = ui.u;
    const f = dialogFrame(ui, 666 * u, (178 + Math.ceil(heroes.length / 2) * 86) * u, '选择将令', this.t, 'td_hero_close');
    if (f.close) return false;
    ui.text('提升攻击塔伤害与战鼓助速，最高 15%', ui.W / 2, f.y + 73 * u, 22, C.textDim);
    heroes.forEach((h, i) => {
      const hero = save.heroes[h.id], pct = Math.round(commandBonus(hero.lv, hero.star, hero.peak || 0) * 100);
      if (ui.button('td_hero_' + h.id, f.x + (29 + i % 2 * 308) * u, f.y + (110 + Math.floor(i / 2) * 86) * u, 298 * u, 78 * u, h.name,
        towerCommander() === h.id ? C.btnRed : C.btnGray, { icon: 'hero_' + h.id + '_0', size: 25, sub: `全塔加成 +${pct}%` })) {
        save.tower.commander = h.id;
        markDirty();
        flushSave(true);
        this.closed = true;
      }
    });
    if (this.closed) return false;
  }
  closed = false;
}

function stamp(g: CanvasRenderingContext2D, name: string, x: number, bottom: number, size: number, heightRatio = 1) {
  const s = sprite(name), k = size / Math.max(s.w, s.h);
  const w = Math.round(s.w * k), h = Math.round(s.h * k * heightRatio);
  g.drawImage(s.canvas, s.x, s.y, s.w, s.h, Math.round(x - w / 2), Math.round(bottom - h), w, h);
}

export class TowerScene implements Scene {
  readonly paperTheme = true;
  readonly battle: TowerBattle;
  private terrain!: HTMLCanvasElement;
  private speed = 1;
  private paused = false;
  private busy = false;
  private result?: ReturnType<typeof settleTower>;
  private doubled = false;
  private aiming = false;
  private accumulator = 0;
  private readonly sdk = getPlatform();
  constructor(level: number) {
    const map = TOWER_MAPS[level - 1] || TOWER_MAPS[0], id = towerCommander(), hero = save.heroes[id];
    this.battle = new TowerBattle(map, id, commandBonus(hero.lv, hero.star, hero.peak || 0));
  }
  enter() {
    const b = this.battle;
    this.terrain = this.sdk.createCanvas(FIELD_W, FIELD_H);
    const ctx = this.terrain.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    drawTerrain(ctx, b.map, (name, x, y, size) => stamp(ctx, name, x, y, size));
    playBgm('bgm_battle');
    this.sdk.report('battle_start', { mode: 'tower', chapter: b.map.id, hero: b.hero, leaks: 0 });
  }
  onHide() { if (!this.result && !this.busy) this.paused = true; }
  private finish() {
    if (this.result) return;
    const b = this.battle;
    this.result = settleTower(b);
    flushSave(true);
    this.aiming = false;
    this.paused = false;
    playBgm(null);
    playSfx(b.phase === 'win' ? 'victory' : 'defeat');
    this.sdk.report('battle_end', { mode: 'tower', chapter: b.map.id, hero: b.hero, leaks: b.leaks, win: b.phase === 'win' ? 1 : 0, kills: b.kills, sec: Math.floor(b.elapsed) });
  }
  private async reward(kind: 'repair' | 'double' | 'aid') {
    const b = this.battle;
    if (this.busy || (kind === 'aid' && !b.canReinforce)) return;
    if (kind === 'repair' && (b.over || b.repaired || b.hp >= GATE_HP)) return;
    if (kind === 'double' && (!this.result || this.doubled)) return;
    this.busy = true;
    try {
      const ok = !VIDEO || await this.sdk.showRewardedAd('tower_' + kind);
      if (game.scene !== this || !ok) return;
      if (kind === 'aid') {
        if (!b.offerAid()) return;
        this.aiming = false;
      } else if (kind === 'repair') {
        if (!b.repair()) return;
        game.ui.toast('城门修复至 ' + b.hp + ' 点');
        playSfx('coin');
      } else {
        this.doubled = true;
        save.gold += this.result!.gold;
        save.iron += this.result!.iron;
        markDirty();
      }
      if (VIDEO) progressTask('ad', 1);
      flushSave(true);
    } catch { game.ui.toast('视频暂时不可用，请重试'); }
    finally { this.busy = false; }
  }
  update(dt: number) {
    const ui = game.ui, u = ui.u, b = this.battle, g = ui.ctx;
    if (!this.paused && !this.busy && !b.over && !b.offer) {
      this.accumulator += dt * this.speed;
      while (this.accumulator >= 1 / 30 && !b.over) {
        b.update(1 / 30);
        this.accumulator -= 1 / 30;
      }
      if (b.strikes.some(f => f.age === 0 && f.kind !== 'command')) playSfx('shoot');
    }
    if (b.over || b.offer) this.aiming = false;
    if (b.over) this.finish();
    g.fillStyle = '#e7dcc2';
    g.fillRect(0, 0, ui.W, ui.H);
    drawXuanTexture(g, 0, 0, ui.W, ui.H, u, { alpha: 0.6 });
    const compact = ui.H - ui.safeTop - ui.safeBottom < 1450 * u;
    const y = ui.safeTop + 4 * u;
    ui.text(`布阵  ·  ${b.map.name}`, 22 * u, y + 32 * u, 31, INK, 'left', null);
    const interact = !this.paused && !this.result && !this.busy && !b.offer;
    if (ui.button('td_speed', ui.W - 189 * u, y, 78 * u, 66 * u, '×' + this.speed, C.btnGray, { size: 26 }) && interact) this.speed = this.speed === 1 ? 2 : 1;
    if (ui.button('td_pause', ui.W - 103 * u, y, 82 * u, 66 * u, '暂停', C.btnGray, { size: 22 }) && interact) this.paused = true;
    const hudY = y + 70 * u, hudH = (compact ? 54 : 68) * u;
    ui.panel(8 * u, hudY, ui.W - 16 * u, hudH, 'paper');
    const hud = [['城门', b.hp + '/' + GATE_HP, b.hp <= 6 ? RED : GREEN], ['阵级', String(b.level), RED], ['用时', fmtTime(b.elapsed), INK], ['漏怪', String(b.leaks), RED]];
    hud.forEach(([label, value, col], i) => {
      const x = (24 + i * 187) * u;
      ui.text(label, x, hudY + hudH / 2, 22, MUTED, 'left', null);
      ui.text(value, x + 54 * u, hudY + hudH / 2, 31, col, 'left', null);
    });
    const actionH = (compact ? 84 : 98) * u;
    const trayY = ui.H - ui.safeBottom - actionH - 7 * u;
    const xpY = hudY + hudH + 4 * u;
    ui.bar(10 * u, xpY, ui.W - 20 * u, 12 * u, Math.min(1, b.xp / b.xpNeeded), GREEN, '#b7a789');
    const top = xpY + 17 * u;
    // 两侧只留纸边。竖向按设备可用高度排布，所有命中和射程使用同一投影。
    const x = 9 * u, fw = ui.W - 2 * x, scaleX = fw / FIELD_W;
    const room = trayY - 50 * u - top;
    const fh = Math.min(room, FIELD_H * scaleX * 1.20), scaleY = fh / FIELD_H;
    const fy = top + (room - fh) / 2;
    const mapX = (ui.px - x) / scaleX, mapY = (ui.py - fy) / scaleY;
    g.fillStyle = '#6c6149';
    g.fillRect(x - 3 * u, fy - 3 * u, fw + 6 * u, fh + 6 * u);
    g.save();
    g.translate(x, fy);
    g.scale(scaleX, scaleY);
    g.imageSmoothingEnabled = false;
    g.beginPath();
    g.rect(0, 0, FIELD_W, FIELD_H);
    g.clip();
    g.drawImage(this.terrain, 0, 0);
    this.drawUnits(g, scaleX / scaleY);
    g.restore();
    if (interact && !this.paused && this.aiming && ui.clicked('td_target', x, fy, fw, fh)) {
      if (b.cast(mapX, mapY)) playSfx('thrust');
      this.aiming = false;
    }
    this.drawActions(ui, trayY, actionH, interact && !this.paused);
    if (this.result) this.drawResult(ui);
    else if (this.paused) this.drawPause(ui);
    else if (b.offer) this.drawCards(ui);
  }

  private drawUnits(g: CanvasRenderingContext2D, heightRatio: number) {
    const b = this.battle;
    for (const f of b.oil) {
      g.fillStyle = 'rgba(179,83,35,.45)';
      g.beginPath();
      g.ellipse(f.x, f.y, f.radius, f.radius * .74, 0, 0, Math.PI * 2);
      g.fill();
      for (let j = 0; j < 3; j++) stamp(g, 'flame' + Math.floor((b.elapsed * 8 + j) % 2), f.x + (j - 1) * 8, f.y + 3 + (j % 2) * 4, 11, heightRatio);
    }
    b.map.sites.forEach(([x, y], i) => {
      const t = b.towers[i], reserve = i >= b.openSites;
      g.beginPath();
      g.ellipse(x, y, 17, 10, 0, 0, Math.PI * 2);
      g.fillStyle = reserve && !t ? '#cbb988' : '#dbccab';
      g.fill();
      g.setLineDash(t ? [] : [3, 2]);
      g.lineWidth = 1;
      g.strokeStyle = reserve ? '#946826' : '#877b61';
      g.stroke();
      g.setLineDash([]);
      if (t) {
        const size = 33 + t.level * 2;
        stamp(g, 'td_' + t.kind + t.level, x, Math.max(y + 3, size * heightRatio), size, heightRatio);
        g.fillStyle = '#443e2c';
        g.fillRect(x - 7, y + 6, 14, 4);
        g.fillStyle = '#efd27d';
        for (let j = 0; j < t.level; j++)g.fillRect(x - 5 + j * 4, y + 7, 2, 2);
      } else if (reserve) {
        stamp(g, 'icon_lock', x, y + 4, 12, heightRatio);
      }
    });
    for (const e of b.enemies) {
      const sz = this.drawEnemy(g, e, heightRatio);
      if (e.gateDamage > 1 || e.hp < e.maxHp) {
        const w = sz * .87;
        g.fillStyle = '#372b22';
        g.fillRect(e.x - w / 2, e.y - sz * heightRatio - 1, w, 3);
        g.fillStyle = e.gateDamage === 5 ? '#a52225' : '#ce702b';
        g.fillRect(e.x - w / 2 + 1, e.y - sz * heightRatio, Math.max(0, (w - 2) * e.hp / e.maxHp), 1.5);
      }
    }
    for (const e of b.fallen) this.drawEnemy(g, e, heightRatio);
    for (const a of b.allies) {
      stamp(g, 'hero_' + a.id + '_' + Math.floor(b.elapsed * 6) % 4 + (a.left ? '_L' : ''), a.x, a.y + 3, 32, heightRatio);
      g.fillStyle = '#31694c'; g.fillRect(a.x - 6, a.y + 4, 12, 2);
    }
    for (const f of b.strikes) {
      const k = f.age / f.life;
      g.save();
      g.globalAlpha = Math.max(0, 1 - k);
      if (f.kind === 'command') {
        const dragon = b.hero === 'zhaoyun';
        g.strokeStyle = dragon ? '#fff4ae' : '#f5d3ac';
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(f.tx, f.ty, f.radius * (0.55 + 0.45 * k), 0, Math.PI * 2);
        g.stroke();
        if (dragon) {
          const dx = 75 * k - 32, dy = -0.52 * dx;
          for (let i = 0; i < 7; i++) {
            const a = i * 2.4, ex = f.x + Math.cos(a) * 33, ey = f.y + Math.sin(a) * 29;
            g.strokeStyle = i % 2 ? '#287c82' : '#ffffe8';
            g.lineWidth = i % 2 ? 4 : 2;
            g.beginPath();
            g.moveTo(ex - 18 + dx, ey + 10 + dy);
            g.lineTo(ex + 18 + dx, ey - 9 + dy);
            g.stroke();
          }
          stamp(g, 'hero_zhaoyun_' + Math.floor(k * 12) % 4, f.x + dx, f.y + dy + 8, 33, heightRatio);
        } else {
          g.strokeStyle = '#b65e32';
          g.beginPath();
          g.arc(f.tx, f.ty, 12 + 37 * k, 0, Math.PI * 2);
          g.stroke();
        }
      } else if (f.kind === 'roar' || f.kind === 'frost' || f.kind === 'slash' || f.kind === 'deploy') {
        g.strokeStyle = f.kind === 'frost' ? '#c3f5ff' : f.kind === 'slash' || f.kind === 'deploy' ? '#b1f1a5' : '#ffd08e';
        g.lineWidth = f.kind === 'slash' ? 5 : 3;
        g.beginPath(); g.arc(f.tx, f.ty, f.radius * (.4 + .6 * k), -.8, f.kind === 'slash' ? 2.7 : Math.PI * 2 - .8); g.stroke();
      } else if (f.kind === 'lightning') {
        g.strokeStyle = '#fff1a7'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.tx + 5, f.ty - 24); g.lineTo(f.tx - 5, f.ty - 22); g.lineTo(f.tx, f.ty); g.stroke();
      } else if (f.kind === 'stone' || f.kind === 'oil') {
        stamp(g, f.kind === 'oil' ? 'pot' : 'stone', f.x + (f.tx - f.x) * k, f.y + (f.ty - f.y) * k - 17 * Math.sin(Math.PI * k), 10, heightRatio);
      } else {
        g.strokeStyle = f.kind === 'bolt' ? '#87482b' : '#fff3b7';
        g.lineWidth = f.kind === 'bolt' ? 2 : 1.2;
        g.beginPath();
        g.moveTo(f.x, f.y - 8);
        g.lineTo(f.tx, f.ty);
        g.stroke();
      }
      g.restore();
    }
  }
  private drawEnemy(g: CanvasRenderingContext2D, e: Marcher, heightRatio: number) {
    const size = e.gateDamage === 5 ? 43 : e.gateDamage === 2 ? 33 : 24;
    const pose = e.left ? (e.flash > 0 ? '_LW' : '_L') : (e.flash > 0 ? '_W' : '');
    stamp(g, 'u_' + e.sprite + '_' + Math.floor(this.battle.elapsed * 7) % 4 + pose, e.x, e.y + 3, size, heightRatio);
    return size;
  }
  private drawActions(ui: UI, y: number, h: number, interactive: boolean) {
    const b = this.battle, u = ui.u;
    const next = b.generalsSent === 0 ? 0 : 1;
    const general = BOSSES[b.map.bosses[next]].name;
    const arrives = next === 0 ? MARCH_SECONDS / 2 : MARCH_SECONDS;
    const status = this.aiming ? '点地图指定将令落点' : b.generalsSent === 2 ? '主将已出阵 · 守住城门' : general + '出阵 ' + fmtTime(Math.ceil(arrives - b.elapsed));
    ui.text(status, 20 * u, y - 24 * u, 23, GREEN, 'left', null);
    ui.text(`升级经验 ${b.xp}/${b.xpNeeded}`, ui.W - 20 * u, y - 24 * u, 22, MUTED, 'right', null);
    const hero = HERO_BY_ID[b.hero], cmd = b.hero === 'zhaoyun' ? '龙胆突阵' : '鸣金震阵';
    if (ui.button('td_command', 9 * u, y, 360 * u, h, this.aiming ? '取消选点' : cmd, C.btnRed, {
      icon: 'hero_' + hero.id + '_0', size: 25, sub: b.commandCd > 0 ? `冷却 ${Math.ceil(b.commandCd)} 秒` : '指定落点',
      disabled: b.over || b.commandCd > 0
    }) && interactive) this.aiming = !this.aiming;
    if (ui.button('td_aid', 381 * u, y, 360 * u, h, VIDEO ? '援建' : '免费援建', C.btnGold, {
      icon: VIDEO ? 'video' : 'td_arrow1', size: 25, sub: `额外塔位 ${AID_LIMIT - b.aidUsed}/${AID_LIMIT}`,
      disabled: !b.canReinforce || this.busy
    }) && interactive) void this.reward('aid');
  }

  private cardInfo(card: TowerCard) {
    const b = this.battle;
    if (card.type === 'tower') {
      const d = TOWERS[card.kind], [x, y] = b.map.sites[card.slot];
      const side = (x < 120 ? '西' : x > 200 ? '东' : '') + (y < 138 ? '北' : y > 264 ? '南' : '');
      const branch = card.branch;
      const location = (side || '中路') + (card.slot + 1) + '号';
      const action = card.level === 1 ? '新建' : branch === undefined ? '升二级' : d.branches[branch];
      return {
        label: '建筑', color: GREEN, icon: 'td_' + card.kind + card.level, name: d.name,
        action: action + ' · ' + location, desc: branch === undefined ? d.desc : d.effects[branch]
      };
    }
    if (card.type === 'ally') {
      const d = ALLY_CARDS[card.id], lv = (b.allies.find(a => a.id === card.id)?.level || 0) + 1;
      return { label: '武将', color: RED, icon: 'hero_' + card.id + '_0', name: d.name, action: lv === 1 ? '上阵 · ' + d.skill : '强化至 ' + lv + ' 级', desc: d.desc + (lv > 1 ? ' 本将技能伤害提升。' : '') };
    }
    const d = TACTIC_CARDS[card.id], lv = (b.tactics.find(t => t.id === card.id)?.level || 0) + 1;
    return { label: '特殊效果', color: '#335880', icon: d.icon, name: d.name, action: lv === 1 ? '本局生效' : '强化至 ' + lv + ' 级', desc: d.desc + (lv > 1 ? ' 效果增强。' : '') };
  }

  private drawCards(ui: UI) {
    const b = this.battle, offer = b.offer!, u = ui.u;
    ui.layer = 1; ui.dim(.65); ui.blocker('td_cards_block');
    const f = dialogFrame(ui, 724 * u, 488 * u, offer.aid ? '援建 · 解锁塔位' : '军阵升级 · Lv.' + b.level);
    ui.text(offer.aid ? '任选一座，按塔位顺序部署' : '选择一项，本局生效', ui.W / 2, f.y + 85 * u, 25, MUTED, 'center', null);
    offer.cards.forEach((card, i) => {
      const d = this.cardInfo(card), x = f.x + (17 + i * 232) * u, y = f.y + 126 * u, w = 226 * u, h = 326 * u;
      ui.panel(x, y, w, h, 'paper');
      ui.text(d.label, x + w / 2, y + 30 * u, 23, d.color, 'center', null);
      ui.icon(d.icon, x + w / 2, y + 91 * u, 71 * u);
      ui.text(d.name, x + w / 2, y + 157 * u, 31, INK, 'center', null);
      ui.text(d.action, x + w / 2, y + 201 * u, 21, d.color, 'center', null);
      ui.wrapText(d.desc, x + 12 * u, y + 228 * u, w - 24 * u, 21, INK, 1.18, 'left', null);
      if (ui.clicked('td_reward_' + i, x, y, w, h) && b.choose(card)) {
        this.aiming = false; playSfx('levelup');
        ui.toast(d.name + ' · ' + d.action);
      }
    });
    ui.layer = 0;
  }

  private drawPause(ui: UI) {
    const u = ui.u, b = this.battle;
    ui.layer = 1;
    ui.dim(.61);
    ui.blocker('td_pause_block');
    const roster = [];
    if (b.allies.length) roster.push('援将　' + b.allies.map(a => ALLY_CARDS[a.id].name + ' Lv.' + a.level).join('　'));
    if (b.tactics.length) roster.push('特效　' + b.tactics.map(t => TACTIC_CARDS[t.id].name + ' Lv.' + t.level).join('　'));
    const extra = roster.length * 38 * u;
    const f = dialogFrame(ui, 614 * u, 552 * u + extra, '暂停布阵');
    ui.text(`城门 ${b.hp}/20   ·   已漏 ${b.leaks} 个敌人`, ui.W / 2, f.y + 100 * u, 26, INK, 'center', null);
    roster.forEach((line, i) => ui.text(line, ui.W / 2, f.y + (144 + i * 38) * u, 21, MUTED, 'center', null));
    if (ui.button('td_resume', f.x + 50 * u, f.y + extra + 155 * u, 514 * u, 86 * u, '继续布阵', C.btnGreen, { disabled: this.busy })) this.paused = false;
    if (ui.button('td_repair', f.x + 50 * u, f.y + extra + 258 * u, 514 * u, 86 * u, '修复城门 +5', C.btnGold, {
      icon: VIDEO ? 'video' : undefined, sub: b.repaired ? '本局已用' : b.hp === GATE_HP ? '城门完好' : '每局一次', disabled: this.busy || b.repaired || b.hp === GATE_HP
    })) void this.reward('repair');
    if (ui.button('td_quit', f.x + 50 * u, f.y + extra + 374 * u, 514 * u, 86 * u, '撤军结算', C.btnGray, { disabled: this.busy })) {
      b.phase = 'loss';
      this.finish();
    }
    ui.layer = 0;
  }
  private drawResult(ui: UI) {
    const u = ui.u, b = this.battle, r = this.result!;
    ui.layer = 1;
    ui.dim(.68);
    ui.blocker('td_result_block');
    const f = dialogFrame(ui, 650 * u, 766 * u, b.phase === 'win' ? '守关告捷' : '布阵结束');
    const cx = ui.W / 2;
    ui.text(b.map.name, cx, f.y + 89 * u, 37, INK, 'center', null);
    ui.text('★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), cx, f.y + 153 * u, 46, RED, 'center', null);
    ui.text(`坚守 ${fmtTime(b.elapsed)}   ·   漏怪 ${b.leaks}   ·   城门 ${b.hp}/20`, cx, f.y + 222 * u, 23, MUTED, 'center', null);
    if (r.first || r.perfect) ui.text([r.first ? '首通元宝 +' + 60 * b.map.id : '', r.perfect ? '首次三星 +' + 40 * b.map.id : ''].filter(Boolean).join('   '), cx, f.y + 284 * u, 24, RED, 'center', null);
    const m = this.doubled ? 2 : 1;
    rewardRow(ui, rewardEntries({ ...r, gold: r.gold * m, iron: r.iron * m }), cx, f.y + 340 * u, 100 * u);
    if (ui.button('td_double', f.x + 72 * u, f.y + 515 * u, 506 * u, 84 * u, this.doubled ? '已双倍领取' : '双倍领取', C.btnGold, {
      icon: VIDEO ? 'video' : undefined, sub: '金币与玄铁', disabled: this.busy || this.doubled || !r.gold
    })) void this.reward('double');
    if (ui.button('td_home', f.x + 72 * u, f.y + 618 * u, 506 * u, 84 * u, '返回营地', C.btnRed, { disabled: this.busy })) {
      save.homeMode = 'tower';
      markDirty();
      game.setScene(new HomeScene());
    }
    ui.layer = 0;
  }
}
