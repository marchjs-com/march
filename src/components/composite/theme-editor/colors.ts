// ThemeEditor colors tab (its own chunk): every color token of the edited mode, a ColorPicker and tone scale for the
// selected one, a dark mode made from the light one and the WCAG contrast audit with fixes.
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, uid, setStyle } from "../../../core/util.ts";
import { Segmented } from "../../../forms/inputs.ts";
import { Button } from "../../../ui/button.ts";
import { Badge } from "../../../ui/badge.ts";
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
  const id = uid("hm-te-c");
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
  const chip = (color: () => string, cls = "hm-te-chip"): Element => { const el = h("span", { class: cls, "aria-hidden": "true" }) as HTMLElement; effect(() => setStyle(el, { "--hm-te-c": color() })); return el; };
  const tokenButton = (k: M.ColorKey): Element => h("button", {
    type: "button", class: () => cx("hm-te-token", selected() === k && "is-selected"), "aria-pressed": () => String(selected() === k),
    "aria-label": () => `${keyLabel(k)}: ${M.colorOf(draft()[mode()], k)}`, onClick: () => selected.set(k),
  }, chip(() => M.colorOf(draft()[mode()], k)), h("span", { class: "hm-te-token-name" }, () => keyLabel(k)), h("code", { class: "hm-te-token-hex" }, () => M.hex(M.colorOf(draft()[mode()], k))));
  const checkRow = (c: M.ContrastCheck): Element => {
    const sample = h("span", { class: "hm-te-sample", "aria-hidden": "true" }, "Aa") as HTMLElement;
    const vals = (): M.DraftColors => draft()[mode()];
    effect(() => setStyle(sample, { "--hm-te-fg": vals()[c.fg], "--hm-te-bg": vals()[c.bg] }));
    return h("li", { class: cx("hm-te-check", c.ok ? "is-ok" : "is-bad") }, sample,
      h("span", { class: "hm-te-check-text" }, h("span", {}, CHECK_LABEL[c.label]?.() ?? c.label), h("small", { class: "hm-muted" }, `${keyLabel(c.fg)} / ${keyLabel(c.bg)}`)),
      h("b", { class: "hm-te-ratio" }, `${c.ratio.toFixed(2)}:1`),
      h(Badge, { tone: c.ok ? "success" : "danger" }, c.ok ? (c.min >= 4.5 ? "AA" : t`AA UI`) : t`Below ${c.min}:1`),
      c.fix ? h(Button, { size: "sm", variant: "ghost", disabled: ro, onClick: () => fix(c), "aria-label": t`Fix: ${CHECK_LABEL[c.label]?.() ?? c.label}` }, t`Fix`) : null);
  };
  const colorsPanel = (): Element => h("div", { class: "hm-te-colors" },
    h("div", { class: "hm-te-row" },
      h(Segmented, { "aria-label": t`Mode`, get value() { return mode(); }, onChange: (v: M.DraftMode | null) => { if (v) mode.set(v); }, options: [{ value: "light", label: t`Light` }, { value: "dark", label: t`Dark` }] }),
      h(Button, { size: "sm", variant: "ghost", disabled: ro, onClick: () => { change(t`Dark from light`, (d) => ({ ...d, dark: M.deriveDark(d.light) })); mode.set("dark"); } }, t`Make dark from light`)),
    h("div", { class: "hm-te-colors-grid" },
      h("div", { class: "hm-te-groups" }, GROUPS.map(([label, keys]) => h("fieldset", { class: "hm-te-group" }, h("legend", {}, label), h("div", { class: "hm-te-tokens" }, keys.map(tokenButton))))),
      h("div", { class: "hm-te-edit" },
        h("div", { class: "hm-te-edit-head" }, chip(colorNow, "hm-te-chip hm-te-chip-lg"),
          h("span", {}, h("strong", {}, () => keyLabel(selected())), h("code", {}, () => `--hm-${selected() === "solid" ? "primary-solid" : selected() === "onSolid" ? "on-primary" : selected() === "raised" ? "surface-raised" : selected()}`))),
        h(ColorPicker, { alpha: false, recent: 6, get readonly() { return ro(); }, get value() { return colorNow(); }, onChange: (v: string) => setColor(untrack(selected), v) }),
        h("div", { class: "hm-te-scale", role: "group", "aria-label": () => t`Tone scale of ${keyLabel(selected())}` },
          () => M.toneScale(colorNow()).map((s) => h("button", {
            type: "button", class: () => cx("hm-te-tone", M.hex(colorNow()) === s.color && "is-current"), "aria-label": t`Tone ${s.step}: ${s.color}`, disabled: ro,
            onClick: () => setColor(untrack(selected), s.color, false),
          }, chip(() => s.color, "hm-te-tone-chip"), h("span", {}, String(s.step))))))),
    h("section", { class: "hm-te-audit", "aria-labelledby": `${id}-audit` },
      h("div", { class: "hm-te-row" },
        h("h4", { id: `${id}-audit`, class: "hm-te-h" }, t`Contrast (WCAG)`),
        h("span", { class: "hm-muted hm-te-audit-sum", "aria-live": "polite" }, () => { const a = audit(); return t`${a.filter((x) => x.ok).length} of ${a.length} pass`; }),
        h(Button, { size: "sm", variant: "secondary", disabled: () => ro() || audit().every((x) => x.ok), onClick: fixAll }, t`Fix all`)),
      h("ul", { class: "hm-te-checks" }, () => audit().map(checkRow))));
  return colorsPanel();
}
