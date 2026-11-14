import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { CodeEditor, jsxCompleter } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const tick = () => new Promise((r) => setTimeout(r, 0));
/** The test DOM has no selection API on text fields: a caret, setSelectionRange and setRangeText are enough here. */
const caretOf = (input) => {
  if (input.setRangeText) return input;
  let at = input.value.length;
  Object.defineProperty(input, "selectionStart", { get: () => at, set: (v) => { at = v; }, configurable: true });
  input.setSelectionRange = (a) => { at = a; };
  input.setRangeText = (text, from, to) => { input.value = input.value.slice(0, from) + text + input.value.slice(to); };
  return input;
};
const type = (input, text, caret = text.length, data = text.slice(-1)) => {
  caretOf(input).value = text; input.setSelectionRange(caret, caret);
  const e = new Event("input", { bubbles: true }); e.inputType = "insertText"; e.data = data;
  input.dispatchEvent(e);
};
const key = (el, k, more = {}) => { const e = new Event("keydown", { bubbles: true, cancelable: true }); Object.assign(e, { key: k, code: k === " " ? "Space" : k }, more); el.dispatchEvent(e); return e; };

const PROPS = [{ name: "variant", hint: "look", values: ["primary", "ghost"] }, { name: "icon", value: "={plus}" }, { name: "disabled" }];

test("CodeEditor: the code is coloured, the value is two-way, marks wrap their range", async () => {
  const code = signal(`<Button variant="ghost">Ok</Button>`), marks = signal([]);
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, marks, label: "Button code", message: "fine" }));
  const input = el.querySelector("textarea.m-ced-input"), paint = el.querySelector(".m-ced-paint");
  assert.equal(input.value, code());
  assert.equal(input.getAttribute("aria-label"), "Button code");
  assert.equal(paint.getAttribute("aria-hidden"), "true");
  assert.equal(paint.textContent.replace("​", ""), code(), "the coloured copy holds the same text");
  assert.ok(paint.querySelector(".m-tok-tag") && paint.querySelector(".m-tok-attr") && paint.querySelector(".m-tok-str"), "tsx colours");
  type(input, `<Button variant="primary">Ok</Button>`);
  assert.equal(code(), `<Button variant="primary">Ok</Button>`);
  marks.set([{ from: 8, to: 25, kind: "flash" }, { from: 26, to: 28, kind: "error" }]);
  const [flash, error] = paint.querySelectorAll(".m-ced-mark");
  assert.ok(flash.classList.contains("is-flash") && flash.querySelector(".m-ced-glow"), "a new flash mark glows");
  assert.equal([...paint.querySelectorAll(".m-ced-mark.is-flash")].map((m) => m.textContent).join(""), `variant="primary"`);
  assert.ok(error.classList.contains("is-error") || paint.querySelector(".m-ced-mark.is-error"));
  assert.equal(paint.textContent.replace("​", ""), code(), "marks never change the text");
  assert.equal(el.querySelector(".m-ced-msg-text").textContent, "fine");
  assert.equal(input.getAttribute("aria-describedby"), el.querySelector(".m-ced-msg").id);
  await tick();
  dispose();
});

test("jsxCompleter: names after a space and on demand, values inside quotes, used names left out", () => {
  const complete = jsxCompleter({ tag: "Button", props: PROPS });
  const at = (before, more = {}) => complete({ value: before + (more.after ?? ""), caret: before.length, before, forced: false, typed: before.slice(-1), ...more });
  assert.deepEqual(at("<Button ").items.map((x) => x.label), ["variant", "icon", "disabled"]);
  assert.equal(at("<Button", { typed: "n" }), null, "the tag name is not a prop");
  assert.deepEqual(at("<Button va").items[0], { label: "variant", hint: "look", insert: `variant=""`, back: 1, again: true });
  assert.equal(at("<Button va").from, "<Button ".length);
  assert.deepEqual(at("<Button variant=\"ghost\" ").items.map((x) => x.label), ["icon", "disabled"]);
  assert.equal(at("<Button icon").items.length, 0, "an exact name offers nothing");
  assert.deepEqual(at("<Button ic").items[0], { label: "icon", insert: "icon={plus}" });
  const v = at(`<Button variant="g`, { after: `">` });
  assert.deepEqual(v.items.map((x) => x.insert), [`ghost"`]);
  assert.equal(v.to, `<Button variant="g`.length + 1, "the closing quote is replaced");
  assert.equal(at(`<Button icon={pl`), null, "inside braces: nothing");
  assert.equal(at(`<Button>te`), null, "outside the tag: nothing");
  assert.equal(at("<Button x", { typed: "" }).items.length, 0);
  assert.deepEqual(complete({ value: "<Button variant=\"ghost\"", caret: 23, before: "<Button variant=\"ghost\"", forced: true, typed: "" }), null, "right after a value: a space first");
  assert.equal(jsxCompleter({ props: PROPS })({ value: "<Card ", caret: 6, before: "<Card ", forced: true, typed: "" }).items.length, 3, "without a tag any tag is completed");
});

