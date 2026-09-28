/**
 * Credits panel (SPEC section 10). Every row of the "Recorded assets" table in ASSETS.md appears here
 * (checked by src/content/__tests__/credits.test.ts), plus the open-source libraries the app ships.
 */
export interface Credit {
  /** Matches the first column of the ASSETS.md table for recorded assets. */
  name: string;
  author: string;
  license: string;
  url: string;
}

export interface CreditGroup {
  title: string;
  items: Credit[];
}

const polyHaven = (name: string, slug: string, author: string): Credit => ({
  name,
  author,
  license: 'CC0',
  url: `https://polyhaven.com/a/${slug}`,
});

export const credits: CreditGroup[] = [
  {
    title: 'Textures and lighting (Poly Haven)',
    items: [
      polyHaven('Texture `vinyl`: Terrazzo Tiles', 'terrazzo_tiles', 'Amal Kumar'),
      polyHaven('Texture `plaster`: Painted Plaster Wall', 'painted_plaster_wall', 'Amal Kumar'),
      polyHaven('Texture `bath-tiles`: Interior Tiles', 'interior_tiles', 'Charlotte Baglioni'),
      polyHaven('Texture `veneer`: Grey Oak Veneer 01', 'grey_oak_veneer_01', 'Jenelle van Heerden'),
      polyHaven('Texture `leather`: Fabric Leather 01', 'fabric_leather_01', 'Rob Tuytel'),
      polyHaven('Texture `linen`: Cotton Jersey', 'cotton_jersey', 'colormass, Rico Cilliers'),
      polyHaven('Texture `concrete`: Smooth Concrete Floor', 'smooth_concrete_floor', 'Dimitrios Savva'),
      polyHaven('Texture `asphalt`: Clean Asphalt', 'clean_asphalt', 'Dimitrios Savva'),
      polyHaven(
        'Texture `cladding`: Corrugated Iron 02',
        'corrugated_iron_02',
        'Jenelle van Heerden, Sergej Majboroda',
      ),
      polyHaven('HDRI: Hospital Room', 'hospital_room', 'Oliksiy Yakovlyev'),
      polyHaven('HDRI: Empty Warehouse 01', 'empty_warehouse_01', 'Sergej Majboroda'),
    ],
  },
  {
    title: 'Fonts',
    items: [
      {
        name: 'Lato (400, 700, latin)',
        author: 'Lukasz Dziedzic',
        license: 'SIL OFL 1.1',
        url: 'https://www.npmjs.com/package/@fontsource/lato',
      },
      {
        name: 'Poppins (500, 600, latin)',
        author: 'Indian Type Foundry',
        license: 'SIL OFL 1.1',
        url: 'https://www.npmjs.com/package/@fontsource/poppins',
      },
    ],
  },
  {
    title: 'Software',
    items: [
      { name: 'three.js', author: 'three.js authors', license: 'MIT', url: 'https://threejs.org/' },
      {
        name: 'Basis Universal transcoder',
        author: 'Binomial LLC',
        license: 'Apache 2.0',
        url: 'https://github.com/mrdoob/three.js',
      },
      { name: 'React', author: 'Meta Platforms and contributors', license: 'MIT', url: 'https://react.dev/' },
      {
        name: 'React Three Fiber, drei, zustand, three-stdlib',
        author: 'Poimandres (pmndrs)',
        license: 'MIT',
        url: 'https://github.com/pmndrs',
      },
      {
        name: 'postprocessing',
        author: 'Raoul van Rüschen',
        license: 'Zlib',
        url: 'https://github.com/pmndrs/postprocessing',
      },
      {
        name: 'camera-controls',
        author: 'Yomotsu',
        license: 'MIT',
        url: 'https://github.com/yomotsu/camera-controls',
      },
    ],
  },
  {
    title: 'Sentrax',
    items: [
      {
        name: 'Sentrax logo',
        author: 'Sentrax GmbH',
        license: "Client's own mark",
        url: 'https://sentrax.com/',
      },
      {
        name: 'Sentrax product photos',
        author: 'Sentrax GmbH',
        license: "Client's own material",
        url: 'https://sentrax.com/',
      },
    ],
  },
];

/** Everything else in the scenes (buildings, furniture, vehicles, people, devices) is built in code. */
export const creditsNote =
  'Buildings, furniture, equipment, vehicles, people and Sentrax device models are built procedurally for this demo.';
