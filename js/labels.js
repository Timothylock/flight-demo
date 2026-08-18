/* One shared allocator for every piece of text on the map.

   Everything is labelled -- every aircraft, every airport -- and at world
   scale the places that matter are exactly the places that crowd: SEA and PAE
   are 27 miles apart, LHR/AMS/CDG land on top of each other, and an arriving
   aircraft parks its callsign right where its destination code is about to
   appear. Each label asks for a slot, and gets nudged clear of the ones
   already placed this frame.

   Priority is call order, so whoever draws first wins their preferred spot.
   Airports go first: the codes are the point of the whole sequence. */

const Labels = (function () {

  let placed = [];

  function begin() {
    placed = [];
  }

  /* Returns the y (text baseline centre) to draw at. `x` and `w` are the
     label's left edge and measured width; `y` is where it would like to sit. */
  function place(x, y, w, h) {
    h = h || 14;
    let ly = y - h / 2;

    for (let attempt = 0; attempt < 10; attempt++) {
      let clash = false;
      for (let i = 0; i < placed.length; i++) {
        const b = placed[i];
        if (x < b.x + b.w + 5 && x + w + 5 > b.x &&
            ly < b.y + b.h + 2 && ly + h + 2 > b.y) { clash = true; break; }
      }
      if (!clash) break;
      /* Step alternately down and up, further each time. */
      const step = Math.ceil((attempt + 1) / 2) * (h + 3);
      ly = y - h / 2 + (attempt % 2 === 0 ? step : -step);
    }

    placed.push({ x: x, y: ly, w: w, h: h });
    return ly + h / 2;
  }

  return { begin: begin, place: place };
})();
