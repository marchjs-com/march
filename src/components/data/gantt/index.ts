// Gantt (hadi-march/components/data/gantt): tasks on a time axis with dependency arrows (finish → start), drag to move
// or resize a bar, drag its knob to set progress, a today line and day / week / month scales. Successors that would
// start before their predecessor ends are pushed later (`cascade`). Dates via core/date + Intl, drags via behaviors/drag.
import "./gantt.css";
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale, dir } from "../../../core/i18n.ts";
import { val, cx, uid, setStyle, later, clamp, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { todayIso, addDays, diffDays, dateFormat, utcDate, startOfWeek, firstDayOf, startOfMonth, addMonths, type IsoDate } from "../../../core/date.ts";
import { animate, stagger } from "../../../motion/animate.ts";
import { pointerDrag } from "../../../behaviors/drag/index.ts";
import { ListRow } from "../list-row/index.ts";
import { Badge } from "../badge/index.ts";
import { ResizeHandle } from "../../layout/resize-handle/index.ts";
import { LiveStatus } from "../../feedback/live-status/index.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export interface GanttTask {
  id: string;
  name: string;
  /** First day (ISO). */
  start: IsoDate;
  /** Last day (ISO, inclusive). */
  end: IsoDate;
  /** 0 … 1. */
  progress?: number | undefined;
  /** Ids of tasks that must finish before this one starts. */
  deps?: readonly string[] | undefined;
  color?: ColorToken | undefined;
  /** A one-day diamond. */
  milestone?: boolean | undefined;
  data?: unknown;
}
export type GanttScale = "day" | "week" | "month";
/** Texts Gantt writes itself; pass any of them in `labels`. */
export interface GanttLabels {
  /** On the today line. */
  today: string;
  /** Head of the names column. */
  task: string;
  /** Length of a task next to its name ("5 d"). */
  days: (count: number) => string;
  /** The hint under the chart while it is editable / read-only. */
  help: string;
  helpReadonly: string;
  /** Part of a bar's accessible name ("40% done"). */
  done: (percent: number) => string;
  /** Part of a bar's accessible name ("after Design, Build"). */
  after: (names: string) => string;
  /** Announced after a change ("Build: 9 Nov – 13 Nov"). */
  moved: (name: string, start: string, end: string) => string;
  /** Announced when `cascade` pushed successors. */
  pushed: (count: number) => string;
}
const LABELS: { [K in keyof GanttLabels]: () => GanttLabels[K] } = {
  today: () => t`Today`,
  task: () => t`Task`,
  days: () => (count) => t`${count} d`,
  help: () => t`Drag a bar to move it, its ends to resize it, its knob to set progress. Keyboard: ↑ ↓ choose a task, Alt+← → move, Alt+Shift+← → resize.`,
  helpReadonly: () => t`↑ ↓ choose a task.`,
  done: () => (percent) => t`${percent}% done`,
  after: () => (names) => t`after ${names}`,
  moved: () => (name, start, end) => t`${name}: ${start} – ${end}`,
  pushed: () => (count) => t`${count} following tasks moved`,
};

export interface GanttProps {
  tasks: MaybeFn<readonly GanttTask[]>;
  /** After a move, resize or progress change (and once per task pushed by `cascade`); the chart already shows it. */
  onChange?: ((task: GanttTask) => void) | undefined;
  onSelect?: ((task: GanttTask) => void) | undefined;
  scale?: MaybeFn<GanttScale | undefined>;
  /** Push successors later when a predecessor would overlap them (default true). */
  cascade?: MaybeFn<boolean | undefined>;
  editable?: MaybeFn<boolean | undefined>;
  /** Show the dependency arrows (default true). */
  arrows?: MaybeFn<boolean | undefined>;
  /** Px height of the chart (default 420). */
  height?: number | undefined;
  rowHeight?: number | undefined;
  /** The today line and its label (default true). */
  todayLine?: MaybeFn<boolean | undefined>;
  /** The pinned column of task names (default true). */
  names?: boolean | undefined;
  /** The hint under the chart: true (default: the text in `labels`), false, or your own node. */
  help?: unknown;
  /** Content of a bar: `(task) => node` (default: the task name). */
  barLabel?: ((task: GanttTask) => unknown) | undefined;
  /** Your own texts: `{ today, task, days, help, helpReadonly, done, after, moved, pushed }`. */
  labels?: Partial<GanttLabels> | undefined;
  /** Arrow drawing, settle and scale-change animations (default true). */
  animate?: boolean | undefined;
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
}

const PX: Record<GanttScale, number> = { day: 40, week: 18, month: 5 };
const NAME_W = 220;

