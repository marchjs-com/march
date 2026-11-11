// Schema field type → input component. `inputFor(field)` picks `field.control` (a component or a registered name) or
// the component registered for `field.type`. Add your own with `registerInput("iban", IbanInput)`.
import { TextInput, Textarea, PasswordInput, EmailInput, UrlInput, PhoneInput, NumberInput, MoneyInput, PercentInput, Select, Checkbox, Switch,
  CheckboxGroup, RadioGroup, Segmented, Slider, ColorInput, CodeInput } from "./inputs.js";
import { Combobox, MultiSelect } from "./pickers.js";
import { DatePicker, TimeInput, DateTimeInput, DateRangePicker } from "./date.js";
import { ListEditor, KeyValueEditor, JsonEditor, MarkdownEditor } from "./editors.js";
import { FileUpload } from "./file.js";
import { extend } from "./util.js";

/** Whole numbers: NumberInput with 0 decimals. */
export const IntInput = (props) => NumberInput(extend(props, { decimals: () => props.decimals ?? 0 }));

const registry = new Map(Object.entries({
  text: TextInput, textarea: Textarea, password: PasswordInput, email: EmailInput, url: UrlInput, phone: PhoneInput,
  number: NumberInput, int: IntInput, money: MoneyInput, percent: PercentInput, bool: Checkbox, switch: Switch,
  date: DatePicker, datetime: DateTimeInput, time: TimeInput, daterange: DateRangePicker,
  pick: Select, select: Select, radio: RadioGroup, segmented: Segmented, combobox: Combobox,
  multi: MultiSelect, checkboxes: CheckboxGroup, list: ListEditor, keyvalue: KeyValueEditor, json: JsonEditor, markdown: MarkdownEditor,
  color: ColorInput, file: FileUpload, code: CodeInput, slider: Slider, hidden: null,
}));

/** Controls that render several focusable parts: their <Field> label is not a <label for>. */
export const GROUP_CONTROLS = new Set([CheckboxGroup, RadioGroup, Segmented, CodeInput, ListEditor, KeyValueEditor, DateRangePicker]);
/** Controls that render their own label next to the box. */
export const INLINE_LABEL = new Set([Checkbox, Switch]);

/** Register (or replace) the input used for a field type or `control` name. */
export function registerInput(type, Component) { registry.set(type, Component); }

/** The component for a schema field (null for hidden fields). */
export function inputFor(field) {
  if (typeof field.control === "function") return field.control;
  const key = field.control ?? field.type;
  return registry.has(key) ? registry.get(key) : TextInput;
}
