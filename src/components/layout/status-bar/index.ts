// StatusBar (march/ui): the strip at the bottom of an editor or app: items at the start and the end, plain text or
// buttons (an action or a command id), tones (info / success / warn / danger / busy). When the bar is too narrow the
// lowest-priority items leave for a "…" menu. Items marked `live` are announced when their text changes.
import "./status-bar.css";
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Menu, Tooltip, type MenuItem } from "../../../ui/menu.ts";
import { formatKey } from "../../../ui/key-label.ts";
import { overflowFit } from "../../../ui/fit.ts";
import { commandBinding } from "../../../managers/command/ui.ts";
import { play } from "../../../motion/play.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import { PlainListRow } from "../../data/list-row/core.ts";
import { more } from "../../../icons/glyphs/more.ts";
import type { IconProp } from "../../../icons/types.ts";
import type { Handler } from "../../../core/util.ts";

messages("tr", { "Status bar": "Durum çubuğu", "More status": "Diğer durum bilgileri" });

export type StatusTone = "neutral" | "info" | "success" | "warn" | "danger" | "busy";
export interface StatusItem {
  id: string;
  text?: MaybeFn<string>;
  icon?: IconProp;
  /** Which end of the bar (default "start"; "end" follows the writing direction). */
  side?: "start" | "end";
  tone?: MaybeFn<StatusTone | undefined>;
  /** Tooltip / accessible description. */
  title?: MaybeFn<string | undefined>;
  /** Makes it a button. */
  onSelect?: Handler<[]> | undefined;
  /** A command id: makes it a button that runs the command (text and icon default to the command's). */
  command?: string;
  /** Higher stays longer when space runs out (default 0). */
  priority?: number;
  /** Announce changes of the text (polite). */
  live?: boolean;
}
export interface StatusBarProps {
  /** The items of the bar (live). @tr Çubuğun öğeleri (canlı). */
  items: MaybeFn<readonly StatusItem[]>;
  /** Accessible name of the bar (default "Status bar"). @tr Çubuğun erişilebilir adı (varsayılan "Durum çubuğu"). */
  label?: MaybeFn<string | undefined>;
  /** Accessible name of the "…" menu (default "More status"). @tr "…" menüsünün erişilebilir adı (varsayılan "Diğer durumlar"). */
  moreLabel?: MaybeFn<string | undefined>;
  /** Icon of the "…" menu button. @tr "…" menü düğmesinin ikonu. */
  moreIcon?: IconProp;
  /** false: no "…" menu; every item stays in the bar (default true). @tr false: "…" menüsü yok; her öğe çubukta kalır (varsayılan true). */
  overflow?: boolean;
  /** The tone dot of items without an icon: true (default), false, or `(tone, item) => node` (tone is live). @tr İkonsuz öğelerin ton noktası: true (varsayılan), false ya da `(tone, item) => node` (tone canlıdır). */
  dot?: boolean | ((tone: () => StatusTone, item: StatusItem) => unknown);
  /** false: the dot of a busy item stays still (default true). @tr false: meşgul bir öğenin noktası kıpırdamaz (varsayılan true). */
  pulse?: boolean;
  /** Extra class on the bar. @tr Çubuğa eklenen sınıf. */
  class?: ClassProp;
}

