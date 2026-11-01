# 微信「小游戏运营素材」：三条横版视频（1280×720，15 秒，H.264 约 1.2Mbps + AAC，必须有配乐）+ 三张封面（1280×720 JPEG < 200KB）。
# 按审核要求：画面是铺满的实机画面，没有界面、弹窗、黑边、loading，不加片头 logo；只在下方加一行玩法说明。
# 封面：实机画面 + 游戏名 logo，不放按钮和界面，不加边框。
# 用法：npm run build && node tools/video/record4.mjs && python3 tools/video/compose4.py <标题字体.ttc>
import json, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
FONT = sys.argv[1]           # 思源宋体 Noto Serif CJK Black（SIL OFL，可商用）
D = 'dist/video4/'
OUT = 'docs/promo/运营素材/'
os.makedirs(OUT, exist_ok=True)
W, H = 1280, 720
def serif(sz): return ImageFont.truetype(FONT, sz, index=2)
GOLD, WHITE = (255, 214, 102), (255, 248, 232)
meta = json.load(open(D + 'segments.json'))
FPS = meta['fps']
SEG = {s['name']: s for s in meta['segments']}
A = 'assets/audio/'
# （文件名，配乐，[（片段，说明文字）]，封面帧（片段，第几帧），封面小字，推广文案）
VIDEOS = [
    ('1_一骑当千', 'bgm_battle', [('v1_crowd', '拖动走位 · 攻击全自动'), ('v1_ult', '攒满怒气 · 大招清屏'), ('v1_crowd2', '万军丛中 · 越砍越多')],
     ('v1_crowd', 120), '万军丛中 一骑当千', '单骑闯敌阵，满屏曹军一路砍',
     [('sfx_horse', 0.2), ('sfx_thrust', 7.3), ('sfx_explode', 7.4), ('sfx_explode', 9.5)]),
    ('2_名将大招', 'bgm_battle', [('v2_machao', '马超 · 西凉铁骑'), ('v2_sunshangxiang', '孙尚香 · 弓腰姬'), ('v2_huangzhong', '黄忠 · 定军斩将')],
     ('v2_sunshangxiang', 40), '十位名将 各有绝技', '马超孙尚香黄忠，名将大招清屏',
     [('sfx_horse', 0.6), ('sfx_shoot', 5.6), ('sfx_shoot', 6.2), ('sfx_shoot', 10.6), ('sfx_explode', 11.9)]),
    ('3_敌将对决', 'bgm_boss', [('v3_cross', '看准红圈 · 躲开技能'), ('v3_rain', '箭雨震地 · 走位闪避'), ('v3_shield', '十二秒内破盾'), ('v3_kill', '单骑斩将')],
     ('v3_cross', 32), '名将拦路 单骑斩将', '看准红圈躲技能，破盾斩敌将',
     [('sfx_boss', 0.1), ('sfx_explode', 1.1), ('sfx_explode', 5.2), ('sfx_explode', 6.0), ('sfx_boss', 8.1), ('sfx_explode', 10.0)]),
]
def frame(name, i):
    return Image.open(D + 'frames/%05d.jpg' % (SEG[name]['start'] + i)).convert('RGB')
def caption(im, text, k):
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    f = serif(44)
    tw = d.textlength(text, font=f)
    y = H - 74
    d.rounded_rectangle([W / 2 - tw / 2 - 36, y - 36, W / 2 + tw / 2 + 36, y + 36], radius=22, fill=(20, 10, 16, 165))
    d.text((W / 2, y), text, font=f, fill=GOLD, anchor='mm', stroke_width=3, stroke_fill=(40, 16, 10))
    if k < 1: ov.putalpha(ov.getchannel('A').point(lambda v: int(v * k)))
    im = im.convert('RGBA'); im.alpha_composite(ov)
    return im.convert('RGB')
def save_jpeg(im, path, limit_kb):
    for q in (90, 86, 82, 78, 74, 70, 66, 62, 58):
        im.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(path) < limit_kb * 1024: return os.path.getsize(path) // 1024
    return os.path.getsize(path) // 1024
for vname, bgm, scenes, (cseg, cidx), csub, promo, cues in VIDEOS:
    out = D + 'out_' + vname + '/'
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    n = 0; kills = []
    for seg, text in scenes:
        t0 = n / FPS
        s = SEG[seg]
        for i in range(s['end'] - s['start']):
            caption(frame(seg, i), text, min(1, (i + 1) / 8)).save(out + '%05d.jpg' % n, quality=92)
            n += 1
        kills += [t0 + 0.3 + j * 0.3 for j in range(int((n / FPS - t0 - 0.5) / 0.3))]
    total = n / FPS
    inputs = ['-i', A + bgm + '.mp3']
    filt = [f'[0:a]atrim=0:{total},afade=t=in:d=0.3,afade=t=out:st={total - 1}:d=1,volume=0.85[bgm]']
    labels = ['[bgm]']
    allc = cues + ([('sfx_kill', x) for x in kills] if not vname.startswith('3') else [])
    for j, (s, tt) in enumerate(allc, 1):
        inputs += ['-i', A + s + '.mp3']
        filt.append(f'[{j}:a]adelay={int(tt * 1000)}|{int(tt * 1000)},volume={0.28 if s == "sfx_kill" else 0.9}[s{j}]')
        labels.append(f'[s{j}]')
    filt.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0,atrim=0:{total}[a]')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filt), '-map', '[a]', '-ac', '2', '-ar', '44100', out + 'audio.m4a'], check=True)
    dst = OUT + f'运营素材视频{vname}_1280x720.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', out + '%05d.jpg', '-i', out + 'audio.m4a',
                    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', '1200k', '-maxrate', '1500k', '-bufsize', '2400k', '-preset', 'slow',
                    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', dst], check=True)
    # 封面：实机画面 + 游戏名 logo + 一句玩法，不放界面、不加边框
    cover = frame(cseg, cidx)
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for y in range(260):
        d.line([0, y, W, y], fill=(16, 8, 14, int(170 * (1 - y / 260))))
    d.text((W / 2, 96), '长坂单骑传', font=serif(118), fill=GOLD, anchor='mm', stroke_width=7, stroke_fill=(70, 16, 18))
    d.text((W / 2, 196), csub, font=serif(46), fill=WHITE, anchor='mm', stroke_width=4, stroke_fill=(40, 16, 10))
    cover = cover.convert('RGBA'); cover.alpha_composite(ov)
    kb = save_jpeg(cover.convert('RGB'), OUT + f'运营素材封面{vname}_1280x720.jpg', 195)
    print(vname, round(total, 1), 's', os.path.getsize(dst) // 1024, 'KB 视频；封面', kb, 'KB；文案：', promo, len(promo), '字')
