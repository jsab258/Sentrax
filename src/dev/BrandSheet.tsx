import { brand, fontStack } from '../brand/brand';
import { deviceList, type DeviceSize } from '../content/devices';
import { ui } from '../content/ui';

/** Dev-only reference page (?dev=brand): current brand tokens and the device catalogue status. */
export function BrandSheet() {
  return (
    <main className="brand-sheet" data-testid="brand-sheet">
      <h1>Brand and device reference</h1>
      {brand.status === 'placeholder' && (
        <p className="warning" role="status">
          {ui.dev.brandPlaceholderWarning}
        </p>
      )}

      <section>
        <h2>UI colors ({brand.status})</h2>
        <div className="swatches">
          {Object.entries(brand.colors).map(([name, value]) => (
            <Swatch key={name} name={name} value={value} />
          ))}
        </div>
      </section>

      <section>
        <h2>Elementor global kit (verbatim, not used)</h2>
        <div className="swatches">
          {Object.entries(brand.kit).map(([name, value]) => (
            <Swatch key={name} name={name} value={value} />
          ))}
        </div>
      </section>

      <section>
        <h2>Overlay colors for Radio, Data and Insight (tints and shades of the visible brand colors)</h2>
        <div className="swatches">
          {Object.entries(brand.overlay).flatMap(([name, value]) =>
            (Array.isArray(value) ? value : [value]).map((v, i) => (
              <Swatch
                key={`${name}-${i}`}
                name={Array.isArray(value) ? `${name} ${i + 1}` : name}
                value={v}
              />
            )),
          )}
        </div>
      </section>

      <section>
        <h2>Typography ({brand.status})</h2>
        <p style={{ fontFamily: fontStack(brand.fonts.heading), fontSize: 28, fontWeight: 700 }}>
          Heading: {brand.fonts.heading.family}
        </p>
        <p style={{ fontFamily: fontStack(brand.fonts.body) }}>
          Body: {brand.fonts.body.family}. Real-time location for hospitals, warehouses and production.
        </p>
      </section>

      <section>
        <h2>Devices</h2>
        <table className="device-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Kind</th>
              <th>Used with (demo)</th>
              <th>Description (from site menu)</th>
              <th>Dimensions</th>
            </tr>
          </thead>
          <tbody>
            {deviceList.map((d) => (
              <tr key={d.model}>
                <td>
                  <a href={d.productUrl} target="_blank" rel="noopener noreferrer">
                    {d.model}
                  </a>
                </td>
                <td>{d.kind}</td>
                <td>{d.technologies.join(', ')}</td>
                <td>{d.description.text}</td>
                <td>{formatSize(d.sizeMm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function formatSize(s: DeviceSize): string {
  return s.shape === 'round' ? `\u00d8 ${s.diameter} x ${s.h} mm` : `${s.w} x ${s.d} x ${s.h} mm`;
}

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <figure className="swatch">
      <span className="swatch-chip" style={{ background: value }} />
      <figcaption>
        <strong>{name}</strong>
        <code>{value}</code>
      </figcaption>
    </figure>
  );
}
