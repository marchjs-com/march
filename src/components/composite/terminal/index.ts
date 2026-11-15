// Terminal (hadi-march/components/composite/terminal): an extensible command line in the page.
//  - Commands: a function, or a spec with a description, typed arguments (choices, required, rest), options
//    (--name=value, -f), sub-commands and a handler; handlers may be async and are cancelled with Ctrl+C (io.signal).
//    Built in: help, clear, history. Every terminal also takes the commands registered with defineTerminalCommands()
//    (plug-ins, other packages).
//  - Output: ANSI colors and styles, [ok] [warn] [err] [info] tags, links, tables, JSON trees, progress bars,
//    spinners and any March node. No HTML is parsed (CSP-safe). Old lines are dropped past `maxLines`.
//  - Input: history (↑ ↓, Ctrl+R search, kept in localStorage with `persist`), Tab completion (commands, sub-commands,
//    choices, --options), Ctrl+C / Ctrl+L / Ctrl+U, Home / End; a pasted multi-line text runs line by line.
//  - Look: colors follow the theme ("auto") or a scheme ("dark", "light", or your own 16 colors); font and cursor
//    (bar, block, underline) can be set.
//
//   <Terminal prompt="hadi$ " welcome="[info] help yaz" persist="demo" commands={{
//     echo: (a, io) => io.print(a.rest.join(" ")),
//     deploy: { desc: "Yayınla", args: [{ name: "env", choices: ["staging", "prod"], required: true }],
//               run: async (a, io) => { const p = io.progress("Yükleniyor"); await go(a.args.env, p.set); p.done(); io.success("Bitti") } },
//   }} ref={(t) => t.exec("help")} />
import "./terminal.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { signal, onCleanup, untrack, effect, reactive } from "../../../core/reactive.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { clamp, load, save } from "../../../core/util.ts";
import { tokenizeCommand, parseArgs, usageOf, type ArgSpec, type OptionSpec, type Parsed } from "./parse.ts";
import { renderLine, ansi } from "./ansi.ts";
import { Window, type WindowProps } from "../../layout/window/index.ts";
import { terminal as terminalIcon } from "../../../icons/glyphs/terminal.ts";
import { glyph } from "../../../ui/util.ts";
import { stickToBottom } from "../../../ui/observe.ts";
import { Progress } from "../../feedback/progress/index.ts";
import { Spinner } from "../../feedback/spinner/index.ts";

export { ansi, tokenizeCommand, parseArgs, usageOf };
export type { ArgSpec, OptionSpec, Parsed };

export type Tone = "success" | "warn" | "error" | "info" | "muted";
export interface PrintOptions { tone?: Tone; /** Palette color 0–15. */ color?: number; bold?: boolean }

/** What a command handler writes with and checks. */
export interface TerminalIO {
  print(text: unknown, opts?: PrintOptions): void;
  success(text: string): void; warn(text: string): void; error(text: string): void; info(text: string): void;
  link(text: string, href: string): void;
  table(rows: readonly Record<string, unknown>[] | readonly unknown[][], columns?: readonly string[]): void;
  json(value: unknown, open?: number): void;
  progress(label: string): { set(fraction: number): void; done(text?: string): void; fail(text?: string): void };
  spinner(label: string): { done(text?: string): void; fail(text?: string): void };
  clear(): void;
  /** Aborted by Ctrl+C. */
  readonly signal: AbortSignal;
  /** The terminal itself (run another command, read history…). */
  readonly term: TerminalApi;
}

export type CommandFn = (parsed: Parsed, io: TerminalIO) => unknown;
export interface CommandSpec {
  desc?: string;
  args?: readonly ArgSpec[];
  options?: Record<string, OptionSpec>;
  sub?: Record<string, Command>;
  run?: CommandFn;
  /** Left out of help (still runs). */
  hidden?: boolean;
}
/** A terminal command: a function or a spec with sub-commands. */
export type TerminalCommand = CommandFn | CommandSpec;
/** The old name of TerminalCommand (kept for imports from this module; in the barrels `Command` is the command palette's). */
export type Command = TerminalCommand;

