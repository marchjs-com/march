// march/mask engine: pattern language, caret tables (insert, Backspace / Delete over literals, selection replace,
// paste), number / date / dynamic kinds, presets and validators (test cards and format-valid fake ids only).
import { test } from "node:test";
import assert from "node:assert/strict";
import { pattern, dynamic, compile, formatMask, unmask, maskInfo, rawAt, displayAt, number, date, time, text } from "./index.ts";
import { luhn, iban, tcKimlik, vkn, email, url, ipv4, ipv6 } from "./validators.ts";
import * as P from "./presets.ts";

const PHONE = "(999) 999 99 99";
// apply an edit like the input controller: display selection [s, e] → raw, insert, back to display
function edit(spec, display, s, e, typed, kind = "insert") {
  const m = compile(spec);
  const f = m.format(m.parse(display));
  let a = rawAt(f, s), b = rawAt(f, e);
  if (kind === "back" && a === b) a = Math.max(0, a - 1);
  if (kind === "del" && a === b) b = a + 1;
  const r = m.insert(f.raw, a, b, typed);
  if (!r) return null;
  const g = m.format(r.raw);
  return { text: g.text, caret: kind === "insert" ? displayAt(g, r.at) : kind === "back" ? g.pos[a] ?? g.text.length : displayAt(g, a) };
}

test("pattern: format, raw, completeness, lazy literals", () => {
  const m = compile(PHONE);
  assert.deepEqual(m.format("555"), { text: "(555", raw: "555", complete: false, pos: [1, 2, 3], rest: ") ___ __ __" });
  assert.equal(m.format("5551").text, "(555) 1");
  assert.equal(m.format("5551234567").text, "(555) 123 45 67");
  assert.equal(m.format("5551234567").complete, true);
  assert.equal(formatMask("5551234567", PHONE), "(555) 123 45 67");
  assert.equal(unmask("(555) 123-45 67", PHONE), "5551234567");
  assert.equal(m.format("").rest, "(___) ___ __ __");
  assert.equal(compile({ mask: "99.99.9999", template: "GG.AA.YYYY" }).format("12").rest, ".AA.YYYY");
});

test("pattern: tokens, optional parts, repeats, escapes, arrays", () => {
  assert.equal(formatMask("ab12", "AA-99"), "AB-12");
  assert.equal(formatMask("istanbul", { mask: "AAA", locale: "tr" }), "İST");
  assert.equal(formatMask("12345", "99999[-9999]"), "12345");
  assert.equal(formatMask("123456789", "99999[-9999]"), "12345-6789");
  assert.equal(compile("99999[-9999]").format("12345").complete, true);
  assert.equal(formatMask("1234", "9{2,4}"), "1234");
  assert.equal(formatMask("12", "\\9\\a 99"), "9a 12");
  assert.equal(formatMask("123", ["(", /\d/, /\d/, ")", " ", /\d/]), "(12) 3");
  assert.equal(formatMask("ff00aa", { mask: "#HHHHHH", tokens: { H: { test: /[0-9a-f]/i, transform: (c) => c.toUpperCase() } } }), "#FF00AA");
});

test("caret: typing, Backspace over literals, Delete, selection replace, paste", () => {
  // type a digit at the end: the pending literal joins
  assert.deepEqual(edit(PHONE, "(555", 4, 4, "1"), { text: "(555) 1", caret: 7 });
  // Backspace right after a literal removes the digit before it
  assert.deepEqual(edit(PHONE, "(555) 1", 6, 6, "", "back"), { text: "(551", caret: 3 });
  assert.deepEqual(edit(PHONE, "(555) 123", 7, 7, "", "back"), { text: "(555) 23", caret: 6 });
  // Delete before a literal removes the next digit
  assert.deepEqual(edit(PHONE, "(555) 123", 4, 4, "", "del"), { text: "(555) 23", caret: 4 });
  // insert in the middle pushes the rest
  assert.deepEqual(edit(PHONE, "(555) 123", 2, 2, "9"), { text: "(595) 512 3", caret: 3 });
  // selection replace
  assert.deepEqual(edit(PHONE, "(555) 123 45 67", 1, 4, "321"), { text: "(321) 123 45 67", caret: 4 });
  // paste with its own literals and junk
  assert.deepEqual(edit(PHONE, "", 0, 0, "(212) 444-55 66"), { text: "(212) 444 55 66", caret: 15 });
  // a refused character
  assert.equal(edit(PHONE, "(555", 4, 4, "x"), null);
  // a typed literal where it belongs is taken
  assert.deepEqual(edit("99-99", "12", 2, 2, "-"), { text: "12", caret: 2 });
});

