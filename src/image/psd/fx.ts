// Descriptor ↔ model conversions shared by layer styles (lfx2), fill layers (SoCo, GdFl, PtFl) and shape layers:
// colors, gradients, patterns, contours and the ten effects.

import type { BlendMode } from "../doc/blend.ts";
import type { Gradient, Paint, Pattern, RGBA } from "../doc/layers.ts";
import type { BevelFx, Contour, GlowFx, LayerStyle, OverlayFx, SatinFx, ShadowFx, StrokeFx } from "../doc/styles.ts";
import { bool, desc, doub, en, enm, flag, items, list, long, num, obj, str, sub, text, unit, type DItem, type Descriptor } from "./descriptor.ts";
import { BLEND_ENUMS, BLEND_FROM_ENUM } from "./maps.ts";

// ——— colors ———

export function colorFrom(d: Descriptor | undefined): RGBA {
  if (!d) return [0, 0, 0, 1];
  const c = d.classId;
  if (c === "Grsc") { const g = 1 - num(d, "Gry ") / 100; return [g, g, g, 1]; }
  if (c === "CMYC") {
    const k = 1 - num(d, "Blck") / 100;
    return [(1 - num(d, "Cyn ") / 100) * k, (1 - num(d, "Mgnt") / 100) * k, (1 - num(d, "Ylw ") / 100) * k, 1];
  }
  if (c === "HSBC") {
    const h = (num(d, "H   ") / 360) * 6, s = num(d, "Strt") / 100, v = num(d, "Brgh") / 100;
    const i = Math.floor(h) % 6, f = h - Math.floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
    const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i]!;
    return [rgb[0]!, rgb[1]!, rgb[2]!, 1];
  }
  // RGBC (0–255); newer files may store "redFloat" etc. (0–1)
  if ("redFloat" in d.items) return [num(d, "redFloat"), num(d, "greenFloat"), num(d, "blueFloat"), 1];
  return [num(d, "Rd  ") / 255, num(d, "Grn ") / 255, num(d, "Bl  ") / 255, 1];
}
export const colorItem = (c: RGBA): DItem => obj("RGBC", { "Rd  ": doub(c[0] * 255), "Grn ": doub(c[1] * 255), "Bl  ": doub(c[2] * 255) });

const blendFrom = (d: Descriptor | undefined, key = "Md  "): BlendMode => BLEND_FROM_ENUM[en(d, key, "Nrml")] ?? "normal";
const blendItem = (m: BlendMode): DItem => enm("BlnM", BLEND_ENUMS[m] ?? "Nrml");
const pct = (v: number): DItem => unit("#Prc", v * 100);
const px = (v: number): DItem => unit("#Pxl", v);
const ang = (v: number): DItem => unit("#Ang", v);

// ——— contours ———

export function contourFrom(d: Descriptor | undefined): Contour | undefined {
  if (!d) return undefined;
  const pts = items(d, "Crv ").map((it) => (it.t === "Objc" ? [num(it.v, "Hrzn") / 255, num(it.v, "Vrtc") / 255] as [number, number] : null)).filter((p): p is [number, number] => !!p);
  if (pts.length === 2 && pts[0]![0] === 0 && pts[0]![1] === 0 && pts[1]![0] === 1 && pts[1]![1] === 1) return undefined;
  return pts.length ? pts : undefined;
}
export function contourItem(c: Contour | undefined): DItem {
  const pts = c && c.length ? c : [[0, 0], [1, 1]] as Contour;
  return obj("ShpC", { "Nm  ": text(c ? "Custom" : "Linear"), "Crv ": list(pts.map(([x, y]) => obj("CrPt", { Hrzn: doub(x * 255), Vrtc: doub(y * 255) }))) });
}

// ——— gradients and patterns ———

const GRAD_TYPES: Record<Gradient["type"], string> = { linear: "Lnr ", radial: "Rdl ", angle: "Angl", reflected: "Rflc", diamond: "Dmnd" };
const GRAD_FROM: Record<string, Gradient["type"]> = Object.fromEntries(Object.entries(GRAD_TYPES).map(([k, v]) => [v, k as Gradient["type"]]));

/**
 * A gradient from a descriptor holding Grad / Type / Angl / Scl / Ofst / Rvrs / Dthr. Placement is relative to the
 * layer box: the center moved by Ofst (%), along the angle, Scl (%) of the box.
 */
