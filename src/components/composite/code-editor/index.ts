// CodeEditor (march/ui): a small code field: the text is coloured as it is typed (the CodeView colours, so
// unfinished code too), a suggestion list opens at the caret (you supply `complete`; `jsxCompleter` is the ready one
// for a JSX tag: prop names, then values inside quotes), ranges can be marked (a short flash, an error underline) and
// a foot line says what the owner thinks of the code. It does not run or compile anything: the owner reads `value`.
// Built from EditorFrame (border, focus ring, foot bar), Popover + OptionList (the suggestions; the keys stay in the
// text), CopyButton (icon only), Dropdown (the shortcuts menu), Kbd and StatusDot. The keys are an IDE's: Tab indents,
// Shift+Tab outdents, Enter keeps the indent, Ctrl+/ comments, Alt+arrows move lines, Ctrl+S saves (onSave)…
import "../../typography/code-view/code-view.css"; // the token colours (.m-tok-*)
import "./code-editor.css";
import { signal, computed, effect, untrack, batch, onCleanup, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { uid } from "../../../core/util.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { model, syncValue, type ControlProps } from "../../../forms/util.ts";
import { tokenize, type Token } from "../../../ui/highlight.ts";
import { scanBrackets, bracketAt, wordAt, occurrences, findAll, pairAction, pairAround, tagToClose, fitPaste, applyEdits, PAIRS, headEdit, tagPair } from "./assist.ts";
import { findBar, type FindState, type FindMode } from "./find.ts";
import { createHistory } from "./history.ts";
import { TextInput } from "../../forms/text-input/index.ts";
import { virtualAnchor } from "../../../ui/popover.ts";
import { Popover } from "../../overlays/popover/index.ts";
import { animate } from "../../../motion/animate.ts";
import { measure } from "../../../motion/engine/clock.ts";
import { EditorFrame } from "../editor-frame/index.ts";
import { OptionList } from "../../forms/option-list/index.ts";
import { CopyButton } from "../../actions/copy-button/index.ts";
import { Kbd } from "../../typography/kbd/index.ts";
import { Chip } from "../../actions/chip/index.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import { Dropdown } from "../../actions/menu/index.ts";
import { command as commandIcon } from "../../../icons/glyphs/command.ts";
import { xCircle } from "../../../icons/glyphs/xCircle.ts";
import { alertTriangle } from "../../../icons/glyphs/alertTriangle.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { withColor } from "../../../theme/colors.ts";

export { jsxCompleter, type JsxProp } from "./jsx.ts";

messages("tr", {
  "Code": "Kod", "Suggestions": "Öneriler", "suggestions": "öneriler", "Copy": "Kopyala", "Suggestion source": "Önerilerin kaynağı", "Suggestion group": "Öneri grubu", "No suggestions here": "Bu kaynakta öneri yok", "Quick fixes": "Hızlı düzeltmeler", "Quick fix": "Hızlı düzeltme", "No quick fixes here": "Burada hızlı düzeltme yok", "No references here": "Burada kullanım yok", "References": "Kullanımlar", "{n} references": "{n} kullanım", "written": "yazılıyor", "Find all references": "Tüm kullanımlar",
  "Keyboard shortcuts": "Klavye kısayolları", "Editor": "Editör", "Indent (or take the suggestion)": "Girinti (ya da öneriyi al)", "Outdent": "Girintiyi azalt",
  "New line, keeping the indent": "Yeni satır, girinti korunur", "Comment / uncomment lines": "Satırları yorum yap / aç", "Move lines up": "Satırları yukarı taşı",
  "Move lines down": "Satırları aşağı taşı", "Copy lines up": "Satırları yukarı kopyala", "Copy lines down": "Satırları aşağı kopyala", "Delete lines": "Satırları sil",
  "Suggestions list": "Öneri listesi", "Save": "Kaydet", "Leave the editor": "Editörden çık", "Toggle a breakpoint": "Kesme noktası koy / kaldır",
  "Undo / redo": "Geri al / yinele",
  "Find": "Bul", "Replace": "Değiştir", "Replace with": "Yerine yazılacak", "All": "Tümü", "Replace (Enter)": "Değiştir (Enter)", "Replace all (Ctrl+Enter)": "Tümünü değiştir (Ctrl+Enter)",
  "Match case (Alt+C)": "Büyük/küçük harf (Alt+C)", "Whole word (Alt+W)": "Tam kelime (Alt+W)", "Regular expression (Alt+R)": "Düzenli ifade (Alt+R)",
  "Previous match (Shift+Enter)": "Önceki (Shift+Enter)", "Next match (Enter)": "Sonraki (Enter)", "Close (Esc)": "Kapat (Esc)", "No results": "Sonuç yok",
  "Go to line": "Satıra git", "Line (or line:column)": "Satır (ya da satır:sütun)", "Find / replace": "Bul / değiştir", "Next / previous match": "Sonraki / önceki eşleşme",
  "Go to definition": "Tanıma git", "Rename symbol": "Adı her yerde değiştir", "Format document": "Belgeyi biçimlendir", "Text size": "Yazı boyutu",
  "No definition found": "Tanım bulunamadı", "This can't be renamed": "Bu ad değiştirilemez", "Already formatted": "Zaten biçimli", "Formatted": "Biçimlendirildi",
  "New name": "Yeni ad", "Enter: rename, Esc: cancel": "Enter: değiştir, Esc: vazgeç", "{0} places": "{0} yerde",
  "Bigger / smaller / default text": "Yazıyı büyüt / küçült / varsayılan",
});

/** One row of the suggestion list. */
export interface CodeSuggestion {
  /** What the row shows (and what is inserted when `insert` is not given). */
  label: string;
  /** A short note beside it: the type, what it does. */
  hint?: string;
  /** The text that replaces the word being written (default: `label`). */
  insert?: string;
  /** Move the caret back this many characters after the insert (into the quotes of `variant=""`). */
  back?: number;
  /** Ask for suggestions again right after the insert (the values of the prop just written). */
  again?: boolean;
  /** Where the row comes from ("march", "ts", "js"…): the `sources` chips under the list filter by it. */
  source?: string;
  /** A line written at the top of the text with the pick, when the text does not have it yet (the row's import). */
  head?: string;
  /** A heading the row is listed under ("Methods", "Properties"); rows of a group follow one another. */
  group?: string;
  /** Its definition, shown under the list while the row is picked out (else `describe` is asked). */
  doc?: CodeDoc;
  /**
   * Rows with a higher priority come first, before the source and the fit (a row of the type the place expects: true
   * and false after `const ok: boolean =`). With nothing typed yet, rows with a priority open the list by themselves.
   */
  priority?: number;
}
/** A row's definition, shown under the list for the row picked out: its kind, its signature, what it does. */
export interface CodeDoc {
  kind?: string | undefined; signature?: string | undefined; doc?: string | undefined;
  /** Its parts under the text (a component's props: name and type, then what it does), one row each. */
  list?: readonly { label: string; doc?: string | undefined }[] | undefined;
}
/** A parameter of a signature: its text ("data: any[]") and what it is. */
export interface CodeParam { label: string; doc?: string | undefined }
/**
 * Inside a call's parentheses: the signatures (overloads) — `prefix` ("table(" with the name), the parameters joined by
 * `separator`, `suffix` ("): void") — the one that fits (`active`), the argument the caret is at (`arg`) and where the
 * call's arguments start (`start`).
 */
export interface CodeSignature {
  items: readonly { prefix: string; params: readonly CodeParam[]; separator: string; suffix: string; doc?: string | undefined }[];
  active: number; arg: number; start: number;
}
/** A chip under the suggestion list: rows whose `source` is `value` ("all": every row). */
export interface CodeSource { value: string; label: string }
/** What `complete` returns: the rows and the range of the text they replace. */
export interface CodeCompletion {
  from: number; to?: number; items: readonly CodeSuggestion[];
  /** Every row, whatever source chip is chosen (and no chips): a member list. */
  all?: boolean;
  /** Where the caret is, as a language service sees it: in code, a string, a comment or the text between tags. */
  where?: "code" | "string" | "comment" | "text";
  /** The list opens at once (after a space, in an empty value) and stays open while the word is typed, narrowing as
   * it goes (a tag's props, a prop's values), also with suggest="ghost". */
  open?: boolean;
}
/** Where the caret is when suggestions are asked for. */
export interface CodeCompleteContext {
  value: string;
  caret: number;
  /** The text before the caret. */
  before: string;
  /** Asked by Ctrl + Space (or after a pick with `again`): suggest even with nothing typed. */
  forced: boolean;
  /** The character just typed ("" when asked by a key). */
  typed: string;
}
/** A marked range of the text: "flash" lights up once, "error" and "warning" stay underlined (red, amber). */
export interface CodeMark { from: number; to: number; kind?: "flash" | "error" | "warning"; /** Shown as the mark's tooltip (the problem). */ title?: string }
/**
 * A mark in the gutter beside a line's number (1-based): its `kind` becomes a class (`is-<kind>`). Drawn ones:
 * "breakpoint" (a red dot), "conditional" (amber), "log" (a diamond), "off" (a hollow dot); any other kind is yours to style.
 */
export interface CodeLineMark { line: number; kind?: string; /** The mark's tooltip. */ title?: string }
/** The lit line (a debugger's paused line): its number and kind (class `is-<kind>`, default "current"). */
export interface CodeActiveLine { line: number; kind?: string }
/** A row of the shortcuts menu: the keys ("Ctrl+S", "Alt+↑") and what they do. */
export interface CodeShortcut { keys: string; label: MaybeFn<string>; group?: MaybeFn<string | undefined> }
/** The editor's own keys (each can be turned off with `keys={{ comment: false }}`). */
export type CodeCommand = "indent" | "outdent" | "newline" | "comment" | "moveUp" | "moveDown" | "copyUp" | "copyDown" | "deleteLine" | "suggest" | "save" | "release"
  | "find" | "replace" | "goToLine" | "definition" | "rename" | "format" | "zoom" | "undo";
/** A range of the text. */
export interface CodeRange { from: number; to: number }
/** An edit of the text: [from, to) becomes `text` (places in the text before any edit). */
export interface CodeEdit { from: number; to: number; text: string }
/** A quick fix (Ctrl+.): what it does and its edits. */
export interface CodeFix { title: string; edits: readonly CodeEdit[] }
/** What `rename` answers: the name's range at the caret and every place it is written (or why it cannot be renamed). */
export type CodeRename = { from: number; to: number; locations: readonly CodeRange[] } | { error: string };
type Maybe<T> = T | null | undefined | Promise<T | null | undefined>;

export interface CodeEditorProps extends ControlProps<string> {
  /** Colours: js / ts / jsx / tsx (default "tsx"), css, html, json, sh; "" for none. @tr Renklendirme: js / ts / jsx / tsx (varsayılan "tsx"), css, html, json, sh; hiçbiri için "". */
  lang?: string | undefined;
  /** Suggestions for the caret's place: called after typing and on Ctrl + Space; null / no items: no list. A promise
   * (a language service in a worker) opens the list when it resolves, if the text and the caret did not move.
   * @tr İmlecin yeri için öneriler: yazdıktan sonra ve Ctrl + Space ile çağrılır; null / öğe yok: liste yok. Bir promise (worker'daki dil servisi) çözülünce, metin ve imleç kımıldamadıysa listeyi açar. */
  complete?: ((ctx: CodeCompleteContext) => CodeCompletion | null | undefined | Promise<CodeCompletion | null | undefined>) | undefined;
  /** The definition of the row picked out in the list (its kind, signature, documentation), shown under the list. @tr Listede seçili satırın tanımı (türü, imzası, belgesi), listenin altında gösterilir. */
  describe?: ((item: CodeSuggestion, ctx: { value: string; at: number }) => CodeDoc | null | undefined | Promise<CodeDoc | null | undefined>) | undefined;
  /**
   * Inside a call's parentheses: its signature over the caret, the parameter being written lit, with its documentation.
   * Asked when "(" or "," is typed and while the caret moves inside the call; ")" or Escape closes it.
   * @tr Bir çağrının parantezleri içinde: imleç üstünde imzası, yazılan parametre vurgulu ve belgesiyle. "(" ya da "," yazılınca ve imleç çağrı içinde kımıldarken sorulur; ")" ya da Escape kapatır.
   */
  signature?: ((ctx: { value: string; caret: number }) => CodeSignature | null | undefined | Promise<CodeSignature | null | undefined>) | undefined;
  /** Marked ranges (reactive). @tr İşaretli aralıklar (reaktif). */
  marks?: MaybeFn<readonly CodeMark[] | undefined>;
  /** The foot line: what the owner says about the code (a text or a node; reactive). `false`: no foot bar. @tr Alt satır: sahibinin kod hakkında söylediği (metin ya da düğüm; reaktif). `false`: alt çubuk yok. */
  message?: MaybeFn<unknown>;
  /** Pressing the foot line's message (it becomes a button): e.g. open the list of problems. @tr Alt satırdaki mesaja basınca (mesaj düğme olur): ör. sorunlar listesini aç. */
  onMessage?: (() => void) | undefined;
  /**
   * Put the caret (or a selection) there, focused and in view: a new object each time (`{ from, to? }`, the text's
   * offsets). @tr İmleci (ya da seçimi) oraya koy, odaklı ve görünür: her seferinde yeni bir nesne (`{ from, to? }`, metnin konumları).
   */
  goTo?: MaybeFn<{ from: number; to?: number | undefined } | null | undefined>;
  /** The dot before the message: "ok" (default) or "error". `false`: no dot. @tr Mesajdan önceki nokta: "ok" (varsayılan) ya da "error". `false`: nokta yok. */
  status?: MaybeFn<"ok" | "error" | false | undefined>;
  /** Your own node at the end of the foot line, before the shortcuts and copy buttons (default none). @tr Alt satırın sonunda, kısayol ve kopyala düğmelerinden önce kendi düğümün (varsayılan yok). */
  hint?: unknown;
  /**
   * The editor's keys, as in an IDE: Tab / Shift+Tab indent and outdent (the lines of a selection too), Enter keeps the
   * indent (one more after `{ ( [`), Ctrl+/ comments lines, Alt+↑ / ↓ move them, Shift+Alt+↑ / ↓ copy them,
   * Ctrl+Shift+K deletes them, Ctrl+Space suggests, Ctrl+S saves (`onSave`), Esc then Tab leaves the editor. `false`:
   * none (Tab moves the focus); `{ comment: false, … }` turns single ones off.
   * @tr IDE'deki gibi düzenleyici tuşları: Tab / Shift+Tab girinti ekler ve azaltır (seçimin satırlarında da), Enter girintiyi korur (`{ ( [` sonrası bir fazla), Ctrl+/ satırları yorum yapar, Alt+↑ / ↓ taşır, Shift+Alt+↑ / ↓ kopyalar, Ctrl+Shift+K siler, Ctrl+Space önerir, Ctrl+S kaydeder (`onSave`), Esc ardından Tab düzenleyiciden çıkar. `false`: hiçbiri (Tab odağı taşır); `{ comment: false, … }` tek tek kapatır.
   */
  keys?: false | Partial<Record<CodeCommand, boolean>> | undefined;
  /** Spaces of one indent (default 2). @tr Bir girintinin boşluk sayısı (varsayılan 2). */
  tabSize?: number | undefined;
  /** Ctrl+S (⌘S): the owner saves (the browser's own "save page" does not open). @tr Ctrl+S (⌘S): sahibi kaydeder (tarayıcının kendi "sayfayı kaydet" penceresi açılmaz). */
  onSave?: ((value: string) => void) | undefined;
  /** The shortcuts button in the foot line: a menu of every key (default true). @tr Alt satırdaki kısayollar düğmesi: her tuşun menüsü (varsayılan true). */
  shortcuts?: boolean | undefined;
  /** More rows for the shortcuts menu: the app's keys (a debugger's F5…), shown under the editor's. @tr Kısayollar menüsüne ek satırlar: uygulamanın tuşları (hata ayıklayıcının F5'i…), düzenleyicininkilerin altında. */
  moreShortcuts?: MaybeFn<readonly CodeShortcut[] | undefined>;
  /** Name of the shortcuts button and its menu (default "Keyboard shortcuts", translated). @tr Kısayollar düğmesinin ve menüsünün adı (varsayılan "Keyboard shortcuts", çevrilir). */
  shortcutsLabel?: MaybeFn<string> | undefined;
  /** The copy button (default true). @tr Kopyala düğmesi (varsayılan true). */
  copy?: boolean | undefined;
  /** Text of the copy button (default "Copy", translated). @tr Kopyala düğmesinin metni (varsayılan "Copy", çevrilir). */
  copyLabel?: MaybeFn<string> | undefined;
  /** Accessible name of the text field (default "Code", translated). @tr Metin alanının erişilebilir adı (varsayılan "Code", çevrilir). */
  label?: MaybeFn<string | undefined>;
  /** Accessible name of the suggestion list (default "Suggestions", translated). @tr Öneri listesinin erişilebilir adı (varsayılan "Suggestions", çevrilir). */
  suggestionsLabel?: MaybeFn<string | undefined>;
  /**
   * Chips under the suggestion list that filter the rows by their `source`: `[{ value: "march", label: "March" },
   * { value: "all", label: "All" }]`. None (default): no chips, every row shows.
   * @tr Öneri listesinin altında satırları `source` değerine göre süzen çipler: `[{ value: "march", label: "March" }, { value: "all", label: "All" }]`. Yoksa (varsayılan): çip yok, her satır görünür.
   */
  sources?: readonly CodeSource[] | undefined;
  /**
   * How suggestions come while typing: "list" (default: the list opens) or "ghost" (the likeliest row is written
   * faintly after the caret, a match of the same case first; Tab takes it). Ctrl + Space opens the list either way.
   * @tr Yazarken önerilerin gelişi: "list" (varsayılan: liste açılır) ya da "ghost" (en olası satır imleçten sonra soluk yazılır, önce aynı büyüklük harfli eşleşme; Tab alır). Ctrl + Space her iki durumda listeyi açar.
   */
  suggest?: "list" | "ghost" | undefined;
  /** Characters that open the list even with suggest="ghost" (default "."): `console.` lists its members. @tr suggest="ghost" iken bile listeyi açan karakterler (varsayılan "."): `console.` üyelerini listeler. */
  listOn?: string | undefined;
  /** With suggest="ghost": the list opens too once the word is this long (default 2); 0: only with Ctrl+Space or `listOn`. @tr suggest="ghost" iken kelime bu uzunluğa varınca liste de açılır (varsayılan 2); 0: yalnız Ctrl+Space ya da `listOn` ile. */
  listAfter?: number | undefined;
  /** The chosen chip (default: the first); `onSourceChange` tells the owner (to keep it). @tr Seçili çip (varsayılan: ilki); `onSourceChange` sahibine bildirir (tutması için). */
  source?: MaybeFn<string | undefined>;
  /** Called with the chip a person picked. @tr Seçilen çiple çağrılır. */
  onSourceChange?: ((value: string) => void) | undefined;
  /** Enter writes a new line (default true); false: one line of code, Enter does nothing. @tr Enter yeni satır yazar (varsayılan true); false: tek satır kod, Enter bir şey yapmaz. */
  multiline?: boolean | undefined;
  /** How a "flash" mark shows: "glow" (default) or "none" / false. @tr "flash" işaretinin görünüşü: "glow" (varsayılan) ya da "none" / false. */
  flash?: "glow" | "none" | false | undefined;
  /** Called when focus leaves the editor (the owner may tidy the code). @tr Odak düzenleyiciden çıkınca çağrılır (sahibi kodu düzenleyebilir). */
  onBlur?: ((e: FocusEvent) => void) | undefined;
  /** The textarea (to focus it, to read the selection). @tr textarea öğesi (odaklamak, seçimi okumak için). */
  inputRef?: ((el: HTMLTextAreaElement) => void) | undefined;
  /** Line numbers in a gutter at the start of each line (wrapped lines keep one number). @tr Her satırın başında oluktaki satır numaraları (kaydırılan satırlar tek numara tutar). */
  lineNumbers?: MaybeFn<boolean | undefined>;
  /** Marks in the gutter, by line (breakpoints…); shown with `lineNumbers`. @tr Oluktaki işaretler, satıra göre (kesme noktaları…); `lineNumbers` ile görünür. */
  lineMarks?: MaybeFn<readonly CodeLineMark[] | undefined>;
  /** A line lit across the editor (a debugger's paused line): a number or `{ line, kind }`; scrolled into view when it changes. @tr Düzenleyici boyunca vurgulu satır (hata ayıklayıcının durduğu satır): bir sayı ya da `{ line, kind }`; değişince görünüme kaydırılır. */
  activeLine?: MaybeFn<CodeActiveLine | number | null | undefined>;
  /** A press on the gutter at a line, or F9 at the caret's line (toggle a breakpoint…). @tr Bir satırda oluğa basış ya da imlecin satırında F9 (kesme noktası aç / kapa…). */
  onGutter?: ((line: number, e: MouseEvent | KeyboardEvent) => void) | undefined;
  /**
   * Syntax colours: "ide" (default: an IDE's palette from the theme's category colours — keywords, types, functions,
   * members, strings, numbers each their own, light and dark) or "theme" (the CodeView colours).
   * @tr Sözdizimi renkleri: "ide" (varsayılan: temanın kategori renklerinden IDE paleti; anahtar sözcükler, türler, işlevler, üyeler, dizgeler, sayılar ayrı renkte, açık ve koyu) ya da "theme" (CodeView renkleri).
   */
  palette?: MaybeFn<"ide" | "theme" | undefined>;
  /** Brackets coloured by depth (three colours, one with no mate red). Default true. @tr Derinliğe göre renkli parantezler (üç renk, eşi olmayan kırmızı). Varsayılan true. */
  bracketColors?: MaybeFn<boolean | undefined>;
  /** The bracket beside the caret and its mate boxed. Default true. @tr İmlecin yanındaki parantez ve eşi kutu içinde. Varsayılan true. */
  matchBrackets?: MaybeFn<boolean | undefined>;
  /** A thin line at each step of a line's indent. Default true. @tr Satır girintisinin her adımında ince çizgi. Varsayılan true. */
  guides?: MaybeFn<boolean | undefined>;
  /** The caret's line lit (while the editor has the focus). Default true. @tr İmlecin satırı vurgulu (düzenleyici odaktayken). Varsayılan true. */
  currentLine?: MaybeFn<boolean | undefined>;
  /** The other places of the selected text, or of the word at the caret, lit. Default true. @tr Seçili metnin ya da imleçteki kelimenin diğer yerleri vurgulu. Varsayılan true. */
  occurrences?: MaybeFn<boolean | undefined>;
  /**
   * Brackets and quotes close themselves: `(` writes `()` with the caret between, a selection is wrapped, typing the
   * closer steps over it, Backspace between an empty pair removes both, `>` after `<div` writes `</div>`. Default true.
   * @tr Parantezler ve tırnaklar kendini kapatır: `(` imleç arada `()` yazar, seçim sarılır, kapatanı yazmak üstünden geçer, boş çift arasında Backspace ikisini de siler, `<div` sonrası `>` `</div>` yazar. Varsayılan true.
   */
  autoClose?: MaybeFn<boolean | undefined>;
  /** Renaming a tag renames its pair too (`<Row>` → `<Stack>` changes `</Row>`). Default true. @tr Bir etiketin adını değiştirmek eşini de değiştirir (`<Row>` → `<Stack>`, `</Row>`'u da değiştirir). Varsayılan true. */
  linkedTags?: MaybeFn<boolean | undefined>;
  /** More carets: Ctrl+D (the next place of the selected word), Alt+click, Ctrl+Alt+Up/Down; what is typed goes to each. Default true. @tr Birden çok imleç: Ctrl+D (seçili kelimenin sonraki yeri), Alt+tık, Ctrl+Alt+Yukarı/Aşağı; yazılan her birine gider. Varsayılan true. */
  multiCursor?: MaybeFn<boolean | undefined>;
  /** With line numbers, while scrolled: the lines that open the blocks the top line is in (a function, a `return (`), kept on top; a press goes there. Default true. @tr Satır numaralarıyla, kaydırılınca: üstteki satırın içinde olduğu blokları açan satırlar (bir işlev, bir `return (`) üstte kalır; basınca oraya gider. Varsayılan true. */
  stickyScroll?: MaybeFn<boolean | undefined>;
  /**
   * Inlay hints (a parameter's name, an inferred type): shown faintly at the end of their line, so the text does not
   * move. @tr Satır içi ipuçları (bir parametrenin adı, çıkarılan bir tür): satırlarının sonunda soluk gösterilir, metin kaymaz.
   */
  inlays?: MaybeFn<readonly { at: number; text: string }[] | undefined>;
  /**
   * The colour a string names (`"#e5484d"`, `"brand-orange"`): a line of that colour under it. Default: CSS colours
   * (#hex, rgb(), hsl(), oklch()); `false`: none. @tr Bir metnin adlandırdığı renk (`"#e5484d"`, `"brand-orange"`): altında o renkte bir çizgi. Varsayılan: CSS renkleri (#hex, rgb(), hsl(), oklch()); `false`: yok.
   */
  colorOf?: ((text: string) => string | null | undefined) | false | undefined;
  /** Pasted lines move to the indent of the line they land on (their inner indent kept). Default true. @tr Yapıştırılan satırlar düştükleri satırın girintisine taşınır (iç girintileri korunur). Varsayılan true. */
  pasteIndent?: MaybeFn<boolean | undefined>;
  /** Text size in px; Ctrl + = / Ctrl + - / Ctrl + 0 change it (`onFontSizeChange` keeps it). Default: the theme's small text. @tr px cinsinden yazı boyutu; Ctrl + = / Ctrl + - / Ctrl + 0 değiştirir (`onFontSizeChange` tutar). Varsayılan: temanın küçük metni. */
  fontSize?: MaybeFn<number | undefined>;
  /** Called with the new text size (px; undefined after Ctrl + 0). @tr Yeni yazı boyutuyla çağrılır (px; Ctrl + 0 sonrası undefined). */
  onFontSizeChange?: ((px: number | undefined) => void) | undefined;
  /** Line height (default 1.7). @tr Satır yüksekliği (varsayılan 1.7). */
  lineHeight?: MaybeFn<number | undefined>;
  /** F12 or Ctrl + click: where the name at a place is defined in this text (the range is selected and scrolled to). @tr F12 ya da Ctrl + tıklama: bir yerdeki adın bu metinde tanımlandığı yer (aralık seçilir ve oraya kaydırılır). */
  definition?: ((ctx: { value: string; at: number }) => Maybe<CodeRange>) | undefined;
  /** F2: the name at the caret and every place it is written; a small field asks the new name. @tr F2: imleçteki ad ve yazıldığı her yer; küçük bir alan yeni adı sorar. */
  rename?: ((ctx: { value: string; at: number }) => Maybe<CodeRename>) | undefined;
  /** Shift + Alt + F: the edits that format the text (one undo step). @tr Shift + Alt + F: metni biçimlendiren düzenlemeler (tek geri alma adımı). */
  format?: ((value: string) => Maybe<readonly CodeEdit[]>) | undefined;
  /**
   * Ctrl+. (or a press on a problem's icon in the gutter): the fixes for the problems of a range (the caret's line), in
   * a list; the one picked is applied (one undo step). @tr Ctrl+. (ya da oluktaki sorun ikonuna basmak): bir aralığın (imlecin satırı) sorunları için düzeltmeler, bir listede; seçilen uygulanır (tek geri alma adımı).
   */
  fixes?: ((ctx: { value: string; from: number; to: number }) => Maybe<readonly CodeFix[]>) | undefined;
  /**
   * Shift+F12: every place the name at the caret is used (`write`: written there), marked in the text and listed with
   * its line; a row takes the caret there. @tr Shift+F12: imleçteki adın kullanıldığı her yer (`write`: orada yazılıyor), metinde işaretli ve satırıyla listede; bir satır imleci oraya götürür.
   */
  references?: ((ctx: { value: string; at: number }) => Maybe<readonly { from: number; to: number; write?: boolean }[]>) | undefined;
  /**
   * The undo history (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z): `limit` steps (default 500; a typed word is one step). With a
   * `key` it is kept in the browser session (sessionStorage) for that key, so it survives the editor being drawn again
   * and a reload while the text is the same. `false`: the browser's own undo.
   * @tr Geri alma geçmişi (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z): `limit` adım (varsayılan 500; yazılan bir kelime bir adım). `key` ile o anahtar için tarayıcı oturumunda (sessionStorage) tutulur; metin aynıyken düzenleyici yeniden çizilse ve sayfa yenilense de kalır. `false`: tarayıcının kendi geri alması.
   */
  history?: false | { key?: string | undefined; limit?: number | undefined } | undefined;
  /** The pointer rests on a word: what it is (its type, signature, documentation), shown over it. @tr Fare işaretçisi bir kelimenin üstünde durunca: ne olduğu (türü, imzası, belgesi), üstünde gösterilir. */
  hover?: ((ctx: { value: string; at: number }) => Maybe<CodeDoc>) | undefined;
  /** Extra classes on the root. @tr Köke eklenen sınıflar. */
  class?: ClassProp;
}

/** `<CodeEditor bind:value={$code} complete={jsxCompleter({ tag: "Button", props })} message={$note} />` */
export function CodeEditor(props: CodeEditorProps): Element {
  const [get, set] = model(props, "");
  const id = uid("m-ced");
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const done = signal<{ from: number; to: number; items: readonly CodeSuggestion[]; all?: boolean } | null>(null);
  // the carets besides the text field's own (more carets: Ctrl+D, Alt+click, Ctrl+Alt+Up/Down)
  const extra = signal<readonly (readonly [number, number])[]>([]);
  // the references being listed (Shift+F12)
  const refs = signal<{ at: number; items: readonly { from: number; to: number; write?: boolean }[] } | null>(null);
  const refActive = signal(0);
  const active = signal(0);
  const marks = (): readonly CodeMark[] => val(props.marks) ?? [];
  // suggest="ghost": the rest of the likeliest row, shown faintly at the caret (`at`); Tab writes it
  const ghost = signal<{ from: number; at: number; rest: string; item: CodeSuggestion } | null>(null);
  // the source chips: the rows shown are the chosen source's ("all": every row)
  const chosen = signal(untrack(() => val(props.source)) ?? props.sources?.[0]?.value ?? "all");
  effect(() => { const s = val(props.source); if (s) chosen.set(s); });
  // the group chips over a list whose rows have headings ("": every group): the rows shown are the chosen group's
  const groupPick = signal("");
  const groupsOf = computed((): string[] => [...new Set((done()?.items ?? []).map((it) => it.group ?? ""))].filter(Boolean));
  const shown = computed((): readonly CodeSuggestion[] => {
    const d = done(), s = chosen(), g = groupPick();
    const items = !props.sources || s === "all" || d?.all ? d?.items ?? [] : (d?.items ?? []).filter((it) => it.source === s);
    return g && groupsOf().includes(g) ? items.filter((it) => it.group === g) : items;
  });

  // ---- the coloured copy under the (transparent) text field: same text, same wrapping
  const seen = new Set<string>();
  const flag = (p: MaybeFn<boolean | undefined>): boolean => val(p) !== false;
  const tokens = computed((): Token[] => tokenize(get(), props.lang ?? "tsx"));
  const brackets = computed(() => scanBrackets(tokens()));
  /** The tokens with each bracket on its own, coloured by its depth ("br0"… "br2"; "br-bad": no mate). */
  const pieces = (): readonly (readonly [string, string])[] => {
    const list = tokens();
    if (!flag(props.bracketColors)) return list;
    const b = brackets(), out: (readonly [string, string])[] = [];
    let at = 0;
    for (const [kind, text] of list) {
      if (kind !== "punct" || !/[()[\]{}]/.test(text)) { out.push([kind, text]); at += text.length; continue; }
      let from = 0;
      for (let i = 0; i < text.length; i++) {
        const d = b.depth.get(at + i);
        if (d === undefined) continue;
        if (i > from) out.push(["punct", text.slice(from, i)]);
        out.push([d < 0 ? "br-bad" : `br${d % 3}`, text[i]!]);
        from = i + 1;
      }
      if (from < text.length) out.push(["punct", text.slice(from)]);
      at += text.length;
    }
    return out;
  };
  const gutter = (): boolean => !!val(props.lineNumbers);
  const lit = (): CodeActiveLine | null => { const a = val(props.activeLine); return a == null ? null : typeof a === "number" ? { line: a } : a; };
  // a string that names a colour: its CSS colour (the owner's names first, then CSS's own forms)
  const CSS_COLOR = /^(#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\([^()]*\))$/i;
  const colorAt = (token: string): string | null => {
    if (props.colorOf === false) return null;
    const inner = token.replace(/^["'`]|["'`]$/g, "").trim();
    if (!inner || inner.length > 40) return null;
    return props.colorOf?.(inner) ?? (CSS_COLOR.test(inner) ? inner : null);
  };
  const paint = (): unknown => {
    const src = get(), list = [...marks()].filter((m) => m.to > m.from).sort((a, b) => a.from - b.from);
    const out: unknown[] = [], now = new Set<string>();
    let at = 0;
    // the gutter: a number (and its mark) at each line's start, the lit line's bar behind it; the tokens are cut there
    const starts: number[] = [];
    const lineMark = new Map<number, CodeLineMark>();
    const active = gutter() ? lit() : null;
    if (gutter()) {
      starts.push(0);
      for (let i = src.indexOf("\n"); i >= 0; i = src.indexOf("\n", i + 1)) starts.push(i + 1);
      for (const m of val(props.lineMarks) ?? []) lineMark.set(m.line, m);
    }
    let next = 0;
    // the lines with a problem (marks of kind "error" / "warning"): an icon in the gutter, the worst one wins
    const probs = new Map<number, { error: boolean; titles: string[] }>();
    if (gutter()) for (const m of list) {
      if (m.kind !== "error" && m.kind !== "warning") continue;
      let lo = 0, hi = starts.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid]! <= m.from) lo = mid; else hi = mid - 1; }
      const p = probs.get(lo + 1) ?? { error: false, titles: [] };
      p.error ||= m.kind === "error"; if (m.title) p.titles.push(m.title);
      probs.set(lo + 1, p);
    }
    const lineNode = (n: number): unknown => {
      const m = lineMark.get(n), p = probs.get(n);
      return [active?.line === n ? h("span", { class: `m-ced-lit is-${active.kind ?? "current"}`, "aria-hidden": "true" }) : null,
        h("span", { class: cx("m-ced-ln", m && `is-${m.kind ?? "breakpoint"}`, p && (p.error ? "is-error" : "is-warning")), "data-line": n, title: m?.title ?? (p ? p.titles.join("\n") : null) },
          p && !m ? h("span", { class: "m-ced-prob", "aria-hidden": "true" }, glyph(p.error ? xCircle : alertTriangle)) : null)];
    };
    const g = ghost();
    let ghostDone = !g;
    const ghostNode = (): unknown => h("span", { class: "m-ced-ghost-at" }, h("span", { class: "m-ced-ghost" }, g?.rest ?? ""));
    const push = (kind: string, text: string, mark: CodeMark | null): void => {
      const col = kind === "str" ? colorAt(text) : null;
      const node = col ? h("span", { class: `m-tok-${kind} m-ced-color`, style: { "--m-ced-swatch": col } }, text) : kind ? h("span", { class: `m-tok-${kind}` }, text) : text;
      if (!mark) { out.push(node); return; }
      const key = `${mark.kind ?? "flash"}:${mark.from}:${mark.to}:${src.slice(mark.from, mark.to)}`;
      const flash = (mark.kind ?? "flash") === "flash";
      const el = h("mark", { class: flash ? "m-ced-mark is-flash" : `m-ced-mark is-${mark.kind === "warning" ? "warning" : "error"}`, title: mark.title ?? null }, node, flash && props.flash !== "none" && props.flash !== false && !seen.has(key) ? h("i", { class: "m-ced-glow", "data-k": key }) : null);
      now.add(key);
      out.push(el);
    };
    for (const [kind, text] of pieces()) {
      // a token is cut where a mark starts or ends
      let from = at;
      const end = at + text.length;
      while (from < end) {
        while (next < starts.length && starts[next]! <= from) { out.push(lineNode(next + 1)); next++; }
        if (!ghostDone && g!.at === from) { out.push(ghostNode()); ghostDone = true; }
        const m = list.find((x) => x.from < end && x.to > from) ?? null;
        let stop = m ? (m.from > from ? m.from : Math.min(m.to, end)) : end;
        if (!ghostDone && g!.at > from && g!.at < stop) stop = g!.at;
        if (next < starts.length && starts[next]! > from && starts[next]! < stop) stop = starts[next]!;
        push(kind, text.slice(from - at, stop - at), m && m.from <= from ? m : null);
        from = stop;
      }
      at = end;
    }
    seen.clear(); for (const k of now) seen.add(k);
    while (next < starts.length) { out.push(lineNode(next + 1)); next++; } // an empty last line
    if (!ghostDone) out.push(ghostNode());
    out.push("​"); // the last (empty) line keeps its height
    return out;
  };
  const code = h("code", {}, paint) as HTMLElement;
  const pre = h("pre", { class: "m-ced-paint", "aria-hidden": "true" }, code) as HTMLElement;

  // ---- the decoration layer under the coloured copy (same text, transparent): indent guides, the caret's line, the
  // bracket pair at the caret, the other places of the word, the find matches. It follows the caret; the colours don't.
  const sel = signal<readonly [number, number]>([0, 0]);
  const focused = signal(false);
  const readSel = (): void => { const a = input.selectionStart ?? 0, b = input.selectionEnd ?? a, p = sel.peek(); if (p[0] !== a || p[1] !== b) sel.set([a, b]); };
  const onSelChange = (): void => { if (globalThis.document.activeElement === input) readSel(); };
  // find (Ctrl+F / Ctrl+H) and go to line (Ctrl+G)
  const fs: FindState = { mode: signal<FindMode | null>(null), text: signal(""), with: signal(""), case: signal(false), word: signal(false), regex: signal(false), line: signal("") };
  const finding = (): boolean => { const m = fs.mode(); return m === "find" || m === "replace"; };
  const matches = computed((): [number, number][] => (finding() ? findAll(get(), { text: fs.text(), case: fs.case(), word: fs.word(), regex: fs.regex() }) : []));
  const current = signal(-1);
  // a place to bring into view (an empty mark in the layer, scrolled to once drawn)
  const revealAt = signal<{ at: number; n: number } | null>(null);
  let reveals = 0;
  const reveal = (at: number): void => { revealAt.set({ at, n: ++reveals }); queueMicrotask(() => deco.querySelector?.(".m-ced-at")?.scrollIntoView?.({ block: "nearest", inline: "nearest" })); };
  const decorate = (): unknown => {
    const src = get(), [a, b] = sel(), on = focused(), unitLen = props.tabSize ?? 2;
    const ranges: [number, number, string][] = [];
    if (flag(props.guides)) {
      for (let ls = 0; ls <= src.length;) {
        const nl = src.indexOf("\n", ls), end = nl < 0 ? src.length : nl;
        let i = ls;
        while (i < end) {
          if (src[i] === "\t") { ranges.push([i, i + 1, "m-ced-guide"]); i++; continue; }
          let j = i; while (j < end && j - i < unitLen && src[j] === " ") j++;
          if (j - i === unitLen && j < end) { ranges.push([i, j, "m-ced-guide"]); i = j; } else break;
        }
        if (nl < 0) break;
        ls = nl + 1;
      }
    }
    if (on && flag(props.occurrences)) for (const [x, y] of occurrences(src, a, b)) ranges.push([x, y, "m-ced-occ"]);
    // the references being listed (Shift+F12): written places stronger
    for (const r of refs()?.items ?? []) ranges.push([r.from, r.to, r.write ? "m-ced-ref is-write" : "m-ced-ref"]);
    // inlay hints: each line's at its end (the text does not move)
    const hints = new Map<number, string[]>();
    for (const x of val(props.inlays) ?? []) {
      if (x.at < 0 || x.at > src.length) continue;
      const e = src.indexOf("\n", x.at), end = e < 0 ? src.length : e;
      hints.set(end, [...(hints.get(end) ?? []), x.text.replace(/^:\s*/, "").trim()]);
    }
    // the other carets: a selection's range, a collapsed one's bar (a point below)
    const bars = new Set<number>();
    for (const [x, y] of extra()) if (y > x) ranges.push([x, y, "m-ced-xsel"]); else bars.add(Math.min(x, src.length));
    const cur = current();
    matches().forEach(([x, y], i) => ranges.push([x, y, i === cur ? "m-ced-found is-current" : "m-ced-found"]));
    if (on && a === b && flag(props.matchBrackets)) { const m = bracketAt(brackets(), src, a); if (m) ranges.push([m[0], m[0] + 1, "m-ced-bm"], [m[1], m[1] + 1, "m-ced-bm"]); }
    const lineStart = on && a === b && flag(props.currentLine) ? src.lastIndexOf("\n", a - 1) + 1 : -1;
    const rv = revealAt(), rvAt = rv ? Math.min(rv.at, src.length) : -1;
    const cuts = new Set<number>([0, src.length]);
    for (const r of ranges) { cuts.add(r[0]); cuts.add(r[1]); }
    if (lineStart >= 0) cuts.add(lineStart);
    if (rvAt >= 0) cuts.add(rvAt);
    for (const x of bars) cuts.add(x);
    for (const x of hints.keys()) cuts.add(x);
    const pts = [...cuts].sort((x, y) => x - y);
    ranges.sort((x, y) => x[0] - y[0]);
    const out: unknown[] = [];
    let ri = 0, act: [number, number, string][] = [];
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i]!, y = pts[i + 1];
      if (x === lineStart) out.push(h("span", { class: "m-ced-cur", "aria-hidden": "true" }));
      if (x === rvAt) out.push(h("span", { class: "m-ced-at" }));
      if (bars.has(x)) out.push(h("span", { class: "m-ced-xcaret", "aria-hidden": "true" }));
      if (hints.has(x)) out.push(h("span", { class: "m-ced-inlay", "aria-hidden": "true" }, h("span", {}, hints.get(x)!.join(" · "))));
      if (y === undefined) break;
      while (ri < ranges.length && ranges[ri]![0] <= x) act.push(ranges[ri++]!);
      act = act.filter((r) => r[1] > x);
      const cls = act.filter((r) => r[0] <= x && r[1] >= y).map((r) => r[2]);
      const text = src.slice(x, y);
      out.push(cls.length ? h("span", { class: cls.join(" ") }, text) : text);
    }
    out.push("​"); // the last (empty) line keeps its height
    return out;
  };
  const deco = h("pre", { class: "m-ced-deco", "aria-hidden": "true" }, h("code", {}, decorate)) as HTMLElement;
  // a new flash mark glows once (motion engine: reduced motion and global speed apply)
  effect(() => {
    get(); marks();
    queueMicrotask(() => { for (const g of code.querySelectorAll?.(".m-ced-glow") ?? []) if (!g.hasAttribute("data-on")) { g.setAttribute("data-on", ""); animate(g, { opacity: [1, 0] }, { duration: 1100, easing: "easeOutCubic" }); } });
  });

  // ---- suggestions
  // a list asked for (Ctrl+Space) or opened by a member (".") stays while typing narrows it; one opened by the word's
  // length (listAfter, with the ghost) closes again when the word gets shorter
  let sticky = false;
  /** A row's source in the chips' order (March first); rows of no chip after them. */
  const sourceRank = (it: CodeSuggestion): number => { const i = props.sources?.findIndex((x) => x.value === it.source) ?? -1; return i < 0 ? 99 : i; };
  /**
   * The rows for the word typed: first the best one (the shortest name that starts with it in the same case: con →
   * console before consoleTransport), then by source (the chips' order: March, then the others), how well they fit
   * (same-case start, any-case start, holding it) and length. Rows under headings keep their groups' order.
   */
  const rank = (items: readonly CodeSuggestion[], typed: string): CodeSuggestion[] => {
    const prio = (it: CodeSuggestion): number => it.priority ?? 0;
    if (!typed) return [...items].sort((a, b) => prio(b) - prio(a));
    const lw = typed.toLowerCase();
    const fit = (it: CodeSuggestion): number => (it.label.startsWith(typed) ? 0 : it.label.toLowerCase().startsWith(lw) ? 1 : it.label.toLowerCase().includes(lw) ? 2 : 3);
    const kept = items.filter((it) => fit(it) < 3);
    const by = (a: CodeSuggestion, b: CodeSuggestion): number => prio(b) - prio(a) || sourceRank(a) - sourceRank(b) || fit(a) - fit(b) || a.label.length - b.label.length || a.label.localeCompare(b.label);
    // the best row: the shortest same-case start, among the rows of the highest priority
    const top = Math.max(0, ...kept.map(prio));
    const best = kept.filter((it) => fit(it) === 0 && prio(it) === top).sort((a, b) => a.label.length - b.label.length || sourceRank(a) - sourceRank(b))[0];
    const groups = [...new Set(kept.map((it) => it.group ?? ""))];
    return groups.flatMap((g) => {
      const rows = kept.filter((it) => (it.group ?? "") === g).sort(by);
      // the best row heads the list (or its group, when the rows have headings)
      const i = best ? rows.indexOf(best) : -1;
      if (i > 0) { rows.splice(i, 1); rows.unshift(best!); }
      return rows;
    });
  };
  const ask = (forced: boolean, typed = ""): void => {
    if (!props.complete || ro()) return;
    const caret = input.selectionStart ?? input.value.length;
    // what opens the list for good: asked for, or the word follows a `listOn` character (console. / console.ta: a member)
    const opener = props.listOn ?? ".", before = input.value.slice(0, caret).replace(/[\w$]*$/, "");
    if (forced || (!!opener && !!before && opener.includes(before.slice(-1)))) sticky = true;
    const r = props.complete({ value: input.value, caret, before: input.value.slice(0, caret), forced, typed });
    const show = (c: CodeCompletion | null | undefined): void => {
      const word = c ? input.value.slice(c.from, caret) : "";
      const items = c ? rank(c.items, word) : [];
      // a place that lists its words at once (a tag's props): open, and kept open while typing
      if (c?.open && items.length) sticky = true;
      const ghosting = props.suggest === "ghost";
      // the ghost (the best row's rest at the caret) and, below, the list: both while typing
      ghost.set(ghosting && !forced && c ? likeliest({ ...c, items }, caret) : null);
      const min = props.listAfter ?? 2;
      // rows the place's type expects open the list even before a letter is typed (const ok: boolean = → true, false)
      const open = !ghosting || sticky || (min > 0 && word.length >= min) || (!word && items.some((it) => (it.priority ?? 0) > 0));
      batch(() => { active.set(0); done.set(open && c && items.length ? { from: c.from, to: c.to ?? caret, items, ...(c.all ? { all: true } : {}) } : null); });
      if (!done.peek()) sticky = false;
    };
    // a language service answers later: the list opens only when the text and the caret are still where they were
    if (r && typeof (r as Promise<unknown>).then === "function") {
      const value = input.value, n = ++asked;
      void (r as Promise<CodeCompletion | null | undefined>).then((c) => { if (n === asked && input.value === value && (input.selectionStart ?? -1) === caret) show(c); }, () => undefined);
      return;
    }
    show(r as CodeCompletion | null | undefined);
  };
  let asked = 0;
  /** The row the ghost shows (the rows come ranked): the first that completes the word in its case, then in any case. */
  const likeliest = (c: CodeCompletion | null | undefined, caret: number): { from: number; at: number; rest: string; item: CodeSuggestion } | null => {
    if (!c || !c.items.length) return null;
    const typed = input.value.slice(c.from, caret);
    if (!typed) return null;
    // matched by the name; the ghost shows what Tab writes after the typed letters (the name's rest when the row writes more, an import)
    // the word written whole (`icon`) whose row writes more (`icon=""`) wins over a longer name (`iconEnd`)
    const item = c.items.find((it) => it.label === typed && (it.insert ?? it.label) !== typed)
      ?? c.items.find((it) => it.label.startsWith(typed) && it.label !== typed) ?? c.items.find((it) => it.label.toLowerCase().startsWith(typed.toLowerCase()) && it.label.length > typed.length);
    if (!item) return null;
    const text = item.insert ?? item.label;
    return { from: c.from, at: caret, rest: (text.toLowerCase().startsWith(typed.toLowerCase()) ? text : item.label).slice(typed.length), item };
  };
  /** Tab on a ghost: the row is written (its case wins over what was typed), with its head line. */
  const takeGhost = (): void => {
    const g = ghost.peek();
    if (!g) return;
    ghost.set(null);
    close();
    const text = g.item.insert ?? g.item.label;
    input.setRangeText(text, g.from, g.at, "end");
    const caret = addHead(g.item.head, g.from + text.length - (g.item.back ?? 0));
    input.setSelectionRange(caret, caret);
    set(input.value);
    // `again` (a prop with values: variant="|"): the next list opens at once, as after a pick from the list
    if (g.item.again) ask(true);
  };
  /** A row's import line written into the text (see headEdit); returns the caret moved by what went before it. */
  const addHead = (head: string | undefined, caret: number): number => {
    const e = headEdit(input.value, head);
    if (!e) return caret;
    input.setRangeText(e.text, e.at, e.at, "preserve");
    return e.at <= caret ? caret + e.text.length : caret;
  };
  const close = (): void => { sticky = false; groupPick.set(""); if (done.peek()) done.set(null); };
  const pick = (i: number): void => {
    const d = done.peek(), item = shown.peek()[i];
    if (!d || !item) return;
    ghost.set(null);
    const text = item.insert ?? item.label;
    input.setRangeText(text, d.from, d.to, "end");
    // the row's import, when the text does not have it (joined to the module's import line, else at the top)
    const caret = addHead(item.head, d.from + text.length - (item.back ?? 0));
    input.setSelectionRange(caret, caret);
    // `again`: the list stays open and takes the next rows (closing and opening it again would mount a second list)
    groupPick.set("");
    if (!item.again) { sticky = false; done.set(null); }
    set(input.value);
    if (item.again) ask(true);
  };
  /** The caret's place on screen: the same character in the coloured copy. */
  const caretRect = (): DOMRect | null => { const d = done.peek(); return rectAt(d ? d.from : input.selectionStart ?? 0); };
  /** A place of the text on screen (the same character in the coloured copy). */
  const rectAt = (at: number): DOMRect | null => {
    let left = at;
    const walker = globalThis.document.createTreeWalker?.(code, 4 /* text */);
    if (!walker) return null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const len = n.nodeValue?.length ?? 0;
      if (left <= len) {
        const r = globalThis.document.createRange();
        r.setStart(n, left); r.setEnd(n, left);
        return r.getClientRects?.()[0] ?? r.getBoundingClientRect?.() ?? null;
      }
      left -= len;
    }
    return null;
  };

  // ---- the IDE keys: edits go through the browser's own undo (insertText) where it has it
  const on = (c: CodeCommand): boolean => props.keys !== false && (props.keys?.[c] ?? true) && (c !== "save" || !!props.onSave);
  const unit = (): string => " ".repeat(props.tabSize ?? 2);
  let editing = false;
  /** The selection before the change being made (the undo step's "before"). */
  let selBefore: readonly [number, number] | null = null;
  let altFrom: [number, number] | null = null;
  const multiOn = (): boolean => val(props.multiCursor) !== false && props.multiline !== false && !ro();
  // a tag name being edited (linkedTags): the text before the edit and where its pair is
  let linked: { value: string; self: [number, number]; pair: [number, number] } | null = null;
  const LINKED_LANG = /^(tsx|jsx|html?|xml|vue|svelte)$/;
  // ---- more carets: Ctrl+D (the next place of the selected word), Alt+click, Ctrl+Alt+Up/Down (the line above / below);
  // typing, Backspace, Delete, Enter and a paste happen at each, as one step; Escape, a click or an arrow drops them
  const dropMulti = (): void => { if (extra.peek().length) extra.set([]); };
  const primary = (): [number, number] => [input.selectionStart ?? 0, input.selectionEnd ?? input.selectionStart ?? 0];
  /** Every caret (the text field's selection among them), merged where they overlap, in the text's order. */
  const carets = (): [number, number][] => {
    const all = [primary(), ...extra.peek().map((r) => [r[0], r[1]] as [number, number])].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const out: [number, number][] = [];
    for (const r of all) { const last = out[out.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else out.push(r); }
    return out;
  };
  /** Writes `texts[i]` over each caret's selection (or, collapsed, `del` characters before (-1) or after (1) it taken):
   * one step in the history; the carets stand after what was written. */
  const editEach = (texts: (i: number) => string, del: -1 | 0 | 1 = 0): void => {
    const v = input.value, list = carets().map(([a, b]) => (a === b && del < 0 ? [Math.max(0, a - 1), b] : a === b && del > 0 ? [a, Math.min(v.length, b + 1)] : [a, b]) as [number, number]);
    const from = list[0]![0], to = list[list.length - 1]![1];
    let out = "", at = from, shift = 0;
    const after: number[] = [];
    list.forEach(([a, b], i) => { const text = texts(i); out += v.slice(at, a) + text; at = b; after.push(a + shift + text.length); shift += text.length - (b - a); });
    out += v.slice(at, to);
    replace(from, to, out, after[after.length - 1]!);
    extra.set(after.slice(0, -1).map((x) => [x, x] as const));
  };
  /** Ctrl+D: the word at the caret, then each next place of the selected text (after the last caret, around the end). */
  const selectNext = (): void => {
    const [a, b] = primary(), v = input.value;
    if (a === b) { const w = wordAt(v, a); if (w) { input.setSelectionRange(w[0], w[1]); readSel(); } return; }
    const word = v.slice(a, b), taken = carets(), last = Math.max(...taken.map((r) => r[1]));
    const places: number[] = [];
    for (let i = v.indexOf(word); i >= 0; i = v.indexOf(word, i + 1)) if (!taken.some((r) => r[0] === i)) places.push(i);
    const i = places.find((x) => x >= last) ?? places[0];
    if (i === undefined) return;
    extra.set([...extra.peek(), [a, b]]);
    input.setSelectionRange(i, i + word.length); readSel(); reveal(i);
  };
  /** Ctrl+Alt+Up/Down: a caret on the line above / below the farthest one, at the same column. */
  const addLine = (dir: -1 | 1): void => {
    const v = input.value, all = carets(), edge = dir > 0 ? all[all.length - 1]![1] : all[0]![0];
    const ls = v.lastIndexOf("\n", edge - 1) + 1, col = edge - ls;
    if (dir > 0 ? v.indexOf("\n", edge) < 0 : ls === 0) return;
    const ns = dir > 0 ? v.indexOf("\n", edge) + 1 : v.lastIndexOf("\n", ls - 2) + 1;
    const ne = v.indexOf("\n", ns), at = Math.min(ns + col, ne < 0 ? v.length : ne);
    extra.set([...extra.peek(), [at, at]]);
  };
  /** After an edit inside a tag's name: its pair gets the same name (one more step in the history). */
  const followTag = (): void => {
    const l = linked;
    linked = null;
    if (!l) return;
    const v = input.value, delta = v.length - l.value.length;
    let end = l.self[0];
    while (end < v.length && /[\w$.:-]/.test(v[end]!)) end++;
    const name = v.slice(l.self[0], end), oldName = l.value.slice(l.self[0], l.self[1]);
    const pair: [number, number] = l.pair[0] > l.self[0] ? [l.pair[0] + delta, l.pair[1] + delta] : [l.pair[0], l.pair[1]];
    if (name === oldName || !name || v.slice(pair[0], pair[1]) !== l.value.slice(l.pair[0], l.pair[1])) return;
    const at = input.selectionStart ?? 0, shift = pair[0] < at ? name.length - (pair[1] - pair[0]) : 0;
    input.setRangeText(name, pair[0], pair[1], "preserve");
    input.setSelectionRange(at + shift, at + shift);
    set(input.value);
  };
  /** Replace [from, to) with `text`, then select [a, b] (offsets in the new text). */
  const replace = (from: number, to: number, text: string, a: number, b = a): void => {
    selBefore ??= [input.selectionStart ?? 0, input.selectionEnd ?? input.selectionStart ?? 0];
    editing = true;
    // the find bar's field keeps the focus (Replace, Replace all)
    const back = globalThis.document.activeElement as HTMLElement | null;
    input.focus({ preventScroll: true });
    input.setSelectionRange(from, to);
    const doc = globalThis.document as Document & { execCommand?: (c: string, ui: boolean, v: string) => boolean };
    let ok = false;
    try { ok = !!doc.execCommand?.("insertText", false, text) && input.value.slice(from, from + text.length) === text; } catch { ok = false; }
    if (!ok) input.setRangeText(text, from, to, "end");
    editing = false;
    input.setSelectionRange(a, b);
    set(input.value);
    readSel();
    if (back && back !== input && back.closest?.(".m-ced-find, .m-ced-rename")) back.focus({ preventScroll: true });
  };
  /** The whole lines the selection touches: [start, end) without the last line's "\n". */
  const block = (): { start: number; end: number; s: number; e: number } => {
    const v = input.value, s = input.selectionStart ?? 0, e = input.selectionEnd ?? s;
    const last = e > s && v[e - 1] === "\n" ? e - 1 : e;
    const start = v.lastIndexOf("\n", s - 1) + 1, nl = v.indexOf("\n", last);
    return { start, end: nl < 0 ? v.length : nl, s, e };
  };
  const indent = (back: boolean): void => {
    const v = input.value, { start, end, s, e } = block(), u = unit();
    if (!back && !v.slice(s, e).includes("\n")) { replace(s, e, u, s + u.length); return; }
    const lines = v.slice(start, end).split("\n");
    let first = 0, total = 0;
    const out = lines.map((l, i) => {
      if (!back) { if (i === 0) first = u.length; total += u.length; return u + l; }
      const cut = /^\t/.test(l) ? 1 : (/^ */.exec(l)?.[0].length ?? 0) >= u.length ? u.length : (/^ */.exec(l)?.[0].length ?? 0);
      if (i === 0) first = -cut; total -= cut;
      return l.slice(cut);
    });
    const text = out.join("\n");
    replace(start, end, text, Math.max(start, s + first), Math.max(start, e + total));
  };
  const COMMENT: Record<string, string> = { js: "//", ts: "//", jsx: "//", tsx: "//", sh: "#" };
  const comment = (): boolean => {
    const mark = COMMENT[props.lang ?? "tsx"];
    if (!mark) return false;
    const v = input.value, { start, end, s, e } = block();
    const lines = v.slice(start, end).split("\n"), filled = lines.filter((l) => l.trim());
    const off = filled.length > 0 && filled.every((l) => l.trimStart().startsWith(mark));
    const pad = Math.min(...filled.map((l) => /^\s*/.exec(l)![0].length), 1e9);
    let first = 0, total = 0;
    const out = lines.map((l, i) => {
      if (!l.trim()) return l;
      if (off) { const at = l.indexOf(mark), n = mark.length + (l[at + mark.length] === " " ? 1 : 0); if (i === 0) first = -n; total -= n; return l.slice(0, at) + l.slice(at + n); }
      const at = pad === 1e9 ? 0 : pad; if (i === 0) first = mark.length + 1; total += mark.length + 1;
      return `${l.slice(0, at)}${mark} ${l.slice(at)}`;
    });
    replace(start, end, out.join("\n"), Math.max(start, s + first), Math.max(start, e + total));
    return true;
  };
  const moveLines = (up: boolean): void => {
    const v = input.value, { start, end, s, e } = block();
    if (up ? start === 0 : end >= v.length) return;
    const text = v.slice(start, end);
    if (up) { const p = v.lastIndexOf("\n", start - 2) + 1, prev = v.slice(p, start - 1); replace(p, end, `${text}\n${prev}`, s - (start - p), e - (start - p)); }
    else { const n = v.indexOf("\n", end + 1), stop = n < 0 ? v.length : n, next = v.slice(end + 1, stop); replace(start, stop, `${next}\n${text}`, s + next.length + 1, e + next.length + 1); }
  };
  const copyLines = (up: boolean): void => {
    const v = input.value, { start, end, s, e } = block(), text = v.slice(start, end);
    if (up) replace(end, end, `\n${text}`, s, e);
    else replace(end, end, `\n${text}`, s + text.length + 1, e + text.length + 1);
  };
  const deleteLines = (): void => {
    const v = input.value, { start, end } = block();
    const from = end < v.length ? start : Math.max(0, start - 1), to = end < v.length ? end + 1 : end;
    replace(from, to, "", Math.min(from === start ? start : from + 1, v.length - (to - from)));
  };
  const OPEN: Record<string, string> = { "{": "}", "(": ")", "[": "]" };
  const newline = (): void => {
    const v = input.value, s = input.selectionStart ?? 0, e = input.selectionEnd ?? s;
    const lineStart = v.lastIndexOf("\n", s - 1) + 1, pad = /^[ \t]*/.exec(v.slice(lineStart, s))![0];
    const before = v.slice(lineStart, s).trimEnd().slice(-1), after = v.slice(e).match(/^[ \t]*(.)/)?.[1];
    // between a pair ({|}, (|), [|]) or a tag and its closing tag (<div>|</div>): the inner line indented, the closer below
    const tagPair = before === ">" && v.startsWith("</", e) && v[s - 2] !== "/";
    if (OPEN[before] || tagPair) {
      const inner = `\n${pad}${unit()}`;
      replace(s, e, (tagPair || after === OPEN[before]) ? `${inner}\n${pad}` : inner, s + inner.length);
      return;
    }
    replace(s, e, `\n${pad}`, s + pad.length + 1);
  };
  // Tab is the editor's until Escape: then Tab and Shift+Tab move the focus on (a keyboard way out)
  let free = false;
  // ---- the signature over the caret inside a call's parentheses
  const sig = signal<CodeSignature | null>(null);
  let sigAsked = 0;
  const askSignature = (): void => {
    if (!props.signature || ro()) return;
    const caret = input.selectionStart ?? input.value.length, value = input.value, n = ++sigAsked;
    const take = (r: CodeSignature | null | undefined): void => { if (n === sigAsked && input.value === value && (input.selectionStart ?? -1) === caret) sig.set(r && r.items.length ? r : null); };
    const r = props.signature({ value, caret });
    if (r && typeof (r as Promise<unknown>).then === "function") void (r as Promise<CodeSignature | null | undefined>).then(take, () => undefined);
    else take(r as CodeSignature | null | undefined);
  };
  const closeSignature = (): void => { sigAsked++; if (sig.peek()) sig.set(null); };

  // ---- typing aids: pairs that close themselves, the closing tag, pasted lines fitted to their line
  /** The caret is inside a string or a comment (no pairs there). */
  const inText = (caret: number): boolean => {
    let at = 0;
    for (const [k, t0] of tokens.peek()) {
      const end = at + t0.length;
      if (k === "str" || k === "com") {
        if (caret > at && caret < end) return true;
        // an unfinished string or a line comment reaching the caret
        if (caret === end && caret > at && ((k === "com" && t0.startsWith("//")) || (k === "str" && (t0.length === 1 || t0[t0.length - 1] !== t0[0])))) return true;
      }
      if (end > caret) break;
      at = end;
    }
    return false;
  };
  const TAGS = /^(jsx|tsx|html|xml|svg)$/;
  /** A printable key with auto-closing on: true when it was handled. */
  const typePair = (ch: string): boolean => {
    const v = input.value, s = input.selectionStart ?? 0, e = input.selectionEnd ?? s;
    if (ch === ">" && s === e && TAGS.test(props.lang ?? "tsx") && !inText(s)) {
      const name = tagToClose(v.slice(Math.max(0, s - 400), s));
      if (name) { replace(s, e, `></${name}>`, s + 1); return true; }
      return false;
    }
    const act = pairAction(v, s, e, ch, inText(s));
    if (!act) return false;
    if (act === "over") { input.setSelectionRange(s + 1, s + 1); readSel(); if (sig.peek()) askSignature(); return true; }
    const close = PAIRS[ch]!;
    if (act === "wrap") replace(s, e, ch + v.slice(s, e) + close, s + 1, e + 1);
    else replace(s, e, ch + close, s + 1);
    if (ch === "(") askSignature();
    if (act === "pair") ask(false, ch);
    return true;
  };
  const onPaste = (e: ClipboardEvent): void => {
    if (ro()) return;
    const text = e.clipboardData?.getData("text/plain") ?? "";
    // more carets: the pasted text at each (a line each when it has as many lines as there are carets)
    if (extra.peek().length) {
      e.preventDefault();
      const lines = text.replace(/\r\n?/g, "\n").split("\n"), n = carets().length;
      editEach((i) => (lines.length === n ? lines[i]! : text));
      return;
    }
    if (!flag(props.pasteIndent) || props.multiline === false) return;
    if (!text.includes("\n")) return;
    const v = input.value, s = input.selectionStart ?? 0, end = input.selectionEnd ?? s;
    const lineStart = v.lastIndexOf("\n", s - 1) + 1, head = v.slice(lineStart, s), atIndent = /^[ \t]*$/.test(head);
    const fitted = fitPaste(text, /^[ \t]*/.exec(head)![0], atIndent);
    if (fitted === text) return;
    e.preventDefault();
    replace(s, end, fitted, s + fitted.length);
  };

  // ---- find, replace, go to line
  let findField: HTMLInputElement | null = null, lineField: HTMLInputElement | null = null;
  let lastQuery = "";
  effect(() => {
    const m = matches(), key = `${fs.text()}\u0000${fs.case()}${fs.word()}${fs.regex()}${finding()}`;
    untrack(() => {
      // the same query (the text changed) or the bar closed: only keep the index in range
      if (key === lastQuery || !finding()) { lastQuery = key; if (current.peek() >= m.length) current.set(m.length - 1); return; }
      lastQuery = key;
      // a new query: the first match from the caret, selected and in view
      const from = input.selectionStart ?? 0, i = m.findIndex(([a]) => a >= from);
      current.set(m.length ? (i < 0 ? 0 : i) : -1);
      if (m.length && finding()) showMatch(current.peek());
    });
  });
  const showMatch = (i: number): void => {
    const m = matches.peek()[i];
    if (!m) return;
    input.setSelectionRange(m[0], m[1]); readSel();
    reveal(m[0]);
  };
  const nextMatch = (back: boolean): void => {
    const m = matches.peek(), n = m.length;
    if (!n) return;
    const i = current.peek(), sel0 = input.selectionStart ?? 0;
    // from the selected match, else from the caret
    const at = i >= 0 && m[i]![0] === sel0 ? i : -1;
    const k = at >= 0 ? (back ? (at - 1 + n) % n : (at + 1) % n) : back ? (m.map(([a]) => a < sel0).lastIndexOf(true) + n) % n : Math.max(0, m.findIndex(([a]) => a >= sel0));
    current.set(k); showMatch(k);
  };
  const replacement = (a: number, b: number): string => {
    if (!fs.regex.peek()) return fs.with.peek();
    try { return input.value.slice(a, b).replace(new RegExp(fs.text.peek(), fs.case.peek() ? "" : "i"), fs.with.peek()); } catch { return fs.with.peek(); }
  };
  const replaceOne = (): void => {
    if (ro()) return;
    const m = matches.peek(), i = current.peek(), hit = m[i];
    if (!hit || (input.selectionStart ?? -1) !== hit[0] || (input.selectionEnd ?? -1) !== hit[1]) { nextMatch(false); return; }
    const text = replacement(hit[0], hit[1]);
    replace(hit[0], hit[1], text, hit[0] + text.length);
    // the next match after the one replaced
    const after = matches.peek(), k = after.findIndex(([a]) => a >= hit[0] + text.length);
    if (after.length) { current.set(k < 0 ? 0 : k); showMatch(current.peek()); }
  };
  const replaceAll = (): void => {
    const m = matches.peek();
    if (ro() || !m.length) return;
    const from = m[0]![0], to = m[m.length - 1]![1];
    const r = applyEdits(input.value.slice(from, to), m.map(([a, b]) => ({ from: a - from, to: b - from, text: replacement(a, b) })), 0);
    replace(from, to, r.value, from + r.value.length);
  };
  const openFind = (mode: FindMode): void => {
    const v = input.value, s = input.selectionStart ?? 0, e = input.selectionEnd ?? s;
    if (mode !== "line") {
      // the selection (one line) or the word at the caret becomes the query
      const w = e > s ? (v.slice(s, e).includes("\n") ? null : [s, e]) : wordAt(v, s);
      if (w) fs.text.set(v.slice(w[0], w[1]));
    } else fs.line.set("");
    const was = fs.mode.peek();
    fs.mode.set(mode);
    queueMicrotask(() => {
      const f = mode === "line" ? lineField : findField; f?.focus(); f?.select?.();
      // the bar comes in softly (motion engine: reduced motion and the global speed apply)
      if (!was && bar) animate(bar, { opacity: [0, 1] }, { duration: 140, easing: "easeOutCubic" });
    });
  };
  const closeFind = (): void => { fs.mode.set(null); current.set(-1); input.focus({ preventScroll: true }); };
  const goLine = (): void => {
    const m = /^\s*(\d+)(?:\s*[:,]\s*(\d+))?\s*$/.exec(fs.line.peek());
    if (!m) return;
    const v = input.value, lines = v.split("\n"), n = Math.min(Math.max(1, Number(m[1])), lines.length);
    let at = 0;
    for (let i = 0; i < n - 1; i++) at += lines[i]!.length + 1;
    at += Math.min(Math.max(0, Number(m[2] ?? 1) - 1), lines[n - 1]!.length);
    fs.mode.set(null);
    input.focus({ preventScroll: true }); input.setSelectionRange(at, at); readSel(); reveal(at);
  };

  // goTo: the owner puts the caret there (a problem picked from a list)
  effect(() => {
    const g = val(props.goTo);
    if (!g) return;
    untrack(() => {
      const at = Math.min(Math.max(0, g.from), input.value.length), to = Math.min(Math.max(at, g.to ?? at), input.value.length);
      queueMicrotask(() => { input.focus({ preventScroll: true }); input.setSelectionRange(at, to); readSel(); reveal(at); });
    });
  });

  // ---- definition (F12, Ctrl + click), rename (F2), format (Shift + Alt + F), the note at the caret
  const note = signal<{ at: number; doc: CodeDoc; n: number } | null>(null);
  let notes = 0, noteTimer: ReturnType<typeof setTimeout> | undefined;
  /** A short note at a place (no definition here…); it goes by itself. */
  const notice = (text: string, at: number): void => {
    const n = ++notes; clearTimeout(noteTimer);
    note.set({ at, doc: { doc: text }, n });
    noteTimer = setTimeout(() => { if (note.peek()?.n === n) note.set(null); }, 1800);
  };
  const settle = <T>(r: Maybe<T>): Promise<T | null | undefined> => Promise.resolve(r).catch(() => null);
  const goDefinition = async (at: number): Promise<void> => {
    if (!props.definition) return;
    const value = input.value, r = await settle(props.definition({ value, at }));
    if (input.value !== value) return;
    if (!r) { notice(t`No definition found`, at); return; }
    input.focus({ preventScroll: true }); input.setSelectionRange(r.from, r.to); readSel(); reveal(r.from);
  };
  const renaming = signal<{ from: number; to: number; locations: readonly CodeRange[]; value: string; name: Signal<string> } | null>(null);
  const startRename = async (): Promise<void> => {
    if (!props.rename || ro()) return;
    const value = input.value, at = input.selectionStart ?? 0, r = await settle(props.rename({ value, at }));
    if (input.value !== value) return;
    if (!r || "error" in r) { notice(r && "error" in r && r.error ? r.error : t`This can't be renamed`, at); return; }
    renaming.set({ ...r, value, name: signal(value.slice(r.from, r.to)) });
  };
  const applyRename = (): void => {
    const r = renaming.peek();
    renaming.set(null);
    input.focus({ preventScroll: true });
    if (!r || input.value !== r.value) return;
    const name = r.name.peek().trim();
    if (!name || name === r.value.slice(r.from, r.to)) return;
    const locs = r.locations.length ? r.locations : [{ from: r.from, to: r.to }];
    const from = Math.min(...locs.map((l) => l.from)), to = Math.max(...locs.map((l) => l.to));
    const caret = input.selectionStart ?? r.from;
    const out = applyEdits(r.value.slice(from, to), locs.map((l) => ({ from: l.from - from, to: l.to - from, text: name })), Math.min(Math.max(caret - from, 0), to - from));
    replace(from, to, out.value, from + out.caret);
  };
  const formatAll = async (): Promise<void> => {
    if (!props.format || ro()) return;
    const value = input.value, edits = await settle(props.format(value));
    if (input.value !== value || !edits) return;
    const at = input.selectionStart ?? 0;
    if (!edits.length) { notice(t`Already formatted`, at); return; }
    const from = Math.min(...edits.map((x) => x.from)), to = Math.max(...edits.map((x) => x.to));
    const r = applyEdits(value, edits, at), tail = value.length - to;
    replace(from, to, r.value.slice(from, r.value.length - tail), r.caret);
  };

  // ---- quick fixes (Ctrl+.): the caret's line's fixes in a list under it
  const fixList = signal<{ at: number; items: readonly CodeFix[] } | null>(null);
  const fixActive = signal(0);
  const lineRange = (at: number): [number, number] => {
    const v = input.value, a = v.lastIndexOf("\n", Math.max(0, at - 1)) + 1, e = v.indexOf("\n", at);
    return [a, e < 0 ? v.length : e];
  };
  const openFixes = async (at: number): Promise<void> => {
    if (!props.fixes || ro()) return;
    const value = input.value, [from, to] = lineRange(at);
    close(); closeSignature();
    const items = await settle(props.fixes({ value, from, to }));
    if (input.value !== value) return;
    if (!items?.length) { notice(t`No quick fixes here`, at); return; }
    batch(() => { fixActive.set(0); fixList.set({ at, items }); });
  };
  const applyFix = (i: number): void => {
    const f = fixList.peek()?.items[i];
    fixList.set(null);
    if (!f || !f.edits.length) return;
    const value = input.value, at = input.selectionStart ?? 0;
    const from = Math.min(...f.edits.map((x) => x.from)), to = Math.max(...f.edits.map((x) => x.to));
    const r = applyEdits(value, f.edits, at), tail = value.length - to;
    replace(from, to, r.value.slice(from, r.value.length - tail), r.caret);
    input.focus({ preventScroll: true });
  };

  // ---- references (Shift+F12): marked in the text, listed under the word
  const openRefs = async (at: number): Promise<void> => {
    if (!props.references) return;
    const value = input.value;
    close(); closeSignature(); fixList.set(null);
    const items = await settle(props.references({ value, at }));
    if (input.value !== value) return;
    if (!items?.length) { notice(t`No references here`, at); return; }
    const w = wordAt(value, at);
    batch(() => { refActive.set(0); refs.set({ at: w ? w[0] : at, items: [...items].sort((x, y) => x.from - y.from) }); });
  };
  const goRef = (i: number): void => {
    const r = refs.peek()?.items[i];
    refs.set(null);
    if (!r) return;
    input.focus({ preventScroll: true }); input.setSelectionRange(r.from, r.to); readSel(); reveal(r.from);
  };
  /** A place's line: its number and its text (trimmed), for a row of a list. */
  const lineOf = (v: string, at: number): { n: number; text: string } => {
    const a = v.lastIndexOf("\n", at - 1) + 1, e = v.indexOf("\n", at);
    return { n: v.slice(0, a).split("\n").length, text: v.slice(a, e < 0 ? v.length : e).trim() };
  };

  // ---- text size (Ctrl + = / - / 0)
  const size = signal<number | undefined>(untrack(() => val(props.fontSize)));
  effect(() => { const v = val(props.fontSize); untrack(() => { if (v !== size.peek()) size.set(v); }); });
  const zoom = (d: number): void => {
    const base = size.peek() ?? (Number.parseFloat(globalThis.getComputedStyle?.(area).fontSize ?? "") || 14);
    const next = d === 0 ? undefined : Math.min(32, Math.max(9, Math.round(base + d)));
    size.set(next);
    props.onFontSizeChange?.(next);
  };

  // ---- hover: what the word under the resting pointer is
  const hoverDoc = signal<{ from: number; to: number; doc: CodeDoc } | null>(null);
  let hoverTimer: ReturnType<typeof setTimeout> | undefined, hideTimer: ReturnType<typeof setTimeout> | undefined, hoverN = 0;
  /** The text place under a point of the screen (-1: none), read from the coloured copy. */
  const offsetAt = (x: number, y: number): number => {
    const d = globalThis.document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null; caretRangeFromPoint?: (x: number, y: number) => Range | null };
    let node: Node | null = null, off = 0;
    area.classList.add("is-probe");
    try {
      if (d.caretPositionFromPoint) { const p = d.caretPositionFromPoint(x, y); node = p?.offsetNode ?? null; off = p?.offset ?? 0; }
      else if (d.caretRangeFromPoint) { const r = d.caretRangeFromPoint(x, y); node = r?.startContainer ?? null; off = r?.startOffset ?? 0; }
    } finally { area.classList.remove("is-probe"); }
    if (!node || node.nodeType !== 3 || !code.contains(node)) return -1;
    let at = 0;
    const walker = d.createTreeWalker(code, 4);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n === node) return at + off;
      if (!(n.parentElement?.closest(".m-ced-ghost"))) at += n.nodeValue?.length ?? 0;
    }
    return -1;
  };
  const wordRect = (from: number, to: number): DOMRect | null => {
    const a = rectAt(from), b = rectAt(to);
    return a && b && Math.abs(a.top - b.top) < 2 ? new DOMRect(a.left, a.top, b.left - a.left, a.height) : a;
  };
  const hideHover = (): void => { clearTimeout(hoverTimer); hoverN++; if (hoverDoc.peek()) hoverDoc.set(null); };
  const onPointerMove = (e: PointerEvent): void => {
    if (!props.hover || e.buttons) return;
    clearTimeout(hoverTimer); clearTimeout(hideTimer);
    const shown0 = hoverDoc.peek();
    if (shown0) {
      const r = wordRect(shown0.from, shown0.to);
      if (r && e.clientX >= r.left - 2 && e.clientX <= r.right + 2 && e.clientY >= r.top - 2 && e.clientY <= r.bottom + 2) return;
      hideTimer = setTimeout(() => hoverDoc.set(null), 250);
    }
    const x = e.clientX, y = e.clientY;
    hoverTimer = setTimeout(() => {
      const at = offsetAt(x, y), value = input.value, w = at >= 0 ? wordAt(value, at) : null;
      if (!w) return;
      const r = wordRect(w[0], w[1]);
      if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) return;
      const n = ++hoverN;
      void settle(props.hover!({ value, at: w[0] + Math.min(1, w[1] - w[0] - 1) })).then((doc) => {
        if (n !== hoverN || input.value !== value || !doc || !(doc.signature || doc.doc)) return;
        clearTimeout(hideTimer);
        hoverDoc.set({ from: w[0], to: w[1], doc });
      });
    }, 450);
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    const mod = e.ctrlKey || e.metaKey;
    if (ghost.peek()) {
      if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); takeGhost(); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); ghost.set(null); close(); return; }
      if (!mod && e.key.length > 1) ghost.set(null); // the caret moves: the ghost goes
    }
    if (mod && e.code === "Space" && on("suggest")) { e.preventDefault(); ask(true); return; }
    if (e.key === "F9" && props.onGutter) { e.preventDefault(); props.onGutter(input.value.slice(0, input.selectionStart ?? 0).split("\n").length, e); return; }
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s" && on("save")) { e.preventDefault(); props.onSave!(input.value); return; }
    hideHover();
    const k = e.key.toLowerCase(), multi0 = props.multiline !== false;
    if (mod && !e.altKey && hist && on("undo") && (k === "z" || e.code === "KeyZ" || k === "y" || e.code === "KeyY")) {
      e.preventDefault();
      history((k === "z" || e.code === "KeyZ") && !e.shiftKey);
      return;
    }
    if (mod && !e.altKey && !e.shiftKey && (k === "f" || e.code === "KeyF") && on("find")) { e.preventDefault(); close(); openFind("find"); return; }
    if (mod && !e.altKey && (k === "h" || e.code === "KeyH") && on("replace") && !ro()) { e.preventDefault(); close(); openFind("replace"); return; }
    if (mod && !e.altKey && !e.shiftKey && (k === "g" || e.code === "KeyG") && on("goToLine") && multi0) { e.preventDefault(); close(); openFind("line"); return; }
    if (e.key === "F3" && fs.text.peek() && on("find")) { e.preventDefault(); if (!finding()) fs.mode.set("find"); nextMatch(e.shiftKey); return; }
    if (e.key === "F12" && !e.shiftKey && props.definition && on("definition")) { e.preventDefault(); close(); void goDefinition(input.selectionStart ?? 0); return; }
    if (e.key === "F2" && props.rename && on("rename")) { e.preventDefault(); close(); void startRename(); return; }
    if (e.shiftKey && e.altKey && !mod && e.code === "KeyF" && props.format && on("format")) { e.preventDefault(); close(); void formatAll(); return; }
    if (mod && !e.altKey && on("zoom")) {
      const z = e.key === "=" || e.key === "+" || e.code === "NumpadAdd" ? 1 : e.key === "-" || e.code === "NumpadSubtract" ? -1 : e.key === "0" || e.code === "Numpad0" ? 0 : null;
      if (z !== null) { e.preventDefault(); zoom(z); return; }
    }
    if (fixList.peek()) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") return; // the fix list's keys
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fixList.set(null); return; }
      fixList.set(null);
    }
    if (mod && !e.altKey && e.key === "." && props.fixes) { e.preventDefault(); void openFixes(input.selectionStart ?? 0); return; }
    if (refs.peek()) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") return; // the list's keys
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); refs.set(null); return; }
      refs.set(null);
    }
    if (e.key === "F12" && e.shiftKey && props.references) { e.preventDefault(); void openRefs(input.selectionStart ?? 0); return; }
    // more carets
    if (mod && !e.altKey && !e.shiftKey && (e.key.toLowerCase() === "d" || e.code === "KeyD") && multiOn()) { e.preventDefault(); close(); selectNext(); return; }
    if (mod && e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp") && multiOn()) { e.preventDefault(); close(); addLine(e.key === "ArrowDown" ? 1 : -1); return; }
    if (extra.peek().length) {
      if (e.key === "Escape" && !done.peek()) { e.preventDefault(); e.stopPropagation(); dropMulti(); return; }
      if (/^(Arrow|Home|End|Page)/.test(e.key) && !done.peek()) dropMulti();
      if (e.key === "Tab" && !done.peek() && !ghost.peek()) { e.preventDefault(); editEach(() => " ".repeat(props.tabSize ?? 2)); return; }
    }
    const d = done.peek();
    if (d) {
      // the arrows and Enter belong to the suggestion list (OptionList listens on this field); Tab picks too
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") return;
      if (e.key === "Tab") { e.preventDefault(); pick(active.peek()); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    }
    if (e.key === "Escape" && sig.peek()) { e.preventDefault(); e.stopPropagation(); closeSignature(); return; }
    if (e.key === "Escape" && fs.mode.peek()) { e.preventDefault(); e.stopPropagation(); closeFind(); return; }
    if (e.key === "Escape" && on("release")) { free = true; return; }
    if (e.key === "Tab" && free) { free = false; return; }
    free = false;
    if (e.key === "Enter" && props.multiline === false) { e.preventDefault(); return; }
    if (ro() || e.isComposing) return;
    const multi = props.multiline !== false;
    // a typed character (AltGr, which is Ctrl + Alt on Windows, writes { [ ] } on many keyboards)
    const plain = e.key.length === 1 && (!mod || (e.ctrlKey && e.altKey) || !!e.getModifierState?.("AltGraph"));
    if (plain && flag(props.autoClose) && (PAIRS[e.key] || ")]}>".includes(e.key)) && typePair(e.key)) { e.preventDefault(); return; }
    if (e.key === "Backspace" && !mod && !e.altKey && flag(props.autoClose)) {
      const s = input.selectionStart ?? 0;
      if (s === (input.selectionEnd ?? s) && pairAround(input.value, s) && !inText(s - 1)) { e.preventDefault(); replace(s - 1, s + 1, "", s - 1); ask(false); return; }
    }
    if (e.key === "Tab" && !mod && !e.altKey && on(e.shiftKey ? "outdent" : "indent")) { e.preventDefault(); indent(e.shiftKey); return; }
    if (e.key === "Enter" && !mod && !e.shiftKey && !e.altKey && multi && on("newline")) { e.preventDefault(); newline(); return; }
    if (mod && !e.altKey && (e.key === "/" || e.code === "Slash") && on("comment")) { if (comment()) e.preventDefault(); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === "k" && multi && on("deleteLine")) { e.preventDefault(); deleteLines(); return; }
    if (e.altKey && !mod && (e.key === "ArrowUp" || e.key === "ArrowDown") && multi) {
      const up = e.key === "ArrowUp";
      if (e.shiftKey && on(up ? "copyUp" : "copyDown")) { e.preventDefault(); copyLines(up); return; }
      if (!e.shiftKey && on(up ? "moveUp" : "moveDown")) { e.preventDefault(); moveLines(up); return; }
    }
  };
  /** Every key, for the shortcuts menu (the ones turned off are left out). */
  const editorKeys = (): CodeShortcut[] => {
    const multi = props.multiline !== false, rows: [CodeCommand | "", string, () => string, boolean?][] = [
      ["indent", "Tab", () => t`Indent (or take the suggestion)`], ["outdent", "Shift+Tab", () => t`Outdent`],
      ["newline", "Enter", () => t`New line, keeping the indent`, multi], ["comment", "Ctrl+/", () => t`Comment / uncomment lines`, !!COMMENT[props.lang ?? "tsx"]],
      ["moveUp", "Alt+↑", () => t`Move lines up`, multi], ["moveDown", "Alt+↓", () => t`Move lines down`, multi],
      ["copyUp", "Shift+Alt+↑", () => t`Copy lines up`, multi], ["copyDown", "Shift+Alt+↓", () => t`Copy lines down`, multi],
      ["deleteLine", "Ctrl+Shift+K", () => t`Delete lines`, multi], ["suggest", "Ctrl+Space", () => t`Suggestions list`, !!props.complete],
      ["find", "Ctrl+F", () => t`Find`], ["replace", "Ctrl+H", () => t`Find / replace`, !ro()], ["find", "F3 / Shift+F3", () => t`Next / previous match`],
      ["goToLine", "Ctrl+G", () => t`Go to line`, multi], ["", "Ctrl+.", () => t`Quick fix`, !!props.fixes], ["", "Shift+F12", () => t`Find all references`, !!props.references], ["definition", "F12 / Ctrl+Click", () => t`Go to definition`, !!props.definition],
      ["rename", "F2", () => t`Rename symbol`, !!props.rename && !ro()], ["format", "Shift+Alt+F", () => t`Format document`, !!props.format && !ro()],
      ["zoom", "Ctrl+= / Ctrl+- / Ctrl+0", () => t`Bigger / smaller / default text`],
      ["save", "Ctrl+S", () => t`Save`], ["", "F9", () => t`Toggle a breakpoint`, !!props.onGutter],
      ["undo", "Ctrl+Z / Ctrl+Y", () => t`Undo / redo`], ["release", "Esc, Tab", () => t`Leave the editor`],
    ];
    return rows.filter(([c, , , ok]) => ok !== false && (!c || on(c))).map(([, keys, label]) => ({ keys, label, group: () => t`Editor` }));
  };
  const input = h("textarea", {
    id: props.id ?? id, name: props.name, class: "m-ced-input", spellcheck: "false", autocapitalize: "off", autocomplete: "off", autocorrect: "off", rows: 1,
    readonly: () => !!props.readonly, disabled: () => !!props.disabled, "aria-label": () => val(props.label) ?? t`Code`,
    "aria-describedby": () => (props.message === false ? null : `${id}-msg`),
    onKeyDown,
    onInput: (e: Event) => {
      if (editing) return;
      ghost.set(null); set(input.value); readSel();
      if (linked) followTag();
      const ie = e as InputEvent, typed = ie.inputType === "insertText" ? ie.data ?? "" : "";
      ask(false, typed);
      // the signature: opened by ( and , ; followed while it is open (the argument moves, ")" ends the call)
      if (/[(,]$/.test(typed) || sig.peek()) askSignature();
    },
    onKeyUp: (e: KeyboardEvent) => { readSel(); if (sig.peek() && /^(Arrow|Home|End|Page)/.test(e.key)) askSignature(); },
    onMousedown: (e: MouseEvent) => { altFrom = e.altKey && multiOn() ? primary() : null; },
    onClick: (e: MouseEvent) => {
      // Alt+click: one more caret (the one before stays); a plain click: one caret again
      if (altFrom) { const keep = altFrom; altFrom = null; extra.set([...extra.peek(), keep]); }
      else dropMulti();
      close(); ghost.set(null); readSel();
      if ((e.ctrlKey || e.metaKey) && props.definition && on("definition")) { void goDefinition(input.selectionStart ?? 0); return; }
      if (sig.peek()) askSignature();
    },
    onPaste,
    // the selection before a typed change; the browser's own undo (its menu, a gesture) goes to the editor's
    onBeforeinput: (e: InputEvent) => {
      if (hist && (e.inputType === "historyUndo" || e.inputType === "historyRedo")) { e.preventDefault(); history(e.inputType === "historyUndo"); return; }
      // more carets: the change happens at each of them
      if (extra.peek().length && !ro()) {
        const kind = e.inputType;
        if (kind === "insertText" || kind === "insertLineBreak" || kind === "deleteContentBackward" || kind === "deleteContentForward") {
          e.preventDefault();
          const text = kind === "insertText" ? e.data ?? "" : kind === "insertLineBreak" ? "\n" : "";
          editEach(() => text, kind === "deleteContentBackward" ? -1 : kind === "deleteContentForward" ? 1 : 0);
          return;
        }
      }
      selBefore ??= [input.selectionStart ?? 0, input.selectionEnd ?? input.selectionStart ?? 0];
      // typing in a tag's name: remember its pair (followTag renames it after the change)
      const a = input.selectionStart ?? 0, b = input.selectionEnd ?? a;
      linked = null;
      if (val(props.linkedTags) !== false && LINKED_LANG.test(props.lang ?? "tsx") && /^(insertText|deleteContent)/.test(e.inputType)) {
        const p = tagPair(input.value, a);
        if (p && b <= p.self[1] && (e.inputType !== "deleteContentBackward" || a > p.self[0] || b > a) && (e.inputType !== "insertText" || /^[\w$.:-]+$/.test(e.data ?? ""))) linked = { value: input.value, ...p };
      }
    },
    onPointermove: onPointerMove,
    onPointerleave: () => { clearTimeout(hoverTimer); hideTimer = setTimeout(() => hoverDoc.set(null), 250); },
    onFocus: () => { focused.set(true); readSel(); globalThis.document.addEventListener("selectionchange", onSelChange); },
    onBlur: (e: FocusEvent) => { close(); ghost.set(null); closeSignature(); focused.set(false); globalThis.document.removeEventListener("selectionchange", onSelChange); props.onBlur?.(e); },
  }) as HTMLTextAreaElement;
  syncValue(input, get);

  // ---- undo: every change of the value is a step (typing, the editor's commands, a value set from outside); the
  // editor's own history, so it outlives the text field (and, with a key, the page)
  const hist = props.history === false ? null : createHistory({ limit: props.history?.limit, key: props.history?.key });
  const keep = (): void => { if (hist && props.history && props.history.key) { clearTimeout(saveTimer); saveTimer = setTimeout(() => hist.save(known), 400); } };
  let known = untrack(get), applying = false, saveTimer: ReturnType<typeof setTimeout> | undefined;
  hist?.load(known);
  effect(() => {
    const v = get();
    untrack(() => {
      if (v === known) return;
      if (hist && !applying) {
        const after = globalThis.document?.activeElement === input ? [input.selectionStart ?? 0, input.selectionEnd ?? input.selectionStart ?? 0] as const : null;
        hist.record(known, v, selBefore ?? sel.peek(), after);
      }
      known = v; selBefore = null;
      keep();
    });
  });
  const history = (back: boolean): void => {
    if (!hist || ro()) return;
    const r = back ? hist.undo(input.value) : hist.redo(input.value);
    if (!r) return;
    close(); ghost.set(null);
    known = r.value; applying = true;
    input.value = r.value; set(r.value);
    applying = false;
    input.setSelectionRange(r.sel[0], r.sel[1]); readSel(); reveal(r.sel[0]);
    keep();
  };
  onCleanup(() => { if (hist && props.history && props.history.key) { clearTimeout(saveTimer); hist.save(known); } });
  props.inputRef?.(input);

  const anchor = virtualAnchor(caretRect, () => input);
  const open = computed(() => !!done());
  // the row picked out: its definition under the list (its own `doc`, or `describe` asked once per row)
  const detail = signal<{ key: string; doc: CodeDoc | null } | null>(null);
  effect(() => {
    const d = done(), it = shown()[active()];
    if (!d || !it) { detail.set(null); return; }
    const key = `${d.from}:${it.source ?? ""}:${it.label}`;
    if (untrack(detail)?.key === key) return;
    if (it.doc) { detail.set({ key, doc: it.doc }); return; }
    if (!props.describe) { detail.set(null); return; }
    const r = props.describe(it, { value: input.value, at: d.to });
    if (r && typeof (r as Promise<unknown>).then === "function") {
      detail.set({ key, doc: null });
      void (r as Promise<CodeDoc | null | undefined>).then((doc) => { if (detail.peek()?.key === key) detail.set({ key, doc: doc ?? null }); }, () => undefined);
    } else detail.set({ key, doc: (r as CodeDoc | null | undefined) ?? null });
  });
  const docView = (doc: CodeDoc, cls: string): unknown => h("div", { class: cx("m-ced-doc", cls) },
    doc.kind || doc.signature ? h("div", { class: "m-ced-doc-head" }, doc.kind ? h("span", { class: "m-ced-doc-kind" }, doc.kind) : null, doc.signature ? h("code", { class: "m-ced-doc-sig" }, doc.signature) : null) : null,
    doc.doc ? h("p", { class: "m-ced-doc-text" }, doc.doc) : null,
    doc.list?.length ? h("ul", { class: "m-ced-doc-list" }, doc.list.map((x) => h("li", {}, h("code", {}, x.label), x.doc ? h("span", {}, x.doc) : null))) : null);
  const detailPane = (): unknown => { const doc = detail()?.doc; return doc && (doc.signature || doc.doc) ? docView(doc, "is-row") : null; };
  // the signature: the overload that fits, its parameters with the one being written lit, then that parameter's text
  const sigAnchor = virtualAnchor(() => rectAt(input.selectionStart ?? 0), () => input);
  const sigView = (): unknown => {
    const r = sig();
    if (!r) return null;
    const it = r.items[Math.min(Math.max(r.active, 0), r.items.length - 1)]!, arg = r.arg, param = it.params[arg];
    return h("div", { class: "m-ced-sig", role: "status", "aria-live": "polite" },
      h("code", { class: "m-ced-sig-line" },
        r.items.length > 1 ? h("span", { class: "m-ced-sig-count" }, `${r.active + 1}/${r.items.length}`) : null,
        it.prefix, it.params.map((p, i) => [i ? it.separator : null, h("span", { class: cx("m-ced-sig-param", i === arg && "is-on") }, p.label)]), it.suffix),
      param?.doc ? h("p", { class: "m-ced-sig-doc" }, h("b", {}, param.label.split(/[?:]/)[0] ?? ""), " — ", param.doc) : null,
      it.doc ? h("p", { class: "m-ced-sig-about" }, it.doc) : null);
  };
  const sigPop = h(Popover, {
    anchor: () => sigAnchor, open: () => !!sig(), onOpenChange: (o: boolean) => { if (!o) closeSignature(); }, role: null, flush: true, autoFocus: false, placement: "top-start", panelClass: "m-ced-sig-panel",
    children: () => [sigView],
  });
  const refAnchor = virtualAnchor(() => { const r = refs(); return r ? rectAt(r.at) : null; }, () => input);
  const refPop = h(Popover, {
    anchor: () => refAnchor, open: () => !!refs(), onOpenChange: (o: boolean) => { if (!o) refs.set(null); }, role: null, flush: true, autoFocus: false, placement: "bottom-start", panelClass: "m-ced-list m-ced-refs",
    children: () => [h("div", { class: "m-ced-fixes-head" }, () => t("{n} references", { n: refs()?.items.length ?? 0 })), h(OptionList<number>, {
      id: `${id}-refs`, keysFrom: input, active: refActive, inline: true, check: false, size: "sm", label: () => t`References`, empty: false,
      options: () => { const v = get(); return (refs()?.items ?? []).map((r, i) => { const l = lineOf(v, r.from); return { value: i, label: l.text || " ", hint: `${r.write ? `${t`written`} · ` : ""}${l.n}` }; }); },
      onPick: (i: number) => goRef(i),
    })],
  });
  const fixAnchor = virtualAnchor(() => { const f = fixList(); return f ? rectAt(f.at) : null; }, () => input);
  const fixPop = h(Popover, {
    anchor: () => fixAnchor, open: () => !!fixList(), onOpenChange: (o: boolean) => { if (!o) fixList.set(null); }, role: null, flush: true, autoFocus: false, placement: "bottom-start", panelClass: "m-ced-list m-ced-fixes",
    children: () => [h("div", { class: "m-ced-fixes-head" }, t`Quick fixes`), h(OptionList<number>, {
      id: `${id}-fixes`, keysFrom: input, active: fixActive, inline: true, check: false, size: "sm", label: () => t`Quick fixes`, empty: false,
      options: () => (fixList()?.items ?? []).map((f, i) => ({ value: i, label: f.title })),
      onPick: (i: number) => applyFix(i),
    })],
  });
  const list = h(Popover, {
    anchor: () => anchor, open: () => open(), onOpenChange: (o: boolean) => { if (!o) close(); }, role: null, flush: true, autoFocus: false, placement: "bottom-start", panelClass: "m-ced-list",
    children: (_close: unknown) => [() => (groupsOf().length > 1 ? groupBar() : null), h(OptionList<number>, {
      id: `${id}-list`, keysFrom: input, active, inline: true, check: false, size: "sm", label: () => val(props.suggestionsLabel) ?? t`Suggestions`, empty: false,
      options: () => shown().map((it, i) => ({ value: i, label: it.label, hint: it.hint, group: it.group })),
      onPick: (i: number) => { pick(i); input.focus(); },
    }), detailPane, props.sources?.length ? () => (done()?.all ? null : sourceBar()) : null],
  });
  // the group chips over a list with headings (March, Ortak, HTML…): one group's rows, or every row; a press keeps the
  // focus in the text (the list stays open, typing still narrows it)
  const groupBar = (): unknown => h("div", { class: "m-ced-groups", role: "group", "aria-label": t`Suggestion group`, onPointerdown: (e: Event) => e.preventDefault() },
    ["", ...groupsOf()].map((g) => h(Chip, {
      size: "sm", selected: () => groupPick() === g, children: g || t`All`,
      onClick: () => { groupPick.set(g); active.set(0); },
    })));
  // the chips under the list; a press keeps the focus in the text (the list stays open)
  const sourceBar = (): unknown => h("div", { class: "m-ced-sources", role: "group", "aria-label": t`Suggestion source`, onPointerdown: (e: Event) => e.preventDefault() },
    (props.sources ?? []).map((s) => h(Chip, {
      size: "sm", selected: () => chosen() === s.value, children: s.label,
      onClick: () => { chosen.set(s.value); active.set(0); props.onSourceChange?.(s.value); },
    })),
    () => (done() && !shown().length ? h("span", { class: "m-ced-none" }, t`No suggestions here`) : null));

  // the gutter's press area, over the text field's start: the line under the pointer (its number's place)
  const lineAt = (y: number): number => {
    let n = 1;
    for (const el of code.querySelectorAll<HTMLElement>(".m-ced-ln")) { if (el.getBoundingClientRect().top <= y + 1) n = Number(el.dataset["line"]); else break; }
    return n;
  };
  let hover: Element | null = null;
  const unhover = (): void => { hover?.classList.remove("is-hover"); hover = null; };
  const hit = h("span", {
    class: "m-ced-gutter", "aria-hidden": "true",
    onPointerdown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      // a line with a problem: its quick fixes; else the owner's (a breakpoint)
      const n = lineAt(e.clientY), el = code.querySelector(`.m-ced-ln[data-line="${n}"]`);
      if (props.fixes && el?.matches(".is-error, .is-warning")) { const v = input.value.split("\n"); let at = 0; for (let i = 0; i < n - 1; i++) at += v[i]!.length + 1; input.setSelectionRange(at, at); readSel(); void openFixes(at); return; }
      props.onGutter?.(n, e);
    },
    onPointermove: (e: PointerEvent) => { const el = code.querySelector(`.m-ced-ln[data-line="${lineAt(e.clientY)}"]`); if (el !== hover) { unhover(); hover = el; el?.classList.add("is-hover"); } },
    onPointerleave: unhover,
  });
  // the lit line comes into view when it moves
  effect(() => { const a = gutter() ? lit() : null; if (a) queueMicrotask(() => code.querySelector?.(".m-ced-lit")?.scrollIntoView?.({ block: "nearest" })); });
  const status = (): "ok" | "error" | false => { const s = val(props.status); return s === undefined ? "ok" : s; };
  const hint = props.hint === false ? null : props.hint ?? null;
  // the shortcuts menu: the editor's keys, then the app's (grouped), each with its keys
  const keysLabel = (): string => val(props.shortcutsLabel) ?? t`Keyboard shortcuts`;
  const keyRow = (k: CodeShortcut): unknown => h("li", { class: "m-ced-key" },
    h("span", { class: "m-ced-key-what" }, () => val(k.label)),
    h("span", { class: "m-ced-key-keys" }, k.keys.split(/(\s+\/\s+|,\s*)/).map((part) => (/^(\s+\/\s+|,\s*)$/.test(part) ? h("span", { class: "m-ced-key-or" }, part.trim()) : part.split(/\+(?=.)/).map((key, i) => [i ? "+" : null, h(Kbd, {}, key)])))));
  const keysMenu = (): unknown => {
    const groups = new Map<string, CodeShortcut[]>();
    for (const k of [...editorKeys(), ...(val(props.moreShortcuts) ?? [])]) { const g = val(k.group) ?? ""; groups.set(g, [...(groups.get(g) ?? []), k]); }
    return h("div", { class: "m-ced-keys", role: "group", "aria-label": keysLabel },
      [...groups].map(([g, rows]) => h("section", { class: "m-ced-keys-group" }, g ? h("h4", { class: "m-ced-keys-head" }, g) : null, h("ul", { class: "m-ced-keys-list" }, rows.map(keyRow)))));
  };
  const keysButton = props.shortcuts === false ? null : h(Dropdown, { icon: commandIcon, label: keysLabel, variant: "ghost", size: "sm", placement: "top-end", class: "m-ced-keys-btn", panelClass: "m-ced-keys-panel", children: () => keysMenu() });
  const foot = props.message === false ? undefined : h("span", { class: () => cx("m-ced-msg", status() === "error" && "is-error"), id: `${id}-msg`, role: "status", "aria-live": "polite" },
    () => (status() === false ? null : h(StatusDot, { tone: untrack(status) === "error" ? "warn" : "success", size: "sm" })),
    props.onMessage
      ? h("button", { type: "button", class: "m-ced-msg-text is-button", onClick: () => props.onMessage!() }, () => val(props.message))
      : h("span", { class: "m-ced-msg-text" }, () => val(props.message)));
  // the find bar (made once, kept while it is open)
  let bar: Element | null = null;
  const barOpen = computed(() => !!fs.mode());
  const barNode = (): unknown => (barOpen() ? (bar ??= findBar({
    state: fs,
    count: () => { const n = matches().length; return n ? `${current() + 1}/${n >= 5000 ? "5000+" : n}` : t`No results`; },
    next: nextMatch, replaceOne, replaceAll, goLine, close: closeFind,
    fieldRef: (el, which) => { if (which === "line") lineField = el; else findField = el; },
  })) : null);
  // the hover's and the note's popover (over the word), the rename field (under the name)
  const tipAnchor = virtualAnchor(() => { const x = hoverDoc() ?? null, n = note(); return x ? wordRect(x.from, x.to) : n ? rectAt(n.at) : null; }, () => input);
  const tipPop = h(Popover, {
    anchor: () => tipAnchor, open: () => !!(hoverDoc() || note()), onOpenChange: (o: boolean) => { if (!o) { hideHover(); note.set(null); } }, role: null, flush: true, autoFocus: false, placement: "top-start", panelClass: "m-ced-tip-panel",
    children: () => [() => { const d = hoverDoc()?.doc ?? note()?.doc; return d ? h("div", { onPointerenter: () => clearTimeout(hideTimer), onPointerleave: () => { hideTimer = setTimeout(() => hoverDoc.set(null), 250); } }, docView(d, "is-tip")) : null; }],
  });
  const renameAnchor = virtualAnchor(() => { const r = renaming(); return r ? rectAt(r.from) : null; }, () => input);
  const renamePop = h(Popover, {
    anchor: () => renameAnchor, open: () => !!renaming(), onOpenChange: (o: boolean) => { if (!o && renaming.peek()) { renaming.set(null); input.focus({ preventScroll: true }); } }, role: null, flush: true, autoFocus: false, placement: "bottom-start", panelClass: "m-ced-rename-panel",
    children: () => [() => {
      const r = renaming();
      if (!r) return null;
      return h("div", { class: "m-ced-rename" },
        h(TextInput, {
          value: r.name, class: "m-ced-rename-field", "aria-label": t`New name`, autocomplete: "off", spellcheck: "false",
          ref: (el: HTMLInputElement) => queueMicrotask(() => { el.focus(); el.select?.(); }),
          onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); applyRename(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); renaming.set(null); input.focus({ preventScroll: true }); } },
        }),
        h("span", { class: "m-ced-rename-hint" }, `${r.locations.length > 1 ? `${t`${r.locations.length} places`} · ` : ""}${t`Enter: rename, Esc: cancel`}`));
    }],
  });
  const area = h("div", {
    class: () => cx("m-ced-area", hoverDoc() && "is-hovering"),
    // a press on the empty room under the last line: the caret goes to the end (as in an IDE)
    onPointerdown: (e: PointerEvent) => {
      if (e.target !== area || e.button !== 0 || props.disabled) return;
      e.preventDefault(); input.focus({ preventScroll: true });
      const end = input.value.length; input.setSelectionRange(end, end); readSel();
    },
  }, deco, pre, input, () => (gutter() ? hit : null)) as HTMLElement;
  // ---- sticky scroll: the lines that open the blocks around the first line on screen (up to 3, innermost last)
  const stuck = signal<readonly { at: number; n: number; text: string }[]>([]);
  let stickyQueued = false;
  const updateSticky = (): void => {
    stickyQueued = false;
    if (!gutter() || val(props.stickyScroll) === false || area.scrollTop < 4) { if (stuck.peek().length) stuck.set([]); return; }
    const top = area.scrollTop;
    let first = 1;
    for (const el of code.querySelectorAll<HTMLElement>(".m-ced-ln")) { if (el.offsetTop + 2 >= top) { first = Number(el.dataset["line"]); break; } }
    const v = get(), lines = v.split("\n");
    let topAt = 0;
    for (let i = 0; i < first - 1 && i < lines.length; i++) topAt += lines[i]!.length + 1;
    const lineAtPos = (pos: number): number => v.slice(0, pos).split("\n").length;
    const seen = new Set<number>(), out: { at: number; n: number; text: string }[] = [];
    const opens = [...brackets().mate].filter(([o, c]) => o < c && o < topAt && c >= topAt && "{([".includes(v[o] ?? "")).sort((x, y) => x[0] - y[0]);
    for (const [o] of opens) {
      const n = lineAtPos(o);
      if (n >= first || seen.has(n)) continue;
      seen.add(n);
      const ls = v.lastIndexOf("\n", o - 1) + 1, le = v.indexOf("\n", o);
      const text = v.slice(ls, le < 0 ? v.length : le);
      if (!text.trim()) continue;
      out.push({ at: ls, n, text: text.length > 160 ? `${text.slice(0, 159)}…` : text });
    }
    const keep = out.slice(-3);
    const cur = stuck.peek();
    if (keep.length !== cur.length || keep.some((x, i) => x.n !== cur[i]?.n || x.text !== cur[i]?.text)) stuck.set(keep);
  };
  const queueSticky = (): void => { if (stickyQueued) return; stickyQueued = true; measure(updateSticky); };
  area.addEventListener("scroll", queueSticky, { passive: true });
  effect(() => { get(); untrack(queueSticky); });
  const stickyBar = (): unknown => (stuck().length ? h("div", { class: "m-ced-sticky", "aria-hidden": "true" },
    stuck().map((s) => h("div", { class: "m-ced-sticky-line", onPointerdown: (e: PointerEvent) => {
      e.preventDefault(); input.focus({ preventScroll: true }); input.setSelectionRange(s.at, s.at); readSel();
      const el = code.querySelector<HTMLElement>(`.m-ced-ln[data-line="${s.n}"]`); if (el) area.scrollTop = Math.max(0, el.offsetTop - 4);
    } }, h("span", { class: "m-ced-sticky-n" }, String(s.n)), h("span", { class: "m-ced-sticky-text" }, s.text)))) : null);
  // the text size and line height (Ctrl + = / - / 0)
  effect(() => {
    const px = size(), lh = val(props.lineHeight);
    if (px) area.style.setProperty("--m-ced-size", `${px}px`); else area.style.removeProperty("--m-ced-size");
    if (lh) area.style.setProperty("--m-ced-lh", String(lh)); else area.style.removeProperty("--m-ced-lh");
  });
  onCleanup(() => { globalThis.document?.removeEventListener?.("selectionchange", onSelChange); clearTimeout(hoverTimer); clearTimeout(hideTimer); clearTimeout(noteTimer); });
  return h(EditorFrame, {
    class: () => cx("m-ced", gutter() && "is-gutter", val(props.palette) !== "theme" && "is-ide", val(props.class)), disabled: () => !!props.disabled, readonly: () => !!props.readonly,
    foot, showFoot: props.message !== false,
    footProps: { class: "m-ced-foot", divider: true, actions: [hint, keysButton, props.copy !== false && h(CopyButton, { text: get, iconOnly: true, class: "m-ced-copy", ...(props.copyLabel != null ? { label: props.copyLabel } : {}) })] },
    children: [h("div", { class: "m-ced-body" }, barNode, stickyBar, area), list, fixPop, refPop, sigPop, tipPop, renamePop] }) as Element;
}
