# 关羽造型与四帧动画预览

用户要求：先给本人看造型与动画，确认后再接入游戏。当前仅保存独立预览，`src/`、正式图集与正式构建内容均未改动；本地短暂试接入已撤回，没有推送或交付包含关羽新造型的游戏包。

- `guanyu-original-reference.png`：从当前代码导出的原版关羽四帧，用于核对身份和配色。
- `guanyu-trot-sheet.png`：内置 imagegen 生成的透明 2×2 四帧，参考原版关羽及用户认可的赵云美术风格。
- `guanyu-preview-data.ts`：预览用 96×96 像素数据，包含基础造型和深色皮肤试色；不在 `src/`，不会进入正式构建。
- 重点：绿巾长髯、厚重肩甲、绿袍金边、清晰的青龙偃月刀，以及赤棕战马的四帧步态。

运行 `node tools/guanyu-preview.mjs`，打开 `dist/guanyu-preview/关羽造型与动画.html`。页面支持暂停、逐帧、左右翻转和速度调整，HTML 已内嵌图片，可单独离线查看。

需要重新整理源图片时，使用可选开发工具 sharp 运行 `node tools/import-guanyu-art.mjs`。该命令只更新 docs 中的预览数据。图片帧仍有少量轮廓差异，最终接入前应校准。

## 生成记录

工具：内置 imagegen。使用两张参考图进行造型优化；真实透明背景；未使用 CLI/API 回退。

最终提示词：

```text
Use case: style-transfer and identity-preserve. Asset type: transparent four-frame mounted game character sprite sheet for the Three Kingdoms pixel game 长坂单骑传. Input image 1 (four small green mounted figures): the actual existing Guan Yu character, identity and costume-color reference. Input image 2 (comparison of white mounted Zhao Yun): use ONLY its RIGHT character as the approved pixel-art style, level of detail, compact mounted proportions and camera reference; do NOT copy Zhao Yun's face, helmet, spear, blue cape or white horse. Redesign GUAN YU in that approved coherent game-art family. Preserve his distinctive green wrapped headscarf with a short flowing cloth tail, reddish warm face, stern small eyes and eyebrows, and a long full black beard descending in front of the chest. Make the beard, robe and armor readable as separate shapes. He wears rich emerald-green war robes with dark forest-green shadows, clearly defined iron shoulder armor, a broad gold belt and restrained gold edging. He rides a compact muscular REDDISH CHESTNUT horse with dark mane and tail, bent short legs and black hooves; brown leather saddle and green saddlecloth with gold trim. Upgrade the current brown horse toward a warm reddish chestnut, keeping it distinct from Zhao Yun's white horse. Guan Yu holds ONE unmistakable Qinglong Yanyuedao / guandao: long dark wooden shaft held diagonally upward to the RIGHT, a broad curved crescent steel blade with a bright silver cutting edge and subtle jade-green accent near the blade socket. The blade must look like a large curved Chinese pole blade, not a tiny axe, not a spear or halberd. Guan Yu should look broad, grounded and dignified; face and beard remain recognizably him. Camera is a slightly elevated right-facing three-quarter side view, matching the approved Zhao Yun. Use crisp deliberate stepped square pixel clusters, dark clean outlines, controlled palette, readable armor and mount layers. Retain the level of detail visible in the approved reference, without forcing it into a 32x32 grid. Avoid smooth digital painting, blur, anti-aliasing, gradients, photorealism or fancy ornamental over-detail. Output EXACTLY FOUR consecutive subtle horse-trot frames in a uniform 2-by-2 grid on a SQUARE canvas, reading left to right then top to bottom. Each quadrant contains one COMPLETE mounted Guan Yu, centered consistently at the same scale and foot baseline, with generous transparent margins and the whole blade fitting inside the cell. Four phases: contact, passing, lift, passing. Keep head, beard identity, body proportions, guandao angle and armor identical across frames; move mainly four horse legs with tiny rider bounce and gentle robe-tail motion. Do not stretch horse anatomy or add extra legs. REAL transparent background, no grass, no scenery, no floor shadows, no health bars, no labels, no text, no grid lines, no extra characters.
```
