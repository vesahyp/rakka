import type { Enemy } from './types';

/**
 * Uniform grid over enemies, rebuilt every step. Cells are keyed by integer
 * coordinates packed into one number, so lookups are a Map get and no string
 * building happens in the hot loop.
 */
export class Grid {
  private cells = new Map<number, Enemy[]>();
  constructor(readonly size: number) {}

  clear(): void {
    this.cells.clear();
  }

  private key(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  insert(e: Enemy): void {
    const k = this.key(Math.floor(e.x / this.size), Math.floor(e.y / this.size));
    let c = this.cells.get(k);
    if (!c) {
      c = [];
      this.cells.set(k, c);
    }
    c.push(e);
  }

  /** Calls fn for every enemy whose cell touches the circle. Distance is not checked here. */
  query(x: number, y: number, r: number, fn: (e: Enemy) => void): void {
    const x0 = Math.floor((x - r) / this.size);
    const x1 = Math.floor((x + r) / this.size);
    const y0 = Math.floor((y - r) / this.size);
    const y1 = Math.floor((y + r) / this.size);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const c = this.cells.get(this.key(cx, cy));
        if (c) for (let i = 0; i < c.length; i++) fn(c[i]);
      }
    }
  }

  cellOf(e: Enemy): Enemy[] | undefined {
    return this.cells.get(this.key(Math.floor(e.x / this.size), Math.floor(e.y / this.size)));
  }
}
