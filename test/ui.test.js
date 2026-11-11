import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, serialize, Event } from "../src/testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { signal, h, render } = await import("../src/index.ts");
const R = await import("../src/router/index.ts");
const A = await import("../src/access/index.ts");
const U = await import("../src/ui/index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose, html: () => serialize(el) }; };
const key = (el, k, init = {}) => el.dispatchEvent(new Event("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
const input = (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
const top = () => { const all = document.body.querySelectorAll(".hm-overlay"); return all[all.length - 1]; };

test("confirm resolves true on OK, false on Cancel and on Escape", async () => {
  let p = U.confirm({ title: "Delete?", message: "Really" });
  assert.equal(top().querySelector('[role="alertdialog"]').getAttribute("aria-modal"), "true");
  top().querySelector("[data-ok]").click();
  assert.equal(await p, true);
  assert.equal(U.openDialogs(), 0);
  p = U.confirm({ title: "Delete?", danger: true });
  top().querySelector("[data-cancel]").click();
  assert.equal(await p, false);
  p = U.confirm({ title: "Again" });
  key(top(), "Escape");
  assert.equal(await p, false);
  assert.equal(document.body.querySelectorAll(".hm-overlay").length, 0);
});

test("prompt validates and resolves the text; cancel gives null", async () => {
  let p = U.prompt({ title: "Name", validate: (v) => (v.length < 3 ? "Too short" : null) });
  const inp = top().querySelector("input");
  input(inp, "ab");
  top().querySelector("[data-ok]").click();
  assert.match(top().querySelector(".hm-field-error").textContent, /Too short/);
  assert.equal(inp.getAttribute("aria-invalid"), "true");
  input(inp, "abc");
  key(inp, "Enter");
  assert.equal(await p, "abc");
  p = U.prompt({ title: "x" });
  top().querySelector("[data-cancel]").click();
  assert.equal(await p, null);
});

test("askReason enforces min length; purposes variant returns { category, text }", async () => {
  let p = U.askReason({ min: 10 });
  const ta = top().querySelector("textarea");
  input(ta, "short");
  top().querySelector("[data-ok]").click();
  assert.equal(U.openDialogs(), 1);
  assert.match(top().querySelector(".hm-field-error").textContent, /10/);
  input(ta, "a long enough reason");
  top().querySelector("[data-ok]").click();
  assert.equal(await p, "a long enough reason");

  p = U.askReason({ min: 5, purposes: [{ value: "support", label: "Support" }, { value: "audit", label: "Audit" }] });
  const sel = top().querySelector("select");
  input(top().querySelector("textarea"), "customer asked");
  top().querySelector("[data-ok]").click();
  assert.equal(U.openDialogs(), 1, "purpose required");
  sel.value = "audit";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  top().querySelector("[data-ok]").click();
  assert.deepEqual(await p, { category: "audit", text: "customer asked" });
  p = U.askReason({});
  key(top(), "Escape");
  assert.equal(await p, null);
});

test("dialog focus: autofocus, Tab trap, focus restore, stacking", async () => {
  const opener = h("button", {}, "open");
  document.body.appendChild(opener);
  opener.focus();
  const p = U.openDialog((close) => [h("input", { id: "first" }), h("button", { id: "last", onClick: () => close(42) }, "done")], { title: "T" });
  await tick();
  const panel = top().querySelector('[role="dialog"]');
  assert.equal(document.activeElement.id, "first");
  document.getElementById("last").focus();
  key(document.getElementById("last"), "Tab");
  assert.equal(document.activeElement.getAttribute("aria-label"), "Close", "wraps to the first focusable (close button)");
  key(document.activeElement, "Tab", { shiftKey: true });
  assert.equal(document.activeElement.id, "last");
  // a second dialog on top: Escape closes only the top one
  const p2 = U.confirm({ title: "inner" });
  assert.equal(U.openDialogs(), 2);
  key(top(), "Escape");
  assert.equal(await p2, false);
  assert.equal(U.openDialogs(), 1);
  assert.ok(panel.isConnected);
  document.getElementById("last").click();
  assert.equal(await p, 42);
  assert.equal(document.activeElement, opener);
  opener.remove();
});

test("declarative Dialog follows its open signal; overlay click dismisses", async () => {
  const open = signal(true);
  const m = mount(() => h(U.Dialog, { open, onClose: () => open.set(false), title: "Hi" }, h("p", {}, "body")));
  assert.equal(U.openDialogs(), 1);
  top().click();
  assert.equal(open(), false);
  assert.equal(U.openDialogs(), 0);
  m.dispose();
});

test("toast shows, runs its action, dismisses and times out", async () => {
  U.toast.clear();
  let undone = 0;
  const id = U.toast("Saved", { kind: "success", action: { label: "Undo", run: () => undone++ } });
  const host = document.body.querySelector(".hm-toasts");
  assert.equal(host.getAttribute("aria-live"), "polite");
  assert.match(host.textContent, /Saved/);
  host.querySelector(".hm-toast-action").click();
  await tick();
  assert.equal(undone, 1);
  assert.doesNotMatch(host.textContent, /Saved/);
  const id2 = U.toast("Bye");
  assert.match(host.textContent, /Bye/);
  U.toast.dismiss(id2);
  assert.equal(host.querySelectorAll(".hm-toast").length, 0);
  U.toast("Quick", { timeout: 5 });
  await tick(20);
  assert.equal(host.querySelectorAll(".hm-toast").length, 0);
  assert.ok(id !== id2);
});

test("Badge count shows 99+ and hides at zero", () => {
  const n = signal(5);
  const m = mount(() => h(U.Badge, { count: n }));
  assert.equal(m.el.textContent, "5");
  n.set(120);
  assert.equal(m.el.textContent, "99+");
  n.set(0);
  assert.equal(m.el.querySelector(".hm-badge"), null);
  assert.equal(U.countLabel(1000, 999), "999+");
  m.dispose();
});

test("Tabs: arrow keys move and activate; URL sync with ?tab=", async () => {
  R.createRouter({ routes: { "/": { component: () => null }, "/x": { component: () => null } } });
  await tick();
  const tabs = [{ id: "a", label: "A", content: () => "Panel A" }, { id: "b", label: "B", badge: () => 3, content: () => "Panel B" }, { id: "c", label: "C", content: () => "Panel C" }];
  const m = mount(() => h(U.Tabs, { tabs, query: "tab", label: "Sections" }));
  const panel = () => m.el.querySelector('[role="tabpanel"]').textContent;
  assert.equal(panel(), "Panel A");
  const [ta, tb] = m.el.querySelectorAll('[role="tab"]');
  assert.equal(ta.getAttribute("aria-selected"), "true");
  assert.equal(tb.getAttribute("tabindex"), "-1");
  ta.focus();
  key(ta, "ArrowRight");
  await tick();
  assert.equal(panel(), "Panel B");
  assert.equal(location.search, "?tab=b");
  key(document.activeElement, "End");
  await tick();
  assert.equal(panel(), "Panel C");
  key(document.activeElement, "ArrowRight"); // wraps
  await tick();
  assert.equal(panel(), "Panel A");
  R.navigate("/x?tab=c");
  await tick();
  assert.equal(panel(), "Panel C");
  m.dispose();
  R._resetRouter();
});

test("ActionButton hides without permission; runs confirm, then success toast", async () => {
  U.toast.clear();
  A.setAccess({ user: { id: 1 }, perms: [] });
  let ran = null;
  const del = U.action("Delete", (row) => { ran = row; return "ok"; }, { can: "users.delete", confirm: (row) => `Delete ${row}?`, success: "Deleted" });
  const m = mount(() => h(U.ActionButton, { action: del, args: ["ada"] }));
  assert.equal(m.el.querySelector("button"), null);
  A.setAccess({ user: { id: 1 }, perms: ["users.delete"] });
  const btn = m.el.querySelector("button");
  assert.ok(btn);
  btn.click();
  await tick();
  assert.match(top().textContent, /Delete ada\?/);
  top().querySelector("[data-ok]").click();
  await tick(); await tick();
  assert.equal(ran, "ada");
  assert.match(document.body.querySelector(".hm-toasts").textContent, /Deleted/);
  m.dispose();
  A.setAccess(null);
});

test("Menu: keyboard opens, arrows move, Escape closes; hidden actions are left out", async () => {
  let picked = 0;
  const secret = U.action("Secret", () => {}, { can: "nope" });
  const m = mount(() => h(U.Menu, { label: "Row", items: [{ label: "One", onSelect: () => picked++ }, "-", { label: "Two", onSelect: () => {} }, secret] }));
  const trigger = m.el.querySelector("button");
  key(trigger, "ArrowDown");
  await tick();
  const menu = document.body.querySelector('[role="menu"]');
  assert.ok(menu);
  const items = menu.querySelectorAll('[role="menuitem"]');
  assert.equal(items.length, 2);
  assert.equal(document.activeElement, items[0]);
  key(items[0], "ArrowDown");
  assert.equal(document.activeElement, items[1]);
  key(items[1], "Escape");
  assert.equal(document.body.querySelector('[role="menu"]'), null);
  assert.equal(document.activeElement, trigger);
  trigger.click();
  await tick();
  document.body.querySelector('[role="menuitem"]').click();
  assert.equal(picked, 1);
  assert.equal(document.body.querySelector('[role="menu"]'), null);
  m.dispose();
});

test("NavMenu: groups sort, collapse, pins and recent persist; filter folds and ranks", async () => {
  localStorage.clear();
  R.createRouter({ routes: { "/": { component: () => null }, "/users": { component: () => null }, "/users/:id": { component: () => null }, "/reports": { component: () => null } } });
  await tick();
  const items = [
    { id: "reports", title: "Reports", href: "/reports", group: "Insights" },
    { id: "users", title: "Üyeler", href: "/users", group: "People", keywords: "members users" },
    { id: "ist", title: "İstanbul office", href: "/ist", group: "People" },
    { id: "audit", title: "Audit log", href: "/audit", group: "Insights", can: "audit.read" },
  ];
  const nav = () => h(U.NavMenu, { items, storageKey: "t.nav", maxRecent: 3 });
  let m = mount(nav);
  const groups = () => m.el.querySelectorAll("[data-group]").map((b) => b.getAttribute("data-group"));
  assert.deepEqual(groups(), ["Insights", "People"]);
  assert.equal(m.el.querySelector('[data-id="audit"]'), null, "items without permission are hidden");
  const people = m.el.querySelector('[data-group="People"]');
  people.click();
  assert.equal(people.getAttribute("aria-expanded"), "false");
  m.el.querySelector('[data-pin="reports"]').click();
  R.navigate("/users/7");
  await tick();
  assert.equal(m.el.querySelector('[data-id="users"][data-where="recent"]'), null, "the current page is not repeated under Recent");
  R.navigate("/");
  await tick();
  assert.ok(m.el.querySelector('[data-id="users"][data-where="recent"]'), "visited pages show under Recent");
  assert.ok(m.el.querySelector('[data-id="reports"][data-where="pinned"]'));
  const saved = JSON.parse(localStorage.getItem("t.nav"));
  assert.deepEqual(saved, { collapsed: ["People"], pins: ["reports"], recent: ["users"] });
  m.dispose();
  m = mount(nav); // state comes back from storage
  assert.equal(m.el.querySelector('[data-group="People"]').getAttribute("aria-expanded"), "false");
  assert.ok(m.el.querySelector('[data-id="reports"][data-where="pinned"]'));
  const filter = m.el.querySelector(".hm-nav-filter input");
  input(filter, "ıstanbul");
  assert.deepEqual(m.el.querySelectorAll('[data-where="filter"]').map((a) => a.getAttribute("data-id")), ["ist"]);
  input(filter, "uyelr");
  assert.deepEqual(m.el.querySelectorAll('[data-where="filter"]').map((a) => a.getAttribute("data-id")), ["users"]);
  // pages are registered for the palette
  assert.ok(U.rank("reports", [{ title: "Reports" }]).length);
  m.dispose();
  R._resetRouter();
});

test("ranking: prefix beats fuzzy, Turkish folding, typo tolerance", () => {
  const list = [{ title: "Reset settings" }, { title: "Settings" }, { title: "Sitting room" }, { title: "Üyeler" }, { title: "Istanbul" }];
  const r = U.rank("set", list, (x) => x).map((x) => x.item.title);
  assert.equal(r[0], "Settings");
  assert.ok(r.indexOf("Settings") < r.indexOf("Reset settings"));
  assert.equal(U.fold("ıstanbul"), "istanbul");
  assert.equal(U.fold("İSTANBUL"), "istanbul");
  assert.equal(U.rank("ıstanbul", list, (x) => x)[0].item.title, "Istanbul");
  assert.equal(U.rank("uyelr", list, (x) => x)[0].item.title, "Üyeler");
  assert.equal(U.rank("zzz", list, (x) => x).length, 0);
  assert.ok(U.score("sett", "Settings") > U.score("setitngs", "Settings"));
});

test("CommandPalette: mod+k opens, ranks commands and pages, Enter runs, ask hook", async () => {
  let ran = "";
  const off = U.registerCommands([{ id: "new-user", title: "Create user", run: () => { ran = "create"; } }, { id: "export", title: "Export users", keywords: "csv", run: () => { ran = "export"; } }]);
  const offPages = U.registerPages([{ id: "members", title: "Üyeler", href: "/members" }]);
  let asked = null;
  const m = mount(() => h(U.CommandPalette, { ask: async (q) => { asked = q; return { results: [{ id: "export", reason: "matches intent" }] }; }, askDelay: 10 }));
  key(document.body, "k", { ctrlKey: true });
  assert.equal(U.paletteOpen(), true);
  await tick();
  const inp = top().querySelector(".hm-pal-input");
  assert.equal(document.activeElement, inp);
  input(inp, "crea");
  let rows = top().querySelectorAll('[role="option"]');
  assert.equal(rows[0].getAttribute("data-id"), "new-user");
  assert.equal(rows[rows.length - 1].classList.contains("hm-pal-ask"), true, "Ask row is last");
  input(inp, "uyelr");
  rows = top().querySelectorAll('[role="option"]');
  assert.equal(rows[0].getAttribute("data-id"), "members");
  // weak local results → ask() runs after the debounce
  input(inp, "move my data out");
  await tick(30);
  assert.equal(asked, "move my data out");
  rows = top().querySelectorAll('[role="option"]');
  assert.equal(rows[0].getAttribute("data-id"), "export");
  assert.match(rows[0].textContent, /matches intent/);
  key(inp, "Enter");
  assert.equal(ran, "export");
  assert.equal(U.paletteOpen(), false);
  // navigation keys
  U.openPalette();
  await tick();
  const inp2 = top().querySelector(".hm-pal-input");
  input(inp2, "user");
  key(inp2, "ArrowDown");
  assert.equal(top().querySelectorAll('[role="option"]')[1].getAttribute("aria-selected"), "true");
  key(inp2, "PageDown");
  const n = top().querySelectorAll('[role="option"]').length;
  assert.equal(top().querySelectorAll('[role="option"]')[n - 1].getAttribute("aria-selected"), "true");
  key(inp2, "Escape");
  assert.equal(U.paletteOpen(), false);
  off(); offPages(); m.dispose();
});

test("keys: mod+k, ignores inputs unless inInputs, cleanup with owner, shortcuts list", () => {
  let n = 0, m2 = 0;
  const off = U.key("mod+j", () => n++, { description: "Jump" });
  key(document.body, "j", { ctrlKey: true });
  assert.equal(n, 1);
  key(document.body, "j");
  assert.equal(n, 1, "modifier required");
  const field = h("input", {});
  document.body.appendChild(field);
  key(field, "j", { ctrlKey: true });
  assert.equal(n, 1, "ignored while typing");
  U.key("mod+u", () => m2++, { inInputs: true });
  key(field, "u", { ctrlKey: true });
  assert.equal(m2, 1);
  assert.ok(U.shortcuts().some((s) => s.description === "Jump" && s.label === "Ctrl+J"));
  off();
  key(document.body, "j", { ctrlKey: true });
  assert.equal(n, 1);
  let k = 0;
  const m = mount(() => { U.key("shift+?", () => k++); return null; });
  key(document.body, "?", { shiftKey: true });
  m.dispose();
  key(document.body, "?", { shiftKey: true });
  assert.equal(k, 1);
  field.remove();
  assert.equal(U.formatKey("mod+shift+k"), "Ctrl+Shift+K");
});

test("theme persists in localStorage and sets data-theme", () => {
  U.theme.set("dark");
  assert.equal(localStorage.getItem("hm.theme"), "dark");
  assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
  const m = mount(() => h(U.ThemeToggle, {}));
  m.el.querySelector("button").click(); // dark → system
  assert.equal(U.theme(), "system");
  assert.equal(document.documentElement.getAttribute("data-theme"), null);
  assert.throws(() => U.theme.set("pink"));
  m.dispose();
});

test("Page renders title, breadcrumbs and allowed actions only", () => {
  A.setAccess({ user: { id: 1 }, perms: ["a"] });
  const ok = U.action("Invite", () => {}, { can: "a" }), no = U.action("Purge", () => {}, { can: "b" });
  const m = mount(() => h(U.Page, { title: "Users", subtitle: "All members", breadcrumbs: [{ label: "Admin", href: "/admin" }, { label: "Users" }], actions: [ok, no, h("span", { class: "extra" }, "x")] }, h("p", {}, "content")));
  assert.equal(m.el.querySelector("h1").textContent, "Users");
  const btns = m.el.querySelectorAll(".hm-page-actions button").map((b) => b.textContent);
  assert.deepEqual(btns, ["Invite"]);
  assert.ok(m.el.querySelector(".hm-page-actions .extra"));
  assert.equal(m.el.querySelector('[aria-current="page"]').textContent, "Users");
  m.dispose();
  A.setAccess(null);
});

test("ListDetail switches pane state and shows back", () => {
  const sel = signal(null);
  const m = mount(() => h(U.ListDetail, { list: h("ul", {}, "list"), detail: () => h("p", { class: "d" }, "detail"), selected: sel, onBack: () => sel.set(null) }));
  const root = m.el.querySelector(".hm-ld");
  assert.equal(root.classList.contains("hm-ld-has-detail"), false);
  assert.equal(m.el.querySelector(".d"), null);
  sel.set(1);
  assert.ok(root.classList.contains("hm-ld-has-detail"));
  assert.ok(m.el.querySelector(".d"));
  m.el.querySelector(".hm-ld-back").click();
  assert.equal(sel(), null);
  m.dispose();
});

test("JsonView and CodeView render untrusted text as text only", () => {
  const evil = '<img src=x onerror="alert(1)">';
  const m = mount(() => [h(U.JsonView, { value: { name: evil, list: [1, null, true], nested: { deep: 1 } }, open: 1 }), h(U.CodeView, { code: `${evil}\nline 2` })]);
  assert.equal(m.el.querySelector("img"), null);
  assert.ok(m.html().includes("&lt;img"));
  assert.equal(m.el.querySelectorAll(".hm-code-line").length, 2);
  assert.equal(m.el.querySelectorAll(".hm-code-ln")[1].textContent, "2");
  const nested = m.el.querySelectorAll(".hm-json-toggle").find((b) => b.textContent.includes("nested"));
  assert.equal(nested.getAttribute("aria-expanded"), "false");
  nested.click();
  assert.equal(nested.getAttribute("aria-expanded"), "true");
  assert.match(m.el.textContent, /"deep"/);
  m.dispose();
});

test("components never emit style attribute strings", async () => {
  const m = mount(() => [
    h(U.Button, { variant: "primary", loading: true }, "Save"), h(U.IconButton, { icon: "✕", label: "Close" }),
    h(U.Card, { title: "C", subtitle: "s", footer: "f" }, "body"), h(U.Empty, { title: "None" }), h(U.Spinner, {}), h(U.ErrorBox, { error: new Error("x"), retry: () => {} }),
    h(U.Skeleton, { lines: 2 }), h(U.Alert, { tone: "warn", title: "t", dismissable: true }, "b"), h(U.Kbd, { keys: "mod+k" }), h(U.Avatar, { name: "Ada Lovelace" }),
    h(U.KeyValue, { items: { Email: "a@b.c" } }), h(U.Timeline, { items: [{ time: 0, title: "t" }] }), h(U.Stack, { gap: 2 }, "x"), h(U.Grid, { min: "10rem" }, "y"),
    h(U.Toolbar, {}, "z"), h(U.Divider, { label: "or" }), h(U.Pager, { page: 2, total: 45, size: 20 }), h(U.SearchBox, { placeholder: "Find" }), h(U.Loader, { text: "Wait" }),
    h(U.Tooltip, { text: "tip" }, h("button", {}, "b")), h(U.CopyButton, { text: "x" }), h(U.LocaleSelect, { options: ["en", "tr"] }), h(U.Section, { title: "S" }, "s"),
  ]);
  assert.doesNotMatch(m.html(), / style=/);
  assert.match(m.html(), /99\+|Ada|AL/);
  assert.equal(m.el.querySelector(".hm-avatar-text").textContent, "AL");
  assert.match(m.el.querySelector(".hm-pager-info").textContent, /21.40.*45/);
  m.dispose();
});

test("Pager and SearchBox basics", async () => {
  const page = signal(1), q = signal("");
  const m = mount(() => [h(U.Pager, { page, total: 45, size: 20, onPage: (p) => page.set(p) }), h(U.SearchBox, { value: q, debounce: 5 })]);
  m.el.querySelector("[data-next]").click();
  m.el.querySelector("[data-next]").click();
  assert.equal(page(), 3);
  assert.equal(m.el.querySelector("[data-next]").disabled, true);
  const inp = m.el.querySelector("input");
  input(inp, "ada");
  assert.equal(q(), "");
  await tick(20);
  assert.equal(q(), "ada");
  m.el.querySelector(".hm-search-clear").click();
  assert.equal(q(), "");
  m.dispose();
});

test("bootLoader.done removes #hm-boot", async () => {
  const el = h("div", { id: "hm-boot" });
  document.body.appendChild(el);
  assert.equal(U.bootLoader.done({ fade: 1 }), true);
  assert.ok(el.classList.contains("hm-boot-done"));
  await tick(10);
  assert.equal(el.isConnected, false);
});

test("AppShell places the nav and the main area", async () => {
  const { AppShell } = await import("../src/ui/layout.ts");
  const { h, render } = await import("../src/index.ts");
  const el = document.createElement("div");
  render(() => h(AppShell, { nav: h("nav", {}, "menu"), top: "banner" }, h("p", {}, "page")), el);
  assert.equal(el.querySelector(".hm-shell-nav").textContent, "menu");
  assert.equal(el.querySelector(".hm-shell-top").textContent, "banner");
  assert.equal(el.querySelector("main.hm-shell-main").textContent, "page");
});

test("Disclosure renders details/summary and reports toggles", async () => {
  const { Disclosure } = await import("../src/ui/disclosure.ts");
  const { h, render } = await import("../src/index.ts");
  const el = document.createElement("div");
  let last;
  render(() => h(Disclosure, { title: "More", onToggle: (o) => { last = o; } }, "body"), el);
  const d = el.querySelector("details");
  assert.equal(el.querySelector("summary").textContent, "More");
  d.open = true; d.dispatchEvent(new Event("toggle"));
  assert.equal(last, true);
});

test("component class names do not collide across stylesheets (tabs vs editor tabs, code block vs OTP input)", async () => {
  const { readFileSync } = await import("node:fs");
  const css = (f) => readFileSync(new URL(`../src/css/${f}`, import.meta.url), "utf8");
  const forms = css("forms.css"), ui = css("ui.css");
  // ui.css owns Tabs (.hm-tabs/.hm-tab) and CodeBlock (.hm-code); forms.css must not restyle them
  for (const cls of ["hm-tabs", "hm-tab", "hm-code"]) {
    if (cls !== "hm-tabs") assert.match(ui, new RegExp(`^\.${cls} \{`, "m"));
    assert.doesNotMatch(forms, new RegExp(`^\.${cls}[ \[{]`, "m"), `.${cls} is defined in forms.css too`);
  }
  assert.match(forms, /^\.hm-editor-tabs \{/m);
  assert.match(forms, /^\.hm-otp \{/m);
});
