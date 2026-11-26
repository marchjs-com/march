// maskInput on a real input element: Android-style beforeinput (inputType), paste, selection replace, Backspace over
// literals, IME composition, autofill without beforeinput, own undo / redo, eager placeholder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { maskInput } = await import("./index.ts");
const { cardNumber, phoneTR } = await import("./presets.ts");

function field() {
  const el = document.createElement("input");
  document.body.appendChild(el);
  // the test DOM has no selection API: keep one as plain properties
  el.selectionStart = el.selectionEnd = 0;
  el.setSelectionRange = (a, b) => { el.selectionStart = a; el.selectionEnd = b; };
  el.focus();
  return el;
}
const fire = (el, type, init = {}) => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, init);
  el.dispatchEvent(e);
  if (!e.defaultPrevented && type === "beforeinput") {
    // what the browser would do when nobody prevents it: insert / delete at the selection, then fire input
    const s = el.selectionStart, en = el.selectionEnd, v = el.value;
    if (init.inputType?.startsWith("insert")) { el.value = v.slice(0, s) + (init.data ?? "") + v.slice(en); el.selectionStart = el.selectionEnd = s + (init.data ?? "").length; }
    fire(el, "input", { inputType: init.inputType });
  }
  return e;
};
const typeKeys = (el, s) => { for (const ch of s) fire(el, "beforeinput", { inputType: "insertText", data: ch }); };
const back = (el, n = 1) => { for (let i = 0; i < n; i++) fire(el, "beforeinput", { inputType: "deleteContentBackward" }); };

test("typing keeps the caret after the typed digit, literals appear lazily", () => {
  const el = field(), seen = [];
  const m = maskInput(el, "(999) 999 99 99", { onChange: (v) => seen.push(v) });
  typeKeys(el, "555");
  assert.equal(el.value, "(555");
  assert.equal(el.selectionStart, 4);
  typeKeys(el, "1234567");
  assert.equal(el.value, "(555) 123 45 67");
  assert.equal(m.state().complete, true);
  assert.equal(seen.at(-1), "5551234567");
  // Backspace right after a literal: the digit before it goes, the caret stays in front of the next digit
  el.selectionStart = el.selectionEnd = 6; // "(555) |123"
  back(el);
  assert.equal(el.value, "(551) 234 56 7");
  assert.equal(el.selectionStart, 3);
});

test("refused characters, paste with junk, selection replace, word delete", () => {
  const el = field(), refused = [];
  maskInput(el, "(999) 999 99 99", { onReject: (t) => refused.push(t) });
  typeKeys(el, "x");
  assert.deepEqual(refused, ["x"]);
  assert.equal(el.value, "");
  fire(el, "beforeinput", { inputType: "insertFromPaste", dataTransfer: { getData: () => "tel: 0 (212) 444-55-66" } });
  assert.equal(el.value, "(021) 244 45 56");
  el.selectionStart = 1; el.selectionEnd = 4;
  fire(el, "beforeinput", { inputType: "insertText", data: "3" });
  assert.equal(el.value, "(324) 445 56");
  el.selectionStart = el.selectionEnd = el.value.length;
  fire(el, "beforeinput", { inputType: "deleteWordBackward" });
  assert.equal(el.value, "(324) 445");
});

test("IME: nothing is rewritten while composing; the result is masked when it ends", () => {
  const el = field();
  maskInput(el, { mask: "AAA-999", locale: "tr" });
  fire(el, "compositionstart");
  fire(el, "beforeinput", { inputType: "insertCompositionText", data: "ist", isComposing: true });
  assert.equal(el.value, "ist");
  fire(el, "compositionend");
  return new Promise((r) => queueMicrotask(r)).then(() => assert.equal(el.value, "İST"));
});

test("autofill without beforeinput is parsed; undo / redo with Ctrl+Z / Ctrl+Y and historyUndo", () => {
  const el = field();
  const m = maskInput(el, phoneTR(), { value: "parsed" });
  el.value = "+90 555 123 45 67"; el.selectionStart = el.selectionEnd = el.value.length;
  fire(el, "input");
  assert.equal(el.value, "(555) 123 45 67");
  assert.equal(m.state().value, "+905551234567");
  back(el, 2);
  assert.equal(el.value, "(555) 123 45");
  fire(el, "keydown", { key: "z", ctrlKey: true });
  assert.equal(el.value, "(555) 123 45 67");
  fire(el, "keydown", { key: "y", ctrlKey: true });
  assert.equal(el.value, "(555) 123 45");
  fire(el, "beforeinput", { inputType: "historyUndo" });
  assert.equal(el.value, "(555) 123 45 67");
});

test("eager placeholder, set() from outside, dynamic card mask and its name", () => {
  const el = field();
  const m = maskInput(el, "99.99.9999", { placeholder: "eager" });
  assert.equal(el.value, "__.__.____");
  typeKeys(el, "1");
  assert.equal(el.value, "1_.__.____");
  assert.equal(el.selectionStart, 1);
  const c = field();
  const cm = maskInput(c, cardNumber());
  cm.set("378282246310005");
  assert.equal(c.value, "3782 822463 10005");
  assert.equal(cm.state().name, "amex");
  assert.equal(cm.state().error, null);
  m.destroy();
});
