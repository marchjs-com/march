// ClipboardManager: copy and paste in one place — text, rich (HTML) and file content, a "copied" signal for feedback,
// a short history and paste handling. Falls back to a hidden textarea where the async Clipboard API is missing.
//
//   import { clipboard } from "hadi-march/managers/clipboard";
//   await clipboard().copy("token-123")              // true when it worked
//   await clipboard().copy({ text: "Hi", html: "<b>Hi</b>" })
//   clipboard().copied()                             // true for `resetMs` after a copy (button feedback)
//   clipboard().history()  clipboard().read()        // last copies (newest first); read text (asks permission)
//   clipboard().onPaste(el, (p) => p.text, p.files)  // paste into an element
//   <button copy:text={() => link}>Copy link</button>
import { signal, untrack, type Accessor } from "../../core/reactive.ts";
import { registerNamespace } from "../../dom/h.ts";
import { on } from "../../core/util.ts";
import { openLayer } from "../../dom/portal.ts";
import { defineManager } from "../manager.ts";
import { publisher } from "../publish.ts";

/** What copy() takes: plain text, text + HTML, or a Blob (an image). */
export type ClipContent = string | { text: string; html?: string } | Blob;
/** One paste, as onPaste() gives it. */
export interface PasteData { text: string; html: string; files: File[]; event: ClipboardEvent }
export interface ClipEntry { text: string; kind: "text" | "html" | "blob"; at: number }

export interface ClipboardConfig {
  /** How long copied() stays true (ms). Default 1500. */
  resetMs: number;
  /** Copies kept in history() (0 = none). Default 10. */
  historySize: number;
}

export interface Clipboard {
  copy(content: ClipContent): Promise<boolean>;
  /** Read text from the clipboard (the browser may ask for permission). Rejects when not allowed. */
  read(): Promise<string>;
  /** True right after a successful copy, for `resetMs`. */
  copied: Accessor<boolean>;
  /** The last copied text. */
  last(): string | undefined;
  /** Recent copies, newest first. */
  history: Accessor<readonly ClipEntry[]>;
  clearHistory(): void;
  /** Listen for paste on an element (removed with the current owner). Return false from fn to keep the default. */
  onPaste(el: EventTarget, fn: (p: PasteData) => unknown): () => void;
  /** The async Clipboard API is available (else the textarea fallback is used for text). */
  supported(): boolean;
  dispose(): void;
}

const pub = publisher("clipboard");

/** Copy text without the async API: select a hidden textarea and run the copy command. */
function legacyCopy(text: string): boolean {
  const doc = globalThis.document;
  if (!doc?.body) return false;
  const ta = doc.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.setAttribute("aria-hidden", "true");
  for (const [k, v] of [["position", "fixed"], ["opacity", "0"], ["pointer-events", "none"], ["inset-block-start", "0"]]) ta.style.setProperty(k as string, v as string);
  const close = openLayer("fx", ta); // the layer stack, never body.append
  try {
    ta.select();
    return (doc as Document & { execCommand?: (c: string) => boolean }).execCommand?.("copy") === true;
  } catch { return false; } finally { close(); }
}

function create(cfg: ClipboardConfig): Clipboard {
  const copied = signal(false, { name: "clipboard.copied" });
  const history = signal<readonly ClipEntry[]>([], { name: "clipboard.history" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const api = (): globalThis.Clipboard | undefined => globalThis.navigator?.clipboard;

  const done = (text: string, kind: ClipEntry["kind"]): void => {
    clearTimeout(timer);
    copied.set(true);
    timer = setTimeout(() => copied.set(false), cfg.resetMs);
    if (cfg.historySize > 0) history.update((h) => [{ text, kind, at: Date.now() }, ...h.filter((e) => e.text !== text)].slice(0, cfg.historySize));
    pub("copy", { kind, length: text.length });
  };

  async function copy(content: ClipContent): Promise<boolean> {
    const c = api();
    const Item = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    try {
      if (typeof content === "string") {
        if (c?.writeText) await c.writeText(content);
        else if (!legacyCopy(content)) throw new Error("copy not available");
        done(content, "text");
      } else if (typeof Blob !== "undefined" && content instanceof Blob) {
        if (!c?.write || !Item) throw new Error("copying files is not supported here");
        await c.write([new Item({ [content.type]: content })]);
        done(`[${content.type}]`, "blob");
      } else {
        const { text, html } = content as { text: string; html?: string };
        if (html && c?.write && Item) {
          await c.write([new Item({ "text/plain": new Blob([text], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) })]);
          done(text, "html");
        } else return await copy(text);
      }
      return true;
    } catch (e) {
      pub("error", { error: e });
      return false;
    }
  }

  return {
    copy,
    async read() {
      const c = api();
      if (!c?.readText) throw new Error("March clipboard: reading is not supported here.");
      const text = await c.readText();
      pub("read", { length: text.length });
      return text;
    },
    copied,
    last: () => history()[0]?.text,
    history,
    clearHistory: () => history.set([]),
    onPaste(el, fn) {
      return on<ClipboardEvent>(el, "paste", (e) => {
        const d = e.clipboardData;
        const p: PasteData = { text: d?.getData("text/plain") ?? "", html: d?.getData("text/html") ?? "", files: d ? Array.from(d.files ?? []) : [], event: e };
        pub("paste", { length: p.text.length, files: p.files.length });
        if (fn(p) !== false) e.preventDefault();
      });
    },
    supported: () => !!api()?.writeText,
    dispose() { clearTimeout(timer); },
  };
}

const manager = defineManager<Clipboard, ClipboardConfig>("clipboard", create, { resetMs: 1500, historySize: 10 });

/** The clipboard manager (created on first call). */
export const clipboard = (): Clipboard => manager.get();
export const configureClipboard = (config: Partial<ClipboardConfig>): void => manager.configure(config);
export const disposeClipboard = (): void => manager.dispose();
export const clipboardManager = manager;

// copy:text={value} — a click copies the value; aria-live tells screen readers. `copy:html` copies { text, html }.
registerNamespace("copy", (el, kind, value) => {
  const read = (): unknown => (typeof value === "function" ? (value as () => unknown)() : value);
  on(el, "click", () => {
    const v = untrack(read);
    void clipboard().copy(kind === "html" && v && typeof v === "object" ? (v as { text: string; html: string }) : String(v ?? ""));
  });
});
