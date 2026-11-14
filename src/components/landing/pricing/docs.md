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
| `m:color` | color token | brand gradient + accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `featureIcon` | boolean / `(included) => node` | `true` | the tick / dash in front of a feature, or your own mark |
| `featureColor` | color token | `success` | colour of the tick |
| `per` | boolean | `true` | the "/ month · billed yearly" lines |
| `priceEffect` | `roll` `count` `none` | `roll` | how a price changes with the period |
| `reveal` | Reveal options / `false` | `{ effect: "up", stagger: 90 }` | entrance of the cards |
| `labels` | `{ monthly?, yearly?, perMonth?, billedMonthly?, billedYearly?, custom?, billingPeriod?, notIncluded? }` | built-in texts | any text Pricing writes itself |
| `class` | class | — | on the root |

```tsx
<Pricing plans={plans} m:color="brand-purple" featureColor="brand-purple" priceEffect="count" reveal={{ effect: "scale" }}
  labels={{ monthly: "Pay monthly", yearly: "Pay yearly", perMonth: "per seat", custom: "Let's talk" }} />
<Pricing plans={plans} featureIcon={(included) => (included ? "+" : "–")} per={false} reveal={false} />
```

A feature is a node or `{ label, included?, hint? }`; `included: false` shows a dash and says "not included" to screen
readers.

## Accessibility

The switch is a Segmented radio group ("Billing period", arrow keys). Each plan is an `<article>` with an `<h3>`; the
price is read once as its final value (the rolling digits are hidden from screen readers).

## Composed of

Card, Badge, Segmented (sliding indicator), Counter, CheckMark (feature marks), Reveal; buttons from SectionHead's `sectionActions`.
