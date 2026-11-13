import { SKUS } from "../core/constants.js";

/** calculate() field name → DOM input id. */
export const FIELD_IDS = {
  po: "po",
  weight: "billing-weight",
  rate: "freight-rate",
  dollars: "freight-dollars",
  wetlockQty: "wetlock-qty",
  wetlockUnitPrice: "wetlock-price",
  totalCases: "total-cases",
  qty16: "qty16",       baseCost16: "cost16",
  qty10: "qty10",       baseCost10: "cost10",
  qty4: "qty4",         baseCost4: "cost4",
  qtyShell: "qty-shell", baseCostShell: "cost-shell",
};

/**
 * Parse a typed number. Blank → 0, "$1,234.50" → 1234.5, anything else → NaN
 * (so validation can say "Enter a number" instead of silently using a prefix).
 */
export function parseNumber(raw) {
  const s = String(raw ?? "").replace(/[$,\s]/g, "");
  if (s === "") return 0;
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
}

/**
 * Display a money value with at least 2 decimals, keeping any extra precision:
 * 29.2 → "29.20", 8.0525 → "8.0525". Blank and unparseable input pass through unchanged.
 */
export function formatMoneyInput(raw) {
  const s = String(raw ?? "").trim();
  const n = parseNumber(s);
  if (s === "" || Number.isNaN(n)) return s;
  const decimals = (String(n).split(".")[1] ?? "").length;
  return n.toFixed(Math.max(2, decimals));
}

/** Raw form values (strings) → calculate() input. Pure. */
export function buildInput(values) {
  const wetlockQty = parseNumber(values.wetlockQty);
  const items = {};
  for (const { qtyKey, costKey } of SKUS) {
    items[qtyKey] = parseNumber(values[qtyKey]);
    items[costKey] = parseNumber(values[costKey]);
  }

  return {
    po: String(values.po ?? "").trim(),
    freight: values.mode === "dollars"
      ? { mode: "dollars", source: values.source, dollars: parseNumber(values.dollars) }
      : { mode: "weight", source: values.source, weight: parseNumber(values.weight), rate: parseNumber(values.rate) },
    wetlockQty,
    wetlockUnitPrice: parseNumber(values.wetlockUnitPrice),
    // Total cases defaults to the wetlock qty when left blank
    totalCases: String(values.totalCases ?? "").trim() ? parseNumber(values.totalCases) : wetlockQty,
    items,
  };
}

/**
 * calculate() input → raw form values, for loading examples. Pure.
 * Keys left undefined are not written, so the freight rate survives a $-mode example.
 */
export function valuesFromInput(input) {
  const blankIfZero = (n) => (n ? String(n) : "");
  const moneyOrBlank = (n) => (n ? formatMoneyInput(n) : "");
  const { freight, items } = input;
  const values = {
    po: input.po ?? "",
    mode: freight.mode,
    source: freight.source ?? "maersk",
    weight: blankIfZero(freight.weight),
    rate: freight.rate ? formatMoneyInput(freight.rate) : undefined,
    dollars: moneyOrBlank(freight.dollars),
    wetlockQty: String(input.wetlockQty),
    wetlockUnitPrice: formatMoneyInput(input.wetlockUnitPrice),
    totalCases: String(input.totalCases),
  };
  for (const { qtyKey, costKey } of SKUS) {
    values[qtyKey] = blankIfZero(items[qtyKey]);
    values[costKey] = moneyOrBlank(items[qtyKey] ? items[costKey] : 0);
  }
  return values;
}

/** A cleared form that keeps the user's saved defaults and the company price list. */
export function emptyValues(settings) {
  const values = { mode: "weight", source: "maersk" };
  for (const key of Object.keys(FIELD_IDS)) values[key] = "";
  values.rate = formatMoneyInput(settings.freightRate);
  values.wetlockUnitPrice = formatMoneyInput(settings.wetlockUnitPrice);
  for (const sku of SKUS) values[sku.costKey] = formatMoneyInput(sku.listPrice);
  return values;
}

/**
 * Whether a base cost field should be (re)locked after loading values:
 * blank or equal to the list price means nothing was deliberately overridden.
 */
export function isAtListPrice(sku, raw) {
  return String(raw ?? "").trim() === "" || parseNumber(raw) === sku.listPrice;
}

export function readValues(doc = document) {
  const values = {
    mode: doc.querySelector('input[name="freight-mode"]:checked')?.value ?? "weight",
    source: doc.querySelector('input[name="freight-source"]:checked')?.value ?? "maersk",
  };
  for (const [key, id] of Object.entries(FIELD_IDS)) values[key] = doc.getElementById(id).value;
  return values;
}

export function writeValues(values, doc = document) {
  for (const [key, id] of Object.entries(FIELD_IDS)) {
    if (values[key] !== undefined) doc.getElementById(id).value = values[key];
  }
  for (const name of ["mode", "source"]) {
    const radio = doc.querySelector(`input[name="freight-${name}"][value="${values[name]}"]`);
    if (radio) radio.checked = true;
  }
}
