import { PixelImage } from '../src/gfx/pixel';
import { PALETTE } from '../src/gfx/palette';
import { GUANYU_COLORS, GUANYU_ROWS, GUANYU_SKIN_ROWS } from '../docs/art/guanyu-preview-data';

Object.assign(PALETTE, GUANYU_COLORS);

export function guanyuFrames(skin = false): PixelImage[] {
  return (skin ? GUANYU_SKIN_ROWS : GUANYU_ROWS).map((rows) => PixelImage.fromRows(rows));
}
