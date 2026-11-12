// Showcase stage for ThemeMenu: the menu button as it would sit in a top bar; the choices change the whole showcase.
import { ThemeMenu } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<ThemeMenu />
<ThemeMenu themes={false} accents={["primary", "brand-orange", "brand-blue", "brand-green", "brand-purple"]} />`

const BRAND: ColorToken[] = ["primary", "brand-orange", "brand-blue", "brand-green", "brand-purple"]

export default function ThemeMenuDemo(props: { values: { themes: boolean; accents: string } }) {
  return <div class="sc-row">{() => <ThemeMenu label="Görünüm" placement="bottom-start" themes={props.values.themes}
    accents={props.values.accents === "none" ? false : props.values.accents === "brand" ? BRAND : undefined} />}
    <span class="hm-muted">Seçim bütün vitrine uygulanır</span></div>
}
