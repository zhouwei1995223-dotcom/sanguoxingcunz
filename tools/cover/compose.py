# 游戏封面 650×250：画布 163×63，每格放大 4 倍（主角按 2 倍画，做视觉中心）。主体赵云在右侧冲锋，左侧曹军和旌旗平衡画面；不放文字、logo，不加黑色蒙版。
# 用法：node tools/cover/export.mjs && python3 tools/cover/compose.py → dist/cover.jpg
import math, random
from PIL import Image, ImageDraw
D = 'dist/cover/'
CW, CH, S = 163, 63, 4
random.seed(7)
def load(n): return Image.open(D + n + '.png').convert('RGBA')
def flip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)
can = Image.new('RGBA', (CW, CH))
d = ImageDraw.Draw(can)
GY = 38  # 地平线
# 天空：黄昏分层（和主界面背景同一套颜色）
sky = ['#2a1d3a', '#3d2547', '#5e2f4c', '#8a3d48', '#b85a3e', '#e08a4a', '#f2b45a']
band = math.ceil(GY / len(sky))
for i, c in enumerate(sky): d.rectangle([0, i * band, CW, i * band + band], fill=c)
# 夕阳在主角身后，光晕把视线引到右侧
sx, sy = 118, 20
for r, a in ((26, 40), (19, 55), (14, 70)):
    glow = Image.new('RGBA', (CW, CH)); gd = ImageDraw.Draw(glow)
    gd.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(254, 231, 97, a)); can.alpha_composite(glow)
d.ellipse([sx - 10, sy - 10, sx + 10, sy + 10], fill='#fee761')
for i in range(3): d.rectangle([sx - 10 + i * 2, sy + 3 + i * 2, sx + 10 - i * 2, sy + 3 + i * 2], fill='#f2b45a')
# 云
for cx, cy, w in ((14, 7, 22), (52, 12, 18), (84, 5, 14), (146, 10, 12)):
    d.rectangle([cx, cy, cx + w, cy + 1], fill=(255, 220, 180, 90)); d.rectangle([cx + 4, cy - 2, cx + w - 5, cy - 1], fill=(255, 220, 180, 90))
# 远山两层
def mountains(color, base, amp, seed):
    for x in range(CW):
        n = math.sin(x * 0.05 + seed) * 0.5 + math.sin(x * 0.013 + seed * 2) * 0.8 + math.sin(x * 0.11 + seed) * 0.15
        hh = round(base + n * base * amp); d.line([x, GY - hh, x, GY], fill=color)
mountains('#4a2b45', 13, 0.6, 3)
mountains('#33203a', 7, 0.4, 7)
# 地平线上远处的军队剪影（左侧多、右侧少）
for i in range(34):
    x = int(i * 3.2 + random.random() * 2)
    if x > 80: break
    y = GY - 2 - random.randint(0, 1)
    d.rectangle([x, y, x + 1, y + 2], fill='#2a1830'); d.line([x + 1, y - 4, x + 1, y - 1], fill='#2a1830')
    if i % 5 == 0: d.rectangle([x + 2, y - 6, x + 4, y - 5], fill='#3a5a9a')
# 地面
d.rectangle([0, GY, CW, CH], fill='#3e5a2c'); d.rectangle([0, GY, CW, GY + 1], fill='#4f7036')
for i in range(90):
    x = random.randint(0, CW); y = random.randint(GY + 3, CH - 1)
    d.rectangle([x, y, x + random.randint(1, 3), y], fill=random.choice(['#2f4722', '#5c7f3c']))
def put(name, x, y, flipx=False, tint=None):
    im = load(name)
    if flipx: im = flip(im)
    if tint:
        px = im.load()
        for j in range(im.height):
            for i in range(im.width):
                r, g, b, a = px[i, j]
                if a: px[i, j] = (int(r * tint[0]), int(g * tint[1]), int(b * tint[2]), a)
    can.alpha_composite(im, (x, y))
# 左侧：曹军旌旗（后排）
for x, y in ((4, GY - 10), (17, GY - 11), (33, GY - 9), (50, GY - 10)):
    put('bannerB', x, y)
put('pine', 60, GY - 12, tint=(0.7, 0.7, 0.8))
# 左侧：曹军，后排暗、前排亮，迎着赵云
DARK = (0.68, 0.68, 0.8)
for name, x, y in (('wei_archer0', 1, 27), ('wei_heavy2', 13, 26), ('wei_spear1', 27, 28), ('cav0', 36, 18), ('wei_archer2', 54, 29)):
    put(name, x, y, tint=DARK)
for name, x, y in (('wei_shield0', 4, 41), ('wei_spear2', 19, 44), ('wei_spear0', 34, 40), ('wei_heavy0', 47, 43), ('wei_shield2', 61, 42)):
    put(name, x, y)
def dust(cx, cy, r, a=200):
    lay = Image.new('RGBA', (CW, CH)); ld = ImageDraw.Draw(lay)
    for dx, dy, rr in ((0, 0, r), (-r * 0.8, r * 0.3, r * 0.7), (r * 0.8, r * 0.35, r * 0.6)):
        ld.ellipse([cx + dx - rr, cy + dy - rr * 0.7, cx + dx + rr, cy + dy + rr * 0.7], fill=(214, 186, 140, a))
    can.alpha_composite(lay)
# 被枪挑飞的小兵
fly = load('wei_spear3').rotate(-35, expand=True); can.alpha_composite(fly, (70, 14))
dust(72, 50, 4, 160)
# 主体：赵云（游戏内造型，2 倍大），在右侧向左冲锋
hero = flip(load('hero2'))
hero = hero.resize((hero.width * 2, hero.height * 2), Image.NEAREST)
hx, hy = 78, -2
sh = Image.new('RGBA', (CW, CH)); sd = ImageDraw.Draw(sh); sd.ellipse([hx + 6, hy + 58, hx + 62, hy + 64], fill=(20, 30, 10, 120)); can.alpha_composite(sh)
# 马蹄后扬起的尘土
dust(hx + 58, hy + 56, 5, 170); dust(hx + 68, hy + 53, 4, 120); dust(hx + 76, hy + 55, 3, 80)
can.alpha_composite(hero, (hx, hy))
# 枪尖挑中敌兵的火花
put('spark0', 80, 13); put('spark1', 75, 18)
can.save('dist/cover_canvas.png')
out = can.resize((CW * S, CH * S), Image.NEAREST).convert('RGB').crop((1, 1, 651, 251))
for q in (95, 90, 85, 80, 75, 70):
    out.save('dist/cover.jpg', 'JPEG', quality=q, optimize=True, subsampling=0)
    import os
    if os.path.getsize('dist/cover.jpg') < 78 * 1024: break
print('quality', q, os.path.getsize('dist/cover.jpg') // 1024, 'KB', out.size)
