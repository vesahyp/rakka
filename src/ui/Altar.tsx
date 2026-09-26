import { useState } from 'react';
import { ALTAR, buy, rankPrice, refundAll, type Meta } from '../meta';
import { icon } from './icons';
import { audio } from '../audio';
import { track } from '../records';

export function Altar({ meta, onChange, onBack }: { meta: Meta; onChange: (m: Meta) => void; onBack: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen" style={{ justifyContent: 'flex-start' }}>
      <h2>Tapion pöytä</h2>
      <p className="small" style={{ maxWidth: 380 }}>
        Jätä käpyjä kannolle, niin metsä on vähän armollisempi. Pelit tuovat käpyjä ajasta, kaadoista ja pomoista. Kaiken saa takaisin.
      </p>
      <div className="cones">🌲 {meta.cones} käpyä</div>
      <div className="cards" style={{ marginTop: 10 }}>
        {ALTAR.map((item) => {
          const have = meta.ranks[item.id] ?? 0;
          const maxed = have >= item.ranks;
          const price = maxed ? 0 : rankPrice(item, have + 1);
          const can = !maxed && meta.cones >= price;
          return (
            <div className={'card' + (maxed ? ' new' : '')} key={item.id} style={{ cursor: 'default' }}>
              <div className="ic">{icon(item.icon)}</div>
              <div className="body">
                <div className="name">
                  <span>{item.name}</span>
                  <span className="lvl">
                    {'●'.repeat(have)}
                    {'○'.repeat(item.ranks - have)}
                  </span>
                </div>
                <div className="desc">
                  {item.desc} {item.rankText} per aste.
                </div>
              </div>
              <button
                className="btn ghost"
                disabled={!can}
                data-ui
                onClick={() => {
                  const next = buy(meta, item.id);
                  if (next) {
                    audio.play('pickup');
                    track('altar', { id: item.id, rank: (meta.ranks[item.id] ?? 0) + 1 });
                    onChange(next);
                  }
                }}
              >
                {maxed ? 'Täysi' : `${price} 🌲`}
              </button>
            </div>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary" onClick={onBack} data-ui>
          Valmis
        </button>
        {!confirm && (
          <button className="btn ghost" onClick={() => setConfirm(true)} data-ui>
            Ota kaikki takaisin
          </button>
        )}
        {confirm && (
          <button
            className="btn ghost"
            style={{ borderColor: 'var(--danger)' }}
            data-ui
            onClick={() => {
              onChange(refundAll(meta));
              setConfirm(false);
            }}
          >
            Varmasti? Kävyt palautuvat
          </button>
        )}
      </div>
    </div>
  );
}
