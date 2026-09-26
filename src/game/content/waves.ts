import type { EnemyId } from './enemies';

export interface SpawnEntry {
  type: EnemyId;
  /** spawns per second at curse 1 */
  rate: number;
  /** alive cap for this type at curse 1 */
  cap: number;
  /** chance a spawn is an elite, 0..1 */
  elite?: number;
}

export interface Wave {
  /** minute this wave begins; it lasts until the next wave's minute */
  at: number;
  spawns: SpawnEntry[];
}

/**
 * The first thirty minutes are authored. After the last entry the director
 * repeats the last five waves with a rising tier: more of everything, and
 * every roster member gets the endless HP curve (see sim.ts, enemyHpScale).
 */
export const WAVES: Wave[] = [
  { at: 0, spawns: [{ type: 'hyttynen', rate: 2.2, cap: 45 }] },
  { at: 1, spawns: [{ type: 'hyttynen', rate: 3.2, cap: 75 }, { type: 'punkki', rate: 0.3, cap: 8 }] },
  { at: 2, spawns: [{ type: 'hyttynen', rate: 3.5, cap: 80 }, { type: 'makara', rate: 2, cap: 50 }, { type: 'punkki', rate: 0.4, cap: 12 }] },
  { at: 3, spawns: [{ type: 'makara', rate: 3.5, cap: 80 }, { type: 'hyttynen', rate: 2.5, cap: 60 }, { type: 'punkki', rate: 0.6, cap: 16 }, { type: 'paarma', rate: 0.6, cap: 12 }] },
  { at: 4, spawns: [{ type: 'hyttynen', rate: 4.5, cap: 90 }, { type: 'paarma', rate: 1, cap: 20 }, { type: 'punkki', rate: 0.8, cap: 22 }, { type: 'menninkainen', rate: 0.6, cap: 12, elite: 0.05 }] },
  { at: 5, spawns: [{ type: 'makara', rate: 5.5, cap: 120 }, { type: 'menninkainen', rate: 1, cap: 18, elite: 0.05 }, { type: 'paarma', rate: 0.9, cap: 18 }] },
  { at: 6, spawns: [{ type: 'hirvikarpanen', rate: 2, cap: 40 }, { type: 'gufihtar', rate: 0.5, cap: 10, elite: 0.06 }, { type: 'punkki', rate: 0.8, cap: 24 }] },
  { at: 7, spawns: [{ type: 'muurahainen', rate: 4.5, cap: 100 }, { type: 'hirvikarpanen', rate: 1.5, cap: 30 }, { type: 'menninkainen', rate: 0.6, cap: 14 }] },
  { at: 8, spawns: [{ type: 'hyttynen', rate: 5, cap: 110 }, { type: 'peikko', rate: 0.25, cap: 4, elite: 0.1 }, { type: 'menninkainen', rate: 1, cap: 20, elite: 0.06 }] },
  { at: 9, spawns: [{ type: 'makara', rate: 5, cap: 110 }, { type: 'peikko', rate: 0.35, cap: 6, elite: 0.1 }, { type: 'paarma', rate: 1.2, cap: 24 }, { type: 'ampiainen', rate: 0.5, cap: 10 }] },
  { at: 10, spawns: [{ type: 'hirvikarpanen', rate: 3, cap: 60 }, { type: 'ampiainen', rate: 1, cap: 20, elite: 0.06 }, { type: 'peikko', rate: 0.35, cap: 7, elite: 0.12 }] },
  { at: 11, spawns: [{ type: 'muurahainen', rate: 6, cap: 130 }, { type: 'kaarme', rate: 0.4, cap: 8, elite: 0.1 }, { type: 'gufihtar', rate: 1.2, cap: 24, elite: 0.06 }] },
  { at: 12, spawns: [{ type: 'hiisi', rate: 0.6, cap: 10, elite: 0.1 }, { type: 'hyttynen', rate: 6, cap: 120 }, { type: 'punkki', rate: 1.2, cap: 30 }] },
  { at: 13, spawns: [{ type: 'hiisi', rate: 0.9, cap: 16, elite: 0.1 }, { type: 'ampiainen', rate: 1.5, cap: 30 }, { type: 'peikko', rate: 0.4, cap: 8 }] },
  { at: 14, spawns: [{ type: 'makara', rate: 7, cap: 140 }, { type: 'kaarme', rate: 0.7, cap: 14, elite: 0.1 }, { type: 'hiisi', rate: 0.8, cap: 14 }] },
  { at: 15, spawns: [{ type: 'liekkio', rate: 0.8, cap: 14, elite: 0.1 }, { type: 'hirvikarpanen', rate: 3, cap: 60 }, { type: 'peikko', rate: 0.5, cap: 10, elite: 0.12 }] },
  { at: 16, spawns: [{ type: 'liekkio', rate: 1.2, cap: 22 }, { type: 'hiisi', rate: 1, cap: 18, elite: 0.1 }, { type: 'muurahainen', rate: 6, cap: 130 }] },
  { at: 17, spawns: [{ type: 'paarma', rate: 2.5, cap: 50 }, { type: 'cahceravga', rate: 0.6, cap: 12, elite: 0.12 }, { type: 'peikko', rate: 0.7, cap: 14, elite: 0.15 }] },
  { at: 18, spawns: [{ type: 'hyttynen', rate: 9, cap: 170 }, { type: 'hiisi', rate: 1.3, cap: 24, elite: 0.12 }, { type: 'liekkio', rate: 1, cap: 18 }] },
  { at: 19, spawns: [{ type: 'ampiainen', rate: 2.5, cap: 50, elite: 0.08 }, { type: 'peikko', rate: 0.9, cap: 18, elite: 0.15 }, { type: 'kaarme', rate: 1.2, cap: 24 }] },
  { at: 20, spawns: [{ type: 'makara', rate: 10, cap: 190 }, { type: 'hiisi', rate: 1.6, cap: 30, elite: 0.14 }, { type: 'liekkio', rate: 1.4, cap: 26, elite: 0.1 }] },
  { at: 22, spawns: [{ type: 'muurahainen', rate: 9, cap: 170 }, { type: 'peikko', rate: 1.2, cap: 24, elite: 0.16 }, { type: 'cahceravga', rate: 1, cap: 20, elite: 0.14 }, { type: 'gufihtar', rate: 1.6, cap: 30 }] },
  { at: 24, spawns: [{ type: 'hirvikarpanen', rate: 5, cap: 100 }, { type: 'liekkio', rate: 2, cap: 36, elite: 0.14 }, { type: 'hiisi', rate: 2, cap: 36, elite: 0.16 }] },
  { at: 26, spawns: [{ type: 'hyttynen', rate: 12, cap: 220 }, { type: 'peikko', rate: 1.6, cap: 30, elite: 0.18 }, { type: 'ampiainen', rate: 3, cap: 60, elite: 0.1 }] },
  { at: 28, spawns: [{ type: 'kaarme', rate: 2.2, cap: 44, elite: 0.16 }, { type: 'hiisi', rate: 2.4, cap: 44, elite: 0.18 }, { type: 'liekkio', rate: 2.4, cap: 44, elite: 0.16 }, { type: 'makara', rate: 8, cap: 160 }] },
];

