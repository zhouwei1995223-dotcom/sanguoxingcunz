# 横版宣传视频（16:9，1280×720，30 帧，H.264 约 1Mbps + AAC），三条。
# 竖屏游戏画面放大居中，两边用同一帧的模糊放大版做背景，左边玩法标题、右边玩法说明。不加片头 logo，开头直接是玩法。
# 用法：node tools/video/record2.mjs && python3 tools/video/compose2.py <标题字体.ttc>
import json, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
FONT = sys.argv[1]
D = 'dist/video2/'
W, H = 1280, 720
def serif(sz): return ImageFont.truetype(FONT, sz, index=2)
def sans(sz): return ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', sz)
GOLD, WHITE = (255, 214, 102), (255, 248, 232)
meta = json.load(open(D + 'segments.json'))
FPS = meta['fps']
SEG = {s['name']: s for s in meta['segments']}
A = 'assets/audio/'
VIDEOS = [
    ('横版1_一骑当千', 'bgm_battle', [
        dict(segs=[('combat', 15, 195)], title='满屏曹军\n一路割草', sub='拖动走位 · 攻击全自动', bullets=['单手就能玩', '越杀越多 · 连斩不停'], sfx=[('sfx_horse', 0)]),
        dict(segs=[('ult', 0, 165)], title='大招清屏', sub='赵云 · 龙胆七进七出', bullets=['击败敌人攒满怒气', '一键释放 · 万军皆倒'], sfx=[('sfx_thrust', 0.45), ('sfx_explode', 0.55)]),
        dict(segs=[('boss_intro', 0, 60), ('boss_fight', 0, 130)], title='单骑斩将', sub='十大章节 · 名将拦路', bullets=['长坂坡 · 赤壁 · 五丈原', '你能撑过几分钟？'], sfx=[('sfx_boss', 0)]),
    ]),
    ('横版2_兵法进化', 'bgm_battle', [
        dict(segs=[('levelup', 0, 70), ('thunder', 0, 110)], title='升级三选一', sub='枪 · 剑 · 火 · 雷 自由搭配', bullets=['每局流派都不同', '不想要的还能封禁'], sfx=[('sfx_levelup', 0.1), ('sfx_shoot', 2.4)]),
        dict(segs=[('chest', 0, 110), ('evo', 0, 120)], title='满级进化', sub='开宝箱 · 合成神兵', bullets=['武器满级 + 对应兵法', '进化后威力翻倍'], sfx=[('sfx_chest', 0.1), ('sfx_evolve', 1.6)]),
        dict(segs=[('ult', 20, 165)], title='一路砍到底', sub='流派成型 · 满屏清场', bullets=['每局几分钟', '随时来一把'], sfx=[('sfx_explode', 0.1)]),
    ]),
    ('横版3_锦囊妙计', 'bgm_boss', [
        dict(segs=[('strat', 0, 45), ('strat_pick', 0, 10), ('wanjian', 0, 140)], title='锦囊妙计', sub='2:00 · 5:00 · 7:30 三选一', bullets=['神机 · 万箭齐发', '全屏箭雨 一扫而空'], sfx=[('sfx_click', 1.5), ('sfx_evolve', 1.6), ('sfx_shoot', 2.3), ('sfx_shoot', 2.6)]),
        dict(segs=[('huoshao', 0, 150)], title='计策叠加', sub='火烧连营 + 八阵图', bullets=['24 条三国计策', '选对了逆风翻盘'], sfx=[('sfx_fire', 0.3)]),
        dict(segs=[('boss_fight', 0, 130)], title='以计破敌', sub='名将来了也不怕', bullets=['良策 · 妙计 · 神机', '你会怎么选？'], sfx=[('sfx_boss', 0)]),
    ]),
]
PANEL_Y0, PANEL_Y1 = 140, 1300                      # 截掉顶部状态栏和底部按钮，只留核心玩法画面
def frame(name, i):
    return Image.open(D + 'frames/%05d.jpg' % (SEG[name]['start'] + i))
