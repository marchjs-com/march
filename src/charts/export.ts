// Chart export: the drawing as SVG (styles written in, so it looks the same outside the page) or PNG, and the data as
// CSV (the chart's own data table). No dependency; the toolbar (tools.ts) loads this only when a chart asks for it.
import { csvField, download } from "../table/export.ts";

export type ExportFormat = "png" | "svg" | "csv";
export interface ExportOptions {
  /** File name without extension (default "chart"). */
  filename?: string | undefined;
  /** PNG pixel ratio (default 2). */
  scale?: number | undefined;
  /** PNG / SVG background (default the page's surface color; "transparent" keeps none). */
  background?: string | undefined;
  /** false: build the file and return it without saving. */
  download?: boolean | undefined;
}

const PAINT = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "opacity", "font-family", "font-size", "font-weight", "visibility", "text-anchor", "dominant-baseline"];

/** The chart's svg as standalone SVG text: computed paint written as attributes (CSS variables resolved). */
export function svgText(root: Element, background?: string): string {
  const svg = root.matches?.("svg") ? root : root.querySelector("svg.m-chart-svg, svg");
  if (!svg) return "";
  const copy = svg.cloneNode(true) as Element;
  const view = root.ownerDocument?.defaultView;
  const src = [svg, ...svg.querySelectorAll("*")], dst = [copy, ...copy.querySelectorAll("*")];
  if (view?.getComputedStyle) src.forEach((el, i) => {
    const cs = view.getComputedStyle(el), out = dst[i] as Element;
    for (const p of PAINT) { const v = cs.getPropertyValue(p); if (v) out.setAttribute(p, v); }
    if (cs.display === "none") out.setAttribute("display", "none");
  });
  const box = svg.getBoundingClientRect?.();
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (box?.width) { copy.setAttribute("width", String(Math.round(box.width))); copy.setAttribute("height", String(Math.round(box.height))); }
  copy.removeAttribute("class");
  const bg = background ?? (view?.getComputedStyle ? view.getComputedStyle(root).getPropertyValue("--m-surface").trim() || "#fff" : "#fff");
  if (bg !== "transparent") {
    const rect = copy.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "100%"); rect.setAttribute("height", "100%"); rect.setAttribute("fill", bg);
    copy.insertBefore(rect, copy.firstChild);
  }
  return new XMLSerializer().serializeToString(copy);
}

/** The chart's data table as CSV text (formula-safe, with a BOM so spreadsheets read UTF-8). */
export function csvText(root: Element): string {
  const table = root.querySelector("table");
  if (!table) return "";
  const rows = [...table.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => csvField(c.textContent ?? "")).join(","));
  return String.fromCharCode(0xfeff) + rows.join("\r\n");
}

/** A PNG of the chart (resolves with the Blob). Needs `img-src blob:` under a CSP. */
export function pngBlob(root: Element, scale = 2, background?: string): Promise<Blob> {
  const text = svgText(root, background);
  const doc = root.ownerDocument as Document;
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const c = doc.createElement("canvas");
      c.width = Math.round((img.width || 640) * scale); c.height = Math.round((img.height || 240) * scale);
      const g = c.getContext("2d");
      if (!g) { URL.revokeObjectURL(url); return reject(new Error("canvas 2d unavailable")); }
      g.scale(scale, scale); g.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("the chart could not be drawn as an image")); };
    img.src = url;
  });
}

/** Export a chart (its wrapper or svg) as PNG, SVG or CSV; saves the file unless `download: false`. */
export async function exportChart(root: Element, format: ExportFormat, o: ExportOptions = {}): Promise<Blob | string> {
  const name = `${o.filename ?? "chart"}.${format}`;
  const out = format === "png" ? await pngBlob(root, o.scale ?? 2, o.background) : format === "svg" ? svgText(root, o.background) : csvText(root);
  if (o.download !== false) download(name, out, format === "png" ? "image/png" : format === "svg" ? "image/svg+xml;charset=utf-8" : "text/csv;charset=utf-8");
  return out;
}
