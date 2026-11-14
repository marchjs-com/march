// ImageCropper (hadi-march/ui): crop, rotate, zoom and mirror an image. Folder: src/components/composite/image-cropper/.
//   <ImageCropper src={url} bind:value={$crop} aspect={1} api={(c) => cropper = c} />   cropper.toBlob("image/webp")
// The frame stays centered (drag its corners to resize it, or pick an aspect); drag the image to pan, wheel / slider /
// + − to zoom, 90° buttons and a fine angle slider to rotate, a button to mirror. The image always covers the frame.
import "./image-cropper.css";
import { signal, computed, effect, untrack, batch } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { track, arrowStep } from "../../../behaviors/drag/index.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, uid, val, clamp, setStyle, on, debounce, type ClassProp, isRtl } from "../../../core/util.ts";
import { glyph } from "../../../ui/util.ts";
import { model, ctl, live, type ControlProps } from "../../../forms/util.ts";
import { hasPart as has } from "../../../ui/parts.ts";
import { observeSize } from "../../../ui/observe.ts";
import { IconButton } from "../../../ui/button.ts";
import { Segmented, Slider } from "../../../forms/inputs.ts";
import { Field } from "../../../forms/field.ts";
import { Card } from "../../data/card/index.ts";
import { CHECKER } from "../../forms/swatch/index.ts";
import { Toolbar } from "../../layout/stack/index.ts";
import { rotateCw } from "../../../icons/glyphs/rotateCw.ts";
import { rotateCcw } from "../../../icons/glyphs/rotateCcw.ts";
import { flipHorizontal } from "../../../icons/glyphs/flipHorizontal.ts";
import { refresh } from "../../../icons/glyphs/refresh.ts";
import * as G from "./crop.ts";
import tr from "./tr.ts";

messages("tr", tr);

export * from "./crop.ts";

export interface AspectOption { label: string; value: number | null }
export interface ImageCropperApi {
  /** The crop drawn on a canvas (default width: the image's own resolution across the frame). */
  toCanvas(width?: number): HTMLCanvasElement | null;
  toBlob(type?: string, quality?: number, width?: number): Promise<Blob | null>;
  reset(): void;
}
export interface ImageCropperProps extends ControlProps<G.CropState> {
  /** Image URL (same origin, data: or blob:, so the canvas can read it). */
  src: string;
  /** Accessible description of the image. */
  alt?: string | undefined;
  /** Fixed aspect (width / height); omitted: the aspect choices decide. */
  aspect?: number | null | undefined;
  /** Aspect choices (default free, 1:1, 4:3, 16:9, 3:4, 9:16); false hides them. */
  aspects?: readonly AspectOption[] | false | undefined;
  /** Highest zoom (default 4). */
  maxZoom?: number | undefined;
  /** A live preview of the result (default true). */
  preview?: boolean | undefined;
  /** Receives the cropper API. */
  api?: ((api: ImageCropperApi) => void) | undefined;
  /** The rule-of-thirds grid inside the frame (default true). */
  grid?: boolean | undefined;
  /** The key hint under the crop area (default true); when false it stays readable for screen readers. */
  hint?: boolean | undefined;
  /** The buttons: true (default), false, or the ones to keep. */
  tools?: boolean | readonly ("rotateLeft" | "rotateRight" | "mirror" | "reset")[] | undefined;
  /** The sliders: true (default), false, or the ones to keep. */
  sliders?: boolean | readonly ("zoom" | "angle")[] | undefined;
  /** The "640 × 480 px" caption under the preview (default true). */
  size?: boolean | undefined;
  /** Own texts; each falls back to the built-in one. `role` is the crop area's role description, `hint` the key hint. */
  labels?: {
    cropper?: string; area?: string; role?: string; hint?: string; free?: string; aspect?: string;
    rotateLeft?: string; rotateRight?: string; mirror?: string; reset?: string; zoom?: string; angle?: string; result?: string;
  } | undefined;
  class?: ClassProp;
}

const ASPECTS = (free?: string): AspectOption[] => [{ label: free ?? t`Free`, value: null }, { label: "1:1", value: 1 }, { label: "4:3", value: 4 / 3 }, { label: "16:9", value: 16 / 9 }, { label: "3:4", value: 3 / 4 }, { label: "9:16", value: 9 / 16 }];

