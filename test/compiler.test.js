import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { compile, isStaticCode } from "../compiler/index.js";
import { loadAutoImports } from "../compiler/autoimports.js";
import { installDom } from "../src/testing/dom.ts";

const RT = new URL("../src/index.ts", import.meta.url).href;
const c = (src, o = {}) => compile(src, { runtime: RT, ...o }).code;
// the h() form (templates: false) keeps these structural checks readable; templates have their own test
const NOTPL = { templates: false };
const body = (src, o) => c(src, o).replace(/^import[^\n]*?;\s*(import[^\n]*?;\s*)*/, "");

test("$ variables: declaration, read, write, compound, ++, computed", () => {
  const out = body("let $n = 0\nconst $d = $n * 2\n$n = 5\n$n += 2\n$n++\n--$n\nconsole.log($n, obj.$n, { $n: 1 })");
  assert.match(out, /const \$n = _\$signal\(0\)/);
  assert.match(out, /const \$d = _\$computed\(\(\) => \(\$n\(\) \* 2\)\)/);
  assert.match(out, /\$n\.set\(5\)/);
  assert.match(out, /\$n\.set\(\$n\(\) \+ \(2\)\)/);
  assert.match(out, /\$n\.set\(\$n\(\) \+ 1\)/);
  assert.match(out, /\$n\.set\(\$n\(\) - 1\)/);
  assert.match(out, /console\.log\(\$n\(\), obj\.\$n, \{ \$n: 1 \}\)/);
});

test("$ variables: explicit API, strings and comments untouched, mixed declarations rejected", () => {
  const out = body("let $a = 1\n$a.set(2); const s = '$a'; // $a\nconst r = /\\$a/g");
  assert.match(out, /\$a\.set\(2\)/);
  assert.match(out, /'\$a'/);
  assert.match(out, /\/\/ \$a/);
  assert.throws(() => c("let $a = 1, b = 2"), /own let\/const/);
});

test("const without $ dependencies is a signal, with them a computed", () => {
  assert.match(body("const $x = 3"), /_\$signal\(3\)/);
  assert.match(body("let $y = 1\nconst $x = $y + 1"), /_\$computed/);
});

test("JSX elements, text whitespace, entities, fragments", () => {
  const out = body(`const a = <div class="x" id={id}>
    Hello &amp; welcome
    <b>bold</b>
  </div>; const f = <><i/><i/></>`, NOTPL);
  assert.match(out, /_\$h\("div", \{class: "x", id: id\}, "Hello & welcome", _\$h\("b", null, "bold"\)\)/);
  assert.match(out, /\[_\$h\("i", null\), _\$h\("i", null\)\]/);
});

test("dynamic expressions become live bindings; static ones do not", () => {
  const out = body("let $n = 0\nconst v = <p title={props.t} data-x={1} onClick={() => go()} ref={el}>{$n} {name} {fmt(x)}</p>", NOTPL);
  assert.match(out, /title: _\$r\(\(\) => \(props\.t\)\)/);
  assert.match(out, /"data-x": 1/);
  assert.match(out, /onClick: \(\) => go\(\)/);
  assert.match(out, /ref: el/);
  assert.match(out, /\(\) => \(\$n\(\)\)/);
  assert.match(out, /, name,|, name\)/);
  assert.match(out, /\(\) => \(fmt\(x\)\)/);
  assert.ok(isStaticCode("'a'") && isStaticCode("(a, b) => a") && !isStaticCode("a.b") && !isStaticCode("f()"));
});

test("directives, shorthand attributes, bind needs a $variable", () => {
  const out = body("let $v = ''\nconst e = <input bind:value={$v} on:input|stop={h} class:on={$v} use:focus={1} transition:fade />; const r = <Row {user} {$v} />", NOTPL);
  assert.match(out, /"bind:value": \$v[,}]/);
  assert.match(out, /"on:input\|stop": h/);
  assert.match(out, /"class:on": _\$r\(\(\) => \(\$v\(\)\)\)/);
  assert.match(out, /"use:focus": \[focus, 1\]/);
  assert.match(out, /"transition:fade": true/);
  assert.match(out, /_\$h\(Row, \{user: user, v: _\$r\(\(\) => \(\$v\(\)\)\)\}\)/);
  assert.throws(() => c("const e = <input bind:value={x} />"), /needs a \$variable/);
});

test("pipes", () => {
  const out = body("const e = <p>{price | money('TRY') | upper} {a || b} {(x | 1)}</p>");
  assert.match(out, /_\$pipe\("upper", _\$pipe\("money", price, 'TRY'\)\)/);
  assert.match(out, /a \|\| b/);
  assert.match(out, /x \| 1/);
});

