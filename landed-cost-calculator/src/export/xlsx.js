// Minimal, dependency-free .xlsx writer.
//
// Supports what an audit workbook needs: text, numbers, formulas (with cached
// results so previews show values before Excel recalculates), cell styles
// (font, fill, border, number format, alignment), column widths, row heights,
// merged cells, frozen panes, and print setup. Files are stored uncompressed.
//
// A style is a plain object:
//   { bold, italic, size, color, fill, border: "bottom"|"top"|"all"|"topBottom",
//     numFmt, align: "left"|"center"|"right", wrap, indent }
// Colors are 6-digit hex without "#".

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG = "http://schemas.openxmlformats.org/package/2006/relationships";

// ─── Cells & sheets ──────────────────────────────────────────────────────────

/** 1 → "A", 27 → "AA" */
export function colName(n) {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** colIndex (1-based), row (1-based) → "B7" */
export const ref = (col, row) => `${colName(col)}${row}`;

export class Sheet {
  constructor(name) {
    this.name = name;
    this.rows = new Map();   // row → { height, cells: Map<col, cell> }
    this.cols = [];          // [{ min, max, width }]
    this.merges = [];
    this.freezeRows = 0;
    this.print = { landscape: false, fitToWidth: true, footer: "" };
    this.cursor = 1;         // next row for addRow()
  }

  /**
   * Set one cell. `cell` is { v } for a value, { f, v } for a formula with its
   * cached result, plus an optional `style`.
   */
  set(col, row, cell) {
    if (!this.rows.has(row)) this.rows.set(row, { cells: new Map() });
    this.rows.get(row).cells.set(col, cell);
    return ref(col, row);
  }

  /** Append a row of cells starting at column A; returns its row number. */
  addRow(cells = [], { height } = {}) {
    const row = this.cursor++;
    cells.forEach((cell, i) => { if (cell != null) this.set(i + 1, row, cell); });
    if (!this.rows.has(row)) this.rows.set(row, { cells: new Map() });
    if (height) this.rows.get(row).height = height;
    return row;
  }

  skip(n = 1) { this.cursor += n; }

  merge(fromCol, fromRow, toCol, toRow) {
    this.merges.push(`${ref(fromCol, fromRow)}:${ref(toCol, toRow)}`);
  }

  setWidths(widths) {
    this.cols = widths.map((width, i) => ({ min: i + 1, max: i + 1, width }));
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

class StyleTable {
  constructor() {
    this.fonts = [fontXml({})];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = [borderXml(undefined)];
    this.numFmts = [];       // [{ id, code }]
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.cache = new Map();
  }

  /** Style object → cellXfs index (0 = default). */
  index(style) {
    if (!style) return 0;
    const key = JSON.stringify(style);
    if (this.cache.has(key)) return this.cache.get(key);

    const fontId = intern(this.fonts, fontXml(style));
    const fillId = style.fill ? intern(this.fills, fillXml(style.fill)) : 0;
    const borderId = intern(this.borders, borderXml(style.border));
    const numFmtId = style.numFmt ? this.numFmtId(style.numFmt) : 0;

    const align = [];
    if (style.align) align.push(`horizontal="${style.align}"`);
    if (style.wrap) align.push('wrapText="1"');
    if (style.indent) align.push(`indent="${style.indent}"`);
    align.push('vertical="center"');

    const xf = `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"`
      + ' applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
      + `<alignment ${align.join(" ")}/></xf>`;
    const id = this.xfs.push(xf) - 1;
    this.cache.set(key, id);
    return id;
  }

  numFmtId(code) {
    const found = this.numFmts.find((f) => f.code === code);
    if (found) return found.id;
    const id = 164 + this.numFmts.length; // custom formats start at 164
    this.numFmts.push({ id, code });
    return id;
  }

  toXml() {
    const list = (tag, items) => `<${tag} count="${items.length}">${items.join("")}</${tag}>`;
    const numFmts = this.numFmts.length
      ? list("numFmts", this.numFmts.map((f) => `<numFmt numFmtId="${f.id}" formatCode="${esc(f.code)}"/>`))
      : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<styleSheet xmlns="${NS}">${numFmts}${list("fonts", this.fonts)}${list("fills", this.fills)}`
      + `${list("borders", this.borders)}<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
      + `${list("cellXfs", this.xfs)}<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}

function intern(list, xml) {
  const i = list.indexOf(xml);
  return i >= 0 ? i : list.push(xml) - 1;
}

// Child order matters to Excel: b, i, sz, color, name, family
function fontXml({ bold, italic, size = 10, color = "1F2933" }) {
  return `<font>${bold ? "<b/>" : ""}${italic ? "<i/>" : ""}<sz val="${size}"/><color rgb="FF${color}"/>`
    + '<name val="Calibri"/><family val="2"/></font>';
}

function fillXml(color) {
  return `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`;
}

// Child order matters to Excel: left, right, top, bottom, diagonal
function borderXml(border) {
  const side = (name, on, color = "C9CED6") => (on ? `<${name} style="thin"><color rgb="FF${color}"/></${name}>` : `<${name}/>`);
  const all = border === "all";
  const top = all || border === "top" || border === "topBottom" || border === "totalTop";
  const bottom = all || border === "bottom" || border === "topBottom";
  if (border === "totalTop") {
    return `<border><left/><right/><top style="medium"><color rgb="FF1F2933"/></top><bottom/><diagonal/></border>`;
  }
  return `<border>${side("left", all)}${side("right", all)}${side("top", top)}${side("bottom", bottom)}<diagonal/></border>`;
}

// ─── XML parts ───────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "") // characters XML can't carry
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cellXml(r, cell, styles) {
  const s = styles.index(cell.style);
  const sAttr = s ? ` s="${s}"` : "";
  const { f, v } = cell;

  if (f !== undefined) {
    const formula = `<f>${esc(String(f).replace(/^=/, ""))}</f>`;
    if (typeof v === "string") return `<c r="${r}"${sAttr} t="str">${formula}<v>${esc(v)}</v></c>`;
    if (typeof v === "boolean") return `<c r="${r}"${sAttr} t="b">${formula}<v>${v ? 1 : 0}</v></c>`;
    return `<c r="${r}"${sAttr}>${formula}${Number.isFinite(v) ? `<v>${v}</v>` : ""}</c>`;
  }
  if (typeof v === "number" && Number.isFinite(v)) return `<c r="${r}"${sAttr}><v>${v}</v></c>`;
  if (v === undefined || v === null || v === "") return `<c r="${r}"${sAttr}/>`;
  return `<c r="${r}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function sheetXml(sheet, styles) {
  const rowNums = [...sheet.rows.keys()].sort((a, b) => a - b);
  let maxCol = 1;
  const rows = rowNums.map((r) => {
    const { cells, height } = sheet.rows.get(r);
    const cols = [...cells.keys()].sort((a, b) => a - b);
    if (cols.length) maxCol = Math.max(maxCol, cols.at(-1));
    const ht = height ? ` ht="${height}" customHeight="1"` : "";
    return `<row r="${r}"${ht}>${cols.map((c) => cellXml(ref(c, r), cells.get(c), styles)).join("")}</row>`;
  }).join("");

  const lastRow = rowNums.at(-1) ?? 1;
  const pane = sheet.freezeRows
    ? `<pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/>`
    : "";
  const cols = sheet.cols.length
    ? `<cols>${sheet.cols.map((c) => `<col min="${c.min}" max="${c.max}" width="${c.width}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const merges = sheet.merges.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>`
    : "";
  const { landscape, fitToWidth, footer } = sheet.print;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="${NS}" xmlns:r="${NS_R}">`
    + `<sheetPr><pageSetUpPr fitToPage="${fitToWidth ? 1 : 0}"/></sheetPr>`
    + `<dimension ref="A1:${ref(maxCol, lastRow)}"/>`
    + `<sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews>`
    + `<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData>${merges}`
    + `<printOptions horizontalCentered="1"/>`
    + `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>`
    + `<pageSetup orientation="${landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>`
    + (footer ? `<headerFooter><oddFooter>${esc(footer)}</oddFooter></headerFooter>` : "")
    + `</worksheet>`;
}

function workbookXml(sheets) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>`
    + sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")
    + `</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
}

/**
 * Build an .xlsx file.
 * @param {{ sheets: Sheet[], title?: string, author?: string, created?: Date }} book
 * @returns {Uint8Array}
 */
export function writeXlsx({ sheets, title = "", author = "Landed Cost Calculator", created = new Date() }) {
  const styles = new StyleTable();
  const sheetFiles = sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s, styles)]);

  const files = [
    ["[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
      + `<Default Extension="xml" ContentType="application/xml"/>`
      + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
      + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")
      + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
      + `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`
      + `</Types>`],
    ["_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS_PKG}">`
      + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
      + `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>`
      + `</Relationships>`],
    ["docProps/core.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`
      + `<dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator>`
      + `<dcterms:created xsi:type="dcterms:W3CDTF">${created.toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:created>`
      + `</cp:coreProperties>`],
    ["xl/workbook.xml", workbookXml(sheets)],
    ["xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS_PKG}">`
      + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")
      + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
      + `</Relationships>`],
    ...sheetFiles,
    ["xl/styles.xml", styles.toXml()], // last: sheets register their styles while serializing
  ];

  return zipStore(files.map(([name, xml]) => [name, new TextEncoder().encode(xml)]), created);
}

// ─── ZIP (store, no compression) ─────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** @param {[string, Uint8Array][]} entries */
export function zipStore(entries, date = new Date()) {
  const enc = new TextEncoder();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  const parts = [];
  const central = [];
  let offset = 0;

  for (const [name, data] of entries) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);          // version needed
    local.setUint16(6, 0x0800, true);      // UTF-8 names
    local.setUint16(8, 0, true);           // stored
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);            // version made by
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, dosTime, true);
    dir.setUint16(14, dosDate, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, nameBytes.length, true);
    dir.setUint32(42, offset, true);       // local header offset
    central.push(new Uint8Array(dir.buffer), nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}