/** Image cropper: `<ImageCropper src={url} bind:value={$crop} />`. */
export function ImageCropper(props: ImageCropperProps): unknown {
  const [get, set] = model<G.CropState>(props, { ...G.DEFAULT_CROP });
  const id = uid("m-crop");
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const L = (): NonNullable<ImageCropperProps["labels"]> => props.labels ?? {};
  const st = signal<G.CropState>({ ...G.DEFAULT_CROP, ...untrack(get), ...(untrack(() => props.aspect) !== undefined ? { aspect: untrack(() => props.aspect) ?? null } : {}) });
  const nat = signal<[number, number]>([0, 0]);
  const view = signal<[number, number]>([0, 0]);
  const busy = signal(false);
  const maxZoom = (): number => props.maxZoom ?? 4;
  let img!: HTMLImageElement, viewport!: HTMLElement, out: HTMLCanvasElement | null = null;

  effect(() => { const v = get(); if (v && v !== untrack(st)) untrack(() => st.set({ ...st.peek(), ...v })); });
  const frame = computed(() => G.frameSize(st(), view()[0], view()[1]));
  const scale = computed(() => { const [iw, ih] = nat(), [fw, fh] = frame(); return iw && ih ? G.coverScale(iw, ih, fw, fh, st().rotate) * st().zoom : 1; });

  /** Apply a change, clamping zoom and pan so the frame stays covered. */
  const change = (patch: Partial<G.CropState>, emit = true): void => {
    if (ro() && emit) return;
    if (!view.peek()[0] && viewport) measure();
    const next = { ...st.peek(), ...patch };
    next.zoom = clamp(next.zoom, 1, maxZoom());
    next.w = clamp(next.w, 0.15, 1);
    next.h = clamp(next.h, 0.15, 1);
    const [iw, ih] = nat.peek(), [fw, fh] = G.frameSize(next, view.peek()[0], view.peek()[1]);
    if (iw && ih && fw && fh) [next.x, next.y] = G.clampPan(next, iw, ih, fw, fh);
    st.set(next);
    if (emit) set(next);
  };
  // (after `change`: an effect runs as soon as it is made)
  effect(() => { if (props.aspect !== undefined) untrack(() => change({ aspect: props.aspect ?? null })); });
  // a lower maxZoom pulls the zoom back inside it
  effect(() => { const m = maxZoom(); untrack(() => { if (st.peek().zoom > m) change({ zoom: m }, !ro()); }); });
  // view → CSS variables (CSSOM)
  effect(() => {
    const s = st(), [fw, fh] = frame(), S = scale(), [iw, ih] = nat();
    if (!viewport) return;
    setStyle(viewport, { "--m-crop-fw": `${fw}px`, "--m-crop-fh": `${fh}px`, "--m-crop-tx": `${s.x * fw}px`, "--m-crop-ty": `${s.y * fh}px`, "--m-crop-r": `${s.rotate}deg`, "--m-crop-sx": String(S * (s.flip ? -1 : 1)), "--m-crop-sy": String(S), "--m-crop-iw": `${iw}px`, "--m-crop-ih": `${ih}px` });
  });
  const drawPreview = debounce(() => { if (out && nat.peek()[0] && view.peek()[0]) G.cropToCanvas(img, st.peek(), { width: view.peek()[0], height: view.peek()[1] }, { width: 240, canvas: out }); }, 60);
  effect(() => { st(); nat(); view(); if (props.preview !== false) drawPreview(); });

  // ------------------------------------------------------------------ the view: pan, wheel zoom, keyboard
  img = h("img", {
    class: "m-crop-img", src: () => props.src, alt: "", draggable: "false", crossorigin: "anonymous",
    onLoad: () => { batch(() => { nat.set([img.naturalWidth, img.naturalHeight]); }); measure(); change({}, false); },
  }) as HTMLImageElement;
  const corner = (cxn: -1 | 1, cyn: -1 | 1): Element => {
    const el = h("span", { class: cx("m-crop-corner", `m-crop-c${cyn < 0 ? "t" : "b"}${cxn < 0 ? "s" : "e"}`), "aria-hidden": "true" }) as HTMLElement;
    let start: G.CropState | null = null;
    track(el, {
      area: () => viewport, clamp: false,
      onStart: () => { if (ro()) return false; start = { ...st.peek() }; busy.set(true); },
      onMove: (p) => {
        if (!start) return;
        const rtl = isRtl(viewport);
        const dx = (p.dx * 2 * (rtl ? -cxn : cxn)) / p.rect.width, dy = (p.dy * 2 * cyn) / p.rect.height;
        if (start.aspect) { const d = Math.abs(dx) > Math.abs(dy) ? dx : dy; change({ w: start.w + d, h: start.h + d }); }
        else change({ w: start.w + dx, h: start.h + dy });
      },
      onEnd: () => { start = null; busy.set(false); },
    });
    return el;
  };
  viewport = h("div", {
    class: () => cx("m-crop-view", CHECKER, busy() && "is-busy"), tabindex: () => (props.disabled ? "-1" : "0"), role: "group",
    "aria-label": () => (L().area != null ? `${L().area}${props.alt ? `: ${props.alt}` : ""}` : t`Crop area${props.alt ? `: ${props.alt}` : ""}`), "aria-describedby": `${id}-keys`, "aria-roledescription": () => L().role ?? t`cropper`,
    onKeyDown: (e: KeyboardEvent) => {
      if (ro()) return;
      const s = st.peek();
      // arrows pan by 1% of the frame (Shift: 5%)
      const pan = e.key.startsWith("Arrow") ? arrowStep(e) : null;
      if (pan) { const unit = e.shiftKey ? 0.005 : 0.01; e.preventDefault(); change({ x: s.x + pan.dx * unit, y: s.y + pan.dy * unit }); return; }
      const map: Record<string, () => void> = {
        "+": () => change({ zoom: s.zoom * 1.1 }), "=": () => change({ zoom: s.zoom * 1.1 }), "-": () => change({ zoom: s.zoom / 1.1 }),
        "[": () => change({ rotate: s.rotate - 1 }), "]": () => change({ rotate: s.rotate + 1 }), r: () => change({ rotate: s.rotate + 90 }), R: () => change({ rotate: s.rotate - 90 }),
        f: () => change({ flip: !s.flip }), F: () => change({ flip: !s.flip }),
      };
      const fn = map[e.key];
      if (fn) { e.preventDefault(); fn(); }
    },
  },
  h("div", { class: "m-crop-stage" }, img),
  h("div", { class: "m-crop-frame" }, props.grid === false ? null : h("span", { class: "m-crop-grid", "aria-hidden": "true" }), corner(-1, -1), corner(1, -1), corner(-1, 1), corner(1, 1))) as HTMLElement;
  let panFrom: G.CropState | null = null;
  track(viewport, {
    clamp: false,
    onStart: (p) => { if (ro() || (p.event.target as Element).closest(".m-crop-corner")) return false; panFrom = { ...st.peek() }; busy.set(true); viewport.focus({ preventScroll: true }); },
    onMove: (p) => { if (!panFrom) return; const [fw, fh] = frame.peek(); change({ x: panFrom.x + p.dx / fw, y: panFrom.y + p.dy / fh }); },
    onEnd: () => { panFrom = null; busy.set(false); },
  });
  on<WheelEvent>(viewport, "wheel", (e) => { if (ro()) return; e.preventDefault(); change({ zoom: st.peek().zoom * Math.exp(-e.deltaY / 400) }); }, { passive: false });
  // the view's size (the frame is a share of it)
  function measure(): void { const r = viewport.getBoundingClientRect(); if (r.width && r.height && (r.width !== view.peek()[0] || r.height !== view.peek()[1])) { view.set([r.width, r.height]); change({}, false); } }
  observeSize(viewport, measure);

  // ------------------------------------------------------------------ controls
  const aspects = (): readonly AspectOption[] => (props.aspects === false || props.aspect !== undefined ? [] : props.aspects ?? ASPECTS(L().free));
  const toCanvas = (width?: number): HTMLCanvasElement | null => (nat.peek()[0] ? G.cropToCanvas(img, st.peek(), { width: view.peek()[0], height: view.peek()[1] }, width ? { width } : {}) : null);
  const api: ImageCropperApi = {
    toCanvas,
    toBlob: (type = "image/png", quality, width) => new Promise((res) => { const cv = toCanvas(width); if (!cv) res(null); else cv.toBlob((b) => res(b), type, quality); }),
    reset: () => change({ ...G.DEFAULT_CROP, aspect: st.peek().aspect }),
  };
  queueMicrotask(() => props.api?.(api));
  // the sliders follow the state (signals, so the controls stay live)
  const deg = (): number => Math.round(((((st().rotate % 360) + 540) % 360) - 180) * 10) / 10;
  const zoomView = signal(1), fineView = signal(0);
  // the quarter turn a fine angle is added to: ±45° belongs to the quarter nearer 0, so dragging the angle slider to its
  // end does not flip it to the other end (45° stays 45°, not 90° − 45°)
  const quarter = (d: number): number => Math.round((d - Math.sign(d) * 1e-6) / 90) * 90;
  effect(() => { const z = Math.round(st().zoom * 100) / 100, d = deg(); untrack(() => batch(() => { zoomView.set(z); fineView.set(clamp(d - quarter(d), -45, 45)); })); });

  const tools = props.tools, sliders = props.sliders;
  return h(Card, { as: "div", class: () => cx("m-crop", ro() && "is-readonly", val(props.class)), role: "group", "aria-label": () => c["aria-label"]() ?? L().cropper ?? t`Image cropper` },
    viewport,
    h("p", { id: `${id}-keys`, class: cx("m-crop-keys", props.hint === false && "m-sr-only") }, () => L().hint ?? t`Drag to move, wheel or + − to zoom, [ ] to turn by 1°, R by 90°, F to mirror.`),
    h("div", { class: "m-crop-controls" },
      () => (aspects().length ? h(Segmented, { class: "m-crop-aspects", "aria-label": L().aspect ?? t`Aspect ratio`, options: aspects().map((a) => ({ value: a.value ?? "free", label: a.label })), value: st.peek().aspect ?? "free", onChange: (v: number | string | null) => change({ aspect: typeof v === "number" ? v : null }) }) : null),
      tools === false || (tools && tools !== true && !tools.length) ? null : h(Toolbar, { class: "m-crop-row" },
        has(tools, "rotateLeft") && h(IconButton, { icon: glyph(rotateCcw), label: () => L().rotateLeft ?? t`Rotate left`, size: "sm", disabled: ro, onClick: () => change({ rotate: st.peek().rotate - 90 }) }),
        has(tools, "rotateRight") && h(IconButton, { icon: glyph(rotateCw), label: () => L().rotateRight ?? t`Rotate right`, size: "sm", disabled: ro, onClick: () => change({ rotate: st.peek().rotate + 90 }) }),
        has(tools, "mirror") && h(IconButton, { icon: glyph(flipHorizontal), label: () => L().mirror ?? t`Mirror`, size: "sm", disabled: ro, pressed: () => st().flip, onClick: () => change({ flip: !st.peek().flip }) }),
        has(tools, "reset") && h(IconButton, { icon: glyph(refresh), label: () => L().reset ?? t`Reset`, size: "sm", disabled: ro, onClick: api.reset })),
      has(sliders, "zoom") && h(Field, { id: `${id}-zoom`, inline: true, compact: true, class: "m-crop-slider m-crop-zoom", label: () => L().zoom ?? t`Zoom` },
        h(Slider, { id: `${id}-zoom`, min: 1, max: live(() => maxZoom()), step: 0.01, value: zoomView, onChange: (v: number) => change({ zoom: v }), format: (v: number) => `${Math.round(v * 100)}%`, disabled: live(() => props.disabled), readonly: live(() => props.readonly) })),
      has(sliders, "angle") && h(Field, { id: `${id}-angle`, inline: true, compact: true, class: "m-crop-slider m-crop-angle", label: () => L().angle ?? t`Angle` },
        h(Slider, { id: `${id}-angle`, min: -45, max: 45, step: 0.5, value: fineView, onChange: (v: number) => change({ rotate: quarter(st.peek().rotate) + v }), format: (v: number) => `${v}°`, disabled: live(() => props.disabled), readonly: live(() => props.readonly) }))),
    () => (props.preview === false ? null : h("figure", { class: "m-crop-out" },
      h("canvas", { class: cx("m-crop-canvas", CHECKER), role: "img", "aria-label": () => L().result ?? t`Cropped result`, ref: (el: HTMLCanvasElement) => { out = el; drawPreview(); } }),
      props.size === false ? null : h("figcaption", null, () => { const [fw, fh] = frame(), S = scale(); return `${Math.round(fw / S)} × ${Math.round(fh / S)} px`; }))));
}
