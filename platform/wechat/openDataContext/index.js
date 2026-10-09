// 微信开放数据域：绘制好友排行榜（只能在这里读取好友数据）
const sharedCanvas = wx.getSharedCanvas();
const ctx = sharedCanvas.getContext('2d');

function fmtScore(score) {
  const ch = Math.floor(score / 10000), sec = score % 10000;
  const mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
  if (ch >= 5) return '全部通关';
  return (ch >= 1 ? '通关第' + ch + '章 ' : '') + '第' + (ch + 1) + '章 ' + mm + ':' + ss;
}

function draw(list, w, h) {
  ctx.clearRect(0, 0, sharedCanvas.width, sharedCanvas.height);
  const rowH = Math.round(h / 7);
  if (!list.length) {
    ctx.fillStyle = '#fff4d6';
    ctx.font = Math.round(rowH * 0.3) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无好友数据，快邀请好友一起征战吧', w / 2, h / 2);
    return;
  }
  list.slice(0, 50).forEach((item, i) => {
    const y = i * rowH;
    if (y > h) return;
    ctx.fillStyle = i % 2 ? '#3a2c2a' : '#4a3630';
    ctx.fillRect(0, y, w, rowH - 4);
    ctx.fillStyle = i < 3 ? ['#feae34', '#c0cbdc', '#d77643'][i] : '#fff4d6';
    ctx.font = 'bold ' + Math.round(rowH * 0.36) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), rowH * 0.5, y + rowH / 2);
    const img = wx.createImage();
    img.onload = () => ctx.drawImage(img, rowH * 1.0, y + rowH * 0.15, rowH * 0.66, rowH * 0.66);
    img.src = item.avatarUrl;
    ctx.fillStyle = '#fff4d6';
    ctx.textAlign = 'left';
    ctx.font = Math.round(rowH * 0.3) + 'px sans-serif';
    ctx.fillText(item.nickname.slice(0, 8), rowH * 1.9, y + rowH / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fee761';
    ctx.fillText(fmtScore(item.score), w - 20, y + rowH / 2);
  });
}

wx.onMessage((msg) => {
  if (!msg || msg.type !== 'rank') return;
  const w = msg.width || sharedCanvas.width, h = msg.height || sharedCanvas.height;
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
