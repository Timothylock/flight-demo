/* Wiring: canvas, the frame loop, and the one interaction there is.

   Space (or a tap) starts the sequence. It runs, holds, resets itself, and
   waits for you again. F toggles fullscreen, R forces a reset. */

(function () {

  const canvas = document.getElementById('scope');
  const ctx = canvas.getContext('2d', { alpha: false });
  const titleEl = document.getElementById('title');
  const line1El = document.getElementById('title-line1');
  const line2El = document.getElementById('title-line2');

  let last = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Camera.width = w;
    Camera.height = h;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    Radar.update(dt);
    Sequence.update(dt);

    const s = Sequence.state;
    const heroT = Sequence.heroTime();

    ctx.fillStyle = CONFIG.COLORS.background;
    ctx.fillRect(0, 0, Camera.width, Camera.height);

    /* s.dim pulls the whole map back under the title card. */
    WorldLayer.draw(ctx, s.map * s.dim);
    Tiles.draw(ctx, s.map * s.dim);
    Radar.draw(ctx, s.radar * s.dim);

    /* Airport codes claim their label slots before any aircraft do. */
    Labels.begin(dt);
    Airports.draw(ctx, heroT, s.dim, s.hero * s.dim);
    Flights.drawAmbient(ctx, s.ambient * s.dim);
    Flights.drawHero(ctx, heroT, s.hero * s.dim);

    titleEl.style.opacity = s.title;
  }

  /* ------------------------------------------------------------- controls */

  function trigger() {
    if (!Sequence.start()) Sequence.skip();
  }

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      trigger();
    } else if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } else if (e.key === 'r' || e.key === 'R') {
      Sequence.toIdle();
    }
  });

  /* Tapping anywhere does what space does. touchstart rather than click so it
     fires the instant a finger lands. */
  window.addEventListener('touchstart', function (e) {
    e.preventDefault();
    trigger();
  }, { passive: false });
  window.addEventListener('mousedown', trigger);

  /* Hide the pointer once it stops moving -- nothing should be on the ceiling
     that isn't the map. */
  let cursorTimer = null;
  window.addEventListener('mousemove', function () {
    document.body.classList.remove('hide-cursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(function () {
      document.body.classList.add('hide-cursor');
    }, 2000);
  });

  window.addEventListener('resize', resize);

  /* --------------------------------------------------------------- start */

  line1El.textContent = TITLE.line1;
  line2El.textContent = TITLE.line2;

  resize();
  Sequence.toIdle();
  document.body.classList.add('hide-cursor');
  requestAnimationFrame(frame);
})();
