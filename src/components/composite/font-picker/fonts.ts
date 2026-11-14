// The font model of FontPicker: families (system and web), the Google Fonts catalog (a lazy part, decoded here),
// filtering and sorting, the stylesheet address of a family and the loader that adds it to the page. No UI.
import { fold } from "../../../core/text.ts";

/** Kind of a typeface. */
export type FontCategory = "sans-serif" | "serif" | "display" | "handwriting" | "monospace";
/** Order of the list: most used first (the catalog's order), by name, or newest first. */
export type FontSort = "popular" | "name" | "newest";

/** One family in the list. */
export interface FontFamily {
  /** The name shown and, for a web font, the CSS family name ("Inter"). */
  family: string;
  category: FontCategory;
  /** "system": already on the device (no request); "web": loaded from the font source. */
  source: "system" | "web";
  /** Upright weights (100…900). */
  weights: readonly number[];
  /** Weights that also have an italic. */
  italics: readonly number[];
  /** Subsets the family covers ("latin", "latin-ext", "cyrillic"…); empty: not known. */
  subsets: readonly string[];
  /** The CSS `font-family` value of a system font (with fallbacks). Web fonts get `"Name", <generic>`. */
  stack?: string | undefined;
  /** Days since 2010-01-01 the family was added (newest sort). */
  added?: number | undefined;
}

/** What the font source is asked for. */
export interface FontRequest {
  family: string;
  /** Upright weights wanted. */
  weights: readonly number[];
  /** Italic weights wanted. */
  italics?: readonly number[] | undefined;
  /** Only the letters of this text (a tiny file for a preview); none: the whole font. */
  text?: string | undefined;
}

/**
 * Where web fonts come from: "google" (fonts.googleapis.com), the address of a server that answers the same
 * `/css2?family=…` requests (your own proxy or mirror: "/fonts", "https://fonts.example.com"), a function that returns
 * the stylesheet address for a request, or false (never load: names stay in the page's own type).
 */
export type FontSource = "google" | (string & {}) | ((request: FontRequest) => string | null | undefined) | false;

/** The font categories, in the order the picker shows them. */
export const FONT_CATEGORIES: readonly FontCategory[] = ["sans-serif", "serif", "display", "handwriting", "monospace"];
const GENERIC: Record<FontCategory, string> = { "sans-serif": "sans-serif", serif: "serif", display: "sans-serif", handwriting: "cursive", monospace: "monospace" };

const sys = (family: string, category: FontCategory, stack: string, weights: readonly number[] = [400, 700]): FontFamily =>
  ({ family, category, source: "system", weights, italics: weights, subsets: [], stack });

/** Fonts found on most devices: each is a stack, so a device without the first name still shows a close one. */
export const SYSTEM_FONTS: readonly FontFamily[] = [
  sys("System UI", "sans-serif", "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif", [300, 400, 500, 600, 700]),
  sys("Arial", "sans-serif", "Arial, Helvetica, sans-serif"),
  sys("Helvetica", "sans-serif", "\"Helvetica Neue\", Helvetica, Arial, sans-serif"),
  sys("Verdana", "sans-serif", "Verdana, Geneva, sans-serif"),
  sys("Tahoma", "sans-serif", "Tahoma, Verdana, sans-serif"),
  sys("Trebuchet MS", "sans-serif", "\"Trebuchet MS\", \"Lucida Grande\", sans-serif"),
  sys("Rounded", "sans-serif", "ui-rounded, \"SF Pro Rounded\", \"Arial Rounded MT Bold\", system-ui, sans-serif"),
  sys("Georgia", "serif", "Georgia, \"Times New Roman\", serif"),
  sys("Times New Roman", "serif", "\"Times New Roman\", Times, serif"),
  sys("Palatino", "serif", "Palatino, \"Palatino Linotype\", \"Book Antiqua\", serif"),
  sys("Garamond", "serif", "Garamond, \"Apple Garamond\", Baskerville, serif"),
  sys("Courier New", "monospace", "\"Courier New\", Courier, monospace"),
  sys("System Mono", "monospace", "ui-monospace, \"Cascadia Code\", Menlo, Consolas, monospace"),
  sys("Impact", "display", "Impact, Haettenschweiler, \"Arial Narrow Bold\", sans-serif", [400]),
  sys("Comic Sans", "handwriting", "\"Comic Sans MS\", \"Chalkboard SE\", cursive"),
  sys("Brush Script", "handwriting", "\"Brush Script MT\", \"Snell Roundhand\", cursive", [400]),
];

/** The CSS `font-family` value of a family: its own stack, or `"Name", <generic of its category>`. */
export function fontStack(font: Pick<FontFamily, "family" | "category"> & { stack?: string | undefined }): string {
  return font.stack ?? `"${font.family.replace(/["\\]/g, "")}", ${GENERIC[font.category] ?? "sans-serif"}`;
}

const bits = (mask: number): number[] => { const out: number[] = []; for (let i = 0; i < 9; i++) if (mask & (1 << i)) out.push((i + 1) * 100); return out; };

/** Decode the generated catalog text (google-catalog.gen.ts) into families, most used first. */
export function decodeCatalog(fonts: string, subsets: string): FontFamily[] {
  const names = subsets.split(" ");
  const subsOf = (codes: string): string[] => {
    const out: string[] = [];
    for (let i = 0; i < codes.length; i++) {
      const long = codes[i] === "~";
      out.push(names[Number.parseInt(long ? codes.slice(i + 1, i + 3) : (codes[i] as string), 36)] as string);
      if (long) i += 2;
    }
    return out;
  };
  return fonts.split("\n").map((line): FontFamily => {
    const [family = "", cat = "0", up = "8", it = "", subs = "", days = "0"] = line.split("|");
    const weights = bits(Number.parseInt(up, 36));
    return { family, category: FONT_CATEGORIES[Number(cat)] ?? "sans-serif", source: "web", weights, italics: it === "=" ? weights : it ? bits(Number.parseInt(it, 36)) : [], subsets: subsOf(subs), added: Number.parseInt(days, 36) };
  });
}

