# 1.0.3 更新的微信贴图配图：3:4（1080×1440），全部是游戏实拍截图。
# 先跑截图：Q='?skip=1' node tools/shot.mjs bossskills / qiyu / newheroes；Q='?skip=1&heroes=1&ch=6' node tools/shot.mjs newlinks
# 再运行：python3 tools/promo/update103.py
import os
from PIL import Image, ImageDraw, ImageFont
SANS = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
SRC, OUT = 'dist/shots/', 'docs/promo/1.0.3/'
os.makedirs(OUT, exist_ok=True)
W, H = 1080, 1440
def font(sz): return ImageFont.truetype(SANS, sz)
GOLD = (255, 214, 102)
def canvas(title, sub):
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    top, bot = (30, 18, 36), (92, 34, 36)
    for y in range(H):
        t = y / H; d.line([0, y, W, y], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    d.text((W // 2, 92), title, font=font(70), fill=GOLD, anchor='mm', stroke_width=5, stroke_fill=(40, 16, 10))
    d.text((W // 2, 170), sub, font=font(38), fill=(255, 244, 214), anchor='mm')
    return im, d
def place(im, names, y0=230, gap=24, crop_top=0):
    n = len(names)
    w = (W - gap * (n + 1)) // n
    for i, nm in enumerate(names):
        s = Image.open(SRC + nm + '.png').convert('RGB')
        if crop_top: s = s.crop((0, int(s.height * crop_top), s.width, s.height))
        h = int(s.height * w / s.width)
        maxh = H - y0 - gap
        if h > maxh:
            # 太长就从下面裁掉
            s = s.crop((0, 0, s.width, int(s.height * maxh / h))); h = maxh
        s = s.resize((w, h), Image.LANCZOS)
        x = gap + i * (w + gap)
        ImageDraw.Draw(im).rectangle([x - 4, y0 - 4, x + w + 3, y0 + h + 3], fill=(255, 214, 102))
        im.paste(s, (x, y0))
def save(im, name):
    p = OUT + name
    for q in (90, 85, 80, 75):
        im.save(p, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(p) < 900 * 1024: break
    print(p, os.path.getsize(p) // 1024, 'KB')
PAGES = [
    ('1_封面.jpg', '长坂单骑传 · 更新手记', '玩家说敌将太简单，这周我改了这些', ['bskill_cross', 'nh_tab']),
    ('2_敌将技能.jpg', '敌将学会了放技能', '红圈是预警，躲开就不掉血', ['bskill_fan', 'bskill_rain', 'bskill_nova']),
    ('3_护盾狂暴.jpg', '12秒打不破护盾就狂暴', '打破了敌将会僵住3.5秒', ['bskill_shield', 'bskill_enrage']),
    ('4_开局奇遇.jpg', '开局奇遇 三选一', '十四种奇遇，整局生效', ['qiyu_pick', 'qiyu_pause']),
    ('5_新武将.jpg', '新来了五位武将', '黄忠 · 马超 · 孙尚香 · 典韦 · 姜维', ['nh_huangzhong_ult', 'nh_machao_ult', 'nh_sunshangxiang_ult']),
    ('6_专属联动.jpg', '每人都有专属联动', '同一把武器，换个武将就是另一种玩法', ['nl_huangzhong', 'nl_sunshangxiang']),
]
for name, title, sub, shots in PAGES:
    im, d = canvas(title, sub)
    place(im, shots)
    save(im, name)
