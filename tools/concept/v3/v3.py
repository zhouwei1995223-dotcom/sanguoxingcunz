# v3：头单独按细比例取样（头变大），身体和马按粗比例取样（身体变小），再手画眼睛
import sys
sys.path.insert(0, sys.path[0])
from PIL import Image
import numpy as np
from collections import deque
from pal import PAL, h
SRC, OUT = sys.argv[1], sys.argv[2]
HB, BB = float(sys.argv[3]), float(sys.argv[4])   # 头的块大小、身体的块大小
a = np.asarray(Image.open(SRC).convert('RGB')).astype(int)
SH, SW, _ = a.shape
r, g, b = a[..., 0], a[..., 1], a[..., 2]
near = np.abs(a - np.array([253, 229, 195])).sum(2) < 40
# 背景只算和边缘连通的米色（皮肤颜色和背景很接近，不能只按颜色判断）
bg = np.zeros_like(near)
dq = deque()
for x in range(SW):
    for y in (0, SH - 1):
        if near[y, x] and not bg[y, x]: bg[y, x] = True; dq.append((y, x))
for y in range(SH):
    for x in (0, SW - 1):
        if near[y, x] and not bg[y, x]: bg[y, x] = True; dq.append((y, x))
while dq:
    cy, cx = dq.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = cy + dy, cx + dx
        if 0 <= ny < SH and 0 <= nx < SW and near[ny, nx] and not bg[ny, nx]: bg[ny, nx] = True; dq.append((ny, nx))
# 马腿之间被围住的背景（和边缘不连通），下半身没有皮肤，直接按颜色算背景
bg |= near & (np.arange(SH)[:, None] > 560)
shadow = (r > 150) & (r < 225) & (g > 130) & (g < 200) & (b > 90) & (b < 160) & (r - b > 40)
shadow &= np.arange(SH)[:, None] > 860
aura = (b > 200) & (g > 170) & (r < 190) & (b - r > 40)
mask = ~(bg | shadow | aura)
q = np.clip((a // 12) * 12 + 6, 0, 255)

def sample(m, block, x0, y0, x1, y1):
    gw, gh = int((x1 - x0) / block), int((y1 - y0) / block)
    out = np.zeros((gh, gw, 4), np.uint8)
    for j in range(gh):
        for i in range(gw):
            ya, yb = int(y0 + j * block), int(y0 + (j + 1) * block); xa, xb = int(x0 + i * block), int(x0 + (i + 1) * block)
            mm = m[ya:yb, xa:xb]
            if mm.mean() < 0.45: continue
            cols = q[ya:yb, xa:xb][mm].reshape(-1, 3)
            keys, cnt = np.unique(cols, axis=0, return_counts=True)
            out[j, i, :3] = keys[cnt.argmax()]; out[j, i, 3] = 255
    return out

# 头：发顶到下巴，去掉左下角的肩甲
HX0, HY0, HX1, HY1 = 372, 62, 668, 304
hm = mask.copy()
yy, xx = np.mgrid[0:SH, 0:SW]
hm &= ~((xx < 480) & (yy > 252))
head = sample(hm, HB, HX0, HY0, HX1, HY1)
body = sample(mask, BB, 0, 0, SW, SH)
# 对齐点：下巴下方的脖子（原图坐标）
AX, AY = 548, 300
bx, by = AX / BB, AY / BB
hx, hy = (AX - HX0) / HB, (AY - HY0) / HB
PAD = 20
CW, CH = body.shape[1] + PAD * 2, body.shape[0] + PAD * 2
can = np.zeros((CH, CW, 4), np.uint8)
can[PAD:PAD + body.shape[0], PAD:PAD + body.shape[1]] = body
ox, oy = int(round(PAD + bx - hx)), int(round(PAD + by - hy))
# 先把身体图里原来的小头擦掉（下巴以上、肩甲右边）
small_top = int(PAD + 62 / BB); small_bot = int(PAD + AY / BB)
for y in range(small_top, small_bot):
    for x in range(int(PAD + 470 / BB), int(PAD + 670 / BB)):
        can[y, x] = 0
for j in range(head.shape[0]):
    for i in range(head.shape[1]):
        if head[j, i, 3]: can[oy + j, ox + i] = head[j, i]
np.save(OUT + '.npy', can)
print('head', head.shape, 'body', body.shape, 'head at', ox, oy)
