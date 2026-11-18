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
  let at = input.value.length, end = at;
  Object.defineProperty(input, "selectionStart", { get: () => at, set: (v) => { at = v; end = Math.max(end, v); }, configurable: true });
  Object.defineProperty(input, "selectionEnd", { get: () => Math.max(end, at), set: (v) => { end = v; }, configurable: true });
  input.setSelectionRange = (a, b = a) => { at = a; end = b; };
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
  assert.ok(el.querySelector(".m-ced-keys-btn"), "the shortcuts menu button");
  assert.equal(el.querySelector(".m-ced-hint"), null, "no Ctrl Space hint in the foot line");
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
  key(input, "Escape");
  assert.ok(!key(input, "Tab").defaultPrevented, "no list, after Esc: Tab leaves the field");
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
  assert.ok((b.querySelector(".m-ced-copy")?.getAttribute("aria-label") ?? "").includes("Al"), "own copy text (an icon button's name)");
  assert.ok(b.querySelector("textarea").hasAttribute("readonly"));
  assert.equal(b.querySelector(".m-ced-paint .m-tok-tag"), null, 'lang="": no colours');
  assert.ok(key(b.querySelector("textarea"), "Enter").defaultPrevented, "multiline={false}: Enter writes nothing");
  assert.equal(c.querySelector(".m-ced-hint"), null, "hint={false}");
  assert.equal(c.querySelector(".m-ced-msg .m-status-dot, .m-ced-msg [class*=dot]"), null, "status={false}: no dot");
  assert.ok(c.querySelector("textarea").hasAttribute("disabled"));
  dispose();
});

test("CodeEditor: source chips filter the rows; a row's head line is written at the top once", async () => {
  const code = signal("x");
  const picked = [];
  const complete = (c) => ({ from: c.caret - 1, items: [{ label: "Button", source: "march", head: 'import { Button } from "march/ui"' }, { label: "BigInt", source: "js" }] });
  const sources = [{ value: "march", label: "March" }, { value: "js", label: "JS" }, { value: "all", label: "All" }];
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, complete, sources, onSourceChange: (v) => picked.push(v) }));
  const input = caretOf(el.querySelector("textarea"));
  type(input, "B", 1, "B");
  await tick();
  const list = () => document.querySelector(".m-ced-list");
  const labels = () => [...list().querySelectorAll("[role=option]")].map((o) => o.textContent);
  assert.ok(labels().join().includes("Button") && !labels().join().includes("BigInt"), "the first chip: March rows only");
  const chip = (t) => [...list().querySelectorAll(".m-ced-sources .m-chip2")].find((c) => c.textContent === t).querySelector("button");
  chip("JS").click();
  await tick();
  assert.deepEqual(picked, ["js"]);
  assert.ok(labels().join().includes("BigInt") && !labels().join().includes("Button"));
  chip("March").click();
  await tick();
  key(input, "Tab");
  assert.equal(code(), 'import { Button } from "march/ui"\nButton', "the import is written at the top");
  dispose();
});

test("CodeEditor: suggest=\"ghost\" writes the likeliest row faintly (same case first); Tab takes it; Ctrl + Space opens the list", async () => {
  const code = signal("");
  const complete = (c) => { const w = /\w*$/.exec(c.before)[0]; return { from: c.caret - w.length, items: [{ label: "button" }, { label: "Button", head: "import { Button } from \"x\"" }] }; };
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, complete, suggest: "ghost" }));
  const input = caretOf(el.querySelector("textarea"));
  type(input, "B", 1, "B");
  await tick();
  assert.equal(document.querySelector(".m-ced-list"), null, "no list under listAfter (2 letters)");
  assert.equal(el.querySelector(".m-ced-ghost")?.textContent, "utton", "the row of the same case");
  assert.ok(key(input, "Tab").defaultPrevented);
  assert.equal(code(), "import { Button } from \"x\"\nButton", "Tab writes the row and its head line");
  assert.equal(el.querySelector(".m-ced-ghost"), null);
  type(input, "b", 1, "b");
  await tick();
  assert.equal(el.querySelector(".m-ced-ghost")?.textContent, "utton");
  key(input, "Escape");
  await tick();
  assert.equal(el.querySelector(".m-ced-ghost"), null, "Escape drops the ghost");
  key(input, " ", { ctrlKey: true, code: "Space" });
  await tick();
  assert.ok(document.querySelector(".m-ced-list"), "Ctrl + Space opens the list");
  dispose();
});

