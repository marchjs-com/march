// ColorPicker (march/ui): saturation / brightness area, hue and alpha sliders, eyedropper, palettes (HADİ colors,
// the theme's palette, recent picks), text input in hex / rgb / hsl, contrast check. Folder: src/components/composite/color-picker/.
//   <ColorPicker bind:value={$color} alpha format="hex" />
import "./color-picker.css";
import { signal, computed, effect, untrack, batch } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { track, arrowStep } from "../../../behaviors/drag/index.ts";
import { BRAND_COLORS } from "../../../theme/colors.ts";
import { t, messages, dir } from "../../../core/i18n.ts";
import { cx, uid, val, clamp, setStyle, type ClassProp } from "../../../core/util.ts";
import { model, ctl, live, type ControlProps } from "../../../forms/util.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Badge } from "../../data/badge/index.ts";
import { Segmented } from "../../forms/segmented/index.ts";
import { Slider } from "../../forms/slider/index.ts";
import { Swatch, CHECKER } from "../../forms/swatch/index.ts";
import { TextInput } from "../../forms/text-input/index.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";
import { pipette } from "../../../icons/glyphs/pipette.ts";
import * as C from "./color.ts";
import tr from "./tr.ts";

messages("tr", tr);

export * from "./color.ts";

/** A palette: a name and colors (CSS colors or theme tokens such as "brand-orange"). */
export interface ColorPalette { label: string; colors: readonly string[] }

/** The texts ColorPicker writes itself; every one is optional (default: the built-in text). */
export interface ColorPickerLabels {
  picker?: string; area?: string; hue?: string; opacity?: string; eyedropper?: string; value?: string; format?: string;
  contrast?: string; onWhite?: string; onBlack?: string; hadiColors?: string; theme?: string; recent?: string;
}

export interface ColorPickerProps extends ControlProps<string> {
  /** Alpha slider and alpha in the value (default true). @tr Saydamlık kaydırıcısı ve değerde saydamlık (varsayılan true). */
  alpha?: boolean | undefined;
  /** Text format of the value (default "hex"); the switcher changes it. @tr Değerin metin biçimi (varsayılan "hex"); biçim seçici bunu değiştirir. */
  format?: C.ColorFormat | undefined;
  /** Palettes under the picker. Default: HADİ colors, the theme palette and recent picks. @tr Seçicinin altındaki paletler. Varsayılan: HADİ renkleri, tema paleti ve son seçilenler. */
  palettes?: readonly ColorPalette[] | false | undefined;
  /** Recent picks kept (default 8; 0 hides them). @tr Tutulan son seçim sayısı (varsayılan 8; 0 gizler). */
  recent?: number | undefined;
  /** Eyedropper button where the browser has one (default true). @tr Tarayıcıda varsa damlalık düğmesi (varsayılan true). */
  eyedropper?: boolean | undefined;
  /** Contrast against white and black (default true). @tr Beyaza ve siyaha karşı kontrast (varsayılan true). */
  contrast?: boolean | undefined;
  /** The old / new preview next to the sliders (default true). @tr Kaydırıcıların yanında eski / yeni önizleme (varsayılan true). */
  preview?: boolean | undefined;
  /** The HEX / RGB / HSL switcher (default true). @tr HEX / RGB / HSL seçici (varsayılan true). */
  formats?: boolean | undefined;
  /** The text field with the value (default true). @tr Değeri gösteren metin alanı (varsayılan true). */
  input?: boolean | undefined;
  /** Own eyedropper icon (an icon of march/icons, text or a node). @tr Kendi damlalık ikonun (march/icons ikonu, metin ya da düğüm). */
  eyedropperIcon?: unknown;
  /** Own texts: names of the sliders, the buttons and the default palettes. @tr Kendi metinlerin: kaydırıcıların, düğmelerin ve varsayılan paletlerin adları. */
  labels?: ColorPickerLabels | undefined;
  /** Extra classes on the root. @tr Köke eklenen sınıflar. */
  class?: ClassProp;
}