/** `<Gantt tasks={$tasks} scale="week" onChange={(task) => save(task)} />` */
export function Gantt(props: GanttProps): Element {
  const id = uid("m-gantt");
  const tasks = signal<readonly GanttTask[]>(untrack(() => val(props.tasks)) ?? []);
  if (typeof props.tasks === "function") effect(() => { const x = val(props.tasks); untrack(() => tasks.set(x ?? [])); });
  const rowH = props.rowHeight ?? 36;
  const scale = (): GanttScale => val(props.scale) ?? "week";
  const px = (): number => PX[scale()];
  const editable = (): boolean => val(props.editable) ?? true;
  const rtl = (): boolean => dir() === "rtl";
  const loc = (): string => locale();
  const today = todayIso();
  const lb = <K extends keyof GanttLabels>(k: K): GanttLabels[K] => props.labels?.[k] ?? LABELS[k]();
  const motion = props.animate !== false;
  // live preview while dragging: id → { start, end, progress }
  const preview = signal<Record<string, Partial<GanttTask>>>({});
  const view = (task: GanttTask): GanttTask => ({ ...task, ...preview()[task.id] });
  const status = signal("");

  // ------------------------------------------------------------------ the time range (padded to whole periods)
  const range = computed(() => {
    const list = tasks();
    let a = today, b = today;
    for (const x of list) { if (x.start < a) a = x.start; if (x.end > b) b = x.end; }
    const s = scale();
    const from = s === "month" ? startOfMonth(addMonths(a, -1)) : startOfWeek(addDays(a, -7), firstDayOf(loc()));
    const to = s === "month" ? addDays(startOfMonth(addMonths(b, 2)), -1) : addDays(startOfWeek(addDays(b, 14), firstDayOf(loc())), -1);
    return { from, to, days: diffDays(from, to) + 1 };
  });
  const xOf = (d: IsoDate): number => diffDays(range().from, d) * px();
  const width = (): number => range().days * px();
  const indexOf = computed(() => new Map(tasks().map((x, i) => [x.id, i])));

  // ------------------------------------------------------------------ header: months over days / weeks
  const header = (): Element => {
    const { from, days } = range(), p = px(), s = scale(), L = loc();
    const top: Element[] = [], bottom: Element[] = [];
    let i = 0;
    while (i < days) { // months
      const d = addDays(from, i), next = Math.min(days, diffDays(from, startOfMonth(addMonths(d, 1))));
      const el = h("div", { class: "m-gantt-hcell m-gantt-month" }, h("span", {}, dateFormat(L, { month: s === "month" ? "short" : "long", year: "numeric" }).format(utcDate(d)))) as HTMLElement;
      setStyle(el, { "inset-inline-start": `${i * p}px`, width: `${(next - i) * p}px` });
      top.push(el); i = next;
    }
    if (s === "day") for (let k = 0; k < days; k++) {
      const d = addDays(from, k), wd = utcDate(d).getUTCDay();
      const el = h("div", { class: cx("m-gantt-hcell m-gantt-day", (wd === 0 || wd === 6) && "is-weekend", d === today && "is-today") }, h("small", {}, dateFormat(L, { weekday: "narrow" }).format(utcDate(d))), String(Number(d.slice(8)))) as HTMLElement;
      setStyle(el, { "inset-inline-start": `${k * p}px`, width: `${p}px` });
      bottom.push(el);
    } else if (s === "week") for (let k = 0; k < days; k += 7) {
      const d = addDays(from, k);
      const el = h("div", { class: "m-gantt-hcell m-gantt-week" }, dateFormat(L, { day: "numeric", month: "short" }).format(utcDate(d))) as HTMLElement;
      setStyle(el, { "inset-inline-start": `${k * p}px`, width: `${7 * p}px` });
      bottom.push(el);
    }
    return h("div", { class: "m-gantt-head", "aria-hidden": "true" }, h("div", { class: "m-gantt-hrow" }, top), bottom.length ? h("div", { class: "m-gantt-hrow" }, bottom) : null);
  };

  // ------------------------------------------------------------------ changes (+ cascade to successors)
  const commit = (task: GanttTask, next: Partial<GanttTask>): void => {
    const changed = new Map<string, GanttTask>([[task.id, { ...task, ...next }]]);
    if (val(props.cascade) ?? true) {
      // breadth-first over successors: start the day after the latest predecessor ends, keep the duration
      const queue = [task.id];
      while (queue.length) {
        const pid = queue.shift() as string;
        for (const s of untrack(tasks)) {
          if (!s.deps?.includes(pid)) continue;
          const cur = changed.get(s.id) ?? s;
          const latest = (cur.deps ?? []).reduce((m, d) => { const p = changed.get(d) ?? untrack(tasks).find((x) => x.id === d); return p && p.end > m ? p.end : m; }, "");
          if (latest && cur.start <= latest) {
            const shift = diffDays(cur.start, addDays(latest, 1));
            changed.set(s.id, { ...cur, start: addDays(cur.start, shift), end: addDays(cur.end, shift) });
            queue.push(s.id);
          }
        }
      }
    }
    tasks.set(untrack(tasks).map((x) => changed.get(x.id) ?? x));
    for (const x of changed.values()) props.onChange?.(x);
    const moved = changed.get(task.id) as GanttTask, f = dateFormat(loc(), { day: "numeric", month: "short" });
    const pushed = changed.size > 1 ? lb("pushed")(changed.size - 1) : "";
    status.set(`${lb("moved")(moved.name, f.format(utcDate(moved.start)), f.format(utcDate(moved.end)))}${pushed ? `, ${pushed}` : ""}`);
    // pushed successors slide to their new place (they were re-rendered at it)
    if (motion) later(() => {
      for (const [tid] of changed) {
        const el = canvas.querySelector<HTMLElement>(`[data-task="${tid}"]`);
        if (el) void animate(el, tid === task.id ? [{ transform: "scaleY(1.18)" }, { transform: "none" }] : [{ opacity: .4 }, { opacity: 1 }], { duration: 320, easing: "easeOutBack" });
      }
    }, 0);
  };

  // ------------------------------------------------------------------ bars
  const barDrag = (e: PointerEvent, task: GanttTask, which: "move" | "start" | "end" | "progress", bar: HTMLElement): void => {
    if (e.button || !editable()) return;
    e.stopPropagation();
    const p = px(), sign = rtl() ? -1 : 1, w0 = bar.getBoundingClientRect().width;
    let next: Partial<GanttTask> = {};
    pointerDrag(e, {
      scroll: scroller, threshold: 3,
      onStart: () => { bar.classList.add("is-dragging"); dragging = true; },
      onMove: (pt) => {
        const dx = pt.dx * sign;
        if (which === "progress") next = { progress: clamp(((task.progress ?? 0) * w0 + dx) / Math.max(1, w0), 0, 1) };
        else {
          const dd = Math.round(dx / p);
          if (which === "move") next = { start: addDays(task.start, dd), end: addDays(task.end, dd) };
          else if (which === "start") next = { start: addDays(task.start, Math.min(dd, diffDays(task.start, task.end))) };
          else next = { end: addDays(task.end, Math.max(dd, -diffDays(task.start, task.end))) };
        }
        preview.set({ [task.id]: next });
      },
      onEnd: (_pt, cancelled) => {
        bar.classList.remove("is-dragging");
        later(() => { dragging = false; }, 0);
        preview.set({});
        if (!cancelled && Object.keys(next).length) commit(task, which === "progress" ? { progress: Math.round((next.progress ?? 0) * 20) / 20 } : next);
      },
    });
  };
  let dragging = false;
  const barKeys = (task: GanttTask) => (e: KeyboardEvent): void => {
    const i = untrack(indexOf).get(task.id) ?? 0, list = untrack(tasks);
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (e.altKey) return;
      e.preventDefault();
      const n = list[clamp(i + (e.key === "ArrowUp" ? -1 : 1), 0, list.length - 1)];
      if (n) focusTask(n.id);
      return;
    }
    if (e.key === "Enter") { e.preventDefault(); props.onSelect?.(task); return; }
    if (!e.altKey || !editable() || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const d = (e.key === "ArrowRight" ? 1 : -1) * (rtl() ? -1 : 1);
    commit(task, e.shiftKey ? { end: addDays(task.end, Math.max(d, -diffDays(task.start, task.end))) } : { start: addDays(task.start, d), end: addDays(task.end, d) });
    later(() => focusTask(task.id), 0);
  };
  const focusTask = (tid: string): void => {
    const el = canvas.querySelector<HTMLElement>(`[data-task="${tid}"]`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };
  const fmtRange = (x: GanttTask): string => { const f = dateFormat(loc(), { day: "numeric", month: "short", year: "numeric" }); return `${f.format(utcDate(x.start))} – ${f.format(utcDate(x.end))}`; };
  const barLabel = (x: GanttTask): string => `${x.name}, ${fmtRange(x)}, ${lb("done")(Math.round((x.progress ?? 0) * 100))}${x.deps?.length ? `, ${lb("after")(x.deps.map((d) => untrack(tasks).find((y) => y.id === d)?.name ?? d).join(", "))}` : ""}`;

  const bar = (task: GanttTask, row: number): Element => {
    const live = (): GanttTask => view(task);
    const el = h("button", {
      type: "button", class: () => cx("m-gantt-bar", task.milestone && "is-milestone", (live().progress ?? 0) >= 1 && "is-done", hot() === task.id && "is-hot"),
      "data-task": task.id, "data-m-color": colorAttr(task.color ?? "primary"), "aria-label": () => barLabel(live()), title: () => barLabel(live()),
      tabindex: row === 0 ? "0" : "-1",
      onKeydown: barKeys(task), onClick: () => { if (!dragging) props.onSelect?.(task); },
      onPointerdown: (e: PointerEvent) => barDrag(e, task, ((e.target as Element).closest<HTMLElement>("[data-handle]")?.dataset["handle"] as "start" | "end" | "progress" | undefined) ?? "move", el),
      onPointerenter: () => hot.set(task.id), onPointerleave: () => hot.set(null), onFocus: () => hot.set(task.id), onBlur: () => hot.set(null),
    },
    task.milestone ? null : h("span", { class: "m-gantt-fill", "aria-hidden": "true" }),
    h("span", { class: "m-gantt-bar-label" }, task.milestone ? null : props.barLabel ? props.barLabel(task) : task.name),
    task.milestone || !editable() ? null : [
      // the ends are bare ResizeHandle grips: the bar runs the gesture (pointer) and the keys (Alt+Shift+arrows)
      h(ResizeHandle, { edge: "start", class: "m-gantt-handle m-gantt-handle-start", "data-handle": "start" }),
      h(ResizeHandle, { edge: "end", class: "m-gantt-handle m-gantt-handle-end", "data-handle": "end" }),
      h("span", { class: "m-gantt-knob", "data-handle": "progress", "aria-hidden": "true" }),
    ]) as HTMLElement;
    effect(() => {
      const x = live(), p = px(), w = task.milestone ? rowH * 0.5 : (diffDays(x.start, x.end) + 1) * p;
      setStyle(el, { "inset-inline-start": `${xOf(x.start) + (task.milestone ? p / 2 - w / 2 : 0)}px`, width: `${w}px`, top: `${row * rowH + (task.milestone ? rowH * 0.25 : 7)}px`, "--m-gantt-p": `${Math.round((x.progress ?? 0) * 100)}%` });
    });
    return el;
  };
  const hot = signal<string | null>(null);

  // ------------------------------------------------------------------ dependency arrows (SVG, mirrored in RTL)
  const arrows = (): Element => {
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("class", "m-gantt-arrows");
    svg.setAttribute("aria-hidden", "true");
    const defs = document.createElementNS(svgNs, "defs"), marker = document.createElementNS(svgNs, "marker"), tip = document.createElementNS(svgNs, "path");
    marker.setAttribute("id", `${id}-tip`); marker.setAttribute("viewBox", "0 0 8 8"); marker.setAttribute("refX", "7"); marker.setAttribute("refY", "4");
    marker.setAttribute("markerWidth", "7"); marker.setAttribute("markerHeight", "7"); marker.setAttribute("orient", "auto-start-reverse");
    tip.setAttribute("d", "M0,0 L8,4 L0,8 z"); tip.setAttribute("class", "m-gantt-tip");
    marker.append(tip); defs.append(marker); svg.append(defs);
    const fresh: SVGPathElement[] = [];
    for (const task of tasks()) for (const dep of task.deps ?? []) {
      const pre = tasks().find((x) => x.id === dep);
      if (!pre) continue;
      const path = document.createElementNS(svgNs, "path") as SVGPathElement;
      path.setAttribute("marker-end", `url(#${id}-tip)`);
      effect(() => {
        const a = view(pre), b = view(task), p = px(), ia = indexOf().get(pre.id) ?? 0, ib = indexOf().get(task.id) ?? 0;
        const x1 = xOf(a.end) + p + (pre.milestone ? -p / 2 + rowH / 4 : 0), y1 = ia * rowH + rowH / 2, x2 = xOf(b.start) + (task.milestone ? p / 2 - rowH / 4 : 0), y2 = ib * rowH + rowH / 2;
        const gap = 10, mid = y1 + (y2 > y1 ? rowH / 2 : -rowH / 2);
        // elbow: out of the predecessor, down between rows, into the successor; a backwards link detours around it
        const d = x2 - gap >= x1 + gap
          ? `M${x1},${y1} H${x2 - gap} V${y2} H${x2 - 1}`
          : `M${x1},${y1} H${x1 + gap} V${mid} H${x2 - gap} V${y2} H${x2 - 1}`;
        path.setAttribute("d", d);
        const isHot = hot() === task.id || hot() === pre.id, late = a.end >= b.start;
        path.setAttribute("class", cx("m-gantt-link", isHot && "is-hot", late && "is-late"));
      });
      svg.append(path);
      fresh.push(path);
    }
    effect(() => { svg.setAttribute("width", String(width())); svg.setAttribute("height", String(tasks().length * rowH)); });
    // the links draw themselves in once (motion engine: reduced motion shows them at once)
    if (motion) later(() => { const st = stagger(25); fresh.forEach((p, i) => { const len = p.getTotalLength?.() ?? 0; if (len) void animate(p, [{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: "0" }], { duration: 520, delay: st(i), easing: "easeOutCubic" }); }); }, 0);
    return svg as unknown as Element;
  };

  // ------------------------------------------------------------------ frame
  const names = h("div", { class: "m-gantt-names", role: "rowgroup" },
    () => tasks().map((task, i) => untrack(() => h(ListRow, {
      role: "row", class: () => cx("m-gantt-name", hot() === task.id && "is-hot"), "aria-rowindex": String(i + 1), overflow: "ellipsis",
      title: h("span", { role: "rowheader", class: "m-gantt-name-text", title: task.name }, task.name),
      trail: h("span", { class: "m-gantt-name-meta" }, () => { const x = view(task); return lb("days")(diffDays(x.start, x.end) + 1); }),
    }))));
  const canvas = h("div", { class: "m-gantt-canvas" },
    () => header(),
    h("div", { class: "m-gantt-rows" },
      () => { const n = tasks().length; return Array.from({ length: n }, (_, i) => { const r = h("div", { class: "m-gantt-row" }) as HTMLElement; setStyle(r, { top: `${i * rowH}px`, height: `${rowH}px` }); return r; }); },
      () => { if (val(props.todayLine) === false) return null; const x = xOf(today); const el = h("div", { class: "m-gantt-today" }, h(Badge, { size: "xs", tone: "primary" }, lb("today"))) as HTMLElement; setStyle(el, { "inset-inline-start": `${x + px() / 2}px` }); return el; },
      () => (val(props.arrows) ?? true ? arrows() : null),
      () => tasks().map((task, i) => bar(task, i)))) as HTMLElement;
  effect(() => { setStyle(canvas, { width: `${width()}px`, "--m-gantt-rows": `${tasks().length * rowH}px`, "--m-gantt-row": `${rowH}px`, "--m-gantt-px": `${px()}px` }); });
  const side = props.names === false ? null : h("div", { class: "m-gantt-side" }, h("div", { class: "m-gantt-side-head" }, () => lb("task")), names) as HTMLElement;
  const scroller = h("div", { class: "m-gantt-scroll", role: "grid", "aria-label": () => val(props.label) ?? t`Project timeline`, "aria-describedby": props.help === false ? null : `${id}-help` },
    side, canvas) as HTMLElement;
  setStyle(scroller, { height: `${props.height ?? 420}px`, "--m-gantt-name-w": `${side ? NAME_W : 0}px` });
  // scroll so today sits near the start; a scale change fades the canvas in
  let first = true;
  effect(() => {
    scale();
    later(() => {
      // the chart may still be sliding into place (lazy demo, tab): retry until it can scroll
      const toToday = (tries: number): void => {
        if (scroller.scrollWidth <= scroller.clientWidth && tries) { later(() => toToday(tries - 1), 100); return; }
        // today about a third into the visible timeline (the names column covers the start of the canvas)
        const sideW = side?.offsetWidth ?? 0;
        const x = xOf(today) - Math.max(0, scroller.clientWidth - sideW) / 3;
        scroller.scrollLeft = (rtl() ? -1 : 1) * Math.max(0, x);
      };
      toToday(50);
      if (!first && motion) void animate(canvas, [{ opacity: 0, transform: "scaleX(.97)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "easeOutCubic" });
      first = false;
    }, 0);
  });
  return h("div", { class: () => cx("m-gantt", val(props.class)) }, scroller,
    // the hint under the chart and the (hidden) live region its changes are said in
    h(LiveStatus, { class: "m-gantt-status", visible: false, as: "div", text: status, helpId: `${id}-help`, helpClass: "m-gantt-help", help: props.help == null || props.help === true ? () => (editable() ? lb("help") : lb("helpReadonly")) : props.help }));
}