def text(d, xy, s, f, fill, sw, anchor='mm'):
    d.multiline_text(xy, s, font=f, fill=fill, stroke_width=sw, stroke_fill=(36, 14, 10), anchor=anchor, align='center', spacing=10)
def compose(src, sc, k):
    # 背景：同一帧放大、模糊、压暗
    bw = W; bh = round(src.height * W / src.width)
    bg = src.resize((bw // 4, bh // 4)).filter(ImageFilter.GaussianBlur(4)).resize((bw, bh))
    bg = bg.crop((0, (bh - H) // 2, W, (bh - H) // 2 + H))
    bg = Image.blend(bg, Image.new('RGB', (W, H), (20, 10, 18)), 0.55)
    # 中间：游戏画面
    crop = src.crop((0, PANEL_Y0, src.width, PANEL_Y1))
    pw = round(crop.width * H / crop.height)
    panel = crop.resize((pw, H), Image.LANCZOS)
    px = (W - pw) // 2
    bg.paste(panel, (px, 0))
    d = ImageDraw.Draw(bg)
    d.line([px - 3, 0, px - 3, H], fill=GOLD, width=4); d.line([px + pw + 2, 0, px + pw + 2, H], fill=GOLD, width=4)
    # 左：标题；右：说明（淡入）
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    lx = px // 2
    text(od, (lx, 300), sc['title'], serif(60 if '\n' in sc['title'] else 64), GOLD, 6)
    text(od, (lx, 300 + (110 if '\n' in sc['title'] else 70)), sc['sub'], sans(26), WHITE, 3)
    rx = px + pw + (W - px - pw) // 2
    for j, b in enumerate(sc['bullets']):
        y = 290 + j * 76
        od.rounded_rectangle([rx - 170, y - 28, rx + 170, y + 28], radius=28, fill=(30, 14, 22, 200), outline=GOLD + (255,), width=2)
        text(od, (rx, y), b, sans(26), WHITE, 0)
    if k < 1: ov.putalpha(ov.getchannel('A').point(lambda v: int(v * k)))
    bg = bg.convert('RGBA'); bg.alpha_composite(ov)
    return bg.convert('RGB')
os.makedirs('docs/promo', exist_ok=True)
for vname, bgm, scenes in VIDEOS:
    out = D + 'out_' + vname + '/'
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    n = 0; cues = []; kills = []
    for sc in scenes:
        t0 = n / FPS
        cues += [(s, t0 + off) for s, off in sc['sfx']]
        i = 0
        for seg, a, b in sc['segs']:
            for f in range(a, b):
                compose(frame(seg, f), sc, min(1, i / 8)).save(out + '%05d.jpg' % n, quality=93)
                n += 1; i += 1
        kills += [t0 + 0.5 + j * 0.33 for j in range(int((n / FPS - t0 - 0.7) / 0.33))]
    total = n / FPS
    # 音轨
    inputs = ['-i', A + bgm + '.mp3']
    filt = [f'[0:a]atrim=0:{total},afade=t=in:d=0.4,afade=t=out:st={total - 1}:d=1,volume=0.8[bgm]']
    labels = ['[bgm]']
    for j, (s, t) in enumerate(cues + [('sfx_kill', t) for t in kills], 1):
        inputs += ['-i', A + s + '.mp3']
        filt.append(f'[{j}:a]adelay={int(t * 1000)}|{int(t * 1000)},volume={0.3 if s == "sfx_kill" else 0.9}[s{j}]')
        labels.append(f'[s{j}]')
    filt.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0,atrim=0:{total}[a]')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filt), '-map', '[a]', '-ac', '2', '-ar', '44100', out + 'audio.m4a'], check=True)
    dst = f'docs/promo/宣传视频_{vname}_1280x720.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', out + '%05d.jpg', '-i', out + 'audio.m4a',
                    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', '1000k', '-maxrate', '1300k', '-bufsize', '2000k', '-preset', 'slow',
                    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', dst], check=True)
    print(vname, round(total, 1), 's', os.path.getsize(dst) // 1024, 'KB')
