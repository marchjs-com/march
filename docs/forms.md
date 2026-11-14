# Forms (`hadi-march/ui` → `src/forms`)

Schema-driven forms, a field wrapper with correct ARIA wiring, and a complete set of inputs. Everything is exported by
`hadi-march/ui` (which re-exports `src/forms/index.ts`). Load the styles once:

```js
import "hadi-march/css/tokens.css"
import "hadi-march/css/forms.css"   // buttons (.m-btn) come from ui.css
```

Rules shared by every control:

- **Values in, values out.** Controls work with `bind:value={$x}` (live `value` + `setValue`), with a signal passed as
  `value`, with a live `value` plus `onChange(v)` (called with the value, not the event), or uncontrolled (initial `value`).
- **Inside a `<Field>`/`<Form>`** a control takes its `id`, `aria-invalid` and `aria-describedby` from the field.
- Common props: `id`, `name`, `disabled`, `readonly`, `required`, `placeholder`, `onBlur`, `aria-label`, `class`.
- DOM is built with `h()` only (no HTML strings); styles are classes from `forms.css` (tokens, light/dark automatic).
- Every default text (button labels, messages) goes through ``t`…` `` and can be translated.

## Quick start

```jsx
import { schema } from "hadi-march/schema"
import { Form } from "hadi-march/ui"

const Signup = schema({
  name: { type: "text", required: true, max: 60 },
  email: { type: "email", required: true },
  plan: { type: "pick", options: ["free", "pro"], default: "free", control: "segmented" },
  company: { type: "text", when: (v) => v.plan === "pro", help: "Shown on invoices" },
  terms: { type: "bool", label: "I accept the terms", required: true },
})

<Form schema={Signup} submitLabel="Create account" onSubmit={(values) => api.signup(values)} />
```

`onSubmit` receives values coerced by `schema.parse` (only active fields; `when` = false fields are left out). If it throws
an error with `fieldErrors: { email: "Already registered" }` the messages appear under those fields (unknown keys and other
errors appear above the buttons as `submitError`).

## `useForm(schema, initial?, opts?)`

| opt | meaning |
|---|---|
| `onSubmit(values, form)` | called after successful validation; may be async |
| `validateOn` | `"blur"` (default), `"change"` or `"submit"`. After the first submit, and once a field shows an error, it re-validates on every change |
| `onChange(name, value, values)` | every `set` |
| `onInvalid(errors)` | submit blocked by validation |

Returns a controller:

| member | |
|---|---|
| `values` | reactive store of the current (raw) values |
| `errors`, `touched` | reactive maps `name → message` / `name → true` |
| `dirty()`, `valid()` | computed |
| `submitting()`, `submitError()`, `submitCount()` | signals |
| `set(name, v)`, `get(name)`, `blur(name)` | |
| `validate(name?)` | one field or all; returns true when valid |
| `setErrors(map)`, `clearErrors()`, `focus(name)` | |
| `reset(v?)` | back to the baseline, or start over from `v` (new baseline for `dirty`) |
| `submit(e?)` | validates, focuses the first invalid field, coerces, calls `onSubmit`; resolves to its result or `false` |
| `initial()` | the baseline values |
| `field(name, overrides?)` | a rendered `<Field>` for that schema field |
| `register(name, { type? })` | props for a plain element: `<input {...form.register("email")} />` |
| `idOf(name)` | DOM id of the field's control |

```jsx
function Profile() {
  const form = useForm(ProfileSchema, { name: "Ada" }, { onSubmit: save })
  return <form on:submit|prevent={form.submit}>
    {form.field("name")}
    <input {...form.register("nickname")} />
    <button disabled={form.submitting()}>Save</button>
  </form>
}
```

## `<Form>`

