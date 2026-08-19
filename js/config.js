/* ------------------------------------------------------------------------
   Everything you'd want to tweak lives in this file.

   TIMING     -- how long the show runs
   TITLE      -- the words on the final frame
   HERO_ROUTE -- the flights that launch when you press space
   AIRPORTS   -- coordinates, add your own as needed
   ------------------------------------------------------------------------ */

const CONFIG = {

  /* --- timing ------------------------------------------------------------
     SEQUENCE_SECONDS is the whole show: launch -> zoom out -> everyone
     landed -> title card. Every other beat below is a fraction of it, so
     changing this one number retimes the entire piece.                     */
  SEQUENCE_SECONDS: 75,

  /* How long the title card holds before Act Two begins. */
  HOLD_SECONDS: 3,

  /* Act Two: the plane revisiting four places, building a scrapbook. */
  ACT2_SECONDS: 34,

  /* How long the drift back to Seattle takes. */
  RESET_SECONDS: 3.5,

  /* Beats, as fractions of SEQUENCE_SECONDS. */
  BEATS: {
    mapFadeIn:     [0.00, 0.09],   // black -> map
    ambientFadeOut:[0.03, 0.13],   // idle traffic clears out
    launchWindow:  [0.10, 0.26],   // hero flights leave, staggered
    zoomOut:       [0.12, 0.78],   // camera pulls back to the world
    allLanded:      0.90,          // last arrival, at the latest
    titleFadeIn:   [0.88, 0.95]    // title card appears
  },

  /* How far the map dims under the title card. The airport codes stay
     readable; the words become the thing you're looking at. The narration
     lines during the flight don't dim anything -- they sit in the band the
     camera already keeps clear, so the map keeps flying underneath. */
  TITLE_DIM: 0.62,

  /* --- camera ------------------------------------------------------------ */
  /* zoom here is written for a 1920px-wide projector and scaled from there. */
  HOME: { lat: 47.64, lon: -122.30, zoom: 8.2 },

  /* The final view fits itself to wherever HERO_ROUTES actually go. WORLD.lon
     is only the anchor deciding which way round the globe that fit is measured
     -- roughly "the middle of the map you want" -- and WORLD.lat is a fallback
     if there are no routes at all. */
  WORLD: { lat: 32.0, lon: -100.0 },
  /* Below this zoom the coastline switches to the coarse outline. Keep it low:
     the detailed set is what makes a country close-up look like that country. */
  FINE_DETAIL_ZOOM: 2.6,

  CAMERA_FOLLOW_TAU: 2.6,       // seconds for the camera to settle on a new fit
  WORLD_PADDING: 0.06,          // breathing room around the outermost airports
  WORLD_BOTTOM_RESERVE: 0.26,   // strip along the bottom kept clear for the title
  WORLD_ZOOM_PADDING: 1.04,     // never pull back further than one world-width

  /* --- radar -------------------------------------------------------------- */
  RADAR: {
    center: { lat: 47.68, lon: -122.29 },  // between SEA and PAE
    sweepSeconds: 4.0,
    rings: 5,
    radiusFraction: 0.62,     // of the smaller screen dimension
    sweepTailDegrees: 54
  },

  /* --- look ---------------------------------------------------------------
     Full greyscale. With no colour to lean on, the hierarchy is carried by
     value and glow, which is also what survives a projector in a dark room. */
  COLORS: {
    background:    '#000000',
    water:         '#0a0a0a',      // matched to the tiles' water (#090909)
    land:          '#1e1e1e',      // matched to the tiles' land grey (#262626)
    landFar:       '#1c1c1c',
    coast:         '#484848',
    border:        '#2c2c2c',
    sweep:         '#ffffff',
    ring:          '#ffffff',
    ambient:       '#8e8e8e',
    hero:          '#ffffff',
    trail:         '#ffffff',
    label:         '#d8d8d8',
    heroLabel:     '#ffffff',
    airport:       '#ffffff'
  },

  /* The tiles arrive with the wrong polarity: CARTO's dark basemap paints
     water light (grey 38) and land dark (grey 9), which is the inverse of both
     this map's vector layer and Flight Radar's own dark theme -- so land and
     water would swap brightness as the tiles cross-fade out.

     This filter flips them. It's a straight line through the two values we
     care about: 38 -> 8 (water goes near-black) and 9 -> 34 (land comes up to
     match COLORS.land). Everything between follows monotonically, so roads and
     landuse land in between as dark tracery over light ground.

       invert:      v        -> 255 - v
       brightness:  v        -> 0.364 v
       contrast:    v        -> (v - 127.5) * 2.464 + 127.5

     Applied once per tile as it loads, never per frame. Recompute the two
     constants if you ever swap basemap styles. */
  TILE_FILTER: 'grayscale(1) invert(1) brightness(0.364) contrast(2.464)',
  TILE_MAX_OPACITY: 1.0,

  /* Tiles only exist for the Puget Sound region -- below TILE_FADE[0] they're
     gone entirely and the vector world carries the view on its own. */
  TILE_ZOOM_RANGE: [6, 11],
  TILE_FADE: [5.7, 7.0],

  /* --- ambient traffic (the cold open) ------------------------------------ */
  AMBIENT_COUNT: 5,
  AMBIENT_SPEED: 0.018,     // fraction of route per second -- a slow drift

  /* --- the departure network ------------------------------------------------
     Nothing leaves an airport until a flight has arrived there, so the map
     grows outward from Seattle rather than appearing all at once. */
  HERO_BOW: 0.9,            // slight per-flight arc offset so parallel routes separate
  LEG_DWELL: 0.05,          // pause on the ground between a journey's own legs
  TURNAROUND: 0.10,         // pause before a newly reached airport sends its own trips
  STAGGER: 0.55,            // spacing between journeys leaving the same airport
  PLANE_SIZE: 17,
  HERO_PLANE_SIZE: 23
};


