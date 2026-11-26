import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "CandlestickChart",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Price chart: candles, OHLC bars or a close line over time, volume pane, moving averages, price marks, a live window that slides, range navigator, drag to zoom, a shared crosshair, keyboard candles, OHLC tooltip and a data table for screen readers.",
  composedOf: [],
  behaviors: ["keyboard points", "zoom", "range navigator", "sync crosshair", "chart motion (tween, presence)"],
  hubs: [],
});
