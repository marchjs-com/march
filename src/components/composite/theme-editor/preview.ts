// ThemeEditor preview (its own chunk): a small app screen built from real components — app bar and tabs, buttons, then
// two lazy parts of their own: cards with a bar chart and a form (preview-chart.ts), and alerts, a table, chips and a
// motion sample (preview-table.ts). It draws inside the editor's scope element, which carries the draft's variables;
// nothing here sets a color.
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { live } from "../../../forms/util.ts";
import { t, messages } from "../../../core/i18n.ts";
import { Button } from "../../../ui/button.ts";
import { Tabs } from "../../../ui/tabs.ts";
import { Avatar } from "../../../ui/avatar.ts";
import { lazy } from "../../../dom/lazy.ts";
import type { ThemeEditorContext } from "./types.ts";
import tr from "./tr.preview.ts";

messages("tr", tr);

const Charts = lazy(() => import("./preview-chart.ts"), { pick: "PreviewCharts", placeholder: "card", height: "20rem" });
const Rest = lazy(() => import("./preview-table.ts"), { pick: "PreviewTable", placeholder: "table", height: "24rem" });

/** The sample screen of the ThemeEditor preview. */
export function ThemePreview({ ctx }: { ctx: ThemeEditorContext }): Element {
  const tab = signal("overview");
  return h("div", { class: "m-te-screen" },
    h("header", { class: "m-te-appbar" },
      h("span", { class: "m-te-mark", "aria-hidden": "true" }),
      h("strong", { class: "m-te-appname" }, "HADİ"),
      h(Tabs, { panel: false, label: t`Sample tabs`, value: live(() => tab()), onChange: (v: string) => tab.set(v), tabs: [{ id: "overview", label: t`Overview` }, { id: "team", label: t`Team`, badge: 3 }, { id: "settings", label: t`Settings` }] }),
      h(Avatar, { name: "Elif Yılmaz", size: "sm" })),
    h("div", { class: "m-te-screen-body" },
      h("h3", { class: "m-te-display" }, t`Weekly summary`),
      h("p", { class: "m-muted m-te-lead" }, t`Sales rose this week; two tasks are waiting for review.`),
      h("div", { class: "m-te-btns" },
        h(Button, { variant: "primary" }, t`Create`), h(Button, {}, t`Share`), h(Button, { variant: "ghost" }, t`Cancel`), h(Button, { variant: "danger", size: "sm" }, t`Delete`)),
      h(Charts, {}),
      h(Rest, { ctx })));
}
