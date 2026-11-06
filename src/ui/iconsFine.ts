import { PixelImage, art } from '../gfx/pixel';

/**
 * 精细像素风图标集（16x16 内容网格 + 1px 描边 = 18x18 像素精灵）
 * 相比原版 6x6 ~ 9x9 的粗颗粒简陋像素图标，像素密度提升约 4~6 倍，
 * 采用左上光源的三层体积光（高光 / 主色 / 暗部 / 内衬深色折线）绘制，
 * 既保持纯正像素风（与像素武将、营帐完全统一），又具备精致的 16-bit 细节表现。
 */

const FINE_ICONS: Record<string, () => PixelImage> = {
  // ==================== 货币与资源 ====================
  /** 五铢古铜钱（外圆内方、郭线高光、四方篆纹） */
  gold: () => art([
    '.....yyyyyy.....',
    '...yyYYYYYYyy...',
    '..yYYwwwwYYyoy..',
    '.yYYwyyyyyyYyoy.',
    '.yYwykYYYYkyYoy.',
    'yYYyk......kyYoy',
    'yYyyk......kyyoy',
    'yYyyk......kyyoy',
    'yYyyk......kyyoy',
    'yYYyk......kyooo',
    '.yYyykkkkkkyooU.',
    '.yYYyyyyyyyyooU.',
    '..yYYyyyyyyooU..',
    '...yyooooooUU...',
    '.....UUUUUU.....',
  ]),

  /** 翘角金元宝（双耳高翘、中央圆润金肚、三层折面立体阴影） */
  yuanbao: () => art([
    '.yy..........yy.',
    'yYYy..yyyy..yYYy',
    'yYwYyYYYYYYyYwYy',
    'yYYyYYwwwwYYyYYy',
    'yYYyYwwwwwwYyYYy',
    '.yYYYYYYYYYYYYy.',
    '.yyyyyyyyyyyyyy.',
    '..yYYYYYYYYYYy..',
    '..yYYyyyyyyYYy..',
    '...yyyyyyyyyy...',
    '...oooooooooo...',
    '....oooooooo....',
    '.....UUUUUU.....',
  ]),

  /** 蜜汁烤鸡腿（饱满鼓槌肉、酥脆高光皮、焦糖暗部、洁白脆骨柄） */
  stamina: () => art([
    '.......LLLLL....',
    '.....LLqqqqqLL..',
    '....LqwwqqqqqqL.',
    '...LqwwqqqqqqLuL',
    '...LqqqqqqLLuuuu',
    '...LqqqLLLuuuuuU',
    '...LqqLuuuuuuuuU',
    '....LLuuuuuuuuU.',
    '....puLuuuuuuU..',
    '...wpU.UUUUUU...',
    '..wwp...........',
    '.wwwpU..........',
    'wwp.ww..........',
    '.w..w...........',
  ]),

  /** 百炼玄铁矿晶（八面体多切面寒铁晶簇、冷青高光、深钢折面） */
  iron: () => art([
    '......SSSS......',
    '....SSwwwwSS....',
    '...SwcSSSSssN...',
    '..SwcSSSSsssNN..',
    '.SwcSSSssNsssNN.',
    '.SwSSSssNsssssN.',
    'SwSSSssNssssnnnN',
    'SSSSssNssssnnnnN',
    'sSSssNssssnnnnnN',
    '.sSsNssssnnnnnN.',
    '.ssNssssnnnnnnN.',
    '..NssssnnnnnnN..',
    '...NssnnnnnnN...',
    '....NNNNNNNN....',
  ]),

  /** 紫晶将魂碎片（菱形多切面晶石） */
  shard: () => art([
    '.......ff.......',
    '......fwwf......',
    '.....fwMMMf.....',
    '....fwMMMMmf....',
    '...fwMMMMmmmf...',
    '..fwMMMmmmmmmf..',
    '.fwMMMmmmmmmmmf.',
    'fwMMMmmwMMMMmmmf',
    '.fMMmmMMMMMMmmf.',
    '..fMmmMMMMMmmf..',
    '...fmmMMMMmmf...',
    '....fmmMMmmf....',
    '.....fmmmmf.....',
    '......fmmf......',
    '.......ff.......',
  ]),

  /** 经验灵玉 */
  exp: () => art([
    '.....cc.....',
    '...ccwwcc...',
    '..cwBBBBcc..',
    '.cwBBBBbbbc.',
    'cwBBBBbbbbbc',
    'cBBBBbbbbbbc',
    '.cBBbbbbbbc.',
    '..cbbbbbbc..',
    '...cbbbbc...',
    '.....bb.....',
  ]),

  // ==================== 侧边栏与系统图标 ====================
  /** 黄历签到簿（黄金双挂环、朱砂眉头、九宫格点阵、朱批大勾） */
  calendar: () => art([
    '..yy........yy..',
    '..YY........YY..',
    'RRRRRRRRRRRRRRRR',
    'Rffffffffffffffr',
    'RRRRRRRRRRRRRRrr',
    'rrrrrrrrrrrrrrrr',
    'pppppppppppppppp',
    'pwwwwwwwwwwwwwwp',
    'pwkwkwkwkwkwkwwp',
    'pwwwwwwwwwwwRRwp',
    'pwkwkwkwkwwRRwwp',
    'pwwwwwwwRRwRRwwp',
    'pwkwkwkwRRRRwwwp',
    'pwwwwwwwwRRwwwwp',
    'pppppppppppppppp',
    'qqqqqqqqqqqqqqqq',
  ]),

  /** 百宝木箱（立体弧顶、双道黄金铆钉箍带、中央兽面金锁扣） */
  chest: () => art([
    '..yyyyyyyyyyyy..',
    '.yqqyLLLLLLyqqy.',
    'yqLLyLLLLLLyLLqy',
    'yLLLLyLLLLyLLLLy',
    'yuuuuuyLLyuuuuuy',
    'yyyyyyyyyyyyyyyy',
    'UUUUUYYYYYYUUUUU',
    'uuuuuYYkkYYuuuuu',
    'uLLLuYYkkYYuLLLu',
    'uLLLuYYYYYYuLLLu',
    'uuuuuyyyyyyuuuuu',
    'uLLLyuuuuuuyLLLu',
    'uuuuuuuuuuuuuuuu',
    'UUUUUUUUUUUUUUUU',
  ]),

  /** 黄金宝箱（鎏金箱体、红宝石锁心） */
  chest_gold: () => art([
    '..YYYYYYYYYYYY..',
    '.YwwYYYYYYYYwwY.',
    'YwYYwYYYYYYwYYwY',
    'YYYYYwYYYYwYYYYY',
    'yyyyyywYYwyyyyyy',
    'YYYYYYYYYYYYYYYY',
    'oooooYYYYYYooooo',
    'yyyyyYYRRYYyyyyy',
    'yYYYyYYRRYYyYYYy',
    'yYYYyYYYYYYyYYYy',
    'yyyyyoooooooyyyy',
    'yYYYyYYYYYYyYYYy',
    'yyyyyyyyyyyyyyyy',
    'oooooooooooooooo',
  ]),

  /** 军令卷轴（上下朱漆金头轴杆、宣纸卷面、朱砂官印与墨书） */
  scroll: () => art([
    'yRRRRRRRRRRRRRRy',
    'YuuuuuuuuuuuuuuY',
    '..pppppppppppp..',
    '..pwwwwwwwwwwp..',
    '..pwzzzzzRRwwp..',
    '..pwwwwwwRRwwp..',
    '..pwzzzzwwwwqp..',
    '..pwwwwwwwwqqp..',
    '..pwzzzzzzwqqp..',
    '..pwwwwwwwwqqp..',
    '..pwzzzzwwwqqp..',
    '..ppppppppppqp..',
    '..qqqqqqqqqqqq..',
    'yRRRRRRRRRRRRRRy',
    'YuuuuuuuuuuuuuuY',
  ]),

  /** 中军帅帐（迎风红旗、红白条纹宝顶、鎏金流苏檐、帐门篝火） */
  tent: () => art([
    '.......yRRRR....',
    '.......yRYYR....',
    '.......yRRR.....',
    '.......y........',
    '.....RRRRRR.....',
    '...RRwwRRwwRR...',
    '..RwwRRwwRRwwR..',
    '.RwwRRwwwwRRwwR.',
    'yyyyyyyyyyyyyyyy',
    'pRRppwwwwwwppRRp',
    'pRRpwwzzzzwwpRRp',
    'ppppwzzzzzzwpppp',
    'ppppwzzYYzzwpppp',
    'qqqqwzYooYzwqqqq',
    'UUUUUzzzzzzUUUUU',
  ]),

  /** 双剑交锋（挑战/攻击：双宽刃宝剑交叉、黄金护手、朱红剑柄） */
  atk: () => art([
    'ww............SS',
    'wSw..........SwS',
    '.wSw........SwS.',
    '..wSw......SwS..',
    '...wSw....SwS...',
    '....wSw..SwS....',
    '..yy.wSwSwS.yy..',
    '...yy.wSwS.yy...',
    '....yySwSwyy....',
    '...SwS.yy.wSw...',
    '..yy..y..y..yy..',
    '.RR..U....U..RR.',
    'RR...........RR.',
    'y..............y',
  ]),

  kills: () => art([
    'ww............SS',
    'wSw..........SwS',
    '.wSw........SwS.',
    '..wSw......SwS..',
    '...wSw....SwS...',
    '....wSw..SwS....',
    '..yy.wSwSwS.yy..',
    '...yy.wSwS.yy...',
    '....yySwSwyy....',
    '...SwS.yy.wSw...',
    '..yy..y..y..yy..',
    '.RR..U....U..RR.',
    'RR...........RR.',
    'y..............y',
  ]),

  /** 凌烟金樽奖杯（双耳高脚金爵、镶嵌红宝石、乌木鎏金底座） */
  trophy: () => art([
    '.YYYYYYYYYYYYYY.',
    'yYwwwwYYYYYYYYYy',
    'y.yYYwYYYYYYYy.y',
    'y.yYYwYYRRYYYy.y',
    'y..yYYYYRRYYy..y',
    '.y.yYYYYYYYYy.y.',
    '..yyYYYYYYYYyy..',
    '....yYYYYYYy....',
    '.....ooYYoo.....',
    '......oYYo......',
    '......oYYo......',
    '.....yyYYyy.....',
    '...yyyyYYYYyy...',
    '..UUUUUUUUUUUU..',
    '.UzzzzzzzzzzzzU.',
  ]),

  /** 线装古籍《兵书》（深靛蓝封皮、左侧白麻线装订针脚、竖排朱砂书签） */
  p_book: () => art([
    '.pppppppppppppp.',
    'pwwwwwwwwwwwwwwp',
    'UwwwwbbbbbbbbbbB',
    'UbbbwbbwwwwbbbbB',
    'UbbbbbbwRRwbbbbB',
    'UbbbwbbwRRwbbbbB',
    'UbbbbbbwRRwbbbbB',
    'UbbbwbbwRRwbbbbB',
    'UbbbbbbwwwwbbbbB',
    'UbbbwbbbbbbbbbbB',
    'UbbbbbbbbbbbbbbB',
    'UbbbwbbbbbbbbbbB',
    'UbbbbbbbbbbbbbbB',
    'Unnnnnnnnnnnnnnb',
    '.pppppppppppppp.',
  ]),

  /** 帅字牙旗（双像素木杆、黄金矛头、三燕尾朱红大旗、金边徽记） */
  p_flag: () => art([
    '.Y..............',
    'yYy.............',
    '.UYYYYYYYYYYYY..',
    '.URRRRRRRRRRRRy.',
    '.URffffffffRRy..',
    '.URfRRYYYRRRR...',
    '.URfRYYYYYRRRy..',
    '.URfRRYYYRRRRRy.',
    '.URRRRRRRRRRRy..',
    '.URRRRRRRRRR....',
    '.Uyyyyyyyyyyy...',
    '.U..............',
    '.U..............',
    '.U..............',
    'yUy.............',
  ]),

  /** 精密机关铜齿轮（八齿青铜/精钢轮、内圈凹槽高光、铜轴芯） */
  gear: () => art([
    '......SSSS......',
    '......SwSS......',
    '..SS.SwwwwS.SS..',
    '.SwSSwwssssSSsN.',
    '..SwwwsyyyyssN..',
    'SSwwssykkkkysNNN',
    'Swwssyk....kysNN',
    'Swsssyk....kysNN',
    'SSsssyk....kysNN',
    'NNssssykkkkysNNN',
    '..NssssyyyyssN..',
    '.NsNNssssssssNN.',
    '..NN.NssssN.NN..',
    '......NssN......',
    '......NNNN......',
  ]),

  /** 翠玉回旋分享箭（翡翠三层渐变、立体底边） */
  share: () => art([
    '........gg......',
    '........gGg.....',
    '........gGGg....',
    '...ggggggGGGg...',
    '..gYYYYYYYYGGg..',
    '.gYYggggggggGGg.',
    'gYYgGGGGGGGGGGd.',
    'gYgGddddddddGd..',
    'gYgG....gGGd....',
    'gYg.....gGd.....',
    'gYg.....gd......',
    'gGGggggg........',
    '.ddddddd........',
  ]),

  /** 朱漆鎏金播映牌 */
  video: () => art([
    '.YYYYYYYYYYYYYY.',
    'yRRRRRRRRRRRRRRy',
    'yRffffffffffffRy',
    'yRfRRRwwRRRRRRRy',
    'yRfRRRwwwwRRRRRy',
    'yRfRRRwwwwwwRRRy',
    'yRfRRRwwwwRRRRRy',
    'yRfRRRwwRRRRRRRy',
    'yRRRRRRRRRRRRRRy',
    'yrrrrrrrrrrrrrry',
    '.oooooooooooooo.',
  ]),

  /** 黄金将军锁 */
  lock: () => art([
    '....SSSSSS....',
    '...SwwwwwwS...',
    '..SwSS..SSsN..',
    '..SwS....SsN..',
    '..SwS....SsN..',
    '.YYYYYYYYYYYY.',
    'yYwwwwYYYYYYoy',
    'yYYYYYkkYYYYoy',
    'yYYYYkkkkYYYoy',
    'yYYYYYkkYYYYoy',
    'yYYYYYYYYYYYoy',
    'yooooooooooooy',
    '.UUUUUUUUUUUU.',
  ]),

  /** 五角金星 */
  star: () => art([
    '.......YY.......',
    '......YwwY......',
    '......YwwY......',
    '.....YYwwYY.....',
    'YYYYYYwwwwYYYYYY',
    'yYYYYYYYYYYYYYYo',
    '.yYYYYYYYYYYYYo.',
    '..yYYYYYYYYYYo..',
    '...yYYYYYYYYo...',
    '..yYYYYooYYYYo..',
    '..yYYYo..oYYYo..',
    '.yYYo......oYYo.',
    '.yo..........oy.',
  ]),

  /** 铜壶日晷钟 */
  clock: () => art([
    '....YYYYYYYY....',
    '..YYwwwwwwwwYY..',
    '.YwppppppppppwY.',
    '.YwpwwwzzwwwpwY.',
    'Ywpwww..zzwwwpYo',
    'Ywpww...zzwwwpYo',
    'Ywpzz...zz..zpYo',
    'Ywpwwww.zzRRwpYo',
    'YwpwwwwwwwRRwpYo',
    '.YwpwwwwwwwwpwY.',
    '.YwppppppppppwY.',
    '..YYooooooooYY..',
    '....UUUUUUUU....',
  ]),

  pause: () => art([
    '.YYYY..YYYY.',
    '.YwwY..YwwY.',
    '.YwwY..YwwY.',
    '.YwwY..YwwY.',
    '.YwwY..YwwY.',
    '.YwwY..YwwY.',
    '.YyyY..YyyY.',
    '.oooo..oooo.',
  ]),

  // ==================== 六大装备槽位 ====================
  /** 兵器：红缨龙胆亮银枪 */
  e_weapon: () => FINE_ICONS.w_spear(),

  /** 头盔：红缨虎头兜鍪（高耸红缨、精钢盔钵、鎏金饕餮眉庇、鱼鳞护耳顿项） */
  e_helm: () => art([
    '.....RRRRRR.....',
    '....RffffffR....',
    '.....RRRRrr.....',
    '......YYYY......',
    '....SSwwwwSS....',
    '..SSwwwSSSSsSS..',
    '.SwwSSSSSSSssNS.',
    '.SwSSSSSSSSsssN.',
    'YYYYYYYYYYYYYYYY',
    'yyyyYYwwwwYYyyyy',
    'SSsN........NsSS',
    'SwsN........NsSS',
    'SSsN........NsSS',
    'yyYN........NYyy',
  ]),

  /** 铠甲：鱼鳞明光宝甲（金边吞肩兽、护心宝镜、三层鱼鳞甲片、黄金兽面腰带） */
  e_armor: () => art([
    '.YYYY......YYYY.',
    'yYwwY.SSSS.YwwYy',
    'yYSSYSwSSwSYSSYy',
    'yYSSSwSYYwSwSSYy',
    '.ySSSwYwwYwSSSy.',
    '..SSsSSYYSSsSS..',
    '..SwsSwsswSsSS..',
    '..SSsSssssSsSS..',
    '..YYYYYYYYYYYY..',
    '..yyyyYggYyyyy..',
    '.SSwSSsNNsSSwSS.',
    '.SSsSSsNNsSSsSS.',
    '.nnnnn....nnnnn.',
  ]),

  /** 战靴：踏云精铁战靴（鎏金护膝口、精铁护胫、如意翘头、厚实多层靴底） */
  e_boots: () => art([
    '..YYYYYYYY......',
    '..yqqqqqqy......',
    '..UUUUUUUU......',
    '..UqqqqLuU......',
    '..UqqSSsuU......',
    '..UqqSwsuU......',
    '..UqqSSsuU......',
    '..UqqqqLuU....YY',
    '..UqqqqLuUUUUyYy',
    '.UUqqqqqqqqLLuYy',
    '.UqqqqqqqqLLuuuU',
    '.UuuuuuuuuuuuuuU',
    '.SSSSSSSSSSSSSSS',
    '.zzzzzzzzzzzzzzz',
  ]),

  /** 坐骑：照夜玉狮子骏马（白玉马首、银鬃飘逸、朱红络头与黄金当卢） */
  e_mount: () => art([
    '.......ss..SS...',
    '.....ssSS.SwwS..',
    '....sSSwwSwwwS..',
    '...sSwwwwwwwwR..',
    '..sSSwwwwkwYwR..',
    '..sSwwwwwwwRRwww',
    '.sSSwwwwwwRwwwwS',
    '.sSwwwwwwRwwwws.',
    'sSSwwwwwRYYsSS..',
    'sSwwwwRRYyy.....',
    'sSwwwwwwSs......',
    '.SwwwwwwSs......',
    '.SwwwwwwwS......',
    '..SSSSSSSS......',
  ]),

  /** 佩饰：双龙戏珠翠玉璧（朱红盘长结、圆润四色古玉环、三缕红丝流苏） */
  e_jade: () => art([
    '......RRRR......',
    '.....RyyyyR.....',
    '......RRRR......',
    '....gggGGggg....',
    '..ggYYggggGGgg..',
    '.gYYggggggggGGd.',
    '.gYgggYYYYgggGd.',
    'gYgggY....YgggGd',
    'gYgggY....YgggGd',
    '.ggggYYYYYYggGd.',
    '.gdggggggggGGdd.',
    '..ddGGGGGGGGdd..',
    '....dddddddd....',
    '.....R.RR.R.....',
    '....R..RR..R....',
  ]),

  // ==================== 武器与超武 ====================
  /** 龙胆亮银枪 */
  w_spear: () => art([
    '...........wwww.',
    '..........wwwwS.',
    '.........wwwSSs.',
    '........RwwSSs..',
    '......ffRYwSs...',
    '.....fRRRYyS....',
    '......RRqU.s....',
    '.......qU.......',
    '......qU........',
    '.....qU.........',
    '....qU..........',
    '...qU...........',
    '..qU............',
    '.yU.............',
    'Yy..............',
  ]),

  w_spear_evo: () => {
    const p = new PixelImage(16, 16);
    p.ring(7.5, 7.5, 7, 'Y');
    p.ring(7.5, 7.5, 6, 'y');
    p.blit(PixelImage.fromRows([
      '..........wwww.',
      '.........wwwwS.',
      '........wwwSSs.',
      '.......RwwSSs..',
      '.....ffRYwSs...',
      '....fRRRYyS....',
      '.....RRYY......',
      '......YY.......',
      '.....YY........',
      '....YY.........',
      '...YY..........',
      '..YY...........',
    ]), 1, 1);
    return p.outline();
  },

  /** 青釭宝剑 */
  w_sword: () => art([
    '............ccc.',
    '...........cwww.',
    '..........cwwSc.',
    '.........cwwSc..',
    '........cwwSc...',
    '.......cwwSc....',
    '......cwwSc.....',
    '...YY.cwSc......',
    '....YYwSc.......',
    '.....YYY........',
    '...RRyYY........',
    '..RR..YY........',
    '.yR....Y........',
    'Yy..............',
  ]),

  w_sword_evo: () => {
    const p = new PixelImage(16, 16);
    p.ring(7.5, 7.5, 7, 'c');
    p.blit(FINE_ICONS.atk(), -1, -1);
    return p;
  },

  /** 青龙偃月刀 */
  w_blade: () => art([
    '.........wwwwww.',
    '.......wwSSSSSw.',
    '......wSSSSssS..',
    '.....wSSSssN....',
    '....wSSssN......',
    '....GYyR........',
    '...GGYyR........',
    '.....qU.........',
    '....qU..........',
    '...qU...........',
    '..qU............',
    '.qU.............',
    'yU..............',
  ]),

  w_blade_evo: () => {
    const p = new PixelImage(16, 16);
    p.ring(7.5, 7.5, 7, 'g');
    p.ring(7.5, 7.5, 6, 'G');
    p.blit(PixelImage.fromRows([
      '......wwwwww.',
      '....wwSSSSSw.',
      '...wSSSSssS..',
      '..wSSSssN....',
      '..GYyR.......',
      '...qU........',
      '..qU.........',
      '.qU..........',
    ]), 2, 3);
    return p.outline();
  },

  /** 丈八蛇矛 */
  w_snake: () => art([
    '...........ww...',
    '..........wSS...',
    '.........wSs....',
    '.........wSs....',
    '........wSs.....',
    '.......wSs......',
    '.......wSs......',
    '......RYy.......',
    '.....RRU........',
    '.....qU.........',
    '....qU..........',
    '...qU...........',
    '..qU............',
    '.yU.............',
  ]),

  w_snake_evo: () => {
    const p = new PixelImage(16, 16);
    p.ring(7.5, 7.5, 7, 'R');
    p.ring(7.5, 7.5, 6, 'r');
    p.blit(PixelImage.fromRows([
      '........ww.',
      '.......wSS.',
      '......wSs..',
      '......wSs..',
      '.....wSs...',
      '....RYy....',
      '...qU......',
      '..qU.......',
    ]), 3, 3);
    return p.outline();
  },

  /** 诸葛羽扇 */
  w_fan: () => art([
    '....wwwwwwww....',
    '..wwwwSSSSwwww..',
    '.wwwSSccccSSwww.',
    'wwwSccBBBBccSwww',
    'wwScBBwwwwBBcSww',
    'wwSSwwwwwwwwSSww',
    '.wwwSSSSSSSSwww.',
    '..wwwwwwwwwwww..',
    '....YYyyyyYY....',
    '......qUUu......',
    '......qUUu......',
    '......yRRy......',
    '.......RR.......',
  ]),

  w_fan_evo: () => {
    const p = new PixelImage(16, 16);
    p.ring(7.5, 7.5, 7, 'c');
    p.disc(7.5, 7.5, 5, 'w');
    p.ring(7.5, 7.5, 5, 'B');
    p.disc(7.5, 7.5, 2, 'k');
    p.set(7, 6, 'w'); p.set(8, 9, 'w');
    return p.outline();
  },

  /** 方天画戟 */
  w_halberd: () => art([
    '...........ww...',
    '........YYwSS.YY',
    '.......YwYSS.YwY',
    '......YwYRYyYwY.',
    '......Yw..YyYY..',
    '.......Y.qU.Y...',
    '........qU......',
    '.......qU.......',
    '......qU........',
    '.....qU.........',
    '....qU..........',
    '...qU...........',
    '..yU............',
  ]),

  w_halberd_evo: () => {
    const p = new PixelImage(16, 16);
    p.ring(7.5, 7.5, 7, 'R');
    p.ring(7.5, 7.5, 6, 'Y');
    p.blit(PixelImage.fromRows([
      '.......ww...',
      '....YYwSS.YY',
      '...YwYSS.YwY',
      '..YwYRYyYwY.',
      '.....qU.....',
      '....qU......',
      '...qU.......',
    ]), 2, 4);
    return p.outline();
  },

  /** 诸葛连弩 */
  w_crossbow: () => art([
    '.......YY.......',
    '..YYYYYYYYYYYY..',
    '.YuuuuuUUuuuuuY.',
    'Y..S...UU...S..Y',
    '....S.qUUu.S....',
    '.....SqUUuS.....',
    '......qwwu......',
    '......qwwu......',
    '......qUUu......',
    '.....qqUUuu.....',
    '.....UUUUUU.....',
  ]),

  /** 雕弓 */
  w_bow: () => art([
    '....YYY.........',
    '..YYuuS.........',
    '.Yuu..S.......ww',
    'Yuu...S......wYY',
    'Yu....SSSSSSSSw.',
    'Yu....S......wYY',
    '.Yuu..S.......ww',
    '..YYuuS.........',
    '....YYY.........',
  ]),

  /** 虎头湛金枪 */
  w_lance: () => art([
    '...........YYYY.',
    '..........Ywwww.',
    '.........YYwwYY.',
    '........RYYYY...',
    '.......RRYY.....',
    '......yY........',
    '.....yY.........',
    '....yY..........',
    '...yY...........',
    '..yY............',
    '.yY.............',
  ]),

  /** 日月乾坤圈 */
  w_chakram: () => art([
    '....YYYYYYYY....',
    '..YYwwwwwwwwYY..',
    '.YwYYYYYYYYYYwY.',
    'YwYY..cccc..YYwY',
    'YwY..cwwwwc..YwY',
    'YwY..cw..wc..YwY',
    'YwY..cwwwwc..YwY',
    'YwYY..cccc..YYwY',
    '.YwYYYYYYYYYYwY.',
    '..YYooooooooYY..',
    '....oooooooo....',
  ]),

  /** 典韦双铁戟 */
  w_ji: () => art([
    '..www......www..',
    '.wSSSw....wSSSw.',
    '.wS.qU....Uq.Sw.',
    '..S..qU..Uq..S..',
    '......qUUq......',
    '......qUUq......',
    '.....qU..Uq.....',
    '....qU....Uq....',
    '...yU......Uy...',
  ]),

  /** 太平天雷 */
  w_thunder: () => art([
    '......YYYYYY....',
    '.....YYwwwwY....',
    '....YYwwwY......',
    '...YYwwwY.......',
    '..YYYYYYYYYYYY..',
    '.....YwwwwYY....',
    '....YYwwwY......',
    '...YYwwY........',
    '..YYwY..........',
    '.YYY............',
  ]),

  w_horse: () => FINE_ICONS.e_mount(),

  /** 猛火油柜 / 火计 */
  w_fire: () => art([
    '.......YY.......',
    '......YwwY......',
    '.....YwYYy......',
    '....oYYYYyo.....',
    '...ooYwwYYoo....',
    '....UUUUUUUU....',
    '...UqqqqqqLuU...',
    '..UqwwqqqqLLuU..',
    '..UqqqqqqLLuuU..',
    '..UqqLLLLuuuuU..',
    '...UuuuuuuuuU...',
    '....UUUUUUUU....',
  ]),

  /** 剑气护体光环 */
  w_aura: () => art([
    '....cccccccc....',
    '..ccwwwwwwwwcc..',
    '.cwccBBBBBBccwc.',
    '.cwcBccccccBcwc.',
    'cwcBc..YY..cBcwc',
    'cwBc..YwwY..cBwc',
    'cwBc.YwYYwY.cBwc',
    'cwBc.YwYYwY.cBwc',
    'cwBc..YwwY..cBwc',
    'cwcBc..YY..cBcwc',
    '.cwcBccccccBcwc.',
    '.cwccBBBBBBccwc.',
    '..ccbbbbbbbbcc..',
    '....bbbbbbbb....',
  ]),

  /** 飞刀 */
  w_knife: () => art([
    '..........wwww..',
    '.........wwSSs..',
    '........wwSSs...',
    '.......wwSSs....',
    '......wwSSs.....',
    '.....wwSSs......',
    '...YYwSSs.......',
    '....YYYy........',
    '...RRYY.........',
    '..RR............',
    '.Yy.............',
  ]),

  /** 战鼓 */
  w_drum: () => art([
    '..YYYYYYYYYYYY..',
    '.YppppppppppppY.',
    'yRRRRRRRRRRRRRRy',
    'yRffffffffffffRy',
    'yRfRRYYYYYYRRfRy',
    'yRRRRYYwwYYRRRRy',
    'yRRRRYYwwYYRRRRy',
    'yRRRRYYYYYYRRRRy',
    'yrrrrrrrrrrrrrry',
    '.YYYYYYYYYYYYYY.',
    '..UU........UU..',
    '.UU..........UU.',
  ]),

  /** 乱石 / 滚木礌石 */
  w_rock: () => art([
    '....SSSSSSSS....',
    '..SSwwwwSSSSsN..',
    '.SwwwSSSSSssssN.',
    'SwSSSSSSsNssssnN',
    'SSSSSSsNssssnnnN',
    'sSSSsNssssnnnnnN',
    '.sSsNssssnnnnnN.',
    '..NNnnnnnnnnnN..',
    '....NNNNNNNN....',
  ]),

  /** 投石车 */
  w_catapult: () => art([
    '...........SSSS.',
    '..........SwSSs.',
    '.........UUssN..',
    '........qU......',
    '.......qU.......',
    '......qU........',
    '.....qU.........',
    '.YYYYYYYYYYYYY..',
    'UUUUUUUUUUUUUUU.',
    '..kYk......kYk..',
    '..kkk......kkk..',
  ]),

  /** 铁蒺藜 */
  w_caltrop: () => art([
    '.......ww.......',
    '.......wS.......',
    '......wSSs......',
    '.....wSSSSs.....',
    'wwwwSwSwwSsSssss',
    '.ssssSSSSSSnnnn.',
    '.....sSSSSn.....',
    '....wS.ss.Sn....',
    '...wS......Sn...',
    '..wS........Sn..',
  ]),

  /** 流星锤 */
  w_meteor: () => art([
    '.........YYYY...',
    '.......YYwwwwYY.',
    '......YwYYYYYYwY',
    '......YwYYYYYYoY',
    '.......YYooooYY.',
    '......cc.oooo...',
    '.....cc.........',
    '....cc..........',
    '...cc...........',
    '..cc............',
    '.c..............',
  ]),

  // ==================== 被动秘宝 ====================
  p_armor: () => FINE_ICONS.e_armor(),

  /** 紫芝仙草 */
  p_lingzhi: () => art([
    '...MMMMMMMMMM...',
    '.MMffffMMMMMMm..',
    'MffwwffffMMMMmm.',
    'MffffffMMMMMMmm.',
    '.MMMMmmmmmmmmmm.',
    '.....qqLLuu.....',
    '.....qqLLuu.....',
    '....qqqLLuuu....',
    '...qqqqLLuuuu...',
  ]),

  /** 行军粮碗 */
  p_bowl: () => art([
    '....wwwwwwww....',
    '..wwwwwwwwwwww..',
    '.wwwwppwwwwppww.',
    'YYYYYYYYYYYYYYYY',
    'URRRRRRRRRRRRRRU',
    '.URRYRRYRRYRRRU.',
    '..URRRRRRRRRRU..',
    '...UUUUUUUUUU...',
    '....YYYYYYYY....',
  ]),

  /** 山河九州图 */
  p_map: () => art([
    'yppppppppppppppy',
    'UpwwwwwwwwwwwwpU',
    'UpwgggwwwwBBwwpU',
    'UpwggGGwwBBbwwpU',
    'UpwwwgGwwBbRRwpU',
    'UpwwwwgGwbRRRRpU',
    'UpwBBwwgGwRRwwpU',
    'UpwBBBwgGwwwwqpU',
    'UpqqqqqqqqqqqqpU',
    'yppppppppppppppy',
  ]),

  /** 杜康美酒角爵 */
  p_wine: () => art([
    '..........qqUUUU',
    '........qqwwqqUU',
    '.......qwwqqLuU.',
    '......qwwqqLuU..',
    '.....qwwqqLuU...',
    '....qwwqqLuU....',
    '...qwwqqLuU.....',
    '..qwwqqLuU......',
    '..qqqqLuU.......',
    '.YYuuuuU........',
    'Yy..............',
  ]),

  /** 白银号角 */
  p_horn: () => art([
    'YY..............',
    'Ywy.............',
    '.Ywy............',
    '..Ywy...........',
    '...Ywy..UUUU....',
    '....YwyUqqwwUU..',
    '.....YYqqwwwwqU.',
    '.......UqqwwqqU.',
    '........UUUUUU..',
  ]),

  /** 百炼磨刀石 */
  p_whetstone: () => art([
    '..........wwww..',
    '.........wwSSs..',
    '........wwSSs...',
    '.......wwSSs....',
    '..SSSSSSSSSS....',
    '.SwwwwwwwwssN...',
    'SwwSSSSSSSSssN..',
    'NsssssssssssnnN.',
    '.NNNNNNNNNNNNN..',
  ]),

  /** 护心铜镜 */
  p_mirror: () => art([
    '....YYYYYYYY....',
    '..YYyyyyyyyyYY..',
    '.YySSSSSSSSSSyY.',
    'YySwwwwSSSSssNyY',
    'YySwcSSSSSsssNyY',
    'YySwSSSSSssssNyY',
    'YySSSSSSsssssNyY',
    '.YySSSSsssssNyY.',
    '..YYooooooooYY..',
    '....oooooooo....',
  ]),

  /** 行军干粮包 */
  p_ration: () => art([
    '.....qq..qq.....',
    '......UUUU......',
    '...pppppppppp...',
    '..pwwwwwwwwwwp..',
    '.pwppRRRRRRppqp.',
    '.pwpRRRRRRRRpqp.',
    '.pwppRRRRRRppqp.',
    '..ppppppppppqp..',
    '...qqqqqqqqqq...',
  ]),

  /** 肉包子 */
  bun: () => art([
    '......wwww......',
    '....wwwwwwww....',
    '..wwwwSwwSwwww..',
    '.wwwwSwwwwSwwww.',
    'wwwwwwwwwwwwwwwS',
    'wwwwwwwwwwwwwwSS',
    'SwwwwwwwwwwwwSSS',
    '.SSSSSSSSSSSSSS.',
  ]),

  /** 磁石 */
  magnet: () => art([
    '.RRRR......RRRR.',
    'RffffR....RffffR',
    'SSSSSS....SSSSSS',
    'RffRRr....RffRRr',
    'RffRRr....RffRRr',
    'RffRRrrrrrrffRRr',
    '.RRRRRRRRRRRRrr.',
    '..rrrrrrrrrrrr..',
  ]),

  /** 震天雷 */
  bomb: () => art([
    '..........YY....',
    '.........Ywo....',
    '.......qq.......',
    '.....YYYYYY.....',
    '...NNNNNNNNNN...',
    '..NNwwwNNNNnnn..',
    '.NNwwNNNNNNNnnn.',
    '.NNNNNRRRRNNnnn.',
    '.NNNNNRYYRNNnnn.',
    '..NNNNRRRRNnnn..',
    '...NNNNnnnnnn...',
    '.....nnnnnn.....',
  ]),

  /** 复活丹印 */
  revive: () => art([
    '....YYYYYYYY....',
    '..YYwwwwwwwwYY..',
    '.YwYYYYRRYYYYwY.',
    'YwYYYYRRRRYYYYwY',
    'YwYYRRRRRRRRYYwY',
    'YwYYRRRRRRRRYYwY',
    'YwYYYYRRRRYYYYwY',
    '.YwYYYYRRYYYYwY.',
    '..YYooooooooYY..',
    '....oooooooo....',
  ]),

  home: () => FINE_ICONS.tent(),
  /** 汗血金马蹄铁 */
  p_horseshoe: () => art([
    '..YYYY....YYYY..',
    '.YwwwwY..YwwwwY.',
    'YwYYYYY..YYYYYwY',
    'YwY..........YwY',
    'YwY..........YwY',
    'YwY..........YwY',
    '.YwYY......YYwY.',
    '.YYwYYYYYYYYwYY.',
    '..YYwwwwwwwwYY..',
    '....YYYYYYYY....',
  ]),

  /** 调兵金虎符 */
  p_tiger: () => art([
    '....YYYYYYYY....',
    '..YYwwwwwwwwYY..',
    '.YwYYkkYYkkYYwY.',
    'YwYYYYYYYYYYYYwY',
    'YwYYkkkYYkkkYYwY',
    'YYYYYYYYYYYYYYYY',
    '.yyyyYYYYYYyyyy.',
    '..yyoo.yy.ooyy..',
    '..ooo..oo..ooo..',
  ]),

  /** 华佗灵药玉葫芦 */
  potion: () => art([
    '......RRRR......',
    '......yyyy......',
    '....gggggggg....',
    '...gYYggggGGd...',
    '...gYYggggGGd...',
    '....gggggggg....',
    '.....RRRRRR.....',
    '...gggggggggg...',
    '..gYYggggggGGd..',
    '..gYYggggggGGd..',
    '..gggggggggGGd..',
    '...gggggggGGd...',
    '....dddddddd....',
  ]),

  /** 锦囊妙计 */
  jinnang: () => art([
    '....yy....yy....',
    '.....yyyyyy.....',
    '...RRRRRRRRRR...',
    '..RffffffffffR..',
    '.RfRRRRYYRRRRrR.',
    'RfRRRRYYYYRRRRrR',
    'RRRRRYYwwYYRRRrR',
    'RRRRRRYYYYRRRRrR',
    '.RRRRRRRRRRRRrR.',
    '..rrrrrrrrrrrr..',
    '...YYYYYYYYYY...',
  ]),

  /** 传国玉玺 */
  p_seal: () => art([
    '.....gggggg.....',
    '...ggYYggGGgg...',
    '...gYgkggkgGd...',
    '....gggggggg....',
    '.....ggGGdd.....',
    '.YYYYYYYYYYYYYY.',
    'yggggggggggggggy',
    'ygYYggggggggGGdy',
    'ygggggggggggGGdy',
    'yGGGGGGGGGGGGddy',
    'RRRRRRRRRRRRRRRR',
  ]),

  /** 乾坤百宝袋 */
  p_pouch: () => art([
    '....qqqqqqqq....',
    '...qwwwwwwwwq...',
    '....qqqqqqqq....',
    '.....YYYYYY.....',
    '...BBBBBBBBBB...',
    '..BccBBBBBBBBb..',
    '.BccBBBYYBBBBbb.',
    '.BcBBBYYYYBBBbb.',
    '.BBBBBBYYBBBBbb.',
    '..BBBBBBBBBBbb..',
    '...bbbbbbbbbb...',
  ]),

  /** 赤心丹心 */
  hp: () => art([
    '..RRRR....RRRR..',
    '.RffffR..RffffR.',
    'RffwwffRRffRRRRr',
    'RffwwffffffRRRRr',
    'RfffffffffRRRRrr',
    '.RfffffffRRRRrr.',
    '..RfffffRRRRrr..',
    '...RfffRRRRrr...',
    '....RfRRRRrr....',
    '.....RRRRrr.....',
    '......RRrr......',
  ]),

  /** 精钢龙纹盾 */
  def: () => art([
    '.YYYYYYYYYYYYYY.',
    'ySSSSSSSSSSSSSSy',
    'ySwwwwSSSSSSssNy',
    'ySwSSnBBBBnSssNy',
    'ySwSnBBYYBBnSsNy',
    'ySSSnBYYYYBnSsNy',
    '.ySSnBBYYBBnSsy.',
    '.ySSSnBBBBnSssy.',
    '..ySSSSnnSSSsy..',
    '...ySSSSSSSsy...',
    '....yySSSSyy....',
    '......yyyy......',
  ]),

  speed: () => FINE_ICONS.p_horseshoe(),
};

const fineSprites: Record<string, PixelImage> = {};

export function getFinePixelIcon(name: string): PixelImage | null {
  if (fineSprites[name]) return fineSprites[name];
  const fn = FINE_ICONS[name];
  if (!fn) return null;
  return (fineSprites[name] = fn());
}

export const FINE_ICON_NAMES = Object.keys(FINE_ICONS);
