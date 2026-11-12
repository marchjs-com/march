import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, serialize, Event } from "../src/testing/dom.ts";
const { document } = installDom();
const { h, render, createRoot, signal, reactive, lazyChildren } = await import("../src/index.ts");
const { schema } = await import("../src/schema/index.ts");
const F = await import("../src/forms/index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose, html: () => serialize(el) }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });

test("useForm: validates on blur, re-validates on change, validates everything on submit", async () => {
  const s = schema({ name: { type: "text", required: true, min: 3 }, age: { type: "int", min: 18 } });
  let form;
  createRoot(() => { form = F.useForm(s, { age: 20 }); });
  form.set("name", "ab");
  assert.equal(form.errors.name, undefined, "no error before blur");
  form.blur("name");
  assert.match(form.errors.name, /at least 3/);
  form.set("name", "abc");
  assert.equal(form.errors.name, undefined, "fixed on change once shown");
  assert.equal(form.dirty(), true);
  form.set("name", ""); form.set("age", 12);
  assert.equal(await form.submit(), false);
  assert.match(form.errors.name, /required/);
  assert.match(form.errors.age, /at least 18/);
  form.reset();
  assert.deepEqual({ ...form.errors }, {});
  assert.equal(form.dirty(), false);

  let sform;
  createRoot(() => { sform = F.useForm(s, {}, { validateOn: "submit" }); });
  sform.set("name", "x"); sform.blur("name");
  assert.equal(sform.errors.name, undefined, "submit mode ignores blur");
  let cform;
  createRoot(() => { cform = F.useForm(s, {}, { validateOn: "change" }); });
  cform.set("name", "x");
  assert.match(cform.errors.name, /at least 3/);
});

test("useForm: submit coerces with schema.parse, focuses first invalid, maps server fieldErrors", async () => {
  const s = schema({ email: { type: "email", required: true }, price: "money", note: "text" });
  let got = null, fail = null;
  const { el } = mount(() => h(F.Form, { schema: s, initial: { price: "12,50" }, onSubmit: async (v) => { got = v; if (fail) throw fail; } }));
  const formEl = el.querySelector("form");
  formEl.requestSubmit();
  await tick();
  assert.equal(got, null);
  assert.equal(document.activeElement, el.querySelector("[name=email]"), "first invalid field focused");
  assert.equal(el.querySelector("[name=email]").getAttribute("aria-invalid"), "true");
  const errId = el.querySelector("[name=email]").getAttribute("aria-describedby");
  assert.match(document.getElementById(errId).textContent, /required/);

  type(el.querySelector("[name=email]"), "a@b.co");
  formEl.requestSubmit();
  await tick();
  assert.deepEqual(got, { email: "a@b.co", price: 12.5, note: "" });

  fail = Object.assign(new Error("Validation failed"), { fieldErrors: { email: "Already taken", other: "Server says no" } });
  formEl.requestSubmit();
  await tick();
  assert.match(el.textContent, /Already taken/);
  assert.match(el.querySelector(".hm-form-error").textContent, /Server says no/);
  fail = new Error("Network down");
  formEl.requestSubmit();
  await tick();
  assert.match(el.querySelector(".hm-form-error").textContent, /Network down/);
});

test("Form auto-renders active schema fields and honours when / hidden / required", async () => {
  const s = schema({
    kind: { type: "pick", options: [{ value: "person", label: "Person" }, { value: "company", label: "Company" }], default: "person", required: true },
    name: { type: "text", required: true, help: "Your full name" },
    company: { type: "text", when: (v) => v.kind === "company" },
    secret: { type: "hidden" },
    agree: { type: "bool", label: "I agree" },
  });
  const { el } = mount(() => h(F.Form, { schema: s, submitLabel: "Create", cancel: true }));
  assert.ok(el.querySelector("select[name=kind]"));
  assert.equal(el.querySelector("[name=company]"), null);
  assert.equal(el.querySelector("[name=secret]"), null);
  const nameInput = el.querySelector("[name=name]");
  assert.equal(el.querySelector(`label[for=${nameInput.id}]`).textContent.trim(), "Name *");
  assert.match(nameInput.getAttribute("aria-describedby"), /help/);
  assert.equal(el.querySelector("input[type=checkbox]").closest("label").textContent, "I agree");
  const sel = el.querySelector("select[name=kind]");
  sel.value = "1"; fire(sel, "change");
  assert.ok(el.querySelector("[name=company]"), "conditional field appears");
  sel.value = "0"; fire(sel, "change");
  assert.equal(el.querySelector("[name=company]"), null);
  assert.equal(el.querySelector("button[type=submit]").textContent, "Create");
});

test("Form with custom children uses useFormContext and Field", () => {
  const s = schema({ title: { type: "text", required: true } });
  let ctx;
  const Custom = () => { ctx = F.useFormContext(); return h("div", null, ctx.field("title", { help: "Short" }), h("input", ctx.register("title"))); };
  const { el } = mount(() => h(F.Form, { schema: s }, lazyChildren(() => h(Custom, {}))));
  const [a, b] = el.querySelectorAll("input");
  type(b, "Hello");
  assert.equal(ctx.values.title, "Hello");
  assert.equal(a.value, "Hello");
  assert.match(el.textContent, /Short/);
});

test("NumberInput parses decimal comma and point, never NaN", () => {
  const v = signal(null);
  const { el } = mount(() => h(F.NumberInput, { "bind:value": v, locale: "de" }));
  const input = el.querySelector("input");
  input.focus();
  type(input, "12,5"); assert.equal(v(), 12.5);
  type(input, "1.234,56"); assert.equal(v(), 1234.56);
  type(input, "1.234"); assert.equal(v(), 1234, "de: dot followed by 3 digits is grouping");
  type(input, "12.5"); assert.equal(v(), 12.5, "decimal point accepted too");
  type(input, "abc"); assert.equal(v(), 12.5, "garbage does not change the value");
  assert.equal(input.getAttribute("aria-invalid"), "true");
  input.blur();
  assert.equal(input.value, "12,5");
  assert.equal(input.getAttribute("aria-invalid"), null);
  type(input, ""); assert.equal(v(), null);
  assert.equal(F.parseNumber("1,234.5", "en"), 1234.5);
  assert.equal(F.parseNumber("12,5", "en"), 12.5);
  assert.ok(Number.isNaN(F.parseNumber("1e5", "en")));
  const n = signal(5);
  const m2 = mount(() => h(F.NumberInput, { "bind:value": n, min: 0, max: 6, locale: "en" }));
  const i2 = m2.el.querySelector("input");
  key(i2, "ArrowUp"); key(i2, "ArrowUp");
  assert.equal(n(), 6, "step clamps to max");
});

test("MoneyInput: currency symbol side, 2 decimals, grouping on blur; PercentInput stores a fraction", () => {
  const v = signal(null);
  const { el } = mount(() => h(F.MoneyInput, { "bind:value": v, currency: "EUR", locale: "de" }));
  const input = el.querySelector("input");
  assert.match(el.querySelector(".hm-affix-suffix").textContent, /€/);
  input.focus();
  type(input, "1234,5");
  assert.equal(v(), 1234.5);
  input.blur();
  assert.equal(input.value, "1.234,50");
  input.focus(); type(input, "12,345"); input.blur();
  assert.equal(v(), 12.35);
  const usd = mount(() => h(F.MoneyInput, { value: 3, currency: "USD", locale: "en" }));
  assert.equal(usd.el.querySelector(".hm-affix-prefix").textContent, "$");
  assert.equal(usd.el.querySelector("input").value, "3.00");
  const p = signal(0.125);
  const pm = mount(() => h(F.PercentInput, { "bind:value": p, locale: "en" }));
  const pi = pm.el.querySelector("input");
  assert.equal(pi.value, "12.5");
  pi.focus(); type(pi, "7"); assert.equal(p(), 0.07);
});

test("PhoneInput normalizes digits with an optional country prefix", () => {
  assert.equal(F.normalizePhone("0 (532) 111-22-33", "+90"), "+905321112233");
  assert.equal(F.normalizePhone("0044 20 7946 0000"), "+442079460000");
  const v = signal("");
  const { el } = mount(() => h(F.PhoneInput, { "bind:value": v, country: "+44" }));
  type(el.querySelector("input"), "07700 900123");
  assert.equal(v(), "+447700900123");
  assert.equal(el.querySelector("input").value, "7700900123");
});

test("CodeInput: typing advances, paste fills all boxes, onComplete fires once", () => {
  const v = signal("");
  const done = [];
  const { el } = mount(() => h(F.CodeInput, { "bind:value": v, length: 4, onComplete: (c) => done.push(c) }));
  const boxes = el.querySelectorAll("input");
  assert.equal(boxes.length, 4);
  assert.equal(boxes[0].getAttribute("autocomplete"), "one-time-code");
  assert.equal(boxes[0].getAttribute("inputmode"), "numeric");
  boxes[0].focus(); type(boxes[0], "7");
  assert.equal(document.activeElement, boxes[1]);
  type(boxes[1], "x");
  assert.equal(v(), "7", "non-digits ignored");
  fire(boxes[1], "paste", { clipboardData: { getData: () => " 12-34 " } });
  assert.equal(v(), "1234");
  assert.deepEqual(boxes.map((b) => b.value), ["1", "2", "3", "4"]);
  assert.deepEqual(done, ["1234"]);
  boxes[3].focus(); type(boxes[3], "");
  key(boxes[3], "Backspace");
  assert.equal(v(), "12");
  assert.equal(document.activeElement, boxes[2]);
});

test("Combobox: async search is debounced, keyboard picks an option", async () => {
  const calls = [];
  const people = [{ value: 1, label: "Alice" }, { value: 2, label: "Alfred" }, { value: 3, label: "Bob" }];
  const search = async (q) => { calls.push(q); return people.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())); };
  const v = signal(null);
  const { el } = mount(() => h(F.Combobox, { "bind:value": v, search, debounce: 20 }));
  const input = el.querySelector("input");
  input.focus();
  type(input, "a"); type(input, "al");
  assert.equal(input.getAttribute("aria-expanded"), "true");
  await tick(5);
  assert.deepEqual(calls, []);
  await tick(40);
  assert.deepEqual(calls, ["al"]);
  const opts = document.querySelectorAll("[role=option]");
  assert.deepEqual(opts.map((o) => o.textContent), ["Alice", "Alfred"]);
  assert.equal(input.getAttribute("aria-activedescendant"), opts[0].id);
  key(input, "ArrowDown");
  assert.equal(input.getAttribute("aria-activedescendant"), opts[1].id);
  key(input, "Enter");
  assert.equal(v(), 2);
  assert.equal(input.value, "Alfred");
  assert.equal(input.getAttribute("aria-expanded"), "false");
  assert.equal(document.querySelectorAll("[role=option]").length, 0);
});

