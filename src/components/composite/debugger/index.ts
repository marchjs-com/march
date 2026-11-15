// Debugger (hadi-march/ui): the panel of a debugger over a DebugSession (session.ts): the controls (Start, Continue,
// Step over / into / out, Step back, Stop) with where it stopped and why, a timeline of the recording (time travel),
// and the sections Watch (expressions evaluated at every stop), Scope (local / closure / module names with their values
// then), Call stack (a frame shows its own place and scope), Breakpoints (on / off, condition, logpoint message) and
// Output (the code's console and the logpoints up to the step shown). The breakpoints themselves are set in a code
// editor's gutter (CodeEditor lineNumbers + onGutter; march-app-ui's debuggerPlugin wires both). Every text, icon and
// section can be changed or turned off.
import "./debugger.css";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { signal, computed, untrack } from "../../../core/reactive.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { defineIcon, type IconDef } from "../../../icons/svg.ts";
import { play } from "../../../icons/glyphs/play.ts";
import { rotateCcw } from "../../../icons/glyphs/rotateCcw.ts";
import { skipBack } from "../../../icons/glyphs/skipBack.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { Toolbar } from "../../layout/stack/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Slider } from "../../forms/slider/index.ts";
import { Disclosure } from "../../layout/disclosure/index.ts";
import { JsonView } from "../../data/json-view/index.ts";
import { TextInput } from "../../forms/text-input/index.ts";
import { Checkbox } from "../../forms/checkbox/index.ts";
import { Toggle } from "../../forms/toggle/index.ts";
import { Badge } from "../../data/badge/index.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import { Splitter } from "../../layout/splitter/index.ts";
import { CopyButton } from "../../actions/copy-button/index.ts";
import { stickToBottom } from "../../../ui/observe.ts";
import { accessorKind, isUndeclared, text, type DebugSession, type StepView, type WatchValue } from "./session.ts";

export { createDebugSession, accessorKind, isUndeclared } from "./session.ts";
export type { DebugSession, DebugSessionOptions, DebugMeta, Breakpoint, Watch, WatchValue, StackFrame, ScopeGroup, StepView, OutputLine, DebugState, PauseReason } from "./session.ts";

messages("tr", {
  "Debugger": "Hata ayıklayıcı", "Start debugging": "Hata ayıklamayı başlat", "Restart": "Yeniden başlat", "Continue": "Devam", "Step over": "Üstünden adım",
  "Step into": "İçine adım", "Step out": "Dışına adım", "Step back": "Geri adım", "Stop": "Durdur", "Watch": "İzlenenler", "Scope": "Kapsam",
  "Call stack": "Çağrı yığını", "Breakpoints": "Kesme noktaları", "Output": "Çıktı", "Local": "Yerel", "Closure": "Kapanış", "Module": "Modül",
  "Add expression": "İfade ekle (Enter)", "Remove": "Kaldır", "condition": "koşul", "log message, {x}": "günlük mesajı, {x}",
  "Not debugging": "Hata ayıklanmıyor", "Running": "Çalışıyor: bir sonraki durak bekleniyor", "Paused on breakpoint": "Kesme noktasında durdu",
  "Paused on debugger statement": "debugger deyiminde durdu", "Paused on exception": "Hatada durdu", "Paused": "Durdu", "Paused on entry": "Girişte durdu",
  "Recording": "Kayıt", "step": "adım", "Pause on exceptions": "Hatalarda dur", "Stop on entry": "Girişte dur", "Breakpoints on": "Kesme noktaları açık",
  "Remove all": "Tümünü kaldır", "No watches": "İzlenen ifade yok", "No breakpoints: click a line number in the editor (F9 at the caret)": "Kesme noktası yok: editörde satır numarasına tıkla (imleçte F9)",
  "Nothing yet": "Henüz bir şey yok", "Copy the output": "Çıktıyı kopyala", "Not paused": "Durmadı", "not yet defined": "henüz tanımsız", "Timeline": "Zaman çizelgesi",
  "Start a run, then set breakpoints or add debugger; to the code": "Çalıştırmayı başlat; kesme noktası koy ya da koda debugger; yaz",
});

