# 小游戏头像第三版（2026-11-09，用户：步战形象的赵云在营帐前，旁边是篝火，人物边缘不要描白光）。
# 全部按游戏像素画：先在 60×60 的像素画布上摆（营地美术来自游戏图集，篝火按 homeCamp.ts 的 flame 算法画），再最近邻放大 10 倍到 600；人物和篝火都在中间圆内。
# 用法：node tools/shots/avatar3.mjs（导出营地和赵云像素图）→ python3 tools/promo/avatar3.py
import json, math, os, random
from PIL import Image, ImageDraw

SP = 'dist/promo2/sprites/'
OUT = 'docs/icon/'
N = 60
AN = json.load(open(SP + 'anchors.json'))
rnd = random.Random(11)
def hexc(h, a=255): return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), a)

im = Image.new('RGBA', (N, N))
d = ImageDraw.Draw(im)
# 天空：黄昏暖色（按行分 6 档色带，像素画风格）
sky = ['#f3e2c0', '#f1d6ae', '#eec99c', '#ebbb8b', '#e7ad7c', '#e2a172']
for y in range(28):
    d.line([0, y, N, y], fill=hexc(sky[min(5, y // 5)]))
# 远山两层（淡墨）
for layer, (base, amp, col) in enumerate([(17, 6, '#b9927a'), (23, 4, '#9a7a68')]):
    for x in range(N):
        h = base - amp * abs(((x / N * 2.2 + layer * 0.55) % 2) - 1) - (2 if (x * 7 + layer) % 11 == 0 else 0)
        d.line([x, int(h), x, 28], fill=hexc(col))
# 地面：夯土 + 沙纹
d.rectangle([0, 28, N, N], fill=hexc('#c9a26c'))
d.rectangle([0, 28, N, 29], fill=hexc('#b8915e'))
for i in range(90):
    x, y = rnd.randrange(N), rnd.randrange(31, N)
    d.line([x, y, x + rnd.choice([1, 2]), y], fill=hexc(rnd.choice(['#b8915e', '#d8b47c', '#d8b47c'])))

def blit(name, x, y):
    s = Image.open(SP + name + '.png').convert('RGBA')
    ax, ay = AN[name]
    im.alpha_composite(s, (x - ax, y - ay))

def shadow(cx, cy, rx, ry=2, a=70):
    sh = Image.new('RGBA', (N, N)); ImageDraw.Draw(sh).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(60, 36, 20, a))
    im.alpha_composite(sh)

# 后排栅栏
for x in range(-2, N + 2, 5):
    blit('camp_stake', x, 31 + (abs(x - 30) // 12))
# 帅帐
shadow(30, 41, 30, 3)
blit('camp_tent', 30, 42)

# 篝火的暖光（地面一圈橙色，像素分档，不碰人物）
FX, FY = 46, 52
glow = Image.new('RGBA', (N, N)); gd = ImageDraw.Draw(glow)
for r, a in ((15, 40), (10, 55), (6, 70)):
    gd.ellipse([FX - r, FY - r * 0.45, FX + r, FY + r * 0.45], fill=(255, 150, 60, a))
im.alpha_composite(glow)

def flame(x, y, sc, t):
    for col, w, h in (('#e43b44', 7, 14), ('#f77622', 5.5, 11), ('#feae34', 4, 8), ('#fee761', 2.5, 5), ('#ffffff', 1, 2.5)):
        for i in range(-math.floor(w), math.floor(w) + 1):
            k = 1 - abs(i) / (w + 1)
            hh = h * k * (0.75 + 0.25 * math.sin(t * 12 + i * 1.7) + 0.15 * math.sin(t * 27 + i))
            x0 = round(x + i * sc); y0 = round(y - hh * sc)
            if y0 > round(y) - 1: continue
            d.rectangle([x0, y0, x0 + math.ceil(sc) - 1, round(y) - 1], fill=hexc(col))

# 赵云（觉醒步战造型，站立待机帧，面朝右边的篝火）
shadow(22, 56, 10, 2, 90)
blit('hero_zhaoyun_awk_4', 22, 57)
# 篝火：石圈 + 木柴 + 火焰（与主界面营地同一画法）
d.rectangle([FX - 8, FY, FX + 7, FY + 1], fill=hexc('#3e2731'))
for x0, y0, w in ((-7, -2, 6), (1, -2, 6), (-3, -3, 6)):
    d.rectangle([FX + x0, FY + y0, FX + x0 + w - 1, FY + y0 + 1], fill=hexc('#733e39'))
for sx, sy in ((-10, 0), (8, 0), (-6, 2), (4, 2)):
    d.rectangle([FX + sx, FY + sy, FX + sx + 1, FY + sy + 1], fill=hexc('#8b9bb4'))
flame(FX, FY - 2, 1, 0.37)
# 火星
for sx, sy in ((-3, -20), (4, -24), (1, -29), (-6, -27)):
    d.point((FX + sx, FY + sy), fill=hexc('#feae34'))

big = im.convert('RGB').resize((N * 10, N * 10), Image.NEAREST)
os.makedirs(OUT, exist_ok=True)
for s in (600, 512, 144):
    p = OUT + '长坂单骑传_头像%d.png' % s
    (big if s == 600 else big.resize((s, s), Image.LANCZOS)).save(p, optimize=True)
    print(p, os.path.getsize(p) // 1024, 'KB')
