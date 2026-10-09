# 生成软件著作权登记材料：源程序（前后各 30 页，每页 50 行）、用户操作手册、申请表填写内容
# 用法：先运行截图脚本生成 dist/shots/*.png，再执行 python3 tools/ruanzhu/make.py
# 输出到 dist/ruanzhu/
import os
import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Image, Table, TableStyle,
                                PageBreak, KeepTogether)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors

SOFT_NAME = '三国一骑当千游戏软件'
SHORT_NAME = '三国一骑当千'
VERSION = 'V1.0'
OWNER = '张周炜'
HEADER = f'{SOFT_NAME} {VERSION}'

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'dist', 'ruanzhu')
SHOTS = os.path.join(ROOT, 'dist', 'shots')
os.makedirs(OUT, exist_ok=True)

FONT_FILE = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
pdfmetrics.registerFont(TTFont('Hei', FONT_FILE, subfontIndex=0))
pdfmetrics.registerFont(TTFont('Mono', FONT_FILE, subfontIndex=1))

W, H = A4

# 源程序按「入口 → 核心 → 战斗 → 数据 → 美术 → 系统 → 界面 → 场景」的顺序排列，
# 前 30 页从程序入口开始，后 30 页以战斗场景结束
ORDER = [
    'main.ts', 'game.ts', 'debug.ts', 'core/math.ts', 'core/grid.ts',
    'battle/battle.ts', 'battle/entities.ts', 'battle/weapons.ts', 'battle/spawner.ts', 'battle/boss.ts', 'battle/render.ts',
    'data/skills.ts', 'data/heroes.ts', 'data/enemies.ts', 'data/chapters.ts', 'data/meta.ts', 'data/goals.ts',
    'data/platformConfig.ts', 'data/texts.ts',
    'gfx/palette.ts', 'gfx/pixel.ts', 'gfx/atlas.ts', 'gfx/art/hero.ts', 'gfx/art/heroes.ts', 'gfx/art/horse.ts',
    'gfx/art/units.ts', 'gfx/art/roster.ts', 'gfx/art/items.ts', 'gfx/art/icons.ts', 'gfx/art/env.ts',
    'audio/sound.ts', 'meta/save.ts', 'meta/ops.ts', 'meta/run.ts', 'meta/goals.ts', 'meta/cloud.ts',
    'platform/types.ts', 'platform/index.ts', 'platform/web.ts', 'platform/minigame.ts',
    'ui/ui.ts', 'ui/widgets.ts', 'ui/guide.ts',
    'scenes/loadingScene.ts', 'scenes/homeBg.ts', 'scenes/homeDialogs.ts', 'scenes/featureDialogs.ts', 'scenes/homeScene.ts',
    'scenes/battleDialogs.ts', 'scenes/battleScene.ts',
]


def source_lines():
    src = os.path.join(ROOT, 'src')
    found = sorted(os.path.relpath(os.path.join(d, f), src).replace('\\', '/')
                   for d, _, fs in os.walk(src) for f in fs if f.endswith('.ts'))
    missing = [f for f in found if f not in ORDER]
    assert not missing, f'ORDER 缺少文件：{missing}'
    lines, total = [], 0
    for f in ORDER:
        with open(os.path.join(src, f), encoding='utf-8') as fh:
            raw = fh.read().split('\n')
        total += len(raw)
        lines.append(f'// ===== 文件：src/{f} =====')
        lines += [l.rstrip().replace('\t', '  ') for l in raw if l.strip()]
    return lines, total


def wrap(line, font, size, width):
    out, cur = [], ''
    for ch in line:
        if pdfmetrics.stringWidth(cur + ch, font, size) > width:
            out.append(cur)
            cur = '    ' + ch
        else:
            cur += ch
    out.append(cur)
    return out


