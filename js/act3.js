/* Act Three: under the water, looking up.

   The whole act is built around where it's being shown. Lying under a ceiling
   projection, you are already looking straight up -- which is the one vantage
   where "up" points away from you rather than towards a top edge. So the scene
   is drawn in perspective along the view axis: everything has a distance, and
   rising means receding towards the point directly overhead at the centre of
   the frame.

   That gives the transition for free. At the top of the act the camera is
   sinking faster than the bubbles rise, so they stream outwards past you and
   off the edges. As the descent slows they settle, turn round, and begin
   drifting inwards towards the surface instead.

   Overhead is Snell's window: from below, the entire world above the water is
   compressed into a bright disc about 96 degrees wide, everything outside it
   dark. It is a real thing, it looks like nothing else, and on a ceiling it
   lands directly above whoever is watching. */

const Act3 = (function () {

  let bubbles = [];
  let motes = [];
  let photos = [];
  const images = new Map();
  let started = false;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function focal() {
    return Math.min(Camera.width, Camera.height) * CONFIG.ACT3.focal;
  }

  /* Distance along the view axis to screen. Things far away sit near the
     centre and are small; things close are large and near the edges. */
  function project(p) {
    const f = focal();
    return {
      x: Camera.width / 2 + (p.x / p.z) * f,
      y: Camera.height / 2 + (p.y / p.z) * f,
      s: f / p.z
    };
  }

  function spawnBubble(near) {
    const A = CONFIG.ACT3;
    const angle = rnd(0, Math.PI * 2);
    const spread = rnd(0.05, 1.5);
    return {
      x: Math.cos(angle) * spread,
      y: Math.sin(angle) * spread,
      z: near ? rnd(A.zNear, A.zFar) : rnd(A.zFar * 0.75, A.zFar),
      r: rnd(0.010, 0.055),
      rise: rnd(0.20, 0.62),
      wobble: rnd(0, Math.PI * 2),
      wobbleRate: rnd(0.7, 2.1),
      wobbleAmt: rnd(0.004, 0.022)
    };
  }

  function spawnMote() {
    const A = CONFIG.ACT3;
    const angle = rnd(0, Math.PI * 2);
    return {
      x: Math.cos(angle) * rnd(0.05, 1.8),
      y: Math.sin(angle) * rnd(0.05, 1.8),
      z: rnd(A.zNear, A.zFar),
      r: rnd(0.002, 0.007),
      rise: rnd(0.02, 0.12),
      wobble: rnd(0, Math.PI * 2),
      wobbleRate: rnd(0.2, 0.7),
      wobbleAmt: rnd(0.002, 0.008)
    };
  }

  function load(name) {
    const hit = images.get(name);
    if (hit !== undefined) return hit;
    images.set(name, 'loading');
    const img = new Image();
    img.onload = function () { images.set(name, img); };
    img.onerror = function () { images.set(name, 'missing'); };
    img.src = CONFIG.ACT3.dir + name;
    return 'loading';
  }

  function build() {
    const A = CONFIG.ACT3;
    bubbles = [];
    motes = [];
    for (let i = 0; i < A.bubbleCount; i++) bubbles.push(spawnBubble(true));
    for (let i = 0; i < A.moteCount; i++) motes.push(spawnMote());

    /* Photographs hang at staggered depths so two or three are suspended at
       once, drifting past each other rather than queueing up. */
    const list = A.photos;
    const T = CONFIG.ACT3_SECONDS;
    const window0 = A.photosStart, window1 = T - A.photosEnd;
    photos = list.map(function (spec, i) {
      /* Either a filename or a filename with a crop -- see js/photo.js. */
      const name = typeof spec === 'string' ? spec : spec.name;
      const slot = list.length === 1 ? 0 : i / (list.length - 1);
      const angle = -1.9 + i * 2.39;          // walk around the centre
      const radius = 0.58 + (i % 3) * 0.34;
      load(name);
      return {
        name: name,
        crop: typeof spec === 'string' ? undefined : spec.crop,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * 0.8,
        z: rnd(1.5, 2.5),
        rise: rnd(0.05, 0.13),
        sway: rnd(0, Math.PI * 2),
        swayRate: rnd(0.25, 0.5),
        tilt: rnd(-0.16, 0.16),
        at: window0 + slot * (window1 - window0),
        life: A.photoLife
      };
    });
    started = true;
  }

  /* How fast we're still sinking. Fast at the top of the act, easing to a
     drift -- this is what makes the bubbles rush outwards and then settle. */
  function sinkRate(t) {
    const A = CONFIG.ACT3;
    const k = Math.exp(-t / A.sinkDecay);
    return A.sinkStart * k;
  }

  function update(t, dt) {
    if (!started) return;
    const A = CONFIG.ACT3;
    const sink = sinkRate(t);

    function step(p, arr, i, nearSpawn) {
      p.z += (p.rise - sink) * dt;
      p.wobble += p.wobbleRate * dt;
      if (p.z < A.zNear) {
        /* Swept past the viewer -- put it back at the far end. */
        arr[i] = nearSpawn();
        arr[i].z = A.zFar;
      } else if (p.z > A.zFar) {
        arr[i] = nearSpawn();
        arr[i].z = A.zNear + 0.05;
      }
    }
    for (let i = 0; i < bubbles.length; i++) step(bubbles[i], bubbles, i, function () { return spawnBubble(false); });
    for (let i = 0; i < motes.length; i++) step(motes[i], motes, i, spawnMote);

    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      p.z += (p.rise - sink * 0.55) * dt;
      p.sway += p.swayRate * dt;
    }
  }

  /* ------------------------------------------------------------ painting */

  function drawWater(ctx, t, opacity) {
    const A = CONFIG.ACT3;
    const cx = Camera.width / 2, cy = Camera.height / 2;
    const R = Math.hypot(cx, cy);

    ctx.save();
    ctx.globalAlpha = opacity;

    /* Open water: darkest at the edges, where you'd be seeing reflected
       depths rather than the sky. */
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    bg.addColorStop(0, A.colors.nearSurface);
    bg.addColorStop(0.45, A.colors.mid);
    bg.addColorStop(1, A.colors.deep);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, Camera.width, Camera.height);

    /* Snell's window, with a surface rippling round its edge. */
    const base = Math.min(cx, cy) * A.snellRadius;
    ctx.beginPath();
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const ripple = 1 +
        Math.sin(a * 7 + t * 1.3) * 0.016 +
        Math.sin(a * 13 - t * 0.9) * 0.010 +
        Math.sin(a * 4 + t * 0.55) * 0.013;
      const r = base * ripple;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.94;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    /* Bright most of the way out and then falling off fast, so there's an
       actual rim. A gradient that fades from the centre reads as a glow; the
       real thing has an edge you can point at. */
    const win = ctx.createRadialGradient(cx, cy, 0, cx, cy, base);
    win.addColorStop(0, A.colors.windowCore);
    win.addColorStop(0.45, A.colors.windowMid);
    win.addColorStop(0.86, A.colors.windowHold);
    win.addColorStop(1, A.colors.windowEdge);
    ctx.fillStyle = win;
    ctx.globalAlpha = opacity * A.snellAlpha;
    ctx.fill();

    /* Shafts of light, converging overhead. */
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < A.shafts; i++) {
      const a = (i / A.shafts) * Math.PI * 2 + t * 0.045;
      const wob = Math.sin(t * 0.6 + i * 1.7) * 0.09;
      const width = 0.055 + Math.sin(t * 0.4 + i) * 0.02;
      const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      grad.addColorStop(0, A.colors.shaft);
      grad.addColorStop(1, 'rgba(120,220,220,0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = opacity * A.shaftAlpha;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a + wob - width, a + wob + width);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMotes(ctx, opacity) {
    const A = CONFIG.ACT3;
    ctx.save();
    ctx.fillStyle = A.colors.mote;
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      const q = { x: m.x + Math.sin(m.wobble) * m.wobbleAmt, y: m.y, z: m.z };
      const p = project(q);
      const r = m.r * p.s;
      if (r < 0.25 || p.x < -40 || p.x > Camera.width + 40 ||
          p.y < -40 || p.y > Camera.height + 40) continue;
      ctx.globalAlpha = opacity * 0.5 * Math.min(1, (A.zFar - m.z) / A.zFar + 0.15);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBubbles(ctx, opacity) {
    const A = CONFIG.ACT3;
    ctx.save();
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const q = { x: b.x + Math.sin(b.wobble) * b.wobbleAmt, y: b.y, z: b.z };
      const p = project(q);
      const r = b.r * p.s;
      if (r < 0.4 || p.x < -r - 40 || p.x > Camera.width + r + 40 ||
          p.y < -r - 40 || p.y > Camera.height + r + 40) continue;

      const near = Math.min(1, (b.z - A.zNear) / 0.55);      // fade in as it passes
      const far = Math.min(1, (A.zFar - b.z) / 1.2);
      const a = opacity * 0.85 * near * far;

      ctx.globalAlpha = a * 0.30;
      ctx.fillStyle = A.colors.bubbleFill;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = a;
      ctx.strokeStyle = A.colors.bubbleRim;
      ctx.lineWidth = Math.max(0.6, r * 0.13);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.93, 0, Math.PI * 2);
      ctx.stroke();

      /* Highlight, up towards the light. */
      if (r > 4) {
        ctx.globalAlpha = a * 0.75;
        ctx.fillStyle = A.colors.bubbleHi;
        ctx.beginPath();
        ctx.arc(p.x - r * 0.32, p.y - r * 0.34, r * 0.19, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPhotos(ctx, t, opacity) {
    const A = CONFIG.ACT3;
    /* Farthest first, so nearer photographs pass in front. */
    const order = photos.slice().sort(function (a, b) { return b.z - a.z; });
    ctx.save();
    for (let i = 0; i < order.length; i++) {
      const ph = order[i];
      const age = t - ph.at;
      if (age < 0 || age > ph.life) continue;
      const fade = Math.min(1, age / A.photoFade) *
                   Math.min(1, (ph.life - age) / A.photoFade);

      const q = { x: ph.x + Math.sin(ph.sway) * 0.035,
                  y: ph.y + Math.cos(ph.sway * 0.7) * 0.022, z: ph.z };
      const p = project(q);
      const w = A.photoSize * p.s, h = w * 0.72;
      if (p.x < -w || p.x > Camera.width + w || p.y < -h || p.y > Camera.height + h) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ph.tilt + Math.sin(ph.sway * 0.8) * 0.05);
      ctx.globalAlpha = opacity * fade;

      const img = images.get(ph.name);
      if (img && img !== 'loading' && img !== 'missing') {
        Photo.cover(ctx, img, -w / 2, -h / 2, w, h, ph.crop);
      } else {
        ctx.fillStyle = A.colors.frameEmpty;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = 'rgba(210,255,255,0.45)';
        ctx.lineWidth = Math.max(1, w * 0.006);
        ctx.setLineDash([w * 0.05, w * 0.035]);
        ctx.strokeRect(-w / 2 + w * 0.045, -h / 2 + w * 0.045,
                       w - w * 0.09, h - w * 0.09);
        ctx.setLineDash([]);
      }

      /* Light from the surface catching the top edge. */
      const sheen = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      sheen.addColorStop(0, 'rgba(190,255,255,0.14)');
      sheen.addColorStop(0.5, 'rgba(120,200,210,0.03)');
      sheen.addColorStop(1, 'rgba(0,20,30,0.26)');
      ctx.fillStyle = sheen;
      ctx.fillRect(-w / 2, -h / 2, w, h);

      ctx.strokeStyle = 'rgba(210,255,255,0.35)';
      ctx.lineWidth = Math.max(1, w * 0.008);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawText(ctx, t, opacity) {
    const A = CONFIG.ACT3;
    const scale = Math.min(Camera.width, Camera.height) / 1080;
    ctx.save();
    ctx.textAlign = 'center';
    for (let i = 0; i < A.lines.length; i++) {
      const line = A.lines[i];
      const age = t - line.at;
      if (age < 0 || age > line.hold + A.textFade * 2) continue;
      const fade = Math.min(1, age / A.textFade) *
                   Math.min(1, (line.hold + A.textFade * 2 - age) / A.textFade);
      /* A slow rise and a shimmer, as if the words were under moving water. */
      const drift = -age * 7 * scale;
      const shimmer = Math.sin(t * 1.6 + i) * 2.5 * scale;

      const cx = Camera.width / 2 + shimmer;
      const cy = Camera.height * line.y + drift;

      ctx.globalAlpha = opacity * fade;
      ctx.shadowColor = 'rgba(0,30,40,0.9)';
      ctx.shadowBlur = 18 * scale;
      ctx.fillStyle = A.colors.text;

      if (line.line2) {
        /* A declaration and the sentence that explains it. */
        ctx.font = '500 ' + (34 * scale) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.letterSpacing = (7 * scale) + 'px';
        ctx.fillText(line.line1, cx, cy);
        ctx.font = 'italic ' + (25 * scale) + 'px Georgia, "Times New Roman", serif';
        ctx.letterSpacing = (1 * scale) + 'px';
        ctx.fillStyle = A.colors.textSoft;
        ctx.fillText(line.line2, cx, cy + 42 * scale);
      } else {
        /* A beat on its own is an aside, not an announcement -- so it gets the
           quiet face rather than the shouting one. Set line2 and it goes back
           to a heading with a sentence under it. */
        ctx.font = 'italic ' + (30 * scale) + 'px Georgia, "Times New Roman", serif';
        ctx.letterSpacing = (1 * scale) + 'px';
        ctx.fillText(line.line1, cx, cy);
      }
    }
    ctx.restore();
  }

  function draw(ctx, t, opacity) {
    if (!started || opacity <= 0.004) return;
    drawWater(ctx, t, opacity);
    drawMotes(ctx, opacity);
    drawPhotos(ctx, t, opacity);
    drawBubbles(ctx, opacity);
    drawText(ctx, t, opacity);
  }

  function reset() {
    started = false;
    bubbles = [];
    motes = [];
    photos = [];
  }

  return { build: build, update: update, draw: draw, reset: reset };
})();
