// 构建：浏览器、微信、抖音、小红书小工具、TapTap H5 无广告试玩版
import { build, context } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const watch = process.argv.includes('--watch');
const sim = process.argv.includes('--sim');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// 平台 AppID（微信公众平台 → 开发管理 → 开发设置；抖音开发者后台）
const WX_APPID = 'wx483a0ed3065a3de6';
const TT_APPID = 'testappid';

if (sim) {
  await build({ entryPoints: ['tools/sim.ts'], bundle: true, platform: 'node', outfile: 'dist/sim/sim.js', logLevel: 'error' });
  await build({ entryPoints: ['tools/dps.ts'], bundle: true, platform: 'node', outfile: 'dist/sim/dps.js', logLevel: 'error' });
  process.exit(0);
}

const copyDir = (src, dst) => {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f), d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
};

const common = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2017',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'none',
  keepNames: true,
  logLevel: 'info',
};

function writeShells() {
  // 浏览器
  fs.mkdirSync('dist/web', { recursive: true });
  fs.writeFileSync('dist/web/index.html', `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>长坂单骑传</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}</style>
</head><body><script src="game.js"></script></body></html>
`);
  copyDir('assets', 'dist/web/assets');

  // 微信
  fs.mkdirSync('dist/wechat', { recursive: true });
  fs.writeFileSync('dist/wechat/game.json', JSON.stringify({
    deviceOrientation: 'portrait',
    showStatusBar: false,
    openDataContext: 'openDataContext',
    networkTimeout: { request: 10000, connectSocket: 10000, uploadFile: 10000, downloadFile: 10000 },
  }, null, 2));
  fs.writeFileSync('dist/wechat/project.config.json', JSON.stringify({
    description: '长坂单骑传',
    setting: { urlCheck: false, es6: true, enhance: true, postcss: false, minified: true, minifyWXSS: true },
    compileType: 'game',
    cloudfunctionRoot: 'cloudfunctions/',
    libVersion: '3.3.4',
    appid: WX_APPID,
    projectname: 'sanguo-xingcun',
    condition: {},
  }, null, 2));
  copyDir('platform/wechat', 'dist/wechat');
  copyDir('assets', 'dist/wechat/assets');

  // 抖音
  fs.mkdirSync('dist/douyin', { recursive: true });
  fs.writeFileSync('dist/douyin/game.json', JSON.stringify({ deviceOrientation: 'portrait', showStatusBar: false }, null, 2));
  fs.writeFileSync('dist/douyin/project.config.json', JSON.stringify({
    miniprogramRoot: '',
    projectname: 'sanguo-xingcun',
    description: '长坂单骑传',
    appid: TT_APPID,
    setting: { urlCheck: false, es6: true, postcss: false, minified: true, newFeature: true },
    compileType: 'game',
    condition: {},
  }, null, 2));
  copyDir('assets', 'dist/douyin/assets');

  // 小红书小工具：index.html 必须在 zip 根目录；不能有内联脚本、外部资源和音频文件（音效运行时合成）
  fs.rmSync('dist/xhs', { recursive: true, force: true });
  fs.mkdirSync('dist/xhs', { recursive: true });
  fs.writeFileSync('dist/xhs/index.html', `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>长坂单骑传</title>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
  </style>
</head>
<body>
  <script src="./game.js"></script>
</body>
</html>
`);

  // TapTap H5：构建目录内直接包含 index.html；上传 ZIP 时外包一层英文目录 taptap。
  // 无广告 / 无账号 SDK，复用离线 H5 的运行时合成音频，无需外部资源。
  fs.mkdirSync('dist/taptap', { recursive: true });
  fs.writeFileSync('dist/taptap/index.html', fs.readFileSync('dist/xhs/index.html', 'utf8')
    .replace('<title>长坂单骑传</title>', '<title>长坂单骑传 · TapTap 试玩版</title>\n  <link rel="icon" href="data:," />'));
}

writeShells();
const outs = [
  { ...common, outfile: 'dist/web/game.js', define: { 'process.env.TARGET': '"web"' } },
  { ...common, outfile: 'dist/wechat/game.js', define: { 'process.env.TARGET': '"wx"' } },
  { ...common, outfile: 'dist/douyin/game.js', define: { 'process.env.TARGET': '"tt"' } },
  { ...common, target: ['es2017', 'chrome61'], outfile: 'dist/xhs/game.js', define: { 'process.env.TARGET': '"xhs"' } },
  { ...common, target: ['es2017', 'chrome61'], outfile: 'dist/taptap/game.js', define: { 'process.env.TARGET': '"taptap"' } },
];
if (watch) {
  const ctx = await context(outs[0]);
  await ctx.watch();
  console.log('watching… 浏览器打开 dist/web/index.html（需本地服务器，如 npx http-server dist/web）');
} else {
  for (const o of outs) await build(o);
  for (const d of ['web', 'wechat', 'douyin', 'xhs', 'taptap']) {
    let total = 0;
    const walk = (p) => { for (const f of fs.readdirSync(p)) { const s = path.join(p, f); if (fs.statSync(s).isDirectory()) walk(s); else total += fs.statSync(s).size; } };
    walk('dist/' + d);
    console.log(`dist/${d}: ${(total / 1024).toFixed(0)} KB  (v${pkg.version})`);
  }
}