test("Combobox static filtering and MultiSelect chips", () => {
  const v = signal(null);
  const { el } = mount(() => h(F.Combobox, { "bind:value": v, options: ["Ankara", "Berlin", "Bern"] }));
  const input = el.querySelector("input");
  type(input, "ber");
  assert.deepEqual(document.querySelectorAll("[role=option]").map((o) => o.textContent), ["Berlin", "Bern"]);
  key(input, "Enter");
  assert.equal(v(), "Berlin");
  const tags = signal(["a"]);
  const m = mount(() => h(F.MultiSelect, { "bind:value": tags, options: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }] }));
  assert.equal(m.el.querySelector(".hm-chip-label").textContent, "Alpha");
  const mi = m.el.querySelector("input");
  type(mi, "be"); key(mi, "Enter");
  assert.deepEqual(tags(), ["a", "b"]);
  key(mi, "Backspace");
  assert.deepEqual(tags(), ["a"]);
  m.el.querySelector(".hm-chip-x").click();
  assert.deepEqual(tags(), []);
});

test("Calendar keyboard navigation with min / max", () => {
  const v = signal("2026-03-14");
  const { el } = mount(() => h(F.Calendar, { "bind:value": v, min: "2026-03-10", max: "2026-04-20", firstDay: 1, locale: "en" }));
  const grid = el.querySelector("[role=grid]");
  const focused = () => el.querySelector(`[tabindex="0"][data-date]`).getAttribute("data-date");
  assert.equal(focused(), "2026-03-14");
  assert.equal(el.querySelector(`[data-date="2026-03-09"]`).getAttribute("aria-disabled"), "true");
  assert.equal(el.querySelector(`[data-date="2026-03-14"]`).getAttribute("aria-selected"), "true");
  assert.equal(el.querySelector(".hm-cal-wd").textContent, "Mon");
  key(grid, "ArrowRight"); assert.equal(focused(), "2026-03-15");
  assert.equal(document.activeElement.getAttribute("data-date"), "2026-03-15");
  key(grid, "ArrowDown"); assert.equal(focused(), "2026-03-22");
  key(grid, "Home"); assert.equal(focused(), "2026-03-16", "week starts Monday");
  key(grid, "End"); assert.equal(focused(), "2026-03-22");
  key(grid, "PageDown"); assert.equal(focused(), "2026-04-20", "clamped to max");
  assert.match(el.querySelector(".hm-cal-title").textContent, /April 2026/);
  key(grid, "PageUp"); key(grid, "PageUp"); assert.equal(focused(), "2026-03-10", "clamped to min");
  key(grid, "ArrowLeft"); assert.equal(focused(), "2026-03-10");
  key(grid, "Enter");
  assert.equal(v(), "2026-03-10");
});

