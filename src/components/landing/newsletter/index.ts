// Newsletter (hadi-march/landing): an email sign-up. Inline (field + button on one line) or stacked. While sending the
// button shows its spinner; on success the form folds away and a check with the thank-you line pops in; on an error the
// field shakes and the message is announced. Motion engine only; reduced motion swaps without movement.
import "./newsletter.css";
import { h } from "../../../dom/h.ts";
import { signal, computed } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, uid, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { TextInput } from "../../../forms/inputs.ts";
import { Button } from "../../../ui/button.ts";
import { CheckMark } from "../../feedback/check-mark/index.ts";
import { SectionHead } from "../section-head/index.ts";
import { animate } from "../../../motion/engine/playback.ts";

export interface NewsletterProps {
  /** Save the address; throw (or reject) to show an error. */
  onSubmit: (email: string) => unknown | Promise<unknown>;
  title?: MaybeFn<unknown> | undefined;
  lead?: MaybeFn<unknown> | undefined;
  placeholder?: string | undefined;
  /** Button text (default "Subscribe"). */
  button?: MaybeFn<unknown> | undefined;
  /** Small print under the form (privacy note). */
  note?: MaybeFn<unknown> | undefined;
  /** Shown after success (default "Thanks! Check your inbox."). */
  done?: MaybeFn<unknown> | undefined;
  layout?: "inline" | "stacked" | undefined;
  /** The other texts the form writes itself; the defaults are translated. */
  labels?: {
    /** Accessible name of the field (default "Email address"). */
    email?: string;
    /** Message for an address that is not valid. */
    invalid?: string;
    /** Message when `onSubmit` fails without a message of its own. */
    error?: string;
  } | undefined;
  /** The check mark of the success line: true (default), false, or your own node. */
  doneIcon?: boolean | Node | undefined;
  /** The shake on an error and the fold / pop on success (default true); false: the states just change. */
  motion?: boolean | undefined;
  class?: ClassProp | undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** `<Newsletter title="Stay in the loop" onSubmit={(email) => api.subscribe(email)} note="No spam." />` */
export function Newsletter(props: NewsletterProps): Element {
  const email = signal(""), state = signal<"idle" | "pending" | "done" | "error">("idle"), error = signal("");
  const id = uid("m-nl");
  const done = computed(() => state() === "done");
  let field: HTMLElement | null = null; // the input: it shakes on an error
  const fail = (msg: string): void => {
    error.set(msg); state.set("error");
    if (field && props.motion !== false) animate(field, { transform: ["translateX(0px)", "translateX(-7px)", "translateX(7px)", "translateX(-4px)", "translateX(4px)", "translateX(0px)"] }, { duration: 420, easing: "linear" });
  };
  const submit = async (e: Event): Promise<void> => {
    e.preventDefault();
    const v = email.peek().trim();
    if (!EMAIL.test(v)) { fail(props.labels?.invalid ?? t`Enter a valid email address.`); return; }
    state.set("pending"); error.set("");
    try { await props.onSubmit(v); } catch (err) { fail((err as Error)?.message || (props.labels?.error ?? t`Something went wrong. Please try again.`)); return; }
    const form = root.querySelector(".m-nl-form") as HTMLElement | null;
    if (form && props.motion !== false) await animate(form, { opacity: [1, 0], transform: ["scale(1)", "scale(.96)"] }, { duration: 220, easing: "in" }).finished;
    state.set("done");
    const ok = root.querySelector(".m-nl-done") as HTMLElement | null;
    if (ok && props.motion !== false) animate(ok, { opacity: [0, 1], transform: ["scale(.85)", "scale(1)"] }, { duration: 520, easing: "spring-wobbly" });
  };
  const root = h("div", { class: () => cx("m-nl", `m-nl-${props.layout ?? "inline"}`, `is-${state()}`, val(props.class)) },
    props.title != null || props.lead != null ? h(SectionHead, {
      class: "m-nl-head", size: "sm", align: "start", width: "full", as: "h3", titleId: `${id}-t`,
      title: props.title != null ? () => val(props.title) : undefined, lead: props.lead != null ? () => val(props.lead) : undefined,
    }) : null,
    () => (done()
      ? h("p", { class: "m-nl-done", role: "status" }, props.doneIcon === false ? null : h(CheckMark, { class: "m-nl-check", variant: "solid", label: false, icons: { yes: props.doneIcon } }), () => val(props.done) ?? t`Thanks! Check your inbox.`)
      : h("form", { class: "m-nl-form", novalidate: true, "aria-labelledby": props.title != null ? `${id}-t` : null, onSubmit: submit },
        // the message is the input's own error line; its place is kept, so nothing moves when it appears
        h(TextInput, {
          class: "m-nl-field", value: email, type: "email", autocomplete: "email", inputmode: "email", required: true, id: `${id}-e`, ref: (el: HTMLInputElement) => { field = el; },
          placeholder: props.placeholder ?? t`you@example.com`, "aria-label": props.labels?.email ?? t`Email address`, error: () => (state() === "error" ? error() : ""), errorSpace: true,
        }),
        h(Button, { type: "submit", loading: () => state() === "pending", class: "m-nl-btn" }, () => val(props.button) ?? t`Subscribe`))),
    props.note != null && h("p", { class: "m-nl-note" }, () => val(props.note))) as HTMLElement;
  return root;
}