/** `<StatusBar items={[{ id: "branch", icon: gitBranch, text: "main", onSelect: pick }, { id: "pos", side: "end", text: () => `Ln ${$line}` }]} />` */
export function StatusBar(props: StatusBarProps): Element {
  const list = computed(() => val(props.items) ?? []);
  const ordered = computed(() => [...list().filter((x) => x.side !== "end"), ...list().filter((x) => x.side === "end")]);
  const said = signal("");
  let bar: HTMLElement | undefined, moreEl: HTMLElement | undefined;
  const fit = overflowFit({
    items: ordered, enabled: () => props.overflow !== false, reserve: () => (moreEl?.offsetWidth || 28) + 2,
    measure: () => (bar ? [...bar.querySelectorAll<HTMLElement>(".m-sbar-item")].map((c) => (c.offsetWidth || 0) + 2) : null),
    priority: (i) => untrack(ordered)[i]?.priority ?? 0,
  });
  const { isShown } = fit;

  const item = (x: StatusItem, i: number): Element => {
    const b = x.command || x.onSelect ? commandBinding({ command: x.command, label: x.text, icon: x.icon, onSelect: x.onSelect }) : null;
    const text = (): string => (b ? b.label() : val(x.text) ?? "");
    const tone = (): StatusTone => val(x.tone) ?? "neutral";
    const tip = (): string => { const s = val(x.title) ?? ""; const k = b?.shortcut(); return k ? `${s || text()} (${formatKey(k)})` : s; };
    // busy: the dot blinks (StatusDot; still under reduced motion). Your own mark breathes on the motion engine.
    const ownDot = typeof props.dot === "function" ? props.dot : null;
    const busy = (): boolean => tone() === "busy" && props.pulse !== false;
    const dot = props.dot === false ? null : !ownDot
      ? h(StatusDot, { class: "m-sbar-dot", size: "sm", tone: () => { const v = tone(); return v === "busy" ? "primary" : v; }, pulse: () => (busy() ? "blink" : false) })
      : h("span", { class: "m-sbar-dot-own", "aria-hidden": "true", ref: (el: HTMLElement) => {
        let run: { cancel(): void } | null = null;
        effect(() => { run?.cancel(); run = busy() ? play(el, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0.35, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)" }], { duration: 1100, iterations: Infinity }) : null; });
        onCleanup(() => run?.cancel());
      } }, ownDot(tone, x));
    if (x.live) { let first = true; effect(() => { const v = text(); if (first) { first = false; return; } untrack(() => said.set(v)); }); }
    const cls = (): string => cx("m-sbar-item", `is-${tone()}`, b && "is-button");
    // an item is the smallest ListRow (the plain one): the icon or the tone dot leads, the text is the title; a button when it runs something
    const row = { size: "xs" as const, class: cls, hidden: () => !isShown(i), lead: () => icon(b ? b.icon() : x.icon, "m-sbar-icon") ?? dot, title: text };
    const el = b
      ? h(PlainListRow, { ...row, disabled: () => b.disabled(), "aria-description": () => val(x.title) ?? null, onClick: () => b.run() }) as Element
      : h(PlainListRow, { ...row, as: "span" }) as Element;
    return tip() ? (h(Tooltip, { text: tip, placement: "top", children: el }) as unknown as Element) : el;
  };
  const overflow = computed((): MenuItem[] => ordered().flatMap((x, i): MenuItem[] => (isShown(i) ? [] : [{
    label: () => val(x.text) ?? (x.command ? commandBinding({ command: x.command }).label() : x.id), icon: x.icon,
    onSelect: () => (x.command || x.onSelect ? commandBinding({ command: x.command, onSelect: x.onSelect }).run() : undefined),
    disabled: !(x.command || x.onSelect),
  }])));

  return h("div", { class: () => cx("m-sbar", val(props.class)), role: "region", "aria-label": () => val(props.label) ?? t`Status bar`, ref: (x: HTMLElement) => { bar = x; fit.observe(x); } },
    h("div", { class: "m-sbar-side" }, () => ordered().map((x, i) => (x.side === "end" ? null : untrack(() => item(x, i))))),
    h("div", { class: "m-sbar-more", hidden: () => overflow().length === 0, ref: (x: HTMLElement) => { moreEl = x; } },
      h(Menu, { label: () => val(props.moreLabel) ?? t`More status`, icon: props.moreIcon ?? more, items: () => overflow(), placement: "top-start" })),
    h("div", { class: "m-sbar-side m-sbar-end" }, () => ordered().map((x, i) => (x.side === "end" ? untrack(() => item(x, i)) : null))),
    h("span", { class: "m-sr-only", role: "status", "aria-live": "polite" }, () => said()));
}
