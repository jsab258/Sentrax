import type { Vec2, Vec3 } from './geometry';

/**
 * World schema: a scene is plain data (SPEC section 6). Geometry is in plan metres (x east, y north,
 * z height). Display names are not stored here; they live in /src/content, keyed by these ids.
 */

export type InfraModel = 'NODIX CEN-1' | 'ZENIX LEN-1' | 'ZENIX LEN-2' | 'ZENIX LON-2' | 'ZENIX LEF-3';
export type TagModel = 'PINIX TOW-1' | 'PINIX TOW-5' | 'PINIX TOK-1' | 'PINIX TOB-1';

export type ZoneKind = 'room' | 'corridor' | 'area' | 'outdoor';
export type ZoneTag =
  | 'patient'
  | 'icu'
  | 'storage'
  | 'utility'
  | 'medication'
  | 'station'
  | 'lobby'
  | 'exit'
  | 'receiving'
  | 'dock'
  | 'racking'
  | 'staging'
  | 'production'
  | 'station-wip'
  | 'buffer'
  | 'cold'
  | 'restricted'
  | 'office'
  | 'yard'
  | 'trailer'
  | 'muster'
  | 'hall'
  | 'building';

export interface ZoneDef {
  id: string;
  kind: ZoneKind;
  polygon: Vec2[];
  tags?: ZoneTag[];
  /** Larger zone this one belongs to (for example a bed bay inside the ICU). */
  parent?: string;
}

export type WallMaterial = 'concrete' | 'drywall' | 'glass' | 'insulated' | 'mesh' | 'metal';

export interface WallDef {
  id: string;
  a: Vec2;
  b: Vec2;
  material: WallMaterial;
  height: number;
}

export type DoorKind = 'swing' | 'double' | 'sliding' | 'dock' | 'elevator' | 'opening' | 'gate';

export interface DoorDef {
  id: string;
  /** The opening, lying in the wall line. */
  a: Vec2;
  b: Vec2;
  kind: DoorKind;
  open: boolean;
}

export interface NavNode {
  id: string;
  p: Vec2;
}

export interface NavGraph {
  nodes: NavNode[];
  edges: Array<[string, string]>;
}

export type InfraKind = 'anchor' | 'gateway' | 'locator';

export interface InfraDeviceDef {
  id: string;
  model: InfraModel;
  kind: InfraKind;
  position: Vec3;
  mount: 'ceiling' | 'wall' | 'pole' | 'header';
  /** For BiLink anchors: the room (zone) the anchor validates presence for. */
  roomId?: string;
  /** Per-anchor commissioning settings, overriding the defaults in config. */
  bilink?: { enterDbm?: number; exitDbm?: number; validateS?: number; filterAlpha?: number };
  power: 'battery' | 'poe';
}

export type AssetClass =
  | 'infusion_pump'
  | 'ventilator'
  | 'wheelchair'
  | 'crash_cart'
  | 'mobile_monitor'
  | 'fridge'
  | 'pallet'
  | 'cold_pallet'
  | 'wip_carrier'
  | 'trailer';

export interface RackSlot {
  aisle: string;
  bay: number;
  level: number;
}

export interface AssetDef {
  id: string;
  cls: AssetClass;
  position: Vec3;
  headingDeg?: number;
  slot?: RackSlot;
}

export type SensorKind = 'temperature' | 'humidity' | 'pressure' | 'motion';

export interface TagDef {
  id: string;
  model: TagModel;
  carrier: { type: 'asset' | 'agent'; id: string };
  /** Height of the tag above the carrier's base position (m). */
  mountHeightM: number;
  sensors?: SensorKind[];
  sosButton?: boolean;
}

export type AgentRole =
  'nurse' | 'biomed' | 'porter' | 'forklift' | 'forklift_driver' | 'picker' | 'assembly' | 'yard_tractor';

export interface RoutineStep {
  /** Nav node to walk to. */
  to: string;
  dwellS?: number;
  pickup?: string;
  drop?: string;
  /** Where a dropped asset ends up; defaults to just ahead of the agent at floor level. */
  dropAt?: Vec3;
}

export interface AgentDef {
  id: string;
  role: AgentRole;
  kind: 'person' | 'vehicle';
  start: string;
  speedMps?: number;
  routine?: RoutineStep[];
  loop?: boolean;
  /** People driving a vehicle ride on it until told to dismount. */
  rideOn?: string;
}

/** Things with a simulated physical state that sensors read. */
export type SensorSourceDef =
  | { id: string; kind: 'fridge'; assetId: string; doorId?: string }
  | { id: string; kind: 'coldPallet'; assetId: string; coldZoneIds: string[] }
  | { id: string; kind: 'ambient'; deviceId: string };

export type RuleDef =
  | { id: string; type: 'par'; zoneId: string; cls: AssetClass; min: number }
  | {
      id: string;
      type: 'geofence';
      zoneId: string;
      /** Tags allowed in the zone; everyone else raises a violation. */
      allowedTagIds?: string[];
      /** Only these carrier roles or asset classes are checked; omitted means all tags. */
      appliesTo?: Array<AgentRole | AssetClass>;
    }
  | {
      id: string;
      type: 'sensor';
      tagId: string;
      metric: SensorKind;
      max?: number;
      min?: number;
    }
  | { id: string; type: 'sos' }
  | {
      id: string;
      type: 'gate';
      /** The dock or door zone the tag must pass through. */
      gateZoneId: string;
      insideZoneIds: string[];
      outsideZoneIds: string[];
      appliesTo?: AssetClass[];
    }
  | {
      id: string;
      type: 'dwell';
      zoneId: string;
      maxS: number;
      appliesTo?: Array<AgentRole | AssetClass>;
      /** 'inside': alert when a tag stays in the zone too long. 'outside': when it stays out too long. */
      mode: 'inside' | 'outside';
    }
  | { id: string; type: 'muster'; zoneId: string; roles: AgentRole[] };

/** Static figures (patients in beds and similar). Rendered but never tracked. */
export interface FigureDef {
  id: string;
  kind: 'patient';
  position: Vec3;
  headingDeg: number;
}

export interface WorldDef {
  id: string;
  bounds: { min: Vec2; max: Vec2 };
  zones: ZoneDef[];
  walls: WallDef[];
  doors: DoorDef[];
  nav: NavGraph;
  devices: InfraDeviceDef[];
  assets: AssetDef[];
  tags: TagDef[];
  agents: AgentDef[];
  sensors: SensorSourceDef[];
  rules: RuleDef[];
  figures: FigureDef[];
}
