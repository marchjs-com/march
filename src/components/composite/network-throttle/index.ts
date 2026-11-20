// NetworkThrottle (march-network-throttle): a network speed panel as in the browsers' developer tools, for the page or
// only for a part of it (a `scope`: a preview drawn into the page). Ready-made networks (offline, slow 3G, fast 3G, 4G,
// Wi-Fi, no limit), your own incoming / outgoing bandwidth and latency, a gauge whose needle follows the speed, and the
// requests it slowed as a live waterfall. fetch(), XMLHttpRequest and module loads are throttled (see engine.ts).
//   <NetworkThrottle />                                   // the whole page while it is shown
//   <NetworkThrottle scope={(stack) => /blob:/.test(stack)} requests={false} />
import "./network-throttle.css";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { signal, onCleanup, untrack, type Signal } from "../../../core/reactive.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { track } from "../../../motion/engine/value.ts";
import type { CallScope } from "../../../ui/call-scope.ts";
import { Chip } from "../../actions/chip/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Slider } from "../../forms/slider/index.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import type { Handler } from "../../../core/util.ts";
import { NET_PRESETS, getThrottle, setThrottle, setThrottleScope, getThrottleScope, presetOf, onThrottle, throttleRequests, clearThrottleRequests, installThrottle, throttled,
  type NetProfile, type NetPreset, type NetRequest } from "./engine.ts";

export { NET_PRESETS, setThrottle, getThrottle, setThrottleScope, installThrottle, onThrottle, throttleRequests, clearThrottleRequests, throttledFetch, throttledImport, throttledLoad, throttleBypass,
  type NetProfile, type NetPreset, type NetRequest, type NetKind } from "./engine.ts";

messages("tr", {
  "Network speed": "Ağ hızı", "Your own": "Özel", "Incoming": "Gelen", "Outgoing": "Giden", "Latency": "Gecikme", "No limit": "Limit yok",
  "Offline": "Çevrimdışı", "Requests": "İstekler", "Clear the requests": "İstekleri temizle", "Nothing loaded yet": "Henüz bir şey yüklenmedi",
  "Networks": "Ağlar",
});

export interface NetworkThrottleProps {
  /** Only the calls in this scope are throttled (default: the whole page). @tr Yalnız bu kapsamdaki çağrılar yavaşlar (varsayılan: bütün sayfa). */
  scope?: CallScope | undefined;
  /** The network, kept in a signal of yours too (two-way). @tr Ağ, senin bir sinyalinde de tutulur (iki yönlü). */
  value?: Signal<NetProfile> | undefined;
  /** Called with the new network. @tr Yeni ağla çağrılır. */
  onChange?: Handler<[p: NetProfile]> | undefined;
  /** The ready-made networks (default NET_PRESETS). @tr Hazır ağlar (varsayılan NET_PRESETS). */
  presets?: MaybeFn<readonly NetPreset[] | undefined>;
  /** The speed gauge (default true). @tr Hız göstergesi (varsayılan true). */
  gauge?: MaybeFn<boolean | undefined>;
  /** Your own bandwidths and latency (default true). @tr Kendi bant genişliklerin ve gecikmen (varsayılan true). */
  custom?: MaybeFn<boolean | undefined>;
  /** The requests it slowed, as a waterfall (default true). @tr Yavaşlattığı istekler, şelale olarak (varsayılan true). */
  requests?: MaybeFn<boolean | undefined>;
  /** How many requests the waterfall shows (default 8). @tr Şelalenin gösterdiği istek sayısı (varsayılan 8). */
  max?: MaybeFn<number | undefined>;
  /** Accessible name (default "Network speed"). @tr Erişilebilir ad (varsayılan "Network speed"). */
  label?: MaybeFn<string | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** "1.4 Mb/s", "400 kb/s", or "∞". */
export const formatSpeed = (kbps: number | null | undefined): string => (kbps == null || kbps <= 0 ? "∞" : kbps >= 1000 ? `${(kbps / 1000).toFixed(kbps >= 10_000 ? 0 : 1)} Mb/s` : `${Math.round(kbps)} kb/s`);
const formatBytes = (b: number): string => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : b >= 1000 ? `${(b / 1000).toFixed(1)} kB` : `${b} B`);
/** A short name of the network now ("Hızlı 3G", "1.2 Mb/s · 300 ms", "Çevrimdışı", "Kısıtsız"). */
export function throttleLabel(p: NetProfile = getThrottle()): string {
  const pre = presetOf(p);
  if (pre) return pre.id === "offline" ? t`Offline` : pre.label;
  return `${formatSpeed(p.down)} · ${p.latency ?? 0} ms`;
}
// the bandwidth sliders: 0–100 on a log scale from 20 kb/s to 100 Mb/s; 100 is "no limit"
const toKbps = (v: number): number | null => (v >= 100 ? null : Math.round(20 * Math.pow(5000, v / 100)));
const fromKbps = (k: number | null | undefined): number => (k == null || k <= 0 ? 100 : Math.max(0, Math.min(99, (Math.log(k / 20) / Math.log(5000)) * 100)));