| prop | |
|---|---|
| `schema`, `initial`, `onSubmit`, `validateOn`, `onChange` | passed to `useForm` (or pass an existing controller as `form`) |
| `submitLabel`, `cancel` (`true` = reset, or a function), `cancelLabel` | submit bar; the submit button is disabled while submitting |
| `layout` | `"stack"` (default) or `"grid"` with `cols` (1–12; collapses to one column on small screens; field `span` widens a field) |
| `sections` | `[{ title, description, fields: ["a", "b"], cols }]` → fieldsets |
| `actions={false}` | no submit bar (Enter in a text input still submits) |
| `confirmLeave` | warn on page unload while dirty |
| `requireDirty` | submit disabled until something changed |
| `readonly` | every field read-only, no submit bar |
| `extraActions` | nodes placed before the buttons |
| `onReady(form)` | receives the controller |

Without children it renders every active schema field (`hidden` fields and `type: "hidden"` are skipped, `when` is live,
`readonly` is respected). With children it renders them instead; reach the controller with `useFormContext()`:

```jsx
<Form schema={S} onSubmit={save}>
  <div class="m-cols-2">
    <Field name="first" />
    <Field name="last" />
  </div>
  <Field name="bio" help="Markdown supported" controlProps={{ rows: 6 }} />
</Form>
```

`renderFields(form, names?, { layout, cols })` and `<FormActions form submitLabel cancel requireDirty />` are the building
blocks `<Form>` uses.

## `<Field>`

Label (with a `*` marker when required), control, help text and error message. The control gets `aria-invalid` and
`aria-describedby` (help + error ids); the error region is `aria-live="polite"`.

| prop | |
|---|---|
| `name` | schema field inside a form (renders `inputFor(field)`) |
| `label`, `help`, `error`, `required` | override / standalone values |
| `inline` | label beside the control; `compact` hides help and tightens spacing |
| `controlProps` | extra props for the generated control |
| `group` | standalone: the control has several parts (label becomes `aria-labelledby` target, not `<label for>`) |

Standalone: `<Field label="City" help="Where you live" error={$err}><TextInput bind:value={$city} /></Field>`.

## Schema → input registry

`inputFor(field)` returns `field.control` (a component or a registered name) or the component for `field.type`:

| type / control | component |
|---|---|
| text, textarea, password, email, url, phone | TextInput, Textarea, PasswordInput, EmailInput, UrlInput, PhoneInput |
| number, int, money, percent | NumberInput, IntInput, MoneyInput, PercentInput |
| bool / `switch` | Checkbox / Toggle |
| date, datetime, time, `daterange` | DatePicker, DateTimeInput, TimeInput, DateRangePicker |
| pick / `radio`, `segmented`, `combobox` | Select / RadioGroup, Segmented, Combobox |
| multi / `checkboxes` | MultiSelect / CheckboxGroup |
| list, `keyvalue`, records, json, `markdown` | ListEditor, KeyValueEditor, RecordListEditor, JsonEditor, MarkdownEditor |
| color, file, `code`, `slider` | ColorInput, FileUpload, CodeInput, Slider |

Other field keys (`placeholder`, `min`, `max`, `step`, `currency`, `rows`, `accept`, `maxSize`, `upload`, `search`, …) are
passed to the control; `props: {…}` passes anything else. Add types: `registerInput("iban", IbanInput)`.

## Text inputs

| Component | Props |
|---|---|
| `TextInput` | `type`, `placeholder`, `autocomplete`, `inputmode`, `maxLength`, `prefix`, `suffix`, `transform(v)` |
| `Textarea` | `rows` (3), `autosize` (default true: grows with content) |
| `PasswordInput` | show / hide toggle (`aria-pressed`); `autocomplete` defaults to `current-password` (use `new-password` on sign-up) |
| `EmailInput`, `UrlInput` | trimmed, right keyboard (`inputmode`), `autocomplete="email"` |
| `PhoneInput` | keeps `+` and digits; `country="+44"` is shown as a prefix and prepended to national numbers (`07700 900123` → `+447700900123`). Helper: `normalizePhone(raw, country)` |

## Numbers

`NumberInput` is a text input (`inputmode="decimal"`) that understands the locale: `12,5` and `12.5` both work, grouping
is accepted (`1.234,56` in German, `1,234.56` in English; an ambiguous `1.234` follows the locale). It never produces
`NaN`: unparsable text marks the input invalid and is reverted on blur. Empty → `null`.

