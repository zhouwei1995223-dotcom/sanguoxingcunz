# 推广素材第二版（2026-11-09）：水墨宣纸风，和 1.0.7 起的游戏界面统一；五星觉醒的步战名将放大站在画面上。
# 截图来自 tools/shots/promo2.mjs（dist/promo2/*.png 与 dist/promo2/sprites/*.png）。
# 用法：python3 tools/promo/compose2.py <思源宋体 NotoSerifCJK-Black.ttc>
# 输出：
#   docs/promo/竖版1~3_720x1280.jpg、横版1~3_1280x720.jpg（<200KB，游戏圈 / 贴图配图）
#   docs/promo/投放/竖版1~3_1080x1920.jpg（<400KB，腾讯广告）
#   assets/share/combo.jpg、ult.jpg、strat.jpg 与 docs/promo/分享图1~3_500x400.jpg（5:4 分享卡片）
#   docs/review/宣传图_340x200.jpg（<25KB，提审宣传图）
import os, sys, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

FONT = sys.argv[1]
SANS = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
SRC = 'dist/promo2/'
SP = SRC + 'sprites/'
random.seed(7)

def serif(sz): return ImageFont.truetype(FONT, int(sz), index=2)   # 2 = 简体中文
def sans(sz): return ImageFont.truetype(SANS, int(sz))

INK = (38, 28, 22)
PAPER = (240, 230, 210)
PAPER2 = (222, 205, 175)
CINNABAR = (178, 34, 38)
GOLD = (255, 214, 102)
CREAM = (255, 246, 228)

