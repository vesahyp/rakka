import { L, type Text } from '../../i18n';
import type { StatDelta } from '../stats';

export interface PassiveDef {
  id: string;
  name: Text;
  /** one line for the card */
  desc: Text;
  maxLevel: number;
  /** delta applied at each level, cumulative */
  perLevel: StatDelta;
  /** for the level text, e.g. "+10 % vahinko" */
  levelText: Text;
  icon: string;
  rarity: number; // weight in the offer pool
}

export const PASSIVES: Record<string, PassiveDef> = {
  terva: { id: 'terva', name: L('Terva', 'Pine tar'), desc: L('Terva, sauna ja viina. Aseet tekevät enemmän vahinkoa.', 'Tar, sauna and strong drink. Weapons do more damage.'), maxLevel: 5, perLevel: { might: 0.1 }, levelText: L('+10 % vahinko', '+10% damage'), icon: 'terva', rarity: 100 },
  pakuri: { id: 'pakuri', name: L('Pakuri', 'Chaga'), desc: L('Kääpä koivun kyljestä. Lisää elinvoimaa.', 'A fungus from the side of a birch. More health.'), maxLevel: 5, perLevel: { maxHp: 20 }, levelText: L('+20 elinvoima', '+20 health'), icon: 'pakuri', rarity: 90 },
  villasukat: { id: 'villasukat', name: L('Villasukat', 'Wool socks'), desc: L('Mummon kutomat. Kuljet nopeammin.', 'Knitted by grandma. You move faster.'), maxLevel: 5, perLevel: { moveSpeed: 0.1 }, levelText: L('+10 % nopeus', '+10% speed'), icon: 'villasukat', rarity: 80 },
  kompassi: { id: 'kompassi', name: L('Kompassi', 'Compass'), desc: L('Näyttää suuntaa. Aseiden alue kasvaa.', 'Shows the way. Weapon area grows.'), maxLevel: 5, perLevel: { area: 0.1 }, levelText: L('+10 % alue', '+10% area'), icon: 'kompassi', rarity: 80 },
  tulukset: { id: 'tulukset', name: L('Tulukset', 'Flint and steel'), desc: L('Kipinä syttyy nopeasti. Ammukset lentävät nopeammin.', 'The spark catches fast. Projectiles fly faster.'), maxLevel: 5, perLevel: { speed: 0.12 }, levelText: L('+12 % ammusnopeus', '+12% projectile speed'), icon: 'tulukset', rarity: 60 },
  kynttila: { id: 'kynttila', name: L('Kynttilä', 'Candle'), desc: L('Palaa pitkään. Vaikutukset kestävät kauemmin.', 'Burns for a long time. Effects last longer.'), maxLevel: 5, perLevel: { duration: 0.15 }, levelText: L('+15 % kesto', '+15% duration'), icon: 'kynttila', rarity: 60 },
  kahvipannu: { id: 'kahvipannu', name: L('Kahvipannu', 'Coffee pot'), desc: L('Sysimusta pannukahvi. Aseet latautuvat nopeammin.', 'Pitch-black boiled coffee. Weapons recharge faster.'), maxLevel: 5, perLevel: { cooldown: 0.07 }, levelText: L('-7 % latausaika', '-7% cooldown'), icon: 'kahvipannu', rarity: 90 },
  tuohikontti: { id: 'tuohikontti', name: L('Tuohikontti', 'Birch-bark pack'), desc: L('Tilaa yhdelle lisää. Jokainen ase saa yhden ammuksen lisää.', 'Room for one more. Every weapon gets one more projectile.'), maxLevel: 2, perLevel: { amount: 1 }, levelText: L('+1 ammus', '+1 projectile'), icon: 'tuohikontti', rarity: 45 },
  riimukivi: { id: 'riimukivi', name: L('Riimukivi', 'Rune stone'), desc: L('Vanhaa tietoa. Saat enemmän kokemusta.', 'Old knowledge. You get more experience.'), maxLevel: 5, perLevel: { growth: 0.1 }, levelText: L('+10 % kokemus', '+10% experience'), icon: 'riimukivi', rarity: 70 },
  ketunhanta: { id: 'ketunhanta', name: L('Ketunhäntä', 'Fox tail'), desc: L('Onni suosii. Paremmat löydöt ja arkut.', 'Luck is on your side. Better finds and chests.'), maxLevel: 5, perLevel: { luck: 0.15 }, levelText: L('+15 % onni', '+15% luck'), icon: 'ketunhanta', rarity: 60 },
  karhunnahka: { id: 'karhunnahka', name: L('Karhunnahka', 'Bear hide'), desc: L('Paksu turkki. Vähentää jokaisen osuman vahinkoa.', 'Thick fur. Reduces the damage of every hit.'), maxLevel: 5, perLevel: { armor: 1 }, levelText: L('+1 suoja', '+1 armor'), icon: 'karhunnahka', rarity: 80 },
  pihlaja: { id: 'pihlaja', name: L('Pihlajanoksa', 'Rowan twig'), desc: L('Suojeleva puu. Marjat lentävät luoksesi kauempaa.', 'A tree that protects. Berries fly to you from farther away.'), maxLevel: 5, perLevel: { magnet: 0.25 }, levelText: L('+25 % keräysalue', '+25% pickup range'), icon: 'pihlaja', rarity: 70 },
  hunaja: { id: 'hunaja', name: L('Hunaja', 'Honey'), desc: L('Metsämehiläisten. Elinvoima palautuu itsestään.', 'From wild bees. Health comes back on its own.'), maxLevel: 5, perLevel: { regen: 0.3 }, levelText: L('+0.3 elinvoimaa/s', '+0.3 health/s'), icon: 'hunaja', rarity: 70 },
  sammonsiru: { id: 'sammonsiru', name: L('Sammon siru', 'Shard of the Sampo'), desc: L('Pala ihmemyllystä. Nouset kuolleista kerran.', 'A piece of the magic mill. You come back from death once.'), maxLevel: 1, perLevel: { revives: 1 }, levelText: L('+1 ylösnousemus', '+1 revival'), icon: 'sammonsiru', rarity: 25 },
  hiidenkirous: { id: 'hiidenkirous', name: L('Hiiden kirous', 'Curse of Hiisi'), desc: L('Metsä vihaa sinua. Enemmän ja sitkeämpiä vihollisia, enemmän kokemusta.', 'The forest hates you. More and tougher enemies, more experience.'), maxLevel: 5, perLevel: { curse: 0.1 }, levelText: L('+10 % kirous', '+10% curse'), icon: 'hiidenkirous', rarity: 40 },
};

export const PASSIVE_IDS = Object.keys(PASSIVES);
export const MAX_PASSIVES = 6;
