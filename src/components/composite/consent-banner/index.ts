// ConsentBanner (composite: Button, Card, Dialog, Toggle) — the consent UI, built from existing components: <ConsentBanner> (Button), openConsentPreferences() (Dialog on wide
// screens, bottom Drawer on mobile, a Card + Toggle per category) and <ConsentGate> (placeholder for third-party content).
// Lazy on purpose: load it with lazy(() => import("hadi-march/managers/consent/ui"), { pick: "ConsentBanner" }).
import "./consent-banner.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { Portal } from "../../../dom/portal.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, val, type ClassProp } from "../../../core/util.ts";
import { Button } from "../../../ui/button.ts";
import { Card } from "../../../ui/card.ts";
import { openDialog } from "../../../ui/dialog.ts";
import { Toggle } from "../../../forms/inputs.ts";
import { consent, type CategoryInfo } from "../../../managers/consent/index.ts";
import tr from "./tr.ts";

messages("tr", tr);

type Text = string | (() => string);
const txt = (v: Text | undefined, fallback: string): string => (typeof v === "function" ? v() : v ?? t(fallback));

/** The button and panel texts of the consent UI; every one is optional (default: the built-in text). */
export interface ConsentLabels {
  reject?: Text; customize?: Text; accept?: Text; save?: Text;
  /** First paragraph of the preferences panel. */
  lead?: Text;
  alwaysOn?: Text; withdraw?: Text;
  /** "Saved on … (policy version …)" line of the panel. */
  saved?: (date: string, version: string) => string;
  /** ConsentGate buttons. */
  allow?: Text; preferences?: Text;
}

export interface ConsentTexts {
  /** Banner / panel title. */
  title?: Text;
  /** Banner text: the app's own wording (its legal text). */
  text?: Text;
  /** Label of the policy link (shown when configureConsent({ policyHref }) is set). */
  policyLabel?: Text;
  /** Own texts for the buttons and the preferences panel. */
  labels?: ConsentLabels | undefined;
}

export interface ConsentBannerProps extends ConsentTexts {
  /** Show even when a decision is already stored (demos); a choice made on the banner still closes it. */
  always?: boolean;
  /** Render in place, in the page flow, instead of the bottom layer (demos). */
  inline?: boolean;
  /** The Customize button that opens the preferences panel. Default true. Reject and Accept always stay, side by side. */
  customize?: boolean | undefined;
  class?: ClassProp;
}

// forced: shown on request (showConsentBanner). closedFor: the record the banner was closed with — it stays closed
// while that record holds and comes back when it changes (withdrawal, a new policy version)
const forced = signal(false);
const NONE = {};
const closedFor = signal<unknown>(NONE);
/** Show the banner again, even when a decision is stored (a "cookie settings" link, demos). */
export function showConsentBanner(): void { closedFor.set(NONE); forced.set(true); }
/** Close the banner; a choice made on it calls this. It comes back when the stored decision changes or goes away. */
export function hideConsentBanner(): void { forced.set(false); closedFor.set(untrack(() => consent.record())); }

const policyLink = (p: ConsentTexts): unknown => {
  const href = consent.policyHref();
  return href ? h("a", { class: "hm-consent-link", href, target: "_blank", rel: "noopener" }, () => txt(p.policyLabel, "Privacy policy")) : null;
};

/** The three equal choices: refusing is as easy as accepting. */
function choices(after: () => void, more?: (() => void) | null, l?: ConsentLabels): Element {
  return h("div", { class: "hm-consent-actions" },
    h(Button, { variant: "secondary", "on:click": () => { consent.rejectAll(); after(); } }, () => txt(l?.reject, "Reject all")),
    more ? h(Button, { variant: "ghost", "on:click": more }, () => txt(l?.customize, "Customize")) : null,
    h(Button, { variant: "primary", "on:click": () => { consent.acceptAll(); after(); } }, () => txt(l?.accept, "Accept all")));
}

/** Bottom banner, shown while there is no valid decision for the current policy version. */
export function ConsentBanner(props: ConsentBannerProps = {}): unknown {
  const body = (): Element => h("section", { class: () => cx("hm-consent", val(props.class)), role: "region", "aria-label": () => txt(props.title, "Cookies and privacy") },
    h("div", { class: "hm-consent-text" },
      h("h2", { class: "hm-consent-title" }, () => txt(props.title, "Cookies and privacy")),
      h("p", {}, () => txt(props.text, "We use cookies that are needed for the site to work and, with your permission, others for preferences, statistics, marketing and third-party content. You can change your choice at any time."), " ", policyLink(props))),
    choices(hideConsentBanner, props.customize === false ? null : () => { void openConsentPreferences(props).then((saved) => { if (saved) hideConsentBanner(); }); }, props.labels));
  const show = (): boolean => forced() || (closedFor() !== consent.record() && (!!props.always || !consent.decided()));
  return () => (show() ? (props.inline ? h("div", { class: "hm-consent-inline" }, body()) : h(Portal, { layer: "toast" }, body())) : null);
}

