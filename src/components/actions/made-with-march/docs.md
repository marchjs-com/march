# MadeWithMarch

An optional credit line: "Developed with HADI March and 💗", with "HADI March" as a link. Using it is a request, not a
requirement: the licence stays MIT and nothing here is needed to use March.

```tsx
<MadeWithMarch />
<MadeWithMarch variant="badge" />
<MadeWithMarch variant="small" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `variant` | `text` `badge` `small` | `text` | plain line, bordered pill, compact muted line |
| `class` | class | — | extra classes |

## Link

The address is the constant `MARCH_URL` in `src/brand.js` (one place, shared with the console banner; re-exported here). It points to the repository for now; the project page
`https://devs.hadisosyal.com/march` replaces it once that page is published.

## Accessibility and i18n

The sentence is one message (`Developed with {0} and {1}`), so word order follows the language (Turkish: "HADI March ve
💗 ile geliştirildi"). The heart is `role="img"` with an `aria-label`. Colours are theme tokens and spacing uses logical
properties, so dark themes and RTL need nothing extra. The link opens in a new tab with `rel="noopener"`.

## Without a component

`march.config.js` has `credit: true`: the built `index.html` then carries `<!-- Built with HADI March -->`. Off by default. It also prints the console banner in production (a separate tiny `credit.js`); in `march dev` the banner is on unless `banner: false`.
