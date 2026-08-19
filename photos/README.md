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

## Both acts

Frames are 4:3 landscape. Photos are cropped to fill without distorting, so
portrait shots will be centre-cropped; if most of yours are portrait, change
`CONFIG.SCRAPBOOK.frameW`/`frameH`.
