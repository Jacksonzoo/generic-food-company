import { Sheet, ref } from "./xlsx.js";
import { SKUS, FREIGHT_SOURCES, UNITS_PER_CASE } from "../core/constants.js";
import { isOverride, priceLabel } from "../core/pricing.js";

// Workbook layout for a National Fish & Oyster PO, written for accounts payable
// and auditors to read cold. Every calculated cell is a live formula carrying
// the app's own result as its cached value, so the file shows correct numbers
// in any previewer and recomputes identically in Excel.

// ─── Palette & styles ────────────────────────────────────────────────────────

const C = {
  ink: "1F2933", muted: "6B7280", faint: "A0A7B1", input: "1D4ED8", teal: "0F766E", white: "FFFFFF",
  band: "F3F5F7", tealSoft: "E3F1EF", amberSoft: "FDF1DC", amber: "92400E",
  okSoft: "E6F4EA", ok: "166534", badSoft: "FBE4E2", bad: "B42318",
};

const FMT = {
  money: '"$"#,##0.00',
  money4: '"$"#,##0.0000',
  rate: '"$"#,##0.00##',
  cases: "#,##0.00##",
  int: "#,##0",
  dec2: "#,##0.00",
  pct: "0.0%",
  unit: (d) => `"$"#,##0.${"0".repeat(d)}`,
};

const S = {
  title: { bold: true, size: 16, color: C.ink },
  subtitle: { size: 10, color: C.muted },
  legend: { italic: true, size: 9, color: C.muted },
  section: { bold: true, size: 12, color: C.teal, border: "bottom" },
  label: { color: C.ink, indent: 1 },
  note: { size: 9, color: C.muted },
  th: { bold: true, color: C.white, fill: C.teal, align: "center", wrap: true },
  thLeft: { bold: true, color: C.white, fill: C.teal, align: "left", indent: 1 },
  input: (numFmt) => ({ color: C.input, numFmt, align: "right" }),
  inputText: { color: C.input, align: "right" },
  calc: (numFmt) => ({ color: C.ink, numFmt, align: "right" }),
  text: { color: C.ink, indent: 1 },
  textCenter: { color: C.ink, align: "center" },
  grey: (numFmt) => ({ color: C.faint, numFmt, align: numFmt ? "right" : "left", indent: numFmt ? 0 : 1 }),
  total: (numFmt) => ({ bold: true, color: C.ink, numFmt, fill: C.band, border: "totalTop", align: numFmt ? "right" : "left", indent: numFmt ? 0 : 1 }),
  final: (numFmt) => ({ bold: true, color: C.ink, numFmt, fill: C.tealSoft, align: "right" }),
  override: (numFmt) => ({ color: C.input, numFmt, fill: C.amberSoft, align: "right" }),
  overrideTag: { bold: true, size: 9, color: C.amber, fill: C.amberSoft, align: "center" },
  listTag: { size: 9, color: C.muted, align: "center" },
  emphasis: (numFmt) => ({ bold: true, color: C.ink, numFmt, align: "right" }),
};

const COLS = 9; // A–I

// SKU key → allocation field
const CASES_KEY = { "16oz": "cases16", "10oz": "cases10", "4lb": "cases4", shell: "casesShell" };
const UNIT_PLURAL = { jar: "jars", tub: "tubs", case: "cases" };

/**
 * @param {{ calc: object, input: object, notices: object[], decimals: number, generatedAt?: Date }} model
 * @returns {{ sheets: Sheet[], title: string, created: Date }}
 */
