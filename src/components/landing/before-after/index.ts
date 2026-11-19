// BeforeAfter (march/landing): two layers on top of each other and a divider that reveals one or the other.
// Drag anywhere (a press jumps the divider there), use the handle with the keyboard (arrows, Shift ×10, Home / End),
// or set `follow` so the divider tracks the pointer without a press. Horizontal or vertical; mirrored in RTL.
// When it first scrolls into view the divider sways once to show it can move (not with reduced motion).
import "./before-after.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, untrack } from "../../../core/reactive.ts";
import { t, dir, messages } from "../../../core/i18n.ts";
import { cx, val, clamp, setStyle, listen, onVisible, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { owned } from "../../../ui/observe.ts";
import { Badge } from "../../data/badge/index.ts";
import { track, arrowStep } from "../../../behaviors/drag/index.ts";
import { animateValue } from "../../../motion/engine/value.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import tr from "./tr.ts";

messages("tr", tr);

export interface BeforeAfterProps {
  /** The first layer (start / top side): an image, a mock, any node; a string is drawn as a large centred text. @tr İlk katman (başlangıç / üst taraf): bir görsel, bir taslak, herhangi bir düğüm; bir metin ortada büyük yazılır. */
  before: unknown;
  /** The second layer (end / bottom side). @tr İkinci katman (bitiş / alt taraf). */
  after: unknown;
  /** Corner chip on the first layer; it fades when the divider covers it. @tr İlk katmanın köşesindeki etiket; ayırıcı üstünü kapatınca solar. */
  beforeLabel?: unknown | undefined;
  /** Corner chip on the second layer; it fades when the divider covers it. @tr İkinci katmanın köşesindeki etiket; ayırıcı üstünü kapatınca solar. */
  afterLabel?: unknown | undefined;
  /** Divider position, 0–100 from the start (default 50). @tr Ayırıcının konumu, baştan itibaren 0–100 (varsayılan 50). */
  value?: MaybeFn<number> | undefined;
  /** Called with the new position after a drag or key press. @tr Sürükleme ya da tuşa basma sonrasında yeni konumla çağrılır. */
  onChange?: ((v: number) => void) | undefined;
  /** `horizontal`: the divider is vertical and moves across (default) · `vertical`: it moves down. @tr `horizontal`: ayırıcı dikeydir ve yatayda kayar (varsayılan) · `vertical`: aşağı doğru kayar. */
  orientation?: "horizontal" | "vertical" | undefined;
  /** The divider follows the pointer while it is over the area (no press needed). @tr Ayırıcı, işaretçi alanın üzerindeyken onu izler (basmak gerekmez). */
  follow?: boolean | undefined;
  /** Sway once when first visible (default true). @tr İlk görününce bir kez sallanır (varsayılan true). */
  hint?: boolean | undefined;
  /** CSS aspect-ratio of the area, e.g. "16 / 9" (default: the layers' own height). @tr Alanın CSS aspect-ratio değeri, örneğin "16 / 9" (varsayılan: katmanların kendi yüksekliği). */
  ratio?: string | undefined;
  /** Accessible name of the handle (default "Before and after"). @tr Tutamacın erişilebilir adı (varsayılan "Before and after"). */
  label?: string | undefined;
  /** The round grip on the divider: true (default, two arrows), false (the line only), or your own node. @tr Ayırıcıdaki yuvarlak tutamak: true (varsayılan, iki ok), false (yalnız çizgi) ya da kendi düğümünüz. */
  grip?: boolean | Node | undefined;
  /** Keyboard step of the arrow keys, in percent (default 1; Shift and Page keys move 10 steps). @tr Ok tuşlarının adımı, yüzde olarak (varsayılan 1; Shift ve Page tuşları 10 adım kaydırır). */
  step?: number | undefined;
  /** The handle's value text for screen readers (default "40% before, 60% after"). @tr Ekran okuyucular için tutamacın değer metni (varsayılan "40% before, 60% after"). */
  valueText?: ((value: number) => string) | undefined;
  /** Extra CSS class on the root. @tr Köke eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
}

/** `<BeforeAfter before={<img …/>} after={<img …/>} beforeLabel="Önce" afterLabel="Sonra" />` */
export function BeforeAfter(props: BeforeAfterProps): Element {
  const pos = signal(clamp(untrack(() => val(props.value)) ?? 50, 0, 100));
  const vertical = (): boolean => props.orientation === "vertical";
  const rtl = (): boolean => !vertical() && untrack(dir) === "rtl";
  let hint: { cancel(): void } | null = null, touched = false;
  const set = (v: number, user = true): void => {
    if (user) { touched = true; hint?.cancel(); hint = null; }
    const n = Math.round(clamp(v, 0, 100) * 10) / 10;
    if (n === pos.peek()) return;
    pos.set(n);
    if (user) props.onChange?.(n);
  };
  effect(() => { const v = val(props.value); if (v != null) untrack(() => set(v, false)); });

  const handle = h("div", {
    class: "m-ba-handle", role: "slider", tabindex: "0",
    "aria-label": () => props.label ?? t`Before and after`,
    "aria-orientation": () => (vertical() ? "vertical" : "horizontal"),
    "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": () => String(Math.round(pos())),
    "aria-valuetext": () => (props.valueText ? props.valueText(Math.round(pos())) : t`${Math.round(pos())}% before, ${100 - Math.round(pos())}% after`),
    onKeyDown: (e: KeyboardEvent) => {
      const st = arrowStep(e, untrack(dir) === "rtl");
      if (!st) return;
      e.preventDefault();
      const p = pos.peek();
      set(st.home ? 0 : st.end ? 100 : p + (vertical() ? st.dy || st.dx : st.dx || -st.dy) * (props.step ?? 1));
    },
  }, props.grip === false ? null
    : props.grip && props.grip !== true ? h("span", { class: "m-ba-grip m-ba-grip-own", "aria-hidden": "true" }, props.grip)
    : h("span", { class: "m-ba-grip", "aria-hidden": "true" }, h("i"), h("i")));

  // a corner label: a Badge that fades out when the divider reaches its side
  const label = (x: unknown, side: "before" | "after"): Element | null =>
    x == null ? null : h("span", { class: () => cx("m-ba-label", `m-ba-label-${side}`, (side === "before" ? pos() < 14 : pos() > 86) && "is-hidden"), "aria-hidden": "true" }, h(Badge, {}, x));

  // a plain text layer: a filled panel with the text in the middle (a quick sketch, the raw component's look)
  const layer = (x: unknown): unknown => (typeof x === "string" || typeof x === "number" ? h("span", { class: "m-ba-text" }, x) : x);
  const root = h("div", {
    class: () => cx("m-ba", vertical() && "m-ba-vertical", props.follow && "m-ba-follow", val(props.class)),
    role: "group", "aria-label": () => props.label ?? t`Before and after`,
  },
    h("div", { class: "m-ba-layer m-ba-after" }, layer(props.after)),
    h("div", { class: "m-ba-layer m-ba-before" }, layer(props.before)),
    label(props.beforeLabel, "before"), label(props.afterLabel, "after"),
    handle) as HTMLElement;

  if (props.ratio) setStyle(root, { "aspect-ratio": props.ratio });
  effect(() => setStyle(root, { "--m-ba-pos": `${pos()}%` }));

  const at = (p: { x: number; y: number }): number => (vertical() ? p.y : p.x) * 100;
  track(root, {
    rtl, clamp: true,
    onStart: () => { root.classList.add("is-dragging"); (handle as HTMLElement).focus({ preventScroll: true }); },
    onMove: (p) => set(at(p)),
    onEnd: () => root.classList.remove("is-dragging"),
  });
  if (props.follow) {
    listen(root, {
      pointermove: (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const r = root.getBoundingClientRect();
        const x = (e.clientX - r.left) / (r.width || 1), y = (e.clientY - r.top) / (r.height || 1);
        set(vertical() ? y * 100 : (rtl() ? 1 - x : x) * 100);
      },
    });
  }

  // the first sight: a damped sway around the start position, so the divider reads as something to move
  if (props.hint !== false) {
    onVisible(root, () => {
      if (touched || reducedMotion()) return;
      const base = pos.peek();
      hint = animateValue(0, 1, { duration: 1400, easing: "linear", onUpdate: (k) => set(base + Math.sin(k * Math.PI * 2) * 14 * (1 - k), false) });
    }, { threshold: 0.5 });
  }
  owned(() => hint?.cancel());
  return root;
}
