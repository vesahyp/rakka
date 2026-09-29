import { useEffect, useState } from 'react';
import { ALTAR, buy, rankPrice, refundAll, totalRanks, exportCode, importCode, adoptMeta, type Meta } from '../meta';
import { icon } from './icons';
import { audio } from '../audio';
import { track } from '../records';

export function Altar({ meta, onChange, onBack }: { meta: Meta; onChange: (m: Meta) => void; onBack: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [armed, setArmed] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [copied, setCopied] = useState(false);
  // The refund confirm used to appear under the thumb that had just tapped
  // the button, so a double tap emptied the table. It now sits apart and
  // sleeps for a moment before it takes a tap.
  useEffect(() => {
    if (!confirm) return;
    setArmed(false);
    const t = setTimeout(() => setArmed(true), 700);
    return () => clearTimeout(t);
  }, [confirm]);
  const owned = totalRanks(meta);
  const code = exportCode(meta);
  const pasted = importCode(typed);
  return (
    <div className="screen" style={{ justifyContent: 'flex-start' }}>
      <h2>Tapion pöytä</h2>
      <p className="small" style={{ maxWidth: 380 }}>
        Jätä käpyjä kannolle, niin metsä on vähän armollisempi. Kävyt kerätään metsästä pelin aikana. Jokainen aste maksaa enemmän kuin edellinen, ja mitä täydempi pöytä, sitä kalliimpi seuraava. Kaiken saa takaisin.
      </p>
      <div className="cones">🌲 {meta.cones} käpyä</div>
      <div className="cards" style={{ marginTop: 10 }}>
        {ALTAR.map((item) => {
          const have = meta.ranks[item.id] ?? 0;
          const maxed = have >= item.ranks;
          const price = maxed ? 0 : rankPrice(item, have + 1, owned);
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
                    track('altar', { id: item.id, rank: (meta.ranks[item.id] ?? 0) + 1, price });
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
        <button className="btn ghost" onClick={() => setCodeOpen(!codeOpen)} data-ui>
          {codeOpen ? 'Piilota koodi' : 'Pöydän koodi'}
        </button>
        {!confirm && (
          <button className="btn ghost" onClick={() => setConfirm(true)} disabled={owned === 0} data-ui>
            Ota kaikki takaisin
          </button>
        )}
      </div>
      {confirm && (
        <div className="panel" style={{ marginTop: 10, maxWidth: 380 }}>
          <p className="small" style={{ margin: '0 0 8px' }}>
            Kaikki asteet poistuvat ja {meta.spent} käpyä palaa pöydälle. Varmasti?
          </p>
          <div className="row">
            <button className="btn ghost" onClick={() => setConfirm(false)} data-ui>
              Peru
            </button>
            <button
              className="btn ghost"
              style={{ borderColor: 'var(--danger)', opacity: armed ? 1 : 0.4 }}
              disabled={!armed}
              data-ui
              onClick={() => {
                track('altar_refund', { ranks: owned, spent: meta.spent });
                onChange(refundAll(meta));
                setConfirm(false);
              }}
            >
              Kyllä, ota takaisin
            </button>
          </div>
        </div>
      )}
      {codeOpen && (
        <div className="panel" style={{ marginTop: 10, maxWidth: 380, textAlign: 'left' }}>
          <p className="small" style={{ margin: '0 0 6px' }}>
            Pöytä on tallessa tässä laitteessa ja selaimessa. Safari ja kotinäytön sovellus eivät jaa tallennusta, joten koodilla pöydän saa siirrettyä toiseen. Kopioi koodi ja liitä se toisaalla.
          </p>
          <div className="code">{code}</div>
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <button
              className="btn ghost"
              data-ui
              onClick={() => {
                navigator.clipboard?.writeText(code).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? 'Kopioitu' : 'Kopioi'}
            </button>
          </div>
          <p className="small" style={{ margin: '12px 0 6px' }}>Liitä toisen laitteen koodi. Se korvaa tämän pöydän.</p>
          <input className="codein" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="ESIM. 3K-0-1-0-…" autoCapitalize="characters" autoCorrect="off" spellCheck={false} data-ui />
          <div className="row" style={{ justifyContent: 'flex-start', marginTop: 6 }}>
            <button
              className="btn ghost"
              disabled={!pasted}
              data-ui
              onClick={() => {
                if (!pasted) return;
                track('altar_import', { cones: pasted.cones, ranks: totalRanks(pasted) });
                onChange(adoptMeta(pasted));
                setTyped('');
                audio.play('pickup');
              }}
            >
              Tuo pöytä
            </button>
            {typed.trim() !== '' && !pasted && <span className="small">Ei kelpaa koodiksi.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
