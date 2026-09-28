import { useState } from 'react';
import { unapprovedClaims } from '../content';
import { ui } from '../content/ui';

/** Dev-only list of every unapproved claim (SPEC section 3). On the preview it shows only with ?claims. */
export function ClaimsOverlay() {
  const items = unapprovedClaims();
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has('claims'));
  return (
    <aside className="claims-overlay" aria-label={ui.dev.claimsTitle} data-testid="claims-overlay">
      <button type="button" className="claims-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {ui.dev.claimsToggle}: {items.length} unapproved
      </button>
      {open && (
        <div className="claims-panel">
          <h2>{ui.dev.claimsTitle}</h2>
          {items.length === 0 ? (
            <p>{ui.dev.claimsEmpty}</p>
          ) : (
            <ul>
              {items.map((c) => (
                <li key={c.id}>
                  <code>{c.id}</code>
                  <p>{c.text}</p>
                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {c.sourceUrl}
                  </a>
                  {c.note && <p className="claims-note">{c.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
