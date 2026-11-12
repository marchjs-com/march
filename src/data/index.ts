// HADI March data (hadi-march/data): queries, mutations and access (query.ts), grouping (group.ts) and the "data"
// category components. Library code imports ./query.ts directly: this barrel also re-exports the components (each with
// its stylesheet), which a table, an API client or a CRUD screen must not pull in.
export * from "./query.ts";

// grouping and aggregation (pure): DataGrid group rows / footers, reports, charts
export { aggregate, aggregates, groupRows } from "./group.ts";
export type { AggregateKind, Aggregate, GroupLevel, GroupAggregate, GroupHeader, GroupRow, GroupItem, GroupOptions } from "./group.ts";

// components of the "data" category (src/components/data, generated barrel)
export * from "../components/data/index.ts";