/** The panel's sections. */
export type DebuggerSection = "watch" | "scope" | "stack" | "breakpoints" | "output";
/** The panel's buttons (their icons can be your own). */
export type DebuggerIcon = "start" | "restart" | "resume" | "over" | "into" | "out" | "back" | "stop";
/** The panel's texts (each defaults to an English text, translated). */
export interface DebuggerLabels {
  title: string; start: string; restart: string; resume: string; over: string; into: string; out: string; back: string; stop: string;
  watch: string; scope: string; stack: string; breakpoints: string; output: string; local: string; closure: string; module: string;
  addWatch: string; remove: string; condition: string; log: string; idle: string; running: string; breakpoint: string; debugger: string;
  exception: string; paused: string; entry: string; step: string; pauseOnExceptions: string; stopOnEntry: string; breakpointsOn: string;
  removeAll: string; noWatches: string; noBreakpoints: string; nothing: string; copyOutput: string; notPaused: string; undeclared: string; timeline: string; hint: string;
}
const LABELS: DebuggerLabels = {
  title: "Debugger", start: "Start debugging", restart: "Restart", resume: "Continue", over: "Step over", into: "Step into", out: "Step out",
  back: "Step back", stop: "Stop", watch: "Watch", scope: "Scope", stack: "Call stack", breakpoints: "Breakpoints", output: "Output", local: "Local",
  closure: "Closure", module: "Module", addWatch: "Add expression", remove: "Remove", condition: "condition", log: "log message, {x}",
  idle: "Not debugging", running: "Running", breakpoint: "Paused on breakpoint", debugger: "Paused on debugger statement", exception: "Paused on exception",
  paused: "Paused", entry: "Paused on entry", step: "step", pauseOnExceptions: "Pause on exceptions", stopOnEntry: "Stop on entry",
  breakpointsOn: "Breakpoints on", removeAll: "Remove all", noWatches: "No watches", noBreakpoints: "No breakpoints: click a line number in the editor (F9 at the caret)",
  nothing: "Nothing yet", copyOutput: "Copy the output", notPaused: "Not paused", undeclared: "not yet defined", timeline: "Timeline", hint: "Start a run, then set breakpoints or add debugger; to the code",
};
const KEYS: Partial<Record<DebuggerIcon, string>> = { resume: "F8", over: "F10", into: "F11", out: "Shift+F11", stop: "Shift+F5", start: "F5", restart: "Ctrl+Shift+F5" };

// the step icons the catalog does not have
const ICONS: Record<DebuggerIcon, IconDef> = {
  start: play, restart: rotateCcw, back: skipBack,
  resume: defineIcon("debug-continue", ["M6 4v16", "M10 4l10 8-10 8z"]),
  over: defineIcon("debug-step-over", ["M4 14a8 8 0 0 1 15.5-2.5", "M20 7v5h-5", "M12 20h.01"]),
  into: defineIcon("debug-step-into", ["M12 3v12", "M7 10l5 5 5-5", "M12 20h.01"]),
  out: defineIcon("debug-step-out", ["M12 16V4", "M7 9l5-5 5 5", "M12 20h.01"]),
  stop: defineIcon("debug-stop", ["M6 6h12v12H6z"]),
};

