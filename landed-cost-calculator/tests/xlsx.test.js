import { describe, it, expect } from "vitest";
import { writeXlsx, Sheet, colName, crc32 } from "../src/export/xlsx.js";

/** Read a stored (uncompressed) zip back into { name: text }. */
export function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = {};
  let pos = 0;
  while (view.getUint32(pos, true) === 0x04034b50) {
    const crc = view.getUint32(pos + 14, true);
    const size = view.getUint32(pos + 18, true);
    const nameLen = view.getUint16(pos + 26, true);
    const extraLen = view.getUint16(pos + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
    const data = bytes.subarray(pos + 30 + nameLen + extraLen, pos + 30 + nameLen + extraLen + size);
    if (crc32(data) !== crc) throw new Error(`CRC mismatch in ${name}`);
    files[name] = new TextDecoder().decode(data);
    pos += 30 + nameLen + extraLen + size;
  }
  return files;
}

describe("colName", () => {
  it.each([[1, "A"], [9, "I"], [26, "Z"], [27, "AA"], [52, "AZ"], [703, "AAA"]])("%d → %s", (n, name) => {
    expect(colName(n)).toBe(name);
  });
});

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("writeXlsx", () => {
  const sheet = new Sheet("Test & <Sheet>");
  sheet.setWidths([20, 12]);
  sheet.addRow([{ v: "Label & <stuff>", style: { bold: true } }, { v: 1.5, style: { numFmt: '"$"#,##0.00' } }]);
  sheet.addRow([{ v: "Sum" }, { f: "=B1*2", v: 3, style: { numFmt: '"$"#,##0.00' } }]);
  sheet.addRow([{ v: "Status" }, { f: 'IF(B2>0,"OK","NO")', v: "OK" }]);
  sheet.merge(1, 3, 2, 3);
  sheet.freezeRows = 1;
  const files = unzip(writeXlsx({ sheets: [sheet], title: "T", created: new Date("2026-10-13T12:00:00Z") }));

  it("contains every required package part with valid CRCs", () => {
    expect(Object.keys(files).sort()).toEqual([
      "[Content_Types].xml", "_rels/.rels", "docProps/core.xml",
      "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml",
    ]);
  });

  it("escapes text and sheet names", () => {
    expect(files["xl/workbook.xml"]).toContain('name="Test &amp; &lt;Sheet&gt;"');
    expect(files["xl/worksheets/sheet1.xml"]).toContain("Label &amp; &lt;stuff&gt;");
  });

  it("writes formulas without the leading = and with cached results", () => {
    const xml = files["xl/worksheets/sheet1.xml"];
    expect(xml).toMatch(/<c r="B2" s="\d+"><f>B1\*2<\/f><v>3<\/v><\/c>/);
    expect(xml).toContain('t="str"><f>IF(B2&gt;0,&quot;OK&quot;,&quot;NO&quot;)</f><v>OK</v>');
  });

  it("asks Excel to recalculate on open", () => {
    expect(files["xl/workbook.xml"]).toContain('fullCalcOnLoad="1"');
  });

  it("dedupes styles and registers custom number formats", () => {
    const styles = files["xl/styles.xml"];
    expect(styles.match(/<numFmt /g)).toHaveLength(1);
    expect(styles).toContain('formatCode="&quot;$&quot;#,##0.00"');
  });

  it("records merges, frozen panes, and column widths", () => {
    const xml = files["xl/worksheets/sheet1.xml"];
    expect(xml).toContain('<mergeCell ref="A3:B3"/>');
    expect(xml).toContain('ySplit="1"');
    expect(xml).toContain('<col min="1" max="1" width="20" customWidth="1"/>');
  });

  it("strips characters XML can't carry", () => {
    const s = new Sheet("S");
    s.addRow([{ v: "bad\u0001char" }]);
    expect(unzip(writeXlsx({ sheets: [s] }))["xl/worksheets/sheet1.xml"]).toContain("badchar");
  });
});
