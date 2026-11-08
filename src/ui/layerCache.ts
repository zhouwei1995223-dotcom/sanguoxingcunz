import { getPlatform } from '../platform';

/**
 * 静态图层缓存：把每帧都一样的背景（渐变、宣纸纹理、远山、点苔……）画进离屏画布，之后 1:1 贴图。
 * key 变了（屏幕尺寸、缩放、布局位置）才重画。1:1 贴图不经过缩放，手机上不会糊。
 */
const layers = new Map<string, { key: string; canvas: HTMLCanvasElement }>();

export function cachedLayer(name: string, key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  const full = `${key}|${w}x${h}`;
  let e = layers.get(name);
  if (!e || e.key !== full) {
    const canvas = e && e.canvas.width === w && e.canvas.height === h ? e.canvas : getPlatform().createCanvas(w, h);
    const g = canvas.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = false;
    paint(g);
    e = { key: full, canvas };
    layers.set(name, e);
  }
  return e.canvas;
}
