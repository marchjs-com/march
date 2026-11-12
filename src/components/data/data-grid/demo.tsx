// Showcase stage for DataGrid: up to 100 000 generated orders (deterministic, neutral demo data).
import { signal } from "hadi-march";
import { DataGrid, type DataGridColumn } from "./index.ts";

export const code = `<DataGrid rows={$orders} rowKey="id" selectable groupBy={["region"]}
  columns={[
    { key: "customer", label: "Müşteri", pin: "left", editable: true },
    { key: "region", label: "Bölge", filter: "select" },
    { key: "amount", label: "Tutar", format: ["money", "TRY"], aggregate: "sum" },
  ]}
  onEdit={(row, key, value) => save(row.id, key, value)} />`

interface Order { id: number; customer: string; region: string; status: string; product: string; qty: number; amount: number; date: string }
const CUSTOMERS = ["Acme", "Globex", "Initech", "Umbrella", "Stark Lojistik", "Wayne Gıda", "Hooli", "Vandelay", "Soylent", "Wonka", "Tyrell", "Cyberdyne"];
const REGIONS = ["Marmara", "Ege", "İç Anadolu", "Akdeniz", "Karadeniz"];
const STATUS = [{ value: "new", label: "Yeni" }, { value: "paid", label: "Ödendi" }, { value: "shipped", label: "Kargoda" }, { value: "done", label: "Teslim" }];
const PRODUCTS = ["Kalem", "Defter", "Çanta", "Masa", "Sandalye", "Lamba", "Monitör", "Klavye"];
const EXTRA = ["Kanal", "Depo", "Temsilci", "Kampanya", "Not"];
const rnd = (i: number, m: number) => ((i * 2654435761) >>> 0) % m;
const make = (n: number): Order[] => Array.from({ length: n }, (_, i) => {
  const qty = 1 + rnd(i * 7 + 1, 40);
  return {
    id: i + 1, customer: `${CUSTOMERS[rnd(i * 13 + 5, CUSTOMERS.length)]} ${1 + rnd(i * 3, 900)}`, region: REGIONS[rnd(i * 11 + 2, REGIONS.length)]!,
    status: STATUS[rnd(i * 5 + 3, STATUS.length)]!.value, product: PRODUCTS[rnd(i * 17, PRODUCTS.length)]!, qty, amount: qty * (25 + rnd(i * 29, 950)),
    date: new Date(Date.UTC(2026, 0, 1) + rnd(i * 31, 300) * 864e5).toISOString().slice(0, 10),
  };
});

const columns = (pinned: boolean): DataGridColumn<Order>[] => [
  { key: "id", label: "No", width: 84, type: "number" },
  { key: "customer", label: "Müşteri", width: 190, pin: pinned ? "left" : null, editable: true, filter: "text", validate: (v) => (String(v ?? "").trim() ? null : "Boş olamaz"), aggregate: "distinct" },
  { key: "region", label: "Bölge", width: 140, filter: "select", options: REGIONS },
  { key: "status", label: "Durum", width: 130, filter: "select", options: STATUS, editable: true },
  { key: "product", label: "Ürün", width: 140, filter: "select", options: PRODUCTS },
  { key: "qty", label: "Adet", width: 100, type: "number", editable: true, filter: "range", aggregate: "sum" },
  { key: "amount", label: "Tutar", width: 150, type: "number", format: ["money", "TRY"], filter: "range", aggregate: "sum" },
  { key: "unit", label: "Birim fiyat", width: 140, value: (r) => r.amount / r.qty, format: ["money", "TRY"], aggregate: "avg" },
  { key: "date", label: "Tarih", width: 130, type: "date", format: "date", filter: "dateRange" },
  ...EXTRA.map((label, j): DataGridColumn<Order> => ({ key: `x${j}`, label, width: 150, value: (r) => `${label} ${1 + rnd(r.id * (j + 3), 60)}` })),
];

export default function DataGridDemo(props: { values: { rows: string; group: string; density: string; selectable: boolean; pinned: boolean; footer: boolean } }) {
  return <div class="sc-stage">
    {() => {
      const v = props.values
      const data = signal(make(Number(v.rows)))
      return <DataGrid rows={data} rowKey="id" height={460} label="Siparişler" filename="siparisler"
        selectable={v.selectable} footer={v.footer} columns={columns(v.pinned)}
        groupBy={() => (props.values.group ? props.values.group.split(",") : [])}
        rowHeight={() => Number(props.values.density)}
        onEdit={(row: Order, key: string, value: unknown) => { data.set(data().map((r) => (r.id === row.id ? { ...r, [key]: value, amount: key === "qty" ? Number(value) * (r.amount / r.qty) : r.amount } : r))) }} />
    }}
  </div>
}
