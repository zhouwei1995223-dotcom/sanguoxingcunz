import { game, Scene, Dialog } from '../game';
import { fmtTime } from '../core/math';
import { Marcher, OilPatch, TowerBattle, TOWER_REVIVE_MAX, TOWER_REVIVE_BONUS } from '../battle/tower';
import { Point, AID_LIMIT, ALLY_CARDS, ALLY_IDS, AllyId, FIELD_H, FIELD_W, FORMATIONS, TACTIC_IDS, TACTIC_CARDS, TOWER_MAPS, TOWERS, TowerCard, GATE_HP, commandBonus } from '../data/tower';
import { HERO_BY_ID, HEROES } from '../data/heroes';
import { BOSSES } from '../data/enemies';
import { IS_WEB, IS_WX } from '../data/platformConfig';
import { getPlatform } from '../platform';
import { sprite } from '../gfx/atlas';
import { drawMissile, drawImpact, drawThunder, drawLobShadow } from '../gfx/towerEffects';
import { drawTerrain, drawSpawnFlag } from '../gfx/art/tower';
import { Death, TowerFx, arcHeight } from '../gfx/towerFx';
import { drawXuanTexture } from '../ui/xuanPaper';
import { C, UI } from '../ui/ui';
import { dialogFrame, rewardEntries, rewardRow } from '../ui/widgets';
import { save, markDirty, flushSave } from '../meta/save';
import { settleTower } from '../meta/run';
import { progressTask, computeStats } from '../meta/ops';
import { playBgm, playSfx } from '../audio/sound';
import { HomeScene } from './homeScene';

const INK = '#30291f', MUTED = '#6a5842', RED = '#a02f24', GREEN = '#365c43';
const VIDEO = IS_WEB || IS_WX;
/** 二倍速：微信版每局看一次视频解锁；网页版、小红书、TapTap 免费。 */
const SPEED_AD = IS_WX;

/** 援将强度 = 局外武将实际攻击（含等级、星级、巅峰、觉醒、装备、军略、暴击期望）÷ 一级新武将攻击。 */
export function allyPowerOf(id: AllyId) {
  const st = computeStats(id), base = HERO_BY_ID[id].baseAtk;
  const eff = st.atk * (1 + (st.dmg || 0) / 100) * (1 + (st.crit || 0) / 100 * (st.critDmg || 50) / 100);
  return Math.max(1, eff / base);
}
/** 局外武将实际攻击（显示用） */
export function allyAtkOf(id: AllyId) {
  const st = computeStats(id);
  return Math.round(st.atk * (1 + (st.dmg || 0) / 100));
}

