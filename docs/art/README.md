# 赵云造型与动画预览

用户认可了 `zhaoyun-approved-reference.png` 右侧的造型。此前 `tools/zhaoyun-animation.ts` 的 32×32 字符画试作压缩了比例和细节，用户反馈与认可图片差距过大，该试作不应再作为造型标准。

本次采用内置 **imagegen**，直接参考认可图片生成 `zhaoyun-trot-sheet.png`，保留银蓝头盔、宽深蓝披风、棕色马鞍、紧凑的白马轮廓和弯腿姿态。素材为真实透明 PNG，1280×1280，2×2 四帧；顺序为从左到右、从上到下。

```bash
node tools/zhaoyun-reference-preview.mjs
```

打开 `dist/zhaoyun-reference/赵云动画预览-v2.html`，可比较认可原画与图片帧动画，支持暂停、逐帧、左右翻转、速度和显示大小调整。生成的 HTML 内嵌两张图片，可单独复制后离线查看。通过透明区域识别各帧边界，并统一底部基线，保持统一缩放比例。

目前是独立预览，未接入正式图集，也不随 `npm run build` 进入游戏包。生成帧的披风、红缨和轮廓仍存在少量差异；正式使用前需要逐帧清理、校准位置，并在战斗显示尺寸下验证。此处保存生成素材的出处，不把这些图片描述为代码绘制素材。

## 最终生成提示词

工具：内置 imagegen；模式：参考图编辑；透明背景：true。输入为 `zhaoyun-approved-reference.png`。

```text
Use case: identity-preserve. Asset type: transparent game sprite animation sheet. Edit target: ONLY the mounted Zhao Yun character on the RIGHT side of the reference image, the one labeled 优化版. The user liked THAT exact right-hand character and rejected a simplified redrawing. Preserve its exact identity and visual design: silver-blue segmented helmet with side cheek guards, broad red helmet plume, small clearly visible face looking right, articulated silver-blue armor, large dark navy cape flowing left, brown leather saddle and reins, compact upright white horse with a full curved neck and well-defined head looking right, four bent short legs with black hooves, long silver spear held diagonally up-right with small red tassel. Keep the reference character's proportions, compact squat powerful horse body, armor shapes, face and helmet silhouette, palette, pixel-cluster shading, dark outline and pixel-art craft. Do NOT simplify it to match an old 32x32 character; preserve the detail visible in the approved right-hand figure. Create a production sprite sheet containing exactly FOUR animation frames in an EXACT uniform 2-by-2 grid, read left to right then top to bottom. Canvas square, each quadrant equal size, with one COMPLETE mounted character per quadrant centered at the same coordinates relative to that quadrant. All four face RIGHT, all have the same size, spear angle, horse body width and rider proportions. No pose drifting or camera changes. Four coherent consecutive phases of a subtle horse trot: contact, low passing, lift, high passing. Animate primarily the horse's bent legs, with only tiny vertical bounce of rider and subtle cape-tip flutter. Keep torso, face, armor and horse head consistent across frames. Ensure four anatomically distinct short horse legs, no extra legs, no stretching. Entire spear tip and entire plume, cape, tail and hooves fit within each quadrant with generous transparent margins. Edges must be hard stepped pixel shapes, no smooth anti-aliasing, no blur, no painting, no gradients. REAL transparent background, zero grass, no shadows beneath, no health bars, no comparison panel, no captions, no labels, no numbers, no grid lines, no text. All pixels outside the four characters must be transparent. The right-hand reference is the strict model sheet. The left-hand original sprite is NOT a design reference.
```
