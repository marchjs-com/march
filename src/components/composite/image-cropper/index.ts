// ImageCropper (hadi-march/ui): crop, rotate, zoom and mirror an image. Folder: src/components/composite/image-cropper/.
//   <ImageCropper src={url} bind:value={$crop} aspect={1} api={(c) => cropper = c} />   cropper.toBlob("image/webp")
// The frame stays centered (drag its corners to resize it, or pick an aspect); drag the image to pan, wheel / slider /
// + − to zoom, 90° buttons and a fine angle slider to rotate, a button to mirror. The image always covers the frame.
import "./image-cropper.css";
import { signal, computed, effect, untrack, batch, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { track } from "../../../dom/track.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, uid, val, clamp, setStyle, on, debounce, type ClassProp } from "../../../core/util.ts";
import { glyph } from "../../../ui/util.ts";
import { model, ctl, type ControlProps } from "../../../forms/util.ts";
import { IconButton } from "../../../ui/button.ts";
import { Segmented, Slider } from "../../../forms/inputs.ts";
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
  class?: ClassProp;
}

const ASPECTS = (): AspectOption[] => [{ label: t`Free`, value: null }, { label: "1:1", value: 1 }, { label: "4:3", value: 4 / 3 }, { label: "16:9", value: 16 / 9 }, { label: "3:4", value: 3 / 4 }, { label: "9:16", value: 9 / 16 }];

