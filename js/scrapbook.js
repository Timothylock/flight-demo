/* Photographs left behind on the map.

   Frames are pinned to lat/lon, not to the screen, so they stay where the
   aircraft dropped them and the whole scrapbook is there when the camera pulls
   back at the end.

   Any photo that isn't on disk yet draws as an empty frame carrying its place
   name. That's deliberate: the piece reads as finished before a single image
   has been added, and each one appears as you drop files into photos/. */

const Scrapbook = (function () {

  const images = new Map();     // filename -> Image | 'missing'
  let clusters = [];            // { lat, lon, place, frames: [...] }

  function load(name) {
    const hit = images.get(name);
    if (hit !== undefined) return hit;
    images.set(name, 'loading');
    const img = new Image();
    img.onload = function () { images.set(name, img); };
    img.onerror = function () { images.set(name, 'missing'); };
    img.src = CONFIG.SCRAPBOOK.dir + name;
    return 'loading';
  }

  function reset() {
    clusters = [];
  }

  /* Lay a cluster out around an airport. Frames sit on a shallow arc facing
     away from the board, tilted a little, in the order they'll pop. */
  function add(code, place, photos, at, fanAngle) {
    const a = AIRPORTS[code];
    if (!a) return;
    const S = CONFIG.SCRAPBOOK;
    const n = photos.length;
    /* Explicit fans rather than a computed arc. Spacing frames by angle alone
       let the outer ones converge, and a cluster of three stacked two frames
       almost exactly on top of each other -- you saw two photographs where
       there were three. These are laid out so no two centres come closer than
       a frame's width. */
    const FANS = {
      1: [[1.30, 0.00]],
      2: [[1.28, -0.58], [1.28, 0.60]],
      3: [[1.12, -0.88], [1.78, 0.04], [1.04, 0.96]],
      4: [[1.05, -0.95], [1.80, -0.30], [1.72, 0.62], [0.98, 1.02]]
    };
    const fan = FANS[Math.min(n, 4)] || FANS[3];
    /* Each destination splays its cluster a different way. Japan, Hong Kong
       and Taiwan sit within a few degrees of each other, so at the final
       pull-back three identical fans merge into one unreadable pile. */
    const rot = fanAngle || 0;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const frames = photos.map(function (spec, i) {
      const slot = fan[i % fan.length];
      /* A photograph is either a filename or a filename with a crop -- see
         js/photo.js for what the number means. */
      return {
        name: typeof spec === 'string' ? spec : spec.name,
        crop: typeof spec === 'string' ? undefined : spec.crop,
        dx: (slot[0] * cs - slot[1] * sn) * S.radius,
        dy: (slot[0] * sn + slot[1] * cs) * S.radius,
        tilt: ((i * 37) % 13 - 6) / 6 * S.tilt * Math.PI / 180,
        at: at + i * S.popSeconds * 0.6
      };
    });
    clusters.push({ lat: a.lat, lon: a.lon, place: place, frames: frames });
    photos.forEach(function (spec) {
      load(typeof spec === 'string' ? spec : spec.name);
    });
  }

  function easeOutBack(t) {
    const c = 1.7;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }

  function draw(ctx, t, opacity) {
    if (opacity <= 0.004 || !clusters.length) return;
    const S = CONFIG.SCRAPBOOK;
    /* Frames are screen-sized, not map-sized -- a photograph pinned to the
       map would be a postage stamp at country zoom and fill the sky at world
       zoom. They do shrink as the camera pulls back, though, or the clusters
       collide the moment it does. */
    const viewport = Math.min(Camera.width, Camera.height) / 1080;
    const zoomScale = Math.max(S.minScale,
                       Math.min(1, Math.pow(2, (Camera.zoom - S.fullScaleZoom) * S.scaleWithZoom)));
    const scale = viewport * zoomScale;
    const fw = S.frameW * scale, fh = S.frameH * scale, bd = S.border * scale;

    ctx.save();
    for (let c = 0; c < clusters.length; c++) {
      const cluster = clusters[c];
      const anchor = Camera.projectWrapped(cluster.lat, cluster.lon);

      for (let i = 0; i < cluster.frames.length; i++) {
        const f = cluster.frames[i];
        const age = t - f.at;
        if (age <= 0) continue;
        const p = Math.min(1, age / S.popSeconds);
        const grow = easeOutBack(p);
        const alpha = opacity * Math.min(1, p * 2.2);

        const x = anchor.x + f.dx * scale;
        const y = anchor.y + f.dy * scale;
        if (x < -400 || x > Camera.width + 400 || y < -400 || y > Camera.height + 400) continue;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(f.tilt);
        ctx.scale(grow, grow);
        ctx.globalAlpha = alpha;

        /* Print border and a soft drop shadow. */
        ctx.shadowColor = 'rgba(0,0,0,0.75)';
        ctx.shadowBlur = 26 * scale;
        ctx.shadowOffsetY = 5 * scale;
        ctx.fillStyle = '#e9e9e9';
        ctx.fillRect(-fw / 2 - bd, -fh / 2 - bd, fw + bd * 2, fh + bd * 2);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        const img = images.get(f.name);
        if (img && img !== 'loading' && img !== 'missing') {
          Photo.cover(ctx, img, -fw / 2, -fh / 2, fw, fh, f.crop);
        } else {
          /* Waiting for a photograph. */
          ctx.fillStyle = '#141414';
          ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
          ctx.strokeStyle = 'rgba(255,255,255,0.16)';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(-fw / 2 + 6, -fh / 2 + 6, fw - 12, fh - 12);
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,255,255,0.42)';
          ctx.font = (12 * scale) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.letterSpacing = '2px';
          ctx.fillText(cluster.place, 0, 0);
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  return { reset: reset, add: add, draw: draw };
})();