def header(c, page):
    c.setFont('Hei', 9)
    c.drawString(2 * cm, H - 1.3 * cm, HEADER)
    c.drawRightString(W - 2 * cm, H - 1.3 * cm, f'第 {page} 页')
    c.setLineWidth(0.5)
    c.line(2 * cm, H - 1.5 * cm, W - 2 * cm, H - 1.5 * cm)


def make_source():
    lines, total = source_lines()
    size, per = 7.6, 50
    width = W - 4 * cm
    # 按显示行（长行折行）分页，每页正好 50 行
    disp = []
    for l in lines:
        disp += wrap(l, 'Mono', size, width)
    pages_total = (len(disp) + per - 1) // per
    if pages_total > 60:
        # 前 30 页从程序开头连续截取，后 30 页从程序结尾倒数截取：每页都是完整 50 行，最后一页末行即程序结尾
        front = [disp[i * per:(i + 1) * per] for i in range(30)]
        back_lines = disp[-30 * per:]
        back = [back_lines[i * per:(i + 1) * per] for i in range(30)]
        chosen = front + back
    else:
        chosen = [disp[i:i + per] for i in range(0, len(disp), per)]
    pages = [None] * pages_total
    path = os.path.join(OUT, f'{SOFT_NAME}{VERSION}_源程序.pdf')
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle(f'{HEADER} 源程序')
    line_h = (H - 3.4 * cm) / per
    for n, page in enumerate(chosen, 1):
        header(c, n)
        c.setFont('Mono', size)
        y = H - 1.5 * cm - line_h
        for l in page:
            c.drawString(2 * cm, y, l)
            y -= line_h
        c.showPage()
    c.save()
    return path, total, len(pages), len(chosen), sum(1 for l in lines if not l.startswith('// ===== 文件'))


# —— 用户操作手册 ——
st_body = ParagraphStyle('body', fontName='Hei', fontSize=10.5, leading=17, firstLineIndent=21)
st_item = ParagraphStyle('item', fontName='Hei', fontSize=10.5, leading=17, leftIndent=12)
st_h1 = ParagraphStyle('h1', fontName='Hei', fontSize=16, leading=26, spaceBefore=6, spaceAfter=6)
st_h2 = ParagraphStyle('h2', fontName='Hei', fontSize=13, leading=22, spaceBefore=6, spaceAfter=4)
st_cap = ParagraphStyle('cap', fontName='Hei', fontSize=9, leading=13, alignment=1, textColor=colors.HexColor('#555555'))
st_title = ParagraphStyle('title', fontName='Hei', fontSize=26, leading=40, alignment=1)
st_sub = ParagraphStyle('sub', fontName='Hei', fontSize=14, leading=24, alignment=1)


def P(t, s=st_body):
    return Paragraph(t, s)


def shots(names, caps, h=11.5 * cm):
    cells, capc = [], []
    for n, cp in zip(names, caps):
        p = os.path.join(SHOTS, n + '.png')
        if not os.path.exists(p):
            raise SystemExit(f'缺少截图 {p}，请先运行截图脚本')
        # 压缩成 JPG（缩到约 380 像素宽，打印足够清晰），整份手册控制在 2MB 以内，满足上传大小限制
        from PIL import Image as PImage
        src = PImage.open(p).convert('RGB')
        iw, ih = src.size
        k = min(1, 380 / iw)
        jp = os.path.join(OUT, '.img', n + '.jpg')
        os.makedirs(os.path.dirname(jp), exist_ok=True)
        src.resize((round(iw * k), round(ih * k)), PImage.LANCZOS).save(jp, 'JPEG', quality=65, optimize=True)
        w = h * iw / ih
        cells.append(Image(jp, width=w, height=h))
        capc.append(P(cp, st_cap))
    t = Table([cells, capc])
    t.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    return KeepTogether([Spacer(1, 4), t, Spacer(1, 6)])


def items(lst):
    return [P('• ' + x, st_item) for x in lst]


