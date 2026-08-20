/* Act Four: the board.

   Twenty-eight tiles in a ring, dark with the colour bands lit from within.
   The middle of a board is empty by design -- that's where the photographs and
   the lines go, which is also where the eye already is.

   The dice genuinely drive it. Two of them tumble, settle on a number, and a
   token counts out exactly that many squares. Whatever it lands on is what
   lights up. Both players take turns.

   The one arranged part is the finish. Rolls are ordinary 2d6 throughout, but
   the whole set is chosen up front so that the last one puts both tokens on
   the same square -- picked by trying sequences until one lands that way,
   never by moving a token further than its dice allow. */

const Act4 = (function () {

  const SIDE_TILES = 6;
  const TILES = 4 + SIDE_TILES * 4;      // 28

  let turns = [];
  let tiles = [];
  let dice = [{ v: 1 }, { v: 1 }];
  const images = new Map();
  let started = false;
  let stars = [];
  let bolts = [];

  function load(name) {
    const hit = images.get(name);
    if (hit !== undefined) return hit;
    images.set(name, 'loading');
    const img = new Image();
    img.onload = function () { images.set(name, img); };
    img.onerror = function () { images.set(name, 'missing'); };
    img.src = CONFIG.ACT4.dir + name;
    return 'loading';
  }

  function roll() { return 1 + ((Math.random() * 6) | 0); }

  function tileIndex(name) {
    const list = CONFIG.ACT4.tiles;
    for (let i = 0; i < list.length; i++) if (list[i].name === name) return i;
    return -1;
  }

  function stepsTo(from, to) { return ((to - from) % TILES + TILES) % TILES; }

  /* A legal pair of dice adding to `sum`, or null if no pair can. This is what
     keeps the arranged ending honest: a token is only ever moved a distance
     two real dice could have produced. */
  function pairFor(sum) {
    const opts = [];
    for (let a = 1; a <= 6; a++) {
      const b = sum - a;
      if (b >= 1 && b <= 6) opts.push([a, b]);
    }
    return opts.length ? opts[(Math.random() * opts.length) | 0] : null;
  }

  /* Plan the game so it finishes where it is supposed to.

     Tokens alternate, A on the even turns and B on the odd ones, and the last
     move is B joining A. The final pair of landings is CONFIG.ACT4.finishOn
     and the earlier ones come from CONFIG.ACT4.land. Rather than throw whole
     sequences away until one happens to land there, the free rolls are thrown
     and the named ones solved -- ask pairFor for the dice that cover the
     distance, and if no pair can, throw the free rolls again.

     Returns null if the named squares are placed somewhere the dice cannot
     reach, which is a configuration problem rather than a run of bad luck. */
  function planToFinish(count, finish, land) {
    for (let attempt = 0; attempt < 600; attempt++) {
      const rolls = new Array(count);
      const landed = new Array(count);
      const pos = [0, 0];
      let ok = true;

      for (let i = 0; i < count; i++) {
        const who = i % 2;
        /* The last two landings are the shared finish; anything `land` names
           is fixed; the rest is left to the dice. */
        const want = (i >= count - 2) ? finish
                   : (i < land.length ? land[i] : -1);
        const pair = want < 0 ? [roll(), roll()] : pairFor(stepsTo(pos[who], want));
        if (!pair) { ok = false; break; }
        pos[who] = (pos[who] + pair[0] + pair[1]) % TILES;
        rolls[i] = pair;
        landed[i] = pos[who];
      }
      if (!ok || pos[0] !== pos[1]) continue;

      /* Every landing has to be somewhere a photograph makes sense. The free
         rolls will otherwise drop the first reveal on a corner, and "go to
         jail" is a poor caption for a holiday. */
      if (landed.some(function (i) { return !placeable(i); })) continue;

      const unique = landed.filter(function (v, i) { return landed.indexOf(v) === i; });
      if (unique.length < count - 1) continue;
      return { rolls: rolls, landed: landed };
    }
    return null;
  }

  /* A square worth stopping on: a named property, not a corner and not a card
     draw. */
  function placeable(i) {
    const t = CONFIG.ACT4.tiles[i];
    return !!t && !t.corner && !!t.price;
  }

  /* Plan the game.

     Tokens alternate. A moves on turns 0 and 2, B on 1 and 3. We want both on
     the same square after the last move, so sequences are drawn until one
     works out -- every roll stays a legal pair of dice.

     This is the fallback: it gets used when no finishing square is named, or
     when the named ones turn out to be unreachable. */
  function planRolls(count) {
    const A = CONFIG.ACT4;
    const finish = A.finishOn ? tileIndex(A.finishOn) : -1;
    const land = (A.land || []).map(tileIndex);
    if (count >= 3 && finish >= 0 && land.indexOf(-1) < 0) {
      const aimed = planToFinish(count, finish, land);
      if (aimed) return aimed;
    }
    return planFree(count);
  }

  function planFree(count) {
    for (let attempt = 0; attempt < 4000; attempt++) {
      const rolls = [];
      for (let i = 0; i < count; i++) rolls.push([roll(), roll()]);

      const pos = [0, 0];
      const landed = [];
      rolls.forEach(function (r, i) {
        const who = i % 2;
        pos[who] = (pos[who] + r[0] + r[1]) % TILES;
        landed.push(pos[who]);
      });

      /* Does the last move put them together? */
      if (pos[0] !== pos[1]) continue;
      /* And is every landing a different square, so four different places
         light up? */
      const unique = landed.filter(function (v, i) { return landed.indexOf(v) === i; });
      if (unique.length < count - 1) continue;
      return { rolls: rolls, landed: landed };
    }
    /* Should never happen, but never hang if it does. */
    const rolls = [];
    for (let i = 0; i < count; i++) rolls.push([roll(), roll()]);
    let a = 0, b = 0;
    const landed = rolls.map(function (r, i) {
      if (i % 2 === 0) { a = (a + r[0] + r[1]) % TILES; return a; }
      b = (b + r[0] + r[1]) % TILES; return b;
    });
    return { rolls: rolls, landed: landed };
  }

  /* The sky is laid out once, in fractions of the frame, so it survives a
     resize and doesn't crawl from frame to frame. */
  function buildSpace() {
    const S = CONFIG.ACT4.space;
    stars = [];
    for (let i = 0; i < S.stars; i++) {
      stars.push({
        x: Math.random(), y: Math.random(),
        r: S.starMinR + Math.random() * (S.starMaxR - S.starMinR),
        a: 0.25 + Math.random() * 0.75,
        rate: 0.5 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2
      });
    }

    /* Bolts are scheduled up front rather than rolled each frame: the act has
       a known length, and a fixed schedule means the same act plays the same
       way twice and nothing depends on the frame rate. */
    bolts = [];
    const T = CONFIG.ACT4_SECONDS;
    let t = 1.2;
    while (t < T - 1) {
      const n = S.laserBurst[0] +
                ((Math.random() * (S.laserBurst[1] - S.laserBurst[0] + 1)) | 0);
      for (let i = 0; i < n; i++) {
        const from = edgePoint();
        let to = edgePoint();
        /* Anything too short reads as a spark rather than a shot. */
        if (Math.hypot(to.x - from.x, to.y - from.y) < 0.6) to = edgePoint();
        bolts.push({
          t0: t + i * (0.06 + Math.random() * 0.13),
          x0: from.x, y0: from.y, x1: to.x, y1: to.y,
          speed: S.laserSpeed[0] + Math.random() * (S.laserSpeed[1] - S.laserSpeed[0]),
          len: S.laserLength[0] + Math.random() * (S.laserLength[1] - S.laserLength[0]),
          color: S.laserColors[(Math.random() * S.laserColors.length) | 0]
        });
      }
      t += S.laserEvery * (0.6 + Math.random() * 1.1);
    }
  }

  /* A point somewhere on the border of the frame, in fractions. */
  function edgePoint() {
    const e = (Math.random() * 4) | 0, f = Math.random();
    if (e === 0) return { x: f, y: -0.04 };
    if (e === 1) return { x: 1.04, y: f };
    if (e === 2) return { x: f, y: 1.04 };
    return { x: -0.04, y: f };
  }

  function build() {
    const A = CONFIG.ACT4;
    buildSpace();
    tiles = A.tiles;
    const reveals = A.reveals;
    const plan = planRolls(reveals.length);

    const T = CONFIG.ACT4_SECONDS;
    const perTurn = (T - A.assembleSeconds - A.finaleSeconds) / reveals.length;

    let pos = [0, 0];
    turns = reveals.map(function (rev, i) {
      const who = i % 2;
      const start = pos[who];
      const r = plan.rolls[i];
      const steps = r[0] + r[1];
      pos[who] = (start + steps) % TILES;
      load(rev.photo);
      return {
        who: who, from: start, to: pos[who], steps: steps, dice: r,
        reveal: rev,
        t0: A.assembleSeconds + i * perTurn,
        rollFor: A.rollSeconds,
        hopFor: steps * A.hopSeconds,
        span: perTurn
      };
    });
    started = true;
  }

  /* ------------------------------------------------------------- geometry */

  function board() {
    const S = Math.min(Camera.width, Camera.height) * CONFIG.ACT4.boardScale;
    const corner = S * 0.155;
    return {
      S: S, corner: corner,
      tile: (S - corner * 2) / SIDE_TILES,
      left: Camera.width / 2 - S / 2,
      top: Camera.height / 2 - S / 2
    };
  }

  /* Tile rectangles run clockwise from the top-left corner. */
  function tileRect(i, b) {
    const c = b.corner, tw = b.tile, L = b.left, T = b.top, S = b.S;
    if (i === 0) return { x: L, y: T, w: c, h: c, side: 0 };
    if (i < 1 + SIDE_TILES) return { x: L + c + (i - 1) * tw, y: T, w: tw, h: c, side: 0 };
    if (i === 7) return { x: L + S - c, y: T, w: c, h: c, side: 1 };
    if (i < 8 + SIDE_TILES) return { x: L + S - c, y: T + c + (i - 8) * tw, w: c, h: tw, side: 1 };
    if (i === 14) return { x: L + S - c, y: T + S - c, w: c, h: c, side: 2 };
    if (i < 15 + SIDE_TILES) return { x: L + S - c - (i - 14) * tw, y: T + S - c, w: tw, h: c, side: 2 };
    if (i === 21) return { x: L, y: T + S - c, w: c, h: c, side: 3 };
    return { x: L, y: T + S - c - (i - 21) * tw, w: c, h: tw, side: 3 };
  }

  function tileCentre(i, b) {
    const r = tileRect(i, b);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  /* Where a piece stands on a tile: over the colour band on the inner edge,
     rather than dead centre where it would sit on top of the name. */
  function tokenSpot(i, b) {
    const r = tileRect(i, b);
    const push = Math.min(r.w, r.h) * 0.28;
    const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    if (r.side === 0) c.y += push;
    else if (r.side === 1) c.x -= push;
    else if (r.side === 2) c.y -= push;
    else c.x += push;
    return c;
  }

  /* --------------------------------------------------------------- timing */

  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function smooth(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }

  /* Where a token stands, counting out its hops one square at a time. */
  function tokenTile(who, t) {
    let at = 0;
    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      if (turn.who !== who) continue;
      const hopStart = turn.t0 + turn.rollFor;
      if (t <= hopStart) return { tile: turn.from, hopping: false };
      if (t >= hopStart + turn.hopFor) { at = turn.to; continue; }
      const done = Math.floor((t - hopStart) / CONFIG.ACT4.hopSeconds);
      const frac = ((t - hopStart) / CONFIG.ACT4.hopSeconds) % 1;
      return { tile: (turn.from + done) % TILES, hopping: true, frac: frac,
               next: (turn.from + done + 1) % TILES };
    }
    return { tile: at, hopping: false };
  }

  function currentTurn(t) {
    for (let i = turns.length - 1; i >= 0; i--) {
      if (t >= turns[i].t0) return turns[i];
    }
    return null;
  }

  /* ------------------------------------------------------------- painting */

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Which way is "out of the board" for a tile, in radians. Names, prices and
     corner art all hang off this. Every side reads outward, top row included --
     that is what makes a Monopoly board look like one from across the room. */
  function outward(side) {
    return side === 0 ? Math.PI
         : side === 1 ? -Math.PI / 2
         : side === 3 ? Math.PI / 2 : 0;
  }

  /* A corner square is read along its own diagonal, pointing out of the
     board -- so the four of them fan out from the middle. */
  function cornerRot(side) {
    return -Math.PI / 4 + side * Math.PI / 2;
  }

  /* Corner artwork, tipped onto the diagonal the way a real board does it.
     The word underneath stays upright: at this size a diagonal "CARBONITE"
     ran out of its own square. */
  function cornerArt(ctx, kind, size, color) {
    ctx.save();
    ctx.rotate(-Math.PI / 4);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.4, size * 0.05);
    ctx.lineJoin = 'round';
    const u = size * 0.5;

    if (kind === 'go') {
      /* A fat arrow, the way GO points you round the board. */
      ctx.beginPath();
      ctx.moveTo(-u * 0.9, -u * 0.28);
      ctx.lineTo(u * 0.15, -u * 0.28);
      ctx.lineTo(u * 0.15, -u * 0.62);
      ctx.lineTo(u * 0.95, 0);
      ctx.lineTo(u * 0.15, u * 0.62);
      ctx.lineTo(u * 0.15, u * 0.28);
      ctx.lineTo(-u * 0.9, u * 0.28);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'jail' || kind === 'gotojail') {
      /* A barred cell. */
      ctx.strokeRect(-u * 0.62, -u * 0.62, u * 1.24, u * 1.24);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * u * 0.26, -u * 0.62);
        ctx.lineTo(i * u * 0.26, u * 0.62);
        ctx.stroke();
      }
      if (kind === 'gotojail') {
        ctx.beginPath();
        ctx.moveTo(-u * 1.15, -u * 1.15);
        ctx.lineTo(-u * 0.72, -u * 0.72);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-u * 0.72, -u * 0.72);
        ctx.lineTo(-u * 0.72, -u * 0.98);
        ctx.lineTo(-u * 0.46, -u * 0.72);
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === 'parking') {
      /* A rimmed disc -- somewhere to sit. */
      ctx.beginPath();
      ctx.arc(0, 0, u * 0.60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, u * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* Small marks on the transport and utility squares. */
  function tileArt(ctx, kind, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.2, size * 0.07);
    ctx.lineJoin = 'round';
    const u = size * 0.5;
    if (kind === 'castle') {
      /* Three towers on a wall, which is all a castle needs to be at 30px. */
      const w = u * 0.86, base = u * 0.62, top = -u * 0.20;
      ctx.beginPath();
      ctx.rect(-w, top, w * 2, base - top);
      ctx.fill();
      const spires = [-w * 0.66, 0, w * 0.66];
      const tall = [u * 0.55, u * 0.95, u * 0.55];
      for (let i = 0; i < 3; i++) {
        const half = u * 0.19;
        ctx.beginPath();
        ctx.rect(spires[i] - half, top - tall[i] * 0.55, half * 2, tall[i] * 0.55);
        ctx.fill();
        ctx.beginPath();                       // the cone on top
        ctx.moveTo(spires[i] - half * 1.25, top - tall[i] * 0.55);
        ctx.lineTo(spires[i], top - tall[i]);
        ctx.lineTo(spires[i] + half * 1.25, top - tall[i] * 0.55);
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === 'ship') {
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.85);
      ctx.lineTo(u * 0.24, -u * 0.05);
      ctx.lineTo(u * 0.85, u * 0.6);
      ctx.lineTo(u * 0.3, u * 0.42);
      ctx.lineTo(0, u * 0.8);
      ctx.lineTo(-u * 0.3, u * 0.42);
      ctx.lineTo(-u * 0.85, u * 0.6);
      ctx.lineTo(-u * 0.24, -u * 0.05);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'util') {
      ctx.beginPath();
      ctx.arc(0, -u * 0.15, u * 0.45, Math.PI * 0.15, Math.PI * 0.85, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-u * 0.26, u * 0.36);
      ctx.lineTo(u * 0.26, u * 0.36);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-u * 0.18, u * 0.62);
      ctx.lineTo(u * 0.18, u * 0.62);
      ctx.stroke();
    } else if (kind === 'chance') {
      ctx.font = '700 ' + Math.round(size * 0.9) + 'px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 0);
    }
    ctx.restore();
  }

  function drawBoard(ctx, t, opacity) {
    const A = CONFIG.ACT4, b = board();
    const assemble = A.assembleSeconds;
    const surfaceIn = smooth(Math.min(1, t / (assemble * 0.28)));

    ctx.save();

    /* The board itself: a faint sheen from the middle out, and a raised frame,
       so it reads as an object rather than a rectangle of tiles. */
    ctx.globalAlpha = opacity * surfaceIn;
    const g = ctx.createRadialGradient(
      Camera.width / 2, Camera.height / 2, b.S * 0.1,
      Camera.width / 2, Camera.height / 2, b.S * 0.75);
    g.addColorStop(0, A.colors.boardCentre);
    g.addColorStop(1, A.colors.board);
    ctx.fillStyle = g;
    roundRect(ctx, b.left, b.top, b.S, b.S, b.S * 0.012);
    ctx.fill();

    ctx.strokeStyle = A.colors.frame;
    ctx.lineWidth = Math.max(2, b.S * 0.006);
    roundRect(ctx, b.left, b.top, b.S, b.S, b.S * 0.012);
    ctx.stroke();

    /* Inner rule where the ring of tiles meets the middle. */
    ctx.strokeStyle = A.colors.edge;
    ctx.lineWidth = 1;
    ctx.strokeRect(b.left + b.corner, b.top + b.corner,
                   b.S - b.corner * 2, b.S - b.corner * 2);

    for (let i = 0; i < TILES; i++) {
      /* Tiles are laid one after another round the ring, each sliding the last
         short distance into place. */
      const due = assemble * 0.20 + (i / TILES) * (assemble * 0.62);
      const raw = Math.min(1, Math.max(0, (t - due) / 0.5));
      if (raw <= 0.001) continue;
      const in01 = easeOutCubic(raw);

      const r = tileRect(i, b);
      const spec = tiles[i] || { name: '' };
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const rot = spec.corner ? 0 : outward(r.side);

      ctx.save();
      ctx.globalAlpha = opacity * Math.min(1, raw * 2);
      /* Slide in from just outside its final position. */
      const slide = (1 - in01) * Math.min(r.w, r.h) * 0.55;
      const sx = r.side === 1 ? slide : r.side === 3 ? -slide : 0;
      const sy = r.side === 0 ? -slide : r.side === 2 ? slide : 0;
      ctx.translate(sx, sy);

      ctx.fillStyle = A.colors.tile;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = A.colors.edge;
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

      /* The deed stripe, on the edge facing the middle, with a hard rule under
         it -- that rule is a lot of why a Monopoly tile looks like one. */
      if (spec.color && !spec.corner) {
        const d = Math.min(r.w, r.h) * 0.34;
        ctx.save();
        ctx.shadowColor = spec.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = spec.color;
        let bx, by, bw, bh;
        if (r.side === 0) { bx = r.x; by = r.y + r.h - d; bw = r.w; bh = d; }
        else if (r.side === 1) { bx = r.x; by = r.y; bw = d; bh = r.h; }
        else if (r.side === 2) { bx = r.x; by = r.y; bw = r.w; bh = d; }
        else { bx = r.x + r.w - d; by = r.y; bw = d; bh = r.h; }
        ctx.fillRect(bx, by, bw, bh);
        ctx.restore();
        ctx.strokeStyle = A.colors.stripeEdge;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (r.side === 0) { ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); }
        else if (r.side === 1) { ctx.moveTo(bx + bw, by); ctx.lineTo(bx + bw, by + bh); }
        else if (r.side === 2) { ctx.moveTo(bx, by + bh); ctx.lineTo(bx + bw, by + bh); }
        else { ctx.moveTo(bx, by); ctx.lineTo(bx, by + bh); }
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      const long = r.side === 0 || r.side === 2 ? r.h : r.w;   // outward depth
      const across = r.side === 0 || r.side === 2 ? r.w : r.h;

      if (spec.corner) {
        ctx.save();
        ctx.translate(0, -b.corner * 0.10);
        cornerArt(ctx, spec.art, b.corner * 0.46, A.colors.cornerArt);
        ctx.restore();
        ctx.fillStyle = A.colors.cornerText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.letterSpacing = '2px';
        ctx.fillText(spec.name, 0, b.corner * 0.34);
      } else {
        /* Every tile now faces outward, so the middle of the board is local
           -y and the outer rim is local +y, whichever side we are on. */
        const stripe = Math.min(r.w, r.h) * 0.34;
        const stripeEdge = -(long / 2 - stripe);
        const outerEdge = long / 2;
        const along = function (f) { return stripeEdge + (outerEdge - stripeEdge) * f; };

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        /* Transport and utility squares carry a mark where a property carries
           its name, so the name shifts up against the stripe. */
        if (spec.art) {
          ctx.save();
          ctx.translate(0, along(0.52));
          tileArt(ctx, spec.art, across * 0.30, A.colors.tileText);
          ctx.restore();
        }

        ctx.fillStyle = A.colors.tileText;
        ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
        const lines = wrap(ctx, spec.name, across - 8);
        const nameY = along(spec.art ? 0.20 : 0.42);
        lines.forEach(function (ln, k) {
          ctx.fillText(ln, 0, nameY + (k - (lines.length - 1) / 2) * 14);
        });

        if (spec.price) {
          ctx.fillStyle = A.colors.priceText;
          ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.letterSpacing = '1px';
          ctx.fillText('$' + spec.price, 0, along(0.90));
        }
      }
      ctx.restore();
      ctx.restore();
    }

    /* The two card decks, on the diagonal in the middle, as on a real board. */
    const deckIn = smooth(Math.min(1, Math.max(0, (t - assemble * 0.75) / 0.7)));
    if (deckIn > 0.004) {
      const inner = b.S - b.corner * 2;
      const off = inner * 0.375;
      [[-off, -off, 'CHANCE', -Math.PI / 4], [off, off, 'CHEST', -Math.PI / 4]]
        .forEach(function (d) {
          ctx.save();
          ctx.globalAlpha = opacity * deckIn * 0.9;
          ctx.translate(Camera.width / 2 + d[0], Camera.height / 2 + d[1]);
          ctx.rotate(d[3]);
          const w = inner * 0.17, h = w * 0.66;
          /* A couple of cards under the top one, for thickness. */
          for (let k = 2; k >= 0; k--) {
            ctx.fillStyle = A.colors.deck;
            ctx.strokeStyle = A.colors.deckEdge;
            ctx.lineWidth = 1;
            roundRect(ctx, -w / 2 + k * 2.5, -h / 2 + k * 2.5, w, h, 4);
            ctx.fill();
            ctx.stroke();
          }
          ctx.fillStyle = A.colors.tileText;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.letterSpacing = '2px';
          ctx.fillText(d[2], 0, 0);
          ctx.restore();
        });
    }
    ctx.restore();
  }

  function wrap(ctx, text, width) {
    const words = String(text).split(' ');
    const out = [];
    let line = '';
    words.forEach(function (w) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > width && line) { out.push(line); line = w; }
      else line = test;
    });
    if (line) out.push(line);
    return out;
  }

  /* The tile the current turn landed on, pulsing. */
  function drawLanding(ctx, t, opacity) {
    const A = CONFIG.ACT4, b = board();
    const turn = currentTurn(t);
    if (!turn) return;
    const landedAt = turn.t0 + turn.rollFor + turn.hopFor;
    const age = t - landedAt;
    if (age < 0) return;

    const r = tileRect(turn.to, b);
    const spec = tiles[turn.to] || {};
    const color = spec.color || '#ffffff';
    ctx.save();

    /* A flash on arrival, then a slow breath. */
    const flash = Math.max(0, 1 - age / 0.45);
    if (flash > 0) {
      ctx.globalAlpha = opacity * flash * 0.35;
      ctx.fillStyle = color;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    const pulse = 0.55 + 0.45 * Math.sin(age * 3.0);
    ctx.globalAlpha = opacity * (0.4 + 0.35 * pulse);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    ctx.restore();
  }

  function drawDie(ctx, x, y, size, value, angle, alpha, lift) {
    const A = CONFIG.ACT4;
    ctx.save();

    /* Shadow on the board, tightening as the die comes down. */
    const drop = Math.max(0, Math.min(1, lift / (size * 2)));
    ctx.globalAlpha = alpha * 0.5 * (1 - drop * 0.55);
    ctx.fillStyle = A.colors.shadow;
    ctx.beginPath();
    ctx.ellipse(x + size * 0.18, y + lift + size * 0.62,
                size * (0.52 - drop * 0.14), size * (0.20 - drop * 0.05), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    const r = size * 0.19;
    const face = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
    face.addColorStop(0, '#ffffff');
    face.addColorStop(1, A.colors.dieEdge);
    ctx.fillStyle = face;
    roundRect(ctx, -size / 2, -size / 2, size, size, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = A.colors.pip;
    const p = size * 0.24;
    const spots = {
      1: [[0, 0]],
      2: [[-p, -p], [p, p]],
      3: [[-p, -p], [0, 0], [p, p]],
      4: [[-p, -p], [p, -p], [-p, p], [p, p]],
      5: [[-p, -p], [p, -p], [0, 0], [-p, p], [p, p]],
      6: [[-p, -p], [p, -p], [-p, 0], [p, 0], [-p, p], [p, p]]
    }[value] || [];
    spots.forEach(function (s) {
      ctx.beginPath();
      ctx.arc(s[0], s[1], size * 0.088, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  /* Dice are thrown rather than switched on: they arrive from off the board on
     an arc, tumble down, bounce once and settle. */
  function drawDice(ctx, t, opacity) {
    const A = CONFIG.ACT4;
    const turn = currentTurn(t);
    if (!turn) return;
    const age = t - turn.t0;
    if (age < 0 || age > turn.rollFor + turn.hopFor + 0.6) return;

    const fade = age > turn.rollFor + turn.hopFor
      ? Math.max(0, 1 - (age - turn.rollFor - turn.hopFor) / 0.6) : 1;

    const cx = Camera.width / 2, cy = Camera.height / 2;
    const size = Math.min(Camera.width, Camera.height) * 0.052;
    const spread = size * 1.55;
    const flight = turn.rollFor * 0.62;

    for (let d = 0; d < 2; d++) {
      const restX = cx + (d === 0 ? -spread : spread);
      const restY = cy - size * 2.4;
      const k = Math.min(1, age / flight);

      let x, y, lift, angle, value;
      if (k < 1) {
        /* Flying in from beyond the corner of the board. */
        const e = easeOutCubic(k);
        const fromX = cx + b_sign(d) * Camera.width * 0.42;
        const fromY = cy + Camera.height * 0.44;
        x = fromX + (restX - fromX) * e;
        y = fromY + (restY - fromY) * e;
        lift = Math.sin(k * Math.PI) * size * 2.6;
        angle = (1 - k) * (9 + d * 3) + k * 0.1;
        value = 1 + (((t * 26 + d * 3) | 0) % 6);
      } else {
        /* Two quick bounces, then still. */
        const settle = Math.min(1, (age - flight) / (turn.rollFor - flight));
        const bounce = Math.abs(Math.sin(settle * Math.PI * 2.1)) * (1 - settle);
        x = restX;
        y = restY;
        lift = bounce * size * 0.85;
        angle = Math.sin(d * 2.1) * 0.12 * settle + (1 - settle) * 0.6;
        value = settle > 0.55 ? turn.dice[d]
                              : 1 + (((t * 26 + d * 3) | 0) % 6);
      }
      drawDie(ctx, x, y - lift, size, value, angle, opacity * fade, lift);
    }

    if (age >= turn.rollFor) {
      ctx.save();
      ctx.globalAlpha = opacity * fade * 0.9;
      ctx.fillStyle = A.colors.cornerText;
      ctx.font = '700 ' + Math.round(size * 0.5) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '3px';
      ctx.fillText(String(turn.steps), cx, cy - size * 1.0);
      ctx.restore();
    }
  }

  function b_sign(d) { return d === 0 ? -1 : 1; }

  /* Tokens: two pieces, drawn rather than borrowed. */
  function drawToken(ctx, x, y, kind, size, alpha, color, lift) {
    const A = CONFIG.ACT4;
    ctx.save();
    /* Shadow stays on the board while the piece hops above it. */
    const h = Math.max(0, lift || 0);
    ctx.globalAlpha = alpha * 0.55 * (1 - Math.min(0.6, h / (size * 3)));
    ctx.fillStyle = A.colors.shadow;
    ctx.beginPath();
    ctx.ellipse(x + size * 0.12, y + h + size * 0.85,
                size * 0.72, size * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;

    if (kind === 0) {
      const g = ctx.createLinearGradient(0, -size, 0, size);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.42, color);
      g.addColorStop(1, '#5a1114');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(8,10,14,0.92)';
      ctx.fillRect(-size, -size * 0.15, size * 2, size * 0.30);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f4f4f4';
      ctx.lineWidth = size * 0.13;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const g = ctx.createLinearGradient(0, -size, 0, size);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, color);
      g.addColorStop(1, '#12556d');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.15);
      ctx.lineTo(size * 0.28, -size * 0.1);
      ctx.lineTo(size * 1.05, size * 0.72);
      ctx.lineTo(size * 0.42, size * 0.55);
      ctx.lineTo(0, size * 1.0);
      ctx.lineTo(-size * 0.42, size * 0.55);
      ctx.lineTo(-size * 1.05, size * 0.72);
      ctx.lineTo(-size * 0.28, -size * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTokens(ctx, t, opacity) {
    const A = CONFIG.ACT4, b = board();
    /* The pieces are set down once the board itself has finished arriving --
       before that they were floating over bare felt. */
    const placed = smooth(Math.min(1, Math.max(0, (t - A.assembleSeconds * 0.86) / 0.6)));
    if (placed <= 0.001) return;
    opacity *= placed;
    const size = Math.min(b.tile, b.corner) * 0.26;
    for (let who = 0; who < 2; who++) {
      const st = tokenTile(who, t);
      let p = tokenSpot(st.tile, b);
      let lift = 0;
      if (st.hopping) {
        const q = tokenSpot(st.next, b);
        const e = st.frac;
        p = { x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e };
        lift = Math.sin(e * Math.PI) * size * 1.7;
      }
      const other = tokenTile(1 - who, t);
      const nudge = other.tile === st.tile && !st.hopping && !other.hopping
        ? (who === 0 ? -size * 0.85 : size * 0.85) : 0;
      drawToken(ctx, p.x + nudge, p.y - lift, who, size, opacity,
                who === 0 ? A.colors.tokenA : A.colors.tokenB, lift);
    }
  }

  /* Photograph, property name and line, in the middle of the board. */
  function drawCentre(ctx, t, opacity) {
    const A = CONFIG.ACT4, b = board();
    const turn = currentTurn(t);
    if (!turn) return;
    const landedAt = turn.t0 + turn.rollFor + turn.hopFor;
    const age = t - landedAt;
    if (age < 0) return;
    const outAt = turn.span - turn.rollFor - turn.hopFor - A.revealFade;
    const fade = Math.min(1, age / A.revealFade) *
                 (turn === turns[turns.length - 1] ? 1
                  : Math.min(1, Math.max(0, (outAt - age) / A.revealFade)));
    if (fade <= 0.004) return;

    const inner = b.S - b.corner * 2;
    const cx = Camera.width / 2, cy = Camera.height / 2;
    const py = cy - inner * 0.05;

    /* The card takes the photograph's own shape. There is room to spare inside
       a board, and cropping a portrait to a fixed landscape window was taking
       the top off the castle -- so a tall picture gets a tall card. */
    const img = images.get(turn.reveal.photo);
    const boxW = inner * 0.70, boxH = inner * 0.60;
    let pw = boxW, ph = boxH;
    if (img && img.width) {
      const ar = img.width / img.height;
      pw = Math.min(boxW, boxH * ar);
      ph = pw / ar;
    }

    ctx.save();
    ctx.globalAlpha = opacity * fade;
    /* Placed like a card being laid down -- but only when it is a new card.
       Both tokens finish on the same square, so the last two turns share a
       photograph, and re-laying it would read as a stutter. */
    const prev = turns[turns.indexOf(turn) - 1];
    const isNewCard = !prev || prev.reveal.photo !== turn.reveal.photo;
    const place = isNewCard
      ? easeOutCubic(Math.min(1, age / (A.revealFade * 1.3))) : 1;
    ctx.translate(cx, py);
    ctx.rotate((1 - place) * -0.06);
    ctx.scale(0.94 + 0.06 * place, 0.94 + 0.06 * place);

    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(-pw / 2 - 7, -ph / 2 - 7, pw + 14, ph + 14);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    if (img && img !== 'loading' && img !== 'missing') {
      ctx.drawImage(img, -pw / 2, -ph / 2, pw, ph);
    } else {
      ctx.fillStyle = A.colors.frameEmpty;
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.setLineDash([7, 7]);
      ctx.lineWidth = 1;
      ctx.strokeRect(-pw / 2 + 8, -ph / 2 + 8, pw - 16, ph - 16);
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = tiles[turn.to] && tiles[turn.to].color || '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
    ctx.restore();

    const scale = Math.min(Camera.width, Camera.height) / 1080;
    ctx.save();
    ctx.globalAlpha = opacity * fade;
    ctx.textAlign = 'center';
    ctx.fillStyle = tiles[turn.to] && tiles[turn.to].color || '#ffffff';
    ctx.font = '700 ' + (19 * scale) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.letterSpacing = (4 * scale) + 'px';
    ctx.fillText((tiles[turn.to] || {}).name || '', cx, py + ph / 2 + 36 * scale);
    ctx.fillStyle = A.colors.centreText;
    ctx.font = 'italic ' + (23 * scale) + 'px Georgia, "Times New Roman", serif';
    ctx.letterSpacing = '0px';
    ctx.fillText(turn.reveal.line || '', cx, py + ph / 2 + 70 * scale);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ space

     Everything in here is drawn before the board and never after it, which is
     the whole rule: it is a backdrop, and a backdrop that crosses in front of
     a game board stops being one. */

  function drawSky(ctx, t, opacity) {
    const A = CONFIG.ACT4, S = A.space, C = A.colors;
    const W = Camera.width, H = Camera.height;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = C.space;
    ctx.fillRect(0, 0, W, H);

    /* A wash across one diagonal so the black has some depth to it. */
    const g = ctx.createLinearGradient(0, H, W, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.45, C.nebula);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = opacity * S.nebula;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = C.star;
    for (let i = 0; i < stars.length; i++) {
      const st = stars[i];
      const tw = 1 - S.twinkle * 0.5 * (1 + Math.sin(t * st.rate + st.phase));
      ctx.globalAlpha = opacity * st.a * Math.max(0.15, tw);
      ctx.beginPath();
      ctx.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* The station. A sphere lit from the upper left, a trench round its middle,
     and the dish set into the northern hemisphere -- drawn, not borrowed. */
  function drawStation(ctx, t, opacity) {
    const A = CONFIG.ACT4, S = A.space.deathStar, C = A.colors;
    const W = Camera.width, H = Camera.height;
    const cx = W * S.x, cy = H * S.y;
    const r = Math.min(W, H) * S.r;

    ctx.save();
    /* It sits well behind the board and should never out-read it. */
    ctx.globalAlpha = opacity * S.alpha;

    /* Body, lit off the upper left so it reads as a ball and not a disc. */
    const body = ctx.createRadialGradient(cx - r * 0.42, cy - r * 0.46, r * 0.04,
                                          cx, cy, r * 1.18);
    body.addColorStop(0, C.stationLit);
    body.addColorStop(0.5, C.stationMid);
    body.addColorStop(1, C.stationDark);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    /* Everything below stays inside the sphere. */
    ctx.save();
    ctx.clip();

    /* Panel lines: latitudes, then a few meridians, faint. */
    ctx.strokeStyle = C.stationLine;
    ctx.lineWidth = Math.max(0.6, r * 0.006);
    for (let i = -4; i <= 4; i++) {
      const y = cy + (i / 5) * r;
      const half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
      ctx.stroke();
    }
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(i / 2.5) * r, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    /* The equatorial trench, a shade darker than the panels. */
    const tr = r * 0.075;
    ctx.fillStyle = 'rgba(4,6,10,0.62)';
    ctx.fillRect(cx - r, cy + r * 0.06 - tr / 2, r * 2, tr);
    ctx.strokeStyle = 'rgba(150,168,195,0.22)';
    ctx.lineWidth = Math.max(0.7, r * 0.008);
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + r * 0.06 - tr / 2);
    ctx.lineTo(cx + r, cy + r * 0.06 - tr / 2);
    ctx.stroke();

    /* The dish, set into the upper left where the light is. */
    const dx = cx - r * 0.34, dy = cy - r * 0.36, dr = r * S.dish;
    const dish = ctx.createRadialGradient(dx + dr * 0.25, dy + dr * 0.25, dr * 0.05,
                                          dx, dy, dr);
    dish.addColorStop(0, '#05070b');
    dish.addColorStop(0.7, '#20252e');
    dish.addColorStop(1, '#39404b');
    ctx.beginPath();
    ctx.ellipse(dx, dy, dr, dr * 0.93, -0.25, 0, Math.PI * 2);
    ctx.fillStyle = dish;
    ctx.fill();
    ctx.strokeStyle = 'rgba(196,212,236,0.55)';
    ctx.lineWidth = Math.max(0.9, r * 0.012);
    ctx.stroke();

    /* Focusing ring, and the eye of it. */
    ctx.beginPath();
    ctx.ellipse(dx, dy, dr * 0.58, dr * 0.54, -0.25, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(140,158,185,0.22)';
    ctx.lineWidth = Math.max(0.6, r * 0.007);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dx, dy, dr * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,140,170,0.30)';
    ctx.fill();

    /* Shadow across the lower right, so it has a terminator. */
    const term = ctx.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.35,
                                          cx + r * 0.5, cy + r * 0.55, r * 1.9);
    term.addColorStop(0, 'rgba(0,0,0,0)');
    term.addColorStop(0.62, 'rgba(0,0,0,0.26)');
    term.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = term;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    /* A rim of light on the lit edge only. */
    ctx.beginPath();
    ctx.arc(cx, cy, r - 0.5, Math.PI * 0.62, Math.PI * 1.68);
    ctx.strokeStyle = C.stationRim;
    ctx.lineWidth = Math.max(1, r * 0.012);
    ctx.stroke();

    ctx.restore();
  }

  /* Turbolaser bolts: a bright head with a tail, thrown across the frame. */
  function drawBolts(ctx, t, opacity) {
    const W = Camera.width, H = Camera.height;
    ctx.save();
    ctx.lineCap = 'round';

    for (let i = 0; i < bolts.length; i++) {
      const b = bolts[i];
      const age = t - b.t0;
      if (age < 0) continue;

      const x0 = b.x0 * W, y0 = b.y0 * H, x1 = b.x1 * W, y1 = b.y1 * H;
      const dx = x1 - x0, dy = y1 - y0;
      const dist = Math.hypot(dx, dy) || 1;
      const travelled = age * b.speed;
      if (travelled - b.len > dist) continue;      // gone past the far edge

      const ux = dx / dist, uy = dy / dist;
      const head = Math.min(dist, travelled);
      const tail = Math.max(0, travelled - b.len);
      if (head - tail < 2) continue;

      const hx = x0 + ux * head, hy = y0 + uy * head;
      const tx = x0 + ux * tail, ty = y0 + uy * tail;

      /* Fade in over the first instant and out as it runs off. */
      const a = opacity * Math.min(1, age / 0.05) *
                Math.min(1, (dist + b.len - travelled) / b.len);

      const g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, b.color);

      ctx.globalAlpha = a * 0.30;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();

      ctx.globalAlpha = a;
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();

      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(hx - ux * Math.min(18, head - tail), hy - uy * Math.min(18, head - tail));
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* Breaking the surface out of Act Three. */
  function drawSurface(ctx, t, opacity) {
    const A = CONFIG.ACT4;
    if (t > A.surfaceSeconds) return;
    const k = t / A.surfaceSeconds;
    const cx = Camera.width / 2, cy = Camera.height / 2;
    const R = Math.hypot(cx, cy) * (0.25 + easeOutCubic(k) * 1.5);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, 'rgba(233,255,255,' + (0.85 * (1 - k)) + ')');
    g.addColorStop(0.6, 'rgba(150,235,235,' + (0.35 * (1 - k)) + ')');
    g.addColorStop(1, 'rgba(120,220,220,0)');
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Camera.width, Camera.height);
    ctx.restore();
  }

  function draw(ctx, t, opacity) {
    if (!started || opacity <= 0.004) return;
    ctx.save();
    ctx.fillStyle = CONFIG.ACT4.colors.backdrop;
    ctx.globalAlpha = opacity;
    ctx.fillRect(0, 0, Camera.width, Camera.height);
    ctx.restore();

    /* Sky, station, bolts -- then the board over all of it, always. */
    drawSky(ctx, t, opacity);
    drawStation(ctx, t, opacity);
    drawBolts(ctx, t, opacity);

    drawBoard(ctx, t, opacity);
    drawLanding(ctx, t, opacity);
    drawCentre(ctx, t, opacity);
    drawDice(ctx, t, opacity);
    drawTokens(ctx, t, opacity);
    drawSurface(ctx, t, opacity);
  }

  function reset() { started = false; turns = []; stars = []; bolts = []; }

  return { draw: draw, build: build, reset: reset, bolts: function () { return bolts; }, turns: function () { return turns; },
           tileCount: function () { return TILES; },
           plan: function () { return turns; } };
})();
