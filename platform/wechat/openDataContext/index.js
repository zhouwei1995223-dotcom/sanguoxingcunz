// 微信开放数据域：绘制好友排行榜（只能在这里读取好友数据）
const sharedCanvas = wx.getSharedCanvas();
const ctx = sharedCanvas.getContext('2d');

const DIFF = ['普通', '困难', '噩梦'];
let currentKey = 'score';
function mmss(sec) {
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}
function fmtScore(score) {
  if (currentKey === 'endless') return '无尽坚持' + mmss(score);
  const idx = Math.floor(score / 10000), sec = score % 10000;
  const d = Math.min(2, Math.floor(idx / 10)), ch = idx % 10;
  if (idx >= 30) return '噩梦全部通关';
  // 例：普通 · 通关2章 · 第3章坚守10:00；还没通关时只显示第1章坚守时间
  const pre = d ? DIFF[d] + '·' : '';
  if (!ch) return pre + '第1章坚守' + mmss(sec);
  return pre + '通关' + ch + '章' + (sec ? ' · 第' + (ch + 1) + '章' + mmss(sec) : '');
}

/** 按宽度截断文字（昵称太长时加省略号） */
function fit(text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

function draw(list, w, h) {
  ctx.clearRect(0, 0, sharedCanvas.width, sharedCanvas.height);
  const rowH = Math.round(h / 7);
  if (!list.length) {
    ctx.fillStyle = '#fff4d6';
    ctx.font = Math.round(rowH * 0.24) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无好友数据，快邀请好友一起征战吧', w / 2, h / 2);
    return;
  }
  // 每行：名次 | 头像 | 昵称（上）+ 成绩（下），两行排开，字号按行高缩放，不会互相重叠
  list.slice(0, 50).forEach((item, i) => {
    const y = i * rowH;
    if (y > h) return;
    ctx.fillStyle = i % 2 ? '#3a2c2a' : '#4a3630';
    ctx.fillRect(0, y, w, rowH - 4);
    ctx.fillStyle = i < 3 ? ['#feae34', '#c0cbdc', '#d77643'][i] : '#fff4d6';
    ctx.font = 'bold ' + Math.round(rowH * 0.32) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), rowH * 0.35, y + rowH / 2);
    const av = rowH * 0.56, ax = rowH * 0.68;
    const img = wx.createImage();
    img.onload = () => ctx.drawImage(img, ax, y + (rowH - av) / 2 - 2, av, av);
    img.src = item.avatarUrl;
    const tx = ax + av + rowH * 0.16, tw = w - tx - rowH * 0.12;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff4d6';
    ctx.font = Math.round(rowH * 0.2) + 'px sans-serif';
    ctx.fillText(fit(item.nickname, tw), tx, y + rowH * 0.32);
    ctx.fillStyle = '#fee761';
    ctx.font = Math.round(rowH * 0.17) + 'px sans-serif';
    ctx.fillText(fit(fmtScore(item.score), tw), tx, y + rowH * 0.66);
  });
}

wx.onMessage((msg) => {
  if (!msg || msg.type !== 'rank') return;
  const w = msg.width || sharedCanvas.width, h = msg.height || sharedCanvas.height;
  currentKey = msg.key || 'score';
  wx.getFriendCloudStorage({
    keyList: [msg.key || 'score'],
    success: (res) => {
      const list = (res.data || []).map((d) => {
        let score = 0;
        try { const kv = (d.KVDataList || [])[0]; score = JSON.parse(kv.value).wxgame.score || 0; } catch (e) {}
        return { nickname: d.nickname || '好友', avatarUrl: d.avatarUrl, score };
      }).sort((a, b) => b.score - a.score);
      draw(list, w, h);
    },
    fail: () => draw([], w, h),
  });
});
