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

  /* Plan the game.

     Tokens alternate. A moves on turns 0 and 2, B on 1 and 3. We want both on
     the same square after the last move, so sequences are drawn until one
     works out -- every roll stays a legal pair of dice. */
  function planRolls(count) {
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

  function build() {
    const A = CONFIG.ACT4;
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

  function drawBoard(ctx, t, opacity) {
    const A = CONFIG.ACT4, b = board();
    const assemble = A.assembleSeconds;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = A.colors.board;
    ctx.fillRect(b.left, b.top, b.S, b.S);
    ctx.strokeStyle = A.colors.edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left, b.top, b.S, b.S);

    for (let i = 0; i < TILES; i++) {
      /* Tiles drop into place one after another as the board is laid out. */
      const due = (i / TILES) * (assemble * 0.72);
      const in01 = smooth(Math.min(1, Math.max(0, (t - due) / 0.42)));
      if (in01 <= 0.001) continue;

      const r = tileRect(i, b);
      const spec = tiles[i] || { name: '' };
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;

      ctx.save();
      ctx.globalAlpha = opacity * in01;
      ctx.translate(cx, cy);
      ctx.scale(0.6 + 0.4 * in01, 0.6 + 0.4 * in01);
      ctx.translate(-cx, -cy);

      ctx.fillStyle = A.colors.tile;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = A.colors.edge;
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      /* Colour band on the inner edge, glowing. */
      if (spec.color) {
        const d = Math.min(r.w, r.h) * 0.30;
        ctx.save();
        ctx.shadowColor = spec.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = spec.color;
        if (r.side === 0) ctx.fillRect(r.x, r.y + r.h - d, r.w, d);
        else if (r.side === 1) ctx.fillRect(r.x, r.y, d, r.h);
        else if (r.side === 2) ctx.fillRect(r.x, r.y, r.w, d);
        else ctx.fillRect(r.x + r.w - d, r.y, d, r.h);
        ctx.restore();
      }

      /* Names.

         A real board turns each side's text to face its own player, which
         leaves half of it upside down. That's fine on a table with four people
         round it and wrong on a ceiling, where there is one person and one
         orientation. So the left and right sides turn -- enough to still read
         as a board -- and the top, bottom and corners stay upright. */
      if (spec.name) {
        const rot = spec.corner ? 0
          : r.side === 1 ? -Math.PI / 2
          : r.side === 3 ? Math.PI / 2 : 0;
        const push = Math.min(r.w, r.h) * 0.17;
        const ox = r.side === 1 ? push : r.side === 3 ? -push : 0;
        const oy = r.side === 0 ? -push : r.side === 2 ? push : 0;
        ctx.save();
        ctx.translate(cx + ox, cy + oy);
        ctx.rotate(rot);
        ctx.fillStyle = spec.corner ? A.colors.cornerText : A.colors.tileText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const size = spec.corner ? 15 : 13;
        ctx.font = '600 ' + size + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
        const words = spec.name.split(' ');
        const lines = [];
        let line = '';
        words.forEach(function (w) {
          const test = line ? line + ' ' + w : w;
          if (ctx.measureText(test).width > (spec.corner ? b.corner : b.tile) - 10 && line) {
            lines.push(line); line = w;
          } else line = test;
        });
        if (line) lines.push(line);
        lines.forEach(function (ln, k) {
          ctx.fillText(ln, 0, (k - (lines.length - 1) / 2) * (size + 2));
        });
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
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
    ctx.save();
    const pulse = 0.55 + 0.45 * Math.sin(age * 3.2);
    ctx.globalAlpha = opacity * (0.35 + 0.4 * pulse);
    ctx.strokeStyle = spec.color || '#ffffff';
    ctx.shadowColor = spec.color || '#ffffff';
    ctx.shadowBlur = 22;
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    ctx.restore();
  }

  function drawDie(ctx, x, y, size, value, angle, alpha, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    const r = size * 0.18;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(-size / 2 + r, -size / 2);
    ctx.arcTo(size / 2, -size / 2, size / 2, size / 2, r);
    ctx.arcTo(size / 2, size / 2, -size / 2, size / 2, r);
    ctx.arcTo(-size / 2, size / 2, -size / 2, -size / 2, r);
    ctx.arcTo(-size / 2, -size / 2, size / 2, -size / 2, r);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = CONFIG.ACT4.colors.pip;
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
      ctx.arc(s[0], s[1], size * 0.085, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawDice(ctx, t, opacity) {
    const A = CONFIG.ACT4;
    const turn = currentTurn(t);
    if (!turn) return;
    const age = t - turn.t0;
    if (age < 0 || age > turn.rollFor + turn.hopFor + 0.6) return;

    const settling = Math.min(1, age / turn.rollFor);
    const fade = age > turn.rollFor + turn.hopFor
      ? Math.max(0, 1 - (age - turn.rollFor - turn.hopFor) / 0.6) : 1;

    const cx = Camera.width / 2, cy = Camera.height / 2;
    const size = Math.min(Camera.width, Camera.height) * 0.055;
    const spread = size * 1.5;

    for (let d = 0; d < 2; d++) {
      const tumbling = settling < 1;
      /* Whirling through faces until it settles on the real one. */
      const value = tumbling ? 1 + (((t * 22 + d * 3) | 0) % 6) : turn.dice[d];
      const angle = tumbling ? (t * (7 + d * 2)) % (Math.PI * 2)
                             : Math.sin(d * 2.1) * 0.12;
      const lift = tumbling ? (1 - settling) * size * 1.4 : 0;
      drawDie(ctx, cx + (d === 0 ? -spread : spread), cy - size * 2.1 - lift,
              size, value, angle, opacity * fade, A.colors.die);
    }

    if (settling >= 1) {
      ctx.save();
      ctx.globalAlpha = opacity * fade * 0.85;
      ctx.fillStyle = A.colors.tileText;
      ctx.font = '600 ' + Math.round(size * 0.52) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '3px';
      ctx.fillText(String(turn.steps), cx, cy - size * 0.75);
      ctx.restore();
    }
  }

  /* Tokens: two pieces, drawn rather than borrowed. */
  function drawToken(ctx, x, y, kind, size, alpha, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;

    if (kind === 0) {
      /* A banded sphere. */
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = CONFIG.ACT4.colors.board;
      ctx.fillRect(-size, -size * 0.16, size * 2, size * 0.32);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = size * 0.16;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      /* A swept fighter, nose up. */
      ctx.fillStyle = color;
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
    const size = Math.min(b.tile, b.corner) * 0.26;
    for (let who = 0; who < 2; who++) {
      const st = tokenTile(who, t);
      let p = tokenSpot(st.tile, b);
      if (st.hopping) {
        const q = tokenSpot(st.next, b);
        const e = st.frac;
        p = { x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e };
        /* A little arc on each hop. */
        p.y -= Math.sin(e * Math.PI) * size * 1.5;
      }
      /* Side by side when they share a square. */
      const other = tokenTile(1 - who, t);
      const nudge = other.tile === st.tile && !st.hopping && !other.hopping
        ? (who === 0 ? -size * 0.85 : size * 0.85) : 0;
      drawToken(ctx, p.x + nudge, p.y, who, size, opacity,
                who === 0 ? A.colors.tokenA : A.colors.tokenB);
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
    const pw = inner * 0.74, ph = pw * 0.66;
    const cx = Camera.width / 2, cy = Camera.height / 2;

    ctx.save();
    ctx.globalAlpha = opacity * fade;

    const img = images.get(turn.reveal.photo);
    const py = cy - inner * 0.06;
    if (img && img !== 'loading' && img !== 'missing') {
      const ar = img.width / img.height, fr = pw / ph;
      let sw = img.width, sh = img.height, sx = 0, sy = 0;
      if (ar > fr) { sw = img.height * fr; sx = (img.width - sw) / 2; }
      else { sh = img.width / fr; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, cx - pw / 2, py - ph / 2, pw, ph);
    } else {
      ctx.fillStyle = A.colors.frameEmpty;
      ctx.fillRect(cx - pw / 2, py - ph / 2, pw, ph);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.setLineDash([7, 7]);
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - pw / 2 + 8, py - ph / 2 + 8, pw - 16, ph - 16);
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = tiles[turn.to] && tiles[turn.to].color || '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - pw / 2, py - ph / 2, pw, ph);

    /* The square it landed on, then the line. */
    const scale = Math.min(Camera.width, Camera.height) / 1080;
    ctx.textAlign = 'center';
    ctx.fillStyle = tiles[turn.to] && tiles[turn.to].color || '#ffffff';
    ctx.font = '700 ' + (19 * scale) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.letterSpacing = (4 * scale) + 'px';
    ctx.fillText((tiles[turn.to] || {}).name || '', cx, py + ph / 2 + 34 * scale);

    ctx.fillStyle = A.colors.centreText;
    ctx.font = 'italic ' + (23 * scale) + 'px Georgia, "Times New Roman", serif';
    ctx.letterSpacing = '0px';
    ctx.fillText(turn.reveal.line || '', cx, py + ph / 2 + 68 * scale);
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

    drawBoard(ctx, t, opacity);
    drawLanding(ctx, t, opacity);
    drawCentre(ctx, t, opacity);
    drawDice(ctx, t, opacity);
    drawTokens(ctx, t, opacity);
    drawSurface(ctx, t, opacity);
  }

  function reset() { started = false; turns = []; }

  return { draw: draw, build: build, reset: reset,
           tileCount: function () { return TILES; },
           plan: function () { return turns; } };
})();
