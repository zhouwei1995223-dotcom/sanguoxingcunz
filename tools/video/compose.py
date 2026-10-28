# 宣传视频合成：逐帧画面 + 字幕 + 片尾 + 游戏自己的配乐和音效 → 720×1280、30 帧的 mp4
# 用法：node tools/video/record.mjs && python3 tools/video/compose.py <标题字体.ttc>
# 输出两个版本：带「微信搜索」片尾（发朋友圈 / 视频号）和不带的（发小红书、抖音等站外平台）
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
FONT = sys.argv[1]
D = 'dist/video/'
W, H = 720, 1280
def serif(sz): return ImageFont.truetype(FONT, sz, index=2)
def sans(sz): return ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', sz)
GOLD, WHITE = (255, 214, 102), (255, 248, 232)
meta = json.load(open(D + 'segments.json'))
FPS = meta['fps']
seg = {s['name']: s for s in meta['segments']}
CAPS = {
    'home': ('长坂单骑传', '三国像素割草 · 单手就能玩'),
    'combat': ('满屏曹军 一路割草', '拖动走位，攻击全自动'),
    'ult': ('一招清屏', '赵云大招 · 龙胆七进七出'),
    'levelup': ('升级三选一', '武器满级 · 合成进化'),
    'strat': ('锦囊妙计', '24 条计策 · 神机妙算扭转战局'),
    'boss_intro': ('敌将来袭', '单骑斩将'),
    'boss_fight': ('长坂坡七进七出', '你能撑过几分钟？'),
}
def text(d, xy, s, f, fill, sw):
    d.text(xy, s, font=f, fill=fill, stroke_width=sw, stroke_fill=(36, 14, 10), anchor='mm')
def caption(im, title, sub, k, y=360):
    """在画面上叠字幕条，k 是 0~1 的淡入进度"""
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    a = int(255 * k)
    d.rectangle([0, y - 85, W, y + 85], fill=(20, 8, 14, int(150 * k)))
    d.line([0, y - 85, W, y - 85], fill=GOLD + (a,), width=3); d.line([0, y + 85, W, y + 85], fill=GOLD + (a,), width=3)
    txt = Image.new('RGBA', (W, H), (0, 0, 0, 0)); td = ImageDraw.Draw(txt)
    text(td, (W / 2, y - 22), title, serif(72), GOLD, 6)
    text(td, (W / 2, y + 48), sub, sans(32), WHITE, 3)
    if k < 1: txt.putalpha(txt.getchannel('A').point(lambda v: int(v * k)))
    im = im.convert('RGBA'); im.alpha_composite(ov); im.alpha_composite(txt)
    return im.convert('RGB')
os.makedirs(D + 'out', exist_ok=True)
n = 0
def emit(im):
    global n
    im.save(D + 'out/%05d.jpg' % n, quality=92); n += 1
times = {}
for name in ['home', 'combat', 'ult', 'levelup', 'strat', 'boss_intro', 'boss_fight']:
    s = seg[name]; times[name] = n / FPS
    for i, f in enumerate(range(s['start'], s['end'])):
        im = Image.open(D + 'frames/%05d.jpg' % f).resize((W, H), Image.LANCZOS)
        k = min(1, i / 6)
        y = 1060 if name == 'home' else 1120 if name in ('levelup', 'strat') else 380
        title, sub = CAPS[name]
        if name == 'home' and i < 20: continue_k = 0
        im = caption(im, title, sub, k, y) if not (name == 'home' and i < 15) else im
        emit(im)
# 片尾：最后一帧压暗模糊 + 赵云 + 标题
last = Image.open(D + 'frames/%05d.jpg' % (seg['home']['start'] + 30)).resize((W, H), Image.LANCZOS)
bg = last.filter(ImageFilter.GaussianBlur(14))
bg = Image.blend(bg, Image.new('RGB', (W, H), (24, 10, 18)), 0.55)
hero = Image.open('dist/cover/hero0.png'); hero = hero.crop(hero.getbbox()); hero = hero.resize((hero.width * 10, hero.height * 10), Image.NEAREST)
def endcard(cta, k):
    im = bg.copy().convert('RGBA')
    im.alpha_composite(hero, ((W - hero.width) // 2, 300))
    d = ImageDraw.Draw(im)
    text(d, (W / 2, 210), '长坂单骑传', serif(104), GOLD, 8)
    text(d, (W / 2, 690), '三国像素割草 · 免费 · 打开即玩', sans(34), WHITE, 3)
    if cta:
        d.rounded_rectangle([110, 770, W - 110, 870], radius=50, fill=(7, 193, 96))
        text(d, (W / 2, 820), cta, sans(38), WHITE, 0)
    im = im.convert('RGB')
    return Image.blend(Image.new('RGB', (W, H), (0, 0, 0)), im, k) if k < 1 else im
times['end'] = n / FPS
END = 90
base_n = n
for cta, tag in (('微信搜索「长坂单骑传」', 'wx'), (None, 'clean')):
    os.makedirs(D + 'end_' + tag, exist_ok=True)
    for i in range(END):
        endcard(cta, min(1, i / 8)).save(D + 'end_%s/%05d.jpg' % (tag, i), quality=92)
total = (base_n + END) / FPS
print('body frames', base_n, 'total sec', round(total, 2), times)
# 音轨：战斗配乐 + 关键时刻音效
A = 'assets/audio/'
sfx = [('sfx_horse', times['combat']), ('sfx_thrust', times['ult']), ('sfx_explode', times['ult'] + 0.1), ('sfx_levelup', times['levelup']),
       ('sfx_evolve', times['strat']), ('sfx_boss', times['boss_intro']), ('sfx_victory', times['end'] + 0.2)]
kills = [times['combat'] + 0.6 + i * 0.32 for i in range(int((times['levelup'] - times['combat'] - 0.8) / 0.32))]
kills += [times['boss_fight'] + 0.3 + i * 0.4 for i in range(int((times['end'] - times['boss_fight'] - 0.5) / 0.4))]
inputs = ['-i', A + 'bgm_battle.mp3']
filt = [f'[0:a]atrim=0:{total},afade=t=in:d=0.6,afade=t=out:st={total - 1.2}:d=1.2,volume=0.75[bgm]']
labels = ['[bgm]']
for j, (name, t) in enumerate(sfx + [('sfx_kill', t) for t in kills], 1):
    inputs += ['-i', A + name + '.mp3']
    vol = 0.35 if name == 'sfx_kill' else 0.9
    filt.append(f'[{j}:a]adelay={int(t * 1000)}|{int(t * 1000)},volume={vol}[s{j}]')
    labels.append(f'[s{j}]')
filt.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0,atrim=0:{total}[a]')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filt), '-map', '[a]', '-ac', '2', '-ar', '44100', D + 'audio.m4a'], check=True)
os.makedirs('docs/promo', exist_ok=True)
for tag, name in (('wx', '宣传视频_微信版'), ('clean', '宣传视频_通用版')):
    lst = D + f'list_{tag}.txt'
    with open(lst, 'w') as fh:
        for i in range(base_n): fh.write(f"file 'out/{i:05d}.jpg'\nduration {1 / FPS}\n")
        for i in range(END): fh.write(f"file 'end_{tag}/{i:05d}.jpg'\nduration {1 / FPS}\n")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-i', D + 'audio.m4a',
                    '-r', str(FPS), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'slow', '-c:a', 'aac', '-b:a', '160k',
                    '-movflags', '+faststart', '-shortest', f'docs/promo/{name}.mp4'], check=True)
    print(name, os.path.getsize(f'docs/promo/{name}.mp4') // 1024, 'KB')
