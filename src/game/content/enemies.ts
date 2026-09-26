import type { EnemyDef } from '../types';

const def = (d: Omit<EnemyDef, 'scale'> & { scale?: number }): EnemyDef => ({ scale: 1, ...d });

/**
 * The cast. HP and damage here are for minute 0; the director scales them
 * with time and curse. Speed is world units per second (the player walks 95).
 */
export const ENEMIES = {
  hyttynen: def({ id: 'hyttynen', name: 'Hyttynen', hp: 3, speed: 62, damage: 1, xp: 1, radius: 5, kbResist: 0, behaviour: 'swarm', sprite: 'mosquito' }),
  makara: def({ id: 'makara', name: 'Mäkärä', hp: 2, speed: 76, damage: 1, xp: 1, radius: 4, kbResist: 0, behaviour: 'swarm', sprite: 'blackfly', scale: 0.8 }),
  punkki: def({ id: 'punkki', name: 'Punkki', hp: 28, speed: 26, damage: 4, xp: 4, radius: 7, kbResist: 0.5, behaviour: 'stick', sprite: 'tick' }),
  paarma: def({ id: 'paarma', name: 'Paarma', hp: 16, speed: 55, damage: 5, xp: 3, radius: 7, kbResist: 0.1, behaviour: 'dash', sprite: 'horsefly' }),
  menninkainen: def({ id: 'menninkainen', name: 'Menninkäinen', hp: 48, speed: 52, damage: 6, xp: 8, radius: 10, kbResist: 0.2, behaviour: 'chase', sprite: 'gnome' }),
  hirvikarpanen: def({ id: 'hirvikarpanen', name: 'Hirvikärpänen', hp: 24, speed: 78, damage: 3, xp: 4, radius: 6, kbResist: 0.2, behaviour: 'stick', sprite: 'moosefly' }),
  muurahainen: def({ id: 'muurahainen', name: 'Muurahainen', hp: 9, speed: 105, damage: 2, xp: 2, radius: 5, kbResist: 0, behaviour: 'chase', sprite: 'ant' }),
  peikko: def({ id: 'peikko', name: 'Peikko', hp: 170, speed: 34, damage: 14, xp: 20, radius: 16, kbResist: 0.8, behaviour: 'chase', sprite: 'troll', scale: 1.6 }),
  hiisi: def({ id: 'hiisi', name: 'Hiisi', hp: 130, speed: 82, damage: 10, xp: 18, radius: 11, kbResist: 0.4, behaviour: 'chase', sprite: 'hiisi', scale: 1.2 }),
  liekkio: def({ id: 'liekkio', name: 'Liekkiö', hp: 70, speed: 98, damage: 8, xp: 12, radius: 9, kbResist: 0.3, behaviour: 'phase', sprite: 'wisp' }),
  ampiainen: def({ id: 'ampiainen', name: 'Ampiainen', hp: 40, speed: 72, damage: 8, xp: 7, radius: 7, kbResist: 0.2, behaviour: 'dash', sprite: 'wasp' }),
  kaarme: def({ id: 'kaarme', name: 'Kyy', hp: 90, speed: 48, damage: 15, xp: 14, radius: 9, kbResist: 0.6, behaviour: 'chase', sprite: 'viper', scale: 1.1 }),
  gufihtar: def({ id: 'gufihtar', name: 'Gufihtar', hp: 60, speed: 60, damage: 7, xp: 10, radius: 9, kbResist: 0.3, behaviour: 'chase', sprite: 'gufihtar' }),
  cahceravga: def({ id: 'cahceravga', name: 'Čáhcerávga', hp: 110, speed: 66, damage: 14, xp: 16, radius: 11, kbResist: 0.5, behaviour: 'dash', sprite: 'ravga', scale: 1.2 }),
  // bosses
  otso: def({ id: 'otso', name: 'Otso', hp: 1300, speed: 52, damage: 25, xp: 200, radius: 26, kbResist: 1, behaviour: 'boss', sprite: 'bear', scale: 1.8 }),
  nakki: def({ id: 'nakki', name: 'Näkki', hp: 3200, speed: 70, damage: 28, xp: 350, radius: 22, kbResist: 1, behaviour: 'boss', sprite: 'nakki', scale: 2.0 }),
  stallu: def({ id: 'stallu', name: 'Stállu', hp: 4200, speed: 52, damage: 34, xp: 420, radius: 30, kbResist: 1, behaviour: 'boss', sprite: 'stallu', scale: 2.4 }),
  ajattara: def({ id: 'ajattara', name: 'Ajattara', hp: 5500, speed: 64, damage: 30, xp: 500, radius: 22, kbResist: 1, behaviour: 'boss', sprite: 'ajattara', scale: 2.0 }),
  // Tuoni, death itself: unkillable, faster than any build, no drops. One
  // at minute 28 and one more every minute from thirty, so the endless
  // run ends. hurt() refuses to damage it.
  tuoni: def({ id: 'tuoni', name: 'Tuoni', hp: 1e12, speed: 135, damage: 70, xp: 0, radius: 20, kbResist: 1, behaviour: 'phase', sprite: 'tuoni', scale: 2.2 }),
  ikuturso: def({ id: 'ikuturso', name: 'Iku-Turso', hp: 9000, speed: 50, damage: 40, xp: 800, radius: 32, kbResist: 1, behaviour: 'boss', sprite: 'turso', scale: 2.6 }),
} satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;

export const BOSS_ORDER: EnemyId[] = ['otso', 'nakki', 'stallu', 'ajattara', 'ikuturso'];