/* --------------------------------------------------------------------------
   The narration.

   Lines carried through the flying, not saved for the end. Each one appears at
   `at` (a fraction of SEQUENCE_SECONDS) and holds for `hold` seconds.

   `after` pins a beat to a place: the Toronto line cannot appear until a
   flight has actually landed in Toronto, whatever the route data does. That
   way the words stay with the picture if the flights are ever re-generated.

   THESE ARE A DRAFT. The facts in them are true to the CSV -- the mileage, the
   dates, the counts -- but the sentiment is a guess. Rewrite freely; nothing
   here depends on the wording.
   -------------------------------------------------------------------------- */
const NARRATION = [
  {
    at: 0.05, hold: 5.5,
    line1: 'Two airports, thirty-two miles apart',
    line2: 'everything we have done starts from here'
  },
  {
    at: 0.14, hold: 5.5, after: 'LAS',
    line1: 'Some we barely planned',
    line2: 'Vegas out of Paine Field, twice, on a whim'
  },
  {
    at: 0.24, hold: 5.5, after: 'YYZ',
    line1: 'Before it was Seattle, it was Toronto',
    line2: 'five years of leaving, and coming back'
  },
  {
    at: 0.36, hold: 5.5, after: 'YEG',
    line1: 'And all the small ones in between',
    line2: 'the weekends, the long layovers, the flights home'
  },
  {
    at: 0.50, hold: 5.5, after: 'HKG',
    line1: 'Then further, and further again',
    line2: 'Hong Kong, Tokyo, Taipei \u2014 the long way round'
  },
  {
    at: 0.62, hold: 5.5, after: 'KEF',
    line1: 'One hundred and twenty-nine thousand miles',
    line2: 'five times around the world, together'
  }
];

/* --------------------------------------------------------------------------
   The title card -- the last beat, after the narration has run.
   -------------------------------------------------------------------------- */
const TITLE = {
  line1: "WE'VE BEEN ON SO MANY ADVENTURES TOGETHER",
  line2: 'and every one of them started with you'
};

CONFIG.NARRATION = NARRATION;

/* --------------------------------------------------------------------------
   The network.

   Airports and routes come from data/routes.js, generated out of the Flighty
   export by tools/build_routes.py. Re-run that script after changing the CSV;
   don't edit the generated file.

   The regional fields below are only ever used by the idle traffic in the cold
   open -- they're generic Seattle-area arrivals, not trips anyone took.
   -------------------------------------------------------------------------- */
