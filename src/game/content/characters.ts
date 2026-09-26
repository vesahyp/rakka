import type { StatDelta } from '../stats';

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  desc: string;
  weapon: string;
  stats: StatDelta;
  /** the trait in one line for the select screen */
  trait: string;
  colors: { skin: string; cloth: string; hair: string; accent: string };
  /** unlocked from the start, or by a record */
  unlock?: { kind: 'survive' | 'kills' | 'level' | 'runs'; value: number; text: string };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'vaino', name: 'Väinö', title: 'Tietäjä iänikuinen', desc: 'Laulaa metsän hiljaiseksi.', weapon: 'kantele',
    stats: { growth: 0.15, maxHp: 10 }, trait: '+15 % kokemus, +10 elinvoima',
    colors: { skin: '#e8c4a0', cloth: '#5a6b8a', hair: '#e8e8e8', accent: '#e8d27a' },
  },
  {
    id: 'lemminkainen', name: 'Lemminkäinen', title: 'Lieto', desc: 'Nuori ja huoleton. Puukko käy, elämä ei paina.', weapon: 'puukko',
    stats: { might: 0.2, maxHp: -20, moveSpeed: 0.05 }, trait: '+20 % vahinko, -20 elinvoima, +5 % nopeus',
    colors: { skin: '#e8c4a0', cloth: '#a03030', hair: '#8a4a20', accent: '#d8d8e0' },
  },
  {
    id: 'ilmarinen', name: 'Ilmarinen', title: 'Seppo', desc: 'Takoi taivaan kannen. Kestää kuumuutta.', weapon: 'kiuas',
    stats: { armor: 1, area: 0.1 }, trait: '+1 suoja, +10 % alue',
    colors: { skin: '#d8a880', cloth: '#4a4a52', hair: '#2a2a2a', accent: '#ff6b5b' },
  },
  {
    id: 'louhi', name: 'Louhi', title: 'Pohjolan emäntä', desc: 'Kutsuu pohjatuulen. Metsä vihaa häntä, ja hän hyötyy siitä.', weapon: 'viima',
    stats: { curse: 0.2, growth: 0.1, luck: 0.1 }, trait: '+20 % kirous, +10 % kokemus, +10 % onni',
    colors: { skin: '#c8c8d8', cloth: '#2a2a48', hair: '#f0f0f0', accent: '#c8f0ff' },
  },
  {
    id: 'aino', name: 'Aino', title: 'Joukahaisen sisar', desc: 'Kevytjalkainen. Karkaa mihin muut eivät.', weapon: 'vihta',
    stats: { moveSpeed: 0.2, magnet: 0.3, maxHp: -10 }, trait: '+20 % nopeus, +30 % keräysalue, -10 elinvoima',
    colors: { skin: '#f0d0b0', cloth: '#7bc96f', hair: '#d8b060', accent: '#ffffff' },
  },
  {
    id: 'noaidi', name: 'Noaidi', title: 'Saamelainen šamaani', desc: 'Vaipuu loveen ja palaa. Rumpu kutsuu henkieläimet.', weapon: 'rumpu',
    stats: { revives: 1, moveSpeed: -0.1, luck: 0.15 }, trait: '+1 ylösnousemus, -10 % nopeus, +15 % onni',
    colors: { skin: '#e0b898', cloth: '#1e3a8a', hair: '#3a2a1a', accent: '#e0a8ff' },
  },
  {
    id: 'kullervo', name: 'Kullervo', title: 'Kalervon poika', desc: 'Voima ilman mittaa. Ei väisty, ei suojaudu.', weapon: 'kirves',
    stats: { might: 0.3, armor: -1, cooldown: -0.1 }, trait: '+30 % vahinko, -1 suoja, hitaampi lataus',
    colors: { skin: '#d8a880', cloth: '#3a2a1a', hair: '#1a1a1a', accent: '#c0c0c8' },
    unlock: { kind: 'kills', value: 1500, text: 'Kaada 1500 vihollista yhdessä pelissä' },
  },
  {
    id: 'tonttu', name: 'Saunatonttu', title: 'Kiukaan vartija', desc: 'Pieni ja nopea. Kierukka palaa aina.', weapon: 'kierukka',
    stats: { moveSpeed: 0.1, cooldown: 0.1, maxHp: -30, luck: 0.2 }, trait: '+10 % nopeus, -10 % latausaika, -30 elinvoima, +20 % onni',
    colors: { skin: '#f0c8a8', cloth: '#b03838', hair: '#e0e0e0', accent: '#b8e0c8' },
    unlock: { kind: 'survive', value: 600, text: 'Selviydy 10 minuuttia' },
  },
  {
    id: 'tapio', name: 'Tapio', title: 'Metsän kuningas', desc: 'Metsä on hänen. Sarvet vartioivat ja haavat umpeutuvat.', weapon: 'sarvet',
    stats: { regen: 0.5, area: 0.15, moveSpeed: -0.05 }, trait: '+0.5 elinvoimaa/s, +15 % alue, -5 % nopeus',
    colors: { skin: '#c8a888', cloth: '#2f5a3a', hair: '#6a4a2a', accent: '#c9a46c' },
    unlock: { kind: 'survive', value: 1200, text: 'Selviydy 20 minuuttia' },
  },
  {
    id: 'ukko', name: 'Ukko', title: 'Ylijumala', desc: 'Salama on hänen. Kaikki muu tulee hitaasti.', weapon: 'ukonvasara',
    stats: { might: 0.1, cooldown: 0.05, moveSpeed: -0.1, maxHp: 20 }, trait: '+10 % vahinko, -5 % latausaika, -10 % nopeus, +20 elinvoima',
    colors: { skin: '#e0c0a0', cloth: '#304878', hair: '#f8f8f8', accent: '#9fd3ff' },
    unlock: { kind: 'level', value: 30, text: 'Saavuta taso 30' },
  },
  {
    id: 'nyyrikki', name: 'Nyyrikki', title: 'Tapion poika', desc: 'Metsästäjä. Jousi laulaa ja saalis lentää luokse.', weapon: 'jousi',
    stats: { speed: 0.2, magnet: 0.2, luck: 0.1 }, trait: '+20 % ammusnopeus, +20 % keräysalue, +10 % onni',
    colors: { skin: '#d8b090', cloth: '#556b3a', hair: '#4a3020', accent: '#e0c08a' },
    unlock: { kind: 'runs', value: 5, text: 'Pelaa 5 peliä' },
  },
];

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
