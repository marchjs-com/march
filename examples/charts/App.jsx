// Charts example: a small dashboard built with march/charts.
// Load the stylesheet once (src/charts/charts.css), e.g. with a <link> tag or your bundler's CSS import.
import { render } from "march";
import { LineChart, AreaChart, BarChart, PieChart, Sparkline, Stat, ProgressRing, BarList, Heatmap } from "march/charts";

const day = 864e5;
const start = Date.now() - 29 * day;
const random = (min, max) => Math.round(min + Math.random() * (max - min));

export function App() {
  let $sales = Array.from({ length: 30 }, (_, i) => ({ day: new Date(start + i * day), income: random(800, 1600), expense: random(400, 1100) }));
  let $picked = null;
  const $total = $sales.reduce((sum, r) => sum + r.income, 0);
  const $previous = $total * 0.92;

  const channels = [
    { label: "Search", value: 4200 }, { label: "Direct", value: 2900 }, { label: "Social", value: 1800 },
    { label: "Email", value: 950 }, { label: "Referral", value: 610 },
  ];
  const activity = [];
  for (let d = 0; d < 7; d++) for (let hour = 0; hour < 24; hour++) activity.push({ hour, weekday: d, visits: random(0, d < 5 && hour > 8 && hour < 19 ? 60 : 15) });
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const daily = Array.from({ length: 84 }, (_, i) => ({ date: new Date(Date.now() - i * day), commits: random(0, 9) }));

  function addDay() {
    const last = $sales[$sales.length - 1];
    $sales = [...$sales.slice(1), { day: new Date(last.day.getTime() + day), income: random(800, 1600), expense: random(400, 1100) }];
  }

  return (
    <main class="dashboard">
      <section class="kpis">
        <Stat label="Income (30 days)" value={$total} previous={$previous} format={["money", "USD"]} hint="vs previous period" spark={$sales.map((r) => r.income)} />
        <Stat label="Costs" value={1240} delta={-0.06} invert format={["money", "USD"]} />
        <ProgressRing value={82} label="Health score" />
        <span>Trend <Sparkline data={$sales} y="expense" width={100} height={24} /></span>
      </section>

      <LineChart data={$sales} x="day" y={["income", "expense"]} series={["Income", "Expense"]} format={["money", "USD"]} xFormat="date"
        title="Sales" description="Daily income and expense for the last 30 days" zoom onSelect={(p) => ($picked = p)} />
      <p>{$picked ? `Selected ${$picked.label}: ${$picked.values.income}` : "Click a point or press Enter on the chart."}</p>
      <button onClick={addDay}>Add a day</button>

      <AreaChart data={$sales} x="day" y={["income", "expense"]} stacked format="compact" title="Stacked totals" height={180} />
      <BarChart data={channels} x="label" y="value" title="Visits by channel" horizontal height={200} />
      <BarChart data={$sales.slice(-7)} x={(r) => r.day.toLocaleDateString(undefined, { weekday: "short" })} y={["income", "expense"]} title="Last 7 days" legend="right" />
      <PieChart data={channels} donut title="Channel share" legend="right" width={360} height={220} />
      <BarList data={channels} limit={3} title="Top channels" format="number" onSelect={(item) => ($picked = { label: item.label, values: { income: item.value } })} />
      <Heatmap data={activity} x="hour" y="weekday" value="visits" yFormat={(d) => weekdays[d]} title="Visits by weekday and hour" />
      <Heatmap data={daily} x="date" value="commits" calendar={{ weeks: 12 }} title="Commits, last 12 weeks" />
    </main>
  );
}

render(() => <App />, document.getElementById("app"));
