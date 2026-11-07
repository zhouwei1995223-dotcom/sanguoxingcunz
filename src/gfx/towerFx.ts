import type { Marcher, TowerBattle, TowerEvent } from '../battle/tower';
import { ALLY_CARDS, TowerKind } from '../data/tower';

/**
 * 布阵的纯画面层：粒子、伤害数字、倒地动画、地面痕迹、震屏和横幅。
 * 全部按战斗时钟推进（暂停、选牌时一起静止，二倍速时一起加速），不影响战斗结果。
 */
interface Particle {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  grav: number; drag: number; age: number; life: number; delay: number;
  size: number; grow: number; color: string; shape: 0 | 1 | 2 | 3; glow: boolean;
}
export interface Popup { x: number; y: number; text: string; color: string; age: number; life: number; size: number; e?: Marcher; amount: number }
export interface Death { e: Marcher; age: number; life: number; dir: number; size: number; boss: boolean }
interface Decal { x: number; y: number; r: number; kind: 'crater' | 'scorch' | 'frost'; age: number; life: number; seed: number }
export interface TowerAnim { fire: number; build: number; level: number; kind: TowerKind }
export interface Banner { text: string; sub: string; color: string; age: number; life: number }

const INK = '#33261a', INK_RED = '#b3311f', INK_GREEN = '#2f6b45';
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class TowerFx {
  readonly particles: Particle[] = [];
  readonly popups: Popup[] = [];
  readonly deaths: Death[] = [];
  readonly decals: Decal[] = [];
  readonly anims = new Map<number, TowerAnim>();
  banner: Banner | null = null;
  shakeT = 0;
  shakeAmp = 0;
  flash = 0;
  flashColor = '#ffffff';
  gateHit = 0;
  hudHit = 0;
  time = 0;
  /** 本帧需要播放的音效（由场景统一播放并限频）。 */
  readonly sounds = new Set<'kill' | 'hit' | 'explode' | 'fire' | 'hurt' | 'boss' | 'thrust'>();
  bossArrived = false;
  constructor(private readonly gate: readonly [number, number], private readonly sites: readonly (readonly [number, number])[], private lowPower: boolean) {}

  private get cap() { return this.lowPower ? 140 : 320; }

  spawn(p: Partial<Particle> & { x: number; y: number }) {
    if (this.particles.length >= this.cap) return;
    this.particles.push({
      z: 0, vx: 0, vy: 0, vz: 0, grav: 0, drag: 0, age: 0, life: .5, delay: 0,
      size: 2, grow: 0, color: '#fff', shape: 0, glow: false, ...p
    });
  }
  private burst(x: number, y: number, n: number, colors: string[], speed: number, opts: Partial<Particle> = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * rand(.45, 1);
      this.spawn({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .6, vz: rand(10, 40), grav: 90, drag: 2.2,
        life: rand(.3, .55), size: rand(1.5, 3), color: colors[i % colors.length], ...opts
      });
    }
  }
  shake(amp: number, t: number) {
    if (amp > this.shakeAmp || this.shakeT <= 0) this.shakeAmp = amp;
    this.shakeT = Math.max(this.shakeT, t);
  }
  private popup(x: number, y: number, text: string, color: string, size: number, life = .8, e?: Marcher, amount = 0) {
    if (this.popups.length >= 16) this.popups.shift();
    // 附近已有刚冒出的数字时往上错开，避免叠成一串。
    let lift = 0;
    for (const p of this.popups) if (p.age < .35 && Math.abs(p.x - x) < 12 && Math.abs(p.y - (y - lift)) < 7) lift += 7;
    this.popups.push({ x, y: y - Math.min(lift, 21), text, color, age: 0, life, size, e, amount });
  }

  consume(b: TowerBattle, events: TowerEvent[], dmgNum: boolean) {
    for (const ev of events) {
      switch (ev.t) {
        case 'hit': {
          if (!dmgNum || ev.dmg < 1) break;
          // 同一个敌人 0.4 秒内的伤害合并成一个数字。
          const old = this.popups.find(p => p.e === ev.e && p.age < .4);
          if (old) {
            old.amount += ev.dmg;
            old.text = String(Math.round(old.amount));
            old.size = Math.min(13, 8.5 + old.amount / 50);
            if (ev.dmg >= 80) old.color = INK_RED;
            old.age = Math.min(old.age, .1);
          } else {
            const big = ev.dmg >= 80;
            this.popup(ev.e.x + rand(-3, 3), ev.e.y - 16, String(Math.round(ev.dmg)), big ? INK_RED : INK, big ? 11 : 8.5, .75, ev.e, ev.dmg);
          }
          break;
        }
        case 'kill': {
          const e = ev.e, boss = e.gateDamage === 5, size = boss ? 43 : e.gateDamage === 2 ? 33 : 24;
          this.deaths.push({ e, age: 0, life: boss ? 1.1 : .62, dir: e.left ? -1 : 1, size, boss });
          if (this.deaths.length > 40) this.deaths.shift();
          this.burst(e.x, e.y - 6, boss ? 22 : 7, ['#e9dcc0', '#b9a17a', '#fff'], boss ? 60 : 34, { life: rand(.35, .6) });
          for (let i = 0; i < (boss ? 10 : 3); i++) {
            this.spawn({ x: e.x + rand(-5, 5), y: e.y, vx: rand(-8, 8), vy: rand(-3, 3), drag: 3, life: rand(.5, .8), size: rand(4, 7), grow: 9, color: 'rgba(214,196,160,.55)', shape: 2 });
          }
          if (dmgNum && e.gateDamage > 1) this.popup(e.x, e.y - 24, '+' + e.bounty + ' 经验', INK_GREEN, 9, 1);
          this.sounds.add('kill');
          if (boss) {
            this.shake(5, .45);
            this.flash = .45; this.flashColor = '#fff3c0';
            this.banner = { text: '斩 将', sub: '敌将已被击溃', color: INK_RED, age: 0, life: 1.6 };
            this.sounds.add('explode');
          }
          break;
        }
        case 'leak': {
          const [gx, gy] = this.gate, dmg = ev.e.gateDamage;
          this.gateHit = .5; this.hudHit = .9;
          this.shake(dmg >= 5 ? 6 : 2.5, dmg >= 5 ? .5 : .25);
          this.flash = Math.max(this.flash, dmg >= 2 ? .4 : .22); this.flashColor = '#d6342a';
          this.popup(gx, gy - 30, '城门 -' + dmg, INK_RED, 12, 1.1);
          this.burst(gx, gy - 6, 10, ['#8f8676', '#c9bfa8', '#5f574a'], 46);
          this.sounds.add('hurt');
          break;
        }
        case 'fire': this.onFire(ev.slot, ev.kind, ev.tx, ev.ty); break;
        case 'impact': this.onImpact(ev.kind, ev.x, ev.y, ev.r); break;
        case 'build': {
          const [x, y] = this.sites[ev.slot], kind = b.towers[ev.slot]?.kind || 'arrow';
          const prev = this.anims.get(ev.slot);
          this.anims.set(ev.slot, { fire: prev?.fire ?? 9, build: 0, level: ev.level, kind });
          const first = ev.level === 1;
          // 新建：从空中落下，落地扬尘；升级：金光自下而上。
          for (let i = 0; i < 14; i++) {
            const a = i / 14 * Math.PI * 2;
            this.spawn({ x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 5, vx: Math.cos(a) * 42, vy: Math.sin(a) * 18, drag: 4, delay: first ? .22 : 0,
              life: rand(.4, .7), size: rand(4, 7), grow: 10, color: first ? 'rgba(216,197,154,.7)' : 'rgba(250,242,214,.55)', shape: 2 });
          }
          for (let i = 0; i < (first ? 8 : 16); i++) {
            this.spawn({ x: x + rand(-12, 12), y: y + rand(-3, 4), vz: rand(25, 60), drag: 1, delay: first ? .25 : rand(0, .25), life: rand(.6, 1),
              size: rand(1.5, 2.5), color: i % 2 ? '#ffe17a' : '#fff8d0', glow: true });
          }
          break;
        }
        case 'boss': {
          this.bossArrived = true;
          this.banner = { text: (ev.final ? '主将 ' : '敌将 ') + bossName(ev.e), sub: ev.final ? '最后一战 · 守住城门' : '率部出阵', color: '#9e2a20', age: 0, life: 2 };
          this.shake(4, .5);
          this.sounds.add('boss');
          this.burst(ev.e.x, ev.e.y, 16, ['#c8392b', '#ffcc66', '#5b2a1e'], 50);
          break;
        }
        case 'tactic': this.onTactic(ev.id, ev.x, ev.y); break;
        case 'ally': {
          const spec = ALLY_CARDS[ev.id];
          if (ev.id === 'zhangfei') {
            this.shake(1.5, .15);
            for (let i = 0; i < 16; i++) {
              const a = i / 16 * Math.PI * 2;
              this.spawn({ x: ev.tx, y: ev.ty, vx: Math.cos(a) * 70, vy: Math.sin(a) * 40, drag: 4, life: .45, size: rand(4, 6), grow: 8, color: 'rgba(220,196,150,.55)', shape: 2 });
            }
          } else if (ev.id === 'guanyu') {
            for (let i = 0; i < 10; i++) {
              const a = -1.6 + i / 10 * 2.6, r = spec.range * .9;
              this.spawn({ x: ev.tx + Math.cos(a) * r * .6, y: ev.ty + Math.sin(a) * r * .5, vx: Math.cos(a) * 30, vy: Math.sin(a) * 20, drag: 3,
                life: rand(.25, .45), size: rand(1.5, 2.5), color: i % 2 ? '#c9ffb8' : '#5fd27a', glow: true });
            }
          } else {
            this.spawn({ x: ev.x, y: ev.y - 14, life: .18, size: 7, grow: -20, color: '#ffe9a0', shape: 2, glow: true });
          }
          break;
        }
        case 'command': {
          this.shake(4, .35);
          this.flash = Math.max(this.flash, .3); this.flashColor = b.hero === 'zhaoyun' ? '#e9fbff' : '#fff0d0';
          for (let i = 0; i < 28; i++) {
            const a = i / 28 * Math.PI * 2;
            this.spawn({ x: ev.x, y: ev.y, vx: Math.cos(a) * ev.r * 2.1, vy: Math.sin(a) * ev.r * 1.2, drag: 4.5, life: .6, size: rand(5, 8), grow: 10, color: 'rgba(223,205,165,.55)', shape: 2 });
          }
          this.burst(ev.x, ev.y, 18, b.hero === 'zhaoyun' ? ['#ffffff', '#8be6f0', '#ffe9a0'] : ['#ffe9a0', '#ffb45c', '#fff'], 90, { glow: true, grav: 40 });
          this.decals.push({ x: ev.x, y: ev.y, r: ev.r * .55, kind: 'crater', age: 0, life: 3, seed: Math.random() * 99 });
          this.sounds.add('explode');
          break;
        }
        case 'shield': {
          this.burst(ev.x, ev.y - 8, 12, ['#ffe79a', '#d9a64a', '#fff'], 60, { shape: 0 });
          this.popup(ev.x, ev.y - 26, '破盾', '#8a5a12', 10.5, .9);
          this.sounds.add('hit');
          break;
        }
      }
    }
    events.length = 0;
  }

  private onFire(slot: number, kind: TowerKind, tx: number, ty: number) {
    const [x, y] = this.sites[slot] || [0, 0];
    const a = this.anims.get(slot);
    if (a) a.fire = 0; else this.anims.set(slot, { fire: 0, build: 9, level: 1, kind });
    const top = y - (kind === 'arrow' ? 20 : 12), dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
    if (kind === 'arrow' || kind === 'bolt') {
      const n = kind === 'bolt' ? 6 : 3;
      for (let i = 0; i < n; i++) {
        this.spawn({ x: x + dx / d * 6, y: top + dy / d * 3, vx: dx / d * rand(30, 70) + rand(-15, 15), vy: dy / d * rand(20, 40) + rand(-10, 10), drag: 6,
          life: rand(.12, .22), size: rand(1, 2), color: i % 2 ? '#fff6c8' : '#ffd36a', glow: true });
      }
      if (kind === 'bolt') this.spawn({ x, y: top, vz: 6, life: .4, size: 3, grow: 9, color: 'rgba(230,220,200,.5)', shape: 2 });
    } else if (kind === 'stone') {
      for (let i = 0; i < 6; i++) this.spawn({ x: x + rand(-10, 10), y: y + 2, vx: rand(-20, 20), vz: rand(5, 15), drag: 3, life: rand(.35, .55), size: rand(3, 5), grow: 7, color: 'rgba(205,186,146,.6)', shape: 2 });
    } else if (kind === 'oil') {
      for (let i = 0; i < 6; i++) this.spawn({ x: x + rand(-4, 4), y: top, vx: dx / d * 20 + rand(-10, 10), vz: rand(20, 40), drag: 2, life: rand(.25, .4), size: rand(1.5, 3), color: i % 2 ? '#ffb43c' : '#ff6a2a', glow: true });
    }
  }

  private onImpact(kind: 'arrow' | 'stone' | 'oil' | 'blast', x: number, y: number, r: number) {
    if (kind === 'arrow') {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        this.spawn({ x, y: y - 7, vx: Math.cos(a) * 45, vy: Math.sin(a) * 30, drag: 6, life: .16, size: 1.5, color: '#fff7d6', shape: 1, glow: true });
      }
      return;
    }
    if (kind === 'stone') {
      this.shake(1.2, .12);
      this.decals.push({ x, y, r: r * .55, kind: 'crater', age: 0, life: 2.4, seed: Math.random() * 99 });
      this.burst(x, y, 12, ['#8a7a62', '#b9a684', '#5e5446', '#d8c9a6'], r * 2.6, { size: 2.5 });
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        this.spawn({ x: x + Math.cos(a) * r * .3, y: y + Math.sin(a) * r * .2, vx: Math.cos(a) * r * 1.6, vy: Math.sin(a) * r * .9, drag: 4, life: rand(.45, .7), size: rand(5, 8), grow: 12, color: 'rgba(207,190,152,.55)', shape: 2 });
      }
      this.sounds.add('hit');
      return;
    }
    // 火油、引火爆炸
    const blast = kind === 'blast';
    this.decals.push({ x, y, r: r * .9, kind: 'scorch', age: 0, life: blast ? 3 : 2.6, seed: Math.random() * 99 });
    this.burst(x, y, blast ? 22 : 12, ['#ffd25a', '#ff8a2a', '#e5401f', '#fff2b0'], r * (blast ? 3.4 : 2.2), { glow: true, grav: 30, size: 2.5 });
    if (blast) {
      this.shake(3, .3);
      this.spawn({ x, y: y - 4, life: .3, size: r * .8, grow: r * 2, color: 'rgba(255,200,90,.7)', shape: 2, glow: true });
      for (let i = 0; i < 10; i++) this.spawn({ x: x + rand(-r, r) * .6, y: y + rand(-r, r) * .4, vz: rand(15, 35), drag: 1, life: rand(.7, 1.1), size: rand(5, 8), grow: 12, color: 'rgba(70,58,50,.3)', shape: 2 });
      this.sounds.add('explode');
    } else this.sounds.add('fire');
  }

  private onTactic(id: 'frost' | 'lightning' | 'wildfire', x: number, y: number) {
    if (id === 'lightning') {
      this.flash = Math.max(this.flash, .35); this.flashColor = '#eaf6ff';
      this.shake(2, .18);
      this.decals.push({ x, y, r: 9, kind: 'scorch', age: 0, life: 2, seed: Math.random() * 99 });
      this.burst(x, y - 4, 10, ['#ffffff', '#bfe8ff', '#7ab8ff'], 70, { shape: 1, glow: true, grav: 20 });
      this.sounds.add('explode');
    } else if (id === 'frost') {
      this.decals.push({ x, y, r: 45, kind: 'frost', age: 0, life: 2.2, seed: Math.random() * 99 });
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, r = rand(5, 45);
        this.spawn({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * .6, vz: rand(10, 30), vx: rand(-6, 6), grav: 8, drag: 1, life: rand(.7, 1.2), size: rand(1.2, 2.4), color: i % 3 ? '#e8ffff' : '#8fd8f2', shape: 3, glow: true });
      }
      this.sounds.add('hit');
    } else {
      this.burst(x, y, 14, ['#ffd25a', '#ff8a2a', '#e5401f'], 60, { glow: true, grav: 20 });
      this.decals.push({ x, y, r: 30, kind: 'scorch', age: 0, life: 2.8, seed: Math.random() * 99 });
      this.sounds.add('fire');
    }
  }

  /** dt 为本帧推进的战斗秒数。 */
  update(dt: number, b: TowerBattle) {
    if (dt <= 0) return;
    this.time += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.gateHit = Math.max(0, this.gateHit - dt);
    this.hudHit = Math.max(0, this.hudHit - dt);
    for (const a of this.anims.values()) { a.fire += dt; a.build += dt; }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      if (p.age >= p.life) { this.particles.splice(i, 1); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vz -= p.grav * dt; p.z = Math.max(0, p.z + p.vz * dt);
      p.size = Math.max(.3, p.size + p.grow * dt);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) if ((this.popups[i].age += dt) >= this.popups[i].life) this.popups.splice(i, 1);
    for (let i = this.deaths.length - 1; i >= 0; i--) if ((this.deaths[i].age += dt) >= this.deaths[i].life) this.deaths.splice(i, 1);
    for (let i = this.decals.length - 1; i >= 0; i--) if ((this.decals[i].age += dt) >= this.decals[i].life) this.decals.splice(i, 1);
    if (this.banner && (this.banner.age += dt) >= this.banner.life) this.banner = null;
    // 飞行中的火油罐拖着火星，礌石拖着尘土；火场持续冒火星。
    const lp = this.lowPower ? .5 : 1;
    for (const s of b.strikes) {
      if (s.kind !== 'oil' && s.kind !== 'stone') continue;
      if (Math.random() > 18 * dt * lp) continue;
      const k = s.age / s.life, x = s.x + (s.tx - s.x) * k, y = s.y + (s.ty - s.y) * k;
      const z = arcHeight(s) * Math.sin(Math.PI * k);
      this.spawn(s.kind === 'oil'
        ? { x, y, z, vz: 10, life: .3, size: rand(1.5, 2.5), color: Math.random() < .5 ? '#ffb43c' : '#ff6a2a', glow: true }
        : { x, y, z, life: .35, size: 2.5, grow: 5, color: 'rgba(200,184,150,.5)', shape: 2 });
    }
    for (const f of b.oil) {
      if (Math.random() > f.radius * .35 * dt * lp) continue;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * f.radius * .8;
      this.spawn({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r * .74, vz: rand(18, 34), vx: rand(-5, 5), drag: .5, life: rand(.5, .9), size: rand(1, 1.8), color: Math.random() < .5 ? '#ffd25a' : '#ff7a2a', glow: true });
    }
    // 城门残破时冒烟。
    if (b.hp <= 8 && Math.random() < (b.hp <= 4 ? 7 : 3) * dt * lp) {
      const [gx, gy] = this.gate;
      this.spawn({ x: gx + rand(-14, 14), y: gy - 18, vz: rand(12, 22), vx: rand(2, 8), drag: .3, life: rand(1.2, 1.8), size: rand(3, 5), grow: 7, color: 'rgba(70,64,58,.35)', shape: 2 });
    }
    // 三级塔偶尔闪金光，提示满级。
    for (const [slot, a] of this.anims) {
      if (a.level < 3 || Math.random() > 1.2 * dt * lp) continue;
      const [x, y] = this.sites[slot];
      this.spawn({ x: x + rand(-11, 11), y: y + rand(-2, 3), vz: rand(14, 26), life: rand(.7, 1), size: 1.4, color: '#ffe88a', shape: 3, glow: true });
    }
  }

  get shakeOffset(): [number, number] {
    if (this.shakeT <= 0) return [0, 0];
    const a = this.shakeAmp * Math.min(1, this.shakeT / .15);
    return [Math.sin(this.time * 91) * a, Math.cos(this.time * 77) * a * .7];
  }

  drawDecals(g: CanvasRenderingContext2D) {
    for (const d of this.decals) {
      const fade = Math.min(1, (d.life - d.age) / .8) * Math.min(1, d.age / .08);
      g.save();
      g.globalAlpha = fade;
      if (d.kind === 'frost') {
        g.fillStyle = 'rgba(200,245,255,.2)';
        g.beginPath(); g.ellipse(d.x, d.y, d.r, d.r * .6, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(235,255,255,.7)'; g.lineWidth = 1;
        for (let i = 0; i < 9; i++) {
          const a = d.seed + i * 2.39, r1 = d.r * (.25 + (i % 3) * .2), r2 = r1 + 7;
          g.beginPath(); g.moveTo(d.x + Math.cos(a) * r1, d.y + Math.sin(a) * r1 * .6); g.lineTo(d.x + Math.cos(a) * r2, d.y + Math.sin(a) * r2 * .6); g.stroke();
        }
      } else {
        const scorch = d.kind === 'scorch';
        g.fillStyle = scorch ? 'rgba(52,36,26,.32)' : 'rgba(88,72,52,.30)';
        g.beginPath(); g.ellipse(d.x, d.y, d.r, d.r * .6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = scorch ? 'rgba(30,20,16,.28)' : 'rgba(70,58,44,.32)';
        for (let i = 0; i < 6; i++) {
          const a = d.seed + i * 1.7, r = d.r * (.35 + (i % 3) * .22);
          g.fillRect(Math.round(d.x + Math.cos(a) * r), Math.round(d.y + Math.sin(a) * r * .6), 2 + (i % 2), 2);
        }
        if (!scorch) {
          g.strokeStyle = 'rgba(232,214,176,.45)'; g.lineWidth = 1;
          g.beginPath(); g.ellipse(d.x, d.y - 1, d.r * .9, d.r * .5, 0, Math.PI, Math.PI * 2); g.stroke();
        }
      }
      g.restore();
    }
  }

  /** layer 0：地面烟尘；layer 1：空中火星和碎屑。 */
  drawParticles(g: CanvasRenderingContext2D, heightRatio: number, layer: 0 | 1) {
    let glowing = false;
    for (const p of this.particles) {
      if (p.delay > 0) continue;
      const smoke = p.shape === 2;
      if ((layer === 0) !== (smoke && !p.glow)) continue;
      const k = p.age / p.life, alpha = smoke ? 1 - k : k < .7 ? 1 : (1 - k) / .3;
      if (p.glow !== glowing) { g.globalCompositeOperation = p.glow ? 'lighter' : 'source-over'; glowing = p.glow; }
      g.globalAlpha = Math.max(0, alpha);
      g.fillStyle = p.color;
      const y = p.y - p.z * heightRatio;
      if (smoke) {
        g.beginPath(); g.ellipse(p.x, y, p.size, p.size * .75, 0, 0, Math.PI * 2); g.fill();
      } else if (p.shape === 1) {
        const d = Math.hypot(p.vx, p.vy) || 1, l = Math.min(6, d * .05);
        g.strokeStyle = p.color; g.lineWidth = p.size;
        g.beginPath(); g.moveTo(p.x, y); g.lineTo(p.x - p.vx / d * l, y - p.vy / d * l); g.stroke();
      } else if (p.shape === 3) {
        const s = p.size;
        g.fillRect(p.x - s, y - s * .3, s * 2, s * .6);
        g.fillRect(p.x - s * .3, y - s, s * .6, s * 2);
      } else {
        const s = Math.round(p.size);
        g.fillRect(Math.round(p.x - s / 2), Math.round(y - s / 2), s, s);
      }
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
}

export function arcHeight(s: { x: number; y: number; tx: number; ty: number; kind: string }) {
  const d = Math.hypot(s.tx - s.x, s.ty - s.y);
  return (s.kind === 'stone' ? 14 : 10) + d * (s.kind === 'stone' ? .32 : .22);
}

function bossName(e: Marcher) { return e.name || ''; }
