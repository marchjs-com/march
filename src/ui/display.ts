// Display components: Card, Badge, Empty, Spinner, ErrorBox, Skeleton, Alert, Kbd, Avatar, CodeView, JsonView, KeyValue,
// Timeline, layout helpers (Stack, Grid, Toolbar, Divider) and the boot Loader. Text is always inserted as text nodes.
import { signal, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t, locale } from "../core/i18n.ts";
import { applyPipe, toDate } from "../core/pipes.ts";
import { isAction } from "./action.ts";
import { ActionButton, CopyButton } from "./button.ts";
import { formatKey } from "./keys.ts";
import { val, cx, rest, icon, type MaybeFn, type ClassProp } from "./util.ts";

/** Tones of badges, alerts and timeline items. */
export type Tone = "neutral" | "info" | "success" | "warn" | "danger" | (string & {});
/** Actions or nodes shown in a header (Card, Page, Section, Empty): action() objects render as ActionButtons. */
export type ActionsProp = MaybeFn<unknown>;

/** Render a list of actions / nodes (used by Card, Page, Section). */
export function actionsOf(list: ActionsProp, args?: unknown[]): () => unknown[] {
  return () => ([] as unknown[]).concat(val(list) ?? []).map((a) => (isAction(a) ? untrack(() => h(ActionButton, { action: a, args, size: "sm" as const })) : a));
}

export interface CardProps {
  title?: unknown;
  subtitle?: unknown;
  actions?: ActionsProp;
  footer?: unknown;
  /** Root tag (default "section"). */
  as?: string;
  /** No body padding. */
  flush?: boolean;
  class?: ClassProp;
  children?: unknown;
  [attr: string]: unknown;
}
/** `<Card title="…" subtitle="…" actions={[edit]} footer={…}>…</Card>` */
export function Card(props: CardProps): Element {
  const head = props.title != null || props.actions != null || props.subtitle != null;
  return h(props.as ?? "section", { ...rest(props, ["title", "subtitle", "actions", "footer", "as", "flush"]), class: () => cx("hm-card", props.flush && "hm-card-flush", val(props.class)) },
    head && h("header", { class: "hm-card-head" },
      h("div", { class: "hm-card-titles" },
        props.title != null && h("h3", { class: "hm-card-title" }, () => val(props.title)),
        props.subtitle != null && h("p", { class: "hm-card-sub" }, () => val(props.subtitle))),
      props.actions != null && h("div", { class: "hm-card-actions" }, actionsOf(() => props.actions))),
    h("div", { class: "hm-card-body" }, props.children),
    props.footer != null && h("footer", { class: "hm-card-foot" }, props.footer));
}

/** Format a count for badges: 120 → "99+". */
export const countLabel = (n: number, max = 99): string => (n > max ? `${max}+` : String(n));

export interface BadgeProps {
  tone?: MaybeFn<Tone | undefined>;
  /** Count badge: hidden at 0 unless `showZero`; above `max` shows "99+". */
  count?: MaybeFn<number | null | undefined>;
  max?: number;
  showZero?: boolean;
  /** Count badges: accessible label after the number ("3 unread"). */
  label?: MaybeFn<string>;
  dot?: boolean;
  class?: ClassProp;
  children?: unknown;
}
/** `<Badge tone="success">Active</Badge>`, `<Badge count={n} />` (hidden at 0 unless showZero; 120 → "99+"). */
export function Badge(props: BadgeProps): unknown {
  if (props.count !== undefined) {
    return () => {
      const n = Number(val(props.count)) || 0;
      if (!n && !props.showZero) return null;
      return h("span", { class: cx("hm-badge", "hm-badge-count", `hm-badge-${val(props.tone) ?? "danger"}`, val(props.class)), "aria-label": props.label ? `${n} ${val(props.label)}` : null }, countLabel(n, props.max ?? 99));
    };
  }
  return h("span", { class: () => cx("hm-badge", `hm-badge-${val(props.tone) ?? "neutral"}`, props.dot && "hm-badge-dot", val(props.class)) }, props.children);
}

