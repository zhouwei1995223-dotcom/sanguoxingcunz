# 通用素材封面 650×250 三选一（2026-11-09）：水墨宣纸风，五星觉醒步战名将。
# 用法：python3 tools/promo/cover3.py <思源宋体 NotoSerifCJK-Black.ttc>（需先跑 tools/shots/promo2.mjs）
# 输出：docs/icon/封面_650x250_A水墨群英.jpg、_B万军丛中.jpg、_C落日对决.jpg（JPG，<80KB）
import os, sys
from PIL import Image, ImageDraw, ImageFilter
# 复用 compose2.py 的画笔（宣纸、印章、精灵放大、截图裁切），只取主题定义之前的部分
_src = open(os.path.join(os.path.dirname(__file__), 'compose2.py'), encoding='utf-8').read()
exec(_src.split('# —— 三个主题 ——')[0])

W, H = 650, 250
OUT = 'docs/icon/封面_650x250_%s.jpg'

def place(im, spr, cx, by):
    """按脚底中心摆放精灵"""
    im.alpha_composite(spr, (int(cx - spr.width / 2), int(by - spr.height)))

def sun(im, cx, cy, r, color=(206, 58, 48), a=0.85, glow=0.35):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    g = m.filter(ImageFilter.GaussianBlur(r * 0.35))
    im.paste(Image.new('RGB', im.size, (232, 120, 96)), (0, 0), g.point(lambda v: int(v * glow)))
    im.paste(Image.new('RGB', im.size, color), (0, 0), m.point(lambda v: int(v * a)))

def brush_line(d, x0, x1, y, h, color):
    """一笔飞白横线：中间粗两头尖"""
    n = x1 - x0
    for i in range(n):
        t = i / n
        w = h * (1 - abs(t - 0.45) * 1.9) ** 0.6 if abs(t - 0.45) < 0.52 else 0
        if w > 0.5 and (i * 7919) % 23: d.line([x0 + i, y - w / 2, x0 + i, y + w / 2], fill=color)

# —— A 水墨群英：宣纸、朱红落日、五位名将一字排开，标题在左 ——
def cover_a():
    im = paper(W, H, seed=3)
    sun(im, 470, 92, 74)
    im = im.convert('RGBA')
    row = [('zhangfei_4', 3, 330), ('guanyu_4', 4, 392), ('zhaoyun_4', 5, 472), ('lvbu_4_L', 4, 552), ('sunshangxiang_4_L', 3, 614)]
    for name, k, cx in sorted(row, key=lambda r: r[1]):
        place(im, sprite(name, k, glow=CREAM if k == 5 else None), cx, 268 if k == 5 else (258 if k == 4 else 248))
    d = ImageDraw.Draw(im)
    brush_line(d, 26, 300, 150, 7, CINNABAR)
    text(d, (30, 58), '长坂单骑传', serif(62), INK)
    text(d, (34, 176), '十大名将 · 五星觉醒', serif(22), INK)
    text(d, (34, 208), '一骑当千 · 万军丛中取敌将', serif(16), CINNABAR)
    seal(d, 262, 172, 48)
    return im.convert('RGB')

# —— B 万军丛中：实机战斗画面铺满，左侧墨色渐隐压标题，赵云放大站右侧 ——
def cover_b():
    bg = shot('b_zhaoyun_crowd', W, H, cy=0.5, zoom=1.0)
    # 背景虚化压暗，伤害数字不抢眼，只留千军万马的气势
    bg = bg.filter(ImageFilter.GaussianBlur(3))
    bg = Image.blend(bg, Image.new('RGB', (W, H), (60, 44, 32)), 0.28).convert('RGBA')
    # 左侧墨色压暗
    m = Image.new('L', (W, 1))
    for x in range(W): m.putpixel((x, 0), int(max(0, 1 - x / 380) ** 1.3 * 225))
    bg.paste(Image.new('RGBA', (W, H), (24, 18, 14, 255)), (0, 0), m.resize((W, H)))
    # 右侧淡淡纸色光，让人物跳出来
    g = Image.new('L', (W, H), 0)
    ImageDraw.Draw(g).ellipse([400, -20, 700, 280], fill=110)
    bg.paste(Image.new('RGBA', (W, H), CREAM + (255,)), (0, 0), g.filter(ImageFilter.GaussianBlur(40)))
    place(bg, sprite('zhaoyun_4', 6, glow=(255, 236, 170)), 528, 284)
    d = ImageDraw.Draw(bg)
    text(d, (30, 40), '长坂单骑传', serif(58), CREAM, stroke=3, sc=INK)
    brush_line(d, 30, 300, 124, 6, CINNABAR)
    text(d, (32, 144), '一骑当千', serif(40), GOLD, stroke=3, sc=INK)
    text(d, (34, 202), '满屏敌军 · 一扫而空', serif(20), CREAM, stroke=2, sc=INK)
    seal(d, 228, 146, 40)
    return bg.convert('RGB')

# —— C 落日对决：暮色天空、巨大红日、远山剪影，吕布与赵云对峙，竖排标题居中 ——
def cover_c():
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    top, mid = (58, 34, 40), (214, 132, 84)
    for y in range(H):
        t = y / H
        d.line([0, y, W, y], fill=tuple(int(top[i] + (mid[i] - top[i]) * t ** 0.9) for i in range(3)))
    sun(im, W // 2, 150, 96, color=(236, 92, 52), a=0.9, glow=0.5)
    hill = Image.new('L', (W, H), 0); hd = ImageDraw.Draw(hill)
    hd.polygon([(0, H), (0, 170), (90, 140), (190, 178), (300, 150), (420, 182), (540, 138), (W, 168), (W, H)], fill=150)
    hd.polygon([(0, H), (0, 208), (140, 186), (260, 214), (390, 192), (520, 214), (W, 196), (W, H)], fill=235)
    im.paste(Image.new('RGB', (W, H), (34, 22, 20)), (0, 0), hill.filter(ImageFilter.GaussianBlur(2)))
    im = im.convert('RGBA')
    place(im, sprite('lvbu_4', 5, glow=(255, 214, 150)), 150, 274)
    place(im, sprite('zhaoyun_4_L', 5, glow=(255, 236, 190)), 500, 274)
    d = ImageDraw.Draw(im)
    f = serif(50)
    for i, ch in enumerate('长坂单骑传'):
        text(d, (W // 2, 32 + i * 45), ch, f, CREAM, stroke=4, sc=(40, 20, 18), anchor='mm')
    text(d, (254, 34), '名', serif(26), GOLD, stroke=2, sc=INK, anchor='mm')
    text(d, (254, 64), '将', serif(26), GOLD, stroke=2, sc=INK, anchor='mm')
    text(d, (396, 34), '对', serif(26), GOLD, stroke=2, sc=INK, anchor='mm')
    text(d, (396, 64), '决', serif(26), GOLD, stroke=2, sc=INK, anchor='mm')
    seal(d, W // 2 + 40, 198, 32)
    return im.convert('RGB')

for key, fn in (('A水墨群英', cover_a), ('B万军丛中', cover_b), ('C落日对决', cover_c)):
    save_jpg(fn(), OUT % key, 80)
