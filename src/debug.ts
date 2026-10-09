// 调试参数（仅浏览器生效）：?speed=4 战斗加速；?rich=1 资源充足；?ch=3 解锁到第3章；?skip=1 跳过新手引导；?heroes=1 解锁全部武将
declare const location: any;

function param(name: string): string | null {
  try {
    if (typeof location === 'undefined' || !location.search) return null;
    const m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  } catch (e) {
    return null;
  }
}

export const DEBUG = {
  speed: Number(param('speed') || 1),
  rich: param('rich') === '1',
  chapter: Number(param('ch') || 0),
  skipGuide: param('skip') === '1',
  reset: param('reset') === '1',
  fps: param('fps') === '1',
  allHeroes: param('heroes') === '1',
};
