// ThemeEditor input and output: the defineTheme module, the stylesheet and JSON of a draft, share links, and drafts
// from loose data, JSON, CSS or a link. A module of its own: only the export tab and the editor's start step load it.
import { clamp } from "../../../core/util.ts";
import { defineTheme, themeCss, type ThemeDef } from "../../../theme/css.ts";
import { COLOR_ROLES, DEFAULT_MOTION, DEFAULT_STYLE, DEFAULT_TYPE, draftFromColor, draftFromTheme, draftToTheme, slug, type ColorRole, type DraftColors, type ThemeDraft } from "./model.ts";

// ------------------------------------------------------------------ output
const ident = (json: string): string => json.replace(/"([A-Za-z_$][\w$]*)":/g, "$1:");
/** The defineTheme module of a draft: the definition, the build step that writes its CSS and the picker entry. */
export function draftCode(d: ThemeDraft): string {
  const { swatches: _s, ...def } = draftToTheme(d);
  const v = d.id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
  return `import { defineTheme, themeCss } from "march/theme"
import { registerThemes } from "march/ui"

export const ${v} = defineTheme(${ident(JSON.stringify(def, null, 2))})

// build step: write the stylesheet next to the page (themes/${d.id}.css)
// fs.writeFileSync("themes/${d.id}.css", themeCss(${v}))
// in the app: offer it in ThemePicker / ThemeMenu
registerThemes([{ id: "${d.id}", name: ${JSON.stringify(d.name)} }])
`;
}
const MARK = "m-theme-editor";
/** The stylesheet of a draft (themeCss), with the draft encoded in a comment so the CSS can be imported back. */
export const draftCss = (d: ThemeDraft): string => `/* ${MARK} ${encodeDraft(d)} */\n${themeCss(draftToTheme(d))}`;
/** The draft as JSON. */
export const draftJson = (d: ThemeDraft): string => JSON.stringify(d, null, 2);

