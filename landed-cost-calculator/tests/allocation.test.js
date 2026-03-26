import { describe, it, expect } from "vitest";
import { allocateCases } from "../src/core/allocation.js";

describe("allocateCases", () => {
  it("assigns leftover retail cases to 10oz when 16oz doesn't fill them all", () => {
    // 10 total cases, 0 fixed → 10 retail
    // 16oz: 318 jars → 318/48 = 6.625 cases (< 10) → cases16 = 6.625
    // cases10 = 10 - 6.625 = 3.375
    const r = allocateCases({ qty16: 318, qty10: 20, totalCases: 10 });
    expect(r.cases16).toBeCloseTo(318 / 48);
    expect(r.cases10).toBeCloseTo(10 - 318 / 48);
    expect(r.fixedCases).toBe(0);
    expect(r.retailCases).toBe(10);
  });

  it("caps cases16 at retailCases when 16oz would exceed available retail", () => {
    // Only 1 retail case available, but 480 jars = 10 cases worth
    const r = allocateCases({ qty16: 480, totalCases: 1 });
    expect(r.cases16).toBe(1);
    expect(r.cases10).toBe(0);
  });

  it("computes fixed cases from 4# tubs and shell", () => {
    // 96 tubs = 8 cases, 1 shell case → fixedCases = 9
    const r = allocateCases({ qty4: 96, qtyShell: 1, qty16: 48, totalCases: 10 });
    expect(r.cases4).toBe(8);
    expect(r.casesShell).toBe(1);
    expect(r.fixedCases).toBe(9);
    expect(r.retailCases).toBe(1);
    expect(r.cases16).toBe(1); // 48/48 = 1, min(1, 1) = 1
    expect(r.cases10).toBe(0);
  });

  it("cases10 is leftover retail after 16oz — even with no qty10 input", () => {
    // 270 jars / 48 = 5.625 cases of 16oz; 9 - 5.625 = 3.375 leftover
    const r = allocateCases({ qty16: 270, totalCases: 9 });
    expect(r.cases16).toBeCloseTo(5.625);
    expect(r.cases10).toBeCloseTo(3.375);
  });
});
