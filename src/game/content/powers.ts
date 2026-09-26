import type { StatDelta } from '../stats';

/**
 * Taiat: powers that change a rule instead of a number. They live outside
 * the weapon and passive slots, cap at MAX_POWERS per run, and enter the
 * offer pool from level eight, more often as the slotted items max out.
 * The effect of each one is implemented where the rule lives (sim.ts,
 * combat.ts, weapons.ts, upgrades.ts) and looked up with powerLevel().
 */
export interface PowerDef {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
  levelText: string;
  rarity: number;
  icon: string;
  /** plain stat changes, applied per level like a passive */
  stats?: StatDelta;
}

export const POWERS: Record<string, PowerDef> = {
  noidansilma: { id: 'noidansilma', name: 'Noidan silmä', desc: 'Näet heikon kohdan. Osuma tekee joskus kaksinkertaisen vahingon.', maxLevel: 3, levelText: '+10 % kriittinen', rarity: 90, icon: 'noidansilma' },
  kalmankosketus: { id: 'kalmankosketus', name: 'Kalman kosketus', desc: 'Kuollut vihollinen räjähtää ja vahingoittaa ympärillään olevia.', maxLevel: 3, levelText: '+12 % räjähdysvahinko', rarity: 80, icon: 'kalmankosketus' },
  ukonsuosio: { id: 'ukonsuosio', name: 'Ukon suosio', desc: 'Salama iskee siihen, joka puree sinua.', maxLevel: 2, levelText: '+ salaman vahinko', rarity: 70, icon: 'ukonsuosio' },
  nakinlahja: { id: 'nakinlahja', name: 'Näkin lahja', desc: 'Jokainen marja parantaa vähän.', maxLevel: 2, levelText: '+0.6 elinvoimaa marjasta', rarity: 80, icon: 'nakinlahja' },
  karhunraivo: { id: 'karhunraivo', name: 'Karhun raivo', desc: 'Haavoittuneena lyöt lujempaa. Alle 35 % elinvoimalla vahinko kasvaa.', maxLevel: 2, levelText: '+30 % vahinko haavoittuneena', rarity: 80, icon: 'karhunraivo' },
  kanto: { id: 'kanto', name: 'Kanto', desc: 'Kun seisot paikallasi hetken, muutut kannoksi: suoja ja palautuminen kasvavat.', maxLevel: 2, levelText: '+3 suoja, +1 elinvoimaa/s paikallaan', rarity: 70, icon: 'kanto' },
  juoksija: { id: 'juoksija', name: 'Juoksija', desc: 'Liikkeessä lyöt lujempaa. Paikallaan et.', maxLevel: 2, levelText: '+15 % vahinko liikkeessä', rarity: 80, icon: 'juoksija' },
  piilopaikka: { id: 'piilopaikka', name: 'Piilopaikka', desc: 'Kova isku pudottaa sinut hetkeksi näkymättömiin. Kerran 15 sekunnissa.', maxLevel: 2, levelText: '+0.8 s näkymättömyys', rarity: 60, icon: 'piilopaikka' },
  elonkorjuu: { id: 'elonkorjuu', name: 'Elonkorjuu', desc: 'Sadas kaato jättää kanttarellin jalkoihisi.', maxLevel: 2, levelText: 'kanttarelli useammin', rarity: 70, icon: 'elonkorjuu' },
  tuulenselka: { id: 'tuulenselka', name: 'Tuulen selkä', desc: 'Ammukset lentävät nopeammin ja yhden vihollisen pidemmälle.', maxLevel: 2, levelText: '+15 % ammusnopeus, +1 läpäisy', rarity: 70, icon: 'tuulenselka' },
  louhensopimus: { id: 'louhensopimus', name: 'Louhen sopimus', desc: 'Metsä vihaa sinua enemmän, ja maksaa siitä kokemuksena.', maxLevel: 2, levelText: '+25 % kirous, +25 % kokemus', rarity: 60, icon: 'louhensopimus', stats: { curse: 0.25, growth: 0.25 } },
  vainonviisaus: { id: 'vainonviisaus', name: 'Väinön viisaus', desc: 'Näet neljä korttia kolmen sijaan.', maxLevel: 1, levelText: '4 korttia', rarity: 50, icon: 'vainonviisaus' },
  arpakivi: { id: 'arpakivi', name: 'Arpakivi', desc: 'Voit heittää kortit uudelleen. Kaksi heittoa per taso.', maxLevel: 2, levelText: '+2 uudelleenheittoa', rarity: 60, icon: 'arpakivi', stats: { reroll: 2 } },
  tapionsuoja: { id: 'tapionsuoja', name: 'Tapion suoja', desc: 'Pomot ja eliitit tekevät sinulle vähemmän vahinkoa.', maxLevel: 2, levelText: '-25 % pomovahinko', rarity: 60, icon: 'tapionsuoja' },
  sielunsyoja: { id: 'sielunsyoja', name: 'Sielunsyöjä', desc: 'Jokainen kaato kasvattaa vahinkoa hitusen, tuhanteen kaatoon asti.', maxLevel: 2, levelText: '+20 % vahinko tuhannesta kaadosta', rarity: 60, icon: 'sielunsyoja' },
  rakkatuuli: { id: 'rakkatuuli', name: 'Räkkätuuli', desc: 'Parvet kärsivät. Hyttyset, mäkärät ja muut pienet ottavat enemmän vahinkoa.', maxLevel: 2, levelText: '+40 % vahinko parville', rarity: 80, icon: 'rakkatuuli' },
  peikonveri: { id: 'peikonveri', name: 'Peikon veri', desc: 'Paksu ja hidas. Paljon elinvoimaa, vähemmän vauhtia.', maxLevel: 2, levelText: '+80 elinvoima, -8 % nopeus', rarity: 70, icon: 'peikonveri', stats: { maxHp: 80, moveSpeed: -0.08 } },
  jaatavakosketus: { id: 'jaatavakosketus', name: 'Jäätävä kosketus', desc: 'Jokainen osuma hidastaa hetken.', maxLevel: 2, levelText: '+15 % hidastus', rarity: 70, icon: 'jaatavakosketus' },
  kotkankatse: { id: 'kotkankatse', name: 'Kotkan katse', desc: 'Korkeimman tason aseesi saa yhden ammuksen lisää.', maxLevel: 2, levelText: '+1 ammus pääaseelle', rarity: 60, icon: 'kotkankatse' },
  tulikaste: { id: 'tulikaste', name: 'Tulikaste', desc: 'Kaato sytyttää joskus maan.', maxLevel: 3, levelText: '+6 % sytytys', rarity: 80, icon: 'tulikaste' },
};

export const POWER_IDS = Object.keys(POWERS);
export const MAX_POWERS = 8;
/** player level from which taiat enter the pool */
export const POWER_FROM_LEVEL = 8;
