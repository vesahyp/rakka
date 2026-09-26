import type { Offer } from '../game/upgrades';
import { icon } from './icons';

export function OfferCard({ o, index, onPick }: { o: Offer; index?: number; onPick?: (o: Offer) => void }) {
  const cls = 'card' + (o.kind === 'evolve' ? ' evo' : o.isNew ? ' new' : '');
  const lvl = o.kind === 'evolve' ? 'Kehitys' : o.kind === 'weapon' || o.kind === 'passive' ? (o.isNew ? 'Uusi' : `Taso ${o.level}/${o.maxLevel}`) : '';
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
        {index !== undefined && <div className="key">Näppäin {index + 1}</div>}
      </div>
    </button>
  );
}
