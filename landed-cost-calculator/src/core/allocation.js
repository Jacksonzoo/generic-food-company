import { UNITS_PER_CASE } from "./constants.js";

/**
 * Allocate cases for each SKU given shipment quantities.
 *
 * Rules:
 *   cases4    = qty4 / 12
 *   casesShell = qtyShell  (each shell unit IS one case)
 *   fixedCases = cases4 + casesShell
 *   retailCases = max(0, totalCases - fixedCases)
 *   cases16   = min(qty16 / 48, retailCases)
 *   cases10   = retailCases - cases16
 *
 * @param {{
 *   qty4?: number,
 *   qty16?: number,
 *   qty10?: number,
 *   qtyShell?: number,
 *   totalCases: number
 * }} quantities
 * @returns {{
 *   cases4: number,
 *   casesShell: number,
 *   fixedCases: number,
 *   retailCases: number,
 *   cases16: number,
 *   cases10: number
 * }}
 */
export function allocateCases({ qty4 = 0, qty16 = 0, qty10 = 0, qtyShell = 0, totalCases }) {
  const cases4 = qty4 / UNITS_PER_CASE.tubs4lb;
  const casesShell = qtyShell;
  const fixedCases = cases4 + casesShell;
  const retailCases = Math.max(0, totalCases - fixedCases);

  const cases16Raw = qty16 / UNITS_PER_CASE.jars16oz;
  const cases16 = Math.min(cases16Raw, retailCases);
  const cases10 = retailCases - cases16;

  return { cases4, casesShell, fixedCases, retailCases, cases16, cases10 };
}
