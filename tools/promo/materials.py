# 微信「创意小游戏」提审材料：宣传图 340×200（<25KB）+ 创意材料（创作过程截图）
# 用法：node tools/cover/export.mjs && python3 tools/cover/compose.py && python3 tools/promo/materials.py <标题字体.ttc>
import os, re, sys, subprocess, shutil
from PIL import Image, ImageDraw, ImageFont
FONT = sys.argv[1]
OUT = 'docs/review/'
os.makedirs(OUT, exist_ok=True)
def serif(sz): return ImageFont.truetype(FONT, sz, index=2)
def sans(sz): return ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', sz)
def mono(sz): return ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', sz, index=1)
BG, INK, GOLD = (34, 24, 32), (245, 232, 210), (255, 214, 102)

# ---------- 宣传图 340×200：从封面画布里截主角 + 一部分曹军 ----------
can = Image.open('dist/cover_canvas.png')
crop = can.crop((58, 6, 143, 56)).resize((340, 200), Image.NEAREST).convert('RGB')
for q in (90, 85, 80, 75, 70, 65, 60):
    crop.save(OUT + '宣传图_340x200.jpg', 'JPEG', quality=q, optimize=True)
    if os.path.getsize(OUT + '宣传图_340x200.jpg') < 24 * 1024: break
print('宣传图', q, os.path.getsize(OUT + '宣传图_340x200.jpg') // 1024, 'KB')

# ---------- 材料1：字符画 → 像素图 ----------
pal = dict(re.findall(r"'?(\w)'?\s*:\s*'(#[0-9a-fA-F]{6})'", open('src/gfx/palette.ts', encoding='utf8').read()))
src = open('src/gfx/art/hero.ts', encoding='utf8').read()
rows = re.findall(r"'([.\w]+)',", src[src.index('const RIDER'):src.index('];', src.index('const RIDER'))])
W, H = 1200, 800
im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
d.text((40, 30), '创作过程 1：美术全部用代码「字符画」绘制', font=serif(40), fill=GOLD)
d.text((40, 90), '每个字母代表一种颜色，程序把字符画转成像素图，再拼上马、枪、披风，生成 4 帧奔跑动画', font=sans(24), fill=INK)
f = mono(30)
for j, r in enumerate(rows):
    for i, ch in enumerate(r):
        col = pal.get(ch, '#5a4a52') if ch != '.' else '#5a4a52'
        d.text((60 + i * 22, 150 + j * 34), ch, font=f, fill=col)
d.text((360, 400), '→', font=serif(80), fill=GOLD)
spr = Image.open('dist/cover/hero0.png'); spr = spr.crop(spr.getbbox())
k = 16; big = spr.resize((spr.width * k, spr.height * k), Image.NEAREST)
im.paste(big, (500, 150), big)
d.text((40, 755), '源码：src/gfx/art/hero.ts（RIDER）、horse.ts、heroes.ts', font=sans(22), fill=(190, 170, 160))
im.save(OUT + '创意材料1_字符画像素美术.png')

# ---------- 材料2：锦囊妙计设计表 ----------
st = open('src/data/strategies.ts', encoding='utf8').read()
items = re.findall(r"tier: (\d), name: '([^']+)', desc: '([^']+)'", st)
W, H = 1500, 1000
im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
d.text((40, 30), '创作过程 2：原创「锦囊妙计」系统设计表', font=serif(40), fill=GOLD)
d.text((40, 92), '每局 2:00 / 5:00 / 7:30 三选一；以三国计策为题材，良策加数值，妙计改规则，神机定打法', font=sans(24), fill=INK)
cols = [(0, '良策', (0, 153, 219)), (1, '妙计', (254, 174, 52)), (2, '神机', (220, 91, 208))]
for c, (t, nm, colr) in enumerate(cols):
    x = 40 + c * 485
    d.rounded_rectangle([x, 150, x + 465, 960], radius=14, outline=colr, width=3)
    d.text((x + 20, 165), nm, font=serif(36), fill=colr)
    y = 225
    for tier, name, desc in items:
        if int(tier) != t: continue
        d.text((x + 20, y), name, font=serif(26), fill=INK)
        # 描述自动换行
        line, lines = '', []
        for ch in desc:
            if d.textlength(line + ch, font=sans(19)) > 420: lines.append(line); line = ''
            line += ch
        lines.append(line)
        for li, l in enumerate(lines): d.text((x + 22, y + 36 + li * 24), l, font=sans(19), fill=(200, 185, 175))
        y += 44 + len(lines) * 24 + 10
im.save(OUT + '创意材料2_锦囊妙计设计.png')

# ---------- 材料3～5：迭代前后对比（已有） ----------
for i, (name, title) in enumerate((('zhaoyun_微调_对比.png', '武将造型迭代'), ('主界面_改前改后.png', '主界面改版'), ('新手提示.png', '新手提示设计')), 3):
    shutil.copy('docs/art/' + name, OUT + '创意材料%d_%s.png' % (i, title))

# ---------- 材料6：开发迭代记录（git 提交记录） ----------
log = subprocess.run(['git', 'log', '--reverse', '--date=short', '--format=%ad  %s'], capture_output=True, text=True).stdout.strip().split('\n')
W = 1500; per = (len(log) + 1) // 2; H = 170 + per * 30 + 40
im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
d.text((40, 30), '创作过程 6：开发迭代记录（共 %d 次提交）' % len(log), font=serif(40), fill=GOLD)
d.text((40, 92), '从 %s 首版到现在，玩法、数值、美术、平台适配持续迭代' % log[0][:10], font=sans(24), fill=INK)
for i, l in enumerate(log):
    x = 40 + (i // per) * 730; y = 150 + (i % per) * 30
    while d.textlength(l, font=sans(20)) > 690: l = l[:-2] + '…'
    d.text((x, y), l, font=sans(20), fill=(215, 200, 190))
im.save(OUT + '创意材料6_开发迭代记录.png')
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(OUT + f) // 1024, 'KB', Image.open(OUT + f).size)
