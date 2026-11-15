// Table example: a client-side people table and a server-side orders table built with march/table.
// Load the stylesheets once: march/css/tokens.css and march/css/table.css.
import { render, h } from "march";
import { createRouter } from "march/router";
import { schema } from "march/schema";
import { action } from "march/ui";
import { Table } from "march/table";

const Person = schema({
  name: { type: "text", required: true, max: 60 },
  email: { type: "email", required: true },
  age: { type: "int", min: 0, max: 130 },
  team: { type: "pick", options: ["design", "engineering", "sales"] },
  joined: { type: "date" },
  active: { type: "bool" },
});

const first = ["Ada", "Grace", "Linus", "Émile", "Zeynep", "Çağrı", "Bob", "Ingrid"];
const teams = ["design", "engineering", "sales"];
const seed = Array.from({ length: 240 }, (_, i) => ({
  id: i + 1, name: `${first[i % first.length]} ${i + 1}`, email: `person${i + 1}@example.com`,
  age: 20 + ((i * 7) % 45), team: teams[i % 3], joined: new Date(2020, i % 12, (i % 27) + 1).toISOString().slice(0, 10), active: i % 4 !== 0,
}));

// Pretend API with offset paging: { items, total }.
async function fetchOrders(p) {
  await new Promise((r) => setTimeout(r, 200));
  const all = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, customer: `Customer ${(i * 37) % 300}`, total: ((i * 7919) % 50000) / 100, status: ["open", "paid", "refunded"][i % 3] }));
  const rows = p.q ? all.filter((o) => o.customer.toLowerCase().includes(p.q.toLowerCase())) : all;
  return { items: rows.slice(p.skip, p.skip + p.limit), total: rows.length };
}

export function App() {
  let $people = seed;

  const remove = action("Delete", (rows) => { const ids = new Set([].concat(rows).map((r) => r.id)); $people = $people.filter((p) => !ids.has(p.id)); },
    { danger: true, confirm: (rows) => `Delete ${[].concat(rows).length} people?` });
  const deactivate = action("Deactivate", (rows) => { const ids = new Set(rows.map((r) => r.id)); $people = $people.map((p) => (ids.has(p.id) ? { ...p, active: false } : p)); });
  const email = action("Email", (row) => { location.href = `mailto:${row.email}`; });

  async function save(row, key, value) {
    await new Promise((r) => setTimeout(r, 150)); // the server call
    $people = $people.map((p) => (p.id === row.id ? { ...p, [key]: value } : p));
  }

  return (
    <main sx={{ p: 4, gap: 5 }}>
      <h1>People</h1>
      <Table
        rows={$people}
        schema={Person}
        columns={Person.columns({ name: { editable: true, pin: "left" }, age: { editable: true } })}
        selectable
        bulkActions={[deactivate, remove]}
        rowActions={[email, remove]}
        expand={(p) => <p>{p.name} joined on {p.joined | date("long")}.</p>}
        onEdit={save}
        storageKey="example.people"
        urlKey="people"
        filename="people"
        caption="People"
        empty={<p>No people yet.</p>}
      />

      <h1>Orders (server)</h1>
      <Table
        source={fetchOrders}
        paramNames={{ offset: "skip", size: "limit", search: "q", page: null }}
        columns={[
          { key: "id", label: "#", align: "end", width: 80 },
          { key: "customer", label: "Customer" },
          { key: "total", label: "Total", format: ["money", "USD"], align: "end" },
          { key: "status", label: "Status", filter: "select", options: ["open", "paid", "refunded"] },
        ]}
        pageSize={20}
        exportAll={async (p) => (await fetchOrders({ ...p, skip: 0, limit: 10000 })).items}
      />

      <h1>100,000 rows (virtual)</h1>
      <Table rows={Array.from({ length: 100000 }, (_, i) => ({ id: i, label: `Row ${i}`, value: (i * 31) % 1000 }))}
        columns={[{ key: "label" }, { key: "value", align: "end" }]} virtual height={420} rowHeight={40} paging={false} />
    </main>
  );
}

createRouter({ routes: { "/": { component: App } } });
render(() => h(App, {}), document.getElementById("app"));