test("CodeEditor: a completion with open: true opens the list at once (after a space, with the ghost) and keeps it open while the word narrows it", async () => {
  const code = signal("");
  const props = [{ label: "variant" }, { label: "size" }, { label: "shape" }];
  // a tag's props: the place lists its words before anything is typed
  const complete = (c) => { const m = /<Button\s+([\w-]*)$/.exec(c.before); return m ? { from: c.caret - m[1].length, items: props, open: true } : null; };
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, complete, suggest: "ghost" }));
  const input = caretOf(el.querySelector("textarea"));
  type(input, "<Button ", 8, " ");
  await tick();
  assert.equal(document.querySelectorAll(".m-ced-list [role=option]").length, 3, "open after the space, nothing typed");
  type(input, "<Button s", 9, "s");
  await tick();
  assert.deepEqual([...document.querySelectorAll(".m-ced-list [role=option]")].map((o) => o.textContent.trim()).sort(), ["shape", "size"], "one letter (under the ghost's 2) keeps it open, narrowed");
  dispose();
});

test("CodeEditor: Tab on the ghost of a row with again opens the next list; rows with groups get group chips that filter", async () => {
  const code = signal("");
  const props = [{ label: "variant", insert: 'variant=""', back: 1, again: true, group: "March" }, { label: "sx", group: "Ortak" }, { label: "id", group: "HTML" }];
  const values = [{ label: "primary" }, { label: "ghost" }];
  const complete = (c) => {
    const v = /variant="(\w*)$/.exec(c.before);
    if (v) return { from: c.caret - v[1].length, items: values, all: true, open: true };
    const m = /<Button\s+([\w-]*)$/.exec(c.before);
    return m ? { from: c.caret - m[1].length, items: props, all: true, open: true } : null;
  };
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, complete, suggest: "ghost" }));
  const input = caretOf(el.querySelector("textarea"));
  type(input, "<Button ", 8, " ");
  await tick();
  const chips = [...document.querySelectorAll(".m-ced-groups button, .m-ced-groups [role=button], .m-ced-groups .m-chip")];
  assert.ok(chips.length >= 4, "a chip for every row and one per group");
  chips.find((c) => c.textContent.trim() === "Ortak").click();
  await tick();
  assert.deepEqual([...document.querySelectorAll(".m-ced-list [role=option]")].map((o) => o.textContent.trim()), ["sx"], "the group's rows only");
  chips[0].click();
  await tick();
  type(input, "<Button v", 9, "v");
  await tick();
  key(input, "Tab");
  await tick();
  assert.equal(code.peek(), '<Button variant=""');
  assert.deepEqual([...document.querySelectorAll(".m-ced-list [role=option]")].map((o) => o.textContent.trim()), ["primary", "ghost"], "the values open at once");
  dispose();
});

test("CodeEditor: a word written whole whose row writes more (icon → icon=\"\") is the ghost, not a longer name (iconEnd)", async () => {
  const code = signal("");
  const items = [{ label: "iconEnd", insert: 'iconEnd=""', back: 1 }, { label: "icon", insert: 'icon=""', back: 1 }];
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, suggest: "ghost", listAfter: 0, complete: (c) => ({ from: c.caret - (/\w*$/.exec(c.before)?.[0].length ?? 0), items }) }));
  const input = caretOf(el.querySelector("textarea"));
  type(input, "icon", 4, "n"); await tick();
  assert.equal(el.querySelector(".m-ced-ghost")?.textContent, '=""');
  key(input, "Tab");
  assert.equal(code(), 'icon=""');
  dispose();
});

