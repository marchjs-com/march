// The TypeScript worker (ts-worker.js) run in Node: a VM context stands in for the worker's scope (importScripts loads
// the typescript package, synchronous requests read its lib files and the lib-docs dictionaries).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "..", "..", "..", "..");
const lib = join(root, "node_modules", "typescript", "lib");
const require = createRequire(import.meta.url);
const docs = {};
for (const f of readdirSync(join(here, "lib-docs", "tr"))) Object.assign(docs, JSON.parse(readFileSync(join(here, "lib-docs", "tr", f), "utf8")));

const out = [];
class XHR {
  open(_m, u) { this.u = u.replace("http://x/", ""); }
  send() {
    if (this.u === "tr/lib-docs.json") { this.status = 200; this.responseText = JSON.stringify(docs); return; }
    const p = join(lib, this.u);
    if (existsSync(p)) { this.status = 200; this.responseText = readFileSync(p, "utf8"); } else this.status = 404;
  }
}
const ctx = { XMLHttpRequest: XHR, console, URL, postMessage: (m) => out.push(m), importScripts: () => { ctx.ts = require(join(lib, "typescript.js")); } };
ctx.self = ctx; ctx.location = { href: "http://x/ts-worker.js", origin: "http://x" };
vm.createContext(ctx);
vm.runInContext(readFileSync(join(here, "ts-worker.js"), "utf8"), ctx);
const call = (type, data = {}) => { out.length = 0; ctx.onmessage({ data: { id: 1, type, ...data } }); const m = out[0]; if (!m.ok) throw new Error(m.error); return m.value; };
/** The text with ¦ as the caret: sent to the worker, the caret's place returned. */
const at = (text) => { const pos = text.indexOf("¦"); call("update", { path: "a.tsx", text: text.replace("¦", "") }); return pos; };
call("init", { tsUrl: "http://x/typescript.js", lib: "http://x/" });

test("ts-worker: the type the place expects comes first (true / false, a union's values, the file's names); the declared name is not its own value", () => {
  let r = call("complete", { path: "a.tsx", pos: at("const test: Boolean = ¦") });
  const top = r.items.filter((i) => i.priority === 3).map((i) => i.label).sort();
  assert.deepEqual(top, ["false", "true"]);
  assert.ok(!r.items.some((i) => i.label === "test" && i.priority), "test is being declared");
  r = call("complete", { path: "a.tsx", pos: at("const ok = true\nfunction f(x: boolean) {}\nf(¦)") });
  assert.equal(r.items.find((i) => i.label === "ok")?.priority, 2, "a name of the file that fits");
  r = call("complete", { path: "a.tsx", pos: at("type V = 'primary' | 'ghost'\nconst v: V = ¦") });
  assert.deepEqual(r.items.filter((i) => i.priority === 3).map((i) => i.label).sort(), ['"ghost"', '"primary"']);
  r = call("complete", { path: "a.tsx", pos: at("const n: number = ¦") });
  assert.ok(!r.items.some((i) => i.label === "true" && i.priority), "a boolean does not fit a number");
});

test("ts-worker: no suggestions in a comment or the text between JSX tags; in a string only the type's words", () => {
  assert.equal(call("complete", { path: "a.tsx", pos: at("const A = () => <div>hel¦</div>") }).where, "text");
  assert.equal(call("complete", { path: "a.tsx", pos: at("// con¦") }).where, "comment");
  const r = call("complete", { path: "a.tsx", pos: at("type V = 'primary' | 'ghost'\nconst v: V = 'g¦'") });
  assert.equal(r.where, "string");
  assert.deepEqual(r.items.map((i) => i.label), ["ghost"]);
  assert.equal(call("complete", { path: "a.tsx", pos: at("const s = \"con¦\"") }).items.length, 0, "a plain string: nothing");
});

test("ts-worker: with the page in Turkish the JS / DOM descriptions come from lib-docs (hover, details, signature); English: TypeScript's own", () => {
  call("locale", { locale: "tr" });
  assert.match(call("hover", { path: "a.tsx", pos: at("console.lo¦g('x')") }).doc, /Konsola/);
  assert.match(call("hover", { path: "a.tsx", pos: at("const m = new Map<string, number>(); m.ge¦t('a')") }).doc, /Anahtarın değerini/);
  assert.match(call("hover", { path: "a.tsx", pos: at("fetch('/a').then((r) => r.js¦on())") }).doc, /JSON/);
  assert.match(call("details", { path: "a.tsx", pos: at("console.¦"), name: "table" }).doc, /tablo/);
  const sig = call("signature", { path: "a.tsx", pos: at("[1, 2].map(¦)") });
  assert.match(sig.items[0].doc, /yeni bir dizi/);
  assert.match(sig.items[0].params[0].doc, /Her öğe için/);
  call("locale", { locale: "en" });
  assert.doesNotMatch(call("hover", { path: "a.tsx", pos: at("console.lo¦g('x')") }).doc, /Konsola/);
});

test("ts-worker: a statement after a JSX expression with no semicolon still gets suggestions (console…), the file text kept", () => {
  const text = "const Row = () => <div>{1}</div>\n\nconso\nexport function A() {}\n";
  const r = call("complete", { path: "a.tsx", pos: at(text.replace("conso\n", "conso¦\n")) });
  assert.ok(r.items.some((i) => i.label === "console"), "console is offered");
  assert.equal(r.from, text.indexOf("conso"));
  const r2 = call("complete", { path: "a.tsx", pos: text.indexOf("conso") + 5 });
  assert.ok(r2.items.some((i) => i.label === "console"), "asked again: same answer (the text was put back)");
});

test("ts-worker: with libs.json beside them the lib files come from it, one request (no file of its own read)", () => {
  const all = Object.fromEntries(readdirSync(lib).filter((f) => /^lib\..*\.d\.ts$/.test(f)).map((f) => [f, readFileSync(join(lib, f), "utf8")]));
  const asked = [], got = [];
  class BundleXHR {
    open(_m, u) { this.u = u.replace("http://y/", ""); asked.push(this.u); }
    send() { if (this.u === "libs.json") { this.status = 200; this.responseText = JSON.stringify(all); } else this.status = 404; }
  }
  const c = { XMLHttpRequest: BundleXHR, console, URL, postMessage: (m) => got.push(m), importScripts: () => { c.ts = require(join(lib, "typescript.js")); } };
  c.self = c; c.location = { href: "http://y/ts-worker.js", origin: "http://y" };
  vm.createContext(c);
  vm.runInContext(readFileSync(join(here, "ts-worker.js"), "utf8"), c);
  const send = (type, data = {}) => { got.length = 0; c.onmessage({ data: { id: 1, type, ...data } }); const m = got[0]; if (!m.ok) throw new Error(m.error); return m.value; };
  send("init", { tsUrl: "http://y/typescript.js", lib: "http://y/" });
  const text = "const m = new Map<string, number>(); m.";
  send("update", { path: "a.tsx", text });
  const r = send("complete", { path: "a.tsx", pos: text.length });
  assert.ok(r.items.some((i) => i.label === "get"), "Map's methods: lib.es2015.collection.d.ts was read");
  assert.equal(asked.filter((u) => u === "libs.json").length, 1);
  assert.deepEqual(asked.filter((u) => /^lib\./.test(u)), [], "no lib file asked on its own");
});
