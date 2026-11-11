# 竖版推广视频（2026-11-09）：三条 1080×1920 MP4（20~30 秒，H.264 + AAC 配乐）+ 三张封面（1080×1920 JPG < 500KB）。
# 按投放要求：视频只有实机画面（含真实战斗界面和滑动摇杆操作），不加文字、不加特效；封面直接从对应成片截取整帧。
# 用法：npm run build && node tools/video/record6.mjs && python3 tools/video/compose6.py
# 封面由 vertical-covers 从最终 MP4 抽帧。
import json, os, shutil, subprocess, sys
D = 'dist/video6/'
OUT = 'docs/promo/竖版视频/'
os.makedirs(OUT, exist_ok=True)
W, H = 1080, 1920

def covers():
    subprocess.run(['node', 'tools/video/vertical-covers.mjs'], check=True)

if os.environ.get('COVER_ONLY'):
    covers()
    sys.exit(0)
meta = json.load(open(D + 'segments.json'))
FPS = meta['fps']
SEG = {s['name']: s for s in meta['segments']}
A = 'assets/audio/'
# （文件名，配乐，片段，音效 [（名称，秒）]）
VIDEOS = [
    ('1_一骑当千', 'bgm_battle', ['v1_crowd', 'v1_ult', 'v1_crowd2', 'v1_ult2'],
     [('sfx_horse', 0.2), ('sfx_thrust', 9.2), ('sfx_explode', 9.3), ('sfx_explode', 11.0), ('sfx_thrust', 19.3), ('sfx_explode', 19.4), ('sfx_explode', 21.0)]),
    ('2_名将大招', 'bgm_battle', ['v2_guanyu', 'v2_lvbu', 'v2_sunshangxiang', 'v2_zhuge'],
     [('sfx_horse', 0.3), ('sfx_explode', 0.8), ('sfx_explode', 6.8), ('sfx_shoot', 12.7), ('sfx_shoot', 13.2), ('sfx_explode', 18.8), ('sfx_explode', 19.6)]),
    ('3_敌将对决', 'bgm_boss', ['v3_cross', 'v3_rain', 'v3_shield', 'v3_kill'],
     [('sfx_boss', 0.1), ('sfx_explode', 1.3), ('sfx_explode', 4.4), ('sfx_explode', 7.4), ('sfx_explode', 10.4), ('sfx_boss', 12.1), ('sfx_explode', 15.0), ('sfx_victory', 19.5)]),
]
# 第二版视频带真实界面和摇杆：整帧 1080×1920 原样输出，不再裁切放大（否则界面边缘被裁掉）
CW, CH = W, H
def frame_path(seg, i): return D + 'frames/%05d.jpg' % (SEG[seg]['start'] + i)

for vname, bgm, segs, cues in VIDEOS:
    out = D + 'out_' + vname + '/'
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    n = 0; kills = []
    for seg in segs:
        t0 = n / FPS
        for i in range(SEG[seg]['end'] - SEG[seg]['start']):
            os.link(frame_path(seg, i), out + '%05d.jpg' % n); n += 1
        kills += [t0 + 0.3 + j * 0.3 for j in range(int((n / FPS - t0 - 0.5) / 0.3))]
    total = n / FPS
    inputs = ['-i', A + bgm + '.mp3']
    filt = [f'[0:a]aloop=loop=-1:size=2e9,atrim=0:{total},afade=t=in:d=0.3,afade=t=out:st={total - 1.2}:d=1.2,volume=0.85[bgm]']
    labels = ['[bgm]']
    allc = cues + ([('sfx_kill', x) for x in kills] if not vname.startswith('3') else [])
    for j, (s, tt) in enumerate(allc, 1):
        inputs += ['-i', A + s + '.mp3']
        filt.append(f'[{j}:a]adelay={int(tt * 1000)}|{int(tt * 1000)},volume={0.28 if s == "sfx_kill" else 0.9}[s{j}]')
        labels.append(f'[s{j}]')
    filt.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0,atrim=0:{total}[a]')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filt), '-map', '[a]', '-ac', '2', '-ar', '44100', out + 'audio.m4a'], check=True)
    dst = OUT + f'竖版视频{vname}_1080x1920.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', out + '%05d.jpg', '-i', out + 'audio.m4a',
                    '-vf', f'crop={CW}:{CH},scale={W}:{H}:flags=neighbor', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
                    '-crf', '19', '-maxrate', '10M', '-bufsize', '16M', '-preset', 'slow',
                    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', dst], check=True)
    if os.environ.get('VIDEO_ONLY'): print(vname, round(total, 1), 's', os.path.getsize(dst) // 1024 // 1024, 'MB'); continue
if not os.environ.get('VIDEO_ONLY'):
    covers()
