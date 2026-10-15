// node tools/guanyu-preview.mjs [输出目录]：独立查看待确认的关羽造型，不修改游戏。
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { encodePNG } from './png.mjs';

const out = path.resolve(process.argv[2] || 'dist/guanyu-preview');
fs.mkdirSync(out, { recursive: true });
await build({ entryPoints: ['tools/guanyu-preview-entry.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'dist/guanyu-preview.mjs', logLevel: 'error' });
const { guanyuFrames } = await import(pathToFileURL(path.resolve('dist/guanyu-preview.mjs')).href);
const frames = [false, true].map((skin) => guanyuFrames(skin).map((img, i) => {
  const data = encodePNG(img.w, img.h, img.toRGBA());
  fs.writeFileSync(path.join(out, `${skin ? 'skin' : 'base'}-${i}.png`), data);
  return 'data:image/png;base64,' + data.toString('base64');
}));
fs.writeFileSync(path.join(out, '关羽造型与动画.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>关羽 · 造型与动画预览</title>
<style>*{box-sizing:border-box}body{margin:0;padding:25px 16px 35px;background:#171b22;color:#f3ead8;text-align:center;font:15px "Microsoft YaHei",sans-serif}h1{font-size:25px;margin:0 0 10px}p{color:#b8c0c6;font-size:13px;line-height:1.7}.cards{max-width:1020px;margin:22px auto 16px;display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{border:1px solid #4f5d46;border-radius:12px;overflow:hidden;background:#26352a}h2{font-size:17px;margin:16px 0 12px}canvas{display:block;width:100%;height:auto;image-rendering:pixelated}.controls{max-width:1020px;margin:auto;background:#242b35;padding:16px;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}button,select{font:inherit;padding:8px 13px;border:1px solid #789b62;border-radius:6px;background:#34432d;color:#fff3d5;cursor:pointer}label{display:flex;gap:8px;align-items:center;font-size:13px}input{width:115px;accent-color:#a6ca76}@media(max-width:600px){.cards{grid-template-columns:1fr}}</style>
<h1>关羽 · 造型与骑乘动画预览</h1><p>绿巾长髯 · 青龙偃月刀 · 赤棕战马</p><div class="cards"><section class="card"><h2>基础造型 · 待确认</h2><canvas id="base" width="480" height="390"></canvas></section><section class="card"><h2>深色皮肤试色</h2><canvas id="skin" width="480" height="390"></canvas></section></div><div class="controls"><button id="play">暂停</button><button id="step">逐帧</button><select id="direction" aria-label="朝向"><option value="1">朝右</option><option value="-1">朝左</option></select><label>速度<input id="speed" type="range" min="4" max="14" value="10"><span id="fps">10 帧/秒</span></label></div><p id="frame">加载中…</p><p>独立造型预览，尚未接入游戏；先确认外形与动作。</p>
<script>
const sources=${JSON.stringify(frames)},el=id=>document.getElementById(id);let index=0,playing=true,loaded=false,last=performance.now(),elapsed=0;
const images=sources.map(group=>group.map(src=>{const image=new Image();image.src=src;return image;}));
const ready=images.flat().map(image=>new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;}));
function draw(){if(!loaded)return;['base','skin'].forEach((id,i)=>{const g=el(id).getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#5a8237';g.fillRect(0,0,480,390);g.fillStyle='#789b4a';for(let n=0;n<65;n++)g.fillRect((n*73+17)%480,(n*47+11)%390,2,3);g.fillStyle='#385029';g.beginPath();g.ellipse(240,331,88,8,0,0,Math.PI*2);g.fill();g.save();if(el('direction').value==='-1'){g.translate(480,0);g.scale(-1,1);}g.drawImage(images[i][index],96,48,288,288);g.restore();});el('frame').textContent='第 '+(index+1)+' / 4 帧';}
el('play').onclick=()=>{playing=!playing;el('play').textContent=playing?'暂停':'播放';};el('step').onclick=()=>{playing=false;el('play').textContent='播放';index=(index+1)%4;draw();};el('direction').onchange=draw;el('speed').oninput=()=>{el('fps').textContent=el('speed').value+' 帧/秒';elapsed=0;};
window.__preview={setFrame(i){index=i%4;playing=false;el('play').textContent='播放';draw();},get loaded(){return loaded;}};
function tick(now){if(playing){elapsed+=Math.min(100,now-last);const delay=1000/Number(el('speed').value);while(elapsed>=delay){elapsed-=delay;index=(index+1)%4;draw();}}last=now;requestAnimationFrame(tick);}
Promise.all(ready).then(()=>{loaded=true;draw();requestAnimationFrame(tick);}).catch(e=>{el('frame').textContent='加载失败';console.error(e);});
</script></html>`);
console.log('关羽独立造型预览：', out);
