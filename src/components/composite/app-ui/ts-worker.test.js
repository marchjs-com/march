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
