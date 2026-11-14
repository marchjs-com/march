// BottomNav's Create menu: the raised middle button opens a menu of create actions (new post, story, live…) in one of
// three looks: "sheet" (a Drawer from the bottom with ListRow actions; the Drawer loads with the first sheet), "fan"
// (round buttons on an arc above the button) or "stack" (pills stacked above it). It opens on the layer stack, so
// inside an OverlayScope (a device preview) it stays in that box.
// Keyboard: arrows move, Home / End, Escape closes and gives focus back to the button; Tab stays inside.
import { h } from "../../../dom/h.ts";
import { openLayer } from "../../../dom/portal.ts";
import { signal, effect, createRoot } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, icon, type MaybeFn } from "../../../ui/util.ts";
import { roving } from "../../../ui/focus.ts";
import { setStyle } from "../../../motion/env.ts";
import { colorAttr, BRAND_COLORS, type ColorToken } from "../../../theme/colors.ts";
import { overlayScopeFor } from "../../layout/overlay-scope/index.ts";
import { animate } from "../../../motion/animate.ts";
import { Badge } from "../../data/badge/index.ts";
import { ListRow } from "../../data/list-row/index.ts";

export interface BottomNavAction {
  id: string;
  label: MaybeFn<string>;
  icon?: unknown;
  /** A second line (sheet look) and the tooltip (fan look). */
  desc?: MaybeFn<string | undefined>;
  /** Color of the action's icon disc. Default: the four HADİ colors in turn. */
  color?: ColorToken | undefined;
  /** A count or short text on the action. */
  badge?: MaybeFn<number | string | null | undefined>;
  disabled?: MaybeFn<boolean | undefined>;
  hidden?: MaybeFn<boolean | undefined>;
  run?: (() => void) | undefined;
}
export type CreateMenuLook = "sheet" | "fan" | "stack";

interface MenuOptions {
  look: CreateMenuLook; title?: string | false | undefined; handle?: boolean | undefined; motion?: boolean | undefined; onPick: (a: BottomNavAction) => void; onClose: () => void;
}
const colorOf = (a: BottomNavAction, i: number): ColorToken => a.color ?? BRAND_COLORS[i % BRAND_COLORS.length]!;
const disc = (a: BottomNavAction): Element => h("span", { class: "hm-bnav-action-icon", "aria-hidden": "true" }, icon(a.icon, "hm-bnav-glyph")) as Element;
/** The count or short text of an action: a Badge (nothing at 0 or without text). */
const badgeOf = (a: BottomNavAction): unknown => (a.badge === undefined ? null : () => {
  const b = val(a.badge);
  return b == null || b === 0 || b === "" ? null : typeof b === "number" ? h(Badge, { class: "hm-bnav-action-badge", count: b }) : h(Badge, { class: "hm-bnav-action-badge", tone: "danger" }, b);
});

