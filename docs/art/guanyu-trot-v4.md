# 关羽修正腿型小跑预览 v4

日期：2026-10-16。用户回复“做把”，同意按 v3 站姿修正稿继续制作动画；这不表示已确认游戏接入。本次仍只保存独立预览，正式游戏代码与包体未改动。

## 素材与处理

- `guanyu-trot-v4.png`：以内置 imagegen 参考 `guanyu-leg-review-v3.png` 生成的透明 4×2 八帧图片。重点保留与马身一致的暖赤棕配色、肌肉到下肢的粗细变化和马蹄轮廓。
- `tools/guanyu-trot-v4.mjs`：按固定格子切帧；用骑手和马鞍区域求平移，而非按马蹄或披风外框居中。
- 切片规范化为 444×444，各帧配准位移为 `(0,0)、(0,0)、(0,-1)、(0,-1)、(1,0)、(0,0)、(0,0)、(0,0)`。
- 上方 326 行统一采用第 0 帧，减少骑手、马身和刀的跳动；下方使用生成图片中的腿部动作，不再使用 v2 的程序骨段腿。
- 原始帧与用于播放的稳定帧分别保留。八帧按阅读顺序播放；阴影贴近马蹄落点，预览地面向后滚动，可关闭单看动作。

这是一版待本人查看的小跑候选。已检查帧数、上方图层一致性、脚本循环与播放控件；画面中的关节衔接和步态观感仍需用户确认，不把自动检查等同于艺术质量通过。

## 查看

```bash
node tools/guanyu-trot-v4.mjs
```

需要可选开发工具 sharp。打开 `dist/guanyu-trot-v4/关羽修正腿型小跑-v4.html`。HTML 内嵌图像，支持暂停、逐帧、速度、左右方向和地面滚动开关，可单文件离线查看。

## 生成记录

工具：内置 imagegen，参考图编辑；透明背景：true。未使用 CLI/API 回退。

最终提示词：

```text
Use case: identity-preserve animation sheet. Edit target and strict model sheet: the attached corrected Guan Yu riding a reddish chestnut horse. This is the accepted anatomy-and-color reference. Preserve this exact rider identity, face, green headscarf, long black beard, robe, armor, gold trim, guandao, horse head, neck, torso, tail, saddle and cloth, the same compact chibi proportions and right-facing three-quarter view. Preserve the painted pixel-art treatment of the horse's legs: muscular upper limbs, slender but substantial lower limbs, subtle joints, real equine hocks/fetlocks/pasterns and compact solid hooves. Upper legs must use the SAME warm chestnut, rust-orange highlights, brick-red midtones and reddish-brown shadows as the body. Far legs are only moderately darker warm chestnut. Dark charcoal is primarily for hooves and narrow outlines. No grey flat stick legs, no robotic hinges, no insect zigzags, no human knees. The new task is to animate this accepted horse into ONE smooth light TROT cycle with EIGHT sequential frames. Output a LANDSCAPE 2:1 canvas containing an EXACT uniform FOUR-COLUMN by TWO-ROW grid, eight equally sized cells, in reading order left to right then top to bottom. One complete mounted figure per cell, ALL facing RIGHT, ALL at the same scale, all rider/horse torso and saddle landmarks at the same position within each cell, all standing hoof ground baselines consistent, generous transparent padding and full guandao tip inside the cell. Keep the entire upper figure nearly identical across frames; only one-pixel equivalent vertical weight shift and a small cloth-tail movement. Use natural opposite diagonal leg pairs: near foreleg with far hindleg; far foreleg with near hindleg, offset by half a cycle. For a right-facing trot, a supporting hoof travels from in FRONT of its shoulder/hip toward BEHIND it while it stays on the ground, moving RIGHT TO LEFT relative to the stationary torso; it then lifts, folds and returns LEFT TO RIGHT while airborne. Do NOT move a planted hoof forward. Frame 1: diagonal pair A reaches forward and contacts, pair B finishes its back push. Frame 2: A bears weight slightly farther back, B lifts and folds. Frame 3: A beneath the body in midstance, B swings forward above the ground. Frame 4: A behind the body pushing off, B extends forward ready for contact. Frame 5: B contacts forward, A ends back push. Frame 6: B loads, A lifts and folds. Frame 7: B midstance, A swings forward. Frame 8: B pushes off behind, A reaches forward to lead smoothly back into frame 1. Maintain exactly FOUR horse legs, believable muscular roots continuous with chest and rump, consistent leg lengths and coat shading; no extra feet, crossed limbs, broken hocks, stretches, huge jumps or floating hooves. Paint every leg with the same quality and lighting as the body, never replace them with simple line segments. Match the reference's crisp deliberate square pixel clusters and clean dark outline, no soft vector illustration or photorealism. REAL transparent background. Remove the grass and ground shadow entirely. No captions, numbers, labels, panel borders, grid lines, text or watermarks. Eight anatomically coherent drawings of the SAME horse and rider, not eight redesigned characters.
```
