# MadeWithMarch

An optional credit line: "Developed with MarchJS and 💗", with "MarchJS" as a link. Using it is a request, not a
requirement: the licence stays MIT and nothing here is needed to use March.

```tsx
<MadeWithMarch />
<MadeWithMarch variant="badge" />
<MadeWithMarch variant="small" />
<MadeWithMarch heart="☕" heartLabel="Coffee" />              // your own mark
<MadeWithMarch heart={false} />                              // "Developed with MarchJS"
<MadeWithMarch text={(link, heart) => <>Built on {link} {heart}</>} link="March UI" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `variant` | `text` `badge` `small` | `text` | plain line, bordered pill, compact muted line |
| `heart` | boolean / node | `true` (💗) | the heart: `false` ends the sentence at the link, a node or text replaces it |
| `heartLabel` | string / accessor | "Love" | accessible name of the heart |
| `link` | node | "MarchJS" | text of the link |
| `href` | string | `MARCH_URL` | where the link points |
| `text` | `(link, heart) => node` | — | your own sentence around the two parts |
| `class` | class | — | extra classes |

## Link

The address is the constant `MARCH_URL` in `src/brand.js` (one place, shared with the console banner; re-exported here). It points to the repository for now; the project page
`https://devs.hadisosyal.com/march` replaces it once that page is published.

## Accessibility and i18n

The sentence is one message (`Developed with {0} and {1}`), so word order follows the language (Turkish: "March ve
💗 ile geliştirildi"). The heart is `role="img"` with an `aria-label`. Colours are theme tokens and spacing uses logical
properties, so dark themes and RTL need nothing extra. The link opens in a new tab with `rel="noopener"`.

## Without a component

`march.config.js` has `credit: true`: the built `index.html` then carries `<!-- Built with MarchJS -->`. Off by default. It also prints the console banner in production (a separate tiny `credit.js`); in `march dev` the banner is on unless `banner: false`.
