import { PixelImage, art } from '../pixel';
import { chest, coinFrames, yuanbao, bun, magnet, bomb } from './items';

// UI 图标（约 14x14，界面中整数倍放大显示）

function spearIcon(shaft: string, head: string, tassel: string): PixelImage {
  const p = new PixelImage(14, 14);
  p.line(1, 12, 10, 3, shaft);
  p.line(2, 12, 11, 3, shaft === 'U' ? 'z' : 'N');
  p.rect(10, 1, 3, 3, head); p.set(13, 0, head); p.set(12, 0, 'w'); p.set(10, 1, '.');
  p.set(9, 5, tassel); p.set(8, 5, tassel); p.set(9, 6, tassel); p.set(8, 6, tassel); p.set(7, 6, tassel);
  return p.outline();
}

function swordIcon(blade: string, glow: string): PixelImage {
  const p = new PixelImage(14, 14);
  p.line(4, 9, 11, 2, blade);
  p.line(5, 9, 12, 2, glow);
  p.line(3, 8, 5, 10, 'y'); p.line(2, 7, 6, 11, 'y');
  p.line(1, 12, 3, 10, 'U'); p.set(0, 13, 'y');
  return p.outline();
}

const ICONS: Record<string, () => PixelImage> = {
  // —— 武器 ——
  w_spear: () => spearIcon('S', 'w', 'R'),
  w_spear_evo: () => {
    const p = new PixelImage(16, 16);
    p.ring(7.5, 7.5, 7, 'y');
    p.blit(spearIcon('Y', 'w', 'R'), 0, 0);
    return p.outline();
  },
  w_sword: () => swordIcon('S', 'c'),
  w_sword_evo: () => {
    const p = new PixelImage(16, 16);
    p.blit(swordIcon('B', 'c').flipX(), 3, 0);
    p.blit(swordIcon('S', 'c'), 0, 1);
    return p;
  },
  w_crossbow: () => art([
    '......U.....',
    '.UUUUUUUUU..',
    'U....UNN..U.',
    '.....UNNSSSw',
    '.....UNN....',
    '.....UU.....',
    '.....UU.....',
    '....UzzU....',
  ]),
  w_crossbow_evo: () => art([
    '......y.....',
    '.yyyyyyyyy..',
    'y....yRR..y.',
    '....yyRRYYYw',
    '.....yRR..Yw',
    '.....yy..YYw',
    '.....yy.....',
    '....yooy....',
  ]),
  w_horse: () => art([
    '.....SS...',
    '....SwwS..',
    '...SwwkwS.',
    '..SSwwwwwN',
    '.SSwwSSSN.',
    'SSwwwS....',
    'SwwwwS....',
    'SwwwwS....',
  ]),
  w_horse_evo: () => art([
    '..c..SS...',
    '.c..SwwS..',
    'c..SwwkwS.',
    '..SSwwwwwN',
    '.SScwSSSN.',
    'SSwcwS..c.',
    'SwwwcS.c..',
    'SwwwwSc...',
  ]),
  w_fire: () => art([
    '....y.....',
    '...yYo....',
    '..oyYyo...',
    '...UUU....',
    '..uuuuu...',
    '.uuLLuuu..',
    '.uLuuuuu..',
    '..uuuuu...',
    '...UUU....',
  ]),
  w_fire_evo: () => art([
    '.y..y...y.',
    'oyY.Yo.yYo',
    'oyYyYyoyYo',
    'ooYYYYYYoo',
    '.oyyYYyyo.',
    'RooyyyyooR',
    '.RRooooRR.',
    '..RRRRRR..',
  ]),
  w_aura: () => {
    const p = new PixelImage(14, 14);
    p.ring(6.5, 6.5, 6, 'c'); p.ring(6.5, 6.5, 4, 'B'); p.ring(6.5, 6.5, 2, 'w');
    p.set(6, 0, '.'); p.set(7, 0, '.'); p.set(13, 6, '.'); p.set(0, 7, '.'); p.set(7, 13, '.');
    return p.outline();
  },
  w_aura_evo: () => {
    const p = new PixelImage(14, 14);
    p.ring(6.5, 6.5, 6, 'y'); p.ring(6.5, 6.5, 4, 'o'); p.disc(6.5, 6.5, 2, 'Y');
    p.set(2, 2, 'R'); p.set(11, 11, 'R'); p.set(11, 2, 'R'); p.set(2, 11, 'R');
    return p.outline();
  },
  w_blade: () => art([
    '.......SSSS',
    '......SwwSS',
    '.....SwwSS.',
    '....SwSSG..',
    '...U.GGG...',
    '..U..G.....',
    '.U.........',
    'U..........',
  ]),
  w_blade_evo: () => {
    const p = new PixelImage(16, 16);
    p.ring(7.5, 7.5, 7, 'G');
    p.ring(7.5, 7.5, 5, 'g');
    p.blit(PixelImage.fromRows(['....SSS', '...SwwS', '..SwSS.', '.UGG...', 'U......']), 4, 5);
    return p.outline();
  },
  w_snake: () => art([
    '........S.',
    '.......SwS',
    '......S.S.',
    '.....S....',
    '....S.....',
    '...U......',
    '..U.......',
    '.U........',
    'U.........',
  ]),
  w_snake_evo: () => {
    const p = new PixelImage(16, 16);
    p.ring(7.5, 7.5, 7, 'R');
    p.ring(7.5, 7.5, 4, 'r');
    p.line(2, 13, 12, 3, 'U');
    p.line(12, 3, 14, 1, 'w'); p.set(13, 3, 'S'); p.set(11, 1, 'S');
    return p.outline();
  },
  w_fan: () => art([
    '..wwww..',
    '.wwSSww.',
    'wwSwwSww',
    'wSwwwwSw',
    '.wwwwww.',
    '..wwww..',
    '...UU...',
    '...UU...',
  ]),
  w_fan_evo: () => {
    const p = new PixelImage(16, 16);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.line(8, 8, Math.round(8 + Math.cos(a) * 7), Math.round(8 + Math.sin(a) * 7), i % 2 ? 'B' : 'c');
    }
    p.disc(8, 8, 3, 'w'); p.set(8, 8, 'b');
    return p.outline();
  },
  w_halberd: () => art([
    '.......YY..',
    '......YYwY.',
    '.....YYY...',
    '....YUYY...',
    '...U..Y....',
    '..U........',
    '.U.........',
    'U..........',
  ]),
  w_halberd_evo: () => {
    const p = new PixelImage(16, 16);
    p.ring(7.5, 7.5, 7, 'R');
    p.ring(7.5, 7.5, 6, 'o');
    p.line(3, 12, 12, 3, 'Y'); p.rect(10, 2, 3, 3, 'y'); p.set(13, 1, 'w'); p.set(4, 4, 'R'); p.set(11, 11, 'R');
    return p.outline();
  },
  shard: () => art([
    '...y...',
    '..yYy..',
    '.yYwYy.',
    'yYYYYoy',
    '.yYYoy.',
    '..yoy..',
    '...y...',
  ]),
  // —— 被动 ——
  p_horseshoe: () => art([
    '.NN..NN.',
    'NsS..SsN',
    'Ns....sN',
    'Ns....sN',
    'NsS..SsN',
    '.NsSSsN.',
    '..NNNN..',
  ]),
  p_armor: () => art([
    '.SS..SS.',
    'SwSSSSwS',
    'SSwSSwSS',
    '.SSnnSS.',
    '.SnSSnS.',
    '.SSnnSS.',
    '.ySSSSy.',
    '..yyyy..',
  ]),
  p_book: () => art([
    'pUpUpUpU',
    'pUpUpUpU',
    'pUpUpUpU',
    'pUpUpUpU',
    'pUpUpUpU',
    'pUpUpUpU',
    'RRRRRRRR',
  ]),
  p_flag: () => art([
    'yRRRRRR.',
    'URRYYRR.',
    'URRYRRR.',
    'URRRRR..',
    'URRR....',
    'U.......',
    'U.......',
    'UU......',
  ]),
  p_tiger: () => art([
    '..yyyyy.',
    '.yYYkYyy',
    'yYYYYYyo',
    'yyykYYyo',
    '.yyyyyyo',
    '.yo.yo.o',
    '.oo.oo..',
  ]),
  p_lingzhi: () => art([
    '.MMMMMM.',
    'MfMMMMfM',
    'MMMfMMMM',
    '.mmmmmm.',
    '...pp...',
    '...pE...',
    '..ppEE..',
  ]),
  p_pouch: () => art([
    '..y..y..',
    '...yy...',
    '..RRRR..',
    '.RRYRRR.',
    'RRYYYRRR',
    'RRRYRRRr',
    '.RRRRrr.',
  ]),
  p_bowl: () => art([
    '.Y.yY.y.',
    'yYyYYyYy',
    'UuuuuuuU',
    '.UuyyuU.',
    '..UuuU..',
    '...UU...',
    '..UUUU..',
  ]),
  p_seal: () => art([
    '..gGGg..',
    '.gGkkGg.',
    '..gGGg..',
    '...gg...',
    'gggggggg',
    'gGgGgGgG',
    'GGGGGGGG',
    'RRRRRRRR',
  ]),
  // —— 货币 ——
  gold: () => coinFrames()[0],
  yuanbao: () => yuanbao(),
  stamina: () => art([
    '....LLL.',
    '...LuuLL',
    '..LuLuuL',
    '..LuuuuL',
    '..uLuuu.',
    '.wUuuU..',
    'ww.UU...',
    'w.......',
  ]),
  iron: () => art([
    '..NNN..',
    '.NsSsN.',
    'NsSwSsN',
    'NssSssN',
    '.NsssN.',
    '..NNN..',
  ]),
  exp: () => art(['.B.', 'BcB', 'bBb', '.b.']),
  // —— 装备部位 ——
  e_weapon: () => spearIcon('S', 'w', 'R'),
  e_helm: () => art([
    '....RR...',
    '...RR....',
    '..SSSSS..',
    '.SwSSSSS.',
    'SSSSSSSSS',
    'SSnnnnnSS',
    'SS.....SS',
    'yS.....Sy',
  ]),
  e_armor: () => art([
    '.SS...SS.',
    'SwSSSSSwS',
    'SSwSSSwSS',
    '.SSyyySS.',
    '.SwSSSwS.',
    '.SSwSwSS.',
    '.SSSSSSS.',
    '.nnnnnnn.',
  ]),
  e_boots: () => art([
    '.UUU....',
    '.UuU....',
    '.UuU....',
    '.UuU....',
    '.UuUUUU.',
    'UuuuuuuU',
    'zzzzzzzz',
  ]),
  e_mount: () => ICONS.w_horse(),
  e_jade: () => art([
    '...R...',
    '...R...',
    '..ggg..',
    '.gGgGg.',
    '.gg.gg.',
    '.gGgGg.',
    '..ggg..',
    '..R.R..',
    '.R...R.',
  ]),
  // —— 系统 ——
  gear: () => {
    const p = new PixelImage(12, 12);
    p.disc(5.5, 5.5, 4.5, 'N'); p.disc(5.5, 5.5, 2, '.');
    for (const [x, y] of [[5, 0], [6, 0], [0, 5], [0, 6], [11, 5], [11, 6], [5, 11], [6, 11], [1, 1], [10, 10], [10, 1], [1, 10]]) p.set(x, y, 'N');
    return p.outline();
  },
  calendar: () => art([
    '.R....R.',
    'RRRRRRRR',
    'RRRRRRRR',
    'wwwwwwww',
    'wkwkwkww',
    'wwwwwwww',
    'wkwkwRRw',
    'wwwwwRRw',
  ]),
  scroll: () => art([
    'UpppppppU',
    'U.pppppp.',
    '.pkkkkkp.',
    '.pppppppp',
    '.pkkkkpp.',
    '.pppppppp',
    '.pkkkpp..',
    'Upppppppp',
    'UU......U',
  ]),
  tent: () => art([
    '....R....',
    '....U....',
    '...ppp...',
    '..pEpEp..',
    '.pEpppEp.',
    'pEppUppEp',
    'ppppUpppp',
    'EEEEUEEEE',
  ]),
  trophy: () => art([
    'yyyyyyy',
    'yYYYYYy',
    '.yYYYy.',
    '..yyy..',
    '...y...',
    '..yyy..',
    '.UUUUU.',
  ]),
  share: () => art([
    '.....gg.',
    '...gggg.',
    'gggggggg',
    'g..gggg.',
    'g....gg.',
    'g.......',
    'gggggg..',
  ]),
  video: () => art([
    'yyyyyyyyy',
    'yRRRRRRRy',
    'yRRwRRRRy',
    'yRRwwRRRy',
    'yRRwwwRRy',
    'yRRwwRRRy',
    'yRRwRRRRy',
    'yyyyyyyyy',
  ]),
  lock: () => art([
    '..SSS..',
    '.S...S.',
    '.S...S.',
    'yyyyyyy',
    'yYYkYYy',
    'yYYkYYy',
    'yyyyyyy',
  ]),
  star: () => art([
    '...y...',
    '..yYy..',
    'yyyYyyy',
    '.yYYYy.',
    '.yyoyy.',
    'yo...oy',
  ]),
  atk: () => art([
    'S......S',
    '.S....S.',
    '..S..S..',
    '...SS...',
    '...SS...',
    '..y..y..',
    '.U....U.',
    'U......U',
  ]),
  hp: () => art([
    '.RR.RR.',
    'RwRRRRR',
    'RRRRRRR',
    '.RRRRR.',
    '..RRR..',
    '...R...',
  ]),
  def: () => art([
    'SSSSSSS',
    'SwSSSSS',
    'SSSnSSS',
    'SSnnnSS',
    '.SSnSS.',
    '..SSS..',
    '...S...',
  ]),
  speed: () => ICONS.p_horseshoe(),
  skull: () => art([
    '.wwwww.',
    'wwwwwww',
    'wkkwkkw',
    'wkkwkkw',
    'wwwkwww',
    '.wwwww.',
    '.w.w.w.',
  ]),
  clock: () => {
    const p = new PixelImage(11, 11);
    p.disc(5, 5, 5, 'w'); p.ring(5, 5, 5, 'N');
    p.line(5, 5, 5, 2, 'k'); p.line(5, 5, 7, 6, 'R');
    return p.outline();
  },
  pause: () => art(['ww.ww', 'ww.ww', 'ww.ww', 'ww.ww', 'ww.ww', 'ww.ww']),
  sidebar: () => art([
    'yyyyyyyy',
    'yBBBBBBy',
    'yBwwwwBy',
    'yBBBBBBy',
    'yBwwwBBy',
    'yBBBBBBy',
    'yBwwwwBy',
    'yyyyyyyy',
  ]),
  home: () => art([
    '...RR...',
    '..RRRR..',
    '.RRRRRR.',
    'RRRRRRRR',
    '.uuuuuu.',
    '.uuUUuu.',
    '.uuUUuu.',
  ]),
  chest: () => chest(false),
  chest_gold: () => chest(false, true),
  bun: () => bun(),
  magnet: () => magnet(),
  bomb: () => bomb(),
  revive: () => art([
    '..yyy..',
    '.y...y.',
    'y..R..y',
    'y.RRR.y',
    'y..R..y',
    '.y...y.',
    '..yyy..',
  ]),
};

export const ICON_NAMES = Object.keys(ICONS);
export function iconImage(name: string): PixelImage {
  return (ICONS[name] || ICONS.star)();
}
