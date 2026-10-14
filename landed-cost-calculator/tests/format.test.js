import { describe, it, expect } from "vitest";
import { money, fixed, quantity, percent, plural, escapeHtml, entreeText } from "../src/ui/format.js";
import { calculate } from "../src/core/calculator.js";
import { EXAMPLES } from "../src/core/examples.js";

describe("formatters", () => {
  it("formats money with separators and never prints -$0.00", () => {
    expect(money(5610.1)).toBe("$5,610.10");
    expect(money(-4.55e-13)).toBe("$0.00");
    expect(money(-269.07)).toBe("-$269.07");
  });

  it("fixes decimals without negative zero", () => {
    expect(fixed(9.4514322917, 7)).toBe("9.4514323");
    expect(fixed(-1e-12, 4)).toBe("0.0000");
  });

  it("trims quantities", () => {
    expect(quantity(5.625)).toBe("5.625");
    expect(quantity(1234)).toBe("1,234");
    expect(quantity(0.3333333, 2)).toBe("0.33");
  });

  it("formats uplift percentages", () => {
    expect(percent(0.174)).toBe("+17.4%");
    expect(percent(0)).toBe("0.0%");
  });

  it("pluralises units", () => {
    expect(plural(1, "case")).toBe("1 case");
    expect(plural(270, "jar")).toBe("270 jars");
  });

  it("escapes HTML in user text", () => {
    expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;");
  });
});

describe("entreeText", () => {
  it("produces one paste-ready line per SKU", () => {
    const calc = calculate(EXAMPLES.find((e) => e.id === "PO89908").input);
    expect(entreeText(calc, 7)).toBe(
      ["16oz jars: 9.4514323", "10oz jars: 6.6112891", "4# tubs: 34.8057292", "Shell oysters: 139.2687500"].join("\n"),
    );
  });
});