const REGIONAL_FIELDS = {
  BLI: { name: 'Bellingham',       lat:  48.7927, lon: -122.5375 },
  BOI: { name: 'Boise',            lat:  43.5644, lon: -116.2228 },
  DEN: { name: 'Denver',           lat:  39.8561, lon: -104.6737 },
  EUG: { name: 'Eugene',           lat:  44.1246, lon: -123.2119 },
  GEG: { name: 'Spokane',          lat:  47.6199, lon: -117.5338 },
  MFR: { name: 'Medford',          lat:  42.3742, lon: -122.8735 },
  PDX: { name: 'Portland',         lat:  45.5898, lon: -122.5951 },
  PSC: { name: 'Pasco',            lat:  46.2647, lon: -119.1190 },
  SLC: { name: 'Salt Lake City',   lat:  40.7899, lon: -111.9791 },
  YKM: { name: 'Yakima',           lat:  46.5682, lon: -120.5440 },
  YYJ: { name: 'Victoria',         lat:  48.6469, lon: -123.4258 }
};

const AIRPORTS = Object.assign({}, REGIONAL_FIELDS, ROUTE_DATA.airports);

/* Every journey the sequence flies, already in dependency order: each one
   departs an airport an earlier journey has reached. */
const HERO_ROUTES = ROUTE_DATA.journeys;

/* Idle traffic: where the cold-open flights come from and go to. */
const AMBIENT_ROUTES = [
  ['PDX', 'SEA'], ['GEG', 'SEA'], ['BOI', 'SEA'], ['YVR', 'SEA'],
  ['SLC', 'SEA'], ['DEN', 'SEA'], ['EUG', 'SEA'], ['MFR', 'SEA'],
  ['YYJ', 'SEA'], ['PSC', 'SEA'], ['BLI', 'PAE'], ['YKM', 'SEA'],
  ['SEA', 'PDX'], ['SEA', 'GEG'], ['SEA', 'YVR'], ['SEA', 'BOI'],
  ['SEA', 'SLC'], ['SEA', 'EUG'], ['PAE', 'SEA'], ['SEA', 'BLI'],
  ['PDX', 'PAE'], ['SEA', 'YYJ'], ['GEG', 'PDX'], ['YVR', 'PDX']
];

const AMBIENT_AIRLINES = ['AS', 'QX', 'DL', 'UA', 'AA', 'WN', 'B6', 'AC', 'F9', 'NK'];

/* ==========================================================================
   ACT TWO -- the scrapbook.

   The plane flies four real flights, pausing over each place while photographs
   fan out beside it and the LED board flips to that flight. The camera rides
   with the aircraft the whole way: pulled back and quick across open water,
   easing down to country scale on approach. No cuts.
   ========================================================================== */

/* The panel, top left. Sizes are in dots; the dot size itself comes off the
   viewport so the board keeps its proportions on any screen. */
CONFIG.BOARD = {
  cols: 140,
  rows: 80,
  dotDivisor: 250,        // smaller number -> bigger board
  margin: 34,
  bezel: '#9aa0a6',
  bezelWidth: 7,
  field: '#050505',
  lit: '#f2f2f2',
  unlit: '#1a1a1a',
  litRadius: 0.40,        // as a fraction of the dot pitch
  unlitRadius: 0.26,
  unlitAlpha: 0.85,
  smallSize: 11,          // px height fed to the rasteriser
  bigSize: 15,
  layout: {
    tailCol: 4,  tailRow: 7,
    col: 44,     line1: 5,  line2: 18, line3: 31,
    wideCol: 3,  line4: 47, line5: 63
  }
};

/* Tail fins, one dot per character. Simplified liveries -- a swept fin in the
   airline's colour with its mark picked out in white. */
