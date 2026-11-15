// 从游戏美术生成小红书商店封面。NODE_PATH 可指向已安装的 Playwright。
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const assets = await build({
  stdin: { contents: `
    import { drawGameTitle, paintSplash } from './src/scenes/homeArt';
    import { buildAtlas, sprite, hasSprite } from './src/gfx/atlas';
    window.coverArt = { drawGameTitle, paintSplash, buildAtlas, sprite, hasSprite };
  `, resolveDir: process.cwd() },
  bundle: true, write: false, define: { 'process.env.TARGET': '"web"' },
});
const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || undefined});
try {
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.addScriptTag({content: assets.outputFiles[0].text});
  const jpg = await page.evaluate(() => {
    const art = window.coverArt;
    art.buildAtlas();
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1440;
    const g = c.getContext('2d');
    let seed = 239;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    function stamp(name, x, bottom, k, alpha = 1) {
      if (!art.hasSprite(name)) throw Error(name);
      const s = art.sprite(name);
      g.globalAlpha = alpha; g.imageSmoothingEnabled = false;
      g.drawImage(s.canvas, s.x, s.y, s.w, s.h, Math.round(x-s.w*k/2), Math.round(bottom-s.h*k), s.w*k, s.h*k);
      g.globalAlpha = 1;
    }
    function polygon(points, color) {
      g.fillStyle = color; g.beginPath();
      points.forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y));
      g.closePath(); g.fill();
    }
    art.paintSplash(g, c.width, c.height, 2.15);
    // 旗影和远处的军阵随地势起伏，留出中间的马道。
    for (let i = 0; i < 26; i++) {
      const x = i*48 - 65 + random()*32;
      const y = 1050 + 36*Math.sin(x/193) + random()*13;
      if (x > 260 && x < 748) continue;
      const h = 40 + random()*40;
      g.fillStyle = '#57665b'; g.fillRect(x,y-h,3,h);
      polygon([[x,y-h],[x+29,y-h+3],[x+18,y-h+11],[x+26,y-h+18],[x,y-h+15]],'#9e6953');
    }
    const crest = x => 1184 - .24*x + 19*Math.sin(x/114) + 6*Math.sin(x/41);
    const ridge = [];
    for(let x=-5;x<=1090;x+=5) ridge.push([x,crest(x)]);
    polygon([...ridge,[1090,1440],[-5,1440]],'#465a4d');
    for(let i=0;i<5500;i++) {
      const x=random()*1080,y=crest(x)+random()*450;
      g.fillStyle = i%4 ? 'rgba(205,191,147,.15)' : 'rgba(25,39,36,.28)';
      g.fillRect(x,y,1+random()*7,1+random()*2);
    }
    const px=534, foot=crest(px)+11;
    g.fillStyle='rgba(25,34,30,.28)';g.beginPath();g.ellipse(px,foot-5,157,16,-.07,0,Math.PI*2);g.fill();
    stamp('hero_zhaoyun_2',px,foot,15);
    // 近景看向赵云的曹军。由远到近绘制，与主角保持尺寸和色彩层次。
    const army = [];
    for(let row=0;row<3;row++)for(let i=0;i<9;i++) {
      const x=i*143-28+random()*62, y=1264+row*115-.12*x+random()*43;
      if(row===0 && x>215 && x<705)continue;
      army.push({x,y,k:4+row*2, name:'u_wei_'+(['spear','shield','archer'][(row+i)%3])+'_'+(i%4)+(x>px?'_L':'')});
    }
    army.sort((a,b)=>a.y-b.y).forEach(a=>stamp(a.name,a.x,a.y,a.k,.90));
    // 近处旗角斜入画面，把视线引向坡顶，避开主角轮廓。
    polygon([[74,1440],[30,1062],[36,1054],[84,1440]],'#303b32');
    polygon([[35,1069],[91,1076],[156,1059],[202,1063],[169,1081],[183,1081],
      [132,1101],[151,1097],[123,1116],[80,1123],[44,1113]],'#94483d');
    polygon([[40,1078],[87,1086],[153,1067],[105,1092],[55,1097]],'#ac6250');
    for(let i=0;i<7;i++){
      const x=173+i*30,y=506-19*Math.sin(i*.55)+random()*18,k=3+i*.52;
      polygon([[x-k*1.8,y-k],[x,y-1],[x+k*1.5,y-k*.68],[x,y+2]],'#778779');
    }
    for(let i=0;i<67000;i++){
      g.fillStyle=i%2?'rgba(93,72,41,.058)':'rgba(255,247,208,.085)';
      g.fillRect(random()*1080,random()*1440,random()<.04?4:1.5,1.3);
    }
    art.drawGameTitle(g,1080,236,2.02);
    return c.toDataURL('image/jpeg',.94).split(',')[1];
  });
  fs.writeFileSync('docs/promo/1.1.0/小红书封面-单骑闯阵.jpg',Buffer.from(jpg,'base64'));
} finally { await browser.close(); }