export function gradientFrom(d: Descriptor | undefined): Gradient {
  const g = sub(d, "Grad");
  const stops = items(g, "Clrs").map((it) => (it.t === "Objc" ? { at: num(it.v, "Lctn") / 4096, color: colorFrom(sub(it.v, "Clr ")) } : null)).filter((s): s is { at: number; color: RGBA } => !!s);
  const alpha = items(g, "Trns").map((it) => (it.t === "Objc" ? { at: num(it.v, "Lctn") / 4096, value: num(it.v, "Opct", 100) / 100 } : null)).filter((s): s is { at: number; value: number } => !!s);
  const type = GRAD_FROM[en(d, "Type", "Lnr ")] ?? "linear";
  const a = (num(d, "Angl", 90) * Math.PI) / 180, s = num(d, "Scl ", 100) / 100;
  const off = sub(d, "Ofst");
  const cx = 0.5 + num(off, "Hrzn") / 100, cy = 0.5 + num(off, "Vrtc") / 100;
  const dx = Math.cos(a) * 0.5 * s, dy = -Math.sin(a) * 0.5 * s;
  const centered = type === "radial" || type === "angle" || type === "reflected" || type === "diamond";
  const out: Gradient = {
    type, stops: stops.length ? stops : [{ at: 0, color: [0, 0, 0, 1] }, { at: 1, color: [1, 1, 1, 1] }],
    from: centered ? [cx, cy] : [cx - dx, cy - dy], to: [cx + dx, cy + dy], relative: true,
    reverse: flag(d, "Rvrs"), dither: flag(d, "Dthr"), smoothness: num(g, "Intr", 4096) / 4096,
  };
  if (alpha.length) out.alpha = alpha;
  return out;
}

/** Items describing a gradient (Grad, Type, Angl, Scl, Rvrs, Dthr, Ofst) for fills, overlays and strokes. */
export function gradientItems(g: Gradient): Record<string, DItem> {
  const centered = g.type !== "linear";
  const [fx, fy] = g.from, [tx, ty] = g.to;
  // positions are relative 0–1 boxes when `relative`; absolute ones keep the angle only
  const cx = centered ? fx : (fx + tx) / 2, cy = centered ? fy : (fy + ty) / 2;
  const len = Math.hypot(tx - fx, ty - fy) * (centered ? 2 : 1);
  const angle = (Math.atan2(-(ty - fy), tx - fx) * 180) / Math.PI;
  const alpha = g.alpha ?? g.stops.map((s) => ({ at: s.at, value: s.color[3] }));
  return {
    Grad: obj("Grdn", {
      "Nm  ": text("Custom"), GrdF: enm("GrdF", "CstS"), Intr: doub((g.smoothness ?? 1) * 4096),
      Clrs: list(g.stops.map((s) => obj("Clrt", { "Clr ": colorItem(s.color), Type: enm("Clry", "UsrS"), Lctn: long(s.at * 4096), Mdpn: long(50) }))),
      Trns: list(alpha.map((s) => obj("TrnS", { Opct: pct(s.value), Lctn: long(s.at * 4096), Mdpn: long(50) }))),
    }),
    Type: enm("GrdT", GRAD_TYPES[g.type]),
    Angl: ang(Math.round(angle * 1000) / 1000),
    "Scl ": pct(g.relative ? Math.max(0.1, len) : 1),
    Rvrs: bool(!!g.reverse), Dthr: bool(!!g.dither), Algn: bool(true),
    Ofst: obj("Pnt ", { Hrzn: pct(g.relative ? cx - 0.5 : 0), Vrtc: pct(g.relative ? cy - 0.5 : 0) }),
  };
}

/** Patterns live in the file's Patt block (not decoded): a gray placeholder tile keeps the reference by id. */
export function patternFrom(d: Descriptor | undefined): Pattern {
  const p = sub(d, "Ptrn");
  return { id: str(p, "Idnt") || "psd-pattern", name: str(p, "Nm  ") || "Pattern", width: 1, height: 1, pixels: new Float32Array([0.5, 0.5, 0.5, 1]) };
}
export const patternItem = (p: Pattern): DItem => obj("Ptrn", { "Nm  ": text(p.name ?? p.id), Idnt: text(p.id) });

// ——— fill layers (SoCo / GdFl / PtFl) ———

