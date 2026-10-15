# 关羽马腿修正单帧 v3（站姿参考）

2026-10-16 用户要求按此稿继续制作动画，最新八帧候选见 [guanyu-trot-v4.md](guanyu-trot-v4.md)。尚未确认接入游戏。

日期：2026-10-16。用户反馈 v2 小跑预览的马腿颜色与马身不一致，腿型也不像马。此前程序化骨段绘制的腿部不再作为造型候选。

本次先交付一张站立单帧，单独检查颜色、四肢比例、关节和马蹄，不继续沿用未认可的腿型制作动画。用户确认后再推进动作，正式游戏代码与包体保持原样。

## 文件与检查重点

- `guanyu-leg-feedback-v2.png`：用户提供的问题截图。
- `guanyu-leg-review-v3.png`：本次修正候选。
- 上腿使用与肩胸、马身一致的暖赤棕色及明暗层次；远侧腿使用同色系较深阴影，深灰主要留给马蹄和细描边。
- 前腿从肩胸自然衔接，前臂到较细的下肢有粗细变化；后腿保留臀部肌肉、飞节与马蹄的形状。
- 采用略错开的承重站姿，便于先检查腿型。尚未形成新一版动画，也未接入图集。

## 生成记录

工具：内置 imagegen；模式：参考图局部编辑；保留草地背景，透明背景参数为 false。输入为用户问题截图，输出为单帧候选。未使用 CLI/API 回退。

最终提示词：

```text
Use case: precise-object-edit. Edit the attached pixel-art game screenshot. The user correctly points out that the horse's legs have mismatched colors and do not look like horse legs. Correct ONLY the horse legs and their attachment to the underside of the chest and rump. Preserve Guan Yu, face, beard, headscarf, green costume, armor, saddle, cloth, entire guandao, horse head and neck, torso proportions, tail, pixel-art style and grassy background as faithfully as possible. Replace ALL four crude angular mechanical stick legs with four properly drawn, anatomically credible EQUINE legs in a calm weight-bearing standing pose with a slight stagger so the near and far legs can be distinguished. Match the upper-leg fur to the SAME warm reddish chestnut palette sampled from the horse's shoulder and barrel: warm rust-orange light planes, brick-red midtones, deep reddish-brown shadows. Far legs may be slightly darker REDDISH BROWN, not grey or desaturated purple. Dark charcoal should be reserved mainly for hooves and narrow outlines, not whole legs. Horse anatomy: near foreleg emerges naturally from the shoulder/chest, has a substantial upper forearm narrowing into a slender cannon, a subtly defined carpal joint, a small fetlock and short sloping pastern leading into a compact solid hoof; do not draw a human elbow or a huge forward triangular hinge. Hind leg must connect through a rounded muscular thigh at the rump, show a believable stifle/thigh transition, and a distinct backward-pointing hock above a narrower lower limb, fetlock and hoof. The rear limb silhouette should read as a horse's natural hock structure, not a human knee, insect joint, robotic strut or zigzag bar. Keep a compact chibi horse proportion compatible with the original game art, with muscle mass at the upper legs and tapered lower legs. Avoid long skinny legs. The belly-to-leg joins must be continuous painted fur with coherent light and dark planes; remove the obvious flat black cut-and-paste seam along the belly. Keep four legs total, with mild depth overlap, no extra feet, no detached pieces, no crossed or twisted legs. Place all weight-bearing hooves naturally on the ground. Use the same crisp stepped pixel clusters, dark outlines and limited shaded palette as the horse body, without photorealism or smooth vector strokes. Output ONE complete corrected single-frame game character on the same grassy background, without captions, comparison panels, labels, arrows, text or watermark. This is an anatomy-and-color review still, not a new design and not an animation sheet.
```
