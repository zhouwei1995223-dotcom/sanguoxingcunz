import type { GeneralStyle, SoldierStyle } from './units';

// 兵种 / 武将外观表。战斗数据在 data/enemies.ts，通过 id 关联。

export const SOLDIER_STYLES: Record<string, SoldierStyle> = {
  // 曹军（蓝）
  wei_spear: { helm: 'b', helmDark: 'K', armor: 'B', armorDark: 'b', pants: 'n', weapon: 'spear', plume: 'R' },
  wei_shield: { helm: 'N', helmDark: 'n', armor: 'n', armorDark: 'K', pants: 'K', weapon: 'shield' },
  wei_archer: { helm: 'u', helmDark: 'U', armor: 'u', armorDark: 'U', pants: 'n', weapon: 'bow', headband: 'B' },
  wei_heavy: { helm: 'S', helmDark: 'N', armor: 'N', armorDark: 'n', pants: 'K', weapon: 'halberd', plume: 'b', big: true },
  // 流寇 / 山贼（黄巾残部）
  bandit: { helm: 'u', helmDark: 'U', armor: 'E', armorDark: 'u', pants: 'U', weapon: 'club', headband: 'Y' },
  // 桂阳郡兵（赭红）
  gy_spear: { helm: 'l', helmDark: 'r', armor: 'L', armorDark: 'l', pants: 'U', weapon: 'spear', plume: 'y' },
  gy_shield: { helm: 'r', helmDark: 'z', armor: 'l', armorDark: 'r', pants: 'z', weapon: 'shield' },
  gy_archer: { helm: 'U', helmDark: 'z', armor: 'E', armorDark: 'u', pants: 'z', weapon: 'bow', headband: 'R' },
  // 西凉羌兵（韩德部，紫黑）
  qiang_spear: { helm: 'm', helmDark: 'z', armor: 'M', armorDark: 'm', pants: 'z', weapon: 'spear', plume: 'Y', skin: 'E' },
  qiang_club: { helm: 'z', helmDark: 'k', armor: 'm', armorDark: 'z', pants: 'k', weapon: 'club', headband: 'M', skin: 'E' },
  // 魏国精锐（黑金）
  elite_guard: { helm: 'K', helmDark: 'k', armor: 'K', armorDark: 'k', pants: 'k', weapon: 'halberd', plume: 'y', big: true },
};

export const GENERAL_STYLES: Record<string, GeneralStyle> = {
  // 骑兵（小兵）
  wei_cavalry: { horse: 'brown', colors: { R: 'B', r: 'b', S: 'b', w: 'B', G: 'n', g: 'N', n: 'K', y: 'U' }, cloth: 'n', trim: 'U', weapon: 'spear' },
  tiger_cavalry: { horse: 'black', colors: { R: 'y', r: 'o', S: 'K', w: 'n', G: 'k', g: 'K', n: 'k', y: 'y' }, cloth: 'k', trim: 'y', weapon: 'halberd' },
  qiang_cavalry: { horse: 'brown', colors: { R: 'Y', r: 'y', S: 'm', w: 'M', G: 'z', g: 'm', n: 'z', y: 'U', q: 'E' }, cloth: 'm', trim: 'y', weapon: 'spear' },
  // 武将
  xiahouen: { horse: 'brown', colors: { R: 'B', r: 'b', S: 'B', w: 'c', G: 'b', g: 'B', n: 'n' }, cloth: 'b', trim: 'y', weapon: 'sword', weaponColor: 'c' },
  caochun: { horse: 'black', colors: { R: 'y', r: 'o', S: 'K', w: 'N', G: 'k', g: 'r', n: 'k' }, cloth: 'r', trim: 'y', weapon: 'halberd' },
  chenying: { horse: 'brown', colors: { R: 'y', r: 'U', S: 'l', w: 'L', G: 'U', g: 'u', n: 'z' }, cloth: 'l', trim: 'y', weapon: 'fork' },
  baolong: { horse: 'black', colors: { R: 'z', r: 'k', S: 'U', w: 'u', G: 'z', g: 'U', n: 'k', q: 'E' }, cloth: 'U', trim: 'o', weapon: 'club' },
  xuhuang: { horse: 'brown', colors: { R: 'b', r: 'n', S: 'N', w: 'S', G: 'n', g: 'b', n: 'K' }, cloth: 'n', trim: 'S', weapon: 'axe' },
  zhanghe: { horse: 'white', colors: { R: 'M', r: 'm', S: 'm', w: 'M', G: 'K', g: 'n', n: 'k' }, cloth: 'm', trim: 'y', weapon: 'spear' },
  hanying: { horse: 'brown', colors: { R: 'Y', r: 'y', S: 'm', w: 'f', G: 'z', g: 'm', n: 'z' }, cloth: 'M', trim: 'y', weapon: 'blade' },
  hande: { horse: 'black', colors: { R: 'R', r: 'r', S: 'z', w: 'm', G: 'r', g: 'R', n: 'k', q: 'E' }, cloth: 'z', trim: 'R', weapon: 'axe', weaponColor: 'S' },
  suyong: { horse: 'brown', colors: { R: 'B', r: 'b', S: 'n', w: 'N', G: 't', g: 'd', n: 'K' }, cloth: 't', trim: 'S', weapon: 'blade' },
  caozhen: { horse: 'gold', colors: { R: 'R', r: 'r', S: 'y', w: 'Y', G: 'b', g: 'B', n: 'U' }, cloth: 'b', trim: 'Y', weapon: 'halberd', weaponColor: 'Y' },
  // 白马义从（赵云的召唤物）
  baima: { horse: 'ghost', colors: { R: 'w', r: 'c', S: 'c', w: 'w', G: 'B', g: 'c', n: 'b', y: 'w', q: 'c', k: 'b' }, cloth: 'B', trim: 'w', weapon: 'spear', weaponColor: 'w' },
};
