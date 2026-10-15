// node tools/guanyu-trot-v4.mjs [输出目录]；需可选开发工具 sharp。
// 修正稿的八帧图片动画，仅供本人确认，不参与正式构建。
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url), sharp = require('sharp');
const out = path.resolve(process.argv[2] || 'dist/guanyu-trot-v4');
fs.mkdirSync(out, { recursive: true });
const source = 'docs/art/guanyu-trot-v4.png';
const meta = await sharp(source).metadata(), cw = meta.width / 4, ch = meta.height / 2;
const w = Math.ceil(cw), h = Math.ceil(ch), cells = [];
for (let i = 0; i < 8; i++) {
  const col = i % 4, row = Math.floor(i / 4), left = Math.floor(col * cw), top = Math.floor(row * ch);
  const width = Math.floor((col + 1) * cw) - left, height = Math.floor((row + 1) * ch) - top;
  cells.push(await sharp(source).extract({ left, top, width, height }).resize(w, h, { kernel: 'nearest' }).ensureAlpha().raw().toBuffer());
}
// 只用骑手/马鞍区域求平移，避免按披风、马蹄的外框居中造成漂移。
const sample = [];
for (let y = Math.floor(h * .2); y < h * .72; y += 3) for (let x = Math.floor(w * .25); x < w * .58; x += 3) {
  const p = (y * w + x) * 4;
  if (cells[0][p + 3] > 200) sample.push([x, y, p]);
}
const shifts = [], urls = [], bodyCut = Math.floor(h * .735);
for (let f = 0; f < 8; f++) {
  let best = { x: 0, y: 0, score: Infinity };
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
    let score = 0;
    for (const [x, y, p] of sample) {
      const q = ((y + dy) * w + x + dx) * 4;
      score += Math.abs(cells[0][p] - cells[f][q]) + Math.abs(cells[0][p + 1] - cells[f][q + 1]) + Math.abs(cells[0][p + 2] - cells[f][q + 2]) + Math.abs(cells[0][p + 3] - cells[f][q + 3]);
    }
    if (score < best.score) best = { x: dx, y: dy, score };
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4;
    if (y < bodyCut) cells[0].copy(rgba, p, p, p + 4);
    else {
      const sx = x + best.x, sy = y + best.y;
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
        const q = (sy * w + sx) * 4;
        cells[f].copy(rgba, p, q, q + 4);
      }
    }
  }
  const png = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(path.join(out, `frame-${f}.png`), png);
  urls.push('data:image/png;base64,' + png.toString('base64'));
  shifts.push({ x: best.x, y: best.y });
}
const reference = 'data:image/png;base64,' + fs.readFileSync('docs/art/guanyu-leg-review-v3.png').toString('base64');
fs.writeFileSync(path.join(out, '关羽修正腿型小跑-v4.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>关羽 · 修正腿型小跑</title>
<style>*{box-sizing:border-box}body{margin:0;padding:25px 16px 35px;background:#171b22;color:#f3ead8;text-align:center;font:15px "Microsoft YaHei",sans-serif}h1{font-size:25px;margin:0 0 8px}p{color:#b8c2bc;font-size:13px;line-height:1.7}.cards{max-width:1020px;margin:22px auto 16px;display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{border:1px solid #4f5d46;border-radius:12px;overflow:hidden;background:#26352a}h2{font-size:17px;margin:16px 0 12px}.reference{height:420px;background:#5a8237;display:flex;justify-content:center;align-items:center}.reference img{display:block;max-width:100%;max-height:100%;object-fit:contain}canvas{display:block;width:100%;height:auto;image-rendering:pixelated}.controls{max-width:1020px;margin:auto;padding:16px;background:#242b35;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}button,select{font:inherit;padding:8px 12px;border:1px solid #789b62;border-radius:6px;background:#34432d;color:#fff3d5;cursor:pointer}label{display:flex;align-items:center;gap:6px;font-size:13px}input[type=range]{width:115px;accent-color:#a6ca76}input[type=checkbox]{accent-color:#a6ca76}@media(max-width:600px){.cards{grid-template-columns:1fr}.reference{height:350px}}</style>
<h1>关羽 · 修正腿型小跑</h1><p>按站姿修正稿延续赤棕配色与腿部轮廓</p><div class="cards"><section class="card"><h2>修正稿 · 站姿参考</h2><div class="reference"><img alt="修正后的关羽与战马站姿" src="${reference}"></div></section><section class="card"><h2>八帧小跑 · 待确认</h2><canvas id="animated" width="480" height="420"></canvas></section></div><div class="controls"><button id="play">暂停</button><button id="step">逐帧</button><select id="direction" aria-label="朝向"><option value="1">朝右</option><option value="-1">朝左</option></select><label>速度<input id="speed" type="range" min="4" max="14" value="10"><span id="fps">10 帧/秒</span></label><label><input id="ground" type="checkbox" checked>地面滚动</label></div><p id="frame">加载中…</p><p>仅为独立动画预览，尚未接入游戏。</p>
<script>
const el=id=>document.getElementById(id),sources=${JSON.stringify(urls)};
let frame=0,playing=true,loaded=false,last=performance.now(),elapsed=0;
const images=sources.map(src=>{const img=new Image();img.src=src;return img;});
function draw(){if(!loaded)return;const g=el('animated').getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#5a8237';g.fillRect(0,0,480,420);const offset=el('ground').checked?frame*7.5:0;g.fillStyle='#789b4a';for(let y=12;y<420;y+=40)for(let x=-60;x<540;x+=60){const xx=x-offset+(y%80?17:0);g.fillRect(xx,y,3,2);g.fillRect(xx+21,y+18,2,4);}g.fillStyle='#385029';g.beginPath();g.ellipse(240,384,112,6,0,0,Math.PI*2);g.fill();g.save();if(el('direction').value==='-1'){g.translate(480,0);g.scale(-1,1);}g.drawImage(images[frame],46,8,388,388);g.restore();el('frame').textContent='第 '+(frame+1)+' / 8 帧';}
el('play').onclick=()=>{playing=!playing;el('play').textContent=playing?'暂停':'播放';};el('step').onclick=()=>{playing=false;el('play').textContent='播放';frame=(frame+1)%8;draw();};el('direction').onchange=el('ground').onchange=draw;el('speed').oninput=()=>{el('fps').textContent=el('speed').value+' 帧/秒';elapsed=0;};
window.__preview={setFrame(i){frame=((i%8)+8)%8;playing=false;el('play').textContent='播放';draw();},get loaded(){return loaded;},get frame(){return frame;}};
function tick(now){if(loaded&&playing){elapsed+=Math.min(100,now-last);const duration=1000/Number(el('speed').value);while(elapsed>=duration){elapsed-=duration;frame=(frame+1)%8;draw();}}last=now;requestAnimationFrame(tick);}
Promise.all(images.map(image=>new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;}))).then(()=>{loaded=true;draw();requestAnimationFrame(tick);}).catch(e=>{console.error(e);el('frame').textContent='加载失败';});
</script></html>`);
console.log(JSON.stringify({ out, frameSize: [w, h], bodyCut, shifts }));