def manual_story():
    s = []
    s += [P(f'{SOFT_NAME} 用户操作手册', st_title), P(f'版本：{VERSION}　　著作权人：{OWNER}　　{datetime.date.today().strftime("%Y年%m月")}', st_sub), Spacer(1, 10)]

    s += [P('目录', st_h1)]
    toc = ['一、软件概述', '二、运行环境', '三、启动与新手引导', '四、主界面', '五、章节与难度', '六、战斗操作', '七、升级与技能选择',
           '八、宝箱与神兵进化', '九、敌将战', '十、暂停与进化表', '十一、战斗结算', '十二、装备系统', '十三、军略', '十四、武将',
           '十五、商店与宝匣', '十六、签到与七日目标', '十七、每日任务与巡营', '十八、图鉴与成就', '十九、无尽模式', '二十、每周挑战',
           '二十一、排行榜与分享', '二十二、设置', '二十三、常见问题']
    s += items(toc)

    s += [P('一、软件概述', st_h1)]
    s += [P(f'《{SHORT_NAME}》是一款以三国为题材的像素风动作类小游戏，运行在微信、抖音等平台的小游戏环境中。玩家操控赵云、关羽、张飞、诸葛亮、吕布等名将，'
            '在长坂坡、取桂阳、汉中、五丈原等十个历史场景中单骑突围，面对潮水般涌来的敌军坚持到最后并击败敌方主将。'),
          P('游戏采用「自动攻击 + 手动走位」的玩法：玩家只需拖动屏幕控制武将移动，武将会自动释放已习得的武器技能。击败敌人掉落经验宝石，'
            '升级时从三个随机选项中挑选新武器或兵法；武器升到满级并拥有对应兵法后，开启宝箱即可进化为威力更强的神兵形态。'
            '每名武将还拥有专属武器、专属大招以及与部分通用武器的「专属联动」，同一套技能在不同武将手中会有不同的进化效果。'),
          P('局外养成包括装备、军略、武将升级与升星、皮肤与套装等系统，配合签到、每日任务、巡营挂机、新手七日目标、图鉴成就、'
            '无尽模式、每周挑战、好友排行榜等功能，为玩家提供长期的成长目标。'),
          P('本软件主要功能如下：'),
          ]
    s += items(['战斗系统：浮动摇杆移动、自动攻击、16 种武器（含 5 把武将专属武器）、15 种兵法、神兵进化与武将专属联动、怒气大招、宝箱、敌将技能预警；',
                '关卡系统：10 个章节，每章 10 分钟，分普通、困难、噩梦三种难度，另有无尽模式与每周挑战；',
                '养成系统：装备（6 个部位、6 种品质、强化与套装）、军略（永久属性）、武将升级升星、皮肤；',
                '运营系统：签到、每日任务与活跃度、巡营挂机收益、新手七日目标、图鉴、成就、兑换码、订阅提醒；',
                '平台能力：云存档、好友排行榜、分享、激励视频广告、抖音录屏分享、数据统计；',
                '辅助功能：新手引导、技能推荐、技能封禁、局内进化表、伤害数字开关、大招按钮左右切换、性能自适应。'])
    s += [P('本手册按照玩家的实际使用顺序，逐一介绍各项功能的操作方法。')]

    s += [P('二、运行环境', st_h1), P('硬件环境：', st_h2)]
    s += items(['智能手机：Android 8.0 及以上或 iOS 13 及以上；', '内存：2GB 及以上；', '存储空间：约 5MB（含图片与音频资源）；',
                '屏幕：竖屏显示，适配 16:9 至 21:9 等主流比例及刘海屏、挖孔屏。'])
    s += [P('软件环境：', st_h2)]
    s += items(['微信客户端 8.0 及以上版本的小游戏运行环境，或抖音客户端的小游戏运行环境；', '基础库版本：微信小游戏基础库 2.x / 3.x；',
                '网络：首次进入及使用排行榜、云存档、广告时需要联网，战斗本身可离线进行。'])
    s += [P('开发环境：', st_h2)]
    s += items(['操作系统：Windows 10 / macOS；', '开发语言：TypeScript（编译为 JavaScript）；', '构建工具：Node.js、esbuild；',
                '调试工具：微信开发者工具、抖音开发者工具；', '渲染方式：基于 Canvas 2D 的自研像素渲染引擎，美术资源全部由程序生成。'])
    s += [P('安装方式：', st_h2), P('本软件无需安装。玩家在微信或抖音中搜索「三国一骑当千」，或通过好友分享的卡片进入即可开始游戏。'
                                  '首次进入时会弹出用户协议与隐私政策，阅读并同意后进入游戏。')]

    sections = [
        ('三、启动与新手引导',
         ['首次进入游戏时，系统显示加载界面并弹出《用户协议》《隐私政策》，玩家同意后自动开始一场教学战斗。教学战斗中屏幕会提示「按住屏幕任意位置拖动，控制武将移动」，并在第一次升级时用手指图标指引玩家选择技能。',
          '教学战斗结束后进入结算界面，系统赠送一把兵器。回到主城后，引导会依次指向「装备」「军略」「征战」页签，带领玩家完成穿戴装备、升级军略、再次出征的完整流程。'],
         ['nb_levelup', 'nb_result', 'nb_home_g1'], ['教学战斗中的升级选择', '教学战斗结算', '主城引导']),
        ('四、主界面',
         ['主界面上方显示武将头像、等级、战力，以及金币、体力、元宝、玄铁四种资源；资源旁的「+」按钮可通过观看视频获得补给。体力随时间自动恢复，每次出征消耗 5 点。',
          '界面左侧为签到、七日、任务、巡营、挑战入口，右侧为排行、图鉴、设置、分享入口，有可领取奖励时按钮右上角显示红点。中部的章节卡片显示当前章节、难度、最佳纪录与推荐战力；底部为商店、装备、征战、军略、武将五个页签。'],
         ['home_battle'], ['主界面']),
        ('五、章节与难度',
         ['游戏共 10 个章节，依次为长坂坡、取桂阳、汉水之战、凤鸣山、箕谷断后、虎牢关、官渡、赤壁、夷陵、五丈原。通关上一章后解锁下一章；章节卡左右箭头可切换章节，点击「章节」按钮可查看全部章节及各难度通关情况。',
          '每个章节分普通、困难、噩梦三种难度，普通通关后解锁困难，困难通关后解锁噩梦。难度越高敌人越强，奖励倍率与装备品质也越高。章节卡显示「推荐战力」，战力达到推荐值时较容易通关，战力不足时显示为红色。'],
         ['m_list', 'm_hard'], ['章节总览', '困难难度']),
        ('六、战斗操作',
         ['按住屏幕任意位置拖动即可出现摇杆并控制武将移动，松开手指武将停下。武将会自动向附近敌人释放已拥有的全部武器，无需手动攻击。屏幕上方显示等级经验条、击杀数、金币、剩余时间与当前章节，左上方显示已拥有的武器与兵法。',
          '击败敌人后掉落蓝色经验宝石，靠近即可自动拾取；场上还会出现肉包子（回复生命）、磁石（吸取全部经验）、震天雷（清除屏幕内敌人）与宝箱，屏幕外的道具会在屏幕边缘显示箭头。击杀积攒怒气，怒气满后点击左下角（可在设置中改为右下角）大招按钮释放武将大招，大招期间时间放慢、武将无敌。'],
         ['fx_combat', 'ult_2'], ['战斗画面', '赵云大招「龙胆·七进七出」']),
        ('七、升级与技能选择',
         ['经验条满后升级，弹出三个随机选项，点击即可习得或强化。选项卡片上显示技能等级、效果说明与进化配方；标有「推荐」的选项适合大多数情况，标有「可进化」的选项选择后即可在下一个宝箱中进化，标有「★专属」的选项与当前武将有专属联动。',
          '「刷新」按钮可重新随机三个选项（每局可观看视频刷新 5 次，军略「奇谋」提供额外的免费次数）；「封禁」按钮可以把不想要的新技能移出本局候选，每局 2 次。每名武将最多同时拥有 6 种武器和 6 种兵法。'],
         ['sk_levelup', 'sk_banish'], ['升级选择', '封禁模式']),
        ('八、宝箱与神兵进化',
         ['精英敌人与敌将会掉落宝箱，拾取后自动开启，随机获得 1、3 或 5 项技能升级。若某件武器已升到满级且拥有对应兵法，开启宝箱时会优先将其进化为神兵形态，例如「龙胆枪 + 虎符 → 百鸟朝凤」。',
          '当武将与武器存在专属联动时，进化会变成更强的专属形态，并显示「★专属联动觉醒」，例如赵云的「青锋剑 → 青釭剑阵」、诸葛亮的「火油罐 → 火烧博望」。'],
         ['chest_open', 'sk_chest_link'], ['神兵进化', '专属联动觉醒']),
        ('九、敌将战',
         ['每章第 5 分钟与第 10 分钟会各出现一名敌将，出场时显示敌将名号与介绍。敌将拥有冲锋、旋风斩、投掷、跳斩、召唤、箭雨等技能，释放前地面会出现红色预警区域，玩家应及时离开。屏幕上方显示敌将血条。',
          '击败最终敌将即通关本章；击败敌将必定掉落宝箱与大量金币。'],
         ['final_intro', 'final_fight'], ['敌将出场', '敌将战']),
        ('十、暂停与进化表',
         ['点击右上角暂停按钮打开暂停界面，可查看本局已拥有的武器与兵法、主要属性，开关音乐与音效，切换大招按钮位置，以及撤退（按当前进度结算）或继续战斗。',
          '点击「查看进化表」可查看当前武将所有可用武器的进化配方，已拥有的武器与兵法会高亮显示，专属武器与专属联动排在最前面。'],
         ['pause', 'sk_evotable'], ['暂停界面', '进化表']),
        ('十一、战斗结算',
         ['坚守到时间结束并击败最终敌将即为胜利；生命归零时可观看视频或使用军略「不屈」次数复活一次，放弃复活则按当前进度结算。',
          '结算界面显示坚守时间、击败敌军数、武将等级、斩获敌将数以及获得的金币、玄铁、元宝与装备，可观看视频领取双倍奖励。首次通关章节还会获得额外元宝、装备，部分章节奖励武将或武将碎片，并提示新解锁的技能。'],
         ['result'], ['战斗结算']),
        ('十二、装备系统',
         ['「装备」页签中央显示武将形象，四周为兵器、头盔、铠甲、护手、战靴、坐骑六个装备栏，下方为背包。点击背包中的装备可查看属性并穿戴，点击「一键穿戴」自动换上最强装备。',
          '装备分为普通、优良、精良、史诗、传说、神话六种品质，可消耗金币与玄铁强化，可分解为玄铁。同一套装凑齐 2 件、4 件、6 件时获得额外加成。'],
         ['home_equip', 'dlg_item'], ['装备页', '装备详情']),
        ('十三、军略',
         ['「军略」页签提供武艺、体魄、铁壁、轻骑、洞察、博学、屯田、破绽、神速等永久属性加成，消耗金币升级，对全部武将生效。部分军略需通关指定章节后解锁，「不屈」提供每局免费复活，「奇谋」提供每局免费刷新次数。列表较长时可上下滑动查看。'],
         ['home_talent'], ['军略页']),
        ('十四、武将',
         ['「武将」页签上方为武将列表，点击头像查看武将详情：定位、等级、攻击、生命、天赋、专属武器、大招与专属联动说明。消耗金币升级武将，消耗碎片升星（每星提升基础攻击与生命），已拥有的武将可设为出战。',
          '五名武将分别通过初始赠送、通关第 2 章、七日签到、收集碎片等方式获得。武将可更换皮肤，皮肤提供少量伤害加成。'],
         ['home_hero', 'f_skin'], ['武将详情', '皮肤']),
        ('十五、商店与宝匣',
         ['「商店」页签提供军资箱与名将宝匣：军资箱主要开出装备并有几率获得武将碎片；名将宝匣以武将为主，有几率直接获得完整武将，否则必得 8 至 15 个武将碎片，连续 15 次未出武将时第 15 次必出。宝箱可使用元宝购买，或每日观看视频免费开启。',
          '「每日补给」区域提供每日礼包、元宝、军饷、武将碎片、体力等补给，以及玄铁兑换。'],
         ['home_shop', 'dlg_chest_result'], ['商店', '开启宝匣']),
        ('十六、签到与七日目标',
         ['「签到」每日可领取一次奖励，第 7 天获得武将张飞，可观看视频双倍领取。「七日」为新手七日目标，每天开放一组任务，完成后领取奖励，全部完成可获得大奖。'],
         ['dlg_signin', 'f_newbie'], ['七日签到', '七日目标']),
        ('十七、每日任务与巡营',
         ['「任务」中列出每日任务，如登录、出征、击败敌人、观看视频、强化装备等，完成后领取活跃度，活跃度达到 20、40、60、80、100 时可开启对应宝箱。每日零点重置。',
          '「巡营」为离线挂机收益：离开游戏期间士兵持续屯田，最多累计 12 小时，回来后领取金币与玄铁，可观看视频双倍领取或快速巡营。'],
         ['dlg_tasks', 'dlg_patrol'], ['每日任务', '巡营']),
        ('十八、图鉴与成就',
         ['「图鉴」包含成就、敌将、兵种、神兵四个分页。成就按击杀、通关、收集等分为多档，达成后领取元宝；敌将、兵种、神兵在首次击败或进化后点亮，点亮可领取奖励，支持一键领取。'],
         ['f_codex', 'f_codex_boss'], ['成就', '敌将图鉴']),
        ('十九、无尽模式',
         ['通关第 3 章后解锁无尽模式。无尽模式没有时间上限，敌人随时间不断增强并定期出现敌将，玩家需要尽可能坚持更久。结算奖励按坚持时间计算，每坚持 5 分钟额外获得武将碎片，最佳纪录会进入排行榜。'],
         ['m_endless', 'm_endless_result'], ['无尽模式', '无尽结算']),
        ('二十、每周挑战',
         ['通关第 3 章后解锁每周挑战。每周轮换一种特殊规则（如敌人更多、经验加倍、只出现骑兵等），在限定时间内击败尽可能多的敌人，按击杀数领取阶段奖励，每周一刷新。'],
         ['f_weekly', 'w_battle'], ['每周挑战', '挑战战斗']),
        ('二十一、排行榜与分享',
         ['「排行」显示玩家在各难度的通关进度与无尽模式最佳纪录，以及微信好友之间的排行。「分享」可将游戏分享给好友或群聊；在抖音平台，战斗过程会自动录制精彩片段，结算后可一键分享战斗视频。'],
         ['dlg_rank'], ['排行榜']),
        ('二十二、设置',
         ['「设置」中可开关背景音乐、音效、震动、伤害数字，切换大招按钮在左下或右下；可查看用户协议、隐私政策与健康游戏忠告；可输入兑换码领取奖励、开启体力回满提醒；可查看云存档同步状态并手动同步。页面底部显示软件名称、版本号、著作权人与适龄提示。'],
         ['dlg_settings'], ['设置']),
    ]
    for title, paras, imgs, caps in sections:
        # 标题、说明与截图放在同一页
        s += [KeepTogether([P(title, st_h1)] + [P(t) for t in paras] + [shots(imgs, caps)])]

    s += [P('二十三、常见问题', st_h1)]
    faq = [('打不过当前章节怎么办？', '可在「装备」中强化与穿戴更好的装备、在「军略」中提升属性、升级或升星武将，使战力接近章节推荐战力；也可先挑战已通关章节获取资源。'),
           ('如何获得新武将？', '通关第 2 章获得关羽，七日签到第 7 天获得张飞，诸葛亮与吕布可通过名将宝匣、商店每日补给、活跃度宝箱收集碎片解锁。'),
           ('武器为什么没有进化？', '进化需要两个条件：武器升到 5 级满级，并且拥有对应的兵法。满足条件后，下一次开启宝箱时自动进化。具体配方可在升级卡片底部或暂停界面的进化表中查看。'),
           ('更换手机后进度会丢失吗？', '游戏进度会自动同步到平台云存档，在新设备上用同一账号登录即可恢复。可在「设置」中查看云存档状态。'),
           ('手机发热或卡顿怎么办？', '游戏会在持续掉帧时自动减少同屏敌人数量；也可在「设置」中关闭伤害数字以减轻渲染压力。'),
           ('为什么有时看不到敌人？', '敌人从屏幕外围刷新并向武将聚拢，只有进入屏幕的敌人才会受到攻击；后期敌人数量会逐渐增多。'),
           ('如何联系我们？', '可通过平台小游戏菜单中的「意见反馈」提交问题与建议。')]
    for q, a in faq:
        s += [P('问：' + q, st_h2), P('答：' + a)]
    s += [Spacer(1, 12), P('健康游戏忠告：抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。')]
    return s


