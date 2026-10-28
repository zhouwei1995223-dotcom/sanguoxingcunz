# 分享图 3 张（5:4，500×400，微信分享卡片的比例），场景取自游戏内实拍截图。
# 用法：python3 tools/promo/share.py <标题字体.ttc>（截图来自 tools/shots/promo.mjs）
import os, sys
from PIL import Image, ImageDraw, ImageFont
FONT = sys.argv[1]
SRC, OUT = 'dist/promo/', 'docs/promo/'
def serif(sz): return ImageFont.truetype(FONT, sz, index=2)
def sans(sz): return ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', sz)
GOLD, WHITE, RED = (255, 214, 102), (255, 248, 232), (200, 40, 40)
W, H = 500, 400
def text(d, xy, s, f, fill, sw=5, anchor='mm'):
    d.text(xy, s, font=f, fill=fill, stroke_width=sw, stroke_fill=(36, 14, 10), anchor=anchor)
def base(shot, cx, cy, scale):
    """从截图里以 (cx, cy) 为中心、按 scale 缩放截出 500×400"""
    im = Image.open(SRC + shot + '.png').convert('RGB')
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    x0 = int(min(max(0, cx * scale - W / 2), im.width - W)); y0 = int(min(max(0, cy * scale - H / 2), im.height - H))
    return im.crop((x0, y0, x0 + W, y0 + H))
def shade(im, top=150, bottom=0):
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for y in range(top): od.line([0, y, W, y], fill=(24, 10, 16, int(225 * (1 - y / top) ** 0.8)))
    for y in range(bottom): od.line([0, H - 1 - y, W, H - 1 - y], fill=(24, 10, 16, int(225 * (1 - y / bottom) ** 0.8)))
    im = im.convert('RGBA'); im.alpha_composite(ov); return im.convert('RGB')
def badge(d, s, left=False):
    f = sans(18); w = d.textlength(s, font=f)
    x0 = 10 if left else W - w - 30
    d.rounded_rectangle([x0, H - 40, x0 + w + 20, H - 12], radius=8, fill=(30, 16, 22))
    d.text((x0 + 10, H - 36), s, font=f, fill=(240, 220, 190))
def save(im, name):
    for q in (90, 85, 80, 75, 70):
        im.save(OUT + name, 'JPEG', quality=q, optimize=True)
        if os.path.getsize(OUT + name) < 100 * 1024: break
    print(name, q, os.path.getsize(OUT + name) // 1024, 'KB')

# 1 连斩炫耀：满屏割草 + 大号连斩数
im = shade(base('p_combat', 390, 860, 0.66), top=150, bottom=70)
d = ImageDraw.Draw(im)
text(d, (W / 2, 52), '长坂坡一口气斩敌上千', serif(40), WHITE)
text(d, (W / 2, 108), '你能撑过几分钟？', serif(48), GOLD, 6)
badge(d, '长坂单骑传 · 点击应战')
save(im, '分享图1_连斩挑战_500x400.jpg')

# 2 大招：龙胆·七进七出
im = shade(base('p_ult1', 390, 880, 0.66), top=150, bottom=70)
d = ImageDraw.Draw(im)
text(d, (W / 2, 52), '一招「七进七出」', serif(42), GOLD, 6)
text(d, (W / 2, 108), '满屏曹军全倒！你也来试试', serif(34), WHITE)
badge(d, '长坂单骑传 · 点击试玩')
save(im, '分享图2_大招七进七出_500x400.jpg')

# 3 互动选择：锦囊三选一，你选哪个？
im = Image.open(SRC + 'p_strat.png').convert('RGB')
CW = 330; sc = CW / 708
cards = im.crop((36, 395, 744, 1056)).resize((CW, round(661 * sc)), Image.LANCZOS)
bgim = shade(base('p_strat', 390, 900, 0.62), top=0)
bgim = Image.blend(bgim, Image.new('RGB', (W, H), (30, 14, 26)), 0.55)
cx, cy = W - CW - 12, 60
bgim.paste(cards, (cx, cy))
d = ImageDraw.Draw(bgim)
text(d, (W / 2, 32), '三个锦囊只能选一个', serif(34), WHITE)
for k, mid in (('A', 499), ('B', 725), ('C', 952)):
    y = cy + (mid - 395) * sc
    d.ellipse([cx - 50, y - 22, cx - 6, y + 22], fill=RED, outline=GOLD, width=3)
    d.text((cx - 28, y), k, font=serif(30), fill=WHITE, anchor='mm')
text(d, (58, 200), '你\n选\n哪\n个\n？', serif(34), GOLD, 5)
badge(d, '长坂单骑传 · 点击作答', left=True)
save(bgim, '分享图3_锦囊三选一_500x400.jpg')
