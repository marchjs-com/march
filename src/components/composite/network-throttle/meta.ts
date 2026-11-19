import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "NetworkThrottle",
  status: "experimental",
  since: "0.2.0",
  summary: "Network speed panel as in the developer tools: offline, slow / fast 3G, 4G, Wi-Fi or your own bandwidths and latency, for the page or only a scope of code; a speed gauge and the slowed requests as a live waterfall.",
  category: "composite",
  composedOf: ["Chip", "Slider", "SectionLabel", "IconButton", "Empty"],
  behaviors: [],
  hubs: [],
  showcase: "/composite",
});
