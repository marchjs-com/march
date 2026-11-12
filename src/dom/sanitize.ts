// Safe content core, part 2: untrusted HTML (clipboard, imports) → DOM nodes through an allowlist, without ever handing a
// string to the browser's HTML parser. No innerHTML, no DOMParser (a Trusted Types sink): a small tokenizer reads the
// markup and only allowlisted elements and attributes are created with createElement / setAttribute, so it works under
// `require-trusted-types-for 'script'; trusted-types 'none'`. Script-like elements are dropped with their content,
// unknown elements are unwrapped (their text stays), URLs pass isSafeLink().
//
//   const frag = parseHtml(clipboardHtml)             // DocumentFragment of clean nodes (RICH_SCHEMA)
//   const clean = sanitizeNode(someDomTree)           // the same rules for nodes that already exist (contenteditable)
//   normalizeBlocks(root)                             // inline runs → <p>, <div> flattened, no stray whitespace
import { isSafeLink, RICH_SCHEMA, type SafeSchema } from "./safe.ts";

export { isSafeLink, RICH_SCHEMA, type SafeSchema };

/** Elements dropped together with everything inside them. */
const DROP = new Set(["script", "style", "template", "noscript", "iframe", "object", "embed", "svg", "math", "head", "title", "meta", "link", "base", "frame", "frameset", "applet", "select", "textarea", "button", "input", "form", "audio", "video", "canvas", "xml"]);
/** Elements whose content is raw text up to their end tag. */
const RAW = new Set(["script", "style", "textarea", "title", "xmp", "noscript", "iframe", "noembed", "noframes", "plaintext"]);
const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "wbr", "col", "area", "base", "embed", "source", "track", "param"]);
/** Block-level elements (normalizeBlocks keeps them at the top level). */
export const BLOCKS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "ul", "ol", "pre", "hr", "div", "li", "table", "section", "article", "header", "footer", "figure"]);

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", copy: "©", reg: "®", trade: "™", hellip: "…", mdash: "—", ndash: "–",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", bull: "•", middot: "·", euro: "€", deg: "°", times: "×", shy: "",
};
/** Decode character references (&amp; &#39; &#x1F600; and common named ones). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);?/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "�";
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Attribute values worth keeping: safe URLs, a code language class only. */
const attrOk = (a: string, v: string): boolean => (a === "href" || a === "src" ? isSafeLink(v) : a === "class" ? /^language-[\w-]{1,30}$/.test(v) : true);

interface Frame { tag: string; node: Node | null; drop: boolean }
const STYLE_MARKS: [RegExp, string][] = [[/font-weight\s*:\s*(bold|[6-9]00)/i, "strong"], [/font-style\s*:\s*italic/i, "em"], [/text-decoration[^;]*underline/i, "u"], [/text-decoration[^;]*line-through/i, "s"]];

/**
 * Parse an HTML string into a fragment of allowlisted nodes. Inline styles are read only to keep emphasis that
 * office suites encode as styles (font-weight, font-style, text-decoration); they are never copied.
 */
export function parseHtml(html: string, schema: SafeSchema = RICH_SCHEMA, d: Document = globalThis.document): DocumentFragment {
  const root = d.createDocumentFragment();
  const stack: Frame[] = [{ tag: "#root", node: root, drop: false }];
  const parent = (): Node => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i]!.node) return stack[i]!.node!; return root; };
  const dropping = (): boolean => stack[stack.length - 1]!.drop;
  let pre = 0;
  const text = (raw: string): void => {
    if (dropping() || !raw) return;
    let s = decodeEntities(raw);
    if (!pre) s = s.replace(/[\t\n\r\f ]+/g, " ");
    if (s) parent().appendChild(d.createTextNode(s));
  };
  const src = String(html ?? "");
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) { text(src.slice(i)); break; }
    if (lt > i) text(src.slice(i, lt));
    if (src.startsWith("<!--", lt)) { const e = src.indexOf("-->", lt + 4); i = e < 0 ? src.length : e + 3; continue; }
    if (src[lt + 1] === "!" || src[lt + 1] === "?") { const e = src.indexOf(">", lt); i = e < 0 ? src.length : e + 1; continue; }
    const m = /^<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/.exec(src.slice(lt, lt + 4096));
    if (!m) { text("<"); i = lt + 1; continue; }
    i = lt + m[0].length;
    const close = m[1] === "/";
    const tag = m[2]!.toLowerCase();
    if (close) {
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k]!.tag === tag) { const gone = stack.splice(k); if (gone.some((f) => f.tag === "pre" && f.node)) pre = Math.max(0, pre - 1); break; }
      }
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of m[3]!.matchAll(/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) attrs[a[1]!.toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? "");
    // raw-text elements: skip to their end tag (their content is never markup)
    if (RAW.has(tag)) {
      const end = src.toLowerCase().indexOf(`</${tag}`, i);
      const body = end < 0 ? src.slice(i) : src.slice(i, end);
      if (!DROP.has(tag)) text(body);
      i = end < 0 ? src.length : (src.indexOf(">", end) + 1 || src.length);
      continue;
    }
    if (dropping() || DROP.has(tag)) { if (!VOID.has(tag) && m[4] !== "/") stack.push({ tag, node: null, drop: true }); continue; }
    const style = attrs.style ?? "";
    let name = schema.rename?.[tag] ?? tag;
    // Google Docs wraps everything in <b style="font-weight:normal">: that is not bold
    if (name === "strong" && /font-weight\s*:\s*(normal|[1-4]00)/i.test(style)) name = "span";
    let node: Element | null = null;
    if (schema.tags[name] && !(name === "span" && !attrs["data-mention"])) {
      node = d.createElement(name);
      for (const a of schema.tags[name]!) {
        const v = attrs[a];
        if (v == null) continue;
        if (!attrOk(a, v)) continue;
        node.setAttribute(a, v);
      }
      // a link without a safe address is just its text
      if (name === "a" && !node.hasAttribute("href")) node = null;
    }
    // style-encoded emphasis (span / font from office suites) becomes elements
    let outer: Element | null = node, inner: Element | null = node;
    if (!node || name === "span") {
      for (const [re, mark] of STYLE_MARKS) {
        if (!schema.tags[mark] || !re.test(style)) continue;
        const el = d.createElement(mark);
        if (inner) inner.appendChild(el); else outer = el;
        inner = el;
      }
    }
    if (outer) parent().appendChild(outer);
    if (VOID.has(tag) || m[4] === "/") continue;
    if (name === "pre" && node) pre++;
    stack.push({ tag, node: inner, drop: false });
  }
  return root;
}

