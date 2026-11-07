// 调试参数（仅浏览器生效）：?speed=4 战斗加速；?rich=1 资源充足；?ch=3 解锁到第3章；?skip=1 跳过新手引导；?heroes=1 解锁全部武将
declare const location: any;
import { IS_WEB } from './data/platformConfig';

function param(name: string): string | null {
  try {
    if (typeof location === 'undefined' || !location.search) return null;
    // 小红书正式包：调试参数只在本机测试时生效
    if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return null;
    const m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  } catch (e) {
    return null;
  }
}

export const DEBUG = {
  webPlaytest: IS_WEB && param('playtest') !== '0',
  speed: Number(param('speed') || 1),
  rich: param('rich') === '1',
  tower: IS_WEB ? Number(param('tower') || 0) : 0,
  chapter: Number(param('ch') || 0),
  skipGuide: param('skip') === '1',
  reset: param('reset') === '1',
  fps: param('fps') === '1',
  allHeroes: param('heroes') === '1',
  /** 预览新造型：?art=v2（只用于浏览器验收，正式包不受影响） */
  artV2: param('art') === 'v2',
  /** 录宣传视频：?nohud=1 不画战斗界面（血条、按钮、摇杆等），只留游戏世界 */
  noHud: param('nohud') === '1',
};