export function buildNfoWorkbook({ calc, input, notices, decimals, generatedAt = new Date() }) {
  const sh = new Sheet("Lot Costs");
  sh.setWidths([30, 11, 8, 13, 14, 13, 16, 20, 14]);
  sh.print = { landscape: true, fitToWidth: true, footer: `&L${footerText(input)}&RPage &P of &N` };

  const { freight, wetlockQty, wetlockUnitPrice, totalCases, items } = input;
  const freightPerCase = calc.freightCost / totalCases;
  const spPerCase = calc.wetlockTotal / totalCases;
  const overrides = SKUS.filter((s) => items[s.qtyKey] > 0 && isOverride(s, items[s.costKey]));
  const linked = totalCases === wetlockQty;

  // Row numbers of cells referenced by formulas further down (or above) are
  // collected here; the sections below are laid out top to bottom.
  const at = {};
  const sectionRow = (title) => {
    sh.skip();
    const r = sh.addRow([{ v: title, style: S.section }], { height: 20 });
    for (let c = 2; c <= COLS; c++) sh.set(c, r, { v: "", style: S.section });
    return r;
  };
  const noteCell = (row, text) => {
    sh.set(3, row, { v: text, style: S.note });
    sh.merge(3, row, COLS, row);
  };

  // ─── Header ────────────────────────────────────────────────────────────────
  const r1 = sh.addRow([{ v: "Landed Cost — National Fish & Oyster", style: S.title }], { height: 26 });
  sh.merge(1, r1, COLS, r1);
  const stamp = generatedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const r2 = sh.addRow([{ v: `PO ${input.po || "(not entered)"}   ·   Generated ${stamp}   ·   Final lot costs for Entree`, style: S.subtitle }]);
  sh.merge(1, r2, COLS, r2);
  at.banner = sh.addRow([], { height: 22 }); // filled in once the tie-out cell exists
  sh.merge(1, at.banner, COLS, at.banner);
  sh.freezeRows = at.banner;
  const r4 = sh.addRow([{ v: "Blue numbers were entered from the paperwork. Black numbers are formulas: change a blue number and the whole sheet recalculates.", style: S.legend }]);
  sh.merge(1, r4, COLS, r4);

  // ─── 1. Shipment & freight ─────────────────────────────────────────────────
  sectionRow("1   Shipment & freight");
  const kv = (label, cell, note, labelStyle = S.label) => {
    const r = sh.addRow([{ v: label, style: labelStyle }, cell]);
    if (note) noteCell(r, note);
    return r;
  };
  const B = (row) => ref(2, row);

  kv("PO number", { v: input.po || "—", style: S.inputText });
  kv("Freight source", { v: sourceLabel(freight.source), style: S.inputText }, sourceNote(freight.source));
  if (freight.mode === "dollars") {
    at.freight = kv("Freight", { v: freight.dollars, style: S.input(FMT.money) }, "Entered directly from the freight invoice");
  } else {
    at.weight = kv("Billing weight (lb)", { v: freight.weight, style: S.input(Number.isInteger(freight.weight) ? FMT.int : FMT.dec2) });
    at.rate = kv("Freight rate ($ per lb)", { v: freight.rate, style: S.input(FMT.rate) });
    at.freight = kv("Freight", { f: `${B(at.weight)}*${B(at.rate)}`, v: calc.freightCost, style: S.calc(FMT.money) }, "Billing weight × freight rate");
  }
  at.wlQty = kv("Wet lock boxes (cases)", { v: wetlockQty, style: S.input(FMT.int) });
  at.wlPrice = kv("Wet lock price ($ per case)", { v: wetlockUnitPrice, style: S.input(FMT.rate) });
  at.sp = kv("Wet lock / SP total", { f: `${B(at.wlQty)}*${B(at.wlPrice)}`, v: calc.wetlockTotal, style: S.calc(FMT.money) }, "Wet lock boxes × price");
  at.total = linked
    ? kv("Total cases shipped", { f: B(at.wlQty), v: totalCases, style: S.calc(FMT.int) }, "Equal to wet lock boxes (one box per case shipped)")
    : kv("Total cases shipped", { v: totalCases, style: S.input(FMT.int) }, `Entered manually; wet lock boxes = ${wetlockQty}`);
  at.pool = kv("Cost pool", { f: `${B(at.freight)}+${B(at.sp)}`, v: calc.pool, style: S.calc(FMT.money) }, "Freight + SP, spread across every case shipped");
  at.frpc = kv("Freight per case", { f: `${B(at.freight)}/${B(at.total)}`, v: freightPerCase, style: S.calc(FMT.money4) }, "Freight ÷ total cases shipped");
  at.sppc = kv("SP per case", { f: `${B(at.sp)}/${B(at.total)}`, v: spPerCase, style: S.calc(FMT.money4) }, "SP total ÷ total cases shipped");

  // ─── 2. Build-up & reconciliation ──────────────────────────────────────────
  sectionRow("2   Build-up & reconciliation");
  const hdr = sh.addRow([
    { v: "Product", style: S.thLeft },
    { v: "Qty", style: S.th },
    { v: "Unit", style: S.th },
    { v: "Base cost / unit", style: S.th },
    { v: "Base total", style: S.th },
    { v: "Cases allocated", style: S.th },
    { f: `"Wet lock (SP)"&CHAR(10)&TEXT(${B(at.sppc)},"$0.0000")&" / case"`, v: `Wet lock (SP)\n$${spPerCase.toFixed(4)} / case`, style: S.th },
    { f: `"Freight"&CHAR(10)&TEXT(${B(at.frpc)},"$0.0000")&" / case"`, v: `Freight\n$${freightPerCase.toFixed(4)} / case`, style: S.th },
    { v: "Landed total", style: S.th },
  ], { height: 32 });

  at.build = {};
  // Case allocation section rows are known only after layout; formulas for
  // "Cases allocated" point there, so compute the target rows in advance.
  const buildStart = hdr + 1;
  const buildEnd = buildStart + SKUS.length - 1;
  const buildTotal = buildEnd + 1;
  const finalSectionTitle = buildTotal + 2;
  const finalHdr = finalSectionTitle + 1;
  const finalStart = finalHdr + 1;
  const finalEnd = finalStart + SKUS.length - 1;
  const tieTitle = finalEnd + 2;
  const tieStart = tieTitle + 1; // 8 tie-out rows
  const allocTitle = tieStart + 8 + 1;
  const allocHdr = allocTitle + 1;
  const allocRows = { "4lb": allocHdr + 1, shell: allocHdr + 2, fixed: allocHdr + 3, retail: allocHdr + 4, "16oz": allocHdr + 5, "10oz": allocHdr + 6, sum: allocHdr + 7 };

  for (const sku of SKUS) {
    const qty = items[sku.qtyKey] ?? 0;
    const cost = items[sku.costKey] ?? 0;
    const cases = calc.allocation[CASES_KEY[sku.key]];
    const on = qty > 0;
    const over = overrides.includes(sku);
    const r = sh.addRow([
      { v: sku.label, style: on ? S.text : S.grey() },
      { v: qty, style: on ? S.input(FMT.int) : S.grey(FMT.int) },
      { v: UNIT_PLURAL[sku.unit], style: on ? S.textCenter : { ...S.grey(), align: "center", indent: 0 } },
      { v: cost, style: over ? S.override(FMT.rate) : on ? S.input(FMT.rate) : S.grey(FMT.rate) },
    ]);
    at.build[sku.key] = r;
    const g = (numFmt) => (on ? S.calc(numFmt) : S.grey(numFmt));
    sh.set(5, r, { f: `B${r}*D${r}`, v: qty * cost, style: g(FMT.money) });
    sh.set(6, r, { f: `B${allocRows[sku.key]}`, v: cases, style: g(FMT.cases) });
    sh.set(7, r, { f: `F${r}*${B(at.sppc)}`, v: cases * spPerCase, style: g(FMT.money) });
    sh.set(8, r, { f: `F${r}*${B(at.frpc)}`, v: cases * freightPerCase, style: g(FMT.money) });
    sh.set(9, r, { f: `E${r}+G${r}+H${r}`, v: qty * cost + cases * (spPerCase + freightPerCase), style: g(FMT.money) });
  }
  const sum = (col) => `SUM(${col}${buildStart}:${col}${buildEnd})`;
  const casesTotal = SKUS.reduce((n, s) => n + calc.allocation[CASES_KEY[s.key]], 0);
  sh.addRow([
    { v: "Total", style: S.total() },
    { v: "", style: S.total() }, { v: "", style: S.total() }, { v: "", style: S.total() },
    { f: sum("E"), v: calc.invoiceTotalNoFreight - calc.wetlockTotal, style: S.total(FMT.money) },
    { f: sum("F"), v: casesTotal, style: S.total(FMT.cases) },
    { f: sum("G"), v: casesTotal * spPerCase, style: S.total(FMT.money) },
    { f: sum("H"), v: casesTotal * freightPerCase, style: S.total(FMT.money) },
    { f: sum("I"), v: calc.expectedLandedTotal, style: S.total(FMT.money) },
  ]);

  // ─── 3. Final lot cost per unit ────────────────────────────────────────────
  sectionRow("3   Final lot cost per unit — enter these in Entree");
  sh.addRow([
    { v: "Product", style: S.thLeft },
    { v: "Qty", style: S.th },
    { v: "Unit", style: S.th },
    { v: "Base cost", style: S.th },
    { v: "+ SP / unit", style: S.th },
    { v: "+ Freight / unit", style: S.th },
    { v: "= Final lot cost", style: S.th },
    { v: "Base price", style: S.th },
    { v: "Uplift", style: S.th },
  ], { height: 22 });

  const unitFmt = FMT.unit(decimals);
  for (const sku of SKUS) {
    const b = at.build[sku.key];
    const qty = items[sku.qtyKey] ?? 0;
    const on = qty > 0;
    const row = calc.results.find((x) => x.sku === sku.label);
    const over = overrides.includes(sku);
    const r = sh.addRow([
      { f: `A${b}`, v: sku.label, style: on ? S.text : S.grey() },
      { f: `B${b}`, v: qty, style: on ? S.calc(FMT.int) : S.grey(FMT.int) },
      { f: `C${b}`, v: UNIT_PLURAL[sku.unit], style: on ? S.textCenter : { ...S.grey(), align: "center", indent: 0 } },
      { f: `D${b}`, v: items[sku.costKey] ?? 0, style: on ? S.calc(unitFmt) : S.grey(unitFmt) },
    ]);
    sh.set(5, r, { f: `IF(B${r}=0,0,G${b}/B${r})`, v: row?.wetlockAddPerUnit ?? 0, style: on ? S.calc(unitFmt) : S.grey(unitFmt) });
    sh.set(6, r, { f: `IF(B${r}=0,0,H${b}/B${r})`, v: row?.freightAddPerUnit ?? 0, style: on ? S.calc(unitFmt) : S.grey(unitFmt) });
    sh.set(7, r, { f: `IF(B${r}=0,"Not on PO",D${r}+E${r}+F${r})`, v: on ? row.finalCost : "Not on PO", style: on ? S.final(unitFmt) : { ...S.grey(), align: "right", indent: 0 } });
    sh.set(8, r, on
      ? { v: over ? `Override (list ${priceLabel(sku.listPrice)})` : "List price", style: over ? S.overrideTag : S.listTag }
      : { v: "", style: S.grey() });
    sh.set(9, r, { f: `IF(B${r}=0,"",(G${r}-D${r})/D${r})`, v: on ? (row.finalCost - row.baseCost) / row.baseCost : "", style: on ? S.calc(FMT.pct) : S.grey(FMT.pct) });
  }

  // ─── 4. Tie-out ────────────────────────────────────────────────────────────
  sectionRow("4   Tie-out");
  const tie = {};
  tie.products = kv("Products at base cost", { f: `E${buildTotal}`, v: calc.invoiceTotalNoFreight - calc.wetlockTotal, style: S.calc(FMT.money) }, "Σ qty × base cost");
  tie.sp = kv("+ Wet lock / SP", { f: B(at.sp), v: calc.wetlockTotal, style: S.calc(FMT.money) });
  tie.invoice = kv("= Invoice total (products + SP)", { f: `${B(tie.products)}+${B(tie.sp)}`, v: calc.invoiceTotalNoFreight, style: S.emphasis(FMT.money) });
  tie.freight = kv("+ Freight", { f: B(at.freight), v: calc.freightCost, style: S.calc(FMT.money) });
  tie.expected = kv("= Expected landed total", { f: `${B(tie.invoice)}+${B(tie.freight)}`, v: calc.expectedLandedTotal, style: S.emphasis(FMT.money) }, "What the shipment actually cost");
  tie.adjusted = kv("Σ qty × final lot cost", { f: `SUMPRODUCT(B${finalStart}:B${finalEnd},G${finalStart}:G${finalEnd})`, v: calc.adjustedTotal, style: S.calc(FMT.money) }, "What the lot costs add back up to");
  const tieOk = Math.abs(calc.tieOutDiff) < 0.01;
  tie.diff = kv("Difference", { f: `${B(tie.adjusted)}-${B(tie.expected)}`, v: Math.abs(calc.tieOutDiff) < 0.005 ? 0 : calc.tieOutDiff, style: S.total(FMT.money) }, "Must be $0.00 (within one cent)", S.total());
  tie.status = kv("Status", {
    f: `IF(ABS(${B(tie.diff)})<0.01,"BALANCED","DOES NOT TIE")`,
    v: tieOk ? "BALANCED" : "DOES NOT TIE",
    style: { bold: true, align: "right", color: tieOk ? C.ok : C.bad, fill: tieOk ? C.okSoft : C.badSoft },
  });

  // ─── 5. Case allocation (audit trail) ──────────────────────────────────────
  sectionRow("5   Case allocation (how freight and SP were spread)");
  sh.addRow([
    { v: "Step", style: S.thLeft },
    { v: "Cases", style: S.th },
    { v: "Rule", style: { ...S.thLeft } },
  ]);
  for (let c = 4; c <= COLS; c++) sh.set(c, allocHdr, { v: "", style: S.thLeft });
  sh.merge(3, allocHdr, COLS, allocHdr);

  const a = calc.allocation;
  const qtyRef = (key) => `B${at.build[key]}`;
  const ALLOC_STYLES = {
    step:     [S.label, S.calc(FMT.cases)],
    subtotal: [{ ...S.label, bold: true }, S.emphasis(FMT.cases)],
    total:    [S.total(), S.total(FMT.cases)],
  };
  const allocRow = (label, f, v, rule, kind = "step") => {
    const [labelStyle, valueStyle] = ALLOC_STYLES[kind];
    const r = sh.addRow([{ v: label, style: labelStyle }, { f, v, style: valueStyle }]);
    noteCell(r, rule);
    return r;
  };
  allocRow("4# tubs", `${qtyRef("4lb")}/${UNITS_PER_CASE.tubs4lb}`, a.cases4, `4# tubs ÷ ${UNITS_PER_CASE.tubs4lb} per case`);
  allocRow("Shell oysters", qtyRef("shell"), a.casesShell, "Each shell unit is one case");
  allocRow("= Fixed cases", `B${allocRows["4lb"]}+B${allocRows.shell}`, a.fixedCases, "Allocated first", "subtotal");
  allocRow("Retail cases", `MAX(0,${B(at.total)}-B${allocRows.fixed})`, a.retailCases, "Total cases shipped − fixed cases", "subtotal");
  allocRow("16oz jars", `MIN(${qtyRef("16oz")}/${UNITS_PER_CASE.jars16oz},B${allocRows.retail})`, a.cases16, `16oz jars ÷ ${UNITS_PER_CASE.jars16oz} per case, capped at the retail cases available`);
  allocRow("10oz jars", `B${allocRows.retail}-B${allocRows["16oz"]}`, a.cases10, "Leftover retail space (10oz has no fixed case size)");
  allocRow("Total allocated", `B${allocRows.fixed}+B${allocRows["16oz"]}+B${allocRows["10oz"]}`, a.fixedCases + a.cases16 + a.cases10, "Should equal total cases shipped", "total");

  // ─── 6. Notes ──────────────────────────────────────────────────────────────
  const notes = [
    ...(overrides.length ? [{ level: "danger", message: `EXCEPTION: base price overridden for ${overrides.map((s) => s.label).join(", ")}. The standard price list was not used for ${overrides.length === 1 ? "this product" : "these products"}.` }] : []),
    ...notices,
    { level: "info", message: "Freight rule: use the weight or cost the freight invoice is billed on. Before the invoice arrives, use the Delta DN weight; AWB chargeable weight is the last resort." },
    { level: "info", message: "Generated by the Landed Cost Calculator. The app stores no PO data; this file is the record of the calculation." },
  ];
  sectionRow("6   Notes");
  const PREFIX = { danger: "✗ ", warning: "⚠ ", info: "• " };
  for (const n of notes) {
    const text = PREFIX[n.level] + n.message;
    const r = sh.addRow([{ v: text, style: { size: 10, wrap: true, color: n.level === "danger" ? C.bad : n.level === "warning" ? C.amber : C.ink, indent: 1 } }], { height: Math.max(16, 14 * Math.ceil(text.length / 150)) });
    sh.merge(1, r, COLS, r);
  }

  // ─── Status banner (needs the tie-out difference cell) ─────────────────────
  const exception = overrides.length ? "  ·  EXCEPTION: price override" : "";
  sh.set(1, at.banner, {
    f: `IF(ABS(${B(tie.diff)})<0.01,"✓  BALANCED — lot costs tie to the landed total","✗  DOES NOT TIE — review section 4")&"${exception}"`,
    v: (tieOk ? "✓  BALANCED — lot costs tie to the landed total" : "✗  DOES NOT TIE — review section 4") + exception,
    style: { bold: true, size: 11, color: tieOk && !exception ? C.ok : tieOk ? C.amber : C.bad, fill: tieOk && !exception ? C.okSoft : tieOk ? C.amberSoft : C.badSoft, indent: 1 },
  });

  // Sanity: the precomputed row plan must match what was laid out
  const firstFinal = finalStart; // first SKU row in section 3 (SUMPRODUCT range starts here)
  if (at.build[SKUS[0].key] !== buildStart || tie.products !== tieStart || allocRows["4lb"] !== allocHdr + 1
      || sh.rows.get(firstFinal)?.cells.get(1)?.f !== `A${buildStart}`) {
    throw new Error("Workbook layout drifted: row plan doesn't match rows written");
  }

  return { sheets: [sh], title: `Landed cost — PO ${input.po || "unnumbered"}`, created: generatedAt };
}

/** "PO-89908_NFO-landed-cost_2026-10-13.xlsx" */
export function nfoFileName(po, date = new Date()) {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const safePo = String(po || "").replace(/[^\w-]+/g, "");
  return `${safePo ? `PO-${safePo}_` : ""}NFO-landed-cost_${day}.xlsx`;
}

function sourceLabel(id) {
  return FREIGHT_SOURCES.find((s) => s.id === id)?.label ?? "—";
}

function sourceNote(id) {
  return { maersk: "Preferred: the basis the freight invoice is billed on", delta: "Proxy until the Maersk invoice arrives", awb: "Last resort; re-check against the invoice" }[id] ?? "";
}

function footerText(input) {
  return `PO ${input.po || "—"} · National Fish & Oyster landed cost`.replace(/&/g, "&&");
}
