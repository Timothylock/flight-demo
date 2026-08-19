/* The show, as a small state machine.

     IDLE  -- black, radar sweeping, idle traffic. Waiting on you.
     RUN   -- map fades up, idle traffic clears, SEA and PAE launch, camera
              pulls back to the world, destinations light up as they're reached.
     HOLD  -- the finished world view, held.
     RESET -- title out, camera drifts home, map back to black, idle traffic
              returns. Ends in IDLE, armed for the next press.

   Every beat in RUN is a fraction of CONFIG.SEQUENCE_SECONDS, so retiming the
   whole piece is one number. */

const Sequence = (function () {

  let act2Exit = null;      // camera snapshot taken as the final pull-back starts
  let resetFrom = null;     // layer opacities as the reset begins

  const state = {
    phase: 'IDLE',
    t: 0,                 // seconds inside the current phase
    map: 0,               // map opacity: tiles + coastlines
    ambient: 1,
    hero: 0,
    title: 0,
    dim: 1,               // everything under the title card fades back a little
    radar: 1,             // the sweep: cold open only
    narration: 0,         // the lines carried through the flying
    act2: 0,              // the scrapbook act
    board: 0,             // the LED flight board
    act3: 0,              // the water
    act4: 0,              // the board
    finale: 0             // the last photograph
  };

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function ramp(t, a, b) {
    if (b <= a) return t >= b ? 1 : 0;
    return clamp01((t - a) / (b - a));
  }

  function smooth(t) { return t * t * (3 - 2 * t); }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* The pull-back curve.

     A symmetric ease looks wrong here: aircraft leaving Seattle cross the
     regional view in well under a second, so a camera that's still easing in
     at t+2s has already lost them off the edge. This opens out quickly --
     Puget Sound to most of the Pacific in the first couple of seconds -- and
     then creeps the rest of the way, so the arrivals all land against a world
     that's already settled. The smoothstep on the way in keeps it from
     snapping at the very first frame. */
  function easePullBack(t) {
    const eased = t * t * (3 - 2 * t);
    return 1 - Math.pow(1 - eased, 3);
  }

  /* Interpolate the camera in map space rather than in degrees, so the pull
     back travels at an even rate across the screen. */
  function lerpCamera(from, to, e) {
    const x = Geo.mercX(from.lon) + (Geo.mercX(to.lon) - Geo.mercX(from.lon)) * e;
    const y = Geo.mercY(from.lat) + (Geo.mercY(to.lat) - Geo.mercY(from.lat)) * e;
    Camera.set(Geo.invMercY(y), Geo.invMercX(x), from.zoom + (to.zoom - from.zoom) * e);
  }

  /* Ease the camera towards a view. Snapping to a freshly computed target
     every frame reads as a jitter; this glides. */
  function easeCameraTo(target, dt, tau) {
    const k = 1 - Math.exp(-dt / tau);
    const cx = Geo.mercX(Camera.lon) +
               (Geo.mercX(Geo.unwrap(target.lon, Camera.lon)) - Geo.mercX(Camera.lon)) * k;
    const cy = Geo.mercY(Camera.lat) + (Geo.mercY(target.lat) - Geo.mercY(Camera.lat)) * k;
    const zoom = Camera.zoom + (target.zoom - Camera.zoom) * k;
    Camera.set(Geo.invMercY(cy), Geo.invMercX(cx), zoom);
  }

  /* Exponential smoothing towards the target view. Fitting exactly every
     frame would snap the camera each time a flight lands; this glides. */
  function followNetwork(t, dt) {
    const reached = Flights.reachedAt();
    const codes = [];
    Object.keys(reached).forEach(function (code) {
      if (reached[code] <= t) codes.push(code);
    });
    /* Aircraft in the air are held in frame by their live position, and their
       destination is folded in only once they're well on the way. Opening the
       frame the instant a Hong Kong flight pushes back would swing the camera
       out to the far side of the world with nothing there yet, and then leave
       it sitting still for the rest of the sequence. */
    const points = [];
    Flights.heroes.forEach(function (f) {
      if (t < f.t0 || t > f.tEnd) return;
      const at = Flights.positionAt(f, t);
      if (at) {
        points.push(at);
        if (at.progress > 0.35) {
          const dest = at.seg.to;
          if (codes.indexOf(dest) < 0) codes.push(dest);
        }
      }
    });
    if (!codes.length && !points.length) return;

    const target = Camera.fitTo(codes, points);
    const k = 1 - Math.exp(-dt / CONFIG.CAMERA_FOLLOW_TAU);

    const cx = Geo.mercX(Camera.lon) + (Geo.mercX(target.lon) - Geo.mercX(Camera.lon)) * k;
    const cy = Geo.mercY(Camera.lat) + (Geo.mercY(target.lat) - Geo.mercY(Camera.lat)) * k;
    /* Only ever open out during the run -- a newly reached airport must never
       make the camera dive back in. */
    const zoom = Math.min(Camera.zoom, Camera.zoom + (target.zoom - Camera.zoom) * k);
    Camera.set(Geo.invMercY(cy), Geo.invMercX(cx), zoom);
  }

  /* Enter the reset, remembering what was lit so it can fade from there.
     Without this the reset assumed it was leaving the Act One title hold and
     faded a full-strength title card back in over whatever was actually on
     screen. */
  function beginReset() {
    /* The finale has already taken the frame to black, and the radar starts
       from black too -- so there is nothing to fade out, and pulling the map
       back up just to fade it down again would flash. */
    if (state.phase === 'FINALE') {
      state.map = 0; state.hero = 0; state.title = 0;
      state.act2 = 0; state.board = 0; state.act3 = 0; state.act4 = 0;
      state.finale = 0;
      Camera.set(CONFIG.HOME.lat, CONFIG.HOME.lon, Camera.homeZoom());
    }
    resetFrom = {
      title: state.title, act2: state.act2, board: state.board,
      act3: state.act3, act4: state.act4, finale: state.finale,
      map: state.map, hero: state.hero,
      view: { lat: Camera.lat, lon: Camera.lon, zoom: Camera.zoom }
    };
    state.phase = 'RESET';
    state.t = 0;
  }

  function homeView() {
    return { lat: CONFIG.HOME.lat, lon: CONFIG.HOME.lon, zoom: Camera.homeZoom() };
  }

  function worldView() {
    return Camera.worldView();
  }

  function toIdle() {
    state.phase = 'IDLE';
    state.t = 0;
    state.map = 0;
    state.ambient = 1;
    state.hero = 0;
    state.title = 0;
    state.dim = 1;
    state.radar = 1;
    state.narration = 0;
    state.act2 = 0;
    state.board = 0;
    state.act3 = 0;
    state.act4 = 0;
    state.finale = 0;
    act2Exit = null;
    resetFrom = null;
    Act3.reset();
    Act4.reset();
    Finale.reset();
    Music.stop();
    Narration.clear();
    Scrapbook.reset();
    Flights.clearHero();
    Flights.buildAmbient();
    Airports.reset();
    lerpCamera(homeView(), homeView(), 0);
  }

  function start() {
    if (state.phase !== 'IDLE') return false;
    state.phase = 'RUN';
    state.t = 0;
    Airports.reset();
    Flights.buildHero();
    return true;
  }

  /* Space during the held frame cuts straight to the reset. */
  function skip() {
    if (state.phase === 'HOLD') {
      beginReset();
      return true;
    }
    return false;
  }

  function update(dt) {
    state.t += dt;
    const SEQ = CONFIG.SEQUENCE_SECONDS;
    const B = CONFIG.BEATS;

    if (state.phase === 'IDLE') {
      Flights.updateAmbient(dt, true);
      lerpCamera(homeView(), homeView(), 0);
      return;
    }

    if (state.phase === 'RUN') {
      const t = state.t;

      state.map = smooth(ramp(t, B.mapFadeIn[0] * SEQ, B.mapFadeIn[1] * SEQ));
      state.ambient = 1 - smooth(ramp(t, B.ambientFadeOut[0] * SEQ, B.ambientFadeOut[1] * SEQ));
      state.hero = 1;
      state.title = smooth(ramp(t, B.titleFadeIn[0] * SEQ, B.titleFadeIn[1] * SEQ));

      /* The sweep is the waiting state. Once the map is up it has done its
         job, and a line rotating over the departures just fights them. */
      state.radar = 1 - smooth(ramp(t, B.mapFadeIn[0] * SEQ, B.mapFadeIn[1] * SEQ));

      /* Narration gives way to the title card rather than sharing the frame. */
      state.narration = 1 - state.title;

      Flights.updateAmbient(dt, state.ambient > 0.01);
      Flights.updateHero(t, function (code) { Airports.reveal(code, t); });

      state.dim = 1 - state.title * (1 - CONFIG.TITLE_DIM);

      /* The camera follows the network rather than a stopwatch.

         On a fixed pull-back the two drift apart: the flights reached Toronto
         a third of the way in while the camera was still over Puget Sound, so
         the narration talked about a city that wasn't on screen. Fitting to
         what has actually been reached -- plus where anything airborne is
         headed, so the frame opens ahead of the aircraft rather than chasing
         them -- keeps the picture and the words describing the same thing.

         It converges on the final view for free: once everywhere is reached,
         the fit IS the final view. */
      followNetwork(t, dt);

      if (t >= SEQ) {
        state.phase = 'HOLD';
        state.t = 0;
      }
      return;
    }

    if (state.phase === 'HOLD') {
      state.title = 1;
      state.dim = CONFIG.TITLE_DIM;
      state.radar = 0;
      state.narration = 0;
      lerpCamera(worldView(), worldView(), 1);
      if (state.t >= CONFIG.HOLD_SECONDS) {
        state.phase = 'ACT2';
        state.t = 0;
        act2Exit = null;
        Act2.build();
      }
      return;
    }

    if (state.phase === 'ACT2') {
      const t = state.t;
      const T = Act2.duration();

      /* The title and the world view give way to the scrapbook. */
      state.title = 1 - smooth(ramp(t, 0.0, 1.1));
      state.act2 = smooth(ramp(t, 0.5, 1.8));
      state.board = smooth(ramp(t, 0.9, 2.0));
      state.hero = 1 - smooth(ramp(t, 0.0, 1.4));      // Act One's arcs clear out
      state.ambient = 0;
      state.map = 1;
      state.dim = 1;
      state.narration = 0;

      Act2.update(t);

      /* Ride with the aircraft, then pull back to hold the whole scrapbook. */
      const st = Act2.state(t);
      const finish = ramp(t, T - CONFIG.ACT2_FINAL, T);

      if (finish > 0) {
        /* Interpolate straight from a snapshot taken as the pull-back began,
           with no extra smoothing on top. Easing towards a target that is
           itself being eased lags twice over, and the camera was still short
           of its mark when the act ended -- Hong Kong and Taiwan never made it
           back into frame. */
        if (!act2Exit) {
          act2Exit = { lat: Camera.lat, lon: Camera.lon, zoom: Camera.zoom };
        }
        const end = Act2.finalView();
        const e = easeInOutCubic(finish);
        const lon = Geo.unwrap(end.lon, act2Exit.lon);
        Camera.set(
          Geo.invMercY(Geo.mercY(act2Exit.lat) +
                       (Geo.mercY(end.lat) - Geo.mercY(act2Exit.lat)) * e),
          act2Exit.lon + (lon - act2Exit.lon) * e,
          act2Exit.zoom + (end.zoom - act2Exit.zoom) * e
        );
      } else if (st) {
        /* Slack off the smoothing at the top of the act so the camera glides
           out of Act One's world view instead of snapping onto Vancouver. */
        const settle = Math.min(1, t / CONFIG.ACT2_CAMERA.settleSeconds);
        const tau = CONFIG.ACT2_CAMERA.enterTau +
                    (CONFIG.ACT2_CAMERA.tau - CONFIG.ACT2_CAMERA.enterTau) * smooth(settle);
        easeCameraTo({ lat: st.lat, lon: st.lon, zoom: st.zoom }, dt, tau);
      }

      if (t >= T) {
        state.phase = 'ACT3';
        state.t = 0;
        Act3.build();
      }
      return;
    }

    if (state.phase === 'ACT3') {
      const t = state.t;
      /* The water rises over the map rather than replacing it: bubbles are
         already streaming past while the coastlines are still fading. */
      state.act3 = smooth(ramp(t, 0.0, CONFIG.ACT3_FADE_IN));
      state.act2 = 1 - smooth(ramp(t, 0.2, CONFIG.ACT3_FADE_IN * 0.9));
      state.board = 1 - smooth(ramp(t, 0.0, 0.8));
      state.map = 1 - smooth(ramp(t, 0.3, CONFIG.ACT3_FADE_IN));
      state.hero = 0;
      state.ambient = 0;
      state.title = 0;

      Act3.update(t, dt);

      if (t >= CONFIG.ACT3_SECONDS) {
        state.phase = 'ACT4';
        state.t = 0;
        Act4.build();
      }
      return;
    }

    if (state.phase === 'ACT4') {
      const t = state.t;
      /* Surfacing: the water gives way to the board under the flash. */
      state.act4 = smooth(ramp(t, 0.0, CONFIG.ACT4.surfaceSeconds * 0.8));
      state.act3 = 1 - smooth(ramp(t, 0.0, CONFIG.ACT4.surfaceSeconds));
      state.act2 = 0;
      state.board = 0;
      state.map = 0;
      state.hero = 0;
      state.ambient = 0;
      state.title = 0;

      if (t >= CONFIG.ACT4_SECONDS) {
        state.phase = 'FINALE';
        state.t = 0;
        Finale.build();
      }
      return;
    }

    if (state.phase === 'FINALE') {
      const t = state.t;
      /* The board gives way slowly; the photograph is already coming up
         underneath it. */
      state.finale = 1;
      state.act4 = 1 - smooth(ramp(t, 0.0, CONFIG.FINALE.fadeIn * 0.75));
      state.act3 = 0;
      state.act2 = 0;
      state.board = 0;
      state.title = 0;

      if (t >= Finale.duration()) {
        beginReset();
      }
      return;
    }

    if (state.phase === 'RESET') {
      const T = CONFIG.RESET_SECONDS;
      const t = state.t / T;
      const from = resetFrom || { title: 1, act2: 0, board: 0, act3: 0,
                                  act4: 0, finale: 0, map: 1, hero: 1,
                                  view: worldView() };

      /* Everything that was lit fades from where it was, not from full. */
      state.title = from.title * (1 - smooth(ramp(t, 0.00, 0.28)));
      state.act2 = from.act2 * (1 - smooth(ramp(t, 0.00, 0.28)));
      state.board = from.board * (1 - smooth(ramp(t, 0.00, 0.28)));
      state.act3 = from.act3 * (1 - smooth(ramp(t, 0.00, 0.28)));
      state.act4 = from.act4 * (1 - smooth(ramp(t, 0.00, 0.28)));
      state.finale = from.finale * (1 - smooth(ramp(t, 0.00, 0.28)));
      state.dim = 1 - state.title * (1 - CONFIG.TITLE_DIM);
      state.narration = 0;
      state.hero = from.hero * (1 - smooth(ramp(t, 0.08, 0.45)));
      state.map = from.map * (1 - smooth(ramp(t, 0.55, 1.00)));
      state.ambient = smooth(ramp(t, 0.62, 1.00));
      /* Sweep comes back with the black, as the cold open reassembles. */
      state.radar = smooth(ramp(t, 0.60, 1.00));

      Flights.updateAmbient(dt, true);
      lerpCamera(from.view, homeView(), easeInOutCubic(clamp01(t / 0.88)));

      if (state.t >= T) toIdle();
      return;
    }
  }

  /* Hero flights keep their own clock: the RUN timeline, frozen at the end so
     landed aircraft stay landed through HOLD and RESET. */
  function heroTime() {
    if (state.phase === 'RUN') return state.t;
    if (state.phase === 'IDLE') return -1;
    return CONFIG.SEQUENCE_SECONDS;
  }

  return {
    state: state,
    start: start,
    skip: skip,
    update: update,
    toIdle: toIdle,
    heroTime: heroTime
  };
})();