/** Scripted swarms: a ring closing in, or a column marching across. */
export interface SwarmEvent {
  atSeconds: number;
  kind: 'ring' | 'column';
  type: EnemyId;
  count: number;
}

export const SWARM_EVENTS: SwarmEvent[] = [
  { atSeconds: 50, kind: 'ring', type: 'hyttynen', count: 50 },
  { atSeconds: 110, kind: 'ring', type: 'hyttynen', count: 80 },
  { atSeconds: 210, kind: 'column', type: 'muurahainen', count: 50 },
  { atSeconds: 330, kind: 'ring', type: 'makara', count: 90 },
  { atSeconds: 450, kind: 'column', type: 'muurahainen', count: 80 },
  { atSeconds: 570, kind: 'ring', type: 'hirvikarpanen', count: 70 },
  { atSeconds: 690, kind: 'ring', type: 'hyttynen', count: 120 },
  { atSeconds: 810, kind: 'column', type: 'paarma', count: 40 },
  { atSeconds: 930, kind: 'ring', type: 'makara', count: 140 },
  { atSeconds: 1050, kind: 'column', type: 'muurahainen', count: 120 },
  { atSeconds: 1170, kind: 'ring', type: 'liekkio', count: 30 },
  { atSeconds: 1290, kind: 'ring', type: 'hyttynen', count: 180 },
  { atSeconds: 1410, kind: 'column', type: 'ampiainen', count: 60 },
  { atSeconds: 1530, kind: 'ring', type: 'hirvikarpanen', count: 120 },
  { atSeconds: 1650, kind: 'ring', type: 'makara', count: 200 },
];

/** Bosses arrive on these minutes, then every five minutes after the last. */
export const BOSS_MINUTES = [5, 10, 15, 20, 25, 30];
