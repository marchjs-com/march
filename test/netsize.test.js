// Speed page › live network panel: sizes when the browser cannot measure a response (cross-origin, no Timing-Allow-Origin).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const S = await import("../examples/showcase/src/netsize.ts");
const { fileSizes } = await import("../cli/perf.js");

const files = { "assets/chunks/g1.js": { raw: 120000, gzip: 39526 }, "assets/main.css": { raw: 60000, gzip: 14700 } };

test("cross-origin without Timing-Allow-Origin: ~300 B of headers is not the size; the build report's gzip size is", () => {
  const e = { key: "assets/chunks/g1.js", transferSize: 300, encodedBodySize: 0, decodedBodySize: 0 };
  assert.equal(S.measured(e), false);
  assert.deepEqual(S.resolveSize(e, files), { bytes: 39526, raw: 120000, from: "derleme raporu" });
  assert.deepEqual(S.resolveSize(e, null), { bytes: 0, raw: null, from: "bilinmiyor" });
});

test("measured responses keep the browser's numbers: network (wire bytes) and cache (file size, nothing on the wire)", () => {
  const net = { key: "assets/chunks/g1.js", transferSize: 39826, encodedBodySize: 39526, decodedBodySize: 120000 };
  assert.deepEqual(S.resolveSize(net, files), { bytes: 39826, raw: 120000, from: "ölçülen" });
  const cache = { key: "assets/chunks/g1.js", transferSize: 0, encodedBodySize: 39526, decodedBodySize: 120000 };
  assert.deepEqual(S.resolveSize(cache, files), { bytes: 39526, raw: 120000, from: "ölçülen" });
  assert.equal(S.wireBytes(cache), 0);
});

test("report keys: relative to the app base, no ?v=, any origin", () => {
  assert.equal(S.reportKey("https://cdn.example.com/march/assets/chunks/g1.js?v=ABC123", "https://devs.example.com/march/index.html"), "assets/chunks/g1.js");
  assert.equal(S.reportKey("http://127.0.0.1:5180/assets/main.css?v=X", "http://127.0.0.1:5180/"), "assets/main.css");
});

test("march-report.json › files: raw and gzip size of every JS / CSS / font file, keyed without ?v=", () => {
  const dir = mkdtempSync(join(tmpdir(), "march-sizes-"));
  try {
    mkdirSync(join(dir, "assets/chunks"), { recursive: true });
    writeFileSync(join(dir, "assets/chunks/a.js"), "export const a = 1;\n".repeat(200));
    writeFileSync(join(dir, "assets/main.css"), "a{color:red}");
    writeFileSync(join(dir, "index.html"), "<!doctype html>");
    const f = fileSizes(dir);
    assert.deepEqual(Object.keys(f).sort(), ["assets/chunks/a.js", "assets/main.css"]);
    assert.equal(f["assets/chunks/a.js"].raw, 4000);
    assert.ok(f["assets/chunks/a.js"].gzip > 0 && f["assets/chunks/a.js"].gzip < 200);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
