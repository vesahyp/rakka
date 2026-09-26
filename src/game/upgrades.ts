import type { SimState } from './state';
import { BASE_STATS, applyDelta, type Stats } from './stats';
import { PASSIVES, MAX_PASSIVES } from './content/passives';
import { WEAPONS, BASE_WEAPON_IDS, MAX_WEAPONS, weaponMaxLevel } from './content/weapons';
import { POWERS, POWER_IDS, MAX_POWERS, POWER_FROM_LEVEL } from './content/powers';

export interface Offer {
  kind: 'weapon' | 'passive' | 'power' | 'heal' | 'gold' | 'evolve';
  id: string;
  name: string;
  desc: string;
  /** what this level adds, or the item description for a new item */
  levelText: string;
  level: number;
  maxLevel: number;
  isNew: boolean;
  icon: string;
}

/** Rebuild derived stats from character and passives. Called after any change. */
export function computeStats(s: SimState): void {
  const st: Stats = { ...BASE_STATS };
  applyDelta(st, s.character.stats);
  applyDelta(st, s.meta);
  for (const p of s.passives) {
    const def = PASSIVES[p.id];
    for (let i = 0; i < p.level; i++) applyDelta(st, def.perLevel);
  }
  for (const p of s.powers) {
    const def = POWERS[p.id];
    if (def.stats) for (let i = 0; i < p.level; i++) applyDelta(st, def.stats);
  }
  st.maxHp = Math.max(20, st.maxHp);
  st.moveSpeed = Math.max(0.4, st.moveSpeed);
  st.cooldown = Math.max(0.2, st.cooldown);
  const oldMax = s.stats.maxHp;
  s.stats = st;
  // Raising max HP raises current HP by the same amount, so a Pakuri pick is
  // felt at once. Lowering never kills.
  if (st.maxHp > oldMax) s.player.hp = Math.min(st.maxHp, s.player.hp + (st.maxHp - oldMax));
  s.player.hp = Math.min(s.player.hp, st.maxHp);
}

export function ownedWeapon(s: SimState, id: string) {
  return s.weapons.find((w) => w.id === id);
}
export function ownedPassive(s: SimState, id: string) {
  return s.passives.find((p) => p.id === id);
}
export function powerLevel(s: SimState, id: string): number {
  const p = s.powers.find((p) => p.id === id);
  return p ? p.level : 0;
}

function powerOffer(s: SimState, id: string): Offer {
  const def = POWERS[id];
  const lvl = powerLevel(s, id);
  return {
    kind: 'power',
    id,
    name: def.name,
    desc: def.desc,
    levelText: lvl ? def.levelText : 'Uusi taika',
    level: lvl + 1,
    maxLevel: def.maxLevel,
    isNew: lvl === 0,
    icon: def.icon,
  };
}

function weaponOffer(s: SimState, id: string): Offer {
  const def = WEAPONS[id];
  const w = ownedWeapon(s, id);
  const level = w ? w.level + 1 : 1;
  return {
    kind: 'weapon',
    id,
    name: def.name,
    desc: def.desc,
    levelText: w ? def.levels[w.level - 1].text : 'Uusi ase',
    level,
    maxLevel: weaponMaxLevel(def),
    isNew: !w,
    icon: def.icon,
  };
}

function passiveOffer(s: SimState, id: string): Offer {
  const def = PASSIVES[id];
  const p = ownedPassive(s, id);
  return {
    kind: 'passive',
    id,
    name: def.name,
    desc: def.desc,
    levelText: p ? def.levelText : 'Uusi esine',
    level: p ? p.level + 1 : 1,
    maxLevel: def.maxLevel,
    isNew: !p,
    icon: def.icon,
  };
}

const HEAL_OFFER: Offer = { kind: 'heal', id: 'kanttarelli', name: 'Kanttarelli', desc: 'Parantaa 30 elinvoimaa.', levelText: '', level: 0, maxLevel: 0, isNew: false, icon: 'kanttarelli' };
const GOLD_OFFER: Offer = { kind: 'gold', id: 'marjat', name: 'Kourallinen lakkoja', desc: 'Kokemusta heti.', levelText: '', level: 0, maxLevel: 0, isNew: false, icon: 'lakka' };

interface Candidate {
  offer: Offer;
  weight: number;
}

