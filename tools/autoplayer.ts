/**
 * A bot that plays a run headlessly: it walks away from the crowd, toward
 * berries when it is safe, and picks upgrades with a simple preference. Used
 * by `npm run balance` to see how long a run lasts and what kills it.
 * Not a good player. A human with a thumb does better; the bot gives a floor.
 */
import type { SimState } from '../src/game/state';
import { step, DT } from '../src/game/sim';
import { rollOffers, applyOffer, openChest, type Offer } from '../src/game/upgrades';
import { WEAPONS } from '../src/game/content/weapons';
import { Rng } from '../src/game/rng';

export interface BotOptions {
  /** how strongly it prefers weapons over passives, 0..1 */
  weaponBias: number;
  /** if set, the bot always takes these ids first when offered */
  wants?: string[];
}

export function botInput(s: SimState, rng: Rng, t: number): { dx: number; dy: number } {
  const p = s.player;
  // Imminent threat: enemies close enough to bite within a second.
  let tx = 0;
  let ty = 0;
  let threat = 0;
  for (const e of s.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    const dc = Math.sqrt(d2) || 1;
    const d = Math.max(6, dc - e.def.radius * e.scale - 9);
    if (d > 140) continue;
    const w = ((e.boss ? 8 : e.elite ? 3 : 1) * 400) / (d * d);
    const dx2 = dx / dc;
    const dy2 = dy / dc;
    tx += dx2 * w;
    ty += dy2 * w;
    threat += w;
  }
  // Nearest pickup, else nearest berry.
  let gx = 0;
  let gy = 0;
  let bd = Infinity;
  for (const k of s.pickups) {
    const d = Math.hypot(k.x - p.x, k.y - p.y);
    if (d < bd) {
      bd = d;
      gx = k.x;
      gy = k.y;
    }
  }
  if (bd === Infinity) {
    for (const g of s.gems) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < bd && d < 320) {
        bd = d;
        gx = g.x;
        gy = g.y;
      }
    }
  }
  const low = p.hp < s.stats.maxHp * 0.4;
  let dx = 0;
  let dy = 0;
  if (threat > 0) {
    const m = Math.hypot(tx, ty) || 1;
    const ax = tx / m;
    const ay = ty / m;
    // Kite: mostly sideways around the crowd, away when hurt or pressed.
    const away = Math.min(1.6, threat / 6) + (low ? 1 : 0);
    const side = Math.sin(t * 0.5) >= 0 ? 1 : -1;
    dx += ax * away - ay * side * 0.9;
    dy += ay * away + ax * side * 0.9;
  }
  if (bd < Infinity) {
    const pull = threat > 8 ? 0.25 : 1;
    dx += ((gx - p.x) / bd) * pull;
    dy += ((gy - p.y) / bd) * pull;
  }
  if (dx === 0 && dy === 0) {
    const a = t * 0.3 + rng.next() * 0.1;
    return { dx: Math.cos(a), dy: Math.sin(a) };
  }
  const mm = Math.hypot(dx, dy) || 1;
  return { dx: dx / mm, dy: dy / mm };
}

export function botPick(s: SimState, offers: Offer[], rng: Rng, o: BotOptions): Offer {
  if (o.wants) {
    for (const id of o.wants) {
      const f = offers.find((x) => x.id === id);
      if (f) return f;
    }
  }
  const score = (of: Offer): number => {
    let v = 1;
    if (of.kind === 'weapon') {
      v += o.weaponBias * 2;
      if (!of.isNew) v += 1.5; // deepen before widening
      if (of.isNew && s.weapons.length >= 4) v -= 2;
    } else if (of.kind === 'passive') {
      v += (1 - o.weaponBias) * 2;
      // the passive that evolves an owned weapon
      if (s.weapons.some((w) => WEAPONS[w.id].evolvesWith === of.id)) v += 2;
      if (!of.isNew) v += 0.8;
      if (of.id === 'hiidenkirous') v -= 1.5;
    } else v -= 1;
    return Math.max(0.1, v);
  };
  return rng.weighted(offers, score);
}

export interface RunReport {
  seed: number;
  character: string;
  time: number;
  level: number;
  kills: number;
  chests: number;
  bosses: number;
  weapons: string;
  passives: string;
  dmgTaken: number;
  dmgDealt: number;
  maxEnemies: number;
  msPerMinute: number;
  killer: string;
}

export function playRun(s: SimState, maxMinutes: number, o: BotOptions): RunReport {
  const rng = new Rng(s.seed ^ 0x5151);
  let maxEnemies = 0;
  let killer = '';
  const t0 = Date.now();
  while (!s.gameOver && s.time < maxMinutes * 60) {
    step(s, botInput(s, rng, s.time), DT);
    while (s.pendingLevelUps > 0) {
      s.pendingLevelUps--;
      applyOffer(s, botPick(s, rollOffers(s), rng, o));
    }
    while (s.pendingChests > 0) {
      s.pendingChests--;
      openChest(s);
    }
    if (s.enemies.length > maxEnemies) maxEnemies = s.enemies.length;
    if (s.gameOver) {
      const counts: Record<string, number> = {};
      for (const e of s.enemies) if (Math.hypot(e.x - s.player.x, e.y - s.player.y) < 40) counts[e.def.name] = (counts[e.def.name] ?? 0) + 1;
      killer = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([k, v]) => `${k}x${v}`)
        .join(' ');
    }
  }
  const ms = Date.now() - t0;
  return {
    seed: s.seed,
    character: s.character.id,
    time: s.time,
    level: s.player.level,
    kills: s.run.kills,
    chests: s.run.chests,
    bosses: s.run.bosses,
    weapons: s.weapons.map((w) => `${w.id}${w.level}`).join(' '),
    passives: s.passives.map((p) => `${p.id}${p.level}`).join(' '),
    dmgTaken: s.run.damageTaken,
    dmgDealt: s.run.damageDealt,
    maxEnemies,
    msPerMinute: ms / Math.max(1, s.time / 60),
    killer,
  };
}
