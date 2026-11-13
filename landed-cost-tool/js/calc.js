// Landed Cost Tool — financial logic module.
// Pure functions, no DOM. This is the single source of truth for all
// allocation math and the tie-out invariant (see LANDED_COST_TOOL_SPEC.md).

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round4(n) {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

export function driverQty(item) {
  return item.driver === 'cases' ? (Number(item.cases) || 0) : (Number(item.weight) || 0);
}

export function lineTotal(item) {
  return driverQty(item) * (Number(item.unitCost) || 0);
}

export function driverMix(lineItems) {
  return {
    cases: lineItems.some((li) => li.driver === 'cases'),
    weight: lineItems.some((li) => li.driver === 'weight'),
  };
}

// Spreads `total` across `entries` ([{id, weight}]) proportional to weight.
// Never mixes units — callers must pass a single, consistent weight basis.
export function allocateProportional(total, entries) {
  const sumWeight = entries.reduce((s, e) => s + e.weight, 0);
  const shares = {};
  if (!total || sumWeight <= 0) {
    entries.forEach((e) => { shares[e.id] = 0; });
    return shares;
  }
  entries.forEach((e) => { shares[e.id] = total * (e.weight / sumWeight); });
  return shares;
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

/**
 * lineItems: [{ id, description, cases, weight, unitCost, driver }]
 * supplementals: [{ id, name, totals: { cases, weight }, excluded: Set<itemId> }]
 * invoiceTotal: string | number (may be blank)
 */
export function computeLandedCost({ lineItems, supplementals, invoiceTotal }) {
  const driversPresent = driverMix(lineItems);

  const baseTotals = {};
  lineItems.forEach((li) => { baseTotals[li.id] = lineTotal(li); });

  // Allocate each supplemental, per driver group, single-driver only.
  const supplementalShares = {};
  const supplementalTotalsSum = {};
  supplementals.forEach((sup) => {
    const shares = {};
    lineItems.forEach((li) => { shares[li.id] = 0; });
    let supSum = 0;
    ['cases', 'weight'].forEach((driver) => {
      if (!driversPresent[driver]) return;
      const total = Number(sup.totals[driver]) || 0;
      supSum += total;
      const applicable = lineItems.filter((li) => li.driver === driver && !sup.excluded.has(li.id));
      const entries = applicable.map((li) => ({ id: li.id, weight: driverQty(li) }));
      const alloc = allocateProportional(total, entries);
      applicable.forEach((li) => { shares[li.id] = alloc[li.id]; });
    });
    supplementalShares[sup.id] = shares;
    supplementalTotalsSum[sup.id] = supSum;
  });

  const baseTotalSum = sum(Object.values(baseTotals));
  const supplementalGrandTotal = sum(Object.values(supplementalTotalsSum));
  const expectedLandedTotal = baseTotalSum + supplementalGrandTotal;

  const preReconTotals = {};
  lineItems.forEach((li) => {
    let t = baseTotals[li.id];
    supplementals.forEach((sup) => { t += supplementalShares[sup.id][li.id] || 0; });
    preReconTotals[li.id] = t;
  });
  const preReconSum = sum(Object.values(preReconTotals));

  // Pay-as-invoiced: any gap between the build-up and the invoice total is
  // absorbed into final lot cost, spread pro-rata by each item's landed
  // value share (unit-agnostic, so it never mixes cases/weight basis).
  const hasInvoiceTotal = invoiceTotal !== null && invoiceTotal !== undefined
    && invoiceTotal !== '' && !Number.isNaN(Number(invoiceTotal));
  const reconciliationTarget = hasInvoiceTotal ? Number(invoiceTotal) : expectedLandedTotal;
  const invoiceGap = hasInvoiceTotal ? round2(Number(invoiceTotal) - expectedLandedTotal) : 0;

  const gapEntries = lineItems.map((li) => ({ id: li.id, weight: preReconTotals[li.id] }));
  const gapShares = allocateProportional(invoiceGap, gapEntries);

  const finalTotals = {};
  lineItems.forEach((li) => { finalTotals[li.id] = preReconTotals[li.id] + (gapShares[li.id] || 0); });

  const finalLotCost = {};
  lineItems.forEach((li) => {
    const q = driverQty(li);
    finalLotCost[li.id] = q > 0 ? round4(finalTotals[li.id] / q) : 0;
  });

  // The hard invariant: reconstructing totals from the *displayed* (rounded)
  // per-unit costs must still tie out within $0.01.
  const checkTotal = sum(lineItems.map((li) => driverQty(li) * finalLotCost[li.id]));
  const tieOutDiff = round2(checkTotal - reconciliationTarget);
  const tieOutOk = Math.abs(tieOutDiff) < 0.01;

  return {
    driversPresent,
    baseTotals,
    supplementalShares,
    supplementalTotalsSum,
    baseTotalSum,
    supplementalGrandTotal,
    expectedLandedTotal,
    preReconTotals,
    preReconSum,
    hasInvoiceTotal,
    reconciliationTarget,
    invoiceGap,
    gapShares,
    finalTotals,
    finalLotCost,
    checkTotal,
    tieOutDiff,
    tieOutOk,
  };
}
