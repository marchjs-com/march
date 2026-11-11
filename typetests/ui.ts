// Type tests (tsc --noEmit): action() argument/result types, askReason overloads, dialogs and toasts.
import { h } from "../src/dom/h.ts";
import { action, isAction, type Action } from "../src/ui/action.ts";
import { askReason, confirm, prompt, openDialog, type ReasonWithPurpose } from "../src/ui/dialog.ts";
import { toast } from "../src/ui/toast.ts";
import { ActionButton } from "../src/ui/button.ts";
import { Menu, type MenuItem } from "../src/ui/menu.ts";

interface User { id: number; name: string }
const ada: User = { id: 1, name: "Ada" };

// action() infers run()'s arguments and result from fn …
const rename = action("Rename", async (row: User, name: string) => ({ ...row, name }), { success: (r) => `Renamed to ${r.name}` });
const renamed: Promise<User | undefined> = rename.run(ada, "Grace");
// @ts-expect-error — second argument must be a string
void rename.run(ada, 42);
// @ts-expect-error — missing argument
void rename.run(ada);

// … and with `reason`, the reason string fn receives last is not part of run()'s arguments.
const remove = action("Delete", (row: User, reason: string) => reason.length + row.id, {
  reason: 10, danger: true, confirm: (row) => `Delete ${row.name}?`, undo: (res, row, why) => { const n: number = res; const s: string = why; void row.id; void n; void s; },
});
const removed: Promise<number | undefined> = remove.run(ada);
const visible: boolean = remove.visible(ada);
// @ts-expect-error — run() takes only the row; the reason is asked for
void remove.run(ada, "because");
// @ts-expect-error — the row must be a User
void remove.run({ id: "x" });
// @ts-expect-error — hidden() receives the run() arguments (a User)
action("Archive", (row: User) => row.id, { hidden: (row: string) => row === "" });

// No-argument actions.
const refresh = action(() => "Refresh", () => 1);
const r1: Promise<number | undefined> = refresh.run();
// @ts-expect-error — takes no arguments
void refresh.run(1);

// Specific actions fit into generic lists (menus, toolbars, palette).
const list: Action[] = [rename, remove, refresh];
const items: MenuItem[] = [rename, "-", { label: "Open", onSelect: () => {} }, { separator: true }];
const unknownValue: unknown = remove;
if (isAction(unknownValue)) { const l: string = unknownValue.label(); void l; }
void h(ActionButton, { action: remove, args: [ada] });
void h(Menu, { label: "Row", items, args: [ada] });
void list; void renamed; void removed; void visible; void r1;

// askReason overloads: a string without purposes, { category, text } with purposes.
const why: Promise<string | null> = askReason({ min: 5 });
const why2: Promise<string | null> = askReason();
const withPurpose: Promise<ReasonWithPurpose | null> = askReason({ purposes: [{ value: "support", label: "Support" }] });
void withPurpose.then((r) => { if (r) { const c: string = r.category; const tx: string = r.text; void c; void tx; } });
// @ts-expect-error — with purposes the result is an object, not a string
const bad: Promise<string | null> = askReason({ purposes: [{ value: "a", label: "A" }] });
// @ts-expect-error — min is a number
void askReason({ min: "5" });
void why; void why2; void bad;

// confirm / prompt / openDialog / toast
const ok: Promise<boolean> = confirm({ title: "Sure?", danger: true });
const text: Promise<string | null> = prompt({ label: "Name", validate: (v) => (v.length ? null : "Required") });
// @ts-expect-error — validate receives a string
void prompt({ validate: (v: number) => String(v) });
const picked: Promise<number | undefined> = openDialog<number>((close) => { close(1); return null; });
const pickedOr: Promise<number> = openDialog<number>((close) => { close(2); return null; }, { dismissValue: 0, size: "sm" });
// @ts-expect-error — close takes a number
void openDialog<number>((close) => { close("x"); return null; });
// @ts-expect-error — unknown size
void openDialog(() => null, { size: "xl" });
const id: number = toast("Saved", { kind: "success", action: { label: "Undo", run: () => {} }, timeout: 0 });
toast.dismiss(id);
// @ts-expect-error — unknown kind
toast("x", { kind: "error" });
void ok; void text; void picked; void pickedOr;
