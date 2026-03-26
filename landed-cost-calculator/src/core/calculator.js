import { allocateCases } from "./allocation.js";

/**
 * Compute freight cost from inputs.
 * @param {{ mode: "weight"|"dollars", weight?: number, rate?: number, dollars?: number }} freight
 * @returns {number}
 */
export function computeFreight({ mode, weight = 0, rate = 0, dollars = 0 }) {
  return mode === "dollars" ? dollars : weight * rate;
}

/**
 * Core landed-cost calculation.
 *
 * @param {{
 *   po: string,
 *   freight: { mode: "weight"|"dollars", weight?: number, rate?: number, dollars?: number },
 *   wetlockQty: number,
 *   wetlockUnitPrice: number,
 *   totalCases: number,
 *   items: {
 *     qty4?: number,  baseCost4?: number,
 *     qty16?: number, baseCost16?: number,
 *     qty10?: number, baseCost10?: number,
 *     qtyShell?: number, baseCostShell?: number
 *   }
 * }} input
 *
 * @returns {{
 *   po: string,
 *   freightCost: number,
 *   wetlockTotal: number,
 *   pool: number,
 *   dollarsPerCase: number,
 *   allocation: object,
 *   results: {
 *     sku: string,
 *     qty: number,
 *     baseCost: number,
 *     casesUsed: number,
 *     freightAddPerUnit: number,
 *     wetlockAddPerUnit: number,
 *     finalCost: number
 *   }[],
 *   invoiceTotalNoFreight: number,
 *   expectedLandedTotal: number,
 *   adjustedTotal: number,
 *   tieOutDiff: number
 * }}
 */
export function calculate(input) {
  const {
    po,
    freight,
    wetlockQty,
    wetlockUnitPrice,
    totalCases,
    items: {
      qty4 = 0,   baseCost4 = 0,
      qty16 = 0,  baseCost16 = 0,
      qty10 = 0,  baseCost10 = 0,
      qtyShell = 0, baseCostShell = 0,
    },
  } = input;

  const freightCost = computeFreight(freight);
  const wetlockTotal = wetlockQty * wetlockUnitPrice;
  const pool = freightCost + wetlockTotal;
  const dollarsPerCase = totalCases > 0 ? pool / totalCases : 0;

  const allocation = allocateCases({ qty4, qty16, qty10, qtyShell, totalCases });
  const { cases4, casesShell, cases16, cases10 } = allocation;

  // Wetlock add per unit (same $/case converted per unit)
  const wetlockPerCase = totalCases > 0 ? wetlockTotal / totalCases : 0;
  const freightPerCase = totalCases > 0 ? freightCost / totalCases : 0;

  function unitAdders(casesUsed, qty) {
    if (qty === 0) return { freightAdd: 0, wetlockAdd: 0 };
    return {
      freightAdd: (casesUsed * freightPerCase) / qty,
      wetlockAdd: (casesUsed * wetlockPerCase) / qty,
    };
  }

  const add4 = unitAdders(cases4, qty4);
  const add16 = unitAdders(cases16, qty16);
  const add10 = unitAdders(cases10, qty10);
  const addShell = unitAdders(casesShell, qtyShell);

  const results = [];

  if (qty16 > 0) {
    results.push({
      sku: "16oz jars",
      qty: qty16,
      baseCost: baseCost16,
      casesUsed: cases16,
      freightAddPerUnit: add16.freightAdd,
      wetlockAddPerUnit: add16.wetlockAdd,
      finalCost: baseCost16 + add16.freightAdd + add16.wetlockAdd,
    });
  }

  if (qty10 > 0) {
    results.push({
      sku: "10oz jars",
      qty: qty10,
      baseCost: baseCost10,
      casesUsed: cases10,
      freightAddPerUnit: add10.freightAdd,
      wetlockAddPerUnit: add10.wetlockAdd,
      finalCost: baseCost10 + add10.freightAdd + add10.wetlockAdd,
    });
  }

  if (qty4 > 0) {
    results.push({
      sku: "4# tubs",
      qty: qty4,
      baseCost: baseCost4,
      casesUsed: cases4,
      freightAddPerUnit: add4.freightAdd,
      wetlockAddPerUnit: add4.wetlockAdd,
      finalCost: baseCost4 + add4.freightAdd + add4.wetlockAdd,
    });
  }

  if (qtyShell > 0) {
    results.push({
      sku: "Shell oysters",
      qty: qtyShell,
      baseCost: baseCostShell,
      casesUsed: casesShell,
      freightAddPerUnit: addShell.freightAdd,
      wetlockAddPerUnit: addShell.wetlockAdd,
      finalCost: baseCostShell + addShell.freightAdd + addShell.wetlockAdd,
    });
  }

  // Tie-out
  const invoiceTotalNoFreight =
    qty16 * baseCost16 +
    qty10 * baseCost10 +
    qty4 * baseCost4 +
    qtyShell * baseCostShell +
    wetlockTotal;

  const expectedLandedTotal = invoiceTotalNoFreight + freightCost;
  const adjustedTotal = results.reduce((sum, r) => sum + r.qty * r.finalCost, 0);
  const tieOutDiff = adjustedTotal - expectedLandedTotal;

  return {
    po,
    freightCost,
    wetlockTotal,
    pool,
    dollarsPerCase,
    allocation,
    results,
    invoiceTotalNoFreight,
    expectedLandedTotal,
    adjustedTotal,
    tieOutDiff,
  };
}
