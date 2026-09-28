import { useState } from 'react';
import { alertLocation, alertTitle, tagName, zoneName } from '../content/alerts';
import { ui } from '../content/ui';
import { useExperience } from '../experience/store';
import type { Simulation } from '../sim/engine';
import type { AssetClass, WorldDef } from '../sim/world';
import { alertFeed } from '../experience/alertFeed';
import { slotFromReport } from '../experience/slot';
import { MiniMap } from './MiniMap';
import { TempChart } from './TempChart';
import { useSimTick } from './useSimTick';
import { MusterPanel, StationsPanel } from './WarehousePanels';

/** The zone a report places a tag in: the BiLink room, else the most specific zone. */
function reportedZone(sim: Simulation, world: WorldDef, tagId: string): string | null {
  const r = sim.report(tagId);
  if (!r) return null;
  if (r.roomId) return r.roomId;
  const zones = r.zoneIds.map((id) => world.zones.find((z) => z.id === id)).filter((z) => z !== undefined);
  const deepest = zones.find((z) => z.parent) ?? zones.find((z) => z.kind === 'room') ?? zones[0];
  return deepest?.id ?? null;
}

function assetsOfClass(world: WorldDef, cls: string) {
  return world.tags.filter(
    (t) => t.carrier.type === 'asset' && world.assets.find((a) => a.id === t.carrier.id)?.cls === cls,
  );
}

/**
 * Mock SOLIX dashboard (SPEC section 5, Insight layer): asset search with room and last seen, alerts with
 * acknowledge, KPIs and a mini floor map. Right-side panel on desktop, bottom sheet on mobile. Everything
 * shown comes from what the system reports, never from ground truth.
 */
