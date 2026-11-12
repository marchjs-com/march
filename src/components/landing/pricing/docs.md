# Pricing

Plans side by side with a monthly / yearly switch. Switching morphs every price: the digits roll to the new amount
(Counter, odometer mode), the "billed" line cross-fades and the switch thumb slides. The featured plan is lifted with a
brand-gradient border. Cards share one height; on phones they stack with the featured plan first.

```tsx
let $period = "monthly"
<Pricing bind:period={$period} saving="2 months free" currency="EUR" plans={[
  { name: "Starter", price: 0, features: ["1 project", "Community support"], cta: { label: "Start free" } },
  { name: "Pro", price: { monthly: 29, yearly: 24 }, featured: true, badge: "Most popular", features: […], cta: { label: "Go Pro" } },
  { name: "Enterprise", price: null, features: […], cta: { label: "Talk to sales" } },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `plans` | `{ name, description?, price, features?, cta?, featured?, badge? }[]` | — | `price`: a number, `{ monthly, yearly }` (per month) or `null` (custom) |
| `period`, `setPeriod` | `monthly` `yearly` | `monthly` | `bind:period` to control it |
| `toggle` | boolean | `true` | show the switch |
| `currency` | ISO code | `EUR` | Intl currency format for the locale |
| `saving` | node | — | badge next to the switch, bright on yearly |

A feature is a node or `{ label, included?, hint? }`; `included: false` shows a dash and says "not included" to screen
readers.

## Accessibility

The switch is a Segmented radio group ("Billing period", arrow keys). Each plan is an `<article>` with an `<h3>`; the
price is read once as its final value (the rolling digits are hidden from screen readers).

## Composed of

Card, Badge, Segmented, Counter, Reveal; buttons from Hero's `actionButtons`.