CONFIG.AIRLINE_TAILS = {
  AC: {
    colors: { R: '#d8232a', W: '#f4f4f4' },
    rows: [
      '.........RR',
      '........RRR',
      '.......RRRR',
      '......RRRRR',
      '.....RRRRRR',
      '....RRRWRRR',
      '....RRWWWRR',
      '...RRRWWWRR',
      '...RRWWWWWR',
      '..RRRWWWWWR',
      '..RRRRWWWRR',
      '.RRRRRWRWRR',
      '.RRRRRRRRRR',
      'RRRRRRRRRRR',
      'RRRRRRRRRRR'
    ]
  },
  NH: {
    colors: { B: '#1c3f94', W: '#f4f4f4' },
    rows: [
      '.........BB',
      '........BBB',
      '.......BBBB',
      '......BBBBB',
      '.....BBBBBB',
      '....BBBBBBB',
      '....BBWWWBB',
      '...BBWWWWWB',
      '...BBWWWWWB',
      '..BBBWWWWBB',
      '..BBBBWWBBB',
      '.BBBBBBBBBB',
      '.BBBBBBBBBB',
      'BBBBBBBBBBB',
      'BBBBBBBBBBB'
    ]
  },
  BR: {
    colors: { G: '#0f5c3f', W: '#f4f4f4', Y: '#e8b33a' },
    rows: [
      '.........GG',
      '........GGG',
      '.......GGGG',
      '......GGGGG',
      '.....GGGGGG',
      '....GGGGGGG',
      '....GGYYYGG',
      '...GGYWWWYG',
      '...GGYWWWYG',
      '..GGGYWWYGG',
      '..GGGGYYGGG',
      '.GGGGGGGGGG',
      '.GGGGGGGGGG',
      'GGGGGGGGGGG',
      'GGGGGGGGGGG'
    ]
  },
  FI: {
    colors: { B: '#1b3a6b', W: '#f4f4f4' },
    rows: [
      '.........BB',
      '........BBB',
      '.......BBBB',
      '......BBBBB',
      '.....BBWBBB',
      '....BBWWWBB',
      '....BWWWWWB',
      '...BWWWWWWW',
      '...BBWWWWWB',
      '..BBBWWWWBB',
      '..BBBBWWBBB',
      '.BBBBBWBBBB',
      '.BBBBBBBBBB',
      'BBBBBBBBBBB',
      'BBBBBBBBBBB'
    ]
  }
};
CONFIG.AIRLINE_TAILS.DEFAULT = {
  colors: { W: '#cfcfcf' },
  rows: CONFIG.AIRLINE_TAILS.AC.rows.map(function (r) { return r.replace(/R/g, 'W'); })
};

/* The four flights, as they were actually flown.

   `hold` is the pause over the destination, `zoom` how close the camera comes.
   `photos` are filenames under photos/ -- any that don't exist yet draw as
   labelled empty frames, so this looks deliberate before you've added a single
   image and fills in as you drop them in. */
CONFIG.ACT2_FLIGHTS = [
  {
    airlineKey: 'AC', airline: 'Air Canada', flight: 'AC 3',
    from: 'YVR', to: 'NRT', route: 'YVR-NRT', aircraft: '777-300ER',
    fromName: 'Vancouver Intl', toName: 'Tokyo Narita',
    place: 'JAPAN', zoom: 4.6, fan: -0.55,
    photos: ['japan-1.jpg', 'japan-2.jpg', 'japan-3.jpg']
  },
  {
    airlineKey: 'NH', airline: 'ANA', flight: 'NH 811',
    from: 'NRT', to: 'HKG', route: 'NRT-HKG', aircraft: '787-8',
    fromName: 'Tokyo Narita', toName: 'Hong Kong Intl',
    place: 'HONG KONG', zoom: 5.4, fan: 2.5,
    photos: ['hongkong-1.jpg', 'hongkong-2.jpg', 'hongkong-3.jpg']
  },
  {
    airlineKey: 'BR', airline: 'EVA Air', flight: 'BR 872',
    from: 'HKG', to: 'TPE', route: 'HKG-TPE', aircraft: '787-9',
    fromName: 'Hong Kong Intl', toName: 'Taipei Taoyuan',
    place: 'TAIWAN', zoom: 5.6, fan: 1.15,
    photos: ['taiwan-1.jpg', 'taiwan-2.jpg']
  },
  {
    airlineKey: 'FI', airline: 'Icelandair', flight: 'FI 694',
    from: 'YVR', to: 'KEF', route: 'YVR-KEF', aircraft: '737 MAX 8',
    fromName: 'Vancouver Intl', toName: 'Keflavik Intl',
    place: 'ICELAND', zoom: 4.8, fan: 0.1,
    photos: ['iceland-1.jpg', 'iceland-2.jpg', 'iceland-3.jpg']
  }
];

/* Scrapbook frames. */
CONFIG.SCRAPBOOK = {
  dir: 'photos/',
  frameW: 210,            // px at 1920 wide, scaled with the viewport
  frameH: 158,            // 4:3 landscape
  border: 9,
  gap: 22,
  fullScaleZoom: 5.0,     // frames are full size at about this zoom
  scaleWithZoom: 0.42,    // how hard they shrink as the camera pulls back
  minScale: 0.52,
  tilt: 7,                // degrees of random-ish rotation
  popSeconds: 0.55,
  radius: 200             // how far the cluster sits from the airport
};

