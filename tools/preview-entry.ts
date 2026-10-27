import { heroFramesFor, HERO_IDS } from '../src/gfx/art/heroes';
import { iconImage, ICON_NAMES } from '../src/gfx/art/icons';
import { PixelImage } from '../src/gfx/pixel';
import { zhaoyunFramesV2 } from '../src/gfx/art/zhaoyun';
export function collectPreview(): { name: string; img: PixelImage }[] {
  const out: { name: string; img: PixelImage }[] = [];
  for (const id of HERO_IDS) heroFramesFor(id).forEach((img, i) => out.push({ name: 'hero_' + id + i, img }));
  zhaoyunFramesV2().forEach((img, i) => out.push({ name: 'v2_zhaoyun' + i, img }));
  ICON_NAMES.forEach((n) => out.push({ name: 'icon_' + n, img: iconImage(n) }));
  return out;
}
