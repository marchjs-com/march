// Safe content core, part 1: which links and elements are allowed. Shared by the Markdown renderer (forms), the HTML
// sanitizer (dom/sanitize.ts) and rich text editors; kept tiny so every page that renders Markdown pays only for this.
//
//   isSafeLink(url)            http(s), mailto, tel and relative URLs only (never javascript:, data:, vbscript: …)
//   RICH_SCHEMA                the allowlist rich text uses (dom/sanitize.ts › parseHtml, sanitizeNode)

/** Allowed elements, their attributes and renames. */
export interface SafeSchema {
  /** tag → allowed attribute names (href / src are also URL-checked). */
  tags: Readonly<Record<string, readonly string[]>>;
  /** Renamed tags, e.g. b → strong (the rename target must be allowed). */
  rename?: Readonly<Record<string, string>>;
}

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#|\.{1,2}\/)/i;
/** True for URLs safe to link: http(s), mailto, tel and relative ones (never javascript:, data:, vbscript: …). */
export const isSafeLink = (u: unknown): boolean => {
  const s = String(u ?? "").replace(/[\u0000- \u007f-\u009f]/g, "");
  return s.length > 0 && (SAFE_URL.test(s) || (!/^[a-z][a-z0-9+.-]*:/i.test(s) && !s.startsWith("//") && !/^[^/?#]*:/.test(s)));
};

/** Rich text: paragraphs, headings, quotes, lists, code, links, emphasis. */
export const RICH_SCHEMA: SafeSchema = {
  tags: {
    p: [], br: [], strong: [], em: [], u: [], s: [], code: ["class"], a: ["href"], h1: [], h2: [], h3: [], h4: [],
    blockquote: [], ul: [], ol: ["start"], li: ["data-task"], pre: [], hr: [], span: ["data-mention"],
  },
  rename: { b: "strong", i: "em", strike: "s", del: "s", ins: "u", h5: "h4", h6: "h4", tt: "code", kbd: "code", samp: "code" },
};