test("DatePicker parses locale input and opens a calendar", async () => {
  const v = signal(null);
  const { el } = mount(() => h(F.DatePicker, { "bind:value": v, locale: "de", firstDay: 1 }));
  const input = el.querySelector("input");
  assert.equal(input.getAttribute("placeholder"), "DD.MM.YYYY");
  input.focus(); type(input, "14.3.2026");
  assert.equal(v(), "2026-03-14");
  input.blur();
  assert.equal(input.value, "14.03.2026");
  assert.equal(F.parseDate("3/14/26", "en-US"), "2026-03-14");
  assert.equal(F.parseDate("31.02.2026", "de"), undefined);
  el.querySelector("button").click();
  await tick(5);
  const day = document.querySelector(`.hm-cal-pop [data-date="2026-03-20"]`);
  assert.ok(day);
  assert.equal(document.activeElement.getAttribute("data-date"), "2026-03-14");
  day.click();
  assert.equal(v(), "2026-03-20");
  assert.equal(document.querySelector(".hm-cal-pop"), null, "popover closed");
});

test("DateRangePicker presets", () => {
  const p = F.rangePresets("2026-03-14");
  assert.deepEqual(p.find((x) => x.id === "7d").range, { from: "2026-03-08", to: "2026-03-14" });
  assert.deepEqual(p.find((x) => x.id === "month").range, { from: "2026-03-01", to: "2026-03-14" });
  assert.deepEqual(p.find((x) => x.id === "90d").range.from, "2025-12-15");
  const v = signal(null);
  const { el } = mount(() => h(F.DateRangePicker, { "bind:value": v, today: "2026-03-14" }));
  const btn = (label) => el.querySelectorAll("[role=radio]").find((b) => b.textContent === label);
  btn("Last 30 days").click();
  assert.deepEqual(v(), { from: "2026-02-13", to: "2026-03-14" });
  assert.equal(btn("Last 30 days").getAttribute("aria-checked"), "true");
  assert.equal(el.querySelectorAll(".hm-date-input").length, 0);
  btn("Custom").click();
  assert.equal(el.querySelectorAll(".hm-date-input").length, 2);
});

