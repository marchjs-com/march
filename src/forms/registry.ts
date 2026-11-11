// Schema field type → input component. `inputFor(field)` picks `field.control` (a component or a registered name) or
// the component registered for `field.type`. Add your own with `registerInput("iban", IbanInput)`.
import { TextInput, Textarea, PasswordInput, EmailInput, UrlInput, PhoneInput, NumberInput, MoneyInput, PercentInput, Select, Checkbox, Toggle,
  CheckboxGroup, RadioGroup, Segmented, Slider, ColorInput, CodeInput, type NumberInputProps } from "./inputs.ts";
import { Combobox, MultiSelect } from "./pickers.ts";
import { DatePicker, TimeInput, DateTimeInput, DateRangePicker } from "./date.ts";
import { ListEditor, KeyValueEditor, JsonEditor, MarkdownEditor } from "./editors.ts";
import { FileUpload } from "./file.ts";
import { extend } from "./util.ts";
import type { FieldSpec } from "../schema/index.ts";

/**
 * An input component usable for a schema field: called with the control props (`value`, `setValue`, `onBlur`, `id`, …
 * plus the field's options). Any component taking an object of props fits.
 */
export type InputComponent = { bivarianceHack(props: Record<string, unknown>): unknown }["bivarianceHack"];

/** Whole numbers: NumberInput with 0 decimals. */
export const IntInput = (props: NumberInputProps): unknown => NumberInput(extend(props, { decimals: () => props.decimals ?? 0 }));

const registry = new Map<string, InputComponent | null>(Object.entries({
  text: TextInput, textarea: Textarea, password: PasswordInput, email: EmailInput, url: UrlInput, phone: PhoneInput,
  number: NumberInput, int: IntInput, money: MoneyInput, percent: PercentInput, bool: Checkbox, switch: Toggle,
  date: DatePicker, datetime: DateTimeInput, time: TimeInput, daterange: DateRangePicker,
  pick: Select, select: Select, radio: RadioGroup, segmented: Segmented, combobox: Combobox,
  multi: MultiSelect, checkboxes: CheckboxGroup, list: ListEditor, keyvalue: KeyValueEditor, json: JsonEditor, markdown: MarkdownEditor,
  color: ColorInput, file: FileUpload, code: CodeInput, slider: Slider, hidden: null,
} as Record<string, InputComponent | null>));

/** Controls that render several focusable parts: their <Field> label is not a <label for>. */
export const GROUP_CONTROLS: Set<InputComponent> = new Set<InputComponent>([CheckboxGroup, RadioGroup, Segmented, CodeInput, ListEditor, KeyValueEditor, DateRangePicker]);
/** Controls that render their own label next to the box. */
export const INLINE_LABEL: Set<InputComponent> = new Set<InputComponent>([Checkbox, Toggle]);

/** Register (or replace) the input used for a field type or `control` name. */
export function registerInput(type: string, Component: InputComponent | null): void { registry.set(type, Component); }

/** The component for a schema field (null for hidden fields). */
export function inputFor(field: FieldSpec): InputComponent | null {
  if (typeof field.control === "function") return field.control as InputComponent;
  const key = (field.control ?? field.type) as string;
  return registry.has(key) ? (registry.get(key) as InputComponent | null) : TextInput;
}
