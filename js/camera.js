/* The camera: a lat/lon centre and a fractional zoom, plus the projection from
   world coordinates to canvas pixels.

   Zoom is deliberately fractional -- the whole piece is one continuous pull
   from z8.2 down to the world, and stepping through integer zoom levels the
   way a slippy map does would make that visibly stutter. */

const Camera = {
  lat: 0,
  lon: 0,
  zoom: 3,
  width: 0,
  height: 0,

  /* Width of the entire world, in canvas pixels, at the current zoom. */
  scale: function () {
    return 256 * Math.pow(2, this.zoom);
  },

  /* Project to canvas pixels. Longitude is taken as given: pass an unwrapped
     value and you get a point off the side of the world, which is exactly what
     a continuous flight path needs. */
  project: function (lat, lon) {
    const s = this.scale();
    return {
      x: (Geo.mercX(lon) - Geo.mercX(this.lon)) * s + this.width / 2,
      y: (Geo.mercY(lat) - Geo.mercY(this.lat)) * s + this.height / 2
    };
  },

  /* For fixed points -- airports, markers -- put them on whichever copy of the
     world is nearest the camera, so they never vanish off a seam. */
  projectWrapped: function (lat, lon) {
    return this.project(lat, Geo.unwrap(lon, this.lon));
  },

  /* The cold-open zoom, scaled to the screen.

     CONFIG.HOME.zoom is written for a 1920px projector; on anything else a
     fixed zoom would show a wildly different slice of Puget Sound -- a phone
     would be looking at a few miles of runway. Scaling by the long edge keeps
     roughly the same piece of world in frame whatever it's shown on. */
  homeZoom: function () {
    const reference = Math.max(this.width, this.height) / 1920;
    return CONFIG.HOME.zoom + Math.log2(reference);
  },

  /* The pulled-back view, fitted to where the flights actually go.

     Fitting to the screen width instead would be wrong twice over: on a
     portrait screen it leaves the map as a band across the middle, and it
     ignores the routes entirely -- swap HERO_ROUTES for a set of trips that
     never leave Europe and the sequence would still end on the whole globe
     with everything crammed into one corner. This fits the destinations, then
     refuses to pull back further than a world-width, which is the point past
     which you'd start seeing the map repeat. */
  worldView: function () {
    const anchor = CONFIG.WORLD.lon;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    Flights.heroStops().forEach(function (code) {
      const a = AIRPORTS[code];
      if (!a) return;
      const x = Geo.mercX(Geo.unwrap(a.lon, anchor));
      const y = Geo.mercY(a.lat);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    if (!isFinite(minX)) {
      return { lat: CONFIG.WORLD.lat, lon: anchor,
               zoom: Math.log2(this.width / 256) };
    }

    const pad = CONFIG.WORLD_PADDING;
    const reserve = CONFIG.WORLD_BOTTOM_RESERVE;
    const spanX = Math.max(1e-6, (maxX - minX) / (1 - 2 * pad));
    const spanY = Math.max(1e-6, (maxY - minY) / (1 - 2 * pad));

    /* Fit the content into the frame, less the strip held back for the title.
       The smaller of the two fits is the one that gets everything on screen. */
    const usableH = this.height * (1 - reserve);
    const fitted = Math.min(
      Math.log2(this.width / (spanX * 256)),
      Math.log2(usableH / (spanY * 256))
    );

    /* Floor, not ceiling: pulling back past a world-width starts showing the
       map repeating itself, so that's as far out as we ever go. It must never
       drag the camera further out than the fit already asked for. */
    const widest = Math.log2(this.width / (256 * (CONFIG.WORLD_ZOOM_PADDING || 1)));
    const zoom = Math.max(fitted, widest);

    /* Lift the routes above the words: moving the camera centre south (a
       larger Mercator y) slides the content up the screen, into the space the
       reserved strip just freed. */
    const shift = (this.height * reserve / 2) / (256 * Math.pow(2, zoom));

    return {
      lat: Geo.invMercY(Math.max(0.001, Math.min(0.999, (minY + maxY) / 2 + shift))),
      lon: Geo.invMercX((minX + maxX) / 2),
      zoom: zoom
    };
  },

  /* Rough test used to skip work for things well off-screen. */
  onScreen: function (p, margin) {
    margin = margin || 80;
    return p.x > -margin && p.x < this.width + margin &&
           p.y > -margin && p.y < this.height + margin;
  },

  set: function (lat, lon, zoom) {
    this.lat = lat;
    this.lon = lon;
    this.zoom = zoom;
  }
};