def save_jpg(im, path, kb):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for q in (92, 88, 85, 82, 78, 74, 70, 66, 62, 58, 54, 50, 45, 40):
        im.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(path) < kb * 1024: break
    print(path, q, os.path.getsize(path) // 1024, 'KB')

def paper(w, h, seed=1):
    """宣纸：暖色渐变 + 纤维颗粒 + 淡淡的远山"""
    rnd = random.Random(seed)
    im = Image.new('RGB', (w, h), PAPER)
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([0, y, w, y], fill=tuple(int(PAPER[i] + (PAPER2[i] - PAPER[i]) * t) for i in range(3)))
    noise = Image.effect_noise((w // 2 + 1, h // 2 + 1), 18).resize((w, h)).convert('L')
    im = ImageChops.multiply(im, Image.merge('RGB', [noise.point(lambda v: 225 + v // 8)] * 3))
    # 远山
    hill = Image.new('L', (w, h), 0); hd = ImageDraw.Draw(hill)
    for layer, (base, amp, a) in enumerate([(0.78, 0.16, 26), (0.9, 0.12, 40)]):
        pts = [(0, h)]
        x = 0
        while x <= w:
            pts.append((x, h * base - amp * h * abs(((x / w * 2.3 + layer * 0.7 + rnd.random() * 0.05) % 2) - 1)))
            x += max(4, w // 60)
        pts += [(w, h)]
        hd.polygon(pts, fill=a)
    hill = hill.filter(ImageFilter.GaussianBlur(max(2, w // 120)))
    im.paste(Image.new('RGB', (w, h), (70, 58, 46)), (0, 0), hill)
    return im

def seal(d, x, y, s, text='单骑'):
    """朱红方印（白字）"""
    d.rounded_rectangle([x, y, x + s, y + s], radius=s // 10, fill=CINNABAR)
    f = serif(s * 0.36)
    d.text((x + s / 2, y + s * 0.3), text[0], font=f, fill=CREAM, anchor='mm')
    d.text((x + s / 2, y + s * 0.7), text[1], font=f, fill=CREAM, anchor='mm')

def text(d, xy, s, font, fill, stroke=0, sc=INK, anchor='la'):
    d.text(xy, s, font=font, fill=fill, stroke_width=int(stroke), stroke_fill=sc, anchor=anchor)

def sprite(name, k, glow=None):
    """放大像素图（最近邻，边缘锐利），可带一圈柔和光晕和脚下影子"""
    im = Image.open(SP + name + '.png').convert('RGBA')
    im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    pad = k * 6
    out = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    a = im.split()[3]
    if glow:
        g = Image.new('RGBA', out.size, glow + (0,))
        m = Image.new('L', out.size, 0); m.paste(a, (pad, pad))
        m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(k * 1.6))
        g.putalpha(m.point(lambda v: min(255, int(v * 1.4))))
        out = Image.alpha_composite(out, g)
    # 脚下椭圆影子
    sh = Image.new('L', out.size, 0)
    ImageDraw.Draw(sh).ellipse([pad + im.width * 0.15, pad + im.height - k * 3, pad + im.width * 0.85, pad + im.height + k * 2], fill=110)
    sh = sh.filter(ImageFilter.GaussianBlur(k))
    out = Image.alpha_composite(out, Image.merge('RGBA', [Image.new('L', out.size, 20)] * 3 + [sh]))
    out.alpha_composite(im, (pad, pad))
    return out

def shot(name, w, h, cx=0.5, cy=0.5, zoom=1.0):
    """截图按宽缩放后以 (cx, cy) 为中心裁出 w×h（zoom>1 放大局部）"""
    im = Image.open(SRC + name + '.png').convert('RGB')
    s = max(w / im.width, h / im.height) * zoom
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x0 = int(min(max(0, im.width * cx - w / 2), im.width - w))
    y0 = int(min(max(0, im.height * cy - h / 2), im.height - h))
    return im.crop((x0, y0, x0 + w, y0 + h))

def vfade(h, top_alpha, bottom_alpha, w=1):
    m = Image.new('L', (1, h))
    for y in range(h): m.putpixel((0, y), int(top_alpha + (bottom_alpha - top_alpha) * y / max(1, h - 1)))
    return m.resize((w, h))

# —— 三个主题 ——
THEMES = [
    dict(key='combat', title='一骑当千', sub='万军丛中 · 名将割草', points=['十大名将 · 五星觉醒步战造型', '满屏敌军一扫而空 · 千人斩停不下来'],
         shot='b_zhaoyun_crowd', cy=0.5, zoom=1.15, heroes=[('zhaoyun_1', 0.5)], glow=(255, 236, 170)),
    dict(key='tianji', title='天机抽签', sub='签签开盲盒 · 全凭天命', points=['上上签 · 五虎上将齐出大招', '几十种随机签 · 每局都不一样'],
         shot='t_sign_wuhu', cy=0.53, zoom=1.0, heroes=[('wuming_4', 0.5)], glow=(214, 180, 255), hx=0.16, hk=6),
    dict(key='heroes', title='名将大招', sub='赵云关羽吕布 · 一招清屏', points=['专属大招 · 立绘切入', '征战 · 守城 · 布阵 · 天机签'],
         shot='b_lvbu_ult_cut', cy=0.42, zoom=1.0, heroes=[('guanyu_4', 0.0), ('zhaoyun_4', 0.5), ('sunshangxiang_4', 1.0)], glow=(255, 200, 150)),
]

def portrait(t, n, W, H):
    k = W / 720
    HEAD = int(330 * k)
    im = paper(W, H, n)
    # 画面区：游戏截图（上沿用纸色渐隐接住标题区）
    sh = shot(t['shot'], W, H - HEAD + int(40 * k), 0.5, t['cy'], t['zoom'])
    im.paste(sh, (0, HEAD - int(40 * k)))
    im.paste(paper(W, int(90 * k), n), (0, HEAD - int(40 * k)), vfade(int(90 * k), 255, 0, W))
    d = ImageDraw.Draw(im)
    # 标题区
    text(d, (int(36 * k), int(34 * k)), '长坂单骑传', serif(32 * k), INK)
    seal(d, int(232 * k), int(30 * k), int(44 * k))
    d.rounded_rectangle([W - int(196 * k), int(32 * k), W - int(32 * k), int(76 * k)], radius=int(6 * k), outline=INK, width=max(2, int(2 * k)))
    text(d, (W - int(114 * k), int(54 * k)), '玩法亮点 %d/3' % n, sans(22 * k), INK, anchor='mm')
    text(d, (W // 2, int(168 * k)), t['title'], serif(124 * k), INK, anchor='mm')
    text(d, (W // 2, int(262 * k)), t['sub'], serif(40 * k), CINNABAR, anchor='mm')
    # 底部要点（墨色渐变带）
    bh = int(200 * k)
    band = Image.new('RGBA', (W, bh), (24, 16, 12, 0))
    band.putalpha(vfade(bh, 0, 225, W))
    im.paste(band, (0, H - bh), band)
    d = ImageDraw.Draw(im)
    for i, p in enumerate(t['points']):
        text(d, (W // 2, H - int(118 * k) + i * int(52 * k)), p, sans(32 * k), CREAM, stroke=3 * k, sc=(24, 16, 12), anchor='mm')
    # 名将：放大站在画面下方
    hs = t['heroes']
    kk = int(t.get('hk', 9 if len(hs) == 1 else 6) * k)
    for name, pos in hs:
        sp = sprite(name, kk, t['glow'])
        x = int(W * (0.5 if len(hs) == 1 else 0.2 + pos * 0.6) - sp.width / 2)
        y = H - int(205 * k) - sp.height + int(30 * k)
        if len(hs) == 1: x = int(W * t.get('hx', 0.72) - sp.width / 2)
        im.paste(sp, (x, y), sp)
    return im

def landscape(t, n):
    W, H = 1280, 720
    im = paper(W, H, n + 10)
    # 右侧：手机画面竖条（墨框）
    PW, PH = 404, 660
    ph = shot(t['shot'], PW, PH, 0.5, t['cy'], t['zoom'])
    px, py = W - PW - 70, 30
    d = ImageDraw.Draw(im)
    d.rectangle([px - 10, py - 10, px + PW + 10, py + PH + 10], fill=INK)
    im.paste(ph, (px, py))
    d = ImageDraw.Draw(im)
    text(d, (70, 58), '长坂单骑传', serif(34), INK)
    seal(d, 280, 52, 48)
    d.rounded_rectangle([70, 124, 250, 166], radius=6, outline=INK, width=2)
    text(d, (160, 145), '玩法亮点 %d/3' % n, sans(24), INK, anchor='mm')
    text(d, (64, 200), t['title'], serif(128), INK)
    text(d, (72, 360), t['sub'], serif(44), CINNABAR)
    for i, p in enumerate(t['points']):
        d.rectangle([76, 458 + i * 58, 90, 472 + i * 58], fill=CINNABAR)
        text(d, (106, 465 + i * 58), p, sans(30), INK, anchor='lm')
    # 名将站在文字区右下、压住画面左边框
    hs = t['heroes']
    kk = 7 if len(hs) == 1 else 4
    for i, (name, pos) in enumerate(hs):
        sp = sprite(name, kk, t['glow'])
        x = px - sp.width + 70 - (len(hs) - 1 - i) * 120
        y = H - sp.height + (10 if len(hs) == 1 else 40)
        im.paste(sp, (x, y), sp)
    return im

for n, t in enumerate(THEMES, 1):
    save_jpg(portrait(t, n, 720, 1280), 'docs/promo/竖版%d_720x1280.jpg' % n, 195)
    save_jpg(landscape(t, n), 'docs/promo/横版%d_1280x720.jpg' % n, 195)
    save_jpg(portrait(t, n, 1080, 1920), 'docs/promo/投放/竖版%d_1080x1920.jpg' % n, 395)

# —— 分享图 500×400（5:4）：combo 连斩、ult 大招、strat 锦囊 ——
SHARE = [
    ('combo', '分享图1_连斩挑战', 'b_guanyu_crowd', 0.5, 1.25, '万军丛中一口气斩敌上千', '你能撑过几分钟？', 'guanyu_1', '点击应战'),
    ('ult', '分享图2_大招七进七出', 'b_zhaoyun_ult_cut', 0.25, 1.0, '一招「七进七出」', '满屏敌军全倒！你也来试试', 'zhaoyun_4', '点击试玩'),
    ('strat', '分享图3_锦囊三选一', 'b_strat', 0.27, 1.0, '三个锦囊只能选一个', '换你，选哪个？', 'zhuge_4', '点击作答'),
]
for key, fname, sname, cy, zoom, l1, l2, hero, cta in SHARE:
    W, H = 500, 400
    im = shot(sname, W, H, 0.5, cy, zoom)
    # 顶部宣纸标题条
    head = paper(W, 112, 5)
    im.paste(head, (0, 0))
    im.paste(paper(W, 30, 5), (0, 112), vfade(30, 255, 0, W))
    d = ImageDraw.Draw(im)
    text(d, (W // 2, 40), l1, serif(36), INK, anchor='mm')
    text(d, (W // 2, 86), l2, serif(28), CINNABAR, anchor='mm')
    sp = sprite(hero, 3 if key == 'strat' else 4, (255, 236, 170))
    im.paste(sp, (W - sp.width + 14, H - sp.height + 12), sp)
    d = ImageDraw.Draw(im)
    d.rectangle([0, H - 36, 230, H], fill=INK)
    text(d, (14, H - 18), '长坂单骑传 · ' + cta, sans(20), CREAM, anchor='lm')
    save_jpg(im, 'assets/share/%s.jpg' % key, 60)
    save_jpg(im, 'docs/promo/%s_500x400.jpg' % fname, 60)

# —— 提审宣传图 340×200（<25KB）：宣纸 + 五位步战名将 + 标题 ——
W, H = 340, 200
im = paper(W, H, 9)
d = ImageDraw.Draw(im)
text(d, (W // 2, 36), '长坂单骑传', serif(40), INK, anchor='mm')
text(d, (W // 2, 72), '十大名将 · 一骑当千', serif(16), CINNABAR, anchor='mm')
for i, name in enumerate(['guanyu_4', 'zhangfei_4', 'zhaoyun_4', 'machao_4', 'huangzhong_4']):
    sp = sprite(name, 2)
    x = int(W * (0.12 + i * 0.19) - sp.width / 2)
    im.paste(sp, (x, H - sp.height + 6), sp)
save_jpg(im, 'docs/review/宣传图_340x200.jpg', 24)
