// 从最终 MP4 截取原尺寸整帧。node tools/video/vertical-covers.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = 'docs/promo/竖版视频';
for (const [name, second] of [['1_一骑当千', 14.9], ['2_名将大招', 7.05], ['3_敌将对决', 0.95]]) {
  const source = path.join(dir, `竖版视频${name}_1080x1920.mp4`);
  const target = path.join(dir, `竖版视频封面${name}_1080x1920.jpg`);
  for (let quality = 2; quality <= 31; quality++) {
    const jpg = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(second), '-i', source,
      '-map', '0:v:0', '-frames:v', '1', '-c:v', 'mjpeg', '-q:v', String(quality),
      '-f', 'image2pipe', 'pipe:1'], {maxBuffer: 8 * 1024 * 1024});
    if (!jpg.length) throw new Error('找不到视频帧：' + source);
    if (jpg.length <= 500000) {
      writeFileSync(target, jpg);
      break;
    }
    if (quality === 31) throw new Error('封面超过 500 KB：' + target);
  }
}
