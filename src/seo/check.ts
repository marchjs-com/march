// SEO check of a rendered HTML page (what `march seo check` runs on every built .html file; the same function works on
// document.documentElement.outerHTML in a browser). Text only, no DOM: a small tag scanner, enough for these rules.

export type SeoLevel = "error" | "warn";
export interface SeoIssue { level: SeoLevel; rule: string; message: string }
export interface SeoCheckOptions {
  /** A page that should be indexed needs a canonical link (default true; false for hash-routed apps). */
  canonical?: boolean;
  /** Recommended title length (characters). */
  titleMax?: number;
  /** Recommended description length range. */
  descriptionRange?: [number, number];
}

interface ScanTag { name: string; attrs: Record<string, string>; text?: string }
const RAW = new Set(["script", "style", "title", "textarea"]);
const decode = (s: string): string => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_m, e: string) => {
  const k = e.toLowerCase();
  if (k[0] === "#") return String.fromCodePoint(k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  return ({ amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " } as Record<string, string>)[k] ?? _m;
});

/** Start tags (with attributes) and the text of raw-text elements, in document order. */
export function scanTags(html: string): ScanTag[] {
  const out: ScanTag[] = [];
  const re = /<!--[\s\S]*?-->|<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (!m[1]) continue;
    const name = m[1].toLowerCase();
    const attrs: Record<string, string> = {};
    const ar = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let a: RegExpExecArray | null;
    while ((a = ar.exec(m[2] ?? ""))) attrs[(a[1] ?? "").toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? "");
    const tag: ScanTag = { name, attrs };
    if (RAW.has(name)) {
      const end = html.toLowerCase().indexOf(`</${name}`, re.lastIndex);
      tag.text = html.slice(re.lastIndex, end < 0 ? html.length : end);
      if (end >= 0) re.lastIndex = end;
    }
    out.push(tag);
  }
  return out;
}

/** Check one page. Errors: what search engines need; warnings: what most pages should have. */
export function checkHtml(html: string, opts: SeoCheckOptions = {}): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const add = (level: SeoLevel, rule: string, message: string): void => { issues.push({ level, rule, message }); };
  const tags = scanTags(html);
  const meta = (k: string, v: string): ScanTag | undefined => tags.find((t) => t.name === "meta" && (t.attrs[k] ?? "").toLowerCase() === v);
  const robots = (meta("name", "robots")?.attrs["content"] ?? "").toLowerCase();
  const noindex = robots.includes("noindex");

  const titleTag = tags.find((t) => t.name === "title");
  const title = decode(titleTag?.text ?? "").trim();
  if (!title) add("error", "title", "missing <title>");
  else if (title.length > (opts.titleMax ?? 60)) add("warn", "title-length", `title is ${title.length} characters (keep it under ${opts.titleMax ?? 60})`);

  const desc = (meta("name", "description")?.attrs["content"] ?? "").trim();
  const [dMin, dMax] = opts.descriptionRange ?? [50, 160];
  if (!desc) add("error", "description", "missing <meta name=\"description\">");
  else if (desc.length < dMin || desc.length > dMax) add("warn", "description-length", `description is ${desc.length} characters (aim for ${dMin}–${dMax})`);

  if (opts.canonical !== false && !noindex) {
    const canon = tags.find((t) => t.name === "link" && (t.attrs["rel"] ?? "").toLowerCase().split(/\s+/).includes("canonical"));
    if (!canon) add("error", "canonical", "missing <link rel=\"canonical\">");
    else if (!/^https?:\/\//i.test(canon.attrs["href"] ?? "")) add("error", "canonical-absolute", `canonical must be an absolute URL (got "${canon.attrs["href"] ?? ""}")`);
  }

  const imgs = tags.filter((t) => t.name === "img");
  const noAlt = imgs.filter((t) => !("alt" in t.attrs));
  if (noAlt.length) add("error", "img-alt", `${noAlt.length} <img> without alt: ${noAlt.slice(0, 3).map((t) => t.attrs["src"] ?? "?").join(", ")}`);

  const html0 = tags.find((t) => t.name === "html");
  if (html0 && !html0.attrs["lang"]) add("warn", "lang", "<html> has no lang");
  const h1 = tags.filter((t) => t.name === "h1").length;
  if (h1 === 0) add("warn", "h1", "no <h1> on the page");
  else if (h1 > 1) add("warn", "h1", `${h1} <h1> elements (one per page)`);
  if (!meta("name", "viewport")) add("warn", "viewport", "missing <meta name=\"viewport\">");
  if (meta("property", "og:title") && !meta("property", "og:image")) add("warn", "og-image", "Open Graph card without og:image");

  for (const t of tags.filter((x) => x.name === "script" && (x.attrs["type"] ?? "").toLowerCase() === "application/ld+json")) {
    try { JSON.parse(t.text ?? ""); } catch { add("error", "json-ld", "a JSON-LD block is not valid JSON"); }
  }
  return issues;
}

/** One line per issue, for terminals and previews. */
export function formatIssues(file: string, issues: readonly SeoIssue[]): string {
  return issues.map((i) => `${file}: ${i.level === "error" ? "error" : "warn "} ${i.rule.padEnd(18)} ${i.message}`).join("\n");
}
