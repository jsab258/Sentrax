import { useEffect, useRef, useState } from 'react';
import { credits, creditsNote } from '../content/credits';
import { ui } from '../content/ui';

/** Display form of an ASSETS.md name (drops the code marks around texture set ids). */
const label = (name: string) => name.replace(/`/g, '');

/**
 * Credits (SPEC section 10): every third-party asset from ASSETS.md and the open-source libraries, in a
 * modal dialog (focus stays inside, Escape closes, focus returns to the Credits button).
 */
export function CreditsButton() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="stage-credits"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-testid="credits-open"
      >
        {ui.credits.open}
      </button>
      <dialog
        ref={dialog}
        className="credits"
        aria-labelledby="credits-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // A click on the backdrop (the dialog element itself, outside its content) closes it.
          if (e.target === e.currentTarget) setOpen(false);
        }}
        data-testid="credits"
      >
        {open && (
          <div className="credits-body">
            <header className="credits-head">
              <h2 id="credits-title">{ui.credits.title}</h2>
              <button
                type="button"
                className="credits-close"
                aria-label={ui.credits.close}
                onClick={() => setOpen(false)}
                data-testid="credits-close"
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>
            <p className="credits-intro">{ui.credits.intro}</p>
            {credits.map((g) => (
              <section key={g.title} className="credits-group">
                <h3>{g.title}</h3>
                <ul>
                  {g.items.map((c) => (
                    <li key={c.name}>
                      <a href={c.url} target="_blank" rel="noopener noreferrer">
                        {label(c.name)}
                        <span className="visually-hidden"> ({ui.cta.newTabHint})</span>
                      </a>
                      <span className="credits-meta">
                        {c.author}, {c.license}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="credits-note">{creditsNote}</p>
          </div>
        )}
      </dialog>
    </>
  );
}
