// KeyframeTimeline (hadi-march/ui): edit and play a keyframe timeline on the motion engine. Folder: src/components/composite/keyframe-timeline/.
//   <KeyframeTimeline bind:value={$model} />
// Transport (play / pause, back to start, loop, speed), a ruler you scrub, a playhead you drag, one lane per track with
// its value curve and draggable keyframes (snapped to 50 ms; Alt for free), and an inspector with an EasingCurveEditor
// for the selected keyframe. Playback is an engine Playback: global speed, Stop all and reduced motion apply.
import "./keyframe-timeline.css";
import { signal, computed, effect, untrack, onCleanup, batch } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { track, arrowStep } from "../../../dom/track.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, uid, val, clamp, setStyle, type ClassProp } from "../../../core/util.ts";
import { glyph } from "../../../ui/util.ts";
import { model, ctl, type ControlProps } from "../../../forms/util.ts";
import { IconButton } from "../../../ui/button.ts";
import { Segmented } from "../../../forms/inputs.ts";
import { timeline, type Playback } from "../../../motion/engine/playback.ts";
import { EasingCurveEditor } from "../easing-curve-editor/index.ts";
import { play as playIcon } from "../../../icons/glyphs/play.ts";
import { pause as pauseIcon } from "../../../icons/glyphs/pause.ts";
import { skipBack } from "../../../icons/glyphs/skipBack.ts";
import { repeat } from "../../../icons/glyphs/repeat.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import * as M from "./model.ts";
import tr from "./tr.ts";

messages("tr", tr);

export * from "./model.ts";

export interface KeyframeTimelineProps extends ControlProps<M.TimelineModel> {
  /** Draws a preview target (default: a labelled pill in the track's color). */
  renderTarget?: ((name: string) => Element) | undefined;
  /** Snap step in ms (default 50; 0 turns snapping off). */
  snap?: number | undefined;
  /** Start playing when shown (default false). */
  autoplay?: boolean | undefined;
  /** Loop (default true). */
  loop?: boolean | undefined;
  /** Preview stage over the lanes (default true). */
  stage?: boolean | undefined;
  class?: ClassProp;
}

const SPEEDS = [0.25, 0.5, 1, 2];
const BRAND = ["brand-orange", "brand-blue", "brand-green", "brand-purple"] as const;
const fmt = (ms: number): string => { const s = Math.max(0, ms) / 1000; return `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`; };

