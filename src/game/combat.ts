import type { SimState } from './state';
import type { Enemy } from './types';

const MAX_TEXTS = 48;

export function sound(s: SimState, name: string): void {
  if (s.sounds.length < 64) s.sounds.push(name);
}

export function addText(s: SimState, x: number, y: number, text: string, color: string, big = false): void {
  if (s.texts.length >= MAX_TEXTS && !big) return;
  s.texts.push({ x, y: y - 10, text, life: 0.7, color, big });
}

/** Apply damage to an enemy. Knockback direction is (kx, ky), unit or zero. */
export function hurt(s: SimState, e: Enemy, dmg: number, kx: number, ky: number, kb: number): void {
  if (e.hp <= 0) return;
  const d = Math.max(1, Math.round(dmg));
  e.hp -= d;
  e.flash = 0.08;
  sound(s, 'hit');
  if (d < 9999) s.run.damageDealt += d;
  if (kb > 0 && e.def.kbResist < 1) {
    // The forest digs in: knockback loses a third by minute five and most
    // of its push by minute thirty, so a late crowd cannot be held off
    // with force alone.
    const f = (kb * (1 - e.def.kbResist) * 4) / (1 + s.minute / 10);
    e.kx += kx * f;
    e.ky += ky * f;
    // A knocked tick lets go.
    if (e.def.behaviour === 'stick') e.t2 = 0;
  }
  if (d < 9999 && s.texts.length < MAX_TEXTS) addText(s, e.x + (s.rng.next() - 0.5) * 10, e.y - e.def.radius * e.scale, String(d), e.boss || e.elite ? '#ffd166' : '#ffffff');
}

export function healPlayer(s: SimState, amount: number): void {
  if (amount <= 0 || !s.player.alive) return;
  const before = s.player.hp;
  s.player.hp = Math.min(s.stats.maxHp, s.player.hp + amount);
  const got = s.player.hp - before;
  if (got >= 1) addText(s, s.player.x, s.player.y - 14, `+${Math.round(got)}`, '#7bf07b');
}

export function slowEnemy(s: SimState, e: Enemy, slow: number, time: number): void {
  if (slow <= 0) return;
  // Slows fade with the minutes for the same reason as knockback.
  slow *= Math.max(0.35, 1 - s.minute / 45);
  if (slow >= e.slow || e.slowTime <= 0) {
    e.slow = slow;
    e.slowTime = time;
  }
}

export function nearestEnemy(s: SimState, x: number, y: number, maxDist: number, exclude?: Set<number>): Enemy | null {
  let best: Enemy | null = null;
  let bd = maxDist * maxDist;
  const es = s.enemies;
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (e.hp <= 0) continue;
    if (exclude && exclude.has(e.id)) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

export function onScreen(s: SimState, x: number, y: number, margin = 0): boolean {
  const hw = s.view.w / 2 + margin;
  const hh = s.view.h / 2 + margin;
  return Math.abs(x - s.player.x) <= hw && Math.abs(y - s.player.y) <= hh;
}
