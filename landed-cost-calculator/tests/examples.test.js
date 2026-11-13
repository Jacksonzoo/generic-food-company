import { describe, it, expect } from "vitest";
import { calculate } from "../src/core/calculator.js";
import { EXAMPLES, matchesExpected } from "../src/core/examples.js";

// The Examples menu and these tests share one fixture list, so the in-app
// "matches the confirmed lot costs" check can never drift from CI.

describe.each(EXAMPLES)("$label", ({ input, expected }) => {
  const calc = calculate(input);

  it.each(Object.entries(expected))("%s matches the confirmed lot cost", (sku, value) => {
    const row = calc.results.find((r) => r.sku === sku);
    expect(row).toBeDefined();
    expect(row.finalCost).toBeCloseTo(value, 6);
  });

  it("returns exactly the confirmed SKUs", () => {
    expect(calc.results.map((r) => r.sku).sort()).toEqual(Object.keys(expected).sort());
  });

  it("ties out to invoice + freight", () => {
    expect(Math.abs(calc.tieOutDiff)).toBeLessThan(1e-6);
  });

  it("passes matchesExpected", () => {
    expect(matchesExpected(calc, expected)).toBe(true);
  });
});

describe("matchesExpected", () => {
  const { input, expected } = EXAMPLES[0];
  const calc = calculate(input);

  it("fails when a value is off", () => {
    expect(matchesExpected(calc, { ...expected, "16oz jars": 9.55 })).toBe(false);
  });

  it("fails when an expected SKU is missing from the result", () => {
    expect(matchesExpected(calc, { ...expected, "Mystery SKU": 1 })).toBe(false);
  });
});
