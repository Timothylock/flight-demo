# Ceiling Flight Radar

A dark flight-radar projection for a ceiling. It opens as a radar scope over
Puget Sound with live-looking traffic into SEA and PAE. Press space and the map
comes up, that traffic clears out, and a bank of flights leaves Seattle and
Paine Field for the world — the camera pulling back with them, each destination
lighting up with its airport code as its flight arrives. It holds on the
finished map with a title card, then runs the scrapbook, the water and the
board, closes on one photograph held in the dark, and drifts back to the cold
open to wait for you to press again.

## Running it

Open `index.html`. That's it — double-click the file, no server, no network.

Everything it needs is in the repo: map tiles as PNGs, world boundaries as a
`.js` file, the score as an MP3, no CDN and no third-party script. It's built
for `file://` deliberately, which is why the geometry ships as a script that
assigns a global instead of as JSON — `fetch()` is blocked there, `<script src>`
is not.

Sound needs the keyboard, not just the projector: the score can only start
inside a user gesture, so it begins on the space press. If you start the piece
some other way, it runs silent.

For a projector: press `F` for fullscreen. The cursor hides itself after two
seconds.

| key | |
|---|---|
| `space` / tap | run the sequence, and start the music (during the held frame, skip to the reset) |
| `F` | fullscreen |
| `R` | force back to the cold open, and cut the music |

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

**The idle traffic.** `AMBIENT_FLIGHTS` is the cold open's background, and it
is the one part of the piece that isn't about us: real services, each callsign
paired with a route that airline genuinely flies. Paine Field only ever gets
Alaska, because that is all that flies out of Paine Field, and the only other
thing leaving Everett is a Boeing test aircraft going out to Moses Lake and
back -- `BOE` on a callsign. The flight numbers are representative rather than
current; airlines renumber every schedule, and this has to work offline years
from now. The airline-and-route pairings are the part that is true.

Each aircraft flies only the stretch of its route that crosses the scope --
a departure for Newark is over Puget Sound for the first eleven percent of it
and off the edge after that -- so the scope stays populated instead of filling
with aircraft that left the frame and haven't finished their flight.

**The words.** `NARRATION` in `js/config.js` is the script -- lines carried
through the flying rather than saved for the end. Each beat has an `at` (a
fraction of the sequence) and a `hold`, and optionally `after: 'YYZ'`, which
pins it to a place: the Toronto line cannot appear until a flight has actually
landed in Toronto. So the words stay with the picture even if the flights are
re-generated from a new export.

Beats always play in the order written, each waiting for the previous to clear.
If the script runs past the title card the holds are squeezed rather than left
to collide, so nothing breaks -- but it's better to give it room by raising
`SEQUENCE_SECONDS`.

`TITLE` is the last beat, after the narration has run.

The narration in the repo is a **draft**. Its facts are true to the CSV -- the
mileage, the dates, the counts -- but the sentiment is guesswork. Rewrite it.

**The timing.** `SEQUENCE_SECONDS` is Act One, launch to title card. Every
beat inside it is a fraction of it, so changing that one number retimes the act
-- narration included. `HOLD_SECONDS` is how long the title sits before the
scrapbook starts.

The five acts run back to back, and the whole piece is two minutes twenty-five:

| | seconds | starts |
|---|---|---|
| Act One, the radar and the spreading | `SEQUENCE_SECONDS` 41 | 0:00 |
| the title card, held | `HOLD_SECONDS` 2 | 0:41 |
| Act Two, the scrapbook | `ACT2_SECONDS` 34 | 0:43 |
| Act Three, the water | `ACT3_SECONDS` 20 | 1:17 |
| Act Four, the board | `ACT4_SECONDS` 30 | 1:37 |
| the finale | `FINALE` 3.5 + 10 + 3.5 | 2:07 |
| the drift back to the radar | `RESET_SECONDS` 3.5 | 2:24 |

Move any one of them and everything after it shifts by the same amount.

Two floors are worth knowing before you cut further. Act Two needs about 29
seconds to keep a full five-second hold over each of its four places -- below
that `CONFIG.ACT2_HOLD` starts getting squeezed automatically. And Act One
wants about 65 seconds to carry six narration beats at the pace they were
written for; it has 41, so `js/narration.js` squeezes the holds to about three
seconds a line. That is the one place the piece is running faster than it
would like. It doesn't break -- the scheduler squeezes rather than lets the
last line collide with the title card -- but if the lines feel rushed, cut one
from `NARRATION` rather than lengthening the act, because everything after
0:43 is spoken for.

