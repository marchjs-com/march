// Type tests (tsc --noEmit): the schema's value type flows through useForm, Form, EditForm and Wizard.
import { schema } from "../src/schema/index.ts";
import { useForm, Form, EditForm, Field, Wizard, renderFields, TextInput, NumberInput, Select, Combobox, DatePicker, FileUpload,
  type FormController, type EditFormProps, type TextInputProps, type NumberInputProps } from "../src/forms/index.ts";
import { h } from "../src/dom/h.ts";

const Product = schema({
  title: { type: "text", required: true },
  price: { type: "money", min: 0 },
  qty: { type: "int", required: true },
  status: { type: "pick", options: ["draft", "live"] as const },
  tags: "list",
});

// ---- useForm: values / set / field are typed by the schema
const form = useForm(Product, { title: "Pen" }, {
  onSubmit: (v, f) => { const title: string = v.title; const qty: number = v.qty; const ff: FormController<typeof v> = f; void title; void qty; void ff; },
});
const title: string = form.values.title;
const price: number | null = form.get("price");
form.set("title", "Pencil");
form.set("price", null);
form.set("status", "live");
form.set("tags", ["a", "b"]);
// @ts-expect-error — unknown field name
form.set("nope", 1);
// @ts-expect-error — title is a string
form.set("title", 1);
// @ts-expect-error — qty is required: no null
form.set("qty", null);
// @ts-expect-error — not one of the pick options
form.set("status", "archived");
form.field("price");
// @ts-expect-error — unknown field name
form.field("nope");
form.blur("qty");
// @ts-expect-error — unknown field name
form.register("nope");
form.reset({ qty: 3 });
// @ts-expect-error — initial values are typed
useForm(Product, { qty: "three" });
void title; void price;

// a plain spec works too
const spec = useForm({ name: { type: "text", required: true }, age: "int" } as const);
spec.set("age", 3);
// @ts-expect-error — age is number | null
spec.set("age", "3");

// ---- <Form> / renderFields / <Field>
h(Form, { schema: Product, onSubmit: (v: { title: string }) => v.title.length });
renderFields(form, ["title", "qty"]);
// @ts-expect-error — not a field of the form
renderFields(form, ["title", "nope"]);
Field({ form, name: "price" });
// @ts-expect-error — not a field of the form
Field({ form, name: "nope" });

// ---- EditForm: save receives the typed values and changed fields
type P = typeof Product extends { defaults(): infer V } ? V : never;
EditForm({
  schema: Product,
  load: async () => ({ title: "Pen", qty: 1 }),
  save: async (values, { reason, changed }) => {
    const qty: number = values.qty;
    const t: string | undefined = changed.title;
    const r: string | { category: string; text: string } | undefined = reason;
    // @ts-expect-error — no such field
    void values.nope;
    // @ts-expect-error — title is a string
    const n: number = values.title;
    void qty; void t; void r; void n;
  },
  reason: 10,
});
const editProps: EditFormProps<P> = {
  schema: Product,
  // @ts-expect-error — load must resolve to (partial) values of the schema
  load: async () => ({ title: 1 }),
  save: () => null,
};
void editProps;

// ---- Wizard steps name schema fields
Wizard({ schema: Product, steps: [{ title: "One", fields: ["title", "qty"] }, { fields: ["price"] }], onSubmit: (v) => v.qty + 1 });
// @ts-expect-error — not a field of the schema
Wizard({ schema: Product, steps: [{ fields: ["nope"] }] });

// ---- input prop interfaces
const tp: TextInputProps = { value: "x", onChange: (v) => v.toUpperCase(), placeholder: "Name" };
const np: NumberInputProps = { value: 1, min: 0, decimals: 2, onChange: (v) => v?.toFixed(2) };
// @ts-expect-error — TextInput value is a string
const bad: TextInputProps = { value: 1 };
TextInput(tp); NumberInput(np);
Select<"a" | "b">({ options: ["a", "b"], onChange: (v) => { const s: "a" | "b" | null = v; void s; } });
Combobox({ search: async (q) => [q], multiple: true });
DatePicker({ value: "2026-01-01", min: "2026-01-01" });
FileUpload<string>({ upload: async (file, { onProgress }) => { onProgress(0.5); return file.name; } });
void bad;
