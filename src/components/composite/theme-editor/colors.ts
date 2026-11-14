// ThemeEditor colors tab (its own chunk): every color token of the edited mode, a ColorPicker and tone scale for the
// selected one, a dark mode made from the light one and the WCAG contrast audit with fixes.
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { live } from "../../../forms/util.ts";
import { t } from "../../../core/i18n.ts";
import { cx, setStyle } from "../../../core/util.ts";
import { Segmented } from "../../../forms/inputs.ts";
import { Button } from "../../actions/button/index.ts";
import { Badge } from "../../../ui/badge.ts";
import { Card } from "../../data/card/index.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { Swatch } from "../../forms/swatch/index.ts";
import { Stack } from "../../layout/stack/index.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";
import { ColorPicker } from "../color-picker/index.ts";
import * as M from "./model.ts";
import type { ThemeEditorContext } from "./types.ts";

const ROLE_LABEL: Record<string, () => string> = {
  primary: () => t`Accent`, solid: () => t`Filled button`, onSolid: () => t`Text on fill`, special: () => t`Special`,
  bg: () => t`Page`, surface: () => t`Surface`, raised: () => t`Raised`, text: () => t`Text`, muted: () => t`Muted text`, border: () => t`Border`,
  success: () => t`Success`, warn: () => t`Warning`, danger: () => t`Danger`, info: () => t`Info`,
  "brand-orange": () => t`Excitement`, "brand-blue": () => t`Activity`, "brand-green": () => t`Friendship`, "brand-purple": () => t`Communication`,
};
const keyLabel = (k: M.ColorKey): string => ROLE_LABEL[k]?.() ?? t`Category ${k.slice(4)}`;
const GROUPS: readonly [() => string, readonly M.ColorKey[]][] = [
  [() => t`Accent`, ["primary", "solid", "onSolid", "special"]],
  [() => t`Surfaces`, ["bg", "surface", "raised"]],
  [() => t`Text and border`, ["text", "muted", "border"]],
  [() => t`Status`, ["success", "warn", "danger", "info"]],
  [() => t`HADİ brand colors`, M.BRAND_ROLES],
  [() => t`Categorical palette`, ["cat-1", "cat-2", "cat-3", "cat-4", "cat-5", "cat-6", "cat-7", "cat-8"]],
];
const CHECK_LABEL: Record<string, () => string> = {
  "Body text on the page": () => t`Body text on the page`, "Body text on cards": () => t`Body text on cards`, "Secondary text": () => t`Secondary text`,
  "Text in menus and dialogs": () => t`Text in menus and dialogs`, "Text on filled buttons": () => t`Text on filled buttons`, "Accent, focus ring": () => t`Accent, focus ring`,
  "Success indicator": () => t`Success indicator`, "Warning indicator": () => t`Warning indicator`, "Danger indicator": () => t`Danger indicator`, "Info indicator": () => t`Info indicator`,
};

