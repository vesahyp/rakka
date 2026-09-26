import type { Stats } from './types';
export type { Stats };

export const BASE_STATS: Stats = {
  maxHp: 100,
  regen: 0,
  armor: 0,
  moveSpeed: 1,
  might: 1,
  area: 1,
  speed: 1,
  duration: 1,
  cooldown: 1,
  amount: 0,
  magnet: 1,
  luck: 1,
  growth: 1,
  curse: 1,
  revives: 0,
  reroll: 0,
};

export type StatDelta = Partial<Stats>;

/** Additive for counts and flat values, multiplicative for the multipliers. */
export function applyDelta(s: Stats, d: StatDelta): void {
  for (const k of Object.keys(d) as (keyof Stats)[]) {
    const v = d[k]!;
    switch (k) {
      case 'maxHp':
      case 'regen':
      case 'armor':
      case 'amount':
      case 'revives':
      case 'reroll':
        s[k] += v;
        break;
      case 'cooldown':
        s.cooldown *= 1 - v;
        break;
      default:
        s[k] += v; // multipliers are stored as 1 + sum of bonuses
    }
  }
}

export function cloneStats(s: Stats): Stats {
  return { ...s };
}