export class TowerStageDialog implements Dialog {
  t?: number;
  draw(ui: UI) {
    const u = ui.u, g = ui.ctx;
    const rows = Math.ceil(TOWER_MAPS.length / 2);
    const f = dialogFrame(ui, 680 * u, (150 + rows * 206) * u, '布阵选关', this.t, 'td_list_close');
    if (f.close) return false;
    for (const [i, map] of TOWER_MAPS.entries()) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = f.x + (26 + col * 320) * u, y = f.y + (92 + row * 206) * u, w = 308 * u, h = 194 * u;
      const open = map.id <= save.tower.cleared + 1, chosen = save.tower.selected === map.id;
      ui.panel(x, y, w, h, 'paper');
      // 缩略舆图：纸色底 + 墨线路线
      const mx = x + 14 * u, my = y + 14 * u, mw = 92 * u, mh = 116 * u;
      g.fillStyle = open ? '#d6d2ae' : '#cdc3ad';
      g.fillRect(mx, my, mw, mh);
      g.strokeStyle = 'rgba(60,46,30,.55)'; g.lineWidth = Math.max(1, u);
      g.strokeRect(mx, my, mw, mh);
      g.lineWidth = 4 * u;
      g.lineJoin = 'round';
      g.strokeStyle = open ? GREEN : MUTED;
      for (const road of map.routes) {
        g.beginPath();
        road.forEach(([px, py], j) => {
          const sx = mx + (4 + px / FIELD_W * (mw / u - 8)) * u, sy = my + (4 + py / FIELD_H * (mh / u - 8)) * u;
          if (j) g.lineTo(sx, sy); else g.moveTo(sx, sy);
        });
        g.stroke();
      }
      ui.text(`第 ${map.id} 关`, x + 120 * u, y + 34 * u, 22, open ? RED : MUTED, 'left', null);
      ui.text(map.name, x + 120 * u, y + 72 * u, 30, open ? INK : MUTED, 'left', null);
      ui.text(open ? `${map.brief} · ${map.waves} 波` : `通关第 ${map.id - 1} 关解锁`, x + 120 * u, y + 110 * u, 20, C.textDim, 'left', null);
      const stars = save.tower.stars[map.id] || 0;
      ui.text('★'.repeat(stars) + '☆'.repeat(3 - stars), x + 14 * u, y + 162 * u, 26, C.gold, 'left', null);
      if (chosen) {
        g.strokeStyle = RED; g.lineWidth = 3 * u;
        g.strokeRect(x + 5 * u, y + 5 * u, w - 10 * u, h - 10 * u);
        ui.text('已选', x + w - 18 * u, y + 162 * u, 20, RED, 'right', null);
      }
      if (ui.clicked('td_map_' + map.id, x, y, w, h)) {
        if (!open) { ui.toast(`通关第 ${map.id - 1} 关后解锁`); continue; }
        save.tower.selected = map.id;
        markDirty();
        return false;
      }
    }
    ui.text('零漏怪得三星，漏过五名以内得二星', ui.W / 2, f.y + (120 + rows * 206) * u, 22, C.textDim);
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
  readonly fx: TowerFx;
  private quitArmed = 0;
  private speedOpen = !SPEED_AD;
  /** 城门失守后的复活倒计时 */
  private reviveLeft = 0;
  constructor(level: number) {
    const map = TOWER_MAPS[level - 1] || TOWER_MAPS[0], id = towerCommander(), hero = save.heroes[id];
    const power: Partial<Record<AllyId, number>> = {};
    for (const a of ALLY_IDS) power[a] = allyPowerOf(a);
    this.battle = new TowerBattle(map, id, commandBonus(hero.lv, hero.star, hero.peak || 0), Math.random, power);
    this.battle.fxOn = true;
    const gate = map.routes[0][map.routes[0].length - 1];
    this.fx = new TowerFx(gate, map.sites, save.settings.lowPower);
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
  /** 取走战斗事件交给特效层，并统一播放音效。 */
  private playEvents() {
    const b = this.battle, fx = this.fx;
    if (!b.events.length) return;
    let shots = false, leaked = false;
    for (const ev of b.events) {
      if (ev.t === 'fire' && ev.kind !== 'drum') shots = true;
      else if (ev.t === 'leak') leaked = true;
    }
    fx.consume(b, b.events, save.settings.dmgNum);
    if (shots) playSfx('shoot');
    for (const s of fx.sounds) playSfx(s);
    fx.sounds.clear();
    if (fx.bossArrived) {
      fx.bossArrived = false;
      if (!b.over) playBgm('bgm_boss');
    }
    if (leaked && save.settings.vibrate) this.sdk.vibrateShort();
  }
  private giveUp() {
    this.battle.quit = true;
    this.reviveLeft = 0;
    this.finish();
  }
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
  private async reward(kind: 'repair' | 'double' | 'aid' | 'speed' | 'revive') {
    const b = this.battle;
    if (this.busy || (kind === 'aid' && !b.canReinforce)) return;
    if (kind === 'revive' && !b.canRevive) return;
    if (kind === 'repair' && (b.over || b.repaired || b.hp >= GATE_HP)) return;
    if (kind === 'double' && (!this.result || this.doubled)) return;
    this.busy = true;
    try {
      const needAd = kind === 'speed' ? SPEED_AD : VIDEO;
      const ok = !needAd || await this.sdk.showRewardedAd('tower_' + kind);
      if (game.scene !== this || !ok) return;
      if (kind === 'speed') {
        this.speedOpen = true;
        this.speed = 2;
        game.ui.toast('本局已开启二倍速');
      } else if (kind === 'revive') {
        if (!b.revive()) return;
        this.reviveLeft = 0;
        playBgm('bgm_battle');
        game.ui.toast(`城门重振 · 全塔伤害 +${Math.round(b.reviveBonus * 100)}%`);
      } else if (kind === 'aid') {
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
      const adShown = kind === 'speed' ? SPEED_AD : VIDEO;
      if (adShown) progressTask('ad', 1);
      flushSave(true);
    } catch { game.ui.toast('视频暂时不可用，请重试'); }
    finally { this.busy = false; }
  }
  update(dt: number) {
    const ui = game.ui, u = ui.u, b = this.battle, g = ui.ctx;
    let simDt = 0;
    if (!this.paused && !this.busy && !b.over && !b.offer) {
      this.accumulator += dt * this.speed;
      while (this.accumulator >= 1 / 30 && !b.over && !b.offer) {
        b.update(1 / 30);
        this.accumulator -= 1 / 30;
        simDt += 1 / 30;
      }
      if (b.offer) this.accumulator = 0;
    } else if (b.over && !this.paused) {
      // 结算后让倒地、烟尘等动画自然收尾。
      simDt = dt;
    }
    this.playEvents();
    this.fx.update(simDt, b);
    this.quitArmed = Math.max(0, this.quitArmed - dt);
    if (b.over || b.offer) this.aiming = false;
    // 城门失守：还能复活时先给 10 秒决定（看视频 / 免费复活），倒计时归零或放弃再结算。
    if (b.phase === 'loss' && b.canRevive && !this.result) {
      if (this.reviveLeft <= 0 && !this.busy) this.reviveLeft = 10;
      if (!this.busy) this.reviveLeft -= dt;
      if (this.reviveLeft <= 0 && !this.busy) { this.reviveLeft = 0; this.giveUp(); }
    } else if (b.over) this.finish();
    g.fillStyle = '#e7dcc2';
    g.fillRect(0, 0, ui.W, ui.H);
    drawXuanTexture(g, 0, 0, ui.W, ui.H, u, { alpha: 0.6 });
    const compact = ui.H - ui.safeTop - ui.safeBottom < 1450 * u;
    const y = ui.safeTop + 4 * u;
    ui.text(`布阵  ·  ${b.map.name}`, 22 * u, y + 32 * u, 31, INK, 'left', null);
    const interact = !this.paused && !this.result && !this.busy && !b.offer;
    if (ui.button('td_speed', ui.W - 189 * u, y, 78 * u, 66 * u, this.speedOpen ? '×' + this.speed : '×2', this.speedOpen ? C.btnGray : C.btnGold, { size: 26, icon: this.speedOpen ? undefined : 'video' }) && interact) {
      if (this.speedOpen) this.speed = this.speed === 1 ? 2 : 1;
      else void this.reward('speed');
    }
    if (ui.button('td_pause', ui.W - 103 * u, y, 82 * u, 66 * u, '暂停', C.btnGray, { size: 22 }) && interact) this.paused = true;
    const hudY = y + 70 * u, hudH = (compact ? 54 : 68) * u;
    ui.panel(8 * u, hudY, ui.W - 16 * u, hudH, 'paper');
    const gateCol = this.fx.hudHit > 0 && Math.floor(this.fx.hudHit * 10) % 2 === 0 ? '#e0402f' : b.hp <= 6 ? RED : GREEN;
    const hud = [['城门', b.hp + '/' + GATE_HP, gateCol], ['阵级', String(b.level), RED], ['波次', `${Math.max(1, Math.min(b.waveTotal, b.waveIdx + (b.resting && b.waveIdx >= 0 ? 2 : 1)))}/${b.waveTotal}`, INK], ['漏怪', String(b.leaks), RED]];
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
    // 纵向最多拉伸 1.32 倍（单位精灵按 heightRatio 反向补偿，不会变形），尽量少留空白。
    const fh = Math.min(room, FIELD_H * scaleX * 1.32), scaleY = fh / FIELD_H;
    const fy = top + (room - fh) / 2;
    const mapX = (ui.px - x) / scaleX, mapY = (ui.py - fy) / scaleY;
    const [shx, shy] = save.settings.screenShake ? this.fx.shakeOffset : [0, 0];
    g.save();
    // 先按屏幕坐标裁剪，再整体晃动：震屏时地图边缘不会露出空隙。
    g.beginPath();
    g.rect(x, fy, fw, fh);
    g.clip();
    g.imageSmoothingEnabled = false;
    // 晃动时先垫一张不动的底图，露出的边缘看不出来。
    if (shx || shy) g.drawImage(this.terrain, x, fy, fw, fh);
    g.translate(x + shx * scaleX, fy + shy * scaleY);
    g.scale(scaleX, scaleY);
    g.drawImage(this.terrain, 0, 0);
    this.drawUnits(g, scaleX / scaleY);
    g.restore();
    g.save();
    g.beginPath(); g.rect(x, fy, fw, fh); g.clip();
    this.drawOverlay(ui, x + shx * scaleX, fy + shy * scaleY, scaleX, scaleY, fw, fh);
    g.restore();
    this.drawMapFrame(g, x, fy, fw, fh, u);
    if (interact && !this.paused && this.aiming && ui.clicked('td_target', x, fy, fw, fh)) {
      if (b.cast(mapX, mapY)) playSfx('thrust');
      this.aiming = false;
    }
    this.drawActions(ui, trayY, actionH, interact && !this.paused);
    if (this.result) this.drawResult(ui);
    else if (b.phase === 'loss' && b.canRevive) this.drawRevive(ui);
    else if (this.paused) this.drawPause(ui);
    else if (b.offer) this.drawCards(ui);
  }

  private drawUnits(g: CanvasRenderingContext2D, heightRatio: number) {
    const b = this.battle, fx = this.fx, t = fx.time;
    // 环境：云影、河面波光
    if (b.map.river) this.drawRiverGlint(g, t, b.map.river);
    fx.drawDecals(g);
    for (const f of b.oil) this.drawFire(g, f, heightRatio);
    b.map.sites.forEach(([x, y], i) => {
      const tw = b.towers[i], reserve = i >= b.openSites;
      if (tw) {
        // 底座阴影 + 三级塔的光环
        g.fillStyle = 'rgba(48,36,22,.28)';
        g.beginPath(); g.ellipse(x, y + 4, 17, 7, 0, 0, Math.PI * 2); g.fill();
        if (tw.level === 3) {
          const pulse = .5 + .5 * Math.sin(t * 3 + i);
          g.strokeStyle = tw.branch === 1 ? `rgba(120,200,255,${.35 + .3 * pulse})` : `rgba(255,214,90,${.35 + .3 * pulse})`;
          g.lineWidth = 1.5;
          g.beginPath(); g.ellipse(x, y + 2, 15 + pulse * 2, 8 + pulse, 0, 0, Math.PI * 2); g.stroke();
        }
        return;
      }
      g.beginPath();
      g.ellipse(x, y, 17, 10, 0, 0, Math.PI * 2);
      g.fillStyle = reserve ? '#cbb988' : '#dbccab';
      g.fill();
      g.setLineDash([3, 2]);
      g.lineDashOffset = reserve ? 0 : -t * 4;
      g.lineWidth = 1;
      g.strokeStyle = reserve ? '#946826' : '#877b61';
      g.stroke();
      g.setLineDash([]);
      if (reserve) stamp(g, 'icon_lock', x, y + 4, 12, heightRatio);
      else if (i === b.towers.indexOf(null)) {
        // 下一座塔落在这里：轻轻闪烁的小旗
        g.globalAlpha = .45 + .35 * Math.sin(t * 4);
        g.fillStyle = '#7a5a35'; g.fillRect(x - .5, y - 9, 1, 9);
        g.fillStyle = '#c8392b'; g.fillRect(x + .5, y - 9, 5, 3);
        g.globalAlpha = 1;
      }
    });
    fx.drawParticles(g, heightRatio, 0);
    // 按纵坐标排序：靠下的单位压住靠上的。
    const list = this.drawList;
    list.length = 0;
    b.map.sites.forEach(([, y], i) => { if (b.towers[i]) list.push({ y: y + 3, kind: 0, i }); });
    b.enemies.forEach((e, i) => list.push({ y: e.y + 3, kind: 1, i }));
    fx.deaths.forEach((d, i) => list.push({ y: d.e.y + 2, kind: 2, i }));
    b.allies.forEach((a, i) => list.push({ y: a.y + 3, kind: 3, i }));
    const gate = b.map.routes[0][b.map.routes[0].length - 1];
    list.push({ y: gate[1] + 13, kind: 4, i: 0 });
    list.sort((p, q) => p.y - q.y);
    for (const it of list) {
      if (it.kind === 0) this.drawTower(g, it.i, heightRatio);
      else if (it.kind === 1) this.drawEnemy(g, b.enemies[it.i], heightRatio);
      else if (it.kind === 2) this.drawDeath(g, fx.deaths[it.i], heightRatio);
      else if (it.kind === 3) this.drawAlly(g, it.i, heightRatio);
      else this.drawGate(g, gate[0], gate[1], heightRatio);
    }
    b.map.routes.forEach((r, i) => drawSpawnFlag(g, r[0][0], r[0][1], t, i * 2));
    for (const f of b.strikes) {
      const k = Math.min(1, f.age / f.life);
      g.save();
      g.globalAlpha = f.kind === 'stone' || f.kind === 'oil' ? 1 : Math.max(0, 1 - k);
      if (f.kind === 'command') {
        const dragon = b.hero === 'zhaoyun', ease = 1 - (1 - k) * (1 - k);
        g.fillStyle = dragon ? 'rgba(220,250,255,.18)' : 'rgba(255,230,180,.2)';
        g.beginPath(); g.arc(f.tx, f.ty, f.radius * ease, 0, Math.PI * 2); g.fill();
        g.strokeStyle = dragon ? '#fff4ae' : '#f5d3ac';
        g.lineWidth = 3.5;
        g.beginPath();
        g.arc(f.tx, f.ty, f.radius * (0.35 + 0.65 * ease), 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(f.tx, f.ty, f.radius * (0.2 + 0.5 * ease), 0, Math.PI * 2); g.stroke();
        if (dragon) {
          // 白龙从左下冲向右上，身后拖出青白龙气。
          const dx = 75 * k - 32, dy = -0.52 * dx;
          g.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 7; i++) {
            const a = i * 2.4, ex = f.x + Math.cos(a) * 33, ey = f.y + Math.sin(a) * 29;
            g.strokeStyle = i % 2 ? 'rgba(60,180,190,.8)' : 'rgba(255,255,235,.9)';
            g.lineWidth = i % 2 ? 4 : 2;
            g.beginPath();
            g.moveTo(ex - 18 + dx, ey + 10 + dy);
            g.lineTo(ex + 18 + dx, ey - 9 + dy);
            g.stroke();
          }
          g.globalCompositeOperation = 'source-over';
          stamp(g, 'hero_zhaoyun_' + Math.floor(k * 12) % 4, f.x + dx, f.y + dy + 8, 36, heightRatio);
        } else {
          g.strokeStyle = '#b65e32';
          for (const off of [0, .25]) {
            const kk = Math.min(1, k + off);
            g.globalAlpha = Math.max(0, 1 - kk);
            g.lineWidth = 3;
            g.beginPath(); g.arc(f.tx, f.ty, 12 + 55 * kk, 0, Math.PI * 2); g.stroke();
          }
        }
      } else if (f.kind === 'roar' || f.kind === 'frost' || f.kind === 'slash' || f.kind === 'deploy') {
        const ease = 1 - (1 - k) * (1 - k);
        g.strokeStyle = f.kind === 'frost' ? '#c3f5ff' : f.kind === 'slash' || f.kind === 'deploy' ? '#b1f1a5' : '#ffd08e';
        g.lineWidth = f.kind === 'slash' ? 6 : 3;
        const radius = f.radius * (.35 + .65 * ease);
        const angle = f.kind === 'slash' ? -1.6 + k * 2.5 : -.8;
        if (f.kind === 'slash') {
          // 刀光：外宽内窄的月牙
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = 'rgba(150,255,170,.5)'; g.lineWidth = 9;
          g.beginPath(); g.arc(f.tx, f.ty, radius, angle, angle + 2.6); g.stroke();
          g.globalCompositeOperation = 'source-over';
          g.strokeStyle = '#efffe0'; g.lineWidth = 3;
        }
        g.beginPath(); g.arc(f.tx, f.ty, radius, angle, angle + (f.kind === 'slash' ? 2.6 : Math.PI * 2)); g.stroke();
        if (f.kind === 'frost') {
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4 + k * .6, dx = Math.cos(a), dy = Math.sin(a);
            const x = f.tx + dx * radius, y = f.ty + dy * radius * .7;
            g.fillStyle = i % 2 ? '#dfffff' : '#81cef0';
            g.beginPath(); g.moveTo(x + dx * 7, y + dy * 7); g.lineTo(x - dy * 3, y + dx * 3);
            g.lineTo(x - dx * 5, y - dy * 5); g.lineTo(x + dy * 3, y - dx * 3); g.fill();
          }
        } else if (f.kind === 'roar') {
          for (const off of [.18, .36]) {
            g.strokeStyle = '#fff1ba'; g.lineWidth = 1.5;
            g.beginPath(); g.arc(f.tx, f.ty, radius * (1 - off), 0, Math.PI * 2); g.stroke();
          }
        } else if (f.kind === 'deploy') {
          g.strokeStyle = '#fff6c8'; g.lineWidth = 1;
          g.beginPath(); g.arc(f.tx, f.ty, radius * .7, 0, Math.PI * 2); g.stroke();
        }
      } else if (f.kind === 'lightning' || f.kind === 'arc') {
        drawThunder(g, f);
      } else if (f.kind === 'dust' || f.kind === 'blast' || f.kind === 'breakShield') {
        drawImpact(g, f);
      } else if (f.kind === 'stone' || f.kind === 'oil') {
        const h = arcHeight(f) * Math.sin(Math.PI * k);
        const gx = f.x + (f.tx - f.x) * k, gy = f.y + (f.ty - f.y) * k;
        drawLobShadow(g, gx, gy + 2, h, f.kind === 'stone' ? 14 : 11);
        g.translate(gx, gy - h - 4);
        g.rotate(k * (f.kind === 'stone' ? 9 : 12) * (f.tx < f.x ? -1 : 1));
        const size = (f.kind === 'stone' ? 12 : 11) * (1 + .25 * Math.sin(Math.PI * k));
        stamp(g, f.kind === 'oil' ? 'pot' : 'stone', 0, size / 2, size, heightRatio);
      } else if (f.kind === 'arrow' || f.kind === 'bolt' || f.kind === 'iceShard') {
        drawMissile(g, f);
      }
      g.restore();
    }
    fx.drawParticles(g, heightRatio, 1);
    // 云影缓缓掠过
    g.fillStyle = 'rgba(40,46,30,.07)';
    for (let i = 0; i < 3; i++) {
      const cx = ((t * 5 + i * 170) % 520) - 100, cy = 60 + i * 135 + Math.sin(t * .1 + i) * 10;
      g.beginPath(); g.ellipse(cx, cy, 62, 24, 0, 0, Math.PI * 2); g.ellipse(cx + 40, cy + 8, 40, 18, 0, 0, Math.PI * 2); g.fill();
    }
    if (fx.flash > 0) {
      g.fillStyle = fx.flashColor;
      g.globalAlpha = Math.min(.45, fx.flash * .55);
      g.fillRect(0, 0, FIELD_W, FIELD_H);
      g.globalAlpha = 1;
    }
    if (this.aiming) {
      g.strokeStyle = `rgba(255,214,90,${.5 + .4 * Math.sin(t * 8)})`;
      g.lineWidth = 3;
      g.strokeRect(2, 2, FIELD_W - 4, FIELD_H - 4);
    }
  }
  private readonly drawList: { y: number; kind: number; i: number }[] = [];

  /** 舆图边缘：四周晕进纸色，外加浓淡两道墨线，像画在宣纸上的军图。 */
  private drawMapFrame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number) {
    const fade = 16 * u, paper = 'rgba(231,220,194,';
    const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
      const grad = g.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, paper + '.92)');
      grad.addColorStop(.45, paper + '.35)');
      grad.addColorStop(1, paper + '0)');
      g.fillStyle = grad;
      g.fillRect(rx, ry, rw, rh);
    };
    edge(x, 0, x + fade, 0, x, y, fade, h);
    edge(x + w, 0, x + w - fade, 0, x + w - fade, y, fade, h);
    edge(0, y, 0, y + fade, x, y, w, fade);
    edge(0, y + h, 0, y + h - fade, x, y + h - fade, w, fade);
    g.strokeStyle = 'rgba(48,38,28,.85)';
    g.lineWidth = 2.5 * u;
    g.strokeRect(x - 2 * u, y - 2 * u, w + 4 * u, h + 4 * u);
    g.strokeStyle = 'rgba(48,38,28,.35)';
    g.lineWidth = 1 * u;
    g.strokeRect(x + 4 * u, y + 4 * u, w - 8 * u, h - 8 * u);
    // 四角朱红小方印角
    g.fillStyle = '#a8352a';
    for (const [cx, cy] of [[x - 2 * u, y - 2 * u], [x + w + 2 * u, y - 2 * u], [x - 2 * u, y + h + 2 * u], [x + w + 2 * u, y + h + 2 * u]]) {
      g.fillRect(cx - 4 * u, cy - 4 * u, 8 * u, 8 * u);
    }
  }

  private drawRiverGlint(g: CanvasRenderingContext2D, t: number, river: readonly Point[]) {
    g.fillStyle = 'rgba(235,250,245,.55)';
    for (let i = 0; i < 18; i++) {
      const s = ((i * .37 + t * .015) % 1) * (river.length - 1), j = Math.floor(s), f = s - j;
      const [ax, ay] = river[j], [bx, by] = river[j + 1];
      const off = Math.sin(i * 3.1) * 6, blink = Math.sin(t * 3 + i * 1.7);
      if (blink < 0) continue;
      g.globalAlpha = blink * .7;
      g.fillRect(Math.round(ax + (bx - ax) * f), Math.round(ay + (by - ay) * f + off), 4, 1);
    }
    g.globalAlpha = 1;
  }

  private drawFire(g: CanvasRenderingContext2D, f: OilPatch, heightRatio: number) {
    const t = this.fx.time, alive = f.maxLife - f.life;
    const a = Math.min(1, f.life / .45) * Math.min(1, alive / .12);
    g.save();
    g.globalAlpha = a;
    g.fillStyle = 'rgba(60,32,18,.32)';
    g.beginPath(); g.ellipse(f.x, f.y, f.radius, f.radius * .7, 0, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'lighter';
    const flick = .85 + .15 * Math.sin(t * 17 + f.x);
    g.fillStyle = 'rgba(255,120,40,.28)';
    g.beginPath(); g.ellipse(f.x, f.y - 2, f.radius * flick, f.radius * .66 * flick, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,200,80,.22)';
    g.beginPath(); g.ellipse(f.x, f.y - 2, f.radius * .55, f.radius * .36, 0, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    const n = Math.max(3, Math.round(f.radius / 5));
    for (let j = 0; j < n; j++) {
      const ang = j * 2.4 + f.x, r = f.radius * (.15 + .6 * ((j * .618) % 1));
      const fx = f.x + Math.cos(ang) * r, fy = f.y + Math.sin(ang) * r * .66;
      const s = (9 + 4 * Math.sin(t * 11 + j * 1.9)) * (.7 + .3 * a);
      stamp(g, 'flame' + Math.floor((t * 9 + j) % 2), fx, fy + 3, s, heightRatio);
    }
    g.restore();
  }

  private drawTower(g: CanvasRenderingContext2D, i: number, heightRatio: number) {
    const b = this.battle, tw = b.towers[i]!, [x, y] = b.map.sites[i], anim = this.fx.anims.get(i);
    const size = 33 + tw.level * 2;
    const age = b.elapsed - tw.firedAt, beat = (b.elapsed + i * .13) % 1.3;
    const motion = tw.kind === 'drum' ? beat : age;
    const pose = motion < .12 ? 1 : motion < .28 ? 2 : 0;
    let sx = 1, sy = 1, lift = 0;
    if (anim && anim.build < .5) {
      const k = anim.build;
      if (anim.level === 1) {
        // 新建：从空中落下，落地压扁再弹回。
        if (k < .22) { const f = 1 - k / .22; lift = 34 * f * f; sy = 1.08; sx = .94; }
        else { const f = Math.sin(Math.PI * Math.min(1, (k - .22) / .26)); sy = 1 - .16 * f; sx = 1 + .12 * f; }
      } else {
        const f = Math.sin(Math.PI * Math.min(1, k / .35));
        sx = sy = 1 + .18 * f;
      }
    } else if (anim && anim.fire < .16 && tw.kind !== 'drum') {
      const f = Math.sin(Math.PI * anim.fire / .16);
      sy = 1 - .07 * f; sx = 1 + .05 * f;
    } else if (tw.kind === 'drum' && beat < .12) {
      sy = 1 - .05 * Math.sin(Math.PI * beat / .12);
    }
    g.save(); g.translate(x, y + 3 - lift);
    if (tw.left) g.scale(-1, 1);
    g.scale(sx, sy);
    stamp(g, 'td_' + tw.kind + tw.level + (pose ? '_p' + pose : ''), 0, 0, size, heightRatio);
    if (anim && anim.level > 1 && anim.build < .3) {
      g.globalAlpha = .28 * (1 - anim.build / .3);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = '#ffe9a0';
      g.beginPath(); g.ellipse(0, -size * .45 * heightRatio, size * .45, size * .5 * heightRatio, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    if (tw.kind === 'drum' && beat < .45) {
      g.save(); g.globalAlpha = .55 * (1 - beat / .45);
      g.strokeStyle = '#f2d56e'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y, 10 + beat * 44, 5 + beat * 22, 0, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 1;
      g.beginPath(); g.ellipse(x, y, 4 + beat * 30, 2 + beat * 15, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    g.fillStyle = '#443e2c';
    g.fillRect(x - 7, y + 6, 14, 4);
    g.fillStyle = '#efd27d';
    for (let j = 0; j < tw.level; j++) g.fillRect(x - 5 + j * 4, y + 7, 2, 2);
  }

  private drawGate(g: CanvasRenderingContext2D, gx: number, gy: number, heightRatio: number) {
    const b = this.battle, hit = this.fx.gateHit;
    const shake = hit > 0 ? Math.sin(hit * 70) * 2.5 * hit / .5 : 0;
    stamp(g, 'td_gate', gx + shake, gy + 13, 48, heightRatio);
    if (hit > 0) {
      g.save();
      g.globalAlpha = hit * .8;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,70,50,.6)';
      g.beginPath(); g.ellipse(gx + shake, gy - 4, 26, 18, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // 城门血条
    const w = 34, ratio = b.hp / GATE_HP, top = gy - 36 * heightRatio;
    g.fillStyle = '#372b22'; g.fillRect(gx - w / 2 - 1, top - 1, w + 2, 5);
    g.fillStyle = ratio > .5 ? '#4f9a58' : ratio > .25 ? '#d49a2c' : '#c8392b';
    g.fillRect(gx - w / 2, top, w * ratio, 3);
  }

  private drawEnemy(g: CanvasRenderingContext2D, e: Marcher, heightRatio: number) {
    const b = this.battle, t = this.fx.time;
    const boss = e.gateDamage === 5, elite = e.gateDamage === 2;
    const size = boss ? 43 : elite ? 33 : 24;
    const traveled = b.lengths[e.route] - e.remaining;
    const moving = e.stun <= 0;
    const frame = moving ? Math.floor(traveled / 5) % 4 : 0;
    const bob = moving ? Math.abs(Math.sin(traveled * .63)) * 1.2 : 0;
    // 受击：向后小退一步
    const knock = e.flash > 0 ? (e.left ? 1.5 : -1.5) : 0;
    // 阴影
    g.fillStyle = 'rgba(40,30,20,.28)';
    g.beginPath(); g.ellipse(e.x, e.y + 3, size * .3, size * .1, 0, 0, Math.PI * 2); g.fill();
    if (boss) {
      const p = .5 + .5 * Math.sin(t * 5);
      g.strokeStyle = `rgba(210,50,40,${.45 + .35 * p})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(e.x, e.y + 3, 15 + p * 3, 6 + p, 0, 0, Math.PI * 2); g.stroke();
    } else if (elite) {
      g.strokeStyle = 'rgba(240,200,90,.55)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(e.x, e.y + 3, 11, 4, 0, 0, Math.PI * 2); g.stroke();
    }
    if (e.banner && e.stun <= 0) {
      g.save(); g.globalAlpha = .30; g.strokeStyle = '#ad561c'; g.lineWidth = 1.3;
      g.setLineDash([4, 6]); g.lineDashOffset = -b.elapsed * 8;
      g.beginPath(); g.arc(e.x, e.y, 43, 0, Math.PI * 2); g.stroke(); g.restore();
    }
    const pose = e.left ? (e.flash > 0 ? '_LW' : '_L') : (e.flash > 0 ? '_W' : '');
    stamp(g, 'u_' + e.sprite + '_' + frame + pose, e.x + knock, e.y + 3 - bob, size, heightRatio);
    if (e.banner) {
      const py = e.y - 18 * heightRatio - bob, tip = Math.sin(b.elapsed * 9) * 2;
      g.fillStyle = '#68482e'; g.fillRect(e.x + 8, py - 14, 2, 24);
      g.fillStyle = e.stun > 0 ? '#9e886a' : '#be3c27';
      g.beginPath(); g.moveTo(e.x + 10, py - 14); g.lineTo(e.x + 22, py - 12 + tip);
      g.lineTo(e.x + 17, py - 8 + tip); g.lineTo(e.x + 22, py - 5 + tip); g.lineTo(e.x + 10, py - 6); g.fill();
    }
    if (e.shield > 0) {
      const sx = e.x + (e.left ? -7 : 7), sy = e.y - 8 - bob;
      g.fillStyle = '#6a4b26'; g.fillRect(sx - 4, sy - 7, 9, 10);
      g.fillStyle = '#e6bd69'; g.fillRect(sx - 3, sy - 6, 7, 7); g.fillRect(sx - 2, sy + 1, 5, 2);
      g.fillStyle = 'rgba(255,250,210,.8)'; g.fillRect(sx - 2, sy - 5, 2, 2);
      if (e.shield < e.maxShield / 2) { g.fillStyle = '#78552b'; g.fillRect(sx, sy - 5, 1.5, 4); g.fillRect(sx - 1, sy - 1, 1.5, 3); }
    }
    const frozen = e.frozenUntil > b.elapsed;
    if (frozen) {
      // 冰块：半透明蓝色方块 + 高光
      const w = size * .55, h = size * .78 * heightRatio, top = e.y + 3 - h;
      g.fillStyle = 'rgba(170,230,255,.42)';
      g.fillRect(e.x - w / 2, top, w, h);
      g.strokeStyle = 'rgba(230,255,255,.85)'; g.lineWidth = 1;
      g.strokeRect(e.x - w / 2 + .5, top + .5, w - 1, h - 1);
      g.fillStyle = 'rgba(255,255,255,.75)';
      g.fillRect(e.x - w / 2 + 2, top + 2, 2, h * .45);
      g.fillRect(e.x - w / 2 + 2, top + 2, w * .4, 1.5);
    } else if (e.stun > 0) {
      // 眩晕：头顶三颗转圈的小星
      const hy = e.y - size * .8 * heightRatio;
      for (let j = 0; j < 3; j++) {
        const a = t * 7 + j * 2.09, sx = e.x + Math.cos(a) * 7, sy = hy + Math.sin(a) * 2.5;
        g.fillStyle = Math.sin(a) > 0 ? '#ffe36a' : '#d8a93a';
        g.fillRect(Math.round(sx) - 1, Math.round(sy), 3, 1); g.fillRect(Math.round(sx), Math.round(sy) - 1, 1, 3);
      }
    }
    if (boss || elite || e.hp < e.maxHp) {
      const w = boss ? 34 : size * .87, top = e.y - size * heightRatio - 1 - bob, h = boss ? 4 : 3;
      g.fillStyle = '#372b22';
      g.fillRect(e.x - w / 2, top, w, h);
      g.fillStyle = boss ? '#d8352c' : elite ? '#e0a33a' : '#ce702b';
      g.fillRect(e.x - w / 2 + 1, top + 1, Math.max(0, (w - 2) * e.hp / e.maxHp), h - 1.5);
      if (e.maxShield > 0 && e.shield > 0) {
        g.fillStyle = '#f3e3a0';
        g.fillRect(e.x - w / 2 + 1, top - 2, Math.max(0, (w - 2) * e.shield / e.maxShield), 1.5);
      }
    }
  }

  private drawDeath(g: CanvasRenderingContext2D, d: Death, heightRatio: number) {
    const e = d.e, k = d.age / d.life;
    const fall = Math.min(1, d.age / (d.boss ? .5 : .28));
    const ease = 1 - (1 - fall) * (1 - fall);
    const angle = d.dir * (d.boss ? .9 : 1.45) * ease;
    const hop = Math.sin(Math.PI * fall) * (d.boss ? 2 : 4);
    const fade = k < .55 ? 1 : 1 - (k - .55) / .45;
    g.save();
    g.globalAlpha = Math.max(0, fade);
    g.fillStyle = 'rgba(40,30,20,.25)';
    g.beginPath(); g.ellipse(e.x, e.y + 3, d.size * .3 * (1 + ease * .4), d.size * .1, 0, 0, Math.PI * 2); g.fill();
    g.translate(e.x, e.y + 3 - hop + ease * 2);
    g.rotate(angle);
    const white = d.age < .07;
    stamp(g, 'u_' + e.sprite + '_0' + (e.left ? (white ? '_LW' : '_L') : (white ? '_W' : '')), 0, 0, d.size, heightRatio);
    g.restore();
  }

  private drawAlly(g: CanvasRenderingContext2D, i: number, heightRatio: number) {
    const b = this.battle, a = b.allies[i], t = this.fx.time;
    const swing = ALLY_CARDS[a.id].interval - a.cooldown;
    const thrust = swing < .28 ? Math.sin(Math.PI * swing / .28) * (a.id === 'huangzhong' ? -2 : 5) : 0;
    const p = .5 + .5 * Math.sin(t * 4 + i);
    g.fillStyle = 'rgba(40,30,20,.28)';
    g.beginPath(); g.ellipse(a.x, a.y + 3, 10, 3.5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = `rgba(90,200,120,${.45 + .3 * p})`; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(a.x, a.y + 3, 11 + p * 2, 4 + p * .6, 0, 0, Math.PI * 2); g.stroke();
    stamp(g, 'hero_' + a.id + '_' + Math.floor(t * 6) % 4 + (a.left ? '_L' : ''), a.x + (a.left ? -thrust : thrust), a.y + 3, 32, heightRatio);
    for (let j = 0; j < Math.min(5, a.level); j++) {
      g.fillStyle = '#ffd95a';
      g.fillRect(a.x - a.level * 2 + j * 4, a.y + 6, 2, 2);
    }
  }

  /** 伤害数字、横幅等屏幕坐标的叠加层（不随地图拉伸变形）。 */
  private drawOverlay(ui: UI, ox: number, oy: number, sx: number, sy: number, fw: number, fh: number) {
    const g = ui.ctx, fx = this.fx, u = ui.u;
    g.save();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (const p of fx.popups) {
      const k = p.age / p.life, rise = 1 - (1 - k) * (1 - k);
      const pop = k < .12 ? 1.45 - 3.75 * k : 1;
      const px = ox + p.x * sx, py = oy + (p.y - 14 * rise) * sy;
      g.globalAlpha = k < .7 ? 1 : (1 - k) / .3;
      g.font = ui.font(p.size * sx * pop / u, true);
      g.lineWidth = 3.4 * sx / 2.2;
      g.strokeStyle = 'rgba(246,238,216,.95)';
      g.strokeText(p.text, px, py);
      g.fillStyle = p.color;
      g.fillText(p.text, px, py);
    }
    const bn = fx.banner;
    if (bn) {
      // 宣纸横幅：纸色长条 + 上下墨线 + 左侧朱印，字从右侧滑入。
      const k = bn.age / bn.life;
      const slide = k < .14 ? 1 - k / .14 : 0, fade = k > .8 ? 1 - (k - .8) / .2 : 1;
      const cy = oy + fh * .4, bh = 96 * u, open = Math.min(1, k / .1);
      g.globalAlpha = .94 * fade;
      g.fillStyle = '#efe5cc';
      g.fillRect(ox, cy - bh / 2 * open, fw, bh * open);
      g.fillStyle = 'rgba(60,46,30,.9)';
      g.fillRect(ox, cy - bh / 2 * open, fw, 3 * u);
      g.fillRect(ox, cy + bh / 2 * open - 3 * u, fw, 3 * u);
      g.fillStyle = 'rgba(60,46,30,.35)';
      g.fillRect(ox, cy - bh / 2 * open + 7 * u, fw, u);
      g.fillRect(ox, cy + bh / 2 * open - 8 * u, fw, u);
      if (open >= 1) {
        g.globalAlpha = fade;
        const seal = 62 * u, sx0 = ox + 26 * u - slide * fw * .3;
        g.fillStyle = bn.color;
        g.fillRect(sx0, cy - seal / 2, seal, seal);
        g.strokeStyle = '#f3e3c8'; g.lineWidth = 2 * u;
        g.strokeRect(sx0 + 5 * u, cy - seal / 2 + 5 * u, seal - 10 * u, seal - 10 * u);
        g.font = ui.font(34, true);
        g.fillStyle = '#f7ead2';
        g.fillText(bn.seal, sx0 + seal / 2, cy + 2 * u);
        const tx = ui.W / 2 + 34 * u + slide * fw;
        g.font = ui.font(40, true);
        g.fillStyle = '#2b1f14';
        g.fillText(bn.text, tx, cy - 13 * u);
        g.font = ui.font(21, false);
        g.fillStyle = bn.color;
        g.fillText(bn.sub, ui.W / 2 + 34 * u - slide * fw, cy + 26 * u);
      }
    }
    g.restore();
  }

  private drawActions(ui: UI, y: number, h: number, interactive: boolean) {
    const b = this.battle, u = ui.u;
    // 状态行：当前波次 / 休整倒计时；休整时右侧换成「提前出击」。
    const wave = b.plan[Math.max(0, b.waveIdx)], nextWave = b.plan[b.waveIdx + 1];
    let status: string;
    if (this.aiming) status = '点地图指定将令落点';
    else if (b.allSpawned) status = b.generalsSent >= 2 ? '主将已出阵 · 守住城门' : '最后一波 · 守住城门';
    else if (b.resting) status = `第 ${b.waveIdx + 2} 波 ${nextWave?.name || ''} · ${Math.ceil(b.restT)} 秒后`;
    else status = `第 ${b.waveIdx + 1}/${b.waveTotal} 波 · ${wave.name}${wave.boss ? ' · ' + BOSSES[b.map.bosses[wave.boss === 'mid' ? 0 : 1]].name : ''}`;
    ui.text(status, 20 * u, y - 24 * u, 23, GREEN, 'left', null);
    if (b.resting && !this.aiming) {
      const bw = 170 * u, bh = 46 * u;
      if (ui.button('td_call', ui.W - bw - 12 * u, y - 24 * u - bh / 2, bw, bh, '提前出击', C.btnRed, { size: 21 }) && interactive) {
        const gain = b.callNext();
        if (gain) ui.toast(`提前出击 · 军阵经验 +${gain}`);
      }
    } else ui.text(`升级经验 ${b.xp}/${b.xpNeeded}`, ui.W - 20 * u, y - 24 * u, 22, MUTED, 'right', null);
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
      const owned = save.heroes[card.id]?.owned, pw = b.allyPower[card.id] ?? 1;
      const stat = `${owned ? '' : '未招募·按一级 '}攻击 ${allyAtkOf(card.id)}，技能伤害×${pw.toFixed(1)}`;
      return { label: '武将', color: RED, icon: 'hero_' + card.id + '_0', name: d.name, action: lv === 1 ? '上阵 · ' + d.skill : '强化至 ' + lv + ' 级', desc: d.desc + (lv > 1 ? ' 本将技能伤害提升。' : '') + '\n' + stat };
    }
    const d = TACTIC_CARDS[card.id], lv = (b.tactics.find(t => t.id === card.id)?.level || 0) + 1;
    return { label: '特殊效果', color: '#335880', icon: d.icon, name: d.name, action: lv === 1 ? '本局生效' : '强化至 ' + lv + ' 级', desc: d.desc };
  }

  private drawCards(ui: UI) {
    const b = this.battle, offer = b.offer!, u = ui.u;
    ui.layer = 1; ui.dim(.65); ui.blocker('td_cards_block');
    const f = dialogFrame(ui, 724 * u, 602 * u, offer.aid ? '援建 · 解锁塔位' : '军阵升级 · Lv.' + b.level);
    ui.text(offer.aid ? '任选一座，按塔位顺序部署' : '选择一项，本局生效', ui.W / 2, f.y + 85 * u, 25, MUTED, 'center', null);
    offer.cards.forEach((card, i) => {
      const d = this.cardInfo(card), x = f.x + (17 + i * 232) * u, y = f.y + 126 * u, w = 226 * u, h = 440 * u;
      ui.panel(x, y, w, h, 'paper');
      ui.text(d.label, x + w / 2, y + 30 * u, 23, d.color, 'center', null);
      ui.icon(d.icon, x + w / 2, y + 91 * u, 71 * u);
      ui.text(d.name, x + w / 2, y + 157 * u, 31, INK, 'center', null);
      ui.text(d.action, x + w / 2, y + 201 * u, 21, d.color, 'center', null);
      ui.wrapText(d.desc, x + 12 * u, y + 228 * u, w - 24 * u, 21, INK, 1.18, 'left', null);
      const pair = card.type === 'tactic' ? card.id : card.type === 'tower' ? TACTIC_IDS.find(id => FORMATIONS[id].kind === card.kind) : undefined;
      if (pair) {
        const recipe = FORMATIONS[pair];
        const ready = card.type === 'tactic' ? b.towers.some(t => t?.kind === recipe.kind) : b.tactics.some(t => t.id === pair);
        const partner = card.type === 'tactic' ? TOWERS[recipe.kind].name : TACTIC_CARDS[pair].name;
        const state = b.formations.has(pair) ? '已生效' : ready ? '选取即生效' : '需' + partner;
        ui.ctx.fillStyle = '#bcaa88';
        ui.ctx.fillRect(x + 14 * u, y + 302 * u, w - 28 * u, u);
        ui.text(recipe.name, x + w / 2, y + 324 * u, 24, GREEN, 'center', null);
        ui.text(state, x + w / 2, y + 351 * u, 20, b.formations.has(pair) ? GREEN : ready ? RED : MUTED, 'center', null);
        ui.wrapText(recipe.effect, x + 12 * u, y + 371 * u, w - 24 * u, 20, INK, 1.08, 'left', null);
      }
      const count = b.formations.size;
      if (ui.clicked('td_reward_' + i, x, y, w, h) && b.choose(card)) {
        this.aiming = false; playSfx('levelup');
        ui.toast(pair && b.formations.size > count ? '联动生效 · ' + FORMATIONS[pair].name : d.name + ' · ' + d.action);
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
    if (b.formations.size) roster.push('联动　' + [...b.formations].map(id => FORMATIONS[id].name).join('　'));
    const extra = roster.length * 38 * u;
    const f = dialogFrame(ui, 614 * u, 552 * u + extra, '暂停布阵');
    ui.text(`城门 ${b.hp}/20   ·   已漏 ${b.leaks} 个敌人`, ui.W / 2, f.y + 100 * u, 26, INK, 'center', null);
    roster.forEach((line, i) => ui.text(line, ui.W / 2, f.y + (144 + i * 38) * u, 21, MUTED, 'center', null));
    if (ui.button('td_resume', f.x + 50 * u, f.y + extra + 155 * u, 514 * u, 86 * u, '继续布阵', C.btnGreen, { disabled: this.busy })) this.paused = false;
    if (ui.button('td_repair', f.x + 50 * u, f.y + extra + 258 * u, 514 * u, 86 * u, '修复城门 +5', C.btnGold, {
      icon: VIDEO ? 'video' : undefined, sub: b.repaired ? '本局已用' : b.hp === GATE_HP ? '城门完好' : '每局一次', disabled: this.busy || b.repaired || b.hp === GATE_HP
    })) void this.reward('repair');
    // 撤军会直接判负，第一下只提示，三秒内再点一次才生效，避免误触。
    if (ui.button('td_quit', f.x + 50 * u, f.y + extra + 374 * u, 514 * u, 86 * u, this.quitArmed > 0 ? '再点一次确认撤军' : '撤军结算', this.quitArmed > 0 ? C.btnRed : C.btnGray, { disabled: this.busy })) {
      if (this.quitArmed > 0) {
        this.quitArmed = 0;
        b.quit = true;
        b.phase = 'loss';
        this.finish();
      } else this.quitArmed = 3;
    }
    ui.layer = 0;
  }
  /** 城门失守：看视频（无广告版免费）复活，最多三次，每次全塔伤害提升一档。 */
  private drawRevive(ui: UI) {
    const u = ui.u, b = this.battle, g = ui.ctx;
    ui.layer = 1;
    ui.dim(.66);
    ui.blocker('td_revive_block');
    const f = dialogFrame(ui, 620 * u, 560 * u, '城门失守');
    const cx = ui.W / 2;
    ui.text('敌军攻破城门……是否重振再战？', cx, f.y + 100 * u, 27, INK, 'center', null);
    const left = Math.max(0, this.reviveLeft), cy = f.y + 205 * u, r = 54 * u, TAU = Math.PI * 2;
    g.save();
    g.lineWidth = 9 * u;
    g.strokeStyle = 'rgba(110,88,62,0.2)';
    g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
    g.strokeStyle = left <= 3 ? '#a3281e' : '#b8392f';
    g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, left / 10)); g.stroke();
    g.restore();
    ui.text(String(Math.ceil(left)), cx, cy + 2 * u, 50, left <= 3 ? RED : INK, 'center', null);
    const n = b.reviveCount, pct = Math.round(TOWER_REVIVE_BONUS[n] * 100);
    const sub = `城门回 ${Math.ceil(GATE_HP / 2)} 点 · 全塔伤害+${pct}% · 还可 ${TOWER_REVIVE_MAX - n} 次`;
    if (ui.button('td_revive', f.x + 55 * u, f.y + 300 * u, 510 * u, 96 * u, VIDEO ? '看视频复活' : '免费复活', C.btnGold, {
      icon: VIDEO ? 'video' : undefined, size: 30, sub, disabled: this.busy
    })) void this.reward('revive');
    if (ui.button('td_giveup', f.x + 55 * u, f.y + 418 * u, 510 * u, 80 * u, '放弃', C.btnGray, { disabled: this.busy })) this.giveUp();
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
