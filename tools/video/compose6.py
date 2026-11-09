# 竖版推广视频（2026-11-09）：三条 1080×1920 MP4（20~30 秒，H.264 + AAC 配乐）+ 三张封面（1080×1920 JPG < 500KB）。
# 按投放要求：视频只有实机画面（含真实战斗界面和滑动摇杆操作），不加文字、不加特效；封面 = 实机画面 + 名将步战造型 + 游戏名 logo。
# 用法：npm run build && node tools/video/record6.mjs && python3 tools/video/compose6.py <思源宋体 NotoSerifCJK-Black.ttc>
#（封面的名将像素图来自 tools/shots/promo2.mjs 导出的 dist/promo2/sprites/）
import json, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
FONT = sys.argv[1]
D = 'dist/video6/'
SP = 'dist/promo2/sprites/'
OUT = 'docs/promo/竖版视频/'
os.makedirs(OUT, exist_ok=True)
W, H = 1080, 1920
def serif(sz): return ImageFont.truetype(FONT, sz, index=2)
GOLD, CREAM, INK, CINNABAR = (255, 214, 102), (255, 246, 228), (38, 28, 22), (178, 34, 38)
meta = json.load(open(D + 'segments.json'))
FPS = meta['fps']
SEG = {s['name']: s for s in meta['segments']}
A = 'assets/audio/'
# （文件名，配乐，片段，封面帧，封面名将，封面小字，音效 [（名称，秒）]）
VIDEOS = [
    ('1_一骑当千', 'bgm_battle', ['v1_crowd', 'v1_ult', 'v1_crowd2', 'v1_ult2'], ('v1_crowd', 40), 'zhaoyun_4', '万军丛中 · 一骑当千',
     [('sfx_horse', 0.2), ('sfx_thrust', 9.2), ('sfx_explode', 9.3), ('sfx_explode', 11.0), ('sfx_thrust', 19.3), ('sfx_explode', 19.4), ('sfx_explode', 21.0)]),
    ('2_名将大招', 'bgm_battle', ['v2_guanyu', 'v2_lvbu', 'v2_sunshangxiang', 'v2_zhuge'], ('v2_lvbu', 45), 'lvbu_4', '十大名将 · 五星觉醒',
     [('sfx_horse', 0.3), ('sfx_explode', 0.8), ('sfx_explode', 6.8), ('sfx_shoot', 12.7), ('sfx_shoot', 13.2), ('sfx_explode', 18.8), ('sfx_explode', 19.6)]),
    ('3_敌将对决', 'bgm_boss', ['v3_cross', 'v3_rain', 'v3_shield', 'v3_kill'], ('v3_cross', 100), 'machao_4', '名将拦路 · 单骑斩将',
     [('sfx_boss', 0.1), ('sfx_explode', 1.3), ('sfx_explode', 4.4), ('sfx_explode', 7.4), ('sfx_explode', 10.4), ('sfx_boss', 12.1), ('sfx_explode', 15.0), ('sfx_victory', 19.5)]),
]
# 第二版视频带真实界面和摇杆：整帧 1080×1920 原样输出，不再裁切放大（否则界面边缘被裁掉）
CW, CH = W, H
def frame_path(seg, i): return D + 'frames/%05d.jpg' % (SEG[seg]['start'] + i)

def cover(seg, idx, hero, sub):
    im = Image.open(frame_path(seg, idx)).convert('RGB').crop(((W - CW) // 2, (H - CH) // 2, (W + CW) // 2, (H + CH) // 2)).resize((W, H), Image.NEAREST)
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for y in range(620):    # 顶部压暗放标题
        d.line([0, y, W, y], fill=(18, 10, 12, int(200 * (1 - y / 620) ** 1.2)))
    for y in range(700):    # 底部压暗衬名将
        d.line([0, H - y, W, H - y], fill=(18, 10, 12, int(170 * (1 - y / 700) ** 1.4)))
    im = im.convert('RGBA'); im.alpha_composite(ov)
    # 名将步战造型（游戏内美术，最近邻放大），不描光边，只在脚下压一片影子
    k = 18
    sp = Image.open(SP + hero + '.png').convert('RGBA')
    sp = sp.resize((sp.width * k, sp.height * k), Image.NEAREST)
    x = (W - sp.width) // 2; y = H - sp.height - 70
    sh = Image.new('L', (W, H), 0)
    ImageDraw.Draw(sh).ellipse([x + sp.width * 0.08, y + sp.height - 46, x + sp.width * 0.92, y + sp.height + 40], fill=150)
    im.paste(Image.new('RGBA', (W, H), (12, 8, 6, 255)), (0, 0), sh.filter(ImageFilter.GaussianBlur(18)))
    im.alpha_composite(sp, (x, y))
    d = ImageDraw.Draw(im)
    d.text((W / 2, 250), '长坂单骑传', font=serif(176), fill=GOLD, anchor='mm', stroke_width=10, stroke_fill=(70, 16, 18))
    # 朱红飞白横线 + 小字
    for i in range(560):
        t = i / 560; w = 14 * max(0, 1 - abs(t - 0.5) * 2) ** 0.5
        if (i * 7919) % 19: d.line([W / 2 - 280 + i, 382 - w / 2, W / 2 - 280 + i, 382 + w / 2], fill=CINNABAR)
    d.text((W / 2, 466), sub, font=serif(72), fill=CREAM, anchor='mm', stroke_width=6, stroke_fill=INK)
    # 「单骑」朱印
    s = 110; sx, sy = 60, 560
    d.rounded_rectangle([sx, sy, sx + s, sy + s], radius=12, fill=CINNABAR)
    f = serif(40)
    d.text((sx + s / 2, sy + s * 0.3), '单', font=f, fill=CREAM, anchor='mm'); d.text((sx + s / 2, sy + s * 0.7), '骑', font=f, fill=CREAM, anchor='mm')
    return im.convert('RGB')

def save_jpeg(im, path, kb):
    for q in (92, 88, 85, 82, 78, 74, 70, 66, 62, 58):
        im.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(path) < kb * 1024: break
    return q, os.path.getsize(path) // 1024

for vname, bgm, segs, (cseg, cidx), hero, sub, cues in VIDEOS:
    if os.environ.get('COVER_ONLY'):
        print(vname, save_jpeg(cover(cseg, cidx, hero, sub), OUT + f'竖版视频封面{vname}_1080x1920.jpg', 495)); continue
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
    q, kb = save_jpeg(cover(cseg, cidx, hero, sub), OUT + f'竖版视频封面{vname}_1080x1920.jpg', 495)
    print(vname, round(total, 1), 's', os.path.getsize(dst) // 1024 // 1024, 'MB；封面', kb, 'KB q', q)
