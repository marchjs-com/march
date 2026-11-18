import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const { parseSourceMap, originalAt, blobFrames } = await import("../examples/showcase/src/playground/source-map.ts");

test("source map: a bundle's place back to its file and line; an error stack's blob frames", async () => {
  const files = { "a.ts": `import { b } from "./b.ts"\nexport const run = () => {\n  return b()\n}\n`, "b.ts": `export function b() {\n  const x = 1\n  throw new Error("boom " + x)\n}\n` };
  const plugin = { name: "mem", setup(p) {
    p.onResolve({ filter: /.*/ }, (a) => ({ path: a.path.replace(/^\.\//, ""), namespace: "files" }));
    p.onLoad({ filter: /.*/, namespace: "files" }, (a) => ({ contents: files[a.path], loader: "ts" }));
  } };
  const out = await build({ entryPoints: ["a.ts"], bundle: true, write: false, format: "esm", sourcemap: "external", outfile: "out.js", plugins: [plugin], logLevel: "silent" });
  const js = out.outputFiles.find((f) => f.path.endsWith(".js")).text, map = parseSourceMap(out.outputFiles.find((f) => f.path.endsWith(".map")).text);
  const lines = js.split("\n"), at = lines.findIndex((l) => l.includes("throw new Error"));
  const o = originalAt(map, at + 1, lines[at].indexOf("throw"));
  assert.equal(o.source.replace(/^files:/, ""), "b.ts");
  assert.equal(o.line, 3);
  assert.deepEqual(blobFrames("Error: boom\n    at b (blob:http://x/1-2-3:12:9)\n    at blob:http://x/1-2-3:20:3\n    at other (http://x/a.js:1:1)"), [{ fn: "b", line: 12, column: 8 }, { fn: "", line: 20, column: 2 }]);
});
