// node tools/guanyu-gait-preview.mjs [输出目录]；需要可选开发工具 sharp。
// 仅生成独立预览。固定身体图层，用足端轨迹与两段关节重做八帧小跑。
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const out = path.resolve(process.argv[2] || 'dist/guanyu-gait');
fs.mkdirSync(out, { recursive: true });
const input = 'docs/art/guanyu-rig-body.png';
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  if (data[(y * info.width + x) * 4 + 3] < 128) continue;
  x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
}
const width = x1 - x0 + 1, height = y1 - y0 + 1;
const scale = Math.min(96 / height, 112 / width), bw = Math.round(width * scale), bh = Math.round(height * scale);
const body = await sharp(input).extract({ left: x0, top: y0, width, height }).resize(bw, bh, { kernel: 'nearest' }).png().toBuffer();
const bodyUrl = 'data:image/png;base64,' + body.toString('base64');
const oldFrames = [0, 1, 2, 3].map(i => 'data:image/png;base64,' + fs.readFileSync(`dist/guanyu-preview/base-${i}.png`).toString('base64'));
fs.writeFileSync(path.join(out, '关羽小跑步态-v2.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>关羽 · 小跑步态对比</title>
<style>*{box-sizing:border-box}body{margin:0;padding:25px 16px 36px;background:#171b22;color:#f3ead8;text-align:center;font:15px "Microsoft YaHei",sans-serif}h1{font-size:25px;margin:0 0 8px}p{color:#b7c2bd;font-size:13px;line-height:1.7}.cards{max-width:1040px;margin:22px auto 16px;display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{border:1px solid #4e5c46;border-radius:12px;overflow:hidden;background:#26352a}h2{font-size:17px;margin:16px 0 12px}canvas{display:block;width:100%;height:auto;image-rendering:pixelated}.controls{max-width:1040px;margin:auto;background:#242b35;padding:16px;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}button,select{font:inherit;padding:8px 12px;border:1px solid #789b62;border-radius:6px;background:#34432d;color:#fff3d5;cursor:pointer}label{display:flex;align-items:center;gap:6px;font-size:13px}input[type=range]{width:105px;accent-color:#a6ca76}input[type=checkbox]{accent-color:#a6ca76}@media(max-width:600px){.cards{grid-template-columns:1fr}}</style>
<h1>关羽 · 小跑步态对比</h1><p>固定马身与骑手 · 蹬地向后、收腿向前 · 八帧循环</p><div class="cards"><section class="card"><h2>上一版 · 四帧轮播</h2><canvas id="old" width="480" height="420"></canvas></section><section class="card"><h2>这一版 · 八帧步态</h2><canvas id="next" width="480" height="420"></canvas></section></div><div class="controls"><button id="play">暂停</button><button id="step">逐帧</button><select id="direction" aria-label="朝向"><option value="1">朝右</option><option value="-1">朝左</option></select><label>速度<input id="speed" type="range" min="4" max="16" value="10"><span id="fps">10 帧/秒</span></label><label><input id="ground" type="checkbox" checked>地面滚动</label><label><input id="contacts" type="checkbox">显示落脚点</label></div><p id="frame">加载中…</p><p>仅供造型与动作确认，尚未接入游戏。</p>
<script>
const el=id=>document.getElementById(id),body=new Image(),oldSources=${JSON.stringify(oldFrames)};
body.src=${JSON.stringify(bodyUrl)};const old=oldSources.map(src=>{const image=new Image();image.src=src;return image;});
let index=0,playing=true,loaded=false,last=performance.now(),elapsed=0;
const period=40,stride=20,duty=.5,groundY=115;
const fract=x=>x-Math.floor(x),ease=t=>t*t*(3-2*t);
// 触地半周期匀速向后，摆动半周期抬起向前；与地面速度严格对应。
function foot(hipX,phase,far){const u=fract(phase);if(u<duty)return{x:hipX+stride/2-period*u,y:groundY-(far?2:0),contact:true};const t=(u-duty)/(1-duty);return{x:hipX-stride/2+stride*ease(t),y:groundY-(far?2:0)-10*Math.sin(Math.PI*t),contact:false};}
function joint(root,end,l1,l2,bend){const dx=end.x-root.x,dy=end.y-root.y,d=Math.max(.001,Math.hypot(dx,dy));if(d>l1+l2+.01)throw Error('腿长不足');const a=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-a*a));return{x:root.x+dx*a/d+dy*h*bend/d,y:root.y+dy*a/d-dx*h*bend/d};}
// 在低分辨率画布上栅格化带粗细变化的骨段，保持像素边缘清晰。
function bone(g,a,b,ra,rb,color){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;g.fillStyle=color;const pad=Math.max(ra,rb)+1;for(let y=Math.floor(Math.min(a.y,b.y)-pad);y<=Math.ceil(Math.max(a.y,b.y)+pad);y++)for(let x=Math.floor(Math.min(a.x,b.x)-pad);x<=Math.ceil(Math.max(a.x,b.x)+pad);x++){const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/l)),r=ra+(rb-ra)*t;if((x-a.x-dx*t)**2+(y-a.y-dy*t)**2<=r*r)g.fillRect(x,y,1,1);}}
function legs(g,phase,bob,far){const dark=far;for(const hind of [true,false]){const phaseOffset=(hind===far?0:.5),hipX=(hind?43:80)+(far?-3:0),hipY=(hind?88:86)+bob-(far?1:0);const f=foot(hipX,phase+phaseOffset,far),root={x:hipX,y:hipY},first={x:hipX+(hind?6:-3),y:hipY+6};const knee=joint(first,f,12,16,hind?-1:1);const segments=[[root,first,hind?5.2:4.1,3.5],[first,knee,3.8,2.7],[knee,f,2.6,1.9]];for(const [a,b,ra,rb]of segments)bone(g,a,b,ra+1,rb+1,'#201a26');for(let i=0;i<segments.length;i++){const [a,b,ra,rb]=segments[i];bone(g,a,b,ra,rb,dark?(i===2?'#362831':'#61392f'):(i===0?'#bc5738':i===1?'#ad5034':'#8a4432'));}if(!dark){for(let i=0;i<2;i++){const [a,b]=segments[i];bone(g,{x:a.x+1,y:a.y},{x:b.x+1,y:b.y},1.1,.7,i===0?'#d46b43':'#c15d3c');}}g.fillStyle=dark?'#211d28':'#29232e';g.fillRect(Math.round(f.x-3),Math.round(f.y-3),7,4);g.fillStyle=dark?'#382b34':'#49404a';g.fillRect(Math.round(f.x-2),Math.round(f.y-3),5,1);if(el('contacts').checked){g.fillStyle=f.contact?'#caff8b':'#7bd7ff';g.fillRect(Math.round(f.x-2),Math.round(f.y+2),5,1);}}}
const scene=document.createElement('canvas');scene.width=160;scene.height=140;const sg=scene.getContext('2d');
function render(kind,phase){const g=sg;g.clearRect(0,0,160,140);g.fillStyle='#5a8237';g.fillRect(0,0,160,140);const offset=el('ground').checked?period*phase:0;g.fillStyle='#789b4a';for(let y=6;y<140;y+=20)for(let x=-40;x<200;x+=40){const px=((x-offset+(y%40?13:0))%200+200)%200-20;g.fillRect(Math.round(px),y,2,1);g.fillRect(Math.round(px+16),y+9,1,2);}g.fillStyle='#385029';g.fillRect(48,128,64,3);g.save();g.translate(16,kind==='new'?13:0);if(kind==='new'){const bob=Math.round((1-Math.cos(phase*4*Math.PI))*.5);legs(g,phase,bob,true);legs(g,phase,bob,false);g.drawImage(body,Math.round((128-body.naturalWidth)/2),4+bob);}else{g.drawImage(old[Math.floor(phase*4)%4],0,0,96,96,0,0,128,128);}g.restore();const ctx=el(kind==='new'?'next':'old').getContext('2d');ctx.imageSmoothingEnabled=false;ctx.save();if(el('direction').value==='-1'){ctx.translate(480,0);ctx.scale(-1,1);}ctx.drawImage(scene,0,0,480,420);ctx.restore();}
function draw(){if(!loaded)return;const phase=index/8;render('old',phase);render('new',phase);el('frame').textContent='第 '+(index+1)+' / 8 帧';}
el('play').onclick=()=>{playing=!playing;el('play').textContent=playing?'暂停':'播放';};el('step').onclick=()=>{playing=false;el('play').textContent='播放';index=(index+1)%8;draw();};el('direction').onchange=el('ground').onchange=el('contacts').onchange=draw;el('speed').oninput=()=>{el('fps').textContent=el('speed').value+' 帧/秒';elapsed=0;};
window.__preview={setFrame(i){index=((i%8)+8)%8;playing=false;el('play').textContent='播放';draw();},foot,get loaded(){return loaded;},get frame(){return index;}};
function tick(now){if(loaded&&playing){elapsed+=Math.min(100,now-last);const duration=1000/Number(el('speed').value);while(elapsed>=duration){elapsed-=duration;index=(index+1)%8;draw();}}last=now;requestAnimationFrame(tick);}
Promise.all([body,...old].map(image=>new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;}))).then(()=>{loaded=true;draw();requestAnimationFrame(tick);}).catch(e=>{console.error(e);el('frame').textContent='加载失败';});
</script></html>`);
console.log(JSON.stringify({ bodyBox: { x0, y0, width, height }, bodySize: [bw, bh], out }));
