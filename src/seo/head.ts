// Head tags: title, meta, link and JSON-LD, merged from several sources (app defaults, the route, components) and
// applied to document.head. Pure resolve (resolveHead → Tag[]) plus a DOM writer (applyHead) that updates tags in
// place, restores tags it changed in the static HTML and removes the ones it created when they are no longer wanted.
// No innerHTML: every tag is built with createElement / setAttribute / createTextNode.

export interface MetaTag { name?: string; property?: string; httpEquiv?: string; charset?: string; content?: string; key?: string }
export interface LinkTag { rel: string; href: string; hreflang?: string; type?: string; media?: string; sizes?: string; title?: string; key?: string }
export interface OgImage { url: string; alt?: string; width?: number; height?: number; type?: string }
/** Open Graph card. Missing title / description / url are filled from the head's own values. */
export interface OgInput { title?: string; description?: string; image?: string | OgImage; url?: string; type?: string; siteName?: string; locale?: string }
/** Twitter / X card. Missing values fall back to the Open Graph card. */
export interface TwitterInput { card?: "summary" | "summary_large_image" | "app" | "player"; site?: string; creator?: string; title?: string; description?: string; image?: string; imageAlt?: string }
export type JsonLd = Record<string, unknown>;
export interface HeadInput {
  title?: string;
  /** "%s · Site" or (title) => string; applied to `title` (not to a title the router computed itself). */
  titleTemplate?: string | ((title: string) => string);
  description?: string;
  /** Absolute URL, or true: built from the app's `site` and the current path (history routing only). */
  canonical?: string | boolean;
  /** "index,follow", "noindex"… */
  robots?: string;
  /** <html lang>. */
  lang?: string;
  meta?: MetaTag[];
  link?: LinkTag[];
  og?: OgInput | false;
  twitter?: TwitterInput | false;
  jsonLd?: JsonLd | JsonLd[];
  /** @internal a title used as is (no template): the router's own title. */
  titleRaw?: string;
}

export type Tag =
  | { tag: "title"; key: "title"; text: string }
  | { tag: "meta" | "link"; key: string; attrs: Record<string, string> }
  | { tag: "script"; key: string; attrs: Record<string, string>; text: string };

export interface ResolveOptions { /** Absolute site origin + base, e.g. "https://example.com". */ site?: string; /** Current route path, for canonical: true. */ path?: string }

const metaKey = (m: MetaTag): string => m.key ?? (m.charset != null ? "charset" : m.name != null ? `name:${m.name}` : m.property != null ? `property:${m.property}` : m.httpEquiv != null ? `http-equiv:${m.httpEquiv.toLowerCase()}` : `meta:${m.content ?? ""}`);
const linkKey = (l: LinkTag): string => l.key ?? (l.rel === "canonical" ? "link:canonical" : `link:${l.rel}:${l.hreflang ?? ""}:${l.media ?? ""}:${l.rel === "alternate" || l.hreflang ? "" : l.href}`);

/** The key a tag (as attributes) is matched by: the same rules for tags written here and tags found in the HTML. */
export function tagKey(tag: string, a: Record<string, string | null | undefined>): string | null {
  if (tag === "title") return "title";
  if (tag === "meta") {
    if (a["charset"] != null) return "charset";
    if (a["name"] != null) return `name:${a["name"]}`;
    if (a["property"] != null) return `property:${a["property"]}`;
    if (a["http-equiv"] != null) return `http-equiv:${String(a["http-equiv"]).toLowerCase()}`;
    return null;
  }
  if (tag === "link" && a["rel"]) return linkKey({ rel: String(a["rel"]), href: String(a["href"] ?? ""), ...(a["hreflang"] ? { hreflang: String(a["hreflang"]) } : {}), ...(a["media"] ? { media: String(a["media"]) } : {}) });
  return null;
}

