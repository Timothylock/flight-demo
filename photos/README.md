# Photographs

Drop images in here using the filenames listed in `CONFIG.ACT2_FLIGHTS`
(`js/config.js`):

    japan-1.jpg  japan-2.jpg  japan-3.jpg
    hongkong-1.jpg  hongkong-2.jpg  hongkong-3.jpg
    taiwan-1.jpg  taiwan-2.jpg
    iceland-1.jpg  iceland-2.jpg  iceland-3.jpg

Anything missing draws as an empty frame carrying the place name, so the
sequence looks finished before a single photo is added. Add or rename files in
the config to change how many each place gets — no other code to touch.

## Act Three (underwater)

    northcascades.jpeg   water-2.jpg ... water-7.jpg

Same rule: anything missing floats as an empty frame. These drift at different
depths with two or three suspended at once, so they're seen at an angle and
partly overlapped -- pick images that read at a glance rather than ones with
detail in the corners.

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
