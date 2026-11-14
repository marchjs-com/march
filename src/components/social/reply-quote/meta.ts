import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ReplyQuote",
  status: "experimental",
  since: "0.1.0",
  summary: "The quoted message of a reply: name + a cut of the text behind a coloured bar; a quote inside a bubble or the \"replying to\" preview above a message field with a cancel button.",
  category: "social",
  composedOf: ["ClampText", "IconButton"],
  behaviors: [],
  hubs: [],
  showcase: "/social",
});
