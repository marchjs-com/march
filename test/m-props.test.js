// m: common props (m:no-select): compiler output, runtime on elements and components, the CSS rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { compile, M_ATTRS } from "../compiler/index.js";
import { installDom } from "../src/testing/dom.ts";

const RT = new URL("../src/index.ts", import.meta.url).href;
const PROPS = new URL("../src/props/index.ts", import.meta.url).href;
const c = (src, o = {}) => compile(src, { runtime: RT, props: PROPS, ...o }).code;
const ATTR = "data-m-no-select";

test("compiler: a constant m:no-select on a native element is a plain attribute (no runtime helper)", () => {
  assert.equal(M_ATTRS["no-select"], ATTR);
  const on = c("const a = <div m:no-select><input /></div>");
  assert.match(on, /\["data-m-no-select",""\]/);
  assert.ok(on.includes('import "hadi-march/css/props.css";'), "only the CSS file is loaded");
  assert.doesNotMatch(on, /mProps/);
  assert.match(c("const a = <div m:no-select={true}>x</div>"), /\["data-m-no-select",""\]/);
  assert.match(c("const a = <div m:no-select={false}>x</div>"), /\["data-m-no-select","false"\]/);
  // the h() form keeps it as an attribute too
  assert.match(c("const a = <div m:no-select>x</div>", { templates: false }), /"data-m-no-select": ""/);
});

test("compiler: a live value and every component go through mProps()", () => {
  const live = c("let $lock = true\nconst a = <div m:no-select={$lock}>x</div>");
  assert.match(live, /import \{ mProps as _\$m \} from /);
  assert.match(live, /_\$m\(_\$t1\(\), \{"no-select": \(\) => \(\$lock\(\)\)\}\)/);
  const comp = c("const a = <Card m:no-select title=\"x\">hi</Card>");
  assert.match(comp, /_\$m\(_\$h\(Card, \{title: "x"\}, .*\), \{"no-select": true\}\)/);
  assert.doesNotMatch(comp, /m:no-select/); // never reaches the component's props
  // a name the compiler does not know is left to the runtime registry
  assert.match(c("const a = <div m:tone=\"calm\">x</div>"), /_\$m\(.*\{"tone": "calm"\}\)/);
  assert.throws(() => c("const a = <div m:Bad_Name>x</div>"), /invalid common prop/);
  // typecheck view keeps the prop so its type is checked
  assert.match(c("const a = <Card m:no-select />", { typecheck: true }), /"m:no-select": true/);
});

test("runtime: elements, components (one root, many roots, live region), nesting, hand-written h()", async () => {
  const { document } = installDom();
  const dir = mkdtempSync(join(tmpdir(), "march-mp-"));
  try {
    const src = `
export const $lock = true
export const $show = true
function One(p) { return <section class="one">{p.children}</section> }
function Many() { return [<i>a</i>, "text", <b>b</b>] }
function Region() { return () => ($show ? <em>on</em> : <u>off</u>) }
export function App() {
  return <main>
    <p id="st" m:no-select>static <input value="x" /></p>
    <p id="open" m:no-select={false}>open</p>
    <p id="live" m:no-select={$lock}>live</p>
    <One m:no-select><span>inside</span></One>
    <Many m:no-select />
    <Region m:no-select={$lock} />
  </main>
}`;
    const f = join(dir, "app.mjs");
    writeFileSync(f, compile(src, { runtime: RT, props: PROPS }).code);
    const { App, $lock, $show } = await import(pathToFileURL(f).href);
    const { render, h } = await import(RT);
    const { mProps, registerMProp } = await import(PROPS);
    const root = document.createElement("div");
    document.body.appendChild(root);
    const dispose = render(() => h(App, {}), root);
    const q = (s) => root.querySelector(s);
    assert.equal(q("#st").getAttribute(ATTR), "");
    assert.equal(q("#open").getAttribute(ATTR), "false");
    assert.equal(q("#live").getAttribute(ATTR), "");
    assert.equal(q(".one").getAttribute(ATTR), "", "component root");
    assert.equal(q("i").getAttribute(ATTR), "", "every root element of a component");
    assert.equal(q("b").getAttribute(ATTR), "");
    assert.equal(q("em").getAttribute(ATTR), "", "live region root");
    $lock.set(false);
    assert.equal(q("#live").getAttribute(ATTR), "false");
    assert.equal(q("em").getAttribute(ATTR), "false");
    $lock.set(null);
    assert.equal(q("#live").hasAttribute(ATTR), false, "null removes it");
    $lock.set(true);
    $show.set(false);
    assert.equal(q("u").getAttribute(ATTR), "", "the region's new root gets it");

    // by hand: mProps() around h(), the m: namespace on h() elements, and a new member
    const el = mProps(h("div", null, "x"), { "no-select": true });
    assert.equal(el.getAttribute(ATTR), "");
    assert.equal(h("div", { "m:no-select": false }).getAttribute(ATTR), "false");
    registerMProp("tone", (node, v) => { node.setAttribute("data-tone", String(v)); });
    assert.equal(h("div", { "m:tone": "calm" }).getAttribute("data-tone"), "calm");
    assert.throws(() => mProps(h("div", null), { nope: 1 }), /unknown common prop m:nope/);
    assert.equal(mProps(null, { "no-select": true }), null, "nothing rendered: nothing to do");

    dispose();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("css: one rule for the subtree, the nearest m:no-select wins, typed text stays selectable", () => {
  const css = readFileSync(new URL("../src/css/props.css", import.meta.url), "utf8");
  assert.match(css, /\[data-m-no-select\] \* \{[^}]*user-select: var\(--m-select\) !important/);
  assert.match(css, /\[data-m-no-select\] \{ --m-select: none;/);
  assert.match(css, /\[data-m-no-select="false"\] \{ --m-select: auto;[^}]*user-select: text !important/);
  assert.match(css, /-webkit-user-select/); // Safari
  // text fields and editors keep selection (and, in Safari, typing)
  assert.match(css, /\[data-m-no-select\] :is\(input, textarea, \[contenteditable\][^{]*\{[^}]*user-select: text !important/);
});
