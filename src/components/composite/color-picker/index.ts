// ColorPicker (hadi-march/ui): saturation / brightness area, hue and alpha sliders, eyedropper, palettes (HADİ colors,
// the theme's palette, recent picks), text input in hex / rgb / hsl, contrast check. Folder: src/components/composite/color-picker/.
//   <ColorPicker bind:value={$color} alpha format="hex" />
import "./color-picker.css";
import { signal, computed, effect, untrack, batch } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { track, arrowStep } from "../../../dom/track.ts";
import { t, messages, dir } from "../../../core/i18n.ts";
import { cx, uid, val, clamp, setStyle, type ClassProp } from "../../../core/util.ts";
import { glyph } from "../../../ui/util.ts";
import { model, ctl, type ControlProps } from "../../../forms/util.ts";
import { IconButton } from "../../../ui/button.ts";
import { Segmented } from "../../../forms/inputs.ts";
import { pipette } from "../../../icons/glyphs/pipette.ts";
import * as C from "./color.ts";
import tr from "./tr.ts";

messages("tr", tr);

export * from "./color.ts";

/** A palette: a name and colors (CSS colors or theme tokens such as "brand-orange"). */
export interface ColorPalette { label: string; colors: readonly string[] }

export interface ColorPickerProps extends ControlProps<string> {
  /** Alpha slider and alpha in the value (default true). */
  alpha?: boolean | undefined;
  /** Text format of the value (default "hex"); the switcher changes it. */
  format?: C.ColorFormat | undefined;
  /** Palettes under the picker. Default: HADİ colors, the theme palette and recent picks. */
  palettes?: readonly ColorPalette[] | false | undefined;
  /** Recent picks kept (default 8; 0 hides them). */
  recent?: number | undefined;
  /** Eyedropper button where the browser has one (default true). */
  eyedropper?: boolean | undefined;
  /** Contrast against white and black (default true). */
  contrast?: boolean | undefined;
  class?: ClassProp;
}

const HADI = ["brand-orange", "brand-blue", "brand-green", "brand-purple"];
const THEME = ["primary", "cat-5", "cat-6", "cat-7", "cat-8", "success", "warn", "danger", "info", "neutral"];
const WHITE: C.Rgba = { r: 255, g: 255, b: 255, a: 1 }, BLACK: C.Rgba = { r: 0, g: 0, b: 0, a: 1 };
type EyeDropperCtor = new () => { open(): Promise<{ sRGBHex: string }> };

