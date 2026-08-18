/* The raster layer: dark basemap tiles for the Puget Sound region only.

   They're loaded straight off disk as <img>, which works on file:// where
   fetch() would not. Each tile is desaturated once on arrival and cached as a
   canvas, so the per-frame cost is a plain drawImage -- filtering 30 tiles
   every frame would not hold 60fps on a projector.

   Past the region the tiles simply run out and the vector world takes over;
   the fade is driven by zoom so you never see the edge of coverage. */

const Tiles = (function () {

  const cache = new Map();     // "z/x/y" -> canvas | 'loading' | 'missing'
  const MIN_Z = CONFIG.TILE_ZOOM_RANGE[0];
  const MAX_Z = CONFIG.TILE_ZOOM_RANGE[1];
  const COVERAGE = window.TILE_COVERAGE || {};

  /* tiles/manifest.js says exactly which tiles were downloaded. Asking for one
     that isn't there is harmless but noisy, and a console full of 404s hides
     the errors that matter. */
  function haveTile(z, x, y) {
    const box = COVERAGE[z];
    return !!box && x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
  }

  /* Recolour a tile once, on arrival, and keep the result. Doing this per
     frame would mean filtering ~30 tiles at 60fps; doing it here costs one
     drawImage per tile, ever. */
  function desaturate(img) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d');
    g.filter = CONFIG.TILE_FILTER;
    g.drawImage(img, 0, 0, 256, 256);
    return c;
  }

  /* Without canvas filters the tiles can't be flipped to match the vector
     layer, and they'd come out with water brighter than land -- the polarity
     inverting halfway through the pull-back looks far worse than not having
     them at all. Chrome and Firefox have had this for years; older Safari
     hasn't, and there we simply run vector-only. */
  const CAN_FILTER = (function () {
    const g = document.createElement('canvas').getContext('2d');
    g.filter = 'grayscale(1)';
    return g.filter === 'grayscale(1)';
  })();

  function get(z, x, y) {
    const key = z + '/' + x + '/' + y;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    cache.set(key, 'loading');
    const img = new Image();
    img.onload = function () { cache.set(key, desaturate(img)); };
    img.onerror = function () { cache.set(key, 'missing'); };
    img.src = 'tiles/' + key + '.png';
    return 'loading';
  }

  /* Tiles cover a limited zoom band. Fade them out below it rather than
     letting them pop, and let the vector layer carry the world view. */
  function zoomOpacity(zoom) {
    const lo = CONFIG.TILE_FADE[0], hi = CONFIG.TILE_FADE[1];
    if (zoom >= hi) return 1;
    if (zoom <= lo) return 0;
    const t = (zoom - lo) / (hi - lo);
    return t * t * (3 - 2 * t);
  }

  function draw(ctx, opacity) {
    if (!CAN_FILTER) return;
    const alpha = opacity * zoomOpacity(Camera.zoom) * CONFIG.TILE_MAX_OPACITY;
    if (alpha <= 0.004) return;

    const z = Math.max(MIN_Z, Math.min(MAX_Z, Math.round(Camera.zoom)));
    const n = 1 << z;
    const tileSize = Camera.scale() / n;

    /* Which tiles the viewport covers, in tile coordinates. */
    const originX = (Geo.mercX(Camera.lon) * n) - (Camera.width / 2) / tileSize;
    const originY = (Geo.mercY(Camera.lat) * n) - (Camera.height / 2) / tileSize;
    const x0 = Math.floor(originX), x1 = Math.ceil(originX + Camera.width / tileSize);
    const y0 = Math.max(0, Math.floor(originY));
    const y1 = Math.min(n - 1, Math.ceil(originY + Camera.height / tileSize));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingQuality = 'low';
    for (let x = x0; x <= x1; x++) {
      const wrapped = ((x % n) + n) % n;      // repeat east-west
      for (let y = y0; y <= y1; y++) {
        if (!haveTile(z, wrapped, y)) continue;
        const tile = get(z, wrapped, y);
        if (!tile || typeof tile === 'string') continue;
        const sx = (x - originX) * tileSize;
        const sy = (y - originY) * tileSize;
        /* +1px overdraw hides the hairline seams that fractional zoom
           otherwise leaves between neighbouring tiles. */
        ctx.drawImage(tile, sx, sy, tileSize + 1, tileSize + 1);
      }
    }
    ctx.restore();
  }

  return { draw: draw };
})();
