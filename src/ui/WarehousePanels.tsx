import { tagName, zoneName } from '../content/alerts';
import { ui } from '../content/ui';
import type { Simulation } from '../sim/engine';
import type { WorldDef } from '../sim/world';

/** Work in progress per station: carriers the system places there and the longest current dwell. */
export function StationsPanel({ sim, world }: { sim: Simulation; world: WorldDef }) {
  const stations = world.zones.filter((z) => z.tags?.includes('station-wip'));
  const carriers = world.tags.filter(
    (t) =>
      t.carrier.type === 'asset' && world.assets.find((a) => a.id === t.carrier.id)?.cls === 'wip_carrier',
  );
  return (
    <section className="stations" aria-label={ui.dashboard.stations} data-testid="stations">
      <h3>{ui.dashboard.stations}</h3>
      <div className="kpis">
        {stations.map((z) => {
          // Zone membership as SOLIX confirmed it from reports, with the time each carrier arrived.
          const here = carriers.filter((t) => sim.rules.zonesOf(t.id).has(z.id));
          const dwell = Math.max(
            0,
            ...here.map((t) => sim.time - (sim.rules.zonesOf(t.id).get(z.id) ?? sim.time)),
          );
          const rule = world.rules.find((r) => r.type === 'dwell' && r.zoneId === z.id);
          const over = rule && rule.type === 'dwell' && dwell > rule.maxS;
          return (
            <div key={z.id} className={over ? 'below' : undefined} data-testid={`station-${z.id}`}>
              <b>{ui.dashboard.wip(here.length)}</b>
              <span>
                {zoneName(z.id)}
                {here.length ? `, ${ui.dashboard.dwell(dwell)}` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Evacuation: badges at the muster point out of everyone who should be there, and who is missing. */
export function MusterPanel({ sim, world }: { sim: Simulation; world: WorldDef }) {
  const s = sim.rules.musterStatus('muster');
  return (
    <section className="muster" aria-label={ui.dashboard.muster} data-testid="muster">
      <h3>{ui.dashboard.muster}</h3>
      <p className="muster-count">
        <b data-testid="muster-count">{ui.dashboard.musterCount(s.present, s.total)}</b>
      </p>
      {s.missing.length > 0 && (
        <ul>
          {s.missing.map((tagId) => {
            const r = sim.report(tagId);
            const where = r?.roomId ?? r?.zoneIds.find((z) => z !== 'hall') ?? r?.zoneIds[0];
            return (
              <li key={tagId} data-testid="muster-missing">
                <strong>{tagName(world, tagId)}</strong>
                <span>
                  {ui.dashboard.missing}: {where ? zoneName(where) : ui.dashboard.unknownLocation}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
