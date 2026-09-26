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
    hospital: 'Hospital',
    warehouse: 'Warehouse and Manufacturing',
  },
  loading: {
    label: 'Loading scene',
    percent: (p: number) => `${Math.round(p)} percent`,
  },
  placeholderStage: {
    title: 'Scene preview',
    body: 'Setup build. The hospital and warehouse scenes arrive in later milestones.',
  },
  fallback: {
    title: 'This demo needs WebGL2',
    body: 'Your browser or device cannot display the interactive 3D view. You can still talk to us about real-time location for your hospital, warehouse or production site.',
  },
  dev: {
    claimsTitle: 'Unapproved content',
    claimsEmpty: 'All claims are approved.',
    claimsToggle: 'Claims',
    brandPlaceholderWarning:
      'Brand tokens are placeholders. They are not Sentrax colors or fonts yet. Run npm run brand:extract once sentrax.com is reachable.',
  },
} as const;
