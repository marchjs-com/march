// GradientEditor (march/ui): build a CSS gradient. Folder: src/components/composite/gradient-editor/.
//   <GradientEditor bind:value={$bg} />      value: "linear-gradient(120deg, #f2801f 0%, #a3338c 100%)"
// Type (linear, radial, conic), an angle dial, a stop bar (click to add, drag to move, drag down or Delete to remove),
// a ColorPicker for the selected stop, presets (the HADİ gradient first) and the CSS to copy.
import "./gradient-editor.css";
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { track, arrowStep } from "../../../behaviors/drag/index.ts";
import { t, messages, dir } from "../../../core/i18n.ts";
import { cx, uid, val, clamp, setStyle, type ClassProp } from "../../../core/util.ts";
import { model, ctl, live, type ControlProps } from "../../../forms/util.ts";
import { Segmented } from "../../../forms/inputs.ts";
import { Field } from "../../../forms/field.ts";
import { IconButton } from "../../../ui/button.ts";
import { CopyButton } from "../../actions/copy-button/index.ts";
import { Card } from "../../data/card/index.ts";
import { NumberInput } from "../../forms/number-input/index.ts";
import { Swatch, CHECKER } from "../../forms/swatch/index.ts";
import { Stack } from "../../layout/stack/index.ts";
import { ColorPicker, resolveColor } from "../color-picker/index.ts";
import * as G from "./gradient.ts";
import tr from "./tr.ts";

messages("tr", tr);

export * from "./gradient.ts";

export interface GradientPreset { label: string; value: string | readonly string[] }
export interface GradientEditorProps extends ControlProps<string> {
  /** Types offered (default linear, radial, conic). @tr Sunulan türler (varsayılan linear, radial, conic). */
  types?: readonly G.GradientType[] | undefined;
  /** Preset gradients: a CSS gradient or a list of colors / theme tokens. Default: HADİ and theme gradients; false hides them. @tr Hazır gradyanlar: bir CSS gradyanı ya da renk / tema token listesi. Varsayılan: HADİ ve tema gradyanları; false gizler. */
  presets?: readonly GradientPreset[] | false | undefined;
  /** The CSS output with a copy button (default true). @tr Kopyala düğmeli CSS çıktısı (varsayılan true). */
  output?: boolean | undefined;
  /** The large preview on top (default true). @tr Üstteki büyük önizleme (varsayılan true). */
  preview?: boolean | undefined;
  /** The angle dial (default true). @tr Açı kadranı (varsayılan true). */
  dial?: boolean | undefined;
  /** Quick angle buttons: default 0 to 315 in steps of 45; your own list; false hides them. @tr Hızlı açı düğmeleri: varsayılan 45'lik adımlarla 0'dan 315'e; kendi listen; false gizler. */
  angles?: readonly number[] | false | undefined;
  /** The hint under the stop bar (default true). @tr Durak çubuğunun altındaki ipucu (varsayılan true). */
  hint?: boolean | undefined;
  /** The position field beside the color picker of the selected stop (default true). @tr Seçili durağın renk seçicisinin yanındaki konum alanı (varsayılan true). */
  position?: boolean | undefined;
  /**
   * Own texts; each falls back to the built-in one: `editor`, `preview(css)`, `type`, `linear`, `radial`, `conic`,
   * `angle`, `degrees(n)`, `quickAngles`, `stops`, `stop(number, color)`, `hint`, `position`, `presets`,
   * `preset(name)`, `copy`, `copied`.
   * @tr Kendi metinlerin; her biri yerleşik olana döner: `editor`, `preview(css)`, `type`, `linear`, `radial`, `conic`, `angle`, `degrees(n)`, `quickAngles`, `stops`, `stop(number, color)`, `hint`, `position`, `presets`, `preset(name)`, `copy`, `copied`.
   */
  labels?: {
    editor?: string; type?: string; linear?: string; radial?: string; conic?: string; angle?: string; quickAngles?: string;
    stops?: string; hint?: string; position?: string; presets?: string; copy?: string; copied?: string;
    preview?: ((css: string) => string) | undefined; degrees?: ((angle: number) => string) | undefined;
    stop?: ((number: number, color: string) => string) | undefined; preset?: ((name: string) => string) | undefined;
  } | undefined;
  /** Extra classes on the editor's card. @tr Düzenleyicinin kartına eklenen ek sınıflar. */
  class?: ClassProp;
}

