import { CASING, contrast, SCENE_REFERENCE, SWATCHES } from './swatches';

/** Dev-only table (?swatches=1 on the 3D stage): overlay colours, roles and contrast against the scene. */
export function SwatchPanel() {
  const refs = Object.entries(SCENE_REFERENCE);
  return (
    <aside className="swatch-panel" data-testid="swatch-panel">
      <h2>Overlay colours against the rendered hospital</h2>
      <p>
        Numbers are WCAG contrast ratios. Marks (lines, dots, outlines) need 3:1; fills are translucent
        washes. The in-scene strip shows each colour as a mark without (front row) and with (back row) a white
        casing.
      </p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Colour</th>
            <th>Role</th>
            {refs.map(([name, hex]) => (
              <th key={name}>
                <span className="swatch-dot" style={{ background: hex }} />
                {name}
              </th>
            ))}
            <th>Casing</th>
          </tr>
        </thead>
        <tbody>
          {SWATCHES.map((s, i) => (
            <tr key={s.key}>
              <td>{i + 1}</td>
              <td>
                <span className="swatch-dot" style={{ background: s.hex }} />
                <code>{s.hex}</code> {s.key}
                <br />
                <small>{s.derivation}</small>
              </td>
              <td>
                {s.role}
                <br />
                <small>{s.kind}</small>
              </td>
              {refs.map(([name, hex]) => {
                const c = contrast(s.hex, hex);
                return (
                  <td key={name} className={s.kind === 'mark' && c < 3 ? 'below' : undefined}>
                    {c.toFixed(2)}
                  </td>
                );
              })}
              <td>
                {s.kind === 'mark' && (
                  <>
                    <span className="swatch-dot" style={{ background: s.casing ?? CASING }} />
                    {contrast(s.hex, s.casing ?? CASING).toFixed(2)}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  );
}
