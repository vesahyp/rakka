import type { SimState, Hero } from './state';
import { BASE_STATS, applyDelta, type Stats } from './stats';
import { PASSIVES, MAX_PASSIVES } from './content/passives';
import { WEAPONS, BASE_WEAPON_IDS, MAX_WEAPONS, weaponMaxLevel } from './content/weapons';
import { POWERS, POWER_IDS, MAX_POWERS, POWER_FROM_LEVEL } from './content/powers';
import { t, tr } from '../i18n';

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

/** Rebuild a hero's derived stats from character, altar and passives. Called after any change. */
export function computeStats(s: SimState, h: Hero): void {
  const st: Stats = { ...BASE_STATS };
  applyDelta(st, h.character.stats);
  applyDelta(st, s.meta);
  for (const p of h.passives) {
    const def = PASSIVES[p.id];
    for (let i = 0; i < p.level; i++) applyDelta(st, def.perLevel);
  }
  for (const p of h.powers) {
    const def = POWERS[p.id];
    if (def.stats) for (let i = 0; i < p.level; i++) applyDelta(st, def.stats);
  }
  st.maxHp = Math.max(20, st.maxHp);
  st.moveSpeed = Math.max(0.4, st.moveSpeed);
  st.cooldown = Math.max(0.2, st.cooldown);
  const oldMax = h.stats.maxHp;
  h.stats = st;
  // Raising max HP raises current HP by the same amount, so a Pakuri pick is
  // felt at once. Lowering never kills.
  if (st.maxHp > oldMax) h.player.hp = Math.min(st.maxHp, h.player.hp + (st.maxHp - oldMax));
  h.player.hp = Math.min(h.player.hp, st.maxHp);
}

export function ownedWeapon(h: Hero, id: string) {
  return h.weapons.find((w) => w.id === id);
}
export function ownedPassive(h: Hero, id: string) {
  return h.passives.find((p) => p.id === id);
}
export function powerLevel(h: Hero, id: string): number {
  const p = h.powers.find((p) => p.id === id);
  return p ? p.level : 0;
}

function powerOffer(h: Hero, id: string): Offer {
  const def = POWERS[id];
  const lvl = powerLevel(h, id);
  return {
    kind: 'power',
    id,
    name: t(def.name),
    desc: t(def.desc),
    levelText: lvl ? t(def.levelText) : tr('Uusi taika', 'New charm'),
    level: lvl + 1,
    maxLevel: def.maxLevel,
    isNew: lvl === 0,
    icon: def.icon,
  };
}

function weaponOffer(h: Hero, id: string): Offer {
  const def = WEAPONS[id];
  const w = ownedWeapon(h, id);
  const level = w ? w.level + 1 : 1;
  return {
    kind: 'weapon',
    id,
    name: t(def.name),
    desc: t(def.desc),
    levelText: w ? t(def.levels[w.level - 1].text) : tr('Uusi ase', 'New weapon'),
    level,
    maxLevel: weaponMaxLevel(def),
    isNew: !w,
    icon: def.icon,
  };
}

function passiveOffer(h: Hero, id: string): Offer {
  const def = PASSIVES[id];
  const p = ownedPassive(h, id);
  return {
    kind: 'passive',
    id,
    name: t(def.name),
    desc: t(def.desc),
    levelText: p ? t(def.levelText) : tr('Uusi esine', 'New item'),
    level: p ? p.level + 1 : 1,
    maxLevel: def.maxLevel,
    isNew: !p,
    icon: def.icon,
  };
}

const healOffer = (): Offer => ({ kind: 'heal', id: 'kanttarelli', name: tr('Kanttarelli', 'Chanterelle'), desc: tr('Parantaa 30 elinvoimaa.', 'Heals 30 health.'), levelText: '', level: 0, maxLevel: 0, isNew: false, icon: 'kanttarelli' });
const goldOffer = (): Offer => ({ kind: 'gold', id: 'marjat', name: tr('Kourallinen lakkoja', 'A handful of cloudberries'), desc: tr('Kokemusta heti.', 'Experience right now.'), levelText: '', level: 0, maxLevel: 0, isNew: false, icon: 'lakka' });

interface Candidate {
  offer: Offer;
  weight: number;
}

