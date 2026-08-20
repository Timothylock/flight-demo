# Photographs

Filenames come from `js/config.js`. Everything here is already sized for the
piece -- 2400px on the long edge, EXIF rotation applied.

## Act Two (the scrapbook)

    japan-1..3.jpeg     hongkong-1..3.jpeg
    taiwan-1..4.jpeg    iceland-1..4.jpeg

Frames are pinned to the map at each destination and fan out as the aircraft
arrives. Change how many a place gets by editing
`CONFIG.ACT2_FLIGHTS[].photos`; the fan has layouts for one through four.

An entry is either a filename or a filename with a crop:

```js
photos: [
  { name: 'japan-1.jpeg', crop: 0.18 },   // where a too-tall picture is cropped from
  'japan-2.jpeg'                          // no crop given: js/photo.js decides
]
```

The four that carry one were checked against the frame rather than guessed --
`taiwan-2` in particular, where the default crop cut the sky lantern and both
of you clean out of the picture.

Anything missing draws as an empty frame carrying the place name, so the
sequence looks finished before a single photograph is added.

Acts One and Two are monochrome and the photographs are the exception, so they
are drawn at `CONFIG.SCRAPBOOK.saturation` -- 0.62, part way back off full
colour. Enough to sit in the map rather than float on top of it, not so far
that the one warm thing in the first two acts goes grey. 1 leaves them
untouched, 0 makes them match the map.

## Act Three (underwater)

    northcascades.jpeg   water-2..6.jpeg

Same rule as Act Two: a filename, or a filename with a crop. Six at this
spacing keeps two or three suspended at once, which is the density the act was
built for -- more would crowd, fewer would leave gaps.

They drift at different depths and are seen at an angle, partly overlapped, so
pick images that read at a glance rather than ones with detail in the corners.

Note the act is underwater and its three lines are about being in the water.
The photographs in here at the moment are not -- swap them for beach and
swimming ones if you have them, or rewrite `CONFIG.ACT3.lines`.

## Act Four (the board)

    vancouver.jpeg   d23.jpeg   disney.jpeg

One per landing, shown large in the middle of the board with the square's name
and a line underneath. The dice are arranged so the tokens land on
**Vancouver**, then **Anaheim**, then **Disneyland CA** -- so the photographs
and the place names always agree.

Only three photographs for four turns, because the last two landings are the
same square: one token arrives at Disneyland, the other joins it. They share
the picture and only the line changes, which is why it doesn't re-lay itself
between the two.

To use different places, rename the squares in `CONFIG.ACT4.tiles`, then point
`land` and `finishOn` at the new names -- they are matched by name, so nothing
breaks if a tile moves.

## All acts

Every frame crops to fill rather than letterboxing -- a black bar inside a
frame on a ceiling reads as a mistake. Where the crop is taken from depends on
the picture: one wider than its frame loses its sides and keeps the middle,
which is what a panorama wants. One taller than its frame loses top or bottom,
and there the middle is exactly wrong, because people stand in the upper half
of a portrait photograph and a centred crop takes their chins off. Portraits
are therefore cropped from near the top. That rule lives in `js/photo.js`;
`CONFIG.FINALE.crop` and a reveal's `crop` override it with a number from 0
(hard to the top) to 1 (hard to the bottom).

Anything missing draws as an empty frame, so the piece looks finished before a
single photograph is added.
