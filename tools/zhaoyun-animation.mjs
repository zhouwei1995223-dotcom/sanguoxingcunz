// node tools/zhaoyun-animation.mjs [输出目录]；默认在 dist/zhaoyun-animation。
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { encodePNG } from './png.mjs';

const out = path.resolve(process.argv[2] || 'dist/zhaoyun-animation');
fs.mkdirSync(out, { recursive: true });
await build({ entryPoints: ['tools/zhaoyun-animation.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'dist/zhaoyun-animation.mjs', logLevel: 'error' });
const { animationPreview: data } = await import(pathToFileURL(path.resolve('dist/zhaoyun-animation.mjs')).href + '?v=' + Date.now());
const color = (s) => {
  if (s.startsWith('rgba')) return s.match(/[\d.]+/g).map(Number).map((v, i) => i === 3 ? Math.round(v * 255) : v);
  return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 255];
};
for (const kind of ['original', 'trial']) data[kind].forEach((frame, i) => {
  const rgba = new Uint8ClampedArray(frame.w * frame.h * 4);
  [...frame.pixels].forEach((p, j) => { if (p !== '.') rgba.set(color(data.palette[p]), j * 4); });
  fs.writeFileSync(path.join(out, `${kind}-${i}.png`), encodePNG(frame.w, frame.h, rgba));
});

fs.writeFileSync(path.join(out, '赵云动画对比.html'), `<!DOCTYPE html>
<html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>赵云 · 骑乘动画对比</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:28px 16px 40px;background:#171a20;color:#f4ead3;font-family:"Microsoft YaHei",sans-serif;text-align:center}h1{margin:0 0 9px;font-size:25px}p{margin:8px auto;color:#b6beb8;font-size:14px;line-height:1.7}.stage{max-width:850px;margin:24px auto 18px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{overflow:hidden;border:1px solid #49553c;border-radius:12px;background:#253528}h2{margin:16px 0 4px;font-size:18px}canvas{display:block;width:100%;height:auto;image-rendering:pixelated}.controls{max-width:850px;margin:auto;padding:16px;background:#232932;border-radius:12px;display:flex;justify-content:center;gap:12px;flex-wrap:wrap;align-items:center}button,select{font:inherit;background:#35432c;color:#f4ead3;border:1px solid #798f56;border-radius:6px;padding:8px 14px;cursor:pointer}input{max-width:140px;accent-color:#a4c96b}label{display:flex;gap:8px;align-items:center;font-size:14px}.small{width:128px;height:128px;margin:0 auto 12px}.meta{font-size:12px;color:#afbaaa;padding-bottom:12px}@media(max-width:500px){h1{font-size:21px}.stage{gap:8px}button,select{padding:8px}.small{width:96px;height:96px}}
</style>
<h1>赵云 · 骑乘动画对比</h1><p>白马银甲、深蓝披风、红缨长枪 · 优化造型试作</p>
<div class="stage"><section class="card"><h2>游戏原版</h2><canvas id="old" width="256" height="224"></canvas><canvas class="small" id="oldSmall" width="64" height="64"></canvas><div class="meta">原有角色与步态</div></section><section class="card"><h2>优化试作</h2><canvas id="next" width="256" height="224"></canvas><canvas class="small" id="nextSmall" width="64" height="64"></canvas><div class="meta">蓝银分层 · 弯腿步态 · 披风摆动</div></section></div>
<div class="controls"><button id="play">暂停</button><button id="step">逐帧</button><select id="direction" aria-label="角色朝向"><option value="1">朝右</option><option value="-1">朝左</option></select><select id="mode" aria-label="动作"><option value="run">奔跑</option><option value="idle">站立</option></select><label>速度 <input id="speed" type="range" min="4" max="16" value="10"><span id="fps">10 帧/秒</span></label></div><p id="frame">第 1 / 4 帧</p><p>下方小图用于检查游戏内小尺寸的辨识度。此页面为独立预览。</p>
<script>
const data=${JSON.stringify(data)};
let running=true, frame=0, elapsed=0, last=performance.now();
const el=id=>document.getElementById(id), contexts=['old','next','oldSmall','nextSmall'].map(id=>el(id).getContext('2d'));
function draw(ctx,kind,small){
 const c=ctx.canvas,w=c.width,h=c.height,scale=small?2:5, f=data[kind][el('mode').value==='idle'?0:frame];
 ctx.fillStyle='#5a8237';ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#759d47';for(let i=0;i<34;i++){let x=(i*37+17)%w,y=(i*23+9)%h;ctx.fillRect(x,y,small?1:2,small?2:3);}
 const foot=small?h-5:h-34, x=Math.floor((w-f.w*scale)/2),y=foot-(f.h-2)*scale;
 ctx.fillStyle='#365022';ctx.fillRect(Math.floor(w/2-12*scale),foot-2,24*scale,small?3:7);
 ctx.save();if(el('direction').value==='-1'){ctx.translate(w,0);ctx.scale(-1,1);}
 for(let row=0;row<f.h;row++)for(let col=0;col<f.w;col++){const p=f.pixels[row*f.w+col];if(p!=='.'){ctx.fillStyle=data.palette[p];ctx.fillRect(x+col*scale,y+row*scale,scale,scale);}}
 ctx.restore();if(!small){ctx.fillStyle='#181425';ctx.fillRect(w/2-62,foot+9,124,12);ctx.fillStyle='#63c74d';ctx.fillRect(w/2-58,foot+12,116,6);}
}
function render(){contexts.forEach((ctx,i)=>draw(ctx,i%2?'trial':'original',i>=2));el('frame').textContent='第 '+(el('mode').value==='idle'?1:frame+1)+' / 4 帧';}
el('play').onclick=()=>{running=!running;el('play').textContent=running?'暂停':'播放';};
el('step').onclick=()=>{running=false;el('play').textContent='播放';frame=(frame+1)%4;render();};
el('speed').oninput=()=>{el('fps').textContent=el('speed').value+' 帧/秒';elapsed=0;};
el('direction').onchange=el('mode').onchange=render;
function tick(now){if(running&&el('mode').value==='run'){elapsed+=Math.min(100,now-last);const duration=1000/Number(el('speed').value);while(elapsed>=duration){elapsed-=duration;frame=(frame+1)%4;}}last=now;render();requestAnimationFrame(tick);}requestAnimationFrame(tick);
</script></html>`);
console.log('4 帧动画与独立预览已生成：', out);
