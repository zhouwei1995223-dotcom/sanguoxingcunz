# 在自动降采样的结果上手修：脸、蹄子下的影子残留、毛刺
import sys
sys.path.insert(0, sys.path[0])
from PIL import Image
import numpy as np
from pal import PAL, h
src, out = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src)).copy()
H, W, _ = a.shape
def put(x, y, ch):
    if ch == ' ': return
    if ch == '.': a[y, x] = 0; return
    a[y, x, :3] = h(PAL[ch]); a[y, x, 3] = 255
def patch(x0, y0, rows):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r): put(x0 + i, y0 + j, ch)
# 脸：朝右的侧脸，刘海压在额头，大眼睛，耳朵在后面
patch(38, 15, [
    "  kdhdkbbbbbbkdk",
    " kdhddhkssssskk ",
    " kdhdssskkkssk  ",
    " kdsSssskWLkssk ",
    " kdSsSsskLBksssk",
    " kdkSsssskkssssk",
    " kkdkssssssssSk ",
    "  kkkkssssSSkk  ",
    "    kkkkkkkk    ",
])
# 脑后头发（原来是一团黑）
patch(32, 17, [
    "kdhhdhdk",
    "kdhdhhdk",
    " kdhhdk ",
    "  kddk  ",
])
# 头发只留三种棕色，去掉杂色
HAIR = [h(PAL[c]) for c in 'Hhd']
for y in range(0, 22):
    for x in range(26, 60):
        r, g, b, al = a[y, x].astype(int)
        if not al: continue
        if r > g + 8 and r > b + 8 and r + g + b < 420 and r + g + b > 110 and not (r > 190):
            best = min(HAIR, key=lambda c: (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2)
            a[y, x, :3] = best
        elif r + g + b < 110:
            a[y, x, :3] = h(PAL['k'])
# 去掉蹄子下面的影子残留（偏棕/偏粉的浅色）
for y in range(H - 10, H):
    for x in range(W):
        r, g, b, al = a[y, x].astype(int)
        if al and r > 130 and r - b > 25: a[y, x] = 0
# 去毛刺：只有一个邻居的描边像素删掉（重复两遍）
for _ in range(2):
    m = a[..., 3] > 0
    for y in range(H):
        for x in range(W):
            if not m[y, x] or a[y, x, :3].astype(int).sum() > 120: continue
            n = sum(1 for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + dy < H and 0 <= x + dx < W and m[y + dy, x + dx])
            if n <= 1: a[y, x] = 0
# 白色区域去噪：浅色像素若四邻里有 3 个相同的浅色，就换成它
for _ in range(2):
    b2 = a.copy()
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if not a[y, x, 3] or a[y, x, :3].astype(int).sum() < 420: continue
            nb = [tuple(a[y + dy, x + dx]) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            for c in set(nb):
                if nb.count(c) >= 3 and c[3] and sum(int(v) for v in c[:3]) >= 420 and c != tuple(a[y, x]): b2[y, x] = c
    a = b2
# 孤立小点
m = a[..., 3] > 0
for y in range(H):
    for x in range(W):
        if m[y, x] and not any(0 <= y + dy < H and 0 <= x + dx < W and m[y + dy, x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx): a[y, x] = 0
Image.fromarray(a).save(out)
bg = Image.new('RGBA', (W, H), (255, 231, 196, 255)); bg.alpha_composite(Image.fromarray(a))
bg.resize((W * 8, H * 8), Image.NEAREST).save(out.replace('.png', '_x8.png'))
bg.crop((24, 0, 64, 34)).resize((40 * 16, 34 * 16), Image.NEAREST).save(out.replace('.png', '_face.png'))
