import { describe, expect, it } from "vitest";
import { normalizeEffectDateKey } from "@shared/effect-normalization";

describe("normalizeEffectDateKey", () => {
  it("keeps local Date values without timezone day shift", () => {
    const localDate = new Date(2026, 1, 5, 10, 30, 0); // 2026-02-05 local
    expect(normalizeEffectDateKey(localDate)).toBe("2026-02-05");
  });

  it("normalizes text dates as pure local date keys", () => {
    expect(normalizeEffectDateKey("2026-02-05")).toBe("2026-02-05");
    expect(normalizeEffectDateKey("5/2/2026")).toBe("2026-02-05");
    expect(normalizeEffectDateKey("05-02-2026")).toBe("2026-02-05");
  });
});
