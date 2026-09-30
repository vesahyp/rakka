import { L, type Text } from '../../i18n';
import type { StatDelta } from '../stats';

export interface CharacterDef {
  id: string;
  name: string;
  title: Text;
  desc: Text;
  weapon: string;
  stats: StatDelta;
  /** the trait in one line for the select screen */
  trait: Text;
  colors: { skin: string; cloth: string; hair: string; accent: string };
  /** unlocked from the start, or by a record */
  unlock?: { kind: 'survive' | 'kills' | 'level' | 'runs'; value: number; text: Text };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'vaino', name: 'Väinö', title: L('Tietäjä iänikuinen', 'The eternal sage'), desc: L('Laulaa metsän hiljaiseksi.', 'Sings the forest quiet.'), weapon: 'kantele',
    stats: { growth: 0.15, maxHp: 10 }, trait: L('+15 % kokemus, +10 elinvoima', '+15% experience, +10 health'),
    colors: { skin: '#e8c4a0', cloth: '#5a6b8a', hair: '#e8e8e8', accent: '#e8d27a' },
  },
  {
    id: 'lemminkainen', name: 'Lemminkäinen', title: L('Lieto', 'The carefree'), desc: L('Nuori ja huoleton. Puukko käy, elämä ei paina.', 'Young and carefree. Quick with the puukko, and life weighs nothing.'), weapon: 'puukko',
    stats: { might: 0.2, maxHp: -20, moveSpeed: 0.05 }, trait: L('+20 % vahinko, -20 elinvoima, +5 % nopeus', '+20% damage, -20 health, +5% speed'),
    colors: { skin: '#e8c4a0', cloth: '#a03030', hair: '#8a4a20', accent: '#d8d8e0' },
  },
  {
    id: 'ilmarinen', name: 'Ilmarinen', title: L('Seppo', 'The smith'), desc: L('Takoi taivaan kannen. Kestää kuumuutta.', 'Forged the lid of the sky. Can stand the heat.'), weapon: 'kiuas',
    stats: { armor: 1, area: 0.1 }, trait: L('+1 suoja, +10 % alue', '+1 armor, +10% area'),
    colors: { skin: '#d8a880', cloth: '#4a4a52', hair: '#2a2a2a', accent: '#ff6b5b' },
  },
  {
    id: 'louhi', name: 'Louhi', title: L('Pohjolan emäntä', 'Mistress of Pohjola'), desc: L('Kutsuu pohjatuulen. Metsä vihaa häntä, ja hän hyötyy siitä.', 'Calls the north wind. The forest hates her, and she gains from it.'), weapon: 'viima',
    stats: { curse: 0.2, growth: 0.1, luck: 0.1 }, trait: L('+20 % kirous, +10 % kokemus, +10 % onni', '+20% curse, +10% experience, +10% luck'),
    colors: { skin: '#c8c8d8', cloth: '#2a2a48', hair: '#f0f0f0', accent: '#c8f0ff' },
  },
  {
    id: 'aino', name: 'Aino', title: L('Joukahaisen sisar', "Joukahainen's sister"), desc: L('Kevytjalkainen. Karkaa mihin muut eivät.', 'Light on her feet. Gets away where others cannot.'), weapon: 'vihta',
    stats: { moveSpeed: 0.2, magnet: 0.3, maxHp: -10 }, trait: L('+20 % nopeus, +30 % keräysalue, -10 elinvoima', '+20% speed, +30% pickup range, -10 health'),
    colors: { skin: '#f0d0b0', cloth: '#7bc96f', hair: '#d8b060', accent: '#ffffff' },
  },
  {
    id: 'noaidi', name: 'Noaidi', title: L('Saamelainen šamaani', 'Sámi shaman'), desc: L('Vaipuu loveen ja palaa. Rumpu kutsuu henkieläimet.', 'Falls into a trance and comes back. The drum calls the spirit animals.'), weapon: 'rumpu',
    stats: { revives: 1, moveSpeed: -0.1, luck: 0.15 }, trait: L('+1 ylösnousemus, -10 % nopeus, +15 % onni', '+1 revival, -10% speed, +15% luck'),
    colors: { skin: '#e0b898', cloth: '#1e3a8a', hair: '#3a2a1a', accent: '#e0a8ff' },
  },
  {
    id: 'kullervo', name: 'Kullervo', title: L('Kalervon poika', 'Son of Kalervo'), desc: L('Voima ilman mittaa. Ei väisty, ei suojaudu.', 'Strength without measure. Does not dodge, does not guard.'), weapon: 'kirves',
    stats: { might: 0.3, armor: -1, cooldown: -0.1 }, trait: L('+30 % vahinko, -1 suoja, hitaampi lataus', '+30% damage, -1 armor, slower cooldown'),
    colors: { skin: '#d8a880', cloth: '#3a2a1a', hair: '#1a1a1a', accent: '#c0c0c8' },
    unlock: { kind: 'kills', value: 1500, text: L('Kaada 1500 vihollista yhdessä pelissä', 'Defeat 1500 enemies in one run') },
  },
  {
    id: 'tonttu', name: 'Saunatonttu', title: L('Kiukaan vartija', 'Keeper of the sauna stove'), desc: L('Pieni ja nopea. Kierukka palaa aina.', 'Small and quick. The coil always burns.'), weapon: 'kierukka',
    stats: { moveSpeed: 0.1, cooldown: 0.1, maxHp: -30, luck: 0.2 }, trait: L('+10 % nopeus, -10 % latausaika, -30 elinvoima, +20 % onni', '+10% speed, -10% cooldown, -30 health, +20% luck'),
    colors: { skin: '#f0c8a8', cloth: '#b03838', hair: '#e0e0e0', accent: '#b8e0c8' },
    unlock: { kind: 'survive', value: 600, text: L('Selviydy 10 minuuttia', 'Survive 10 minutes') },
  },
  {
    id: 'tapio', name: 'Tapio', title: L('Metsän kuningas', 'King of the forest'), desc: L('Metsä on hänen. Sarvet vartioivat ja haavat umpeutuvat.', 'The forest is his. The antlers guard him and his wounds close.'), weapon: 'sarvet',
    stats: { regen: 0.5, area: 0.15, moveSpeed: -0.05 }, trait: L('+0.5 elinvoimaa/s, +15 % alue, -5 % nopeus', '+0.5 health/s, +15% area, -5% speed'),
    colors: { skin: '#c8a888', cloth: '#2f5a3a', hair: '#6a4a2a', accent: '#c9a46c' },
    unlock: { kind: 'survive', value: 1200, text: L('Selviydy 20 minuuttia', 'Survive 20 minutes') },
  },
  {
    id: 'ukko', name: 'Ukko', title: L('Ylijumala', 'God of the sky'), desc: L('Salama on hänen. Kaikki muu tulee hitaasti.', 'Lightning is his. Everything else comes slowly.'), weapon: 'ukonvasara',
    stats: { might: 0.1, cooldown: 0.05, moveSpeed: -0.1, maxHp: 20 }, trait: L('+10 % vahinko, -5 % latausaika, -10 % nopeus, +20 elinvoima', '+10% damage, -5% cooldown, -10% speed, +20 health'),
    colors: { skin: '#e0c0a0', cloth: '#304878', hair: '#f8f8f8', accent: '#9fd3ff' },
    unlock: { kind: 'level', value: 30, text: L('Saavuta taso 30', 'Reach level 30') },
  },
  {
    id: 'nyyrikki', name: 'Nyyrikki', title: L('Tapion poika', 'Son of Tapio'), desc: L('Metsästäjä. Jousi laulaa ja saalis lentää luokse.', 'A hunter. The bow sings and the prey flies to him.'), weapon: 'jousi',
    stats: { speed: 0.2, magnet: 0.2, luck: 0.1 }, trait: L('+20 % ammusnopeus, +20 % keräysalue, +10 % onni', '+20% projectile speed, +20% pickup range, +10% luck'),
    colors: { skin: '#d8b090', cloth: '#556b3a', hair: '#4a3020', accent: '#e0c08a' },
    unlock: { kind: 'runs', value: 5, text: L('Pelaa 5 peliä', 'Play 5 runs') },
  },
];

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
