import sys
from PIL import Image
import numpy as np
src, out, block = sys.argv[1], sys.argv[2], float(sys.argv[3])
a = np.asarray(Image.open(src).convert('RGB')).astype(int)
H, W, _ = a.shape
bg = np.array([253, 229, 195])
r, g, b = a[..., 0], a[..., 1], a[..., 2]
isbg = np.abs(a - bg).sum(2) < 40
# 影子（地面上的褐色椭圆）也当背景
shadow = (r > 150) & (r < 225) & (g > 130) & (g < 200) & (b > 90) & (b < 160) & (r - b > 40)
aura = (b > 200) & (g > 170) & (r < 190) & (b - r > 40)
mask = ~(isbg | shadow | aura)
# 按块取众数（量化后），保持颜色干净
q = (a // 12) * 12 + 6
gw, gh = int(W / block), int(H / block)
grid = np.zeros((gh, gw, 4), np.uint8)
for j in range(gh):
    for i in range(gw):
        y0, y1 = int(j * block), int((j + 1) * block); x0, x1 = int(i * block), int((i + 1) * block)
        m = mask[y0:y1, x0:x1]
        if m.mean() < 0.45: continue
        cols = q[y0:y1, x0:x1][m]
        keys, cnt = np.unique(cols.reshape(-1, 3), axis=0, return_counts=True)
        # 暗色线条优先：块里有足够多的深色就取深色（保住描边）
        dark = cols[cols.sum(1) < 200]
        if False:
            c = np.median(dark, 0)
        else:
            c = keys[cnt.argmax()]
        grid[j, i, :3] = np.clip(c, 0, 255); grid[j, i, 3] = 255
Image.fromarray(grid).save(out)
