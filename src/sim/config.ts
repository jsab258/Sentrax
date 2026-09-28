import type { InfraModel } from './world';

/**
 * Simulation parameters.
 *
 * ALL VALUES ARE ILLUSTRATIVE. They are tuned so the simulated behaviour matches the positioning bands the
 * demo is allowed to show (RSSI 3 to 5 m typical error, AoA sub-meter, BiLink room-level). They are not
 * Sentrax product specifications. Where a value is inspired by a datasheet, the comment says so.
 */

export const simConfig = {
  /** Fixed simulation step (SPEC section 6: 10 Hz). Rendering interpolates between steps. */
  stepHz: 10,
  /**
   * Simulation time run off-screen before the first rendered frame of any scene, story or teaser, so every
   * tag is already located and visitors never see the startup grace period (rules.warmupS).
   */
  preRollS: 30,
  /** Upper bound on steps per rendered frame, so a slow frame cannot trigger a catch-up spiral. */
  maxStepsPerAdvance: 80,

  rf: {
    /** Received power at 1 m from a tag, line of sight. Typical BLE beacon value. */
    rssiAt1mDbm: -59,
    /** Log-distance path loss exponent for the true propagation, indoors. */
    pathLossExponent: 2.3,
    /** Outdoors (both ends outside the building) the signal falls off more slowly. */
    pathLossExponentOutdoor: 2.0,
    /** Fast fading and measurement noise per received packet (Gaussian, dB). */
    noiseSigmaDb: 3.5,
    /** Slow shadowing per tag-receiver link (dB), spatially correlated as the tag moves. */
    shadowSigmaDb: 2,
    shadowDecorrelationM: 3,
    /** Attenuation per wall crossing (dB). */
    wallAttenuationDb: {
      concrete: 12,
      drywall: 7,
      glass: 3,
      insulated: 18,
      mesh: 1,
      metal: 20,
    },
    /** Attenuation of a door opening (dB): open door frames and clutter, or a closed door leaf. */
    doorAttenuationDb: {
      open: 2,
      closed: 8,
      closedDock: 18,
    },
  },

  /**
   * Receiver sensitivity and maximum range per model. Ranges echo the datasheet figures. Gateways may set
   * their own RSSI fix floor and proximity level (see rssi below): the outdoor LEF-3 on its pole hears
   * across open ground, so any packet it receives places a tag in its coverage area.
   */
  receivers: {
    'NODIX CEN-1': { sensitivityDbm: -90, rangeM: 15 },
    'ZENIX LEN-1': { sensitivityDbm: -92, rangeM: 50 },
    'ZENIX LEN-2': { sensitivityDbm: -92, rangeM: 50 },
    'ZENIX LON-2': { sensitivityDbm: -90, rangeM: 30 },
    'ZENIX LEF-3': { sensitivityDbm: -94, rangeM: 60, fixFloorDbm: -92, proximityDbm: -92 },
  } as Record<
    InfraModel,
    { sensitivityDbm: number; rangeM: number; fixFloorDbm?: number; proximityDbm?: number }
  >,

  /** Advertising interval per tag model at rest (s). Datasheets allow 100 ms to 10 s; demo settings. */
  tagAdvIntervalS: {
    'PINIX TOW-1': 1.0,
    'PINIX TOW-5': 1.0,
    'PINIX TOK-1': 0.5,
    'PINIX TOB-1': 0.5,
  },
  /** Faster advertising while the tag's accelerometer detects motion (all four models have one). */
  tagAdvIntervalMovingS: {
    'PINIX TOW-1': 0.3,
    'PINIX TOW-5': 0.3,
    'PINIX TOK-1': 0.3,
    'PINIX TOB-1': 0.3,
  },
  /** Movement per step above which a tag counts as moving (m). */
  tagMotionThresholdM: 0.02,

  rssi: {
    /** Samples older than this are ignored. */
    windowS: 4,
    /** Path loss exponent the estimator assumes. It does not know about walls. */
    estimatorPathLossExponent: 2.3,
    /** Gateways used for an estimate: the strongest N. */
    maxGateways: 5,
    /**
     * A fix needs at least this many gateways whose mean RSSI is above the floor. Fewer or weaker links
     * give no fix rather than a wild one (one weak packet from a gateway 40 m away cannot place a tag).
     */
    minGateways: 2,
    floorDbm: -88,
    /** With a single usable gateway this strong, the tag is reported near it (proximity). */
    proximityDbm: -80,
    /** Estimate is recomputed at this interval (s). */
    updateS: 0.5,
    /** Exponential smoothing of successive position estimates (0 to 1, higher is snappier). */
    smoothingAlpha: 0.35,
    uncertaintyMinM: 2,
    uncertaintyMaxM: 15,
    staleS: 6,
  },

  aoa: {
    /** Angular noise per axis (SPEC: about 2 to 5 degrees). */
    angleNoiseDeg: 3,
    /** Share of measurements hit by multipath, and their larger noise. */
    outlierProbability: 0.02,
    outlierNoiseDeg: 15,
    /** Locators look down; tags further off-axis than this are not measured. */
    fovHalfAngleDeg: 70,
    minLocators: 2,
    smoothingAlpha: 0.6,
    /** Jumps larger than this reset the smoothing instead of averaging. */
    resetJumpM: 3,
    staleS: 2.5,
  },

  bilink: {
    /** Exponential moving average of RSSI per tag at each anchor. */
    filterAlpha: 0.35,
    /** Anchor validates presence above enter and keeps it until below exit (hysteresis). */
    enterDbm: -77,
    exitDbm: -82,
    /** Presence is validated only after the filtered value stays above enter for this long (s). */
    validateS: 2,
    /**
     * A gap longer than this between two packets restarts validation. A weak link through a wall is heard
     * only on its loudest packets (the rest fall below sensitivity), so its average looks too strong; a
     * steady packet train is what proves the tag is in the room. Tags advertise at least every 1 s.
     */
    maxPacketGapS: 1.6,
    /** An anchor forgets a tag not heard for this long. */
    presenceTimeoutS: 6,
    /** A stronger room must beat the current one by this margin to take over (dB). */
    switchMarginDb: 4,
    /** Minimum time between two room assignment changes for a tag (s). */
    minDwellS: 3,
    /** Anchor to gateway relay latency (s), uniform in [min, max]. */
    relayLatencyMinS: 0.2,
    relayLatencyMaxS: 0.6,
    /** Gateway to SOLIX backhaul latency (s). */
    backhaulLatencyS: 0.05,
    /** Battery anchors only send a keep-alive for a present tag at this interval (s). */
    heartbeatS: 15,
    /** SOLIX drops the room assignment when no relay arrived for this long (s). */
    lostAfterS: 40,
  },

  rules: {
    /** No alerts in the first seconds after start, while the system locates every tag. */
    warmupS: 20,
    zoneEnterDebounceS: 1.5,
    zoneExitDebounceS: 2.5,
    parConfirmS: 2,
    /** A crossing counts once the tag has been on the far side for this long. */
    gateConfirmS: 4,
    /** A gate visit is cancelled once the tag has been back on its original side for this long. */
    gateReturnS: 10,
    /** A tag that goes silent in the gate zone after passing it counts as having crossed (exit by disappearance). */
    gateLostS: 8,
    sensorConfirmS: 5,
    /** Sensor alerts clear only once the value is back inside the limit by this margin. */
    sensorHysteresis: 0.5,
  },

  sensors: {
    fridge: {
      targetC: 5,
      ambientC: 22,
      /** Time constants of a first-order thermal model (s). */
      tauClosedS: 240,
      tauOpenS: 300,
      noiseC: 0.05,
    },
    coldPallet: {
      coldC: 3,
      ambientC: 16,
      tauS: 1200,
      noiseC: 0.05,
    },
    ambient: {
      temperatureC: 21.5,
      humidityPct: 42,
      noiseC: 0.1,
    },
  },

  agents: {
    walkMps: 1.25,
    pushMps: 1.0,
    forkliftMps: 2.5,
    tractorMps: 4.0,
    /** Carried items sit this far ahead of the carrier (m). */
    carryOffsetPersonM: 0.7,
    carryOffsetForkliftM: 1.3,
    pickupReachM: 2.5,
    /** Forklift: load height right after a pick, then lowered to travel height at this speed (m/s). */
    forkLowerMps: 0.5,
    forkTravelM: 0.3,
    /** Yard tractor: fifth wheel behind the tractor centre, and kingpin to rear axle of a trailer (m). */
    fifthWheelM: 1.0,
    trailerAxleM: 10.5,
    /** Box trailer footprint from the nose (m), for loads carried inside it. */
    trailerLengthM: 13.6,
    trailerWidthM: 2.5,
  },
} as const;

export type SimConfig = typeof simConfig;
