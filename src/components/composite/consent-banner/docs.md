# ConsentBanner

The consent manager's UI. A bottom banner asks until there is a valid decision for the current policy version (Reject
all sits next to Accept all, with the same weight); the preferences panel lists every category as a Card with a Toggle
(a Dialog on wide screens, a bottom sheet on phones); `ConsentGate` keeps third-party content behind a placeholder that
can allow it in place. The module is lazy on purpose: load it with
`lazy(() => import("march/managers/consent/ui"), { pick: "ConsentBanner" })`.

```tsx
<ConsentBanner title="Cookies" text="We use analytics to measure visits." />
<ConsentGate category="thirdParty">{() => <iframe src={videoUrl} title="Video" />}</ConsentGate>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `title`, `text` | string or function | `t` texts | banner heading and the app's own wording |
| `policyLabel` | string or function | `t` text | label of the policy link (shown when `configureConsent({ policyHref })` is set) |
| `always` | boolean | `false` | show even when a decision is stored (demos); a choice still closes it |
| `inline` | boolean | `false` | render in the page flow instead of the bottom layer |
| `labels` | `ConsentLabels` | `t` texts | `{ reject, customize, accept, save, lead, alwaysOn, withdraw, saved(date, version), allow, preferences }`: every button and panel text |
| `customize` | boolean | `true` | the Customize button; Reject and Accept always stay side by side |
| `class` | | | on the banner |

```tsx
<ConsentBanner labels={{ reject: "No thanks", accept: "Fine by me", customize: "Let me choose" }} />
<ConsentBanner customize={false} class="my-banner" />
<ConsentGate category="thirdParty" labels={{ allow: "Show the video" }} preferences={false}>…</ConsentGate>
```

`ConsentGate`: `category`, `children`, `label` (the placeholder text), `labels` (`allow`, `preferences`),
`preferences` (`false` hides that button), `class`. Functions: `openConsentPreferences(texts)` (resolves
true when saved), `showConsentBanner()`, `hideConsentBanner()`.

## Accessibility

The banner is a labelled `region` in the toast layer, so it never traps focus and the page stays usable; its buttons are
real buttons in reading order. The panel is a modal Dialog (focus trapped and returned); every Toggle carries its
category title as its name, and required categories are on and disabled. The gate placeholder is a `note`.

## Composed of

Button (banner and panel actions, the "Withdraw consent" link), Stack (the button rows), Card (one per category), Dialog
(the preferences panel), Toggle (a category on or off), Empty (the placeholder of ConsentGate).
