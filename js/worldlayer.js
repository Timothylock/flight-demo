/* The vector world: Natural Earth coastlines and borders drawn straight to
   canvas. This is what keeps the pull-back crisp -- raster tiles for the whole
   globe would be either enormous or soft, and on a projector soft is obvious.

   Two levels of detail: 110m for the world view, 50m once we're close.

   Zoomed out this layer is nearly the whole frame's work: every polygon is on
   screen, up to three copies of the world at once, and most of the vertices
   land under a pixel apiece. Three things keep that affordable, and none of
   them cost anything close in --

     the Mercator projection of every point is computed once, at load, rather
     than per frame (it is a tan, a cos and a log per vertex, and there are
     sixty thousand of them);

     polygons too small to read on screen are skipped whole, which at world
     scale is most of the islands;

     and vertices that land on top of the last one kept are dropped as the path
     is traced, so a coastline costs what it can actually show.

   The last two are measured in screen pixels and scale with the zoom, so they
   do nothing at all when the camera is close. */

const WorldLayer = (function () {

  let prepared = null;

  /* Bounding boxes, computed once, so the near view can skip the ~1400
     polygons that aren't on screen instead of pathing all of them. */
  function prepare() {
    if (prepared) return prepared;
    prepared = {};
    ['coarse', 'fine'].forEach(function (lod) {
      const src = WORLD_DATA[lod];
      prepared[lod] = {
        land: src.land.map(function (poly) {
          return { rings: poly.map(merc), box: boxOf(poly[0]) };
        }),
        borders: src.borders.map(function (line) {
          return { pts: merc(line), box: boxOf(line) };
        }),
        lakes: src.lakes.map(function (poly) {
          return { rings: poly.map(merc), box: boxOf(poly[0]) };
        })
      };
    });
    return prepared;
  }

  /* lon/lat pairs -> Mercator 0..1 pairs, once, at load. Doing this per frame
     put a tan, a cos and a log on every one of sixty thousand vertices. */
  function merc(flat) {
    const out = new Float64Array(flat.length);
    for (let i = 0; i < flat.length; i += 2) {
      out[i] = Geo.mercX(flat[i]);
      out[i + 1] = Geo.mercY(flat[i + 1]);
    }
    return out;
  }

  /* How much detail is worth drawing at this zoom, in screen pixels. */
  function budget() {
    const L = CONFIG.WORLD_LOD;
    const k = Math.max(0, Math.min(1,
      (Camera.zoom - L.wideZoom) / (L.closeZoom - L.wideZoom)));
    return {
      poly: L.widePoly + (L.closePoly - L.widePoly) * k,
      vertex: L.wideVertex + (L.closeVertex - L.wideVertex) * k
    };
  }

  function boxOf(flat) {
    let w = 181, e = -181, s = 91, n = -91;
    for (let i = 0; i < flat.length; i += 2) {
      if (flat[i] < w) w = flat[i];
      if (flat[i] > e) e = flat[i];
      if (flat[i + 1] < s) s = flat[i + 1];
      if (flat[i + 1] > n) n = flat[i + 1];
    }
    return { w: w, e: e, s: s, n: n };
  }

  /* Which copies of the world overlap the viewport. At close zoom that's just
     one; pulled all the way back it can be two or three. */
  function copies() {
    const s = Camera.scale();
    const left = (0 - Geo.mercX(Camera.lon)) * s + Camera.width / 2;
    const first = Math.ceil((-left) / s - 1);
    const last = Math.floor((Camera.width - left) / s);
    const out = [];
    for (let k = first; k <= last && out.length < 3; k++) out.push(k * s);
    return out.length ? out : [0];
  }

  /* Off screen, or too small to be worth drawing. At the world view the fine
     set carries several hundred islands that come out under a pixel across;
     they cost as much as a continent and read as grain. */
  function skip(box, dx, min) {
    const a = Camera.project(box.n, box.w);
    const b = Camera.project(box.s, box.e);
    if (a.x + dx > Camera.width + 40 || b.x + dx < -40 ||
        a.y > Camera.height + 40 || b.y < -40) return true;
    return (b.x - a.x) < min && (b.y - a.y) < min;
  }

  /* Trace already-projected points, dropping any that land on top of the last
     one we kept. Comparing on each axis rather than by distance keeps it to a
     pair of subtractions per vertex, which matters when there are sixty
     thousand of them. The last point is always kept so a ring still closes
     where it should. */
  function tracePath(ctx, m, dx, tol) {
    const s = Camera.scale();
    const cx = Geo.mercX(Camera.lon), cy = Geo.mercY(Camera.lat);
    const hw = Camera.width / 2 + dx, hh = Camera.height / 2;
    const last = m.length - 2;
    let px = 0, py = 0;
    for (let i = 0; i < m.length; i += 2) {
      const x = (m[i] - cx) * s + hw;
      const y = (m[i + 1] - cy) * s + hh;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const ax = x - px, ay = y - py;
        if (i !== last && (ax < tol && ax > -tol) && (ay < tol && ay > -tol)) continue;
        ctx.lineTo(x, y);
      }
      px = x; py = y;
    }
  }

  /* Drawn underneath the tiles, at full strength. The land grey is matched to
     the tiles' own, so where coverage runs out the seam doesn't read as a hole
     in the map -- it just quietly becomes vector. */
  function draw(ctx, opacity) {
    if (opacity <= 0.004) return;
    const data = prepare();
    /* The detailed set is ~1400 polygons and 60,000 points against ~120 and
       5,000. It's used for everything except the very widest view, where the
       extra vertices genuinely land under a pixel apiece and only make the
       coastline noisy.

       This threshold used to sit far higher, chosen to save frame time, which
       meant every country close-up in Act Two -- Japan, Hong Kong, Taiwan,
       Iceland, all between zoom 4.6 and 5.6 -- was drawn from the coarse
       outline. Those are the shots the act is built around. */
    const fine = Camera.zoom >= CONFIG.FINE_DETAIL_ZOOM;
    const lod = fine ? data.fine : data.coarse;
    const offsets = copies();
    const fillAlpha = opacity;
    const budg = budget();

    ctx.save();
    ctx.lineJoin = 'round';

    /* Land: the path gets built once and then filled and stroked. Tracing it
       twice -- which is what fill-then-rebuild-then-stroke costs -- was the
       single most expensive thing in the frame during the pull-back, where
       most of a continent's worth of polygons are on screen at once. */
    ctx.beginPath();
    for (let o = 0; o < offsets.length; o++) {
      const dx = offsets[o];
      for (let i = 0; i < lod.land.length; i++) {
        const poly = lod.land[i];
        if (skip(poly.box, dx, budg.poly)) continue;
        for (let r = 0; r < poly.rings.length; r++) {
          tracePath(ctx, poly.rings[r], dx, budg.vertex);
          ctx.closePath();
        }
      }
    }
    if (fillAlpha > 0.004) {
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = fine ? CONFIG.COLORS.land : CONFIG.COLORS.landFar;
      ctx.fill();
    }
    /* Coastline, a little brighter than the fill -- at world scale this
       outline is most of what the eye reads as "map". */
    ctx.globalAlpha = opacity * 0.85;
    ctx.strokeStyle = CONFIG.COLORS.coast;
    ctx.lineWidth = fine ? 1.1 : 0.9;
    ctx.stroke();

    /* Lakes, punched back out of the land. */
    if (fillAlpha > 0.004) {
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = CONFIG.COLORS.water;
      ctx.beginPath();
      for (let o = 0; o < offsets.length; o++) {
        const dx = offsets[o];
        for (let i = 0; i < lod.lakes.length; i++) {
          const lake = lod.lakes[i];
          if (skip(lake.box, dx, budg.poly)) continue;
          for (let r = 0; r < lake.rings.length; r++) {
            tracePath(ctx, lake.rings[r], dx, budg.vertex);
            ctx.closePath();
          }
        }
      }
      ctx.fill();
    }

    /* Internal country borders, dimmer still. */
    ctx.globalAlpha = opacity * 0.55;
    ctx.strokeStyle = CONFIG.COLORS.border;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let o = 0; o < offsets.length; o++) {
      const dx = offsets[o];
      for (let i = 0; i < lod.borders.length; i++) {
        const line = lod.borders[i];
        if (skip(line.box, dx, budg.poly)) continue;
        tracePath(ctx, line.pts, dx, budg.vertex);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  return { draw: draw };
})();
