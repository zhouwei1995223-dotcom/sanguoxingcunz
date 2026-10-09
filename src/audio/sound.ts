import { getPlatform } from '../platform';
import type { SoundHandle } from '../platform/types';
import { save } from '../meta/save';

// 音频管理：音效限频、背景音乐切换、前后台切换处理

export type Sfx =
  | 'click' | 'hit' | 'kill' | 'gem' | 'coin' | 'levelup' | 'evolve' | 'chest' | 'boss' | 'hurt'
  | 'explode' | 'thrust' | 'shoot' | 'horse' | 'fire' | 'victory' | 'defeat';
export type Bgm = 'bgm_home' | 'bgm_battle' | 'bgm_boss';

const SFX_LIST: Sfx[] = ['click', 'hit', 'kill', 'gem', 'coin', 'levelup', 'evolve', 'chest', 'boss', 'hurt', 'explode', 'thrust', 'shoot', 'horse', 'fire', 'victory', 'defeat'];
const MIN_GAP: Partial<Record<Sfx, number>> = { hit: 70, kill: 60, gem: 50, coin: 60, thrust: 90, shoot: 90, fire: 200 };
const VOLUME: Partial<Record<Sfx, number>> = { hit: 0.35, kill: 0.4, gem: 0.35, coin: 0.5, thrust: 0.35, shoot: 0.3, fire: 0.4 };

const sounds: Partial<Record<Sfx, SoundHandle>> = {};
const lastPlay: Partial<Record<Sfx, number>> = {};
const bgms: Partial<Record<Bgm, SoundHandle>> = {};
let currentBgm: Bgm | null = null;
let hidden = false;

const base = () => (getPlatform().name === 'web' ? 'assets/audio/' : 'assets/audio/');

export function initAudio() {
  const p = getPlatform();
  for (const s of SFX_LIST) {
    sounds[s] = p.createSound(base() + 'sfx_' + s + '.mp3', false);
    sounds[s]!.setVolume(VOLUME[s] ?? 0.7);
  }
  p.onHide(() => {
    hidden = true;
    if (currentBgm) bgms[currentBgm]?.stop();
  });
  p.onShow(() => {
    hidden = false;
    if (currentBgm && save.settings.music) bgms[currentBgm]?.play();
  });
}

export function playSfx(s: Sfx) {
  if (!save.settings.sfx || hidden) return;
  const now = getPlatform().now();
  const gap = MIN_GAP[s] ?? 30;
  if (now - (lastPlay[s] || 0) < gap) return;
  lastPlay[s] = now;
  sounds[s]?.play();
}

export function playBgm(b: Bgm | null) {
  if (currentBgm === b) {
    if (b && save.settings.music && !hidden) bgms[b]?.play();
    return;
  }
  if (currentBgm) bgms[currentBgm]?.stop();
  currentBgm = b;
  if (!b) return;
  if (!bgms[b]) {
    bgms[b] = getPlatform().createSound(base() + b + '.mp3', true);
    bgms[b]!.setVolume(0.5);
  }
  if (save.settings.music && !hidden) bgms[b]!.play();
}

export function refreshMusic() {
  if (!currentBgm) return;
  if (save.settings.music) bgms[currentBgm]?.play();
  else bgms[currentBgm]?.stop();
}

/** 浏览器需要用户交互后才能播放音频 */
export function unlockAudio() {
  if (currentBgm && save.settings.music) bgms[currentBgm]?.play();
}

let lastVibrate = 0;
export function vibrate(long = false) {
  if (!save.settings.vibrate) return;
  const p = getPlatform();
  const now = p.now();
  if (!long && now - lastVibrate < 120) return;
  lastVibrate = now;
  if (long) p.vibrateLong(); else p.vibrateShort();
}
