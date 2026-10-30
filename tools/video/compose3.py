# 抖音竖版 30 秒视频（1080×1920，30 帧，H.264 + AAC）：游戏画面铺满 9:16，下方字幕点出玩法，结尾一张标题卡。
# 用法：npm run build && node tools/video/record3.mjs && python3 tools/video/compose3.py <标题字体.ttc>
import json, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
FONT = sys.argv[1]           # 思源宋体 Noto Serif CJK Black（SIL OFL，可商用）
D = 'dist/video3/'
W, H = 1080, 1920
def serif(sz): return ImageFont.truetype(FONT, sz, index=2)
def sans(sz): return ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', sz)
GOLD, WHITE = (255, 214, 102), (255, 248, 232)
meta = json.load(open(D + 'segments.json'))
FPS = meta['fps']
SEG = {s['name']: s for s in meta['segments']}
A = 'assets/audio/'
# （片段，字幕）：字幕在片段开始时淡入
CAPTIONS = [
    ('home', '三国 · 像素割草'),
    ('heroes', '十位名将 各有绝技'),
    ('qiyu', '开局奇遇 三选一'),
    ('combat', '满屏曹军 一路砍过去'),
    ('ult', '大招 · 七进七出'),
    ('boss_intro', '名将拦路'),
    ('boss_cross', '看准红圈 躲开技能'),
    ('boss_shield', '十二秒破盾 不然狂暴'),
    ('ult_machao', '马超 · 西凉铁骑'),
    ('ult_sunshangxiang', '孙尚香 · 弓腰姬'),
    ('ult_huangzhong', '黄忠 · 定军斩将'),
]
END_FRAMES = 75
cap_at = {SEG[name]['start']: text for name, text in CAPTIONS}
total_frames = meta['segments'][-1]['end']
def caption(im, text, k):
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    y = 1290
    tw = d.textlength(text, font=serif(84))
    d.rounded_rectangle([W / 2 - tw / 2 - 50, y - 78, W / 2 + tw / 2 + 50, y + 78], radius=30, fill=(26, 12, 18, 190), outline=GOLD + (255,), width=4)
    d.text((W / 2, y), text, font=serif(84), fill=GOLD, anchor='mm', stroke_width=5, stroke_fill=(40, 16, 10))
    if k < 1: ov.putalpha(ov.getchannel('A').point(lambda v: int(v * k)))
    im = im.convert('RGBA'); im.alpha_composite(ov)
    return im.convert('RGB')
out = D + 'out/'
shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
cur, since = None, 0
for i in range(total_frames):
    if i in cap_at: cur, since = cap_at[i], i
    im = Image.open(D + 'frames/%05d.jpg' % i).convert('RGB').resize((W, H), Image.LANCZOS)
    if cur: im = caption(im, cur, min(1, (i - since + 1) / 6))
    im.save(out + '%05d.jpg' % i, quality=92)
# 结尾标题卡：最后一帧模糊压暗做底
last = Image.open(D + 'frames/%05d.jpg' % (total_frames - 1)).convert('RGB').resize((W, H))
bg = last.resize((W // 6, H // 6)).filter(ImageFilter.GaussianBlur(3)).resize((W, H))
bg = Image.blend(bg, Image.new('RGB', (W, H), (20, 10, 18)), 0.6)
for j in range(END_FRAMES):
    k = min(1, (j + 1) / 10)
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    d.text((W / 2, 760), '长坂单骑传', font=serif(150), fill=GOLD, anchor='mm', stroke_width=8, stroke_fill=(60, 14, 18))
    d.text((W / 2, 900), '单手就能玩 · 一局几分钟', font=sans(52), fill=WHITE, anchor='mm')
    d.text((W / 2, 980), '十位三国名将 等你来战', font=sans(52), fill=WHITE, anchor='mm')
    if k < 1: ov.putalpha(ov.getchannel('A').point(lambda v: int(v * k)))
    im = bg.convert('RGBA'); im.alpha_composite(ov)
    im.convert('RGB').save(out + '%05d.jpg' % (total_frames + j), quality=92)
n = total_frames + END_FRAMES
total = n / FPS
t = lambda name, off=0: SEG[name]['start'] / FPS + off
boss_t = t('boss_intro')
cues = [('sfx_click', t('qiyu_pick')), ('sfx_evolve', t('qiyu_pick', 0.05)), ('sfx_horse', t('combat', 0.1)),
        ('sfx_thrust', t('ult', 0.3)), ('sfx_explode', t('ult', 0.4)), ('sfx_explode', t('ult', 2.6)),
        ('sfx_boss', boss_t), ('sfx_explode', t('boss_cross', 1.3)), ('sfx_explode', t('boss_rain', 1.0)), ('sfx_explode', t('boss_rain', 1.3)),
        ('sfx_boss', t('boss_shield')), ('sfx_horse', t('ult_machao', 0.2)), ('sfx_shoot', t('ult_sunshangxiang', 0.2)), ('sfx_shoot', t('ult_sunshangxiang', 0.8)),
        ('sfx_shoot', t('ult_huangzhong', 0.2)), ('sfx_explode', t('ult_huangzhong', 1.5)), ('sfx_victory', total_frames / FPS)]
kills = [t('combat', 0.5 + j * 0.3) for j in range(15)] + [t('ult_machao', 0.6 + j * 0.3) for j in range(15)]
inputs = ['-i', A + 'bgm_battle.mp3', '-i', A + 'bgm_boss.mp3']
filt = [f'[0:a]atrim=0:{boss_t + 0.5},afade=t=in:d=0.4,afade=t=out:st={boss_t}:d=0.5,volume=0.8[b1]',
        f'[1:a]atrim=0:{total - boss_t},afade=t=in:d=0.5,afade=t=out:st={total - boss_t - 1.2}:d=1.2,adelay={int(boss_t * 1000)}|{int(boss_t * 1000)},volume=0.8[b2]']
labels = ['[b1]', '[b2]']
for j, (s, tt) in enumerate(cues + [('sfx_kill', x) for x in kills], 2):
    inputs += ['-i', A + s + '.mp3']
    filt.append(f'[{j}:a]adelay={int(tt * 1000)}|{int(tt * 1000)},volume={0.3 if s == "sfx_kill" else 0.9}[s{j}]')
    labels.append(f'[s{j}]')
filt.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0,atrim=0:{total}[a]')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filt), '-map', '[a]', '-ac', '2', '-ar', '44100', out + 'audio.m4a'], check=True)
dst = 'docs/promo/抖音视频_30秒_1080x1920.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', out + '%05d.jpg', '-i', out + 'audio.m4a',
                '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', '6000k', '-maxrate', '8000k', '-bufsize', '12000k', '-preset', 'slow',
                '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', dst], check=True)
print(dst, round(total, 1), 's', os.path.getsize(dst) // 1024, 'KB')