const b64 = (s: string): string => { const b = new TextEncoder().encode(s); let x = ""; for (const c of b) x += String.fromCharCode(c); return btoa(x).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64 = (s: string): string => { const x = atob(s.replace(/-/g, "+").replace(/_/g, "/")); return new TextDecoder().decode(Uint8Array.from(x, (c) => c.charCodeAt(0))); };
/** A draft as a URL-safe code (share links, the CSS comment). */
export const encodeDraft = (d: ThemeDraft): string => b64(JSON.stringify(d));
/** A draft from encodeDraft's code (null when it is not one). */
export function decodeDraft(code: string): ThemeDraft | null { try { return normalizeDraft(JSON.parse(unb64(code))); } catch { return null; } }
/** A link to `href` that opens the draft in a ThemeEditor (`?theme=<code>`; a hash route stays as it is). */
export function shareUrl(d: ThemeDraft, href = globalThis.location?.href ?? "http://localhost/"): string { const u = new URL(href); u.searchParams.set("theme", encodeDraft(d)); return u.href; }
/** The draft in a share link (null when the link has none). */
export function sharedDraft(href = globalThis.location?.href ?? ""): ThemeDraft | null { const m = /[?#&]theme=([\w-]+)/.exec(href); return m ? decodeDraft(m[1]!) : null; }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, d: string): string => (typeof v === "string" && v ? v : d);
const num = (v: unknown, d: number, lo: number, hi: number): number => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : d);
const normColors = (v: unknown, d: DraftColors): DraftColors => {
  if (!isObj(v)) return d;
  const out = { ...d } as DraftColors;
  for (const k of COLOR_ROLES) out[k] = str(v[k], d[k]);
  if (Array.isArray(v["cat"]) && v["cat"].length === 8) out.cat = v["cat"].map((c, i) => str(c, d.cat[i]!));
  if (isObj(v["brand"])) out.brand = Object.fromEntries(Object.entries(v["brand"]).filter(([, b]) => isObj(b) && typeof b["color"] === "string").map(([k, b]) => [k, { ...(b as { color: string; soft?: string }) }]));
  for (const k of ["mark", "stage"] as const) out[k] = str(v[k], d[k]);
  if (Array.isArray(v["glow"]) && v["glow"].length === 4) out.glow = v["glow"].map((c, i) => str(c, d.glow[i]!));
  return out;
};
/** A complete, valid draft from loose data (missing or wrong fields take `base`'s values); null when not a draft. */
export function normalizeDraft(v: unknown, base: ThemeDraft = draftFromColor("#f2801f")): ThemeDraft | null {
  if (!isObj(v) || !isObj(v["light"]) || !isObj(v["dark"])) return null;
  const t = isObj(v["type"]) ? v["type"] : {}, s = isObj(v["shape"]) ? v["shape"] : {}, m = isObj(v["motion"]) ? v["motion"] : {}, y = isObj(v["style"]) ? v["style"] : {};
  const name = str(v["name"], "My theme");
  const id = typeof v["id"] === "string" && /^[a-z][a-z0-9-]*$/.test(v["id"]) ? v["id"] : slug(name);
  return {
    id, name, ...(typeof v["description"] === "string" ? { description: v["description"] } : {}), base: typeof v["base"] === "string" ? v["base"] : null,
    light: normColors(v["light"], base.light), dark: normColors(v["dark"], base.dark),
    type: {
      body: str(t["body"], base.type.body), display: str(t["display"], base.type.display), mono: str(t["mono"], DEFAULT_TYPE.mono),
      base: num(t["base"], 14, 10, 24), ratio: num(t["ratio"], 1.2, 1, 1.7), leading: num(t["leading"], 1.5, 1, 2.2), leadingTight: num(t["leadingTight"], 1.2, 0.9, 1.8),
      medium: num(t["medium"], 500, 100, 900), semibold: num(t["semibold"], 600, 100, 900), bold: num(t["bold"], 700, 100, 900), displayWeight: num(t["displayWeight"], 700, 100, 900),
    },
    shape: {
      radius: num(s["radius"], base.shape.radius, 0, 40), spread: num(s["spread"], 1, 0, 2), space: num(s["space"], 4, 2, 8),
      density: (["compact", "normal", "comfortable"] as const).find((x) => x === s["density"]) ?? "normal", shadow: num(s["shadow"], 1, 0, 3), border: num(s["border"], 1, 0, 4),
    },
    style: {
      surface: (["soft", "flat", "raised", "outlined", "glass"] as const).find((x) => x === y["surface"]) ?? "soft", glow: num(y["glow"], 0, 0, 1),
      shadowKind: (["soft", "hard", "none"] as const).find((x) => x === y["shadowKind"]) ?? "soft", accent: y["accent"] === "gradient" ? "gradient" : "solid",
      tracking: num(y["tracking"], DEFAULT_STYLE.tracking, -0.08, 0.2), iconStroke: num(y["iconStroke"], DEFAULT_STYLE.iconStroke, 0.75, 3),
    },
    motion: {
      fast: num(m["fast"], 100, 0, 2000), base: num(m["base"], 150, 0, 2000), slow: num(m["slow"], 240, 0, 3000),
      ease: str(m["ease"], DEFAULT_MOTION.ease), easeOut: str(m["easeOut"], DEFAULT_MOTION.easeOut), easeSpring: str(m["easeSpring"], DEFAULT_MOTION.easeSpring),
    },
    ...(v["multicolor"] === true ? { multicolor: true } : {}),
  };
}

const VAR_ROLE: Record<string, ColorRole> = {
  "bg": "bg", "surface": "surface", "surface-raised": "raised", "text": "text", "muted": "muted", "border": "border", "primary": "primary",
  "primary-solid": "solid", "on-primary": "onSolid", "danger": "danger", "success": "success", "warn": "warn", "info": "info", "special": "special",
};
/** Colors, fonts and radius read back from a theme stylesheet (first block = light, last block = dark). */
function draftFromCss(css: string): ThemeDraft | null {
  const blocks = [...css.matchAll(/\{([^{}]*)\}/g)].map((m) => Object.fromEntries([...(m[1] ?? "").matchAll(/--m-([\w-]+):\s*([^;]+);/g)].map((x) => [x[1]!, x[2]!.trim()])));
  const first = blocks[0];
  if (!first || !Object.keys(first).some((k) => k in VAR_ROLE)) return null;
  const d = draftFromColor("#f2801f");
  const colors = (vars: Record<string, string>, c: DraftColors): DraftColors => {
    const out = { ...c, cat: [...c.cat], brand: { ...c.brand } };
    for (const [k, v] of Object.entries(vars)) {
      if (VAR_ROLE[k]) out[VAR_ROLE[k]] = v;
      else if (/^cat-[1-8]$/.test(k)) out.cat[Number(k.slice(4)) - 1] = v;
      else if (/^brand-[a-z]+$/.test(k)) out.brand[k] = { color: v };
    }
    return out;
  };
  const font = (v: string | undefined): string | undefined => v?.split(/,\s*(?=system-ui)/)[0];
  const r = parseFloat(first["r"] ?? "");
  return {
    ...d, id: "imported", name: "Imported", base: null,
    light: colors(first, d.light), dark: colors(blocks.length > 1 ? blocks[blocks.length - 1]! : first, d.dark),
    type: { ...d.type, body: font(first["font"]) ?? d.type.body, display: font(first["font-display"])?.split(/,\s*(?=")/)[0] ?? d.type.display, displayWeight: Number(first["display-weight"]) || d.type.displayWeight },
    shape: { ...d.shape, radius: Number.isFinite(r) ? r : d.shape.radius },
  };
}

/** Import pasted text: a draft (JSON), a ThemeDef (JSON), a share link or code, or a theme stylesheet (themeCss / ThemeEditor CSS). */
export function importTheme(text: string): ThemeDraft | null {
  const s = text.trim();
  const marked = new RegExp(`${MARK} ([\\w-]+)`).exec(s);
  if (marked) return decodeDraft(marked[1]!);
  if (s.startsWith("{")) {
    let v: unknown;
    try { v = JSON.parse(s); } catch { return null; }
    if (isObj(v) && isObj(v["light"]) && typeof v["font"] === "string" && typeof v["radius"] === "number") {
      try { return draftFromTheme(defineTheme(v as unknown as ThemeDef)); } catch { return null; }
    }
    return normalizeDraft(v);
  }
  if (/[?#&]theme=/.test(s)) return sharedDraft(s);
  if (/^[\w-]{40,}$/.test(s)) return decodeDraft(s);
  return draftFromCss(s);
}

