// CtaBand (hadi-march/landing): the "ready to start?" band near the end of a page — a rounded panel with a title, a
// lead and actions over a themed background: gradient (brand colours), mesh, glass, plain or a video. A light follows
// the pointer; the panel rises in when it scrolls into view.
import "./cta-band.css";
import { h } from "../../../dom/h.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { Overlay } from "../../../ui/overlay.ts";
import { Reveal } from "../reveal/index.ts";
import { SiteSection } from "../site-section/index.ts";
import { VideoBackground } from "../video-background/index.ts";
import { actionButtons, type HeroAction } from "../hero/index.ts";

export interface CtaBandProps {
  title: MaybeFn<unknown>;
  lead?: MaybeFn<unknown> | undefined;
  actions?: readonly (HeroAction | Node)[] | undefined;
  note?: MaybeFn<unknown> | undefined;
  variant?: "gradient" | "mesh" | "glass" | "plain" | "video" | undefined;
  video?: { src: string; poster?: string | undefined } | undefined;
  align?: "center" | "start" | undefined;
  class?: ClassProp | undefined;
}

/** `<CtaBand title="Ready to build?" lead="…" actions={[{ label: "Start free", href: "/start" }]} variant="gradient" />` */
export function CtaBand(props: CtaBandProps): Element {
  const variant = props.variant ?? "gradient";
  const copy = h("div", { class: cx("hm-cta-copy", props.align === "start" && "hm-cta-start") },
    h("h2", { class: "hm-cta-title" }, () => val(props.title)),
    props.lead != null && h("p", { class: "hm-cta-lead" }, () => val(props.lead)),
    props.actions?.length ? h("div", { class: "hm-cta-actions" }, actionButtons(props.actions)) : null,
    props.note != null && h("p", { class: "hm-cta-note" }, () => val(props.note)));
  const layers = variant === "gradient" ? [h(Overlay, { effect: "gradient" }), h(Overlay, { effect: "noise", opacity: 0.5 }), h(Overlay, { effect: "spotlight", class: "hm-cta-light" })]
    : variant === "mesh" ? [h(Overlay, { effect: "mesh" }), h(Overlay, { effect: "spotlight" })]
      : variant === "glass" ? [h(Overlay, { effect: "dots", opacity: 0.6 }), h(Overlay, { effect: "glass" }), h(Overlay, { effect: "spotlight" })]
        : variant === "plain" ? [h(Overlay, { effect: "grid", opacity: 0.6 })] : [];
  const panel = variant === "video" && props.video
    ? h(VideoBackground, { src: props.video.src, poster: props.video.poster, tint: "brand", class: "hm-cta-panel" }, copy)
    : h("div", { class: "hm-cta-panel" }, ...layers, copy);
  return h(SiteSection, { space: "sm", class: cx("hm-cta", `hm-cta-${variant}`, val(props.class)) }, h(Reveal, { effect: "scale", self: true, duration: 900 }, panel)) as Element;
}
