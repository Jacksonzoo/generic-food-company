import { SKUS } from "./constants.js";

const NOT_A_NUMBER = "Enter a number.";

function requirePositive(errors, key, value, message) {
  if (Number.isNaN(value)) errors[key] = NOT_A_NUMBER;
  else if (!(value > 0)) errors[key] = message;
}

function requireNonNegative(errors, key, value) {
  if (Number.isNaN(value)) errors[key] = NOT_A_NUMBER;
  else if (value < 0) errors[key] = "Can't be negative.";
}

/**
 * Validate calculator input field by field.
 *
 * Keys are input field names (weight, rate, dollars, wetlockQty, wetlockUnitPrice,
 * totalCases, qty16, baseCost16, …) plus `items` for "no products entered".
 * Numeric fields may be NaN when the user typed something unparseable.
 *
 * @param {object} input  Same shape as calculate() input
 * @returns {{ errors: Record<string, string>, warnings: Record<string, string> }}
 *   Empty `errors` means the input can be calculated. Warnings never block.
 */
export function validateInput(input) {
  const errors = {};
  const warnings = {};
  const { freight = {}, wetlockQty, wetlockUnitPrice, totalCases, items = {} } = input;

  if (freight.mode === "dollars") {
    requirePositive(errors, "dollars", freight.dollars, "Enter the freight dollars from the invoice.");
  } else {
    requirePositive(errors, "weight", freight.weight, "Enter the billing weight.");
    requirePositive(errors, "rate", freight.rate, "Enter a rate above $0.");
  }

  requireNonNegative(errors, "wetlockQty", wetlockQty);
  requireNonNegative(errors, "wetlockUnitPrice", wetlockUnitPrice);
  requirePositive(errors, "totalCases", totalCases, "Enter the total cases shipped.");

  let anyQty = false;
  for (const { qtyKey, costKey, unit } of SKUS) {
    const qty = items[qtyKey] ?? 0;
    const cost = items[costKey] ?? 0;
    requireNonNegative(errors, qtyKey, qty);
    requireNonNegative(errors, costKey, cost);
    if (qty > 0) {
      anyQty = true;
      if (!errors[costKey] && !(cost > 0)) errors[costKey] = `Enter the base cost per ${unit}.`;
    }
  }
  if (!anyQty) errors.items = "Enter a quantity for at least one product.";

  if (wetlockQty > 0 && totalCases > 0 && totalCases !== wetlockQty) {
    warnings.totalCases = `Wetlock qty is ${wetlockQty}. Confirm the case count before using these costs.`;
  }

  return { errors, warnings };
}
