// node tools/zhaoyun-reference-preview.mjs [输出目录]
// 按用户认可的生成图制作图片帧预览；不压回 32×32，不接入正式图集。
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] || 'dist/zhaoyun-reference');
fs.mkdirSync(out, { recursive: true });
const png = (file) => 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
const source = png('docs/art/zhaoyun-approved-reference.png');
const sheet = png('docs/art/zhaoyun-trot-sheet.png');

fs.writeFileSync(path.join(out, '赵云动画预览-v2.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>赵云 · 原画造型动画</title>
<style>*{box-sizing:border-box}body{margin:0;padding:26px 16px 36px;background:#171b22;color:#f3ead8;font:15px "Microsoft YaHei",sans-serif;text-align:center}h1{font-size:25px;margin:0 0 10px}p{color:#b8c0c6;font-size:13px;line-height:1.7}.cards{max-width:1020px;margin:23px auto 16px;display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{border:1px solid #4f5d46;border-radius:12px;overflow:hidden;background:#26352a}h2{font-size:17px;margin:16px 0 12px}canvas{display:block;width:100%;height:auto;image-rendering:pixelated}.controls{max-width:1020px;margin:auto;background:#242b35;padding:16px;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}button,select{font:inherit;padding:8px 13px;border:1px solid #789b62;border-radius:6px;background:#34432d;color:#fff3d5;cursor:pointer}label{display:flex;align-items:center;gap:8px;font-size:13px}input{width:115px;accent-color:#a6ca76}.note{margin:12px auto;max-width:780px}@media(max-width:600px){.cards{grid-template-columns:1fr}h1{font-size:21px}}</style>
<h1>赵云 · 按原画造型制作动画</h1><p>保留银蓝头盔、宽披风、棕色马鞍与白马比例</p>
<div class="cards"><section class="card"><h2>你认可的原画</h2><canvas id="reference" width="480" height="390"></canvas></section><section class="card"><h2>四帧动画 · 修订版</h2><canvas id="animated" width="480" height="390"></canvas></section></div>
<div class="controls"><button id="play">暂停</button><button id="step">逐帧</button><select id="direction" aria-label="朝向"><option value="1">朝右</option><option value="-1">朝左</option></select><label>速度<input id="speed" type="range" min="4" max="12" value="8"><span id="fps">8 帧/秒</span></label><label>显示大小<input id="size" type="range" min="100" max="310" value="290"></label></div>
<p id="frame">正在加载…</p><p class="note">此预览直接播放图片帧。生成帧仍有少量轮廓差异，正式使用前需要继续校准；当前尚未替换游戏角色。</p>
<script>
const el=id=>document.getElementById(id);const images=[new Image(),new Image()];
let boxes=[],index=0,playing=true,elapsed=0,last=performance.now(),loaded=false;
images[0].src=${JSON.stringify(source)};images[1].src=${JSON.stringify(sheet)};
const ready=images.map(img=>new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;}));
function bounds(img,i){const w=img.naturalWidth/2,h=img.naturalHeight/2,ox=(i%2)*w,oy=Math.floor(i/2)*h;const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.drawImage(img,ox,oy,w,h,0,0,w,h);const d=g.getImageData(0,0,w,h).data;let x0=w,y0=h,x1=0,y1=0,n=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>96){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);n++;}if(!n)throw Error('图片帧为空');return{x:ox+x0,y:oy+y0,w:x1-x0+1,h:y1-y0+1};}
function backdrop(g){g.fillStyle='#5a8237';g.fillRect(0,0,480,390);g.fillStyle='#789b4a';for(let i=0;i<70;i++)g.fillRect((i*73+17)%480,(i*47+11)%390,2,3);g.fillStyle='#385029';g.beginPath();g.ellipse(240,342,105,10,0,0,Math.PI*2);g.fill();}
function draw(){if(!loaded)return;const height=Number(el('size').value),maxH=Math.max(...boxes.map(b=>b.h));for(const id of ['reference','animated']){const g=el(id).getContext('2d');g.imageSmoothingEnabled=false;backdrop(g);g.save();if(el('direction').value==='-1'){g.translate(480,0);g.scale(-1,1);}if(id==='reference'){const box={x:1104,y:197,w:470,h:426},s=height/box.h;g.drawImage(images[0],box.x,box.y,box.w,box.h,Math.round(240-box.w*s/2),Math.round(341-box.h*s),Math.round(box.w*s),Math.round(box.h*s));}else{const b=boxes[index],s=height/maxH;g.drawImage(images[1],b.x,b.y,b.w,b.h,Math.round(240-b.w*s/2),Math.round(341-b.h*s),Math.round(b.w*s),Math.round(b.h*s));}g.restore();}el('frame').textContent='第 '+(index+1)+' / 4 帧';}
el('play').onclick=()=>{playing=!playing;el('play').textContent=playing?'暂停':'播放';};el('step').onclick=()=>{playing=false;el('play').textContent='播放';index=(index+1)%4;draw();};el('direction').onchange=draw;el('size').oninput=draw;el('speed').oninput=()=>{el('fps').textContent=el('speed').value+' 帧/秒';elapsed=0;};
function tick(now){if(loaded&&playing){elapsed+=Math.min(100,now-last);const d=1000/Number(el('speed').value);while(elapsed>=d){index=(index+1)%4;elapsed-=d;draw();}}last=now;requestAnimationFrame(tick);}
window.__preview={setFrame(i){index=i%4;playing=false;el('play').textContent='播放';draw();},get boxes(){return boxes;},get loaded(){return loaded;}};
Promise.all(ready).then(()=>{boxes=[0,1,2,3].map(i=>bounds(images[1],i));loaded=true;draw();requestAnimationFrame(tick);}).catch(e=>{el('frame').textContent='加载失败';console.error(e);});
</script></html>`);
console.log('图片帧动画预览已生成：', out);