| prop | |
|---|---|
| `min`, `max` | clamped on blur and when stepping |
| `step` | ArrowUp / ArrowDown (default 1) |
| `decimals`, `minDecimals`, `grouping` | display formatting (applied on blur) |
| `scale` | display = value × scale |
| `locale` | defaults to the active i18n locale |
| `prefix`, `suffix` | text beside the input |

- `MoneyInput` — `currency` (`"USD"`): symbol on the locale's side, the currency's decimals (2, 0 for JPY), grouping.
- `PercentInput` — shows `12.5 %` for a stored `0.125` (`fraction={false}` stores `12.5`).
- `IntInput` — 0 decimals. Helpers: `parseNumber(text, locale)`, `formatNumber(n, locale, opts)`.

```jsx
<MoneyInput bind:value={$price} currency="EUR" min={0} />
```

## Choices

| Component | Props |
|---|---|
| `Select` | `options` (`[v]` or `[{ value, label, disabled }]`, may be live), `placeholder`. Values keep their type (numbers stay numbers) |
| `Checkbox` | `label` or children, `indeterminate` |
| `Toggle` | `role="switch"` button, `label` (named Toggle so it never clashes with the `<Switch>` control-flow component) |
| `CheckboxGroup` | `options`, `inline`; value is an array |
| `RadioGroup` | `options`, `inline` |
| `Segmented` | compact single choice, arrow keys move and select |
| `Slider` | `min`, `max`, `step`, `format(v)` for the shown value |
| `ColorInput` | swatch + `#rrggbb` text |

### `Combobox` and `MultiSelect`

WAI-ARIA combobox: focus stays in the input, the active option is announced via `aria-activedescendant`. ArrowUp/Down,
PageUp/PageDown, Enter picks, Escape restores, Backspace in an empty MultiSelect removes the last chip.

| prop | |
|---|---|
| `options` | static options, filtered by label / hint (accent and case insensitive) |
| `search(q)` | async: `→ Promise<options>`; debounced (`debounce`, 250 ms), stale responses ignored, errors shown |
| `minChars` | 0 for static, 1 for search |
| `labelOf(value)` | label for a value that is not in the loaded options (e.g. an id from the server) |
| `renderOption(o)` | custom option content |
| `allowCustom` | Enter with typed text uses the text as the value |
| `limit` | max shown options (50) |
| `multiple` | array value with chips (that is `MultiSelect`) |
| `onSelect(option)` | |

```jsx
// member picker
<Combobox bind:value={$ownerId} search={(q) => api.members(q).then((r) => r.map((m) => ({ value: m.id, label: m.name, hint: m.email })))}
          labelOf={(id) => names.get(id)} placeholder="Search people" />
<MultiSelect bind:value={$tags} options={["urgent", "billing", "bug"]} allowCustom />
```

### `CodeInput` (one-time codes)

`length` (6) boxes with `inputmode="numeric"`, `autocomplete="one-time-code"` on the first; typing advances, Backspace goes
back, pasting (or SMS autofill) fills every box. `numeric={false}` allows letters. `onComplete(code)` fires once per full code.

```jsx
<CodeInput length={6} onComplete={(code) => verify(code)} autofocus />
```

## Dates and times

Dates are ISO strings (`"2026-03-14"`); arithmetic is done in UTC so DST never shifts a day.

| Component | Props |
|---|---|
| `DatePicker` | text input (locale numeric format, e.g. `14.03.2026`; ISO also accepted) + calendar popover. `min`, `max`, `firstDay`, `locale`. Alt+ArrowDown opens |
| `Calendar` | the month grid on its own. Arrows (day/week), PageUp/PageDown (month, Shift: year), Home/End (week), Enter/Space picks, Escape → `onEscape`. `min`/`max` disable days and clamp keyboard focus. `firstDay` (0 = Sunday) defaults to the locale's (Intl week info; Monday when unavailable). Month / weekday names from Intl. `rangeFrom`/`rangeTo` highlight, `isDisabled(iso)`, `onPick(iso)` |
| `TimeInput` | native `type="time"`, value `"HH:MM"`, `min`, `max`, `step` |
| `DateTimeInput` | date + time edited in local time, value is an ISO timestamp (`toISOString()`), `defaultTime` |
| `DateRangePicker` | value `{ from, to }`; presets Today, Last 7/30/90 days, This month, Custom (two DatePickers). `presets` (array like `rangePresets(today)`, or `false`), `today`, `min`, `max` |

