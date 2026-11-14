// ThemeEditor export tab (its own chunk): defineTheme code, CSS and JSON to copy or download; import; a share link;
// the theme picker.
import { signal, computed } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { live } from "../../../forms/util.ts";
import { t } from "../../../core/i18n.ts";
import { later } from "../../../core/util.ts";
import { Segmented, Textarea, TextInput } from "../../../forms/inputs.ts";
import { Button } from "../../actions/button/index.ts";
import { CopyButton } from "../../actions/copy-button/index.ts";
import { Card } from "../../data/card/index.ts";
import { Stack } from "../../layout/stack/index.ts";
import { Alert } from "../../feedback/alert/index.ts";
import { CodeView } from "../../../ui/code-view.ts";
import { ThemeSwatch, colorThemes } from "../../../ui/theme.ts";
import { download } from "../../../icons/glyphs/download.ts";
import { upload } from "../../../icons/glyphs/upload.ts";
import { palette } from "../../../icons/glyphs/palette.ts";
import * as M from "./io.ts";
import { registerDraft } from "./runtime.ts";
import type { Ctx } from "./forms.ts";

// ------------------------------------------------------------------ export
type Format = "code" | "css" | "json";
const FILE: Record<Format, [string, string, string]> = { code: ["ts", "ts", "text/plain"], css: ["css", "css", "text/css"], json: ["json", "json", "application/json"] };
/** defineTheme code, CSS and JSON to copy or download; import; a share link; the theme picker. */
export function ExportPanel({ ctx }: Ctx): Element {
  const fmt = signal<Format>("code");
  const text = computed(() => { const d = ctx.draft(), f = fmt(); return f === "code" ? M.draftCode(d) : f === "css" ? M.draftCss(d) : M.draftJson(d); });
  const pasted = signal("");
  const error = signal<string | null>(null);
  const registered = signal(false);
  const link = computed(() => M.shareUrl(ctx.draft()));
  const save = (): void => {
    const [ext, , type] = FILE[fmt.peek()];
    const url = URL.createObjectURL(new Blob([text.peek()], { type }));
    const a = h("a", { href: url, download: `${ctx.draft.peek().id}.${ext}` }) as HTMLAnchorElement;
    a.click();
    later(() => URL.revokeObjectURL(url), 1000);
  };
  const doImport = (): void => {
    const d = M.importTheme(pasted.peek());
    if (!d) { error.set(t`Not a theme: paste ThemeEditor JSON, a defineTheme JSON, a theme stylesheet or a share link.`); return; }
    error.set(null);
    ctx.change(t`Import`, () => d);
    pasted.set("");
  };
  const register = (): void => { registerDraft(ctx.draft.peek()); registered.set(true); };
  return h("div", { class: "m-te-export" },
    h(Stack, { direction: "row", wrap: true },
      h(Segmented, { "aria-label": t`Output`, value: live(() => fmt()), onChange: (v: Format | null) => { if (v) fmt.set(v); }, options: [{ value: "code", label: "defineTheme" }, { value: "css", label: "CSS" }, { value: "json", label: "JSON" }] }),
      h(Button, { size: "sm", variant: "ghost", icon: download, onClick: save }, () => t`Download .${FILE[fmt()][0]}`)),
    h(CodeView, { class: "m-te-code", code: live(() => text()), lang: live(() => FILE[fmt()][1]), copy: true, label: () => t`Theme output` }),
    h(Card, { class: "m-te-box", title: t`Share link` },
      h("p", { class: "m-help m-te-hint" }, t`Opens this theme in a ThemeEditor; nothing is uploaded, the theme is in the link.`),
      h(Stack, { direction: "row", class: "m-te-link" }, h(TextInput, { readonly: true, "aria-label": t`Share link`, value: live(() => link()) }), h(CopyButton, { text: () => link(), label: t`Copy link` }))),
    h(Card, { class: "m-te-box", title: t`Import` },
      h(Textarea, { rows: 4, autosize: false, "aria-label": t`Theme to import`, placeholder: t`Paste JSON, CSS or a share link`, readonly: live(() => ctx.readonly()), value: live(() => pasted()), onChange: (v: string) => { pasted.set(v); error.set(null); } }),
      () => (error() ? h(Alert, { class: "m-te-error", tone: "danger" }, error()) : null),
      h(Button, { size: "sm", variant: "secondary", icon: upload, disabled: () => !pasted().trim() || ctx.readonly(), onClick: doImport }, t`Import`)),
    h(Card, { class: "m-te-box", title: t`Theme picker` },
      h("p", { class: "m-help m-te-hint" }, t`registerThemes adds the theme to ThemePicker and ThemeMenu; here it runs from the draft, in an app from its stylesheet.`),
      h(Stack, { direction: "row", wrap: true },
        h(Button, { size: "sm", variant: "secondary", icon: palette, onClick: register }, () => (registered() ? t`Update in the theme picker` : t`Add to the theme picker`)),
        () => (registered() ? h("span", { class: "m-te-picked", "aria-live": "polite" }, h(ThemeSwatch, { id: ctx.draft().id }), t`In the picker: ${colorThemes().length} themes`) : null))));
}
