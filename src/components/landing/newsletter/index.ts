// Newsletter (hadi-march/landing): an email sign-up. Inline (field + button on one line) or stacked. While sending the
// button shows its spinner; on success the form folds away and a check with the thank-you line pops in; on an error the
// field shakes and the message is announced. Motion engine only; reduced motion swaps without movement.
import "./newsletter.css";
import { h } from "../../../dom/h.ts";
import { signal, computed } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, uid, glyph, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { TextInput } from "../../../forms/inputs.ts";
import { Button } from "../../../ui/button.ts";
import { check } from "../../../icons/glyphs/check.ts";
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
  class?: ClassProp | undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** `<Newsletter title="Stay in the loop" onSubmit={(email) => api.subscribe(email)} note="No spam." />` */
export function Newsletter(props: NewsletterProps): Element {
  const email = signal(""), state = signal<"idle" | "pending" | "done" | "error">("idle"), error = signal("");
  const id = uid("hm-nl");
  const done = computed(() => state() === "done");
  let field: HTMLElement | null = null;
  const fail = (msg: string): void => {
    error.set(msg); state.set("error");
    if (field) animate(field, { transform: ["translateX(0px)", "translateX(-7px)", "translateX(7px)", "translateX(-4px)", "translateX(4px)", "translateX(0px)"] }, { duration: 420, easing: "linear" });
  };
  const submit = async (e: Event): Promise<void> => {
    e.preventDefault();
    const v = email.peek().trim();
    if (!EMAIL.test(v)) { fail(t`Enter a valid email address.`); return; }
    state.set("pending"); error.set("");
    try { await props.onSubmit(v); } catch (err) { fail((err as Error)?.message || t`Something went wrong. Please try again.`); return; }
    const form = root.querySelector(".hm-nl-form") as HTMLElement | null;
    if (form) await animate(form, { opacity: [1, 0], transform: ["scale(1)", "scale(.96)"] }, { duration: 220, easing: "in" }).finished;
    state.set("done");
    const ok = root.querySelector(".hm-nl-done") as HTMLElement | null;
    if (ok) animate(ok, { opacity: [0, 1], transform: ["scale(.85)", "scale(1)"] }, { duration: 520, easing: "spring-wobbly" });
  };
  const root = h("div", { class: () => cx("hm-nl", `hm-nl-${props.layout ?? "inline"}`, `is-${state()}`, val(props.class)) },
    props.title != null && h("h3", { class: "hm-nl-title", id: `${id}-t` }, () => val(props.title)),
    props.lead != null && h("p", { class: "hm-nl-lead" }, () => val(props.lead)),
    () => (done()
      ? h("p", { class: "hm-nl-done", role: "status" }, h("span", { class: "hm-nl-check", "aria-hidden": "true" }, glyph(check)), () => val(props.done) ?? t`Thanks! Check your inbox.`)
      : h("form", { class: "hm-nl-form", novalidate: true, "aria-labelledby": props.title != null ? `${id}-t` : null, onSubmit: submit },
        (field = h("div", { class: "hm-nl-field" }, h(TextInput, {
          value: email, type: "email", autocomplete: "email", inputmode: "email", required: true, id: `${id}-e`,
          placeholder: props.placeholder ?? t`you@example.com`, "aria-label": t`Email address`, get invalid() { return state() === "error"; }, describedby: `${id}-m`,
        })) as HTMLElement),
        h(Button, { type: "submit", loading: () => state() === "pending", class: "hm-nl-btn" }, () => val(props.button) ?? t`Subscribe`))),
    h("p", { class: "hm-nl-msg", id: `${id}-m`, role: "alert" }, () => (state() === "error" ? error() : "")),
    props.note != null && h("p", { class: "hm-nl-note" }, () => val(props.note))) as HTMLElement;
  return root;
}