export interface TerminalApi {
  exec(line: string): Promise<void>;
  print(text: unknown, opts?: PrintOptions): void;
  clear(): void;
  register(name: string, cmd: Command): () => void;
  history(): readonly string[];
  focus(): void;
  /** Cancel the running command (as Ctrl+C). */
  cancel(): void;
}

export type ColorScheme = "auto" | "surface" | "dark" | "light" | { bg?: string; fg?: string; cursor?: string; selection?: string; colors?: readonly string[] };

export interface TerminalProps {
  commands?: Record<string, Command>;
  prompt?: MaybeFn<string>;
  /** A log the app writes to with `print` (build output, a server's lines): no prompt and no input line. */
  readonly?: boolean | undefined;
  /** Lines printed first (a string or a list). */
  welcome?: string | readonly string[];
  /** Keep the history in localStorage under "m.term.<persist>". */
  persist?: string;
  /** "auto" (default): a very dark charcoal tinted by the theme color; "surface": the page's own surfaces (light in a
   *  light theme); "dark" / "light": fixed schemes; or your own colors. Live: changing it restyles the terminal. */
  scheme?: MaybeFn<ColorScheme | undefined>;
  /** Background color (any CSS color); the text color follows it for contrast. Live. */
  background?: MaybeFn<string | undefined>;
  cursor?: "bar" | "block" | "underline";
  font?: string;
  /** Oldest lines are dropped past this many (default 2000). */
  maxLines?: number;
  /** Height of the terminal (CSS length, default 22rem). */
  height?: string;
  label?: string;
  /** The cursor blinks (default true); false keeps it lit. */
  blink?: boolean;
  /** The built-in `help`, `clear` and `history` commands (default true); false leaves only yours (same names in `commands` replace them one by one). */
  builtins?: boolean;
  /** Own texts: the input's accessible name, the Ctrl+R prompt and the "command not found" line. */
  labels?: { command?: string; historySearch?: string; notFound?: (name: string) => string } | undefined;
  class?: ClassProp;
  ref?: (api: TerminalApi) => void;
}

// commands every terminal takes (plug-ins and other packages add theirs here)
const GLOBAL = new Map<string, Command>();
/** Commands for every terminal on the page; returns a function that takes them out. */
export function defineTerminalCommands(cmds: Record<string, Command>): () => void {
  for (const [k, v] of Object.entries(cmds)) GLOBAL.set(k, v);
  return () => { for (const k of Object.keys(cmds)) if (GLOBAL.get(k) === cmds[k]) GLOBAL.delete(k); };
}

/** The fixed schemes (a terminal look that does not follow the theme): background, text, cursor and 16 colors. */
export const TERMINAL_SCHEMES = {
  dark: { bg: "#0f1420", fg: "#d8dee9", cursor: "#f2801f", selection: "#3b425280", colors: ["#3b4252", "#f2777a", "#99cc99", "#ffcc66", "#6699cc", "#cc99cc", "#66cccc", "#d8dee9", "#6b7385", "#ff9b9b", "#b5e8b5", "#ffe08a", "#8fb7e6", "#e2b3e2", "#8fe0e0", "#ffffff"] },
  light: { bg: "#fbfbfd", fg: "#1f2430", cursor: "#f2801f", selection: "#1d9ad633", colors: ["#1f2430", "#c0392b", "#2e7d32", "#a86200", "#1565c0", "#8e24aa", "#00838f", "#5f6672", "#8a909c", "#e53935", "#43a047", "#f57c00", "#1e88e5", "#ab47bc", "#00acc1", "#ffffff"] },
} as const;

const specOf = (c: Command): CommandSpec => (typeof c === "function" ? { run: c } : c);
const TONE: Record<Tone, string> = { success: "ok", warn: "warn", error: "err", info: "info", muted: "" };