export function Dashboard({ sim, world }: { sim: Simulation; world: WorldDef }) {
  useSimTick(4);
  const stepUi = useExperience((s) => s.stepUi);
  const focus = useExperience((s) => s.focus);
  const selected = useExperience((s) => s.selectedTag);
  const heatmap = useExperience((s) => s.heatmap);
  const mode = useExperience((s) => s.mode);
  const set = useExperience((s) => s.set);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const q = (stepUi.search ?? query).trim().toLowerCase();

  const assets = world.tags
    .filter((t) => t.carrier.type === 'asset')
    .map((t) => {
      const zone = reportedZone(sim, world, t.id);
      const seen = sim.lastSeen(t.id);
      // Racked pallets: the slot from the reported 3D position (AoA), otherwise the zone.
      const slot = slotFromReport(sim.report(t.id));
      const where = slot
        ? ui.dashboard.slot(slot.aisle, slot.bay, slot.level)
        : zone
          ? zoneName(zone)
          : sim.report(t.id)
            ? ui.dashboard.notInRoom
            : ui.dashboard.unknownLocation;
      return {
        tagId: t.id,
        name: tagName(world, t.id),
        where,
        age: seen === undefined ? null : sim.time - seen,
      };
    })
    .filter((a) => !q || a.name.toLowerCase().includes(q) || a.where.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  const alerts = alertFeed(sim);
  const active = alerts.filter((a) => a.clearedAt === undefined);
  const located = world.tags.filter(
    (t) => t.carrier.type === 'asset' && sim.report(t.id) && !sim.report(t.id)?.held,
  ).length;
  const parRules = world.rules.filter((r): r is Extract<typeof r, { type: 'par' }> => r.type === 'par');
  const nearest = stepUi.nearest
    ? assetsOfClass(world, stepUi.nearest.cls)
        .map((t) => ({ t, zone: reportedZone(sim, world, t.id) }))
        .find((x) => x.zone && x.zone !== stepUi.nearest?.zoneId)
    : undefined;
  const chartTag = stepUi.chart?.tagId;
  const sensorRule = world.rules.find((r) => r.type === 'sensor' && r.tagId === chartTag);
  const limit = sensorRule && sensorRule.type === 'sensor' ? sensorRule.max : undefined;

  return (
    <aside
      className={`dashboard${open ? ' is-open' : ''}`}
      data-testid="dashboard"
      aria-label={ui.dashboard.title}
    >
      <button
        type="button"
        className="dashboard-handle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <strong>{ui.dashboard.title}</strong>
        <span>
          {active.length
            ? `${active.length} ${ui.dashboard.activeAlerts.toLowerCase()}`
            : ui.dashboard.subtitle}
        </span>
      </button>
      <div className="dashboard-body">
        <header className="dashboard-header">
          <div>
            <strong>{ui.dashboard.title}</strong> <span>{ui.dashboard.subtitle}</span>
          </div>
          <span className="sim-label">{ui.simulatedData}</span>
        </header>

        <section className="kpis" aria-label={ui.dashboard.overview}>
          <div>
            <b>{world.tags.filter((t) => t.carrier.type === 'asset').length}</b>
            <span>{ui.dashboard.tracked}</span>
          </div>
          <div>
            <b>{located}</b>
            <span>{ui.dashboard.located}</span>
          </div>
          <div className={active.length ? 'has-alerts' : undefined}>
            <b>{active.length}</b>
            <span>{ui.dashboard.activeAlerts}</span>
          </div>
          {parRules.map((r) => {
            const n = assetsOfClass(world, r.cls).filter((t) =>
              sim.report(t.id)?.zoneIds.includes(r.zoneId),
            ).length;
            return (
              <div key={r.id} className={n < r.min ? 'below' : undefined}>
                <b>
                  {n} of {r.min}
                </b>
                <span>
                  {zoneName(r.zoneId)} {classLabel(r.cls)}
                </span>
              </div>
            );
          })}
        </section>

        {(stepUi.stations || (mode === 'sandbox' && world.id === 'warehouse')) && (
          <StationsPanel sim={sim} world={world} />
        )}
        {(stepUi.muster || sim.rules.musterStatus('muster').present > 0) && (
          <MusterPanel sim={sim} world={world} />
        )}

        {chartTag && <TempChart sim={sim} tagId={chartTag} limit={limit} />}

        <section className="alerts" aria-label={ui.dashboard.alerts} data-testid="alerts">
          <h3>{ui.dashboard.alerts}</h3>
          {alerts.length === 0 && <p className="muted">{ui.dashboard.noAlerts}</p>}
          <ul>
            {alerts.slice(0, 5).map((a) => (
              <li
                key={a.id}
                className={`alert alert-${a.kind === 'sos' || a.kind === 'geofence' ? 'critical' : 'warning'}${a.clearedAt !== undefined ? ' is-cleared' : ''}`}
              >
                <strong>{alertTitle(world, a)}</strong>
                <span>
                  {alertLocation(a)}, {ui.dashboard.since((a.clearedAt ?? sim.time) - a.startedAt)}
                </span>
                {a.clearedAt !== undefined ? (
                  <span className="status">{ui.dashboard.cleared}</span>
                ) : a.acknowledgedAt !== undefined ? (
                  <span className="status">{ui.dashboard.acknowledged}</span>
                ) : (
                  <button type="button" onClick={() => sim.command({ type: 'acknowledge', alertId: a.id })}>
                    {ui.dashboard.acknowledge}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {nearest && (
            <p className="nearest" data-testid="nearest">
              {ui.dashboard.nearest}: <strong>{tagName(world, nearest.t.id)}</strong>,{' '}
              {zoneName(nearest.zone)}
            </p>
          )}
        </section>

        <section className="assets" aria-label={ui.dashboard.assets}>
          <h3>{ui.dashboard.assets}</h3>
          <input
            type="search"
            placeholder={ui.dashboard.search}
            aria-label={ui.dashboard.search}
            value={stepUi.search ?? query}
            readOnly={stepUi.search !== undefined}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="asset-search"
          />
          <ul data-testid="asset-list">
            {assets.length === 0 && <li className="muted">{ui.dashboard.noResults}</li>}
            {assets.map((a) => (
              <li
                key={a.tagId}
                className={focus.includes(a.tagId) || selected === a.tagId ? 'is-focus' : undefined}
              >
                <button
                  type="button"
                  onClick={() => set({ selectedTag: selected === a.tagId ? null : a.tagId })}
                >
                  <strong>{a.name}</strong>
                  <span data-testid={`asset-where-${a.tagId}`}>
                    {a.where}
                    {a.age !== null ? `, ${ui.dashboard.lastSeen(a.age)}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="map" aria-label={ui.dashboard.map}>
          <h3>{ui.dashboard.map}</h3>
          <MiniMap sim={sim} world={world} focus={focus.length ? focus : selected ? [selected] : []} />
          <label className="toggle">
            <input type="checkbox" checked={heatmap} onChange={(e) => set({ heatmap: e.target.checked })} />
            {ui.dashboard.heatmap}
          </label>
        </section>
      </div>
    </aside>
  );
}

function classLabel(cls: AssetClass): string {
  return ({ ventilator: 'ventilators', infusion_pump: 'pumps' } as Record<string, string>)[cls] ?? cls;
}
