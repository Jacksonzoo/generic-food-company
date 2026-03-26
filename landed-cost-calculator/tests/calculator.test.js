import { describe, it, expect } from "vitest";
import { calculate } from "../src/core/calculator.js";

// Helper: round to N decimal places for comparison
const r = (n, d = 10) => Math.round(n * 10 ** d) / 10 ** d;

// ─── PO fixtures ──────────────────────────────────────────────────────────────

const PO88993 = {
  po: "88993",
  freight: { mode: "dollars", dollars: 585.90 },
  wetlockQty: 9,
  wetlockUnitPrice: 6.50,
  totalCases: 9,
  items: {
    qty16: 270,  baseCost16: 8.05,
    qty10: 20,   baseCost10: 5.35,
    qty4:  24,   baseCost4:  29.20,
    qtyShell: 1, baseCostShell: 72,
  },
};

const PO89601 = {
  po: "89601",
  freight: { mode: "weight", weight: 616, rate: 1.05 },
  wetlockQty: 10,
  wetlockUnitPrice: 6.50,
  totalCases: 10,
  items: {
    qty16: 318, baseCost16: 8.05,
    qty10: 20,  baseCost10: 5.35,
    qty4:  36,  baseCost4:  29.20,
  },
};

const PO89699 = {
  po: "89699",
  freight: { mode: "weight", weight: 588, rate: 1.05 },
  wetlockQty: 10,
  wetlockUnitPrice: 6.50,
  totalCases: 10,
  items: {
    qty16: 48,  baseCost16: 8.05,
    qty4:  96,  baseCost4:  29.20,
    qtyShell: 1, baseCostShell: 72,
  },
};

const PO89791 = {
  po: "89791",
  freight: { mode: "weight", weight: 796, rate: 1.05 },
  wetlockQty: 13,
  wetlockUnitPrice: 6.50,
  totalCases: 13,
  items: {
    qty16: 366, baseCost16: 8.05,
    qty10: 20,  baseCost10: 5.35,
    qty4:  60,  baseCost4:  29.20,
  },
};

const PO89908 = {
  po: "89908",
  freight: { mode: "weight", weight: 926, rate: 1.05 },
  wetlockQty: 16,
  wetlockUnitPrice: 6.50,
  totalCases: 16,
  items: {
    qty16: 270,  baseCost16: 8.05,
    qty10: 20,   baseCost10: 5.35,
    qty4:  108,  baseCost4:  29.20,
    qtyShell: 1, baseCostShell: 72,
  },
};

// ─── Expected final lot costs ─────────────────────────────────────────────────

describe("PO88993", () => {
  const calc = calculate(PO88993);

  it("tie-out passes", () => {
    expect(Math.abs(calc.tieOutDiff)).toBeLessThan(0.01);
  });
  it("16oz final cost", () => {
    const row = calc.results.find((r) => r.sku === "16oz jars");
    expect(row.finalCost).toBeCloseTo(9.5416667, 5);
  });
  it("10oz final cost", () => {
    const row = calc.results.find((r) => r.sku === "10oz jars");
    expect(row.finalCost).toBeCloseTo(6.6925, 5);
  });
  it("4# final cost", () => {
    const row = calc.results.find((r) => r.sku === "4# tubs");
    expect(row.finalCost).toBeCloseTo(35.1666667, 5);
  });
  it("Shell final cost", () => {
    const row = calc.results.find((r) => r.sku === "Shell oysters");
    expect(row.finalCost).toBeCloseTo(143.60, 4);
  });
});

describe("PO89601", () => {
  const calc = calculate(PO89601);

  it("freight computed as 616 × 1.05 = 646.80", () => {
    expect(calc.freightCost).toBeCloseTo(646.80, 4);
  });
  it("tie-out passes", () => {
    expect(Math.abs(calc.tieOutDiff)).toBeLessThan(0.01);
  });
  it("16oz final cost", () => {
    const row = calc.results.find((r) => r.sku === "16oz jars");
    expect(row.finalCost).toBeCloseTo(9.532917, 4);
  });
  it("10oz final cost", () => {
    const row = calc.results.find((r) => r.sku === "10oz jars");
    expect(row.finalCost).toBeCloseTo(6.684625, 4);
  });
  it("4# final cost", () => {
    const row = calc.results.find((r) => r.sku === "4# tubs");
    expect(row.finalCost).toBeCloseTo(35.1316667, 4);
  });
});

describe("PO89699", () => {
  const calc = calculate(PO89699);

  it("freight = 588 × 1.05 = 617.40", () => {
    expect(calc.freightCost).toBeCloseTo(617.40, 4);
  });
  it("tie-out passes", () => {
    expect(Math.abs(calc.tieOutDiff)).toBeLessThan(0.01);
  });
  it("16oz final cost", () => {
    const row = calc.results.find((r) => r.sku === "16oz jars");
    expect(row.finalCost).toBeCloseTo(9.4716667, 5);
  });
  it("4# final cost", () => {
    const row = calc.results.find((r) => r.sku === "4# tubs");
    expect(row.finalCost).toBeCloseTo(34.8866667, 5);
  });
  it("Shell final cost", () => {
    const row = calc.results.find((r) => r.sku === "Shell oysters");
    expect(row.finalCost).toBeCloseTo(140.24, 4);
  });
});

describe("PO89791", () => {
  const calc = calculate(PO89791);

  it("freight = 796 × 1.05 = 835.80", () => {
    expect(calc.freightCost).toBeCloseTo(835.80, 4);
  });
  it("tie-out passes", () => {
    expect(Math.abs(calc.tieOutDiff)).toBeLessThan(0.01);
  });
  it("16oz final cost", () => {
    const row = calc.results.find((r) => r.sku === "16oz jars");
    expect(row.finalCost).toBeCloseTo(9.5248397, 5);
  });
  it("10oz final cost", () => {
    const row = calc.results.find((r) => r.sku === "10oz jars");
    expect(row.finalCost).toBeCloseTo(6.6773558, 5);
  });
  it("4# final cost", () => {
    const row = calc.results.find((r) => r.sku === "4# tubs");
    expect(row.finalCost).toBeCloseTo(35.099359, 5);
  });
});

describe("PO89908", () => {
  const calc = calculate(PO89908);

  it("freight = 926 × 1.05 = 972.30", () => {
    expect(calc.freightCost).toBeCloseTo(972.30, 4);
  });
  it("tie-out passes", () => {
    expect(Math.abs(calc.tieOutDiff)).toBeLessThan(0.01);
  });
  it("16oz final cost", () => {
    const row = calc.results.find((r) => r.sku === "16oz jars");
    expect(row.finalCost).toBeCloseTo(9.4514323, 5);
  });
  it("10oz final cost", () => {
    const row = calc.results.find((r) => r.sku === "10oz jars");
    expect(row.finalCost).toBeCloseTo(6.6112891, 5);
  });
  it("4# final cost", () => {
    const row = calc.results.find((r) => r.sku === "4# tubs");
    expect(row.finalCost).toBeCloseTo(34.8057292, 5);
  });
  it("Shell final cost", () => {
    const row = calc.results.find((r) => r.sku === "Shell oysters");
    expect(row.finalCost).toBeCloseTo(139.26875, 5);
  });
});
