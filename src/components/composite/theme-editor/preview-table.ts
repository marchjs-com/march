// ThemeEditor preview, table part (its own chunk): alerts, a table with badges, chips and a motion sample. Loaded by
// preview.ts; it draws inside the editor's scope element and sets no color.
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { Button } from "../../../ui/button.ts";
import { Badge } from "../../../ui/badge.ts";
import { Alert } from "../../../ui/feedback.ts";
import { Chip } from "../../actions/chip/index.ts";
import { animate } from "../../../motion/animate.ts";
import type { ThemeEditorContext } from "./types.ts";
import { withColor } from "../../../theme/colors.ts";

const ROWS: readonly [string, string, string, number][] = [["HADİ", "Design", "success", 92], ["Globex", "Product", "warn", 64], ["Initech", "Support", "danger", 31]];

/** Alerts, table, chips and motion of the ThemeEditor preview. */
export function PreviewTable({ ctx }: { ctx: ThemeEditorContext }): Element {
  let dots: HTMLElement;
  const playMotion = (): void => {
    const m = ctx.draft.peek().motion, off = ctx.reduced.peek() ? 0 : 1;
    const x = ctx.dir.peek() === "rtl" ? "-140%" : "140%";
    [...dots.children].forEach((el, i) => animate(el, [{ transform: "translateX(0)" }, { transform: `translateX(${x})` }, { transform: "translateX(0)" }], {
      duration: (i === 0 ? m.fast : i === 1 ? m.base : m.slow) * 2 * off, easing: i === 2 ? m.easeSpring : m.easeOut,
    }));
  };
  dots = h("div", { class: "m-te-dots", "aria-hidden": "true" }, h("span", {}), h("span", {}), h("span", {})) as HTMLElement;
  return h("div", { class: "m-te-rest" },
    h("div", { class: "m-te-alerts" },
      h(Alert, { tone: "success", title: t`Saved` }, t`Your changes are live.`),
      h(Alert, { tone: "warn", title: t`Check` }, t`Two invoices are due.`),
      h(Alert, { tone: "danger", title: t`Failed` }, t`The payment did not go through.`),
      h(Alert, { tone: "info", title: t`Tip` }, t`Press Ctrl+K for commands.`)),
    h("div", { class: "m-te-table-wrap" },
      h("table", { class: "m-te-table" },
        h("caption", { class: "m-sr-only" }, t`Projects`),
        h("thead", {}, h("tr", {}, h("th", { scope: "col" }, t`Customer`), h("th", { scope: "col" }, t`Team`), h("th", { scope: "col" }, t`Status`), h("th", { scope: "col" }, t`Score`))),
        h("tbody", {}, ROWS.map(([name, team, tone, score]) => h("tr", {},
          h("td", {}, name), h("td", {}, t(team)), h("td", {}, h(Badge, { tone, dot: true }, tone === "success" ? t`On track` : tone === "warn" ? t`At risk` : t`Late`)),
          h("td", { class: "m-tnum" }, String(score))))))),
    h("div", { class: "m-te-foot" },
      h("div", { class: "m-te-chips" }, h(Chip, { tone: "primary" }, t`Design`), h(Chip, {}, t`Product`), withColor(h(Chip, {}, t`Activity`), "brand-blue"), withColor(h(Chip, {}, t`Friendship`), "brand-green")),
      h("div", { class: "m-te-motion" }, dots, h(Button, { size: "sm", variant: "ghost", onClick: playMotion }, t`Play motion`))));
}