test("FileUpload: maxSize and accept errors, progress and cancel via upload()", async () => {
  const v = signal(null);
  const big = new File(["x".repeat(2000)], "big.png", { type: "image/png" });
  const txt = new File(["hi"], "a.txt", { type: "text/plain" });
  const m1 = mount(() => h(F.FileUpload, { "bind:value": v, maxSize: 1000, accept: "image/*" }));
  const zone = m1.el.querySelector(".hm-drop");
  fire(zone, "drop", { dataTransfer: { files: [big] } });
  assert.match(m1.el.querySelector(".hm-upload-errors").textContent, /big\.png is too large \(max 1,000 B\)|big\.png is too large/);
  assert.equal(v(), null);
  fire(zone, "drop", { dataTransfer: { files: [txt] } });
  assert.match(m1.el.textContent, /not allowed/);
  const ok = new File(["ok"], "ok.png", { type: "image/png" });
  fire(zone, "drop", { dataTransfer: { files: [ok] } });
  assert.equal(v(), ok);
  assert.ok(m1.el.querySelector("img.hm-file-thumb").getAttribute("src").startsWith("blob:"));

  const uploads = [];
  const upload = (file, { onProgress, signal: sig }) => new Promise((resolve, reject) => { uploads.push({ file, onProgress, resolve, sig }); sig.addEventListener("abort", () => reject(new Error("aborted"))); });
  const r = signal([]);
  const m2 = mount(() => h(F.FileUpload, { "bind:value": r, upload, multiple: true }));
  fire(m2.el.querySelector(".hm-drop"), "drop", { dataTransfer: { files: [new File(["1"], "one.pdf"), new File(["2"], "two.pdf")] } });
  await tick();
  assert.equal(uploads.length, 2);
  uploads[0].onProgress(0.5);
  assert.equal(m2.el.querySelector("[role=progressbar]").getAttribute("aria-valuenow"), "50");
  uploads[0].onProgress({ loaded: 3, total: 4 });
  assert.equal(m2.el.querySelector("[role=progressbar]").getAttribute("aria-valuenow"), "75");
  uploads[0].resolve({ url: "https://cdn/one.pdf" });
  await tick();
  assert.deepEqual(r(), [{ url: "https://cdn/one.pdf" }]);
  const cancel = m2.el.querySelectorAll("button").find((b) => b.textContent === "Cancel");
  cancel.click();
  assert.equal(uploads[1].sig.aborted, true);
  assert.equal(m2.el.querySelectorAll(".hm-file").length, 1);
  m2.dispose();
});

