// Collage: several images laid out in a template (cells as 0–1 rects of the canvas), each cell filled cover-fit
// (Lanczos, centred), with a gap between and around cells, rounded corners (alpha mask) and a background.
// Not an op: it takes many images. march/image (collage)
import { raster, type Raster } from "./raster.ts";
import { drawOver, filled, lanczosResize, paint, type FracRect } from "./geometry.ts";

export interface CollageTemplate {
  id: string;
  label: string;
  /** Cells as 0–1 rects of the canvas (before the gap is taken out). */
  cells: readonly FracRect[];
}

const grid = (cols: number, rows: number): FracRect[] => {
  const out: FracRect[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: c / cols, y: r / rows, w: 1 / cols, h: 1 / rows });
  return out;
};

/** Built-in layouts. */
export const COLLAGE_TEMPLATES: readonly CollageTemplate[] = [
  { id: "2-up", label: "Side by side", cells: grid(2, 1) },
  { id: "2-stack", label: "Stacked", cells: grid(1, 2) },
  { id: "3-up", label: "Three columns", cells: grid(3, 1) },
  { id: "grid-2x2", label: "Grid 2 × 2", cells: grid(2, 2) },
  { id: "grid-3x3", label: "Grid 3 × 3", cells: grid(3, 3) },
  { id: "big-2", label: "One big, two small", cells: [{ x: 0, y: 0, w: 2 / 3, h: 1 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 0.5 }, { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 }] },
  { id: "big-3", label: "One big, three below", cells: [{ x: 0, y: 0, w: 1, h: 2 / 3 }, { x: 0, y: 2 / 3, w: 1 / 3, h: 1 / 3 }, { x: 1 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 }, { x: 2 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 }] },
  { id: "strip", label: "Photo strip", cells: grid(1, 4) },
  { id: "film", label: "Film strip", cells: grid(4, 1) },
  { id: "polaroid", label: "Polaroid", cells: [{ x: 0.06, y: 0.05, w: 0.88, h: 0.74 }] },
  { id: "mosaic", label: "Mosaic", cells: [{ x: 0, y: 0, w: 0.5, h: 0.6 }, { x: 0.5, y: 0, w: 0.5, h: 0.4 }, { x: 0, y: 0.6, w: 0.5, h: 0.4 }, { x: 0.5, y: 0.4, w: 0.5, h: 0.6 }] },
];

export interface CollageOptions {
  /** Output size in px (default 1080 × 1080). */
  width?: number | undefined;
  height?: number | undefined;
  /** Space between and around cells, px (default 0). */
  gap?: number | undefined;
  /** Corner radius of each cell, px (default 0). */
  radius?: number | undefined;
  /** "#rrggbb" or "transparent" (default "#ffffff"). */
  background?: string | undefined;
}

/** Coverage mask (0–1) of a w × h rounded rectangle. */
function roundedMask(w: number, h: number, radius: number): Float32Array | null {
  const R = Math.min(radius, w / 2, h / 2);
  if (R <= 0) return null;
  const m = new Float32Array(w * h).fill(1);
  for (let y = 0; y < h; y++) {
    const py = y + 0.5, dy = py < R ? R - py : py > h - R ? py - (h - R) : 0;
    if (!dy) continue;
    for (let x = 0; x < w; x++) {
      const px = x + 0.5, dx = px < R ? R - px : px > w - R ? px - (w - R) : 0;
      if (!dx) continue;
      m[y * w + x] = Math.min(1, Math.max(0, R - Math.hypot(dx, dy) + 0.5));
    }
  }
  return m;
}

/** Cell rectangles in px for a template on a width × height canvas with a gap (gap around and between cells). */
export function collageCells(templateId: string, width: number, height: number, gap = 0): { x: number; y: number; w: number; h: number }[] {
  const t = COLLAGE_TEMPLATES.find((c) => c.id === templateId) ?? COLLAGE_TEMPLATES[0]!;
  return t.cells.map((c) => {
    const x0 = Math.round(c.x * (width - gap) + gap), y0 = Math.round(c.y * (height - gap) + gap);
    const x1 = Math.round((c.x + c.w) * (width - gap)), y1 = Math.round((c.y + c.h) * (height - gap));
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  });
}

/** Lay images into a template (images repeat when there are fewer than cells). */
export function collage(images: readonly Raster[], templateId: string, o: CollageOptions = {}): Raster {
  const W = Math.max(1, Math.round(o.width ?? 1080)), H = Math.max(1, Math.round(o.height ?? 1080)), gap = Math.max(0, o.gap ?? 0);
  const space = images[0]?.space ?? "srgb";
  const out = o.background === "transparent" ? raster(W, H, space) : filled(W, H, paint(o.background ?? "#ffffff"), space);
  if (!images.length) return out;
  collageCells(templateId, W, H, gap).forEach((c, i) => {
    const img = images[i % images.length]!, iw = img.width, ih = img.height;
    // cover: the centred source window with the cell's aspect
    const k = Math.max(c.w / iw, c.h / ih), sw = c.w / k, sh = c.h / k;
    const cell = lanczosResize(img, c.w, c.h, { x: (iw - sw) / 2, y: (ih - sh) / 2, w: sw, h: sh });
    drawOver(out, cell, c.x, c.y, roundedMask(c.w, c.h, o.radius ?? 0));
  });
  return out;
}
