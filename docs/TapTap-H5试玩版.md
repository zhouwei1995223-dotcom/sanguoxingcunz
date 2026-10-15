# TapTap H5 无广告试玩版

核对日期：2026-10-15。游戏《长坂单骑传》，版本 1.0.0，竖屏单机 H5；所有代码在 `claude/sweet-mendel-f5w2nu`。

## 1. 官方要求与适用范围

本项目使用 Canvas 2D / DOM，上传时选择 **H5 游戏 / H5 小游戏包体**。TapTap 将 H5 和普通 Tap 小游戏分为不同形态；Unity/Cocos 导出、TapTap 打包工具、`game.json` / `project.config.json` 等普通小游戏流程不能直接套用于本 H5 包。

| 项目 | 核对结果 | 本次处理 |
| --- | --- | --- |
| 文件格式与入口 | 官方 H5 上传工具检查构建目录内的 `index.html`，压缩时保留该目录名作为 ZIP 第一层 | ZIP 内只有 `taptap/`，里面直接是 `index.html`、`game.js` |
| 目录命名 | 官方包体说明要求第一层只有一个英文或数字命名的文件夹；不可再套一层存放游戏内容的大目录 | 文件夹名 `taptap`；不混入源码、说明书或 `__MACOSX` |
| 资源路径 | H5 部署在平台域名下，需要能从入口加载资源 | JS 用相对路径 `./game.js`；图像与声音运行时生成，不依赖外链/CDN |
| 屏幕与操作 | 官方 H5 工具支持竖屏/横屏；手机试玩需要触屏操作 | 后台选竖屏；单指摇杆和按钮，电脑可用鼠标或 WASD |
| SDK | 官方形态说明把登录、排行榜、云存档等列为按需接入能力；H5 上传流程本身检查目录并上传 ZIP，不要求项目安装原生 TapSDK | 此版不接登录、广告、支付或云服务；不声明已经在代码中接入实名认证/防沉迷 |
| 大小 | 公开 H5 上传工具没有给出明确的统一大小上限。普通小游戏的创建页写“60M+”，审核页写“20MB 以下”，口径不同，不能据此认定 H5 上限 | 本次未压缩 334,342 字节（约 327 KiB），ZIP 113,544 字节（约 111 KiB）；具体上传限制以账号后台即时提示为准 |
| 内购与资质 | 普通小游戏文档说明：不涉及内购可无需提交版号，但普通小游戏正式上架前仍需前置备案；创意工坊或 TapTap 制造按对应要求办理 | 无广告、无内购；“试玩版”仅表示本包用途，不代表自动免除备案或审核 |

官方来源：