test("JsonEditor reports parse errors with line / column and formats", () => {
  const v = signal({ a: 1 });
  const { el } = mount(() => h(F.JsonEditor, { "bind:value": v, validate: (x) => (x && x.a > 5 ? "a is too big" : null) }));
  const ta = el.querySelector("textarea");
  assert.equal(ta.value, '{\n  "a": 1\n}');
  type(ta, '{\n  "a": }');
  assert.match(el.querySelector("[role=status]").textContent, /Invalid JSON at line 2, column \d+/);
  assert.equal(ta.getAttribute("aria-invalid"), "true");
  assert.equal(typeof v(), "string");
  type(ta, '{"a":9}');
  assert.deepEqual(v(), { a: 9 });
  assert.match(el.textContent, /a is too big/);
  type(ta, '{"a":2,"b":[1]}');
  el.querySelectorAll("button").find((b) => b.textContent === "Format").click();
  assert.equal(ta.value, '{\n  "a": 2,\n  "b": [\n    1\n  ]\n}');
  assert.deepEqual(F.parseJson('[1,\n2,,]').line, 2);
});

test("Markdown renders a safe subset: HTML is text, javascript: links are not links", () => {
  const { el, html } = mount(() => h(F.Markdown, { source: "# Title\n\n<img src=x onerror=alert(1)> **bold** _it_ `code`\n\n[bad](javascript:alert(1)) [bad2](java\tscript:x) [ok](https://example.com)\n\n- one\n- two\n\n> quote\n\n```js\nlet a = '<b>';\n```" }));
  const s = html();
  assert.match(s, /<h1>Title<\/h1>/);
  assert.match(s, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.equal(el.querySelector("img"), null);
  assert.match(s, /<strong>bold<\/strong> <em>it<\/em> <code>code<\/code>/);
  const links = el.querySelectorAll("a");
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute("href"), "https://example.com");
  assert.equal(links[0].getAttribute("rel"), "noopener noreferrer nofollow");
  assert.match(s, /<span>bad<\/span>/);
  assert.equal(el.querySelectorAll("ul li").length, 2);
  assert.match(s, /<blockquote><p>quote<\/p><\/blockquote>/);
  assert.match(s, /<pre><code class="language-js">let a = '&lt;b&gt;';<\/code><\/pre>/);
  assert.equal(F.isSafeLink("JaVaScRiPt:alert(1)"), false);
  assert.equal(F.isSafeLink("/docs"), true);
  assert.equal(F.isSafeLink("data:text/html,x"), false);
});

