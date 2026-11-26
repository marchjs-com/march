// Chart toolbar: export buttons (PNG, SVG, CSV). Its own chunk: a chart loads it only when `export` is set.
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { read } from "../core/reactive.ts";
import { Button } from "../components/actions/button/index.ts";
import { download } from "../icons/glyphs/download.ts";
import { exportChart, type ExportFormat, type ExportOptions } from "./export.ts";

/** The `export` prop: `true` (PNG, SVG and CSV), a list of formats, or options. */
export type ExportProp = boolean | readonly ExportFormat[] | (ExportOptions & {
  /** Formats offered (default all three). */
  formats?: readonly ExportFormat[];
  /** Button texts per format (default "PNG", "SVG", "CSV"). */
  labels?: Partial<Record<ExportFormat, unknown>>;
  /** Called after a file was made (or with the error). */
  onExport?: (format: ExportFormat, result: Blob | string | Error) => void;
}) | null | undefined;

const ALL: readonly ExportFormat[] = ["png", "svg", "csv"];

/** A small row of export buttons; `root()` is the chart wrapper. */
export function ChartTools({ root, spec, title }: { root: () => Element | null; spec: () => ExportProp; title: () => unknown }): Element {
  const opts = (): Exclude<ExportProp, boolean | null | undefined | readonly ExportFormat[]> | null => { const s = spec(); return s && typeof s === "object" && !Array.isArray(s) ? s as never : null; };
  const formats = (): readonly ExportFormat[] => { const s = spec(); return Array.isArray(s) ? s : opts()?.formats ?? ALL; };
  const run = (f: ExportFormat): void => {
    const el = root(), o = opts();
    if (!el) return;
    const name = o?.filename ?? (String(read(title) ?? "chart").trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "chart");
    exportChart(el, f, { ...o, filename: name }).then((r) => o?.onExport?.(f, r), (e: Error) => o?.onExport?.(f, e));
  };
  return h("div", { class: "m-chart-tools", role: "group", "aria-label": () => t`Export` },
    () => formats().map((f, i) => h(Button, { size: "sm", variant: "ghost", icon: i === 0 ? download : undefined, class: `m-chart-export m-chart-export-${f}`,
      "aria-label": t`Download ${f.toUpperCase()}`, onClick: () => run(f) }, () => String(opts()?.labels?.[f] ?? f.toUpperCase()))));
}