test("CodeEditor: a line with an error / warning mark gets an icon in the gutter; onMessage makes the message a button; goTo puts the caret", async () => {
  const code = signal("a\nbb\ncc"), go = signal(null), opened = [];
  const marks = [{ from: 2, to: 4, kind: "error", title: "nope" }, { from: 5, to: 6, kind: "warning", title: "hmm" }];
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, lineNumbers: true, marks, message: "1 hata", onMessage: () => opened.push(1), goTo: go }));
  const ln = (n) => el.querySelector(`.m-ced-ln[data-line="${n}"]`);
  assert.ok(ln(2).classList.contains("is-error") && ln(2).querySelector(".m-ced-prob svg"), "line 2: the error icon");
  assert.equal(ln(2).getAttribute("title"), "nope");
  assert.ok(ln(3).classList.contains("is-warning"));
  assert.equal(ln(1).querySelector(".m-ced-prob"), null);
  el.querySelector("button.m-ced-msg-text").click();
  assert.deepEqual(opened, [1]);
  const input = caretOf(el.querySelector("textarea"));
  go.set({ from: 5, to: 7 });
  await tick(); await tick();
  assert.equal(input.selectionStart, 5, "the caret at the problem");
  dispose();
});

test("CodeEditor: typing in a tag's name renames its pair (<Row> → <Stack> changes </Row>); linkedTags={false} does not", async () => {
  for (const on of [true, false]) {
    const start = "<Row><Button /></Row>";
    const code = signal(start);
    const [el, dispose] = mount(() => h(CodeEditor, { value: code, lang: "tsx", linkedTags: on }));
    const input = caretOf(el.querySelector("textarea"));
    input.setSelectionRange(4, 4);
    const before = new Event("beforeinput", { bubbles: true, cancelable: true }); before.inputType = "insertText"; before.data = "s";
    input.dispatchEvent(before);
    type(input, "<Rows><Button /></Row>", 5, "s");
    await tick();
    assert.equal(code(), on ? "<Rows><Button /></Rows>" : "<Rows><Button /></Row>");
    dispose();
  }
});

test("CodeEditor: more carets: Ctrl+D picks the word then its next place; typing and Backspace happen at each, as one change; Escape drops them", async () => {
  const code = signal("let a = foo; foo(); foo");
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, lang: "ts" }));
  const input = caretOf(el.querySelector("textarea"));
  input.setSelectionRange(9, 9);
  key(input, "d", { ctrlKey: true, code: "KeyD" });
  assert.deepEqual([input.selectionStart, input.selectionEnd], [8, 11], "the word at the caret");
  key(input, "d", { ctrlKey: true, code: "KeyD" });
  assert.deepEqual([input.selectionStart, input.selectionEnd], [13, 16], "its next place");
  await tick();
  assert.equal(el.querySelectorAll(".m-ced-xsel").length, 1, "the first one stays, drawn as a selection");
  const typed = new Event("beforeinput", { bubbles: true, cancelable: true }); typed.inputType = "insertText"; typed.data = "x";
  input.dispatchEvent(typed);
  assert.ok(typed.defaultPrevented);
  assert.equal(code(), "let a = x; x(); foo", "both places written over");
  const back = new Event("beforeinput", { bubbles: true, cancelable: true }); back.inputType = "deleteContentBackward";
  input.dispatchEvent(back);
  assert.equal(code(), "let a = ; (); foo");
  key(input, "Escape");
  await tick();
  assert.equal(el.querySelectorAll(".m-ced-xcaret, .m-ced-xsel").length, 0, "one caret again");
  dispose();
});

test("CodeEditor: lineNumbers draw a number per line with its mark, the active line is lit, F9 and the gutter call onGutter", async () => {
  const marks = signal([{ line: 2, kind: "conditional", title: "if: x" }]), lit = signal(null), pressed = [];
  const [el, dispose] = mount(() => h(CodeEditor, { value: "a\nb\nc", lineNumbers: true, lineMarks: marks, activeLine: lit, onGutter: (line) => pressed.push(line) }));
  const lines = [...el.querySelectorAll(".m-ced-ln")];
  assert.deepEqual(lines.map((x) => x.getAttribute("data-line")), ["1", "2", "3"]);
  assert.ok(lines[1].classList.contains("is-conditional"));
  assert.equal(lines[1].getAttribute("title"), "if: x");
  assert.equal(el.querySelector(".m-ced-lit"), null);
  lit.set({ line: 3, kind: "exception" });
  assert.ok(el.querySelector(".m-ced-lit.is-exception"));
  assert.equal(el.querySelector(".m-ced-paint").textContent.replace(/​/g, ""), "a\nb\nc", "the text is unchanged");
  const input = caretOf(el.querySelector(".m-ced-input"));
  input.selectionStart = 2;
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "F9", bubbles: true }));
  assert.deepEqual(pressed, [2], "F9: the caret's line");
  assert.ok(el.querySelector(".m-ced.is-gutter .m-ced-gutter"), "the gutter's press area");
  dispose();
});

