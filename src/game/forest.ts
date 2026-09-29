import { hash2 } from './rng';

/**
 * The forest is a deterministic function of position, so the sim and the
 * renderer agree without either storing it. The map is cut into chunks of
 * five by five cells; each chunk rolls a pattern: open scatter, a wall
 * with one gap, or a pocket, three sides of trunks and one side open, the
 * dead end that traps a player who backs into it. Wall cells hold three
 * trunks in a line, close enough that nothing walks between them.
 *
 * Trees block the player only. Enemies walk through them: a pocket has to
 * fill from every side, or it would be a shelter instead of a trap.
 */
export const CELL = 96;
export const CHUNK = 5;
export const TREE_R = 13;
export const CANOPY_R = 36;
/** no trees this close to the start, so the first minute has room */
const CLEARING = 170;

export type FeatureKind = 'tree' | 'mushroom' | 'stump' | 'stone' | 'bush' | 'log' | 'tuft';

export interface Feature {
  kind: FeatureKind;
  x: number;
  y: number;
  cx: number;
  cy: number;
}

type Pattern = 'open' | 'wallH' | 'wallV' | 'pocketN' | 'pocketS' | 'pocketE' | 'pocketW';
const PATTERNS: Pattern[] = ['open', 'open', 'open', 'open', 'wallH', 'wallV', 'pocketN', 'pocketS', 'pocketE', 'pocketW', 'open', 'pocketN', 'pocketW'];
const SCATTER: FeatureKind[] = ['tuft', 'tuft', 'stone', 'bush', 'mushroom', 'stump', 'log', 'tuft', 'stone', 'tree', 'bush', 'tuft'];

function pattern(chx: number, chy: number): { p: Pattern; gap: number } {
  if (chx === 0 && chy === 0) return { p: 'open', gap: 0 };
  return { p: PATTERNS[Math.floor(hash2(chx, chy, 91) * PATTERNS.length)], gap: 1 + Math.floor(hash2(chx, chy, 92) * 3) };
}

/** Which axes carry a wall in this cell: 'h', 'v', both or none. */
function wallsAt(cx: number, cy: number): { h: boolean; v: boolean } {
  const chx = Math.floor(cx / CHUNK);
  const chy = Math.floor(cy / CHUNK);
  const lx = cx - chx * CHUNK;
  const ly = cy - chy * CHUNK;
  const { p, gap } = pattern(chx, chy);
  switch (p) {
    case 'wallH':
      return { h: ly === 2 && lx !== gap, v: false };
    case 'wallV':
      return { h: false, v: lx === 2 && ly !== gap };
    case 'pocketN': // open to the north: walls west, east, south of the 3x3 middle
      return { h: ly === 3 && lx >= 1 && lx <= 3, v: (lx === 1 || lx === 3) && ly >= 1 && ly <= 3 };
    case 'pocketS':
      return { h: ly === 1 && lx >= 1 && lx <= 3, v: (lx === 1 || lx === 3) && ly >= 1 && ly <= 3 };
    case 'pocketE':
      return { h: (ly === 1 || ly === 3) && lx >= 1 && lx <= 3, v: lx === 1 && ly >= 1 && ly <= 3 };
    case 'pocketW':
      return { h: (ly === 1 || ly === 3) && lx >= 1 && lx <= 3, v: lx === 3 && ly >= 1 && ly <= 3 };
    default:
      return { h: false, v: false };
  }
}

const cache = new Map<number, Feature[]>();

export function cellKey(cx: number, cy: number): number {
  return (cx + 32768) * 65536 + (cy + 32768);
}

export function featuresInCell(cx: number, cy: number): Feature[] {
  const key = cellKey(cx, cy);
  const hit = cache.get(key);
  if (hit) return hit;
  const out: Feature[] = [];
  const x0 = cx * CELL;
  const y0 = cy * CELL;
  const w = wallsAt(cx, cy);
  const inClearing = (x: number, y: number) => x * x + y * y < CLEARING * CLEARING;
  if (w.h || w.v) {
    for (const f of [0.17, 0.5, 0.83]) {
      const jitter = (hash2(cx, cy, 93 + Math.round(f * 10)) - 0.5) * 8;
      if (w.h) out.push({ kind: 'tree', x: x0 + f * CELL, y: y0 + CELL / 2 + jitter, cx, cy });
      if (w.v && f !== 0.5) out.push({ kind: 'tree', x: x0 + CELL / 2 + jitter, y: y0 + f * CELL, cx, cy });
      if (w.v && !w.h && f === 0.5) out.push({ kind: 'tree', x: x0 + CELL / 2 + jitter, y: y0 + f * CELL, cx, cy });
    }
  } else if (hash2(cx, cy, 77) >= 0.3) {
    let kind = SCATTER[Math.floor(hash2(cx, cy, 78) * SCATTER.length)];
    const x = x0 + 16 + hash2(cx, cy, 79) * (CELL - 32);
    const y = y0 + 16 + hash2(cx, cy, 80) * (CELL - 32);
    if (kind === 'tree' && inClearing(x, y)) kind = 'tuft';
    // Fly agarics were a minefield at one in six scatter cells, about four
    // on screen at once (2026-09-29). One slot and a further roll keeps it
    // to about one in view: a thing to walk around, not a carpet.
    if (kind === 'mushroom' && hash2(cx, cy, 81) >= 0.4) kind = 'tuft';
    out.push({ kind, x, y, cx, cy });
  }
  const result = out.filter((f) => f.kind !== 'tree' || !inClearing(f.x, f.y));
  if (cache.size > 4000) cache.clear();
  cache.set(key, result);
  return result;
}

/** Calls fn for every feature whose cell touches the circle. */
export function featuresNear(x: number, y: number, r: number, fn: (f: Feature) => void): void {
  const x0 = Math.floor((x - r) / CELL);
  const x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL);
  const y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const fs = featuresInCell(cx, cy);
      for (let i = 0; i < fs.length; i++) fn(fs[i]);
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
