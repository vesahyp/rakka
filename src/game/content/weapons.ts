export type Pattern =
  | 'throwFacing' // puukko: blades in the move direction
  | 'sweep' // vihta: melee arc alternating sides
  | 'zoneAtPlayer' // kokko: burning ground where you stand
  | 'ring' // kantele: expanding ring that pushes
  | 'strike' // ukonvasara: lightning on random enemies
  | 'aura' // kierukka: damage around the player
  | 'orbit' // sarvet: projectiles circling the player
  | 'lob' // kirves: thrown up, falls through the crowd
  | 'nearest' // jousi: arrows at the nearest enemy
  | 'lobExplode' // kiuas: stone that bursts into steam
  | 'bounce' // viima: line that bounces off the screen edge
  | 'trap' // verkko: slowing net ahead
  | 'spirit'; // rumpu: spirit animals that seek enemies

export interface WeaponNumbers {
  damage: number;
  amount: number;
  area: number;
  speed: number;
  duration: number;
  cooldown: number;
  pierce: number;
  knockback: number;
  /** seconds between shots inside one burst */
  interval: number;
  slow: number;
  heal: number;
}

export type Delta = Partial<WeaponNumbers>;

export interface WeaponDef {
  id: string;
  name: string;
  desc: string;
  pattern: Pattern;
  base: WeaponNumbers;
  /** levels 2..maxLevel, each a delta and its card text */
  levels: { text: string; d: Delta }[];
  evolvesWith?: string;
  evolvesTo?: string;
  evolved?: boolean;
  /** appears in the pool at all */
  rarity: number;
  icon: string;
  tint: string;
}

const base = (o: Partial<WeaponNumbers>): WeaponNumbers => ({
  damage: 10,
  amount: 1,
  area: 1,
  speed: 1,
  duration: 1,
  cooldown: 1,
  pierce: 1,
  knockback: 1,
  interval: 0.08,
  slow: 0,
  heal: 0,
  ...o,
});

const dmg = (n: number) => ({ text: `+${n} vahinko`, d: { damage: n } });
const amt = (n = 1) => ({ text: `+${n} ammus`, d: { amount: n } });
const area = (pct: number) => ({ text: `+${pct} % alue`, d: { area: pct / 100 } });
const cd = (s: number) => ({ text: `-${s} s latausaika`, d: { cooldown: -s } });
const pierce = (n: number) => ({ text: `+${n} läpäisy`, d: { pierce: n } });
const dur = (pct: number) => ({ text: `+${pct} % kesto`, d: { duration: pct / 100 } });
const spd = (pct: number) => ({ text: `+${pct} % nopeus`, d: { speed: pct / 100 } });
const kb = (n: number) => ({ text: 'Lisää tönäisyä', d: { knockback: n } });

