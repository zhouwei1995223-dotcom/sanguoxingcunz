# 小游戏头像第二版（2026-11-09）：五星觉醒赵云（步战造型）半身像，宣纸底 + 朱红落日 + 淡墨远山，和主界面同一画风。
# 内容都在中间圆内，平台裁成圆形也完整。用法：python3 tools/promo/avatar2.py（需先跑 promo2.mjs 导出 sprites）
import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SP = 'dist/promo2/sprites/'
OUT = 'docs/icon/'
N = 1200  # 先画大图再缩小

bg = Image.new('RGB', (N, N))
d = ImageDraw.Draw(bg)
top, bot = (243, 234, 214), (220, 200, 166)
for y in range(N):
    t = y / N
    d.line([0, y, N, y], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
noise = Image.effect_noise((N // 3, N // 3), 22).resize((N, N)).convert('L')
bg = ImageChops.multiply(bg, Image.merge('RGB', [noise.point(lambda v: 228 + v // 9)] * 3))
# 朱红落日（带柔光）
sun = Image.new('L', (N, N), 0)
ImageDraw.Draw(sun).ellipse([N * 0.2, N * 0.1, N * 0.8, N * 0.7], fill=255)
glow = sun.filter(ImageFilter.GaussianBlur(N * 0.05))
bg.paste(Image.new('RGB', (N, N), (232, 120, 96)), (0, 0), glow.point(lambda v: v * 0.35))
bg.paste(Image.new('RGB', (N, N), (206, 58, 48)), (0, 0), sun.point(lambda v: v * 0.82))
# 淡墨远山
hill = Image.new('L', (N, N), 0); hd = ImageDraw.Draw(hill)
hd.polygon([(0, N), (0, N * 0.74), (N * 0.22, N * 0.62), (N * 0.42, N * 0.72), (N * 0.62, N * 0.6), (N * 0.85, N * 0.7), (N, N * 0.64), (N, N)], fill=70)
hd.polygon([(0, N), (0, N * 0.86), (N * 0.3, N * 0.78), (N * 0.55, N * 0.86), (N * 0.8, N * 0.77), (N, N * 0.84), (N, N)], fill=110)
hill = hill.filter(ImageFilter.GaussianBlur(N * 0.012))
bg.paste(Image.new('RGB', (N, N), (62, 50, 40)), (0, 0), hill)

# 赵云半身：截 sprite 上面 30 行（头盔、脸、肩甲、枪），最近邻放大
hero = Image.open(SP + 'zhaoyun_4.png').convert('RGBA')
bust = hero.crop((0, 0, hero.width, 31))
k = 30
bust = bust.resize((bust.width * k, bust.height * k), Image.NEAREST)
x = (N - bust.width) // 2 + int(N * 0.01)
y = N - bust.height + int(N * 0.02)
# 白色描边光晕，让人物从红日里跳出来
a = Image.new('L', (N, N), 0); a.paste(bust.getchannel('A'), (x, y))
halo = a.filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.GaussianBlur(10))
bg.paste(Image.new('RGB', (N, N), (255, 246, 226)), (0, 0), halo.point(lambda v: min(255, v * 2)))
bg = bg.convert('RGBA'); bg.alpha_composite(bust, (x, y))
bg = bg.convert('RGB')

os.makedirs(OUT, exist_ok=True)
for s in (600, 512, 144):
    im = bg.resize((s, s), Image.LANCZOS)
    p = OUT + '长坂单骑传_头像%d.png' % s
    im.save(p, optimize=True)
    print(p, os.path.getsize(p) // 1024, 'KB')