Helpers: `parseDate(text, locale)` (`null` empty, `undefined` invalid), `formatDate(iso, locale)`, `addDays`, `addMonths`,
`todayIso()`, `firstDayOf(locale)`, `rangePresets(today)`.

```jsx
<DatePicker bind:value={$due} min={todayIso()} />
<DateRangePicker bind:value={$range} />
```

## `FileUpload`

Drop zone (click, Enter / Space or drag & drop) with a hidden file input.

| prop | |
|---|---|
| `accept` | `"image/*,.pdf"`; rejected files show an error |
| `multiple`, `maxFiles` | |
| `maxSize` | bytes; larger files are rejected with "name is too large (max 2 MB)" |
| `upload(file, { onProgress, signal })` | returns a promise of the stored result; `onProgress(0..1)` or `onProgress({ loaded, total })` drives the progress bar; the Cancel button aborts `signal` |
| `onError(message, file)` | |
| `label` | drop zone text |

Value: without `upload` the `File` (or `File[]`); with `upload` the result (or results). Images and audio get a preview via
object URLs, revoked when removed or unmounted. An existing value (e.g. a URL string) is listed with a remove button.

```jsx
<FileUpload accept="image/*" maxSize={2_000_000} upload={(file, o) => storage.put(file, o)} bind:value={$avatarUrl} />
```

## Structured editors

| Component | Props |
|---|---|
| `ListEditor` | array of strings: add (Enter), edit in place, move up/down, remove; pasting several lines adds one item per line. `max`, `unique` (true), `placeholder`, `addLabel` |
| `KeyValueEditor` | object `string → string`; `numbers` turns numeric values into numbers; empty keys skipped, duplicates flagged. `keyPlaceholder`, `valuePlaceholder` |
| `JsonEditor` | monospace textarea with live validation ("Invalid JSON at line 2, column 8: …"), Format button, Tab indents. `validate(value) → message`, `rows`, `indent`. Value: parsed JSON (`null` when empty); while invalid, the raw text (the schema `json` type then reports it) |
| `MarkdownEditor` | textarea with Write / Preview tabs (`preview="split"` for side by side), `rows` |
| `Markdown` | safe renderer: `source` (or a string child), `images` (https only, default on), `newTab`, `headingOffset` |

`Markdown` builds DOM nodes from a subset: headings, paragraphs, **bold**, *italic*, ~~strike~~, `code`, fenced code
blocks, links, lists (incl. `[ ]` tasks), blockquotes, rules. HTML in the source is shown as text. Links are only created
for `http(s)`, `mailto`, `tel` and relative URLs (`isSafeLink(url)`); everything else (`javascript:`, `data:`, obfuscated
schemes) renders as plain text. Links get `rel="noopener noreferrer nofollow"`. `markdownNodes(source)` returns the nodes.

### `RecordListEditor` (type `records`)

An array of records (objects) edited with a sub-schema: each row shows one compact labelled control per field, with
move up/down and remove buttons and an Add button. Extra keys of a row (e.g. an `id`) are kept. Props / field keys:
`fields` (schema spec or schema), `blank` (new row values, object or function), `max`, `addLabel`, `cols`, `sortable`
(true), `removable` (true). The `records` schema type validates every row and reports the first problem as
"Row N: Label: message" (`validateRecords(list, fields)` does the same).

```jsx
carriers: { type: "records", label: "Carriers", addLabel: "Add carrier",
  fields: { name: { type: "text", required: true }, url: { type: "url", label: "Tracking link" } } }
```

