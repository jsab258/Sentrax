import type { SimConfig } from './config';
import type { Vec3 } from './geometry';
import type { Rng } from './rng';
import type { ZoneIndex } from './zones';
import type { InfraDeviceDef, SensorKind, SensorSourceDef, TagDef, WorldDef } from './world';

interface FridgeState {
  def: Extract<SensorSourceDef, { kind: 'fridge' }>;
  tempC: number;
  doorOpen: boolean;
}

interface ColdPalletState {
  def: Extract<SensorSourceDef, { kind: 'coldPallet' }>;
  tempC: number;
}

/**
 * Physical states that sensors read, with first-order thermal models (illustrative):
 * a medication fridge whose door can be left open, cold pallets that warm up outside the cold room, and
 * room climate at the ZENIX LEN-2 gateways.
 */
export class SensorSystem {
  private readonly fridges = new Map<string, FridgeState>();
  private readonly coldPallets = new Map<string, ColdPalletState>();
  private readonly devices = new Map<string, InfraDeviceDef>();

  constructor(
    world: WorldDef,
    private readonly cfg: SimConfig,
    private readonly rng: Rng,
    private readonly zones: ZoneIndex,
  ) {
    for (const d of world.devices) this.devices.set(d.id, d);
    for (const s of world.sensors) {
      if (s.kind === 'fridge')
        this.fridges.set(s.assetId, { def: s, tempC: cfg.sensors.fridge.targetC, doorOpen: false });
      if (s.kind === 'coldPallet')
        this.coldPallets.set(s.assetId, { def: s, tempC: cfg.sensors.coldPallet.coldC });
    }
  }

  /** Opens or closes a fridge door. Returns false if the id is not a fridge door. */
  setFridgeDoor(doorId: string, open: boolean): boolean {
    for (const f of this.fridges.values()) {
      if (f.def.doorId === doorId) {
        f.doorOpen = open;
        return true;
      }
    }
    return false;
  }

  fridgeDoorOpen(assetId: string): boolean {
    return this.fridges.get(assetId)?.doorOpen ?? false;
  }

  step(dt: number, assetPosition: (assetId: string) => Vec3): void {
    const fc = this.cfg.sensors.fridge;
    for (const f of this.fridges.values()) {
      const target = f.doorOpen ? fc.ambientC : fc.targetC;
      const tau = f.doorOpen ? fc.tauOpenS : fc.tauClosedS;
      f.tempC += (target - f.tempC) * (dt / tau);
    }
    const pc = this.cfg.sensors.coldPallet;
    for (const p of this.coldPallets.values()) {
      const at = assetPosition(p.def.assetId);
      const inCold = this.zones.zonesAt(at).some((z) => p.def.coldZoneIds.includes(z));
      const target = inCold ? pc.coldC : pc.ambientC;
      p.tempC += (target - p.tempC) * (dt / pc.tauS);
    }
  }

  /** Values a tag reports in its advertising packets. */
  readTag(tag: TagDef): Partial<Record<SensorKind, number>> {
    if (!tag.sensors?.length || tag.carrier.type !== 'asset') return {};
    const out: Partial<Record<SensorKind, number>> = {};
    const fridge = this.fridges.get(tag.carrier.id);
    const pallet = this.coldPallets.get(tag.carrier.id);
    if (tag.sensors.includes('temperature')) {
      if (fridge) out.temperature = fridge.tempC + this.rng.normal(0, this.cfg.sensors.fridge.noiseC);
      else if (pallet)
        out.temperature = pallet.tempC + this.rng.normal(0, this.cfg.sensors.coldPallet.noiseC);
    }
    if (tag.sensors.includes('humidity') && (fridge || pallet)) {
      out.humidity = this.cfg.sensors.ambient.humidityPct + this.rng.normal(0, 0.5);
    }
    return out;
  }

  /** Room climate measured by a gateway with environmental sensors (ZENIX LEN-2). */
  readDevice(deviceId: string): { temperatureC: number; humidityPct: number } | undefined {
    const d = this.devices.get(deviceId);
    if (!d || d.model !== 'ZENIX LEN-2') return undefined;
    const a = this.cfg.sensors.ambient;
    const cold = this.zones.zonesAt(d.position).some((z) => this.zones.byId.get(z)?.tags?.includes('cold'));
    const base = cold ? this.cfg.sensors.coldPallet.coldC : a.temperatureC;
    return {
      temperatureC: base + this.rng.normal(0, a.noiseC),
      humidityPct: a.humidityPct + this.rng.normal(0, 0.5),
    };
  }
}
