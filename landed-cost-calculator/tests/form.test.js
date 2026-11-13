import { describe, it, expect } from "vitest";
import { parseNumber, formatMoneyInput, buildInput, valuesFromInput, emptyValues, isAtListPrice } from "../src/ui/form.js";
import { calculate } from "../src/core/calculator.js";
import { EXAMPLES } from "../src/core/examples.js";
import { DEFAULTS, SKUS } from "../src/core/constants.js";

describe("parseNumber", () => {
  it.each([
    ["", 0],
    ["  ", 0],
    ["616", 616],
    ["1.05", 1.05],
    [".5", 0.5],
    ["5.", 5],
    ["$1,234.50", 1234.5],
    ["-3", -3],
  ])("%j → %d", (raw, expected) => {
    expect(parseNumber(raw)).toBe(expected);
  });

  it.each(["92x6", "1.2.3", "abc", "--1"])("%j → NaN", (raw) => {
    expect(parseNumber(raw)).toBeNaN();
  });
});

describe("formatMoneyInput", () => {
  it.each([
    ["29.2", "29.20"],
    ["72", "72.00"],
    ["8.0525", "8.0525"],
    ["$1,234.5", "1234.50"],
    ["", ""],
    ["abc", "abc"],
  ])("%j → %j", (raw, expected) => {
    expect(formatMoneyInput(raw)).toBe(expected);
  });
});

describe("buildInput", () => {
  it("defaults total cases to wetlock qty when left blank", () => {
    const input = buildInput({ ...emptyValues(DEFAULTS), wetlockQty: "12", totalCases: "" });
    expect(input.totalCases).toBe(12);
  });

  it("uses only the fields for the selected freight mode", () => {
    const values = { ...emptyValues(DEFAULTS), mode: "dollars", dollars: "585.90", weight: "999" };
    expect(buildInput(values).freight).toEqual({ mode: "dollars", source: "maersk", dollars: 585.9 });
  });

  it("trims the PO number", () => {
    expect(buildInput({ ...emptyValues(DEFAULTS), po: "  89908 " }).po).toBe("89908");
  });
});

describe("valuesFromInput → buildInput round trip", () => {
  it.each(EXAMPLES.map((e) => [e.label, e]))("%s calculates identically", (_label, { input }) => {
    const roundTripped = buildInput({ ...emptyValues(DEFAULTS), ...stripUndefined(valuesFromInput(input)) });
    expect(calculate(roundTripped).results).toEqual(calculate(input).results);
  });
});

describe("emptyValues", () => {
  it("keeps saved defaults for rate and wetlock price", () => {
    const values = emptyValues({ freightRate: 1.1, wetlockUnitPrice: 7, decimals: 4 });
    expect(values.rate).toBe("1.10");
    expect(values.wetlockUnitPrice).toBe("7.00");
    expect(values.qty16).toBe("");
  });

  it("pre-fills every base cost from the price list", () => {
    const values = emptyValues(DEFAULTS);
    expect([values.baseCost16, values.baseCost10, values.baseCost4, values.baseCostShell])
      .toEqual(["8.05", "5.35", "29.20", "72.00"]);
  });
});

describe("isAtListPrice", () => {
  const tubs = SKUS.find((s) => s.key === "4lb");

  it.each([["29.20", true], ["29.2", true], ["", true], ["29.25", false], ["abc", false]])("%j → %s", (raw, expected) => {
    expect(isAtListPrice(tubs, raw)).toBe(expected);
  });
});

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
