// Pricing (hadi-march/landing): plans side by side with a monthly / yearly switch. Switching morphs every price: the
// digits roll to the new amount (Counter, odometer mode), the "per month" line and the yearly saving cross-fade, and
// the thumb of the switch slides (Segmented, sliding indicator). The featured plan is lifted with a glowing brand border. Plans are Cards in an
// equal-height row; on phones they stack with the featured plan first.
import "./pricing.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, untrack } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { owned } from "../../../ui/observe.ts";
import { Card } from "../../../ui/card.ts";
import { Badge } from "../../../ui/badge.ts";
import { Segmented } from "../../../forms/inputs.ts";
import { CheckMark } from "../../feedback/check-mark/index.ts";
import { minus } from "../../../icons/glyphs/minus.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { still } from "../../../motion/engine/parts.ts";
import { locale } from "../../../core/i18n.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { Counter, formatCount } from "../counter/index.ts";
// Reveal: entries enter one after another
import { revealOnScroll, type RevealOptions } from "../reveal/index.ts";
import { sectionActions, type SectionAction } from "../section-head/index.ts";

export type BillingPeriod = "monthly" | "yearly";
export interface PricingFeature { label: unknown; included?: boolean | undefined; hint?: unknown }
export interface PricingPlan {
  name: unknown;
  description?: unknown;
  /** Price per month for each period (yearly: the monthly equivalent). null = custom ("Contact us"). */
  price: { monthly: number | null; yearly: number | null } | number | null;
  features?: readonly (unknown | PricingFeature)[] | undefined;
  cta?: SectionAction | undefined;
  /** Lifted, with a glowing border and the badge. */
  featured?: boolean | undefined;
  badge?: unknown;
}
export interface PricingProps {
  plans: readonly PricingPlan[];
  /** Current period (default monthly); with `setPeriod` it is controlled (`bind:period`). */
  period?: MaybeFn<BillingPeriod | undefined>;
  setPeriod?: ((p: BillingPeriod) => void) | undefined;
  /** Hide the switch (one period only). */
  toggle?: boolean | undefined;
  /** ISO currency (default EUR). */
  currency?: string | undefined;
  /** Next to "Yearly" ("2 months free"). */
  saving?: MaybeFn<unknown> | undefined;
  /** Colour of the featured plan (border, glow, button, badge). Default: the brand gradient and the accent. */
  color?: ColorToken | undefined;
  /** The mark in front of a feature: true (default: a tick or a dash), false, or `(included) => node`. */
  featureIcon?: boolean | ((included: boolean) => unknown) | undefined;
  /** Colour of the tick of an included feature (default: success). */
  featureColor?: ColorToken | undefined;
  /** The "/ month · billed yearly" lines next to the price (default true). */
  per?: boolean | undefined;
  /** How a price changes with the period: "roll" (odometer, default), "count", or "none" (plain text). */
  priceEffect?: "roll" | "count" | "none" | undefined;
  /** Entrance of the cards: Reveal options, or false for none (default: up, one after another). */
  reveal?: RevealOptions | false | undefined;
  /** Own texts; every one defaults to the built-in translated text. */
  labels?: {
    monthly?: unknown; yearly?: unknown; perMonth?: unknown; billedMonthly?: unknown; billedYearly?: unknown; custom?: unknown;
    /** Accessible name of the switch. */
    billingPeriod?: string | undefined;
    /** Read by screen readers after a feature that is not included. */
    notIncluded?: string | undefined;
  } | undefined;
  class?: ClassProp | undefined;
}

const isFeature = (f: unknown): f is PricingFeature => !!f && typeof f === "object" && "label" in (f as object) && !(f as Node).nodeType;
// Intl currency format (the key is computed so the CSP source check does not read it as an inline style)
const money = (currency: string): Intl.NumberFormatOptions => ({ ["style"]: "currency", currency, maximumFractionDigits: 0 });
const priceOf = (p: PricingPlan, period: BillingPeriod): number | null => (p.price == null || typeof p.price === "number" ? p.price : p.price[period]);

