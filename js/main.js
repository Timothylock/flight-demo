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
    Music.update();
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
    Airports.draw(ctx, heroT, s.dim * (1 - s.act2), s.hero * s.dim);
    Flights.drawAmbient(ctx, s.ambient * s.dim);
    Flights.drawHero(ctx, heroT, s.hero * s.dim);

    if (s.act2 > 0.004) drawAct2(ctx, s);
    if (s.act3 > 0.004) {
      const t3 = Sequence.state.phase === 'ACT3' ? Sequence.state.t : CONFIG.ACT3_SECONDS;
      Act3.draw(ctx, t3, s.act3);
    }
    if (s.act4 > 0.004) {
      const t4 = Sequence.state.phase === 'ACT4' ? Sequence.state.t : CONFIG.ACT4_SECONDS;
      Act4.draw(ctx, t4, s.act4);
    }
    if (s.finale > 0.004) {
      const tf = Sequence.state.phase === 'FINALE' ? Sequence.state.t : Finale.duration();
      Finale.draw(ctx, tf, s.finale);
    }

    Narration.update(heroT, s.narration);
    titleEl.style.opacity = s.title;
  }

  /* Act Two draws over the same map: photographs pinned to it, the aircraft,
     and the LED board on top of everything. */
  function drawAct2(ctx, s) {
    const t = Sequence.state.phase === 'ACT2' ? Sequence.state.t : Act2.duration();
    Act2.drawArrivals(ctx, t, s.act2, 'marks');
    Scrapbook.draw(ctx, t, s.act2);
    Act2.drawArrivals(ctx, t, s.act2, 'names');

    const st = Act2.state(t);
    if (st && st.plane > 0.01 && st.heading !== null) {
      const p = Camera.projectWrapped(st.lat, st.lon);
      Flights.drawPlane(ctx, p.x, p.y, st.heading, CONFIG.ACT2_PLANE_SIZE,
                        CONFIG.COLORS.hero, s.act2 * st.plane, 10);
    }
    LedBoard.draw(ctx, st ? st.flight : null, s.board);
  }

  /* ------------------------------------------------------------- controls */

  function trigger() {
    /* Sequence.start() is true only when a run actually begins, which is also
       the only moment the score should. Calling it from inside the key/tap
       handler is what lets the browser play it at all. */
    if (Sequence.start()) Music.start();
    else Sequence.skip();
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
  Narration.build();

  resize();
  Sequence.toIdle();
  document.body.classList.add('hide-cursor');
  requestAnimationFrame(frame);
})();
