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

    water-1.jpg ... water-7.jpg

Same rule: anything missing floats as an empty frame. These drift at different
depths with two or three suspended at once, so they're seen at an angle and
partly overlapped -- pick images that read at a glance rather than ones with
detail in the corners.

## Act Four (the board)

    board-1.jpg   d23.jpeg   board-3.jpg   disney.jpeg

One per dice roll, shown large in the middle of the board with the square's
name and a line underneath, in that order.

The last two are the point of the act. The dice are arranged so both tokens
finish on **Disneyland CA**, and the landing before that pair is **Anaheim** --
so `d23.jpeg` (the expo) lands on Anaheim, and `disney.jpeg` lands on
Disneyland as the second token joins the first.

Because both tokens land on Disneyland -- one arrives, then the other joins it
-- that square gets two reveals. `board-3.jpg` is the first of them and wants a
second Disneyland photograph; without one it draws as an empty frame between
two real pictures.

## The finale

    last.jpeg

One photograph, alone on black, held for ten seconds with a single line under
it. It is the last thing seen before the radar comes back, so it wants to be
the best one -- and a bright one: everything around it is black, and a dark
photo reads as an empty frame.

## All acts

Frames are 4:3 landscape. Photos are cropped to fill without distorting, so
portrait shots will be centre-cropped; if most of yours are portrait, change
`CONFIG.SCRAPBOOK.frameW`/`frameH`.
