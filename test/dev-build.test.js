// Production builds leave March's development-only code out (src/core/reactive.ts › __MARCH_DEV__): the March esbuild
// plugin defines globalThis.__MARCH_DEV__ from process.env.NODE_ENV, which march build and the CDN build set. A build without the define
// keeps it (tests, hand-made builds).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function bundle(define) {
  const esbuild = await import("esbuild");
  const { march } = await import("../compiler/esbuild.js");
  const dir = mkdtempSync(join(tmpdir(), "m-dev-"));
  try {
    writeFileSync(join(dir, "main.tsx"), `import { render, signal, For } from "march";
const rows = signal([{ id: 1, t: "a" }]);
render(() => <ul><For each={rows()} key="id">{(r) => <li onClick={() => rows.set([])}>{r().t}</li>}</For></ul>, document.body);
`);
    const r = await esbuild.build({ entryPoints: [join(dir, "main.tsx")], absWorkingDir: dir, bundle: true, minify: true, format: "esm", write: false,
      logLevel: "silent", ...(define ? { define } : {}), plugins: [march()] });
    return r.outputFiles.map((f) => f.text).join("\n");
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("a production build leaves out development warnings and argument checks; a development build keeps them", async () => {
  const prod = await bundle({ "process.env.NODE_ENV": '"production"' });
  const dev = await bundle({ "process.env.NODE_ENV": '"development"' });
  const none = await bundle(null);
  for (const text of ["cannot render value", "render() needs a DOM container", "<For> needs a row function", "handler must be a function"]) {
    assert.ok(!prod.includes(text), `production: no "${text}"`);
    assert.ok(dev.includes(text), `development: "${text}"`);
    assert.ok(none.includes(text), `no define: "${text}"`);
  }
  assert.ok(prod.length < dev.length, "production is smaller");
});
