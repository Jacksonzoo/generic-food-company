import { describe, it, expect } from "vitest";
import { SKUS } from "../src/core/constants.js";
import { isOverride, priceOverrides, priceLabel } from "../src/core/pricing.js";
import { calculate } from "../src/core/calculator.js";
import { buildNotices } from "../src/core/notices.js";
import { EXAMPLES } from "../src/core/examples.js";

const listPrices = () => Object.fromEntries(SKUS.map((s) => [s.label, s.listPrice]));
const sku = (key) => SKUS.find((s) => s.key === key);

describe("company price list", () => {
  // A price change should be deliberate: update constants.js AND this expectation in the same commit.
  it("is pinned to the current list prices", () => {
    expect(listPrices()).toEqual({ "16oz jars": 8.05, "10oz jars": 5.35, "4# tubs": 29.2, "Shell oysters": 72 });
  });

  it("matches the base costs on every confirmed PO", () => {
    for (const { input } of EXAMPLES) {
      expect(priceOverrides(input.items)).toEqual([]);
    }
  });
});

describe("isOverride", () => {
  it("is false at the list price, including float noise", () => {
    expect(isOverride(sku("4lb"), 29.2)).toBe(false);
    expect(isOverride(sku("4lb"), 29.1 + 0.1)).toBe(false);
  });

  it("is true for any real difference", () => {
    expect(isOverride(sku("16oz"), 8.0501)).toBe(true);
  });
});

describe("priceOverrides", () => {
  it("lists only overridden SKUs that are on the PO", () => {
    const items = { qty16: 10, baseCost16: 8.10, qty10: 0, baseCost10: 9.99, qty4: 12, baseCost4: 29.2 };
    expect(priceOverrides(items).map((o) => [o.sku.key, o.cost])).toEqual([["16oz", 8.10]]);
  });
});

describe("override notice", () => {
  it("names the SKU, the price used, and the list price", () => {
    const input = structuredClone(EXAMPLES.find((e) => e.id === "PO89601").input);
    input.items.baseCost16 = 8.1;
    const notice = buildNotices(input, calculate(input)).find((n) => n.id === "override-16oz");
    expect(notice).toMatchObject({
      level: "warning",
      message: "16oz jars base cost $8.10 overrides the list price of $8.05.",
    });
  });
});

describe("priceLabel", () => {
  it.each([[8.05, "$8.05"], [72, "$72.00"], [8.0525, "$8.0525"]])("%d → %s", (n, label) => {
    expect(priceLabel(n)).toBe(label);
  });
});