/* Beats within Act Two, in seconds. Everything left over after these is
   flying time, shared out by distance. */
CONFIG.ACT2_PLANE_SIZE = 30;
CONFIG.ACT2_HOLD = 5.0;      // pause over each destination -- time to look at a photo
CONFIG.ACT2_MIN_FLY = 1.1;   // shortest a leg may be, however near
CONFIG.ACT2_SWEEP = 1.6;     // camera crossing to a leg that doesn't chain on
CONFIG.ACT2_FINAL = 2.6;     // pull back at the end to hold the whole scrapbook
CONFIG.ACT2_FINAL_PADDING = 0.55;  // extra room so the frames aren't cropped     // pull back at the end to hold the whole scrapbook

/* How the camera rides along. Zoom is driven by how near the aircraft is to
   either end of its leg: close in at both, pulled back across the middle. */
CONFIG.ACT2_CAMERA = {
  transitZoom: 2.9,
  nearKm: 900,            // fully zoomed in inside this
  farKm: 3600,            // fully pulled back beyond this
  tau: 0.45,              // camera smoothing, seconds
  enterTau: 1.5,          // slower while easing out of Act One
  settleSeconds: 2.5,
  offsetX: 0.12,          // nudge the map right, clear of the board
  offsetY: 0.06
};

/* ==========================================================================
   ACT THREE -- under the water, looking up.

   Everything here is drawn in perspective along the view axis, because that's
   what a ceiling gives you: the viewer is already looking straight up, so
   "up" recedes towards the middle of the frame rather than towards an edge.

   The transition is a consequence of that, not a separate effect. The act
   opens with the camera sinking faster than the bubbles rise, so they stream
   outwards past you; as the descent decays they turn round and begin drifting
   inwards towards the surface.
   ========================================================================== */

CONFIG.ACT3_SECONDS = 20;
CONFIG.ACT3_FADE_IN = 2.4;   // how long the map takes to dissolve into water

CONFIG.ACT3 = {
  dir: 'photos/',

  /* Perspective. z is distance along the view axis: zNear is right at your
     mask, zFar is up near the surface. */
  focal: 0.62,
  zNear: 0.30,
  zFar: 4.2,

  /* The descent. sinkStart well above a bubble's rise rate is what makes them
     rush outwards at the top of the act. */
  sinkStart: 2.6,
  sinkDecay: 3.4,         // seconds for the sink to fall to 1/e

  bubbleCount: 150,
  moteCount: 190,

  /* Snell's window: from underwater the whole sky is squeezed into a bright
     disc overhead, everything outside it dark. */
  snellRadius: 0.66,
  snellAlpha: 0.92,
  shafts: 9,
  shaftAlpha: 0.055,

  colors: {
    deep:         '#02141c',
    mid:          '#06323c',
    nearSurface:  '#0b5560',
    windowCore:   '#dbfaf6',
    windowMid:    '#79d6d2',
    windowHold:   '#3f9fa4',
    windowEdge:   'rgba(30,120,130,0)',
    shaft:        'rgba(175,255,250,0.55)',
    bubbleFill:   '#bff4f4',
    bubbleRim:    '#e8ffff',
    bubbleHi:     '#ffffff',
    mote:         '#a8ecec',
    frameEmpty:   'rgba(9,58,68,0.88)',
    text:         '#e8ffff',
    textSoft:     '#a9dee0'
  },

  /* Photographs. Six to eight, hanging at staggered depths so two or three
     are suspended at once, drifting past each other. Missing files draw as
     empty frames, same as Act Two. */
  photos: [
    'water-1.jpg', 'water-2.jpg', 'water-3.jpg', 'water-4.jpg',
    'water-5.jpg', 'water-6.jpg', 'water-7.jpg'
  ],
  photoSize: 0.80,        // world units; scales with distance
  photoLife: 7.5,         // seconds each stays before drifting off
  photoFade: 1.4,
  photosStart: 3.4,       // first photograph, after the descent settles
  photosEnd: 3.0,         // last one starts this long before the end

  /* Two or three lines, spread through. Same draft caveat as Act One's
     narration -- rewrite them. */
  textFade: 1.1,
  lines: [
    { at: 2.0,  hold: 3.4, y: 0.30,
      line1: 'AND THEN THERE IS THE WATER',
      line2: 'the first thing we look for, everywhere we go' },
    { at: 8.5,  hold: 3.4, y: 0.72,
      line1: 'NO DEPARTURE BOARDS DOWN HERE',
      line2: 'nowhere to be, nothing to catch' },
    { at: 15.0, hold: 3.2, y: 0.30,
      line1: 'STAY IN A WHILE',
      line2: 'we have got time' }
  ]
};

