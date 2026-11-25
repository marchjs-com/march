// The custom shape library: 40 shapes drawn for March (arrows, hearts, stars, speech bubbles, marks, ornaments,
// frames, weather, nature) as PathData in a 100 × 100 box. Written with a tiny path notation (M / L / C / Q / Z,
// absolute) read by our own parser, plus circles, ellipses and stars from helpers. Shapes with holes use evenodd;
// a crescent uses a subtract subpath (the shape renderer evaluates subpath ops).

import { anchor, flatten, signedArea, transformPath, type Anchor, type PathData, type SubPath } from "../paths.ts";

export type ShapeCategory = "arrows" | "hearts" | "stars" | "bubbles" | "marks" | "ornaments" | "frames" | "weather" | "nature";
export interface CustomShape { id: string; name: string; category: ShapeCategory; path: PathData }

/** Read "M x y L x y C x1 y1 x2 y2 x y Q x1 y1 x y Z" (absolute commands only) into subpaths. */
export function parsePathNotation(d: string): SubPath[] {
  const tok = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const subs: SubPath[] = [];
  let cur: Anchor[] | null = null, i = 0, cmd = "";
  const num = (): number => Number(tok[i++]);
  const close = (closed: boolean): void => {
    if (!cur || !cur.length) { cur = null; return; }
    if (closed && cur.length > 1) {
      const a = cur[0]!, b = cur[cur.length - 1]!;
      if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) { a.ix = b.ix; a.iy = b.iy; cur.pop(); }
    }
    subs.push({ closed, anchors: cur });
    cur = null;
  };
  while (i < tok.length) {
    const t = tok[i]!;
    if (/[MLCQZ]/i.test(t)) { cmd = t.toUpperCase(); i++; }
    if (cmd === "Z") { close(true); cmd = ""; continue; }
    if (cmd === "M") { close(false); cur = [anchor(num(), num())]; cmd = "L"; continue; }
    if (!cur) cur = [anchor(0, 0)];
    const last = cur[cur.length - 1]!;
    if (cmd === "L") cur.push(anchor(num(), num()));
    else if (cmd === "C") {
      const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
      last.ox = x1; last.oy = y1;
      cur.push({ x, y, ix: x2, iy: y2, ox: x, oy: y, type: "corner" });
    } else if (cmd === "Q") {
      const qx = num(), qy = num(), x = num(), y = num();
      last.ox = last.x + (2 / 3) * (qx - last.x); last.oy = last.y + (2 / 3) * (qy - last.y);
      cur.push({ x, y, ix: x + (2 / 3) * (qx - x), iy: y + (2 / 3) * (qy - y), ox: x, oy: y, type: "corner" });
    } else i++;
  }
  close(false);
  return subs;
}

/** Reverse a subpath's direction (handles swap sides). */
export function reverseSubpath(sp: SubPath): SubPath {
  return { ...sp, anchors: sp.anchors.slice().reverse().map((a) => ({ ...a, ix: a.ox, iy: a.oy, ox: a.ix, oy: a.iy })) };
}

/** Make every subpath wind the same way (so nonzero fills their union). */
function union(subs: SubPath[]): SubPath[] {
  return subs.map((s) => (signedArea(flatten(s, 1)) < 0 ? reverseSubpath(s) : s));
}

const K = 0.5522847498;
function ellipseSub(cx: number, cy: number, rx: number, ry: number): SubPath {
  const pts: [number, number, number, number][] = [[cx, cy - ry, rx * K, 0], [cx + rx, cy, 0, ry * K], [cx, cy + ry, -rx * K, 0], [cx - rx, cy, 0, -ry * K]];
  return { closed: true, anchors: pts.map(([x, y, dx, dy]) => ({ x, y, ix: x - dx, iy: y - dy, ox: x + dx, oy: y + dy, type: "symmetric" as const })) };
}
const circle = (cx: number, cy: number, r: number): SubPath => ellipseSub(cx, cy, r, r);