## `<Wizard>`

One form split into steps; Next validates only the current step.

| prop | |
|---|---|
| `steps` | `[{ title, description, fields: ["a"], schema, validate(values) → {name: msg} \| "message" \| null, render(form) }]` |
| `schema` | optional when every step has its own `schema` (they are merged) |
| `initial`, `onSubmit`, `validateOn`, `submitLabel` ("Finish"), `layout`, `cols`, `onStep(i)`, `onReady(form, api)` |

The progress list marks the current step (`aria-current="step"`), done steps can be revisited.

```jsx
<Wizard onSubmit={create} steps={[
  { title: "Account", schema: AccountSchema },
  { title: "Billing", schema: BillingSchema, validate: (v) => (v.plan === "pro" && !v.vat ? { vat: "Required for Pro" } : null) },
]} />
```

## `<EditForm>` (load → edit → save)

For settings and admin screens.

```jsx
<EditForm schema={OrgSettings} title="Organization" description="Visible to all members"
  load={() => api.getSettings()}
  save={(values, { reason, changed }) => api.updateSettings(changed, reason)}
  reason={10} successMessage="Settings saved"
  sections={[{ title: "General", fields: ["name", "timezone"] }, { title: "Limits", fields: ["seats", "storage"] }]} />
```

| prop | |
|---|---|
| `schema`, `load()`, `save(values, ctx)` | `ctx = { reason, changed }` — `changed` holds only fields that differ from the loaded values |
| `reason` | number (min length) or `{ min, title, message, purposes, danger }`: asks with `askReason` before saving; cancelling aborts |
| `title`, `description`, `sections`, `layout`, `cols`, `submitLabel`, `validateOn`, `confirmLeave` | |
| `successMessage` | toast text (`false` for none) |
| `onSaved(result, values)` | |
| `useResult` | when `save` resolves to an object, use it as the new values instead of reloading |
| `readonly` | view only |
| `extra(form)` | nodes beside the buttons |
| `ask`, `notify` | replace `askReason` / `toast` (tests, custom dialogs) |

It shows a loading skeleton, a load error with Retry, a Reload button and an "Unsaved changes" badge; Reset restores the
loaded values; Save is disabled until something changed. Server `fieldErrors` map to fields like `<Form>`.


## Colors

Every control takes `color` (a theme token): focus ring and border, caret, selected text, checked state, slider,
selected option and day, chips, active step and the drop zone use it. `<Form color="brand-blue">`, `<Field color=…>` and
groups (`<CheckboxGroup>`, `<RadioGroup>`, `<Segmented>`) pass it to everything inside (CSS inheritance of
`data-m-color`); a control's own `color` overrides it. Invalid fields always show `danger`. Floating panels (Select,
DatePicker) take the color of their control.

Tokens: `primary`, `info`, `success`, `warning`, `danger`, `neutral`, `special`, `brand-orange`, `brand-blue`,
`brand-green`, `brand-purple`, `brand-gold`, `brand-pink`, `cat-1` … `cat-8` (`COLOR_TOKENS` in `hadi-march/theme`). Text
on a filled state is chosen for legibility (white when it reaches the brand minimum, otherwise near-black).


## CodeInput

`<CodeInput length={6} groups={[3, 3]} onComplete={verify} />` — one-time codes and PINs. `length` 3–12; `pattern`
`"numeric"` (default: numeric keypad, `autocomplete="one-time-code"`), `"alpha"`, `"alphanumeric"` (`uppercase`, default
on for letters); `groups` adds separators; `mask` hides characters. Look: `colors` (`"single"`, `"brand"`, `"palette"`,
token list), `font` (`"display"`, `"mono"`, `"body"`), `size`, `variant` (`"outline"`, `"filled"`, `"underline"`),
`animate`. The HADİ theme defaults to the four brand colors and the display font; an app accent replaces the colors.
Paste fills from the focused box and cuts what does not fit; errors (`invalid`) turn every box `danger`. Codes are laid
out left to right in every language; boxes shrink on narrow screens.