test("CodeEditor keys: Tab / Shift+Tab indent, Enter keeps the indent, Ctrl+/ comments, Alt+↓ moves, Ctrl+S saves, Esc then Tab leaves", () => {
  const code = signal("if (a) {\n  b()\n}");
  const saved = [];
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, lang: "ts", onSave: (v) => saved.push(v) }));
  const input = caretOf(el.querySelector("textarea"));
  const at = (n) => input.setSelectionRange(n, n);
  at(0); assert.ok(key(input, "Tab").defaultPrevented, "Tab stays in the editor");
  assert.equal(code(), "  if (a) {\n  b()\n}");
  at(2); key(input, "Tab", { shiftKey: true });
  assert.equal(code(), "if (a) {\n  b()\n}", "Shift+Tab takes the indent back");
  at(8); key(input, "Enter");
  assert.equal(code(), "if (a) {\n  \n  b()\n}", "after { one indent more");
  code.set("  x = 1"); at(7); key(input, "Enter");
  assert.equal(code(), "  x = 1\n  ", "the line's indent is kept");
  code.set("a()\nb()"); at(1); key(input, "/", { ctrlKey: true, code: "Slash" });
  assert.equal(code(), "// a()\nb()");
  at(1); key(input, "/", { ctrlKey: true, code: "Slash" });
  assert.equal(code(), "a()\nb()", "again: the comment goes");
  at(1); key(input, "ArrowDown", { altKey: true });
  assert.equal(code(), "b()\na()", "Alt+↓ moves the line down");
  at(1); key(input, "ArrowDown", { altKey: true, shiftKey: true });
  assert.equal(code(), "b()\nb()\na()", "Shift+Alt+↓ copies it");
  at(1); key(input, "K", { ctrlKey: true, shiftKey: true });
  assert.equal(code(), "b()\na()", "Ctrl+Shift+K deletes it");
  assert.ok(key(input, "s", { ctrlKey: true }).defaultPrevented);
  assert.deepEqual(saved, ["b()\na()"]);
  key(input, "Escape");
  assert.ok(!key(input, "Tab").defaultPrevented, "after Esc, Tab moves the focus on");
  // the shortcuts menu lists the keys that are on
  el.querySelector(".m-ced-keys-btn").click();
  const menu = document.querySelector(".m-ced-keys");
  assert.ok(menu && /Ctrl\+?\/?/.test(menu.textContent) && menu.querySelectorAll(".m-ced-key").length >= 8);
  dispose();
});

test("CodeEditor keys: keys={false} leaves Tab to the page; single keys turn off", () => {
  const code = signal("a");
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, keys: false }));
  const input = caretOf(el.querySelector("textarea"));
  assert.ok(!key(input, "Tab").defaultPrevented);
  dispose();
  const [el2, dispose2] = mount(() => h(CodeEditor, { value: code, keys: { indent: false } }));
  assert.ok(!key(caretOf(el2.querySelector("textarea")), "Tab").defaultPrevented);
  dispose2();
});

test("CodeEditor: a dot opens the list even with suggest=\"ghost\"; rows keep their groups and narrow as typed", async () => {
  const code = signal("console");
  const items = [{ label: "log", hint: "method", group: "Methods" }, { label: "error", hint: "method", group: "Methods" }, { label: "memory", hint: "property", group: "Properties" }];
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, suggest: "ghost", sources: [{ value: "march", label: "March" }], complete: (c) => ({ from: c.caret - (/\w*$/.exec(c.before)?.[0].length ?? 0), items, all: true }) }));
  const input = el.querySelector("textarea");
  type(input, "console.", 8, ".");
  await tick();
  const rows = () => [...document.querySelectorAll(".m-ced-list [role=option]")].map((o) => o.textContent);
  assert.equal(rows().length, 3, "every member, whatever source chip");
  assert.ok(document.querySelector(".m-ced-list .m-option-list-group"), "group headings");
  type(input, "console.lo", 10, "o");
  await tick();
  assert.equal(rows().length, 1);
  assert.match(rows()[0], /log/);
  dispose();
});

