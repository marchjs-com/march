// Type tests (tsc --noEmit): schema() infers the record type; Infer<> maps field specs to TS types.
import { schema, type Infer } from "../src/schema/index.ts";

const Product = schema({
  title: { type: "text", required: true, max: 80 },
  note: "textarea",
  email: { type: "email" },
  price: { type: "money", currency: "USD", min: 0 },
  qty: { type: "int", required: true },
  active: "bool",
  born: { type: "date" },
  at: { type: "datetime", required: true },
  status: { type: "pick", options: ["draft", "live"] as const, default: "draft" },
  level: { type: "pick", options: [{ value: 1, label: "Low" }, { value: 2, label: "High" }] as const, required: true },
  loose: { type: "pick", options: ["a", "b"] },
  tags: "list",
  cats: { type: "multi", options: ["x", "y"] },
  meta: "json",
  photo: { type: "file" },
  secret: { type: "hidden" },
  plain: {},
});
type P = Infer<typeof Product>;

const p: P = {
  title: "Pen", note: "", email: "a@b.co", price: null, qty: 2, active: true, born: null, at: "2026-01-01T00:00:00Z",
  status: "live", level: 2, loose: "anything", tags: ["a"], cats: [], meta: { any: "thing" }, photo: null, secret: 1, plain: "",
};
const title: string = p.title;
const price: number | null = p.price;
const qty: number = p.qty;
const status: "draft" | "live" | null = p.status;
const level: 1 | 2 = p.level;
const loose: string | null = p.loose;
const tags: string[] = p.tags;
const photo: File | null = p.photo;
void title; void price; void qty; void status; void level; void loose; void tags; void photo;

// @ts-expect-error — text is a string
const bad1: P = { ...p, title: 1 };
// @ts-expect-error — required removes null
const bad2: P = { ...p, qty: null };
// @ts-expect-error — not one of the pick options
const bad3: P = { ...p, status: "archived" };
// @ts-expect-error — bool is boolean
const bad4: P = { ...p, active: "yes" };
// @ts-expect-error — date is string | null
const bad5: P = { ...p, born: new Date() };
void bad1; void bad2; void bad3; void bad4; void bad5;

// Infer works on the spec object too, and on pick/omit/extend results.
const spec = { name: { type: "text", required: true }, age: "int" } as const;
const n: Infer<typeof spec> = { name: "Ada", age: null };
void n;
const Small = Product.pick("title", "price");
const s: Infer<typeof Small> = { title: "x", price: 1 };
// @ts-expect-error — "qty" was not picked
const s2: Infer<typeof Small> = { title: "x", price: 1, qty: 1 };
// @ts-expect-error — unknown field name
Product.pick("nope");
const Big = Product.omit("meta").extend({ sku: { type: "text", required: true } });
const b: Infer<typeof Big>["sku"] = "A-1";
void s; void s2; void b;

// defaults() and validate() are typed.
const d: P = Product.defaults();
const r = Product.validate({});
const v: P["title"] | undefined = r.values.title;
void d; void v;