**The music.** `CONFIG.MUSIC` is one track, `audio/score.mp3`, started by the
same press that starts the sequence -- which is what makes it play at all,
since a browser will only begin audio inside a user gesture. `stopAt` is
wall-clock seconds from that press, so 145 means 2:25 on the nose whatever the
frame rate does, and `fadeOut` lands the last of it there rather than cutting.
`volume` is 0-1 on top of whatever the projector is set to. Swap the file and
the rest still holds; the one in the repo runs 4:15, longer than the piece, so
what you hear at the end is the fade rather than the track's own ending.

**The last frame.** `CONFIG.FINALE` is the closing beat: one filename, one
line, and `fadeIn` / `hold` / `fadeOut` in seconds. Drop `photos/finale.jpg` in
and rewrite the line -- the one in the repo is a placeholder like the rest of
the script.

**The camera** follows the network rather than a stopwatch: it fits whatever
has been reached so far, plus anything airborne, so the frame always holds what
the narration is talking about. It converges on the final view for free -- once
everywhere is reached, the fit is the final view. `CAMERA_FOLLOW_TAU` sets how
languidly it settles.

## Rebuilding the assets

Only needed if you want different coverage — the output is committed.

```
python3 tools/fetch_tiles.py    # basemap tiles -> tiles/
python3 tools/build_world.py    # coastlines, borders, lakes -> data/world.js
python3 tools/build_routes.py   # the flight network -> data/routes.js
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
| `js/config.js` | timing, palette, idle traffic |
| `data/routes.js` | the flight network (generated) |
| `js/geo.js` | Mercator, great circles, unwrapped longitude |
| `js/camera.js` | centre/zoom, projection, the fitted final view |
| `js/tiles.js` | raster basemap, Puget Sound only |
| `js/worldlayer.js` | coastlines, borders, lakes |
| `js/radar.js` | rings and the sweep |
| `js/flights.js` | aircraft, routes, the spreading schedule |
| `js/act2.js` | the scrapbook act: flights, camera ramp, arrivals |
| `js/act3.js` | the water: perspective, bubbles, Snell's window |
| `js/act4.js` | the board: tiles, dice, tokens |
| `js/finale.js` | the last photograph and the hold |
| `js/music.js` | the score, and where it stops |
| `js/ledboard.js` | the dot-matrix flight board |
| `js/scrapbook.js` | photograph frames pinned to the map |
| `js/airports.js` | markers and their reveal |
| `js/labels.js` | keeps labels from stacking |
| `js/sequence.js` | the state machine driving all of it |

The board's text isn't a pixel typeface. It's rendered tiny on an offscreen
canvas, read back a pixel at a time, and each lit pixel redrawn as a round LED --
so the dots *are* the glyphs. Sizes in `CONFIG.BOARD` are in dots, not pixels.

Act Three is drawn in perspective along the view axis rather than flat, because
that is what a ceiling gives you: whoever is watching is already looking
straight up, so "up" recedes towards the middle of the frame instead of towards
an edge. Everything has a distance; rising means receding. The opening
transition falls out of that rather than being a separate effect -- the camera
sinks faster than the bubbles rise, so they stream outwards past you, and as the
descent decays they turn round and drift inwards towards the surface. Overhead
is Snell's window, the bright disc the whole sky compresses into when seen from
below water.

In Act Four the dice genuinely drive the act: two of them settle on a number
and a token counts out exactly that many squares, and whatever it lands on is
what lights up. The only arranged part is the finish. The whole set of rolls is
chosen before the act starts, by trying sequences until one ends with both
tokens on the same square -- every roll stays an ordinary pair of dice and no
token ever moves further than it threw. Because the second player lands on the
first player's square, the last two reveals share a tile, which is the point.

Board text faces outward on all four sides, so the top row reads upside down
exactly as it does on a real board -- that orientation is most of why a
Monopoly board is recognisable from across a room, and nothing is lost by it
because whatever a token lands on is spelled out upright in the middle anyway.
The corners are the one exception: turned onto their diagonals, names as long
as `CARBONITE` ran out of their own square, so the artwork sits on the diagonal
and the word underneath stays level.

The finale is the only moment in the piece with nothing moving. Act Four fades
under a black field, one photograph comes up with a single line beneath it,
and it holds -- `CONFIG.FINALE.hold`, ten seconds by default -- before fading
out. Because it ends on black and the cold open begins on black, the reset that
follows it doesn't fade the world out again: it brings the radar up from where
the finale left the frame. Every other entry into the reset still fades from
whatever was lit, which is what `resetFrom` in `js/sequence.js` remembers.

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