let google: Promise<FontFamily[]> | undefined;
/** The built-in Google Fonts catalog (about 1,900 open-licensed families): its own lazy part, loaded once. */
export function googleFonts(): Promise<FontFamily[]> {
  return (google ??= import("./google-catalog.gen.ts").then((m) => decodeCatalog(m.FONTS, m.SUBSETS)));
}

/** What the list is narrowed by. */
export interface FontFilter { query?: string | undefined; category?: FontCategory | "all" | null | undefined; subset?: string | null | undefined; sort?: FontSort | undefined }

/** Narrow and order families: text (accents and case folded; names that start with it first), category, subset, sort. */
export function filterFonts(list: readonly FontFamily[], f: FontFilter): FontFamily[] {
  const q = fold(f.query ?? "").trim(), cat = f.category && f.category !== "all" ? f.category : null, sub = f.subset && f.subset !== "all" ? f.subset : null;
  const head: FontFamily[] = [], rest: FontFamily[] = [];
  for (const x of list) {
    if (cat && x.category !== cat) continue;
    // a family whose subsets are not known (a system font) is never hidden by the subset
    if (sub && x.subsets.length && !x.subsets.includes(sub)) continue;
    if (!q) { rest.push(x); continue; }
    const at = fold(x.family).indexOf(q);
    if (at === 0) head.push(x); else if (at > 0) rest.push(x);
  }
  const order = (a: FontFamily[]): FontFamily[] => (f.sort === "name" ? a.sort((x, y) => x.family.localeCompare(y.family)) : f.sort === "newest" ? a.sort((x, y) => (y.added ?? 0) - (x.added ?? 0)) : a);
  return [...order(head), ...order(rest)];
}

/** The weight of a family nearest to the one wanted (400 → 400 when it has it, else the closest). */
export function nearestWeight(font: Pick<FontFamily, "weights">, want = 400): number {
  let best = font.weights[0] ?? 400;
  for (const w of font.weights) if (Math.abs(w - want) < Math.abs(best - want)) best = w;
  return best;
}

/** The stylesheet address of a request at a source, or null (no source, a system font). `/css2` syntax of Google Fonts. */
export function fontUrl(source: FontSource | undefined, req: FontRequest): string | null {
  if (source === false) return null;
  if (typeof source === "function") return source(req) ?? null;
  const base = !source || source === "google" ? "https://fonts.googleapis.com" : source.replace(/\/+$/, "");
  const up = [...new Set(req.weights)].sort((a, b) => a - b), it = [...new Set(req.italics ?? [])].sort((a, b) => a - b);
  const axis = it.length ? `ital,wght@${[...up.map((w) => `0,${w}`), ...it.map((w) => `1,${w}`)].join(";")}` : `wght@${(up.length ? up : [400]).join(";")}`;
  const text = req.text ? `&text=${encodeURIComponent([...new Set(req.text)].sort().join(""))}` : "";
  return `${base}/css2?family=${encodeURIComponent(req.family).replace(/%20/g, "+")}:${axis}&display=swap${text}`;
}

const sheets = new Map<string, Promise<boolean>>();
/**
 * Add a stylesheet of web fonts to the page once (a `<link>` in the head; the same address is never added twice).
 * Resolves true when it loaded. With `face` (`{ family, weight, italic, text }`) it also waits for that face.
 */
export function loadFontSheet(url: string, face?: { family: string; weight?: number | undefined; italic?: boolean | undefined; text?: string | undefined }): Promise<boolean> {
  const doc = globalThis.document;
  if (!doc?.head) return Promise.resolve(false);
  let sheet = sheets.get(url);
  if (!sheet) {
    sheet = new Promise<boolean>((done) => {
      const link = doc.createElement("link");
      link.rel = "stylesheet"; link.href = url; link.setAttribute("data-m-font", "");
      link.addEventListener("load", () => done(true));
      link.addEventListener("error", () => { sheets.delete(url); link.remove(); done(false); });
      doc.head.appendChild(link);
    });
    sheets.set(url, sheet);
  }
  if (!face) return sheet;
  return sheet.then(async (ok) => {
    if (!ok) return false;
    try { await doc.fonts?.load(`${face.italic ? "italic " : ""}${face.weight ?? 400} 16px "${face.family}"`, face.text || "Aa"); } catch { /* the sheet is in: the face follows when used */ }
    return true;
  });
}

/** Options of loadFont(). */
export interface LoadFontOptions { source?: FontSource | undefined; weights?: readonly number[] | undefined; italics?: readonly number[] | undefined; text?: string | undefined }

/**
 * Load a web font into the page so `font-family: "Name"` works: `await loadFont("Inter", { weights: [400, 700] })`.
 * A system font (or `source: false`) needs nothing and resolves false.
 */
export function loadFont(font: string | Pick<FontFamily, "family" | "source">, opts: LoadFontOptions = {}): Promise<boolean> {
  const family = typeof font === "string" ? font : font.family;
  if (typeof font !== "string" && font.source === "system") return Promise.resolve(false);
  const italics = opts.italics ?? [], weights = opts.weights?.length || italics.length ? opts.weights ?? [] : [400];
  const url = fontUrl(opts.source, { family, weights, italics, text: opts.text });
  return url ? loadFontSheet(url, { family, weight: weights[0] ?? italics[0], italic: !weights.length, text: opts.text }) : Promise.resolve(false);
}
