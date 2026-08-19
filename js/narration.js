/* Lines of text carried through the sequence, rather than one card at the end.

   Each beat can be pinned to the clock, to a place being reached, or both --
   `after: 'YYZ'` means the line about Toronto cannot appear until a flight has
   actually landed in Toronto, however the route data changes underneath it. So
   the words stay with the picture even if the flights are re-generated.

   Beats live as their own DOM nodes stacked in one spot, each with its own
   opacity, so one can fade up while the last is still fading down. */

const Narration = (function () {

  const FADE = 1.0;          // seconds to fade a line in or out
  let beats = [];

  function build() {
    const host = document.getElementById('narration');
    if (!host) return;
    host.innerHTML = '';
    beats = (CONFIG.NARRATION || []).map(function (spec) {
      const el = document.createElement('div');
      el.className = 'narration-beat';

      const one = document.createElement('div');
      one.className = 'narration-line1';
      one.textContent = spec.line1 || '';
      el.appendChild(one);

      if (spec.line2) {
        const two = document.createElement('div');
        two.className = 'narration-line2';
        two.textContent = spec.line2;
        el.appendChild(two);
      }
      host.appendChild(el);
      return { spec: spec, el: el, shown: -1 };
    });
  }

  const GAP = 0.7;           // breath between one line leaving and the next arriving
  const MIN_HOLD = 2.6;      // never squeeze a line below this

  /* Work out when every beat runs.

     Beats play strictly in the order they're written. Each waits for its own
     cue -- a time, a place being reached, or the later of the two -- but also
     for the previous line to have cleared, because two anchored to places
     reached minutes apart will otherwise overlap or run backwards.

     If that pushes the last line past the title card, the holds are squeezed
     proportionally rather than letting the ending collide. */
  function schedule() {
    const SEQ = CONFIG.SEQUENCE_SECONDS;
    const reached = Flights.reachedAt();
    const out = [];
    let prevEnd = -Infinity;

    for (let i = 0; i < beats.length; i++) {
      const spec = beats[i].spec;
      let start = (spec.at || 0) * SEQ;
      if (spec.after && reached && reached[spec.after] !== undefined) {
        start = Math.max(start, reached[spec.after] +
                                (spec.delay === undefined ? 0.6 : spec.delay));
      }
      start = Math.max(start, prevEnd + GAP);
      const hold = spec.hold === undefined ? 6 : spec.hold;
      out.push({ start: start, hold: hold });
      prevEnd = start + FADE + hold + FADE;
    }

    const titleAt = CONFIG.BEATS.titleFadeIn[0] * SEQ;
    const over = prevEnd - titleAt;
    if (over > 0) {
      /* Take the overrun out of the holds, sharing it by how much each has to
         give above the floor. */
      let slack = 0;
      out.forEach(function (b) { slack += Math.max(0, b.hold - MIN_HOLD); });
      if (slack > 0) {
        const cut = Math.min(1, over / slack);
        let shift = 0;
        out.forEach(function (b) {
          b.start -= shift;
          const give = Math.max(0, b.hold - MIN_HOLD) * cut;
          b.hold -= give;
          shift += give;
        });
      }
    }
    return out;
  }

  function update(t, master) {
    if (!beats.length) return;
    const timing = schedule();

    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      const start = timing[i].start;
      const hold = timing[i].hold;
      const dt = t - start;

      let a = 0;
      if (dt > 0 && dt < FADE) a = dt / FADE;
      else if (dt >= FADE && dt <= FADE + hold) a = 1;
      else if (dt > FADE + hold && dt < FADE + hold + FADE) a = 1 - (dt - FADE - hold) / FADE;

      a *= master;
      if (a !== b.shown) {
        b.el.style.opacity = a;
        b.shown = a;
      }
    }
  }

  function clear() {
    for (let i = 0; i < beats.length; i++) {
      beats[i].el.style.opacity = 0;
      beats[i].shown = 0;
    }
  }

  return { build: build, update: update, clear: clear, schedule: schedule };
})();
