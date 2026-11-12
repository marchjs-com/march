// Consent UI, built from existing components: <ConsentBanner> (Button), openConsentPreferences() (Dialog on wide
// screens, bottom Drawer on mobile, a Card + Toggle per category) and <ConsentGate> (placeholder for third-party content).
// Lazy on purpose: load it with lazy(() => import("hadi-march/managers/consent/ui"), { pick: "ConsentBanner" }).
import "./consent.css";
import { signal, untrack } from "../../core/reactive.ts";
import { h } from "../../dom/h.ts";
import { Portal } from "../../dom/portal.ts";
import { t, messages } from "../../core/i18n.ts";
import { Button } from "../../ui/button.ts";
import { Card } from "../../ui/card.ts";
import { openDialog } from "../../ui/dialog.ts";
import { Toggle } from "../../forms/inputs.ts";
import { viewport } from "../viewport/index.ts";
import { consent, type CategoryInfo } from "./index.ts";
import tr from "./tr.ts";

messages("tr", tr);

type Text = string | (() => string);
const txt = (v: Text | undefined, fallback: string): string => (typeof v === "function" ? v() : v ?? t(fallback));

export interface ConsentTexts {
  /** Banner / panel title. */
  title?: Text;
  /** Banner text: the app's own wording (its legal text). */
  text?: Text;
  /** Label of the policy link (shown when configureConsent({ policyHref }) is set). */
  policyLabel?: Text;
}

export interface ConsentBannerProps extends ConsentTexts {
  /** Show even after a decision (demos). */
  always?: boolean;
  /** Render in place instead of the bottom layer (demos). */
  inline?: boolean;
}

const policyLink = (p: ConsentTexts): unknown => {
  const href = consent.policyHref();
  return href ? h("a", { class: "hm-consent-link", href, target: "_blank", rel: "noopener" }, () => txt(p.policyLabel, "Privacy policy")) : null;
};

/** The three equal choices: refusing is as easy as accepting. */
function choices(after: () => void, more?: () => void): Element {
  return h("div", { class: "hm-consent-actions" },
    h(Button, { variant: "secondary", "on:click": () => { consent.rejectAll(); after(); } }, () => t("Reject all")),
    more ? h(Button, { variant: "ghost", "on:click": more }, () => t("Customize")) : null,
    h(Button, { variant: "primary", "on:click": () => { consent.acceptAll(); after(); } }, () => t("Accept all")));
}

/** Bottom banner, shown while there is no valid decision for the current policy version. */
export function ConsentBanner(props: ConsentBannerProps = {}): unknown {
  const body = (): Element => h("section", { class: "hm-consent", role: "region", "aria-label": () => txt(props.title, "Cookies and privacy") },
    h("div", { class: "hm-consent-text" },
      h("h2", { class: "hm-consent-title" }, () => txt(props.title, "Cookies and privacy")),
      h("p", {}, () => txt(props.text, "We use cookies that are needed for the site to work and, with your permission, others for preferences, statistics, marketing and third-party content. You can change your choice at any time."), " ", policyLink(props))),
    choices(() => {}, () => { void openConsentPreferences(props); }));
  const show = (): boolean => !!props.always || !consent.decided();
  return () => (show() ? (props.inline ? body() : h(Portal, { layer: "toast" }, body())) : null);
}

/** One category: Card with the description and a Toggle (required ones are on and locked). */
function categoryCard(c: CategoryInfo, value: () => boolean, set: (v: boolean) => void): unknown {
  return h(Card, {
    class: "hm-consent-cat", title: () => t(c.title),
    actions: [h(Toggle, { get value() { return value(); }, setValue: set, disabled: !!c.required, "aria-label": t(c.title) })],
  }, h("p", { class: "hm-consent-desc" }, () => t(c.description)), c.required ? h("p", { class: "hm-consent-always" }, () => t("Always on")) : null);
}

/** The detailed panel. Resolves to true when the user saved a choice, false when dismissed. */
export function openConsentPreferences(p: ConsentTexts = {}): Promise<boolean> {
  const mobile = untrack(() => viewport().mobile());
  const draft = signal({ ...untrack(() => consent.choices()) });
  return openDialog<boolean>((close) => {
    const rec = untrack(() => consent.record());
    return h("div", { class: "hm-consent-panel" },
      h("p", { class: "hm-consent-lead" }, () => t("Choose which cookies and data uses you allow. Strictly necessary ones are always on."), " ", policyLink(p)),
      untrack(() => consent.categories()).map((c) => categoryCard(c, () => !!c.required || !!draft()[c.id], (v) => draft.update((d) => ({ ...d, [c.id]: v })))),
      rec ? h("p", { class: "hm-consent-meta" }, () => t("Saved on {0} (policy version {1}).", { 0: new Date(rec.date).toLocaleString(), 1: rec.version }), " ",
        h("button", { type: "button", class: "hm-consent-withdraw", onClick: () => { consent.withdraw(); close(true); } }, () => t("Withdraw consent"))) : null);
  }, {
    title: () => txt(p.title, "Privacy preferences"), size: "md", dismissValue: false,
    ...(mobile ? { kind: "drawer" as const, side: "bottom" as const } : {}),
    footer: (close) => h("div", { class: "hm-consent-actions" },
      h(Button, { variant: "secondary", "on:click": () => { consent.rejectAll(); close(true); } }, () => t("Reject all")),
      h(Button, { variant: "ghost", "on:click": () => { consent.save(untrack(draft)); close(true); } }, () => t("Save choices")),
      h(Button, { variant: "primary", "on:click": () => { consent.acceptAll(); close(true); } }, () => t("Accept all"))),
  });
}

export interface ConsentGateProps {
  category: string;
  /** What the placeholder says (default: a generic "This content is blocked" text). */
  label?: Text;
  children?: unknown;
}

/** Renders its children only while `category` is granted; otherwise a placeholder that can grant it in place. */
export function ConsentGate(props: ConsentGateProps): unknown {
  return () => (consent.has(props.category)
    ? props.children
    : h("div", { class: "hm-consent-gate", role: "note" },
      h("p", {}, () => txt(props.label, "This content is from another provider and stays off until you allow it.")),
      h("div", { class: "hm-consent-actions" },
        h(Button, { size: "sm", variant: "primary", "on:click": () => consent.save({ ...untrack(() => consent.choices()), [props.category]: true }) }, () => t("Allow")),
        h(Button, { size: "sm", variant: "ghost", "on:click": () => { void openConsentPreferences(); } }, () => t("Preferences")))));
}
