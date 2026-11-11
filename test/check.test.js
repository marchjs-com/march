import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { check } from "../cli/check.js";

test("march check type-checks .tsx with March syntax and points at the source line", async () => {
  const dir = mkdtempSync(join(tmpdir(), "march-check-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", lib: ["ES2023", "DOM"], allowImportingTsExtensions: true, skipLibCheck: true } }));
    writeFileSync(join(dir, "src", "App.tsx"), [
      "function Hello(props: { name: string; n: number }) { return <b>{props.name}</b> }",
      "let $count = 0",
      "export const ok = <p on:click|prevent={() => $count++}>{$count | number}<Hello name=\"a\" n={$count} /></p>",
      "export const bad = <Hello name={$count} n={1} />",
    ].join("\n"));
    const lines = [];
    const n = await check({ cwd: dir, components: "src/components", log: (l) => lines.push(l) });
    assert.equal(n, 1, lines.join("\n"));
    assert.match(lines[0], /^src\/App\.tsx:4:\d+ - /);
    assert.ok(lines[0].includes("Type 'number' is not assignable to type 'string'"), lines[0]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