function candidates(h: Hero): Candidate[] {
  const out: Candidate[] = [];
  for (const w of h.weapons) {
    const def = WEAPONS[w.id];
    if (!def.evolved && w.level < weaponMaxLevel(def)) out.push({ offer: weaponOffer(h, w.id), weight: def.rarity * 1.3 });
  }
  if (h.weapons.length < MAX_WEAPONS) {
    for (const id of BASE_WEAPON_IDS) {
      if (!ownedWeapon(h, id)) out.push({ offer: weaponOffer(h, id), weight: WEAPONS[id].rarity * 0.8 });
    }
  }
  for (const p of h.passives) {
    const def = PASSIVES[p.id];
    if (p.level < def.maxLevel) out.push({ offer: passiveOffer(h, p.id), weight: def.rarity * 1.3 });
  }
  if (h.passives.length < MAX_PASSIVES) {
    for (const id of Object.keys(PASSIVES)) {
      if (!ownedPassive(h, id)) {
        // The passive that evolves an owned weapon is a little more likely,
        // so a build finds its evolution without knowing the table.
        const pairs = h.weapons.some((w) => WEAPONS[w.id].evolvesWith === id) ? 1.5 : 1;
        out.push({ offer: passiveOffer(h, id), weight: PASSIVES[id].rarity * 0.7 * pairs });
      }
    }
  }
  // Taiat: rare early, common once the slotted items have nothing left to
  // level, so the late cards are choices and not heals.
  if (h.player.level >= POWER_FROM_LEVEL) {
    const slotted = out.length;
    const boost = slotted === 0 ? 4 : slotted <= 3 ? 1.6 : 0.45;
    for (const id of POWER_IDS) {
      const lvl = powerLevel(h, id);
      if (lvl >= POWERS[id].maxLevel) continue;
      if (lvl === 0 && h.powers.length >= MAX_POWERS) continue;
      out.push({ offer: powerOffer(h, id), weight: POWERS[id].rarity * boost * (lvl ? 1.2 : 1) });
    }
  }
  return out;
}

/** Three cards, four with luck or Väinön viisaus. */
export function rollOffers(s: SimState, h: Hero): Offer[] {
  const pool = candidates(h);
  // Rerolls refill to the Arpakivi total at every level-up.
  h.stats.reroll = 2 * powerLevel(h, 'arpakivi');
  const count = powerLevel(h, 'vainonviisaus') > 0 || s.rng.chance(Math.min(0.5, (h.stats.luck - 1) * 0.6)) ? 4 : 3;
  const picked: Offer[] = [];
  while (picked.length < count && pool.length > 0) {
    const c = s.rng.weighted(pool, (x) => x.weight);
    picked.push(c.offer);
    pool.splice(pool.indexOf(c), 1);
  }
  if (picked.length === 0) return [healOffer(), goldOffer()];
  return picked;
}

export function applyOffer(s: SimState, h: Hero, o: Offer): void {
  switch (o.kind) {
    case 'weapon': {
      const w = ownedWeapon(h, o.id);
      if (w) w.level++;
      else h.weapons.push({ id: o.id, level: 1, cooldown: 0.2, burst: 0, burstTimer: 0, side: 1, active: 0 });
      break;
    }
    case 'passive': {
      const p = ownedPassive(h, o.id);
      if (p) p.level++;
      else h.passives.push({ id: o.id, level: 1 });
      computeStats(s, h);
      break;
    }
    case 'power': {
      const p = h.powers.find((p) => p.id === o.id);
      if (p) p.level++;
      else h.powers.push({ id: o.id, level: 1 });
      computeStats(s, h);
      break;
    }
    case 'heal':
      h.player.hp = Math.min(h.stats.maxHp, h.player.hp + 30);
      break;
    case 'gold':
      h.player.xp += Math.round(h.player.xpNext * 0.4);
      break;
    case 'evolve':
      break;
  }
}

/** The evolution an owned weapon is ready for, if any. */
export function readyEvolution(h: Hero): { from: string; to: string } | null {
  for (const w of h.weapons) {
    const def = WEAPONS[w.id];
    if (def.evolved || !def.evolvesTo || !def.evolvesWith) continue;
    if (w.level >= weaponMaxLevel(def) && ownedPassive(h, def.evolvesWith)) return { from: w.id, to: def.evolvesTo };
  }
  return null;
}

export function evolve(s: SimState, h: Hero, from: string, to: string): Offer {
  const w = ownedWeapon(h, from)!;
  w.id = to;
  w.level = 1;
  w.cooldown = 0;
  w.burst = 0;
  w.active = 0;
  // Zones of the old weapon (an aura) would otherwise keep ticking with old numbers.
  s.zones = s.zones.filter((z) => !(z.weapon === from && z.owner === h.index));
  const def = WEAPONS[to];
  return { kind: 'evolve', id: to, name: t(def.name), desc: t(def.desc), levelText: tr('Kehittyi!', 'Evolved!'), level: 1, maxLevel: 1, isNew: true, icon: def.icon };
}

export interface ChestResult {
  items: Offer[];
  /** 1, 3 or 5 */
  size: number;
  /** who opened it */
  hero: number;
}

/**
 * Open a chest for a hero. An evolution comes first when one is ready. The
 * rest are level-ups on owned items. When nothing can level, the slot pays
 * out as a heal.
 */
export function openChest(s: SimState, h: Hero): ChestResult {
  const luck = h.stats.luck;
  const roll = s.rng.next();
  const size = roll < 0.04 * luck ? 5 : roll < 0.2 * luck ? 3 : 1;
  const items: Offer[] = [];
  const evo = readyEvolution(h);
  if (evo) items.push(evolve(s, h, evo.from, evo.to));
  while (items.length < size) {
    const pool = candidates(h).filter((c) => !c.offer.isNew && c.offer.kind !== 'power');
    if (pool.length === 0) {
      const heal = healOffer();
      items.push(heal);
      applyOffer(s, h, heal);
      continue;
    }
    const c = s.rng.weighted(pool, (x) => x.weight);
    applyOffer(s, h, c.offer);
    items.push(c.offer);
  }
  s.run.chests++;
  return { items, size, hero: h.index };
}
