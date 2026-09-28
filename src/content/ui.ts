import { claims } from './claims';

/** UI strings. English only for now; keep every visible label here so it can be translated later. */
export const ui = {
  appTitle: 'Sentrax interactive RTLS demo',
  brandName: 'Sentrax',
  simulatedData: 'Simulated data',
  cta: {
    bookMeeting: 'Book a meeting',
    exploreDemo: 'Explore the interactive demo',
    exploreFreely: 'Explore freely',
    newTabHint: 'opens in a new tab',
  },
  scenes: {
    label: 'Scene',
    hospital: 'Hospital',
    warehouse: 'Warehouse and Manufacturing',
  },
  quality: {
    label: 'Quality',
    auto: 'Auto',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  },
  guided: {
    stories: 'Stories',
    next: 'Next',
    back: 'Back',
    autoplay: 'Autoplay',
    pause: 'Pause',
    skip: 'Skip',
    replay: 'Replay story',
    stepOf: (n: number, m: number) => `Step ${n} of ${m}`,
    withoutRtls: 'Without RTLS',
    takeaway: 'Takeaway',
    sandbox: 'Explore',
    unapprovedClaim: 'Unapproved claim, shown for review only',
    storyList: 'Choose a story',
    closeList: 'Close story list',
    nextStory: (title: string) => `Next story: ${title}`,
    storyNumber: (n: number, m: number) => `Story ${n} of ${m}`,
    running: 'Playing',
    ready: 'Ready for the next step',
    keyboardHint: 'Arrow keys: back and next',
    controls: 'Story controls',
  },
  modes: {
    label: 'Mode',
    guided: 'Guided',
    sandbox: 'Explore',
  },
  layers: {
    title: 'Layers',
    physical: 'Physical',
    radio: 'Radio',
    data: 'Data',
    insight: 'Insight',
  },
  lens: {
    title: 'Technology lens',
    names: {
      hybrid: 'Hybrid',
      rssi: 'RSSI',
      aoa: 'AoA',
      bilink: 'BiLink',
    },
    notes: {
      hybrid: 'Each tag shown with the technology SOLIX uses for it.',
      rssi: `RSSI: ${claims.rssiAccuracy.text} with a gateway grid.`,
      rssiHospital: claims.rssiHospitalLens.text,
      aoa: `AoA: ${claims.aoaAccuracy.text} from ceiling locators.`,
      bilink: `BiLink: ${claims.bilinkAccuracy.text} from a battery anchor per room.`,
    },
    noFix: {
      rssi: 'No RSSI fix: no gateway hears this tag',
      aoa: 'No AoA fix: outside locator coverage',
    },
  },
  dashboard: {
    title: 'SOLIX',
    subtitle: 'RTLS and IoT platform',
    open: 'Open dashboard',
    close: 'Close dashboard',
    search: 'Search assets',
    assets: 'Assets',
    alerts: 'Alerts',
    overview: 'Overview',
    map: 'Floor map',
    mapLabel: 'Floor map with reported asset locations',
    acknowledge: 'Acknowledge',
    acknowledged: 'Acknowledged',
    cleared: 'Cleared',
    noAlerts: 'No active alerts',
    noResults: 'No matching assets',
    lastSeen: (s: number) => (s < 2 ? 'seen just now' : `last seen ${Math.round(s)} s ago`),
    since: (s: number) => `for ${formatDuration(s)}`,
    unknownLocation: 'Location unknown',
    notInRoom: 'Between rooms',
    heatmap: 'Dwell heatmap',
    nearest: 'Nearest available',
    tracked: 'Tracked assets',
    located: 'Located now',
    activeAlerts: 'Active alerts',
    temperature: 'Temperature',
    stations: 'Work in progress',
    wip: (n: number) => `${n} WIP`,
    dwell: (s: number) => `longest ${formatDuration(s)}`,
    muster: 'Muster point',
    musterCount: (present: number, total: number) => `${present} of ${total} at the muster point`,
    missing: 'Missing, last seen',
    slot: (aisle: string, bay: number, level: number) => `Aisle ${aisle}, bay ${bay}, level ${level}`,
  },
  integrations: {
    solix: 'SOLIX',
    solixDeployment: 'On-premise or cloud',
    gateways: 'Gateways',
    alarm: 'Alarm and nurse-call platform',
    his: 'Hospital information system / CMMS',
    wms: 'WMS / ERP',
    mes: 'MES',
    rest: 'REST',
    websocket: 'WebSocket',
    idle: 'Waiting for events',
  },
  compare: {
    conventional: 'Conventional',
    bilink: 'BiLink',
    gateways: 'Gateways',
    powered: 'Powered devices',
    cables: 'Cable runs',
    anchors: 'Battery anchors',
    title: 'Infrastructure for this ward',
    source: 'Counted from the devices in the scene.',
  },
  anchorState: {
    rejected: 'Rejected',
    accepted: 'Accepted',
  },
  loading: {
    label: 'Loading scene',
    percent: (p: number) => `${Math.round(p)} percent`,
  },
  fallback: {
    title: 'This demo needs WebGL2',
    body: 'Your browser or device cannot display the interactive 3D view. You can still talk to us about real-time location for your hospital, warehouse or production site.',
  },
  simDebug: {
    title: 'Simulation debug view',
    scene: 'Scene',
    seed: 'Seed',
    time: 'Time',
    speed: 'Speed',
    pause: 'Pause',
    play: 'Play',
    reset: 'Reset',
    layers: 'Layers',
    layerNames: {
      truth: 'Ground truth',
      rssi: 'RSSI estimate',
      aoa: 'AoA estimate',
      bilink: 'BiLink rooms and relays',
      hybrid: 'Hybrid report',
      errors: 'Error lines',
      nav: 'Navigation graph',
      labels: 'Labels',
    },
    stats: 'Accuracy against ground truth, last 30 s',
    rssiMedian: 'RSSI median error',
    aoaMedian: 'AoA median error (inside coverage)',
    bilinkCorrect: 'BiLink correct room (tags still for 6 s or more)',
    events: 'Events',
    alerts: 'Active alerts',
    scenarios: 'Scenarios',
    none: 'None',
    selected: 'Selected tag',
    clickHint: 'Click near a tag to inspect it.',
    legend:
      'Black dot: true position. Blue: RSSI. Pink: AoA. Violet: BiLink room and relay. Ring: hybrid report.',
    sceneNames: {
      hospital: 'Hospital',
      warehouse: 'Warehouse and Manufacturing',
      'test-rssi': 'Test layout: RSSI hall',
      'test-aoa': 'Test layout: AoA area',
      'test-bilink': 'Test layout: BiLink rooms',
      'test-dock': 'Test layout: dock door',
    },
  },
  dev: {
    claimsTitle: 'Unapproved content',
    claimsEmpty: 'All claims are approved.',
    claimsToggle: 'Claims',
    brandPlaceholderWarning:
      'Brand tokens are placeholders. They are not Sentrax colors or fonts yet. Run npm run brand:extract once sentrax.com is reachable.',
  },
} as const;

function formatDuration(s: number): string {
  const total = Math.max(0, Math.round(s));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m ? `${m} min ${sec} s` : `${sec} s`;
}

/** Stopwatch reading, minutes and seconds (for example 04:35). */
export function formatClock(s: number): string {
  const total = Math.max(0, Math.floor(s));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