export const WEAPONS: Record<string, WeaponDef> = {
  puukko: {
    id: 'puukko', name: 'Puukko', desc: 'Heität puukon kulkusuuntaan. Nopea ja tarkka.', pattern: 'throwFacing',
    base: base({ damage: 10, amount: 1, speed: 420, cooldown: 0.8, pierce: 1, knockback: 20, area: 6, interval: 0.09 }),
    levels: [amt(), dmg(8), amt(), pierce(1), dmg(8), amt(), pierce(1)],
    evolvesWith: 'tuohikontti', evolvesTo: 'puukkosade', rarity: 100, icon: 'puukko', tint: '#d8d8e0',
  },
  vihta: {
    id: 'vihta', name: 'Vihta', desc: 'Huiskit koivunoksilla eteen ja taakse vuorotellen.', pattern: 'sweep',
    base: base({ damage: 12, amount: 1, area: 1, cooldown: 1.35, knockback: 60, interval: 0.14 }),
    levels: [amt(), dmg(8), area(15), dmg(8), amt(), area(15), dmg(12)],
    evolvesWith: 'pakuri', evolvesTo: 'loyly', rarity: 100, icon: 'vihta', tint: '#7bc96f',
  },
  kokko: {
    id: 'kokko', name: 'Kokko', desc: 'Sytytät kokon jalkoihisi. Se palaa hetken ja polttaa ohikulkijat.', pattern: 'zoneAtPlayer',
    base: base({ damage: 4, amount: 1, area: 40, duration: 2.6, cooldown: 3.6, interval: 0.5 }),
    levels: [area(20), dmg(3), dur(20), amt(), area(20), dmg(4), cd(0.6)],
    evolvesWith: 'kynttila', evolvesTo: 'juhannuskokko', rarity: 90, icon: 'kokko', tint: '#ff8a3d',
  },
  kantele: {
    id: 'kantele', name: 'Kantele', desc: 'Näppäät kielen. Ääniaalto työntää lähellä olevat pois.', pattern: 'ring',
    base: base({ damage: 9, amount: 1, area: 100, speed: 260, cooldown: 2.6, knockback: 140, interval: 0.2 }),
    levels: [dmg(8), area(20), kb(60), dmg(8), amt(), area(20), cd(0.5)],
    evolvesWith: 'riimukivi', evolvesTo: 'vainonlaulu', rarity: 80, icon: 'kantele', tint: '#e8d27a',
  },
  ukonvasara: {
    id: 'ukonvasara', name: 'Ukonvasara', desc: 'Ukko, saamelaisten Horagalles, iskee salamalla satunnaisiin vihollisiin.', pattern: 'strike',
    base: base({ damage: 18, amount: 1, area: 26, cooldown: 3.2, interval: 0.12, knockback: 30 }),
    levels: [amt(), dmg(8), amt(), area(25), dmg(10), amt(), cd(0.6)],
    evolvesWith: 'kompassi', evolvesTo: 'ukonilma', rarity: 80, icon: 'ukonvasara', tint: '#9fd3ff',
  },
  kierukka: {
    id: 'kierukka', name: 'Hyttyskierukka', desc: 'Savuava kierukka. Vahingoittaa kaikkea ympärilläsi.', pattern: 'aura',
    base: base({ damage: 3, amount: 1, area: 48, cooldown: 1.0, knockback: 8 }),
    levels: [area(15), dmg(2), cd(0.1), area(15), dmg(2), cd(0.1), dmg(3)],
    evolvesWith: 'hunaja', evolvesTo: 'savusauna', rarity: 90, icon: 'kierukka', tint: '#b8e0c8',
  },
  sarvet: {
    id: 'sarvet', name: 'Tapion sarvet', desc: 'Hirvensarvet kiertävät sinua ja tömäyttävät vastaantulijat.', pattern: 'orbit',
    base: base({ damage: 12, amount: 1, area: 9, speed: 1, duration: 3.5, cooldown: 3.0, knockback: 45, pierce: Infinity }),
    levels: [amt(), dmg(8), spd(30), dur(30), amt(), area(30), dmg(12)],
    evolvesWith: 'villasukat', evolvesTo: 'hirvilauma', rarity: 80, icon: 'sarvet', tint: '#c9a46c',
  },
  kirves: {
    id: 'kirves', name: 'Kirves', desc: 'Heität kirveen kaaressa ylös. Se putoaa lauman läpi.', pattern: 'lob',
    base: base({ damage: 22, amount: 1, area: 11, speed: 300, cooldown: 1.6, pierce: 4, knockback: 40, interval: 0.14 }),
    levels: [amt(), dmg(10), pierce(2), area(25), amt(), dmg(10), pierce(3)],
    evolvesWith: 'terva', evolvesTo: 'kalevankirves', rarity: 80, icon: 'kirves', tint: '#c0c0c8',
  },
  jousi: {
    id: 'jousi', name: 'Jousi', desc: 'Ammut nuolen lähintä vihollista kohti.', pattern: 'nearest',
    base: base({ damage: 12, amount: 1, area: 5, speed: 520, cooldown: 0.95, pierce: 1, knockback: 15, interval: 0.1 }),
    levels: [amt(), dmg(6), amt(), pierce(1), dmg(6), amt(), cd(0.2)],
    evolvesWith: 'tulukset', evolvesTo: 'tulinuolet', rarity: 100, icon: 'jousi', tint: '#e0c08a',
  },
  kiuas: {
    id: 'kiuas', name: 'Kiuaskivi', desc: 'Heität kuuman kiven. Se hajoaa löylyksi osuessaan.', pattern: 'lobExplode',
    base: base({ damage: 11, amount: 1, area: 38, speed: 240, cooldown: 2.4, interval: 0.16, knockback: 30 }),
    levels: [area(20), dmg(6), amt(), area(20), dmg(8), amt(), cd(0.4)],
    evolvesWith: 'kahvipannu', evolvesTo: 'saunanhenki', rarity: 80, icon: 'kiuas', tint: '#ff6b5b',
  },
  viima: {
    id: 'viima', name: 'Pohjolan viima', desc: 'Jäinen puhuri kimpoaa ruudun reunoista ja läpäisee kaiken.', pattern: 'bounce',
    base: base({ damage: 11, amount: 1, area: 7, speed: 330, duration: 3.0, cooldown: 2.4, pierce: Infinity, knockback: 5, slow: 0.25, interval: 0.15 }),
    levels: [dmg(4), amt(), dur(25), dmg(5), spd(20), amt(), dmg(6)],
    evolvesWith: 'karhunnahka', evolvesTo: 'pakkasukko', rarity: 70, icon: 'viima', tint: '#c8f0ff',
  },
  verkko: {
    id: 'verkko', name: 'Näkin verkko', desc: 'Heität verkon eteesi. Se hidastaa ja raapii kiinni jääneitä.', pattern: 'trap',
    base: base({ damage: 3, amount: 1, area: 48, duration: 3.5, cooldown: 3.4, slow: 0.55, interval: 0.5 }),
    levels: [area(20), dur(25), dmg(2), amt(), area(20), dmg(3), cd(0.6)],
    evolvesWith: 'pihlaja', evolvesTo: 'vetehisensyli', rarity: 70, icon: 'verkko', tint: '#6fb7c9',
  },

  rumpu: {
    id: 'rumpu', name: 'Noaidin rumpu', desc: 'Lyöt rumpua. Saivon eläimet lähtevät etsimään vihollisia.', pattern: 'spirit',
    base: base({ damage: 9, amount: 1, area: 8, speed: 200, duration: 2.2, cooldown: 1.9, pierce: 2, knockback: 25, interval: 0.18 }),
    levels: [amt(), dmg(4), pierce(1), spd(20), amt(), dmg(5), dur(30)],
    evolvesWith: 'ketunhanta', evolvesTo: 'saivo', rarity: 80, icon: 'rumpu', tint: '#e0a8ff',
  },

  // Evolutions. One level, no further upgrades.
  puukkosade: {
    id: 'puukkosade', name: 'Puukkosade', desc: 'Puukkoja sataa lakkaamatta kulkusuuntaan.', pattern: 'throwFacing', evolved: true,
    base: base({ damage: 30, amount: 5, speed: 520, cooldown: 0.28, pierce: 6, knockback: 25, area: 7, interval: 0.04 }),
    levels: [], rarity: 0, icon: 'puukko', tint: '#ffffff',
  },
  loyly: {
    id: 'loyly', name: 'Löyly', desc: 'Kiuas kiehuu. Huiskaisu ympäröi sinut ja jokainen osuma parantaa.', pattern: 'sweep', evolved: true,
    base: base({ damage: 60, amount: 3, area: 1.9, cooldown: 0.9, knockback: 90, interval: 0.12, heal: 1 }),
    levels: [], rarity: 0, icon: 'vihta', tint: '#e8fff0',
  },
  juhannuskokko: {
    id: 'juhannuskokko', name: 'Juhannuskokko', desc: 'Kokko ei sammu. Se seuraa sinua ja polttaa kaiken.', pattern: 'aura', evolved: true,
    base: base({ damage: 22, amount: 1, area: 100, cooldown: 0.25, knockback: 10 }),
    levels: [], rarity: 0, icon: 'kokko', tint: '#ffb347',
  },
  vainonlaulu: {
    id: 'vainonlaulu', name: 'Väinön laulu', desc: 'Laulu joka pysäyttää metsän. Aallot hidastavat ja työntävät.', pattern: 'ring', evolved: true,
    base: base({ damage: 30, amount: 2, area: 140, speed: 300, cooldown: 1.5, knockback: 220, interval: 0.3, slow: 0.5 }),
    levels: [], rarity: 0, icon: 'kantele', tint: '#fff3b0',
  },
  ukonilma: {
    id: 'ukonilma', name: 'Ukonilma', desc: 'Ukonilma. Salamat iskevät joka puolelle ja räjähtävät.', pattern: 'strike', evolved: true,
    base: base({ damage: 45, amount: 6, area: 60, cooldown: 1.4, interval: 0.06, knockback: 60 }),
    levels: [], rarity: 0, icon: 'ukonvasara', tint: '#dff3ff',
  },
  savusauna: {
    id: 'savusauna', name: 'Savusauna', desc: 'Paksu savu. Vahingoittaa laajalti ja jokainen osuma parantaa.', pattern: 'aura', evolved: true,
    base: base({ damage: 18, amount: 1, area: 95, cooldown: 0.4, knockback: 12, heal: 0.15 }),
    levels: [], rarity: 0, icon: 'kierukka', tint: '#d9e8dc',
  },
  hirvilauma: {
    id: 'hirvilauma', name: 'Hirvilauma', desc: 'Lauma sarvia kiertää sinua tauotta.', pattern: 'orbit', evolved: true,
    base: base({ damage: 45, amount: 7, area: 13, speed: 1.6, duration: 9999, cooldown: 0.5, knockback: 70, pierce: Infinity }),
    levels: [], rarity: 0, icon: 'sarvet', tint: '#e0b878',
  },
  kalevankirves: {
    id: 'kalevankirves', name: 'Kalevan kirves', desc: 'Jättiläisen kirves. Halkaisee kaiken tiellään.', pattern: 'lob', evolved: true,
    base: base({ damage: 70, amount: 3, area: 22, speed: 320, cooldown: 1.2, pierce: Infinity, knockback: 80, interval: 0.12 }),
    levels: [], rarity: 0, icon: 'kirves', tint: '#ffe9a8',
  },
  tulinuolet: {
    id: 'tulinuolet', name: 'Tulinuolet', desc: 'Palavat nuolet läpäisevät rivin ja jättävät tulen.', pattern: 'nearest', evolved: true,
    base: base({ damage: 26, amount: 5, area: 6, speed: 640, cooldown: 0.7, pierce: 6, knockback: 20, interval: 0.06 }),
    levels: [], rarity: 0, icon: 'jousi', tint: '#ffb070',
  },
  saunanhenki: {
    id: 'saunanhenki', name: 'Saunan henki', desc: 'Löylynhenki heittää kiviä yhtä soittoa. Löyly täyttää metsän.', pattern: 'lobExplode', evolved: true,
    base: base({ damage: 40, amount: 4, area: 75, speed: 300, cooldown: 1.1, interval: 0.1, knockback: 50 }),
    levels: [], rarity: 0, icon: 'kiuas', tint: '#ff9a8a',
  },
  pakkasukko: {
    id: 'pakkasukko', name: 'Pakkasukko', desc: 'Pakkanen paukkuu. Puhurit kimpoavat ikuisesti ja jäädyttävät.', pattern: 'bounce', evolved: true,
    base: base({ damage: 30, amount: 4, area: 10, speed: 400, duration: 8, cooldown: 1.8, pierce: Infinity, knockback: 5, slow: 0.6, interval: 0.1 }),
    levels: [], rarity: 0, icon: 'viima', tint: '#ffffff',
  },
  saivo: {
    id: 'saivo', name: 'Saivo', desc: 'Toinen maailma aukeaa. Henkieläimiä virtaa lakkaamatta.', pattern: 'spirit', evolved: true,
    base: base({ damage: 20, amount: 3, area: 10, speed: 260, duration: 3.2, cooldown: 1.2, pierce: 4, knockback: 40, interval: 0.1 }),
    levels: [], rarity: 0, icon: 'rumpu', tint: '#f0d0ff',
  },
  vetehisensyli: {
    id: 'vetehisensyli', name: 'Vetehisen syli', desc: 'Vesi vetää. Verkot ovat suuria ja pitävät kiinni lähes kokonaan.', pattern: 'trap', evolved: true,
    base: base({ damage: 14, amount: 3, area: 80, duration: 5, cooldown: 2.4, slow: 0.85, interval: 0.25 }),
    levels: [], rarity: 0, icon: 'verkko', tint: '#8fd8ea',
  },
};

export const BASE_WEAPON_IDS = Object.values(WEAPONS).filter((w) => !w.evolved).map((w) => w.id);
export const MAX_WEAPONS = 6;

export function weaponMaxLevel(def: WeaponDef): number {
  return def.levels.length + 1;
}

/** Numbers at a level before player stats. */
export function weaponNumbers(def: WeaponDef, level: number): WeaponNumbers {
  const n = { ...def.base };
  for (let i = 0; i < Math.min(level - 1, def.levels.length); i++) {
    const d = def.levels[i].d;
    for (const k of Object.keys(d) as (keyof WeaponNumbers)[]) {
      const v = d[k]!;
      if (k === 'area' || k === 'speed' || k === 'duration') n[k] *= 1 + v;
      else n[k] += v;
    }
  }
  return n;
}