/** `<Pricing plans={[{ name: "Pro", price: { monthly: 29, yearly: 24 }, features: ["…"], cta: { label: "Start" }, featured: true }]} saving="2 months free" />` */
export function Pricing(props: PricingProps): Element {
  const own = signal<BillingPeriod>(untrack(() => val(props.period)) ?? "monthly");
  const period = (): BillingPeriod => (props.setPeriod ? val(props.period) ?? "monthly" : own());
  const setPeriod = (p: BillingPeriod): void => { if (props.setPeriod) props.setPeriod(p); else own.set(p); };
  const cur = props.currency ?? "EUR";
  const L = props.labels ?? {};
  const mark = props.featureIcon;
  // the switch works on its own signal, kept in step with a controlled period
  const sel = signal<BillingPeriod>(untrack(period));
  effect(() => { const p = period(); if (sel.peek() !== p) sel.set(p); });

  const toggle = props.toggle === false ? null : h("div", { class: "m-price-switch" },
    h(Segmented, { indicator: "slide" as const, value: sel, options: [{ value: "monthly", label: L.monthly ?? t`Monthly` }, { value: "yearly", label: L.yearly ?? t`Yearly` }] as never, onChange: (v: unknown) => setPeriod(v as BillingPeriod), "aria-label": L.billingPeriod ?? t`Billing period`, class: "m-price-seg" }),
    props.saving != null && h(Badge, { tone: "success", class: () => cx("m-price-saving", period() === "yearly" && "is-on") }, () => val(props.saving)));

  const cards = props.plans.map((p) => {
    const amount = (): number => priceOf(p, period()) ?? 0;
    const custom = priceOf(p, "monthly") == null && priceOf(p, "yearly") == null;
    const feats = (p.features ?? []).map((f) => {
      const x = isFeature(f) ? f : { label: f, included: true };
      return h("li", { class: cx("m-price-feat", x.included === false && "is-off") },
        mark === false ? null
          : typeof mark === "function" ? h("span", { class: "m-price-feat-own", "aria-hidden": "true" }, mark(x.included !== false))
          // a tick on a soft disc, or a dash for a feature the plan does not have (the line itself says "not included")
          : h(CheckMark, { class: "m-price-feat-icon", variant: "soft", size: "sm", label: false, value: x.included !== false, icons: { no: minus }, color: x.included === false ? undefined : props.featureColor }),
        h("span", {}, x.label, x.included === false ? h("span", { class: "m-sr-only" }, ` (${L.notIncluded ?? t`not included`})`) : null),
        x.hint != null ? h("span", { class: "m-price-feat-hint" }, x.hint) : null);
    });
    return h(Card, { as: "article", class: cx("m-price-card", p.featured && "is-featured") },
      h("header", { class: "m-price-head" },
        h("h3", { class: "m-price-name" }, p.name),
        p.featured && p.badge != null ? h(Badge, { tone: "primary", class: "m-price-badge" }, p.badge) : null),
      p.description != null && h("p", { class: "m-price-desc" }, p.description),
      h("div", { class: "m-price-amount" },
        custom ? h("span", { class: "m-price-custom" }, L.custom ?? t`Custom`)
          : [props.priceEffect === "none" ? h("span", { class: "m-price-num m-price-plain" }, () => formatCount(amount(), { format: money(cur) }, locale()))
            : h(Counter, { value: amount, mode: props.priceEffect ?? "roll", start: "now", format: money(cur), class: "m-price-num" }),
            props.per !== false ? h("span", { class: "m-price-per" }, h("span", {}, L.perMonth ?? t`/ month`), h("span", { class: "m-price-billed" }, () => (period() === "yearly" ? L.billedYearly ?? t`billed yearly` : L.billedMonthly ?? t`billed monthly`))) : null]),
      p.cta ? h("div", { class: "m-price-cta" }, sectionActions([{ variant: p.featured ? "primary" : "secondary", ...p.cta }], "md")) : null,
      feats.length ? h("ul", { class: "m-price-feats" }, feats) : null) as HTMLElement;
  });
  const row = h("div", { class: "m-price-row" }, cards) as HTMLElement;
  const root = h("div", { class: cx("m-pricing", val(props.class)), "data-m-color": colorAttr(props.color) }, toggle, row) as HTMLElement;

  // on a period change the "billed" lines cross-fade (the thumb of the switch is Segmented's own sliding indicator)
  let first = true;
  effect(() => {
    period();
    if (first) { first = false; return; }
    untrack(() => { if (!still()) for (const b of root.querySelectorAll<HTMLElement>(".m-price-billed")) animate(b, { opacity: [0, 1], transform: ["translateY(6px)", "translateY(0px)"] }, { duration: 320, easing: "out" }); });
  });
  if (props.reveal !== false) owned(revealOnScroll(row, { effect: "up", stagger: 90, ...props.reveal, select: ".m-price-card" }));
  return root;
}
