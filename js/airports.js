/* Airport markers. SEA and PAE are on screen from the start; everywhere else
   appears the moment a flight actually gets there, with a ring pulse, and then
   stays. By the end of the sequence the map has drawn its own list of every
   place you went. */

const Airports = (function () {

  const shown = new Map();     // code -> { at: seconds, origin: bool }

  function reset() {
    shown.clear();
    shown.set('SEA', { at: -99, origin: true });
    shown.set('PAE', { at: -99, origin: true });
  }

  function reveal(code, now) {
    if (shown.has(code)) return;
    shown.set(code, { at: now, origin: false });
  }

  function drawMarker(ctx, x, y, code, age, origin, opacity) {
    const appear = origin ? 1 : Math.min(1, Math.max(0, age / 0.55));
    const alpha = opacity * appear;
    if (alpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    /* Expanding ring on arrival. */
    if (!origin && age < 1.6) {
      const t = age / 1.6;
      ctx.globalAlpha = alpha * (1 - t) * 0.7;
      ctx.strokeStyle = CONFIG.COLORS.airport;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, 4 + t * 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }

    /* Steady ring, brighter for the two home fields. */
    ctx.strokeStyle = CONFIG.COLORS.airport;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = alpha * (origin ? 0.55 : 0.4);
    ctx.beginPath();
    ctx.arc(x, y, origin ? 8 : 6.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = CONFIG.COLORS.airport;
    ctx.shadowColor = CONFIG.COLORS.airport;
    ctx.shadowBlur = origin ? 12 : 9;
    ctx.beginPath();
    ctx.arc(x, y, origin ? 3.2 : 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 5;
    ctx.font = (origin ? '600 15px ' : '600 14px ') +
               'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha * (origin ? 1 : 0.92);
    ctx.letterSpacing = '1.5px';
    const lx = x + 12;
    const ly = Labels.place(lx, y - 3, ctx.measureText(code).width, 16);
    /* A leader line, once the label has been pushed clear of the marker. */
    if (Math.abs(ly - (y - 2.5)) > 9) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.35;
      ctx.strokeStyle = CONFIG.COLORS.airport;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 4, y);
      ctx.lineTo(lx - 3, ly);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillText(code, lx, ly);
    ctx.restore();
  }

  /* SEA and PAE are part of the standing scope and never fade; the
     destinations come and go with the sequence. */
  function draw(ctx, now, originOpacity, destOpacity) {
    shown.forEach(function (info, code) {
      const opacity = info.origin ? originOpacity : destOpacity;
      if (opacity <= 0.004) return;
      const a = AIRPORTS[code];
      if (!a) return;
      const p = Camera.projectWrapped(a.lat, a.lon);
      if (!Camera.onScreen(p, 60)) return;
      drawMarker(ctx, p.x, p.y, code, now - info.at, info.origin, opacity);
    });
  }

  return { reset: reset, reveal: reveal, draw: draw, count: function () { return shown.size; } };
})();
