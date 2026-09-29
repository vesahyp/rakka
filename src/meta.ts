/**
 * Tapion pöytä: the stump altar where cones buy small permanent ranks of
 * base stats. Cones come from finished runs (picked up in the forest) and
 * nothing else, so the altar is a slow, steady ease and not a second
 * economy. Everything bought is refundable at once. Stored on the device
 * beside the records.
 *
 * Every rank costs more than the one before it, on its own item and across
 * the whole table: the first few ranks are a week of play, the last ones a
 * season. The cones spent are kept in `spent` so a refund returns exactly
 * what went in, whatever order it was bought in.
 *
 * 2026-09-29: players reported the table resetting. Three causes, none of
 * them a write going wrong: the storage key changed on 2026-09-27 and the
 * old bank was left behind (now migrated, scaled down); Safari and a home
 * screen install keep separate storage on iOS, so the table looks empty
 * after "Lisää kotinäytölle" (the code below carries it over by hand); and
 * the refund confirm sat under the same thumb as the button (Altar.tsx).
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
  /** cones sitting in the ranks now; a refund returns this */
  spent: number;
}

const KEY = 'rakka.meta.v2';
/** The key before 2026-09-27, when the economy was fifty times richer. */
const OLD_KEY = 'rakka.meta.v1';
const OLD_SCALE = 1 / 10;

function empty(): Meta {
  return { cones: 0, earned: 0, ranks: {}, spent: 0 };
}

function parse(raw: string | null): Meta | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<Meta>;
    if (typeof j !== 'object' || j === null) return null;
    const m: Meta = { ...empty(), ...j, ranks: { ...(j.ranks ?? {}) } };
    // Before `spent` existed the refund was recomputed from the old linear
    // prices; carry that sum in so those ranks refund what they cost.
    if (j.spent === undefined) m.spent = legacySpent(m.ranks);
    return m;
  } catch {
    return null;
  }
}

function legacySpent(ranks: Record<string, number>): number {
  let sum = 0;
  for (const item of ALTAR) {
    const have = ranks[item.id] ?? 0;
    for (let r = 1; r <= have; r++) sum += Math.round(item.price * (1 + 0.8 * (r - 1)));
  }
  return sum;
}

export function loadMeta(): Meta {
  try {
    const cur = parse(localStorage.getItem(KEY));
    if (cur) return cur;
    // A bank from before the key change: its cones and its ranks' worth,
    // scaled to the current economy, as a fresh balance.
    const old = parse(localStorage.getItem(OLD_KEY));
    if (old) {
      const worth = old.cones + legacySpent(old.ranks);
      const m: Meta = { ...empty(), cones: Math.round(worth * OLD_SCALE), earned: Math.round(old.earned * OLD_SCALE) };
      save(m);
      try {
        localStorage.removeItem(OLD_KEY);
      } catch {
        /* fine */
      }
      return m;
    }
  } catch {
    /* no storage: the altar is empty every visit */
  }
  return empty();
}

function save(m: Meta): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* fine */
  }
  // Chrome and Firefox evict best-effort storage under pressure; asking
  // once for persistence takes this origin off that list.
  try {
    if (!persisted && navigator.storage?.persist) {
      persisted = true;
      void navigator.storage.persist();
    }
  } catch {
    /* fine */
  }
}
let persisted = false;

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

export function totalRanks(m: Meta): number {
  let n = 0;
  for (const v of Object.values(m.ranks)) n += v;
  return n;
}

/**
 * Price of the next rank: the item's base, times a ramp on its own rank,
 * times a ramp on every rank already on the table. The eleventh rank
 * bought costs about twice what it would have first; the thirtieth,
 * four and a half times.
 */
export function rankPrice(item: AltarItem, rank: number, owned: number): number {
  return Math.round(item.price * (1 + 0.8 * (rank - 1)) * (1 + 0.12 * owned));
}

export function buy(m: Meta, id: string): Meta | null {
  const item = ALTAR.find((a) => a.id === id);
  if (!item) return null;
  const have = m.ranks[id] ?? 0;
  if (have >= item.ranks) return null;
  const price = rankPrice(item, have + 1, totalRanks(m));
  if (m.cones < price) return null;
  const next: Meta = { ...m, cones: m.cones - price, spent: m.spent + price, ranks: { ...m.ranks, [id]: have + 1 } };
  save(next);
  return next;
}

export function refundAll(m: Meta): Meta {
  const next: Meta = { ...m, cones: m.cones + m.spent, spent: 0, ranks: {} };
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

// ---------------------------------------------------------------- the code
//
// The table as a short string a player can copy from one browser and paste
// into another: Safari and a home screen install do not share storage on
// iOS, and a cleared browser takes the table with it. Cones, then the
// ranks in table order, base 36, joined with dashes, a check digit on the
// end. Not a secret and not tamper proof: it is one player's own altar.

const RADIX = 36;

function checksum(parts: string): number {
  let h = 7;
  for (let i = 0; i < parts.length; i++) h = (h * 31 + parts.charCodeAt(i)) % 1296;
  return h;
}

export function exportCode(m: Meta): string {
  const body = [m.cones, m.spent, ...ALTAR.map((a) => m.ranks[a.id] ?? 0)].map((n) => Math.max(0, Math.round(n)).toString(RADIX)).join('-');
  return `${body}-${checksum(body).toString(RADIX).padStart(2, '0')}`.toUpperCase();
}

/** The table inside a code, or null when it is not one. */
export function importCode(code: string): Meta | null {
  const parts = code.trim().toLowerCase().split(/[-\s]+/);
  if (parts.length !== ALTAR.length + 3) return null;
  const check = parts.pop()!;
  const body = parts.join('-');
  if (checksum(body).toString(RADIX).padStart(2, '0') !== check) return null;
  const nums = parts.map((p) => parseInt(p, RADIX));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [cones, spent, ...ranks] = nums;
  const m: Meta = { ...empty(), cones, spent };
  ALTAR.forEach((a, i) => {
    const r = Math.min(a.ranks, ranks[i]);
    if (r > 0) m.ranks[a.id] = r;
  });
  m.earned = cones + spent;
  return m;
}

/** Replace the stored table with an imported one. */
export function adoptMeta(m: Meta): Meta {
  save(m);
  return m;
}