/** The filled part of an io.progress bar, 0–1 (made here: inside the terminal `signal` names the abort signal of a command). */
const fraction = (): ReturnType<typeof signal<number>> => signal(0);

/** An extensible command line: commands with typed arguments, colored output, history, completion, themable colors. */
export function Terminal(props: TerminalProps): Element {
  const own = new Map<string, Command>(Object.entries(props.commands ?? {}));
  const all = (): Map<string, Command> => new Map([...(props.builtins === false ? [] : BUILTIN), ...GLOBAL, ...own]);
  const blink = props.blink !== false;
  const searchText = (): string => props.labels?.historySearch ?? t`history search`;
  const max = props.maxLines ?? 2000;
  const key = props.persist ? `m.term.${props.persist}` : "";
  let hist: string[] = [];
  if (key) hist = load<string[]>(key, []);
  let at = hist.length, draft = "";
  const busy = signal(false);
  let ctl: AbortController | null = null;
  let search: { q: string; hit: number } | null = null;

  const out = h("div", { class: "m-term-out", role: "log", "aria-live": "polite", "aria-label": () => props.label ?? t`Terminal output` }) as HTMLElement;
  const input = h("input", { class: "m-term-input", type: "text", spellcheck: "false", autocomplete: "off", autocapitalize: "off", "aria-label": () => props.labels?.command ?? t`Command` }) as HTMLInputElement;
  const promptEl = h("span", { class: "m-term-prompt", "aria-hidden": "true" }, () => (search ? `(${searchText()}) ` : val(props.prompt) ?? "$ ")) as HTMLElement;
  // our own cursor: the browser's caret shows only while the input has focus; this one blinks always (solid while typing)
  const measure = h("span", { class: "m-term-measure", "aria-hidden": "true" }) as HTMLElement;
  const caret = h("span", { class: cx("m-term-caret", blink && "is-blinking"), "aria-hidden": "true" }) as HTMLElement;
  const field = h("span", { class: "m-term-field" }, input, measure, caret) as HTMLElement;
  const line = h("div", { class: "m-term-line", "data-busy": () => (busy() ? "" : null) }, promptEl, field) as HTMLElement;
  let caretTimer: ReturnType<typeof setTimeout> | undefined;
  // after the key's own effect (a keydown runs before the character lands)
  const syncCaret = (): void => {
    clearTimeout(caretTimer);
    caretTimer = setTimeout(() => {
      const at = input.selectionEnd ?? input.value.length;
      measure.textContent = input.value.slice(0, at);
      caret.textContent = input.value.charAt(at) || " ";
      caret.style.insetInlineStart = `${measure.offsetWidth - input.scrollLeft}px`;
      // typing restarts the blink: the cursor stays lit while keys come
      if (blink) { caret.classList.remove("is-blinking"); void caret.offsetWidth; caret.classList.add("is-blinking"); }
    }, 0);
  };
  for (const ev of ["keydown", "keyup", "input", "pointerup", "focus", "blur", "select", "scroll"]) input.addEventListener(ev, syncCaret);
  onCleanup(() => clearTimeout(caretTimer));
  // readonly: a log the app writes to (print); no prompt, no input line, nothing to focus
  const scroller = h("div", { class: "m-term-scroll", onClick: (e: MouseEvent) => { if (!props.readonly && !globalThis.getSelection?.()?.toString() && e.target !== input) input.focus(); } }, out, props.readonly ? null : line) as HTMLElement;

  // pinned to the bottom: every answer (also one that grows later — a table, a progress bar, a JSON tree) keeps the
  // last line in view; scrolling up to read unpins it until the reader comes back down or runs a command
  const stick = stickToBottom(scroller, { follow: out });
  const scrollDown = (): void => stick.toBottom();
  const append = (node: Node, cls = ""): HTMLElement => {
    const row = h("div", { class: cx("m-term-row", cls) }) as HTMLElement;
    row.appendChild(node);
    out.appendChild(row);
    while (out.childElementCount > max) out.firstElementChild!.remove();
    scrollDown();
    return row;
  };
  const textNode = (v: unknown, opts: PrintOptions = {}): Node => {
    if (v instanceof Node) return v;
    const s = String(v ?? "");
    const tagged = opts.tone && TONE[opts.tone] ? `[${TONE[opts.tone]}] ${s}` : s;
    const frag = renderLine(tagged);
    if (opts.color == null && !opts.bold && opts.tone !== "muted") return frag;
    return h("span", { class: cx(opts.color != null && `m-term-fg-${opts.color}`, opts.bold && "m-term-b", opts.tone === "muted" && "m-term-dim") }, frag) as Node;
  };
  const print = (v: unknown, opts?: PrintOptions): void => {
    if (typeof v === "string" && v.includes("\n")) { for (const l of v.split("\n")) append(textNode(l, opts)); return; }
    append(textNode(v, opts));
  };

  const ioFor = (signal: AbortSignal): TerminalIO => ({
    print, signal, term: api,
    success: (s) => print(s, { tone: "success" }), warn: (s) => print(s, { tone: "warn" }), error: (s) => print(s, { tone: "error" }), info: (s) => print(s, { tone: "info" }),
    link: (text, href) => append(h("a", { class: "m-term-link", href, target: "_blank", rel: "noopener noreferrer" }, text) as Node),
    table: (rows, columns) => {
      const objs = rows.length && !Array.isArray(rows[0]);
      const cols = columns ?? (objs ? [...new Set((rows as Record<string, unknown>[]).flatMap((r) => Object.keys(r)))] : []);
      const cells = (r: unknown): unknown[] => (Array.isArray(r) ? r : cols.map((c) => (r as Record<string, unknown>)[c]));
      append(h("table", { class: "m-term-table" },
        cols.length ? h("thead", {}, h("tr", {}, cols.map((c) => h("th", {}, c)))) : null,
        h("tbody", {}, rows.map((r) => h("tr", {}, cells(r).map((c) => h("td", {}, textNode(c))))))) as Node);
    },
    json: (value, open = 1) => {
      const slot = append(h("span", { class: "m-term-dim" }, "…") as Node);
      void import("../../data/json-view/index.ts").then((m) => slot.replaceChildren(m.JsonView({ value, open }) as Node));
    },
    progress: (label) => {
      // the bar is decoration: the percent text beside it is what the log reads out
      const part = fraction();
      const pct = h("span", { class: "m-term-dim" }, " 0%") as HTMLElement;
      const row = append(h("span", {}, `${label} `, h(Progress, { class: "m-term-bar", value: part, max: 1, decorative: true }), pct) as Node);
      const set = (f: number): void => { const p = clamp(f, 0, 1); part.set(p); pct.textContent = ` ${Math.round(p * 100)}%`; };
      return { set, done: (s) => { set(1); row.replaceChildren(textNode(s ?? label, { tone: "success" })); }, fail: (s) => { row.replaceChildren(textNode(s ?? label, { tone: "error" })); } };
    },
    spinner: (label) => {
      const row = append(h("span", {}, h(Spinner, { class: "m-term-spin", size: "em", decorative: true }), ` ${label}`) as Node);
      return { done: (s) => row.replaceChildren(textNode(s ?? label, { tone: "success" })), fail: (s) => row.replaceChildren(textNode(s ?? label, { tone: "error" })) };
    },
    clear: () => out.replaceChildren(),
  });

  /** Find the command (and sub-command) a list of words names; returns it and the words left for its arguments. */
  const resolve = (words: string[]): { spec: CommandSpec; path: string[]; rest: string[] } | null => {
    const first = all().get(words[0] ?? "");
    if (!first) return null;
    let spec = specOf(first), i = 1;
    const path = [words[0]!];
    while (spec.sub && words[i] && spec.sub[words[i]!]) { spec = specOf(spec.sub[words[i]!]!); path.push(words[i]!); i++; }
    return { spec, path, rest: words.slice(i) };
  };

  const exec = async (raw: string): Promise<void> => {
    const lineText = raw.trim();
    append(h("span", {}, h("span", { class: "m-term-prompt" }, val(props.prompt) ?? "$ "), lineText) as Node, "m-term-echo");
    if (!lineText) return;
    if (hist[hist.length - 1] !== lineText) { hist.push(lineText); if (hist.length > 500) hist = hist.slice(-500); if (key) save(key, hist); }
    at = hist.length;
    const words = tokenizeCommand(lineText);
    const found = resolve(words);
    if (!found) { print(props.labels?.notFound?.(words[0] ?? "") ?? (props.builtins === false && !all().has("help") ? t`command not found: ${words[0]}` : t`command not found: ${words[0]} (try help)`), { tone: "error" }); return; }
    const { spec, path, rest } = found;
    if (!spec.run) { print(`${usageOf(path.join(" "), spec.args, spec.options)}`, { tone: "muted" }); if (spec.sub) print(`  ${Object.keys(spec.sub).join("  ")}`); return; }
    let parsed: Parsed;
    try { parsed = parseArgs(rest, spec.args, spec.options); } catch (e) { print(`${path.join(" ")}: ${(e as Error).message}`, { tone: "error" }); print(usageOf(path.join(" "), spec.args, spec.options), { tone: "muted" }); return; }
    ctl = new AbortController();
    busy.set(true);
    try { await spec.run(parsed, ioFor(ctl.signal)); }
    catch (e) { if (!ctl.signal.aborted) print((e as Error)?.message ?? String(e), { tone: "error" }); }
    finally { if (ctl.signal.aborted) print("^C", { tone: "muted" }); ctl = null; busy.set(false); scrollDown(); }
  };

  const complete = (): void => {
    const v = input.value, words = tokenizeCommand(v), trailing = /\s$/.test(v);
    const cur = trailing ? "" : words.pop() ?? "";
    let options: string[];
    if (words.length === 0) options = [...all().entries()].filter(([, c]) => !specOf(c).hidden).map(([k]) => k);
    else {
      const f = resolve(words);
      if (!f) return;
      const argIx = f.rest.filter((w) => !w.startsWith("-")).length;
      options = [...Object.keys(f.spec.sub ?? {}), ...(f.spec.args?.[argIx]?.choices ?? []), ...Object.keys(f.spec.options ?? {}).map((o) => `--${o}`)];
    }
    const hits = options.filter((o) => o.startsWith(cur));
    if (hits.length === 1) { input.value = [...words, hits[0]].join(" ") + " "; return; }
    if (hits.length > 1) {
      let p = cur;
      while (hits.every((x) => x.startsWith(hits[0]!.slice(0, p.length + 1))) && p.length < hits[0]!.length) p = hits[0]!.slice(0, p.length + 1);
      if (p !== cur) input.value = [...words, p].join(" ");
      else print(hits.join("  "), { tone: "muted" });
    }
  };

  const findHistory = (q: string, from: number): number => { for (let i = Math.min(from, hist.length - 1); i >= 0; i--) if (hist[i]!.includes(q)) return i; return -1; };
  const onKey = (e: KeyboardEvent): void => {
    if (search) {
      if (e.key === "Escape" || (e.ctrlKey && e.key === "g")) { e.preventDefault(); search = null; input.value = draft; promptEl.textContent = val(props.prompt) ?? "$ "; return; }
      if (e.ctrlKey && e.key === "r") { e.preventDefault(); const i = findHistory(search.q, search.hit - 1); if (i >= 0) { search.hit = i; input.value = hist[i]!; } return; }
      if (e.key === "Enter") { search = null; promptEl.textContent = val(props.prompt) ?? "$ "; }
    }
    if (e.ctrlKey && e.key === "c") { if (ctl) { e.preventDefault(); ctl.abort(); } else if (!globalThis.getSelection?.()?.toString()) { e.preventDefault(); append(h("span", {}, h("span", { class: "m-term-prompt" }, val(props.prompt) ?? "$ "), input.value, "^C") as Node, "m-term-echo"); input.value = ""; } return; }
    if (e.ctrlKey && e.key === "l") { e.preventDefault(); out.replaceChildren(); return; }
    if (e.ctrlKey && e.key === "u") { e.preventDefault(); input.value = ""; return; }
    if (e.ctrlKey && e.key === "r") { e.preventDefault(); draft = input.value; search = { q: "", hit: hist.length }; promptEl.textContent = `(${searchText()}) `; input.value = ""; return; }
    if (e.key === "Tab") { e.preventDefault(); complete(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); if (at === hist.length) draft = input.value; if (at > 0) { at--; input.value = hist[at]!; } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); if (at < hist.length) { at++; input.value = at === hist.length ? draft : hist[at]!; } return; }
    if (e.key === "Enter") { e.preventDefault(); if (busy()) return; const v = input.value; input.value = ""; void exec(v); }
  };
  input.addEventListener("keydown", onKey);
  input.addEventListener("input", () => { if (search) { search.q = input.value; const i = findHistory(search.q, hist.length - 1); search.hit = i; if (i >= 0) promptEl.textContent = `(${searchText()}) ${hist[i]} ← `; } });
  // a pasted block of lines runs one by one
  input.addEventListener("paste", (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData("text") ?? "";
    if (!text.includes("\n")) return;
    e.preventDefault();
    void (async () => { for (const l of text.split(/\r?\n/)) if (l.trim()) await exec(l); })();
  });

  const api: TerminalApi = {
    exec, print, clear: () => out.replaceChildren(), focus: () => input.focus(), history: () => hist.slice(), cancel: () => ctl?.abort(),
    register: (name, cmd) => { own.set(name, cmd); const off = (): void => { if (own.get(name) === cmd) own.delete(name); }; return off; },
  };
  Object.defineProperty(api, "_all", { value: all });

  const schemeOf = (): ColorScheme => val(props.scheme) ?? "auto";
  const root = h("div", { class: () => { const sc = schemeOf(); return cx("m-term", `m-term-${typeof sc === "string" ? sc : "custom"}`, `m-term-cursor-${props.cursor ?? "bar"}`, val(props.class)); }, dir: "ltr" }, scroller) as HTMLElement;
  // the look is live: a new scheme or background replaces the variables the previous one set
  let set: string[] = [];
  effect(() => {
    const sc = schemeOf();
    const look = typeof sc === "object" ? sc : sc === "dark" || sc === "light" ? TERMINAL_SCHEMES[sc] : null;
    const style: Record<string, string> = {};
    if (look) {
      if (look.bg) style["--m-term-bg"] = look.bg;
      if (look.fg) style["--m-term-fg"] = look.fg;
      if (look.cursor) style["--m-term-cursor"] = look.cursor;
      if (look.selection) style["--m-term-sel"] = look.selection;
      look.colors?.forEach((c, i) => { style[`--m-term-c${i}`] = c; });
    }
    const bg = val(props.background);
    if (bg) { style["--m-term-bg"] = bg; delete style["--m-term-fg"]; }
    if (props.font) style["--m-term-font"] = props.font;
    if (props.height) style["--m-term-h"] = props.height;
    for (const k of set) if (!(k in style)) root.style.removeProperty(k);
    for (const [k, v] of Object.entries(style)) root.style.setProperty(k, v);
    set = Object.keys(style);
    root.classList.toggle("is-custom-bg", !!bg);
  });

  for (const l of typeof props.welcome === "string" ? [props.welcome] : props.welcome ?? []) print(l);
  untrack(() => props.ref?.(api));
  syncCaret();
  onCleanup(() => ctl?.abort());
  return root;
}

