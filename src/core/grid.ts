// 空间哈希：加速范围查询与碰撞（敌人数量多时必须）

export interface GridItem {
  x: number;
  y: number;
  r: number;
}

export class SpatialGrid<T extends GridItem> {
  private cells = new Map<number, T[]>();
  constructor(private size: number) {}

  private key(cx: number, cy: number) {
    return ((cx + 32768) << 16) | ((cy + 32768) & 0xffff);
  }

  clear() {
    this.cells.forEach((arr) => (arr.length = 0));
  }

  insert(it: T) {
    const k = this.key(Math.floor(it.x / this.size), Math.floor(it.y / this.size));
    let arr = this.cells.get(k);
    if (!arr) { arr = []; this.cells.set(k, arr); }
    arr.push(it);
  }

  /** 遍历以 (x,y) 为圆心、半径 r 的范围内可能相交的对象 */
  query(x: number, y: number, r: number, out: T[] = []): T[] {
    out.length = 0;
    const s = this.size;
    const x0 = Math.floor((x - r) / s), x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s), y1 = Math.floor((y + r) / s);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]);
      }
    return out;
  }
}