export interface EmptyProps { icon?: unknown; title?: MaybeFn<string | undefined>; action?: ActionsProp; class?: ClassProp; children?: unknown }
/** `<Empty icon="📭" title="No users yet" action={…}>Invite someone to get started.</Empty>` */
export function Empty(props: EmptyProps): Element {
  return h("div", { class: () => cx("hm-empty", val(props.class)) },
    icon(props.icon, "hm-empty-icon"),
    h("p", { class: "hm-empty-title" }, () => val(props.title) ?? t`Nothing here yet`),
    props.children != null && h("div", { class: "hm-empty-text" }, props.children),
    props.action != null && h("div", { class: "hm-empty-action" }, actionsOf(() => props.action)));
}

export interface SpinnerProps { size?: "sm" | "md" | "lg"; label?: MaybeFn<string | undefined>; class?: ClassProp }
/** `<Spinner size="sm" label="Loading users" />` */
export function Spinner(props: SpinnerProps): Element {
  return h("span", { class: () => cx("hm-loading", props.size && `hm-spin-${props.size}`, val(props.class)), role: "status", "aria-label": () => val(props.label) ?? t`Loading` });
}

export interface ErrorBoxProps {
  error?: MaybeFn<unknown>;
  message?: MaybeFn<unknown>;
  title?: unknown;
  retry?: () => unknown;
  class?: ClassProp;
}
/** `<ErrorBox error={err} retry={() => refetch()} title="Could not load" />` */
export function ErrorBox(props: ErrorBoxProps): Element {
  const msg = (): string => {
    const e = val(props.error) ?? val(props.message);
    const m = e != null && typeof e === "object" ? (e as { message?: unknown }).message : undefined;
    return (m as string | undefined) ?? (e != null ? String(e) : t`Something went wrong.`);
  };
  return h("div", { class: () => cx("hm-error", "hm-errorbox", val(props.class)), role: "alert" },
    props.title != null && h("strong", { class: "hm-errorbox-title" }, () => val(props.title)),
    h("p", {}, msg),
    props.retry && h("button", { type: "button", class: "hm-btn hm-btn-secondary hm-btn-sm", onClick: () => props.retry?.() }, () => t`Retry`));
}

export interface SkeletonProps { lines?: number; block?: boolean; height?: "sm" | "md" | "lg"; class?: string }
/** Placeholder while loading: `<Skeleton lines={3} />`, `<Skeleton block height="lg" />`. */
export function Skeleton(props: SkeletonProps): Element {
  if (props.block) return h("div", { class: cx("hm-skel", "hm-skel-block", `hm-skel-${props.height ?? "md"}`, props.class), "aria-hidden": "true" });
  const n = props.lines ?? 3;
  return h("div", { class: cx("hm-skel-lines", props.class), "aria-busy": "true", "aria-label": t`Loading` },
    Array.from({ length: n }, (_, i) => h("span", { class: cx("hm-skel", "hm-skel-line", i === n - 1 && n > 1 && "hm-skel-short") })));
}

export interface AlertProps {
  tone?: MaybeFn<Tone | undefined>;
  title?: unknown;
  icon?: unknown;
  body?: unknown;
  dismissable?: boolean;
  onDismiss?: () => void;
  class?: ClassProp;
  children?: unknown;
}
/** `<Alert tone="warn" title="Heads up" dismissable onDismiss={…}>Body</Alert>` (alias Notice). */
export function Alert(props: AlertProps): () => unknown {
  const shown = signal(true);
  return () => shown() && untrack(() => {
    const tone = val(props.tone) ?? "info";
    return h("div", { class: () => cx("hm-alert", `hm-alert-${val(props.tone) ?? "info"}`, val(props.class)), role: tone === "danger" || tone === "warn" ? "alert" : "status" },
      icon(props.icon, "hm-alert-icon"),
      h("div", { class: "hm-alert-main" },
        props.title != null && h("strong", { class: "hm-alert-title" }, () => val(props.title)),
        h("div", { class: "hm-alert-body" }, props.body ?? props.children)),
      props.dismissable && h("button", { type: "button", class: "hm-icon-btn hm-alert-x", "aria-label": () => t`Dismiss`, onClick: () => { shown.set(false); props.onDismiss?.(); } }, "×"));
  });
}
export const Notice = Alert;

export interface KbdProps { keys?: MaybeFn<string>; children?: unknown }
/** Keyboard key(s): `<Kbd>Esc</Kbd>`, `<Kbd keys="mod+k" />` → Ctrl+K / ⌘K. */
export function Kbd(props: KbdProps): Element {
  if (props.keys) return h("kbd", { class: "hm-kbd" }, () => formatKey(val(props.keys ?? "")));
  return h("kbd", { class: "hm-kbd" }, props.children);
}