test("number kind: separators, sign, decimals, max, caret", () => {
  const m = number({ decimals: 2, locale: "tr", negative: true, max: 1e6 });
  assert.equal(m.format("1234567.5").text, "1.234.567,5");
  assert.equal(m.parse("1.234,56"), "1234.56");
  assert.equal(m.parse("1,234.56"), "1234.56");
  let r = m.insert("123", 3, 3, "4");
  assert.deepEqual(r, { raw: "1234", at: 4 });
  assert.equal(m.format(r.raw).text, "1.234");
  r = m.insert("1234", 4, 4, ",");
  assert.deepEqual(r, { raw: "1234.", at: 5 });
  assert.equal(m.insert("1234.56", 7, 7, "7"), null); // past the decimals
  assert.equal(m.insert("999999", 6, 6, "9"), null); // past max
  r = m.insert("1234", 2, 2, "-");
  assert.equal(r.raw, "-1234");
  assert.equal(m.insert("-1234", 3, 3, "-").raw, "1234");
  assert.equal(m.commit("1234."), "1234");
  const money = number({ decimals: 2, fixed: true, prefix: "₺", locale: "tr" });
  assert.equal(money.format(money.commit("12.5")).text, "₺12,50");
  // Backspace over a group separator removes the digit before it
  const f = m.format("1234");
  assert.equal(rawAt(f, 2), 1);
});

test("date kind: real validation, padding, ISO value", () => {
  const d = date({ format: "DD.MM.YYYY", locale: "tr" });
  assert.equal(d.hint, "GG.AA.YYYY");
  assert.equal(d.insert("", 0, 0, "4").raw, "04"); // padded day
  assert.equal(d.insert("31", 2, 2, "1").raw, "311");
  assert.equal(d.insert("31", 2, 2, "2"), null); // 31.02 (padded) refused
  assert.equal(d.insert("300", 3, 3, "2"), null); // 30.02 refused
  assert.equal(d.insert("121", 3, 3, "3"), null); // month 13 refused
  assert.equal(d.insert("2902202", 7, 7, "3"), null); // 29.02.2023 is not a date
  assert.equal(d.insert("29022", 5, 5, "024").raw, "29022024");
  assert.equal(d.toValue("25112026", d.format("25112026")), "2026-11-25");
  assert.equal(d.fromValue("2026-11-25"), "25112026");
  const tm = time();
  assert.equal(tm.insert("", 0, 0, "7").raw, "07");
  assert.equal(tm.insert("2", 1, 1, "5"), null); // 25 h
  assert.equal(tm.insert("23", 2, 2, "7"), null); // 7x minutes
  assert.equal(tm.toValue("2359", tm.format("2359")), "23:59");
  assert.equal(date({ locale: "en-US" }).hint, "MM/DD/YYYY");
});

test("dynamic masks: card types", () => {
  const c = P.cardNumber();
  assert.equal(c.format("378282246310005").text, "3782 822463 10005");
  assert.equal(c.format("4242424242424242").text, "4242 4242 4242 4242");
  assert.equal(c.pick("37").name, "amex");
  const r = c.insert("3782822463100", 13, 13, "05");
  assert.equal(c.format(r.raw).text, "3782 822463 10005");
  assert.equal(maskInfo("4242424242424242", c).error, null);
  assert.ok(maskInfo("4242424242424241", c).error);
  const dyn = dynamic((raw) => (raw.startsWith("1") ? "9-9-9" : "99 99"));
  assert.equal(formatMask("123", dyn), "1-2-3");
  assert.equal(formatMask("234", dyn), "23 4");
});

