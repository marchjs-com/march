// Text layers (TySh): the transform, the text descriptor with its EngineData (text, fonts, sizes, colors, alignment)
// and the warp. Read into the March text model as far as the engine data allows; written back with a compact engine
// data dictionary the text engine accepts.

import type { CharStyle, ParaStyle, TextData, TextParagraph, TextRun, WarpStyle } from "../doc/text-model.ts";
import { DEFAULT_CHAR, DEFAULT_PARA, plainText } from "../doc/text-model.ts";
import type { RGBA } from "../doc/layers.ts";
import { Reader, Writer } from "./binary.ts";
import { desc, doub, en, enm, list, long, num, obj, readVersioned, str, sub, text, unit, writeVersioned, type Descriptor } from "./descriptor.ts";
import { parseEngineData, writeEngineData, type EValue } from "./engine-data.ts";

type Dict = { [k: string]: EValue };
const dict = (v: EValue | undefined): Dict => (v && typeof v === "object" && !Array.isArray(v) && !("name" in v && Object.keys(v).length === 1) ? (v as Dict) : {});
const arr = (v: EValue | undefined): EValue[] => (Array.isArray(v) ? v : []);
const numv = (v: EValue | undefined, d: number): number => (typeof v === "number" ? v : d);

const JUSTIFY: ParaStyle["align"][] = ["left", "right", "center", "justify-left", "justify-right", "justify-center", "justify-all"];
const AA: Record<string, NonNullable<CharStyle["antialias"]>> = { Anno: "none", AnSh: "sharp", AnCr: "crisp", AnSt: "strong", AnSm: "smooth", antiAliasPlatformLCD: "smooth", antiAliasPlatformGray: "smooth" };
const AA_OUT: Record<NonNullable<CharStyle["antialias"]>, string> = { none: "Anno", sharp: "AnSh", crisp: "AnCr", strong: "AnSt", smooth: "AnSm" };
const WARPS: Record<string, WarpStyle> = {
  warpNone: "none", warpArc: "arc", warpArcLower: "arc-lower", warpArcUpper: "arc-upper", warpArch: "arch", warpBulge: "bulge",
  warpShellLower: "shell-lower", warpShellUpper: "shell-upper", warpFlag: "flag", warpWave: "wave", warpFish: "fish", warpRise: "rise",
  warpFisheye: "fisheye", warpInflate: "inflate", warpSqueeze: "squeeze", warpTwist: "twist",
};
const WARPS_OUT = Object.fromEntries(Object.entries(WARPS).map(([k, v]) => [v, k])) as Record<WarpStyle, string>;

export interface TySh { transform: number[]; textDesc: Descriptor; warpDesc: Descriptor; bounds: number[] }

export function readTySh(r: Reader): TySh {
  r.u16();
  const transform = [r.f64(), r.f64(), r.f64(), r.f64(), r.f64(), r.f64()];
  r.u16();
  const textDesc = readVersioned(r);
  r.u16();
  const warpDesc = readVersioned(r);
  const bounds: number[] = [];
  if (r.left >= 32) for (let i = 0; i < 4; i++) bounds.push(r.f64());
  else if (r.left >= 16) for (let i = 0; i < 4; i++) bounds.push(r.i32());
  return { transform, textDesc, warpDesc, bounds };
}

export function writeTySh(w: Writer, t: TySh): void {
  w.u16(1);
  for (const v of t.transform) w.f64(v);
  w.u16(50);
  writeVersioned(w, t.textDesc);
  w.u16(1);
  writeVersioned(w, t.warpDesc);
  for (let i = 0; i < 4; i++) w.i32(Math.round(t.bounds[i] ?? 0));
}

function colorOf(v: EValue | undefined): RGBA | null {
  const vals = arr(dict(v).Values);
  if (vals.length < 4) return null;
  return [numv(vals[1], 0), numv(vals[2], 0), numv(vals[3], 0), numv(vals[0], 1)];
}