test("MarkdownEditor switches between write and preview", () => {
  const v = signal("**hi**");
  const { el } = mount(() => h(F.MarkdownEditor, { "bind:value": v }));
  const [write, preview] = el.querySelectorAll("[role=tab]");
  assert.equal(write.getAttribute("aria-selected"), "true");
  preview.click();
  assert.match(serialize(el), /<strong>hi<\/strong>/);
  write.click();
  type(el.querySelector("textarea"), "*x*");
  assert.equal(v(), "*x*");
});

test("ListEditor: paste lines, edit, reorder, remove; KeyValueEditor", () => {
  const v = signal(["a"]);
  const { el } = mount(() => h(F.ListEditor, { "bind:value": v }));
  const draft = el.querySelector(".hm-list-add input");
  fire(draft, "paste", { clipboardData: { getData: () => "b\n c \n\na" } });
  assert.deepEqual(v(), ["a", "b", "c"], "one item per line, trimmed, unique");
  const rows = () => el.querySelectorAll(".hm-list-row input");
  type(rows()[1], "B");
  assert.deepEqual(v(), ["a", "B", "c"]);
  el.querySelectorAll(".hm-list-row")[2].querySelectorAll(".hm-icon-btn")[0].click();
  assert.deepEqual(v(), ["a", "c", "B"]);
  el.querySelectorAll(".hm-list-row")[0].querySelectorAll(".hm-icon-btn")[2].click();
  assert.deepEqual(v(), ["c", "B"]);
  assert.equal(rows()[0].value, "c");
  type(draft, "d"); key(draft, "Enter");
  assert.deepEqual(v(), ["c", "B", "d"]);

  const o = signal({ a: "1" });
  const kv = mount(() => h(F.KeyValueEditor, { "bind:value": o, numbers: true }));
  kv.el.querySelector(".hm-kv-add").click();
  const inputs = kv.el.querySelectorAll(".hm-kv-row input");
  type(inputs[2], "b"); type(inputs[3], "42");
  assert.deepEqual(o(), { a: 1, b: 42 });
  type(inputs[2], "a");
  assert.match(kv.el.textContent, /Duplicate key/);
});

test("Wizard validates each step before moving on and submits at the end", async () => {
  const s1 = schema({ name: { type: "text", required: true } });
  const s2 = schema({ email: { type: "email", required: true }, plan: { type: "pick", options: ["free", "pro"], default: "free" } });
  let done = null;
  const { el } = mount(() => h(F.Wizard, {
    steps: [{ title: "You", schema: s1 }, { title: "Account", schema: s2, validate: (v) => (v.plan === "pro" && !v.email.endsWith(".com") ? "Pro needs a .com address" : null) }],
    onSubmit: (v) => { done = v; },
  }));
  const formEl = el.querySelector("form");
  assert.match(el.querySelector(".hm-wizard-title").textContent, /You/);
  formEl.requestSubmit();
  assert.match(el.textContent, /required/);
  assert.match(el.querySelector(".hm-wizard-title").textContent, /You/);
  type(el.querySelector("[name=name]"), "Ada");
  formEl.requestSubmit();
  assert.match(el.querySelector(".hm-wizard-title").textContent, /Account/);
  assert.equal(el.querySelector("[aria-current=step]").textContent, "2Account");
  type(el.querySelector("[name=email]"), "ada@lab.org");
  const sel = el.querySelector("select[name=plan]"); sel.value = "1"; fire(sel, "change");
  formEl.requestSubmit();
  assert.match(el.textContent, /Pro needs a \.com address/);
  type(el.querySelector("[name=email]"), "ada@lab.com");
  assert.equal(el.querySelector("button[type=submit]").textContent, "Finish");
  formEl.requestSubmit();
  await tick();
  assert.deepEqual(done, { name: "Ada", email: "ada@lab.com", plan: "pro" });
  el.querySelectorAll("button").find((b) => b.textContent === "Back").click();
  assert.match(el.querySelector(".hm-wizard-title").textContent, /You/);
});

