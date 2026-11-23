import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ConsentBanner",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Consent UI of the consent manager: bottom banner, preferences panel (Dialog, bottom sheet on mobile) and ConsentGate placeholders for third-party content.",
  category: "composite",
  composedOf: ["Button", "Card", "Dialog", "Toggle", "Stack", "Empty"],
  behaviors: [],
  hubs: [],
  // lazy on purpose (march/managers/consent/ui): it brings Toggle and the dialog; kept out of the march/ui barrel
  barrel: false,
});
