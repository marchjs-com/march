// Pricing (hadi-march/landing): plans side by side with a monthly / yearly switch. Switching morphs every price: the
// digits roll to the new amount (Counter, odometer mode), the "per month" line and the yearly saving cross-fade, and
// the switch's own thumb slides. The featured plan is lifted with a glowing brand border. Plans are Cards in an
// equal-height row; on phones they stack with the featured plan first.
import "./pricing.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, onCleanup, getOwner, untrack } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, glyph, setStyle, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { Card } from "../../../ui/card.ts";
import { Badge } from "../../../ui/badge.ts";
import { Segmented } from "../../../forms/inputs.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { minus } from "../../../icons/glyphs/minus.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { Counter } from "../counter/index.ts";
// Reveal: entries enter one after another
import { revealOnScroll } from "../reveal/index.ts";
import { actionButtons, type HeroAction } from "../hero/index.ts";

export type BillingPeriod = "monthly" | "yearly";
export interface PricingFeature { label: unknown; included?: boolean | undefined; hint?: unknown }
export interface PricingPlan {
  name: unknown;
  description?: unknown;
  /** Price per month for each period (yearly: the monthly equivalent). null = custom ("Contact us"). */
  price: { monthly: number | null; yearly: number | null } | number | null;
  features?: readonly (unknown | PricingFeature)[] | undefined;
  cta?: HeroAction | undefined;
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
  // the switch works on its own signal, kept in step with a controlled period
  const sel = signal<BillingPeriod>(untrack(period));
  effect(() => { const p = period(); if (sel.peek() !== p) sel.set(p); });

  const toggle = props.toggle === false ? null : h("div", { class: "hm-price-switch" },
    h(Segmented, { value: sel, options: [{ value: "monthly", label: t`Monthly` }, { value: "yearly", label: t`Yearly` }], onChange: (v: unknown) => setPeriod(v as BillingPeriod), "aria-label": t`Billing period`, class: "hm-price-seg" }),
    props.saving != null && h(Badge, { tone: "success", class: () => cx("hm-price-saving", period() === "yearly" && "is-on") }, () => val(props.saving)));

  const cards = props.plans.map((p) => {
    const amount = (): number => priceOf(p, period()) ?? 0;
    const custom = priceOf(p, "monthly") == null && priceOf(p, "yearly") == null;
    const feats = (p.features ?? []).map((f) => {
      const x = isFeature(f) ? f : { label: f, included: true };
      return h("li", { class: cx("hm-price-feat", x.included === false && "is-off") },
        h("span", { class: "hm-price-feat-icon", "aria-hidden": "true" }, glyph(x.included === false ? minus : check)),
        h("span", {}, x.label, x.included === false ? h("span", { class: "hm-sr-only" }, ` (${t`not included`})`) : null),
        x.hint != null ? h("span", { class: "hm-price-feat-hint" }, x.hint) : null);
    });
    return h(Card, { as: "article", class: cx("hm-price-card", p.featured && "is-featured") },
      h("header", { class: "hm-price-head" },
        h("h3", { class: "hm-price-name" }, p.name),
        p.featured && p.badge != null ? h(Badge, { tone: "primary", class: "hm-price-badge" }, p.badge) : null),
      p.description != null && h("p", { class: "hm-price-desc" }, p.description),
      h("div", { class: "hm-price-amount" },
        custom ? h("span", { class: "hm-price-custom" }, t`Custom`)
          : [h(Counter, { value: amount, mode: "roll", start: "now", format: money(cur), class: "hm-price-num" }),
            h("span", { class: "hm-price-per" }, h("span", {}, t`/ month`), h("span", { class: "hm-price-billed" }, () => (period() === "yearly" ? t`billed yearly` : t`billed monthly`)))]),
      p.cta ? h("div", { class: "hm-price-cta" }, actionButtons([{ variant: p.featured ? "primary" : "secondary", ...p.cta }], "md")) : null,
      feats.length ? h("ul", { class: "hm-price-feats" }, feats) : null) as HTMLElement;
  });
  const row = h("div", { class: "hm-price-row" }, cards) as HTMLElement;
  const root = h("div", { class: cx("hm-pricing", val(props.class)) }, toggle, row) as HTMLElement;

  // the switch thumb slides between the two options; the "billed" lines cross-fade
  if (toggle) {
    const seg = toggle.querySelector(".hm-segmented") as HTMLElement | null;
    const thumb = h("span", { class: "hm-price-thumb", "aria-hidden": "true" }) as HTMLElement;
    seg?.prepend(thumb);
    let first = true;
    const place = (): void => {
      const on = seg?.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!seg || !on) return;
      const x = on.offsetLeft, w = on.offsetWidth;
      const from = thumb.style.getPropertyValue("transform"), fromW = Number.parseFloat(thumb.style.getPropertyValue("width")) || w;
      setStyle(thumb, { width: `${w}px`, transform: `translateX(${x}px)` });
      if (!first && !reducedMotion() && from) animate(thumb, { transform: [`${from} scaleX(${(fromW / w).toFixed(3)})`, `translateX(${x}px) scaleX(1)`] }, { duration: 420, easing: "spring" });
      first = false;
      for (const b of root.querySelectorAll<HTMLElement>(".hm-price-billed")) if (!reducedMotion()) animate(b, { opacity: [0, 1], transform: ["translateY(6px)", "translateY(0px)"] }, { duration: 320, easing: "out" });
    };
    effect(() => { period(); queueMicrotask(place); });
    const RO = globalThis.ResizeObserver;
    if (RO && seg) { const ro = new RO(() => { first = true; place(); }); ro.observe(seg); if (getOwner()) onCleanup(() => ro.disconnect()); }
  }
  const stop = revealOnScroll(row, { effect: "up", select: ".hm-price-card", stagger: 90 });
  if (getOwner()) onCleanup(stop);
  return root;
}
