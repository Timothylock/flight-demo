/* The radar scope: range rings and the sweeping line, anchored between SEA and
   PAE. It stays on through the whole piece, including the world view -- it's
   the instrument you're looking through, so it never scales away. */

const Radar = (function () {

  let angle = 0;

  function update(dt) {
    angle += (Math.PI * 2) * dt / CONFIG.RADAR.sweepSeconds;
    if (angle > Math.PI * 2) angle -= Math.PI * 2;
  }

  function center() {
    return Camera.projectWrapped(CONFIG.RADAR.center.lat, CONFIG.RADAR.center.lon);
  }

  function draw(ctx, opacity) {
    if (opacity <= 0.004) return;

    const c = center();
    const R = Math.min(Camera.width, Camera.height) * CONFIG.RADAR.radiusFraction;

    ctx.save();
    ctx.translate(c.x, c.y);

    /* Range rings. */
    ctx.strokeStyle = CONFIG.COLORS.ring;
    ctx.lineWidth = 1;
    for (let i = 1; i <= CONFIG.RADAR.rings; i++) {
      ctx.globalAlpha = opacity * (i === CONFIG.RADAR.rings ? 0.13 : 0.07);
      ctx.beginPath();
      ctx.arc(0, 0, R * i / CONFIG.RADAR.rings, 0, Math.PI * 2);
      ctx.stroke();
    }

    /* Crosshairs and bearing ticks around the outer ring. */
    ctx.globalAlpha = opacity * 0.07;
    ctx.beginPath();
    ctx.moveTo(-R, 0); ctx.lineTo(R, 0);
    ctx.moveTo(0, -R); ctx.lineTo(0, R);
    ctx.stroke();

    ctx.globalAlpha = opacity * 0.16;
    for (let d = 0; d < 360; d += 15) {
      const a = d * Math.PI / 180;
      const inner = d % 45 === 0 ? R - 14 : R - 7;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.stroke();
    }

    /* The sweep. Built from a stack of thin wedges so the trail fades behind
       the leading edge -- a conic gradient would do it in one call but isn't
       reliable everywhere, and this is cheap. */
    const tail = CONFIG.RADAR.sweepTailDegrees * Math.PI / 180;
    const steps = 48;
    /* Fade the wedge out towards its far edge as well as behind the leading
       edge -- a slice of even brightness all the way to the rim looks like a
       shape sitting on the map instead of a beam passing over it. */
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.28)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    for (let i = 0; i < steps; i++) {
      const t0 = angle - tail * (i + 1) / steps;
      const t1 = angle - tail * i / steps + 0.004;   // overlap hides banding
      const fade = 1 - i / steps;
      ctx.globalAlpha = opacity * 0.13 * fade * fade;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, t0, t1);
      ctx.closePath();
      ctx.fill();
    }

    /* Leading edge. */
    ctx.globalAlpha = opacity * 0.42;
    ctx.strokeStyle = CONFIG.COLORS.sweep;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * R, Math.sin(angle) * R);
    ctx.stroke();

    ctx.restore();
  }

  function reset() {
    angle = 0;
  }

  return { update: update, draw: draw, reset: reset, angleNow: function () { return angle; } };
})();