export function paintFrom(key: string, d: Descriptor): Paint {
  if (key === "SoCo") return { type: "solid", color: colorFrom(sub(d, "Clr ")) };
  if (key === "GdFl") return { type: "gradient", gradient: gradientFrom(d) };
  return { type: "pattern", pattern: patternFrom(d), scale: num(d, "Scl ", 100) / 100 };
}
export function paintToBlock(p: Paint): { key: string; d: Descriptor } {
  if (p.type === "solid") return { key: "SoCo", d: desc("null", { "Clr ": colorItem(p.color) }) };
  if (p.type === "gradient") return { key: "GdFl", d: desc("null", gradientItems(p.gradient)) };
  return { key: "PtFl", d: desc("null", { Ptrn: patternItem(p.pattern), "Scl ": pct(p.scale), Algn: bool(true) }) };
}

// ——— layer styles (lfx2) ———

function shadowFrom(d: Descriptor): ShadowFx {
  const f: ShadowFx = {
    enabled: flag(d, "enab", true), blend: blendFrom(d), color: colorFrom(sub(d, "Clr ")), opacity: num(d, "Opct", 75) / 100,
    angle: num(d, "lagl", 120), distance: num(d, "Dstn", 5), spread: num(d, "Ckmt") / 100, size: num(d, "blur", 5), globalLight: flag(d, "uglg", true),
  };
  const c = contourFrom(sub(d, "TrnS"));
  if (c) f.contour = c;
  if (num(d, "Nose")) f.noise = num(d, "Nose") / 100;
  if ("layerConceals" in d.items) f.knockout = flag(d, "layerConceals");
  return f;
}
function shadowDesc(cls: string, f: ShadowFx): DItem {
  const it: Record<string, DItem> = {
    enab: bool(f.enabled), "Md  ": blendItem(f.blend), "Clr ": colorItem(f.color), Opct: pct(f.opacity), uglg: bool(f.globalLight ?? true),
    lagl: ang(f.angle), Dstn: px(f.distance), Ckmt: pct(f.spread), blur: px(f.size), Nose: pct(f.noise ?? 0), AntA: bool(false), TrnS: contourItem(f.contour),
  };
  if (cls === "DrSh") it.layerConceals = bool(f.knockout ?? true);
  return obj(cls, it);
}

function glowFrom(d: Descriptor, inner: boolean): GlowFx {
  const hasGrad = !!sub(d, "Grad");
  const f: GlowFx = {
    enabled: flag(d, "enab", true), blend: blendFrom(d), color: hasGrad ? null : colorFrom(sub(d, "Clr ")), opacity: num(d, "Opct", 75) / 100,
    spread: num(d, "Ckmt") / 100, size: num(d, "blur", 5), technique: en(d, "GlwT", "SfBL") === "PrBL" ? "precise" : "softer",
    range: num(d, "Inpr", 50) / 100, jitter: num(d, "ShdN") / 100, noise: num(d, "Nose") / 100,
  };
  if (hasGrad) f.gradient = gradientFrom(d);
  if (inner) f.source = en(d, "glwS", "SrcE") === "SrcC" ? "center" : "edge";
  const c = contourFrom(sub(d, "TrnS"));
  if (c) f.contour = c;
  return f;
}
function glowDesc(cls: string, f: GlowFx, inner: boolean): DItem {
  const it: Record<string, DItem> = {
    enab: bool(f.enabled), "Md  ": blendItem(f.blend),
    ...(f.gradient && !f.color ? { Grad: gradientItems(f.gradient).Grad! } : { "Clr ": colorItem(f.color ?? [1, 1, 1, 1]) }),
    Opct: pct(f.opacity), GlwT: enm("BETE", f.technique === "precise" ? "PrBL" : "SfBL"), Ckmt: pct(f.spread), blur: px(f.size),
    Nose: pct(f.noise ?? 0), ShdN: pct(f.jitter ?? 0), AntA: bool(false), TrnS: contourItem(f.contour), Inpr: pct(f.range ?? 0.5),
  };
  if (inner) it.glwS = enm("IGSr", f.source === "center" ? "SrcC" : "SrcE");
  return obj(cls, it);
}

const BEVEL_STYLE: Record<BevelFx["style"], string> = { inner: "InrB", outer: "OtrB", emboss: "Embs", pillow: "PlEb", stroke: "strokeEmboss" };
const BEVEL_TECH: Record<BevelFx["technique"], string> = { smooth: "SfBL", "chisel-hard": "PrBL", "chisel-soft": "Slmt" };
const inv = <K extends string>(o: Record<K, string>): Record<string, K> => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k as K]));

