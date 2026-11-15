import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("node --import march/register imports .jsx files", () => {
  const script = `import { installDom } from "march/testing"; installDom();
    const { render } = await import("march"); const { default: Hello } = await import(${JSON.stringify(new URL("./fixtures-hello.jsx", import.meta.url).href)});
    const el = document.createElement("div"); render(() => Hello(), el); el.querySelector("b").click(); console.log(el.textContent);`;
  const out = execFileSync(process.execPath, ["--import", "march/register", "--input-type=module", "-e", script], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" });
  assert.equal(out.trim(), "2");
});