/** Window props a TerminalWindow passes to its window (the rest go to the terminal; `persist` keys both). */
export type TerminalWindowProps = TerminalProps & Pick<WindowProps, "title" | "icon" | "chrome" | "x" | "y" | "width" | "minWidth" | "minHeight" | "state" | "onStateChange"
  | "open" | "onClose" | "minimizable" | "maximizable" | "closable" | "movable" | "resizable" | "snap"> & {
  /** Window height in px (the terminal fills it). */
  windowHeight?: number;
};

const WINDOW_KEYS = new Set(["title", "icon", "chrome", "x", "y", "width", "windowHeight", "minWidth", "minHeight", "state", "onStateChange", "open", "onClose",
  "minimizable", "maximizable", "closable", "movable", "resizable", "snap", "class"]);

/** A Terminal in a Window: move, resize, dock, minimize, fill, close; Windows, Mac or HADİ look. */
export function TerminalWindow(props: TerminalWindowProps): unknown {
  // forward each prop as a getter, so live props (scheme, prompt, chrome, open…) stay live on both sides
  const term: Record<string, unknown> = {}, win: Record<string, unknown> = {};
  // (a terminal prop goes on as a reactive thunk: h() turns that into a live prop; a plain getter would be read once)
  for (const k of Object.keys(props)) {
    const get = (): unknown => (props as Record<string, unknown>)[k];
    if (WINDOW_KEYS.has(k)) Object.defineProperty(win, k, { get, enumerable: true });
    else term[k] = /^on[A-Z:]/.test(k) ? get() : reactive(get);
  }
  const p = props as Record<string, unknown>;
  return h(Window, {
    title: reactive(() => (p["title"] as string | undefined) ?? "Terminal"), icon: props.icon ?? glyph(terminalIcon), chrome: reactive(() => val(props.chrome)),
    x: props.x, y: props.y, width: props.width ?? 560, height: props.windowHeight ?? 340, minWidth: props.minWidth ?? 280, minHeight: props.minHeight,
    state: reactive(() => val(props.state)), onStateChange: props.onStateChange, open: props.open == null ? undefined : reactive(() => val(props.open)), onClose: props.onClose,
    minimizable: props.minimizable, maximizable: props.maximizable, closable: props.closable, movable: props.movable, resizable: props.resizable, snap: props.snap,
    persist: props.persist ? `term.${props.persist}` : undefined, class: reactive(() => cx("m-term-window", val(props.class))),
  }, h(Terminal, Object.defineProperty(term, "height", { value: "100%", enumerable: true }) as TerminalProps));
}