def make_manual():
    path = os.path.join(OUT, f'{SOFT_NAME}{VERSION}_用户操作手册.pdf')
    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2.2 * cm, bottomMargin=1.8 * cm,
                          title=f'{HEADER} 用户操作手册', author=OWNER)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f')
    doc.addPageTemplates([PageTemplate(id='p', frames=[frame], onPage=lambda c, d: header(c, d.page))])
    doc.build(manual_story())
    return path


def make_form(total_lines):
    today = datetime.date.today()
    text = f'''# 计算机软件著作权登记申请表 填写内容

在中国版权保护中心「版权登记业务平台」（register.ccopyright.com.cn）注册账号并实名认证后，
选择「计算机软件著作权登记申请」，按下表逐项填写。带【需你确认】的项目请按实际情况修改。

## 一、软件基本信息
| 栏目 | 填写内容 |
|---|---|
| 软件全称 | {SOFT_NAME} |
| 软件简称 | {SHORT_NAME} |
| 版本号 | {VERSION} |
| 软件分类 | 应用软件 |
| 软件说明 | 原创 |
| 开发完成日期 | {today.strftime('%Y-%m-%d')} 【需你确认：填你认为开发完成的日期，不能晚于提交日】 |
| 发表状态 | 未发表（游戏尚未上线；若提交前已上线，改为「已发表」并填写首次发表日期与地点） |
| 开发方式 | 独立开发 |

## 二、著作权人信息
| 栏目 | 填写内容 |
|---|---|
| 著作权人 | {OWNER} |
| 类别 | 自然人 |
| 证件类型 | 居民身份证 |
| 证件号码 / 国籍 / 省份 / 城市 | 【按你的身份证填写】 |
| 权利取得方式 | 原始取得 |
| 权利范围 | 全部权利 |

## 三、软件功能与技术特点
| 栏目 | 填写内容 |
|---|---|
| 开发的硬件环境 | CPU 2.0GHz 及以上、内存 8GB 及以上的个人计算机 |
| 运行的硬件环境 | 内存 2GB 及以上的 Android 或 iOS 智能手机 |
| 开发该软件的操作系统 | Windows 10 / macOS |
| 软件开发环境 / 开发工具 | Node.js、esbuild、微信开发者工具、抖音开发者工具 |
| 该软件的运行平台 / 操作系统 | Android 8.0 及以上、iOS 13 及以上（微信 / 抖音小游戏运行环境） |
| 软件运行支撑环境 / 支持软件 | 微信客户端 8.0 及以上、抖音客户端（小游戏基础库） |
| 编程语言 | TypeScript、JavaScript |
| 源程序量 | {total_lines} 行 |
| 开发目的 | 为移动端用户提供一款三国题材、操作简单、节奏爽快的像素风动作小游戏 |
| 面向领域 / 行业 | 文化娱乐、游戏 |
| 软件的主要功能（500～1300 字） | 本软件是一款三国题材的像素风动作类小游戏，运行于微信、抖音等平台的小游戏环境，主要功能如下：<br>一、战斗功能。玩家选择赵云、关羽、张飞、诸葛亮、吕布等武将出征，按住屏幕任意位置拖动即可控制武将移动，武将自动向附近敌人释放已习得的武器技能。击败敌人掉落经验宝石，升级时从三个随机选项中选择武器或兵法，支持刷新与封禁选项；软件提供十六种武器与十五种兵法，武器满级并拥有对应兵法后开启宝箱即可进化为神兵，部分武器与特定武将组合时进化为专属形态。击杀积攒怒气，怒气满后可释放武将专属大招。战场中随机出现肉包子、磁石、震天雷、宝箱等道具，敌将出场时有技能预警提示。<br>二、关卡功能。共设长坂坡、取桂阳、汉水之战等十个历史章节，每章时长十分钟，分普通、困难、噩梦三种难度，按推荐战力提示难度；另设无尽模式与每周挑战两种玩法，结算时按坚守时间、击杀数发放奖励。<br>三、养成功能。装备系统含六个部位、六种品质，支持强化、分解、一键穿戴与套装加成；军略系统提供永久属性提升；武将系统支持升级、升星、皮肤与出战切换；商店提供军资箱、名将宝匣与每日补给。<br>四、运营功能。包括每日签到、每日任务与活跃度奖励、离线巡营收益、新手七日目标、成就与图鉴、兑换码、体力回满订阅提醒、新手引导等。<br>五、平台功能。支持云存档跨设备恢复进度、好友排行榜、分享、激励视频广告、抖音录屏分享、数据统计，以及音乐、音效、震动、伤害数字开关和大招按钮位置设置。 |
| 软件的技术特点 | 游戏类软件。基于 Canvas 2D 自研像素渲染引擎，美术资源与音效全部由程序生成；空间网格碰撞支持数百敌人同屏；按帧率自适应调整同屏敌人数；平台抽象层一套代码同时适配微信、抖音小游戏。 |

（「软件的技术特点」页面如需勾选类别，选择「游戏软件」。）

## 四、需要上传的材料
1. 程序鉴别材料：`{SOFT_NAME}{VERSION}_源程序.pdf`（前 30 页 + 后 30 页，共 60 页，每页 50 行）
2. 文档鉴别材料：`{SOFT_NAME}{VERSION}_用户操作手册.pdf`（不足 60 页，提交全部）
3. 身份证明：你的身份证正反面复印件（扫描或拍照转 PDF）
4. 申请表：在线填写提交后，系统生成的申请表需下载打印、签字后扫描上传（按平台提示操作）

## 五、注意事项
- 软件全称、版本号必须与两份 PDF 页眉一致（已按「{SOFT_NAME} {VERSION}」生成）。
- 小游戏在微信后台的名称建议使用「{SHORT_NAME}」，与软著名称对应，方便平台审核。
- 官方登记不收费，办理周期以版权保护中心公示为准；如需加急，可自行选择代理机构，不是必须的。
'''
    path = os.path.join(OUT, '申请表填写内容.md')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(text)
    return path


if __name__ == '__main__':
    sp, total, pages, chosen, nonblank = make_source()
    mp = make_manual()
    fp = make_form(total)
    print(f'源程序：总行数 {total}（非空 {nonblank}），共 {pages} 页，提交 {chosen} 页 -> {sp}')
    print(f'手册 -> {mp}')
    print(f'申请表内容 -> {fp}')
