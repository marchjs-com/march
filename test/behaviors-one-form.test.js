// One meaning, one form: a behaviour that many components share is written the same way everywhere, through one
// function (ui/behave.ts, core/util.ts on(), ui/observe.ts), so it is the same code, behaves the same and is fixed in one place. The
// semantic map (docs/internal/semantic-map.md, section 2f) found these written several ways; the exceptions below are
// a different meaning that only looks alike, each with its reason.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const SKIP = /(\.test\.|demo\.tsx|playground\.ts|\.gen\.ts|\.d\.ts)$/;
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(n) && !SKIP.test(n)) files.push(relative(ROOT, p).split("\\").join("/"));
  }
})(join(ROOT, "src"));
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const hits = (re, allow = {}, only = /./) => files.filter((f) => only.test(f) && !allow[f] && re.test(src(f)));
// components and the UI helpers they are made of (managers, the router, data and test tools are page-wide services
// that install their listeners once for the page: another meaning)
const UI = /^src\/(components|ui|behaviors|forms)\//;

test("locked(props): one flag for disabled or readonly", () => {
  assert.deepEqual(hits(/\b(props\.)?disabled \|\| (props\.)?readonly\b|\b(props\.)?readonly \|\| (props\.)?disabled\b/, { "src/ui/behave.ts": "the definition" }), []);
});

test("isActivateKey(e): Enter or Space activates a control that is not a native button", () => {
  assert.deepEqual(hits(/\.key === "Enter" \|\| \w+\.key === " "|\.key === " " \|\| \w+\.key === "Enter"/, { "src/ui/behave.ts": "the definition" }), []);
});

test("keepFocus: a press that must not move the focus", () => {
  assert.deepEqual(hits(/onMouse[Dd]own: \(\w+(: \w+)?\) => \w+\.preventDefault\(\)/), []);
});

test("hover and move are pointer events (mouse, pen and touch alike)", () => {
  const allow = {
    "src/components/layout/device-preview/touch.ts": "turns mouse events into touch events (the device frame)",
    "src/motion/theme-paint.ts": "paints while the mouse button is held",
  };
  assert.deepEqual(hits(/\bonMouse(Enter|Leave|Move|Over|Out|enter|leave|move|over|out)\b|"mouse(enter|leave|move|over|out)"/, allow), []);
});

test("listeners on document / window go through on() (removed with the component)", () => {
  const allow = {
    "src/ui/keys.ts": "one listener for the whole page, installed once",
    "src/components/overlays/dialog/index.ts": "one Escape listener for the whole page, installed once",
    "src/ui/observe.ts": "the helpers themselves",
    "src/core/util.ts": "on() itself",
  };
  assert.deepEqual(hits(/\b(document|window|globalThis(\.document)?|doc)\??\.addEventListener\(|^\s*addEventListener\(/m, allow, UI), []);
});

test("following an element's size is observeSize() (disconnected with the component)", () => {
  const allow = {
    "src/ui/observe.ts": "observeSize itself",
    "src/components/data/virtual-list/index.ts": "one observer for every rendered row (heights per key)",
    "src/components/navigation/thread-nav/index.ts": "starts observing a box that exists only after the first frame",
    "src/components/layout/window/index.ts": "waits once until it is laid out (not a size)",
    "src/components/typography/overflow-text/index.ts": "waits once until laid out; then one observer for the box and its text",
  };
  assert.deepEqual(hits(/new (globalThis\.)?ResizeObserver\b|new RO0?\(/, allow, UI), []);
});

// h("tag", { onKeyDown }) — the DOM is case-insensitive here, the code is not: one spelling to read and to search
const SPLIT = { keydown: "KeyDown", keyup: "KeyUp", keypress: "KeyPress", gotpointercapture: "GotPointerCapture", lostpointercapture: "LostPointerCapture", dblclick: "DblClick", auxclick: "AuxClick", contextmenu: "ContextMenu", beforeinput: "BeforeInput", focusin: "FocusIn", focusout: "FocusOut", timeupdate: "TimeUpdate", loadedmetadata: "LoadedMetadata", animationend: "AnimationEnd", transitionend: "TransitionEnd", scrollend: "ScrollEnd", compositionstart: "CompositionStart", compositionend: "CompositionEnd" };
const EVENTS = new Set(["keydown", "keyup", "keypress", "pointerdown", "pointerup", "pointermove", "pointerenter", "pointerleave", "pointercancel", "pointerover", "pointerout", "gotpointercapture", "lostpointercapture", "mousedown", "mouseup", "mousemove", "mouseenter", "mouseleave", "mouseover", "mouseout", "focusin", "focusout", "focus", "blur", "dragstart", "dragend", "dragover", "dragenter", "dragleave", "drag", "drop", "dblclick", "click", "auxclick", "contextmenu", "beforeinput", "input", "change", "compositionstart", "compositionend", "touchstart", "touchend", "touchmove", "touchcancel", "animationend", "transitionend", "scroll", "scrollend", "wheel", "load", "error", "submit", "toggle", "paste", "copy", "cut", "select", "reset", "invalid", "play", "pause", "ended", "timeupdate", "loadedmetadata", "cancel", "close"]);
const canon = (ev) => {
  if (SPLIT[ev]) return "on" + SPLIT[ev];
  for (const p of ["pointer", "mouse", "touch", "drag"]) if (ev.startsWith(p) && ev.length > p.length) return "on" + p[0].toUpperCase() + p.slice(1) + ev[p.length].toUpperCase() + ev.slice(p.length + 1);
  return "on" + ev[0].toUpperCase() + ev.slice(1);
};
test("DOM event props have one spelling: onKeyDown, onPointerEnter, onFocusIn…", () => {
  const bad = [];
  for (const f of files) {
    const text = src(f);
    if (!/\bh\(\s*"/.test(text) && !f.endsWith(".tsx")) continue;
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const check = (key) => { if (!/^on[A-Za-z]+$/.test(key)) return; const ev = key.slice(2).toLowerCase(); if (EVENTS.has(ev) && canon(ev) !== key) bad.push(`${f}: ${key} → ${canon(ev)}`); };
    const visit = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "h" && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0]) && n.arguments[1] && ts.isObjectLiteralExpression(n.arguments[1]))
        for (const p of n.arguments[1].properties) if (p.name && ts.isIdentifier(p.name) && !ts.isShorthandPropertyAssignment(p)) check(p.name.text);
      if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && /^[a-z]/.test(n.tagName.getText(sf))) for (const a of n.attributes.properties) if (ts.isJsxAttribute(a)) check(a.name.getText(sf));
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  assert.deepEqual(bad, []);
});