/** Char style from engine StyleSheetData (sizes scaled by the transform's vertical scale). */
function charFrom(s: Dict, fonts: string[], scale: number): Partial<CharStyle> {
  const c: Partial<CharStyle> = {};
  if (typeof s.Font === "number") {
    const f = fonts[s.Font] ?? "";
    if (f) {
      c.font = f;
      if (/bold|black|heavy/i.test(f)) c.weight = 700;
      if (/italic|oblique/i.test(f)) c.style = "italic";
    }
  }
  if (typeof s.FontSize === "number") c.size = Math.round(s.FontSize * scale * 100) / 100;
  if (s.FauxBold === true) c.weight = 700;
  if (s.FauxItalic === true) c.style = "italic";
  if (typeof s.Tracking === "number") c.tracking = s.Tracking;
  if (s.AutoLeading === false && typeof s.Leading === "number") c.leading = s.Leading * scale;
  if (typeof s.HorizontalScale === "number") c.hscale = s.HorizontalScale;
  if (typeof s.VerticalScale === "number") c.vscale = s.VerticalScale;
  if (typeof s.BaselineShift === "number") c.baseline = s.BaselineShift * scale;
  if (s.Underline === true) c.underline = true;
  if (s.Strikethrough === true) c.strike = true;
  if (typeof s.FontCaps === "number" && s.FontCaps) c.caps = s.FontCaps === 2 ? "all" : "small";
  if (typeof s.FontBaseline === "number" && s.FontBaseline) c.position = s.FontBaseline === 1 ? "super" : "sub";
  const col = colorOf(s.FillColor);
  if (col) c.color = col;
  return c;
}

/** TySh → March text model (and the plain text). */
export function textFromTySh(t: TySh): TextData {
  const raw = t.textDesc.items.EngineData;
  const engine = raw && raw.t === "tdta" ? parseEngineData(raw.v) : {};
  const ed = dict(engine.EngineDict);
  const res = dict(engine.ResourceDict);
  const fonts = arr(res.FontSet).map((f) => { const n = dict(f).Name; return typeof n === "string" ? n : ""; });
  let content = str(t.textDesc, "Txt ");
  if (!content) { const e = dict(ed.Editor).Text; if (typeof e === "string") content = e; }
  content = content.replace(/\r$/, "");
  const [xx, xy, yx, yy, tx, ty] = t.transform as [number, number, number, number, number, number];
  const scale = Math.sqrt(Math.abs(xx * yy - xy * yx)) || 1;

  // style runs → per-character styles
  const sr = dict(ed.StyleRun);
  const lens = arr(sr.RunLengthArray).map((v) => numv(v, 0));
  const styles = arr(sr.RunArray).map((r) => charFrom(dict(dict(dict(r).StyleSheet).StyleSheetData), fonts, scale));
  const base: CharStyle = { ...DEFAULT_CHAR, ...(styles[0] ?? {}) };
  const pr = dict(ed.ParagraphRun);
  const plens = arr(pr.RunLengthArray).map((v) => numv(v, 0));
  const paras = arr(pr.RunArray).map((r) => {
    const p = dict(dict(dict(r).ParagraphSheet).Properties);
    const out: Partial<ParaStyle> = {};
    if (typeof p.Justification === "number") out.align = JUSTIFY[p.Justification] ?? "left";
    if (typeof p.FirstLineIndent === "number") out.indentFirst = p.FirstLineIndent;
    if (typeof p.StartIndent === "number") out.indentLeft = p.StartIndent;
    if (typeof p.EndIndent === "number") out.indentRight = p.EndIndent;
    if (typeof p.SpaceBefore === "number") out.spaceBefore = p.SpaceBefore;
    if (typeof p.SpaceAfter === "number") out.spaceAfter = p.SpaceAfter;
    if (typeof p.AutoHyphenate === "boolean") out.hyphenate = p.AutoHyphenate;
    return out;
  });
  const basePara: ParaStyle = { ...DEFAULT_PARA, ...(paras[0] ?? {}) };
  const diff = <T extends object>(s: Partial<T>, b: T): Partial<T> => {
    const o: Partial<T> = {};
    for (const k of Object.keys(s) as (keyof T)[]) if (JSON.stringify(s[k]) !== JSON.stringify(b[k])) o[k] = s[k];
    return o;
  };
  const styleAt = (i: number): Partial<CharStyle> => {
    let acc = 0;
    for (let k = 0; k < lens.length; k++) { acc += lens[k]!; if (i < acc) return styles[k] ?? {}; }
    return styles[styles.length - 1] ?? {};
  };
  const paraAt = (i: number): Partial<ParaStyle> => {
    let acc = 0;
    for (let k = 0; k < plens.length; k++) { acc += plens[k]!; if (i < acc) return paras[k] ?? {}; }
    return paras[paras.length - 1] ?? {};
  };
  const paragraphs: TextParagraph[] = [];
  let pos = 0;
  for (const line of content.split(/\r\n?|\n/)) {
    const runs: TextRun[] = [];
    for (let i = 0; i < line.length; i++) {
      const st = diff(styleAt(pos + i), base);
      const key = JSON.stringify(st);
      const last = runs[runs.length - 1];
      if (last && JSON.stringify(last.style) === key) last.text += line[i];
      else runs.push({ text: line[i]!, style: st });
    }
    if (!runs.length) runs.push({ text: "", style: {} });
    paragraphs.push({ runs, style: diff(paraAt(pos), basePara) });
    pos += line.length + 1;
  }

  // frame: point text at the transform's origin, box text from the engine's BoxBounds
  const shape = dict(arr(dict(dict(ed.Rendered).Shapes).Children)[0]);
  const ps = dict(dict(shape.Cookie).Photoshop);
  const box = arr(ps.BoxBounds).map((v) => numv(v, 0));
  const frame: TextData["frame"] = numv(ps.ShapeType, numv(shape.ShapeType, 0)) === 1 && box.length === 4
    ? { type: "box", x: tx + box[0]!, y: ty + box[1]!, w: box[2]! - box[0]!, h: box[3]! - box[1]! }
    : { type: "point", x: tx, y: ty };
  const out: TextData = { paragraphs, char: base, para: basePara, orientation: en(t.textDesc, "Ornt", "Hrzn") === "Vrtc" ? "vertical" : "horizontal", frame };
  const aa = AA[en(t.textDesc, "AntA", "AnSm")];
  if (aa) out.char.antialias = aa;
  const ws = WARPS[en(t.warpDesc, "warpStyle", "warpNone")] ?? "none";
  if (ws !== "none") out.warp = { style: ws, bend: num(t.warpDesc, "warpValue") / 100, hDistort: num(t.warpDesc, "warpPerspective") / 100, vDistort: num(t.warpDesc, "warpPerspectiveOther") / 100, vertical: en(t.warpDesc, "warpRotate", "Hrzn") === "Vrtc" };
  if (Math.abs(xx - scale) > 1e-6 || Math.abs(xy) > 1e-6 || Math.abs(yx) > 1e-6 || Math.abs(yy - scale) > 1e-6) out.matrix = [xx / scale, xy / scale, yx / scale, yy / scale, 0, 0];
  return out;
}

