// Shortcut hint UI: <ShortcutHints /> draws a badge next to every element with a shortcut while the hold key is down,
// and the grouped help list (Dialog + Kbd) when "?" is pressed. Mount it once; lazy on purpose.
import "./shortcut-hint.css";
import { effect, onCleanup, untrack } from "../../core/reactive.ts";
import { h } from "../../dom/h.ts";
import { openLayer } from "../../dom/portal.ts";
import { t, messages } from "../../core/i18n.ts";
import { formatKey } from "../../ui/keys.ts";
import { Kbd } from "../../ui/kbd.ts";
import { openDialog } from "../../ui/dialog.ts";
import { shortcutHints, comboOf, type ShortcutEntry } from "./index.ts";
import tr from "./tr.ts";

messages("tr", tr);

/** Badges for the elements that have a shortcut, placed at their inline-start edge (RTL aware). */
function badges(): HTMLElement {
  const box = h("div", { class: "hm-shortcut-badges", "aria-hidden": "true" }) as HTMLElement;
  const w = globalThis.innerWidth ?? 0;
  for (const el of shortcutHints.targets()) {
    const combo = comboOf(el);
    const r = el.getBoundingClientRect();
    if (!combo || (!r.width && !r.height) || r.bottom < 0 || r.top > (globalThis.innerHeight ?? 0)) continue;
    const rtl = globalThis.getComputedStyle?.(el).direction === "rtl";
    const b = h("span", { class: "hm-shortcut-badge" }, combo.split(/\s+/).map(formatKey).join(" ")) as HTMLElement;
    b.style.setProperty("top", `${r.top}px`);
    b.style.setProperty("inset-inline-start", `${Math.max(0, rtl ? w - r.right : r.left)}px`);
    box.appendChild(b);
  }
  return box;
}

/** The help list, grouped; inactive ones (another scope, under a modal) are dimmed. */
export function ShortcutHelp(): unknown {
  return () => {
    const all = shortcutHints.entries();
    if (!all.length) return h("p", { class: "hm-muted" }, t("No shortcuts yet."));
    const groups = new Map<string, ShortcutEntry[]>();
    for (const e of all) { const g = e.group ?? t("Other"); groups.set(g, [...(groups.get(g) ?? []), e]); }
    return h("div", { class: "hm-shortcut-help" }, [...groups].map(([g, list]) => h("section", { class: "hm-shortcut-group" },
      h("h3", {}, g),
      list.map((e) => h("div", { class: "hm-shortcut-row", "data-inactive": e.active ? null : "", title: e.active ? null : t("Not available here") },
        h("span", {}, e.description),
        h("span", {}, e.combo.split(/\s+/).map((c) => h(Kbd, { keys: c }))))))));
  };
}

/** Mount once (e.g. in the app shell). */
export function ShortcutHints(): null {
  let close: (() => void) | null = null;
  const reflow = (): void => { if (!close) return; close(); close = openLayer("fx", badges()); };
  effect(() => {
    if (shortcutHints.visible()) {
      close = untrack(() => openLayer("fx", badges()));
      globalThis.addEventListener?.("scroll", reflow, { passive: true, capture: true });
    } else if (close) {
      close(); close = null;
      globalThis.removeEventListener?.("scroll", reflow, { capture: true });
    }
  });
  effect(() => {
    if (!shortcutHints.helpOpen()) return;
    untrack(() => { void openDialog(() => h(ShortcutHelp, {}), { title: () => t("Keyboard shortcuts"), size: "sm" }).then(() => shortcutHints.closeHelp()); });
  });
  onCleanup(() => { close?.(); globalThis.removeEventListener?.("scroll", reflow, { capture: true }); });
  return null;
}

/** "Hold Alt to see shortcuts" line for a footer or a help page. */
export const holdHint = (key = "Alt"): string => t("Hold {0} to see shortcuts on the page.", { 0: key });
