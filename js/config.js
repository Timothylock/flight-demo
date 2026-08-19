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
  SEQUENCE_SECONDS: 85,

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
    titleFadeIn:   [0.92, 0.99]    // title card appears
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
  STAGGER: 0.16,            // spacing between journeys leaving the same airport
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
  },
  {
    at: 0.74, hold: 5.5, after: 'CTS',
    line1: 'The dotted line is January',
    line2: 'and after that, wherever you want to go'
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