/** March text model → TySh (bounds = the layer's pixel bounds). */
export function textToTySh(t: TextData, bounds: { x: number; y: number; w: number; h: number } | null): TySh {
  const content = plainText(t);
  const chars: Partial<CharStyle>[] = [];
  const paraStyles: [number, Partial<ParaStyle>][] = [];
  for (const p of t.paragraphs) {
    let n = 0;
    for (const r of p.runs) for (let i = 0; i < r.text.length; i++) { chars.push(r.style); n++; }
    chars.push(p.runs[p.runs.length - 1]?.style ?? {}); // the paragraph break
    paraStyles.push([n + 1, p.style]);
  }
  const fonts: string[] = [];
  const fontIndex = (f: string): number => { let i = fonts.indexOf(f); if (i < 0) { fonts.push(f); i = fonts.length - 1; } return i; };
  const sheet = (s: Partial<CharStyle>): Dict => {
    const c = { ...t.char, ...s };
    const o: Dict = {
      Font: fontIndex(c.font), FontSize: c.size, FauxBold: c.weight >= 600 && !/bold|black|heavy/i.test(c.font), FauxItalic: c.style === "italic" && !/italic|oblique/i.test(c.font),
      AutoLeading: c.leading == null, Leading: c.leading ?? c.size * 1.2, HorizontalScale: c.hscale, VerticalScale: c.vscale, Tracking: c.tracking,
      BaselineShift: c.baseline, FontCaps: c.caps === "all" ? 2 : c.caps === "small" ? 1 : 0, FontBaseline: c.position === "super" ? 1 : c.position === "sub" ? 2 : 0,
      Underline: !!c.underline, Strikethrough: !!c.strike, FillColor: { Type: 1, Values: [c.color[3], c.color[0], c.color[1], c.color[2]] },
    };
    return o;
  };
  // style runs: merge equal neighbours
  const runArray: EValue[] = [], runLengths: number[] = [];
  let lastKey = "";
  for (const s of chars) {
    const k = JSON.stringify(s);
    if (k === lastKey) runLengths[runLengths.length - 1]!++;
    else { runArray.push({ StyleSheet: { StyleSheetData: sheet(s) } }); runLengths.push(1); lastKey = k; }
  }
  const paraSheet = (p: Partial<ParaStyle>): Dict => {
    const q = { ...t.para, ...p };
    return { Justification: Math.max(0, JUSTIFY.indexOf(q.align)), FirstLineIndent: q.indentFirst, StartIndent: q.indentLeft, EndIndent: q.indentRight, SpaceBefore: q.spaceBefore, SpaceAfter: q.spaceAfter, AutoHyphenate: q.hyphenate };
  };
  const box = t.frame.type === "box";
  const fr = t.frame as { x: number; y: number; w?: number; h?: number };
  const shapeType = box ? 1 : 0;
  const normalSheet = sheet({});
  const resources: Dict = {
    KinsokuSet: [], MojiKumiSet: [], TheNormalStyleSheet: 0, TheNormalParagraphSheet: 0,
    ParagraphSheetSet: [{ Name: "Normal RGB", DefaultStyleSheet: 0, Properties: paraSheet({}) }],
    StyleSheetSet: [{ Name: "Normal RGB", StyleSheetData: normalSheet }],
    FontSet: [] as EValue[], SuperscriptSize: 0.583, SuperscriptPosition: 0.333, SubscriptSize: 0.583, SubscriptPosition: 0.333, SmallCapSize: 0.7,
  };
  const engine: Dict = {
    EngineDict: {
      Editor: { Text: content.replace(/\n/g, "\r") + "\r" },
      ParagraphRun: {
        DefaultRunData: { ParagraphSheet: { DefaultStyleSheet: 0, Properties: {} }, Adjustments: { Axis: [1, 0, 1], XY: [0, 0] } },
        RunArray: paraStyles.map(([, p]) => ({ ParagraphSheet: { DefaultStyleSheet: 0, Properties: paraSheet(p) }, Adjustments: { Axis: [1, 0, 1], XY: [0, 0] } })),
        RunLengthArray: paraStyles.map(([n]) => n), IsJoinable: 1,
      },
      StyleRun: { DefaultRunData: { StyleSheet: { StyleSheetData: {} } }, RunArray: runArray, RunLengthArray: runLengths, IsJoinable: 2 },
      GridInfo: { GridIsOn: false, ShowGrid: false, GridSize: 18, GridLeading: 22, GridColor: { Type: 1, Values: [0, 0, 0, 1] }, GridLeadingFillColor: { Type: 1, Values: [0, 0, 0, 1] }, AlignLineHeightToGridFlags: false },
      AntiAlias: 4, UseFractionalGlyphWidths: true,
      Rendered: {
        Version: 1,
        Shapes: {
          WritingDirection: t.orientation === "vertical" ? 2 : 0,
          Children: [{
            ShapeType: shapeType, Procession: 0, Lines: { WritingDirection: 0, Children: [] },
            Cookie: { Photoshop: { ShapeType: shapeType, ...(box ? { BoxBounds: [0, 0, fr.w ?? 0, fr.h ?? 0] } : { PointBase: [0, 0] }), Base: { ShapeType: shapeType, TransformPoint0: [1, 0], TransformPoint1: [0, 1], TransformPoint2: [0, 0] } } },
          }],
        },
      },
    },
    ResourceDict: resources,
    DocumentResources: resources,
  };
  fonts.push("AdobeInvisFont");
  resources.FontSet = fonts.map((f) => ({ Name: f, Script: 0, FontType: 0, Synthetic: 0 }));
  const b = bounds ?? { x: fr.x, y: fr.y, w: 0, h: 0 };
  const rect = (l: number, tp: number, r: number, bt: number) => obj("bounds", { Left: unit("#Pnt", l), "Top ": unit("#Pnt", tp), Rght: unit("#Pnt", r), Btom: unit("#Pnt", bt) });
  const m = t.matrix ?? [1, 0, 0, 1, 0, 0];
  const textDesc = desc("TxLr", {
    "Txt ": text(content.replace(/\n/g, "\r")),
    textGridding: enm("textGridding", "None"),
    Ornt: enm("Ornt", t.orientation === "vertical" ? "Vrtc" : "Hrzn"),
    AntA: enm("Annt", AA_OUT[t.char.antialias ?? "smooth"]),
    bounds: rect(b.x - fr.x, b.y - fr.y, b.x + b.w - fr.x, b.y + b.h - fr.y),
    boundingBox: rect(b.x - fr.x, b.y - fr.y, b.x + b.w - fr.x, b.y + b.h - fr.y),
    TextIndex: long(0),
    EngineData: { t: "tdta", v: writeEngineData(engine) },
  });
  const wp = t.warp;
  const warpDesc = desc("warp", {
    warpStyle: enm("warpStyle", wp ? WARPS_OUT[wp.style] : "warpNone"), warpValue: doub((wp?.bend ?? 0) * 100),
    warpPerspective: doub((wp?.hDistort ?? 0) * 100), warpPerspectiveOther: doub((wp?.vDistort ?? 0) * 100), warpRotate: enm("Ornt", wp?.vertical ? "Vrtc" : "Hrzn"),
  });
  return { transform: [m[0]!, m[1]!, m[2]!, m[3]!, fr.x, fr.y], textDesc, warpDesc, bounds: [b.x, b.y, b.x + b.w, b.y + b.h] };
}

