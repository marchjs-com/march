// MultiSelect: several values picked as chips; a Combobox with `multiple` (static options or async search).
import "./multi-select.css";
import { extend, cx } from "../../../forms/util.ts";
import { Combobox, type ComboboxProps } from "../combobox/index.ts";

export interface MultiSelectProps<T = unknown> extends ComboboxProps<T> {}

/** Multiple choice with chips; same props as Combobox (static options or async search). Value: array. */
export const MultiSelect = <T = unknown>(props: MultiSelectProps<T>): unknown => Combobox(extend(props, { multiple: () => true, class: () => cx("hm-multiselect", props.class as string) }));
