import { hash2 } from './rng';

/**
 * The forest is a deterministic function of position: one feature per
 * 96-unit cell, decided by a hash, so the sim and the renderer see the same
 * trees without either storing them. Trees block the player and the
 * enemies (trunk radius TREE_R); red mushrooms are eaten by walking on
 * them; the rest is decoration.
 */
export const CELL = 96;
export const TREE_R = 13;
export const CANOPY_R = 36;
/** no trees this close to the start, so the first minute has room */
const CLEARING = 150;

export type FeatureKind = 'tree' | 'mushroom' | 'stump' | 'stone' | 'bush' | 'log' | 'tuft';

export interface Feature {
  kind: FeatureKind;
  x: number;
  y: number;
  cx: number;
  cy: number;
}

const KINDS: FeatureKind[] = ['tree', 'tree', 'tree', 'tuft', 'tuft', 'stone', 'bush', 'mushroom', 'stump', 'log', 'tree', 'tuft', 'mushroom', 'bush'];

export function featureAt(cx: number, cy: number): Feature | null {
  const r = hash2(cx, cy, 77);
  if (r < 0.3) return null;
  let kind = KINDS[Math.floor(hash2(cx, cy, 78) * KINDS.length)];
  const x = cx * CELL + 16 + hash2(cx, cy, 79) * (CELL - 32);
  const y = cy * CELL + 16 + hash2(cx, cy, 80) * (CELL - 32);
  if (kind === 'tree' && x * x + y * y < CLEARING * CLEARING) kind = 'tuft';
  return { kind, x, y, cx, cy };
}

export function cellKey(cx: number, cy: number): number {
  return (cx + 32768) * 65536 + (cy + 32768);
}

/** Calls fn for every feature whose cell touches the circle. */
export function featuresNear(x: number, y: number, r: number, fn: (f: Feature) => void): void {
  const x0 = Math.floor((x - r) / CELL);
  const x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL);
  const y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const f = featureAt(cx, cy);
      if (f) fn(f);
    }
  }
}

/** Push a circle out of any trunk it overlaps. Returns true when moved. */
export function collideTrees(pos: { x: number; y: number }, radius: number): boolean {
  let moved = false;
  featuresNear(pos.x, pos.y, radius + TREE_R + 2, (f) => {
    if (f.kind !== 'tree') return;
    const dx = pos.x - f.x;
    const dy = pos.y - f.y;
    const min = radius + TREE_R;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) return;
    const d = Math.sqrt(d2) || 0.001;
    pos.x = f.x + (dx / d) * min;
    pos.y = f.y + (dy / d) * min;
    moved = true;
  });
  return moved;
}