/** Copy `node`'s children through the schema (the same rules as parseHtml) into a new fragment. */
export function sanitizeNode(node: Node, schema: SafeSchema = RICH_SCHEMA): DocumentFragment {
  const d = node.ownerDocument ?? globalThis.document;
  const out = d.createDocumentFragment();
  const walk = (from: Node, to: Node): void => {
    for (const c of Array.from(from.childNodes)) {
      if (c.nodeType === 3) { to.appendChild(d.createTextNode(c.nodeValue ?? "")); continue; }
      if (c.nodeType !== 1) continue;
      const tag = (c as Element).tagName.toLowerCase();
      if (DROP.has(tag)) continue;
      const name = schema.rename?.[tag] ?? tag;
      const allowed = schema.tags[name] && !(name === "span" && !(c as Element).getAttribute("data-mention"));
      if (!allowed) { walk(c, to); continue; }
      const el = d.createElement(name);
      for (const a of schema.tags[name]!) {
        const v = (c as Element).getAttribute(a);
        if (v != null && attrOk(a, v)) el.setAttribute(a, v);
      }
      if (name === "a" && !el.hasAttribute("href")) { walk(c, to); continue; }
      if (name === "span") el.setAttribute("contenteditable", "false");
      to.appendChild(el);
      walk(c, el);
    }
  };
  walk(node, out);
  return out;
}

const isBlock = (n: Node): boolean => n.nodeType === 1 && BLOCKS.has((n as Element).tagName.toLowerCase());
const blank = (n: Node): boolean => n.nodeType === 3 && !/\S| /.test(n.nodeValue ?? "");

/**
 * Make `root`'s children a clean list of blocks: runs of inline nodes are wrapped in <p>, <div> and other containers are
 * flattened, whitespace between blocks is removed, a <p> inside <li> / <blockquote> is unwrapped (<br> between), and
 * h1 becomes h2 when `topHeading` is 2. Returns root.
 */
export function normalizeBlocks<T extends Node>(root: T, opts: { topHeading?: number } = {}): T {
  const d = root.ownerDocument ?? globalThis.document;
  const out: Node[] = [];
  let run: Node[] = [];
  const flushRun = (): void => {
    while (run.length && blank(run[0]!)) run.shift();
    while (run.length && blank(run[run.length - 1]!)) run.pop();
    if (run.length) { const p = d.createElement("p"); for (const n of run) p.appendChild(n); out.push(p); }
    run = [];
  };
  const visit = (n: Node): void => {
    if (!isBlock(n)) { run.push(n); return; }
    flushRun();
    const el = n as Element, tag = el.tagName.toLowerCase();
    if (tag === "div" || tag === "section" || tag === "article" || tag === "header" || tag === "footer" || tag === "figure" || tag === "table") { for (const c of Array.from(el.childNodes)) visit(c); flushRun(); return; }
    if (tag === "li") { const ul = d.createElement("ul"); ul.appendChild(el); out.push(ul); return; }
    if (/^h[1-6]$/.test(tag) && opts.topHeading && +tag[1]! < opts.topHeading) { const hx = d.createElement(`h${opts.topHeading}`); while (el.firstChild) hx.appendChild(el.firstChild); out.push(hx); return; }
    if (tag === "blockquote") flattenInto(el);
    if (tag === "ul" || tag === "ol") {
      for (const c of Array.from(el.childNodes)) {
        if (c.nodeType === 1 && (c as Element).tagName.toLowerCase() === "li") flattenInto(c as Element);
        else if (blank(c)) c.remove();
        else { const li = d.createElement("li"); el.replaceChild(li, c); li.appendChild(c); }
      }
      if (!el.childNodes.length) return;
    }
    out.push(el);
  };
  // a <p> (or nested list / div) inside an li or a quote becomes inline content separated by <br>
  const flattenInto = (el: Element): void => {
    const kids = Array.from(el.childNodes);
    if (!kids.some(isBlock)) return;
    const parts: Node[][] = [];
    let cur: Node[] = [];
    const take = (n: Node): void => {
      if (!isBlock(n)) { cur.push(n); return; }
      if (cur.length) { parts.push(cur); cur = []; }
      for (const c of Array.from(n.childNodes)) take(c);
      if (cur.length) { parts.push(cur); cur = []; }
    };
    for (const k of kids) take(k);
    if (cur.length) parts.push(cur);
    while (el.firstChild) el.removeChild(el.firstChild);
    parts.filter((p) => p.some((n) => !blank(n))).forEach((p, i) => { if (i) el.appendChild(d.createElement("br")); for (const n of p) el.appendChild(n); });
  };
  for (const c of Array.from(root.childNodes)) visit(c);
  flushRun();
  while (root.firstChild) root.removeChild(root.firstChild);
  for (const n of out) root.appendChild(n);
  return root;
}
