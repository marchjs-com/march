// CDN size budget (tools/cdn-size.mjs): an entry is measured by its static closure on top of the core's; past its
// budget (the default for its kind, or its own limit) it is reported; icon packs have none.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { measure, check, limitOf, readBudget } from "../tools/cdn-size.mjs";

const noise = (n, seed) => Array.from({ length: n }, (_, i) => `v${(i * 7919 + seed) % 100003}`).join(";");

test("cdn-size: closure on top of the core, budgets by kind, own limits, icon packs free", () => {
  const dir = mkdtempSync(join(tmpdir(), "march-cdn-size-"));
  try {
    mkdirSync(join(dir, "_"));
    mkdirSync(join(dir, "components/actions"), { recursive: true });
    mkdirSync(join(dir, "icons"));
    const put = (f, text) => writeFileSync(join(dir, f), text);
    put("_/runtime.js", `export const r=1;${noise(400, 1)}`);
    put("_/heavy.js", `export const h=1;${noise(3000, 2)}`);
    put("march.js", `import{r}from"./_/runtime.js";export{r};`);
    put("components/actions/button.js", `import{r}from"../../_/runtime.js";export const B=r;`);
    put("components/actions/fancy.js", `import{r}from"../../_/runtime.js";import{h}from"../../_/heavy.js";export const F=r+h;`);
    put("components/actions/fancy.css", ".f{color:red}");
    put("icons/big.js", `export const i=1;${noise(5000, 3)}`);
    const base = "https://cdn.test/0.0.1/";
    put("importmap.json", JSON.stringify({ imports: { march: `${base}march.js`, "march/components/actions/button": `${base}components/actions/button.js`, "march/components/actions/fancy": `${base}components/actions/fancy.js`, "march/icons/big": `${base}icons/big.js` } }));
    const s = measure(dir);
    const gz = (f) => gzipSync(readFileSync(join(dir, f))).length;
    assert.equal(s.core.js, gz("march.js") + gz("_/runtime.js"));
    assert.equal(s.entries["march/components/actions/button"].added, gz("components/actions/button.js"), "the runtime is the core's");
    assert.equal(s.entries["march/components/actions/fancy"].added, gz("components/actions/fancy.js") + gz("_/heavy.js"));
    assert.deepEqual(s.entries["march/components/actions/fancy"].files, ["_/heavy.js", "_/runtime.js", "components/actions/fancy.js"]);
    assert.ok(s.entries["march/components/actions/fancy"].css > 0);
    const budget = { component: 1000, entry: 2000, core: 100000, limits: {} };
    assert.deepEqual(check(s, budget).map((o) => o.spec), ["march/components/actions/fancy"], "the heavy component only; the icon pack has no budget");
    assert.equal(limitOf("march/icons/big", budget), null);
    assert.deepEqual(check(s, { ...budget, limits: { "march/components/actions/fancy": { limit: 100000, why: "a tool" } } }), [], "its own limit");
    assert.deepEqual(check(s, { ...budget, component: 100000, core: 10 }).map((o) => o.spec), ["march"], "the core by its whole closure");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("cdn/budget.json: defaults for components and other entries; every own limit has a reason", () => {
  const b = readBudget();
  for (const k of ["component", "entry", "core"]) assert.equal(typeof b[k], "number", k);
  for (const [spec, v] of Object.entries(b.limits)) {
    assert.ok(v.limit > (spec.startsWith("march/components/") ? b.component : b.entry), `${spec}: a limit of its own is over the default`);
    assert.ok(typeof v.why === "string" && v.why.length > 20, `${spec}: a reason`);
  }
});