/** The colors tab. */
export function ColorsPanel({ ctx }: { ctx: ThemeEditorContext }): Element {
  const { draft, mode, change } = ctx;
  const ro = ctx.readonly;
  const selected = signal<M.ColorKey>("primary");
  const colorNow = (): string => M.colorOf(draft()[mode()], selected());
  const setColor = (k: M.ColorKey, v: string, merge = true): void => {
    const m = untrack(mode);
    change(t`Color: ${keyLabel(k)}`, (d) => ({ ...d, [m]: M.withColor(d[m], k, v) }), merge ? `color:${m}:${k}` : undefined);
  };
  const audit = computed(() => M.contrastAudit(draft()[mode()]));
  const fix = (c: M.ContrastCheck): void => { if (c.fix) setColor(c.fix.key, c.fix.color, false); };
  const fixAll = (): void => {
    const m = untrack(mode);
    change(t`Fix contrast`, (d) => {
      let c = d[m];
      for (let i = 0; i < 3; i++) for (const x of M.contrastAudit(c)) if (x.fix) c = M.withColor(c, x.fix.key, x.fix.color);
      return { ...d, [m]: c };
    });
  };
  // a colour sample (an opaque theme colour: no checkerboard under it)
  const chip = (color: () => string, size: "md" | "lg" = "md"): Element => h(Swatch, { class: "m-te-chip", color, size, checker: false }) as Element;
  // a token: a selectable ListRow (sample, name, hex)
  const tokenButton = (k: M.ColorKey): Element => h(ListRow, {
    class: "m-te-token", size: "sm", overflow: "ellipsis", selected: () => selected() === k,
    "aria-label": () => `${keyLabel(k)}: ${M.colorOf(draft()[mode()], k)}`, onClick: () => selected.set(k),
    lead: chip(() => M.colorOf(draft()[mode()], k)), title: () => keyLabel(k), sub: h("code", { class: "m-te-token-hex" }, () => M.hex(M.colorOf(draft()[mode()], k))),
  }) as Element;
  const checkRow = (c: M.ContrastCheck): Element => {
    const vals = (): M.DraftColors => draft()[mode()];
    const sample = h(Swatch, { class: "m-te-sample", size: "md", checker: false, color: () => vals()[c.bg] }, "Aa") as HTMLElement;
    effect(() => setStyle(sample, { "--m-te-fg": vals()[c.fg] }));
    return h(ListRow, {
      as: "li", class: cx("m-te-check", c.ok ? "is-ok" : "is-bad"), size: "sm", overflow: "ellipsis", lead: sample,
      title: CHECK_LABEL[c.label]?.() ?? c.label, sub: `${keyLabel(c.fg)} / ${keyLabel(c.bg)}`,
      trail: [h("b", { class: "m-te-ratio" }, `${c.ratio.toFixed(2)}:1`), h(Badge, { tone: c.ok ? "success" : "danger" }, c.ok ? (c.min >= 4.5 ? "AA" : t`AA UI`) : t`Below ${c.min}:1`)],
      actions: c.fix ? h(Button, { size: "sm", variant: "ghost", disabled: ro, onClick: () => fix(c), "aria-label": t`Fix: ${CHECK_LABEL[c.label]?.() ?? c.label}` }, t`Fix`) : undefined,
    }) as Element;
  };
  const colorsPanel = (): Element => h("div", { class: "m-te-colors" },
    h(Stack, { direction: "row", wrap: true },
      h(Segmented, { "aria-label": t`Mode`, value: live(() => mode()), onChange: (v: M.DraftMode | null) => { if (v) mode.set(v); }, options: [{ value: "light", label: t`Light` }, { value: "dark", label: t`Dark` }] }),
      h(Button, { size: "sm", variant: "ghost", disabled: ro, onClick: () => { change(t`Dark from light`, (d) => ({ ...d, dark: M.deriveDark(d.light) })); mode.set("dark"); } }, t`Make dark from light`)),
    h("div", { class: "m-te-colors-grid" },
      h("div", { class: "m-te-groups" }, GROUPS.map(([label, keys]) => h("fieldset", { class: "m-te-group" }, h(SectionLabel, { as: "legend", size: "md", label }), h("div", { class: "m-te-tokens" }, keys.map(tokenButton))))),
      h("div", { class: "m-te-edit" },
        h("div", { class: "m-te-edit-head" }, chip(colorNow, "lg"),
          h("span", {}, h("strong", {}, () => keyLabel(selected())), h("code", {}, () => `--m-${selected() === "solid" ? "primary-solid" : selected() === "onSolid" ? "on-primary" : selected() === "raised" ? "surface-raised" : selected()}`))),
        h(ColorPicker, { alpha: false, recent: 6, readonly: live(() => ro()), value: live(() => colorNow()), onChange: (v: string) => setColor(untrack(selected), v) }),
        h("div", { class: "m-te-scale", role: "group", "aria-label": () => t`Tone scale of ${keyLabel(selected())}` },
          () => M.toneScale(colorNow()).map((s) => h("span", { class: "m-te-tone-cell" },
            h(Swatch, {
              class: "m-te-tone", color: s.color, shape: "square", checker: false, selected: () => M.hex(colorNow()) === s.color, label: t`Tone ${s.step}: ${s.color}`, disabled: ro,
              onClick: () => setColor(untrack(selected), s.color, false),
            }), h("span", { class: "m-te-tone-step", "aria-hidden": "true" }, String(s.step))))))),
    h(Card, {
      class: "m-te-audit", title: t`Contrast (WCAG)`,
      actions: [
        h("span", { class: "m-muted m-te-audit-sum", "aria-live": "polite" }, () => { const a = audit(); return t`${a.filter((x) => x.ok).length} of ${a.length} pass`; }),
        h(Button, { size: "sm", variant: "secondary", disabled: () => ro() || audit().every((x) => x.ok), onClick: fixAll }, t`Fix all`)],
    }, h("ul", { class: "m-te-checks" }, () => audit().map(checkRow))));
  return colorsPanel();
}
