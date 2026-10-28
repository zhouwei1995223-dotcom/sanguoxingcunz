import sys
from PIL import Image
import numpy as np
from collections import deque
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src); im = im.crop(im.getbbox())
a = np.asarray(im).astype(int).copy(); H, W, _ = a.shape
rgb = a[..., :3]; alpha = a[..., 3] > 0
aura = (rgb[..., 2] > 200) & (rgb[..., 0] < 170) & (rgb[..., 1] > 150)
shadow = (rgb[..., 0] > 170) & (rgb[..., 0] - rgb[..., 2] > 30) & (np.arange(H)[:, None] > H - 7)
alpha &= ~aura & ~shadow
def comps():
    seen = np.zeros_like(alpha); res = []
    for y in range(H):
        for x in range(W):
            if alpha[y, x] and not seen[y, x]:
                c = []; dq = deque([(y, x)]); seen[y, x] = True
                while dq:
                    cy, cx = dq.popleft(); c.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and alpha[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; dq.append((ny, nx))
                res.append(c)
    return res
for c in comps():
    if len(c) < 12:
        for y, x in c: alpha[y, x] = False
K = np.array([21, 18, 28])
o = np.zeros((H + 2, W + 2, 4), np.uint8)
o[1:-1, 1:-1, :3] = rgb; o[1:-1, 1:-1, 3] = alpha * 255
al = o[..., 3] > 0
dark = al & (o[..., :3].astype(int).sum(2) < 170)
res = o.copy()
for y in range(H + 2):
    for x in range(W + 2):
        if al[y, x]: continue
        nb = [(y + dy, x + dx) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + dy < H + 2 and 0 <= x + dx < W + 2 and al[y + dy, x + dx]]
        if nb and not all(dark[p] for p in nb): res[y, x] = [*K, 255]
# 原有的深色像素统一成描边色
d = (res[..., 3] > 0) & (res[..., :3].astype(int).sum(2) < 90)
res[d, :3] = K
Image.fromarray(res).save(out)
bg = Image.new('RGBA', (W + 2, H + 2), (255, 231, 196, 255)); bg.alpha_composite(Image.fromarray(res))
bg.resize(((W + 2) * 8, (H + 2) * 8), Image.NEAREST).save(out.replace('.png', '_x8.png'))