test("CodeEditor ranking: the shortest same-case start first (con → console), then March's rows, then the others; with the ghost the list opens from 2 letters", async () => {
  const code = signal("");
  const items = [
    { label: "consoleTransport", source: "march" }, { label: "Contrast", source: "march" }, { label: "constructor", source: "js" },
    { label: "console", source: "js" }, { label: "decode", source: "js" },
  ];
  const sources = [{ value: "march", label: "March" }, { value: "js", label: "JS" }, { value: "all", label: "All" }];
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, suggest: "ghost", sources, source: "all", complete: (c) => ({ from: c.caret - (/\w*$/.exec(c.before)?.[0].length ?? 0), items }) }));
  const input = el.querySelector("textarea");
  const rows = () => [...document.querySelectorAll(".m-ced-list [role=option]")].map((o) => o.textContent);
  type(input, "c", 1, "c"); await tick();
  assert.equal(rows().length, 0, "one letter: the ghost only");
  assert.equal(el.querySelector(".m-ced-ghost").textContent, "onsole", "the ghost is the best row already");
  type(input, "con", 3, "n"); await tick();
  assert.deepEqual(rows().map((r) => r.replace(/\s.*$/, "")), ["console", "consoleTransport", "Contrast", "constructor"]);
  assert.equal(el.querySelector(".m-ced-ghost").textContent, "sole", "ghost and list together");
  type(input, "c", 1, ""); await tick();
  assert.equal(rows().length, 0, "shorter again: the list closes");
  dispose();
});

test("CodeEditor: the row picked out shows its definition; ( and , show the signature with the parameter being written lit", async () => {
  const code = signal("");
  const items = [{ label: "table", hint: "method" }, { label: "time", hint: "method", doc: { kind: "method", signature: "time(label?: string): void" } }];
  const SIG = { active: 0, start: 14, items: [{ prefix: "table(", separator: ", ", suffix: "): void", doc: "Shows a table", params: [{ label: "data: any", doc: "the rows" }, { label: "columns?: string[]", doc: "which columns" }] }] };
  const asked = [];
  const [el, dispose] = mount(() => h(CodeEditor, { value: code,
    complete: (c) => ({ from: c.caret - (/\w*$/.exec(c.before)?.[0].length ?? 0), items, all: true }),
    describe: async (it) => (it.label === "table" ? { kind: "method", signature: "table(data: any, columns?: string[]): void", doc: "Shows a table" } : null),
    signature: ({ value }) => { asked.push(value); const arg = (value.slice(value.indexOf("(")).match(/,/g) ?? []).length; return value.includes("(") && !value.includes(")") ? { ...SIG, arg } : null; } }));
  const input = el.querySelector("textarea");
  type(input, "console.t", 9, "t"); await tick(); await tick();
  assert.match(document.querySelector(".m-ced-list .m-ced-doc")?.textContent ?? "", /time\(label/, "the first row (the shortest: time) brings its own definition");
  key(input, "ArrowDown"); await tick(); await tick();
  assert.match(document.querySelector(".m-ced-list .m-ced-doc")?.textContent ?? "", /table\(data: any/, "the next row's definition is asked");
  type(input, "console.table(", 14, "("); await tick();
  assert.match(document.querySelector(".m-ced-sig .is-on")?.textContent ?? "", /^data/);
  assert.match(document.querySelector(".m-ced-sig-doc")?.textContent ?? "", /the rows/);
  type(input, "console.table(x, ", 17, " "); await tick();
  assert.match(document.querySelector(".m-ced-sig .is-on")?.textContent ?? "", /^columns/, "a comma: the next parameter");
  type(input, "console.table(x, y)", 19, ")"); await tick();
  assert.equal(document.querySelector(".m-ced-sig"), null, ") ends the call");
  dispose();
});

test("CodeEditor ranking: the file's own names come before March's (chips' order), the best row still first", async () => {
  const code = signal("");
  const items = [{ label: "context", source: "march" }, { label: "connection", source: "file" }, { label: "conn", source: "file" }, { label: "console", source: "js" }];
  const sources = [{ value: "file", label: "File" }, { value: "march", label: "March" }, { value: "js", label: "JS" }, { value: "all", label: "All" }];
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, suggest: "ghost", sources, source: "all", complete: (c) => ({ from: c.caret - (/\w*$/.exec(c.before)?.[0].length ?? 0), items }) }));
  type(el.querySelector("textarea"), "con", 3, "n"); await tick();
  assert.deepEqual([...document.querySelectorAll(".m-ced-list [role=option]")].map((o) => o.textContent), ["conn", "connection", "context", "console"]);
  dispose();
});

