import { zhaoyunStanding, zhaoyunMounted } from '../src/gfx/art/chibi';
import { heroFramesFor } from '../src/gfx/art/heroes';
export const concepts = () => ({ standing: zhaoyunStanding(), mounted: zhaoyunMounted(), old: heroFramesFor('zhaoyun')[0] });
