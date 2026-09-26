/**
 * One thumb, or WASD and arrows. Touch anywhere: the point of first contact
 * becomes the stick centre and the finger's offset from it is the direction,
 * clamped to a radius. The stick floats, so the hand never has to find a
 * fixed control under the thumb.
 */
export interface Stick {
  active: boolean;
  /** screen px, css */
  cx: number;
  cy: number;
  x: number;
  y: number;
}

export class InputController {
  readonly stick: Stick = { active: false, cx: 0, cy: 0, x: 0, y: 0 };
  private keys = new Set<string>();
  private touchId: number | null = null;
  readonly radius = 44;
  private onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.type === 'keydown') this.keys.add(e.key.toLowerCase());
    else this.keys.delete(e.key.toLowerCase());
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
  };
  private onTouchStart = (e: TouchEvent) => {
    if (this.touchId !== null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    if ((e.target as HTMLElement).closest('[data-ui]')) return;
    this.touchId = t.identifier;
    this.stick.active = true;
    this.stick.cx = this.stick.x = t.clientX;
    this.stick.cy = this.stick.y = t.clientY;
    e.preventDefault();
  };
  private onTouchMove = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.touchId) continue;
      const dx = t.clientX - this.stick.cx;
      const dy = t.clientY - this.stick.cy;
      const d = Math.hypot(dx, dy);
      if (d > this.radius) {
        // Drag the centre along so a long swipe does not pin the stick far away.
        this.stick.cx = t.clientX - (dx / d) * this.radius;
        this.stick.cy = t.clientY - (dy / d) * this.radius;
      }
      this.stick.x = t.clientX;
      this.stick.y = t.clientY;
      e.preventDefault();
    }
  };
  private onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.touchId) continue;
      this.touchId = null;
      this.stick.active = false;
    }
  };

  attach(el: HTMLElement): void {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    el.addEventListener('touchstart', this.onTouchStart, { passive: false });
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('touchend', this.onTouchEnd);
    el.addEventListener('touchcancel', this.onTouchEnd);
    window.addEventListener('blur', () => this.keys.clear());
  }

  detach(el: HTMLElement): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    el.removeEventListener('touchstart', this.onTouchStart);
    el.removeEventListener('touchmove', this.onTouchMove);
    el.removeEventListener('touchend', this.onTouchEnd);
    el.removeEventListener('touchcancel', this.onTouchEnd);
  }

  read(): { dx: number; dy: number } {
    if (this.stick.active) {
      const dx = (this.stick.x - this.stick.cx) / this.radius;
      const dy = (this.stick.y - this.stick.cy) / this.radius;
      const d = Math.hypot(dx, dy);
      // A small dead zone, then full speed from about a third of the radius.
      if (d < 0.12) return { dx: 0, dy: 0 };
      const m = Math.min(1, (d - 0.12) / 0.5);
      return { dx: (dx / d) * m, dy: (dy / d) * m };
    }
    let dx = 0;
    let dy = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) dx -= 1;
    if (k.has('d') || k.has('arrowright')) dx += 1;
    if (k.has('w') || k.has('arrowup')) dy -= 1;
    if (k.has('s') || k.has('arrowdown')) dy += 1;
    return { dx, dy };
  }

  pressed(key: string): boolean {
    return this.keys.has(key);
  }
}
