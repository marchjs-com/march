# Wizard

One form split into steps. Each step shows and validates its own fields (plus an optional `validate` check) before
Next; Back keeps what was typed; Finish submits the whole form. The stage list on top is the Steps component: a later
stage can be picked once every stage before it passes.

```tsx
<Wizard submitLabel="Finish" onSubmit={save} steps={[
  { title: "Account", schema: schema({ email: { type: "email", required: true } }) },
  { title: "Profile", schema: schema({ name: { type: "text", required: true } }), validate: (v) => (v.name === "admin" ? "Pick another name" : null) },
]} />
```

## Props

`steps`, `layout`, `cols` and `color` are live: pass a getter (or a signal-backed value in JSX) and the wizard follows it.
A new `steps` list builds the form again from the first step, keeping the values typed so far.

| Prop | Type | Default | |
|---|---|---|---|
| `steps` | `WizardStep[]` | — | `title`, `description`, `fields` or `schema`, `validate(values)`, `render(form)` |
| `schema` | `Schema` | merged step schemas | one schema for the whole form |
| `initial` | object or function | — | starting values |
| `onSubmit` | `(values, form) => unknown` | — | runs after the last step validates |
| `submitLabel` | node | `Finish` | label of the last step's button |
| `layout`, `cols` | `"stack"` `"grid"`, number | `"stack"` | how a step's fields are laid out |
| `validateOn` | `"blur"` `"change"` `"submit"` | `"blur"` | when a field shows its error |
| `onStep`, `onReady` | functions | — | step changes; the form and `{ index, next, back, go }` |
| `form` | `FormController` | new `useForm` | share a form built elsewhere |
| `m:color` | `ColorToken` | primary | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `stepper` | boolean | `true` | the stage list on top |
| `progress` | boolean | `true` | the bar under it |
| `count` | boolean | `true` | the "Step 2 of 3" text beside the buttons |
| `backButton` | boolean | `true` | the Back button (`onReady`'s `back()` still works) |
| `labels` | `{ back, next, step(i), count(i, total) }` | `t` texts | button texts (nodes), the title of an untitled step, the count text; `i` is 0-based |
| `class` | class | — | on the form (`m-wizard`); parts: `m-wizard-steps`, `-progress`, `-step`, `-title`, `-nav`, `-count`, `-back`, `-next` |

```tsx
<Wizard steps={steps} stepper={false} count={false}
  labels={{ back: "Previous", next: <>Continue <Icon of={arrowRight} /></>, count: (i, n) => `${i + 1} / ${n}` }} />
```

## Accessibility

A `form` with `novalidate` (messages come from the schema); `aria-busy` while submitting. The stage list marks the
current stage with `aria-current="step"`; moving to a stage focuses its heading, so screen readers announce it. The
Progress bar carries "Step 2 of 3" as its label, and step-level errors are `role="alert"`.

## Composed of

Steps (the stage list), Progress (the bar under it), Button (Back, Next / Finish: busy while the form submits), Alert (a step or submit error); fields come
from the form engine (`renderFields`).