export interface DebuggerProps {
  /** The debug session the panel shows and drives (createDebugSession). @tr Panelin gösterdiği ve yönettiği hata ayıklama oturumu (createDebugSession). */
  session: DebugSession;
  /** Start (idle) or restart (a run is on) a run: the host builds the code with the debugger's calls. No button without it. @tr Bir çalıştırmayı başlat (boştayken) ya da yeniden başlat (çalışırken): kodu hata ayıklayıcı çağrılarıyla ana uygulama derler. Verilmezse düğme yok. */
  onStart?: (() => void) | undefined;
  /** End the run (default: `session.end()`); the host may build the code again without the calls. @tr Çalıştırmayı bitir (varsayılan: `session.end()`); ana uygulama kodu çağrılar olmadan yeniden derleyebilir. */
  onStop?: (() => void) | undefined;
  /** A frame, a breakpoint or an output line was pressed: show that file at that line. @tr Bir çerçeveye, kesme noktasına ya da çıktı satırına basıldı: o dosyayı o satırda göster. */
  onReveal?: ((file: string, line: number) => void) | undefined;
  /** The sections, in this order (default: watch, scope, stack, breakpoints, output). @tr Bölümler, bu sırayla (varsayılan: watch, scope, stack, breakpoints, output). */
  sections?: MaybeFn<readonly DebuggerSection[] | undefined>;
  /**
   * How the sections stand: one per row, or two side by side in a row whose divider is dragged (default: watch | scope,
   * breakpoints | stack, then output). A section of `sections` the layout does not name gets a row of its own.
   * @tr Bölümlerin dizilişi: satır başına bir tane ya da ayracı sürüklenen bir satırda yan yana iki tane (varsayılan: watch | scope, breakpoints | stack, sonra output). Düzende adı geçmeyen bölüm kendi satırını alır.
   */
  layout?: readonly (DebuggerSection | readonly [DebuggerSection, DebuggerSection])[] | undefined;
  /** Lines of the output shown at once (default 4; it scrolls, the newest line in view). @tr Çıktının bir anda görünen satır sayısı (varsayılan 4; kayar, en yeni satır görünür kalır). */
  outputLines?: number | undefined;
  /** The sections open at first (default: all). @tr Başta açık olan bölümler (varsayılan: hepsi). */
  open?: readonly DebuggerSection[] | undefined;
  /** The timeline of the recording, to go back and forth in time (default true). @tr Zamanda ileri geri gitmek için kaydın zaman çizelgesi (varsayılan true). */
  timeline?: MaybeFn<boolean | undefined>;
  /** The switches: pause on exceptions, stop on entry, breakpoints on (default true). @tr Anahtarlar: istisnada dur, girişte dur, kesme noktaları açık (varsayılan true). */
  options?: MaybeFn<boolean | undefined>;
  /** Your icons, by button (false: the button's text only, as its tooltip stays). @tr Düğmeye göre kendi ikonların (false: yalnız düğmenin metni, ipucu kalır). */
  icons?: Partial<Record<DebuggerIcon, unknown>> | undefined;
  /** Your texts. @tr Kendi metinlerin. */
  labels?: Partial<DebuggerLabels> | undefined;
  /** How deep a value opens at first (default 0: closed). @tr Bir değerin başta ne kadar derin açıldığı (varsayılan 0: kapalı). */
  depth?: number | undefined;
  /** Extra classes on the root. @tr Köke eklenen sınıflar. */
  class?: ClassProp;
}

/** A value's own line for JsonView: functions, signals, elements, errors (JSON shows the rest). */
const describeWith = (undeclared: () => string) => (v: unknown): string | null => {
  if (isUndeclared(v)) return `‹${undeclared()}›`;
  const kind = accessorKind(v);
  if (kind) return `${kind} → ${text((v as () => unknown)())}`;
  if (typeof v === "function") return `ƒ ${v.name || "anonymous"}()`;
  if (typeof Node !== "undefined" && v instanceof Node) return v instanceof Element ? `<${v.tagName.toLowerCase()}${v.id ? `#${v.id}` : ""}>` : v.nodeName;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (v instanceof Promise) return "Promise";
  if (v instanceof Map || v instanceof Set || typeof v === "symbol") return text(v instanceof Map ? Object.fromEntries(v) : v instanceof Set ? [...v] : String(v));
  return null;
};

