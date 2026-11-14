// PeriodNav (hadi-march/ui): previous · today · next — the group a calendar steps its period with (the Scheduler bar,
// the month arrows of a Calendar with the month name between them). Built from ButtonGroup, IconButton and Button; the
// arrows swap in right-to-left; every text, both icons, the today button and the title are yours.
import "./period-nav.css";
import { h } from "../../../dom/h.ts";
import { t, dir } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownPart } from "../../../ui/parts.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { ButtonGroup } from "../../actions/button-group/index.ts";
import { chevronLeft } from "../../../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { withColor } from "../../../theme/colors.ts";

/** Texts of a PeriodNav (each a string or an accessor). */
export interface PeriodNavLabels {
  /** Accessible name of the group (default "Period"). */
  group?: MaybeFn<string | undefined>;
  previous?: MaybeFn<string | undefined>;
  today?: MaybeFn<string | undefined>;
  next?: MaybeFn<string | undefined>;
}
export interface PeriodNavProps {
  onPrev: () => void;
  onNext: () => void;
  /** Runs on the middle button ("Today"); the button is shown when this is given. */
  onToday?: (() => void) | undefined;
  /** The today button: `false` removes it; a text, a node or `() => node` is its content (default: the `today` label). */
  today?: unknown;
  /** Between the arrows: the name of the period (a text, a node or an accessor). The today button then follows the next arrow. */
  title?: MaybeFn<unknown>;
  /** Same as `title`. */
  children?: unknown;
  labels?: PeriodNavLabels | undefined;
  /** Content of the previous / next button instead of the chevron: an icon, a text, a node or `() => node` (drawn as given: no swap in right-to-left). */
  prevIcon?: unknown;
  nextIcon?: unknown;
  /** `false`: no arrows (the title and the today button stay; keys of the host still move the period). */
  arrows?: boolean | undefined;
  /** The previous / next button is off (the first / last period). */
  prevDisabled?: MaybeFn<boolean | undefined>;
  nextDisabled?: MaybeFn<boolean | undefined>;
  /** Right-to-left: the arrows swap (default: the direction of the app). */
  rtl?: MaybeFn<boolean | undefined>;
  /** Buttons joined into one control (default: true without a title, false with one). */
  attached?: boolean | undefined;
  /** Size of the arrows: sm · md (default). */
  size?: "sm" | "md" | undefined;
  /** An extra class on a part, for a host that keeps its own class names: `{ prev, next, today, title }`. */
  partClass?: Partial<Record<"prev" | "next" | "today" | "title", string>> | undefined;
  class?: ClassProp;
}

/** `<PeriodNav onPrev={() => shift(-1)} onNext={() => shift(1)} onToday={() => go(today)} />`, `<PeriodNav title={$month} onPrev={back} onNext={on} />` */
export function PeriodNav(props: PeriodNavProps): Element {
  const rtl = (): boolean => val(props.rtl) ?? dir() === "rtl";
  const L = props.labels ?? {}, pc = props.partClass ?? {};
  const title = props.title ?? props.children;
  const arrow = (n: -1 | 1): unknown => (props.arrows === false ? null : h(IconButton, {
    class: cx("m-period-nav-arrow", n < 0 ? pc.prev : pc.next), size: props.size,
    icon: () => ownPart(n < 0 ? props.prevIcon : props.nextIcon, () => ((n < 0) !== rtl() ? chevronLeft : chevronRight)),
    label: () => val(n < 0 ? L.previous : L.next) ?? (n < 0 ? t`Previous` : t`Next`),
    disabled: () => !!val(n < 0 ? props.prevDisabled : props.nextDisabled), onClick: n < 0 ? props.onPrev : props.onNext }));
  const today = !props.onToday || props.today === false ? null
    : h(Button, { class: cx("m-period-nav-today", pc.today), variant: "secondary", size: "sm", onClick: props.onToday }, () => ownPart(props.today, () => val(L.today) ?? t`Today`));
  return h(ButtonGroup, { label: () => val(L.group) ?? t`Period`, attached: props.attached ?? title == null, class: () => cx("m-period-nav", title != null && "is-titled", val(props.class)) },
    arrow(-1),
    title == null ? today : h("div", { class: cx("m-period-nav-title", pc.title) }, title),
    arrow(1),
    title == null ? null : today) as Element;
}