/** Keyframe timeline editor: `<KeyframeTimeline bind:value={$timeline} />`. */
export function KeyframeTimeline(props: KeyframeTimelineProps): unknown {
  const [get, set] = model<M.TimelineModel>(props, { duration: 2000, tracks: [] });
  const id = uid("hm-kt");
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const now = signal(0);
  const playing = signal(false);
  const loop = signal(untrack(() => props.loop !== false));
  const speed = signal(1);
  const selected = signal<{ track: number; key: number } | null>(null);
  const D = computed(() => Math.max(100, get().duration));
  const targets = computed(() => [...new Set(get().tracks.map((x) => x.target))]);
  // lanes are re-drawn only when tracks or keyframes are added / removed (a drag keeps its pointer capture)
  const shape = computed(() => get().tracks.map((x) => `${x.id}:${x.keys.length}`).join("|"));
  let root: HTMLElement | undefined;
  const targetEls = new Map<string, HTMLElement>();
  const snapMs = (ms: number, free: boolean): number => { const s = props.snap ?? 50; return clamp(!s || free ? Math.round(ms) : Math.round(ms / s) * s, 0, D.peek()); };
  const colorOf = (i: number, tk: M.TimelineTrack): string => tk.color ?? BRAND[targets.peek().indexOf(tk.target) % 4] ?? BRAND[i % 4]!;

  const update = (fn: (m: M.TimelineModel) => M.TimelineModel): void => { if (!ro()) set(fn(untrack(get))); };
  const setKey = (ti: number, ki: number, patch: Partial<M.Keyframe>): void => update((m) => ({ ...m, tracks: m.tracks.map((x, i) => (i !== ti ? x : { ...x, keys: x.keys.map((k, j) => (j === ki ? { ...k, ...patch } : k)) })) }));
  const addKey = (ti: number, at: number): void => {
    const tk = untrack(get).tracks[ti];
    if (!tk) return;
    update((m) => ({ ...m, tracks: m.tracks.map((x, i) => (i !== ti ? x : { ...x, keys: [...x.keys, { at, value: Math.round(M.sampleTrack(x, at) * 100) / 100 }] })) }));
    selected.set({ track: ti, key: tk.keys.length });
  };
  const removeKey = (ti: number, ki: number): void => {
    if ((untrack(get).tracks[ti]?.keys.length ?? 0) <= 1) return;
    update((m) => ({ ...m, tracks: m.tracks.map((x, i) => (i !== ti ? x : { ...x, keys: x.keys.filter((_, j) => j !== ki) })) }));
    selected.set(null);
  };

  // ------------------------------------------------------------------ painting and playback (engine clock)
  const paint = (time: number): void => {
    now.set(time);
    const vals = M.sample(untrack(get), time);
    for (const [name, el] of targetEls) setStyle(el, M.targetVars(vals[name] ?? {}));
    if (root) setStyle(root, { "--hm-kt-ph": `${(time / D.peek()) * 100}%`, "--hm-kt-f": String(time / D.peek()) });
  };
  let pb: Playback | null = null;
  const clock = { t: 0 };
  effect(() => {
    const d = D();
    untrack(() => {
      pb?.cancel();
      const p = timeline({ autoplay: false });
      p.add(clock, [{ t: 0 }, { t: d }], { duration: d, easing: "linear", at: 0 });
      p.onUpdate = () => paint(clock.t);
      p.onComplete = () => { if (loop.peek() && playing.peek()) { p.seek(0); p.play(); } else playing.set(false); };
      p.playbackRate = speed.peek();
      p.seek(Math.min(now.peek(), d));
      pb = p;
      if (playing.peek()) p.play();
    });
  });
  onCleanup(() => pb?.cancel());
  effect(() => { const r = speed(); if (pb) pb.playbackRate = r; });
  effect(() => { get(); untrack(() => paint(now.peek())); });
  const toggle = (): void => {
    if (!pb) return;
    if (playing.peek()) { pb.pause(); playing.set(false); }
    else { if (now.peek() >= D.peek() - 1) pb.seek(0); playing.set(true); pb.play(); }
  };
  const seek = (ms: number): void => { const v = clamp(ms, 0, D.peek()); pb?.seek(v); clock.t = v; paint(v); };
  if (untrack(() => props.autoplay)) queueMicrotask(toggle);

  // ------------------------------------------------------------------ ruler, playhead, lanes
  const ticks = computed(() => {
    const d = D(), step = d > 6000 ? 500 : d > 3000 ? 250 : 100;
    const out: { at: number; major: boolean }[] = [];
    for (let at = 0; at <= d + 0.5; at += step) out.push({ at, major: Math.round(at) % (step * 5 > 1000 ? 1000 : 500) === 0 });
    return out;
  });
  const ruler = h("div", { class: "hm-kt-ruler", "aria-hidden": "true" }, () => ticks().map((k) => h("span", {
    class: cx("hm-kt-tick", k.major && "is-major"), style: { "--hm-kt-at": `${(k.at / D()) * 100}%` },
  }, k.major ? `${k.at / 1000}s` : null))) as HTMLElement;
  track(ruler, { onStart: () => { if (playing.peek()) toggle(); }, onMove: (p) => seek(snapMs(p.x * D.peek(), p.event.altKey || !(props.snap ?? 50))) });
  const head = h("div", {
    class: "hm-kt-head", role: "slider", tabindex: "0", "aria-label": () => t`Playhead`, "aria-valuemin": "0", "aria-valuemax": () => String(D()),
    "aria-valuenow": () => String(Math.round(now())), "aria-valuetext": () => fmt(now()),
    onKeyDown: (e: KeyboardEvent) => { const st = arrowStep(e); if (!st) return; e.preventDefault(); seek(st.home ? 0 : st.end ? D.peek() : now.peek() + (st.dx || -st.dy) * (e.shiftKey ? 10 : 1000 / 60)); },
  }, h("span", { class: "hm-kt-head-grip", "aria-hidden": "true" })) as HTMLElement;
  track(head, { area: () => ruler, onStart: () => { if (playing.peek()) toggle(); }, onMove: (p) => seek(snapMs(p.x * D.peek(), p.event.altKey)) });

  const diamond = (ti: number, ki: number): Element => {
    const key = (): M.Keyframe | undefined => get().tracks[ti]?.keys[ki];
    const isSel = (): boolean => selected()?.track === ti && selected()?.key === ki;
    const el = h("button", {
      type: "button", class: () => cx("hm-kt-key", isSel() && "is-selected", Math.abs((key()?.at ?? -1e9) - now()) < 1000 / 60 && "is-hit"), role: "slider",
      style: () => ({ "--hm-kt-at": `${((key()?.at ?? 0) / D()) * 100}%` }), tabindex: () => (isSel() || (!selected() && ti === 0 && ki === 0) ? "0" : "-1"),
      "aria-label": () => t`Keyframe ${ki + 1} of ${get().tracks[ti]?.target ?? ""} ${get().tracks[ti]?.prop ?? ""}`, "aria-valuemin": "0", "aria-valuemax": () => String(D()),
      "aria-valuenow": () => String(Math.round(key()?.at ?? 0)), "aria-valuetext": () => `${fmt(key()?.at ?? 0)}, ${key()?.value ?? ""}`, disabled: ro,
      onFocus: () => selected.set({ track: ti, key: ki }),
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeKey(ti, ki); return; }
        if (e.key === "Enter") { e.preventDefault(); seek(key()?.at ?? 0); return; }
        const st = arrowStep(e);
        if (!st || st.dy) return;
        e.preventDefault();
        const at = key()?.at ?? 0, step = props.snap || 50;
        setKey(ti, ki, { at: st.home ? 0 : st.end ? D.peek() : clamp(at + Math.sign(st.dx) * (e.shiftKey ? step * 10 : step), 0, D.peek()) });
      },
    }) as HTMLElement;
    track(el, {
      area: () => el.parentElement, onStart: () => { if (ro()) return false; selected.set({ track: ti, key: ki }); },
      onMove: (p) => { if (Math.abs(p.dx) > 2) setKey(ti, ki, { at: snapMs(p.x * D.peek(), p.event.altKey) }); },
      onEnd: () => el.focus({ preventScroll: true }),
    });
    return el;
  };
  const spark = (ti: number): Element => h("svg", { xmlns: "http://www.w3.org/2000/svg", class: "hm-kt-spark", viewBox: "0 0 100 20", preserveAspectRatio: "none", "aria-hidden": "true" },
    h("path", {
      d: () => {
        const tk = get().tracks[ti];
        if (!tk) return "";
        const d = D(), vs = Array.from({ length: 61 }, (_, i) => M.sampleTrack(tk, (i / 60) * d));
        const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
        return vs.map((v, i) => `${i ? "L" : "M"}${(i / 60) * 100} ${18 - ((v - lo) / span) * 16}`).join(" ");
      },
    }));
  const lanes = () => {
    shape();
    return untrack(() => get().tracks.map((tk, ti) => h("div", { class: "hm-kt-row", "data-hm-color": colorOf(ti, tk) },
      h("div", { class: "hm-kt-label" }, h("span", { class: "hm-kt-dot", "aria-hidden": "true" }), h("b", null, tk.target), h("span", { class: "hm-kt-prop" }, () => `${get().tracks[ti]?.prop ?? ""}`)),
      h("div", {
        class: "hm-kt-lane", role: "group", "aria-label": () => t`${tk.target} ${tk.prop}: double-click to add a keyframe`,
        onDblClick: (e: MouseEvent) => { if (ro() || (e.target as Element).closest(".hm-kt-key")) return; const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); addKey(ti, snapMs(((e.clientX - r.left) / r.width) * D.peek(), e.altKey)); },
      }, spark(ti), tk.keys.map((_, ki) => diamond(ti, ki))))));
  };

  // ------------------------------------------------------------------ inspector
  const inspector = () => {
    const s = selected();
    if (!s) return h("p", { class: "hm-kt-empty" }, () => t`Select a keyframe to edit its time, value and easing. Double-click a lane to add one.`);
    return untrack(() => {
      const tk = get().tracks[s.track], k = tk?.keys[s.key];
      if (!tk || !k) return null;
      const [lo, hi] = M.PROP_RANGE[tk.prop];
      return h("div", { class: "hm-kt-inspector", role: "group", "aria-label": () => t`Keyframe ${s.key + 1} of ${tk.target} ${tk.prop}` },
        h("div", { class: "hm-kt-fields" },
          h("label", { class: "hm-kt-field" }, h("span", null, () => t`Time (ms)`), h("input", { type: "number", class: "hm-input", min: "0", max: () => String(D()), step: () => String(props.snap || 10), value: () => String(get().tracks[s.track]?.keys[s.key]?.at ?? 0), readonly: () => !!props.readonly, onInput: (e: Event) => { const n = Number((e.target as HTMLInputElement).value); if (Number.isFinite(n)) setKey(s.track, s.key, { at: clamp(n, 0, D.peek()) }); } })),
          h("label", { class: "hm-kt-field" }, h("span", null, () => `${t`Value`} (${tk.prop}${M.PROP_UNIT[tk.prop] ? `, ${M.PROP_UNIT[tk.prop]}` : ""})`), h("input", { type: "number", class: "hm-input", min: String(lo), max: String(hi), step: tk.prop === "opacity" || tk.prop === "scale" ? "0.05" : "1", value: () => String(get().tracks[s.track]?.keys[s.key]?.value ?? 0), readonly: () => !!props.readonly, onInput: (e: Event) => { const n = Number((e.target as HTMLInputElement).value); if (Number.isFinite(n)) setKey(s.track, s.key, { value: clamp(n, lo, hi) }); } })),
          ro() ? null : h(IconButton, { icon: glyph(trash), label: () => t`Delete keyframe`, size: "sm", variant: "danger", disabled: () => (get().tracks[s.track]?.keys.length ?? 0) <= 1, onClick: () => removeKey(s.track, s.key) })),
        h(EasingCurveEditor, { value: k.easing ?? "in-out", onChange: (v: string) => setKey(s.track, s.key, { easing: v }), preview: "none", duration: 600, readonly: props.readonly, class: "hm-kt-ease", "aria-label": t`Easing into this keyframe` }));
    });
  };

  // ------------------------------------------------------------------ stage and transport
  const stage = () => (props.stage === false ? null : h("div", { class: "hm-kt-stage", "aria-hidden": "true" }, () => targets().map((name, i) => {
    const el = (props.renderTarget?.(name) ?? h("div", { class: "hm-kt-target" }, name)) as HTMLElement;
    el.classList.add("hm-kt-actor");
    el.setAttribute("data-hm-color", BRAND[i % 4]!);
    targetEls.set(name, el);
    queueMicrotask(() => paint(now.peek()));
    return el;
  })));
  const transport = h("div", { class: "hm-kt-transport", role: "toolbar", "aria-label": () => t`Playback` },
    h(IconButton, { label: () => (playing() ? t`Pause` : t`Play`), class: "hm-kt-play", "aria-keyshortcuts": "Space", onClick: toggle, children: () => glyph(playing() ? pauseIcon : playIcon) }),
    h(IconButton, { icon: glyph(skipBack), label: () => t`Back to start`, size: "sm", onClick: () => seek(0) }),
    h(IconButton, { icon: glyph(repeat), label: () => t`Loop`, size: "sm", class: () => cx("hm-kt-loop", loop() && "is-on"), "aria-pressed": () => String(loop()), onClick: () => loop.set(!loop.peek()) }),
    h("span", { class: "hm-kt-time", "aria-live": "off" }, h("b", null, () => fmt(now())), " / ", () => fmt(D())),
    h(Segmented, { class: "hm-kt-speed", "aria-label": t`Speed`, options: SPEEDS.map((s) => ({ value: s, label: `${s}×` })), value: 1, onChange: (s: number | null) => { if (s) speed.set(s); } }));

  return h("div", {
    class: () => cx("hm-kt", playing() && "is-playing", ro() && "is-readonly", val(props.class)), role: "group", "aria-label": () => c["aria-label"]() ?? t`Keyframe timeline`, id,
    ref: (el: HTMLElement) => { root = el; },
    onKeyDown: (e: KeyboardEvent) => { if (e.key === " " && !(e.target as Element).closest("input, textarea, button, [role=slider]")) { e.preventDefault(); toggle(); } },
  },
  stage,
  transport,
  h("div", { class: "hm-kt-grid" },
    h("div", { class: "hm-kt-corner" }),
    h("div", { class: "hm-kt-ruler-wrap" }, ruler, head),
    h("div", { class: "hm-kt-rows" }, lanes, h("div", { class: "hm-kt-playline", "aria-hidden": "true" }))),
  inspector);
}
