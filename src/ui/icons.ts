/** One glyph per item, for the cards and the HUD strip. */
const ICONS: Record<string, string> = {
  puukko: '🔪', vihta: '🌿', kokko: '🔥', kantele: '🎶', ukonvasara: '⚡', kierukka: '🌀', sarvet: '🦌', kirves: '🪓', jousi: '🏹', kiuas: '🪨', viima: '🌬️', verkko: '🕸️', rumpu: '🥁',
  terva: '🫙', pakuri: '🍄', villasukat: '🧦', kompassi: '🧭', tulukset: '✨', kynttila: '🕯️', kahvipannu: '☕', tuohikontti: '🎒', riimukivi: '📜', ketunhanta: '🦊', karhunnahka: '🐻', pihlaja: '🌳', hunaja: '🍯', sammonsiru: '💠', hiidenkirous: '💀',
  kanttarelli: '🍄', lakka: '🟠',
};
export function icon(key: string): string {
  return ICONS[key] ?? '✦';
}
