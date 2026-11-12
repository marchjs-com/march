// GradientEditor (hadi-march/ui): build a CSS gradient. Folder: src/components/composite/gradient-editor/.
//   <GradientEditor bind:value={$bg} />      value: "linear-gradient(120deg, #f2801f 0%, #a3338c 100%)"
// Type (linear, radial, conic), an angle dial, a stop bar (click to add, drag to move, drag down or Delete to remove),
// a ColorPicker for the selected stop, presets (the HADİ gradient first) and the CSS to copy.
import "./gradient-editor.css";
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { track, arrowStep } from "../../../behaviors/drag/index.ts";
import { t, messages, dir } from "../../../core/i18n.ts";
import { cx, uid, val, clamp, setStyle, type ClassProp } from "../../../core/util.ts";
import { glyph } from "../../../ui/util.ts";
import { model, ctl, type ControlProps } from "../../../forms/util.ts";
import { Segmented } from "../../../forms/inputs.ts";
import { IconButton } from "../../../ui/button.ts";
import { ColorPicker, resolveColor } from "../color-picker/index.ts";
import { copy } from "../../../icons/glyphs/copy.ts";
import { check } from "../../../icons/glyphs/check.ts";
import * as G from "./gradient.ts";
import tr from "./tr.ts";

messages("tr", tr);

export * from "./gradient.ts";

export interface GradientPreset { label: string; value: string | readonly string[] }
export interface GradientEditorProps extends ControlProps<string> {
  /** Types offered (default linear, radial, conic). */
  types?: readonly G.GradientType[] | undefined;
  /** Preset gradients: a CSS gradient or a list of colors / theme tokens. Default: HADİ and theme gradients; false hides them. */
  presets?: readonly GradientPreset[] | false | undefined;
  /** The CSS output with a copy button (default true). */
  output?: boolean | undefined;
  class?: ClassProp;
}