test("CodeEditor code style: brackets coloured by depth, indent guides, the word's other places; each turns off", async () => {
  const code = signal("f(a[1])\n  x + x");
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, lang: "ts" }));
  const paint = el.querySelector(".m-ced-paint"), deco = el.querySelector(".m-ced-deco");
  assert.ok(el.querySelector(".m-ced").classList.contains("is-ide"), "the IDE palette by default");
  assert.deepEqual([...paint.querySelectorAll("[class^=m-tok-br]")].map((s) => s.className), ["m-tok-br0", "m-tok-br1", "m-tok-br1", "m-tok-br0"]);
  assert.equal(deco.getAttribute("aria-hidden"), "true");
  assert.equal(deco.textContent.replace("​", ""), code(), "the marks' layer holds the same text");
  assert.equal(deco.querySelectorAll(".m-ced-guide").length, 1, "one indent step");
  const input = caretOf(el.querySelector("textarea"));
  input.dispatchEvent(new Event("focus")); input.setSelectionRange(11, 11); key(input, "ArrowLeft"); input.dispatchEvent(new Event("keyup"));
  await tick();
  assert.equal(deco.querySelectorAll(".m-ced-occ").length, 2, "x and its other place");
  dispose();
  const [el2, dispose2] = mount(() => h(CodeEditor, { value: code, lang: "ts", palette: "theme", bracketColors: false, guides: false }));
  assert.ok(!el2.querySelector(".m-ced").classList.contains("is-ide"));
  assert.equal(el2.querySelector("[class^=m-tok-br]"), null);
  assert.equal(el2.querySelector(".m-ced-guide"), null);
  dispose2();
});

test("CodeEditor typing aids: ( writes its pair, the closer is stepped over, Backspace takes both, > closes a tag; autoClose={false} writes one", () => {
  const code = signal("f");
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, lang: "tsx" }));
  const input = caretOf(el.querySelector("textarea"));
  input.setSelectionRange(1, 1);
  assert.ok(key(input, "(").defaultPrevented);
  assert.equal(code(), "f()");
  assert.equal(input.selectionStart, 2, "the caret between");
  assert.ok(key(input, ")").defaultPrevented);
  assert.equal(code(), "f()", "the closer is stepped over");
  input.setSelectionRange(2, 2); key(input, "Backspace");
  assert.equal(code(), "f", "both go");
  code.set("<div"); input.setSelectionRange(4, 4); key(input, ">");
  assert.equal(code(), "<div></div>");
  dispose();
  const [el2, dispose2] = mount(() => h(CodeEditor, { value: code, autoClose: false }));
  const in2 = caretOf(el2.querySelector("textarea"));
  code.set("f"); in2.setSelectionRange(1, 1);
  assert.ok(!key(in2, "(").defaultPrevented, "the browser writes it alone");
  dispose2();
});

