import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "FileUpload",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Drop zone or click; accept / size checks, image and audio previews, upload progress and cancel.",
  category: "forms",
  composedOf: ["Progress", "ListRow", "IconButton", "Button", "Badge"],
  behaviors: ["dropzone"],
  hubs: [],
  showcase: "/forms",
});