function starSub(cx: number, cy: number, r: number, points: number, inner: number, rot = 0): SubPath {
  const a: Anchor[] = [];
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 ? r * inner : r, t = rot - Math.PI / 2 + (i * Math.PI) / points;
    a.push(anchor(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad));
  }
  return { closed: true, anchors: a };
}

/** Rotate subpaths about (50, 50) by degrees. */
function rot(subs: SubPath[], deg: number, cx = 50, cy = 50): SubPath[] {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return transformPath({ subpaths: subs }, [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]).subpaths;
}
const mirrorX = (subs: SubPath[]): SubPath[] => transformPath({ subpaths: subs }, [-1, 0, 0, 1, 100, 0]).subpaths;
const P = parsePathNotation;

const ARROW = "M0 35 L60 35 L60 15 L100 50 L60 85 L60 65 L0 65 Z";
const HEART = "M50 92 C20 70 0 52 0 30 C0 12 14 0 30 0 C40 0 47 6 50 14 C53 6 60 0 70 0 C86 0 100 12 100 30 C100 52 80 70 50 92 Z";
const PETAL = "M50 0 C65 20 65 45 50 60 C35 45 35 20 50 0 Z";
const SIDE = "M50 60 C30 30 5 35 5 55 C5 70 25 75 50 60 Z";

