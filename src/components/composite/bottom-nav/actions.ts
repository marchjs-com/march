// BottomNav's Create menu: the raised middle button opens a menu of create actions (new post, story, live…) in one of
// three looks: "sheet" (a list from the bottom), "fan" (round buttons on an arc above the button) or "stack" (pills
// stacked above it). It opens on the layer stack, so inside an OverlayScope (a device preview) it stays in that box.
// Keyboard: arrows move, Home / End, Escape closes and gives focus back to the button; Tab stays inside.
import { h } from "../../../dom/h.ts";
import { openLayer } from "../../../dom/portal.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, icon, type MaybeFn } from "../../../ui/util.ts";
import { setStyle } from "../../../motion/env.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { overlayScopeFor } from "../../layout/overlay-scope/index.ts";
import { animate } from "../../../motion/animate.ts";

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

const CYCLE: ColorToken[] = ["brand-orange", "brand-blue", "brand-green", "brand-purple"];

/** Open the Create menu above `button`; returns the function that closes it. */
export function openCreateMenu(button: HTMLElement, actions: readonly BottomNavAction[], o: {
  look: CreateMenuLook; title?: string | undefined; onPick: (a: BottomNavAction) => void; onClose: () => void;
}): () => void {
  const list = actions.filter((a) => !val(a.hidden));
  const scope = overlayScopeFor(button);
  const box = scope?.getBoundingClientRect() ?? { left: 0, top: 0, width: globalThis.innerWidth ?? 400, height: globalThis.innerHeight ?? 800 };
  const r = button.getBoundingClientRect();
  const cx0 = r.left + r.width / 2 - box.left, gapFromBottom = box.height - (r.top - box.top) + 12;
  const rtl = globalThis.getComputedStyle?.(button).direction === "rtl";
  const n = list.length;
  // fan: an arc above the button, wider with more actions; the first action on the reading start side
  const radius = Math.max(92, 64 + n * 12);
  const angle = (i: number): number => { const a = n === 1 ? 90 : 160 - (140 * i) / (n - 1); return ((rtl ? 180 - a : a) * Math.PI) / 180; };
  const at = (i: number): [number, number] => [Math.cos(angle(i)) * radius, -Math.sin(angle(i)) * radius];

  let closing = false, close = (): void => {};
  const finish = (): void => {
    if (closing) return;
    closing = true;
    const els = [...panel.querySelectorAll<HTMLElement>(".hm-bnav-action")];
    animate(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
    const out = o.look === "sheet" ? animate(panel, [{ transform: "translateY(0)" }, { transform: "translateY(100%)" }], { duration: 200, easing: "easeInCubic", fill: "forwards" })
      : null;
    if (o.look !== "sheet") els.forEach((el) => animate(el, [{ opacity: 1 }, { opacity: 0, transform: o.look === "fan" ? "translate(0px, 0px) scale(.3)" : "translateY(10px)" }], { duration: 150, fill: "forwards" }));
    const done = (): void => { close(); o.onClose(); };
    if (out) void Promise.resolve(out.finished).then(done, done); else setTimeout(done, 160);
  };
  const pick = (a: BottomNavAction): void => { if (val(a.disabled)) return; o.onPick(a); finish(); };

  const item = (a: BottomNavAction, i: number): HTMLElement => {
    const el = h("button", {
      type: "button", role: "menuitem", class: "hm-bnav-action", "data-hm-color": colorAttr(a.color ?? CYCLE[i % CYCLE.length]!),
      disabled: () => !!val(a.disabled), title: o.look === "fan" ? () => val(a.desc) ?? val(a.label) : null, onClick: () => pick(a),
    },
    h("span", { class: "hm-bnav-action-icon", "aria-hidden": "true" }, icon(a.icon, "hm-bnav-glyph")),
    h("span", { class: "hm-bnav-action-text" },
      h("span", { class: "hm-bnav-action-label" }, () => val(a.label)),
      o.look === "sheet" && a.desc != null ? h("span", { class: "hm-bnav-action-desc" }, () => val(a.desc) ?? "") : null),
    a.badge !== undefined ? (() => { const b = val(a.badge); return b == null || b === 0 || b === "" ? null : h("span", { class: "hm-bnav-action-badge" }, String(b)); }) : null) as HTMLElement;
    if (o.look === "fan") { const [x, y] = at(i); setStyle(el, { transform: `translate(${x}px, ${y}px)` }); }
    return el;
  };

  const items = list.map(item);
  const panel = h("div", {
    class: cx("hm-bnav-actions", `is-${o.look}`), role: "menu", "aria-label": o.title ?? t`Create`, "aria-orientation": o.look === "fan" ? "horizontal" : "vertical",
    onKeyDown: (e: KeyboardEvent) => {
      const enabled = items.filter((x) => !(x as HTMLButtonElement).disabled), i = enabled.indexOf(globalThis.document.activeElement as HTMLElement);
      const go = (j: number): void => { e.preventDefault(); enabled[(j + enabled.length) % enabled.length]?.focus(); };
      if (e.key === "Escape") { e.preventDefault(); finish(); button.focus(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowRight") go(o.look === "stack" && e.key === "ArrowDown" ? i - 1 : i + 1);
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") go(o.look === "stack" && e.key === "ArrowUp" ? i + 1 : i - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(enabled.length - 1);
      else if (e.key === "Tab") go(e.shiftKey ? i - 1 : i + 1);
    },
  },
  o.look === "sheet" ? [h("span", { class: "hm-bnav-sheet-handle", "aria-hidden": "true" }), h("strong", { class: "hm-bnav-sheet-title" }, o.title ?? t`Create`)] : null,
  items) as HTMLElement;
  // fan and stack sit above the button; the sheet takes the bottom edge
  if (o.look !== "sheet") setStyle(panel, { left: `${cx0}px`, bottom: `${gapFromBottom + (o.look === "fan" ? 8 : 0)}px` });
  const scrim = h("div", { class: "hm-bnav-scrim", "aria-hidden": "true", onClick: finish }) as HTMLElement;
  const root = h("div", { class: cx("hm-bnav-menu", `is-${o.look}`) }, scrim, panel) as HTMLElement;
  close = openLayer("menu", root, scope);

  // in: the scrim fades, the sheet rises, the round buttons fly out of the Create button one after another
  animate(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: "none" });
  if (o.look === "sheet") animate(panel, [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], { duration: 280, easing: "easeOutCubic", fill: "none" });
  items.forEach((el, i) => {
    const [x, y] = at(i);
    const from = o.look === "fan" ? { opacity: 0, transform: "translate(0px, 0px) scale(.3)" } : { opacity: 0, transform: "translateY(12px) scale(.96)" };
    const to = o.look === "fan" ? { opacity: 1, transform: `translate(${x}px, ${y}px) scale(1)` } : { opacity: 1, transform: "translateY(0) scale(1)" };
    animate(el, [from, to], { duration: o.look === "fan" ? 380 : 260, delay: 40 * i + (o.look === "sheet" ? 80 : 0), easing: o.look === "fan" ? "easeOutBack" : "easeOutCubic", fill: "backwards" });
  });
  queueMicrotask(() => (items.find((x) => !(x as HTMLButtonElement).disabled) ?? panel).focus());
  return finish;
}
