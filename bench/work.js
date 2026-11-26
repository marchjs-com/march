#!/usr/bin/env node
// March list work: how much DOM work each list operation does (node, tiny DOM). Counts, not times: the same on every
// machine, so CI can fail on a regression (test/perf-guard.test.js) where a timing would only be noise. A slowdown in
// March has almost always been more work (a node moved twice, a text written twice, a class rewritten for nothing),
// and that shows here first.
//   node bench/work.js [--rows 1000]
// The row is written the way the compiler emits it (a cloned template; _cls, _on, insert for its dynamic parts), the
// same table the site's speed comparison runs.
import { installDom } from "../src/testing/dom.ts";

/** Count inserts, removals, text writes, attribute writes and textContent clears while `fn` runs. */
function counter() {
  const c = { insert: 0, insertInto: new Map(), rowMoves: 0, remove: 0, text: 0, attr: 0, clear: 0 };
  const node = Object.getPrototypeOf(Object.getPrototypeOf(document.createElement("div")));
  const el = Object.getPrototypeOf(document.createElement("div"));
  const text = Object.getPrototypeOf(document.createTextNode(""));
  const ins = node.insertBefore, rem = node.removeChild, set = el.setAttribute;
  const tc = Object.getOwnPropertyDescriptor(node, "textContent");
  // rowMoves: every insert of a row, wherever it goes (a row put into a fragment first and then into the table moves twice)
  node.insertBefore = function (n, ref) { if (n.nodeType !== 11) { c.insert++; c.insertInto.set(this, (c.insertInto.get(this) ?? 0) + 1); if (n.localName === "tr") c.rowMoves++; } return ins.call(this, n, ref); };
  node.removeChild = function (n) { c.remove++; return rem.call(this, n); };
  el.setAttribute = function (k, v) { c.attr++; return set.call(this, k, v); };
  Object.defineProperty(node, "textContent", { configurable: true, get: tc.get, set(v) { if (this.nodeType === 1 && (v === "" || v == null)) c.clear++; tc.set.call(this, v); } });
  // Text keeps its data in a plain property: an accessor on the prototype sees every write, the first one included
  Object.defineProperty(text, "data", { configurable: true, get() { return this._d; }, set(v) { c.text++; this._d = v; } });
  const reset = () => { c.insert = c.rowMoves = c.remove = c.text = c.attr = c.clear = 0; c.insertInto.clear(); };
  return { c, reset };
}

/** The work of each list operation on a table of `n` rows. */
export async function listWork(n = 1000) {
  installDom();
  const { c, reset } = counter();
  const { render, signal, selector, effect, For, reactive, lazyChildren, insert, _tpl, _scls, _st, _on, _c } = await import("../src/index.ts");
  let id = 0;
  const rows = (k) => Array.from({ length: k }, () => ({ id: ++id, label: `row ${id}` }));
  const $rows = signal([]), $sel = signal(0);
  const isSelected = selector(() => $sel());
  // as the compiler emits <tr class={…}><td>{row().id}</td><td><a onClick={…}>{row().label}</a></td></tr>: one effect per row
  const tr = _tpl(["tr", [], ["td", []], ["td", [], ["a", []]]]);
  const table = _tpl(["table", [], ["tbody", []]]);
  const host = document.createElement("div");
  document.body.appendChild(host);
  render(() => table((t) => {
    insert(t.firstChild, _c(For, { each: reactive(() => $rows()), key: "id" }, lazyChildren(() => [(row) => tr((r) => {
      const a = r.firstChild, b = a.nextSibling, link = b.firstChild;
      let x1 = null, x2 = null;
      _on(link, "click", () => $sel.set(row().id));
      effect(() => { _scls(r, isSelected(row().id) ? "danger" : ""); x1 = _st(x1, a, null, row().id); x2 = _st(x2, link, null, row().label); });
    })])), null, 1);
  }), host);
  const tbody = host.querySelector("tbody");
  const into = () => c.insertInto.get(tbody) ?? 0;
  const op = (fn) => { reset(); fn(); return { insert: c.insert, intoTable: into(), rowMoves: c.rowMoves, remove: c.remove, text: c.text, attr: c.attr, clear: c.clear }; };
  const out = {};
  out.create = op(() => $rows.set(rows(n)));
  out.update = op(() => $rows.set($rows().map((r, i) => (i % 10 ? r : { id: r.id, label: `${r.label} !!!` }))));
  out.select = op(() => $sel.set($rows()[1].id));
  out.selectNext = op(() => $sel.set($rows()[2].id));
  out.swap = op(() => { const x = $rows().slice(); [x[1], x[n - 2]] = [x[n - 2], x[1]]; $rows.set(x); });
  out.remove = op(() => $rows.set($rows().filter((_, i) => i !== 5)));
  out.append = op(() => $rows.set($rows().concat(rows(n))));
  out.replace = op(() => $rows.set(rows(n)));
  out.clear = op(() => $rows.set([]));
  out.rowsLeft = tbody.querySelectorAll("tr").length;
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const i = process.argv.indexOf("--rows");
  const n = i > 0 ? Number(process.argv[i + 1]) : 1000;
  const w = await listWork(n);
  console.log(`March list work, ${n} rows (DOM operations per list operation)`);
  console.log("op          insert  intoTable  rowMoves  remove  text  attr  clear");
  for (const [k, v] of Object.entries(w)) if (typeof v === "object") console.log(k.padEnd(12) + [v.insert, v.intoTable, v.rowMoves, v.remove, v.text, v.attr, v.clear].map((x) => String(x).padStart(7)).join(""));
}
