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

  const state = {
    phase: 'IDLE',
    t: 0,                 // seconds inside the current phase
    map: 0,               // map opacity: tiles + coastlines
    ambient: 1,
    hero: 0,
    title: 0,
    dim: 1,               // everything under the title card fades back a little
    radar: 1              // the sweep: cold open only
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
      state.phase = 'RESET';
      state.t = 0;
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

      Flights.updateAmbient(dt, state.ambient > 0.01);
      Flights.updateHero(t, function (code) { Airports.reveal(code, t); });

      state.dim = 1 - state.title * (1 - CONFIG.TITLE_DIM);

      const e = easePullBack(ramp(t, B.zoomOut[0] * SEQ, B.zoomOut[1] * SEQ));
      lerpCamera(homeView(), worldView(), e);

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
      lerpCamera(worldView(), worldView(), 1);
      if (state.t >= CONFIG.HOLD_SECONDS) {
        state.phase = 'RESET';
        state.t = 0;
      }
      return;
    }

    if (state.phase === 'RESET') {
      const T = CONFIG.RESET_SECONDS;
      const t = state.t / T;

      state.title = 1 - smooth(ramp(t, 0.00, 0.28));
      state.dim = 1 - state.title * (1 - CONFIG.TITLE_DIM);
      state.hero = 1 - smooth(ramp(t, 0.08, 0.45));
      state.map = 1 - smooth(ramp(t, 0.55, 1.00));
      state.ambient = smooth(ramp(t, 0.62, 1.00));
      /* Sweep comes back with the black, as the cold open reassembles. */
      state.radar = smooth(ramp(t, 0.60, 1.00));

      Flights.updateAmbient(dt, true);
      lerpCamera(worldView(), homeView(), easeInOutCubic(clamp01(t / 0.88)));

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
