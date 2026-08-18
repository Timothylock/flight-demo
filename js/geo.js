/* Web Mercator, great circles, and the small amount of spherical trig the
   flights need. Everything here works in *unwrapped* longitude: a path west
   out of Seattle keeps counting down past -180 rather than jumping to +179,
   which is what keeps a Pacific crossing drawing as one continuous line. */

const Geo = (function () {

  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  const EARTH_KM = 6371;

  /* Longitude -> 0..1 across the world. Values outside that range are fine and
     meaningful: 1.5 is half a world east of the +180 seam. */
  function mercX(lon) {
    return (lon + 180) / 360;
  }

  /* Latitude -> 0..1, 0 at the top. Clamped short of the poles, where Mercator
     runs off to infinity. */
  function mercY(lat) {
    const phi = Math.max(-85.05, Math.min(85.05, lat)) * D2R;
    return (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2;
  }

  function invMercX(x) {
    return x * 360 - 180;
  }

  function invMercY(y) {
    return Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * R2D;
  }

  function toXYZ(lat, lon) {
    const p = lat * D2R, l = lon * D2R;
    const c = Math.cos(p);
    return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)];
  }

  /* Angular separation, radians. */
  function angle(a, b) {
    const p1 = a.lat * D2R, p2 = b.lat * D2R, dl = (b.lon - a.lon) * D2R;
    const s = Math.sin((p2 - p1) / 2) ** 2 +
              Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function distanceKm(a, b) {
    return angle(a, b) * EARTH_KM;
  }

  /* Point at fraction f along the great circle from a to b. */
  function interpolate(a, b, f) {
    const d = angle(a, b);
    if (d < 1e-9) return { lat: a.lat, lon: a.lon };
    const sd = Math.sin(d);
    const A = Math.sin((1 - f) * d) / sd;
    const B = Math.sin(f * d) / sd;
    const [x1, y1, z1] = toXYZ(a.lat, a.lon);
    const [x2, y2, z2] = toXYZ(b.lat, b.lon);
    const x = A * x1 + B * x2, y = A * y1 + B * y2, z = A * z1 + B * z2;
    return {
      lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * R2D,
      lon: Math.atan2(y, x) * R2D
    };
  }

  /* Shift lon by whole worlds until it's the copy nearest `near`. */
  function unwrap(lon, near) {
    while (lon - near > 180) lon -= 360;
    while (near - lon > 180) lon += 360;
    return lon;
  }

  /* Compass bearing at a, heading toward b. */
  function bearing(a, b) {
    const p1 = a.lat * D2R, p2 = b.lat * D2R, dl = (b.lon - a.lon) * D2R;
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return Math.atan2(y, x) * R2D;
  }

  /* Sample a great circle into a polyline with continuous longitude.

     `bow` nudges the arc sideways by a fixed fraction of its own length,
     peaking at the midpoint. Real routes are great circles, but when two
     trips share a leg -- both flying SEA to LAX before splitting -- an
     identical arc drawn twice reads as one flight. A small bow separates them. */
  function samplePath(a, b, samples, bow) {
    samples = samples || 96;
    const pts = [];
    let prevLon = a.lon;

    const ax = mercX(a.lon), ay = mercY(a.lat);
    let bLonU = unwrap(b.lon, a.lon);
    const bx = mercX(bLonU), by = mercY(b.lat);
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-9;
    const nx = -dy / len, ny = dx / len;          // unit normal in map space
    const amp = (bow || 0) * len * 0.045;

    for (let i = 0; i <= samples; i++) {
      const f = i / samples;
      const p = interpolate(a, b, f);
      let lon = unwrap(p.lon, prevLon);
      prevLon = lon;
      let lat = p.lat;

      if (amp) {
        const k = Math.sin(Math.PI * f) * amp;
        const x = mercX(lon) + nx * k;
        const y = mercY(lat) + ny * k;
        lon = invMercX(x);
        lat = invMercY(Math.max(0.0001, Math.min(0.9999, y)));
      }
      pts.push({ lat: lat, lon: lon });
    }
    return pts;
  }

  /* Cumulative arc length along a polyline, normalised to 0..1, so a plane
     moving at constant speed doesn't slow down where samples bunch up. */
  function arcLengths(pts) {
    const acc = [0];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(
        mercX(pts[i].lon) - mercX(pts[i - 1].lon),
        mercY(pts[i].lat) - mercY(pts[i - 1].lat)
      );
      acc.push(total);
    }
    if (total > 0) for (let i = 0; i < acc.length; i++) acc[i] /= total;
    return acc;
  }

  /* Position and heading at fraction f along a sampled path. */
  function alongPath(pts, acc, f) {
    f = Math.max(0, Math.min(1, f));
    let i = 1;
    while (i < acc.length - 1 && acc[i] < f) i++;
    const span = acc[i] - acc[i - 1] || 1e-9;
    const t = (f - acc[i - 1]) / span;
    const p0 = pts[i - 1], p1 = pts[i];
    const lat = p0.lat + (p1.lat - p0.lat) * t;
    const lon = p0.lon + (p1.lon - p0.lon) * t;
    const heading = Math.atan2(
      mercX(p1.lon) - mercX(p0.lon),
      -(mercY(p1.lat) - mercY(p0.lat))
    ) * R2D;
    return { lat: lat, lon: lon, heading: heading, index: i };
  }

  return {
    mercX: mercX, mercY: mercY, invMercX: invMercX, invMercY: invMercY,
    distanceKm: distanceKm, interpolate: interpolate, bearing: bearing,
    unwrap: unwrap, samplePath: samplePath, arcLengths: arcLengths,
    alongPath: alongPath
  };
})();
