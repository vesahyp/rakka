import { L, type Text } from '../../i18n';
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
  name: Text;
  desc: Text;
  maxLevel: number;
  levelText: Text;
  rarity: number;
  icon: string;
  /** plain stat changes, applied per level like a passive */
  stats?: StatDelta;
}

export const POWERS: Record<string, PowerDef> = {
  noidansilma: { id: 'noidansilma', name: L('Noidan silmä', "Witch's eye"), desc: L('Näet heikon kohdan. Osuma tekee joskus kaksinkertaisen vahingon.', 'You see the weak spot. A hit sometimes does double damage.'), maxLevel: 3, levelText: L('+10 % kriittinen', '+10% critical'), rarity: 90, icon: 'noidansilma' },
  kalmankosketus: { id: 'kalmankosketus', name: L('Kalman kosketus', 'Touch of death'), desc: L('Kuollut vihollinen räjähtää ja vahingoittaa ympärillään olevia. Räjähdys ei ketjuunnu.', 'A dead enemy explodes and damages those around it. The explosion does not chain.'), maxLevel: 3, levelText: L('+8 % räjähdysvahinko', '+8% explosion damage'), rarity: 80, icon: 'kalmankosketus' },
  ukonsuosio: { id: 'ukonsuosio', name: L('Ukon suosio', "Ukko's favor"), desc: L('Salama iskee siihen, joka puree sinua.', 'Lightning strikes whoever bites you.'), maxLevel: 2, levelText: L('+ salaman vahinko', '+ lightning damage'), rarity: 70, icon: 'ukonsuosio' },
  nakinlahja: { id: 'nakinlahja', name: L('Näkin lahja', "Näkki's gift"), desc: L('Jokainen marja parantaa vähän.', 'Every berry heals a little.'), maxLevel: 2, levelText: L('+0.6 elinvoimaa marjasta', '+0.6 health per berry'), rarity: 80, icon: 'nakinlahja' },
  karhunraivo: { id: 'karhunraivo', name: L('Karhun raivo', "Bear's rage"), desc: L('Haavoittuneena lyöt lujempaa. Alle 35 % elinvoimalla vahinko kasvaa.', 'You hit harder when hurt. Below 35% health, your damage goes up.'), maxLevel: 2, levelText: L('+30 % vahinko haavoittuneena', '+30% damage when hurt'), rarity: 80, icon: 'karhunraivo' },
  kanto: { id: 'kanto', name: L('Kanto', 'Stump'), desc: L('Kun seisot paikallasi hetken, muutut kannoksi: suoja ja palautuminen kasvavat.', 'Stand still for a moment and you become a stump: armor and recovery go up.'), maxLevel: 2, levelText: L('+3 suoja, +1 elinvoimaa/s paikallaan', '+3 armor, +1 health/s standing still'), rarity: 70, icon: 'kanto' },
  juoksija: { id: 'juoksija', name: L('Juoksija', 'Runner'), desc: L('Liikkeessä lyöt lujempaa. Paikallaan et.', 'You hit harder while you move. Not while you stand still.'), maxLevel: 2, levelText: L('+15 % vahinko liikkeessä', '+15% damage while moving'), rarity: 80, icon: 'juoksija' },
  piilopaikka: { id: 'piilopaikka', name: L('Piilopaikka', 'Hiding place'), desc: L('Kova isku pudottaa sinut hetkeksi näkymättömiin. Kerran 15 sekunnissa.', 'A heavy hit makes you invisible for a moment. Once every 15 seconds.'), maxLevel: 2, levelText: L('+0.8 s näkymättömyys', '+0.8 s invisible'), rarity: 60, icon: 'piilopaikka' },
  elonkorjuu: { id: 'elonkorjuu', name: L('Elonkorjuu', 'Harvest'), desc: L('Sadas kaato jättää kanttarellin jalkoihisi.', 'Every hundredth kill leaves a chanterelle at your feet.'), maxLevel: 2, levelText: L('kanttarelli useammin', 'chanterelles more often'), rarity: 70, icon: 'elonkorjuu' },
  tuulenselka: { id: 'tuulenselka', name: L('Tuulen selkä', 'Tailwind'), desc: L('Ammukset lentävät nopeammin ja yhden vihollisen pidemmälle.', 'Projectiles fly faster and through one more enemy.'), maxLevel: 2, levelText: L('+15 % ammusnopeus, +1 läpäisy', '+15% projectile speed, +1 pierce'), rarity: 70, icon: 'tuulenselka' },
  louhensopimus: { id: 'louhensopimus', name: L('Louhen sopimus', "Louhi's pact"), desc: L('Metsä vihaa sinua enemmän, ja maksaa siitä kokemuksena.', 'The forest hates you more, and pays for it in experience.'), maxLevel: 2, levelText: L('+25 % kirous, +25 % kokemus', '+25% curse, +25% experience'), rarity: 60, icon: 'louhensopimus', stats: { curse: 0.25, growth: 0.25 } },
  vainonviisaus: { id: 'vainonviisaus', name: L('Väinön viisaus', "Väinö's wisdom"), desc: L('Näet neljä korttia kolmen sijaan.', 'You see four cards instead of three.'), maxLevel: 1, levelText: L('4 korttia', '4 cards'), rarity: 50, icon: 'vainonviisaus' },
  arpakivi: { id: 'arpakivi', name: L('Arpakivi', 'Lot stone'), desc: L('Voit heittää kortit uudelleen. Kaksi heittoa per taso.', 'You can reroll the cards. Two rerolls per level.'), maxLevel: 2, levelText: L('+2 uudelleenheittoa', '+2 rerolls'), rarity: 60, icon: 'arpakivi', stats: { reroll: 2 } },
  tapionsuoja: { id: 'tapionsuoja', name: L('Tapion suoja', "Tapio's shelter"), desc: L('Pomot ja eliitit tekevät sinulle vähemmän vahinkoa.', 'Bosses and elites do less damage to you.'), maxLevel: 2, levelText: L('-25 % pomovahinko', '-25% boss damage'), rarity: 60, icon: 'tapionsuoja' },
  sielunsyoja: { id: 'sielunsyoja', name: L('Sielunsyöjä', 'Soul eater'), desc: L('Jokainen kaato kasvattaa vahinkoa hitusen, tuhanteen kaatoon asti.', 'Every kill raises your damage a little, up to a thousand kills.'), maxLevel: 2, levelText: L('+20 % vahinko tuhannesta kaadosta', '+20% damage at a thousand kills'), rarity: 60, icon: 'sielunsyoja' },
  rakkatuuli: { id: 'rakkatuuli', name: L('Räkkätuuli', 'Swarm wind'), desc: L('Parvet kärsivät. Hyttyset, mäkärät ja muut pienet ottavat enemmän vahinkoa.', 'The swarms suffer. Mosquitoes, black flies and the other small ones take more damage.'), maxLevel: 2, levelText: L('+25 % vahinko parville', '+25% damage to swarms'), rarity: 80, icon: 'rakkatuuli' },
  peikonveri: { id: 'peikonveri', name: L('Peikon veri', 'Troll blood'), desc: L('Paksu ja hidas. Paljon elinvoimaa, vähemmän vauhtia.', 'Thick and slow. A lot of health, less speed.'), maxLevel: 2, levelText: L('+80 elinvoima, -8 % nopeus', '+80 health, -8% speed'), rarity: 70, icon: 'peikonveri', stats: { maxHp: 80, moveSpeed: -0.08 } },
  jaatavakosketus: { id: 'jaatavakosketus', name: L('Jäätävä kosketus', 'Freezing touch'), desc: L('Jokainen osuma hidastaa hetken.', 'Every hit slows for a moment.'), maxLevel: 2, levelText: L('+15 % hidastus', '+15% slow'), rarity: 70, icon: 'jaatavakosketus' },
  kotkankatse: { id: 'kotkankatse', name: L('Kotkan katse', 'Eagle eye'), desc: L('Korkeimman tason aseesi saa yhden ammuksen lisää.', 'Your highest-level weapon gets one more projectile.'), maxLevel: 2, levelText: L('+1 ammus pääaseelle', '+1 projectile for your main weapon'), rarity: 60, icon: 'kotkankatse' },
  tulikaste: { id: 'tulikaste', name: L('Tulikaste', 'Baptism of fire'), desc: L('Kaato sytyttää joskus maan.', 'A kill sometimes sets the ground on fire.'), maxLevel: 3, levelText: L('+6 % sytytys', '+6% ignite'), rarity: 80, icon: 'tulikaste' },
};

export const POWER_IDS = Object.keys(POWERS);
export const MAX_POWERS = 8;
/** player level from which taiat enter the pool */
export const POWER_FROM_LEVEL = 8;