const DEFAULT = "linear-gradient(120deg, #f2801f 0%, #a3338c 100%)";
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Gradient editor: `<GradientEditor bind:value={$css} />`. The value is a CSS gradient. */
export function GradientEditor(props: GradientEditorProps): unknown {
  const [get, set] = model(props, DEFAULT);
  const id = uid("hm-ge");
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const grad = signal<G.Gradient>(G.parseGradient(untrack(get) ?? DEFAULT) ?? G.parseGradient(DEFAULT)!);
  const sel = signal(0);
  const removing = signal<number | null>(null);
  const copied = signal(false);
  let root: HTMLElement | undefined;
  let last = "";
  const css = computed(() => G.gradientCss(grad()));
  // the stop handles are re-drawn only when a stop is added or removed (a drag keeps its pointer capture)
  const count = computed(() => grad().stops.length);

  effect(() => { const v = get(); if (!v || v === last) return; const g = G.parseGradient(v); if (g) { last = v; untrack(() => { grad.set(g); sel.set(Math.min(sel.peek(), g.stops.length - 1)); }); } });
  const paint = (): void => { const g = grad(); if (root) setStyle(root, { "--hm-ge-bg": css(), "--hm-ge-bar": G.gradientCss({ ...g, type: "linear", angle: 90 }), "--hm-ge-angle": `${g.angle}deg` }); };
  effect(paint);
  const update = (next: G.Gradient): void => { if (ro()) return; grad.set(next); last = G.gradientCss(next); set(last); };
  const setStop = (i: number, patch: Partial<G.GradientStop>): void => { const g = grad.peek(); update({ ...g, stops: g.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) }); };
  const removeStop = (i: number): void => {
    const g = grad.peek();
    if (g.stops.length <= 2) return;
    update({ ...g, stops: g.stops.filter((_, j) => j !== i) });
    sel.set(clamp(i, 0, g.stops.length - 2));
  };
  const addStop = (at: number): void => {
    const g = grad.peek();
    update({ ...g, stops: [...g.stops, { color: G.colorAt(g, at), at: Math.round(at) }] });
    sel.set(g.stops.length);
  };

  // ------------------------------------------------------------------ stop bar
  let bar!: HTMLElement;
  const handle = (i: number): Element => {
    const el = h("button", {
      type: "button", class: () => cx("hm-ge-stop", sel() === i && "is-selected", removing() === i && "is-removing"), role: "slider",
      "aria-label": () => t`Stop ${i + 1}: ${grad().stops[i]?.color ?? ""}`, "aria-valuemin": "0", "aria-valuemax": "100",
      "aria-valuenow": () => String(Math.round(grad().stops[i]?.at ?? 0)), "aria-valuetext": () => `${Math.round(grad().stops[i]?.at ?? 0)}%`,
      tabindex: () => (sel() === i ? "0" : "-1"), disabled: ro,
      onFocus: () => sel.set(i),
      onKeyDown: (e: KeyboardEvent) => {
        if ((e.key === "Delete" || e.key === "Backspace") && !ro()) { e.preventDefault(); removeStop(i); focusStop(sel.peek()); return; }
        if (e.key === "Tab") return;
        const st = arrowStep(e);
        if (!st || ro()) return;
        e.preventDefault();
        const at = grad.peek().stops[i]!.at;
        setStop(i, { at: st.home ? 0 : st.end ? 100 : clamp(at + (st.dx || -st.dy), 0, 100) });
      },
    }) as HTMLElement;
    effect(() => { const s = grad().stops[i]; if (s) setStyle(el, { "--hm-ge-at": `${s.at}%`, "--hm-ge-c": resolveColor(s.color, root) }); });
    track(el, {
      area: () => bar, onStart: () => { if (ro()) return false; sel.set(i); },
      onMove: (p) => { setStop(i, { at: Math.round(p.x * 1000) / 10 }); removing.set(Math.abs(p.dy) > 40 && grad.peek().stops.length > 2 ? i : null); },
      onEnd: () => { if (removing.peek() === i) { removing.set(null); removeStop(i); } },
    });
    return el;
  };
  const focusStop = (i: number): void => { queueMicrotask(() => bar?.querySelectorAll<HTMLElement>(".hm-ge-stop")[i]?.focus()); };
  bar = h("div", {
    class: "hm-ge-bar", "aria-label": () => t`Color stops`, role: "group",
    onPointerDown: (e: PointerEvent) => {
      if (ro() || (e.target as Element).closest(".hm-ge-stop")) return;
      const r = bar.getBoundingClientRect();
      addStop(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100));
      focusStop(grad.peek().stops.length - 1);
    },
  }, () => { const n = count(); return untrack(() => Array.from({ length: n }, (_, i) => handle(i))); }) as HTMLElement;

  // ------------------------------------------------------------------ angle dial
  const dial = h("div", { class: "hm-ge-dial" },
    h("div", {
      class: "hm-ge-dial-knob", role: "slider", tabindex: () => (props.disabled ? "-1" : "0"), "aria-label": () => t`Angle`,
      "aria-valuemin": "0", "aria-valuemax": "359", "aria-valuenow": () => String(Math.round(grad().angle)), "aria-valuetext": () => t`${Math.round(grad().angle)} degrees`,
      onKeyDown: (e: KeyboardEvent) => {
        const st = arrowStep(e, untrack(dir) === "rtl");
        if (!st || ro()) return;
        e.preventDefault();
        const g = grad.peek();
        update({ ...g, angle: st.home ? 0 : st.end ? 270 : (((g.angle + (st.dx || -st.dy)) % 360) + 360) % 360 });
      },
    }, h("span", { class: "hm-ge-dial-hand", "aria-hidden": "true" })),
    h("span", { class: "hm-ge-dial-value", "aria-hidden": "true" }, () => `${Math.round(grad().angle)}°`)) as HTMLElement;
  track(dial, {
    clamp: false, onStart: () => !ro(),
    onMove: (p) => {
      const a = (Math.atan2(p.py - p.rect.height / 2, p.px - p.rect.width / 2) * 180) / Math.PI + 90;
      const snap = p.event.shiftKey ? 15 : 1;
      update({ ...grad.peek(), angle: ((Math.round(a / snap) * snap) % 360 + 360) % 360 });
      (dial.firstChild as HTMLElement).focus({ preventScroll: true });
    },
  });

  // ------------------------------------------------------------------ presets and output
  const presets = (): readonly GradientPreset[] => (props.presets === false ? [] : props.presets ?? [
    { label: t`HADİ`, value: ["brand-orange", "brand-blue", "brand-green", "brand-purple"] },
    { label: t`Excitement`, value: ["brand-orange", "brand-purple"] },
    { label: t`Activity`, value: ["brand-blue", "brand-green"] },
    { label: t`Theme palette`, value: ["cat-1", "cat-3", "cat-5"] },
  ]);
  const presetCss = (p: GradientPreset): string => {
    if (typeof p.value === "string") return p.value;
    const list = p.value as readonly string[];
    return G.gradientCss({ type: grad.peek().type, angle: grad.peek().angle, stops: list.map((col, i) => ({ color: resolveColor(col, root), at: (i * 100) / Math.max(1, list.length - 1) })) });
  };
  const presetButton = (p: GradientPreset): Element => {
    const b = h("button", { type: "button", class: "hm-ge-preset", "aria-label": () => t`Preset: ${p.label}`, title: p.label, disabled: ro, onClick: () => { const g = G.parseGradient(presetCss(p)); if (g) { update(g); sel.set(0); } } }) as HTMLElement;
    queueMicrotask(() => setStyle(b, { "--hm-ge-p": presetCss(p) }));
    return b;
  };
  const copyCss = async (): Promise<void> => {
    try { await globalThis.navigator?.clipboard?.writeText(`background: ${css.peek()};`); copied.set(true); setTimeout(() => copied.set(false), 1600); } catch { /* not allowed */ }
  };

  const types = (): readonly G.GradientType[] => props.types?.length ? props.types : ["linear", "radial", "conic"];
  const TYPE_LABEL: Record<G.GradientType, () => string> = { linear: () => t`Linear`, radial: () => t`Radial`, conic: () => t`Conic` };
  return h("div", { class: () => cx("hm-ge", ro() && "is-readonly", val(props.class)), role: "group", "aria-label": () => c["aria-label"]() ?? t`Gradient editor`, ref: (el: HTMLElement) => { root = el; untrack(paint); } },
    h("div", { class: "hm-ge-preview", role: "img", "aria-label": () => t`Gradient preview: ${css()}` }),
    h("div", { class: "hm-ge-row" },
      () => (types().length > 1 ? h(Segmented, { class: "hm-ge-types", "aria-label": t`Gradient type`, options: types().map((x) => ({ value: x, label: TYPE_LABEL[x]() })), value: grad.peek().type, onChange: (x: G.GradientType | null) => { if (x) update({ ...grad.peek(), type: x }); } }) : null),
      () => (grad().type === "radial" ? null : h("div", { class: "hm-ge-angle" },
        dial,
        h("div", { class: "hm-ge-angles", role: "group", "aria-label": () => t`Quick angles` }, ANGLES.map((a) => h("button", {
          type: "button", class: () => cx("hm-ge-angle-btn", Math.round(grad().angle) === a && "is-on"), "aria-label": t`${a} degrees`, disabled: ro,
          style: { "--hm-ge-a": `${a}deg` }, onClick: () => update({ ...grad.peek(), angle: a }),
        }, h("span", { "aria-hidden": "true" })))))),
    ),
    h("div", { class: "hm-ge-stops" }, bar, h("p", { class: "hm-ge-hint" }, () => t`Click the bar to add a stop; drag a stop down or press Delete to remove it.`)),
    () => {
      const i = sel(), s = untrack(() => grad().stops[i]);
      if (!s) return null;
      return h("div", { class: "hm-ge-stop-editor", role: "group", "aria-label": t`Stop ${i + 1}` },
        h(ColorPicker, { value: untrack(() => resolveColor(s.color, root)), onChange: (v: string) => setStop(i, { color: v }), palettes: undefined, contrast: false, disabled: props.disabled, readonly: props.readonly, class: "hm-ge-picker" }),
        h("label", { class: "hm-ge-pos" }, h("span", null, () => t`Position`),
          h("input", { type: "number", class: "hm-input hm-ge-pos-input", min: "0", max: "100", step: "1", value: () => String(Math.round(grad().stops[i]?.at ?? 0)), readonly: () => !!props.readonly, onInput: (e: Event) => { const n = Number((e.target as HTMLInputElement).value); if (Number.isFinite(n)) setStop(i, { at: clamp(n, 0, 100) }); } }), "%"));
    },
    () => (presets().length ? h("div", { class: "hm-ge-presets", role: "group", "aria-label": () => t`Presets` }, presets().map(presetButton)) : null),
    () => (props.output === false ? null : h("div", { class: "hm-ge-output" },
      h("code", { class: "hm-ge-css", id: `${id}-css` }, () => `background: ${css()};`),
      h(IconButton, { children: () => glyph(copied() ? check : copy), label: () => (copied() ? t`Copied` : t`Copy CSS`), size: "sm", class: () => cx("hm-ge-copy", copied() && "is-done"), onClick: copyCss }))));
}