/** Initials for a name ("Ada Lovelace" → "AL"), locale aware upper casing. */
export function initials(name: unknown): string {
  const w = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = w[0], last = w[w.length - 1];
  const s = w.length > 1 && first && last ? (first[0] ?? "") + (last[0] ?? "") : (first ?? "?").slice(0, 2);
  return s.toLocaleUpperCase(locale.peek());
}
const hue = (s: unknown): number => { let x = 0; for (const c of String(s ?? "")) x = (x * 31 + (c.codePointAt(0) ?? 0)) >>> 0; return x % 8; };

export interface AvatarProps { name?: MaybeFn<string | null | undefined>; src?: MaybeFn<string | null | undefined>; size?: MaybeFn<"sm" | "md" | "lg" | undefined>; class?: ClassProp }
/** `<Avatar name="Ada Lovelace" src={url} size="sm|md|lg" />` — initials when there is no image or it fails. */
export function Avatar(props: AvatarProps): Element {
  const failed = signal(false);
  return h("span", { class: () => cx("hm-avatar", `hm-avatar-${val(props.size) ?? "md"}`, `hm-avatar-c${hue(val(props.name))}`, val(props.class)), role: "img", "aria-label": () => val(props.name) ?? t`Avatar` },
    () => {
      const src = val(props.src);
      if (src && !failed()) return untrack(() => h("img", { src, alt: "", loading: "lazy", onError: () => failed.set(true) }));
      return h("span", { class: "hm-avatar-text", "aria-hidden": "true" }, initials(val(props.name)));
    });
}

export interface CodeViewProps { code: MaybeFn<string | null | undefined>; lang?: string; wrap?: boolean; copy?: boolean; lineNumbers?: boolean; label?: MaybeFn<string>; class?: ClassProp }
/** Read-only code block with line numbers: `<CodeView code={src} lang="js" wrap={false} copy />` */
export function CodeView(props: CodeViewProps): Element {
  const wrap = signal(!!props.wrap);
  const lines = (): string[] => String(val(props.code) ?? "").replace(/\r\n?/g, "\n").split("\n");
  const numbers = props.lineNumbers !== false;
  return h("div", { class: () => cx("hm-code", wrap() && "is-wrapped", val(props.class)) },
    h("div", { class: "hm-code-bar" },
      props.lang && h("span", { class: "hm-code-lang" }, props.lang),
      h("button", { type: "button", class: "hm-btn hm-btn-ghost hm-btn-sm", "aria-pressed": () => String(wrap()), onClick: () => wrap.update((x) => !x) }, () => t`Wrap`),
      props.copy !== false && h(CopyButton, { text: () => val(props.code) })),
    h("pre", { class: "hm-code-pre", tabindex: "0", "aria-label": () => val(props.label) ?? t`Code` },
      h("code", {}, () => lines().map((line, i) => h("span", { class: "hm-code-line" },
        numbers && h("span", { class: "hm-code-ln", "aria-hidden": "true" }, String(i + 1)),
        h("span", { class: "hm-code-text" }, line), "\n")))));
}

