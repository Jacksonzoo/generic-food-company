// Pure display formatters. No DOM access, so they're unit-testable.

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** $1,234.56 — values that round to zero print as $0.00, never -$0.00. */
export function money(n) {
  return usd.format(Math.abs(n) < 0.005 ? 0 : n);
}

/** Fixed decimals for lot costs, with the same negative-zero guard. */
export function fixed(n, decimals) {
  return (Math.abs(n) < 0.5 * 10 ** -decimals ? 0 : n).toFixed(decimals);
}

/** Quantities and case counts: thousands separators, trailing zeros trimmed. */
export function quantity(n, maxDecimals = 4) {
  return n.toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
}

/** "+17.4%" */
export function percent(fraction) {
  const sign = fraction > 0 ? "+" : "";
  return `${sign}${(fraction * 100).toFixed(1)}%`;
}

/** "1 jar" / "270 jars" */
export function plural(count, unit) {
  return `${quantity(count)} ${unit}${count === 1 ? "" : "s"}`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Paste-ready block for Entree: one "SKU: lot cost" line per product. */
export function entreeText(calc, decimals) {
  return calc.results.map((r) => `${r.sku}: ${fixed(r.finalCost, decimals)}`).join("\n");
}