test("CodeEditor find: Ctrl+F opens the bar with the word at the caret, counts and lights the matches, Replace all is one edit, Esc closes; Ctrl+G goes to a line", async () => {
  const code = signal("let a = 1\na = a + 2");
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, lang: "ts" }));
  const input = caretOf(el.querySelector("textarea"));
  input.setSelectionRange(4, 4);
  assert.ok(key(input, "f", { ctrlKey: true, code: "KeyF" }).defaultPrevented);
  await tick();
  const bar = el.querySelector(".m-ced-find");
  assert.ok(bar, "the bar is open");
  assert.equal(bar.querySelector(".m-ced-find-field").value, "a", "the word at the caret");
  assert.equal(el.querySelectorAll(".m-ced-deco .m-ced-found").length, 3);
  assert.match(bar.querySelector(".m-ced-find-count").textContent, /\/3$/);
  key(input, "h", { ctrlKey: true, code: "KeyH" });
  await tick();
  const [, withField] = bar.querySelectorAll(".m-ced-find-field");
  withField.value = "b"; withField.dispatchEvent(new Event("input", { bubbles: true }));
  [...bar.querySelectorAll("button")].find((b) => /Tümü|All/.test(b.textContent)).click();
  assert.equal(code(), "let b = 1\nb = b + 2");
  key(input, "Escape");
  await tick();
  assert.equal(el.querySelector(".m-ced-find"), null, "Esc closes it");
  key(input, "g", { ctrlKey: true, code: "KeyG" });
  await tick();
  const line = [...el.querySelectorAll(".m-ced-find-field")].find((f) => /line|Satır/i.test(f.getAttribute("aria-label")));
  line.value = "2:3"; line.dispatchEvent(new Event("input", { bubbles: true }));
  key(line, "Enter");
  assert.equal(input.selectionStart, 12, "line 2, column 3");
  dispose();
  const [el2, dispose2] = mount(() => h(CodeEditor, { value: code, keys: { find: false } }));
  assert.ok(!key(caretOf(el2.querySelector("textarea")), "f", { ctrlKey: true, code: "KeyF" }).defaultPrevented, "keys={{ find: false }}: the browser's own find");
  dispose2();
});

test("CodeEditor: F12 selects the definition, F2 renames every place, Shift+Alt+F applies the format edits, Ctrl+= makes the text bigger", async () => {
  const code = signal("const ab = 1\nab + ab");
  const sizes = [];
  const [el, dispose] = mount(() => h(CodeEditor, {
    value: code, lang: "ts", onFontSizeChange: (px) => sizes.push(px),
    definition: ({ value, at }) => ({ from: value.indexOf("ab"), to: value.indexOf("ab") + 2, at }),
    rename: ({ value }) => ({ from: 6, to: 8, locations: [...value.matchAll(/ab/g)].map((m) => ({ from: m.index, to: m.index + 2 })) }),
    format: async () => [{ from: 13, to: 13, text: "  " }],
  }));
  const input = caretOf(el.querySelector("textarea"));
  input.setSelectionRange(14, 14);
  key(input, "F12"); await tick(); await tick();
  assert.equal(input.selectionStart, 6, "the definition's place");
  key(input, "F2"); await tick(); await tick();
  const field = document.querySelector(".m-ced-rename-field");
  assert.ok(field, "the rename field");
  assert.equal(field.value, "ab");
  field.value = "total"; field.dispatchEvent(new Event("input", { bubbles: true }));
  key(field, "Enter");
  assert.equal(code(), "const total = 1\ntotal + total");
  code.set("const ab = 1\nab+ab");
  key(input, "F", { shiftKey: true, altKey: true, code: "KeyF" }); await tick(); await tick();
  assert.equal(code(), "const ab = 1\n  ab+ab");
  assert.ok(key(input, "=", { ctrlKey: true, code: "Equal" }).defaultPrevented);
  assert.equal(sizes.length, 1);
  key(input, "0", { ctrlKey: true, code: "Digit0" });
  assert.equal(sizes[1], undefined, "Ctrl+0: the default size");
  dispose();
});

test("CodeEditor undo: Ctrl+Z undoes the editor's own steps (a command, typed text), Ctrl+Y redoes; history={false} leaves it to the browser", async () => {
  const code = signal("a");
  const [el, dispose] = mount(() => h(CodeEditor, { value: code, lang: "ts" }));
  const input = caretOf(el.querySelector("textarea"));
  input.setSelectionRange(1, 1);
  key(input, "(");
  assert.equal(code(), "a()");
  code.set("a() // set from outside");
  await tick();
  assert.ok(key(input, "z", { ctrlKey: true, code: "KeyZ" }).defaultPrevented);
  assert.equal(code(), "a()");
  key(input, "z", { ctrlKey: true, code: "KeyZ" });
  assert.equal(code(), "a");
  key(input, "y", { ctrlKey: true, code: "KeyY" });
  assert.equal(code(), "a()");
  dispose();
  const [el2, dispose2] = mount(() => h(CodeEditor, { value: code, history: false }));
  assert.ok(!key(caretOf(el2.querySelector("textarea")), "z", { ctrlKey: true, code: "KeyZ" }).defaultPrevented);
  dispose2();
});
