import type { SimState, Hero } from './state';
import type { Enemy } from './types';
import { powerLevel } from './upgrades';

const MAX_TEXTS = 48;

export function sound(s: SimState, name: string): void {
  if (s.sounds.length < 64) s.sounds.push(name);
}

export function addText(s: SimState, x: number, y: number, text: string, color: string, big = false): void {
  if (s.texts.length >= MAX_TEXTS && !big) return;
  s.texts.push({ x, y: y - 10, text, life: 0.7, color, big });
}

/**
 * Apply damage to an enemy. Knockback direction is (kx, ky), unit or zero.
 * `h` is the hero whose weapon or taika did it: their taiat scale the hit
 * and their kill taiat fire when it lands. Null for a pickup like kekäle.
 */
export function hurt(s: SimState, h: Hero | null, e: Enemy, dmg: number, kx: number, ky: number, kb: number, source = 'muu'): void {
  if (e.hp <= 0) return;
  if (e.def.id === 'tuoni') {
    e.flash = 0.05;
    return;
  }
  let crit = false;
  if (dmg < 9999 && h) {
    dmg *= damageMultiplier(s, h);
    if (e.def.behaviour === 'swarm') dmg *= 1 + 0.25 * powerLevel(h, 'rakkatuuli');
    const cc = 0.1 * powerLevel(h, 'noidansilma');
    if (cc > 0 && s.rng.chance(cc)) {
      dmg *= 2;
      crit = true;
    }
    const slow = 0.15 * powerLevel(h, 'jaatavakosketus');
    if (slow > 0) slowEnemy(s, e, slow, 1);
  }
  const d = Math.max(1, Math.round(dmg));
  e.lastSource = source;
  e.lastOwner = h ? h.index : -1;
  e.hp -= d;
  e.flash = 0.08;
  sound(s, 'hit');
  if (d < 9999) {
    s.run.damageDealt += d;
    s.run.damageBy[source] = (s.run.damageBy[source] ?? 0) + d;
  }
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
  if (d < 9999 && s.texts.length < MAX_TEXTS) addText(s, e.x + (s.rng.next() - 0.5) * 10, e.y - e.def.radius * e.scale, String(d), crit ? '#ff8a3d' : e.boss || e.elite ? '#ffd166' : '#ffffff', crit);
}

/** Run-state multipliers from taiat: rage when hurt, running, souls eaten. */
export function damageMultiplier(s: SimState, h: Hero): number {
  let m = 1;
  const rage = powerLevel(h, 'karhunraivo');
  if (rage > 0 && h.player.hp < h.stats.maxHp * 0.35) m += 0.3 * rage;
  const run = powerLevel(h, 'juoksija');
  if (run > 0 && h.player.moving) m += 0.15 * run;
  const souls = powerLevel(h, 'sielunsyoja');
  if (souls > 0) m += Math.min(1000, s.run.kills) * 0.0002 * souls;
  return m;
}

export function healPlayer(s: SimState, h: Hero, amount: number): void {
  const p = h.player;
  if (amount <= 0 || !p.alive) return;
  const before = p.hp;
  p.hp = Math.min(h.stats.maxHp, p.hp + amount);
  const got = p.hp - before;
  if (got >= 1) addText(s, p.x, p.y - 14, `+${Math.round(got)}`, '#7bf07b');
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

/** Inside the camera's view, plus a margin. */
export function onScreen(s: SimState, x: number, y: number, margin = 0): boolean {
  const hw = s.view.w / 2 + margin;
  const hh = s.view.h / 2 + margin;
  return Math.abs(x - s.cam.x) <= hw && Math.abs(y - s.cam.y) <= hh;
}
