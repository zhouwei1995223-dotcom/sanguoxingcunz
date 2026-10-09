import type { EnemyDef, BossDef } from '../data/enemies';
import type { WeaponId, PassiveId } from '../data/skills';

// 战斗实体数据结构（纯数据，逻辑在 battle.ts / weapons.ts）

export interface Enemy {
  uid: number;
  def: EnemyDef | null;
  boss: BossDef | null;
  isMidBoss: boolean;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  mass: number;
  exp: number;
  sprite: string;
  scale: number;
  elite: boolean;
  anim: number;
  left: boolean;
  flash: number;
  kx: number;
  ky: number;
  slow: number;
  slowT: number;
  atkCd: number;
  shootT: number;
  dead: boolean;
  /** 冲锋类（骑兵冲阵）：固定方向移动 */
  fixedDir: boolean;
  vx: number;
  vy: number;
  life: number;
  // 首领状态机
  state: string;
  stateT: number;
  skillIdx: number;
  tx: number;
  ty: number;
}

export interface Player {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  dirX: number; // 最近一次移动方向
  dirY: number;
  left: boolean;
  moving: boolean;
  anim: number;
  iframe: number;
  hurtFlash: number;
}

export interface WeaponState {
  id: WeaponId;
  lv: number;
  evo: boolean;
  t: number; // 冷却计时
  active: number; // 持续中的剩余时间（青釭剑）
  angle: number;
  burst: number; // 连发剩余
  hits: Map<number, number>; // 敌人 uid -> 下次可受伤时间
}

export interface PassiveState {
  id: PassiveId;
  lv: number;
}

export type ProjKind = 'bolt' | 'pot' | 'horse' | 'sword';

export interface Projectile {
  kind: ProjKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  pierce: number;
  knock: number;
  life: number;
  hitSet: Set<number>;
  // 火油罐：飞行到目标点后落地
  tx: number;
  ty: number;
  t: number;
  dur: number;
  area: number;
  burn: number;
  tick: number;
  slow: number;
  sprite: string;
  rot: number;
  left: boolean;
}

export interface FirePool {
  x: number;
  y: number;
  r: number;
  dmg: number;
  tick: number;
  tickT: number;
  life: number;
  maxLife: number;
  slow: number;
}

export interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  sprite: string;
  rot: number;
  spin: boolean;
}

export type PickupKind = 'gem' | 'coin' | 'bun' | 'magnet' | 'bomb' | 'chest';

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  value: number;
  vx: number;
  vy: number;
  pulled: boolean;
  t: number;
  boss: boolean;
}

export interface Breakable {
  x: number;
  y: number;
  r: number;
  hp: number;
  kind: 'lantern' | 'cart';
  flash: number;
  hits: number;
}

export interface Fx {
  kind: 'thrust' | 'spark' | 'puff' | 'explo' | 'ring' | 'slash' | 'text' | 'num' | 'warn' | 'beam' | 'levelring';
  x: number;
  y: number;
  t: number;
  dur: number;
  a?: number; // 角度
  len?: number;
  w?: number;
  r?: number;
  text?: string;
  color?: string;
  vy?: number;
  big?: boolean;
}

/** 首领技能预警 */
export interface Warning {
  kind: 'circle' | 'line';
  x: number;
  y: number;
  r: number;
  a: number;
  len: number;
  t: number;
  dur: number;
}

export function newEnemy(): Enemy {
  return {
    uid: 0, def: null, boss: null, isMidBoss: false, x: 0, y: 0, r: 6, hp: 1, maxHp: 1, speed: 30, dmg: 5, mass: 1, exp: 1,
    sprite: 'u_wei_spear', scale: 1, elite: false, anim: Math.random() * 4, left: false, flash: 0, kx: 0, ky: 0, slow: 0, slowT: 0,
    atkCd: 0, shootT: Math.random() * 2, dead: false, fixedDir: false, vx: 0, vy: 0, life: 0,
    state: 'move', stateT: 0, skillIdx: 0, tx: 0, ty: 0,
  };
}

export function newProjectile(kind: ProjKind): Projectile {
  return {
    kind, x: 0, y: 0, vx: 0, vy: 0, r: 3, dmg: 0, pierce: 1, knock: 0, life: 2, hitSet: new Set(),
    tx: 0, ty: 0, t: 0, dur: 0, area: 0, burn: 0, tick: 0.3, slow: 0, sprite: 'bolt', rot: 0, left: false,
  };
}