const DEFAULT = "linear-gradient(120deg, #f2801f 0%, #a3338c 100%)";
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Gradient editor: `<GradientEditor bind:value={$css} />`. The value is a CSS gradient. */
export function GradientEditor(props: GradientEditorProps): unknown {
  const [get, set] = model(props, DEFAULT);
  const id = uid("m-ge");
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const L = (): NonNullable<GradientEditorProps["labels"]> => props.labels ?? {};
  const degrees = (a: number): string => L().degrees?.(a) ?? t`${a} degrees`;
  const grad = signal<G.Gradient>(G.parseGradient(untrack(get) ?? DEFAULT) ?? G.parseGradient(DEFAULT)!);
  const sel = signal(0);
  const removing = signal<number | null>(null);
  let root: HTMLElement | undefined;
  let last = "";
  const css = computed(() => G.gradientCss(grad()));
  // the stop handles are re-drawn only when a stop is added or removed (a drag keeps its pointer capture)
  const count = computed(() => grad().stops.length);
  // bumped when the whole gradient is replaced (a new value from outside, a preset): the stop's color picker, which is
  // not redrawn while its own stop is edited, is drawn again with the new color
  const replaced = signal(0);

  effect(() => { const v = get(); if (!v || v === last) return; const g = G.parseGradient(v); if (g) { last = v; untrack(() => { grad.set(g); sel.set(Math.min(sel.peek(), g.stops.length - 1)); replaced.set(replaced.peek() + 1); }); } });
  const paint = (): void => { const g = grad(); if (root) setStyle(root, { "--m-ge-bg": css(), "--m-ge-bar": G.gradientCss({ ...g, type: "linear", angle: 90 }), "--m-ge-angle": `${g.angle}deg` }); };
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
      type: "button", class: () => cx("m-ge-stop", sel() === i && "is-selected", removing() === i && "is-removing"), role: "slider",
      "aria-label": () => L().stop?.(i + 1, grad().stops[i]?.color ?? "") ?? t`Stop ${i + 1}: ${grad().stops[i]?.color ?? ""}`, "aria-valuemin": "0", "aria-valuemax": "100",
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
    effect(() => { const s = grad().stops[i]; if (s) setStyle(el, { "--m-ge-at": `${s.at}%`, "--m-ge-c": resolveColor(s.color, root) }); });
    track(el, {
      area: () => bar, onStart: () => { if (ro()) return false; sel.set(i); },
      onMove: (p) => { setStop(i, { at: Math.round(p.x * 1000) / 10 }); removing.set(Math.abs(p.dy) > 40 && grad.peek().stops.length > 2 ? i : null); },
      onEnd: () => { if (removing.peek() === i) { removing.set(null); removeStop(i); } },
    });
    return el;
  };
  const focusStop = (i: number): void => { queueMicrotask(() => bar?.querySelectorAll<HTMLElement>(".m-ge-stop")[i]?.focus()); };
  bar = h("div", {
    class: cx("m-ge-bar", CHECKER), "aria-label": () => L().stops ?? t`Color stops`, role: "group",
    onPointerDown: (e: PointerEvent) => {
      if (ro() || (e.target as Element).closest(".m-ge-stop")) return;
      const r = bar.getBoundingClientRect();
      addStop(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100));
      focusStop(grad.peek().stops.length - 1);
    },
  }, () => { const n = count(); return untrack(() => Array.from({ length: n }, (_, i) => handle(i))); }) as HTMLElement;

  // ------------------------------------------------------------------ angle dial
  const dial = h("div", { class: "m-ge-dial" },
    h("div", {
      class: "m-ge-dial-knob", role: "slider", tabindex: () => (props.disabled ? "-1" : "0"), "aria-label": () => L().angle ?? t`Angle`,
      "aria-valuemin": "0", "aria-valuemax": "359", "aria-valuenow": () => String(Math.round(grad().angle)), "aria-valuetext": () => degrees(Math.round(grad().angle)),
      onKeyDown: (e: KeyboardEvent) => {
        const st = arrowStep(e, untrack(dir) === "rtl");
        if (!st || ro()) return;
        e.preventDefault();
        const g = grad.peek();
        update({ ...g, angle: st.home ? 0 : st.end ? 270 : (((g.angle + (st.dx || -st.dy)) % 360) + 360) % 360 });
      },
    }, h("span", { class: "m-ge-dial-hand", "aria-hidden": "true" })),
    h("span", { class: "m-ge-dial-value", "aria-hidden": "true" }, () => `${Math.round(grad().angle)}°`)) as HTMLElement;
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
    // theme tokens resolve against the editor's own element: painted once it is in place
    const fill = signal<string | null>(null);
    queueMicrotask(() => fill.set(presetCss(p)));
    return h(Swatch, { class: "m-ge-preset", color: fill, label: () => L().preset?.(p.label) ?? t`Preset: ${p.label}`, title: p.label, disabled: ro, onClick: () => { const g = G.parseGradient(presetCss(p)); if (g) { update(g); sel.set(0); replaced.set(replaced.peek() + 1); } } }) as Element;
  };

  const types = (): readonly G.GradientType[] => props.types?.length ? props.types : ["linear", "radial", "conic"];
  const TYPE_LABEL: Record<G.GradientType, () => string> = { linear: () => L().linear ?? t`Linear`, radial: () => L().radial ?? t`Radial`, conic: () => L().conic ?? t`Conic` };
  const angles = (): readonly number[] => (props.angles === false ? [] : props.angles ?? ANGLES);
  return h(Card, { as: "div", class: () => cx("m-ge", ro() && "is-readonly", val(props.class)), role: "group", "aria-label": () => c["aria-label"]() ?? L().editor ?? t`Gradient editor`, ref: (el: HTMLElement) => { root = el; untrack(paint); } },
    () => (props.preview === false ? null : h("div", { class: cx("m-ge-preview", CHECKER), role: "img", "aria-label": () => L().preview?.(css()) ?? t`Gradient preview: ${css()}` })),
    h(Stack, { class: "m-ge-row", direction: "row", wrap: true, align: "center", justify: "between", gap: 3 },
      () => (types().length > 1 ? h(Segmented, { class: "m-ge-types", "aria-label": L().type ?? t`Gradient type`, options: types().map((x) => ({ value: x, label: TYPE_LABEL[x]() })), value: live(() => grad().type), onChange: (x: G.GradientType | null) => { if (x) update({ ...grad.peek(), type: x }); } }) : null),
      () => (grad().type === "radial" || (props.dial === false && !angles().length) ? null : h("div", { class: "m-ge-angle" },
        props.dial === false ? null : dial,
        angles().length ? h("div", { class: "m-ge-angles", role: "group", "aria-label": () => L().quickAngles ?? t`Quick angles` }, angles().map((a) => h(IconButton, {
          class: "m-ge-angle-btn", size: "xs", label: () => degrees(a), pressed: () => Math.round(grad().angle) === a, disabled: ro,
          style: { "--m-ge-a": `${a}deg` }, onClick: () => update({ ...grad.peek(), angle: a }),
          icon: h("span", { class: "m-ge-angle-hand", "aria-hidden": "true" }),
        }))) : null)),
    ),
    h("div", { class: "m-ge-stops" }, bar, () => (props.hint === false ? null : h("p", { class: "m-ge-hint" }, () => L().hint ?? t`Click the bar to add a stop; drag a stop down or press Delete to remove it.`))),
    () => {
      replaced();
      const i = sel(), s = untrack(() => grad().stops[i]);
      if (!s) return null;
      return h("div", { class: "m-ge-stop-editor", role: "group", "aria-label": L().stop?.(i + 1, s.color) ?? t`Stop ${i + 1}` },
        h(ColorPicker, { value: untrack(() => resolveColor(s.color, root)), onChange: (v: string) => setStop(i, { color: v }), palettes: undefined, contrast: false, disabled: live(() => props.disabled), readonly: live(() => props.readonly), class: "m-ge-picker" }),
        props.position === false ? null : h(Field, { id: `${id}-pos`, inline: true, compact: true, class: "m-ge-pos", label: () => L().position ?? t`Position` },
          h(NumberInput, { id: `${id}-pos`, class: "m-ge-pos-input", min: 0, max: 100, step: 1, suffix: "%", value: live(() => Math.round(grad().stops[i]?.at ?? 0)), readonly: live(() => !!props.readonly), disabled: live(() => !!props.disabled), onChange: (n: number | null) => { if (n != null) setStop(i, { at: clamp(n, 0, 100) }); } })));
    },
    () => (presets().length ? h("div", { class: "m-ge-presets", role: "group", "aria-label": () => L().presets ?? t`Presets` }, presets().map(presetButton)) : null),
    () => (props.output === false ? null : h("div", { class: "m-ge-output" },
      h("code", { class: "m-ge-css", id: `${id}-css` }, () => `background: ${css()};`),
      h(CopyButton, { iconOnly: true, class: "m-ge-copy m-btn-sm", text: () => `background: ${css()};`, label: () => L().copy ?? t`Copy CSS`, copiedLabel: () => L().copied ?? t`Copied` }))));
}
