/* The score.

   One track, started by the same key press that starts the sequence -- which
   is what makes it legal: browsers only allow audio to begin inside a user
   gesture, and space (or a tap) is one.

   It runs against its own clock rather than the sequence's. CONFIG.MUSIC.stopAt
   is a wall-clock time from the moment of the press, so "stops at 2:25" means
   exactly that whatever the frame rate does, and the fade is worked out from
   audio.currentTime, which cannot drift from what is being heard.

   The file is longer than the piece, so the ending you hear is the fade rather
   than the track's own; raise stopAt and it simply plays more of it. */

const Music = (function () {

  let el = null;
  let playing = false;

  function element() {
    if (el) return el;
    const M = CONFIG.MUSIC;
    if (!M || !M.file) return null;
    el = new Audio();
    el.src = M.file;
    el.preload = 'auto';
    el.loop = false;
    el.volume = 0;
    return el;
  }

  /* Called from the press. Always restarts from the top, so a second run is a
     second run rather than a resumption. */
  function start() {
    const a = element();
    if (!a) return;
    try { a.currentTime = 0; } catch (err) { /* not seekable yet; play anyway */ }
    a.volume = 0;
    playing = true;
    /* play() rejects if the gesture wasn't recognised -- fail quiet, the piece
       still works in silence. */
    const p = a.play();
    if (p && p.catch) p.catch(function () { playing = false; });
  }

  function stop() {
    if (!el) return;
    playing = false;
    el.pause();
    try { el.currentTime = 0; } catch (err) { /* ignore */ }
    el.volume = 0;
  }

  /* Volume envelope, driven by where the track actually is. */
  function update() {
    if (!playing || !el) return;
    const M = CONFIG.MUSIC;
    const t = el.currentTime;

    if (t >= M.stopAt) { stop(); return; }

    let v = M.volume;
    if (t < M.fadeIn) v *= t / M.fadeIn;
    const left = M.stopAt - t;
    if (left < M.fadeOut) v *= left / M.fadeOut;
    el.volume = Math.max(0, Math.min(1, v));
  }

  /* For checking on the thing without guessing: whether it is running, where
     the track is, and what it is actually being played at. */
  function state() {
    return {
      playing: playing,
      t: el ? el.currentTime : 0,
      volume: el ? el.volume : 0,
      ready: !!el && el.readyState >= 2
    };
  }

  return { start: start, stop: stop, update: update, state: state };
})();
