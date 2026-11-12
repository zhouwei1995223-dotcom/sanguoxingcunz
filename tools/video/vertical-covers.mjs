// 从最终 MP4 的战斗区取景，使用首页原字标（含「单骑」朱印）。
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = 'docs/promo/竖版视频';
const frames = [
  // 原片秒数、9:16 裁框（左、上、宽）、角色脚下血条的纵坐标。
  ['1_一骑当千', 0.20, 264, 440, 504, 1004],
  ['2_名将大招', 7.78, 382, 754, 342, 1004],
  ['3_敌将对决', 2.94, 382, 518, 432, 1004],
];
for (const [name, second, x, y, width, barY] of frames) {
  const source = path.join(dir, `竖版视频${name}_1080x1920.mp4`);
  const target = path.join(dir, `竖版视频封面${name}_1080x1920.jpg`);
  for (let quality = 2; quality <= 31; quality++) {
    const filter = `[0:v]delogo=x=490:y=${barY-2}:w=100:h=20,crop=${width}:${width*16/9}:${x}:${y},scale=1080:1920:flags=neighbor,setsar=1[scene];[scene][1:v]overlay=0:1560[out]`;
    const jpg = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(second), '-i', source,
      '-i', 'tools/video/game-wordmark.png', '-filter_complex', filter, '-map', '[out]',
      '-frames:v', '1', '-c:v', 'mjpeg', '-q:v', String(quality),
      '-f', 'image2pipe', 'pipe:1'], {maxBuffer: 8 * 1024 * 1024});
    if (!jpg.length) throw new Error('找不到视频帧：' + source);
    if (jpg.length <= 500000) {
      writeFileSync(target, jpg);
      break;
    }
    if (quality === 31) throw new Error('封面超过 500 KB：' + target);
  }
}
