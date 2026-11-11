// Table benchmark (tiny DOM, relative numbers): create a <Table> with 1,000 and 10,000 client rows (no paging),
// then change one row, replace all rows, and sort. Run directly: `node bench/table.js`.
import { pathToFileURL } from "node:url";

const make = (n, salt = 0) => Array.from({ length: n }, (_, i) => ({ id: i, name: `name ${(i * 7919 + salt) % n}`, qty: (i * 31 + salt) % 997, ok: i % 3 === 0 }));
const COLUMNS = [{ key: "name", label: "Name" }, { key: "qty", label: "Qty", align: "end" }, { key: "ok", label: "OK" }];

/** @param {{installDom: Function}} deps @returns {Promise<{rows: number, create: number, updateOne: number, replaceAll: number, sort: number}[]>} */
export async function run({ installDom }) {
  const { document, cleanup } = installDom();
  try {
    const { signal, h, render } = await import("../src/index.ts");
    const { Table, createTable } = await import("../src/table/index.ts");
    const out = [];
    for (const n of [1_000, 10_000]) {
      const rows = signal(make(n));
      const el = document.createElement("div");
      document.body.appendChild(el);
      let table;
      const time = (fn) => { const t = performance.now(); fn(); return +(performance.now() - t).toFixed(1); };
      let dispose;
      const create = time(() => { dispose = render(() => { table = createTable({ rows, columns: COLUMNS, paging: false }); return h(Table, { table, toolbar: false }); }, el); });
      const updateOne = time(() => rows.set(rows.peek().map((r) => (r.id === 5 ? { ...r, name: "changed" } : r))));
      const replaceAll = time(() => rows.set(make(n, 1)));
      const sort = time(() => table.toggleSort("qty"));
      const rendered = el.querySelectorAll("tr[data-row]").length;
      if (rendered !== n) throw new Error(`table bench: expected ${n} rows, got ${rendered}`);
      out.push({ rows: n, create, updateOne, replaceAll, sort });
      dispose();
      el.remove();
    }
    return out;
  } finally {
    cleanup();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { installDom } = await import("../src/testing/dom.ts");
  const rows = await run({ installDom });
  console.log("Table (3 columns, client mode, no paging, tiny DOM)");
  console.table(rows.map((r) => ({ rows: r.rows.toLocaleString("en"), "create ms": r.create, "update 1 row ms": r.updateOne, "replace all ms": r.replaceAll, "sort ms": r.sort })));
}
