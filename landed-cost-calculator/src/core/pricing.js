import { SKUS } from "./constants.js";

const EPS = 1e-9;

/** True when `cost` differs from the SKU's list price. */
export function isOverride(sku, cost) {
  return Math.abs(cost - sku.listPrice) > EPS;
}

/**
 * Products on this PO whose base cost was changed from the price list.
 * Only SKUs with a quantity count, since a blank row can't affect lot costs.
 * @param {object} items  calculate() input items
 * @returns {{ sku: object, cost: number }[]}
 */
export function priceOverrides(items) {
  return SKUS
    .filter((sku) => items[sku.qtyKey] > 0 && isOverride(sku, items[sku.costKey]))
    .map((sku) => ({ sku, cost: items[sku.costKey] }));
}

/** "$8.05", keeping extra precision: 8.0525 → "$8.0525". */
export function priceLabel(n) {
  const decimals = (String(n).split(".")[1] ?? "").length;
  return `$${n.toFixed(Math.max(2, decimals))}`;
}
