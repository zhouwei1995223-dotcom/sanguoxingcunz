# 效果图：参考图的武将上半身（镜像朝右）+ 代码画的白马。分层绘制，每层单独描边后叠加。
# 用法：python3 tools/concept/zhaoyun_mounted.py tools/concept  → 输出 mounted.png / mounted_x8.png（ref_grid.png 是参考图还原的 64×60 像素网格）
import sys
from PIL import Image
import numpy as np
D = sys.argv[1]
ref = np.asarray(Image.open(D + '/ref_grid.png')).astype(int)
BG = ref[0, 0]
W, H = 96, 80

def P(r, g, b): return np.array([r, g, b, 255], np.uint8)
K = P(14, 12, 20)
WH = P(250, 250, 252); W2 = P(234, 236, 242); W3 = P(200, 206, 218); W4 = P(150, 160, 180); W5 = P(104, 114, 134)
B1 = P(112, 160, 248); B2 = P(44, 128, 200); B3 = P(34, 88, 144); B4 = P(48, 64, 128); B5 = P(20, 32, 58)
S1 = P(190, 190, 196); S2 = P(130, 130, 138); S3 = P(70, 70, 80)
GOLD = P(232, 196, 90); HOOF = P(60, 60, 72)

class L:
    def __init__(self): self.a = np.zeros((H, W, 4), np.uint8)
    def put(self, x, y, c):
        if 0 <= x < W and 0 <= y < H: self.a[y, x] = c
    def has(self, x, y): return 0 <= x < W and 0 <= y < H and self.a[y, x, 3] > 0
    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1: self.put(x, y, c)
    def poly(self, pts, c):
        ys = [p[1] for p in pts]
        for y in range(min(ys), max(ys) + 1):
            xs = []
            for i in range(len(pts)):
                (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
                if y1 != y2 and min(y1, y2) <= y + 0.5 < max(y1, y2):
                    xs.append(x1 + (y + 0.5 - y1) * (x2 - x1) / (y2 - y1))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(int(round(a)), int(round(b))): self.put(x, y, c)
    def line(self, x0, y0, x1, y1, c, w=1):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
            for d in range(w): self.put(x + d, y, c)
    def outlined(self):
        a = self.a.copy(); m = self.a[:, :, 3] > 0
        for y in range(H):
            for x in range(W):
                if m[y, x]: continue
                if any(0 <= x + dx < W and 0 <= y + dy < H and m[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    a[y, x] = K
        return a
    def shade(self, base, mid, dark, edge_right=True):
        m = self.a[:, :, 3] > 0; src = self.a.copy()
        for y in range(H):
            for x in range(W):
                if not (m[y, x] and (src[y, x] == base).all()): continue
                if not self.has(x, y + 1): self.a[y, x] = dark
                elif not self.has(x, y + 2) or (edge_right and not self.has(x + 1, y)): self.a[y, x] = mid

def leg(l, x, y0, pose, c, mid, dark):
    pts = [(x, y0)] + [(x + dx, y0 + dy) for dx, dy in pose]
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        l.line(ax, ay, bx, by, c, 3)
    hx, hy = pts[-1]
    for o in range(4): l.put(hx + o - 1 + (1 if o == 0 else 0), hy + 1, HOOF); l.put(hx + o - 1 + (1 if o == 0 else 0), hy + 2, HOOF)
    l.put(hx + 3, hy + 2, HOOF)
    # 腿后侧一道暗线
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        l.line(ax + 2, ay, bx + 2, by, mid)

layers = []
GROUND = 72
def legs(l, x, y0, pose, c, mid):
    pts = [(x, y0)] + [(x + dx, y0 + dy) for dx, dy in pose]
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        l.line(ax, ay, bx, by, c, 4)
        l.line(ax + 3, ay, bx + 3, by, mid)
    hx, hy = pts[-1]
    for o in range(-1, 4):
        l.put(hx + o, hy + 1, HOOF); l.put(hx + o, hy + 2, HOOF)
    l.put(hx + 4, hy + 2, HOOF)
# 1 远侧腿
far = L()
legs(far, 27, 55, [(-4, 7), (-5, 14)], W4, W5)
legs(far, 54, 54, [(4, 7), (6, 15)], W4, W5)
layers.append(far)
# 2 马尾
tail = L()
tail.poly([(23, 44), (17, 46), (12, 52), (9, 60), (10, 67), (14, 63), (17, 56), (23, 50)], W3)
tail.poly([(22, 45), (17, 48), (14, 55), (16, 57), (18, 51), (23, 48)], WH)
tail.line(11, 60, 14, 52, W4); tail.line(12, 64, 15, 58, W4)
layers.append(tail)
# 3 马身 + 脖子 + 头
body = L()
body.ellipse(37, 50, 19, 8.5, WH)
body.ellipse(53, 48, 8, 8, WH)
body.poly([(46, 46), (52, 38), (58, 31), (62, 27), (66, 30), (65, 37), (60, 46), (55, 54)], WH)   # 脖子
body.ellipse(65, 33.5, 4.5, 4.5, WH)                                              # 腮
body.poly([(61, 28), (64, 26), (68, 27), (75, 32), (81, 37), (81, 41), (78, 43), (73, 42), (66, 39), (62, 36)], WH)  # 脸
body.shade(WH, W3, W4)
for x in range(24, 52):
    for y in range(55, 59):
        if body.has(x, y) and (body.a[y, x] == WH).all(): body.put(x, y, W2)
for x in range(60, 66):
    for y in range(36, 41):
        if body.has(x, y) and (body.a[y, x] == WH).all() and not body.has(x, y + 2): body.put(x, y, W3)
# 鬃毛：沿脖子后缘
mane = [(62, 26), (60, 28), (58, 30), (56, 33), (54, 35), (52, 38), (50, 41), (48, 44)]
for i, (x, y) in enumerate(mane):
    body.put(x, y, W2); body.put(x - 1, y, WH); body.put(x - 1, y + 1, W3); body.put(x - 2, y + 1, W2)
    if i % 2 == 0: body.put(x - 2, y + 2, W3); body.put(x - 3, y + 2, W4); body.put(x - 3, y + 3, W4)
# 眼、鼻孔、嘴线
body.put(67, 30, K); body.put(68, 30, K); body.put(67, 31, K); body.put(68, 31, B5); body.put(66, 29, W4); body.put(67, 29, W4); body.put(68, 29, W4)
body.put(79, 38, W5); body.put(80, 39, W5)
body.line(75, 42, 79, 42, W4)
# 笼头：颊带 + 鼻带 + 金环
body.line(64, 28, 66, 38, B3); body.line(72, 33, 73, 41, B3); body.line(66, 37, 72, 37, B3)
body.put(72, 37, GOLD)
# 胸带
body.line(47, 47, 58, 44, B3); body.put(53, 46, GOLD)
layers.append(body)
ear = L()
ear.poly([(61, 28), (62, 20), (66, 27)], WH); ear.put(62, 23, W3); ear.put(62, 24, W3); ear.put(63, 25, W3)
layers.append(ear)
# 4 近侧腿
near = L()
legs(near, 22, 54, [(-3, 8), (-1, 15)], WH, W3)
legs(near, 48, 55, [(6, 4), (11, 9)], WH, W3)
layers.append(near)
# 5 鞍褥
saddle = L()
saddle.poly([(28, 41), (47, 41), (48, 52), (45, 57), (31, 57), (27, 52)], B3)
saddle.poly([(29, 42), (46, 42), (46, 51), (30, 51)], B2)
for x in range(28, 48): saddle.put(x, 56, S1)
for x in range(30, 46, 3): saddle.put(x, 54, B1); saddle.put(x + 1, 54, B1)
for y in range(42, 52): saddle.put(29, y, B1)
layers.append(saddle)
# 6 骑手（参考图上半身，镜像朝右）
rider = L()
RX, RY = 22, 5
def is_bg(v): return np.abs(v - BG).sum() < 30
def is_aura(v): return v[2] > 200 and v[1] > 200 and v[0] < 160
for r in range(4, 42):
    for c in range(18, 49):
        if r < 18 and c >= 41: continue          # 去掉原图的枪杆
        v = ref[r, c]
        if is_bg(v) or is_aura(v): continue
        rider.put(RX + (48 - c), RY + r, np.append(v.astype(np.uint8), 255))
# 去掉描边色（参考图自带黑边，统一后面重新描）
m = (rider.a[:, :, 3] > 0) & (rider.a[:, :, :3].astype(int).sum(2) < 60)
edge = np.zeros_like(m)
for y in range(H):
    for x in range(W):
        if m[y, x] and any(not rider.has(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): edge[y, x] = True
rider.a[edge] = 0
layers.append(rider)
# 7 骑手的腿：深蓝裤 + 银靴，跨在马侧
legr = L()
legr.poly([(40, 43), (48, 43), (54, 48), (55, 53), (50, 54), (44, 49)], B4)   # 大腿
legr.poly([(43, 44), (48, 44), (51, 47), (46, 48)], B3)
legr.poly([(50, 52), (55, 52), (56, 59), (51, 59)], S1)                     # 护胫
legr.poly([(50, 59), (58, 59), (59, 62), (50, 62)], S2)                     # 靴
legr.line(51, 53, 51, 58, WH); legr.line(50, 61, 58, 61, S3)
layers.append(legr)
# 8 缰绳（手到马嘴）
rein = L()
rein.line(57, 45, 64, 41, B5); rein.line(64, 41, 72, 37, B5)
layers.append(rein)
# 9 亮银枪：近手握枪，枪尖斜指前上方
spear = L()
x0, y0, x1, y1 = 45, 70, 74, 4
spear.line(x0, y0, x1, y1, S3, 2)
spear.line(x0 + 1, y0, x1 + 1, y1, S2)
for i, (x, y) in enumerate([(74, 3), (75, 2), (75, 1), (76, 0), (74, 4), (75, 3), (76, 2), (76, 1)]): spear.put(x, y, WH if i % 2 == 0 else S1)
for (x, y, c) in [(73, 7, B1), (72, 8, B2), (74, 8, B2), (71, 9, B1), (73, 9, B3), (75, 9, B1)]: spear.put(x, y, c)
layers.append(spear)
# 10 握枪的手
hand = L()
for (x, y) in [(55, 45), (56, 45), (57, 45), (55, 46), (56, 46), (57, 46)]: hand.put(x, y, P(232, 178, 160))
hand.put(57, 45, P(184, 128, 104)); hand.put(57, 46, P(184, 128, 104))
layers.append(hand)

out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sh = np.zeros((H, W, 4), np.uint8)
for y in range(GROUND, GROUND + 4):
    for x in range(6, 86):
        if ((x - 44) / 34) ** 2 + ((y - GROUND - 1.5) / 2) ** 2 <= 1: sh[y, x] = [60, 40, 20, 70]
out.alpha_composite(Image.fromarray(sh))
for l in layers: out.alpha_composite(Image.fromarray(l.outlined()))
out.save(D + '/mounted.png')
bg = Image.new('RGBA', out.size, (255, 231, 196, 255)); bg.alpha_composite(out)
bg.resize((W * 8, H * 8), Image.NEAREST).save(D + '/mounted_x8.png')
