// Every runtime export has a working example in the showcase API reference (İlk Adımlar › API başvurusu), written in
// examples/showcase/src/api-examples/<group>.tsx; subpaths still being written are listed in PENDING (tools/api-examples.js).
// The examples are generated into a few lazy parts (api-examples/gen/part-NN.ex.tsx, 10–25 KB each): a card loads its part.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
const { generate, straySigs, splitGroup, fileKeys, EX, ONE } = await import("../tools/api-examples.js");

test("every export of a finished subpath has an example", () => {
  const { missing } = generate();
  assert.deepEqual(missing, [], "add an example to examples/showcase/src/api-examples/<group>.tsx, then: node tools/api-examples.js");
});

test("example files name real exports, once each, and PENDING only lists unfinished subpaths", () => {
  const { problems, done } = generate();
  assert.deepEqual(problems, []);
  assert.deepEqual(done, [], "these subpaths have every example: remove them from PENDING in tools/api-examples.js");
});

test("the indexes, the per-example modules and the signature files are up to date", () => {
  const { files } = generate();
  for (const [rel, text] of Object.entries(files)) assert.equal(readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"), text, `${rel} is stale: node tools/api-examples.js`);
  assert.deepEqual(straySigs(files), [], "files no longer generated: node tools/api-examples.js");
  const gen = Object.keys(files).filter((f) => f.includes("/api-examples/gen/"));
  assert.equal(new Set(gen.map((f) => f.toLowerCase())).size, gen.length, "generated file names differ in more than case (case-insensitive file systems)");
});

test("examples load lazily: nothing at start-up, the API page's index loads the part of an example", () => {
  const index = readFileSync(new URL("../examples/showcase/src/api-examples.gen.ts", import.meta.url), "utf8");
  assert.doesNotMatch(index, /^import (?!type )(?!\{ runLoad \} from "hadi-march\/lazy";$)/m, "the index imports no example statically");
  assert.doesNotMatch(index, /api-examples\/[a-z0-9-]+\.tsx"/, "the index never loads a whole group file");
  const main = readFileSync(new URL("../examples/showcase/src/main.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(main, /api-examples/);
  // only the API page imports the index
  const src = new URL("../examples/showcase/src/", import.meta.url);
  const users = readdirSync(src, { recursive: true }).map((f) => f.replace(/\\/g, "/"))
    .filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.startsWith("api-examples") && readFileSync(new URL(f, src), "utf8").includes("api-examples.gen"));
  assert.deepEqual(users, ["pages/api.tsx"]);
  const { files } = generate();
  // a part imports its examples statically (one file); few parts, each holding a share of the examples
  const parts = Object.entries(files).filter(([f]) => f.endsWith(EX));
  assert.ok(parts.length >= 5 && parts.length <= 40, `${parts.length} parts: a host takes a limited number of files per release`);
  assert.ok(parts.every(([f]) => /\/gen\/part-\d\d\.ex\.tsx$/.test(f)), "only parts are lazy files");
  const held = new Set();
  for (const [rel, text] of parts) {
    assert.doesNotMatch(text, /import\(/, `${rel}: imports its examples statically`);
    for (const m of text.matchAll(/^import e\d+ from "\.\/(.+)";$/gm)) { assert.ok(m[1].endsWith(ONE), `${rel}: ${m[1]}`); held.add(m[1]); }
  }
  assert.equal(held.size, Object.keys(files).filter((f) => f.endsWith(ONE)).length, "every example is in exactly one part");
  // an example module never imports its group file
  for (const [rel, text] of Object.entries(files).filter(([f]) => f.endsWith(ONE))) assert.doesNotMatch(text, /from "\.\.\/\.\.\/[a-z0-9-]+\.tsx"/, `${rel} imports a group file`);
});

test("a group file splits into examples that import only what they use", () => {
  const src = `import { signal, computed } from "hadi-march";
import { Button, Badge } from "hadi-march/ui";
import type { Manager } from "hadi-march/managers";
import { examples } from "./types.ts";
import "./g.css";
export { default as SIG } from "./g.sig.gen.ts";

let ready = false
const ensure = () => { if (!ready) ready = true }
const fmt = (m: Manager<any, any>) => String(m)
function Box() { return <Badge>{fmt(null as never)}</Badge> }
const lazyKit = () => import("./_kit.tsx")

export default examples({
  "hadi-march": {
    signal: {
      code: \`signal(1)\`,
      run: () => { ensure(); const n = signal(1); return <Button onClick={() => n.set(2)}>{n}</Button> },
    },
    Signal: { code: "x", run: () => <Box /> },
  },
  "hadi-march/ui": {
    Badge: { code: "x", run: () => lazyKit() },
  },
})
`;
  const { files, problems } = splitGroup("g", src, ts);
  assert.deepEqual(problems, []);
  const keys = fileKeys(["signal", "Signal"]);
  assert.notEqual(keys.get("signal").toLowerCase(), keys.get("Signal").toLowerCase());
  const sig = files[`gen/g/main--${keys.get("signal")}${ONE}`];
  assert.match(sig, /^import \{ signal \} from "hadi-march";$/m);
  assert.match(sig, /^import \{ Button \} from "hadi-march\/ui";$/m);
  assert.match(sig, /^import \{ ensure \} from "\.\/_ready\.tsx";$/m, "a helper that writes a let stays with it");
  assert.match(sig, /^import "\.\.\/\.\.\/g\.css";$/m);
  assert.doesNotMatch(sig, /computed|Badge|{ examples }|SIG/);
  const box = files["gen/g/_box.tsx"];
  assert.match(box, /^import \{ Badge \} from "hadi-march\/ui";$/m);
  assert.match(box, /^import \{ fmt \} from "\.\/_fmt\.tsx";$/m);
  assert.match(files["gen/g/_fmt.tsx"], /^import type \{ Manager \} from "hadi-march\/managers";$/m, "a name used only as a type is a type import");
  assert.match(files["gen/g/_lazy-kit.tsx"], /import\("\.\.\/\.\.\/_kit\.tsx"\)/, "a relative import() is rebased");
  assert.match(files["gen/g/_ready.tsx"], /^let ready = false$/m);
  assert.match(files["gen/g/_ready.tsx"], /^export \{ ready, ensure \};$/m);
});
