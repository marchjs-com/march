// ThemeEditor preview (its own chunk): a small app screen built from real components — app bar and tabs, buttons, a
// form, cards with figures and a bar chart, alerts, a table, chips and a motion sample. It draws inside the editor's
// scope element, which carries the draft's variables; nothing here sets a color.
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { Button } from "../../../ui/button.ts";
import { Badge } from "../../../ui/badge.ts";
import { Card } from "../../../ui/card.ts";
import { Tabs } from "../../../ui/tabs.ts";
import { Alert } from "../../../ui/feedback.ts";
import { Avatar } from "../../../ui/avatar.ts";
import { Progress } from "../../../ui/progress.ts";
import { TextInput, Select, Checkbox, Toggle, Slider } from "../../../forms/inputs.ts";
import { lazy } from "../../../dom/lazy.ts";
import { Chip } from "../../actions/chip/index.ts";
import { animate } from "../../../motion/animate.ts";
import type { ThemeEditorContext } from "./types.ts";
import tr from "./tr.preview.ts";

messages("tr", tr);

// the chart engine is a chunk of its own (also used by the chart pages)
const BarChart = lazy(() => import("../../../charts/bar.ts"), { pick: "BarChart", placeholder: "chart", height: "150px" });

const SALES = [{ m: "Jan", a: 32, b: 18 }, { m: "Feb", a: 41, b: 24 }, { m: "Mar", a: 38, b: 30 }, { m: "Apr", a: 52, b: 27 }, { m: "May", a: 47, b: 35 }];
const ROWS: readonly [string, string, string, number][] = [["Acme", "Design", "success", 92], ["Globex", "Product", "warn", 64], ["Initech", "Support", "danger", 31]];

/** The sample screen of the ThemeEditor preview. */
export function ThemePreview({ ctx }: { ctx: ThemeEditorContext }): Element {
  const tab = signal("overview");
  const notify = signal(true);
  const level = signal(60);
  let dots: HTMLElement;
  const playMotion = (): void => {
    const m = ctx.draft.peek().motion, off = ctx.reduced.peek() ? 0 : 1;
    const x = ctx.dir.peek() === "rtl" ? "-140%" : "140%";
    [...dots.children].forEach((el, i) => animate(el, [{ transform: "translateX(0)" }, { transform: `translateX(${x})` }, { transform: "translateX(0)" }], {
      duration: (i === 0 ? m.fast : i === 1 ? m.base : m.slow) * 2 * off, easing: i === 2 ? m.easeSpring : m.easeOut,
    }));
  };
  dots = h("div", { class: "hm-te-dots", "aria-hidden": "true" }, h("span", {}), h("span", {}), h("span", {})) as HTMLElement;
  return h("div", { class: "hm-te-screen" },
    h("header", { class: "hm-te-appbar" },
      h("span", { class: "hm-te-mark", "aria-hidden": "true" }),
      h("strong", { class: "hm-te-appname" }, "Acme"),
      h(Tabs, { panel: false, label: t`Sample tabs`, get value() { return tab(); }, onChange: (v: string) => tab.set(v), tabs: [{ id: "overview", label: t`Overview` }, { id: "team", label: t`Team`, badge: 3 }, { id: "settings", label: t`Settings` }] }),
      h(Avatar, { name: "Elif Yılmaz", size: "sm" })),
    h("div", { class: "hm-te-screen-body" },
      h("h3", { class: "hm-te-display" }, t`Weekly summary`),
      h("p", { class: "hm-muted hm-te-lead" }, t`Sales rose this week; two tasks are waiting for review.`),
      h("div", { class: "hm-te-btns" },
        h(Button, { variant: "primary" }, t`Create`), h(Button, {}, t`Share`), h(Button, { variant: "ghost" }, t`Cancel`), h(Button, { variant: "danger", size: "sm" }, t`Delete`)),
      h("div", { class: "hm-te-cards" },
        h(Card, { title: t`Sales`, subtitle: t`Last five months` },
          h(BarChart, { data: SALES, x: "m", y: ["a", "b"], series: [t`Online`, t`Store`], height: 150, grid: true, legend: "bottom" as const })),
        h(Card, { title: t`New project` },
          h("div", { class: "hm-te-form-demo" },
            h("label", { class: "hm-te-mini-label" }, t`Project name`, h(TextInput, { value: "Acme", placeholder: t`Name` })),
            h("label", { class: "hm-te-mini-label" }, t`Team`, h(Select, { value: "design", options: [{ value: "design", label: t`Design` }, { value: "product", label: t`Product` }] })),
            h(Checkbox, { value: true, label: t`Private project` }),
            h(Toggle, { get value() { return notify(); }, onChange: (v: boolean) => notify.set(v), label: t`Notifications` }),
            h(Slider, { "aria-label": t`Budget`, get value() { return level(); }, onChange: (v: number) => level.set(v), format: (v: number) => `${v}%` }),
            h(Progress, { get value() { return level(); }, label: t`Budget`, size: "sm" })))),
      h("div", { class: "hm-te-alerts" },
        h(Alert, { tone: "success", title: t`Saved` }, t`Your changes are live.`),
        h(Alert, { tone: "warn", title: t`Check` }, t`Two invoices are due.`),
        h(Alert, { tone: "danger", title: t`Failed` }, t`The payment did not go through.`),
        h(Alert, { tone: "info", title: t`Tip` }, t`Press Ctrl+K for commands.`)),
      h("div", { class: "hm-te-table-wrap" },
        h("table", { class: "hm-te-table" },
          h("caption", { class: "hm-sr-only" }, t`Projects`),
          h("thead", {}, h("tr", {}, h("th", { scope: "col" }, t`Customer`), h("th", { scope: "col" }, t`Team`), h("th", { scope: "col" }, t`Status`), h("th", { scope: "col" }, t`Score`))),
          h("tbody", {}, ROWS.map(([name, team, tone, score]) => h("tr", {},
            h("td", {}, name), h("td", {}, t(team)), h("td", {}, h(Badge, { tone, dot: true }, tone === "success" ? t`On track` : tone === "warn" ? t`At risk` : t`Late`)),
            h("td", { class: "hm-tnum" }, String(score))))))),
      h("div", { class: "hm-te-foot" },
        h("div", { class: "hm-te-chips" }, h(Chip, { tone: "primary" }, t`Design`), h(Chip, {}, t`Product`), h(Chip, { color: "brand-blue" }, t`Activity`), h(Chip, { color: "brand-green" }, t`Friendship`)),
        h("div", { class: "hm-te-motion" }, dots, h(Button, { size: "sm", variant: "ghost", onClick: playMotion }, t`Play motion`)))));
}
