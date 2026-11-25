// Color libraries for the picker and the Swatches panel: generated, generic swatch books (no third-party libraries).
// The brand book lists the theme's brand token names with placeholder colors; the UI replaces them with the live
// token values (`--m-brand-*`) when it has a DOM.

import type { RGBA } from "../layers.ts";
import { hsbToRgb, hslToRgb, toHex } from "./convert.ts";

export interface Swatch { name: string; color: RGBA; hex: string; /** Theme token the swatch stands for (brand book). */ token?: string | undefined }
export interface SwatchBook { id: string; name: string; swatches: Swatch[] }

const sw = (name: string, r: number, g: number, b: number, token?: string): Swatch => ({ name, color: [r, g, b, 1], hex: toHex(r, g, b), ...(token ? { token } : {}) });
const HUES: [string, number][] = [["Red", 0], ["Orange", 30], ["Yellow", 55], ["Lime", 90], ["Green", 130], ["Teal", 170], ["Cyan", 190], ["Sky", 210], ["Blue", 230], ["Indigo", 255], ["Violet", 280], ["Magenta", 310], ["Pink", 335]];

/** 0 % … 100 % black in 5 % steps (21 swatches). */
function grayscale(): SwatchBook {
  const s: Swatch[] = [];
  for (let i = 0; i <= 20; i++) { const v = 1 - i / 20; s.push(sw(`${i * 5}% Gray`, v, v, v)); }
  return { id: "grayscale", name: "Grayscale Steps", swatches: s };
}
function pastel(): SwatchBook {
  return { id: "pastel", name: "Pastel", swatches: HUES.map(([n, h]) => { const c = hslToRgb(h, 0.7, 0.86); return sw(`Pastel ${n}`, c[0], c[1], c[2]); }) };
}
function neon(): SwatchBook {
  return { id: "neon", name: "Neon", swatches: HUES.map(([n, h]) => { const c = hsbToRgb(h, 0.85, 1); return sw(`Neon ${n}`, c[0], c[1], c[2]); }) };
}
function earth(): SwatchBook {
  // low-saturation warm and olive tones at three lightness levels
  const tones: [string, number, number][] = [["Clay", 18, 0.45], ["Sand", 38, 0.35], ["Ochre", 42, 0.6], ["Umber", 25, 0.4], ["Olive", 65, 0.35], ["Moss", 90, 0.25], ["Slate", 210, 0.12], ["Stone", 35, 0.08]];
  const s: Swatch[] = [];
  for (const [n, h, sat] of tones) for (const [lbl, l] of [["Light", 0.72], ["", 0.5], ["Deep", 0.3]] as const) {
    const c = hslToRgb(h, sat, l);
    s.push(sw(`${lbl ? `${lbl} ` : ""}${n}`, c[0], c[1], c[2]));
  }
  return { id: "earth", name: "Earth Tones", swatches: s };
}
/** The brand tokens, placeholder colors (the UI reads the theme's values). */
function brand(): SwatchBook {
  const t: [string, string, number, number, number][] = [
    ["Brand Orange", "brand-orange", 1, 0.55, 0.1], ["Brand Blue", "brand-blue", 0.15, 0.45, 0.95], ["Brand Green", "brand-green", 0.15, 0.7, 0.4],
    ["Brand Purple", "brand-purple", 0.55, 0.3, 0.9], ["Brand Gold", "brand-gold", 0.95, 0.75, 0.15], ["Brand Pink", "brand-pink", 0.95, 0.35, 0.6],
  ];
  return { id: "brand", name: "HADİ Brand", swatches: t.map(([n, tok, r, g, b]) => sw(n, r, g, b, tok)) };
}
/** The 216 web-safe colors. */
function webSafe(): SwatchBook {
  const s: Swatch[] = [];
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) { const c = sw("", r / 5, g / 5, b / 5); c.name = c.hex.toUpperCase(); s.push(c); }
  return { id: "web-safe", name: "Web Safe", swatches: s };
}

let books: SwatchBook[] | null = null;
/** Every built-in book. */
export function swatchBooks(): SwatchBook[] {
  return (books ??= [grayscale(), pastel(), earth(), neon(), brand(), webSafe()]);
}
export const swatchBook = (id: string): SwatchBook | undefined => swatchBooks().find((b) => b.id === id);

/** Replace the brand placeholders with resolved token colors (the UI passes getComputedStyle values). */
export function resolveBrand(resolve: (token: string) => RGBA | null): SwatchBook {
  const b = swatchBook("brand")!;
  return { ...b, swatches: b.swatches.map((s) => { const c = s.token ? resolve(s.token) : null; return c ? { ...s, color: c, hex: toHex(c[0], c[1], c[2]) } : s; }) };
}
