import { UNITS_PER_CASE, TIE_OUT_TOLERANCE } from "./constants.js";

const EPS = 1e-9;
const SEVERITY = { danger: 0, warning: 1, info: 2 };

const n2 = (n) => Number(n.toFixed(2)).toString();

/**
 * Plain-language findings about a finished calculation, most severe first.
 * These explain *why* a tie-out fails or which SKU absorbed an odd allocation,
 * so the user can fix paperwork instead of guessing.
 *
 * @param {object} input  calculate() input
 * @param {object} calc   calculate() result
 * @returns {{ id: string, level: "danger"|"warning"|"info", message: string }[]}
 */
export function buildNotices(input, calc) {
  const notices = [];
  const add = (id, level, message) => notices.push({ id, level, message });

  const { qty16 = 0, qty10 = 0, qty4 = 0 } = input.items;
  const { totalCases, wetlockQty } = input;
  const { fixedCases, retailCases, cases10 } = calc.allocation;

  if (Math.abs(calc.tieOutDiff) >= TIE_OUT_TOLERANCE) {
    add("tie-out", "danger",
      `Adjusted total is off by $${Math.abs(calc.tieOutDiff).toFixed(2)}, so these lot costs won't tie to the landed total.`);
  }

  if (fixedCases > totalCases + EPS) {
    add("fixed-overflow", "danger",
      `4# tubs and shell oysters fill ${n2(fixedCases)} cases, but only ${n2(totalCases)} were shipped.`);
  }

  const needed16 = qty16 / UNITS_PER_CASE.jars16oz;
  if (needed16 > retailCases + EPS) {
    add("cap-16oz", "warning",
      `16oz jars need ${n2(needed16)} cases but only ${n2(retailCases)} retail cases are left, so they're capped at ${n2(retailCases)}.`);
  }

  if (qty10 > 0 && cases10 <= EPS) {
    add("no-room-10oz", "warning", "No retail space is left for 10oz jars, so they carry no freight or SP.");
  }

  if (qty10 === 0 && cases10 > EPS) {
    add("orphan-retail", "warning",
      `${n2(cases10)} leftover retail cases have no 10oz jars to absorb their cost.`);
  }

  if (wetlockQty > 0 && totalCases !== wetlockQty) {
    add("case-mismatch", "warning",
      `Total cases shipped (${n2(totalCases)}) doesn't match wetlock qty (${n2(wetlockQty)}).`);
  }

  if (qty4 % UNITS_PER_CASE.tubs4lb !== 0) {
    add("partial-4lb", "info",
      `${qty4} tubs is ${n2(qty4 / UNITS_PER_CASE.tubs4lb)} cases, which is a partial case.`);
  }

  if (input.freight.source === "delta") {
    add("source-delta", "info", "Freight uses Delta DN weight. Re-check it when the Maersk invoice arrives.");
  } else if (input.freight.source === "awb") {
    add("source-awb", "info", "Freight uses AWB chargeable weight (last resort). Re-run it with the Maersk invoice or Delta DN weight.");
  }

  return notices.sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level]);
}
