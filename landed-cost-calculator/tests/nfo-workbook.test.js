import { describe, it, expect } from "vitest";
import { calculate } from "../src/core/calculator.js";
import { buildNotices } from "../src/core/notices.js";
import { EXAMPLES } from "../src/core/examples.js";
import { buildNfoWorkbook, nfoFileName } from "../src/export/nfo-workbook.js";
import { writeXlsx } from "../src/export/xlsx.js";
import { unzip } from "./xlsx.test.js";

const AT = new Date("2026-10-13T14:30:00");

function book(id, mutate = () => {}) {
  const input = structuredClone(EXAMPLES.find((e) => e.id === id).input);
  mutate(input);
  const calc = calculate(input);
  const wb = buildNfoWorkbook({ calc, input, notices: buildNotices(input, calc), decimals: 7, generatedAt: AT });
  return { input, calc, wb, sheet: wb.sheets[0] };
}

/** All cells as [ref, cell] for searching. */
function cells(sheet) {
  const out = [];
  for (const [r, row] of sheet.rows) for (const [c, cell] of row.cells) out.push([r, c, cell]);
  return out;
}
const findText = (sheet, text) => cells(sheet).find(([, , cell]) => cell.v === text);

// Excel itself was used to confirm these formulas recompute to the cached values
// (scripted check, 0 mismatches across all confirmed POs). These tests keep the
// layout and cached results from drifting without needing Excel in CI.

describe.each(EXAMPLES.map((e) => e.id))("%s workbook", (id) => {
  const { calc, wb, sheet } = book(id);

  it("builds without layout drift and serializes", () => {
    expect(() => writeXlsx(wb)).not.toThrow();
  });

  it("caches the app's final lot cost for every product on the PO", () => {
    const finals = cells(sheet).filter(([, c, cell]) => c === 7 && String(cell.f ?? "").startsWith("IF(B"));
    const cached = finals.map(([, , cell]) => cell.v).filter((v) => typeof v === "number");
    expect(cached).toEqual(calc.results.map((r) => r.finalCost));
  });

  it("ties out via SUMPRODUCT over the final lot cost column", () => {
    const [, , cell] = cells(sheet).find(([, , c]) => String(c.f ?? "").startsWith("SUMPRODUCT("));
    expect(cell.v).toBeCloseTo(calc.adjustedTotal, 9);
  });

  it("shows BALANCED", () => {
    expect(String(sheet.rows.get(3).cells.get(1).v)).toContain("BALANCED");
  });
});

describe("workbook details", () => {
  it("marks products that aren't on the PO", () => {
    const { sheet } = book("PO89601"); // no shell oysters
    expect(findText(sheet, "Not on PO")).toBeDefined();
  });

  it("flags a price override as an exception in the banner, price column, and notes", () => {
    const { sheet } = book("PO89601", (input) => { input.items.baseCost16 = 8.1; });
    expect(sheet.rows.get(3).cells.get(1).v).toContain("EXCEPTION: price override");
    expect(findText(sheet, "Override (list $8.05)")).toBeDefined();
    expect(cells(sheet).some(([, , c]) => String(c.v).startsWith("✗ EXCEPTION: base price overridden for 16oz jars"))).toBe(true);
  });

  it("uses a formula for freight in weight mode and an input in dollars mode", () => {
    const weight = findText(book("PO89908").sheet, "Freight");
    expect(book("PO89908").sheet.rows.get(weight[0]).cells.get(2).f).toMatch(/^B\d+\*B\d+$/);
    const { sheet } = book("PO88993");
    const [r] = findText(sheet, "Freight");
    expect(sheet.rows.get(r).cells.get(2)).toMatchObject({ v: 585.9 });
    expect(sheet.rows.get(r).cells.get(2).f).toBeUndefined();
  });

  it("puts the per-case rate in the SP and freight column headers", () => {
    const { sheet } = book("PO89908");
    expect(findText(sheet, "Freight\n$60.7688 / case")).toBeDefined();
    expect(findText(sheet, "Wet lock (SP)\n$6.5000 / case")).toBeDefined();
  });

  it("shows DOES NOT TIE when allocation can't absorb the pool", () => {
    const { sheet } = book("PO89908", (input) => { input.totalCases = 8; });
    expect(sheet.rows.get(3).cells.get(1).v).toContain("DOES NOT TIE");
  });
});

describe("nfoFileName", () => {
  it("names the file by PO and date", () => {
    expect(nfoFileName("89908", AT)).toBe("PO-89908_NFO-landed-cost_2026-10-13.xlsx");
  });

  it("drops characters that aren't safe in file names", () => {
    expect(nfoFileName("89/908 x", AT)).toBe("PO-89908x_NFO-landed-cost_2026-10-13.xlsx");
    expect(nfoFileName("", AT)).toBe("NFO-landed-cost_2026-10-13.xlsx");
  });
});

describe("serialized workbook", () => {
  it("contains the generated title in document properties", () => {
    const files = unzip(writeXlsx(book("PO89908").wb));
    expect(files["docProps/core.xml"]).toContain("Landed cost — PO 89908");
  });
});
