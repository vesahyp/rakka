import { useUpdateAvailable, reloadApp } from '../version';

/** A small banner when a newer build is on the server. */
export function UpdateBanner() {
  const has = useUpdateAvailable();
  if (!has) return null;
  return (
    <div className="update" data-ui>
      <span>Uusi versio on saatavilla.</span>
      <button className="btn primary" onClick={reloadApp}>
        Päivitä
      </button>
    </div>
  );
}
