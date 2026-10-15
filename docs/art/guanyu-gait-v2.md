# 关羽八帧小跑预览 v2

**状态：2026-10-16 用户反馈马腿配色与腿型不合适，此版仅作步态试验记录，不作为可接入的美术候选。最新单帧修正见 [guanyu-leg-review-v3.md](guanyu-leg-review-v3.md)，须先由用户确认。**

用户要求先看造型与动画，确认后再接入游戏。本次仅修改 docs / tools，正式游戏代码和包体保持原样。

## 本次做法

1. 用内置 imagegen 从关羽四帧图的左上角造型提取固定身体层，保留骑手、马身、马头、尾巴和刀，移除旧马腿。源文件：`guanyu-rig-body.png`。
2. 头部、躯干、马鞍与刀共用一张固定图；整层仅有 0～1 像素的纵向起伏，不随每帧边界左右漂移。
3. 四条腿由固定附着点、关节和足端轨迹驱动，前后腿按对角配对，错开半个周期。
4. 触地半周期中足端匀速向后；摆动半周期中足端抬起并向前回收。每周期抽取 8 帧。
5. 每个循环的地面位移为 40 个预览像素；支撑脚的反向位移与地面一致。帧间数学检查确认脚与地面保持相对位置，不向前滑动。

这仍是步态试作，腿部轮廓和身体层衔接可继续精修；不表示已经达到最终游戏美术质量。左侧旧版与右侧新版本按同一循环时长播放，便于对照。

## 查看方式

```bash
node tools/guanyu-preview.mjs
node tools/guanyu-gait-preview.mjs
```

第二个命令需要可选开发工具 sharp。打开 `dist/guanyu-gait/关羽小跑步态-v2.html`。支持暂停、逐帧、左右朝向、速度调整、开关地面滚动和显示落脚点。生成的 HTML 内嵌图像，可单文件离线查看。

已检查：8 帧渲染、首尾闭环、支撑脚运动方向、与地面同速、收腿离地、暂停、逐帧、左右翻转及预览脚本错误。

## 身体层生成记录

工具：内置 imagegen，参考图编辑；透明背景：true。输入：`guanyu-trot-sheet.png`。

最终提示词：

```text
Use case: precise-object-edit. Create one transparent cutout body layer for a 2D cutout horse-trot rig. The input is a 2x2 sheet; use ONLY the TOP-LEFT Guan Yu and horse as the exact edit target. Preserve that character's face, green headscarf, long black beard, emerald robe, metal shoulder armor, gold edging, brown saddle, green-and-gold saddlecloth, tail, reddish chestnut horse torso, neck and head, and the entire up-right crescent guandao EXACTLY in design, proportions, view, scale relationships, colors and crisp pixel-cluster style. The character is facing right. Change ONLY this: remove ALL FOUR horse legs below their attachment points, leaving a clean, naturally rounded underside of the horse torso with clear hip and shoulder attachment locations. The horse body, rider and weapon form ONE fixed layer; leg motion will be controlled separately by code. Keep the horse tail intact, even where it hangs below the body. Keep Guan Yu's visible boot/stirrup intact. Do not add leg stumps dangling downward, do not add any hoof, do not invent new armor or alter the silhouette above the belly. Complete tiny occluded belly areas cleanly as needed so old leg shapes are fully gone. Output exactly ONE single complete rider-and-horse-body cutout centered on a real transparent background with generous clear margin on every side. No four-frame grid, no other poses, no separate parts, no scenery, no shadow, no labels, no text, no watermark. Maintain pixel-art edges and dark outlines. This is a technical body plate to preserve one identical torso across all animation frames, not a character redesign.
```
