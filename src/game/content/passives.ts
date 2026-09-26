import type { StatDelta } from '../stats';

export interface PassiveDef {
  id: string;
  name: string;
  /** one line for the card */
  desc: string;
  maxLevel: number;
  /** delta applied at each level, cumulative */
  perLevel: StatDelta;
  /** for the level text, e.g. "+10 % vahinko" */
  levelText: string;
  icon: string;
  rarity: number; // weight in the offer pool
}

export const PASSIVES: Record<string, PassiveDef> = {
  terva: { id: 'terva', name: 'Terva', desc: 'Terva, sauna ja viina. Aseet tekevät enemmän vahinkoa.', maxLevel: 5, perLevel: { might: 0.1 }, levelText: '+10 % vahinko', icon: 'terva', rarity: 100 },
  pakuri: { id: 'pakuri', name: 'Pakuri', desc: 'Kääpä koivun kyljestä. Lisää elinvoimaa.', maxLevel: 5, perLevel: { maxHp: 20 }, levelText: '+20 elinvoima', icon: 'pakuri', rarity: 90 },
  villasukat: { id: 'villasukat', name: 'Villasukat', desc: 'Mummon kutomat. Kuljet nopeammin.', maxLevel: 5, perLevel: { moveSpeed: 0.1 }, levelText: '+10 % nopeus', icon: 'villasukat', rarity: 80 },
  kompassi: { id: 'kompassi', name: 'Kompassi', desc: 'Näyttää suuntaa. Aseiden alue kasvaa.', maxLevel: 5, perLevel: { area: 0.1 }, levelText: '+10 % alue', icon: 'kompassi', rarity: 80 },
  tulukset: { id: 'tulukset', name: 'Tulukset', desc: 'Kipinä syttyy nopeasti. Ammukset lentävät nopeammin.', maxLevel: 5, perLevel: { speed: 0.12 }, levelText: '+12 % ammusnopeus', icon: 'tulukset', rarity: 60 },
  kynttila: { id: 'kynttila', name: 'Kynttilä', desc: 'Palaa pitkään. Vaikutukset kestävät kauemmin.', maxLevel: 5, perLevel: { duration: 0.15 }, levelText: '+15 % kesto', icon: 'kynttila', rarity: 60 },
  kahvipannu: { id: 'kahvipannu', name: 'Kahvipannu', desc: 'Sysimusta pannukahvi. Aseet latautuvat nopeammin.', maxLevel: 5, perLevel: { cooldown: 0.07 }, levelText: '-7 % latausaika', icon: 'kahvipannu', rarity: 90 },
  tuohikontti: { id: 'tuohikontti', name: 'Tuohikontti', desc: 'Tilaa yhdelle lisää. Jokainen ase saa yhden ammuksen lisää.', maxLevel: 2, perLevel: { amount: 1 }, levelText: '+1 ammus', icon: 'tuohikontti', rarity: 45 },
  riimukivi: { id: 'riimukivi', name: 'Riimukivi', desc: 'Vanhaa tietoa. Saat enemmän kokemusta.', maxLevel: 5, perLevel: { growth: 0.1 }, levelText: '+10 % kokemus', icon: 'riimukivi', rarity: 70 },
  ketunhanta: { id: 'ketunhanta', name: 'Ketunhäntä', desc: 'Onni suosii. Paremmat löydöt ja arkut.', maxLevel: 5, perLevel: { luck: 0.15 }, levelText: '+15 % onni', icon: 'ketunhanta', rarity: 60 },
  karhunnahka: { id: 'karhunnahka', name: 'Karhunnahka', desc: 'Paksu turkki. Vähentää jokaisen osuman vahinkoa.', maxLevel: 5, perLevel: { armor: 1 }, levelText: '+1 suoja', icon: 'karhunnahka', rarity: 80 },
  pihlaja: { id: 'pihlaja', name: 'Pihlajanoksa', desc: 'Suojeleva puu. Marjat lentävät luoksesi kauempaa.', maxLevel: 5, perLevel: { magnet: 0.25 }, levelText: '+25 % keräysalue', icon: 'pihlaja', rarity: 70 },
  hunaja: { id: 'hunaja', name: 'Hunaja', desc: 'Metsämehiläisten. Elinvoima palautuu itsestään.', maxLevel: 5, perLevel: { regen: 0.3 }, levelText: '+0.3 elinvoimaa/s', icon: 'hunaja', rarity: 70 },
  sammonsiru: { id: 'sammonsiru', name: 'Sammon siru', desc: 'Pala ihmemyllystä. Nouset kuolleista kerran.', maxLevel: 1, perLevel: { revives: 1 }, levelText: '+1 ylösnousemus', icon: 'sammonsiru', rarity: 25 },
  hiidenkirous: { id: 'hiidenkirous', name: 'Hiiden kirous', desc: 'Metsä vihaa sinua. Enemmän ja sitkeämpiä vihollisia, enemmän kokemusta.', maxLevel: 5, perLevel: { curse: 0.1 }, levelText: '+10 % kirous', icon: 'hiidenkirous', rarity: 40 },
};

export const PASSIVE_IDS = Object.keys(PASSIVES);
export const MAX_PASSIVES = 6;
