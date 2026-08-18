/* The vector world: Natural Earth coastlines and borders drawn straight to
   canvas. This is what keeps the pull-back crisp -- raster tiles for the whole
   globe would be either enormous or soft, and on a projector soft is obvious.

   Two levels of detail: 110m for the world view, 50m once we're close. */

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
          return { rings: poly, box: boxOf(poly[0]) };
        }),
        borders: src.borders.map(function (line) {
          return { pts: line, box: boxOf(line) };
        }),
        lakes: src.lakes.map(function (poly) {
          return { rings: poly, box: boxOf(poly[0]) };
        })
      };
    });
    return prepared;
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

  function visible(box, dx) {
    const a = Camera.project(box.n, box.w);
    const b = Camera.project(box.s, box.e);
    return !(a.x + dx > Camera.width + 40 || b.x + dx < -40 ||
             a.y > Camera.height + 40 || b.y < -40);
  }

  function tracePath(ctx, flat, dx) {
    const s = Camera.scale();
    const cx = Geo.mercX(Camera.lon), cy = Geo.mercY(Camera.lat);
    const hw = Camera.width / 2, hh = Camera.height / 2;
    for (let i = 0; i < flat.length; i += 2) {
      const x = (Geo.mercX(flat[i]) - cx) * s + hw + dx;
      const y = (Geo.mercY(flat[i + 1]) - cy) * s + hh;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }

  /* Drawn underneath the tiles, at full strength. The land grey is matched to
     the tiles' own, so where coverage runs out the seam doesn't read as a hole
     in the map -- it just quietly becomes vector. */
  function draw(ctx, opacity) {
    if (opacity <= 0.004) return;
    const data = prepare();
    /* The detailed set is ~1400 polygons against ~120. Below this zoom almost
       all of them are on screen, culling saves nothing, and the extra vertices
       land well under a pixel apiece -- so the coarse set carries the wide
       views and the tiles supply the detail that actually reads. */
    const fine = Camera.zoom >= 6.2;
    const lod = fine ? data.fine : data.coarse;
    const offsets = copies();
    const fillAlpha = opacity;

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
        if (!visible(poly.box, dx)) continue;
        for (let r = 0; r < poly.rings.length; r++) {
          tracePath(ctx, poly.rings[r], dx);
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
          if (!visible(lake.box, dx)) continue;
          for (let r = 0; r < lake.rings.length; r++) {
            tracePath(ctx, lake.rings[r], dx);
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
        if (!visible(line.box, dx)) continue;
        tracePath(ctx, line.pts, dx);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  return { draw: draw };
})();
