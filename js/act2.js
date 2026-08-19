/* Act Two.

   One aircraft flies four real flights. Between places the camera is pulled
   back and time runs quick; on approach it eases down to country scale and the
   aircraft almost hovers while photographs fan out and the board flips. The
   ramp is what replaces cutting: every destination still gets a held moment,
   and the long haul home to Iceland compresses into a streak instead of dead
   air.

   Zoom follows the aircraft's distance to the NEARER end of its leg, so it
   opens out over water and closes in at both ends without any per-leg
   scheduling.

   Iceland doesn't chain -- FI 694 leaves Vancouver, not Taipei -- so between
   Taipei and Vancouver the aircraft steps aside and the camera sweeps. That's
   a move, not a cut. */

const Act2 = (function () {

  let legs = [];
  let total = 0;
  let placed = [];        // which flights have dropped their photos

  function build() {
    legs = [];
    placed = [];
    Scrapbook.reset();

    const T = CONFIG.ACT2_SECONDS;
    const specs = CONFIG.ACT2_FLIGHTS;

    /* Work out shares first: flying time scales with distance, but gently, and
       every stop gets the same pause however far it was. */
    const raw = specs.map(function (s) {
      const a = AIRPORTS[s.from], b = AIRPORTS[s.to];
      return Math.pow(Geo.distanceKm(a, b), 0.55);
    });
    const sweeps = specs.map(function (s, i) {
      return i > 0 && specs[i - 1].to !== s.from;   // needs a camera sweep
    });

    /* The holds are the point of the act -- they're what gives you time to
       look at a photograph -- so they get their share first. But four five
       second pauses need a total that can carry them: if ACT2_SECONDS is ever
       set too short for the holds plus the shortest possible flying, they
       shrink to fit rather than squeezing the flying out of existence. */
    const sweepEach = CONFIG.ACT2_SWEEP;
    const sweepTotal = sweeps.filter(Boolean).length * sweepEach;
    const minFlyTotal = specs.length * CONFIG.ACT2_MIN_FLY;
    const holdRoom = Math.max(0, T - sweepTotal - CONFIG.ACT2_FINAL - minFlyTotal);
    const holdEach = Math.min(CONFIG.ACT2_HOLD, holdRoom / specs.length);

    const fixed = specs.length * holdEach + sweepTotal + CONFIG.ACT2_FINAL;
    const flyBudget = Math.max(1, T - fixed);
    const rawTotal = raw.reduce(function (a, b) { return a + b; }, 0);

    /* Every leg gets a floor before distance is considered. Shared out purely
       by distance, Hong Kong to Taipei -- 810km against Vancouver to Tokyo's
       7550 -- came to under a second, which is a blink rather than a flight. */
    const floor = Math.min(CONFIG.ACT2_MIN_FLY, flyBudget / specs.length);
    const spare = Math.max(0, flyBudget - floor * specs.length);

    let t = 0;
    specs.forEach(function (spec, i) {
      if (sweeps[i]) {
        legs.push({ kind: 'sweep', spec: spec, start: t, end: t + sweepEach,
                    from: specs[i - 1].to, to: spec.from });
        t += sweepEach;
      }
      const a = AIRPORTS[spec.from], b = AIRPORTS[spec.to];
      const pts = Geo.samplePath(a, b, 140, 0);
      const fly = floor + spare * (raw[i] / rawTotal);
      legs.push({
        kind: 'fly', spec: spec, index: i, start: t, end: t + fly,
        pts: pts, acc: Geo.arcLengths(pts),
        km: Geo.distanceKm(a, b)
      });
      t += fly;
      legs.push({ kind: 'hold', spec: spec, index: i, start: t, end: t + holdEach });
      t += holdEach;
    });
    total = t + CONFIG.ACT2_FINAL;
  }

  function legAt(t) {
    for (let i = 0; i < legs.length; i++) {
      if (t >= legs[i].start && t < legs[i].end) return legs[i];
    }
    return legs[legs.length - 1] || null;
  }

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function smooth(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }

  /* Where the aircraft is, and how close the camera should be. */
  function state(t) {
    const leg = legAt(t);
    if (!leg) return null;
    const C = CONFIG.ACT2_CAMERA;
    const p = (t - leg.start) / Math.max(1e-6, leg.end - leg.start);

    if (leg.kind === 'fly') {
      const f = easeInOutCubic(Math.min(1, p));
      const at = Geo.alongPath(leg.pts, leg.acc, f);
      /* Distance to whichever end is nearer, so the zoom closes at both. */
      const near = Math.min(f, 1 - f) * leg.km;
      const closeness = 1 - smooth((near - C.nearKm) / Math.max(1, C.farKm - C.nearKm));
      const zoom = C.transitZoom + (leg.spec.zoom - C.transitZoom) * closeness;
      return { lat: at.lat, lon: at.lon, heading: at.heading, zoom: zoom,
               plane: 1, flight: leg.spec, leg: leg, progress: f };
    }

    if (leg.kind === 'hold') {
      const a = AIRPORTS[leg.spec.to];
      return { lat: a.lat, lon: a.lon, heading: null, zoom: leg.spec.zoom,
               plane: Math.max(0, 1 - p * 2.4), flight: leg.spec, leg: leg,
               progress: 1 };
    }

    /* Sweep: the aircraft is away, the camera travels. */
    const a = AIRPORTS[leg.from], b = AIRPORTS[leg.to];
    const e = easeInOutCubic(p);
    const lon = Geo.unwrap(b.lon, a.lon);
    return {
      lat: a.lat + (b.lat - a.lat) * e,
      lon: a.lon + (lon - a.lon) * e,
      heading: null,
      zoom: CONFIG.ACT2_CAMERA.transitZoom - 0.5,
      plane: 0, flight: leg.spec, leg: leg, progress: 0
    };
  }

  /* Drop each flight's photographs the moment it lands. */
  function update(t) {
    legs.forEach(function (leg) {
      if (leg.kind !== 'hold' || placed[leg.index]) return;
      if (t >= leg.start) {
        placed[leg.index] = true;
        Scrapbook.add(leg.spec.to, leg.spec.place, leg.spec.photos, t + 0.25,
                      leg.spec.fan || 0);
      }
    });
  }

  /* The final beat: pull back far enough to hold every cluster at once. */
  function finalView() {
    const codes = CONFIG.ACT2_FLIGHTS.map(function (f) { return f.to; });
    const view = Camera.fitTo(codes);
    /* The clusters hang out to the right of their airports, so fitting the
       airports alone would crop the photographs off the edge. */
    view.zoom -= CONFIG.ACT2_FINAL_PADDING;
    return view;
  }

  function duration() { return total; }

  /* Arrival ring and place name, matching Act One's arrival pulse. */
  function drawArrivals(ctx, t, opacity, mode) {
    ctx.save();
    legs.forEach(function (leg) {
      if (leg.kind !== 'hold') return;
      const age = t - leg.start;
      if (age < 0) return;
      const a = AIRPORTS[leg.spec.to];
      const p = Camera.projectWrapped(a.lat, a.lon);
      if (!Camera.onScreen(p, 200)) return;

      if (mode === 'names') {
        /* Place name types on, a character at a time. Drawn after the
           photographs so a frame never lands on top of the name. */
        const chars = Math.min(leg.spec.place.length,
                               Math.floor(Math.max(0, age - 0.25) / 0.05));
        if (chars > 0) {
          ctx.globalAlpha = opacity;
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0,0,0,0.95)';
          ctx.shadowBlur = 8;
          ctx.font = '600 22px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.letterSpacing = '5px';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(leg.spec.place.slice(0, chars), p.x - 18, p.y - 14);
        }
        return;
      }

      if (age < 1.8) {
        const k = age / 1.8;
        ctx.globalAlpha = opacity * (1 - k) * 0.8;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 + k * 90, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = opacity * Math.min(1, age / 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();

    });
    ctx.restore();
  }

  return {
    build: build, state: state, update: update, duration: duration,
    finalView: finalView, drawArrivals: drawArrivals
  };
})();