/** Image cropper: `<ImageCropper src={url} bind:value={$crop} />`. */
export function ImageCropper(props: ImageCropperProps): unknown {
  const [get, set] = model<G.CropState>(props, { ...G.DEFAULT_CROP });
  const id = uid("hm-crop");
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const st = signal<G.CropState>({ ...G.DEFAULT_CROP, ...untrack(get), ...(untrack(() => props.aspect) !== undefined ? { aspect: untrack(() => props.aspect) ?? null } : {}) });
  const nat = signal<[number, number]>([0, 0]);
  const view = signal<[number, number]>([0, 0]);
  const busy = signal(false);
  const maxZoom = (): number => props.maxZoom ?? 4;
  let img!: HTMLImageElement, viewport!: HTMLElement, out: HTMLCanvasElement | null = null;

  effect(() => { const v = get(); if (v && v !== untrack(st)) untrack(() => st.set({ ...st.peek(), ...v })); });
  effect(() => { if (props.aspect !== undefined) untrack(() => change({ aspect: props.aspect ?? null })); });
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
  // view → CSS variables (CSSOM)
  effect(() => {
    const s = st(), [fw, fh] = frame(), S = scale(), [iw, ih] = nat();
    if (!viewport) return;
    setStyle(viewport, { "--hm-crop-fw": `${fw}px`, "--hm-crop-fh": `${fh}px`, "--hm-crop-tx": `${s.x * fw}px`, "--hm-crop-ty": `${s.y * fh}px`, "--hm-crop-r": `${s.rotate}deg`, "--hm-crop-sx": String(S * (s.flip ? -1 : 1)), "--hm-crop-sy": String(S), "--hm-crop-iw": `${iw}px`, "--hm-crop-ih": `${ih}px` });
  });
  const drawPreview = debounce(() => { if (out && nat.peek()[0] && view.peek()[0]) G.cropToCanvas(img, st.peek(), { width: view.peek()[0], height: view.peek()[1] }, { width: 240, canvas: out }); }, 60);
  effect(() => { st(); nat(); view(); if (props.preview !== false) drawPreview(); });

  // ------------------------------------------------------------------ the view: pan, wheel zoom, keyboard
  img = h("img", {
    class: "hm-crop-img", src: () => props.src, alt: "", draggable: "false", crossorigin: "anonymous",
    onLoad: () => { batch(() => { nat.set([img.naturalWidth, img.naturalHeight]); }); measure(); change({}, false); },
  }) as HTMLImageElement;
  const corner = (cxn: -1 | 1, cyn: -1 | 1): Element => {
    const el = h("span", { class: cx("hm-crop-corner", `hm-crop-c${cyn < 0 ? "t" : "b"}${cxn < 0 ? "s" : "e"}`), "aria-hidden": "true" }) as HTMLElement;
    let start: G.CropState | null = null;
    track(el, {
      area: () => viewport, clamp: false,
      onStart: () => { if (ro()) return false; start = { ...st.peek() }; busy.set(true); },
      onMove: (p) => {
        if (!start) return;
        const rtl = globalThis.getComputedStyle?.(viewport).direction === "rtl";
        const dx = (p.dx * 2 * (rtl ? -cxn : cxn)) / p.rect.width, dy = (p.dy * 2 * cyn) / p.rect.height;
        if (start.aspect) { const d = Math.abs(dx) > Math.abs(dy) ? dx : dy; change({ w: start.w + d, h: start.h + d }); }
        else change({ w: start.w + dx, h: start.h + dy });
      },
      onEnd: () => { start = null; busy.set(false); },
    });
    return el;
  };
  viewport = h("div", {
    class: () => cx("hm-crop-view", busy() && "is-busy"), tabindex: () => (props.disabled ? "-1" : "0"), role: "group",
    "aria-label": () => t`Crop area${props.alt ? `: ${props.alt}` : ""}`, "aria-describedby": `${id}-keys`, "aria-roledescription": () => t`cropper`,
    onKeyDown: (e: KeyboardEvent) => {
      if (ro()) return;
      const s = st.peek(), step = e.shiftKey ? 0.05 : 0.01;
      const map: Record<string, () => void> = {
        ArrowLeft: () => change({ x: s.x - step }), ArrowRight: () => change({ x: s.x + step }), ArrowUp: () => change({ y: s.y - step }), ArrowDown: () => change({ y: s.y + step }),
        "+": () => change({ zoom: s.zoom * 1.1 }), "=": () => change({ zoom: s.zoom * 1.1 }), "-": () => change({ zoom: s.zoom / 1.1 }),
        "[": () => change({ rotate: s.rotate - 1 }), "]": () => change({ rotate: s.rotate + 1 }), r: () => change({ rotate: s.rotate + 90 }), R: () => change({ rotate: s.rotate - 90 }),
        f: () => change({ flip: !s.flip }), F: () => change({ flip: !s.flip }),
      };
      const fn = map[e.key];
      if (fn) { e.preventDefault(); fn(); }
    },
  },
  h("div", { class: "hm-crop-stage" }, img),
  h("div", { class: "hm-crop-frame" }, h("span", { class: "hm-crop-grid", "aria-hidden": "true" }), corner(-1, -1), corner(1, -1), corner(-1, 1), corner(1, 1))) as HTMLElement;
  let panFrom: G.CropState | null = null;
  track(viewport, {
    clamp: false,
    onStart: (p) => { if (ro() || (p.event.target as Element).closest(".hm-crop-corner")) return false; panFrom = { ...st.peek() }; busy.set(true); viewport.focus({ preventScroll: true }); },
    onMove: (p) => { if (!panFrom) return; const [fw, fh] = frame.peek(); change({ x: panFrom.x + p.dx / fw, y: panFrom.y + p.dy / fh }); },
    onEnd: () => { panFrom = null; busy.set(false); },
  });
  on<WheelEvent>(viewport, "wheel", (e) => { if (ro()) return; e.preventDefault(); change({ zoom: st.peek().zoom * Math.exp(-e.deltaY / 400) }); }, { passive: false });
  // the view's size (the frame is a share of it)
  function measure(): void { const r = viewport.getBoundingClientRect(); if (r.width && r.height && (r.width !== view.peek()[0] || r.height !== view.peek()[1])) { view.set([r.width, r.height]); change({}, false); } }
  const RO = globalThis.ResizeObserver;
  if (RO) { const ro2 = new RO(measure); queueMicrotask(() => ro2.observe(viewport)); onCleanup(() => ro2.disconnect()); } else queueMicrotask(measure);

  // ------------------------------------------------------------------ controls
  const aspects = (): readonly AspectOption[] => (props.aspects === false || props.aspect !== undefined ? [] : props.aspects ?? ASPECTS());
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
  effect(() => { const z = Math.round(st().zoom * 100) / 100, d = deg(); untrack(() => batch(() => { zoomView.set(z); fineView.set(clamp(d - Math.round(d / 90) * 90, -45, 45)); })); });

  return h("div", { class: () => cx("hm-crop", ro() && "is-readonly", val(props.class)), role: "group", "aria-label": () => c["aria-label"]() ?? t`Image cropper` },
    viewport,
    h("p", { id: `${id}-keys`, class: "hm-crop-keys" }, () => t`Drag to move, wheel or + − to zoom, [ ] to turn by 1°, R by 90°, F to mirror.`),
    h("div", { class: "hm-crop-controls" },
      () => (aspects().length ? h(Segmented, { class: "hm-crop-aspects", "aria-label": t`Aspect ratio`, options: aspects().map((a) => ({ value: a.value ?? "free", label: a.label })), value: st.peek().aspect ?? "free", onChange: (v: number | string | null) => change({ aspect: typeof v === "number" ? v : null }) }) : null),
      h("div", { class: "hm-crop-row" },
        h(IconButton, { icon: glyph(rotateCcw), label: () => t`Rotate left`, size: "sm", disabled: ro, onClick: () => change({ rotate: st.peek().rotate - 90 }) }),
        h(IconButton, { icon: glyph(rotateCw), label: () => t`Rotate right`, size: "sm", disabled: ro, onClick: () => change({ rotate: st.peek().rotate + 90 }) }),
        h(IconButton, { icon: glyph(flipHorizontal), label: () => t`Mirror`, size: "sm", disabled: ro, class: () => cx(st().flip && "is-on"), "aria-pressed": () => String(st().flip), onClick: () => change({ flip: !st.peek().flip }) }),
        h(IconButton, { icon: glyph(refresh), label: () => t`Reset`, size: "sm", disabled: ro, onClick: api.reset })),
      h("label", { class: "hm-crop-slider" }, h("span", null, () => t`Zoom`),
        h(Slider, { min: 1, max: maxZoom(), step: 0.01, value: zoomView, onChange: (v: number) => change({ zoom: v }), format: (v: number) => `${Math.round(v * 100)}%`, disabled: props.disabled, readonly: props.readonly })),
      h("label", { class: "hm-crop-slider" }, h("span", null, () => t`Angle`),
        h(Slider, { min: -45, max: 45, step: 0.5, value: fineView, onChange: (v: number) => change({ rotate: Math.round(st.peek().rotate / 90) * 90 + v }), format: (v: number) => `${v}°`, disabled: props.disabled, readonly: props.readonly }))),
    () => (props.preview === false ? null : h("figure", { class: "hm-crop-out" },
      h("canvas", { class: "hm-crop-canvas", role: "img", "aria-label": () => t`Cropped result`, ref: (el: HTMLCanvasElement) => { out = el; drawPreview(); } }),
      h("figcaption", null, () => { const [fw, fh] = frame(), S = scale(); return `${Math.round(fw / S)} × ${Math.round(fh / S)} px`; }))));
}
