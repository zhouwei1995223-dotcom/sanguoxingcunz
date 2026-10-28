# 推广图：竖版 720×1280 三张 + 横版 1280×720 三张，JPEG < 200KB。
# 画面全部是游戏实拍截图（tools/shots/promo.mjs），标题点出玩法亮点。
# 用法：SHOT_DIR=dist/promo Q='?skip=1' node tools/shot.mjs promo && python3 tools/promo/compose.py <标题字体.ttc>
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
FONT = sys.argv[1]           # 思源宋体 Noto Serif CJK Black（SIL OFL，可商用）
SANS = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
SRC, OUT = 'dist/promo/', 'docs/promo/'
os.makedirs(OUT, exist_ok=True)
def serif(sz): return ImageFont.truetype(FONT, sz, index=2)   # 2 = 简体中文
def sans(sz): return ImageFont.truetype(SANS, sz)
GOLD, RED = (255, 214, 102), (196, 40, 40)
ITEMS = [
    ('p_combat', '一骑当千', '万军丛中 爽快割草', ['满屏曹军一扫而空', '百人斩 · 千人斩 连斩停不下来'], 0.36),
    ('p_levelup', '兵法进化', '每局都是新流派', ['升级三选一 · 满级合成进化', '武将专属联动 · 自由搭配'], 0.47),
    ('p_strat', '锦囊妙计', '神机妙算 扭转战局', ['每局三次锦囊三选一', '良策 · 妙计 · 神机 三档 24 条'], 0.45),
]
def text(d, xy, s, font, fill, stroke=6, sc=(40, 16, 10), anchor='la'):
    d.text(xy, s, font=font, fill=fill, stroke_width=stroke, stroke_fill=sc, anchor=anchor)
def save(im, path):
    for q in (92, 88, 84, 80, 76, 72, 68, 64, 60):
        im.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(path) < 195 * 1024: return q, os.path.getsize(path) // 1024
    return q, os.path.getsize(path) // 1024
def header_bg(w, h):
    bg = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(bg)
    top, bot = (34, 20, 40), (120, 44, 40)
    for y in range(h):
        t = y / h; d.line([0, y, w, y], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return bg
def tag(d, x, y, s, font):
    w = d.textlength(s, font=font)
    d.rounded_rectangle([x, y, x + w + 28, y + font.size + 16], radius=8, fill=RED)
    d.text((x + 14, y + 6), s, font=font, fill=(255, 245, 225))
for n, (shot, title, sub, points, focus) in enumerate(ITEMS, 1):
    src = Image.open(SRC + shot + '.png').convert('RGB')
    # ---------- 竖版 720×1280 ----------
    W, H, HEAD = 720, 1280, 330
    sc = src.resize((W, round(src.height * W / src.width)), Image.LANCZOS)
    y0 = int(min(max(0, sc.height * focus - (H - HEAD) / 2), sc.height - (H - HEAD)))
    im = header_bg(W, H)
    im.paste(sc.crop((0, y0, W, y0 + H - HEAD)), (0, HEAD))
    # 头部和画面之间的过渡
    fade = Image.new('L', (W, 60)); fd = ImageDraw.Draw(fade)
    for y in range(60): fd.line([0, y, W, y], fill=int(255 * (1 - y / 60)))
    im.paste(header_bg(W, HEAD + 60).crop((0, HEAD, W, HEAD + 60)), (0, HEAD), fade)
    d = ImageDraw.Draw(im)
    d.text((32, 28), '长坂单骑传', font=serif(30), fill=(240, 220, 190))
    tag(d, W - 190, 26, '玩法亮点 %d/3' % n, sans(24))
    text(d, (W // 2, 150), title, serif(116), GOLD, stroke=8, anchor='mm')
    text(d, (W // 2, 248), sub, serif(44), (255, 246, 230), stroke=5, anchor='mm')
    # 底部要点
    by = H - 150
    band = Image.new('RGBA', (W, 150), (20, 10, 14, 0)); bd = ImageDraw.Draw(band)
    for y in range(150): bd.line([0, y, W, y], fill=(20, 10, 14, int(215 * min(1, y / 70))))
    im.paste(band, (0, by), band)
    for i, p in enumerate(points):
        text(d, (W // 2, by + 62 + i * 46), p, sans(32), (255, 240, 210), stroke=3, anchor='mm')
    q, kb = save(im, OUT + '竖版%d_720x1280.jpg' % n)
    print('竖版', n, q, kb, 'KB')
    # ---------- 横版 1280×720：左边文字，右边游戏画面 ----------
    W2, H2 = 1280, 720
    bg = src.resize((W2, round(src.height * W2 / src.width)), Image.LANCZOS)
    cy = int(min(max(0, bg.height * focus - H2 / 2), bg.height - H2))
    bg = bg.crop((0, cy, W2, cy + H2)).filter(ImageFilter.GaussianBlur(10))
    bg = Image.blend(bg, Image.new('RGB', (W2, H2), (30, 14, 20)), 0.6)
    PW = 400; ph = round(src.height * PW / src.width)
    panel = src.resize((PW, ph), Image.LANCZOS)
    py = int(min(max(0, ph * focus - (H2 - 60) / 2), ph - (H2 - 60)))
    panel = panel.crop((0, py, PW, py + H2 - 60))
    px = W2 - PW - 90
    dd = ImageDraw.Draw(bg)
    dd.rounded_rectangle([px - 8, 22, px + PW + 8, H2 - 22], radius=22, fill=(18, 12, 16))
    bg.paste(panel, (px, 30))
    d2 = ImageDraw.Draw(bg)
    d2.text((70, 60), '长坂单骑传', font=serif(34), fill=(240, 220, 190))
    tag(d2, 70, 120, '玩法亮点 %d/3' % n, sans(26))
    text(d2, (66, 200), title, serif(132), GOLD, stroke=8)
    text(d2, (72, 370), sub, serif(50), (255, 246, 230), stroke=5)
    for i, p in enumerate(points):
        d2.ellipse([76, 478 + i * 64, 92, 494 + i * 64], fill=GOLD)
        text(d2, (108, 486 + i * 64), p, sans(34), (255, 240, 210), stroke=3, anchor='lm')
    q, kb = save(bg, OUT + '横版%d_1280x720.jpg' % n)
    print('横版', n, q, kb, 'KB')