test("CodeEditor: the list opens while typing, Tab picks, the caret lands inside the quotes, Escape closes", async () => {
  const code = signal("<Button>Ok</Button>");
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, complete: jsxCompleter({ tag: "Button", props: PROPS }) }));
  const input = caretOf(el.querySelector("textarea"));
  assert.ok(el.querySelector(".m-ced-hint"), "the shortcut hint shows with `complete`");
  type(input, "<Button >Ok</Button>", 8, " ");
  await tick();
  const rows = () => [...document.querySelectorAll(".m-ced-list [role=option], .m-ced-list .m-list-row")];
  assert.ok(document.querySelector(".m-ced-list"), "the list is open");
  assert.ok(rows().length >= 3 || document.querySelector(".m-ced-list").textContent.includes("variant"));
  assert.ok(key(input, "Tab").defaultPrevented, "Tab picks instead of leaving");
  assert.equal(code(), `<Button variant="">Ok</Button>`);
  assert.equal(input.selectionStart, `<Button variant="`.length, "the caret is inside the quotes");
  await tick();
  assert.ok(document.querySelector(".m-ced-list")?.textContent.includes("ghost"), "asked again: the values");
  const esc = key(input, "Escape");
  assert.ok(esc.defaultPrevented);
  await tick();
  assert.ok(!key(input, "Tab").defaultPrevented, "no list: Tab leaves the field");
  // Ctrl + Space asks by hand
  input.setSelectionRange(`<Button variant="`.length, `<Button variant="`.length);
  assert.ok(key(input, " ", { ctrlKey: true, code: "Space" }).defaultPrevented);
  await tick();
  key(input, "Tab");
  assert.equal(code(), `<Button variant="primary">Ok</Button>`, "the first value replaces up to the closing quote");
  dispose();
});

test("CodeEditor: every part can be turned off or replaced", () => {
  const [el, dispose] = mount(() => [
    h(CodeEditor, { value: "a", message: false, copy: false, class: "bare" }),
    h(CodeEditor, { value: "a", message: "bad", status: "error", hint: h("b", { class: "own-hint" }, "F1"), copyLabel: "Al", multiline: false, readonly: true, lang: "" }),
    h(CodeEditor, { value: "a", message: "x", status: false, hint: false, complete: () => null, disabled: true }),
  ]);
  const [a, b, c] = el.querySelectorAll(".m-ced");
  assert.ok(a.classList.contains("bare"));
  assert.equal(a.querySelector(".m-ced-foot"), null, "message={false}: no foot bar");
  assert.equal(a.querySelector(".m-ced-input").getAttribute("aria-describedby"), null);
  assert.ok(b.querySelector(".m-ced-msg").classList.contains("is-error"));
  assert.ok(b.querySelector(".own-hint"), "own hint");
  assert.ok(b.querySelector(".m-ced-foot").textContent.includes("Al"), "own copy text");
  assert.ok(b.querySelector("textarea").hasAttribute("readonly"));
  assert.equal(b.querySelector(".m-ced-paint .m-tok-tag"), null, 'lang="": no colours');
  assert.ok(key(b.querySelector("textarea"), "Enter").defaultPrevented, "multiline={false}: Enter writes nothing");
  assert.equal(c.querySelector(".m-ced-hint"), null, "hint={false}");
  assert.equal(c.querySelector(".m-ced-msg .m-status-dot, .m-ced-msg [class*=dot]"), null, "status={false}: no dot");
  assert.ok(c.querySelector("textarea").hasAttribute("disabled"));
  dispose();
});
