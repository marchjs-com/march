// The clock dial of TimeInput's clock picker (picker="clock"): pick the hour on a clock face, then the minutes, by
// pointer (press or drag) or keyboard (a slider: arrows, Page Up / Down, Home / End, Enter). 24-hour clocks have two
// rings (1–12 outside, 13–00 inside); 12-hour clocks one ring and an AM / PM switch. Part of TimeInput's folder.
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type MaybeFn } from "../../../ui/util.ts";

export interface ClockDialLabels { hours?: string | undefined; minutes?: string | undefined }
export interface ClockDialProps {
  /** "HH:MM" (seconds after it are kept) or "". */
  value: MaybeFn<string>;
  /** Called with the new "HH:MM" on every change. */
  onChange: (v: string) => void;
  /** The minute was picked (pointer up or Enter on the minutes): the picker closes. */
  onDone?: (() => void) | undefined;
  hour12: boolean;
  /** Minute step of the dial (default 1). */
  minuteStep?: number | undefined;
  min?: string | null | undefined;
  max?: string | null | undefined;
  /** AM / PM texts. */
  periods: readonly [string, string];
  labels?: ClockDialLabels | undefined;
}

const pad = (n: number): string => String(n).padStart(2, "0");
const parse = (v: string): { h: number; m: number; rest: string } | null => {
  const x = /^(\d{1,2}):(\d{2})(.*)$/.exec(v ?? "");
  return x ? { h: Math.min(23, +x[1]!), m: Math.min(59, +x[2]!), rest: x[3] ?? "" } : null;
};
const mins = (v: string | null | undefined): number | null => { const p = v ? parse(v) : null; return p ? p.h * 60 + p.m : null; };

