// TimeInput: the native time field; value "HH:MM". With picker="clock" a clock button opens a clock dial (the hour
// on a clock face, then the minutes), as on Android.
import "./time-input.css";
import "../../../ui/field.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { model, ctl, cx, live, syncValue, type ControlProps } from "../../../forms/util.ts";
import { ownPart } from "../../../ui/parts.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Popover } from "../../overlays/popover/index.ts";
import { clock as clockIcon } from "../../../icons/glyphs/clock.ts";
import type { IconProp } from "../../../icons/types.ts";
import { ClockDial } from "./dial.ts";
import { locked } from "../../../ui/behave.ts";

export interface TimeInputProps extends ControlProps<string> {
  /** Earliest allowed time ("HH:MM"). @tr İzin verilen en erken saat ("HH:MM"). */
  min?: string | null | undefined;
  /** Latest allowed time ("HH:MM"). @tr İzin verilen en geç saat ("HH:MM"). */
  max?: string | null | undefined;
  /** Seconds. @tr Adım, saniye. */
  step?: number | null | undefined;
  /** "native" (default): the browser's time field; "clock": the field and a clock button that opens a clock dial (hour, then minutes). @tr "native" (varsayılan): tarayıcının saat alanı; "clock": alan ve saat kadranı açan bir saat düğmesi (önce saat, sonra dakika). */
  picker?: "native" | "clock" | undefined;
  /** The dial as a 12-hour clock with AM / PM (default: from the locale). @tr Kadranı ÖÖ / ÖS ile 12 saatlik gösterir (varsayılan: dile göre). */
  hour12?: boolean | undefined;
  /** Locale of the dial's clock (12 or 24 hours, AM / PM texts; default: the app locale). @tr Kadranın saat düzeni (12 ya da 24 saat, ÖÖ / ÖS metinleri; varsayılan: uygulamanın dili). */
  locale?: string | undefined;
  /** The clock button: a node / text / `() => node` replaces its icon. @tr Saat düğmesi: düğüm / metin / `() => node` ikonun yerine geçer. */
  icon?: IconProp;
  /** Accessible names: `choose` (the button and the dial, default "Choose time"), `hours`, `minutes`. @tr Erişilebilir adlar: `choose` (düğme ve kadran, varsayılan "Choose time"), `hours`, `minutes`. */
  labels?: { choose?: string | undefined; hours?: string | undefined; minutes?: string | undefined } | undefined;
}

/** Does a locale write the time on a 12-hour clock? */
const twelve = (loc: string): boolean => { const c = new Intl.DateTimeFormat(loc, { hour: "numeric" }).resolvedOptions().hourCycle; return c === "h11" || c === "h12"; };
/** AM / PM in a locale. */
const periods = (loc: string): [string, string] => {
  const f = new Intl.DateTimeFormat(loc, { hour: "numeric", hour12: true });
  const at = (h: number): string => f.formatToParts(new Date(2001, 0, 1, h)).find((p) => p.type === "dayPeriod")?.value ?? (h < 12 ? "AM" : "PM");
  return [at(9), at(21)];
};

/** Native time input; value "HH:MM". Props: min, max, step (seconds); picker="clock" adds a clock dial. */
export function TimeInput(props: TimeInputProps): unknown {
  const [get, set] = model(props, "");
  const el = h("input", {
    ...ctl(props), type: "time", class: cx("m-input m-time", props.picker !== "clock" && props.class), min: () => props.min ?? null, max: () => props.max ?? null,
    step: () => props.step ?? null, readonly: () => !!props.readonly, onInput: (e: Event) => set((e.target as HTMLInputElement).value),
  }) as HTMLInputElement;
  syncValue(el, get);
  if (props.picker !== "clock") return el;

  // the clock picker: the field, a clock button and the dial in a popover anchored to both
  const open = signal(false);
  const loc = (): string => props.locale ?? locale();
  const choose = (): string => props.labels?.choose ?? t`Choose time`;
  const off = (): boolean => locked(props);
  const btn = h(IconButton, {
    class: "m-time-btn", label: choose, icon: () => ownPart(props.icon, () => clockIcon), "aria-haspopup": "dialog", "aria-expanded": () => String(open()),
    disabled: off, onClick: () => { if (!off()) open.set(!open.peek()); },
  });
  const close = (): void => { open.set(false); el.focus(); };
  el.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" && e.altKey && !off()) { e.preventDefault(); open.set(true); } });
  let wrap!: Element;
  wrap = h("span", { class: () => cx("m-affix m-time-pick", props.class) }, el, btn,
    h(Popover, {
      anchor: () => wrap, open, label: choose, panelClass: "m-clock-pop", autoFocus: false,
      onOpenChange: (on: boolean, why: string) => { if (!on && why === "escape") el.focus(); },
      children: () => {
        const dial = ClockDial({
          value: live(() => get() ?? ""), onChange: (v) => set(v), onDone: close,
          hour12: props.hour12 ?? twelve(loc()), periods: periods(loc()), min: props.min, max: props.max,
          minuteStep: props.step && props.step >= 60 ? props.step / 60 : 1, labels: { hours: props.labels?.hours, minutes: props.labels?.minutes },
        });
        queueMicrotask(() => (dial.querySelector(".m-clock-face") as HTMLElement | null)?.focus());
        return dial;
      },
    }));
  return wrap;
}