function bevelFrom(d: Descriptor): BevelFx {
  const f: BevelFx = {
    enabled: flag(d, "enab", true), style: inv(BEVEL_STYLE)[en(d, "bvlS", "InrB")] ?? "inner", technique: inv(BEVEL_TECH)[en(d, "bvlT", "SfBL")] ?? "smooth",
    depth: num(d, "srgR", 100) / 100, direction: en(d, "bvlD", "In  ") === "Out " ? "down" : "up", size: num(d, "blur", 5), soften: num(d, "Sftn"),
    angle: num(d, "lagl", 120), altitude: num(d, "Lald", 30), globalLight: flag(d, "uglg", true),
    highlight: { blend: blendFrom(d, "hglM"), color: colorFrom(sub(d, "hglC")), opacity: num(d, "hglO", 75) / 100 },
    shadow: { blend: blendFrom(d, "sdwM"), color: colorFrom(sub(d, "sdwC")), opacity: num(d, "sdwO", 75) / 100 },
  };
  const c = contourFrom(sub(d, "TrnS"));
  if (c) f.contour = c;
  return f;
}
function bevelDesc(f: BevelFx): DItem {
  return obj("ebbl", {
    enab: bool(f.enabled), hglM: blendItem(f.highlight.blend), hglC: colorItem(f.highlight.color), hglO: pct(f.highlight.opacity),
    sdwM: blendItem(f.shadow.blend), sdwC: colorItem(f.shadow.color), sdwO: pct(f.shadow.opacity),
    bvlT: enm("bvlT", BEVEL_TECH[f.technique]), bvlS: enm("BESl", BEVEL_STYLE[f.style]), uglg: bool(f.globalLight ?? true),
    lagl: ang(f.angle), Lald: ang(f.altitude), srgR: pct(f.depth), blur: px(f.size), bvlD: enm("BESs", f.direction === "down" ? "Out " : "In  "),
    TrnS: contourItem(f.contour), antialiasGloss: bool(false), Sftn: px(f.soften), useShape: bool(false), useTexture: bool(false),
  });
}

function satinFrom(d: Descriptor): SatinFx {
  const f: SatinFx = {
    enabled: flag(d, "enab", true), blend: blendFrom(d), color: colorFrom(sub(d, "Clr ")), opacity: num(d, "Opct", 50) / 100,
    angle: num(d, "lagl", 19), distance: num(d, "Dstn", 11), size: num(d, "blur", 14), invert: flag(d, "Invr", true),
  };
  const c = contourFrom(sub(d, "MpgS"));
  if (c) f.contour = c;
  return f;
}
const satinDesc = (f: SatinFx): DItem => obj("ChFX", {
  enab: bool(f.enabled), "Md  ": blendItem(f.blend), "Clr ": colorItem(f.color), AntA: bool(true), Invr: bool(f.invert), Opct: pct(f.opacity),
  lagl: ang(f.angle), Dstn: px(f.distance), blur: px(f.size), MpgS: contourItem(f.contour),
});

function strokeFrom(d: Descriptor): StrokeFx {
  const pos = en(d, "Styl", "OutF");
  const paint = en(d, "PntT", "SClr");
  return {
    enabled: flag(d, "enab", true), size: num(d, "Sz  ", 3), position: pos === "InsF" ? "inside" : pos === "CtrF" ? "center" : "outside",
    blend: blendFrom(d), opacity: num(d, "Opct", 100) / 100,
    fill: paint === "GrFl" ? { type: "gradient", gradient: gradientFrom(d) } : paint === "Ptrn" ? { type: "pattern", pattern: patternFrom(d), scale: num(d, "Scl ", 100) / 100 } : { type: "color", color: colorFrom(sub(d, "Clr ")) },
  };
}
function strokeDesc(f: StrokeFx): DItem {
  const it: Record<string, DItem> = {
    enab: bool(f.enabled), Styl: enm("FStl", f.position === "inside" ? "InsF" : f.position === "center" ? "CtrF" : "OutF"),
    PntT: enm("FrFl", f.fill.type === "gradient" ? "GrFl" : f.fill.type === "pattern" ? "Ptrn" : "SClr"),
    "Md  ": blendItem(f.blend), Opct: pct(f.opacity), "Sz  ": px(f.size),
  };
  if (f.fill.type === "color") it["Clr "] = colorItem(f.fill.color);
  else if (f.fill.type === "gradient") Object.assign(it, gradientItems(f.fill.gradient));
  else { it.Ptrn = patternItem(f.fill.pattern); it["Scl "] = pct(f.fill.scale); }
  return obj("FrFX", it);
}

