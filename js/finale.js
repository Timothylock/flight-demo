/* The last beat.

   Everything else clears and one photograph comes up alone, with one line
   under it, and stays there. It's the only moment in the whole piece with
   nothing moving -- no aircraft, no bubbles, no dice -- which is what makes it
   land after twenty minutes of motion.

   Four things happen, on their own clocks rather than together, which is what
   keeps it from feeling like a slide. The board dissolves into black. A beat
   later the photograph comes up through it. The line arrives under it, stays a
   while, and leaves -- so the last thing on the ceiling is just the picture.
   And the photograph is growing the whole time, slowly enough that you never
   catch it happening. */

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

  /* The photograph: nothing until photoDelay, up by fadeIn, held, then out. */
  function level(t) {
    const F = CONFIG.FINALE;
    const outAt = F.fadeIn + F.hold;
    if (t < F.photoDelay) return 0;
    if (t < F.fadeIn) {
      return smoothstep((t - F.photoDelay) / Math.max(0.1, F.fadeIn - F.photoDelay));
    }
    if (t < outAt) return 1;
    return 1 - smoothstep((t - outAt) / F.fadeOut);
  }

  /* The black the board dissolves into. Its own ramp, because the photograph
     must not have to wait for the board to finish leaving. */
  function blackLevel(t) {
    const F = CONFIG.FINALE;
    return smoothstep(t / Math.max(0.1, F.blackIn));
  }

  /* The line: in, a good while, out -- and gone before the photograph is. */
  function lineLevel(t) {
    const F = CONFIG.FINALE;
    if (t < F.lineAt) return 0;
    const up = smoothstep((t - F.lineAt) / Math.max(0.1, F.lineFadeIn));
    const outAt = F.lineAt + F.lineFadeIn + F.lineHold;
    if (t < outAt) return up;
    return 1 - smoothstep((t - outAt) / Math.max(0.1, F.lineFadeOut));
  }

  /* Always moving, never hurrying: a shade under its size to a shade over,
     across the whole beat. Slightly eased at the start so it doesn't lurch
     the instant it appears. */
  function growth(t) {
    const F = CONFIG.FINALE;
    const k = Math.min(1, Math.max(0, t / duration()));
    return F.startScale + F.grow * Math.pow(k, 0.85);
  }

  function smoothstep(x) {
    x = x < 0 ? 0 : x > 1 ? 1 : x;
    return x * x * (3 - 2 * x);
  }

  function draw(ctx, t, opacity) {
    const F = CONFIG.FINALE;
    const a = level(t) * opacity;
    const black = blackLevel(t) * opacity;
    if (a <= 0.004 && black <= 0.004) return;

    const cx = Camera.width / 2, cy = Camera.height / 2;
    const scale = Math.min(Camera.width, Camera.height) / 1080;

    ctx.save();

    /* The board dissolving away, rather than being cut away. */
    ctx.globalAlpha = black;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, Camera.width, Camera.height);

    if (a <= 0.004) { ctx.restore(); return; }

    const grew = growth(t);
    const h = Camera.height * F.size;
    const w = h * F.aspect;
    const py = cy - Camera.height * 0.045;

    ctx.globalAlpha = a;
    ctx.translate(cx, py);
    ctx.scale(grew, grew);

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
      Photo.cover(ctx, img, -w / 2, -h / 2, w, h, F.crop);
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

    /* The line sits under the photograph and keeps sitting under it as it
       grows, then goes, leaving the picture on its own. */
    const lineA = a * lineLevel(t);
    if (lineA > 0.004) {
      ctx.save();
      ctx.globalAlpha = lineA;
      ctx.textAlign = 'center';
      ctx.fillStyle = F.textColor;
      ctx.font = 'italic ' + (30 * scale) + 'px Georgia, "Times New Roman", serif';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 16 * scale;
      ctx.fillText(F.line, cx, py + (h * grew / 2) + 62 * scale);
      ctx.restore();
    }
  }

  function reset() { }

  return { build: build, draw: draw, duration: duration, reset: reset,
           level: level, lineLevel: lineLevel, blackLevel: blackLevel,
           growth: growth };
})();