export function ClockDial(props: ClockDialProps): Element {
  const mode = signal<"h" | "m">("h");
  const cur = computed(() => parse(val(props.value) ?? ""));
  const step = (): number => Math.max(1, Math.round(props.minuteStep ?? 1));
  const lo = (): number | null => mins(props.min), hi = (): number | null => mins(props.max);
  const okHour = (hh: number): boolean => { const a = lo(), b = hi(); return (a == null || hh * 60 + 59 >= a) && (b == null || hh * 60 <= b); };
  const okMinute = (hh: number, mm: number): boolean => { const x = hh * 60 + mm, a = lo(), b = hi(); return (a == null || x >= a) && (b == null || x <= b); };
  const write = (hh: number, mm: number): void => {
    const p = untrack(cur);
    props.onChange(`${pad(hh)}:${pad(mm)}${p?.rest ?? ""}`);
  };
  const setHour = (hh: number): void => {
    if (!okHour(hh)) return;
    let mm = untrack(cur)?.m ?? 0;
    // keep the minute inside the range of the new hour
    if (!okMinute(hh, mm)) { const a = lo(), b = hi(); mm = a != null && hh * 60 + mm < a ? a % 60 : b != null ? b % 60 : 0; }
    write(hh, mm);
  };
  const setMinute = (mm: number): void => {
    const hh = untrack(cur)?.h ?? 0;
    if (okMinute(hh, mm)) write(hh, mm);
  };
  const pm = (): boolean => (cur()?.h ?? 0) >= 12;
  const setPeriod = (on: boolean): void => {
    const p = untrack(cur);
    if (!p) { setHour(on ? 12 : 0); return; }
    if (on !== p.h >= 12) setHour((p.h + 12) % 24);
  };

  // the face: numbers placed by angle, a hand to the chosen one
  const face = h("div", {
    class: () => cx("m-clock-face", mode() === "m" && "is-minutes"), tabindex: "0", role: "slider",
    "aria-label": () => (mode() === "h" ? props.labels?.hours ?? t`Hours` : props.labels?.minutes ?? t`Minutes`),
    "aria-valuemin": "0", "aria-valuemax": () => (mode() === "h" ? "23" : "59"),
    "aria-valuenow": () => { const p = cur(); return p ? String(mode() === "h" ? p.h : p.m) : null; },
    "aria-valuetext": () => { const p = cur(); return p ? `${pad(p.h)}:${pad(p.m)}` : null; },
  }) as HTMLElement;
  const hand = h("span", { class: "m-clock-hand", "aria-hidden": "true" }) as HTMLElement;
  face.append(hand, h("span", { class: "m-clock-center", "aria-hidden": "true" }));
  const place = (el: HTMLElement, angle: number, ring: "outer" | "inner"): HTMLElement => {
    el.style.setProperty("--m-clock-a", `${angle}deg`);
    el.classList.toggle("is-inner", ring === "inner");
    return el;
  };
  const num = (text: string, angle: number, ring: "outer" | "inner", on: () => boolean, off: () => boolean): Element =>
    place(h("span", { class: () => cx("m-clock-num", on() && "is-on", off() && "is-off"), "aria-hidden": "true" }, text) as HTMLElement, angle, ring);
  const hourNums = (): Element[] => {
    const out: Element[] = [];
    for (let i = 0; i < 12; i++) {
      const outer = props.hour12 ? i : i === 0 ? 12 : i;
      if (props.hour12) {
        const label = i === 0 ? 12 : i;
        const hh = (i % 12) + (untrack(pm) ? 12 : 0);
        out.push(num(String(label), i * 30, "outer", () => cur()?.h === hh, () => !okHour(hh)));
      } else {
        const inner = i === 0 ? 0 : i + 12;
        out.push(num(String(outer), i * 30, "outer", () => cur()?.h === outer, () => !okHour(outer)));
        out.push(num(pad(inner), i * 30, "inner", () => cur()?.h === inner, () => !okHour(inner)));
      }
    }
    return out;
  };
  const minuteNums = (): Element[] => Array.from({ length: 12 }, (_, i) => num(pad(i * 5), i * 30, "outer", () => cur()?.m === i * 5, () => !okMinute(cur()?.h ?? 0, i * 5)));
  const nums = h("div", { class: "m-clock-nums" }, () => { void pm(); return mode() === "h" ? hourNums() : minuteNums(); });
  face.append(nums);
  // the hand follows the value (angle and ring); hidden while there is none
  const paintHand = (): void => {
    const p = cur(), m = mode();
    hand.hidden = !p;
    if (!p) return;
    const inner = m === "h" && !props.hour12 && (p.h === 0 || p.h > 12);
    hand.style.setProperty("--m-clock-a", `${m === "h" ? (p.h % 12) * 30 : p.m * 6}deg`);
    hand.classList.toggle("is-inner", inner);
    hand.classList.toggle("is-between", m === "m" && p.m % 5 !== 0);
  };
  effect(paintHand);

  // pointer: press or drag on the face picks; lifting after the hours turns to the minutes, after the minutes it is done
  const pick = (e: PointerEvent): void => {
    const r = face.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const angle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, dist = Math.hypot(dx, dy) / (r.width / 2);
    if (untrack(mode) === "h") {
      const i = Math.round(angle / 30) % 12;
      if (props.hour12) setHour((i % 12) + (untrack(pm) ? 12 : 0));
      else setHour(dist < 0.62 ? (i === 0 ? 0 : i + 12) : (i === 0 ? 12 : i));
    } else {
      const s = step();
      setMinute((Math.round(angle / 6 / s) * s) % 60);
    }
  };
  face.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    face.focus();
    face.setPointerCapture?.(e.pointerId);
    pick(e);
    const move = (ev: PointerEvent): void => pick(ev);
    const up = (): void => {
      face.removeEventListener("pointermove", move); face.removeEventListener("pointerup", up); face.removeEventListener("pointercancel", up);
      if (untrack(mode) === "h") mode.set("m"); else props.onDone?.();
    };
    face.addEventListener("pointermove", move); face.addEventListener("pointerup", up); face.addEventListener("pointercancel", up);
  });
  // keyboard: a slider for the hours, then for the minutes
  face.addEventListener("keydown", (e) => {
    const p = untrack(cur) ?? { h: 0, m: 0, rest: "" };
    const hrs = untrack(mode) === "h", s = step();
    const by = (n: number): void => { if (hrs) setHour((p.h + n + 24) % 24); else setMinute(((Math.round(p.m / s) * s + n * s) % 60 + 60) % 60); };
    switch (e.key) {
      case "ArrowUp": case "ArrowRight": by(1); break;
      case "ArrowDown": case "ArrowLeft": by(-1); break;
      case "PageUp": by(hrs ? 3 : Math.max(1, Math.round(5 / s))); break;
      case "PageDown": by(hrs ? -3 : -Math.max(1, Math.round(5 / s))); break;
      case "Home": if (hrs) setHour(0); else setMinute(0); break;
      case "End": if (hrs) setHour(23); else setMinute(60 - s); break;
      case "Enter": case " ": if (hrs) mode.set("m"); else props.onDone?.(); break;
      default: return;
    }
    e.preventDefault();
  });

  // the head: the chosen time, its hour and minute parts switch the face; AM / PM on a 12-hour clock
  const part = (which: "h" | "m", text: () => string): Element => h("button", {
    type: "button", class: () => cx("m-clock-part", mode() === which && "is-on"), "aria-pressed": () => String(mode() === which),
    "aria-label": () => (which === "h" ? props.labels?.hours ?? t`Hours` : props.labels?.minutes ?? t`Minutes`),
    onClick: () => { mode.set(which); face.focus(); },
  }, text);
  const shownHour = (): string => { const p = cur(); if (!p) return "--"; return props.hour12 ? String(p.h % 12 === 0 ? 12 : p.h % 12) : pad(p.h); };
  const period = (on: boolean): Element => h("button", {
    type: "button", class: () => cx("m-clock-period", cur() && pm() === on && "is-on"), "aria-pressed": () => String(!!cur() && pm() === on),
    onClick: () => setPeriod(on),
  }, props.periods[on ? 1 : 0]);
  return h("div", { class: "m-clock" },
    h("div", { class: "m-clock-head" },
      part("h", shownHour), h("span", { class: "m-clock-colon", "aria-hidden": "true" }, ":"), part("m", () => { const p = cur(); return p ? pad(p.m) : "--"; }),
      props.hour12 ? h("div", { class: "m-clock-periods", role: "group" }, period(false), period(true)) : null),
    face);
}
