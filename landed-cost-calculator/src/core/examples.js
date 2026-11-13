// Confirmed PO examples — the source of truth for regression tests and the
// "Examples" menu. `expected` holds the final lot costs signed off for Entree.

export const EXAMPLES = [
  {
    id: "PO88993",
    label: "PO 88993",
    note: "Freight $ entered directly",
    input: {
      po: "88993",
      freight: { mode: "dollars", source: "maersk", dollars: 585.90 },
      wetlockQty: 9,
      wetlockUnitPrice: 6.50,
      totalCases: 9,
      items: {
        qty16: 270,  baseCost16: 8.05,
        qty10: 20,   baseCost10: 5.35,
        qty4:  24,   baseCost4:  29.20,
        qtyShell: 1, baseCostShell: 72,
      },
    },
    expected: { "16oz jars": 9.5416667, "10oz jars": 6.6925, "4# tubs": 35.1666667, "Shell oysters": 143.60 },
  },
  {
    id: "PO89601",
    label: "PO 89601",
    note: "616 lb billed × $1.05",
    input: {
      po: "89601",
      freight: { mode: "weight", source: "maersk", weight: 616, rate: 1.05 },
      wetlockQty: 10,
      wetlockUnitPrice: 6.50,
      totalCases: 10,
      items: {
        qty16: 318, baseCost16: 8.05,
        qty10: 20,  baseCost10: 5.35,
        qty4:  36,  baseCost4:  29.20,
      },
    },
    expected: { "16oz jars": 9.532917, "10oz jars": 6.684625, "4# tubs": 35.1316666667 },
  },
  {
    id: "PO89699",
    label: "PO 89699",
    note: "Delta 588 lb · no 10oz",
    input: {
      po: "89699",
      freight: { mode: "weight", source: "delta", weight: 588, rate: 1.05 },
      wetlockQty: 10,
      wetlockUnitPrice: 6.50,
      totalCases: 10,
      items: {
        qty16: 48,   baseCost16: 8.05,
        qty4:  96,   baseCost4:  29.20,
        qtyShell: 1, baseCostShell: 72,
      },
    },
    expected: { "16oz jars": 9.4716666667, "4# tubs": 34.8866666667, "Shell oysters": 140.24 },
  },
  {
    id: "PO89791",
    label: "PO 89791",
    note: "796 lb × $1.05 · 13 cases",
    input: {
      po: "89791",
      freight: { mode: "weight", source: "maersk", weight: 796, rate: 1.05 },
      wetlockQty: 13,
      wetlockUnitPrice: 6.50,
      totalCases: 13,
      items: {
        qty16: 366, baseCost16: 8.05,
        qty10: 20,  baseCost10: 5.35,
        qty4:  60,  baseCost4:  29.20,
      },
    },
    expected: { "16oz jars": 9.5248397439, "10oz jars": 6.6773557692, "4# tubs": 35.0993589744 },
  },
  {
    id: "PO89908",
    label: "PO 89908",
    note: "Delta 926 lb · all four products",
    input: {
      po: "89908",
      freight: { mode: "weight", source: "delta", weight: 926, rate: 1.05 },
      wetlockQty: 16,
      wetlockUnitPrice: 6.50,
      totalCases: 16,
      items: {
        qty16: 270,  baseCost16: 8.05,
        qty10: 20,   baseCost10: 5.35,
        qty4:  108,  baseCost4:  29.20,
        qtyShell: 1, baseCostShell: 72,
      },
    },
    expected: { "16oz jars": 9.4514322917, "10oz jars": 6.6112890625, "4# tubs": 34.8057291667, "Shell oysters": 139.26875 },
  },
];

/**
 * True when every expected SKU's final cost is within `tolerance` of the result.
 * Confirmed figures were recorded to 6–10 decimals, so 1e-6 is the tightest fair check.
 */
export function matchesExpected(calc, expected, tolerance = 1e-6) {
  return Object.entries(expected).every(([sku, value]) => {
    const row = calc.results.find((r) => r.sku === sku);
    return row !== undefined && Math.abs(row.finalCost - value) < tolerance;
  });
}
