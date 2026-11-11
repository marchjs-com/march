// Type tests (tsc --noEmit): query<T> / mutation result types and typed can() arguments.
import { query, mutation, resource, type Query } from "../src/data/index.ts";
import { can, hasRole, denied, setAccess, type Denial } from "../src/access/index.ts";

interface User { id: number; name: string }

// query infers T from the fetcher …
const users = query(async () => [{ id: 1, name: "Ada" }] as User[], { key: ["users"] });
const u: User[] | undefined = users();
const q: Query<User[]> = users;
users.mutate((prev) => [...(prev ?? []), { id: 2, name: "Grace" }]);
// @ts-expect-error — data is User[] | undefined, not string
const wrong: string = users();
// @ts-expect-error — mutate takes User[]
users.mutate([{ id: "x" }]);
// … or takes it explicitly for URL queries.
const me = query<User>("/api/me");
const name: string | undefined = me()?.name;
const st: "loading" | "error" | "ready" = me.state();
const r = resource(({ signal }) => fetch("/x", { signal }).then((x) => x.json() as Promise<number>));
const n: number | undefined = r();
void u; void q; void wrong; void name; void st; void n;

const save = mutation(async (v: User) => v.id, { invalidates: ["users"] });
const p: Promise<number> = save({ id: 1, name: "Ada" });
const pending: boolean = save.pending();
// @ts-expect-error — vars must be a User
void save({ id: 1 });
void p; void pending;

// can(): string, list (any of), predicate over the access state; nothing else.
setAccess({ user: { id: 1 }, roles: ["admin"], perms: ["users.edit"] });
const ok: boolean = can("users.edit") && can(["a", "b"]) && can((a) => a.roles.includes("admin")) && can() && hasRole(["admin", "owner"]);
// @ts-expect-error — not a permission
can(42);
// @ts-expect-error — predicate receives the access state
can((a: number) => a > 1);
const why: Denial | null = denied({ perm: "users.edit", method: "phone" });
// @ts-expect-error — unknown requirement key
denied({ permission: "x" });
void ok; void why;