test("sx literal resolves at build time; invalid sx fails the build", () => {
  assert.match(body("const e = <div sx={{ p: 2, cols: 3 }} />", NOTPL), /sx: "hm-p-2 hm-cols-3"/);
  assert.throws(() => c("const e = <div sx={{ p: 42 }} />"), /out of range/);
  assert.match(body("const e = <div sx={dyn} />", NOTPL), /sx: _\$r\(\(\) => \(_\$sx\(dyn\)\)\)/);
});

test("components get lazy children; If/Else split", () => {
  const out = body("const e = <Card title='x'><p>a</p>{b}</Card>; const f = <If when={ok}>yes<Else>no</Else></If>", NOTPL);
  assert.match(out, /_\$h\(Card, \{title: "x"\}, _\$lazy\(\(\) => \[_\$h\("p", null, "a"\), b\]\)\)/);
  assert.match(out, /_\$h\(If, \{when: ok, else: \(\) => \["no"\]\}, _\$lazy\(\(\) => \["yes"\]\)\)/);
});

test("async functions keep their owner across await", () => {
  const out = body("async function P() { const a = await load(x).then(f); return a }\nconst q = async () => { await y }");
  assert.match(out, /async function P\(\) \{const _\$o=_\$getOwner\(\); const a = _\$enter\(_\$o, await _\$leave\(load\(x\)\.then\(f\)\)\)/);
  assert.match(out, /async \(\) => \{const _\$o=_\$getOwner\(\); _\$enter\(_\$o, await _\$leave\(y\)\)/);
});

test("css extraction, t keys, line numbers preserved", () => {
  const r = compile("const s = css`.a{color:red}`\nconst m = t`Hi ${name}!`\nconst e = <div>\n<b/>\n</div>\nconst after = 1", { runtime: RT });
  assert.equal(r.css, ".a{color:red}");
  assert.deepEqual(r.keys, ["Hi {0}!"]);
  const lines = r.code.split("\n");
  assert.equal(lines.findIndex((l) => l.includes("const after")), 5);
});

test("auto imports: runtime names and components; declared names are not imported", async () => {
  const auto = await loadAutoImports();
  const out = compile("const x = signal(1); const e = <For each={a}>{(i) => i}</For>; function effect() {}", { autoImports: { ...auto, MyBox: "./MyBox.jsx" }, runtime: "hadi-march" }).code;
  assert.match(out, /import \{ For, signal \} from "hadi-march";/);
  assert.doesNotMatch(out, /import \{[^}]*effect/);
  assert.match(compile("const e = <MyBox/>", { autoImports: { MyBox: "./MyBox.jsx" } }).code, /import \{ MyBox \} from "\.\/MyBox\.jsx"/);
});

test("compile errors point at the source", () => {
  try { c("const a = 1\nconst e = <div><b></div>"); assert.fail("should throw"); }
  catch (e) { assert.match(e.message, /expected <\/b>/); assert.match(e.message, /:2:/); assert.ok(e.frame.includes(">    2 |")); }
});

test("templates: a native subtree is built once and cloned; only its dynamic parts are wired", () => {
  const out = c(`const e = <tr class="row"><td class="c1">{id}</td><td><a class={$sel} onClick={go} href="/x">{label} !</a></td><td hidden /></tr>
const s = <svg viewBox="0 0 1 1"><path d="M0 0" /></svg>; const sp = <div {...p}><b>x</b></div>`);
  const decl = out.match(/const _\$t\d+ = _\$tpl\(/g) ?? [];
  assert.equal(decl.length, 2, "one template for the row (inner cells taken in) and one for <b> inside the spread <div>");
  assert.match(out, /_\$tpl\(\["tr",\[\["class","row"\]\],\["td",\[\["class","c1"\]\]\],\["td",\[\],\["a",\[\]," !"\]\],\["td",\[\["hidden",""\]\]\]\]\)/);
  assert.match(out, /_\$p\(_\d+, "a", "class", _\$r\(\(\) => \(\$sel\)\)\)/, "a bound class is wired");
  assert.match(out, /_\$p\(_\d+, "a", "onClick", go\)/, "events are wired, not template attributes");
  assert.match(out, /_\$p\(_\d+, "a", "href", "\/x"\)/, "URL attributes keep their runtime check");
  assert.match(out, /_\$ins\(_\d+, label, _\d+, 1\)/, "a child before static text is inserted before it (owned by the clone: no cleanup)");
  assert.match(out, /_\$h\("svg"/, "SVG keeps h() (namespace)");
  assert.match(out, /_\$h\("div", \{\.\.\.p\}/, "spreads keep h()");
  assert.ok(isStaticCode("_$t3((_r) => { _$p(_r, \"a\", \"x\", 1); })") && isStaticCode("_$t1()"));
  assert.doesNotMatch(c("const e = <p>{a}</p>", { templates: false }), /_\$tpl/);
});

test("end to end: compiled component renders and reacts in the DOM", async () => {
  const { document } = installDom();
  const dir = mkdtempSync(join(tmpdir(), "march-"));
  try {
    const auto = await loadAutoImports({ specifier: (_s, file) => pathToFileURL(file).href });
    const src = `
let $count = 0
let $name = "Ada"
const $double = $count * 2
export function App() {
  return <div>
    <button on:click={() => $count++}>+</button>
    <p>{$count} × 2 = {$double}</p>
    <input bind:value={$name} />
    <If when={$count > 1}>many<Else>few</Else></If>
    <ul><For each={[{ id: 1, n: "x" }, { id: 2, n: "y" }]} key="id">{(it) => <li>{it().n | upper}</li>}</For></ul>
    <span>{$name}</span>
  </div>
}`;
    const f = join(dir, "app.mjs");
    writeFileSync(f, compile(src, { runtime: RT, autoImports: auto }).code);
    const { App } = await import(pathToFileURL(f).href);
    const { render, setLocale } = await import(RT);
    setLocale("en");
    const root = document.createElement("div");
    render(() => App(), root);
    const p = root.querySelector("p");
    assert.equal(p.textContent, "0 × 2 = 0");
    assert.equal(root.textContent.includes("few"), true);
    root.querySelector("button").click();
    root.querySelector("button").click();
    assert.equal(p.textContent, "2 × 2 = 4");
    assert.equal(root.textContent.includes("many"), true);
    assert.deepEqual(root.querySelectorAll("li").map((l) => l.textContent), ["X", "Y"]);
    const input = root.querySelector("input");
    input.value = "Grace"; input.dispatchEvent(new Event("input", { bubbles: true }));
    assert.equal(root.querySelector("span").textContent, "Grace");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("esbuild plugin bundles .jsx with css and resolves hadi-march", async () => {
  const esbuild = await import("esbuild");
  const { march } = await import("../compiler/esbuild.js");
  const dir = mkdtempSync(join(tmpdir(), "march-eb-"));
  try {
    writeFileSync(join(dir, "Hello.jsx"), "export default function Hello(p) { return <b>{p.name}</b> }\nconst s = css`.hello{font-weight:700}`\n");
    writeFileSync(join(dir, "main.jsx"), "import Hello from './Hello.jsx'\nlet $n = 1\nrender(() => <Hello name={t`Hi ${$n}`} />, document.body)\n");
    let keys = [];
    const r = await esbuild.build({ entryPoints: [join(dir, "main.jsx")], bundle: true, write: false, outdir: join(dir, "out"), format: "esm", plugins: [march({ onKeys: (k) => { keys = k; } })], logLevel: "silent" });
    const js = r.outputFiles.find((f) => f.path.endsWith(".js")).text;
    const cssOut = r.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";
    assert.match(js, /function signal\(/);
    assert.doesNotMatch(js, /\.innerHTML\s*=|new Function\(|\beval\(/);
    assert.match(cssOut, /\.hello/);
    assert.deepEqual(keys, ["Hi {0}"]);
    await assert.rejects(esbuild.build({ stdin: { contents: "const a = <div>", loader: "jsx" }, entryPoints: [], write: false, logLevel: "silent" }).catch(() => { throw new Error("x"); }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("trailing comments after a $ declaration or assignment stay comments", () => {
  const out = body("let $a = null   // { x, y }\nlet $b = 1 /* note */\n$a = 2 // set\nconst z = 1");
  assert.match(out, /const \$a = _\$signal\(null\)   \/\/ \{ x, y \}/);
  assert.match(out, /const \$b = _\$signal\(1\) \/\* note \*\//);
  assert.match(out, /\$a\.set\(2\) \/\/ set/);
});

test("$ variable as a call argument after a comma is a read, not an object shorthand", () => {
  const out = body("let $a = 1\nf(x, $a); g($a, y); const o = { $a, b }; const arr = [1, $a]");
  assert.match(out, /f\(x, \$a\(\)\)/);
  assert.match(out, /g\(\$a\(\), y\)/);
  assert.match(out, /\{ a: \$a\(\), b \}/);
  assert.match(out, /\[1, \$a\(\)\]/);
});

test("auto import of project components: named or default export", () => {
  const out = compile("const a = <Named/>; const b = <Def/>", { autoImports: { Named: "./Named.jsx", Def: "./Def.jsx#default" } }).code;
  assert.match(out, /import \{ Named \} from "\.\/Named\.jsx";/);
  assert.match(out, /import Def from "\.\/Def\.jsx";/);
});