/** Open the Create menu above `button`; returns the function that closes it. */
export function openCreateMenu(button: HTMLElement, actions: readonly BottomNavAction[], o: MenuOptions): () => void {
  const list = actions.filter((a) => !val(a.hidden));
  const scope = overlayScopeFor(button);
  if (o.look === "sheet") return openSheetMenu(list, scope, o);
  const box = scope?.getBoundingClientRect() ?? { left: 0, top: 0, width: globalThis.innerWidth ?? 400, height: globalThis.innerHeight ?? 800 };
  const r = button.getBoundingClientRect();
  const cx0 = r.left + r.width / 2 - box.left, gapFromBottom = box.height - (r.top - box.top) + 12;
  const rtl = globalThis.getComputedStyle?.(button).direction === "rtl";
  const n = list.length, fan = o.look === "fan";
  // fan: an arc above the button, wider with more actions; the first action on the reading start side
  const radius = Math.max(92, 64 + n * 12);
  const angle = (i: number): number => { const a = n === 1 ? 90 : 160 - (140 * i) / (n - 1); return ((rtl ? 180 - a : a) * Math.PI) / 180; };
  const at = (i: number): [number, number] => [Math.cos(angle(i)) * radius, -Math.sin(angle(i)) * radius];

  let closing = false, close = (): void => {};
  const finish = (): void => {
    if (closing) return;
    closing = true;
    if (o.motion === false) { close(); o.onClose(); return; }
    animate(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
    items.forEach((el) => animate(el, [{ opacity: 1 }, { opacity: 0, transform: fan ? "translate(0px, 0px) scale(.3)" : "translateY(10px)" }], { duration: 150, fill: "forwards" }));
    setTimeout(() => { close(); o.onClose(); }, 160);
  };
  const pick = (a: BottomNavAction): void => { if (val(a.disabled)) return; o.onPick(a); finish(); };

  const item = (a: BottomNavAction, i: number): HTMLElement => {
    const el = h("button", {
      type: "button", role: "menuitem", class: "hm-bnav-action", "data-hm-color": colorAttr(colorOf(a, i)),
      disabled: () => !!val(a.disabled), title: fan ? () => val(a.desc) ?? val(a.label) : null, onClick: () => pick(a),
    },
    disc(a),
    h("span", { class: "hm-bnav-action-text" }, h("span", { class: "hm-bnav-action-label" }, () => val(a.label))),
    badgeOf(a)) as HTMLElement;
    if (fan) { const [x, y] = at(i); setStyle(el, { transform: `translate(${x}px, ${y}px)` }); }
    return el;
  };

  const items = list.map(item);
  const enabled = (): HTMLElement[] => items.filter((x) => !(x as HTMLButtonElement).disabled);
  const panel = h("div", {
    class: cx("hm-bnav-actions", `is-${o.look}`), role: "menu", "aria-label": o.title || t`Create`, "aria-orientation": fan ? "horizontal" : "vertical",
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finish(); button.focus(); return; }
      // the stack grows upward (the first action is nearest to the button), so its arrows run the other way; Tab stays inside
      const stack = !fan, up = e.key === "ArrowUp" || e.key === "ArrowLeft", down = e.key === "ArrowDown" || e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey);
      const order = stack && (e.key === "ArrowUp" || e.key === "ArrowDown") ? [...enabled()].reverse() : enabled();
      if (up || down || e.key === "Tab") { e.preventDefault(); const i = order.indexOf(globalThis.document.activeElement as HTMLElement); order[(i + (down ? 1 : -1) + order.length) % order.length]?.focus(); }
      else roving(e, enabled());
    },
  }, items) as HTMLElement;
  // fan and stack sit above the button
  setStyle(panel, { left: `${cx0}px`, bottom: `${gapFromBottom + (fan ? 8 : 0)}px` });
  const scrim = h("div", { class: "hm-bnav-scrim", "aria-hidden": "true", onClick: finish }) as HTMLElement;
  const root = h("div", { class: cx("hm-bnav-menu", `is-${o.look}`) }, scrim, panel) as HTMLElement;
  close = openLayer("menu", root, scope);

  if (o.motion === false) { queueMicrotask(() => (enabled()[0] ?? panel).focus()); return finish; }
  // in: the scrim fades, the round buttons fly out of the Create button one after another
  animate(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: "none" });
  items.forEach((el, i) => {
    const [x, y] = at(i);
    const from = fan ? { opacity: 0, transform: "translate(0px, 0px) scale(.3)" } : { opacity: 0, transform: "translateY(12px) scale(.96)" };
    const to = fan ? { opacity: 1, transform: `translate(${x}px, ${y}px) scale(1)` } : { opacity: 1, transform: "translateY(0) scale(1)" };
    animate(el, [from, to], { duration: fan ? 380 : 260, delay: 40 * i, easing: fan ? "easeOutBack" : "easeOutCubic", fill: "backwards" });
  });
  queueMicrotask(() => (enabled()[0] ?? panel).focus());
  return finish;
}

/** The "sheet" look: a Drawer from the bottom edge (handle, title, drag to close, focus and Escape are its own) with one ListRow per action. */
function openSheetMenu(list: readonly BottomNavAction[], scope: HTMLElement | null, o: MenuOptions): () => void {
  let closed = false, hide: (() => void) | null = null;
  const finish = (): void => { if (closed) return; closed = true; if (hide) hide(); };
  const pick = (a: BottomNavAction): void => { if (val(a.disabled)) return; o.onPick(a); finish(); };
  const first = list.findIndex((a) => !val(a.disabled));
  const rows = list.map((a, i) => h(ListRow, {
    role: "menuitem", class: "hm-bnav-action", size: "lg", color: colorOf(a, i), "data-autofocus": i === first ? "" : null,
    lead: disc(a), title: () => val(a.label), sub: a.desc != null ? () => val(a.desc) ?? "" : undefined, trail: a.badge !== undefined ? badgeOf(a) : undefined,
    disabled: () => !!val(a.disabled), onClick: () => pick(a),
  }) as HTMLElement);
  const menu = h("div", {
    class: "hm-bnav-actions is-sheet", role: "menu", "aria-label": o.title || t`Create`, "aria-orientation": "vertical",
    onKeyDown: (e: KeyboardEvent) => { roving(e, rows.filter((x) => !(x as HTMLButtonElement).disabled)); },
  }, rows);
  // the Drawer (dialog frame, gestures) is loaded with the first sheet, so the bar itself stays light
  void import("../../overlays/drawer/index.ts").then(({ Drawer }) => {
    if (closed) { o.onClose(); return; }
    createRoot((dispose) => {
      const open = signal(true);
      hide = () => open.set(false);
      const view = Drawer({
        open, side: "bottom", class: "hm-bnav-sheet", target: scope ?? "page", closeButton: false, motion: o.motion !== false, handle: o.handle,
        title: o.title === false ? undefined : o.title ?? t`Create`, label: o.title || t`Create`, onClose: finish, children: menu,
      });
      // mounted while the Drawer shows it; once it has left the page the menu is over
      effect(() => { if (!view() && !open()) queueMicrotask(() => { dispose(); o.onClose(); }); });
    }, null);
    // the actions rise one after another behind the sheet
    if (o.motion !== false) rows.forEach((el, i) => animate(el, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 260, delay: 80 + 40 * i, easing: "easeOutCubic", fill: "backwards" }));
  }, () => { closed = true; o.onClose(); });
  return finish;
}
