// StatusBar (hadi-march/ui): the strip at the bottom of an editor or app: items at the start and the end, plain text or
// buttons (an action or a command id), tones (info / success / warn / danger / busy). When the bar is too narrow the
// lowest-priority items leave for a "…" menu. Items marked `live` are announced when their text changes.
import "./status-bar.css";
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Menu, Tooltip, type MenuItem } from "../../../ui/menu.ts";
import { formatKey } from "../../../ui/keys.ts";
import { fitItems, observeWidth } from "../../../ui/fit.ts";
import { commandBinding } from "../../../managers/command/ui.ts";
import { animate } from "../../../motion/animate.ts";
import { more } from "../../../icons/glyphs/more.ts";

messages("tr", { "Status bar": "Durum çubuğu", "More status": "Diğer durum bilgileri" });

export type StatusTone = "neutral" | "info" | "success" | "warn" | "danger" | "busy";
export interface StatusItem {
  id: string;
  text?: MaybeFn<string>;
  icon?: unknown;
  /** Which end of the bar (default "start"; "end" follows the writing direction). */
  side?: "start" | "end";
  tone?: MaybeFn<StatusTone | undefined>;
  /** Tooltip / accessible description. */
  title?: MaybeFn<string | undefined>;
  /** Makes it a button. */
  onSelect?: () => unknown;
  /** A command id: makes it a button that runs the command (text and icon default to the command's). */
  command?: string;
  /** Higher stays longer when space runs out (default 0). */
  priority?: number;
  /** Announce changes of the text (polite). */
  live?: boolean;
}
export interface StatusBarProps {
  items: MaybeFn<readonly StatusItem[]>;
  label?: MaybeFn<string | undefined>;
  /** Accessible name of the "…" menu (default "More status"). */
  moreLabel?: MaybeFn<string | undefined>;
  /** Icon of the "…" menu button. */
  moreIcon?: unknown;
  /** false: no "…" menu; every item stays in the bar (default true). */
  overflow?: boolean;
  /** The tone dot of items without an icon: true (default), false, or `(tone, item) => node` (tone is live). */
  dot?: boolean | ((tone: () => StatusTone, item: StatusItem) => unknown);
  /** false: the dot of a busy item stays still (default true). */
  pulse?: boolean;
  class?: ClassProp;
}

/** `<StatusBar items={[{ id: "branch", icon: gitBranch, text: "main", onSelect: pick }, { id: "pos", side: "end", text: () => `Ln ${$line}` }]} />` */
export function StatusBar(props: StatusBarProps): Element {
  const list = computed(() => val(props.items) ?? []);
  const ordered = computed(() => [...list().filter((x) => x.side !== "end"), ...list().filter((x) => x.side === "end")]);
  const shown = signal<boolean[]>([]);
  const said = signal("");
  let bar: HTMLElement | undefined, moreEl: HTMLElement | undefined, widths: number[] = [], avail = 0;

  const refit = (): void => {
    const items = untrack(ordered);
    if (!bar || props.overflow === false || widths.length !== items.length) return;
    const next = fitItems(widths.map((w) => w + 2), items.map((x) => x.priority ?? 0), avail, (moreEl?.offsetWidth || 28) + 2);
    const before = untrack(shown);
    if (next.length !== before.length || next.some((v, i) => v !== before[i])) shown.set(next);
  };
  effect(() => {
    ordered();
    untrack(() => {
      shown.set([]);
      queueMicrotask(() => { if (!bar) return; widths = [...bar.querySelectorAll<HTMLElement>(".hm-sbar-item")].map((c) => c.offsetWidth || 0); refit(); });
    });
  });
  const isShown = (i: number): boolean => shown()[i] !== false;

  const item = (x: StatusItem, i: number): Element => {
    const b = x.command || x.onSelect ? commandBinding({ command: x.command, label: x.text, icon: x.icon, onSelect: x.onSelect }) : null;
    const text = (): string => (b ? b.label() : val(x.text) ?? "");
    const tone = (): StatusTone => val(x.tone) ?? "neutral";
    const tip = (): string => { const s = val(x.title) ?? ""; const k = b?.shortcut(); return k ? `${s || text()} (${formatKey(k)})` : s; };
    // busy: the dot breathes (motion engine; still under reduced motion)
    const ownDot = typeof props.dot === "function" ? props.dot : null;
    const dot = props.dot === false ? null : h("span", { class: ownDot ? "hm-sbar-dot-own" : "hm-sbar-dot", "aria-hidden": "true", ref: (el: HTMLElement) => {
      let run: { cancel(): void } | null = null;
      effect(() => { run?.cancel(); run = tone() === "busy" && props.pulse !== false ? animate(el, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0.35, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)" }], { duration: 1100, iterations: Infinity }) : null; });
      onCleanup(() => run?.cancel());
    } }, ownDot ? ownDot(tone, x) : null);
    const body = [() => icon(b ? b.icon() : x.icon, "hm-sbar-icon"), x.icon || b?.icon() ? null : dot, h("span", { class: "hm-sbar-text" }, text)];
    if (x.live) { let first = true; effect(() => { const v = text(); if (first) { first = false; return; } untrack(() => said.set(v)); }); }
    const cls = (): string => cx("hm-sbar-item", `is-${tone()}`, b && "is-button");
    const el = b
      ? h("button", { type: "button", class: cls, hidden: () => !isShown(i), disabled: () => b.disabled(), "aria-description": () => val(x.title) ?? null, onClick: () => b.run() }, body)
      : h("span", { class: cls, hidden: () => !isShown(i) }, body);
    return tip() ? (h(Tooltip, { text: tip, placement: "top", children: el }) as unknown as Element) : el;
  };
  const overflow = computed((): MenuItem[] => ordered().flatMap((x, i): MenuItem[] => (isShown(i) ? [] : [{
    label: () => val(x.text) ?? (x.command ? commandBinding({ command: x.command }).label() : x.id), icon: x.icon,
    onSelect: () => (x.command || x.onSelect ? commandBinding({ command: x.command, onSelect: x.onSelect }).run() : undefined),
    disabled: !(x.command || x.onSelect),
  }])));

  return h("div", { class: () => cx("hm-sbar", val(props.class)), role: "region", "aria-label": () => val(props.label) ?? t`Status bar`, ref: (x: HTMLElement) => { bar = x; observeWidth(x, (w) => { avail = w; refit(); }); } },
    h("div", { class: "hm-sbar-side" }, () => ordered().map((x, i) => (x.side === "end" ? null : untrack(() => item(x, i))))),
    h("div", { class: "hm-sbar-more", hidden: () => overflow().length === 0, ref: (x: HTMLElement) => { moreEl = x; } },
      h(Menu, { label: () => val(props.moreLabel) ?? t`More status`, icon: props.moreIcon ?? more, items: () => overflow(), placement: "top-start" })),
    h("div", { class: "hm-sbar-side hm-sbar-end" }, () => ordered().map((x, i) => (x.side === "end" ? untrack(() => item(x, i)) : null))),
    h("span", { class: "hm-sr-only", role: "status", "aria-live": "polite" }, () => said()));
}