/** `<Debugger session={session} onStart={run} onReveal={(file, line) => open(file, line)} />` */
export function Debugger(props: DebuggerProps): Element {
  const s = props.session;
  const L = (k: keyof DebuggerLabels): string => props.labels?.[k] ?? t(LABELS[k]);
  const describe = describeWith(() => L("undeclared"));
  const value = (v: unknown): unknown => h(JsonView, { value: () => v, open: props.depth ?? 0, describe, class: "m-dbg-value" });
  const paused = (): boolean => s.state() === "paused";
  const on = (): boolean => s.state() !== "idle";
  const button = (k: DebuggerIcon, run: () => void, enabled: () => boolean): unknown => h(IconButton, {
    icon: ownIcon(props.icons?.[k], ICONS[k]), label: () => `${L(k)}${KEYS[k] ? ` (${KEYS[k]})` : ""}`, size: "sm", variant: "ghost",
    disabled: () => !enabled(), class: `m-dbg-btn is-${k}`, onClick: run,
  });
  const stop = (): void => { if (props.onStop) props.onStop(); else s.end(); };
  const controls = h(Toolbar, { class: "m-dbg-bar", label: () => L("title") },
    props.onStart ? () => (on() ? button("restart", props.onStart!, () => true) : button("start", props.onStart!, () => true)) : null,
    button("resume", () => s.resume(), paused),
    button("over", () => s.stepOver(), paused),
    button("into", () => s.stepInto(), paused),
    button("out", () => s.stepOut(), paused),
    button("back", () => s.stepBack(), () => s.index() > s.range()[0]),
    button("stop", stop, on));

  // where it stands: a dot, why it stopped and where
  const why = (): string => {
    if (s.state() === "idle") return L("idle");
    if (s.state() === "running") return L("running");
    const r = s.reason();
    return r === "breakpoint" ? L("breakpoint") : r === "debugger" ? L("debugger") : r === "exception" ? L("exception") : r === "entry" ? L("entry") : L("paused");
  };
  const status = h("div", { class: () => cx("m-dbg-status", `is-${s.state()}`), role: "status", "aria-live": "polite" },
    h(StatusDot, { size: "sm", tone: () => (s.state() === "paused" ? (s.reason() === "exception" ? "danger" : "warn") : s.state() === "running" ? "success" : "neutral"), pulse: () => (s.state() === "running" ? "ring" : false) }),
    h("span", { class: "m-dbg-why" }, why),
    () => { const c = s.current(); return c && paused() ? h("button", { type: "button", class: "m-dbg-place", onClick: () => props.onReveal?.(c.file, c.line) }, `${c.fn} · ${c.file}:${c.line}`) : null; },
    () => { const c = s.current(); return c?.kind === "exception" && paused() ? h("span", { class: "m-dbg-error" }, text(c.error)) : null; });
  // the slider is made again only when its ends change: moving it (goTo) bumps the session's version, and a slider
  // made anew under the pointer would lose the drag and the focus after one step
  const ends = computed(() => s.range(), { equals: (x, y) => !!x && !!y && x[0] === y[0] && x[1] === y[1] });
  const timeline = (): unknown => (val(props.timeline) === false ? null : () => {
    const [a, b] = ends();
    return untrack(() => b > a ? h("div", { class: "m-dbg-time" },
      h(Slider, { min: a, max: b, step: 1, get value() { return Math.max(a, s.index()); }, onChange: (n: number) => s.goTo(n), "aria-label": L("timeline"), valueText: (n: number) => `${L("step")} ${n + 1} / ${b + 1}` }),
      h("span", { class: "m-dbg-count" }, () => `${L("step")} ${s.index() + 1} / ${b + 1}`)) : null);
  });

  // ---- the sections
  const watchRow = (w: { id: number; expr: string }): unknown => h("li", { class: "m-dbg-row m-dbg-watch" },
    h("code", { class: "m-dbg-name" }, w.expr),
    () => {
      const r: WatchValue = s.watchValue(w.id);
      if ("pending" in r) return h("span", { class: "m-dbg-muted" }, paused() ? "…" : L("notPaused"));
      return r.ok ? value(r.value) : r.undeclared ? h("span", { class: "m-dbg-muted m-json-own" }, `‹${L("undeclared")}›`) : h("span", { class: "m-dbg-error" }, r.error);
    },
    h(IconButton, { icon: xIcon, label: () => L("remove"), size: "xs", variant: "ghost", class: "m-dbg-x", onClick: () => s.removeWatch(w.id) }));
  const draft = signal("");
  const watch = (): unknown => [
    () => { const list = s.watches(); return untrack(() => (list.length ? h("ul", { class: "m-dbg-list" }, list.map(watchRow)) : h("p", { class: "m-dbg-muted" }, L("noWatches")))); },
    h(TextInput, { class: "m-dbg-add", placeholder: L("addWatch"), "aria-label": L("addWatch"), value: draft,
      onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" && draft.peek().trim()) { s.addWatch(draft.peek()); draft.set(""); } } }),
  ];
  const scope = (): unknown => () => {
    const v: StepView | null = s.shown();
    if (!v) return h("p", { class: "m-dbg-muted" }, L("notPaused"));
    return untrack(() => v.scopes.map((g) => h("div", { class: "m-dbg-scope" },
      h("h4", { class: "m-dbg-sub" }, L(g.kind)),
      h("ul", { class: "m-dbg-list" }, Object.entries(g.values).map(([k, x]) => h("li", { class: "m-dbg-row" }, h("code", { class: "m-dbg-name" }, k), value(x)))))));
  };
  const stack = (): unknown => () => {
    const v = s.current();
    if (!v || !paused()) return h("p", { class: "m-dbg-muted" }, L("notPaused"));
    return untrack(() => h("ol", { class: "m-dbg-list m-dbg-stack" }, v.stack.map((f, i) => h("li", {},
      h("button", { type: "button", class: "m-dbg-frame", "aria-current": () => (s.frame() === i ? "true" : null), disabled: f.at < 0 && i > 0,
        onClick: () => { s.frame.set(i); if (f.line) props.onReveal?.(f.file, f.line); } },
        h("span", { class: "m-dbg-fn" }, f.fn), h("span", { class: "m-dbg-at" }, f.line ? `${f.file}:${f.line}` : ""))))));
  };
  const bpRow = (id: number): unknown => {
    const b = (): ReturnType<typeof s.breakpoints>[number] | undefined => s.breakpoints().find((x) => x.id === id);
    const first = untrack(b)!;
    return h("li", { class: () => cx("m-dbg-row m-dbg-bp", !b()?.enabled && "is-off", b()?.log ? "is-log" : b()?.condition ? "is-cond" : null) },
      h(Checkbox, { size: "sm", get value() { return !!b()?.enabled; }, onChange: (on: boolean) => s.updateBreakpoint(id, { enabled: on }), "aria-label": `${first.file}:${first.line}` }),
      h("button", { type: "button", class: "m-dbg-at", onClick: () => props.onReveal?.(first.file, first.line) }, `${first.file}:${first.line}`),
      h(TextInput, { class: "m-dbg-cond", placeholder: L("condition"), "aria-label": `${first.file}:${first.line} ${L("condition")}`, value: first.condition ?? "",
        onChange: (v: string) => s.updateBreakpoint(id, { condition: v.trim() || undefined }) }),
      h(TextInput, { class: "m-dbg-log", placeholder: L("log"), "aria-label": `${first.file}:${first.line} ${L("log")}`, value: first.log ?? "",
        onChange: (v: string) => s.updateBreakpoint(id, { log: v.trim() || undefined }) }),
      h(IconButton, { icon: xIcon, label: () => L("remove"), size: "xs", variant: "ghost", class: "m-dbg-x", onClick: () => s.removeBreakpoint(id) }));
  };
  // the rows are drawn again only when breakpoints come or go (a row keeps its fields while one is typed in)
  const bpIds = computed(() => s.breakpoints().map((b) => b.id).join(","));
  const breakpoints = (): unknown => [
    () => { const ids = bpIds(); return untrack(() => (ids ? h("ul", { class: "m-dbg-list" }, s.breakpoints().map((b) => bpRow(b.id))) : h("p", { class: "m-dbg-muted" }, L("noBreakpoints")))); },
    () => (s.breakpoints().length ? h("div", { class: "m-dbg-tools" }, h(IconButton, { icon: trash, label: () => L("removeAll"), size: "xs", variant: "ghost", onClick: () => s.clearBreakpoints() })) : null),
  ];
  // the output: a box of `outputLines` lines (it does not grow with every line), the newest in view, a copy button
  const output = (): unknown => {
    const list = h("ul", { class: "m-dbg-list m-dbg-out", style: { "--m-dbg-out-lines": String(props.outputLines ?? 4) } }, () => {
      const lines = s.output();
      return lines.length ? lines.slice(-300).map((l) => h("li", { class: `m-dbg-line is-${l.level}` },
        h("span", { class: "m-dbg-text" }, l.text),
        l.file ? h("button", { type: "button", class: "m-dbg-at", onClick: () => props.onReveal?.(l.file!, l.line!) }, `${l.file}:${l.line}`) : null))
        : h("li", { class: "m-dbg-muted" }, L("nothing"));
    }) as HTMLElement;
    stickToBottom(list);
    return h("div", { class: "m-dbg-outbox" }, list,
      h(CopyButton, { iconOnly: true, class: "m-dbg-copy", label: () => L("copyOutput"), text: () => s.output().map((l) => (l.file ? `${l.text}  (${l.file}:${l.line})` : l.text)).join("\n") }));
  };
  const BODY: Record<DebuggerSection, () => unknown> = { watch, scope, stack, breakpoints, output };
  const COUNT: Partial<Record<DebuggerSection, () => number>> = { watch: () => s.watches().length, breakpoints: () => s.breakpoints().length, output: () => s.output().length };
  const opened = signal(new Set<DebuggerSection>(props.open ?? ["watch", "scope", "stack", "breakpoints", "output"]));
  const section = (k: DebuggerSection): unknown => h(Disclosure, {
    class: `m-dbg-sec is-${k}`, open: () => opened().has(k),
    onToggle: (o: boolean) => { const next = new Set(opened.peek()); if (o) next.add(k); else next.delete(k); opened.set(next); },
    title: [h("span", { class: "m-dbg-title" }, () => L(k)), COUNT[k] ? () => (COUNT[k]!() ? h(Badge, { size: "xs", tone: "neutral" }, String(COUNT[k]!())) : null) : null],
    children: BODY[k](),
  });
  // a pair's divider is kept while the panel lives (its share by the pair)
  const shares = new Map<string, number>();
  const pair = (a: DebuggerSection, b: DebuggerSection): unknown => h(Splitter, {
    class: "m-dbg-pair", start: section(a), end: section(b), min: 0.2, initial: shares.get(`${a}|${b}`) ?? 0.5, onChange: (v: number) => shares.set(`${a}|${b}`, v),
  });
  const sections = (): unknown => {
    const list = val(props.sections) ?? ["watch", "scope", "stack", "breakpoints", "output"];
    const rows = props.layout ?? [["watch", "scope"], ["breakpoints", "stack"], "output"];
    return untrack(() => {
      const used = new Set<DebuggerSection>(), out: unknown[] = [];
      for (const r of rows) {
        const keys = (typeof r === "string" ? [r] : [...r]).filter((k) => list.includes(k) && !used.has(k));
        keys.forEach((k) => used.add(k));
        if (keys.length === 2) out.push(pair(keys[0]!, keys[1]!)); else if (keys.length === 1) out.push(section(keys[0]!));
      }
      for (const k of list) if (!used.has(k)) out.push(section(k));
      return out;
    });
  };
  const options = (): unknown => (val(props.options) === false ? null : h("div", { class: "m-dbg-options" },
    h(Toggle, { label: () => L("pauseOnExceptions"), get value() { return s.pauseOnExceptions(); }, onChange: (v: boolean | null) => s.pauseOnExceptions.set(!!v) }),
    h(Toggle, { label: () => L("stopOnEntry"), get value() { return s.stopOnEntry(); }, onChange: (v: boolean | null) => s.stopOnEntry.set(!!v) }),
    h(Toggle, { label: () => L("breakpointsOn"), get value() { return s.breakpointsActive(); }, onChange: (v: boolean | null) => s.breakpointsActive.set(!!v) })));

  return h("section", { class: () => cx("m-dbg", `is-${s.state()}`, val(props.class)), "aria-label": () => L("title") },
    h("header", { class: "m-dbg-head" }, controls, status, timeline, () => (s.state() === "idle" && !s.breakpoints().length ? h("p", { class: "m-dbg-hint" }, L("hint")) : null)),
    h("div", { class: "m-dbg-body" }, sections),
    () => (val(props.options) === false ? null : h("footer", { class: "m-dbg-foot" }, options()))) as Element;
}