/** One category: Card with the description and a Toggle (required ones are on and locked). */
function categoryCard(c: CategoryInfo, value: () => boolean, set: (v: boolean) => void, l?: ConsentLabels): unknown {
  return h(Card, {
    class: "hm-consent-cat", title: () => t(c.title),
    actions: [h(Toggle, { get value() { return value(); }, setValue: set, disabled: !!c.required, "aria-label": t(c.title) })],
  }, h("p", { class: "hm-consent-desc" }, () => t(c.description)), c.required ? h("p", { class: "hm-consent-always" }, () => txt(l?.alwaysOn, "Always on")) : null);
}

/** The detailed panel. Resolves to true when the user saved a choice, false when dismissed. */
export async function openConsentPreferences(p: ConsentTexts = {}): Promise<boolean> {
  // the viewport manager is asked only here (a bottom sheet on phones): loaded with the panel, not with the banner
  const { viewport } = await import("../../../managers/viewport/index.ts");
  const mobile = untrack(() => viewport().mobile());
  const draft = signal({ ...untrack(() => consent.choices()) });
  const l = p.labels;
  return openDialog<boolean>((close) => {
    const rec = untrack(() => consent.record());
    return h("div", { class: "hm-consent-panel" },
      h("p", { class: "hm-consent-lead" }, () => txt(l?.lead, "Choose which cookies and data uses you allow. Strictly necessary ones are always on."), " ", policyLink(p)),
      untrack(() => consent.categories()).map((c) => categoryCard(c, () => !!c.required || !!draft()[c.id], (v) => draft.update((d) => ({ ...d, [c.id]: v })), l)),
      rec ? h("p", { class: "hm-consent-meta" }, () => l?.saved?.(new Date(rec.date).toLocaleString(), String(rec.version)) ?? t("Saved on {0} (policy version {1}).", { 0: new Date(rec.date).toLocaleString(), 1: rec.version }), " ",
        h("button", { type: "button", class: "hm-consent-withdraw", onClick: () => { consent.withdraw(); close(true); } }, () => txt(l?.withdraw, "Withdraw consent"))) : null);
  }, {
    title: () => txt(p.title, "Privacy preferences"), size: "md", dismissValue: false,
    ...(mobile ? { kind: "drawer" as const, side: "bottom" as const } : {}),
    footer: (close) => h("div", { class: "hm-consent-actions" },
      h(Button, { variant: "secondary", "on:click": () => { consent.rejectAll(); close(true); } }, () => txt(l?.reject, "Reject all")),
      h(Button, { variant: "ghost", "on:click": () => { consent.save(untrack(draft)); close(true); } }, () => txt(l?.save, "Save choices")),
      h(Button, { variant: "primary", "on:click": () => { consent.acceptAll(); close(true); } }, () => txt(l?.accept, "Accept all"))),
  });
}

export interface ConsentGateProps {
  category: string;
  /** What the placeholder says (default: a generic "This content is blocked" text). */
  label?: Text;
  /** Own texts for the placeholder's buttons (`allow`, `preferences`) and for the panel it opens. */
  labels?: ConsentLabels | undefined;
  /** The Preferences button of the placeholder. Default true. */
  preferences?: boolean | undefined;
  class?: ClassProp;
  children?: unknown;
}

/** Renders its children only while `category` is granted; otherwise a placeholder that can grant it in place. */
export function ConsentGate(props: ConsentGateProps): unknown {
  return () => (consent.has(props.category)
    ? props.children
    : h("div", { class: () => cx("hm-consent-gate", val(props.class)), role: "note" },
      h("p", {}, () => txt(props.label, "This content is from another provider and stays off until you allow it.")),
      h("div", { class: "hm-consent-actions" },
        h(Button, { size: "sm", variant: "primary", "on:click": () => consent.save({ ...untrack(() => consent.choices()), [props.category]: true }) }, () => txt(props.labels?.allow, "Allow")),
        props.preferences === false ? null : h(Button, { size: "sm", variant: "ghost", "on:click": () => { void openConsentPreferences({ labels: props.labels }); } }, () => txt(props.labels?.preferences, "Preferences")))));
}
