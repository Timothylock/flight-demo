/* One shared allocator for every piece of text on the map.

   Everything is labelled -- every aircraft, every airport -- and at world
   scale the places that matter are exactly the places that crowd: SEA and PAE
   are 27 miles apart, LHR/AMS/CDG land on top of each other, and an arriving
   aircraft parks its callsign right where its destination code is about to
   appear. Each label asks for a slot and gets nudged clear of the ones already
   placed this frame.

   The important part is that a label REMEMBERS the slot it took. Placing
   greedily from scratch every frame is what made labels flicker: two aircraft
   drift together, the one that happens to be placed second gets bumped, and a
   frame later -- once they've moved a pixel -- it doesn't, so the text snaps
   back and forth many times a second. Here each label keeps its offset until
   that offset actually collides, and any change it does make is eased in over
   a fraction of a second rather than jumping. */

const Labels = (function () {

  const STEP = 17;           // vertical spacing between stacked slots
  const SETTLE = 0.12;       // seconds for a label to glide to a new slot
  const FORGET = 1.0;        // seconds offscreen before a label's slot is released

  const memory = new Map();  // key -> { slot, dy, seen }
  let placed = [];
  let now = 0;

  function begin(dt) {
    placed = [];
    now += dt;
    if (memory.size > 400) {
      memory.forEach(function (m, key) {
        if (now - m.seen > FORGET) memory.delete(key);
      });
    }
  }

  function clashes(x, y, w, h) {
    for (let i = 0; i < placed.length; i++) {
      const b = placed[i];
      if (x < b.x + b.w + 5 && x + w + 5 > b.x &&
          y < b.y + b.h + 2 && y + h + 2 > b.y) return true;
    }
    return false;
  }

  /* Slot n as a vertical offset: 0, then alternating below/above. */
  function offsetOf(slot) {
    if (slot === 0) return 0;
    const step = Math.ceil(slot / 2) * STEP;
    return slot % 2 === 1 ? step : -step;
  }

  /* `key` identifies the label across frames -- a callsign, an airport code.
     Returns the y to draw at. */
  function place(key, x, y, w, h) {
    h = h || 14;
    const top = y - h / 2;

    let mem = memory.get(key);
    if (!mem) {
      mem = { slot: 0, dy: null, seen: now };
      memory.set(key, mem);
    }
    mem.seen = now;

    /* Keep the slot we already had unless it's genuinely taken now. Trying it
       first is what stops the label hunting for a new home every frame. */
    let slot = mem.slot;
    if (clashes(x, top + offsetOf(slot), w, h)) {
      slot = 0;
      while (slot < 10 && clashes(x, top + offsetOf(slot), w, h)) slot++;
      /* Settle for the last slot tried rather than drawing on top of the pile. */
      if (slot >= 10) slot = mem.slot;
    }
    mem.slot = slot;

    const target = offsetOf(slot);
    if (mem.dy === null) mem.dy = target;
    else {
      /* Ease towards the new offset so a bump reads as a nudge, not a jump. */
      const k = Math.min(1, SETTLE > 0 ? 0.016 / SETTLE : 1);
      mem.dy += (target - mem.dy) * Math.min(1, k * 4);
      if (Math.abs(target - mem.dy) < 0.4) mem.dy = target;
    }

    placed.push({ x: x, y: top + target, w: w, h: h });
    return top + mem.dy + h / 2;
  }

  function reset() {
    memory.clear();
    placed = [];
  }

  return { begin: begin, place: place, reset: reset };
})();
