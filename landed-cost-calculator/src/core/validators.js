/**
 * Validate calculator input and return an array of error strings.
 * Empty array means valid.
 *
 * @param {object} input  Same shape as calculate() input
 * @returns {string[]}
 */
export function validate(input) {
  const errors = [];
  const { freight, wetlockQty, wetlockUnitPrice, totalCases, items } = input;

  if (!freight || !["weight", "dollars"].includes(freight.mode)) {
    errors.push("Freight mode must be 'weight' or 'dollars'.");
  } else if (freight.mode === "weight") {
    if (!(freight.weight > 0)) errors.push("Billing weight must be > 0.");
    if (!(freight.rate > 0))   errors.push("Freight rate must be > 0.");
  } else {
    if (!(freight.dollars > 0)) errors.push("Freight $ must be > 0.");
  }

  if (!(wetlockQty >= 0)) errors.push("Wetlock qty must be ≥ 0.");
  if (!(wetlockUnitPrice >= 0)) errors.push("Wetlock unit price must be ≥ 0.");
  if (!(totalCases > 0)) errors.push("Total cases shipped must be > 0.");

  const { qty4 = 0, qty16 = 0, qty10 = 0, qtyShell = 0 } = items || {};
  if (qty4 + qty16 + qty10 + qtyShell === 0) {
    errors.push("At least one item qty must be > 0.");
  }

  // Warn (non-blocking) if totalCases ≠ wetlockQty — returned as an error with "WARN:" prefix
  if (wetlockQty > 0 && totalCases !== wetlockQty) {
    errors.push(`WARN: Total cases (${totalCases}) ≠ Wetlock qty (${wetlockQty}). Verify intentional.`);
  }

  return errors;
}