test("validators: test cards, IBAN, fake TC kimlik / VKN, e-mail, URL, IP", () => {
  for (const n of ["4242424242424242", "4111 1111 1111 1111", "5555555555554444", "378282246310005", "6011111111111117"]) assert.ok(luhn(n), n);
  assert.ok(!luhn("4242424242424241"));
  assert.ok(iban("TR33 0006 1005 1978 6457 8413 26"));
  assert.ok(iban("GB82 WEST 1234 5698 7654 32"));
  assert.ok(iban("DE89370400440532013000"));
  assert.ok(!iban("TR33 0006 1005 1978 6457 8413 27"));
  assert.ok(!iban("DE8937040044053201300")); // wrong length
  // format-valid fake identity numbers (generated, nobody's data)
  assert.ok(tcKimlik("10000000146"));
  assert.ok(!tcKimlik("10000000145"));
  assert.ok(!tcKimlik("01234567890"));
  const fakeVkn = (p) => { for (let d = 0; d < 10; d++) if (vkn(p + d)) return p + d; return null; };
  const v = fakeVkn("123456789");
  assert.ok(v && vkn(v));
  assert.ok(!vkn(v.slice(0, 9) + String((Number(v[9]) + 1) % 10)));
  assert.ok(email("ada@example.com"));
  assert.ok(!email("ada@example"));
  assert.ok(!email("a da@example.com"));
  assert.ok(url("https://marchjs.com/x"));
  assert.ok(!url("javascript:alert(1)"));
  assert.ok(!url("http://example.com", { https: true }));
  assert.ok(ipv4("192.168.0.1"));
  assert.ok(!ipv4("256.1.1.1"));
  assert.ok(ipv6("2001:db8::1"));
  assert.ok(ipv6("::ffff:192.168.0.1"));
  assert.ok(!ipv6("2001:db8::1::2"));
});

test("presets", () => {
  const ph = P.phoneTR();
  assert.equal(formatMask("+90 555 123 45 67", ph), "(555) 123 45 67");
  assert.equal(formatMask("05551234567", ph), "(555) 123 45 67");
  assert.deepEqual(ph.insert("", 0, 0, "0"), { raw: "", at: 0 }); // the habit 0 is ignored
  assert.equal(ph.toValue("5551234567"), "+905551234567");
  assert.equal(formatMask("34abc123", P.plateTR()), "34 ABC 123");
  assert.equal(formatMask("06a1234", P.plateTR()), "06 A 1234");
  assert.equal(maskInfo("06a12", P.plateTR()).error != null, true);
  assert.equal(P.plateTR().insert("", 0, 0, "9"), null);
  assert.equal(maskInfo("10000000146", P.tcKimlikNo()).error, null);
  assert.ok(maskInfo("10000000145", P.tcKimlikNo()).error);
  assert.equal(formatMask("TR330006100519786457841326", P.iban()), "TR33 0006 1005 1978 6457 8413 26");
  assert.equal(formatMask("tr330006100519786457841326", P.iban({ country: "TR" })), "TR33 0006 1005 1978 6457 8413 26");
  assert.equal(maskInfo("TR330006100519786457841326", P.iban()).error, null);
  const exp = P.cardExpiry({ now: () => new Date(2026, 10, 25) });
  assert.equal(exp.insert("", 0, 0, "4").raw, "04");
  assert.equal(formatMask("0430", exp), "04/30");
  assert.ok(maskInfo("0125", exp).error);
  const dur = P.duration({ locale: "tr" });
  assert.equal(formatMask("130", dur), "1 sa 30 dk");
  assert.equal(dur.toValue("130"), 90);
  assert.equal(dur.fromValue(90), "130");
  const tr = P.timeRange();
  assert.equal(formatMask("09001730", tr), "09:00 – 17:30");
  assert.ok(maskInfo("17300900", tr).error);
  const money = P.money({ currency: "TRY", locale: "tr" });
  assert.equal(money.format(money.commit("1234.5")).text, "₺1.234,50");
  assert.equal(P.percent({ locale: "tr" }).format("12.5").text, "%12,5");
  assert.equal(P.unit("kilogram", { locale: "en" }).format("12").text, "12 kg");
  assert.equal(formatMask("001a2b3c4d5e", P.macAddress()), "00:1A:2B:3C:4D:5E");
  assert.equal(formatMask("f80", P.hexColor()), "#F80");
  assert.equal(P.ipv4().insert("192.", 4, 4, "1").raw, "192.1");
  assert.equal(P.ipv4().insert("19", 2, 2, "2").raw, "192.");
  assert.equal(formatMask("abcde12345abcde12345", P.licenseKey()), "ABCDE-12345-ABCDE-12345");
  assert.equal(maskInfo("1.2.3", P.semver()).error, null);
  assert.ok(maskInfo("1.2", P.semver()).error);
  assert.equal(maskInfo("ada@example.com", P.email()).error, null);
  assert.equal(formatMask("12345", P.postalCode({ country: "US" })), "12345");
  assert.equal(formatMask("k1a0b1", P.postalCode({ country: "CA" })), "K1A 0B1");
});

test("text kind: filter, case, accept", () => {
  const m = text({ allow: /[a-z]/i, case: "upper", locale: "tr" });
  assert.equal(m.parse("i-ı 1"), "İI");
});
