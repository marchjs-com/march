// ThemeEditor preview, chart part (its own chunk): the sales card with a bar chart and the form card. Loaded by
// preview.ts; it draws inside the editor's scope element and sets no color.
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { live } from "../../../forms/util.ts";
import { t } from "../../../core/i18n.ts";
import { Card } from "../../../ui/card.ts";
import { Progress } from "../../../ui/progress.ts";
import { TextInput, Select, Checkbox, Toggle, Slider } from "../../../forms/inputs.ts";
import { Field } from "../../../forms/field.ts";
import { uid } from "../../../core/util.ts";
import { lazy } from "../../../dom/lazy.ts";

// the chart engine is a chunk of its own (also used by the chart pages)
const BarChart = lazy(() => import("../../../charts/bar.ts"), { pick: "BarChart", placeholder: "chart", height: "150px" });

const SALES = [{ m: "Jan", a: 32, b: 18 }, { m: "Feb", a: 41, b: 24 }, { m: "Mar", a: 38, b: 30 }, { m: "Apr", a: 52, b: 27 }, { m: "May", a: 47, b: 35 }];

/** Chart and form cards of the ThemeEditor preview. */
export function PreviewCharts(): Element {
  const notify = signal(true);
  const level = signal(60);
  const nameId = uid("hm-te-p"), teamId = uid("hm-te-p");
  return h("div", { class: "hm-te-cards" },
    h(Card, { title: t`Sales`, subtitle: t`Last five months` },
      h(BarChart, { data: SALES, x: "m", y: ["a", "b"], series: [t`Online`, t`Store`], height: 150, grid: true, legend: "bottom" as const })),
    h(Card, { title: t`New project` },
      h("div", { class: "hm-te-form-demo" },
        h(Field, { id: nameId, label: t`Project name` }, h(TextInput, { id: nameId, value: "HADİ", placeholder: t`Name` })),
        h(Field, { id: teamId, label: t`Team` }, h(Select, { id: teamId, value: "design", options: [{ value: "design", label: t`Design` }, { value: "product", label: t`Product` }] })),
        h(Checkbox, { value: true, label: t`Private project` }),
        h(Toggle, { value: live(() => notify()), onChange: (v: boolean) => notify.set(v), label: t`Notifications` }),
        h(Slider, { "aria-label": t`Budget`, value: live(() => level()), onChange: (v: number) => level.set(v), format: (v: number) => `${v}%` }),
        h(Progress, { value: live(() => level()), label: t`Budget`, size: "sm" }))));
}
