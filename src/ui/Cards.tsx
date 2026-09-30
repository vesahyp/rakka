import type { Offer } from '../game/upgrades';
import { icon } from './icons';
import { tr } from '../i18n';

export function OfferCard({ o, index, onPick }: { o: Offer; index?: number; onPick?: (o: Offer) => void }) {
  const cls = 'card' + (o.kind === 'evolve' ? ' evo' : o.kind === 'power' ? ' power' : o.isNew ? ' new' : '');
  const taika = tr('Taika', 'Charm');
  const lvl = o.kind === 'evolve' ? tr('Kehitys', 'Evolution') : o.kind === 'power' ? (o.isNew ? taika : `${taika} ${o.level}/${o.maxLevel}`) : o.kind === 'weapon' || o.kind === 'passive' ? (o.isNew ? tr('Uusi', 'New') : `${tr('Taso', 'Level')} ${o.level}/${o.maxLevel}`) : '';
  return (
    <button className={cls} data-ui onClick={() => onPick?.(o)}>
      <div className="ic">{icon(o.icon)}</div>
      <div className="body">
        <div className="name">
          <span>{o.name}</span>
          <span className="lvl">{lvl}</span>
        </div>
        <div className="desc">{o.desc}</div>
        {o.levelText && o.kind !== 'evolve' && !o.isNew && <div className="what">{o.levelText}</div>}
        {index !== undefined && <div className="key">
            {tr('Näppäin', 'Key')} {index + 1}
          </div>}
      </div>
    </button>
  );
}