// ------------------------------------------------------------------ JsonView
function jsonNode(key: string | number | null, value: unknown, depth: number, openDepth: number, seen: Set<object>): Element {
  const keyEl = key != null && [h("span", { class: "hm-json-key" }, typeof key === "number" ? String(key) : JSON.stringify(key)), h("span", { class: "hm-json-punct" }, ": ")];
  if (value === null || typeof value !== "object") {
    const type = value === null ? "null" : typeof value;
    const text = type === "string" ? JSON.stringify(value) : type === "undefined" ? "undefined" : type === "bigint" ? `${value as bigint}n` : String(value);
    return h("li", { class: "hm-json-row" }, keyEl, h("span", { class: `hm-json-${type}` }, text));
  }
  if (seen.has(value)) return h("li", { class: "hm-json-row" }, keyEl, h("span", { class: "hm-json-null" }, "[circular]"));
  seen.add(value);
  const arr = Array.isArray(value);
  const entries: [string | number, unknown][] | null = arr ? (value as unknown[]).map((v, i) => [i, v]) : value instanceof Date ? null : Object.entries(value);
  if (!entries) return h("li", { class: "hm-json-row" }, keyEl, h("span", { class: "hm-json-string" }, JSON.stringify(value)));
  const open = signal(depth < openDepth);
  const [o, c] = arr ? ["[", "]"] : ["{", "}"];
  const kids = (): Element[] => untrack(() => entries.map(([k, v]) => jsonNode(k, v, depth + 1, openDepth, new Set(seen))));
  return h("li", { class: "hm-json-row" },
    h("button", { type: "button", class: "hm-json-toggle", "aria-expanded": () => String(open()), onClick: () => open.update((x) => !x) },
      keyEl, h("span", { class: "hm-json-punct" }, o),
      () => (open() ? null : h("span", { class: "hm-json-more" }, ` ${entries.length} ${arr ? t`items` : t`keys`} ${c}`))),
    () => open() && [h("ul", { class: "hm-json-list", role: "group" }, kids()), h("span", { class: "hm-json-punct" }, c)]);
}
export interface JsonViewProps { value: MaybeFn<unknown>; /** Initially expanded depth (default 1). */ open?: number; class?: ClassProp }
/** Collapsible read-only JSON tree: `<JsonView value={obj} open={1} />` (open = initially expanded depth). */
export function JsonView(props: JsonViewProps): Element {
  return h("div", { class: () => cx("hm-json", val(props.class)) },
    h("ul", { class: "hm-json-list hm-json-root", role: "tree" }, () => { const v = val(props.value); return untrack(() => jsonNode(null, v, 0, props.open ?? 1, new Set())); }));
}

/** A KeyValue row. */
export interface KeyValueItem { label: MaybeFn<unknown>; value: MaybeFn<unknown>; hint?: MaybeFn<unknown>; hidden?: MaybeFn<boolean> }
export interface KeyValueProps {
  /** Rows, or an object (keys become labels). */
  items: MaybeFn<readonly KeyValueItem[] | Record<string, unknown> | null | undefined>;
  columns?: number;
  /** Shown for null / "" values (default "—"). */
  empty?: unknown;
  class?: ClassProp;
}
/** Definition list for detail views: `<KeyValue items={[{ label: "Email", value: user.email }]} columns={2} />` or an object. */
export function KeyValue(props: KeyValueProps): Element {
  const items = (): readonly KeyValueItem[] => { const v = val(props.items); return Array.isArray(v) ? v : Object.entries(v ?? {}).map(([label, value]) => ({ label, value })); };
  return h("dl", { class: () => cx("hm-kv", (props.columns ?? 0) > 1 && `hm-kv-cols-${Math.min(props.columns ?? 0, 4)}`, val(props.class)) },
    () => items().filter((x) => !val(x.hidden)).map((x) => h("div", { class: "hm-kv-row" },
      h("dt", {}, () => val(x.label)),
      h("dd", {}, () => { const v = val(x.value); return v == null || v === "" ? (props.empty ?? "—") : v; }, x.hint != null && h("span", { class: "hm-kv-hint" }, () => val(x.hint))))));
}

/** A Timeline entry; `time` may be a Date, epoch ms, ISO string (formatted) or text. */
export interface TimelineItem { time?: MaybeFn<unknown>; title?: MaybeFn<unknown>; body?: unknown; tone?: Tone; icon?: unknown }
export interface TimelineProps { items: MaybeFn<readonly TimelineItem[] | null | undefined>; class?: ClassProp }
/** `<Timeline items={[{ time, title, body, tone, icon }]} />` — time may be a Date/epoch/ISO (formatted) or text. */
export function Timeline(props: TimelineProps): Element {
  const fmt = (v: unknown): unknown => (typeof v === "string" && !toDate(v) ? v : v instanceof Date || typeof v === "number" || toDate(v) ? applyPipe("datetime", v) : v);
  return h("ol", { class: () => cx("hm-timeline", val(props.class)) },
    () => (val(props.items) ?? []).map((x) => h("li", { class: cx("hm-tl-item", x.tone && `hm-tl-${x.tone}`) },
      h("span", { class: "hm-tl-dot", "aria-hidden": "true" }, icon(x.icon)),
      h("div", { class: "hm-tl-main" },
        x.time != null && h("time", { class: "hm-tl-time", datetime: toDate(x.time)?.toISOString?.() ?? null }, () => fmt(val(x.time))),
        x.title != null && h("div", { class: "hm-tl-title" }, () => val(x.title)),
        x.body != null && h("div", { class: "hm-tl-body" }, typeof x.body === "function" && !x.body.length ? (x.body as () => unknown)() : x.body)))));
}

