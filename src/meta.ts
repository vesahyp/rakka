/**
 * Tapion pöytä: the stump altar where cones buy small permanent ranks of
 * base stats. Cones come from finished runs (time, kills, bosses) and
 * nothing else, so the altar is a slow, steady ease and not a second
 * economy. Everything bought is refundable at once. Stored on the device
 * beside the records.
 */
import type { StatDelta } from './game/stats';

export interface AltarItem {
  id: string;
  name: string;
  desc: string;
  ranks: number;
  /** cones for rank one; each further rank costs more */
  price: number;
  perRank: StatDelta;
  rankText: string;
  icon: string;
}

export const ALTAR: AltarItem[] = [
  { id: 'elinvoima', name: 'Elinvoima', desc: 'Paksumpi nahka.', ranks: 5, price: 12, perRank: { maxHp: 6 }, rankText: '+6 elinvoima', icon: 'pakuri' },
  { id: 'vahinko', name: 'Vahinko', desc: 'Terävämpi terä.', ranks: 5, price: 15, perRank: { might: 0.03 }, rankText: '+3 % vahinko', icon: 'terva' },
  { id: 'palautuminen', name: 'Palautuminen', desc: 'Haavat umpeutuvat.', ranks: 3, price: 18, perRank: { regen: 0.1 }, rankText: '+0.1 elinvoimaa/s', icon: 'hunaja' },
  { id: 'suoja', name: 'Suoja', desc: 'Osuma sattuu vähemmän.', ranks: 2, price: 32, perRank: { armor: 1 }, rankText: '+1 suoja', icon: 'karhunnahka' },
  { id: 'nopeus', name: 'Nopeus', desc: 'Kevyemmät jalat.', ranks: 3, price: 15, perRank: { moveSpeed: 0.03 }, rankText: '+3 % nopeus', icon: 'villasukat' },
  { id: 'alue', name: 'Alue', desc: 'Aseet ulottuvat kauemmas.', ranks: 3, price: 15, perRank: { area: 0.03 }, rankText: '+3 % alue', icon: 'kompassi' },
  { id: 'lataus', name: 'Latausaika', desc: 'Nopeampi käsi.', ranks: 3, price: 18, perRank: { cooldown: 0.02 }, rankText: '-2 % latausaika', icon: 'kahvipannu' },
  { id: 'onni', name: 'Onni', desc: 'Metsä suosii.', ranks: 3, price: 15, perRank: { luck: 0.05 }, rankText: '+5 % onni', icon: 'ketunhanta' },
  { id: 'kokemus', name: 'Kokemus', desc: 'Opit nopeammin.', ranks: 3, price: 15, perRank: { growth: 0.03 }, rankText: '+3 % kokemus', icon: 'riimukivi' },
  { id: 'keraysalue', name: 'Keräysalue', desc: 'Marjat lentävät kauempaa.', ranks: 3, price: 10, perRank: { magnet: 0.1 }, rankText: '+10 % keräysalue', icon: 'pihlaja' },
  { id: 'ylosnousemus', name: 'Ylösnousemus', desc: 'Yksi paluu toisesta maailmasta, joka pelissä.', ranks: 1, price: 160, perRank: { revives: 1 }, rankText: '+1 ylösnousemus', icon: 'sammonsiru' },
];

export interface Meta {
  cones: number;
  earned: number;
  ranks: Record<string, number>;
}

// v2: banks from the generous first day start over.
const KEY = 'rakka.meta.v2';

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { cones: 0, earned: 0, ranks: {}, ...JSON.parse(raw) };
  } catch {
    /* no storage: the altar is empty every visit */
  }
  return { cones: 0, earned: 0, ranks: {} };
}

function save(m: Meta): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* fine */
  }
}

/** Cones a finished run pays: the ones picked up in it, nothing else. */
export function conesForRun(r: { cones: number }): number {
  return r.cones;
}

export function earnCones(n: number): Meta {
  const m = loadMeta();
  m.cones += n;
  m.earned += n;
  save(m);
  return m;
}

export function rankPrice(item: AltarItem, rank: number): number {
  // rank is the one being bought, 1-based
  return Math.round(item.price * (1 + 0.8 * (rank - 1)));
}

export function buy(m: Meta, id: string): Meta | null {
  const item = ALTAR.find((a) => a.id === id);
  if (!item) return null;
  const have = m.ranks[id] ?? 0;
  if (have >= item.ranks) return null;
  const price = rankPrice(item, have + 1);
  if (m.cones < price) return null;
  const next = { ...m, cones: m.cones - price, ranks: { ...m.ranks, [id]: have + 1 } };
  save(next);
  return next;
}

export function refundAll(m: Meta): Meta {
  let back = 0;
  for (const item of ALTAR) {
    const have = m.ranks[item.id] ?? 0;
    for (let r = 1; r <= have; r++) back += rankPrice(item, r);
  }
  const next = { ...m, cones: m.cones + back, ranks: {} };
  save(next);
  return next;
}

/** The altar's bonuses as one stat delta for createState. */
export function metaStats(m: Meta): StatDelta {
  const out: Record<string, number> = {};
  for (const item of ALTAR) {
    const have = m.ranks[item.id] ?? 0;
    if (!have) continue;
    for (const [k, v] of Object.entries(item.perRank)) out[k] = (out[k] ?? 0) + v * have;
  }
  return out as StatDelta;
}