/* ==========================================================================
   ACT FOUR -- the board.

   Twenty-eight tiles in a ring, dark with the colour bands lit from within.
   The middle of a board is empty by design, so that's where the photographs
   and the lines go.

   The dice drive it: two of them settle on a number and a token counts out
   exactly that many squares. Players alternate. The only arranged part is the
   finish -- the whole set of rolls is chosen up front so the last one puts
   both tokens on the same square, but every roll is an ordinary pair of dice
   and no token ever moves further than it threw.

   Everything is drawn rather than borrowed: no logos, no artwork, just shapes
   and names. Colour groups alternate between the two worlds all the way round.
   ========================================================================== */

CONFIG.ACT4_SECONDS = 30;

CONFIG.ACT4 = {
  dir: 'photos/',
  boardScale: 0.93,

  assembleSeconds: 3.4,     // board laying itself out
  surfaceSeconds: 1.3,      // the flash of breaking the surface
  finaleSeconds: 2.6,       // both tokens together at the end
  rollSeconds: 1.15,        // dice tumbling before they settle
  hopSeconds: 0.115,        // per square
  revealFade: 0.55,

  colors: {
    backdrop:   '#050608',
    board:      '#0c0f13',
    tile:       '#12161c',
    edge:       'rgba(255,255,255,0.13)',
    tileText:   '#c8d0da',
    cornerText: '#eef2f6',
    centreText: '#d5dde6',
    die:        '#e9eef4',
    pip:        '#12161c',
    tokenA:     '#ff5a5f',   // the sphere
    tokenB:     '#5ad2ff',   // the fighter
    frameEmpty: 'rgba(20,26,34,0.9)'
  },

  /* Twenty-eight tiles, clockwise from the top-left corner. Colour groups
     alternate between the two worlds the whole way round. */
  tiles: [
    { name: 'GO', corner: true },
    { name: 'Pallet Town',    color: '#c9773f' },
    { name: 'Viridian City',  color: '#c9773f' },
    { name: 'Falcon',         color: '#8b95a3' },
    { name: 'Tatooine',       color: '#ddb45e' },
    { name: 'Jakku',          color: '#ddb45e' },
    { name: 'Poke Center',    color: '#6f7d8c' },

    { name: 'CARBONITE', corner: true },
    { name: 'Cerulean City',  color: '#3fa2d8' },
    { name: 'Vermilion City', color: '#3fa2d8' },
    { name: 'Lapras',         color: '#8b95a3' },
    { name: 'Hoth',           color: '#a6dcee' },
    { name: 'Ilum',           color: '#a6dcee' },
    { name: 'Chance',         color: '#6f7d8c' },

    { name: 'CANTINA', corner: true },
    { name: 'Lavender Town',  color: '#d06fa8' },
    { name: 'Saffron City',   color: '#d06fa8' },
    { name: 'X-Wing',         color: '#8b95a3' },
    { name: 'Endor',          color: '#4fae5f' },
    { name: 'Kashyyyk',       color: '#4fae5f' },
    { name: 'Kyber Forge',    color: '#6f7d8c' },

    { name: 'COMPACTOR', corner: true },
    { name: 'Cinnabar Is.',   color: '#d8494e' },
    { name: 'Indigo Plateau', color: '#d8494e' },
    { name: 'Charizard',      color: '#8b95a3' },
    { name: 'Coruscant',      color: '#7f8fd8' },
    { name: 'Naboo',          color: '#7f8fd8' },
    { name: 'Chance',         color: '#6f7d8c' }
  ],

  /* One per roll: a photograph and a line. Order is fixed; which square they
     land on is whatever the dice say. Files go in photos/ -- missing ones
     draw as empty frames, same as the other acts. */
  reveals: [
    { photo: 'board-1.jpg', line: 'four years of losing to you at everything' },
    { photo: 'board-2.jpg', line: 'and still setting the board up again' },
    { photo: 'board-3.jpg', line: 'you always did pick the better piece' },
    { photo: 'board-4.jpg', line: 'same square, every time' }
  ]
};