- [TapTap 面向 AI 开发者的形态说明](https://developer.taptap.cn/agents/)：区分 H5、Tap 小游戏、APK 与制造。
- [H5 MCP 接入说明](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/mcp-setup/)：H5 的官方工具入口；MCP 是开发侧工具，不是要塞进游戏包里的 SDK。
- [TapTap 官方 H5 上传实现](https://github.com/taptap/instant-games-open-mcp/blob/main/src/features/h5Game/handlers.ts)：`validateH5GamePath`、`compressDirectory` 和方向设置。
- [官方包体结构与 H5 解析错误说明](https://www.taptap.cn/moment/598609424361196724)：第一层文件夹、入口位置、虚拟摇杆。该文标题为 PC 包体说明，H5 目录结论同时由上面的官方 H5 工具实现交叉核对。
- [普通小游戏创建与包体说明](https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/)、[普通小游戏审核规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/review-standards/)：大小和登录要求属于普通小游戏文档，不能混同为本 H5 的统一规则。
- [小游戏前置备案说明](https://developer.taptap.cn/minigameapidoc/quick-start/guide/pre-filing/)：普通小游戏与创意工坊的要求有区别。
- [官方 2026 上传教程的 H5 部分](https://www.taptap.cn/moment/854478404412507237)：旧后台“快速上架（创意工坊）”的 H5 上传与包体选择。该教程有活动背景；本项目是否走此形态，以账号后台实际可选项为准。

## 2. 本包内容

- 启动页及设置页标识 TapTap 试玩版，版本 1.0.0。
- 沿用全部现有章节、武将、装备、锦囊和金疮药；没有额外截断试玩关卡。
- 无广告、无付费：免费福利保留原每日/每局限制；皮肤使用游戏内元宝；100 元宝复活，每局最多一次，军略免费复活仍保留。
- 去掉结算/签到/巡营双倍、广告充怒和锦囊第二次刷新；没有分享、云存档、订阅或好友榜；战绩仅在本机。
- 进度使用本地存储；清理浏览器/平台缓存、换设备或平台存储域变化可能丢失进度。
- 音乐与音效用 Web Audio 合成，第一次触屏操作后解锁播放，切后台停止播放。
- 正式部署地址不响应 `skip` / `rich` / `heroes` / `speed` 等调试参数，不暴露测试用游戏全局对象；仅 `localhost` 可用这些调试能力。
- 隐私说明区分本游戏代码与 TapTap 平台处理的信息，不把平台加载网页描述为完全不联网。

ZIP 结构：

```text
长坂单骑传-TapTap-无广告试玩版-v1.0.0.zip
└── taptap/
    ├── index.html
    └── game.js
```

## 3. 构建、打包与开发验收

```bash
npm ci
npm run build
npm run typecheck
```

构建产物在 `dist/taptap`。不能把小红书 ZIP 改名充当 TapTap ZIP。

Windows PowerShell 在仓库根目录打包，保留 `taptap` 这一层：

```powershell
Compress-Archive -LiteralPath dist/taptap -DestinationPath '长坂单骑传-TapTap-无广告试玩版-v1.0.0.zip' -CompressionLevel Optimal -Force
```

macOS/Linux：

```bash
cd dist
zip -qr '../长坂单骑传-TapTap-无广告试玩版-v1.0.0.zip' taptap
```

自动化测试（需本机已有 Playwright）：

```bash
ROOT=dist/taptap Q='?skip=1&rich=1' node tools/shot.mjs taptap
```

Windows 可用 `$env:ROOT='dist/taptap'`、`$env:Q='?skip=1&rich=1'` 设置环境变量；若没有 Playwright 下载的 Chromium，但安装了 Edge，可再设 `$env:BROWSER_CHANNEL='msedge'`。

## 4. 用户后台操作

1. 登录 [TapTap 开发者中心](https://developer.taptap.cn/)，完成个人开发者认证，进入或创建《长坂单骑传》。先确认是 H5 发布形态；若已经有此游戏，直接使用原条目。
2. 旧后台的官方 H5 教程使用“快速上架（创意工坊）”；普通小游戏和创意工坊资质要求有区别。按后台实际可选项处理，不要为本 ZIP 选择 APK 或普通 Tap 小游戏。
3. 在“游戏包管理 → 小游戏管理”中选择 **H5 包体**上传 ZIP；新版后台按 H5 提示上传。若入口要求先开通其他小游戏能力，先核对是否选错形态。
4. 初次版本填 `1.0.0`；已有同版本时使用更高且唯一的版本。方向选 **竖屏**。版本说明可填：“三国像素动作生存试玩版，支持触屏，无广告、无内购，进度保存在本机。”
5. 等解析完成，在包体列表点“自测”，用安卓和 iPhone 各试玩；首次声音、连续触控、后台暂停、恢复声音、存档要重点验证。
6. 回资料页“游戏下载和获取 → H5小游戏”选中刚传的包体。上传成功与选中发布包是两个步骤。
7. 资料与资质按所选发布形态补齐；游戏状态在提供相应选项时选试玩/提供游玩。平台协议、授权与认证材料由本人阅读确认并按实际情况填写。
8. 真机确认后再在后台提交审核。当前工作仅交付包体，尚未上传 TapTap，也未提交审核或上线。

## 5. 真机验收

- [ ] 首次打开：隐私说明、同意、教学战斗、结算、主城正常。
- [ ] 摇杆移动、大招和金疮药按钮可用，刘海及底部手势条不遮住按钮。
- [ ] 首次交互后能听到音效/音乐，切后台暂停，回到前台正常恢复。
- [ ] 免费军资箱每天 3 次、名将宝匣每天 1 次；100 元宝复活确实扣除，每局最多一次。
- [ ] 没有广告播放、广告倒计时、双倍领取或充值入口。
- [ ] 关闭再打开保留进度，兑换码只能用一次。
- [ ] 连玩三局没有白屏、卡死或无法继续；检查平台自测报告。
