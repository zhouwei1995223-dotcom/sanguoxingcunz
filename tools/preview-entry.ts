import { heroFrames } from '../src/gfx/art/hero';
import { soldierFrames, generalFrames } from '../src/gfx/art/units';
import { SOLDIER_STYLES, GENERAL_STYLES } from '../src/gfx/art/roster';
import * as I from '../src/gfx/art/items';
import { decorImage, THEMES } from '../src/gfx/art/env';
import { iconImage, ICON_NAMES } from '../src/gfx/art/icons';
import { PixelImage } from '../src/gfx/pixel';
export function collectPreview(): { name: string; img: PixelImage }[] {
  const out: { name: string; img: PixelImage }[] = [];
  const add = (name: string, img: PixelImage) => out.push({ name, img });
  heroFrames().forEach((img, i) => add('hero' + i, img));
  for (const k in SOLDIER_STYLES) add('sol_' + k, soldierFrames(SOLDIER_STYLES[k])[0]);
  for (const k in GENERAL_STYLES) add('gen_' + k, generalFrames(GENERAL_STYLES[k])[0]);
  [0,1,2].forEach((k) => add('item_gem' + k, I.gem(k as 0)));
  I.coinFrames().forEach((c, i) => add('item_coin' + i, c));
  add('item_yb', I.yuanbao()); add('item_bun', I.bun()); add('item_mag', I.magnet()); add('item_bomb', I.bomb());
  add('item_chest', I.chest(false)); add('item_chesto', I.chest(true)); add('item_chestg', I.chest(false, true));
  I.lanternFrames().forEach((c, i) => add('item_lan' + i, c)); add('item_cart', I.cart());
  add('item_arrow', I.arrow()); add('item_bolt', I.bolt()); add('item_fs', I.flyingSword()); add('item_pot', I.firePot());
  I.flameFrames().forEach((c, i) => add('item_fl' + i, c)); add('item_stone', I.stone()); add('item_fork', I.forkProj());
  I.sparkFrames().forEach((c, i) => add('fx_sp' + i, c)); I.puffFrames().forEach((c, i) => add('fx_puff' + i, c));
  I.explosionFrames().forEach((c, i) => add('fx_ex' + i, c));
  '0123456789+'.split('').forEach((d) => add('dig' + d, I.digit(d, 'w')));
  ['tree','pine','bush','rock','bigRock','grass','flowerR','reeds','deadTree','banner','bones','stumps'].forEach((d) => add('env_' + d, decorImage(d)));
  add('env_snowpine', decorImage('pine').recolor(THEMES.jigu.recolor!));
  ICON_NAMES.forEach((n) => add('icon_' + n, iconImage(n)));
  return out;
}
