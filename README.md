# Ceiling Flight Radar

A dark flight-radar projection for a ceiling. It opens as a radar scope over
Puget Sound with live-looking traffic into SEA and PAE. Press space and the map
comes up, that traffic clears out, and a bank of flights leaves Seattle and
Paine Field for the world — the camera pulling back with them, each destination
lighting up with its airport code as its flight arrives. It holds on the
finished map with a title card, then drifts home and waits for you to press
again.

## Running it

Open `index.html`. That's it — double-click the file, no server, no network.

Everything it needs is in the repo: map tiles as PNGs, world boundaries as a
`.js` file, no CDN and no third-party script. It's built for `file://`
deliberately, which is why the geometry ships as a script that assigns a global
instead of as JSON — `fetch()` is blocked there, `<script src>` is not.

For a projector: press `F` for fullscreen. The cursor hides itself after two
seconds.

| key | |
|---|---|
| `space` / tap | run the sequence (during the held frame, skip to the reset) |
| `F` | fullscreen |
| `R` | force back to the cold open |

Tapping anywhere does what space does, so it works on a phone.

## Making it yours

Everything worth changing is at the top of `js/config.js`.

**The flights.** `HERO_ROUTES` is the bank that launches on space. Each entry
is an origin and a list of stops:

```js
{ callsign: 'AS 811',  origin: 'SEA', legs: ['ANC'] },          // nonstop
{ callsign: 'DL 167',  origin: 'SEA', legs: ['NRT', 'BKK'] },   // one connection
```

Any number of legs works. The aircraft flies the first, lands, its stopover
gets a label, then it carries on — and trips sharing a stopover fan out from
it. Add airports to `AIRPORTS` with their lat/lon as needed; the codes in
`legs` just have to match.

The final camera view fits itself to wherever the routes actually go, so a set
of trips that never leaves Europe ends on Europe rather than on the whole
globe. Nothing to retune.

**The words.** `TITLE`, two lines.

**The timing.** `SEQUENCE_SECONDS` is the whole show, launch to title card.
Every other beat is a fraction of it, so changing that one number retimes the
piece. `HOLD_SECONDS` is how long the finished frame sits before resetting.

## Rebuilding the assets

Only needed if you want different coverage — the output is committed.

```
python3 tools/fetch_tiles.py    # basemap tiles -> tiles/
python3 tools/build_world.py    # coastlines, borders, lakes -> data/world.js
```

`fetch_tiles.py` skips what it already has and writes `tiles/manifest.js` so
the page never requests a tile that isn't on disk. Widen the boxes in
`REGIONS` to cover more ground.

## How it's put together

One canvas, one animation loop, a hand-rolled Web Mercator projection. Not a
map library: the whole piece is a single continuous fractional zoom from z8 out
to the world, and slippy maps step through integer zoom levels, which you'd see
as a stutter the entire way out.

| | |
|---|---|
| `js/config.js` | routes, airports, timing, palette |
| `js/geo.js` | Mercator, great circles, unwrapped longitude |
| `js/camera.js` | centre/zoom, projection, the fitted final view |
| `js/tiles.js` | raster basemap, Puget Sound only |
| `js/worldlayer.js` | coastlines, borders, lakes |
| `js/radar.js` | rings and the sweep |
| `js/flights.js` | aircraft, routes, the departure bank |
| `js/airports.js` | markers and their reveal |
| `js/labels.js` | keeps labels from stacking |
| `js/sequence.js` | the state machine driving all of it |

Two details worth knowing if you change things:

Longitude is kept *unwrapped* — a westbound flight out of Seattle counts down
past -180 rather than jumping to +179. Same for the coastline rings, which is
what stops Chukotka and Fiji drawing a bright streak straight across the map.

The tiles are recoloured on load. CARTO's dark basemap paints water light and
land dark, the inverse of the vector layer and of Flight Radar's own dark
theme, so they'd swap polarity mid-fade. `CONFIG.TILE_FILTER` flips them; the
comment there shows where the constants come from.

## Credits

Basemap tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, © [CARTO](https://carto.com/attributions).
Boundaries and lakes from [Natural Earth](https://www.naturalearthdata.com/)
(public domain), via [world-atlas](https://github.com/topojson/world-atlas).