const overlayColor = (d: Descriptor): OverlayFx<RGBA> => ({ enabled: flag(d, "enab", true), blend: blendFrom(d), opacity: num(d, "Opct", 100) / 100, value: colorFrom(sub(d, "Clr ")) });
const overlayGradient = (d: Descriptor): OverlayFx<Gradient> => ({ enabled: flag(d, "enab", true), blend: blendFrom(d), opacity: num(d, "Opct", 100) / 100, value: gradientFrom(d) });

/** One or many effects of a kind: the *Multi list when present, else the single key. */
function many(d: Descriptor, single: string, multi: string): Descriptor[] {
  const m = items(d, multi).map((it) => (it.t === "Objc" ? it.v : null)).filter((x): x is Descriptor => !!x);
  if (m.length) return m;
  const s = sub(d, single);
  return s ? [s] : [];
}

/** lfx2 descriptor → LayerStyle. */
export function styleFrom(d: Descriptor): LayerStyle {
  const s: LayerStyle = { enabled: flag(d, "masterFXSwitch", true) };
  const sc = num(d, "Scl ", 100) / 100;
  if (sc !== 1) s.scale = sc;
  const ds = many(d, "DrSh", "dropShadowMulti").map(shadowFrom); if (ds.length) s.dropShadow = ds;
  const is = many(d, "IrSh", "innerShadowMulti").map(shadowFrom); if (is.length) s.innerShadow = is;
  const og = sub(d, "OrGl"); if (og) s.outerGlow = glowFrom(og, false);
  const ig = sub(d, "IrGl"); if (ig) s.innerGlow = glowFrom(ig, true);
  const bv = sub(d, "ebbl"); if (bv) s.bevel = bevelFrom(bv);
  const sa = sub(d, "ChFX"); if (sa) s.satin = satinFrom(sa);
  const co = many(d, "SoFi", "solidFillMulti").map(overlayColor); if (co.length) s.colorOverlay = co;
  const go = many(d, "GrFl", "gradientFillMulti").map(overlayGradient); if (go.length) s.gradientOverlay = go;
  const po = sub(d, "patternFill");
  if (po) s.patternOverlay = { enabled: flag(po, "enab", true), blend: blendFrom(po), opacity: num(po, "Opct", 100) / 100, value: { pattern: patternFrom(po), scale: num(po, "Scl ", 100) / 100 } };
  const st = many(d, "FrFX", "frameFXMulti").map(strokeFrom); if (st.length) s.stroke = st;
  return s;
}

/** LayerStyle → lfx2 descriptor. */
export function styleToDesc(s: LayerStyle): Descriptor {
  const it: Record<string, DItem> = { "Scl ": pct(s.scale ?? 1), masterFXSwitch: bool(s.enabled) };
  const put = <T>(arr: T[] | undefined, single: string, multi: string, fn: (f: T) => DItem): void => {
    if (!arr?.length) return;
    if (arr.length > 1) it[multi] = list(arr.map(fn));
    it[single] = fn(arr[0]!);
  };
  put(s.dropShadow, "DrSh", "dropShadowMulti", (f) => shadowDesc("DrSh", f));
  put(s.innerShadow, "IrSh", "innerShadowMulti", (f) => shadowDesc("IrSh", f));
  if (s.outerGlow) it.OrGl = glowDesc("OrGl", s.outerGlow, false);
  if (s.innerGlow) it.IrGl = glowDesc("IrGl", s.innerGlow, true);
  if (s.bevel) it.ebbl = bevelDesc(s.bevel);
  if (s.satin) it.ChFX = satinDesc(s.satin);
  put(s.colorOverlay, "SoFi", "solidFillMulti", (f) => obj("SoFi", { enab: bool(f.enabled), "Md  ": blendItem(f.blend), Opct: pct(f.opacity), "Clr ": colorItem(f.value) }));
  put(s.gradientOverlay, "GrFl", "gradientFillMulti", (f) => obj("GrFl", { enab: bool(f.enabled), "Md  ": blendItem(f.blend), Opct: pct(f.opacity), ...gradientItems(f.value) }));
  if (s.patternOverlay) { const f = s.patternOverlay; it.patternFill = obj("patternFill", { enab: bool(f.enabled), "Md  ": blendItem(f.blend), Opct: pct(f.opacity), Ptrn: patternItem(f.value.pattern), "Scl ": pct(f.value.scale), Algn: bool(true) }); }
  put(s.stroke, "FrFX", "frameFXMulti", strokeDesc);
  return desc("null", it);
}