const THEME = ["primary", "cat-5", "cat-6", "cat-7", "cat-8", "success", "warn", "danger", "info", "neutral"];
const WHITE: C.Rgba = { r: 255, g: 255, b: 255, a: 1 }, BLACK: C.Rgba = { r: 0, g: 0, b: 0, a: 1 };
type EyeDropperCtor = new () => { open(): Promise<{ sRGBHex: string }> };

/** Color picker: `<ColorPicker bind:value={$c} />`. The value is a CSS color string in the chosen format. */
export function ColorPicker(props: ColorPickerProps): unknown {
  const [get, set] = model(props, "#f2801f");
  const id = uid("m-cp");
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const L = (): ColorPickerLabels => props.labels ?? {};
  const useAlpha = (): boolean => props.alpha !== false;
  const fmt = signal<C.ColorFormat>(untrack(() => props.format ?? "hex"));
  const hsva = signal<C.Hsva>({ h: 24, s: 0.87, v: 0.95, a: 1 });
  const original = signal<string>(untrack(get) ?? "");
  const recent = signal<string[]>([]);
  const draft = signal<string | null>(null);
  let root: HTMLElement | undefined;
  let last = "";

  const rgba = computed(() => C.hsvToRgb(hsva()));
  const css = computed(() => C.format(rgba(), "rgb"));
  const out = (x: C.Hsva = hsva.peek()): string => C.format(C.hsvToRgb(useAlpha() ? x : { ...x, a: 1 }), fmt.peek(), x.h);

  // value → model (keeps the hue of greys and the last hue while s or v is 0)
  effect(() => {
    const v = get();
    if (v === last || !v) return;
    const p = C.parse(v);
    if (!p) return;
    last = v;
    untrack(() => hsva.set(C.rgbToHsv(p, hsva.peek().h)));
  });
  // model → CSS variables (CSSOM); also run when the root is attached
  const paint = (): void => {
    const x = hsva(), col = rgba();
    if (root) setStyle(root, { "--m-cp-hue": `hsl(${x.h} 100% 50%)`, "--m-cp-color": css(), "--m-cp-solid": `rgb(${col.r} ${col.g} ${col.b})`, "--m-cp-x": `${x.s * 100}%`, "--m-cp-y": `${(1 - x.v) * 100}%` });
  };
  effect(paint);
  const commit = (next: C.Hsva): void => {
    if (ro()) return;
    batch(() => { hsva.set(next); draft.set(null); });
    last = out(next);
    set(last);
  };
  const remember = (): void => {
    const n = props.recent ?? 8;
    if (!n) return;
    const v = out();
    recent.set([v, ...recent.peek().filter((x) => x !== v)].slice(0, n));
  };
  const pick = (color: string): void => {
    const p = C.parse(color);
    if (!p) return;
    commit(C.rgbToHsv(p, hsva.peek().h));
    remember();
  };
  const rtl = (): boolean => untrack(dir) === "rtl";

  // ------------------------------------------------------------------ area, hue, alpha
  const area = h("div", { class: "m-cp-area" },
    h("div", {
      class: "m-cp-thumb m-cp-area-thumb", role: "slider", tabindex: () => (props.disabled ? "-1" : "0"), "aria-label": () => L().area ?? t`Saturation and brightness`,
      "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": () => String(Math.round(hsva().s * 100)),
      "aria-valuetext": () => t`Saturation ${Math.round(hsva().s * 100)}%, brightness ${Math.round(hsva().v * 100)}%`,
      "aria-disabled": () => (ro() ? "true" : null),
      onKeyDown: (e: KeyboardEvent) => {
        const st = arrowStep(e, rtl());
        if (!st || ro()) return;
        e.preventDefault();
        const x = hsva.peek();
        commit({ ...x, s: clamp(x.s + st.dx / 100, 0, 1), v: st.home ? 1 : st.end ? 0 : clamp(x.v - st.dy / 100, 0, 1) });
      },
    })) as HTMLElement;
  track(area, { rtl, onStart: () => !ro(), onMove: (p) => { commit({ ...hsva.peek(), s: p.x, v: 1 - p.y }); (area.firstChild as HTMLElement).focus({ preventScroll: true }); }, onEnd: remember });

  // hue and opacity: Sliders over their own track (the hue circle; the color over the checkerboard)
  const slider = (kind: "hue" | "alpha"): unknown => {
    const isHue = kind === "hue";
    return h(Slider, {
      id: `${id}-${kind}`, class: `m-cp-slider m-cp-slider-${kind}`, track: isHue ? "m-cp-hue" : `m-cp-alpha ${CHECKER}`, showValue: false, max: isHue ? 360 : 100,
      value: live(() => Math.round(isHue ? hsva().h : hsva().a * 100)),
      onChange: (v: number) => { const x = hsva.peek(); commit(isHue ? { ...x, h: Math.min(359.9, v) } : { ...x, a: v / 100 }); },
      onCommit: remember,
      "aria-label": live(() => (isHue ? L().hue ?? t`Hue` : L().opacity ?? t`Opacity`)),
      valueText: (v: number) => (isHue ? t`${v} degrees` : `${v}%`),
      disabled: live(() => !!props.disabled), readonly: live(() => !!props.readonly),
    });
  };

  // ------------------------------------------------------------------ eyedropper, preview, text
  const Dropper = (globalThis as { EyeDropper?: EyeDropperCtor }).EyeDropper;
  const dropper = (): unknown => (props.eyedropper === false || !Dropper ? null : h(IconButton, {
    icon: props.eyedropperIcon ?? pipette, label: () => L().eyedropper ?? t`Pick a color from the screen`, size: "sm", class: "m-cp-dropper", disabled: ro,
    onClick: async () => { try { const r = await new Dropper().open(); pick(r.sRGBHex); } catch { /* cancelled */ } },
  }));
  const preview = h("div", { class: `m-cp-preview ${CHECKER}`, role: "img", "aria-label": () => t`New color ${out()}, was ${original() || "—"}` },
    h("button", { type: "button", class: "m-cp-preview-old", tabindex: "-1", "aria-hidden": "true", title: () => t`Back to ${original()}`, onClick: () => { if (original.peek()) pick(original.peek()); } }),
    h("span", { class: "m-cp-preview-new" }));
  effect(() => { const o = C.parse(original()); const el = preview.firstChild as HTMLElement; if (o) setStyle(el, { "--m-cp-old": C.format(o, "rgb") }); });

  const bad = (): boolean => draft() != null && !C.parse(draft()!);
  const text = h(TextInput, {
    id: props.id, name: props.name, class: "m-cp-text", spellcheck: "false", autocomplete: "off",
    "aria-label": live(() => c["aria-label"]() ?? L().value ?? t`Color value`),
    value: live(() => draft() ?? (fmt(), out({ ...hsva() }))), readonly: live(() => !!props.readonly), disabled: live(() => !!props.disabled), required: live(() => !!props.required),
    invalid: live(() => (bad() ? true : props.invalid)),
    onChange: (v: string) => { draft.set(v); const p = C.parse(v); if (p) { last = v; hsva.set(C.rgbToHsv(p, hsva.peek().h)); set(out()); } },
    onBlur: (e: FocusEvent) => { if (draft.peek() != null) { draft.set(null); remember(); } props.onBlur?.(e); },
    onFocus: props.onFocus,
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter") { draft.set(null); remember(); } },
  });
  const formats = h(Segmented, {
    class: "m-cp-formats", "aria-label": L().format ?? t`Color format`,
    options: [{ value: "hex", label: "HEX" }, { value: "rgb", label: "RGB" }, { value: "hsl", label: "HSL" }],
    value: fmt.peek(), onChange: (f: C.ColorFormat | null) => { if (!f) return; fmt.set(f); if (!ro()) { last = out(); set(last); } },
  });

  // ------------------------------------------------------------------ palettes and contrast
  const resolve = (token: string): string => C.resolveColor(token, root);
  const palettes = (): readonly ColorPalette[] => {
    if (props.palettes === false) return [];
    const own = props.palettes ?? [{ label: L().hadiColors ?? t`HADİ colors`, colors: BRAND_COLORS }, { label: L().theme ?? t`Theme`, colors: THEME }];
    const r = recent();
    return r.length && (props.recent ?? 8) ? [...own, { label: L().recent ?? t`Recent`, colors: r }] : own;
  };
  const swatch = (color: string, label: string): Element =>
    h(Swatch, { class: "m-cp-swatch", color, label, selected: () => same(color), disabled: ro, onClick: () => pick(resolve(color)) }) as Element;
  const same = (color: string): boolean => { const a = C.parse(resolve(color)), b = rgba(); return !!a && Math.abs(a.r - b.r) < 1.5 && Math.abs(a.g - b.g) < 1.5 && Math.abs(a.b - b.b) < 1.5 && Math.abs(a.a - b.a) < 0.02; };
  const contrastRow = (): unknown => {
    if (props.contrast === false) return null;
    // a Badge per ground: the color written on a white / black Swatch, the ratio and its WCAG grade
    const on = (bg: C.Rgba, name: () => string): unknown => {
      const r = C.contrastOf(rgba(), bg), grade = r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA+" : "—";
      return h(Badge, {
        class: cx("m-cp-contrast", r >= 4.5 ? "is-pass" : r >= 3 ? "is-large" : "is-fail"),
        dot: h(Swatch, { class: "m-cp-contrast-chip", color: bg === WHITE ? "white" : "black", size: "sm", shape: "circle", checker: false }, "Aa") as Node,
      }, `${name()} ${r.toFixed(2)} `, h("b", { title: r >= 3 && r < 4.5 ? t`Enough for large text only` : null }, grade));
    };
    return h("div", { class: "m-cp-contrasts", "aria-label": () => L().contrast ?? t`Contrast`, role: "group" }, () => [on(WHITE, () => L().onWhite ?? t`on white`), on(BLACK, () => L().onBlack ?? t`on black`)]);
  };
  const swatchName = (token: string): string => ({ "brand-orange": t`Excitement orange`, "brand-blue": t`Activity blue`, "brand-green": t`Friendship green`, "brand-purple": t`Communication purple` } as Record<string, string>)[token] ?? token;

  return h("div", {
    class: () => cx("m-cp", ro() && "is-readonly", props.disabled && "is-disabled", val(props.class)), role: "group", "aria-labelledby": null,
    "aria-label": () => c["aria-label"]() ?? L().picker ?? t`Color picker`, "data-m-color": c["data-m-color"], ref: (el: HTMLElement) => { root = el; untrack(paint); },
  },
  area,
  h("div", { class: "m-cp-row" }, props.preview === false ? null : preview, h("div", { class: "m-cp-sliders" }, slider("hue"), () => (useAlpha() ? slider("alpha") : null)), dropper),
  props.formats === false && props.input === false ? null : h("div", { class: "m-cp-row m-cp-input-row" }, props.formats === false ? null : formats, props.input === false ? null : text),
  contrastRow,
  () => palettes().map((p) => h("div", { class: "m-cp-palette", role: "group", "aria-label": p.label },
    h(SectionLabel, { as: "span", size: "md", class: "m-cp-palette-label", id: `${id}-${p.label}` }, p.label),
    h("div", { class: "m-cp-swatches" }, p.colors.map((col) => swatch(col, swatchName(col)))))));
}
