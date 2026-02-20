import { describe, expect, it } from "vitest";
import { parseTimeCell } from "@/effects/timeParser";

describe("parseTimeCell", () => {
  it("parses excel time fraction and datetime serial", () => {
    expect(parseTimeCell(0.375)).toEqual({ ok: true, timeHHmm: "09:00" });
    expect(parseTimeCell(45500.5)).toEqual({ ok: true, timeHHmm: "12:00" });
  });

  it("parses text formats including arabic AM/PM", () => {
    expect(parseTimeCell("9")).toEqual({ ok: true, timeHHmm: "09:00" });
    expect(parseTimeCell("9.30")).toEqual({ ok: true, timeHHmm: "09:30" });
    expect(parseTimeCell("09:00 ص")).toEqual({ ok: true, timeHHmm: "09:00" });
    expect(parseTimeCell("12:30 م")).toEqual({ ok: true, timeHHmm: "12:30" });
    expect(parseTimeCell("1:15 PM")).toEqual({ ok: true, timeHHmm: "13:15" });
  });
});
