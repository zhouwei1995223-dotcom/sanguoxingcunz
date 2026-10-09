// 云函数 notify：定时检查到期的提醒，给玩家发送订阅消息（体力回满 / 巡营满仓）
// 部署：微信开发者工具中右键 cloudfunctions/notify → 「上传并部署：云端安装依赖」，
// 再右键 → 「上传触发器」，触发器配置见同目录 config.json（每 10 分钟执行一次）。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 订阅消息模板的字段名要和你在公众平台选用的模板一致，按需修改
function buildData(kind) {
  const now = new Date();
  const time = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (kind === 'stamina') {
    return { thing1: { value: '体力已回满' }, thing2: { value: '赵云已整装待发，快来征战吧！' }, time3: { value: time } };
  }
  return { thing1: { value: '巡营收益已满仓' }, thing2: { value: '将士们屯田归来，快来领取！' }, time3: { value: time } };
}

exports.main = async () => {
  const now = Date.now();
  const res = await db.collection('reminders').where({ sent: false, at: _.lte(now) }).limit(100).get();
  let sent = 0;
  for (const r of res.data) {
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: r._openid,
        templateId: r.tmpl,
        page: '',
        data: buildData(r.kind),
        miniprogramState: 'formal',
      });
      sent++;
    } catch (e) {
      // 用户未授权或已用完次数时会失败，直接标记跳过
    }
    await db.collection('reminders').doc(r._id).update({ data: { sent: true } });
  }
  return { checked: res.data.length, sent };
};
