// Segmented: a compact single choice of joined buttons; arrow keys move and select.
import "./segmented.css";
import { effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { roving } from "../../../ui/focus.ts";
import { icon, setStyle } from "../../../ui/util.ts";
import { observeSize } from "../../../ui/observe.ts";
import { slidingIndicator } from "../../../motion/engine/parts.ts";
import { model, ctl, cx, normOptions, same, labelledBy, useField, type ControlProps, type OptionsProp } from "../../../forms/util.ts";
import { colorAttr } from "../../../theme/colors.ts";
import type { IconProp } from "../../../icons/types.ts";

/** An option of Segmented (a bare value works too). */
export interface SegmentedOption {
  value: unknown;
  /** Text of the segment (default: the value). `""` with an `icon`: an icon-only segment named by `title`. */
  label?: string | undefined;
  /** An icon before the text (an icon definition, a short text or a node). */
  icon?: IconProp;
  /** Tooltip (e.g. why the option is disabled); the accessible name of an icon-only segment. */
  title?: string | undefined;
  disabled?: boolean | undefined;
}

export interface SegmentedProps<T = unknown> extends ControlProps<T | null> {
  /** `[value]` or `[{ value, label, icon, title, disabled }]` (see SegmentedOption); may be a function. @tr `[value]` ya da `[{ value, label, icon, title, disabled }]` (bkz. SegmentedOption); fonksiyon da olabilir. */
  options?: OptionsProp;
  /** How the chosen segment is marked: "fill" (default: it is raised in place) or "slide" (one thumb glides to it). @tr Seçili parçanın işareti: "fill" (varsayılan: yerinde kabarır) ya da "slide" (tek bir başparmak ona kayar). */
  indicator?: "fill" | "slide" | undefined;
}

/** Segmented control (a compact single choice). Arrow keys move and select. */
export function Segmented<T = unknown>(props: SegmentedProps<T>): unknown {
  const [get, set] = model<T | null>(props, null);
  const field = useField();
  const baseId = props.id ?? field?.id;
  const c = ctl(props);
  const slide = props.indicator === "slide";
  const thumb = slide ? h("span", { class: "m-segment-thumb", "aria-hidden": "true" }) as HTMLElement : null;
  let root: HTMLElement;
  const onKeyDown = (e: KeyboardEvent) => { const target = roving(e, [...root.querySelectorAll("button")].filter((b) => !b.disabled), { horizontal: true }); if (target) target.click(); };
  root = h("div", { role: "radiogroup", class: cx("m-segmented", slide && "m-segmented-slide", props.class), "aria-labelledby": labelledBy(props), "aria-label": c["aria-label"], "aria-invalid": c["aria-invalid"], onKeyDown },
    thumb,
    () => {
      const opts = normOptions(props.options);
      return opts.map((o, i) => h("button", {
        type: "button", role: "radio", class: cx("m-segment", o["icon"] != null && "m-segment-has-icon"), id: i === 0 ? baseId : undefined, onBlur: props.onBlur,
        title: (o["title"] as string | undefined) ?? null, "aria-label": o.label === "" ? (o["title"] as string | undefined) ?? null : null,
        "aria-checked": () => String(same(get(), o.value)),
        tabindex: () => (same(get(), o.value) || (i === 0 && !opts.some((x) => same(x.value, get()))) ? "0" : "-1"),
        disabled: () => !!(props.disabled || props.readonly || o.disabled), onClick: () => set(o.value as T),
      }, icon(o["icon"], "m-segment-icon"), o.label));
    }) as HTMLElement;
  if (thumb) {
    // the shared sliding indicator glides the thumb along the row; its line (segments may wrap) and height are set here
    const ind = slidingIndicator(thumb, root);
    const place = (move: boolean): void => {
      const on = root.querySelector<HTMLElement>('[aria-checked="true"]');
      if (on) setStyle(thumb, { top: `${on.offsetTop}px`, height: `${on.offsetHeight}px` });
      ind.moveTo(on, !move);
    };
    effect(() => { get(); normOptions(props.options); queueMicrotask(() => place(true)); });
    observeSize(root, () => place(false));
  }
  return root;
}
