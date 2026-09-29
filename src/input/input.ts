/**
 * Thumb sticks and the keyboard, one stick per player.
 *
 * A stick lives in a zone of the screen: the whole screen for one player,
 * the left and right halves for two (top and bottom in portrait). Two
 * modes, chosen by the player and remembered:
 *
 * - `float`: the point of first contact becomes the stick base and stays
 *   there until the finger lifts. The base never drags along after the
 *   finger: 2026-09-29 players found the old following base hard, because
 *   the direction was then only the last few pixels of thumb movement.
 * - `fixed`: the base sits at a fixed spot low in the zone and is drawn
 *   all the time. A touch that starts near it grabs it; other touches do
 *   nothing.
 *
 * The stick is read every sim step and drawn every frame by the game loop
 * (Game.tsx), not through React state.
 */
export interface Stick {
  active: boolean;
  /** base centre, css px */
  cx: number;
  cy: number;
  /** finger, css px */
  x: number;
  y: number;
  /** the fixed base for this zone, css px; drawn even when idle in fixed mode */
  baseX: number;
  baseY: number;
  touchId: number | null;
}

export type StickMode = 'float' | 'fixed';
const MODE_KEY = 'rakka.stick';

export function loadStickMode(): StickMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'fixed' ? 'fixed' : 'float';
  } catch {
    return 'float';
  }
}

export function saveStickMode(m: StickMode): void {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* private mode */
  }
}

/** Zone of the screen a player's touches belong to, css px. */
interface Zone {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const KEYS: string[][] = [
  ['a', 'd', 'w', 's'],
  ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'],
];

export class InputController {
  readonly sticks: Stick[] = [];
  /** full speed at this offset from the base, css px */
  readonly radius = 60;
  /** fixed mode: a touch this close to the base grabs it */
  readonly grab = 130;
  mode: StickMode = loadStickMode();
  private keys = new Set<string>();
  private zones: Zone[] = [];
  private el: HTMLElement | null = null;

  constructor(readonly players = 1) {
    for (let i = 0; i < players; i++) this.sticks.push({ active: false, cx: 0, cy: 0, x: 0, y: 0, baseX: 0, baseY: 0, touchId: null });
  }

  /** Recompute zones and fixed bases from the element's size. Call on resize. */
  layout(): void {
    const el = this.el;
    if (!el) return;
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;
    this.zones = [];
    if (this.players === 1) this.zones.push({ x0: 0, y0: 0, x1: w, y1: h });
    else if (w >= h) {
      this.zones.push({ x0: 0, y0: 0, x1: w / 2, y1: h });
      this.zones.push({ x0: w / 2, y0: 0, x1: w, y1: h });
    } else {
      // Portrait: the second player takes the top half. Landscape is the
      // intended way to hold a phone for two.
      this.zones.push({ x0: 0, y0: h / 2, x1: w, y1: h });
      this.zones.push({ x0: 0, y0: 0, x1: w, y1: h / 2 });
    }
    for (let i = 0; i < this.players; i++) {
      const z = this.zones[i];
      const st = this.sticks[i];
      // Low in the zone, a thumb's reach in from the corner. One player:
      // bottom centre-left, where a right thumb rests holding a phone.
      st.baseX = this.players === 1 ? Math.min(z.x0 + 110, (z.x0 + z.x1) / 2) : (z.x0 + z.x1) / 2;
      st.baseY = z.y1 - 120;
    }
  }

  private zoneOf(x: number, y: number): number {
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      if (x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1) return i;
    }
    return this.zones.length === 1 ? 0 : -1;
  }

  private onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (e.type === 'keydown') this.keys.add(k);
    else this.keys.delete(k);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  };

  private onTouchStart = (e: TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-ui]')) return;
    for (const t of Array.from(e.changedTouches)) {
      const i = this.zoneOf(t.clientX, t.clientY);
      if (i < 0) continue;
      const st = this.sticks[i];
      if (st.touchId !== null) continue;
      if (this.mode === 'fixed') {
        if (Math.hypot(t.clientX - st.baseX, t.clientY - st.baseY) > this.grab) continue;
        st.cx = st.baseX;
        st.cy = st.baseY;
      } else {
        st.cx = t.clientX;
        st.cy = t.clientY;
      }
      st.touchId = t.identifier;
      st.active = true;
      st.x = t.clientX;
      st.y = t.clientY;
    }
    e.preventDefault();
  };

  private onTouchMove = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      for (const st of this.sticks) {
        if (st.touchId !== t.identifier) continue;
        st.x = t.clientX;
        st.y = t.clientY;
      }
    }
    e.preventDefault();
  };

  private onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      for (const st of this.sticks) {
        if (st.touchId !== t.identifier) continue;
        st.touchId = null;
        st.active = false;
      }
    }
  };

  private onBlur = () => this.keys.clear();

  attach(el: HTMLElement): void {
    this.el = el;
    this.layout();
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    el.addEventListener('touchstart', this.onTouchStart, { passive: false });
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('touchend', this.onTouchEnd);
    el.addEventListener('touchcancel', this.onTouchEnd);
    window.addEventListener('blur', this.onBlur);
  }

  detach(el: HTMLElement): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    el.removeEventListener('touchstart', this.onTouchStart);
    el.removeEventListener('touchmove', this.onTouchMove);
    el.removeEventListener('touchend', this.onTouchEnd);
    el.removeEventListener('touchcancel', this.onTouchEnd);
    window.removeEventListener('blur', this.onBlur);
    this.el = null;
  }

  /** Direction for player i: unit-ish vector, length is the speed 0..1. */
  read(i = 0): { dx: number; dy: number } {
    const st = this.sticks[i];
    if (st.active) {
      const dx = (st.x - st.cx) / this.radius;
      const dy = (st.y - st.cy) / this.radius;
      const d = Math.hypot(dx, dy);
      // A small dead zone, then speed ramps to full at three quarters of
      // the radius. Direction is the direction, whatever the distance.
      if (d < 0.1) return { dx: 0, dy: 0 };
      const m = Math.min(1, (d - 0.1) / 0.65);
      return { dx: (dx / d) * m, dy: (dy / d) * m };
    }
    let dx = 0;
    let dy = 0;
    const k = this.keys;
    // One player answers to both sets; two players split them.
    const sets = this.players === 1 ? KEYS : [KEYS[i]];
    for (const [l, r, u, d] of sets) {
      if (k.has(l)) dx -= 1;
      if (k.has(r)) dx += 1;
      if (k.has(u)) dy -= 1;
      if (k.has(d)) dy += 1;
    }
    return { dx: Math.max(-1, Math.min(1, dx)), dy: Math.max(-1, Math.min(1, dy)) };
  }

  pressed(key: string): boolean {
    return this.keys.has(key);
  }
}