// ------------------------------------------------------------------ layout helpers
export type Align = "start" | "center" | "end" | "stretch" | "baseline" | "between";
const ALIGN: Record<string, string | undefined> = { start: "start", center: "center", end: "end", stretch: "stretch", baseline: "baseline", between: "between" };
export interface StackProps {
  /** Token step 0–8 (default 3). */
  gap?: number;
  direction?: "row" | "column";
  align?: Align;
  justify?: Align;
  wrap?: boolean;
  as?: string;
  class?: ClassProp;
  children?: unknown;
  [attr: string]: unknown;
}
/** `<Stack gap={3} direction="row" align="center" justify="between" wrap>…</Stack>` (gap = token step 0–8) */
export function Stack(props: StackProps): Element {
  return h(props.as ?? "div", { ...rest(props, ["gap", "direction", "align", "justify", "wrap", "as"]),
    class: () => cx("hm-stack", props.direction === "row" && "hm-stack-row", `hm-gap-${props.gap ?? 3}`, props.wrap && "hm-stack-wrap",
      ALIGN[props.align ?? ""] && `hm-align-${props.align}`, ALIGN[props.justify ?? ""] && `hm-justify-${props.justify}`, val(props.class)) }, props.children);
}
export interface GridProps {
  /** Columns 1–6 (default 2); collapses on small screens. */
  cols?: number;
  gap?: number;
  /** Auto-fill columns of at least this width ("16rem"). */
  min?: string;
  class?: ClassProp;
  children?: unknown;
  [attr: string]: unknown;
}
/** `<Grid cols={3} gap={4}>` (collapses on small screens) or `<Grid min="16rem">` (auto-fill columns). */
export function Grid(props: GridProps): Element {
  return h("div", { ...rest(props, ["cols", "gap", "min"]),
    class: () => cx("hm-grid", props.min ? "hm-grid-auto" : `hm-grid-${Math.min(props.cols ?? 2, 6)}`, `hm-gap-${props.gap ?? 4}`, val(props.class)),
    style: props.min ? { "--hm-grid-min": props.min } : undefined }, props.children);
}
export interface ToolbarProps { label?: MaybeFn<string>; end?: unknown; class?: ClassProp; children?: unknown }
/** Horizontal bar of controls: `<Toolbar label="Filters" end={<Button>…</Button>}>…</Toolbar>` */
export function Toolbar(props: ToolbarProps): Element {
  return h("div", { class: () => cx("hm-toolbar", val(props.class)), role: "toolbar", "aria-label": () => val(props.label) ?? null },
    h("div", { class: "hm-toolbar-start" }, props.children),
    props.end != null && h("div", { class: "hm-toolbar-end" }, props.end));
}
export interface DividerProps { label?: MaybeFn<string>; vertical?: boolean }
/** `<Divider />` or `<Divider label="or" />`; `vertical` for inline separators. */
export function Divider(props: DividerProps = {}): Element {
  if (props.label != null) return h("div", { class: "hm-divider hm-divider-label", role: "separator" }, h("span", {}, () => val(props.label)));
  return h(props.vertical ? "span" : "hr", { class: cx("hm-divider", props.vertical && "hm-divider-v"), role: props.vertical ? "separator" : null, "aria-orientation": props.vertical ? "vertical" : null });
}

// ------------------------------------------------------------------ loaders
export interface LoaderProps { text?: MaybeFn<string>; overlay?: boolean; class?: ClassProp }
/** Full-area spinner: `<Loader text="Loading users…" />` */
export function Loader(props: LoaderProps = {}): Element {
  return h("div", { class: () => cx("hm-loader", props.overlay && "hm-loader-overlay", val(props.class)), role: "status", "aria-live": "polite" },
    h("span", { class: "hm-loading hm-spin-lg", "aria-hidden": "true" }),
    h("span", { class: props.text != null ? "hm-loader-text" : "hm-sr-only" }, () => val(props.text) ?? t`Loading`));
}

/** Boot loader: the app's index.html shows a static `#hm-boot` element; call `bootLoader.done()` once the app rendered. */
export const bootLoader = {
  done({ id = "hm-boot", fade = 250 }: { id?: string; fade?: number } = {}): boolean {
    const el = globalThis.document?.getElementById(id);
    if (!el) return false;
    el.classList.add("hm-boot-done");
    el.setAttribute("aria-hidden", "true");
    setTimeout(() => el.remove(), fade);
    return true;
  },
};
