/* The flight board: a dot-matrix LED panel, drawn dot by dot.

   Rather than approximate a pixel typeface, text is rendered tiny on an
   offscreen canvas, read back a pixel at a time, and each lit pixel redrawn as
   a round LED. The dots ARE the glyph, so it reads as a real matrix display
   instead of a small font with a texture over it. Unlit dots are drawn too --
   a dark grid across the whole panel is most of what makes the reference
   photograph look like hardware rather than a screenshot.

   The offscreen canvas only ever holds text we drew ourselves, so reading it
   back is safe even on file://, where an image from disk would taint it. */

const LedBoard = (function () {

  const cache = new Map();          // "text|size" -> [[x,y], ...] lit dots
  let scratch = null;

  function scratchCtx() {
    if (!scratch) {
      scratch = document.createElement('canvas');
      scratch.width = 400;
      scratch.height = 40;
    }
    return scratch.getContext('2d', { willReadFrequently: true });
  }

  /* Rasterise a string into lit dot coordinates. */
  function dotsFor(text, size) {
    const key = text + '|' + size;
    const hit = cache.get(key);
    if (hit) return hit;

    const g = scratchCtx();
    g.clearRect(0, 0, scratch.width, scratch.height);
    /* A pixel-grid font at its native size lands on whole pixels, which is
       what keeps the glyphs crisp when they become dots. */
    g.font = size + 'px "Courier New", ui-monospace, monospace';
    g.textBaseline = 'top';
    g.fillStyle = '#fff';
    g.fillText(text, 0, 2);

    const w = Math.min(scratch.width, Math.ceil(g.measureText(text).width) + 4);
    const data = g.getImageData(0, 0, w, scratch.height).data;
    const out = [];
    let maxX = 0, maxY = 0;
    for (let y = 0; y < scratch.height; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 110) {
          out.push(x, y);
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    out.width = maxX + 1;
    out.height = maxY + 1;
    cache.set(key, out);
    return out;
  }

  function textWidth(text, size) {
    return dotsFor(text, size).width;
  }

  /* Paint lit dots for a string at a dot-grid origin. */
  function drawText(ctx, text, size, col, row, cfg, alpha, color) {
    const dots = dotsFor(text, size);
    ctx.fillStyle = color || cfg.lit;
    ctx.globalAlpha = alpha;
    const r = cfg.dot * cfg.litRadius;
    for (let i = 0; i < dots.length; i += 2) {
      const x = col + dots[i], y = row + dots[i + 1];
      if (x < 0 || y < 0 || x >= cfg.cols || y >= cfg.rows) continue;
      ctx.beginPath();
      ctx.arc(cfg.x + (x + 0.5) * cfg.dot, cfg.y + (y + 0.5) * cfg.dot, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return dots.width;
  }

  /* A tail fin, drawn from the sprite in CONFIG.AIRLINE_TAILS. */
  function drawTail(ctx, key, col, row, cfg, alpha) {
    const tail = CONFIG.AIRLINE_TAILS[key] || CONFIG.AIRLINE_TAILS.DEFAULT;
    if (!tail) return;
    const r = cfg.dot * cfg.litRadius;
    for (let y = 0; y < tail.rows.length; y++) {
      const line = tail.rows[y];
      for (let x = 0; x < line.length; x++) {
        const ch = line[x];
        if (ch === ' ' || ch === '.') continue;
        const color = tail.colors[ch];
        if (!color) continue;
        const px = col + x, py = row + y;
        if (px < 0 || py < 0 || px >= cfg.cols || py >= cfg.rows) continue;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(cfg.x + (px + 0.5) * cfg.dot, cfg.y + (py + 0.5) * cfg.dot, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* Panel geometry, sized off the viewport so it holds its proportions. */
  function layout() {
    const dot = Math.max(3, Math.round(Math.min(Camera.width, Camera.height) / CONFIG.BOARD.dotDivisor));
    const cols = CONFIG.BOARD.cols, rows = CONFIG.BOARD.rows;
    return {
      dot: dot, cols: cols, rows: rows,
      x: CONFIG.BOARD.margin, y: CONFIG.BOARD.margin,
      w: cols * dot, h: rows * dot,
      lit: CONFIG.BOARD.lit,
      unlit: CONFIG.BOARD.unlit,
      litRadius: CONFIG.BOARD.litRadius
    };
  }

  function draw(ctx, flight, opacity, swap) {
    if (opacity <= 0.004) return;
    const cfg = layout();
    const B = CONFIG.BOARD;

    ctx.save();

    /* Bezel and black field. */
    ctx.globalAlpha = opacity;
    ctx.fillStyle = B.bezel;
    roundRect(ctx, cfg.x - B.bezelWidth, cfg.y - B.bezelWidth,
              cfg.w + B.bezelWidth * 2, cfg.h + B.bezelWidth * 2, B.bezelWidth);
    ctx.fill();
    ctx.fillStyle = B.field;
    roundRect(ctx, cfg.x, cfg.y, cfg.w, cfg.h, 2);
    ctx.fill();

    /* The unlit grid. This is the panel. */
    ctx.fillStyle = cfg.unlit;
    ctx.globalAlpha = opacity * B.unlitAlpha;
    const r = cfg.dot * B.unlitRadius;
    for (let y = 0; y < cfg.rows; y++) {
      for (let x = 0; x < cfg.cols; x++) {
        ctx.beginPath();
        ctx.arc(cfg.x + (x + 0.5) * cfg.dot, cfg.y + (y + 0.5) * cfg.dot, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (flight) {
      /* `swap` runs 0..1 as one flight replaces another; the panel blanks and
         relights rather than cross-fading, the way a real matrix would. */
      const a = opacity * (swap === undefined ? 1 : swap);
      const L = B.layout;
      drawTail(ctx, flight.airlineKey, L.tailCol, L.tailRow, cfg, a);
      drawText(ctx, flight.airline, B.smallSize, L.col, L.line1, cfg, a);
      drawText(ctx, flight.route, B.smallSize, L.col, L.line2, cfg, a);
      drawText(ctx, flight.aircraft, B.smallSize, L.col, L.line3, cfg, a);
      drawText(ctx, flight.fromName, B.bigSize, L.wideCol, L.line4, cfg, a);
      drawText(ctx, flight.toName, B.bigSize, L.wideCol, L.line5, cfg, a);
    }

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return { draw: draw, layout: layout, textWidth: textWidth };
})();
