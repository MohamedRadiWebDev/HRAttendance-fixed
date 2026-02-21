import { describe, expect, it } from "vitest";
import { normalizeEmployeeCode } from "@shared/employee-code";
import { computePenaltyEntries } from "@/engine/penalties";
import { computeOvertimeHours } from "@/engine/overtime";

describe("unit: normalization/penalties/overtime", () => {
  it("normalizes employee codes including arabic numerals and invisibles", () => {
    expect(normalizeEmployeeCode("  ١٢٣\u200B ")).toBe("123");
    expect(normalizeEmployeeCode("۰۰۷")).toBe("007");
  });

  it("computes penalties entries deterministically", () => {
    const entries = computePenaltyEntries({
      isExcused: false,
      latePenaltyValue: 0.5,
      lateMinutes: 35,
      missingCheckout: true,
      earlyLeaveTriggered: false,
    });
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "تأخير", value: 0.5 }),
        expect.objectContaining({ type: "سهو بصمة", value: 0.5 }),
      ])
    );
  });

  it("overtime starts after shift end + 1 hour threshold", () => {
    const hours = computeOvertimeHours({
      shiftEnd: "17:00:00",
      checkOutSeconds: 19 * 3600,
    });
    expect(hours).toBe(1);
  });
});
