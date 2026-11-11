// Type tests (tsc --noEmit): valid paths compile; invalid ones must fail.
import { store, on, type Path, type PathValue } from "../../src/core/store.ts";

interface Item { id: number; qty: number }
const app = store({ user: { name: "Ada", age: 36 }, cart: { items: [] as Item[] }, users: [] as { name: string }[] });

on(app, "user.name", (e) => { const v: string | undefined = e.value; void v; });
on(app, "cart.items", () => {});
on(app, "users.*.name", () => {});
on(app.cart, "items.0.qty", (e) => { const n: number | undefined = e.value; void n; });

// @ts-expect-error — no such path
on(app, "user.nmae", () => {});
// @ts-expect-error — wrong value type for the path
on(app, "user.age", (e) => { const s: string | undefined = e.value; void s; });

type P = Path<typeof app>;
const ok: P = "cart.items.3.qty";
// @ts-expect-error — not a path
const bad: P = "cart.total";
type V = PathValue<typeof app, "users.*.name">;
const name: V = "x";
void ok; void bad; void name;
