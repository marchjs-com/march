// The force simulation of NetworkGraph (no DOM): many-body charge, link springs, a pull to the middle, collision, and
// the circle / grid layouts as targets the nodes glide to. Velocity Verlet with a cooling `alpha`, after d3-force.
// It only steps when told to: the graph drives it from the engine clock (onFrame), or runs it to rest at once.

/** A node of the simulation. `fx` / `fy` pin it (dragged nodes). `tx` / `ty`: its target in a circle / grid layout. */
export interface SimNode { id: string; x: number; y: number; vx: number; vy: number; r: number; fx?: number | null; fy?: number | null; tx?: number; ty?: number }
export interface SimLink { s: SimNode; t: SimNode; w: number }
export interface SimParams { mode: "force" | "circle" | "grid"; charge: number; distance: number; strength: number | null; center: number; collide: number | null }

const ALPHA_MIN = 0.002, DECAY = 1 - Math.pow(ALPHA_MIN, 1 / 280), FRICTION = 0.42;

export interface Sim {
  nodes: SimNode[];
  links: SimLink[];
  alpha: number;
  target: number;
  /** One step; returns false once the layout has come to rest. */
  tick(): boolean;
  /** Steps until rest (at most `max`). */
  settle(max?: number): void;
}

export function simulation(nodes: SimNode[], links: SimLink[], p: SimParams): Sim {
  const count = new Map<SimNode, number>();
  for (const l of links) { count.set(l.s, (count.get(l.s) ?? 0) + 1); count.set(l.t, (count.get(l.t) ?? 0) + 1); }
  const bias = links.map((l) => (count.get(l.s) ?? 1) / ((count.get(l.s) ?? 1) + (count.get(l.t) ?? 1)));
  const str = links.map((l) => (p.strength ?? 1) / Math.min(count.get(l.s) ?? 1, count.get(l.t) ?? 1));
  let jig = 1;
  const jiggle = (): number => ((jig = (jig * 9301 + 49297) % 233280) / 233280 - 0.5) * 1e-6;

  const sim: Sim = {
    nodes, links, alpha: 1, target: 0,
    tick() {
      sim.alpha += (sim.target - sim.alpha) * DECAY;
      const a = sim.alpha, n = nodes.length;
      if (p.mode !== "force") {
        let moving = 0;
        for (const d of nodes) {
          if (d.fx != null) { d.x = d.fx; d.y = d.fy ?? d.y; continue; }
          const dx = (d.tx ?? 0) - d.x, dy = (d.ty ?? 0) - d.y;
          d.x += dx * 0.16; d.y += dy * 0.16; d.vx = d.vy = 0;
          moving = Math.max(moving, Math.abs(dx), Math.abs(dy));
        }
        if (moving < 0.3) { for (const d of nodes) if (d.fx == null) { d.x = d.tx ?? d.x; d.y = d.ty ?? d.y; } return false; }
        return true;
      }
      // links (springs towards `distance`)
      links.forEach((l, i) => {
        const s = l.s, t = l.t;
        let x = t.x + t.vx - s.x - s.vx || jiggle(), y = t.y + t.vy - s.y - s.vy || jiggle();
        let len = Math.sqrt(x * x + y * y);
        len = ((len - p.distance) / len) * a * (str[i] as number) * (0.6 + 0.4 * Math.min(2, l.w));
        x *= len; y *= len;
        const b = bias[i] as number;
        t.vx -= x * b; t.vy -= y * b; s.vx += x * (1 - b); s.vy += y * (1 - b);
      });
      // charge (every pair) and collision
      const pad = p.collide;
      for (let i = 0; i < n; i++) {
        const q = nodes[i] as SimNode;
        for (let j = i + 1; j < n; j++) {
          const o = nodes[j] as SimNode;
          let x = o.x - q.x, y = o.y - q.y, l = x * x + y * y;
          if (l < 1e-6) { x = jiggle(); y = jiggle(); l = x * x + y * y; }
          const w = (p.charge * a) / Math.max(l, 1);
          q.vx += x * w; q.vy += y * w; o.vx -= x * w; o.vy -= y * w;
          if (pad != null) {
            const r = q.r + o.r + pad;
            if (l < r * r) {
              const d = Math.sqrt(l), k = ((r - d) / d) * 0.35;
              q.vx -= x * k; q.vy -= y * k; o.vx += x * k; o.vy += y * k;
            }
          }
        }
      }
      // pull to the middle (each axis), then move
      let mx = 0, my = 0;
      for (const d of nodes) { d.vx -= d.x * p.center * a; d.vy -= d.y * p.center * a; }
      for (const d of nodes) {
        if (d.fx != null) { d.x = d.fx; d.y = d.fy ?? d.y; d.vx = d.vy = 0; } else { d.vx *= 1 - FRICTION; d.vy *= 1 - FRICTION; d.x += d.vx; d.y += d.vy; }
        mx += d.x; my += d.y;
      }
      // keep the centre of mass in the middle (a pinned node holds the frame still)
      if (n && !nodes.some((d) => d.fx != null)) { mx /= n; my /= n; for (const d of nodes) { d.x -= mx * 0.1; d.y -= my * 0.1; } }
      return sim.alpha >= ALPHA_MIN || sim.target > 0;
    },
    settle(max = 320) { for (let i = 0; i < max && sim.tick(); i++); },
  };
  return sim;
}

/** Targets of the circle (grouped around a ring) and grid layouts, centred on 0,0 inside `w` × `h`. */
export function placeTargets(nodes: readonly SimNode[], mode: "circle" | "grid", w: number, h: number): void {
  const n = nodes.length;
  if (!n) return;
  if (mode === "circle") {
    const R = Math.max(30, Math.min(w, h) / 2 - 40);
    nodes.forEach((d, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; d.tx = R * Math.cos(a); d.ty = R * Math.sin(a); });
    return;
  }
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * w) / Math.max(1, h)))), rows = Math.ceil(n / cols);
  const cell = Math.min((w - 60) / cols, (h - 60) / Math.max(1, rows - 0.4), 90);
  nodes.forEach((d, i) => { d.tx = ((i % cols) - (cols - 1) / 2) * cell; d.ty = (Math.floor(i / cols) - (rows - 1) / 2) * cell; });
}
