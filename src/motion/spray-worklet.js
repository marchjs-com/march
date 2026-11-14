// The spray of themeWave({ shape: "spray" }): a CSS Paint worklet (CSS.paintWorklet) drawing the mask of the veil
// that holds the old look: the whole veil, minus the paint sprayed so far. Plain JavaScript run in the worklet scope
// (no imports): serve this file from your own origin (CSP script-src 'self') and give its address to themeWave /
// installThemeWave ({ worklet: "/spray-worklet.js" }).
// The spray grows from a point: a dense core, around it a mist of fine specks that thins out with the distance, a few
// irregular splats flying further, and drips running down from the core. Every speck has its fixed place (a seeded
// sequence): it appears when the spray reaches it and stays. Inputs (custom properties on the veil):
//   --m-spray-t     0 → 1, the wave's progress (a registered <number>, animated)
//   --m-spray-x/y   where the spray starts, px
//   --m-spray-seed  a number: another seed, another spray
/* global registerPaint */

const num = (props, name, def) => { const v = parseFloat(String(props.get(name))); return Number.isFinite(v) ? v : def; };
/** A small seeded random sequence (mulberry32). */
const seq = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ease = (p) => 1 - (1 - p) ** 2;

registerPaint("m-spray", class {
  static get inputProperties() { return ["--m-spray-t", "--m-spray-x", "--m-spray-y", "--m-spray-seed"]; }
  paint(ctx, size, props) {
    const w = size.width, h = size.height;
    const t = Math.min(1, Math.max(0, num(props, "--m-spray-t", 0)));
    const ox = num(props, "--m-spray-x", w / 2), oy = num(props, "--m-spray-y", h / 2), seed = num(props, "--m-spray-seed", 1) | 0;
    // the veil: whole, then the paint taken out of it
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (t <= 0) return;
    if (t >= 1) { ctx.clearRect(0, 0, w, h); return; }
    ctx.globalCompositeOperation = "destination-out";
    const far = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy));
    // the front of the mist and the dense core behind it: both grow steadily; at the end the core covers everything
    const front = far * 1.3 * t ** 0.85, core = Math.max(0, front * (0.5 + 0.5 * t) - far * 0.03);
    ctx.fillStyle = "#000";
    const rnd = seq(seed);
    if (core > 0) {
      // the core is not a clean circle: its edge swells and dips a little (the dense specks just outside roughen it)
      const p1 = rnd() * 6.3, p2 = rnd() * 6.3, p3 = rnd() * 6.3;
      ctx.beginPath();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2, r = core * (1 + 0.045 * Math.sin(3 * a + p1) + 0.03 * Math.sin(7 * a + p2) + 0.015 * Math.sin(13 * a + p3));
        if (i) ctx.lineTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r); else ctx.moveTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
      }
      ctx.fill();
    }
    // the mist: every speck has a fixed place and shows once the band between the core and the front passes it,
    // many near the core, fewer towards the front (its "gate": how far into the band it needs the core to be)
    const band = Math.max(1, front - core);
    const specks = Math.round(Math.min(32000, (w * h) / 40));
    for (let i = 0; i < specks; i++) {
      const a = rnd() * Math.PI * 2, d = far * 1.25 * Math.sqrt(rnd()), gate = rnd(), s = rnd();
      if (d <= core * 0.9 || d > front) continue;
      if ((d - core) / band > gate * gate) continue;
      const x = ox + Math.cos(a) * d, y = oy + Math.sin(a) * d;
      if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
      // mostly fine, some larger, a few heavy drops
      const r = s < 0.86 ? 0.5 + 0.9 * s : s < 0.985 ? 1.3 + (s - 0.86) * 18 : 3.5 + 4 * rnd();
      if (r < 1.5) ctx.fillRect(x - r, y - r, r * 2, r * 2);
      else { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    }
    // splats: a few heavy irregular drops thrown out further
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2, d = far * (0.3 + 0.9 * rnd()), at = 0.15 + 0.6 * rnd(), r = 4 + 10 * rnd() ** 2;
      if (d * 0.9 > front || t < at) continue;
      const x = ox + Math.cos(a) * d, y = oy + Math.sin(a) * d;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.6 + 0.6 * rnd()), a, 0, Math.PI * 2); ctx.fill();
      // a tail away from the start
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.6, r * 0.45, r * 0.3, a, 0, Math.PI * 2); ctx.fill();
    }
    // drips: paint gathering at the lower edge of the core runs down
    for (let i = 0; i < 5; i++) {
      const off = (rnd() - 0.5) * 1.2, start = 0.2 + 0.3 * rnd(), speed = 0.6 + 0.8 * rnd(), width = 3 + 6 * rnd();
      if (t < start || core <= 0) continue;
      const x = ox + off * core * 0.8, top = oy + Math.sqrt(Math.max(0, 1 - off * off * 0.64)) * core * 0.8;
      const len = h * 0.5 * speed * ease(Math.min(1, (t - start) / 0.5));
      ctx.fillRect(x - width / 2, top - width, width, len + width);
      ctx.beginPath(); ctx.ellipse(x, top + len, width * 0.9, width * 1.15, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
});
