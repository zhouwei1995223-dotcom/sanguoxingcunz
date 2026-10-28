// 封面用的精灵图：全部取自游戏里的实际美术
import { heroFramesFor } from '../../src/gfx/art/heroes';
import { soldierFrames, generalFrames } from '../../src/gfx/art/units';
import { SOLDIER_STYLES, GENERAL_STYLES } from '../../src/gfx/art/roster';
import { banner, pine, deadTree, rock } from '../../src/gfx/art/env';
import { sparkFrames, puffFrames } from '../../src/gfx/art/items';
import { PixelImage } from '../../src/gfx/pixel';
export function sprites(): Record<string, PixelImage> {
  const o: Record<string, PixelImage> = {};
  heroFramesFor('zhaoyun').forEach((f, i) => (o['hero' + i] = f));
  for (const k of ['wei_spear', 'wei_shield', 'wei_archer', 'wei_heavy']) soldierFrames(SOLDIER_STYLES[k]).forEach((f, i) => (o[k + i] = f));
  generalFrames(GENERAL_STYLES.wei_cavalry).forEach((f, i) => (o['cav' + i] = f));
  o.bannerB = banner('b'); o.bannerR = banner('R'); o.pine = pine(); o.deadTree = deadTree(); o.rock = rock();
  sparkFrames().forEach((f, i) => (o['spark' + i] = f));
  puffFrames().forEach((f, i) => (o['puff' + i] = f));
  return o;
}