/** Color picker: `<ColorPicker bind:value={$c} />`. The value is a CSS color string in the chosen format. */
export function ColorPicker(props: ColorPickerProps): unknown {
  const [get, set] = model(props, "#f2801f");
  const id = uid("hm-cp");
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
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
    if (root) setStyle(root, { "--hm-cp-hue": `hsl(${x.h} 100% 50%)`, "--hm-cp-color": css(), "--hm-cp-solid": `rgb(${col.r} ${col.g} ${col.b})`, "--hm-cp-x": `${x.s * 100}%`, "--hm-cp-y": `${(1 - x.v) * 100}%`, "--hm-cp-h": `${(x.h / 360) * 100}%`, "--hm-cp-a": `${x.a * 100}%` });
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
  const area = h("div", { class: "hm-cp-area" },
    h("div", {
      class: "hm-cp-thumb hm-cp-area-thumb", role: "slider", tabindex: () => (props.disabled ? "-1" : "0"), "aria-label": () => t`Saturation and brightness`,
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

  const slider = (kind: "hue" | "alpha"): Element => {
    const isHue = kind === "hue";
    const el = h("div", { class: cx("hm-cp-track", `hm-cp-${kind}`) },
      h("div", {
        class: "hm-cp-thumb hm-cp-track-thumb", role: "slider", tabindex: () => (props.disabled ? "-1" : "0"),
        "aria-label": () => (isHue ? t`Hue` : t`Opacity`), "aria-orientation": "horizontal",
        "aria-valuemin": "0", "aria-valuemax": isHue ? "360" : "100", "aria-valuenow": () => String(Math.round(isHue ? hsva().h : hsva().a * 100)),
        "aria-valuetext": () => (isHue ? t`${Math.round(hsva().h)} degrees` : `${Math.round(hsva().a * 100)}%`), "aria-disabled": () => (ro() ? "true" : null),
        onKeyDown: (e: KeyboardEvent) => {
          const st = arrowStep(e, rtl());
          if (!st || ro()) return;
          e.preventDefault();
          const x = hsva.peek(), d = st.dx || -st.dy;
          if (isHue) commit({ ...x, h: st.home ? 0 : st.end ? 359.9 : (x.h + d + 360) % 360 });
          else commit({ ...x, a: st.home ? 0 : st.end ? 1 : clamp(x.a + d / 100, 0, 1) });
        },
      })) as HTMLElement;
    track(el, { rtl, onStart: () => !ro(), onMove: (p) => { const x = hsva.peek(); commit(isHue ? { ...x, h: Math.min(359.9, p.x * 360) } : { ...x, a: Math.round(p.x * 100) / 100 }); (el.firstChild as HTMLElement).focus({ preventScroll: true }); }, onEnd: remember });
    return el;
  };

  // ------------------------------------------------------------------ eyedropper, preview, text
  const Dropper = (globalThis as { EyeDropper?: EyeDropperCtor }).EyeDropper;
  const dropper = (): unknown => (props.eyedropper === false || !Dropper ? null : h(IconButton, {
    icon: glyph(pipette), label: () => t`Pick a color from the screen`, size: "sm", class: "hm-cp-dropper", disabled: ro,
    onClick: async () => { try { const r = await new Dropper().open(); pick(r.sRGBHex); } catch { /* cancelled */ } },
  }));
  const preview = h("div", { class: "hm-cp-preview", role: "img", "aria-label": () => t`New color ${out()}, was ${original() || "—"}` },
    h("button", { type: "button", class: "hm-cp-preview-old", tabindex: "-1", "aria-hidden": "true", title: () => t`Back to ${original()}`, onClick: () => { if (original.peek()) pick(original.peek()); } }),
    h("span", { class: "hm-cp-preview-new" }));
  effect(() => { const o = C.parse(original()); const el = preview.firstChild as HTMLElement; if (o) setStyle(el, { "--hm-cp-old": C.format(o, "rgb") }); });

  const text = h("input", {
    ...c, class: "hm-input hm-cp-text", type: "text", spellcheck: "false", autocomplete: "off", "aria-label": () => c["aria-label"]() ?? t`Color value`,
    value: () => draft() ?? out({ ...hsva() }), readonly: () => !!props.readonly,
    "aria-invalid": () => (draft() != null && !C.parse(draft()!) ? "true" : c["aria-invalid"]()),
    onInput: (e: Event) => { const v = (e.target as HTMLInputElement).value; draft.set(v); const p = C.parse(v); if (p) { last = v; hsva.set(C.rgbToHsv(p, hsva.peek().h)); set(out()); } },
    onBlur: () => { if (draft.peek() != null) { draft.set(null); remember(); } },
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter") { draft.set(null); remember(); } },
  }) as HTMLInputElement;
  const formats = h(Segmented, {
    class: "hm-cp-formats", "aria-label": t`Color format`,
    options: [{ value: "hex", label: "HEX" }, { value: "rgb", label: "RGB" }, { value: "hsl", label: "HSL" }],
    value: fmt.peek(), onChange: (f: C.ColorFormat | null) => { if (!f) return; fmt.set(f); if (!ro()) { last = out(); set(last); } },
  });

  // ------------------------------------------------------------------ palettes and contrast
  const resolve = (token: string): string => C.resolveColor(token, root);
  const palettes = (): readonly ColorPalette[] => {
    if (props.palettes === false) return [];
    const own = props.palettes ?? [{ label: t`HADİ colors`, colors: HADI }, { label: t`Theme`, colors: THEME }];
    const r = recent();
    return r.length && (props.recent ?? 8) ? [...own, { label: t`Recent`, colors: r }] : own;
  };
  const swatch = (color: string, label: string): Element => {
    const isToken = !C.parse(color);
    const b = h("button", {
      type: "button", class: () => cx("hm-cp-swatch", same(color) && "is-selected"), "aria-label": label, title: label, "aria-pressed": () => String(same(color)), disabled: ro,
      "data-hm-color": isToken ? color : null, onClick: () => pick(resolve(color)),
    }) as HTMLElement;
    if (!isToken) setStyle(b, { "--hm-cp-sw": color });
    return b;
  };
  const same = (color: string): boolean => { const a = C.parse(resolve(color)), b = rgba(); return !!a && Math.abs(a.r - b.r) < 1.5 && Math.abs(a.g - b.g) < 1.5 && Math.abs(a.b - b.b) < 1.5 && Math.abs(a.a - b.a) < 0.02; };
  const contrastRow = (): unknown => {
    if (props.contrast === false) return null;
    const on = (bg: C.Rgba, name: () => string): Element => {
      const r = C.contrastOf(rgba(), bg), grade = r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA+" : "—";
      return h("span", { class: cx("hm-cp-contrast", r >= 4.5 ? "is-pass" : r >= 3 ? "is-large" : "is-fail"), title: r >= 3 && r < 4.5 ? t`Enough for large text only` : null },
        h("span", { class: cx("hm-cp-contrast-chip", bg === WHITE ? "is-light" : "is-dark"), "aria-hidden": "true" }, "Aa"), `${name()} ${r.toFixed(2)} `, h("b", null, grade));
    };
    return h("div", { class: "hm-cp-contrasts", "aria-label": () => t`Contrast`, role: "group" }, () => [on(WHITE, () => t`on white`), on(BLACK, () => t`on black`)]);
  };
  const swatchName = (token: string): string => ({ "brand-orange": t`Excitement orange`, "brand-blue": t`Activity blue`, "brand-green": t`Friendship green`, "brand-purple": t`Communication purple` } as Record<string, string>)[token] ?? token;

  return h("div", {
    class: () => cx("hm-cp", ro() && "is-readonly", props.disabled && "is-disabled", val(props.class)), role: "group", "aria-labelledby": null,
    "aria-label": () => c["aria-label"]() ?? t`Color picker`, "data-hm-color": c["data-hm-color"], ref: (el: HTMLElement) => { root = el; untrack(paint); },
  },
  area,
  h("div", { class: "hm-cp-row" }, preview, h("div", { class: "hm-cp-sliders" }, slider("hue"), () => (useAlpha() ? slider("alpha") : null)), dropper),
  h("div", { class: "hm-cp-row hm-cp-input-row" }, formats, text),
  contrastRow,
  () => palettes().map((p) => h("div", { class: "hm-cp-palette", role: "group", "aria-label": p.label },
    h("span", { class: "hm-cp-palette-label", id: `${id}-${p.label}` }, p.label),
    h("div", { class: "hm-cp-swatches" }, p.colors.map((col) => swatch(col, swatchName(col)))))));
}
