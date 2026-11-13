import { describe, it, expect } from "vitest";
import { calculate } from "../src/core/calculator.js";
import { buildNotices } from "../src/core/notices.js";
import { EXAMPLES } from "../src/core/examples.js";

const example = (id) => structuredClone(EXAMPLES.find((e) => e.id === id).input);
const ids = (input) => buildNotices(input, calculate(input)).map((n) => n.id);

describe("buildNotices", () => {
  it("raises nothing for a clean Maersk-invoice PO", () => {
    expect(ids(example("PO89601"))).toEqual([]);
  });

  it("notes Delta DN and AWB freight sources", () => {
    expect(ids(example("PO89908"))).toEqual(["source-delta"]);
    const awb = example("PO89601");
    awb.freight.source = "awb";
    expect(ids(awb)).toEqual(["source-awb"]);
  });

  it("explains a tie-out failure when fixed cases exceed cases shipped", () => {
    const input = example("PO89908");
    input.totalCases = 8; // 4# tubs (9) + shell (1) need 10
    const notices = buildNotices(input, calculate(input));
    expect(notices.map((n) => n.id)).toEqual(
      expect.arrayContaining(["tie-out", "fixed-overflow", "cap-16oz", "no-room-10oz", "case-mismatch"]),
    );
    expect(notices[0].level).toBe("danger");
  });

  it("warns when leftover retail space has no 10oz jars to absorb it", () => {
    const input = example("PO89699");
    input.items.qty16 = 24; // half a case, leaving retail space with no 10oz
    expect(ids(input)).toContain("orphan-retail");
  });

  it("flags a partial case of 4# tubs", () => {
    const input = example("PO89601");
    input.items.qty4 = 30;
    expect(ids(input)).toContain("partial-4lb");
  });

  it("sorts danger before warning before info", () => {
    const input = example("PO89908");
    input.totalCases = 8;
    const levels = buildNotices(input, calculate(input)).map((n) => n.level);
    const rank = { danger: 0, warning: 1, info: 2 };
    expect(levels).toEqual([...levels].sort((a, b) => rank[a] - rank[b]));
  });
});
