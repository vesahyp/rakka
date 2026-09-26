import { useEffect, useRef, useState } from 'react';
import { loadInitials, saveInitials, submitScore, type Period, PERIOD_LABELS } from '../api';
import type { RunSummary } from './Game';

/**
 * Three letters, like a pinball machine. A hidden input drives the keyboard
 * on phones; the three boxes show what it holds.
 */
export function Initials({ r, onDone }: { r: RunSummary; onDone: (ranks: Record<Period, number> | null) => void }) {
  const [name, setName] = useState(() => loadInitials());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  const ok = name.length === 3;

  const send = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setError('');
    saveInitials(name);
    try {
      const ranks = await submitScore({ name, character: r.character.id, time: r.time, level: r.level, kills: r.kills, bosses: r.bosses });
      onDone(ranks);
    } catch {
      setError('Tulos ei mennyt perille. Paikallinen tulos on tallessa.');
      setBusy(false);
    }
  };

  return (
    <div className="initials" data-ui onClick={() => input.current?.focus()}>
      <div className="small">Nimikirjaimet tulostaululle</div>
      <div className="boxes">
        {[0, 1, 2].map((i) => (
          <div key={i} className={'box' + (name.length === i ? ' active' : '')}>
            {name[i] ?? ''}
          </div>
        ))}
      </div>
      <input
        ref={input}
        value={name}
        onChange={(e) => setName(clean(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void send();
        }}
        maxLength={3}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        aria-label="Nimikirjaimet"
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1, left: -9999 }}
      />
      {error && <div className="small" style={{ color: 'var(--danger)' }}>{error}</div>}
      <div className="row">
        <button className="btn primary" disabled={!ok || busy} onClick={() => void send()}>
          {busy ? 'Lähetetään' : 'Tallenna'}
        </button>
        <button className="btn ghost" onClick={() => onDone(null)}>
          Ohita
        </button>
      </div>
    </div>
  );
}

export function RankLine({ ranks }: { ranks: Record<Period, number> }) {
  const best = (Object.keys(ranks) as Period[]).map((p) => [p, ranks[p]] as const).sort((a, b) => a[1] - b[1]);
  return (
    <div className="ranks">
      {best.map(([p, n]) => (
        <span key={p} className={n <= 3 ? 'top' : ''}>
          {PERIOD_LABELS[p]} #{n}
        </span>
      ))}
    </div>
  );
}