/** JSON for a <script type="application/ld+json"> body: "</script" and "<!--" can never close or confuse the element. */
export function jsonLdText(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** Open Graph <meta property="og:…"> tags. */
export function ogTags(og: OgInput): MetaTag[] {
  const out: MetaTag[] = [];
  const add = (p: string, v: unknown): void => { if (v != null && v !== "") out.push({ property: p, content: String(v) }); };
  add("og:type", og.type ?? "website");
  add("og:title", og.title); add("og:description", og.description); add("og:url", og.url); add("og:site_name", og.siteName); add("og:locale", og.locale);
  const img = typeof og.image === "string" ? { url: og.image } : og.image;
  if (img) { add("og:image", img.url); add("og:image:alt", img.alt); add("og:image:width", img.width); add("og:image:height", img.height); add("og:image:type", img.type); }
  return out;
}

/** Twitter / X <meta name="twitter:…"> tags. */
export function twitterTags(tw: TwitterInput): MetaTag[] {
  const out: MetaTag[] = [];
  const add = (n: string, v: unknown): void => { if (v != null && v !== "") out.push({ name: n, content: String(v) }); };
  add("twitter:card", tw.card ?? (tw.image ? "summary_large_image" : "summary"));
  add("twitter:site", tw.site); add("twitter:creator", tw.creator); add("twitter:title", tw.title); add("twitter:description", tw.description);
  add("twitter:image", tw.image); add("twitter:image:alt", tw.imageAlt);
  return out;
}

const join = (site: string, p: string): string => `${site.replace(/\/+$/, "")}${p.startsWith("/") ? p : `/${p}`}`;

/** Merge head inputs (later ones win) into the list of tags to write. */
export function resolveHead(inputs: readonly (HeadInput | null | undefined | false)[], opts: ResolveOptions = {}): Tag[] {
  let title: string | undefined, raw: string | undefined, tpl: HeadInput["titleTemplate"], description: string | undefined, canonical: HeadInput["canonical"], robots: string | undefined;
  let og: OgInput | false | undefined, tw: TwitterInput | false | undefined;
  const meta = new Map<string, MetaTag>(), link = new Map<string, LinkTag>(), ld: JsonLd[] = [];
  for (const h of inputs) {
    if (!h) continue;
    if (h.titleTemplate !== undefined) tpl = h.titleTemplate;
    if (h.title !== undefined) { title = h.title; raw = undefined; }
    if (h.titleRaw !== undefined && h.title === undefined) { raw = h.titleRaw; title = undefined; }
    if (h.description !== undefined) description = h.description;
    if (h.canonical !== undefined) canonical = h.canonical;
    if (h.robots !== undefined) robots = h.robots;
    if (h.og !== undefined) og = h.og === false ? false : { ...(og || {}), ...h.og };
    if (h.twitter !== undefined) tw = h.twitter === false ? false : { ...(tw || {}), ...h.twitter };
    for (const m of h.meta ?? []) meta.set(metaKey(m), m);
    for (const l of h.link ?? []) link.set(linkKey(l), l);
    if (h.jsonLd) ld.push(...(Array.isArray(h.jsonLd) ? h.jsonLd : [h.jsonLd]));
  }
  const tags: Tag[] = [];
  const full = title !== undefined ? (typeof tpl === "function" ? tpl(title) : tpl ? tpl.replace("%s", title) : title) : raw;
  if (full) tags.push({ tag: "title", key: "title", text: full });
  const canon = canonical === true ? (opts.site && opts.path != null ? join(opts.site, opts.path) : undefined) : canonical || undefined;
  const put = (m: MetaTag): void => { if (!meta.has(metaKey(m))) meta.set(metaKey(m), m); };
  if (description !== undefined) meta.set("name:description", { name: "description", content: description });
  if (robots) meta.set("name:robots", { name: "robots", content: robots });
  if (og) for (const m of ogTags({ ...og, title: og.title ?? title ?? raw, description: og.description ?? description, url: og.url ?? canon, image: og.image && typeof og.image === "string" && opts.site && og.image.startsWith("/") ? join(opts.site, og.image) : og.image } as OgInput)) put(m);
  if (tw) {
    const ogImg = og ? (typeof og.image === "string" ? og.image : og.image?.url) : undefined;
    for (const m of twitterTags({ ...tw, title: tw.title ?? (og && og.title) ?? title ?? raw, description: tw.description ?? (og && og.description) ?? description, image: tw.image ?? ogImg } as TwitterInput)) put(m);
  }
  if (canon) link.set("link:canonical", { rel: "canonical", href: canon });
  for (const [key, m] of meta) {
    const a: Record<string, string> = {};
    if (m.charset != null) a["charset"] = m.charset;
    if (m.name != null) a["name"] = m.name;
    if (m.property != null) a["property"] = m.property;
    if (m.httpEquiv != null) a["http-equiv"] = m.httpEquiv;
    if (m.content != null) a["content"] = m.content;
    tags.push({ tag: "meta", key, attrs: a });
  }
  for (const [key, l] of link) {
    const a: Record<string, string> = { rel: l.rel, href: l.href };
    for (const k of ["hreflang", "type", "media", "sizes", "title"] as const) if (l[k] != null) a[k] = String(l[k]);
    tags.push({ tag: "link", key, attrs: a });
  }
  ld.forEach((x, i) => tags.push({ tag: "script", key: `ld:${i}`, attrs: { type: "application/ld+json" }, text: jsonLdText(x) }));
  return tags;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Tags as HTML text (build time, previews). `mark` adds data-hm-head so the client adopts them. */
export function headToHtml(tags: readonly Tag[], { mark = false }: { mark?: boolean } = {}): string {
  const m = mark ? " data-hm-head" : "";
  return tags.map((t) => {
    if (t.tag === "title") return `<title>${esc(t.text)}</title>`;
    const a = Object.entries(t.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join("");
    return t.tag === "script" ? `<script${a}${m}>${t.text}</script>` : `<${t.tag}${a}${m}>`;
  }).join("\n");
}

// ------------------------------------------------------------------ DOM writer
interface Applied { el: Element; orig: Record<string, string> | null; text?: string }
const applied = new Map<string, Applied>();
let langOrig: string | null | undefined;

const attrsOf = (el: Element): Record<string, string> => { const o: Record<string, string> = {}; for (const n of el.getAttributeNames()) o[n] = el.getAttribute(n) ?? ""; return o; };
const setAttrs = (el: Element, a: Record<string, string>): void => {
  for (const n of el.getAttributeNames()) if (!(n in a) && n !== "data-hm-head") el.removeAttribute(n);
  for (const [k, v] of Object.entries(a)) if (el.getAttribute(k) !== v) el.setAttribute(k, v);
};

/**
 * Write tags to document.head: update in place, restore or remove what is no longer wanted. `scripts: false` leaves
 * JSON-LD alone (neither written nor removed: blocks from the build stay).
 */
export function applyHead(tags: readonly Tag[], { lang, scripts = true }: { lang?: string | undefined; scripts?: boolean } = {}, doc: Document | undefined = globalThis.document): void {
  const head = doc?.head;
  if (!doc || !head) return;
  if (lang !== undefined || langOrig !== undefined) {
    const html = doc.documentElement;
    if (langOrig === undefined) langOrig = html.getAttribute("lang");
    const v = lang ?? langOrig;
    if (v) html.setAttribute("lang", v); else html.removeAttribute("lang");
  }
  // what is in <head> now, by key (tags of the static HTML and tags written at build time: data-hm-head)
  const found = new Map<string, Element>();
  const ldFound: Element[] = [];
  for (const el of Array.from(head.children)) {
    const name = el.localName;
    if (name === "script" && el.getAttribute("type") === "application/ld+json") { if (scripts && el.hasAttribute("data-hm-head")) ldFound.push(el); continue; }
    const k = tagKey(name, attrsOf(el));
    if (k && !found.has(k)) found.set(k, el);
  }
  ldFound.forEach((el, i) => found.set(`ld:${i}`, el));
  const want = new Set<string>();
  for (const t of tags) {
    if (t.tag === "script" && !scripts) continue;
    want.add(t.key);
    if (t.tag === "title") { if (!applied.has("title")) applied.set("title", { el: head, orig: { title: doc.title } }); if (doc.title !== t.text) doc.title = t.text; continue; }
    let rec = applied.get(t.key);
    if (!rec) {
      const el = found.get(t.key);
      rec = el ? { el, orig: el.hasAttribute("data-hm-head") ? null : attrsOf(el), ...(t.tag === "script" ? { text: el.textContent ?? "" } : {}) } : { el: doc.createElement(t.tag), orig: null };
      if (!el) { rec.el.setAttribute("data-hm-head", ""); head.appendChild(rec.el); }
      applied.set(t.key, rec);
    }
    if (t.tag === "script") {
      // a JSON-LD block is replaced, never edited (a new text node in a fresh element)
      if (rec.text !== t.text) {
        const el = doc.createElement("script");
        setAttrs(el, t.attrs); el.setAttribute("data-hm-head", "");
        el.appendChild(doc.createTextNode(t.text));
        rec.el.parentNode?.insertBefore(el, rec.el);
        rec.el.remove();
        rec.el = el; rec.text = t.text; rec.orig = null;
      }
    } else setAttrs(rec.el, t.attrs);
  }
  for (const [k, rec] of [...applied]) {
    if (want.has(k)) continue;
    applied.delete(k);
    if (k === "title") { const o = rec.orig?.["title"]; if (o != null) doc.title = o; continue; }
    if (rec.orig) setAttrs(rec.el, rec.orig); else rec.el.remove();
  }
  // build-time JSON-LD blocks that nothing claims any more
  for (const [k, el] of found) if (k.startsWith("ld:") && !want.has(k) && el.isConnected) el.remove();
}

/** Forget what applyHead wrote (tests). */
export function _resetHead(): void { applied.clear(); langOrig = undefined; }
