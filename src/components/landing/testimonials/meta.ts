import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Testimonials",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Customer quotes as a grid, two drifting Marquee rows, a masonry wall with Show more, or a Carousel; Avatar and Rating.",
  composedOf: ["Card", "Avatar", "Rating", "Marquee", "Carousel", "Button", "Reveal"],
  showcase: "/web",
  demoGroup: "sell",
});
