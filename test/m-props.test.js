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
  assert.ok(on.includes('import "march/css/props.css";'), "only the CSS file is loaded");
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
  assert.match(comp, /_\$m\(_\$c\(Card, \{title: "x"\}, .*\), \{"no-select": true\}\)/);
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

test("compiler: m:parts names become the components themselves; other expressions pass through", () => {
  const c = (src, opts = {}) => compile(src, { runtime: RT, props: PROPS, ...opts }).code;
  const lit = c(`import { Avatar, Like } from "./parts.js"\nconst a = <Post m:parts={{ Avatar: { size: "lg" }, "Like": { color: "blue", on: [1, { x: 2 }] } }} title="x" />`);
  assert.match(lit, /import \{ withParts as _\$mp \}/);
  assert.match(lit, /_\$mp\(\(\) => \(new Map\(\[\[Avatar, \{ size: "lg" \}\], \[Like, \{ color: "blue", on: \[1, \{ x: 2 \}\] \}\]\]\)\), \(\) => /);
  assert.doesNotMatch(lit, /"m:parts"|parts:/, "never reaches the component's props");
  // the map is an accessor: a live value inside it stays live
  assert.match(c(`import { Avatar } from "./parts.js"\nlet $size = "lg"\nconst a = <Post m:parts={{ Avatar: { size: $size } }} />`), /_\$mp\(\(\) => \(new Map\(\[\[Avatar, \{ size: \$size\(\) \}\]\]\)\), \(\) => /);
  // any other expression is passed as it is (a Map of components)
  assert.match(c(`const a = <Post m:parts={chosen} />`), /_\$mp\(chosen, \(\) => /);
  // with other m: props: the scope is outside
  assert.match(c(`import { Avatar } from "./parts.js"\nconst a = <Post m:no-select m:parts={{ Avatar: {} }} />`), /_\$mp\(\(\) => \(new Map\(\[\[Avatar, \{\}\]\]\)\), \(\) => _\$m\(/);
  // on a native element: a scope for everything inside it
  assert.match(c(`import { Avatar } from "./parts.js"\nconst a = <div m:parts={{ Avatar: { size: "sm" } }}><Avatar /></div>`), /_\$mp\(\(\) => \(new Map/);
  assert.throws(() => c(`const a = <Post m:parts={{ Nope: { size: "lg" } }} />`), /m:parts: "Nope" is not a component in scope/);
  assert.throws(() => c(`import { Avatar } from "./parts.js"\nconst a = <Post m:parts={{ ...more, Avatar: {} }} />`), /m:parts: write \{ Name: \{ … \} \} entries/);
  assert.throws(() => c(`const a = <Post m:parts={{ avatar: {} }} />`), /"avatar" is not a component name/);
  assert.throws(() => c(`const a = <Post m:parts />`), /m:parts needs a value/);
  // typecheck mode keeps it as a prop
  assert.match(c(`import { Avatar } from "./parts.js"\nconst a = <Post m:parts={{ Avatar: {} }} />`, { typecheck: true }), /"m:parts":/);
});

test("runtime: m:parts reaches the components drawn inside, wins over the parent, stays live, the nearest scope wins", async () => {
  const { document } = installDom();
  const dir = mkdtempSync(join(tmpdir(), "march-mparts-"));
  try {
    const src = `
export const $size = "lg"
export const $open = false
export function Avatar(p) { return <i class="av" data-size={p.size ?? "md"} data-shape={p.shape ?? "circle"}>{p.name}</i> }
export function Like(p) { return <button class="like" data-color={p.color ?? "pink"} onClick={p.onClick}>like</button> }
function Row(p) { return <li><Avatar name={p.name} size="sm" /></li> }
export function Post(p) {
  return <article class="post">
    <Avatar name="a" size="sm" shape="square" />
    <Like color="pink" />
    {() => ($open ? <Avatar name="late" /> : null)}
    <ul><Row name="row" /></ul>
  </article>
}
export let clicks = 0
export function App() {
  return <main>
    <section id="scoped"><Post m:parts={{ Avatar: { size: $size }, Like: { color: "blue", onClick: () => { clicks++ } } }} /></section>
    <section id="plain"><Post /></section>
    <section id="nested" m:parts={{ Avatar: { size: "xl", shape: "round" } }}><div m:parts={{ Avatar: { size: "xs" } }}><Avatar name="n" /></div><Avatar name="o" /></section>
  </main>
}`;
    const f = join(dir, "app.mjs");
    writeFileSync(f, compile(src, { runtime: RT, props: PROPS }).code);
    const mod = await import(pathToFileURL(f).href);
    const { render, h } = await import(RT);
    const { withParts } = await import(PROPS);
    const root = document.createElement("div");
    document.body.appendChild(root);
    const dispose = render(() => h(mod.App, {}), root);
    const all = (s) => [...root.querySelectorAll(s)];
    const sizes = (id) => all(`#${id} .av`).map((x) => x.getAttribute("data-size"));
    assert.deepEqual(sizes("scoped"), ["lg", "lg"], "every Avatar inside, also the one a Row draws; the scope wins over size=\"sm\"");
    assert.equal(all("#scoped .av")[0].getAttribute("data-shape"), "square", "props the scope does not name stay");
    assert.equal(root.querySelector("#scoped .like").getAttribute("data-color"), "blue");
    assert.deepEqual(sizes("plain"), ["sm", "sm"], "outside the scope nothing changes");
    assert.equal(root.querySelector("#plain .like").getAttribute("data-color"), "pink");
    // live
    mod.$size.set("xl");
    assert.deepEqual(sizes("scoped"), ["xl", "xl"]);
    // a part created later is reached too
    mod.$open.set(true);
    assert.deepEqual(sizes("scoped"), ["xl", "xl", "xl"]);
    assert.deepEqual(sizes("plain"), ["sm", "md", "sm"]);
    // listeners pass through
    root.querySelector("#scoped .like").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(mod.clicks, 1);
    // the nearest scope wins; what it does not name comes from the outer one
    const [inner, outer] = all("#nested .av");
    assert.equal(inner.getAttribute("data-size"), "xs");
    assert.equal(outer.getAttribute("data-size"), "xl");
    assert.equal(outer.getAttribute("data-shape"), "round");

    // by hand
    const host = document.createElement("div");
    const d2 = render(() => withParts(new Map([[mod.Avatar, { size: "hand" }]]), () => h(mod.Post, {})), host);
    assert.equal(host.querySelector(".av").getAttribute("data-size"), "hand");
    d2(); dispose();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