/** The network speed panel (see the module comment). */
export function NetworkThrottle(props: NetworkThrottleProps): Element {
  // the scope is shared by the window: the one before this panel comes back when it goes
  if (props.scope !== undefined) { const before = getThrottleScope(); setThrottleScope(props.scope ?? null); onCleanup(() => setThrottleScope(before)); }
  onCleanup(installThrottle());
  const prof = signal<NetProfile>(getThrottle()), reqs = signal<readonly NetRequest[]>(throttleRequests());
  // at most every 40 ms; while a request is on its way (waiting its latency: no event comes) every 200 ms, so its bar grows
  let queued: ReturnType<typeof setTimeout> | undefined, gone = false;
  const pull = (ms: number): void => {
    if (queued || gone) return;
    queued = setTimeout(() => {
      queued = undefined; prof.set(getThrottle()); reqs.set(throttleRequests());
      if (reqs.peek().some((r) => r.end == null && performance.now() - r.start < 60_000)) pull(200);
    }, ms);
  };
  onCleanup(onThrottle(() => pull(40)));
  onCleanup(() => { gone = true; clearTimeout(queued); });
  if (props.value) { const v0 = untrack(props.value); if (throttled(v0) || throttled()) setThrottle(v0); }
  const set = (p: NetProfile): void => { setThrottle(p); prof.set(getThrottle()); props.value?.set(p); props.onChange?.(p); };
  const presets = (): readonly NetPreset[] => val(props.presets) ?? NET_PRESETS;
  const current = (): NetPreset | null => presetOf(prof());

  // the gauge: the needle springs to the incoming speed (log scale; no limit is the end, offline the start)
  const pos = (): number => { const p = prof(); return p.offline ? 0 : fromKbps(p.down) / 100; };
  const needle = track(pos, { spring: { stiffness: 140, damping: 14 } });
  const R = 46, arc = Math.PI * R;
  const gauge = (): Element => h("div", { class: () => cx("m-nt-gauge", prof().offline && "is-off") },
    h("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 120 70", "aria-hidden": "true" },
      h("path", { class: "m-nt-track", d: `M14 62 A${R} ${R} 0 0 1 106 62` }),
      h("path", { class: "m-nt-fill", d: `M14 62 A${R} ${R} 0 0 1 106 62`, "stroke-dasharray": `${arc}`, "stroke-dashoffset": () => String(arc * (1 - Math.max(0, Math.min(1, needle())))) }),
      h("g", { class: "m-nt-needle", style: () => ({ transform: `rotate(${-90 + 180 * Math.max(0, Math.min(1, needle()))}deg)` }) }, h("path", { d: "M60 62 L60 24" }), h("circle", { cx: "60", cy: "62", r: "4.5" }))),
    h("div", { class: "m-nt-read" },
      h("strong", {}, () => (prof().offline ? t`Offline` : formatSpeed(prof().down))),
      h("span", {}, () => (prof().offline ? "—" : `↑ ${formatSpeed(prof().up)} · ${prof().latency ?? 0} ms`))));

  const row = (lbl: () => string, get: () => number, put: (v: number) => void, max: number, format: (v: number) => string): Element => h("div", { class: "m-nt-row" },
    h("span", { class: "m-nt-row-label" }, lbl),
    h(Slider, { min: 0, max, step: 1, "aria-label": untrack(lbl), get value() { return get(); }, onChange: put, format, valueText: format, showValue: true }));
  const custom = (): Element => h("div", { class: "m-nt-custom" },
    row(() => t`Incoming`, () => fromKbps(prof().down), (v) => set({ ...prof.peek(), offline: false, down: toKbps(v) }), 100, (v) => (v >= 100 ? t`No limit` : formatSpeed(toKbps(v)))),
    row(() => t`Outgoing`, () => fromKbps(prof().up), (v) => set({ ...prof.peek(), offline: false, up: toKbps(v) }), 100, (v) => (v >= 100 ? t`No limit` : formatSpeed(toKbps(v)))),
    row(() => t`Latency`, () => prof().latency ?? 0, (v) => set({ ...prof.peek(), offline: false, latency: v }), 3000, (v) => `${v} ms`));

  // the waterfall: each request's wait (latency, upload) and its download on one time line
  const shownReqs = (): readonly NetRequest[] => reqs().slice(-(val(props.max) ?? 8)).reverse();
  const waterfall = (): Element => h("div", { class: "m-nt-log" },
    h(SectionLabel, { size: "sm", label: () => t`Requests`, count: () => reqs().length || null,
      actions: () => (reqs().length ? untrack(() => h(IconButton, { icon: trash, size: "xs", variant: "ghost", label: () => t`Clear the requests`, onClick: clearThrottleRequests })) : null) }),
    () => {
      const rs = shownReqs();
      if (!rs.length) return untrack(() => h(Empty, { size: "sm", title: () => t`Nothing loaded yet` }));
      const now = performance.now(), t0 = Math.min(...rs.map((r) => r.start)), t1 = Math.max(now - t0 > 30_000 ? 0 : now, ...rs.map((r) => r.end ?? now)), span = Math.max(1, t1 - t0);
      const pc = (v: number): string => `${((v - t0) / span) * 100}%`;
      return untrack(() => rs.map((r) => {
        const name = r.url.replace(/[?#].*$/, "").split("/").filter(Boolean).pop() ?? r.url;
        const first = r.first ?? r.end ?? now, end = r.end ?? now;
        return h("div", { class: cx("m-nt-req", r.error && "is-error", r.end == null && "is-live"), title: r.url },
          h("span", { class: "m-nt-req-name" }, h("b", {}, r.method === "GET" ? r.kind : r.method), name),
          h("span", { class: "m-nt-req-meta" }, r.error ? String(r.status ?? "✕") : `${formatBytes(r.bytes)} · ${Math.round(end - r.start)} ms`),
          h("span", { class: "m-nt-req-bar", "aria-hidden": "true" },
            h("i", { class: "is-wait", style: { insetInlineStart: pc(r.start), inlineSize: `calc(${pc(first)} - ${pc(r.start)})` } }),
            h("i", { class: "is-recv", style: { insetInlineStart: pc(first), inlineSize: `max(2px, calc(${pc(end)} - ${pc(first)}))` } })));
      }));
    });

  return h("div", { class: () => cx("m-nt", throttled(prof()) && "is-on", val(props.class)), role: "group", "aria-label": () => val(props.label) ?? t`Network speed` },
    () => (val(props.gauge) === false ? null : untrack(gauge)),
    h("div", { class: "m-nt-presets", role: "group", "aria-label": () => t`Networks` },
      () => untrack(() => [...presets().map((p) => h(Chip, { size: "sm", selected: () => current()?.id === p.id, onClick: () => set({ ...p.profile }), tone: p.profile.offline ? "danger" : "neutral" }, p.id === "offline" ? t`Offline` : p.label)),
        h(Chip, { size: "sm", selected: () => !current(), onClick: () => { if (current()) set({ down: 2000, up: 750, latency: 150 }); } }, () => t`Your own`)])),
    () => (val(props.custom) === false ? null : untrack(custom)),
    () => (val(props.requests) === false ? null : untrack(waterfall)));
}
