/* Aircraft: the idle traffic that fills the cold open, and the hero flights
   that launch out of SEA and PAE when you hit space.

   A hero flight is a list of stops, not a pair. One leg is a nonstop; two legs
   is a connection -- the aircraft lands, its stopover gets a label, then it
   goes on. Trips through a shared stopover fan apart from it. */

const Flights = (function () {

  const ambient = [];
  const heroes = [];

  /* ---------------------------------------------------------------- shared */

  function airport(code) {
    const a = AIRPORTS[code];
    if (!a) throw new Error('unknown airport code: ' + code);
    return a;
  }

  function route(fromCode, toCode, bow, samples) {
    const a = airport(fromCode), b = airport(toCode);
    const pts = Geo.samplePath(a, b, samples || 90, bow || 0);
    return {
      from: fromCode,
      to: toCode,
      pts: pts,
      acc: Geo.arcLengths(pts),
      km: Geo.distanceKm(a, b)
    };
  }

  /* The aeroplane silhouette, nose up, drawn in units of `size`. */
  function planePath(ctx, size) {
    const s = size;
    ctx.beginPath();
    ctx.moveTo(0, -1.00 * s);                       // nose
    ctx.bezierCurveTo(0.11 * s, -0.78 * s, 0.13 * s, -0.42 * s, 0.13 * s, -0.16 * s);
    ctx.lineTo(0.98 * s, 0.26 * s);                 // right wing
    ctx.lineTo(0.98 * s, 0.44 * s);
    ctx.lineTo(0.13 * s, 0.24 * s);
    ctx.lineTo(0.13 * s, 0.70 * s);
    ctx.lineTo(0.40 * s, 0.92 * s);                 // right tailplane
    ctx.lineTo(0.40 * s, 1.02 * s);
    ctx.lineTo(0.00 * s, 0.86 * s);
    ctx.lineTo(-0.40 * s, 1.02 * s);                // left tailplane
    ctx.lineTo(-0.40 * s, 0.92 * s);
    ctx.lineTo(-0.13 * s, 0.70 * s);
    ctx.lineTo(-0.13 * s, 0.24 * s);
    ctx.lineTo(-0.98 * s, 0.44 * s);                // left wing
    ctx.lineTo(-0.98 * s, 0.26 * s);
    ctx.lineTo(-0.13 * s, -0.16 * s);
    ctx.bezierCurveTo(-0.13 * s, -0.42 * s, -0.11 * s, -0.78 * s, 0, -1.00 * s);
    ctx.closePath();
  }

  function drawPlane(ctx, x, y, heading, size, color, alpha, glow) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading * Math.PI / 180);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
    }
    planePath(ctx, size / 2);
    ctx.fill();
    ctx.restore();
  }

  /* `stack` keeps the two lines of a hero label together: the second line asks
     for the slot directly under wherever the first one ended up. */
  function drawLabel(ctx, x, y, text, alpha, color, size, stack) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = (size || 11) + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = color;
    const ly = stack !== undefined ? stack
                                   : Labels.place(x, y, ctx.measureText(text).width, size + 3);
    ctx.fillText(text, x, ly);
    ctx.restore();
    return ly;
  }

  /* Draw part of a sampled path: everything from `from` to `to` as fractions
     of its length. Used for both the trail behind an aircraft and the arc it
     leaves behind once it's down. */
  function strokeSegment(ctx, seg, from, to) {
    if (to <= from) return;
    const pts = seg.pts, acc = seg.acc;
    let started = false;
    for (let i = 0; i < pts.length; i++) {
      const f = acc[i];
      if (f < from || f > to) continue;
      const p = Camera.project(pts[i].lat, pts[i].lon);
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    /* Always finish exactly at the requested point so the trail stays pinned
       to the aircraft instead of lagging to the last whole sample. */
    const tip = Geo.alongPath(pts, acc, to);
    const p = Camera.project(tip.lat, tip.lon);
    if (!started) ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y);
  }

  /* --------------------------------------------------------------- ambient */

  function randomCallsign() {
    const a = AMBIENT_AIRLINES[(Math.random() * AMBIENT_AIRLINES.length) | 0];
    return a + ' ' + (100 + ((Math.random() * 1800) | 0));
  }

  function spawnAmbient(atRandomProgress) {
    const pair = AMBIENT_ROUTES[(Math.random() * AMBIENT_ROUTES.length) | 0];
    /* A wide spread of arc offsets. Most of the idle routes end at SEA, and
       flown as exact great circles they'd all converge into one stack of
       aircraft on the same final approach with their labels piled on top of
       each other. Real arrivals come in off different tracks; this does the
       same, and keeps the scope looking busy rather than queued. */
    const seg = route(pair[0], pair[1], (Math.random() - 0.5) * 5, 48);
    return {
      callsign: randomCallsign(),
      seg: seg,
      /* Never start one on top of its destination, for the same reason. */
      p: atRandomProgress ? Math.random() * 0.8 : 0,
      speed: CONFIG.AMBIENT_SPEED * (0.7 + Math.random() * 0.7),
      fade: 1
    };
  }

  function buildAmbient() {
    ambient.length = 0;
    for (let i = 0; i < CONFIG.AMBIENT_COUNT; i++) ambient.push(spawnAmbient(true));
  }

  function updateAmbient(dt, alive) {
    for (let i = 0; i < ambient.length; i++) {
      const f = ambient[i];
      f.p += f.speed * dt;
      if (f.p >= 1) {
        /* Only recycle while the idle scene is the one on screen -- once it's
           faded out we let them run off and stay gone. */
        if (alive) ambient[i] = spawnAmbient(false);
        else f.p = 1;
      }
    }
  }

  function drawAmbient(ctx, opacity) {
    if (opacity <= 0.004) return;
    ctx.save();

    /* Trails first, so no plane ends up under another plane's line. */
    ctx.strokeStyle = CONFIG.COLORS.trail;
    ctx.lineWidth = 1;
    ctx.globalAlpha = opacity * 0.14;
    ctx.beginPath();
    for (let i = 0; i < ambient.length; i++) {
      const f = ambient[i];
      strokeSegment(ctx, f.seg, Math.max(0, f.p - 0.16), Math.min(1, f.p));
    }
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < ambient.length; i++) {
      const f = ambient[i];
      const at = Geo.alongPath(f.seg.pts, f.seg.acc, f.p);
      const p = Camera.project(at.lat, at.lon);
      if (!Camera.onScreen(p, 120)) continue;
      drawPlane(ctx, p.x, p.y, at.heading, CONFIG.PLANE_SIZE,
                CONFIG.COLORS.ambient, opacity * 0.82, 4);
      drawLabel(ctx, p.x + 12, p.y - 12, f.callsign, opacity * 0.6,
                CONFIG.COLORS.label, 11);
    }
  }

  /* ------------------------------------------------------------------ hero */

  /* Lay out the whole departure bank on one clock: longest trips leave first,
     everyone is on the ground before the title card. */
  function buildHero() {
    heroes.length = 0;
    const SEQ = CONFIG.SEQUENCE_SECONDS;
    const win = CONFIG.BEATS.launchWindow;
    const launch0 = win[0] * SEQ, launch1 = win[1] * SEQ;
    const landed = CONFIG.BEATS.allLanded * SEQ;

    const built = HERO_ROUTES.map(function (spec, index) {
      const stops = [spec.origin].concat(spec.legs);
      const bow = CONFIG.HERO_BOW * (index % 2 ? 1 : -1) * (0.6 + (index % 3) * 0.3);
      const segs = [];
      let km = 0;
      for (let i = 1; i < stops.length; i++) {
        const seg = route(stops[i - 1], stops[i], bow, 110);
        segs.push(seg);
        km += seg.km;
      }
      return {
        callsign: spec.callsign,
        stops: stops,
        segs: segs,
        km: km,
        index: index
      };
    });

    /* Longest first, so the far side of the world isn't still empty when the
       title lands. */
    built.sort(function (a, b) { return b.km - a.km; });

    const n = built.length;
    built.forEach(function (f, i) {
      f.t0 = launch0 + (n === 1 ? 0 : (i / (n - 1)) * (launch1 - launch0));
    });

    /* One shared speed constant: flight time scales with distance^0.7, so long
       hauls take longer without the short hops looking stalled. Pick the
       constant so the slowest flight lands exactly on the beat. */
    let k = Infinity;
    built.forEach(function (f) {
      const dwellCount = f.segs.length - 1;
      const budget = (landed - f.t0) / (1 + dwellCount * CONFIG.LEG_DWELL_FRACTION);
      k = Math.min(k, budget / Math.pow(f.km, 0.7));
    });

    built.forEach(function (f) {
      let t = f.t0;
      const flightTime = k * Math.pow(f.km, 0.7);
      const dwell = flightTime * CONFIG.LEG_DWELL_FRACTION;
      f.segs.forEach(function (seg, i) {
        seg.start = t;
        seg.end = t + flightTime * (seg.km / f.km);
        t = seg.end + (i < f.segs.length - 1 ? dwell : 0);
      });
      f.tEnd = f.segs[f.segs.length - 1].end;
      f.arrived = [];
      heroes.push(f);
    });
  }

  /* Where a flight is at time t, or null before it leaves. */
  function heroState(f, t) {
    if (t < f.t0) return null;
    for (let i = 0; i < f.segs.length; i++) {
      const seg = f.segs[i];
      if (t < seg.start) {
        /* Sitting at a connecting stand between legs. */
        return { seg: f.segs[i - 1], f: 1, waiting: true, legIndex: i - 1 };
      }
      if (t <= seg.end) {
        const f01 = (t - seg.start) / Math.max(1e-6, seg.end - seg.start);
        /* Ease within the leg so aircraft roll away from the gate rather than
           snapping to cruise. It buys the camera the second it needs to open
           out before they're off the edge of the regional view, and the
           deceleration into the destination reads as an approach. */
        return { seg: seg, f: 0.5 - 0.5 * Math.cos(Math.PI * f01),
                 waiting: false, legIndex: i };
      }
    }
    return { seg: f.segs[f.segs.length - 1], f: 1, waiting: false, done: true,
             legIndex: f.segs.length - 1 };
  }

  function updateHero(t, onArrive) {
    for (let i = 0; i < heroes.length; i++) {
      const f = heroes[i];
      for (let s = 0; s < f.segs.length; s++) {
        if (!f.arrived[s] && t >= f.segs[s].end) {
          f.arrived[s] = true;
          onArrive(f.segs[s].to, f);
        }
      }
    }
  }

  function drawHero(ctx, t, opacity) {
    if (opacity <= 0.004) return;

    /* Route arcs: brighter just behind the aircraft, faint once flown. */
    ctx.save();
    ctx.strokeStyle = CONFIG.COLORS.trail;
    ctx.lineCap = 'round';

    ctx.globalAlpha = opacity * 0.34;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < heroes.length; i++) {
      const f = heroes[i];
      const st = heroState(f, t);
      if (!st) continue;
      for (let s = 0; s <= st.legIndex; s++) {
        const upto = s < st.legIndex || st.waiting || st.done ? 1 : st.f;
        strokeSegment(ctx, f.segs[s], 0, upto);
      }
    }
    ctx.stroke();

    ctx.globalAlpha = opacity * 0.55;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < heroes.length; i++) {
      const f = heroes[i];
      const st = heroState(f, t);
      if (!st || st.done) continue;
      strokeSegment(ctx, st.seg, Math.max(0, st.f - 0.10), st.f);
    }
    ctx.stroke();
    ctx.restore();

    /* Aircraft. They fade out shortly after touchdown -- the arc and the
       airport label are the record; sixteen parked planes are clutter. */
    for (let i = 0; i < heroes.length; i++) {
      const f = heroes[i];
      const st = heroState(f, t);
      if (!st) continue;

      const sinceLanded = t - f.tEnd;
      let alpha = opacity;
      if (sinceLanded > 0) alpha = opacity * Math.max(0, 1 - sinceLanded / 0.9);
      if (alpha <= 0.01) continue;

      /* A short fade-in off the runway keeps the launch from popping. */
      const sinceOff = t - f.t0;
      if (sinceOff < 0.5) alpha *= Math.max(0, sinceOff / 0.5);

      const at = Geo.alongPath(st.seg.pts, st.seg.acc, st.f);
      const p = Camera.project(at.lat, at.lon);
      if (!Camera.onScreen(p, 140)) continue;

      drawPlane(ctx, p.x, p.y, at.heading, CONFIG.HERO_PLANE_SIZE,
                CONFIG.COLORS.hero, alpha, 6);

      const dest = f.stops[f.stops.length - 1];
      const ly = drawLabel(ctx, p.x + 14, p.y - 15, f.callsign, alpha * 0.95,
                           CONFIG.COLORS.heroLabel, 12);
      drawLabel(ctx, p.x + 14, p.y - 3, f.stops[st.legIndex] + '→' + dest,
                alpha * 0.55, CONFIG.COLORS.label, 10, ly + 12);
    }
  }

  function clearHero() {
    heroes.length = 0;
  }

  /* Every airport the hero flights touch, origins and stopovers included --
     the camera fits its final view to these. */
  function heroStops() {
    const seen = {};
    const out = [];
    HERO_ROUTES.forEach(function (spec) {
      [spec.origin].concat(spec.legs).forEach(function (code) {
        if (!seen[code]) { seen[code] = true; out.push(code); }
      });
    });
    return out;
  }

  return {
    heroStops: heroStops,
    buildAmbient: buildAmbient,
    updateAmbient: updateAmbient,
    drawAmbient: drawAmbient,
    buildHero: buildHero,
    updateHero: updateHero,
    drawHero: drawHero,
    clearHero: clearHero,
    heroes: heroes
  };
})();