function build(): CustomShape[] {
  const S = (id: string, name: string, category: ShapeCategory, subpaths: SubPath[], fillRule: "nonzero" | "evenodd" = "nonzero"): CustomShape =>
    ({ id, name, category, path: { subpaths, fillRule } });
  const heartInner = transformPath({ subpaths: P(HEART) }, [0.6, 0, 0, 0.6, 20, 14]).subpaths;
  const scallop: Anchor[] = [];
  for (let i = 0; i < 64; i++) { const t = (i / 64) * Math.PI * 2, r = 47 + 3 * Math.cos(t * 16); scallop.push(anchor(50 + Math.cos(t) * r, 50 + Math.sin(t) * r)); }
  const rays: SubPath[] = [];
  for (let i = 0; i < 8; i++) rays.push(...rot(P("M46 22 L50 4 L54 22 Z"), i * 45));
  const bars: SubPath[] = [];
  for (let i = 0; i < 3; i++) bars.push(...rot(P("M46 4 L54 4 L54 96 L46 96 Z M50 14 L62 4 L66 9 L50 24 Z M50 14 L38 4 L34 9 L50 24 Z M50 86 L62 96 L66 91 L50 76 Z M50 86 L38 96 L34 91 L50 76 Z"), i * 60));
  const petals: SubPath[] = [];
  for (let i = 0; i < 5; i++) petals.push(...rot([ellipseSub(50, 24, 13, 22)], i * 72));
  const moon = [circle(45, 50, 45), { ...circle(66, 40, 38), op: "subtract" as const }];
  return [
    // arrows
    S("arrow-right", "Arrow Right", "arrows", P(ARROW)),
    S("arrow-left", "Arrow Left", "arrows", mirrorX(P(ARROW))),
    S("arrow-up", "Arrow Up", "arrows", rot(P(ARROW), -90)),
    S("arrow-down", "Arrow Down", "arrows", rot(P(ARROW), 90)),
    S("arrow-double", "Double Arrow", "arrows", P("M0 50 L25 20 L25 38 L75 38 L75 20 L100 50 L75 80 L75 62 L25 62 L25 80 Z")),
    S("chevron", "Chevron", "arrows", P("M10 0 L50 0 L90 50 L50 100 L10 100 L50 50 Z")),
    S("arrow-bent", "Bent Arrow", "arrows", P("M10 100 L10 55 C10 30 30 20 55 20 L55 0 L95 35 L55 70 L55 50 C40 50 35 55 35 70 L35 100 Z")),
    // hearts
    S("heart", "Heart", "hearts", P(HEART)),
    S("heart-outline", "Heart Outline", "hearts", [...P(HEART), ...heartInner], "evenodd"),
    S("hearts-two", "Two Hearts", "hearts", union([...transformPath({ subpaths: P(HEART) }, [0.6, 0, 0, 0.6, 0, 10]).subpaths, ...transformPath({ subpaths: P(HEART) }, [0.6, 0, 0, 0.6, 40, 30]).subpaths])),
    // stars
    S("star-5", "Star", "stars", [starSub(50, 52, 50, 5, 0.42)]),
    S("star-6", "Six-Point Star", "stars", [starSub(50, 50, 50, 6, 0.55)]),
    S("star-8", "Eight-Point Star", "stars", [starSub(50, 50, 50, 8, 0.45)]),
    S("burst", "Burst", "stars", [starSub(50, 50, 50, 16, 0.75)]),
    S("sparkle", "Sparkle", "stars", P("M50 0 C53 35 65 47 100 50 C65 53 53 65 50 100 C47 65 35 53 0 50 C35 47 47 35 50 0 Z")),
    // speech bubbles
    S("bubble-round", "Round Bubble", "bubbles", P("M50 5 C78 5 100 22 100 42 C100 62 78 79 50 79 C45 79 40 78 35 77 L12 95 L18 72 C6 64 0 54 0 42 C0 22 22 5 50 5 Z")),
    S("bubble-square", "Square Bubble", "bubbles", P("M5 5 L95 5 L95 70 L45 70 L20 95 L25 70 L5 70 Z")),
    S("bubble-thought", "Thought Bubble", "bubbles", union([circle(30, 40, 22), circle(55, 30, 28), circle(78, 45, 20), circle(50, 55, 22), circle(20, 80, 7), circle(9, 93, 4)])),
    // marks
    S("check", "Check Mark", "marks", P("M5 55 L20 40 L38 58 L82 12 L97 27 L38 88 Z")),
    S("cross", "Cross", "marks", P("M20 5 L50 35 L80 5 L95 20 L65 50 L95 80 L80 95 L50 65 L20 95 L5 80 L35 50 L5 20 Z")),
    S("plus", "Plus", "marks", P("M35 0 L65 0 L65 35 L100 35 L100 65 L65 65 L65 100 L35 100 L35 65 L0 65 L0 35 L35 35 Z")),
    S("check-circle", "Check Circle", "marks", [circle(50, 50, 50), ...transformPath({ subpaths: P("M5 55 L20 40 L38 58 L82 12 L97 27 L38 88 Z") }, [0.6, 0, 0, 0.6, 20, 20]).subpaths], "evenodd"),
    // ornaments
    S("quatrefoil", "Quatrefoil", "ornaments", union([circle(50, 27, 23), circle(73, 50, 23), circle(50, 73, 23), circle(27, 50, 23), ...P("M30 30 L70 30 L70 70 L30 70 Z")])),
    S("diamond-frame", "Diamond Ornament", "ornaments", P("M50 0 L100 50 L50 100 L0 50 Z M50 25 L75 50 L50 75 L25 50 Z"), "evenodd"),
    S("scroll", "Scroll", "ornaments", P("M5 70 C5 35 35 25 50 50 C65 75 95 65 95 30 L85 30 C85 55 68 62 58 45 C42 18 15 30 15 70 Z")),
    S("fleuron", "Fleuron", "ornaments", union([...P(PETAL), ...P(SIDE), ...mirrorX(P(SIDE)), ...P("M44 58 L56 58 L54 100 L46 100 Z")])),
    S("knot", "Knot", "ornaments", [circle(35, 50, 30), circle(65, 50, 30), circle(35, 50, 20), circle(65, 50, 20)], "evenodd"),
    // frames
    S("frame-square", "Square Frame", "frames", P("M0 0 L100 0 L100 100 L0 100 Z M12 12 L88 12 L88 88 L12 88 Z"), "evenodd"),
    S("frame-round", "Round Frame", "frames", [circle(50, 50, 50), circle(50, 50, 40)], "evenodd"),
    S("frame-scalloped", "Scalloped Frame", "frames", [{ closed: true, anchors: scallop }, circle(50, 50, 38)], "evenodd"),
    S("banner", "Banner", "frames", P("M0 20 L100 20 L85 50 L100 80 L0 80 L15 50 Z")),
    S("tag", "Tag", "frames", [...P("M0 20 L70 20 L100 50 L70 80 L0 80 Z"), circle(72, 50, 6)], "evenodd"),
    // weather
    S("sun", "Sun", "weather", union([circle(50, 50, 22), ...rays])),
    S("cloud", "Cloud", "weather", union([circle(25, 62, 17), circle(48, 48, 24), circle(73, 60, 18), ...P("M25 60 L73 60 L73 78 L25 78 Z")])),
    S("raindrop", "Raindrop", "weather", P("M50 0 C50 0 85 45 85 65 C85 85 69 100 50 100 C31 100 15 85 15 65 C15 45 50 0 50 0 Z")),
    S("lightning", "Lightning", "weather", P("M60 0 L20 55 L45 55 L35 100 L80 40 L55 40 L70 0 Z")),
    S("snowflake", "Snowflake", "weather", union(bars)),
    S("moon", "Crescent Moon", "weather", moon),
    S("umbrella", "Umbrella", "weather", union(P("M5 50 C5 20 30 5 50 5 C70 5 95 20 95 50 C88 44 80 44 72 50 C65 44 57 44 50 50 C43 44 35 44 28 50 C20 44 12 44 5 50 Z M47 49 L53 49 L53 88 C53 99 36 99 36 88 L42 88 C42 92 47 92 47 88 Z"))),
    // nature
    S("leaf", "Leaf", "nature", P("M10 90 C10 40 40 10 95 5 C90 60 60 90 10 90 Z")),
    S("tree", "Tree", "nature", P("M50 0 L80 35 L65 35 L90 65 L58 65 L58 100 L42 100 L42 65 L10 65 L35 35 L20 35 Z")),
    S("flower", "Flower", "nature", union([...petals, circle(50, 50, 14)])),
    S("mountain", "Mountains", "nature", P("M0 100 L35 30 L50 55 L65 20 L100 100 Z")),
    S("wave", "Wave", "nature", P("M0 60 C15 40 35 40 50 60 C65 80 85 80 100 60 L100 100 L0 100 Z")),
    S("paw", "Paw Print", "nature", union([ellipseSub(50, 68, 22, 18), ellipseSub(22, 42, 9, 12), ellipseSub(40, 24, 9, 12), ellipseSub(60, 24, 9, 12), ellipseSub(78, 42, 9, 12)])),
  ];
}

let library: CustomShape[] | null = null;
const extra: CustomShape[] = [];

/** Every custom shape (built-ins and added ones). */
export function customShapes(category?: ShapeCategory): CustomShape[] {
  library ??= build();
  const all = [...library, ...extra];
  return category ? all.filter((s) => s.category === category) : all;
}

/** Add shapes (plugins, "Define Custom Shape" from a path: pass it in a 100 × 100 box or any box, it is normalized). */
export function addCustomShape(s: CustomShape): () => void {
  extra.push(s);
  return () => { const i = extra.indexOf(s); if (i >= 0) extra.splice(i, 1); };
}

/** A custom shape fitted into a box, or null for an unknown id. */
export function customShapePath(id: string, x: number, y: number, w: number, h: number): PathData | null {
  const s = customShapes().find((c) => c.id === id);
  if (!s) return null;
  const out = transformPath(s.path, [w / 100, 0, 0, h / 100, x, y]);
  // a flip (negative w or h) reverses the winding: subtract / evenodd still work, nonzero unions too
  return out;
}
