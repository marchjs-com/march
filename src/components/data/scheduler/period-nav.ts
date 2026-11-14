// PeriodNav: previous · today · next — the group a calendar steps its period with (the Scheduler bar; the month
// arrows of a date picker are the same pair without the middle button). Built from ButtonGroup, IconButton and Button;
// the arrows swap in right-to-left, every text and both icons are yours.
import { h } from "../../../dom/h.ts";
import { t, dir } from "../../../core/i18n.ts";
import { val, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { ButtonGroup } from "../../actions/button-group/index.ts";
import { chevronLeft } from "../../../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";

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
  /** Shows the middle button ("Today") and runs on it. */
  onToday?: (() => void) | undefined;
  /** Right-to-left: the arrows swap (default: the direction of the app). */
  rtl?: MaybeFn<boolean | undefined>;
  labels?: PeriodNavLabels | undefined;
  /** Own icon of the previous / next button (drawn as given: no swap in right-to-left). */
  prevIcon?: unknown;
  nextIcon?: unknown;
  /** Buttons joined into one control (default true). */
  attached?: boolean | undefined;
  class?: ClassProp;
  /** Between the arrows instead of the today button (a title). */
  children?: unknown;
}

/** `<PeriodNav onPrev={() => shift(-1)} onNext={() => shift(1)} onToday={() => go(today)} />` */
export function PeriodNav(props: PeriodNavProps): Element {
  const rtl = (): boolean => val(props.rtl) ?? dir() === "rtl";
  const L = props.labels ?? {};
  const arrow = (n: -1 | 1): unknown => h(IconButton, {
    icon: (n < 0 ? props.prevIcon : props.nextIcon) ?? (() => ((n < 0) !== rtl() ? chevronLeft : chevronRight)),
    label: () => val(n < 0 ? L.previous : L.next) ?? (n < 0 ? t`Previous` : t`Next`), variant: "ghost", onClick: n < 0 ? props.onPrev : props.onNext,
  });
  return h(ButtonGroup, { label: () => val(L.group) ?? t`Period`, attached: props.attached ?? true, class: props.class },
    arrow(-1),
    props.children ?? (props.onToday ? h(Button, { variant: "secondary", size: "sm", onClick: props.onToday }, () => val(L.today) ?? t`Today`) : null),
    arrow(1)) as Element;
}
