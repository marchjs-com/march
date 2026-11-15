// Type tests: extensions. defineExtension keeps its props' types; ExtensionProps / ComponentExtensions add props to
// the JSX types of every component / one March component; intercept's props / on / render are typed.
/// <reference path="../types/jsx.d.ts" />
import { defineExtension, extend, intercept, withExtensions, type ExtensionPropsOf } from "march";
import { Button } from "march/ui";

const track = defineExtension<{ track: string }>({
  name: "track",
  props: { track: { type: "string", doc: "Analytics event sent on click" } },
  setup({ props, roots, onCleanup }) {
    const event: string = props.track;
    for (const el of roots()) { const f = () => event; el.addEventListener("click", f); onCleanup(() => el.removeEventListener("click", f)); }
  },
});
const off: () => void = extend([Button], track);
off();
extend("*", track);
// @ts-expect-error — a spec for a prop the extension does not have
defineExtension<{ track: string }>({ name: "x", props: { nope: {} } });

declare module "march" {
  interface ExtensionProps extends ExtensionPropsOf<typeof track> {}
  interface ComponentExtensions { Button: { confirm?: boolean } }
}
function Hello(props: { name: string }) { return <b>{props.name}</b>; }
export const ok1 = <Hello name="a" track="hello" />;
export const ok2 = <Button track="save" confirm>Save</Button>;
// @ts-expect-error — an extension prop keeps its type
export const bad1 = <Hello name="a" track={1} />;
// @ts-expect-error — confirm is added to Button only
export const bad2 = <Hello name="a" confirm />;
// @ts-expect-error — unknown props are still errors
export const bad3 = <Hello name="a" nope />;
export const opt = <Hello name="a" m:extend={false} />;
export const opt2 = <Hello name="a" m:extend={["track"]} />;

intercept(Button, {
  name: "small",
  props: (p) => ({ size: p["size"] ?? "sm" }),
  on: { onClick: (next, e) => next(e) },
  render: (next, p) => next(p),
});
// @ts-expect-error — intercept takes named components
intercept("*", { name: "x" });
export const scoped = withExtensions([track, [Button, track]], () => <Hello name="a" />);
