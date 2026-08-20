/* One rule for fitting a photograph into a frame, used everywhere a
   photograph appears.

   Frames here are a fixed shape and the pictures are not: phone portraits,
   camera landscapes, the odd panorama. Every frame crops to fill rather than
   letterboxing -- a black bar inside a frame on a ceiling reads as a mistake.

   What differs is where the crop is taken from. A picture wider than its frame
   loses its sides, and the middle is what you want. A picture taller than its
   frame loses top or bottom, and the middle is exactly wrong: people stand in
   the upper half of a portrait photograph, so a centred crop takes their
   chins off. Portraits are therefore cropped from near the top. */

const Photo = (function () {

  /* How far down a too-tall picture the crop window sits, 0 at the top and
     1 at the bottom. Portraits keep faces; anything else stays centred. */
  const PORTRAIT_BIAS = 0.14;

  /* The source rectangle to draw from, given the frame's shape. */
  function crop(img, frameW, frameH, biasY) {
    const ar = img.width / img.height, fr = frameW / frameH;
    if (ar > fr) {
      /* Wider than the frame: lose the sides, keep the middle. */
      const sw = img.height * fr;
      return { sx: (img.width - sw) / 2, sy: 0, sw: sw, sh: img.height };
    }
    /* Taller than the frame: lose top or bottom. */
    const sh = img.width / fr;
    const bias = biasY === undefined
      ? (ar < 1 ? PORTRAIT_BIAS : 0.5)
      : biasY;
    return { sx: 0, sy: (img.height - sh) * bias, sw: img.width, sh: sh };
  }

  /* Draw `img` filling the rectangle, cropped by the rule above. */
  function cover(ctx, img, x, y, w, h, biasY) {
    const c = crop(img, w, h, biasY);
    ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, x, y, w, h);
  }

  return { crop: crop, cover: cover };
})();
