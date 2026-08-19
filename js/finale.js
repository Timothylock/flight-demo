/* The last beat.

   Everything else clears and one photograph comes up alone, with one line
   under it, and stays there. It's the only moment in the whole piece with
   nothing moving -- no aircraft, no bubbles, no dice -- which is what makes it
   land after twenty minutes of motion.

   Three parts: a slow fade up out of whatever came before, a long hold, and a
   fade down into the black the radar starts from. */

const Finale = (function () {

  let img = null;

  function load() {
    if (img !== null) return;
    const F = CONFIG.FINALE;
    const el = new Image();
    el.onload = function () { img = el; };
    el.onerror = function () { img = 'missing'; };
    el.src = F.dir + F.photo;
    img = 'loading';
  }

  function build() { load(); }

  function duration() {
    const F = CONFIG.FINALE;
    return F.fadeIn + F.hold + F.fadeOut;
  }

  /* 0 while arriving, 1 across the hold, back to 0 on the way out. */
  function level(t) {
    const F = CONFIG.FINALE;
    if (t < F.fadeIn) return smoothstep(t / F.fadeIn);
    if (t < F.fadeIn + F.hold) return 1;
    return 1 - smoothstep((t - F.fadeIn - F.hold) / F.fadeOut);
  }

  function smoothstep(x) {
    x = x < 0 ? 0 : x > 1 ? 1 : x;
    return x * x * (3 - 2 * x);
  }

  function draw(ctx, t, opacity) {
    const F = CONFIG.FINALE;
    const a = level(t) * opacity;
    if (a <= 0.004) return;

    const cx = Camera.width / 2, cy = Camera.height / 2;
    const scale = Math.min(Camera.width, Camera.height) / 1080;

    ctx.save();

    /* Black underneath, so the act before it is genuinely gone rather than
       showing through. */
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, Camera.width, Camera.height);

    /* A very slow drift inwards over the hold -- barely perceptible, but it
       keeps the frame from looking frozen. */
    const creep = 1 + Math.min(1, t / duration()) * F.drift;

    const h = Camera.height * F.size;
    const w = h * F.aspect;
    const py = cy - Camera.height * 0.045;

    ctx.globalAlpha = a;
    ctx.translate(cx, py);
    ctx.scale(creep, creep);

    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 46 * scale;
    ctx.shadowOffsetY = 12 * scale;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(-w / 2 - 8 * scale, -h / 2 - 8 * scale,
                 w + 16 * scale, h + 16 * scale);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    if (img && img !== 'loading' && img !== 'missing') {
      const ar = img.width / img.height, fr = w / h;
      let sw = img.width, sh = img.height, sx = 0, sy = 0;
      if (ar > fr) { sw = img.height * fr; sx = (img.width - sw) / 2; }
      else { sh = img.width / fr; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = '#101418';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 1;
      ctx.strokeRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.font = (13 * scale) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = (3 * scale) + 'px';
      ctx.fillText(F.photo, 0, 0);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();

    /* The line, arriving a moment after the photograph has settled. */
    const lineIn = smoothstep((t - F.fadeIn * F.lineDelay) / Math.max(0.1, F.fadeIn * 0.9));
    ctx.save();
    ctx.globalAlpha = a * lineIn;
    ctx.textAlign = 'center';
    ctx.fillStyle = F.textColor;
    ctx.font = 'italic ' + (30 * scale) + 'px Georgia, "Times New Roman", serif';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 16 * scale;
    ctx.fillText(F.line, cx, py + (h / 2) + 62 * scale);
    ctx.restore();
  }

  function reset() { }

  return { build: build, draw: draw, duration: duration, reset: reset };
})();
