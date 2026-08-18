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
  SEQUENCE_SECONDS: 15,

  /* How long the finished world view holds before it resets itself. */
  HOLD_SECONDS: 12,

  /* How long the drift back to Seattle takes. */
  RESET_SECONDS: 3.5,

  /* Beats, as fractions of SEQUENCE_SECONDS. */
  BEATS: {
    mapFadeIn:     [0.00, 0.09],   // black -> map
    ambientFadeOut:[0.03, 0.13],   // idle traffic clears out
    launchWindow:  [0.10, 0.26],   // hero flights leave, staggered
    zoomOut:       [0.12, 0.78],   // camera pulls back to the world
    allLanded:      0.84,          // last arrival, at the latest
    titleFadeIn:   [0.87, 1.00]    // title card appears
  },

  /* How far the map dims under the title card. The airport codes stay
     readable; the words become the thing you're looking at. */
  TITLE_DIM: 0.62,

  /* --- camera ------------------------------------------------------------ */
  /* zoom here is written for a 1920px-wide projector and scaled from there. */
  HOME: { lat: 47.64, lon: -122.30, zoom: 8.2 },

  /* The final view fits itself to wherever HERO_ROUTES actually go. WORLD.lon
     is only the anchor deciding which way round the globe that fit is measured
     -- roughly "the middle of the map you want" -- and WORLD.lat is a fallback
     if there are no routes at all. */
  WORLD: { lat: 32.0, lon: -100.0 },
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
  AMBIENT_COUNT: 24,
  AMBIENT_SPEED: 0.055,     // fraction of route per second

  /* --- hero flights -------------------------------------------------------- */
  HERO_BOW: 0.9,            // slight per-flight arc offset so shared legs fan apart
  LEG_DWELL_FRACTION: 0.06, // pause at a connecting airport, as a fraction of the flight
  PLANE_SIZE: 17,
  HERO_PLANE_SIZE: 23
};

/* --------------------------------------------------------------------------
   The title card.
   -------------------------------------------------------------------------- */
const TITLE = {
  line1: "WE'VE BEEN ON SO MANY ADVENTURES TOGETHER",
  line2: 'and every one of them started with you'
};

/* --------------------------------------------------------------------------
   Airports. lat/lon of the field itself.
   -------------------------------------------------------------------------- */
const AIRPORTS = {
  SEA: { name: 'Seattle-Tacoma',   lat:  47.4502, lon: -122.3088 },
  PAE: { name: 'Paine Field',      lat:  47.9063, lon: -122.2816 },

  /* hero destinations */
  ANC: { name: 'Anchorage',        lat:  61.1743, lon: -149.9962 },
  AMS: { name: 'Amsterdam',        lat:  52.3105, lon:    4.7683 },
  BKK: { name: 'Bangkok',          lat:  13.6900, lon:  100.7501 },
  CDG: { name: 'Paris',            lat:  49.0097, lon:    2.5479 },
  CUN: { name: 'Cancun',           lat:  21.0365, lon:  -86.8771 },
  DXB: { name: 'Dubai',            lat:  25.2532, lon:   55.3657 },
  FCO: { name: 'Rome',             lat:  41.8003, lon:   12.2389 },
  HND: { name: 'Tokyo Haneda',     lat:  35.5494, lon:  139.7798 },
  ICN: { name: 'Seoul',            lat:  37.4602, lon:  126.4407 },
  JFK: { name: 'New York',         lat:  40.6413, lon:  -73.7781 },
  KEF: { name: 'Reykjavik',        lat:  63.9850, lon:  -22.6056 },
  LAX: { name: 'Los Angeles',      lat:  33.9416, lon: -118.4085 },
  LHR: { name: 'London',           lat:  51.4700, lon:   -0.4543 },
  LIH: { name: 'Kauai',            lat:  21.9760, lon: -159.3390 },
  NRT: { name: 'Tokyo Narita',     lat:  35.7647, lon:  140.3864 },
  OGG: { name: 'Maui',             lat:  20.8986, lon: -156.4305 },
  SAN: { name: 'San Diego',        lat:  32.7336, lon: -117.1897 },
  SFO: { name: 'San Francisco',    lat:  37.6213, lon: -122.3790 },
  SIN: { name: 'Singapore',        lat:   1.3644, lon:  103.9915 },
  TPE: { name: 'Taipei',           lat:  25.0777, lon:  121.2328 },

  /* regional fields, used by the idle traffic */
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
  YVR: { name: 'Vancouver',        lat:  49.1967, lon: -123.1815 },
  YYJ: { name: 'Victoria',         lat:  48.6469, lon: -123.4258 }
};

/* --------------------------------------------------------------------------
   The flights that launch on space.

   `legs` is the list of stops after the origin. One entry is a nonstop; two
   entries is a connection -- the aircraft lands, its stopover gets a label,
   then it continues. Trips sharing a connection fan out from it.

   Swap these for real trips: origin, then wherever you actually went.
   -------------------------------------------------------------------------- */
const HERO_ROUTES = [
  { callsign: 'AS 811',  origin: 'SEA', legs: ['ANC'] },
  { callsign: 'AS 8',    origin: 'SEA', legs: ['JFK'] },
  { callsign: 'AS 852',  origin: 'SEA', legs: ['OGG'] },
  { callsign: 'BA 48',   origin: 'SEA', legs: ['LHR'] },
  { callsign: 'AF 365',  origin: 'SEA', legs: ['CDG'] },
  { callsign: 'KE 20',   origin: 'SEA', legs: ['ICN'] },
  { callsign: 'EK 230',  origin: 'SEA', legs: ['DXB'] },

  /* connections -- two legs, fanning out from a shared stopover */
  { callsign: 'DL 167',  origin: 'SEA', legs: ['NRT', 'BKK'] },
  { callsign: 'NH 179',  origin: 'SEA', legs: ['NRT', 'SIN'] },
  { callsign: 'AS 1032', origin: 'SEA', legs: ['LAX', 'LIH'] },
  { callsign: 'AS 1119', origin: 'SEA', legs: ['LAX', 'CUN'] },
  { callsign: 'DL 173',  origin: 'SEA', legs: ['AMS', 'FCO'] },

  /* out of Paine Field */
  { callsign: 'QX 2140', origin: 'PAE', legs: ['SFO'] },
  { callsign: 'AS 1085', origin: 'PAE', legs: ['SAN'] },
  { callsign: 'BOE 271', origin: 'PAE', legs: ['TPE'] },
  { callsign: 'BOE 4',   origin: 'PAE', legs: ['KEF', 'HND'] }
];

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
