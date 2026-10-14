import { describe, it, expect } from "vitest";
import { validateInput } from "../src/core/validators.js";
import { EXAMPLES } from "../src/core/examples.js";

const base = () => structuredClone(EXAMPLES.find((e) => e.id === "PO89908").input);

describe("validateInput", () => {
  it("accepts every confirmed example", () => {
    for (const { input } of EXAMPLES) {
      expect(validateInput(input).errors).toEqual({});
    }
  });

  it("flags every required field on a blank weight-mode form", () => {
    const { errors } = validateInput({
      freight: { mode: "weight", weight: 0, rate: 0 },
      wetlockQty: 0, wetlockUnitPrice: 0, totalCases: 0, items: {},
    });
    expect(Object.keys(errors).sort()).toEqual(["items", "rate", "totalCases", "weight"]);
  });

  it("only checks the active freight mode", () => {
    const input = base();
    input.freight = { mode: "dollars", dollars: 0, weight: 0, rate: 0 };
    const { errors } = validateInput(input);
    expect(errors.dollars).toBeDefined();
    expect(errors.weight).toBeUndefined();
    expect(errors.rate).toBeUndefined();
  });

  it("reports unparseable numbers instead of treating them as zero", () => {
    const input = base();
    input.freight.weight = NaN;
    input.items.qty16 = NaN;
    const { errors } = validateInput(input);
    expect(errors.weight).toBe("Enter a number.");
    expect(errors.qty16).toBe("Enter a number.");
  });

  it("requires a base cost for any product with a quantity", () => {
    const input = base();
    input.items.baseCost10 = 0;
    expect(validateInput(input).errors.baseCost10).toBe("Enter the base cost per jar.");
  });

  it("ignores a cost entered without a quantity", () => {
    const input = base();
    input.items.qtyShell = 0;
    expect(validateInput(input).errors).toEqual({});
  });

  it("rejects negative quantities and costs", () => {
    const input = base();
    input.items.qty4 = -12;
    input.wetlockUnitPrice = -1;
    const { errors } = validateInput(input);
    expect(errors.qty4).toBeDefined();
    expect(errors.wetlockUnitPrice).toBeDefined();
  });

  it("warns, without blocking, when total cases differs from wetlock qty", () => {
    const input = base();
    input.totalCases = 17;
    const { errors, warnings } = validateInput(input);
    expect(errors).toEqual({});
    expect(warnings.totalCases).toMatch(/Wetlock qty is 16/);
  });
});