function candidates(s: SimState): Candidate[] {
  const out: Candidate[] = [];
  for (const w of s.weapons) {
    const def = WEAPONS[w.id];
    if (!def.evolved && w.level < weaponMaxLevel(def)) out.push({ offer: weaponOffer(s, w.id), weight: def.rarity * 1.3 });
  }
  if (s.weapons.length < MAX_WEAPONS) {
    for (const id of BASE_WEAPON_IDS) {
      if (!ownedWeapon(s, id)) out.push({ offer: weaponOffer(s, id), weight: WEAPONS[id].rarity * 0.8 });
    }
  }
  for (const p of s.passives) {
    const def = PASSIVES[p.id];
    if (p.level < def.maxLevel) out.push({ offer: passiveOffer(s, p.id), weight: def.rarity * 1.3 });
  }
  if (s.passives.length < MAX_PASSIVES) {
    for (const id of Object.keys(PASSIVES)) {
      if (!ownedPassive(s, id)) {
        // The passive that evolves an owned weapon is a little more likely,
        // so a build finds its evolution without knowing the table.
        const pairs = s.weapons.some((w) => WEAPONS[w.id].evolvesWith === id) ? 1.5 : 1;
        out.push({ offer: passiveOffer(s, id), weight: PASSIVES[id].rarity * 0.7 * pairs });
      }
    }
  }
  // Taiat: rare early, common once the slotted items have nothing left to
  // level, so the late cards are choices and not heals.
  if (s.player.level >= POWER_FROM_LEVEL) {
    const slotted = out.length;
    const boost = slotted === 0 ? 4 : slotted <= 3 ? 1.6 : 0.45;
    for (const id of POWER_IDS) {
      const lvl = powerLevel(s, id);
      if (lvl >= POWERS[id].maxLevel) continue;
      if (lvl === 0 && s.powers.length >= MAX_POWERS) continue;
      out.push({ offer: powerOffer(s, id), weight: POWERS[id].rarity * boost * (lvl ? 1.2 : 1) });
    }
  }
  return out;
}

/** Three cards, four with luck or Väinön viisaus. */
export function rollOffers(s: SimState): Offer[] {
  const pool = candidates(s);
  // Rerolls refill to the Arpakivi total at every level-up.
  s.stats.reroll = 2 * powerLevel(s, 'arpakivi');
  const count = powerLevel(s, 'vainonviisaus') > 0 || s.rng.chance(Math.min(0.5, (s.stats.luck - 1) * 0.6)) ? 4 : 3;
  const picked: Offer[] = [];
  while (picked.length < count && pool.length > 0) {
    const c = s.rng.weighted(pool, (x) => x.weight);
    picked.push(c.offer);
    pool.splice(pool.indexOf(c), 1);
  }
  if (picked.length === 0) return [HEAL_OFFER, GOLD_OFFER];
  return picked;
}

export function applyOffer(s: SimState, o: Offer): void {
  switch (o.kind) {
    case 'weapon': {
      const w = ownedWeapon(s, o.id);
      if (w) w.level++;
      else s.weapons.push({ id: o.id, level: 1, cooldown: 0.2, burst: 0, burstTimer: 0, side: 1, active: 0 });
      break;
    }
    case 'passive': {
      const p = ownedPassive(s, o.id);
      if (p) p.level++;
      else s.passives.push({ id: o.id, level: 1 });
      computeStats(s);
      break;
    }
    case 'power': {
      const p = s.powers.find((p) => p.id === o.id);
      if (p) p.level++;
      else s.powers.push({ id: o.id, level: 1 });
      computeStats(s);
      break;
    }
    case 'heal':
      s.player.hp = Math.min(s.stats.maxHp, s.player.hp + 30);
      break;
    case 'gold':
      s.player.xp += Math.round(s.player.xpNext * 0.4);
      break;
    case 'evolve':
      break;
  }
}

/** The evolution an owned weapon is ready for, if any. */
export function readyEvolution(s: SimState): { from: string; to: string } | null {
  for (const w of s.weapons) {
    const def = WEAPONS[w.id];
    if (def.evolved || !def.evolvesTo || !def.evolvesWith) continue;
    if (w.level >= weaponMaxLevel(def) && ownedPassive(s, def.evolvesWith)) return { from: w.id, to: def.evolvesTo };
  }
  return null;
}

export function evolve(s: SimState, from: string, to: string): Offer {
  const w = ownedWeapon(s, from)!;
  w.id = to;
  w.level = 1;
  w.cooldown = 0;
  w.burst = 0;
  w.active = 0;
  // Zones of the old weapon (an aura) would otherwise keep ticking with old numbers.
  s.zones = s.zones.filter((z) => z.weapon !== from);
  const def = WEAPONS[to];
  return { kind: 'evolve', id: to, name: def.name, desc: def.desc, levelText: 'Kehittyi!', level: 1, maxLevel: 1, isNew: true, icon: def.icon };
}

export interface ChestResult {
  items: Offer[];
  /** 1, 3 or 5 */
  size: number;
}

/**
 * Open a chest. An evolution comes first when one is ready. The rest are
 * level-ups on owned items. When nothing can level, the slot pays out as a
 * heal.
 */
export function openChest(s: SimState): ChestResult {
  const luck = s.stats.luck;
  const roll = s.rng.next();
  const size = roll < 0.04 * luck ? 5 : roll < 0.2 * luck ? 3 : 1;
  const items: Offer[] = [];
  const evo = readyEvolution(s);
  if (evo) items.push(evolve(s, evo.from, evo.to));
  while (items.length < size) {
    const pool = candidates(s).filter((c) => !c.offer.isNew && c.offer.kind !== 'power');
    if (pool.length === 0) {
      items.push(HEAL_OFFER);
      applyOffer(s, HEAL_OFFER);
      continue;
    }
    const c = s.rng.weighted(pool, (x) => x.weight);
    applyOffer(s, c.offer);
    items.push(c.offer);
  }
  s.run.chests++;
  return { items, size };
}