const BUILTIN = new Map<string, Command>([
  ["help", { desc: "Komutları ve kullanımlarını gösterir", args: [{ name: "command" }], run: (a, io) => {
    const name = a.args["command"] as string | undefined;
    // the terminal's own list: built in, page-wide and its own commands
    const list = (io.term as TerminalApi & { _all?: () => Map<string, Command> })._all?.() ?? BUILTIN;
    if (name) { const c = list.get(name); if (!c) { io.error(t`command not found: ${name}`); return; } const s = specOf(c); io.print(usageOf(name, s.args, s.options), { bold: true }); if (s.desc) io.print(`  ${s.desc}`, { tone: "muted" }); for (const ar of s.args ?? []) io.print(`  <${ar.name}>  ${ar.desc ?? ""}${ar.choices ? ` (${ar.choices.join(" | ")})` : ""}`, { tone: "muted" }); for (const [k, o] of Object.entries(s.options ?? {})) io.print(`  --${k}${o.alias ? `, -${o.alias}` : ""}  ${o.desc ?? ""}`, { tone: "muted" }); if (s.sub) io.print(`  ${Object.keys(s.sub).join("  ")}`); return; }
    const rows = [...list.entries()].filter(([, c]) => !specOf(c).hidden).map(([k, c]) => [ansi.cyan(k), specOf(c).desc ?? ""]);
    io.table(rows);
  } }],
  ["clear", { desc: "Ekranı temizler (Ctrl+L)", run: (_a, io) => io.clear() }],
  ["history", { desc: "Komut geçmişini gösterir", run: (_a, io) => { io.term.history().forEach((l, i) => io.print(`${ansi.gray(String(i + 1).padStart(4))}  ${l}`)); } }],
]);
