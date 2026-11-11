import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compile } from "../compiler/index.js";

test("$ declarations keep their TypeScript annotations as generics", () => {
  const out = compile("let $n: number = 0\nlet $f: (x: number) => void = noop\nconst $d: string = $n.toFixed(1)\nlet $m: Map<string, number[]> = new Map()", { runtime: "hadi-march" }).code;
  assert.match(out, /const \$n = _\$signal<number>\(0\)/);
  assert.match(out, /const \$f = _\$signal<\(x: number\) => void>\(noop\)/);
  assert.match(out, /const \$d = _\$computed<string>\(\(\) => \(\$n\(\)\.toFixed\(1\)\)\)/);
  assert.match(out, /const \$m = _\$signal<Map<string, number\[\]>>\(new Map\(\)\)/);
});

test(".tsx components run in node through hadi-march/register", () => {
  const script = `import { installDom } from "hadi-march/testing"; installDom();
    const { render } = await import("hadi-march"); const { default: Typed } = await import("./test/fixtures/typed.tsx");
    const el = document.createElement("div"); render(() => Typed({ title: "T" }), el); el.querySelector("button").click(); console.log(el.querySelector("p").textContent);`;
  const out = execFileSync(process.execPath, ["--import", "hadi-march/register", "--input-type=module", "-e", script], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" });
  assert.equal(out.trim(), "3");
});