test("EditForm: load, dirty, reason, changed fields, toast, reload, fieldErrors", async () => {
  const s = schema({ name: { type: "text", required: true }, email: "email", limit: "int" });
  let server = { name: "Ada", email: "ada@x.io", limit: 5 };
  let loads = 0, saved = null, failNext = null;
  const asked = [], toasts = [];
  const { el } = mount(() => h(F.EditForm, {
    schema: s, title: "Account", reason: 5,
    load: async () => { loads++; return { ...server }; },
    save: async (values, ctx) => { if (failNext) { const e = failNext; failNext = null; throw e; } saved = { values, ctx }; server = { ...values }; },
    ask: async (o) => { asked.push(o); return "fix typo in email"; },
    notify: (m, o) => toasts.push([m, o.kind]),
  }));
  assert.ok(el.querySelector(".hm-form-skeleton"));
  await tick();
  assert.equal(loads, 1);
  const email = el.querySelector("[name=email]");
  assert.equal(email.value, "ada@x.io");
  const submit = el.querySelector("button[type=submit]");
  assert.equal(submit.disabled, true, "nothing to save yet");
  type(email, "ada@y.io");
  assert.equal(submit.disabled, false);
  assert.match(el.textContent, /Unsaved changes/);
  el.querySelector("form").requestSubmit();
  await tick(); await tick();
  assert.equal(asked[0].min, 5);
  assert.deepEqual(saved.ctx, { reason: "fix typo in email", changed: { email: "ada@y.io" } });
  assert.deepEqual(toasts, [["Saved", "success"]]);
  assert.equal(loads, 2, "reloaded after save");
  assert.doesNotMatch(el.textContent, /Unsaved changes/);

  type(el.querySelector("[name=name]"), "Ada L");
  failNext = Object.assign(new Error("bad"), { fieldErrors: { name: "Name is taken" } });
  el.querySelector("form").requestSubmit();
  await tick(); await tick();
  assert.match(el.textContent, /Name is taken/);
  el.querySelectorAll("button").find((b) => b.textContent === "Reset").click();
  assert.equal(el.querySelector("[name=name]").value, "Ada");
});

test("EditForm shows load errors with Retry", async () => {
  let n = 0;
  const { el } = mount(() => h(F.EditForm, { schema: schema({ a: "text" }), load: async () => { if (n++ === 0) throw new Error("offline"); return { a: "x" }; }, save: async () => {} }));
  await tick();
  assert.match(el.querySelector("[role=alert]").textContent, /offline/);
  el.querySelectorAll("button").find((b) => b.textContent === "Retry").click();
  await tick();
  assert.equal(el.querySelector("[name=a]").value, "x");
});

test("inputFor / registerInput map schema types to controls", () => {
  assert.equal(F.inputFor({ type: "money" }), F.MoneyInput);
  assert.equal(F.inputFor({ type: "pick", control: "radio" }), F.RadioGroup);
  const Custom = () => h("b", null, "custom");
  F.registerInput("iban", Custom);
  assert.equal(F.inputFor({ type: "text", control: "iban" }), Custom);
  const s = schema({ size: { type: "pick", options: ["S", "M", "L"], control: "segmented" }, on: { type: "bool", control: "switch" } });
  const { el } = mount(() => h(F.Form, { schema: s }));
  assert.equal(el.querySelectorAll("[role=radio]").length, 3);
  assert.equal(el.querySelector("[role=radiogroup]").getAttribute("aria-labelledby"), el.querySelector(".hm-label").id);
  el.querySelector("[role=switch]").click();
  assert.equal(el.querySelector("[role=switch]").getAttribute("aria-checked"), "true");
  void reactive;
});

test("TextInput autofocus and CodeInput masked boxes", async () => {
  const { TextInput, CodeInput } = await import("../src/forms/index.ts");
  const { h, render } = await import("../src/index.ts");
  const el = document.createElement("div");
  render(() => [h(TextInput, { autofocus: true }), h(CodeInput, { length: 4, masked: true })], el);
  assert.equal(el.querySelector("input").hasAttribute("autofocus"), true);
  assert.equal(el.querySelectorAll(".hm-otp-box").every((b) => b.getAttribute("type") === "password"), true);
});
