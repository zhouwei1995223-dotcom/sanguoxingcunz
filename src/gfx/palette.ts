// 全局调色板（基于 Endesga 32 调整），像素图定义里用单个字符代表颜色。

export const PALETTE: Record<string, string> = {
  k: '#181425', // 描边 / 黑
  K: '#262b44',
  n: '#3a4466',
  N: '#5a6988',
  s: '#8b9bb4',
  S: '#c0cbdc',
  w: '#ffffff',
  r: '#a22633',
  R: '#e43b44',
  x: '#ff0044',
  o: '#f77622',
  y: '#feae34',
  Y: '#fee761',
  g: '#63c74d',
  G: '#3e8948',
  d: '#265c42',
  t: '#193c3e',
  b: '#124e89',
  B: '#0099db',
  c: '#2ce8f5',
  p: '#ead4aa',
  q: '#e4a672',
  u: '#b86f50',
  U: '#733e39',
  z: '#3e2731',
  m: '#68386c',
  M: '#b55088',
  f: '#f6757a',
  e: '#e8b796',
  E: '#c28569',
  l: '#be4a2f',
  L: '#d77643',
  // 扩展：半透明 / 特殊
  a: 'rgba(255,255,255,0.55)',
  A: 'rgba(44,232,245,0.6)',
  h: 'rgba(24,20,37,0.35)', // 阴影
};

export function hexToRgba(c: string): [number, number, number, number] {
  if (c.startsWith('rgba')) {
    const m = c.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/)!;
    return [+m[1], +m[2], +m[3], Math.round(+m[4] * 255)];
  }
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
}
